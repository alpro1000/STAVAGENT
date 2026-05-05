"""Phase 5 step 3 — apply diff statuses to all 2277 items + identify
new findings.

Status taxonomy (per spec):
  SHODA_SE_STARYM       — score >= HIGH + objem v ±5 % (vs old × D_share)
  OPRAVENO_OBJEM        — score >= HIGH + objem rozdíl > 5 %
  OPRAVENO_POPIS        — score MED-HIGH + objem v toleranci
  NOVE                  — náš item bez match (score < LOW)
  VYNECHANE_DETAIL      — náš item z Phase 1.5 (Detail-* / OP-/LI-)
  VYNECHANE_KRITICKE    — náš item ↔ PROBE finding
  VYNECHANE_ZE_STAREHO  — stará položka bez match
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
CANDIDATES = OUT_DIR / "match_candidates.json"
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
DIFF = OUT_DIR / "phase_5_diff.json"

SCORE_HIGH = 0.45
SCORE_MED = 0.25
VOL_TOLERANCE_PCT = 5.0


def main() -> None:
    combined = json.loads(COMBINED.read_text(encoding="utf-8"))
    candidates_blob = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    dataset = json.loads(DS.read_text(encoding="utf-8"))
    items = combined["items"]
    candidates = candidates_blob["candidates"]
    cff = dataset.get("carry_forward_findings", [])

    # Build item_id → item map
    items_by_id = {it["item_id"]: it for it in items}

    # PROBE finding mapping — item-level VYNECHANE_KRITICKE detection
    # Items whose popis touches cement screed (HSV-631 cementový potěr) or
    # hydroizolace pod obklad (PSV-781 Hydroizolační stěrka)
    def is_probe_critical(it: dict) -> bool:
        kap = it["kapitola"]
        popis = it["popis"].lower()
        # PROBE 1 — cement screed (any HSV-631 cementový potěr line)
        if kap == "HSV-631" and popis.startswith("cementový potěr"):
            return True
        # PROBE 2 — hydroizolace pod obklad (PSV-781 Hydroizolační stěrka)
        if kap == "PSV-781" and "hydroizolační stěrka" in popis:
            return True
        return False

    def is_detail_item(it: dict) -> bool:
        kap = it["kapitola"]
        return (
            kap.startswith("Detail-")
            or kap.startswith("OP-")
            or kap.startswith("LI-")
            or kap == "PSV-768"  # spec details
        )

    # Forward map: which new items are claimed by which old?
    # Multiple old items can map to the same new item (1:N).
    new_item_claims: dict[str, list[dict]] = defaultdict(list)
    for cand in candidates:
        best = cand["best_match"]
        score = best["composite_score"]
        if score >= SCORE_MED:  # only stake claims for non-trivial scores
            new_item_claims[best["new_item_id"]].append({
                "old_idx": cand["old_idx"],
                "old_code": cand["old_code"],
                "old_popis": cand["old_popis"][:80],
                "old_qty_komplex": cand["old_mnozstvi_komplex"],
                "score": score,
                "popis_sim": best["popis_similarity"],
                "vol_prox": best["volume_proximity"],
            })

    # Walk new items, assign status
    status_counts: Counter = Counter()
    for it in items:
        kap = it["kapitola"]
        if is_probe_critical(it):
            it["urs_status"] = "VYNECHANE_KRITICKE"
            it["audit_note"] = "PROBE finding (Phase 0.7/3a) — gap vs starý VV"
        elif is_detail_item(it):
            it["urs_status"] = "VYNECHANE_DETAIL"
            it["audit_note"] = "Stykový detail / Tabulka prvku — typicky chybí ve starém VV"
        else:
            claims = new_item_claims.get(it["item_id"], [])
            if not claims:
                it["urs_status"] = "NOVE"
                it["audit_note"] = "Bez match v starém VV — novy item"
            else:
                best_claim = max(claims, key=lambda c: c["score"])
                # Check volume proximity at item level (D-share comparison)
                old_qty_d = (best_claim["old_qty_komplex"] or 0) * 0.25
                new_qty = it.get("mnozstvi") or 0
                if old_qty_d > 0 and new_qty > 0:
                    vol_diff_pct = abs(new_qty - old_qty_d) / old_qty_d * 100
                else:
                    vol_diff_pct = None
                if best_claim["score"] >= SCORE_HIGH:
                    if vol_diff_pct is not None and vol_diff_pct <= VOL_TOLERANCE_PCT:
                        it["urs_status"] = "SHODA_SE_STARYM"
                    else:
                        it["urs_status"] = "OPRAVENO_OBJEM"
                else:
                    it["urs_status"] = "OPRAVENO_POPIS"
                it["audit_note"] = (
                    f"Match score {best_claim['score']:.2f} → "
                    f"old code {best_claim['old_code']}, popis_sim "
                    f"{best_claim['popis_sim']:.2f}, vol_prox {best_claim['vol_prox']:.2f}"
                )
                it["audit_old_code"] = best_claim["old_code"]
                it["audit_old_qty_komplex"] = best_claim["old_qty_komplex"]
                if vol_diff_pct is not None:
                    it["audit_vol_diff_pct"] = round(vol_diff_pct, 1)
        status_counts[it["urs_status"]] += 1

    # Old items that have no claim at all → VYNECHANE_ZE_STAREHO
    claimed_olds = set()
    for claims in new_item_claims.values():
        for c in claims:
            claimed_olds.add(c["old_idx"])
    orphan_olds = [c for c in candidates if c["old_idx"] not in claimed_olds]
    print(f"Orphan starý VV items (VYNECHANE_ZE_STAREHO): {len(orphan_olds)}")

    # Per-kapitola breakdown
    per_kap: dict[str, Counter] = defaultdict(Counter)
    for it in items:
        per_kap[it["kapitola"]][it["urs_status"]] += 1

    # NEW PROBE detection: per-kapitola pomer NEW D / VV old × 0.25 (per-objekt expectation 1.0)
    # If our D NEW total per kapitola >> old × 0.25 → potential gap finding
    new_findings: list[dict] = []

    # Sum new D quantity per kapitola (for m² items only — comparable units)
    sum_new_per_kap_m2: dict[str, float] = defaultdict(float)
    for it in items:
        if it["MJ"] in ("m2", "m²") and it.get("urs_status") in ("NOVE", "VYNECHANE_KRITICKE"):
            sum_new_per_kap_m2[it["kapitola"]] += it.get("mnozstvi") or 0

    # Sum old komplex per matching section
    stary = json.loads((OUT_DIR / "stary_vv_normalized.json").read_text(encoding="utf-8"))
    old_per_section_m2: dict[str, float] = defaultdict(float)
    for it in stary["items"]:
        if "Architektonicko" not in it["sheet"]:
            continue
        sec = it.get("section") or ""
        m = re.match(r"^\s*(\d{2,3})", sec)
        if m and it.get("MJ", "").lower() in ("m2", "m²"):
            old_per_section_m2[m.group(1)] += it.get("mnozstvi") or 0

    # For each kapitola HSV-NNN/PSV-NNN, compare new D total vs old komplex × 0.25
    for kap, new_m2 in sorted(sum_new_per_kap_m2.items(), key=lambda x: -x[1]):
        m = re.match(r"^[A-Z]{3}-(\d{2,3})", kap)
        if not m:
            continue
        sec = m.group(1)
        old_komplex = old_per_section_m2.get(sec, 0)
        if old_komplex == 0:
            continue
        old_d = old_komplex * 0.25
        if new_m2 < 50:  # too small to flag
            continue
        ratio = new_m2 / max(old_d, 0.01)
        if ratio > 1.5:
            new_findings.append({
                "kapitola": kap,
                "section_old": sec,
                "new_d_m2": round(new_m2, 1),
                "old_komplex_m2": round(old_komplex, 1),
                "old_d_estimate_m2": round(old_d, 1),
                "ratio_new_to_old_d": round(ratio, 2),
                "gap_komplex_m2": round(new_m2 * 4 - old_komplex, 1),
                "interpretation": "Potential gap in starý VV (new D × 4 > old komplex)",
            })

    # Add new findings to dataset.carry_forward_findings (if not already there)
    existing_summaries = {f.get("summary", "")[:80] for f in cff}
    for nf in new_findings[:5]:  # cap at 5 new findings
        sum_text = f"Phase 5 PROBE — {nf['kapitola']}: new D {nf['new_d_m2']} m² vs old komplex {nf['old_komplex_m2']} m² (ratio {nf['ratio_new_to_old_d']}×)"
        if sum_text[:80] in existing_summaries:
            continue
        cff.append({
            "from_phase": f"5 — {nf['kapitola']} fuzzy-match gap",
            "severity": "warning",
            "summary": sum_text,
            "next_action": "manual review — confirm gap is real and not vocabulary mismatch",
            "parser_d_side_m2": nf["new_d_m2"],
            "old_komplex_m2": nf["old_komplex_m2"],
        })

    # Persist updated dataset + items
    dataset["carry_forward_findings"] = cff
    DS.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    COMBINED.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")

    # Build phase_5_diff.json — compact summary
    diff_out = {
        "metadata": {
            "items_total": len(items),
            "old_items_processed": len(candidates),
            "score_thresholds": {"high": SCORE_HIGH, "med": SCORE_MED},
            "vol_tolerance_pct": VOL_TOLERANCE_PCT,
            "d_share": 0.25,
            "status_distribution": dict(status_counts),
            "orphan_old_count": len(orphan_olds),
            "new_findings": new_findings,
            "carry_forward_findings_total": len(cff),
        },
        "per_kapitola": {
            k: dict(v) for k, v in sorted(per_kap.items())
        },
        "orphan_olds_top30": [
            {
                "code": o["old_code"],
                "popis": o["old_popis"][:80],
                "MJ": o["old_MJ"],
                "qty_komplex": o["old_mnozstvi_komplex"],
                "best_score": o["best_match"]["composite_score"],
                "best_new_popis": o["best_match"]["new_popis"][:80],
            }
            for o in orphan_olds[:30]
        ],
    }
    DIFF.write_text(json.dumps(diff_out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nWrote {DIFF} ({DIFF.stat().st_size:,} bytes)")
    print(f"Updated {COMBINED.name} + {DS.name} (in-place)")
    print()
    print("Status distribution:")
    for s, n in status_counts.most_common():
        pct = n / len(items) * 100
        print(f"  {s:25s} {n:>5}  ({pct:>5.1f} %)")
    print(f"  VYNECHANE_ZE_STAREHO        {len(orphan_olds):>5}  (orphan old items)")
    print()
    print(f"New PROBE findings detected: {len(new_findings)}")
    for f in new_findings[:5]:
        print(f"  {f['kapitola']:12s} new D {f['new_d_m2']:>8.1f} m² vs old komplex {f['old_komplex_m2']:>8.1f} (×{f['ratio_new_to_old_d']:.2f})")


if __name__ == "__main__":
    main()
