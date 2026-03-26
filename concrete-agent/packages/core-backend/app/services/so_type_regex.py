"""
SO Type-Specific Regex Patterns — v3.2

Regex patterns for extracting structured data from Czech construction
documents across all SO types (roads, water, vegetation, DIO, electro, etc.)
and D.1.4 professions (silnoproud, slaboproud, VZT, ZTI, UT, MaR).

All matches have confidence=1.0 (deterministic extraction).

Author: STAVAGENT Team
Version: 3.2.0
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


# =============================================================================
# D.1.4 ELEKTRO REGEX (universal — silnoproud + slaboproud)
# =============================================================================

ELEKTRO_D14_PATTERNS = {
    "voltage_3phase": re.compile(
        r"(\d\s*NPE\s*AC\s*50\s*Hz\s*\d+\s*V\s*/\s*TN-[SC][-S]?)", re.IGNORECASE
    ),
    "current_system": re.compile(
        r"[Pp]roudová\s+soustava\s*:?\s*(TN[-–][A-Z-]+)"
    ),
    "max_power_kw": re.compile(
        r"[Mm]aximální\s+soudobý\s+příkon\s*:?\s*([\d,]+)\s*kW", re.IGNORECASE
    ),
    "cable_type": re.compile(
        r"((?:\d+-)?C[YX]K[HBYE]-[JRVEO]\s*\d+x[\d,]+(?:\s*mm²)?)"
    ),
    "ip_rating": re.compile(r"(IP\s*[X\d]{2,4})"),
    "rcd_current_ma": re.compile(
        r"[Cc]hrání[čc]\w*.*?(\d+)\s*mA"
    ),
    "spd_type": re.compile(
        r"[Ss]vodič\w*\s+(?:třídy\s+)?(T\d\+?T?\d?)"
    ),
    "lighting_control": re.compile(r"(DALI|KNX|Loxone)"),
    "floor_box_count": re.compile(
        r"(\d+)\s*(?:ks\s+)?podlahov\w+\s+krabic", re.IGNORECASE
    ),
    "switchboard": re.compile(
        r"rozvaděč[eěi]?\s+(R[A-Z]?-?[A-Z0-9]+)", re.IGNORECASE
    ),
    "annual_consumption_mwh": re.compile(
        r"([\d,]+)\s*MWh\s*/\s*rok", re.IGNORECASE
    ),
    "d14_section": re.compile(r"(D\.\d+\.\d+(?:\.\w+)?)"),
    "pd_level": re.compile(
        r"[Ss]tupeň\s+(?:PD:?\s*)?(DVZ|DPS|DSP|DÚR|PDPS|VD-ZDS)"
    ),
    "battery_ah": re.compile(r"akumulátor\w*.*?(\d+)\s*Ah", re.IGNORECASE),
    "backup_hours": re.compile(
        r"záloho\w+\s+.*?(\d+[,.]?\d*)\s*hodin", re.IGNORECASE
    ),
    "camera_count": re.compile(r"(\d+)\s*ks\s+kamer", re.IGNORECASE),
    "cable_category": re.compile(
        r"[Kk]at(?:egorie)?\.?\s*(6A?|7|5E?)"
    ),
    "eps_bus_type": re.compile(
        r"(esserbus|kruhov\w+\s+topologi)", re.IGNORECASE
    ),
}


# =============================================================================
# D.1.4 VZT REGEX — v4.1 (17 patterns)
# =============================================================================

VZT_PATTERNS = {
    # Typ větrání
    "ventilation_type": re.compile(
        r"[Vv]ětrání\s+(?:prostorů?|objektu|domu)\s+(?:je\s+)?(přirozené|nucené|hybridní|klimatizace)",
        re.IGNORECASE,
    ),
    # Přívod / odvod
    "airflow_supply_m3h": re.compile(
        r"[Pp]řívod\s+vzduchu\s*[:\-]?\s*([\d\s,]+)\s*m[³3]/h"
    ),
    "airflow_exhaust_m3h": re.compile(
        r"[Oo]dvod\s+vzduchu\s*[:\-]?\s*([\d\s,]+)\s*m[³3]/h"
    ),
    # Digestoř
    "hood_type": re.compile(
        r"(digestoř[íe]?\w*)\s+s?\s*(odtahov\w+|cirkulačn\w+)", re.IGNORECASE
    ),
    "hood_duct_outlet": re.compile(
        r"(?:digestoř|odtahové)\s+potrubí.*?(?:vyvedeno?|vede)\s+(?:na\s+)?(fasádu|střechu|ven)",
        re.IGNORECASE,
    ),
    "hood_duct_size": re.compile(
        r"(?:odtahové\s+)?potrubí.*?(?:Ø|DN|průměr)?\s*(\d{2,3})\s*mm", re.IGNORECASE
    ),
    # Ventilátory koupelny
    "bath_fan_control": re.compile(
        r"ventilátor.*?(spínač\s+světla|čidlo\s+vlhkosti|časový\s+spínač|timer)",
        re.IGNORECASE,
    ),
    # Rekuperace
    "heat_recovery_type": re.compile(
        r"(rekuperac[eí]|křížový\s+výměník|rotační\s+výměník|deskový\s+výměník)",
        re.IGNORECASE,
    ),
    "heat_recovery_pct": re.compile(
        r"[Uu]činnost\s+(?:rekuperace|zpětného\s+získávání)\s*[:\-]?\s*(\d+)\s*%"
    ),
    # Klimatizace
    "ac_type": re.compile(
        r"(split[\s-]?systém|VRV|VRF|multi[\s-]?split|chiller|fan[\s-]?coil)", re.IGNORECASE
    ),
    "ac_refrigerant": re.compile(r"chladiv[oa]\s+(R[\d]+[A-Z]?)"),
    "ac_cooling_kw": re.compile(
        r"chladící\s+výkon\s*[:\-]?\s*([\d,]+)\s*kW", re.IGNORECASE
    ),
    # Garáž
    "garage_vent_type": re.compile(
        r"[Oo]dvětrání\s+(?:prostoru\s+)?garáže\s+(?:je\s+)?(přirozené|nucené)"
    ),
    "co_sensor": re.compile(r"čidl[oa]\s+(?:CO|oxidu\s+uhelnatého)", re.IGNORECASE),
    # Hluk
    "noise_limit_db": re.compile(
        r"hlukov\w+\s+(?:limit|hladina)\w*\s*:?\s*(\d+)\s*dB", re.IGNORECASE
    ),
    # Výměna vzduchu
    "air_change_rate": re.compile(
        r"(\d+[,.]?\d*)\s*[-–]\s*násobek\w*\s+výměn", re.IGNORECASE
    ),
}


# =============================================================================
# D.1.4 ZTI REGEX — v4.1 (26 patterns)
# =============================================================================

ZTI_PATTERNS = {
    # ── Kanalizace ──
    "sewage_pipe_material": re.compile(
        r"(?:vnitřní\s+)?(?:odpadní|svodné)\s+potrubí.*?(PP|PVC[-\w]*|PE)\b", re.IGNORECASE
    ),
    "drain_dn": re.compile(
        r"(?:DN|Ø)\s*(\d{2,3})\s*(?:mm)?.*?(?:svodn|odpadn|kanalizac)", re.IGNORECASE
    ),
    "ventilation_cap_dn": re.compile(
        r"větrací\s+hlavic[eí].*?(?:DN|Ø)?\s*(\d{2,3})", re.IGNORECASE
    ),
    "inspection_shaft": re.compile(
        r"revizní\s+šacht[ayu]", re.IGNORECASE
    ),
    # Výpočtové (QWW)
    "du_sum": re.compile(r"DU\s*=?\s*([\d,]+)\s*l/s"),
    "qww_flow": re.compile(r"[Qq][Ww][Ww]\s*=?\s*([\d,]+)\s*l/s"),
    "main_branch_dn": re.compile(
        r"(?:hlavní|svodné)\s+potrubí.*?DN\s*(\d{2,3})", re.IGNORECASE
    ),
    # ── Dešťová kanalizace ──
    "downpipe_dn": re.compile(
        r"(?:odpadní\s+dešťov|svod\s+dešťov).*?DN\s*(\d{2,3})", re.IGNORECASE
    ),
    "rain_intensity": re.compile(
        r"intenzita\s+deště\s*i\s*=\s*([\d,]+)\s*l/s/m", re.IGNORECASE
    ),
    "roof_area": re.compile(
        r"(?:odvodňovaná\s+plocha|střech[ay]).*?A?\s*=\s*([\d,.]+)\s*m", re.IGNORECASE
    ),
    "qr_flow": re.compile(r"[Qq][Rr]\s*=\s*([\d,]+)\s*l/s"),
    # Retence/akumulace
    "tank_type": re.compile(
        r"(akumulační|retenční|kombinovan[áé])\s+(?:podzemní\s+)?(?:nádrž|nádoba)",
        re.IGNORECASE,
    ),
    "tank_volume": re.compile(
        r"(?:celkovém?\s+)?objem[eu]?\s*(?:minimálně\s+)?([\d,]+)\s*m[³3]", re.IGNORECASE
    ),
    "tank_accumulation": re.compile(
        r"[Aa]kumulační\s+část.*?([\d,]+)\s*m[³3]"
    ),
    "tank_retention": re.compile(
        r"[Rr]etenční\s+část.*?([\d,]+)\s*m[³3]"
    ),
    "max_outlet_ls": re.compile(
        r"(?:regulovaný\s+odtok|odtok\s+max)\s*(?:min\.?\s+)?([\d,]+)\s*l/s", re.IGNORECASE
    ),
    # ── Vodovod ──
    "water_connection_dn": re.compile(
        r"přípojk\w+\s+vodovod\w*.*?DN\s*(\d+)", re.IGNORECASE
    ),
    "connection_length_total": re.compile(
        r"(?:celková\s+)?délka\s+přípojky.*?([\d,]+)\s*m", re.IGNORECASE
    ),
    "meter_location": re.compile(
        r"vodoměrn[áé]\s+(?:sestava|šachta)", re.IGNORECASE
    ),
    "outdoor_tap": re.compile(
        r"(nezámrzný\s+kohout|venkovní\s+výtok|zahradní\s+kohout)", re.IGNORECASE
    ),
    # ── Teplá voda ──
    "hw_storage_volume": re.compile(
        r"zásobník.*?(\d+)\s*l(?:itr)?", re.IGNORECASE
    ),
    "hw_storage_type": re.compile(
        r"(nepřímotopný|přímotopný|průtokový)\s+(?:zásobník|ohřívač)", re.IGNORECASE
    ),
    "hot_water_temp_c": re.compile(
        r"tepl\w+\s+vod\w+.*?(\d+)\s*°C", re.IGNORECASE
    ),
    # ── Zařizovací předměty ──
    "fixture_wc": re.compile(r"(\d+)\s*[×x]\s*WC"),
    "fixture_basin": re.compile(r"(\d+)\s*[×x]\s*umyvadl", re.IGNORECASE),
    "fixture_bath": re.compile(r"(\d+)\s*[×x]\s*van[ay]", re.IGNORECASE),
}


# =============================================================================
# D.1.4 UT REGEX — v4.1 (24 patterns)
# =============================================================================

UT_PATTERNS = {
    # ── Energetika ──
    "u_mean": re.compile(
        r"[Pp]růměrný\s+součinitel\s+prostupu\s+tepla.*?=\s*([\d,]+)\s*W/", re.IGNORECASE
    ),
    "specific_heat_demand": re.compile(
        r"[Mm]ěrná\s+potřeba\s+tepla.*?=\s*([\d,]+)\s*kWh/", re.IGNORECASE
    ),
    "total_energy": re.compile(
        r"[Cc]elková\s+dodaná\s+energie.*?=?\s*([\d,]+)\s*kWh/", re.IGNORECASE
    ),
    "primary_energy": re.compile(
        r"[Pp]rimární\s+energie.*?=?\s*([\d,]+)\s*kWh/", re.IGNORECASE
    ),
    "energy_class": re.compile(
        r"[Kk]lasifikační\s+třída\s+([A-G])"
    ),
    # ── Tepelné ztráty ──
    "heat_loss_kw": re.compile(
        r"(?:celkové\s+)?(?:tepelné\s+)?ztrát\w+\s*=?\s*([\d,]+)\s*kW", re.IGNORECASE
    ),
    "design_outdoor_temp_c": re.compile(
        r"výpočtov\w+\s+(?:venkovní\s+)?teplota\s*[:\-]?\s*(-?\s*\d+)\s*°C", re.IGNORECASE
    ),
    # ── Zdroj tepla ──
    "heat_source_type": re.compile(
        r"(kondenzační\s+kotel|tepelné\s+čerpadlo|elektrokotel|plynový\s+kotel|krbová\s+kamna"
        r"|akumulační\s+kamna)",
        re.IGNORECASE,
    ),
    "fuel_type": re.compile(
        r"(?:kotel|zdroj).*?(zemní\s+plyn|propan|elektřina|pelety|biomasa|dřevo)",
        re.IGNORECASE,
    ),
    "boiler_power_kw": re.compile(
        r"(?:výkon\w*\s+)?(?:kotle?\s+)?(\d+(?:,\d+)?)\s*kW", re.IGNORECASE
    ),
    "boiler_location": re.compile(
        r"kotel.*?(?:umístěn|nachází)\s+v\s+(technick\w+\s+místnost\w*|koteln[ěie])",
        re.IGNORECASE,
    ),
    # ── Podlahové vytápění ──
    "underfloor_brand": re.compile(
        r"(Rehau|Uponor|Danfoss|Herz)[\s\w-]*", re.IGNORECASE
    ),
    "underfloor_product": re.compile(
        r"(?:např\.?\s+)?([A-Z][\w]+\s+[\w-]+\s*\d{1,2}[-\s]\d{1,2})"
    ),
    "screed_thickness": re.compile(
        r"(?:roznášecí\s+vrstva|betonová\s+mazanina).*?tloušt[čk]e?\s*(\d+)\s*mm",
        re.IGNORECASE,
    ),
    # ── Radiátory ──
    "towel_rail_electric": re.compile(
        r"(?:elektrický\s+)?topný\s+žebřík", re.IGNORECASE
    ),
    "radiator_count": re.compile(
        r"(\d+)\s*(?:ks\s+)?(?:deskov\w+|otopn\w+)\s+těles", re.IGNORECASE
    ),
    # ── Rozdělovač ──
    "manifold_location": re.compile(
        r"(?:rozdělovač|sběrač).*?(?:ve|v)\s+([\w\s]+?)(?:\.|,|$)", re.IGNORECASE
    ),
    "manifold_circuits": re.compile(
        r"(\d+)\s*(?:topných|otopných)?\s*okruh", re.IGNORECASE
    ),
    # ── Provozní parametry ──
    "supply_temp": re.compile(r"(\d{2})/(\d{2})\s*°C"),
    "system_pressure": re.compile(
        r"(?:provozní\s+)?tlak\s+(?:soustavy|systému)\s*[:\-=]?\s*([\d,]+)\s*bar",
        re.IGNORECASE,
    ),
    "heat_pump_cop": re.compile(r"COP\s*:?\s*([\d,]+)"),
    # ── Komín ──
    "chimney_brand": re.compile(
        r"(?:komínový?\s+)?(?:systém|soustav[ayu])\s+(Schiedel|Brilon|Almeva|Dinak)",
        re.IGNORECASE,
    ),
    "chimney_flue_dn": re.compile(
        r"(?:průduch|vložka|DN)\s*(?:Ø)?\s*(\d{2,3})\s*mm", re.IGNORECASE
    ),
    "air_supply_integrated": re.compile(
        r"(?:přívod\s+spalovacího\s+vzduchu|LAS\s+systém)", re.IGNORECASE
    ),
}


# =============================================================================
# D.1.4 EXTRACTION FUNCTIONS
# =============================================================================

def extract_silnoproud_params(text: str) -> Dict[str, Any]:
    """Extract silnoproud (strong-current) parameters from document text."""
    result = {}

    for field, pattern in ELEKTRO_D14_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field == "max_power_kw":
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result["max_concurrent_power_kw"] = parsed
            elif field == "annual_consumption_mwh":
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            elif field == "floor_box_count":
                result["floor_box_count"] = int(val)
            elif field == "rcd_current_ma":
                result[field] = int(val)
            elif field in ("voltage_3phase", "current_system", "cable_type",
                          "ip_rating", "spd_type", "lighting_control",
                          "switchboard", "d14_section", "pd_level"):
                result[field] = val

    # Extract switchboard designations (may be multiple)
    switchboards = []
    for m in ELEKTRO_D14_PATTERNS["switchboard"].finditer(text):
        sw = m.group(1).strip()
        if sw not in switchboards:
            switchboards.append(sw)
    if switchboards:
        result["switchboard_designations"] = switchboards

    return result


def extract_slaboproud_params(text: str) -> Dict[str, Any]:
    """Extract slaboproud (low-current) parameters from document text."""
    result = {}
    subsystems = []

    # Detect present subsystems
    text_upper = text[:20000].upper()
    for suffix in ["SCS", "PZTS", "SKV", "CCTV", "EPS", "AVT", "INT", "EZS", "ACS"]:
        if suffix in text_upper:
            subsystems.append(suffix)
    if subsystems:
        result["subsystems"] = subsystems

    # Cable category
    m = ELEKTRO_D14_PATTERNS["cable_category"].search(text)
    if m:
        result["cable_category"] = f"Cat.{m.group(1)}"

    # EPS bus type
    m = ELEKTRO_D14_PATTERNS["eps_bus_type"].search(text)
    if m:
        result["eps_bus_type"] = m.group(1)

    # Camera count
    m = ELEKTRO_D14_PATTERNS["camera_count"].search(text)
    if m:
        result["camera_count"] = int(m.group(1))

    # Battery
    m = ELEKTRO_D14_PATTERNS["battery_ah"].search(text)
    if m:
        result["battery_ah"] = int(m.group(1))

    # Backup hours
    m = ELEKTRO_D14_PATTERNS["backup_hours"].search(text)
    if m:
        parsed = _parse_czech_number(m.group(1))
        if parsed is not None:
            result["backup_hours"] = parsed

    # Section ID and PD level
    m = ELEKTRO_D14_PATTERNS["d14_section"].search(text)
    if m:
        result["section_id"] = m.group(1)
    m = ELEKTRO_D14_PATTERNS["pd_level"].search(text)
    if m:
        result["pd_level"] = m.group(1)

    return result


def extract_vzt_params(text: str) -> Dict[str, Any]:
    """Extract VZT (HVAC) parameters from document text — v4.1."""
    result = {}
    numeric_fields = {
        "airflow_supply_m3h", "airflow_exhaust_m3h", "heat_recovery_pct",
        "ac_cooling_kw",
    }
    int_fields = {"noise_limit_db", "hood_duct_size"}
    skip_fields = {"hood_type"}  # needs special handling (2 groups)

    for field, pattern in VZT_PATTERNS.items():
        if field in skip_fields:
            continue
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in numeric_fields:
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            elif field in int_fields:
                try:
                    result[field] = int(val)
                except ValueError:
                    pass
            elif field == "co_sensor":
                result["co_sensor"] = True
            elif field == "air_change_rate":
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            else:
                result[field] = val

    # Hood type (2 groups)
    m = VZT_PATTERNS["hood_type"].search(text)
    if m:
        result["kitchen_hood_type"] = m.group(2).strip() if m.group(2) else None

    # Map to schema fields
    if "airflow_supply_m3h" in result:
        result["total_airflow_supply_m3h"] = result.pop("airflow_supply_m3h")
    if "airflow_exhaust_m3h" in result:
        result["total_airflow_exhaust_m3h"] = result.pop("airflow_exhaust_m3h")
    return result


def extract_zti_params(text: str) -> Dict[str, Any]:
    """Extract ZTI (sanitary) parameters from document text — v4.1."""
    result = {}
    dn_fields = {
        "drain_dn", "ventilation_cap_dn", "main_branch_dn",
        "downpipe_dn", "water_connection_dn",
    }
    float_fields = {
        "du_sum", "qww_flow", "rain_intensity", "roof_area", "qr_flow",
        "tank_volume", "tank_accumulation", "tank_retention",
        "max_outlet_ls", "connection_length_total", "hw_storage_volume",
    }
    int_fields = {"fixture_wc", "fixture_basin", "fixture_bath", "hot_water_temp_c"}
    bool_detect = {"inspection_shaft", "meter_location", "outdoor_tap"}

    for field, pattern in ZTI_PATTERNS.items():
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in dn_fields:
                try:
                    result[field] = int(val)
                except ValueError:
                    pass
            elif field in float_fields:
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    result[field] = parsed
            elif field in int_fields:
                try:
                    result[field] = int(val)
                except ValueError:
                    pass
            elif field in bool_detect:
                result[field] = True
            else:
                result[field] = val

    # Map to schema nested fields
    if "qww_flow" in result:
        result["design_flow_qww_ls"] = result.pop("qww_flow")
    if "hw_storage_volume" in result:
        result["storage_volume_l"] = int(result.pop("hw_storage_volume"))
    return result


def extract_ut_params(text: str) -> Dict[str, Any]:
    """Extract UT (heating) parameters from document text — v4.1."""
    result = {}
    float_fields = {
        "heat_loss_kw", "u_mean", "specific_heat_demand", "total_energy",
        "primary_energy", "boiler_power_kw", "heat_pump_cop", "system_pressure",
    }
    int_fields = {"design_outdoor_temp_c", "manifold_circuits", "radiator_count",
                  "chimney_flue_dn", "screed_thickness"}
    bool_detect = {"towel_rail_electric", "air_supply_integrated"}

    for field, pattern in UT_PATTERNS.items():
        if field == "supply_temp":
            m = pattern.search(text)
            if m:
                result["supply_temp_c"] = float(m.group(1))
                result["return_temp_c"] = float(m.group(2))
            continue
        m = pattern.search(text)
        if m:
            val = m.group(1).strip()
            if field in float_fields:
                parsed = _parse_czech_number(val)
                if parsed is not None:
                    if field == "heat_loss_kw":
                        result["heat_loss_total_kw"] = parsed
                    elif field == "u_mean":
                        result["u_mean_wm2k"] = parsed
                    elif field == "specific_heat_demand":
                        result["specific_heat_demand_kwh_m2"] = parsed
                    elif field == "total_energy":
                        result["total_delivered_energy_kwh_m2"] = parsed
                    elif field == "primary_energy":
                        result["primary_energy_kwh_m2"] = parsed
                    elif field == "boiler_power_kw":
                        result["nominal_power_kw"] = parsed
                    else:
                        result[field] = parsed
            elif field in int_fields:
                cleaned = val.replace(" ", "")
                try:
                    result[field] = int(cleaned)
                except ValueError:
                    pass
            elif field in bool_detect:
                result[field] = True
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

# D.1.4 profession extractors
D14_TYPE_EXTRACTORS = {
    "silnoproud_params": extract_silnoproud_params,
    "slaboproud_params": extract_slaboproud_params,
    "vzt_params": extract_vzt_params,
    "zti_params": extract_zti_params,
    "ut_params": extract_ut_params,
    # mar_params has no specific regex — relies on AI extraction
}

# Combined mapping
ALL_TYPE_EXTRACTORS = {**SO_TYPE_EXTRACTORS, **D14_TYPE_EXTRACTORS}


def extract_so_type_params(params_key: str, text: str) -> Dict[str, Any]:
    """
    Run the appropriate regex extractor for the given SO type or D.1.4 profession.
    Returns extracted fields dict (may be empty if no matches).
    """
    extractor = ALL_TYPE_EXTRACTORS.get(params_key)
    if extractor:
        try:
            return extractor(text)
        except Exception as e:
            logger.warning(f"Type regex extraction failed for {params_key}: {e}")
    return {}
