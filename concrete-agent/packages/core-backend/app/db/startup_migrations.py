"""
Startup migration runner — applies SQL files from `migrations/*.sql` against
the production Cloud SQL Postgres at FastAPI lifespan startup.

Why this exists
---------------
The cloudbuild step that previously ran `psql -f migrations/*.sql` from a
Cloud Build VM has silently no-op'd ever since PR #1147 — the build VM
has no `/cloudsql/INSTANCE/.s.PGSQL.5432` socket mount, so every psql
call returned ENOENT and the `|| echo "skipped"` fallback hid the
failure. Production schema drift (column `email` instead of
`user_email`, table `mcp_credit_transactions` instead of `mcp_credit_log`)
took down `/api/v1/mcp/auth/register` after the migration on 2026-05-14.

Running migrations in-container at startup is the cleanest fix: the
Cloud Run sidecar mounts `/cloudsql/...` for this service, so the same
DSN that works for `auth.py` queries works for migrations. If a migration
fails, the lifespan exception bubbles up, the container fails its health
check, and Cloud Run rolls back to the previous revision automatically.

Concurrency
-----------
Two simultaneously-starting Cloud Run instances would both try to apply
the same migration. We protect against that with a transaction-scoped
PostgreSQL advisory lock — only one instance holds the lock at a time;
the other waits, then sees the migration already in `_schema_migrations`
and skips it.

Idempotency
-----------
Each successfully-applied migration is recorded in `_schema_migrations`
(`filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT
NOW()`). On every startup the runner globs `migrations/*.sql`, sorts
alphabetically, and skips any filename already in the table.

Drift check
-----------
After migrations run, `assert_critical_schema()` verifies that the
`mcp_api_keys` table has the columns the code expects (`user_email`,
`total_credits_used`). If a future hand-edit drops a column, the next
startup fails fast with a clear log line — instead of waiting for the
first user request to hit `psycopg2.errors.UndefinedColumn`.
"""

from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path
from typing import Iterable

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

# Stable 64-bit key for `pg_advisory_lock`. Chosen by hashing
# "stavagent.mcp.startup_migrations" and trimming to 63 bits to fit in a
# signed bigint (Postgres advisory-lock keys are bigints).
_MIGRATION_LOCK_KEY = 8479_3162_5045_1287

# ── Connect / statement timeouts (added 2026-05-14 after revision
#    concrete-agent-00324 failed the Cloud Run port-bind probe because
#    psycopg2.connect hung forever waiting on the cloudsql-proxy sidecar
#    socket to appear). Both budgets are tight enough that worst-case
#    startup (3 retries × 10 s + 30 s statements) still fits inside the
#    240 s Cloud Run startup deadline with margin for KB load + MCP init.

_CONNECT_TIMEOUT_S = 10
_STATEMENT_TIMEOUT_MS = 30_000  # 30 s — generous for migrations + drift check
_CONNECT_RETRIES = 3
_CONNECT_RETRY_DELAY_S = 5

# Critical columns the code unconditionally references; drift-check fails
# fast if any are absent. Sourced from `app/mcp/auth.py` SQL strings.
_CRITICAL_SCHEMA: dict[str, set[str]] = {
    "mcp_api_keys": {
        "id", "user_email", "api_key", "password_hash",
        "credits", "is_active",
        "total_credits_used", "total_credits_purchased",
    },
}


# ─── DSN resolution (mirrors app.mcp.auth._resolve_dsn) ────────────────────

def _resolve_dsn() -> str:
    """Same priority + sanitisation as `app.mcp.auth._resolve_dsn`.

    Kept as a separate copy (not an import) so this module stays usable
    even if `app.mcp.auth` later moves or splits.
    """
    url = (os.getenv("MCP_DATABASE_URL") or os.getenv("DATABASE_URL", "")).strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL (or MCP_DATABASE_URL) not set — startup migrations "
            "need Cloud SQL Postgres."
        )
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


# ─── Connection helper with bounded timeouts + retry ───────────────────────

