"""
DWG → DXF batch converter (Phase 0.5).

Wraps the ODA File Converter (free Open Design Alliance binary) to transcode
AutoCAD DWG drawings into the open DXF format that ezdxf can parse natively.

Reference: test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md (Phase 0.5)

Skeleton only — implementation lands in Session 1 once ODA binary is provisioned.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Iterable, Optional


class ConversionBackend(str, Enum):
    """Available DWG → DXF conversion strategies."""

    ODA = "oda"                  # ODA File Converter (preferred)
    LIBREDWG = "libredwg"        # libredwg-tools fallback
    ONLINE_API = "online_api"    # CloudConvert / ConvertCAD fallback
    PDF_ONLY = "pdf_only"        # Skip DWG entirely, fall back to PDF parsing


@dataclass
class ConversionResult:
    dwg_path: Path
    dxf_path: Optional[Path]
    status: str          # "ok" | "failed" | "skipped"
    duration_ms: int
    backend: ConversionBackend
    error: Optional[str] = None


def detect_backend() -> ConversionBackend:
    """Probe environment and pick the best available conversion backend.

    Order: ODA → libredwg → online API → PDF-only degraded mode.
    """
    raise NotImplementedError("Phase 0.5 implementation pending ODA install")


def convert_one(
    dwg_path: Path,
    dxf_dir: Path,
    *,
    backend: Optional[ConversionBackend] = None,
    dxf_version: str = "ACAD2018",
) -> ConversionResult:
    """Convert a single DWG file to DXF.

    Args:
        dwg_path: Source DWG file.
        dxf_dir: Destination directory (mirrors source layout).
        backend: Override auto-detected backend.
        dxf_version: Target DXF version string accepted by ODA Converter.

    Returns:
        ConversionResult with output path and timing.
    """
    raise NotImplementedError("Phase 0.5 implementation pending ODA install")


def convert_batch(
    dwg_paths: Iterable[Path],
    dxf_dir: Path,
    *,
    backend: Optional[ConversionBackend] = None,
) -> list[ConversionResult]:
    """Convert a directory of DWG files in batch, logging failures."""
    raise NotImplementedError("Phase 0.5 implementation pending ODA install")
