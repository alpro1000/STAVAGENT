#!/usr/bin/env python3
"""
hk212 Task 2 — Step 1 of 2: layer dictionary auto-detect.

Walks every DXF in test-data/hk212_hala/inputs/vykresy_dxf/ (excluding the
ÚT/TZB file — out of scope per task §1), enumerates all distinct layer
names, then fuzzy-classifies each layer against Czech construction
conventions (per task §4.S.2). Writes a *proposal* JSON. User ratifies
before Step 2 (full extraction).

Output:
    outputs/dsp_geometry_extraction/layer_inventory.json   (raw counts per sheet/layer)
    outputs/dsp_geometry_extraction/layer_dictionary_proposed.json
        — layer → category hypothesis + confidence + sheets where used

Categories (task §4.S.2 + extensions):
    walls, windows, doors, gates, roof, foundation, floor,
    steel_profiles (per profile family), dimensions, axis, centerline,
    formwork, eaves, gutters, scaffolding, hatch_fill, annotation,
    technical_zone, defpoints, axis_grid, opening, ramp_stair,
    unknown (no fuzzy hit — needs user)

Run:
    python test-data/hk212_hala/scripts/dsp_geometry_extraction/step1_layer_dictionary.py
"""

from __future__ import annotations

import json
import logging
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ezdxf

REPO_ROOT = Path(__file__).resolve().parents[4]
DXF_DIR = REPO_ROOT / "test-data/hk212_hala/inputs/vykresy_dxf"
OUT_DIR = REPO_ROOT / "test-data/hk212_hala/outputs/dsp_geometry_extraction"

# Skip ÚT/TZB drawing — out of scope per task §1 ("ÚT DXF — out of scope")
SKIP_FILES = {"UT_HALAHK_DPS.dxf"}


def setup_logging() -> logging.Logger:
    lg = logging.getLogger("layer_dict")
    lg.setLevel(logging.INFO)
    lg.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    lg.addHandler(h)
    return lg


