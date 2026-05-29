"""HK212 okapní chodník — complete 6-layer technology stack (supplementary).

Prior PR #1237 added 4 partial okapní chodník items (M-VK-020..023) with
bednění + dilatace bundled into the KARI item. Řez A103 detail shows only
the concrete profile — podkladní vrstvy (zemní pláň, hutnění, štěrk hutnění)
are NOT drawn (typical DPS gap). This task completes the physical layer
stack per ČSN 73 6126 + ČSN EN 13670.

Current state on main (4 items):
  M-VK-020 Beton C25/30 XF3 (layer 6)          — KEEP
  M-VK-021 KARI Q188 + boční bednění + dilatace — DE-BUNDLE → KARI only (layer 5)
  M-VK-022 ŠD 32/63 podklad (layer 2)          — KEEP
  M-VK-023 Dilatační lišty (layer 7)           — KEEP

This task:
  - MODIFY M-VK-021 → strip "+ boční bednění + dilatační lišty" (those are
    now separate atomic items M-VK-026 + existing M-VK-023). KARI-only.
  - ADD M-VK-024 Úprava zemní pláně + hutnění (layer 1)
  - ADD M-VK-025 Hutnění štěrkového podkladu vibrodeska (layer 3)
  - ADD M-VK-026 Bednění boční vnější hrana (layer 4, split from M-VK-021)

End state: 7 okapní items in technological order (zdola nahoru):
  1. M-VK-024 Úprava zemní pláně + hutnění       56 m²
  2. M-VK-022 Drcený štěrk ŠD 32/63 podklad      8.4 m³
  3. M-VK-025 Hutnění štěrkového podkladu         56 m²
  4. M-VK-026 Bednění boční vnější hrana          16 m²
  5. M-VK-021 Výztuž KARI síť Q188                56 m²
  6. M-VK-020 Beton C25/30 XF3                    11.2 m³
  7. M-VK-023 Dilatační lišty + těsnění           20 m

Geometrie: 0.7 m × 79.65 m (≈ 80 m) = 56 m² (mimo 4 vstupy).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

NOW_ISO = "2026-05-27T22:00:00+00:00"

OBVOD = 80.0
SIRE = 0.7
VYSKA_BEDNENI = 0.20
PLOCHA = round(OBVOD * SIRE, 1)   # 56.0

PATTERN_15_REF = "Work-first generation. KROS catalog mapping in separate Stage 3 task."

KAPITOLA_DECISION = (
    "M-VK okapní chodník complete stack — podkladní vrstvy doplněny per "
    "inženýrská norma ČSN 73 6126 (řez A103 ukazoval pouze beton profil — DPS gap)"
)

SCOPE_BASIS = (
    "DPS výkres incomplete — beton element zakreslen v řezu A103, podkladní "
    "vrstvy + hutnění + bednění standard zhotovitele dle ČSN 73 6126 + "
    "ČSN EN 13670. Defensible standard scope. Verify s projektant Volka — ABMV_32."
)


def _refs(extra: list[dict] | None = None) -> list[dict]:
    base = [
        {"type": "document", "code": "A103 řez A-B detail",
         "document": "inputs/vykresy_pdf/A103_rez_AB_DPS_2026-05.pdf",
         "stage": "DPS 06/2026",
         "evidence": "Beton profil okapního chodníku zakreslen; podkladní vrstvy NE (DPS gap)"},
        {"type": "norma", "code": "ČSN 73 6126",
         "section": "Stavba vozovek — podkladní vrstvy"},
        {"type": "norma", "code": "ČSN EN 13670",
         "section": "Provádění betonových konstrukcí"},
    ]
    if extra:
        base.extend(extra)
    return base


def make_item(
    *, item_id, popis, mj, mnozstvi, raw_description, qty_formula,
    audit_formula, audit_inputs, audit_poznamka, kros_hint,
    formula_parsed_method="product",
) -> dict:
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
            "Řez A103 detail + standard CR technologie ČSN 73 6126 "
            "(podkladní vrstvy doplněny — DPS gap) + user měření obvodu 79.65 m"
        ),
        "raw_description": raw_description,
        "confidence": 0.80,
        "subdodavatel_chapter": "venkovni_upravy",
        "_vyjasneni_ref": ["ABMV_32"],
        "_status_flag": None,
        "_data_source": "A103_riez_profil+ČSN_73_6126+A101_obvod",
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
            "extraction_method": "riez_profil + ČSN_standard_layer_stack",
            "data_source_hint": "A103_riez+ČSN_73_6126",
            "extracted_at": NOW_ISO,
            "kapitola_decision": KAPITOLA_DECISION,
            "kros_hint": kros_hint,
        },
    }


def build_new_items() -> list[dict]:
    items = []

    # Layer 1 — úprava zemní pláně + hutnění
    items.append(make_item(
        item_id="M-VK-024",
        popis="Úprava zemní pláně + hutnění pod okapní chodník (Edef2 ≥ 30 MPa)",
        mj="m²",
        mnozstvi=PLOCHA,
        raw_description="zemní pláň + hutnění podloží okapního chodníku",
        qty_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "sire", "value": SIRE, "unit": "m"},
            {"label": "plocha", "value": PLOCHA, "unit": "m²"},
            {"label": "pozadovane_Edef2", "value": "≥ 30 MPa (zemní pláň)", "unit": ""},
        ],
        audit_poznamka=(
            "Layer 1 (zdola). Srovnání + hutnění zemní pláně před položením "
            "štěrkového podkladu. Sklon 2 % od fasády (kopíruje finální sklon "
            "chodníku). Per ČSN 73 6126 — příprava podloží pod podkladní vrstvy. "
            "DPS gap — řez A103 ukazuje pouze beton, zemní pláň doplněna per norma."
        ),
        kros_hint="181xxx (úprava pláně) / 171xxx (hutnění)",
    ))

    # Layer 3 — hutnění štěrkového podkladu
    items.append(make_item(
        item_id="M-VK-025",
        popis="Hutnění štěrkového podkladu okapního chodníku vibrodeskou (Edef2 ≥ 45 MPa)",
        mj="m²",
        mnozstvi=PLOCHA,
        raw_description="hutnění štěrku ŠD vibrodeska",
        qty_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_formula=f"{OBVOD} × {SIRE} = {PLOCHA} m²",
        audit_inputs=[
            {"label": "plocha", "value": PLOCHA, "unit": "m²"},
            {"label": "metoda", "value": "vibrační deska", "unit": ""},
            {"label": "pozadovane_Edef2", "value": "≥ 45 MPa (štěrk pod beton)", "unit": ""},
        ],
        audit_poznamka=(
            "Layer 3 (zdola). Hutnění štěrkové vrstvy ŠD 32/63 (M-VK-022) "
            "vibrodeskou na Edef2 ≥ 45 MPa před betonáží. Per ČSN 73 6126. "
            "Samostatná položka — práce hutnění oddělena od dodávky štěrku "
            "(M-VK-022 = materiál + rozprostření; M-VK-025 = hutnění)."
        ),
        kros_hint="171xxx (hutnění vrstev)",
    ))

    # Layer 4 — bednění boční vnější hrana (split from M-VK-021)
    items.append(make_item(
        item_id="M-VK-026",
        popis=(
            "Bednění boční vnější hrana okapního chodníku v 200 mm "
            "(vnitřní hrana = stěna haly)"
        ),
        mj="m²",
        mnozstvi=round(OBVOD * VYSKA_BEDNENI, 1),  # 16.0
        raw_description="boční bednění okapní chodník vnější hrana",
        qty_formula=f"{OBVOD} × {VYSKA_BEDNENI} m výška = {OBVOD*VYSKA_BEDNENI:.1f} m²",
        audit_formula=f"{OBVOD} × {VYSKA_BEDNENI} = {OBVOD*VYSKA_BEDNENI:.1f} m²",
        audit_inputs=[
            {"label": "obvod_mimo_vstupy", "value": OBVOD, "unit": "m"},
            {"label": "vyska_bedneni", "value": VYSKA_BEDNENI, "unit": "m"},
            {"label": "plocha_bedneni", "value": round(OBVOD*VYSKA_BEDNENI, 1), "unit": "m²"},
            {"label": "pozn_vnitrni_hrana", "value": "stěna haly = vnitřní bednění (bez položky)", "unit": ""},
        ],
        audit_poznamka=(
            "Layer 4. POUZE vnější boční bednění (výška 200 mm) — vnitřní hrana "
            "okapního chodníku přiléhá ke stěně haly, která slouží jako vnitřní "
            "bednění. De-bundled z dřívější M-VK-021 (kde bylo bednění bundled "
            "s KARI). Plocha = obvod × výška betonu. Včetně dilatačních lišt "
            "(viz M-VK-023 pro vlastní dilatace)."
        ),
        kros_hint="564xxx (bednění komunikace)",
    ))

    return items


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    existing_ids = {it["id"] for it in raw["items"]}

    # MODIFY M-VK-021 — de-bundle: strip bednění + dilatace → KARI only
    m021_found = False
    for item in raw["items"]:
        if item["id"] != "M-VK-021":
            continue
        m021_found = True
        old_popis = item["popis"]
        item["popis"] = "Výztuž KARI síť Q188 (150/150/6 mm) — okapní chodník"
        item["raw_description"] = "KARI Q188 výztuž okapního chodníku"
        item["_kros_hint"] = "631xxx (KARI síť)"
        # Pattern 14 forward journey
        journey = item.setdefault("_analytical_journey", [])
        journey.append({
            "timestamp": NOW_ISO,
            "phase": "de_bundle_complete_layer_stack",
            "previous_state": {"popis": old_popis, "kros_hint": "631xxx + 564xxx"},
            "current_state": {
                "popis": item["popis"],
                "kros_hint": "631xxx (KARI síť)",
            },
            "source": (
                "Complete 6-layer stack task 2026-05-27 — bednění split to "
                "M-VK-026 (separate atomic item), dilatace already at M-VK-023. "
                "M-VK-021 now KARI-only to avoid double-count in layered stack."
            ),
            "correction_type": "de_bundle_no_quantity_change",
        })
        at = item.get("audit_trail", {})
        at["de_bundle_note"] = (
            "Mnozstvi 56 m² unchanged (KARI plocha = chodník plocha). Bednění "
            "split to M-VK-026 (16 m²). Dilatace remains M-VK-023 (20 m). "
            "No double-count: KARI / bednění / dilatace now 3 distinct items."
        )
        break
    if not m021_found:
        raise SystemExit("FATAL: M-VK-021 not found — cannot de-bundle")

    # ADD 3 new layer items
    new_items = build_new_items()
    for it in new_items:
        if it["id"] in existing_ids:
            raise SystemExit(f"FATAL: id collision {it['id']!r}")
    prev_count = len(raw["items"])
    raw["items"].extend(new_items)
    new_count = len(raw["items"])
    if new_count != prev_count + 3:
        raise SystemExit(f"FATAL: expected {prev_count+3}, got {new_count}")

    # Verify 7-item okapní stack complete
    okapni_ids = {f"M-VK-{n:03d}" for n in (20, 21, 22, 23, 24, 25, 26)}
    present = {it["id"] for it in raw["items"]} & okapni_ids
    if present != okapni_ids:
        raise SystemExit(f"FATAL: okapní stack incomplete — missing {okapni_ids - present}")

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-27",
        "change": (
            "Okapní chodník complete 6-layer technology stack — add 3 podkladní "
            "vrstvy items (M-VK-024 zemní pláň, M-VK-025 hutnění štěrku, M-VK-026 "
            "bednění), de-bundle M-VK-021 to KARI-only. End state 7 atomic items."
        ),
        "reason": (
            "Řez A103 detail shows only concrete profile; podkladní vrstvy "
            "(zemní pláň, hutnění, štěrk hutnění, bednění) NOT drawn — typical "
            "DPS gap. Completed per ČSN 73 6126 + ČSN EN 13670 standard CR "
            "technology. Defensible standard zhotovitele scope."
        ),
        "previous_count": prev_count,
        "new_count": new_count,
        "items_added": [it["id"] for it in new_items],
        "items_modified": ["M-VK-021 (de-bundle → KARI only, no quantity change)"],
        "items_removed": [],
        "okapni_chodnik_complete_stack": [
            "1. M-VK-024 Úprava zemní pláně + hutnění (56 m²)",
            "2. M-VK-022 Drcený štěrk ŠD 32/63 podklad (8.4 m³)",
            "3. M-VK-025 Hutnění štěrkového podkladu (56 m²)",
            "4. M-VK-026 Bednění boční vnější hrana (16 m²)",
            "5. M-VK-021 Výztuž KARI síť Q188 (56 m²)",
            "6. M-VK-020 Beton C25/30 XF3 (11.2 m³)",
            "7. M-VK-023 Dilatační lišty (20 m)",
        ],
        "abmvs_added": ["ABMV_32"],
        "pattern_14_compliance": "M-VK-021 de-bundle has _analytical_journey entry",
        "pattern_15_compliance": "3 new items work-first, _kros_hint only",
        "dps_gap_note": (
            "Layer stack standard per ČSN — řez A103 only showed beton profile. "
            "Material + thicknesses pending projektant Volka confirm (ABMV_32)."
        ),
    })

    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"items.json: {prev_count} → {new_count} (+3 layers, M-VK-021 de-bundled)")
    print("  okapní chodník complete 7-item stack: M-VK-020..026")

    # ABMV
    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    new_abmv = {
        "id": "ABMV_32",
        "category": "design_clarification",
        "severity": "low",
        "status": "open",
        "title": "Okapní chodník podkladní vrstvy — DPS gap doplněno per ČSN",
        "summary_cs": (
            "Řez A103 detail ukazuje pouze beton profil okapního chodníku. "
            "Podkladní vrstvy (zemní pláň + hutnění, štěrk ŠD 150 mm + hutnění, "
            "boční bednění) NE zakresleny — typický DPS gap. Doplněno per "
            "standard CR technologie ČSN 73 6126 + ČSN EN 13670. Verify "
            "s projektant Volka jestli souhlasí s tloušťkou štěrk 150 mm + "
            "beton 200 mm. Standardní defensible scope."
        ),
        "blocks_vv": [],
        "addressee": ["projektant Volka", "SOLAR DISPOREC"],
        "items_affected": [
            "M-VK-024", "M-VK-025", "M-VK-026", "M-VK-022", "M-VK-020"
        ],
        "resolution_required_before": "execution kick-off (Stage 4)",
        "created_at": NOW_ISO,
    }
    if new_abmv["id"] in {x["id"] for x in abmv["items"]}:
        raise SystemExit("FATAL: ABMV_32 collision")
    abmv["items"].append(new_abmv)
    ABMV_PATH.write_text(
        json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("abmv_email_queue.json: +1 ABMV_32 (podkladní vrstvy verification)")


if __name__ == "__main__":
    main()
