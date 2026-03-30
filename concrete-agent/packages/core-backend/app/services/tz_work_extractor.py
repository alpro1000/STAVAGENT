"""
TZ → WorkRequirements Extractor (Stage 5)

Extracts structured work requirements from Czech technical documentation (TZ).
Two layers:
  - L1: Regex extraction (conf=1.0) — concrete grades, thicknesses, norms, quantities
  - L2: AI decomposition (conf=0.70) — paragraph → 3-8 work requirements

Used by the TZ→Soupis pipeline to generate soupis prací.

Author: STAVAGENT Team
Version: 1.0.0
"""

import re
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class ExtractedParam:
    """A parameter extracted from TZ text with source context."""
    type: str           # concrete_class, thickness, norm, dimension, quantity, material, etc.
    value: str          # Raw extracted value
    normalized: str     # Normalized value (e.g. "C30/37", "0.18 m")
    unit: Optional[str] = None
    confidence: float = 1.0
    source_line: Optional[int] = None


@dataclass
class WorkRequirement:
    """A single work requirement decomposed from TZ text."""
    description: str            # Czech description of the work
    work_type: Optional[str] = None  # BETON, VYZTUŽ, BEDNĚNÍ, ZATEPLENÍ, etc.
    params: List[ExtractedParam] = field(default_factory=list)
    source_paragraph: Optional[str] = None
    source_line_start: Optional[int] = None
    source_line_end: Optional[int] = None
    confidence: float = 1.0
    extraction_method: str = "regex"  # regex | ai | mixed


# ============================================================================
# L1: Regex extraction (confidence = 1.0)
# ============================================================================

# Concrete classes: C20/25, C25/30 XC2, C30/37 XF3+XD2
CONCRETE_CLASS_RE = re.compile(
    r'\b(C\s*(\d{2,3})\s*/\s*(\d{2,3}))\s*'
    r'((?:X[CDFASM]\d(?:\s*\+\s*X[CDFASM]\d)*)?)',
    re.IGNORECASE
)

# Exposure classes: XC1, XD2, XF3, XA1, XM2
EXPOSURE_RE = re.compile(r'\b(X[CDFASM][1-4])\b', re.IGNORECASE)

# Steel grades: B500B, B500A, 10 505
STEEL_RE = re.compile(r'\b(B\s*500\s*[AB]|10\s*505(?:\s*\(R\))?)\b', re.IGNORECASE)

# Thicknesses: tl. 200 mm, tloušťka 0,18 m, tl.300mm
THICKNESS_RE = re.compile(
    r'(?:tl(?:oušťk[auy])?\.?\s*)(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b',
    re.IGNORECASE
)

# Dimensions: 5,0 x 3,2 m, 12×8 m, šířka 600 mm, výška 2,5 m, délka 15 m
DIM_RE = re.compile(
    r'(?:šířk[auy]|výšk[auy]|délk[auy]|rozměr[yů]?|průměr)\s*'
    r'(?:=\s*|:\s*)?(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b',
    re.IGNORECASE
)

# Quantities: 45 m³, 150,5 m², 12.3 t, 24 ks
QUANTITY_RE = re.compile(
    r'\b(\d+(?:[\s,.]\d+)?)\s*(m[²³23]|m|ks|kg|t|km|l|kus|hod|soubor|kpl|bm)\b',
    re.IGNORECASE
)

# DN pipes: DN 150, DN150, DN 200
DN_RE = re.compile(r'\bDN\s*(\d{2,4})\b', re.IGNORECASE)

# Power: 5 kW, 2,5 MW, 100 W
POWER_RE = re.compile(r'\b(\d+(?:[,.]\d+)?)\s*(kW|MW|W)\b', re.IGNORECASE)

# Norms: ČSN 73 6244, EN 206, ČSN EN 1992-1-1, TKP 18
NORM_RE = re.compile(
    r'\b((?:ČSN\s*(?:EN\s*)?|EN\s+|TKP\s+|VTP\s+)\d[\d\s\-/]*\d)\b',
    re.IGNORECASE
)

# Volume explicit: objem 45 m³, V = 12,5 m3
VOLUME_RE = re.compile(
    r'(?:objem|V\s*=)\s*(\d+(?:[,.]\d+)?)\s*m[³3]',
    re.IGNORECASE
)

