"""
Tests for MCPAuthChallengeMiddleware bearer-token routing + CORS on /mcp.

Gate 5 of the DCR rollout. Covers:

  - Dual-prefix Bearer routing (sat-* DCR / sk-stavagent-* legacy)
  - Lifecycle 401s (expired, revoked, unknown, malformed)
  - Active 401 gate (no Bearer at all)
  - AuthContext attachment to scope["state"]["mcp_auth"]
  - last_used_at bump on success
  - CORS preflight on the /mcp mount (allow-listed Origin → CORS
    headers; non-allow-listed Origin → no Access-Control-Allow-Origin)

The middleware is exercised in isolation (wrap a tiny ASGI app that
records what it received, then send requests via Starlette TestClient).
DB calls go through monkeypatch of resolve_bearer_token +
update_token_last_used so no Postgres is required.
"""

import json
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.mcp.middleware import MCPAuthChallengeMiddleware
from app.mcp import auth as mcp_auth


# ── Tiny ASGI inner app that records the scope it was called with ──────────


class _SpyInner:
    """Minimal ASGI app: records scope, returns 200 + JSON {ok:1}.

    We use this in place of FastMCP so the middleware-under-test runs
    in isolation. `last_scope` holds the scope from the most recent
    invocation so tests can assert AuthContext attachment.
    """

    def __init__(self):
        self.last_scope: dict[str, Any] | None = None
        self.calls = 0

    async def __call__(self, scope, receive, send):
        self.last_scope = scope
        self.calls += 1
        if scope["type"] != "http":
            return
        body = json.dumps({"ok": True, "calls": self.calls}).encode()
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [(b"content-type", b"application/json")],
        })
        await send({"type": "http.response.body", "body": body})


@pytest.fixture
def mw_client(monkeypatch):
    """TestClient wrapping the middleware over a spy inner app.

    `resolve_bearer_token` + `update_token_last_used` are monkeypatched.
    Test sets `state.resolve_result` per-case.
    """
    state = {
        "resolve_result": None,        # dict to return from resolve_bearer_token
        "resolve_calls": [],           # list of bearers passed
        "last_used_calls": [],         # list of token_row_ids bumped
    }

    def fake_resolve(token):
        state["resolve_calls"].append(token)
        return state["resolve_result"]

    def fake_bump(row_id):
        state["last_used_calls"].append(row_id)

    monkeypatch.setattr(mcp_auth, "resolve_bearer_token", fake_resolve)
    monkeypatch.setattr(mcp_auth, "update_token_last_used", fake_bump)

    spy = _SpyInner()
    app_mw = MCPAuthChallengeMiddleware(spy)

    # Wrap in a minimal Starlette app so TestClient can route.
    from starlette.applications import Starlette
    parent = Starlette()
    parent.mount("/mcp", app_mw)
    tc = TestClient(parent)
    tc.spy = spy  # type: ignore[attr-defined]
    tc.state = state  # type: ignore[attr-defined]
    return tc


# ── Active 401 gate (no Bearer at all) ──────────────────────────────────────


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
def test_no_bearer_returns_401_with_challenge(mw_client, method):
    resp = mw_client.request(method, "/mcp/")
    assert resp.status_code == 401
    assert "WWW-Authenticate" in resp.headers
    challenge = resp.headers["WWW-Authenticate"]
    assert challenge.startswith("Bearer ")
    assert 'realm="STAVAGENT MCP"' in challenge
    assert 'resource_metadata=' in challenge
    assert 'error="invalid_token"' in challenge
    # Inner app must NOT have been called
    assert mw_client.spy.calls == 0


def test_options_bypasses_auth_gate(mw_client):
    """OPTIONS goes through without Bearer so CORS preflight works."""
    resp = mw_client.options("/mcp/")
    # Without CORSMiddleware in front, the spy returns 200; the point
    # is the request was NOT 401'd by our gate.
    assert resp.status_code == 200
    assert mw_client.spy.calls == 1


# ── sat-* DCR path ──────────────────────────────────────────────────────────


