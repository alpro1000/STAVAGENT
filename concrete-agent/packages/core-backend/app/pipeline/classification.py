"""
Layer 2: Document Classification — 4-tier deterministic-first system.

Tier 0: Learned patterns (cached from previous AI classifications)
Tier 1: Filename regex (instant, confidence=0.90)
Tier 2: Content keyword scoring (instant, confidence=0.40-0.85)
Tier 3: AI classification (Gemini Flash, 2-4s, confidence=0.50-0.80)
"""

import logging
import re
from typing import Optional

from .models import Classification, DocType, PDStage

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  TIER 1: FILENAME PATTERNS
# ═══════════════════════════════════════════════════════════

FILENAME_PATTERNS: dict[DocType, list[str]] = {
    # D.1.4 professions
    DocType.TZ_SILNOPROUD: [
        r"silnoproud", r"elektro(?!n)", r"FVE", r"[_\s]NN[_\s\.]",
        r"[_\s]VN[_\s\.]", r"el[\._\s]instal", r"D[\._]?1[\._]?4[\._]?\d*[\._]?(?:silno|elektro|el)",
    ],
    DocType.TZ_SLABOPROUD: [
        r"slaboproud", r"EPS", r"CCTV", r"STA", r"strukturovan",
    ],
    DocType.TZ_ZTI: [
        r"ZTI", r"vodovod", r"kanalizac", r"zdrav(?:otně)?[\s_]?techn",
    ],
    DocType.TZ_VZT: [
        r"VZT", r"ventilac", r"vzduchotech", r"klimatiz",
    ],
    DocType.TZ_UT: [
        r"[ÚU]T[_\s\.]", r"[úu]stř", r"top[eě]n[ií]", r"vytáp[eě]n[ií]",
        r"vytapen", r"otopn",
    ],
    DocType.TZ_PLYNOVOD: [
        r"plyn(?:ovod)?", r"HUP", r"TPG",
    ],
    DocType.TZ_MAR: [
        r"MaR", r"regulac", r"automatiz", r"BMS",
    ],
    # Other TZ
    DocType.TZ_STATIKA: [
        r"statik", r"konstruk(?:ce|ční)", r"nosn[áé]",
        r"D[\._]?1[\._]?2",
    ],
    DocType.TZ_PBRS: [
        r"PBŘ", r"PBŘS", r"PBS", r"požár", r"hasic", r"D[\._]?1[\._]?3",
    ],
    DocType.TZ_BETON: [r"beton(?:ování|áž|ový)"],
    DocType.TZ_MOST: [r"most(?:ní|u|ový)"],
    # A, B, C sections
    DocType.PRUVODNI_ZPRAVA: [r"průvodn[ií]", r"A[\._]\d"],
    DocType.SOUHRNNA_TZ: [r"souhrnn[áé]", r"B[\._]\d"],
    DocType.KOORDINACNI_SITUACE: [r"koordina[čc]n[ií]", r"celkov[áé]\s+situac"],
    # Budget/BOQ
    DocType.ROZPOCET_KOMPLET: [r"rozpo[čc]", r"rozpoc", r"budget", r"n[áa]klad"],
    DocType.SOUPIS_PRACI: [r"soupis", r"výkaz[\s_]výměr", r"polo[žz]k"],
    DocType.VYKAZ_VYMER: [r"výkaz", r"v[ýy]měr"],
    # Geology
    DocType.GEOLOGIE: [
        r"geolog", r"průzkum", r"IGP", r"GTP", r"vrty",
    ],
    DocType.HYDROGEOLOGIE: [r"hydrogeo"],
    DocType.GEODEZIE: [r"geodet", r"zaměřen[ií]", r"katastr"],
    # Graphics
    DocType.VYKRESY: [
        r"výkres", r"půdorys", r"řez", r"situac", r"pohled",
    ],
    # Other
    DocType.HARMONOGRAM: [r"harmonogram", r"schedule", r"gantt", r"časov"],
    DocType.ZADAVACI_DOKUMENTACE: [r"zadávac[ií]", r"podmínky\s+zadání"],
}

