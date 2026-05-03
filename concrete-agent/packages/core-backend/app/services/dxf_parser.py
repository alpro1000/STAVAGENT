"""
DXF parser (Phase 0.5 — Libuše DPS).

Extracts deterministic geometry from DXF drawings produced by ArchiCAD with
AIA-style layer naming. Targets data needed for the výkaz výměr pipeline:
rooms (TEXT code + closed POLYLINE area), openings (door/window/curtain
INSERTs + spatial-joined IDEN tags), and segment tags (WF/CF/FF/OP/LI/LP
skladba codes scattered across *_IDEN layers).

Reference: test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md
Layer inventory + research: test-data/libuse/outputs/dxf_layer_inventory.md
                            test-data/libuse/outputs/dxf_segment_tag_inventory.md
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

import ezdxf
from shapely.geometry import Point, Polygon

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Module constants
# ---------------------------------------------------------------------------

# Room code patterns: D.1.4.02 (byt podlaží), D.1.S.01 (společné),
# A.1.OB1.01 (obchodní jednotka v objektu A).
ROOM_CODE_RE = re.compile(r"^[A-D]\.\d\.(?:\d|S|OB\d+)\.\d{2}$")

# Single-token tag codes: D21, FF20, OS04 (no split needed).
SINGLE_TAG_RE = re.compile(r"^([A-Z]{1,3})(\d{2,3})$")
PREFIX_ONLY_RE = re.compile(r"^([A-Z]{1,3})$")
DIGITS_ONLY_RE = re.compile(r"^(\d{1,3})$")

# Block name dimension parser: "1200x2100", "1200 × 2100 × 800", "625X1000".
DIMENSIONS_RE = re.compile(
    r"(\d{3,4})\s*[xX×]\s*(\d{3,4})(?:\s*[xX×]\s*(\d{3,4}))?"
)

# Layer constants (AIA naming).
LAYER_ROOM_CODES = "A-AREA-____-IDEN"
LAYER_ROOM_POLYGONS = "A-AREA-BNDY-OTLN"
LAYER_DOORS_OTLN = "A-DOOR-____-OTLN"
LAYER_DOORS_IDEN = "A-DOOR-____-IDEN"
LAYER_WINDOWS_OTLN = "A-GLAZ-____-OTLN"
LAYER_WINDOWS_IDEN = "A-GLAZ-____-IDEN"
LAYER_CURTAIN = "A-GLAZ-CURT-OTLN"
LAYER_MULLION_GRID_IGNORE = "A-GLAZ-CWMG-OTLN"  # NOT real openings
# IDEN layers we scan for SegmentTag extraction:
SEGMENT_TAG_LAYERS = (
    "A-WALL-____-IDEN",
    "A-CLNG-____-IDEN",
    "A-FLOR-HRAL-IDEN",
    "A-FLOR-____-IDEN",
    "A-GENM-____-IDEN",
    "E-LITE-EQPM-IDEN",
)

# Spatial-join tolerances (mm).
DEFAULT_TAG_RECONSTRUCTION_DY_MM = 250  # vertical max for split tag join
DEFAULT_TAG_RECONSTRUCTION_DX_MM = 80   # horizontal max for split tag join
DEFAULT_DOOR_TAG_RADIUS_MM = 1500       # door OTLN INSERT → IDEN tag
DEFAULT_WINDOW_TAG_RADIUS_MM = 2000     # window OTLN INSERT → IDEN tag
DEFAULT_OPENING_TAG_RADIUS_MM = 1500    # generic fallback

# Skip filename patterns (drawings irrelevant for finishing výkaz).
SKIP_FILENAME_PATTERNS = (
    re.compile(r"ARS.*desky", re.IGNORECASE),     # reinforcement of ŽB slabs
    re.compile(r"odvodneni", re.IGNORECASE),       # ZTI drainage details
)

# Best-guess prefix → category mapping. Caller (Phase 3) re-resolves
# F##/LI## ambiguity via Tabulka skladeb / Tabulka klempířských.
PREFIX_CATEGORY = {
    "D":  "door",
    "W":  "window",
    "WF": "wall_finish_skladba",
    "F":  "floor_or_facade_finish",   # AMBIGUOUS — F08 = facade Terca, F0x = floor
    "FF": "floor_finish_skladba",
    "CF": "ceiling_finish_skladba",
    "RF": "roof_skladba",
    "TP": "klempir",                   # real klempíř — distinct from LI
    "LI": "lista_or_internal",         # broad; Phase 3 disambiguates
    "LP": "zamecnik_railing",          # zábradlí, schodišť. madla
    "OP": "other_product",             # Tabulka ostatních prvků
    "OS": "lighting",                  # out of finishing scope
}

# DXF $INSUNITS values. We expect 4 (millimeters) for ArchiCAD exports.
INSUNITS_TO_NAME = {
    0: "unitless",
    1: "in",
    4: "mm",
    5: "cm",
    6: "m",
}


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class LayerInfo:
    name: str
    color: Optional[int]
    entity_count_by_type: dict[str, int]
    total_entities: int


@dataclass
class RoomGeometry:
    code: str                       # "D.1.4.02"
    objekt: str                     # "D"
    podlazi: str                    # "1.NP" / "1.PP" / "2.NP" / "3.NP"
    byt_or_section: str             # "4" | "S" | "OB1"
    mistnost_num: str               # "02"
    area_m2: Optional[float]
    perimeter_m: Optional[float]
    polygon_wkt: Optional[str]
    code_position: tuple[float, float]
    raw_layer_codes: str
    raw_layer_polygon: Optional[str]


@dataclass
class Opening:
    otvor_type: str                 # "door" | "window" | "curtain_wall"
    type_code: Optional[str]        # "D21", "W04", or None
    block_name: str                 # raw ArchiCAD block name
    position: tuple[float, float]
    width_mm: Optional[int]
    height_mm: Optional[int]
    depth_mm: Optional[int]
    source_layer: str
    tag_match_distance_mm: Optional[int]
    warnings: list[str] = field(default_factory=list)


@dataclass
class SegmentTag:
    code: str                       # "WF40", "CF20", "OP18", "F08"
    prefix: str                     # "WF", "CF", "OP", "F"
    position: tuple[float, float]
    source_layer: str
    category: str                   # from PREFIX_CATEGORY (or "unknown")
    extraction: str                 # "single_text" | "split_join"


@dataclass
class GeometryInfo:
    """Lightweight descriptor for orphan polygons / unmatched geometry."""
    centroid: tuple[float, float]
    area_m2: float
    perimeter_m: float
    layer: str


@dataclass
class ParsedDrawing:
    drawing_path: Path
    dxf_version: Optional[str] = None
    dxf_units: Optional[str] = None
    layers: list[LayerInfo] = field(default_factory=list)
    rooms: list[RoomGeometry] = field(default_factory=list)
    openings: list[Opening] = field(default_factory=list)
    segment_tags: list[SegmentTag] = field(default_factory=list)
    unmatched_polygons: list[GeometryInfo] = field(default_factory=list)
    skipped: bool = False
    skip_reason: Optional[str] = None
    parse_duration_ms: int = 0
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_dxf_drawing(dxf_path: Path) -> ParsedDrawing:
    """Parse a DXF file into a structured ParsedDrawing.

    Skips drawings irrelevant to finishing work (ARS desky, drainage details)
    via filename pattern. Non-fatal issues are collected as warnings; the
    parser never raises on missing geometry.
    """
    started = time.monotonic()
    result = ParsedDrawing(drawing_path=dxf_path)

    skip = _check_skip(dxf_path.name)
    if skip:
        result.skipped = True
        result.skip_reason = skip
        result.parse_duration_ms = int((time.monotonic() - started) * 1000)
        return result

    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as e:  # noqa: BLE001 — surface as warning, don't crash batch
        result.warnings.append(f"ezdxf.readfile failed: {type(e).__name__}: {e}")
        result.parse_duration_ms = int((time.monotonic() - started) * 1000)
        return result

    result.dxf_version = doc.dxfversion
    result.dxf_units = _detect_units(doc)
    if result.dxf_version != "AC1027":
        result.warnings.append(
            f"Unexpected DXF version {result.dxf_version!r} (expected AC1027); continuing"
        )

    msp = doc.modelspace()
    result.layers = _extract_layer_inventory(doc, msp)

    rooms, unmatched = _extract_rooms(msp, result.warnings)
    result.rooms = rooms
    result.unmatched_polygons = unmatched

    result.openings.extend(_extract_openings_doors(msp, result.warnings))
    result.openings.extend(_extract_openings_windows(msp, result.warnings))
    result.openings.extend(_extract_openings_curtain(msp, result.warnings))
    result.segment_tags = _extract_segment_tags(msp, result.warnings)

    result.parse_duration_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "Parsed %s: %d rooms, %d openings, %d segment tags, %d warnings (%d ms)",
        dxf_path.name,
        len(result.rooms),
        len(result.openings),
        len(result.segment_tags),
        len(result.warnings),
        result.parse_duration_ms,
    )
    return result


def parse_batch(dxf_paths: Iterable[Path]) -> dict[str, ParsedDrawing]:
    """Parse a list of DXF files; return dict keyed by file stem."""
    out: dict[str, ParsedDrawing] = {}
    for path in dxf_paths:
        out[path.stem] = parse_dxf_drawing(path)
    return out


# ---------------------------------------------------------------------------
# Skip + units helpers
# ---------------------------------------------------------------------------


def _check_skip(filename: str) -> Optional[str]:
    for pat in SKIP_FILENAME_PATTERNS:
        if pat.search(filename):
            return f"Filename matches skip pattern {pat.pattern!r} — not relevant for finishing výkaz"
    return None


def _detect_units(doc) -> str:
    """Read $INSUNITS from DXF header. Returns 'mm' / 'm' / etc."""
    try:
        v = doc.header.get("$INSUNITS", 0)
        return INSUNITS_TO_NAME.get(int(v), f"unknown({v})")
    except Exception:
        return "unknown"


# ---------------------------------------------------------------------------
# Layer inventory
# ---------------------------------------------------------------------------


def _extract_layer_inventory(doc, msp) -> list[LayerInfo]:
    layers_meta = {l.dxf.name: l for l in doc.layers}
    counts: dict[str, dict[str, int]] = {}
    for ent in msp:
        layer = getattr(ent.dxf, "layer", "(none)")
        counts.setdefault(layer, {})
        et = ent.dxftype()
        counts[layer][et] = counts[layer].get(et, 0) + 1

    out: list[LayerInfo] = []
    for name, by_type in counts.items():
        meta = layers_meta.get(name)
        color = None
        if meta is not None:
            try:
                color = int(meta.dxf.color)
            except Exception:
                color = None
        out.append(LayerInfo(
            name=name,
            color=color,
            entity_count_by_type=dict(by_type),
            total_entities=sum(by_type.values()),
        ))
    out.sort(key=lambda li: -li.total_entities)
    return out


# ---------------------------------------------------------------------------
# Room extraction
# ---------------------------------------------------------------------------


def _extract_rooms(msp, warnings: list[str]) -> tuple[list[RoomGeometry], list[GeometryInfo]]:
    """Match TEXT room codes (A-AREA-IDEN) to closed polygons (A-AREA-BNDY-OTLN)."""
    code_entities = []
    for ent in msp.query("TEXT MTEXT"):
        if ent.dxf.layer != LAYER_ROOM_CODES:
            continue
        raw = (ent.dxf.text if ent.dxftype() == "TEXT" else ent.text).strip()
        if not ROOM_CODE_RE.match(raw):
            continue
        ip = ent.dxf.insert
        code_entities.append((raw, float(ip.x), float(ip.y), ent.dxf.layer))

    polygons: list[tuple[Polygon, str]] = []
    for ent in msp.query("LWPOLYLINE POLYLINE"):
        if ent.dxf.layer != LAYER_ROOM_POLYGONS:
            continue
        try:
            pts = list(ent.get_points("xy"))
        except Exception:
            try:
                pts = [(p[0], p[1]) for p in ent.points()]
            except Exception:
                continue
        if len(pts) < 3:
            continue
        if not _is_closed(ent):
            continue
        try:
            polygons.append((Polygon([(p[0], p[1]) for p in pts]), ent.dxf.layer))
        except Exception as e:
            warnings.append(f"Failed to build polygon on {ent.dxf.layer}: {e}")

    rooms: list[RoomGeometry] = []
    matched_indices: set[int] = set()
    for code, cx, cy, code_layer in code_entities:
        pt = Point(cx, cy)
        winner_idx = None
        winner_area = None
        for i, (poly, layer) in enumerate(polygons):
            try:
                if poly.contains(pt):
                    if winner_area is None or poly.area < winner_area:
                        winner_idx = i
                        winner_area = poly.area
            except Exception:
                continue
        objekt, podlazi, byt, mist = _split_room_code(code)
        if winner_idx is None:
            warnings.append(f"Room code {code!r} has no enclosing polygon — area unknown")
            rooms.append(RoomGeometry(
                code=code, objekt=objekt, podlazi=podlazi,
                byt_or_section=byt, mistnost_num=mist,
                area_m2=None, perimeter_m=None, polygon_wkt=None,
                code_position=(cx, cy),
                raw_layer_codes=code_layer, raw_layer_polygon=None,
            ))
            continue
        poly, poly_layer = polygons[winner_idx]
        matched_indices.add(winner_idx)
        rooms.append(RoomGeometry(
            code=code, objekt=objekt, podlazi=podlazi,
            byt_or_section=byt, mistnost_num=mist,
            area_m2=poly.area / 1_000_000.0,
            perimeter_m=poly.length / 1000.0,
            polygon_wkt=poly.wkt,
            code_position=(cx, cy),
            raw_layer_codes=code_layer, raw_layer_polygon=poly_layer,
        ))

    unmatched: list[GeometryInfo] = []
    for i, (poly, layer) in enumerate(polygons):
        if i in matched_indices:
            continue
        try:
            c = poly.centroid
            unmatched.append(GeometryInfo(
                centroid=(c.x, c.y),
                area_m2=poly.area / 1_000_000.0,
                perimeter_m=poly.length / 1000.0,
                layer=layer,
            ))
        except Exception:
            continue
    if unmatched:
        warnings.append(
            f"{len(unmatched)} polygon(s) on {LAYER_ROOM_POLYGONS} have no matching room code "
            f"(probably objekt outline or unlabeled space)"
        )
    return rooms, unmatched


def _is_closed(ent) -> bool:
    if hasattr(ent, "is_closed"):
        try:
            return bool(ent.is_closed)
        except Exception:
            pass
    flags = getattr(ent.dxf, "flags", 0)
    return bool(flags & 1)


def _split_room_code(code: str) -> tuple[str, str, str, str]:
    """`D.1.4.02` → ('D', '1.NP', '4', '02'). Podlaží mapping: 0→1.PP, 1→1.NP, 2→2.NP, 3→3.NP."""
    parts = code.split(".")
    objekt = parts[0]
    raw_floor = parts[1] if len(parts) > 1 else ""
    floor_map = {"0": "1.PP", "1": "1.NP", "2": "2.NP", "3": "3.NP"}
    podlazi = floor_map.get(raw_floor, raw_floor)
    byt = parts[2] if len(parts) > 2 else ""
    mist = parts[3] if len(parts) > 3 else ""
    return objekt, podlazi, byt, mist


# ---------------------------------------------------------------------------
# Opening extraction
# ---------------------------------------------------------------------------


def _extract_openings_doors(msp, warnings: list[str]) -> list[Opening]:
    geom = [e for e in msp.query("INSERT") if e.dxf.layer == LAYER_DOORS_OTLN]
    # Single-token D## TEXTs on IDEN layer
    iden_codes: list[tuple[str, float, float]] = []
    for t in msp.query("TEXT MTEXT"):
        if t.dxf.layer != LAYER_DOORS_IDEN:
            continue
        raw = (t.dxf.text if t.dxftype() == "TEXT" else t.text).strip()
        if re.match(r"^D\d{2,3}$", raw):
            iden_codes.append((raw, float(t.dxf.insert.x), float(t.dxf.insert.y)))

    out: list[Opening] = []
    for ins in geom:
        ip = ins.dxf.insert
        match = _spatial_match(
            (float(ip.x), float(ip.y)), iden_codes, DEFAULT_DOOR_TAG_RADIUS_MM
        )
        w, h, d = _parse_block_name_dimensions(ins.dxf.name)
        warns: list[str] = []
        type_code = None
        match_dist = None
        if match is not None:
            type_code, match_dist = match
        else:
            warns.append(f"No D## tag within {DEFAULT_DOOR_TAG_RADIUS_MM} mm of door insert")
        out.append(Opening(
            otvor_type="door",
            type_code=type_code,
            block_name=ins.dxf.name,
            position=(float(ip.x), float(ip.y)),
            width_mm=w, height_mm=h, depth_mm=d,
            source_layer=LAYER_DOORS_OTLN,
            tag_match_distance_mm=match_dist,
            warnings=warns,
        ))
    if geom and any(o.type_code is None for o in out if o.source_layer == LAYER_DOORS_OTLN):
        n = sum(1 for o in out if o.source_layer == LAYER_DOORS_OTLN and o.type_code is None)
        warnings.append(f"{n}/{len(geom)} door(s) without type code")
    return out


def _extract_openings_windows(msp, warnings: list[str]) -> list[Opening]:
    geom = [e for e in msp.query("INSERT") if e.dxf.layer == LAYER_WINDOWS_OTLN]
    # Reconstruct W## codes from split TEXTs on A-GLAZ-IDEN
    prefixes: list[tuple[str, float, float]] = []
    digits: list[tuple[str, float, float]] = []
    for t in msp.query("TEXT MTEXT"):
        if t.dxf.layer != LAYER_WINDOWS_IDEN:
            continue
        raw = (t.dxf.text if t.dxftype() == "TEXT" else t.text).strip()
        ip = t.dxf.insert
        if PREFIX_ONLY_RE.match(raw):
            prefixes.append((raw, float(ip.x), float(ip.y)))
        elif DIGITS_ONLY_RE.match(raw):
            digits.append((raw, float(ip.x), float(ip.y)))
    reconstructed = _join_split_tags(prefixes, digits)
    iden_codes = [(c, x, y) for (c, x, y) in reconstructed if c.startswith("W")]

    out: list[Opening] = []
    for ins in geom:
        ip = ins.dxf.insert
        match = _spatial_match(
            (float(ip.x), float(ip.y)), iden_codes, DEFAULT_WINDOW_TAG_RADIUS_MM
        )
        w, h, d = _parse_block_name_dimensions(ins.dxf.name)
        warns: list[str] = []
        type_code = None
        match_dist = None
        if match is not None:
            type_code, match_dist = match
        else:
            warns.append(
                f"No W## tag within {DEFAULT_WINDOW_TAG_RADIUS_MM} mm of window insert"
            )
        out.append(Opening(
            otvor_type="window",
            type_code=type_code,
            block_name=ins.dxf.name,
            position=(float(ip.x), float(ip.y)),
            width_mm=w, height_mm=h, depth_mm=d,
            source_layer=LAYER_WINDOWS_OTLN,
            tag_match_distance_mm=match_dist,
            warnings=warns,
        ))
    if geom and any(o.type_code is None for o in out if o.source_layer == LAYER_WINDOWS_OTLN):
        n = sum(1 for o in out if o.source_layer == LAYER_WINDOWS_OTLN and o.type_code is None)
        warnings.append(f"{n}/{len(geom)} window(s) without type code")
    return out


def _extract_openings_curtain(msp, warnings: list[str]) -> list[Opening]:
    out: list[Opening] = []
    for ins in msp.query("INSERT"):
        if ins.dxf.layer != LAYER_CURTAIN:
            continue
        ip = ins.dxf.insert
        w, h, d = _parse_block_name_dimensions(ins.dxf.name)
        out.append(Opening(
            otvor_type="curtain_wall",
            type_code=None,
            block_name=ins.dxf.name,
            position=(float(ip.x), float(ip.y)),
            width_mm=w, height_mm=h, depth_mm=d,
            source_layer=LAYER_CURTAIN,
            tag_match_distance_mm=None,
            warnings=[],
        ))
    return out


# ---------------------------------------------------------------------------
# Segment tag extraction
# ---------------------------------------------------------------------------


def _extract_segment_tags(msp, warnings: list[str]) -> list[SegmentTag]:
    """Collect TEXT entities matching skladba/product codes on *_IDEN layers."""
    by_layer: dict[str, list[tuple[str, float, float]]] = {}
    for t in msp.query("TEXT MTEXT"):
        layer = t.dxf.layer
        if layer not in SEGMENT_TAG_LAYERS:
            continue
        raw = (t.dxf.text if t.dxftype() == "TEXT" else t.text).strip()
        if not raw:
            continue
        by_layer.setdefault(layer, []).append((raw, float(t.dxf.insert.x), float(t.dxf.insert.y)))

    out: list[SegmentTag] = []
    f_count_by_layer: dict[str, int] = {}

    for layer, items in by_layer.items():
        single_codes: list[tuple[str, str, float, float]] = []
        prefixes: list[tuple[str, float, float]] = []
        digits: list[tuple[str, float, float]] = []
        for raw, x, y in items:
            m = SINGLE_TAG_RE.match(raw)
            if m:
                single_codes.append((raw, m.group(1), x, y))
                continue
            m = PREFIX_ONLY_RE.match(raw)
            if m:
                prefixes.append((raw, x, y))
                continue
            m = DIGITS_ONLY_RE.match(raw)
            if m:
                digits.append((raw, x, y))
        for code, prefix, x, y in single_codes:
            if prefix in ("D", "W"):
                # Door/window codes already handled by opening extractors;
                # skip in segment-tag stream to avoid duplication.
                continue
            cat = PREFIX_CATEGORY.get(prefix, "unknown")
            out.append(SegmentTag(
                code=code, prefix=prefix, position=(x, y),
                source_layer=layer, category=cat, extraction="single_text",
            ))
            if prefix == "F":
                f_count_by_layer[layer] = f_count_by_layer.get(layer, 0) + 1
        for code, x, y in _join_split_tags(prefixes, digits):
            m = SINGLE_TAG_RE.match(code)
            if not m:
                continue
            prefix = m.group(1)
            if prefix in ("D", "W"):
                # Window W## reconstruction is handled by _extract_openings_windows.
                continue
            cat = PREFIX_CATEGORY.get(prefix, "unknown")
            out.append(SegmentTag(
                code=code, prefix=prefix, position=(x, y),
                source_layer=layer, category=cat, extraction="split_join",
            ))
            if prefix == "F":
                f_count_by_layer[layer] = f_count_by_layer.get(layer, 0) + 1

    for layer, n in f_count_by_layer.items():
        warnings.append(
            f"{n} F## tag(s) on {layer} — F08 may be facade Terca, F0x may be floor; "
            f"verify against Tabulka skladeb in Phase 3"
        )
    return out


# ---------------------------------------------------------------------------
# Spatial helpers
# ---------------------------------------------------------------------------


def _join_split_tags(
    prefixes: list[tuple[str, float, float]],
    digits: list[tuple[str, float, float]],
    dy_max: float = DEFAULT_TAG_RECONSTRUCTION_DY_MM,
    dx_max: float = DEFAULT_TAG_RECONSTRUCTION_DX_MM,
) -> list[tuple[str, float, float]]:
    """Pair each prefix TEXT with the closest digit TEXT below it."""
    out: list[tuple[str, float, float]] = []
    used: set[int] = set()
    for ptext, px, py in prefixes:
        best = None
        best_d: Optional[float] = None
        for i, (dtext, dx_, dy_) in enumerate(digits):
            if i in used:
                continue
            dx = abs(dx_ - px)
            dy = py - dy_  # prefix is ABOVE digits → expect dy > 0
            if 0 < dy <= dy_max and dx <= dx_max:
                d = dx + dy
                if best is None or d < best_d:
                    best = (i, dtext, dx_, dy_)
                    best_d = d
        if best is not None:
            i, dtext, _, _ = best
            used.add(i)
            out.append((f"{ptext}{dtext}", px, py))
    return out


def _spatial_match(
    insert_pos: tuple[float, float],
    tag_positions: list[tuple[str, float, float]],
    max_radius_mm: float,
) -> Optional[tuple[str, int]]:
    """Return (code, distance_mm) for the closest tag within max_radius_mm."""
    if not tag_positions:
        return None
    ix, iy = insert_pos
    best = None
    best_d: Optional[float] = None
    for code, tx, ty in tag_positions:
        d = ((ix - tx) ** 2 + (iy - ty) ** 2) ** 0.5
        if d > max_radius_mm:
            continue
        if best is None or d < best_d:
            best = code
            best_d = d
    if best is None:
        return None
    return best, int(round(best_d))


def _parse_block_name_dimensions(
    block_name: str,
) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """Extract WxH or WxHxD from a block name (e.g. 'In_BJ_900x2100', '50x70mm')."""
    m = DIMENSIONS_RE.search(block_name)
    if not m:
        return None, None, None
    w = int(m.group(1))
    h = int(m.group(2))
    d = int(m.group(3)) if m.group(3) else None
    return w, h, d