def test_sat_token_ok_attaches_authcontext(mw_client):
    """Valid sat- token → scope.state.mcp_auth populated, inner called."""
    mw_client.state["resolve_result"] = {
        "status": "ok",
        "user_api_key": "sk-stavagent-" + "u" * 48,
        "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": "authorization_code",
        "scope": "mcp",
        "token_row_id": 42,
        "error_description": "",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "a" * 48},
    )
    assert resp.status_code == 200
    assert mw_client.spy.calls == 1

    auth_ctx = mw_client.spy.last_scope["state"]["mcp_auth"]
    assert auth_ctx["user_api_key"] == "sk-stavagent-" + "u" * 48
    assert auth_ctx["oauth_client_id"] == "dcr-" + "c" * 24
    assert auth_ctx["grant_type"] == "authorization_code"
    assert auth_ctx["scope"] == "mcp"

    # last_used_at bumped exactly once
    assert mw_client.state["last_used_calls"] == [42]


def test_sat_token_with_null_user_api_key_still_proceeds(mw_client):
    """Public-DCR token (user_api_key=None) → 200 + AuthContext attached.
    The 402 for paid tools is enforced downstream by check_credits."""
    mw_client.state["resolve_result"] = {
        "status": "ok",
        "user_api_key": None,  # public DCR
        "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": "client_credentials",
        "scope": None,
        "token_row_id": 99,
        "error_description": "",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "p" * 48},
    )
    assert resp.status_code == 200
    auth_ctx = mw_client.spy.last_scope["state"]["mcp_auth"]
    assert auth_ctx["user_api_key"] is None
    assert auth_ctx["oauth_client_id"] == "dcr-" + "c" * 24


def test_sat_token_expired_returns_401(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "expired",
        "user_api_key": None, "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": None, "scope": None, "token_row_id": 7,
        "error_description": "Access token expired. Use grant_type=refresh_token ...",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "e" * 48},
    )
    assert resp.status_code == 401
    assert mw_client.spy.calls == 0
    body = resp.json()
    assert body["error"] == "invalid_token"
    assert "expired" in body["error_description"].lower()
    # Hint about refresh_token must reach the broker via the header too
    assert "refresh_token" in resp.headers["WWW-Authenticate"]


def test_sat_token_revoked_returns_401(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "revoked",
        "user_api_key": None, "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": None, "scope": None, "token_row_id": 8,
        "error_description": "Access token has been revoked",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "r" * 48},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"] == "invalid_token"
    assert "revoked" in body["error_description"].lower()
    assert mw_client.spy.calls == 0


def test_sat_token_unknown_returns_401(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "unknown",
        "user_api_key": None, "oauth_client_id": None,
        "grant_type": None, "scope": None, "token_row_id": None,
        "error_description": "Access token not found",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "u" * 48},
    )
    assert resp.status_code == 401
    assert "not found" in resp.json()["error_description"].lower()


# ── sk-stavagent-* legacy path ──────────────────────────────────────────────


def test_legacy_api_key_ok_attaches_authcontext(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "ok",
        "user_api_key": "sk-stavagent-" + "L" * 48,
        "oauth_client_id": "legacy",
        "grant_type": "legacy_bearer",
        "scope": "*",
        "token_row_id": None,  # legacy doesn't write to mcp_oauth_tokens
        "error_description": "",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sk-stavagent-" + "L" * 48},
    )
    assert resp.status_code == 200
    auth_ctx = mw_client.spy.last_scope["state"]["mcp_auth"]
    assert auth_ctx["user_api_key"] == "sk-stavagent-" + "L" * 48
    assert auth_ctx["oauth_client_id"] == "legacy"
    assert auth_ctx["scope"] == "*"
    # No mcp_oauth_tokens row → no last_used bump
    assert mw_client.state["last_used_calls"] == []


def test_legacy_api_key_unknown_returns_401(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "unknown",
        "user_api_key": None, "oauth_client_id": None,
        "grant_type": None, "scope": None, "token_row_id": None,
        "error_description": "API key not found",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sk-stavagent-" + "z" * 48},
    )
    assert resp.status_code == 401


