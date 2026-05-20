"""
UEP UNIXML extractor — PR3 §3.4.

Reads Czech KROS / RTS / ÚRS UNIXML soupis files (the canonical
exchange format for výkaz výměr / soupis prací) and emits universal
`ExtractedFact` records. UNIXML inside KROS exports varies slightly
across vendors — we accept both the Aspe / KROS "stavba > díl > položka"
tree and the flatter cenová soustava layout used by ÚRS.

Mapping per v3 §15.5:

  <stavba>                                  → project_identification
  <objekt>                                  → project_identification (object)
  <díl> / <oddíl>                          → quantities (per oddíl group)
  <položka kod="…" mj="m3" mnozstvi="…">  → quantities (one fact per item)
  ceny[@cenova_soustava] (OTSKP / ÚRS …)  → norm_references
  poznámka (free text)                      → referenced_documents

Each <položka> emits ONE fact in category `quantities` with field set
to the unit-of-measure (`m3`, `m2`, `t`, `kg`, `ks` …). The numeric
quantity sits on `value`; the OTSKP/ÚRS code lives in `evidence.code`
so the reconciliation engine can join soupis ↔ TZ on that key.

Confidence baseline 0.95 — UNIXML is the authoritative exchange
format; the only risk is encoding (Windows-1250 vs UTF-8) which the
parser auto-detects.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.5
Reference: docs/tasks/TASK_UEP_PR3.md §3.4
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Element name aliases — UNIXML vendors don't agree on capitalisation or
# attribute names. We strip namespaces and lower-case the local name so the
# same matcher works against Aspe / KROS / ÚRS / RTS exports.
# ---------------------------------------------------------------------------

_STAVBA_TAGS = {"stavba", "construction", "project"}
_OBJEKT_TAGS = {"objekt", "object", "sektor", "section"}
_DIL_TAGS = {"dil", "oddil", "kapitola", "skupina", "group"}
_POLOZKA_TAGS = {"polozka", "polozky", "item", "row"}

# Attribute aliases per item — order matters (first hit wins).
_CODE_ATTRS = ("kod", "code", "cislo", "polozka_kod", "ID")
_NAME_ATTRS = ("nazev", "name", "popis", "description", "text")
_UNIT_ATTRS = ("mj", "unit", "merna_jednotka", "jednotka")
_QTY_ATTRS = ("mnozstvi", "qty", "quantity", "vymera", "value")
_PRICE_ATTRS = ("cena", "price", "jednotkova_cena", "cena_jednotkova", "cena_celkem")

# Cenová soustava attribute names — drives the OTSKP / ÚRS routing.
_CS_ATTRS = ("cenova_soustava", "ceny_id", "cenik", "katalog")

# Normalise decimal: KROS emits "1 234,56" (cs-CZ); ÚRS sometimes plain.
_THOUSANDS_RE = re.compile(r"[ \s]")


def _localname(tag: str) -> str:
    """Strip XML namespace + lowercase."""

    if "}" in tag:
        tag = tag.rsplit("}", 1)[1]
    return tag.lower()


def _attr_any(elem: ET.Element, names: tuple[str, ...]) -> str | None:
    """Return first attribute value found, or None."""

    for name in names:
        if name in elem.attrib:
            return elem.attrib[name].strip()
        # Try lower-case alternative — some exports upper-case attrs.
        low = name.lower()
        for actual in elem.attrib:
            if actual.lower() == low:
                return elem.attrib[actual].strip()
    return None


def _child_text(elem: ET.Element, names: tuple[str, ...]) -> str | None:
    """Some vendors put the value in a child element, not an attribute."""

    for child in elem:
        if _localname(child.tag) in {n.lower() for n in names}:
            txt = (child.text or "").strip()
            if txt:
                return txt
    return None


def _parse_cs_number(raw: str | None) -> float | None:
    """Parse Czech-style decimal: "1 234,56" → 1234.56."""

    if raw is None:
        return None
    s = _THOUSANDS_RE.sub("", raw).replace(",", ".")
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Extractor
# ---------------------------------------------------------------------------


class UnixmlExtractor(BaseExtractor):
    """KROS / RTS / ÚRS UNIXML soupis extractor."""

    source_format = SourceFormat.XML_UNIXML
    extractor_id = "uep.unixml_extractor"
    extractor_version = "1.0"
    default_confidence = 0.95

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        try:
            tree = ET.parse(path)
        except ET.ParseError as exc:
            raise ExtractorError(f"UNIXML parse failed: {exc}") from exc
        root = tree.getroot()

        decode_warnings: list[dict[str, Any]] = []
        facts: list[ExtractedFact] = []
        raw_data: dict[str, Any] = {
            "root_tag": _localname(root.tag),
            "namespaces": _collect_namespaces(root),
            "item_count": 0,
            "objekt_count": 0,
            "cenova_soustava_seen": [],
        }

        # Walk the tree once. We don't assume any fixed depth — the same
        # <položka> can sit under stavba/objekt/díl OR directly under
        # stavba/díl for flat exports.
        cs_seen: set[str] = set()
        for elem in root.iter():
            local = _localname(elem.tag)
            if local in _STAVBA_TAGS:
                facts.extend(_emit_stavba(elem))
            elif local in _OBJEKT_TAGS:
                raw_data["objekt_count"] += 1
                facts.extend(_emit_objekt(elem))
            elif local in _POLOZKA_TAGS:
                cs = _attr_any(elem, _CS_ATTRS)
                if cs:
                    cs_seen.add(cs)
                fact = _emit_polozka(elem, decode_warnings)
                if fact is not None:
                    facts.append(fact)
                    raw_data["item_count"] += 1

        raw_data["cenova_soustava_seen"] = sorted(cs_seen)

        if raw_data["item_count"] == 0:
            decode_warnings.append({
                "code": "unixml_no_polozka",
                "message": (
                    "UNIXML root parsed but no <polozka> elements found — "
                    "file may be a price list (cenová soustava) only, "
                    "not a project soupis."
                ),
                "root_tag": raw_data["root_tag"],
            })

        return facts, raw_data, decode_warnings


# ---------------------------------------------------------------------------
# Per-element emitters
# ---------------------------------------------------------------------------


def _emit_stavba(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr_any(elem, _NAME_ATTRS) or _child_text(elem, _NAME_ATTRS)
    if not name:
        return
    yield ExtractedFact(
        category="project_identification",
        field="stavba_nazev",
        value=name,
        unit=None,
        confidence=0.95,
        evidence={"source": "unixml.stavba"},
    )


def _emit_objekt(elem: ET.Element) -> Iterable[ExtractedFact]:
    name = _attr_any(elem, _NAME_ATTRS) or _child_text(elem, _NAME_ATTRS)
    code = _attr_any(elem, _CODE_ATTRS)
    if not (name or code):
        return
    yield ExtractedFact(
        category="project_identification",
        field="objekt",
        value=name or code,
        unit=None,
        confidence=0.92,
        evidence={"source": "unixml.objekt", "code": code},
    )


def _emit_polozka(
    elem: ET.Element, warnings: list[dict[str, Any]]
) -> ExtractedFact | None:
    """One UNIXML <položka> → one fact in `quantities`."""

    code = _attr_any(elem, _CODE_ATTRS) or _child_text(elem, _CODE_ATTRS)
    qty = _parse_cs_number(
        _attr_any(elem, _QTY_ATTRS) or _child_text(elem, _QTY_ATTRS)
    )
    unit = _attr_any(elem, _UNIT_ATTRS) or _child_text(elem, _UNIT_ATTRS)
    name = _attr_any(elem, _NAME_ATTRS) or _child_text(elem, _NAME_ATTRS) or ""

    if qty is None or qty <= 0:
        # Silent skip would violate "no silent drop" — emit a warning.
        warnings.append({
            "code": "unixml_skipped_polozka",
            "message": f"polozka without numeric quantity skipped (code={code})",
            "polozka_code": code,
        })
        return None

    # Map UNIXML mj string → category field. The unit lives on `.unit`;
    # `.field` carries a stable string so downstream reconciliation can
    # group by unit type without parsing free-form text.
    field_for_unit = _normalise_unit(unit)

    cs = _attr_any(elem, _CS_ATTRS)
    price = _parse_cs_number(_attr_any(elem, _PRICE_ATTRS))

    return ExtractedFact(
        category="quantities",
        field=field_for_unit,
        value=qty,
        unit=unit,
        confidence=0.95,
        evidence={
            "source": "unixml.polozka",
            "code": code,
            "name": name,
            "cenova_soustava": cs,
            "unit_price_czk": price,
        },
    )


_UNIT_FIELD_MAP = {
    "m3": "volume_m3",
    "m³": "volume_m3",
    "m2": "area_m2",
    "m²": "area_m2",
    "m": "length_m",
    "bm": "length_m",
    "mb": "length_m",
    "t": "mass_t",
    "kg": "mass_kg",
    "ks": "count_ks",
    "kus": "count_ks",
    "hod": "labor_h",
    "h": "labor_h",
    "soubor": "lump_sum",
    "ks.": "count_ks",
}


def _normalise_unit(unit: str | None) -> str:
    """Map UNIXML 'mj' string to canonical field name."""

    if not unit:
        return "quantity"
    return _UNIT_FIELD_MAP.get(unit.strip().lower(), "quantity")


def _collect_namespaces(root: ET.Element) -> list[str]:
    """Headline namespace inventory (helps the operator spot vendor)."""

    out: set[str] = set()
    for elem in root.iter():
        tag = elem.tag
        if tag.startswith("{") and "}" in tag:
            out.add(tag[1: tag.index("}")])
    return sorted(out)
