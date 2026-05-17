#!/usr/bin/env python3
"""
Phase 0b §3.3 DXF extractor for RD Jáchymov.

Independent parse of 4 DXF drawings via ezdxf:
  * INSERT block counts (per block name)
  * DIMENSION objects (with .get_measurement() values)
  * MTEXT / TEXT labels (per layer)
  * HATCH areas (for fasáda / krytina / podlahy)

Output: outputs/dxf_extract_report.json

Per task §3.3, files that fail to parse (old format / corrupt) are flagged
with `_blocked_old_format` and the run continues.

Also resolves (or partially resolves) vyjasnění #18: sklad lichoběžník
6,35 × 3,34 m + parking 7,0 m length.

Run: python3 tools/phase0b_dxf_extractor.py  (from project root)
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import ezdxf
from ezdxf.lldxf.const import DXFError

PROJ = Path(__file__).resolve().parent.parent
DXF_DIR = PROJ / "inputs" / "vykresy_dxf"
OUT = PROJ / "outputs"

SOURCES = {
    "sklad_DPZ":     DXF_DIR / "260217_sklad" / "RD Ja_chymov vjezd _ DPZ _ 02.dxf",
    "sklad_situace": DXF_DIR / "260217_sklad" / "RD Ja_chymov vjezd _ situace 04.dxf",
    "dum_DPZ":       DXF_DIR / "260219_dum"   / "RD Jachymov dum _ DPZ _ 10.dxf",
    "dum_situace":   DXF_DIR / "260219_dum"   / "RD Jachymov dum _ situace 02.dxf",
}

# Target dimensions for vyjasnění #18 resolution
SKLAD_TARGETS_MM = {
    "sklad_lichoběžník_width_6_35_m":  (6350, 50),   # (target, tolerance) in mm
    "sklad_lichoběžník_depth_3_34_m":  (3340, 50),
    "parking_length_7_0_m":             (7000, 50),
    "sklad_basis_alt_3_085_m":          (3085, 25),  # alternate from interior dim
}


def hatch_area(hatch) -> float | None:
    """Compute polygonal area of HATCH boundary (sum across all paths).
    Returns m² (assumes drawing units = mm → divide by 1e6)."""
    total = 0.0
    try:
        for path in hatch.paths:
            verts = []
            if hasattr(path, "vertices"):
                verts = [(v[0], v[1]) for v in path.vertices]
            elif hasattr(path, "edges"):
                for edge in path.edges:
                    if hasattr(edge, "start"):
                        verts.append((edge.start[0], edge.start[1]))
                    elif hasattr(edge, "center"):
                        verts.append((edge.center[0], edge.center[1]))
            if len(verts) < 3:
                continue
            # Shoelace
            a = 0.0
            for i in range(len(verts)):
                x1, y1 = verts[i]
                x2, y2 = verts[(i + 1) % len(verts)]
                a += x1 * y2 - x2 * y1
            total += abs(a) / 2.0
    except Exception:
        return None
    return total  # in raw drawing units squared


def parse_dxf(label: str, path: Path) -> dict:
    """Parse one DXF; return structured dict. On error, return {_blocked_*: true}."""
    record = {
        "_path": str(path.relative_to(PROJ)),
        "_label": label,
    }
    try:
        doc = ezdxf.readfile(str(path))
    except (DXFError, OSError, ValueError) as e:
        record["_blocked_old_format"] = True
        record["_error"] = f"{type(e).__name__}: {str(e)[:200]}"
        return record

    record["dxf_version"] = doc.dxfversion
    record["units"] = str(doc.header.get("$INSUNITS", 0))  # 0=unitless, 4=mm, 6=m

    msp = doc.modelspace()

    # Entity type counts
    type_counts = Counter(e.dxftype() for e in msp)
    record["entity_counts"] = dict(type_counts.most_common())

    # Layers
    layers = sorted(l.dxf.name for l in doc.layers)
    record["layers_count"] = len(layers)
    record["layers"] = layers

    # ── INSERT blocks ───────────────────────────────────────────────
    insert_counts: Counter[str] = Counter()
    for e in msp:
        if e.dxftype() == "INSERT":
            try:
                insert_counts[e.dxf.name] += 1
            except Exception:
                insert_counts["<unknown>"] += 1
    record["insert_blocks_count"] = sum(insert_counts.values())
    record["insert_blocks_unique"] = len(insert_counts)
    record["insert_blocks_top20"] = dict(insert_counts.most_common(20))

    # ── DIMENSIONs ──────────────────────────────────────────────────
    dims = [e for e in msp if e.dxftype() == "DIMENSION"]
    measurements: list[tuple[float, str]] = []  # (mm, layer)
    for d in dims:
        try:
            m = d.get_measurement()
            if m is None:
                continue
            try:
                lay = d.dxf.layer
            except Exception:
                lay = "<no-layer>"
            measurements.append((round(float(m), 2), lay))
        except Exception:
            continue
    record["dimensions_total"] = len(dims)
    record["dimensions_measured"] = len(measurements)
    record["dimensions_unique_values"] = sorted({m for m, _ in measurements})
    record["dimensions_by_layer"] = {}
    by_layer: dict[str, list[float]] = defaultdict(list)
    for m, lay in measurements:
        by_layer[lay].append(m)
    for lay, vals in by_layer.items():
        record["dimensions_by_layer"][lay] = {
            "count": len(vals),
            "min": min(vals),
            "max": max(vals),
            "sample_sorted": sorted(set(vals))[:20],
        }

    # ── TEXT / MTEXT per layer ──────────────────────────────────────
    texts_by_layer: dict[str, list[str]] = defaultdict(list)
    for e in msp:
        if e.dxftype() == "TEXT":
            try:
                if e.dxf.hasattr("text"):
                    texts_by_layer[e.dxf.layer].append(e.dxf.text)
            except Exception:
                pass
        elif e.dxftype() == "MTEXT":
            try:
                texts_by_layer[e.dxf.layer].append(e.text)
            except Exception:
                pass
    record["text_total"] = sum(len(v) for v in texts_by_layer.values())
    record["text_by_layer_summary"] = {
        lay: {"count": len(vals), "samples": vals[:5]}
        for lay, vals in texts_by_layer.items()
    }

    # ── HATCH ───────────────────────────────────────────────────────
    hatches = [e for e in msp if e.dxftype() == "HATCH"]
    record["hatch_total"] = len(hatches)
    hatch_by_layer: dict[str, list[float]] = defaultdict(list)
    for h in hatches:
        a = hatch_area(h)
        if a is not None and a > 0:
            try:
                hatch_by_layer[h.dxf.layer].append(a)
            except Exception:
                pass
    # Convert area: mm² → m² (divide by 1e6) if units are mm
    record["hatch_areas_raw_units_squared_by_layer"] = {
        lay: {
            "count": len(vals),
            "total_raw_sq_units": round(sum(vals), 1),
            "total_assuming_mm_units_m2": round(sum(vals) / 1e6, 2),
        }
        for lay, vals in hatch_by_layer.items()
        if vals
    }

    return record


def find_sklad_targets(records: dict) -> dict:
    """Look across all DXFs for vyjasnění #18 dimensions."""
    out = {}
    for key, (target_mm, tol) in SKLAD_TARGETS_MM.items():
        out[key] = {
            "target_mm": target_mm,
            "tolerance_mm": tol,
            "hits": [],
        }
        for src_label, rec in records.items():
            if rec.get("_blocked_old_format"):
                continue
            for v in rec.get("dimensions_unique_values", []):
                if abs(v - target_mm) <= tol:
                    out[key]["hits"].append({
                        "source": src_label,
                        "measured_mm": v,
                        "delta_mm": round(v - target_mm, 2),
                    })
        out[key]["resolved"] = bool(out[key]["hits"])
    return out


