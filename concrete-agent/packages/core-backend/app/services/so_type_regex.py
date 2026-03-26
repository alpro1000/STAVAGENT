"""
SO Type-Specific Regex Patterns — v3.1

Regex patterns for extracting structured data from Czech construction
documents across all SO types (roads, water, vegetation, DIO, electro, etc.).

All matches have confidence=1.0 (deterministic extraction).

Author: STAVAGENT Team
Version: 3.1.0
Date: 2026-03-26
"""

import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# ROAD REGEX (SO 1xx)
# =============================================================================

ROAD_PATTERNS = {
    "road_category": re.compile(
        r"kategori[ií]\s+(?:typu\s+)?([SMCOP]\s*[\d,./]+)", re.IGNORECASE
    ),
    "traffic_load_class": re.compile(
        r"tříd[ua]\s+dopravního\s+zatížení\s+(\w+)", re.IGNORECASE
    ),
    "design_damage_level": re.compile(
        r"návrhov[áou]\s+úrovn[ěí]\s+porušení\s+(\w+)", re.IGNORECASE
    ),
    "lane_width_m": re.compile(
        r"jízdní\s+pruh.*?šířk[uy]\s+([\d,]+)\s*m", re.IGNORECASE
    ),
    "active_zone_thickness_m": re.compile(
        r"aktivní\s+zón[auy].*?tloušťc[ei]\s+([\d,]+)\s*m", re.IGNORECASE
    ),
    "min_cbr_pct": re.compile(
        r"(\d+)\s*%\s*CBR", re.IGNORECASE
    ),
    "cross_slope_pct": re.compile(
        r"příčný\s+sklon.*?([\d,]+)\s*%", re.IGNORECASE
    ),
    "shoulder_slope_pct": re.compile(
        r"[Nn]ezpevněná\s+krajnice.*?sklon\s+([\d,]+)\s*%"
    ),
    "shoulder_unpaved_m": re.compile(
        r"nezpevněn[áou]\s+krajnic[eí].*?([\d,]+)\s*m", re.IGNORECASE
    ),
    "shoulder_paved_m": re.compile(
        r"zpevněn[áou]\s+krajnic[eí].*?([\d,]+)\s*m", re.IGNORECASE
    ),
    "road_length_m": re.compile(
        r"(?:celkov[áé]\s+délk[ay]|délka\s+úseku).*?([\d\s,]+)\s*m", re.IGNORECASE
    ),
}


# =============================================================================
# DIO REGEX (SO 180)
# =============================================================================

DIO_PATTERNS = {
    "total_duration_weeks": re.compile(
        r"CELKOVÁ\s+DOBA\s+VÝSTAVBY.*?(\d+)\s+TÝDN", re.IGNORECASE
    ),
    "phase_header": re.compile(
        r"(\d)\.\s*fáze[:\s]", re.IGNORECASE
    ),
    "phase_duration_weeks": re.compile(
        r"CELKOVÁ\s+DOBA.*?(\d+)\s+TÝDN", re.IGNORECASE
    ),
    "closure_road": re.compile(
        r"(?:uzavř|uzavírk)[aáeě].*?((?:I{1,3}/\d+|[IVX]+/\d+))", re.IGNORECASE
    ),
    "speed_limit_kmh": re.compile(
        r"snížen[ií]\s+rychlosti.*?(\d+)\s*km/h", re.IGNORECASE
    ),
    "detour_route": re.compile(
        r"[Oo]bjízdná\s+trasa.*?(?:vyznačena\s+)?(.*?)(?:\.|$)"
    ),
}


# =============================================================================
# WATER REGEX (SO 3xx)
# =============================================================================