# Area explicit: plocha 120 m², S = 45,5 m2
AREA_RE = re.compile(
    r'(?:plocha|S\s*=)\s*(\d+(?:[,.]\d+)?)\s*m[²2]',
    re.IGNORECASE
)

# Weight: hmotnost 2,5 t, 1500 kg
WEIGHT_RE = re.compile(
    r'(?:hmotnost|váha)\s*(?:=\s*)?(\d+(?:[,.]\d+)?)\s*(t|kg)',
    re.IGNORECASE
)

# Work type keywords (maps to work_type categories)
WORK_TYPE_KEYWORDS = [
    (re.compile(r'beton[áůo]|betonáž|betonov|beton\b', re.I), 'BETON'),
    (re.compile(r'výztuž|armatur|armování', re.I), 'VYZTUŽ'),
    (re.compile(r'bedněn', re.I), 'BEDNĚNÍ'),
    (re.compile(r'zatepl|etics|kzs|kontaktní\s*systém', re.I), 'ZATEPLENÍ'),
    (re.compile(r'omít', re.I), 'OMÍTKY'),
    (re.compile(r'izolac|hydroizolac|asfalt.*pás', re.I), 'IZOLACE'),
    (re.compile(r'bourán|demontáž|demolice', re.I), 'BOURÁNÍ'),
    (re.compile(r'lešen', re.I), 'LEŠENÍ'),
    (re.compile(r'přesun\s*hmot', re.I), 'PŘESUNY'),
    (re.compile(r'výkop|hlouben|zemní', re.I), 'ZEMNÍ_PRÁCE'),
    (re.compile(r'pilot|mikropilot', re.I), 'PILOTY'),
    (re.compile(r'základ[yů]|základov', re.I), 'ZÁKLADY'),
    (re.compile(r'zdiv[oa]|zdění|příčk', re.I), 'ZDĚNÍ'),
    (re.compile(r'sádrokart|suché\s*výstav|sdk', re.I), 'SDK'),
    (re.compile(r'obklad|dlažb', re.I), 'OBKLADY'),
    (re.compile(r'malb[ya]|nátěr', re.I), 'MALBY_NÁTĚRY'),
    (re.compile(r'klempíř|oplech|žlab', re.I), 'KLEMPÍŘSKÉ'),
    (re.compile(r'zámečn|ocel.*konstr', re.I), 'ZÁMEČNICKÉ'),
    (re.compile(r'truhlář|okn[oa]|dveř', re.I), 'TRUHLÁŘSKÉ'),
    (re.compile(r'elektro|kabel|rozvad', re.I), 'ELEKTRO'),
    (re.compile(r'vodovod|kanalizac|zti', re.I), 'ZTI'),
    (re.compile(r'vzduchotech|vzt', re.I), 'VZT'),
    (re.compile(r'vytápěn|kotel|radiát', re.I), 'ÚT'),
    (re.compile(r'odvoz|skládkovné|suť', re.I), 'LIKVIDACE'),
    (re.compile(r'střech|krytina|krov', re.I), 'STŘECHA'),
    (re.compile(r'podlah|nivelac', re.I), 'PODLAHY'),
    (re.compile(r'komunikac|chodník|obrub|vozovk', re.I), 'KOMUNIKACE'),
    (re.compile(r'trubní|potrubí|šacht', re.I), 'TRUBNÍ_VEDENÍ'),
]


def detect_work_type(text: str) -> Optional[str]:
    """Detect primary work type from text."""
    for pattern, wtype in WORK_TYPE_KEYWORDS:
        if pattern.search(text):
            return wtype
    return None


