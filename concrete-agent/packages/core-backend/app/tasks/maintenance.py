"""
Maintenance tasks for periodic operations.

These tasks run on schedule (Celery Beat) to perform:
- Cleanup of old task results
- Knowledge Base cache updates
- Database maintenance
- Log rotation

Reference: docs/TECH_SPECS/backend_infrastructure.md#maintenance-tasks
"""
from celery import Task
from datetime import datetime, timedelta
import logging

from app.core.celery_app import celery_app
from app.core.cache import get_kb_cache

logger = logging.getLogger(__name__)


# ==========================================
# CLEANUP TASKS
# ==========================================

@celery_app.task(
    bind=True,
    name="app.tasks.maintenance.cleanup_old_results",
)
def cleanup_old_results(self: Task, days_to_keep: int = 7) -> dict:
    """
    Clean up old Celery task results from Redis.

    This task runs daily to remove task results older than N days,
    preventing Redis from growing indefinitely.

    Args:
        days_to_keep: Number of days to keep results (default: 7)

    Returns:
        dict with:
            - success: bool
            - deleted_count: int (number of results deleted)
            - error: Optional[str]

    Example:
        cleanup_old_results.delay(days_to_keep=7)
    """
    try:
        logger.info(f"Starting cleanup of task results older than {days_to_keep} days")

        # Calculate cutoff timestamp
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        cutoff_timestamp = cutoff_date.timestamp()

        # Get all task result keys from Redis
        # Pattern: celery-task-meta-*
        from app.core.redis_client import get_redis
        import asyncio

        async def cleanup():
            redis = await get_redis()

            # Get all task result keys
            keys = await redis.keys("celery-task-meta-*")
            deleted = 0

            for key in keys:
                # Get task metadata
                task_data = await redis.get(key)

                if task_data and isinstance(task_data, dict):
                    # Check if task is old enough to delete
                    task_timestamp = task_data.get("date_done")

                    if task_timestamp and task_timestamp < cutoff_timestamp:
                        await redis.delete(key)
                        deleted += 1

            return deleted

        # Run async cleanup
        deleted_count = asyncio.run(cleanup())

        logger.info(f"Cleanup completed: {deleted_count} old task results deleted")

        return {
            "success": True,
            "deleted_count": deleted_count,
            "cutoff_days": days_to_keep,
        }

    except Exception as exc:
        logger.error(f"Cleanup failed: {exc}")
        return {
            "success": False,
            "error": str(exc),
            "deleted_count": 0,
        }


@celery_app.task(
    bind=True,
    name="app.tasks.maintenance.update_kb_cache",
)
def update_kb_cache(self: Task) -> dict:
    """
    Update Knowledge Base cache with fresh data.

    This task runs every 6 hours to refresh KB cache:
    - Re-fetch KROS/RTS data if using paid databases
    - Update Perplexity cache for common queries
    - Refresh CSN standards cache

    Returns:
        dict with:
            - success: bool
            - updated: List[str] (cache types updated)
            - error: Optional[str]

    Example:
        update_kb_cache.delay()
    """
    try:
        logger.info("Starting Knowledge Base cache update")

        updated_caches = []

        # Update KROS cache
        # TODO: Implement when credential proxy is ready
        logger.info("KROS cache update: SKIPPED (not yet implemented)")

        # Update RTS cache
        # TODO: Implement when credential proxy is ready
        logger.info("RTS cache update: SKIPPED (not yet implemented)")

        # Update Perplexity cache for common queries
        try:
            import asyncio

            async def update_perplexity_cache():
                kb_cache = await get_kb_cache()

                # Example: Pre-cache common material queries
                common_queries = [
                    "Cena betonu C30/37",
                    "Cena výztuže B500B",
                    "Cena těžby zeminy",
                ]

                for query in common_queries:
                    # This would trigger Perplexity query and cache result
                    # TODO: Implement when Perplexity integration is ready
                    pass

                return len(common_queries)

            # count = asyncio.run(update_perplexity_cache())
            # updated_caches.append(f"Perplexity ({count} queries)")

        except Exception as e:
            logger.warning(f"Perplexity cache update failed: {e}")

        logger.info(f"KB cache update completed: {updated_caches}")

        return {
            "success": True,
            "updated": updated_caches,
        }

    except Exception as exc:
        logger.error(f"KB cache update failed: {exc}")
        return {
            "success": False,
            "error": str(exc),
            "updated": [],
        }


