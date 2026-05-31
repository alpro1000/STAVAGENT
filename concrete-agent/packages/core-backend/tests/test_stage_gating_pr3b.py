"""PR3b integration tests: durable sessions + real isolation + audit + replay.

Two tiers:

  - In-memory (always run): replay determinism (AC20) and the end-to-end stub
    walk (AC17) — these need only the orchestrator + in-memory writers.
  - DB + JWT gated: the /orchestrate endpoint with a real Postgres session store
    and an authenticated principal — cross-user isolation through the endpoint
    (AC18), durable resume (AC11), audit persistence (AC14/AC16), and the
    DB-level append-only guarantee (AC13). Skipped when DATABASE_URL or the
    FastAPI/PyJWT deps are absent; in CI (STAGEGATING_REQUIRE_ENDPOINT_TESTS=1) a
    missing dep/DB turns the job RED instead of skipping.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md AC11, AC13, AC14,
AC16, AC17, AC18, AC20.
"""
from __future__ import annotations

import os
from uuid import uuid4

import pytest

from app.services.stage_gating import (
    InMemoryAuditLogWriter,
    InMemorySessionRepository,
    OrchestrateRequest,
    SessionManager,
    StageGatingOrchestrator,
    StepResult,
    WorkflowState,
    load_workflow_config,
)
from app.services.stage_gating.orchestrator import STATUS_COMPLETED

CFG = load_workflow_config()
_REQUIRE = os.environ.get("STAGEGATING_REQUIRE_ENDPOINT_TESTS") == "1"


# ─────────────────────────────────────────────────────────────────────────────
# Tier 1 — in-memory (always run): replay + e2e stub
# ─────────────────────────────────────────────────────────────────────────────

def _full_takeoff_stub_runner(ctx):
    """Deterministic per-state outputs simulating PDF→worklist→KROS→XLSX (AC17).

    No real tools — fixtures simulate tool outputs. Confirms COMMIT_PENDING.
    """
    state = ctx.state
    if state == WorkflowState.DOCUMENT_ANALYSIS:
        return StepResult(outputs={"document": "stub.pdf", "pages": 3},
                          tools_invoked=["analyze_construction_document"])
    if state == WorkflowState.WORK_ATOMIZATION:
        return StepResult(
            outputs={"work_list": True},
            work_items=[
                {"name": "beton C30/37", "_source": "stub.pdf p.2", "formula": "10*2"},
                {"name": "bednění", "_source": "stub.pdf p.2", "formula": "20"},
            ],
            tools_invoked=["create_work_breakdown"],
        )
    if state == WorkflowState.CATALOG_BINDING:
        return StepResult(outputs={"codes": ["121151113"]},
                          tools_invoked=["find_urs_code"])
    if state == WorkflowState.PRICING:
        return StepResult(outputs={"total_czk": 12345}, tools_invoked=["price_stub"])
    if state == WorkflowState.COMMIT_PENDING:
        # Confirmed (the orchestrator passes confirmation_token through ctx).
        return StepResult(outputs={"committed": True})
    if state == WorkflowState.EXPORTED:
        return StepResult(outputs={"xlsx": "soupis_FINAL.xlsx"},
                          tools_invoked=["export_xlsx_stub"])
    return StepResult(outputs={"ok": True})


def _orchestrator(writer=None):
    mgr = SessionManager(InMemorySessionRepository(), config=CFG)
    return StageGatingOrchestrator(
        manager=mgr, config=CFG, tool_runner=_full_takeoff_stub_runner,
        audit_writer=writer,
    )


def test_e2e_stub_walk_completes(  # AC17
):
    writer = InMemoryAuditLogWriter()
    orch = _orchestrator(writer)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(), project_id=uuid4(),
            options={"target_output": "full"}, confirmation_token="ok",
        )
    )
    assert result.status == STATUS_COMPLETED
    assert result.workflow_state == WorkflowState.EXPORTED
    # Work-atomization step recorded both grounded items as VERIFIED.
    atom = next(s for s in result.steps if s["state"] == "WORK_ATOMIZATION")
    assert atom["work_items_verified"] == 2


