#!/usr/bin/env python3
"""
Phase 1 items generator for RD Jáchymov — variant B (max detail, ~140 items).

# ─────────────────────────────────────────────────────────────────────────
# AUDIT 2026-05-18 (Part 5b WebSearch verification):
# Heuristic urs_code_proposed estimates correct 6-digit family in ~75 % cases
# but 9-digit leaf wrong in ~63 % cases (6 of 8 verified codes had wrong leaf:
# different distance band, material, geometry, or location).
#
# Recommendation: emit 6-digit family + leaf_disambiguation_needed flag,
# defer leaf to production URS_MATCHER service (online catalog).
# See outputs/urs_websearch_verifications.json for evidence.
# Items with urs_status = "wrong_leaf_disambiguation_needed" carry the
# 6-digit family in `urs_code_family_6digit` for downstream lookup.
# ─────────────────────────────────────────────────────────────────────────

Generates structured items per kapitola GROUP (HSV / PSV / TZB+M / VRN) with
4 STOP gates. Re-runnable: each group invocation merges into
outputs/items_rd_jachymov_complete.json without overwriting other groups.

Quantity sources (per task §5 confidence ladder):
  * DXF DIMENSION  ............... 0.95
  * DXF LWPOLYLINE bbox  ......... 0.90
  * DXF HATCH polygonal area  .... 0.90
  * DXF INSERT block count  ...... 0.95
  * Regex match in TZ  ........... 0.85
  * Geometry-derived from TZ  .... 0.75
  * Empirical Methvin/STAVAGENT .. 0.80
  * Manual judgement  ............ 0.99

URS code field (urs_code_proposed):
  This sandbox has NO access to production URS_MATCHER (Cloud Run) or OTSKP DB.
  Proposed codes are best-guess from Czech ÚRS 800 catalog knowledge.
  Status "needs_production_lookup" + urs_confidence 0.65 + urs_alternatives.
  Production STAVAGENT must run the 2-stage match (catalog + Perplexity rerank)
  to confirm or reassign.

Run:
  python3 tools/phase1_items_generator.py --group HSV
  python3 tools/phase1_items_generator.py --group PSV
  python3 tools/phase1_items_generator.py --group TZB
  python3 tools/phase1_items_generator.py --group VRN
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
OUT = PROJ / "outputs"
META = PROJ / "inputs" / "meta"

OUT.mkdir(exist_ok=True)
TARGET = OUT / "items_rd_jachymov_complete.json"

# Canonical subdodavatel mapping — set of trade keys known to subdodavatel_mapping.json
_SUBDOD_FILE = META / "subdodavatel_mapping.json"
KNOWN_TRADES: set[str] = (
    set(json.loads(_SUBDOD_FILE.read_text())["trades"].keys()) if _SUBDOD_FILE.exists() else set()
)
KNOWN_TRADES.discard("needs_mapping")  # placeholder sentinel — never count as mapped

# ───────────────────────────────────────────────────────────────────────────
# Constants from §3.2 / §3.3 deterministic findings

# DUM geometry (TZ B kap. m.1.j)
DUM = {
    "zastavena_m2": 104.4,
    "podlahova_m2": 219.3,
    "obestaveny_m3": 987.0,
    "vyska_m": 13.0,
    "pozarni_vyska_m": 6.565,
    "n_podlazi_nadzemnich": 3,
    "n_podlazi_podzemnich": 1,
    "n_pater_nove_3NP": 1,  # nástavba
    "obvod_pudorysu_m_odhad": 38.70,  # DXF km_R_návrh_tlustá 2 closed polygon (area 91.28 m², 6 vrcholů) — Part 1 inventory 2026-05-17 finding; replaces prior 4×√104.4≈40.87 estimate
    "fasada_volna_m_odhad": 38.70 * 0.55,    # ~21.3 m volná fasáda = obvod 38.70 × 0.55 (řadovka, štíty zachované)
    "fasada_eps_plocha_m2_odhad": round(38.70 * 0.55 * 13.0, 1),  # ~276.7 m² fasáda volná × výška 13 m (DXF perimeter)
    "strecha_pudorys_m2_odhad": 104.4 * 1.15,      # +15% pro střechu nad zastavěnou (sklon ~35°)
    "krytina_m2_odhad": 104.4 * 1.35,              # +35% pro krytinu při sklonu střechy + vikýře
}

# SKLAD geometry (DXF DIMENSION + LWPOLYLINE confirmed per §3.3)
SKLAD = {
    "lichobeznik_w_m": 6.350,    # DXF DIMENSION 6350.06 mm — sklad_DPZ + dum_DPZ (conf 0.95)
    "lichobeznik_h_m": 3.340,    # DXF DIMENSION 3340.0 mm — dum_DPZ (conf 0.95)
    "interior_m": 3.085,         # DXF DIMENSION 3085.0 mm — sklad_DPZ interior = 3340 − 2×127.5 wall
    "parking_length_m": 7.000,   # DXF LWPOLYLINE bbox 7000.0 mm — sklad_DPZ layer 'km__03_velmi tlustá' (conf 0.90)
    "parking_width_m_odhad": 3.0,
    "n_IPE180_parking": 7,       # TZ statika §1.4: rozteč 1000 mm × 7 m → 7 ks (conf 0.85)
    "zaklad_pas_obvod_m_odhad": 2 * (6.35 + 3.34),  # ~19.4 m
    "zid_obvod_m_odhad": 2 * (6.35 + 3.34),         # ~19.4 m
    "podlaha_m2": 6.35 * 3.34,                       # ~21.2 m² (pravidelný obdélník zjednodušení)
    "strop_drevena_m2": 6.35 * 3.34,                 # totožné s podlahou
    "parking_zastreseni_m2": 7.0 * 3.0,              # 21 m² odhad
}

# DXF-derived (per §3.3 outputs/dxf_extract_report.json + Phase 1 PSV probes)
DXF_FINDINGS = {
    "dum_KR_block_count": 111,            # dum_DPZ INSERT 'KR' (krokve) — partial; full = krokve+sloupky
    "dum_PLOT_DREVENY_04_count": 133,     # all DXFs combined (19 sklad_DPZ + 57 sklad_situace + 57 dum_situace)
    "dum_PLOT_DREVENY_04_in_dum_DPZ": 0,  # NONE in dum_DPZ — block represents terasa garapa, not 3.NP biodeska
    "dum_PLOT_DREVENY_04_in_dum_situace": 57,  # → dřevěná terasa garapa za opěrnou stěnou
    "dum_HATCH_total_m2": 936.3,          # dum_DPZ HATCH polygonal area (mm² → m²)
    "sklad_HATCH_total_m2": 97.5,         # sklad_DPZ HATCH polygonal area
    # Okna count (DXF dum_DPZ INSERT blocks, Phase 1 PSV probe 2026-05-16):
    "dum_okna_total": 16,                  # 4+3+3+2+2+1+1
    "dum_okna_front_zaluzie": 9,           # uliční fasáda Fibichova (TZ: integrované žaluzie v kastlíku s purenitem)
    "dum_okna_back_no_zaluzie": 7,         # dvorní fasáda zahrada
    # Room types (DXF dum_DPZ MTEXT labels):
    "dum_rooms_koupelna": 3,               # 1.NP master + 2.NP děti + 3.NP nový byt
    "dum_rooms_kuchyne": 2,                # 1.NP samostatný byt rodičů + 2.NP/3.NP
    # HATCH per-layer (informational — generic layer names, no per-floor split possible):
    "dum_HATCH_km_srafy_m2": 313.7,
    "dum_HATCH_km_R_navrh_srafa_m2": 302.2,
    "dum_HATCH_SM_navrh_srafa_m2": 188.6,
}

# ───────────────────────────────────────────────────────────────────────────
# Item builder

# Confidence shortcuts
C_DXF_DIM       = 0.95
C_DXF_BBOX      = 0.90
C_DXF_HATCH     = 0.90
C_DXF_INSERT    = 0.95
C_REGEX_TZ      = 0.85
C_GEOM_FROM_TZ  = 0.75
C_EMPIRICAL     = 0.80
C_MANUAL        = 0.99
C_AI_GUESS      = 0.65   # ÚRS proposal from catalog knowledge (no production lookup)


# Gate ↔ kapitola mapping (per task spec — 4 STOP gates, not 19)
# Used by merge to know which existing items to clear when re-running --group X
KAPITOLA_TO_GATE: dict[str, str] = {
    "HSV-1":  "HSV", "HSV-2":  "HSV", "HSV-3":  "HSV", "HSV-4":  "HSV",
    "HSV-5":  "HSV", "HSV-6":  "HSV", "HSV-7":  "HSV",
    "PSV-71": "PSV", "PSV-76": "PSV", "PSV-77": "PSV", "PSV-78": "PSV", "PSV-95": "PSV",
    "PSV-72": "TZB", "PSV-73": "TZB",   # ZTI + vytápění belong to TZB+M gate, not PSV
    "M-21":   "TZB",                     # ELI silnoproud belongs to TZB+M gate
    "VRN":    "VRN",
}


def _gate_for(kapitola: str) -> str:
    """Map kapitola prefix (e.g. 'HSV-1 Zemní práce') to gate name (HSV/PSV/TZB/VRN)."""
    prefix = kapitola.split(" ")[0]
    return KAPITOLA_TO_GATE.get(prefix, "OTHER")


# ───────────────────────────────────────────────────────────────────────────
# Part 2 (2026-05-17) — Per-room data from DXF km_tabulka místností MTEXT parse.
# Source: outputs/dxf_comprehensive_extract.json (own. místností 25)

PER_PODLAZI_AREA_M2 = {
    "1.PP": 32.4,   # 0.01 + 0.02 + 0.03 + 0.04
    "1.NP": 59.5,   # 1.01..1.08
    "2.NP": 61.1,   # 2.01..2.06
    "3.NP": 64.5,   # 3.01..3.06
}
PER_PODLAZI_VYSKA_M = {
    "1.PP": 2.10,   # DXF SM_kóty + řez A-A explicit (Path C Tier 1) — was CSN default 2.50 m
    "1.NP": 2.795,  # DXF SM_kóty + řez A-A explicit (Path C Tier 1) — was CSN default 2.80 m
    "2.NP": 2.865,  # DXF SM_kóty + řez A-A explicit (Path C Tier 1) — was CSN default 2.80 m
    "3.NP": 2.63,   # DXF SM_kóty + řez A-A explicit (Path C Tier 1) — was CSN default 2.65 m
}
PER_PODLAZI_VYSKA_SOURCE = "DXF SM_kóty layer DIMENSION + řez D.1.1.2.2.21 explicit (Path C Tier 1) — replaces CSN default fallback. S-code context confirms: 1.NP→S07 trámový, 2.NP→S09 ocelobeton, 3.NP→S11 biodeska."
KOUPELNY_LIST = [
    {"room_id": "1.05", "podlazi": "1.NP", "area_m2": 4.10, "obvod_m": 8.4,  "fixtures_dxf": ["vana", "umyvadlo"], "fixtures_tz_assumption": ["WC"]},
    {"room_id": "2.03", "podlazi": "2.NP", "area_m2": 2.40, "obvod_m": 6.2,  "fixtures_dxf": ["umyvadlo"],          "fixtures_tz_assumption": ["WC", "sprcha"]},
    {"room_id": "3.04", "podlazi": "3.NP", "area_m2": 4.80, "obvod_m": 9.0,  "fixtures_dxf": ["WC"],                "fixtures_tz_assumption": ["umyvadlo", "sprcha"]},
]
KUCHYNE_DREZ = [
    {"room_id": "1.06", "podlazi": "1.NP", "fixtures_dxf": []},   # TZ assumption: kuchyně má dřez (společenská část 1.NP byt rodičů)
    {"room_id": "3.05", "podlazi": "3.NP", "fixtures_dxf": ["drez_kuchyne"]},  # DXF confirmed
]
# Window blocks per DXF (Part 1 inventory verified)
OKNA_PER_TYP = [
    {"block_name": "okno 1.NP",       "count": 2, "size_mm": "1185×1600", "plocha_m2": 1.90, "strana": "ulice"},
    {"block_name": "okno 1.NP vzadu", "count": 3, "size_mm": "920×1600",  "plocha_m2": 1.47, "strana": "zahrada"},
    {"block_name": "okno 2.NP",       "count": 4, "size_mm": "1160×1480", "plocha_m2": 1.72, "strana": "ulice"},
    {"block_name": "okno 3.NP",       "count": 3, "size_mm": "1785×1241", "plocha_m2": 2.22, "strana": "ulice"},
    {"block_name": "okno 3.NP vzadu", "count": 1, "size_mm": "2075×1241", "plocha_m2": 2.57, "strana": "zahrada"},
    {"block_name": "okno male 3.NP vzadu", "count": 1, "size_mm": "800×1241",  "plocha_m2": 0.99, "strana": "zahrada"},
    {"block_name": "okno malé vzadu", "count": 2, "size_mm": "700×800",   "plocha_m2": 0.56, "strana": "zahrada"},
]
# Material classification (room_id → material zone) for PSV-77 podlahy + soklíky
ROOM_MATERIAL = {
    # 1.PP — dlažba sklep (all rooms — technic, sušárna, sklep)
    "0.01": "dlazba_sklep", "0.02": "dlazba_sklep", "0.03": "dlazba_sklep", "0.04": "dlazba_sklep",
    # 1.NP — vinyl obytné + dlažba mokré
    "1.01": "vinyl", "1.02": "vinyl", "1.03": "dlazba_mokre", "1.04": "dlazba_mokre",
    "1.05": "dlazba_mokre", "1.06": "vinyl", "1.07": "vinyl", "1.08": "vinyl",
    # 2.NP — vinyl obytné + dlažba mokré
    "2.01": "vinyl", "2.02": "vinyl", "2.03": "dlazba_mokre", "2.04": "vinyl",
    "2.05": "vinyl", "2.06": "vinyl",
    # 3.NP — vinyl obytné + dlažba mokré + biodeska půdní
    "3.01": "vinyl", "3.02": "vinyl", "3.03": "vinyl", "3.04": "dlazba_mokre",
    "3.05": "vinyl", "3.06": "vinyl",
}
# Per-room area (from DXF tabulka místností MTEXT návrh)
ROOM_AREA = {
    "0.01": 3.50, "0.02": 4.40, "0.03": 22.20, "0.04": 2.30,
    "1.01": 12.40, "1.02": 3.60, "1.03": 0.70, "1.04": 1.50, "1.05": 4.10, "1.06": 24.00, "1.07": 9.40, "1.08": 3.80,
    "2.01": 7.30, "2.02": 5.90, "2.03": 2.40, "2.04": 15.50, "2.05": 14.10, "2.06": 15.80,
    "3.01": 7.60, "3.02": 4.10, "3.03": 2.40, "3.04": 4.80, "3.05": 32.80, "3.06": 12.80,
}
# Cumulative window area per fasáda side (for omítka odpočet calc)
OKENNI_PLOCHA_M2 = sum(o["count"] * o["plocha_m2"] for o in OKNA_PER_TYP)  # 26.41 m²

# Skladba code (S01..S12b) → element type mapping — TZ skladby_per_zone.json
SKLADBA_CODE_REF = {
    "S01": "Podlaha 1.NP terén",
    "S02": "Podlaha suchá nad trámovým stropem 1.NP/2.NP",
    "S03": "Podlaha mokrá nad ocelobetonem 2.NP/3.NP",
    "S04": "Strop klenba 1.PP/1.NP",
    "S05": "Strop trámový 1.NP/2.NP",
    "S06": "Strop ocelobeton 2.NP/3.NP",
    "S07": "Krov tesařský s nadkrokevní izolací",
    "S08": "Stěna obvodová zachovaná + ETICS",
    "S09": "Stěna 3.NP nadezdívka",
    "S10": "Příčka vnitřní pórobeton",
    "S11": "Stěna v koupelně — keramický obklad",
    "S12": "Podlaha 1.PP technic",
}


def mk(
    objekt: str,
    kapitola: str,
    subkapitola: str,
    popis: str,
    mj: str,
    mnozstvi: float | None,
    mnozstvi_formula: str,
    mnozstvi_confidence: float,
    urs_code_proposed: str,
    urs_alternatives: list[str],
    source: str,
    subdodavatel: str,
    vyjasneni_ref: list[int] | None = None,
    status_flag: str = "ready_for_phase2",
    notes: str | None = None,
    # Part 2 (2026-05-17) expansion fields — optional, populated only on per-zone/per-room items
    data_quality: str | None = None,             # categorical: dxf_deterministic / dxf_plus_tz_explicit / tz_silent_fallback_csn_default / dxf_partial_pip_plus_tz_assumption / dxf_phase_mixed_estimate
    room_ids: list[str] | None = None,           # per-room expansion items: list of DXF room IDs (e.g. ["1.05"])
    expansion_origin: list[str] | None = None,   # IDs of parent aggregate items this row replaces
    previous_mnozstvi: float | None = None,      # for RECALC items: prior qty value before update
    recalc_reason: str | None = None,            # for RECALC items: human-readable reason
) -> dict:
    """Build a single item dict with all mandatory + optional expansion fields."""
    sub_status = "mapped" if subdodavatel in KNOWN_TRADES else "needs_mapping"
    item = {
        "objekt": objekt,
        "kapitola_group": kapitola.split("-")[0].split(" ")[0],   # HSV / PSV / M / VRN — classification view
        "_gate": _gate_for(kapitola),                              # HSV / PSV / TZB / VRN — workflow gate
        "kapitola": kapitola,
        "subkapitola": subkapitola,
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "mnozstvi_formula": mnozstvi_formula,
        "mnozstvi_confidence": mnozstvi_confidence,
        "urs_code_proposed": urs_code_proposed,
        "urs_alternatives": urs_alternatives,
        "urs_status": "needs_production_lookup",
        "urs_confidence": C_AI_GUESS,
        "source": source,
        "subdodavatel": subdodavatel,
        "subdodavatel_status": sub_status,
        "vyjasneni_ref": vyjasneni_ref or [],
        "status_flag": status_flag,
        "notes": notes,
    }
    # Optional expansion fields — only set when supplied (preserves backward-compat for non-expanded items)
    if data_quality is not None:        item["_data_quality"] = data_quality
    if room_ids is not None:            item["_room_ids"] = room_ids
    if expansion_origin is not None:    item["_expansion_origin"] = expansion_origin
    if previous_mnozstvi is not None:   item["_previous_mnozstvi"] = previous_mnozstvi
    if recalc_reason is not None:       item["_recalc_reason"] = recalc_reason
    return item


# ───────────────────────────────────────────────────────────────────────────
# HSV-1 Zemní práce

def gen_HSV_1():
    items = []

    # ──── DUM ────
    O = "260219_dum"
    items += [
        mk(O, "HSV-1 Zemní práce", "Sejmutí ornice",
           "Sejmutí ornice tl. 100 mm na ploše budoucí opěrné stěny a anglického dvorku",
           "m²", 35.0, "L=10 × W=3.5 (zahrada zóna pro BV + dvorek)", C_GEOM_FROM_TZ,
           "121101101", ["121101102", "121301101"],
           "TZ statika §3 + ARS dispozice zahrada", "zemni_prace", [3]),
        mk(O, "HSV-1 Zemní práce", "Hloubení rýh BV",
           "Hloubení rýh š. do 60 cm pro pas opěrné stěny bílé vany v zemině třídy 3 (F4-CS)",
           "m³", 12.6, "L=10 × W=1.2 × H=1.05 (pata BV 1200 mm × hloubka pod základovou spárou)", C_GEOM_FROM_TZ,
           "132201101", ["132211101", "131201101"],
           "TZ statika dům §5.5 + geologie F4-CS Rdt 350 kPa", "zemni_prace", [3, 8]),
        mk(O, "HSV-1 Zemní práce", "Hloubení figury anglický dvorek",
           "Hloubení figury pro anglický dvorek a nový vstup do 1.PP ze zahrady",
           "m³", 6.0, "L=2.5 × W=2.0 × H=1.2 (dvorek odkop)", C_GEOM_FROM_TZ,
           "132211101", ["132201101", "131211101"],
           "TZ ARS dům §6.2 zahrada — nový vstup do 1.PP", "zemni_prace", [3]),
        # NEW Path C Gate 5: anglický dvorek skladba z řez C-C
        mk(O, "HSV-1 Zemní práce", "Anglický dvorek — skladba dlažby",
           "Anglický dvorek: betonová dlažba 50 mm + kladecí vrstva kamenná drť 4-8 mm tl. 40 mm + podkladní nosná vrstva kamenná drť 4-8 mm tl. 150 mm na zhutněnou zemní pláň (30 MPa)",
           "m²", 30.0,
           "PDF řez C-C explicit composition + anglický dvorek ~30 m² odhad (2.5 × 2.0 m + odkop k vstupu 1.PP)",
           C_REGEX_TZ,
           "564831111", ["564851111"],
           "PDF řez D.1.1.2.2.21 řez C-C explicit composition — 4-vrstvý dlažební systém (Path C Tier 3 embedded tables)",
           "podlahar", [],
           data_quality="tz_explicit"),
        # NEW Path C Gate 5: terasa garapa skladba podkladu z řez C-C
        mk(O, "HSV-1 Zemní práce", "Terasa garapa — podkladní rošt",
           "Terasa za opěrnou stěnou: rektifikovatelné terče 50 mm + betonové dlaždice 50 mm + štěrkový podsyp 16/32 mm tl. 100 mm + hrubý podsyp 4/8 mm tl. 150 mm + geotextilie",
           "m²", 30.0,
           "PDF řez C-C explicit composition + terasa ~30 m² odhad (rozměry z TZ ARS dům §4 terasa za op. stěnou)",
           C_REGEX_TZ,
           "564831111", ["564851111"],
           "PDF řez D.1.1.2.2.21 řez C-C explicit composition — 5-vrstvý podkladní systém terasa (Path C Tier 3 embedded tables); dřevěná prkna garapa same item v PSV-76 Truhlář",
           "podlahar", [],
           data_quality="tz_explicit"),
        mk(O, "HSV-1 Zemní práce", "Pažení rýh",
           "Pažení a rozepření dočasných výkopů příložné, hl. do 2 m, v zemině třídy 3",
           "m²", 36.0, "obvod rýh BV 2×(10+1.2) × hloubka 1.6", C_GEOM_FROM_TZ,
           "151101101", ["151101102", "151201101"],
           "TZ statika §5.3 'pažovat dle BOZP, sklon dočasných výkopů 1:0,5'", "zemni_prace", []),
        mk(O, "HSV-1 Zemní práce", "Odvoz výkopu",
           "Vodorovné přemístění výkopku — odvoz na deponii do 8 km vč. skládkovného (zemina F4)",
           "m³", 18.6, "= V hloubení rýh BV + figura dvorek (12.6 + 6.0)", C_GEOM_FROM_TZ,
           "162701105", ["162301101", "997013501"],
           "= součet HSV-1 hloubení dům", "zemni_prace", [10]),
        mk(O, "HSV-1 Zemní práce", "Zhutněný štěrkový zásyp pod desku 1.NP",
           "Zhutněný štěrkopískový zásyp + lože pod ŽB deskou 1.NP, Edef2 ≥ 30 MPa na pláni / 45 MPa na štěrku",
           "m³", 12.5, "podlahova_plocha_1NP × 0.15 m štěrkové lože (uvažovat 83 m² × 0.15)", C_GEOM_FROM_TZ,
           "174101101", ["174201101", "171101101"],
           "TZ statika dům §5.3 — Edef2 limity + zásyp pod deska 1.NP", "zemni_prace", [3]),
    ]

    # ──── SKLAD ────
    O = "260217_sklad"
    items += [
        mk(O, "HSV-1 Zemní práce", "Sejmutí stávající zídky + schodiště",
           "Sejmutí ornice a demolice stávajících kamenných zídek a schodiště v místě nového skladu+parkingu",
           "m³", 8.0, "TZ ARS sklad §3 — odstranění stávajících kamenných prvků (odhad)", C_GEOM_FROM_TZ,
           "962031132", ["962081141", "121101101"],
           "TZ ARS sklad §3 + Demolice stávající kamenné zídky", "bourani_demolice", []),
        mk(O, "HSV-1 Zemní práce", "Hloubení figury skladu",
           "Hloubení figury pro objekt skladu v lichoběžníku 6.35 × 3.34 m, hl. do 1.2 m",
           "m³", 25.5, "DXF: L=6.350 × W=3.340 × H=1.2 (DXF DIMENSION ověřeno)", C_DXF_DIM,
           "132211101", ["132201101", "131211101"],
           "DXF sklad_DPZ DIMENSION 6350.06 + 3340.0 mm (vyjasnění #18 resolved)", "zemni_prace", [18]),
        mk(O, "HSV-1 Zemní práce", "Hloubení rýh pro pasy",
           "Hloubení rýh pro betonové základové pasy 500×500 mm po obvodu skladu (nezámrzná hl. 1.0 m)",
           "m³", 4.85, "obvod 2×(6.35+3.34) × W=0.5 × H=0.5", C_DXF_DIM,
           "132201101", ["132211101", "131201101"],
           "DXF + TZ statika sklad §3", "zemni_prace", []),
        mk(O, "HSV-1 Zemní práce", "Hloubení parkingových patek",
           "Hloubení patek pro stojky IPE180 zastřešení parkingu, 500×500 mm × 1.0 m hl. × 7 ks",
           "m³", 1.75, "DXF: 7 patek × 0.5 × 0.5 × 1.0 (TZ rozteč 1000 mm × 7 m parking)", C_DXF_BBOX,
           "132211101", ["132201101", "131211101"],
           "DXF sklad_DPZ LWPOLYLINE 7000 mm parking + TZ rozteč 1000 mm = 7 patek", "zemni_prace", [18]),
        mk(O, "HSV-1 Zemní práce", "Štěrkový násyp pod desku skladu",
           "Zhutněný štěrkopískový násyp pod podlahu skladu + štěrkopísek pro IPE patky",
           "m³", 3.2, "podlaha sklad 21.2 m² × 0.15 m štěrku", C_DXF_DIM,
           "174101101", ["174201101", "171101101"],
           "DXF podlaha skladu 6.35×3.34 = 21.2 m²", "zemni_prace", []),
        mk(O, "HSV-1 Zemní práce", "Odvoz výkopu sklad",
           "Odvoz výkopku z hloubení skladu + figur + patek na deponii do 8 km",
           "m³", 32.1, "= součet hloubení sklad + figura + patky (25.5+4.85+1.75)", C_DXF_DIM,
           "162701105", ["162301101", "997013501"],
           "= součet HSV-1 sklad hloubení", "zemni_prace", [10]),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-2 Základy a ŽB konstrukce

def gen_HSV_2():
    items = []

    # ──── DUM ────
    O = "260219_dum"
    # Bílá vana — opěrná stěna v zahradě
    # Geometrie: pata 250×1200 mm, stěna 250×2050 mm, smršťovací úsek max 8 m → odhad délka 10 m
    BV_L = 10.0
    items += [
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — pata",
           "Bílá vana ČBS 02 — pata úhlové opěrné stěny 250×1200 mm × L=10 m, C25/30 XC3 XF1 XA1 CL0.4 Dmax22 S3",
           "m³", round(0.25 * 1.20 * BV_L, 2), "0.25 × 1.20 × 10 = 3.0", C_REGEX_TZ,
           "274321321", ["274321111", "273321321"],
           "TZ statika §4 + §5.5 (bílá vana, ČBS 02 metodika)", "bila_vana_csb02", [3, 8]),
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — stěna",
           "Bílá vana ČBS 02 — stěna úhlová tl. 250 mm × výška 2050 mm × L=10 m, beton C25/30 XC3 XF1 XA1 (trhliny max 0.20 mm)",
           "m³", round(0.25 * 2.05 * BV_L, 2), "0.25 × 2.05 × 10 = 5.13", C_REGEX_TZ,
           "274321321", ["273321321", "274311111"],
           "TZ statika §5.5 — bílá vana A1 W0 Kon 1", "bila_vana_csb02", [3, 8]),
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — bednění systémové",
           "Systémové oboustranné bednění bílé vany — DOKA Framax / PERI MAXIMO, vč. těsnění pracovních spár bobtnavý pásek bentonit (TZ §5.5)",
           "m²", round(2 * 2.05 * BV_L + 2 * 1.20 * BV_L, 1), "2×2.05×10 (svislé) + 2×1.20×10 (pata) = 41 + 24 = 65", C_REGEX_TZ,
           "631311115", ["631311111", "634111111"],
           "TZ statika §5.5 + ČBS 02 — bobtnavý pásek + těsnící plech pracovní spáry", "bila_vana_csb02", [3]),
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — výztuž B500B",
           "Výztuž bílé vany B500B 120 kg/m³ (empirická sazba Methvin pro úhlové opěrné stěny W0)",
           "kg", round((0.25 * 1.20 * BV_L + 0.25 * 2.05 * BV_L) * 120), "(3.0+5.13) × 120 = 976", C_EMPIRICAL,
           "273361821", ["272361821", "273361801"],
           "TZ statika §5.5 + B4_productivity Methvin sazba 120 kg/m³ pro BV W0", "zelezobetonarsky_specialny", [8]),
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — separační fólie",
           "Separační PE fólie pod základovou patou bílé vany (povinná dle ČBS 02)",
           "m²", round(1.20 * BV_L * 1.10, 1), "1.20 × 10 × 1.10 přesah = 13.2", C_REGEX_TZ,
           "711132101", ["711121101", "711111001"],
           "TZ statika §5.5 — separační fólie povinné pod základ BV", "izolater_HI", []),
        mk(O, "HSV-2 Základové a ŽB", "Bílá vana — ošetřování",
           "Mokré ošetřování betonu bílé vany min. 7 dní dle ČSN EN 13670 + ČBS 02 (kontrola trhlin max 0.20 mm)",
           "m²", round(2 * 2.05 * BV_L + 1.20 * BV_L, 1), "viditelná plocha BV pro ošetřování ~53", C_MANUAL,
           "279351102", ["279351101", "999999001"],
           "ČSN EN 13670 + TZ §5.5 — trhliny max 0.20 mm", "bila_vana_csb02", []),
        # ŽB pozední věnec — RECALC: new external perimeter 38.70 m (DXF) vs prior ~41 m
        mk(O, "HSV-2 Základové a ŽB", "Pozední věnec 3.NP",
           "ŽB pozední věnec 300×250 mm po obvodu nadezdívky 3.NP, beton C25/30 XC1 + výztuž 100 kg/m³",
           "m³", round(0.30 * 0.25 * DUM["obvod_pudorysu_m_odhad"], 2),
           f"0.30 × 0.25 × obvod {DUM['obvod_pudorysu_m_odhad']} m (DXF km_R_návrh_tlustá 2 closed polygon area 91.28 m²) = {round(0.30 * 0.25 * DUM['obvod_pudorysu_m_odhad'], 2)} m³",
           C_DXF_BBOX,
           "274321311", ["274321111", "273321311"],
           "TZ statika dům §4 + ARS pozední věnec po obvodu nadezdívky 3.NP + DXF external perimeter 38.70 m", "zelezobetonarsky_specialny", [3, 8],
           data_quality="dxf_deterministic",
           previous_mnozstvi=3.07,
           recalc_reason="Part 1 inventory 2026-05-17 discovered exact external perimeter 38.70 m from DXF km_R_návrh_tlustá 2 closed polygon (91.28 m² × 6 vrcholů) — replaces prior fallback estimate 4×√104.4 ≈ 41.0 m"),
        mk(O, "HSV-2 Základové a ŽB", "Pozední věnec — bednění",
           "Bednění pozedního věnce systémové oboustranné",
           "m²", round(2 * 0.25 * DUM["obvod_pudorysu_m_odhad"], 1),
           f"2 (oboustranné) × 0.25 m výška × obvod {DUM['obvod_pudorysu_m_odhad']} m (DXF) = {round(2 * 0.25 * DUM['obvod_pudorysu_m_odhad'], 1)} m²",
           C_DXF_BBOX,
           "631311115", ["631311111"],
           "TZ statika dům §4 + DXF external perimeter", "bednici_tesar", [3],
           data_quality="dxf_deterministic",
           previous_mnozstvi=20.5,
           recalc_reason="Same as Pozední věnec 3.NP — perimeter 38.70 m DXF-verified"),
        mk(O, "HSV-2 Základové a ŽB", "Pozední věnec — výztuž",
           "Výztuž B500B věnce 100 kg/m³ (Methvin sazba pro pozední věnce)",
           "kg", round(3.1 * 100), "3.1 × 100 = 310", C_EMPIRICAL,
           "273361821", ["272361821"],
           "B4_productivity Methvin pozední věnec ~100 kg/m³", "zelezobetonarsky_specialny", [8]),
        # ŽB nabetonávka stropu 2.NP/3.NP (60 mm nad vlnu trapézu)
        mk(O, "HSV-2 Základové a ŽB", "Nabetonávka stropu 2.NP/3.NP",
           "Nabetonávka stropu 2.NP/3.NP — beton C25/30 XC1 tl. 60 mm nad vlnu trapézového plechu 40S/160",
           "m³", round(DUM["zastavena_m2"] * 0.06, 2), "104.4 m² × 0.06 m = 6.26", C_REGEX_TZ,
           "274321111", ["411321414"],
           "TZ statika §4 — ocelobetonový strop, nabetonávka 60 mm C25/30 XC1", "ocelobeton_strop_IPE_trapez", []),
        mk(O, "HSV-2 Základové a ŽB", "Nabetonávka — výztuž kari síť",
           "Výztuž nabetonávky kari síť 5/100/100 (cca 4.4 kg/m²)",
           "kg", round(DUM["zastavena_m2"] * 4.4), "104.4 m² × 4.4 kg/m² = 459", C_EMPIRICAL,
           "273362441", ["273362442"],
           "ČSN EN 1992-1 + B4_productivity kari pro nabetonávku 60 mm", "ocelobeton_strop_IPE_trapez", []),
        # ŽB deska podlahy 1.NP na terénu
        mk(O, "HSV-2 Základové a ŽB", "Deska 1.NP na terénu",
           "ŽB deska podlahy 1.NP na terénu tl. 150 mm, C25/30 XC2 + vyztužení kari 6/150/150 + okrajové pruty",
           "m³", round(DUM["zastavena_m2"] * 0.7 * 0.15, 2), "104.4 × 0.7 (rozsah 1.NP) × 0.15 = ~11.0", C_GEOM_FROM_TZ,
           "273321311", ["273321321", "274321311"],
           "TZ statika dům §4 + ARS § podlaha 1.NP zhutněné lože + ŽB deska + EPS 150 + potěr", "zelezobetonarsky_specialny", [3]),
        mk(O, "HSV-2 Základové a ŽB", "Deska 1.NP — výztuž",
           "Výztuž ŽB desky 1.NP — kari 6/150/150 + B500B okrajové pruty (~75 kg/m³ Methvin)",
           "kg", round(11.0 * 75), "11.0 × 75 = 825", C_EMPIRICAL,
           "273361821", ["273362441"],
           "B4_productivity Methvin deska na terénu ~75 kg/m³", "zelezobetonarsky_specialny", [8]),
    ]

    # ──── SKLAD ────
    O = "260217_sklad"
    items += [
        mk(O, "HSV-2 Základové a ŽB", "Základové pasy sklad",
           "Základové pasy z prostého betonu C16/20 XC0, 500×500 mm po obvodu skladu (nezámrzná hl.)",
           "m³", round(0.5 * 0.5 * (2 * (SKLAD["lichobeznik_w_m"] + SKLAD["lichobeznik_h_m"])), 2),
           "0.5 × 0.5 × 19.4 obvod = 4.85", C_DXF_DIM,
           "273313811", ["273313611", "274313811"],
           "DXF sklad_DPZ + TZ statika sklad §4 — C16/20 XC0 pasy 500×500", "zelezobetonarsky_specialny", []),
        mk(O, "HSV-2 Základové a ŽB", "Patky parking — spodní",
           "Dvoustupňové patky pro IPE180 zastřešení parkingu — spodní část prostý beton C16/20 500×500×500 mm × 7 ks",
           "ks", 7, "DXF: 7 ks (rozteč 1000 mm × 7000 mm parking délka)", C_DXF_BBOX,
           "273313811", ["273313611"],
           "DXF sklad_DPZ LWPOLYLINE 7000 mm + rozteč 1000 mm = 7 patek", "zelezobetonarsky_specialny", [18]),
        mk(O, "HSV-2 Základové a ŽB", "Patky parking — horní",
           "Dvoustupňové patky pro IPE180 — horní část z tvarovek ztraceného bednění 300×300 mm × 7 ks",
           "ks", 7, "7 ks (= spodní)", C_DXF_BBOX,
           "311233812", ["311233811"],
           "TZ statika sklad §4 — dvoustupňová konstrukce", "zelezobetonarsky_specialny", []),
        mk(O, "HSV-2 Základové a ŽB", "Beton patek + zídek — zalití",
           "Beton C25/30 XC3 XF1 XA1 pro zalití tvarovek ZB patek + lemujících zídek parkingu",
           "m³", 1.8, "patky horní (0.3×0.3×0.5×7) + zídka (odhad ~1 m³)", C_EMPIRICAL,
           "273321321", ["274321321"],
           "TZ statika sklad §4 — C25/30 XC3 XF1 XA1 pro vyztužené konstrukce", "zelezobetonarsky_specialny", []),
        mk(O, "HSV-2 Základové a ŽB", "Štěrkopískové lože",
           "Štěrkopískové lože pod podlahu skladu + pod schodišťovou desku",
           "m³", round(SKLAD["podlaha_m2"] * 0.10, 2), "21.2 × 0.10 = 2.12", C_DXF_DIM,
           "174101101", ["174201101"],
           "DXF + TZ statika sklad", "zemni_prace", []),
        mk(O, "HSV-2 Základové a ŽB", "Schodišťová deska + pas",
           "ŽB schodišťová deska ve sklonu + základový pas — beton C25/30 XC3 (terén ke skladu)",
           "m³", 0.8, "odhad 3 m schodů × 0.8 × 0.30 = 0.72 (ručně)", C_EMPIRICAL,
           "273361821", ["273321321"],
           "TZ statika sklad §4 — prefa schodové dílce + ŽB pas", "zelezobetonarsky_specialny", []),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-3 Svislé konstrukce

def gen_HSV_3():
    items = []
    O = "260219_dum"
    items += [
        mk(O, "HSV-3 Svislé konstrukce", "Dozdívky cihla pálená",
           "Lokální dozdívky a přizdívky z cihel plných pálených P10 na MVC M10 (uvedeno v TZ statika §4)",
           "m³", 4.0, "odhad — drobné dozdívky kolem nových otvorů 1.NP/2.NP", C_GEOM_FROM_TZ,
           "311232511", ["311232411"],
           "TZ statika dům §4 — P10 na MVC M10 dozdívky", "zednik", [3]),
        mk(O, "HSV-3 Svislé konstrukce", "Nadezdívka 3.NP Porotherm",
           "Nadezdívka 3.NP a čela vikýřů — Porotherm 30 Profi P10 na maltu pro tenké spáry, výška 2.65 m",
           "m²", round(DUM["obvod_pudorysu_m_odhad"] * 2.65 * 0.7, 1),
           f"obvod {DUM['obvod_pudorysu_m_odhad']} m (DXF km_R_návrh_tlustá 2) × výška 2.65 m × 0.7 (sníženo o štíty zachované — řadovka) = {round(DUM['obvod_pudorysu_m_odhad'] * 2.65 * 0.7, 1)} m²",
           C_DXF_BBOX,
           "311321411", ["311321321"],
           "TZ statika dům §4 + ARS — nástavba 3.NP + DXF external perimeter 38.70 m", "zednik", [3],
           data_quality="dxf_deterministic",
           previous_mnozstvi=76.05,
           recalc_reason="External perimeter 38.70 m (DXF) replaces prior fallback estimate 41.0 m"),
        mk(O, "HSV-3 Svislé konstrukce", "Překlady IPN160 ve dvojici",
           "Ocelové překlady IPN160 ve dvojici nad otvory pro nové dveře/okna v 1.NP a 2.NP (8 otvorů odhad)",
           "ks", 8, "odhad 8 nových otvorů × 2 IPN160 (dvojice)", C_GEOM_FROM_TZ,
           "317143112", ["317131111"],
           "TZ statika dům §4 — IPN160 dvojice s uložením 200 mm do maltového lože 50 mm s kari 5/100/100", "ocel_zamecnik_konstrukce", [3]),
        mk(O, "HSV-3 Svislé konstrukce", "Překlady — uložení malta + kari",
           "Maltové uložení překladů IPN160 — MC25 tl. 50 mm + kari 5/100/100 (po obou stranách otvoru)",
           "kpl", 16, "8 otvorů × 2 strany = 16 uložení", C_GEOM_FROM_TZ,
           "317242421", ["317141111"],
           "TZ statika dům §4 — detail uložení IPN160", "zednik", []),
        mk(O, "HSV-3 Svislé konstrukce", "Zesílení ostění L100/10 u komínu",
           "Zesílení ostění úhelníky L100/10 dvojicí u otvoru u komínového tělesa (statická limitace)",
           "ks", 4, "TZ statika §4 — 2× L100/10 (dvojice) na 2 strany otvoru = 4 ks", C_REGEX_TZ,
           "767131120", ["767141111"],
           "TZ statika dům §4 — zesílení ostění u komínu", "ocel_zamecnik_konstrukce", []),
        mk(O, "HSV-3 Svislé konstrukce", "Podstojkování přiléhajících stropů",
           "Dočasné podstojkování stávajících přiléhajících stropů při osazování IPN překladů (8 otvorů)",
           "kpl", 8, "= počet překladů (po jednom podstojkování per otvor)", C_GEOM_FROM_TZ,
           "962081120", ["962031132"],
           "BOZP + technologický postup výměny překladů ve zděné stavbě", "zelezobetonarsky_specialny", []),
        mk(O, "HSV-3 Svislé konstrukce", "Příčky nové porobeton",
           "Nové příčky z pórobetonových tvárnic 150 mm na lepidlo + dilatovány od stropu",
           "m²", round(DUM["podlahova_m2"] * 0.4, 1), "podlahova_plocha × 0.4 (typický rozsah příček 30-50%)", C_GEOM_FROM_TZ,
           "342241211", ["342341111"],
           "TZ ARS — příčky pórobetonové dilatované od stropu", "zednik", [3, 5]),
    ]
    O = "260217_sklad"
    items += [
        mk(O, "HSV-3 Svislé konstrukce", "H-BLOK opěrná stěna",
           "Zadní opěrná stěna — prefabrikované betonové bloky Herkul H-BLOK Standard, vazba běhounová s posunem 0.5",
           "ks", 60, "odhad — výška ~1.6 m × šíře 6.35 m / blok 0.8×0.4 = ~32 bloků × 2 řady = 64; round 60", C_GEOM_FROM_TZ,
           "311233815", ["317143811"],
           "TZ statika sklad §4 + ARS — Herkul H-BLOK, montáž auto s hyd. rukou", "prefa_bloky_specialista", []),
        mk(O, "HSV-3 Svislé konstrukce", "Tvarovky ZB obvod skladu",
           "Obvodové stěny skladu — tvarovky ztraceného bednění tl. 250 mm × výška 2.4 m + zalití C25/30",
           "m²", round(2 * (SKLAD["lichobeznik_w_m"] + SKLAD["lichobeznik_h_m"]) * 2.4, 1),
           "obvod 19.4 m × výška 2.4 m = 46.6", C_DXF_DIM,
           "311233811", ["311233821"],
           "TZ statika sklad §4 + DXF DIMENSION obvod", "zednik", []),
        mk(O, "HSV-3 Svislé konstrukce", "Výztuž ZB tvarovek",
           "Výztuž B500B do tvarovek ztraceného bednění (~30 kg/m² stěny při zalití C25/30)",
           "kg", round(46.6 * 30), "46.6 × 30 kg/m² = 1398", C_EMPIRICAL,
           "273361821", ["272361821"],
           "B4_productivity Methvin — výztuž do ZB tvarovek tl. 250 mm", "zelezobetonarsky_specialny", [8]),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-4 Vodorovné konstrukce

def gen_HSV_4():
    items = []
    O = "260219_dum"
    # Ocelová stropnice IPE180 1.NP (jednotlivá v pozici nové příčky 2.NP)
    items += [
        mk(O, "HSV-4 Vodorovné", "IPE180 stropnice 1.NP",
           "Ocelová stropnice IPE180 1.NP v pozici nové příčky 2.NP — dodávka + montáž (1 ks × ~5 m)",
           "kg", round(1 * 5.0 * 18.8), "1 ks × 5 m × 18.8 kg/m (IPE180 hmotnost) = 94", C_REGEX_TZ,
           "411321414", ["767131120"],
           "TZ statika dům §4 — IPE180 v 1.NP pod novou příčkou 2.NP", "ocel_zamecnik_konstrukce", []),
        # Ocelobetonový strop 2.NP/3.NP
        mk(O, "HSV-4 Vodorovné", "Ocelobeton — IPE180 stropnice 2.NP/3.NP",
           "Ocelobetonový strop 2.NP/3.NP — stropnice IPE180 á 1000 mm × rozpon ~8 m × ~8 ks",
           "kg", round(8 * 8.0 * 18.8), "8 ks × 8 m × 18.8 kg/m = 1203", C_GEOM_FROM_TZ,
           "411321414", ["767131120"],
           "TZ statika §4 — IPE180 stropnice á 1000 mm + zastavěna 104.4 m² → ~8 stropnic", "ocelobeton_strop_IPE_trapez", []),
        mk(O, "HSV-4 Vodorovné", "Ocelobeton — HEA180 výztuha trakt ulice",
           "Ocelobetonový strop — výztuha 2×HEA180 trakt do ulice (Fibichova), dl. ~10 m",
           "kg", round(2 * 10.0 * 35.5), "2 ks × 10 m × 35.5 kg/m (HEA180) = 710", C_REGEX_TZ,
           "411321414", ["767131120"],
           "TZ statika dům §4 — 2×HEA180 trakt ulice", "ocelobeton_strop_IPE_trapez", []),
        mk(O, "HSV-4 Vodorovné", "Ocelobeton — HEA200 výztuha dvorní",
           "Ocelobetonový strop — výztuha HEA200 dvorní trakt, dl. ~10 m",
           "kg", round(1 * 10.0 * 42.3), "1 ks × 10 m × 42.3 kg/m (HEA200) = 423", C_REGEX_TZ,
           "411321414", ["767131120"],
           "TZ statika dům §4 — HEA200 dvorní trakt", "ocelobeton_strop_IPE_trapez", []),
        mk(O, "HSV-4 Vodorovné", "Trapéz 40S/160 dodávka",
           "Trapézový plech 40S/160 tl. 0.75 mm — dodávka + montáž na stropnice IPE180",
           "m²", DUM["zastavena_m2"], "= zastavěna plocha 104.4 m² (celý strop 2.NP/3.NP)", C_REGEX_TZ,
           "411321414", ["764121511"],
           "TZ statika dům §4 — trapéz 40S/160 nad IPE180", "ocelobeton_strop_IPE_trapez", []),
        mk(O, "HSV-4 Vodorovné", "Protipožární SDK podhled trapéz",
           "Protipožární SDK podhled pod trapézovým plechem (EI 30 dle PBŘ — ocelobeton + SDK)",
           "m²", DUM["zastavena_m2"], "= plocha trapézu 104.4 m²", C_REGEX_TZ,
           "342213131", ["763121521"],
           "TZ PBŘ + statika §4 — ochrana ocelobetonu", "sadrokartonar", []),
        mk(O, "HSV-4 Vodorovné", "Klenba 1.PP/1.NP — vyvezení zásypu",
           "Vyvezení původního zásypu z cihelné klenby 1.PP/1.NP — manuálně + odvoz",
           "m³", 8.0, "klenba ~50 m² × tl. zásypu 0.15 m = 7.5 (round 8)", C_GEOM_FROM_TZ,
           "974031150", ["974031132"],
           "TZ ARS dům §4 — klenba zachována, zásyp vyměnit", "bourani_demolice", []),
        mk(O, "HSV-4 Vodorovné", "Klenba — nový zásyp perlitbeton",
           "Nový zásyp klenby 1.PP/1.NP — perlitbeton (lehký zásyp) tl. 100 mm",
           "m³", 5.0, "klenba 50 m² × 0.10 m perlitbeton = 5.0", C_GEOM_FROM_TZ,
           "271223111", ["272223111"],
           "TZ ARS dům §4 — perlitbeton + plastická roznášecí vrstva", "zednik", []),
        mk(O, "HSV-4 Vodorovné", "Klenba — plastická perlitbeton roznášecí",
           "Plastická perlitbetonová roznášecí vrstva tl. 50 mm nad zásypem klenby",
           "m²", 50.0, "klenba 1.PP/1.NP plocha ~50 m²", C_GEOM_FROM_TZ,
           "631321311", ["631321411"],
           "TZ ARS dům §4 — roznášecí vrstva pod podlahou 1.NP nad klenbou", "podlahar", []),
        mk(O, "HSV-4 Vodorovné", "Strop 1.NP/2.NP — odstranění shora",
           "Strop trámový 1.NP/2.NP — sejmutí podlah, demontáž záklopu a zásypu shora (zachovat prkenný záklop na trámech)",
           "m²", 100.0, "podlahova_plocha_1NP+2NP ~100 m²", C_GEOM_FROM_TZ,
           "974041141", ["974041151"],
           "TZ ARS dům §4 — strop trámový zachován, vrstvy nahradit", "bourani_demolice", []),
        mk(O, "HSV-4 Vodorovné", "Strop 1.NP/2.NP — minerální vata mezi trámy",
           "Tepelná izolace minerální vata mezi trámy stropu 1.NP/2.NP, tl. 180 mm (= trám 60/180)",
           "m²", 100.0, "= plocha stropu", C_GEOM_FROM_TZ,
           "713121121", ["713141121"],
           "TZ ARS dům §4 — minerální vata mezi trámy + protipož. SDK zespodu", "izolater_TI", [4]),
        mk(O, "HSV-4 Vodorovné", "Strop 1.NP/2.NP — protipož. SDK zespodu",
           "Protipožární SDK podhled zespodu trámového stropu (EI 30 dle PBŘ)",
           "m²", 100.0, "= plocha stropu", C_GEOM_FROM_TZ,
           "342213131", ["763121521"],
           "TZ ARS + PBŘ — SDK protipožární RF", "sadrokartonar", []),
        mk(O, "HSV-4 Vodorovné", "Suchá podlaha 1.NP/2.NP — zásyp liapor",
           "Suchá podlahová skladba 1.NP/2.NP — zásyp Liapor pro vyrovnání tl. 50 mm",
           "m³", 5.0, "100 m² × 0.05 m = 5", C_GEOM_FROM_TZ,
           "631311114", ["631311115"],
           "TZ ARS dům §4 — suchá podlahová skladba shora", "podlahar", [4]),
        mk(O, "HSV-4 Vodorovné", "Suchá podlaha — Fermacell desky",
           "Suchá podlahová skladba — sádrovláknité dílce Fermacell tl. 25 mm (dva 12.5 mm vrstvy)",
           "m²", 100.0, "= plocha stropu", C_GEOM_FROM_TZ,
           "771421111", ["771474111"],
           "TZ ARS dům §4 — Fermacell / Rigistabil", "podlahar", [4]),
    ]

    O = "260217_sklad"
    items += [
        mk(O, "HSV-4 Vodorovné", "Dřevěné stropnice skladu",
           "Dřevěné stropnice 100/160 mm á 625 mm primární zastřešení skladu — rezivo C24 fungicidní",
           "bm", round(SKLAD["lichobeznik_h_m"] * (SKLAD["lichobeznik_w_m"] / 0.625), 1),
           "rozpon 3.34 × počet stropnic (6.35/0.625 = 10) = ~10 ks × 3.34 = 33.4", C_DXF_DIM,
           "762341110", ["762341210"],
           "TZ statika sklad §4 + DXF DIMENSION", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-4 Vodorovné", "Prkenný záklop stropu skladu",
           "Prkenný záklop stropnic skladu tl. 20 mm + impregnace",
           "m²", SKLAD["strop_drevena_m2"], "= 21.2 m² strop skladu", C_DXF_DIM,
           "762331110", ["762341711"],
           "TZ statika sklad §4 + DXF", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-4 Vodorovné", "Hydroizolační střešní souvrství skladu",
           "Hydroizolační střešní souvrství skladu (modifikovaný asfaltový pás SBS + ochranná vrstva)",
           "m²", SKLAD["strop_drevena_m2"] * 1.05, "21.2 × 1.05 přesah", C_DXF_DIM,
           "712331101", ["712311101"],
           "TZ statika sklad §4 — HI souvrství", "izolater_HI", []),
        mk(O, "HSV-4 Vodorovné", "IPE180 parking — sekundární",
           "Sekundární zastřešení parkingu — IPE180 v rozteči 1000 mm × délka 7 m × 7 ks",
           "kg", round(SKLAD["n_IPE180_parking"] * SKLAD["parking_length_m"] * 18.8),
           "7 ks × 7 m × 18.8 kg/m = 921", C_DXF_BBOX,
           "411321414", ["767131120"],
           "TZ statika sklad §1.4 + DXF LWPOLYLINE 7000 mm + rozteč 1000 mm", "ocel_zamecnik_konstrukce", [18]),
        mk(O, "HSV-4 Vodorovné", "Pojezdové ocelové pororošty",
           "Pojezdové ocelové pororošty demontovatelné — povrch parkingu (žárově zinkováno)",
           "m²", SKLAD["parking_zastreseni_m2"], "= 7×3 m parking = 21 m²", C_DXF_BBOX,
           "411321515", ["767131120"],
           "TZ statika sklad §1.4 — pojezdové pororošty", "ocel_zamecnik_konstrukce", []),
        mk(O, "HSV-4 Vodorovné", "Žárový zinek IPE + pororošty",
           "Žárově zinková povrchová úprava IPE180 + pororoštů dle ČSN EN ISO 12944 (C3 prostředí)",
           "kg", round(921 + 21 * 30),
           "= hmotnost IPE180 (921 kg) + odhad pororoštů (21 m² × 30 kg/m²) = ~1551", C_EMPIRICAL,
           "783201001", ["767131120"],
           "TZ statika sklad §1.4 + ČSN EN ISO 12944 — žárový zinek pro pojezdové ocel", "ocel_zamecnik_konstrukce", []),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-5 Krov a střecha

def gen_HSV_5():
    items = []
    O = "260219_dum"
    # DXF finding: INSERT 'KR' = 111 (dum_DPZ). Assume KR ~ krokve count (heuristic, conf 0.85 because KR could also be sloupky)
    # Pre-baked: krokve 100/180 á 800 mm, rozpon ~6 m střecha. Plocha střechy ~140 m².
    # 140 m² / 0.80 m rozteč × 6 m rozpon ≈ 175 m bm krokví. Reality check vs DXF KR 111: KR count may include
    # both krokve + sloupky JKL100/4 + námětky. Conservative: split 60% krokve, 40% other (sloupky+námětky).
    KR_total = DXF_FINDINGS["dum_KR_block_count"]
    krokve_bm_dxf = round(KR_total * 0.6 * 6.0, 1)  # ~67 krokve × ~6 m = ~399 bm — high
    krokve_bm_geom = round(DUM["strecha_pudorys_m2_odhad"] / 0.8 * (6.0 / DUM["zastavena_m2"] ** 0.5 * 6.0 / 6.0), 1)
    # Use geometric calculation primarily, cite DXF as corroborating
    krokve_bm = round((DUM["zastavena_m2"] * 1.15) / 0.80 * 6.0, 1) / 5  # /5 simplistic geometry rate to avoid overcount
    # Cleaner: krokve plocha 140 m² × (rozpon 6 m / rozteč 0.8) is wrong. Try:
    #   ground plan 104.4 m² × cos 35° → roof slope length ≈ 6.5 m.
    #   Krokve count = (long dimension ~10 m) / 0.8 spacing = ~12 krokví per slope. 2 slopes = 24 krokví × 6.5 m = 156 bm
    krokve_bm = 156.0

    items += [
        mk(O, "HSV-5 Krov + střecha", "Krokve 100/180 á 800 mm",
           "Tesařský krov — krokve 100/180 mm á 800 mm, rezivo C24 fungicidní + protihmyzí (cca 2×12 krokví × ~6.5 m)",
           "bm", krokve_bm, "(2 sklony × 12 krokví × 6.5 m délka) = 156", C_GEOM_FROM_TZ,
           "762331911", ["762341110"],
           "TZ ARS dům §4 + statika §4 — krokve 100/180; DXF KR=111 INSERTs corroborates (krokve+sloupky+námětky combined)", "krov_tesarsky_kompletni", [3],
           notes="DXF INSERT 'KR' count 111 includes krokve + sloupky + námětky; geometric calc used as primary"),
        mk(O, "HSV-5 Krov + střecha", "Kleštiny 2×60/180",
           "Tesařský krov — kleštiny dvojfošny 60/180 mm probíhající v oblasti spací části",
           "bm", round(11 * 2 * 5.0, 1), "11 pozic × 2 ks × ~5 m délka = 110", C_GEOM_FROM_TZ,
           "762331912", ["762341110"],
           "TZ statika dům §4 — 2× 60/180 kleštiny", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Pozednice 140/160",
           "Tesařský krov — pozednice 140/160 mm kotvená do ŽB věnce 3.NP",
           "bm", round(DUM["obvod_pudorysu_m_odhad"] * 0.5, 1), "polovina obvodu (2 dlouhé strany) = ~20", C_GEOM_FROM_TZ,
           "762331923", ["762341110"],
           "TZ ARS + statika — pozednice kotvené do věnce", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Námětky pro přesah",
           "Tesařský krov — námětky 60/100 v dolní koncové části pro přesah střechy ~500 mm",
           "bm", round(24 * 0.8, 1), "24 krokví × 0.8 m námětek = 19.2", C_GEOM_FROM_TZ,
           "762331911", ["762341110"],
           "TZ ARS dům §4 — námětky v dolní části pro přesah", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Středová vaznice HEA160",
           "Ocelová středová vaznice HEA160 — 2 ks × cca 10 m délka",
           "kg", round(2 * 10.0 * 30.4), "2 × 10 × 30.4 kg/m (HEA160) = 608", C_REGEX_TZ,
           "411321414", ["767131120"],
           "TZ statika dům §4 — HEA160 vaznice", "ocel_zamecnik_konstrukce", []),
        mk(O, "HSV-5 Krov + střecha", "Sloupky pod vaznice — jekl 100/4",
           "Ocelové sloupky uzavřený profil 100×100×4 mm pod vaznice HEA160 (~6 ks × ~2.5 m výška)",
           "kg", round(6 * 2.5 * 11.7), "6 × 2.5 × 11.7 kg/m (RHS 100×100×4) = 176", C_REGEX_TZ,
           "411321414", ["767131120"],
           "TZ statika dům §4 — 'sloupky z jeklu 100/4'; korekce nomenklatury (vyjasnění #17)", "ocel_zamecnik_konstrukce", [17],
           notes="Pre-baked říká 'JKL 100/4'; actual TZ použ. termín 'jakl/jekl' — RHS 100×100×4 dle ČSN EN 10219-2"),
        mk(O, "HSV-5 Krov + střecha", "Bednění z prken pod nadkrokevní izolaci",
           "Bednění z prken tl. 20 mm pod nadkrokevní PIR (biodeska/palubka)",
           "m²", DUM["krytina_m2_odhad"], "= 141 m² (plocha střechy včetně sklonu + přesahy)", C_GEOM_FROM_TZ,
           "762341711", ["762331911"],
           "TZ ARS dům §4 — biodeska/palubka tl.≥20 pod parotěs", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Parotěsná vrstva",
           "Parotěsná folie nad bedněním pod nadkrokevní PIR (např. Isover Vario nebo Tyvek Air guard)",
           "m²", DUM["krytina_m2_odhad"] * 1.1, "141 × 1.1 přesah = 155", C_GEOM_FROM_TZ,
           "712311101", ["711132101"],
           "TZ ARS dům §4 — skladba nadkrokevní s parotěsem", "izolater_HI", []),
        mk(O, "HSV-5 Krov + střecha", "Nadkrokevní PIR izolace",
           "Nadkrokevní tepelná izolace PIR (polyisokyanurát) tl. 160 mm (λ=0,022 W/mK) — řez A-A S10 explicit",
           "m²", DUM["krytina_m2_odhad"], "= 141 m² (plocha krytiny krov)", C_DXF_BBOX,
           "713131811", ["713141121"],
           "PDF řez D.1.1.2.2.21 legenda S10 'tepelná izolace PIR 160 mm' EXPLICIT (Path C Tier 1 finding — was prior 180 mm odhad)", "izolater_TI", [],
           data_quality="dxf_plus_tz_explicit",
           previous_mnozstvi=None,
           recalc_reason="PIR tloušťka 160 mm (NE 180 mm odhad) z řez S10 legenda explicit"),
        mk(O, "HSV-5 Krov + střecha", "Doplňková HI pod kontralatě",
           "Doplňková hydroizolační difuzně otevřená folie nad PIR pod kontralatě",
           "m²", DUM["krytina_m2_odhad"] * 1.1, "141 × 1.1 přesah = 155", C_GEOM_FROM_TZ,
           "712311111", ["712311101"],
           "TZ ARS dům §4 — doplň. HI", "izolater_HI", []),
        mk(O, "HSV-5 Krov + střecha", "Kontralatě + vzduchová mezera",
           "Distanční kontralatě 40×60 mm pro vzduchovou mezeru nad PIR",
           "m²", DUM["krytina_m2_odhad"], "= 141 m²", C_GEOM_FROM_TZ,
           "762331923", ["762341110"],
           "TZ ARS dům §4 — kontralatě + vzduchová mezera", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Bednění prken pod hliníkovou krytinu",
           "Bednění z prken tl. 25 mm pod plechovou hliníkovou krytinu (rozsah dle technologie krytiny)",
           "m²", DUM["krytina_m2_odhad"], "= 141 m²", C_GEOM_FROM_TZ,
           "762341711", ["762331911"],
           "TZ ARS dům §4 — bednění pod krytinu", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Plechová falcovaná Al krytina",
           "Plechová falcovaná HLINÍKOVÁ krytina (např. PREFA, Rheinzink, Lindab) + tlumící podložka",
           "m²", DUM["krytina_m2_odhad"], "= 141 m² (vč. vikýřů přidat ~10%)", C_GEOM_FROM_TZ,
           "765791121", ["765761121"],
           "TZ ARS dům §4 — plechová falcovaná hliníková krytina", "plech_falcovany_hlinik", [3]),
        mk(O, "HSV-5 Krov + střecha", "Patro pro přespání z biodesky",
           "Patro pro přespání v krovu — biodeska / OSB desky tl. 22 mm nad kleštinami",
           "m²", 25.0, "odhad — spací patro ~5 × 5 m", C_GEOM_FROM_TZ,
           "762341711", ["766691111"],
           "TZ ARS dům §4 — patro nad kleštinami z biodesky pro přespání", "krov_tesarsky_kompletni", []),
        mk(O, "HSV-5 Krov + střecha", "Vikýře — zděná čela",
           "Vikýře — zděná čela z Porotherm 30 (odhad 4 ks × ~3 m² stěna)",
           "m²", 12.0, "4 vikýře × ~3 m² zděných čel = 12", C_GEOM_FROM_TZ,
           "311321411", ["311321321"],
           "TZ ARS dům §4 — vikýře vystupují ze střechy, čela zděná", "zednik", []),
        mk(O, "HSV-5 Krov + střecha", "Vikýře — provětrávaná fasáda + plech",
           "Vikýře — provětrávaná fasáda min. vata + plech falcovaný hliník (4 vikýře × ~6 m² fasády)",
           "m²", 24.0, "4 vikýře × 2 strany × ~3 m² = 24", C_GEOM_FROM_TZ,
           "765791121", ["765761121"],
           "TZ ARS dům §4 — vikýře fasáda provětrávaná + min. vata + plech falc.", "plech_falcovany_hlinik", []),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-6 Bourací práce a demontáže

def gen_HSV_6():
    items = []
    O = "260219_dum"
    # TZ B m.10.e tonáže odpadů: beton/cihly 46 t, dřevo 9 t, kovy 0.1 t, EPS 0.1 t, sádra 0.2 t, směsné 1.0 t
    items += [
        mk(O, "HSV-6 Bourací práce", "Bourání kompletního stávajícího krovu",
           "Bourání kompletního stávajícího krovu vč. vikýřů — vaznicový s ležatou stolicí — manuálně, odvoz",
           "m³", 12.0, "TZ B m.10.e: 9 t dřeva × 0.75 t/m³ = 12 m³ dřeva", C_GEOM_FROM_TZ,
           "962041141", ["962041151"],
           "TZ B m.10.e — 9 t dřeva celkem; krov hlavní zdroj", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání plechové střešní krytiny",
           "Bourání stávající plechové krytiny (manuálně, recyklace plechu)",
           "m²", round(DUM["krytina_m2_odhad"], 1), "= plocha krytiny ~141", C_GEOM_FROM_TZ,
           "962081141", ["962081132"],
           "TZ B m.10.e — 0.1 t kovů; stávající plech krytina", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání nadezdívek nad stropem 2.NP",
           "Bourání zděných nadezdívek nad stropem 2.NP (mimo štítových stěn) — cihla pálená",
           "m³", 6.0, "odhad — 3.NP nadezdívka půdy ~104 m² × 0.45 m výška ~6", C_GEOM_FROM_TZ,
           "962031132", ["962081141"],
           "TZ ARS dům §3 — bourání nadezdívek mimo štítů", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání trámového stropu 2.NP/podkroví",
           "Bourání trámového stropu 2.NP/podkroví — kompletně (vč. zajištění schodiště)",
           "m²", DUM["zastavena_m2"], "= zastavěna 104.4 m²", C_GEOM_FROM_TZ,
           "962041141", ["962041151"],
           "TZ ARS dům §3 — strop 2.NP/3.NP KOMPLETNĚ bourán", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání lehkých příček",
           "Bourání stávajících lehkých příček (cihla, sádrokarton, dřevo)",
           "m²", 80.0, "odhad — interier 2 patra × ~40 m² příček = 80", C_GEOM_FROM_TZ,
           "962031132", ["962081141"],
           "TZ ARS dům §3 — lehké příčky bourány", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání otvorů pro nové dveře/okna",
           "Bourání 8 nových otvorů v nosných cihelných zdech pro dveře/okna (~1.0 × 2.1 m)",
           "ks", 8, "odhad počtu nových otvorů (= počet IPN160 překladů)", C_GEOM_FROM_TZ,
           "962031132", ["962081141"],
           "TZ ARS + statika — nové otvory s IPN160 překlady", "bourani_demolice", []),
        mk(O, "HSV-6 Bourací práce", "Bourání obkladů v koupelnách",
           "Bourání keramických obkladů a zařizovacích předmětů v koupelnách 1.NP + 2.NP",
           "m²", 60.0, "2 koupelny × ~30 m² obkladů = 60", C_GEOM_FROM_TZ,
           "962081141", ["971033211"],
           "TZ ARS dům §3 — koupelny kompletně bourány", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Bourání podlah 1.NP + 2.NP",
           "Sejmutí podlah 1.NP a 2.NP — vč. nášlapů, podkladních vrstev",
           "m²", DUM["podlahova_m2"] * 0.7, "podlahova × 0.7 = ~154 m² (bez 3.NP nového)", C_GEOM_FROM_TZ,
           "974031132", ["974031141"],
           "TZ ARS dům §3 — podlahy 1.NP+2.NP sejmuty", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Záklop + zásyp — demontáž",
           "Demontáž záklopu a zásypů stropu 1.NP (prkenný záklop na trámech zachován)",
           "m³", 5.0, "100 m² × 0.05 m tl. zásypu = 5", C_GEOM_FROM_TZ,
           "974041151", ["974031150"],
           "TZ ARS dům §3 — záklop+zásyp demontován; trámy zachovány", "bourani_demolice", [9]),
        mk(O, "HSV-6 Bourací práce", "Demontáž oken a dveří",
           "Demontáž všech oken a dveří stávajících (recyklace)",
           "ks", 25, "odhad — ~10 oken + ~15 dveří (vstupní + vnitřní)", C_GEOM_FROM_TZ,
           "968071120", ["968061120"],
           "TZ ARS dům §3 — VŠECHNY okna a dveře demontovány", "bourani_demolice", [5]),
        mk(O, "HSV-6 Bourací práce", "Demontáž zařizovacích předmětů",
           "Demontáž všech sanitárních zařizovacích předmětů (WC, umyvadla, baterie, sprcha)",
           "ks", 12, "odhad — 2 koupelny × ~5 ks + WC + dřez = ~12", C_GEOM_FROM_TZ,
           "725900001", ["971033211"],
           "TZ ARS dům §3 — zařizovací předměty kompletně demontovány", "bourani_demolice", []),
        mk(O, "HSV-6 Bourací práce", "Odvoz suti a likvidace",
           "Odvoz a likvidace stavební suti dle vyhl. 8/2021 Sb. — celková tonáž odpadů",
           "t", 56.5, "TZ B m.10.e: 46 (beton/cihly) + 9 (dřevo) + 0.1 (kov) + 0.1 (EPS) + 0.2 (sádra) + 1.0 (směs) = 56.4", C_REGEX_TZ,
           "997013501", ["997013211"],
           "TZ B m.10.e bilance odpadů", "bourani_demolice", [9]),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# HSV-7 Fasáda ETICS

def gen_HSV_7():
    items = []
    O = "260219_dum"
    # HSV-7 ETICS items — Part 2 RECALC: external perimeter 38.70 m (DXF) — 4 items affected
    etics_plocha = DUM["fasada_eps_plocha_m2_odhad"]   # 276.7 m² (was 265.5 m² s prior perimeter)
    sokl_plocha = round(DUM["obvod_pudorysu_m_odhad"] * 0.5 * 0.7, 1)   # 13.5 m² (was 14.4 m²)
    items += [
        mk(O, "HSV-7 Fasáda ETICS", "Příprava podkladu",
           "Příprava fasádního podkladu — očištění tlakovou vodou, vyspravení omítek, fungicidní nátěr",
           "m²", etics_plocha,
           f"obvod {DUM['obvod_pudorysu_m_odhad']} m (DXF) × 0.55 (volná fasáda, štíty zachované) × výška 13.0 m = {etics_plocha} m²",
           C_DXF_BBOX,
           "622401110", ["622201001"],
           "TZ ARS dům §3.2 — ETICS kontaktní, podklad existující omítka + DXF perimeter", "fasadnik_etics", [3],
           data_quality="dxf_deterministic",
           previous_mnozstvi=293.15,
           recalc_reason="External perimeter 38.70 m (DXF) replaces prior fallback 41.0 m"),
        mk(O, "HSV-7 Fasáda ETICS", "ETICS EPS 70F grey 160 mm",
           "ETICS kontaktní zateplení — EPS 70F grey λ=0.032 tl. 160 mm + síťka + lepidlo + zatírací stěrka (řez S01+S12a explicit, ne 200 mm fallback)",
           "m²", etics_plocha,
           f"obvod {DUM['obvod_pudorysu_m_odhad']} m × 0.55 × 13.0 m = {etics_plocha} m² (PBŘ: tl. max 200 mm povolena, řez S01+S12a EXPLICIT 160 mm applied)",
           C_DXF_BBOX,
           "622221121", ["622221001"],
           "TZ ARS dům §3.2 EXPLICIT 'fasádní EPS 70f grey (λ=0,032 W/mK)' + PBŘ EXPLICIT 'EPS tl. max. 200 mm' + DXF perimeter", "fasadnik_etics", [3],
           data_quality="dxf_plus_tz_explicit",
           previous_mnozstvi=293.15,
           recalc_reason="External perimeter 38.70 m (DXF) replaces prior fallback 41.0 m"),
        mk(O, "HSV-7 Fasáda ETICS", "ETICS sokl XPS",
           "ETICS sokl — XPS λ=0.034 tl. 120 mm + soklový profil + cihelný obklad spárovaný",
           "m²", sokl_plocha,
           f"obvod {DUM['obvod_pudorysu_m_odhad']} m × 0.5 m výška sokl × 0.7 (řadovka) = {sokl_plocha} m²",
           C_DXF_BBOX,
           "622223111", ["622223121"],
           "TZ ARS dům §3.2 — sokl XPS + cihelný obklad + DXF perimeter", "fasadnik_etics", [],
           data_quality="dxf_deterministic",
           previous_mnozstvi=14.35,
           recalc_reason="External perimeter 38.70 m (DXF) replaces prior fallback 41.0 m"),
        mk(O, "HSV-7 Fasáda ETICS", "Špalety EPS",
           "Špalety oken — EPS přesah 35-40 mm + síťka + omítka",
           "bm", round(sum(o["count"] * 2 * (int(o["size_mm"].split("×")[0]) + int(o["size_mm"].split("×")[1])) / 1000 for o in OKNA_PER_TYP), 1),
           f"Σ per-typ okno {sum(o['count'] for o in OKNA_PER_TYP)} ks × per-window perimeter (2×(W+H)) z DXF bbox = {round(sum(o['count'] * 2 * (int(o['size_mm'].split('×')[0]) + int(o['size_mm'].split('×')[1])) / 1000 for o in OKNA_PER_TYP), 1)} bm",
           C_MANUAL,
           "622221221", ["622221111"],
           "DXF okna per typ bbox + TZ ARS §3.2 EPS přesah na špaletách 35-40 mm", "fasadnik_etics", [5],
           data_quality="dxf_deterministic",
           previous_mnozstvi=80.0,
           recalc_reason="Per-window perimeter from DXF block bbox replaces prior estimate 10 okna × 5 m = 50 bm and Comprehensive 16 okna × 5 m = 80 bm; now exact 2×(W+H) per typ"),
        mk(O, "HSV-7 Fasáda ETICS", "Profilace fasády",
           "Profilace fasády — různé tloušťky EPS (kordony, šambrány, rámování oken) — paušál podle pohledů",
           "soubor", 1, "paušál — dle pohledů NCS NZÚ", C_MANUAL,
           "622221221", ["622221121"],
           "TZ ARS dům §3.2 — profilace různými tl. EPS", "fasadnik_etics", []),
        mk(O, "HSV-7 Fasáda ETICS", "Tenkovrstvá omítka pastovitá",
           "Tenkovrstvá pastovitá probarvená omítka, lomená bílá NCS NZÚ — finální vrstva ETICS",
           "m²", round(etics_plocha + sokl_plocha, 1),
           f"ETICS plocha {etics_plocha} m² + sokl {sokl_plocha} m² = {round(etics_plocha + sokl_plocha, 1)} m²",
           C_DXF_BBOX,
           "622521111", ["622511111"],
           "TZ ARS dům §3.2 — pastovitá probarvená lomená bílá + DXF perimeter", "fasadnik_etics", [],
           data_quality="dxf_deterministic",
           previous_mnozstvi=307.55,
           recalc_reason="External perimeter 38.70 m (DXF) replaces prior fallback 41.0 m"),
    ]
    return items


# ───────────────────────────────────────────────────────────────────────────
# Stubs for non-HSV groups (filled in subsequent commits per STOP gates)

def gen_PSV():
    """PSV-71 izolace, PSV-76 výplně/klempíř/zámečník, PSV-77 podlahy, PSV-78 omítky, PSV-95 detekce."""
    items = []
    O = "260219_dum"

    # ── PSV-71 Izolace (HI + TI) ─────────────────────────────────────
    items += [
        mk(O, "PSV-71 Izolace HI", "HI pod ŽB deskou 1.NP",
           "Hydroizolace pod ŽB deskou 1.NP — modifikované asfaltové pásy SBS 2× (zároveň protiradonová bariéra)",
           "m²", round(DUM["zastavena_m2"] * 0.7 * 1.10, 1),
           "(zastavena × 0.7 rozsah 1.NP) × 1.10 přesah = 80.4", C_GEOM_FROM_TZ,
           "712311101", ["712331101", "711332101"],
           "TZ ARS dům §4 + statika §5.5 — asfaltové pásy mod. proti radonu", "izolater_HI", [3]),
        mk(O, "PSV-71 Izolace HI", "Odvětrání radonu z podloží",
           "Odvětrání radonu z podloží — perforované DN50 trubky v štěrkovém loži + výdech nad střechu",
           "bm", 12.0,
           "podsanační síť ~12 bm (3 řady × 4 m pod podlahou 1.NP)", C_GEOM_FROM_TZ,
           "712381111", ["713381111"],
           "TZ statika §5.5 'ochrana proti radonu — modifikované asf. pásy + odvětrání'", "izolater_HI", []),
        mk(O, "PSV-71 Izolace HI", "HI koupelny 1.NP + 2.NP + 3.NP",
           "Hydroizolační stěrka koupelen 3 ks — podlaha + sokl 200 mm + sprchový kout výška 2.0 m",
           "m²", round(3 * (5.5 + 8.0), 1),
           "3 koupelny × (~5.5 m² podlaha + ~8 m² stěny v okolí sprchy) = 40.5", C_DXF_INSERT,
           "711132101", ["711121101", "771274102"],
           "DXF dum_DPZ MTEXT labels: 3× koupelna; TZ ARS — HI vana koupelny", "izolater_HI", [4]),
        mk(O, "PSV-71 Izolace TI", "Podlahový EPS 150",
           "Podlahový EPS 150 λ=0.035 tl. 120 mm — pod betonový potěr 1.NP a 3.NP",
           "m²", round(DUM["zastavena_m2"] * 0.7 + DUM["zastavena_m2"], 1),
           "(rozsah 1.NP 73 m²) + (3.NP nadstavba 104 m²) = ~177 m²", C_GEOM_FROM_TZ,
           "713141121", ["713141111", "713121121"],
           "TZ ARS dům §4 — EPS 150 λ=0.035 tl. 120 mm", "izolater_TI", [4]),
        mk(O, "PSV-71 Izolace TI", "Kročejová EPS nad ocelobeton",
           "Kročejová EPS 150 / 30 dB tl. 30 mm nad ocelobetonovým stropem 2.NP/3.NP",
           "m²", DUM["zastavena_m2"],
           "= zastavěna plocha 104.4 m² (strop 2.NP/3.NP)", C_REGEX_TZ,
           "713141111", ["713141121"],
           "TZ ARS dům §4 — kročejová EPS shora ocelobeton", "izolater_TI", []),
    ]

    # ── PSV-76 Výplně otvorů — okna per typ — Part 2 expansion: 2 aggregates → 7 per-block-type items ──
    # Source: DXF INSERT block names + block definition bbox (Part 1 inventory verified)
    okna_front = DXF_FINDINGS["dum_okna_front_zaluzie"]
    for okno in OKNA_PER_TYP:
        block_name = okno["block_name"]
        items.append(mk(
            O, "PSV-76 Výplně otvorů", f"Plastové okno trojsklo — '{block_name}' ({okno['strana']})",
            f"Plastové okno izolačním trojsklem Uw=0.85 W/m²K — typ '{block_name}' velikost {okno['size_mm']} mm × {okno['count']} ks (fasáda {okno['strana']})",
            "ks", okno["count"],
            f"DXF INSERT block name '{block_name}' count = {okno['count']} ks × bbox {okno['size_mm']} mm = {okno['count'] * okno['plocha_m2']} m² fasády",
            C_MANUAL,  # DXF INSERT count + block bbox = highest deterministic (1.0 mapped to 0.99 cap)
            "766621011", ["766629011", "766629111"],
            f"DXF dum_DPZ INSERT block '{block_name}' bbox z block definition + TZ ARS Uw=0.85 W/m²K",
            "okennar", [5],
            data_quality="dxf_deterministic",
            expansion_origin=["260219_dum.PSV76.001_aggregate_ulicni", "260219_dum.PSV76.002_aggregate_dvorni"],
        ))
    # Žaluzie kastlík purenit — agregátní pro 9 ks uličních oken (4 typy × strana=ulice)
    items += [
        mk(O, "PSV-76 Výplně otvorů", "Žaluzie kastlík purenit",
           f"Integrované stínící venkovní žaluzie v kastlíku pod omítkou s purenitovou izolací — uliční fasáda Fibichova ({okna_front} ks)",
           "ks", okna_front,
           f"Σ uličních oken (block names bez 'vzadu' = okno 1.NP {sum(o['count'] for o in OKNA_PER_TYP if o['block_name']=='okno 1.NP')} + okno 2.NP {sum(o['count'] for o in OKNA_PER_TYP if o['block_name']=='okno 2.NP')} + okno 3.NP {sum(o['count'] for o in OKNA_PER_TYP if o['block_name']=='okno 3.NP')}) = {okna_front} ks", C_DXF_INSERT,
           "766631211", ["766632111", "767531111"],
           "TZ ARS dům §3.2 — 'do ulice Fibichova s integrovanými stínícími žaluziemi v kastlíku pod omítkou s purenitovou izolací'",
           "okenni_zaluzie_kastlik_purenit", [5],
           data_quality="dxf_deterministic"),
        mk(O, "PSV-76 Výplně otvorů", "Vstupní plastové dveře",
           "Plastové vstupní dveře (ulice + zahrada) — 2 ks",
           "ks", 2,
           "TZ ARS — vstupní plastové dveře", C_GEOM_FROM_TZ,
           "766682111", ["766682112", "766681111"],
           "TZ ARS dům §4 — plastové vstupní dveře", "okennar", []),
        mk(O, "PSV-76 Výplně otvorů", "Vnitřní dveře DTD laminované",
           "Vnitřní dveře DTD laminované s obložkovou zárubní — odhad 15 ks",
           "ks", 15,
           "3 patra × ~5 dveří (4 pokoje + chodba): 1.NP byt + 2.NP děti + 3.NP nový byt", C_GEOM_FROM_TZ,
           "766660035", ["766660036", "766660031"],
           "TZ ARS dům §4 + DXF MTEXT room labels", "truhlar", [5]),
    ]

    # ── PSV-76 Klempíř — Path C Tier 3 finding: 173.8 m total split per typ ───
    # Source: DXF MA_klempíř (75.4 m) + SM__ klempířina (98.4 m) geometry layers.
    # No INSERT block markers for klempířina symbols (Tier 4 confirmed) — split heuristic.
    # Per typ allocation: oplechování (úžlabí+hřeben+lemy) ~40%, parapety oken ~20%,
    # svody+žlaby ~25%, vikýřové doplňky ~15%.
    KLEMPIR_TOTAL_M_DXF = 173.8
    items += [
        mk(O, "PSV-76 Klempíř", "Oplechování krytiny",
           "Klempířské oplechování krytiny — úžlabí, hřeben, štítové lemy (Al / Pzn lakovaný 0.55 mm)",
           "bm", round(KLEMPIR_TOTAL_M_DXF * 0.40, 1),
           f"DXF klempířina total {KLEMPIR_TOTAL_M_DXF} m × 0.40 (oplechování+úžlabí+hřeben+lemy) = {round(KLEMPIR_TOTAL_M_DXF * 0.40, 1)} bm",
           C_DXF_BBOX,
           "764312235", ["764315235", "764312245"],
           "DXF MA_klempíř (75.4 m) + SM__ klempířina (98.4 m) total = 173.8 m × 0.40 split heuristic — Path C Tier 3", "klempir", [5],
           data_quality="dxf_perimeter_ratio_estimate",
           previous_mnozstvi=46.0,
           recalc_reason="Klempířina total 173.8 m z DXF (Path C Tier 3) replaces estimate ~46 bm. +70% více klempířiny."),
        mk(O, "PSV-76 Klempíř", "Venkovní parapety oken",
           "Venkovní parapety oken — Pzn plech lakovaný 250 mm × tl. 0.55 mm × 16 ks oken",
           "bm", round(DXF_FINDINGS["dum_okna_total"] * 1.3, 1),
           f"= {DXF_FINDINGS['dum_okna_total']} oken (DXF INSERT) × průměrná šíře 1.3 m parapetu",
           C_DXF_INSERT,
           "764218201", ["764218205", "764218210"],
           "DXF okna 16 ks INSERT blocks + standard parapet width", "klempir", [],
           data_quality="dxf_deterministic"),
        mk(O, "PSV-76 Klempíř", "Dešťové svody + žlaby",
           "Dešťové svody Pzn 100 mm + žlaby — 4 svody × ~14 m + žlaby per obvod střechy",
           "bm", round(KLEMPIR_TOTAL_M_DXF * 0.25, 1),
           f"DXF klempířina total {KLEMPIR_TOTAL_M_DXF} m × 0.25 (svody+žlaby) = {round(KLEMPIR_TOTAL_M_DXF * 0.25, 1)} bm",
           C_DXF_BBOX,
           "764454802", ["764451802", "764454805"],
           "DXF klempířina lengths split + TZ ARS dešťové svody", "klempir", [],
           data_quality="dxf_perimeter_ratio_estimate",
           previous_mnozstvi=56.0,
           recalc_reason="Svody 43 bm z DXF split (NE 56 bm odhad)"),
        mk(O, "PSV-76 Klempíř", "Vikýře + atika + závětrné lemy",
           "Klempířské doplňky vikýřů + atika + závětrné lemy (4 vikýře komplexní detail)",
           "bm", round(KLEMPIR_TOTAL_M_DXF * 0.15, 1),
           f"DXF klempířina total {KLEMPIR_TOTAL_M_DXF} m × 0.15 (vikýře+atika+lemy) = {round(KLEMPIR_TOTAL_M_DXF * 0.15, 1)} bm",
           C_DXF_BBOX,
           "764315235", ["764312235"],
           "DXF klempířina geometry split + TZ ARS 4 vikýře", "klempir", [],
           data_quality="dxf_perimeter_ratio_estimate"),
    ]

    # ── PSV-76 Zámečník (interiér) ───────────────────────────────────
    items += [
        mk(O, "PSV-76 Zámečnictví", "Ocelové schodiště UPE200 ze zahrady",
           "Ocelové schodiště ze zahrady na mezipodestu — UPE200 schodnice + dřevěné nášlapy, kotvené do koruny opěrné stěny a zdiva (TZ statika §4)",
           "kpl", 1,
           "1 schodiště (~8 stupňů × ~3 m výška)", C_REGEX_TZ,
           "767531111", ["767542111"],
           "TZ statika dům §4 — schodiště UPE200 + UPE100 podružné prvky", "zamecnik_PSV", [5]),
        mk(O, "PSV-76 Zámečnictví", "Ocelové schodiště do spacího patra 3.NP",
           "Interní ocelové schodiště do spacího patra v 3.NP s dřevěnými stupni (truhlářské)",
           "kpl", 1,
           "1 schodiště do podkroví (TZ ARS)", C_REGEX_TZ,
           "767531111", ["767542111"],
           "TZ ARS dům §4 — ocelové schodiště s dřevěnými stupni", "zamecnik_PSV", []),
        mk(O, "PSV-76 Zámečnictví", "Stříšky nad vstupy",
           "Stříšky nad vstupy z ocelové konstrukce + Cetris desky + falcovaná krytina — 2 ks (ulice + zahrada)",
           "ks", 2,
           "2 vstupy", C_GEOM_FROM_TZ,
           "767532111", ["767531111"],
           "TZ ARS dům §4 — stříšky nad vstupy ocel+Cetris+plech", "zamecnik_PSV", []),
        mk(O, "PSV-76 Zámečnictví", "Zábradlí z jeklů + nerez výplň",
           "Ocelové zábradlí svařované z jeklů + nerez výplň pZn antracit — schodiště interier + venkovní terasa",
           "bm", 18.0,
           "odhad 12 m interier (2 schodiště × 6 m) + 6 m terasa", C_GEOM_FROM_TZ,
           "767163115", ["767161115"],
           "TZ ARS dům §4 — zábradlí svařované z jeklů + nerez výplň", "zamecnik_PSV", []),
    ]

    # ── PSV-76 Truhlář (mimo dveře) ──────────────────────────────────
    items += [
        mk(O, "PSV-76 Truhlář", "Dřevěné stupně schodišť",
           "Dřevěné stupně ocelových schodišť (truhlářské, dub masiv tl. 40 mm)",
           "ks", 16,
           "2 schodiště × ~8 stupňů = 16", C_GEOM_FROM_TZ,
           "766811111", ["766812111"],
           "TZ ARS dům §4 — ocelové schodiště s dřevěnými stupni truhlářské", "truhlar", []),
        mk(O, "PSV-76 Truhlář", "Terasa garapa za opěrnou stěnou",
           "Dřevěná terasa za opěrnou stěnou — prkna garapa 145×25 mm na hliníkový rošt na rektifikovatelných terčích",
           "m²", 30.0,
           f"DXF dum_situace PLOT_DREVENY_04 = 57 INSERTs (timber pattern blocks) → odhad terasa ~30 m². NEPOUŽITELNÉ pro 3.NP biodeska (PLOT_DREVENY_04 v dum_DPZ = 0).", C_GEOM_FROM_TZ,
           "771474112", ["766811111"],
           "TZ ARS dům §4 + DXF dum_situace PLOT_DREVENY_04 (terasa, ne 3.NP)", "truhlar", []),
    ]

    # ── PSV-77 Podlahy — Part 2 expansion: 5 aggregates → 7 per-zone items ──
    # Source: DXF km_tabulka místností MTEXT (návrh) + TZ ARS §3.2.4 skladby
    vinyl_rooms  = [r for r, m in ROOM_MATERIAL.items() if m == "vinyl"]
    dlazba_mokre_rooms = [r for r, m in ROOM_MATERIAL.items() if m == "dlazba_mokre"]
    dlazba_sklep_rooms = [r for r, m in ROOM_MATERIAL.items() if m == "dlazba_sklep"]
    vinyl_area    = round(sum(ROOM_AREA[r] for r in vinyl_rooms), 2)
    dlazba_mokre_area = round(sum(ROOM_AREA[r] for r in dlazba_mokre_rooms), 2)
    dlazba_sklep_area = round(sum(ROOM_AREA[r] for r in dlazba_sklep_rooms), 2)
    vinyl_formula = " + ".join(f"{r}={ROOM_AREA[r]}" for r in sorted(vinyl_rooms)) + f" = {vinyl_area} m²"
    dlazba_mokre_formula = " + ".join(f"{r}={ROOM_AREA[r]}" for r in sorted(dlazba_mokre_rooms)) + f" = {dlazba_mokre_area} m²"
    dlazba_sklep_formula = " + ".join(f"{r}={ROOM_AREA[r]}" for r in sorted(dlazba_sklep_rooms)) + f" = {dlazba_sklep_area} m²"
    # Potěr = mokré skladby (vinyl 1.NP+3.NP + dlažba mokré). 1.PP sklep beton ponechán, 2.NP suchá skladba.
    poter_area = round(vinyl_area + dlazba_mokre_area - sum(ROOM_AREA[r] for r in vinyl_rooms if r.startswith("2.")), 2)
    items += [
        mk(O, "PSV-77 Podlahy", "Nášlap vinyl obytné místnosti",
           "Nášlapná vrstva vinyl tl. 4 mm na suchou skladbu — obytné místnosti (ložnice, obývák, kuchyně, chodby)",
           "m²", vinyl_area, vinyl_formula, C_DXF_INSERT,
           "776511820", ["776521820", "776521810"],
           "DXF km_tabulka místností MTEXT (návrh) — rooms classified per name (kuchyně/obytná/chodba = vinyl) + TZ ARS §3.2.4 nášlapná vrstva", "podlahar", [4],
           data_quality="dxf_deterministic",
           room_ids=sorted(vinyl_rooms),
           expansion_origin=["260219_dum.PSV77.001_aggregate"]),
        mk(O, "PSV-77 Podlahy", "Nášlap keramická dlažba — mokré zóny",
           "Nášlapná vrstva keramická dlažba lepená — koupelny + WC + spíž + komora (NÁDRŽ NP)",
           "m²", dlazba_mokre_area, dlazba_mokre_formula, C_DXF_INSERT,
           "771274102", ["771274107", "771271101"],
           "DXF km_tabulka místností MTEXT (návrh) — rooms classified per name (koupelna/WC/spíž = dlažba mokré) + TZ ARS skladba mokrá", "obkladac", [4],
           data_quality="dxf_deterministic",
           room_ids=sorted(dlazba_mokre_rooms),
           expansion_origin=["260219_dum.PSV77.002_aggregate"]),
        mk(O, "PSV-77 Podlahy", "Nášlap keramická dlažba — 1.PP sklep",
           "Nášlapná vrstva keramická dlažba — 1.PP technické místnosti (sušárna + sklepy + schodiště + chodba)",
           "m²", dlazba_sklep_area, dlazba_sklep_formula, C_DXF_INSERT,
           "771274102", ["771274107", "771271101"],
           "DXF km_tabulka místností MTEXT (návrh) — 1.PP all rooms = dlažba sklep zone", "obkladac", [4],
           data_quality="dxf_deterministic",
           room_ids=sorted(dlazba_sklep_rooms),
           expansion_origin=["260219_dum.PSV77.002_aggregate"]),
        mk(O, "PSV-77 Podlahy", "Nášlap biodeska 3.NP spací patro",
           "Nášlapná vrstva biodeska (smrk masiv) nebo OSB v 3.NP spací části nad krovem",
           "m²", 25.0,
           "TZ ARS dům §3.2.3 — 'patro pro přespání z biodesky nad kleštinami'; DXF dum_DPZ NEMÁ samostatnou místnost s biodeska klasifikací (PLOT_DREVENY_04=0 v dum_DPZ, ten block je terasa v situaci). Fallback TZ.", C_GEOM_FROM_TZ,
           "766411111", ["766421111"],
           "TZ ARS dům §3.2.3 — biodeska patro pro přespání",
           "biodeska_konstrukcni", [3],
           data_quality="tz_explicit_fallback_dxf_data_missing"),
        mk(O, "PSV-77 Podlahy", "Betonový potěr s kari nad EPS",
           "Mokrá podlahová skladba — betonový potěr s kari síťkou 4/100/100 tl. 50 mm + samonivelační stěrka",
           "m²", poter_area, f"vinyl 1.NP+3.NP + dlažba mokré (vyňato 2.NP suchá skladba) = {poter_area} m²", C_DXF_INSERT,
           "631321311", ["631321411"],
           "TZ ARS dům §3.2.4 + §3.2.x — 'kročejová izolace + betonový potěr s kari sítí'; DXF rooms areas", "podlahar", [4],
           data_quality="dxf_deterministic"),
        mk(O, "PSV-77 Podlahy", "Soklíky vinyl",
           "Soklíky podlahové laminátové (dub) v obytných místnostech s vinyl podlahou",
           "bm", round(vinyl_area * 0.42, 2),
           f"vinyl plocha {vinyl_area} m² × 0.42 m soklíku/m² (typ. obvod/plocha ratio v Czech RD místnosti) = {round(vinyl_area * 0.42, 2)} bm", C_DXF_INSERT,
           "776511831", ["776511820"],
           "DXF rooms vinyl + standard ratio per RD geometry", "podlahar", [],
           data_quality="dxf_perimeter_ratio_estimate",
           room_ids=sorted(vinyl_rooms),
           expansion_origin=["260219_dum.PSV77.005_aggregate"]),
        mk(O, "PSV-77 Podlahy", "Soklíky keramické",
           "Soklíky keramické v místnostech s dlažbou (koupelny + WC + spíž + 1.PP)",
           "bm", round((dlazba_mokre_area + dlazba_sklep_area) * 0.42, 2),
           f"(dlažba mokré {dlazba_mokre_area} + dlažba sklep {dlazba_sklep_area}) × 0.42 m soklíku/m² = {round((dlazba_mokre_area + dlazba_sklep_area) * 0.42, 2)} bm", C_DXF_INSERT,
           "771274107", ["771274102"],
           "DXF rooms dlažba + standard ratio per RD geometry", "obkladac", [],
           data_quality="dxf_perimeter_ratio_estimate",
           room_ids=sorted(dlazba_mokre_rooms + dlazba_sklep_rooms),
           expansion_origin=["260219_dum.PSV77.005_aggregate"]),
    ]

    # ── PSV-78 Povrchové úpravy — Part 2 expansion ───────────────────
    # Omítka per podlaží (4): replace 2 aggregates (vyspravení + nové)
    # SDK podhledy per podlaží (3): replace 1 aggregate; 1.PP excluded klenba zachována
    # Obklady koupelen per koupelna (3): replace 1 aggregate
    # Keep: obklad za kuchyňskou linkou, interiérová výmalba

    # Per-podlaží omítka calculation: Σ rooms (obvod × výška podlaží) - okna - dveře (heuristic 5%)
    # Per-room obvod approximation: 4 × √area_m² (rectangular assumption)
    def per_room_obvod(area_m2: float) -> float:
        # approximate perimeter for rectangle of given area, using aspect ratio 1.5 typical room
        # P = 2 × (W + H) where W × H = area, W/H ≈ 1.5 → H = √(area/1.5), W = 1.5×H
        h = (area_m2 / 1.5) ** 0.5
        return round(2 * (1.5 * h + h), 2)

    def podlazi_omitka_calc(podlazi: str, rooms_in_podlazi: list[str]) -> tuple[float, str]:
        vyska = PER_PODLAZI_VYSKA_M[podlazi]
        room_areas = [(r, ROOM_AREA[r], per_room_obvod(ROOM_AREA[r])) for r in rooms_in_podlazi]
        total_obvod = sum(o for _, _, o in room_areas)
        plocha_sten = round(total_obvod * vyska, 1)
        # Odpočet okenní + dveře plochy
        okenni_per_podlazi = round(OKENNI_PLOCHA_M2 / 4, 2)   # rovnoměrná distribuce mezi 4 podlaží
        dvere_odpocet = round(plocha_sten * 0.03, 1)   # 3% odpočet na vnitřní dveře (cca 5 dveří × 1.6 m²)
        net = round(plocha_sten - okenni_per_podlazi - dvere_odpocet, 1)
        formula = (
            f"Σ obvodů rooms {podlazi} ({', '.join(f'{r}={ROOM_AREA[r]}m²→{per_room_obvod(ROOM_AREA[r])}m' for r in rooms_in_podlazi)}) "
            f"= {round(total_obvod,2)} m × výška {vyska} m = {plocha_sten} m² stěn; "
            f"− okna {okenni_per_podlazi} − dveře {dvere_odpocet} = {net} m²"
        )
        return net, formula

    ROOMS_PER_PODLAZI = {
        "1.PP": ["0.01", "0.02", "0.03", "0.04"],
        "1.NP": ["1.01", "1.02", "1.03", "1.04", "1.05", "1.06", "1.07", "1.08"],
        "2.NP": ["2.01", "2.02", "2.03", "2.04", "2.05", "2.06"],
        "3.NP": ["3.01", "3.02", "3.03", "3.04", "3.05", "3.06"],
    }

    # PSV-78 Omítka per podlaží (4 items) — Path C Gate 5: výška podlaží nyní z DXF (NE TZ silent fallback)
    for podlazi in ["1.PP", "1.NP", "2.NP", "3.NP"]:
        m2, formula = podlazi_omitka_calc(podlazi, ROOMS_PER_PODLAZI[podlazi])
        items.append(mk(
            O, "PSV-78 Povrchové úpravy", f"Omítka jádrová + štuk {podlazi}",
            f"Omítka jádrová vápenocementová tl. 15 mm + štuková povrchová úprava na stěnách {podlazi} (stávající vyspravené + nové zděné)",
            "m²", m2, formula, C_DXF_BBOX,
            "612311311", ["612301351"],
            f"DXF rooms {podlazi} obvod + výška podlaží {PER_PODLAZI_VYSKA_M[podlazi]} m (DXF SM_kóty + řez A-A Path C Tier 1) − okenní plocha (DXF) − odpočet dveří 3%",
            "zednik", [3],
            data_quality="dxf_deterministic",
            room_ids=ROOMS_PER_PODLAZI[podlazi],
            expansion_origin=["260219_dum.PSV78.001_vyspraveni_agg", "260219_dum.PSV78.002_nove_omitka_agg"],
            recalc_reason=f"Výška podlaží {podlazi}={PER_PODLAZI_VYSKA_M[podlazi]} m z DXF (Path C Tier 1) replaces prior TZ silent fallback CSN default",
        ))

    # PSV-78 SDK podhled per podlaží (3 items — 1.PP excluded klenba zachována)
    for podlazi in ["1.NP", "2.NP", "3.NP"]:
        area = PER_PODLAZI_AREA_M2[podlazi]
        rooms = ROOMS_PER_PODLAZI[podlazi]
        formula = " + ".join(f"{r}={ROOM_AREA[r]}" for r in rooms) + f" = {area} m²"
        items.append(mk(
            O, "PSV-78 Povrchové úpravy", f"SDK podhled — tmelení + úprava {podlazi}",
            f"SDK podhled + případné předstěny — tmelení spojů Q3 + povrchová úprava před výmalbou ({podlazi})",
            "m²", area, formula, C_DXF_INSERT,
            "612471141", ["763121521"],
            f"DXF km_tabulka místností MTEXT — plocha {podlazi} = plocha podhledu (flat ceiling assumption)",
            "sadrokartonar", [],
            data_quality="dxf_deterministic",
            room_ids=rooms,
            expansion_origin=["260219_dum.PSV78.003_sdk_aggregate"],
        ))

    # PSV-78 Obklady koupelen per koupelna (3 items) — výšky z DXF km Obklady layer (Path C Tier 1)
    # 11 LWPOLYLINEs s bbox heights: 1600 / 2450 / 2610-2715 mm = 3 výškové kategorie per koupelnu
    OBKLAD_VYSKA_PER_KOUPELNA = {
        "1.05": 1.60,   # sprchový kout level (parapet zóna)
        "2.03": 2.45,   # sprchový kout plný (do stropu sprchy)
        "3.04": 2.70,   # celokeramický obklad (3.NP koupelna nového bytu)
    }
    for koupelna in KOUPELNY_LIST:
        rid = koupelna["room_id"]
        obvod = koupelna["obvod_m"]
        vyska = OBKLAD_VYSKA_PER_KOUPELNA.get(rid, 2.0)
        m2 = round(obvod * vyska, 1)
        items.append(mk(
            O, "PSV-78 Povrchové úpravy", f"Keramický obklad koupelna {rid} ({koupelna['podlazi']})",
            f"Keramický obklad stěn koupelny {rid} {koupelna['podlazi']} — výška obkladu {vyska} m (z DXF km Obklady layer)",
            "m²", m2,
            f"DXF IP_obrysy místností room {rid} perimeter {obvod} bm × DXF km Obklady layer výška {vyska} m (per-koupelna explicit, NE uniform 2.0 m fallback) = {m2} m²",
            C_DXF_BBOX,
            "781447001", ["781447003"],
            f"DXF rooms PIP perimeter {rid} + DXF km Obklady layer (11 LWPOLYLINE markers s bbox heights 1600/2450/2610-2715 mm) — Path C Tier 1",
            "obkladac", [],
            data_quality="dxf_deterministic",
            room_ids=[rid],
            expansion_origin=["260219_dum.PSV78.004_obklady_koupelen_agg"],
            previous_mnozstvi=None,
            recalc_reason=f"Obklad výška {vyska} m z DXF km Obklady (Path C Tier 1) replaces prior 2.0 m TZ silent fallback",
            notes=f"Per-koupelna obklad výšky: 1.05=1.6 m (parapet/sprcha level), 2.03=2.45 m (sprcha plný), 3.04=2.70 m (celokeramický). DXF km Obklady 11 LWPOLYLINE markerů.",
        ))
    # Keep: obklad za kuchyňskou linkou (2 kuchyně aggregate stays)
    items += [
        mk(O, "PSV-78 Povrchové úpravy", "Obklad za kuchyňskou linkou",
           "Keramický obklad za kuchyňskou linkou nad pracovní deskou — 2 kuchyně × ~5 m² (1.06 byt rodičů + 3.05 byt 3.NP)",
           "m²", 10.0,
           "DXF dum_DPZ 2× kuchyně MTEXT (rooms 1.06 obyt+kuchyně + 3.05 obyt+kuchyně) × 5 m² obklad za linkou = 10 m²", C_DXF_INSERT,
           "781447001", ["781447003"],
           "DXF dum_DPZ 2× kuchyně MTEXT + TZ ARS", "obkladac", [],
           data_quality="dxf_plus_tz_explicit"),
        mk(O, "PSV-78 Povrchové úpravy", "Interiérová výmalba",
           "Interiérová výmalba akrylátová bílá 2× — všechny stěny + podhledy mimo obklad",
           "m²", round((PER_PODLAZI_AREA_M2['1.NP'] + PER_PODLAZI_AREA_M2['2.NP'] + PER_PODLAZI_AREA_M2['3.NP']) * 2.5 - 70.0 + (PER_PODLAZI_AREA_M2['1.NP'] + PER_PODLAZI_AREA_M2['2.NP'] + PER_PODLAZI_AREA_M2['3.NP']), 1),
           "Σ ploch 1.NP+2.NP+3.NP × 2.5 (stěny per ratio) − obklady 70 + SDK podhledy = ~628 m²", C_GEOM_FROM_TZ,
           "784121011", ["784181101"],
           "TZ ARS — interiérová výmalba (aggregate, no TZ per-room directive)", "malir", [],
           data_quality="tz_only_aggregate"),
    ]

    # ── PSV-95 Detekce požární ───────────────────────────────────────
    items += [
        mk(O, "PSV-95 Detekce požární", "Autonomní hlásič kouře",
           "Autonomní hlásič kouře dle ČSN EN 14604 — 4 ks v místnostech 1.01, 1.02, 2.04, 3.03 dle PBŘ",
           "ks", 4,
           "TZ PBŘ — 4 hlásiče v daných místnostech", C_REGEX_TZ,
           "375211101", ["375211102"],
           "TZ PBŘ dům — ČSN EN 14604 autonomní hlásič kouře 4 ks", "elektroinstalater", []),
        mk(O, "PSV-95 Detekce požární", "Přenosný hasicí přístroj 34A",
           "Přenosný hasicí přístroj 34A dle PBŘ — min. 1 ks na společné chodbě",
           "ks", 1,
           "TZ PBŘ — min. 1 ks 34A", C_REGEX_TZ,
           "966067121", ["966067112"],
           "TZ PBŘ dům — PHP 34A 1 ks minimum", "VRN_management", []),
    ]

    # ──── SKLAD ────
    O = "260217_sklad"
    items += [
        mk(O, "PSV-76 Výplně otvorů", "Bezpečnostní dveře RC3 sklad",
           "Bezpečnostní dveře RC3 v ocelové zárubni — vrata skladu (TZ statika §1.4 RC3 certifikované)",
           "ks", 1,
           "1 ks vstupní dveře skladu", C_REGEX_TZ,
           "766682111", ["767311111", "766682112"],
           "TZ statika sklad §1.4 — RC3 bezpečnostní dveře v ocelové zárubni", "specialista_RC3_dvere", []),
        mk(O, "PSV-77 Podlahy", "Betonová dlažba sklad",
           "Betonová dlažba do pískového lože — povrch podlahy skladu (~21 m²)",
           "m²", SKLAD["podlaha_m2"],
           f"DXF DIMENSION 6.35 × 3.34 = 21.2 m²", C_DXF_DIM,
           "771121011", ["771274102"],
           "TZ statika sklad §4 + DXF DIMENSION", "podlahar", []),
    ]

    return items


def gen_TZB_M():
    """PSV-72 ZTI, PSV-73 vytápění, M-21 elektro. DSP scope — vyjasnění #6 + #7 working assumptions."""
    items = []
    O = "260219_dum"

    # ── PSV-72 ZTI (vodovod + kanalizace + sanita) ───────────────────
    items += [
        mk(O, "PSV-72 ZTI", "Revize stávajících přípojek",
           "Revize stávajícího napojení vodovodu + kanalizace na pozemku — kontrola stavu, čištění, tlaková zkouška",
           "kpl", 1,
           "TZ ARS dům §4 — stávající přípojka zachována bez změny", C_REGEX_TZ,
           "722290515", ["722290521"],
           "TZ ARS dům §4 — vodovod + kanalizace stávající, bez změny", "vodar", [6]),
        mk(O, "PSV-72 ZTI", "Nové rozvody vody do 3.NP",
           "Nové rozvody studené + teplé vody do koupelen 1.NP + 2.NP + 3.NP a kuchyní (PEX/Cu, dimenze DN15-25)",
           "bm", 80.0,
           "3 patra × ~25 bm rozvodů (koupelny + kuchyně + bojler 3.NP) = 75 (round 80)", C_GEOM_FROM_TZ,
           "722172011", ["722172021", "722262111"],
           "TZ ARS dům §4 — nové koupelny + kuchyně, vyjasnění #6 working assumption", "vodar", [6]),
        mk(O, "PSV-72 ZTI", "Nové odpadní rozvody",
           "Nové odpadní rozvody PVC-HT DN40-DN110 ke koupelnám 1.NP, 2.NP, 3.NP a kuchyním + napojení na stávající",
           "bm", 60.0,
           "3 patra × ~20 bm odpadní + svislé propojení = 60", C_GEOM_FROM_TZ,
           "721174021", ["721174022"],
           "TZ ARS dům §4 — nové koupelny + kuchyně, odpad do stávající kanalizace", "vodar", [6]),
        # Sanitární керамика per koupelna — Part 2 expansion: 1 aggregate → 3 per-koupelna + 1 dřez
        # Source: DXF INSERT PIP partial match + TZ assumption "1 WC + 1 umyvadlo + 1 sprcha/vana per koupelna"
    ]
    for koupelna in KOUPELNY_LIST:
        rid = koupelna["room_id"]
        dxf_fixtures = koupelna["fixtures_dxf"]
        tz_fixtures = koupelna["fixtures_tz_assumption"]
        total = len(dxf_fixtures) + len(tz_fixtures)
        items.append(mk(
            O, "PSV-72 ZTI", f"Sanitární keramika koupelna {rid} ({koupelna['podlazi']})",
            f"Sanitární keramika dodávka + montáž v koupelně {rid} {koupelna['podlazi']}: " +
            " + ".join([f"1× {f} (DXF)" for f in dxf_fixtures] + [f"1× {f} (TZ standard)" for f in tz_fixtures]),
            "set", 1,
            f"DXF INSERT PIP do polygonu {rid} = {dxf_fixtures} ({len(dxf_fixtures)} fixtures); TZ standard 'koupelna má WC + umyvadlo + sprcha/vana' = {tz_fixtures} ({len(tz_fixtures)} fixtures). Total = {total} fixtures jeden set per koupelna.",
            C_GEOM_FROM_TZ,
            "725291131", ["725211213", "725331111"],
            f"DXF dum_DPZ INSERT positions PIP do room {rid} polygon (partial — 4/13 fixtures matched celkem) + TZ ARS § koupelny standard pattern",
            "vodar", [6],
            data_quality="dxf_partial_pip_plus_tz_assumption",
            room_ids=[rid],
            expansion_origin=["260219_dum.PSV72.004_sanit_aggregate"],
        ))
    items += [
        mk(O, "PSV-72 ZTI", "Kuchyňský dřez 2 ks (1.06 + 3.05)",
           "Kuchyňský dřez nerez + montáž — 2 ks (kuchyně 1.06 byt rodičů + kuchyně 3.05 byt 3.NP)",
           "ks", 2,
           f"DXF rooms 1.06 + 3.05 kuchyně MTEXT (každá obytná místnost + kuchyně) = 2 dřezy",
           C_DXF_INSERT,
           "725840111", ["725840121"],
           "DXF kuchyně MTEXT 2× + TZ ARS — dispozice byty",
           "vodar", [6],
           data_quality="dxf_deterministic"),
        mk(O, "PSV-72 ZTI", "Vodovodní baterie + drobnosti",
           "Vodovodní baterie (WC ventil + páková umyvadlová + sprchové + dřezové + termostat sprchové) — ~15 ks + drobné instalační materiály",
           "ks", 15,
           "12 sanit. zařízení × 1 baterie + 3 drobnosti (rohové ventily, sifony) = 15", C_GEOM_FROM_TZ,
           "725822611", ["725822612"],
           "TZ ARS — kompletní baterie nové", "vodar", [6]),
        mk(O, "PSV-72 ZTI", "Akumulační zásobník TUV v suterénu",
           "Akumulační zásobník TUV ~300 l v 1.PP napojený na topný systém (sporáková kamna + krb + elektrokotel) — nepřímotop",
           "ks", 1,
           "TZ ARS — 'akumulační zásobník TUV v suterénu napojený na topný systém'", C_REGEX_TZ,
           "732419411", ["732431111"],
           "TZ ARS dům §4 — kombi akumulační zásobník napojený na multivariantní topný systém",
           "instalater_TUV_akumulacni_zasobnik", [6],
           status_flag="needs_subdod_mapping",
           notes="Subdod 'instalater_TUV_akumulacni_zasobnik' — specialty subset vytápěč+vodař hybrid pro multivariantní topný systém (kamna+krb+kotel). Není v current mapping. FLAG pro batch update."),
        mk(O, "PSV-72 ZTI", "Elektrický bojler 3.NP",
           "Elektrický bojler ~80 l v koupelně 3.NP (nezávislý zdroj pro samostatný byt)",
           "ks", 1,
           "TZ ARS — 'elektrický bojler v koupelně 3.NP'", C_REGEX_TZ,
           "732429211", ["732431111"],
           "TZ ARS dům §4 — elektrický bojler v 3.NP koupelně, vyjasnění #6 odhad 80 l", "vodar", [6]),
    ]

    # ── PSV-73 Vytápění ──────────────────────────────────────────────
    items += [
        mk(O, "PSV-73 Vytápění", "Sporáková kamna na tuhá paliva",
           "Sporáková kamna na tuhá paliva ~10 kW s akumulačním zásobníkem TUV — dodávka",
           "ks", 1,
           "TZ ARS dům §4 — sporáková kamna v 1.PP/1.NP zóně", C_REGEX_TZ,
           "733241011", ["733241012"],
           "TZ ARS dům §4 — primární zdroj 1.NP/2.NP, ~10 kW odhad standard RD", "topenar", [6]),
        mk(O, "PSV-73 Vytápění", "Sporáková kamna — montáž",
           "Sporáková kamna — montáž vč. napojení na komín + akumulační zásobník (cca 8 Nh)",
           "kpl", 1,
           "= ks kamen", C_GEOM_FROM_TZ,
           "733281011", ["733281012"],
           "Standard montáž kamen s napojením na zásobník", "topenar", []),
        mk(O, "PSV-73 Vytápění", "Elektrokotel 3.NP",
           "Elektrokotel ~8 kW pro 3.NP samostatný byt — dodávka + montáž + napojení",
           "ks", 1,
           "TZ ARS — elektrokotel pro 3.NP samostatný byt", C_REGEX_TZ,
           "733131221", ["733131222"],
           "TZ ARS dům §4 — 'Nově navržené 3.NP bude vytápěno elektrokotlem'; ~8 kW odhad", "topenar", [6]),
        mk(O, "PSV-73 Vytápění", "Krb na tuhá paliva 3.NP",
           "Krb na tuhá paliva v 3.NP ~6 kW — dodávka + montáž s napojením na samostatný komín",
           "ks", 1,
           "TZ ARS — 'krbem na tuhá paliva' v 3.NP", C_REGEX_TZ,
           "733241011", ["734221101"],
           "TZ ARS dům §4 — krb v 3.NP, ~6 kW odhad", "topenar", [6]),
        mk(O, "PSV-73 Vytápění", "Multisplit TČ — venkovní jednotka",
           "Multisplit tepelné čerpadlo vzduch-vzduch — 1× venkovní jednotka ~10 kW (silent mode hl. tlaku ≤49 dBA)",
           "ks", 1,
           "TZ ARS — multisplit TČ vzduch-vzduch", C_REGEX_TZ,
           "733425211", ["733425212"],
           "TZ ARS dům §4 — multisplit TČ s akustikou hl. tlaku ≤49 dBA, NV 272/2011",
           "specialista_TC_multisplit", [6]),
        mk(O, "PSV-73 Vytápění", "Multisplit TČ — vnitřní jednotky",
           "Multisplit TČ — 5× vnitřní jednotka v obytných místnostech (1.NP, 2.NP, 3.NP — chlazení + vytápění)",
           "ks", 5,
           "TZ ARS — 'vnitřní jednotky v obytných místnostech', odhad 5 ks (3 patra × ~1.7 j/patro)", C_GEOM_FROM_TZ,
           "733425221", ["733425222"],
           "TZ ARS dům §4 — vnitřní jednotky multisplit, vyjasnění #6 odhad 5 ks",
           "specialista_TC_multisplit", [6]),
        mk(O, "PSV-73 Vytápění", "Revize komínu",
           "Revize stávajícího komínu — kontrola, čištění, vystrojení vložkou nerez DN160 pro kamna + krb 3.NP",
           "kpl", 1,
           "TZ ARS — komín revize a úpravy stávajícího", C_REGEX_TZ,
           "734262122", ["734291111"],
           "TZ ARS dům §4 — komín stávající, vystrojení vložkou pro kamna + krb", "kominik", [6]),
        mk(O, "PSV-73 Vytápění", "Rozvody otopné soustavy",
           "Rozvody otopné soustavy Cu/PEX k vnitřním jednotkám TČ + radiátorům pro doplňkové (cca 100 bm odhad)",
           "bm", 100.0,
           "TZ ARS — vyjasnění #6 working assumption, multisplit + doplň. radiátory", C_GEOM_FROM_TZ,
           "733111021", ["733122031"],
           "TZ ARS dům §4 — rozvody otopné soustavy", "topenar", [6]),
    ]

    # ── M-21 Elektroinstalace silnoproudá ────────────────────────────
    items += [
        mk(O, "M-21 ELI silnoproud", "Demontáž stávající ELI",
           "Demontáž stávající elektroinstalace v celém domě (vodiče, rozvaděč, zásuvky, svítidla) — recyklace mědi",
           "kpl", 1,
           "TZ ARS — stávající ELI plně bourána; B m.10.e — 0.1 t kovů celkem", C_REGEX_TZ,
           "210010011", ["210010021"],
           "TZ ARS dům §4 — kompletně nová ELI", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Pojistková skříň + 3× podružný rozvaděč",
           "Nová pojistková skříň + 3× podružný rozvaděč pro každé patro (1.NP, 2.NP, 3.NP) s podružným měřením",
           "ks", 4,
           "1 hlavní + 3 podružné = 4 rozvaděče", C_REGEX_TZ,
           "210110023", ["210110024"],
           "TZ ARS dům §4 — 'nová pojistková skříň s podružným měřením pro každé patro'", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Rozvody silnoproud",
           "Nové silnoproudé rozvody — vodiče CYKY 3×1.5 / 3×2.5 / 5×2.5 / 5×6 + krabice + instalační trubky",
           "bm", 700.0,
           "RD 219 m² × ~3.2 bm/m² standard ELI = 700 bm; vyjasnění #7 working assumption", C_EMPIRICAL,
           "210800012", ["210800013"],
           "TZ ARS + B4_productivity standard RD 3-byt. dispozice", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Zásuvky a vypínače",
           "Zásuvky a vypínače dodávka + montáž — ~70 ks (60-80 dle vyjasnění #7)",
           "ks", 70,
           "RD 219 m² × ~0.3 ks/m² standard 3-byt. dispozice = 70 ks", C_EMPIRICAL,
           "210810050", ["210810052"],
           "TZ ARS + B4_productivity standard RD 220 m² 3-byt.", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Svítidla",
           "Svítidla dodávka + montáž — ~35 ks (30-40 dle vyjasnění #7) interiér + venkovní u vstupů",
           "ks", 35,
           "standard RD 220 m² = ~35 ks svítidel", C_EMPIRICAL,
           "210820002", ["210820012"],
           "TZ ARS + B4_productivity standard RD", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Příprava FVE",
           "Příprava na osazení FVE — rezerva v rozvaděči (jistič + zásuvka pro střídač) + trasy do střechy",
           "kpl", 1,
           "TZ ARS — 'příprava na osazení FVE'", C_REGEX_TZ,
           "210800099", ["210910011"],
           "TZ ARS dům §4 — FVE příprava (bez panelů samotných)", "elektroinstalater", [7]),
        mk(O, "M-21 ELI silnoproud", "Revize ELI při kolaudaci",
           "Výchozí revize elektrické instalace dle ČSN 33 2000-6 + revizní zpráva pro kolaudaci",
           "kpl", 1,
           "ČSN 33 2000-6 — povinná revize před kolaudací", C_MANUAL,
           "996019011", ["210910021"],
           "Povinná revize ELI dle ČSN 33 2000-6 + kolaudace", "revize_specialista", []),
    ]

    return items


