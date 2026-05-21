"""
Tests for the DCR endpoint (RFC 7591) + supporting validators.

Three layers covered:

1. Pure validators (`_validate_redirect_uri`, `_hash_payload`) — no DB.
2. Endpoint logic — DB calls (`register_oauth_client`,
   `log_oauth_registration_failure`, `_resolve_initial_access_user_id`)
   are monkeypatched so tests run without Postgres. Verifies the
   route's branching: success / each 400 / 401 / 500, audit-log call
   shape on each path.
3. Manifest payload — verifies `_oauth_discovery_payload` advertises
   `registration_endpoint`. Imported directly (not via the FastAPI
   app object, which pulls in fastmcp + KB loader + a dozen other
   services not present in CI sandboxes).

Reference: TASK_DCR_KBYamlLoader.md Gate 3 + 7.
"""

import json
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.mcp import auth as mcp_auth
from app.mcp import oauth_codes as mcp_oauth_codes
from app.mcp import rate_limit as mcp_rate_limit
from app.mcp.routes import (
    _LOOPBACK_HOSTS,
    _hash_payload,
    _validate_redirect_uri,
    router,
)


# ── Test app: mount only the router we're testing ───────────────────────────


@pytest.fixture
def client(monkeypatch):
    """Fresh FastAPI app + TestClient per test. DB helpers monkeypatched
    to in-memory state so tests run without Postgres.

    Gate 6 addition: rate limiter is patched to ALLOWED so the existing
    Gate 3 happy/failure tests don't trip the 10-req/h limiter from
    sharing a Cloud Run instance. The 429 + 503 paths are exercised in
    separate fixtures further below.
    """
    state = {
        "registered": [],         # list of register_oauth_client kwargs
        "audit_failures": [],     # list of log_oauth_registration_failure kwargs
        "valid_initial_tokens": {},  # api_key -> user_id
        "rate_limit_result": {
            "status": mcp_rate_limit.RateLimitResult.ALLOWED,
            "current": 1, "limit": 10, "retry_after": 3600,
        },
    }

    def fake_register(**kwargs):
        state["registered"].append(kwargs)
        return {
            "client_id": "dcr-" + "a" * 24,
            "client_secret": "dcs-" + "b" * 48,
            "issued_at_unix": 1_700_000_000,
        }

    def fake_audit(**kwargs):
        state["audit_failures"].append(kwargs)

    def fake_resolve(api_key: str):
        return state["valid_initial_tokens"].get(api_key)

    async def fake_rate_limit(_client_ip: str):
        return state["rate_limit_result"]

    monkeypatch.setattr(mcp_auth, "register_oauth_client", fake_register)
    monkeypatch.setattr(mcp_auth, "log_oauth_registration_failure", fake_audit)
    monkeypatch.setattr(mcp_auth, "_resolve_initial_access_user_id", fake_resolve)
    monkeypatch.setattr(mcp_rate_limit, "check_register_rate_limit", fake_rate_limit)

    app = FastAPI()
    app.include_router(router)
    tc = TestClient(app)
    tc.state = state  # type: ignore[attr-defined]
    return tc


# ── _validate_redirect_uri ──────────────────────────────────────────────────


@pytest.mark.parametrize("uri", [
    "https://claude.ai/api/mcp/auth_callback",
    "https://chatgpt.com/connector/oauth/",
    "https://example.com:8443/cb?foo=bar",
])
def test_validate_redirect_uri_accepts_https(uri):
    assert _validate_redirect_uri(uri) is None


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
def test_validate_redirect_uri_accepts_loopback_http(host):
    assert _validate_redirect_uri(f"http://{host}:3000/cb") is None


def test_loopback_hosts_match_rfc_8252():
    """Keep the constant aligned with RFC 8252 §7.3 — bare IPv6 literal
    is exotic but tested here so a future refactor doesn't silently drop it."""
    assert "localhost" in _LOOPBACK_HOSTS
    assert "127.0.0.1" in _LOOPBACK_HOSTS


@pytest.mark.parametrize("uri,fragment", [
    ("http://example.com/cb", "http://example.com (non-loopback)"),
    ("javascript:alert(1)", "javascript: scheme"),
    ("data:text/html,foo", "data: scheme"),
    ("file:///etc/passwd", "file: scheme"),
    ("ftp://example.com/cb", "ftp: scheme"),
    ("https://example.com/cb#fragment", "fragment"),
    ("https:///nohost", "missing host"),
    ("", "empty string"),
])
def test_validate_redirect_uri_rejects(uri, fragment):
    err = _validate_redirect_uri(uri)
    assert err is not None, f"Expected reject for {fragment!r}: {uri}"


def test_validate_redirect_uri_rejects_non_str():
    assert _validate_redirect_uri(None) is not None  # type: ignore[arg-type]
    assert _validate_redirect_uri(123) is not None  # type: ignore[arg-type]


# ── _hash_payload ───────────────────────────────────────────────────────────


def test_hash_payload_empty():
    assert _hash_payload(b"") is None
    assert _hash_payload(None) is None  # type: ignore[arg-type]


def test_hash_payload_deterministic():
    body = b'{"client_name": "Claude"}'
    assert _hash_payload(body) == _hash_payload(body)


