"""
Extractor Registry — Universal registry of all extraction patterns.

Each entry is a dict:
  - key: unique identifier (used as output field name)
  - label_cs: Czech label for humans
  - patterns: dict of {field_name: compiled_regex}
  - parse: function(text) → dict of extracted values (or empty dict)

Engine iterates ALL entries for each document section.
Extractor MUST return empty dict if nothing matches — that's normal.
Adding a new domain = one new entry here. Engine code never changes.

Imports existing patterns from regex_extractor.py and so_type_regex.py
instead of duplicating them.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-31
"""

import re
import logging
from typing import Dict, Any, List, Callable, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Registry entry type
# ---------------------------------------------------------------------------

class ExtractorEntry:
    """Single extractor in the registry."""

    __slots__ = ("key", "label_cs", "parse")

    def __init__(self, key: str, label_cs: str, parse: Callable[[str], Dict[str, Any]]):
        self.key = key
        self.label_cs = label_cs
        self.parse = parse

    def __repr__(self) -> str:
        return f"ExtractorEntry({self.key!r})"


# ---------------------------------------------------------------------------
# Import existing extractors (DO NOT duplicate their code)
# ---------------------------------------------------------------------------

from app.services.so_type_regex import (
    extract_road_params,
    extract_dio_params,
    extract_water_params,
    extract_vegetation_params,
    extract_electro_params,
    extract_pipeline_params,
    extract_silnoproud_params,
    extract_slaboproud_params,
    extract_vzt_params,
    extract_zti_params,
    extract_ut_params,
    extract_zel_svrsek_params,
    extract_zel_spodek_params,
    extract_igp_params,
)


# ---------------------------------------------------------------------------
# New domain extractors (not yet covered by existing code)
# ---------------------------------------------------------------------------

# --- Zdivo (masonry) ---
_ZDIVO_PATTERNS = {
    "tvarnice_typ": re.compile(
        r"(?:tvárnic[eí]|cihel|Porotherm|Ytong|HELUZ|Liapor)\s+([\w\d/. ]+)", re.IGNORECASE
    ),
    "tvarnice_tloustka_mm": re.compile(
        r"(?:tvárnic[eí]|zdiv[oa]|stěn[ay]).*?(?:tl\.?|tloušťk[ay])\s*(\d{2,3})\s*mm", re.IGNORECASE
    ),
    "pevnost_mpa": re.compile(
        r"(?:pevnost|P)\s*(\d+(?:[,.]\d+)?)\s*MPa", re.IGNORECASE
    ),
    "soucinitel_u": re.compile(
        r"[Uu]\s*=\s*(\d+[,.]\d+)\s*W/\(?m[²2][·.]?K\)?", re.IGNORECASE
    ),
    "malta_typ": re.compile(
        r"(?:malt[auy]|lepidl[oa])\s+([\w\d. ]+?)(?:\s*[,.\n])", re.IGNORECASE
    ),
}


