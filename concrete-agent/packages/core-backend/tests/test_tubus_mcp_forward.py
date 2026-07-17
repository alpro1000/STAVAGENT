"""Element 24 (uzavřený rám / tubus) — MCP forward golden (Wave 3a, §3).

The MCP `calculate_concrete_works` tool must FORWARD the caller-supplied tubus
geometry (DC count, clear width/height, slab/wall thicknesses, section length,
technology, prefab flag) verbatim into the /api/calculate payload so the
canonical engine's runTubusPath derives the phases from those explicit inputs.

Two invariants pinned here:
  * §2.10 / AC14 — a `width_m` hint must NOT fabricate a `formwork_area_m2`
    breakdown for the tubus (the general V/thickness heuristic is FORBIDDEN for
    this type); tubus geometry comes only from the explicit tubus_* fields.
  * back-compat — a non-tubus element never gains a spurious tubus_* key.

Hermetic: `delegate_calculate` is monkeypatched to capture the payload, so no
Cloud Run / FastMCP is required.
"""
import pytest

import app.mcp.tools.calculator as calc


def _capture(monkeypatch):
    captured = {}

    async def fake_delegate(payload):
        captured["payload"] = payload
        return {"source": "monolit_planner_api", "element": {"type": "uzavreny_ram_tubus"}}

    monkeypatch.setattr(calc, "delegate_calculate", fake_delegate)
    return captured


@pytest.mark.asyncio
async def test_tubus_geometry_forwarded_verbatim(monkeypatch):
    captured = _capture(monkeypatch)
    await calc.calculate_concrete_works(
        element_type="uzavreny_ram_tubus",
        volume_m3=0,  # engine derives from tubus geometry
        concrete_class="C30/37",
        tubus_dc_count=10,
        tubus_clear_width_m=4.0,
        tubus_clear_height_m=3.0,
        tubus_bottom_thickness_m=0.45,
        tubus_wall_thickness_m=0.40,
        tubus_top_thickness_m=0.45,
        tubus_section_length_m=12.0,
        tubus_technology="conventional",
        tubus_visual_concrete=True,
        tubus_internal_structures=True,
        construction_mode="monolit",
        exposure_from_documentation=True,
    )
    p = captured["payload"]
    assert p["element_type"] == "uzavreny_ram_tubus"  # not aliased, not unsupported
    assert p["tubus_dc_count"] == 10
    assert p["tubus_clear_width_m"] == 4.0
    assert p["tubus_clear_height_m"] == 3.0
    assert p["tubus_bottom_thickness_m"] == 0.45
    assert p["tubus_wall_thickness_m"] == 0.40
    assert p["tubus_top_thickness_m"] == 0.45
    assert p["tubus_section_length_m"] == 12.0
    assert p["tubus_technology"] == "conventional"
    assert p["tubus_visual_concrete"] is True
    assert p["tubus_internal_structures"] is True
    assert p["construction_mode"] == "monolit"
    assert p["exposure_from_documentation"] is True


@pytest.mark.asyncio
async def test_tubus_width_hint_does_not_fabricate_formwork_area(monkeypatch):
    """§2.10 / AC14 — the width_m→formwork_area_m2 heuristic is suppressed for
    the tubus. A stray width_m must NOT inject a breakdown-derived area."""
    captured = _capture(monkeypatch)
    await calc.calculate_concrete_works(
        element_type="uzavreny_ram_tubus",
        volume_m3=500,
        concrete_class="C30/37",
        width_m=4.0,  # would fabricate an area for any other vertical/horizontal type
        tubus_dc_count=10,
        tubus_clear_width_m=4.0,
        tubus_clear_height_m=3.0,
        tubus_bottom_thickness_m=0.45,
        tubus_wall_thickness_m=0.40,
        tubus_top_thickness_m=0.45,
        tubus_section_length_m=12.0,
    )
    p = captured["payload"]
    assert "formwork_area_m2" not in p  # no heuristic breakdown for tubus
    assert "nk_width_m" not in p


@pytest.mark.asyncio
async def test_prefab_mode_forwarded(monkeypatch):
    captured = _capture(monkeypatch)
    await calc.calculate_concrete_works(
        element_type="uzavreny_ram_tubus",
        volume_m3=0,
        concrete_class="C30/37",
        construction_mode="prefab",
        tubus_dc_count=30,
        tubus_clear_width_m=3.0,
        tubus_clear_height_m=2.5,
        tubus_section_length_m=2.0,
    )
    assert captured["payload"]["construction_mode"] == "prefab"


@pytest.mark.asyncio
async def test_non_tubus_element_gets_no_tubus_keys(monkeypatch):
    """Back-compat: the 23 existing types stay byte-identical — no tubus_* /
    construction_mode key leaks into their payload."""
    captured = _capture(monkeypatch)
    await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=30,
        concrete_class="C25/30",
    )
    p = captured["payload"]
    leaked = [k for k in p if k.startswith("tubus_") or k in ("construction_mode", "exposure_from_documentation")]
    assert leaked == []
