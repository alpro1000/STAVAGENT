"""
stage_e_add_opl.py
Idempotent script:
  1. Patch PSV-76x-005 vrata: 3000→3500 mm per TZ ARS DPZ (ABMV_2 resolved)
  2. Resolve ABMV_2 in abmv_email_queue.json
  3. Add 8 PSV-OPL-001..008 Kingspan opláštění items
  4. Update items.json metadata (total_items, kapitola_modules_loaded)

Run from repo root or hk212_hala/:
  python scripts/phase_1_etap1/stage_e_add_opl.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

# ── paths ──────────────────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent.parent.parent
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
ABMV_PATH  = BASE / "outputs/abmv_email_queue.json"

APPLIED_KEY = "stage_e_applied"
NOW_ISO = datetime.now(timezone.utc).isoformat()

# ── helpers ────────────────────────────────────────────────────────────────

def load_json(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def save_json(p: Path, data: dict):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  saved → {p.relative_to(BASE.parent.parent.parent)}")


# ── PSV-OPL items (8 ks) ──────────────────────────────────────────────────
# Quantities from Step 3 area_aggregates:
#   fasáda netto  = 536.4 m²
#   střecha netto = 558.8 m²  (brutto/cos(5.25°))
#   obvod budovy  = 103.5 m   → 2× as lemy estimate

OPL_SOURCE = "TZ_ARS_DPZ + Step3 areas + Step2 Lindab/MEARIN dossiers"

PSV_OPL_ITEMS = [
    {
        "id": "PSV-OPL-001",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Dodávka Kingspan KS1000 AWP obvodový sendvičový panel tl. 200 mm "
            "(alt. 150 mm), výplň MW (minerální vata), EW 15 DP1, RAL bílá + modrá — "
            "dle TZ ARS DPZ D.1.1"
        ),
        "mj": "m²",
        "mnozstvi": 536.4,
        "_qty_formula": "fasáda netto Step3: obvod 103.5 m × výška 6.02 m − otvory 86.8 m²",
        "source": OPL_SOURCE,
        "raw_description": "Kingspan obvodový panel tl. 200 mm MW bílá+modrá",
        "confidence": 0.90,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": ["ABMV_13"],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.9,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "obvodové opláštění Kingspan — TZ ARS DPZ D.1.1 kap. B + statika D.1.2",
            "formula": "fasáda netto Step3: obvod 103.5 m × výška 6.02 m − otvory 86.8 m²",
            "formula_parsed_method": "derived_from_step3_areas",
            "inputs": [
                {"label": "fasada_netto_m2", "value": 536.4, "unit": "m²"},
                {"label": "fasada_brutto_m2", "value": 623.3, "unit": "m²"},
                {"label": "otvory_m2", "value": 86.8, "unit": "m²"},
            ],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
                {"type": "step3_metric", "metric": "fasada_netto", "value": 536.4},
            ],
            "poznamka": (
                "TZ ARS DPZ D.1.1: Kingspan KS1000 AWP tl. 200 mm (alt. 150 mm), MW, "
                "bílá + modrá. EW 15 DP1 per PBŘ ABMV_6. Tloušťka 200 mm per TZ ARS — "
                "alt. 150 mm stale open (ABMV_13 closed: K-roc = MW potvrzeno). "
                "Qty = Step3 fasáda netto 536.4 m²."
            ),
            "computed_quantity": 536.4,
            "declared_quantity": 536.4,
            "match_delta_pct": 0.0,
            "match_within_tolerance": True,
            "confidence": 0.90,
            "extraction_method": "tz_ars_dpz_verified",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-002",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Montáž obvodového opláštění Kingspan — samořezné šrouby + EPDM těsnicí "
            "podložka, kotvení k ocelové konstrukci — dle TZ ARS DPZ D.1.1"
        ),
        "mj": "m²",
        "mnozstvi": 536.4,
        "_qty_formula": "fasáda netto Step3 = 536.4 m² (shodné s PSV-OPL-001)",
        "source": OPL_SOURCE,
        "raw_description": "montáž Kingspan obvodového opláštění samořezné šrouby EPDM",
        "confidence": 0.90,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.9,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "montáž obvodové opláštění Kingspan — TZ ARS DPZ D.1.1",
            "formula": "fasáda netto Step3 = 536.4 m²",
            "formula_parsed_method": "derived_from_step3_areas",
            "inputs": [{"label": "fasada_netto_m2", "value": 536.4, "unit": "m²"}],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
            ],
            "poznamka": (
                "TZ ARS DPZ D.1.1: kotvení samořezné šrouby + EPDM těsnicí podložka. "
                "Qty = Step3 fasáda netto 536.4 m²."
            ),
            "computed_quantity": 536.4,
            "declared_quantity": 536.4,
            "match_delta_pct": 0.0,
            "match_within_tolerance": True,
            "confidence": 0.90,
            "extraction_method": "tz_ars_dpz_verified",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-003",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Dodávka Kingspan střešní sendvičový panel pro šikmé střechy, plnění MW "
            "(minerální vata), EW 15 DP1, sklon 5,25° — tloušťka dle statiky "
            "(TZ ARS neuvádí explicitně, _review_thickness)"
        ),
        "mj": "m²",
        "mnozstvi": 558.8,
        "_qty_formula": "střecha netto Step3: brutto 556.5 m² / cos(5.25°) = 558.8 m²",
        "source": OPL_SOURCE,
        "raw_description": "Kingspan střešní panel MW šikmé střechy sklon 5.25°",
        "confidence": 0.90,
        "_price_source": "user_skipped_pricing",
        "_review_thickness": True,
        "_vyjasneni_ref": ["ABMV_13"],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.85,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "střešní opláštění Kingspan — TZ ARS DPZ D.1.1 + A102 pudorys střechy",
            "formula": "střecha netto Step3: brutto 556.5 m² / cos(5.25°) = 558.8 m²",
            "formula_parsed_method": "derived_from_step3_areas",
            "inputs": [
                {"label": "strecha_brutto_m2", "value": 556.5, "unit": "m²"},
                {"label": "sklon_stup", "value": 5.25, "unit": "°"},
                {"label": "strecha_netto_m2", "value": 558.8, "unit": "m²"},
            ],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
                {"type": "dxf_layer", "sheet": "A102", "metric": "sklon_stopy 5.25°"},
                {"type": "step3_metric", "metric": "strecha_netto", "value": 558.8},
            ],
            "poznamka": (
                "TZ ARS DPZ D.1.1: Kingspan pro šikmé střechy s MW, sklon 5,25°. "
                "EW 15 DP1 per PBŘ ABMV_6. Výška v hřebeni 7,1 m. "
                "_review_thickness=True: TZ ARS neuvádí explicitní tloušťku střešního panelu — "
                "ověřit u projektanta / statika D.1.2. "
                "Qty = Step3 střecha netto 558.8 m²."
            ),
            "computed_quantity": 558.8,
            "declared_quantity": 558.8,
            "match_delta_pct": 0.0,
            "match_within_tolerance": True,
            "confidence": 0.90,
            "extraction_method": "tz_ars_dpz_verified",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-004",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Montáž střešního opláštění Kingspan — kotvení k ocelové konstrukci, "
            "samořezné šrouby, těsnění přesahů — dle TZ ARS DPZ D.1.1"
        ),
        "mj": "m²",
        "mnozstvi": 558.8,
        "_qty_formula": "střecha netto Step3 = 558.8 m² (shodné s PSV-OPL-003)",
        "source": OPL_SOURCE,
        "raw_description": "montáž Kingspan střešní opláštění kotvení šrouby",
        "confidence": 0.90,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.9,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "montáž střešní opláštění Kingspan — TZ ARS DPZ D.1.1",
            "formula": "střecha netto Step3 = 558.8 m²",
            "formula_parsed_method": "derived_from_step3_areas",
            "inputs": [{"label": "strecha_netto_m2", "value": 558.8, "unit": "m²"}],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
            ],
            "poznamka": "TZ ARS DPZ D.1.1: montáž kotvením k OK. Qty = Step3 střecha netto 558.8 m².",
            "computed_quantity": 558.8,
            "declared_quantity": 558.8,
            "match_delta_pct": 0.0,
            "match_within_tolerance": True,
            "confidence": 0.90,
            "extraction_method": "tz_ars_dpz_verified",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-005",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Klempířské lemy + přechody střecha–fasáda, pozinkovaný plech — "
            "atika, úžlabí, nároží, parapety, krycí lišty — dle TZ ARS DPZ D.1.1"
        ),
        "mj": "bm",
        "mnozstvi": 207.0,
        "_qty_formula": "2 × obvod budovy 103.5 m (atika + parapety); _review_qty=True",
        "source": OPL_SOURCE,
        "raw_description": "klempíř lemy přechody pozinkovaný plech atika úžlabí nároží",
        "confidence": 0.75,
        "_price_source": "user_skipped_pricing",
        "_review_qty": True,
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.75,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "klempířské lemy opláštění — TZ ARS DPZ D.1.1",
            "formula": "2 × obvod budovy 103.5 m = 207.0 bm (hrubý odhad atika + parapety)",
            "formula_parsed_method": "estimate_perimeter_derived",
            "inputs": [
                {"label": "obvod_budovy_m", "value": 103.5, "unit": "m"},
                {"label": "factor", "value": 2.0, "unit": ""},
            ],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
                {"type": "step3_metric", "metric": "obvod_budovy", "value": 103.5},
            ],
            "poznamka": (
                "TZ ARS DPZ D.1.1: pozinkovaný plech — atika, lemování, parapety, "
                "krycí lišty, úžlabí, nároží, okapy. "
                "_review_qty=True: výkaz lemů vyžaduje klempířský podrobný výkaz (TBD). "
                "Odhad 207 bm = 2× obvod 103.5 m."
            ),
            "computed_quantity": 207.0,
            "declared_quantity": 207.0,
            "match_delta_pct": None,
            "match_within_tolerance": False,
            "confidence": 0.75,
            "extraction_method": "estimate_perimeter_derived",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-006",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Spojovací materiál + těsnění + EPDM podložky Kingspan systém — "
            "paušál pro celý objem opláštění"
        ),
        "mj": "kpl",
        "mnozstvi": 1.0,
        "_qty_formula": "1 kpl paušál",
        "source": OPL_SOURCE,
        "raw_description": "Kingspan spojovací materiál těsnění EPDM kotvící prvky",
        "confidence": 0.85,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.85,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "spojovací materiál opláštění — TZ ARS DPZ D.1.1",
            "formula": "paušál",
            "formula_parsed_method": "unparseable",
            "inputs": [],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
            ],
            "poznamka": (
                "TZ ARS DPZ D.1.1: kotvení samořezné šrouby + EPDM těsnicí podložky. "
                "Paušál pro celý systém opláštění (střecha + fasáda). "
                "Qty TBD u Kingspan systémového dodavatele."
            ),
            "computed_quantity": None,
            "declared_quantity": 1.0,
            "match_delta_pct": None,
            "match_within_tolerance": False,
            "confidence": 0.85,
            "extraction_method": "placeholder_lump_sum",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-007",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": "Doprava sendvičových panelů Kingspan na stavbu — paušál",
        "mj": "paušál",
        "mnozstvi": 1.0,
        "_qty_formula": "1 paušál",
        "source": OPL_SOURCE,
        "raw_description": "doprava Kingspan sendvičové panely",
        "confidence": 0.85,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.85,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "doprava opláštění — standardní položka Kingspan systém",
            "formula": "paušál",
            "formula_parsed_method": "unparseable",
            "inputs": [],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
            ],
            "poznamka": "Doprava Kingspan panelů (střecha + fasáda ~536+559 m²) na stavbu. Qty paušál.",
            "computed_quantity": None,
            "declared_quantity": 1.0,
            "match_delta_pct": None,
            "match_within_tolerance": False,
            "confidence": 0.85,
            "extraction_method": "placeholder_lump_sum",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
    {
        "id": "PSV-OPL-008",
        "kapitola": "PSV-OPL",
        "SO": "SO-01",
        "popis": (
            "Statické posouzení uchycení Kingspan k ocelové konstrukci + "
            "revizní zpráva — paušál"
        ),
        "mj": "paušál",
        "mnozstvi": 1.0,
        "_qty_formula": "1 paušál",
        "source": OPL_SOURCE,
        "raw_description": "statické posouzení Kingspan kotvení k OK revize",
        "confidence": 0.85,
        "_price_source": "user_skipped_pricing",
        "_vyjasneni_ref": [],
        "_status_flag": None,
        "_data_source": "TZ_ARS_DPZ",
        "_completeness": 0.85,
        "_export_wrapper_hint": "PSV_sendvicove_opla_teni",
        "urs_code": None,
        "urs_alternatives": [],
        "urs_status": "needs_review",
        "urs_match_score": None,
        "subdodavatel_chapter": "opl_steni_sendvic",
        "audit_trail": {
            "lokalizace": "statika opláštění — inženýrský výkon",
            "formula": "paušál",
            "formula_parsed_method": "unparseable",
            "inputs": [],
            "reference": [
                {"type": "tz_section", "section": "D.1.1", "raw": "TZ ARS DPZ D.1.1"},
            ],
            "poznamka": (
                "Statické posouzení kotvení Kingspan k ocelové nosné konstrukci + "
                "revizní zpráva. Povinné per ČSN EN 14509 + projektant požadavek. "
                "Qty paušál."
            ),
            "computed_quantity": None,
            "declared_quantity": 1.0,
            "match_delta_pct": None,
            "match_within_tolerance": False,
            "confidence": 0.85,
            "extraction_method": "placeholder_lump_sum",
            "data_source_hint": "TZ_ARS_DPZ",
            "extracted_at": NOW_ISO,
        },
    },
]

OPL_IDS = {item["id"] for item in PSV_OPL_ITEMS}


# ── main ───────────────────────────────────────────────────────────────────

def patch_items(data: dict) -> tuple[dict, bool]:
    """Returns (patched_data, changed)."""
    meta = data.get("metadata", {})

    # Idempotency check
    if meta.get(APPLIED_KEY):
        print(f"  [skip] {APPLIED_KEY} already set: {meta[APPLIED_KEY]}")
        return data, False

    items: list = data["items"]
    changed = False

    # 1. Patch PSV-76x-005 vrata: 3000→3500 mm
    for item in items:
        if item.get("id") == "PSV-76x-005":
            old_popis = item["popis"]
            item["popis"] = item["popis"].replace("3000 × 4000", "3500 × 4000")
            item["raw_description"] = item.get("raw_description", "").replace(
                "3000×4000", "3500×4000"
            )
            item["source"] = "TZ_ARS_DPZ (vrata 3500×4000 mm wins) + DXF A101"
            item["confidence"] = 0.90
            # remove ABMV_2 from _vyjasneni_ref (resolved)
            if "_vyjasneni_ref" in item and "ABMV_2" in (item["_vyjasneni_ref"] or []):
                item["_vyjasneni_ref"] = [
                    r for r in item["_vyjasneni_ref"] if r != "ABMV_2"
                ]
            # patch audit_trail
            at = item.get("audit_trail", {})
            if "poznamka" in at:
                at["poznamka"] = at["poznamka"].replace("3000×4000", "3500×4000")
            at["poznamka"] = (
                at.get("poznamka", "") +
                " | STAGE-E patch: TZ ARS DPZ wins over DXF block name 3000×4000 → 3500×4000 mm."
            )
            at["confidence"] = 0.90
            at["extraction_method"] = "tz_ars_dpz_verified"
            item["audit_trail"] = at
            print(f"  patched PSV-76x-005: '{old_popis}' → '{item['popis']}'")
            changed = True
            break

    # 2. Add PSV-OPL items (skip already present)
    existing_ids = {i["id"] for i in items}
    added = []
    for opl in PSV_OPL_ITEMS:
        if opl["id"] not in existing_ids:
            items.append(opl)
            added.append(opl["id"])
            changed = True
    if added:
        print(f"  added PSV-OPL items: {', '.join(added)}")

    # 3. Update metadata
    meta[APPLIED_KEY] = NOW_ISO
    meta["total_items"] = len(items)

    # rebuild kapitola_modules_loaded
    from collections import Counter
    kap_counts = Counter(i.get("kapitola", "?") for i in items)
    modules = [f"{k} ({v} items)" for k, v in sorted(kap_counts.items())]
    meta["kapitola_modules_loaded"] = modules

    meta["stage_e_summary"] = {
        "applied_at": NOW_ISO,
        "psv_76x_005_vrata_patched": "3000→3500 mm per TZ ARS DPZ",
        "psv_opl_items_added": len(added),
        "psv_opl_ids": sorted(OPL_IDS),
    }

    data["metadata"] = meta
    data["items"] = items
    return data, changed


def patch_abmv(data: dict) -> tuple[dict, bool]:
    changed = False
    for item in data.get("items", []):
        if item.get("id") == "ABMV_2" and item.get("status") == "open":
            item["status"] = "resolved"
            item["resolution_note"] = (
                "TZ ARS DPZ D.1.1 p.4 + PBŘ p.18 confirm 4× vrata 3500 × 4000 mm. "
                "DXF block name 'M_Vrata_výsuvná_sekční - 3000X4000 MM' is legacy block "
                "library template (wrong dimension in block name). TZ wins per 3-source "
                "matrix (TZ_D.1.1 + PBŘ vs DXF block name = 2:1). "
                "PSV-76x-005 popis updated → 3500 × 4000 mm. Stage E patch 2026-05-22."
            )
            item["resolution_date"] = "2026-05-22"
            item["resolution_source"] = "TZ_ARS_DPZ D.1.1 + PBR_p18 + Stage_E_patch"
            print(f"  resolved ABMV_2: vrata 3500×4000 mm per TZ ARS DPZ")
            changed = True
            break
    return data, changed


def main():
    print("\n=== stage_e_add_opl.py ===")

    # items.json
    print("\n[1] items_hk212_etap1.json")
    items_data = load_json(ITEMS_PATH)
    items_data, items_changed = patch_items(items_data)
    if items_changed:
        save_json(ITEMS_PATH, items_data)
        print(f"  total_items now: {items_data['metadata']['total_items']}")
    else:
        print("  no changes")

    # abmv_email_queue.json
    print("\n[2] abmv_email_queue.json")
    abmv_data = load_json(ABMV_PATH)
    abmv_data, abmv_changed = patch_abmv(abmv_data)
    if abmv_changed:
        save_json(ABMV_PATH, abmv_data)
    else:
        print("  no changes (ABMV_2 already resolved?)")

    print("\ndone.\n")


if __name__ == "__main__":
    main()
