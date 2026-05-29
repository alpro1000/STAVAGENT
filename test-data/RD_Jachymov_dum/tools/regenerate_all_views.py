#!/usr/bin/env python3
"""
Single-source regeneration orchestrator (UWO single-source principle).

items.json is the SINGLE SOURCE OF TRUTH. All downstream views regenerate
from it via this one script — no view is hand-edited. Run after ANY
items.json change to keep every deliverable in sync.

Pipeline (order matters — dependencies flow downward):
  1. atomic_decomposition.py        → atomic_decomposition_map.json
  2. atomic_worklist_excel.py       → ATOMIC_WORKLIST.xlsx  (depends on map)
  3. phase2_excel_generator.py      → VSE_VARIANTY.xlsx     (File A base)
  4. extend_phase4_excel.py         → VSE_VARIANTY_v2.xlsx  (+ realizuje_skladbu cols)
  5. finalize_phase4_excel_v2.py    → VSE_VARIANTY_v2_final.xlsx (+ Var_E + namespace)
  6. completeness_check_v2.py       → items_completeness_*  (audit)
  7. quality_audit.py               → items_quality_*       (audit)

Each step runs as subprocess; non-zero exit aborts the chain (fail-fast).
Prints a per-step status table at the end.

Usage:  python3 tools/regenerate_all_views.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"

PIPELINE = [
    ("atomic_decomposition.py", "atomic_decomposition_map.json"),
    ("atomic_worklist_excel.py", "ATOMIC_WORKLIST.xlsx"),
    ("phase2_excel_generator.py", "VSE_VARIANTY.xlsx (File A base)"),
    ("extend_phase4_excel.py", "VSE_VARIANTY_v2.xlsx (+ skladba cols)"),
    ("finalize_phase4_excel_v2.py", "VSE_VARIANTY_v2_final.xlsx (+ Var_E)"),
    ("completeness_check_v2.py", "items_completeness_* audit"),
    ("quality_audit.py", "items_quality_* audit"),
]


def main() -> None:
    print(f"Single-source regeneration — {len(PIPELINE)} steps\n")
    results = []
    for script, output_desc in PIPELINE:
        path = TOOLS / script
        if not path.exists():
            results.append((script, "MISSING", output_desc))
            print(f"  ✗ {script:34} MISSING — skipped")
            continue
        proc = subprocess.run(
            [sys.executable, str(path)],
            capture_output=True, text=True, cwd=str(ROOT),
        )
        if proc.returncode == 0:
            results.append((script, "OK", output_desc))
            print(f"  ✓ {script:34} → {output_desc}")
        else:
            results.append((script, f"FAIL(rc={proc.returncode})", output_desc))
            print(f"  ✗ {script:34} FAILED (rc={proc.returncode})")
            print(f"    stderr: {proc.stderr[-400:]}")
            print("\nAborting chain (fail-fast).")
            sys.exit(1)

    print(f"\nAll {len(results)} steps OK. Views regenerated from items.json single source.")


if __name__ == "__main__":
    main()
