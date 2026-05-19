"""
MCP Auth + Credit System

Handles API key registration, authentication, and per-tool credit billing.
Stores keys in Cloud SQL Postgres (mcp_api_keys + mcp_credit_log tables,
migration 007). Connection is lazy — module imports do not open a DB
connection, so MCP tool wrappers and CI compatibility tests still load
without Postgres.

Security:
- bcrypt password hashing with per-user random salt
- Thread-safe Postgres via per-thread connection pool
- Atomic credit deduction: single UPDATE ... WHERE credits >= cost
  RETURNING credits — Postgres row lock prevents double-spend on
  concurrent requests
- Rate limiting on auth endpoints (in-memory, per-IP/identifier)

Free tools (OTSKP, classify) work without any authentication.
Paid tools require a valid API key with sufficient credits.
"""

import hashlib
import hmac
import logging
import os
import re
import secrets
import threading
import time
from collections import defaultdict
from typing import Optional

import bcrypt
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

# ── Tool credit costs ────────────────────────────────────────────────────────

TOOL_COSTS = {
    "find_otskp_code": 0,
    "classify_construction_element": 0,
    "search_czech_construction_norms": 1,
    "find_urs_code": 3,
    "get_construction_advisor": 3,
    "calculate_concrete_works": 5,
    "calculate_pump": 5,
    "parse_construction_budget": 5,
    "analyze_construction_document": 10,
    "create_work_breakdown": 20,
}

FREE_CREDITS = 200

# ── Rate limiter (in-memory, per-IP) ────────────────────────────────────────

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()
RATE_LIMIT_MAX = 10  # max attempts per window
RATE_LIMIT_WINDOW = 60  # seconds


def _check_rate_limit(identifier: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.monotonic()
    with _rate_lock:
        attempts = _rate_limit_store[identifier]
        # Prune old entries
        _rate_limit_store[identifier] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
        if len(_rate_limit_store[identifier]) >= RATE_LIMIT_MAX:
            return False
        _rate_limit_store[identifier].append(now)
        return True


# ── Thread-safe Postgres connection pool ────────────────────────────────────

_db_pool: dict[int, psycopg2.extensions.connection] = {}
_pool_lock = threading.Lock()


def _resolve_dsn() -> str:
    """Resolve Postgres DSN for sync psycopg2.

    Priority: MCP_DATABASE_URL → DATABASE_URL. The asyncpg dialect prefix
    (`+asyncpg`) is stripped because psycopg2 reads the standard libpq URI.

    Hardening for the 2026-05-14 Cloud SQL connection bug
    (docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md):

    - `.strip()` so a trailing newline accidentally pasted into a GCP Secret
      Manager value doesn't end up as part of the socket path. Portal's
      `pg` adapter already does this (`postgres.js:27`); MCP previously did
      not.
    - The `MCP_DATABASE_URL` env var lets ops point this service at a
      sync-compatible DSN (no `+asyncpg`, explicit password if needed)
      without disturbing the async `DATABASE_URL` used by Alembic /
      SQLAlchemy elsewhere in the codebase. Code already supported it
      via the priority order above — this docstring just spells it out.
    """
    url = (os.getenv("MCP_DATABASE_URL") or os.getenv("DATABASE_URL", "")).strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL (or MCP_DATABASE_URL) not set — MCP auth needs Cloud SQL Postgres. "
            "Local dev: export DATABASE_URL=postgresql://user:pass@localhost/db"
        )
    # Strip async dialect prefix used by SQLAlchemy elsewhere in the codebase.
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _sanitize_dsn_for_log(dsn: str) -> str:
    """Redact password from a DSN before logging.

    `postgresql://user:secret@/db?host=/cloudsql/...`
                       ^^^^^^ replaced with ***. Query string + host left
    intact so we can verify Cloud SQL socket path in production logs.

    `re` is imported at module level — this helper runs on every successful
    `_get_db()` connect, so the import-inside-function form would re-do a
    `sys.modules` lookup per call (Amazon Q review on PR #1148).
    """
    # Match user:password@ where password is anything except @ and /
    return re.sub(r"(://[^:@/]+:)[^@/]*(@)", r"\1***\2", dsn)


