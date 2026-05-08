#!/usr/bin/env python3
"""phase_0_5_batch_convert.py — Libuše-specific DWG→DXF batch wrapper.

Phase 0.5 of the Libuše dokončovací-práce pipeline (next-session-libuse.md
"Phase progression" entry). Converts every DWG in
`test-data/libuse/sources/{A,B,C,D,shared}/dwg/` to a sibling
`test-data/libuse/sources/{A,B,C,D,shared}/dxf/` directory, then writes a
human-readable log at `test-data/libuse/outputs/dwg_conversion_log.md`.

This is a thin wrapper around the cross-project converter at
`scripts/infrastructure/dwg_to_dxf_batch.py`. Logic + dependencies stay
there; this file only encodes the Libuše paths + log format.

Usage:
    cd <repo-root>
    python concrete-agent/packages/core-backend/scripts/phase_0_5_batch_convert.py
    python concrete-agent/packages/core-backend/scripts/phase_0_5_batch_convert.py --force

Exit codes:
    0  every DWG converted (or already up-to-date)
    1  at least one DWG failed
    2  build_libredwg.sh failed — dwg2dxf unavailable
    3  no DWG files found across all buckets
"""
from __future__ import annotations

import argparse
import datetime as _dt
import importlib.util
import sys
from pathlib import Path

# Resolve repo paths from this file's location:
# concrete-agent/packages/core-backend/scripts/phase_0_5_batch_convert.py
#   parents[0] = scripts
#   parents[1] = core-backend
#   parents[2] = packages
#   parents[3] = concrete-agent
#   parents[4] = REPO_ROOT
REPO_ROOT = Path(__file__).resolve().parents[4]
SOURCES = REPO_ROOT / "test-data" / "libuse" / "sources"
LOG_PATH = REPO_ROOT / "test-data" / "libuse" / "outputs" / "dwg_conversion_log.md"
INFRA_BATCH = REPO_ROOT / "scripts" / "infrastructure" / "dwg_to_dxf_batch.py"

BUCKETS = ("A", "B", "C", "D", "shared")


def _import_batch_module():
    """Load scripts/infrastructure/dwg_to_dxf_batch.py without modifying sys.path.

    NOTE: registers the module in sys.modules before exec_module() — required
    for @dataclass etc. to resolve type hints via sys.modules[cls.__module__].
    """
    module_name = "dwg_to_dxf_batch"
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, INFRA_BATCH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {INFRA_BATCH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="phase_0_5_batch_convert", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true",
                        help="Reconvert even if DXF is newer than DWG")
    args = parser.parse_args(argv)

    if not INFRA_BATCH.exists():
        print(f"ERROR: missing {INFRA_BATCH}", file=sys.stderr)
        return 2
    batch = _import_batch_module()

    if not batch.ensure_dwg2dxf_available():
        return 2

    summaries: dict[str, "batch.BatchSummary"] = {}
    overall_failed = 0
    overall_total = 0

    for bucket in BUCKETS:
        in_dir = SOURCES / bucket / "dwg"
        out_dir = SOURCES / bucket / "dxf"
        if not in_dir.exists():
            continue
        # Use the cross-project run() — log_path=None: we render our own log.
        summary = batch.run(
            input_dir=in_dir,
            output_dir=out_dir,
            recursive=False,
            force=args.force,
            log_path=None,
        )
        summaries[bucket] = summary
        overall_failed += summary.failed
        overall_total += summary.total

    if overall_total == 0:
        print(f"No DWG found under {SOURCES}/{{{','.join(BUCKETS)}}}/dwg/", file=sys.stderr)
        return 3

    _write_libuse_log(summaries)
    print(f"\nLog: {LOG_PATH.relative_to(REPO_ROOT)}", file=sys.stderr)
    return 1 if overall_failed else 0


def _write_libuse_log(summaries: dict[str, object]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    lines.append("# DWG → DXF conversion log — Phase 0.5 batch")
    lines.append("")
    lines.append(f"**Date:** {_dt.datetime.now(tz=_dt.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"**Backend:** LibreDWG `dwg2dxf` (via `scripts/infrastructure/`)")
    lines.append("**Source:** `test-data/libuse/sources/<bucket>/dwg/`")
    lines.append("**Target:** `test-data/libuse/sources/<bucket>/dxf/`")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Bucket | Total | Converted | Skipped | Failed | Wall time (ms) |")
    lines.append("|--------|------:|----------:|--------:|-------:|---------------:|")
    g_t = g_c = g_s = g_f = g_ms = 0
    for bucket, s in summaries.items():
        lines.append(f"| `{bucket}` | {s.total} | {s.converted} | {s.skipped} | "
                     f"{s.failed} | {s.total_ms} |")
        g_t += s.total; g_c += s.converted; g_s += s.skipped
        g_f += s.failed; g_ms += s.total_ms
    lines.append(f"| **TOTAL** | **{g_t}** | **{g_c}** | **{g_s}** | **{g_f}** | **{g_ms}** |")
    lines.append("")

    lines.append("## Per-file log")
    lines.append("")
    lines.append("| Bucket | DWG filename | Status | DXF size (bytes) | Duration (ms) |")
    lines.append("|--------|------|--------|--------:|--------:|")
    for bucket, s in summaries.items():
        for r in s.results:
            try:
                size = r.dst.stat().st_size if r.dst.exists() else 0
            except OSError:
                size = 0
            lines.append(f"| {bucket} | `{r.src.name}` | {r.status} | {size:,} | {r.duration_ms} |")
    lines.append("")

    failures = [(b, r) for b, s in summaries.items() for r in s.results if r.status == "failed"]
    if failures:
        lines.append("## Failures (stderr tail)")
        lines.append("")
        for bucket, r in failures:
            lines.append(f"### {bucket} / {r.src.name}")
            lines.append("```")
            lines.append(r.stderr_tail or "(no stderr)")
            lines.append("```")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("_Generated by `phase_0_5_batch_convert.py`._")
    LOG_PATH.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
