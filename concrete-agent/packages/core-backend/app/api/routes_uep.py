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
from collections import deque
from datetime import datetime, timedelta, timezone
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
# Concurrency: TOCTOU guard for the validate-snapshot → register block.
# (Amazon Q PR #1186 comment C1, discussion_r3266899089.)
#
# Single asyncio.Lock serialises validation + JobInfo registration on
# this Cloud Run instance. Without it, two concurrent POST requests
# could both see `active_jobs_count < limit`, both pass validation,
# and both register a job — bypassing the concurrent limit. PR3 ships
# the multi-instance fix via Cloud SQL SERIALIZABLE transaction in
# the SnapshotFetcher (per task §15.2.3); this lock holds the
# invariant on a single-instance deployment until then.
# ---------------------------------------------------------------------------

_JOB_REGISTER_LOCK = asyncio.Lock()


# ---------------------------------------------------------------------------
# Job start timestamp tracking for sliding-window + daily rate limits.
# (Amazon Q PR #1186 comment C2, discussion_r3266899095.)
#
# Each successful register_new_job() pushes the timestamp into the
# per-user deque. The sliding window check walks the deque, popping
# entries older than 15 min, then reports `len(deque)` as the burst
# count. Daily count is the number of pushes since the last UTC
# midnight; reset is implicit by trimming entries older than 24 h.
#
# Pre-fix shape used `len(active_jobs)` which only counted IN-FLIGHT
# jobs — a user could complete-and-restart fast jobs to bypass the
# burst limit because completed jobs vanished from the count.
#
# Transitional in-process storage: PR3 replaces this with the
# `sliding_window_starts` Cloud SQL table seeded by the Alembic
# migration in commit 2febc4b0.
# ---------------------------------------------------------------------------

_STARTS_BY_USER: dict[str, deque[datetime]] = {}

_SLIDING_WINDOW = timedelta(minutes=15)
_DAILY_WINDOW = timedelta(hours=24)


def _prune_user_starts(user_id: str, now: datetime) -> deque[datetime]:
    """Drop timestamps older than 24 h. Returns the live deque."""

    dq = _STARTS_BY_USER.setdefault(user_id, deque())
    cutoff_24h = now - _DAILY_WINDOW
    while dq and dq[0] < cutoff_24h:
        dq.popleft()
    return dq


def _count_starts(user_id: str, now: datetime) -> tuple[int, int]:
    """Return `(starts_last_15min, starts_today)` from the deque.

    `starts_today` is the count of starts whose timestamp's UTC date
    matches `now.date()` — exact "today" semantics, not a rolling 24 h
    window. The deque is pruned to a 24 h horizon so this scan stays
    bounded.
    """

    dq = _prune_user_starts(user_id, now)
    cutoff_15m = now - _SLIDING_WINDOW
    today = now.date()
    in_15m = 0
    in_today = 0
    for ts in dq:
        if ts >= cutoff_15m:
            in_15m += 1
        if ts.date() == today:
            in_today += 1
    return in_15m, in_today


def _record_job_start(user_id: str) -> None:
    """Append `now` to the user's start log. Called inside the
    TOCTOU lock immediately after register_new_job() succeeds."""

    now = datetime.now(timezone.utc)
    dq = _prune_user_starts(user_id, now)
    dq.append(now)


def _reset_starts_for_testing() -> None:
    """Test-only: wipe the in-memory start log. Production never
    calls this (PR3 backs the data by the Cloud SQL
    `sliding_window_starts` table)."""

    _STARTS_BY_USER.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


# Header format guard for the PR2 X-User-Id dev seam (Amazon Q PR #1186
# comment B1, discussion_r3266899102). Allowed shape: UUID OR alphanumeric
# (with `-` and `_`), length 1..64. Rejects injection vectors:
# `../`, `<script>`, oversized payloads, control chars. The seam is
# explicitly NOT secure auth — PR3 wires the real JWT middleware
# that already runs on the Portal side. This guard's job is to keep
# the header from being a vehicle for path / log / template injection
# while the seam is in place.
import re as _re  # noqa: E402

