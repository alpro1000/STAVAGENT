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
UEP_GET_JOB_CREDITS = 0           # PR3 — read-only polling, free
UEP_LIST_FORMATS_CREDITS = 0      # PR3 — registry inspection, free
UEP_GET_COVERAGE_MATRIX_CREDITS = 0   # PR3 — config inspection, free
UEP_GET_RECONCILIATION_RULES_CREDITS = 0  # PR3 — config inspection, free
UEP_DWG_STATUS_CREDITS = 0        # PR3 — env probe, free


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


# ═══════════════════════════════════════════════════════════════════════════
# PR3 — read-only inspection tools.
#
# All free (0 credits): the cost gate exists to protect against batch
# extraction runs, not config lookups. Auth still applies — the FastMCP
# wrapper short-circuits unauthenticated requests at the transport layer.
# ═══════════════════════════════════════════════════════════════════════════


async def uep_get_job(job_id: str) -> dict:
    """
    Read current state of a UEP extraction job.

    Wraps `app.services.uep.job_runner.get_job_info` so MCP clients can
    poll without going through REST. Returns:

        {
            "job_id": "...",
            "project_id": "...",
            "project_type": "...",
            "state": "queued|running|succeeded|failed|cancelled",
            "progress_pct": 0..100,
            "phase": "extract|coverage|reconcile|derive|...",
            "started_at": ISO-8601 or null,
            "finished_at": ISO-8601 or null,
            "error": null or string,
        }

    Returns `{"error": "not_found", "job_id": "..."}` when the job_id is
    unknown.

    Cost: 0 credits.
    """

    if not job_id or not job_id.strip():
        return {"error": "job_id required (non-empty string)"}

    from app.services.uep.job_runner import get_job  # noqa: PLC0415

    info = get_job(job_id)
    if info is None:
        return {"error": "not_found", "job_id": job_id}

    state = info.state.value if hasattr(info.state, "value") else str(info.state)
    phase = info.phase.value if (info.phase and hasattr(info.phase, "value")) else info.phase

    def _iso(ts):
        return ts.isoformat() if ts is not None else None

    return {
        "job_id": info.job_id,
        "project_id": info.project_id,
        "project_type": info.project_type,
        "state": state,
        "phase": phase,
        "progress_pct": info.progress_pct,
        "queued_at": _iso(info.queued_at),
        "started_at": _iso(info.started_at),
        "completed_at": _iso(info.completed_at),
        "last_event_at": _iso(info.last_event_at),
        "files_discovered": info.files_discovered,
        "files_extracted": info.files_extracted,
        "error_message": info.error_message,
        "artifacts_path": info.artifacts_path,
    }


async def uep_list_supported_formats() -> dict:
    """
    Return the list of source formats with extractors wired in the current
    deployment.

    PR1 ships DXF + PDF_TZ. PR3 adds DWG (via dwg_converter) + IFC
    (via ifcopenshell when installed) + XML_UNIXML + XML_LANDXML.
    XML_GBXML is PR4.

    Output shape:

        {
            "formats": ["dxf", "pdf_tz", "dwg", "ifc", "xml_unixml", "xml_landxml"],
            "count": 6,
        }

    Cost: 0 credits.
    """

    from app.services.uep.registry import list_supported_formats  # noqa: PLC0415

    fmts = list_supported_formats()
    return {
        "formats": [f.value for f in fmts],
        "count": len(fmts),
    }


async def uep_get_coverage_matrix(project_type: str) -> dict:
    """
    Return the active coverage matrix for `project_type`.

    Supported types in PR3: residential / bridge / road / industrial.
    Unknown types return `{"error": "invalid_project_type", ...}`.

    The returned dict matches the YAML schema on disk:

        {
            "version": 1,
            "project_type": "...",
            "description": "...",
            "requirements": [{category, label_cs, required_fields, ...}],
        }

    Cost: 0 credits.
    """

    allowed = {"residential", "bridge", "road", "industrial"}
    if project_type not in allowed:
        return {
            "error": "invalid_project_type",
            "allowed": sorted(allowed),
            "received": project_type,
        }

    import yaml  # noqa: PLC0415
    from app.services.uep.coverage_engine import matrix_path_for  # noqa: PLC0415

    path = matrix_path_for(project_type)
    if not path.exists():
        return {
            "error": "matrix_not_found",
            "project_type": project_type,
            "expected_path": str(path),
        }
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        return {"error": "matrix_load_failed", "message": str(exc)}


