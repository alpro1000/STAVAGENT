"""
update_kingspan_specs_and_patky_count.py — atomic update per user 2026-05-24

Steps:
  1-4. PSV-OPL-001..004 — Kingspan-specific products per TZ statika D.1.2 quote
  5.   HSV-2-001/002/003 — recompute for 10 patek rámových (was 14 per F-3 fix)
       per statika rozteč rámů 6.1 m + user A105 manual count
  6.   HSV-3-004 IPE 160 vaznice — flag mass drift in audit_trail (NO qty change)
  7.   HSV-2-004/005/006 — štítové patky H=1.2 m (was 0.8 m typo in TZ ARS p3)
  8.   ABMV_21 NEW — štítové patky height typo, status: resolved
  9.   Pattern 10 added separately to STAVAGENT_PATTERNS.md

Evidence cited inline per audit_trail. Idempotent via metadata flag.
"""

import json
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent.parent.parent
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
ABMV_PATH = BASE / "outputs/abmv_email_queue.json"

NOW_ISO = datetime.now(timezone.utc).isoformat()
APPLIED_KEY = "update_kingspan_specs_applied_2026_05_24"

STATIKA_QUOTE = (
    "Střešní panely budou navrženy z panelů KINGSPAN KS FF-ROC tl. 200 mm. "
    "Panely je možné uložit dle libosti (prostý spojitý o dvou polích nebo třech polích) "
    "vaznice budou vzdálené max 1,5 m což vyhoví pro všechny případy zatížení. "
    "Stěnové panely budou navrženy z panelů KINGSPAN KS NF 200 mm. "
    "...Vzdálenost rámů bude 6,1 m."
)

STATIKA_REF = {
    "type": "tz_section",
    "section": "D.1.2 (statika) — Návrh opláštění",
    "raw": STATIKA_QUOTE,
}


def load(p):
    return json.load(open(p, encoding="utf-8"))


def save(p, d):
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"  saved → {p.name}")


def update_psv_opl_001(item):
    """OPL-001 KS NF 200 mm stěnový panel."""
    item["popis"] = (
        "Kingspan KS NF 200 mm, jádro minerální vata (MW) per TZ ARS p4 + PBR §3 + "
        "ABMV_13 closure, plech vnější/vnitřní 0.6/0.4 mm, profilace M (Micro)/Q "
        "(Minibox), S280GD/S280GD, dle EN 14509:2013, výrobní závod Hradec Králové "
        "(Kingspan ČR), barva bílá + modrá (RAL standard)"
    )
    item["raw_description"] = "Kingspan KS NF 200 mm MW 0.6/0.4 S280GD EN 14509"
    item["confidence"] = 0.95
    item["source"] = (
        "TZ statika D.1.2 (Návrh opláštění) + TZ ARS D.1.1 p4 + PBR §3 + Step3 areas + "
        "ABMV_13 closed_fabricated"
    )
    # Remove "alt. 150 mm" mention from any review flags
    item.pop("_review_thickness", None)

    at = item["audit_trail"]
    at["reference"].append(STATIKA_REF)
    at["reference"].append({
        "type": "abmv_closure",
        "abmv_id": "ABMV_13",
        "raw": "K-roc MW vs IPN: closed_fabricated 2026-05-13. MW confirmed across TZ ARS + PBR + statika.",
    })
    at["poznamka"] += (
        f" | UPDATE 2026-05-24: popis spec hardened per statika TZ D.1.2 verbatim — "
        f"KS NF 200 mm Hradec Králové (NOT generic KS1000 AWP). Removed 'alt. 150 mm' "
        f"(statika confirms 200 mm jediný variant). Confidence 0.90 → 0.95 — 4 consistent "
        f"sources (TZ ARS + PBR + statika + ABMV_13 closure)."
    )
    at["confidence"] = 0.95
    print(f"  [1] PSV-OPL-001: popis → KS NF 200 mm Hradec Králové; conf 0.90 → 0.95")


def update_psv_opl_002(item):
    """OPL-002 montáž stěnový."""
    item["popis"] = (
        "Montáž obvodového opláštění Kingspan KS NF 200 mm — kotvení samořeznými "
        "šrouby + EPDM těsnicí podložkou k ocelové konstrukci (rozteč rámů 6,1 m "
        "per statika), per TZ ARS D.1.1 p4 montážní předpis výrobce"
    )
    item["confidence"] = 0.90
    item["source"] = (
        "TZ statika D.1.2 (rozteč rámů 6.1 m) + TZ ARS D.1.1 p4 (EPDM šrouby) + Step3"
    )
    at = item["audit_trail"]
    at["reference"].append(STATIKA_REF)
    at["poznamka"] += (
        " | UPDATE 2026-05-24: rozteč rámů 6.1 m per statika TZ D.1.2 added to popis. "
        "Confidence 0.90 → 0.90 (unchanged, montáž has slightly less spec authority than dodávka)."
    )
    at["confidence"] = 0.90
    print(f"  [2] PSV-OPL-002: popis + rozteč rámů 6.1 m cite added")


