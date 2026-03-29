"""
Unified Item Layer — Pydantic schemas for project items (smetné pozice).

Provides a single permanent identifier for each budget position across all kiosks.
Each kiosk writes to its own namespace block; blocks are isolated.

Code systems: OTSKP (transport), ÚRS (civil), RTS (regional).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-28
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Code system (coding classification system)
# ---------------------------------------------------------------------------
class CodeSystem(str, Enum):
    OTSKP = "otskp"        # Oborový třídník (transport/infrastructure)
    URS = "urs"             # ÚRS Praha (civil construction)
    RTS = "rts"             # Regionální technologický standard
    UNKNOWN = "unknown"     # Not yet determined


# ---------------------------------------------------------------------------
# Namespace — who owns which data block
# ---------------------------------------------------------------------------
class Namespace(str, Enum):
    ESTIMATE = "estimate"       # Smetné data from Excel (Registry imports)
    MONOLIT = "monolit"         # Monolit kiosk concrete parameters
    CLASSIFICATION = "classification"  # URS/OTSKP classification & work group
    CORE = "core"               # Core Engine metadata (auto-managed)


# ---------------------------------------------------------------------------
# Hierarchy level
# ---------------------------------------------------------------------------
class HierarchyLevel(BaseModel):
    """Position in the SO → oddíl → skupina → pozice hierarchy."""
    so_id: Optional[str] = None
    so_name: Optional[str] = None
    oddil_code: Optional[str] = None        # HSV/PSV section code
    oddil_name: Optional[str] = None
    skupina_code: Optional[str] = None      # Work group code (first 3 digits)
    skupina_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Code detection result
# ---------------------------------------------------------------------------
class CodeDetectionResult(BaseModel):
    """Result of auto-detecting which code system a code belongs to."""
    code_system: CodeSystem
    code_normalized: str                     # Numeric part only, no spaces
    code_raw: str                            # Original as in Excel
    confidence: float = Field(ge=0.0, le=1.0)
    detection_method: str = ""               # "otskp_db", "regex_structure", "prefix_letter", "ai"
    hierarchy: Optional[HierarchyLevel] = None
    otskp_match: Optional[Dict[str, Any]] = None  # If found in OTSKP catalog


# ---------------------------------------------------------------------------
# Estimate data block (from Excel/Registry)
# ---------------------------------------------------------------------------
class EstimateData(BaseModel):
    """Smetné data — owned by Registry (Excel import)."""
    kod: str = ""
    popis: str = ""
    popis_detail: Optional[str] = None
    mnozstvi: Optional[float] = None
    mj: str = ""
    cena_jednotkova: Optional[float] = None
    cena_celkem: Optional[float] = None
    specification: Optional[str] = None
    price_source: Optional[str] = None      # "CS URS 2025 02", "RTS 25/I"
    vv_lines: Optional[List[Dict[str, Any]]] = None  # Quantity calculations
    sheet_name: Optional[str] = None
    row_index: Optional[int] = None


# ---------------------------------------------------------------------------
# Monolit data block
# ---------------------------------------------------------------------------
class MonolitData(BaseModel):
    """Monolit kiosk data — concrete parameters, costs."""
    monolit_position_id: Optional[str] = None
    monolit_project_id: Optional[str] = None
    part_name: Optional[str] = None
    subtype: Optional[str] = None           # Concrete class, steel grade
    concrete_m3: Optional[float] = None
    crew_size: Optional[int] = None
    wage_czk_ph: Optional[float] = None
    shift_hours: Optional[float] = None
    days: Optional[float] = None
    labor_hours: Optional[float] = None
    cost_czk: Optional[float] = None
    unit_cost_on_m3: Optional[float] = None
    kros_unit_czk: Optional[float] = None
    kros_total_czk: Optional[float] = None
    curing_days: Optional[int] = None
    monolit_url: Optional[str] = None
    calculated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Classification data block
# ---------------------------------------------------------------------------
class ClassificationData(BaseModel):
    """Classification result — work group, enrichment from catalog."""
    code_system: CodeSystem = CodeSystem.UNKNOWN
    code_normalized: Optional[str] = None
    detection_confidence: float = 0.0
    detection_method: Optional[str] = None
    skupina: Optional[str] = None           # Work group (BETON_MONOLIT, etc.)
    skupina_confidence: float = 0.0
    skupina_method: Optional[str] = None    # "rule", "regex", "ai", "manual"
    # Enrichment from OTSKP/URS catalog
    standard_name: Optional[str] = None     # Name from catalog
    hierarchy: Optional[HierarchyLevel] = None
    otskp_price: Optional[float] = None
    otskp_unit: Optional[str] = None


# ---------------------------------------------------------------------------
# Core metadata block (auto-managed)
# ---------------------------------------------------------------------------
class CoreMetadata(BaseModel):
    """Core Engine metadata — auto-managed, read-only for kiosks."""
    version: int = 1
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    estimate_filled: bool = False
    monolit_filled: bool = False
    classification_filled: bool = False
    deleted_in_reimport: bool = False        # Missing from new version of file
    source_file: Optional[str] = None
    # Grouping: linked positions (beton + armatura + opalubka)
    group_leader_id: Optional[str] = None    # If this is rebar/formwork, points to parent beton
    group_role: Optional[str] = None         # "beton", "armatura", "opalubka", None
    group_members: Optional[List[str]] = None  # If this is beton, list of linked item_ids
    armatura_included: bool = False          # "vč. výztuže" detected in description
    opalubka_included: bool = False          # "vč. bednění" detected in description


# ---------------------------------------------------------------------------
# Full item (read response)
# ---------------------------------------------------------------------------
class ProjectItem(BaseModel):
    """Complete project item with all namespace blocks."""
    item_id: str                             # Permanent UUID
    project_id: str                          # Project reference
    # Namespace blocks
    estimate: EstimateData = Field(default_factory=EstimateData)
    monolit: Optional[MonolitData] = None
    classification: Optional[ClassificationData] = None
    core: CoreMetadata = Field(default_factory=CoreMetadata)


# ---------------------------------------------------------------------------
# API request/response models
# ---------------------------------------------------------------------------

class ItemImportRow(BaseModel):
    """Single row from Excel import."""
    kod: str = ""
    popis: str = ""
    popis_detail: Optional[str] = None
    mnozstvi: Optional[float] = None
    mj: str = ""
    cena_jednotkova: Optional[float] = None
    cena_celkem: Optional[float] = None
    specification: Optional[str] = None
    price_source: Optional[str] = None
    vv_lines: Optional[List[Dict[str, Any]]] = None
    sheet_name: Optional[str] = None
    row_index: Optional[int] = None
    # Hierarchy
    so_id: Optional[str] = None
    so_name: Optional[str] = None
    oddil_code: Optional[str] = None
    oddil_name: Optional[str] = None


class BulkImportRequest(BaseModel):
    """Request to import positions from Excel."""
    project_id: str
    source_file: Optional[str] = None
    items: List[ItemImportRow]


class BulkImportResponse(BaseModel):
    """Response from bulk import."""
    project_id: str
    total: int
    created: int
    updated: int
    unchanged: int
    items: List[ProjectItem]


class ItemFilterRequest(BaseModel):
    """Filters for reading items."""
    skupina: Optional[str] = None           # Work group filter
    code_system: Optional[CodeSystem] = None
    has_monolit: Optional[bool] = None       # True = only filled, False = only empty
    has_classification: Optional[bool] = None
    keyword: Optional[str] = None            # Search in popis
    so_id: Optional[str] = None


class UpdateBlockRequest(BaseModel):
    """Request to update a namespace block."""
    namespace: Namespace
    data: Dict[str, Any]


class UpdateBlockResponse(BaseModel):
    """Response from block update."""
    item_id: str
    namespace: str
    updated: bool
    item: ProjectItem


class ItemVersionEntry(BaseModel):
    """A version snapshot of an item's estimate data."""
    version: int
    changed_at: str
    changed_fields: List[str]
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