WATER_PATTERNS = {
    "pipe_dn": re.compile(r"DN\s*(\d+)"),
    "pipe_pn": re.compile(r"PN\s*(\d+)"),
    "pipe_material": re.compile(
        r"(?:materiál[ue]?\s+)?(TLT|tvárn[áé]\s+litin[ay]|PE\s*\d+|PP|PVC|OC)",
        re.IGNORECASE,
    ),
    "pipe_length_m": re.compile(
        r"(?:celkov[áé]\s+délk[ay]|délka)\s+(?:přeložky\s+)?(?:vodovodu\s+)?.*?([\d,]+)\s*m",
        re.IGNORECASE,
    ),
    "casing_dn": re.compile(
        r"chránič[ka].*?DN\s*(\d+)", re.IGNORECASE
    ),
    "bedding_depth_mm": re.compile(
        r"podsyp.*?(\d+)\s*mm", re.IGNORECASE
    ),
    "pressure_test": re.compile(
        r"tlakov[áé]\s+zkouš[ka].*?([\d,]+\s*(?:násobek|×|x|MPa).*?)(?:\.|$)",
        re.IGNORECASE,
    ),
    "concrete_class": re.compile(r"(C\d+/\d+[-\w,\s]*)"),
}


# =============================================================================
# VEGETATION REGEX (SO 8xx)
# =============================================================================

VEGETATION_PATTERNS = {
    "trees_total": re.compile(
        r"[Ss]tromy\s+(?:listnaté\s+)?celkem\s+(\d+)"
    ),
    "shrubs_total": re.compile(
        r"[Kk]eře\s+(?:listnaté\s+)?celkem\s+(\d+)"
    ),
    "seed_rate_g_m2": re.compile(
        r"[Dd]oporučený\s+výsevek\s+(\d+)\s*g/m"
    ),
    "watering_amount_l": re.compile(
        r"zálivk[ay]\s+.*?(\d+)\s*l/(?:m²|ks)", re.IGNORECASE
    ),
    "mulch_thickness_cm": re.compile(
        r"vrstvě\s+(\d+)\s*cm"
    ),
    "row_spacing_m": re.compile(
        r"vzdálenost\s+řad\s+([\d,]+)\s*m", re.IGNORECASE
    ),
    "plant_spacing_m": re.compile(
        r"vzdálenost\s+keřů\s+v\s+řadě\s+([\d,]+)\s*m", re.IGNORECASE
    ),
    "section_header": re.compile(
        r"ÚSEK\s+(\d+)\s+km\s+([\d,]+\s*[-–]\s*[\d,]+)", re.IGNORECASE
    ),
}


# =============================================================================
# ELECTRO REGEX (SO 4xx)
# =============================================================================

ELECTRO_PATTERNS = {
    "voltage_level": re.compile(
        r"(?:vedení|kabel|přeložka)\s+(VVN|VN|NN)", re.IGNORECASE
    ),
    "cable_type": re.compile(
        r"(optick[ýé]|metalick[ýé])\s+kabel", re.IGNORECASE
    ),
    "telecom_operator": re.compile(
        r"(CETIN\s*[a-z.]*|O2\s*Czech|T-Mobile|Vodafone)", re.IGNORECASE
    ),
}


# =============================================================================
# PIPELINE REGEX (SO 5xx)
# =============================================================================

PIPELINE_PATTERNS = {
    "pressure_class": re.compile(r"(VTL|STL|NTL)"),
    "pipe_dn_pipeline": re.compile(r"DN\s*(\d+)"),
    "pipe_material_pipeline": re.compile(
        r"(?:materiál[ue]?\s+)?(ocel|PE\s*\d+|PE-HD)", re.IGNORECASE
    ),
}


# =============================================================================
# EXTRACTION FUNCTIONS
# =============================================================================

def _parse_czech_number(s: str) -> Optional[float]:
    """Parse Czech decimal number: '1 234,56' → 1234.56"""
    s = s.strip().replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def extract_road_params(text: str) -> Dict[str, Any]:
    """Extract road parameters from document text."""
    result = {}
    for field, pattern in ROAD_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in ("lane_width_m", "active_zone_thickness_m", "cross_slope_pct",
                         "shoulder_slope_pct", "shoulder_unpaved_m", "shoulder_paved_m",
                         "road_length_m"):
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            elif field == "min_cbr_pct":
                result[field] = float(val)
            else:
                result[field] = val
    return result


