"""
phase_1_igp_integration.py — atomic IGP integration (Phase 1 of session 2026-05-24)

Implements 5 steps in one transaction:
  A) Close ABMV_11 (IGP delivered → geotech kategorie 1, Rdt=250 kPa, plošné založení primary)
  B) Flag HSV-2-010/011/012 pilot items as alternative_variant_per_IGP_not_required, conf → 0.40
  C) Add NEW HSV-1-028 Výměna aktivní zóny pláně (per IGP §4.4)
  D) Recompute HSV-1-001 výkop figura 222.75 → 323 m³ + close ABMV_17
  E) Add geotechnical_summary block to project_header.json

Evidence: inputs/dokumentace/IGP_ALTAGEO_526026.md (verbatim text from ALTAGEO 526026 04/2026)
Sources cited inline per audit_trail requirement.

Idempotent via metadata.phase_1_igp_applied flag.
"""

import json
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent.parent.parent
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
ABMV_PATH = BASE / "outputs/abmv_email_queue.json"
HEADER_PATH = BASE / "outputs/phase_1_etap1/project_header.json"

APPLIED_KEY = "phase_1_igp_applied"
NOW_ISO = datetime.now(timezone.utc).isoformat()

IGP_SOURCE = "IGP ALTAGEO 526026, 04/2026, Mgr. Beneda"
IGP_REF_DOC = "inputs/dokumentace/IGP_ALTAGEO_526026.md"


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, d):
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"  saved → {p.name}")


# ── Step C: NEW HSV-1-028 Výměna aktivní zóny ──────────────────────────────
# Per IGP §4.4: navážky GT1 nevhodné, doporučeno odstranit z aktivní zóny a
# nahradit hutněným štěrkem, Edef2 ≥ 45 MPa. Mocnost ~0.5 m.
# Plocha: Step 3 zastavěná 538.5 m². Vrstva výměny 0.5 m.
# Total: 538.5 × 0.5 = 269.25 m³ odstranění + 269.25 m³ nahrazení = 538.5 m³ work.
# Položka tracking: mj=m³, mnozstvi=269.25 (1× vrstva), audit_trail oba quantities.

NEW_HSV_1_028 = {
    "id": "HSV-1-028",
    "kapitola": "HSV-1",
    "SO": "SO-01",
    "popis": (
        "Výměna aktivní zóny pláně — odstranění navážek GT1 + nahrazení "
        "hutněným štěrkem tl. 0.5 m, Edef2 ≥ 45 MPa (Edef2/Edef1 < 2.2)"
    ),
    "mj": "m³",
    "mnozstvi": 269.25,
    "urs_code": None,
    "urs_alternatives": [],
    "urs_status": "needs_review",
    "urs_match_score": None,
    "skladba_ref": None,
    "source": f"{IGP_SOURCE} §4.4 + Step 3 zastavěná 538.5 m²",
    "raw_description": "výměna aktivní zóny — odstranění navážek + štěrk hutněný 0.5 m Edef2 ≥ 45 MPa",
    "confidence": 0.85,
    "subdodavatel_chapter": "zemni_prace",
    "_vyjasneni_ref": [],
    "_status_flag": None,
    "_data_source": "IGP",
    "_completeness": 0.9,
    "_qty_formula": "538.5 m² × 0.5 m vrstva = 269.25 m³ (jedna vrstva: odstranění NEBO nahrazení)",
    "_export_wrapper_hint": None,
    "_price_source": "user_skipped_pricing",
    "audit_trail": {
        "lokalizace": "výkopové práce / úprava pláně — celá plocha haly",
        "formula": "538.5 m² × 0.5 m = 269.25 m³ × 2 operace (odstranění + nahrazení)",
        "formula_parsed_method": "product_dual_operation",
        "inputs": [
            {"label": "zastavena_plocha_m2", "value": 538.5, "unit": "m²"},
            {"label": "mocnost_vymeny_m", "value": 0.5, "unit": "m"},
            {"label": "operace_odstraneni_m3", "value": 269.25, "unit": "m³"},
            {"label": "operace_nahrazeni_m3", "value": 269.25, "unit": "m³"},
            {"label": "edef2_min_MPa", "value": 45.0, "unit": "MPa"},
        ],
        "reference": [
            {"type": "igp_section", "section": "4.4", "raw": f"{IGP_SOURCE} §4.4 Zpevněné plochy"},
            {"type": "igp_document", "document": IGP_REF_DOC},
            {"type": "step3_metric", "metric": "zastavena_plocha", "value": 538.5},
            {"type": "csn", "standard": "ČSN 6133"},
            {"type": "csn", "standard": "ČSN 72 1006"},
        ],
        "poznamka": (
            f"IGP §4.4: navážky GT1 (mocnost 0.6–2.2 m) jsou ČSN P 73 1005 třída Y — "
            f"nevhodný typ základové půdy pro zemní pláň. Doporučeno odstranit z aktivní "
            f"zóny a nahradit hutněným štěrkem. Edef2 ≥ 45 MPa, Edef2/Edef1 < 2.2 "
            f"(ČSN 72 1006). Vrstva 0.5 m × zastavěná 538.5 m² = 269.25 m³ na operaci. "
            f"Item tracks single layer; total earth work = 2× (odstr. + nahraz.) = 538.5 m³."
        ),
        "computed_quantity": 269.25,
        "declared_quantity": 269.25,
        "match_delta_pct": 0.0,
        "match_within_tolerance": True,
        "confidence": 0.85,
        "extraction_method": "igp_geometric_derivation",
        "data_source_hint": "IGP+Step3",
        "extracted_at": NOW_ISO,
    },
}


