"""Item schema for hk212 Phase 1 Etapa 1.

Implements §5 mandatory field set: union of Libuše ``items_objekt_D_complete.json``
base fields and the RTS Rozpočet 25-column wrapper extensions documented in the
Rožmitál precedent analysis (commit ``ba22349d``).

All items emitted by Phase 1 generators must pass ``validate()`` before being
dumped to ``items_hk212_etap1.json``.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

KAPITOLA_VALUES = {
    "HSV-1", "HSV-2", "HSV-3", "HSV-9",
    "PSV-71x", "PSV-76x", "PSV-77x", "PSV-78x",
    "M", "VRN", "VZT",
}

SO_VALUES = {
    "SO-01", "SO-02", "SO-03", "SO-04", "SO-05", "SO-06",
    "SO-07", "SO-08", "SO-09", "SO-10", "SO-11",
}

URS_STATUS_VALUES = {
    "matched_exact", "matched_high", "matched_medium",
    "needs_review", "custom_item",
}

STATUS_FLAG_VALUES = {
    "working_assumption",
    "concept_pending_drawings",
    "concept_pending_vzt_drawings",
    "variant_pending_IGP",
    "placeholder_engineering_estimate",
    "specifikace_pending_strojaru",
}

DATA_SOURCE_VALUES = {
    "TZ_only", "TZ+DXF", "engineering_estimate", "precedent_pattern", "DXF_only",
}

EXPORT_WRAPPER_HINT_VALUES = {
    None, "kros_komplet_compatible", "requires_rts_wrapper",
}

VALID_MJ = {"m", "m²", "m³", "kg", "t", "ks", "bm", "kpl", "paušál", "t·km", "m·km", "měsíc", "soubor"}


@dataclass
class Item:
    """Single soupis položka per §5."""
    id: str
    kapitola: str
    SO: str
    popis: str
    mj: str
    mnozstvi: float
    urs_code: str | None
    urs_alternatives: list[dict[str, Any]]
    urs_status: str
    urs_match_score: float
    skladba_ref: str | None
    source: str
    raw_description: str
    confidence: float
    subdodavatel_chapter: str
    _vyjasneni_ref: list[str] = field(default_factory=list)
    _status_flag: str | None = None
    _data_source: str = "TZ+DXF"
    _completeness: float = 1.0
    _qty_formula: str = ""
    _export_wrapper_hint: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate(item: Item) -> list[str]:
    """Return a list of validation errors. Empty list = valid."""
    errors: list[str] = []
    if not item.id or not isinstance(item.id, str):
        errors.append("id missing or wrong type")
    if item.kapitola not in KAPITOLA_VALUES:
        errors.append(f"kapitola {item.kapitola!r} not in {sorted(KAPITOLA_VALUES)}")
    if item.SO not in SO_VALUES:
        errors.append(f"SO {item.SO!r} not in {sorted(SO_VALUES)}")
    if not item.popis or len(item.popis) < 4:
        errors.append("popis missing or too short")
    if item.mj not in VALID_MJ:
        errors.append(f"mj {item.mj!r} not in valid MJ set")
    if not isinstance(item.mnozstvi, (int, float)) or item.mnozstvi <= 0:
        errors.append(f"mnozstvi {item.mnozstvi!r} not a positive number")
    if item.urs_code is not None and not isinstance(item.urs_code, str):
        errors.append("urs_code must be str or None")
    if item.urs_code is not None and not item.urs_code.replace("R", "").isdigit():
        # Custom Rpol-style codes are allowed; pure URS codes must be all digits
        if not (item.urs_code.startswith("Rpol") or item.urs_code.endswith("R")):
            errors.append(f"urs_code {item.urs_code!r} not 9-digit URS nor Rpol* pattern")
    if item.urs_status not in URS_STATUS_VALUES:
        errors.append(f"urs_status {item.urs_status!r} not in {sorted(URS_STATUS_VALUES)}")
    if not (0.0 <= item.urs_match_score <= 1.0):
        errors.append(f"urs_match_score {item.urs_match_score!r} out of range")
    if not (0.0 <= item.confidence <= 1.0):
        errors.append(f"confidence {item.confidence!r} out of range")
    if item.confidence < 0.30:
        errors.append(f"confidence {item.confidence} below §10 hard-fail threshold 0.30")
    if item._status_flag is not None and item._status_flag not in STATUS_FLAG_VALUES:
        errors.append(f"_status_flag {item._status_flag!r} not in {sorted(STATUS_FLAG_VALUES)}")
    if item._data_source not in DATA_SOURCE_VALUES:
        errors.append(f"_data_source {item._data_source!r} not in {sorted(DATA_SOURCE_VALUES)}")
    if item._export_wrapper_hint not in EXPORT_WRAPPER_HINT_VALUES:
        errors.append(f"_export_wrapper_hint {item._export_wrapper_hint!r} not in valid set")
    if not (0.0 <= item._completeness <= 1.0):
        errors.append(f"_completeness {item._completeness!r} out of range")
    if not isinstance(item._vyjasneni_ref, list):
        errors.append("_vyjasneni_ref must be a list")
    if not item.source:
        errors.append("source missing")
    if not item.raw_description:
        errors.append("raw_description missing")
    if not item.subdodavatel_chapter:
        errors.append("subdodavatel_chapter missing")
    return errors


# Provisional subdodavatel mapping per chapter (§2 default)
SUBDOD_BY_KAPITOLA = {
    "HSV-1": "zemni_prace",
    "HSV-2": "GD_zaklady_beton",
    "HSV-3": "OK_dodavka_montaz",
    "HSV-9": "GD_vodorovne_dopravy",
    "PSV-71x": "izolace",
    "PSV-76x": "zamecnik_vrata_okna",
    "PSV-77x": "podlahy_specialista",
    "PSV-78x": "klempir",
    "M": "specialista_anchorage_strojaru",
    "VRN": "GD_provoz",
    "VZT": "VZT_dodavatel",
}


# Kapitola → URS prefix hint for matcher (URS first-digits routing)
URS_PREFIX_BY_KAPITOLA = {
    "HSV-1": "1",       # 1xx Zemní práce
    "HSV-2": "27",      # 27x Železobeton + 2xx Základy
    "HSV-3": "13",      # 13x: typical Czech URS for ocelové konstrukce contained in 1xx hloubení rejected;
                         # actual OK is in section ranges 13x/76x — fallback to broader "1" if 13 empty
    "HSV-9": "998",     # přesun hmot
    "PSV-71x": "711",   # hydroizolace
    "PSV-76x": "76",    # zámečnické
    "PSV-77x": "77",    # podlahy
    "PSV-78x": "78",    # klempířské
    "M": None,          # custom anchorage — typically no URS catalog match (Rpol*)
    "VRN": "005",       # VRN 00xxx
    "VZT": "73",        # VZT 73x
}


def default_so_for_kapitola(kapitola: str) -> str:
    """Map kapitola → default SO per §13 11-SO skeleton."""
    return {
        "HSV-1": "SO-01",
        "HSV-2": "SO-01",
        "HSV-3": "SO-01",
        "HSV-9": "SO-01",
        "PSV-71x": "SO-01",
        "PSV-76x": "SO-01",
        "PSV-77x": "SO-01",
        "PSV-78x": "SO-01",
        "M": "SO-10",
        "VRN": "SO-11",
        "VZT": "SO-05",
    }.get(kapitola, "SO-01")
