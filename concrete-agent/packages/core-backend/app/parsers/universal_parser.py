"""
Universal Parser — single entry point for all construction document formats.

Supported formats:
  .xlsx → Export Komplet OR #RTSROZP# (auto-detected)
  .xml  → OTSKP price catalog OR TSKP classification
  .ifc  → BIM model (quantities)
  .dxf  → CAD drawing (dimensions)
  .dwg  → auto-converts to DXF
  .pdf  → TZ (parameters) OR tabular budget

Usage:
  from app.parsers.universal_parser import parse_any
  doc = parse_any("path/to/file.xlsx")
  print(doc.positions_count, doc.coverage_pct)

Author: STAVAGENT Team
Version: 5.0.0
Date: 2026-03-26
"""

import logging
from pathlib import Path

from app.parsers.format_detector import detect_format
from app.parsers.models import ParsedDocument, SourceFormat

logger = logging.getLogger(__name__)


def parse_any(file_path: str) -> ParsedDocument:
    """
    Main entry — parses ANY supported construction document format.
    Returns ParsedDocument with normalized positions.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    fmt = detect_format(file_path)
    logger.info(f"Detected format: {fmt} for {path.name}")

    if fmt == SourceFormat.XLSX_KOMPLET:
        from app.parsers.xlsx_komplet_parser import parse_xlsx_komplet
        return parse_xlsx_komplet(file_path)

    elif fmt == SourceFormat.XLSX_RTSROZP:
        from app.parsers.xlsx_rtsrozp_parser import parse_xlsx_rtsrozp
        return parse_xlsx_rtsrozp(file_path)

    elif fmt == SourceFormat.XML_OTSKP:
        return _stub_doc(fmt, file_path, "XML OTSKP parser — use xml_otskp_parser directly")

    elif fmt == SourceFormat.XML_TSKP:
        return _stub_doc(fmt, file_path, "XML TSKP parser — use tskpParserService (Node.js)")

    elif fmt == SourceFormat.IFC:
        return _stub_doc(fmt, file_path, "IFC parser — requires ifcopenshell")

    elif fmt == SourceFormat.DXF:
        return _stub_doc(fmt, file_path, "DXF parser — requires ezdxf")

    elif fmt == SourceFormat.PDF_TZ:
        return _stub_doc(fmt, file_path, "PDF TZ parser — use document_processor pipeline")

    elif fmt == SourceFormat.PDF_ROZPOCET:
        return _stub_doc(fmt, file_path, "PDF budget parser — tabular extraction")

    raise NotImplementedError(f"Parser for {fmt} not implemented")


def _stub_doc(fmt: SourceFormat, file_path: str, warning: str) -> ParsedDocument:
    """Create a stub document for formats not yet fully integrated."""
    doc = ParsedDocument(
        source_format=fmt,
        source_file=file_path,
    )
    doc.parser_warnings.append(warning)
    return doc
