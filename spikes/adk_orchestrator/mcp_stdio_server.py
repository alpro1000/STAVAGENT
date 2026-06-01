"""
ADK Spike — local stdio launcher for the existing STAVAGENT FastMCP server.

Exposes the SAME `mcp` object from app.mcp.server (all 16 registered tools,
including detect_object_type + export_soupis from #1278) over MCP **stdio** —
no HTTP, no auth middleware, zero contact with production. ADK's MCPToolset
spawns this as a subprocess and talks MCP over stdin/stdout.

Run standalone for a smoke check:
    PYTHONPATH=concrete-agent/packages/core-backend python spikes/adk_orchestrator/mcp_stdio_server.py
(it will block waiting for an MCP client on stdio).
"""

import os
import sys

# Make `app.*` importable when launched from anywhere.
_CORE_BACKEND = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "concrete-agent",
    "packages",
    "core-backend",
)
if _CORE_BACKEND not in sys.path:
    sys.path.insert(0, _CORE_BACKEND)

from app.mcp.server import mcp  # noqa: E402  — the live FastMCP server (all tools)

if __name__ == "__main__":
    # FastMCP stdio transport — the deterministic, auth-free path for the spike.
    mcp.run(transport="stdio")