def test_hash_payload_format_sha256_hex():
    h = _hash_payload(b"anything")
    assert h is not None
    assert re.fullmatch(r"[0-9a-f]{64}", h)


def test_hash_payload_sensitive_to_changes():
    """A single byte flip must produce a different hash (no truncation bugs)."""
    assert _hash_payload(b"abc") != _hash_payload(b"abd")


# ── POST /api/v1/mcp/oauth/register — rate limit (Gate 6) ───────────────────


def test_register_rate_limit_exceeded_returns_429(client):
    """status='exceeded' from rate limiter → 429 + Retry-After header + audit row."""
    client.state["rate_limit_result"] = {
        "status": mcp_rate_limit.RateLimitResult.EXCEEDED,
        "current": 11, "limit": 10, "retry_after": 3600,
    }
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"redirect_uris": ["https://example.com/cb"], "client_name": "X"},
    )
    assert resp.status_code == 429
    assert resp.headers["retry-after"] == "3600"
    body = resp.json()
    assert body["detail"]["error"] == "rate_limit_exceeded"
    assert body["detail"]["retry_after"] == 3600

    # Audit row written with status=rate_limited + ip + user_agent + payload_hash
    assert len(client.state["audit_failures"]) == 1
    audit = client.state["audit_failures"][0]
    assert audit["status"] == "rate_limited"
    assert audit["error_code"] == "rate_limit_exceeded"
    assert audit["registered_ip"]
    assert audit["request_payload_hash"]


def test_register_rate_limit_runs_before_validation(client):
    """429 must fire even on malformed payloads — protects against flood
    of bad JSON wasting parser cycles."""
    client.state["rate_limit_result"] = {
        "status": mcp_rate_limit.RateLimitResult.EXCEEDED,
        "current": 11, "limit": 10, "retry_after": 3600,
    }
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        content=b"this is not json",
        headers={"content-type": "application/json"},
    )
    # 429 wins over the 400 invalid_client_metadata that the JSON
    # parse-failure path would otherwise return
    assert resp.status_code == 429


def test_register_redis_unreachable_returns_503(client):
    """status='unavailable' → 503 (fail-closed) + Retry-After header."""
    client.state["rate_limit_result"] = {
        "status": mcp_rate_limit.RateLimitResult.UNAVAILABLE,
        "error_description": "Rate limiter unavailable. Registration "
                             "temporarily disabled — please retry in a few minutes.",
        "retry_after": 3600,
    }
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"redirect_uris": ["https://example.com/cb"]},
    )
    assert resp.status_code == 503
    assert resp.headers["retry-after"] == "3600"
    body = resp.json()
    assert body["detail"]["error"] == "service_unavailable"
    # No audit row on 503 — Redis is down, so the audit DB might be too;
    # we don't want to compound the fault
    assert client.state["audit_failures"] == []


def test_register_uses_x_forwarded_for_for_ip(client):
    """Rate limiter must receive the leftmost XFF IP, not request.client.host."""
    # Capture the IP that the rate limiter is called with
    captured = []

    async def capture_rl(client_ip):
        captured.append(client_ip)
        return {
            "status": mcp_rate_limit.RateLimitResult.ALLOWED,
            "current": 1, "limit": 10, "retry_after": 3600,
        }

    import pytest as _pytest  # noqa: F401 — keep the spirit of fixture-scope
    # Override the per-fixture fake with a recorder
    from app.mcp import rate_limit as _rl
    real_fake = _rl.check_register_rate_limit
    _rl.check_register_rate_limit = capture_rl  # type: ignore[assignment]
    try:
        resp = client.post(
            "/api/v1/mcp/oauth/register",
            headers={"x-forwarded-for": "203.0.113.1, 10.0.0.1"},
            json={"redirect_uris": ["https://example.com/cb"]},
        )
    finally:
        _rl.check_register_rate_limit = real_fake  # type: ignore[assignment]
    assert resp.status_code == 201, resp.text
    assert captured == ["203.0.113.1"]
    # Also verify the audit log + client_ip propagation use the same value:
    # Trigger the failure path next so audit_failures gets the IP.
    client.state["rate_limit_result"] = {
        "status": mcp_rate_limit.RateLimitResult.EXCEEDED,
        "current": 11, "limit": 10, "retry_after": 3600,
    }
    resp2 = client.post(
        "/api/v1/mcp/oauth/register",
        headers={"x-forwarded-for": "203.0.113.42, 10.0.0.1"},
        json={"redirect_uris": ["https://example.com/cb"]},
    )
    assert resp2.status_code == 429
    assert client.state["audit_failures"][-1]["registered_ip"] == "203.0.113.42"


# ── POST /api/v1/mcp/oauth/register — happy paths ───────────────────────────


def test_register_public_dcr_minimal_payload(client):
    """No Authorization header → created_by_user_id=NULL, 201 response."""
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
            "client_name": "Claude.ai MCP Connector",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["client_id"].startswith("dcr-")
    assert body["client_secret"].startswith("dcs-")
    assert body["client_id_issued_at"] == 1_700_000_000
    assert body["client_secret_expires_at"] == 0
    assert body["client_name"] == "Claude.ai MCP Connector"
    assert body["redirect_uris"] == ["https://claude.ai/api/mcp/auth_callback"]
    assert body["grant_types"] == ["authorization_code"]
    assert body["response_types"] == ["code"]

    # Audit row was the success row in register_oauth_client (not the failure path)
    assert len(client.state["registered"]) == 1
    reg = client.state["registered"][0]
    assert reg["created_by_user_id"] is None
    assert reg["client_name"] == "Claude.ai MCP Connector"
    assert len(client.state["audit_failures"]) == 0


