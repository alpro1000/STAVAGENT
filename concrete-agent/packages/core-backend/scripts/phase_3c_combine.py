"""Combine Phase 3a + 3b + 3c (A/B/C) item JSONs into one master dataset."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

OUT_DIR = Path("test-data/libuse/outputs")
SRCS = [
    OUT_DIR / "items_phase_3a_vnitrni.json",
    OUT_DIR / "items_phase_3b_vnejsi_a_suteren.json",
    OUT_DIR / "items_phase_3c_sdk.json",
    OUT_DIR / "items_phase_3c_truhl_zamec.json",
    OUT_DIR / "items_phase_3c_detaily.json",
]
DS = OUT_DIR / "objekt_D_geometric_dataset.json"
OUT = OUT_DIR / "items_objekt_D_complete.json"


def main() -> None:
    all_items = []
    by_source: dict[str, int] = {}
    for p in SRCS:
        blob = json.loads(p.read_text(encoding="utf-8"))
        items = blob.get("items", [])
        all_items.extend(items)
        by_source[p.name] = len(items)

    by_kap: dict[str, dict] = defaultdict(lambda: {"count": 0, "by_mj": defaultdict(float)})
    for it in all_items:
        by_kap[it["kapitola"]]["count"] += 1
        by_kap[it["kapitola"]]["by_mj"][it["MJ"]] += it["mnozstvi"]
    by_kap_clean = {
        k: {"count": v["count"], "totals": {mj: round(t, 2) for mj, t in v["by_mj"].items()}}
        for k, v in by_kap.items()
    }

    dataset = json.loads(DS.read_text(encoding="utf-8"))
    cff = dataset.get("carry_forward_findings", [])

    out = {
        "metadata": {
            "objekt": "D",
            "phase": "3 (a + b + c) — complete",
            "items_count": len(all_items),
            "items_per_source": by_source,
            "items_per_kapitola": by_kap_clean,
            "carry_forward_findings": cff,
            "next_phase": "4 — ÚRS lookup batch",
            "all_items_have_urs_code_null": all(it.get("urs_code") is None for it in all_items),
        },
        "items": all_items,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"Total items combined: {len(all_items)}")
    print()
    print("Per source:")
    for k, v in by_source.items():
        print(f"  {k:48s} {v:>5}")
    print()
    print("Per kapitola:")
    for k in sorted(by_kap_clean):
        print(f"  {k:25s} count={by_kap_clean[k]['count']:>5}")


if __name__ == "__main__":
    main()
