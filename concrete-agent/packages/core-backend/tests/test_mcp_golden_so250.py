"""
MCP Golden Test: SO-250 D6 Olšová Vrata–Žalmanov, úhlová zárubní zeď (W3).

Validates the element classifier on the name-normalization layer (task
docs/tasks/TASK_W3_NormalizeElementName_SO250.md). Inputs hand-transcribed from
the SO-250 probe corpus (Monolit-Planner/shared/SO-250_smartextractor_probe.md)
and the SO-202 bridge case (for the regression guards).

8 criteria from §5 of the W3 task (classifier numbering continues from #63):

  #63 — "dřík" of a wall (SO 250)        → operna_zed, NOT driky_piliru
  #64 — "dřík" of a pier (SO 202)        → driky_piliru          (regression)
  #65 — prepositional tail not the head  → zdivo_obklad, NOT driky_piliru
  #66 — head noun "základ" (SO 250)      → zaklady, NOT jine
  #67 — "trám" of a římsa (SO 250)       → rimsa                 (regression)
  #68 — "trám" inside an NK (SO 202)     → mostovkova_deska, NOT pruvlak
  #69 — false bridge context neutralized → SO 250 not bridge; no pier/deck remap
  #70 — status binding                   → demolition text → status="stávající"

Red against current code (locks defects #63/#65/#66/#68/#69/#70); green after the
normalization layer + zdivo_obklad category land. #64/#67 guard regression.
"""

import asyncio
import os
import sys

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


async def _classify(mcp_server, name: str, object_code: str | None = None) -> dict:
    args = {"name": name}
    if object_code is not None:
        args["object_code"] = object_code
    result = await mcp_server.call_tool("classify_construction_element", args)
    data = result.structured_content
    assert "error" not in data, f"Classifier error: {data.get('error')}"
    return data


# ── #63 — "dřík" of a wall is NOT a pier ──────────────────────────────────────

@pytest.mark.asyncio
async def test_golden_63_drik_of_wall(mcp_server):
    """'Dřík konstrukce' on an úhlová zárubní zeď (SO 250) is the wall stem →
    operna_zed, not driky_piliru. Context (wall) must beat the bare word."""
    data = await _classify(mcp_server, "Dřík konstrukce", "SO 250")
    assert data["element_type"] == "operna_zed", (
        f"#63 'Dřík konstrukce' on a retaining wall must be operna_zed, "
        f"not a bridge pier. Got: {data['element_type']}"
    )


# ── #64 — "dřík" of a pier stays a pier (regression) ──────────────────────────

@pytest.mark.asyncio
async def test_golden_64_drik_of_pier_regression(mcp_server):
    """'Dříky pilířů' in bridge context (SO 202) → driky_piliru. Must stay green."""
    data = await _classify(mcp_server, "Dříky pilířů", "SO 202")
    assert data["element_type"] == "driky_piliru", (
        f"#64 'Dříky pilířů' on a bridge must stay driky_piliru. "
        f"Got: {data['element_type']}"
    )


# ── #65 — prepositional tail is not the head noun ─────────────────────────────

@pytest.mark.asyncio
async def test_golden_65_prepositional_tail_not_head(mcp_server):
    """'Lícový obklad z lomového kamene kotvený do dříku' → zdivo_obklad. The
    head noun is *obklad*; 'do dříku' is a modifier and must not win."""
    data = await _classify(
        mcp_server, "Lícový obklad z lomového kamene kotvený do dříku", "SO 250"
    )
    assert data["element_type"] == "zdivo_obklad", (
        f"#65 head noun is 'obklad' (cladding), not the 'do dříku' tail. "
        f"Expected zdivo_obklad, got: {data['element_type']}"
    )


# ── #66 — head noun "základ" canonized past the brittle suffix ────────────────

@pytest.mark.asyncio
async def test_golden_66_zaklad_head_noun(mcp_server):
    """'Železobetonový základ 0,56×2,75' → zaklady. Canonization beats the
    suffix-restricted rule (which only matched 'základů/y')."""
    data = await _classify(mcp_server, "Železobetonový základ 0,56×2,75", "SO 250")
    assert data["element_type"] == "zaklady", (
        f"#66 'základ' must classify as zaklady, not the residual category. "
        f"Got: {data['element_type']}"
    )


# ── #67 — "trám" of a římsa stays a římsa (regression) ────────────────────────

@pytest.mark.asyncio
async def test_golden_67_rimsa_tram_regression(mcp_server):
    """'Římsa-kotevní trám' → rimsa. Must stay green (říms before trám)."""
    data = await _classify(mcp_server, "Římsa-kotevní trám", "SO 250")
    assert data["element_type"] == "rimsa", (
        f"#67 'Římsa-kotevní trám' must stay rimsa. Got: {data['element_type']}"
    )


# ── #68 — "trám" inside an NK is the NK ────────────────────────────────────────

@pytest.mark.asyncio
async def test_golden_68_tram_in_nk(mcp_server):
    """'Trámy dvoutrámové nosné konstrukce' → mostovkova_deska (NK). The head is
    the nosná konstrukce; the 'trám' modifier must not win as průvlak."""
    data = await _classify(
        mcp_server, "Trámy dvoutrámové nosné konstrukce", "SO 202"
    )
    assert data["element_type"] == "mostovkova_deska", (
        f"#68 head is the nosná konstrukce (NK), not a průvlak. "
        f"Expected mostovkova_deska, got: {data['element_type']}"
    )


# ── #69 — false bridge context neutralized for a retaining wall ───────────────

@pytest.mark.asyncio
async def test_golden_69_false_bridge_context_neutralized(mcp_server):
    """SO 250 is a retaining wall, not a bridge: object code SO 250 must NOT set
    bridge context, so 'základ' is not promoted to zaklady_piliru. Must ship
    together with #66 (once 'základ' matches, a false bridge flag would remap)."""
    data = await _classify(mcp_server, "Železobetonový základ 0,56×2,75", "SO 250")
    assert data.get("is_bridge_context") is False, (
        "#69 SO 250 (zárubní zeď) must NOT be bridge context. "
        f"Got is_bridge_context={data.get('is_bridge_context')}"
    )
    assert data["element_type"] == "zaklady", (
        f"#69 'základ' on SO 250 must NOT be remapped to zaklady_piliru. "
        f"Got: {data['element_type']}"
    )


# ── #70 — status binding: existing/demolition is flagged out ──────────────────

@pytest.mark.asyncio
async def test_golden_70_status_existing(mcp_server):
    """An element from the description of the existing bridge ev.č. 6-049 and its
    demolition → status='stávající', excluded from the new object's atomization."""
    data = await _classify(
        mcp_server,
        "Demolice stávajícího mostu ev.č. 6-049",
        "SO 250",
    )
    assert data.get("status") == "stávající", (
        f"#70 demolition of an existing structure must be flagged "
        f"status='stávající'. Got: {data.get('status')}"
    )
