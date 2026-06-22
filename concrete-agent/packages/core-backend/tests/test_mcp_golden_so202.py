"""
MCP Golden Test: SO-202 D6 Karlovy Vary Bridge

Validates the MCP calculator tool against real bridge TZ data (SO-202).
Golden test data from: test-data/tz/SO-202_D6_most_golden_test.md

Phase 2a (TASK_FIX_SSOT_MCP_Delegate): `calculate_concrete_works` now DELEGATES
to the canonical TS engine (POST /api/calculate) and returns its PlannerOutput
verbatim. These golden rules therefore read PlannerOutput fields (formwork.
curing_days, prestress.days, bridge_technology.technology, the pile block, …)
instead of the retired flat simplified shape. The domain expectations are
UNCHANGED and the canonical engine satisfies all of them. The `calculate_replay`
fixture (tests/conftest.py) serves recorded live-engine output offline.

9 validation rules from Section 5+7 of the golden test:
1. Bridge deck NK curing ≥ 9 days (curing_class=4, 15°C)        → formwork.curing_days
2. Rimsa curing ≥ 9 days (curing_class=4, 15°C)                 → formwork.curing_days
3. Substructure curing ≥ 4 days (curing_class=3, 15°C)          → formwork.curing_days
4. XF4 exposure enforces ≥ 7 days curing floor                  → formwork.curing_days
5. Pilota has no formwork card (pažnice instead)                → pile block, no lateral_pressure
6. Bridge piles Ø900 rebar ≥ 80 kg/m³                           → rebar.mass_kg / volume
7. Prestressed NK adds ≥ 11 days to schedule                    → prestress.days
8. Bridge deck per TZ §7.2 = fixed scaffolding (explicit)       → bridge_technology.technology
9. Classifier detects bridge context from SO-202               → W3 classifier (unchanged)
"""

import asyncio
import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mcp_server():
    from app.mcp.server import mcp
    return mcp


# ── Golden Rule 1: NK curing_class=4 @ 15°C → ≥ 9 days ────────────────────

@pytest.mark.asyncio
async def test_golden_nk_curing_class_4(mcp_server, calculate_replay):
    """SO-202 §7.8.3: Bridge deck NK must have curing ≥ 9 days (class 4 @ 15°C)."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "mostovkova_deska",
            "volume_m3": 605,
            "concrete_class": "C35/45",
            "exposure_class": "XF2",
            "curing_class": 4,
            "temperature_c": 15.0,
            "is_prestressed": True,
            "nk_subtype": "dvoutramovy",
            "span_m": 20,
            "num_spans": 6,
        },
    )
    data = result.structured_content
    assert "error" not in data, f"Calculator error: {data.get('error')}"
    assert data.get("source") == "monolit_planner_api"

    assert data["formwork"]["curing_days"] >= 9, (
        f"NK curing_class=4 @ 15°C must be ≥ 9 days per TKP §7.8.3. "
        f"Got: {data['formwork']['curing_days']} days."
    )


# ── Golden Rule 2: Rimsa curing_class=4 @ 15°C → ≥ 9 days ─────────────────

@pytest.mark.asyncio
async def test_golden_rimsa_curing_class_4(mcp_server, calculate_replay):
    """SO-202: Bridge parapets must have curing ≥ 9 days (auto class 4 @ 15°C)."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "rimsa",
            "volume_m3": 30,
            "concrete_class": "C30/37",
            "exposure_class": "XF4",
            "temperature_c": 15.0,
        },
    )
    data = result.structured_content
    assert "error" not in data
    assert data["formwork"]["curing_days"] >= 9, (
        f"Rimsa curing @ 15°C class 4 must be ≥ 9 days. Got: {data['formwork']['curing_days']}"
    )


# ── Golden Rule 3: Substructure curing_class=3 @ 15°C → ≥ 4 days ──────────

@pytest.mark.asyncio
async def test_golden_substructure_curing_class_3(mcp_server, calculate_replay):
    """SO-202: Pier shaft (substructure) curing_class=3 @ 15°C → ≥ 4 days."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "driky_piliru",
            "volume_m3": 20,
            "concrete_class": "C35/45",
            "exposure_class": "XF4",
            "height_m": 6.0,
            "temperature_c": 15.0,
        },
    )
    data = result.structured_content
    assert "error" not in data
    assert data["formwork"]["curing_days"] >= 4, (
        f"Substructure curing class 3 @ 15°C must be ≥ 4 days. "
        f"Got: {data['formwork']['curing_days']}"
    )


# ── Golden Rule 4: XF4 exposure enforces ≥ 7 days floor ────────────────────

@pytest.mark.asyncio
async def test_golden_xf4_minimum_7_days(mcp_server, calculate_replay):
    """TKP §7.8.3: XF4 exposure always minimum 7 days curing, even at 25°C."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "opery_ulozne_prahy",
            "volume_m3": 55,
            "concrete_class": "C30/37",
            "exposure_class": "XF4",
            "height_m": 5.0,
            "temperature_c": 25.0,  # Even at warm temperature
        },
    )
    data = result.structured_content
    assert "error" not in data
    assert data["formwork"]["curing_days"] >= 7, (
        f"XF4 exposure minimum curing = 7 days per TKP §7.8.3, even at 25°C. "
        f"Got: {data['formwork']['curing_days']} days."
    )


