"""Phase 0b — DXF extraction driver for hk212_hala.

Runs concrete-agent.app.services.dxf_hala_parser.parse_hala_dxf on all 7
hk212 DXFs, dumps each result to outputs/dxf_parse/<basename>.json, and
prints a top-level summary.

Run from repo root::

    python3 test-data/hk212_hala/scripts/extract_dxf.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "concrete-agent" / "packages" / "core-backend"))

from app.services.dxf_hala_parser import parse_hala_dxf  # noqa: E402

INPUTS_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "inputs" / "vykresy_dxf"
OUTPUT_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "outputs" / "dxf_parse"


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dxfs = sorted(INPUTS_DIR.glob("*.dxf"))
    if not dxfs:
        print(f"ERROR: no DXFs in {INPUTS_DIR}", file=sys.stderr)
        return 1

    print(f"# Parsing {len(dxfs)} DXFs from {INPUTS_DIR.relative_to(REPO_ROOT)}\n")
    summary_rows: list[tuple[str, int, int, int, int, int, int, int]] = []
    for path in dxfs:
        parsed = parse_hala_dxf(path)
        out_path = OUTPUT_DIR / (path.stem + ".json")
        out_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2))
        summary_rows.append((
            path.name,
            sum(parsed["block_counts"].values()),
            len(parsed["block_counts"]),
            len(parsed["dimensions"]),
            len(parsed["text_entries"]),
            sum(parsed["hatch_per_layer"].values()),
            len(parsed["closed_polylines"]),
            len(parsed["xrefs"]),
        ))
        print(f"  ✓ {path.name} → {out_path.relative_to(REPO_ROOT)}")

    print(f"\n# Summary")
    print(f"{'file':56s} {'INS':>5s} {'unq':>4s} {'DIM':>4s} {'TXT':>4s} {'HAT':>4s} {'POL':>4s} {'XRF':>4s}")
    for row in summary_rows:
        print(f"{row[0]:56s} {row[1]:5d} {row[2]:4d} {row[3]:4d} {row[4]:4d} {row[5]:4d} {row[6]:4d} {row[7]:4d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
