"""Phase 1 step 4 — per-podlaží + objektové agregáty.

Adds an `aggregates` section to objekt_D_geometric_dataset.json:
- Σ floor area per FF code
- Σ floor surface (povrch_podlahy) per F##
- Σ wall surface per F povrch_sten code
- Σ ceiling surface per CF code
- Σ obvod místností (full vs minus door widths for sokl calc)
- Counts per door type code (D## from Tabulka dveří) — total in DXF
- Counts per window type code (W##) — total in DXF
- Per-podlaží totals
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
AGG_PHASE07 = Path("test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json")


def split_combined(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[,/;\s]+", value.strip())
    return [p for p in parts if re.match(r"^[A-Z]{1,3}\d{1,3}$", p)]


def main() -> None:
    if not DS.exists() or not AGG_PHASE07.exists():
        raise SystemExit("Run prior steps first")

    dataset = json.loads(DS.read_text(encoding="utf-8"))
    agg07 = json.loads(AGG_PHASE07.read_text(encoding="utf-8"))

    rooms = dataset["rooms"]

    # Per-FF skladba: Σ floor area
    sum_by_FF: dict[str, float] = defaultdict(float)
    sum_by_F_podlaha: dict[str, float] = defaultdict(float)
    sum_by_F_steny: dict[str, float] = defaultdict(float)
    sum_by_CF: dict[str, float] = defaultdict(float)
    sum_by_F_podhled: dict[str, float] = defaultdict(float)

    sum_by_FF_floor: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    sum_by_CF_floor: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    total_obvod = 0.0
    total_obvod_minus_doors = 0.0
    door_widths_total_mm = 0
    for r in rooms:
        a = r["plocha_podlahy_m2"] or 0
        floor = r["podlazi"]
        for ff in split_combined(r.get("FF", "")):
            sum_by_FF[ff] += a
            sum_by_FF_floor[floor][ff] += a
        for f in split_combined(r.get("F_povrch_podlahy", "")):
            sum_by_F_podlaha[f] += a
        for f in split_combined(r.get("F_povrch_sten", "")):
            wall_brutto = r.get("plocha_sten_brutto_m2", 0)
            sum_by_F_steny[f] += wall_brutto
        for cf in split_combined(r.get("CF", "")):
            sum_by_CF[cf] += a
            sum_by_CF_floor[floor][cf] += a
        for f in split_combined(r.get("F_povrch_podhledu", "")):
            sum_by_F_podhled[f] += a
        total_obvod += r.get("obvod_m") or 0

    # Door widths sum (across all classified openings on the project — Phase 0.7 step 3)
    classified = agg07.get("openings_classified", {}).get("per_podlazi_classified", {})
    for podlazi, block in classified.items():
        for o in block.get("openings", []):
            if o["otvor_type"] == "door" and o.get("width_mm"):
                door_widths_total_mm += o["width_mm"]

    total_obvod_minus_doors = total_obvod - (door_widths_total_mm / 1000.0)

    # Door type code counts (from Phase 0.7 classified openings)
    door_codes: Counter = Counter()
    window_codes: Counter = Counter()
    for podlazi, block in classified.items():
        for o in block.get("openings", []):
            if o["otvor_type"] == "door":
                tc = o.get("type_code")
                if tc:
                    door_codes[tc] += 1
            elif o["otvor_type"] == "window":
                tc = o.get("type_code")
                if tc:
                    window_codes[tc] += 1

    # Per-orientation facade openings (already in Phase 0.7 step 3)
    facade_summary = agg07.get("openings_classified", {}).get("per_podlazi_facade_summary", {})

    # Per-podlaží totals
    per_floor: dict[str, dict] = {}
    for floor in ("1.PP", "1.NP", "2.NP", "3.NP"):
        block = agg07["per_podlazi"].get(floor, {})
        per_floor[floor] = {
            "room_count": block.get("room_count", 0),
            "sum_area_m2": block.get("sum_area_m2", 0),
            "sum_perimeter_m": block.get("sum_perimeter_m", 0),
            "openings": block.get("openings", {}),
            "FF_breakdown": dict(sum_by_FF_floor[floor]),
            "CF_breakdown": dict(sum_by_CF_floor[floor]),
        }

    aggregates = {
        "objekt": "D",
        "by_FF_floor_skladba": {k: round(v, 2) for k, v in sorted(sum_by_FF.items())},
        "by_F_povrch_podlahy": {k: round(v, 2) for k, v in sorted(sum_by_F_podlaha.items())},
        "by_F_povrch_sten": {k: round(v, 2) for k, v in sorted(sum_by_F_steny.items())},
        "by_CF_typ_podhledu": {k: round(v, 2) for k, v in sorted(sum_by_CF.items())},
        "by_F_povrch_podhledu": {k: round(v, 2) for k, v in sorted(sum_by_F_podhled.items())},
        "obvod_total_m": round(total_obvod, 2),
        "obvod_minus_door_widths_m": round(total_obvod_minus_doors, 2),
        "door_widths_total_m": round(door_widths_total_mm / 1000.0, 2),
        "doors_by_type_code": dict(door_codes.most_common()),
        "windows_by_type_code": dict(window_codes.most_common()),
        "per_floor": per_floor,
        "facade_per_orientation": facade_summary,
    }
    dataset["aggregates"] = aggregates
    dataset["phase_1_step"] = 4
    DS.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {DS} ({DS.stat().st_size:,} bytes)")
    print()
    print("=== AGGREGATES headline ===")
    print(f"  Σ obvod místností: {total_obvod:.2f} m  (minus door widths: {total_obvod_minus_doors:.2f} m)")
    print(f"  Door widths total: {door_widths_total_mm} mm = {door_widths_total_mm/1000:.2f} m")
    print()
    print("  By FF skladba podlahy (m²):")
    for k, v in sorted(sum_by_FF.items()):
        print(f"    {k:6s} {v:>9.2f}")
    print()
    print("  By CF typ podhledu (m²):")
    for k, v in sorted(sum_by_CF.items()):
        print(f"    {k:6s} {v:>9.2f}")
    print()
    print("  By F povrch stěn (m² brutto):")
    for k, v in sorted(sum_by_F_steny.items()):
        print(f"    {k:6s} {v:>9.2f}")
    print()
    print(f"  Door type counts: {dict(door_codes.most_common())}")
    print(f"  Window type counts: {dict(window_codes.most_common())}")


if __name__ == "__main__":
    main()
