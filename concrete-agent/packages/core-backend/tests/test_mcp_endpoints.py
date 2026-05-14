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
