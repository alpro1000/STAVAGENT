"""LandXML adapter tests — PR3 §3.5."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import SourceFormat
from app.services.uep.landxml_extractor import LandXmlExtractor
from app.services.uep.registry import detect_format, get_extractor


_LANDXML_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
  <Application name="Civil3D" version="2024" />
  <Units>
    <Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter"
            angularUnit="decimal degrees" />
  </Units>
  <Surfaces>
    <Surface name="DTM_Existing" desc="Existing terrain">
      <Definition>
        <Pnts>
          <P id="1">10.0 20.0 305.5</P>
          <P id="2">11.0 20.0 305.7</P>
        </Pnts>
        <Faces>
          <F>1 2 3</F>
        </Faces>
      </Definition>
    </Surface>
  </Surfaces>
  <Alignments>
    <Alignment name="SO_250_OS_HLAVNI" length="425.50" staStart="0.000">
      <CoordGeom />
    </Alignment>
  </Alignments>
  <Parcels>
    <Parcel name="1836" parcelType="Existing" area="2540.0">
      <CoordGeom />
    </Parcel>
  </Parcels>
  <CgPoints>
    <CgPoint name="GP_001">100.000 200.000 305.500</CgPoint>
  </CgPoints>
</LandXML>
"""


def test_landxml_extractor_emits_application_units_surface_alignment(
    tmp_path: Path,
) -> None:
    p = tmp_path / "site.xml"
    p.write_text(_LANDXML_SAMPLE, encoding="utf-8")

    result = LandXmlExtractor().extract(p)

    assert result.extractor_error is None
    fields = {f.field for f in result.facts}
    for required in (
        "cad_application",
        "unit_system",
        "terrain_surface",
        "alignment",
        "parcel",
        "cogo_point",
    ):
        assert required in fields, f"missing: {required}"

    assert result.data["surface_count"] == 1
    assert result.data["alignment_count"] == 1
    assert result.data["parcel_count"] == 1
    assert result.data["cgpoint_count"] == 1


def test_landxml_extractor_alignment_carries_length_and_station(
    tmp_path: Path,
) -> None:
    p = tmp_path / "site.xml"
    p.write_text(_LANDXML_SAMPLE, encoding="utf-8")

    result = LandXmlExtractor().extract(p)

    alignment = next(f for f in result.facts if f.field == "alignment")
    assert alignment.value["length_m"] == pytest.approx(425.50)
    assert alignment.value["station_start"] == pytest.approx(0.0)


def test_landxml_extractor_empty_payload_emits_warning(tmp_path: Path) -> None:
    p = tmp_path / "empty.xml"
    p.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2">
  <Application name="Civil3D" version="2024" />
</LandXML>
""",
        encoding="utf-8",
    )

    result = LandXmlExtractor().extract(p)

    assert result.extractor_error is None
    codes = [w["code"] for w in result.decode_warnings]
    assert "landxml_empty_payload" in codes


def test_landxml_extractor_handles_malformed_xml(tmp_path: Path) -> None:
    p = tmp_path / "broken.xml"
    p.write_text("<garbage", encoding="utf-8")

    result = LandXmlExtractor().extract(p)

    assert result.extractor_error is not None
    assert "parse failed" in result.extractor_error.lower()


def test_registry_routes_landxml_to_landxml_extractor(tmp_path: Path) -> None:
    p = tmp_path / "site.xml"
    p.write_text(_LANDXML_SAMPLE, encoding="utf-8")

    assert detect_format(p) == SourceFormat.XML_LANDXML
    ex = get_extractor(p)
    assert isinstance(ex, LandXmlExtractor)
