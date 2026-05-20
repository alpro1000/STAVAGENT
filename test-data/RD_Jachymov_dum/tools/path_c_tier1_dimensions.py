#!/usr/bin/env python3
"""
Path C — Tier 1: HIGH DIMENSIONS exhaustive extraction.

Per user spec: extract VŠECHNY DIMENSION entities from ALL layers across
all 4 DXFs (NOT just tier-1 marked layers — also re-do SM_kóty 609 DIMs etc.).
Cluster by magnitude + Y-coordinate + nearby MTEXT semantic.

Output: outputs/dxf_dimensions_all_v2.json

Strategy:
  1. Iterate all 4 DXFs
  2. For each: enumerate every entity, filter DIMENSION
  3. Per dimension: extract measurement, layer, position (defpoint), nearby MTEXT
  4. Cluster by magnitude bands + Y-coordinate clusters (per-podlaží split for dum_DPZ)
  5. Cross-reference vs prior extracted dimensions (Phase 0b §3.3 sklad geom = 6350/3340/7000)
  6. Identify per-podlaží světlé výšky (2100/2795/2865/2630)
  7. Report top-10 actionable findings
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import ezdxf

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"

SOURCES = {
    "dum_DPZ":       INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace":   INPUTS / "vykresy_dxf" / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
    "sklad_DPZ":     INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": INPUTS / "vykresy_dxf" / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
}

# ───────────────────────────────────────────────────────────────────────────
# Magnitude bands (mm) for classification

MAGNITUDE_BANDS = [
    (0,    100,  "tiny_detail"),
    (100,  500,  "small_detail"),
    (500,  1000, "small_dimension"),
    (1000, 2000, "medium_dimension"),
    (2000, 3500, "podlazi_vyska_or_room_width"),
    (3500, 6000, "room_or_span"),
    (6000, 10000, "building_dimension_or_long_span"),
    (10000, 50000, "very_large"),
]


def classify_magnitude(mm: float) -> str:
    for lo, hi, label in MAGNITUDE_BANDS:
        if lo <= mm < hi:
            return label
    return "out_of_range"


def cluster_y_coords(y_values: list[float], gap_mm: float = 2000) -> list[tuple[float, float]]:
    """Find Y-coordinate clusters (per-view groupings on the drawing sheet)."""
    if not y_values:
        return []
    sorted_y = sorted(y_values)
    clusters = []
    current_start = sorted_y[0]
    current_end = sorted_y[0]
    for y in sorted_y[1:]:
        if y - current_end <= gap_mm:
            current_end = y
        else:
            clusters.append((current_start, current_end))
            current_start = y
            current_end = y
    clusters.append((current_start, current_end))
    return clusters


def nearby_mtext(msp, x: float, y: float, radius_mm: float = 500) -> list[str]:
    """Find MTEXT/TEXT entities within radius of given point."""
    nearby = []
    for e in msp:
        try:
            if e.dxftype() not in ("MTEXT", "TEXT"):
                continue
            pos = e.dxf.insert if e.dxftype() == "MTEXT" else e.dxf.insert
            ex, ey = pos[0], pos[1]
            if math.hypot(ex - x, ey - y) <= radius_mm:
                txt = e.text if e.dxftype() == "MTEXT" else e.dxf.text
                txt = (txt or "").strip()
                if txt:
                    nearby.append(txt[:60])
        except Exception:
            pass
    return nearby[:3]


def main():
    OUT.mkdir(exist_ok=True)
    print("[1/4] Iterating 4 DXFs for ALL dimension entities...", file=sys.stderr)

    all_dimensions = []   # global list across all files
    per_file_summary = {}

    for file_key, path in SOURCES.items():
        if not path.exists():
            per_file_summary[file_key] = {"_error": "FILE_NOT_FOUND"}
            continue
        doc = ezdxf.readfile(str(path))
        msp = doc.modelspace()

        file_dims = []
        per_layer_count = Counter()
        for e in msp:
            if e.dxftype() != "DIMENSION":
                continue
            try:
                m = e.get_measurement()
                if m is None:
                    continue
                mm = float(m)
                layer = e.dxf.layer
                # Position — defpoint or text_midpoint
                try:
                    pos = e.dxf.defpoint
                    px, py = pos[0], pos[1]
                except Exception:
                    try:
                        pos = e.dxf.text_midpoint
                        px, py = pos[0], pos[1]
                    except Exception:
                        px, py = 0.0, 0.0
                # Capture override text if any
                try:
                    override = e.dxf.text or ""
                except Exception:
                    override = ""
                rec = {
                    "file": file_key,
                    "layer": layer,
                    "measurement_mm": round(mm, 2),
                    "magnitude_band": classify_magnitude(mm),
                    "x": round(px, 0),
                    "y": round(py, 0),
                    "override_text": override.strip()[:40] if override else None,
                }
                file_dims.append(rec)
                all_dimensions.append(rec)
                per_layer_count[layer] += 1
            except Exception:
                pass

        # Per-file summary
        per_file_summary[file_key] = {
            "path": str(path.relative_to(PROJ)),
            "total_dimensions": len(file_dims),
            "per_layer_dimension_counts": dict(per_layer_count.most_common()),
        }
        print(f"  ✓ {file_key}: {len(file_dims)} dimensions across {len(per_layer_count)} layers", file=sys.stderr)

    print(f"\n[2/4] Magnitude clustering across {len(all_dimensions)} total dimensions...", file=sys.stderr)
    by_magnitude = defaultdict(list)
    for d in all_dimensions:
        by_magnitude[d["magnitude_band"]].append(d)

    magnitude_summary = {}
    for band, dims in by_magnitude.items():
        unique_values = sorted({round(d["measurement_mm"], 1) for d in dims})
        magnitude_summary[band] = {
            "count": len(dims),
            "n_unique_values": len(unique_values),
            "sample_values_mm": unique_values[:30],
        }

    print("\n[3/4] Per-podlaží světlá výška candidates (band 2000-3500 mm)...", file=sys.stderr)
    # User wants: 1.PP 2100, 1.NP 2795, 2.NP 2865, 3.NP 2630
    podlazi_band = by_magnitude.get("podlazi_vyska_or_room_width", [])
    podlazi_values = Counter(round(d["measurement_mm"], 1) for d in podlazi_band)

    EXPECTED_VYSKY = {
        "1.PP": 2100.0,
        "1.NP": 2795.0,
        "2.NP": 2865.0,
        "3.NP": 2630.0,
    }
    per_podlazi_dxf_match = {}
    for podlazi, target_mm in EXPECTED_VYSKY.items():
        matches = []
        for d in podlazi_band:
            if abs(d["measurement_mm"] - target_mm) < 5:
                # Get layer + position + nearby context
                try:
                    doc = ezdxf.readfile(str(SOURCES[d["file"]]))
                    msp = doc.modelspace()
                    ctx = nearby_mtext(msp, d["x"], d["y"], radius_mm=2000)
                except Exception:
                    ctx = []
                matches.append({
                    "file": d["file"],
                    "layer": d["layer"],
                    "measurement_mm": d["measurement_mm"],
                    "position_x": d["x"],
                    "position_y": d["y"],
                    "nearby_context": ctx,
                })
        per_podlazi_dxf_match[podlazi] = {
            "target_mm": target_mm,
            "n_matches_in_dxf": len(matches),
            "matches": matches[:10],
        }
        print(f"  {podlazi} (target {target_mm} mm): {len(matches)} matches", file=sys.stderr)

    print(f"\n[4/4] Top-10 actionable findings + write output...", file=sys.stderr)

    # Top-10 actionable: dimensions matching expected critical values
    CRITICAL_VALUES = {
        # Per-podlaží výšky
        2100.0: "1.PP svetlá výška",
        2795.0: "1.NP svetlá výška",
        2865.0: "2.NP svetlá výška",
        2630.0: "3.NP svetlá výška (nadezdívka)",
        # Sklad geometry (already known)
        6350.0: "sklad lichoběžník šířka",
        3340.0: "sklad lichoběžník hloubka",
        # ETICS related
        3200.0: "konstrukční výška 1.NP→2.NP přechod",
        # Building outline
        38700.0: "external dum perimeter (sub-segment)",
        # Krov dimensions
        180.0: "trám výška / krokev výška",
        160.0: "ETICS EPS tloušťka / HEA výška",
    }
    top_findings = []
    for crit_mm, label in CRITICAL_VALUES.items():
        n_hits = sum(1 for d in all_dimensions if abs(d["measurement_mm"] - crit_mm) < 1)
        if n_hits > 0:
            top_findings.append({
                "critical_value_mm": crit_mm,
                "label": label,
                "n_dxf_hits": n_hits,
            })

    audit = {
        "_schema_version": "2.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_tier1_dimensions.py",
        "_purpose": (
            "Path C Tier 1 — exhaustive dimension extraction across ALL 4 DXF files. "
            "Cluster by magnitude band + per-podlaží Y matching. Replaces partial "
            "previous probe of SM_kóty (only top values previously extracted)."
        ),
        "_summary": {
            "total_dimensions_extracted": len(all_dimensions),
            "files_processed": len(SOURCES),
            "magnitude_bands": {b: magnitude_summary[b]["count"] for b in magnitude_summary},
            "n_unique_dimensions_total": len({round(d["measurement_mm"], 1) for d in all_dimensions}),
        },
        "per_file_summary": per_file_summary,
        "magnitude_clustering": magnitude_summary,
        "per_podlazi_svetla_vyska_dxf_match": per_podlazi_dxf_match,
        "top_10_critical_value_findings": top_findings,
        "all_dimensions": all_dimensions,
    }

    out_path = OUT / "dxf_dimensions_all_v2.json"
    out_path.write_text(json.dumps(audit, indent=2, ensure_ascii=False))
    size = out_path.stat().st_size
    print(f"\n✓ Wrote {out_path.relative_to(PROJ)} ({size:,} bytes)", file=sys.stderr)
    print(f"\nTotal dimensions: {len(all_dimensions)}", file=sys.stderr)
    print(f"Per-podlaží matches: " + ", ".join(
        f"{p}={d['n_matches_in_dxf']}" for p, d in per_podlazi_dxf_match.items()
    ), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
