"""Phase 0.7 step 2 — fasáda + střecha geometry for objekt D.

Approach:
- Footprint (per-podlaží) from the unmatched A-AREA-BNDY-OTLN polygon
  (the objekt-outer boundary, the 21st closed polyline that has no
  corresponding room TEXT code).
- Total height from POHLEDY level annotations (TEXT '+H,HHH' on
  layer A-FLOR-LEVL-OTLN).
- Per-orientation facade brutto = bounding-box edge × total height
  (rectangular envelope; gable triangle area added separately for
  short sides if subtype info available).
- Roof area: prefer the A-ROOF-OTLN closed polylines from Půdorys
  střecha, fall back to footprint × slope correction.

Output: test-data/libuse/outputs/objekt_D_fasada_strecha.json
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import ezdxf
from shapely.geometry import Polygon

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_dxf_drawing  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
PUDORYS_1NP = DXF_DIR / "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf"
PUDORYS_2NP = DXF_DIR / "185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dxf"
PUDORYS_3NP = DXF_DIR / "185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dxf"
PUDORYS_STRECHA = DXF_DIR / "185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha.dxf"
POHLEDY = DXF_DIR / "185-01_DPS_D_SO01_140_6400_R01 - OBJEKT D - POHLEDY.dxf"

OUT = Path("test-data/libuse/outputs/objekt_D_fasada_strecha.json")

LEVEL_RE = re.compile(r"^([+\-]?\d{1,3}[,.]?\d{0,3})$")


def objekt_footprint(dxf_path: Path, wall_buffer_mm: float = 400.0) -> dict | None:
    """Reconstruct the objekt footprint from the union of room polygons.

    The DXF doesn't carry the building outer outline as a single polyline
    (rooms are tagged on A-AREA-BNDY-OTLN; the exterior outline is drawn as
    separate LINE entities on A-WALL-OTLN). We approximate the footprint
    via:
      - interior_union_m2 = unary_union of all closed A-AREA-BNDY-OTLN polys
      - bbox_envelope_m2  = bounding rectangle of that union
      - footprint_with_walls_m2 = bbox expanded by `wall_buffer_mm` on each side
        (covers the external wall thickness ~400 mm typical for obvodové stěny)
    """
    from shapely.ops import unary_union

    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    polys: list[Polygon] = []
    for ent in msp.query("LWPOLYLINE POLYLINE"):
        if ent.dxf.layer != "A-AREA-BNDY-OTLN":
            continue
        try:
            pts = list(ent.get_points("xy"))
        except Exception:
            try:
                pts = [(p[0], p[1]) for p in ent.points()]
            except Exception:
                continue
        if len(pts) < 3:
            continue
        if not (getattr(ent, "is_closed", False) or (getattr(ent.dxf, "flags", 0) & 1)):
            continue
        try:
            polys.append(Polygon([(p[0], p[1]) for p in pts]))
        except Exception:
            continue
    if not polys:
        return None

    interior_union = unary_union(polys)
    interior_m2 = interior_union.area / 1_000_000.0
    minx, miny, maxx, maxy = interior_union.bounds
    bbox_w_m = (maxx - minx) / 1000.0
    bbox_h_m = (maxy - miny) / 1000.0
    bbox_m2 = bbox_w_m * bbox_h_m

    # Add external-wall thickness on all sides (interior dims → external dims).
    buf_m = wall_buffer_mm / 1000.0
    wall_w_m = bbox_w_m + 2 * buf_m
    wall_h_m = bbox_h_m + 2 * buf_m
    footprint_m2 = wall_w_m * wall_h_m
    perimeter_m = 2 * (wall_w_m + wall_h_m)

    return {
        "interior_union_m2": round(interior_m2, 2),
        "interior_bbox_m2": round(bbox_m2, 2),
        "interior_bbox_w_m": round(bbox_w_m, 2),
        "interior_bbox_h_m": round(bbox_h_m, 2),
        "wall_buffer_mm": int(wall_buffer_mm),
        "footprint_with_walls_m2": round(footprint_m2, 2),
        "footprint_w_m": round(wall_w_m, 2),
        "footprint_h_m": round(wall_h_m, 2),
        "footprint_perimeter_m": round(perimeter_m, 2),
        "centroid": [round(interior_union.centroid.x, 0), round(interior_union.centroid.y, 0)],
    }


def extract_levels(pohledy_path: Path) -> list[float]:
    """Find unique level annotations '+1,500', '+4,650', etc. on A-FLOR-LEVL-OTLN."""
    doc = ezdxf.readfile(str(pohledy_path))
    msp = doc.modelspace()
    levels: set[float] = set()
    for ent in msp.query("TEXT MTEXT"):
        if ent.dxf.layer != "A-FLOR-LEVL-OTLN":
            continue
        raw = (ent.dxf.text if ent.dxftype() == "TEXT" else ent.text).strip()
        m = LEVEL_RE.match(raw)
        if m:
            try:
                v = float(m.group(1).replace(",", "."))
                levels.add(v)
            except ValueError:
                continue
    return sorted(levels)


def roof_polygons(pudorys_strecha_path: Path) -> list[Polygon]:
    """Extract closed polylines from A-AREA-OTLN / A-ROOF-OTLN on the roof plan."""
    doc = ezdxf.readfile(str(pudorys_strecha_path))
    msp = doc.modelspace()
    polys: list[Polygon] = []
    for ent in msp.query("LWPOLYLINE POLYLINE"):
        if ent.dxf.layer not in ("A-AREA-____-OTLN", "A-ROOF-____-OTLN"):
            continue
        try:
            pts = list(ent.get_points("xy"))
        except Exception:
            try:
                pts = [(p[0], p[1]) for p in ent.points()]
            except Exception:
                continue
        if len(pts) < 3:
            continue
        if not (getattr(ent, "is_closed", False) or (getattr(ent.dxf, "flags", 0) & 1)):
            continue
        try:
            polys.append(Polygon([(p[0], p[1]) for p in pts]))
        except Exception:
            continue
    return polys


def opening_areas(parsed) -> dict:
    door_areas = []
    win_areas = []
    curt_areas = []
    for o in parsed.openings:
        a = (o.width_mm * o.height_mm / 1_000_000.0) if (o.width_mm and o.height_mm) else None
        if a is None:
            continue
        if o.otvor_type == "door":
            door_areas.append(a)
        elif o.otvor_type == "window":
            win_areas.append(a)
        elif o.otvor_type == "curtain_wall":
            curt_areas.append(a)
    return {
        "doors_total_m2": round(sum(door_areas), 2),
        "windows_total_m2": round(sum(win_areas), 2),
        "curtain_total_m2": round(sum(curt_areas), 2),
        "door_count_with_dim": len(door_areas),
        "window_count_with_dim": len(win_areas),
        "curtain_count_with_dim": len(curt_areas),
    }


def main() -> None:
    # 1) Footprint per podlaží — reconstructed from the union of room polygons
    #    on A-AREA-BNDY-OTLN, expanded by external wall thickness.
    #    (The DXF doesn't carry the objekt outer outline as a single polyline.)
    print("Reconstructing footprint from room polygon union…")
    footprints: dict[str, dict] = {}
    for podlazi, path in [
        ("1.NP", PUDORYS_1NP),
        ("2.NP", PUDORYS_2NP),
        ("3.NP", PUDORYS_3NP),
    ]:
        fp = objekt_footprint(path)
        footprints[podlazi] = fp if fp is not None else {"footprint_with_walls_m2": None}

    # 2) Levels from POHLEDY
    print("Extracting floor levels from POHLEDY…")
    levels = extract_levels(POHLEDY)
    levels_clean = [v for v in levels if -10 < v < 25]  # filter parsing junk
    total_height_m = max(levels_clean) - min(levels_clean) if len(levels_clean) >= 2 else None

    # 3) Per-orientation facade brutto — rectangle envelope from 1.NP footprint
    fp = footprints.get("1.NP", {})
    facade_brutto: dict = {}
    if fp.get("footprint_w_m") and total_height_m:
        long_X_m = fp["footprint_w_m"]
        long_Y_m = fp["footprint_h_m"]
        # Naming axis-aligned: X is "horizontal", Y is "vertical" in DXF coords.
        # Without N-arrow / orientation TEXT we can't assign cardinal
        # directions; use generic +X / -X / +Y / -Y instead.
        h = total_height_m
        facade_brutto = {
            "total_height_m_eaves": round(h, 2),
            "long_axis_X_m": long_X_m,
            "short_axis_Y_m": long_Y_m,
            "rect_envelope_per_side": {
                "+X-facing (along Y axis)": round(long_Y_m * h, 2),
                "-X-facing (along Y axis)": round(long_Y_m * h, 2),
                "+Y-facing (along X axis)": round(long_X_m * h, 2),
                "-Y-facing (along X axis)": round(long_X_m * h, 2),
            },
            "rect_envelope_total_m2": round(2 * (long_X_m + long_Y_m) * h, 2),
            "note": (
                "Cardinal orientation requires manual N-arrow alignment; "
                "axis labels are placeholders. Brutto excludes gable triangles."
            ),
        }

    # 4) Window opening totals per podlaží (from primary půdorysy)
    print("Aggregating window areas per podlaží…")
    win_per_floor: dict[str, dict] = {}
    for podlazi, path in [
        ("1.PP", DXF_DIR / "185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dxf"),
        ("1.NP", PUDORYS_1NP),
        ("2.NP", PUDORYS_2NP),
        ("3.NP", PUDORYS_3NP),
    ]:
        if not path.exists():
            continue
        pd = parse_dxf_drawing(path)
        win_per_floor[podlazi] = opening_areas(pd)

    # Total facade openings (windows + curtain walls — they're on the perimeter)
    total_window_area_m2 = sum(
        v["windows_total_m2"] + v["curtain_total_m2"] for v in win_per_floor.values()
    )

    # 5) Roof (Půdorys střecha)
    print("Extracting roof polygons + windows from STŘECHA drawing…")
    roof_polys = roof_polygons(PUDORYS_STRECHA)
    # Also re-parse for střešní okna
    pd_strecha = parse_dxf_drawing(PUDORYS_STRECHA)
    roof_window_count = sum(1 for o in pd_strecha.openings if o.otvor_type == "window")
    roof_window_area = sum(
        (o.width_mm * o.height_mm / 1_000_000.0)
        for o in pd_strecha.openings
        if o.otvor_type == "window" and o.width_mm and o.height_mm
    )

    roof_areas: list[dict] = []
    for poly in roof_polys:
        a = poly.area / 1_000_000.0
        if a < 1.0:  # filter noise / detail callouts
            continue
        roof_areas.append({
            "area_m2": round(a, 2),
            "perimeter_m": round(poly.length / 1000.0, 2),
        })
    roof_total_horizontal_m2 = round(sum(r["area_m2"] for r in roof_areas), 2)

    # Slope correction — spec mentions skat 30°-67°. Without per-segment slope
    # mapping, we report horizontal projection + provisional 1/cos(angle) factors.
    slope_corrections = {
        "31_deg_factor": round(1 / math.cos(math.radians(31)), 4),
        "67_deg_factor": round(1 / math.cos(math.radians(67)), 4),
        "note": "Apply per-segment factor in Phase 1 once RF tags are clustered to skat.",
    }

    # 6) Cross-check against manual ground truth from spec
    expected = {
        "fasada_brutto_celkem_m2": 838.01,
        "strecha_celkem_m2": 442.88,
        "pudorys_1NP_m2": 348.71,  # from spec Phase 0.7 sample
    }

    parser_pudorys_1np = footprints.get("1.NP", {}).get("footprint_with_walls_m2")
    parser_facade_total = facade_brutto.get("rect_envelope_total_m2")

    # Build comparisons
    cross = {}
    if parser_pudorys_1np:
        diff = (parser_pudorys_1np - expected["pudorys_1NP_m2"]) / expected["pudorys_1NP_m2"] * 100
        cross["pudorys_1NP"] = {
            "parser_m2": parser_pudorys_1np,
            "expected_m2": expected["pudorys_1NP_m2"],
            "diff_pct": round(diff, 2),
            "within_3pct": abs(diff) <= 3.0,
        }
    if parser_facade_total:
        diff = (parser_facade_total - expected["fasada_brutto_celkem_m2"]) / expected["fasada_brutto_celkem_m2"] * 100
        cross["fasada_brutto"] = {
            "parser_m2": parser_facade_total,
            "expected_m2": expected["fasada_brutto_celkem_m2"],
            "diff_pct": round(diff, 2),
            "within_3pct": abs(diff) <= 3.0,
        }
    if roof_total_horizontal_m2:
        # Roof total in spec is sum of slope-projected (true) areas.
        # Horizontal projection ≤ true area; provide both for transparency.
        diff_proj = (roof_total_horizontal_m2 - expected["strecha_celkem_m2"]) / expected["strecha_celkem_m2"] * 100
        cross["strecha_horizontal_projection"] = {
            "parser_m2": roof_total_horizontal_m2,
            "expected_m2_true_slope": expected["strecha_celkem_m2"],
            "diff_pct_vs_slope": round(diff_proj, 2),
            "note": "Parser returns horizontal projection; spec value is slope-projected. Compare after Phase 1 slope clustering.",
        }

    out = {
        "objekt": "D",
        "footprints_per_podlazi": footprints,
        "levels_m": levels_clean,
        "total_height_m_eaves": total_height_m,
        "facade_brutto_envelope": facade_brutto,
        "windows_per_floor": win_per_floor,
        "windows_total_facade_m2": round(total_window_area_m2, 2),
        "roof": {
            "horizontal_polygons_count": len(roof_areas),
            "horizontal_total_m2": roof_total_horizontal_m2,
            "horizontal_polygons": roof_areas,
            "rooflights_count": roof_window_count,
            "rooflights_total_m2": round(roof_window_area, 2),
            "slope_corrections": slope_corrections,
        },
        "cross_check_vs_spec": cross,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print()
    print("=== Headline ===")
    if parser_pudorys_1np:
        print(f"  Půdorys 1.NP D footprint: {parser_pudorys_1np:.2f} m²  "
              f"(spec: {expected['pudorys_1NP_m2']:.2f}, "
              f"Δ {cross['pudorys_1NP']['diff_pct']:+.2f} %)")
    if total_height_m:
        print(f"  Total height (eaves): {total_height_m:.2f} m  "
              f"(min {min(levels_clean):+.2f} → max {max(levels_clean):+.2f})")
    if parser_facade_total:
        print(f"  Facade brutto rect envelope: {parser_facade_total:.2f} m²  "
              f"(spec: {expected['fasada_brutto_celkem_m2']:.2f}, "
              f"Δ {cross['fasada_brutto']['diff_pct']:+.2f} %)")
    print(f"  Window+CW total area (facade): {total_window_area_m2:.2f} m²")
    print(f"  Roof horizontal polys: {len(roof_areas)} totaling {roof_total_horizontal_m2:.2f} m²")
    print(f"  Roof windows (rooflights): {roof_window_count} = {roof_window_area:.2f} m²")


if __name__ == "__main__":
    main()
