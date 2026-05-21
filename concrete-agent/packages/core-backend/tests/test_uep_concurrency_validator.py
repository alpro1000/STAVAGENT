"""
UEP concurrency validator tests — PR2 §3.4.

Pure function over a JobUsageSnapshot — tests run without a DB.
"""

from __future__ import annotations

import pytest

from app.models.uep_job_schemas import JobState, TierLimits
from app.services.uep.concurrency_validator import (
    JobUsageSnapshot,
    ValidationFailureReason,
    load_tier_limits_from_yaml,
    make_in_memory_snapshot_fetcher,
    validate_job_start,
)


def _limits() -> dict[str, TierLimits]:
    return load_tier_limits_from_yaml()


def _snap(**kw):
    return JobUsageSnapshot(
        user_id=kw.pop("user_id", "u1"),
        project_id=kw.pop("project_id", "p1"),
        tier=kw.pop("tier", "pro"),
        active_jobs_count=kw.pop("active_jobs_count", 0),
        project_active_job_id=kw.pop("project_active_job_id", None),
        project_active_state=kw.pop("project_active_state", None),
        starts_last_15min=kw.pop("starts_last_15min", 0),
        starts_today=kw.pop("starts_today", 0),
        **kw,
    )


# ---------------------------------------------------------------------------
# YAML seed
# ---------------------------------------------------------------------------


def test_yaml_seeds_5_tiers() -> None:
    limits = load_tier_limits_from_yaml()
    assert set(limits.keys()) == {"free", "starter", "pro", "business", "enterprise"}
    assert limits["pro"].concurrent_jobs == 5
    assert limits["pro"].burst_15min == 15
    assert limits["business"].daily_jobs == 0  # unlimited
    assert limits["enterprise"].per_project_jobs == 5


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_validate_success_when_under_all_limits() -> None:
    out = validate_job_start(_snap(active_jobs_count=2, starts_last_15min=3), _limits())
    assert out is None


# ---------------------------------------------------------------------------
# Per-project lock
# ---------------------------------------------------------------------------


def test_validate_project_lock_collision_returns_409_shape() -> None:
    out = validate_job_start(
        _snap(
            project_active_job_id="existing-1",
            project_active_state=JobState.RUNNING,
        ),
        _limits(),
    )
    assert out is not None
    assert out.reason == ValidationFailureReason.PROJECT_LOCK
    assert out.existing_job_id == "existing-1"
    assert out.existing_state == JobState.RUNNING


def test_force_rerun_bypasses_project_lock() -> None:
    out = validate_job_start(
        _snap(
            active_jobs_count=1,
            project_active_job_id="existing-1",
            project_active_state=JobState.RUNNING,
        ),
        _limits(),
        force_rerun=True,
    )
    assert out is None


# ---------------------------------------------------------------------------
# Concurrent limit
# ---------------------------------------------------------------------------


def test_concurrent_limit_blocks_at_pro_5_active() -> None:
    out = validate_job_start(_snap(active_jobs_count=5), _limits())
    assert out is not None
    assert out.reason == ValidationFailureReason.CONCURRENT_LIMIT
    assert out.limit == 5
    assert out.current == 5


def test_concurrent_limit_force_rerun_discounts_existing() -> None:
    # Pro user has 5 active jobs incl. an existing one for this project.
    # force_rerun cancels it, so effective active = 4, room for 1 more.
    out = validate_job_start(
        _snap(
            active_jobs_count=5,
            project_active_job_id="existing-1",
            project_active_state=JobState.RUNNING,
        ),
        _limits(),
        force_rerun=True,
    )
    assert out is None


# ---------------------------------------------------------------------------
# Sliding window
# ---------------------------------------------------------------------------


def test_sliding_window_blocks_at_pro_15_starts() -> None:
    out = validate_job_start(_snap(starts_last_15min=15), _limits())
    assert out is not None
    assert out.reason == ValidationFailureReason.SLIDING_WINDOW_LIMIT
    assert out.limit == 15
    assert out.retry_after_seconds == 900


# ---------------------------------------------------------------------------
# Daily limit
# ---------------------------------------------------------------------------


def test_daily_limit_blocks_at_pro_100_starts() -> None:
    out = validate_job_start(_snap(starts_today=100), _limits())
    assert out is not None
    assert out.reason == ValidationFailureReason.DAILY_LIMIT
    assert out.limit == 100
    assert out.retry_after_seconds > 0  # seconds until midnight UTC


def test_business_tier_daily_unlimited() -> None:
    out = validate_job_start(_snap(tier="business", starts_today=9999), _limits())
    # Even at 9999 starts, business has daily_jobs=0 (unlimited).
    assert out is None or out.reason != ValidationFailureReason.DAILY_LIMIT


def test_unknown_tier_falls_back_to_free() -> None:
    # Free = 1 concurrent. With 1 active, the next start hits the limit.
    out = validate_job_start(
        _snap(tier="non_existent_tier_xx", active_jobs_count=1),
        _limits(),
    )
    assert out is not None
    assert out.reason == ValidationFailureReason.CONCURRENT_LIMIT


# ---------------------------------------------------------------------------
# In-memory snapshot fetcher helper
# ---------------------------------------------------------------------------


def test_in_memory_snapshot_fetcher_round_trip() -> None:
    fetch = make_in_memory_snapshot_fetcher(
        active_jobs={"u1": [("p2", JobState.RUNNING)]},
        starts_15min={"u1": 7},
        starts_today={"u1": 42},
    )
    snap = fetch("u1", "p2", "pro")
    assert snap.active_jobs_count == 1
    assert snap.project_active_job_id == "job-u1-p2"
    assert snap.project_active_state == JobState.RUNNING
    assert snap.starts_last_15min == 7
    assert snap.starts_today == 42

    snap_other = fetch("u1", "p_other", "pro")
    assert snap_other.project_active_job_id is None
    assert snap_other.active_jobs_count == 1  # global count, not per-project


# ---------------------------------------------------------------------------
# Pro tier 7-concurrent → exactly 5 allowed scenario (PR2 acceptance §20)
# ---------------------------------------------------------------------------


def test_pro_tier_seven_concurrent_attempts_first_five_succeed() -> None:
    """Per task §4 acceptance #20 — 7 concurrent attempts → 5 succeed."""

    limits = _limits()
    successes = 0
    rejections = 0
    for attempt in range(7):
        # Simulate the snapshot after `successes` jobs have been queued.
        snap = _snap(active_jobs_count=successes)
        result = validate_job_start(snap, limits)
        if result is None:
            successes += 1
        else:
            rejections += 1
            assert result.reason == ValidationFailureReason.CONCURRENT_LIMIT
    assert successes == 5
    assert rejections == 2
