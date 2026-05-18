"""
UEP DXF extractor — Phase 1.

Universal, layer-agnostic exhaustive DXF extraction. Iterates the
modelspace once and emits:

* Layer inventory (every layer that has at least one entity).
* Per-(layer, entity_type) counts.
* Block inventory (every distinct INSERT block name + count + layer).
* Text inventory (TEXT / MTEXT raw values per layer + page position).
* Closed-polyline area aggregation per layer (m²) via shoelace.
* Open polyline length aggregation per layer (m).
* DXF header units + modelspace bbox + entity count totals.

Project-specific semantic parsing (room-code regex, AIA layer routing,
Czech MTEXT table decoding) is intentionally OUT of this universal
extractor — it lives in `services/dxf_parser.py` (Libuše AIA) and
`test-data/RD_Jachymov_dum/tools/dxf_comprehensive_extract.py` (Jáchymov
km_tabulka). The coverage matrix YAML maps universal facts to project-
type categories.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.1
Reference: test-data/RD_Jachymov_dum/tools/dxf_comprehensive_extract.py
           (canonical entity-type coverage; see commit message of the
           bootstrap commit for the SKILL doc rationale)
"""
from __future__ import annotations

import logging
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.lldxf.const import DXFError, DXFStructureError

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


# DXF header `$INSUNITS` enum → unit-to-metre scale. ezdxf exposes the
# raw enum; we apply the scale so all length facts are reported in metres.
# Reference: ezdxf docs `ezdxf.units.IUS`.
_INSUNITS_SCALE = {
    0: 1.0,        # Unitless — assume metres (most CZ ArchiCAD exports)
    1: 0.0254,     # Inches
    2: 0.3048,     # Feet
    4: 0.001,      # Millimetres
    5: 0.01,       # Centimetres
    6: 1.0,        # Metres
    14: 0.1,       # Decimetres
}


