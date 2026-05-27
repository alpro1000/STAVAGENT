#!/usr/bin/env python3
"""
Phase 5 pre-flight check — verify FROZEN fields preserved after Phase 5B.

Per task guardrails:
  - Item count: 212 → 212 (NO add, NO delete)
  - FROZEN fields per item (must not change):
      popis, mj, mnozstvi, mnozstvi_formula, source, kapitola, subkapitola,
      realizuje_skladbu, subdodavatel
  - Allowed-to-change fields:
      urs_code_proposed, urs_status, urs_confidence,
      cross_verification_status, cross_verification_evidence_url,
      correct_code_hint, _audit_gap_fixed

Exit 0 = PASS (Phase 5B safe, FROZEN preserved).
Exit 1 = FAIL (revert items.json from items_FROZEN_pre_phase5b.json).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEFORE = ROOT / "outputs" / "items_FROZEN_pre_phase5b.json"
AFTER = ROOT / "outputs" / "items_rd_jachymov_complete.json"

FROZEN_FIELDS = [
    "popis", "mj", "mnozstvi", "mnozstvi_formula", "source",
    "kapitola", "subkapitola", "realizuje_skladbu", "subdodavatel",
]

ALLOWED_CHANGE = [
    "urs_code_proposed", "urs_status", "urs_confidence",
    "cross_verification_status", "cross_verification_evidence_url",
    "correct_code_hint", "_audit_gap_fixed",
]


def main() -> int:
    before = json.load(BEFORE.open())["items"]
    after = json.load(AFTER.open())["items"]

    # Item count check
    if len(before) != len(after):
        print(f"FAIL — item count changed: {len(before)} → {len(after)}")
        return 1

    # Build map by (id, kapitola) compound key (per Pattern 28 schema reality)
    before_by_key = {(it["id"], it["kapitola"], it.get("subkapitola")): it for it in before}
    after_by_key = {(it["id"], it["kapitola"], it.get("subkapitola")): it for it in after}

    if set(before_by_key.keys()) != set(after_by_key.keys()):
        only_before = set(before_by_key.keys()) - set(after_by_key.keys())
        only_after = set(after_by_key.keys()) - set(before_by_key.keys())
        print(f"FAIL — item key set changed")
        print(f"  Only in before: {list(only_before)[:5]}")
        print(f"  Only in after:  {list(only_after)[:5]}")
        return 1

    # FROZEN field check per item
    violations = []
    items_with_url_field_added = 0
    items_with_status_changed = 0
    for key, b in before_by_key.items():
        a = after_by_key[key]
        for f in FROZEN_FIELDS:
            if b.get(f) != a.get(f):
                violations.append({
                    "item_id": key[0],
                    "kapitola": key[1],
                    "subkapitola": key[2],
                    "field": f,
                    "before": b.get(f),
                    "after": a.get(f),
                })
        # Track expected changes
        if a.get("cross_verification_evidence_url"):
            items_with_url_field_added += 1
        if b.get("urs_status") != a.get("urs_status"):
            items_with_status_changed += 1

    if violations:
        print(f"FAIL — {len(violations)} FROZEN field violation(s):")
        for v in violations[:10]:
            print(f"  {v['item_id']} ({v['kapitola']}): field='{v['field']}' before={v['before']!r} after={v['after']!r}")
        return 1

    # Diff field-level: what changed?
    all_fields_changed: dict[str, int] = {}
    for key, b in before_by_key.items():
        a = after_by_key[key]
        for f in set(list(b.keys()) + list(a.keys())):
            if b.get(f) != a.get(f):
                all_fields_changed[f] = all_fields_changed.get(f, 0) + 1

    # Verify all changed fields are in the allowed list
    unexpected_changed = {f: c for f, c in all_fields_changed.items() if f not in ALLOWED_CHANGE}
    if unexpected_changed:
        print(f"FAIL — unexpected fields changed: {unexpected_changed}")
        return 1

    print("PASS — FROZEN fields preserved")
    print(f"  Item count: {len(before)} → {len(after)} (unchanged)")
    print(f"  Items with cross_verification_evidence_url added: {items_with_url_field_added}")
    print(f"  Items with urs_status changed: {items_with_status_changed}")
    print(f"  All changed fields are in allowed set: {sorted(all_fields_changed.keys())}")
    print(f"  Per-field change counts: {all_fields_changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
