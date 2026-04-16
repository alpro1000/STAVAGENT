"""
MCP Golden Test: SO-202 D6 Karlovy Vary Bridge

Validates MCP calculator tool against real bridge TZ data (SO-202).
Golden test data from: test-data/tz/SO-202_D6_most_golden_test.md

9 validation rules from Section 5+7 of the golden test:
1. Bridge deck NK curing ≥ 9 days (curing_class=4, 15°C)
2. Rimsa curing ≥ 9 days (curing_class=4, 15°C)
3. Substructure curing ≥ 4 days (curing_class=3, 15°C)
4. XF4 exposure enforces ≥ 7 days curing floor
5. Pilota has no formwork card (pažnice instead)
6. Bridge piles Ø900 rebar ≥ 80 kg/m³
7. Prestressed NK adds ≥ 11 days to schedule
8. Bridge deck suggests fixed scaffolding for span=20m
9. Classifier detects bridge context from SO-202
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
async def test_golden_nk_curing_class_4(mcp_server):
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

    curing = data.get("curing", {})
    assert curing.get("curing_days", 0) >= 9, (
        f"NK curing_class=4 @ 15°C must be ≥ 9 days per TKP §7.8.3. "
        f"Got: {curing.get('curing_days')} days. "
        f"Check calculator.py CURING_DAYS_TABLE[(4, '15-25')]."
    )
    assert curing.get("curing_class") == 4


# ── Golden Rule 2: Rimsa curing_class=4 @ 15°C → ≥ 9 days ─────────────────

@pytest.mark.asyncio
async def test_golden_rimsa_curing_class_4(mcp_server):
    """SO-202: Bridge parapets must have curing ≥ 9 days (class 4 @ 15°C)."""
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

    curing = data.get("curing", {})
    # Auto-assigned curing_class=4 for rimsa
    assert curing.get("curing_class") == 4, (
        f"Rimsa should auto-assign curing_class=4. Got: {curing.get('curing_class')}"
    )
    assert curing.get("curing_days", 0) >= 9, (
        f"Rimsa curing @ 15°C class 4 must be ≥ 9 days. Got: {curing.get('curing_days')}"
    )


# ── Golden Rule 3: Substructure curing_class=3 @ 15°C → ≥ 4 days ──────────

@pytest.mark.asyncio
async def test_golden_substructure_curing_class_3(mcp_server):
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

    curing = data.get("curing", {})
    # Auto-assigned curing_class=3 for bridge substructure
    assert curing.get("curing_class") == 3, (
        f"driky_piliru should auto-assign curing_class=3. Got: {curing.get('curing_class')}"
    )
    assert curing.get("curing_days", 0) >= 4, (
        f"Substructure curing class 3 @ 15°C must be ≥ 4 days. "
        f"Got: {curing.get('curing_days')}"
    )


# ── Golden Rule 4: XF4 exposure enforces ≥ 7 days floor ────────────────────

@pytest.mark.asyncio
async def test_golden_xf4_minimum_7_days(mcp_server):
    """TKP §7.8.3: XF4 exposure always minimum 7 days curing."""
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

    curing = data.get("curing", {})
    assert curing.get("curing_days", 0) >= 7, (
        f"XF4 exposure minimum curing = 7 days per TKP §7.8.3, even at 25°C. "
        f"Got: {curing.get('curing_days')} days."
    )


# ── Golden Rule 5: Pilota → no formwork (pažnice instead) ──────────────────

@pytest.mark.asyncio
async def test_golden_pilota_no_formwork(mcp_server):
    """SO-202: Piles use casing (pažnice), not standard formwork."""
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

    fw = data.get("formwork", {})
    system = fw.get("system", "")
    assert "formwork" not in system.lower() or "no formwork" in system.lower() or "pažnice" in system.lower() or "casing" in system.lower(), (
        f"Pilota should show casing/pažnice, not standard formwork. Got: '{system}'"
    )
    # Lateral pressure should be 0 for piles
    assert fw.get("lateral_pressure_kn_m2", 0) == 0, (
        "Pilota should have 0 lateral pressure (no formwork)"
    )


# ── Golden Rule 6: Bridge piles Ø900 → rebar ≥ 80 kg/m³ ───────────────────

@pytest.mark.asyncio
async def test_golden_pile_rebar_bridge(mcp_server):
    """SO-202 bug #13: Bridge pile Ø900 rebar should be ≥ 80 kg/m³, not 40."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "pilota",
            "volume_m3": 50.9,
            "concrete_class": "C30/37",
            "pile_diameter_mm": 900,
        },
    )
    data = result.structured_content
    assert "error" not in data

    rebar = data.get("rebar", {})
    assert rebar.get("ratio_kg_m3", 0) >= 80, (
        f"Bridge pile Ø900 rebar should be ≥ 80 kg/m³. "
        f"Got: {rebar.get('ratio_kg_m3')} kg/m³. "
        f"Was bug #13 (default 40 → 50% underestimate)."
    )


# ── Golden Rule 7: Prestressed NK adds ≥ 11 days ───────────────────────────

@pytest.mark.asyncio
async def test_golden_prestress_schedule(mcp_server):
    """SO-202: Prestressed NK adds ~11 days (7d wait + 2d stress + 2d grout)."""
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

    schedule = data.get("schedule", {})
    assert schedule.get("prestress_days", 0) >= 11, (
        f"Prestressed NK should add ≥ 11 days. "
        f"Got: {schedule.get('prestress_days', 0)} days. "
        f"Expected: 7d wait + 2d stressing + 2d grouting."
    )


# ── Golden Rule 8: Fixed scaffolding for span=20m ──────────────────────────

@pytest.mark.asyncio
async def test_golden_fixed_scaffolding_recommendation(mcp_server):
    """SO-202 §7.2: span=20m → fixed scaffolding recommended."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "mostovkova_deska",
            "volume_m3": 605,
            "concrete_class": "C35/45",
            "span_m": 20,
            "num_spans": 6,
        },
    )
    data = result.structured_content
    assert "error" not in data

    tech = data.get("bridge_technology", "")
    assert tech is not None, "Bridge deck should include bridge_technology"
    assert "skruž" in tech.lower() or "falsework" in tech.lower() or "scaffolding" in tech.lower(), (
        f"span=20m should recommend fixed scaffolding. Got: '{tech}'"
    )


# ── Golden Rule 9: Classifier detects bridge context from SO-202 ───────────

@pytest.mark.asyncio
async def test_golden_classifier_bridge_context(mcp_server):
    """SO-202: Classifier must detect bridge context from SO-202 code."""
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
