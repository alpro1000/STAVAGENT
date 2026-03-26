"""
D.1.4 Profession Detector — v3.2

Detects profession type for D.1.4 sections in pozemní stavby (building projects).

⚠️ CRITICAL: Section number (D.1.4.xx) NEVER determines the profession!
   "D.1.4.d" = slaboproud in one project, silnoproud in another.
   Profession is determined EXCLUSIVELY from filename keywords and document content.

Supported professions:
- SilnoproudParams: silnoproudé elektroinstalace
- SlaboproudParams: slaboproudé systémy (SCS, PZTS, SKV, CCTV, EPS, AVT, INT)
- VZTParams: vzduchotechnika a klimatizace
- ZTIParams: zdravotechnické instalace
- UTParams: ústřední vytápění
- MaRParams: měření a regulace

Author: STAVAGENT Team
Version: 3.2.0
Date: 2026-03-26
"""

import re
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# PROFESSION DETECTION BY FILENAME KEYWORDS
# =============================================================================

PROFESSION_FILENAME_MARKERS: Dict[str, List[str]] = {
    "silnoproud_params": [
        "silnoproud", "esi", "osvětlen", "osvetl",
        "zásuvk", "zasuvk", "rozvaděč", "rozvadec",
        "napáj", "napaj",
    ],
    "slaboproud_params": [
        "slaboproud", "slp", "slb",
        "scs", "pzts", "eps", "cctv", "skv", "avt",
        "kamerov", "zabezpečov", "zabezpecov",
        "požární signalizac", "pozarni signalizac",
        "kontrola vstupu", "strukturovaná kabeláž", "strukturovana kabelaz",
    ],
    "vzt_params": [
        "vzduchotechni", "vzt", "klimatizac", "vetrani", "větrání",
        "rekuperac", "nucené_větrání", "vzduchotech",
    ],
    "zti_params": [
        "zdravotechni", "zti", "zdroj", "vodovod", "kanalizac",
        "vodni_instalac", "vnitřní_vodovod", "vnitřni_kanalizace",
        "splaškov", "splaskov", "dešťov", "destov",
        "teplá_voda", "tepla_voda", "tv_",
    ],
    "ut_params": [
        "ústřední topení", "ustredni topeni", "ústřední_vytápění",
        "vytápění", "vytapeni", "otopn", "ut_", "_ut_",
        "tepeln", "kotel", "podlahov_vytápění", "podlahové_topení",
    ],
    "mar_params": [
        "měření a regulac", "mereni a regulac", "mar",
    ],
    # Railway (Správa železnic)
    "zel_svrsek_params": [
        "svrsek", "zelsvrsek", "zel_svrsek", "svršek",
        "sk1", "so111", "kolejovy_rost", "kolej",
        "zeleznicni_svrsek",
    ],
    "zel_spodek_params": [
        "spodek", "zelspodek", "zel_spodek", "spodok",
        "so112", "kpp", "zkpp", "prazcove_podlozi",
        "zeleznicni_spodek",
    ],
    "igp_params": [
        "igp", "inzenyrsko_geologicky", "pruzkum_prazcoveho",
        "global_geo", "geotechnika", "geotechnicky",
        "sonda", "szz", "statická_zatěžovací", "staticka_zatezovaci",
    ],
}


# =============================================================================
# PROFESSION DETECTION BY CONTENT KEYWORDS
# =============================================================================

