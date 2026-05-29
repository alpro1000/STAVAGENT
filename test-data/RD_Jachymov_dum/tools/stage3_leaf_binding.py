#!/usr/bin/env python3
"""
Stage 3 — catalog leaf binding (honest outcome, Pattern 26).

Attempted the full source-priority ladder (Pattern 25 enriched) for leaf
binding of 240 atomic ops / 214 items:

  1. MCP find_urs_code (cs-urs.cz + Perplexity)  → N/A for building items
     (catalog paywalled; tool returns confidence 0.5 + refuses to guess —
     "nechci hádat" — Pattern 26 alignment at tool level)
  2. URS_MATCHER service                         → same matcher backend
  3. find_otskp_code (17,904-item real DB)       → WRONG DOMAIN (transport:
     returned popelnice/DZ-sloupky/SOS-hláska for přesun/lešení — OTSKP is
     mosty/silnice, not pozemní stavby)
  4. WebSearch                                   → family-level only
     (Phase 5B established: 6-digit family ~75% ok, 9-digit leaf not in
     paywalled-catalog Google snippets)

CONCLUSION: URS building-catalog 9-digit LEAVES are not machine-accessible
in this environment. Per Pattern 26 (honest fallback, NO fabrication):
  - Keep the 8 Phase-5-VERIFIED leaves (verified earlier with evidence)
  - Keep família-resolved items: família retained + leaf BLANK + MANUAL
    LOOKUP flag (Karel binds leaf in his KROS system — has paid catalog)
  - Keep 4 reconciliation consensus: HSV1.004 596811220 (happy-hamilton
    leaf candidate, verify-pending); HSV2.003/008 família 274 + blank;
    HSV1.005 família 636311 + blank
  - DO NOT fabricate any leaf from the OTSKP transport DB or from memory

This script does NOT mutate item catalog codes (nothing bindable was
returned by the ladder). It records the Stage-3 attempt + per-class
disposition in items.json metadata, then the orchestrator regenerates all
views so File B reflects the honest final state.

items.json count unchanged (214). Snapshot: items_pre_stage3.json.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
LOG_PATH = ROOT / "outputs" / "stage3_leaf_binding_log.json"
TODAY = str(date.today())


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]

    # Per-item leaf-binding disposition (NO fabrication — classify existing state)
    disposition = Counter()
    per_item = []
    for it in items:
        code = it.get("urs_code_proposed")
        fam = it.get("urs_code_family_6digit")
        status = it.get("urs_status") or ""
        cvs = it.get("cross_verification_status") or ""

        if code and "verified" in status and "leaf" in status.lower() or status == "matched_websearch_verified":
            klass = "leaf_verified_phase5"
        elif code and str(code).strip() and len(str(code).replace("-", "")) >= 9 and "RECONCIL" in cvs:
            klass = "leaf_candidate_reconciliation_verify_stage3plus"
        elif code and str(code).strip() and len(str(code).replace("-", "")) >= 9:
            klass = "leaf_from_generator_unverified"
        elif fam or (code and len(str(code).replace("-", "")) <= 6):
            klass = "family_resolved_leaf_MANUAL_LOOKUP"
        else:
            klass = "blank_MANUAL_LOOKUP"
        disposition[klass] += 1
        per_item.append({"id": it["id"], "kapitola": it["kapitola"], "class": klass,
                         "code": code, "family": fam})

    data["_stage3_leaf_binding_log"] = {
        "applied_at": TODAY,
        "outcome": "LEAF_BINDING_BLOCKED_BY_CATALOG_ACCESS",
        "source_ladder_attempted": {
            "1_mcp_find_urs_code": "N/A — web-backed (Perplexity/urs.cz), catalog paywalled; tool refuses to fabricate (conf 0.5, 'nechci hádat'). Tested HSV2.003 bednění + omítka 612 — both N/A.",
            "2_urs_matcher": "same matcher backend as find_urs_code",
            "3_find_otskp_code": "WRONG DOMAIN — real 17904-item DB but transport (mosty/silnice); 'přesun hmot'→popelnice/DZ sloupky, 'lešení'→GSM-R/SOS hláska. Not usable for pozemní RD.",
            "4_websearch": "family-level only (Phase 5B: 6-digit family ~75%, 9-digit leaf not in paywalled-catalog snippets)",
        },
        "pattern_26_compliance": "NO leaf fabricated. URS building leaves require Karel's KROS system (paid catalog). Família-resolved + honest MANUAL LOOKUP flags delivered.",
        "disposition": dict(disposition),
        "budget_spent_usd": "~0.05 (4 MCP probes; find_otskp free, find_urs cheap perplexity)",
        "deliverable": "Family-resolved (274/596/636311 consensus + Phase 5 families) + 8 verified leaves + honest MANUAL LOOKUP blanks. File B 'URS vyber audit' sheet surfaces status per item for KROS binding.",
        "snapshot_before": "outputs/items_pre_stage3.json",
    }
    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "outcome": "LEAF_BINDING_BLOCKED_BY_CATALOG_ACCESS (Pattern 26 — no fabrication)",
        "items_total": len(items),
        "disposition": dict(disposition),
        "ladder": "find_urs_code N/A · find_otskp wrong-domain · WebSearch family-only",
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