# Section detection patterns
SECTION_PATTERNS: dict[str, list[str]] = {
    "A": [r"\bA[\._]\d", r"průvodn[ií]"],
    "B": [r"\bB[\._]\d", r"souhrnn[áé]"],
    "C": [r"\bC[\._]\d", r"situační"],
    "D.1.1": [r"D[\._]?1[\._]?1"],
    "D.1.2": [r"D[\._]?1[\._]?2", r"statik", r"konstruk"],
    "D.1.3": [r"D[\._]?1[\._]?3", r"požár", r"PBŘ"],
    "D.1.4": [r"D[\._]?1[\._]?4"],
    "D.2": [r"D[\._]?2"],
    "E": [r"\bE[\._]\d", r"dokladov"],
}

# PD stage detection
STAGE_PATTERNS: dict[PDStage, list[str]] = {
    PDStage.DUR: [r"\bDÚR\b", r"územní\s+rozhodnutí"],
    PDStage.DSP: [r"\bDSP\b", r"stavební\s+povolení"],
    PDStage.DPS: [r"\bDPS\b", r"provádění\s+stavby"],
    PDStage.DVZ: [r"\bDVZ\b", r"výběr\s+zhotovitele"],
    PDStage.DSPS: [r"\bDSPS\b", r"skutečné\s+provedení"],
    PDStage.PDPS: [r"\bPDPS\b"],
}


# ═══════════════════════════════════════════════════════════
#  TIER 2: CONTENT KEYWORD CLUSTERS
# ═══════════════════════════════════════════════════════════

CONTENT_CLUSTERS: dict[DocType, list[str]] = {
    DocType.TZ_SILNOPROUD: [
        "silnoproud", "rozvaděč", "střídač", "inverter", "FVE",
        "fotovoltai", "kabel", "CYKY", "CXKH", "jistič",
        "proudový chránič", "přepěťová ochrana", "hromosvod",
        "uzemňovací", "elektroinstalac", "kWp", "kVA",
    ],
    DocType.TZ_SLABOPROUD: [
        "slaboproud", "EPS", "CCTV", "kamerový", "detektor",
        "ústředna", "senzor", "přístupový", "docházkový",
    ],
    DocType.TZ_ZTI: [
        "vnitřní vodovod", "kanalizace", "splaškové", "dešťové",
        "vodoměr", "zásobník", "DN", "průtok", "potrubí",
        "zařizovací předmět", "ČSN 73 6760", "ČSN EN 806",
    ],
    DocType.TZ_VZT: [
        "vzduchotech", "větrání", "rekuperace", "VZT",
        "přívod vzduchu", "odvod vzduchu", "m³/h",
    ],
    DocType.TZ_UT: [
        "ústřední vytápění", "otopná soustava", "kotel",
        "tepelné čerpadlo", "podlahové vytápění", "radiátor",
        "komín", "ČSN EN 12831",
    ],
    DocType.TZ_STATIKA: [
        "zatížení", "únosnost", "průhyb", "deformace",
        "výztuž", "B500", "předpjat", "Eurocode",
    ],
    DocType.TZ_PBRS: [
        "požární úsek", "SPB", "úniková cesta", "hasicí",
        "EPS", "SHZ", "ZOKT", "požární odolnost", "REI",
    ],
    DocType.GEOLOGIE: [
        "vrty", "sonda", "HPV", "hladina podzemní vody",
        "navážka", "jíl", "hlína", "štěrk", "skála",
        "ČSN 73 1001", "Eurocode 7", "radon", "Rdt",
    ],
    DocType.ROZPOCET_KOMPLET: [
        "celkem", "bez DPH", "s DPH", "rekapitulace",
        "HSV", "PSV", "montáž", "materiál", "přesun hmot",
    ],
    DocType.SOUPIS_PRACI: [
        "položk", "kód", "množství", "měrná jednotka",
        "jednotková cena", "celková cena",
    ],
    DocType.HARMONOGRAM: [
        "milník", "etapa", "fáze", "začátek", "konec",
        "trvání", "kalendářní", "pracovní dny",
    ],
    DocType.ZADAVACI_DOKUMENTACE: [
        "zadavatel", "uchazeč", "nabídka", "kvalifikace",
        "jistota", "ZZVZ", "zákon 134/2016", "hodnotící kritéri",
    ],
}


