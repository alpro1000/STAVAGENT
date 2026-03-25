"""
Document Classifier — 3-tier classification for Czech construction documents.

Tier 1: Filename patterns (fast, 0.9 confidence)
Tier 2: Content keywords (medium, 0.4-0.85 confidence)
Tier 3: AI fallback (slow, 0.5-0.8 confidence) — TODO

Author: STAVAGENT Team
Version: 1.0.0
"""

import logging
import unicodedata
from typing import Dict, List

from app.models.passport_schema import DocCategory, ClassificationInfo

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
    Classify a construction document using 3-tier approach.

    Args:
        filename: Original filename
        text: Extracted document text (optional, used for tier 2)

    Returns:
        ClassificationInfo with category, confidence, method
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

    # Tier 3: AI classification — TODO: integrate with LLM client
    # For now, return best guess from tier 1/2
    logger.info(f"Classification uncertain for '{filename}': "
                 f"{result.category.value} (confidence={result.confidence:.2f})")
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