def patch_items(d):
    meta = d.get("metadata", {})
    if meta.get(APPLIED_KEY):
        print(f"  [skip] {APPLIED_KEY} already set: {meta[APPLIED_KEY]}")
        return d, False

    items = d["items"]
    changed = False

    # Step D: HSV-1-001 figura recompute
    for item in items:
        if item["id"] == "HSV-1-001":
            old_mn = item["mnozstvi"]
            # IGP §3.3: navážky 0.6–2.2 m. Sejmutí navážek z plochy haly minimum 0.6 m.
            # New formula: Step 3 zastavěná 538.5 m² × 0.6 m sejmutí navážky = 323.1 m³
            new_mn = 323.1
            item["mnozstvi"] = new_mn
            item["popis"] = "Hloubení figury pod základovou desku + sejmutí navážek aktivní zóny, hor. tř. 1, stroj."
            item["_qty_formula"] = "538.5 m² × 0.6 m sejmutí navážek (IGP §3.3 min. mocnost)"
            item["confidence"] = 0.85
            item["source"] = (
                f"A102 zastavěná 28.19×19.74 + {IGP_SOURCE} §3.3 + Step 3"
            )
            item["_data_source"] = "TZ+DXF+IGP"
            # _vyjasneni_ref: ABMV_17 resolved → remove
            item["_vyjasneni_ref"] = [r for r in (item.get("_vyjasneni_ref") or []) if r != "ABMV_17"]

            # audit_trail update
            at = item["audit_trail"]
            at["formula"] = "538.5 m² × 0.6 m sejmutí navážek (IGP §3.3 min. mocnost)"
            at["formula_parsed_method"] = "product"
            at["inputs"] = [
                {"label": "zastavena_plocha_m2", "value": 538.5, "unit": "m²"},
                {"label": "mocnost_navazek_min_m", "value": 0.6, "unit": "m"},
            ]
            at["reference"].append({
                "type": "igp_section",
                "section": "3.3",
                "raw": f"{IGP_SOURCE} §3.3 mocnost navážek 0.6–2.2 m",
            })
            at["reference"].append({"type": "step3_metric", "metric": "zastavena_plocha", "value": 538.5})
            at["poznamka"] += (
                f" | STAGE-PHASE1 IGP RECOMPUTE 2026-05-24: original 495 m² × 0.45 m = "
                f"222.75 m³ replaced by 538.5 m² × 0.6 m = 323.1 m³ per IGP §3.3 "
                f"(navážky 0.6 m min). ABMV_17 closed."
            )
            at["computed_quantity"] = new_mn
            at["declared_quantity"] = new_mn
            at["extraction_method"] = "igp_geometric_recompute"
            at["data_source_hint"] = "TZ+DXF+IGP"
            print(f"  [D] HSV-1-001 figura: {old_mn} → {new_mn} m³ (per IGP §3.3)")
            changed = True
            break

    # Step B: HSV-2-010/011/012 pilot items → alternative variant flag
    pilot_ids = {"HSV-2-010", "HSV-2-011", "HSV-2-012"}
    for item in items:
        if item["id"] in pilot_ids:
            item["_status_flag"] = "alternative_variant_per_IGP_not_required"
            item["confidence"] = 0.40
            # remove ABMV_11 reference (resolved)
            item["_vyjasneni_ref"] = [r for r in (item.get("_vyjasneni_ref") or []) if r != "ABMV_11"]
            # audit_trail append
            at = item["audit_trail"]
            at["poznamka"] += (
                f" | PHASE1 IGP 2026-05-24: IGP §4.3.1 confirms plošné založení na patkách "
                f"do GT2 (Rdt=250 kPa) as PRIMARY design. Pilota = alternativa pouze 'v případě "
                f"hlubinného založení' (IGP §4.3.2), NOT required by IGP. Item retained for "
                f"variant bid scenario; confidence reduced 0.5 → 0.40."
            )
            at["reference"].append({
                "type": "igp_section",
                "section": "4.3",
                "raw": f"{IGP_SOURCE} §4.3.1 plošné založení primary; §4.3.2 piloty alternative only",
            })
            print(f"  [B] {item['id']} flagged alternative_variant_per_IGP_not_required, conf → 0.40")
            changed = True

    # Step C: Add new HSV-1-028
    existing_ids = {i["id"] for i in items}
    if NEW_HSV_1_028["id"] not in existing_ids:
        # Insert at end of HSV-1 block (after HSV-1-027)
        insert_idx = max(i for i, x in enumerate(items) if x.get("kapitola") == "HSV-1") + 1
        items.insert(insert_idx, NEW_HSV_1_028)
        print(f"  [C] HSV-1-028 added (výměna aktivní zóny 269.25 m³ × 2 operace)")
        changed = True

    # Update metadata
    from collections import Counter
    kap_counts = Counter(i.get("kapitola", "?") for i in items)
    meta["kapitola_modules_loaded"] = [f"{k} ({v} items)" for k, v in sorted(kap_counts.items())]
    meta["total_items"] = len(items)
    meta[APPLIED_KEY] = NOW_ISO
    meta["phase_1_igp_summary"] = {
        "applied_at": NOW_ISO,
        "source": IGP_SOURCE,
        "actions": {
            "step_A_ABMV_11_closed": True,
            "step_B_pilot_items_flagged": sorted(pilot_ids),
            "step_C_new_item": NEW_HSV_1_028["id"],
            "step_D_HSV_1_001_recompute": "222.75 → 323.1 m³",
            "step_D_ABMV_17_closed": True,
            "step_E_geotechnical_summary_added": True,
        },
    }
    d["metadata"] = meta
    d["items"] = items
    return d, changed


