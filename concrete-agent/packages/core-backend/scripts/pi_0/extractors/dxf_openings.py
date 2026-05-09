"""DXF opening (door/window/curtain-wall) block parsing + extraction.

Step 2 of Π.0a (TASK_PHASE_PI_0_SPEC.md §5 step 2). Absorbs the
ArchiCAD-block-name attributes that the existing pipeline drops:
frame_type, swing_type, install_context, subtype, cad_lib_id.

Step 2.5 added: direct ezdxf-based reading of the DXFs produced by
`scripts/infrastructure/dwg_to_dxf_batch.py`. Replaces the earlier
legacy-JSON fallback so A/B/C buckets get populated alongside D.

Block-name format observed in DXF:

    HA_DR_Single_Swing_Solid - In_BJ_900x2100_Vstup-2000314-DPS_1NP-D
    │  │  └─ swing_type ──┘   │   │  │   │    │   └─ cad_lib_id ─┘
    │  └─ element                  │  │   │    └─ subtype
    └─ vendor                      │  └─ dimensions WxH (mm)
                                   └─ install_context

- vendor:           HA (ArchiCAD library), ABMV (custom), or other
- element:          DR (door), CW (curtain wall), W (window)
- swing_type:       Single_Swing_Solid, Double_Swing_Solid_FrameButt,
                    Single_Swing_Solid_wCasing, Sliding, etc.
- install_context:  In_BJ (interior — byt jednotka), In_FAS (façade),
                    In_OBJ (object wall), Ex_Glass (operable glass),
                    In (generic interior, no specific context)
- subtype:          Vstup (entrance), SKLOPNE (tilting), Unik (emergency
                    exit), SKLEP_CIP, varies — may be absent
- cad_lib_id:       numeric ArchiCAD library ID (vendor-neutral name
                    per Π.0 review feedback)
- doc_label:        drawing reference (DPS_1NP-D, ŘEZ 4-4 OBJEKT D…)
                    not lifted (mostly traceability noise)

Confidence convention: 0.95 (DERIVED from block_name string). Per
Π.0 SPEC §3.5: literal extraction = 1.0; arithmetic/regex on literals
= 0.95.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

try:
    import ezdxf
    from ezdxf.math import Vec3
    _EZDXF_AVAILABLE = True
except ImportError:
    _EZDXF_AVAILABLE = False

# DXF layers carrying opening INSERT entities (per dxf_full_inventory.md).
OPENING_LAYERS = {
    "A-DOOR-____-OTLN": "door",
    "A-GLAZ-____-OTLN": "window",
    "A-GLAZ-CURT-OTLN": "curtain_wall",
}

# IDEN layers carry the human-visible D##/W## type-code labels that
# pair (spatially) with each opening INSERT block.
OPENING_IDEN_LAYERS = {
    "door":         "A-DOOR-____-IDEN",
    "window":       "A-GLAZ-____-IDEN",
    "curtain_wall": "A-GLAZ-____-IDEN",  # curtain walls labeled on same layer
}

# Room polygon + room code layers
LAYER_ROOM_BOUNDARY = "A-AREA-BNDY-OTLN"
LAYER_ROOM_CODE = "A-AREA-____-IDEN"

# Wall / ceiling / floor finish IDEN layers — text annotations carrying
# segment tags (WF##, CF##, etc.).
SEGMENT_TAG_LAYERS = {
    "WF": "A-WALL-____-IDEN",
    "CF": "A-CLNG-____-IDEN",
    "OP": "A-GENM-____-IDEN",
    "LP": "A-FLOR-HRAL-IDEN",
    "TP": "A-WALL-____-IDEN",
    "F":  "A-WALL-____-IDEN",
    "FF": "A-FLOR-HRAL-IDEN",
    "RF": None,  # roof — comes from drawing-name detection only
}

# Spatial-match threshold for *-IDEN ↔ opening pairing (mm)
IDEN_MATCH_THRESHOLD_MM = 1500

# Single-token tag codes: WF20, CF21, FF03, F19, OP05, LI01, LP20, TP01,
# RF11, D04, D21, W03, etc. (1–3 letter prefix + 2–3 digits)
SEGMENT_TAG_RE = re.compile(r"\b([A-Z]{1,3})(\d{2,3})\b")

# Match WHOLE TEXT entity contents (anchored, like legacy parser):
SINGLE_TAG_RE = re.compile(r"^([A-Z]{1,3})(\d{2,3})$")
PREFIX_ONLY_RE = re.compile(r"^([A-Z]{1,3})$")
DIGITS_ONLY_RE = re.compile(r"^(\d{1,3})$")

# Layers carrying segment tags (per legacy dxf_parser.py SEGMENT_TAG_LAYERS
# + opening IDEN layers — D## / W## codes also live there as split tags).
#
# NOTE: E-LITE-EQPM-IDEN (lighting fixtures, electrical domain) is
# DELIBERATELY EXCLUDED — those are out of finishing scope per
# dxf_full_inventory.md classification, and produce 4 OS## codes / 85
# instances of pure noise in segment_counts. Keep finishing-only layers.
LEGACY_SEGMENT_TAG_LAYERS = {
    "A-WALL-____-IDEN",
    "A-CLNG-____-IDEN",
    "A-FLOR-HRAL-IDEN",
    "A-FLOR-____-IDEN",
    "A-GENM-____-IDEN",
    # Opening IDEN layers — host D## (door) + W## (window) split tags
    "A-DOOR-____-IDEN",
    "A-GLAZ-____-IDEN",
}

# Split-tag spatial-join tolerances (mm) — match legacy dxf_parser.py.
TAG_DY_MAX_MM = 250  # vertical max (digits BELOW prefix)
TAG_DX_MAX_MM = 80   # horizontal max

# ArchiCAD generates anonymous blocks with hex prefixes like `*U123` for
# block reference instances; the actual named block is the parent. Skip
# anonymous unless the block_name itself encodes attrs (rare).
_ANONYMOUS_BLOCK_RE = re.compile(r"^\*[UEAT]\d+$")

# Room code patterns matching D-objekt convention (and A/B/C analogs).
ROOM_CODE_RE = re.compile(
    r"^(?:[A-D]\.\d\.(?:\d|S|OB\d+)\.\d{2}|S\.[A-D]\.\d{2})$"
)

# Width × Height (× depth) in mm. Matches `1600x2350` and `1200 × 2100 × 800`.
DIMENSIONS_RE = re.compile(
    r"(\d{3,4})\s*[xX×]\s*(\d{3,4})(?:\s*[xX×]\s*(\d{3,4}))?"
)

# Numeric ArchiCAD library ID (4–8 digits) tucked between hyphens before
# the doc_label. e.g. `…-2000314-DPS_1NP-D` → cad_lib_id = "2000314".
CAD_LIB_ID_RE = re.compile(r"-(\d{4,8})-")

# Recognised install-context prefixes (longest-first to avoid `In` swallowing
# `In_BJ`).
INSTALL_CONTEXTS = (
    "In_BJ",
    "In_FAS",
    "In_OBJ",
    "In_GAR",
    "Ex_Glass",
    "Ex_FAS",
    "In",
    "Ex",
)


def _to_field(value: Any, *, source: str = "DERIVED|block_name", confidence: float = 0.95) -> dict:
    """Wrap a value as `{value, source, confidence}` per Π.0 schema."""
    return {"value": value, "source": source, "confidence": confidence}


def parse_block_name(block_name: str | None) -> dict:
    """Parse an ArchiCAD opening block name into structured attributes.

    Returns a dict of `{field_name: {value, source, confidence}}` triples
    suitable for direct assignment to `openings[*].block_attrs` in
    master_extract.json.

    Always returns the full set of fields (with `value=None` for ones
    that can't be resolved). The caller can then test
    `any(field['value'] is not None for field in result.values())` to
    decide whether parsing succeeded at all (used to compute the
    ≥90 % gate from §5 step 2).

    Unparseable names produce a result where every field is `None` —
    the orchestrator records a warning for those.
    """
    out = {
        "vendor": _to_field(None),
        "element": _to_field(None),
        "swing_type": _to_field(None),
        "frame_type": _to_field(None),
        "install_context": _to_field(None),
        "subtype": _to_field(None),
        "cad_lib_id": _to_field(None),
    }
    if not block_name or not isinstance(block_name, str):
        return out

    # The block name must contain the " - " separator that splits the
    # vendor/element/swing portion from the install/dim/lib_id portion.
    # Without it we have no signal that this is a real ArchiCAD block name
    # — anything else (e.g. "garbage") is treated as unparseable.
    if " - " not in block_name:
        return out

    left, right = block_name.split(" - ", 1)

    # ---- LEFT: vendor / element / swing_type / frame_type --------------
    left_tokens = [t for t in left.split("_") if t]
    if left_tokens:
        out["vendor"] = _to_field(left_tokens[0])
    if len(left_tokens) > 1:
        out["element"] = _to_field(left_tokens[1])
    if len(left_tokens) > 2:
        # Everything after vendor + element joined back is the swing type.
        # frame_type, when present, is the last qualifier (Solid / FrameButt /
        # wCasing / Generic). It's a subset of the swing_type qualifiers.
        rest = left_tokens[2:]
        out["swing_type"] = _to_field("_".join(rest))
        FRAME_QUALIFIERS = {"Solid", "FrameButt", "wCasing", "Generic"}
        last = rest[-1]
        if last in FRAME_QUALIFIERS:
            out["frame_type"] = _to_field(last)

    # ---- RIGHT: install_context / dimensions / subtype / cad_lib_id ----
    if right:
        # cad_lib_id (numeric token between hyphens, e.g. -2000314-)
        lib_match = CAD_LIB_ID_RE.search(right)
        if lib_match:
            out["cad_lib_id"] = _to_field(lib_match.group(1))

        # install_context: longest-first match against known prefixes
        tail = right
        for ctx in INSTALL_CONTEXTS:
            if right.startswith(ctx + "_") or right == ctx or right.startswith(ctx + " "):
                out["install_context"] = _to_field(ctx)
                tail = right[len(ctx):].lstrip("_ ")
                break

        # subtype: token between (dimensions OR install_context) and the
        # cad_lib_id hyphen. When dimensions are present (typical for
        # doors/windows) take what's after them; when absent (curtain-wall
        # blocks like Ex_Glass_SKLOPNE-…) take what's after install_context.
        dim_match = DIMENSIONS_RE.search(tail)
        candidate_tail = tail[dim_match.end():] if dim_match else tail
        candidate_tail = candidate_tail.lstrip("_ ")
        if candidate_tail:
            # Drop the `-NNNNNNN-doc_label` tail (everything from first hyphen).
            subtype_token = candidate_tail.split("-", 1)[0].strip("_ ")
            if subtype_token:
                out["subtype"] = _to_field(subtype_token)

    return out


def parsed_anything(parsed: dict) -> bool:
    """Heuristic for the ≥ 90 % gate: did the parser resolve any field?"""
    return any(field["value"] is not None for field in parsed.values())


def parse_dimensions_from_block_name(block_name: str | None) -> tuple[int | None, int | None, int | None]:
    """Extract (W, H, depth) mm from a block name. Used as a sanity cross-
    check against the DXF parser's own width_mm / height_mm fields."""
    if not block_name or not isinstance(block_name, str):
        return None, None, None
    m = DIMENSIONS_RE.search(block_name)
    if not m:
        return None, None, None
    w = int(m.group(1))
    h = int(m.group(2))
    d = int(m.group(3)) if m.group(3) else None
    return w, h, d


# ---------------------------------------------------------------------------
# Step 2.5 — direct DXF reading via ezdxf
# ---------------------------------------------------------------------------

def extract_openings_from_dxf(dxf_path: Path) -> list[dict]:
    """Read INSERT entities on opening-relevant layers from a single DXF.

    Returns a list of dicts shaped like the legacy DXF parser output
    (otvor_type, type_code, block_name, position, width_mm, height_mm,
    source_drawing, source_layer) so the orchestrator can wrap each in
    the master_extract.openings[] schema.

    Layers consumed (per dxf_full_inventory.md):
      - A-DOOR-____-OTLN  → otvor_type='door'
      - A-GLAZ-____-OTLN  → otvor_type='window'
      - A-GLAZ-CURT-OTLN  → otvor_type='curtain_wall'
    Anonymous block references (`*UNNN`) are skipped — they're block
    instances, not named opening blocks.

    type_code is heuristically pulled from the block name's leading
    `D##` / `W##` token if present (e.g. block_name starts `D21_…`).
    Otherwise None — Step 5 will do proper IDEN-tag spatial matching.
    """
    if not _EZDXF_AVAILABLE:
        return []
    try:
        doc = ezdxf.readfile(str(dxf_path))
    except (IOError, ezdxf.DXFError):
        return []

    msp = doc.modelspace()
    drawing_key = dxf_path.stem
    out: list[dict] = []

    for entity in msp.query("INSERT"):
        layer = entity.dxf.layer
        otvor_type = OPENING_LAYERS.get(layer)
        if otvor_type is None:
            continue
        block_name = entity.dxf.name
        if _ANONYMOUS_BLOCK_RE.match(block_name):
            continue
        w, h, d = parse_dimensions_from_block_name(block_name)
        out.append({
            "otvor_type": otvor_type,
            "type_code": _heuristic_type_code(block_name),
            "block_name": block_name,
            "source_drawing": drawing_key,
            "source_layer": layer,
            "position": [round(entity.dxf.insert.x, 6),
                         round(entity.dxf.insert.y, 6)],
            "width_mm": w,
            "height_mm": h,
            "depth_mm": d,
        })
    return out


_LEADING_TYPE_CODE_RE = re.compile(r"\b([DW])(\d{2})\b")


def _heuristic_type_code(block_name: str) -> str | None:
    """Extract a leading D## / W## token from the block name, if present.

    Most ArchiCAD blocks DON'T encode the user-facing D## / W## type
    code in the block name (it lives as a separate `*-IDEN` text
    annotation that requires spatial join). This helper exists as a
    fallback when the spatial matcher (parse_dxf_full) cannot find an
    *-IDEN tag near the opening (e.g. ŘEZY drawings have no IDEN tags).
    """
    m = _LEADING_TYPE_CODE_RE.search(block_name or "")
    return f"{m.group(1)}{m.group(2)}" if m else None


# ---------------------------------------------------------------------------
# Step 5 — full-DXF parse: rooms + openings + IDEN tags + segment tags
# ---------------------------------------------------------------------------

def _entity_text(entity) -> str | None:
    """Extract plain text from a TEXT or MTEXT entity, stripped."""
    try:
        if entity.dxftype() == "MTEXT":
            return (entity.plain_text() or "").strip()
        if entity.dxftype() == "TEXT":
            return (entity.dxf.text or "").strip()
    except (AttributeError, KeyError):
        return None
    return None


def _entity_position(entity) -> list[float] | None:
    """Best-effort (x, y) coordinates as plain Python list[float],
    rounded to 6 decimals (cast away numpy floats for JSON roundtrip)."""
    try:
        if entity.dxftype() == "INSERT":
            p = entity.dxf.insert
        elif entity.dxftype() == "MTEXT":
            p = entity.dxf.insert
        elif entity.dxftype() == "TEXT":
            p = entity.dxf.insert
        else:
            return None
        return [round(float(p.x), 6), round(float(p.y), 6)]
    except (AttributeError, KeyError):
        return None


def parse_dxf_full(dxf_path: Path) -> dict:
    """Parse a single DXF and return structured data ready for caching.

    Returns:
      {
        "drawing_key": str,        # source DXF stem
        "rooms": [...],            # polygon + code (per A-AREA layers)
        "raw_openings": [...],     # INSERT blocks on opening layers
        "opening_iden_tags": [...],# TEXT/MTEXT on *-DOOR-IDEN / *-GLAZ-IDEN
        "segment_tags": [...],     # WF/CF/F/OP/LI/LP/TP/RF tags from IDEN
      }

    The cache layer wraps this; orchestrator (extract.py) post-processes
    raw_openings into block_attrs + spatial-matched type_code, builds
    room_codes per polygon via point-in-polygon, etc.
    """
    if not _EZDXF_AVAILABLE:
        return {"drawing_key": dxf_path.stem, "rooms": [],
                "raw_openings": [], "opening_iden_tags": [], "segment_tags": []}
    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception:
        return {"drawing_key": dxf_path.stem, "rooms": [],
                "raw_openings": [], "opening_iden_tags": [], "segment_tags": []}

    msp = doc.modelspace()
    drawing_key = dxf_path.stem

    rooms: list[dict] = []
    raw_openings: list[dict] = []
    opening_iden_tags: list[dict] = []
    segment_tags: list[dict] = []
    room_code_texts: list[dict] = []   # collected separately, joined to rooms below
    # For two-pass segment-tag extraction (single + split_join):
    iden_text_by_layer: dict[str, list[tuple[str, list[float]]]] = {}

    for entity in msp:
        layer = entity.dxf.layer if hasattr(entity.dxf, "layer") else None
        etype = entity.dxftype()

        # ---- Room polygons --------------------------------------------
        if layer == LAYER_ROOM_BOUNDARY and etype == "LWPOLYLINE":
            try:
                # Normalize to plain Python list[list[float]] for JSON
                # roundtrip equality (ezdxf returns numpy floats; cache
                # roundtrip → plain floats, so we standardize at parse).
                pts = [[round(float(p[0]), 6), round(float(p[1]), 6)]
                       for p in entity.get_points("xy")]
                if len(pts) >= 3 and entity.closed:
                    rooms.append({
                        "polygon": pts,
                        "centroid": _centroid(pts),
                        "area_m2": float(_polygon_area(pts) / 1_000_000),  # mm² → m²
                        "perimeter_m": float(_polygon_perimeter(pts) / 1_000),
                    })
            except (AttributeError, ValueError):
                pass
            continue

        # ---- Room codes (text on A-AREA-IDEN) -------------------------
        if layer == LAYER_ROOM_CODE and etype in ("MTEXT", "TEXT"):
            text = _entity_text(entity)
            pos = _entity_position(entity)
            if text and pos and ROOM_CODE_RE.match(text):
                room_code_texts.append({"code": text, "position": pos})
            continue

        # ---- Opening INSERT blocks ------------------------------------
        if etype == "INSERT" and layer in OPENING_LAYERS:
            block_name = entity.dxf.name
            if _ANONYMOUS_BLOCK_RE.match(block_name):
                continue
            otvor_type = OPENING_LAYERS[layer]
            w, h, d = parse_dimensions_from_block_name(block_name)
            raw_openings.append({
                "otvor_type": otvor_type,
                "block_name": block_name,
                "source_layer": layer,
                "position": _entity_position(entity) or [0.0, 0.0],
                "width_mm": w,
                "height_mm": h,
                "depth_mm": d,
            })
            continue

        # ---- Opening IDEN labels (D##/W## text near INSERT) -----------
        # NOTE: do NOT `continue` — same TEXT entities also feed
        # segment_tags pass below (legacy dxf_segment_counts treats
        # D/W codes as tags too).
        if etype in ("MTEXT", "TEXT") and layer in OPENING_IDEN_LAYERS.values():
            text = _entity_text(entity)
            pos = _entity_position(entity)
            if text and pos:
                m = SEGMENT_TAG_RE.search(text)
                if m:
                    prefix, num = m.group(1), m.group(2)
                    if prefix in ("D", "W"):
                        opening_iden_tags.append({
                            "code": f"{prefix}{num}",
                            "position": pos,
                            "source_layer": layer,
                        })
            # fall through — segment_tags pass below picks up D/W too

        # ---- Collect IDEN text for segment-tag two-pass extraction ----
        # (single + split_join, matching legacy dxf_parser.py exactly).
        if (etype in ("MTEXT", "TEXT")
                and layer in LEGACY_SEGMENT_TAG_LAYERS):
            text = _entity_text(entity)
            pos = _entity_position(entity)
            if text and pos:
                iden_text_by_layer.setdefault(layer, []).append((text, pos))

    # Spatial-join room codes ↔ polygons via point-in-polygon
    for room in rooms:
        room["code"] = None
        for rc in room_code_texts:
            if _point_in_polygon(rc["position"], room["polygon"]):
                room["code"] = rc["code"]
                break

    # Two-pass segment-tag extraction per layer (legacy-compatible):
    #   pass A: TEXT entities matching `^[A-Z]{1,3}\d{2,3}$` (whole text)
    #   pass B: PREFIX text above DIGITS text spatially joined
    #             (LP / 09 → LP09)
    for layer, items in iden_text_by_layer.items():
        prefixes_only: list[tuple[str, float, float]] = []
        digits_only: list[tuple[str, float, float]] = []
        for text, pos in items:
            x, y = pos[0], pos[1]
            m = SINGLE_TAG_RE.match(text)
            if m:
                segment_tags.append({
                    "code": text,
                    "prefix": m.group(1),
                    "position": pos,
                    "source_layer": layer,
                    "extraction": "single_text",
                })
                continue
            m = PREFIX_ONLY_RE.match(text)
            if m:
                prefixes_only.append((text, x, y))
                continue
            m = DIGITS_ONLY_RE.match(text)
            if m:
                digits_only.append((text, x, y))
        # Spatial join: prefix above digits within (DX_MAX, DY_MAX)
        used: set[int] = set()
        for ptext, px, py in prefixes_only:
            best_i = -1
            best_d = float("inf")
            for i, (dtext, dx_, dy_) in enumerate(digits_only):
                if i in used:
                    continue
                dx = abs(dx_ - px)
                dy = py - dy_  # prefix expected above digits
                if 0 < dy <= TAG_DY_MAX_MM and dx <= TAG_DX_MAX_MM:
                    d = dx + dy
                    if d < best_d:
                        best_d = d
                        best_i = i
            if best_i >= 0:
                used.add(best_i)
                dtext, dx_, dy_ = digits_only[best_i]
                code = f"{ptext}{int(dtext):02d}"
                segment_tags.append({
                    "code": code,
                    "prefix": ptext,
                    "position": [round(float(px), 6), round(float(dy_), 6)],
                    "source_layer": layer,
                    "extraction": "split_join",
                })

    return {
        "drawing_key": drawing_key,
        "rooms": rooms,
        "raw_openings": raw_openings,
        "opening_iden_tags": opening_iden_tags,
        "segment_tags": segment_tags,
    }


# ---------------------------------------------------------------------------
# Geometry helpers (no shapely dependency — pure Python)
# ---------------------------------------------------------------------------

def _polygon_area(pts: list[tuple[float, float]]) -> float:
    """Shoelace area in same units as input."""
    if len(pts) < 3:
        return 0.0
    s = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _polygon_perimeter(pts: list[tuple[float, float]]) -> float:
    if len(pts) < 2:
        return 0.0
    total = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        total += ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    return total


def _centroid(pts: list[tuple[float, float]]) -> list[float]:
    """Polygon centroid (vertex-mean fallback for degenerate polygons)."""
    if not pts:
        return [0.0, 0.0]
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    return [round(cx, 6), round(cy, 6)]


def _point_in_polygon(point: list[float], polygon: list[tuple[float, float]]) -> bool:
    """Ray-cast point-in-polygon."""
    if len(polygon) < 3:
        return False
    x, y = point[0], point[1]
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def find_nearest_iden_code(opening_pos: list[float],
                             iden_tags: list[dict],
                             threshold_mm: float = IDEN_MATCH_THRESHOLD_MM) -> str | None:
    """Return the nearest IDEN tag code within `threshold_mm`, or None."""
    if not opening_pos or not iden_tags:
        return None
    best_dist = float("inf")
    best_code = None
    ox, oy = opening_pos[0], opening_pos[1]
    for tag in iden_tags:
        tx, ty = tag["position"][0], tag["position"][1]
        d = ((tx - ox) ** 2 + (ty - oy) ** 2) ** 0.5
        if d < best_dist and d <= threshold_mm:
            best_dist = d
            best_code = tag["code"]
    return best_code
