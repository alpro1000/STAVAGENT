"""
DXF parser (Phase 0.5).

Extracts deterministic geometry from DXF drawings: room codes (TEXT/MTEXT),
enclosing polylines (room polygons), and INSERT blocks for windows/doors.

Reference: test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md (Phase 0.5 KROK 3)

Skeleton only — implementation in Session 1.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# Room code pattern from spec: A.1.4.02, D.2.3.01, etc.
ROOM_CODE_RE = r"[A-D]\.\d\.\d\.\d{2}"
# Window/door block pattern: W01, D21, etc.
OPENING_BLOCK_RE = r"^(W|D)\d{2}$"


@dataclass
class RoomGeometry:
    code: str                       # e.g. "D.1.4.02"
    position: tuple[float, float]   # text insert point in DXF units
    plocha_m2: Optional[float] = None
    obvod_m: Optional[float] = None
    polyline_layer: Optional[str] = None


@dataclass
class Opening:
    kod: str                        # e.g. "W01"
    position: tuple[float, float]
    block_name: str
    rozmery_mm: Optional[str] = None
    attribs: dict[str, str] = field(default_factory=dict)


@dataclass
class DxfExtraction:
    dxf_path: Path
    rooms: list[RoomGeometry]
    otvory: list[Opening]
    layers: list[str]
    units: str                      # "mm" | "m" — read from $INSUNITS header
    drawing_extents: Optional[tuple[float, float, float, float]] = None
    warnings: list[str] = field(default_factory=list)


def parse_dxf_drawing(dxf_path: Path) -> DxfExtraction:
    """Parse a single DXF file into structured geometry.

    Steps:
        1. ezdxf.readfile(dxf_path)
        2. Walk modelspace, collect TEXT/MTEXT matching ROOM_CODE_RE.
        3. For each room, find the enclosing LWPOLYLINE/POLYLINE (closed) and
           build a shapely Polygon → area (m²) + perimeter (m).
        4. Collect INSERT entities matching OPENING_BLOCK_RE with attribs.
        5. Return DxfExtraction.
    """
    raise NotImplementedError("Phase 0.5 implementation in Session 1")


def find_enclosing_polyline(modelspace, point: tuple[float, float]):
    """Return the smallest closed polyline containing `point`, or None."""
    raise NotImplementedError("Phase 0.5 implementation in Session 1")


def detect_units(doc) -> str:
    """Read $INSUNITS from DXF header. Returns 'mm' or 'm'."""
    raise NotImplementedError("Phase 0.5 implementation in Session 1")