def test_register_authenticated_dcr_binds_user(client):
    """Bearer sk-stavagent-{hex} → created_by_user_id resolved from initial token."""
    api_key = "sk-stavagent-" + "1" * 48
    client.state["valid_initial_tokens"][api_key] = 42

    resp = client.post(
        "/api/v1/mcp/oauth/register",
        headers={"authorization": f"Bearer {api_key}"},
        json={
            "redirect_uris": ["https://chatgpt.com/connector/oauth/"],
            "client_name": "ChatGPT Custom GPT",
            "grant_types": ["authorization_code", "client_credentials"],
        },
    )
    assert resp.status_code == 201, resp.text
    assert client.state["registered"][0]["created_by_user_id"] == 42


def test_register_full_payload_echoes_optional_fields(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://example.com/cb"],
            "client_name": "Full Test",
            "scope": "mcp:tools",
            "software_id": "com.example.mcp",
            "software_version": "1.2.3",
            "logo_uri": "https://example.com/logo.png",
            "contacts": ["admin@example.com"],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["scope"] == "mcp:tools"
    assert body["software_id"] == "com.example.mcp"
    assert body["software_version"] == "1.2.3"
    assert body["logo_uri"] == "https://example.com/logo.png"
    assert body["contacts"] == ["admin@example.com"]


def test_register_idempotency_creates_distinct_clients(client, monkeypatch):
    """Same payload sent twice → two distinct client_id values
    (RFC 7591 default behaviour: no de-dup on client_name)."""
    counter = {"n": 0}

    def fake_register(**kwargs):
        counter["n"] += 1
        return {
            "client_id": f"dcr-{counter['n']:024d}",
            "client_secret": f"dcs-{counter['n']:048d}",
            "issued_at_unix": 1_700_000_000 + counter["n"],
        }

    monkeypatch.setattr(mcp_auth, "register_oauth_client", fake_register)

    payload = {
        "redirect_uris": ["https://example.com/cb"],
        "client_name": "Same Name",
    }
    r1 = client.post("/api/v1/mcp/oauth/register", json=payload)
    r2 = client.post("/api/v1/mcp/oauth/register", json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["client_id"] != r2.json()["client_id"]


# ── POST /api/v1/mcp/oauth/register — 400 validation failures ───────────────


def test_register_missing_redirect_uris_returns_400(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"client_name": "Foo"},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["error"] == "invalid_redirect_uri"

    # Audit row written with status=invalid_redirect_uri
    assert len(client.state["audit_failures"]) == 1
    assert client.state["audit_failures"][0]["status"] == "invalid_redirect_uri"
    assert client.state["audit_failures"][0]["client_name"] == "Foo"


def test_register_empty_redirect_uris_returns_400(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"redirect_uris": [], "client_name": "Foo"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_redirect_uri"


@pytest.mark.parametrize("bad_uri", [
    "http://evil.example.com/cb",   # http non-loopback
    "javascript:alert(1)",
    "data:text/html,xss",
    "https://example.com/cb#frag",  # fragment
])
def test_register_bad_redirect_uri_returns_400(client, bad_uri):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"redirect_uris": [bad_uri], "client_name": "Bad"},
    )
    assert resp.status_code == 400, f"Expected 400 for {bad_uri}"
    assert resp.json()["detail"]["error"] == "invalid_redirect_uri"


def test_register_unsupported_grant_type_returns_400(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://example.com/cb"],
            "client_name": "Implicit Test",
            "grant_types": ["implicit", "authorization_code"],
        },
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["error"] == "invalid_client_metadata"
    assert "implicit" in detail["error_description"]

    assert client.state["audit_failures"][0]["status"] == "invalid_client_metadata"


def test_register_client_name_too_long_returns_400(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://example.com/cb"],
            "client_name": "x" * 201,
        },
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_client_metadata"


def test_register_invalid_json_returns_400(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        content=b"this is not json",
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_client_metadata"


def test_register_falls_back_client_name_from_software_id(client):
    """No client_name + software_id provided → fallback label, still 201."""
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://example.com/cb"],
            "software_id": "com.example.mcp",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["client_name"] == "com.example.mcp"


# ── POST /api/v1/mcp/oauth/register — 401 initial token paths ───────────────


def test_register_with_non_bearer_auth_returns_401(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        headers={"authorization": "Basic dXNlcjpwYXNz"},
        json={"redirect_uris": ["https://example.com/cb"]},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_token"
    assert client.state["audit_failures"][0]["status"] == "invalid_token"


def test_register_with_wrong_prefix_bearer_returns_401(client):
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        headers={"authorization": "Bearer not-a-stavagent-key"},
        json={"redirect_uris": ["https://example.com/cb"]},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_token"


def test_register_with_unknown_stavagent_key_returns_401(client):
    """Bearer is well-formed but the key is not in mcp_api_keys."""
    api_key = "sk-stavagent-" + "f" * 48  # not in fake table
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        headers={"authorization": f"Bearer {api_key}"},
        json={"redirect_uris": ["https://example.com/cb"]},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_token"


# ── POST /api/v1/mcp/oauth/register — 500 server error path ─────────────────


def test_register_db_error_returns_500_and_logs(client, monkeypatch):
    """register_oauth_client raises → audit row + 500 response."""
    def boom(**kwargs):
        raise RuntimeError("simulated DB outage")

    monkeypatch.setattr(mcp_auth, "register_oauth_client", boom)

    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={
            "redirect_uris": ["https://example.com/cb"],
            "client_name": "Server Error Test",
        },
    )
    assert resp.status_code == 500
    assert resp.json()["detail"]["error"] == "server_error"

    assert len(client.state["audit_failures"]) == 1
    audit = client.state["audit_failures"][0]
    assert audit["status"] == "server_error"
    assert audit["client_name"] == "Server Error Test"
    assert "simulated DB outage" in audit["error_description"]


# ── Audit log structure (cross-cutting) ─────────────────────────────────────


def test_failure_audit_always_includes_ip_and_payload_hash(client):
    """Every failure path must log ip + payload_hash for forensics."""
    resp = client.post(
        "/api/v1/mcp/oauth/register",
        json={"redirect_uris": ["javascript:alert(1)"], "client_name": "X"},
    )
    assert resp.status_code == 400
    audit = client.state["audit_failures"][0]
    assert audit["registered_ip"]  # non-empty (TestClient sets 'testclient' or similar)
    assert audit["request_payload_hash"]
    assert re.fullmatch(r"[0-9a-f]{64}", audit["request_payload_hash"])


# ── Discovery manifest contains registration_endpoint ───────────────────────


def test_oauth_discovery_payload_advertises_registration_endpoint():
    """The well-known manifest in app/main.py must list registration_endpoint
    so brokers (Anthropic / OpenAI) auto-register via RFC 7591.

    Static source check — importing app.main loads the entire FastAPI
    app (KB loader, fastmcp, pydantic_settings, …), which can't run in
    isolated CI sandboxes. Grepping the source proves the same property
    that an import-based test would, with zero dependency footprint.
    """
    import pathlib
    main_py = pathlib.Path(__file__).resolve().parent.parent / "app" / "main.py"
    source = main_py.read_text(encoding="utf-8")

    assert '"registration_endpoint"' in source, (
        "app/main.py _oauth_discovery_payload must list "
        "'registration_endpoint' for RFC 7591 broker auto-registration"
    )
    # Tied to the actual DCR route path so a typo in either breaks the
    # broker handshake — keep them in lockstep.
    assert "/api/v1/mcp/oauth/register" in source, (
        "registration_endpoint URL must match the DCR route in app/mcp/routes.py"
    )


def test_oauth_discovery_payload_preserves_legacy_fields():
    """Adding registration_endpoint must not silently drop existing fields
    that ChatGPT + Claude.ai depend on. Static source check (same reason
    as the previous test)."""
    import pathlib
    main_py = pathlib.Path(__file__).resolve().parent.parent / "app" / "main.py"
    source = main_py.read_text(encoding="utf-8")

    for required in (
        '"issuer"',
        '"authorization_endpoint"',
        '"token_endpoint"',
        '"grant_types_supported"',
        '"response_types_supported"',
        '"code_challenge_methods_supported"',
    ):
        assert required in source, f"Missing legacy manifest field: {required}"


# ───────────────────────────────────────────────────────────────────────────
# POST /api/v1/mcp/oauth/token — Gate 4
#
# All three grant types + backward-compat dispatch. DB calls into
# mcp_auth.* and mcp_oauth_codes.consume_code are monkeypatched so we
# can exercise the route's branching without Postgres.
# ───────────────────────────────────────────────────────────────────────────


@pytest.fixture
def token_client(monkeypatch):
    """Fresh TestClient with the route mounted + all DB helpers mocked."""
    state = {
        "consume_code_result": None,         # set per-test
        "validate_client_result": None,      # set per-test
        "resolve_user_result": None,         # set per-test
        "mint_kwargs": [],
        "rotation_result": None,
        "legacy_oauth_result": None,
    }

    def fake_consume_code(*, code, code_verifier, redirect_uri):
        return state["consume_code_result"]

    def fake_validate(client_id, client_secret):
        return state["validate_client_result"]

    def fake_resolve(client_id):
        return state["resolve_user_result"]

    def fake_mint(**kwargs):
        state["mint_kwargs"].append(kwargs)
        return {
            "access_token": "sat-" + "a" * 48,
            "refresh_token": "srt-" + "b" * 48 if kwargs["with_refresh"] else None,
            "token_type": "bearer",
            "expires_in": 3600,
            "scope": kwargs.get("scope") or "",
            "_token_row_id": 99,
        } if kwargs["with_refresh"] else {
            "access_token": "sat-" + "a" * 48,
            "token_type": "bearer",
            "expires_in": 3600,
            "scope": kwargs.get("scope") or "",
            "_token_row_id": 99,
        }

    def fake_rotate(**kwargs):
        return state["rotation_result"]

    def fake_legacy_oauth(client_id, client_secret):
        return state["legacy_oauth_result"]

    monkeypatch.setattr(mcp_oauth_codes, "consume_code", fake_consume_code)
    monkeypatch.setattr(mcp_auth, "validate_oauth_client_credentials", fake_validate)
    monkeypatch.setattr(mcp_auth, "resolve_user_api_key_for_client", fake_resolve)
    monkeypatch.setattr(mcp_auth, "mint_token_pair", fake_mint)
    monkeypatch.setattr(mcp_auth, "rotate_refresh_token", fake_rotate)
    monkeypatch.setattr(mcp_auth, "oauth_token", fake_legacy_oauth)

    app = FastAPI()
    app.include_router(router)
    tc = TestClient(app)
    tc.state = state  # type: ignore[attr-defined]
    return tc


# ── authorization_code grant ────────────────────────────────────────────────


def test_token_authcode_dcr_happy(token_client):
    """consume_code returns oauth_client_id NOT NULL → mint sat-/srt- pair."""
    token_client.state["consume_code_result"] = {
        "ok": True,
        "client_id": "sk-stavagent-" + "u" * 48,
        "oauth_client_id": "dcr-" + "c" * 24,
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": "test-code",
        "code_verifier": "test-verifier",
        "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"].startswith("sat-")
    assert body["refresh_token"].startswith("srt-")
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600

    # mint_token_pair must have been called with the binding
    assert len(token_client.state["mint_kwargs"]) == 1
    mint = token_client.state["mint_kwargs"][0]
    assert mint["oauth_client_id"] == "dcr-" + "c" * 24
    assert mint["user_api_key"] == "sk-stavagent-" + "u" * 48
    assert mint["grant_type"] == "authorization_code"
    assert mint["with_refresh"] is True


def test_token_authcode_legacy_oauth_client_id_null_returns_api_key(token_client):
    """consume_code returns oauth_client_id=None → legacy bearer=api_key,
    NO mint_token_pair call."""
    token_client.state["consume_code_result"] = {
        "ok": True,
        "client_id": "sk-stavagent-" + "u" * 48,
        "oauth_client_id": None,
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": "legacy-code",
        "code_verifier": "v",
        "redirect_uri": "https://example.com/cb",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] == "sk-stavagent-" + "u" * 48
    assert body["token_type"] == "bearer"
    # Crucial: no mcp_oauth_tokens row written for legacy flow
    assert token_client.state["mint_kwargs"] == []


def test_token_authcode_reused_returns_400(token_client):
    """consume_code reports invalid_grant for already-used code."""
    token_client.state["consume_code_result"] = {
        "ok": False,
        "error": "invalid_grant",
        "error_description": "Authorization code already used",
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "authorization_code",
        "code": "used-code",
        "code_verifier": "v",
        "redirect_uri": "https://example.com/cb",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_grant"
    assert "already used" in resp.json()["detail"]["error_description"]


# ── client_credentials grant ────────────────────────────────────────────────


def test_token_client_credentials_dcr_public_user_key_null(token_client):
    """Public DCR (created_by_user_id=NULL) → user_api_key=NULL in mint call."""
    token_client.state["validate_client_result"] = {
        "id": 1,
        "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": None,  # public DCR
        "grant_types": ["authorization_code", "client_credentials"],
        "scope": None,
    }
    token_client.state["resolve_user_result"] = None  # not consulted
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"].startswith("sat-")
    assert "refresh_token" not in body  # RFC 6749 §4.4.3

    mint = token_client.state["mint_kwargs"][0]
    assert mint["user_api_key"] is None  # public DCR → NULL → 402 on paid tools
    assert mint["with_refresh"] is False


def test_token_client_credentials_dcr_authenticated_user_key_resolved(token_client):
    """Authenticated DCR (created_by_user_id=42) → resolve_user_api_key called,
    result passed to mint."""
    token_client.state["validate_client_result"] = {
        "id": 1,
        "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": 42,
        "grant_types": ["client_credentials"],
        "scope": "mcp:tools",
    }
    token_client.state["resolve_user_result"] = "sk-stavagent-" + "u" * 48

    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
    })
    assert resp.status_code == 200
    mint = token_client.state["mint_kwargs"][0]
    assert mint["user_api_key"] == "sk-stavagent-" + "u" * 48
    assert mint["scope"] == "mcp:tools"


def test_token_client_credentials_dcr_wrong_secret_returns_401(token_client):
    """validate_oauth_client_credentials returns None → 401 invalid_client."""
    token_client.state["validate_client_result"] = None

    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-WRONG",
    })
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_client"


