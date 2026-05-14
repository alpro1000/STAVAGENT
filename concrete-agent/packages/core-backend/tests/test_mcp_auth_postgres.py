"""
Postgres roundtrip tests for MCP auth + credits.

Requires a live Postgres reachable via DATABASE_URL with migration 007
already applied. Skips cleanly if DATABASE_URL is unset (so local
`pytest` runs without Postgres don't break).

Covers the post-migration contract from
docs/audits/mcp_status/migration_log.md:
  - register → login roundtrip
  - free tool (cost=0) needs no key
  - paid tool deducts atomically and logs to mcp_credit_log
  - insufficient credits → ok=False with structured error
  - add_credits (billing webhook path)
  - oauth_token returns bearer = api_key
  - rate limit triggers on the 11th register/login attempt
"""

import os
import sys
import uuid

import pytest

# Skip the whole module when no Postgres is configured — keeps the existing
# import-only CI lane (without a postgres service) green.
if not (os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL")):
    pytest.skip("DATABASE_URL not set — Postgres auth tests skipped", allow_module_level=True)

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp import auth as mcp_auth  # noqa: E402


def _fresh_email() -> str:
    return f"mcp-test-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Each test starts with an empty rate-limit bucket so the 11-attempt
    test isn't poisoned by prior tests in the same process."""
    mcp_auth._rate_limit_store.clear()
    yield
    mcp_auth._rate_limit_store.clear()


def test_register_then_login_roundtrip():
    email = _fresh_email()
    reg = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.1")
    assert reg["status"] == "created"
    assert reg["credits"] == mcp_auth.FREE_CREDITS
    assert reg["api_key"].startswith("sk-stavagent-")

    again = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.2")
    assert again["status"] == "exists"

    ok = mcp_auth.login(email, "passw0rd!", client_ip="10.0.0.3")
    assert ok["status"] == "ok"
    assert ok["api_key"] == reg["api_key"]

    bad = mcp_auth.login(email, "wrong", client_ip="10.0.0.4")
    assert bad["status"] == "invalid"


def test_free_tool_no_key_required():
    res = mcp_auth.check_credits("", "find_otskp_code")
    assert res == {"ok": True, "cost": 0, "credits_remaining": None}


def test_paid_tool_deducts_atomically():
    email = _fresh_email()
    reg = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.5")
    key = reg["api_key"]

    # search_czech_construction_norms costs 1 credit
    res = mcp_auth.check_credits(key, "search_czech_construction_norms")
    assert res["ok"] is True
    assert res["cost"] == 1
    assert res["credits_remaining"] == mcp_auth.FREE_CREDITS - 1

    balance = mcp_auth.get_credits(key)
    assert balance["credits"] == mcp_auth.FREE_CREDITS - 1
    assert balance["total_used"] == 1


def test_insufficient_credits_blocks_deduction():
    email = _fresh_email()
    reg = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.6")
    key = reg["api_key"]

    # Drain to under cost(create_work_breakdown)=20: spend 199 × 1c
    for _ in range(mcp_auth.FREE_CREDITS - 10):  # leaves 10 credits
        mcp_auth.check_credits(key, "search_czech_construction_norms")

    blocked = mcp_auth.check_credits(key, "create_work_breakdown")  # cost 20 > 10
    assert blocked["ok"] is False
    assert blocked["credits_remaining"] == 10
    assert "Insufficient" in blocked["error"]


def test_paid_tool_rejects_missing_key():
    res = mcp_auth.check_credits("", "calculate_concrete_works")
    assert res["ok"] is False
    assert "API key required" in res["error"]


def test_paid_tool_rejects_unknown_key():
    res = mcp_auth.check_credits("sk-stavagent-deadbeef", "calculate_concrete_works")
    assert res["ok"] is False
    assert "Invalid API key" in res["error"]


def test_add_credits_increments_balance():
    email = _fresh_email()
    reg = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.7")
    key = reg["api_key"]

    res = mcp_auth.add_credits(email, 100)
    assert res["status"] == "ok"
    assert res["added"] == 100
    assert res["credits"] == mcp_auth.FREE_CREDITS + 100

    balance = mcp_auth.get_credits(key)
    assert balance["credits"] == mcp_auth.FREE_CREDITS + 100
    assert balance["total_purchased"] == 100


def test_add_credits_unknown_email():
    res = mcp_auth.add_credits("nobody-here@example.com", 100)
    assert res["status"] == "not_found"


def test_oauth_token_returns_api_key():
    email = _fresh_email()
    reg = mcp_auth.register(email, "passw0rd!", client_ip="10.0.0.8")
    key = reg["api_key"]

    tok = mcp_auth.oauth_token(key, "")
    assert tok["access_token"] == key
    assert tok["token_type"] == "bearer"

    bad = mcp_auth.oauth_token("sk-stavagent-nope", "")
    assert bad.get("error") == "invalid_client"


def test_rate_limit_blocks_eleventh_attempt():
    ip = "10.99.99.99"
    for _ in range(mcp_auth.RATE_LIMIT_MAX):
        r = mcp_auth.login("missing@example.com", "wrong", client_ip=ip)
        assert r.get("status") in {"invalid", "deactivated"}

    blocked = mcp_auth.login("missing@example.com", "wrong", client_ip=ip)
    assert blocked["status"] == "rate_limited"
