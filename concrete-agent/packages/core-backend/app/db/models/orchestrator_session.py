"""OrchestratorSession model — per-session workflow state for stage-gating.

PR1 (foundation) of TASK_Orchestrator_StageGating_MVP. Persists workflow state
across HITL pauses/resumes. Tracks one state-machine position per session with
JSONB buckets for partials / aggregates / drafts / decisions / logs so PR3 can
replay a recorded session.

Tenant isolation: user_id + project_id are UUID FKs (matching the existing ORM
convention in project.py / job.py). RLS hardening is the parallel cross-user
isolation P0 task — NOT this PR (task §4 + "What Is NOT Included"). This model
only guarantees the columns + indexes are present.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §4
"""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship  # noqa: F401  (relationships deferred, see below)

from app.db.models.base import Base

# Status values for the session lifecycle (distinct from workflow_state, which
# is the state-machine position). Mirrors task §4 "Status" field.
SESSION_STATUSES = ("active", "committed", "abandoned", "undone")

# The 9 workflow states (task §1). Kept as a literal tuple here so the DB CHECK
# constraint is self-contained; the authoritative enum lives in
# app/services/stage_gating/workflow_state.py and a unit test asserts the two
# stay in sync.
WORKFLOW_STATES = (
    "DOCUMENT_ANALYSIS",
    "WORK_ATOMIZATION",
    "DECOMPOSITION",
    "CATALOG_BINDING",
    "PRICING",
    "REVIEW",
    "COMMIT_PENDING",
    "COMMITTED",
    "EXPORTED",
)


class OrchestratorSession(Base):
    """A workflow run driven by the orchestrator stage-gating layer."""

    __tablename__ = "orchestrator_sessions"

    # Tenant isolation (UUID FKs — same convention as projects/background_jobs).
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # State-machine position + lifecycle status.
    workflow_state = Column(
        String(30),
        nullable=False,
        server_default="DOCUMENT_ANALYSIS",
        index=True,
    )
    status = Column(
        String(20),
        nullable=False,
        server_default="active",
        index=True,
    )

    # TTL / expiry — default 7 days, configurable per project (task §4 / AC10).
    # The 7-day default is applied at creation time by the repository layer
    # (server_default kept NULL-safe; column itself is non-null once set).
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # JSONB accumulators for later replay (PR3). All default to empty containers.
    partials = Column(JSONB, nullable=False, server_default="{}")
    aggregates = Column(JSONB, nullable=False, server_default="{}")
    drafts = Column(JSONB, nullable=False, server_default="{}")
    decisions = Column(JSONB, nullable=False, server_default="[]")
    conversation_log = Column(JSONB, nullable=False, server_default="[]")
    tool_calls_log = Column(JSONB, nullable=False, server_default="[]")

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'committed', 'abandoned', 'undone')",
            name="check_orchestrator_session_status",
        ),
        CheckConstraint(
            "workflow_state IN ("
            "'DOCUMENT_ANALYSIS','WORK_ATOMIZATION','DECOMPOSITION',"
            "'CATALOG_BINDING','PRICING','REVIEW','COMMIT_PENDING',"
            "'COMMITTED','EXPORTED')",
            name="check_orchestrator_session_workflow_state",
        ),
    )

    # Relationships deferred (same pattern as the rest of app/db/models/* —
    # back_populates wired once all models register without circular imports).
    # user = relationship("User")
    # project = relationship("Project")

    # NOTE: created_at / updated_at are inherited from Base -> TimestampMixin,
    # which sets `onupdate=datetime.utcnow` on updated_at. All writes in PR1 go
    # through the ORM repository (read -> mutate -> commit), so updated_at is
    # bumped on every state transition. The codebase relies on this ORM-level
    # onupdate uniformly (no DB triggers exist on any table).

    def __repr__(self) -> str:
        return (
            f"<OrchestratorSession(id={self.id}, state='{self.workflow_state}', "
            f"status='{self.status}')>"
        )
