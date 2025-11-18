"""Parser utilities for AspeEsticon XC4 XML files."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterator, List, Optional, Tuple
import xml.etree.ElementTree as ET


# ----------------------------------------------------------------------------
# Data structures
# ----------------------------------------------------------------------------

@dataclass
class ParseResult:
    """Container for a parsed position."""

    position: Optional[Dict[str, object]]
    reason: Optional[str]


# ----------------------------------------------------------------------------
# Core parsing helpers
# ----------------------------------------------------------------------------

TAG_MAPPING = {
    "id": "id_polozka",
    "code": "znacka",
    "unit": "id_mj",
    "quantity": "mnozstvi",
    "specification": "specifikace",
}

DESCRIPTION_TAGS = ("popis", "nazev")


def _text_or_none(element: Optional[ET.Element]) -> Optional[str]:
    """Return stripped text content or ``None`` when empty."""

    if element is None:
        return None

    value = (element.text or "").strip()
    return value or None


def _parse_quantity(raw_quantity: Optional[str]) -> Optional[float]:
    """Convert textual quantity into a float value if possible."""

    if raw_quantity is None:
        return None

    normalized = raw_quantity.replace(" ", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def parse_polozka(element: ET.Element) -> ParseResult:
    """Parse a single ``<polozka>`` element into a normalized dictionary."""

    position: Dict[str, object] = {}

    # Direct tag mappings
    for field, tag in TAG_MAPPING.items():
        value = _text_or_none(element.find(tag))
        if field == "quantity" and value is not None:
            position[field] = _parse_quantity(value)
        else:
            position[field] = value

    # Description handling with fallback order
    description_value: Optional[str] = None
    for tag in DESCRIPTION_TAGS:
        description_value = _text_or_none(element.find(tag))
        if description_value:
            break
    position["description"] = description_value

    # Validation rules
    if not position.get("id"):
        return ParseResult(None, "missing id")

    if not position.get("code"):
        return ParseResult(None, "missing code")

    if not position.get("description"):
        return ParseResult(None, "empty description")

    if not position.get("unit"):
        return ParseResult(None, "missing unit")

    if position.get("quantity") is None:
        return ParseResult(None, "missing quantity")

    position.setdefault("specification", None)

    return ParseResult(position, None)


def _iter_polozky(element: ET.Element) -> Iterator[Tuple[int, ET.Element]]:
    """Yield ``(row_index, element)`` for every ``<polozka>`` in the subtree."""

    row_index = 0

    def _traverse(node: ET.Element) -> Iterator[ET.Element]:
        if node.tag == "polozka":
            yield node
            return

        for child in list(node):
            yield from _traverse(child)

    for polozka in _traverse(element):
        row_index += 1
        yield row_index, polozka


def parse_xml_tree(root: ET.Element) -> Tuple[List[Dict[str, object]], Dict[str, object]]:
    """Traverse the XC4 XML tree and collect position dictionaries."""

    positions: List[Dict[str, object]] = []
    diagnostics: Dict[str, object] = {"parsed": 0, "skipped": []}

    for row_index, polozka_element in _iter_polozky(root):
        result = parse_polozka(polozka_element)
        if result.position is not None:
            positions.append(result.position)
        else:
            diagnostics["skipped"].append({"row": row_index, "reason": result.reason})

    diagnostics["parsed"] = len(positions)
    return positions, diagnostics