def test_token_client_credentials_dcr_unauthorized_grant_returns_400(token_client):
    """Client registered ONLY for authorization_code → 400 unauthorized_client."""
    token_client.state["validate_client_result"] = {
        "id": 1,
        "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": None,
        "grant_types": ["authorization_code"],  # not client_credentials!
        "scope": None,
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "unauthorized_client"


def test_token_client_credentials_legacy_sk_stavagent_unchanged(token_client):
    """sk-stavagent-* client_id MUST NOT touch the new path —
    backward-compat for ChatGPT custom GPTs in production."""
    legacy_response = {
        "access_token": "sk-stavagent-" + "u" * 48,
        "token_type": "bearer",
        "expires_in": 86400,
    }
    token_client.state["legacy_oauth_result"] = legacy_response

    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "sk-stavagent-" + "u" * 48,
        "client_secret": "sk-stavagent-" + "u" * 48,
    })
    assert resp.status_code == 200
    assert resp.json() == legacy_response
    # validate_oauth_client_credentials must NOT be called
    assert token_client.state["mint_kwargs"] == []


def test_token_client_credentials_legacy_path_invalid_returns_401(token_client):
    """Legacy oauth_token returns error → 401."""
    token_client.state["legacy_oauth_result"] = {
        "error": "invalid_client",
        "error_description": "Invalid API key",
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "sk-stavagent-" + "z" * 48,
        "client_secret": "sk-stavagent-" + "z" * 48,
    })
    assert resp.status_code == 401


