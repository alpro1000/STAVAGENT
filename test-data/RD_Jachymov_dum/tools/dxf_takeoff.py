#!/usr/bin/env python3
"""DXF-First production takeoff (Pattern 49, TASK Část A — Úroveň 1→2).

Reads a vector DXF, classifies every layer via an accumulative slovník
(dxf_layer_slovnik.json), and auto-fills a VÝMĚRY register (Pattern 45) with
conf 1.0 deterministic quantities:

  role=area      -> Σ closed-polyline areas on the layer (m²)
  role=length    -> Σ polyline perimeters (m)   [wall footprint -> obvod]
  role=count     -> INSERT block count
  role=dimension -> DIMENSION measurements (m)
  role=label     -> text-label tally (e.g. "IPE 180" ×6 — Pattern 47 count)
  role=skip      -> annotation / titleblock / survey (ignored)

Layers with no slovník rule are emitted to `unknown_layers` for accumulation
(the slovník grows per project; gaps fall back to vision — Pattern 39 / walk_drawings).

Usage: python dxf_takeoff.py [file.dxf] [slovnik.json]
Output: prints a VÝMĚRY-style table + unknown-layer accumulation queue.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import ezdxf

try:
    from shapely.geometry import Polygon, Point
    _HAS_SHAPELY = True
except ImportError:  # room association degrades gracefully without shapely
    _HAS_SHAPELY = False

MM2_TO_M2 = 1e6
MM_TO_M = 1000.0
HERE = Path(__file__).parent
_ROOM_RE = re.compile(r"\d+\.\d+")  # room number e.g. 0.01 / 1.02


def _poly(e):
    pts = [(p[0], p[1]) for p in e.get_points()]
    if len(pts) < 3:
        return 0.0, 0.0
    a = per = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
        per += ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    return abs(a) / 2 / MM2_TO_M2, per / MM_TO_M


def _clean(raw):
    return re.sub(r"\\[A-Za-z0-9.|]+;?", "", raw).replace("{", "").replace("}", "").strip()


def classify(name, rules):
    low = name.lower()
    for r in rules:
        if r["match"].lower() in low:
            return r
    return None


def associate_rooms(msp, room_layer="obrysy míst", label_layer="čísla míst", radius_m=5.0):
    """A1+A2: point-in-polygon match of room-number labels to room polygons.

    Returns [{cislo, nazev, area_m2, _source}] for labeled rooms only — which
    also separates the active view's rooms from other views/details on the same
    sheet (unlabeled polygons are dropped). Requires shapely.
    """
    if not _HAS_SHAPELY:
        return []
    labels = []
    for e in list(msp.query("MTEXT")) + list(msp.query("TEXT")):
        if label_layer.lower() not in e.dxf.layer.lower():
            continue
        t = _clean(e.text if hasattr(e, "text") else e.dxf.text)
        if t:
            labels.append((t, e.dxf.insert[0], e.dxf.insert[1]))
    cisla = [(t, x, y) for t, x, y in labels if _ROOM_RE.fullmatch(t)]
    nazvy = [(t, x, y) for t, x, y in labels
             if not _ROOM_RE.fullmatch(t) and not t.startswith("v.")
             and "IPE" not in t and "/" not in t]

    def nearest_name(x, y):
        best, bd = None, radius_m * MM_TO_M
        for t, nx, ny in nazvy:
            dd = ((nx - x) ** 2 + (ny - y) ** 2) ** 0.5
            if dd < bd:
                bd, best = dd, t
        return best

    polys = []
    for e in msp.query("LWPOLYLINE"):
        if room_layer.lower() not in e.dxf.layer.lower():
            continue
        pts = [(p[0], p[1]) for p in e.get_points()]
        if len(pts) >= 3:
            try:
                pg = Polygon(pts)
                if pg.area > 0:
                    polys.append(pg)
            except Exception:
                pass

    rooms = []
    for c, x, y in cisla:
        pt = Point(x, y)
        hit = [pg.area for pg in polys if pg.contains(pt)]
        if hit:
            rooms.append({"cislo": c, "nazev": nearest_name(x, y),
                          "area_m2": round(min(hit) / MM2_TO_M2, 2),
                          "conf": 1.0, "_source": "DXF room-label ∈ polygon"})
    return rooms


def dedup_rooms(rooms):
    """#2 multi-floor dedup: one DXF sheet redraws the same room across floor
    plans (stav twice + návrh) → collapse to unique rooms.

    - patro = číslo prefix (0=suterén/1.PP, 1=1.NP, 2=2.NP, 3=3.NP)
    - key = (číslo, round(area,1)); exact duplicates collapse, named entry wins
      (the named draw is the návrh — carries název)
    - verze = 'návrh' when named, else 'stav' (this sheet labels only the návrh
      plan; stav redraws have no nearby název)
    Distinct areas under one číslo (stav layout ≠ návrh layout) are kept as
    separate verze rows — both are real (stav feeds bourání, návrh feeds new work).
    """
    by_key = {}
    for r in rooms:
        cislo = str(r.get("cislo", ""))
        key = (cislo, round(r.get("area_m2") or 0, 1))
        prev = by_key.get(key)
        if prev is None or (not prev.get("nazev") and r.get("nazev")):
            by_key[key] = dict(r)
    out = []
    for (cislo, _area), r in by_key.items():
        r["patro"] = cislo.split(".")[0] if "." in cislo else "?"
        r["verze"] = "návrh" if r.get("nazev") else "stav"
        out.append(r)
    out.sort(key=lambda r: (r["patro"], r["cislo"], r["verze"]))
    return out


def takeoff(dxf_path, slovnik_path=None):
    slovnik = json.loads((Path(slovnik_path) if slovnik_path else HERE / "dxf_layer_slovnik.json").read_text())
    lrules, brules = slovnik["layer_rules"], slovnik["block_rules"]
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    poly_by_layer = defaultdict(list)
    for e in msp.query("LWPOLYLINE"):
        a, per = _poly(e)
        if a > 0 or per > 0:
            poly_by_layer[e.dxf.layer].append((a, per))
    labels_by_layer = defaultdict(Counter)
    for e in list(msp.query("MTEXT")) + list(msp.query("TEXT")):
        t = _clean(e.text if hasattr(e, "text") else e.dxf.text)
        if t:
            labels_by_layer[e.dxf.layer][t] += 1
    blocks = Counter(e.dxf.name for e in msp.query("INSERT"))
    layers = {layer.dxf.name for layer in doc.layers} | set(poly_by_layer) | set(labels_by_layer)

    vymery, unknown = [], []
    for lay in sorted(layers):
        r = classify(lay, lrules)
        if r is None:
            if poly_by_layer.get(lay) or labels_by_layer.get(lay):
                unknown.append(lay)
            continue
        role = r["role"]
        if role == "area":
            polys = [a for a, _ in poly_by_layer.get(lay, []) if a > 0.5]
            for a in sorted(polys, reverse=True):
                vymery.append({"element": r["element"], "role": "area", "qty": round(a, 2),
                               "mj": "m²", "conf": r["conf"], "_source": f"DXF layer '{lay}'"})
        elif role == "length":
            for _, per in poly_by_layer.get(lay, []):
                if per > 0.5:
                    vymery.append({"element": r["element"], "role": "length", "qty": round(per, 2),
                                   "mj": "m", "conf": r["conf"], "_source": f"DXF layer '{lay}'"})
        elif role == "label":
            for t, c in labels_by_layer.get(lay, {}).items():
                vymery.append({"element": r["element"], "role": "label", "qty": c,
                               "mj": "×", "conf": r["conf"], "_source": f"DXF text '{t[:24]}'"})

    block_counts = []
    for name, c in blocks.items():
        br = classify(name, brules)
        if br and br["role"] == "count":
            block_counts.append({"element": br["element"], "qty": c, "mj": "ks",
                                 "conf": 1.0, "_source": f"DXF block '{name}'"})
        elif br is None:
            unknown.append(f"[block] {name}")
    rooms = dedup_rooms(associate_rooms(msp))
    return {"rooms": rooms, "vymery": vymery, "blocks": block_counts, "unknown_layers": unknown}


def main(dxf, slovnik=None):
    res = takeoff(dxf, slovnik)
    print("=== MÍSTNOSTI (A1 label↔polygon · A2 view-filter · #2 dedup patro/verze) ===")
    cur = None
    for r in res["rooms"]:
        if r.get("patro") != cur:
            cur = r.get("patro")
            print(f"  --- patro {cur} ---")
        print(f"  {r['cislo']:6} [{r.get('verze','?'):5}] {str(r['nazev'] or '')[:24]:24} {r['area_m2']:>8} m²")
    if not res["rooms"]:
        print("  (none — shapely missing or no labeled rooms)")
    else:
        print(f"  Σ {len(res['rooms'])} unique (číslo×area) rooms")
    print("\n=== Ostatní VÝMĚRY auto-fill (conf 1.0) ===")
    seen = set()
    for v in res["vymery"]:
        if v["role"] == "label" or v["element"] == "mistnost_podlaha":
            continue  # rooms handled above
        key = (v["element"], v["qty"])
        if key in seen:
            continue
        seen.add(key)
        print(f"  {v['element']:22} {v['qty']:>8} {v['mj']:3} conf={v['conf']} | {v['_source']}")
    print("\n=== Counts (labels + blocks) ===")
    for v in res["vymery"]:
        if v["role"] == "label" and not v["element"].startswith("_"):
            print(f"  {v['element']:22} {v['qty']:>8} ×   | {v['_source']}")
    for b in res["blocks"]:
        print(f"  {b['element']:22} {b['qty']:>8} ks  | {b['_source']}")
    print(f"\n=== Unknown layers (accumulate into slovník) — {len(res['unknown_layers'])} ===")
    for u in res["unknown_layers"]:
        print(f"  {u}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1
         else "test-data/RD_Jachymov_dum/inputs/vykresy_dxf/260217_sklad/"
              "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
         sys.argv[2] if len(sys.argv) > 2 else None)
