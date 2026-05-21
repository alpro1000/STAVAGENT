"""
UEP job lifecycle schemas — PR2 §3.4.

Pydantic contracts for the async job pipeline:
  queued → running → completed | failed | cancelled
                  ↘ throttled (waiting on concurrent slot)

Three job-store tables backed by Alembic migration
`alembic/versions/2026_05_19_uep_job_lifecycle.py`:

  - `uep_jobs` — lifecycle, phases, progress, cost per project run.
  - `tier_limits` — per-tier concurrency / daily / sliding limits
    (seeded from `B13_tier_limits/tier_limits.yaml`).
  - `user_tier_overrides` — per-user upgrades (Enterprise tier).
  - `sliding_window_starts` — last-15-min job start timestamps for
    rate limiting.

REST surface in `app/api/routes_uep.py`:
  POST   /api/v1/projects/{pid}/uep/run
  GET    /api/v1/projects/{pid}/uep/jobs/{jid}
  GET    /api/v1/projects/{pid}/uep/jobs/{jid}/stream   (SSE)
  DELETE /api/v1/projects/{pid}/uep/jobs/{jid}
  GET    /api/v1/projects/{pid}/uep/jobs/active

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §14.5, §15.2
Reference: docs/tasks/TASK_UEP_PR2.md §3.4
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class JobState(str, Enum):
    """Job lifecycle states.

    `throttled` is a queue-mode state that only appears when the user
    is over their concurrent limit but the request hasn't been outright
    rejected (PR2 default is hard rejection with 429 — `throttled` is
    reserved for an opt-in queue mode landing in PR3).
    """

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    THROTTLED = "throttled"


class JobPhase(str, Enum):
    """Coarse-grained phases inside a running job.

    Used for progress reporting via SSE and `/jobs/{jid}` polling.
    """

    DISCOVERY = "discovery"
    EXTRACTION = "extraction"
    COVERAGE = "coverage"
    RECONCILIATION = "reconciliation"
    DERIVATION = "derivation"
    WRITE_ARTIFACTS = "write_artifacts"


class JobInfo(BaseModel):
    """Job row contract — mirror of the `uep_jobs` table.

    UUIDs serialised as strings on the wire so the REST + MCP layer
    stays JSON-friendly without a custom encoder.
    """

    model_config = ConfigDict(use_enum_values=True)

    job_id: str
    user_id: str
    project_id: str
    state: JobState = JobState.QUEUED
    phase: Optional[JobPhase] = None
    progress_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    project_type: str = "residential"
    force_rerun: bool = False
    queue_dispatch: str = Field(
        default="cloud_tasks",
        description=(
            "Job dispatcher: 'cloud_tasks' (production, per task §14.5) "
            "or 'in_process' (PR2 fallback when Cloud Tasks not configured)."
        ),
    )
    cost_credits: int = 0
    cost_usd: float = 0.0

    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_event_at: Optional[datetime] = None

    error_message: Optional[str] = None
    artifacts_path: Optional[str] = Field(
        default=None,
        description="GCS path or local DATA_DIR path to the output bundle.",
    )

    # Result summaries — populated as phases finish.
    files_discovered: int = 0
    files_extracted: int = 0
    facts_count: int = 0
    coverage_pct: Optional[float] = None
    reconciliation_conflicts: int = 0
    derived_quantities_count: int = 0


class JobEvent(BaseModel):
    """One SSE frame emitted while a job runs."""

    job_id: str
    state: JobState
    phase: Optional[JobPhase] = None
    progress_pct: float = 0.0
    message: str = ""
    timestamp: datetime
    payload: Optional[dict[str, Any]] = None


class TierLimits(BaseModel):
    """Per-tier concurrency / daily / sliding limits.

    Seeded from `app/knowledge_base/B13_tier_limits/tier_limits.yaml`
    at startup; the `tier_limits` table is the runtime source of truth.
    """

    tier: str
    concurrent_jobs: int = Field(ge=1)
    daily_jobs: int = Field(
        description=(
            "Daily quota. 0 means unlimited (only Enterprise / Business)."
        )
    )
    per_project_jobs: int = Field(
        default=1,
        description="Max active jobs per project (always 1 unless force_rerun=true).",
    )
    burst_15min: int = Field(
        ge=1,
        description="Max job starts in a sliding 15-minute window.",
    )


class JobStartRequest(BaseModel):
    """Body for POST /api/v1/projects/{pid}/uep/run."""

    project_type: str = "residential"
    force_rerun: bool = False
    project_dir: Optional[str] = Field(
        default=None,
        description=(
            "Absolute path to the project's source files. In production "
            "this is derived server-side from the project_id; this field "
            "lets the CLI tools and tests inject a path directly."
        ),
    )


class JobStartResponse(BaseModel):
    """Response for POST /api/v1/projects/{pid}/uep/run.

    Status code per v3 §14.5:
      - 201 Created     → job successfully queued, body returns this shape.
      - 409 Conflict    → per-project lock collision; body has existing_job_id.
      - 429 Too Many    → tier limit hit; body has retry_after_seconds + reason.
    """

    job_id: str
    state: JobState
    queue_dispatch: str
    stream_url: str = Field(
        description="SSE stream URL (relative to backend base)."
    )
    estimated_cost_credits: int = 0


class JobConflictResponse(BaseModel):
    """Body returned with HTTP 409 when per-project lock blocks the run."""

    error: str = "project_locked"
    message: str = "Project already has an active job"
    existing_job_id: str
    existing_state: JobState


class JobRateLimitedResponse(BaseModel):
    """Body returned with HTTP 429 when tier limits block the run."""

    error: str  # 'concurrent_limit' | 'daily_limit' | 'sliding_window_limit'
    message: str
    tier: str
    retry_after_seconds: int = 0
    limit: int
    current: int
