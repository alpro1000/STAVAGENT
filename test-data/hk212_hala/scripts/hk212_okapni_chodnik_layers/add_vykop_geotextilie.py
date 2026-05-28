"""Okapní chodník — add 3 ČSN-required items missing from layer stack.

Supplement to the 7-layer stack (M-VK-020..026). ČSN okapový chodník norma
review revealed 3 missing items:
  - Výkop rýhy hl. 400 mm (depth of all layers) — bez výkopu není kam vrstvy položit
  - Odvoz vykopané zeminy na skládku
  - Geotextilie 300 g/m² separační (zemina/štěrk + proti prorůstání plevele)

Without these the concrete cracks within 1-2 years (no separation = soil
contamination of štěrk + frost heave).

Final 10-item technological order (zdola/od začátku):
  1. M-VK-027 Výkop rýhy 400 mm            22.4 m³ [NEW]
  2. M-VK-028 Odvoz zeminy                 22.4 m³ [NEW]
  3. M-VK-024 Úprava + hutnění zemní pláně 56 m²
  4. M-VK-029 Geotextilie 300 g/m²         56 m²   [NEW]
  5. M-VK-022 Štěrk ŠD 32/63 150 mm        8.4 m³
  6. M-VK-025 Hutnění štěrku               56 m²
  7. M-VK-026 Bednění vnější hrana         16 m²
  8. M-VK-021 KARI Q188                    56 m²
  9. M-VK-020 Beton C25/30 XF3 200 mm      11.2 m³
  10. M-VK-023 Dilatace á 4 m              20 m
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T22:45:00+00:00"
OBVOD = 80.0
SIRE = 0.7
HLOUBKA_RYHY = 0.40
PLOCHA = round(OBVOD * SIRE, 1)               # 56.0
OBJEM_VYKOPU = round(OBVOD * SIRE * HLOUBKA_RYHY, 1)  # 22.4

PATTERN_15_REF = "Work-first generation. KROS catalog mapping in separate Stage 3 task."
SCOPE_BASIS = (
    "ČSN okapový chodník norma + řez A103 detail — výkop + geotextilie "
    "doplněny (DPS gap). Bez výkopu rýhy a geotextilie beton praská do 1-2 let "
    "(kontaminace štěrku zeminou + zdvih mrazem + prorůstání plevele)."
)


def _refs() -> list[dict]:
    return [
        {"type": "document", "code": "A103 řez A-B detail",
         "document": "inputs/vykresy_pdf/A103_rez_AB_DPS_2026-05.pdf",
         "stage": "DPS 06/2026",
         "evidence": "Beton profil zakreslen; výkop rýhy + geotextilie NE (DPS gap)"},
        {"type": "norma", "code": "ČSN 73 6126",
         "section": "Stavba vozovek — podkladní vrstvy"},
        {"type": "norma", "code": "ČSN okapový chodník",
         "section": "výkop rýhy na hloubku vrstev + geotextilie separace"},
    ]


def make_item(*, item_id, popis, mj, mnozstvi, raw_description, qty_formula,
              audit_formula, audit_inputs, audit_poznamka, kros_hint,
              formula_parsed_method="product") -> dict:
    return {
        "id": item_id,
        "kapitola": "M-VK",
        "SO": "SO-13",
        "popis": popis,
        "mj": mj,
        "mnozstvi": mnozstvi,
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "pending_stage_3",
        "urs_match_score": 0.0,
        "skladba_ref": None,
        "source": (
            "ČSN okapový chodník norma + řez A103 detail — výkop + geotextilie "
            "doplněny (DPS gap) + user měření obvodu 79.65 m"
        ),
        "raw_description": raw_description,
        "confidence": 0.80,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": ["ABMV_32"],
        "_status_flag": None,
        "_data_source": "A103_riez+ČSN_okapový_chodník+A101_obvod",
        "_completeness": 1.0,
        "_qty_formula": qty_formula,
        "_export_wrapper_hint": None,
        "_pattern_15_ref": PATTERN_15_REF,
        "_kros_hint": kros_hint,
        "_scope_basis": SCOPE_BASIS,
        "audit_trail": {
            "lokalizace": "venkovní úpravy — okapní chodník po obvodu haly (mimo 4 vstupy) · SO-13",
            "formula": audit_formula,
            "formula_parsed_method": formula_parsed_method,
            "inputs": audit_inputs,
            "reference": _refs(),
            "poznamka": audit_poznamka,
            "confidence": 0.80,
            "extraction_method": "ČSN_okapový_chodník_layer_stack + riez_profil",
            "data_source_hint": "ČSN_okapový_chodník + A103_riez",
            "extracted_at": NOW_ISO,
            "kapitola_decision": (
                "M-VK okapní chodník complete stack — výkop rýhy + geotextilie "
                "doplněny per ČSN okapový chodník norma (DPS gap, řez ukazoval "
                "pouze beton profil)"
            ),
            "kros_hint": kros_hint,
        },
    }


def build_items() -> list[dict]:
    items = []

    items.append(make_item(
        item_id="M-VK-027",
        popis="Výkop rýhy pro okapní chodník hl. 400 mm (na hloubku všech vrstev)",
        mj="m³",
        mnozstvi=OBJEM_VYKOPU,
        raw_description="výkop rýhy okapní chodník 400 mm",
        qty_formula=f"{OBVOD} × {SIRE} × {HLOUBKA_RYHY} = {OBJEM_VYKOPU} m³",
        audit_formula=f"{OBVOD} × {SIRE} × {HLOUBKA_RYHY} = {OBJEM_VYKOPU} m³",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "sire_ryhy", "value": SIRE, "unit": "m"},
            {"label": "hloubka_ryhy", "value": HLOUBKA_RYHY, "unit": "m",
             "rozpis": "štěrk 150 + beton 200 + rezerva 50 = ~400 mm celková hloubka vrstev"},
            {"label": "objem_vykopu", "value": OBJEM_VYKOPU, "unit": "m³"},
        ],
        audit_poznamka=(
            "PRVNÍ položka (před úpravou pláně). Výkop rýhy na hloubku 400 mm = "
            "součet všech vrstev (štěrk 150 + beton 200 + rezerva 50). Bez výkopu "
            "není kam vrstvy položit — okapní chodník je zapuštěný do terénu. "
            "Per ČSN okapový chodník norma + řez A103 (DPS gap — výkop NE zakreslen)."
        ),
        kros_hint="132xxx (výkop rýh)",
    ))

    items.append(make_item(
        item_id="M-VK-028",
        popis="Odvoz vykopané zeminy z rýhy okapního chodníku na skládku",
        mj="m³",
        mnozstvi=OBJEM_VYKOPU,
        raw_description="odvoz zeminy z výkopu okapního chodníku",
        qty_formula=f"= objem výkopu M-VK-027 = {OBJEM_VYKOPU} m³",
        formula_parsed_method="direct",
        audit_formula=f"= {OBJEM_VYKOPU} m³ (1:1 s výkopem)",
        audit_inputs=[
            {"label": "objem_zeminy", "value": OBJEM_VYKOPU, "unit": "m³"},
            {"label": "vazba", "value": "= výkop M-VK-027", "unit": ""},
        ],
        audit_poznamka=(
            "DRUHÁ položka. Odvoz vykopané zeminy na skládku (zemina z rýhy se "
            "nepoužije zpět — chodník je nahrazen štěrkem + betonem). Vzdálenost "
            "skládky per VRN doprava. Bez nakypření factor (rostlý objem = 22.4 m³; "
            "nakypřený ~+25 % řeší KROS doprava položka v Stage 3)."
        ),
        kros_hint="162xxx (vodorovné přemístění) / 171xxx (uložení na skládku)",
    ))

    items.append(make_item(
        item_id="M-VK-029",
        popis=(
            "Geotextilie 300 g/m² separační — mezi hutněnou zemní pláň a "
            "štěrkový podklad okapního chodníku"
        ),
        mj="m²",
        mnozstvi=PLOCHA,
        raw_description="geotextilie 300 g/m² separace zemina/štěrk",
        qty_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "sire", "value": SIRE, "unit": "m"},
            {"label": "plocha", "value": PLOCHA, "unit": "m²"},
            {"label": "gramaz", "value": "300 g/m²", "unit": ""},
            {"label": "presahy", "value": "min 150 mm (v ceně m²)", "unit": ""},
        ],
        audit_poznamka=(
            "Mezi hutněním pláně (M-VK-024) a štěrkem (M-VK-022). Funkce: separace "
            "zeminy od štěrku (proti kontaminaci jemnými částicemi → ztráta drenáže) "
            "+ proti prorůstání plevele. Netkaná PP/PES 300 g/m². Přesahy min "
            "150 mm. Per ČSN okapový chodník norma — bez geotextilie beton praská "
            "do 1-2 let (DPS gap)."
        ),
        kros_hint="693xxx (geotextilie)",
    ))

    return items


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}
    new_items = build_items()
    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r}")

    prev = len(raw["items"])
    raw["items"].extend(new_items)
    new = len(raw["items"])
    if new != prev + 3:
        raise SystemExit(f"FATAL: expected {prev+3}, got {new}")

    # Verify 10-item okapní stack
    okapni = {f"M-VK-{n:03d}" for n in range(20, 30)}
    present = {it["id"] for it in raw["items"]} & okapni
    if present != okapni:
        raise SystemExit(f"FATAL: okapní stack incomplete — missing {okapni - present}")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            "Okapní chodník — add 3 ČSN-required items (M-VK-027 výkop rýhy, "
            "M-VK-028 odvoz zeminy, M-VK-029 geotextilie 300 g/m²). Stack now "
            "complete 10 items."
        ),
        "reason": (
            "ČSN okapový chodník norma review — (a) výkop rýhy 400 mm na hloubku "
            "všech vrstev (chodník zapuštěný), (b) geotextilie separace zemina/"
            "štěrk + proti prorůstání plevele. Bez nich beton praská do 1-2 let. "
            "DPS gap — řez A103 ukazoval pouze beton profil."
        ),
        "previous_count": prev,
        "new_count": new,
        "items_added": [it["id"] for it in new_items],
        "items_modified": [],
        "items_removed": [],
        "okapni_chodnik_final_stack_10": [
            "1. M-VK-027 Výkop rýhy 400 mm (22.4 m³)",
            "2. M-VK-028 Odvoz zeminy (22.4 m³)",
            "3. M-VK-024 Úprava + hutnění zemní pláně (56 m²)",
            "4. M-VK-029 Geotextilie 300 g/m² (56 m²)",
            "5. M-VK-022 Štěrk ŠD 32/63 150 mm (8.4 m³)",
            "6. M-VK-025 Hutnění štěrku (56 m²)",
            "7. M-VK-026 Bednění vnější hrana (16 m²)",
            "8. M-VK-021 KARI Q188 (56 m²)",
            "9. M-VK-020 Beton C25/30 XF3 200 mm (11.2 m³)",
            "10. M-VK-023 Dilatace á 4 m (20 m)",
        ],
        "pattern_15_compliance": "3 new items work-first, _kros_hint only",
        "dps_gap_note": (
            "Výkop + geotextilie standard per ČSN okapový chodník — DPS řez "
            "A103 only showed beton profile. Covered by existing ABMV_32 "
            "(podkladní vrstvy verification — items_affected extended)."
        ),
    })

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: {prev} → {new} (+3 ČSN items)")
    print("  okapní chodník complete 10-item stack: M-VK-020..029")

    # Extend ABMV_32 items_affected
    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    for a in abmv["items"]:
        if a["id"] == "ABMV_32":
            a["items_affected"] = sorted(set(
                a.get("items_affected", []) + ["M-VK-027", "M-VK-028", "M-VK-029"]
            ))
            a["summary_cs"] += (
                " UPDATE 2026-05-27: + výkop rýhy 400 mm + geotextilie 300 g/m² "
                "doplněny per ČSN okapový chodník norma (jinak beton praská 1-2 roky)."
            )
            break
    ABMV_PATH.write_text(
        json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("abmv_email_queue.json: ABMV_32 items_affected extended (+3)")


if __name__ == "__main__":
    main()
