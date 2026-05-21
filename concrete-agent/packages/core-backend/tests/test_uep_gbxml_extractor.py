"""gbXML adapter tests — PR4a §3.2.

Mirrors the structure of `test_uep_landxml_extractor.py`. We feed a
small Revit-shaped gbXML sample through the extractor and assert:

  - happy path emits Campus / Building / Space / Surface / Construction /
    Material / Zone facts in their expected categories;
  - the registry XML sub-router recognises the gbXML namespace and
    returns a `GbxmlExtractor` instance;
  - malformed XML degrades to `extractor_error` (no silent drop);
  - a material-library-only export (no Space/Surface/Zone) raises the
    `gbxml_empty_payload` decode warning;
  - namespace-less variants still parse and surface a single
    `gbxml_namespace_missing` decode warning (no spurious extra warnings
    from the sub-router).
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from app.models.uep_schemas import SourceFormat
from app.services.uep.gbxml_extractor import GbxmlExtractor
from app.services.uep.registry import detect_format, get_extractor


_GBXML_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<gbXML xmlns="http://www.gbxml.org/schema" version="6.01" temperatureUnit="C">
  <Campus id="campus-1">
    <Location>
      <Name>Praha 4</Name>
    </Location>
    <Building id="bldg-RD" buildingType="SingleFamily">
      <Name>RD Jachymov dum</Name>
      <Area>168.5</Area>
      <BuildingStorey id="storey-1NP">
        <Name>1.NP</Name>
        <Level>0.0</Level>
      </BuildingStorey>
      <BuildingStorey id="storey-2NP">
        <Name>2.NP</Name>
        <Level>3.0</Level>
      </BuildingStorey>
      <Space id="space-1.01" conditionType="HeatedAndCooled"
             buildingStoreyIdRef="storey-1NP" zoneIdRef="zone-A">
        <Name>Obyvaci pokoj</Name>
        <Area>42.5</Area>
        <Volume>119.0</Volume>
      </Space>
      <Space id="space-2.01" conditionType="HeatedOnly"
             buildingStoreyIdRef="storey-2NP" zoneIdRef="zone-A">
        <Name>Loznice</Name>
        <Area>18.0</Area>
        <Volume>45.0</Volume>
      </Space>
    </Building>
    <Surface id="surf-N-1" surfaceType="ExteriorWall" exposedToSun="true"
             constructionIdRef="con-ETICS-180">
      <AdjacentSpaceId spaceIdRef="space-1.01"/>
      <Area>22.4</Area>
    </Surface>
    <Surface id="surf-W-1" surfaceType="InteriorWall" exposedToSun="false"
             constructionIdRef="con-VPC-300">
      <AdjacentSpaceId spaceIdRef="space-1.01"/>
      <AdjacentSpaceId spaceIdRef="space-2.01"/>
      <Area>14.0</Area>
    </Surface>
  </Campus>
  <Construction id="con-ETICS-180">
    <Name>VPC 300 + ETICS 180 EPS70F</Name>
    <U-value>0.18</U-value>
  </Construction>
  <Material id="mat-eps70f">
    <Name>EPS 70F</Name>
    <Thickness>0.180</Thickness>
    <Conductivity>0.039</Conductivity>
  </Material>
  <Zone id="zone-A">
    <Name>OZ-1 obytna zona</Name>
    <DesignHeatT>20.0</DesignHeatT>
    <DesignCoolT>26.0</DesignCoolT>
  </Zone>
</gbXML>
"""


def test_gbxml_extractor_emits_full_revit_shape(tmp_path: Path) -> None:
    p = tmp_path / "rd_jachymov.gbxml.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    result = GbxmlExtractor().extract(p)

    assert result.extractor_error is None
    fields = {f.field for f in result.facts}
    for required in (
        "gbxml_campus",
        "gbxml_building",
        "building_storey",
        "space",
        "surface",
        "construction",
        "material",
        "zone",
    ):
        assert required in fields, f"missing: {required}"

    assert result.data["building_count"] == 1
    assert result.data["storey_count"] == 2
    assert result.data["space_count"] == 2
    assert result.data["surface_count"] == 2
    assert result.data["construction_count"] == 1
    assert result.data["material_count"] == 1
    assert result.data["zone_count"] == 1


def test_gbxml_space_carries_area_volume_and_zone_ref(tmp_path: Path) -> None:
    p = tmp_path / "rd.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    result = GbxmlExtractor().extract(p)
    spaces = [f for f in result.facts if f.category == "space_inventory"]
    assert len(spaces) == 2

    obyvak = next(f for f in spaces if f.value["id"] == "space-1.01")
    assert obyvak.value["area_m2"] == pytest.approx(42.5)
    assert obyvak.value["volume_m3"] == pytest.approx(119.0)
    assert obyvak.value["conditionType"] == "HeatedAndCooled"
    assert obyvak.value["zoneIdRef"] == "zone-A"


