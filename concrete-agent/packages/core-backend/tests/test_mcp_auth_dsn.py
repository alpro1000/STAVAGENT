"""
Tests for `_resolve_dsn()` + `_sanitize_dsn_for_log()` in `app.mcp.auth`.

These are pure-function tests — no Postgres / Cloud SQL connection required.
They guard the Cloud SQL connection bug fix shipped 2026-05-14:

  - MCP_DATABASE_URL → DATABASE_URL priority order
  - `+asyncpg` dialect prefix stripped (psycopg2 doesn't speak SQLAlchemy URLs)
  - Trailing whitespace / newline stripped (Secret Manager paste hazard)
  - Empty / unset env vars raise a clear error
  - Sanitize-for-log redacts the password but preserves the Cloud SQL
    socket-host query param so production logs are diagnostic-friendly.

See: docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md
"""

import importlib
import os

import pytest


@pytest.fixture
def auth_mod(monkeypatch):
    """Reload `app.mcp.auth` per-test so env-var state doesn't leak."""
    for k in ("MCP_DATABASE_URL", "DATABASE_URL"):
        monkeypatch.delenv(k, raising=False)
    import app.mcp.auth as _auth
    return importlib.reload(_auth)


# ── _resolve_dsn ─────────────────────────────────────────────────────────────

def test_dsn_unset_raises(monkeypatch, auth_mod):
    """Neither env var set → RuntimeError with a helpful message."""
    monkeypatch.delenv("MCP_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        auth_mod._resolve_dsn()


def test_dsn_database_url_passthrough(monkeypatch, auth_mod):
    """Plain DATABASE_URL (no asyncpg prefix) returns unchanged."""
    url = "postgresql://user:pw@localhost/db"
    monkeypatch.setenv("DATABASE_URL", url)
    assert auth_mod._resolve_dsn() == url


def test_dsn_strips_asyncpg_prefix(monkeypatch, auth_mod):
    """`postgresql+asyncpg://` → `postgresql://`. psycopg2 doesn't speak the SQLAlchemy dialect."""
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pw@localhost/db?host=/cloudsql/p:r:i",
    )
    assert auth_mod._resolve_dsn() == "postgresql://user:pw@localhost/db?host=/cloudsql/p:r:i"


def test_dsn_strips_only_first_occurrence(monkeypatch, auth_mod):
    """`.replace(..., 1)` — defensive: only the scheme prefix is rewritten."""
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pw@localhost/db?comment=postgresql+asyncpg",
    )
    out = auth_mod._resolve_dsn()
    assert out.startswith("postgresql://")
    # Query string echo of the dialect string survives the replace.
    assert out.endswith("comment=postgresql+asyncpg")


def test_dsn_mcp_url_wins_over_database_url(monkeypatch, auth_mod):
    """`MCP_DATABASE_URL` takes priority — lets ops point MCP at a different DSN."""
    monkeypatch.setenv("MCP_DATABASE_URL", "postgresql://mcp:p@/mcp_db?host=/cloudsql/a:b:c")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://other:p@/other_db?host=/cloudsql/x:y:z")
    out = auth_mod._resolve_dsn()
    assert "mcp_db" in out
    assert "other_db" not in out


def test_dsn_strips_trailing_newline(monkeypatch, auth_mod):
    """GCP Secret Manager values sometimes carry a trailing newline.

    Without the strip(), the newline gets appended to `?host=/cloudsql/...\\n`
    and libpq looks for the socket at `/cloudsql/.../<newline>/.s.PGSQL.5432`
    — ENOENT, indistinguishable in logs from a missing annotation.
    """
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pw@/db?host=/cloudsql/p:r:i\n")
    out = auth_mod._resolve_dsn()
    assert "\n" not in out
    assert out.endswith("host=/cloudsql/p:r:i")


def test_dsn_strips_surrounding_whitespace(monkeypatch, auth_mod):
    """Leading + trailing whitespace also stripped."""
    monkeypatch.setenv("DATABASE_URL", "  postgresql://user:pw@/db  ")
    out = auth_mod._resolve_dsn()
    assert out == "postgresql://user:pw@/db"


def test_dsn_empty_string_raises(monkeypatch, auth_mod):
    """Empty string is treated the same as unset."""
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.delenv("MCP_DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError):
        auth_mod._resolve_dsn()


def test_dsn_whitespace_only_raises(monkeypatch, auth_mod):
    """A secret value that's just whitespace shouldn't slip through as valid."""
    monkeypatch.setenv("DATABASE_URL", "   \n  ")
    monkeypatch.delenv("MCP_DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError):
        auth_mod._resolve_dsn()


# ── _sanitize_dsn_for_log ────────────────────────────────────────────────────

def test_sanitize_redacts_password(auth_mod):
    """`user:secret@` → `user:***@` — password never reaches logs."""
    s = auth_mod._sanitize_dsn_for_log("postgresql://user:secret@localhost/db")
    assert "secret" not in s
    assert "***" in s
    assert "user" in s
    assert "localhost" in s


def test_sanitize_preserves_socket_host(auth_mod):
    """Cloud SQL socket path stays visible (it's the diagnostic signal)."""
    s = auth_mod._sanitize_dsn_for_log(
        "postgresql://stavagent_portal:secret@/stavagent_portal?host=/cloudsql/p-947:europe-west3:stavagent-db"
    )
    assert "secret" not in s
    assert "/cloudsql/p-947:europe-west3:stavagent-db" in s


def test_sanitize_empty_password(auth_mod):
    """`user:@` (empty password) — sanitizer must not error out."""
    s = auth_mod._sanitize_dsn_for_log("postgresql://user:@/db?host=/cloudsql/x:y:z")
    # No password to redact; user portion stays, ***@ inserted in place of :@.
    assert "user" in s
    assert "/cloudsql/x:y:z" in s


def test_sanitize_no_userinfo(auth_mod):
    """DSN with no user:password segment (rare, but parsable) — sanitizer is a no-op."""
    s = auth_mod._sanitize_dsn_for_log("postgresql:///db?host=/cloudsql/x:y:z")
    assert s == "postgresql:///db?host=/cloudsql/x:y:z"
