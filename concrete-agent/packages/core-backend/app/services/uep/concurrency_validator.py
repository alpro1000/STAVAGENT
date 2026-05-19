"""
UEP concurrency + rate-limit validator — PR2 §3.4 + §15.2.3.

Pre-run validation that runs inside a SERIALIZABLE transaction:

  1. Per-project lock check         → 409 Conflict if collision
  2. Concurrent jobs limit          → 429 with reason='concurrent_limit'
  3. Sliding 15-min window check    → 429 with reason='sliding_window_limit'
  4. Daily limit check              → 429 with reason='daily_limit'

`force_rerun=true` cancels the existing project job + bypasses the
per-project lock; tier checks 2-4 still apply.

The validator is database-agnostic at the contract level — it takes
an `AsyncSession` and a `tier_lookup` callable so unit tests can run
against an in-memory dict. PR3 ships the Cloud SQL adapter that wires
the actual SERIALIZABLE transaction.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.2.3
Reference: docs/tasks/TASK_UEP_PR2.md §3.4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Callable, Optional

import yaml

from app.models.uep_job_schemas import JobState, TierLimits

logger = logging.getLogger(__name__)


class ValidationFailureReason(str, Enum):
    """Why the pre-run validation rejected a job start."""

    PROJECT_LOCK = "project_lock"
    CONCURRENT_LIMIT = "concurrent_limit"
    SLIDING_WINDOW_LIMIT = "sliding_window_limit"
    DAILY_LIMIT = "daily_limit"


@dataclass(frozen=True)
class ValidationFailure:
    """Structured rejection reason — caller maps to HTTP status."""

    reason: ValidationFailureReason
    message: str
    limit: int = 0
    current: int = 0
    retry_after_seconds: int = 0
    existing_job_id: Optional[str] = None
    existing_state: Optional[JobState] = None


@dataclass(frozen=True)
class JobUsageSnapshot:
    """Cheaper-than-SQL snapshot of a user's current usage state."""

    user_id: str
    project_id: str
    tier: str
    active_jobs_count: int                # state IN (queued, running)
    project_active_job_id: Optional[str]  # active job for THIS project, if any
    project_active_state: Optional[JobState]
    starts_last_15min: int
    starts_today: int


# ---------------------------------------------------------------------------
# YAML seed
# ---------------------------------------------------------------------------


def _yaml_path() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "knowledge_base"
        / "B13_tier_limits"
        / "tier_limits.yaml"
    )


def load_tier_limits_from_yaml(path: Optional[Path] = None) -> dict[str, TierLimits]:
    """Load the bundled tier limits YAML → {tier: TierLimits}.

    The runtime source of truth is the `tier_limits` DB table; this
    function is the seed used by `seed_tier_limits()` (PR3) and by
    unit tests that don't have a DB.
    """

    p = path or _yaml_path()
    # YAML I/O wrap (Amazon Q PR #1186 C3) — malformed file →
    # RuntimeError with path context, not raw YAMLError → 500.
    # Same pattern applied to coverage_engine.load_matrix,
    # reconciliation_engine.load_rules, derivation_registry.load_registry.
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise RuntimeError(
            f"Failed to load tier limits from {p}: {exc}"
        ) from exc
    out: dict[str, TierLimits] = {}
    for entry in raw.get("tiers", []):
        tier = TierLimits.model_validate(entry)
        out[tier.tier] = tier
    return out


# ---------------------------------------------------------------------------
# Pure validation function.
# ---------------------------------------------------------------------------


