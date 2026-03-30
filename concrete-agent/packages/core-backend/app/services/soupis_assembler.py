"""
Soupis Assembler (Stage 6)

Assembles soupis prací (bill of quantities) from work requirements.

Pipeline:
  1. WorkRequirements (from tz_work_extractor) → keyword extraction
  2. Work Package DB match (trigger_keywords) → expand items + companions
  3. URS lookup (via URS_MATCHER_SERVICE) → specific codes
  4. Assembly: sort by HSV/PSV, attach quantities, generate VV formulas
  5. Output: structured soupis for XLSX export

Uses URS_MATCHER_SERVICE for code lookup when available,
falls back to OTSKP catalog + AI for unknown items.
"""

import asyncio
import logging
import re
import json
import httpx
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict

from app.services.tz_work_extractor import WorkRequirement, ExtractedParam

logger = logging.getLogger(__name__)

# URS Matcher Service URL
URS_MATCHER_URL = None
try:
    from app.core.config import settings
    URS_MATCHER_URL = getattr(settings, 'URS_MATCHER_URL', None) or 'https://urs-matcher-service-1086027517695.europe-west3.run.app'
except Exception:
    URS_MATCHER_URL = 'https://urs-matcher-service-1086027517695.europe-west3.run.app'


@dataclass
class SoupisPosition:
    """A single position in the soupis prací."""
    poradi: int                     # Sequence number
    typ: str = "HSV"               # HSV or PSV
    kod: Optional[str] = None       # URS/OTSKP code
    kod_system: str = "unknown"     # URS, OTSKP, R, manual
    popis: str = ""                 # Description
    mj: Optional[str] = None        # Measurement unit
    mnozstvi: Optional[float] = None  # Quantity
    vv_vzorec: Optional[str] = None   # VV formula (e.g. "5,0*3,2*0,18")
    cenova_soustava: Optional[str] = None  # CS ÚRS / OTSKP / vlastní
    source: str = "manual"          # work_package, urs_match, ai_fallback, manual
    source_detail: Optional[str] = None  # WP ID or match details
    confidence: float = 0.5
    work_type: Optional[str] = None
    section: Optional[str] = None   # Díl number


@dataclass
class SoupisResult:
    """Complete soupis prací result."""
    positions: List[SoupisPosition] = field(default_factory=list)
    work_packages_used: List[str] = field(default_factory=list)
    companion_packages: List[str] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


# ============================================================================
# HSV/PSV section mapping (by first digit of code)
# ============================================================================

HSV_SECTIONS = {
    '1': ('1', 'Zemní práce'),
    '2': ('2', 'Zakládání'),
    '3': ('3', 'Svislé a kompletní konstrukce'),
    '4': ('4', 'Vodorovné konstrukce'),
    '5': ('5', 'Komunikace'),
    '6': ('6', 'Úpravy povrchů, podlahy a osazování'),
    '8': ('8', 'Trubní vedení'),
    '9': ('9', 'Ostatní konstrukce a práce, bourání'),
}

PSV_SECTIONS = {
    '711': 'Izolace proti vodě',
    '712': 'Povlakové krytiny',
    '713': 'Izolace tepelné',
    '720': 'Zdravotechnika',
    '730': 'Ústřední vytápění',
    '762': 'Truhlářské konstrukce',
    '763': 'Ocelové doplňkové konstrukce',
    '764': 'Klempířské práce',
    '766': 'Podlahy',
    '767': 'Zámečnické konstrukce',
    '771': 'Obklady keramické',
    '776': 'Podlahy dlažbové',
    '781': 'Obklady z kamene',
    '783': 'Nátěry',
    '784': 'Malby',
}


def classify_hsv_psv(code: Optional[str]) -> str:
    """Classify code as HSV or PSV based on first digits."""
    if not code:
        return 'HSV'
    clean = code.replace(' ', '')
    if len(clean) >= 3 and clean[:3] in PSV_SECTIONS:
        return 'PSV'
    return 'HSV'


def get_section(code: Optional[str]) -> Optional[str]:
    """Get section (díl) number from code."""
    if not code:
        return None
    clean = code.replace(' ', '')
    if len(clean) >= 3 and clean[:3] in PSV_SECTIONS:
        return clean[:3]
    if clean and clean[0] in HSV_SECTIONS:
        return clean[0]
    return None


# ============================================================================
# Work Package lookup
# ============================================================================