async def uep_get_reconciliation_rules(project_type: str) -> dict:
    """
    Return the reconciliation rule set for `project_type` as a compact
    summary (id + description + severity + tolerance) — full YAML is
    available via REST `/api/v1/uep/config/reconciliation-rules`.

    Cost: 0 credits.
    """

    allowed = {"residential", "bridge", "road", "industrial"}
    if project_type not in allowed:
        return {
            "error": "invalid_project_type",
            "allowed": sorted(allowed),
            "received": project_type,
        }

    from app.services.uep.reconciliation_engine import (  # noqa: PLC0415
        load_rules,
        rules_path_for,
    )

    path = rules_path_for(project_type)
    if not path.exists():
        return {
            "error": "rules_not_found",
            "project_type": project_type,
            "expected_path": str(path),
        }
    try:
        rs = load_rules(path, project_type)
    except (ValueError, RuntimeError) as exc:
        return {"error": "rules_load_failed", "message": str(exc)}

    return {
        "project_type": project_type,
        "version": rs.version,
        "description": rs.description,
        "count": len(rs.rules),
        "rules": [
            {
                "id": r.id,
                "description": r.description,
                "severity": r.severity.value,
                "left_source": r.left_source,
                "right_source": r.right_source,
                "tolerance_type": r.tolerance.type.value,
                "tolerance_value": getattr(r.tolerance, "value", None),
            }
            for r in rs.rules
        ],
    }


async def uep_get_dwg_conversion_status() -> dict:
    """
    Probe the runtime environment for DWG → DXF conversion binaries.

    Returns a structured availability report so operators / Claude
    Desktop can verify the fallback chain is healthy before a batch
    run:

        {
            "oda_available": bool,
            "oda_binary": "/path/or/null",
            "libredwg_available": bool,
            "libredwg_binary": "/path/or/null",
            "any_available": bool,
            "advisory": "..." (one-line operator hint)
        }

    Cost: 0 credits.
    """

    import shutil  # noqa: PLC0415

    oda_env = os.environ.get("UEP_DWG_ODA_BINARY", "ODAFileConverter")
    libredwg_env = os.environ.get("UEP_DWG_LIBREDWG_BINARY", "dwg2dxf")

    oda_path = shutil.which(oda_env)
    libredwg_path = shutil.which(libredwg_env)

    any_available = oda_path is not None or libredwg_path is not None
    if oda_path and libredwg_path:
        advisory = (
            "Both ODA + LibreDWG available — full fallback chain active "
            "(ODA tried first, confidence 0.95; LibreDWG fallback, 0.80)."
        )
    elif oda_path:
        advisory = (
            "ODA only — LibreDWG fallback missing. Conversion will run but "
            "DWGs that fail ODA will escalate instead of falling through."
        )
    elif libredwg_path:
        advisory = (
            "LibreDWG only — ODA missing. All conversions will use the "
            "open-source path with confidence floor 0.80."
        )
    else:
        advisory = (
            "No DWG converter on PATH. All .dwg uploads will fail with "
            "DWG_CONVERSION_FAILED until ODAFileConverter or libredwg-tools "
            "is installed (see Dockerfile + PR3 §3.1 deployment notes)."
        )

    return {
        "oda_available": oda_path is not None,
        "oda_binary": oda_path,
        "libredwg_available": libredwg_path is not None,
        "libredwg_binary": libredwg_path,
        "any_available": any_available,
        "advisory": advisory,
    }
