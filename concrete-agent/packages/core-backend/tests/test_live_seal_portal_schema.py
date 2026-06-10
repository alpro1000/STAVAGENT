"""Live-seal blockers goldens — JWT path vs the REAL (Portal-shaped) schema.

The first live e2e run (2026-06-10) died in the auth layer: provisioning was
written for an ASSUMED own UUID `users` schema, while the shared production DB
is Portal-owned — `users.id` is INTEGER and (pre manual ALTER) had no `status`
column. The 500 chain was UndefinedColumn(users.status) → DatatypeMismatch
(integer id vs uuid). A fourth latent layer: no migration ever created the
orchestrator tables, so production didn't have them at all.

These goldens replay that defect class OFFLINE against a fixture schema built
to the observed production shape (task §1.4): a scratch Postgres schema with an
INTEGER-id `users` table WITHOUT `status` (the pre-ALTER prod state) plus the
new 012 migration. Under the old code the endpoint run below 500s; under
б-zero (no FKs, no provisioning) it completes and writes NOTHING to users.

DB-gated like test_stage_gating_pr3b.py: skips locally without DATABASE_URL;
in CI (STAGEGATING_REQUIRE_ENDPOINT_TESTS=1) a missing prerequisite is RED,
never a silent skip. Uses the CI Postgres service container — no live/prod
dependency; the scratch schema keeps the shared CI DB untouched.
"""
from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID, uuid4

import pytest

_REQUIRE = os.environ.get("STAGEGATING_REQUIRE_ENDPOINT_TESTS") == "1"
_SCHEMA = "portal_like_live_seal"

# Portal `users` as observed in production (task §1.4) — INTEGER id, and
# deliberately WITHOUT `status` (the pre-ALTER state the live run hit).
_PORTAL_USERS_DDL = f"""
CREATE TABLE {_SCHEMA}.users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    name            TEXT,
    role            TEXT,
    org_id          INTEGER,
    company         TEXT,
    phone           TEXT,
    plan            TEXT,
    preferences     JSONB,
    credit_balance  INTEGER DEFAULT 0,
    email_verified  BOOLEAN DEFAULT false,
    banned          BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
)
"""


def _scratch_dsn(base: str) -> str:
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}options=-csearch_path%3D{_SCHEMA}"


@pytest.fixture(scope="module")
def portal_db():
    """Scratch schema shaped like production + migration 012; JWT configured."""
    database_url = os.environ.get("DATABASE_URL")

    def _bail(reason: str):
        if _REQUIRE:
            raise RuntimeError(f"live-seal golden prerequisites unmet: {reason}")
        pytest.skip(reason)

    if not database_url:
        _bail("DATABASE_URL not set")

    try:
        import jwt  # PyJWT
        from fastapi.testclient import TestClient
        from sqlalchemy import text

        from app.core.config import settings
        from app.main import app
        from app.services.stage_gating import make_sync_session_factory
    except Exception as exc:  # noqa: BLE001
        _bail(f"import unavailable: {exc}")

    scratch = _scratch_dsn(database_url)
    migration_sql = (
        Path(__file__).resolve().parents[1]
        / "migrations" / "012_orchestrator_tables.sql"
    ).read_text(encoding="utf-8")

    base_factory = make_sync_session_factory(database_url)
    with base_factory() as s:
        s.execute(text(f"DROP SCHEMA IF EXISTS {_SCHEMA} CASCADE"))
        s.execute(text(f"CREATE SCHEMA {_SCHEMA}"))
        s.commit()

    scratch_factory = make_sync_session_factory(scratch)
    with scratch_factory() as s:
        s.execute(text(_PORTAL_USERS_DDL))
        s.execute(text(migration_sql))
        s.commit()

    mp = pytest.MonkeyPatch()
    secret = "test-jwt-secret-live-seal"
    mp.setattr(settings, "JWT_SECRET", secret, raising=False)
    # The /orchestrate route builds its session factory from settings.DATABASE_URL
    # at request time → all orchestrator reads/writes land in the scratch schema.
    mp.setattr(settings, "DATABASE_URL", scratch, raising=False)

    client = TestClient(app)

    class H:
        pass

    h = H()
    h.client = client
    h.factory = scratch_factory
    h.text = text
    h.scratch_dsn = scratch

    def make_token(user_id=None):
        uid = str(user_id or uuid4())
        return jwt.encode(
            {"userId": uid, "email": f"{uid}@test.local", "role": "user"},
            secret, algorithm="HS256",
        ), uid

    h.make_token = make_token
    yield h
    mp.undo()


