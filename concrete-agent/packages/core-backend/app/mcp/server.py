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