def _open_connection(dsn: str) -> psycopg2.extensions.connection:
    """Connect to Postgres with bounded `connect_timeout` + retry-on-transient.

    Cloud Run's `cloudsql-proxy` sidecar may not be fully mounted when
    the application container starts its FastAPI lifespan. The Unix
    socket at `/cloudsql/INSTANCE/.s.PGSQL.5432` typically appears a few
    seconds after the container, so an immediate connect raises
    `psycopg2.OperationalError: ... No such file or directory`. The
    original code passed no `connect_timeout`, so a flaky sidecar could
    block the connect call indefinitely — past the 240 s Cloud Run
    startup probe deadline — and the port never bound.

    Strategy:
      1. `connect_timeout=10` — fail individual attempts fast.
      2. Retry up to `_CONNECT_RETRIES` times on transient OperationalError
         (ENOENT on the socket, "Connection refused", or libpq's
         "timeout expired"). Total budget ≈ 30 s.
      3. Server-side `SET statement_timeout` so a stuck
         `pg_advisory_lock()` or any single migration statement can't
         hang the lifespan indefinitely either.
    """
    last_exc: Exception | None = None
    for attempt in range(1, _CONNECT_RETRIES + 1):
        try:
            conn = psycopg2.connect(dsn, connect_timeout=_CONNECT_TIMEOUT_S)
        except psycopg2.OperationalError as exc:
            last_exc = exc
            msg = str(exc)
            transient = (
                "No such file or directory" in msg
                or "Connection refused" in msg
                or "timeout expired" in msg
            )
            if attempt < _CONNECT_RETRIES and transient:
                logger.warning(
                    "[startup-migrations] Cloud SQL connect attempt %d/%d "
                    "failed (transient: %s) — retrying in %ds",
                    attempt, _CONNECT_RETRIES,
                    (msg.splitlines()[0] if msg else "?")[:160],
                    _CONNECT_RETRY_DELAY_S,
                )
                time.sleep(_CONNECT_RETRY_DELAY_S)
                continue
            # Non-transient OR final attempt — surface clearly.
            logger.error(
                "[startup-migrations] Cloud SQL connect failed after %d "
                "attempt(s): %s",
                attempt, (msg.splitlines()[0] if msg else "?")[:160],
            )
            raise
        else:
            # Bound every subsequent query so a stuck lock can't outlive
            # the Cloud Run startup probe. SET at session level
            # (autocommit is flipped on later in `apply_pending_migrations`).
            with conn.cursor() as cur:
                cur.execute(f"SET statement_timeout = {_STATEMENT_TIMEOUT_MS}")
            conn.commit()
            return conn

    # Defensive: loop must have raised or returned. If it didn't, surface
    # the last seen exception so the caller knows what happened.
    raise last_exc or RuntimeError("startup migrations: connect failed without exception")


# ─── Migration runner ──────────────────────────────────────────────────────

