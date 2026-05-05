"""Phase 0.17 — Keramický obklad bytových koupelen — gap fill.

Per-room calculation: brutto_sten = obvod × světlá_výška, minus door
area, minus existing items. Add gap if > 0.5 m².

Reality check (per Phase 0.14b updated):
  Phase 0.14b initial estimate ~109 m² gap was based on triangulation
  outlier (matched Terca cihelné pásky for whole complex 142166 ks
  fasáda, not bytové koupelny). Real per-room calc shows Phase 6
  generator already covers ~95% — only small rounding gaps remain
  (likely from konzervativní výška 2.30m vs actual 2.40m).

  Real total gap: 5.74 m² across 6 KOUPELNY (gaps 0.77–1.20 m² each).
  WC rooms over-spec'd already, no gap.

Per starý VV pol. 688 + 689 (kódy):
  688: Montáž obkladů vnitřních keramických 30×60cm (m², 980 Kč/m²)
  689: Slinutý keramický obklad Rako Extra (m², 670 Kč/m² — materiál)
  Total per m² = 1650 Kč

Per master Tabulka 0030 F06: keramický obklad 30×60cm bílý, slinutý,
rohové lišty nerezové, hydroizolační stěrka 300mm + sprchový kout.
"""
from __future__ import annotations

import json
import uuid
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
OWN = OUT_DIR / "objekt_D_doors_ownership.json"

URS_KOD_MONTAZ = "781R688"
URS_KOD_MATERIAL = "781R689"
PRICE_MONTAZ = 980.0
PRICE_MATERIAL = 670.0
GAP_THRESHOLD_M2 = 0.5


def is_objekt_D(c: str) -> bool:
    return (c.startswith("D.1.") or c.startswith("D.2.")
            or c.startswith("D.3.") or c.startswith("S.D."))


