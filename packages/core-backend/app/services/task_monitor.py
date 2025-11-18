"""
Task monitoring service for Celery background jobs.

This service integrates Celery tasks with BackgroundJob model,
providing unified tracking and monitoring of async operations.

Reference: docs/TECH_SPECS/backend_infrastructure.md#task-monitoring
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from celery.result import AsyncResult
import logging

from app.core.celery_app import celery_app
from app.db.models.job import BackgroundJob

logger = logging.getLogger(__name__)


class TaskMonitor:
    """
    Monitor and track Celery background tasks.

    This class bridges Celery tasks with BackgroundJob database model,
    enabling persistent tracking of async operations across restarts.
    """

    def __init__(self):
        """Initialize task monitor."""
        self.celery_app = celery_app

    def create_job_record(
        self,
        task_id: str,
        task_name: str,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> BackgroundJob:
        """
        Create a BackgroundJob database record for a Celery task.

        Args:
            task_id: Celery task ID
            task_name: Human-readable task name
            project_id: Optional project ID
            user_id: Optional user ID

        Returns:
            BackgroundJob instance

        Example:
            task = parse_pdf_task.delay(file_path, project_id)
            job = monitor.create_job_record(
                task_id=task.id,
                task_name="PDF Parsing",
                project_id=project_id
            )
        """
        # TODO: Implement database session management when DB is ready
        # from app.db.session import get_db_session
        #
        # job = BackgroundJob(
        #     task_id=task_id,
        #     task_name=task_name,
        #     project_id=project_id,
        #     user_id=user_id,
        #     status='pending',
        #     progress=0.0,
        # )
        #
        # with get_db_session() as session:
        #     session.add(job)
        #     session.commit()
        #     session.refresh(job)
        #
        # return job

        # Placeholder for now
        logger.info(f"Created job record: task_id={task_id}, task_name={task_name}")
        return None

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get current status of a Celery task.

        Args:
            task_id: Celery task ID

        Returns:
            dict with:
                - state: str (PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED)
                - result: Optional[Any] (task result if completed)
                - error: Optional[str] (error message if failed)
                - traceback: Optional[str] (traceback if failed)
                - progress: float (0-100)
                - ready: bool (task completed)
                - successful: bool (task completed successfully)

        Example:
            status = monitor.get_task_status("task-id-123")
            if status["state"] == "SUCCESS":
                result = status["result"]
        """
        task = AsyncResult(task_id, app=self.celery_app)

        status = {
            "state": task.state,
            "ready": task.ready(),
            "successful": task.successful() if task.ready() else False,
            "failed": task.failed() if task.ready() else False,
        }

        # Add result if completed
        if task.successful():
            status["result"] = task.result
            status["progress"] = 100.0

        # Add error if failed
        elif task.failed():
            status["error"] = str(task.info) if task.info else "Unknown error"
            status["traceback"] = getattr(task, "traceback", None)
            status["progress"] = 0.0

        # Add progress if available (custom state)
        elif hasattr(task, "info") and isinstance(task.info, dict):
            status["progress"] = task.info.get("progress", 0.0)
            status["message"] = task.info.get("message", "")

        else:
            status["progress"] = 0.0

        return status

    def update_job_status(
        self,
        task_id: str,
        status: str,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        result: Optional[Dict] = None,
        error: Optional[str] = None,
    ) -> bool:
        """
        Update BackgroundJob record with current task status.

        Args:
            task_id: Celery task ID
            status: New status (pending, processing, completed, failed)
            progress: Optional progress (0-100)
            message: Optional status message
            result: Optional result data
            error: Optional error message

        Returns:
            bool: True if updated successfully

        Example:
            monitor.update_job_status(
                task_id="task-123",
                status="processing",
                progress=50.0,
                message="Processing page 5 of 10"
            )
        """
        # TODO: Implement database update when DB is ready
        # from app.db.session import get_db_session
        #
        # with get_db_session() as session:
        #     job = session.query(BackgroundJob).filter_by(task_id=task_id).first()
        #
        #     if not job:
        #         logger.warning(f"Job not found for task_id: {task_id}")
        #         return False
        #
        #     job.status = status
        #
        #     if progress is not None:
        #         job.update_progress(progress, message)
        #
        #     if result is not None:
        #         job.result = result
        #
        #     if error is not None:
        #         job.error = error
        #
        #     if status == "processing" and not job.started_at:
        #         job.started_at = datetime.utcnow()
        #
        #     if status in ["completed", "failed", "cancelled"]:
        #         job.completed_at = datetime.utcnow()
        #
        #     session.commit()
        #
        # return True

        # Placeholder for now
        logger.info(
            f"Updated job status: task_id={task_id}, status={status}, "
            f"progress={progress}, message={message}"
        )
        return True

    def sync_celery_to_db(self, task_id: str) -> bool:
        """
        Sync Celery task status to BackgroundJob database record.

        This method queries Celery for task status and updates the
        corresponding BackgroundJob record.

        Args:
            task_id: Celery task ID

        Returns:
            bool: True if synced successfully

        Example:
            # Run periodically to keep DB in sync
            monitor.sync_celery_to_db("task-123")
        """
        celery_status = self.get_task_status(task_id)

        # Map Celery states to BackgroundJob statuses
        state_mapping = {
            "PENDING": "pending",
            "STARTED": "processing",
            "SUCCESS": "completed",
            "FAILURE": "failed",
            "RETRY": "processing",
            "REVOKED": "cancelled",
        }

        db_status = state_mapping.get(celery_status["state"], "pending")

        return self.update_job_status(
            task_id=task_id,
            status=db_status,
            progress=celery_status.get("progress", 0.0),
            result=celery_status.get("result"),
            error=celery_status.get("error"),
        )

    def get_project_jobs(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all background jobs for a project.

        Args:
            project_id: Project ID

        Returns:
            List of job dicts with status information

        Example:
            jobs = monitor.get_project_jobs("proj-123")
            for job in jobs:
                print(f"{job['task_name']}: {job['status']}")
        """
        # TODO: Implement database query when DB is ready
        # from app.db.session import get_db_session
        #
        # with get_db_session() as session:
        #     jobs = session.query(BackgroundJob)\
        #         .filter_by(project_id=project_id)\
        #         .order_by(BackgroundJob.created_at.desc())\
        #         .all()
        #
        #     return [
        #         {
        #             "id": str(job.id),
        #             "task_id": job.task_id,
        #             "task_name": job.task_name,
        #             "status": job.status,
        #             "progress": float(job.progress),
        #             "message": job.message,
        #             "result": job.result,
        #             "error": job.error,
        #             "created_at": job.created_at.isoformat(),
        #             "started_at": job.started_at.isoformat() if job.started_at else None,
        #             "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        #         }
        #         for job in jobs
        #     ]

        # Placeholder for now
        logger.info(f"Getting jobs for project: {project_id}")
        return []

    def cancel_task(self, task_id: str, terminate: bool = False) -> bool:
        """
        Cancel a running Celery task.

        Args:
            task_id: Celery task ID
            terminate: If True, forcefully terminate the task

        Returns:
            bool: True if cancelled successfully

        Example:
            monitor.cancel_task("task-123", terminate=True)
        """
        try:
            task = AsyncResult(task_id, app=self.celery_app)

            if terminate:
                task.revoke(terminate=True, signal="SIGKILL")
            else:
                task.revoke()

            # Update database record
            self.update_job_status(task_id, status="cancelled")

            logger.info(f"Task cancelled: {task_id} (terminate={terminate})")
            return True

        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False


# ==========================================
# GLOBAL INSTANCE
# ==========================================

_task_monitor: Optional[TaskMonitor] = None


def get_task_monitor() -> TaskMonitor:
    """
    Get the global TaskMonitor instance.

    Returns:
        TaskMonitor instance

    Example:
        from app.services.task_monitor import get_task_monitor
        monitor = get_task_monitor()
        status = monitor.get_task_status("task-123")
    """
    global _task_monitor

    if _task_monitor is None:
        _task_monitor = TaskMonitor()

    return _task_monitor


__all__ = ["TaskMonitor", "get_task_monitor"]
