"""
OAuth 2.0 Authorization Server Metadata helpers (RFC 8414 + OIDC Discovery).

ChatGPT custom connectors and Claude.ai MCP integrations probe the well-known
discovery endpoints before sending traffic. They refuse to register an MCP
server that doesn't expose these. This module is the metadata builder; the
actual route registrations live in `app/main.py` because they have to land
on the FastAPI app BEFORE `app.mount("/mcp", …)` so Starlette's route
resolution matches the explicit route before the mounted FastMCP ASGI app
swallows the path (same pattern as the existing `/mcp/health` endpoint).

Scope of this module:
- Returns the ADVERTISED token endpoint and supported grant types.
- Does NOT add any new grant types (authorization_code + PKCE are deliberate
  follow-up tasks). Today the MCP server supports `client_credentials` only
  via `POST /api/v1/mcp/oauth/token`, and that's exactly what we advertise.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover — type-only; avoids hard starlette dep at import time
    from starlette.requests import Request


def build_oauth_metadata(request: "Request") -> dict:
    """
    Build OAuth 2.0 Authorization Server Metadata payload (RFC 8414).

    The `issuer` and `token_endpoint` are computed from `request.base_url`
    so the same handler works in dev (http://localhost:8000), staging, and
    Cloud Run prod (https://concrete-agent-…run.app) without env coupling.

    Cloud Run note: requests come via the Google Front End proxy with
    `X-Forwarded-Proto: https`. Starlette honours that when the parent
    uvicorn is started with `--proxy-headers` / `--forwarded-allow-ips=*`,
    so `request.base_url.scheme` resolves to "https" in production.

    See:
      - RFC 8414 §3.2 (issuer required, must be HTTPS in prod)
      - OpenID Connect Discovery 1.0 (subset of RFC 8414 fields)
    """
    base = str(request.base_url).rstrip("/")
    return {
        "issuer": base,
        "token_endpoint": f"{base}/api/v1/mcp/oauth/token",
        "grant_types_supported": ["client_credentials"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_post",
            "client_secret_basic",
        ],
        "response_types_supported": ["token"],
        "scopes_supported": ["mcp:tools", "mcp:read"],
    }