async def lookup_work_packages(keywords: List[str]) -> List[Dict[str, Any]]:
    """Query URS Matcher Service for work packages matching keywords."""
    if not URS_MATCHER_URL:
        return []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try each keyword
            all_packages = []
            for keyword in keywords[:5]:  # Limit to 5 keywords
                resp = await client.get(
                    f'{URS_MATCHER_URL}/api/v1/work-packages',
                    params={'keyword': keyword, 'limit': 3},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    all_packages.extend(data.get('packages', []))

            # Deduplicate by package_id
            seen = set()
            unique = []
            for wp in all_packages:
                pid = wp.get('package_id')
                if pid and pid not in seen:
                    seen.add(pid)
                    unique.append(wp)
            return unique
    except Exception as e:
        logger.warning(f"[SOUPIS] Work Package lookup failed: {e}")
        return []


# ============================================================================
# URS code lookup
# ============================================================================

async def lookup_urs_code(description: str) -> Optional[Dict[str, Any]]:
    """Look up a URS code for a given work description via URS Matcher."""
    if not URS_MATCHER_URL:
        return None

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f'{URS_MATCHER_URL}/api/pipeline/match',
                json={'text': description, 'limit': 1},
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get('results', [])
                if results:
                    return results[0]
    except Exception as e:
        logger.debug(f"[SOUPIS] URS lookup failed for '{description[:50]}': {e}")

    return None


# ============================================================================
# Assemble soupis from work requirements
# ============================================================================

async def assemble_soupis(
    requirements: List[WorkRequirement],
    use_work_packages: bool = True,
    use_urs_lookup: bool = True,
) -> SoupisResult:
    """
    Assemble soupis prací from work requirements.

    Pipeline:
    1. Extract keywords from each requirement
    2. Match to Work Packages (if available)
    3. Look up URS codes for unmatched items
    4. Add companion packages (přesuny, lešení)
    5. Sort by HSV/PSV sections
    """
    result = SoupisResult()
    position_counter = 0

    # Track what work types we have for companion detection
    work_types_seen = set()

    for req in requirements:
        if req.work_type:
            work_types_seen.add(req.work_type)

        # Extract keywords from description
        keywords = extract_keywords(req.description)

        # Step 1: Try Work Package match
        wp_matched = False
        if use_work_packages and keywords:
            packages = await lookup_work_packages(keywords)
            for wp in packages:
                items = wp.get('items', [])
                if isinstance(items, str):
                    try:
                        items = json.loads(items)
                    except Exception:
                        items = []

                for item in items[:10]:  # Max 10 items per WP
                    position_counter += 1
                    pos = SoupisPosition(
                        poradi=position_counter,
                        typ=classify_hsv_psv(item.get('code')),
                        kod=item.get('code'),
                        kod_system='URS' if item.get('code') and len(str(item.get('code', ''))) == 9 else 'OTSKP',
                        popis=item.get('description', ''),
                        mj=item.get('mj'),
                        mnozstvi=extract_quantity_from_req(req, item.get('mj')),
                        source='work_package',
                        source_detail=wp.get('package_id'),
                        confidence=wp.get('confidence', 0.7),
                        work_type=item.get('work_type') or req.work_type,
                        section=get_section(item.get('code')),
                    )
                    result.positions.append(pos)

                result.work_packages_used.append(wp.get('package_id', 'unknown'))
                wp_matched = True
                break  # Use first matching WP

        # Step 2: URS lookup fallback
        if not wp_matched and use_urs_lookup:
            urs_result = await lookup_urs_code(req.description)
            if urs_result:
                position_counter += 1
                code = urs_result.get('code') or urs_result.get('urs_code')
                pos = SoupisPosition(
                    poradi=position_counter,
                    typ=classify_hsv_psv(code),
                    kod=code,
                    kod_system='URS',
                    popis=urs_result.get('name') or urs_result.get('urs_name') or req.description,
                    mj=urs_result.get('unit') or urs_result.get('mj'),
                    mnozstvi=extract_quantity_from_req(req, urs_result.get('unit')),
                    source='urs_match',
                    confidence=urs_result.get('confidence', 0.8),
                    work_type=req.work_type,
                    section=get_section(code),
                )
                result.positions.append(pos)
                continue

        # Step 3: Manual fallback — create position without code
        if not wp_matched:
            position_counter += 1
            pos = SoupisPosition(
                poradi=position_counter,
                typ='HSV',
                popis=req.description[:200],
                mj=guess_mj_from_work_type(req.work_type),
                mnozstvi=extract_quantity_from_req(req, None),
                source='ai_fallback',
                confidence=0.5,
                work_type=req.work_type,
            )
            result.positions.append(pos)
            result.warnings.append(f"Nenalezen kód pro: {req.description[:80]}")

    # Step 4: Add companion packages
    companions_added = add_companion_packages(result, work_types_seen, position_counter)
    position_counter += companions_added

    # Step 5: Sort by HSV/PSV, then by section
    result.positions.sort(key=lambda p: (
        0 if p.typ == 'HSV' else 1,
        p.section or '999',
        p.poradi,
    ))

    # Renumber
    for i, pos in enumerate(result.positions):
        pos.poradi = i + 1

    # Stats
    result.stats = {
        'total_positions': len(result.positions),
        'hsv_count': sum(1 for p in result.positions if p.typ == 'HSV'),
        'psv_count': sum(1 for p in result.positions if p.typ == 'PSV'),
        'with_code': sum(1 for p in result.positions if p.kod),
        'without_code': sum(1 for p in result.positions if not p.kod),
        'by_source': {},
        'work_types': list(work_types_seen),
        'work_packages_used': result.work_packages_used,
    }
    for p in result.positions:
        result.stats['by_source'][p.source] = result.stats['by_source'].get(p.source, 0) + 1

    return result


# ============================================================================
# Helper functions
# ============================================================================

def extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from Czech construction text."""
    # Remove numbers, punctuation
    clean = re.sub(r'[0-9/.,;:()[\]{}]', ' ', text.lower())
    words = clean.split()
    # Filter short words and common Czech stopwords
    stopwords = {'a', 'v', 'na', 'je', 'se', 'z', 'do', 'pro', 'od', 'po', 'při',
                 'ze', 'za', 'ke', 'ku', 'jako', 'nebo', 'ale', 'že', 'i', 'to',
                 'být', 'bude', 'jsou', 'budou', 'bylo', 'beton', 'práce', 'stavba'}
    return [w for w in words if len(w) > 3 and w not in stopwords][:10]


def extract_quantity_from_req(req: WorkRequirement, target_mj: Optional[str]) -> Optional[float]:
    """Extract quantity from requirement parameters matching the target MJ."""
    for param in req.params:
        if param.type in ('volume', 'area', 'quantity') and param.unit:
            try:
                val = float(param.normalized.split()[0].replace(',', '.'))
                return val
            except (ValueError, IndexError):
                continue
    return None


def guess_mj_from_work_type(work_type: Optional[str]) -> Optional[str]:
    """Guess MJ based on work type."""
    type_mj = {
        'BETON': 'm3', 'VYZTUŽ': 't', 'BEDNĚNÍ': 'm2',
        'ZATEPLENÍ': 'm2', 'OMÍTKY': 'm2', 'IZOLACE': 'm2',
        'ZEMNÍ_PRÁCE': 'm3', 'ZDĚNÍ': 'm2', 'SDK': 'm2',
        'OBKLADY': 'm2', 'MALBY_NÁTĚRY': 'm2', 'PODLAHY': 'm2',
        'KLEMPÍŘSKÉ': 'm', 'LEŠENÍ': 'm2', 'PŘESUNY': 't',
        'BOURÁNÍ': 'm3', 'LIKVIDACE': 't',
    }
    return type_mj.get(work_type)


def add_companion_packages(result: SoupisResult, work_types: set, counter: int) -> int:
    """Add companion packages (přesuny, lešení) based on work types present."""
    added = 0

    # Přesuny hmot HSV (always if any HSV work)
    if any(p.typ == 'HSV' for p in result.positions):
        counter += 1
        added += 1
        result.positions.append(SoupisPosition(
            poradi=counter, typ='HSV', kod=None,
            popis='Přesun hmot HSV', mj='t',
            source='companion', confidence=0.95,
            work_type='PŘESUNY', section='9',
        ))
        result.companion_packages.append('přesuny_hsv')

    # Přesuny hmot PSV (if any PSV work)
    if any(p.typ == 'PSV' for p in result.positions):
        counter += 1
        added += 1
        result.positions.append(SoupisPosition(
            poradi=counter, typ='PSV', kod=None,
            popis='Přesun hmot PSV', mj='t',
            source='companion', confidence=0.95,
            work_type='PŘESUNY', section='998',
        ))
        result.companion_packages.append('přesuny_psv')

    # Lešení for facade/height work
    height_types = {'ZATEPLENÍ', 'OMÍTKY', 'KLEMPÍŘSKÉ', 'MALBY_NÁTĚRY'}
    if work_types & height_types:
        counter += 1
        added += 1
        result.positions.append(SoupisPosition(
            poradi=counter, typ='HSV', kod=None,
            popis='Lešení řadové trubkové', mj='m2',
            source='companion', confidence=0.90,
            work_type='LEŠENÍ', section='9',
        ))
        result.companion_packages.append('lešení')

    # Odvoz suti for demolition
    if 'BOURÁNÍ' in work_types:
        counter += 1
        added += 1
        result.positions.append(SoupisPosition(
            poradi=counter, typ='HSV', kod=None,
            popis='Odvoz suti a vybouraných hmot', mj='t',
            source='companion', confidence=0.85,
            work_type='LIKVIDACE', section='9',
        ))
        result.companion_packages.append('odvoz_suti')

    return added


# ============================================================================
# Serialization
# ============================================================================

def soupis_to_dict(result: SoupisResult) -> Dict[str, Any]:
    """Convert SoupisResult to JSON-serializable dict."""
    return {
        'positions': [asdict(p) for p in result.positions],
        'work_packages_used': result.work_packages_used,
        'companion_packages': result.companion_packages,
        'stats': result.stats,
        'warnings': result.warnings,
        'attribution': 'Zdroj dat: Hlídač státu (hlidacstatu.cz) — CC BY 3.0 CZ',
    }
