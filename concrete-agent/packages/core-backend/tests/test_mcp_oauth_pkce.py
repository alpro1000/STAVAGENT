"""
Tests for OAuth 2.0 authorization_code + PKCE on the MCP API.

Endpoints under test:
  GET  /.well-known/oauth-authorization-server  — public discovery
  GET  /.well-known/openid-configuration        — same payload
  GET  /api/v1/mcp/oauth/authorize              — 302 redirect with code
  POST /api/v1/mcp/oauth/token                  — code → access_token

Requires:
  - DATABASE_URL pointing at Postgres with migrations 007 + 008 applied
  - MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT=1 so the test redirect_uri
    `http://localhost:9999/callback` is accepted by the allowlist

Tests skip cleanly when DATABASE_URL is unset.
"""

import base64
import hashlib
import os
import secrets
import time
import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mcp import auth as mcp_auth
from app.mcp import oauth_codes as mcp_oauth_codes


_HAS_DB = bool(os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL"))
requires_db = pytest.mark.skipif(
    not _HAS_DB,
    reason="DATABASE_URL not set — OAuth PKCE tests skipped",
)


@pytest.fixture(autouse=True)
def _enable_localhost_redirect(monkeypatch):
    """Force the dev-mode localhost allowlist so the fixture redirect_uri
    works regardless of how the surrounding shell is configured."""
    monkeypatch.setenv("MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT", "1")


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Auth/login rate-limit bucket is process-wide and per-IP. Tests in
    other files (notably test_mcp_auth_postgres.py) burn through the 10
    /60 s budget for `127.0.0.1`, so by the time this file's `api_key`
    fixture calls `register()` the IP is over quota and `register()`
    returns `{"status": "rate_limited"}` instead of an api_key. Same
    autouse pattern as test_mcp_auth_postgres.py."""
    mcp_auth._rate_limit_store.clear()
    yield
    mcp_auth._rate_limit_store.clear()


@pytest.fixture
def client():
    # follow_redirects=False — we want to inspect the 302 from /authorize
    return TestClient(app, follow_redirects=False)


@pytest.fixture
def api_key():
    """Throwaway API key against the live DB."""
    if not _HAS_DB:
        pytest.skip("no DB")
    email = f"oauth-test-{uuid.uuid4().hex[:12]}@example.com"
    result = mcp_auth.register(
        email=email, password="testpass123", client_ip="127.0.0.1",
    )
    assert result.get("api_key"), result
    return result["api_key"]


def _make_pkce_pair():
    """Build a (code_verifier, code_challenge) S256 pair per RFC 7636."""
    verifier = secrets.token_urlsafe(64)  # >43 chars, RFC-compliant
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


REDIRECT = "http://localhost:9999/callback"


# ── Discovery (public, no auth, no DB) ──────────────────────────────────────

def test_discovery_oauth_authorization_server_returns_200(client):
    r = client.get("/.well-known/oauth-authorization-server")
    assert r.status_code == 200
    body = r.json()
    assert body["authorization_endpoint"].endswith("/api/v1/mcp/oauth/authorize")
    assert body["token_endpoint"].endswith("/api/v1/mcp/oauth/token")
    assert "authorization_code" in body["grant_types_supported"]
    assert "client_credentials" in body["grant_types_supported"]
    assert body["response_types_supported"] == ["code"]
    assert body["code_challenge_methods_supported"] == ["S256"]


def test_discovery_openid_configuration_mirrors_oauth_payload(client):
    a = client.get("/.well-known/oauth-authorization-server").json()
    b = client.get("/.well-known/openid-configuration").json()
    assert a == b


def test_discovery_oauth_authorization_server_route_registered(client):
    """RFC 8414 alias must respond 200, NOT 404. Regression test:
    ChatGPT custom connectors and Claude.ai check this URI first; if it
    404s they fall back to a legacy OAuth flow without PKCE that this
    server (correctly) rejects with 422 missing code_challenge. Both
    routes are wired through one handler with two `@app.get(...)`
    decorators precisely to prevent this from happening again."""
    r = client.get("/.well-known/oauth-authorization-server")
    assert r.status_code == 200, (
        f"RFC 8414 alias missing — ChatGPT/Claude.ai will fall through to "
        f"PKCE-less legacy flow. Status: {r.status_code}"
    )


def test_discovery_both_routes_honour_x_forwarded_proto(client):
    """X-Forwarded-Proto rewriting must apply to both well-known URIs —
    a previous version had separate handler functions and only the
    refactor on this branch guarantees they share the same code path."""
    a = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-proto": "https", "host": "x.example"},
    ).json()
    b = client.get(
        "/.well-known/openid-configuration",
        headers={"x-forwarded-proto": "https", "host": "x.example"},
    ).json()
    assert a == b
    for body in (a, b):
        assert body["issuer"].startswith("https://"), body["issuer"]
        assert body["authorization_endpoint"].startswith("https://")
        assert body["token_endpoint"].startswith("https://")


def test_discovery_issuer_uses_request_origin(client):
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"host": "example.test"},
    )
    body = r.json()
    # TestClient preserves the Host header; issuer should reflect it
    assert body["issuer"].endswith("example.test") or "example.test" in body["issuer"]


def test_discovery_honours_x_forwarded_proto_https(client):
    """Cloud Run terminates TLS at the edge — forwards plain HTTP to the
    container with X-Forwarded-Proto: https. ChatGPT + Claude.ai reject
    connectors whose discovery JSON advertises http:// endpoints, so the
    handler must rewrite the scheme from the hop header."""
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-proto": "https",
                 "host": "concrete-agent.example.com"},
    )
    body = r.json()
    assert body["issuer"].startswith("https://"), body["issuer"]
    assert body["authorization_endpoint"].startswith("https://"), \
        body["authorization_endpoint"]
    assert body["token_endpoint"].startswith("https://"), body["token_endpoint"]


def test_discovery_x_forwarded_proto_chain_picks_first():
    """A multi-hop chain like `https,http` (uncommon, but possible behind
    nested proxies) must use the first entry — that's the client-facing
    scheme per RFC 7239 / the de-facto X-Forwarded-Proto convention."""
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app, follow_redirects=False)
    r = c.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-proto": "https, http",
                 "host": "concrete-agent.example.com"},
    )
    assert r.json()["issuer"].startswith("https://")


def test_discovery_falls_back_to_request_scheme_without_header(client):
    """Local dev (uvicorn directly, no proxy) sends no X-Forwarded-Proto,
    so the handler must keep working with the request's own scheme."""
    r = client.get("/.well-known/oauth-authorization-server")
    body = r.json()
    # TestClient defaults to http://testserver; no proxy header → http
    assert body["issuer"].startswith("http://"), body["issuer"]


def test_discovery_ignores_garbage_x_forwarded_proto(client):
    """Defence-in-depth: if a compromised intermediary or a misconfigured
    proxy sends `X-Forwarded-Proto: gopher` we must NOT advertise that.
    Fall back to the request's own scheme."""
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-proto": "gopher"},
    )
    body = r.json()
    assert body["issuer"].startswith("http://"), body["issuer"]


