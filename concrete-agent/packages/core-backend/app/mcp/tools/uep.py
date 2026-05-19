"""
MCP tool: `uep_run_extraction` — PR2 §3.5.

Wraps the in-process UEP job runner so Claude Desktop + GPT Actions can
trigger a project run with one call. Returns the `job_id` immediately
so the caller can poll via `/api/v1/projects/{pid}/uep/jobs/{jid}`
(REST) or the `uep_get_job` MCP tool (PR3).

Pricing: 15 credits per call (PR2 estimate — refined in PR3 by
file_count pre-scan).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §14.3
Reference: docs/tasks/TASK_UEP_PR2.md §3.5
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Pricing (per task §14.3). The MCP server billing layer reads this from
# auth.py TOOL_COSTS — kept here as the canonical reference.
UEP_RUN_EXTRACTION_CREDITS = 15


async def uep_run_extraction(
    project_id: str,
    project_dir: str,
    project_type: str = "residential",
    force_rerun: bool = False,
    user_id: Optional[str] = None,
) -> dict:
    """
    Run UEP (Universal Extraction Pipeline) end-to-end on a project.

    Discovers every supported file (DXF / PDF TZ in PR2; DWG / IFC /
    XML adapters in PR3), runs Phase 1 extraction, Phase 2 coverage
    matrix evaluation, Phase 3 reconciliation (when residential rules
    apply), and writes JSON artefacts to disk. The Phase 4 derivation
    registry is consumed separately via the `apply_derivation` tool
    (PR3).

    Args:
        project_id: Stable project identifier (UUID or human-readable).
        project_dir: Absolute path to the project's source files.
        project_type: Coverage matrix to evaluate against. PR2 ships
            `residential`; PR3 adds `bridge`, `road`, `industrial`,
            `mep_only`.
        force_rerun: When true, cancel any in-flight job for the same
            project + start fresh. Otherwise the per-project lock
            returns the existing job_id.
        user_id: User context (PR3 wires real auth). Defaults to
            'mcp-anonymous' so the in-process runner doesn't refuse.

    Returns:
        dict with shape:
            {
                "job_id": "...",
                "state": "queued" | "running",
                "stream_url": "/api/v1/.../stream",
                "estimated_cost_credits": 15
            }

    Cost: 15 credits.
    """

    # Validate inputs early — the runner will fail later but we want a
    # clearer error message for MCP clients.
    if not project_id or not project_id.strip():
        return {"error": "project_id required (non-empty string)"}
    project_path = Path(project_dir).resolve()
    if not project_path.exists():
        return {"error": f"project_dir not found: {project_path}"}
    if not project_path.is_dir():
        return {"error": f"project_dir must be a directory: {project_path}"}

    # Lazy import — avoids circular import with services/uep package
    # at MCP server startup.
    from app.services.uep.concurrency_validator import (
        ValidationFailureReason,
        load_tier_limits_from_yaml,
        make_in_memory_snapshot_fetcher,
        validate_job_start,
    )
    from app.services.uep.job_runner import (
        cancel_job,
        list_active_jobs_for_project,
        list_active_jobs_for_user,
        register_new_job,
        run_job_in_process,
    )

    effective_user = (user_id or "mcp-anonymous").strip() or "mcp-anonymous"
    tier = os.environ.get("UEP_DEFAULT_TIER", "pro")

    # Build the snapshot exactly like the REST handler does. Keeps the
    # behaviour identical so callers see consistent 409/429 responses
    # whether they go through REST or MCP.
    active_user = list_active_jobs_for_user(effective_user)
    project_active = list_active_jobs_for_project(project_id)
    snapshot = make_in_memory_snapshot_fetcher(
        active_jobs={
            effective_user: [(j.project_id, j.state) for j in active_user]
        },
        starts_15min={effective_user: len(active_user)},
        starts_today={effective_user: len(active_user)},
    )(effective_user, project_id, tier)
    if project_active:
        snapshot = snapshot.__class__(
            user_id=snapshot.user_id,
            project_id=snapshot.project_id,
            tier=snapshot.tier,
            active_jobs_count=snapshot.active_jobs_count,
            project_active_job_id=project_active[0].job_id,
            project_active_state=project_active[0].state,
            starts_last_15min=snapshot.starts_last_15min,
            starts_today=snapshot.starts_today,
        )
    failure = validate_job_start(
        snapshot, load_tier_limits_from_yaml(), force_rerun=force_rerun
    )
    if failure is not None:
        if failure.reason == ValidationFailureReason.PROJECT_LOCK:
            existing_state_val = None
            if failure.existing_state is not None:
                existing_state_val = (
                    failure.existing_state.value
                    if hasattr(failure.existing_state, "value")
                    else str(failure.existing_state)
                )
            return {
                "error": "project_locked",
                "message": failure.message,
                "existing_job_id": failure.existing_job_id,
                "existing_state": existing_state_val,
            }
        return {
            "error": failure.reason.value,
            "message": failure.message,
            "tier": tier,
            "retry_after_seconds": failure.retry_after_seconds,
            "limit": failure.limit,
            "current": failure.current,
        }

    if force_rerun and project_active:
        for j in project_active:
            cancel_job(j.job_id)

    info = register_new_job(
        user_id=effective_user,
        project_id=project_id,
        project_type=project_type,
        force_rerun=force_rerun,
        queue_dispatch="in_process",  # MCP path always in-process for PR2
    )

    base_data_dir = Path(os.environ.get("UEP_DATA_DIR", "data/uep"))
    out_dir = base_data_dir / project_id / info.job_id

    # Fire-and-forget — caller polls via the REST surface or a future
    # uep_get_job MCP tool (PR3).
    asyncio.create_task(run_job_in_process(info, project_path, out_dir=out_dir))

    logger.info(
        "[mcp.uep_run_extraction] queued job=%s project=%s user=%s",
        info.job_id, project_id, effective_user,
    )

    # JobInfo.model_config has use_enum_values=True, so .state is the
    # string already; guard for both shapes in case the config flips.
    state_str = info.state.value if hasattr(info.state, "value") else str(info.state)
    return {
        "job_id": info.job_id,
        "state": state_str,
        "project_id": project_id,
        "project_type": project_type,
        "stream_url": (
            f"/api/v1/projects/{project_id}/uep/jobs/{info.job_id}/stream"
        ),
        "estimated_cost_credits": UEP_RUN_EXTRACTION_CREDITS,
    }
