"""Phase 0.11 — Manually inject S.D.16 + S.D.42 missed by DXF parser.

Phase 0.x DXF parser missed 2 sklepní kóje (S.D.16 SKLEPNÍ KÓJE - C
7.62 m² + S.D.42 SKLEPNÍ KÓJE - D 2.99 m²) — both ARE drawn on PDF
půdorys 1.PP and ARE in Tabulka místností XLSX with full metadata.
Phase 0.10 audit flagged this as D4 finding.

Root cause likely: text label position fell on a polygon boundary line
so shapely.contains() returned False for both adjacent polygons. Or the
text was on a non-A-AREA-IDEN layer.

This patcher:
  1. Adds 2 room records to dataset.rooms (using XLSX values + estimated
     code_position from Tabulka 0041 door connections + peer kóje pattern)
  2. Generates 11-item set per kóje mirroring peer S.D.27 (HSV-611 omítka
     × 3, HSV-631 podlaha × 3, PSV-784 malba × 4, plus paired material)
  3. Updates carry_forward_findings to log manual injection

After this patch, audit D4 finding is closed and Excel List 1 + List 4
contain rows for both rooms.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
DOORS = OUT_DIR / "objekt_D_doors_ownership.json"

# From Tabulka místností XLSX (R01) + user's screenshot annotation:
#   "Všechny ŽB stěny s povrchem F14" (= bezprašný nátěr, ne omítka)
INJECTED_ROOMS = [
    {
        "code": "S.D.16",
        "objekt": "D",
        "podlazi": "1.PP",
        "byt_or_section": "1.PP",
        "mistnost_num": "16",
        "nazev": "SKLEPNÍ KÓJE - C",
        "plocha_podlahy_m2": 7.62,
        "tabulka_plocha_m2": 7.62,
        "plocha_diff_pct": 0.0,
        "svetla_vyska_mm": 3400,
        # estimated obvod for area 7.62 m² assuming ~2.2x3.5 m rectangle
        "obvod_m": 11.4,
        "plocha_sten_brutto_m2": 11.4 * 3.4,  # 38.76 m²
        # Code position estimated from PDF (between detected S.D.15 and S.D.17)
        "code_position": [9700.0, 8000.0],
        "FF": "FF01",
        "F_povrch_podlahy": "F11",
        "F_povrch_sten": "F19",
        "F_povrch_podhledu": "F15",
        "wall_segment_tags": [],
        "ceiling_segment_tags": [],
        "other_segment_tags": [],
        "doors": [],
        "windows": [],
        "curtain_walls": [],
        "otvory_other": [],
        "tabulka_match": True,
        "confidence": 0.7,
        "source_drawing": "PHASE_0_11_manual_inject_from_XLSX",
        "warnings": [
            "PHASE_0_11: Manually injected — DXF parser missed this room "
            "(Phase 0.x text label spatial join failed). Geometry estimated "
            "from XLSX area + peer kóje pattern. obvod_m approximate."
        ],
        "manual_injection": True,
        "poznamka": "Všechny ŽB stěny s povrchem F14",
    },
    {
        "code": "S.D.42",
        "objekt": "D",
        "podlazi": "1.PP",
        "byt_or_section": "1.PP",
        "mistnost_num": "42",
        "nazev": "SKLEPNÍ KÓJE - D",
        "plocha_podlahy_m2": 2.99,
        "tabulka_plocha_m2": 2.99,
        "plocha_diff_pct": 0.0,
        "svetla_vyska_mm": 2800,
        # estimated obvod for area 2.99 m² assuming ~1.6×1.9 m rectangle
        "obvod_m": 7.0,
        "plocha_sten_brutto_m2": 7.0 * 2.8,  # 19.6 m²
        # Code position estimated from PDF (between detected S.D.41 and S.D.43)
        "code_position": [-15000.0, 60000.0],
        "FF": "FF01",
        "F_povrch_podlahy": "F11",
        "F_povrch_sten": "F19",
        "F_povrch_podhledu": "F15",
        "wall_segment_tags": [],
        "ceiling_segment_tags": [],
        "other_segment_tags": [],
        "doors": [],
        "windows": [],
        "curtain_walls": [],
        "otvory_other": [],
        "tabulka_match": True,
        "confidence": 0.7,
        "source_drawing": "PHASE_0_11_manual_inject_from_XLSX",
        "warnings": [
            "PHASE_0_11: Manually injected — DXF parser missed this room. "
            "Geometry estimated from XLSX area. obvod_m approximate."
        ],
        "manual_injection": True,
        "poznamka": "Všechny ŽB stěny s povrchem F14",
    },
]


def make_item(room_code: str, podlazi: str, kapitola: str, popis: str,
              mnozstvi: float, mj: str, *, popis_canonical: str = "",
              note: str = "PHASE_0_11_manual_inject") -> dict:
    return {
        "item_id": str(uuid.uuid4()),
        "kapitola": kapitola,
        "popis": popis,
        "popis_canonical": popis_canonical or popis,
        "MJ": mj,
        "mnozstvi": round(mnozstvi, 3),
        "misto": {
            "objekt": "D",
            "podlazi": podlazi,
            "mistnosti": [room_code],
        },
        "skladba_ref": {},
        "vyrobce_ref": "",
        "urs_code": None,
        "urs_status": "needs_review",
        "urs_confidence": 0.0,
        "urs_alternatives": [],
        "confidence": 0.7,
        "status": "to_audit",
        "source_method": "PHASE_0_11_manual_inject",
        "audit_note": note,
        "warnings": [
            "PHASE_0_11: Manually injected — room missed by DXF parser, "
            "qty derived from XLSX plocha + peer kóje pattern."
        ],
    }


def generate_items_for_room(room: dict, doors_for_room: list) -> list[dict]:
    """Mirror S.D.27 11-item template for sklepní kóje."""
    code = room["code"]
    podlazi = room["podlazi"]
    plocha_podlahy = room["plocha_podlahy_m2"]
    obvod = room["obvod_m"]
    vyska = room["svetla_vyska_mm"] / 1000.0  # m
    plocha_sten = obvod * vyska
    # Subtract door openings from wall area
    door_area = sum((d["sirka_otvoru_mm"] / 1000.0) * (d["vyska_otvoru_mm"] / 1000.0)
                     for d in doors_for_room)
    plocha_sten_netto = max(0.0, plocha_sten - door_area)

    # Špalety (1 vnitřní door × 115 mm fallback × 2 strany)
    spalety_vnt = 0.0
    for d in doors_for_room:
        obvod_door = (2 * d["sirka_otvoru_mm"] + 2 * d["vyska_otvoru_mm"]) / 1000.0
        spalety_vnt += obvod_door * 0.115 * 2  # 115mm fallback × 2 strany

    # Per "Všechny ŽB stěny s povrchem F14" note: walls have bezprašný
    # nátěr (F14), NOT vápenocementová omítka (F19 default). So omítka
    # quantities = 0 (matches S.D.27 peer pattern).
    items = [
        make_item(code, podlazi, "HSV-611", "Penetrace pod omítku vápenocementová",
                   0.0, "m2"),
        make_item(code, podlazi, "HSV-611",
                   "Omítka vápenocementová vnitřních ploch tl. 10 mm",
                   0.0, "m2"),
        make_item(code, podlazi, "HSV-611",
                   "Špalety vápenocementová okolo otvorů (žádný fasádní otvor v místnosti)",
                   0.0, "m2"),
        make_item(code, podlazi, "HSV-611",
                   "Špalety vápenocementová okolo otvorů (hloubka 115 mm vnitřní)",
                   spalety_vnt, "m2"),
        make_item(code, podlazi, "HSV-631", "Penetrace pod potěr (FF01)",
                   plocha_podlahy, "m2"),
        make_item(code, podlazi, "HSV-631",
                   "Cementový potěr F5 tl. 50 mm (FF01)", plocha_podlahy, "m2"),
        make_item(code, podlazi, "HSV-631",
                   "Kari síť 150/150/4 mm pro potěr (FF01)",
                   plocha_podlahy * 1.05, "m2"),  # 5% overlap allowance
        make_item(code, podlazi, "PSV-784",
                   "Penetrace stěn pod malbu vápenná (F19)", 0.0, "m2"),
        make_item(code, podlazi, "PSV-784",
                   "Malba vápenná 1. nátěr (F19)", 0.0, "m2"),
        make_item(code, podlazi, "PSV-784",
                   "Malba vápenná 2. nátěr (F19)", 0.0, "m2"),
        make_item(code, podlazi, "PSV-784",
                   "Malba disperzní — dodávka barvy (paired with Malba vápenná 1.+2.)",
                   0.0, "m2"),
    ]

    # Add F14 bezprašný nátěr items (per architect's note "Všechny ŽB stěny F14")
    items.append(make_item(
        code, podlazi, "PSV-783",
        "Bezprašný nátěr ŽB stěn F14 — 1. nátěr",
        plocha_sten_netto, "m2",
        note="PHASE_0_11: per Tabulka místností note 'Všechny ŽB stěny s povrchem F14'"))
    items.append(make_item(
        code, podlazi, "PSV-783",
        "Bezprašný nátěr ŽB stěn F14 — 2. nátěr",
        plocha_sten_netto, "m2",
        note="PHASE_0_11: per Tabulka místností note 'Všechny ŽB stěny s povrchem F14'"))

    return items


def main() -> None:
    print("Loading inputs…")
    ds = json.loads(DS.read_text(encoding="utf-8"))
    items_blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = items_blob["items"]
    door_ownership = json.loads(DOORS.read_text(encoding="utf-8"))["ownership"]

    existing_codes = {r["code"] for r in ds["rooms"]}
    rooms_added = 0
    items_added = 0
    for room in INJECTED_ROOMS:
        if room["code"] in existing_codes:
            print(f"  {room['code']} already in dataset — skipping")
            continue
        ds["rooms"].append(room)
        rooms_added += 1
        doors = door_ownership.get(room["code"], [])
        room_items = generate_items_for_room(room, doors)
        items.extend(room_items)
        items_added += len(room_items)
        print(f"  {room['code']} ({room['nazev']:20s}) "
              f"plocha={room['plocha_podlahy_m2']} m² + {len(room_items)} items")

    # Update carry_forward_findings
    cff = ds.setdefault("carry_forward_findings", [])
    cff.append({
        "phase": "0.11",
        "type": "PARSER_GAP_FIX",
        "description": (
            "Phase 0.x DXF parser missed S.D.16 + S.D.42 SKLEPNÍ KÓJE. "
            "Both rooms ARE drawn on PDF and ARE in Tabulka místností XLSX. "
            "Phase 0.11 manually injected room records + 13-item sets per kóje. "
            "Geometry estimated from XLSX (area, výška) + peer kóje pattern. "
            "obvod_m approximate ±10%."
        ),
        "rooms_affected": [r["code"] for r in INJECTED_ROOMS],
        "items_added": items_added,
    })

    # Persist
    DS.write_text(json.dumps(ds, ensure_ascii=False, indent=2), encoding="utf-8")
    items_blob["items"] = items
    items_blob["metadata"]["items_count"] = len(items)
    items_blob["metadata"]["phase_0_11_applied"] = True
    ITEMS.write_text(json.dumps(items_blob, ensure_ascii=False, indent=2),
                     encoding="utf-8")

    print(f"\n✅ Added {rooms_added} rooms + {items_added} items")
    print(f"  Total items now: {len(items)}")


if __name__ == "__main__":
    main()
