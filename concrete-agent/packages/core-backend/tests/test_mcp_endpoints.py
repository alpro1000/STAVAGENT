"""
Tests for MCP health + tools-listing endpoints.

- GET /mcp/health         — public, no auth (Cloud Run uptime checks)
- GET /api/v1/mcp/tools   — requires Bearer API key, returns 9 tools

These endpoints live in app/main.py and app/mcp/routes.py.

Auth-requiring tests need a live Postgres (DATABASE_URL set) with migration
007 applied — same contract as test_mcp_auth_postgres.py. They skip cleanly
when DATABASE_URL is unset so the health-only lane stays green.
"""

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mcp import auth as mcp_auth
from app.mcp.routes import TOOL_DESCRIPTIONS, TOOL_ORDER


_HAS_DB = bool(os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL"))
requires_db = pytest.mark.skipif(
    not _HAS_DB,
    reason="DATABASE_URL not set — auth-bound endpoint tests skipped",
)


@pytest.fixture
def client():
    return TestClient(app)


# ── /mcp/health (public) ────────────────────────────────────────────────────

def test_mcp_health_returns_200(client):
    response = client.get("/mcp/health")
    assert response.status_code == 200


def test_mcp_health_payload_shape(client):
    body = client.get("/mcp/health").json()
    assert body["status"] == "ok"
    assert isinstance(body["version"], str) and body["version"]
    assert body["tools"] == 9
    assert isinstance(body["mcp_available"], bool)
    assert isinstance(body["timestamp"], int) and body["timestamp"] > 0


def test_mcp_health_no_auth_required(client):
    # No Authorization header — must still succeed (Cloud Run probes).
    response = client.get("/mcp/health", headers={})
    assert response.status_code == 200


def test_mcp_health_head_supported(client):
    # HEAD is needed by some uptime probes.
    response = client.head("/mcp/health")
    assert response.status_code == 200


# ── /api/v1/mcp/tools (authenticated) ───────────────────────────────────────

@pytest.fixture
def api_key():
    """Create a throwaway API key against the live Postgres DB.

    Email is randomized per test so reruns against a persistent DB never
    collide on the unique(user_email) constraint.
    """
    email = f"tools-test-{uuid.uuid4().hex[:12]}@example.com"
    result = mcp_auth.register(
        email=email,
        password="testpass123",
        client_ip="127.0.0.1",
    )
    assert result.get("api_key"), result
    yield result["api_key"]


def test_tools_requires_auth(client):
    response = client.get("/api/v1/mcp/tools")
    assert response.status_code == 401


@requires_db
def test_tools_rejects_invalid_key(client):
    response = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": "Bearer sk-stavagent-invalid"},
    )
    assert response.status_code == 401


@requires_db
def test_tools_returns_all_nine(client, api_key):
    response = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 9
    assert len(body["tools"]) == 9

    names = [t["name"] for t in body["tools"]]
    assert names == TOOL_ORDER


@requires_db
def test_tools_item_shape(client, api_key):
    body = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    ).json()
    for tool in body["tools"]:
        assert set(tool.keys()) == {"name", "description", "cost_credits"}
        assert tool["description"] == TOOL_DESCRIPTIONS[tool["name"]]
        assert isinstance(tool["cost_credits"], int)
        assert tool["cost_credits"] >= 0


@requires_db
def test_tools_costs_match_billing_source_of_truth(client, api_key):
    body = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    ).json()
    for tool in body["tools"]:
        assert tool["cost_credits"] == mcp_auth.TOOL_COSTS[tool["name"]]


@requires_db
def test_tools_listing_does_not_consume_credits(client, api_key):
    before = mcp_auth.get_credits(api_key)["credits"]
    client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    after = mcp_auth.get_credits(api_key)["credits"]
    assert before == after


# ── CORS allow-list for third-party MCP clients ─────────────────────────────
#
# Added 2026-05-14: ChatGPT and Claude.ai initiate the OAuth flow from a
# browser pop-up served by their own origin. Without an explicit
# `Access-Control-Allow-Origin` reply from our `/.well-known/oauth-*` and
# `/api/v1/mcp/oauth/*` probes, the browser raises CORS_ERROR and the
# connector save flow aborts silently. The Origin allow-list lives in
# `app/main.py` next to the `CORSMiddleware` registration.

def test_cors_preflight_allows_claude_ai_origin(client):
    """Browser-issued CORS preflight from claude.ai must succeed."""
    r = client.options(
        "/.well-known/oauth-authorization-server",
        headers={
            "origin": "https://claude.ai",
            "access-control-request-method": "GET",
        },
    )
    # Starlette's CORSMiddleware returns 200 on a matched preflight.
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == "https://claude.ai"


def test_cors_preflight_allows_chatgpt_com_origin(client):
    """Same gate but for ChatGPT custom-connector pop-up."""
    r = client.options(
        "/.well-known/oauth-authorization-server",
        headers={
            "origin": "https://chatgpt.com",
            "access-control-request-method": "GET",
        },
    )
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == "https://chatgpt.com"


def test_cors_get_with_claude_origin_echoes_allow_origin(client):
    """Actual GET with `Origin: https://claude.ai` must carry the
    `Access-Control-Allow-Origin: https://claude.ai` response header so
    the browser exposes the JSON body to JavaScript."""
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"origin": "https://claude.ai"},
    )
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == "https://claude.ai"


def test_cors_unknown_origin_still_rejected(client):
    """The allow-list isn't a wildcard. A random origin must NOT get
    its value echoed back (the response either omits the header or
    sets it to a non-matching value)."""
    r = client.options(
        "/.well-known/oauth-authorization-server",
        headers={
            "origin": "https://evil.example",
            "access-control-request-method": "GET",
        },
    )
    # Starlette returns 400 for a rejected preflight.
    assert r.headers.get("access-control-allow-origin") != "https://evil.example"


