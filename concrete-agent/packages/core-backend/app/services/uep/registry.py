"""
UEP extractor registry — file path → extractor instance.

Single registration table for every PR1 extractor. Extension point for
PR3 DWG / IFC / XML extractors. Uses suffix matching only (no MIME
sniffing) per task §3.1 input format mapping. Routing helpers also do
filename heuristics for TZ PDFs (PDF without filename clues falls back
to PDF_TZ — the only PDF extractor in PR1).

NOT a separate registry implementation — this is the UEP-format routing
layer. The existing `services/extractor_registry.py` is for regex
extraction rules inside a single source; the two coexist.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.1
"""
from __future__ import annotations

import re
from pathlib import Path

from app.models.uep_schemas import SourceFormat
from app.services.uep.dxf_extractor import DxfExtractor
from app.services.uep.extractor_base import BaseExtractor
from app.services.uep.pdf_tz_extractor import PdfTzExtractor


# Filename heuristics for PDF sub-routing. PR1 only handles PDF_TZ; the
# other PDF flavours (tables, drawings, geology) are placeholders that the
# registry will be wired to in PR3.
_TZ_FILENAME_HINT = re.compile(
    r"(?:^|[_\-\s])(tz|technick\w*\s*zpr\w*|technical\s*report)(?:[_\-\s\.]|$)",
    re.IGNORECASE,
)


# Extension → SourceFormat baseline routing. The format then resolves to
# an extractor class via `_EXTRACTORS`. Lower-cased ext.
_EXT_FORMAT = {
    ".dxf": SourceFormat.DXF,
    ".pdf": SourceFormat.PDF_TZ,  # PR1: every PDF → TZ. PR3 splits by filename hint.
}


_EXTRACTORS: dict[SourceFormat, type[BaseExtractor]] = {
    SourceFormat.DXF: DxfExtractor,
    SourceFormat.PDF_TZ: PdfTzExtractor,
}


def detect_format(path: Path) -> SourceFormat | None:
    """Resolve a file path to its UEP source format, or `None` when unsupported.

    Suffix-first; PDF filename hint reserved for PR3 sub-routing. Returns
    `None` for files outside PR1 scope (DWG / IFC / XLSX / XML) so the
    caller can flag the gap explicitly instead of silently misrouting.
    """
    suffix = path.suffix.lower()
    fmt = _EXT_FORMAT.get(suffix)
    if fmt is None:
        return None
    # PDF hint reserved for PR3 — keep the branch for forward-compat.
    if fmt == SourceFormat.PDF_TZ and _TZ_FILENAME_HINT.search(path.name):
        return SourceFormat.PDF_TZ
    return fmt


def get_extractor(path: Path) -> BaseExtractor | None:
    """Return an extractor instance for `path` or `None` if unsupported."""
    fmt = detect_format(path)
    if fmt is None:
        return None
    klass = _EXTRACTORS.get(fmt)
    if klass is None:
        return None
    return klass()


def list_supported_formats() -> list[SourceFormat]:
    """Formats wired in PR1. Order is stable for diagnostics output."""
    return [SourceFormat.DXF, SourceFormat.PDF_TZ]
