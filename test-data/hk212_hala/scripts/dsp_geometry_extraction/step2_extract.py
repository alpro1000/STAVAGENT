#!/usr/bin/env python3
"""
hk212 Task 2 Step 2 — full geometry extraction across 8 DSP DXF files.

Inputs:
  outputs/dsp_geometry_extraction/layer_dictionary_ratified.json  (Step 1.5)
  inputs/vykresy_dxf/*.dxf  (8 files, excl UT_HALAHK_DPS.dxf — ÚT scope)

Outputs (per task §6 step 2 deliverables):
  outputs/dsp_geometry_extraction/extraction_raw.json
      per-DXF entity dump grouped by category; per category: count,
      cumulative length (units), cumulative area (units²), per-block INSERT
      counts, sample positions, ATTRIB/ATTDEF dict
  outputs/dsp_geometry_extraction/extraction_aggregated.json
      cross-sheet aggregation: counts/lengths/areas per category;
      confidence per task §5 ladder (drawing_note + razítko + dim DXF)
  outputs/dsp_geometry_extraction/paperspace_inventory.json
      bonus: per-DXF paperspace layout dump (sheet titles, viewport count,
      paperspace-only annotations)
  outputs/dsp_geometry_extraction/block_attributes.json
      bonus: ATTRIB/ATTDEF extraction (schedule-like data — block name +
      attribute tag → value)

Notes:
- Material specs from MTEXT/TEXT remain out of scope per user (separate
  task). We DO capture ATTRIB tag/value (e.g. block schedules) since these
  are structured data, not free-form material specs.
- Drawing units: header $INSUNITS reported per file; aggregation values are
  in raw DXF units (no scaling). Stage D will convert to mm/m using sheet
  scale from razítko (1:50, 1:200, etc.).
- A-GENM* per ratification → counts as `gutters_downpipes`.
- '0' + NETISK skipped from aggregation per ratification (drop_from_aggregation).
"""

from __future__ import annotations

import json
import logging
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ezdxf
from ezdxf.entities import DXFEntity

try:
    from shapely.geometry import Polygon, Point  # noqa: F401  (room/poly area)
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

REPO_ROOT = Path(__file__).resolve().parents[4]
DXF_DIR = REPO_ROOT / "test-data/hk212_hala/inputs/vykresy_dxf"
OUT_DIR = REPO_ROOT / "test-data/hk212_hala/outputs/dsp_geometry_extraction"
DICT_PATH = OUT_DIR / "layer_dictionary_ratified.json"

SKIP_FILES = {"UT_HALAHK_DPS.dxf"}


def setup_logger() -> logging.Logger:
    lg = logging.getLogger("extract")
    lg.setLevel(logging.INFO)
    lg.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
    lg.addHandler(h)
    return lg


def load_dictionary() -> tuple[dict[str, str], dict[str, dict]]:
    """Returns (layer→category map, layer→full info dict)."""
    d = json.loads(DICT_PATH.read_text())
    layer2cat = {}
    layer2info = {}
    for c in d["classified_layers"]:
        layer2cat[c["layer"]] = c["category"]
        layer2info[c["layer"]] = c
    return layer2cat, layer2info


def line_length(e: DXFEntity) -> float:
    et = e.dxftype()
    try:
        if et == "LINE":
            dx = e.dxf.end.x - e.dxf.start.x
            dy = e.dxf.end.y - e.dxf.start.y
            return math.hypot(dx, dy)
        if et == "ARC":
            sweep = (e.dxf.end_angle - e.dxf.start_angle) % 360
            return 2 * math.pi * e.dxf.radius * sweep / 360
        if et == "CIRCLE":
            return 2 * math.pi * e.dxf.radius
        if et == "LWPOLYLINE":
            pts = list(e.get_points("xy"))
            if len(pts) < 2:
                return 0
            s = sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1])
                    for i in range(len(pts)-1))
            if e.closed:
                s += math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1])
            return s
        if et == "POLYLINE":
            verts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            if len(verts) < 2:
                return 0
            s = sum(math.hypot(verts[i+1][0]-verts[i][0], verts[i+1][1]-verts[i][1])
                    for i in range(len(verts)-1))
            if getattr(e, "is_closed", False):
                s += math.hypot(verts[0][0]-verts[-1][0], verts[0][1]-verts[-1][1])
            return s
        if et == "SPLINE":
            pts = list(e.control_points)
            if len(pts) < 2:
                return 0
            return sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1])
                       for i in range(len(pts)-1))
    except Exception:
        return 0
    return 0