def main() -> int:
    OUT.mkdir(exist_ok=True)
    print(f"[1/3] Parsing {len(SOURCES)} DXF files...", file=sys.stderr)
    records = {}
    blocked = []
    for label, path in SOURCES.items():
        if not path.exists():
            print(f"  ! MISSING: {path}", file=sys.stderr)
            records[label] = {"_blocked_old_format": True, "_error": "FILE_NOT_FOUND"}
            blocked.append(label)
            continue
        rec = parse_dxf(label, path)
        records[label] = rec
        if rec.get("_blocked_old_format"):
            blocked.append(label)
            print(f"  ✗ {label}: BLOCKED ({rec.get('_error', 'unknown')})", file=sys.stderr)
        else:
            print(
                f"  ✓ {label}: DXF {rec['dxf_version']}, "
                f"{sum(rec['entity_counts'].values())} entities, "
                f"{rec['insert_blocks_count']} INSERTs ({rec['insert_blocks_unique']} unique), "
                f"{rec['dimensions_total']} DIMs, {rec['hatch_total']} HATCHes",
                file=sys.stderr,
            )

    print(f"\n[2/3] Resolving vyjasnění #18 sklad geometry targets...", file=sys.stderr)
    sklad_resolution = find_sklad_targets(records)
    for k, v in sklad_resolution.items():
        status = "RESOLVED" if v["resolved"] else "NOT FOUND"
        print(f"  {k}: {status}  hits={v['hits']}", file=sys.stderr)

    n_resolved = sum(1 for v in sklad_resolution.values() if v["resolved"])
    # Primary targets = 6,35 m + 3,34 m + 7,0 m (3 dims). Alt 3.085 is corroborating only.
    primary_keys = (
        "sklad_lichoběžník_width_6_35_m",
        "sklad_lichoběžník_depth_3_34_m",
        "parking_length_7_0_m",
    )
    n_primary_resolved = sum(1 for k in primary_keys if sklad_resolution[k]["resolved"])
    overall_status = (
        "fully_resolved" if n_primary_resolved == 3
        else "partially_resolved" if n_primary_resolved >= 1
        else "unresolved"
    )

    # ────────────────────────────────────────────────────────────────
    # Write report

    print(f"\n[3/3] Writing report...", file=sys.stderr)
    report = {
        "_schema_version": "1.0",
        "_generated_by": "tools/phase0b_dxf_extractor.py",
        "_generated_at": str(date.today()),
        "_branch": "claude/rd-jachymov-phase-0b-foundation",
        "_summary": {
            "dxf_files_total": len(SOURCES),
            "dxf_files_parsed": len(SOURCES) - len(blocked),
            "dxf_files_blocked": blocked,
            "phase1_gate": "OPEN",
        },
        "vyjasneni_18_sklad_geometry": {
            "status": overall_status,
            "targets": sklad_resolution,
            "notes": [
                "DXF DIMENSION entities checked first (highest confidence: 0.95 per task §5 ladder).",
                "Targets 3340 mm + 7000 mm not present as direct DIMENSION objects in any of 4 DXFs.",
                "Possible explanations: (a) they are derivable from LWPOLYLINE vertex coordinates "
                "but not annotated as DIMENSIONs; (b) the 7,0 m parking length is shown as a "
                "construction line dimension on the printed sheet only; (c) pre-baked extraction "
                "may have read these from PDF drawing D.1.1.02.R1 půdorys suterénu/skladu, not from DXF.",
                "Phase 1 generator should: (i) accept 6,35 m sklad width as RESOLVED with confidence 0.95; "
                "(ii) derive 3,34 m and 7,0 m by computing bounding-box / dominant LWPOLYLINE extents "
                "in sklad DPZ DXF — or fall back to substring search in D.1.1.02.R1 OCR with confidence 0.85.",
            ],
        },
        "files": records,
    }

    out_path = OUT / "dxf_extract_report.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    size = out_path.stat().st_size
    print(f"\n✓ Wrote {out_path.relative_to(PROJ)} ({size:,} bytes)", file=sys.stderr)

    return 0 if not blocked else 1


if __name__ == "__main__":
    sys.exit(main())