def validate_job_start(
    snapshot: JobUsageSnapshot,
    tier_limits: dict[str, TierLimits],
    *,
    force_rerun: bool = False,
) -> Optional[ValidationFailure]:
    """Pure-function pre-flight check. Returns None on success, else a
    ValidationFailure with the reason + payload for the 4xx response.

    Order matters — checks fire top-down so the most-actionable
    rejection wins (project lock > concurrent > sliding > daily).
    """

    limits = tier_limits.get(snapshot.tier)
    if limits is None:
        # Unknown tier → fall back to free.
        limits = tier_limits.get("free")
    if limits is None:
        raise RuntimeError(
            f"validate_job_start: no tier_limits entry for tier={snapshot.tier!r} "
            "and no 'free' fallback configured"
        )

    # 1. Per-project lock
    if snapshot.project_active_job_id and not force_rerun:
        return ValidationFailure(
            reason=ValidationFailureReason.PROJECT_LOCK,
            message=(
                f"Project {snapshot.project_id} has an active job "
                f"(state={snapshot.project_active_state}). Pass "
                f"force_rerun=true to cancel + restart."
            ),
            existing_job_id=snapshot.project_active_job_id,
            existing_state=snapshot.project_active_state,
        )

    # 2. Concurrent jobs limit
    # Don't count the project's existing active job when force_rerun is
    # set — it will be cancelled before the new one starts.
    effective_active = snapshot.active_jobs_count - (
        1 if (force_rerun and snapshot.project_active_job_id) else 0
    )
    if effective_active >= limits.concurrent_jobs:
        return ValidationFailure(
            reason=ValidationFailureReason.CONCURRENT_LIMIT,
            message=(
                f"Concurrent job limit reached ({effective_active}/"
                f"{limits.concurrent_jobs} for tier {snapshot.tier})."
            ),
            limit=limits.concurrent_jobs,
            current=effective_active,
            retry_after_seconds=60,
        )

    # 3. Sliding 15-min window
    if snapshot.starts_last_15min >= limits.burst_15min:
        return ValidationFailure(
            reason=ValidationFailureReason.SLIDING_WINDOW_LIMIT,
            message=(
                f"Burst limit reached ({snapshot.starts_last_15min}/"
                f"{limits.burst_15min} in the last 15 min for tier "
                f"{snapshot.tier})."
            ),
            limit=limits.burst_15min,
            current=snapshot.starts_last_15min,
            retry_after_seconds=900,
        )

    # 4. Daily limit
    if limits.daily_jobs > 0 and snapshot.starts_today >= limits.daily_jobs:
        # Seconds until midnight UTC (when the daily counter rolls).
        now = datetime.now(timezone.utc)
        tomorrow = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        retry_after = int((tomorrow - now).total_seconds())
        return ValidationFailure(
            reason=ValidationFailureReason.DAILY_LIMIT,
            message=(
                f"Daily limit reached ({snapshot.starts_today}/"
                f"{limits.daily_jobs} for tier {snapshot.tier})."
            ),
            limit=limits.daily_jobs,
            current=snapshot.starts_today,
            retry_after_seconds=retry_after,
        )

    return None


# ---------------------------------------------------------------------------
# DB-bound helpers (PR3 wires the real Cloud SQL session).
# ---------------------------------------------------------------------------


SnapshotFetcher = Callable[[str, str, str], JobUsageSnapshot]
"""Callable signature: (user_id, project_id, tier) → JobUsageSnapshot.

PR3 implements the Cloud SQL version that runs inside a SERIALIZABLE
transaction. Unit tests inject an in-memory closure.
"""


def make_in_memory_snapshot_fetcher(
    *,
    active_jobs: dict[str, list[tuple[str, JobState]]],   # user_id → [(project_id, state)]
    starts_15min: dict[str, int],
    starts_today: dict[str, int],
) -> SnapshotFetcher:
    """Test helper — returns a SnapshotFetcher backed by plain dicts."""

    def _fetch(user_id: str, project_id: str, tier: str) -> JobUsageSnapshot:
        user_active = active_jobs.get(user_id, [])
        project_active = next(
            ((pid, st) for pid, st in user_active if pid == project_id),
            None,
        )
        return JobUsageSnapshot(
            user_id=user_id,
            project_id=project_id,
            tier=tier,
            active_jobs_count=len(user_active),
            project_active_job_id=(
                f"job-{user_id}-{project_id}" if project_active else None
            ),
            project_active_state=(project_active[1] if project_active else None),
            starts_last_15min=starts_15min.get(user_id, 0),
            starts_today=starts_today.get(user_id, 0),
        )

    return _fetch
