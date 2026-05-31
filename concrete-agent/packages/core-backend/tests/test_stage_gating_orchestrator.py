"""
Unit tests for the PR3a orchestrator: intent classifier + orchestrator loop +
HITL pause/resume + the canonical /orchestrate endpoint.

No network, no AI, no real DB — the orchestrator runs over the in-memory
session repository with stub tool-runners, exactly the way the foundation tests
exercise the state machine. Tool execution is the injected seam, so these tests
verify orchestration (sequencing, HITL, grounding recording, ownership) without
invoking any real tool.

Covers:
  - intent classification: explicit target_output, keyword heuristic, default,
    unknown-output error, map↔YAML drift guard
  - full_takeoff walks DOCUMENT_ANALYSIS -> ... -> EXPORTED == COMPLETED (e2e stub)
  - work_list_only stops after WORK_ATOMIZATION
  - HITL: a step that needs input PAUSES (state unchanged, nothing recorded);
    resume re-runs that step and continues to completion
  - grounding-gate counts are recorded per step from emitted work_items
  - ownership guard on resume; terminal session cannot be resumed
  - checkpoint runner gates COMMIT_PENDING on a confirmation_token
  (HTTP endpoint tests live in test_stage_gating_pr3b.py — the PR3b endpoint is
  auth + DB gated, so those are integration tests, not in-memory unit tests.)

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §5.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from app.services.stage_gating import (
    DEFAULT_WORKFLOW,
    InMemorySessionRepository,
    IntentClassificationError,
    OrchestrateRequest,
    SessionAccessError,
    SessionManager,
    SessionTerminalError,
    StageGatingOrchestrator,
    StepResult,
    WorkflowState,
    classify_intent,
    load_workflow_config,
    make_checkpoint_tool_runner,
)
from app.services.stage_gating.orchestrator import (
    PARTIALS_WORKFLOW_KEY,
    STATUS_COMPLETED,
    STATUS_ERROR,
    STATUS_PAUSED,
)

CFG = load_workflow_config()


def _orchestrator(tool_runner):
    mgr = SessionManager(InMemorySessionRepository(), config=CFG)
    return StageGatingOrchestrator(manager=mgr, config=CFG, tool_runner=tool_runner)


def _always_complete(ctx):
    return StepResult(outputs={"ok": True}, tools_invoked=["stub"])


# ── intent classifier ────────────────────────────────────────────────────────

def test_explicit_target_output_selects_work_list_only():
    assert (
        classify_intent(config=CFG, options={"target_output": "work_list"})
        == "work_list_only"
    )


def test_explicit_target_output_selects_full_takeoff():
    assert (
        classify_intent(config=CFG, options={"target_output": "export"})
        == "full_takeoff"
    )


def test_unknown_target_output_raises():
    with pytest.raises(IntentClassificationError):
        classify_intent(config=CFG, options={"target_output": "nonsense"})


def test_message_keyword_selects_work_list_only():
    assert (
        classify_intent(config=CFG, message="Chci jen práce bez cen, prosím")
        == "work_list_only"
    )


def test_default_workflow_when_no_signal():
    assert classify_intent(config=CFG, message="spočítej mi rozpočet") == DEFAULT_WORKFLOW
    assert classify_intent(config=CFG) == DEFAULT_WORKFLOW


def test_explicit_output_wins_over_message():
    # target_output is the unambiguous signal — it overrides prose.
    assert (
        classify_intent(
            config=CFG,
            message="jen práce bez cen",
            options={"target_output": "full"},
        )
        == "full_takeoff"
    )


# ── full_takeoff e2e stub walk (AC17) ────────────────────────────────────────

def test_full_takeoff_walks_to_exported_completed():
    orch = _orchestrator(_always_complete)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(),
            project_id=uuid4(),
            options={"target_output": "full"},
        )
    )
    assert result.status == STATUS_COMPLETED
    assert result.workflow_name == "full_takeoff"
    assert result.workflow_state == WorkflowState.EXPORTED
    # One recorded step per state in the sequence.
    assert len(result.steps) == len(CFG.workflows["full_takeoff"].sequence)
    assert result.steps[0]["state"] == WorkflowState.DOCUMENT_ANALYSIS.value
    assert result.steps[-1]["state"] == WorkflowState.EXPORTED.value


def test_work_list_only_stops_after_atomization():
    orch = _orchestrator(_always_complete)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(),
            project_id=uuid4(),
            options={"target_output": "work_list"},
        )
    )
    assert result.status == STATUS_COMPLETED
    assert result.workflow_name == "work_list_only"
    assert result.workflow_state == WorkflowState.WORK_ATOMIZATION
    assert len(result.steps) == 2


# ── HITL pause / resume ──────────────────────────────────────────────────────

def _pausing_at_review(ctx):
    if ctx.state == WorkflowState.REVIEW and ctx.user_response is None:
        return StepResult(
            needs_user_input=True,
            question={"state": ctx.state.value, "prompt": "Approve?"},
        )
    return StepResult(outputs={"ok": True})


def test_step_pauses_for_input_and_leaves_state_unchanged():
    orch = _orchestrator(_pausing_at_review)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(),
            project_id=uuid4(),
            options={"target_output": "full"},
        )
    )
    assert result.status == STATUS_PAUSED
    assert result.workflow_state == WorkflowState.REVIEW
    assert result.question and result.question["prompt"] == "Approve?"
    # Steps recorded are the four that completed BEFORE the paused REVIEW step.
    assert [s["state"] for s in result.steps] == [
        WorkflowState.DOCUMENT_ANALYSIS.value,
        WorkflowState.WORK_ATOMIZATION.value,
        WorkflowState.CATALOG_BINDING.value,
        WorkflowState.PRICING.value,
    ]


def test_resume_after_pause_continues_to_completion():
    orch = _orchestrator(_pausing_at_review)
    uid, pid = uuid4(), uuid4()
    paused = orch.run(
        OrchestrateRequest(user_id=uid, project_id=pid, options={"target_output": "full"})
    )
    assert paused.status == STATUS_PAUSED

    resumed = orch.run(
        OrchestrateRequest(
            user_id=uid,
            project_id=pid,
            session_id=paused.session_id,
            user_response="approved",
        )
    )
    assert resumed.status == STATUS_COMPLETED
    assert resumed.workflow_state == WorkflowState.EXPORTED
    # The resume re-ran REVIEW (now answered) and the remaining states.
    assert resumed.steps[0]["state"] == WorkflowState.REVIEW.value
    assert resumed.steps[-1]["state"] == WorkflowState.EXPORTED.value


def test_user_response_only_applies_to_first_resumed_step():
    """A second pause downstream must still fire — the response is consumed by
    the step it answered, not carried forward."""

    def two_pause_points(ctx):
        if ctx.state == WorkflowState.PRICING and ctx.user_response is None:
            return StepResult(needs_user_input=True, question={"q": "price?"})
        if ctx.state == WorkflowState.REVIEW and ctx.user_response is None:
            return StepResult(needs_user_input=True, question={"q": "review?"})
        return StepResult(outputs={"ok": True})

    orch = _orchestrator(two_pause_points)
    uid, pid = uuid4(), uuid4()
    p1 = orch.run(
        OrchestrateRequest(user_id=uid, project_id=pid, options={"target_output": "full"})
    )
    assert p1.status == STATUS_PAUSED and p1.workflow_state == WorkflowState.PRICING

    # Resume with a response: PRICING completes, but REVIEW must pause again
    # (the response was consumed by PRICING, not reused for REVIEW).
    p2 = orch.run(
        OrchestrateRequest(
            user_id=uid, project_id=pid, session_id=p1.session_id, user_response="ok"
        )
    )
    assert p2.status == STATUS_PAUSED and p2.workflow_state == WorkflowState.REVIEW


# ── grounding recording ──────────────────────────────────────────────────────

def test_work_items_grounding_counts_recorded():
    def runner(ctx):
        if ctx.state == WorkflowState.WORK_ATOMIZATION:
            return StepResult(
                work_items=[
                    {"name": "beton", "_source": "TZ.pdf p.3"},
                    {"name": "no-source"},
                ],
                tools_invoked=["create_work_breakdown"],
            )
        return StepResult(outputs={"ok": True})

    orch = _orchestrator(runner)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(), project_id=uuid4(), options={"target_output": "work_list"}
        )
    )
    atom = next(
        s for s in result.steps if s["state"] == WorkflowState.WORK_ATOMIZATION.value
    )
    assert atom["work_items_verified"] == 1
    assert atom["work_items_unverified"] == 1


# ── ownership + terminal guards ──────────────────────────────────────────────

def test_resume_by_wrong_user_is_rejected():
    orch = _orchestrator(_pausing_at_review)
    owner = uuid4()
    paused = orch.run(
        OrchestrateRequest(user_id=owner, project_id=uuid4(), options={"target_output": "full"})
    )
    with pytest.raises(SessionAccessError):
        orch.run(
            OrchestrateRequest(
                user_id=uuid4(),  # attacker
                project_id=uuid4(),
                session_id=paused.session_id,
                user_response="approved",
            )
        )


def test_resume_of_completed_session_is_terminal():
    orch = _orchestrator(_always_complete)
    uid = uuid4()
    done = orch.run(
        OrchestrateRequest(user_id=uid, project_id=uuid4(), options={"target_output": "full"})
    )
    assert done.status == STATUS_COMPLETED
    with pytest.raises(SessionTerminalError):
        orch.run(
            OrchestrateRequest(user_id=uid, project_id=uuid4(), session_id=done.session_id)
        )


# ── resume into a state outside the workflow sequence ────────────────────────

def test_resume_state_not_in_sequence_returns_error_not_500():
    """A session sitting in a state absent from the resolved workflow's sequence
    (e.g. the optional DECOMPOSITION branch under full_takeoff) must yield a
    clean STATUS_ERROR, not an unhandled ValueError from sequence.index()."""
    mgr = SessionManager(InMemorySessionRepository(), config=CFG)
    uid, pid, sid = uuid4(), uuid4(), uuid4()
    st = mgr.create_session(
        session_id=sid,
        user_id=uid,
        project_id=pid,
        start_state=WorkflowState.WORK_ATOMIZATION,
    )
    st.partials[PARTIALS_WORKFLOW_KEY] = "full_takeoff"
    mgr.persist(st, user_id=uid)
    # DECOMPOSITION is a legal edge from WORK_ATOMIZATION but is NOT in the
    # full_takeoff sequence.
    mgr.advance(
        session_id=sid,
        user_id=uid,
        target=WorkflowState.DECOMPOSITION,
        triggered_by="test",
    )

    orch = StageGatingOrchestrator(
        manager=mgr, config=CFG, tool_runner=_always_complete
    )
    result = orch.run(OrchestrateRequest(user_id=uid, project_id=pid, session_id=sid))
    assert result.status == STATUS_ERROR
    assert result.workflow_state == WorkflowState.DECOMPOSITION
    assert "DECOMPOSITION" in (result.error or "")


# ── checkpoint runner commit gate ────────────────────────────────────────────

def test_checkpoint_runner_gates_commit_on_confirmation():
    runner = make_checkpoint_tool_runner(CFG)
    orch = StageGatingOrchestrator(
        manager=SessionManager(InMemorySessionRepository(), config=CFG),
        config=CFG,
        tool_runner=runner,
    )
    uid, pid = uuid4(), uuid4()
    paused = orch.run(
        OrchestrateRequest(user_id=uid, project_id=pid, options={"target_output": "full"})
    )
    assert paused.status == STATUS_PAUSED
    assert paused.workflow_state == WorkflowState.COMMIT_PENDING
    assert paused.question["required"] == "confirmation_token"

    done = orch.run(
        OrchestrateRequest(
            user_id=uid,
            project_id=pid,
            session_id=paused.session_id,
            confirmation_token="user-confirmed",
        )
    )
    assert done.status == STATUS_COMPLETED
    assert done.workflow_state == WorkflowState.EXPORTED


# NOTE: HTTP endpoint tests moved to test_stage_gating_pr3b.py — the PR3b
# endpoint requires an authenticated JWT principal + a durable DB session store,
# so its tests are DB+auth-gated integration tests, not in-memory unit tests.
