"""OrchestratorAuditLog model — append-only audit trail for stage-gating (PR3b).

Every orchestrator-driven tool call, state transition, and policy violation is
recorded here as an immutable row. Append-only is enforced at the DB level by a
BEFORE UPDATE OR DELETE trigger that RAISEs (see the companion migration
`2026_05_30_orchestrator_audit_log.py`) — it holds regardless of the connecting
DB role, so application bugs or a compromised app credential cannot rewrite
history (task §3 / Domain Rules / AC13).

Columns capture the AC14 fingerprint set: tool name + version, inputs/outputs/
policy hashes, core engine version, session/user/project ids, and the timestamp.
State transitions additionally record their source (the tool name or orchestrator
decision rule that triggered them — AC16).

Tenant columns are plain indexed UUIDs, NOT cascading FKs: an audit row must
survive deletion of its session/user/project (append-only ⇒ never auto-removed).

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §3, AC13, AC14, AC16.
"""
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.models.base import Base

# The event kinds an audit row can describe.
AUDIT_EVENT_TYPES = ("tool_call", "state_transition", "policy_violation")


class OrchestratorAuditLog(Base):
    """One immutable audit record for an orchestrator action."""

    __tablename__ = "orchestrator_audit_log"

    # Tenant / session context (plain UUIDs — NOT FKs; audit outlives its refs).
    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # What happened.
    event_type = Column(String(30), nullable=False, index=True)

    # Tool fingerprint (AC14) — present for tool_call / policy_violation events.
    tool_name = Column(String(120), nullable=True)
    tool_version = Column(String(40), nullable=True)
    inputs_hash = Column(String(64), nullable=True)
    outputs_hash = Column(String(64), nullable=True)
    policy_hash = Column(String(64), nullable=True)
    core_engine_version = Column(String(40), nullable=True)

    # State-transition fields (AC16) — present for state_transition events.
    transition_from = Column(String(30), nullable=True)
    transition_to = Column(String(30), nullable=True)
    transition_source = Column(String(200), nullable=True)

    # Free-form structured context (e.g. attempted_state + allowed_stages for a
    # policy_violation). Never part of the replay hash.
    detail = Column(JSONB, nullable=True)

    # created_at / updated_at are inherited from Base. created_at is the AC14
    # timestamp. updated_at is inert here — the append-only trigger blocks every
    # UPDATE, so it never changes after INSERT.

    def __repr__(self) -> str:
        return (
            f"<OrchestratorAuditLog(id={self.id}, event='{self.event_type}', "
            f"session={self.session_id})>"
        )
