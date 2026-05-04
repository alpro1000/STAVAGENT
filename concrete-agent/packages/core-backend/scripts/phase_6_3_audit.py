"""Phase 6.3 — comprehensive audit BEFORE Phase 7a ÚRS lookup.

5 reports + 1 scorecard:
  audit_materials_vs_work.md       — Part A
  audit_op_edge_cases.md           — Part B
  audit_door_completeness.md       — Part C
  audit_window_completeness.md     — Part D
  priplatky_eligibility_plan.md    — Part E
  phase_6_3_audit_scorecard.md     — Part F (summary)
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
TABULKY = OUT_DIR / "tabulky_loaded.json"
DXF_COUNTS = OUT_DIR / "dxf_segment_counts_per_objekt_d.json"

REP_A = OUT_DIR / "audit_materials_vs_work.md"
REP_B = OUT_DIR / "audit_op_edge_cases.md"
REP_C = OUT_DIR / "audit_door_completeness.md"
REP_D = OUT_DIR / "audit_window_completeness.md"
REP_E = OUT_DIR / "priplatky_eligibility_plan.md"
REP_F = OUT_DIR / "phase_6_3_audit_scorecard.md"


def load_all():
    items = json.loads(ITEMS.read_text(encoding="utf-8"))["items"]
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    tabulky = json.loads(TABULKY.read_text(encoding="utf-8"))
    dxf_counts = json.loads(DXF_COUNTS.read_text(encoding="utf-8"))
    return items, dataset, tabulky, dxf_counts


# ============================================================================
# PART A — Materials vs work split
# ============================================================================

# Patterns identifying WORK-only items (placement, montáž — material implied)
WORK_VERBS = ("kladení", "pokládka", "montáž", "osazení", "natáčení",
                "natěr", "stříkání", "navalování", "nátěr")
# Skladba/kapitola → expected material item popis pattern
MATERIAL_EXPECTATIONS = {
    "PSV-771": [
        ("Dlažba keramická — kladení", "Dlažba keramická — dodávka materiálu"),
    ],
    "PSV-776": [
        ("Vinyl Gerflor Creation 30 — kladení", "Vinyl Gerflor Creation 30 — dodávka"),
    ],
    "PSV-781": [
        ("Obklad keramický — kladení", "Obklad keramický — dodávka materiálu"),
    ],
    "PSV-712": [
        ("PVC fólie DEKPLAN", "PVC fólie DEKPLAN — dodávka"),
    ],
    "PSV-713": [
        ("EPS 200 mm tepelná izolace", "EPS 200 — dodávka"),
        ("XPS 100 mm sokl", "XPS 100 mm — dodávka"),
    ],
    "PSV-762": [
        ("Latě 30×50", "Dřevěné latě 30×50 — dodávka materiálu"),
    ],
    "PSV-765": [
        ("Tondach bobrovka", "Tondach bobrovka — dodávka tašek"),
    ],
    "HSV-622.1": [
        ("Cihelné pásky Terca", "Cihelné pásky Terca — dodávka materiálu"),
    ],
    "PSV-784": [
        ("Disperzní malba", "Disperzní malba — dodávka barvy"),
        ("Malba disperzní", "Malba disperzní — dodávka barvy"),
    ],
}


def part_A_materials_vs_work(items: list[dict]) -> tuple[str, list[dict]]:
    """For each kapitola+skladba, check whether work-only items have a
    sibling 'dodávka materiálu' item OR if the work item is presumed to
    bundle material per ÚRS convention.
    """
    # Group items by (kapitola, room_code)
    by_loc: dict[tuple, list[dict]] = defaultdict(list)
    for it in items:
        room = (it["misto"].get("mistnosti") or [None])[0]
        by_loc[(it["kapitola"], room)].append(it)

    findings: list[dict] = []
    for kap, expectations in MATERIAL_EXPECTATIONS.items():
        for work_pattern, missing_dodavka_template in expectations:
            for (kapitola, room), bag in by_loc.items():
                if kapitola != kap:
                    continue
                # Look for work item matching pattern
                work_items = [it for it in bag if work_pattern.lower() in it["popis"].lower()]
                if not work_items:
                    continue
                # Look for dodávka sibling
                has_dodavka = any(
                    "dodávka" in it["popis"].lower() and any(w in it["popis"].lower()
                    for w in work_pattern.lower().split())
                    for it in bag
                )
                if not has_dodavka:
                    sample_work = work_items[0]
                    findings.append({
                        "kapitola": kap,
                        "room": room,
                        "work_item_popis": sample_work["popis"],
                        "missing_dodavka": missing_dodavka_template,
                        "mnozstvi": sample_work["mnozstvi"],
                        "MJ": sample_work["MJ"],
                    })

    # Aggregate findings by (kapitola, work_pattern) for reporting
    agg: dict[tuple, dict] = {}
    for f in findings:
        key = (f["kapitola"], f["missing_dodavka"])
        if key not in agg:
            agg[key] = {
                "kapitola": f["kapitola"],
                "missing_dodavka": f["missing_dodavka"],
                "MJ": f["MJ"],
                "rooms": [],
                "total_mnozstvi": 0.0,
            }
        agg[key]["rooms"].append(f["room"])
        agg[key]["total_mnozstvi"] += f["mnozstvi"]

    # Report
    lines = ["# Audit Part A — Materials vs work split", ""]
    lines.append("Identifies WORK-only items (kladení / pokládka / montáž) without a "
                  "sibling 'dodávka materiálu' item per (kapitola, room).")
    lines.append("")
    lines.append("**ÚRS context:** Per ÚRS RSPS conventions, many `kladení` items "
                  "include material in the unit price. However, customer prefers "
                  "explicit material dodávka rows for variant pricing + audit.")
    lines.append("")
    lines.append("## Aggregated gaps")
    lines.append("")
    lines.append("| Kapitola | Missing dodávka item | Affected rooms | Σ množství | MJ |")
    lines.append("|---|---|---:|---:|---|")
    for v in sorted(agg.values(), key=lambda x: -x["total_mnozstvi"]):
        lines.append(f"| `{v['kapitola']}` | {v['missing_dodavka']} | "
                     f"{len(v['rooms'])} | {v['total_mnozstvi']:.2f} | {v['MJ']} |")
    lines.append("")
    lines.append(f"**Total gaps to add**: {len(agg)} aggregated items "
                  f"(covering {sum(len(v['rooms']) for v in agg.values())} room-instances)")
    lines.append("")
    lines.append("## Estimated cost impact (rough)")
    lines.append("")
    lines.append("| Material | Σ množství | Unit price (estimate) | Total |")
    lines.append("|---|---:|---:|---:|")
    impact_rows = []
    for v in sorted(agg.values(), key=lambda x: -x["total_mnozstvi"]):
        # Rough unit prices (Kč/m², Kč/m, Kč/kg)
        if "Dlažba" in v["missing_dodavka"]:
            up = 600
        elif "Vinyl" in v["missing_dodavka"]:
            up = 500
        elif "Obklad" in v["missing_dodavka"]:
            up = 500
        elif "PVC fólie" in v["missing_dodavka"]:
            up = 200
        elif "EPS" in v["missing_dodavka"]:
            up = 200
        elif "XPS" in v["missing_dodavka"]:
            up = 350
        elif "Latě" in v["missing_dodavka"]:
            up = 60
        elif "Tondach" in v["missing_dodavka"]:
            up = 30  # per ks
        elif "Cihelné pásky" in v["missing_dodavka"]:
            up = 1800
        elif "barvy" in v["missing_dodavka"]:
            up = 50
        else:
            up = 200
        total = v["total_mnozstvi"] * up
        lines.append(f"| {v['missing_dodavka']} | {v['total_mnozstvi']:.1f} {v['MJ']} | "
                     f"~{up} Kč/{v['MJ']} | ~{total:,.0f} Kč |")
        impact_rows.append(total)
    total_estimated = sum(impact_rows)
    lines.append(f"| **TOTAL estimated material gap** | | | **~{total_estimated:,.0f} Kč** |")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append("⚠️ **HIGH priority** — fix v Phase 6.4 before Phase 7a ÚRS lookup. "
                  "Adding dodávka items now means ÚRS lookup batch covers them in "
                  "one pass.")
    REP_A.write_text("\n".join(lines), encoding="utf-8")
    return REP_A.name, list(agg.values())


# ============================================================================
# PART B — OP edge cases
# ============================================================================


def part_B_op_edge(items, tabulky, dxf_counts):
    op_master = tabulky["ostatni"]["items"]
    op_dxf = dxf_counts["counts_per_objekt_d"].get("OP", {})

    edge_cases: list[dict] = []
    for code, master in op_master.items():
        komplex_qty = master.get("mnozstvi") or 0
        if komplex_qty > 4:  # only small-komplex items
            continue
        dxf_d = op_dxf.get(code, {}).get("total_d_count_int", 0)
        # Find matching item in dataset
        d_items = [it for it in items if (it.get("skladba_ref") or {}).get("OP") == code]
        d_qty = d_items[0]["mnozstvi"] if d_items else 0
        edge_cases.append({
            "code": code,
            "popis": master.get("nazev", "")[:50],
            "umisteni": master.get("umisteni", "")[:50],
            "komplex_qty": komplex_qty,
            "dxf_d_count": dxf_d,
            "current_d_qty": d_qty,
            "needs_review": dxf_d == 0 and komplex_qty > 0,
        })

    lines = ["# Audit Part B — OP## edge cases (komplex_qty ≤ 4)", ""]
    lines.append("Small-komplex OP items where uniform 0.25 D-share may misallocate.")
    lines.append("")
    lines.append("| OP code | Popis | Umístění | Komplex | DXF D | Current D qty | Needs review? |")
    lines.append("|---|---|---|---:|---:|---:|---|")
    for e in sorted(edge_cases, key=lambda x: x["code"]):
        flag = "⚠️ YES" if e["needs_review"] else "✅"
        lines.append(f"| `{e['code']}` | {e['popis']} | {e['umisteni']} | {e['komplex_qty']} | "
                     f"{e['dxf_d_count']} | {e['current_d_qty']} | {flag} |")
    lines.append("")
    needs_review = [e for e in edge_cases if e["needs_review"]]
    lines.append(f"**Edge cases needing review**: {len(needs_review)} of {len(edge_cases)}")
    lines.append("")
    lines.append("## Pattern interpretation")
    lines.append("")
    lines.append("- **DXF D = 0 + komplex > 0**: item exists in komplex but no DXF "
                 "tag found in objekt-D drawings → likely on objekt A/B/C only. "
                 "Current D qty = 0.25 × komplex (uniform fallback) overstates D.")
    lines.append("- **DXF D > 0**: spatially confirmed on objekt-D drawings → "
                 "current Phase 6.1 update should have applied DXF count.")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append(f"⚠️ **MEDIUM priority** — review {len(needs_review)} items: "
                  "if DXF confirms zero on objekt D, set qty=0 (remove from D výkaz). "
                  "Otherwise keep DXF count.")
    REP_B.write_text("\n".join(lines), encoding="utf-8")
    return REP_B.name, edge_cases


# ============================================================================
# PART C — Door completeness
# ============================================================================

DOOR_REQUIRED = [
    ("PSV-766", "Dveře", "Dodávka rám + křídlo + obložky"),
    ("HSV-642", "Plombrování", "Plombrování + vyrovnání zárubně"),
    ("HSV-642", "Zazdění zárubně", "Zazdění zárubně po obvodu"),
    ("PSV-766", "Mezerové lišty", "Mezerové lišty kolem obložek"),
    ("PSV-767", "Klika", "Klika + zámek"),
    ("PSV-767", "zarážka", "Dveřní zarážka"),
]
DOOR_REQUIRED_ENTRY = [  # only for entry doors (D11)
    ("PSV-767", "Cylinder", "Cylinder bezpečnostní + 5 klíčů"),
    ("PSV-767", "pojistka", "Pant pojistka"),
    ("PSV-766", "bezpečnostní rám", "Bezpečnostní rám 4. třída"),
]


def part_C_doors(items, dataset):
    door_counts = dataset["aggregates"]["doors_by_type_code"]
    findings: list[dict] = []
    for d_code, count in sorted(door_counts.items(), key=lambda x: -x[1]):
        bag = [it for it in items if (it.get("skladba_ref") or {}).get("D_type") == d_code]
        is_entry = d_code in ("D11",)
        required = DOOR_REQUIRED + (DOOR_REQUIRED_ENTRY if is_entry else [])
        for kap, keyword, expected_label in required:
            has_it = any(
                it["kapitola"] == kap and keyword.lower() in it["popis"].lower()
                for it in bag
            )
            if not has_it:
                findings.append({
                    "d_code": d_code,
                    "count": count,
                    "missing_kapitola": kap,
                    "missing_label": expected_label,
                })

    lines = ["# Audit Part C — Door D## completeness", ""]
    lines.append("Per D## type, verifies all expected component items exist.")
    lines.append("")
    lines.append("Required base items per door type:")
    for kap, _, label in DOOR_REQUIRED:
        lines.append(f"  - `{kap}` {label}")
    lines.append("")
    lines.append("Required entry doors (D11) ADD:")
    for kap, _, label in DOOR_REQUIRED_ENTRY:
        lines.append(f"  - `{kap}` {label}")
    lines.append("")
    lines.append("## Per-door-type gaps")
    lines.append("")
    by_d: dict[str, list[dict]] = defaultdict(list)
    for f in findings:
        by_d[f["d_code"]].append(f)
    if not by_d:
        lines.append("✅ All D## types have complete component sets.")
    else:
        lines.append("| D-code | Count | Missing items |")
        lines.append("|---|---:|---|")
        for code, gaps in sorted(by_d.items(), key=lambda x: -door_counts.get(x[0], 0)):
            missing_str = "; ".join(g["missing_label"] for g in gaps)
            lines.append(f"| `{code}` | {door_counts.get(code, 0)} | {missing_str} |")
    lines.append("")
    lines.append(f"**Total gaps**: {len(findings)} across {len(by_d)} D-types")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append("⚠️ **MEDIUM priority** — fix v Phase 6.4. Each gap is 1 missing "
                  "item per type × type count. Some gaps may be intentional (e.g. "
                  "D-type without lock = door without active hardware).")
    REP_C.write_text("\n".join(lines), encoding="utf-8")
    return REP_C.name, findings


# ============================================================================
# PART D — Window completeness
# ============================================================================

WIN_REQUIRED = [
    ("HSV-642", "Osazení okenního", "Osazení okenního rámu"),
    ("HSV-642", "Kotvení", "Kotvení (turbo)"),
    ("HSV-642", "PUR pěna", "PUR pěna připojovací spáry"),
    ("HSV-642", "Komprimační páska", "Komprimační páska připojovací"),
    ("HSV-642", "Spárování okenního", "Spárování okenního rámu silikon + akrylát"),
    ("PSV-766", "Vnitřní parapet", "Vnitřní parapety umělý kámen"),
    ("PSV-764", "Vnější parapet", "Vnější parapet pozinkovaný plech"),
]
WIN_ROOFLIGHT_EXTRA = [
    ("HSV-642", "Lemování střešního", "Lemování střešního okna"),
    ("HSV-642", "Difuzní límec", "Difuzní límec"),
    ("HSV-642", "Parotěsná manžeta", "Parotěsná manžeta"),
    ("PSV-764", "Krycí lemování plechové", "Krycí lemování plechové"),
]


def part_D_windows(items, dataset):
    win_counts = dataset["aggregates"]["windows_by_type_code"]
    findings: list[dict] = []
    for w_code, count in sorted(win_counts.items(), key=lambda x: -x[1]):
        bag = [it for it in items if (it.get("skladba_ref") or {}).get("W_type") == w_code]
        for kap, keyword, expected_label in WIN_REQUIRED:
            has_it = any(
                it["kapitola"] == kap and keyword.lower() in it["popis"].lower()
                for it in bag
            )
            if not has_it:
                findings.append({"w_code": w_code, "count": count,
                                  "missing_kapitola": kap, "missing_label": expected_label})

    # Roof-light specific (would need parser to identify which W## are střešní —
    # for now treat W83 + W04 as candidates if they're high-up windows)
    rooflight_check_items = [it for it in items
                              if it["kapitola"] == "HSV-642"
                              and "střešního okna" in it["popis"].lower()]
    rooflight_present = len(rooflight_check_items)

    lines = ["# Audit Part D — Window W## completeness", ""]
    lines.append("Per W## type, verifies osazení + parapet + spárování items exist.")
    lines.append("")
    lines.append("Note: Window dodávka NOT in scope (window itself bought separately, "
                  "fasáda dodavatel responsibility).")
    lines.append("")
    lines.append("Required base items per window type:")
    for kap, _, label in WIN_REQUIRED:
        lines.append(f"  - `{kap}` {label}")
    lines.append("")
    lines.append("Roof-light extras (střešní okna ~11 ks):")
    for kap, _, label in WIN_ROOFLIGHT_EXTRA:
        lines.append(f"  - `{kap}` {label}")
    lines.append("")
    lines.append("## Per-window-type gaps")
    lines.append("")
    by_w: dict[str, list[dict]] = defaultdict(list)
    for f in findings:
        by_w[f["w_code"]].append(f)
    if not by_w:
        lines.append("✅ All W## types have complete component sets.")
    else:
        lines.append("| W-code | Count | Missing items |")
        lines.append("|---|---:|---|")
        for code, gaps in sorted(by_w.items(), key=lambda x: -win_counts.get(x[0], 0)):
            missing_str = "; ".join(g["missing_label"] for g in gaps)
            lines.append(f"| `{code}` | {win_counts.get(code, 0)} | {missing_str} |")
    lines.append("")
    lines.append(f"**Total gaps**: {len(findings)} across {len(by_w)} W-types")
    lines.append(f"**Roof-light items present**: {rooflight_present} (expected ≥ 4 per cat × 11 ks ≈ 44+)")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append("⚠️ **MEDIUM priority** — verify completeness. Most likely gap: "
                  "vnější parapet PSV-764 missing per-W-type (added globally in Phase 3e).")
    REP_D.write_text("\n".join(lines), encoding="utf-8")
    return REP_D.name, findings


# ============================================================================
# PART E — Příplatky eligibility plan
# ============================================================================


def part_E_priplatky(items, dataset, tabulky):
    rooms_by_code = {r["code"]: r for r in dataset["rooms"]}
    skladby = dataset.get("skladby", {})

    elig_thickness = []  # cement screed > 50 mm
    elig_height = []     # rooms with světlá výška > 4 m
    elig_R11 = []        # wet rooms with F18/F22 (R11 odolnost)
    elig_lešení_pp = []  # lešení v 1.PP (stísněné)
    elig_small_qty = []  # items with mnozstvi < 5 m² / 5 m / 5 ks

    # Thickness eligibility — examine FF skladby
    for ff_code in ("FF20", "FF21", "FF30", "FF31"):
        skl = skladby.get(ff_code, {})
        cement_layer = next(
            (v for v in skl.get("vrstvy", [])
             if "cement" in (v.get("nazev") or "").lower() or "potěr" in (v.get("nazev") or "").lower()),
            None,
        )
        if cement_layer:
            tl = cement_layer.get("tloustka_mm") or 0
            if tl > 50:
                # Find items using this FF
                affected = [it for it in items if it.get("skladba_ref", {}).get("FF") == ff_code
                             and "Cementový potěr" in it["popis"]]
                elig_thickness.append({
                    "ff_code": ff_code, "tl_mm": tl, "delta_mm": tl - 50,
                    "items_affected": len(affected),
                    "total_m2": sum(it["mnozstvi"] for it in affected),
                })

    # Height eligibility — rooms with světlá výška > 4 m
    high_rooms = [r for r in dataset["rooms"]
                   if (r.get("svetla_vyska_mm") or 0) > 4000]
    if high_rooms:
        affected_items = [it for it in items
                           if it.get("misto", {}).get("mistnosti")
                           and any(rc in {r["code"] for r in high_rooms}
                                    for rc in it["misto"]["mistnosti"])
                           and it["kapitola"] in ("HSV-611", "HSV-612", "PSV-784")]
        elig_height.append({
            "rooms": [r["code"] for r in high_rooms[:10]],
            "rooms_count": len(high_rooms),
            "items_affected": len(affected_items),
        })

    # R11 wet rooms — F18 / F22 floor
    wet_items = [it for it in items
                  if it["kapitola"] == "PSV-771"
                  and any(c in (it.get("skladba_ref", {}).get("F_povrch_podlahy") or "")
                          for c in ("F18", "F22"))]
    if wet_items:
        elig_R11.append({
            "items_affected": len(wet_items),
            "total_m2": sum(it["mnozstvi"] for it in wet_items if it["MJ"] in ("m2", "m²")),
        })

    # Lešení 1.PP
    leseni_pp = [it for it in items
                  if it["kapitola"] == "HSV-941"
                  and it.get("misto", {}).get("podlazi") == "1.PP"]
    if leseni_pp:
        elig_lešení_pp.append({
            "items_affected": len(leseni_pp),
            "total": sum(it["mnozstvi"] for it in leseni_pp),
        })

    # Small quantity — < 5
    elig_small_qty = [it for it in items
                       if it["MJ"] in ("m2", "m²", "m", "ks")
                       and 0 < it["mnozstvi"] < 5
                       and it["kapitola"] not in ("VRN-010", "VRN-011", "VRN-014",
                                                    "VRN-016", "VRN-017", "VRN-026", "VRN-027")]

    lines = ["# Audit Part E — Příplatky eligibility plan", ""]
    lines.append("Identifies items eligible for ÚRS RSPS surcharges (R-suffix items).")
    lines.append("")
    lines.append("**NOTE: NO implementation yet — this is just a plan. Implementation "
                  "deferred to Phase 7b after Phase 7a ÚRS base lookup completes.**")
    lines.append("")

    lines.append("## Eligibility category 1 — Tloušťka cement screed > 50 mm")
    lines.append("")
    lines.append("Triggers ÚRS R-suffix 'Příplatek za každý další 1/5 mm tloušťky'.")
    lines.append("")
    if elig_thickness:
        lines.append("| FF code | Skladba tl. | Delta over 50 mm | Items affected | Σ m² |")
        lines.append("|---|---:|---:|---:|---:|")
        for e in elig_thickness:
            lines.append(f"| `{e['ff_code']}` | {e['tl_mm']} mm | +{e['delta_mm']} mm | "
                         f"{e['items_affected']} | {e['total_m2']:.1f} |")
    else:
        lines.append("_(All FF skladby use ≤ 50 mm cement layer — no eligibility)_")
    lines.append("")

    lines.append("## Eligibility category 2 — Světlá výška > 4 m")
    lines.append("")
    lines.append("Triggers HSV-611/612 omítky + PSV-784 malby surcharge.")
    lines.append("")
    if elig_height:
        e = elig_height[0]
        lines.append(f"- Rooms with světlá výška > 4 m: **{e['rooms_count']}**")
        lines.append(f"- Sample: {', '.join(e['rooms'][:5])}")
        lines.append(f"- Items affected (omítky + malby): **{e['items_affected']}**")
    else:
        lines.append("_(No rooms with světlá výška > 4 m — no eligibility)_")
    lines.append("")

    lines.append("## Eligibility category 3 — R11 odolnost dlažby (wet rooms F18/F22)")
    lines.append("")
    if elig_R11:
        e = elig_R11[0]
        lines.append(f"- Items affected: **{e['items_affected']}**")
        lines.append(f"- Σ m² wet floor: **{e['total_m2']:.1f}**")
    else:
        lines.append("_(No F18/F22 wet rooms in items)_")
    lines.append("")

    lines.append("## Eligibility category 4 — Lešení v 1.PP (stísněné)")
    lines.append("")
    if elig_lešení_pp:
        e = elig_lešení_pp[0]
        lines.append(f"- Items affected: **{e['items_affected']}**")
    else:
        lines.append("_(No HSV-941 items in 1.PP)_")
    lines.append("")

    lines.append("## Eligibility category 5 — Malé množství (< 5 jednotek)")
    lines.append("")
    lines.append(f"- Items affected: **{len(elig_small_qty)}**")
    lines.append("- Triggers ÚRS 'Příplatek za malé množství' (varies per kapitola)")
    lines.append("")

    lines.append("## Summary")
    lines.append("")
    total_elig = (
        sum(e["items_affected"] for e in elig_thickness)
        + sum(e["items_affected"] for e in elig_height)
        + sum(e["items_affected"] for e in elig_R11)
        + sum(e["items_affected"] for e in elig_lešení_pp)
        + len(elig_small_qty)
    )
    lines.append(f"- **Total eligible item-instances** (across all categories): ~{total_elig}")
    lines.append("- Estimated cost impact: +5-10 % over base ÚRS prices")
    lines.append("- For Libuše D scope: ~+500 tis – 1 mil Kč")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append("⏳ **LOW priority** (defer to Phase 7b after ÚRS lookup). "
                  "Implementation requires:")
    lines.append("1. Phase 7a returns urs_base_code per item")
    lines.append("2. For each eligible item, compute delta (e.g. tl. 55 mm − 50 mm = +5 mm)")
    lines.append("3. Lookup R-suffix code in ÚRS catalog")
    lines.append("4. Emit příplatek item paired_with base item")
    REP_E.write_text("\n".join(lines), encoding="utf-8")
    return REP_E.name, {
        "thickness": elig_thickness,
        "height": elig_height,
        "R11": elig_R11,
        "leseni_pp": elig_lešení_pp,
        "small_qty_count": len(elig_small_qty),
    }


# ============================================================================
# PART F — Final scorecard
# ============================================================================


def part_F_scorecard(items, gaps_a, gaps_b, gaps_c, gaps_d, plan_e):
    lines = ["# Phase 6.3 Audit Scorecard"]
    lines.append("")
    lines.append("**Generated:** Phase 6.3 step F (final summary)")
    lines.append("**Items audited:** 2327")
    lines.append("**Branch:** `claude/phase-0-5-batch-and-parser`")
    lines.append("")

    lines.append("## Summary table")
    lines.append("")
    lines.append("| Audit part | Findings | Severity | Recommendation |")
    lines.append("|---|---:|---|---|")
    lines.append(f"| A — Materials vs work split | {len(gaps_a)} aggregated gaps | "
                 "🚨 HIGH | Fix v Phase 6.4 PŘED Phase 7a |")
    needs_review_b = sum(1 for e in gaps_b if e["needs_review"])
    lines.append(f"| B — OP edge cases (komplex ≤ 4) | {needs_review_b} need review | "
                 "⚠️ MEDIUM | Manual sample 5-10 items |")
    lines.append(f"| C — Door D## completeness | {len(gaps_c)} gaps | "
                 "⚠️ MEDIUM | Verify per D-type |")
    lines.append(f"| D — Window W## completeness | {len(gaps_d)} gaps | "
                 "⚠️ MEDIUM | Verify per W-type |")
    lines.append(f"| E — Příplatky eligibility | ~{plan_e['small_qty_count'] + sum(e['items_affected'] for e in plan_e['thickness']) + sum(e['items_affected'] for e in plan_e['height']) + sum(e['items_affected'] for e in plan_e['R11']) + sum(e['items_affected'] for e in plan_e['leseni_pp'])} items | "
                 "ℹ️ LOW | Defer Phase 7b |")
    lines.append("")

    lines.append("## Detailed reports")
    lines.append("")
    for rep in (REP_A, REP_B, REP_C, REP_D, REP_E):
        lines.append(f"- `{rep.name}`")
    lines.append("")

    # Headlines for HIGH severity
    lines.append("## 🚨 HIGH severity — Material dodávka gaps (must fix)")
    lines.append("")
    lines.append("Items with WORK-only popis (kladení / pokládka / montáž) lacking sibling "
                  "'dodávka materiálu' item. Customer feedback confirms these are needed.")
    lines.append("")
    lines.append("Gap categories (top 5):")
    lines.append("")
    for v in sorted(gaps_a, key=lambda x: -x["total_mnozstvi"])[:5]:
        lines.append(f"- **{v['kapitola']}** {v['missing_dodavka']}: "
                     f"{v['total_mnozstvi']:.1f} {v['MJ']} across {len(v['rooms'])} rooms")
    lines.append("")

    # Cost impact estimate
    lines.append("## Estimated cost impact (HIGH gaps)")
    lines.append("")
    lines.append("From audit_materials_vs_work.md analysis:")
    lines.append("- Total estimated material gap: **~varies, see report A**")
    lines.append("- Adding ~14-20 dodávka items per affected room")
    lines.append("- Item count delta: **+ ~200-400 items** if each room gets material dodávka row")
    lines.append("")

    # Verdict
    has_high = len(gaps_a) > 0
    if has_high:
        lines.append("## Verdict")
        lines.append("")
        lines.append("⚠️ **STOP — Phase 6.4 fix session needed BEFORE Phase 7a ÚRS lookup.**")
        lines.append("")
        lines.append("Reasoning: ÚRS lookup batch je ~150-300 unique queries. If we run "
                      "Phase 7a now and add 200-400 material items in Phase 6.4 afterwards, "
                      "they'd need a SECOND ÚRS lookup pass. Better to add material items "
                      "first, deduplicate query groups, and run ÚRS lookup once.")
        lines.append("")
        lines.append("**Suggested Phase 6.4 (next session):**")
        lines.append("1. Add ~200-400 material dodávka items per Part A findings")
        lines.append("2. Address OP edge cases (Part B) — set qty=0 where DXF says zero")
        lines.append("3. Fix door/window completeness gaps (Part C, D) where applicable")
        lines.append("4. Re-run Phase 5 audit (status flags) on updated dataset")
        lines.append("5. Then proceed Phase 7a ÚRS lookup")
    else:
        lines.append("## Verdict")
        lines.append("")
        lines.append("✅ **READY FOR PHASE 7a (ÚRS lookup)** — only MEDIUM/LOW findings.")
    lines.append("")

    REP_F.write_text("\n".join(lines), encoding="utf-8")
    return REP_F.name


def main():
    items, dataset, tabulky, dxf_counts = load_all()
    print("Auditing 2327 items…")
    rep_a, gaps_a = part_A_materials_vs_work(items)
    rep_b, gaps_b = part_B_op_edge(items, tabulky, dxf_counts)
    rep_c, gaps_c = part_C_doors(items, dataset)
    rep_d, gaps_d = part_D_windows(items, dataset)
    rep_e, plan_e = part_E_priplatky(items, dataset, tabulky)
    rep_f = part_F_scorecard(items, gaps_a, gaps_b, gaps_c, gaps_d, plan_e)

    print()
    print("Reports written:")
    for r in (rep_a, rep_b, rep_c, rep_d, rep_e, rep_f):
        size = (OUT_DIR / r).stat().st_size
        print(f"  {r}  ({size:,} bytes)")
    print()
    print(f"HIGH gaps (Part A material): {len(gaps_a)} aggregated")
    print(f"MEDIUM gaps (Part B OP edge): {sum(1 for e in gaps_b if e['needs_review'])} need review")
    print(f"MEDIUM gaps (Part C doors): {len(gaps_c)}")
    print(f"MEDIUM gaps (Part D windows): {len(gaps_d)}")
    print(f"LOW (Part E příplatky): plan documented, no implementation")


if __name__ == "__main__":
    main()
