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
