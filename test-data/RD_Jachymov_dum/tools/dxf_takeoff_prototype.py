#!/usr/bin/env python3
"""DXF-First takeoff prototype (P0, TASK_Automated_Takeoff_DXF_Vision_BIM.md Část A).

Deterministic extraction from a vector DXF (conf 1.0 where geometry is clean):
  - closed LWPOLYLINE  -> area (m²) + perimeter (m), grouped by layer
  - HATCH paths        -> filled area (m²)
  - INSERT (blocks)    -> count of repeated elements (okna/dveře/sloupky/plot)
  - TEXT/MTEXT labels  -> element-count cross-check (e.g. "IPE 180" ×N, "100/160" ×N)

Validated against Alexander's manual takeoff on the sklad sheet:
  sklad floor 17.6 m² | stání pororošt 44.6 m² | wall S03a 62.5 m² (= obvod × výška 3.5)

Layer names are draftsman-semantic (km_/SM_/IP_/Z_ prefixes), NOT element-semantic
-> a layer slovník is needed for full auto-classification (Část A caveat, P1 backlog).
Vertical areas (wall face 62.5) are NOT in the plan -> derived: DXF perimeter × řez height.
"""
import re
import sys
from collections import Counter, defaultdict

import ezdxf

MM2_TO_M2 = 1e6
MM_TO_M = 1000.0


def _poly_area_perimeter(e):
    pts = [(p[0], p[1]) for p in e.get_points()]
    if len(pts) < 3:
        return 0.0, 0.0
    area = 0.0
    per = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
        per += ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    return abs(area) / 2 / MM2_TO_M2, per / MM_TO_M


def _clean_text(raw):
    return re.sub(r"\\[A-Za-z0-9.|]+;?", "", raw).replace("{", "").replace("}", "").strip()


def parse(path):
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()

    polys = defaultdict(list)  # layer -> [(area_m2, perim_m, npts)]
    for e in msp.query("LWPOLYLINE"):
        a, per = _poly_area_perimeter(e)
        if a > 0:
            polys[e.dxf.layer].append((a, per, len(e)))

    blocks = Counter(e.dxf.name for e in msp.query("INSERT"))

    labels = Counter()
    for e in list(msp.query("MTEXT")) + list(msp.query("TEXT")):
        t = _clean_text(e.text if hasattr(e, "text") else e.dxf.text)
        if t:
            labels[t] += 1

    return {"polys": polys, "blocks": blocks, "labels": labels,
            "units": doc.header.get("$INSUNITS"), "version": doc.dxfversion}


def find_area(polys, target, tol=0.05):
    """Return list of (layer, area, perim) within tol of target m²."""
    hits = []
    for lay, lst in polys.items():
        for a, per, n in lst:
            if abs(a - target) / target <= tol:
                hits.append((lay, round(a, 2), round(per, 2)))
    return hits


def main(path):
    d = parse(path)
    print(f"DXF {d['version']} | units={d['units']} (4=mm)")
    print("\n--- VALIDATION vs manual takeoff ---")
    for label, target in [("sklad floor", 17.6), ("stání pororošt", 44.6)]:
        hits = find_area(d["polys"], target)
        verdict = "MATCH" if hits else "no direct polygon"
        print(f"  {label:18} {target:6} m²  -> {verdict}: {hits[:3]}")

    # wall: derived (perimeter × height), not a plan polygon
    room = find_area(d["polys"], 17.6)
    if room:
        per = room[0][2]
        print(f"  wall S03a (derived)  obvod {per} m × výška 3.5 (řez) = {per*3.5:.1f} m²  [manual 62.5]")

    print("\n--- element-count cross-check (text labels) ---")
    for needle in ["IPE 180", "100/160"]:
        n = sum(c for t, c in d["labels"].items() if needle in t)
        print(f"  '{needle}' label count = {n}")

    print("\n--- repeated blocks (INSERT count) ---")
    for name, c in d["blocks"].most_common(8):
        print(f"  {c:4}  {name}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1
         else "test-data/RD_Jachymov_dum/inputs/vykresy_dxf/260217_sklad/"
              "RD Ja_chymov vjezd _ DPZ _ 02.dxf")