def _audit_fingerprint(entries):
    """Replay-comparable projection: drop session_id (differs per run) and any
    timestamp (already excluded from hashes). Order preserved."""
    return [
        (
            e.event_type, e.tool_name, e.inputs_hash, e.outputs_hash,
            e.transition_from, e.transition_to, e.transition_source,
            e.core_engine_version,
        )
        for e in entries
    ]


def test_replay_same_inputs_same_final_state_and_audit(  # AC20
):
    def run_once():
        writer = InMemoryAuditLogWriter()
        orch = _orchestrator(writer)
        res = orch.run(
            OrchestrateRequest(
                user_id=uuid4(), project_id=uuid4(),
                options={"target_output": "full"}, confirmation_token="ok",
            )
        )
        return res, writer

    first_res, first_writer = run_once()
    replay_res, replay_writer = run_once()

    # Same final state + same step state-sequence (timestamps excluded).
    assert first_res.workflow_state == replay_res.workflow_state == WorkflowState.EXPORTED
    assert [s["state"] for s in first_res.steps] == [s["state"] for s in replay_res.steps]
    # Same audit fingerprint (hashes are timestamp-independent → reproducible).
    assert _audit_fingerprint(first_writer.entries) == _audit_fingerprint(replay_writer.entries)


# ─────────────────────────────────────────────────────────────────────────────
# Tier 2 — DB + JWT gated: endpoint isolation / durability / audit / append-only
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def db_endpoint(monkeypatch):
    """Build the schema + trigger in a real DB, set JWT_SECRET, yield helpers.

    Skips locally (no DATABASE_URL / missing deps). In CI with
    STAGEGATING_REQUIRE_ENDPOINT_TESTS=1 a missing prerequisite raises (red),
    never silently skips.
    """
    database_url = os.environ.get("DATABASE_URL")

    def _bail(reason: str):
        if _REQUIRE:
            raise RuntimeError(f"PR3b endpoint prerequisites unmet: {reason}")
        pytest.skip(reason)

    if not database_url:
        _bail("DATABASE_URL not set")

    try:
        import jwt  # PyJWT
        from fastapi.testclient import TestClient
        from sqlalchemy import text

        from app.core.config import settings
        from app.db.models.base import Base
        from app.db.models.orchestrator_audit_log import OrchestratorAuditLog
        from app.db.models.orchestrator_session import OrchestratorSession
        from app.db.models.project import Project
        from app.db.models.user import User
        from app.main import app
        from app.services.stage_gating import make_sync_session_factory
    except Exception as exc:  # noqa: BLE001
        _bail(f"import unavailable: {exc}")

    secret = "test-jwt-secret-pr3b"
    monkeypatch.setattr(settings, "JWT_SECRET", secret, raising=False)

    factory = make_sync_session_factory(database_url)
    engine = factory.kw["bind"]
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__, Project.__table__,
            OrchestratorSession.__table__, OrchestratorAuditLog.__table__,
        ],
        checkfirst=True,
    )
    # Install the append-only trigger (mirrors the migration) so AC13 holds here.
    with factory() as s:
        s.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION orchestrator_audit_log_append_only()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'orchestrator_audit_log is append-only: % not permitted', TG_OP;
                END;
                $$ LANGUAGE plpgsql;
                """
            )
        )
        s.execute(
            text("DROP TRIGGER IF EXISTS trg_orchestrator_audit_log_append_only ON orchestrator_audit_log;")
        )
        s.execute(
            text(
                """
                CREATE TRIGGER trg_orchestrator_audit_log_append_only
                BEFORE UPDATE OR DELETE ON orchestrator_audit_log
                FOR EACH ROW EXECUTE FUNCTION orchestrator_audit_log_append_only();
                """
            )
        )
        s.commit()

    def make_token(user_id=None, email=None):
        uid = str(user_id or uuid4())
        return jwt.encode(
            {"userId": uid, "email": email or f"{uid}@test.local", "role": "user"},
            secret, algorithm="HS256",
        )

    client = TestClient(app)

    class Helpers:
        pass

    h = Helpers()
    h.client = client
    h.make_token = make_token
    h.factory = factory
    h.text = text
    h.OrchestratorAuditLog = OrchestratorAuditLog
    yield h


def test_endpoint_requires_auth(db_endpoint):  # AC9 / AC18 boundary
    r = db_endpoint.client.post(
        "/api/v1/orchestrate",
        json={"project_id": str(uuid4()), "options": {"target_output": "work_list"}},
    )
    assert r.status_code == 401, r.text


def test_endpoint_full_takeoff_durable_pause_resume(db_endpoint):  # AC11
    token = db_endpoint.make_token()
    headers = {"Authorization": f"Bearer {token}"}
    pid = str(uuid4())

    r1 = db_endpoint.client.post(
        "/api/v1/orchestrate",
        headers=headers,
        json={"project_id": pid, "options": {"target_output": "full"}},
    )
    assert r1.status_code == 200, r1.text
    b1 = r1.json()
    assert b1["status"] == "paused_for_input"
    assert b1["workflow_state"] == WorkflowState.COMMIT_PENDING.value

    # Resume in a separate request (fresh orchestrator instance → proves the
    # session was loaded back from the DB, not from in-process memory).
    r2 = db_endpoint.client.post(
        "/api/v1/orchestrate",
        headers=headers,
        json={"project_id": pid, "session_id": b1["session_id"],
              "confirmation_token": "ok"},
    )
    assert r2.status_code == 200, r2.text
    b2 = r2.json()
    assert b2["status"] == "completed"
    assert b2["workflow_state"] == WorkflowState.EXPORTED.value


def test_cross_user_isolation_through_endpoint(db_endpoint):  # AC18
    headers_a = {"Authorization": f"Bearer {db_endpoint.make_token()}"}
    headers_b = {"Authorization": f"Bearer {db_endpoint.make_token()}"}
    pid = str(uuid4())

    r1 = db_endpoint.client.post(
        "/api/v1/orchestrate",
        headers=headers_a,
        json={"project_id": pid, "options": {"target_output": "full"}},
    )
    assert r1.status_code == 200
    session_id = r1.json()["session_id"]

    # User B tries to resume user A's session → 403 (real HTTP boundary).
    r2 = db_endpoint.client.post(
        "/api/v1/orchestrate",
        headers=headers_b,
        json={"project_id": pid, "session_id": session_id, "confirmation_token": "ok"},
    )
    assert r2.status_code == 403, r2.text


def test_audit_rows_persisted(db_endpoint):  # AC14 / AC16
    token = db_endpoint.make_token()
    r = db_endpoint.client.post(
        "/api/v1/orchestrate",
        headers={"Authorization": f"Bearer {token}"},
        json={"project_id": str(uuid4()), "options": {"target_output": "work_list"}},
    )
    assert r.status_code == 200, r.text
    session_id = r.json()["session_id"]

    with db_endpoint.factory() as s:
        rows = list(
            s.execute(
                db_endpoint.text(
                    "SELECT event_type, transition_source, core_engine_version "
                    "FROM orchestrator_audit_log WHERE session_id = :sid"
                ),
                {"sid": session_id},
            )
        )
    event_types = {row[0] for row in rows}
    assert "tool_call" in event_types
    assert "state_transition" in event_types
    # AC16: transition source recorded; AC14: engine version stamped.
    transitions = [row for row in rows if row[0] == "state_transition"]
    assert transitions and transitions[0][1].startswith("orchestrator:")
    assert all(row[2] for row in rows)


def test_audit_log_is_append_only(db_endpoint):  # AC13
    log = db_endpoint.OrchestratorAuditLog
    with db_endpoint.factory() as s:
        row = log(
            session_id=uuid4(), user_id=uuid4(), event_type="tool_call",
            tool_name="probe", core_engine_version="test",
        )
        s.add(row)
        s.commit()
        row_id = row.id

    # UPDATE must raise (trigger).
    with db_endpoint.factory() as s:
        with pytest.raises(Exception):
            s.execute(
                db_endpoint.text(
                    "UPDATE orchestrator_audit_log SET tool_name='x' WHERE id = :id"
                ),
                {"id": row_id},
            )
            s.commit()

    # DELETE must raise (trigger).
    with db_endpoint.factory() as s:
        with pytest.raises(Exception):
            s.execute(
                db_endpoint.text(
                    "DELETE FROM orchestrator_audit_log WHERE id = :id"
                ),
                {"id": row_id},
            )
            s.commit()
