"""
Background tasks for Concrete Agent.

This package contains all Celery tasks for asynchronous processing:
- PDF parsing (long operations)
- Position enrichment (batch processing)
- Audit execution (async AI calls)
- Maintenance tasks (cleanup, cache updates)

All tasks are automatically discovered by Celery app.

Reference: docs/TECH_SPECS/backend_infrastructure.md#celery-tasks
"""

# Import all tasks to register them with Celery
from app.tasks.pdf_tasks import (
    parse_pdf_task,
    extract_positions_task,
)
from app.tasks.enrichment_tasks import (
    enrich_position_task,
    enrich_batch_task,
)
from app.tasks.audit_tasks import (
    audit_position_task,
    audit_project_task,
)
from app.tasks.maintenance import (
    cleanup_old_results,
    update_kb_cache,
)

__all__ = [
    # PDF tasks
    "parse_pdf_task",
    "extract_positions_task",

    # Enrichment tasks
    "enrich_position_task",
    "enrich_batch_task",

    # Audit tasks
    "audit_position_task",
    "audit_project_task",

    # Maintenance tasks
    "cleanup_old_results",
    "update_kb_cache",
]
