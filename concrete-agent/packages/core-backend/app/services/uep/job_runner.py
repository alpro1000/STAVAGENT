"""
UEP job runner — in-process execution path (PR2 §3.4).

This is the engine that actually runs a UEP project: discovers files,
runs every extractor, evaluates the coverage matrix, evaluates the
reconciliation engine, writes artefacts to disk, and updates the
JobInfo as it goes.

Two execution flavours:
  - `run_job_in_process(...)` — runs synchronously in the request
    handler (PR2 dev fallback when Cloud Tasks isn't wired).
  - `dispatch_job_to_cloud_tasks(...)` — wraps the same payload into
    a Cloud Tasks queue message (production path, shipped as a stub
    in `cloud_tasks_dispatcher.py`).

The runner emits JobEvent records into an in-memory queue keyed by
job_id; the SSE endpoint consumes from that queue to stream progress
to the client.

Reference: docs/tasks/TASK_UEP_PR2.md §3.4 + §3.3
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.models.uep_job_schemas import JobEvent, JobInfo, JobPhase, JobState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory job store + event bus.
#
# PR2 dev path. Production (Cloud Run + Cloud SQL) reads/writes from the
# `uep_jobs` table; the event stream is published via Cloud Tasks +
# Redis Pub/Sub (PR3 wiring). For the REST + SSE endpoints to work in
# this PR, we keep an in-process store keyed by job_id.
# ---------------------------------------------------------------------------


_JOBS: dict[str, JobInfo] = {}
_EVENT_QUEUES: dict[str, asyncio.Queue[JobEvent]] = {}


def _get_event_queue(job_id: str) -> asyncio.Queue[JobEvent]:
    """Return (creating if needed) the SSE event queue for a job."""

    queue = _EVENT_QUEUES.get(job_id)
    if queue is None:
        queue = asyncio.Queue(maxsize=256)
        _EVENT_QUEUES[job_id] = queue
    return queue


def get_job(job_id: str) -> Optional[JobInfo]:
    return _JOBS.get(job_id)


def list_active_jobs_for_user(user_id: str) -> list[JobInfo]:
    return [
        j for j in _JOBS.values()
        if j.user_id == user_id and j.state in {JobState.QUEUED, JobState.RUNNING}
    ]


def list_active_jobs_for_project(project_id: str) -> list[JobInfo]:
    return [
        j for j in _JOBS.values()
        if j.project_id == project_id and j.state in {JobState.QUEUED, JobState.RUNNING}
    ]


def register_new_job(
    *,
    user_id: str,
    project_id: str,
    project_type: str = "residential",
    force_rerun: bool = False,
    queue_dispatch: str = "in_process",
) -> JobInfo:
    """Insert a queued JobInfo into the in-memory store."""

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    info = JobInfo(
        job_id=job_id,
        user_id=user_id,
        project_id=project_id,
        state=JobState.QUEUED,
        phase=None,
        progress_pct=0.0,
        project_type=project_type,
        force_rerun=force_rerun,
        queue_dispatch=queue_dispatch,
        queued_at=now,
        last_event_at=now,
    )
    _JOBS[job_id] = info
    return info


async def _emit(info: JobInfo, phase: JobPhase, message: str, progress: float) -> None:
    info.phase = phase
    info.progress_pct = progress
    info.last_event_at = datetime.now(timezone.utc)
    event = JobEvent(
        job_id=info.job_id,
        state=info.state,
        phase=phase,
        progress_pct=progress,
        message=message,
        timestamp=info.last_event_at,
    )
    queue = _get_event_queue(info.job_id)
    try:
        queue.put_nowait(event)
    except asyncio.QueueFull:
        # Drop oldest to make room — the SSE consumer is slow; the
        # JobInfo state is still authoritative via the polling endpoint.
        try:
            queue.get_nowait()
            queue.put_nowait(event)
        except Exception:  # noqa: BLE001
            pass


async def run_job_in_process(
    info: JobInfo,
    project_dir: Path,
    *,
    out_dir: Path,
) -> JobInfo:
    """Run a UEP project end-to-end in-process.

    Returns the final JobInfo with state=completed | failed.
    """

    info.state = JobState.RUNNING
    info.started_at = datetime.now(timezone.utc)
    started_at = time.time()

    try:
        # Import here to avoid circular import with services/uep package.
        from app.services.uep import (
            evaluate_coverage,
            evaluate_reconciliation,
            get_extractor,
            load_matrix,
            load_rules,
            rules_path_for,
        )
        from app.services.uep.coverage_engine import matrix_path_for
        from app.services.uep.registry import detect_format

        await _emit(info, JobPhase.DISCOVERY, "Discovering files…", 5.0)

        files: list[tuple[Path, Any]] = []
        for p in sorted(project_dir.rglob("*")):
            if not p.is_file():
                continue
            fmt = detect_format(p)
            if fmt is None:
                continue
            files.append((p, fmt))
        info.files_discovered = len(files)
        await _emit(info, JobPhase.DISCOVERY, f"Found {len(files)} supported files", 10.0)

        # Phase 1 — per-source extraction.
        await _emit(info, JobPhase.EXTRACTION, "Extracting…", 15.0)
        extractions = []
        for idx, (path, fmt) in enumerate(files, 1):
            extractor = get_extractor(path)
            if extractor is None:
                continue
            extraction = extractor.extract(path)
            extractions.append(extraction)
            if not extraction.extractor_error:
                info.files_extracted += 1
                info.facts_count += len(extraction.facts)
            # Progress 15→50 across files
            await _emit(
                info,
                JobPhase.EXTRACTION,
                f"[{idx}/{len(files)}] {path.name}",
                15.0 + 35.0 * idx / max(1, len(files)),
            )

        # Phase 2 — coverage.
        await _emit(info, JobPhase.COVERAGE, "Coverage matrix…", 55.0)
        matrix_path = matrix_path_for(info.project_type)
        requirements = load_matrix(matrix_path, project_type=info.project_type)
        coverage_report = evaluate_coverage(
            extractions,
            requirements,
            project_type=info.project_type,
            matrix_file=matrix_path.name,
            project_id=info.project_id,
        )
        info.coverage_pct = float(coverage_report.pokryto_pct)
        await _emit(
            info, JobPhase.COVERAGE,
            f"Coverage {coverage_report.pokryto_pct}%", 65.0,
        )

        # Phase 3 — reconciliation.
        await _emit(info, JobPhase.RECONCILIATION, "Reconciliation…", 70.0)
        recon_report = None
        try:
            rules_p = rules_path_for(info.project_type)
            if rules_p.exists():
                rs = load_rules(rules_p, info.project_type)
                recon_report = evaluate_reconciliation(
                    extractions, rs,
                    project_id=info.project_id,
                    rules_file=rules_p.name,
                )
                info.reconciliation_conflicts = recon_report.conflict_count
        except Exception as exc:  # noqa: BLE001
            await _emit(
                info, JobPhase.RECONCILIATION,
                f"Reconciliation skipped: {exc}", 75.0,
            )

        # Phase 4 — derivation (PR2 ships the registry; no auto-derive
        # in the runner — derivations are explicit caller-driven via
        # POST /api/v1/projects/{pid}/uep/derivation).
        await _emit(info, JobPhase.DERIVATION, "Derivation registry ready (call /uep/derivation)", 80.0)

        # Phase 5 — write artefacts.
        await _emit(info, JobPhase.WRITE_ARTIFACTS, "Writing artefacts…", 90.0)
        out_dir.mkdir(parents=True, exist_ok=True)
        coverage_path = out_dir / "coverage_report.json"
        coverage_path.write_text(
            coverage_report.model_dump_json(indent=2), encoding="utf-8"
        )
        if recon_report is not None:
            (out_dir / "reconciliation_report.json").write_text(
                recon_report.model_dump_json(indent=2), encoding="utf-8"
            )
        info.artifacts_path = str(out_dir)

        info.state = JobState.COMPLETED
        info.completed_at = datetime.now(timezone.utc)
        info.progress_pct = 100.0
        await _emit(
            info, JobPhase.WRITE_ARTIFACTS,
            f"Done in {time.time() - started_at:.1f}s", 100.0,
        )
        # Terminal event signals consumers to close their SSE streams.
        _get_event_queue(info.job_id).put_nowait(
            JobEvent(
                job_id=info.job_id,
                state=info.state,
                phase=info.phase,
                progress_pct=100.0,
                message="__terminal__",
                timestamp=info.last_event_at or datetime.now(timezone.utc),
            )
        )
    except Exception as exc:  # noqa: BLE001
        info.state = JobState.FAILED
        info.completed_at = datetime.now(timezone.utc)
        info.error_message = f"{type(exc).__name__}: {exc}"
        logger.exception("[uep.job %s] failed", info.job_id)
        await _emit(info, info.phase or JobPhase.DISCOVERY, info.error_message, info.progress_pct)
        _get_event_queue(info.job_id).put_nowait(
            JobEvent(
                job_id=info.job_id,
                state=info.state,
                phase=info.phase,
                progress_pct=info.progress_pct,
                message="__terminal__",
                timestamp=info.last_event_at or datetime.now(timezone.utc),
            )
        )

    return info


def cancel_job(job_id: str) -> Optional[JobInfo]:
    """Mark a queued/running job as cancelled.

    PR2 best-effort — running jobs continue until the next `await _emit`
    or until they complete. The cancellation flag is honoured by the
    SSE consumer (closes the stream) and by `/jobs/{jid}` polling.
    """

    info = _JOBS.get(job_id)
    if info is None:
        return None
    if info.state in {JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED}:
        return info
    info.state = JobState.CANCELLED
    info.completed_at = datetime.now(timezone.utc)
    queue = _get_event_queue(job_id)
    try:
        queue.put_nowait(
            JobEvent(
                job_id=info.job_id,
                state=info.state,
                phase=info.phase,
                progress_pct=info.progress_pct,
                message="__terminal__",
                timestamp=info.completed_at,
            )
        )
    except asyncio.QueueFull:
        pass
    return info
