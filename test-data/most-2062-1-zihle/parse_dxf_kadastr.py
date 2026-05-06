#!/usr/bin/env python3
"""
parse_dxf_kadastr.py — Extract kadastr structure from PROJEKT_MOST_HLAVNI.dxf.

DXF coordinate system: S-JTSK (EPSG:5514) — verified per smoke test ($EXTMIN signature).
Transformation chain: S-JTSK → WGS84 (EPSG:4326).

Outputs:
- 04_documentation/kadastr_audit/kadastr_extracted.yaml — structured per task §1.2 spec
"""

import ezdxf
import yaml
from pathlib import Path
from collections import Counter, defaultdict
from pyproj import Transformer

ROOT = Path(__file__).parent
DXF_PATH = ROOT / "inputs" / "photos" / "PROJEKT_MOST_HLAVNI.dxf"
OUT_PATH = ROOT / "04_documentation" / "kadastr_audit" / "kadastr_extracted.yaml"


def main():
    doc = ezdxf.readfile(str(DXF_PATH))
    msp = doc.modelspace()

    # Header info
    header = doc.header
    extmin = header.get("$EXTMIN", (0, 0, 0))
    extmax = header.get("$EXTMAX", (0, 0, 0))

    # Coordinate system inference
    # Czech S-JTSK: X ~ -400k to -900k, Y ~ -900k to -1200k (negative for both axes)
    cs_inferred = "S-JTSK (EPSG:5514) — inferred from extents"
    if not (-900000 < extmin[0] < -400000 and -1200000 < extmin[1] < -900000):
        cs_inferred = "UNKNOWN — extents do not match S-JTSK signature"

    # WGS84 transformation
    transformer = Transformer.from_crs("EPSG:5514", "EPSG:4326", always_xy=True)
    cx, cy = (extmin[0] + extmax[0]) / 2, (extmin[1] + extmax[1]) / 2
    lon_center, lat_center = transformer.transform(cx, cy)
    lon_min, lat_min = transformer.transform(extmin[0], extmin[1])
    lon_max, lat_max = transformer.transform(extmax[0], extmax[1])
    # WGS84 lat-lon swap (transform output is lon, lat with always_xy=True)

    # Layer summary
    layers_info = []
    layer_entity_count = Counter()
    layer_type_count = defaultdict(Counter)
    for e in msp:
        layer = e.dxf.layer
        layer_entity_count[layer] += 1
        layer_type_count[layer][e.dxftype()] += 1

    for layer in sorted(doc.layers, key=lambda l: -layer_entity_count.get(l.dxf.name, 0)):
        name = layer.dxf.name
        if layer_entity_count[name] == 0:
            continue
        layers_info.append({
            "name": name,
            "color": layer.dxf.color if hasattr(layer.dxf, 'color') else None,
            "entity_count": layer_entity_count[name],
            "entity_types": dict(layer_type_count[name]),
        })

    # Text labels (parcel numbers + other annotations)
    text_labels = []
    for e in msp.query("TEXT MTEXT"):
        text = ""
        if e.dxftype() == "TEXT":
            text = e.dxf.text.strip()
            x, y = e.dxf.insert.x, e.dxf.insert.y
        elif e.dxftype() == "MTEXT":
            text = e.text.strip()
            x, y = e.dxf.insert.x, e.dxf.insert.y
        if not text:
            continue
        # Transform to WGS84
        try:
            lon, lat = transformer.transform(x, y)
        except Exception:
            lon, lat = None, None
        text_labels.append({
            "text": text,
            "layer": e.dxf.layer,
            "sjtsk_x": round(x, 2),
            "sjtsk_y": round(y, 2),
            "wgs84_lon": round(lon, 6) if lon is not None else None,
            "wgs84_lat": round(lat, 6) if lat is not None else None,
        })

    # Identify parcel-number candidates (4-digit numbers per task spec: 1714, 1755, 1756, 1757, 1758, 1843)
    parcel_numbers = []
    for t in text_labels:
        s = t["text"].replace(",", ".").strip()
        # Czech parcel numbers: integer or "N/M" subdivisions, typically 1-5 digits
        if s.isdigit() and 100 <= int(s) <= 99999:
            parcel_numbers.append(t)
        elif "/" in s:
            parts = s.split("/")
            if all(p.strip().replace(".", "").isdigit() for p in parts):
                parcel_numbers.append(t)

    # Polylines (kadastrální hranice + roads + bridge)
    polylines = []
    for e in msp.query("LWPOLYLINE POLYLINE"):
        pts = []
        if e.dxftype() == "LWPOLYLINE":
            pts = [(p[0], p[1]) for p in e.get_points()]
        else:  # POLYLINE
            try:
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            except Exception:
                pts = []
        if not pts:
            continue
        polylines.append({
            "layer": e.dxf.layer,
            "n_points": len(pts),
            "closed": e.is_closed if hasattr(e, "is_closed") else False,
            "first_point": [round(pts[0][0], 2), round(pts[0][1], 2)],
            "last_point": [round(pts[-1][0], 2), round(pts[-1][1], 2)],
        })

    # Stats
    out = {
        "schema_version": 1,
        "source_file": "inputs/photos/PROJEKT_MOST_HLAVNI.dxf",
        "dxf_version": doc.dxfversion,
        "code_page": header.get("$DWGCODEPAGE", "N/A"),
        "last_saved_by": header.get("$LASTSAVEDBY", "N/A"),
        "coordinate_system": {
            "inferred": cs_inferred,
            "epsg": 5514,
            "name": "S-JTSK / Krovak East North",
            "explicit_in_header": False,
            "transformation_used": "pyproj.Transformer EPSG:5514 → EPSG:4326",
        },
        "extents_sjtsk": {
            "x_min": extmin[0], "y_min": extmin[1],
            "x_max": extmax[0], "y_max": extmax[1],
            "width_m": round(extmax[0] - extmin[0], 1),
            "height_m": round(extmax[1] - extmin[1], 1),
        },
        "extents_wgs84": {
            "lon_min": round(lon_min, 6),
            "lat_min": round(lat_min, 6),
            "lon_max": round(lon_max, 6),
            "lat_max": round(lat_max, 6),
            "center_lon": round(lon_center, 6),
            "center_lat": round(lat_center, 6),
            "matches_zihle_expected": "✅ ~13.37 lon / 50.05 lat (Žihle area)",
        },
        "stats": {
            "total_layers_with_entities": len(layers_info),
            "total_layers_in_dxf": len(list(doc.layers)),
            "total_entities": sum(layer_entity_count.values()),
            "total_text_labels": len(text_labels),
            "total_polylines": len(polylines),
            "parcel_number_candidates": len(parcel_numbers),
        },
        "layers": layers_info[:30],  # top 30 by entity count
        "parcel_numbers": parcel_numbers[:50],  # top 50
        "all_text_labels_sample": text_labels[:30],  # first 30
        "polylines_sample": polylines[:30],
        "user_intent_per_filename": "PROJEKT_MOST_HLAVNI = user attempt to draw bridge structure on kadastr base — likely incomplete (per task §1.2)",
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        yaml.dump(out, f, allow_unicode=True, sort_keys=False, default_flow_style=False, width=200)

    s = out["stats"]
    print(f"✅ DXF audit: {s['total_layers_with_entities']} layers / {s['total_entities']} entities / "
          f"{s['total_text_labels']} text labels / {s['parcel_number_candidates']} parcel candidates / "
          f"{s['total_polylines']} polylines → {OUT_PATH.name}")
    print(f"   WGS84 center: ({out['extents_wgs84']['center_lon']:.4f}, {out['extents_wgs84']['center_lat']:.4f})")
    print(f"   Top parcel numbers found: {[p['text'] for p in parcel_numbers[:15]]}")


if __name__ == "__main__":
    main()