def _polyline_area_m2(points: list[tuple[float, float]]) -> float:
    """Shoelace area for closed 2-D polyline. Coordinates already in metres."""
    n = len(points)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _polyline_length_m(points: list[tuple[float, float]]) -> float:
    """Sum of Euclidean edge lengths."""
    n = len(points)
    if n < 2:
        return 0.0
    s = 0.0
    for i in range(n - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        s += math.hypot(x2 - x1, y2 - y1)
    return s


def _lwpolyline_points(entity: Any) -> list[tuple[float, float]]:
    """Extract (x, y) vertex sequence from LWPOLYLINE."""
    return [(p[0], p[1]) for p in entity.get_points("xy")]


def _polyline_points(entity: Any) -> list[tuple[float, float]]:
    """Extract (x, y) vertex sequence from heavy POLYLINE."""
    return [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]


class DxfExtractor(BaseExtractor):
    """Universal DXF extractor using ezdxf."""

    source_format = SourceFormat.DXF
    extractor_id = "uep.dxf_extractor"
    extractor_version = "1.0"
    # Per task §3.1 confidence band for native DXF is 0.85–1.00. Headline
    # entity counts are exact (1.00); we keep file-level at 0.95 to leave
    # room for downstream geometry-quality flags from reconciliation (PR2).
    default_confidence = 0.95

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        decode_warnings: list[dict[str, Any]] = []

        try:
            doc = ezdxf.readfile(str(path))
        except (DXFError, DXFStructureError) as exc:
            # Try recover() for partially corrupt files — ezdxf docs §recover.
            try:
                doc, audit = ezdxf.recover.readfile(str(path))
                if audit.has_errors:
                    decode_warnings.append(
                        {
                            "code": "dxf_recovered",
                            "message": f"DXF read via recover(); {len(audit.errors)} errors auto-fixed",
                            "error_count": len(audit.errors),
                        }
                    )
            except Exception as recover_exc:  # noqa: BLE001
                raise ExtractorError(
                    f"DXF parse failed (primary + recover): {exc}; recover: {recover_exc}"
                ) from exc

        units_enum = int(doc.header.get("$INSUNITS", 0))
        scale = _INSUNITS_SCALE.get(units_enum, 1.0)
        if units_enum not in _INSUNITS_SCALE:
            decode_warnings.append(
                {
                    "code": "unknown_units",
                    "message": f"$INSUNITS={units_enum} not in known table — assuming metres",
                    "insunits": units_enum,
                }
            )

        msp = doc.modelspace()

        # Aggregators.
        entity_counts_by_layer: dict[str, Counter[str]] = defaultdict(Counter)
        block_counts: Counter[tuple[str, str]] = Counter()  # (block_name, layer)
        text_by_layer: dict[str, list[dict[str, Any]]] = defaultdict(list)
        closed_areas_by_layer: dict[str, list[float]] = defaultdict(list)
        open_lengths_by_layer: dict[str, list[float]] = defaultdict(list)
        layers_seen: set[str] = set()
        block_attribs: list[dict[str, Any]] = []
        dimensions_seen: list[dict[str, Any]] = []
        bbox_x: list[float] = []
        bbox_y: list[float] = []

        # Single modelspace iteration — never silently skip an entity type.
        for entity in msp:
            etype = entity.dxftype()
            layer = getattr(entity.dxf, "layer", "0")
            layers_seen.add(layer)
            entity_counts_by_layer[layer][etype] += 1

            try:
                if etype == "LWPOLYLINE":
                    points = _lwpolyline_points(entity)
                    if scale != 1.0:
                        points = [(x * scale, y * scale) for x, y in points]
                    if entity.closed and len(points) >= 3:
                        area = _polyline_area_m2(points)
                        if area > 0.0:
                            closed_areas_by_layer[layer].append(area)
                    else:
                        length = _polyline_length_m(points)
                        if length > 0.0:
                            open_lengths_by_layer[layer].append(length)
                    for x, y in points:
                        bbox_x.append(x)
                        bbox_y.append(y)

                elif etype == "POLYLINE":
                    points = _polyline_points(entity)
                    if scale != 1.0:
                        points = [(x * scale, y * scale) for x, y in points]
                    closed = bool(getattr(entity, "is_closed", False))
                    if closed and len(points) >= 3:
                        area = _polyline_area_m2(points)
                        if area > 0.0:
                            closed_areas_by_layer[layer].append(area)
                    else:
                        length = _polyline_length_m(points)
                        if length > 0.0:
                            open_lengths_by_layer[layer].append(length)
                    for x, y in points:
                        bbox_x.append(x)
                        bbox_y.append(y)

                elif etype == "LINE":
                    start = (entity.dxf.start.x * scale, entity.dxf.start.y * scale)
                    end = (entity.dxf.end.x * scale, entity.dxf.end.y * scale)
                    length = math.hypot(end[0] - start[0], end[1] - start[1])
                    if length > 0.0:
                        open_lengths_by_layer[layer].append(length)
                    bbox_x.extend([start[0], end[0]])
                    bbox_y.extend([start[1], end[1]])

                elif etype in ("TEXT", "MTEXT"):
                    raw = (
                        entity.dxf.text
                        if etype == "TEXT"
                        else getattr(entity, "text", "")
                    )
                    if raw:
                        # `plain_text()` strips MTEXT format codes when available.
                        if etype == "MTEXT" and hasattr(entity, "plain_text"):
                            try:
                                clean = entity.plain_text()
                            except Exception:  # noqa: BLE001
                                clean = raw
                        else:
                            clean = raw
                        ins = (
                            entity.dxf.insert
                            if etype == "MTEXT"
                            else getattr(entity.dxf, "insert", None)
                        )
                        pos = None
                        if ins is not None:
                            pos = [ins.x * scale, ins.y * scale]
                            bbox_x.append(pos[0])
                            bbox_y.append(pos[1])
                        text_by_layer[layer].append(
                            {
                                "type": etype,
                                "raw": raw,
                                "text": clean,
                                "insert": pos,
                            }
                        )

                elif etype == "INSERT":
                    block_name = entity.dxf.name
                    block_counts[(block_name, layer)] += 1
                    ins = entity.dxf.insert
                    bbox_x.append(ins.x * scale)
                    bbox_y.append(ins.y * scale)
                    # ATTRIB iteration — captures door/window/room IDs that
                    # ArchiCAD / Allplan emit per INSERT.
                    for attrib in entity.attribs:
                        block_attribs.append(
                            {
                                "block": block_name,
                                "tag": attrib.dxf.tag,
                                "text": attrib.dxf.text,
                                "layer": layer,
                            }
                        )

                elif etype in ("DIMENSION", "ALIGNED_DIMENSION", "ROTATED_DIMENSION"):
                    measurement = getattr(entity.dxf, "actual_measurement", None)
                    dimensions_seen.append(
                        {
                            "type": etype,
                            "layer": layer,
                            "measurement_m": (measurement * scale) if measurement else None,
                            "text_override": getattr(entity.dxf, "text", "") or None,
                        }
                    )

                elif etype == "HATCH":
                    # HATCH boundary paths may be long; we record count only
                    # (paths_count) — geometry path extraction is a PR2/PR3 concern.
                    n_paths = len(getattr(entity, "paths", []) or [])
                    entity_counts_by_layer[layer][f"HATCH_paths={n_paths}"] += 1

                # Other types (CIRCLE, ARC, ELLIPSE, SPLINE, IMAGE, LEADER,
                # MLEADER, …) are counted via entity_counts_by_layer above;
                # we don't extract geometry from them in PR1 baseline.

            except Exception as exc:  # noqa: BLE001 — never silent skip per task §1.2
                decode_warnings.append(
                    {
                        "code": "entity_decode",
                        "message": f"{etype} on layer {layer!r}: {exc}",
                        "entity_type": etype,
                        "layer": layer,
                    }
                )

        # Layer-level catalogue from doc.layers — includes empty layers.
        # ezdxf raises on iteration of some malformed files; defensive try.
        try:
            layer_catalogue = sorted(layer.dxf.name for layer in doc.layers)
        except Exception:  # noqa: BLE001
            layer_catalogue = sorted(layers_seen)

        # Block definitions inventory (handy to spot referenced-but-unused
        # blocks, or shared blocks per drawing).
        try:
            block_defs = sorted(b.name for b in doc.blocks if not b.name.startswith("*"))
        except Exception:  # noqa: BLE001
            block_defs = []

        total_entities = sum(sum(c.values()) for c in entity_counts_by_layer.values())

        bbox = None
        if bbox_x and bbox_y:
            bbox = {
                "x_min_m": min(bbox_x),
                "y_min_m": min(bbox_y),
                "x_max_m": max(bbox_x),
                "y_max_m": max(bbox_y),
                "width_m": max(bbox_x) - min(bbox_x),
                "height_m": max(bbox_y) - min(bbox_y),
            }

        # ------------------------------------------------------------------
        # Build universal facts. Categories follow the residential matrix
        # in `app/knowledge_base/B11_coverage_matrices/coverage_matrix_residential.yaml`.
        # ------------------------------------------------------------------
        facts: list[ExtractedFact] = []

        facts.append(
            ExtractedFact(
                category="dxf_meta",
                field="entity_count_total",
                value=total_entities,
                unit="ks",
                confidence=1.0,
                evidence={"insunits_enum": units_enum, "scale_to_m": scale},
            )
        )
        facts.append(
            ExtractedFact(
                category="dxf_meta",
                field="layer_count",
                value=len(layer_catalogue),
                unit="ks",
                confidence=1.0,
                evidence={"layers": layer_catalogue[:50]},  # truncate for log readability
            )
        )
        facts.append(
            ExtractedFact(
                category="dxf_meta",
                field="block_definition_count",
                value=len(block_defs),
                unit="ks",
                confidence=1.0,
                evidence={"blocks": block_defs[:50]},
            )
        )
        if bbox:
            facts.append(
                ExtractedFact(
                    category="dxf_meta",
                    field="modelspace_bbox",
                    value=bbox,
                    unit="m",
                    confidence=1.0,
                    evidence={},
                )
            )

        # Per-layer entity counts as facts. Useful for the coverage matrix
        # to detect "rooms are on layer IP_obrysy" etc. without us hardcoding
        # layer names here.
        for layer, counts in sorted(entity_counts_by_layer.items()):
            facts.append(
                ExtractedFact(
                    category="layer_inventory",
                    field=layer,
                    value=dict(counts),
                    unit="ks",
                    confidence=1.0,
                    evidence={"total": sum(counts.values())},
                )
            )

        # Closed-polygon areas per layer — the matrix decides which layers
        # count as rooms/floor/roof.
        for layer, areas in sorted(closed_areas_by_layer.items()):
            facts.append(
                ExtractedFact(
                    category="closed_polygons",
                    field=layer,
                    value={
                        "count": len(areas),
                        "areas_m2": [round(a, 3) for a in areas],
                        "sum_m2": round(sum(areas), 3),
                    },
                    unit="m2",
                    confidence=0.90,  # depends on layer being clean (matrix decides)
                    evidence={},
                )
            )

        # Open polyline + LINE lengths per layer — walls, edges, dimensions.
        for layer, lengths in sorted(open_lengths_by_layer.items()):
            facts.append(
                ExtractedFact(
                    category="open_polylines",
                    field=layer,
                    value={
                        "count": len(lengths),
                        "sum_m": round(sum(lengths), 3),
                    },
                    unit="m",
                    confidence=0.90,
                    evidence={},
                )
            )

        # Block (INSERT) inventory by name+layer — doors/windows/sanitar/etc.
        # Aggregate per block_name across layers for easy querying.
        per_block: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "layers": Counter()}
        )
        for (block_name, layer), count in block_counts.items():
            per_block[block_name]["count"] += count
            per_block[block_name]["layers"][layer] += count
        for block_name, info in sorted(per_block.items()):
            facts.append(
                ExtractedFact(
                    category="block_inventory",
                    field=block_name,
                    value={
                        "count": info["count"],
                        "by_layer": dict(info["layers"]),
                    },
                    unit="ks",
                    confidence=1.0,
                    evidence={},
                )
            )

        # Text inventory aggregated per layer (counts; full text dumped to raw_data).
        for layer, items in sorted(text_by_layer.items()):
            facts.append(
                ExtractedFact(
                    category="text_inventory",
                    field=layer,
                    value={
                        "count": len(items),
                        "by_type": dict(Counter(i["type"] for i in items)),
                    },
                    unit="ks",
                    confidence=1.0,
                    evidence={"sample_text": items[0]["text"][:120] if items else ""},
                )
            )

        if dimensions_seen:
            facts.append(
                ExtractedFact(
                    category="dimensions",
                    field="count",
                    value=len(dimensions_seen),
                    unit="ks",
                    confidence=1.0,
                    evidence={},
                )
            )

        if block_attribs:
            facts.append(
                ExtractedFact(
                    category="block_attribs",
                    field="count",
                    value=len(block_attribs),
                    unit="ks",
                    confidence=1.0,
                    evidence={"sample": block_attribs[:5]},
                )
            )

        # ------------------------------------------------------------------
        # Raw data — everything not summarised into facts, for downstream
        # phases (reconciliation + derivation in PR2) and audit replay.
        # ------------------------------------------------------------------
        raw_data: dict[str, Any] = {
            "header": {
                "insunits": units_enum,
                "scale_to_m": scale,
                "dxf_version": doc.dxfversion,
            },
            "layers": layer_catalogue,
            "block_definitions": block_defs,
            "entity_counts_by_layer": {
                layer: dict(counts) for layer, counts in entity_counts_by_layer.items()
            },
            "closed_areas_by_layer": {
                layer: [round(a, 3) for a in areas]
                for layer, areas in closed_areas_by_layer.items()
            },
            "open_lengths_by_layer": {
                layer: [round(length, 3) for length in lengths]
                for layer, lengths in open_lengths_by_layer.items()
            },
            "block_counts_by_layer": [
                {"block": name, "layer": layer, "count": count}
                for (name, layer), count in sorted(block_counts.items())
            ],
            "text_by_layer": dict(text_by_layer),
            "dimensions": dimensions_seen,
            "block_attribs": block_attribs,
            "bbox": bbox,
        }

        return facts, raw_data, decode_warnings