# ── golden 1 — the defect replay: JWT flow vs Portal-shaped users ─────────────

def test_jwt_flow_completes_against_portal_shaped_schema(portal_db):
    """Under the old provisioning this exact run 500'd (UndefinedColumn
    users.status → DatatypeMismatch integer-vs-uuid). Under б-zero it completes
    — and writes NOTHING to the Portal-owned users table."""
    token, uid = portal_db.make_token()
    headers = {"Authorization": f"Bearer {token}"}
    pid = str(uuid4())

    r1 = portal_db.client.post(
        "/api/v1/orchestrate",
        headers=headers,
        json={"project_id": pid, "options": {"target_output": "full"}},
    )
    assert r1.status_code == 200, r1.text
    b1 = r1.json()
    assert b1["status"] == "paused_for_input", b1

    r2 = portal_db.client.post(
        "/api/v1/orchestrate",
        headers=headers,
        json={"project_id": pid, "session_id": b1["session_id"],
              "confirmation_token": "ok"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "completed", r2.text

    with portal_db.factory() as s:
        # The Portal table is untouched — no provisioning rows, ever.
        n_users = s.execute(portal_db.text("SELECT count(*) FROM users")).scalar()
        assert n_users == 0, "orchestrator wrote into the Portal-owned users table"
        # The session row exists, keyed by the principal's UUID (no FK needed).
        row = s.execute(portal_db.text(
            "SELECT user_id FROM orchestrator_sessions"
        )).fetchone()
        assert row is not None, "no orchestrator_sessions row written"
        assert UUID(str(row[0])) == UUID(uid)


def test_audit_rows_written_and_append_only(portal_db):
    """Migration 012's audit table + trigger work in the Portal-shaped schema."""
    import sqlalchemy.exc

    with portal_db.factory() as s:
        n = s.execute(portal_db.text(
            "SELECT count(*) FROM orchestrator_audit_log"
        )).scalar()
        assert n > 0, "no audit rows from the golden-1 run"
        with pytest.raises(sqlalchemy.exc.DBAPIError, match="append-only"):
            s.execute(portal_db.text(
                "DELETE FROM orchestrator_audit_log"
            ))
            s.commit()
        s.rollback()


# ── golden 2 — drift-guard covers the orchestrator tables (Part C) ────────────
# Keep LAST in this module: it mutates the scratch schema.

def test_drift_check_covers_orchestrator_tables_and_fails_loud(portal_db):
    from app.db.startup_migrations import (
        _CRITICAL_SCHEMA,
        SchemaDriftError,
        assert_critical_schema,
    )

    # Wiring: the JWT path's tables are guarded at startup.
    assert "orchestrator_sessions" in _CRITICAL_SCHEMA
    assert "orchestrator_audit_log" in _CRITICAL_SCHEMA

    # Build a drift-only scratch view: the full _CRITICAL_SCHEMA includes the
    # mcp_* tables which live in the main schema, so check the orchestrator
    # tables against the scratch schema directly (current_schema() = scratch).
    # Migration 012 must satisfy every column the code expects:
    import app.db.startup_migrations as sm

    orchestrator_only = {
        k: v for k, v in _CRITICAL_SCHEMA.items() if k.startswith("orchestrator_")
    }
    mp = pytest.MonkeyPatch()
    mp.setattr(sm, "_CRITICAL_SCHEMA", orchestrator_only)
    try:
        assert_critical_schema(dsn=portal_db.scratch_dsn)  # passes ↔ 012 is complete

        # Today's defect class, replayed: schema diverges from code → the check
        # names the drift explicitly at startup instead of a 500 on a live call.
        with portal_db.factory() as s:
            s.execute(portal_db.text(
                f"ALTER TABLE {_SCHEMA}.orchestrator_sessions DROP COLUMN partials"
            ))
            s.commit()
        with pytest.raises(SchemaDriftError, match="orchestrator_sessions.partials"):
            assert_critical_schema(dsn=portal_db.scratch_dsn)
    finally:
        mp.undo()
