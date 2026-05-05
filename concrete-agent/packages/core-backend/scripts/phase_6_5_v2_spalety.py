"""Phase 6.5 v2 — Špalety actual measurement (5-bug fix pack).

Replaces v1 (which had 5 inter-related bugs found during VELTON spot-check).

Bug #1 — WF skladby extraction: v1 had 2/26 WF skladeb (Phase 0.x parsed
  wrong source). Fixed in ``phase_0_8_extract_master_skladby.py`` →
  geometric_dataset now has all 26.

Bug #2 — Per-room ownership: v1 used nearest-room geometric clustering,
  which assigned 11 doors to 4 m² S.D.27 cellar (real: 1 door). Fixed by
  ``phase_0_9_extract_doors_ownership.py`` → doors come from Tabulka 0041
  z_místnoti/do_místnoti columns. Windows + CW keep nearest-room (no
  clustering issue for residential rooms — typical 1 window per room).

Bug #3 — Garage gate filter: D05 5700×2100 mm Hoermann gates have system
  frames, no traditional špalety. Excluded via ``is_garage_gate`` in
  ownership data.

Bug #4 — Fallback bias: v1 PROJ_AVG_PRICKA = 50 mm (= WF32 podezdívka van,
  jediná detekovaná příčka v 2/26 extract). Now uses weighted median over
  generic příčky (specifikum=None) → 115 mm.

Bug #5 — Item popis sync: v1 left "(hloubka 200 mm vnitřní)" inherited
  from Phase 6.4 even when actual L2.5 thickness was 50 mm. Now popis is
  regenerated with actual thickness used.
"""
from __future__ import annotations

import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
AGG07 = OUT_DIR / "objekt_D_per_podlazi_aggregates.json"
DOORS_OWNERSHIP = OUT_DIR / "objekt_D_doors_ownership.json"

WF_SDK = {"WF40", "WF41", "WF50", "WF51"}


def kind_label(kind: str) -> str:
    return {"obvodova": "obvodová",
            "vnitrni_nosna": "vnitřní nosná",
            "pricka": "vnitřní příčka",
            "sdk": "SDK předstěna"}.get(kind, kind or "?")


def median_typical(skladby: dict, kind: str, exclude_atika: bool = False) -> float | None:
    """Bug #4 — weighted median fallback over generic skladby of one kind.

    Excludes specifikum-flagged variants (instalacni_sachta, podezdivka_van,
    podezdivka_schodiste, ocel_HEB) so the fallback reflects typical
    construction, not edge cases.
    """
    candidates = [
        s for s in skladby.values()
        if s.get("kind") == kind
        and s.get("specifikum") is None
        and s.get("celkova_tloustka_mm")
    ]
    if exclude_atika and kind == "obvodova":
        candidates = [s for s in candidates
                       if "atika" not in (s.get("label") or "").lower()]
    if not candidates:
        # Fall back to all of this kind (including specifikum) before giving up
        candidates = [s for s in skladby.values()
                       if s.get("kind") == kind and s.get("celkova_tloustka_mm")]
    if not candidates:
        return None
    return statistics.median([s["celkova_tloustka_mm"] for s in candidates])


def resolve_room_thickness(room_meta: dict, skladby: dict, kind: str) -> int | None:
    """Compute room's average tloušťka for one kind from its WF tags.

    Skips localized special-case skladby (specifikum != None) — they
    represent partial walls (podezdívka van under bathtub, instalační
    šachta, etc.) not the dominant wall in which dveře are installed.
    Without this filter, a room tagged only WF32 (Ytong 50mm bath
    podezdívka) would resolve dveře špalety to 50mm — wrong. Falls back
    to PROJ_PRICKA (115mm) instead, which is the typical Porotherm 11.5
    interior wall in which dveře sit.
    """
    tags = room_meta.get("wall_segment_tags") or []
    matched_tl = [skladby[t]["celkova_tloustka_mm"]
                  for t in tags
                  if t in skladby
                  and skladby[t].get("kind") == kind
                  and skladby[t].get("specifikum") is None
                  and skladby[t].get("celkova_tloustka_mm")]
    if not matched_tl:
        return None
    return int(round(statistics.mean(matched_tl)))


