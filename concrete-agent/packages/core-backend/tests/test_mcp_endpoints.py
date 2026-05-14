"""
Tests for MCP health + tools-listing endpoints.

- GET /mcp/health         — public, no auth (Cloud Run uptime checks)
- GET /api/v1/mcp/tools   — requires Bearer API key, returns 9 tools

These endpoints live in app/main.py and app/mcp/routes.py.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mcp import auth as mcp_auth
from app.mcp.routes import TOOL_DESCRIPTIONS, TOOL_ORDER


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
def api_key(tmp_path, monkeypatch):
    """Create a throwaway API key against an isolated SQLite DB."""
    db_path = tmp_path / "mcp_keys_test.db"
    monkeypatch.setattr(mcp_auth, "_DB_PATH", db_path)
    # Reset thread-local connection pool so the patched _DB_PATH is picked up.
    mcp_auth._db_pool.clear()

    result = mcp_auth.register(
        email="tools-test@example.com",
        password="testpass123",
        client_ip="127.0.0.1",
    )
    assert "api_key" in result, result
    yield result["api_key"]
    mcp_auth._db_pool.clear()


def test_tools_requires_auth(client):
    response = client.get("/api/v1/mcp/tools")
    assert response.status_code == 401


def test_tools_rejects_invalid_key(client):
    response = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": "Bearer sk-stavagent-invalid"},
    )
    assert response.status_code == 401


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


def test_tools_costs_match_billing_source_of_truth(client, api_key):
    body = client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    ).json()
    for tool in body["tools"]:
        assert tool["cost_credits"] == mcp_auth.TOOL_COSTS[tool["name"]]


def test_tools_listing_does_not_consume_credits(client, api_key):
    before = mcp_auth.get_credits(api_key)["credits"]
    client.get(
        "/api/v1/mcp/tools",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    after = mcp_auth.get_credits(api_key)["credits"]
    assert before == after
