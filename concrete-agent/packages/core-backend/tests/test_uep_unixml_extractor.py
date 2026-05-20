"""UNIXML adapter tests — PR3 §3.4."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import SourceFormat
from app.services.uep.registry import detect_format, get_extractor
from app.services.uep.unixml_extractor import UnixmlExtractor


_UNIXML_SAMPLE = """<?xml version='1.0' encoding='UTF-8'?>
<stavba nazev="Most 2062-1 Mladotice" kod="MOST_2062_1">
  <objekt nazev="SO 201 Most" kod="SO_201">
    <dil nazev="Mostovka">
      <polozka kod="121-1532" nazev="Beton mostovky C30/37 XF4" mj="m3"
               mnozstvi="94,231" cena_jednotkova="3 250,00"
               cenova_soustava="OTSKP_2024"/>
      <polozka kod="121-1530" nazev="Bednění" mj="m2"
               mnozstvi="547,400" cena_jednotkova="425,00"
               cenova_soustava="OTSKP_2024"/>
      <polozka kod="121-1620" nazev="Výztuž B500B" mj="t"
               mnozstvi="5,654" cena_jednotkova="42 000,00"
               cenova_soustava="OTSKP_2024"/>
    </dil>
  </objekt>
</stavba>
"""


def test_unixml_extractor_emits_three_quantity_facts(tmp_path: Path) -> None:
    p = tmp_path / "soupis.xml"
    p.write_text(_UNIXML_SAMPLE, encoding="utf-8")

    result = UnixmlExtractor().extract(p)

    assert result.extractor_error is None
    qty_facts = [f for f in result.facts if f.category == "quantities"]
    assert len(qty_facts) == 3

    # Volume row carries m3 unit, OTSKP code, and the cs-CZ parsed quantity.
    volume = next(f for f in qty_facts if f.field == "volume_m3")
    assert volume.value == pytest.approx(94.231)
    assert volume.unit == "m3"
    assert volume.evidence["code"] == "121-1532"
    assert volume.evidence["cenova_soustava"] == "OTSKP_2024"
    assert volume.evidence["unit_price_czk"] == pytest.approx(3250.0)


def test_unixml_extractor_emits_project_identification(tmp_path: Path) -> None:
    p = tmp_path / "soupis.xml"
    p.write_text(_UNIXML_SAMPLE, encoding="utf-8")

    result = UnixmlExtractor().extract(p)

    ids = [f for f in result.facts if f.category == "project_identification"]
    fields = {f.field for f in ids}
    assert "stavba_nazev" in fields
    assert "objekt" in fields


def test_unixml_extractor_skips_zero_quantity_with_warning(tmp_path: Path) -> None:
    """No silent drop — bad polozka emits decode_warning."""

    p = tmp_path / "soupis.xml"
    p.write_text(
        """<?xml version='1.0' encoding='UTF-8'?>
<stavba nazev="Empty">
  <polozka kod="X" nazev="No qty" mj="m3"/>
</stavba>
""",
        encoding="utf-8",
    )

    result = UnixmlExtractor().extract(p)

    assert result.extractor_error is None
    codes = [w["code"] for w in result.decode_warnings]
    assert "unixml_skipped_polozka" in codes


def test_unixml_extractor_handles_malformed_xml(tmp_path: Path) -> None:
    p = tmp_path / "broken.xml"
    p.write_text("not really xml <<<", encoding="utf-8")

    result = UnixmlExtractor().extract(p)

    assert result.extractor_error is not None
    assert "parse failed" in result.extractor_error.lower()


def test_registry_routes_unixml_xml_to_unixml_extractor(tmp_path: Path) -> None:
    p = tmp_path / "soupis.xml"
    p.write_text(_UNIXML_SAMPLE, encoding="utf-8")

    # Registry XML sub-router matches keyword `polozk` in first 4 KB.
    assert detect_format(p) == SourceFormat.XML_UNIXML
    ex = get_extractor(p)
    assert isinstance(ex, UnixmlExtractor)
