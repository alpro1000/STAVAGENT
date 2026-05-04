"""Phase 6.5 — Špalety actual measurement (L2.5 project-aware per-room).

Replaces Phase 6.4 Part D2 global 30/70 heuristic with per-room
measurement using:
  - room.wall_segment_tags[] (Phase 1 spatial tags) → classify obvodové /
    nosné / příčky / SDK předstěny
  - WF skladba thicknesses (Tabulka skladeb celkova_tloustka_mm)
  - openings_classified per podlaží + nearest-room ownership (Phase 6.4
    pattern reuse)

Per-otvor formula:
  plocha_špalet = obvod × tloušťka × faktor
  faktor: is_fasadni=True → 1 (jen vnitřní strana, fasádní omítka jiná kapitola)
          is_fasadni=False → 2 (obě strany příčky)

Per-room aggregate:
  fasádní_špalety_m² = Σ_otvor_fasádní (obvod × tloušťka_obvodová × 1)
  vnitřní_špalety_m² = Σ_otvor_vnitřní (obvod × tloušťka_vnitřní × 2)

Edge cases:
  - Room with is_fasadni opening but NO obvodový WF tag → STOP (sentinel)
  - Room with wall_segment_tags=[] → projektový průměr 460 / 150 + warning
  - Room with only SDK předstěny WF40-51 → vnitřní fallback 100 mm + warning
"""
from __future__ import annotations

import copy
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
AGG07 = OUT_DIR / "objekt_D_per_podlazi_aggregates.json"

# WF skladba code prefixes → wall category
WF_OBVODOVE = {"WF03", "WF10", "WF11", "WF12", "WF13", "WF14", "WF15",
                "WF16", "WF17", "WF18", "WF19", "WF22", "WF90"}
WF_VNITRNI_NOSNE = {"WF20", "WF21", "WF22", "WF23", "WF24", "WF25"}
WF_PRICKY = {"WF30", "WF31", "WF32"}
WF_SDK = {"WF40", "WF41", "WF50", "WF51"}


