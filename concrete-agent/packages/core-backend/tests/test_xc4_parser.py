import sys
from pathlib import Path
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.parsers.xc4_parser import parse_polozka, parse_xml_tree


def _build_element(xml: str) -> ET.Element:
    return ET.fromstring(xml)


def test_parse_polozka_with_full_data():
    element = _build_element(
        """
        <polozka>
            <id_polozka>uuid-123</id_polozka>
            <znacka>02110</znacka>
            <nazev>Sample name</nazev>
            <popis>Detailed description</popis>
            <id_mj>KPL</id_mj>
            <mnozstvi>5,5</mnozstvi>
            <specifikace>Specs</specifikace>
        </polozka>
        """
    )

    result = parse_polozka(element)

    assert result.position is not None
    assert result.reason is None
    assert result.position["id"] == "uuid-123"
    assert result.position["code"] == "02110"
    assert result.position["description"] == "Detailed description"
    assert result.position["unit"] == "KPL"
    assert result.position["quantity"] == 5.5
    assert result.position["specification"] == "Specs"


def test_parse_polozka_falls_back_to_name():
    element = _build_element(
        """
        <polozka>
            <id_polozka>uuid-456</id_polozka>
            <znacka>02920</znacka>
            <popis></popis>
            <nazev>Fallback description</nazev>
            <id_mj>m2</id_mj>
            <mnozstvi>10</mnozstvi>
        </polozka>
        """
    )

    result = parse_polozka(element)

    assert result.position is not None
    assert result.position["description"] == "Fallback description"


def test_parse_polozka_missing_required_fields():
    element = _build_element(
        """
        <polozka>
            <id_polozka></id_polozka>
            <znacka></znacka>
            <id_mj></id_mj>
            <mnozstvi></mnozstvi>
        </polozka>
        """
    )

    result = parse_polozka(element)

    assert result.position is None
    assert result.reason == "missing id"


def test_parse_xml_tree_collects_positions_and_diagnostics():
    root = _build_element(
        """
        <root>
            <objekty>
                <objekt>
                    <stavDily>
                        <stavDil>
                            <polozky>
                                <polozka>
                                    <id_polozka>1</id_polozka>
                                    <znacka>A1</znacka>
                                    <popis>First</popis>
                                    <id_mj>m</id_mj>
                                    <mnozstvi>1</mnozstvi>
                                </polozka>
                                <polozka>
                                    <id_polozka>2</id_polozka>
                                    <znacka></znacka>
                                    <nazev>Second</nazev>
                                    <id_mj>m</id_mj>
                                    <mnozstvi>2</mnozstvi>
                                </polozka>
                            </polozky>
                        </stavDil>
                    </stavDily>
                </objekt>
            </objekty>
        </root>
        """
    )

    positions, diagnostics = parse_xml_tree(root)

    assert len(positions) == 1
    assert positions[0]["id"] == "1"
    assert diagnostics["parsed"] == 1
    assert diagnostics["skipped"] == [{"row": 2, "reason": "missing code"}]

