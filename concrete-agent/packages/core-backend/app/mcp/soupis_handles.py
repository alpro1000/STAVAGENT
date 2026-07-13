"""Owner-scoped, TTL'd store for pre-parsed soupis handles (Variant B: upload → ref).

Closes the "6.6 MB soupis can't ride an MCP call" gap: the caller uploads the
file once (multipart, out of the model context), the server parses it, and this
module persists the COMPACT parsed result under an unguessable `soupis-{hex32}`
handle bound to the uploader. `build_bridge_passport` later reads it by
`soupis_ref` instead of re-decoding megabytes of base64.

Isolation invariants (docs/security/isolation_model.md, in the MCP auth surface):
  * owner_id = `mcp_api_keys.id`, stamped from the VERIFIED bearer at save() —
    never from a request body;
  * resolve() is owner-scoped in the SQL (`WHERE soupis_ref=%s AND owner_id=%s`)
    with an `expires_at > NOW()` guard — a ref owned by someone else, unknown, or
    expired all read as None (caller maps to a not-found-shaped typed error, no
    existence leak);
  * this is the owner dimension passport_store / bridge_passport_store lack.

DB access reuses the MCP auth psycopg2 pool (`app.mcp.auth._get_db`, thread-local,
RealDictCursor) — the same sync-in-async convention as `check_credits`. The
upload rate limiter reuses the Postgres fixed-window bucket in `app.mcp.rate_limit`
(1-hour window, survives cold start).
"""
from __future__ import annotations

import json
import logging
import secrets
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_TTL_HOURS = 24
# Per-owner upload budget. The rate_limit bucket window is a fixed 1 hour, so
# this is "N per hour per api-key". A size cap without a frequency cap is only
# half the protection (Alexander).
UPLOAD_RATE_LIMIT_PER_HOUR = 30
# 20 MB — a real soupis is ~6.6 MB, so ~3× headroom; raise by fact if a bigger
# one shows up. The cap bounds both the parse cost and the abuse surface.
MAX_UPLOAD_BYTES = 20 * 1024 * 1024

_SOUPIS_REF_PREFIX = "soupis-"


def _db():
    """Thread-local psycopg2 connection from the shared MCP auth pool (lazy import
    keeps psycopg2/auth off the cold-start path for importers of this module)."""
    from app.mcp import auth as mcp_auth
    return mcp_auth._get_db()


def new_ref() -> str:
    """Fresh 128-bit unguessable handle. New ref per upload (no content dedup)."""
    return f"{_SOUPIS_REF_PREFIX}{secrets.token_hex(16)}"


def owner_id_for_api_key(api_key: Optional[str]) -> Optional[int]:
    """Resolve a verified bearer to `mcp_api_keys.id`, or None if it is not a
    valid owner.

    Routes through the canonical dual-prefix resolver so BOTH auth surfaces agree
    on who owns a handle:
      * `sk-stavagent-*`   → itself → id;
      * user-bound `sat-*` → its `user_api_key` (the bound sk-*) → id, so a
                             Claude.ai OAuth caller resolves on the REST upload
                             path exactly as it does on the /mcp tool path;
      * anonymous / public-DCR (user_api_key NULL) / revoked / expired /
        inactive / malformed → None.

    The caller MUST reject None for isolation (never mint or read owned state
    without a resolved owner). No caller-supplied owner is ever trusted.
    """
    if not api_key:
        return None
    from app.mcp import auth as mcp_auth
    resolved_key = mcp_auth.resolve_bearer_token(api_key).get("user_api_key")
    if not resolved_key:
        return None
    return mcp_auth._resolve_initial_access_user_id(resolved_key)


def upload_rate_limited(owner_id: int) -> bool:
    """True when this owner has exceeded the per-hour upload budget. Backed by the
    Postgres fixed-window bucket (atomic increment-or-reset, one row per owner per
    window) so the limit holds across Cloud Run instances and cold starts."""
    from app.mcp import rate_limit as _rl
    count = _rl._upsert_bucket(f"rate:soupis_upload:{owner_id}")
    return count > UPLOAD_RATE_LIMIT_PER_HOUR


def save(
    owner_id: int,
    parsed_budget: dict,
    *,
    filename: str = "",
    format_detected: Optional[str] = None,
    size_bytes: Optional[int] = None,
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> str:
    """Persist a compact parsed soupis under a fresh owner-bound handle. Returns
    the `soupis_ref`. `parsed_budget` is the `parse_construction_budget` output
    (`{items:[...], ...}`) — NOT the raw file."""
    ref = new_ref()
    total_items = len(parsed_budget.get("items") or [])
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO mcp_soupis_handles "
                "(soupis_ref, owner_id, parsed_budget, filename, format_detected, "
                " total_items, size_bytes, expires_at) "
                "VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, "
                "        NOW() + (%s * INTERVAL '1 hour'))",
                (
                    ref, owner_id,
                    json.dumps(parsed_budget, ensure_ascii=False),
                    filename or None, format_detected, total_items, size_bytes,
                    ttl_hours,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return ref


def resolve(soupis_ref: str, owner_id: Optional[int]) -> Optional[dict]:
    """Owner-scoped, expiry-guarded resolve.

    Returns `{parsed_budget, filename, format_detected, total_items}` when the
    handle exists, belongs to `owner_id`, and is unexpired. Returns None for
    ANY miss (unknown ref / cross-owner / expired / anonymous owner_id) — all the
    same not-found shape, so a caller can't distinguish "someone else's ref" from
    "no such ref". Expired rows read as None (lazy GC); the periodic sweep deletes
    them.
    """
    if not soupis_ref or owner_id is None:
        return None
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT parsed_budget, filename, format_detected, total_items "
                "FROM mcp_soupis_handles "
                "WHERE soupis_ref = %s AND owner_id = %s AND expires_at > NOW()",
                (soupis_ref, owner_id),
            )
            row = cur.fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    if not row:
        return None
    pb = row["parsed_budget"]
    if isinstance(pb, str):  # tolerate a driver that returns JSONB as text
        pb = json.loads(pb)
    return {
        "parsed_budget": pb,
        "filename": row["filename"],
        "format_detected": row["format_detected"],
        "total_items": row["total_items"],
    }


def purge_expired() -> int:
    """Delete all expired handles; return the count. Called both lazily and from
    the mandatory periodic sweep (unread-but-expired rows never get lazy-GC'd)."""
    conn = _db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM mcp_soupis_handles WHERE expires_at <= NOW() "
                "RETURNING soupis_ref"
            )
            n = len(cur.fetchall())
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    if n:
        logger.info("[MCP/SoupisHandles] purged %d expired handle(s)", n)
    return n
