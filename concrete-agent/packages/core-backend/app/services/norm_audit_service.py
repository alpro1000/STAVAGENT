"""
NKB Audit Service — Web scraping orchestrator + gap analysis.

Crawls external normative sources (SŽ, ŘSD/PJPK, MMR, ČAS, ÚNMZ, etc.),
collects document metadata, compares with NKB database, produces gap report.

Uses:
  - httpx for direct HTML scraping (BeautifulSoup4 for parsing)
  - Perplexity API for sites that are hard to scrape directly
  - Existing NormStore for DB comparison

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

import json
import logging
import re
import uuid
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import settings
from app.models.audit_schemas import (
    AuditResult,
    DocStatus,
    DocType,
    DownloadMissingRequest,
    FoundDocument,
    GapEntry,
    SourcePriority,
    SourceSummary,
    StartAuditRequest,
)
from app.services.norm_source_catalog import NORM_SOURCES, get_sources_by_priority
from app.services.norm_storage import NormStore

logger = logging.getLogger(__name__)

# Module-level state for the running audit
_current_audit: Optional[AuditResult] = None

# Browser-like headers for polite scraping
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

PPLX_API_URL = "https://api.perplexity.ai/chat/completions"
PPLX_MODEL = "sonar"
PPLX_TIMEOUT = 60


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def get_current_audit() -> Optional[AuditResult]:
    """Return the current/last audit result."""
    return _current_audit


async def start_audit(request: StartAuditRequest) -> AuditResult:
    """Start a new NKB audit across all (or selected) sources."""
    global _current_audit

    audit_id = f"audit_{uuid.uuid4().hex[:12]}"
    _current_audit = AuditResult(
        audit_id=audit_id,
        started_at=datetime.utcnow().isoformat(),
        status="running",
    )

    try:
        # Determine which sources to check
        if request.sources:
            sources = [NORM_SOURCES[s] for s in request.sources if s in NORM_SOURCES]
        elif request.priority_filter:
            sources = get_sources_by_priority(request.priority_filter)
        else:
            sources = get_sources_by_priority(1)  # all

        total = len(sources)
        all_found: dict[str, FoundDocument] = {}  # keyed by oznaceni

        for i, source in enumerate(sources):
            _current_audit.current_source = source.source_code
            _current_audit.progress = int((i / total) * 100)

            logger.info(f"[NKB Audit] Scraping source: {source.source_code} ({source.name})")

            try:
                docs = await _scrape_source(source)
                logger.info(f"[NKB Audit] {source.source_code}: found {len(docs)} documents")

                # Merge into all_found (deduplicate by oznaceni)
                for doc in docs:
                    key = _normalize_oznaceni(doc.oznaceni)
                    if key in all_found:
                        # Merge sources
                        existing = all_found[key]
                        for z in doc.zdroje:
                            if z not in existing.zdroje:
                                existing.zdroje.append(z)
                        # Keep higher priority
                        if doc.priorita.value > existing.priorita.value:
                            existing.priorita = doc.priorita
                        # Update URL if missing
                        if not existing.url_ke_stazeni and doc.url_ke_stazeni:
                            existing.url_ke_stazeni = doc.url_ke_stazeni
                        # Update date if newer
                        if doc.datum_ucinnosti and (not existing.datum_ucinnosti or doc.datum_ucinnosti > existing.datum_ucinnosti):
                            existing.datum_ucinnosti = doc.datum_ucinnosti
                    else:
                        all_found[key] = doc

                _current_audit.sources_checked.append(source.source_code)

            except Exception as e:
                logger.error(f"[NKB Audit] Error scraping {source.source_code}: {e}")
                _current_audit.source_summaries.append(SourceSummary(
                    source_code=source.source_code,
                    source_name=source.name,
                    error=str(e),
                ))

        # Gap analysis
        logger.info(f"[NKB Audit] Running gap analysis on {len(all_found)} unique documents")
        gap_entries = await _run_gap_analysis(all_found)

        # Build source summaries
        source_summaries = _build_source_summaries(gap_entries)
        # Merge with any error summaries
        error_codes = {s.source_code for s in _current_audit.source_summaries}
        for s in source_summaries:
            if s.source_code not in error_codes:
                _current_audit.source_summaries.append(s)

        _current_audit.gap_entries = gap_entries
        _current_audit.total_unique_documents = len(gap_entries)
        _current_audit.status = "completed"
        _current_audit.progress = 100
        _current_audit.completed_at = datetime.utcnow().isoformat()
        _current_audit.current_source = None

        logger.info(f"[NKB Audit] Completed: {len(gap_entries)} documents, "
                     f"✅ {sum(1 for g in gap_entries if g.status == DocStatus.AKTUALNI)} | "
                     f"⚠️ {sum(1 for g in gap_entries if g.status == DocStatus.ZASTARALY)} | "
                     f"❌ {sum(1 for g in gap_entries if g.status == DocStatus.CHYBI)} | "
                     f"🔒 {sum(1 for g in gap_entries if g.status == DocStatus.NEDOSTUPNY)}")

    except Exception as e:
        logger.error(f"[NKB Audit] Fatal error: {e}")
        _current_audit.status = "failed"
        _current_audit.error = str(e)
        _current_audit.completed_at = datetime.utcnow().isoformat()

    return _current_audit


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCE SCRAPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _scrape_source(source) -> list[FoundDocument]:
    """Dispatch to the appropriate scraper for a source."""
    scrapers = {
        "pjpk_tp": _scrape_pjpk_page,
        "pjpk_tkp": _scrape_pjpk_page,
        "pjpk_vl": _scrape_pjpk_page,
        "rsd_smernice": _scrape_rsd_page,
        "rsd_ppk": _scrape_rsd_page,
        "rsd_data": _scrape_rsd_page,
        "rsd_metodiky": _scrape_rsd_page,
        "sz": _scrape_via_perplexity,
        "mmr_pravo": _scrape_via_perplexity,
        "mmr_csn": _scrape_via_perplexity,
        "zakonyprolidi": _scrape_via_perplexity,
        "agentura_cas": _scrape_via_perplexity,
        "unmz": _scrape_via_perplexity,
        "ckait": _scrape_via_perplexity,
    }

    fn = scrapers.get(source.source_code)
    if not fn:
        logger.warning(f"No scraper for {source.source_code}, skipping")
        return []

    return await fn(source)


# ---------------------------------------------------------------------------
# Direct HTML scrapers (pjpk.rsd.cz — clean HTML tables)
# ---------------------------------------------------------------------------

async def _scrape_pjpk_page(source) -> list[FoundDocument]:
    """Scrape pjpk.rsd.cz pages which have clean HTML tables of documents."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.warning("BeautifulSoup4 not installed, falling back to Perplexity")
        return await _scrape_via_perplexity(source)

    docs = []
    async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=30, follow_redirects=True) as client:
        resp = await client.get(source.url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # PJPK pages have tables or lists with document links
        # Strategy 1: look for <table> rows
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                text = " ".join(c.get_text(strip=True) for c in cells)
                # Try to extract TP/TKP/VL designation
                doc = _extract_doc_from_text(text, source, row)
                if doc:
                    docs.append(doc)

        # Strategy 2: look for <a> links with PDF hrefs
        if not docs:
            for link in soup.find_all("a", href=True):
                href = link["href"]
                text = link.get_text(strip=True)
                if not text or len(text) < 3:
                    continue
                doc = _extract_doc_from_text(text, source)
                if doc:
                    if href.endswith(".pdf") or "/download" in href:
                        full_url = href if href.startswith("http") else f"https://pjpk.rsd.cz{href}"
                        doc.url_ke_stazeni = full_url
                    docs.append(doc)

        # Strategy 3: look for structured <div> or <li> elements
        if not docs:
            for item in soup.find_all(["li", "div", "p"]):
                text = item.get_text(strip=True)
                doc = _extract_doc_from_text(text, source)
                if doc:
                    # Try to find a link inside
                    a = item.find("a", href=True)
                    if a and (a["href"].endswith(".pdf") or "/download" in a["href"]):
                        href = a["href"]
                        doc.url_ke_stazeni = href if href.startswith("http") else f"https://pjpk.rsd.cz{href}"
                    docs.append(doc)

    logger.info(f"[PJPK] {source.source_code}: scraped {len(docs)} documents from HTML")
    return docs


async def _scrape_rsd_page(source) -> list[FoundDocument]:
    """Scrape rsd.cz pages (similar structure to pjpk)."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return await _scrape_via_perplexity(source)

    docs = []
    async with httpx.AsyncClient(headers=BROWSER_HEADERS, timeout=30, follow_redirects=True) as client:
        resp = await client.get(source.url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True)
            href = link["href"]
            if not text or len(text) < 3:
                continue

            doc = _extract_doc_from_text(text, source)
            if doc:
                if href.endswith(".pdf") or ".doc" in href or "/download" in href:
                    full_url = href if href.startswith("http") else f"https://www.rsd.cz{href}"
                    doc.url_ke_stazeni = full_url
                docs.append(doc)

        # Also scan divs/paragraphs
        for el in soup.find_all(["li", "h3", "h4", "strong"]):
            text = el.get_text(strip=True)
            doc = _extract_doc_from_text(text, source)
            if doc and doc.oznaceni not in {d.oznaceni for d in docs}:
                docs.append(doc)

    logger.info(f"[RSD] {source.source_code}: scraped {len(docs)} documents from HTML")
    return docs


# ---------------------------------------------------------------------------
# Perplexity-based scrapers (for complex JS-rendered sites)
# ---------------------------------------------------------------------------

async def _scrape_via_perplexity(source) -> list[FoundDocument]:
    """Use Perplexity API to extract document lists from complex websites."""
    api_key = getattr(settings, "PPLX_API_KEY", None) or getattr(settings, "PERPLEXITY_API_KEY", None)
    if not api_key:
        logger.warning(f"[Perplexity] No API key, skipping {source.source_code}")
        return []

    # Build a source-specific prompt
    prompt = _build_perplexity_prompt(source)

    try:
        async with httpx.AsyncClient(timeout=PPLX_TIMEOUT) as client:
            resp = await client.post(
                PPLX_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": PPLX_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Jsi expert na české stavební normy a předpisy. "
                                "Odpovídej POUZE v JSON formátu. "
                                "Vrať pole objektů s klíči: oznaceni, nazev, datum_ucinnosti, oblast, url. "
                                "Pokud datum neznáš, nech null. URL jen pokud je volně dostupné ke stažení."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 4000,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Parse JSON from response
        docs = _parse_perplexity_response(content, source)
        logger.info(f"[Perplexity] {source.source_code}: found {len(docs)} documents")
        return docs

    except Exception as e:
        logger.error(f"[Perplexity] Error for {source.source_code}: {e}")
        return []


def _build_perplexity_prompt(source) -> str:
    """Build a Perplexity search prompt for a specific source."""
    prompts = {
        "sz": (
            f"site:spravazeleznic.cz Najdi KOMPLETNÍ seznam všech platných vnitřních předpisů Správy železnic. "
            f"Zahrň: TKP kapitoly 1-33, Předpisy řady S (S1-S6), VTP všechny verze, TNŽ normy, "
            f"Metodické pokyny M20/MP. Pro každý uveď: označení, název, datum účinnosti. "
            f"Vrať JSON pole."
        ),
        "mmr_pravo": (
            f"site:mmr.gov.cz Najdi kompletní přehled platných právních předpisů ve stavebním právu. "
            f"Zahrň zákony: 283/2021 Sb., 266/1994 Sb., 22/1997 Sb., 134/2016 Sb., "
            f"a všechny relevantní vyhlášky (146/2024, 268/2009, 499/2006 atd.). "
            f"Vrať JSON pole s označením, názvem, datem účinnosti."
        ),
        "mmr_csn": (
            f"site:mmr.gov.cz Najdi oficiální seznam ČSN norem závazných dle vyhlášky č. 146/2024 Sb. "
            f"(příloha 1). Seznam norem pro stavebnictví — ČSN 73 xxxx, ČSN EN xxxx. "
            f"Pro každou normu uveď: označení, název, datum vydání. Vrať JSON pole."
        ),
        "zakonyprolidi": (
            f"site:zakonyprolidi.cz Najdi aktuální znění zákonů relevantních pro stavebnictví: "
            f"283/2021 Sb., 266/1994 Sb., 134/2016 Sb., 22/1997 Sb., 13/1997 Sb. "
            f"Pro každý uveď: číslo, název, datum poslední novely. Vrať JSON pole."
        ),
        "agentura_cas": (
            f"site:agenturacas.gov.cz Najdi seznam ČSN norem dostupných zdarma (sponzorovaný přístup). "
            f"Zaměř se na stavební normy: ČSN 73 xxxx, ČSN EN 206, ČSN EN 1992, ČSN EN 13670 atd. "
            f"Pro každou: označení, název, datum vydání. Vrať JSON pole."
        ),
        "unmz": (
            f"site:unmz.cz Najdi nejnovější oznámení o vydání nebo zrušení norem pro stavebnictví. "
            f"Zaměř se na: ČSN EN 206, ČSN EN 1992, ČSN EN 1337, ČSN EN 1997, ČSN EN 13670, "
            f"ČSN 73 6200 a další eurokódy. Vrať JSON pole s označením, názvem, stavem (platná/zrušená)."
        ),
        "ckait": (
            f"site:ckait.cz Najdi standardy inženýrských služeb a doporučené postupy pro projektování. "
            f"Hledej PDF dokumenty, metodiky, profesní standardy ČKAIT. "
            f"Vrať JSON pole s označením, názvem, URL ke stažení."
        ),
    }
    return prompts.get(source.source_code, f"Najdi seznam normativních dokumentů na {source.url}")


def _parse_perplexity_response(content: str, source) -> list[FoundDocument]:
    """Parse Perplexity response text into FoundDocument list."""
    docs = []

    # Try to extract JSON from response
    json_match = re.search(r"\[[\s\S]*?\]", content)
    if not json_match:
        # Try to find individual JSON objects
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            content = f"[{json_match.group()}]"
        else:
            logger.warning(f"[Perplexity] No JSON found in response for {source.source_code}")
            return docs
    else:
        content = json_match.group()

    try:
        items = json.loads(content)
        if not isinstance(items, list):
            items = [items]
    except json.JSONDecodeError:
        logger.warning(f"[Perplexity] JSON parse error for {source.source_code}")
        return docs

    for item in items:
        if not isinstance(item, dict):
            continue
        oznaceni = item.get("oznaceni") or item.get("designation") or item.get("code") or ""
        if not oznaceni:
            continue

        doc_type = _detect_doc_type(oznaceni, source)
        docs.append(FoundDocument(
            oznaceni=oznaceni.strip(),
            nazev=(item.get("nazev") or item.get("name") or item.get("title") or "").strip(),
            doc_type=doc_type,
            datum_ucinnosti=item.get("datum_ucinnosti") or item.get("date") or item.get("datum"),
            oblast=item.get("oblast") or (source.oblasti[0] if source.oblasti else None),
            url_ke_stazeni=item.get("url") or item.get("url_ke_stazeni"),
            zdroje=[source.source_code],
            priorita=source.priority,
            is_freely_available=not source.is_signal_only,
        ))

    return docs


# ═══════════════════════════════════════════════════════════════════════════════
# GAP ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

async def _run_gap_analysis(all_found: dict[str, FoundDocument]) -> list[GapEntry]:
    """Compare found documents against NKB database."""
    store = NormStore()
    existing_norms = store.list_norms()

    # Build lookup by designation
    db_by_designation: dict[str, dict] = {}
    for norm in existing_norms:
        key = _normalize_oznaceni(norm.designation)
        db_by_designation[key] = {
            "norm_id": norm.norm_id,
            "designation": norm.designation,
            "version": norm.version,
            "valid_from": norm.valid_from,
            "is_active": norm.is_active,
        }

    entries = []
    for key, doc in all_found.items():
        db_match = db_by_designation.get(key)

        if db_match:
            # Document exists in DB — check if up to date
            source_date = doc.datum_ucinnosti or ""
            db_date = db_match.get("valid_from") or ""

            if source_date and db_date and source_date > str(db_date):
                status = DocStatus.ZASTARALY
            else:
                status = DocStatus.AKTUALNI

            entries.append(GapEntry(
                oznaceni=doc.oznaceni,
                nazev=doc.nazev,
                doc_type=doc.doc_type,
                status=status,
                datum_ucinnosti=doc.datum_ucinnosti,
                oblast=doc.oblast,
                zdroje=doc.zdroje,
                priorita=doc.priorita,
                url_ke_stazeni=doc.url_ke_stazeni,
                norm_id_in_db=db_match["norm_id"],
                version_in_db=db_match["version"],
                version_in_source=doc.datum_ucinnosti,
            ))
        else:
            # Document NOT in DB
            if not doc.is_freely_available:
                status = DocStatus.NEDOSTUPNY
            elif doc.doc_type == DocType.KALIBRACNI:
                status = DocStatus.KALIBRACNI
            else:
                status = DocStatus.CHYBI

            entries.append(GapEntry(
                oznaceni=doc.oznaceni,
                nazev=doc.nazev,
                doc_type=doc.doc_type,
                status=status,
                datum_ucinnosti=doc.datum_ucinnosti,
                oblast=doc.oblast,
                zdroje=doc.zdroje,
                priorita=doc.priorita,
                url_ke_stazeni=doc.url_ke_stazeni,
            ))

    # Sort: priority DESC, then status (chybí first)
    status_order = {DocStatus.CHYBI: 0, DocStatus.ZASTARALY: 1, DocStatus.AKTUALNI: 2, DocStatus.NEDOSTUPNY: 3, DocStatus.KALIBRACNI: 4}
    entries.sort(key=lambda e: (-e.priorita.value, status_order.get(e.status, 9)))

    return entries


def _build_source_summaries(entries: list[GapEntry]) -> list[SourceSummary]:
    """Build per-source summaries from gap entries."""
    # Collect all unique source codes
    source_codes: set[str] = set()
    for e in entries:
        source_codes.update(e.zdroje)

    summaries = []
    for code in sorted(source_codes):
        source = NORM_SOURCES.get(code)
        name = source.name if source else code
        relevant = [e for e in entries if code in e.zdroje]

        summaries.append(SourceSummary(
            source_code=code,
            source_name=name,
            total=len(relevant),
            aktualni=sum(1 for e in relevant if e.status == DocStatus.AKTUALNI),
            zastaraly=sum(1 for e in relevant if e.status == DocStatus.ZASTARALY),
            chybi=sum(1 for e in relevant if e.status == DocStatus.CHYBI),
            nedostupny=sum(1 for e in relevant if e.status == DocStatus.NEDOSTUPNY),
            kalibracni=sum(1 for e in relevant if e.status == DocStatus.KALIBRACNI),
            last_scraped=datetime.utcnow().isoformat(),
        ))

    return summaries


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

# Regex patterns for extracting document designations from text
_PATTERNS = [
    # TP xxx
    (re.compile(r"\b(TP\s*\d{1,4})\b", re.I), DocType.TP),
    # TKP xxx or TKP kapitola xx
    (re.compile(r"\b(TKP\s*(?:kap(?:itola)?\.?\s*)?\d{1,3})\b", re.I), DocType.TKP),
    # VTP xxx
    (re.compile(r"\b(VTP\s+[\w/]+\d{4})\b", re.I), DocType.VTP),
    # Předpis S1, S2, ...
    (re.compile(r"\b((?:Předpis\s+)?S\d(?:/\d)?)\b"), DocType.PREDPIS),
    # TNŽ xxx
    (re.compile(r"\b(TNŽ\s*\d+[\.\-]?\d*)\b", re.I), DocType.NORMA),
    # ČSN EN xxxx or ČSN 73 xxxx
    (re.compile(r"\b(ČSN\s+(?:EN\s+)?[\d\s]+(?:[\-\+]\w+)?)\b"), DocType.NORMA),
    # Zákon xxx/yyyy Sb.
    (re.compile(r"\b((?:zákon|vyhláška|nařízení)\s+(?:č\.\s*)?\d+/\d{4}\s*Sb\.?)\b", re.I), DocType.ZAKON),
    # Směrnice xxx
    (re.compile(r"\b((?:Směrnice|Metodický pokyn|MP)\s+[\w/\-]+)\b"), DocType.METODIKA),
    # XC4, B1, C4
    (re.compile(r"\b(XC\d+|B\d+|C\d+)\b"), DocType.DATOVY_PREDPIS),
    # VL x.x
    (re.compile(r"\b(VL\s*\d+(?:\.\d+)?)\b", re.I), DocType.TP),
    # PPK
    (re.compile(r"\b(PPK\s+[\w\-]+)\b", re.I), DocType.PREDPIS),
]


def _extract_doc_from_text(text: str, source, element=None) -> Optional[FoundDocument]:
    """Try to extract a document designation from a text string."""
    for pattern, doc_type in _PATTERNS:
        m = pattern.search(text)
        if m:
            oznaceni = m.group(1).strip()
            # Clean up the title (text after the designation)
            rest = text[m.end():].strip().lstrip("–—-:. ")
            nazev = rest[:200] if rest else ""

            return FoundDocument(
                oznaceni=oznaceni,
                nazev=nazev,
                doc_type=doc_type,
                zdroje=[source.source_code],
                priorita=source.priority,
                oblast=source.oblasti[0] if source.oblasti else None,
            )
    return None


def _detect_doc_type(oznaceni: str, source) -> DocType:
    """Detect document type from its designation."""
    oz = oznaceni.upper()
    if oz.startswith("TP ") or oz.startswith("TP\t"):
        return DocType.TP
    if "TKP" in oz:
        return DocType.TKP
    if "VTP" in oz:
        return DocType.VTP
    if "ČSN" in oz or "CSN" in oz:
        return DocType.NORMA
    if "ZÁKON" in oz or "VYHLÁŠKA" in oz or "/20" in oz:
        return DocType.ZAKON
    if oz.startswith("S1") or oz.startswith("S2") or oz.startswith("S3"):
        return DocType.PREDPIS
    if "TNŽ" in oz or "TNZ" in oz:
        return DocType.NORMA
    if "XC" in oz:
        return DocType.DATOVY_PREDPIS
    if "SMĚR" in oz or "MP " in oz or "METOD" in oz:
        return DocType.METODIKA
    # Fall back to source's default
    if source.doc_types:
        return source.doc_types[0]
    return DocType.NORMA


def _normalize_oznaceni(s: str) -> str:
    """Normalize designation for deduplication: lowercase, strip spaces."""
    return re.sub(r"\s+", " ", s.strip().lower())