def main() -> None:
    print("Loading inputs…")
    items_blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = items_blob["items"]
    ds = json.loads(DS.read_text(encoding="utf-8"))
    agg07 = json.loads(AGG07.read_text(encoding="utf-8"))
    ownership_blob = json.loads(DOORS_OWNERSHIP.read_text(encoding="utf-8"))
    door_ownership: dict[str, list[dict]] = ownership_blob["ownership"]

    rooms_by_code = {r["code"]: r for r in ds["rooms"]}
    skladby = ds.get("skladby", {})
    wf_count = sum(1 for c in skladby if c.startswith("WF"))
    print(f"  Rooms: {len(rooms_by_code)} | WF skladby: {wf_count} | "
          f"door ownership rooms: {len(door_ownership)}")

    # Project-wide weighted-median fallbacks (Bug #4)
    PROJ_OBVODOVA = int(round(median_typical(skladby, "obvodova", exclude_atika=True) or 460))
    PROJ_NOSNA = int(round(median_typical(skladby, "vnitrni_nosna") or 250))
    PROJ_PRICKA = int(round(median_typical(skladby, "pricka") or 115))
    PROJ_SDK = int(round(median_typical(skladby, "sdk") or 125))
    print(f"\nProject-wide fallback thicknesses (median of generic skladby):")
    print(f"  obvodová (no atika): {PROJ_OBVODOVA} mm")
    print(f"  vnitřní nosná:       {PROJ_NOSNA} mm")
    print(f"  vnitřní příčka:      {PROJ_PRICKA} mm")
    print(f"  SDK předstěna:       {PROJ_SDK} mm")

    # Build per-room window + CW ownership from per-podlazi (nearest-room)
    openings_classified = (agg07.get("openings_classified", {})
                            .get("per_podlazi_classified", {}))
    rooms_by_floor: dict[str, list[dict]] = defaultdict(list)
    for r in ds["rooms"]:
        rooms_by_floor[r["podlazi"]].append(r)

    windows_by_room: dict[str, list[dict]] = defaultdict(list)
    for podlazi, block in openings_classified.items():
        cands = rooms_by_floor.get(podlazi, [])
        if not cands:
            continue
        for o in block.get("openings", []):
            if o.get("otvor_type") == "door":
                continue  # doors come from Tabulka 0041 ownership now
            ox, oy = o["position"]
            best = None
            best_d = float("inf")
            for r in cands:
                rx, ry = r["code_position"]
                d = ((ox - rx) ** 2 + (oy - ry) ** 2) ** 0.5
                if d < best_d:
                    best = r["code"]
                    best_d = d
            if best:
                windows_by_room[best].append(o)

    # Compute new špalety per room
    new_spalety: dict[str, dict] = {}
    excluded_garage_count = 0
    edge_stops: list[dict] = []

    for room_code, room_meta in rooms_by_code.items():
        # Doors from Tabulka 0041 ownership (Bug #2), excluding garage gates (Bug #3)
        doors = [d for d in door_ownership.get(room_code, [])
                  if not d.get("is_garage_gate")]
        excluded_garage_count += sum(
            1 for d in door_ownership.get(room_code, []) if d.get("is_garage_gate"))
        windows = windows_by_room.get(room_code, [])

        # Doors are vnitřní in 99% případů (z_místnoti+do_místnoti both exist =>
        # interior). Façade entrance doors → flag via from/to is None.
        door_openings = []
        for d in doors:
            is_fas = (d.get("from_room") is None) or (d.get("to_room") is None)
            door_openings.append({
                "kind": "door",
                "width_mm": d.get("sirka_otvoru_mm") or 0,
                "height_mm": d.get("vyska_otvoru_mm") or 0,
                "is_fasadni": is_fas,
            })
        window_openings = []
        for w in windows:
            window_openings.append({
                "kind": w.get("otvor_type") or "window",
                "width_mm": w.get("width_mm") or 0,
                "height_mm": w.get("height_mm") or 0,
                "is_fasadni": bool(w.get("is_fasadni")),
            })
        all_ops = door_openings + window_openings

        if not all_ops:
            new_spalety[room_code] = {
                "fas_m2": 0.0, "vnt_m2": 0.0,
                "tl_fas_mm": 0, "tl_vnt_mm": 0,
                "n_fas": 0, "n_vnt": 0,
                "source": "no_openings", "warnings": [],
                "confidence": 0.95,
            }
            continue

        warnings_room: list[str] = []

        # Resolve fasádní tloušťka
        n_fas = sum(1 for o in all_ops if o["is_fasadni"])
        if n_fas:
            tl_fas = resolve_room_thickness(room_meta, skladby, "obvodova")
            if tl_fas is None:
                tags = room_meta.get("wall_segment_tags") or []
                if not tags:
                    tl_fas = PROJ_OBVODOVA
                    warnings_room.append(
                        f"PHASE_6_5v2: fasádní tloušťka fallback {tl_fas} mm "
                        f"(no wall_segment_tags)")
                else:
                    edge_stops.append({"room": room_code, "tags": tags,
                                       "n_fas": n_fas})
                    tl_fas = PROJ_OBVODOVA
                    warnings_room.append(
                        f"PHASE_6_5v2_EDGE_STOP: room has fasádní opening but "
                        f"no obvodová WF tag (tags={tags}); used {tl_fas} mm")
        else:
            tl_fas = 0

        # Resolve vnitřní tloušťka — preferred order: nosná > příčka > SDK
        n_vnt = sum(1 for o in all_ops if not o["is_fasadni"])
        tl_vnt = 0
        if n_vnt:
            for kind in ("vnitrni_nosna", "pricka", "sdk"):
                t = resolve_room_thickness(room_meta, skladby, kind)
                if t:
                    tl_vnt = t
                    break
            if tl_vnt == 0:
                tags = room_meta.get("wall_segment_tags") or []
                # Bug #4 — use weighted median příčka, NOT WF32 podezdívka van.
                # Sklep cellars typically have Porotherm 11.5 příčky between kojí.
                if all(t in WF_SDK for t in tags) and tags:
                    tl_vnt = PROJ_SDK
                    warnings_room.append(
                        f"PHASE_6_5v2: vnitřní tloušťka {tl_vnt} mm (SDK předstěny only)")
                else:
                    tl_vnt = PROJ_PRICKA
                    warnings_room.append(
                        f"PHASE_6_5v2: vnitřní tloušťka fallback {tl_vnt} mm "
                        f"(median typical příčka, no room WF tags)")

        fas_m2 = 0.0
        vnt_m2 = 0.0
        for o in all_ops:
            obvod_m = (2 * o["width_mm"] + 2 * o["height_mm"]) / 1000.0
            if o["is_fasadni"]:
                fas_m2 += obvod_m * (tl_fas / 1000.0) * 1
            else:
                vnt_m2 += obvod_m * (tl_vnt / 1000.0) * 2

        new_spalety[room_code] = {
            "fas_m2": round(fas_m2, 3),
            "vnt_m2": round(vnt_m2, 3),
            "tl_fas_mm": tl_fas,
            "tl_vnt_mm": tl_vnt,
            "n_fas": n_fas,
            "n_vnt": n_vnt,
            "source": "L2.5_v2_per_room",
            "warnings": warnings_room,
            "confidence": 0.85,
        }

    # Update items in place
    sum_fas_before = sum_fas_after = 0.0
    sum_vnt_before = sum_vnt_after = 0.0
    items_updated = items_zeroed = 0
    sample = []
    spd_27 = []
    spd_40 = []
    sample_residential = []

    POPIS_RE = re.compile(r"\(hloubka\s+\d+\s*mm\s+(fasádní|vnitřní)\)")

    for it in items:
        if it["kapitola"] not in ("HSV-611", "HSV-612"):
            continue
        if "palet" not in it["popis"].lower():
            continue
        room_code = (it["misto"].get("mistnosti") or [None])[0]
        if not room_code:
            continue
        is_fas = "fasádní" in it["popis"]
        is_vnt = "vnitřní" in it["popis"]
        if not (is_fas or is_vnt):
            continue

        old_qty = it.get("mnozstvi") or 0.0
        if is_fas:
            sum_fas_before += old_qty
        else:
            sum_vnt_before += old_qty

        new = new_spalety.get(room_code)
        if not new:
            continue
        new_qty = new["fas_m2"] if is_fas else new["vnt_m2"]
        actual_tl = new["tl_fas_mm"] if is_fas else new["tl_vnt_mm"]

        if is_fas:
            sum_fas_after += new_qty
        else:
            sum_vnt_after += new_qty

        # Bug #5 — regenerate popis with actual tloušťka
        kind_label_str = "fasádní" if is_fas else "vnitřní"
        material_word = "sádrová" if "sádrov" in it["popis"].lower() else "vápenocementová"
        if actual_tl == 0 and new_qty == 0:
            new_popis = (f"Špalety {material_word} okolo otvorů "
                         f"(žádný {kind_label_str} otvor v místnosti)")
        else:
            new_popis = (f"Špalety {material_word} okolo otvorů "
                         f"(hloubka {actual_tl:.0f} mm {kind_label_str})")
        it["popis"] = new_popis

        it["mnozstvi"] = new_qty
        it["confidence"] = new["confidence"]
        it["source_method"] = "L2.5_v2_per_room"
        warns = it.get("warnings") or []
        # Drop v1 PHASE_6_5 warnings (will replace with v2)
        warns = [w for w in warns if not w.startswith("PHASE_6_5:")
                  and not w.startswith("PHASE_6_5_EDGE_STOP:")]
        warns.append(
            f"PHASE_6_5_v2: L2.5 actual measurement "
            f"({kind_label_str} tloušťka {actual_tl} mm × "
            f"{new['n_fas'] if is_fas else new['n_vnt']} otvorů, "
            f"door ownership from Tabulka 0041)")
        warns.extend(new.get("warnings", []))
        it["warnings"] = warns
        it["audit_note"] = (
            (it.get("audit_note", "") + f"; phase_6.5_v2: {old_qty} → {new_qty}").strip("; "))
        items_updated += 1
        if new_qty == 0:
            items_zeroed += 1

        if room_code == "S.D.27":
            spd_27.append((is_fas, old_qty, new_qty, actual_tl))
        if room_code == "S.D.40":
            spd_40.append((is_fas, old_qty, new_qty, actual_tl))
        if room_code in ("D.1.4.07", "D.2.1.07", "D.2.4.07") and not is_fas:
            sample_residential.append((room_code, old_qty, new_qty, actual_tl))
        if len(sample) < 8:
            sample.append({"room": room_code, "popis": new_popis[:55],
                            "before": old_qty, "after": new_qty, "tl": actual_tl})

    items_blob["items"] = items
    items_blob["metadata"]["phase_6_5_v2_applied"] = True
    items_blob["metadata"]["phase_6_5_v2_method"] = "L2.5_v2_per_room_with_tabulka_0041"
    ITEMS.write_text(json.dumps(items_blob, ensure_ascii=False, indent=2),
                     encoding="utf-8")

    # Stats
    print()
    print("=" * 70)
    print("PHASE 6.5 v2 RESULTS")
    print("=" * 70)
    print(f"Items updated: {items_updated} | zeroed: {items_zeroed}")
    print(f"Garage gates excluded from HSV-612: {excluded_garage_count}")
    print(f"Edge stops (fasádní opening, no obvodová WF tag): {len(edge_stops)}")
    print()
    fas_delta = sum_fas_after - sum_fas_before
    vnt_delta = sum_vnt_after - sum_vnt_before
    print(f"Σ fasádní špalety m²: {sum_fas_before:.2f} → {sum_fas_after:.2f}  "
          f"(Δ {fas_delta:+.2f}, {fas_delta/sum_fas_before*100 if sum_fas_before else 0:+.1f}%)")
    print(f"Σ vnitřní špalety m²: {sum_vnt_before:.2f} → {sum_vnt_after:.2f}  "
          f"(Δ {vnt_delta:+.2f}, {vnt_delta/sum_vnt_before*100 if sum_vnt_before else 0:+.1f}%)")

    # Spot-check verification (5 rooms from task spec §4)
    print()
    print("SPOT-CHECK (5 rooms vs ground truth):")
    print(f"  S.D.27 (1 dveře dle Tab 0041, expected ~1 m²):")
    for is_fas, old, new, tl in spd_27:
        kind = "fasádní" if is_fas else "vnitřní"
        print(f"    {kind}: {old:.3f} → {new:.3f} m² (tl. {tl} mm)")
    print(f"  S.D.40 (1 dveře dle Tab 0041, expected ~1 m²):")
    for is_fas, old, new, tl in spd_40:
        kind = "fasádní" if is_fas else "vnitřní"
        print(f"    {kind}: {old:.3f} → {new:.3f} m² (tl. {tl} mm)")
    print(f"  Residential (D.1.4.07, D.2.1.07, D.2.4.07) — vnitřní:")
    for room, old, new, tl in sample_residential:
        print(f"    {room}: {old:.3f} → {new:.3f} m² (tl. {tl} mm)")

    # Golden case D.1.1.01
    g = new_spalety.get("D.1.1.01", {})
    print()
    print(f"GOLDEN CASE D.1.1.01 chodba: fas={g.get('fas_m2',0):.3f} (n={g.get('n_fas',0)}), "
          f"vnt={g.get('vnt_m2',0):.3f} (n={g.get('n_vnt',0)})")

    # Sample of changes
    print()
    print("SAMPLE 8 CHANGES:")
    for s in sample:
        print(f"  {s['room']:12s} {s['popis']:55s} {s['before']:6.3f} → {s['after']:6.3f} m² (tl {s['tl']} mm)")


if __name__ == "__main__":
    main()
