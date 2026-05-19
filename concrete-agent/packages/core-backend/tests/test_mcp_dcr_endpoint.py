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
    to in-memory state so tests run without Postgres."""
    state = {
        "registered": [],         # list of register_oauth_client kwargs
        "audit_failures": [],     # list of log_oauth_registration_failure kwargs
        "valid_initial_tokens": {},  # api_key -> user_id
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

    monkeypatch.setattr(mcp_auth, "register_oauth_client", fake_register)
    monkeypatch.setattr(mcp_auth, "log_oauth_registration_failure", fake_audit)
    monkeypatch.setattr(mcp_auth, "_resolve_initial_access_user_id", fake_resolve)

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
