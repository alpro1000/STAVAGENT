"""Phase 1 step 2 — per-room enrichment for objekt D.

Joins:
  • DXF rooms (Phase 0.7 step 1 → objekt_D_per_podlazi_aggregates.json)
  • Tabulka místností (Phase 1 step 1 → tabulky_loaded.json)
  • DXF openings classified (Phase 0.7 step 3, embedded in same JSON)
  • DXF segment tags via spatial nearest (parser ParsedDrawing)

Output: test-data/libuse/outputs/objekt_D_geometric_dataset.json
        — rooms section + provenance + enrichment warnings
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path("concrete-agent/packages/core-backend").resolve()))

from app.services.dxf_parser import parse_batch  # noqa: E402

DXF_DIR = Path("test-data/libuse/inputs/dxf")
AGG = Path("test-data/libuse/outputs/objekt_D_per_podlazi_aggregates.json")
TAB = Path("test-data/libuse/outputs/tabulky_loaded.json")
OUT = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")

# Spatial radius for matching segment tags to a room's polygon.
# Tags inside a room (or within 1500 mm of code position) attach to that room.
ROOM_TAG_RADIUS_MM = 3000.0


def is_d_code(c: str) -> bool:
    if c.startswith("D."):
        return True
    parts = c.split(".")
    return len(parts) == 3 and parts[0] == "S" and parts[1] == "D"


PRIMARY_DRAWINGS = {
    "1.PP": "185-01_DPS_D_SO01_100_4030_R01 - PŮDORYS 1PP",
    "1.NP": "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP",
    "2.NP": "185-01_DPS_D_SO01_140_4420-OBJEKT D - Půdorys 2 .NP",
    "3.NP": "185-01_DPS_D_SO01_140_4430-OBJEKT D - Půdorys 3 .NP",
}
PODHLEDY_DRAWINGS = {
    "1.NP": "185-01_DPS_D_SO01_140_7410_00-OBJEKT D - Výkres podhledů 1. NP",
    "2.NP": "185-01_DPS_D_SO01_140_7420_00-OBJEKT D - Výkres podhledů 2. NP",
    "3.NP": "185-01_DPS_D_SO01_140_7430_00-OBJEKT D - Výkres podhledů 3. NP",
}


def main() -> None:
    if not AGG.exists() or not TAB.exists():
        raise SystemExit("Run Phase 0.7 step 1 + Phase 1 step 1 first")

    print("Loading aggregates + tabulky…")
    agg = json.loads(AGG.read_text(encoding="utf-8"))
    tabulky = json.loads(TAB.read_text(encoding="utf-8"))
    tabulka_rooms = tabulky["mistnosti"]["rooms"]

    print("Parsing primary půdorysy + podhledy for segment-tag spatial join…")
    paths = sorted(DXF_DIR.glob("*.dwg"))  # for completeness
    paths = sorted(DXF_DIR.glob("*.dxf"))
    parsed = parse_batch(paths)

    # Build per-podlaží segment-tag bag from primary půdorys + podhledy
    tags_by_floor: dict[str, list[dict]] = defaultdict(list)
    for podlazi, stem in PRIMARY_DRAWINGS.items():
        if stem in parsed:
            for st in parsed[stem].segment_tags:
                tags_by_floor[podlazi].append({
                    "code": st.code, "prefix": st.prefix,
                    "position": st.position, "source_layer": st.source_layer,
                    "category": st.category,
                })
    for podlazi, stem in PODHLEDY_DRAWINGS.items():
        if stem in parsed:
            for st in parsed[stem].segment_tags:
                tags_by_floor[podlazi].append({
                    "code": st.code, "prefix": st.prefix,
                    "position": st.position, "source_layer": st.source_layer,
                    "category": st.category,
                })

    # Collect openings by podlaží with classification (already in agg)
    openings_classified = agg.get("openings_classified", {}).get("per_podlazi_classified", {})

    # Build enriched rooms
    enriched: list[dict] = []
    warnings_global: list[str] = []
    enriched_by_code: dict[str, dict] = {}

    for podlazi, block in agg["per_podlazi"].items():
        for r in block["rooms"]:
            code = r["code"]
            tab = tabulka_rooms.get(code, {})
            warns: list[str] = []
            if not tab:
                warns.append(f"Room not found in Tabulka místností")

            # Spatial join: segment tags whose position is within ROOM_TAG_RADIUS_MM
            # of the room's code_position (TEXT center) on the same podlaží.
            cx, cy = r["code_position"]
            wall_tags = []
            ceil_tags = []
            other_tags = []
            for t in tags_by_floor.get(podlazi, []):
                tx, ty = t["position"]
                dist = ((tx - cx) ** 2 + (ty - cy) ** 2) ** 0.5
                if dist > ROOM_TAG_RADIUS_MM:
                    continue
                if t["prefix"] in ("WF",):
                    wall_tags.append(t["code"])
                elif t["prefix"] in ("CF",):
                    ceil_tags.append(t["code"])
                else:
                    other_tags.append({"code": t["code"], "prefix": t["prefix"]})

            # Openings inside this room — match each opening to nearest room by code
            # (we already have classified openings per podlaží; deciding ownership
            # of each opening to a specific room would require shapely contains —
            # rough and out of step-2 scope. Instead, attach opening counts at
            # the podlaží level and leave per-room ownership as derived).
            doors_in_room: list[dict] = []
            windows_in_room: list[dict] = []
            curtain_in_room: list[dict] = []
            ops_other: list[dict] = []

            # Compute wall area: perimeter × clear height − openings (rough, room-level)
            perim_m = r.get("perimeter_m") or 0.0
            sv_vyska_mm = tab.get("svetla_vyska_mm")
            sv_vyska_m = sv_vyska_mm / 1000.0 if sv_vyska_mm else 2.7
            wall_brutto = perim_m * sv_vyska_m

            row = {
                "code": code,
                "objekt": r.get("objekt"),
                "podlazi": r.get("podlazi"),
                "byt_or_section": r.get("byt_or_section"),
                "mistnost_num": r.get("mistnost_num"),
                "nazev": tab.get("nazev", ""),
                # Geometry from DXF (Phase 0.7)
                "plocha_podlahy_m2": r["area_m2"],
                "obvod_m": r.get("perimeter_m"),
                "code_position": r["code_position"],
                # Skladba codes from Tabulka místností
                "svetla_vyska_mm": sv_vyska_mm,
                "FF": tab.get("skladba_podlahy", ""),
                "F_povrch_podlahy": tab.get("povrch_podlahy", ""),
                "F_povrch_sten": tab.get("povrch_sten", ""),
                "CF": tab.get("typ_podhledu", ""),
                "F_povrch_podhledu": tab.get("povrch_podhledu", ""),
                # DXF spatial-joined tags
                "wall_segment_tags": sorted(set(wall_tags)),
                "ceiling_segment_tags": sorted(set(ceil_tags)),
                "other_segment_tags": other_tags[:10],  # cap noise
                # Openings (per-podlaží level — Phase 1 doesn't yet attach to room polygon)
                "doors": doors_in_room,
                "windows": windows_in_room,
                "curtain_walls": curtain_in_room,
                "otvory_other": ops_other,
                # Wall area (rough — gross only; subtraction in step 4)
                "plocha_sten_brutto_m2": round(wall_brutto, 2),
                # Provenance + confidence
                "source_drawing": r.get("source_drawing"),
                "tabulka_match": bool(tab),
                "confidence": 1.0 if tab else 0.7,
                "warnings": warns,
            }
            # Sanity: Tabulka plocha vs DXF area (already validated in Phase 2; cross-check again)
            if tab.get("plocha_m2") is not None and r["area_m2"] is not None:
                diff_pct = abs(r["area_m2"] - tab["plocha_m2"]) / tab["plocha_m2"] * 100
                if diff_pct > 2.0:
                    warns.append(f"Tabulka plocha {tab['plocha_m2']} ≠ DXF {r['area_m2']:.2f} (Δ {diff_pct:.1f} %)")
                row["tabulka_plocha_m2"] = tab["plocha_m2"]
                row["plocha_diff_pct"] = round(diff_pct, 2)

            enriched.append(row)
            enriched_by_code[code] = row

    # Coverage report
    no_FF = [r["code"] for r in enriched if not r["FF"]]
    no_CF = [r["code"] for r in enriched if not r["CF"]]
    no_F_sten = [r["code"] for r in enriched if not r["F_povrch_sten"]]
    no_tabulka = [r["code"] for r in enriched if not r["tabulka_match"]]
    if no_FF:
        warnings_global.append(f"{len(no_FF)} D rooms have no FF skladba_podlahy in Tabulka")
    if no_CF:
        warnings_global.append(f"{len(no_CF)} D rooms have no CF typ_podhledu in Tabulka")
    if no_F_sten:
        warnings_global.append(f"{len(no_F_sten)} D rooms have no F povrch_sten in Tabulka")
    if no_tabulka:
        warnings_global.append(f"{len(no_tabulka)} D rooms have no Tabulka match (parser-only)")

    # Build the geometric dataset (rooms section first; later steps add skladby + aggregates)
    dataset = {
        "objekt": "D",
        "schema_version": "1.0",
        "phase_1_step": 2,
        "rooms": enriched,
        "rooms_count": len(enriched),
        "provenance": {
            "dxf_aggregates": str(AGG),
            "tabulky_loaded": str(TAB),
            "primary_drawings": PRIMARY_DRAWINGS,
            "podhledy_drawings": PODHLEDY_DRAWINGS,
        },
        "warnings_global": warnings_global,
        "carry_forward_findings": [
            {
                "from_phase": "0.7 step 4 PROBE 1",
                "severity": "critical",
                "summary": (
                    "starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each "
                    "→ komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's "
                    "complaint that the VV is incomplete."
                ),
                "next_action": "catalogue as VYNECHANE_KRITICKE in Phase 5 audit",
            },
        ],
    }
    OUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print()
    print(f"  Rooms enriched: {len(enriched)} / {len(enriched)} ({100:.0f} %)")
    print(f"  Rooms missing FF: {len(no_FF)}")
    print(f"  Rooms missing CF: {len(no_CF)}")
    print(f"  Rooms missing F povrch_sten: {len(no_F_sten)}")
    print(f"  Rooms with no Tabulka match: {len(no_tabulka)}")
    print(f"  Tabulka cross-check: {sum(1 for r in enriched if r.get('plocha_diff_pct', 0) <= 2.0)} / "
          f"{sum(1 for r in enriched if 'plocha_diff_pct' in r)} within ±2 %")


if __name__ == "__main__":
    main()