def _get_db() -> psycopg2.extensions.connection:
    """Get thread-local Postgres connection (thread-safe pool).

    Uses RealDictCursor by default so existing `row["col"]` access patterns
    keep working without rewrites. Autocommit is left OFF so register/login
    flows can group SELECT+INSERT in a transaction; credit deduction uses an
    explicit commit per call.
    """
    tid = threading.get_ident()
    with _pool_lock:
        existing = _db_pool.get(tid)
        if existing is not None:
            if not existing.closed:
                return existing
            # Closed connection — drop it so the dict doesn't accumulate
            # dead entries as threads churn (Cloud Run worker recycle, etc.).
            del _db_pool[tid]

    dsn = _resolve_dsn()
    try:
        conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)
    except psycopg2.OperationalError as exc:
        # Cloud Run + Cloud SQL: when the `--add-cloudsql-instances`
        # annotation is missing OR the Cloud SQL Auth Proxy sidecar fails
        # to start, the socket file `/cloudsql/INSTANCE/.s.PGSQL.5432` is
        # absent and libpq returns ENOENT. Surface the most likely cause
        # so the failure mode is obvious in Cloud Run logs.
        msg = str(exc)
        if "No such file or directory" in msg and "/cloudsql/" in msg:
            logger.error(
                "[MCP/Auth] Cloud SQL socket missing (%s). Likely cause: "
                "Cloud Run service deployed without `--set-cloudsql-instances=PROJECT:REGION:INSTANCE` "
                "OR the Cloud SQL Auth Proxy sidecar failed to start. "
                "DSN (sanitized): %s",
                msg.splitlines()[0] if msg else "unknown",
                _sanitize_dsn_for_log(dsn),
            )
        raise
    conn.set_session(autocommit=False)

    with _pool_lock:
        _db_pool[tid] = conn
    logger.info(
        "[MCP/Auth] Postgres connection for thread %s (DSN sanitized: %s)",
        tid, _sanitize_dsn_for_log(dsn),
    )
    return conn


def _execute(sql: str, params: tuple = ()) -> psycopg2.extensions.cursor:
    """Run a query on the thread-local connection, returning the cursor.

    Caller is responsible for fetch + commit semantics.
    """
    conn = _get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur
    except psycopg2.Error:
        conn.rollback()
        raise