def main() -> None:
    items_blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = items_blob["items"]
    ds = json.loads(DS.read_text(encoding="utf-8"))
    agg07 = json.loads(AGG07.read_text(encoding="utf-8"))

    rooms_by_code = {r["code"]: r for r in ds["rooms"]}
    skladby = ds.get("skladby", {})

    # ================================================================
    # STEP 1 — Compute project-wide WF averages (fallback values)
    # ================================================================
    obvodove_thicknesses = []
    nosne_thicknesses = []
    pricky_thicknesses = []
    sdk_thicknesses = []
    for code, sk in skladby.items():
        tl = sk.get("celkova_tloustka_mm")
        if not tl:
            continue
        if code in WF_OBVODOVE:
            obvodove_thicknesses.append(tl)
        elif code in WF_VNITRNI_NOSNE:
            nosne_thicknesses.append(tl)
        elif code in WF_PRICKY:
            pricky_thicknesses.append(tl)
        elif code in WF_SDK:
            sdk_thicknesses.append(tl)

    PROJ_AVG_OBVODOVA = round(statistics.mean(obvodove_thicknesses), 0) if obvodove_thicknesses else 460
    PROJ_AVG_NOSNA = round(statistics.mean(nosne_thicknesses), 0) if nosne_thicknesses else 220
    PROJ_AVG_PRICKA = round(statistics.mean(pricky_thicknesses), 0) if pricky_thicknesses else 95
    PROJ_AVG_SDK = round(statistics.mean(sdk_thicknesses), 0) if sdk_thicknesses else 125

    # Vnitřní average (mix of nosné + příčky weighted by usage; simple mean here)
    vnitrni_combined = nosne_thicknesses + pricky_thicknesses
    PROJ_AVG_VNITRNI = round(statistics.mean(vnitrni_combined), 0) if vnitrni_combined else 150

    print("Project-wide WF averages (mm):")
    print(f"  obvodová:        {PROJ_AVG_OBVODOVA} (from {len(obvodove_thicknesses)} skladeb)")
    print(f"  vnitřní nosné:   {PROJ_AVG_NOSNA} (from {len(nosne_thicknesses)} skladeb)")
    print(f"  vnitřní příčky:  {PROJ_AVG_PRICKA} (from {len(pricky_thicknesses)} skladeb)")
    print(f"  vnitřní mix:     {PROJ_AVG_VNITRNI} (combined)")
    print(f"  SDK předstěny:   {PROJ_AVG_SDK}")

    # ================================================================
    # STEP 2 — Per-room wall classification + per-room avg tloušťky
    # ================================================================
    room_wall_thickness: dict[str, dict] = {}
    for code, room in rooms_by_code.items():
        tags = room.get("wall_segment_tags") or []
        room_obv = [skladby[t]["celkova_tloustka_mm"] for t in tags
                     if t in WF_OBVODOVE and t in skladby
                     and skladby[t].get("celkova_tloustka_mm")]
        room_vnt = [skladby[t]["celkova_tloustka_mm"] for t in tags
                     if t in (WF_VNITRNI_NOSNE | WF_PRICKY) and t in skladby
                     and skladby[t].get("celkova_tloustka_mm")]
        room_sdk_only = bool(tags) and all(t in WF_SDK for t in tags)
        room_wall_thickness[code] = {
            "tags": tags,
            "obvodova_avg": round(statistics.mean(room_obv), 0) if room_obv else None,
            "vnitrni_avg": round(statistics.mean(room_vnt), 0) if room_vnt else None,
            "sdk_only": room_sdk_only,
        }

    # ================================================================
    # STEP 3 — Per-room opening assignment (nearest-room, Phase 6.4 pattern)
    # ================================================================
    openings_classified = agg07.get("openings_classified", {}).get("per_podlazi_classified", {})

    rooms_by_floor: dict[str, list[dict]] = defaultdict(list)
    for r in ds["rooms"]:
        rooms_by_floor[r["podlazi"]].append(r)

    openings_by_room: dict[str, list[dict]] = defaultdict(list)
    for podlazi, block in openings_classified.items():
        cands = rooms_by_floor.get(podlazi, [])
        if not cands:
            continue
        for o in block.get("openings", []):
            ox, oy = o["position"]
            best = None
            best_d = None
            for r in cands:
                rx, ry = r["code_position"]
                d = ((ox - rx) ** 2 + (oy - ry) ** 2) ** 0.5
                if best is None or d < best_d:
                    best = r["code"]
                    best_d = d
            if best:
                openings_by_room[best].append(o)

    # ================================================================
    # STEP 4 — Compute new špalety m² per room (fasádní + vnitřní)
    # ================================================================
    new_spalety: dict[str, dict] = {}  # room_code → {fas_m2, vnt_m2, source, warnings}
    edge_stops: list[dict] = []

    for room_code, room_meta in room_wall_thickness.items():
        ops = openings_by_room.get(room_code, [])
        if not ops:
            new_spalety[room_code] = {
                "fas_m2": 0.0, "vnt_m2": 0.0,
                "source_method": "L2.5_no_openings",
                "confidence": 0.95,
                "warnings": [],
            }
            continue

        warnings_room: list[str] = []
        # Resolve fasádní tloušťka
        if any(o["is_fasadni"] for o in ops):
            if room_meta["obvodova_avg"]:
                tl_fas = room_meta["obvodova_avg"]
                source_fas = f"L2.5: room WF tags {[t for t in room_meta['tags'] if t in WF_OBVODOVE]} avg"
            elif not room_meta["tags"]:
                # Edge case: empty wall_segment_tags but has fasádní opening
                tl_fas = PROJ_AVG_OBVODOVA
                source_fas = f"L2.5_FALLBACK: room has no wall_segment_tags, used project avg {tl_fas} mm"
                warnings_room.append(f"PHASE_6_5: fasádní tloušťka fallback {tl_fas} mm (no room WF tags)")
            else:
                # STOP — has fasádní opening but no obvodový tag (only vnitřní WF found)
                edge_stops.append({
                    "room": room_code,
                    "tags": room_meta["tags"],
                    "fasadni_openings_count": sum(1 for o in ops if o["is_fasadni"]),
                    "issue": "is_fasadni opening exists but NO obvodový WF tag in room",
                })
                tl_fas = PROJ_AVG_OBVODOVA
                source_fas = f"L2.5_EDGE_STOP_FALLBACK: {PROJ_AVG_OBVODOVA} mm (manual review needed)"
                warnings_room.append(
                    f"PHASE_6_5_EDGE_STOP: room has fasádní opening but no obvodový WF tag "
                    f"(only {[t for t in room_meta['tags'] if t in WF_VNITRNI_NOSNE | WF_PRICKY]} found). "
                    f"Used project avg {PROJ_AVG_OBVODOVA} mm as conservative fallback."
                )
        else:
            tl_fas = 0
            source_fas = "no_fasadni_openings"

        # Resolve vnitřní tloušťka
        if any(not o["is_fasadni"] for o in ops):
            if room_meta["vnitrni_avg"]:
                tl_vnt = room_meta["vnitrni_avg"]
                source_vnt = (f"L2.5: room WF tags "
                              f"{[t for t in room_meta['tags'] if t in WF_VNITRNI_NOSNE | WF_PRICKY]} avg")
            elif room_meta["sdk_only"]:
                tl_vnt = PROJ_AVG_SDK
                source_vnt = f"L2.5_SDK_ONLY: room has only SDK předstěny, used {tl_vnt} mm"
                warnings_room.append(
                    f"PHASE_6_5: vnitřní tloušťka {tl_vnt} mm (SDK only — minimal jamb depth)"
                )
            elif not room_meta["tags"]:
                tl_vnt = PROJ_AVG_VNITRNI
                source_vnt = f"L2.5_FALLBACK: no room WF tags, used project avg {tl_vnt} mm"
                warnings_room.append(
                    f"PHASE_6_5: vnitřní tloušťka fallback {tl_vnt} mm (no room WF tags)"
                )
            else:
                tl_vnt = PROJ_AVG_VNITRNI
                source_vnt = f"L2.5_FALLBACK_PROJ_AVG: {tl_vnt} mm (no vnitřní WF in room)"
                warnings_room.append(f"PHASE_6_5: vnitřní tloušťka fallback {tl_vnt} mm")
        else:
            tl_vnt = 0
            source_vnt = "no_vnitrni_openings"

        # Per-otvor sum
        fas_m2 = 0.0
        vnt_m2 = 0.0
        for o in ops:
            w_mm = o.get("width_mm") or 0
            h_mm = o.get("height_mm") or 0
            obvod_m = (2 * w_mm + 2 * h_mm) / 1000.0  # m
            if o["is_fasadni"]:
                fas_m2 += obvod_m * (tl_fas / 1000.0) * 1
            else:
                vnt_m2 += obvod_m * (tl_vnt / 1000.0) * 2

        new_spalety[room_code] = {
            "fas_m2": round(fas_m2, 3),
            "vnt_m2": round(vnt_m2, 3),
            "source_method": "L2.5",
            "source_detail_fas": source_fas,
            "source_detail_vnt": source_vnt,
            "tl_fas_mm": tl_fas,
            "tl_vnt_mm": tl_vnt,
            "n_fasadni_openings": sum(1 for o in ops if o["is_fasadni"]),
            "n_vnitrni_openings": sum(1 for o in ops if not o["is_fasadni"]),
            "confidence": 0.80,
            "warnings": warnings_room,
        }

    # ================================================================
    # STEP 5 — Update existing items in-place
    # ================================================================
    sum_fas_before = 0.0
    sum_vnt_before = 0.0
    sum_fas_after = 0.0
    sum_vnt_after = 0.0
    items_updated = 0
    items_zeroed = 0
    items_low_conf = 0
    sample_changes: list[dict] = []
    items_by_top_mnozstvi: list[tuple[float, dict]] = []

    for it in items:
        if it["kapitola"] not in ("HSV-611", "HSV-612"):
            continue
        if "palet" not in it["popis"].lower():
            continue

        room_code = (it["misto"].get("mistnosti") or [None])[0]
        if not room_code:
            continue
        is_fas_item = "fasádní" in it["popis"]
        is_vnt_item = "vnitřní" in it["popis"]
        if not (is_fas_item or is_vnt_item):
            continue

        old_qty = it.get("mnozstvi") or 0
        if is_fas_item:
            sum_fas_before += old_qty
        else:
            sum_vnt_before += old_qty

        new_data = new_spalety.get(room_code)
        if not new_data:
            # Room not in dataset — keep as-is
            continue

        new_qty = new_data["fas_m2"] if is_fas_item else new_data["vnt_m2"]
        if is_fas_item:
            sum_fas_after += new_qty
        else:
            sum_vnt_after += new_qty

        # Update item
        it["mnozstvi"] = new_qty
        it["confidence"] = new_data["confidence"]
        it["source_method"] = "L2.5_per_room"
        warns = it.get("warnings") or []
        warns.append(
            f"PHASE_6_5: replaced Phase 6.4 30/70 heuristic with L2.5 measurement "
            f"({'fasádní' if is_fas_item else 'vnitřní'} tloušťka "
            f"{new_data['tl_fas_mm' if is_fas_item else 'tl_vnt_mm']} mm × "
            f"{new_data['n_fasadni_openings' if is_fas_item else 'n_vnitrni_openings']} otvorů)"
        )
        warns.extend(new_data.get("warnings", []))
        it["warnings"] = warns
        it["audit_note"] = (
            (it.get("audit_note", "")
             + f"; phase_6.5 L2.5: {old_qty} → {new_qty}").strip("; ")
        )

        items_updated += 1
        if new_qty == 0:
            items_zeroed += 1
        if new_data["confidence"] < 0.7:
            items_low_conf += 1

        # Capture for top-by-mnozstvi spot-check
        items_by_top_mnozstvi.append((new_qty, {
            "room": room_code,
            "popis": it["popis"],
            "mnozstvi_before": old_qty,
            "mnozstvi_after": new_qty,
            "tloušťka_mm": (new_data["tl_fas_mm"] if is_fas_item else new_data["tl_vnt_mm"]),
            "n_otvorů": (new_data["n_fasadni_openings"] if is_fas_item
                          else new_data["n_vnitrni_openings"]),
            "source": (new_data["source_detail_fas"] if is_fas_item
                        else new_data["source_detail_vnt"]),
        }))

        # Sample 5 from variety
        if len(sample_changes) < 8:
            sample_changes.append({
                "room": room_code,
                "popis": it["popis"][:50],
                "before": old_qty,
                "after": new_qty,
                "delta_pct": ((new_qty - old_qty) / old_qty * 100) if old_qty > 0 else None,
            })

    # Persist
    items_blob["items"] = items
    items_blob["metadata"]["phase_6_5_applied"] = True
    items_blob["metadata"]["phase_6_5_method"] = "L2.5_project_aware_per_room"
    ITEMS.write_text(json.dumps(items_blob, ensure_ascii=False, indent=2),
                     encoding="utf-8")

    # Stats
    print()
    print("=" * 70)
    print("PHASE 6.5 RESULTS")
    print("=" * 70)
    print(f"Items updated: {items_updated}")
    print(f"Items zeroed (kept w/ warning): {items_zeroed}")
    print(f"Items confidence < 0.7: {items_low_conf}")
    print()
    print(f"Sum fasádní špalety m²: {sum_fas_before:.2f} → {sum_fas_after:.2f}  "
          f"(Δ {sum_fas_after - sum_fas_before:+.2f}, "
          f"{(sum_fas_after / sum_fas_before * 100 - 100) if sum_fas_before > 0 else 0:+.1f}%)")
    print(f"Sum vnitřní špalety m²: {sum_vnt_before:.2f} → {sum_vnt_after:.2f}  "
          f"(Δ {sum_vnt_after - sum_vnt_before:+.2f}, "
          f"{(sum_vnt_after / sum_vnt_before * 100 - 100) if sum_vnt_before > 0 else 0:+.1f}%)")

    # Golden case
    print()
    golden = new_spalety.get("D.1.1.01", {})
    print(f"GOLDEN CASE D.1.1.01 (CHODBA):")
    print(f"  fasádní špalety: {golden.get('fas_m2', '?'):.3f} m² (expected ~0)")
    print(f"  vnitřní špalety: {golden.get('vnt_m2', '?'):.3f} m²")
    print(f"  fasádní openings: {golden.get('n_fasadni_openings', '?')}")
    print(f"  vnitřní openings: {golden.get('n_vnitrni_openings', '?')}")
    print(f"  tl_fas={golden.get('tl_fas_mm', '?')} tl_vnt={golden.get('tl_vnt_mm', '?')}")

    # Top 5 by mnozstvi
    print()
    print("TOP 5 ITEMS BY MNOZSTVI (L2.5 measurement, confidence 0.80):")
    items_by_top_mnozstvi.sort(key=lambda x: -x[0])
    for i, (qty, data) in enumerate(items_by_top_mnozstvi[:5], 1):
        print(f"  {i}. {data['room']} | {data['popis'][:40]}")
        print(f"     {data['mnozstvi_before']:.3f} → {data['mnozstvi_after']:.3f} m² "
              f"(tloušťka {data['tloušťka_mm']:.0f} mm × {data['n_otvorů']} otvorů)")
        print(f"     {data['source']}")

    # Edge stops
    if edge_stops:
        print()
        print(f"EDGE_STOPS ({len(edge_stops)} rooms with is_fasadni opening but no obvodový WF tag):")
        for e in edge_stops[:5]:
            print(f"  {e['room']}: {e['fasadni_openings_count']} fasádní openings, "
                  f"tags={e['tags']}")
            print(f"    issue: {e['issue']}")

    # Sample 5 changes (variety)
    print()
    print("SAMPLE 5 CHANGES (variety):")
    for s in sample_changes[:5]:
        delta_str = f"({s['delta_pct']:+.1f}%)" if s['delta_pct'] is not None else "(zero before)"
        print(f"  {s['room']:12s} {s['popis']:50s} {s['before']:.3f} → {s['after']:.3f} m² {delta_str}")


if __name__ == "__main__":
    main()
