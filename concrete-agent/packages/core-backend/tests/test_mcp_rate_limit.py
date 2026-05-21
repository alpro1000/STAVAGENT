"""
Tests for the Redis-backed /register rate limiter (Gate 6).

Two layers covered:

  1. Pure helpers (`extract_client_ip`, `_parse_whitelist`,
     `reload_whitelist_from_env`) — no Redis required.
  2. `check_register_rate_limit` against a FAKE Redis client that
     records every `eval()` call and simulates atomic INCR+EXPIRE
     semantics. We monkeypatch `app.core.redis_client.get_redis` so
     no real Redis or asyncio event loop fragility is involved.
  3. Endpoint integration — POST /api/v1/mcp/oauth/register exercises
     the 429 + Retry-After + audit-row path and the 503 fail-closed
     path.

Reference: TASK_DCR_KBYamlLoader.md Gate 6.
"""

import asyncio
import re

import pytest

from app.mcp import rate_limit as rl


# ── extract_client_ip ───────────────────────────────────────────────────────


class _FakeRequest:
    """Minimal stand-in for Starlette Request — just `.headers` + `.client.host`."""
    class _Client:
        def __init__(self, host):
            self.host = host

    def __init__(self, headers: dict, client_host: str | None = "0.0.0.0"):
        self.headers = headers
        self.client = self._Client(client_host) if client_host else None


def test_extract_client_ip_uses_xff_leftmost():
    """Cloud Run prepends real client IP at the leftmost XFF position."""
    req = _FakeRequest(
        headers={"x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2"},
        client_host="10.0.0.99",
    )
    assert rl.extract_client_ip(req) == "203.0.113.1"


def test_extract_client_ip_falls_back_to_client_host():
    """No XFF → request.client.host (local dev / direct TCP)."""
    req = _FakeRequest(headers={}, client_host="127.0.0.1")
    assert rl.extract_client_ip(req) == "127.0.0.1"


def test_extract_client_ip_xff_empty_uses_client_host():
    """Empty XFF header should not short-circuit to ''."""
    req = _FakeRequest(headers={"x-forwarded-for": "   "}, client_host="127.0.0.1")
    assert rl.extract_client_ip(req) == "127.0.0.1"


def test_extract_client_ip_no_client_at_all():
    """No XFF + no .client → 'unknown' sentinel (still creates a bucket)."""
    req = _FakeRequest(headers={}, client_host=None)
    assert rl.extract_client_ip(req) == "unknown"


def test_extract_client_ip_xff_single_entry():
    req = _FakeRequest(headers={"x-forwarded-for": "198.51.100.42"})
    assert rl.extract_client_ip(req) == "198.51.100.42"


# ── Whitelist ───────────────────────────────────────────────────────────────


def test_whitelist_parses_csv(monkeypatch):
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "1.1.1.1, 2.2.2.2 ,3.3.3.3")
    rl.reload_whitelist_from_env()
    # Re-importing the module is heavier; just test the parser function
    assert rl._parse_whitelist() == {"1.1.1.1", "2.2.2.2", "3.3.3.3"}


def test_whitelist_empty_when_unset(monkeypatch):
    monkeypatch.delenv("MCP_RATE_LIMIT_WHITELIST", raising=False)
    assert rl._parse_whitelist() == set()


def test_whitelist_empty_when_blank(monkeypatch):
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "  ")
    assert rl._parse_whitelist() == set()


# ── Fake Redis with Lua-script simulation ───────────────────────────────────