# ── Golden Rule 5: Pilota → no formwork (pažnice / pile engine) ─────────────

@pytest.mark.asyncio
async def test_golden_pilota_no_formwork(mcp_server, calculate_replay):
    """SO-202: Piles run the pile engine (drilling + armokoš), not the formwork /
    lateral-pressure path."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "pilota",
            "volume_m3": 50.9,
            "concrete_class": "C30/37",
            "exposure_class": "XA2",
            "pile_diameter_mm": 900,
            "pile_count": 10,
            "pile_geology": "below_gwt",
        },
    )
    data = result.structured_content
    assert "error" not in data
    assert "pile" in data, "Pilota must run the pile engine (plan.pile block)"
    # Piles have no boční tlak — the lateral-pressure path is bypassed entirely.
    assert "lateral_pressure" not in data, (
        "Pilota should have no lateral_pressure (soil is the form, no formwork)"
    )


# ── Golden Rule 6: Bridge piles Ø900 → rebar ≥ 80 kg/m³ ───────────────────

@pytest.mark.asyncio
async def test_golden_pile_rebar_bridge(mcp_server, calculate_replay):
    """SO-202 bug #13: Bridge pile Ø900 rebar should be ≥ 80 kg/m³, not 40."""
    volume = 50.9
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "pilota",
            "volume_m3": volume,
            "concrete_class": "C30/37",
            "pile_diameter_mm": 900,
        },
    )
    data = result.structured_content
    assert "error" not in data
    ratio = data["rebar"]["mass_kg"] / volume
    assert ratio >= 80, (
        f"Bridge pile Ø900 rebar should be ≥ 80 kg/m³. "
        f"Got: {ratio:.0f} kg/m³ ({data['rebar']['mass_kg']} kg / {volume} m³). "
        f"Was bug #13 (default 40 → 50% underestimate)."
    )


# ── Golden Rule 7: Prestressed NK adds ≥ 11 days ───────────────────────────

@pytest.mark.asyncio
async def test_golden_prestress_schedule(mcp_server, calculate_replay):
    """SO-202: Prestressed NK adds ≥ 11 days (wait + stressing + grouting)."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "mostovkova_deska",
            "volume_m3": 605,
            "concrete_class": "C35/45",
            "is_prestressed": True,
            "span_m": 20,
            "num_spans": 6,
        },
    )
    data = result.structured_content
    assert "error" not in data
    assert (data.get("prestress") or {}).get("days", 0) >= 11, (
        f"Prestressed NK should add ≥ 11 days. "
        f"Got: {(data.get('prestress') or {}).get('days')} days."
    )


# ── Golden Rule 8: TZ §7.2 fixed scaffolding (explicit technology) ──────────

@pytest.mark.asyncio
async def test_golden_fixed_scaffolding_recommendation(mcp_server, calculate_replay):
    """SO-202 §7.2 specifies fixed scaffolding (pevná skruž). With that explicit
    construction_technology, the engine honors it.

    NOTE: without the override the engine auto-recommends MSS for 6 × 20 m spans
    (≥4 spans → posuvná skruž is usually more economical) — a deliberate engine
    recommendation that differs from this project's TZ choice. The TZ choice is
    expressed by passing construction_technology explicitly."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "mostovkova_deska",
            "volume_m3": 605,
            "concrete_class": "C35/45",
            "span_m": 20,
            "num_spans": 6,
            "construction_technology": "fixed_scaffolding",
        },
    )
    data = result.structured_content
    assert "error" not in data
    tech = data.get("bridge_technology", {})
    assert isinstance(tech, dict) and tech.get("technology") == "fixed_scaffolding", (
        f"Explicit construction_technology=fixed_scaffolding must be honored. Got: {tech!r}"
    )


# ── Golden Rule 9: Classifier detects bridge context from SO-202 ───────────

@pytest.mark.asyncio
async def test_golden_classifier_bridge_context(mcp_server):
    """SO-202: Classifier must detect bridge context from SO-202 code.

    Classification stays the W3 Python classifier in Phase 2a (no delegation),
    so this rule is unchanged."""
    result = await mcp_server.call_tool(
        "classify_construction_element",
        {"name": "Pilíře P2-P3, C35/45", "object_code": "SO-202"},
    )
    data = result.structured_content
    assert data.get("is_bridge_context") is True, (
        "SO-202 should trigger bridge context detection"
    )
    assert data["element_type"] == "driky_piliru", (
        f"'Pilíře P2-P3' with SO-202 context should be driky_piliru. "
        f"Got: {data['element_type']}"
    )
