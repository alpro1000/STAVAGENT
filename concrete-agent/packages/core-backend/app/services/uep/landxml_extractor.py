"""
UEP LandXML extractor — PR3 §3.5.

Civil-engineering exchange format used by surveyors, road designers
and earthworks contractors. Carries terrain surfaces, alignments
(silnice / koleje), parcels and cogo points.

Mapping per v3 §15.6 (calibrated against SO_250 SÚSPK alignment +
hk212 site survey):

  <Project>                            → project_identification
  <Application>                        → project_identification (CAD tool)
  <Units>                              → unit_system fact
  <Surfaces><Surface>                  → site_situation (terén DTM)
  <Alignments><Alignment><Stations>    → site_situation (staničení)
  <Parcels><Parcel><CoordGeom>         → site_situation (parcela)
  <CgPoints><CgPoint>                  → site_situation (geodetické body)

LandXML files can be huge (≥100 MB DTM meshes); we use iterparse to
stream them. Memory cap ≤ 200 MB intermediate per task §15.4 row 2.

Confidence baseline 0.93 — geodetic data is precise but the
alignment ↔ design transformation is a separate engineering step.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.6
Reference: docs/tasks/TASK_UEP_PR3.md §3.5
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


_LANDXML_NS_PREFIX = "{http://www.landxml.org/schema/LandXML"


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


# ---------------------------------------------------------------------------
# Extractor
# ---------------------------------------------------------------------------


class LandXmlExtractor(BaseExtractor):
    """LandXML civil / survey extractor."""

    source_format = SourceFormat.XML_LANDXML
    extractor_id = "uep.landxml_extractor"
    extractor_version = "1.0"
    default_confidence = 0.93

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        # Use iterparse for memory bounded streaming. For LandXML files
        # > 50 MB the DOM tree would balloon; iterparse keeps the live
        # set to one element + ancestors.
        try:
            it = ET.iterparse(str(path), events=("start", "end"))
        except ET.ParseError as exc:
            raise ExtractorError(f"LandXML parse failed: {exc}") from exc

        facts: list[ExtractedFact] = []
        raw_data: dict[str, Any] = {
            "schema_version": None,
            "application": None,
            "units": None,
            "surface_count": 0,
            "alignment_count": 0,
            "parcel_count": 0,
            "cgpoint_count": 0,
        }
        decode_warnings: list[dict[str, Any]] = []

        # Iterparse-based pass — we only react to `end` events so the
        # element's attributes + text are populated. Memory cap is
        # naturally bounded because we `elem.clear()` after handling.
        # ET.iterparse defers most parse errors until iteration, so the
        # try/except wraps the loop too — not just the constructor.
        root: ET.Element | None = None
        try:
            for event, elem in it:
                local = _localname(elem.tag)
                if event == "start" and root is None:
                    root = elem
                    raw_data["schema_version"] = elem.attrib.get("version")
                    continue
                if event != "end":
                    continue

                if local == "Application":
                    raw_data["application"] = _attr(elem, "name")
                    facts.extend(_emit_application(elem))
                elif local == "Units":
                    raw_data["units"] = _summarise_units(elem)
                    facts.extend(_emit_units(elem, raw_data["units"]))
                elif local == "Surface":
                    raw_data["surface_count"] += 1
                    facts.extend(_emit_surface(elem))
                elif local == "Alignment":
                    raw_data["alignment_count"] += 1
                    facts.extend(_emit_alignment(elem))
                elif local == "Parcel":
                    raw_data["parcel_count"] += 1
                    facts.extend(_emit_parcel(elem))
                elif local == "CgPoint":
                    raw_data["cgpoint_count"] += 1
                    facts.extend(_emit_cgpoint(elem))

                # Free memory once a sub-tree has been processed. We
                # deliberately keep the root so iterparse can finish, and
                # only clear leaf elements.
                if local in (
                    "Surface", "Alignment", "Parcel",
                    "CgPoint", "Application", "Units",
                ):
                    elem.clear()
        except ET.ParseError as exc:
            raise ExtractorError(f"LandXML parse failed: {exc}") from exc

        if (
            raw_data["surface_count"] == 0
            and raw_data["alignment_count"] == 0
            and raw_data["parcel_count"] == 0
            and raw_data["cgpoint_count"] == 0
        ):
            decode_warnings.append({
                "code": "landxml_empty_payload",
                "message": (
                    "LandXML root parsed but no Surface/Alignment/Parcel/"
                    "CgPoint elements found"
                ),
                "root_tag": _localname(root.tag) if root is not None else "?",
            })

        return facts, raw_data, decode_warnings


# ---------------------------------------------------------------------------
# Emitters
# ---------------------------------------------------------------------------


def _emit_application(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr(elem, "name")
    version = _attr(elem, "version")
    if not (name or version):
        return
    yield ExtractedFact(
        category="project_identification",
        field="cad_application",
        value=f"{name or '?'} {version or ''}".strip(),
        unit=None,
        confidence=0.95,
        evidence={"source": "landxml.Application"},
    )


def _summarise_units(elem: ET.Element) -> dict[str, str]:
    """Collapse the LandXML <Units><Metric .../> child into a flat dict."""

    out: dict[str, str] = {}
    for child in elem:
        local = _localname(child.tag)
        for k, v in child.attrib.items():
            out[f"{local}.{k}"] = v
    return out


def _emit_units(elem: ET.Element, summary: dict[str, str]) -> Iterable[ExtractedFact]:
    if not summary:
        return
    yield ExtractedFact(
        category="dimensions",
        field="unit_system",
        value=summary,
        unit=None,
        confidence=0.99,
        evidence={"source": "landxml.Units"},
    )


def _emit_surface(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr(elem, "name") or _attr(elem, "desc")
    # Count points / faces if present — terrain density signal.
    point_count = 0
    face_count = 0
    for child in elem.iter():
        local = _localname(child.tag)
        if local == "P":
            point_count += 1
        elif local == "F":
            face_count += 1

    yield ExtractedFact(
        category="site_situation",
        field="terrain_surface",
        value={
            "name": name,
            "point_count": point_count,
            "face_count": face_count,
        },
        unit="ks",
        confidence=0.93,
        evidence={"source": "landxml.Surface"},
    )


def _emit_alignment(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr(elem, "name") or _attr(elem, "desc")
    length = _parse_float(_attr(elem, "length"))
    sta_start = _parse_float(_attr(elem, "staStart"))

    yield ExtractedFact(
        category="site_situation",
        field="alignment",
        value={
            "name": name,
            "length_m": length,
            "station_start": sta_start,
        },
        unit="m",
        confidence=0.95,
        evidence={"source": "landxml.Alignment"},
    )


def _emit_parcel(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr(elem, "name") or _attr(elem, "desc")
    parcel_type = _attr(elem, "parcelType")
    area = _parse_float(_attr(elem, "area"))

    yield ExtractedFact(
        category="site_situation",
        field="parcel",
        value={
            "name": name,
            "parcel_type": parcel_type,
            "area_m2": area,
        },
        unit="m2",
        confidence=0.92,
        evidence={"source": "landxml.Parcel"},
    )


def _emit_cgpoint(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr(elem, "name") or _attr(elem, "pntRef") or "?"
    text = (elem.text or "").strip()
    # CgPoint text is whitespace-separated "n e z" (north east elevation)
    # or "lat lon h" depending on the coordinate system declaration.
    yield ExtractedFact(
        category="site_situation",
        field="cogo_point",
        value={"name": name, "coords": text},
        unit=None,
        confidence=0.95,
        evidence={"source": "landxml.CgPoint"},
    )
