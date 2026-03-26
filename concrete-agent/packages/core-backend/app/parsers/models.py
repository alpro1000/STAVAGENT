"""
Parsed Document Models — Universal data structures for all construction document formats.

All parsers output ParsedDocument containing ParsedSO → ParsedChapter → ParsedPosition.
This normalization allows uniform processing regardless of input format.

Author: STAVAGENT Team
Version: 5.0.0
Date: 2026-03-26
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from decimal import Decimal


class SourceFormat(str, Enum):
    XLSX_KOMPLET = "xlsx_komplet"
    XLSX_RTSROZP = "xlsx_rtsrozp"
    XML_OTSKP = "xml_otskp"
    XML_TSKP = "xml_tskp"
    IFC = "ifc"
    DXF = "dxf"
    PDF_TZ = "pdf_tz"
    PDF_ROZPOCET = "pdf_rozpocet"


class RowType(str, Enum):
    CHAPTER = "chapter"
    POSITION = "position"
    VV_LINE = "vv_line"
    SPEC = "spec"
    NOTE = "note"
    TOTAL = "total"


class ParsedPosition(BaseModel):
    """One position (work item) — normalized from any format."""

    pc: Optional[str] = None
    chapter_code: Optional[str] = None
    chapter_name: Optional[str] = None
    so_id: Optional[str] = None
    so_name: Optional[str] = None

    code: Optional[str] = None
    description: str = ""
    specification: Optional[str] = None
    url: Optional[str] = None

    unit: Optional[str] = None
    quantity: Optional[Decimal] = None
    vv_lines: List[Dict[str, Any]] = Field(default_factory=list)

    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    price_source: Optional[str] = None
    vat_rate: Optional[int] = None

    source_format: Optional[SourceFormat] = None
    source_sheet: Optional[str] = None
    source_row: Optional[int] = None
    confidence: float = 1.0


class ParsedChapter(BaseModel):
    """Chapter / section of bill of quantities."""
    code: str = ""
    name: str = ""
    so_id: Optional[str] = None
    positions: List[ParsedPosition] = Field(default_factory=list)
    total_price: Optional[Decimal] = None


class ParsedSO(BaseModel):
    """Construction object — contains chapters and positions."""
    so_id: str = ""
    so_name: str = ""
    chapters: List[ParsedChapter] = Field(default_factory=list)
    source_sheet: Optional[str] = None


class ParsedDocument(BaseModel):
    """Universal output from every parser."""

    project_id: Optional[str] = None
    project_name: Optional[str] = None
    client: Optional[str] = None
    date: Optional[str] = None

    source_format: SourceFormat
    source_file: Optional[str] = None

    stavebni_objekty: List[ParsedSO] = Field(default_factory=list)

    @property
    def all_positions(self) -> List[ParsedPosition]:
        positions = []
        for so in self.stavebni_objekty:
            for chapter in so.chapters:
                positions.extend(chapter.positions)
        return positions

    positions_count: int = 0
    coverage_pct: float = 0.0
    parser_warnings: List[str] = Field(default_factory=list)