# ── /authorize parameter validation ─────────────────────────────────────────

def test_authorize_rejects_wrong_response_type(client):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "token",
        "client_id": "sk-stavagent-fake",
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "unsupported_response_type"


def test_authorize_rejects_plain_pkce(client):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": "sk-stavagent-fake",
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "plain",
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_request"


def test_authorize_rejects_redirect_uri_not_in_allowlist(client):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": "sk-stavagent-fake",
        "redirect_uri": "https://evil.example.com/cb",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_request"


def test_authorize_allows_chatgpt_redirect_uri(client, api_key):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": "https://chatgpt.com/connector/oauth/abc123",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    assert r.status_code == 302
    parsed = urlparse(r.headers["location"])
    assert parsed.netloc == "chatgpt.com"
    assert "code" in parse_qs(parsed.query)


def test_authorize_allows_claude_redirect_uri(client, api_key):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": "https://claude.ai/api/mcp/auth_callback?foo=bar",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    assert r.status_code == 302
    assert "claude.ai" in r.headers["location"]


# ── /authorize happy path ───────────────────────────────────────────────────

@requires_db
def test_authorize_returns_302_with_code_and_state(client, api_key):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": REDIRECT,
        "state": "xyz-state-789",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    assert r.status_code == 302
    parsed = urlparse(r.headers["location"])
    qs = parse_qs(parsed.query)
    assert qs["state"] == ["xyz-state-789"]
    assert len(qs["code"][0]) >= 32  # URL-safe 32-byte secret