def extract_params_regex(text: str) -> List[ExtractedParam]:
    """Extract all parameters from text using regex (L1, conf=1.0)."""
    params = []

    # Concrete classes
    for m in CONCRETE_CLASS_RE.finditer(text):
        normalized = m.group(1).replace(' ', '')
        exposure = m.group(4).strip() if m.group(4) else None
        params.append(ExtractedParam(
            type='concrete_class', value=m.group(0).strip(),
            normalized=normalized + (f' {exposure}' if exposure else ''),
            confidence=1.0
        ))

    # Exposure classes (standalone)
    for m in EXPOSURE_RE.finditer(text):
        params.append(ExtractedParam(
            type='exposure_class', value=m.group(1),
            normalized=m.group(1).upper(), confidence=1.0
        ))

    # Steel grades
    for m in STEEL_RE.finditer(text):
        params.append(ExtractedParam(
            type='steel_grade', value=m.group(1),
            normalized=m.group(1).replace(' ', ''), confidence=1.0
        ))

    # Thicknesses
    for m in THICKNESS_RE.finditer(text):
        val = m.group(1).replace(',', '.')
        unit = m.group(2)
        params.append(ExtractedParam(
            type='thickness', value=m.group(0),
            normalized=f'{val} {unit}', unit=unit, confidence=1.0
        ))

    # Norms
    for m in NORM_RE.finditer(text):
        params.append(ExtractedParam(
            type='norm', value=m.group(1),
            normalized=m.group(1).strip(), confidence=1.0
        ))

    # DN
    for m in DN_RE.finditer(text):
        params.append(ExtractedParam(
            type='dn', value=m.group(0),
            normalized=f'DN {m.group(1)}', unit='mm', confidence=1.0
        ))

    # Power
    for m in POWER_RE.finditer(text):
        params.append(ExtractedParam(
            type='power', value=m.group(0),
            normalized=f'{m.group(1).replace(",", ".")} {m.group(2)}',
            unit=m.group(2), confidence=1.0
        ))

    # Explicit volumes
    for m in VOLUME_RE.finditer(text):
        params.append(ExtractedParam(
            type='volume', value=m.group(0),
            normalized=f'{m.group(1).replace(",", ".")} m³',
            unit='m³', confidence=1.0
        ))

    # Explicit areas
    for m in AREA_RE.finditer(text):
        params.append(ExtractedParam(
            type='area', value=m.group(0),
            normalized=f'{m.group(1).replace(",", ".")} m²',
            unit='m²', confidence=1.0
        ))

    return params


# ============================================================================
# Paragraph splitting
# ============================================================================

def split_into_paragraphs(text: str) -> List[Dict[str, Any]]:
    """Split TZ text into meaningful paragraphs for processing."""
    paragraphs = []
    lines = text.split('\n')
    current = []
    start_line = 0

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append({
                    'text': '\n'.join(current),
                    'start': start_line,
                    'end': i - 1,
                })
                current = []
            continue

        if not current:
            start_line = i
        current.append(stripped)

    if current:
        paragraphs.append({
            'text': '\n'.join(current),
            'start': start_line,
            'end': len(lines) - 1,
        })

    # Filter out very short paragraphs (headers, page numbers)
    return [p for p in paragraphs if len(p['text']) > 30]


# ============================================================================
# L1 extraction: Regex only (conf=1.0)
# ============================================================================

def extract_work_requirements_regex(text: str) -> List[WorkRequirement]:
    """
    Extract work requirements using regex only (L1).
    Returns high-confidence requirements from explicit mentions.
    """
    requirements = []
    paragraphs = split_into_paragraphs(text)

    for para in paragraphs:
        params = extract_params_regex(para['text'])
        if not params:
            continue

        work_type = detect_work_type(para['text'])

        req = WorkRequirement(
            description=para['text'][:300],
            work_type=work_type,
            params=params,
            source_paragraph=para['text'],
            source_line_start=para['start'],
            source_line_end=para['end'],
            confidence=1.0,
            extraction_method='regex',
        )
        requirements.append(req)

    return requirements


# ============================================================================
# L2: AI decomposition (conf=0.70)
# ============================================================================

AI_DECOMPOSE_PROMPT = """Jsi expert na české stavební technické zprávy (TZ) a tvorbu soupisů prací.

Analyzuj následující odstavec z technické zprávy a rozlož ho na JEDNOTLIVÉ PRACOVNÍ POŽADAVKY.

Pro každý požadavek uveď:
- description: stručný popis práce (česky, max 100 znaků)
- work_type: typ práce (BETON, VYZTUŽ, BEDNĚNÍ, ZATEPLENÍ, OMÍTKY, IZOLACE, BOURÁNÍ, LEŠENÍ, PŘESUNY, ZEMNÍ_PRÁCE, PILOTY, ZÁKLADY, ZDĚNÍ, SDK, OBKLADY, MALBY_NÁTĚRY, KLEMPÍŘSKÉ, ZÁMEČNICKÉ, TRUHLÁŘSKÉ, ELEKTRO, ZTI, VZT, ÚT, LIKVIDACE, STŘECHA, PODLAHY, KOMUNIKACE, TRUBNÍ_VEDENÍ, MONTÁŽ nebo null)
- params: seznam parametrů [{type, value, unit}] — POUZE z textu, nic nevymýšlej

PRAVIDLA:
- 1 odstavec = typicky 3-8 pracovních požadavků
- NEVYMÝŠLEJ práce, které v textu nejsou
- Rozlož složité prace na dílčí (např. "ŽB strop" → beton + výztuž + bednění)
- Každý požadavek musí mít jasný popis práce

Odstavec TZ:
{paragraph}

Odpověz POUZE validním JSON polem:
[
  {{
    "description": "...",
    "work_type": "...",
    "params": [{{ "type": "...", "value": "...", "unit": "..." }}]
  }}
]"""


