"""
UEP gbXML extractor — PR4a §3.2 (v3 §3.1.3).

Green Building XML — energy modeling / HVAC exchange format used by
Autodesk Revit / Open Studio / EnergyPlus / IES Virtual Environment.
For STAVAGENT it is the structured source for **MEP D.1.4 ÚT / VZT**
detailed matrices (rooms with heat / cooling loads, supply / extract
zones, surface constructions).

Mapping per v3 §3.1.3 + PR4a task §3.2:

  <Campus>                              → project_identification (campus name)
  <Building>                            → project_identification (building)
  <Space>                               → space inventory (one fact per Space)
  <Surface>                             → surface inventory (one fact per Surface)
  <Construction>                        → norm_references (material layer-up)
  <Material>                            → norm_references (per material)
  <Zone>                                → hvac_zone (one fact per Zone)
  <BuildingStorey>                      → dimensions (storey count)

Each `<Space>` emits ONE fact in category `space_inventory` carrying
{ name, area_m2, volume_m3, conditionType }. Each `<Surface>` emits ONE
fact in category `surface_inventory` carrying { surfaceType, exposedToSun,
adjacent_space_ids, area_m2 }. Each `<Zone>` emits ONE fact in category
`hvac_zone` carrying { name, design_supply_temp, design_extract_temp }.

The HVAC zone facts then feed `mep_d14_vzt` + `mep_d14_ut` matrices
through the `hvac_zone` row; surface + construction facts feed
`thermal_insulation` + `building_envelope` rows shared with the
`mep_base` hierarchical parent.

Confidence baseline 0.93 — gbXML is precise but the energy model is
typically a derivative of a Revit/IFC source, so values may have been
rounded during the export pass.

Memory bound ≤ 200 MB intermediate per v3 §15.4 row 2 — Revit campus
exports can be ≥ 50 MB, we therefore stream via `iterparse` exactly as
`landxml_extractor.py` does.

Reference: docs/tasks/TASK_UEP_PR4.md §3.2
Reference: docs/tasks/TASK_DocumentExtraction_Universal_Pipeline.md §3.1.3, §15.4
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


# gbXML schema namespaces seen in the wild — Revit exports typically use
# the canonical `gbxml.org/schema` URI; OpenStudio sometimes drops the
# trailing version segment. We strip namespaces before matching so the
# emitter logic is namespace-agnostic.
_GBXML_NS_HINTS = ("gbxml.org/schema", "gbxml.org")


def _localname(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _attr(elem: ET.Element, name: str) -> str | None:
    val = elem.attrib.get(name)
    return val.strip() if val else None


def _parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw.replace(",", "."))
    except (TypeError, ValueError):
        return None


def _child_text(elem: ET.Element, local_name: str) -> str | None:
    """Find first direct child with a given local tag name, return text."""

    for child in elem:
        if _localname(child.tag) == local_name:
            txt = (child.text or "").strip()
            if txt:
                return txt
    return None


def _child_float(elem: ET.Element, local_name: str) -> float | None:
    """Find first direct child by local name, return its float value."""

    return _parse_float(_child_text(elem, local_name))


# ---------------------------------------------------------------------------
# Extractor
# ---------------------------------------------------------------------------


class GbxmlExtractor(BaseExtractor):
    """gbXML energy / MEP exchange-format extractor.

    Streams the document via `xml.etree.ElementTree.iterparse` so memory
    stays bounded on multi-storey Revit campus exports. Per-element
    handlers `_emit_*` mirror the LandXML extractor style.
    """

    source_format = SourceFormat.XML_GBXML
    extractor_id = "uep.gbxml_extractor"
    extractor_version = "1.0"
    default_confidence = 0.93

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        try:
            it = ET.iterparse(str(path), events=("start", "end"))
        except ET.ParseError as exc:
            raise ExtractorError(f"gbXML parse failed: {exc}") from exc

        facts: list[ExtractedFact] = []
        raw_data: dict[str, Any] = {
            "schema_version": None,
            "namespace": None,
            "campus_id": None,
            "building_count": 0,
            "storey_count": 0,
            "space_count": 0,
            "surface_count": 0,
            "construction_count": 0,
            "material_count": 0,
            "zone_count": 0,
        }
        decode_warnings: list[dict[str, Any]] = []

        root: ET.Element | None = None
        seen_gbxml_namespace = False
        try:
            for event, elem in it:
                local = _localname(elem.tag)
                if event == "start" and root is None:
                    root = elem
                    raw_data["schema_version"] = (
                        elem.attrib.get("version") or elem.attrib.get("Version")
                    )
                    ns = elem.tag[1 : elem.tag.index("}")] if elem.tag.startswith("{") else None
                    raw_data["namespace"] = ns
                    if ns:
                        seen_gbxml_namespace = any(hint in ns for hint in _GBXML_NS_HINTS)
                    # Namespace-less <gbXML> roots still parse (the local-name
                    # routing below works regardless), but we leave
                    # `seen_gbxml_namespace` False so the decode_warning fires
                    # downstream — a missing namespace is a real schema
                    # smell worth surfacing to the operator.
                    continue
                if event != "end":
                    continue

                if local == "Campus":
                    raw_data["campus_id"] = _attr(elem, "id")
                    facts.extend(_emit_campus(elem))
                elif local == "Building":
                    raw_data["building_count"] += 1
                    facts.extend(_emit_building(elem))
                elif local == "BuildingStorey":
                    raw_data["storey_count"] += 1
                    facts.extend(_emit_storey(elem))
                elif local == "Space":
                    raw_data["space_count"] += 1
                    facts.extend(_emit_space(elem))
                elif local == "Surface":
                    raw_data["surface_count"] += 1
                    facts.extend(_emit_surface(elem))
                elif local == "Construction":
                    raw_data["construction_count"] += 1
                    facts.extend(_emit_construction(elem))
                elif local == "Material":
                    raw_data["material_count"] += 1
                    facts.extend(_emit_material(elem))
                elif local == "Zone":
                    raw_data["zone_count"] += 1
                    facts.extend(_emit_zone(elem))

                # Free memory after the leaf has been processed. We avoid
                # clearing the root — iterparse needs it alive — and avoid
                # clearing parent containers (Campus / Building) until
                # after their children have been emitted in document order
                # (iterparse fires `end` events bottom-up, so by the time
                # we land on Campus its descendants have already cleared).
                if local in (
                    "Space", "Surface", "Construction", "Material",
                    "Zone", "BuildingStorey",
                ):
                    elem.clear()
        except ET.ParseError as exc:
            raise ExtractorError(f"gbXML parse failed: {exc}") from exc

        if not seen_gbxml_namespace:
            decode_warnings.append({
                "code": "gbxml_namespace_missing",
                "message": (
                    "Root element did not declare a recognized gbXML "
                    "namespace (expected gbxml.org/schema*); proceeding "
                    "with namespace-less local-name routing."
                ),
                "root_namespace": raw_data["namespace"],
            })

        if (
            raw_data["space_count"] == 0
            and raw_data["surface_count"] == 0
            and raw_data["zone_count"] == 0
        ):
            decode_warnings.append({
                "code": "gbxml_empty_payload",
                "message": (
                    "gbXML root parsed but no Space/Surface/Zone elements "
                    "found — file may be a material library only, not a "
                    "building energy model."
                ),
                "root_tag": _localname(root.tag) if root is not None else "?",
            })

        return facts, raw_data, decode_warnings


# ---------------------------------------------------------------------------
# Per-element emitters
# ---------------------------------------------------------------------------


def _emit_campus(elem: ET.Element) -> Iterable[ExtractedFact]:
    campus_id = _attr(elem, "id")
    if not campus_id:
        return
    yield ExtractedFact(
        category="project_identification",
        field="gbxml_campus",
        value=campus_id,
        unit=None,
        confidence=0.95,
        evidence={"source": "gbxml.Campus", "id": campus_id},
    )


def _emit_building(elem: ET.Element) -> Iterable[ExtractedFact]:
    building_id = _attr(elem, "id") or "?"
    building_type = _attr(elem, "buildingType")
    name = _child_text(elem, "Name")
    area = _child_float(elem, "Area")
    yield ExtractedFact(
        category="project_identification",
        field="gbxml_building",
        value={
            "id": building_id,
            "name": name,
            "buildingType": building_type,
            "area_m2": area,
        },
        unit="m2",
        confidence=0.93,
        evidence={"source": "gbxml.Building", "id": building_id},
    )


def _emit_storey(elem: ET.Element) -> Iterable[ExtractedFact]:
    storey_id = _attr(elem, "id") or "?"
    name = _child_text(elem, "Name")
    level = _child_float(elem, "Level")
    yield ExtractedFact(
        category="dimensions",
        field="building_storey",
        value={"id": storey_id, "name": name, "level_m": level},
        unit="m",
        confidence=0.95,
        evidence={"source": "gbxml.BuildingStorey", "id": storey_id},
    )


def _emit_space(elem: ET.Element) -> Iterable[ExtractedFact]:
    space_id = _attr(elem, "id") or "?"
    condition_type = _attr(elem, "conditionType")
    storey_ref = _attr(elem, "buildingStoreyIdRef")
    zone_ref = _attr(elem, "zoneIdRef")
    name = _child_text(elem, "Name") or _attr(elem, "Name")
    area = _child_float(elem, "Area")
    volume = _child_float(elem, "Volume")
    yield ExtractedFact(
        category="space_inventory",
        field="space",
        value={
            "id": space_id,
            "name": name,
            "conditionType": condition_type,
            "area_m2": area,
            "volume_m3": volume,
            "buildingStoreyIdRef": storey_ref,
            "zoneIdRef": zone_ref,
        },
        unit="m2",
        confidence=0.93,
        evidence={"source": "gbxml.Space", "id": space_id},
    )


def _emit_surface(elem: ET.Element) -> Iterable[ExtractedFact]:
    surface_id = _attr(elem, "id") or "?"
    surface_type = _attr(elem, "surfaceType")
    exposed_to_sun = _attr(elem, "exposedToSun")
    construction_ref = _attr(elem, "constructionIdRef")
    # gbXML lists 0..n <AdjacentSpaceId> child elements identifying which
    # spaces share this surface — load-coupled rooms in the energy model.
    adjacent_space_ids: list[str] = []
    for child in elem:
        if _localname(child.tag) == "AdjacentSpaceId":
            ref = child.attrib.get("spaceIdRef")
            if ref:
                adjacent_space_ids.append(ref)
    area = _child_float(elem, "Area")
    yield ExtractedFact(
        category="surface_inventory",
        field="surface",
        value={
            "id": surface_id,
            "surfaceType": surface_type,
            "exposedToSun": exposed_to_sun,
            "constructionIdRef": construction_ref,
            "adjacent_space_ids": adjacent_space_ids,
            "area_m2": area,
        },
        unit="m2",
        confidence=0.92,
        evidence={"source": "gbxml.Surface", "id": surface_id},
    )


def _emit_construction(elem: ET.Element) -> Iterable[ExtractedFact]:
    construction_id = _attr(elem, "id") or "?"
    name = _child_text(elem, "Name")
    u_value = _child_float(elem, "U-value") or _child_float(elem, "Uvalue")
    yield ExtractedFact(
        category="norm_references",
        field="construction",
        value={"id": construction_id, "name": name, "u_value_w_m2k": u_value},
        unit="W/(m2·K)",
        confidence=0.92,
        evidence={"source": "gbxml.Construction", "id": construction_id},
    )


def _emit_material(elem: ET.Element) -> Iterable[ExtractedFact]:
    material_id = _attr(elem, "id") or "?"
    name = _child_text(elem, "Name")
    thickness = _child_float(elem, "Thickness")
    conductivity = _child_float(elem, "Conductivity")
    yield ExtractedFact(
        category="norm_references",
        field="material",
        value={
            "id": material_id,
            "name": name,
            "thickness_m": thickness,
            "conductivity_w_mk": conductivity,
        },
        unit="m",
        confidence=0.92,
        evidence={"source": "gbxml.Material", "id": material_id},
    )


def _emit_zone(elem: ET.Element) -> Iterable[ExtractedFact]:
    zone_id = _attr(elem, "id") or "?"
    name = _child_text(elem, "Name")
    design_supply = _child_float(elem, "DesignHeatT") or _child_float(elem, "designHeatT")
    design_cool = _child_float(elem, "DesignCoolT") or _child_float(elem, "designCoolT")
    yield ExtractedFact(
        category="hvac_zone",
        field="zone",
        value={
            "id": zone_id,
            "name": name,
            "design_heat_t_c": design_supply,
            "design_cool_t_c": design_cool,
        },
        unit="°C",
        confidence=0.93,
        evidence={"source": "gbxml.Zone", "id": zone_id},
    )