# ═══════════════════════════════════════════════════════════
#  MAIN CLASSIFICATION FUNCTION
# ═══════════════════════════════════════════════════════════

def classify_document(
    filename: str,
    text: str,
    text_first_5k: Optional[str] = None,
) -> Classification:
    """
    4-tier classification. Returns best match with confidence.

    Tier 0: Learned patterns (TODO: implement cache lookup)
    Tier 1: Filename regex → confidence 0.90
    Tier 2: Content keywords → confidence 0.40-0.85
    Tier 3: AI → deferred (called separately if needed)
    """
    if text_first_5k is None:
        text_first_5k = text[:5000]

    # ── Tier 1: Filename ──
    tier1 = _classify_by_filename(filename)
    if tier1 and tier1.confidence >= 0.90:
        # Enrich with section + stage from text
        tier1.section = _detect_section(filename, text_first_5k)
        tier1.stage = _detect_stage(text_first_5k)
        return tier1

    # ── Tier 2: Content keywords ──
    tier2 = _classify_by_content(text_first_5k)

    # Combine: if both have results, prefer higher confidence
    if tier1 and tier2:
        if tier1.confidence >= tier2.confidence:
            best = tier1
        else:
            best = tier2
    elif tier1:
        best = tier1
    elif tier2:
        best = tier2
    else:
        best = Classification(
            doc_type=DocType.OSTATNI,
            confidence=0.1,
            method="none",
        )

    best.section = _detect_section(filename, text_first_5k)
    best.stage = _detect_stage(text_first_5k)
    return best


def _classify_by_filename(filename: str) -> Optional[Classification]:
    """Tier 1: Match filename against known patterns."""
    fn_lower = filename.lower()
    # Remove extension for cleaner matching
    fn_stem = fn_lower.rsplit(".", 1)[0] if "." in fn_lower else fn_lower

    best_type: Optional[DocType] = None
    best_score = 0

    for doc_type, patterns in FILENAME_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, fn_stem, re.IGNORECASE):
                score = len(pattern)  # longer pattern = more specific
                if score > best_score:
                    best_score = score
                    best_type = doc_type

    if best_type:
        return Classification(
            doc_type=best_type,
            confidence=0.90,
            method="tier_1",
            detected_keywords=[best_type.value],
        )
    return None


def _classify_by_content(text: str) -> Optional[Classification]:
    """Tier 2: Score text against keyword clusters."""
    text_lower = text.lower()
    scores: dict[DocType, int] = {}

    for doc_type, keywords in CONTENT_CLUSTERS.items():
        count = sum(1 for kw in keywords if kw.lower() in text_lower)
        if count > 0:
            scores[doc_type] = count

    if not scores:
        return None

    # Best match
    best_type = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_count = scores[best_type]
    total_keywords = len(CONTENT_CLUSTERS[best_type])

    # Confidence: ratio of matched keywords, capped at 0.85
    confidence = min(0.85, 0.40 + (best_count / total_keywords) * 0.45)

    # Collect matched keywords for debugging
    matched = [
        kw for kw in CONTENT_CLUSTERS[best_type]
        if kw.lower() in text_lower
    ]

    return Classification(
        doc_type=best_type,
        confidence=round(confidence, 2),
        method="tier_2",
        detected_keywords=matched[:10],
    )


def _detect_section(filename: str, text: str) -> Optional[str]:
    """Detect document section (A, B, C, D.1.x, E)."""
    combined = filename + " " + text[:2000]
    for section, patterns in SECTION_PATTERNS.items():
        for p in patterns:
            if re.search(p, combined, re.IGNORECASE):
                return section
    return None


def _detect_stage(text: str) -> PDStage:
    """Detect PD stage (DÚR, DSP, DPS, etc.)."""
    text_upper = text[:3000].upper()
    for stage, patterns in STAGE_PATTERNS.items():
        for p in patterns:
            if re.search(p, text_upper):
                return stage
    return PDStage.UNKNOWN