async def extract_work_requirements_ai(text: str, paragraph: str) -> List[WorkRequirement]:
    """
    Extract work requirements using AI decomposition (L2, conf=0.70).
    Uses Gemini Flash for fast paragraph decomposition.
    """
    try:
        from app.core.gemini_client import VertexGeminiClient
        client = VertexGeminiClient()
        prompt = AI_DECOMPOSE_PROMPT.replace('{paragraph}', paragraph[:2000])
        response = await client.generate(prompt)

        if not response:
            return []

        # Parse JSON from response
        import json
        # Extract JSON array from response (may have markdown wrapper)
        json_match = re.search(r'\[[\s\S]*\]', response)
        if not json_match:
            return []

        items = json.loads(json_match.group())
        requirements = []
        for item in items:
            params = []
            for p in item.get('params', []):
                params.append(ExtractedParam(
                    type=p.get('type', 'unknown'),
                    value=p.get('value', ''),
                    normalized=p.get('value', ''),
                    unit=p.get('unit'),
                    confidence=0.70,
                ))

            requirements.append(WorkRequirement(
                description=item.get('description', ''),
                work_type=item.get('work_type'),
                params=params,
                source_paragraph=paragraph[:300],
                confidence=0.70,
                extraction_method='ai',
            ))

        return requirements
    except Exception as e:
        logger.warning(f"AI extraction failed: {e}")
        return []


# ============================================================================
# Combined extraction: L1 + L2
# ============================================================================

async def extract_work_requirements(text: str, use_ai: bool = True) -> List[WorkRequirement]:
    """
    Extract work requirements from TZ text.

    L1: Regex (conf=1.0) — always runs
    L2: AI decomposition (conf=0.70) — for paragraphs with parameters but no clear work items

    Returns combined and deduplicated list.
    """
    # L1: Regex extraction
    regex_requirements = extract_work_requirements_regex(text)
    logger.info(f"[TZ] L1 regex: {len(regex_requirements)} requirements")

    if not use_ai:
        return regex_requirements

    # L2: AI decomposition for paragraphs that have relevant content
    paragraphs = split_into_paragraphs(text)

    # Only send paragraphs with construction keywords to AI
    ai_requirements = []
    for para in paragraphs:
        # Skip if already well-covered by regex
        has_regex_coverage = any(
            r.source_line_start == para['start']
            for r in regex_requirements
            if r.source_line_start is not None
        )

        # Only AI-decompose if paragraph has construction keywords
        if detect_work_type(para['text']) and not has_regex_coverage:
            ai_reqs = await extract_work_requirements_ai(text, para['text'])
            for r in ai_reqs:
                r.source_line_start = para['start']
                r.source_line_end = para['end']
            ai_requirements.extend(ai_reqs)

    logger.info(f"[TZ] L2 AI: {len(ai_requirements)} requirements")

    # Merge: regex first (higher confidence), then AI
    all_requirements = regex_requirements + ai_requirements
    return all_requirements


# ============================================================================
# Serialization
# ============================================================================

def requirements_to_dict(requirements: List[WorkRequirement]) -> List[Dict[str, Any]]:
    """Convert requirements to JSON-serializable dicts."""
    return [
        {
            'description': r.description,
            'work_type': r.work_type,
            'params': [asdict(p) for p in r.params],
            'source_paragraph': r.source_paragraph[:200] if r.source_paragraph else None,
            'confidence': r.confidence,
            'extraction_method': r.extraction_method,
        }
        for r in requirements
    ]
