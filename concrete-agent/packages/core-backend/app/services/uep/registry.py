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
from app.services.uep.dwg_extractor import DwgExtractor
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
# an extractor class via `_EXTRACTORS`. Lower-cased ext. PR3 wires
# DWG / IFC / XML extensions; PR4 wires gbXML.
_EXT_FORMAT = {
    ".dxf": SourceFormat.DXF,
    ".dwg": SourceFormat.DWG,
    ".ifc": SourceFormat.IFC,
    ".pdf": SourceFormat.PDF_TZ,  # PR1: every PDF → TZ. PR3 splits by filename hint.
    ".xml": SourceFormat.XML_GENERIC,  # PR3 sub-router below dispatches to UNIXML/LandXML/gbXML.
}


def _try_lazy_import(name: str):
    """Lazy import — returns class or None when the extractor module
    isn't wired yet (early commits of PR3 land extractors one-by-one)."""

    try:
        if name == "IfcExtractor":
            from app.services.uep.ifc_extractor import IfcExtractor
            return IfcExtractor
        if name == "UnixmlExtractor":
            from app.services.uep.unixml_extractor import UnixmlExtractor
            return UnixmlExtractor
        if name == "LandXmlExtractor":
            from app.services.uep.landxml_extractor import LandXmlExtractor
            return LandXmlExtractor
    except ImportError:
        return None
    return None


def _build_extractors_table() -> dict[SourceFormat, type[BaseExtractor]]:
    table: dict[SourceFormat, type[BaseExtractor]] = {
        SourceFormat.DXF: DxfExtractor,
        SourceFormat.PDF_TZ: PdfTzExtractor,
        SourceFormat.DWG: DwgExtractor,
    }
    ifc_cls = _try_lazy_import("IfcExtractor")
    if ifc_cls is not None:
        table[SourceFormat.IFC] = ifc_cls
    unixml_cls = _try_lazy_import("UnixmlExtractor")
    if unixml_cls is not None:
        table[SourceFormat.XML_UNIXML] = unixml_cls
    landxml_cls = _try_lazy_import("LandXmlExtractor")
    if landxml_cls is not None:
        table[SourceFormat.XML_LANDXML] = landxml_cls
    return table


# XML sub-router — peeks at the first 1 KB of an XML file to decide
# whether it's UNIXML (KROS soupis), LandXML (civil), gbXML (PR4), or
# generic. Per task §3.4–3.5 the decision is namespace-based.
_XML_NAMESPACES = [
    (re.compile(rb"polozk|cenova[_\-\s]*soustav|stavba", re.IGNORECASE),
     SourceFormat.XML_UNIXML),
    (re.compile(rb"landxml\.org", re.IGNORECASE),
     SourceFormat.XML_LANDXML),
    (re.compile(rb"gbxml\.org", re.IGNORECASE),
     SourceFormat.XML_GBXML),
]


def _detect_xml_subformat(path: Path) -> SourceFormat:
    """Peek at the first 4 KB to classify generic XML → specific format.

    Falls back to XML_GENERIC when no namespace matches — the generic
    bucket is unsupported in PR3 + flagged by the registry (None
    extractor) so the operator sees the gap explicitly.
    """

    try:
        with path.open("rb") as fp:
            head = fp.read(4096)
    except OSError:
        return SourceFormat.XML_GENERIC
    for pattern, fmt in _XML_NAMESPACES:
        if pattern.search(head):
            return fmt
    return SourceFormat.XML_GENERIC


def detect_format(path: Path) -> SourceFormat | None:
    """Resolve a file path to its UEP source format, or `None` when unsupported.

    Suffix-first routing. For ambiguous extensions (XML), the sub-
    router inspects the file head to pick the right flavour. Returns
    `None` for formats with no registered extractor so the caller can
    flag the gap explicitly instead of silently misrouting.
    """
    suffix = path.suffix.lower()
    fmt = _EXT_FORMAT.get(suffix)
    if fmt is None:
        return None
    if fmt == SourceFormat.XML_GENERIC:
        return _detect_xml_subformat(path)
    if fmt == SourceFormat.PDF_TZ and _TZ_FILENAME_HINT.search(path.name):
        return SourceFormat.PDF_TZ
    return fmt


def get_extractor(path: Path) -> BaseExtractor | None:
    """Return an extractor instance for `path` or `None` if unsupported."""
    fmt = detect_format(path)
    if fmt is None:
        return None
    table = _build_extractors_table()
    klass = table.get(fmt)
    if klass is None:
        return None
    return klass()


def list_supported_formats() -> list[SourceFormat]:
    """Formats wired in the current PR. Order is stable for diagnostics."""

    return sorted(_build_extractors_table().keys(), key=lambda f: f.value)