def _hash_password(password: str) -> str:
    """Hash password with bcrypt (per-user random salt, adaptive cost)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _generate_api_key() -> str:
    """Generate a unique API key."""
    return f"sk-stavagent-{secrets.token_hex(24)}"


# ── DCR / OAuth crypto helpers (RFC 7591 + 6749) ────────────────────────────
#
# Distinct cryptographic surface from the user-password path above:
#   - User passwords use bcrypt (slow by design, defends against offline
#     dictionary attacks on stolen DB dumps).
#   - DCR client_secret + OAuth tokens use SHA-256 + 128-bit salt: the
#     secrets themselves carry 192 bits of entropy, can never be guessed
#     offline, and are verified on every server-to-server /token call
#     and every Bearer presentation. Slow hashing here would waste CPU
#     on every request without raising the practical security bar.
#
# Token format conventions (see migrations 009 + 011 + auth crypto Q3):
#   dcr-{hex24}  → 96-bit OAuth client_id     (mcp_oauth_clients.client_id)
#   dcs-{hex48}  → 192-bit OAuth client_secret (returned once on /register)
#   sat-{hex48}  → 192-bit Stavagent Access Token  (mcp_oauth_tokens.access_token)
#   srt-{hex48}  → 192-bit Stavagent Refresh Token (mcp_oauth_tokens.refresh_token)

_DCR_SALT_BYTES = 16  # 128-bit salt — RFC 7613 / OWASP Password Storage minimum


def generate_salt(n_bytes: int = _DCR_SALT_BYTES) -> bytes:
    """Cryptographically random salt for client_secret hashing.

    Returns raw bytes; callers persist as `.hex()` in
    `mcp_oauth_clients.client_secret_salt`. The verify helper accepts
    either hex string or raw bytes for the salt argument to keep
    storage details out of consumer call sites.
    """
    return secrets.token_bytes(n_bytes)


def _coerce_salt(salt: bytes | str) -> bytes:
    """Accept salt as raw bytes or hex string. Returns raw bytes."""
    if isinstance(salt, bytes):
        return salt
    return bytes.fromhex(salt)


def hash_client_secret(secret: str, salt: bytes | str) -> str:
    """SHA-256(salt || secret) → hex digest.

    Salt is prepended (not appended) to follow the convention used by
    every standards body that bothered to specify (NIST SP 800-132,
    PKCS#5, RFC 7613). Secrets are encoded UTF-8 — acceptable because
    `generate_client_secret()` only emits hex chars (ASCII subset).
    """
    salt_bytes = _coerce_salt(salt)
    h = hashlib.sha256()
    h.update(salt_bytes)
    h.update(secret.encode("utf-8"))
    return h.hexdigest()


def verify_client_secret(secret: str, expected_hash: str, salt: bytes | str) -> bool:
    """Constant-time compare of `hash_client_secret(secret, salt)` against expected.

    `hmac.compare_digest` defends against timing side-channels: each
    byte comparison takes the same wall-clock time whether the prefix
    matched or not, so an attacker can't binary-search the hash by
    measuring response latency.
    """
    return hmac.compare_digest(hash_client_secret(secret, salt), expected_hash)


def generate_client_id() -> str:
    """Public OAuth client_id, 96-bit entropy. Format: dcr-{hex24}.

    `dcr-` prefix marks the registration mechanism (Dynamic Client
    Registration per RFC 7591). Length is the standard short-ID
    choice (24 hex chars = 12 bytes) — enough that brute-force
    enumeration is computationally infeasible, short enough for
    URL-safe transport without truncation.
    """
    return f"dcr-{secrets.token_hex(12)}"


def generate_client_secret() -> str:
    """OAuth client_secret returned once on /register. Format: dcs-{hex48}.

    192-bit entropy mirrors the existing api_key entropy
    (`sk-stavagent-{hex48}`). `dcs-` = Dynamic Client Secret.
    Returned in PLAINTEXT in the /register response body (RFC 7591
    §3.2.1) — never logged, never stored plaintext on the server.
    """
    return f"dcs-{secrets.token_hex(24)}"


def generate_access_token() -> str:
    """OAuth 2.0 access_token, 192-bit entropy. Format: sat-{hex48}.

    `sat-` = Stavagent Access Token. Distinct prefix from
    `sk-stavagent-` lets MCPAuthChallengeMiddleware route bearers to
    the correct lookup table (sat-* → mcp_oauth_tokens,
    sk-stavagent-* → mcp_api_keys legacy path).
    """
    return f"sat-{secrets.token_hex(24)}"


def generate_refresh_token() -> str:
    """OAuth 2.0 refresh_token, 192-bit entropy. Format: srt-{hex48}.

    NULL for client_credentials grant per RFC 6749 §4.4.3 — caller is
    responsible for not minting one in that path. For authorization_code
    grant, lifetime is 90 days with rotation per OAuth 2.0 BCP §4.14
    (mcp_oauth_tokens.rotated_from chain).
    """
    return f"srt-{secrets.token_hex(24)}"


# ── DCR registration (RFC 7591) ─────────────────────────────────────────────


# Allowed grant_types per the well-known manifest in app/main.py. Kept here
# (not imported from main.py) so an isolated DCR transaction never circularly
# imports the FastAPI app — and so a single source of truth lives next to
# the validation that enforces it. main.py mirrors this list as a literal
# in _oauth_discovery_payload().
SUPPORTED_GRANT_TYPES = frozenset({"authorization_code", "client_credentials"})


def _resolve_initial_access_user_id(api_key: str) -> Optional[int]:
    """Look up `mcp_api_keys.id` for an Authorization-header bearer token.

    Used by the DCR endpoint when an Authorization header is present:
    presence = "authenticated DCR" intent → resolve to the registering
    user's id so created_by_user_id binds correctly for downstream
    client_credentials credit attribution. Returns None for unknown /
    inactive keys (caller decides how to reject).
    """
    cur = _execute(
        "SELECT id FROM mcp_api_keys WHERE api_key = %s AND is_active = TRUE",
        (api_key,),
    )
    row = cur.fetchone()
    _get_db().commit()
    return int(row["id"]) if row else None


def register_oauth_client(
    *,
    client_name: str,
    redirect_uris: list[str],
    grant_types: list[str],
    scope: Optional[str],
    software_id: Optional[str],
    software_version: Optional[str],
    created_by_user_id: Optional[int],
    registered_ip: str,
    registered_user_agent: Optional[str],
    request_payload_hash: Optional[str],
) -> dict:
    """Insert a DCR client + matching audit row in a single transaction.

    Returns `{"client_id", "client_secret", "issued_at_unix"}` on success.
    Caller is responsible for input validation (redirect_uris scheme,
    grant_types subset, client_name length) — that lives in the route
    handler so validation failures can also log to the audit table
    without touching this path.

    The plaintext client_secret is returned ONCE here. Storage holds
    only `SHA-256(salt||secret)` + the salt — verify_client_secret on
    /token does the constant-time compare.

    Transaction shape:
      BEGIN
        INSERT mcp_oauth_clients ...
        INSERT mcp_oauth_registration_log (status='success', oauth_client_id=fk) ...
      COMMIT
    A failure on either INSERT rolls both back and re-raises — the
    route handler then writes a separate audit row with status='server_error'.
    """
    client_id = generate_client_id()
    client_secret = generate_client_secret()
    salt = generate_salt()
    secret_hash = hash_client_secret(client_secret, salt)

    conn = _get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO mcp_oauth_clients (
                client_id, client_secret_hash, client_secret_salt,
                client_name, redirect_uris, grant_types, scope,
                software_id, software_version,
                registration_source, registered_ip, registered_user_agent,
                created_by_user_id
            ) VALUES (
                %s, %s, %s,
                %s, %s::jsonb, %s::jsonb, %s,
                %s, %s,
                'dcr', %s, %s,
                %s
            )
            RETURNING id, EXTRACT(EPOCH FROM registered_at)::BIGINT AS issued_at_unix
            """,
            (
                client_id, secret_hash, salt.hex(),
                client_name,
                json_dumps_compact(redirect_uris),
                json_dumps_compact(grant_types),
                scope,
                software_id, software_version,
                registered_ip, registered_user_agent,
                created_by_user_id,
            ),
        )
        row = cur.fetchone()
        client_row_id = row["id"]
        issued_at = int(row["issued_at_unix"])

        cur.execute(
            """
            INSERT INTO mcp_oauth_registration_log (
                oauth_client_id, client_name, status,
                request_payload_hash, registered_ip, registered_user_agent
            ) VALUES (%s, %s, 'success', %s, %s, %s)
            """,
            (
                client_row_id, client_name,
                request_payload_hash, registered_ip, registered_user_agent,
            ),
        )
        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "issued_at_unix": issued_at,
    }


