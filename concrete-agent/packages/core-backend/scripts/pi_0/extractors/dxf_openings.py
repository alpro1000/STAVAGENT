"""Block-name parsing for DXF opening (door/window/curtain-wall) blocks.

Step 2 of Π.0a (TASK_PHASE_PI_0_SPEC.md §5 step 2). Absorbs the
ArchiCAD-block-name attributes that the existing pipeline drops:
frame_type, swing_type, install_context, subtype, cad_lib_id.

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
from typing import Any

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