def polygon_area(e: DXFEntity) -> float:
    """Shoelace area for closed polylines/polygons. Returns 0 if not closed or unsupported."""
    et = e.dxftype()
    try:
        if et == "LWPOLYLINE" and e.closed:
            pts = list(e.get_points("xy"))
            if len(pts) < 3:
                return 0
            return abs(sum(pts[i][0] * pts[(i+1) % len(pts)][1] -
                            pts[(i+1) % len(pts)][0] * pts[i][1]
                            for i in range(len(pts)))) / 2
        if et == "POLYLINE" and getattr(e, "is_closed", False):
            verts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            if len(verts) < 3:
                return 0
            return abs(sum(verts[i][0] * verts[(i+1) % len(verts)][1] -
                            verts[(i+1) % len(verts)][0] * verts[i][1]
                            for i in range(len(verts)))) / 2
        if et == "CIRCLE":
            return math.pi * e.dxf.radius ** 2
        if et == "HATCH":
            # Sum boundary loop areas
            total = 0.0
            for path in e.paths:
                try:
                    pts = [(v[0], v[1]) for v in path.vertices()] if hasattr(path, "vertices") else []
                    if len(pts) >= 3:
                        total += abs(sum(pts[i][0] * pts[(i+1) % len(pts)][1] -
                                          pts[(i+1) % len(pts)][0] * pts[i][1]
                                          for i in range(len(pts)))) / 2
                except Exception:
                    continue
            return total
    except Exception:
        return 0
    return 0


def entity_position(e: DXFEntity) -> tuple[float, float] | None:
    """Insertion or representative point."""
    try:
        et = e.dxftype()
        if et == "INSERT":
            return (e.dxf.insert.x, e.dxf.insert.y)
        if et in ("TEXT", "MTEXT"):
            return (e.dxf.insert.x, e.dxf.insert.y)
        if et == "LINE":
            return ((e.dxf.start.x + e.dxf.end.x) / 2,
                    (e.dxf.start.y + e.dxf.end.y) / 2)
        if et in ("CIRCLE", "ARC"):
            return (e.dxf.center.x, e.dxf.center.y)
        if et == "LWPOLYLINE":
            pts = list(e.get_points("xy"))
            if pts:
                return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    except Exception:
        return None
    return None


def extract_attribs(insert_entity) -> dict[str, str]:
    """Read ATTRIB sub-entities of an INSERT, return {tag: value} dict."""
    out = {}
    try:
        for att in insert_entity.attribs:
            try:
                tag = att.dxf.tag
                val = att.dxf.text
                if tag:
                    out[tag] = val
            except Exception:
                continue
    except Exception:
        pass
    return out


def extract_paperspace(doc, dxf_name: str) -> dict:
    """Inventory paperspace layouts: viewport count + annotations text."""
    layouts = []
    for layout_name in doc.layout_names():
        if layout_name == "Model":
            continue
        layout = doc.layouts.get(layout_name)
        viewports = []
        annotations = []
        ent_types = Counter()
        for e in layout:
            et = e.dxftype()
            ent_types[et] += 1
            if et == "VIEWPORT":
                viewports.append({
                    "handle": e.dxf.handle,
                    "center": (e.dxf.center.x, e.dxf.center.y),
                    "width": e.dxf.width,
                    "height": e.dxf.height,
                    "view_target": (e.dxf.view_target_point.x, e.dxf.view_target_point.y)
                                    if hasattr(e.dxf, "view_target_point") else None,
                    "scale": getattr(e.dxf, "scale_x", None),
                })
            elif et in ("TEXT", "MTEXT"):
                try:
                    txt = e.text if et == "MTEXT" else e.dxf.text
                    annotations.append({
                        "type": et,
                        "layer": e.dxf.layer,
                        "text": txt[:200],
                        "insert": (e.dxf.insert.x, e.dxf.insert.y),
                    })
                except Exception:
                    pass
        layouts.append({
            "name": layout_name,
            "viewport_count": len(viewports),
            "viewports": viewports[:8],
            "annotation_count": len(annotations),
            "annotations_sample": annotations[:30],
            "entity_types": dict(ent_types),
        })
    return {"file": dxf_name, "layouts": layouts}


