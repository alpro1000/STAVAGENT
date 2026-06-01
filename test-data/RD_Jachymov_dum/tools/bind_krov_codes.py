#!/usr/bin/env python3
"""
Krov leaf-binding refinement (2026-05-31) — catalog-confirmed 762332xxx by průřez.

Source: KROS/ÚRS catalog screenshot (user) + STAVAGENT MCP search. Krov timber is
classified in group 762332 "Montáž vázaných konstrukcí krovů pravidelných pomocí
ocelových spojek z hraněného řeziva" by PRŮŘEZOVÁ PLOCHA (cm²), not by element name.

Cross-section bands (ocelové spojky variant, MJ = m / bm):
  762332121 přes 50 do 120 cm²   (206 Kč/m)
  762332122 přes 120 do 224 cm²  (266 Kč/m)
  762332123 přes 224 do 288 cm²  (374 Kč/m)

Per element:
  krokve 100/180   = 180 cm²  → 762332122
  kleštiny 2×60/180 = 216 cm²  → 762332122
  pozednice 140/160 = 224 cm²  → 762332122 (do 224 incl.)
  námětky 60/100   = 60 cm²   → 762332121

Replaces the prior imprecise 762331xxx codes (krokve+námětky shared 762331911).
Montáž MJ stays bm (catalog = m). Material (hranol C24, m³) split added in
atomic_decomposition.py. Status → matched_catalog. (id, kapitola) key (Pattern 28).
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "outputs" / "items_rd_jachymov_complete.json"
TAG = "KROV_762332_LEAF_BIND_2026-05-31"

# id -> (montáž code, band label, prurez cm²)
KROV = {
    "260219_dum.HSV5.001": ("762332122", "přes 120 do 224 cm²", "180 cm² (100×180)"),
    "260219_dum.HSV5.002": ("762332122", "přes 120 do 224 cm²", "216 cm² (2×60×180)"),
    "260219_dum.HSV5.003": ("762332122", "přes 120 do 224 cm²", "224 cm² (140×160)"),
    "260219_dum.HSV5.004": ("762332121", "přes 50 do 120 cm²", "60 cm² (60×100)"),
}


def main() -> None:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    hit = []
    for it in data["items"]:
        key = it.get("id")
        if key in KROV and it.get("kapitola", "").startswith("HSV-5"):
            code, band, prurez = KROV[key]
            if it.get("urs_code_proposed") and it["urs_code_proposed"] != code:
                it["urs_code_proposed_was"] = it["urs_code_proposed"]
            it["urs_code_proposed"] = code
            it["urs_code_family_6digit"] = "762332"
            it["urs_status"] = "matched_catalog"
            it["urs_confidence"] = 0.9
            it["correct_code_hint"] = (
                f"KROS/ÚRS {code} — Montáž vázaných konstrukcí krovů pravidelných pomocí "
                f"ocelových spojek z hraněného řeziva, průřezová plocha {band} (prvek {prurez}). "
                f"MJ = m (bm). Materiál hranol C24 (m³, +10 % prořez) = samostatná op v atomic worklist "
                f"(60512136 hranol do 288 cm²). Ověřit způsob spoje (ocelové spojky vs tesařské spoje 762332131/132). "
                f"Dříve 762331xxx (méně přesné)."
            )
            it["_audit_gap_fixed"] = (str(it.get("_audit_gap_fixed") or "").strip("; ") + "; " + TAG).strip("; ")
            hit.append(f"{key} → {code} ({band})")

    if len(hit) != len(KROV):
        raise SystemExit(f"FAIL — matched {len(hit)}/{len(KROV)}: {hit}")

    data["_krov_leaf_bind_log"] = {
        "applied_at": "2026-05-31",
        "tag": TAG,
        "source": "KROS/ÚRS catalog (group 762332, ocelové spojky) + STAVAGENT MCP search",
        "method": "Classify krov timber by průřezová plocha cm², not element name",
        "changes": hit,
        "material_split": "atomic_decomposition.py — montáž 762332xxx (m) + dodávka řeziva C24 60512136 (m³)",
        "snapshot_before": "outputs/items_pre_krov_codes.json",
    }
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OK — krov montáž codes bound to 762332xxx:")
    for h in hit:
        print("  ", h)


if __name__ == "__main__":
    main()
