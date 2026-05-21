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

import hashlib
import json
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


# Entity types whose snapshots we capture for the PR4b IFC diff engine.
# All IfcRoot subtypes; one fact-like dict emitted per instance.
_SNAPSHOT_TYPES: tuple[str, ...] = (
    "IfcSite",
    "IfcBuilding",
    "IfcBuildingStorey",
    "IfcSpace",
    "IfcWall",
    "IfcWallStandardCase",
    "IfcSlab",
    "IfcBeam",
    "IfcColumn",
    "IfcFooting",
    "IfcDoor",
    "IfcWindow",
)


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
        # Defensive — the size guard above already rejects > 2 GB, so
        # `pick_streaming_strategy` should never return REJECT here. We
        # surface a clear ExtractorError instead of falling through to
        # `ifcopenshell.open` and risking an OOM if the constants are
        # ever desynchronised (Amazon Q PR #1188 finding #1).
        if strategy == StreamingStrategy.REJECT:
            raise ExtractorError(
                f"IFC file size {size / 1024**3:.2f} GB resolved to "
                "REJECT strategy after the upfront size guard — refusing "
                "to load (defensive; should be unreachable)."
            )
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

        # Per-entity snapshots for the PR4b diff engine. Always
        # captured — IFC files always belong to a project, and a
        # follow-up upload will diff against this snapshot list. Cost
        # is proportional to entity count, not file size, so it's safe
        # on 1 GB+ streamed files (only IfcRoot subtypes traversed).
        entity_snapshots = _emit_entity_snapshots(model)

        # Raw data — high-level inventory + version identity.
        raw_data: dict[str, Any] = {
            "schema": getattr(model, "schema", None),
            "file_name": path.name,
            "file_size_bytes": size,
            "streaming_strategy": strategy.value,
            "entity_counts": _count_by_type(model),
            "entity_snapshots": entity_snapshots,
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


# ---------------------------------------------------------------------------
# Per-entity snapshot capture — PR4b-1 input to the IFC diff engine.
#
# Strategy:
# - For every IfcRoot subtype in _SNAPSHOT_TYPES, iterate instances.
# - Per instance, gather {ifc_type, name, object_type, storey_global_id,
#   quantities, material_layers, property_sets}.
# - Compute SHA-256 of canonical-JSON over those fields → payload_hash.
# - Defensive: each helper falls back to {} / [] / None on schema gap.
#   Allplan, Revit and ArchiCAD all emit slightly different IfcRel*
#   wiring (e.g. some omit IfcRelContainedInSpatialStructure for site
#   metadata, some attach IfcElementQuantity via IfcRelDefinesByType
#   instead of IfcRelDefinesByProperties). We never raise on schema
#   variation; we record what we can and move on.
# - `ifcopenshell.util.element` is the preferred accessor (handles
#   the schema variants for us). We fall back to manual traversal of
#   IsDefinedBy / HasAssociations / ContainedInStructure when the
#   util module isn't importable (older ifcopenshell wheels) or its
#   helpers raise.
# ---------------------------------------------------------------------------


def _try_import_element_util():
    """Lazy import — same posture as `_try_import_ifcopenshell`."""

    try:
        from ifcopenshell.util import element as ifc_util  # type: ignore[import-not-found]

        return ifc_util
    except ImportError:
        return None


def _emit_entity_snapshots(model) -> list[dict[str, Any]]:
    """One dict per IfcRoot instance — input to `compute_basic_ifc_diff`.

    Shape per dict matches `app.models.ifc_diff_schemas.IfcEntitySnapshot`
    so the diff engine can hydrate them directly.
    """

    util = _try_import_element_util()
    snapshots: list[dict[str, Any]] = []
    for type_name in _SNAPSHOT_TYPES:
        for ent in _safe_by_type(model, type_name):
            gid = getattr(ent, "GlobalId", None)
            if not gid:
                # Without a GlobalId the entity has no diff identity.
                continue
            snap: dict[str, Any] = {
                "global_id": str(gid),
                "ifc_type": type_name,
                "name": _safe_str_attr(ent, "Name"),
                "object_type": _safe_str_attr(ent, "ObjectType"),
                "storey_global_id": _resolve_storey_gid(ent, util),
                "quantities": _resolve_quantities(ent, util),
                "material_layers": _resolve_material_layers(ent, util),
                "property_sets": _resolve_property_sets(ent, util),
            }
            snap["payload_hash"] = _compute_payload_hash(snap)
            snapshots.append(snap)
    return snapshots


def _safe_str_attr(ent, attr: str) -> str | None:
    val = getattr(ent, attr, None)
    if val is None:
        return None
    s = str(val).strip()
    return s or None


def _resolve_storey_gid(ent, util) -> str | None:
    """Walk IfcRelContainedInSpatialStructure / decomposition to find the
    containing IfcBuildingStorey GlobalId.

    Spaces are contained in storeys directly. Walls / slabs / beams /
    columns are too (in the typical Revit/Allplan/ArchiCAD output).
    Sites / buildings / storeys themselves return None — they ARE the
    spatial hierarchy, not contained in one.
    """

    if util is not None:
        try:
            container = util.get_container(ent)  # type: ignore[attr-defined]
            if container is not None and container.is_a("IfcBuildingStorey"):
                gid = getattr(container, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:  # noqa: BLE001
            pass
    # Manual fallback — walk ContainedInStructure rels.
    for rel in getattr(ent, "ContainedInStructure", []) or []:
        struct = getattr(rel, "RelatingStructure", None)
        if struct is None:
            continue
        try:
            if struct.is_a("IfcBuildingStorey"):
                gid = getattr(struct, "GlobalId", None)
                return str(gid) if gid else None
        except Exception:  # noqa: BLE001
            continue
    return None


def _resolve_quantities(ent, util) -> dict[str, float]:
    """Aggregate `IfcElementQuantity` values attached via
    `IfcRelDefinesByProperties`.

    Returns {quantity_name: numeric_value}. Names follow the IFC
    convention (`NetArea`, `GrossVolume`, `Length`, …). PR4b-2 will
    aggregate these to per-IfcType totals (total_wall_area_m2, …).
    """

    out: dict[str, float] = {}
    if util is not None:
        try:
            qsets = util.get_psets(ent, qtos_only=True)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            qsets = {}
        for _qset_name, qset in qsets.items():
            if not isinstance(qset, dict):
                continue
            for k, v in qset.items():
                if k == "id":
                    continue
                num = _coerce_number(v)
                if num is not None:
                    out[str(k)] = num
        if out:
            return out
    # Manual fallback — walk IsDefinedBy.
    for rel in getattr(ent, "IsDefinedBy", []) or []:
        pset = getattr(rel, "RelatingPropertyDefinition", None)
        if pset is None:
            continue
        try:
            if not pset.is_a("IfcElementQuantity"):
                continue
        except Exception:  # noqa: BLE001
            continue
        for q in getattr(pset, "Quantities", []) or []:
            name = getattr(q, "Name", None)
            if not name:
                continue
            # IFC quantity attribute names vary by subtype.
            for attr in (
                "AreaValue", "VolumeValue", "LengthValue",
                "WeightValue", "CountValue", "TimeValue",
            ):
                val = getattr(q, attr, None)
                num = _coerce_number(val)
                if num is not None:
                    out[str(name)] = num
                    break
    return out


def _resolve_material_layers(ent, util) -> list[dict[str, Any]]:
    """Ordered list of `IfcMaterialLayerSet` layers attached to the entity.

    Each layer: {"name": str|None, "thickness_m": float|None,
    "material_global_id": str|None}. Empty list for entities without an
    associated layer set (most beams, columns, doors, windows).
    """

    layers: list[dict[str, Any]] = []
    material = None
    if util is not None:
        try:
            material = util.get_material(ent)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            material = None
    if material is None:
        # Manual fallback — walk HasAssociations.
        for rel in getattr(ent, "HasAssociations", []) or []:
            try:
                if not rel.is_a("IfcRelAssociatesMaterial"):
                    continue
            except Exception:  # noqa: BLE001
                continue
            material = getattr(rel, "RelatingMaterial", None)
            if material is not None:
                break
    if material is None:
        return layers
    # Material may be IfcMaterial / IfcMaterialLayerSet /
    # IfcMaterialLayerSetUsage / IfcMaterialList / IfcMaterialConstituentSet.
    # Only the layer-set variants carry per-layer geometry.
    layer_set = None
    try:
        if material.is_a("IfcMaterialLayerSetUsage"):
            layer_set = getattr(material, "ForLayerSet", None)
        elif material.is_a("IfcMaterialLayerSet"):
            layer_set = material
    except Exception:  # noqa: BLE001
        return layers
    if layer_set is None:
        return layers
    for layer in getattr(layer_set, "MaterialLayers", []) or []:
        mat = getattr(layer, "Material", None)
        layers.append({
            "name": _safe_str_attr(layer, "Name") or _safe_str_attr(mat, "Name"),
            "thickness_m": _coerce_number(getattr(layer, "LayerThickness", None)),
            "material_global_id": _safe_str_attr(mat, "GlobalId"),
        })
    return layers


def _resolve_property_sets(ent, util) -> dict[str, dict[str, Any]]:
    """{pset_name: {prop_name: value}} from `IfcRelDefinesByProperties`.

    Quantities are emitted under `_resolve_quantities` separately, so
    this skips `IfcElementQuantity` to avoid double-counting.
    """

    out: dict[str, dict[str, Any]] = {}
    if util is not None:
        try:
            psets = util.get_psets(ent, psets_only=True)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            psets = {}
        for pset_name, props in psets.items():
            if not isinstance(props, dict):
                continue
            clean = {k: _coerce_jsonable(v) for k, v in props.items() if k != "id"}
            if clean:
                out[str(pset_name)] = clean
        if out:
            return out
    # Manual fallback.
    for rel in getattr(ent, "IsDefinedBy", []) or []:
        pset = getattr(rel, "RelatingPropertyDefinition", None)
        if pset is None:
            continue
        try:
            if not pset.is_a("IfcPropertySet"):
                continue
        except Exception:  # noqa: BLE001
            continue
        name = getattr(pset, "Name", None)
        if not name:
            continue
        props: dict[str, Any] = {}
        for prop in getattr(pset, "HasProperties", []) or []:
            pname = getattr(prop, "Name", None)
            if not pname:
                continue
            # IfcPropertySingleValue is by far the common case;
            # IfcPropertyEnumeratedValue / IfcPropertyListValue fall
            # back to their NominalValue / EnumerationValues attrs.
            nominal = getattr(prop, "NominalValue", None)
            if nominal is not None:
                props[str(pname)] = _coerce_jsonable(
                    getattr(nominal, "wrappedValue", nominal)
                )
        if props:
            out[str(name)] = props
    return out


def _coerce_number(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, bool):
        # bool is a subclass of int — guard so True doesn't become 1.0.
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _coerce_jsonable(val):
    """Normalize an IFC property value into something json.dumps can eat."""

    if val is None or isinstance(val, (bool, int, float, str)):
        return val
    if isinstance(val, (list, tuple)):
        return [_coerce_jsonable(x) for x in val]
    if isinstance(val, dict):
        return {str(k): _coerce_jsonable(v) for k, v in val.items()}
    return str(val)


def _compute_payload_hash(snap: dict[str, Any]) -> str:
    """SHA-256 of canonical JSON over the diff-relevant fields.

    Excludes `payload_hash` itself (chicken-and-egg) and `global_id`
    (identity is already keyed by it, so a GlobalId change isn't a
    "modified" — it's an add + remove pair).
    """

    diff_payload = {k: snap.get(k) for k in (
        "ifc_type", "name", "object_type", "storey_global_id",
        "quantities", "material_layers", "property_sets",
    )}
    canonical = json.dumps(
        diff_payload, sort_keys=True, separators=(",", ":"), default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