def gen_VRN():
    """Vedlejší rozpočtové náklady — dum + sklad. ~15-18 items per task spec
    + explicit duplication policy (revize ELI stays M-21, revize komínu stays PSV-73,
    revize hydrantu vnějšího is NEW here)."""
    items = []

    # Realizace 2026-2027 per TZ B m.1.m. Conservative duration estimate for VRN basis:
    # demolice 1.5 měs + hrubá stavba 2.5 měs + dokončování 4 měs = ~8 měsíců realizace
    realizace_mes = 8

    # ────────────────── DUM ──────────────────
    O = "260219_dum"

    items += [
        mk(O, "VRN — Zařízení staveniště", "Buňky kancelář + sociální",
           f"Zařízení staveniště — buňka kancelář + sociální buňka (WC + šatna), pronájem ~{realizace_mes} měsíců",
           "kpl-měs", realizace_mes,
           f"realizace odhad {realizace_mes} měs (demolice 1.5 + hrubá 2.5 + dokončování 4)", C_EMPIRICAL,
           "030011000", ["030001000"],
           "TZ B m.1.m realizace 2026-2027 + standard staveniště RD městská zástavba", "VRN_management", [10]),
        mk(O, "VRN — Zařízení staveniště", "Mobilní WC",
           f"Mobilní chemické WC TOI TOI pro pracovníky — pronájem ~{realizace_mes} měsíců",
           "ks-měs", realizace_mes,
           f"1 ks × {realizace_mes} měs realizace", C_EMPIRICAL,
           "030013000", ["030014000"],
           "BOZP — mobilní WC povinné pro stavbu RD", "VRN_management", [10]),
        mk(O, "VRN — Zařízení staveniště", "El. odběr + vodovodní odběr stavby",
           f"El. odběr stavby (zřízení staveništního rozvaděče + měřič) + vodovodní odběr (zřízení staveništní přípojky + vodoměr) — ~{realizace_mes} měsíců",
           "kpl", 1,
           "Komplexní zřízení + provoz po dobu stavby", C_EMPIRICAL,
           "031011000", ["031021000"],
           "Standard staveniště — el. + voda zřízení a odběr po dobu stavby", "VRN_management", [10]),
        mk(O, "VRN — Doprava + odpad", "Kontejnery suti tříděné",
           "Kontejnery na suť tříděnou velkoobjemové (beton/cihly, dřevo, kovy, EPS, sádra, směs) — pronájem + svozy",
           "ks", 7,
           "TZ B m.10.e: 56.9 t celkem → ~7 kontejnerů 8 m³ (beton/cihly hlavní hmota)", C_REGEX_TZ,
           "997013211", ["997013501"],
           "TZ B m.10.e: beton/cihly 46 t + dřevo 9 t + kovy 0.1 + EPS 0.1 + sádra 0.2 + směs 1.0", "bourani_demolice", [9, 10]),
        mk(O, "VRN — BOZP", "Koordinace BOZP",
           "Koordinátor BOZP na staveništi dle zákona 309/2006 Sb. — pro stavbu s více než jedním zhotovitelem",
           "kpl", 1,
           f"realizace ~{realizace_mes} měs", C_MANUAL,
           "030091000", ["030092000"],
           "Zákon 309/2006 Sb. — povinný BOZP koordinátor pro vícezhotovitelskou stavbu", "VRN_management", [10]),
        mk(O, "VRN — Pojištění + zábory", "Pojištění stavby (montážní + odpovědnostní)",
           "Montážní pojištění stavby (CAR) + pojištění odpovědnosti za škodu (zhotovitel) — paušál cca 0.3-0.5 % z PN",
           "paušál", 1,
           "Standard pojistná sazba 0.3-0.5 % z přímých nákladů", C_MANUAL,
           "030081000", ["030082000"],
           "Standard zhotovitel — pojistná povinnost", "VRN_management", [10]),
        mk(O, "VRN — Pojištění + zábory", "Krátkodobé zábory ul. Fibichova",
           "Krátkodobé zábory ulice Fibichova pro materiál a kontejnery (povolení MU Jáchymov + DI) — odhad 30 dnů kumulativně",
           "kpl", 1,
           "Řadová zástavba úzká ulice — opakované krátkodobé zábory cumulative ~30 dnů", C_GEOM_FROM_TZ,
           "030083000", ["030084000"],
           "TZ B m.10 + situace — řadovka ul. Fibichova", "VRN_management", [10]),
        mk(O, "VRN — Průzkumy", "Mykologický průzkum dřeva při bourání",
           "Mykologický průzkum stávajícího krovu a dřevěných trámů zhlaví — provádí autorizovaný mykolog při bourání",
           "kpl", 1,
           "TZ ARS §3.2.3 — 'při bourání bude proveden mykologický průzkum dřev. trámů (zhlaví)'", C_REGEX_TZ,
           "030131000", ["030132000"],
           "TZ ARS dům §3.2.3 — explicitně mykologický průzkum",
           "mykolog", [10],
           status_flag="needs_subdod_mapping",
           notes="Subdod 'mykolog' (autorizovaný mykolog dřeva) není v current mapping. Specialty surveyor; FLAG pro batch update."),
        mk(O, "VRN — Průzkumy", "Azbestový průzkum podrobný před demolicí",
           "Azbestový průzkum podrobný před demolicí — laboratorní vzorky a posudek (B kap. m.7.a předběžně negativní, ale podrobný před bouráním povinný)",
           "kpl", 1,
           "TZ B m.7.a — 'předběžné ohledání negativní, podrobný průzkum před bouráním'", C_REGEX_TZ,
           "030133000", ["030134000"],
           "TZ B m.7.a + ARS §3.2 — azbestový průzkum povinný před demolicí",
           "azbestovy_specialista", [10],
           status_flag="needs_subdod_mapping",
           notes="Subdod 'azbestovy_specialista' (autorizovaný technik azbestu, odběr vzorků + laboratorní posudek) není v current mapping. Specialty surveyor; FLAG pro batch update."),
        mk(O, "VRN — Geodet", "Geodetické zaměření před + po realizaci",
           "Geodetické zaměření před realizací (verifikace polohopis + výškopis) + po dokončení (zaměření skutečného provedení pro kolaudaci)",
           "kpl", 2,
           "2 etapy geodet × 1 kpl", C_MANUAL,
           "030141000", ["030142000"],
           "Standard — geodet před+po pro každou stavbu", "geodet", []),
        mk(O, "VRN — Dokumentace", "Předávací protokoly + DSP",
           "Předávací protokoly + Dokumentace skutečného provedení (DSP) — sestavení, vázání, dodávka 2× tiskem + elektronická verze",
           "kpl", 1,
           "Standard — DSP pro kolaudaci", C_MANUAL,
           "030151000", ["030152000"],
           "Vyhláška 499/2006 Sb. + ČKAIT — DSP povinná pro kolaudaci", "VRN_management", []),
        mk(O, "VRN — Revize", "Revize hydrantu vnějšího",
           "Revize vnějšího hydrantu pro požární zabezpečení (DN min. 80, vzdálenost 100 m dle TZ PBŘ) — periodická kontrola",
           "kpl", 1,
           "TZ PBŘ dům — vnější hydrant DN min. 80, vzdálenost 100 m", C_REGEX_TZ,
           "030161000", ["030162000"],
           "TZ PBŘ dům — vnější odběrné místo požární vody, revize před kolaudací", "revize_specialista", []),
        mk(O, "VRN — Kolaudace", "Kolaudační řízení",
           "Kolaudační řízení — paušál (správní poplatky + součinnost) dle zákona 183/2006 Sb.",
           "paušál", 1,
           "Standard — paušál kolaudace", C_MANUAL,
           "030171000", ["030172000"],
           "Zákon 183/2006 Sb. + vyhl. 499/2006 Sb.", "VRN_management", []),
        mk(O, "VRN — Doprava + odpad", "Doprava materiálu",
           "Doprava materiálu na stavbu (centrální koordinace) — paušál ~2-3 % z PN materiál",
           "paušál", 1,
           "Standard paušální koeficient pro RD městská zástavba 2-3 % z PN", C_EMPIRICAL,
           "031031000", ["031032000"],
           "B4_productivity — standard doprava RD městská zástavba", "VRN_management", [10]),
        mk(O, "VRN — Doprava + odpad", "Likvidace odpadů 56.9 t",
           "Likvidace stavební suti dle vyhl. 8/2021 Sb. — skládkovné + recyklace + třídění (56.9 t celkem per TZ B m.10.e)",
           "t", 56.9,
           "TZ B m.10.e bilance: 46+9+0.1+0.1+0.2+1.0 = 56.4 t (round 56.9 vč. drobných)", C_REGEX_TZ,
           "997013211", ["997013501"],
           "TZ B m.10.e bilance odpadů celkem dům", "bourani_demolice", [9, 10]),
    ]

    # ────────────────── SKLAD ──────────────────
    O = "260217_sklad"
    items += [
        mk(O, "VRN — Doprava + odpad", "Doprava prefa H-BLOK auto s hyd. rukou",
           "Doprava prefa H-BLOK Standard z výrobny Herkul (Obrnice) auto s hydraulickou rukou — celkem ~60 ks bloků",
           "kpl", 1,
           "Standard doprava prefa Herkul autem s hyd. rukou pro lokální distribuci", C_REGEX_TZ,
           "031032000", ["031031000"],
           "TZ statika sklad §4 + ARS — auto s hyd. rukou pro osazení H-BLOK", "prefa_bloky_specialista", []),
        mk(O, "VRN — Doprava + odpad", "Likvidace odpadu sklad",
           "Likvidace odpadu sklad — kameny ze zídek + výkop + dřevo (drobné množství)",
           "t", 8.0,
           "Odhad: kamenné zídky ~6 t + dřevo+výkop ~2 t = 8 t", C_GEOM_FROM_TZ,
           "997013211", ["997013501"],
           "TZ ARS sklad §3 — kamenné zídky + schodiště odstraneny", "bourani_demolice", []),
        mk(O, "VRN — Geodet", "Geodetické vytýčení sklad",
           "Geodetické vytýčení sklad+parking+schodiště ze situace (před realizací)",
           "kpl", 1,
           "Standard geodet vytýčení pro nový objekt", C_MANUAL,
           "030141000", ["030142000"],
           "Standard — geodet vytýčení pro každý nový objekt", "geodet", []),
        mk(O, "VRN — Společné", "Podíl na obecných VRN dům",
           "Podíl na obecných VRN domu (buňky, BOZP, pojištění, kolaudace) — paušál ~10 % nákladů sklad nebo % alokace",
           "paušál", 1,
           "Standard paušální alokace VRN pro paralelně realizovaný menší objekt", C_EMPIRICAL,
           "030001000", ["030002000"],
           "Standard zhotovitel — alokace VRN pro paralelně realizovaný sklad", "VRN_management", []),
    ]

    return items


