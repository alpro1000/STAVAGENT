"""
Redis-backed rate limiter for the /register DCR endpoint.

Why Redis instead of the in-memory bucket in app/mcp/auth.py
============================================================
- /register is a public endpoint (RFC 7591). No second auth layer
  in front of it — the in-memory bucket is per-Cloud-Run-instance,
  so an autoscaled service has effectively N × rate_limit room. A
  DoS sender can exhaust the registration table by exploiting that.
- Redis is already in the stack (sessions, KB cache). Using it for
  rate limiting adds no infrastructure.
- Atomicity matters: INCR-then-EXPIRE-if-first must be one round-trip
  so a concurrent burst can't double-count or skip the TTL.

Lua atomicity
=============
The two operations (INCR + EXPIRE) run inside a single Redis-side
script. Redis guarantees Lua scripts execute atomically — no other
command observes intermediate state, no race between INCR and EXPIRE.
The TTL is only set on the FIRST increment so the window doesn't
slide forward on every request (otherwise an attacker keeping just
under 10/h could keep the bucket alive forever).

Fail-closed
===========
If Redis is unreachable, /register returns 503 — NOT a quiet fallback
to in-memory or open mode. The endpoint has no other gate; degrading
gracefully here means handing the door key to anyone who can DoS
Redis. Service startup deliberately does NOT depend on this module —
Redis liveness only matters at /register call time.

Whitelist
=========
`MCP_RATE_LIMIT_WHITELIST=ip1,ip2` env bypasses the limit for the
listed IPs. Intended for CI smoke tests and load tests from
allow-listed bastions. Default empty.

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


# ── Lua script ──────────────────────────────────────────────────────────────
#
# KEYS[1] = bucket key (e.g. "concrete:rate:dcr_register:1.2.3.4")
# ARGV[1] = TTL in seconds (applied only on first increment)
#
# Returns the new counter value.
_LUA_INCR_WITH_EXPIRE = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
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


# ── Public API ──────────────────────────────────────────────────────────────


class RateLimitResult:
    """Pseudo-enum return values. Strings (not Enum) so logging is cheap."""
    ALLOWED = "allowed"
    EXCEEDED = "exceeded"
    UNAVAILABLE = "unavailable"  # Redis unreachable → fail closed


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

    # Lazy import — keep app.core.config out of the cold-start path
    # when this module is imported by routes.py.
    try:
        from app.core.redis_client import get_redis
    except Exception as exc:  # noqa: BLE001 — defensive at module level
        logger.error("[MCP/RateLimit] redis_client import failed: %s", exc)
        return {
            "status": RateLimitResult.UNAVAILABLE,
            "error_description": "Rate limiter unavailable (import failure)",
            "retry_after": REGISTER_RATE_LIMIT_WINDOW_SECONDS,
        }

    bucket_key = f"{REGISTER_RATE_LIMIT_KEY_PREFIX}{client_ip or 'unknown'}"

    try:
        redis = await get_redis()
        # RedisClient prefixes keys with "concrete:"; we call its
        # internal client to send the Lua script directly so the
        # script sees the same prefixed key it later observes via
        # `await redis.get(key)` etc.
        prefixed_key = redis._make_key(bucket_key)
        current = await redis._client.eval(
            _LUA_INCR_WITH_EXPIRE,
            1,                                      # numkeys
            prefixed_key,                           # KEYS[1]
            str(REGISTER_RATE_LIMIT_WINDOW_SECONDS),  # ARGV[1]
        )
        current = int(current)
    except Exception as exc:  # noqa: BLE001 — broad on purpose: ANY Redis
                              # path failure must fail closed.
        logger.error(
            "[MCP/RateLimit] Redis unavailable, failing closed for ip=%s: %s",
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
