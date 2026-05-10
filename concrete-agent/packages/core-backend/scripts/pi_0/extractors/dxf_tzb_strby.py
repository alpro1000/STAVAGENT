"""Π.0a Step 8c — TZB štroby (wall chases for cable trays) extraction.

Per `probe_9_full_audit_per_section.md` (2026-05-10), wall chases are
visible only on silnoproud `0_el_trasy` and slaboproud `SLP-_TRASY`
layers as LINE / LWPOLYLINE entities — vodovod / kanalizace / UT / plyn
do not annotate štroby on their drawings (those disciplines run pipes
through floor slabs as prostupy, not through walls as chases).

Each LINE / LWPOLYLINE on a chase layer is treated as one cable-tray
segment. Length is the polyline length in mm; per-record HSV-961
quantification can sum lengths × standard chase cross-section per
discipline.

Output records (one per segment):
    {
        "id": "{objekt}.{discipline}.{podlazi}.strba.{idx:04d}",
        "discipline": "silnoproud" | "slaboproud",
        "podlazi": "1.PP" | "1.NP" | "2.NP" | "3.NP",
        "length_m": float,
        "source_kind": "line" | "lwpolyline",
        "source_layer": "{layer name}",
        "source_drawing": "{drawing key}",
        "spec":      {value, source, confidence}  # nearby žlab spec
        "confidence": 0.85,                        # geometry-derived
    }
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Optional

import ezdxf

# ---------------------------------------------------------------------------
# Discipline -> filename map (only sil + slb annotate chases)
# ---------------------------------------------------------------------------
STRBY_DXF_PATTERNS: dict[tuple[str, str], list[tuple[str, str]]] = {
    ("D", "1.NP"): [
        ("silnoproud", "D_1NP_sil.dxf"),
        ("slaboproud", "D_1NP_slb.dxf"),
    ],
    ("D", "2.NP"): [
        ("silnoproud", "D_2NP_sil.dxf"),
        ("slaboproud", "D_2NP_slb.dxf"),
    ],
    ("D", "3.NP"): [
        ("silnoproud", "D_3NP_sil.dxf"),
        ("slaboproud", "D_3NP_slb.dxf"),
    ],
    # 1.PP slaboproud only — no standalone silnoproud DWG (embedded in
    # _100_9000 koord overlay; chase content not separable from pipe runs
    # at overlay level, so only slaboproud chases captured for 1.PP).
    ("D", "1.PP"): [
        ("slaboproud", "1pp_slb.dxf"),
    ],
}

# Chase-specific layer subset (NOT all silnoproud / slaboproud layers
# represent chases; only the cable-tray ones do).
CHASE_LAYERS: dict[str, list[str]] = {
    "silnoproud": ["0_el_trasy"],
    "slaboproud": ["SLP-_TRASY"],
}

# žlab spec extraction: TEXT/MTEXT containing patterns like "100/50",
# "125/50", "žlab 100/50". Extract width × height (mm).
_ZLAB_RE = re.compile(r"(\d{2,4})\s*[/×x]\s*(\d{2,4})")


def _line_length_mm(start: tuple, end: tuple) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    return math.sqrt(dx * dx + dy * dy)


def _polyline_length_mm(points: list) -> float:
    total = 0.0
    for i in range(len(points) - 1):
        total += _line_length_mm(points[i], points[i + 1])
    return total


def _drawing_key(dxf_path: Path) -> str:
    return dxf_path.stem


def _extract_zlab_spec(text: str) -> Optional[tuple[int, int]]:
    """Parse 'žlab 100/50' / '125/50' → (100, 50). Returns None if no match."""
    if not text:
        return None
    m = _ZLAB_RE.search(text)
    if m:
        w, h = int(m.group(1)), int(m.group(2))
        # Plausible cable-tray range: 50–600 mm width, 25–200 mm height
        if 50 <= w <= 600 and 25 <= h <= 200:
            return (w, h)
    return None


def _extract_one_dxf(
    dxf_path: Path,
    discipline: str,
    podlazi: str,
    objekt: str,
    counter: list[int],
) -> tuple[list[dict], list[dict]]:
    if not dxf_path.exists():
        return [], []
    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as e:
        return [], [{
            "level": "warning",
            "category": "tzb_dxf_unreadable",
            "message": (
                f"Step 8c (štroby): ezdxf could not read {dxf_path.name} "
                f"({type(e).__name__}). Discipline {discipline} "
                f"podlazi {podlazi} skipped."
            ),
            "source_evidence": str(dxf_path.name),
        }]

    layer_pats = CHASE_LAYERS.get(discipline, [])
    drawing_key = _drawing_key(dxf_path)

    # Collect žlab spec from TEXT/MTEXT on the chase layer
    zlab_spec_global: Optional[tuple[int, int]] = None
    for layout_name in doc.layouts.names_in_taborder():
        for e in doc.layouts.get(layout_name):
            if e.dxftype() not in ("TEXT", "MTEXT"):
                continue
            if e.dxf.layer not in layer_pats:
                continue
            try:
                text = e.text if e.dxftype() == "MTEXT" else e.dxf.text
            except Exception:
                continue
            spec = _extract_zlab_spec(text)
            if spec:
                zlab_spec_global = spec
                break
        if zlab_spec_global:
            break

    strby: list[dict] = []
    for layout_name in doc.layouts.names_in_taborder():
        for e in doc.layouts.get(layout_name):
            kind = e.dxftype()
            if e.dxf.layer not in layer_pats:
                continue
            if kind == "LINE":
                start = (e.dxf.start.x, e.dxf.start.y)
                end = (e.dxf.end.x, e.dxf.end.y)
                length_mm = _line_length_mm(start, end)
                source_kind = "line"
            elif kind == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in e.get_points("xy")]
                if len(pts) < 2:
                    continue
                length_mm = _polyline_length_mm(pts)
                source_kind = "lwpolyline"
            else:
                continue

            # Skip degenerate segments (shorter than 100 mm — likely
            # symbol artefacts, not real chase runs).
            if length_mm < 100.0:
                continue

            counter[0] += 1
            idx = counter[0]
            entry: dict = {
                "id": f"{objekt}.{discipline}.{podlazi}.strba.{idx:04d}",
                "discipline": discipline,
                "podlazi": podlazi,
                "length_m": round(length_mm / 1000.0, 6),
                "source_kind": source_kind,
                "source_layer": e.dxf.layer,
                "source_drawing": drawing_key,
                "spec": {
                    "value": (
                        f"žlab {zlab_spec_global[0]}/{zlab_spec_global[1]}"
                        if zlab_spec_global else None
                    ),
                    "source": (
                        f"DXF|{drawing_key}|MTEXT|drawing-wide"
                        if zlab_spec_global else f"DXF|{drawing_key}|none"
                    ),
                    "confidence": 0.85 if zlab_spec_global else 0.0,
                },
                "confidence": 0.85,  # geometry-derived from polyline length
            }
            strby.append(entry)

    return strby, []


def extract_tzb_strby(
    objekt: str, sources_root: Path
) -> tuple[list[dict], list[dict]]:
    """Walk every (discipline, podlazi) pair for `objekt` and return
    a flat list of štroba records + extraction warnings."""
    strby: list[dict] = []
    warnings: list[dict] = []
    counter = [0]

    objekt_dxf = sources_root / objekt / "dxf"
    shared_dxf = sources_root / "shared" / "dxf"

    for (obj, podlazi), discipline_files in STRBY_DXF_PATTERNS.items():
        if obj != objekt:
            continue
        for discipline, fname in discipline_files:
            candidate_paths = [objekt_dxf / fname, shared_dxf / fname]
            dxf_path = next((p for p in candidate_paths if p.exists()), candidate_paths[0])
            new_records, new_warnings = _extract_one_dxf(
                dxf_path, discipline, podlazi, objekt, counter
            )
            strby.extend(new_records)
            warnings.extend(new_warnings)

    # Stable sort for idempotency
    strby.sort(key=lambda r: (
        r["podlazi"], r["discipline"], r["source_drawing"], r["id"]
    ))

    if strby or warnings:
        per_discipline: dict[str, dict] = {}
        for r in strby:
            d = r["discipline"]
            entry = per_discipline.setdefault(d, {"count": 0, "total_m": 0.0})
            entry["count"] += 1
            entry["total_m"] += r["length_m"]
        # Round totals for warning message
        per_discipline_rounded = {
            d: {"count": v["count"], "total_m": round(v["total_m"], 2)}
            for d, v in per_discipline.items()
        }
        warnings.append({
            "level": "info",
            "category": "step_8c_strby_gate",
            "message": (
                f"Step 8c: {len(strby)} TZB štroby (cable-tray segments) "
                f"extracted for objekt {objekt}; per-discipline "
                f"{per_discipline_rounded}."
            ),
            "source_evidence": "DERIVED|step_8c_extract_tzb_strby",
        })

    return strby, warnings