PROFESSION_CONTENT_MARKERS: Dict[str, List[str]] = {
    "silnoproud_params": [
        "silnoproudé elektroinstalace", "napájecí soustava",
        "výkonová bilance", "TN-C-S", "TN-S", "proudový chránič",
        "CYKY", "CXKH", "CHKE", "zásuvková instalace",
        "rozvaděč R", "hlavní jistič", "silnoproudý rozvod",
        "elektroměr", "přívodní kabel", "jistič",
    ],
    "slaboproud_params": [
        "slaboproudé systémy", "strukturovaná kabeláž", "SCS",
        "poplachový zabezpečovací", "PZTS",
        "elektronická požární signalizace", "EPS",
        "systém kontroly vstupu", "SKV", "kamerový systém", "CCTV",
        "esserbus", "kat.6A", "slaboproudý", "datový rozvaděč",
    ],
    "vzt_params": [
        "vzduchotechnické zařízení", "přívod vzduchu", "rekuperac",
        "vzduchotechnika", "klimatizační", "odtahový ventilátor",
        "protidešťová žaluzie", "tlumiče hluku", "filtr",
        "zpětné získávání tepla", "nuceného větrání",
        "přirozené větrání", "digestoř", "fan-coil",
        "průtok vzduchu", "výměna vzduchu",
        "ČSN EN 13779", "ČSN 12 7010",
    ],
    "zti_params": [
        "zdravotechnické instalace", "vnitřní vodovod", "vnitřní kanalizace",
        "zařizovací předmět", "odpadní potrubí", "stoupací potrubí",
        "přípojka vodovodu", "teplá voda", "požární vodovod",
        "splaškové vody", "dešťové vody", "větrací hlavice",
        "zápachová uzávěrka", "revizní šachta", "podlahová vpusť",
        "vodoměrná sestava", "zásobník TV", "cirkulace",
        "ČSN 73 6760", "ČSN EN 806", "ČSN 75 5455",
    ],
    "ut_params": [
        "ústřední vytápění", "otopná soustava", "tepelné čerpadlo",
        "otopná tělesa", "podlahové vytápění", "kotelna",
        "radiátor", "termostatický ventil", "expanzní nádoba",
        "kondenzační kotel", "teplovodní", "rozdělovač", "sběrač",
        "krbová kamna", "akumulační kamna", "komín",
        "tepelný výkon", "jmenovitý výkon",
        "ČSN EN 12831", "ČSN 06 0310", "ČSN 06 0320",
    ],
    "mar_params": [
        "měření a regulace", "řídicí systém", "regulátor",
        "čidlo teploty", "frekvenční měnič", "servopohon",
        "sběrnice", "vizualizace", "BMS",
    ],
    # Railway (Správa železnic)
    "zel_svrsek_params": [
        "kolejový rošt", "kolejnice", "pražce", "pražcové kotvy",
        "kolejové lože", "bezstyková kolej", "izolované styky",
        "drážní stezky", "geometrická poloha koleje", "GPK",
        "SŽDC S3", "SŽ S3/2", "ČSN 73 6360",
        "Správa železnic", "SK 113", "SO 111",
    ],
    "zel_spodek_params": [
        "konstrukce pražcového podloží", "KPP", "ZKPP",
        "konstrukční vrstva", "zemní pláň",
        "pláň tělesa železničního spodku",
        "štěrkodrť", "ŠD 0/32", "ŠD 0/63",
        "modul přetvárnosti", "Emin,ZP",
        "SŽ S4", "VL Ž 2.2",
    ],
    "igp_params": [
        "inženýrskogeologický průzkum", "IGP", "kopané sondy",
        "statická zatěžovací zkouška", "SZZ",
        "modul přetvárnosti E2,IGP", "redukovaný modul Er",
        "drážní štěrk", "třída zeminy", "namrzavost",
        "ČSN 73 6133", "ČSN EN ISO 14688",
    ],
}


# =============================================================================
# SLABOPROUD SUBSYSTEM DETECTION
# =============================================================================

SLP_SUBSYSTEM_SUFFIXES: Dict[str, str] = {
    "SCS": "strukturovaná_kabeláž",
    "PZTS": "zabezpečovací_systém",
    "SKV": "kontrola_vstupu",
    "CCTV": "kamerový_systém",
    "EPS": "požární_signalizace",
    "AVT": "audiovizuální_technika",
    "INT": "interkom",
    "MaR": "měření_a_regulace",
    "EZS": "zabezpečovací_systém",
    "ACS": "kontrola_vstupu",
}

# Drawing-specific file type suffixes
FILE_TYPE_SUFFIXES: Dict[str, str] = {
    "BS": "blokové_schéma",
    "SS": "stávající_stav",
    "NS": "nový_stav",
    "TZ": "technická_zpráva",
}

# Floor pattern in filenames
FLOOR_PATTERN = re.compile(r"(\d+)\s*\.?\s*([NP]P)", re.IGNORECASE)

# D.1.4 section pattern
D14_SECTION_PATTERN = re.compile(r"D\.1\.4(?:\.(\w+))?", re.IGNORECASE)


# =============================================================================
# DETECTION FUNCTIONS
# =============================================================================

def detect_d14_profession(filename: str, first_page_text: str = "") -> str:
    """
    Determine D.1.4 profession — uses ONLY keywords, NEVER section number.

    Args:
        filename: Original filename (e.g., "D.1.4.10_Silnoproud_TZ.pdf")
        first_page_text: First page text for content-based detection

    Returns:
        Profession params key: "silnoproud_params", "slaboproud_params",
        "vzt_params", "zti_params", "ut_params", "mar_params", or "unknown"
    """
    fname_lower = filename.lower()

    # Step 1: Filename keyword matching (fastest, highest confidence)
    for params_key, keywords in PROFESSION_FILENAME_MARKERS.items():
        if any(kw in fname_lower for kw in keywords):
            logger.info(f"D.1.4 profession detected from filename: {params_key} ({filename})")
            return params_key

    # Step 2: Content keyword scoring
    if first_page_text:
        text_lower = first_page_text[:10000].lower()
        scores: Dict[str, int] = {}

        for params_key, markers in PROFESSION_CONTENT_MARKERS.items():
            scores[params_key] = sum(1 for m in markers if m.lower() in text_lower)

        best = max(scores, key=scores.get)
        if scores[best] >= 2:
            logger.info(
                f"D.1.4 profession detected from content: {best} "
                f"(score={scores[best]}, {filename})"
            )
            return best

    logger.warning(f"D.1.4 profession could not be determined: {filename}")
    return "unknown"


