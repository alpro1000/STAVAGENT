"""
SSOT delegation contract — concrete-agent MCP `calculate_concrete_works`
delegates to the canonical TS engine (TASK_FIX_SSOT_MCP_Delegate, Phase 2a).

Phase 2a scope = calculate only. `classify` stays the W3 Python classifier
(its richer SO-250 vocabulary — operna_zed / zaklady / zdivo_obklad / head-noun
disambiguation — has no canonical-engine equivalent yet); its delegation is
deferred to a later phase. The classify fixtures captured in
`engine_fixtures.json` are retained for that follow-up.

The MCP/agent surface MUST return the SAME numbers as the UI. These tests pin
the contract on the Python side; the cross-language parity (planElement ===
POST /api/calculate, incl. rebar 150 not 180) is pinned in the Monolit jest
layer where Node is live (`backend/tests/routes/engine.parity.test.js`).

Strategy (per review):
  - The engine is injected via the monkeypatch-able delegate seam
    `monolit_delegate._http_post`. Fixtures replayed here are captured from the
    LIVE engine (`tests/fixtures/ssot_delegate/engine_fixtures.json`, tagged
    with a contract hash) using the SAME element set as the jest parity, so
    drift is caught consistently.
  - calculate forwards the engine PlannerOutput VERBATIM (+ source). The
    divergent Python fallback (rebar 180, mcp_simplified, CURING_DAYS_TABLE…)
    is gone — a failure is a typed error, never a silently-computed number.
  - fail-mode: 4xx → engine_invalid_input (no retry); 5xx → engine_error (one
    retry); conn/timeout → engine_unavailable (retry). NEVER a number.
  - MCP-only types (zdivo_obklad / izolacni_stena / sachta / tunel_rampa) →
    unsupported_element_type, WITHOUT calling the engine.

These tests import the tool callable directly (no fastmcp), so they run in the
Python-only MCP CI that has no live Node engine.
"""

import json
import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools import monolit_delegate as md  # noqa: E402
from app.mcp.tools.calculator import calculate_concrete_works  # noqa: E402


# ── Fixtures captured from the LIVE engine ───────────────────────────────────

_FIXTURE_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ssot_delegate", "engine_fixtures.json"
)


def _load_fixtures() -> dict:
    with open(_FIXTURE_PATH, encoding="utf-8") as fh:
        return json.load(fh)


FIXTURES = _load_fixtures()

PARITY_ELEMENTS = [
    "mostovkova_deska", "rimsa", "driky_piliru", "zaklady_piliru",
    "pilota", "stena", "opery_ulozne_prahy",
]


def _calc_kwargs(engine_input: dict) -> dict:
    """Engine PlannerInput → MCP calculate_concrete_works kwargs.

    `has_dilatacni_spary` is engine-only (the tool always sends false); every
    other captured key is a real MCP parameter, so the captured input maps 1:1
    to what the tool forwards.
    """
    return {k: v for k, v in engine_input.items() if k != "has_dilatacni_spary"}


class _RecordingPost:
    """Fake `_http_post` that records the payload and returns a fixed response.

    `behaviour` is either a (status, body) tuple to return or an Exception to
    raise — driving the full fail-mode state machine without real HTTP.
    """

    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.calls: list[dict] = []

    async def __call__(self, path: str, payload: dict):
        self.calls.append({"path": path, "payload": payload})
        if isinstance(self.behaviour, Exception):
            raise self.behaviour
        return self.behaviour


@pytest.fixture(autouse=True)
def _offline_and_fast(monkeypatch):
    """Make every delegation test deterministic and offline.

    - retries instant (no real sleep),
    - the engine URL points nowhere,
    - real httpx network is blocked — so any code path NOT going through a
      patched `_http_post` (e.g. a legacy inline-httpx fallback) fails closed
      instead of silently hitting the live Cloud Run engine.
    """
    monkeypatch.setattr(md, "_RETRY_BACKOFF_S", 0)
    monkeypatch.setattr(md, "MONOLIT_API_URL", "http://127.0.0.1:9")

    class _BlockedClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            raise httpx.ConnectError("network blocked in test")

    monkeypatch.setattr(httpx, "AsyncClient", _BlockedClient)


# ── Fixture integrity ────────────────────────────────────────────────────────

def test_fixtures_carry_contract_hash():
    """Fixtures must be tagged with the engine contract hash so the Python
    replay and the jest parity drift in lockstep."""
    assert FIXTURES.get("_contract_hash"), "engine_fixtures.json missing _contract_hash"
    assert len(FIXTURES["calculate"]) >= len(PARITY_ELEMENTS)
    assert len(FIXTURES["classify"]) >= len(PARITY_ELEMENTS)


