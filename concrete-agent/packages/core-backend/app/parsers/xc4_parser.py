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


def parse_polozka(element: ET.Element, object_code: Optional[str] = None) -> ParseResult:
    """Parse a single ``<polozka>`` element into a normalized dictionary.

    ``object_code`` is the ``<znacka>`` of the nearest enclosing ``<objekt>`` (the
    SO section, e.g. "SO 202"), threaded down by ``_iter_polozky``. It is carried
    on every position so a per-SO consumer (the bridge-passport soupis join) can
    filter a whole-stavba soupis to a single construction object — without it the
    join sums quantities across every SO (bug `passport-soupis-join-whole-stavba`).
    """

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

    # catalog_name = the OTSKP standard item name (<nazev>), kept SEPARATE from
    # description. `<popis>` is a project sub-note ("vč. nátěru…") that on some
    # lines shadows the real element name, so element classification must key on
    # <nazev> — where the OTSKP name («MOSTNÍ PILÍŘE A STATIVA…») actually lives
    # (bug `passport-soupis-join-whole-stavba` increment 2). Display/provenance
    # keeps `description` (popis-first) untouched.
    position["catalog_name"] = _text_or_none(element.find("nazev"))

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
    position["object_code"] = object_code

    return ParseResult(position, None)


def _objekt_znacka(node: ET.Element) -> Optional[str]:
    """The SO code of an ``<objekt>`` = its DIRECT ``<znacka>`` child (a ``<polozka>``
    also has a ``<znacka>``, but ``.find`` searches direct children only, so this
    never picks up a nested position's code)."""
    z = node.find("znacka")
    text = (z.text or "").strip() if z is not None else ""
    return text or None


def _iter_polozky(element: ET.Element) -> Iterator[Tuple[int, ET.Element, Optional[str]]]:
    """Yield ``(row_index, element, object_code)`` for every ``<polozka>``.

    ``object_code`` is the ``<znacka>`` of the nearest enclosing ``<objekt>``,
    threaded down the recursion (ElementTree has no parent pointers). A nested
    ``<objekt>`` overrides its ancestor's code for its own subtree.
    """

    row_index = 0

    def _traverse(node: ET.Element, object_code: Optional[str]) -> Iterator[Tuple[ET.Element, Optional[str]]]:
        if node.tag == "polozka":
            yield node, object_code
            return
        if node.tag == "objekt":
            object_code = _objekt_znacka(node) or object_code
        for child in list(node):
            yield from _traverse(child, object_code)

    for polozka, object_code in _traverse(element, None):
        row_index += 1
        yield row_index, polozka, object_code


def parse_xml_tree(root: ET.Element) -> Tuple[List[Dict[str, object]], Dict[str, object]]:
    """Traverse the XC4 XML tree and collect position dictionaries."""

    positions: List[Dict[str, object]] = []
    diagnostics: Dict[str, object] = {"parsed": 0, "skipped": []}

    for row_index, polozka_element, object_code in _iter_polozky(root):
        result = parse_polozka(polozka_element, object_code)
        if result.position is not None:
            positions.append(result.position)
        else:
            diagnostics["skipped"].append({"row": row_index, "reason": result.reason})

    diagnostics["parsed"] = len(positions)
    return positions, diagnostics

