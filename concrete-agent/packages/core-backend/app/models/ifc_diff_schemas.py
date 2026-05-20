"""
UEP IFC version tracking + diff report schemas — PR4b-1 foundation.

Models for storing successive IFC uploads of the same project and the
basic deterministic diff between them (add / remove / modify by
GlobalId + per-category entity counts). Advanced layers — quantity
deltas, material composition diff, property set diff, severity
classification, AI narrative — are PR4b-2 / PR5 extensions and slot
into the `report_payload` open dict so the table schema does not have
to change again.

The diff engine itself lives at `app/services/uep/ifc_diff_engine.py`
(separate from extraction, separate from schemas — single
responsibility per task §15.3.4).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.3.4
Reference: docs/tasks/TASK_UEP_PR4.md §3.3
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Per-entity snapshot — what we persist per IfcRoot subtype instance so a
# later diff has a comparable representation. Captured by the IFC extractor
# during the same pass that emits ExtractedFact records (PR4b-1 extension
# of `ifc_extractor.py`).
# ---------------------------------------------------------------------------


class IfcEntitySnapshot(BaseModel):
    """Frozen per-entity representation for diff purposes.

    The snapshot is keyed by GlobalId because that is the only stable
    identity carrier across IFC exports of the same model (per IFC4
    §5.1.3.1.7). Name/tag/Object Placement are all volatile under round
    trips through Revit/Allplan/ArchiCAD.

    `payload_hash` is the diff engine's "modified" detector — any change
    to the snapshot fields below shifts the hash and the diff classifies
    the entity as `modified`.
    """

    global_id: str = Field(..., description="IFC GUID (22-char base64). Stable across exports.")
    ifc_type: str = Field(
        ..., description="IfcWall / IfcSlab / IfcBeam / IfcColumn / IfcFooting / IfcDoor / IfcWindow / IfcSpace / IfcSite / IfcBuilding / IfcBuildingStorey."
    )
    name: Optional[str] = Field(default=None, description="`Name` attribute, may be None.")
    object_type: Optional[str] = Field(
        default=None, description="`ObjectType` attribute (Revit family type, Allplan smart object type)."
    )
    storey_global_id: Optional[str] = Field(
        default=None,
        description="GlobalId of containing IfcBuildingStorey (resolved via IfcRelContainedInSpatialStructure).",
    )
    quantities: dict[str, float] = Field(
        default_factory=dict,
        description=(
            "Aggregated IfcElementQuantity values keyed by quantity name "
            "(e.g. 'NetArea', 'GrossVolume', 'Length'). PR4b-1 captures the "
            "raw values; PR4b-2 computes per-type aggregate deltas."
        ),
    )
    material_layers: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Ordered IfcMaterialLayerSet entries: [{name, thickness_m, "
            "material_global_id?}, ...]. Empty list for entities without "
            "an associated layer set. PR4b-2 turns this into per-entity "
            "material composition diff."
        ),
    )
    property_sets: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description=(
            "{pset_name: {prop_name: value}} from IfcRelDefinesByProperties. "
            "PR4b-2 turns this into per-entity Pset diff."
        ),
    )
    payload_hash: str = Field(
        ...,
        description=(
            "SHA-256 of canonical-JSON({ifc_type, name, object_type, "
            "storey_global_id, quantities, material_layers, property_sets}). "
            "Diff engine compares hashes to detect `modified` entities."
        ),
    )


# ---------------------------------------------------------------------------
# Version metadata — one row per successful IFC upload of the same
# project. Old extraction stays available for future diffs without
# re-running the extractor.
# ---------------------------------------------------------------------------


class IfcVersionMetadata(BaseModel):
    """Persisted metadata for one IFC upload.

    Lives in the `ifc_versions` DB table (Alembic migration
    `2026_05_20_uep_ifc_versions_and_diff_reports`). Snapshots live in
    a sibling JSONB column so a diff query does not have to round-trip
    through the full ExtractedFact list.
    """

    version_id: str = Field(..., description="UUID, table PK.")
    project_id: str = Field(..., description="UUID of the owning project (FK to projects.id).")
    job_id: Optional[str] = Field(
        default=None,
        description="UUID of the uep_jobs row that produced this snapshot (nullable for manual imports).",
    )
    file_name: str = Field(..., description="Original uploaded filename.")
    file_size_bytes: int = Field(..., ge=0)
    schema_version: str = Field(
        ..., description="IFC schema string from the file (IFC2X3, IFC4, IFC4X1, IFC4X3)."
    )
    streaming_strategy: str = Field(
        ..., description="full | partial | strict — chosen by `pick_streaming_strategy`."
    )
    upload_timestamp: datetime = Field(..., description="UTC, server-side.")
    entity_counts: dict[str, int] = Field(
        default_factory=dict,
        description="Raw IfcOpenShell counts by IfcType (mirror of extractor `_count_by_type`).",
    )
    entity_snapshots: list[IfcEntitySnapshot] = Field(
        default_factory=list,
        description="Full per-entity snapshots — input to the diff engine.",
    )


# ---------------------------------------------------------------------------
# Diff report — output of `compute_basic_ifc_diff(old_version, new_version)`.
# PR4b-1 fills add/remove/modify + per-category counts; PR4b-2 fills the
# advanced fields inside `report_payload`.
# ---------------------------------------------------------------------------


class IfcChangeSeverity(str, Enum):
    """Coarse change severity tag.

    PR4b-1 emits `unscored` for every report (the basic diff has no
    rules to classify severity). PR4b-2 populates the other values per
    the rule table in task §3.3 (cosmetic = description/property-only,
    minor < 5 % quantity delta, moderate 5-20 %, major > 20 %,
    scope_change = entity counts shifted by category).
    """

    UNSCORED = "unscored"
    COSMETIC = "cosmetic"
    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"
    SCOPE_CHANGE = "scope_change"


class IfcCategoryCount(BaseModel):
    """Per-IfcType count delta — count(new) - count(old).

    Categories track *all* IFC types observed in either version, even
    when one side has zero, so a clean read of "what changed in numbers"
    is possible without rejoining the snapshots.
    """

    ifc_type: str
    old_count: int = Field(..., ge=0)
    new_count: int = Field(..., ge=0)
    delta: int = Field(
        ..., description="new_count - old_count (signed; negative = entities removed)."
    )


class IfcEntityChange(BaseModel):
    """One per entity that appears in add / remove / modify lists.

    `change_kind` matches the basic-diff three-bucket model. Modified
    entities carry both old and new snapshots so PR4b-2 quantity/
    material/property comparators can read them straight from this
    record (no extra DB round trip).
    """

    change_kind: str = Field(..., description="added | removed | modified.")
    ifc_type: str
    global_id: str
    old_snapshot: Optional[IfcEntitySnapshot] = Field(
        default=None, description="None when change_kind=added."
    )
    new_snapshot: Optional[IfcEntitySnapshot] = Field(
        default=None, description="None when change_kind=removed."
    )


class IfcDiffReport(BaseModel):
    """Top-level diff report — persisted in `ifc_diff_reports.report_payload`.

    The DB table also stores `old_version_id` / `new_version_id` FKs and
    `severity` / `total_added` / `total_removed` / `total_modified` as
    flat columns for indexed querying — see Alembic migration.
    """

    diff_id: str = Field(..., description="UUID, table PK.")
    project_id: str
    old_version_id: str
    new_version_id: str
    generated_at: datetime
    severity: IfcChangeSeverity = Field(default=IfcChangeSeverity.UNSCORED)
    total_added: int = Field(..., ge=0)
    total_removed: int = Field(..., ge=0)
    total_modified: int = Field(..., ge=0)
    category_counts: list[IfcCategoryCount] = Field(
        default_factory=list,
        description="One entry per IfcType observed in either version.",
    )
    entity_changes: list[IfcEntityChange] = Field(
        default_factory=list,
        description="add/remove/modify entries — full per-entity audit trail.",
    )
    report_payload: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Open dict for PR4b-2 + PR5 fields without touching the DB "
            "schema: `quantity_deltas_by_type`, `material_composition_changes`, "
            "`property_set_changes`, `severity_rules_fired`, `ai_narrative`."
        ),
    )
    diff_engine_version: str = Field(
        default="1.0", description="Diff engine semver — bump when rules change."
    )
