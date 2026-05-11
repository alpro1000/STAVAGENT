"""DWG → DXF conversion — pipeline-importable wrapper.

Thin Python API around the cross-project converter at
`scripts/infrastructure/dwg_to_dxf_batch.py` (which itself wraps
`/usr/local/bin/dwg2dxf` from LibreDWG). Pipeline modules import
from here instead of subprocess-shelling — type-checked, return
dataclasses, no parsing of stderr text.

See:
- scripts/infrastructure/build_libredwg.sh — how dwg2dxf is built
- scripts/infrastructure/LIBREDWG_BUILD.md — version + warnings
- scripts/infrastructure/dwg_to_dxf_batch.py — CLI implementation
- concrete-agent/.../scripts/phase_0_5_batch_convert.py — Libuše wrapper

Example:

    from app.infrastructure.dwg_converter import (
        ensure_dwg2dxf_available, convert_dwg_to_dxf, convert_batch,
    )

    if not ensure_dwg2dxf_available():
        raise RuntimeError("dwg2dxf unavailable")

    result = convert_dwg_to_dxf(Path("foo.dwg"), Path("foo.dxf"))
    assert result.success

    summary = convert_batch(Path("sources/D/dwg"), Path("sources/D/dxf"))
    print(f"{summary.converted}/{summary.total} OK in {summary.total_ms} ms")
"""
from __future__ import annotations

import importlib.util
import shutil
from dataclasses import dataclass
from pathlib import Path

# Resolve scripts/infrastructure/dwg_to_dxf_batch.py from this file's location:
# concrete-agent/packages/core-backend/app/infrastructure/dwg_converter.py
#   parents[0] = infrastructure
#   parents[1] = app
#   parents[2] = core-backend
#   parents[3] = packages
#   parents[4] = concrete-agent
#   parents[5] = REPO_ROOT
_INFRA_BATCH = (
    Path(__file__).resolve().parents[5]
    / "scripts" / "infrastructure" / "dwg_to_dxf_batch.py"
)


def _load_batch_module():
    """Import dwg_to_dxf_batch.py without polluting sys.path.

    Registers the module in sys.modules before exec_module() — required
    for @dataclass to resolve via sys.modules[cls.__module__].
    """
    import sys
    module_name = "_dwg_to_dxf_batch_internal"
    if module_name in sys.modules:
        return sys.modules[module_name]
    if not _INFRA_BATCH.exists():
        raise FileNotFoundError(
            f"Cross-project converter not found: {_INFRA_BATCH}. "
            "Repository layout broken?"
        )
    spec = importlib.util.spec_from_file_location(module_name, _INFRA_BATCH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {_INFRA_BATCH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ConversionResult:
    """Result of a single DWG → DXF conversion."""
    src: Path
    dst: Path
    status: str           # "converted" | "skipped_uptodate" | "failed"
    duration_ms: int
    stderr_tail: str = ""

    @property
    def success(self) -> bool:
        return self.status in ("converted", "skipped_uptodate")


@dataclass(frozen=True)
class BatchResult:
    """Result of `convert_batch()` over a directory."""
    converted: int
    skipped: int
    failed: int
    total_ms: int
    results: tuple[ConversionResult, ...]

    @property
    def total(self) -> int:
        return self.converted + self.skipped + self.failed

    @property
    def all_succeeded(self) -> bool:
        return self.failed == 0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ensure_dwg2dxf_available() -> bool:
    """Check whether `dwg2dxf` is on PATH; build it if not.

    Idempotent: fast-path skips when already installed.

    Returns True on success, False if the build script failed.
    """
    return _load_batch_module().ensure_dwg2dxf_available()


def convert_dwg_to_dxf(dwg_path: Path, dxf_path: Path) -> ConversionResult:
    """Convert a single DWG file to DXF.

    Creates parent directories of `dxf_path` if needed. Always
    overwrites an existing destination (no skip logic — for batch
    skip-on-mtime use `convert_batch()`).

    Raises RuntimeError if dwg2dxf is not available.
    """
    if not shutil.which("dwg2dxf"):
        if not ensure_dwg2dxf_available():
            raise RuntimeError(
                "dwg2dxf unavailable and build_libredwg.sh failed; see "
                "scripts/infrastructure/LIBREDWG_BUILD.md"
            )
    file_result = _load_batch_module().convert_one(dwg_path, dxf_path)
    return ConversionResult(
        src=file_result.src, dst=file_result.dst, status=file_result.status,
        duration_ms=file_result.duration_ms,
        stderr_tail=file_result.stderr_tail,
    )


def convert_batch(input_dir: Path, output_dir: Path,
                  *, skip_existing: bool = True,
                  recursive: bool = False) -> BatchResult:
    """Convert every DWG in `input_dir` to a DXF in `output_dir`.

    Args:
      input_dir: directory holding *.dwg files.
      output_dir: where to write *.dxf files (created if missing).
      skip_existing: if True (default), skip when DXF mtime ≥ DWG mtime.
      recursive: if True, walk sub-directories of `input_dir` and mirror
        the layout under `output_dir`.

    Raises RuntimeError if dwg2dxf is not available.
    """
    if not shutil.which("dwg2dxf"):
        if not ensure_dwg2dxf_available():
            raise RuntimeError(
                "dwg2dxf unavailable and build_libredwg.sh failed; see "
                "scripts/infrastructure/LIBREDWG_BUILD.md"
            )
    summary = _load_batch_module().run(
        input_dir=input_dir,
        output_dir=output_dir,
        recursive=recursive,
        force=not skip_existing,
        log_path=None,
    )
    return BatchResult(
        converted=summary.converted,
        skipped=summary.skipped,
        failed=summary.failed,
        total_ms=summary.total_ms,
        results=tuple(
            ConversionResult(
                src=r.src, dst=r.dst, status=r.status,
                duration_ms=r.duration_ms,
                stderr_tail=r.stderr_tail,
            )
            for r in summary.results
        ),
    )