def test_legacy_api_key_deactivated_returns_401(mw_client):
    mw_client.state["resolve_result"] = {
        "status": "revoked",
        "user_api_key": None, "oauth_client_id": "legacy",
        "grant_type": None, "scope": None, "token_row_id": None,
        "error_description": "API key has been deactivated",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sk-stavagent-" + "d" * 48},
    )
    assert resp.status_code == 401
    assert "deactivated" in resp.json()["error_description"].lower()


# ── Malformed Bearer ────────────────────────────────────────────────────────


def test_wrong_prefix_returns_401(mw_client):
    """Bearer that doesn't start with sat- or sk-stavagent- → 401."""
    mw_client.state["resolve_result"] = {
        "status": "malformed",
        "user_api_key": None, "oauth_client_id": None,
        "grant_type": None, "scope": None, "token_row_id": None,
        "error_description": "Bearer prefix not recognized.",
    }
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer some-other-format-token"},
    )
    assert resp.status_code == 401
    assert "prefix" in resp.json()["error_description"].lower()


def test_non_bearer_auth_scheme_returns_401(mw_client):
    """Authorization: Basic ... → no Bearer extracted → 401 from gate."""
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Basic dXNlcjpwYXNz"},
    )
    assert resp.status_code == 401
    assert mw_client.spy.calls == 0
    # resolve_bearer_token must NOT have been called
    assert mw_client.state["resolve_calls"] == []


# ── Resolver crash → fail-open (defensive) ──────────────────────────────────


def test_resolver_crash_does_not_5xx(mw_client, monkeypatch):
    """If resolve_bearer_token raises, the gate must NOT 500 — fail open
    inside the middleware, attach a degraded AuthContext, downstream
    tools still reject paid calls via check_credits."""
    def boom(_token):
        raise RuntimeError("simulated DB outage")

    monkeypatch.setattr(mcp_auth, "resolve_bearer_token", boom)
    resp = mw_client.post(
        "/mcp/",
        headers={"authorization": "Bearer sat-" + "x" * 48},
    )
    # Middleware fails open so the response is whatever the inner spy
    # returned — 200 here, but the auth context surfaces _resolve_error.
    assert resp.status_code == 200
    auth_ctx = mw_client.spy.last_scope["state"]["mcp_auth"]
    assert auth_ctx["user_api_key"] is None


# ── CORS on the /mcp mount (separate concern, exercised end-to-end) ─────────