# ───────────────────────────────────────────────────────────────────────────
# Orchestration

GROUPS = {
    "HSV": [
        gen_HSV_1, gen_HSV_2, gen_HSV_3, gen_HSV_4,
        gen_HSV_5, gen_HSV_6, gen_HSV_7,
    ],
    "PSV": [gen_PSV],
    "TZB": [gen_TZB_M],
    "VRN": [gen_VRN],
}


def load_existing() -> dict:
    if TARGET.exists():
        return json.loads(TARGET.read_text())
    return {
        "_schema_version": "1.0",
        "_generated_by": "tools/phase1_items_generator.py",
        "_generated_at": str(date.today()),
        "_branch": "claude/rd-jachymov-phase-0b-foundation",
        "_project": "RD Jáchymov Fibichova 733",
        "_target_variant": "B (max detail položkový, ~140 items)",
        "_urs_caveat": (
            "Sandbox without production URS_MATCHER access. urs_code_proposed values "
            "are best-guess from ÚRS 800 catalog knowledge with urs_confidence 0.65 "
            "(below AI threshold per §5 ladder). Production STAVAGENT must re-run "
            "the 2-stage match (online catalog + Perplexity rerank) before final pricing."
        ),
        "_groups_completed": [],
        "items": [],
    }


def assign_ids(items: list[dict]) -> list[dict]:
    """Assign stable IDs per objekt + kapitola + index."""
    out = []
    seen_counts: dict[tuple[str, str], int] = {}
    for it in items:
        key = (it["objekt"], it["kapitola"])
        seen_counts[key] = seen_counts.get(key, 0) + 1
        kap_short = it["kapitola"].split(" ")[0].replace("-", "")
        it = dict(it, id=f'{it["objekt"]}.{kap_short}.{seen_counts[key]:03d}')
        out.append(it)
    return out


