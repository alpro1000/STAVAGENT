"""
Code System Detector — auto-detect OTSKP / ÚRS / RTS from position codes.

Detection pipeline (strict order, first match wins):
1. OTSKP DB lookup (confidence=1.0) — deterministic, never overridden by AI
2. Regex structure analysis (confidence=0.95)
3. Letter prefix detection for ÚRS (confidence=0.90)
4. Price source hint from Excel metadata (confidence=0.85)
5. Fallback to UNKNOWN if nothing matches

Uses the OTSKP catalog (17,904 items) loaded from XML via OTSKPCatalogService
or directly from the knowledge_base XML file.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

import logging
import re
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree

from app.models.item_schemas import (
    CodeDetectionResult,
    CodeSystem,
    HierarchyLevel,
)

logger = logging.getLogger(__name__)

# ── OTSKP catalog (lazy-loaded singleton) ────────────────────────────────────

_otskp_cache: dict[str, dict] | None = None

OTSKP_XML_PATH = Path(__file__).parent.parent / "knowledge_base" / "B1_otkskp_codes" / "2025_03_otskp.xml"


def _load_otskp_catalog() -> dict[str, dict]:
    """Load OTSKP catalog from XML. Returns {code: {nazev, mj, cena}}."""
    global _otskp_cache
    if _otskp_cache is not None:
        return _otskp_cache

    _otskp_cache = {}
    if not OTSKP_XML_PATH.exists():
        logger.warning(f"OTSKP XML not found at {OTSKP_XML_PATH}")
        return _otskp_cache

    try:
        tree = ElementTree.parse(str(OTSKP_XML_PATH))
        root = tree.getroot()

        # Navigate: XC4 → CenoveSoustavy → Polozky → Polozka
        for cs in root.iter():
            if cs.tag in ("CenoveSoustavy", "CenovaSoustava"):
                polozky = cs.find("Polozky")
                if polozky is None:
                    continue
                for pol in polozky.findall("Polozka"):
                    code_el = pol.find("znacka")
                    nazev_el = pol.find("nazev")
                    mj_el = pol.find("MJ")
                    cena_el = pol.find("jedn_cena")
                    spec_el = pol.find("technicka_specifikace")

                    if code_el is not None and code_el.text:
                        code = code_el.text.strip()
                        _otskp_cache[code] = {
                            "nazev": nazev_el.text.strip() if nazev_el is not None and nazev_el.text else "",
                            "mj": mj_el.text.strip() if mj_el is not None and mj_el.text else "",
                            "cena": float(cena_el.text.strip()) if cena_el is not None and cena_el.text else 0.0,
                            "spec": spec_el.text.strip() if spec_el is not None and spec_el.text else "",
                        }

        logger.info(f"[CodeDetector] Loaded {len(_otskp_cache)} OTSKP items from XML")
    except Exception as e:
        logger.error(f"[CodeDetector] Error loading OTSKP XML: {e}")

    return _otskp_cache


def lookup_otskp(code: str) -> dict | None:
    """Look up a code in the OTSKP catalog. Returns item dict or None."""
    catalog = _load_otskp_catalog()
    normalized = _normalize_code(code)
    return catalog.get(normalized) or catalog.get(code)


# ── Code normalization ───────────────────────────────────────────────────────

def _normalize_code(code: str) -> str:
    """Normalize code: strip spaces, dashes, keep only alphanumeric."""
    return re.sub(r"[\s\-\.]+", "", code).strip()


def _extract_numeric(code: str) -> str:
    """Extract only digits from code."""
    return re.sub(r"[^\d]", "", code)


def _extract_letter_prefix(code: str) -> str | None:
    """Extract leading letter prefix (D, M, P, etc.) if present."""
    m = re.match(r"^([A-Za-z])\d", code.strip())
    return m.group(1).upper() if m else None


# ── OTSKP hierarchy ─────────────────────────────────────────────────────────

# OTSKP section names (first 1-3 digits)
OTSKP_SECTIONS = {
    "1": "Zemní práce",
    "2": "Zakládání",
    "3": "Svislé a kompletní konstrukce",
    "4": "Vodorovné konstrukce",
    "5": "Komunikace",
    "6": "Úpravy povrchů, podlahy a osazování",
    "7": "Izolace a geosyntézy",
    "8": "Trubní vedení a kanalizace",
    "9": "Ostatní konstrukce a práce",
}


def _build_otskp_hierarchy(code: str, otskp_item: dict | None) -> HierarchyLevel:
    """Build hierarchy from OTSKP code structure."""
    digits = _extract_numeric(code)
    h = HierarchyLevel()

    if len(digits) >= 1:
        section = digits[0]
        h.skupina_code = section
        h.skupina_name = OTSKP_SECTIONS.get(section)

    if len(digits) >= 3:
        h.oddil_code = digits[:3]

    return h


# ── Detection pipeline ──────────────────────────────────────────────────────

def detect_code_system(
    code: str,
    popis: str = "",
    price_source: str = "",
) -> CodeDetectionResult:
    """
    Detect which code system (OTSKP/ÚRS/RTS) a position code belongs to.

    Pipeline (strict order):
    1. OTSKP DB lookup → confidence=1.0 (deterministic, NEVER overridden)
    2. Regex structure → confidence=0.95
    3. Letter prefix → confidence=0.90
    4. Price source hint → confidence=0.85
    5. Fallback → UNKNOWN
    """
    if not code or not code.strip():
        return CodeDetectionResult(
            code_system=CodeSystem.UNKNOWN,
            code_normalized="",
            code_raw=code or "",
            confidence=0.0,
            detection_method="empty_code",
        )

    raw = code.strip()
    normalized = _normalize_code(raw)
    digits = _extract_numeric(raw)

    # ── Step 1: OTSKP DB lookup (confidence=1.0) ──
    otskp_item = lookup_otskp(normalized)
    if otskp_item:
        hierarchy = _build_otskp_hierarchy(normalized, otskp_item)
        return CodeDetectionResult(
            code_system=CodeSystem.OTSKP,
            code_normalized=normalized,
            code_raw=raw,
            confidence=1.0,
            detection_method="otskp_db",
            hierarchy=hierarchy,
            otskp_match=otskp_item,
        )

    # ── Step 2: Regex structure analysis (confidence=0.95) ──
    # OTSKP: exactly 6-9 digits, no letters
    if re.match(r"^\d{6,9}$", normalized):
        # Could be OTSKP (not found in DB — maybe custom or obsolete)
        # or ÚRS (same digit-only format)
        # Check first digit for OTSKP section validity
        if digits[0] in OTSKP_SECTIONS:
            hierarchy = _build_otskp_hierarchy(normalized, None)
            return CodeDetectionResult(
                code_system=CodeSystem.OTSKP,
                code_normalized=normalized,
                code_raw=raw,
                confidence=0.85,  # Lower than DB match since not confirmed
                detection_method="regex_structure",
                hierarchy=hierarchy,
            )

    # ── Step 3: Letter prefix detection (confidence=0.90) ──
    prefix = _extract_letter_prefix(raw)
    if prefix:
        # D=dodávka, M=montáž, P=přesun — typical ÚRS prefixes
        if prefix in ("D", "M", "P", "K", "H", "R"):
            return CodeDetectionResult(
                code_system=CodeSystem.URS,
                code_normalized=digits,
                code_raw=raw,
                confidence=0.90,
                detection_method="prefix_letter",
            )

    # ── Step 4: Price source hint (confidence=0.85) ──
    if price_source:
        ps = price_source.upper()
        if "URS" in ps or "ÚRS" in ps:
            return CodeDetectionResult(
                code_system=CodeSystem.URS,
                code_normalized=normalized,
                code_raw=raw,
                confidence=0.85,
                detection_method="price_source_hint",
            )
        if "RTS" in ps:
            return CodeDetectionResult(
                code_system=CodeSystem.RTS,
                code_normalized=normalized,
                code_raw=raw,
                confidence=0.85,
                detection_method="price_source_hint",
            )
        if "OTSKP" in ps or "CS " in ps:
            return CodeDetectionResult(
                code_system=CodeSystem.OTSKP,
                code_normalized=normalized,
                code_raw=raw,
                confidence=0.85,
                detection_method="price_source_hint",
            )

    # ── Step 5: Short numeric — likely RTS ──
    if re.match(r"^\d{4,5}$", normalized):
        return CodeDetectionResult(
            code_system=CodeSystem.RTS,
            code_normalized=normalized,
            code_raw=raw,
            confidence=0.70,
            detection_method="short_numeric_rts",
        )

    # ── Fallback: UNKNOWN ──
    return CodeDetectionResult(
        code_system=CodeSystem.UNKNOWN,
        code_normalized=normalized,
        code_raw=raw,
        confidence=0.0,
        detection_method="no_match",
    )


def detect_batch(items: list[dict]) -> list[CodeDetectionResult]:
    """Detect code systems for a batch of items."""
    return [
        detect_code_system(
            code=item.get("kod", ""),
            popis=item.get("popis", ""),
            price_source=item.get("price_source", ""),
        )
        for item in items
    ]
