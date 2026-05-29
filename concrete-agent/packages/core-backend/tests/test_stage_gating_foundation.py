"""
Unit tests for the orchestrator stage-gating foundation (PR1).

No network, no AI, no database — the state machine, workflow loader and session
manager are pure and run against an in-memory repository.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §1, §4, §5, §6
Acceptance criteria touched here: 2, 9, 10, 11, 15, 18 (DB-independent parts).
"""
from __future__ import annotations

from datetime import timedelta, timezone, datetime
from uuid import uuid4

import pytest

from app.services.stage_gating import (
    DEFAULT_TTL_DAYS,
    InMemorySessionRepository,
    SessionAccessError,
    SessionManager,
    SessionTerminalError,
    StateTransitionError,
    WorkflowState,
    is_resumable,
    load_workflow_config,
    transition,
)
from app.services.stage_gating.workflow_loader import WorkflowDefinitionError


# ── State machine (AC2) ──────────────────────────────────────────────────────

def test_nine_states_enumerated():
    """Task enumerates 9 states (8 'core' + optional DECOMPOSITION)."""
    assert len(list(WorkflowState)) == 9
    assert WorkflowState.DECOMPOSITION in set(WorkflowState)


def test_model_check_matches_enum():
    """DB CHECK literal list must stay in sync with the authoritative enum."""
    from app.db.models.orchestrator_session import WORKFLOW_STATES

    assert tuple(s.value for s in WorkflowState) == WORKFLOW_STATES


def test_transition_allowed():
    cfg = load_workflow_config()
    assert (
        transition(
            WorkflowState.DOCUMENT_ANALYSIS,
            WorkflowState.WORK_ATOMIZATION,
            cfg.transitions,
        )
        == WorkflowState.WORK_ATOMIZATION
    )


def test_transition_rejected():
    cfg = load_workflow_config()
    # Pattern 15: cannot jump straight from atomization to pricing.
    with pytest.raises(StateTransitionError):
        transition(
            WorkflowState.WORK_ATOMIZATION,
            WorkflowState.PRICING,
            cfg.transitions,
        )


def test_optional_decomposition_branch():
    cfg = load_workflow_config()
    assert (
        transition(
            WorkflowState.WORK_ATOMIZATION,
            WorkflowState.DECOMPOSITION,
            cfg.transitions,
        )
        == WorkflowState.DECOMPOSITION
    )


def test_terminal_states_not_resumable():
    assert not is_resumable(WorkflowState.COMMITTED)
    assert not is_resumable(WorkflowState.EXPORTED)
    assert is_resumable(WorkflowState.WORK_ATOMIZATION)


# ── Workflow loader (AC15) ───────────────────────────────────────────────────

def test_loader_parses_all_states_and_tools():
    cfg = load_workflow_config()
    # Every enum state must be present in the config.
    for state in WorkflowState:
        assert state in cfg.tools_by_state
    # _all_stages tools are merged into every state.
    assert "read_project_documentation" in cfg.tools_allowed_in(
        WorkflowState.CATALOG_BINDING
    )
    # Catalog tools only in CATALOG_BINDING.
    assert "find_urs_code" in cfg.tools_allowed_in(WorkflowState.CATALOG_BINDING)
    assert "find_urs_code" not in cfg.tools_allowed_in(
        WorkflowState.WORK_ATOMIZATION
    )


def test_loader_named_workflows():
    cfg = load_workflow_config()
    assert "full_takeoff" in cfg.workflows
    full = cfg.workflows["full_takeoff"]
    assert full.start_state == WorkflowState.DOCUMENT_ANALYSIS
    assert full.sequence[-1] == WorkflowState.EXPORTED


def test_loader_rejects_unknown_state(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "version: 1\nstates:\n  NOT_A_STATE:\n    tools: []\n", encoding="utf-8"
    )
    with pytest.raises(WorkflowDefinitionError):
        load_workflow_config(bad)


# ── Session manager: create + TTL (AC9, AC10) ────────────────────────────────

def _manager():
    return SessionManager(InMemorySessionRepository())


def test_create_session_defaults_ttl_7_days():
    mgr = _manager()
    now = datetime(2026, 5, 29, 12, 0, tzinfo=timezone.utc)
    uid, pid, sid = uuid4(), uuid4(), uuid4()
    state = mgr.create_session(
        session_id=sid, user_id=uid, project_id=pid, now=now
    )
    assert state.workflow_state == WorkflowState.DOCUMENT_ANALYSIS
    assert state.status == "active"
    assert state.expires_at == now + timedelta(days=DEFAULT_TTL_DAYS)


def test_create_session_configurable_ttl():
    mgr = _manager()
    now = datetime(2026, 5, 29, 12, 0, tzinfo=timezone.utc)
    state = mgr.create_session(
        session_id=uuid4(),
        user_id=uuid4(),
        project_id=uuid4(),
        ttl_days=30,
        now=now,
    )
    assert state.expires_at == now + timedelta(days=30)


