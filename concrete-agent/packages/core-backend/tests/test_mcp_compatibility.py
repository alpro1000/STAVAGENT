"""
MCP Compatibility Test

Runs on every commit via GitHub Actions.
Verifies that all 9 MCP tools can be imported, called with test data,
and return the expected response structure.

If a backend module changes its interface, this test fails immediately
and tells you exactly which tool broke and why.
"""

import asyncio
import json
import sys
import os
import pytest

# Ensure the app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mcp_server():
    """Import and return the MCP server instance."""
    from app.mcp.server import mcp
    return mcp


@pytest.fixture(scope="module")
def registered_tools(mcp_server):
    """Get list of registered tool names."""
    loop = asyncio.new_event_loop()
    tools = loop.run_until_complete(mcp_server.list_tools())
    loop.close()
    return [t.name for t in tools]


# ── Test: Server imports without errors ──────────────────────────────────────

def test_mcp_server_imports():
    """MCP server module must import without errors."""
    from app.mcp.server import mcp
    assert mcp is not None
    assert mcp.name == "STAVAGENT"


# ── Test: All 9 tools are registered ────────────────────────────────────────

EXPECTED_TOOLS = [
    "find_otskp_code",
    "find_urs_code",
    "classify_construction_element",
    "calculate_concrete_works",
    "parse_construction_budget",
    "analyze_construction_document",
    "create_work_breakdown",
    "get_construction_advisor",
    "search_czech_construction_norms",
]


def test_all_tools_registered(registered_tools):
    """All 9 MCP tools must be registered."""
    for tool_name in EXPECTED_TOOLS:
        assert tool_name in registered_tools, (
            f"MCP tool '{tool_name}' is NOT registered. "
            f"Check app/mcp/server.py — tool import may be broken."
        )


def test_no_unexpected_tools(registered_tools):
    """No unexpected tools should be registered (catches accidental duplicates)."""
    assert len(registered_tools) == len(EXPECTED_TOOLS), (
        f"Expected {len(EXPECTED_TOOLS)} tools, got {len(registered_tools)}. "
        f"Registered: {registered_tools}"
    )


# ── Test: Tool 1 — find_otskp_code ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_otskp_search(mcp_server):
    """OTSKP text search must return results with expected fields."""
    result = await mcp_server.call_tool(
        "find_otskp_code", {"query": "bednění", "max_results": 3}
    )
    data = result.structured_content
    assert "results" in data, f"Missing 'results' key. Got: {list(data.keys())}"
    assert "total_found" in data, "Missing 'total_found' key"
    assert isinstance(data["results"], list), "'results' must be a list"

    if data["total_found"] > 0:
        item = data["results"][0]
        for field in ("code", "description", "unit", "unit_price_czk", "confidence"):
            assert field in item, (
                f"OTSKP result item missing '{field}'. "
                f"Got fields: {list(item.keys())}. "
                f"Check app/mcp/tools/otskp.py return format."
            )


@pytest.mark.asyncio
async def test_otskp_code_lookup(mcp_server):
    """OTSKP code lookup must return results or a clear 'not found' note."""
    result = await mcp_server.call_tool(
        "find_otskp_code", {"query": "lookup", "code": "113472"}
    )
    data = result.structured_content
    assert "results" in data
    assert "total_found" in data


# ── Test: Tool 2 — find_urs_code ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_urs_search(mcp_server):
    """URS search must return results list (even if empty — no crash)."""
    result = await mcp_server.call_tool(
        "find_urs_code", {"description": "Zřízení bednění stěn"}
    )
    data = result.structured_content
    assert "results" in data, f"Missing 'results'. Got: {list(data.keys())}"
    assert isinstance(data["results"], list)


# ── Test: Tool 3 — classify_construction_element ─────────────────────────────

@pytest.mark.asyncio
async def test_classifier_pilir(mcp_server):
    """Classifier must return driky_piliru for bridge pier."""
    result = await mcp_server.call_tool(
        "classify_construction_element",
        {"name": "Mostní pilíře P2-P3, C35/45"},
    )
    data = result.structured_content
    assert data["element_type"] == "driky_piliru", (
        f"Expected 'driky_piliru', got '{data['element_type']}'. "
        f"Check app/mcp/tools/classifier.py KEYWORD_RULES."
    )
    assert data["confidence"] > 0.5


@pytest.mark.asyncio
async def test_classifier_rimsa(mcp_server):
    """Classifier must return rimsa for cornice."""
    result = await mcp_server.call_tool(
        "classify_construction_element",
        {"name": "Římsy monolitické, C30/37"},
    )
    data = result.structured_content
    assert data["element_type"] == "rimsa"