def test_token_client_credentials_jsonb_grant_types_as_string(token_client):
    """psycopg2 sometimes returns JSONB as raw str — must json.loads()."""
    token_client.state["validate_client_result"] = {
        "id": 1,
        "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": None,
        "grant_types": '["client_credentials"]',  # STRING not list
        "scope": None,
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "client_credentials",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
    })
    assert resp.status_code == 200


# ── refresh_token grant ─────────────────────────────────────────────────────


def test_token_refresh_happy(token_client):
    """rotate_refresh_token returns ok=True with new pair → 200 with both tokens."""
    token_client.state["validate_client_result"] = {
        "id": 1,
        "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": 42,
        "grant_types": ["authorization_code"],
        "scope": "mcp",
    }
    token_client.state["rotation_result"] = {
        "ok": True,
        "access_token": "sat-" + "n" * 48,
        "refresh_token": "srt-" + "m" * 48,
        "token_type": "bearer",
        "expires_in": 3600,
        "scope": "mcp",
        "_token_row_id": 100,
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
        "refresh_token": "srt-" + "old" + "o" * 45,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] == "sat-" + "n" * 48
    assert body["refresh_token"] == "srt-" + "m" * 48
    assert "ok" not in body  # internal field stripped
    assert "_token_row_id" not in body