def test_gbxml_surface_carries_adjacent_space_ids(tmp_path: Path) -> None:
    p = tmp_path / "rd.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    result = GbxmlExtractor().extract(p)
    surfaces = [f for f in result.facts if f.category == "surface_inventory"]
    interior = next(f for f in surfaces if f.value["id"] == "surf-W-1")
    assert interior.value["surfaceType"] == "InteriorWall"
    assert set(interior.value["adjacent_space_ids"]) == {"space-1.01", "space-2.01"}


def test_gbxml_zone_feeds_hvac_zone_category(tmp_path: Path) -> None:
    p = tmp_path / "rd.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    result = GbxmlExtractor().extract(p)
    zones = [f for f in result.facts if f.category == "hvac_zone"]
    assert len(zones) == 1
    z = zones[0]
    assert z.value["id"] == "zone-A"
    assert z.value["design_heat_t_c"] == pytest.approx(20.0)
    assert z.value["design_cool_t_c"] == pytest.approx(26.0)


def test_gbxml_extractor_handles_malformed_xml(tmp_path: Path) -> None:
    p = tmp_path / "broken.xml"
    p.write_text("not really gbxml <<<", encoding="utf-8")

    result = GbxmlExtractor().extract(p)

    assert result.extractor_error is not None
    assert "parse failed" in result.extractor_error.lower()


def test_gbxml_extractor_warns_on_empty_payload(tmp_path: Path) -> None:
    """Material library only — no Space/Surface/Zone → empty_payload warning."""

    p = tmp_path / "library.xml"
    p.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<gbXML xmlns="http://www.gbxml.org/schema" version="6.01">
  <Material id="mat-x">
    <Name>EPS 70F</Name>
    <Thickness>0.180</Thickness>
    <Conductivity>0.039</Conductivity>
  </Material>
</gbXML>
""",
        encoding="utf-8",
    )

    result = GbxmlExtractor().extract(p)

    assert result.extractor_error is None
    codes = [w["code"] for w in result.decode_warnings]
    assert "gbxml_empty_payload" in codes


def test_gbxml_extractor_warns_on_missing_namespace(tmp_path: Path) -> None:
    """Namespace-less fixture parses but flags the missing namespace."""

    p = tmp_path / "noNs.xml"
    p.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<gbXML version="6.01">
  <Campus id="c1">
    <Building id="b1" buildingType="SingleFamily">
      <Space id="s1" conditionType="HeatedOnly">
        <Area>10.0</Area>
      </Space>
    </Building>
  </Campus>
</gbXML>
""",
        encoding="utf-8",
    )

    result = GbxmlExtractor().extract(p)

    assert result.extractor_error is None
    codes = [w["code"] for w in result.decode_warnings]
    assert "gbxml_namespace_missing" in codes


def test_registry_routes_gbxml_to_extractor(tmp_path: Path) -> None:
    p = tmp_path / "rd.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    # The PR3 XML sub-router matches the gbxml.org namespace in the first 4 KB.
    assert detect_format(p) == SourceFormat.XML_GBXML
    ex = get_extractor(p)
    assert isinstance(ex, GbxmlExtractor)


def test_gbxml_extractor_tolerates_malformed_namespace(tmp_path: Path) -> None:
    """Regression: a tag that starts with `{` but lacks the closing `}`
    must NOT crash the iterparse loop with ValueError. The namespace
    extraction is best-effort — it silently falls back to None and the
    `gbxml_namespace_missing` decode warning fires.

    We simulate the malformed-tag condition by patching ElementTree
    just for the first start-event: the real iterparse would never
    emit such a tag (ET rejects the XML at parse time), but a future
    upstream change could expose the same surface (e.g. a custom
    pull-parser layer). Locking it down here closes the Amazon Q
    PR #1192 review comment without depending on actual malformed XML
    that ET would refuse to load.
    """

    from unittest.mock import patch

    p = tmp_path / "rd.xml"
    p.write_text(_GBXML_SAMPLE, encoding="utf-8")

    # Real iterparse with no patching — should pass through cleanly
    # (this is the regression baseline; the patched-iterparse test
    # below proves the guard fires).
    baseline = GbxmlExtractor().extract(p)
    assert baseline.extractor_error is None

    # Patched iterparse — first start-event surfaces a malformed tag.
    original_iterparse = ET.iterparse

    def _mangled_iterparse(*args, **kwargs):
        emitted_root = False
        for event, elem in original_iterparse(*args, **kwargs):
            if not emitted_root and event == "start":
                # Pretend the root tag has an unbalanced `{` prefix.
                elem.tag = "{http://www.gbxml.org/schema-MANGLED"
                emitted_root = True
            yield event, elem

    with patch.object(ET, "iterparse", _mangled_iterparse):
        result = GbxmlExtractor().extract(p)

    # Extractor still completes — no ValueError leaked.
    assert result.extractor_error is None
    # Namespace recorded as None (best-effort fallback).
    assert result.data["namespace"] is None
    # The missing-namespace warning still surfaces so the operator
    # can investigate the malformed root.
    codes = [w["code"] for w in result.decode_warnings]
    assert "gbxml_namespace_missing" in codes
