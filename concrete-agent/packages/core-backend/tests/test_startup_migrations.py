"""
Tests for `app.db.startup_migrations`.

Pure-function tests for `_resolve_dsn` + `sanitize_dsn_for_log` run anywhere.
Integration tests for `apply_pending_migrations` + `assert_critical_schema`
require a live Postgres (`DATABASE_URL` env var); they skip cleanly when
Postgres isn't reachable (matches the pattern in `test_mcp_auth_postgres.py`).

CI runs the integration tests against the `postgres:16` service container
that `test-mcp-compatibility.yml` already provisions.
"""

from __future__ import annotations

import importlib
import os
import uuid
from pathlib import Path

import pytest


_HAS_DB = bool(os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL"))
requires_db = pytest.mark.skipif(
    not _HAS_DB,
    reason="DATABASE_URL not set — integration tests require Postgres",
)


@pytest.fixture
def mod(monkeypatch):
    """Reload the module per-test so env-var state doesn't leak."""
    for k in ("MCP_DATABASE_URL", "DATABASE_URL"):
        monkeypatch.delenv(k, raising=False)
    import app.db.startup_migrations as m
    return importlib.reload(m)


# ── Pure-function tests ──────────────────────────────────────────────────────

def test_resolve_dsn_unset_raises(mod):
    """Neither env var set → RuntimeError pointing at DATABASE_URL."""
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        mod._resolve_dsn()


def test_resolve_dsn_strips_asyncpg_prefix(monkeypatch, mod):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://u:p@/db?host=/cloudsql/p:r:i",
    )
    assert mod._resolve_dsn() == "postgresql://u:p@/db?host=/cloudsql/p:r:i"


def test_resolve_dsn_mcp_url_priority(monkeypatch, mod):
    monkeypatch.setenv("MCP_DATABASE_URL", "postgresql://mcp:p@/mcp")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://other:p@/other")
    out = mod._resolve_dsn()
    assert "mcp" in out and "other" not in out


def test_resolve_dsn_strips_trailing_newline(monkeypatch, mod):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@/db?host=/cloudsql/p:r:i\n")
    out = mod._resolve_dsn()
    assert "\n" not in out


def test_sanitize_redacts_password(mod):
    s = mod.sanitize_dsn_for_log("postgresql://user:supersecret@/db?host=/cloudsql/x:y:z")
    assert "supersecret" not in s
    assert "***" in s
    assert "/cloudsql/x:y:z" in s


def test_sanitize_handles_empty_password(mod):
    s = mod.sanitize_dsn_for_log("postgresql://user:@/db?host=/cloudsql/x:y:z")
    assert "/cloudsql/x:y:z" in s  # doesn't crash, host preserved


def test_list_migration_files_returns_sorted(mod, tmp_path: Path):
    (tmp_path / "002_b.sql").write_text("-- noop")
    (tmp_path / "001_a.sql").write_text("-- noop")
    (tmp_path / "ignored.txt").write_text("not a migration")
    files = mod._list_migration_files(tmp_path)
    assert [f.name for f in files] == ["001_a.sql", "002_b.sql"]


def test_list_migration_files_empty_when_dir_missing(mod, tmp_path: Path):
    """Soft-fails (warns, returns []) when the migrations directory doesn't exist."""
    files = mod._list_migration_files(tmp_path / "does_not_exist")
    assert files == []


# ── Integration tests (require Postgres) ────────────────────────────────────

@requires_db
def test_apply_pending_migrations_idempotent(mod, tmp_path: Path):
    """Running apply_pending_migrations twice applies once, then no-ops."""
    table_name = f"_smtest_{uuid.uuid4().hex[:8]}"
    (tmp_path / "001_create.sql").write_text(
        f"CREATE TABLE {table_name} (id INTEGER PRIMARY KEY);"
    )

    first = mod.apply_pending_migrations(migrations_dir=tmp_path)
    assert first == ["001_create.sql"]

    # Second run sees it in _schema_migrations and skips.
    second = mod.apply_pending_migrations(migrations_dir=tmp_path)
    assert second == []

    # Cleanup
    import psycopg2
    conn = psycopg2.connect(mod._resolve_dsn())
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP TABLE IF EXISTS {table_name}")
            cur.execute("DELETE FROM _schema_migrations WHERE filename = %s",
                        ("001_create.sql",))
        conn.commit()
    finally:
        conn.close()


@requires_db
def test_apply_pending_migrations_failure_rolls_back(mod, tmp_path: Path):
    """A bad migration raises and is NOT recorded in _schema_migrations."""
    fname = f"998_bad_{uuid.uuid4().hex[:6]}.sql"
    (tmp_path / fname).write_text("THIS IS NOT VALID SQL;")

    with pytest.raises(Exception):
        mod.apply_pending_migrations(migrations_dir=tmp_path)

    # Verify it wasn't recorded
    import psycopg2
    conn = psycopg2.connect(mod._resolve_dsn())
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM _schema_migrations WHERE filename = %s", (fname,))
            assert cur.fetchone() is None
    finally:
        conn.close()


@requires_db
def test_assert_critical_schema_passes_on_correct_schema(mod):
    """When mcp_api_keys has all expected columns, drift check is a no-op."""
    # Make sure the canonical table exists (apply real migrations).
    import psycopg2
    conn = psycopg2.connect(mod._resolve_dsn())
    try:
        with conn.cursor() as cur:
            # Apply 007 directly (idempotent CREATE TABLE IF NOT EXISTS)
            here = Path(__file__).resolve()
            mig = here.parent.parent / "migrations" / "007_mcp_api_keys.sql"
            if mig.exists():
                cur.execute(mig.read_text(encoding="utf-8"))
                conn.commit()
    finally:
        conn.close()

    # Should not raise.
    mod.assert_critical_schema()


@requires_db
def test_assert_critical_schema_fails_on_missing_column(mod, monkeypatch):
    """Patch _CRITICAL_SCHEMA to require a column that doesn't exist → fails fast."""
    monkeypatch.setattr(mod, "_CRITICAL_SCHEMA", {
        "mcp_api_keys": {"this_column_does_not_exist"},
    })
    with pytest.raises(mod.SchemaDriftError, match="this_column_does_not_exist"):
        mod.assert_critical_schema()


@requires_db
def test_assert_critical_schema_fails_on_missing_table(mod, monkeypatch):
    """If the table itself is absent, drift check names the table."""
    monkeypatch.setattr(mod, "_CRITICAL_SCHEMA", {
        f"_nonexistent_{uuid.uuid4().hex[:8]}": {"id"},
    })
    with pytest.raises(mod.SchemaDriftError, match="table not found"):
        mod.assert_critical_schema()