def extract_dio_params(text: str) -> Dict[str, Any]:
    """Extract DIO parameters from document text."""
    result = {}
    m = DIO_PATTERNS["total_duration_weeks"].search(text)
    if m:
        result["total_duration_weeks"] = int(m.group(1))

    # Extract phases
    phases = []
    for pm in DIO_PATTERNS["phase_header"].finditer(text):
        phase_num = int(pm.group(1))
        # Find duration near this phase
        region = text[pm.start():pm.start() + 2000]
        dm = DIO_PATTERNS["phase_duration_weeks"].search(region)
        duration = int(dm.group(1)) if dm else None

        # Find SOs in this phase
        so_matches = re.findall(r"SO\s+(\d{3})", region)
        sos = [f"SO {s}" for s in so_matches]

        phases.append({
            "phase_number": phase_num,
            "duration_weeks": duration,
            "sos_in_phase": sos,
        })
    if phases:
        result["phases"] = phases

    # Extract closures
    closures = []
    for cm in DIO_PATTERNS["closure_road"].finditer(text):
        closures.append(cm.group(1))
    if closures:
        result["closure_roads"] = list(set(closures))

    return result


def extract_water_params(text: str) -> Dict[str, Any]:
    """Extract water infrastructure parameters from document text."""
    result = {}
    for field, pattern in WATER_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in ("pipe_dn", "pipe_pn", "casing_dn", "bedding_depth_mm"):
                result[field] = int(val)
            elif field == "pipe_length_m":
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            else:
                result[field] = val
    return result


def extract_vegetation_params(text: str) -> Dict[str, Any]:
    """Extract vegetation parameters from document text."""
    result = {}
    for field, pattern in VEGETATION_PATTERNS.items():
        if field == "section_header":
            continue  # Handled separately
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in ("trees_total", "shrubs_total", "seed_rate_g_m2",
                         "mulch_thickness_cm"):
                result[field.replace("trees_total", "total_trees")
                       .replace("shrubs_total", "total_shrubs")] = int(val)
            elif field in ("row_spacing_m", "plant_spacing_m"):
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            else:
                result[field] = val

    # Sections
    sections = []
    for sm in VEGETATION_PATTERNS["section_header"].finditer(text):
        sections.append({
            "section_number": int(sm.group(1)),
            "chainage": sm.group(2).strip(),
        })
    if sections:
        result["sections_found"] = len(sections)

    return result


def extract_electro_params(text: str) -> Dict[str, Any]:
    """Extract electrical infrastructure parameters."""
    result = {}
    for field, pattern in ELECTRO_PATTERNS.items():
        m = pattern.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


def extract_pipeline_params(text: str) -> Dict[str, Any]:
    """Extract pipeline parameters."""
    result = {}
    for field, pattern in PIPELINE_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field == "pipe_dn_pipeline":
                result["pipe_dn"] = int(val)
            else:
                result[field] = val
    return result


# Map params_key to extraction function
SO_TYPE_EXTRACTORS = {
    "road_params": extract_road_params,
    "traffic_params": extract_dio_params,
    "water_params": extract_water_params,
    "vegetation_params": extract_vegetation_params,
    "electro_params": extract_electro_params,
    "pipeline_params": extract_pipeline_params,
}


def extract_so_type_params(params_key: str, text: str) -> Dict[str, Any]:
    """
    Run the appropriate regex extractor for the given SO type.
    Returns extracted fields dict (may be empty if no matches).
    """
    extractor = SO_TYPE_EXTRACTORS.get(params_key)
    if extractor:
        try:
            return extractor(text)
        except Exception as e:
            logger.warning(f"SO type regex extraction failed for {params_key}: {e}")
    return {}
