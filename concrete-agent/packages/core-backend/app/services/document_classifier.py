"""
Document Classifier — 3-tier classification for Czech construction documents.

Tier 1: Filename patterns + structural ID regex (fast, 0.9 confidence)
Tier 2: Content keywords + construction type markers (medium, 0.4-0.85 confidence)
Tier 3: AI fallback / Perplexity verification (LLM, 0.5-0.8 confidence)

Author: STAVAGENT Team
Version: 1.2.0 (v3.1.1)
"""

import logging
import unicodedata
import json
from typing import Any, Dict, List, Optional, Tuple

import re
from app.models.passport_schema import DocCategory, DocSubType, ClassificationInfo

logger = logging.getLogger(__name__)


# =============================================================================
# v3.1.1: FLEXIBLE SECTION ID PATTERNS
# =============================================================================
# Not just "SO" — detect ANY structural identifier in Czech PD

SECTION_ID_PATTERNS = [
    # Dopravní stavby (ŘSD, SŽDC): SO 202, SO 101.1, SO 380.12
    re.compile(r"SO\s*(\d{3}(?:\.\d+)?)"),
    # Pozemní stavby (vyhláška 499/2006 Sb.): D.1.1, D.1.4, D.2.1
    re.compile(r"D\.(\d+\.\d+)"),
    # Části PD: A.1, B.2, C.3, E.1, F.1 (but NOT D.x.x which is handled above)
    re.compile(r"([A-CE-F]\.\d+)"),
    # Průmyslové stavby: PS 01, PS 02
    re.compile(r"PS\s*(\d{2,3})"),
    # Inženýrské objekty: IO 01, IO 02
    re.compile(r"IO\s*(\d{2,3})"),
]


# =============================================================================
# v3.1.1: CONSTRUCTION TYPE MARKERS
# =============================================================================