def _extract_zdivo(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _ZDIVO_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- Střešní konstrukce (roofing) ---
_STRECHA_PATTERNS = {
    "hydroizolace_typ": re.compile(
        r"(?:hydroizolac[eí]|střešní\s+(?:fóli[eí]|krytina))[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "tepelna_izolace_typ": re.compile(
        r"(?:tepelná?\s+izolac[eí]|EPS|XPS|minerální\s+vata|PIR|PUR)[\s:]*([^\n,]{3,60})", re.IGNORECASE
    ),
    "tepelna_izolace_tl_mm": re.compile(
        r"(?:tepelná?\s+izolac[eí]|EPS|XPS|minerální|PIR|PUR).*?(?:tl\.?|tloušťk[ay])\s*(\d{2,3})\s*mm",
        re.IGNORECASE,
    ),
    "sklon_pct": re.compile(
        r"(?:sklon|spád)\s+střech.*?(\d+(?:[,.]\d+)?)\s*%", re.IGNORECASE
    ),
}


def _extract_strecha(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _STRECHA_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- Podlahy (floors) ---
_PODLAHY_PATTERNS = {
    "mazanina_typ": re.compile(
        r"(?:mazanin[ay]|anhydrit|potěr|cementový\s+potěr|litý\s+potěr)[\s:]*([^\n,]{3,60})",
        re.IGNORECASE,
    ),
    "mazanina_tl_mm": re.compile(
        r"(?:mazanin[ay]|anhydrit|potěr).*?(?:tl\.?|tloušťk[ay])\s*(\d{2,3})\s*mm", re.IGNORECASE
    ),
    "naslapna_vrstva": re.compile(
        r"(?:nášlapná\s+vrstva|dlažba|vinyl|laminát|koberec|PVC|epoxid)[\s:]*([^\n,]{3,60})",
        re.IGNORECASE,
    ),
    "izolace_krocejova_tl_mm": re.compile(
        r"(?:kročejov[áé]|akustick[áé]).*?(?:tl\.?|tloušťk[ay])\s*(\d{1,3})\s*mm", re.IGNORECASE
    ),
}


def _extract_podlahy(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _PODLAHY_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- ETICS / KZS (external thermal insulation) ---
_ETICS_PATTERNS = {
    "izolant_typ": re.compile(
        r"(?:ETICS|KZS|kontaktní\s+zateplovací).*?(?:EPS|XPS|minerální\s+vata|MW|PIR)[\s\d]*([^\n,]{3,40})?",
        re.IGNORECASE,
    ),
    "izolant_tl_mm": re.compile(
        r"(?:ETICS|KZS|kontaktní|fasádní\s+izolac).*?(?:tl\.?|tloušťk[ay])\s*(\d{2,3})\s*mm",
        re.IGNORECASE,
    ),
    "izolant_lambda": re.compile(
        r"[λlL]\s*=?\s*(\d+[,.]\d+)\s*W/\(?m[·.]?K\)?", re.IGNORECASE
    ),
    "kotveni_typ": re.compile(
        r"(?:kotven[ií]|hmoždink[ay])[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "omitka_typ": re.compile(
        r"(?:omítk[ay]|tenkovrstvá)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "omitka_zrnitost_mm": re.compile(
        r"(?:zrnitost|frakce)\s*(\d+(?:[,.]\d+)?)\s*mm", re.IGNORECASE
    ),
}


def _extract_etics(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _ETICS_PATTERNS.items():
        m = pat.search(text)
        if m:
            val = (m.group(1) or "").strip()
            if val:
                result[field] = val
    return result


# --- Okna / dveře (windows & doors) ---
_OKNA_PATTERNS = {
    "material_okna": re.compile(
        r"(?:okn[ao]|oken|dveř[eí]).*?(?:plastov[áé]|dřevěn[áé]|hliníkov[áé]|dřevo-?hliníkov[áé])",
        re.IGNORECASE,
    ),
    "uw_value": re.compile(
        r"[Uu]w\s*=?\s*(\d+[,.]\d+)\s*W/\(?m[²2][·.]?K\)?", re.IGNORECASE
    ),
    "zaskleni": re.compile(
        r"(dvojsklo|trojsklo|izolační\s+(?:dvojsklo|trojsklo))", re.IGNORECASE
    ),
    "rozmery_mm": re.compile(
        r"(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*(?:mm)?", re.IGNORECASE
    ),
}


def _extract_okna(text: str) -> Dict[str, Any]:
    result = {}
    m = _OKNA_PATTERNS["material_okna"].search(text)
    if m:
        result["material_okna"] = m.group(0).strip()
    m = _OKNA_PATTERNS["uw_value"].search(text)
    if m:
        result["uw_value"] = m.group(1).replace(",", ".")
    m = _OKNA_PATTERNS["zaskleni"].search(text)
    if m:
        result["zaskleni"] = m.group(1).strip()
    dims = _OKNA_PATTERNS["rozmery_mm"].findall(text)
    if dims:
        result["rozmery_mm"] = [f"{w}x{h}" for w, h in dims[:10]]
    return result


# --- SDK (sádrokarton / plasterboard) ---
_SDK_PATTERNS = {
    "typ_desky": re.compile(
        r"(GKB|GKBI|GKFI|GKF|Knauf|Rigips|Fermacell)[\s\d]*([^\n,]{0,40})?", re.IGNORECASE
    ),
    "tl_pricky_mm": re.compile(
        r"(?:příčk[ay]|stěn[ay]).*?(?:tl\.?|tloušťk[ay])\s*(\d{2,3})\s*mm", re.IGNORECASE
    ),
    "profily": re.compile(
        r"(?:profil[uy]?|CW|UW)\s*(\d{2,3})", re.IGNORECASE
    ),
    "pozarni_odolnost": re.compile(
        r"(EI\s*\d{2,3}|REI\s*\d{2,3})", re.IGNORECASE
    ),
}


def _extract_sdk(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _SDK_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- Hydroizolace (waterproofing — standalone, not part of roofing) ---
_HYDRO_PATTERNS = {
    "hydro_typ": re.compile(
        r"(?:hydroizolac[eí]|povlakov[áé]\s+izolac).*?(asfaltov[áé]|PVC|TPO|EPDM|modifikovan[áé]\s+asfalt)",
        re.IGNORECASE,
    ),
    "hydro_tl_mm": re.compile(
        r"(?:hydroizolac|asfaltov|PVC|TPO).*?(?:tl\.?|tloušťk[ay])\s*(\d+(?:[,.]\d+)?)\s*mm",
        re.IGNORECASE,
    ),
    "hydro_kotveni": re.compile(
        r"(?:hydroizolac|povlakov).*?(?:celoplošně|bodově|mechanick[éy]|natavením|lepením)",
        re.IGNORECASE,
    ),
}


def _extract_hydro(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _HYDRO_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip() if m.lastindex else m.group(0).strip()
    return result


# --- Plynovod (gas piping) ---
_PLYN_PATTERNS = {
    "plyn_tlak": re.compile(
        r"(STL|NTL|VTL)[\s,.-]*(?:plyn|plynovod)?", re.IGNORECASE
    ),
    "plyn_dn": re.compile(
        r"(?:plyn|plynovod).*?DN\s*(\d+)", re.IGNORECASE
    ),
    "hup": re.compile(
        r"(HUP|hlavní\s+uzávěr\s+plynu)", re.IGNORECASE
    ),
    "plynomer": re.compile(
        r"(?:plynoměr|měření\s+plynu)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "spotreba_m3_h": re.compile(
        r"(\d+(?:[,.]\d+)?)\s*m[³3]/h", re.IGNORECASE
    ),
}


def _extract_plyn(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _PLYN_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- MaR (měření a regulace) ---
_MAR_PATTERNS = {
    "ridici_system": re.compile(
        r"(?:řídicí|řídící|regulační)\s+systém[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "protokol": re.compile(
        r"(BACnet|Modbus|KNX|LON|DALI|M-Bus)", re.IGNORECASE
    ),
    "cidla_typy": re.compile(
        r"(?:čidl[oa]|snímač[eůy])[\s:]+([^\n.]{3,80})", re.IGNORECASE
    ),
    "regulatory": re.compile(
        r"(?:regulátor[ůy]?|regulační\s+ventil)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
}


def _extract_mar(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _MAR_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- Mostní konstrukce (bridges — supplements CzechConstructionExtractor) ---
_MOST_PATTERNS = {
    "rozpeti_m": re.compile(
        r"(?:rozpětí|rozpon)\s*(?:mostu)?[\s:]*(\d+(?:[,.]\d+)?)\s*m", re.IGNORECASE
    ),
    "zatizitelnost_t": re.compile(
        r"(?:zatížitelnost|zatěžovací\s+třída)[\s:]*(\d+(?:[,.]\d+)?)\s*[tT]", re.IGNORECASE
    ),
    "loziska_typ": re.compile(
        r"(?:ložisk[ao]|ložisko)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "mostni_zavery": re.compile(
        r"(?:mostní\s+závěr[uy]?|dilatační\s+závěr)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "rimsa": re.compile(
        r"(?:říms[ay]|obrubn[ií]k)[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
}


def _extract_most(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _MOST_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# --- Dopravní stavby — doplnění (road supplements) ---
_DOPRAVA_PATTERNS = {
    "skladba_vozovky": re.compile(
        r"(?:skladba\s+vozovky|konstrukční\s+vrst)[\s:]+([^\n]{3,120})", re.IGNORECASE
    ),
    "obrubnik_typ": re.compile(
        r"(?:obrubník|obrub[yůe])[\s:]+([^\n,]{3,60})", re.IGNORECASE
    ),
    "odvodneni": re.compile(
        r"(?:odvodnění|dešťov[áé]\s+kanalizac)[\s:]+([^\n,]{3,80})", re.IGNORECASE
    ),
    "znaceni": re.compile(
        r"(?:dopravní\s+značení|vodorovné\s+značení|svislé\s+značení)[\s:]+([^\n,]{3,60})",
        re.IGNORECASE,
    ),
}


def _extract_doprava(text: str) -> Dict[str, Any]:
    result = {}
    for field, pat in _DOPRAVA_PATTERNS.items():
        m = pat.search(text)
        if m:
            result[field] = m.group(1).strip()
    return result


# ---------------------------------------------------------------------------
# Wrap existing CzechConstructionExtractor as a registry-compatible function
# ---------------------------------------------------------------------------

_cached_extractor = None


def _extract_base_construction(text: str) -> Dict[str, Any]:
    """Wrap CzechConstructionExtractor.extract_all() for registry use."""
    global _cached_extractor
    if _cached_extractor is None:
        try:
            from app.services.regex_extractor import CzechConstructionExtractor
            _cached_extractor = CzechConstructionExtractor()
        except ImportError:
            return {}
    return _cached_extractor.extract_all(text)


def _extract_norms(text: str) -> Dict[str, Any]:
    """Wrap RegexNormExtractor for registry use."""
    try:
        from app.services.regex_norm_extractor import RegexNormExtractor
        result = RegexNormExtractor.extract_all(text)
        return result.dict() if hasattr(result, "dict") else {}
    except ImportError:
        return {}


# ---------------------------------------------------------------------------
# THE REGISTRY
# ---------------------------------------------------------------------------

EXTRACTOR_REGISTRY: List[ExtractorEntry] = [
    # --- Base (always relevant) ---
    ExtractorEntry("base_construction", "Beton, výztuž, rozměry, speciální požadavky", _extract_base_construction),
    ExtractorEntry("norms", "Normy, tolerance, lhůty, materiály", _extract_norms),

    # --- Imported from so_type_regex (dopravní stavby) ---
    ExtractorEntry("road_params", "Pozemní komunikace", extract_road_params),
    ExtractorEntry("traffic_params", "DIO (dopravně-inženýrská opatření)", extract_dio_params),
    ExtractorEntry("water_params", "Vodohospodářské stavby", extract_water_params),
    ExtractorEntry("vegetation_params", "Vegetační úpravy", extract_vegetation_params),
    ExtractorEntry("electro_params", "Elektro přeložky", extract_electro_params),
    ExtractorEntry("pipeline_params", "Plynovody / produktovody přeložky", extract_pipeline_params),

    # --- Imported from so_type_regex (D.1.4 profese) ---
    ExtractorEntry("silnoproud_params", "Silnoproudé instalace", extract_silnoproud_params),
    ExtractorEntry("slaboproud_params", "Slaboproudé systémy", extract_slaboproud_params),
    ExtractorEntry("vzt_params", "Vzduchotechnika a klimatizace", extract_vzt_params),
    ExtractorEntry("zti_params", "Zdravotně technické instalace", extract_zti_params),
    ExtractorEntry("ut_params", "Ústřední topení", extract_ut_params),

    # --- Imported from so_type_regex (railway) ---
    ExtractorEntry("zel_svrsek_params", "Železniční svršek", extract_zel_svrsek_params),
    ExtractorEntry("zel_spodek_params", "Železniční spodek", extract_zel_spodek_params),
    ExtractorEntry("igp_params", "Inženýrskogeologický průzkum", extract_igp_params),

    # --- New domains ---
    ExtractorEntry("zdivo", "Zdivo a zděné konstrukce", _extract_zdivo),
    ExtractorEntry("strecha", "Střešní konstrukce", _extract_strecha),
    ExtractorEntry("podlahy", "Podlahové konstrukce", _extract_podlahy),
    ExtractorEntry("etics", "ETICS / KZS (kontaktní zateplení)", _extract_etics),
    ExtractorEntry("okna_dvere", "Okna a dveře", _extract_okna),
    ExtractorEntry("sdk", "Sádrokartonové konstrukce", _extract_sdk),
    ExtractorEntry("hydroizolace", "Hydroizolace (spodní stavba)", _extract_hydro),
    ExtractorEntry("plynovod", "Plynovodní instalace", _extract_plyn),
    ExtractorEntry("mar", "Měření a regulace (MaR)", _extract_mar),
    ExtractorEntry("most", "Mostní konstrukce", _extract_most),
    ExtractorEntry("doprava_doplneni", "Dopravní stavby (skladba, značení)", _extract_doprava),
]

# Quick lookup by key
REGISTRY_BY_KEY: Dict[str, ExtractorEntry] = {e.key: e for e in EXTRACTOR_REGISTRY}


def get_registry() -> List[ExtractorEntry]:
    """Return the full extractor registry. Engine imports this."""
    return EXTRACTOR_REGISTRY