@pytest.fixture
def cors_mcp_client(monkeypatch):
    """Fresh app with the production CORS-on-mount wiring assembled
    around the spy. Mirrors the structure in main.py without pulling
    in fastmcp/KB loader/etc."""
    state = {"resolve_result": None}

    def fake_resolve(_t):
        return state["resolve_result"]

    monkeypatch.setattr(mcp_auth, "resolve_bearer_token", fake_resolve)
    monkeypatch.setattr(mcp_auth, "update_token_last_used", lambda *_: None)

    spy = _SpyInner()
    mcp_inner = MCPAuthChallengeMiddleware(spy)
    mcp_with_cors = CORSMiddleware(
        app=mcp_inner,
        allow_origins=[
            "https://claude.ai",
            "https://chatgpt.com",
            "https://chat.openai.com",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Mcp-Session-Id"],
        expose_headers=["WWW-Authenticate"],
        max_age=86400,
    )

    from starlette.applications import Starlette
    parent = Starlette()
    parent.mount("/mcp", mcp_with_cors)
    tc = TestClient(parent)
    tc.state = state  # type: ignore[attr-defined]
    return tc


def test_cors_preflight_from_claude_ai(cors_mcp_client):
    """OPTIONS from https://claude.ai with full preflight headers →
    200 + Access-Control-Allow-* headers populated."""
    resp = cors_mcp_client.options(
        "/mcp/",
        headers={
            "origin": "https://claude.ai",
            "access-control-request-method": "POST",
            "access-control-request-headers": "Authorization, Content-Type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "https://claude.ai"
    assert "POST" in resp.headers["access-control-allow-methods"]
    assert "Authorization" in resp.headers["access-control-allow-headers"]
    assert resp.headers["access-control-allow-credentials"] == "true"
    assert resp.headers["access-control-max-age"] == "86400"


def test_cors_preflight_from_chatgpt(cors_mcp_client):
    resp = cors_mcp_client.options(
        "/mcp/",
        headers={
            "origin": "https://chatgpt.com",
            "access-control-request-method": "POST",
            "access-control-request-headers": "Authorization",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "https://chatgpt.com"


def test_cors_preflight_disallowed_origin(cors_mcp_client):
    """Non-allow-listed Origin → preflight responds but does NOT echo
    Access-Control-Allow-Origin, so the browser blocks the actual request."""
    resp = cors_mcp_client.options(
        "/mcp/",
        headers={
            "origin": "https://evil.attacker.com",
            "access-control-request-method": "POST",
        },
    )
    # Starlette CORSMiddleware returns 400 for disallowed origins in
    # preflight; either way, the critical assertion is no ACAO header.
    assert "access-control-allow-origin" not in {
        k.lower() for k in resp.headers.keys()
    }


def test_cors_actual_request_succeeds_for_allowed_origin(cors_mcp_client):
    """Real (non-preflight) request from claude.ai → Bearer flow runs,
    ACAO header attached to the response."""
    cors_mcp_client.state["resolve_result"] = {
        "status": "ok",
        "user_api_key": "sk-stavagent-" + "u" * 48,
        "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": "authorization_code",
        "scope": "mcp",
        "token_row_id": 1,
        "error_description": "",
    }
    resp = cors_mcp_client.post(
        "/mcp/",
        headers={
            "origin": "https://claude.ai",
            "authorization": "Bearer sat-" + "a" * 48,
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "https://claude.ai"
    assert "WWW-Authenticate" in resp.headers.get(
        "access-control-expose-headers", "")


def test_cors_disallowed_origin_no_acao_on_actual_request(cors_mcp_client):
    """Even a successful 200 to an evil origin must NOT carry ACAO —
    that's what stops the browser from exposing the body to JS."""
    cors_mcp_client.state["resolve_result"] = {
        "status": "ok",
        "user_api_key": "sk-stavagent-" + "u" * 48,
        "oauth_client_id": "dcr-" + "c" * 24,
        "grant_type": "authorization_code", "scope": "mcp",
        "token_row_id": 1, "error_description": "",
    }
    resp = cors_mcp_client.post(
        "/mcp/",
        headers={
            "origin": "https://evil.attacker.com",
            "authorization": "Bearer sat-" + "a" * 48,
        },
    )
    # The request itself can succeed (CORS only governs browser
    # consumption of the response) — the critical defence is the
    # absent ACAO so the attacker's JS can't read the body.
    assert resp.status_code == 200
    headers_lower = {k.lower() for k in resp.headers.keys()}
    assert "access-control-allow-origin" not in headers_lower


# ── check_credits 402 path for null user_api_key (auth.py extension) ────────


def test_check_credits_null_user_api_key_paid_tool_returns_402():
    """user_api_key=None + paid tool → 402 user_consent_required.

    This is the bridge between the middleware (which attaches
    AuthContext with user_api_key=None for public-DCR client_credentials
    tokens) and the tool wrappers (which call check_credits to debit).
    """
    result = mcp_auth.check_credits(api_key=None, tool_name="find_urs_code")
    assert result["ok"] is False
    assert result["http_status"] == 402
    assert result["error_code"] == "user_consent_required"
    assert "authorization_code" in result["error"]


def test_check_credits_null_user_api_key_free_tool_returns_200():
    """user_api_key=None + free tool → still 200 (free tools are public)."""
    result = mcp_auth.check_credits(api_key=None, tool_name="find_otskp_code")
    assert result["ok"] is True
    assert result["cost"] == 0


def test_check_credits_empty_string_api_key_legacy_path():
    """Empty-string api_key (not None) is the unauthenticated-request
    case from existing callers — must keep the legacy 'register at …'
    hint, NOT the user_consent_required path."""
    result = mcp_auth.check_credits(api_key="", tool_name="find_urs_code")
    assert result["ok"] is False
    assert "Register at" in result["error"]
    assert "http_status" not in result  # 401-like, not 402