CONSTRUCTION_TYPE_MARKERS: Dict[str, List[str]] = {
    "dopravní": [
        "pozemní komunikac", "silnice I/", "silnice II/",
        "dálnice", "ŘSD", "SŽDC", "železnič",
        "křižovatk", "MÚK", "mimoúrovňov",
    ],
    "mostní": [
        "nosná konstrukce", "opěra", "pilíř", "rozpětí",
        "mostovk", "ČSN 73 6200", "předpjat",
    ],
    "pozemní_bytová": [
        "bytový dům", "bytová jednotk", "obytný",
        "D.1.1", "požárně bezpečnost",
    ],
    "pozemní_občanská": [
        "občanská vybavenost", "administrativní",
        "školské zařízení", "zdravotnické",
    ],
    "průmyslová": [
        "výrobní hal", "skladová", "technologie",
        "jeřábová dráh", "PS 0",
    ],
    "rekonstrukce": [
        "rekonstrukc", "bourací práce", "stavební průzkum",
        "statické posouzení",
    ],
    "inženýrské_sítě": [
        "vodovod", "kanalizac", "plynovod",
        "vedení VN", "kabelová tras",
    ],
    "vegetační": [
        "vegetační", "sadové úprav", "výsadby dřevin",
    ],
    "nestavební": [
        "žalob", "soud", "rozsud",
        "faktur", "objednávk",
    ],
    "pozemní_TZB": [
        "D.1.4", "elektroinstalace", "slaboproud", "silnoproud",
        "vzduchotechnik", "zdravotechnik", "vytápění",
        "měření a regulac", "FVE", "fotovoltai", "střídač",
        "rozvaděč", "hromosvod",
    ],
}


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
    perplexity_llm_call=None,
) -> ClassificationInfo:
    """
    Full 3-tier classification with AI fallback.

    Args:
        filename: Original filename
        text: Extracted document text
        llm_call: Async callable (prompt) -> dict|None from PassportEnricher._call_llm
        perplexity_llm_call: Optional separate callable for Perplexity Tier 3
    """
    # Try tiers 1-2 first
    result = classify_document(filename, text)
    if result.confidence >= 0.5:
        return result

    # Tier 3a: Standard AI classification (Gemini Flash / Claude)
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

    # Tier 3b: Perplexity web-search verification for unknown documents
    if (perplexity_llm_call or llm_call) and text and result.confidence < 0.3:
        try:
            from app.services.perplexity_classifier import classify_unknown_document
            pplx_result = await classify_unknown_document(
                filename=filename,
                text=text,
                llm_call=perplexity_llm_call or llm_call,
            )
            if pplx_result and pplx_result.get("confidence", 0) > result.confidence:
                # Learn from Perplexity result (self-learning)
                try:
                    from app.services.learned_patterns import (
                        learn_from_classification, supplement_partial_result,
                    )
                    # Check if Perplexity result is partial (missing fields)
                    is_partial = (
                        not pplx_result.get("params_key")
                        or not pplx_result.get("so_type")
                    )
                    llm_supplement = None
                    if is_partial and llm_call:
                        llm_supplement = await supplement_partial_result(
                            text, pplx_result, llm_call
                        )

                    # Store as learned pattern for future Tier 0 matches
                    learning = learn_from_classification(
                        filename, text, pplx_result, llm_supplement
                    )
                    logger.info(
                        f"Learned pattern created: completeness={learning.completeness_pct}%, "
                        f"needs_review={learning.pattern.needs_review}, "
                        f"gaps={len(learning.gaps)}"
                    )
                except Exception as learn_err:
                    logger.debug(f"Pattern learning skipped: {learn_err}")

                # Map Perplexity result to ClassificationInfo
                if not pplx_result.get("is_construction", True):
                    # Non-construction → OT
                    return ClassificationInfo(
                        category=DocCategory.OT,
                        confidence=pplx_result["confidence"],
                        method="perplexity",
                        detected_keywords=[
                            pplx_result.get("document_type", ""),
                            pplx_result.get("reasoning", ""),
                        ],
                    )
                else:
                    # Construction doc — classify as TZ by default
                    return ClassificationInfo(
                        category=DocCategory.TZ,
                        confidence=pplx_result["confidence"],
                        method="perplexity",
                        detected_keywords=[
                            pplx_result.get("so_type", ""),
                            pplx_result.get("reasoning", ""),
                        ],
                    )
        except Exception as e:
            logger.warning(f"Perplexity Tier 3 failed for '{filename}': {e}")

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


# =============================================================================
# v3.1: Content-based SO type detection
# =============================================================================

