"""
fix_f1_vrata_propagation.py — propagate ABMV_2 vrata 3.0→3.5 m to Step 3 + PSV-OPL items.

Per audit finding F-1: area_aggregates.json vrata_sekcni.size_m still [3.0, 4.0]
after ABMV_2 closure (TZ ARS = 3.5×4.0). PSV-OPL-001/002 mnozstvi 536.4 m² stale.

Recompute:
  otvory_old = 30×(1×1) + 4×(3.0×4.0) + 4×(1.05×2.1) = 30 + 48 + 8.82 = 86.82 m²
  otvory_new = 30×(1×1) + 4×(3.5×4.0) + 4×(1.05×2.1) = 30 + 56 + 8.82 = 94.82 m²
  fasada_brutto = 623.3 m² (unchanged)
  fasada_netto_old = 623.3 - 86.8 = 536.5 m²
  fasada_netto_new = 623.3 - 94.82 = 528.48 ≈ 528.5 m²
"""

import json
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent.parent.parent
AREA_PATH = BASE / "outputs/dsp_geometry_extraction/step3_areas/area_aggregates.json"
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
HEADER_PATH = BASE / "outputs/phase_1_etap1/project_header.json"

NOW_ISO = datetime.now(timezone.utc).isoformat()
APPLIED_KEY = "fix_f1_applied"


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, d):
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"  saved → {p.name}")


def patch_area_aggregates():
    d = load(AREA_PATH)
    if d.get("fasada_netto", {}).get("_f1_propagated"):
        print("  [skip] area_aggregates already propagated")
        return False

    fasada = d["fasada_netto"]
    old_netto = fasada["value_m2"]
    old_otvory = fasada["otvory_plocha_m2"]

    # Recompute otvory with vrata 3.5×4.0
    windows = 30 * (1.0 * 1.0)             # 30 m²
    vrata = 4 * (3.5 * 4.0)                # 56 m² (was 48)
    dvere = 4 * (1.05 * 2.1)               # 8.82 m²
    new_otvory = windows + vrata + dvere   # 94.82 m²
    new_netto = 623.3 - new_otvory         # 528.48 m²

    fasada["value_m2"] = round(new_netto, 1)
    fasada["otvory_plocha_m2"] = round(new_otvory, 1)
    fasada["otvory_breakdown"]["vrata_sekcni"]["size_m"] = [3.5, 4.0]
    fasada["source"] = (
        "brutto − otvory plocha (windows 30 + vrata 4 + dveře 4) — "
        "vrata 3.5×4.0 per TZ ARS DPZ D.1.1 p4 (ABMV_2 resolved 2026-05-22)"
    )
    fasada["_f1_propagated"] = True
    fasada["_f1_propagation_date"] = NOW_ISO
    fasada["_f1_history"] = {
        "old_otvory_m2": old_otvory,
        "old_netto_m2": old_netto,
        "delta_otvory_m2": round(new_otvory - old_otvory, 2),
        "delta_netto_m2": round(new_netto - old_netto, 2),
        "reason": "ABMV_2 closed 2026-05-22 — vrata 3.0×4.0 (DXF block) → 3.5×4.0 (TZ ARS); Step 3 propagation missed last session",
    }
    print(f"  area_aggregates: fasada_netto {old_netto} → {fasada['value_m2']} m² "
          f"(otvory {old_otvory} → {fasada['otvory_plocha_m2']})")
    save(AREA_PATH, d)
    return True


def patch_items():
    d = load(ITEMS_PATH)
    meta = d.get("metadata", {})
    if meta.get(APPLIED_KEY):
        print("  [skip] items.json F-1 already applied")
        return False

    new_mn = 528.5
    for item in d["items"]:
        if item["id"] in ("PSV-OPL-001", "PSV-OPL-002"):
            old_mn = item["mnozstvi"]
            item["mnozstvi"] = new_mn
            item["_qty_formula"] = (
                "fasáda netto Step3 v2: obvod 103.5 m × výška 6.02 m − otvory 94.82 m² "
                "(vrata 3.5×4.0 per TZ ARS DPZ ABMV_2 resolved)"
            )
            at = item["audit_trail"]
            # Update inputs
            at["inputs"] = [
                {"label": "fasada_netto_m2", "value": new_mn, "unit": "m²"},
                {"label": "fasada_brutto_m2", "value": 623.3, "unit": "m²"},
                {"label": "otvory_m2", "value": 94.82, "unit": "m²"},
                {"label": "vrata_size_m", "value": "3.5 × 4.0", "unit": ""},
            ]
            at["formula"] = (
                "fasáda netto Step3 v2: 623.3 m² brutto − 94.82 m² otvory "
                "(vrata 3.5×4.0 per TZ ARS) = 528.5 m²"
            )
            at["poznamka"] += (
                f" | FIX F-1 (2026-05-24): mnozstvi {old_mn} → {new_mn} m² propagace "
                f"ABMV_2 closure (vrata 3.0→3.5 m). Step 3 area_aggregates updated."
            )
            at["computed_quantity"] = new_mn
            at["declared_quantity"] = new_mn
            at["reference"].append({
                "type": "abmv_closure",
                "abmv_id": "ABMV_2",
                "raw": "vrata 3.5×4.0 m per TZ ARS DPZ D.1.1 p4 (resolved 2026-05-22)",
            })
            print(f"  {item['id']}: {old_mn} → {new_mn} m²")

    meta[APPLIED_KEY] = NOW_ISO
    d["metadata"] = meta
    save(ITEMS_PATH, d)
    return True


def patch_project_header():
    d = load(HEADER_PATH)
    gs = d.get("geometric_summary", {})
    if gs.get("_f1_propagated"):
        print("  [skip] project_header F-1 already applied")
        return False

    old = gs.get("fasada_netto_m2")
    gs["fasada_netto_m2"] = 528.5
    gs["_f1_propagated"] = True
    gs["_f1_note"] = f"fasada_netto recompute {old} → 528.5 per ABMV_2 closure (vrata 3.5×4.0)"
    print(f"  project_header: fasada_netto_m2 {old} → 528.5")
    save(HEADER_PATH, d)
    return True


def main():
    print("\n=== fix_f1_vrata_propagation.py ===")
    print("\n[1] area_aggregates.json")
    patch_area_aggregates()
    print("\n[2] items_hk212_etap1.json")
    patch_items()
    print("\n[3] project_header.json")
    patch_project_header()
    print("\n✓ F-1 propagation complete.")


if __name__ == "__main__":
    main()
