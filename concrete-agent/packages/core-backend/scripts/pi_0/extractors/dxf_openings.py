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
    _EZDXF_AVAILABLE = True
except ImportError:
    _EZDXF_AVAILABLE = False

# DXF layers carrying opening INSERT entities (per dxf_full_inventory.md).
OPENING_LAYERS = {
    "A-DOOR-____-OTLN": "door",
    "A-GLAZ-____-OTLN": "window",
    "A-GLAZ-CURT-OTLN": "curtain_wall",
}

# ArchiCAD generates anonymous blocks with hex prefixes like `*U123` for
# block reference instances; the actual named block is the parent. Skip
# anonymous unless the block_name itself encodes attrs (rare).
_ANONYMOUS_BLOCK_RE = re.compile(r"^\*[UEAT]\d+$")

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
    annotation that requires spatial join). This helper exists for
    the rare cases where the type is in the block name itself.

    Step 5+ will replace this with proper *-IDEN spatial matching.
    """
    m = _LEADING_TYPE_CODE_RE.search(block_name or "")
    return f"{m.group(1)}{m.group(2)}" if m else None