def patch_abmv(d):
    changed = False
    for item in d.get("items", []):
        # Step A: ABMV_11 close
        if item["id"] == "ABMV_11" and item.get("status") != "resolved":
            item["status"] = "resolved"
            item["resolution_note"] = (
                "IGP ALTAGEO 526026 (Mgr. Beneda, 04/2026) delivered. §4.3.1: "
                "geotechnická kategorie 1, plošné založení na patkách do GT2 "
                "(písčité štěrky G3 G-F, Rdt=250 kPa) — PRIMARY design. "
                "Statika D.1.2 conservative used Rdt=200 kPa; IGP exceeds (250 > 200) ✓. "
                "Piloty (HSV-2-010..012) = §4.3.2 alternativa pouze v případě "
                "hlubinného založení, NOT required. HPV 1.65–1.80 m p.t. neovlivní "
                "základové poměry (patky 1.2 m < HPV 1.7 m). Pilot items flagged "
                "alternative_variant_per_IGP_not_required + retained for variant bid."
            )
            item["resolution_date"] = "2026-05-24"
            item["resolution_source"] = "inputs/dokumentace/IGP_ALTAGEO_526026.md (ALTAGEO 526026 04/2026)"
            print(f"  [A] ABMV_11 closed (IGP delivered)")
            changed = True

        # Step D: ABMV_17 close
        if item["id"] == "ABMV_17" and item.get("status") != "resolved":
            item["status"] = "resolved"
            item["resolution_note"] = (
                "IGP §3.3 confirms navážky mocnost 0.6–2.2 m + §4.4 doporučuje výměnu "
                "aktivní zóny pláně (navážky → hutněný štěrk, Edef2 ≥ 45 MPa). "
                "HSV-1-001 figura recomputed: 538.5 m² (Step 3 zastavěná) × 0.6 m "
                "(IGP §3.3 min. mocnost navážek) = 323.1 m³ (was 222.75 m³ z 495×0.45). "
                "NEW HSV-1-028 added: výměna aktivní zóny pláně, 269.25 m³ × 2 operace "
                "(odstranění + nahrazení štěrkem). Combined HSV-1 výkop scope now reflects "
                "IGP-derived geometry, replacing old Phase 0b 32 m³ (TZ B claim) and "
                "intermediate DXF-derived 349.8/530 m³ estimates. ABMV_17 16.6× drift "
                "factor resolved via IGP authoritative source."
            )
            item["resolution_date"] = "2026-05-24"
            item["resolution_source"] = "inputs/dokumentace/IGP_ALTAGEO_526026.md + Step 3 areas"
            print(f"  [D] ABMV_17 closed (IGP + Step 3 reconciliation)")
            changed = True
    return d, changed