@pytest.mark.asyncio
async def test_classifier_mostovka_bridge_context(mcp_server):
    """Classifier must detect bridge context from SO-204 code."""
    result = await mcp_server.call_tool(
        "classify_construction_element",
        {"name": "NK deskový předpjatý", "object_code": "SO-204"},
    )
    data = result.structured_content
    assert data["element_type"] == "mostovkova_deska"
    assert data.get("is_bridge_context") is True


@pytest.mark.asyncio
async def test_classifier_response_fields(mcp_server):
    """Classifier response must have all required fields."""
    result = await mcp_server.call_tool(
        "classify_construction_element",
        {"name": "Stěna"},
    )
    data = result.structured_content
    required_fields = [
        "element_type", "label_cs", "confidence", "difficulty_factor",
        "rebar_ratio_kg_m3", "orientation", "recommended_formwork",
    ]
    for field in required_fields:
        assert field in data, (
            f"Classifier response missing '{field}'. "
            f"Got: {list(data.keys())}. "
            f"Check app/mcp/tools/classifier.py _classify() return."
        )


# ── Test: Tool 4 — calculate_concrete_works ──────────────────────────────────

@pytest.mark.asyncio
async def test_calculator_basic(mcp_server):
    """Calculator must return formwork, schedule, and rebar for a basic element."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "driky_piliru",
            "volume_m3": 24,
            "concrete_class": "C30/37",
            "height_m": 8.0,
        },
    )
    data = result.structured_content
    assert "formwork" in data, f"Missing 'formwork'. Got: {list(data.keys())}"
    assert "schedule" in data, f"Missing 'schedule'. Got: {list(data.keys())}"
    assert "rebar" in data, f"Missing 'rebar'. Got: {list(data.keys())}"
    assert data.get("num_tacts", 0) >= 2, "8m pier should have at least 2 tacts"


@pytest.mark.asyncio
async def test_calculator_mostovka(mcp_server):
    """Calculator for bridge deck must suggest bridge technology."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "mostovkova_deska",
            "volume_m3": 664,
            "concrete_class": "C30/37",
            "span_m": 31,
            "num_spans": 3,
        },
    )
    data = result.structured_content
    assert data.get("bridge_technology") is not None, (
        "Bridge deck calculation should include 'bridge_technology'"
    )


@pytest.mark.asyncio
async def test_calculator_formwork_override_rimsa_t(mcp_server):
    """Říms with formwork_system_name='Římsové bednění T' must surface the
    override + T-bednění unit (bm) + productivity hint, without erroring."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "rimsa",
            "volume_m3": 12.5,
            "concrete_class": "C30/37",
            "formwork_system_name": "Římsové bednění T",
            "rental_czk_override": 350.0,
            "formwork_length_bm": 156.0,
            "cycle_length_bm": 26.0,
        },
    )
    data = result.structured_content
    fw = data.get("formwork", {})
    assert fw.get("system") == "Římsové bednění T", (
        f"Expected formwork.system='Římsové bednění T', got {fw.get('system')!r}"
    )
    assert fw.get("source") in ("override", "monolit_planner_api"), (
        f"Expected formwork.source to flag the override, got {fw.get('source')!r}"
    )
    assert fw.get("unit") == "bm", (
        f"Říms T-bednění must report unit='bm', got {fw.get('unit')!r}"
    )
    assert fw.get("length_bm") == 156.0, (
        f"Expected formwork.length_bm=156, got {fw.get('length_bm')!r}"
    )
    assert fw.get("rental_czk_override") == 350.0
    assert fw.get("rental_unit") == "Kč/bm/měs"
    # cycle_length_bm=26 over 156 bm → 6 záběry
    assert data.get("num_tacts") == 6, (
        f"156 bm / 26 bm cycle should yield 6 záběry, got {data.get('num_tacts')}"
    )
    # Productivity hint should be echoed for T-bednění
    prod = fw.get("productivity", {})
    assert prod.get("assembly_h_per_bm") == 1.0
    assert prod.get("strip_h_per_bm") == 0.43


@pytest.mark.asyncio
async def test_calculator_formwork_override_mismatch_warning(mcp_server):
    """Specifying T-bednění for a foundation must emit a warning, not error."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "zaklady",  # foundation, not říms
            "volume_m3": 50,
            "concrete_class": "C25/30",
            "formwork_system_name": "Římsové bednění T",
        },
    )
    data = result.structured_content
    assert "warnings" in data, (
        "Semantic mismatch (T-bednění for foundation) must surface in 'warnings'"
    )
    joined = " ".join(data["warnings"])
    assert "Římsové bednění T" in joined, (
        f"Warning should name the offending system. Got: {data['warnings']!r}"
    )
    # Calculation must still complete — override is a hint, not a hard block
    assert "schedule" in data and "formwork" in data