# ── Expose-Headers for WWW-Authenticate (RFC 9728 browser-discovery) ────────
#
# Added 2026-05-14: ChatGPT's OAuth pop-up and Claude.ai's connector iframe
# both need to *read* the `WWW-Authenticate` response header from the 401 on
# /mcp/ to extract the `resource_metadata=<URL>` hint. Browser CORS hides
# response headers from JS by default — only the safe-listed set is
# exposed. Without `expose_headers=["WWW-Authenticate"]` in the
# CORSMiddleware config, the discovery chain breaks even though curl sees
# the header just fine (curl is not subject to the CORS expose-list rule).

def test_cors_exposes_www_authenticate_header(client):
    """Preflight + actual response must advertise `WWW-Authenticate` in
    `Access-Control-Expose-Headers` so claude.ai / chatgpt.com browser
    contexts can read it off the 401 from /mcp/."""
    # Hit a discovery endpoint with an Origin from the allowlist; the
    # Expose-Headers value is emitted on every CORS-eligible response,
    # regardless of which endpoint produced it.
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"origin": "https://claude.ai"},
    )
    assert r.status_code == 200, r.text
    expose = r.headers.get("access-control-expose-headers", "")
    # Header names in this list are comma-separated, case-insensitive.
    exposed = {h.strip().lower() for h in expose.split(",")}
    assert "www-authenticate" in exposed, (
        f"`WWW-Authenticate` not in Access-Control-Expose-Headers (got: {expose!r}) — "
        "browser-side discovery for ChatGPT/Claude.ai will fail."
    )


def test_cors_exposes_www_authenticate_on_401_mcp_response(client):
    """End-to-end: an anonymous POST to /mcp/ from a CORS-eligible
    origin must return both the `WWW-Authenticate` challenge AND the
    Expose-Headers list naming it, so a browser pop-up can read it."""
    r = client.post(
        "/mcp/",
        json={"jsonrpc": "2.0", "method": "ping", "id": 1},
        headers={"origin": "https://chatgpt.com"},
    )
    assert r.status_code == 401, r.text
    assert "Bearer" in r.headers.get("www-authenticate", "")
    expose = r.headers.get("access-control-expose-headers", "")
    exposed = {h.strip().lower() for h in expose.split(",")}
    assert "www-authenticate" in exposed, (
        f"401 from /mcp/ omits `WWW-Authenticate` from expose-headers (got: {expose!r})"
    )


# ── /mcp/ mount-level CORS (defensive double-wrap) ──────────────────────────
#
# Added 2026-05-14: the /mcp/ ASGI sub-app gets its OWN CORSMiddleware
# instance wrapped around MCPAuthChallengeMiddleware + MCPOriginMiddleware
# in app/main.py, in addition to the outer app-level CORSMiddleware. The
# motivation isn't that outer middlewares fail to wrap mounts — Starlette
# does wrap them — it's defence-in-depth: if a future middleware insertion
# order change or a FastMCP upgrade ever caused a missed pass at the outer
# layer, the mount-level wrap still guarantees the OAuth discovery
# headers reach the browser. Tests below pin both behaviours:
#
#   1. POST /mcp/ from claude.ai / chatgpt.com gets Access-Control-Allow-Origin
#      echoed back AND WWW-Authenticate exposed via expose-headers.
#   2. OPTIONS preflight for POST /mcp/ from those origins returns 200.

def test_mount_cors_post_mcp_with_claude_origin(client):
    """Anonymous POST /mcp/ from claude.ai must reply 401 (RFC 9728) with
    BOTH `Access-Control-Allow-Origin: https://claude.ai` AND
    `Access-Control-Expose-Headers` naming `WWW-Authenticate`. Browser JS
    in the connector pop-up depends on the combination to read the
    challenge."""
    r = client.post(
        "/mcp/",
        json={"jsonrpc": "2.0", "method": "ping", "id": 1},
        headers={"origin": "https://claude.ai"},
    )
    assert r.status_code == 401, r.text
    assert r.headers.get("access-control-allow-origin") == "https://claude.ai"
    expose = r.headers.get("access-control-expose-headers", "")
    assert "www-authenticate" in {h.strip().lower() for h in expose.split(",")}
    assert "Bearer" in r.headers.get("www-authenticate", "")


def test_mount_cors_post_mcp_with_chatgpt_origin(client):
    """Same check for chatgpt.com origin."""
    r = client.post(
        "/mcp/",
        json={"jsonrpc": "2.0", "method": "ping", "id": 1},
        headers={"origin": "https://chatgpt.com"},
    )
    assert r.status_code == 401, r.text
    assert r.headers.get("access-control-allow-origin") == "https://chatgpt.com"


def test_mount_cors_preflight_options_mcp(client):
    """Browser CORS preflight before POST /mcp/ must succeed (200) and
    carry the matching Access-Control-Allow-Origin so the actual POST is
    permitted to fire."""
    r = client.options(
        "/mcp/",
        headers={
            "origin": "https://claude.ai",
            "access-control-request-method": "POST",
            "access-control-request-headers": "authorization, content-type",
        },
    )
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == "https://claude.ai"


def test_mount_cors_rejects_unknown_origin_on_mcp(client):
    """The mount-level CORS isn't a wildcard — random origins get no
    matching `Access-Control-Allow-Origin` echo, so browser JS will
    refuse to expose the response. Server still returns the 401 + body
    (curl tests can read it), but the CORS gate stays closed."""
    r = client.post(
        "/mcp/",
        json={"jsonrpc": "2.0", "method": "ping", "id": 1},
        headers={"origin": "https://evil.example"},
    )
    assert r.headers.get("access-control-allow-origin") != "https://evil.example"
