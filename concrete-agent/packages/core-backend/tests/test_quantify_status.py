"""Stage-3 Quantify — quantity provenance on decomposer output.

Ordered fixes ratified after the SO-250 live reality-check (Alexander,
2026-07-14 — the first end-to-end Stage-1 run):

  1. Input beats default: a caller-provided quantity (rebar_tons, area_m2,
     height_m, volume_m3) MUST win over the element-type template default.
     The default is only a fallback and must be labeled `assumed`.
  2. `quantity_status` in the output (SPEC document-to-worklist §6.3:
     from_soupis | computed | assumed | NEPOČÍTÁNO(reason); tool-level
     refinement `from_input` = verbatim caller value — the upstream soupis
     joiner may upgrade it to from_soupis). An estimated 79.3 t must SCREAM
     assumed, not look like a fact next to the fixture's real 95.16 t.
  3. Blinding formwork bug: podkladni_beton side formwork = perimeter ×
     thickness (tens of m²), not volume/0.25 (which said 1 004 m² for a
     150 mm slab — an order of magnitude off).

Runs WITHOUT fastmcp — mirrors test_uwo_atomizer_t1.py (sync asyncio.run).
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.breakdown import create_work_breakdown  # noqa: E402


def _run(elements, **kw):
    return asyncio.run(create_work_breakdown(elements=elements, **kw))


def _item(result, substr):
    matches = [i for i in result["items"] if substr in i["work_description"]]
    assert matches, f"no item matching {substr!r}: " + "; ".join(
        i["work_description"] for i in result["items"]
    )
    return matches[0]


# ── Fix 1: input beats default ────────────────────────────────────────────────

def test_provided_rebar_tons_beats_template_default():
    """SO-250 základ: fixture says 95.16 t (120 kg/m³ per REBAR_NORMS_AUDIT);
    the type default (100 kg/m³ → 79.3 t) must NOT override it."""
    r = _run([{
        "name": "Základ zárubní zdi", "volume_m3": 793,
        "concrete_class": "C25/30", "rebar_tons": 95.16,
    }])
    vyztuz = _item(r, "Výztuž")
    assert vyztuz["quantity"] == 95.16
    assert vyztuz["quantity_status"] == "from_input"


def test_absent_rebar_falls_back_to_assumed_with_formula():
    r = _run([{"name": "Základ zárubní zdi", "volume_m3": 793,
               "concrete_class": "C25/30"}])
    vyztuz = _item(r, "Výztuž")
    assert vyztuz["quantity_status"] == "assumed"
    assert "typový default" in vyztuz["quantity_formula"]
    assert "kg/m³" in vyztuz["quantity_formula"]


def test_provided_area_m2_beats_formwork_estimate():
    r = _run([{"name": "Dřík zárubní zdi", "volume_m3": 597,
               "concrete_class": "C30/37", "area_m2": 3600.0}])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] == 3600.0
    assert bedneni["quantity_status"] == "from_input"


# ── Fix 2: quantity_status totality — every emitted item carries it ──────────

def test_every_monolit_item_carries_status_and_formula():
    r = _run([
        {"name": "Dřík zárubní zdi", "volume_m3": 597, "concrete_class": "C30/37"},
        {"name": "NK mostovka", "volume_m3": 605, "concrete_class": "C35/45",
         "is_prestressed": True},
    ])
    assert r["items"]
    for it in r["items"]:
        assert it.get("quantity_status"), it["work_description"]
        assert it.get("quantity_formula"), it["work_description"]


def test_every_interier_item_carries_status():
    r = _run([{"name": "Malba stěn obývacího pokoje", "area_m2": 120.0}],
             project_type="budova", catalog="none")
    psv = [i for i in r["items"] if i.get("section_code") == "interier_psv"]
    assert psv
    for it in psv:
        assert it.get("quantity_status"), it["work_description"]


def test_interier_missing_vymera_is_explicit_nepocitano():
    """§6.4.2 — honest blank is an explicit NEPOČÍTÁNO with a reason,
    not a silent None."""
    r = _run([{"name": "Malba stěn obývacího pokoje"}], project_type="budova",
             catalog="none")
    m2_items = [i for i in r["items"]
                if i.get("section_code") == "interier_psv" and i["unit"] == "m2"]
    assert m2_items
    for it in m2_items:
        assert it["quantity"] is None
        assert it["quantity_status"].startswith("NEPOČÍTÁNO"), it["quantity_status"]


def test_prestress_from_provided_rebar_is_computed():
    r = _run([{"name": "NK mostovka", "volume_m3": 605, "concrete_class": "C35/45",
               "is_prestressed": True, "rebar_tons": 90.0}])
    prestress = _item(r, "Předpínací")
    assert prestress["quantity_status"] == "computed"
    assert prestress["quantity"] == 27.0  # 90 × 0.3, deterministic over input


# ── Fix 3: blinding formwork = perimeter × thickness, not volume/0.25 ────────

def test_blinding_formwork_is_tens_of_m2_and_assumed():
    """SO-250 podkladní beton 251.16 m³ @ 150 mm: volume/0.25 said 1 004 m²;
    perimeter × thickness (square-footprint estimate) is tens of m²."""
    r = _run([{"name": "Podkladní beton", "volume_m3": 251.16,
               "concrete_class": "C12/15"}])
    bedneni = _item(r, "Bednění")
    assert bedneni["quantity"] < 120, bedneni["quantity"]
    assert bedneni["quantity_status"] == "assumed"
    assert "obvod" in bedneni["quantity_formula"]
    # the concrete row itself is a caller fact
    beton = _item(r, "Beton")
    assert beton["quantity"] == 251.16
    assert beton["quantity_status"] == "from_input"


def test_blinding_thickness_from_height_input_when_plausible():
    """height_m ≤ 0.5 on podkladni_beton is the slab thickness → used in the
    perimeter formula instead of the 0.15 default."""
    r = _run([{"name": "Podkladní beton", "volume_m3": 100,
               "concrete_class": "C12/15", "height_m": 0.2}])
    bedneni = _item(r, "Bednění")
    # 4 × sqrt(100/0.2) × 0.2 = 17.89
    assert abs(bedneni["quantity"] - 17.89) < 0.05
    assert "0.2" in bedneni["quantity_formula"]
