"""
Hermetic tests for MCP tool `calculate_railway_works` + `zeleznice_delegate`.

No network, no fastmcp needed — the transport seam
(`zeleznice_delegate._http_request`) is monkeypatched, mirroring the
monolit-delegate test discipline: 200 verbatim, 4xx typed EngineInvalidInput
(incl. 422 honest NEPOČÍTÁNO passthrough via reason_cs), timeout typed
EngineUnavailable, never a Python-computed fallback.
"""

import pytest

import app.mcp.tools.zeleznice_delegate as zd
from app.mcp.tools.railway_works import calculate_railway_works


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch):
    monkeypatch.setattr(zd, "_RETRY_BACKOFF_S", 0)


def _fake_transport(responses):
    """Build a transport seam returning queued (status, body) tuples.

    A queued Exception instance is raised instead. Records calls.
    """
    calls = []

    async def _transport(method, path, payload):
        calls.append({"method": method, "path": path, "payload": payload})
        item = responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    _transport.calls = calls
    return _transport


SAMPLE_RESULT = {
    "meta": {"engine_version": "1.0.0"},
    "quantities": {"prazce_ks": {"value": 1680, "unit": "ks", "status": "ok"}},
    "vykaz": [],
}


@pytest.mark.asyncio
async def test_calculate_returns_engine_result_verbatim(monkeypatch):
    transport = _fake_transport([(200, dict(SAMPLE_RESULT))])
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(
        rail_input={
            "section_length_m": 1000,
            "track_count": 1,
            "assembly_id": "UIC60_bezstykova",
        }
    )

    assert result["quantities"]["prazce_ks"]["value"] == 1680
    assert result["source"] == "zeleznice_planner_api"
    assert transport.calls[0]["method"] == "POST"
    assert transport.calls[0]["path"] == "/api/rail/calculate"
    # Input forwarded VERBATIM — no mutation, no Python-side computation.
    assert transport.calls[0]["payload"]["assembly_id"] == "UIC60_bezstykova"


@pytest.mark.asyncio
async def test_422_uncalculated_maps_to_invalid_input_with_czech_reason(monkeypatch):
    body = {
        "error": "uncalculated",
        "uncalculated": True,
        "reason_cs": "NEPOČÍTÁNO — chybí délka úseku (zadejte staničení km od–do nebo délku v metrech).",
        "missing_fields": ["section_length_m"],
    }
    transport = _fake_transport([(422, body)])
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(
        rail_input={"track_count": 1, "assembly_id": "UIC60_bezstykova"}
    )

    assert result["error"] == "engine_invalid_input"
    assert "NEPOČÍTÁNO" in result["message"]  # reason_cs preferred by _err_text
    assert result["status"] == 422
    assert len(transport.calls) == 1  # 4xx never retries


@pytest.mark.asyncio
async def test_400_unknown_assembly_passthrough(monkeypatch):
    # Backend 400 shape = Monolit engine.js parity: human message lives in `error`.
    body = {"error": "Neznámá sestava svršku 'x'. Povolené: UIC60_bezstykova, …"}
    transport = _fake_transport([(400, body)])
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(
        rail_input={"section_length_m": 1, "track_count": 1, "assembly_id": "x"}
    )

    assert result["error"] == "engine_invalid_input"
    assert "Povolené" in result["message"]


@pytest.mark.asyncio
async def test_timeout_maps_to_engine_unavailable_after_retries(monkeypatch):
    import httpx

    transport = _fake_transport(
        [
            httpx.ConnectError("boom"),
            httpx.ConnectError("boom"),
            httpx.ConnectError("boom"),
        ]
    )
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(
        rail_input={
            "section_length_m": 1000,
            "track_count": 1,
            "assembly_id": "UIC60_bezstykova",
        }
    )

    assert result["error"] == "engine_unavailable"
    assert result["source"] == "zeleznice_planner_api"
    assert len(transport.calls) == 3  # 1 + _RETRIES_UNAVAILABLE


@pytest.mark.asyncio
async def test_catalog_only_uses_get_catalog(monkeypatch):
    catalog = {"assemblies": [{"id": "UIC60_bezstykova"}], "machines": []}
    transport = _fake_transport([(200, dict(catalog))])
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(catalog_only=True)

    assert result["assemblies"][0]["id"] == "UIC60_bezstykova"
    assert result["source"] == "zeleznice_planner_api"
    assert transport.calls[0]["method"] == "GET"
    assert transport.calls[0]["path"] == "/api/rail/catalog"


@pytest.mark.asyncio
async def test_missing_rail_input_is_typed_error_without_network(monkeypatch):
    transport = _fake_transport([])
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works()

    assert result["error"] == "invalid_rail_input"
    assert "catalog_only" in result["message"]
    assert transport.calls == []  # nothing touched the network


@pytest.mark.asyncio
async def test_5xx_retries_once_then_engine_error(monkeypatch):
    transport = _fake_transport(
        [(500, {"error": "engine_error"}), (500, {"error": "engine_error"})]
    )
    monkeypatch.setattr(zd, "_http_request", transport)

    result = await calculate_railway_works(
        rail_input={
            "section_length_m": 1000,
            "track_count": 1,
            "assembly_id": "UIC60_bezstykova",
        }
    )

    assert result["error"] == "engine_error"
    assert len(transport.calls) == 2  # 1 + _RETRIES_5XX
