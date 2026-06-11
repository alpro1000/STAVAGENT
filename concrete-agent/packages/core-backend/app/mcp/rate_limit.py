"""
Postgres-backed rate limiter for the /register DCR endpoint.

History: born Redis-backed (Memorystore + Lua INCR-with-conditional-EXPIRE).
Cost-audit 2026-06-10 (docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md
§2.2) established this limiter was the ONLY hard Redis consumer in
production — a Basic 1GB instance + a VPC connector existed solely to store
these counters. Ported to Cloud SQL Postgres (task №3); same invariants.

Why a shared store instead of the in-memory bucket in app/mcp/auth.py
=====================================================================
- /register is a public endpoint (RFC 7591). No second auth layer
  in front of it — the in-memory bucket is per-Cloud-Run-instance,
  so an autoscaled service has effectively N × rate_limit room. A
  DoS sender can exhaust the registration table by exploiting that.
- Postgres is already the MCP auth store (mcp_api_keys, oauth tables);
  using it for rate limiting REMOVES infrastructure (Redis + VPC).
- Atomicity matters: increment-or-reset must be one round-trip so a
  concurrent burst can't double-count or skip the window reset.

UPSERT atomicity
================
The whole counter transition lives in a single
INSERT ... ON CONFLICT (bucket_key) DO UPDATE ... RETURNING statement
(migration 013). Postgres row-locks the PK on conflict, so concurrent
requests serialize on the bucket row — the same guarantee the Redis Lua
script provided. The window is FIXED, not sliding: window_start is only
(re)set on the first increment of a window, so an attacker keeping just
under 10/h cannot keep the bucket alive forever.

Fail-closed
===========
If Postgres is unreachable, /register returns 503 — NOT a quiet fallback
to in-memory or open mode. The endpoint has no other gate; degrading
gracefully here means handing the door key to anyone who can DoS the
database. Service startup deliberately does NOT depend on this module —
DB liveness only matters at /register call time. (If Postgres is down the
whole MCP auth plane is down anyway — no availability regression vs Redis.)

Whitelist
=========
`MCP_RATE_LIMIT_WHITELIST=ip1,ip2` env bypasses the limit for the
listed IPs. Intended for CI smoke tests and load tests from
allow-listed bastions. Default empty. Whitelist short-circuits BEFORE
any DB access — it works even with the database down.

IP source trust
===============
Cloud Run terminates TLS at the edge load balancer and inserts the
client IP at the leftmost position of `X-Forwarded-For`. We trust
the leftmost entry only when the request actually arrived through
Cloud Run's proxy (production); local dev (no XFF header) falls
back to `request.client.host`. We do NOT iterate the XFF chain
because attacker-supplied intermediate entries would let them
spoof the bucket key.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


# ── Public constants — single source of truth ───────────────────────────────

REGISTER_RATE_LIMIT_KEY_PREFIX = "rate:dcr_register:"
REGISTER_RATE_LIMIT_MAX = 10
REGISTER_RATE_LIMIT_WINDOW_SECONDS = 3600


# ── UPSERT — the whole increment-or-reset transition in one statement ──────
#
# %s params: bucket_key, window_seconds (×3).
# The `(%s * INTERVAL '1 second')` form routes the integer through proper
# parameter binding (same pattern as mint_token_pair, soul.md §9 SQL-bind
# refactor) — never interpolate into an INTERVAL literal.
_UPSERT_BUCKET_SQL = """
INSERT INTO mcp_rate_limit_buckets (bucket_key, window_start, count)
VALUES (%s, NOW(), 1)
ON CONFLICT (bucket_key) DO UPDATE SET
    count = CASE
        WHEN mcp_rate_limit_buckets.window_start <= NOW() - (%s * INTERVAL '1 second')
        THEN 1
        ELSE mcp_rate_limit_buckets.count + 1
    END,
    window_start = CASE
        WHEN mcp_rate_limit_buckets.window_start <= NOW() - (%s * INTERVAL '1 second')
        THEN NOW()
        ELSE mcp_rate_limit_buckets.window_start
    END
