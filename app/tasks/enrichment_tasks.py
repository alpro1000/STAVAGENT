"""
Position enrichment tasks for batch processing.

These tasks handle enrichment of construction positions with KROS/RTS data.
Supports both single position and batch processing.

Reference: docs/TECH_SPECS/backend_infrastructure.md#enrichment-tasks
"""
from celery import Task, group
from typing import List, Optional
import logging

from app.core.celery_app import celery_app
from app.services.enricher import PositionEnricher
from app.knowledge_base.kb_loader import KBLoader

logger = logging.getLogger(__name__)


# ==========================================
# ENRICHMENT TASKS
# ==========================================

@celery_app.task(
    bind=True,
    name="app.tasks.enrichment_tasks.enrich_position_task",
    max_retries=2,
    default_retry_delay=30,
)
def enrich_position_task(self: Task, position: dict, project_id: str) -> dict:
    """
    Enrich a single position with KROS/RTS data.

    This task matches the position against Knowledge Base (KROS, RTS, OTSKP)
    and adds pricing, unit, and classification information.

    Args:
        position: Position dict with code, description, unit, quantity
        project_id: Project ID for tracking

    Returns:
        dict with:
            - success: bool
            - position: dict (enriched position)
            - match_type: str (exact, partial, none)
            - confidence: float
            - error: Optional[str]

    Example:
        position = {
            "code": "121151113",
            "description": "Beton C30/37",
            "quantity": 10.5,
            "unit": "m3"
        }
        result = enrich_position_task.delay(position, "proj-123")
    """
    try:
        logger.info(f"Starting enrichment for position {position.get('code', 'N/A')} in project {project_id}")

        # Initialize enricher
        kb_loader = KBLoader()
        enricher = PositionEnricher(kb_loader=kb_loader)

        # Enrich position
        enriched = enricher.enrich(position)

        logger.info(
            f"Enrichment completed for position {position.get('code', 'N/A')}: "
            f"match={enriched.get('enrichment', {}).get('match', 'none')}"
        )

        return {
            "success": True,
            "position": enriched,
            "match_type": enriched.get("enrichment", {}).get("match", "none"),
            "confidence": enriched.get("enrichment", {}).get("confidence", 0.0),
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"Enrichment failed for position {position.get('code', 'N/A')}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "position": position,
            "project_id": project_id,
        }


@celery_app.task(
    bind=True,
    name="app.tasks.enrichment_tasks.enrich_batch_task",
    max_retries=1,
)
def enrich_batch_task(
    self: Task,
    positions: List[dict],
    project_id: str,
    batch_size: int = 10
) -> dict:
    """
    Enrich multiple positions in parallel batches.

    This task creates subtasks for each position and processes them in parallel
    using Celery's group primitive. Results are aggregated and returned.

    Args:
        positions: List of position dicts
        project_id: Project ID for tracking
        batch_size: Number of positions to process in parallel (default: 10)

    Returns:
        dict with:
            - success: bool
            - total: int (total positions)
            - enriched: int (successfully enriched)
            - failed: int (failed enrichments)
            - results: List[dict] (enriched positions)
            - errors: List[dict] (failed positions with errors)

    Example:
        positions = [pos1, pos2, pos3, ...]
        result = enrich_batch_task.delay(positions, "proj-123")
    """
    try:
        logger.info(f"Starting batch enrichment for {len(positions)} positions in project {project_id}")

        # Create subtasks for each position
        subtasks = [
            enrich_position_task.s(position, project_id)
            for position in positions
        ]

        # Execute subtasks in parallel using group
        job = group(subtasks)
        result_group = job.apply_async()

        # Wait for all subtasks to complete
        results = result_group.get(timeout=600)  # 10 minute timeout

        # Aggregate results
        enriched_positions = []
        failed_positions = []

        for result in results:
            if result.get("success"):
                enriched_positions.append(result["position"])
            else:
                failed_positions.append({
                    "position": result.get("position", {}),
                    "error": result.get("error", "Unknown error"),
                })

        logger.info(
            f"Batch enrichment completed for project {project_id}: "
            f"{len(enriched_positions)} enriched, {len(failed_positions)} failed"
        )

        return {
            "success": True,
            "total": len(positions),
            "enriched": len(enriched_positions),
            "failed": len(failed_positions),
            "results": enriched_positions,
            "errors": failed_positions,
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"Batch enrichment failed for project {project_id}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=120)

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "total": len(positions),
            "enriched": 0,
            "failed": len(positions),
            "project_id": project_id,
        }


# ==========================================
# ENRICHMENT UTILITIES
# ==========================================

def enrich_positions_async(positions: List[dict], project_id: str) -> str:
    """
    Start asynchronous enrichment of multiple positions.

    This is a convenience function that starts a batch enrichment task
    and returns the task ID for tracking.

    Args:
        positions: List of position dicts
        project_id: Project ID

    Returns:
        str: Celery task ID

    Example:
        task_id = enrich_positions_async(positions, "proj-123")
        # Later, check status with get_task_status(task_id)
    """
    task = enrich_batch_task.delay(positions, project_id)
    return task.id


__all__ = [
    "enrich_position_task",
    "enrich_batch_task",
    "enrich_positions_async",
]