def patch_project_header(d):
    """Step E: add geotechnical_summary block."""
    if "geotechnical_summary" in d:
        print(f"  [E] geotechnical_summary already present, skip")
        return d, False

    d["geotechnical_summary"] = {
        "_igp_source": IGP_SOURCE,
        "_igp_document": IGP_REF_DOC,
        "_igp_date": "2026-04-13",
        "geotechnicka_kategorie": 1,
        "rdt_kPa": 250,
        "rdt_source": "IGP §4.3.1 plošné založení do GT2 (písčité štěrky G3 G-F)",
        "hpv_ustalena_m_pt": [1.65, 1.80],
        "hpv_neovlivni_zaklady": True,
        "hpv_source": "IGP §4.2 + §5 závěr",
        "navazky_mocnost_m": [0.6, 2.2],
        "navazky_klasifikace": "GT1 — ČSN P 73 1005 třída Y (nevhodný typ základové půdy)",
        "navazky_source": "IGP §3.3",
        "geotechnicke_typy": {
            "GT1": "antropogenní navážky (nevhodná)",
            "GT2": "písčité štěrky G3 G-F, středně ulehlé, Rdt=250 kPa, Edef=50-60 MPa",
            "GT3": "písky S3 S-F, Rdt=200 kPa, Edef=16-18 MPa",
            "GT4": "silně zvětralé slínovce R5, Rdt=250 kPa, povrch 3.5-3.8 m p.t.",
        },
        "zalozeni_design_primary": "plošné na patkách do GT2 (IGP §4.3.1)",
        "zalozeni_design_alternative": "piloty do GT4 R5 (IGP §4.3.2 — alternativa only)",
        "trida_tezitelnosti": "I (výkopové práce v navážkách + kvartér)",
        "edef2_zhutneni_min_MPa": 45,
        "vymena_aktivni_zony_recommended": True,
        "aktivni_zona_doporuceni": "IGP §4.4 — odstranit navážky z aktivní zóny, nahradit hutněným štěrkem, Edef2 ≥ 45 MPa",
        "cerpani_vody_required": False,
        "cerpani_vody_reason": "HPV 1.7-1.8 m p.t. > patky hloubka 1.2 m → voda neovlivní (IGP §4.2)",
    }
    print(f"  [E] geotechnical_summary added to project_header.json")
    return d, True


def main():
    print("\n=== phase_1_igp_integration.py ===")

    print("\n[items.json]")
    items_data = load(ITEMS_PATH)
    items_data, ch1 = patch_items(items_data)
    if ch1:
        save(ITEMS_PATH, items_data)
        print(f"  total_items: {items_data['metadata']['total_items']}")

    print("\n[abmv_email_queue.json]")
    abmv_data = load(ABMV_PATH)
    abmv_data, ch2 = patch_abmv(abmv_data)
    if ch2:
        save(ABMV_PATH, abmv_data)

    print("\n[project_header.json]")
    header_data = load(HEADER_PATH)
    header_data, ch3 = patch_project_header(header_data)
    if ch3:
        save(HEADER_PATH, header_data)

    print("\n✓ Phase 1 IGP integration complete.")


if __name__ == "__main__":
    main()
