"""
rework_patky_vykop_deska_2026_05_24.py — major atomic rework per user 2026-05-24

Step 0 verdict: Outcome B — A201 paperspace has "BILANCE ZEMINY:" label
(@749.2,-71.6) but ZERO filled numerical values found. Surrounding texts =
view labels + elevation reference + POZNÁMKA paragraphs only. ABMV_22 created
to flag projektant fill required.

Steps:
  1. HSV-2-001 beton rámových: 37.8 → 22.875 m³ (10 × dvoustupňová pyramida)
  2. HSV-2-002 bednění rámových zřízení: 72.0 → 66.0 m² (10 × 6.6 m²/patka)
  3. HSV-2-003 bednění rámových odstranění: 72.0 → 66.0 m²
  4. HSV-2-004 beton štítových: 6.144 m³ (unchanged this commit — confirmed correct)
  5. HSV-2-005 bednění štítových zřízení: 30.72 m² (unchanged)
  6. HSV-2-006 bednění štítových odstranění: 30.72 m² (unchanged)
  7. HSV-1-001 výkop figura: 323.1 → 210 m³ (zone-by-zone per A201 + A105)
  8. HSV-1-028 výměna aktivní zóny: 269.25 → 265.6 m³ (531 × 0.5)
  9. HSV-2-013 deska beton: 99.0 → 106.24 m³ (531.22 × 0.20)
     HSV-2-015/016 KARI horní/dolní: 1955.25 → 2098.3 kg each (531.22 × 3.95)
 10. ABMV_22 NEW — A201 BILANCE ZEMINY unfilled, status=open
     ABMV_5 re-open — needs_design_clarification (2:2 split)
     HSV-2-013 flagged _review_concrete_class

NOT in this commit: piloty (HSV-2-010..012 stay flagged), HSV-3 mass
reconciliation, klempíř lemy, Stage E benchmark.
"""

import json
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent.parent.parent
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
ABMV_PATH = BASE / "outputs/abmv_email_queue.json"

NOW_ISO = datetime.now(timezone.utc).isoformat()
APPLIED_KEY = "rework_patky_vykop_deska_2026_05_24_applied"


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, d):
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"  saved → {p.name}")