def is_d14_document(filename: str, text: str = "") -> bool:
    """Check if a document belongs to D.1.4 (technical installations)."""
    fname_lower = filename.lower()

    # Check filename for D.1.4 pattern
    if D14_SECTION_PATTERN.search(fname_lower):
        return True

    # Check filename for profession keywords
    all_keywords = []
    for keywords in PROFESSION_FILENAME_MARKERS.values():
        all_keywords.extend(keywords)
    if any(kw in fname_lower for kw in all_keywords):
        return True

    # Check text content
    if text:
        text_lower = text[:5000].lower()
        d14_indicators = [
            "d.1.4", "technické zařízení budov", "tzb",
            "elektroinstalace", "vzduchotechnika", "zdravotechnika",
        ]
        if sum(1 for ind in d14_indicators if ind in text_lower) >= 2:
            return True

    return False


def extract_d14_section_id(filename: str) -> Optional[str]:
    """Extract D.1.4.xx section ID from filename."""
    match = D14_SECTION_PATTERN.search(filename)
    if match:
        sub = match.group(1)
        if sub:
            return f"D.1.4.{sub}"
        return "D.1.4"
    return None


def detect_slaboproud_subsystem(filename: str, text: str = "") -> Optional[str]:
    """Detect specific slaboproud subsystem (SCS, PZTS, EPS, etc.)."""
    fname_upper = filename.upper()
    text_upper = text[:5000].upper() if text else ""

    for suffix, name in SLP_SUBSYSTEM_SUFFIXES.items():
        if suffix in fname_upper or suffix in text_upper:
            return suffix

    return None


# =============================================================================
# FILE GROUPING
# =============================================================================

def group_d14_files(files: List[str]) -> Dict[str, List[str]]:
    """
    Group D.1.4 files by detected profession.

    Args:
        files: List of filenames

    Returns:
        Dict mapping profession params_key → list of filenames.
        Files that can't be classified go to "k_určení_z_obsahu".
    """
    groups: Dict[str, List[str]] = defaultdict(list)

    for f in files:
        fname_lower = f.lower()

        # Try filename-based detection
        detected = None
        for params_key, keywords in PROFESSION_FILENAME_MARKERS.items():
            if any(kw in fname_lower for kw in keywords):
                detected = params_key
                break

        if detected:
            groups[detected].append(f)
        elif "půdorys" in fname_lower or "pudorys" in fname_lower:
            # Floor plan — try to determine profession from specific keywords
            if any(kw in fname_lower for kw in ["osvětlen", "osvetl", "zásuvk", "zasuvk", "napáj", "napaj"]):
                groups["silnoproud_params"].append(f)
            elif any(kw in fname_lower for kw in ["scs", "eps", "pzts", "cctv", "skv"]):
                groups["slaboproud_params"].append(f)
            elif any(kw in fname_lower for kw in ["vzt", "vzduch", "klima"]):
                groups["vzt_params"].append(f)
            elif any(kw in fname_lower for kw in ["zti", "vodovod", "kanalizac"]):
                groups["zti_params"].append(f)
            elif any(kw in fname_lower for kw in ["topení", "topeni", "otop", "vytáp", "vytap"]):
                groups["ut_params"].append(f)
            else:
                groups["k_určení_z_obsahu"].append(f)
        else:
            groups["k_určení_z_obsahu"].append(f)

    result = dict(groups)
    logger.info(
        f"D.1.4 file grouping: {sum(len(v) for v in result.values())} files → "
        f"{len(result)} groups: {', '.join(f'{k}({len(v)})' for k, v in result.items())}"
    )
    return result


def get_profession_label(params_key: str) -> str:
    """Get Czech label for a D.1.4 profession."""
    labels = {
        "silnoproud_params": "Silnoproudé elektroinstalace",
        "slaboproud_params": "Slaboproudé systémy",
        "vzt_params": "Vzduchotechnika a klimatizace",
        "zti_params": "Zdravotechnické instalace",
        "ut_params": "Ústřední vytápění",
        "mar_params": "Měření a regulace",
        "zel_svrsek_params": "Železniční svršek",
        "zel_spodek_params": "Železniční spodek",
        "igp_params": "Inženýrskogeologický průzkum",
        "unknown": "Neznámá profese",
    }
    return labels.get(params_key, "TZB profese")
