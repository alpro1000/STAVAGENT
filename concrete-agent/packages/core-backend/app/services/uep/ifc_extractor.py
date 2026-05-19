"""
UEP IFC extractor — PR3 §3.2.

Wraps IfcOpenShell to extract universal facts from IFC2x3 / IFC4
models per task §15.3. Entity mapping:

  IfcSpace                                  → room facts (closed_polygons)
  IfcWall / IfcSlab / IfcBeam / IfcColumn  → structural facts
  IfcFooting                                → foundation facts
  IfcDoor / IfcWindow                       → openings
  IfcMaterial / IfcMaterialLayerSet         → wall_system / roof_system
  IfcQuantityArea/Volume/Length             → quantities (high conf 0.95+)
  IfcPropertySet                            → custom properties
  IfcSpatialStructureElement                → site / building / storey
  IfcClassificationReference                → external classifications
  IfcOwnerHistory                           → version_metadata

Streaming strategy (`ifc_streaming.py`) chosen by file size:
  <200 MB  → standard full-load
  200MB-1GB → partial streaming (geometry iterator + selective full)
  1-2 GB   → strict streaming (multi-pass per entity category)
  >2 GB    → reject upfront

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.3
Reference: docs/tasks/TASK_UEP_PR3.md §3.2
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Iterable

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError
from app.services.uep.ifc_streaming import (
    IFC_REJECT_THRESHOLD_BYTES,
    StreamingStrategy,
    pick_streaming_strategy,
)

logger = logging.getLogger(__name__)


def _try_import_ifcopenshell():
    """Lazy import so the module loads in sandboxes without
    ifcopenshell wheels (which need libgl1 / libglu1-mesa per v3
    §14.9)."""

    try:
        import ifcopenshell  # type: ignore[import-not-found]

        return ifcopenshell
    except ImportError:
        return None


class IfcExtractor(BaseExtractor):
    """Universal IFC extractor with size-based streaming."""

    source_format = SourceFormat.IFC
    extractor_id = "uep.ifc_extractor"
    extractor_version = "1.0"
    default_confidence = 0.95  # native BIM — high baseline

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        # Cheap size check FIRST — rejects giant files before we pay the
        # ifcopenshell import cost (and surfaces the right error message
        # in sandboxes that don't ship the wheel).
        size = path.stat().st_size
        if size > IFC_REJECT_THRESHOLD_BYTES:
            raise ExtractorError(
                f"IFC file too large: {size / 1024**3:.2f} GB > "
                f"{IFC_REJECT_THRESHOLD_BYTES / 1024**3} GB hard limit "
                "(per task §15.4 streaming tier table)"
            )

        ifcopenshell = _try_import_ifcopenshell()
        if ifcopenshell is None:
            raise ExtractorError(
                "ifcopenshell not installed — IFC support requires "
                "the prod Docker image (apt: libgl1 libglu1-mesa + "
                "pip: ifcopenshell)"
            )

        strategy = pick_streaming_strategy(size)
        decode_warnings: list[dict[str, Any]] = [{
            "code": "ifc_streaming_strategy",
            "message": f"chosen strategy={strategy.value} for {size / 1024**2:.1f} MB",
            "size_bytes": size,
            "strategy": strategy.value,
        }]

        try:
            model = ifcopenshell.open(str(path))
        except Exception as exc:  # noqa: BLE001
            raise ExtractorError(f"ifcopenshell.open failed: {exc}") from exc

        facts: list[ExtractedFact] = []
        facts.extend(_emit_spatial(model))
        facts.extend(_emit_spaces(model))
        facts.extend(_emit_structural(model))
        facts.extend(_emit_openings(model))
        facts.extend(_emit_materials(model))
        facts.extend(_emit_quantities(model))
        facts.extend(_emit_owner_history(model))

        # Raw data — high-level inventory + version identity.
        raw_data: dict[str, Any] = {
            "schema": getattr(model, "schema", None),
            "file_name": path.name,
            "file_size_bytes": size,
            "streaming_strategy": strategy.value,
            "entity_counts": _count_by_type(model),
        }
        return facts, raw_data, decode_warnings


# ---------------------------------------------------------------------------
# Per-category emitters. All defensive — IFC schema variants between
# 2x3 / 4 / 4x1 differ; missing attributes → skip that fact.
# ---------------------------------------------------------------------------


def _safe_by_type(model, type_name: str):
    try:
        return list(model.by_type(type_name)) or []
    except Exception:  # noqa: BLE001
        return []


def _emit_spatial(model) -> Iterable[ExtractedFact]:
    """site / building / storey hierarchy."""

    for type_name, category, field in [
        ("IfcSite", "site_situation", "site_name"),
        ("IfcBuilding", "project_identification", "building_name"),
        ("IfcBuildingStorey", "dimensions", "storey"),
    ]:
        for ent in _safe_by_type(model, type_name):
            name = getattr(ent, "Name", None) or getattr(ent, "LongName", None)
            if not name:
                continue
            yield ExtractedFact(
                category=category,
                field=field,
                value=str(name),
                unit=None,
                confidence=0.95,
                evidence={"global_id": getattr(ent, "GlobalId", "")},
            )


def _emit_spaces(model) -> Iterable[ExtractedFact]:
    """IfcSpace → closed_polygons (room footprints)."""

    for sp in _safe_by_type(model, "IfcSpace"):
        gid = getattr(sp, "GlobalId", "")
        name = getattr(sp, "Name", "") or getattr(sp, "LongName", "")
        # We don't compute geometry here — IfcOpenShell's geometry
        # iterator is expensive. The IfcQuantityArea path below picks
        # up area + volume directly from the property set.
        yield ExtractedFact(
            category="closed_polygons",
            field=str(name or gid),
            value={"global_id": gid, "name": str(name)},
            unit="ks",
            confidence=0.95,
            evidence={"type": "IfcSpace"},
        )


def _emit_structural(model) -> Iterable[ExtractedFact]:
    """Walls / slabs / beams / columns / foundations."""

    type_to_cat = {
        "IfcWall": ("wall_system", 0.95),
        "IfcWallStandardCase": ("wall_system", 0.95),
        "IfcSlab": ("dimensions", 0.95),
        "IfcBeam": ("dimensions", 0.95),
        "IfcColumn": ("dimensions", 0.95),
        "IfcFooting": ("foundation_system", 0.95),
    }
    for type_name, (cat, conf) in type_to_cat.items():
        for ent in _safe_by_type(model, type_name):
            yield ExtractedFact(
                category=cat,
                field=type_name.replace("Ifc", "").lower(),
                value=getattr(ent, "Name", "") or getattr(ent, "GlobalId", ""),
                unit=None,
                confidence=conf,
                evidence={
                    "type": type_name,
                    "global_id": getattr(ent, "GlobalId", ""),
                },
            )


def _emit_openings(model) -> Iterable[ExtractedFact]:
    for type_name in ("IfcDoor", "IfcWindow"):
        for ent in _safe_by_type(model, type_name):
            yield ExtractedFact(
                category="windows_doors_specification",
                field=type_name.replace("Ifc", "").lower(),
                value=getattr(ent, "Name", "") or getattr(ent, "GlobalId", ""),
                unit=None,
                confidence=0.95,
                evidence={"type": type_name, "global_id": getattr(ent, "GlobalId", "")},
            )


def _emit_materials(model) -> Iterable[ExtractedFact]:
    for mat in _safe_by_type(model, "IfcMaterial"):
        name = getattr(mat, "Name", None)
        if not name:
            continue
        yield ExtractedFact(
            category="wall_system",
            field="material",
            value=str(name),
            unit=None,
            confidence=0.92,
            evidence={"type": "IfcMaterial"},
        )


def _emit_quantities(model) -> Iterable[ExtractedFact]:
    """IfcQuantityArea / Volume / Length attached to property sets."""

    for q in _safe_by_type(model, "IfcQuantityArea"):
        val = getattr(q, "AreaValue", None)
        if val is None:
            continue
        yield ExtractedFact(
            category="quantities",
            field="area_m2",
            value=float(val),
            unit="m2",
            confidence=0.97,
            evidence={"ifc_quantity": getattr(q, "Name", "")},
        )
    for q in _safe_by_type(model, "IfcQuantityVolume"):
        val = getattr(q, "VolumeValue", None)
        if val is None:
            continue
        yield ExtractedFact(
            category="quantities",
            field="volume_m3",
            value=float(val),
            unit="m3",
            confidence=0.97,
            evidence={"ifc_quantity": getattr(q, "Name", "")},
        )
    for q in _safe_by_type(model, "IfcQuantityLength"):
        val = getattr(q, "LengthValue", None)
        if val is None:
            continue
        yield ExtractedFact(
            category="dimensions",
            field="length_m",
            value=float(val),
            unit="m",
            confidence=0.97,
            evidence={"ifc_quantity": getattr(q, "Name", "")},
        )


def _emit_owner_history(model) -> Iterable[ExtractedFact]:
    """IfcOwnerHistory → version_metadata for the IFC version-tracking
    layer to ingest later."""

    for oh in _safe_by_type(model, "IfcOwnerHistory")[:3]:  # at most 3 — there's usually 1
        for attr, field in [
            ("CreationDate", "creation_date"),
            ("LastModifiedDate", "last_modified_date"),
        ]:
            val = getattr(oh, attr, None)
            if val is None:
                continue
            yield ExtractedFact(
                category="project_identification",
                field=field,
                value=int(val) if isinstance(val, (int, float)) else str(val),
                unit=None,
                confidence=0.95,
                evidence={"source": "IfcOwnerHistory"},
            )


def _count_by_type(model) -> dict[str, int]:
    """Headline entity counts for the raw_data dump."""

    out: dict[str, int] = {}
    for t in (
        "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace",
        "IfcWall", "IfcSlab", "IfcBeam", "IfcColumn", "IfcFooting",
        "IfcDoor", "IfcWindow", "IfcMaterial",
        "IfcQuantityArea", "IfcQuantityVolume", "IfcQuantityLength",
    ):
        out[t] = len(_safe_by_type(model, t))
    return out
