"""uep_ifc_versions_and_diff_reports — PR4b-1 foundation tables.

Two tables backing the IFC version-tracking + diff layer described in
task §15.3.4 (and refined by `TASK_UEP_PR4.md` §3.3):

  - `ifc_versions` — one row per successful IFC upload of the same
    project. `entity_snapshots` is a JSONB column whose shape matches
    `app/models/ifc_diff_schemas.IfcEntitySnapshot[]`. Keeping the
    snapshots inside the version row (rather than a child table) is a
    deliberate choice: diffs are read-once + replaced, never UPDATEd,
    and a model with ~50 000 walls + slabs still fits comfortably
    under the 1 GiB Postgres JSONB ceiling.

  - `ifc_diff_reports` — one row per (old_version, new_version) pair
    actually compared. Flat columns hold add/remove/modify counts +
    severity for indexed querying; `report_payload` JSONB carries the
    full audit trail (per-entity changes + open dict for PR4b-2
    quantity/material/property deltas and PR5 narrative).

A partial unique index on `ifc_diff_reports(old_version_id,
new_version_id)` prevents duplicate diff rows when the engine is
called concurrently for the same pair (idempotent UPSERT path lives
in `ifc_diff_engine.persist_diff_report` — PR4b-2).

CRITICAL: not auto-applied. Apply manually via `alembic upgrade head`
once PR4b-1 lands. Reversible (`downgrade()` drops everything).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.3.4
Reference: docs/tasks/TASK_UEP_PR4.md §3.3

Revision ID: uep_pr4b_ifc_diff
Revises: uep_pr2_jobs
Create Date: 2026-05-20
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "uep_pr4b_ifc_diff"
down_revision: Union[str, None] = "uep_pr2_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =================================================================
    # TABLE 1: ifc_versions
    # =================================================================
    op.create_table(
        "ifc_versions",
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uep_jobs.job_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("file_name", sa.Text(), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("schema_version", sa.String(20), nullable=False),
        sa.Column("streaming_strategy", sa.String(20), nullable=False),
        sa.Column(
            "upload_timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "entity_counts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "entity_snapshots",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.CheckConstraint(
            "schema_version IN ('IFC2X3', 'IFC4', 'IFC4X1', 'IFC4X2', 'IFC4X3')",
            name="check_ifc_versions_schema",
        ),
        sa.CheckConstraint(
            "streaming_strategy IN ('full', 'partial', 'strict', 'reject')",
            name="check_ifc_versions_strategy",
        ),
        sa.CheckConstraint(
            "file_size_bytes >= 0", name="check_ifc_versions_size_nonneg"
        ),
    )
    op.create_index(
        "idx_ifc_versions_project_id", "ifc_versions", ["project_id"]
    )
    op.create_index(
        "idx_ifc_versions_upload_timestamp",
        "ifc_versions",
        ["upload_timestamp"],
    )
    # Per-project most-recent lookup — the diff engine's default is
    # "diff against the previous version of this project", so this is
    # the hot index.
    op.create_index(
        "idx_ifc_versions_project_recent",
        "ifc_versions",
        ["project_id", sa.text("upload_timestamp DESC")],
    )

    # =================================================================
    # TABLE 2: ifc_diff_reports
    # =================================================================
    op.create_table(
        "ifc_diff_reports",
        sa.Column(
            "diff_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "old_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ifc_versions.version_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "new_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ifc_versions.version_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.String(20),
            nullable=False,
            server_default="unscored",
        ),
        sa.Column("total_added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_removed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_modified", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "report_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "diff_engine_version", sa.String(20), nullable=False, server_default="1.0"
        ),
        sa.CheckConstraint(
            "severity IN ('unscored', 'cosmetic', 'minor', 'moderate', 'major', 'scope_change')",
            name="check_ifc_diff_reports_severity",
        ),
        sa.CheckConstraint(
            "old_version_id <> new_version_id",
            name="check_ifc_diff_reports_distinct_versions",
        ),
        sa.CheckConstraint(
            "total_added >= 0 AND total_removed >= 0 AND total_modified >= 0",
            name="check_ifc_diff_reports_counts_nonneg",
        ),
    )
    op.create_index(
        "idx_ifc_diff_reports_project_id", "ifc_diff_reports", ["project_id"]
    )
    op.create_index(
        "idx_ifc_diff_reports_old_version",
        "ifc_diff_reports",
        ["old_version_id"],
    )
    op.create_index(
        "idx_ifc_diff_reports_new_version",
        "ifc_diff_reports",
        ["new_version_id"],
    )
    op.create_index(
        "idx_ifc_diff_reports_severity", "ifc_diff_reports", ["severity"]
    )
    # Uniqueness on the (old, new) pair — same comparison should not
    # produce two rows. Diff engine UPSERTs by this key.
    op.create_index(
        "uq_ifc_diff_reports_pair",
        "ifc_diff_reports",
        ["old_version_id", "new_version_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_ifc_diff_reports_pair", table_name="ifc_diff_reports")
    op.drop_index("idx_ifc_diff_reports_severity", table_name="ifc_diff_reports")
    op.drop_index("idx_ifc_diff_reports_new_version", table_name="ifc_diff_reports")
    op.drop_index("idx_ifc_diff_reports_old_version", table_name="ifc_diff_reports")
    op.drop_index("idx_ifc_diff_reports_project_id", table_name="ifc_diff_reports")
    op.drop_table("ifc_diff_reports")

    op.drop_index("idx_ifc_versions_project_recent", table_name="ifc_versions")
    op.drop_index("idx_ifc_versions_upload_timestamp", table_name="ifc_versions")
    op.drop_index("idx_ifc_versions_project_id", table_name="ifc_versions")
    op.drop_table("ifc_versions")