CONTENT_TYPE_MARKERS = {
    "vegetation_params": [
        "vegetační úprav", "trávník", "výsadby", "hydroosev",
        "travní směs", "dřevin", "keřů", "mulčování",
    ],
    "road_params": [
        "konstrukce vozovky", "aktivní zóna", "příčný sklon",
        "jízdní pruh", "nezpevněná krajnice", "svodidl",
        "pavement", "traffic load",
    ],
    "bridge_params": [
        "nosná konstrukce", "mostní", "opěra", "pilíř",
        "rozpětí", "ložisk", "mostovk",
    ],
    "traffic_params": [
        "dopravně inženýrsk", "fáze výstavby", "objízdná trasa",
        "uzavírk", "provizorní komunikac",
    ],
    "water_params": [
        "vodovod", "kanalizac", "potrubí", "chránič",
        "tlaková zkouška", "dezinfik", "DN ",
    ],
    "electro_params": [
        "kabel", "vedení VN", "vedení NN", "CETIN",
        "optick", "metalick",
    ],
    "pipeline_params": [
        "plynovod", "VTL", "STL", "NTL",
    ],
    "signage_params": [
        "dopravní značení", "vodorovné značení", "svislé značení",
    ],
    # D.1.4 professions (pozemní stavby) — detected by content
    "silnoproud_params": [
        "silnoproudé elektroinstalace", "napájecí soustava",
        "výkonová bilance", "rozvaděč", "hlavní jistič",
        "TN-C-S", "TN-S", "CYKY",
    ],
    "slaboproud_params": [
        "slaboproudé systémy", "strukturovaná kabeláž",
        "EPS", "PZTS", "CCTV", "SKV", "esserbus",
    ],
    "vzt_params": [
        "vzduchotechnické zařízení", "klimatizac",
        "rekuperac", "zpětné získávání tepla",
        "nuceného větrání", "digestoř", "fan-coil",
        "vzduchotechnická jednotka", "objemový průtok",
        "rekuperační výměník", "parní vyvíječ",
        "variabilní průtok vzduchu", "požární klapka EI",
        "split systém", "zařízení č.",
        "ČSN EN 13779", "ČSN 12 7010", "ČSN EN 15423",
    ],
    "zti_params": [
        "zdravotechnické instalace", "vnitřní vodovod",
        "vnitřní kanalizace", "zařizovací předmět",
        "splaškové vody", "dešťové vody", "vodoměrná sestava",
        "zásobník TV", "odpadní potrubí", "větrací hlavice",
        "ČSN 73 6760", "ČSN EN 806",
    ],
    "ut_params": [
        "ústřední vytápění", "otopná soustava",
        "tepelné čerpadlo", "podlahové vytápění",
        "kondenzační kotel", "krbová kamna", "komínový systém",
        "tepelné ztráty", "otopné těleso",
        "ČSN EN 12831", "ČSN 06 0310",
    ],
    "mar_params": [
        "měření a regulace", "řídicí systém",
        "frekvenční měnič", "BMS",
    ],
    # Railway (Správa železnic)
    "zel_svrsek_params": [
        "kolejový rošt", "kolejnice 49 E1", "ocelový pražec",
        "bezstyková kolej", "SŽDC S3", "SŽ S3",
        "geometrická poloha koleje", "drážní stezky",
    ],
    "zel_spodek_params": [
        "konstrukce pražcového podloží", "ZKPP", "KPP",
        "zemní pláň", "prefabrikovaná zídka",
        "SŽ S4", "modul přetvárnosti",
    ],
    "igp_params": [
        "inženýrskogeologický průzkum", "kopané sondy",
        "statická zatěžovací zkouška", "SZZ",
        "redukovaný modul", "drážní štěrk",
    ],
}


def detect_so_type_from_content(text: str) -> Optional[str]:
    """
    Detect SO type params_key from document content.
    Returns params_key like 'road_params', 'water_params' etc., or None.
    """
    text_lower = text[:20000].lower()
    scores = {}
    for params_key, markers in CONTENT_TYPE_MARKERS.items():
        scores[params_key] = sum(1 for m in markers if m.lower() in text_lower)
    best = max(scores, key=scores.get) if scores else None
    if best and scores[best] > 0:
        return best
    return None


# =============================================================================
# v3.1.1: FLEXIBLE SECTION ID EXTRACTION
# =============================================================================

def extract_section_ids(text: str) -> List[Dict[str, str]]:
    """
    Extract all structural section IDs from document text.

    Finds SO codes (SO 202), building sections (D.1.1), PD parts (A.1-F.1),
    industrial objects (PS 01), and engineering objects (IO 01).

    Returns list of dicts: [{"type": "SO", "id": "202"}, {"type": "D", "id": "1.1"}, ...]
    """
    results = []
    seen = set()
    snippet = text[:30000]

    type_names = ["SO", "D", "PD_SECTION", "PS", "IO"]
    for pattern, type_name in zip(SECTION_ID_PATTERNS, type_names):
        for m in pattern.finditer(snippet):
            raw_id = m.group(1).strip()
            key = f"{type_name}:{raw_id}"
            if key not in seen:
                seen.add(key)
                results.append({"type": type_name, "id": raw_id})

    return results


# =============================================================================
# v3.1.1: CONSTRUCTION TYPE DETECTION
# =============================================================================