def _ensure_tracking_table(conn: psycopg2.extensions.connection) -> None:
    """Create `_schema_migrations` if absent. Safe to call repeatedly."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS _schema_migrations (
                filename    TEXT PRIMARY KEY,
                applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    conn.commit()


def _list_migration_files(migrations_dir: Path) -> list[Path]:
    """Sorted list of `*.sql` files in the migrations directory."""
    if not migrations_dir.is_dir():
        logger.warning("[startup-migrations] No migrations directory at %s", migrations_dir)
        return []
    files = sorted(migrations_dir.glob("*.sql"))
    return files


def _already_applied(conn: psycopg2.extensions.connection, filename: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM _schema_migrations WHERE filename = %s",
            (filename,),
        )
        return cur.fetchone() is not None


def _apply_one(conn: psycopg2.extensions.connection, sql_path: Path) -> None:
    """Run a single migration file inside its own transaction.

    Each `*.sql` is executed as one libpq query — Postgres treats
    semicolon-separated statements in one PQexec as a single transaction
    when wrapped in BEGIN/COMMIT, which we do explicitly here so a
    syntax error in any one statement rolls back the whole file.
    """
    sql = sql_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute("BEGIN")
        try:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO _schema_migrations (filename) VALUES (%s)",
                (sql_path.name,),
            )
            cur.execute("COMMIT")
        except Exception:
            cur.execute("ROLLBACK")
            raise


def apply_pending_migrations(
    migrations_dir: Path | None = None,
    *,
    dsn: str | None = None,
) -> list[str]:
    """Apply every `migrations/*.sql` not already in `_schema_migrations`.

    Returns the list of filenames that were applied this call (empty if
    everything was already up to date). Raises on any error — the
    FastAPI lifespan will propagate the exception and Cloud Run will
    refuse to roll traffic to the broken revision.
    """
    if migrations_dir is None:
        # Default: <repo>/concrete-agent/packages/core-backend/migrations
        # In the deployed container this resolves to /app/migrations.
        here = Path(__file__).resolve()
        migrations_dir = here.parent.parent.parent / "migrations"

    files = _list_migration_files(migrations_dir)
    if not files:
        logger.info("[startup-migrations] no migration files found at %s", migrations_dir)
        return []

    conn = _open_connection(dsn or _resolve_dsn())
    try:
        # Autocommit so the session-level advisory lock isn't bound to an
        # implicit transaction (and so each migration in `_apply_one` can
        # manage its own BEGIN/COMMIT — some files may include statements
        # like `CREATE INDEX CONCURRENTLY` that can't run inside an outer
        # transaction). `statement_timeout` set by `_open_connection`
        # survives the autocommit flip because it's a session-level GUC.
        conn.autocommit = True

        # Session-level advisory lock — released only by pg_advisory_unlock
        # or by the session ending. We hold it across BOTH the
        # `_already_applied` check AND the `_apply_one` call for every
        # file so two simultaneously-starting Cloud Run instances cannot
        # both decide to apply the same migration. (The earlier xact-scoped
        # `pg_advisory_xact_lock` was released by every per-iteration
        # COMMIT, which left a window where instance B could read
        # `_already_applied=False` while instance A's `_apply_one` was
        # still mid-flight — INSERTing a duplicate `filename` PK or
        # re-running `CREATE TABLE` and failing.)
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(%s)", (_MIGRATION_LOCK_KEY,))
        try:
            # Tracking table creation also runs under the lock so two
            # instances can't race on `CREATE TABLE IF NOT EXISTS`.
            _ensure_tracking_table(conn)

            applied: list[str] = []
            for path in files:
                if _already_applied(conn, path.name):
                    continue
                logger.info("[startup-migrations] applying %s", path.name)
                _apply_one(conn, path)
                applied.append(path.name)
        finally:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s)", (_MIGRATION_LOCK_KEY,))

        if applied:
            logger.info("[startup-migrations] applied %d migration(s): %s",
                        len(applied), ", ".join(applied))
        else:
            logger.info("[startup-migrations] schema up to date (%d migration(s) checked)",
                        len(files))
        return applied
    finally:
        conn.close()


# ─── Drift check ───────────────────────────────────────────────────────────

class SchemaDriftError(RuntimeError):
    """Raised by `assert_critical_schema` when a required column is missing."""


def assert_critical_schema(*, dsn: str | None = None) -> None:
    """Verify that critical columns exist on the tables the code uses.

    Catches the 2026-05-14 failure mode — production tables hand-applied
    with a divergent schema (`email` instead of `user_email`, etc.) —
    *at startup* instead of at the first user request.

    Raises `SchemaDriftError` with a list of missing (table, column)
    pairs if the check fails. The FastAPI lifespan will propagate this
    and Cloud Run will roll back to the previous revision.
    """
    conn = _open_connection(dsn or _resolve_dsn())
    try:
        missing: list[str] = []
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for table, expected_cols in _CRITICAL_SCHEMA.items():
                cur.execute(
                    """
                    SELECT column_name
                      FROM information_schema.columns
                     WHERE table_schema = current_schema()
                       AND table_name = %s
                    """,
                    (table,),
                )
                actual_cols = {row["column_name"] for row in cur.fetchall()}
                if not actual_cols:
                    missing.append(f"{table} (table not found)")
                    continue
                for col in expected_cols:
                    if col not in actual_cols:
                        missing.append(f"{table}.{col}")

        if missing:
            raise SchemaDriftError(
                "Critical schema drift detected — production tables are "
                "missing column(s) the code requires: " + ", ".join(missing) +
                ". This usually means migrations didn't run, OR the table was "
                "hand-created with a divergent schema. See "
                "docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md."
            )
        logger.info("[startup-migrations] schema drift check passed for %d table(s)",
                    len(_CRITICAL_SCHEMA))
    finally:
        conn.close()


# ─── DSN sanitiser (re-exported for log lines) ─────────────────────────────

_USER_PASS_RE = re.compile(r"(://[^:@/]+:)[^@/]*(@)")


def sanitize_dsn_for_log(dsn: str) -> str:
    """Redact `user:password@` → `user:***@` for logging."""
    return _USER_PASS_RE.sub(r"\1***\2", dsn)