_USER_ID_PATTERN = _re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def _resolve_user(x_user_id: Optional[str]) -> str:
    """Auth seam — PR2 reads header with format validation; PR3 wires
    JWT middleware that replaces this entirely.

    PR2 contract:
      - missing / empty header → `anonymous` (lets local CLI + tests run)
      - present but malformed (oversize, control chars, `../`, `<`, etc.)
        → HTTP 400 so injection attempts don't reach downstream paths
      - valid format → echoed as the user_id

    SECURITY NOTE: this does not authenticate the caller. The caller
    can still pick any well-formed identifier they want. The full
    JWT-based auth lands in PR3 (`Portal JWT validation` middleware,
    `user_tier_overrides` table lookup, etc.). This guard exists to
    prevent the header value being a vehicle for injection attacks
    while the seam is the contract.
    """

    if x_user_id is None:
        return "anonymous"
    candidate = x_user_id.strip()
    if not candidate:
        return "anonymous"
    if not _USER_ID_PATTERN.match(candidate):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid X-User-Id header — must be 1..64 chars of "
                "[A-Za-z0-9_-] (PR2 dev seam; PR3 wires JWT middleware)"
            ),
        )
    return candidate


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

    # Path traversal validation (Amazon Q A1) — runs BEFORE the
    # register lock so an invalid path is cheap to reject and doesn't
    # hold up concurrent honest requests.
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

    # ── TOCTOU guard (Amazon Q C1) ────────────────────────────────
    # The snapshot read, validation, AND JobInfo registration must
    # run atomically so two concurrent requests can't both pass the
    # concurrent-jobs check on the same slot. Single-instance only;
    # multi-instance is PR3 via SERIALIZABLE transaction.
    async with _JOB_REGISTER_LOCK:
        # Build a snapshot from the in-process store so PR2 routes
        # exercise the validator end-to-end. PR3 swaps this for the
        # Cloud SQL SERIALIZABLE-transaction fetcher.
        active_user_jobs = list_active_jobs_for_user(user_id)
        project_active = list_active_jobs_for_project(project_id)
        active_dict = {
            user_id: [(j.project_id, j.state) for j in active_user_jobs]
        }
        # Amazon Q C2 — read REAL start timestamps for the sliding
        # window + daily limit, not `len(active_user_jobs)` (which
        # only counted IN-FLIGHT jobs and let a user bypass the
        # burst limit by completing jobs fast).
        now = datetime.now(timezone.utc)
        s15, sday = _count_starts(user_id, now)
        snapshot_fetch = make_in_memory_snapshot_fetcher(
            active_jobs=active_dict,
            starts_15min={user_id: s15},
            starts_today={user_id: sday},
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
        failure = validate_job_start(
            snapshot, limits, force_rerun=body.force_rerun
        )

        if failure is not None:
            if failure.reason == ValidationFailureReason.PROJECT_LOCK:
                resp = JobConflictResponse(
                    existing_job_id=failure.existing_job_id or "",
                    existing_state=failure.existing_state or JobState.RUNNING,
                    message=failure.message,
                )
                return JSONResponse(
                    status_code=409, content=resp.model_dump(mode="json")
                )
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

        # Cancel existing project job if force_rerun (must also be
        # inside the lock — otherwise a parallel request could see
        # the about-to-be-cancelled job as still active).
        if body.force_rerun and project_active:
            for j in project_active:
                cancel_job(j.job_id)

        queue_dispatch = "cloud_tasks" if _use_cloud_tasks() else "in_process"

        info = register_new_job(
            user_id=user_id,
            project_id=project_id,
            project_type=body.project_type,
            force_rerun=body.force_rerun,
            queue_dispatch=queue_dispatch,
        )
        # Record the start AFTER successful registration so a rejected
        # request (409 / 429) doesn't pollute the deque (Amazon Q C2).
        _record_job_start(user_id)

    # ── End of TOCTOU lock ────────────────────────────────────────
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
    # Path traversal guards (Amazon Q PR #1186 comment A2).
    # The route handlers below currently pass literal filenames
    # ("coverage_report.json" / "reconciliation_report.json"), so the
    # check is defence-in-depth — a future caller that lets filename
    # come from a URL segment must not be able to escape the
    # artefacts directory via `..` or absolute paths.
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    info = _latest_completed_job(project_id)
    if info is None or not info.artifacts_path:
        raise HTTPException(status_code=404, detail="No completed job for project")

    artifacts_dir = Path(info.artifacts_path).resolve()
    artifact_file = (artifacts_dir / filename).resolve()
    try:
        artifact_file.relative_to(artifacts_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not artifact_file.exists():
        raise HTTPException(status_code=404, detail=f"Artefact {filename} not found")
    return json.loads(artifact_file.read_text(encoding="utf-8"))


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


# Allow-list of project_type values accepted by the config endpoints.
# Closes Amazon Q PR #1186 comments A3 + A4 (discussion_r3266899109 +
# discussion_r3266899130) — without this list, the raw `project_type`
# string flowed into the file path via matrix_path_for() and a caller
# could request `../../secrets` to read arbitrary YAML.
_ALLOWED_PROJECT_TYPES: set[str] = {
    "residential",
    "bridge",
    "road",
    "industrial",
}


def _ensure_project_type(project_type: str) -> None:
    if project_type not in _ALLOWED_PROJECT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid project_type. Must be one of: "
                f"{', '.join(sorted(_ALLOWED_PROJECT_TYPES))}"
            ),
        )


@router.get("/uep/config/coverage-matrices/{project_type}")
def get_coverage_matrix_config(project_type: str) -> dict:
    _ensure_project_type(project_type)
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
    _ensure_project_type(project_type)
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
