"""
Tests for the Postgres-backed /register rate limiter (Gate 6; ex-Redis,
cost-audit task 3).

Three layers covered:

  1. Pure helpers (`extract_client_ip`, `_parse_whitelist`,
     `reload_whitelist_from_env`) — no DB required.
  2. Goldens against a FIXTURE Postgres (DATABASE_URL; CI service container
     or local PG16). Self-sufficient: the module fixture applies migration
     013 idempotently. Covers the 11th-request boundary, separate buckets,
     window expiry reset, and TRUE concurrency (11 threads, each with its
     own pooled connection, exactly 10 allowed).
  3. Fail-closed without any DB — `_get_conn` monkeypatched to raise →
     status=unavailable, no local fallback counting, whitelist still works.

Endpoint integration (429 + Retry-After + audit row, 503 fail-closed) lives
in test_mcp_dcr_endpoint.py / test_mcp_dcr_integration.py via monkeypatched
`check_register_rate_limit` — unchanged by the Redis→Postgres port.

Reference: TASK_DCR_KBYamlLoader.md Gate 6;
docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md §2.2.
"""

import asyncio
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.mcp import rate_limit as rl

_HAS_PG = bool(os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL"))

requires_pg = pytest.mark.skipif(
    not _HAS_PG,
    reason="DATABASE_URL not set — fixture-Postgres rate-limit goldens skipped",
)


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


# ── UPSERT statement sanity (replaces the Lua-script sanity tests) ──────────


def test_upsert_sql_is_single_statement_increment_or_reset():
    """Defensive: the whole transition must live in ONE statement —
    splitting it into SELECT+UPDATE would reopen the burst race the
    Redis Lua script existed to close."""
    sql = rl._UPSERT_BUCKET_SQL
    assert "ON CONFLICT (bucket_key) DO UPDATE" in sql
    assert sql.rstrip().endswith("RETURNING count")
    # Window reset must be conditional (fixed window, not sliding)
    assert sql.count("CASE") == 2


def test_upsert_sql_binds_interval_not_interpolates():
    """`(%s * INTERVAL '1 second')` routes the window through parameter
    binding — never interpolate into an INTERVAL literal (soul.md §9
    SQL-bind refactor)."""
    assert "(%s * INTERVAL '1 second')" in rl._UPSERT_BUCKET_SQL
    assert "INTERVAL '%s" not in rl._UPSERT_BUCKET_SQL


def test_bucket_key_format_includes_namespace_and_ip():
    """Operational requirement: keys must be greppable by IP."""
    expected = f"{rl.REGISTER_RATE_LIMIT_KEY_PREFIX}1.2.3.4"
    assert expected == "rate:dcr_register:1.2.3.4"


# ── Fixture Postgres lane ───────────────────────────────────────────────────

_MIGRATION_013 = (
    Path(__file__).parent.parent / "migrations" / "013_mcp_rate_limit_buckets.sql"
)


@pytest.fixture(scope="module")
def pg_schema():
    """Apply migration 013 idempotently so the lane is self-sufficient
    (locally and in CI, regardless of whether the workflow's psql loop
    already ran it)."""
    from app.mcp import auth as mcp_auth
    conn = mcp_auth._get_db()
    with conn.cursor() as cur:
        cur.execute(_MIGRATION_013.read_text())
    conn.commit()
    yield


@pytest.fixture
def pg_ip(pg_schema, monkeypatch):
    """Unique IP per test (no cross-test bucket pollution) + row cleanup."""
    monkeypatch.delenv("MCP_RATE_LIMIT_WHITELIST", raising=False)
    rl.reload_whitelist_from_env()
    ip = f"test-{uuid.uuid4().hex[:12]}"
    yield ip
    from app.mcp import auth as mcp_auth
    conn = mcp_auth._get_db()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM mcp_rate_limit_buckets WHERE bucket_key LIKE %s",
            (f"{rl.REGISTER_RATE_LIMIT_KEY_PREFIX}test-%",),
        )
    conn.commit()


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


@requires_pg
def test_first_ten_requests_allowed(pg_ip):
    """GOLDEN: first 10 increments → allowed, current = 1..10."""
    for i in range(1, 11):
        result = _run(rl.check_register_rate_limit(pg_ip))
        assert result["status"] == rl.RateLimitResult.ALLOWED, f"hit #{i}"
        assert result["current"] == i
        assert result["limit"] == 10


@requires_pg
def test_eleventh_request_exceeded(pg_ip):
    """GOLDEN: 11th → exceeded with retry_after = window."""
    for _ in range(10):
        _run(rl.check_register_rate_limit(pg_ip))
    result = _run(rl.check_register_rate_limit(pg_ip))
    assert result["status"] == rl.RateLimitResult.EXCEEDED
    assert result["current"] == 11
    assert result["retry_after"] == 3600


