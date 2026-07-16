"""Formwork-geometry DIVERGENCE pin — breakdown (Python) vs the TS engine.

Sibling of pin B (test_volume_geometry_parity.py), but with the OPPOSITE
contract: pin B asserts EQUALITY of a deliberate Python mirror; this suite pins
DOCUMENTED DIVERGENCE. Recon 2026-07-15 established that `create_work_breakdown`
built a THIRD system of geometry heuristics without seeing either TS source:

  * `element-geometry.ts`            — dims → volume/formwork (BACKLOG canon)
  * `estimateFormworkArea`
    (`planner-orchestrator.ts`)      — volume → formwork heuristics (the
                                       functional twin of the Python code)

and diverged from BOTH wherever they overlap, plus invented its own thickness
constants. Verdicts (Alexander, 2026-07-15): rows 1–4 — TS is right; blinding
(row 5) — domain verdict: the DEFAULT is the TS zero (blinding pours against
excavation walls; strip-edge formwork is the rare exception, to become an
explicit opt-in flag — ticket `blinding-formwork-flag`); rows 6–7 have NO TS
counterpart at all (one-sided axes).

CONTRACT OF THIS SUITE: green CI means "the divergence is exactly as mapped".
If EITHER side changes — someone aligns Python, tweaks a TS heuristic, or adds
a TS counterpart for a one-sided axis — a test here goes RED and forces the
change through the alignment review instead of silently birthing a FOURTH
system. Alignment itself is a SEPARATE branch (verdict table in
docs/soul.md §9 2026-07-15); do NOT "fix" these formulas to make this suite
pass — update the pins only together with a reviewed alignment.

Cross-ref markers (no code pin here, tracked in BACKLOG):
  * row 8  — rebar-defaults drift (W3 ELEMENT_TYPES vs TS v4.18 values) →
    ticket `rebar-defaults-parity` (P1, classifier axis, not geometry)
  * row 11 — the box rule 2(L+W)·H is STRUCTURALLY inapplicable on the MCP
    surface: `BreakdownElement` carries no `width_m` → ticket
    `breakdown-element-width_m-contract` (see the contract-ceiling test below)
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import create_work_breakdown  # noqa: E402

_REPO = Path(__file__).resolve().parents[4]
_CORE_APP = Path(__file__).resolve().parents[1] / "app"
_TS_ELEMENT_GEOMETRY = _REPO / "Monolit-Planner/shared/src/calculators/element-geometry.ts"
_TS_ORCHESTRATOR = _REPO / "Monolit-Planner/shared/src/calculators/planner-orchestrator.ts"
_TS_CLASSIFIER = _REPO / "Monolit-Planner/shared/src/classifiers/element-classifier.ts"
_TS_SHARED_SRC = _REPO / "Monolit-Planner/shared/src"
_PY_BREAKDOWN = _CORE_APP / "mcp" / "tools" / "breakdown.py"


def _read(p: Path) -> str:
    assert p.exists(), (
        f"source-of-truth not found at {p} — the divergence pin cannot run. "
        "If the file moved, update this path AND re-verify the pins."
    )
    return p.read_text(encoding="utf-8")


def _run(elements, **kw):
    return asyncio.run(create_work_breakdown(elements=elements, **kw))


def _item(result, substr):
    matches = [i for i in result["items"] if substr in i["work_description"]]
    assert matches, f"no item matching {substr!r}: " + "; ".join(
        i["work_description"] for i in result["items"]
    )
    return matches[0]


# ── Class 1: rows 1–4 — divergence pinned on BOTH sides ─────────────────────

def test_row1_vertical_two_faces_vs_ts_four_faces():
    """Row 1: vertical element with L+H. Python = 2·L·H (TWO faces, end faces
    ignored); TS = 2(L+W)·H (FOUR faces) in BOTH sources. Verdict: TS right."""
    # Python behavioral pin: stěna V=12, L=10, H=4 → 2·10·4 = 80 m².
    r = _run([{
        "name": "Stěna", "element_type": "stena", "volume_m3": 12,
        "length_m": 10, "height_m": 4, "concrete_class": "C30/37",
    }])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] == 80.0
    assert bedneni["quantity_status"] == "computed"
    # TS line-of-cells would derive W = V/(L·H) = 0.3 → 2(10+0.3)·4 = 82.4.
    assert bedneni["quantity"] != 82.4  # the divergence this pin documents
    # TS source pins (both TS sources carry the four-face rule):
    assert "2 * (L + W) * H" in _read(_TS_ELEMENT_GEOMETRY)
    assert "const area = 2 * (L + W) * height_m;" in _read(_TS_ORCHESTRATOR)
    # Python source pin (two faces):
    assert "fw_area = 2 * length_m * height" in _read(_PY_BREAKDOWN)


def test_row2_vertical_no_length_width_guess_vs_ts_aspect_ratio():
    """Row 2: vertical, no length. Python guesses width 0.3 m → V/0.3×2;
    TS derives footprint=V/H and applies aspect 3:1 (validated on real piers)
    → perimeter×H, min 5 m². Different models entirely. Verdict: TS right."""
    r = _run([{
        "name": "Stěna", "element_type": "stena", "volume_m3": 12,
        "height_m": 4, "concrete_class": "C30/37",
    }])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] == 80.0  # 12/0.3 × 2
    # TS model on the same inputs: footprint=3 → W=1, L=3 → 2(3+1)·4 = 32 m².
    assert bedneni["quantity"] != 32.0
    src = _read(_TS_ORCHESTRATOR)
    assert "const aspectRatio = 3" in src
    py = _read(_PY_BREAKDOWN)
    assert "width = 0.3" in py and "fw_area = volume / width * 2" in py


def test_row3_horizontal_soffit_thickness_025_vs_ts_05():
    """Row 3: horizontal slab. Python soffit = V/0.25; TS plan area = V/0.5
    (no length) / V/0.6 (with length) → Python DOUBLES the area. Verdict: TS
    right (0.25 m is unrealistically thin as a slab/deck default)."""
    r = _run([{
        "name": "Základová deska", "element_type": "zakladova_deska",
        "volume_m3": 100, "concrete_class": "C30/37",
    }])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] == 400.0  # 100 / 0.25
    assert bedneni["quantity"] != 200.0  # TS: 100 / 0.5
    src = _read(_TS_ORCHESTRATOR)
    assert "const avgThickness = 0.6" in src  # with length (decks)
    assert "const avgThickness = 0.5" in src  # without length (slabs)
    assert "fw_area = volume / 0.25" in _read(_PY_BREAKDOWN)


def test_row4_foundation_blocks_wall_model_vs_ts_perimeter_special_case():
    """Row 4: foundation blocks. LIVE PIN CORRECTION to the recon table
    (2026-07-15): the recon predicted the soffit branch, but W3 marks
    `zaklady` orientation=VERTICAL — the very axis TS flipped to horizontal
    in v4.17 C1 (zaklady_piliru) — so Python actually takes the wall-model
    branch with a guessed 0.3 m width: V/0.3×2. TS has an EXPLICIT special
    case — perimeter-only, aspect 1.5 (patka) / 10 (pás), «blocks are not
    thin slabs». Same inputs: Python 200 m² vs TS ≈27.4 m² (~7×). Verdict:
    TS right; the orientation drift itself is a W3 profile-constants issue →
    ticket `rebar-defaults-parity` (widened to profile constants: rebar +
    orientation, row 8)."""
    r = _run([{
        "name": "Základy", "element_type": "zaklady", "volume_m3": 30,
        "height_m": 1.5, "concrete_class": "C25/30",
    }])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] == 200.0  # 30/0.3 × 2 — wall model, guessed width
    # TS perimeter model on the same inputs: footprint=20, aspect 1.5 →
    # W=3.65, L=5.48 → 2(L+W)·1.5 ≈ 27.4 m². ~7× apart.
    assert bedneni["quantity"] > 4 * 27.4
    src = _read(_TS_ORCHESTRATOR)
    assert "aspectRatio = elementType === 'zakladovy_pas' ? 10 : 1.5" in src
    assert "isFoundationBlock" in src
    # The root: W3 profile says vertical where TS (post-v4.17-C1) says horizontal.
    import re

    classifier_src = (_CORE_APP / "mcp" / "tools" / "classifier.py").read_text(encoding="utf-8")
    zaklady_block = re.search(r'"zaklady":\s*\{(.*?)\}', classifier_src, re.S)
    assert zaklady_block and '"orientation": "vertical"' in zaklady_block.group(1)


def test_row5_blinding_python_emits_ts_zero():
    """Row 5: blinding (podkladní beton). Python ALWAYS emits strip-edge
    formwork (2·L·tl / square-perimeter fallback); TS: needs_formwork=false —
    no formwork at all. DOMAIN VERDICT (Alexander 2026-07-15): default is the
    TS zero (blinding pours against excavation walls); the rare bordered case
    becomes an explicit opt-in flag — ticket `blinding-formwork-flag`. This
    pin only FIXES the divergence; the flag is NOT this branch."""
    r = _run([{
        "name": "Podkladní beton", "element_type": "podkladni_beton",
        "volume_m3": 10, "length_m": 20, "height_m": 0.3,
        "concrete_class": "C12/15",
    }])
    bedneni = _item(r, "Bednění")
    # Python: thickness carrier 0.3 → 2 × 20 × 0.3 = 12 m² of strip edges.
    assert bedneni["quantity"] == 12.0
    # TS: podkladni_beton block declares needs_formwork: false.
    ts = _read(_TS_CLASSIFIER)
    assert "needs_formwork: false" in ts
    assert "fw_area = 2 * length_m * thickness" in _read(_PY_BREAKDOWN)


# ── Class 2: rows 6–7 — one-sided axes (no TS counterpart exists) ───────────

def _ts_shared_sources() -> str:
    chunks = []
    for p in _TS_SHARED_SRC.rglob("*.ts"):
        if p.name.endswith(".test.ts"):
            continue
        chunks.append(p.read_text(encoding="utf-8"))
    assert chunks, f"no TS sources under {_TS_SHARED_SRC}"
    return "\n".join(chunks)


def test_row6_curing_area_has_no_ts_counterpart():
    """Row 6: curing_area (m²) exists ONLY in Python breakdown — TS models
    curing as DAYS (maturity), never as a surface quantity. If a TS
    counterpart appears, this pin goes red: align, don't fork."""
    assert "curing_area" not in _ts_shared_sources()
    # Python numeric self-pin: horizontal → top footprint V/tl (default 0.25).
    r = _run([{
        "name": "Základová deska", "element_type": "zakladova_deska",
        "volume_m3": 100, "concrete_class": "C30/37",
    }])
    curing = _item(r, "Ošetřování")
    assert curing["quantity"] == 400.0  # 100 / 0.25
    assert "curing_area = volume / thickness" in _read(_PY_BREAKDOWN)


