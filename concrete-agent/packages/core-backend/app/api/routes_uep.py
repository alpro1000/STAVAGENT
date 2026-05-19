"""
UEP REST API surface — PR2 §3.3.

Routes (per task §3.3):

  POST   /api/v1/projects/{pid}/uep/run
  GET    /api/v1/projects/{pid}/uep/jobs/{jid}
  GET    /api/v1/projects/{pid}/uep/jobs/{jid}/stream   (SSE)
  DELETE /api/v1/projects/{pid}/uep/jobs/{jid}
  GET    /api/v1/projects/{pid}/uep/jobs/active
  GET    /api/v1/projects/{pid}/uep/coverage-report
  GET    /api/v1/projects/{pid}/uep/reconciliation-report
  GET    /api/v1/projects/{pid}/uep/derived-quantities
  POST   /api/v1/projects/{pid}/uep/derivation
  GET    /api/v1/projects/{pid}/uep/derivation/applicable-rules
  GET    /api/v1/uep/config/coverage-matrices/{project_type}
  GET    /api/v1/uep/config/derivation-rules
  GET    /api/v1/uep/config/reconciliation-rules
  GET    /api/v1/uep/config/tier-limits

PR2 ships an in-process execution path. Cloud Tasks dispatch is wired
behind a feature flag (`UEP_USE_CLOUD_TASKS`); when not set the routes
fall back to running synchronously inside the request handler.

Authentication / user_id resolution: PR2 reads `X-User-Id` header as a
seam — PR3 wires this to the existing JWT middleware on the Portal
side. The default user_id (`anonymous`) keeps the CLI/test runners
unblocked.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §14.2
Reference: docs/tasks/TASK_UEP_PR2.md §3.3
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.models.derivation_schemas import DerivationInputValue
from app.models.uep_job_schemas import (
    JobConflictResponse,
    JobInfo,
    JobRateLimitedResponse,
    JobStartRequest,
    JobStartResponse,
    JobState,
)
from app.services.uep import (
    list_applicable_derivations,
    list_supported_formats,
    load_registry,
    load_rules,
    rules_path_for,
)
from app.services.uep.concurrency_validator import (
    ValidationFailureReason,
    load_tier_limits_from_yaml,
    make_in_memory_snapshot_fetcher,
    validate_job_start,
)
from app.services.uep.coverage_engine import matrix_path_for
from app.services.uep.derivation_registry import (
    DerivationError,
    UnknownDerivationRule,
    get_global_registry,
)
from app.services.uep.job_runner import (
    cancel_job,
    get_job,
    list_active_jobs_for_project,
    list_active_jobs_for_user,
    register_new_job,
    run_job_in_process,
    _get_event_queue,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["uep"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_user(x_user_id: Optional[str]) -> str:
    """Auth seam — PR2 reads header; PR3 wires JWT middleware."""

    return (x_user_id or "anonymous").strip() or "anonymous"


def _tier_for_user(_user_id: str) -> str:
    """Tier resolution stub — PR3 reads `user_tier_overrides` table."""

    return os.environ.get("UEP_DEFAULT_TIER", "pro")


def _data_dir_for_job(project_id: str, job_id: str) -> Path:
    base = Path(os.environ.get("UEP_DATA_DIR", "data/uep"))
    return base / project_id / job_id


def _use_cloud_tasks() -> bool:
    return os.environ.get("UEP_USE_CLOUD_TASKS", "0").strip() == "1"


# ---------------------------------------------------------------------------
# POST /uep/run
# ---------------------------------------------------------------------------


@router.post("/projects/{project_id}/uep/run")
async def start_uep_run(
    project_id: str,
    body: JobStartRequest,
    request: Request,
    x_user_id: Optional[str] = Header(None),
) -> JSONResponse:
    user_id = _resolve_user(x_user_id)
    tier = _tier_for_user(user_id)
    limits = load_tier_limits_from_yaml()

    # Build a snapshot from the in-process store so PR2 routes
    # exercise the validator end-to-end. PR3 swaps this for the
    # Cloud SQL SERIALIZABLE-transaction fetcher.
    active_user_jobs = list_active_jobs_for_user(user_id)
    project_active = list_active_jobs_for_project(project_id)
    active_dict = {
        user_id: [(j.project_id, j.state) for j in active_user_jobs]
    }
    snapshot_fetch = make_in_memory_snapshot_fetcher(
        active_jobs=active_dict,
        starts_15min={user_id: len(active_user_jobs)},
        starts_today={user_id: len(active_user_jobs)},
    )
    snapshot = snapshot_fetch(user_id, project_id, tier)
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
    failure = validate_job_start(snapshot, limits, force_rerun=body.force_rerun)

    if failure is not None:
        if failure.reason == ValidationFailureReason.PROJECT_LOCK:
            resp = JobConflictResponse(
                existing_job_id=failure.existing_job_id or "",
                existing_state=failure.existing_state or JobState.RUNNING,
                message=failure.message,
            )
            return JSONResponse(status_code=409, content=resp.model_dump(mode="json"))
        resp_rl = JobRateLimitedResponse(
            error=failure.reason.value,
            message=failure.message,
            tier=tier,
            retry_after_seconds=failure.retry_after_seconds,
            limit=failure.limit,
            current=failure.current,
        )
        return JSONResponse(
            status_code=429,
            content=resp_rl.model_dump(mode="json"),
            headers={"Retry-After": str(failure.retry_after_seconds)},
        )

    # Cancel existing project job if force_rerun.
    if body.force_rerun and project_active:
        for j in project_active:
            cancel_job(j.job_id)

    queue_dispatch = "cloud_tasks" if _use_cloud_tasks() else "in_process"
    # Path traversal validation (Amazon Q review on PR #1186, A1).
    # Resolve the caller-supplied project_dir, then verify it sits
    # inside `UEP_ALLOWED_BASE_DIR` (default cwd). Path.resolve()
    # collapses `..` segments, so attackers can't escape by stacking
    # them. We do the check BEFORE register_new_job so an invalid
    # path doesn't leave a stale row in `_JOBS`.
    project_dir_str = body.project_dir or os.environ.get(
        "UEP_DEFAULT_PROJECT_DIR", "."
    )
    project_dir = Path(project_dir_str).resolve()
    base_allowed = Path(
        os.environ.get("UEP_ALLOWED_BASE_DIR", os.getcwd())
    ).resolve()
    try:
        project_dir.relative_to(base_allowed)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid project_dir: path traversal not allowed "
                "(must be inside UEP_ALLOWED_BASE_DIR)"
            ),
        )

    info = register_new_job(
        user_id=user_id,
        project_id=project_id,
        project_type=body.project_type,
        force_rerun=body.force_rerun,
        queue_dispatch=queue_dispatch,
    )

    out_dir = _data_dir_for_job(project_id, info.job_id)

    if queue_dispatch == "in_process":
        # Fire-and-forget — the SSE stream + GET /jobs/{jid} surfaces
        # progress. asyncio.create_task ensures the request handler
        # returns 201 immediately.
        asyncio.create_task(run_job_in_process(info, project_dir, out_dir=out_dir))
    else:
        # Cloud Tasks dispatch path — stubbed in cloud_tasks_dispatcher.
        from app.services.uep.cloud_tasks_dispatcher import dispatch_job
        await dispatch_job(info, project_dir, out_dir=out_dir)

    base_url = str(request.base_url).rstrip("/")
    resp = JobStartResponse(
        job_id=info.job_id,
        state=info.state,
        queue_dispatch=queue_dispatch,
        stream_url=f"{base_url}/api/v1/projects/{project_id}/uep/jobs/{info.job_id}/stream",
        estimated_cost_credits=15,
    )
    return JSONResponse(status_code=201, content=resp.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# GET /uep/jobs/active — MUST come before /uep/jobs/{job_id} so the
# literal `active` path doesn't get captured by the {job_id} matcher.
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/uep/jobs/active")
def list_active_jobs(project_id: str) -> dict:
    jobs = list_active_jobs_for_project(project_id)
    return {"project_id": project_id, "active": [j.model_dump(mode="json") for j in jobs]}


# ---------------------------------------------------------------------------
# GET /uep/jobs/{jid}
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/uep/jobs/{job_id}", response_model=JobInfo)
def get_job_status(project_id: str, job_id: str) -> JobInfo:
    info = get_job(job_id)
    if info is None or info.project_id != project_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return info


# ---------------------------------------------------------------------------
# GET /uep/jobs/{jid}/stream — SSE
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/uep/jobs/{job_id}/stream")
async def stream_job_events(project_id: str, job_id: str):
    info = get_job(job_id)
    if info is None or info.project_id != project_id:
        raise HTTPException(status_code=404, detail="Job not found")

    queue = _get_event_queue(job_id)

    async def _gen():
        # Initial event — current state.
        yield (
            "event: snapshot\n"
            f"data: {info.model_dump_json()}\n\n"
        )
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Keep-alive comment line — SSE convention.
                yield ": keep-alive\n\n"
                continue
            yield (
                "event: progress\n"
                f"data: {event.model_dump_json()}\n\n"
            )
            if event.message == "__terminal__":
                break

    return StreamingResponse(_gen(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# DELETE /uep/jobs/{jid}
# ---------------------------------------------------------------------------


@router.delete("/projects/{project_id}/uep/jobs/{job_id}")
def delete_job(project_id: str, job_id: str) -> dict:
    info = get_job(job_id)
    if info is None or info.project_id != project_id:
        raise HTTPException(status_code=404, detail="Job not found")
    cancel_job(job_id)
    return {"job_id": job_id, "state": JobState.CANCELLED.value}


# ---------------------------------------------------------------------------
# Result endpoints (read artefacts from disk).
# ---------------------------------------------------------------------------


def _latest_completed_job(project_id: str) -> Optional[JobInfo]:
    candidates = [
        j for j in [get_job(jid) for jid in _jobs_for_project(project_id)] if j
    ]
    completed = [j for j in candidates if j.state == JobState.COMPLETED]
    completed.sort(key=lambda j: j.completed_at or j.last_event_at, reverse=True)
    return completed[0] if completed else None


def _jobs_for_project(project_id: str) -> list[str]:
    from app.services.uep.job_runner import _JOBS  # noqa: PLC0415
    return [jid for jid, j in _JOBS.items() if j.project_id == project_id]


def _read_artifact_json(project_id: str, filename: str) -> dict:
    info = _latest_completed_job(project_id)
    if info is None or not info.artifacts_path:
        raise HTTPException(status_code=404, detail="No completed job for project")
    p = Path(info.artifacts_path) / filename
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Artefact {filename} not found")
    return json.loads(p.read_text(encoding="utf-8"))


@router.get("/projects/{project_id}/uep/coverage-report")
def get_coverage_report(project_id: str) -> dict:
    return _read_artifact_json(project_id, "coverage_report.json")


@router.get("/projects/{project_id}/uep/reconciliation-report")
def get_reconciliation_report(project_id: str) -> dict:
    return _read_artifact_json(project_id, "reconciliation_report.json")


@router.get("/projects/{project_id}/uep/derived-quantities")
def get_derived_quantities(project_id: str) -> dict:
    # PR2: no auto-derivation in the runner — empty list unless caller
    # explicitly POSTed derivations. PR3 hooks this to a persistent
    # `derived_quantities` table.
    return {"project_id": project_id, "derived_quantities": []}


# ---------------------------------------------------------------------------
# Derivation endpoints
# ---------------------------------------------------------------------------


@router.post("/projects/{project_id}/uep/derivation")
def post_derivation(project_id: str, payload: dict) -> dict:
    """POST body: { "rule_id": "...", "inputs": [{name,value,unit,confidence,source_ref?}] }"""

    rule_id = payload.get("rule_id")
    if not rule_id:
        raise HTTPException(status_code=400, detail="rule_id required")
    raw_inputs = payload.get("inputs") or []
    inputs = [DerivationInputValue.model_validate(i) for i in raw_inputs]
    try:
        out = get_global_registry().apply(rule_id, inputs)
    except UnknownDerivationRule as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DerivationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return out.model_dump(mode="json")


@router.get("/projects/{project_id}/uep/derivation/applicable-rules")
def get_applicable_derivations(
    project_id: str,
    output_quantity: str,
    inputs: str = "",
) -> dict:
    """`inputs` is a comma-separated list of available input names."""

    available = {n.strip() for n in inputs.split(",") if n.strip()}
    out = list_applicable_derivations(output_quantity, available)
    return {"output_quantity": output_quantity, "applicable": [r.model_dump() for r in out]}


# ---------------------------------------------------------------------------
# Config introspection endpoints
# ---------------------------------------------------------------------------


@router.get("/uep/config/coverage-matrices/{project_type}")
def get_coverage_matrix_config(project_type: str) -> dict:
    p = matrix_path_for(project_type)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"No matrix for {project_type}")
    import yaml  # noqa: PLC0415
    return yaml.safe_load(p.read_text(encoding="utf-8"))


@router.get("/uep/config/derivation-rules")
def get_derivation_rules_config() -> dict:
    reg = load_registry()
    return {
        "rule_ids": reg.list_rule_ids(),
        "count": len(reg),
    }


@router.get("/uep/config/reconciliation-rules")
def get_reconciliation_rules_config(project_type: str = "residential") -> dict:
    p = rules_path_for(project_type)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"No rules for {project_type}")
    rs = load_rules(p, project_type)
    return {
        "project_type": project_type,
        "rules": [{"id": r.id, "description": r.description, "severity": r.severity.value} for r in rs.rules],
    }


@router.get("/uep/config/tier-limits")
def get_tier_limits_config() -> dict:
    limits = load_tier_limits_from_yaml()
    return {"tiers": {k: v.model_dump() for k, v in limits.items()}}


@router.get("/uep/config/supported-formats")
def get_supported_formats() -> dict:
    return {"formats": [f.value for f in list_supported_formats()]}