@pytest.mark.asyncio
async def test_calculator_manufacturer_override_only(mcp_server):
    """preferred_manufacturer without formwork_system_name must rewrite the
    brand on the auto-selected system."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "stena",
            "volume_m3": 30,
            "concrete_class": "C25/30",
            "height_m": 2.8,
            "preferred_manufacturer": "PERI",
        },
    )
    data = result.structured_content
    fw = data.get("formwork", {})
    assert fw.get("manufacturer") == "PERI", (
        f"Expected manufacturer override to PERI, got {fw.get('manufacturer')!r}"
    )
    assert fw.get("source") in ("manufacturer_override", "monolit_planner_api")


@pytest.mark.asyncio
async def test_calculator_no_override_backward_compat(mcp_server):
    """Existing callers passing zero override fields must keep working
    unchanged. The override echo block reports None for every override."""
    result = await mcp_server.call_tool(
        "calculate_concrete_works",
        {
            "element_type": "stena",
            "volume_m3": 30,
            "concrete_class": "C25/30",
            "height_m": 2.8,
        },
    )
    data = result.structured_content
    assert data.get("formwork", {}).get("source") in (
        "auto", "monolit_planner_api"
    ), (
        "Without override fields, formwork.source must stay 'auto' "
        f"(or come from the live API). Got: {data.get('formwork')!r}"
    )
    inp = data.get("input", {})
    # The override fields are echoed with None when not supplied.
    for key in (
        "preferred_manufacturer", "formwork_system_name",
        "rental_czk_override", "formwork_length_bm", "cycle_length_bm",
    ):
        assert key in inp, f"input.{key} must be echoed for self-describing schema"
        assert inp[key] is None, (
            f"input.{key} must be None when override not supplied, "
            f"got {inp[key]!r}"
        )


# ── Test: Tool 5 — parse_construction_budget ─────────────────────────────────

@pytest.mark.asyncio
async def test_budget_parser_error_handling(mcp_server):
    """Budget parser with invalid base64 must return error, not crash."""
    result = await mcp_server.call_tool(
        "parse_construction_budget",
        {"file_base64": "not-valid-base64!", "filename": "test.xlsx"},
    )
    data = result.structured_content
    assert "error" in data or "items" in data, (
        "Budget parser must return either 'error' or 'items'"
    )


# ── Test: Tool 6 — analyze_construction_document ─────────────────────────────

@pytest.mark.asyncio
async def test_document_analyzer_error_handling(mcp_server):
    """Document analyzer with invalid base64 must return error, not crash."""
    result = await mcp_server.call_tool(
        "analyze_construction_document",
        {"file_base64": "not-valid-base64!", "filename": "test.pdf"},
    )
    data = result.structured_content
    assert "error" in data or "parameters" in data


# ── Test: Tool 7 — create_work_breakdown ─────────────────────────────────────

@pytest.mark.asyncio
async def test_breakdown_basic(mcp_server):
    """Work breakdown must return items with OTSKP codes for a bridge pier."""
    result = await mcp_server.call_tool(
        "create_work_breakdown",
        {
            "elements": [
                {"name": "Pilíř P1", "volume_m3": 24, "concrete_class": "C30/37"},
            ],
            "project_type": "most",
            "catalog": "otskp",
        },
    )
    data = result.structured_content
    assert "items" in data, f"Missing 'items'. Got: {list(data.keys())}"
    assert "total_items" in data
    assert data["total_items"] > 0, "Breakdown should generate at least 1 work item"

    item = data["items"][0]
    for field in ("work_description", "unit", "quantity", "element_type"):
        assert field in item, (
            f"Breakdown item missing '{field}'. Got: {list(item.keys())}."
        )


# ── Test: Tool 8 — get_construction_advisor ──────────────────────────────────

@pytest.mark.asyncio
async def test_advisor_basic(mcp_server):
    """Advisor must return formwork recommendation and relevant norms."""
    result = await mcp_server.call_tool(
        "get_construction_advisor",
        {"description": "Pilíř mostu, h=8m, C35/45"},
    )
    data = result.structured_content
    assert "formwork_recommendation" in data, (
        f"Missing 'formwork_recommendation'. Got: {list(data.keys())}"
    )
    assert "relevant_norms" in data
    assert "warnings" in data


# ── Test: Tool 9 — search_czech_construction_norms ───────────────────────────

@pytest.mark.asyncio
async def test_norms_search_structure(mcp_server):
    """Norms search must return answer + norms_referenced + sources."""
    result = await mcp_server.call_tool(
        "search_czech_construction_norms",
        {"query": "požadavky na bílou vanu"},
    )
    data = result.structured_content
    assert "answer" in data, f"Missing 'answer'. Got: {list(data.keys())}"
    assert "norms_referenced" in data
    assert "sources" in data
    assert "confidence" in data