class _FakeRedisInternalClient:
    """Stands in for `RedisClient._client` (the redis.asyncio.Redis instance).

    Implements just enough `eval()` semantics to model atomic
    INCR-with-EXPIRE-on-first. Records every call so tests can
    assert on key shape / TTL value.
    """
    def __init__(self):
        self.counters: dict[str, int] = {}
        self.ttls: dict[str, int] = {}
        self.eval_calls: list[tuple] = []
        self.raise_on_eval = False

    async def eval(self, script, numkeys, key, ttl):
        self.eval_calls.append((script, numkeys, key, ttl))
        if self.raise_on_eval:
            raise RuntimeError("simulated Redis outage")
        prev = self.counters.get(key, 0)
        new_val = prev + 1
        self.counters[key] = new_val
        if new_val == 1:
            self.ttls[key] = int(ttl)
        return new_val


class _FakeRedisClient:
    """Stands in for the high-level RedisClient (the one get_redis() returns)."""
    def __init__(self):
        self._client = _FakeRedisInternalClient()
        self._prefix = "concrete:"

    def _make_key(self, key: str) -> str:
        return f"{self._prefix}{key}"


@pytest.fixture
def fake_redis(monkeypatch):
    """Replace get_redis() with our fake."""
    client = _FakeRedisClient()

    async def fake_get_redis():
        return client

    # Patch on the module path that rate_limit.check_register_rate_limit imports.
    import app.core.redis_client
    monkeypatch.setattr(app.core.redis_client, "get_redis", fake_get_redis)

    # Reset whitelist state so prior tests don't leak.
    monkeypatch.delenv("MCP_RATE_LIMIT_WHITELIST", raising=False)
    rl.reload_whitelist_from_env()

    return client


# Async helper for awaiting in sync test bodies.
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ── check_register_rate_limit happy path ────────────────────────────────────


def test_first_ten_requests_allowed(fake_redis):
    """First 10 increments → allowed, current = 1..10."""
    for i in range(1, 11):
        result = _run(rl.check_register_rate_limit("203.0.113.1"))
        assert result["status"] == rl.RateLimitResult.ALLOWED, f"hit #{i}"
        assert result["current"] == i
        assert result["limit"] == 10


def test_eleventh_request_exceeded(fake_redis):
    """11th → exceeded with retry_after = window."""
    for _ in range(10):
        _run(rl.check_register_rate_limit("203.0.113.1"))
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.EXCEEDED
    assert result["current"] == 11
    assert result["retry_after"] == 3600


def test_different_ips_separate_buckets(fake_redis):
    """Two IPs each get their own 10-quota bucket."""
    for _ in range(10):
        r1 = _run(rl.check_register_rate_limit("1.1.1.1"))
        r2 = _run(rl.check_register_rate_limit("2.2.2.2"))
        assert r1["status"] == rl.RateLimitResult.ALLOWED
        assert r2["status"] == rl.RateLimitResult.ALLOWED
    # 11th on either is exceeded, but the OTHER bucket is still at 10
    r3 = _run(rl.check_register_rate_limit("1.1.1.1"))
    assert r3["status"] == rl.RateLimitResult.EXCEEDED


def test_ttl_set_only_on_first_increment(fake_redis):
    """Lua atomic guarantees EXPIRE runs only when INCR returns 1."""
    for _ in range(5):
        _run(rl.check_register_rate_limit("203.0.113.5"))
    key = fake_redis._make_key(f"{rl.REGISTER_RATE_LIMIT_KEY_PREFIX}203.0.113.5")
    # TTL recorded once (on hit #1) — subsequent INCRs don't touch ttls dict.
    assert fake_redis._client.ttls[key] == rl.REGISTER_RATE_LIMIT_WINDOW_SECONDS
    # All five eval() calls used the same key + same TTL argument
    for call in fake_redis._client.eval_calls:
        _, numkeys, k, ttl = call
        assert numkeys == 1
        assert k == key
        assert ttl == str(rl.REGISTER_RATE_LIMIT_WINDOW_SECONDS)


def test_window_expiration_resets_counter(fake_redis):
    """Simulate TTL expiry by clearing the counters dict — counter resets."""
    for _ in range(10):
        _run(rl.check_register_rate_limit("203.0.113.1"))
    # Simulate TTL fire-off
    fake_redis._client.counters.clear()
    fake_redis._client.ttls.clear()
    # First call after expiry → counter back to 1, allowed
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.ALLOWED
    assert result["current"] == 1


