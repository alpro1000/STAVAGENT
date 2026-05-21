"""
UEP (Universal Extraction Pipeline) Pydantic schemas — Phase 1 + Phase 2.

Universal per-source extraction record + coverage matrix runtime types,
following the canonical task `docs/TASK_DocumentExtraction_Universal_Pipeline.md`.

Naming follows existing concrete-agent conventions:
- `*_schemas.py` per model module (cf. `audit_schemas.py`, `extraction_schemas.py`).
- Pydantic v2 (`BaseModel`, `Field`, `model_config`).
- Czech domain terms preserved (`pokryto`, `chybi`, `castecne`).
- The task §0 uses the phrase "per-source extractor adapter pattern" — the
  repo's existing term is **extractor** (`services/extractor_registry.py`,
  `services/regex_extractor.py`, `services/regex_norm_extractor.py`,
  `services/extraction_to_facts_bridge.py`), so this module sticks with
  "extractor" everywhere.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3, §7
Reference: test-data/RD_Jachymov_dum/tools/dxf_comprehensive_extract.py
           (canonical DXF entity-type coverage in lieu of the unsubmitted
           SKILL_stavagent_dxf_exhaustive.md)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Source format enum — every UEP extractor declares its source format.
# ---------------------------------------------------------------------------


class SourceFormat(str, Enum):
    """Input file format handled by a per-source extractor."""

    DXF = "dxf"
    DWG = "dwg"             # PR3 — placeholder for extractor contract
    IFC = "ifc"             # PR3
    PDF_TZ = "pdf_tz"
    PDF_TABLE = "pdf_table"  # PR3
    PDF_DRAWING = "pdf_drawing"  # PR3 (raster, Vision)
    XLSX_SOUPIS = "xlsx_soupis"  # PR2/3 reuse existing parsers
    XML_UNIXML = "xml_unixml"    # PR3
    XML_LANDXML = "xml_landxml"  # PR3
    XML_GBXML = "xml_gbxml"      # PR3
    XML_GENERIC = "xml_generic"  # PR3
    PDF_GEOLOGY = "pdf_geology"  # PR3
    # Synthetic source — Workflow A's passport_schema.MergedSO emitted
    # via app/services/uep/passport_adapter.py. Read-only Phase 1
    # source (PR2 task §3.7, Q12 = A).
    PASSPORT_SCHEMA = "passport_schema"


# ---------------------------------------------------------------------------
# Per-source extraction record — universal output shape from every extractor.
# ---------------------------------------------------------------------------


class SourceProvenance(BaseModel):
    """File-level provenance attached to every extracted fact."""

    source_file: str = Field(..., description="Original filename or path the fact came from.")
    source_format: SourceFormat
    extractor: str = Field(
        ..., description="Extractor identifier, e.g. 'uep.dxf_extractor'."
    )
    extractor_version: str = Field(default="1.0")


class ExtractedFact(BaseModel):
    """A single fact produced by an extractor — universal cross-format shape.

    Facts are the unit of evidence the coverage matrix and (downstream) the
    reconciliation engine consume. Extractor-specific raw payloads stay under
    `evidence` so consumers can trace numbers back to the source.
    """

    category: str = Field(
        ..., description="Coverage matrix category key (e.g. 'rooms', 'wall_lengths')."
    )
    field: str = Field(
        ..., description="Field name within category (e.g. 'area_m2', 'count')."
    )
    value: Any = Field(..., description="Extracted value — scalar, list, or dict.")
    unit: Optional[str] = Field(
        default=None, description="Unit symbol (m, m2, m3, ks, bm, °C, kN/m²)."
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    evidence: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Extractor-specific evidence: entity handle, layer, regex pattern, "
            "page number, table cell — anything that lets a human reverse the "
            "extraction back to the source."
        ),
    )


class PerSourceExtraction(BaseModel):
    """Output of one extractor run on one source file.

    Conforms to UEP Phase 1 contract: per-file independent extraction, no
    cross-source merge, no derivation. The downstream coverage engine (Phase 2)
    and reconciliation engine (Phase 3, PR2) consume these records.
    """

    provenance: SourceProvenance
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="File-level confidence (per task §3.1 band per format).",
    )
    parse_duration_ms: int = Field(default=0, ge=0)
    facts: list[ExtractedFact] = Field(
        default_factory=list,
        description="Universal facts feeding coverage + reconciliation.",
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Extractor-native raw payload. Shape is extractor-specific. "
            "For DXF see dxf_comprehensive_extract.py for the canonical shape."
        ),
    )
    decode_warnings: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Non-fatal extraction warnings (self-intersecting polygon, "
            "MTEXT format glitch, recovered DXF, etc.). NEVER silently dropped."
        ),
    )
    extractor_error: Optional[str] = Field(
        default=None,
        description=(
            "Set when extractor could not produce a valid extraction at all. "
            "Coverage matrix sees this as gap, NOT silent skip."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "provenance": {
                    "source_file": "RD Jachymov dum.dxf",
                    "source_format": "dxf",
                    "extractor": "uep.dxf_extractor",
                    "extractor_version": "1.0",
                },
                "confidence": 0.95,
                "parse_duration_ms": 1234,
                "facts": [
                    {
                        "category": "rooms",
                        "field": "count",
                        "value": 12,
                        "unit": "ks",
                        "confidence": 0.95,
                        "evidence": {"layer": "IP_obrysy místností", "n_closed_polygons": 12},
                    }
                ],
                "data": {"layers": [], "entities": [], "blocks_inventory": []},
                "decode_warnings": [],
            }
        }
    }


# ---------------------------------------------------------------------------
# Coverage matrix — runtime config + report types.
# ---------------------------------------------------------------------------


class CoverageStatus(str, Enum):
    """Status of a single coverage matrix category after Phase 2."""

    POKRYTO = "pokryto"          # Fact(s) present from at least one source.
    CASTECNE = "castecne"        # Some required fields filled, some missing.
    CHYBI = "chybi"              # No data found in any source.
    SKIP = "skip"                # Category not applicable to this project type.


class CoverageRequirement(BaseModel):
    """Per-category requirement — what an extractor has to produce so the
    category counts as `pokryto`.

    Loaded from the YAML matrix file.
    """

    category: str
    label_cs: str
    required_fields: list[str] = Field(default_factory=list)
    expected_sources: list[SourceFormat] = Field(
        default_factory=list,
        description=(
            "Source formats that could legitimately populate this category. "
            "Coverage gate uses this for source-route diagnostics."
        ),
    )
    optional: bool = Field(
        default=False,
        description=(
            "When true, `chybi` does NOT block the gate — only flags as soft warning. "
            "Used for categories like 'roof_drainage_points' that aren't always "
            "in every drawing set."
        ),
    )
    project_types: list[str] = Field(
        default_factory=lambda: ["residential"],
        description=(
            "Project types this requirement applies to. Loader filters per "
            "selected project_type so single matrix file can hold multiple types."
        ),
    )
    notes: Optional[str] = None


class CoverageCategoryReport(BaseModel):
    """Per-category outcome after walking every PerSourceExtraction."""

    category: str
    label_cs: str
    status: CoverageStatus
    filled_fields: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    contributing_sources: list[str] = Field(
        default_factory=list,
        description="source_file values that contributed facts to this category.",
    )
    fact_count: int = 0
    optional: bool = False
    notes: Optional[str] = None


class CoverageReport(BaseModel):
    """Phase 2 output — universal anti-omission gate."""

    project_type: str
    matrix_file: str
    project_id: Optional[str] = None
    total_categories: int = 0
    pokryto_count: int = 0
    castecne_count: int = 0
    chybi_count: int = 0
    skip_count: int = 0
    pokryto_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    blocking_gaps: list[str] = Field(
        default_factory=list,
        description=(
            "Categories with status=chybi and optional=false. Phase 2 gate "
            "blocks downstream phases unless this list is empty (or user "
            "explicitly overrides per task §1.2)."
        ),
    )
    categories: list[CoverageCategoryReport] = Field(default_factory=list)

    def gate_passed(self) -> bool:
        """True when there are no blocking gaps — coverage gate may release."""
        return len(self.blocking_gaps) == 0