# ── Step 1-3: patky rámové (dvoustupňová pyramida) ─────────────────────────
def update_hsv_2_001(item):
    """Beton patek rámových: 10 patek × dvoustupňová pyramida = 22.875 m³"""
    old_mn = item["mnozstvi"]
    # Per patek: dolní 1.5×1.5×0.6 = 1.35 + horní 1.25×1.25×0.6 = 0.9375 = 2.2875 m³
    new_mn = round(10 * (1.5 * 1.5 * 0.6 + 1.25 * 1.25 * 0.6), 3)  # 22.875
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = (
        "10 ks × [dolní 1.5×1.5×0.6 (1.35 m³) + horní 1.25×1.25×0.6 (0.9375 m³)] "
        "= 10 × 2.2875 m³ = 22.875 m³"
    )
    item["raw_description"] = (
        "patky rámové C16/20 dvoustupňové pyramida "
        "(dolní 1.5×1.5×0.6 + horní 1.25×1.25×0.6); 10 ks per A105 + statika rozteč 6.1 m"
    )

    at = item["audit_trail"]
    at["formula"] = (
        "10 × (1.5²×0.6 + 1.25²×0.6) = 10 × (1.35 + 0.9375) = 22.875 m³"
    )
    at["inputs"] = [
        {"label": "count_patek_ramovych", "value": 10, "unit": "ks"},
        {"label": "dolni_stupen_BxLxH_m", "value": "1.5 × 1.5 × 0.6", "unit": "m³"},
        {"label": "horni_stupen_BxLxH_m", "value": "1.25 × 1.25 × 0.6", "unit": "m³"},
        {"label": "per_patek_m3", "value": 2.2875, "unit": "m³"},
        {"label": "total_m3", "value": 22.875, "unit": "m³"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": (
            "A105 PŮDORYS ZÁKLADŮ — patky rámové 1500×1500 outer; dvoustupňová s horním "
            "stupněm zúženým na ~1250×1250 (pyramida tvar). HH/SH labels -0.700/-1.300/-1.900 "
            "→ 2 × 0.6 m stupně. User manual recount: 10 patek (5 rámů × 2 osy A+F)."
        ),
    })
    at["reference"].append({
        "type": "tz_section",
        "section": "D.1.2 (statika)",
        "raw": "Vzdálenost rámů 6,1 m → 5 rámů × 2 sloupy = 10 patek rámových. Geometric: 4×6.1 + krajní 3.78 = 28.18 m ✓ matches TZ ARS",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: 37.8 m³ → 22.875 m³. Previous F-3 fix (37.8) used "
        f"cube approximation 1.5×1.5×1.2 per patek (F-3 over-fix). Correct geometry is "
        f"DVOUSTUPŇOVÁ PYRAMIDA: dolní 1.5×1.5×0.6 + horní 1.25×1.25×0.6 = 2.2875 m³/patek. "
        f"Per A105 měřená geometrie + design intent (úspora betonu při zachování ložné plochy)."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    at["confidence"] = 0.92
    print(f"  [1] HSV-2-001 patky rámové beton: {old_mn} → {new_mn} m³ (dvoustupňová pyramida)")


def update_hsv_2_002(item):
    """Bednění patek rámových — dvoustupňová pyramida."""
    old_mn = item["mnozstvi"]
    # Per patek bočnice: dolní 4 × 1.5 × 0.6 = 3.6 + horní 4 × 1.25 × 0.6 = 3.0 = 6.6 m²
    new_mn = round(10 * (4 * 1.5 * 0.6 + 4 * 1.25 * 0.6), 1)  # 66.0
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = (
        "10 ks × [dolní 4×1.5×0.6 (3.6 m²) + horní 4×1.25×0.6 (3.0 m²)] = 10 × 6.6 = 66.0 m²"
    )

    at = item["audit_trail"]
    at["formula"] = "10 × (3.6 + 3.0) = 66.0 m²"
    at["inputs"] = [
        {"label": "count_patek", "value": 10, "unit": "ks"},
        {"label": "bednění_dolní_m2_per_patek", "value": 3.6, "unit": "m²"},
        {"label": "bednění_horní_m2_per_patek", "value": 3.0, "unit": "m²"},
        {"label": "total_m2_per_patek", "value": 6.6, "unit": "m²"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "Dvoustupňová pyramida — bednění 4 strany dolního + 4 strany horního stupně. Per patek = 6.6 m².",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: 100.8 m² → 72 m² (count 14→10) → 66 m² (dvoustupňová "
        f"pyramida 6.6 m²/patek vs prismatic 7.2). Previous commit was based on prismatic "
        f"shape; pyramida geometry per A105 reduces side area by ~9 %."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    at["confidence"] = 0.85
    print(f"  [2] HSV-2-002 bednění rámových zřízení: {old_mn} → {new_mn} m²")


def update_hsv_2_003(item):
    """Bednění patek rámových odstranění = HSV-2-002."""
    old_mn = item["mnozstvi"]
    new_mn = 66.0
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "= HSV-2-002 zřízení (dvoustupňová pyramida 10 patek) = 66.0 m²"

    at = item["audit_trail"]
    at["formula"] = "= HSV-2-002 = 66.0 m²"
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "Symmetric s HSV-2-002 (zřízení bednění)",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: symmetric s HSV-2-002. {old_mn} → {new_mn} m²."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [3] HSV-2-003 bednění rámových odstranění: {old_mn} → {new_mn} m²")


# Steps 4-6: štítové patky already correct (6.144 / 30.72 / 30.72) from previous commit
# No change needed — just verify state and add cross-validation note.

def verify_hsv_2_004_005_006(d):
    expected = {"HSV-2-004": 6.144, "HSV-2-005": 30.72, "HSV-2-006": 30.72}
    for item in d["items"]:
        if item["id"] in expected:
            assert item["mnozstvi"] == expected[item["id"]], (
                f"{item['id']} expected {expected[item['id']]}, got {item['mnozstvi']}"
            )
    print("  [4-6] HSV-2-004/005/006 štítové: confirmed at 6.144 / 30.72 / 30.72 (unchanged this commit)")


# ── Step 7: HSV-1-001 výkop figura zone-by-zone ────────────────────────────
def update_hsv_1_001(item):
    """Výkop figura: 323.1 → 210 m³ (zone-by-zone per A201 + A105)."""
    old_mn = item["mnozstvi"]
    new_mn = 210.0
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = (
        "Zone-by-zone per A201_vykopy + A105 (deska HH/SH labels): "
        "(1) Main floor -0.485 → 425 m² × 0.235 m = 100 m³ + "
        "(2) Perimeter pas -1.300 → 60 m² × 0.4 m = 24 m³ + "
        "(3) Patky pits -1.900 → 90 m² × 0.6 m = 54 m³ + "
        "(4) Kanalizace zone -1.620 → 10 m² × 0.7 m = 7 m³; "
        "subtotal 185 m³ + svahy 1:1 + dokopávky rezerva 25 m³ = 210 m³"
    )
    item["confidence"] = 0.75
    item["source"] = "A201_vykopy + A105_zaklady (HH/SH labels) + user zone-by-zone 2026-05-24"

    at = item["audit_trail"]
    at["formula"] = (
        "Zone-by-zone: 100 + 24 + 54 + 7 + 25 = 210 m³ "
        "(main_floor + perimeter_pas + patky_pits + kanalizace + svahy_rezerva)"
    )
    at["inputs"] = [
        {"label": "zone_1_main_floor", "value": "425 m² × 0.235 m", "unit": "100 m³"},
        {"label": "zone_2_perimeter_pas", "value": "60 m² × 0.4 m", "unit": "24 m³"},
        {"label": "zone_3_patky_pits_incremental", "value": "90 m² × 0.6 m", "unit": "54 m³"},
        {"label": "zone_4_kanalizace", "value": "10 m² × 0.7 m", "unit": "7 m³"},
        {"label": "subtotal", "value": 185, "unit": "m³"},
        {"label": "svahy_1to1_rezerva", "value": 25, "unit": "m³"},
        {"label": "total", "value": 210, "unit": "m³"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A201",
        "raw": (
            "A201_vykopy.dxf — paperspace BILANCE ZEMINY label (@749.2,-71.6) found but "
            "ZERO filled numerical values (Step 0 outcome B 2026-05-24). User zone-by-zone "
            "analysis substitutes projektant fill."
        ),
    })
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": (
            "A105 HH/SH labels: deska -0.485 (level after sejmutí navážek + lože), "
            "pas -1.300, patky bottom -1.900, kanalizace zone -1.620"
        ),
    })
    at["_analytical_journey"] = [
        {"date": "2026-05-14", "value_m3": 222.75, "method": "RE-RUN §3.10: 495 m² × 0.45 m flat", "status": "superseded"},
        {"date": "2026-05-24 (Phase 1 IGP)", "value_m3": 323.1, "method": "IGP §3.3: 538.5 m² × 0.6 m sejmutí navážek flat", "status": "superseded"},
        {"date": "2026-05-24 (ChatGPT estimate)", "value_m3": 65, "method": "REJECTED — undercounted main floor as ~121 m² instead of ~425 m²"},
        {"date": "2026-05-24 (this commit)", "value_m3": 210, "method": "A106/A201 zone-by-zone per A201 paperspace + A105 HH/SH labels", "status": "ACCEPTED"},
        {"date": "pending", "value_m3": "TBD", "method": "DXF layer scan A106/A201 for exact polygon areas per zone", "status": "future_refinement"},
    ]
    at["poznamka"] += (
        f" | REWORK 2026-05-24 zone-by-zone: {old_mn} m³ (IGP §3.3 flat 538.5×0.6) → "
        f"{new_mn} m³ (user A201 zone analysis). Reason: flat formula over-counts because "
        f"~60 % plochy je at -0.485 m (sejmutí navážky), zbytek je incremental at pas/patky/"
        f"kanalizace. Zone-by-zone = realistic; ABMV_22 flags need for projektant final fill."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    at["confidence"] = 0.75
    print(f"  [7] HSV-1-001 výkop figura: {old_mn} → {new_mn} m³ (zone-by-zone A201)")


# ── Step 8: HSV-1-028 výměna aktivní zóny recalibrate ──────────────────────
def update_hsv_1_028(item):
    """Výměna aktivní zóny: 269.25 → 265.6 m³ (deska area 531 m² vs Step3 538.5)."""
    old_mn = item["mnozstvi"]
    deska_area = 531.22  # A105 měřené 19.04 × 27.90
    new_mn = round(deska_area * 0.5, 2)  # 265.61
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = (
        f"A105 deska plocha 19.04 × 27.90 = 531.22 m² × 0.5 m vrstva = {new_mn} m³ "
        "(jedna operace — odstranění NEBO nahrazení)"
    )

    at = item["audit_trail"]
    at["formula"] = f"531.22 m² × 0.5 m = {new_mn} m³ × 2 operace"
    at["inputs"] = [
        {"label": "deska_area_m2", "value": deska_area, "unit": "m²"},
        {"label": "deska_source", "value": "A105 měřené 19.04 × 27.90", "unit": ""},
        {"label": "mocnost_vymeny_m", "value": 0.5, "unit": "m"},
        {"label": "operace_odstraneni_m3", "value": new_mn, "unit": "m³"},
        {"label": "operace_nahrazeni_m3", "value": new_mn, "unit": "m³"},
        {"label": "edef2_min_MPa", "value": 45.0, "unit": "MPa"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "Deska měřená 19.04 × 27.90 = 531.22 m² (full deska včetně přesahu obvodu). NOT TZ ARS p2 'podlahová plocha 495 m²' (excludes okrajový pas + přesah).",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: 269.25 m³ (Step 3 zastavěná 538.5 × 0.5) → {new_mn} m³ "
        f"(A105 deska 531.22 × 0.5). Reason: výměna aktivní zóny vychází z plochy desky + "
        f"obvodový pas, NE z full zastavěné (která zahrnuje převis střechy). A105 měřené."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [8] HSV-1-028 výměna aktivní zóny: {old_mn} → {new_mn} m³ (deska 531.22)")


# ── Step 9: HSV-2-013 deska + KARI scale ───────────────────────────────────
def update_hsv_2_013(item):
    """Deska beton: 99.0 → 106.24 m³ (531.22 × 0.20)."""
    old_mn = item["mnozstvi"]
    new_mn = round(531.22 * 0.20, 2)  # 106.24
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "A105 deska 19.04 × 27.90 m = 531.22 m² × 0.20 m = 106.24 m³"
    item["_review_concrete_class"] = True  # per ABMV_5 re-open

    at = item["audit_trail"]
    at["formula"] = f"531.22 × 0.20 = {new_mn} m³"
    at["inputs"] = [
        {"label": "deska_B_m", "value": 19.04, "unit": "m"},
        {"label": "deska_L_m", "value": 27.90, "unit": "m"},
        {"label": "deska_area_m2", "value": 531.22, "unit": "m²"},
        {"label": "tloustka_m", "value": 0.20, "unit": "m"},
        {"label": "volume_m3", "value": new_mn, "unit": "m³"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "A105 vnější rozměry desky 19.04 × 27.90 m. TZ ARS p2 'podlahová 495 m²' = podlaha excluding obvodový pas; A105 = full deska včetně přesahu = 531 m². 7 % rozdíl.",
    })
    at["reference"].append({
        "type": "abmv_reopen",
        "abmv_id": "ABMV_5",
        "raw": "ABMV_5 re-opened 2026-05-24 (needs_design_clarification): 2:2 split between A101+A105 (C30/37 XC2) vs TZ ARS+statika (C25/30 XC4). _review_concrete_class flag set.",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: 99.0 m³ (495 × 0.20) → {new_mn} m³ (A105 měřené 531.22 × 0.20). "
        f"Reason: TZ ARS 'podlahová 495 m²' is interior area; A105 full deska 531 m² includes "
        f"obvodový pas. _review_concrete_class flag added per ABMV_5 re-open."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    at["confidence"] = 0.85
    print(f"  [9a] HSV-2-013 deska beton: {old_mn} → {new_mn} m³ (A105 531.22 m²)")


def update_hsv_2_015(item):
    """KARI horní: 1955.25 → 2098.3 kg (531.22 × 3.95)."""
    old_mn = item["mnozstvi"]
    new_mn = round(531.22 * 3.95, 1)  # 2098.3
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "A105 deska 531.22 m² × 3.95 kg/m² (Kari Ø8 oka 100/100 single vrstva) = 2098.3 kg"

    at = item["audit_trail"]
    at["formula"] = f"531.22 × 3.95 = {new_mn} kg"
    at["inputs"] = [
        {"label": "deska_area_m2", "value": 531.22, "unit": "m²"},
        {"label": "kari_kg_per_m2", "value": 3.95, "unit": "kg/m² Ø8 100/100"},
    ]
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "Scale to A105 měřené deska 531.22 m² (was 495 m²).",
    })
    at["poznamka"] += (
        f" | REWORK 2026-05-24: 1955.25 → {new_mn} kg per A105 měřené deska area 531.22 m²."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [9b] HSV-2-015 KARI horní: {old_mn} → {new_mn} kg")


def update_hsv_2_016(item):
    """KARI dolní = HSV-2-015 (symmetric)."""
    old_mn = item["mnozstvi"]
    new_mn = 2098.3
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "= HSV-2-015 horní vrstva = 2098.3 kg"

    at = item["audit_trail"]
    at["formula"] = "= HSV-2-015 = 2098.3 kg"
    at["reference"].append({
        "type": "drawing_measurement",
        "code": "A105",
        "raw": "Symmetric horní vrstva. Scale na 531.22 m².",
    })
    at["poznamka"] += f" | REWORK 2026-05-24: {old_mn} → {new_mn} kg symmetric s HSV-2-015."
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [9c] HSV-2-016 KARI dolní: {old_mn} → {new_mn} kg")


# ── Step 11: cross-validation cite for HSV-2-001..003 (already in Step 1-3) ─

def patch_items():
    d = load(ITEMS_PATH)
    meta = d.get("metadata", {})
    if meta.get(APPLIED_KEY):
        print("  [skip] rework already applied")
        return False

    verify_hsv_2_004_005_006(d)

    dispatch = {
        "HSV-2-001": update_hsv_2_001,
        "HSV-2-002": update_hsv_2_002,
        "HSV-2-003": update_hsv_2_003,
        "HSV-1-001": update_hsv_1_001,
        "HSV-1-028": update_hsv_1_028,
        "HSV-2-013": update_hsv_2_013,
        "HSV-2-015": update_hsv_2_015,
        "HSV-2-016": update_hsv_2_016,
    }
    for item in d["items"]:
        fn = dispatch.get(item["id"])
        if fn:
            fn(item)

    meta[APPLIED_KEY] = NOW_ISO
    meta["rework_2026_05_24_summary"] = {
        "applied_at": NOW_ISO,
        "items_updated": list(dispatch.keys()),
        "new_abmv": "ABMV_22 (A201 bilance unfilled)",
        "reopened_abmv": "ABMV_5 (deska class 2:2 split)",
    }
    d["metadata"] = meta
    save(ITEMS_PATH, d)
    return True


# ── Step 10: ABMV updates ──────────────────────────────────────────────────
def patch_abmv():
    d = load(ABMV_PATH)
    existing_ids = {i["id"] for i in d.get("items", [])}
    changed = False

    # Re-open ABMV_5
    for item in d["items"]:
        if item["id"] == "ABMV_5" and item.get("status") != "needs_design_clarification":
            old_status = item.get("status")
            item["status"] = "needs_design_clarification"
            item["_reopen_date"] = "2026-05-24"
            item["_reopen_reason"] = (
                "Audit + A105 verification 2026-05-24: 2:2 split confirmed. "
                "A101 legend + A105 legend = C30/37 XC2 (2 drawings). "
                "TZ ARS + TZ statika D.1.2 = C25/30 XC4 (2 TZ docs). "
                "Real 2:2 split, not statika-wins-2:1. items.json HSV-2-013 retains C25/30 "
                "(statika authority for structural) + _review_concrete_class flag added. "
                "Projektant Volka / Doležal must verify intent for tender finalization."
            )
            item["working_assumption"] = "C25/30 XC4 (statika, structural authority) — PENDING projektant confirmation"
            item["_2_2_split_evidence"] = {
                "drawings_C30_37_XC2": ["A101 legend", "A105 legend"],
                "tz_C25_30_XC4": ["TZ ARS D.1.1 p3", "TZ statika D.1.2 p28"],
                "06_zaklady_titul_p01": "C16/20-XC0 — discarded (titul-list typo per ABMV_18 closure)",
            }
            print(f"  [10b] ABMV_5: {old_status} → needs_design_clarification (2:2 split)")
            changed = True

    # ABMV_22 NEW — A201 bilance unfilled
    if "ABMV_22" not in existing_ids:
        new_abmv = {
            "id": "ABMV_22",
            "category": "missing_specification",
            "severity": "minor",
            "status": "open",
            "title": "A201 BILANCE ZEMINY — placeholder header bez vyplněné hodnoty",
            "summary_cs": (
                "Step 0 verification 2026-05-24: A201_vykopy.dxf paperspace Layout1 obsahuje "
                "TEXT label 'BILANCE ZEMINY:' (@749.2, -71.6) ale ZERO filled numerical values "
                "found in nearby text. Surrounding texts = view labels (A_VYKOP/B_VYKOP/C_VYKOP) "
                "+ elevation reference +0.000 = 234.690 mnm Bpv + POZNÁMKA paragraphs only. "
                "Projektant Volka / Doležal must complete final bilance pro tender finalization."
            ),
            "blocks_vv": [
                "HSV-1 výkopová bilance final precision",
                "VRN odvoz zeminy final volume",
            ],
            "working_assumption": (
                "User zone-by-zone analysis 2026-05-24: 210 m³ ± 15 % range (185-235 m³). "
                "Components: main floor -0.485 (100 m³) + perimeter pas -1.300 (24 m³) + "
                "patky pits -1.900 (54 m³) + kanalizace -1.620 (7 m³) + svahy/rezerva (25 m³). "
                "Bid-stage acceptable, final precision pending DXF layer parse OR projektant fill."
            ),
            "evidence": {
                "a201_paperspace_layout1": "BILANCE ZEMINY label found at (749.2, -71.6) — no nearby filled values",
                "step0_scan_date": "2026-05-24",
                "user_zone_analysis_total_m3": 210,
                "alternative_estimates_history": {
                    "phase_0b_re_run": 222.75,
                    "igp_phase1_flat": 323.1,
                    "chatgpt_undercount": 65,
                },
            },
            "resolution_pending": "Projektant fill A201 bilance table OR DXF polygon layer scan",
            "_created_date": "2026-05-24",
            "_blocker_priority": "low (bid-stage acceptable, final precision pending)",
        }
        d["items"].append(new_abmv)
        print(f"  [10a] ABMV_22 created: A201 BILANCE ZEMINY unfilled (status=open)")
        changed = True

    if changed:
        save(ABMV_PATH, d)
    return changed


def main():
    print("\n=== rework_patky_vykop_deska_2026_05_24.py ===")
    print("\n[items.json]")
    patch_items()
    print("\n[abmv_email_queue.json]")
    patch_abmv()
    print("\n✓ Major rework complete.")


if __name__ == "__main__":
    main()