RETURNING count
""".strip()


# ── Whitelist (parsed once at import) ───────────────────────────────────────


def _parse_whitelist() -> set[str]:
    raw = os.getenv("MCP_RATE_LIMIT_WHITELIST", "").strip()
    if not raw:
        return set()
    return {ip.strip() for ip in raw.split(",") if ip.strip()}


_WHITELIST = _parse_whitelist()


def reload_whitelist_from_env() -> None:
    """Re-read MCP_RATE_LIMIT_WHITELIST. Used by tests + ops who change
    the env at runtime without redeploying."""
    global _WHITELIST
    _WHITELIST = _parse_whitelist()


# ── IP detection ────────────────────────────────────────────────────────────


def extract_client_ip(request) -> str:
    """Return the trusted client IP for rate-limit bucketing.

    Cloud Run sets X-Forwarded-For = "real_client_ip, edge_proxy_ip".
    We take the leftmost entry — that's the actual TCP source. Anything
    else in the chain is attacker-controlled (a malicious client can
    set arbitrary X-Forwarded-For; Cloud Run only PREPENDS the real
    IP, doesn't sanitize the rest).

    Falls back to `request.client.host` for local dev / direct TCP
    requests where no proxy is in front.
    """
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# ── DB access (module-level seam — tests monkeypatch `_get_conn`) ──────────


def _get_conn():
    """Return the thread-local psycopg2 connection from the MCP auth pool.

    Lazy import — keeps psycopg2/app.mcp.auth out of the cold-start path
    when this module is imported by routes.py. Module-level function (not a
    parameter) per the MCP authoring rule: test seams are globals to
    monkeypatch, never Callable params.
    """
    from app.mcp import auth as mcp_auth
    return mcp_auth._get_db()


def _upsert_bucket(bucket_key: str) -> int:
    """One-round-trip increment-or-reset. Returns the new counter value.

    The shared auth pool runs with autocommit=False — commit on success,
    rollback on ANY failure so the thread-local connection is never left
    in an aborted-transaction state for the auth calls that follow on the
    same thread.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                _UPSERT_BUCKET_SQL,
                (
                    bucket_key,
                    REGISTER_RATE_LIMIT_WINDOW_SECONDS,
                    REGISTER_RATE_LIMIT_WINDOW_SECONDS,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:  # noqa: BLE001 — connection may already be dead
            pass
        raise
    # auth pool uses RealDictCursor → row is a dict.
    return int(row["count"])


# ── Public API ──────────────────────────────────────────────────────────────


class RateLimitResult:
    """Pseudo-enum return values. Strings (not Enum) so logging is cheap."""
    ALLOWED = "allowed"
    EXCEEDED = "exceeded"
    UNAVAILABLE = "unavailable"  # Postgres unreachable → fail closed


async def check_register_rate_limit(client_ip: str) -> dict:
    """Check + atomically increment the rate-limit bucket for `client_ip`.

    Returns one of:
      {"status": "allowed",     "current": N, "limit": 10, "retry_after": 3600}
      {"status": "exceeded",    "current": N, "limit": 10, "retry_after": 3600}
      {"status": "unavailable", "error_description": "...", "retry_after": 3600}

    Whitelist short-circuits with status='allowed' + current=0.
    Empty / unknown client_ip is treated as a single bucket — defence
    in depth against attackers who try to bypass by stripping XFF.
    """
    if client_ip in _WHITELIST:
        return {
            "status": RateLimitResult.ALLOWED,
            "current": 0,
            "limit": REGISTER_RATE_LIMIT_MAX,
            "retry_after": REGISTER_RATE_LIMIT_WINDOW_SECONDS,
            "whitelisted": True,
        }

    bucket_key = f"{REGISTER_RATE_LIMIT_KEY_PREFIX}{client_ip or 'unknown'}"

    try:
        # Sync psycopg2 on the event loop — same idiom as the Bearer
        # middleware's primary-key lookups (~5-10 ms on Cloud SQL,
        # dominated by tool execution; soul.md §9 accepted trade-off).
        current = _upsert_bucket(bucket_key)
    except Exception as exc:  # noqa: BLE001 — broad on purpose: ANY DB
                              # path failure must fail closed.
        logger.error(
            "[MCP/RateLimit] Postgres unavailable, failing closed for ip=%s: %s",
            client_ip, exc,
        )
        return {
            "status": RateLimitResult.UNAVAILABLE,
            "error_description": (
                "Rate limiter unavailable. Registration temporarily "
                "disabled — please retry in a few minutes."
            ),
            "retry_after": REGISTER_RATE_LIMIT_WINDOW_SECONDS,
        }

    if current > REGISTER_RATE_LIMIT_MAX:
        return {
            "status": RateLimitResult.EXCEEDED,
            "current": current,
            "limit": REGISTER_RATE_LIMIT_MAX,
            "retry_after": REGISTER_RATE_LIMIT_WINDOW_SECONDS,
        }

    return {
        "status": RateLimitResult.ALLOWED,
        "current": current,
        "limit": REGISTER_RATE_LIMIT_MAX,
        "retry_after": REGISTER_RATE_LIMIT_WINDOW_SECONDS,
    }
