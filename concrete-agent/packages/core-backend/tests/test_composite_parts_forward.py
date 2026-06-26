"""
Composite-parts MCP forward-only golden (Fáze 5 #7, Gate 3b).

The MCP `calculate_concrete_works` tool must FORWARD a caller-supplied `parts`
list verbatim into the /api/calculate payload and do NO decomposition of its own.
The split + aggregation lives in the canonical engine (planComposite, behind the
Monolit-Planner backend `ENABLE_COMPOSITE_PARTS` flag) — the MCP side is a pure
pass-through (audit T1 honest-blank discipline).

Hermetic: the only network function (`delegate_calculate`) is monkeypatched to
capture the payload, so no Cloud Run / FastMCP is required.
"""
import pytest

import app.mcp.tools.calculator as calc


@pytest.mark.asyncio
async def test_parts_forwarded_verbatim(monkeypatch):
    captured = {}

    async def fake_delegate(payload):
        captured["payload"] = payload
        return {"source": "monolit_planner_api", "element": {"type": "opery_ulozne_prahy"}}

    monkeypatch.setattr(calc, "delegate_calculate", fake_delegate)

    parts = [
        {"element_type": "driky_piliru", "volume_m3": 60, "part_label": "dřík"},
        {"element_type": "kridla_opery", "part_label": "křídla"},
    ]
    await calc.calculate_concrete_works(
        element_type="opery_ulozne_prahy",
        volume_m3=100,
        concrete_class="C30/37",
        parts=parts,
    )
    # FORWARD-ONLY: payload carries parts verbatim; MCP did not split/aggregate them.
    assert captured["payload"].get("parts") == parts


@pytest.mark.asyncio
async def test_no_parts_means_no_parts_key(monkeypatch):
    captured = {}

    async def fake_delegate(payload):
        captured["payload"] = payload
        return {"source": "monolit_planner_api", "element": {"type": "stena"}}

    monkeypatch.setattr(calc, "delegate_calculate", fake_delegate)

    await calc.calculate_concrete_works(
        element_type="stena",
        volume_m3=30,
        concrete_class="C25/30",
    )
    # Single-element calls stay byte-identical: no spurious `parts` key in the payload.
    assert "parts" not in captured["payload"]
