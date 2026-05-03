"""
DWG → DXF batch converter (Phase 0.5).

Wraps an external CAD-conversion binary to transcode AutoCAD DWG drawings
into the open DXF format that ezdxf can parse natively.

Backend selection (auto-detected, override via STAVAGENT_DWG_BACKEND env):
    libredwg   — `dwg2dxf` from LibreDWG ≥ 0.13.4 (preferred, open source).
                 Build/install: see test-data/libuse/outputs/phase_0_5_poc.md.
    oda        — ODA File Converter via ezdxf.addons.odafc (registration gate).
    online_api — placeholder for CloudConvert / ConvertCAD (NotImplementedError).
    pdf_only   — sentinel; caller skips DWG and falls back to PDF measurement.

Reference: test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md (Phase 0.5)
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


class ConversionBackend(str, Enum):
    """Available DWG → DXF conversion strategies."""

    LIBREDWG = "libredwg"        # LibreDWG dwg2dxf (preferred, open source)
    ODA = "oda"                  # ODA File Converter (registration gate)
    ONLINE_API = "online_api"    # CloudConvert / ConvertCAD (TODO)
    PDF_ONLY = "pdf_only"        # Sentinel — skip DWG, use PDF parsing


@dataclass
class ConversionResult:
    dwg_path: Path
    dxf_path: Optional[Path]
    status: str          # "ok" | "failed" | "skipped"
    duration_ms: int
    backend: ConversionBackend
    stderr: Optional[str] = None
    error: Optional[str] = None


# Default per-file conversion timeout (seconds). Libuše půdorysy convert in <2s
# but kniha detailů files can be larger and slower.
DEFAULT_TIMEOUT_S = 60


def detect_backend() -> ConversionBackend:
    """Probe environment and pick the best available conversion backend.

    Order: env override → libredwg → ODA → PDF_ONLY (degraded).
    """
    env_choice = os.environ.get("STAVAGENT_DWG_BACKEND", "").strip().lower()
    if env_choice:
        try:
            return ConversionBackend(env_choice)
        except ValueError:
            logger.warning(
                "STAVAGENT_DWG_BACKEND=%r not a valid backend, ignoring", env_choice
            )

    if shutil.which("dwg2dxf"):
        return ConversionBackend.LIBREDWG

    try:
        from ezdxf.addons import odafc  # noqa: WPS433 — optional path
        if odafc.is_installed():
            return ConversionBackend.ODA
    except ImportError:
        pass

    logger.warning(
        "No DWG converter detected (dwg2dxf / ODA). Falling back to PDF_ONLY."
    )
    return ConversionBackend.PDF_ONLY


def convert_one(
    dwg_path: Path,
    dxf_dir: Path,
    *,
    backend: Optional[ConversionBackend] = None,
    timeout_s: int = DEFAULT_TIMEOUT_S,
) -> ConversionResult:
    """Convert a single DWG file to DXF.

    Args:
        dwg_path: Source DWG file.
        dxf_dir: Destination directory (output filename = source stem + .dxf).
        backend: Override auto-detected backend.
        timeout_s: Per-call subprocess timeout.

    Returns:
        ConversionResult with output path, status, timing and stderr excerpt.
    """
    backend = backend or detect_backend()
    dxf_dir.mkdir(parents=True, exist_ok=True)
    dxf_path = dxf_dir / f"{dwg_path.stem}.dxf"
    started = time.monotonic()

    if backend is ConversionBackend.LIBREDWG:
        result = _convert_libredwg(dwg_path, dxf_path, timeout_s)
    elif backend is ConversionBackend.ODA:
        result = _convert_oda(dwg_path, dxf_path, timeout_s)
    elif backend is ConversionBackend.PDF_ONLY:
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="skipped",
            duration_ms=0,
            backend=backend,
            error="PDF_ONLY backend — DWG conversion skipped by design",
        )
    else:
        raise NotImplementedError(f"Backend {backend.value!r} not implemented")

    result.duration_ms = int((time.monotonic() - started) * 1000)
    return result


def convert_batch(
    dwg_paths: Iterable[Path],
    dxf_dir: Path,
    *,
    backend: Optional[ConversionBackend] = None,
    timeout_s: int = DEFAULT_TIMEOUT_S,
) -> list[ConversionResult]:
    """Convert a directory of DWG files in batch, logging failures."""
    backend = backend or detect_backend()
    results: list[ConversionResult] = []
    for dwg_path in dwg_paths:
        try:
            res = convert_one(dwg_path, dxf_dir, backend=backend, timeout_s=timeout_s)
        except Exception as e:  # noqa: BLE001 — per-file isolation
            logger.exception("Unexpected error converting %s", dwg_path)
            res = ConversionResult(
                dwg_path=dwg_path,
                dxf_path=None,
                status="failed",
                duration_ms=0,
                backend=backend,
                error=f"{type(e).__name__}: {e}",
            )
        if res.status == "failed":
            logger.error("DWG → DXF failed for %s: %s", dwg_path.name, res.error)
        else:
            logger.info(
                "DWG → DXF %s for %s in %d ms (%s)",
                res.status,
                dwg_path.name,
                res.duration_ms,
                res.backend.value,
            )
        results.append(res)
    return results


def _convert_libredwg(
    dwg_path: Path, dxf_path: Path, timeout_s: int
) -> ConversionResult:
    cmd = ["dwg2dxf", "-y", "-o", str(dxf_path), str(dwg_path)]
    try:
        proc = subprocess.run(  # noqa: S603 — fixed argv, paths stringified
            cmd, capture_output=True, text=True, timeout=timeout_s, check=False
        )
    except subprocess.TimeoutExpired as e:
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="failed",
            duration_ms=timeout_s * 1000,
            backend=ConversionBackend.LIBREDWG,
            error=f"Timeout after {timeout_s}s",
            stderr=(e.stderr.decode("utf-8", "replace") if e.stderr else None),
        )
    except FileNotFoundError:
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="failed",
            duration_ms=0,
            backend=ConversionBackend.LIBREDWG,
            error="dwg2dxf binary not found on PATH",
        )

    # libredwg prints non-fatal "Warning:" lines on stderr even on success;
    # treat exit code + output file as the source of truth.
    if proc.returncode != 0 or not dxf_path.exists() or dxf_path.stat().st_size == 0:
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="failed",
            duration_ms=0,
            backend=ConversionBackend.LIBREDWG,
            error=f"dwg2dxf exit={proc.returncode}",
            stderr=_tail_stderr(proc.stderr),
        )

    return ConversionResult(
        dwg_path=dwg_path,
        dxf_path=dxf_path,
        status="ok",
        duration_ms=0,  # set by caller
        backend=ConversionBackend.LIBREDWG,
        stderr=_tail_stderr(proc.stderr),
    )


def _convert_oda(
    dwg_path: Path, dxf_path: Path, timeout_s: int
) -> ConversionResult:
    """ODA File Converter path via ezdxf addon. Kept as fallback."""
    try:
        from ezdxf.addons import odafc
    except ImportError:
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="failed",
            duration_ms=0,
            backend=ConversionBackend.ODA,
            error="ezdxf.addons.odafc not importable",
        )
    try:
        odafc.convert(
            source=str(dwg_path),
            dest=str(dxf_path),
            version="ACAD2018",
            audit=True,
        )
    except Exception as e:  # noqa: BLE001 — odafc raises a small zoo of errors
        return ConversionResult(
            dwg_path=dwg_path,
            dxf_path=None,
            status="failed",
            duration_ms=0,
            backend=ConversionBackend.ODA,
            error=f"{type(e).__name__}: {e}",
        )
    return ConversionResult(
        dwg_path=dwg_path,
        dxf_path=dxf_path,
        status="ok",
        duration_ms=0,
        backend=ConversionBackend.ODA,
    )


def _tail_stderr(stderr: Optional[str], max_lines: int = 5) -> Optional[str]:
    if not stderr:
        return None
    lines = stderr.strip().splitlines()
    return "\n".join(lines[-max_lines:])