# ── calculate_concrete_works: verbatim delegation + parity ───────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("element", PARITY_ELEMENTS)
async def test_calculate_forwards_engine_output_verbatim(monkeypatch, element):
    """calculate delegates to POST /api/calculate and forwards PlannerOutput
    VERBATIM + source — no Python recompute. This IS the parity:
    via MCP == via TS-direct (the fixture output is the live engine output)."""
    fx = FIXTURES["calculate"][f"parity/{element}"]
    fake = _RecordingPost((200, fx["output"]))
    monkeypatch.setattr(md, "_http_post", fake)

    result = await calculate_concrete_works(**_calc_kwargs(fx["input"]))

    # source tag added, every engine field preserved verbatim
    assert result.get("source") == "monolit_planner_api"
    for key, value in fx["output"].items():
        assert result[key] == value, f"{element}: field {key!r} not forwarded verbatim"

    # payload correctness: volume_m3 (NOT the legacy concrete_m3), right type
    sent = fake.calls[0]["payload"]
    assert sent["volume_m3"] == fx["input"]["volume_m3"]
    assert "concrete_m3" not in sent, "must send volume_m3, not the legacy concrete_m3"
    assert sent["element_type"] == element
    assert fake.calls[0]["path"] == "/api/calculate"


@pytest.mark.asyncio
async def test_calculate_mostovka_rebar_is_150_not_180(monkeypatch):
    """The canonical anchor: mostovková deska profile rebar = 150 kg/m³.
    The retired Python ELEMENT_TYPES said 180 — delegation must surface 150."""
    fx = FIXTURES["calculate"]["parity/mostovkova_deska"]
    monkeypatch.setattr(md, "_http_post", _RecordingPost((200, fx["output"])))

    result = await calculate_concrete_works(**_calc_kwargs(fx["input"]))

    assert result["element"]["profile"]["rebar_ratio_kg_m3"] == 150
    assert result["element"]["profile"]["rebar_ratio_kg_m3"] != 180
    assert result.get("source") == "monolit_planner_api"
    assert result.get("source") != "mcp_simplified"


# ── calculate fail-mode (never a silent number) ──────────────────────────────

@pytest.mark.asyncio
async def test_calculate_engine_unavailable(monkeypatch):
    """Connection refused / cold-start timeout → engine_unavailable, retried,
    NEVER a Python-computed plan."""
    fake = _RecordingPost(httpx.ConnectError("connection refused"))
    monkeypatch.setattr(md, "_http_post", fake)

    result = await calculate_concrete_works(
        element_type="stena", volume_m3=30, concrete_class="C25/30", height_m=2.8
    )
    assert result.get("error") == "engine_unavailable"
    assert result.get("source") != "mcp_simplified"
    # no silently-computed plan leaked through
    for forbidden in ("schedule", "formwork", "rebar", "num_tacts"):
        assert forbidden not in result
    # retried within budget (more than one attempt)
    assert len(fake.calls) >= 2


@pytest.mark.asyncio
async def test_calculate_engine_error_5xx_retries_once(monkeypatch):
    """5xx → engine_error after exactly ONE retry (2 attempts), not silent."""
    fake = _RecordingPost((500, {"error": "engine_error"}))
    monkeypatch.setattr(md, "_http_post", fake)

    result = await calculate_concrete_works(
        element_type="stena", volume_m3=30, concrete_class="C25/30", height_m=2.8
    )
    assert result.get("error") == "engine_error"
    assert len(fake.calls) == 2, "5xx must be retried exactly once"
    assert "schedule" not in result


@pytest.mark.asyncio
async def test_calculate_invalid_input_4xx_no_retry(monkeypatch):
    """4xx → engine_invalid_input, returned to caller, NOT retried."""
    fake = _RecordingPost((400, {"error": "volume_m3 must be a number in [0, 100000]"}))
    monkeypatch.setattr(md, "_http_post", fake)

    result = await calculate_concrete_works(
        element_type="stena", volume_m3=30, concrete_class="C25/30", height_m=2.8
    )
    assert result.get("error") == "engine_invalid_input"
    assert len(fake.calls) == 1, "4xx is a permanent bad-input error — no retry"


# ── MCP-only types → unsupported, engine NOT called ──────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("element", ["zdivo_obklad", "izolacni_stena", "sachta", "tunel_rampa"])
async def test_calculate_unsupported_type_not_delegated(monkeypatch, element):
    """Types absent from the canonical StructuralElementType union are flagged
    unsupported — NOT computed simplistically, and the engine is not called."""
    fake = _RecordingPost((200, {}))
    monkeypatch.setattr(md, "_http_post", fake)

    result = await calculate_concrete_works(
        element_type=element, volume_m3=10, concrete_class="C25/30"
    )
    assert result.get("error") == "unsupported_element_type"
    assert result.get("element_type") == element
    assert fake.calls == [], "unsupported type must not reach the engine"
    assert "schedule" not in result
