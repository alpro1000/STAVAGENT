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


def test_discovery_issuer_uses_request_origin(client):
    r = client.get(
        "/.well-known/oauth-authorization-server",
        headers={"host": "example.test"},
    )
    body = r.json()
    # TestClient preserves the Host header; issuer should reflect it
    assert body["issuer"].endswith("example.test") or "example.test" in body["issuer"]


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


# ── PKCE input hardening (CWE-20 / CWE-755 from amazon-q PR review) ─────────

def test_pkce_s256_helper_rejects_non_ascii_verifier():
    """Non-ASCII code_verifier violates RFC 7636 §4.1 — helper must
    raise ValueError so the caller can map it to invalid_grant instead
    of leaking a UnicodeEncodeError 500."""
    with pytest.raises(ValueError):
        mcp_oauth_codes._pkce_s256("verifier-with-emoji-🚀")


@requires_db
def test_token_non_ascii_verifier_returns_invalid_grant(client, api_key):
    """End-to-end: non-ASCII verifier on /token produces a 400
    invalid_grant indistinguishable from a genuine digest mismatch
    (CWE-20). No 500, no traceback in the response."""
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
        "code_verifier": "verifier-with-emoji-🚀",
    })
    assert r.status_code == 400
    body = r.json()
    assert body["detail"]["error"] == "invalid_grant"
    assert body["detail"]["error_description"] == "code_verifier mismatch"


# ── /authorize rate limiting (CWE-307 from amazon-q PR review) ──────────────

def test_authorize_rate_limit_after_burst(client):
    """11th /authorize call from the same IP within 60 s returns 429
    so an attacker can't enumerate API keys by spraying random
    client_id values."""
    _, challenge = _make_pkce_pair()
    params = {
        "response_type": "code",
        "client_id": "sk-stavagent-doesnotexist",
        "redirect_uri": "https://chatgpt.com/connector/oauth/probe",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    # First RATE_LIMIT_MAX (10) requests pass the bucket. The
    # in-memory store is reset by the autouse fixture so we start at 0.
    for _ in range(mcp_auth.RATE_LIMIT_MAX):
        # Each may 302 (allowlisted redirect_uri + missing client_id →
        # error redirect) or 400 — what matters is that the bucket fills.
        client.get("/api/v1/mcp/oauth/authorize", params=params)

    r = client.get("/api/v1/mcp/oauth/authorize", params=params)
    assert r.status_code == 429
    assert r.json()["detail"]["error"] == "temporarily_unavailable"
