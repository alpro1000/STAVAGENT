"""
Bug `passport-mcp-error-transport` (2026-07-11): typed errors must SURVIVE the
FastMCP transport, not just exist at the function layer.

`calculate_from_passport` returned `{"error": "invalid_passport", "details":
ve.errors()}` — correct at the function layer (test_mcp_golden_calculate_from_
passport pins it) — but pydantic v2 `ve.errors()` carries live exception
objects in `ctx`, FastMCP's structured-output serialization failed on them,
and the client saw an opaque `ToolError: Output validation error: outputSchema
defined but no structured output returned` instead of the typed error.

These tests exercise the tool THROUGH an in-process FastMCP client — the same
path a connector takes — so the serialization seam is actually covered.
Requires fastmcp (MCP CI lane); skipped locally when absent.
"""

import json

import pytest

fastmcp = pytest.importorskip("fastmcp")

from fastmcp import Client, FastMCP  # noqa: E402

from app.mcp.tools.passport_plan import calculate_from_passport  # noqa: E402


def _make_server() -> "FastMCP":
    """Fresh FastMCP instance with just this tool — no app.mcp.server import
    (which would pull DB/auth wiring irrelevant to the transport seam)."""
    mcp = FastMCP("passport-transport-test")
    mcp.tool()(calculate_from_passport)
    return mcp


@pytest.mark.asyncio
async def test_invalid_passport_typed_error_survives_transport():
    """Malformed passport → the CLIENT receives the typed error dict as
    structured content — NOT a ToolError about missing structured output."""
    bad = {"_meta": {"schema": "tz-bridge-passport", "schema_version": "999"}}
    async with Client(_make_server()) as client:
        result = await client.call_tool(
            "calculate_from_passport", {"passport": bad}
        )
    assert result.is_error is False  # typed error, not a transport failure
    data = result.structured_content
    assert data["error"] == "invalid_passport"
    assert "tz-bridge-passport" in data["message"]
    # The validation detail is present and says WHAT is wrong (msg carries the
    # full human-readable reason even with ctx/input/url stripped).
    assert any("schema_version" in str(d.get("loc", "")) for d in data["details"])
    assert any("999" in d.get("msg", "") for d in data["details"])


@pytest.mark.asyncio
async def test_error_details_are_json_serializable():
    """The whole error payload must round-trip through json — the exact
    property whose absence produced the opaque transport error."""
    bad = {"_meta": {"schema": "tz-bridge-passport", "schema_version": "999"}}
    out = await calculate_from_passport(bad)
    json.dumps(out)  # raises TypeError on regression (live ctx objects)
    assert out["error"] == "invalid_passport"
