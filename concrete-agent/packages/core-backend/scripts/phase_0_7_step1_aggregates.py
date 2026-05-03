"""Phase 0.7 step 1 — aggregate per-podlaží geometry for objekt D.

Reads parser output of all 12 valid DXFs, dedupes rooms by code, groups
by podlaží (1.PP / 1.NP / 2.NP / 3.NP), counts openings per primary
půdorys (avoids double-count from podhledy clones).

Output: test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_batch  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
OUT = Path("test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json")

# Map drawing stems → role + podlaží so we can attach openings to the
# correct floor without double-counting from the podhledy export.
PRIMARY_DRAWINGS = {
    "1.PP": "185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP",
    "1.NP": "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP",
    "2.NP": "185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP",
    "3.NP": "185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP",
    "roof": "185-01_DPS_D_SO01_140_4440_00-OBJEKT D - Půdorys střecha",
}


def is_objekt_d_room(code: str) -> bool:
    """D-related room: D.x.x.xx or S.D.xx (sklep)."""
    if code.startswith("D."):
        return True
    parts = code.split(".")
    if len(parts) == 3 and parts[0] == "S" and parts[1] == "D":
        return True
    return False


def main() -> None:
    paths = sorted(DXF_DIR.glob("*.dxf"))
    print(f"Parsing {len(paths)} DXFs…")
    parsed = parse_batch(paths)

    # Dedupe rooms by code from any drawing that contains them.
    rooms_by_podlazi: dict[str, list[dict]] = defaultdict(list)
    seen_codes: set[str] = set()
    for stem, p in parsed.items():
        for r in p.rooms:
            if r.area_m2 is None:
                continue
            if not is_objekt_d_room(r.code):
                continue
            if r.code in seen_codes:
                continue
            seen_codes.add(r.code)
            rooms_by_podlazi[r.podlazi].append({
                "code": r.code,
                "objekt": r.objekt,
                "podlazi": r.podlazi,
                "byt_or_section": r.byt_or_section,
                "mistnost_num": r.mistnost_num,
                "area_m2": round(r.area_m2, 3),
                "perimeter_m": round(r.perimeter_m, 3) if r.perimeter_m else None,
                "code_position": r.code_position,
                "source_drawing": stem,
            })

    # Per-podlaží openings — only from primary půdorysy to avoid the podhledy
    # clone (same model exported twice).
    openings_by_podlazi: dict[str, list[dict]] = defaultdict(list)
    for podlazi, primary_stem in PRIMARY_DRAWINGS.items():
        if primary_stem not in parsed:
            continue
        p = parsed[primary_stem]
        for o in p.openings:
            openings_by_podlazi[podlazi].append({
                "otvor_type": o.otvor_type,
                "type_code": o.type_code,
                "block_name": o.block_name,
                "position": o.position,
                "width_mm": o.width_mm,
                "height_mm": o.height_mm,
                "depth_mm": o.depth_mm,
                "source_layer": o.source_layer,
                "source_drawing": primary_stem,
            })

    # Build per-podlaží aggregate blocks.
    floors_order = ["1.PP", "1.NP", "2.NP", "3.NP"]
    per_podlazi: dict[str, dict] = {}
    for podlazi in floors_order:
        rooms = rooms_by_podlazi.get(podlazi, [])
        openings = openings_by_podlazi.get(podlazi, [])
        room_count_by_section: Counter = Counter(r["byt_or_section"] for r in rooms)
        sum_area = sum(r["area_m2"] for r in rooms)
        sum_perim = sum(r["perimeter_m"] or 0.0 for r in rooms)
        n_door = sum(1 for o in openings if o["otvor_type"] == "door")
        n_door_w = sum(1 for o in openings if o["otvor_type"] == "door" and o["type_code"])
        n_win = sum(1 for o in openings if o["otvor_type"] == "window")
        n_win_w = sum(1 for o in openings if o["otvor_type"] == "window" and o["type_code"])
        n_curt = sum(1 for o in openings if o["otvor_type"] == "curtain_wall")

        # Opening areas — only valid when block name parser found dimensions.
        def opening_area_m2(o: dict) -> float | None:
            if o["width_mm"] and o["height_mm"]:
                return (o["width_mm"] * o["height_mm"]) / 1_000_000.0
            return None

        door_areas = [a for o in openings if o["otvor_type"] == "door" and (a := opening_area_m2(o))]
        win_areas = [a for o in openings if o["otvor_type"] == "window" and (a := opening_area_m2(o))]
        curt_areas = [a for o in openings if o["otvor_type"] == "curtain_wall" and (a := opening_area_m2(o))]

        per_podlazi[podlazi] = {
            "podlazi": podlazi,
            "primary_drawing": PRIMARY_DRAWINGS.get(podlazi),
            "room_count": len(rooms),
            "room_count_by_section": dict(room_count_by_section.most_common()),
            "sum_area_m2": round(sum_area, 2),
            "sum_perimeter_m": round(sum_perim, 2),
            "openings": {
                "door_count": n_door,
                "door_with_type_code": n_door_w,
                "window_count": n_win,
                "window_with_type_code": n_win_w,
                "curtain_wall_count": n_curt,
                "door_total_area_m2": round(sum(door_areas), 2),
                "window_total_area_m2": round(sum(win_areas), 2),
                "curtain_total_area_m2": round(sum(curt_areas), 2),
                "door_area_known_count": len(door_areas),
                "window_area_known_count": len(win_areas),
            },
            "rooms": rooms,
        }

    # Whole-objekt totals
    total_room_count = sum(b["room_count"] for b in per_podlazi.values())
    total_area = sum(b["sum_area_m2"] for b in per_podlazi.values())
    total_door = sum(b["openings"]["door_count"] for b in per_podlazi.values())
    total_window = sum(b["openings"]["window_count"] for b in per_podlazi.values())
    total_curt = sum(b["openings"]["curtain_wall_count"] for b in per_podlazi.values())

    out = {
        "objekt": "D",
        "source_dxf_count": len(paths),
        "source_dxf_valid": sum(1 for p in parsed.values() if not p.skipped),
        "primary_drawings": PRIMARY_DRAWINGS,
        "totals": {
            "room_count": total_room_count,
            "sum_area_m2": round(total_area, 2),
            "door_count": total_door,
            "window_count": total_window,
            "curtain_wall_count": total_curt,
        },
        "per_podlazi": per_podlazi,
        "openings_by_podlazi": dict(openings_by_podlazi),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print()
    print("=== Objekt D summary ===")
    for podlazi in floors_order:
        b = per_podlazi[podlazi]
        op = b["openings"]
        print(
            f"  {podlazi:5s} : {b['room_count']:>3} rooms, "
            f"area {b['sum_area_m2']:>8.2f} m², "
            f"openings D={op['door_count']:>3} W={op['window_count']:>3} CW={op['curtain_wall_count']:>2}"
        )
    print()
    print(f"Totals: rooms={total_room_count}, area={total_area:.2f} m², "
          f"doors={total_door}, windows={total_window}, curtains={total_curt}")


if __name__ == "__main__":
    main()
