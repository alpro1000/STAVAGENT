"""
Tests for OAuth 2.0 Authorization Server Metadata discovery endpoints.

Three public well-known URLs all return the same RFC 8414 payload so that
ChatGPT custom connectors and Claude.ai MCP integrations can auto-discover
the existing client_credentials token endpoint:

  - GET /.well-known/oauth-authorization-server
  - GET /.well-known/openid-configuration
  - GET /mcp/.well-known/oauth-authorization-server

The third URL is path-under-mount, which only resolves correctly because
the route is registered on the FastAPI app BEFORE `app.mount("/mcp", …)` —
these tests guard that ordering.

No DB / no auth — these endpoints are public by definition (discovery is
pre-authentication). The tests can run in any environment.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


WELL_KNOWN_PATHS = [
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
    "/mcp/.well-known/oauth-authorization-server",
]


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.mark.parametrize("path", WELL_KNOWN_PATHS)
def test_returns_200_json(client: TestClient, path: str):
    """Every discovery URL must return 200 with content-type application/json."""
    r = client.get(path)
    assert r.status_code == 200, f"{path} returned {r.status_code}: {r.text[:200]}"
    ctype = r.headers.get("content-type", "")
    assert ctype.startswith("application/json"), f"{path} wrong content-type: {ctype!r}"


@pytest.mark.parametrize("path", WELL_KNOWN_PATHS)
def test_payload_shape(client: TestClient, path: str):
    """RFC 8414 required fields + the values we promised in the spec."""
    body = client.get(path).json()
    # Required fields
    for key in (
        "issuer",
        "token_endpoint",
        "grant_types_supported",
        "token_endpoint_auth_methods_supported",
        "response_types_supported",
        "scopes_supported",
    ):
        assert key in body, f"{path} missing {key!r}: {body}"

    # Locked values per the task spec.
    assert body["grant_types_supported"] == ["client_credentials"]
    assert body["response_types_supported"] == ["token"]
    assert body["scopes_supported"] == ["mcp:tools", "mcp:read"]
    assert set(body["token_endpoint_auth_methods_supported"]) == {
        "client_secret_post",
        "client_secret_basic",
    }


@pytest.mark.parametrize("path", WELL_KNOWN_PATHS)
def test_token_endpoint_is_absolute(client: TestClient, path: str):
    """`token_endpoint` MUST be an absolute URL — relative URIs fail discovery."""
    body = client.get(path).json()
    te = body["token_endpoint"]
    assert te.startswith(("http://", "https://")), f"token_endpoint not absolute: {te!r}"
    # Must point at the existing /api/v1/mcp/oauth/token route — this is the
    # whole point of discovery.
    assert te.endswith("/api/v1/mcp/oauth/token"), te


@pytest.mark.parametrize("path", WELL_KNOWN_PATHS)
def test_issuer_is_absolute_no_trailing_slash(client: TestClient, path: str):
    """`issuer` MUST be an absolute URL without trailing slash (RFC 8414 §2)."""
    body = client.get(path).json()
    iss = body["issuer"]
    assert iss.startswith(("http://", "https://")), iss
    assert not iss.endswith("/"), f"issuer must not have trailing slash: {iss!r}"


@pytest.mark.parametrize("path", WELL_KNOWN_PATHS)
def test_no_auth_required(client: TestClient, path: str):
    """Discovery endpoints must be reachable without any Authorization header."""
    # No headers at all (default TestClient request) — the 200 in test_returns_200_json
    # already proves this, but we keep an explicit check so the public-by-design
    # contract is documented.
    r = client.get(path, headers={})
    assert r.status_code == 200


def test_mount_route_ordering(client: TestClient):
    """
    Regression-pin for the Starlette ordering rule: `/mcp/.well-known/...`
    must hit the FastAPI explicit route, not the mounted FastMCP ASGI app.
    If someone moves `app.mount("/mcp", …)` above the route registration in
    main.py, this test fails because the FastMCP app would 404 / return a
    non-JSON response instead of the discovery payload.
    """
    r = client.get("/mcp/.well-known/oauth-authorization-server")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/json")
    assert "issuer" in r.json()


def test_all_three_payloads_identical(client: TestClient):
    """The three URLs are advertised as equivalent — payloads must match."""
    payloads = [client.get(p).json() for p in WELL_KNOWN_PATHS]
    assert payloads[0] == payloads[1] == payloads[2]
