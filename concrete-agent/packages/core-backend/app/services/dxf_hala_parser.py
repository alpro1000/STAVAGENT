"""DXF parser for steel-hall (hala) drawings — hk212 task scope.

Isolated, minimal extractor. Does NOT share base class with the residential
``dxf_parser.py`` — that one targets ArchiCAD room codes / segment tags / door
openings, which do not exist in industrial hall drawings.

Extracts only what Phase 0b validation and Phase 1 BOQ generation need for
the hk212_hala project (steel frame + footings + envelope):

- INSERT block counts and per-instance attributes (sloupy, vaznice, okna,
  vrata, dveře, kotvící body, foundation footing pads)
- DIMENSION values (axis spacings, footing sizes, depths)
- TEXT / MTEXT content (with formatting prefixes stripped) grouped by layer
- HATCH counts per layer (foundation areas, floor zones)
- Closed LWPOLYLINE areas (slab outline, footing footprint, výkop footprint)
- XREF references (external drawings such as "2966-1 návrh dispozice strojů")
- Layer inventory and units

The function ``parse_hala_dxf(path)`` is the single public entry.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.document import Drawing

MTEXT_FORMAT_RE = re.compile(r"\\[A-Za-z][^;]*;")


def _strip_mtext_formatting(text: str) -> str:
    """Remove ezdxf MTEXT formatting codes like ``\\fArial|b1|i0|c238|p34;`` and ``\\W.7;``."""
    if not text:
        return ""
    cleaned = MTEXT_FORMAT_RE.sub("", text)
    cleaned = cleaned.replace("\\P", "\n").replace("{", "").replace("}", "")
    return cleaned.strip()


def _lwpolyline_area(entity) -> float | None:
    """Return signed area of a closed LWPOLYLINE in drawing units squared. None if not closed."""
    if not getattr(entity.dxf, "flags", 0) & 1 and not entity.is_closed:
        return None
    pts = [(p[0], p[1]) for p in entity.get_points("xy")]
    if len(pts) < 3:
        return None
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) * 0.5


def _polyline_area(entity) -> float | None:
    """Return area of a closed POLYLINE (older variant)."""
    if not getattr(entity, "is_closed", False):
        return None
    pts = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
    if len(pts) < 3:
        return None
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) * 0.5


def _collect_xrefs(doc: Drawing) -> list[dict[str, str]]:
    """Walk block layouts, return XREF / XREF_OVERLAY block names and file paths.

    XREF detection uses the BLOCK entity flags (bit 2 = XREF, bit 3 = XREF_OVERLAY)
    per DXF reference. ezdxf exposes the BLOCK entity via ``BlockLayout.block``.
    """
    xrefs: list[dict[str, str]] = []
    for block_layout in doc.blocks:
        block_entity = getattr(block_layout, "block", None)
        if block_entity is None:
            continue
        flags = getattr(block_entity.dxf, "flags", 0) or 0
        is_xref = bool(flags & 0b1100)
        if not is_xref:
            continue
        xref_path = getattr(block_entity.dxf, "xref_path", "") or ""
        xrefs.append({
            "block_name": block_layout.name,
            "xref_path": xref_path,
            "flags": flags,
        })
    return xrefs


def parse_hala_dxf(path: str | Path) -> dict[str, Any]:
    """Parse a steel-hall DXF and return a structured summary."""
    p = Path(path)
    doc = ezdxf.readfile(str(p))
    ms = doc.modelspace()

    # --- entity-type histogram ---
    entity_types = Counter(e.dxftype() for e in ms)

    # --- layer entity histogram ---
    layer_entities: Counter = Counter(e.dxf.layer for e in ms)

    # --- INSERTs: counts per block name + per-instance records ---
    block_counts: Counter = Counter()
    block_instances: list[dict[str, Any]] = []
    for e in ms.query("INSERT"):
        name = e.dxf.name
        block_counts[name] += 1
        attribs: dict[str, str] = {}
        for a in e.attribs:
            attribs[a.dxf.tag] = a.dxf.text
        block_instances.append({
            "name": name,
            "layer": e.dxf.layer,
            "insert": [e.dxf.insert.x, e.dxf.insert.y, e.dxf.insert.z],
            "rotation": getattr(e.dxf, "rotation", 0.0),
            "xscale": getattr(e.dxf, "xscale", 1.0),
            "yscale": getattr(e.dxf, "yscale", 1.0),
            "attribs": attribs or None,
        })

    # --- DIMENSIONs: measurement values + layer ---
    dimensions: list[dict[str, Any]] = []
    for e in ms.query("DIMENSION"):
        actual = e.get_measurement() if hasattr(e, "get_measurement") else None
        try:
            actual_float = float(actual) if actual is not None else None
        except (TypeError, ValueError):
            actual_float = None
        dimensions.append({
            "layer": e.dxf.layer,
            "actual": actual_float,
            "text_override": e.dxf.text if hasattr(e.dxf, "text") else "",
            "dimtype": e.dxf.dimtype if hasattr(e.dxf, "dimtype") else None,
        })

    # --- TEXT / MTEXT grouped by layer, formatting stripped ---
    text_entries: list[dict[str, Any]] = []
    for e in ms:
        t = e.dxftype()
        if t == "TEXT":
            raw = e.dxf.text
        elif t == "MTEXT":
            try:
                raw = e.plain_text()
            except Exception:
                raw = e.text
        else:
            continue
        cleaned = _strip_mtext_formatting(raw) if t == "MTEXT" else raw.strip()
        if not cleaned:
            continue
        text_entries.append({
            "type": t,
            "layer": e.dxf.layer,
            "text": cleaned,
            "insert": [e.dxf.insert.x, e.dxf.insert.y] if hasattr(e.dxf, "insert") else None,
        })

    # --- HATCH counts per layer ---
    hatch_per_layer: Counter = Counter(e.dxf.layer for e in ms.query("HATCH"))

    # --- closed polyline areas (drawing-units squared) ---
    closed_polys: list[dict[str, Any]] = []
    for e in ms.query("LWPOLYLINE"):
        area = _lwpolyline_area(e)
        if area is None or area < 1.0:
            continue
        closed_polys.append({"type": "LWPOLYLINE", "layer": e.dxf.layer, "area_units2": area})
    for e in ms.query("POLYLINE"):
        area = _polyline_area(e)
        if area is None or area < 1.0:
            continue
        closed_polys.append({"type": "POLYLINE", "layer": e.dxf.layer, "area_units2": area})

    # --- XREFs ---
    xrefs = _collect_xrefs(doc)

    # --- units (header $INSUNITS: 4=mm, 1=inch, 6=m, ...) ---
    insunits = doc.header.get("$INSUNITS", 0) or 0
    unit_label = {1: "inch", 4: "mm", 5: "cm", 6: "m"}.get(insunits, f"insunits={insunits}")

    return {
        "file": p.name,
        "units": unit_label,
        "entity_types": dict(entity_types),
        "layer_entity_counts": dict(layer_entities),
        "block_counts": dict(block_counts),
        "block_instances": block_instances,
        "dimensions": dimensions,
        "text_entries": text_entries,
        "hatch_per_layer": dict(hatch_per_layer),
        "closed_polylines": closed_polys,
        "xrefs": xrefs,
    }


def summarize_by_pattern(parsed: dict[str, Any], patterns: dict[str, str]) -> dict[str, int]:
    """Apply regex patterns to block names; return {pattern_label: total_instance_count}.

    Useful for counting "all variants of Sloup IPE - …" as one logical class.
    """
    out: dict[str, int] = {}
    for label, regex in patterns.items():
        rx = re.compile(regex)
        total = 0
        for name, count in parsed.get("block_counts", {}).items():
            if rx.search(name):
                total += count
        out[label] = total
    return out
