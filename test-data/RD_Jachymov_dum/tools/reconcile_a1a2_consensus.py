#!/usr/bin/env python3
"""
Reconciliation Step 2 — formalize A1/A2 consensus code decisions into
busy-einstein items.json (Stage-3-ready, NOT final leaf binding).

CASE C reconciliation: busy-einstein 214 = canonical base. Salvage the
A1/A2 disambiguation DECISIONS from happy-hamilton (without raw git merge,
which would regress Stage 1B + conflict items.json).

4 WRONG_LEAF items → consensus decisions:
  HSV2.003 bednění → família 274 (consensus: busy hint "274XXX" == happy A1 BLANK+274)
  HSV2.008 věnec   → família 274 (same)
  HSV1.004 dvorek  → 596811220 (consensus: busy atomic 596 == happy A2); leaf VERIFY Stage3
  HSV1.005 terasa  → família 636311 (USE busy 636311 dlaždice NA TERČE;
                     DISCARD happy 762952004 carpentry — superseded wooden assumption)

Touches ONLY catalog-decision fields (per FROZEN-field discipline, Pattern 15):
  urs_code_proposed, urs_code_family_6digit (NEW field), urs_status,
  cross_verification_status, correct_code_hint, _audit_gap_fixed.
DOES NOT touch popis/mj/mnozstvi/mnozstvi_formula/source/kapitola/
subkapitola/realizuje_skladbu/subdodavatel.

items.json stays 214 (no add, no delete). Snapshot: items_pre_reconciliation.json
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
TODAY = str(date.today())

# Per-item consensus decision. família = 6-digit catalog family (Stage 3 binds leaf).
DECISIONS = {
    ("260219_dum.HSV2.003", "HSV-2 Základové a ŽB"): {
        "urs_code_proposed": None,
        "urs_code_family_6digit": "274",
        "urs_status": "wrong_leaf_274_family_lookup_required",
        "cross_verification_status": "RECONCILED_274_CONSENSUS",
        "correct_code_hint": "274XXX systémové bednění monolitických konstrukcí (bílá vana opěrná stěna). Consensus: busy-einstein hint == happy-hamilton A1. Leaf binding Stage 3.",
        "note": "A1 reconciliation — family 631→274 (631 = úpravy povrchů wrong; bednění ŽB = 274). Consensus busy hint + happy A1.",
    },
    ("260219_dum.HSV2.008", "HSV-2 Základové a ŽB"): {
        "urs_code_proposed": None,
        "urs_code_family_6digit": "274",
        "urs_status": "wrong_leaf_274_family_lookup_required",
        "cross_verification_status": "RECONCILED_274_CONSENSUS",
        "correct_code_hint": "274XXX systémové bednění věnců. Consensus: busy-einstein hint == happy-hamilton A1. Leaf binding Stage 3.",
        "note": "A1 reconciliation — family 631→274 (bednění pozedního věnce). Consensus busy hint + happy A1.",
    },
    ("260219_dum.HSV1.004", "HSV-1 Zemní práce"): {
        "urs_code_proposed": "596811220",
        "urs_code_family_6digit": "596",
        "urs_status": "family_verified_leaf_candidate_verify_stage3",
        "cross_verification_status": "RECONCILED_596_CONSENSUS",
        "correct_code_hint": "596 família — kladení betonové dlažby na loži (anglický dvorek). Consensus: busy atomic família 596 == happy A2 596811220. Leaf 596811220 candidate — VERIFY via MCP find_urs_code Stage 3.",
        "note": "A2 reconciliation — dvorek dlažba na loži; was 564831111 WRONG_LEAF. Consensus busy 596 + happy 596811220 (leaf candidate).",
    },
    ("260219_dum.HSV1.005", "HSV-1 Zemní práce"): {
        "urs_code_proposed": None,
        "urs_code_family_6digit": "636311",
        "urs_status": "family_636311_leaf_lookup_required",
        "cross_verification_status": "RECONCILED_636311_terasa_na_terce",
        "correct_code_hint": "636311 família — betonové dlaždice NA TERČE (rektifikovatelné terče). USE busy-einstein 636311. happy-hamilton 762952004 (carpentry) DISCARDED — superseded wooden-decking assumption; frozen popis is betonové dlaždice na terče, NOT dřevěná prkna. Leaf binding Stage 3.",
        "note": "A2 reconciliation — terasa; was 564831111 WRONG_LEAF. happy-hamilton 762 DISCARDED, busy-einstein 636311 (dlaždice na terče per frozen popis) USED.",
    },
}


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]

    applied = []
    for it in items:
        key = (it["id"], it["kapitola"])
        if key not in DECISIONS:
            continue
        d = DECISIONS[key]
        before_code = it.get("urs_code_proposed")
        # Apply ONLY catalog-decision fields
        it["urs_code_proposed"] = d["urs_code_proposed"]
        it["urs_code_family_6digit"] = d["urs_code_family_6digit"]
        it["urs_status"] = d["urs_status"]
        it["cross_verification_status"] = d["cross_verification_status"]
        it["correct_code_hint"] = d["correct_code_hint"]
        prev_tag = it.get("_audit_gap_fixed")
        new_tag = "RECONCILIATION_A1A2_CONSENSUS"
        it["_audit_gap_fixed"] = f"{prev_tag}; {new_tag}" if prev_tag else new_tag
        applied.append({
            "id": it["id"],
            "before_code": before_code,
            "after_code": d["urs_code_proposed"],
            "family": d["urs_code_family_6digit"],
            "note": d["note"],
        })

    data["_reconciliation_a1a2_log"] = {
        "applied_at": TODAY,
        "purpose": "CASE C reconciliation — A1/A2 consensus decisions salvaged from happy-hamilton into busy-einstein 214 canonical. NO raw git merge. Catalog-decision fields only.",
        "decisions": applied,
        "terasa_762_discarded": "HSV1.005 happy-hamilton 762952004 (carpentry) DISCARDED — frozen popis = betonové dlaždice na terče → 636311 família (busy-einstein atomic worklist correct).",
        "snapshot_before": "outputs/items_pre_reconciliation.json",
        "items_total": len(items),
    }
    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "items_total": len(items),
        "decisions_applied": applied,
        "terasa_762_discarded": True,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
