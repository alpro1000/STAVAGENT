"""Phase 0.7 step 3 — classify openings as fasadní vs vnitřní.

For each opening (door / window / curtain wall), measure its distance
to the closest external footprint edge. Openings within ≤ 800 mm of
the perimeter are classified as fasadní (perimeter-mounted); the rest
are vnitřní (between two interior rooms).

Window + curtain-wall openings are by definition fasadní; doors split.
Per-orientation grouping uses the footprint bbox quadrant (axis-
aligned X/Y; cardinal direction not resolvable from DXF without N
arrow, so we report +X/-X/+Y/-Y).

Output: extends test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json
        with `openings_classified` per podlaží.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import ezdxf
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_dxf_drawing  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
OUT_AGG = Path("test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json")

# Distance from footprint perimeter under which an opening counts as fasadní.
# 800 mm covers 400 mm wall thickness + 400 mm window/door slop.
FACADE_DISTANCE_MM = 800.0

PRIMARY = {
    "1.PP": DXF_DIR / "185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP.dxf",
    "1.NP": DXF_DIR / "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf",
    "2.NP": DXF_DIR / "185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP.dxf",
    "3.NP": DXF_DIR / "185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP.dxf",
}


def footprint_polygon(dxf_path: Path, wall_buffer_mm: float = 400.0) -> Polygon | None:
    """Build a footprint polygon = bounding rectangle of room union, expanded
    by wall_buffer on each side."""
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
    u = unary_union(polys)
    minx, miny, maxx, maxy = u.bounds
    b = wall_buffer_mm
    # Build the buffered bounding rectangle.
    return Polygon([
        (minx - b, miny - b),
        (maxx + b, miny - b),
        (maxx + b, maxy + b),
        (minx - b, maxy + b),
    ])


def quadrant_for(point: Point, footprint: Polygon) -> str:
    """Return which side of the footprint the point is closest to.

    Uses the bbox of `footprint` directly (since it's already axis-aligned).
    """
    minx, miny, maxx, maxy = footprint.bounds
    dx_min = abs(point.x - minx)
    dx_max = abs(point.x - maxx)
    dy_min = abs(point.y - miny)
    dy_max = abs(point.y - maxy)
    closest = min(dx_min, dx_max, dy_min, dy_max)
    if closest == dx_min:
        return "-X"
    if closest == dx_max:
        return "+X"
    if closest == dy_min:
        return "-Y"
    return "+Y"


def classify_for_floor(podlazi: str, dxf_path: Path) -> dict:
    parsed = parse_dxf_drawing(dxf_path)
    fp = footprint_polygon(dxf_path)
    if fp is None:
        return {"podlazi": podlazi, "openings": [], "footprint_available": False}

    # Use the boundary as a LineString for distance queries.
    border = fp.boundary

    classified: list[dict] = []
    for o in parsed.openings:
        pos = Point(*o.position)
        dist_mm = pos.distance(border)
        is_fasadni = (
            o.otvor_type in ("window", "curtain_wall")
            or dist_mm <= FACADE_DISTANCE_MM
        )
        side = quadrant_for(pos, fp) if is_fasadni else None
        classified.append({
            "otvor_type": o.otvor_type,
            "type_code": o.type_code,
            "block_name": o.block_name,
            "position": o.position,
            "width_mm": o.width_mm,
            "height_mm": o.height_mm,
            "source_layer": o.source_layer,
            "is_fasadni": is_fasadni,
            "distance_to_perimeter_mm": int(round(dist_mm)),
            "facade_side": side,
        })
    return {
        "podlazi": podlazi,
        "openings": classified,
        "footprint_available": True,
    }


def main() -> None:
    # Load existing aggregates (must exist — step 1 produces it)
    if not OUT_AGG.exists():
        raise SystemExit(f"Run step 1 first; missing {OUT_AGG}")
    agg = json.loads(OUT_AGG.read_text(encoding="utf-8"))

    print("Classifying openings per podlaží…")
    classified_by_floor: dict[str, dict] = {}
    for podlazi, path in PRIMARY.items():
        if not path.exists():
            continue
        cf = classify_for_floor(podlazi, path)
        classified_by_floor[podlazi] = cf

    # Per-podlaží facade summary
    facade_summary: dict[str, dict] = {}
    for podlazi, cf in classified_by_floor.items():
        ops = cf["openings"]
        fasade_only = [o for o in ops if o["is_fasadni"]]
        by_side: dict[str, list] = {"+X": [], "-X": [], "+Y": [], "-Y": []}
        for o in fasade_only:
            by_side.setdefault(o["facade_side"] or "?", []).append(o)
        side_areas = {}
        for side, items in by_side.items():
            area = 0.0
            for o in items:
                if o["width_mm"] and o["height_mm"]:
                    area += o["width_mm"] * o["height_mm"] / 1_000_000.0
            side_areas[side] = {
                "count": len(items),
                "total_area_m2": round(area, 2),
                "openings": [o["type_code"] or o["block_name"][:40] for o in items[:20]],
            }
        facade_summary[podlazi] = {
            "total_facade_openings": len(fasade_only),
            "total_internal_doors": len(ops) - len(fasade_only),
            "facade_total_area_m2": round(sum(s["total_area_m2"] for s in side_areas.values()), 2),
            "by_side": side_areas,
        }

    # Embed into existing aggregates
    agg.setdefault("openings_classified", {})
    agg["openings_classified"]["facade_distance_threshold_mm"] = FACADE_DISTANCE_MM
    agg["openings_classified"]["per_podlazi_classified"] = classified_by_floor
    agg["openings_classified"]["per_podlazi_facade_summary"] = facade_summary

    # Total facade brutto across the whole objekt
    total_facade_openings = sum(b["total_facade_openings"] for b in facade_summary.values())
    total_facade_area = sum(b["facade_total_area_m2"] for b in facade_summary.values())
    agg["openings_classified"]["total_facade_openings_count"] = total_facade_openings
    agg["openings_classified"]["total_facade_openings_area_m2"] = round(total_facade_area, 2)

    OUT_AGG.write_text(json.dumps(agg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nUpdated {OUT_AGG} ({OUT_AGG.stat().st_size:,} bytes)")
    print()
    print("=== Facade openings per podlaží ===")
    print(f"{'Floor':6s} {'Total':>6s} {'Facade':>7s} {'Interior':>9s} {'Facade m²':>10s}  +X / -X / +Y / -Y")
    for podlazi, b in facade_summary.items():
        sides = b["by_side"]
        per_side = " / ".join(f"{sides[s]['count']}" for s in ["+X", "-X", "+Y", "-Y"])
        total_ops = b["total_facade_openings"] + b["total_internal_doors"]
        print(
            f"{podlazi:6s} {total_ops:>6d} {b['total_facade_openings']:>7d} "
            f"{b['total_internal_doors']:>9d} {b['facade_total_area_m2']:>10.2f}  {per_side}"
        )
    print()
    print(f"TOTAL facade openings: {total_facade_openings} = {total_facade_area:.2f} m²")


if __name__ == "__main__":
    main()
