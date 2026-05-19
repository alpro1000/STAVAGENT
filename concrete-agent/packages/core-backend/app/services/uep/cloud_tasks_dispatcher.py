"""
UEP Cloud Tasks dispatcher — PR2 §3.4 + task §14.5.

Wraps the job payload into a Cloud Tasks queue message so a Cloud Run
worker can pick it up and run `run_job_in_process()` out-of-band.

ARCHITECTURE (production path):
  1. POST /api/v1/projects/{pid}/uep/run validates + creates uep_jobs row.
  2. Calls `dispatch_job(info, project_dir, out_dir)` (this module).
  3. dispatch_job pushes a Cloud Tasks HTTP target to
     `https://<service>/_internal/uep/worker/run` carrying a signed
     JSON payload {job_id, project_id, project_dir, out_dir}.
  4. Cloud Tasks delivers to the worker route, which authenticates the
     OIDC token (per Cloud Tasks docs §HTTP target) and runs the job.

PR2 ships:
  - The dispatcher contract (this module).
  - A stub that logs the intended dispatch but does NOT call the GCP
    SDK — Cloud Tasks setup requires the queue to exist, the service
    account to have `cloudtasks.enqueuer`, and `UEP_CLOUD_TASKS_QUEUE`
    / `UEP_CLOUD_TASKS_WORKER_URL` env vars to be set.
  - The in-process fallback is still controlled by `UEP_USE_CLOUD_TASKS`
    env in routes_uep.py — if absent or != "1", the runner executes
    synchronously inside the request handler.

When live Cloud Tasks is wired (post-PR2):
  - Set env `UEP_USE_CLOUD_TASKS=1`.
  - Provision `uep-extraction-queue` Cloud Tasks queue in
    `europe-west3`.
  - Worker route `POST /_internal/uep/worker/run` consumes the payload.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §14.5
Reference: docs/tasks/TASK_UEP_PR2.md §3.4
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional

from app.models.uep_job_schemas import JobInfo

logger = logging.getLogger(__name__)


class CloudTasksConfigError(RuntimeError):
    """Raised when Cloud Tasks dispatch is requested but not configured."""


def _required_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        raise CloudTasksConfigError(
            f"Cloud Tasks dispatch requires env {name!r} (UEP_USE_CLOUD_TASKS=1 is set)"
        )
    return v


async def dispatch_job(
    info: JobInfo,
    project_dir: Path,
    *,
    out_dir: Path,
) -> None:
    """Push a Cloud Tasks HTTP target for `info.job_id`.

    PR2 stub implementation: validate env, build payload, log dispatch.
    Actual `google.cloud.tasks_v2.CloudTasksClient` call lands in the
    follow-up commit once the Cloud Tasks queue is provisioned (see
    docstring for setup requirements).
    """

    payload = {
        "job_id": info.job_id,
        "user_id": info.user_id,
        "project_id": info.project_id,
        "project_dir": str(project_dir),
        "out_dir": str(out_dir),
        "project_type": info.project_type,
        "force_rerun": info.force_rerun,
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    queue_name = _required_env("UEP_CLOUD_TASKS_QUEUE")
    worker_url = _required_env("UEP_CLOUD_TASKS_WORKER_URL")
    service_account = os.environ.get("UEP_CLOUD_TASKS_SERVICE_ACCOUNT", "")

    try:
        # Lazy import — google-cloud-tasks isn't always installed in dev.
        from google.cloud import tasks_v2  # type: ignore[import-not-found]
        from google.protobuf import duration_pb2  # type: ignore[import-not-found]
    except ImportError:
        logger.warning(
            "[uep.cloud_tasks] google-cloud-tasks not installed — "
            "logging dispatch intent only. job_id=%s queue=%s url=%s",
            info.job_id, queue_name, worker_url,
        )
        return

    client = tasks_v2.CloudTasksClient()
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": worker_url,
            "headers": {"Content-Type": "application/json"},
            "body": payload_bytes,
        },
        "dispatch_deadline": duration_pb2.Duration(seconds=1800),  # 30 min
    }
    if service_account:
        task["http_request"]["oidc_token"] = {  # type: ignore[index]
            "service_account_email": service_account,
        }
    response = client.create_task(parent=queue_name, task=task)
    logger.info(
        "[uep.cloud_tasks] dispatched job=%s task=%s",
        info.job_id, response.name,
    )


def is_cloud_tasks_enabled() -> bool:
    """Feature flag — read by routes_uep.py."""

    return os.environ.get("UEP_USE_CLOUD_TASKS", "0").strip() == "1"