def log_oauth_registration_failure(
    *,
    status: str,
    error_code: Optional[str],
    error_description: Optional[str],
    client_name: Optional[str],
    request_payload_hash: Optional[str],
    registered_ip: str,
    registered_user_agent: Optional[str],
) -> None:
    """Audit a registration attempt that failed before / instead of an INSERT.

    `oauth_client_id` is NULL (no client row created). Best-effort: if the
    audit INSERT itself fails (e.g. DB outage that also broke the main
    INSERT), we log + swallow — the route handler still has to return a
    400/500 to the caller, and a missing audit row is not a reason to
    further obscure the failure mode.
    """
    try:
        conn = _get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO mcp_oauth_registration_log (
                oauth_client_id, client_name, status,
                error_code, error_description,
                request_payload_hash, registered_ip, registered_user_agent
            ) VALUES (NULL, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                client_name, status,
                error_code, error_description,
                request_payload_hash, registered_ip, registered_user_agent,
            ),
        )
        conn.commit()
    except psycopg2.Error as exc:
        try:
            _get_db().rollback()
        except psycopg2.Error:
            pass
        logger.warning(
            "[MCP/DCR] Failed to audit registration failure (status=%s): %s",
            status, exc,
        )


def json_dumps_compact(value) -> str:
    """JSON dump without whitespace — matches the JSONB column we INSERT into.

    Separated from `json` module path so call sites read as a single
    intent and tests can monkeypatch one symbol if needed.
    """
    import json as _json
    return _json.dumps(value, separators=(",", ":"), ensure_ascii=False)


# ── Public API ───────────────────────────────────────────────────────────────

def register(email: str, password: str, client_ip: str = "unknown") -> dict:
    """Register a new API user. Returns API key + initial credits."""
    if not _check_rate_limit(f"register:{client_ip}"):
        return {"error": "Too many registration attempts. Try again later.", "status": "rate_limited"}

    conn = _get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT api_key, credits FROM mcp_api_keys WHERE user_email = %s",
            (email,),
        )
        if cur.fetchone():
            return {
                "error": "Email already registered. Use /login to retrieve your key.",
                "status": "exists",
            }

        api_key = _generate_api_key()
        pw_hash = _hash_password(password)

        cur.execute(
            "INSERT INTO mcp_api_keys (user_email, api_key, password_hash, credits) "
            "VALUES (%s, %s, %s, %s)",
            (email, api_key, pw_hash, FREE_CREDITS),
        )
        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise

    logger.info(f"[MCP/Auth] Registered: {email}")
    return {
        "api_key": api_key,
        "credits": FREE_CREDITS,
        "email": email,
        "status": "created",
    }


def login(email: str, password: str, client_ip: str = "unknown") -> dict:
    """Login and retrieve API key."""
    if not _check_rate_limit(f"login:{client_ip}"):
        return {"error": "Too many login attempts. Try again later.", "status": "rate_limited"}

    cur = _execute(
        "SELECT api_key, credits, is_active, password_hash "
        "FROM mcp_api_keys WHERE user_email = %s",
        (email,),
    )
    row = cur.fetchone()
    _get_db().commit()  # close txn

    if not row or not _verify_password(password, row["password_hash"]):
        return {"error": "Invalid email or password.", "status": "invalid"}

    if not row["is_active"]:
        return {"error": "Account deactivated.", "status": "deactivated"}

    return {
        "api_key": row["api_key"],
        "credits": row["credits"],
        "email": email,
        "status": "ok",
    }