def detect_construction_type(text: str) -> Optional[str]:
    """
    Detect construction project type from document content.

    Returns one of: dopravní, mostní, pozemní_bytová, pozemní_občanská,
    průmyslová, rekonstrukce, inženýrské_sítě, vegetační, nestavební.
    Returns None if no type detected.
    """
    text_lower = text[:20000].lower()
    scores: Dict[str, int] = {}

    for ctype, markers in CONSTRUCTION_TYPE_MARKERS.items():
        scores[ctype] = sum(1 for m in markers if m.lower() in text_lower)

    if not scores:
        return None

    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        return None

    return best


def is_non_construction_document(text: str) -> bool:
    """
    Check if document is non-construction (legal, invoices, etc.).

    Returns True if 'nestavební' type scores highest with ≥2 markers.
    """
    ctype = detect_construction_type(text)
    if ctype != "nestavební":
        return False

    text_lower = text[:20000].lower()
    score = sum(1 for m in CONSTRUCTION_TYPE_MARKERS["nestavební"] if m.lower() in text_lower)
    return score >= 2


# =============================================================================
# v3.1.1: ENHANCED CLASSIFICATION (combines all tiers)
# =============================================================================

def classify_document_enhanced(
    filename: str, text: str = ""
) -> Dict[str, Any]:
    """
    Enhanced classification combining document category, section IDs,
    construction type, and non-construction detection.

    Returns dict with:
        - classification: ClassificationInfo (category, confidence, method)
        - section_ids: list of detected structural IDs
        - construction_type: detected construction type or None
        - is_non_construction: bool
        - so_code: extracted SO code or None
        - learned_pattern_used: bool (whether Tier 0 matched)
    """
    # Tier 0: Check learned patterns first (fastest, zero-cost)
    try:
        from app.services.learned_patterns import match_learned_pattern
        learned = match_learned_pattern(filename, text)
        if learned and learned.get("confidence", 0) >= 0.6:
            # Build ClassificationInfo from learned pattern
            raw_cat = learned.get("doc_category", "OT")
            valid_cats = {c.value for c in DocCategory}
            if raw_cat in valid_cats:
                classification = ClassificationInfo(
                    category=DocCategory(raw_cat),
                    confidence=learned["confidence"],
                    method="learned_pattern",
                    detected_keywords=[f"pattern#{learned.get('pattern_index', '?')}"],
                )
                classification = enrich_classification(classification, filename)

                result = {
                    "classification": classification,
                    "section_ids": extract_section_ids(text) if text else [],
                    "construction_type": learned.get("construction_type") or (detect_construction_type(text) if text else None),
                    "is_non_construction": not learned.get("is_construction", True),
                    "so_code": classification.so_code,
                    "learned_pattern_used": True,
                }
                logger.info(f"Tier 0 (learned pattern) matched '{filename}' → {raw_cat}")
                return result
    except Exception as e:
        logger.debug(f"Learned pattern check skipped: {e}")

    # Standard classification (Tiers 1-2)
    classification = classify_document(filename, text)

    # Enrich with sub-type and SO code
    classification = enrich_classification(classification, filename)

    result = {
        "classification": classification,
        "section_ids": [],
        "construction_type": None,
        "is_non_construction": False,
        "so_code": classification.so_code,
        "learned_pattern_used": False,
        "d14_profession": None,
        "is_d14": False,
    }

    if text:
        # Extract all section IDs from content
        result["section_ids"] = extract_section_ids(text)

        # Detect construction type
        result["construction_type"] = detect_construction_type(text)

        # Check if non-construction
        result["is_non_construction"] = is_non_construction_document(text)

        # If no SO code from filename, try to find from section IDs
        if not result["so_code"]:
            for sid in result["section_ids"]:
                if sid["type"] == "SO":
                    result["so_code"] = f"SO {sid['id']}"
                    classification.so_code = result["so_code"]
                    break

        # v3.2: Detect D.1.4 profession (pozemní stavby)
        try:
            from app.services.d14_profession_detector import (
                is_d14_document, detect_d14_profession,
            )
            if is_d14_document(filename, text):
                result["is_d14"] = True
                result["d14_profession"] = detect_d14_profession(filename, text)
        except Exception as e:
            logger.debug(f"D.1.4 detection skipped: {e}")

    return result
