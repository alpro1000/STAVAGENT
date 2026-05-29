"""orchestrator_sessions — stage-gating session model (PR1 foundation).

Creates the `orchestrator_sessions` table that persists per-session workflow
state across HITL pauses/resumes for the orchestrator stage-gating layer.

  - UUID PK (gen_random_uuid()), created_at/updated_at (matches Base mixins).
  - user_id + project_id UUID FKs for tenant isolation (CASCADE on delete).
  - workflow_state (9-state CHECK) + status (4-value CHECK).
  - expires_at TTL (default 7 days applied by the app layer, not server_default).
  - Six JSONB accumulators (partials / aggregates / drafts / decisions /
    conversation_log / tool_calls_log) for later replay.

This migration is NOT auto-applied by any runner. Apply via `alembic upgrade
head` once PR1 lands. Reversible (`downgrade()` drops the table).

Audit-log append-only constraint, policy enforcement, and replay verification
are NOT in this migration — they are PR2/PR3.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §4

Revision ID: orch_sg_pr1_sessions
Revises: uep_pr4b_ifc_diff
Create Date: 2026-05-29
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "orch_sg_pr1_sessions"
down_revision: Union[str, None] = "uep_pr4b_ifc_diff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_WORKFLOW_STATES = (
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


def upgrade() -> None:
    workflow_state_in = ", ".join(f"'{s}'" for s in _WORKFLOW_STATES)

    op.create_table(
        "orchestrator_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workflow_state",
            sa.String(length=30),
            server_default="DOCUMENT_ANALYSIS",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="active",
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "partials", postgresql.JSONB(), server_default="{}", nullable=False
        ),
        sa.Column(
            "aggregates", postgresql.JSONB(), server_default="{}", nullable=False
        ),
        sa.Column(
            "drafts", postgresql.JSONB(), server_default="{}", nullable=False
        ),
        sa.Column(
            "decisions", postgresql.JSONB(), server_default="[]", nullable=False
        ),
        sa.Column(
            "conversation_log",
            postgresql.JSONB(),
            server_default="[]",
            nullable=False,
        ),
        sa.Column(
            "tool_calls_log",
            postgresql.JSONB(),
            server_default="[]",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('active', 'committed', 'abandoned', 'undone')",
            name="check_orchestrator_session_status",
        ),
        sa.CheckConstraint(
            f"workflow_state IN ({workflow_state_in})",
            name="check_orchestrator_session_workflow_state",
        ),
    )
    op.create_index(
        "ix_orchestrator_sessions_user_id", "orchestrator_sessions", ["user_id"]
    )
    op.create_index(
        "ix_orchestrator_sessions_project_id",
        "orchestrator_sessions",
        ["project_id"],
    )
    op.create_index(
        "ix_orchestrator_sessions_workflow_state",
        "orchestrator_sessions",
        ["workflow_state"],
    )
    op.create_index(
        "ix_orchestrator_sessions_status", "orchestrator_sessions", ["status"]
    )
    op.create_index(
        "ix_orchestrator_sessions_expires_at",
        "orchestrator_sessions",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_orchestrator_sessions_expires_at", table_name="orchestrator_sessions"
    )
    op.drop_index(
        "ix_orchestrator_sessions_status", table_name="orchestrator_sessions"
    )
    op.drop_index(
        "ix_orchestrator_sessions_workflow_state",
        table_name="orchestrator_sessions",
    )
    op.drop_index(
        "ix_orchestrator_sessions_project_id", table_name="orchestrator_sessions"
    )
    op.drop_index(
        "ix_orchestrator_sessions_user_id", table_name="orchestrator_sessions"
    )
    op.drop_table("orchestrator_sessions")