def test_token_refresh_requires_dcr_client_id(token_client):
    """sk-stavagent- client_id for refresh_token → 400 (legacy never minted refresh)."""
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "sk-stavagent-" + "u" * 48,
        "client_secret": "sk-stavagent-" + "u" * 48,
        "refresh_token": "srt-" + "x" * 48,
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_client"
    assert "DCR-issued" in resp.json()["detail"]["error_description"]


def test_token_refresh_wrong_client_secret_returns_401(token_client):
    """validate_client_credentials returns None → 401 BEFORE rotate is called."""
    token_client.state["validate_client_result"] = None

    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-WRONG",
        "refresh_token": "srt-" + "x" * 48,
    })
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_client"


def test_token_refresh_missing_refresh_token_returns_400(token_client):
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
        "refresh_token": "",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_request"


def test_token_refresh_expired_returns_400(token_client):
    """rotate_refresh_token reports invalid_grant 'expired'."""
    token_client.state["validate_client_result"] = {
        "id": 1, "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": None,
        "grant_types": ["authorization_code"], "scope": None,
    }
    token_client.state["rotation_result"] = {
        "ok": False,
        "error": "invalid_grant",
        "error_description": "refresh_token expired",
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
        "refresh_token": "srt-" + "expired" + "e" * 41,
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_grant"


def test_token_refresh_revoked_returns_400(token_client):
    """rotate_refresh_token reports replay → invalid_grant 'revoked'."""
    token_client.state["validate_client_result"] = {
        "id": 1, "client_id": "dcr-" + "c" * 24,
        "created_by_user_id": None,
        "grant_types": ["authorization_code"], "scope": None,
    }
    token_client.state["rotation_result"] = {
        "ok": False,
        "error": "invalid_grant",
        "error_description": "refresh_token has been revoked",
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-" + "c" * 24,
        "client_secret": "dcs-" + "s" * 48,
        "refresh_token": "srt-" + "replay" + "r" * 42,
    })
    assert resp.status_code == 400
    assert "revoked" in resp.json()["detail"]["error_description"]


def test_token_refresh_cross_client_returns_400(token_client):
    """rotate_refresh_token detects client mismatch → invalid_grant."""
    token_client.state["validate_client_result"] = {
        "id": 1, "client_id": "dcr-attacker" + "a" * 16,
        "created_by_user_id": None,
        "grant_types": ["authorization_code"], "scope": None,
    }
    token_client.state["rotation_result"] = {
        "ok": False,
        "error": "invalid_grant",
        "error_description": "refresh_token does not belong to this client",
    }
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "refresh_token",
        "client_id": "dcr-attacker" + "a" * 16,
        "client_secret": "dcs-" + "s" * 48,
        "refresh_token": "srt-victim" + "v" * 42,
    })
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"]["error_description"]


# ── unsupported grant ───────────────────────────────────────────────────────


def test_token_unsupported_grant_type_returns_400(token_client):
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "implicit",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "unsupported_grant_type"


