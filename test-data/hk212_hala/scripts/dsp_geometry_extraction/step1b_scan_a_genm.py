#!/usr/bin/env python3
"""
hk212 Task 2 Step 1.5 — targeted scan of A-GENM* layers.

Per user ratification: don't drop A-GENM-1 (774 entities) blindly.
Inventory entity types, sample positions, sample dimensions, dominant
geometry shape, sheets where used.

Output: outputs/dsp_geometry_extraction/agenm_targeted_scan.json
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ezdxf

REPO_ROOT = Path(__file__).resolve().parents[4]
DXF_DIR = REPO_ROOT / "test-data/hk212_hala/inputs/vykresy_dxf"
OUT = REPO_ROOT / "test-data/hk212_hala/outputs/dsp_geometry_extraction/agenm_targeted_scan.json"

A_GENM_LAYERS = {"A-GENM", "A-GENM-1", "A-GENM-2"}
SKIP_FILES = {"UT_HALAHK_DPS.dxf"}


def bbox_of(entity) -> tuple | None:
    try:
        if hasattr(entity, "bbox") and callable(entity.bbox):
            b = entity.bbox()
            return ((b.extmin.x, b.extmin.y), (b.extmax.x, b.extmax.y))
    except Exception:
        pass
    try:
        et = entity.dxftype()
        if et == "LINE":
            return ((entity.dxf.start.x, entity.dxf.start.y),
                    (entity.dxf.end.x, entity.dxf.end.y))
        if et == "CIRCLE":
            cx, cy = entity.dxf.center.x, entity.dxf.center.y
            r = entity.dxf.radius
            return ((cx - r, cy - r), (cx + r, cy + r))
        if et == "ARC":
            cx, cy = entity.dxf.center.x, entity.dxf.center.y
            r = entity.dxf.radius
            return ((cx - r, cy - r), (cx + r, cy + r))
        if et == "INSERT":
            ix, iy = entity.dxf.insert.x, entity.dxf.insert.y
            return ((ix, iy), (ix, iy))
        if et in ("LWPOLYLINE", "POLYLINE"):
            pts = list(entity.vertices()) if et == "POLYLINE" else list(entity.get_points("xy"))
            if pts:
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                return ((min(xs), min(ys)), (max(xs), max(ys)))
        if et == "SPLINE":
            pts = list(entity.control_points)
            if pts:
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                return ((min(xs), min(ys)), (max(xs), max(ys)))
    except Exception:
        return None
    return None


def length_estimate(entity) -> float | None:
    try:
        et = entity.dxftype()
        if et == "LINE":
            dx = entity.dxf.end.x - entity.dxf.start.x
            dy = entity.dxf.end.y - entity.dxf.start.y
            return (dx*dx + dy*dy) ** 0.5
        if et == "CIRCLE":
            return 2 * 3.141592653589793 * entity.dxf.radius
        if et == "ARC":
            import math
            sa, ea = entity.dxf.start_angle, entity.dxf.end_angle
            sweep = (ea - sa) % 360
            return 2 * math.pi * entity.dxf.radius * sweep / 360
        if et == "LWPOLYLINE":
            pts = list(entity.get_points("xy"))
            if len(pts) < 2: return 0
            s = 0
            for i in range(len(pts)-1):
                s += ((pts[i+1][0]-pts[i][0])**2 + (pts[i+1][1]-pts[i][1])**2) ** 0.5
            if entity.closed:
                s += ((pts[0][0]-pts[-1][0])**2 + (pts[0][1]-pts[-1][1])**2) ** 0.5
            return s
    except Exception:
        return None
    return None


def main() -> int:
    results = {layer: {
        "sheets": defaultdict(lambda: {
            "entity_types": Counter(),
            "total_entities": 0,
            "samples": [],
            "length_total_units": 0.0,
            "bbox_aggregate": None,
            "closed_count": 0,
            "block_refs": Counter(),  # for INSERT entities
        }),
    } for layer in A_GENM_LAYERS}

    dxfs = sorted(p for p in DXF_DIR.iterdir()
                   if p.suffix.lower() == ".dxf" and p.name not in SKIP_FILES)
    for dxf_path in dxfs:
        doc = ezdxf.readfile(dxf_path, errors="ignore")
        msp = doc.modelspace()
        for e in msp:
            if e.dxf.layer not in A_GENM_LAYERS:
                continue
            etype = e.dxftype()
            data = results[e.dxf.layer]["sheets"][dxf_path.name]
            data["entity_types"][etype] += 1
            data["total_entities"] += 1
            bb = bbox_of(e)
            ln = length_estimate(e)
            if ln is not None and ln > 0:
                data["length_total_units"] += ln
            if etype == "LWPOLYLINE" and e.closed:
                data["closed_count"] += 1
            if etype == "INSERT":
                data["block_refs"][e.dxf.name] += 1
            if len(data["samples"]) < 8:
                sample = {
                    "type": etype,
                    "handle": e.dxf.handle,
                    "color": getattr(e.dxf, "color", None),
                    "linetype": getattr(e.dxf, "linetype", None),
                }
                if bb:
                    sample["bbox"] = bb
                    sample["width_units"] = round(bb[1][0] - bb[0][0], 2)
                    sample["height_units"] = round(bb[1][1] - bb[0][1], 2)
                if ln is not None:
                    sample["length_units"] = round(ln, 2)
                if etype == "INSERT":
                    sample["block_name"] = e.dxf.name
                data["samples"].append(sample)
            # Aggregate bbox
            if bb:
                if data["bbox_aggregate"] is None:
                    data["bbox_aggregate"] = [list(bb[0]), list(bb[1])]
                else:
                    data["bbox_aggregate"][0][0] = min(data["bbox_aggregate"][0][0], bb[0][0])
                    data["bbox_aggregate"][0][1] = min(data["bbox_aggregate"][0][1], bb[0][1])
                    data["bbox_aggregate"][1][0] = max(data["bbox_aggregate"][1][0], bb[1][0])
                    data["bbox_aggregate"][1][1] = max(data["bbox_aggregate"][1][1], bb[1][1])

    # Serialize
    out = {"_meta": {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "layers_scanned": sorted(A_GENM_LAYERS),
        "files_scanned": [p.name for p in dxfs],
    }, "layers": {}}
    for layer, data in results.items():
        sheets_summary = {}
        for sheet, sd in data["sheets"].items():
            sheets_summary[sheet] = {
                "total_entities": sd["total_entities"],
                "entity_types": dict(sd["entity_types"]),
                "total_length_units": round(sd["length_total_units"], 2),
                "closed_polyline_count": sd["closed_count"],
                "block_refs": dict(sd["block_refs"]) if sd["block_refs"] else {},
                "bbox_aggregate": sd["bbox_aggregate"],
                "samples": sd["samples"],
            }
        out["layers"][layer] = {
            "total_entities_across_sheets": sum(sd["total_entities"] for sd in data["sheets"].values()),
            "sheets_used": sorted(sheets_summary.keys()),
            "n_sheets": len(sheets_summary),
            "per_sheet": sheets_summary,
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