def main() -> None:
    print("=" * 72)
    print("PHASE 0.17 — Keramický obklad bytové koupelny — gap fill")
    print("=" * 72)

    ds = json.loads(DS.read_text(encoding="utf-8"))
    items_blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = items_blob["items"]
    own = json.loads(OWN.read_text(encoding="utf-8"))["ownership"]

    # existing keramický obklad: take MAX per room (montáž + materiál
    # are paired duplicates of m², not double-count)
    existing: dict[str, float] = defaultdict(float)
    for it in items:
        if (it.get("mnozstvi") or 0) <= 0:
            continue
        if it.get("status") == "deprecated":
            continue
        p = it["popis"].lower()
        if "keramick" in p and "obklad" in p and "pásk" not in p and "terca" not in p:
            rc = (it.get("misto", {}).get("mistnosti") or [None])[0]
            if rc and is_objekt_D(rc):
                existing[rc] = max(existing[rc], it["mnozstvi"])

    # find gaps
    gap_rooms: list[dict] = []
    for r in ds["rooms"]:
        if not is_objekt_D(r["code"]):
            continue
        nm = (r.get("nazev") or "").upper()
        if "KOUPELN" not in nm and nm != "WC":
            continue
        obvod = r.get("obvod_m") or 0
        vyska = (r.get("svetla_vyska_mm") or 0) / 1000.0
        if obvod <= 0 or vyska <= 0:
            continue
        brutto = obvod * vyska
        door_area = sum(
            (d.get("sirka_otvoru_mm", 0) / 1000.0)
            * (d.get("vyska_otvoru_mm", 0) / 1000.0)
            for d in own.get(r["code"], []) if not d.get("is_garage_gate"))
        expected = max(0.0, brutto - door_area)
        existing_m = existing.get(r["code"], 0.0)
        gap = expected - existing_m
        if gap > GAP_THRESHOLD_M2:
            podlazi = (f"{r['code'].split('.')[1]}.NP"
                       if r["code"].startswith("D.") else "1.PP")
            gap_rooms.append({
                "code": r["code"], "nazev": nm,
                "podlazi": podlazi, "obvod_m": obvod, "vyska_m": vyska,
                "brutto": round(brutto, 2),
                "door_area": round(door_area, 2),
                "expected": round(expected, 2),
                "existing": round(existing_m, 2),
                "gap": round(gap, 2),
            })

    print(f"\nKOUPELNY/WC s gap > {GAP_THRESHOLD_M2} m²: {len(gap_rooms)}")
    total_gap = sum(g["gap"] for g in gap_rooms)
    print(f"Total gap: {total_gap:.2f} m²")
    if total_gap == 0:
        print("✓ No gap — Phase 6 generator already covers expected.")
        return
    if total_gap > 50:
        print(f"⛔ STOP — gap {total_gap:.2f} m² excessive (expected <50)")
        return

    new_items: list[dict] = []
    for g in gap_rooms:
        for kod, cena, label in (
            (URS_KOD_MONTAZ, PRICE_MONTAZ, "Montáž obkladu — gap fill"),
            (URS_KOD_MATERIAL, PRICE_MATERIAL,
             "Slinutý keramický obklad Rako Extra 30×60 — gap fill"),
        ):
            new_items.append({
                "item_id": str(uuid.uuid4()),
                "kapitola": "PSV-781",
                "popis": f"{label} v koupelně/WC (F06)",
                "popis_canonical": label,
                "MJ": "m2",
                "mnozstvi": g["gap"],
                "misto": {"objekt": "D", "podlazi": g["podlazi"],
                           "mistnosti": [g["code"]]},
                "skladba_ref": {"F_povrch_sten": "F06",
                                 "vrstva": "keramický obklad gap"},
                "vyrobce_ref": "Rako Extra slinutá 30×60cm bílá",
                "urs_code": kod,
                "urs_status": "needs_review",
                "urs_confidence": 0.85,
                "urs_alternatives": [],
                "unit_price_kc": cena,
                "total_price_kc": round(g["gap"] * cena, 2),
                "confidence": 0.80,
                "status": "to_audit",
                "source_method": "PHASE_0_17_keramicky_obklad_gap",
                "audit_note": (
                    f"PHASE_0_17: gap = brutto({g['brutto']}) - dveře"
                    f"({g['door_area']}) - existing({g['existing']}) = "
                    f"{g['gap']} m². Likely Phase 6 generator used "
                    f"konzervativní výška assumption 2.30m vs "
                    f"actual {g['vyska_m']}m."
                ),
                "warnings": [],
            })

    # spot-check: 3 (smallest, median, largest gap rooms)
    sorted_gaps = sorted(gap_rooms, key=lambda x: x["gap"])
    samples = ([sorted_gaps[0], sorted_gaps[len(sorted_gaps) // 2],
                sorted_gaps[-1]] if len(sorted_gaps) >= 3 else sorted_gaps)
    print(f"\nSpot-check 3 rooms:")
    for s in samples:
        scope_ok = is_objekt_D(s["code"])
        kindok = ("KOUPELN" in s["nazev"] or s["nazev"] == "WC")
        gap_ok = s["gap"] > GAP_THRESHOLD_M2
        print(f"  {s['code']:12s} {s['nazev']:10s} brutto={s['brutto']} "
              f"-dveře={s['door_area']} -exist={s['existing']} = "
              f"gap {s['gap']} m² | scope={scope_ok} kind={kindok} "
              f"gap_ok={gap_ok}")
        if not (scope_ok and kindok and gap_ok):
            print("⛔ SPOT-CHECK FAIL"); return

    items.extend(new_items)
    items_blob["items"] = items
    items_blob["metadata"]["items_count"] = len(items)
    items_blob["metadata"]["phase_0_17_applied"] = True
    ITEMS.write_text(json.dumps(items_blob, ensure_ascii=False, indent=2),
                     encoding="utf-8")

    total_kc = sum(i["total_price_kc"] for i in new_items)
    print(f"\n✅ PHASE 0.17 RESULTS:")
    print(f"   Items added: {len(new_items)} (2× per gap room — "
          f"montáž + materiál)")
    print(f"   Total gap surface: {total_gap:.2f} m²")
    print(f"   Total recovery: {total_kc:>10,.0f} Kč")


if __name__ == "__main__":
    main()