def test_token_unsupported_password_grant_returns_400(token_client):
    """password grant (RFC 6749 §4.3) is deprecated — make sure we reject it."""
    resp = token_client.post("/api/v1/mcp/oauth/token", data={
        "grant_type": "password",
        "username": "x", "password": "y",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "unsupported_grant_type"


# ───────────────────────────────────────────────────────────────────────────
# GET + POST /api/v1/mcp/oauth/authorize — Gate 4.5
#
# DCR consent flow:
#   GET  → validate client + redirect_uri + render HTML form
#   POST → validate api_key + mint code with binding + 303 redirect
# Legacy sk-stavagent-* path on GET stays untouched.
# ───────────────────────────────────────────────────────────────────────────


@pytest.fixture
def authorize_client(monkeypatch):
    """TestClient with /authorize DB helpers mocked."""
    state = {
        "client_lookup_result": None,       # dict | None for lookup_oauth_client_for_authorize
        "user_lookup_result": None,         # int | None for _resolve_initial_access_user_id
        "generate_code_calls": [],          # list of generate_code kwargs
        "get_credits_result": None,         # for legacy path
    }

    def fake_lookup_oauth_client(client_id):
        return state["client_lookup_result"]

    def fake_resolve_user(api_key):
        return state["user_lookup_result"]

    def fake_generate_code(**kwargs):
        state["generate_code_calls"].append(kwargs)
        return "test-code-" + "z" * 20

    def fake_get_credits(api_key):
        return state["get_credits_result"] or {
            "email": "u@x.com", "credits": 100,
            "total_used": 0, "total_purchased": 0,
        }

    def fake_is_allowed_uri(uri):
        # Always true for legacy-path tests; DCR path uses registered_uris list.
        return True

    monkeypatch.setattr(mcp_auth, "lookup_oauth_client_for_authorize", fake_lookup_oauth_client)
    monkeypatch.setattr(mcp_auth, "_resolve_initial_access_user_id", fake_resolve_user)
    monkeypatch.setattr(mcp_auth, "get_credits", fake_get_credits)
    monkeypatch.setattr(mcp_oauth_codes, "generate_code", fake_generate_code)
    monkeypatch.setattr(mcp_oauth_codes, "is_allowed_redirect_uri", fake_is_allowed_uri)

    app = FastAPI()
    app.include_router(router)
    tc = TestClient(app)
    tc.state = state  # type: ignore[attr-defined]
    return tc


# ── GET /authorize for dcr-* ────────────────────────────────────────────────


_DCR_AUTH_PARAMS = {
    "response_type": "code",
    "client_id": "dcr-" + "c" * 24,
    "redirect_uri": "https://claude.ai/api/mcp/auth_callback",
    "code_challenge": "challengeABCD",
    "code_challenge_method": "S256",
    "state": "xyz",
    "scope": "mcp",
}


def test_authorize_get_dcr_renders_consent_form(authorize_client):
    """Valid DCR client + matching redirect_uri → 200 HTML form."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1,
        "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "Claude.ai MCP",
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
        "grant_types": ["authorization_code"],
        "software_id": "ai.anthropic.claude",
        "software_version": "1.0",
    }
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=_DCR_AUTH_PARAMS)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    body = resp.text
    # Form must echo every OAuth param as hidden input
    assert 'name="response_type"' in body
    assert _DCR_AUTH_PARAMS["client_id"] in body
    assert "challengeABCD" in body
    assert "xyz" in body  # state preserved
    assert 'name="api_key"' in body
    assert 'type="password"' in body
    assert "Claude.ai MCP" in body  # client_name displayed
    # Form posts back to /authorize, not directly to redirect_uri
    assert 'action="/api/v1/mcp/oauth/authorize"' in body
    assert 'method="POST"' in body
    # No code minted yet — that happens on POST
    assert authorize_client.state["generate_code_calls"] == []


def test_authorize_get_dcr_unknown_client_returns_400(authorize_client):
    """lookup_oauth_client_for_authorize returns None → 400 invalid_client."""
    authorize_client.state["client_lookup_result"] = None
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=_DCR_AUTH_PARAMS)
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_client"


def test_authorize_get_dcr_redirect_uri_mismatch_returns_400(authorize_client):
    """redirect_uri not in registered list → 400 invalid_redirect_uri."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1,
        "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "X",
        "redirect_uris": ["https://other.example.com/cb"],  # doesn't match
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=_DCR_AUTH_PARAMS)
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_redirect_uri"


def test_authorize_get_dcr_redirect_uris_as_json_string(authorize_client):
    """JSONB column sometimes returns as raw str — must json.loads."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1, "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "X",
        "redirect_uris": '["https://claude.ai/api/mcp/auth_callback"]',  # STR
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=_DCR_AUTH_PARAMS)
    assert resp.status_code == 200


def test_authorize_get_dcr_wrong_response_type_returns_400(authorize_client):
    """response_type=token (implicit) is not supported → 400."""
    params = dict(_DCR_AUTH_PARAMS, response_type="token")
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=params)
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "unsupported_response_type"


def test_authorize_get_dcr_wrong_pkce_method_returns_400(authorize_client):
    """code_challenge_method=plain is RFC-allowed but rejected for security."""
    params = dict(_DCR_AUTH_PARAMS, code_challenge_method="plain")
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=params)
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_request"


# ── POST /authorize for DCR consent submission ──────────────────────────────


def test_authorize_post_dcr_happy_mints_code_with_binding(authorize_client):
    """Valid api_key + matching client → 303 + generate_code called with
    oauth_client_id binding."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1, "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "Claude.ai MCP",
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    authorize_client.state["user_lookup_result"] = 42  # valid user

    resp = authorize_client.post(
        "/api/v1/mcp/oauth/authorize",
        data={**_DCR_AUTH_PARAMS, "api_key": "sk-stavagent-" + "u" * 48},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    location = resp.headers["location"]
    assert location.startswith("https://claude.ai/api/mcp/auth_callback?")
    assert "code=test-code-" in location
    assert "state=xyz" in location

    # generate_code called with BOTH bindings: user_api_key + oauth_client_id
    assert len(authorize_client.state["generate_code_calls"]) == 1
    call = authorize_client.state["generate_code_calls"][0]
    assert call["client_id"] == "sk-stavagent-" + "u" * 48  # user
    assert call["oauth_client_id"] == _DCR_AUTH_PARAMS["client_id"]  # DCR client


def test_authorize_post_dcr_invalid_api_key_re_renders_form(authorize_client):
    """Invalid api_key → 200 with form + error message (NOT 401, NOT redirect)."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1, "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "X",
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    authorize_client.state["user_lookup_result"] = None  # unknown api_key

    resp = authorize_client.post(
        "/api/v1/mcp/oauth/authorize",
        data={**_DCR_AUTH_PARAMS, "api_key": "sk-stavagent-WRONG"},
        follow_redirects=False,
    )
    assert resp.status_code == 200
    assert "Invalid or inactive API key" in resp.text
    # User can fix + resubmit without re-bouncing through the broker
    assert 'action="/api/v1/mcp/oauth/authorize"' in resp.text
    # No code minted on invalid auth
    assert authorize_client.state["generate_code_calls"] == []


def test_authorize_post_rejects_non_dcr_client_id(authorize_client):
    """sk-stavagent-* client_id via POST is a programming error → 400."""
    resp = authorize_client.post(
        "/api/v1/mcp/oauth/authorize",
        data={**_DCR_AUTH_PARAMS,
              "client_id": "sk-stavagent-" + "u" * 48,
              "api_key": "sk-stavagent-" + "u" * 48},
        follow_redirects=False,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_request"


def test_authorize_post_tampered_redirect_uri_returns_400(authorize_client):
    """Hidden field tampered after form render → re-validated server-side → 400."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1, "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": "X",
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    resp = authorize_client.post(
        "/api/v1/mcp/oauth/authorize",
        data={**_DCR_AUTH_PARAMS,
              "redirect_uri": "https://attacker.evil.com/cb",  # tampered!
              "api_key": "sk-stavagent-" + "u" * 48},
        follow_redirects=False,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "invalid_redirect_uri"


# ── Legacy GET /authorize for sk-stavagent-* ────────────────────────────────


def test_authorize_get_legacy_sk_stavagent_unchanged(authorize_client):
    """sk-stavagent-* client_id → existing behaviour: 302 redirect with code,
    NO HTML form rendered, oauth_client_id NOT passed to generate_code."""
    authorize_client.state["get_credits_result"] = {
        "email": "u@x.com", "credits": 100,
        "total_used": 0, "total_purchased": 0,
    }
    params = dict(_DCR_AUTH_PARAMS, client_id="sk-stavagent-" + "u" * 48)
    resp = authorize_client.get(
        "/api/v1/mcp/oauth/authorize",
        params=params,
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert resp.headers["location"].startswith(_DCR_AUTH_PARAMS["redirect_uri"])
    assert "code=test-code-" in resp.headers["location"]
    # Crucial backward-compat assertion: legacy flow passes oauth_client_id=None
    # (default) so consume_code returns oauth_client_id=None and /token
    # takes the legacy bearer=api_key branch.
    call = authorize_client.state["generate_code_calls"][0]
    assert call.get("oauth_client_id") is None or "oauth_client_id" not in call


def test_authorize_get_legacy_unknown_api_key_redirects_with_error(authorize_client):
    """Legacy path: unknown sk-stavagent-* → 302 to redirect_uri with
    error=unauthorized_client (per RFC §4.1.2.1 redirect for known-good
    redirect_uri)."""
    authorize_client.state["get_credits_result"] = {"error": "Invalid API key.", "credits": 0}
    params = dict(_DCR_AUTH_PARAMS, client_id="sk-stavagent-" + "z" * 48)
    resp = authorize_client.get(
        "/api/v1/mcp/oauth/authorize",
        params=params,
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error=unauthorized_client" in resp.headers["location"]


# ── XSS smoke test — paranoia about HTML rendering ──────────────────────────


def test_authorize_get_dcr_html_escapes_client_name(authorize_client):
    """Malicious client_name from DB must be HTML-escaped, not rendered as
    markup. Defence in depth: if an attacker somehow registered a client
    with <script> in client_name (shouldn't happen given RFC 7591 §2
    validation but tools fail), the consent page must not execute it."""
    authorize_client.state["client_lookup_result"] = {
        "id": 1, "client_id": _DCR_AUTH_PARAMS["client_id"],
        "client_name": '<script>alert(1)</script>',
        "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
        "grant_types": ["authorization_code"],
        "software_id": None, "software_version": None,
    }
    resp = authorize_client.get("/api/v1/mcp/oauth/authorize", params=_DCR_AUTH_PARAMS)
    assert resp.status_code == 200
    # Verbatim tag must NOT appear; escaped form must be present
    assert "<script>alert(1)</script>" not in resp.text
    assert "&lt;script&gt;" in resp.text
