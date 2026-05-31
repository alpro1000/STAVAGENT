"""orchestrator_audit_log — append-only audit trail (PR3b).

Creates the `orchestrator_audit_log` table that records every orchestrator tool
call, state transition, and policy violation as an immutable row, and installs a
DB-level append-only guarantee: a BEFORE UPDATE OR DELETE trigger that RAISEs.

Why a trigger (not a GRANT / RLS rule): the trigger fires regardless of the
connecting role, so it holds for the application credential, for ad-hoc psql, and
for a compromised credential alike — there is no role that can UPDATE or DELETE a
row once written (task §3 / AC13). INSERT is unaffected, so the log keeps
growing; only mutation/removal is forbidden.

Mirrors the PR1 session migration conventions (date-prefixed filename, explicit
revision ids, reversible). Apply via `alembic upgrade head`.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §3, AC13, AC14, AC16.

Revision ID: orch_sg_pr3b_audit
Revises: orch_sg_pr1_sessions
Create Date: 2026-05-30
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "orch_sg_pr3b_audit"
down_revision: Union[str, None] = "orch_sg_pr1_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_EVENT_TYPES = ("tool_call", "state_transition", "policy_violation")

_APPEND_ONLY_FN = "orchestrator_audit_log_append_only"
_APPEND_ONLY_TRIGGER = "trg_orchestrator_audit_log_append_only"


def upgrade() -> None:
    event_type_in = ", ".join(f"'{e}'" for e in _EVENT_TYPES)

    op.create_table(
        "orchestrator_audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("tool_name", sa.String(length=120), nullable=True),
        sa.Column("tool_version", sa.String(length=40), nullable=True),
        sa.Column("inputs_hash", sa.String(length=64), nullable=True),
        sa.Column("outputs_hash", sa.String(length=64), nullable=True),
        sa.Column("policy_hash", sa.String(length=64), nullable=True),
        sa.Column("core_engine_version", sa.String(length=40), nullable=True),
        sa.Column("transition_from", sa.String(length=30), nullable=True),
        sa.Column("transition_to", sa.String(length=30), nullable=True),
        sa.Column("transition_source", sa.String(length=200), nullable=True),
        sa.Column("detail", postgresql.JSONB(), nullable=True),
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
            f"event_type IN ({event_type_in})",
            name="check_orchestrator_audit_log_event_type",
        ),
    )
    op.create_index(
        "ix_orchestrator_audit_log_session_id",
        "orchestrator_audit_log",
        ["session_id"],
    )
    op.create_index(
        "ix_orchestrator_audit_log_user_id",
        "orchestrator_audit_log",
        ["user_id"],
    )
    op.create_index(
        "ix_orchestrator_audit_log_project_id",
        "orchestrator_audit_log",
        ["project_id"],
    )
    op.create_index(
        "ix_orchestrator_audit_log_event_type",
        "orchestrator_audit_log",
        ["event_type"],
    )
    op.create_index(
        "ix_orchestrator_audit_log_created_at",
        "orchestrator_audit_log",
        ["created_at"],
    )

    # ── Append-only enforcement (DB-level, role-independent) ─────────────────
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION {_APPEND_ONLY_FN}()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION
                'orchestrator_audit_log is append-only: % is not permitted',
                TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {_APPEND_ONLY_TRIGGER}
        BEFORE UPDATE OR DELETE ON orchestrator_audit_log
        FOR EACH ROW EXECUTE FUNCTION {_APPEND_ONLY_FN}();
        """
    )


def downgrade() -> None:
    op.execute(
        f"DROP TRIGGER IF EXISTS {_APPEND_ONLY_TRIGGER} "
        f"ON orchestrator_audit_log;"
    )
    op.execute(f"DROP FUNCTION IF EXISTS {_APPEND_ONLY_FN}();")
    op.drop_index(
        "ix_orchestrator_audit_log_created_at", table_name="orchestrator_audit_log"
    )
    op.drop_index(
        "ix_orchestrator_audit_log_event_type", table_name="orchestrator_audit_log"
    )
    op.drop_index(
        "ix_orchestrator_audit_log_project_id", table_name="orchestrator_audit_log"
    )
    op.drop_index(
        "ix_orchestrator_audit_log_user_id", table_name="orchestrator_audit_log"
    )
    op.drop_index(
        "ix_orchestrator_audit_log_session_id", table_name="orchestrator_audit_log"
    )
    op.drop_table("orchestrator_audit_log")