def deburr(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Category rules: ordered list of (pattern, category, confidence).
# Pattern matched against deburr(layer_name).upper().
# First match wins (so put more specific patterns first).
CLASSIFICATION_RULES: list[tuple[re.Pattern, str, float]] = [
    # ---------- DXF system layers ----------
    (re.compile(r"^DEFPOINTS$"), "defpoints", 1.00),
    (re.compile(r"^0$"), "default", 0.50),

    # ---------- Steel profiles (per task §1 — primary HSV-3 source) ----------
    (re.compile(r"^IPE[\s_-]?\d"), "steel_profile_IPE", 0.95),
    (re.compile(r"^HEA[\s_-]?\d"), "steel_profile_HEA", 0.95),
    (re.compile(r"^HEB[\s_-]?\d"), "steel_profile_HEB", 0.95),
    (re.compile(r"^UPE[\s_-]?\d"), "steel_profile_UPE", 0.95),
    (re.compile(r"^U[\s_-]?\d{2,3}"), "steel_profile_U", 0.85),
    (re.compile(r"^L[\s_-]?\d"), "steel_profile_L", 0.85),
    (re.compile(r"^JEKL"), "steel_profile_JEKL", 0.90),
    (re.compile(r"^JAKL"), "steel_profile_JAKL", 0.90),
    (re.compile(r"KRUH(OVE|OVA|OV[YÝ])?[\s_-]?TYC"), "steel_profile_round_bar", 0.85),
    (re.compile(r"OCEL"), "steel_generic", 0.70),

    # ---------- ArchiCAD/Revit-style A-* prefix (more specific than archicad_generic catch-all) ----------
    # A-DETL-* — detail line work (lines for shading / sections), high entity counts
    (re.compile(r"^A-DETL"), "annotation_detail", 0.80),
    # A-DOOR-* — doors + framing + handle
    (re.compile(r"^A-DOOR"), "doors", 0.90),
    # A-WALL (walls + patterns)
    (re.compile(r"^A-WALL-PATT"), "hatch_fill", 0.85),
    (re.compile(r"^A-WALL"), "walls", 0.90),
    # A-FLOR, A-FNDN, A-ROOF
    (re.compile(r"^A-FLOR"), "floor", 0.90),
    (re.compile(r"^A-FNDN"), "foundation", 0.90),
    (re.compile(r"^A-ROOF"), "roof", 0.90),
    # A-GLAZ — glazing = windows (sometimes curtain wall)
    (re.compile(r"^A-GLAZ"), "windows", 0.85),
    # A-AREA-IDEN — area/room identifiers
    (re.compile(r"^A-AREA"), "area_identifier", 0.85),
    # A-ANNO-DIMS — dimensions
    (re.compile(r"^A-ANNO-DIM"), "dimensions", 0.95),
    # A-ANNO-* generic
    (re.compile(r"^A-ANNO"), "annotation", 0.80),
    # A-GENM — ArchiCAD "general massive" (often slab/wall/roof — ambiguous geometry container)
    (re.compile(r"^A-GENM"), "archicad_massive_ambiguous", 0.50),
    # A-PATT — pattern / hatch
    (re.compile(r"^A-PATT"), "hatch_fill", 0.85),
    # A-STRC, A-COLS, A-BEAM — structural
    (re.compile(r"^A-(STRC|COLS|BEAM)"), "structural_generic", 0.80),

    # ---------- S-* prefix (structural overlay) ----------
    (re.compile(r"^S-COLS"), "structural_columns", 0.90),
    (re.compile(r"^S-BEAM"), "structural_beams", 0.90),
    (re.compile(r"^S-FNDN"), "foundation", 0.90),
    (re.compile(r"^S-GRID"), "axis_grid", 0.90),
    (re.compile(r"^S-"), "structural_generic", 0.75),

    # ---------- G-* prefix (general annotation overlay) ----------
    (re.compile(r"^G-ANNO-DIM"), "dimensions", 0.95),
    (re.compile(r"^G-ANNO-TEXT"), "annotation", 0.90),
    (re.compile(r"^G-ANNO"), "annotation", 0.80),
    (re.compile(r"^G-"), "annotation_generic", 0.70),

    # ---------- C-* prefix (civil / survey / topography) ----------
    (re.compile(r"^C-TOPO"), "topography_situace", 0.90),
    (re.compile(r"^C-"), "civil_generic", 0.70),

    # ---------- E-* / M-* / P-* prefixes (electrical / mechanical / plumbing) ----------
    (re.compile(r"^E-"), "electrical_generic", 0.70),
    (re.compile(r"^M-"), "mechanical_generic", 0.70),
    (re.compile(r"^P-"), "plumbing_generic", 0.70),

    # ---------- Openings (Czech naming, not A-* prefix) ----------
    (re.compile(r"OKNO"), "windows", 0.90),
    (re.compile(r"DVER[EÍ]"), "doors", 0.90),
    (re.compile(r"VRATA"), "gates", 0.90),
    (re.compile(r"OTV[OR]"), "opening", 0.70),

    # ---------- Building envelope (Czech naming) ----------
    (re.compile(r"^ZED|^STENA|OBVOD|OPLA[ŠS]T[ĚE]N"), "walls", 0.85),
    (re.compile(r"PRI[ČC]KA"), "internal_walls", 0.85),

    # ---------- Floor / foundation (Czech naming) ----------
    (re.compile(r"^ZAKLAD|^ZÁKLAD|PATKA|PAS"), "foundation", 0.85),
    (re.compile(r"PODLAHA|LAJNA"), "floor", 0.85),
    (re.compile(r"VYKOP"), "excavation", 0.85),

    # ---------- Roof (Czech naming) ----------
    (re.compile(r"^STRECHA|^STŘECHA|KROV|VAZNIC|PUREX|SENDVI"), "roof", 0.85),
    (re.compile(r"^RIMSA|^ŘÍMSA"), "eaves", 0.85),
    (re.compile(r"OKAP|SVOD"), "gutters_downpipes", 0.85),

    # ---------- Stairs / ramps ----------
    (re.compile(r"SCHOD|RAMP"), "ramp_stair", 0.85),

    # ---------- Drawing infrastructure (Czech naming) ----------
    (re.compile(r"^KOT[AY]|^KOTY|^DIM|ROZME"), "dimensions", 0.95),
    (re.compile(r"^OSA|^OSY|GRID"), "axis_grid", 0.90),
    (re.compile(r"STRED|STŘED|CENTER|CERCHA|ČERCHA"), "centerline", 0.85),
    (re.compile(r"POPIS|LABEL|NADPIS"), "annotation", 0.85),
    (re.compile(r"HATCH|FILL|VYPL|SRAF|ŠRAF"), "hatch_fill", 0.85),

    # ---------- Construction aids ----------
    (re.compile(r"BEDN[EĚ]N"), "formwork", 0.90),
    (re.compile(r"LE[SŠ]EN"), "scaffolding", 0.90),

    # ---------- Misc ----------
    (re.compile(r"OSVETL|LIGHT|SVITID"), "lighting", 0.80),
    (re.compile(r"VZT|VENT|POTRUB"), "tzb_ut_vzt", 0.85),
    (re.compile(r"LOGO|RAZITKO|RAZÍTKO|TITULKA"), "title_block", 0.90),
    (re.compile(r"VIEWPORT|LAYOUT"), "viewport", 0.95),

    # ---------- Numeric prefixed user layers (e.g. "04_srafy", "2966-1_navrh dispozice") ----------
    (re.compile(r"^\d{2,4}[_\-]"), "user_custom_numbered", 0.40),

    # ---------- "X×<word>" Czech multi-marker layers (e.g. "1xČERCHA", "2xČERCHA") ----------
    (re.compile(r"^\d+[xXčČ]"), "centerline", 0.70),

    # ---------- Czech line-weight grouping (user-style: TENKA / TLUSTE / TENKE / ČARKOVANA) ----------
    (re.compile(r"^TLUST"), "linework_thick_outline", 0.75),
    (re.compile(r"^TENK"), "linework_thin_detail", 0.75),
    (re.compile(r"^[ČC]ARKOVAN[AÁ]|^TE[ČC]KOVAN"), "centerline", 0.75),
    (re.compile(r"^NETISK"), "non_print_helper", 0.85),

    # ---------- Czech construction terms (profile-grouped / izolace / kanalizace) ----------
    (re.compile(r"^PROFILY"), "steel_profile_generic", 0.80),
    (re.compile(r"^IZOLACE"), "insulation", 0.85),
    (re.compile(r"^DEMOLICE"), "demolition", 0.85),
    (re.compile(r"KANALIZACE|KANAL|TRUBKY"), "existing_utility_pipe", 0.80),
    (re.compile(r"TEREN|TER[ÁA]N"), "topography_situace", 0.80),
    (re.compile(r"OZN[-_ ]?REZU|OZNAC|REZ"), "annotation", 0.75),

    # ---------- ArchiCAD-specific Vlastní 1_A-DETL-GENF hatching ----------
    (re.compile(r"^VLASTNI[\s_-]?\d+[\s_-]?A-DETL-GENF"), "hatch_fill", 0.80),
    (re.compile(r"GENF"), "annotation_detail", 0.65),
]


def classify_layer(layer_name: str) -> tuple[str, float]:
    """Return (category, confidence). Falls back to 'unknown', 0.0 if no rule matches."""
    norm = deburr(layer_name).upper()
    for pat, cat, conf in CLASSIFICATION_RULES:
        if pat.search(norm):
            return cat, conf
    return "unknown", 0.0


def main() -> int:
    logger = setup_logging()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    dxfs = sorted(p for p in DXF_DIR.iterdir()
                   if p.is_file() and p.suffix.lower() == ".dxf" and p.name not in SKIP_FILES)
    if not dxfs:
        logger.error(f"No DXFs in {DXF_DIR}")
        return 1
    logger.info(f"Scanning {len(dxfs)} DXF files (excluding {SKIP_FILES})")

    # layer_name -> {sheets: [...], entity_counts: int, entity_types: Counter}
    layer_inventory: dict[str, dict] = defaultdict(lambda: {
        "sheets": set(),
        "total_entities": 0,
        "entity_types": Counter(),
    })

    # Per-sheet info
    sheets_info: list[dict] = []

    for dxf_path in dxfs:
        logger.info(f"  reading {dxf_path.name}")
        try:
            doc = ezdxf.readfile(dxf_path, errors="ignore")
        except Exception as e:
            logger.error(f"    FAILED to read: {e}")
            continue
        msp = doc.modelspace()

        units = doc.header.get("$INSUNITS", 0)
        ltscale = doc.header.get("$LTSCALE", 1.0)
        try:
            extmin = doc.header.get("$EXTMIN")
            extmax = doc.header.get("$EXTMAX")
            extents = {"min": tuple(extmin) if extmin else None,
                        "max": tuple(extmax) if extmax else None} if extmin else None
        except Exception:
            extents = None

        # Per-layer in this sheet
        sheet_layers: dict[str, Counter] = defaultdict(Counter)
        for e in msp:
            layer = getattr(e.dxf, "layer", "?")
            sheet_layers[layer][e.dxftype()] += 1

        for layer, type_counter in sheet_layers.items():
            layer_inventory[layer]["sheets"].add(dxf_path.name)
            layer_inventory[layer]["total_entities"] += sum(type_counter.values())
            layer_inventory[layer]["entity_types"].update(type_counter)

        sheets_info.append({
            "file": dxf_path.name,
            "dxf_version": doc.dxfversion,
            "units_code": units,
            "ltscale": ltscale,
            "extents": extents,
            "layer_count": len(sheet_layers),
            "msp_entity_count": sum(sum(c.values()) for c in sheet_layers.values()),
            "layouts": list(doc.layout_names()),
        })

    # Classify
    logger.info(f"Classifying {len(layer_inventory)} distinct layer names")
    classified = []
    cat_counts = Counter()
    for layer_name, info in sorted(layer_inventory.items()):
        cat, conf = classify_layer(layer_name)
        cat_counts[cat] += 1
        classified.append({
            "layer": layer_name,
            "category": cat,
            "confidence": conf,
            "sheets": sorted(info["sheets"]),
            "n_sheets": len(info["sheets"]),
            "total_entities": info["total_entities"],
            "entity_types": dict(info["entity_types"]),
        })

    classified_count = sum(1 for c in classified if c["category"] != "unknown")
    coverage_pct = classified_count / max(len(classified), 1) * 100

    # Output 1: raw inventory
    inv_path = OUT_DIR / "layer_inventory.json"
    with open(inv_path, "w", encoding="utf-8") as f:
        json.dump({
            "_meta": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "dxf_files_scanned": len(sheets_info),
                "files_excluded": sorted(SKIP_FILES),
                "distinct_layers": len(layer_inventory),
            },
            "sheets": sheets_info,
            "layers": [
                {
                    "layer": c["layer"],
                    "sheets": c["sheets"],
                    "n_sheets": c["n_sheets"],
                    "total_entities": c["total_entities"],
                    "entity_types": c["entity_types"],
                }
                for c in classified
            ],
        }, f, indent=2, ensure_ascii=False)
    logger.info(f"  wrote {inv_path}")

    # Output 2: classification proposal
    prop_path = OUT_DIR / "layer_dictionary_proposed.json"
    with open(prop_path, "w", encoding="utf-8") as f:
        json.dump({
            "_meta": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "method": "fuzzy regex match against Czech construction conventions "
                          "+ ArchiCAD A-*/S-* schema (per task §4.S.2)",
                "stop_gate_threshold": "task §6 #3 — STOP if classified < 50 %",
                "classified_count": classified_count,
                "total_layers": len(classified),
                "coverage_pct": round(coverage_pct, 1),
                "per_category_distinct_layers": dict(cat_counts.most_common()),
            },
            "classified_layers": classified,
        }, f, indent=2, ensure_ascii=False)
    logger.info(f"  wrote {prop_path}")
    logger.info(f"Classified: {classified_count}/{len(classified)} ({coverage_pct:.1f} %)")
    logger.info(f"Categories: {dict(cat_counts.most_common())}")

    # STOP gate check
    if coverage_pct < 50:
        logger.error(f"§6 STOP #3 triggered — classified < 50 %. Manual mapping needed.")
        return 1

    logger.info("✓ STOP+confirm step per Q1 default(a) — review layer_dictionary_proposed.json")
    logger.info("  before running Step 2 (full extraction).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
