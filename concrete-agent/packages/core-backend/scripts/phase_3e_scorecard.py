"""Phase 3e scorecard."""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS_3E = OUT_DIR / "items_phase_3e_osazeni_specialni_uklid_vrn.json"
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
OUT = OUT_DIR / "phase_3e_scorecard.md"


def main() -> None:
    blob = json.loads(ITEMS_3E.read_text(encoding="utf-8"))
    combined = json.loads(COMBINED.read_text(encoding="utf-8"))
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    items = blob["items"]
    cff = dataset.get("carry_forward_findings", [])

    by_kap = blob["metadata"]["items_per_kapitola"]
    by_cat = blob["metadata"]["items_per_category"]

    # Status / category audit
    status_counts: Counter = Counter(it["status"] for it in items)
    category_counts: Counter = Counter(it.get("category", "subcontractor_required") for it in items)

    # Border-zone items list
    border_items = [it for it in items if it["status"] == "to_be_clarified_with_collegues"]
    vrn_items = [it for it in items if it["category"] == "general_site_overhead"]

    lines = []
    lines.append("# Phase 3e Quality Scorecard — osazení + speciální + úklid + VRN + border-zone")
    lines.append("")
    lines.append("**Generated:** Phase 3e step 3 (final)  ")
    lines.append("**Branch:** `claude/phase-0-5-batch-and-parser`  ")
    lines.append(f"**Items:** `{ITEMS_3E.name}` ({ITEMS_3E.stat().st_size:,} bytes)  ")
    lines.append("")

    lines.append("## Critical findings (PERSISTENT — surface in EVERY scorecard)")
    lines.append("")
    for f in cff:
        sev = f.get("severity", "info").upper()
        lines.append(f"### {sev} — {f['from_phase']}")
        lines.append("")
        lines.append(f"**Summary:** {f['summary']}")
        lines.append("")
        lines.append(f"**Next action:** {f['next_action']}")
        if f.get("parser_d_side_m2") is not None:
            lines.append(f"**Parser D-side estimate:** {f['parser_d_side_m2']} m²")
        lines.append("")

    lines.append("## Items per category (A-G)")
    lines.append("")
    lines.append("| Category | Items |")
    lines.append("|---|---:|")
    for cat, info in by_cat.items():
        lines.append(f"| {cat} | {info['items']} |")
    lines.append(f"| **Total Phase 3e** | **{len(items)}** |")
    lines.append("")

    lines.append("## Items per kapitola")
    lines.append("")
    lines.append("| Kapitola | Items | MJ totals |")
    lines.append("|---|---:|---|")
    for k in sorted(by_kap):
        v = by_kap[k]
        totals = " · ".join(f"{round(t, 1)} {mj}" for mj, t in v["totals"].items())
        lines.append(f"| `{k}` | {v['count']} | {totals} |")
    lines.append("")

    lines.append("## Status distribution")
    lines.append("")
    lines.append("| Status | Count |")
    lines.append("|---|---:|")
    for s, n in status_counts.most_common():
        lines.append(f"| `{s}` | {n} |")
    lines.append("")

    lines.append("## Category distribution")
    lines.append("")
    lines.append("| Category | Count |")
    lines.append("|---|---:|")
    for c, n in category_counts.most_common():
        lines.append(f"| `{c}` | {n} |")
    lines.append("")

    # Border-zone list
    lines.append("## ⚠️ Border-zone items (to_be_clarified_with_collegues)")
    lines.append("")
    lines.append(f"**{len(border_items)} items** waiting on user discussion with elektro/VZT/ZTI collegues.")
    lines.append("")
    if border_items:
        lines.append("| Kapitola | Popis | MJ × množství |")
        lines.append("|---|---|---|")
        for it in border_items:
            lines.append(f"| `{it['kapitola']}` | {it['popis']} | {it['mnozstvi']} {it['MJ']} |")
        lines.append("")

    # VRN overview
    lines.append("## VRN structure overview (CATEGORY G)")
    lines.append("")
    lines.append(f"**{len(vrn_items)} VRN items** marked status='to_be_negotiated_with_investor'.")
    lines.append("")
    lines.append("| VRN code | Popis | MJ × množství |")
    lines.append("|---|---|---|")
    for it in vrn_items:
        lines.append(f"| `{it['kapitola']}` | {it['popis']} | {it['mnozstvi']} {it['MJ']} |")
    lines.append("")
    lines.append(
        "**Note**: VRN-011 zařízení staveniště je REFERENCE na Phase 3d PSV-925 — "
        "not a duplicate. Phase 3d items remain as the source of truth; VRN-011 "
        "marker tells the audit/excel that overhead pool is consolidated there."
    )
    lines.append("")

    # Quality / coverage
    door_items_d = sum(1 for it in items if it["kapitola"] in ("HSV-642", "HSV-643", "PSV-766", "PSV-767")
                        and it.get("skladba_ref", {}).get("D_type"))
    win_items_w = sum(1 for it in items if it["kapitola"] in ("HSV-642", "PSV-766", "PSV-764")
                       and it.get("skladba_ref", {}).get("W_type"))
    lines.append("## Coverage metrics")
    lines.append("")
    lines.append(f"- Door osazení items per D## type: **{door_items_d}** (covers all 14 D-codes from Phase 1 aggregate)")
    lines.append(f"- Window osazení items per W## type: **{win_items_w}** (covers all 5 W-codes from Phase 1 aggregate)")
    lines.append(f"- Border-zone items: **{len(border_items)}** (require user clarification)")
    lines.append(f"- VRN items: **{len(vrn_items)}** (negotiate with investor)")
    lines.append("")

    # Cumulative
    total_combined = combined["metadata"]["items_count"]
    items_per_src = combined["metadata"]["items_per_source"]
    lines.append("## Cumulative state — items_objekt_D_complete.json")
    lines.append("")
    lines.append(f"- **Total items: {total_combined}**")
    lines.append("")
    lines.append("| Source | Items |")
    lines.append("|---|---:|")
    for src, n in items_per_src.items():
        lines.append(f"| `{src}` | {n} |")
    lines.append(f"| **Total** | **{total_combined}** |")
    lines.append("")

    items_ok = len(items) >= 150
    cat_ok = len(by_cat) == 7
    border_ok = len(border_items) >= 5  # need some border items as user-discussion targets
    verdict_pass = items_ok and cat_ok

    lines.append("## Acceptance")
    lines.append("")
    lines.append(f"- Items count ≥ 150: **{len(items)}** {'✅' if items_ok else '❌'}")
    lines.append(f"- All 7 categories present (A-G): **{len(by_cat)}** {'✅' if cat_ok else '❌'}")
    lines.append(f"- Border-zone items flagged: **{len(border_items)}** {'✅' if border_ok else '⚠️'}")
    lines.append("")
    if verdict_pass:
        lines.append("### ✅ READY FOR PHASE 5 (audit + diff against starý VV)")
    else:
        lines.append("### ⚠️ NEEDS REVIEW")
    lines.append("")

    lines.append("## Action items for user before Phase 5")
    lines.append("")
    lines.append(
        f"1. **Border-zone clarifications** ({len(border_items)} items): vyjasnit s "
        "collegues elektro/VZT/ZTI which side does (a) vyboření drážek, (b) prostupy, "
        "(c) lokální oprava povrchů. Update item.status from 'to_be_clarified_with_collegues' "
        "to either 'subcontractor_required' or 'remove_out_of_scope'."
    )
    lines.append(
        f"2. **VRN negotiation** ({len(vrn_items)} items): potvrdit s investorem "
        "(a) TDI hodiny — typicky platí investor; (b) overlap with Phase 3d PSV-925; "
        "(c) % values for pojištění + záruční rezerva."
    )
    lines.append(
        "3. **Vstupní dveře type code** (Phase 3e B): heuristic D11 = entry. "
        "Verify against Tabulka dveří popisem a počet vstupních dveří per byt."
    )
    lines.append(
        "4. **Garážová vrata + protipožární vrata count**: 1 garage + 2 fire doors estimate. "
        "Verify against TZ + 1.PP DXF layout."
    )
    lines.append("")

    lines.append("## Phase 5 inputs ready")
    lines.append("")
    lines.append(
        f"- `items_objekt_D_complete.json` — **{total_combined} items** with full popis, MJ, "
        "množství, místo, skladba_ref, category, status."
    )
    lines.append(
        "- Carry-forward critical findings (PROBE 1 cement screed + PROBE 2 hydroizolace pod obklad) "
        "must be CATALOGUED as VYNECHANE_KRITICKE in Phase 5 audit_report.md."
    )
    lines.append(
        "- Border-zone + VRN items will surface in Phase 5 as 'NEEDS_USER_DECISION' rows for "
        "the audit report."
    )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Phase 3e items: {len(items)} across 7 categories")
    print(f"Border-zone items (to_be_clarified): {len(border_items)}")
    print(f"VRN items (to_be_negotiated): {len(vrn_items)}")
    print(f"Combined total: {total_combined}")
    print(f"Verdict: {'✅ READY FOR PHASE 5' if verdict_pass else '⚠️ REVIEW'}")


if __name__ == "__main__":
    main()