def update_psv_opl_003(item):
    """OPL-003 KS FF-ROC 200 mm střešní."""
    item["popis"] = (
        "Kingspan KS FF-ROC tl. 200 mm, jádro ROC (Rockwool — minerální vata), "
        "pro šikmé střechy sklon 5.25°, plech vnější/vnitřní 0.6/0.5 mm, profilace "
        "trapéz 34 mm/Q (minibox), S280GD/S280GD, dle EN 14509:2013, výrobní závod "
        "Lipsko (Kingspan Polská republika), vaznice rozteč max 1.5 m per statika"
    )
    item["raw_description"] = "Kingspan KS FF-ROC 200 mm ROC šikmé střechy sklon 5.25°"
    item["confidence"] = 0.95
    item["source"] = (
        "TZ statika D.1.2 (Návrh opláštění) + TZ ARS D.1.1 p4 + PBR §3 + Step3 areas + "
        "ABMV_13 closed_fabricated"
    )
    # REMOVE _review_thickness flag — statika confirms 200 mm explicitly
    item.pop("_review_thickness", None)

    at = item["audit_trail"]
    at["reference"].append(STATIKA_REF)
    at["reference"].append({
        "type": "abmv_closure",
        "abmv_id": "ABMV_13",
        "raw": "K-roc MW: closed_fabricated 2026-05-13. ROC = Rockwool = MW. Consistent across all sources.",
    })
    at["poznamka"] += (
        f" | UPDATE 2026-05-24: _review_thickness flag REMOVED — statika TZ D.1.2 "
        f"explicitly specifies 'KINGSPAN KS FF-ROC tl. 200 mm'. ROC = Rockwool = MW core. "
        f"Confidence 0.90 → 0.95 (statika direct product specification with tloušťka)."
    )
    at["confidence"] = 0.95
    print(f"  [3] PSV-OPL-003: KS FF-ROC 200 mm explicit; _review_thickness REMOVED; conf 0.90 → 0.95")


def update_psv_opl_004(item):
    """OPL-004 montáž střešní."""
    item["popis"] = (
        "Montáž střešního opláštění Kingspan KS FF-ROC 200 mm — kotvení k ocelové "
        "konstrukci samořeznými šrouby + těsnění přesahů, uložení prosté/spojité (2-3 polí) "
        "na vaznicích rozteč max 1.5 m per statika TZ D.1.2"
    )
    item["confidence"] = 0.90
    item["source"] = (
        "TZ statika D.1.2 (vaznice rozteč 1.5 m) + TZ ARS D.1.1 p4 + Step3"
    )
    at = item["audit_trail"]
    at["reference"].append(STATIKA_REF)
    at["poznamka"] += (
        " | UPDATE 2026-05-24: vaznice rozteč max 1.5 m per statika TZ D.1.2 added. "
        "Confidence 0.90 → 0.90 unchanged."
    )
    at["confidence"] = 0.90
    print(f"  [4] PSV-OPL-004: vaznice rozteč 1.5 m cite added")