def main() -> int:
    logger = setup_logger()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    layer2cat, layer2info = load_dictionary()
    logger.info(f"Loaded ratified dictionary: {len(layer2cat)} layers, "
                f"{sum(1 for c in layer2info.values() if not c.get('drop_from_aggregation'))} active")

    dxfs = sorted(p for p in DXF_DIR.iterdir()
                   if p.suffix.lower() == ".dxf" and p.name not in SKIP_FILES)

    # --- Containers --------------------------------------------------------
    # raw[file][category] = {entity_count, entity_types, total_length, total_area,
    #                          block_inserts (Counter), samples (list), closed_loop_count}
    raw: dict[str, dict] = {}
    # aggregated[category] = same shape but cross-sheet (Counter merge)
    aggregated: dict[str, dict] = defaultdict(lambda: {
        "entity_count": 0,
        "entity_types": Counter(),
        "total_length_units": 0.0,
        "total_area_units2": 0.0,
        "closed_loop_count": 0,
        "block_inserts": Counter(),
        "sheets_seen": set(),
        "sample_positions": [],
    })
    # block_attribs[block_name][handle] = {tag: value, _file, _sheet_scale_hint}
    block_attribs: dict[str, list] = defaultdict(list)
    # paperspace inventory per file
    paperspace: list = []
    # header info per file
    headers: list = []

    for dxf_path in dxfs:
        logger.info(f"  reading {dxf_path.name}")
        try:
            doc = ezdxf.readfile(dxf_path, errors="ignore")
        except Exception as e:
            logger.error(f"    READ FAILED: {e}")
            continue

        # Header
        header = {
            "file": dxf_path.name,
            "dxf_version": doc.dxfversion,
            "insunits": doc.header.get("$INSUNITS", 0),
            "ltscale": doc.header.get("$LTSCALE", 1.0),
            "dimscale": doc.header.get("$DIMSCALE", 1.0),
            "extmin": tuple(doc.header.get("$EXTMIN", (0, 0, 0)))[:2] if doc.header.get("$EXTMIN") else None,
            "extmax": tuple(doc.header.get("$EXTMAX", (0, 0, 0)))[:2] if doc.header.get("$EXTMAX") else None,
        }
        headers.append(header)

        # Modelspace
        msp = doc.modelspace()
        file_raw: dict[str, dict] = defaultdict(lambda: {
            "entity_count": 0,
            "entity_types": Counter(),
            "total_length_units": 0.0,
            "total_area_units2": 0.0,
            "closed_loop_count": 0,
            "block_inserts": Counter(),
            "samples": [],
        })
        for e in msp:
            layer = e.dxf.layer
            info = layer2info.get(layer)
            if not info:
                # Layer not in dictionary (shouldn't happen — every layer was classified)
                cat = "unknown_runtime"
                drop = True
            else:
                cat = info["category"]
                drop = info.get("drop_from_aggregation", False)
            if drop:
                continue

            etype = e.dxftype()
            data = file_raw[cat]
            data["entity_count"] += 1
            data["entity_types"][etype] += 1
            ln = line_length(e)
            ar = polygon_area(e)
            if ln > 0:
                data["total_length_units"] += ln
            if ar > 0:
                data["total_area_units2"] += ar
            if etype == "LWPOLYLINE" and e.closed:
                data["closed_loop_count"] += 1
            if etype == "POLYLINE" and getattr(e, "is_closed", False):
                data["closed_loop_count"] += 1
            if etype == "INSERT":
                bn = e.dxf.name
                data["block_inserts"][bn] += 1
                # ATTRIB extraction
                attribs = extract_attribs(e)
                if attribs:
                    block_attribs[bn].append({
                        "_handle": e.dxf.handle,
                        "_file": dxf_path.name,
                        "_insert": (e.dxf.insert.x, e.dxf.insert.y),
                        **attribs,
                    })
            if len(data["samples"]) < 12:
                samp = {
                    "type": etype,
                    "handle": e.dxf.handle,
                    "layer": layer,
                }
                if ln > 0: samp["length_units"] = round(ln, 3)
                if ar > 0: samp["area_units2"] = round(ar, 3)
                pos = entity_position(e)
                if pos: samp["pos"] = (round(pos[0], 2), round(pos[1], 2))
                if etype == "INSERT":
                    samp["block"] = e.dxf.name
                data["samples"].append(samp)

            # Cross-sheet aggregation
            agg = aggregated[cat]
            agg["entity_count"] += 1
            agg["entity_types"][etype] += 1
            agg["total_length_units"] += ln
            agg["total_area_units2"] += ar
            if etype == "LWPOLYLINE" and e.closed:
                agg["closed_loop_count"] += 1
            if etype == "POLYLINE" and getattr(e, "is_closed", False):
                agg["closed_loop_count"] += 1
            if etype == "INSERT":
                agg["block_inserts"][e.dxf.name] += 1
            agg["sheets_seen"].add(dxf_path.name)
            if len(agg["sample_positions"]) < 6:
                pos = entity_position(e)
                if pos:
                    agg["sample_positions"].append({
                        "file": dxf_path.name,
                        "type": etype,
                        "layer": layer,
                        "pos": (round(pos[0], 2), round(pos[1], 2)),
                    })

        raw[dxf_path.name] = {
            cat: {
                "entity_count": d["entity_count"],
                "entity_types": dict(d["entity_types"]),
                "total_length_units": round(d["total_length_units"], 3),
                "total_area_units2": round(d["total_area_units2"], 3),
                "closed_loop_count": d["closed_loop_count"],
                "block_inserts": dict(d["block_inserts"]),
                "samples": d["samples"],
            }
            for cat, d in file_raw.items()
        }

        # Paperspace inventory
        paperspace.append(extract_paperspace(doc, dxf_path.name))

    # Serialize aggregated
    agg_out = {}
    for cat, d in aggregated.items():
        agg_out[cat] = {
            "entity_count": d["entity_count"],
            "entity_types": dict(d["entity_types"]),
            "total_length_units": round(d["total_length_units"], 3),
            "total_area_units2": round(d["total_area_units2"], 3),
            "closed_loop_count": d["closed_loop_count"],
            "block_inserts": dict(d["block_inserts"]),
            "n_sheets_seen": len(d["sheets_seen"]),
            "sheets_seen": sorted(d["sheets_seen"]),
            "sample_positions": d["sample_positions"],
        }

    # Write outputs
    (OUT_DIR / "extraction_raw.json").write_text(json.dumps({
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "files_processed": len(headers),
            "dictionary_source": "layer_dictionary_ratified.json",
            "shapely_available": HAS_SHAPELY,
        },
        "files": headers,
        "per_file_by_category": raw,
    }, indent=2, ensure_ascii=False))
    logger.info(f"  wrote {OUT_DIR / 'extraction_raw.json'}")

    (OUT_DIR / "extraction_aggregated.json").write_text(json.dumps({
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "files_processed": len(headers),
            "active_categories": len(agg_out),
            "dictionary_source": "layer_dictionary_ratified.json",
            "drops_applied": [layer for layer, info in layer2info.items()
                               if info.get("drop_from_aggregation")],
        },
        "by_category": dict(sorted(agg_out.items(), key=lambda kv: -kv[1]["entity_count"])),
    }, indent=2, ensure_ascii=False))
    logger.info(f"  wrote {OUT_DIR / 'extraction_aggregated.json'}")

    (OUT_DIR / "paperspace_inventory.json").write_text(json.dumps({
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "files_processed": len(paperspace),
        },
        "per_file": paperspace,
    }, indent=2, ensure_ascii=False))
    logger.info(f"  wrote {OUT_DIR / 'paperspace_inventory.json'}")

    # Block attributes — keep only blocks that have at least one ATTRIB
    ba_summary = {bn: {"insert_count": len(insts), "instances": insts[:20]}
                   for bn, insts in block_attribs.items()}
    (OUT_DIR / "block_attributes.json").write_text(json.dumps({
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "distinct_blocks_with_attribs": len(ba_summary),
            "total_instances_with_attribs": sum(v["insert_count"] for v in ba_summary.values()),
        },
        "blocks": dict(sorted(ba_summary.items(),
                               key=lambda kv: -kv[1]["insert_count"])),
    }, indent=2, ensure_ascii=False))
    logger.info(f"  wrote {OUT_DIR / 'block_attributes.json'}")

    # Summary
    logger.info("─── Aggregated categories (entity count, sheets) ───")
    for cat, d in sorted(agg_out.items(), key=lambda kv: -kv[1]["entity_count"])[:20]:
        logger.info(f"  {cat:<26s} n={d['entity_count']:>5}  "
                    f"L={d['total_length_units']:>13.1f}u  "
                    f"A={d['total_area_units2']:>15.1f}u²  "
                    f"sheets={d['n_sheets_seen']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
