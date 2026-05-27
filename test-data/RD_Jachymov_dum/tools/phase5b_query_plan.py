#!/usr/bin/env python3
"""
Phase 5B query plan generator — select 60 items for WebSearch verification.

Selection per task spec Tier B:
  - All 27 HIGH family_mismatch candidates
  - 33 MEDIUM candidates stratified by:
    * Lowest urs_confidence first
    * Representative across kapitolas (max ~5 per kapitola)
  - Total: 60 queries (~$0.60 budget at $0.01/query)

Per Pattern 25 (Web search as catalog verification fallback) — query format:
  `URS <code_or_family> <key_noun_from_popis>`

NO MUTATION to items.json. Outputs query plan JSON only.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASE5A_PATH = ROOT / "outputs" / "phase5a_family_consistency.json"
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
OUT_PLAN = ROOT / "outputs" / "phase5b_query_plan.json"
TODAY = str(date.today())


def key_nouns_from_popis(popis: str) -> str:
    """Extract 2-3 most-meaningful nouns from popis for WebSearch."""
    if not popis:
        return ""
    # Strip leading verbs that aren't catalog-keyworth
    tokens = re.findall(r"[A-Za-zÁ-žŽčďěíňóřšťúýžĚŠČŘŽÝÁÍÉÚŮ]{3,}", popis)
    # Skip short/common words
    stop = {"pro", "dle", "vč", "tl", "mm", "ks", "kpl", "celkový", "stávající", "nový", "nové"}
    selected = []
    for t in tokens[:12]:
        if t.lower() not in stop and not t.isdigit():
            selected.append(t)
        if len(selected) >= 3:
            break
    return " ".join(selected)


def build_query(item: dict) -> str:
    code = item.get("urs_code_proposed") or ""
    nouns = key_nouns_from_popis(item.get("popis") or "")
    if code:
        return f"ÚRS {code} {nouns}".strip()
    # No code → use kapitola hint
    kap = item.get("kapitola", "").split(" ", 1)[-1]
    return f"ÚRS {kap} {nouns}".strip()


def main() -> None:
    phase5a = json.load(PHASE5A_PATH.open())
    items_data = json.load(ITEMS_PATH.open())
    items_by_id_kap = {(it["id"], it["kapitola"]): it for it in items_data["items"]}

    # Bucket Phase 5A candidates
    candidates = phase5a["candidates_for_phase5b"]
    high_priority = [c for c in candidates if c["ws_priority"] == "high"]
    medium_priority = [c for c in candidates if c["ws_priority"] == "medium"]

    # Sort medium by lowest urs_confidence
    medium_priority.sort(key=lambda c: c.get("urs_confidence_current") or 0)

    # Stratify medium across kapitolas (max 5 per kapitola)
    selected_medium: list[dict] = []
    per_kap_count: dict[str, int] = defaultdict(int)
    medium_target = 60 - len(high_priority)  # 33 if 27 high
    for c in medium_priority:
        if len(selected_medium) >= medium_target:
            break
        if per_kap_count[c["kapitola"]] >= 5:
            continue
        selected_medium.append(c)
        per_kap_count[c["kapitola"]] += 1

    # If we didn't fill medium_target due to cap, lift cap on remaining
    if len(selected_medium) < medium_target:
        for c in medium_priority:
            if c in selected_medium:
                continue
            selected_medium.append(c)
            if len(selected_medium) >= medium_target:
                break

    selected_candidates = high_priority + selected_medium

    # Build query plan
    plan: list[dict] = []
    for c in selected_candidates:
        # Find the full item to extract popis (Phase 5A only has 80-char excerpt)
        full_item = None
        for it in items_data["items"]:
            if it["id"] == c["item_id"] and it["kapitola"] == c["kapitola"]:
                full_item = it
                break
        if not full_item:
            continue
        plan.append({
            "query_index": len(plan) + 1,
            "item_id": c["item_id"],
            "kapitola": c["kapitola"],
            "subkapitola": full_item.get("subkapitola"),
            "popis": full_item.get("popis"),
            "mj": full_item.get("mj"),
            "mnozstvi": full_item.get("mnozstvi"),
            "current_urs_code": c["urs_code_current"],
            "current_urs_confidence": c["urs_confidence_current"],
            "current_urs_status": c["urs_status_current"],
            "family_actual": c["family_actual"],
            "family_expected": c["family_expected"],
            "priority": c["ws_priority"],
            "flag_class": c["flag_class"],
            "websearch_query": build_query(full_item),
        })

    out = {
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": "Phase 5B WebSearch query plan — 60 selective verification candidates against FROZEN items.json baseline.",
        "_pattern_compliance": {
            "pattern_15": "Catalog matching against FROZEN baseline (Phase 5 of strict sequence)",
            "pattern_25": "Selective WebSearch (not brute-force); targets uncertain candidates from Phase 5A",
            "pattern_26": "Fallback hierarchy applied at result-interpretation step (Phase 5B execution, not plan)"
        },
        "selection_summary": {
            "total_queries": len(plan),
            "high_priority_count": len([p for p in plan if p["priority"] == "high"]),
            "medium_priority_count": len([p for p in plan if p["priority"] == "medium"]),
            "per_kapitola": dict(per_kap_count),
            "budget_estimate_usd": round(len(plan) * 0.01, 2),
        },
        "queries": plan,
    }
    OUT_PLAN.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"Total queries: {len(plan)} | budget estimate ${len(plan)*0.01:.2f}")
    print(f"  High priority: {len([p for p in plan if p['priority']=='high'])}")
    print(f"  Medium priority: {len([p for p in plan if p['priority']=='medium'])}")
    print(f"  Per kapitola: {dict(sorted(per_kap_count.items(), key=lambda x: -x[1]))}")
    print(f"Output: {OUT_PLAN.relative_to(ROOT)}")
    # Print first 5 queries
    print("\nFirst 5 queries (sample):")
    for p in plan[:5]:
        print(f"  Q{p['query_index']:>2} [{p['priority']:>6}] {p['item_id']:<30} → {p['websearch_query'][:100]}")


if __name__ == "__main__":
    main()
