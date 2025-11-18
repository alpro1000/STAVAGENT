"""
PDF parsing tasks for background processing.

These tasks handle long-running PDF parsing operations asynchronously.
Used for Workflow B (drawing analysis) and document Q&A.

Reference: docs/TECH_SPECS/backend_infrastructure.md#pdf-parsing-tasks
"""
from celery import Task
from pathlib import Path
from typing import Optional
import logging

from app.core.celery_app import celery_app
from app.parsers.pdf_parser import PDFParser
from app.core.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


# ==========================================
# PDF PARSING TASKS
# ==========================================

@celery_app.task(
    bind=True,
    name="app.tasks.pdf_tasks.parse_pdf_task",
    max_retries=3,
    default_retry_delay=60,
)
def parse_pdf_task(self: Task, file_path: str, project_id: str, use_mineru: bool = True) -> dict:
    """
    Parse PDF file asynchronously.

    This task handles long-running PDF parsing operations using MinerU or fallback methods.
    Supports retry on failure with exponential backoff.

    Args:
        file_path: Path to PDF file
        project_id: Project ID for tracking
        use_mineru: Whether to use MinerU for parsing

    Returns:
        dict with:
            - success: bool
            - text: str (extracted text)
            - pages: int
            - diagnostics: dict
            - error: Optional[str]

    Raises:
        Exception: On parsing failure (triggers retry)

    Example:
        result = parse_pdf_task.delay("/path/to/file.pdf", "proj-123")
        result_data = result.get()
    """
    try:
        logger.info(f"Starting PDF parsing for project {project_id}: {file_path}")

        # Initialize parser
        parser = PDFParser()

        # Parse PDF
        result = parser.parse_pdf(
            file_path=Path(file_path),
            use_mineru=use_mineru,
        )

        logger.info(f"PDF parsing completed for project {project_id}: {len(result.get('pages', []))} pages")

        return {
            "success": True,
            "text": result.get("text", ""),
            "pages": len(result.get("pages", [])),
            "diagnostics": result.get("diagnostics", {}),
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"PDF parsing failed for project {project_id}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "project_id": project_id,
        }


@celery_app.task(
    bind=True,
    name="app.tasks.pdf_tasks.extract_positions_task",
    max_retries=2,
    default_retry_delay=120,
)
def extract_positions_task(
    self: Task,
    pdf_text: str,
    project_id: str,
    use_claude_vision: bool = True
) -> dict:
    """
    Extract construction positions from PDF text using Claude AI.

    This task uses Claude to analyze PDF content and extract structured position data.
    Used in Workflow B for generating estimates from drawings.

    Args:
        pdf_text: Extracted PDF text
        project_id: Project ID for tracking
        use_claude_vision: Whether to use Claude Vision for analysis

    Returns:
        dict with:
            - success: bool
            - positions: list[dict] (extracted positions)
            - count: int (number of positions)
            - error: Optional[str]

    Example:
        result = extract_positions_task.delay(pdf_text, "proj-123")
    """
    try:
        logger.info(f"Starting position extraction for project {project_id}")

        # Initialize Claude client
        claude = ClaudeClient()

        # Build extraction prompt
        prompt = f"""
Analyze the following construction document text and extract all cost positions.

For each position, extract:
- Code (JKSO/ÚRS code if present)
- Description (Czech)
- Quantity
- Unit
- Unit price (if present)
- Total price (if present)

Text:
{pdf_text[:10000]}  # Limit to first 10k chars

Return as JSON array of positions.
"""

        # Call Claude
        response = claude.generate_response(
            prompt=prompt,
            system_prompt="You are a construction cost expert analyzing Czech estimates.",
            max_tokens=4000,
        )

        # Parse response
        # TODO: Implement proper JSON parsing and validation
        positions = []  # Placeholder

        logger.info(f"Position extraction completed for project {project_id}: {len(positions)} positions")

        return {
            "success": True,
            "positions": positions,
            "count": len(positions),
            "project_id": project_id,
        }

    except Exception as exc:
        logger.error(f"Position extraction failed for project {project_id}: {exc}")

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))

        # Return error after max retries
        return {
            "success": False,
            "error": str(exc),
            "project_id": project_id,
        }


# ==========================================
# TASK UTILITIES
# ==========================================

def get_task_status(task_id: str) -> dict:
    """
    Get status of a Celery task.

    Args:
        task_id: Celery task ID

    Returns:
        dict with:
            - state: str (PENDING, STARTED, SUCCESS, FAILURE, RETRY)
            - result: Optional[Any]
            - error: Optional[str]

    Example:
        status = get_task_status("task-id-123")
        if status["state"] == "SUCCESS":
            result = status["result"]
    """
    from celery.result import AsyncResult

    task = AsyncResult(task_id, app=celery_app)

    return {
        "state": task.state,
        "result": task.result if task.successful() else None,
        "error": str(task.info) if task.failed() else None,
        "ready": task.ready(),
    }


__all__ = [
    "parse_pdf_task",
    "extract_positions_task",
    "get_task_status",
]