def update_hsv_2_001(item):
    """HSV-2-001 patky rámové: 14 → 10 patek per statika 6.1 m rozteč."""
    old_mn = item["mnozstvi"]
    new_mn = 10 * 1.5 * 1.5 * 1.2  # 27.0 m³
    item["mnozstvi"] = round(new_mn, 1)
    item["_qty_formula"] = "10 ks × 1.5 × 1.5 × 1.2 m (dvoustupňová 2×0.6) = 27.0 m³"
    item["raw_description"] = "patky rámové C16/20 dvoustupňové 1.5×1.5×(2×0.6); 10 ks per statika rozteč 6.1 m × 5 rámů"

    at = item["audit_trail"]
    at["formula"] = "10 ks × 1.5 × 1.5 × 1.2 m = 27.0 m³ (rámových sloupů 5 rámů × 2 sloupy/rám)"
    at["inputs"] = [
        {"label": "count_patek_ramovych", "value": 10, "unit": "ks"},
        {"label": "B_m", "value": 1.5, "unit": "m"},
        {"label": "L_m", "value": 1.5, "unit": "m"},
        {"label": "H_m_total", "value": 1.2, "unit": "m"},
    ]
    at["reference"].append({
        "type": "tz_section",
        "section": "D.1.2 (statika) — Návrh ztužení / Vzdálenost rámů",
        "raw": "Vzdálenost rámů bude 6,1 m. Hala 28.18 m délka / 6.1 m rozteč = 4 fields + krajní → 5 rámů × 2 sloupy = 10 patek rámových.",
    })
    at["reference"].append({
        "type": "user_drawing_count",
        "raw": "A105 PŮDORYS ZÁKLADŮ — user manual count of 1500×1500 patky on axes A + F across rows 1-6 = 10 patek (excl. A3 atypical/pilota variant). Geometric consistency: 4 × 6.1 m = 24.4 m + krajní (3.78 m) = 28.18 m ✓ matches TZ ARS",
    })
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: count 14 (F-3 fix bednění math) → 10 (statika rozteč "
        f"6.1 m × 5 rámů + A105 manual count). mnozstvi {old_mn} → {new_mn} m³. F-3 fix "
        f"used bednění 100.8 m² ÷ 7.2 m²/patka = 14, but 100.8 m² was likely over-counted; "
        f"statika rozteč is authoritative for count."
    )
    at["computed_quantity"] = round(new_mn, 1)
    at["declared_quantity"] = round(new_mn, 1)
    at["confidence"] = 0.95
    print(f"  [5] HSV-2-001 patky rámové: {old_mn} → {new_mn} m³ (10 patek per statika 6.1 m rozteč)")


def update_hsv_2_002(item):
    """HSV-2-002 bednění rámových: 14 → 10 patek."""
    old_mn = item["mnozstvi"]
    new_mn = 10 * 4 * 1.5 * 1.2  # = 72.0 m²
    item["mnozstvi"] = round(new_mn, 1)
    item["_qty_formula"] = "10 ks × 4 strany × 1.5 m × 1.2 m výška = 72.0 m²"

    at = item["audit_trail"]
    at["formula"] = "10 ks × 4 × 1.5 × 1.2 m = 72.0 m²"
    at["inputs"] = [
        {"label": "count_patek", "value": 10, "unit": "ks"},
        {"label": "strany", "value": 4, "unit": ""},
        {"label": "sirka_m", "value": 1.5, "unit": "m"},
        {"label": "vyska_total_m", "value": 1.2, "unit": "m"},
    ]
    at["reference"].append(STATIKA_REF)
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: 14 → 10 patek per statika rozteč rámů 6.1 m × 5 rámů. "
        f"Mnozstvi {old_mn} → {new_mn} m²."
    )
    at["computed_quantity"] = round(new_mn, 1)
    at["declared_quantity"] = round(new_mn, 1)
    print(f"  [5] HSV-2-002 bednění rámové zřízení: {old_mn} → {new_mn} m²")


def update_hsv_2_003(item):
    """HSV-2-003 bednění odstranění rámových: same as HSV-2-002."""
    old_mn = item["mnozstvi"]
    new_mn = 72.0
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "= HSV-2-002 bednění zřízení (10 patek) = 72.0 m²"

    at = item["audit_trail"]
    at["formula"] = "= HSV-2-002 zřízení = 72.0 m²"
    at["reference"].append(STATIKA_REF)
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: 14 → 10 patek (symmetric s HSV-2-002). {old_mn} → {new_mn} m²."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [5] HSV-2-003 bednění rámové odstranění: {old_mn} → {new_mn} m²")


