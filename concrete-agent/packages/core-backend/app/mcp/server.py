"""
STAVAGENT MCP Server v1.0

MCP (Model Context Protocol) server exposing Czech construction tools:
- OTSKP code lookup (17,904 verified catalog items)
- URS code search (via Perplexity + URS Matcher)
- Element classification (22 structural types)
- Concrete works calculator (7-engine pipeline)
- Construction document analysis (PDF/Excel)
- Czech construction norms search (Perplexity)
- Work breakdown generation
- Construction advisor

Architecture: FastMCP wraps existing STAVAGENT modules.
No new business logic — all tools delegate to existing code.
"""

import logging
from fastmcp import FastMCP

logger = logging.getLogger(__name__)

mcp = FastMCP(
    "STAVAGENT",
    instructions=(
        "České stavební nástroje pro analýzu rozpočtů, kalkulaci betonáže "
        "a vyhledávání v cenových soustavách OTSKP/ÚRS. "
        "AI modely české kataložní kódy neznají — tyto nástroje "
        "prohledávají reálné databáze 17 904 OTSKP a 39 000+ ÚRS položek."
    ),
)


# ── Tool 1: OTSKP Code Lookup ───────────────────────────────────────────────

from app.mcp.tools.otskp import find_otskp_code  # noqa: E402

mcp.tool()(find_otskp_code)


# ── Tool 2: URS Code Search ─────────────────────────────────────────────────

from app.mcp.tools.urs import find_urs_code  # noqa: E402

mcp.tool()(find_urs_code)


# ── Tool 3: Element Classifier ───────────────────────────────────────────────

from app.mcp.tools.classifier import classify_construction_element  # noqa: E402

mcp.tool()(classify_construction_element)


# ── Tool 4: Concrete Calculator ──────────────────────────────────────────────

from app.mcp.tools.calculator import calculate_concrete_works  # noqa: E402

mcp.tool()(calculate_concrete_works)


# ── Tool 4b: Pump cost calculator (TOV multi-supplier) ───────────────────────

from app.mcp.tools.calculator import calculate_pump  # noqa: E402

mcp.tool()(calculate_pump)


# ── Tool 5: Budget Parser ────────────────────────────────────────────────────

from app.mcp.tools.budget import parse_construction_budget  # noqa: E402

mcp.tool()(parse_construction_budget)


# ── Tool 6: Document Analyzer ────────────────────────────────────────────────

from app.mcp.tools.document import analyze_construction_document  # noqa: E402

mcp.tool()(analyze_construction_document)


# ── Tool 7: Work Breakdown ───────────────────────────────────────────────────

from app.mcp.tools.breakdown import create_work_breakdown  # noqa: E402

mcp.tool()(create_work_breakdown)


# ── Tool 8: Construction Advisor ─────────────────────────────────────────────

from app.mcp.tools.advisor import get_construction_advisor  # noqa: E402

mcp.tool()(get_construction_advisor)


# ── Tool 9: Czech Construction Norms Search ──────────────────────────────────

from app.mcp.tools.norms import search_czech_construction_norms  # noqa: E402

mcp.tool()(search_czech_construction_norms)


# ── Tool 10: UEP Universal Extraction Pipeline (PR2) ────────────────────────

from app.mcp.tools.uep import uep_run_extraction  # noqa: E402

mcp.tool()(uep_run_extraction)


# ── Tools 11-15: UEP read-only inspection (PR3) ─────────────────────────────

from app.mcp.tools.uep import (  # noqa: E402
    uep_get_coverage_matrix,
    uep_get_dwg_conversion_status,
    uep_get_job,
    uep_get_reconciliation_rules,
    uep_list_supported_formats,
)

mcp.tool()(uep_get_job)
mcp.tool()(uep_list_supported_formats)
mcp.tool()(uep_get_coverage_matrix)
mcp.tool()(uep_get_reconciliation_rules)
mcp.tool()(uep_get_dwg_conversion_status)


# ── Tool 16: Object Type Detector (W3b activated as a tool) ──────────────────

from app.mcp.tools.detect_object_type import detect_object_type  # noqa: E402

mcp.tool()(detect_object_type)


# ── Tool 17: Soupis Export (first deliverable — promotes the soupis script) ──

from app.mcp.tools.export import export_soupis  # noqa: E402

mcp.tool()(export_soupis)


# ── Tool 18: TZ field extractor (stage 1 — autonomy: raw TZ → recipe input) ──

from app.mcp.tools.extract_tz_fields import extract_tz_fields  # noqa: E402

mcp.tool()(extract_tz_fields)


# ── Tool 19: module walk_drawings (concept: host walks drawings) ─────────────
# Registered tool name = validate_drawing_element (Part B, P40 + P49).

from app.mcp.tools.walk_drawings import validate_drawing_element  # noqa: E402

mcp.tool()(validate_drawing_element)


# ── Startup policy-registry validation (PR2 — AC4) ──────────────────────────
# Every registered workflow tool MUST have a manifest. Validation runs at import
# (server startup) and raises RegistryValidationError on drift, so the server
# refuses to start with a clear message rather than enforcing against an
# incomplete registry. Non-workflow helpers (pump/advisor) and the UEP pipeline
# tools are billed + auth-gated but live outside the document→export state
# machine, so they are explicitly exempt (not yet stage-gated).

from app.services.stage_gating import (  # noqa: E402
    load_workflow_config,
    validate_registry,
)

_STAGE_GATING_EXEMPT_TOOLS = {
    "calculate_pump",
    "get_construction_advisor",
    "uep_run_extraction",
    "uep_get_job",
    "uep_list_supported_formats",
    "uep_get_coverage_matrix",
    "uep_get_reconciliation_rules",
    "uep_get_dwg_conversion_status",
    # validate_drawing_element is a deterministic grounding gate (Part B), not a
    # document→export state-machine stage — exempt like advisor/pump.
    "validate_drawing_element",
}

_REGISTERED_TOOL_NAMES = {
    "find_otskp_code",
    "find_urs_code",
    "classify_construction_element",
    "calculate_concrete_works",
    "calculate_pump",
    "parse_construction_budget",
    "analyze_construction_document",
    "create_work_breakdown",
    "get_construction_advisor",
    "search_czech_construction_norms",
    "uep_run_extraction",
    "uep_get_job",
    "uep_list_supported_formats",
    "uep_get_coverage_matrix",
    "uep_get_reconciliation_rules",
    "uep_get_dwg_conversion_status",
    "detect_object_type",
    "export_soupis",
    "extract_tz_fields",
    "validate_drawing_element",
}

validate_registry(
    load_workflow_config(),
    _REGISTERED_TOOL_NAMES,
    exempt=_STAGE_GATING_EXEMPT_TOOLS,
)
logger.info("[MCP] Stage-gating policy registry validated at startup.")
