#!/usr/bin/env python3
"""dwg_to_dxf_batch.py — generic DWG→DXF batch converter for STAVAGENT.

Wraps `dwg2dxf` (LibreDWG) for any STAVAGENT pipeline that needs DXF input.
Calls scripts/infrastructure/build_libredwg.sh first if the binary is
missing.

Usage:
    # Convert one directory's DWGs to a sibling output directory
    python dwg_to_dxf_batch.py --input-dir sources/D/dwg \\
                                --output-dir sources/D/dxf

    # Recurse over all per-objekt + shared dwg/ subfolders
    python dwg_to_dxf_batch.py --input-dir sources \\
                                --output-dir sources \\
                                --recursive

    # Force re-conversion (ignore mtime check)
    python dwg_to_dxf_batch.py --input-dir sources/D/dwg \\
                                --output-dir sources/D/dxf --force

    # Custom log location
    python dwg_to_dxf_batch.py --input-dir sources/D/dwg \\
                                --output-dir sources/D/dxf \\
                                --log conversion.log

Exit codes:
    0   all conversions succeeded (or skipped as up-to-date)
    1   at least one conversion failed (other succeeded)
    2   build_libredwg.sh failed — dwg2dxf unavailable
    3   no DWG files found in input-dir
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

DWG2DXF_BIN = "dwg2dxf"
BUILD_SCRIPT = Path(__file__).parent / "build_libredwg.sh"


@dataclass
class FileResult:
    src: Path
    dst: Path
    status: str  # "converted" | "skipped_uptodate" | "failed"
    duration_ms: int = 0
    stderr_tail: str = ""


@dataclass
class BatchSummary:
    converted: int = 0
    skipped: int = 0
    failed: int = 0
    total_ms: int = 0
    results: list[FileResult] = field(default_factory=list)

    @property
    def total(self) -> int:
        return self.converted + self.skipped + self.failed


def ensure_dwg2dxf_available() -> bool:
    """Return True if dwg2dxf is on PATH; otherwise try to build it."""
    if shutil.which(DWG2DXF_BIN):
        return True
    if not BUILD_SCRIPT.exists():
        print(f"ERROR: {BUILD_SCRIPT} not found", file=sys.stderr)
        return False
    print(f"[dwg_to_dxf_batch] dwg2dxf not found — invoking {BUILD_SCRIPT.name}",
          file=sys.stderr)
    rc = subprocess.run(["bash", str(BUILD_SCRIPT)], check=False).returncode
    if rc != 0:
        print(f"ERROR: build_libredwg.sh exited with code {rc}", file=sys.stderr)
        return False
    return shutil.which(DWG2DXF_BIN) is not None


def find_dwg_files(input_dir: Path, recursive: bool) -> list[Path]:
    if not input_dir.exists():
        return []
    pattern = "**/*.dwg" if recursive else "*.dwg"
    # Case-insensitive: also pick up .DWG (rare on Linux but safe)
    files = sorted(set(p for p in input_dir.glob(pattern)))
    files += sorted(set(p for p in input_dir.glob(pattern.replace(".dwg", ".DWG"))))
    return sorted(set(files))


def derive_dst(src: Path, input_root: Path, output_root: Path,
               recursive: bool) -> Path:
    """Compute destination DXF path mirroring the input layout."""
    rel = src.relative_to(input_root) if recursive else Path(src.name)
    return output_root / rel.with_suffix(".dxf")


def is_up_to_date(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return False
    return dst.stat().st_mtime >= src.stat().st_mtime and dst.stat().st_size > 0


def convert_one(src: Path, dst: Path) -> FileResult:
    dst.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.monotonic()
    proc = subprocess.run(
        [DWG2DXF_BIN, "-y", str(src), "-o", str(dst)],
        capture_output=True, text=True, check=False,
    )
    duration_ms = int((time.monotonic() - t0) * 1000)
    if proc.returncode == 0 and dst.exists() and dst.stat().st_size > 0:
        return FileResult(src, dst, "converted", duration_ms)
    return FileResult(
        src, dst, "failed", duration_ms,
        stderr_tail=(proc.stderr or "").strip().splitlines()[-3:] and
                    "\n".join((proc.stderr or "").strip().splitlines()[-3:]) or
                    f"exit {proc.returncode}",
    )


def run(input_dir: Path, output_dir: Path, *, recursive: bool,
        force: bool, log_path: Path | None) -> BatchSummary:
    summary = BatchSummary()
    sources = find_dwg_files(input_dir, recursive)
    if not sources:
        print(f"No DWG files found under {input_dir}", file=sys.stderr)
        return summary

    t_start = time.monotonic()
    for src in sources:
        dst = derive_dst(src, input_dir, output_dir, recursive)
        if not force and is_up_to_date(src, dst):
            summary.results.append(FileResult(src, dst, "skipped_uptodate"))
            summary.skipped += 1
            continue
        result = convert_one(src, dst)
        summary.results.append(result)
        if result.status == "converted":
            summary.converted += 1
        else:
            summary.failed += 1
    summary.total_ms = int((time.monotonic() - t_start) * 1000)

    _print_report(summary, log_path)
    return summary


def _print_report(summary: BatchSummary, log_path: Path | None) -> None:
    lines: list[str] = []
    lines.append("DWG → DXF batch conversion report")
    lines.append(f"  Total: {summary.total}")
    lines.append(f"  Converted: {summary.converted}")
    lines.append(f"  Skipped (up-to-date): {summary.skipped}")
    lines.append(f"  Failed: {summary.failed}")
    lines.append(f"  Total wall time: {summary.total_ms} ms")
    if summary.failed:
        lines.append("\nFailures:")
        for r in summary.results:
            if r.status == "failed":
                lines.append(f"  - {r.src}: {r.stderr_tail or '(no stderr)'}")
    text = "\n".join(lines)
    print(text, file=sys.stderr)
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(text + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="dwg_to_dxf_batch",
                                     description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input-dir", type=Path, required=True,
                        help="Directory containing *.dwg files")
    parser.add_argument("--output-dir", type=Path, required=True,
                        help="Destination directory for *.dxf files")
    parser.add_argument("--recursive", action="store_true",
                        help="Recurse into sub-directories of --input-dir")
    parser.add_argument("--force", action="store_true",
                        help="Always reconvert even if DXF is newer than DWG")
    parser.add_argument("--log", type=Path, default=None,
                        help="Optional path for conversion log")
    args = parser.parse_args(argv)

    if not ensure_dwg2dxf_available():
        return 2

    summary = run(args.input_dir, args.output_dir,
                  recursive=args.recursive, force=args.force,
                  log_path=args.log)
    if summary.total == 0:
        return 3
    return 1 if summary.failed else 0


if __name__ == "__main__":
    sys.exit(main())
