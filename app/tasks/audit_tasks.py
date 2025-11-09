"""
Audit execution tasks for async AI calls.

These tasks handle multi-role AI audit operations asynchronously.
Each position is analyzed by 4-6 expert roles (SME, ARCH, ENG, SUP).

Reference: docs/TECH_SPECS/backend_infrastructure.md#audit-tasks
"""
from celery import Task, group, chord
from typing import List, Optional
import logging

from app.core.celery_app import celery_app
from app.services.audit_service import AuditService
from app.core.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


# ==========================================
# AUDIT TASKS
# ==========================================

@celery_app.task(
    bind=True,
    name="app.tasks.audit_tasks.audit_position_task",
    max_retries=2,
    default_retry_delay=60,
)
def audit_position_task(
    self: Task,
    position: dict,
    project_id: str,
    classification: str = "AMBER"
) -> dict:
    """
    Audit a single position using multi-role AI experts.

    This task executes the multi-role audit process:
    1. Determine which expert roles to use based on classification
    2. Execute each role's analysis
    3. Aggregate results and determine consensus
    4. Return classification (GREEN/AMBER/RED) with evidence

    Args:
        position: Position dict with enrichment data
        project_id: Project ID for tracking
        classification: Initial classification (GREEN/AMBER/RED)

    Returns:
        dict with:
            - success: bool
            - position: dict (audited position)
            - classification: str (GREEN/AMBER/RED)
            - confidence: float
            - expert_opinions: List[dict] (all expert results)
            - consensus: dict (aggregated result)
            - hitl_required: bool (Human-in-the-loop needed)
            - error: Optional[str]

    Example:
        result = audit_position_task.delay(position, "proj-123", "AMBER")
    """
    try:
        logger.info(
            f"Starting audit for position {position.get('code', 'N/A')} "
            f"in project {project_id} (classification: {classification})"
        )

        # Initialize audit service
        claude = ClaudeClient()
        audit_service = AuditService(claude_client=claude)

        # Execute multi-role audit
        audit_result = audit_service.execute_audit(
            position=position,
            classification=classification,
        )

        logger.info(
            f"Audit completed for position {position.get('code', 'N/A')}: "
            f"classification={audit_result.get('classification', 'N/A')}, "
            f"hitl={audit_result.get('hitl_required', False)}"
        )

        return {
            "success": True,
            "position": position,
            "classification": audit_result.get("classification", "RED"),
            "confidence": audit_result.get("confidence", 0.0),
            "expert_opinions": audit_result.get("expert_opinions", []),
            "consensus": audit_result.get("consensus", {}),
            "hitl_required": audit_result.get("hitl_required", False),
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"Audit failed for position {position.get('code', 'N/A')}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "position": position,
            "classification": "RED",  # Default to RED on error
            "hitl_required": True,
            "project_id": project_id,
        }


@celery_app.task(
    bind=True,
    name="app.tasks.audit_tasks.audit_project_task",
    max_retries=1,
)
def audit_project_task(
    self: Task,
    positions: List[dict],
    project_id: str
) -> dict:
    """
    Audit all positions in a project asynchronously.

    This task orchestrates the audit of all positions in parallel:
    1. Classify each position (GREEN/AMBER/RED) based on enrichment
    2. Create audit subtasks for each position
    3. Execute subtasks in parallel
    4. Aggregate results and generate project-level summary

    Args:
        positions: List of enriched position dicts
        project_id: Project ID

    Returns:
        dict with:
            - success: bool
            - total: int (total positions)
            - green: int (GREEN positions)
            - amber: int (AMBER positions)
            - red: int (RED positions)
            - hitl_count: int (positions requiring HITL)
            - results: List[dict] (all audit results)
            - summary: dict (project-level summary)
            - error: Optional[str]

    Example:
        result = audit_project_task.delay(positions, "proj-123")
    """
    try:
        logger.info(f"Starting project audit for {len(positions)} positions in project {project_id}")

        # Classify positions based on enrichment confidence
        def classify_position(pos: dict) -> str:
            confidence = pos.get("enrichment", {}).get("confidence", 0.0)
            if confidence >= 0.95:
                return "GREEN"
            elif confidence >= 0.75:
                return "AMBER"
            else:
                return "RED"

        # Create subtasks for each position
        subtasks = [
            audit_position_task.s(position, project_id, classify_position(position))
            for position in positions
        ]

        # Execute subtasks in parallel using group
        job = group(subtasks)
        result_group = job.apply_async()

        # Wait for all subtasks to complete (max 30 minutes)
        results = result_group.get(timeout=1800)

        # Aggregate results
        green_count = sum(1 for r in results if r.get("classification") == "GREEN")
        amber_count = sum(1 for r in results if r.get("classification") == "AMBER")
        red_count = sum(1 for r in results if r.get("classification") == "RED")
        hitl_count = sum(1 for r in results if r.get("hitl_required", False))

        logger.info(
            f"Project audit completed for project {project_id}: "
            f"GREEN={green_count}, AMBER={amber_count}, RED={red_count}, HITL={hitl_count}"
        )

        return {
            "success": True,
            "total": len(positions),
            "green": green_count,
            "amber": amber_count,
            "red": red_count,
            "hitl_count": hitl_count,
            "results": results,
            "summary": {
                "total_positions": len(positions),
                "pass_rate": green_count / len(positions) if positions else 0,
                "review_rate": (amber_count + red_count) / len(positions) if positions else 0,
                "hitl_rate": hitl_count / len(positions) if positions else 0,
            },
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"Project audit failed for project {project_id}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=180)

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "total": len(positions),
            "green": 0,
            "amber": 0,
            "red": len(positions),
            "hitl_count": len(positions),
            "project_id": project_id,
        }


# ==========================================
# AUDIT UTILITIES
# ==========================================

def audit_project_async(positions: List[dict], project_id: str) -> str:
    """
    Start asynchronous audit of all project positions.

    This is a convenience function that starts a project audit task
    and returns the task ID for tracking.

    Args:
        positions: List of enriched position dicts
        project_id: Project ID

    Returns:
        str: Celery task ID

    Example:
        task_id = audit_project_async(positions, "proj-123")
        # Later, check status with get_task_status(task_id)
    """
    task = audit_project_task.delay(positions, project_id)
    return task.id


__all__ = [
    "audit_position_task",
    "audit_project_task",
    "audit_project_async",
]
