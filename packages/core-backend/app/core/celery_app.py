"""
Celery application for background task processing.

This module configures Celery with Redis as broker and result backend.
All background tasks (PDF parsing, enrichment, audit) are registered here.

Reference: docs/TECH_SPECS/backend_infrastructure.md#celery-queue-system
"""
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
from typing import Any
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# ==========================================
# CELERY APPLICATION
# ==========================================

def make_celery() -> Celery:
    """
    Create and configure Celery application.

    Returns:
        Configured Celery instance

    Configuration:
        - Broker: Redis (database 1)
        - Result Backend: Redis (database 1)
        - Task Serializer: JSON
        - Result Serializer: JSON
        - Task tracking enabled
        - Time limits: 30min hard, 25min soft
    """
    celery_app = Celery(
        "concrete_agent",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )

    # Configure Celery from settings
    celery_app.conf.update(
        task_track_started=settings.CELERY_TASK_TRACK_STARTED,
        task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
        task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
        accept_content=settings.CELERY_ACCEPT_CONTENT,
        task_serializer=settings.CELERY_TASK_SERIALIZER,
        result_serializer=settings.CELERY_RESULT_SERIALIZER,
        timezone="UTC",
        enable_utc=True,

        # Task routing (all tasks to default queue)
        task_default_queue="default",
        task_default_exchange="default",
        task_default_routing_key="default",

        # Result expiration (7 days)
        result_expires=604800,

        # Worker configuration
        worker_prefetch_multiplier=1,  # Only prefetch 1 task per worker
        worker_max_tasks_per_child=100,  # Restart worker after 100 tasks

        # Task result backend settings
        result_backend_transport_options={
            "master_name": "mymaster",
        },

        # Visibility timeout (2 hours)
        broker_transport_options={
            "visibility_timeout": 7200,
        },
    )

    # Auto-discover tasks from app.tasks package
    celery_app.autodiscover_tasks(["app.tasks"])

    return celery_app


# Create global Celery app instance
celery_app = make_celery()


# ==========================================
# TASK MONITORING SIGNALS
# ==========================================

@task_prerun.connect
def task_prerun_handler(sender: Any = None, task_id: str = None, task: Any = None,
                        args: tuple = None, kwargs: dict = None, **extra_kwargs):
    """
    Signal handler before task execution.

    Updates BackgroundJob status to 'running'.
    """
    logger.info(f"Task {task.name} ({task_id}) started with args={args}, kwargs={kwargs}")

    # Update BackgroundJob model status
    # TODO: Implement after database integration
    # from app.db.models.job import BackgroundJob
    # BackgroundJob.update_status(task_id, "running")


@task_postrun.connect
def task_postrun_handler(sender: Any = None, task_id: str = None, task: Any = None,
                         args: tuple = None, kwargs: dict = None, retval: Any = None,
                         **extra_kwargs):
    """
    Signal handler after successful task execution.

    Updates BackgroundJob status to 'completed' with result.
    """
    logger.info(f"Task {task.name} ({task_id}) completed successfully")

    # Update BackgroundJob model status
    # TODO: Implement after database integration
    # from app.db.models.job import BackgroundJob
    # BackgroundJob.update_status(task_id, "completed", result=retval)


@task_failure.connect
def task_failure_handler(sender: Any = None, task_id: str = None, exception: Exception = None,
                         args: tuple = None, kwargs: dict = None, traceback: str = None,
                         einfo: Any = None, **extra_kwargs):
    """
    Signal handler on task failure.

    Updates BackgroundJob status to 'failed' with error details.
    """
    logger.error(f"Task {sender.name} ({task_id}) failed: {exception}")
    logger.error(f"Traceback: {traceback}")

    # Update BackgroundJob model status
    # TODO: Implement after database integration
    # from app.db.models.job import BackgroundJob
    # BackgroundJob.update_status(task_id, "failed", error=str(exception))


# ==========================================
# CELERY BEAT SCHEDULE (Periodic Tasks)
# ==========================================

celery_app.conf.beat_schedule = {
    # Example: Clean up old task results every day at 3 AM
    "cleanup-old-results": {
        "task": "app.tasks.maintenance.cleanup_old_results",
        "schedule": 86400.0,  # 24 hours
        "args": (7,),  # Keep results for 7 days
    },

    # Example: Update KB cache every 6 hours
    "update-kb-cache": {
        "task": "app.tasks.maintenance.update_kb_cache",
        "schedule": 21600.0,  # 6 hours
    },
}


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_celery_app() -> Celery:
    """
    Get the global Celery application instance.

    Returns:
        Celery app instance

    Example:
        from app.core.celery_app import get_celery_app
        celery = get_celery_app()
        result = celery.send_task("app.tasks.pdf_tasks.parse_pdf", args=[project_id])
    """
    return celery_app


__all__ = ["celery_app", "get_celery_app", "make_celery"]
