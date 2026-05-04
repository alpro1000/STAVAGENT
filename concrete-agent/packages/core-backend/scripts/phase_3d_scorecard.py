"""Phase 3d scorecard."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
ITEMS_3D = OUT_DIR / "items_phase_3d_leseni_pomocne.json"
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
OUT = OUT_DIR / "phase_3d_scorecard.md"


def main() -> None:
    blob = json.loads(ITEMS_3D.read_text(encoding="utf-8"))
    combined = json.loads(COMBINED.read_text(encoding="utf-8"))
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    items = blob["items"]
    md = blob["metadata"]
    cff = dataset.get("carry_forward_findings", [])

    by_kap = md["summary_per_kapitola"]
    sub_required = sum(1 for it in items if it.get("category") == "subcontractor_required")
    overhead = sum(1 for it in items if it.get("category") == "general_site_overhead")

    lines = []
    lines.append("# Phase 3d Quality Scorecard — lešení + pomocné práce + zařízení staveniště")
    lines.append("")
    lines.append("**Generated:** Phase 3d step 3 (final)  ")
    lines.append("**Branch:** `claude/phase-0-5-batch-and-parser`  ")
    lines.append(f"**Items:** `{ITEMS_3D.name}` ({ITEMS_3D.stat().st_size:,} bytes)  ")
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

    lines.append("## Items per kapitola")
    lines.append("")
    lines.append("| Kapitola | Items | MJ totals | Category split |")
    lines.append("|----------|------:|---|---|")
    for k in sorted(by_kap):
        v = by_kap[k]
        totals = " · ".join(f"{round(t, 1)} {mj}" for mj, t in v["totals"].items())
        cat = " · ".join(f"{c}={n}" for c, n in v["category_split"].items())
        lines.append(f"| `{k}` | {v['count']} | {totals} | {cat} |")
    lines.append(f"| **Total Phase 3d** | **{len(items)}** | — | "
                 f"sub_required={sub_required} · overhead={overhead} |")
    lines.append("")

    lines.append("## Category distinction")
    lines.append("")
    lines.append(f"- **Subcontractor required** (firmly in scope of dokončovacích prací subdodavatele): "
                 f"**{sub_required}** items")
    lines.append("  - HSV-941 lešení (fasádní + vnitřní)")
    lines.append("  - HSV-944 pomocné konstrukce (žebříky, zábrany, sítě, krytí)")
    lines.append("  - HSV-997 přesun hmot")
    lines.append("  - HSV-998 pomocné práce (drážky, broušení, ochrana)")
    lines.append("")
    lines.append(f"- **General site overhead** (typicky s hlavním dodavatelem — k dořešení): "
                 f"**{overhead}** items")
    lines.append("  - PSV-925 zařízení staveniště (WC + sklad + el/voda + oplocení + tabule)")
    lines.append("  - All carry warning: 'k dořešení s hlavním dodavatelem'")
    lines.append("")

    lines.append("## Ground-truth used")
    lines.append("")
    gt = md["ground_truth_used"]
    lines.append("| Quantity | Value |")
    lines.append("|---|---:|")
    for k, v in gt.items():
        lines.append(f"| {k} | {v} |")
    lines.append(f"| Harmonogram (rental duration) | {md['harmonogram_mesice']} měsíce |")
    lines.append("")

    lines.append("## Notable totals")
    lines.append("")
    presun_t = next((i["mnozstvi"] for i in items if "Přesun hmot ručně" in i["popis"]), 0)
    leseni_total = sum(i["mnozstvi"] for i in items
                        if i["kapitola"] == "HSV-941" and i["MJ"] == "m2")
    lines.append(f"- Σ přesun hmot ručně: **{presun_t:.1f} t** pro objekt D")
    lines.append(f"- Σ lешеní (postavění + pronájem) m²: **{leseni_total:.1f}** m²-měs (incl. 4 měs pronájmu)")
    lines.append("")

    # Cumulative totals across all phases
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

    items_ok = len(items) >= 20
    cat_ok = sub_required > 0 and overhead > 0
    verdict_pass = items_ok and cat_ok

    lines.append("## Acceptance")
    lines.append("")
    lines.append(f"- Items count ≥ 20: **{len(items)}** {'✅' if items_ok else '❌'}")
    lines.append(f"- Category split present (both subcontractor_required + overhead): "
                 f"**{cat_ok}** {'✅' if cat_ok else '❌'}")
    lines.append("")
    if verdict_pass:
        lines.append("### ✅ READY FOR PHASE 5 (audit + diff against starý VV)")
    else:
        lines.append("### ⚠️ NEEDS REVIEW")

    lines.append("")
    lines.append("## Phase 5 inputs ready")
    lines.append("")
    lines.append(
        f"- `items_objekt_D_complete.json` — **{total_combined} items** with full popis, "
        "MJ, množství, místo, skladba_ref, category (where applicable), "
        "and `urs_code: null` placeholder (Phase 4 hybrid lookup deferred)."
    )
    lines.append(
        "- Carry-forward critical findings (PROBE 1 cement screed + PROBE 2 hydroizolace) "
        "will be CATALOGUED as VYNECHANE_KRITICKE in Phase 5 audit_report.md."
    )
    lines.append("")
    lines.append("## Phase 4 plan recap (hybrid)")
    lines.append("")
    lines.append("Per user decision (this session):")
    lines.append("- Day 4: KROS manual extraction top 30 kapitol (uživatel)")
    lines.append("- Day 5: Perplexity batch pro zbytek")
    lines.append("- Day 6: Manual review low-confidence items")
    lines.append(
        "- Phase 6 Excel draft will produce výkaz BEZ ÚRS sloupce (placeholder column "
        "ready for fill-in once Phase 4 hybrid lookup completes)."
    )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Phase 3d items: {len(items)} ({sub_required} sub_required, {overhead} overhead)")
    print(f"Combined total: {total_combined}")
    print(f"Verdict: {'✅ READY FOR PHASE 5' if verdict_pass else '⚠️ REVIEW'}")


if __name__ == "__main__":
    main()