def update_hsv_2_004(item):
    """HSV-2-004 patky štítové beton: H 0.8 → 1.2 m (typo resolved per A105)."""
    old_mn = item["mnozstvi"]
    new_mn = round(8 * 0.8 * 0.8 * 1.2, 3)  # 6.144 m³
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "8 ks × 0.8 × 0.8 × 1.2 m = 6.144 m³ (dvoustupňová 2×0.6, A105 HH/SH measured)"
    item["raw_description"] = "patky štítové C16/20 dvoustupňové 0.8×0.8×(2×0.6=1.2)"

    at = item["audit_trail"]
    at["formula"] = "8 ks × 0.8 × 0.8 × 1.2 m = 6.144 m³"
    at["inputs"] = [
        {"label": "count_stitove", "value": 8, "unit": "ks"},
        {"label": "B_m", "value": 0.8, "unit": "m"},
        {"label": "L_m", "value": 0.8, "unit": "m"},
        {"label": "H_m_total", "value": 1.2, "unit": "m"},
    ]
    at["reference"].append({
        "type": "tz_typo_resolution",
        "abmv_id": "ABMV_21",
        "raw": "TZ ARS p3 '0,8×0,8×(0,2×0,6m)' interpreted as typo (missing × before 0,2; should read 2×0,6). A105 HH/SH measured H = 1.2 m. ABMV_21 resolved 2026-05-24.",
    })
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: H 0.8 m (TZ ARS literal typo) → 1.2 m (A105 measured "
        f"+ statika consistency). Mnozstvi {old_mn} → {new_mn} m³. See ABMV_21."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    at["confidence"] = 0.85
    print(f"  [7] HSV-2-004 patky štítové: {old_mn} → {new_mn} m³ (H 0.8 → 1.2 per ABMV_21)")


def update_hsv_2_005(item):
    """HSV-2-005 bednění štítových zřízení: H 0.8 → 1.2 m."""
    old_mn = item["mnozstvi"]
    new_mn = round(8 * 4 * 0.8 * 1.2, 2)  # 30.72 m²
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "8 ks × 4 strany × 0.8 m × 1.2 m výška = 30.72 m²"

    at = item["audit_trail"]
    at["formula"] = "8 × 4 × 0.8 × 1.2 = 30.72 m²"
    at["inputs"] = [
        {"label": "count", "value": 8, "unit": "ks"},
        {"label": "strany", "value": 4, "unit": ""},
        {"label": "sirka", "value": 0.8, "unit": "m"},
        {"label": "vyska", "value": 1.2, "unit": "m"},
    ]
    at["reference"].append({
        "type": "tz_typo_resolution",
        "abmv_id": "ABMV_21",
        "raw": "Štítové patky H = 1.2 m per ABMV_21 (A105 measured + dvoustupňová 2×0.6 interpretation)",
    })
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: H 0.8 → 1.2 m per ABMV_21. Mnozstvi {old_mn} → {new_mn} m²."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [7] HSV-2-005 bednění štítové zřízení: {old_mn} → {new_mn} m²")


def update_hsv_2_006(item):
    """HSV-2-006 bednění štítových odstranění: same as HSV-2-005."""
    old_mn = item["mnozstvi"]
    new_mn = 30.72
    item["mnozstvi"] = new_mn
    item["_qty_formula"] = "= HSV-2-005 zřízení = 30.72 m²"

    at = item["audit_trail"]
    at["formula"] = "= HSV-2-005 = 30.72 m²"
    at["reference"].append({
        "type": "tz_typo_resolution",
        "abmv_id": "ABMV_21",
        "raw": "Štítové patky H = 1.2 m per ABMV_21",
    })
    at["poznamka"] += (
        f" | RECOMPUTE 2026-05-24: symmetric s HSV-2-005. {old_mn} → {new_mn} m²."
    )
    at["computed_quantity"] = new_mn
    at["declared_quantity"] = new_mn
    print(f"  [7] HSV-2-006 bednění štítové odstranění: {old_mn} → {new_mn} m²")


def update_hsv_3_004(item):
    """HSV-3-004 IPE 160 vaznice — FLAG mass drift in audit_trail, no qty change."""
    at = item["audit_trail"]
    at["reference"].append({
        "type": "tz_section",
        "section": "D.1.2 (statika) — vaznice rozteč",
        "raw": "Vaznice budou vzdálené max 1,5 m (statika TZ D.1.2)",
    })
    at["poznamka"] += (
        f" | FLAG 2026-05-24: cross-check vs statika 1.5 m rozteč + Step 3 střecha 558.8 m². "
        f"Estimate: ~13 vaznic × 28.18 m × 15.8 kg/m = 5,789 kg. Current 5,195 kg = "
        f"drift +11.4 %. NO qty mutation this commit — HSV-3 mass reconciliation task "
        f"(PROFILY DXF geometry extraction) will resolve definitively."
    )
    at["_review_mass_drift"] = {
        "estimate_kg": 5789,
        "current_kg": 5195.04,
        "drift_pct": 11.4,
        "method": "statika 1.5 m vaznic rozteč × Step 3 plocha 558.8 m² / délka 28.18 m × IPE 160 15.8 kg/m",
        "resolution_task": "HSV-3 PROFILY DXF geometry extraction (Step 4 deferred)",
    }
    print(f"  [6] HSV-3-004 IPE 160 vaznice: mass drift +11.4 % FLAGGED (no qty change)")