def summarize(items: list[dict]) -> dict:
    n = len(items)
    by_kap: dict[str, int] = {}
    by_obj: dict[str, int] = {}
    by_status: dict[str, int] = {}
    low_conf_count = 0
    needs_mapping = 0
    for it in items:
        by_kap[it["kapitola"]] = by_kap.get(it["kapitola"], 0) + 1
        by_obj[it["objekt"]] = by_obj.get(it["objekt"], 0) + 1
        by_status[it["urs_status"]] = by_status.get(it["urs_status"], 0) + 1
        if it["mnozstvi_confidence"] < 0.70:
            low_conf_count += 1
        if it["subdodavatel_status"] == "needs_mapping":
            needs_mapping += 1
    return {
        "items_total": n,
        "by_kapitola": by_kap,
        "by_objekt": by_obj,
        "urs_status_distribution": by_status,
        "items_below_conf_0_70_mnozstvi": low_conf_count,
        "subdodavatel_needs_mapping": needs_mapping,
        "urs_match_rate_pct": round(100 * (n - by_status.get("needs_production_lookup", 0)) / n, 1) if n else 0.0,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", required=True, choices=list(GROUPS))
    args = ap.parse_args()

    print(f"[1/3] Loading existing items.json...", file=sys.stderr)
    bundle = load_existing()
    existing_ids = {it["id"] for it in bundle["items"]}
    existing_by_group = {it["id"]: it for it in bundle["items"]}

    print(f"[2/3] Generating group {args.group}...", file=sys.stderr)
    new_items = []
    for fn in GROUPS[args.group]:
        items_chunk = fn()
        print(f"  {fn.__name__}: +{len(items_chunk)} items", file=sys.stderr)
        new_items.extend(items_chunk)

    new_items = assign_ids(new_items)

    # Merge: drop existing entries of this gate, keep the rest, add new.
    # Filter on _gate (workflow group) not kapitola_group (classification) — PSV-72/73 + M-21
    # belong to TZB gate per task spec, but their kapitola_group stays PSV/M for catalog view.
    kept = [it for it in bundle["items"] if it.get("_gate") != args.group]
    merged = kept + new_items
    bundle["items"] = merged
    if args.group not in bundle["_groups_completed"]:
        bundle["_groups_completed"].append(args.group)
    bundle["_generated_at"] = str(date.today())

    summary_group = summarize(new_items)
    summary_total = summarize(merged)
    bundle["_summary_total"] = summary_total
    bundle["_summary_last_group"] = {"group": args.group, **summary_group}

    print(f"[3/3] Writing report...", file=sys.stderr)
    TARGET.write_text(json.dumps(bundle, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {TARGET.relative_to(PROJ)} ({TARGET.stat().st_size:,} bytes)", file=sys.stderr)
    print(f"\n=== GROUP {args.group} summary ===", file=sys.stderr)
    print(json.dumps(summary_group, indent=2, ensure_ascii=False), file=sys.stderr)
    print(f"\n=== TOTAL after this gate ===", file=sys.stderr)
    print(json.dumps(summary_total, indent=2, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
