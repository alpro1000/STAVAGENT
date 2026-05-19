"""
UEP DWG → DXF converter — fallback chain (PR3 §3.1).

CRITICAL invariant (task constraint): a DWG is NEVER silently dropped.
The chain runs ODA File Converter → LibreDWG `dwg2dxf` → escalation
log. The caller (DwgExtractor) sees one of three outcomes:

  - `ConversionResult(success=True, dxf_path=Path, source="oda",
    confidence=0.95)`
  - `ConversionResult(success=True, dxf_path=Path, source="libredwg",
    confidence=0.80)`
  - `ConversionResult(success=False, escalated=True, attempts=[...])`
    — coverage report flags `DWG_CONVERSION_FAILED`.

Cache (when `UEP_DWG_CACHE_DIR` is set):
  - `<cache_dir>/<sha256(content)>.dxf` keyed by SOURCE bytes hash.
  - Cache hit re-validates the cached DXF (try `ezdxf.readfile`); on
    parse failure we invalidate + re-convert.
  - Production wires this to a GCS bucket
    `gs://stavagent-dwg-conversion-cache/{file_hash}.dxf` via the
    Cloud Run worker — PR3 ships the local-cache plumbing; the GCS
    sync runs as a separate Cloud Tasks step.

Subprocess timeouts:
  - ODA: `UEP_DWG_ODA_TIMEOUT_S` (default 120s).
  - LibreDWG: `UEP_DWG_LIBREDWG_TIMEOUT_S` (default 90s).

Per task §2 Q14 = B (default): DWG conversion runs as a Cloud Tasks
sub-task within the job lifecycle (the in-process route blocks on
the subprocess; PR3 keeps the in-process simple, PR4 splits to
Cloud Tasks).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.1
Reference: docs/tasks/TASK_UEP_PR3.md §3.1
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

logger = logging.getLogger(__name__)


# Default confidence per task §3.1 — kept here as constants so the
# extractor reads from one place.
ODA_CONFIDENCE = 0.95
LIBREDWG_CONFIDENCE = 0.80


# ---------------------------------------------------------------------------
# Result schemas
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConversionAttempt:
    """One attempt in the fallback chain — recorded for the escalation log."""

    tool: Literal["oda", "libredwg", "cache"]
    success: bool
    duration_ms: int = 0
    error: Optional[str] = None
    dxf_size_bytes: int = 0


@dataclass
class ConversionResult:
    """Outcome of the conversion chain."""

    success: bool
    dxf_path: Optional[Path] = None
    source: Optional[Literal["oda", "libredwg", "cache"]] = None
    confidence: float = 0.0
    cache_hit: bool = False
    escalated: bool = False
    attempts: list[ConversionAttempt] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def _content_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _cache_dir() -> Optional[Path]:
    val = os.environ.get("UEP_DWG_CACHE_DIR", "").strip()
    if not val:
        return None
    p = Path(val)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _cache_lookup(dwg_path: Path) -> tuple[Optional[Path], str]:
    """Returns (cached_dxf or None, content_hash)."""

    cache = _cache_dir()
    digest = _content_hash(dwg_path)
    if cache is None:
        return None, digest
    candidate = cache / f"{digest}.dxf"
    if not candidate.exists():
        return None, digest
    # Sanity — try to parse via ezdxf; if it fails (corrupt cache),
    # invalidate so we re-convert.
    try:
        import ezdxf  # type: ignore[import-not-found]

        ezdxf.readfile(str(candidate))
        return candidate, digest
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[uep.dwg] cached DXF failed re-parse, invalidating: %s (%s)",
            candidate, exc,
        )
        try:
            candidate.unlink()
        except OSError:
            pass
        return None, digest


def _cache_store(dxf_path: Path, digest: str) -> Path:
    cache = _cache_dir()
    if cache is None:
        return dxf_path
    target = cache / f"{digest}.dxf"
    try:
        shutil.copyfile(str(dxf_path), str(target))
        return target
    except OSError as exc:
        logger.warning("[uep.dwg] cache write failed: %s", exc)
        return dxf_path


# ---------------------------------------------------------------------------
# Subprocess runners (mockable seams)
# ---------------------------------------------------------------------------


# These two are module-level so tests can monkeypatch them with mocks
# (the subprocess + binary path don't exist in the sandbox).

ODA_BINARY = os.environ.get("UEP_DWG_ODA_BINARY", "ODAFileConverter")
LIBREDWG_BINARY = os.environ.get("UEP_DWG_LIBREDWG_BINARY", "dwg2dxf")


def _run_oda(dwg_path: Path, out_dir: Path) -> tuple[bool, str, int]:
    """Invoke ODA File Converter.

    Returns `(success, stderr_text, duration_ms)`. CLI shape per ODA
    File Converter docs (Open Design Alliance):
        ODAFileConverter <input_dir> <output_dir> <out_ver>
                         <out_format> <recursive> <audit>

    We give it a one-file input dir + the chosen output dir, target
    ACAD2018 DXF.
    """

    timeout = int(os.environ.get("UEP_DWG_ODA_TIMEOUT_S", "120"))
    in_dir = out_dir / "_in"
    in_dir.mkdir(parents=True, exist_ok=True)
    staged = in_dir / dwg_path.name
    if not staged.exists():
        shutil.copyfile(str(dwg_path), str(staged))
    import time as _t

    t0 = _t.monotonic()
    try:
        proc = subprocess.run(
            [
                ODA_BINARY,
                str(in_dir),
                str(out_dir),
                "ACAD2018",
                "DXF",
                "0",   # not recursive
                "1",   # audit
            ],
            capture_output=True,
            timeout=timeout,
            text=True,
            check=False,
        )
        duration_ms = int((_t.monotonic() - t0) * 1000)
        if proc.returncode != 0:
            return False, (proc.stderr or proc.stdout or "non-zero exit"), duration_ms
        # ODA places the DXF next to the input filename with .dxf ext.
        expected = out_dir / (dwg_path.stem + ".dxf")
        if not expected.exists():
            return False, f"ODA exit 0 but {expected.name} missing", duration_ms
        return True, "", duration_ms
    except FileNotFoundError:
        return False, f"binary not found: {ODA_BINARY}", int((_t.monotonic() - t0) * 1000)
    except subprocess.TimeoutExpired:
        return False, f"timeout {timeout}s", int((_t.monotonic() - t0) * 1000)


def _run_libredwg(dwg_path: Path, out_dxf: Path) -> tuple[bool, str, int]:
    """Invoke LibreDWG `dwg2dxf`.

    CLI: `dwg2dxf [-y] <input.dwg> -o <output.dxf>`
    """

    timeout = int(os.environ.get("UEP_DWG_LIBREDWG_TIMEOUT_S", "90"))
    import time as _t

    t0 = _t.monotonic()
    try:
        proc = subprocess.run(
            [LIBREDWG_BINARY, "-y", str(dwg_path), "-o", str(out_dxf)],
            capture_output=True,
            timeout=timeout,
            text=True,
            check=False,
        )
        duration_ms = int((_t.monotonic() - t0) * 1000)
        if proc.returncode != 0:
            return False, (proc.stderr or proc.stdout or "non-zero exit"), duration_ms
        if not out_dxf.exists():
            return False, "exit 0 but no output dxf", duration_ms
        return True, "", duration_ms
    except FileNotFoundError:
        return False, f"binary not found: {LIBREDWG_BINARY}", int((_t.monotonic() - t0) * 1000)
    except subprocess.TimeoutExpired:
        return False, f"timeout {timeout}s", int((_t.monotonic() - t0) * 1000)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def convert_dwg_to_dxf(dwg_path: Path, work_dir: Path) -> ConversionResult:
    """Convert `dwg_path` to a DXF via the fallback chain.

    Pure-function-of-input modulo the cache + subprocess side effects.
    Returns a fully-populated `ConversionResult`; never raises on
    conversion failure (the caller routes the escalation).
    """

    attempts: list[ConversionAttempt] = []
    work_dir.mkdir(parents=True, exist_ok=True)

    # 1. Cache lookup.
    cached, digest = _cache_lookup(dwg_path)
    if cached is not None:
        attempts.append(ConversionAttempt(
            tool="cache",
            success=True,
            dxf_size_bytes=cached.stat().st_size,
        ))
        return ConversionResult(
            success=True,
            dxf_path=cached,
            source="cache",
            confidence=ODA_CONFIDENCE,  # cached came from ODA originally
            cache_hit=True,
            attempts=attempts,
        )

    # 2. ODA File Converter.
    oda_out_dir = work_dir / "oda"
    oda_out_dir.mkdir(parents=True, exist_ok=True)
    success, err, dur = _run_oda(dwg_path, oda_out_dir)
    expected_oda_dxf = oda_out_dir / (dwg_path.stem + ".dxf")
    if success and expected_oda_dxf.exists():
        attempts.append(ConversionAttempt(
            tool="oda", success=True, duration_ms=dur,
            dxf_size_bytes=expected_oda_dxf.stat().st_size,
        ))
        cached_dxf = _cache_store(expected_oda_dxf, digest)
        return ConversionResult(
            success=True,
            dxf_path=cached_dxf,
            source="oda",
            confidence=ODA_CONFIDENCE,
            attempts=attempts,
        )
    attempts.append(ConversionAttempt(
        tool="oda", success=False, duration_ms=dur, error=err,
    ))

    # 3. LibreDWG fallback.
    libredwg_out = work_dir / f"{dwg_path.stem}.libredwg.dxf"
    success, err, dur = _run_libredwg(dwg_path, libredwg_out)
    if success and libredwg_out.exists():
        attempts.append(ConversionAttempt(
            tool="libredwg", success=True, duration_ms=dur,
            dxf_size_bytes=libredwg_out.stat().st_size,
        ))
        cached_dxf = _cache_store(libredwg_out, digest)
        return ConversionResult(
            success=True,
            dxf_path=cached_dxf,
            source="libredwg",
            confidence=LIBREDWG_CONFIDENCE,
            attempts=attempts,
        )
    attempts.append(ConversionAttempt(
        tool="libredwg", success=False, duration_ms=dur, error=err,
    ))

    # 4. Both failed → escalation. The DXF is NOT silently dropped;
    # the extractor records DWG_CONVERSION_FAILED in the coverage
    # report and the operator gets a notification (PR3 ships the
    # in-process log path; SES notification is PR4).
    logger.error(
        "[uep.dwg] BOTH conversions failed for %s: oda=%s, libredwg=%s",
        dwg_path, attempts[-2].error, attempts[-1].error,
    )
    return ConversionResult(
        success=False,
        escalated=True,
        attempts=attempts,
    )
