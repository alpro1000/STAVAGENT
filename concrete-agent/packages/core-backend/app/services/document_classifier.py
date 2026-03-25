"""
Document Classifier — 3-tier classification for Czech construction documents.

Tier 1: Filename patterns (fast, 0.9 confidence)
Tier 2: Content keywords (medium, 0.4-0.85 confidence)
Tier 3: AI fallback (LLM, 0.5-0.8 confidence)

Author: STAVAGENT Team
Version: 1.1.0
"""

import logging
import unicodedata
import json
from typing import Dict, List, Optional

import re
from app.models.passport_schema import DocCategory, DocSubType, ClassificationInfo

logger = logging.getLogger(__name__)


# ── Filename patterns ─────────────────────────────────────────────────────

FILENAME_PATTERNS: Dict[DocCategory, List[str]] = {
    DocCategory.TZ: [
        "technicka_zprava", "tech_zprava", "tz_", "technická",
        "technical_report", "tech_report", "pruvodní", "pruvodna",
        "souhrnna_zprava", "souhrnná",
    ],
    DocCategory.RO: [
        "rozpocet", "rozpočet", "vykaz_vymer", "výkaz", "výměr",
        "soupis_praci", "soupis", "bill_of_quantities", "boq",
        "polozkov", "položkov", "cenov", "cenik", "ceník",
    ],
    DocCategory.PD: [
        "podminky", "podmínky", "zadavaci", "zadávací",
        "kvalifikace", "kvalifikační", "tender",
    ],
    DocCategory.VY: [
        "vykres", "výkres", "drawing", "plan_", "schema",
        "situace", "rez_", "řez", "pohled", "pudorys", "půdorys",
    ],
    DocCategory.SM: [
        "smlouva", "navrh_smlouvy", "návrh", "contract",
        "sod_", "smluvni", "smluvní", "objednavka",
    ],
    DocCategory.HA: [
        "harmonogram", "schedule", "casovy_plan", "časový",
        "gantt", "timeline", "hg_",
    ],
    DocCategory.GE: [
        "geolog", "průzkum", "pruzkum", "geotech",
        "ig_zprava", "geological", "hydrogeol",
    ],
    DocCategory.ZP: [
        "bozp", "bezpecnost", "bezpečnost", "eia",
        "environment", "posouzeni_vlivu", "safety",
    ],
    DocCategory.TI: [
        "titulni", "titulní", "obsah", "toc",
        "title_page", "cover",
    ],
}


CONTENT_KEYWORDS: Dict[DocCategory, List[str]] = {
    DocCategory.TZ: [
        "nosná konstrukce", "beton", "výztuž", "armování",
        "zatížení", "dimenzování", "základy", "piloty",
        "rozpětí", "výška", "délka mostu", "šířka",
        "třída betonu", "konstrukční řešení", "statický",
        "betonáž", "bednění", "mostovka", "opěra", "pilíř",
        "technická zpráva", "popis stavby", "stavební objekt",
    ],
    DocCategory.RO: [
        "položka", "jednotka", "množství", "cena",
        "kč", "czk", "měrná jednotka", "výkaz výměr",
        "m2", "m3", "bm", "ks", "t", "kg",
        "hsv", "psv", "celkem", "rekapitulace",
        "soupis prací", "rozpočet",
    ],
    DocCategory.PD: [
        "lhůta", "termín podání", "kvalifikační předpoklady",
        "zadavatel", "uchazeč", "nabídka", "hodnotící kritéria",
        "jistota", "bankovní záruka", "způsobilost",
        "elektronický nástroj", "obálka", "podání nabídky",
    ],
    DocCategory.HA: [
        "etapa", "fáze", "milník", "zahájení", "dokončení",
        "předání", "kolaudace", "měsíc", "týden",
        "kritická cesta", "závislost", "harmonogram",
    ],
    DocCategory.GE: [
        "geolog", "vrty", "hladina podzemní vody", "únosnost",
        "základová spára", "zemina", "skalní podloží",
        "radon", "propustnost",
    ],
    DocCategory.SM: [
        "smluvní strany", "objednatel", "zhotovitel",
        "předmět smlouvy", "cena díla", "záruční doba",
        "smluvní pokuta", "odstoupení",
    ],
}


def _normalize(text: str) -> str:
    """Normalize text for matching: lowercase, strip diacritics, collapse whitespace."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_chars = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return ascii_chars.lower().replace("-", "_").replace(" ", "_")


def classify_document(filename: str, text: str = "") -> ClassificationInfo:
    """
    Classify a construction document using tiers 1-2 (sync, no LLM).

    For full 3-tier classification including AI fallback, use
    classify_document_async() instead.
    """
    # Tier 1: Filename patterns
    result = _classify_by_filename(filename)
    if result.confidence >= 0.8:
        logger.info(f"Classified '{filename}' as {result.category.value} "
                     f"(filename, confidence={result.confidence:.2f})")
        return result

    # Tier 2: Content keywords
    if text:
        keyword_result = _classify_by_keywords(text)
        if keyword_result.confidence > result.confidence:
            result = keyword_result

    if result.confidence >= 0.5:
        logger.info(f"Classified '{filename}' as {result.category.value} "
                     f"({result.method}, confidence={result.confidence:.2f})")
        return result

    logger.info(f"Classification uncertain for '{filename}': "
                 f"{result.category.value} (confidence={result.confidence:.2f})")
    return result


AI_CLASSIFY_PROMPT = """Klasifikuj tento dokument do JEDNÉ z těchto kategorií:

TZ — Technická zpráva (konstrukční řešení, materiály, statika)
RO — Rozpočet / Výkaz výměr (položky, ceny, množství)
PD — Podmínky / Zadávací dokumentace (tender, kvalifikace, lhůty)
VY — Výkresy (výkresová dokumentace, situace, řezy)
SM — Smlouva / Návrh (smluvní strany, předmět díla)
HA — Harmonogram (etapy, milníky, termíny)
GE — Geologický průzkum (vrty, zemina, hladina vody)
ZP — BOZP / Životní prostředí (bezpečnost, EIA)
TI — Titulní list / Obsah
OT — Ostatní

Název souboru: {filename}

ÚSEK DOKUMENTU (prvních 3000 znaků):
{text_snippet}

VRAŤ POUZE VALIDNÍ JSON:
{{"category": "XX", "reason": "krátké odůvodnění"}}"""


async def classify_document_async(
    filename: str,
    text: str = "",
    llm_call=None,
) -> ClassificationInfo:
    """
    Full 3-tier classification with AI fallback.

    Args:
        filename: Original filename
        text: Extracted document text
        llm_call: Async callable (prompt) -> dict|None from PassportEnricher._call_llm
    """
    # Try tiers 1-2 first
    result = classify_document(filename, text)
    if result.confidence >= 0.5:
        return result

    # Tier 3: AI classification
    if llm_call and text:
        try:
            snippet = text[:3000]
            prompt = AI_CLASSIFY_PROMPT.format(filename=filename, text_snippet=snippet)
            ai_result = await llm_call(prompt)

            if ai_result and isinstance(ai_result, dict):
                raw_cat = ai_result.get("category", "").upper().strip()
                # Validate category
                valid_cats = {c.value for c in DocCategory}
                if raw_cat in valid_cats:
                    ai_classification = ClassificationInfo(
                        category=DocCategory(raw_cat),
                        confidence=0.7,
                        method="ai",
                        detected_keywords=[ai_result.get("reason", "")],
                    )
                    logger.info(
                        f"AI classified '{filename}' as {raw_cat} "
                        f"(reason: {ai_result.get('reason', '?')})"
                    )
                    return ai_classification
        except Exception as e:
            logger.warning(f"AI classification failed for '{filename}': {e}")

    return result


def _classify_by_filename(filename: str) -> ClassificationInfo:
    """Tier 1: Check filename against known patterns."""
    fname_norm = _normalize(filename)

    for category, patterns in FILENAME_PATTERNS.items():
        for pattern in patterns:
            pattern_norm = _normalize(pattern)
            if pattern_norm in fname_norm:
                return ClassificationInfo(
                    category=category,
                    confidence=0.9,
                    method="filename",
                    detected_keywords=[pattern],
                )

    return ClassificationInfo(
        category=DocCategory.OT,
        confidence=0.1,
        method="filename",
    )


def _classify_by_keywords(text: str) -> ClassificationInfo:
    """Tier 2: Scan text for category-specific keywords."""
    if not text:
        return ClassificationInfo(category=DocCategory.OT, confidence=0.1, method="keywords")

    text_lower = text[:15000].lower()
    scores: Dict[DocCategory, float] = {}

    for category, keywords in CONTENT_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw.lower() in text_lower)
        density = count / len(keywords) if keywords else 0
        scores[category] = density

    if not scores:
        return ClassificationInfo(category=DocCategory.OT, confidence=0.2, method="keywords")

    best_category = max(scores, key=lambda k: scores[k])
    best_score = scores[best_category]

    # Map density to confidence: 0.4 base + up to 0.45 from density
    confidence = min(0.85, 0.4 + best_score * 0.6)

    matched_keywords = [
        kw for kw in CONTENT_KEYWORDS.get(best_category, [])
        if kw.lower() in text_lower
    ]

    return ClassificationInfo(
        category=best_category,
        confidence=round(confidence, 2),
        method="keywords",
        detected_keywords=matched_keywords[:10],
    )


# =============================================================================
# V3: SUB-TYPE DETECTION + SO CODE EXTRACTION
# =============================================================================

# SO code from filename: "202_01_TZ.pdf" → "SO 202", "SO_202_TZ.pdf" → "SO 202"
SO_FILENAME_PATTERNS = [
    re.compile(r"(\d{3})_\d{2}_(.+)\.(?:pdf|docx?)", re.IGNORECASE),
    re.compile(r"SO[_ ]?(\d{3})[_ ](.+)\.(?:pdf|docx?)", re.IGNORECASE),
]

# File type from filename part
FILE_TYPE_KEYWORDS: Dict[str, DocSubType] = {
    "technicka_zprava": DocSubType.TZ_D,
    "technická_zpráva": DocSubType.TZ_D,
    "tz": DocSubType.TZ_D,
    "situace": DocSubType.VY_SIT,
    "podelny_rez": DocSubType.VY_POD,
    "podélný_řez": DocSubType.VY_POD,
    "pricny_rez": DocSubType.VY_PRI,
    "příčný_řez": DocSubType.VY_PRI,
    "pricne_rezy": DocSubType.VY_PRI,
    "vytycovaci": DocSubType.VY_VYT,
    "vytyčovací": DocSubType.VY_VYT,
    "tvar_oper": DocSubType.VY_OPE,
    "tvar_nosne": DocSubType.VY_NK,
    "nosna_konstrukce": DocSubType.VY_NK,
    "nosné_konstrukce": DocSubType.VY_NK,
    "prechodov": DocSubType.VY_PRE,
    "přechodov": DocSubType.VY_PRE,
    "vyztu": DocSubType.VY_ARM,
    "výztu": DocSubType.VY_ARM,
    "vybaveni": DocSubType.VY_VYB,
    "vybavení": DocSubType.VY_VYB,
    "gtp": DocSubType.GE_GTP,
    "geotechnick": DocSubType.GE_GTP,
    "igp": DocSubType.GE_IGP,
    "inzenyrsko": DocSubType.GE_IGP,
    "rozpocet": DocSubType.RO_SOD,
    "soupis": DocSubType.RO_SOD,
    "rekapitulace": DocSubType.RO_REC,
    "zadavaci": DocSubType.PD_ZD,
    "zadávací": DocSubType.PD_ZD,
    "kvalifikac": DocSubType.PD_KP,
    "harmonogram": DocSubType.HA_GEN,
    "smlouva": DocSubType.SM_SOD,
}

# Souhrnná TZ detection keywords in filename
SOUHRNNA_KEYWORDS = ["souhrnna", "souhrnná", "summary", "celkov"]

# Merge priority by sub-type
SUB_TYPE_PRIORITY: Dict[DocSubType, int] = {
    DocSubType.TZ_D: 1,
    DocSubType.VY_SIT: 2, DocSubType.VY_POD: 2, DocSubType.VY_PRI: 2,
    DocSubType.VY_VYT: 2, DocSubType.VY_OPE: 2, DocSubType.VY_NK: 2,
    DocSubType.VY_PRE: 2, DocSubType.VY_ARM: 2, DocSubType.VY_VYB: 2,
    DocSubType.VY_GEN: 2,
    DocSubType.GE_GTP: 3, DocSubType.GE_IGP: 3,
    DocSubType.TZ_S: 4,
    DocSubType.RO_SOD: 5, DocSubType.RO_REC: 5,
    DocSubType.PD_ZD: 6, DocSubType.PD_KP: 6,
    DocSubType.HA_GEN: 7,
    DocSubType.SM_SOD: 8,
    DocSubType.OT_GEN: 99,
}


def detect_sub_type(filename: str, category: DocCategory) -> Optional[DocSubType]:
    """Detect fine-grained sub-type from filename."""
    fname_lower = filename.lower()
    fname_norm = _normalize(filename)

    # Check for souhrnná TZ
    if category == DocCategory.TZ:
        if any(kw in fname_norm for kw in SOUHRNNA_KEYWORDS):
            return DocSubType.TZ_S

    # Match against FILE_TYPE_KEYWORDS
    for keyword, sub_type in FILE_TYPE_KEYWORDS.items():
        if _normalize(keyword) in fname_norm:
            return sub_type

    # Default sub-types by category
    category_defaults: Dict[DocCategory, DocSubType] = {
        DocCategory.TZ: DocSubType.TZ_D,
        DocCategory.VY: DocSubType.VY_GEN,
        DocCategory.GE: DocSubType.GE_GTP,
        DocCategory.RO: DocSubType.RO_SOD,
        DocCategory.PD: DocSubType.PD_ZD,
        DocCategory.HA: DocSubType.HA_GEN,
        DocCategory.SM: DocSubType.SM_SOD,
        DocCategory.OT: DocSubType.OT_GEN,
    }
    return category_defaults.get(category)


def extract_so_code(filename: str) -> Optional[str]:
    """Extract SO code from filename. Returns 'SO 202' or None."""
    for pattern in SO_FILENAME_PATTERNS:
        m = pattern.search(filename)
        if m:
            return f"SO {m.group(1)}"
    return None


def enrich_classification(info: ClassificationInfo, filename: str) -> ClassificationInfo:
    """
    Enrich a ClassificationInfo with sub-type, SO code, and priority.
    Call this after classify_document() or classify_document_async().
    """
    info.sub_type = detect_sub_type(filename, info.category)
    info.so_code = extract_so_code(filename)
    info.priority = SUB_TYPE_PRIORITY.get(info.sub_type, 99)
    return info
