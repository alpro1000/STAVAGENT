"""
Document Schemas — Pydantic models for the add-document pipeline.

POST /api/v1/project/{id}/add-document
- DocType enum (14 document types)
- ProcessingStatus (7 states)
- DocumentIdentity (filename + doc_type + content_hash)
- MaterialEntry, VolumeEntry, DocumentFlag
- DocumentSummary (max detail extraction)
- DiffEntry, DocumentDiff (field-level changes)
- AddDocumentRequest, AddDocumentResponse

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-26
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# DocType — 14 document types
# ---------------------------------------------------------------------------
class DocType(str, Enum):
    SOUPIS_PRACI = "soupis_praci"           # Bill of quantities (Excel/XML)
    TZ_BETON = "tz_beton"                    # TZ: concrete works
    TZ_BEDNENI = "tz_bedneni"               # TZ: formwork
    TZ_VYZTUZE = "tz_vyztuze"               # TZ: reinforcement
    TZ_HYDROIZOLACE = "tz_hydroizolace"     # TZ: waterproofing
    TZ_ZEMNI_PRACE = "tz_zemni_prace"       # TZ: earthworks
    TZ_KOMUNIKACE = "tz_komunikace"         # TZ: roads & traffic
    TZ_MOSTY = "tz_mosty"                    # TZ: bridges
    TZ_ELEKTRO = "tz_elektro"               # TZ: electro
    TZ_ZTI = "tz_zti"                        # TZ: plumbing
    TZ_VZT = "tz_vzt"                        # TZ: HVAC
    TZ_UT = "tz_ut"                          # TZ: heating
    SITUACE = "situace"                      # Site plan (DXF/PDF)
    UNKNOWN = "unknown"                      # Undetected


# ---------------------------------------------------------------------------
# ProcessingStatus — 7 states
# ---------------------------------------------------------------------------
class ProcessingStatus(str, Enum):
    UPLOADED = "uploaded"
    DETECTING = "detecting"
    PARSING = "parsing"
    WAITING_MINERU = "waiting_mineru"        # Async: PDF queued in MinerU
    SUMMARIZING = "summarizing"
    COMPLETE = "complete"
    ERROR = "error"


# ---------------------------------------------------------------------------
# DocumentIdentity — unique key = filename + doc_type
# ---------------------------------------------------------------------------
class DocumentIdentity(BaseModel):
    filename: str
    doc_type: DocType = DocType.UNKNOWN
    content_hash: str = ""                   # SHA-256 of file content
    file_size: int = 0
    uploaded_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    @property
    def key(self) -> str:
        """Unique key for matching: filename::doc_type"""
        from pathlib import Path
        sanitized_filename = Path(self.filename).name
        return f"{sanitized_filename}::{self.doc_type.value}"


# ---------------------------------------------------------------------------
# Summary sub-models
# ---------------------------------------------------------------------------
class MaterialEntry(BaseModel):
    name: str
    spec: Optional[str] = None               # e.g. "C30/37 XC4 XD1"
    quantity: Optional[float] = None
    unit: Optional[str] = None


class VolumeEntry(BaseModel):
    description: str
    value: float
    unit: str


class DocumentFlag(BaseModel):
    severity: str = "info"                   # info / warning / error
    message: str
    source: Optional[str] = None             # which field or section


# ---------------------------------------------------------------------------
# DocumentSummary — max detail extraction per document
# ---------------------------------------------------------------------------
class DocumentSummary(BaseModel):
    doc_type: DocType = DocType.UNKNOWN
    title: Optional[str] = None
    description: Optional[str] = None

    # Soupis prací fields
    positions_count: int = 0
    total_price: Optional[float] = None
    chapters: List[str] = Field(default_factory=list)

    # TZ fields
    materials: List[MaterialEntry] = Field(default_factory=list)
    volumes: List[VolumeEntry] = Field(default_factory=list)
    key_requirements: List[str] = Field(default_factory=list)
    standards: List[str] = Field(default_factory=list)           # ČSN refs

    # AI enrichment (Gemini/Vertex AI)
    ai_summary: Optional[str] = None         # AI-generated description
    ai_materials: List[MaterialEntry] = Field(default_factory=list)
    ai_volumes: List[VolumeEntry] = Field(default_factory=list)
    ai_risks: List[str] = Field(default_factory=list)
    ai_model_used: Optional[str] = None      # e.g. "gemini-2.5-flash"
    ai_confidence: float = 0.0               # 0.0 = no AI, 0.5-0.9 = AI enriched

    # Universal
    flags: List[DocumentFlag] = Field(default_factory=list)
    searchable_text: Optional[str] = None    # First ~2000 chars for search
    raw_extraction: Dict[str, Any] = Field(default_factory=dict) # Full parsed data


# ---------------------------------------------------------------------------
# DiffEntry — one field change
# ---------------------------------------------------------------------------
class DiffEntry(BaseModel):
    field: str
    old_value: Any = None
    new_value: Any = None
    significance: str = "low"                # low / medium / high

    @property
    def is_significant(self) -> bool:
        return self.significance in ("medium", "high")


class DocumentDiff(BaseModel):
    """Diff between old and new version of the same document."""
    document_key: str                        # filename::doc_type
    is_update: bool = False
    content_changed: bool = False            # hash differs?
    changes: List[DiffEntry] = Field(default_factory=list)
    previous_hash: Optional[str] = None
    new_hash: Optional[str] = None


# ---------------------------------------------------------------------------
# Cross-validation (TZ ↔ Soupis)
# ---------------------------------------------------------------------------
class CrossValidationIssue(BaseModel):
    severity: str = "warning"                # info / warning / error
    category: str = ""                       # material_mismatch / missing_position / standard_gap
    tz_reference: Optional[str] = None       # What TZ says
    soupis_reference: Optional[str] = None   # What soupis says (or "chybí")
    message: str = ""


class CrossValidationResult(BaseModel):
    """Result of TZ ↔ Soupis cross-validation."""
    validated: bool = False
    issues: List[CrossValidationIssue] = Field(default_factory=list)
    tz_materials_count: int = 0
    soupis_materials_count: int = 0
    coverage_score: float = 0.0              # 0.0-1.0: how well soupis covers TZ


# ---------------------------------------------------------------------------
# API Request / Response
# ---------------------------------------------------------------------------
class NormComplianceSummary(BaseModel):
    """Lightweight norm compliance summary for add-document response."""
    score: float = 0.0                       # 0.0-1.0
    total_checked: int = 0
    passed: int = 0
    warnings: int = 0
    violations: int = 0
    norms_referenced: List[str] = Field(default_factory=list)
    top_findings: List[Dict[str, Any]] = Field(default_factory=list)  # Top 5 findings


class AddDocumentResponse(BaseModel):
    success: bool = True
    project_id: str
    status: ProcessingStatus = ProcessingStatus.COMPLETE
    identity: DocumentIdentity
    summary: Optional[DocumentSummary] = None
    diff: Optional[DocumentDiff] = None
    cross_validation: Optional[CrossValidationResult] = None
    norm_compliance: Optional[NormComplianceSummary] = None
    message: str = ""
    version: int = 1                         # project.json version after update
