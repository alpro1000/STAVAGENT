"""Unit tests for the PR3b audit-log layer: content hashing + orchestrator wiring.

No DB — the orchestrator runs over the in-memory session repository with an
in-memory audit writer. Verifies AC14 (audit rows carry the tool/transition
fingerprint) and AC16 (state transitions record their source), plus the
hash-canonicalization that the replay guarantee (AC20) relies on.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md AC13, AC14, AC16, AC20.
"""
from __future__ import annotations

from uuid import uuid4

from app.services.stage_gating import (
    InMemoryAuditLogWriter,
    InMemorySessionRepository,
    OrchestrateRequest,
    SessionManager,
    StageGatingOrchestrator,
    StepResult,
    hash_payload,
    load_workflow_config,
)
from app.services.stage_gating.audit_log import (
    EVENT_STATE_TRANSITION,
    EVENT_TOOL_CALL,
    strip_volatile,
)

CFG = load_workflow_config()


# ── hashing ──────────────────────────────────────────────────────────────────

def test_hash_payload_is_deterministic_and_key_order_independent():
    a = hash_payload({"x": 1, "y": [1, 2, 3]})
    b = hash_payload({"y": [1, 2, 3], "x": 1})
    assert a == b is not None


def test_hash_payload_excludes_volatile_timestamps():
    with_ts = hash_payload({"state": "REVIEW", "at": "2026-05-30T10:00:00Z"})
    without_ts = hash_payload({"state": "REVIEW"})
    assert with_ts == without_ts


def test_strip_volatile_is_recursive():
    cleaned = strip_volatile({"a": {"at": 1, "keep": 2}, "list": [{"ts": 9, "k": 3}]})
    assert cleaned == {"a": {"keep": 2}, "list": [{"k": 3}]}


def test_hash_payload_none_is_none():
    assert hash_payload(None) is None


# ── orchestrator emits audit entries ─────────────────────────────────────────

def _orchestrator(writer):
    mgr = SessionManager(InMemorySessionRepository(), config=CFG)
    return StageGatingOrchestrator(
        manager=mgr,
        config=CFG,
        tool_runner=lambda ctx: StepResult(outputs={"ok": True}, tools_invoked=["stub"]),
        audit_writer=writer,
    )


def test_audit_records_tool_calls_and_transitions_with_source():
    writer = InMemoryAuditLogWriter()
    orch = _orchestrator(writer)
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(), project_id=uuid4(), options={"target_output": "work_list"}
        )
    )
    # work_list_only = 2 states → 2 tool_call rows + 1 transition row.
    tool_calls = [e for e in writer.entries if e.event_type == EVENT_TOOL_CALL]
    transitions = [e for e in writer.entries if e.event_type == EVENT_STATE_TRANSITION]
    assert len(tool_calls) == 2
    assert len(transitions) == 1

    # AC14 fingerprint present.
    tc = tool_calls[0]
    assert tc.inputs_hash and tc.outputs_hash
    assert tc.core_engine_version
    assert tc.session_id == result.session_id

    # AC16: transition records its source.
    tr = transitions[0]
    assert tr.transition_from == "DOCUMENT_ANALYSIS"
    assert tr.transition_to == "WORK_ATOMIZATION"
    assert tr.transition_source.startswith("orchestrator:")


def test_sync_audit_writer_swallows_db_errors(caplog):
    """A DB failure in the audit write must NOT propagate (workflow continues);
    it is logged at ERROR so the gap is observable, not silent."""
    from app.services.stage_gating.audit_log import (
        EVENT_TOOL_CALL,
        AuditEntry,
        SyncAuditLogWriter,
    )

    def failing_factory():
        raise RuntimeError("db down")

    writer = SyncAuditLogWriter(failing_factory)
    entry = AuditEntry(event_type=EVENT_TOOL_CALL, session_id=uuid4(), user_id=uuid4())
    # Must not raise.
    writer.write(entry)
    assert any("failed to write" in r.message.lower() or "audit" in r.message.lower()
               for r in caplog.records)


def test_audit_writer_default_is_noop_safe():
    # No audit_writer → NullAuditLogWriter; run must not raise.
    mgr = SessionManager(InMemorySessionRepository(), config=CFG)
    orch = StageGatingOrchestrator(
        manager=mgr,
        config=CFG,
        tool_runner=lambda ctx: StepResult(outputs={"ok": True}),
    )
    result = orch.run(
        OrchestrateRequest(
            user_id=uuid4(), project_id=uuid4(), options={"target_output": "work_list"}
        )
    )
    assert result.status == "completed"
