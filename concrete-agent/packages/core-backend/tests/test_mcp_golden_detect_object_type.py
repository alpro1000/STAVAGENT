"""
Golden Test: MCP tool `detect_object_type` (Part A of TASK_MCP_DetectType_and_Export).

Exposes the W3b object-type detector as a first-class MCP tool. The tool is a thin,
deterministic wrapper over app.mcp.tools.object_type_detector.detect_object_type
(W3b, in main) — it determines the object type from the object NAME + the
charakteristika sentence ONLY, never full text, and carries a `_source` for the
grounding gate. Cache-filling stays with the orchestrator (single responsibility).

Skip-proof, like test_mcp_golden_so250b.py: sync test_* functions driving the real
coroutine via asyncio.run — no @pytest.mark.asyncio, no fastmcp/app.mcp.server
import. A missing dep ERRORS (red), never silently skips. Registration assertions
import their heavier deps (fastapi-backed routes) INSIDE the test, so a missing dep
fails only that test, not the behavioural ones.

Criteria from §A of docs/tasks/TASK_MCP_DetectType_and_Export.md:

  #77 — SO 250 (name "Zárubní zeď", charakteristika "Úhlová železobetonová zeď")
        → retaining_wall, even though the TZ body mentions "mostní objekt"/"lávka
        SO 222" (that full text is NOT passed — only name + charakteristika).
  #78 — SO 202 (name "Most…", charakteristika "Trvalý dálniční most") → bridge.
  #79 — input without determining wording → undetermined (None), no crash, fallback
        signalled.
  #80 — tool carries `_source` naming the field that decided; missing both name and
        charakteristika → unverified. Registered, has a REST wrapper, default path is
        deterministic (no LLM).
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.detect_object_type import detect_object_type

# SO-250 retaining wall: object name + charakteristika ONLY. The real TZ geology
# section mentions "mostní objekt" / "lávka SO 222" — deliberately NOT passed,
# because detection must use only name + charakteristika (#77).
SO250_NAME = "Zárubní zeď v km 6,500 – 7,000 vpravo"
SO250_CHARAKTERISTIKA = "Úhlová železobetonová zeď."
SO250_FULLTEXT_NOISE = (
    "Geologie: navazuje na mostní objekt a lávku SO 222 přes potok. "
    "Most ev.č. 6-049 se nachází poblíž."
)

SO202_NAME = "Most na sil. I/6 přes Lomnický potok"
SO202_CHARAKTERISTIKA = "Trvalý dálniční most o třech polích."


# ── #77 — SO 250 retaining wall, bridge noise must not flip it ────────────────

def test_77_so250_retaining_wall_despite_bridge_noise():
    r = asyncio.run(detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA))
    assert r["object_type"] == "retaining_wall", r
    # Even if the geology noise were (wrongly) appended to charakteristika, the
    # explicit wall wording in the name still wins over the bridge mention.
    r2 = asyncio.run(
        detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA + " " + SO250_FULLTEXT_NOISE)
    )
    assert r2["object_type"] == "retaining_wall", r2


# ── #78 — SO 202 bridge ───────────────────────────────────────────────────────

def test_78_so202_bridge():
    r = asyncio.run(detect_object_type(SO202_NAME, SO202_CHARAKTERISTIKA))
    assert r["object_type"] == "bridge", r


# ── #79 — undetermined → None, no crash, fallback signalled ───────────────────

def test_79_undetermined_no_crash():
    r = asyncio.run(detect_object_type("SO 999 objekt", "Blíže neurčeno."))
    assert r["object_type"] is None, r
    assert r["verified"] is False, r
    # Safe fallback — a dict, not an exception.
    assert isinstance(r, dict)


# ── #80 — _source names the deciding field; missing both → unverified ─────────

def test_80_source_names_deciding_field():
    # Name alone decides the wall → _source points at the name.
    r = asyncio.run(detect_object_type(SO250_NAME, ""))
    assert r["object_type"] == "retaining_wall", r
    assert r["verified"] is True, r
    assert isinstance(r["_source"], str) and r["_source"], r
    assert "name" in r["_source"], r

    # charakteristika alone decides the bridge → _source points at charakteristika.
    r2 = asyncio.run(detect_object_type("SO 202", SO202_CHARAKTERISTIKA))
    assert r2["object_type"] == "bridge", r2
    assert "charakteristika" in r2["_source"], r2


def test_80_missing_both_inputs_is_unverified():
    r = asyncio.run(detect_object_type("", ""))
    assert r["object_type"] is None, r
    assert r["verified"] is False, r
    assert r["_source"] is None, r


def test_80_default_path_is_deterministic():
    # Same input → identical output, no LLM, repeatable.
    a = asyncio.run(detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA))
    b = asyncio.run(detect_object_type(SO250_NAME, SO250_CHARAKTERISTIKA))
    assert a == b, (a, b)


def test_80_registered_with_rest_wrapper_and_manifest():
    # Imported here so a missing fastapi/yaml dep ERRORS this test only (skip-proof),
    # leaving the behavioural tests above runnable.
    from app.mcp import routes as mcp_routes
    from app.mcp import auth as mcp_auth
    from app.services.stage_gating.tool_manifest import get_manifest

    assert "detect_object_type" in mcp_routes.TOOL_ORDER
    assert "detect_object_type" in mcp_routes.TOOL_DESCRIPTIONS
    assert mcp_auth.TOOL_COSTS.get("detect_object_type") == 0  # free, deterministic
    # REST wrapper present (router carries an /api/v1/mcp prefix).
    paths = {getattr(r, "path", "") for r in mcp_routes.router.routes}
    assert any(p.endswith("/tools/detect-object-type") for p in paths), sorted(paths)
    # Manifest present so the MCP server can start (validate_registry passes).
    assert get_manifest("detect_object_type") is not None