@requires_pg
def test_different_ips_separate_buckets(pg_ip):
    """Two IPs each get their own 10-quota bucket."""
    other_ip = f"test-{uuid.uuid4().hex[:12]}"
    for _ in range(10):
        r1 = _run(rl.check_register_rate_limit(pg_ip))
        r2 = _run(rl.check_register_rate_limit(other_ip))
        assert r1["status"] == rl.RateLimitResult.ALLOWED
        assert r2["status"] == rl.RateLimitResult.ALLOWED
    r3 = _run(rl.check_register_rate_limit(pg_ip))
    assert r3["status"] == rl.RateLimitResult.EXCEEDED


@requires_pg
def test_window_expiration_resets_counter(pg_ip):
    """An expired window resets count to 1 IN the same UPSERT — simulate
    expiry by rewinding window_start past the window."""
    from app.mcp import auth as mcp_auth
    for _ in range(10):
        _run(rl.check_register_rate_limit(pg_ip))
    conn = mcp_auth._get_db()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE mcp_rate_limit_buckets SET window_start = NOW() - INTERVAL '2 hours' "
            "WHERE bucket_key = %s",
            (f"{rl.REGISTER_RATE_LIMIT_KEY_PREFIX}{pg_ip}",),
        )
    conn.commit()
    result = _run(rl.check_register_rate_limit(pg_ip))
    assert result["status"] == rl.RateLimitResult.ALLOWED
    assert result["current"] == 1


@requires_pg
def test_concurrent_11_threads_exactly_10_allowed(pg_ip):
    """TRUE concurrency: 11 threads, each with its OWN pooled connection
    (auth pool is thread-local), hammer one bucket. The PK row lock on
    ON CONFLICT serializes them — exactly one allowed→exceeded boundary,
    counters 1..11 with no gaps or duplicates."""
    def hit():
        return _run(rl.check_register_rate_limit(pg_ip))

    with ThreadPoolExecutor(max_workers=11) as pool:
        results = list(pool.map(lambda _: hit(), range(11)))

    allowed = [r for r in results if r["status"] == rl.RateLimitResult.ALLOWED]
    exceeded = [r for r in results if r["status"] == rl.RateLimitResult.EXCEEDED]
    assert len(allowed) == 10
    assert len(exceeded) == 1
    assert sorted(r["current"] for r in results) == list(range(1, 12))


@requires_pg
def test_failed_statement_does_not_poison_shared_connection(pg_ip):
    """The limiter shares the thread-local auth connection. A failed
    statement must roll back so the NEXT query on the same connection
    works — an aborted-tx leak would break auth calls downstream."""
    from app.mcp import auth as mcp_auth
    bad_sql = rl._UPSERT_BUCKET_SQL
    try:
        rl._UPSERT_BUCKET_SQL = "INSERT INTO no_such_table VALUES (1)"
        result = _run(rl.check_register_rate_limit(pg_ip))
        assert result["status"] == rl.RateLimitResult.UNAVAILABLE
    finally:
        rl._UPSERT_BUCKET_SQL = bad_sql
    # Same thread → same pooled connection → must be usable again
    conn = mcp_auth._get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT 1 AS ok")
        assert cur.fetchone()["ok"] == 1
    conn.rollback()


# ── Postgres unreachable → fail closed (no DB needed) ───────────────────────


@pytest.fixture
def db_down(monkeypatch):
    monkeypatch.delenv("MCP_RATE_LIMIT_WHITELIST", raising=False)
    rl.reload_whitelist_from_env()

    def boom():
        raise RuntimeError("simulated Postgres outage")

    monkeypatch.setattr(rl, "_get_conn", boom)


def test_db_unreachable_fails_closed(db_down):
    """GOLDEN: _get_conn raises → status=unavailable, NOT allowed."""
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.UNAVAILABLE
    assert "error_description" in result
    assert result["retry_after"] == 3600


def test_db_unreachable_does_not_increment_locally(db_down):
    """Fail-closed path must NOT fall back to any in-memory counter
    (defensive — would silently re-open the DoS surface)."""
    for _ in range(20):
        result = _run(rl.check_register_rate_limit("203.0.113.1"))
        assert result["status"] == rl.RateLimitResult.UNAVAILABLE


def test_whitelist_bypasses_even_with_db_down(db_down, monkeypatch):
    """Whitelist short-circuits BEFORE any DB access — CI smoke bastions
    keep working through a database outage."""
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "10.0.0.7")
    rl.reload_whitelist_from_env()
    for _ in range(100):
        result = _run(rl.check_register_rate_limit("10.0.0.7"))
        assert result["status"] == rl.RateLimitResult.ALLOWED
        assert result["whitelisted"] is True
        assert result["current"] == 0


def test_whitelist_does_not_bypass_for_other_ips(db_down, monkeypatch):
    monkeypatch.setenv("MCP_RATE_LIMIT_WHITELIST", "10.0.0.7")
    rl.reload_whitelist_from_env()
    # Different IP gets normal treatment — and with the DB down that
    # means fail-closed, never silent allow.
    result = _run(rl.check_register_rate_limit("203.0.113.1"))
    assert result["status"] == rl.RateLimitResult.UNAVAILABLE