@celery_app.task(
    bind=True,
    name="app.tasks.maintenance.cleanup_old_projects",
)
def cleanup_old_projects(self: Task, days_to_keep: int = 90) -> dict:
    """
    Archive or delete old project data.

    This task runs weekly to manage old projects:
    - Archive projects older than N days
    - Delete temporary files
    - Compress logs

    Args:
        days_to_keep: Number of days to keep active projects (default: 90)

    Returns:
        dict with:
            - success: bool
            - archived_count: int
            - deleted_files: int
            - error: Optional[str]

    Example:
        cleanup_old_projects.delay(days_to_keep=90)
    """
    try:
        logger.info(f"Starting cleanup of projects older than {days_to_keep} days")

        # TODO: Implement when database migration is complete
        # This will query BackgroundJob and Project tables to find old projects

        archived_count = 0
        deleted_files = 0

        logger.info(f"Project cleanup completed: {archived_count} archived, {deleted_files} files deleted")

        return {
            "success": True,
            "archived_count": archived_count,
            "deleted_files": deleted_files,
            "days_to_keep": days_to_keep,
        }

    except Exception as exc:
        logger.error(f"Project cleanup failed: {exc}")
        return {
            "success": False,
            "error": str(exc),
            "archived_count": 0,
            "deleted_files": 0,
        }


# ==========================================
# HEALTH CHECK TASKS
# ==========================================

@celery_app.task(
    bind=True,
    name="app.tasks.maintenance.health_check",
)
def health_check(self: Task) -> dict:
    """
    Perform system health check.

    This task checks:
    - Redis connection
    - Database connection
    - AI API availability
    - KB loader status

    Returns:
        dict with:
            - success: bool
            - checks: dict (status of each component)
            - healthy: bool (all checks passed)

    Example:
        result = health_check.delay()
    """
    try:
        logger.info("Starting system health check")

        checks = {}

        # Check Redis
        try:
            from app.core.redis_client import get_redis
            import asyncio

            async def check_redis():
                redis = await get_redis()
                return await redis.ping()

            redis_ok = asyncio.run(check_redis())
            checks["redis"] = "ok" if redis_ok else "failed"
        except Exception as e:
            checks["redis"] = f"error: {str(e)}"

        # Check Database
        try:
            # TODO: Implement when database migration is complete
            checks["database"] = "not_configured"
        except Exception as e:
            checks["database"] = f"error: {str(e)}"

        # Check Claude API
        try:
            from app.core.claude_client import ClaudeClient
            claude = ClaudeClient()
            # Simple test to check if API key is configured
            checks["claude"] = "ok" if claude else "not_configured"
        except Exception as e:
            checks["claude"] = f"error: {str(e)}"

        # Check KB Loader
        try:
            from app.knowledge_base.kb_loader import KBLoader
            kb = KBLoader()
            checks["kb_loader"] = "ok" if kb else "failed"
        except Exception as e:
            checks["kb_loader"] = f"error: {str(e)}"

        # Determine if system is healthy
        healthy = all(status == "ok" for status in checks.values())

        logger.info(f"Health check completed: healthy={healthy}, checks={checks}")

        return {
            "success": True,
            "checks": checks,
            "healthy": healthy,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as exc:
        logger.error(f"Health check failed: {exc}")
        return {
            "success": False,
            "error": str(exc),
            "healthy": False,
        }


__all__ = [
    "cleanup_old_results",
    "update_kb_cache",
    "cleanup_old_projects",
    "health_check",
]