def patch_items():
    d = load(ITEMS_PATH)
    meta = d.get("metadata", {})
    if meta.get(APPLIED_KEY):
        print("  [skip] update already applied")
        return False

    dispatch = {
        "PSV-OPL-001": update_psv_opl_001,
        "PSV-OPL-002": update_psv_opl_002,
        "PSV-OPL-003": update_psv_opl_003,
        "PSV-OPL-004": update_psv_opl_004,
        "HSV-2-001": update_hsv_2_001,
        "HSV-2-002": update_hsv_2_002,
        "HSV-2-003": update_hsv_2_003,
        "HSV-2-004": update_hsv_2_004,
        "HSV-2-005": update_hsv_2_005,
        "HSV-2-006": update_hsv_2_006,
        "HSV-3-004": update_hsv_3_004,
    }
    for item in d["items"]:
        fn = dispatch.get(item["id"])
        if fn:
            fn(item)

    meta[APPLIED_KEY] = NOW_ISO
    meta["kingspan_statika_update_summary"] = {
        "applied_at": NOW_ISO,
        "source_quote": STATIKA_QUOTE,
        "items_updated": list(dispatch.keys()),
        "new_abmv": "ABMV_21",
    }
    d["metadata"] = meta
    save(ITEMS_PATH, d)
    return True


def patch_abmv():
    d = load(ABMV_PATH)
    existing_ids = {i["id"] for i in d.get("items", [])}
    if "ABMV_21" in existing_ids:
        print("  [skip] ABMV_21 already present")
        return False

    new_abmv = {
        "id": "ABMV_21",
        "category": "documentation_inconsistency",
        "severity": "minor",
        "status": "resolved",
        "title": "Štítové patky H — TZ ARS p3 typo vs A105 měřená H = 1.2 m",
        "summary_cs": (
            "TZ ARS D.1.1 p3 uvádí 'Základy pod štítové sloupy ... 0,8×0,8×(0,2×0,6m) "
            "z prostého betonu C16/20 XC0' — literal interpretation H = 0.2+0.6 = 0.8 m. "
            "A105 DSP PŮDORYS ZÁKLADŮ však ukazuje štítové patky s HH/SH labels -0.700/-1.900 "
            "(H = 1.2 m), shodně s rámovými patkami (1.5×1.5×(2×0.6))."
        ),
        "blocks_vv": [
            "HSV-2-004 beton patky štítové",
            "HSV-2-005 bednění zřízení",
            "HSV-2-006 bednění odstranění",
        ],
        "evidence": {
            "tz_ars_d11_p3": "'0,8×0,8×(0,2×0,6m)' literal = H 0.8 m",
            "a105_dsp_pudorys": "HH = -0.700 / SH = -1.900 → H = 1.2 m (consistent s rámovými)",
            "tz_statika_d12": "Stejnou geometrii štítových neuvádí explicit — bez konfliktu",
            "dvoustupňová_logic": "Dva přibližně stejné stupně jsou normou; H 0.2+0.6 = 0.8 m s nerovnoměrnými stupni je atypické",
            "praxe": "Průmyslové haly tohoto rozpětí (6.1 m rámy, 200 kPa zemina) typicky H 1.0-1.5 m pro štítové",
        },
        "resolution_note": (
            "TZ ARS p3 quote '0,8×0,8×(0,2×0,6m)' is interpreted jako typo (chybělo '×' "
            "před '0,2', should read '2×0,6'). Evidence: "
            "(1) A105 měřená geometrie HH/SH labels = -0.700/-1.900 = H 1.2 m. "
            "(2) Logika dvoustupňové konstrukce vyžaduje dva cca stejné stupně. "
            "(3) Statika TZ D.1.2 neuvádí odlišnou geometrii štítových. "
            "(4) Praxe pro průmyslové haly tohoto rozpětí = H 1.0–1.5 m. "
            "A105 wins, classified jako tz_ars_typo_per_design_intent. "
            "Items.json HSV-2-004 mnozstvi: 4.096 → 6.144 m³; HSV-2-005/006 bednění: "
            "20.8 → 30.72 m²."
        ),
        "resolution_date": "2026-05-24",
        "resolution_source": "inputs/vykresy_dxf/A105_zaklady.dxf (HH/SH labels) + design intent dvoustupňová geometry",
        "_resolution_classification": "tz_ars_typo_per_design_intent",
    }
    d["items"].append(new_abmv)
    save(ABMV_PATH, d)
    print(f"  [8] ABMV_21 created + resolved (štítové H = 1.2 m typo interpretation)")
    return True


def main():
    print("\n=== update_kingspan_specs_and_patky_count.py ===")
    print("\n[1] items_hk212_etap1.json")
    patch_items()
    print("\n[2] abmv_email_queue.json")
    patch_abmv()
    print("\n✓ Update complete.")


if __name__ == "__main__":
    main()