def test_row7_falsework_volume_has_no_ts_counterpart():
    """Row 7: skruž as obestavěný prostor (m³) exists ONLY in Python breakdown
    (finding #11, OTSKP canon). TS falsework is system selection + props —
    a different axis, no m³ quantity. KNOWN INTERNAL CONFLICT (alignment
    candidate, not this branch): the footprint uses flat thickness 0.25 while
    DECK_SUBTYPE_EQ_THICKNESS_M (already pin-B-mirrored in volume_geometry.py)
    says deskovy=0.5 — the default footprint is 2× too large."""
    ts = _ts_shared_sources()
    assert "falsework_volume" not in ts
    assert "obestavěný" not in ts and "obestaveny" not in ts
    r = _run([{
        "name": "Nosná konstrukce", "element_type": "mostovkova_deska",
        "volume_m3": 605, "height_m": 8, "concrete_class": "C35/45",
    }])
    skruz = _item(r, "Skruž")
    assert skruz["quantity"] == 19360.0  # (605 / 0.25) × 8
    assert skruz["unit"] == "m³"
    assert "qty = (volume / thickness) * height" in _read(_PY_BREAKDOWN)


# ── Class 3: row 9 — three divergent thickness-constant sets ────────────────

def test_row9_three_thickness_constant_sets_stay_as_mapped():
    """Row 9: THREE thickness-default sets live in three places:
      1. breakdown.py: 0.25 generic / 0.15 blinding
      2. planner-orchestrator.ts estimateFormworkArea: 0.5 slab / 0.6 deck
      3. DECK_SUBTYPE_EQ_THICKNESS_M: 0.25–1.0 per deck subtype
         (TS canonical, pin-B-mirrored in volume_geometry.py)
    This is the ROOT of rows 3 and 7. Pinned so a change to any set forces
    the alignment review."""
    assert "(0.15 if blinding else 0.25)" in _read(_PY_BREAKDOWN)
    src = _read(_TS_ORCHESTRATOR)
    assert "const avgThickness = 0.6" in src
    assert "const avgThickness = 0.5" in src
    from app.services.stage_gating.volume_geometry import DECK_SUBTYPE_EQ_THICKNESS_M
    assert DECK_SUBTYPE_EQ_THICKNESS_M["deskovy"] == 0.5
    # The sets genuinely differ — that IS the mapped divergence.
    assert 0.25 != DECK_SUBTYPE_EQ_THICKNESS_M["deskovy"]


# ── Row 11: structural ceiling — the MCP contract has no width_m ────────────

def test_row11_breakdown_element_contract_has_no_width():
    """Row 11: the box rule 2(L+W)·H CANNOT be applied on the MCP surface —
    `BreakdownElement` (app/mcp/routes.py) carries no `width_m`. Aligning
    rows 1–2 to TS therefore requires a CONTRACT change first — ticket
    `breakdown-element-width_m-contract`. If width_m appears, this pin goes
    red: revisit rows 1–2 alignment together with it, don't bolt it on."""
    from app.mcp.routes import BreakdownElement

    assert "width_m" not in BreakdownElement.model_fields
    assert "length_m" in BreakdownElement.model_fields  # the rest of the geometry trio
    assert "height_m" in BreakdownElement.model_fields