def check_credits(api_key: str, tool_name: str) -> dict:
    """Check if API key has enough credits for the tool, deducting atomically.

    Uses a single UPDATE ... WHERE credits >= cost RETURNING credits, id.
    Postgres takes a row lock for the UPDATE, so concurrent requests
    against the same row are serialized — no double-spend.
    """
    cost = TOOL_COSTS.get(tool_name, 0)

    # Free tools — always allowed, even without key
    if cost == 0:
        return {"ok": True, "cost": 0, "credits_remaining": None}

    # Paid tools require a valid key
    if not api_key:
        return {
            "ok": False,
            "cost": cost,
            "error": "API key required. Register at stavagent.cz/api-access",
        }

    conn = _get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE mcp_api_keys SET "
            "    credits = credits - %s, "
            "    last_used_at = NOW(), "
            "    total_credits_used = total_credits_used + %s "
            "WHERE api_key = %s AND is_active = TRUE AND credits >= %s "
            "RETURNING id, credits",
            (cost, cost, api_key, cost),
        )
        updated = cur.fetchone()

        if updated is None:
            # Deduction failed — find out why
            cur.execute(
                "SELECT id, credits, is_active FROM mcp_api_keys WHERE api_key = %s",
                (api_key,),
            )
            row = cur.fetchone()
            conn.commit()

            if not row:
                return {
                    "ok": False,
                    "cost": cost,
                    "error": "Invalid API key. Register at stavagent.cz/api-access",
                }
            if not row["is_active"]:
                return {"ok": False, "cost": cost, "error": "Account deactivated."}

            return {
                "ok": False,
                "cost": cost,
                "credits_remaining": row["credits"],
                "error": f"Insufficient credits ({row['credits']} < {cost}). "
                         f"Top up at stavagent.cz/api-access",
            }

        # Deduction succeeded — log and commit
        cur.execute(
            "INSERT INTO mcp_credit_log "
            "(api_key_id, tool_name, credits_used, credits_remaining) "
            "VALUES (%s, %s, %s, %s)",
            (updated["id"], tool_name, cost, updated["credits"]),
        )
        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise

    return {"ok": True, "cost": cost, "credits_remaining": updated["credits"]}


def add_credits(email: str, amount: int) -> dict:
    """Add credits to a user account (called by billing webhook)."""
    conn = _get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE mcp_api_keys SET "
            "    credits = credits + %s, "
            "    total_credits_purchased = total_credits_purchased + %s "
            "WHERE user_email = %s "
            "RETURNING credits",
            (amount, amount, email),
        )
        row = cur.fetchone()

        if row is None:
            conn.rollback()
            logger.warning(f"[MCP/Auth] add_credits: unknown email {email}")
            return {"error": f"User not found: {email}", "status": "not_found"}

        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise

    logger.info(f"[MCP/Auth] Added {amount} credits to {email}, new balance: {row['credits']}")
    return {"credits": row["credits"], "added": amount, "status": "ok"}


def get_credits(api_key: str) -> dict:
    """Get current credit balance."""
    cur = _execute(
        "SELECT user_email, credits, total_credits_used, total_credits_purchased "
        "FROM mcp_api_keys WHERE api_key = %s",
        (api_key,),
    )
    row = cur.fetchone()
    _get_db().commit()

    if not row:
        return {"error": "Invalid API key.", "credits": 0}

    return {
        "email": row["user_email"],
        "credits": row["credits"],
        "total_used": row["total_credits_used"],
        "total_purchased": row["total_credits_purchased"],
    }


def oauth_token(client_id: str, client_secret: str) -> dict:
    """OAuth 2.0 client_credentials grant for ChatGPT integration."""
    api_key = client_id or client_secret
    if not api_key:
        return {"error": "invalid_client", "error_description": "client_id required"}

    cur = _execute(
        "SELECT api_key, is_active FROM mcp_api_keys WHERE api_key = %s",
        (api_key,),
    )
    row = cur.fetchone()
    _get_db().commit()

    if not row or not row["is_active"]:
        return {"error": "invalid_client", "error_description": "Invalid API key"}

    return {
        "access_token": row["api_key"],
        "token_type": "bearer",
        "expires_in": 86400,
    }