# ── Session manager: advance logs transition source (AC16) ───────────────────

def test_advance_logs_transition_source():
    mgr = _manager()
    uid, sid = uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=uid, project_id=uuid4())
    state = mgr.advance(
        session_id=sid,
        user_id=uid,
        target=WorkflowState.WORK_ATOMIZATION,
        triggered_by="orchestrator:doc_analysis_complete",
    )
    assert state.workflow_state == WorkflowState.WORK_ATOMIZATION
    entry = state.tool_calls_log[-1]
    assert entry["type"] == "state_transition"
    assert entry["from"] == "DOCUMENT_ANALYSIS"
    assert entry["to"] == "WORK_ATOMIZATION"
    assert entry["triggered_by"] == "orchestrator:doc_analysis_complete"


def test_advance_rejects_illegal_transition():
    mgr = _manager()
    uid, sid = uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=uid, project_id=uuid4())
    with pytest.raises(StateTransitionError):
        mgr.advance(
            session_id=sid,
            user_id=uid,
            target=WorkflowState.PRICING,
            triggered_by="test",
        )


# ── Resume from non-terminal state (AC11) ────────────────────────────────────

def test_resume_preserves_state_after_pause():
    """Create -> advance to WORK_ATOMIZATION -> 'pause' -> resume; identical."""
    repo = InMemorySessionRepository()
    mgr = SessionManager(repo)
    uid, sid = uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=uid, project_id=uuid4())
    advanced = mgr.advance(
        session_id=sid,
        user_id=uid,
        target=WorkflowState.WORK_ATOMIZATION,
        triggered_by="orchestrator",
    )
    # A fresh manager (simulates a new request / process) resumes from the repo.
    resumed = SessionManager(repo).resume_session(session_id=sid, user_id=uid)
    assert resumed.workflow_state == WorkflowState.WORK_ATOMIZATION
    assert resumed.workflow_state == advanced.workflow_state
    assert resumed.tool_calls_log == advanced.tool_calls_log
    assert resumed.expires_at == advanced.expires_at


def test_resume_terminal_session_rejected():
    repo = InMemorySessionRepository()
    mgr = SessionManager(repo)
    uid, sid = uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=uid, project_id=uuid4())
    # Walk to a terminal state through the legal path.
    for target in (
        WorkflowState.WORK_ATOMIZATION,
        WorkflowState.CATALOG_BINDING,
        WorkflowState.PRICING,
        WorkflowState.REVIEW,
        WorkflowState.COMMIT_PENDING,
        WorkflowState.COMMITTED,
    ):
        mgr.advance(session_id=sid, user_id=uid, target=target, triggered_by="t")
    with pytest.raises(SessionTerminalError):
        mgr.resume_session(session_id=sid, user_id=uid)


def test_resume_expired_session_rejected():
    repo = InMemorySessionRepository()
    mgr = SessionManager(repo)
    uid, sid = uuid4(), uuid4()
    created_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    mgr.create_session(
        session_id=sid, user_id=uid, project_id=uuid4(), now=created_at
    )
    # 8 days later — past the 7-day TTL.
    later = created_at + timedelta(days=8)
    with pytest.raises(SessionTerminalError):
        mgr.resume_session(session_id=sid, user_id=uid, now=later)


# ── Cross-user isolation (AC18, basic) ───────────────────────────────────────

def test_cross_user_access_rejected():
    repo = InMemorySessionRepository()
    mgr = SessionManager(repo)
    user_a, user_b, sid = uuid4(), uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=user_a, project_id=uuid4())
    with pytest.raises(SessionAccessError):
        mgr.resume_session(session_id=sid, user_id=user_b)
    with pytest.raises(SessionAccessError):
        mgr.advance(
            session_id=sid,
            user_id=user_b,
            target=WorkflowState.WORK_ATOMIZATION,
            triggered_by="attacker",
        )


# ── End-to-end stub walk (AC17, DB-free portion) ─────────────────────────────

def test_full_takeoff_sequence_walks_cleanly():
    """Stubbed full workflow PDF -> work list -> binding -> ... -> EXPORTED.

    No real tools invoked — this verifies the state graph permits the documented
    full_takeoff sequence end to end (the orchestrator loop that calls tools is
    PR2; here we prove the rails are laid correctly)."""
    cfg = load_workflow_config()
    mgr = SessionManager(InMemorySessionRepository(), config=cfg)
    uid, sid = uuid4(), uuid4()
    mgr.create_session(session_id=sid, user_id=uid, project_id=uuid4())
    sequence = cfg.workflows["full_takeoff"].sequence
    for target in sequence[1:]:  # first element is the start_state
        mgr.advance(
            session_id=sid, user_id=uid, target=target, triggered_by="orchestrator"
        )
    final = mgr._repo.get(sid)
    assert final.workflow_state == WorkflowState.EXPORTED
