"""uep_job_lifecycle — Phase 4 backend infrastructure for UEP PR2.

Creates four tables for the async job pipeline + tier-based concurrency
control (per task §14.5 + §15.2.3):

  - `uep_jobs` — one row per project run, full lifecycle + cost + cached
    summary stats. UUID PK.
  - `tier_limits` — concurrency / daily / sliding limits per tier
    (seeded from B13_tier_limits/tier_limits.yaml at app startup —
    NOT in this migration).
  - `user_tier_overrides` — Enterprise per-user overrides.
  - `sliding_window_starts` — append-only log of job start timestamps;
    last 15 min driven by sliding_window_limit per tier. Cron prunes
    rows older than 24 h.

CRITICAL: this migration is NOT auto-applied by any runner. Apply
manually via `alembic upgrade head` once PR2 lands. The migration is
also reversible (`downgrade()` drops everything).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §14.5, §15.2
Reference: docs/tasks/TASK_UEP_PR2.md §3.4

Revision ID: uep_pr2_jobs
Revises: 868b39220cfa
Create Date: 2026-05-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "uep_pr2_jobs"
down_revision: Union[str, None] = "868b39220cfa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =================================================================
    # TABLE 1: uep_jobs
    # =================================================================
    op.create_table(
        "uep_jobs",
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
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
        sa.Column("state", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("phase", sa.String(30), nullable=True),
        sa.Column("progress_pct", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("project_type", sa.String(20), nullable=False, server_default="residential"),
        sa.Column("force_rerun", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("queue_dispatch", sa.String(20), nullable=False, server_default="cloud_tasks"),
        sa.Column("cost_credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(10, 4), nullable=False, server_default="0.0"),
        sa.Column(
            "queued_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_event_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("artifacts_path", sa.Text(), nullable=True),
        # Cached result summaries
        sa.Column("files_discovered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("files_extracted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("facts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("reconciliation_conflicts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("derived_quantities_count", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "state IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'throttled')",
            name="check_uep_jobs_state",
        ),
        sa.CheckConstraint(
            "progress_pct >= 0 AND progress_pct <= 100",
            name="check_uep_jobs_progress",
        ),
    )
    op.create_index("idx_uep_jobs_user_id", "uep_jobs", ["user_id"])
    op.create_index("idx_uep_jobs_project_id", "uep_jobs", ["project_id"])
    op.create_index("idx_uep_jobs_state", "uep_jobs", ["state"])
    # Per-project lock — only one (queued|running) job per project at a
    # time unless force_rerun was set. Partial unique index enforces
    # this at the DB layer so concurrent POST requests can't race the
    # application-layer check.
    op.create_index(
        "uniq_uep_jobs_active_per_project",
        "uep_jobs",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('queued', 'running')"),
    )

    # =================================================================
    # TABLE 2: tier_limits  — seeded at app startup from YAML
    # =================================================================
    op.create_table(
        "tier_limits",
        sa.Column("tier", sa.String(50), primary_key=True),
        sa.Column("concurrent_jobs", sa.Integer(), nullable=False),
        sa.Column("daily_jobs", sa.Integer(), nullable=False),
        sa.Column("per_project_jobs", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("burst_15min", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.CheckConstraint("concurrent_jobs >= 1", name="check_tier_limits_concurrent"),
        sa.CheckConstraint("burst_15min >= 1", name="check_tier_limits_burst"),
    )

    # =================================================================
    # TABLE 3: user_tier_overrides — Enterprise per-user upgrades
    # =================================================================
    op.create_table(
        "user_tier_overrides",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tier", sa.String(50), nullable=False),
        sa.Column("concurrent_jobs", sa.Integer(), nullable=True),
        sa.Column("daily_jobs", sa.Integer(), nullable=True),
        sa.Column("per_project_jobs", sa.Integer(), nullable=True),
        sa.Column("burst_15min", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # =================================================================
    # TABLE 4: sliding_window_starts — append-only job start log
    # =================================================================
    op.create_table(
        "sliding_window_starts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uep_jobs.job_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_sliding_window_user_time",
        "sliding_window_starts",
        ["user_id", "started_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_sliding_window_user_time", table_name="sliding_window_starts")
    op.drop_table("sliding_window_starts")
    op.drop_table("user_tier_overrides")
    op.drop_table("tier_limits")
    op.drop_index("uniq_uep_jobs_active_per_project", table_name="uep_jobs")
    op.drop_index("idx_uep_jobs_state", table_name="uep_jobs")
    op.drop_index("idx_uep_jobs_project_id", table_name="uep_jobs")
    op.drop_index("idx_uep_jobs_user_id", table_name="uep_jobs")
    op.drop_table("uep_jobs")