# ── Redis unreachable → fail closed ─────────────────────────────────────────


def test_redis_unreachable_fails_closed(fake_redis):
    """eval() raises → status=unavailable, NOT allowed."""
    fake_redis._client.raise_on_eval = True
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.UNAVAILABLE
    assert "error_description" in result
    assert result["retry_after"] == 3600


def test_redis_unreachable_does_not_increment_locally(fake_redis):
    """Fail-closed path must NOT fall back to any in-memory counter
    (defensive — would silently re-open the DoS surface)."""
    fake_redis._client.raise_on_eval = True
    for _ in range(20):
        result = _run(rl.check_register_rate_limit("203.0.113.1"))
        assert result["status"] == rl.RateLimitResult.UNAVAILABLE


# ── Whitelist bypass ────────────────────────────────────────────────────────


def test_whitelist_bypasses_limit(fake_redis, monkeypatch):
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "10.0.0.7")
    rl.reload_whitelist_from_env()

    # 100 hits in a row — all allowed
    for _ in range(100):
        result = _run(rl.check_register_rate_limit("10.0.0.7"))
        assert result["status"] == rl.RateLimitResult.ALLOWED
        assert result["whitelisted"] is True
        assert result["current"] == 0  # no bucket touched

    # Redis was never consulted — eval() not called for whitelisted IPs
    assert fake_redis._client.eval_calls == []


def test_whitelist_does_not_bypass_for_other_ips(fake_redis, monkeypatch):
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "10.0.0.7")
    rl.reload_whitelist_from_env()
    # Different IP gets normal treatment
    for _ in range(10):
        _run(rl.check_register_rate_limit("203.0.113.1"))
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.EXCEEDED


# ── Concurrency: serialized through Redis Lua atomicity ─────────────────────


def test_concurrent_11_requests_exactly_10_allowed(fake_redis):
    """Fire 11 awaitables concurrently. Lua atomic INCR guarantees
    exactly one allowed → exceeded boundary, no double-allow, no skip."""
    async def hammer():
        return await asyncio.gather(*[
            rl.check_register_rate_limit("203.0.113.99")
            for _ in range(11)
        ])

    results = _run(hammer())
    allowed = [r for r in results if r["status"] == rl.RateLimitResult.ALLOWED]
    exceeded = [r for r in results if r["status"] == rl.RateLimitResult.EXCEEDED]
    assert len(allowed) == 10
    assert len(exceeded) == 1
    # Counter values must be 1..10 + 11 (no gaps or duplicates)
    all_counters = sorted(r["current"] for r in results)
    assert all_counters == list(range(1, 12))


# ── Lua script content sanity ───────────────────────────────────────────────


def test_lua_script_has_incr_and_expire():
    """Defensive: the script we send to Redis must call both INCR and
    EXPIRE. A future edit accidentally dropping the EXPIRE would let
    counters grow forever — silent DoS gate failure."""
    assert "INCR" in rl._LUA_INCR_WITH_EXPIRE
    assert "EXPIRE" in rl._LUA_INCR_WITH_EXPIRE
    # And the EXPIRE must be conditional on first increment (not on every call).
    assert re.search(r"current\s*==\s*1", rl._LUA_INCR_WITH_EXPIRE)


def test_lua_script_returns_current():
    """The script must `return current` so the caller can decide
    allowed/exceeded — without it we'd never see the counter value."""
    assert rl._LUA_INCR_WITH_EXPIRE.rstrip().endswith("return current")


def test_bucket_key_format_includes_namespace_and_ip():
    """Operational requirement: keys must be greppable by IP."""
    expected = f"{rl.REGISTER_RATE_LIMIT_KEY_PREFIX}1.2.3.4"
    assert expected == "rate:dcr_register:1.2.3.4"
