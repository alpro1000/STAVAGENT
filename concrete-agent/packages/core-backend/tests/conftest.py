"""
Shared pytest fixtures for the MCP test suite.

`calculate_replay` — offline replay of the canonical engine for the
calculate-delegating tests (TASK_FIX_SSOT_MCP_Delegate, Phase 2a). Since the
MCP `calculate_concrete_works` tool now delegates to POST /api/calculate, any
test that exercises it would otherwise reach the live Cloud Run engine in CI
(network + flake). This fixture patches the delegate seam
(`monolit_delegate._http_post`) to serve PlannerOutput recorded from the LIVE
engine into `fixtures/ssot_delegate/replay_calculate.json`, keyed by the exact
payload the tool sends. A missing payload raises (fails loud) instead of
silently hitting the network.

Regenerate the replay file when the engine contract changes:
  1. `cd Monolit-Planner/backend && PORT=3997 node scripts/serve_engine_local.mjs`
  2. run the real MCP tool against it and dump payload→output (see the capture
     note inside replay_calculate.json).
"""

import json
import os

import pytest

_REPLAY_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ssot_delegate", "replay_calculate.json"
)


def _canon_key(payload: dict) -> str:
    """Canonical replay key, number-normalized.

    fastmcp coerces numeric args to their declared type (e.g. span_m: float →
    31.0), while the captured fixtures may store the same value as int (31). Key
    on floats (bools preserved) so 31 and 31.0 map to the same entry.
    """
    def norm(v):
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, dict):
            return {k: norm(x) for k, x in v.items()}
        if isinstance(v, list):
            return [norm(x) for x in v]
        return v

    return json.dumps(norm(payload), sort_keys=True, ensure_ascii=False)


def _load_replay() -> dict:
    with open(_REPLAY_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    return {_canon_key(entry["payload"]): entry["output"] for entry in data["entries"]}


@pytest.fixture
def calculate_replay(monkeypatch):
    """Serve calculate delegation from captured live-engine fixtures (offline).

    Returns the payload→output map so a test can also inspect it directly.
    """
    replay = _load_replay()
    from app.mcp.tools import monolit_delegate as md

    async def fake_post(path, payload):
        if path == "/api/calculate":
            key = _canon_key(payload)
            if key in replay:
                return 200, replay[key]
            raise AssertionError(
                f"No replay fixture for calculate payload {key!r}. "
                "Re-capture fixtures/ssot_delegate/replay_calculate.json."
            )
        # Phase 2a delegates calculate only; classify stays W3 (Python, no HTTP).
        raise AssertionError(f"Unexpected delegate path {path!r} in offline test")

    monkeypatch.setattr(md, "_http_post", fake_post)
    monkeypatch.setattr(md, "_RETRY_BACKOFF_S", 0)
    return replay