@requires_db
def test_authorize_unknown_client_id_redirects_with_error(client):
    _, challenge = _make_pkce_pair()
    r = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": "sk-stavagent-doesnotexist",
        "redirect_uri": REDIRECT,
        "state": "abc",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    # redirect_uri IS valid → return error via redirect (RFC §4.1.2.1)
    assert r.status_code == 302
    qs = parse_qs(urlparse(r.headers["location"]).query)
    assert qs["error"] == ["unauthorized_client"]
    assert qs["state"] == ["abc"]


# ── /token authorization_code grant ─────────────────────────────────────────

@requires_db
def test_token_authorization_code_happy_path(client, api_key):
    verifier, challenge = _make_pkce_pair()
    auth = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    code = parse_qs(urlparse(auth.headers["location"]).query)["code"][0]

    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": verifier,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == api_key
    assert body["token_type"] == "bearer"


@requires_db
def test_token_wrong_code_verifier_rejected(client, api_key):
    _, challenge = _make_pkce_pair()
    auth = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    code = parse_qs(urlparse(auth.headers["location"]).query)["code"][0]

    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": "wrong-verifier-" + secrets.token_urlsafe(32),
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_grant"


@requires_db
def test_token_code_reuse_rejected(client, api_key):
    verifier, challenge = _make_pkce_pair()
    auth = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    code = parse_qs(urlparse(auth.headers["location"]).query)["code"][0]

    ok = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": verifier,
    })
    assert ok.status_code == 200

    again = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": verifier,
    })
    assert again.status_code == 400
    assert again.json()["detail"]["error"] == "invalid_grant"
    assert "already used" in again.json()["detail"]["error_description"].lower()


@requires_db
def test_token_redirect_uri_mismatch_rejected(client, api_key):
    verifier, challenge = _make_pkce_pair()
    auth = client.get("/api/v1/mcp/oauth/authorize", params={
        "response_type": "code",
        "client_id": api_key,
        "redirect_uri": REDIRECT,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    code = parse_qs(urlparse(auth.headers["location"]).query)["code"][0]

    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        # Different (but still allow-listed) redirect_uri
        "redirect_uri": "http://localhost:8888/different",
        "code_verifier": verifier,
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_request"


@requires_db
def test_token_expired_code_rejected(client, api_key, monkeypatch):
    """Manually shrink the TTL so the code expires before exchange."""
    _, challenge = _make_pkce_pair()
    # Bypass the route and call generate_code directly with a 0-second TTL
    # — that's already in the past by the time consume_code runs.
    code = mcp_oauth_codes.generate_code(
        client_id=api_key,
        redirect_uri=REDIRECT,
        code_challenge=challenge,
        ttl_seconds=0,
    )
    # Be paranoid about timing: sleep 100 ms to ensure NOW() has advanced.
    time.sleep(0.1)
    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": "irrelevant-not-checked-when-expired-but-required",
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_grant"
    assert "expired" in r.json()["detail"]["error_description"].lower()


@requires_db
def test_token_unknown_code_rejected(client):
    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": "totally-made-up-code",
        "redirect_uri": REDIRECT,
        "code_verifier": secrets.token_urlsafe(32),
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_grant"


# ── Backward compat: client_credentials still works ─────────────────────────

@requires_db
def test_token_client_credentials_still_works(client, api_key):
    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": api_key,
        "client_secret": "",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == api_key
    assert body["token_type"] == "bearer"


def test_token_unsupported_grant_type_rejected(client):
    r = client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "password",
        "client_id": "sk-stavagent-x",
    })
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "unsupported_grant_type"


# ── Allowlist helper unit tests ─────────────────────────────────────────────

def test_allowlist_helper_rejects_random_https():
    assert not mcp_oauth_codes.is_allowed_redirect_uri("https://evil.example/cb")


def test_allowlist_helper_accepts_chatgpt_prefix():
    assert mcp_oauth_codes.is_allowed_redirect_uri(
        "https://chatgpt.com/connector/oauth/abc"
    )


def test_allowlist_helper_accepts_claude_prefix():
    assert mcp_oauth_codes.is_allowed_redirect_uri(
        "https://claude.ai/api/mcp/auth_callback?state=x"
    )


def test_allowlist_helper_localhost_gated_by_env(monkeypatch):
    monkeypatch.delenv("MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT", raising=False)
    assert not mcp_oauth_codes.is_allowed_redirect_uri("http://localhost:9999/cb")
    monkeypatch.setenv("MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT", "1")
    assert mcp_oauth_codes.is_allowed_redirect_uri("http://localhost:9999/cb")
