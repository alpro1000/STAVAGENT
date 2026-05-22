#!/usr/bin/env python3
"""
hk212 Task 2 Step 1.5 finalize — apply user ratification to layer dictionary.

User decisions (chat 2026-05-22):
  · A-GENM, A-GENM-1, A-GENM-2 → reclassify as `gutters_downpipes` (Lindab
    Round Downpipe System + MEARIN Plus3000 channel per scan dossier).
    Conf=0.85. NOT drop.
  · '212_HK_situace_03_dwg-1', '2966-1_navrh dispozice stroju-HK_*' (3
    user_custom_numbered layers) → reclassify as `external_reference`.
    Conf=0.85. Keep for cross-ref.
  · '0' (default, 162 entities) → flag drop_from_aggregation=True.
  · 'NETISK' (non_print_helper, 101 entities) → flag drop_from_aggregation=True.

Reads layer_dictionary_proposed.json, applies edits, writes
layer_dictionary_ratified.json + a separate audit_decisions.md.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
IN_PATH = REPO / "test-data/hk212_hala/outputs/dsp_geometry_extraction/layer_dictionary_proposed.json"
OUT_PATH = REPO / "test-data/hk212_hala/outputs/dsp_geometry_extraction/layer_dictionary_ratified.json"
AUDIT_PATH = REPO / "test-data/hk212_hala/outputs/dsp_geometry_extraction/dictionary_decisions.md"


# (layer_name → (new_category, new_confidence, decision_note))
RECLASSIFY = {
    "A-GENM": ("gutters_downpipes",
               0.85,
               "MEARIN Plus3000 NW300 drainage channel at základy (per agenm_targeted_scan.json)"),
    "A-GENM-1": ("gutters_downpipes",
                 0.85,
                 "Lindab Round Downpipe System 150/100 geometry (ARC/SPLINE/HATCH exploded from block)"),
    "A-GENM-2": ("gutters_downpipes",
                 0.85,
                 "Lindab Round Downpipe System 150/100 INSERTs + drawing geometry on A104_pohledy"),
    "212_HK_situace_03_dwg-1": ("external_reference", 0.85,
                                "External xref: situace 1:200 — keep for cross-ref"),
    "2966-1_navrh dispozice stroju-HK_02_dwg-1": ("external_reference", 0.85,
                                                   "External xref: 2966-1 dispozice strojů (existing layout) — Stage A"),
    "2966-1_navrh dispozice stroju-HK_dwg-1": ("external_reference", 0.85,
                                                "External xref: 2966-1 dispozice strojů (existing layout) — Stage A"),
}

# layers flagged drop_from_aggregation=True
DROP_FROM_AGGREGATION = {
    "0": "DXF default — mixed template residue, low value for aggregation",
    "NETISK": "Czech 'non-print' construction-aid layer — explicitly not meant for output",
}


def main() -> int:
    d = json.loads(IN_PATH.read_text())
    classified = d["classified_layers"]

    audit_log: list[dict] = []
    reclassified_count = 0
    dropped_count = 0

    for c in classified:
        layer = c["layer"]
        if layer in RECLASSIFY:
            new_cat, new_conf, note = RECLASSIFY[layer]
            audit_log.append({
                "layer": layer,
                "action": "reclassify",
                "old_category": c["category"],
                "old_confidence": c["confidence"],
                "new_category": new_cat,
                "new_confidence": new_conf,
                "note": note,
            })
            c["category"] = new_cat
            c["confidence"] = new_conf
            c["ratification_note"] = note
            reclassified_count += 1
        if layer in DROP_FROM_AGGREGATION:
            c["drop_from_aggregation"] = True
            c["drop_reason"] = DROP_FROM_AGGREGATION[layer]
            audit_log.append({
                "layer": layer,
                "action": "drop_from_aggregation",
                "category": c["category"],
                "note": DROP_FROM_AGGREGATION[layer],
            })
            dropped_count += 1
        else:
            c["drop_from_aggregation"] = False

    # Per-category recount (post-ratification)
    from collections import Counter
    cat_counts = Counter(c["category"] for c in classified)

    d["_meta"]["ratified_at"] = datetime.now(timezone.utc).isoformat()
    d["_meta"]["ratification_summary"] = {
        "reclassified_layers": reclassified_count,
        "dropped_from_aggregation_layers": dropped_count,
        "active_layers_for_aggregation": sum(1 for c in classified if not c["drop_from_aggregation"]),
        "per_category_distinct_layers": dict(cat_counts.most_common()),
    }
    d["ratification_audit"] = audit_log

    OUT_PATH.write_text(json.dumps(d, indent=2, ensure_ascii=False))
    print(f"wrote {OUT_PATH}")

    # Audit markdown
    lines = ["# HK212 — Layer Dictionary Ratification\n",
             f"_Generated: {d['_meta']['ratified_at']}_\n",
             "## Decisions applied\n"]
    for e in audit_log:
        if e["action"] == "reclassify":
            lines.append(f"- **{e['layer']}** : `{e['old_category']}` (conf {e['old_confidence']}) → "
                         f"`{e['new_category']}` (conf {e['new_confidence']})\n")
            lines.append(f"  - {e['note']}\n")
        else:
            lines.append(f"- **{e['layer']}** : `{e['category']}` → "
                         f"`drop_from_aggregation=True`\n")
            lines.append(f"  - {e['note']}\n")
    lines.append("\n## Post-ratification category distribution\n")
    for cat, n in sorted(cat_counts.items(), key=lambda x: -x[1]):
        lines.append(f"- **{cat}**: {n}\n")
    AUDIT_PATH.write_text("".join(lines))
    print(f"wrote {AUDIT_PATH}")
    print(f"reclassified={reclassified_count}, dropped={dropped_count}, "
          f"active={d['_meta']['ratification_summary']['active_layers_for_aggregation']}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
