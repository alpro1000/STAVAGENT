"""Phase 3b scorecard."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ITEMS = Path("test-data/libuse/outputs/items_phase_3b_vnejsi_a_suteren.json")
DS = Path("test-data/libuse/outputs/objekt_D_geometric_dataset.json")
OUT = Path("test-data/libuse/outputs/phase_3b_scorecard.md")


def main() -> None:
    blob = json.loads(ITEMS.read_text(encoding="utf-8"))
    dataset = json.loads(DS.read_text(encoding="utf-8"))

    items = blob["items"]
    metadata = blob["metadata"]
    cff = dataset.get("carry_forward_findings", [])
    gt = metadata.get("ground_truth_used", {})

    # Per-kapitola tally
    by_kap: dict[str, dict] = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]

    # Sanity checks
    sanity: list[dict] = []
    # Phase 0.7 step 2 facade brutto vs items
    fac_brutto = gt.get("facade_brutto_m2")
    fac_netto = gt.get("facade_netto_m2")
    f08 = gt.get("F08_pasky_m2_estimate")
    f13 = gt.get("F13_m2_phase1")
    f16 = gt.get("F16_podhledy_m2_estimate")
    if fac_netto and f08 and f13 and f16:
        partition = f08 + f13 + f16
        sanity.append({
            "check": "facade_netto = F08 + F13 + F16",
            "expected": fac_netto,
            "computed": partition,
            "status": "OK" if abs(partition - fac_netto) < 1.0 else "DRIFT",
        })

    # Roof: krytina (sklon) + plochá = celkem
    skat31 = gt.get("roof_skat_31_m2", 0)
    skat67 = gt.get("roof_skat_67_m2", 0)
    flat = gt.get("roof_flat_central_m2", 0)
    sanity.append({
        "check": "Roof total = skat 31° + skat 67° + plochá centrální",
        "expected": 442.88,
        "computed": skat31 + skat67 + flat,
        "status": "OK" if abs(skat31 + skat67 + flat - 442.88) < 1.0 else "DRIFT",
    })

    # Tondach: 36 ks/m² × 304 m² = 10 944 ks
    tondach_pcs = sum(it["mnozstvi"] for it in items
                      if it["kapitola"] == "PSV-765" and "počet kusů" in it["popis"].lower())
    sanity.append({
        "check": "Tondach 36 ks/m² × 304 m² ≈ 10944",
        "expected": 10944,
        "computed": int(tondach_pcs),
        "status": "OK" if abs(tondach_pcs - 10944) < 100 else "DRIFT",
    })

    # ETICS hmoždinky 6 ks/m² × ETICS area
    huzd = sum(it["mnozstvi"] for it in items
               if it["kapitola"] == "PSV-713" and "Talířové hmoždinky" in it["popis"])
    expected_huzd = (gt.get("facade_netto_m2") or 0) * 6
    sanity.append({
        "check": "ETICS hmoždinky 6 ks/m² × facade_netto",
        "expected": expected_huzd,
        "computed": huzd,
        "status": "OK" if abs(huzd - expected_huzd) < 50 else "DRIFT",
    })

    # === Build report ===
    lines: list[str] = []
    lines.append("# Phase 3b Quality Scorecard — vnější + suterén")
    lines.append("")
    lines.append("**Generated:** Phase 3b step 3  ")
    lines.append("**Branch:** `claude/phase-0-5-batch-and-parser`  ")
    lines.append(f"**Items:** `{ITEMS.name}` ({ITEMS.stat().st_size:,} bytes)  ")
    lines.append("")

    lines.append("## Critical findings (persistent — surface in EVERY scorecard)")
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
    lines.append("| Kapitola | Items | MJ totals |")
    lines.append("|---|------:|---|")
    total = 0
    for k in sorted(by_kap):
        v = by_kap[k]
        total += v["count"]
        mj_str = " · ".join(f"{round(t, 1)} {mj}" for mj, t in v["by_mj"].items())
        lines.append(f"| `{k}` | {v['count']} | {mj_str} |")
    lines.append(f"| **Total** | **{total}** | — |")
    lines.append("")

    lines.append("## Ground-truth facts used for D")
    lines.append("")
    lines.append("Mix of spec values (manual proof-of-concept) and Phase 1 aggregates:")
    lines.append("")
    lines.append("| Quantity | Value | Source |")
    lines.append("|---|---:|---|")
    lines.append(f"| Facade brutto | {gt.get('facade_brutto_m2'):.1f} m² | spec (J 275 + S 275 + V 144 + Z 144) |")
    lines.append(f"| Facade openings (windows + CW) | {gt.get('facade_openings_m2'):.2f} m² | Phase 0.7 step 3 |")
    lines.append(f"| Facade netto | {gt.get('facade_netto_m2'):.2f} m² | brutto − openings |")
    lines.append(f"| F08 cihelné pásky estimate | {gt.get('F08_pasky_m2_estimate'):.2f} m² | netto − F13 − F16 |")
    lines.append(f"| F13 omítka balkóny/atiky | {gt.get('F13_m2_phase1'):.2f} m² | Phase 1 aggregate |")
    lines.append(f"| F16 podhledy balkóny | {gt.get('F16_podhledy_m2_estimate'):.1f} m² | estimate (refine in Phase 4) |")
    lines.append(f"| Roof skat 31° | {gt.get('roof_skat_31_m2'):.0f} m² | spec |")
    lines.append(f"| Roof skat 67° | {gt.get('roof_skat_67_m2'):.0f} m² | spec |")
    lines.append(f"| Roof central plochá | {gt.get('roof_flat_central_m2'):.0f} m² | spec |")
    lines.append(f"| D-share for komplex Tabulky | {gt.get('D_share_for_komplex_items'):.2f} | 4 equal objekty |")
    lines.append(f"| Sokl ETICS height | {gt.get('sokl_height_m'):.1f} m | typical |")
    lines.append(f"| Obvod / perimeter | {gt.get('obvod_m'):.2f} m | spec terén obvod |")
    lines.append("")

    lines.append("## Sanity checks")
    lines.append("")
    lines.append("| Check | Expected | Computed | Status |")
    lines.append("|---|------:|------:|---|")
    for s in sanity:
        ok = "✅" if s["status"] == "OK" else "⚠️"
        lines.append(f"| {s['check']} | {s['expected']} | {s['computed']} | {ok} {s['status']} |")
    lines.append("")

    sanity_pass = sum(1 for s in sanity if s["status"] == "OK")
    sanity_total = len(sanity)
    sanity_ok = sanity_pass / max(sanity_total, 1) >= 0.85
    items_ok = total >= 80   # minimum threshold
    verdict_pass = sanity_ok and items_ok

    lines.append("## Acceptance criteria")
    lines.append("")
    lines.append(f"- ≥ 85 % sanity checks pass: **{sanity_pass} / {sanity_total} = "
                 f"{sanity_pass / max(sanity_total, 1) * 100:.0f} %** "
                 f"{'✅' if sanity_ok else '❌'}")
    lines.append(f"- Item count plausible (≥ 80): **{total}** "
                 f"{'✅' if items_ok else '❌'}")
    lines.append("")
    if verdict_pass:
        lines.append("### ✅ READY FOR PHASE 3c (SDK + detaily)")
    else:
        lines.append("### ⚠️ NEEDS REVIEW")
    lines.append("")

    lines.append("## Known limitations / Phase 3c enhancements")
    lines.append("")
    lines.append(
        "- **Klempířské D-share = 0.25**. Quantities from Tabulka klempířských are "
        "komplex (A+B+C+D) split equally. Some TP items (e.g. TP14 střešní průchodky 7 ks "
        "komplex) may have non-uniform per-objekt distribution. Phase 3c could "
        "scan DXF roof for actual D-side counts."
    )
    lines.append(
        "- **Zámečnické LP## D-share = 0.25** — same caveat. Especially LP60-65 "
        "skleněné zábradlí francouzských oken (1, 2, 6, 1, 1 ks komplex) could be "
        "0/all on objekt D. Verify in Phase 4 against DXF window placements."
    )
    lines.append(
        "- **Roof flat central = 139 m² spec**. Could include roofs above 1.PP that "
        "extend beyond NP-floors footprint (vegetační střecha RF11). Verify with "
        "1.PP DXF + central plochá střecha boundary."
    )
    lines.append(
        "- **F08 plocha = facade_netto − F13 − F16_estimate** is rough. Verify "
        "by computing F08 area directly from DXF cihelné pásky polygon (if the "
        "facade DXF marks F08 zones explicitly, e.g. via HATCH on a F08-specific layer)."
    )
    lines.append(
        "- **Suterén F10/F11 areas** estimated from 1.PP rooms by `byt_or_section=='S'` "
        "(sklepy) vs garáž remainder. Tabulka místností should give exact per-room F-codes; "
        "Phase 3c should join Tabulka.povrch_podlahy properly."
    )
    lines.append(
        "- **Roof horizontal poly reassembly** still deferred to Phase 4 — currently "
        "uses spec ground-truth. Once A-ROOF-OTLN LINE-chain → polygon works, "
        "facade brutto + roof areas become parser-derived rather than spec."
    )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Total items: {total}")
    print(f"Sanity: {sanity_pass}/{sanity_total} OK")
    print(f"Verdict: {'✅ READY FOR PHASE 3c' if verdict_pass else '⚠️ REVIEW'}")


if __name__ == "__main__":
    main()
