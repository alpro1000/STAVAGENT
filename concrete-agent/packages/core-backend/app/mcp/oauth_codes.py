"""
MCP OAuth 2.0 authorization_code + PKCE storage

Implements RFC 6749 §4.1 (authorization_code grant) and RFC 7636 (PKCE)
over the Postgres `mcp_oauth_codes` table created by migration 008.

Kept separate from `app/mcp/auth.py` (api_key + credits) so the OAuth
storage stays a single-purpose module — easier to reason about TTLs,
single-use semantics, and the future move to JWT-issued tokens.

Public API:
    generate_code(client_id, redirect_uri, code_challenge, state,
                  ttl_seconds=600) -> code
    consume_code(code, code_verifier, redirect_uri) -> {ok, client_id|error}
    is_allowed_redirect_uri(uri) -> bool

The connection pool is reused from `app/mcp/auth.py` so all MCP DB
traffic shares one thread-local connection (avoids burning Cloud SQL
connection slots).
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg2

from app.mcp import auth as mcp_auth

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

DEFAULT_CODE_TTL_SECONDS = 600  # 10 min, per RFC 6749 §4.1.2 guidance
CODE_BYTE_LENGTH = 32  # secrets.token_urlsafe(32) → 43 chars base64url

# Allowed redirect_uri prefixes (production third-party MCP consumers).
# `localhost:*` opens up only when `MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT=1`
# is set (dev/CI). We deliberately do NOT default-allow localhost in
# production to keep the open-redirect surface tight.
PROD_REDIRECT_URI_PREFIXES = (
    "https://chatgpt.com/connector/oauth/",
    "https://claude.ai/api/mcp/auth_callback",
)
_LOCALHOST_REDIRECT_RE = re.compile(r"^http://localhost(:\d+)?(/.*)?$")


def _localhost_allowed() -> bool:
    """Dev/CI escape hatch — only honoured when env var is explicitly set."""
    return os.getenv("MCP_OAUTH_ALLOW_LOCALHOST_REDIRECT", "").strip() == "1"


def is_allowed_redirect_uri(redirect_uri: str) -> bool:
    """Check redirect_uri against the production allowlist.

    ChatGPT and Claude.ai callback hostnames + path prefixes are
    hardcoded; localhost only enabled via env flag (dev/CI).
    """
    if not redirect_uri:
        return False
    if any(redirect_uri.startswith(p) for p in PROD_REDIRECT_URI_PREFIXES):
        return True
    if _localhost_allowed() and _LOCALHOST_REDIRECT_RE.match(redirect_uri):
        return True
    return False


# ── PKCE ────────────────────────────────────────────────────────────────────

def _pkce_s256(code_verifier: str) -> str:
    """RFC 7636 §4.2: BASE64URL-ENCODE(SHA256(ASCII(code_verifier))).

    `code_verifier` per §4.1 is restricted to `[A-Z][a-z][0-9]-._~` (ASCII).
    Non-ASCII input is a malformed request — raise ValueError so the
    caller can map it to an OAuth `invalid_grant` response instead of
    bubbling a 500 with a `UnicodeEncodeError` traceback.
    """
    try:
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    except UnicodeEncodeError as exc:
        raise ValueError(
            "code_verifier must contain only ASCII characters per RFC 7636 §4.1"
        ) from exc
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


# ── Public API ───────────────────────────────────────────────────────────────

def generate_code(
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    state: Optional[str] = None,
    ttl_seconds: int = DEFAULT_CODE_TTL_SECONDS,
    code_challenge_method: str = "S256",
) -> str:
    """Generate + store a short-lived authorization code.

    Caller is expected to have already validated:
      - `client_id` exists in `mcp_api_keys` (FK protects against typos
        but giving back a 400 instead of a 500 is friendlier)
      - `redirect_uri` passes `is_allowed_redirect_uri`
      - `code_challenge_method == "S256"` (we don't accept `plain`)

    Returns the generated code (caller redirects to
    `{redirect_uri}?code={code}&state={state}`).
    """
    code = secrets.token_urlsafe(CODE_BYTE_LENGTH)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    conn = mcp_auth._get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mcp_oauth_codes "
            "(code, client_id, redirect_uri, code_challenge, "
            " code_challenge_method, state, created_at, expires_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (code, client_id, redirect_uri, code_challenge,
             code_challenge_method, state, now, expires_at),
        )
        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise
    logger.info(
        "[MCP/OAuth] code issued client_id=%s redirect_uri=%s ttl=%ds",
        _redact_key(client_id), redirect_uri, ttl_seconds,
    )
    return code


def consume_code(
    code: str,
    code_verifier: str,
    redirect_uri: str,
) -> dict:
    """Atomically validate + mark code as used.

    Returns:
        {"ok": True, "client_id": <api_key>} on success.
        {"ok": False, "error": "<code>", "error_description": "..."}
        with one of the RFC 6749 §5.2 error codes:
          - invalid_grant: code unknown / used / expired / verifier mismatch
          - invalid_request: redirect_uri mismatch
    """
    if not code or not code_verifier:
        return {"ok": False, "error": "invalid_request",
                "error_description": "code and code_verifier required"}

    conn = mcp_auth._get_db()
    try:
        cur = conn.cursor()
        # SELECT … FOR UPDATE to serialize the read+update sequence so two
        # concurrent token requests for the same code can't both succeed
        # (would let a stolen code be replayed once before mark_used wins).
        cur.execute(
            "SELECT client_id, redirect_uri, code_challenge, "
            "       code_challenge_method, expires_at, used_at "
            "FROM mcp_oauth_codes "
            "WHERE code = %s "
            "FOR UPDATE",
            (code,),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code not found"}

        # `expires_at` is timezone-aware (TIMESTAMPTZ); compare against UTC now.
        if row["expires_at"] <= datetime.now(timezone.utc):
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code expired"}

        if row["redirect_uri"] != redirect_uri:
            conn.rollback()
            return {"ok": False, "error": "invalid_request",
                    "error_description": "redirect_uri mismatch"}

        # PKCE — only S256 supported (plain is RFC-allowed but weak).
        # PKCE verification runs BEFORE the `used_at` replay check so a
        # stolen code without the verifier cannot probe code state via
        # response-timing differences (amazon-q review on PR #1151).
        # The SHA-256 cost is microsecond-level so the latency hit on
        # legitimate-but-replayed requests is negligible.
        if row["code_challenge_method"] != "S256":
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Unsupported code_challenge_method"}

        # Catch ASCII-encoding error from `_pkce_s256` and collapse it
        # into the same `invalid_grant` / "code_verifier mismatch" path
        # so an attacker can't distinguish "non-ASCII rejected" from
        # "digest didn't match" via response shape (preserves the same
        # constant-time-ish guarantee the timing-attack reorder gave us).
        try:
            verifier_digest = _pkce_s256(code_verifier)
        except ValueError:
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "code_verifier mismatch"}

        if verifier_digest != row["code_challenge"]:
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "code_verifier mismatch"}

        # Replay check — runs after PKCE so used + unused codes consume
        # the same wall-clock budget for an attacker without the verifier.
        if row["used_at"] is not None:
            conn.rollback()
            return {"ok": False, "error": "invalid_grant",
                    "error_description": "Authorization code already used"}

        # Mark used → release the row lock via commit
        cur.execute(
            "UPDATE mcp_oauth_codes SET used_at = NOW() WHERE code = %s",
            (code,),
        )
        conn.commit()
    except psycopg2.Error:
        conn.rollback()
        raise

    return {"ok": True, "client_id": row["client_id"]}


def _redact_key(key: str) -> str:
    """Show only the `sk-stavagent-` prefix + last 4 chars in logs."""
    if not key:
        return "<empty>"
    if len(key) <= 8:
        return "***"
    return f"{key[:13]}…{key[-4:]}"
