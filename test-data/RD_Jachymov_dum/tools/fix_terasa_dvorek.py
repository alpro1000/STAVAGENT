#!/usr/bin/env python3
"""
ŘEZ C-C terasa fix (2026-05-29) — Option B (split-by-trade), Pattern 26 honest codes.

ŘEZ C-C drawing proves the garden terasa walking surface is WOOD (prkna + dřevěný
rošt), not concrete tiles. The reconciliation interpretation "betonové dlaždice NA
terče → 636311" was wrong: the concrete tiles are a ROZNÁŠECÍ (load-distribution)
layer UNDER the rektifikovatelné terče, which carry the wooden deck.

Split-by-trade (no 30 m² double-count):
  - HSV1.005 (HSV-1)        = podkladní skladba: terče + betonové dlaždice roznášecí
                              POD terče + štěrk 16/32 + hrubý 4/8 + geotextilie.
  - PSV76.002 (PSV-76 Truhlář) = dřevěná pochozí vrstva: prkna garapa + dřevěný rošt.
                              Code 771474112 (dlaždice domain, WRONG) removed; family 762.

Identity = (id, kapitola) compound key (Pattern 28 — VRN.001/PSV76.002 id collisions).
Idempotent: sets fixed values, re-runnable. items.json count unchanged (214).
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"

FIX_TAG = "REZ_CC_TERASA_FIX_2026-05-29"


def patch_hsv1005(it: dict) -> None:
    it["subkapitola"] = "Terasa — podkladní skladba (pod dřevěnou pochozí vrstvou PSV76.002)"
    it["popis"] = (
        "Terasa za opěrnou stěnou — PODKLADNÍ SKLADBA pod dřevěnou pochozí vrstvou "
        "(PSV76.002 Truhlář): rektifikovatelné terče výšky ~50 mm + betonové dlaždice "
        "tl. 50 mm jako roznášecí vrstva POD terče + štěrkový podsyp 16/32 mm tl. 100 mm "
        "+ hrubý podsyp 4/8 mm tl. 150 mm + geotextilie separační"
    )
    it["mnozstvi_formula"] = (
        "PDF řez C-C explicit composition — terasa ~30 m² (rozměry z TZ ARS dům §4 terasa "
        "za op. stěnou). ŘEZ C-C: dlaždice = roznášecí vrstva POD terče (NE na terče); "
        "terče nesou dřevěnou pochozí vrstvu PSV76.002."
    )
    it["source"] = (
        "PDF řez D.1.1.2.2.21 řez C-C explicit composition — podkladní skladba terasy "
        "(terče + dlaždice roznášecí + podsypy + geotextilie); dřevěná pochozí vrstva "
        "(prkna garapa + dřevěný rošt) = samostatná položka PSV76.002 Truhlář (split-by-trade)"
    )
    it["urs_code_proposed"] = None
    it["urs_code_family_6digit"] = "564"
    it["urs_alternatives"] = ["596811220", "564851111"]
    it["urs_status"] = "family_564_leaf_lookup_required"
    it["cross_verification_status"] = "REZ_CC_CORRECTED_substructure_dlazdice_roznaseci_pod_terce"
    it["correct_code_hint"] = (
        "ŘEZ C-C OPRAVA 2026-05-29: betonové dlaždice = ROZNÁŠECÍ vrstva POD rektifikovatelné "
        "terče (NE '636311 dlaždice na terče' — to byla chyba reconciliation). Dřevěná pochozí "
        "vrstva (prkna + dřevěný rošt, família 762) = samostatná položka PSV76.002 Truhlář "
        "(split-by-trade, žádné zdvojení 30 m²). Podkladní roznášecí dlaždice + podsypy → "
        "família 564/596 — leaf Stage 3 (app.urs.cz)."
    )
    it["_audit_gap_fixed"] = "URS_PHASE5B_WRONG_LEAF; RECONCILIATION_A1A2_CONSENSUS; " + FIX_TAG


def patch_psv76002(it: dict) -> None:
    it["subkapitola"] = "Terasa garapa za opěrnou stěnou — dřevěná pochozí vrstva"
    it["popis"] = (
        "Dřevěná terasa za opěrnou stěnou — prkna garapa 145×25 mm na dřevěném roštu "
        "z hranolů 50 mm na rektifikovatelných terčích (terče + podkladní skladba viz HSV1.005)"
    )
    if it.get("urs_code_proposed") and it.get("urs_code_proposed") != "":
        it["urs_code_proposed_was"] = it["urs_code_proposed"]
    it["urs_code_proposed"] = None
    it["urs_code_family_6digit"] = "762"
    it["urs_alternatives"] = ["766811111"]
    it["urs_status"] = "family_762_leaf_lookup_required"
    it["source"] = (
        "TZ ARS dům §4 + DXF dum_situace PLOT_DREVENY_04 (terasa, ne 3.NP); "
        "ŘEZ C-C potvrzuje dřevěný rošt z hranolů (NE hliníkový) + dřevěnou pochozí vrstvu"
    )
    it["cross_verification_status"] = "REZ_CC_CORRECTED_wood_deck_762_split_by_trade"
    it["correct_code_hint"] = (
        "ŘEZ C-C 2026-05-29: dřevěná pochozí terasa (prkna garapa + dřevěný rošt z hranolů) "
        "→ família 762 (tesařské/truhlářské konstrukce). Kód 771474112 (dlaždice domain) BYL "
        "WRONG — odstraněn (Pattern 26, nefabrikovat leaf). Rošt opraven hliníkový→dřevěný "
        "per řez C-C. Podklad (terče + dlaždice roznášecí + podsypy + geotextilie) = HSV1.005 "
        "(split-by-trade, žádné zdvojení)."
    )
    it["_audit_gap_fixed"] = FIX_TAG


def patch_komin(it: dict) -> None:
    # ChatGPT revize QUANTITY_FLAG: formula self-documents 0.6 m³; 6.0 was a ×10 inflation.
    if it.get("mnozstvi") != 0.6:
        it["mnozstvi_was"] = it.get("mnozstvi")
    it["mnozstvi"] = 0.6
    it["mnozstvi_formula"] = (
        "průměr komín 0.50×0.50 × výška nad střechou ~2.4 m = 0.6 m³ "
        "(OPRAVA ChatGPT revize 2026-05-29: dříve 6.0 m³ = ×10 chybná inflace; skutečný objem 0.6 m³)"
    )
    it["_audit_gap_fixed"] = (str(it.get("_audit_gap_fixed") or "").strip("; ") + "; CHATGPT_KOMIN_QTY_FIX_2026-05-29").strip("; ")


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"]

    targets = {
        ("260219_dum.HSV1.005", "HSV-1 Zemní práce"): patch_hsv1005,
        ("260219_dum.PSV76.002", "PSV-76 Truhlář"): patch_psv76002,
        ("260219_dum.HSV6.016", "HSV-6 Bourací práce"): patch_komin,
    }

    hit = {k: False for k in targets}
    for it in items:
        key = (it.get("id"), it.get("kapitola"))
        if key in targets and not hit[key]:
            targets[key](it)
            hit[key] = True

    missing = [k for k, v in hit.items() if not v]
    if missing:
        raise SystemExit(f"FAIL — target item(s) not found: {missing}")

    data["_terasa_dvorek_fix_log"] = {
        "applied_at": "2026-05-29",
        "tag": FIX_TAG,
        "evidence": "ŘEZ C-C (D.1.1.2.2.21) — drawing-confirmed",
        "decision": "Option B — split-by-trade (no 30 m² double-count)",
        "changes": {
            "HSV1.005 (HSV-1)": "podkladní skladba: terče + betonové dlaždice ROZNÁŠECÍ POD terče + štěrk 16/32 + hrubý 4/8 + geotextilie; family 636311(na terče) → 564/596 (podkladní). Atomic decomp 4 → 5 ops.",
            "PSV76.002 (PSV-76 Truhlář)": "dřevěná pochozí vrstva: prkna garapa + dřevěný rošt z hranolů (hliníkový→dřevěný per řez). Code 771474112 → blank (Pattern 26), family 762. Atomic decomp 1 → 2 ops.",
            "HSV1.004 (HSV-1) dvorek": "atomic decomp 3 → 4 ops (dlažba 596 / kladecí vrstva 564 split); item popis already 4-layer, unchanged.",
        },
        "double_count_guard": "30 m² wood lives ONLY in PSV76.002; terče lives ONLY in HSV1.005a. No overlap.",
        "snapshot_before": "outputs/items_pre_terasa_fix.json",
        "items_total": len(items),
    }

    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK — patched HSV1.005 + PSV76.002 Truhlář. items_total={len(items)} (unchanged).")


if __name__ == "__main__":
    main()
