"""
calculate_from_passport MCP golden (tz-passport-json Gate 2).

The tool turns a per-SO bridge passport (JSON) into a whole-SO plan by
DELEGATING to the canonical engine (planPassport over HTTP). It must:
  1. validate the passport against the single-source schema (BridgePassport) and
     forward it VERBATIM — no mapping/calculation of its own;
  2. reject a malformed passport as `invalid_passport` WITHOUT any engine call;
  3. surface a delegation failure as a typed error, never a computed number.

Hermetic: the only network function (`delegate_calculate_from_passport`) is
monkeypatched, so no Cloud Run / Monolit backend / FastMCP is required. The
golden passport is the same canonical fixture the shared engine + Pydantic
schema tests assert against.
"""
import json
from pathlib import Path

import pytest

import app.mcp.tools.passport_plan as pp
from app.mcp.tools.monolit_delegate import EngineUnavailable

_EXAMPLE = (
    Path(__file__).resolve().parents[4]
    / "docs" / "specs" / "tz-passport-json" / "example_SO202_zalmanov.json"
)


def _load() -> dict:
    return json.loads(_EXAMPLE.read_text(encoding="utf-8"))


@pytest.mark.asyncio
async def test_passport_forwarded_verbatim_and_output_returned(monkeypatch):
    captured = {}

    async def fake_delegate(passport):
        captured["passport"] = passport
        return {"mapping": {"elements": [], "warnings": []},
                "project": {"aggregate": {"elements_total": 9}}}

    monkeypatch.setattr(pp, "delegate_calculate_from_passport", fake_delegate)

    passport = _load()
    out = await pp.calculate_from_passport(passport)

    # FORWARD-ONLY: the exact passport dict reached the engine (no re-dump).
    assert captured["passport"] == passport
    assert captured["passport"]["_meta"]["schema"] == "tz-bridge-passport"
    # Engine output is returned verbatim + source stamp.
    assert out["project"]["aggregate"]["elements_total"] == 9
    assert out["source"] == "monolit_planner_api"


@pytest.mark.asyncio
async def test_malformed_passport_rejected_without_engine_call(monkeypatch):
    called = {"n": 0}

    async def fake_delegate(passport):
        called["n"] += 1
        return {}

    monkeypatch.setattr(pp, "delegate_calculate_from_passport", fake_delegate)

    bad = _load()
    bad["_meta"]["schema_version"] = "9.9-unknown"  # schema drift → reject
    out = await pp.calculate_from_passport(bad)

    assert out["error"] == "invalid_passport"
    assert "details" in out
    assert called["n"] == 0  # engine never touched on bad input


@pytest.mark.asyncio
async def test_non_dict_passport_rejected(monkeypatch):
    async def fake_delegate(passport):  # pragma: no cover — must not run
        raise AssertionError("engine must not be called for a non-dict passport")

    monkeypatch.setattr(pp, "delegate_calculate_from_passport", fake_delegate)

    out = await pp.calculate_from_passport("not a dict")  # type: ignore[arg-type]
    assert out["error"] == "invalid_passport"


@pytest.mark.asyncio
async def test_engine_failure_becomes_typed_error(monkeypatch):
    async def fake_delegate(passport):
        raise EngineUnavailable("cold start")

    monkeypatch.setattr(pp, "delegate_calculate_from_passport", fake_delegate)

    out = await pp.calculate_from_passport(_load())
    assert out["error"] == "engine_unavailable"  # never a fabricated plan
    assert out["source"] == "monolit_planner_api"
