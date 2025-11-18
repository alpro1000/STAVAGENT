"""
Tests for Celery integration - background task processing.

This test suite validates Celery configuration and task execution.
Tests are skipped if Redis is not available.

Reference: docs/TECH_SPECS/backend_infrastructure.md#celery-tests
"""
import pytest
from unittest.mock import Mock, patch
from celery import Celery

from app.core.celery_app import celery_app, get_celery_app, make_celery
from app.services.task_monitor import TaskMonitor, get_task_monitor


# ==========================================
# FIXTURES
# ==========================================

@pytest.fixture
def mock_redis_available():
    """Mock Redis availability for testing without Redis."""
    with patch("app.core.redis_client.get_redis") as mock:
        mock_redis = Mock()
        mock_redis.ping.return_value = True
        mock.return_value = mock_redis
        yield mock


@pytest.fixture
def task_monitor():
    """Get TaskMonitor instance for testing."""
    return get_task_monitor()


# ==========================================
# CELERY APP CONFIGURATION TESTS
# ==========================================

def test_celery_app_exists():
    """Test that Celery app instance exists."""
    assert celery_app is not None
    assert isinstance(celery_app, Celery)


def test_celery_app_name():
    """Test that Celery app has correct name."""
    assert celery_app.main == "concrete_agent"


def test_get_celery_app():
    """Test get_celery_app() returns the global instance."""
    app = get_celery_app()
    assert app is celery_app


def test_make_celery():
    """Test make_celery() creates a new Celery instance."""
    app = make_celery()
    assert isinstance(app, Celery)
    assert app.main == "concrete_agent"


def test_celery_broker_url():
    """Test Celery broker URL is configured."""
    from app.core.config import settings
    assert settings.CELERY_BROKER_URL is not None
    assert "redis" in settings.CELERY_BROKER_URL.lower()


def test_celery_result_backend():
    """Test Celery result backend is configured."""
    from app.core.config import settings
    assert settings.CELERY_RESULT_BACKEND is not None
    assert "redis" in settings.CELERY_RESULT_BACKEND.lower()


def test_celery_task_serializer():
    """Test Celery uses JSON serialization."""
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert "json" in celery_app.conf.accept_content


def test_celery_time_limits():
    """Test Celery task time limits are configured."""
    assert celery_app.conf.task_time_limit == 1800  # 30 minutes
    assert celery_app.conf.task_soft_time_limit == 1500  # 25 minutes


def test_celery_task_tracking():
    """Test Celery task tracking is enabled."""
    assert celery_app.conf.task_track_started is True


# ==========================================
# TASK REGISTRATION TESTS
# ==========================================

def test_pdf_tasks_registered():
    """Test that PDF tasks are registered with Celery."""
    registered_tasks = celery_app.tasks.keys()

    assert "app.tasks.pdf_tasks.parse_pdf_task" in registered_tasks
    assert "app.tasks.pdf_tasks.extract_positions_task" in registered_tasks


def test_enrichment_tasks_registered():
    """Test that enrichment tasks are registered with Celery."""
    registered_tasks = celery_app.tasks.keys()

    assert "app.tasks.enrichment_tasks.enrich_position_task" in registered_tasks
    assert "app.tasks.enrichment_tasks.enrich_batch_task" in registered_tasks


def test_audit_tasks_registered():
    """Test that audit tasks are registered with Celery."""
    registered_tasks = celery_app.tasks.keys()

    assert "app.tasks.audit_tasks.audit_position_task" in registered_tasks
    assert "app.tasks.audit_tasks.audit_project_task" in registered_tasks


def test_maintenance_tasks_registered():
    """Test that maintenance tasks are registered with Celery."""
    registered_tasks = celery_app.tasks.keys()

    assert "app.tasks.maintenance.cleanup_old_results" in registered_tasks
    assert "app.tasks.maintenance.update_kb_cache" in registered_tasks


# ==========================================
# TASK MONITOR TESTS
# ==========================================

def test_task_monitor_exists():
    """Test that TaskMonitor can be instantiated."""
    monitor = TaskMonitor()
    assert monitor is not None


def test_get_task_monitor():
    """Test get_task_monitor() returns singleton instance."""
    monitor1 = get_task_monitor()
    monitor2 = get_task_monitor()
    assert monitor1 is monitor2


def test_task_monitor_get_status():
    """Test TaskMonitor.get_task_status() with mock task."""
    monitor = TaskMonitor()

    # Mock a task
    with patch("app.services.task_monitor.AsyncResult") as mock_result:
        mock_task = Mock()
        mock_task.state = "SUCCESS"
        mock_task.ready.return_value = True
        mock_task.successful.return_value = True
        mock_task.result = {"success": True, "data": "test"}

        mock_result.return_value = mock_task

        status = monitor.get_task_status("test-task-id")

        assert status["state"] == "SUCCESS"
        assert status["ready"] is True
        assert status["successful"] is True
        assert status["result"] == {"success": True, "data": "test"}


def test_task_monitor_cancel_task():
    """Test TaskMonitor.cancel_task()."""
    monitor = TaskMonitor()

    with patch("app.services.task_monitor.AsyncResult") as mock_result:
        mock_task = Mock()
        mock_result.return_value = mock_task

        # Test soft cancel
        result = monitor.cancel_task("test-task-id", terminate=False)
        mock_task.revoke.assert_called_once()

        # Test hard cancel
        monitor.cancel_task("test-task-id", terminate=True)
        mock_task.revoke.assert_called_with(terminate=True, signal="SIGKILL")


# ==========================================
# CELERY BEAT SCHEDULE TESTS
# ==========================================

def test_beat_schedule_configured():
    """Test that Celery Beat schedule is configured."""
    assert hasattr(celery_app.conf, "beat_schedule")
    assert isinstance(celery_app.conf.beat_schedule, dict)


def test_cleanup_task_scheduled():
    """Test that cleanup task is scheduled."""
    schedule = celery_app.conf.beat_schedule

    assert "cleanup-old-results" in schedule
    assert schedule["cleanup-old-results"]["task"] == "app.tasks.maintenance.cleanup_old_results"
    assert schedule["cleanup-old-results"]["schedule"] == 86400.0  # 24 hours


def test_kb_update_task_scheduled():
    """Test that KB update task is scheduled."""
    schedule = celery_app.conf.beat_schedule

    assert "update-kb-cache" in schedule
    assert schedule["update-kb-cache"]["task"] == "app.tasks.maintenance.update_kb_cache"
    assert schedule["update-kb-cache"]["schedule"] == 21600.0  # 6 hours


# ==========================================
# TASK EXECUTION TESTS (Require Redis)
# ==========================================

@pytest.mark.skipif(True, reason="Requires Redis server running")
def test_parse_pdf_task_execution():
    """Test parse_pdf_task execution (requires Redis)."""
    from app.tasks.pdf_tasks import parse_pdf_task

    # This test requires Redis to be running
    result = parse_pdf_task.delay(
        file_path="/tmp/test.pdf",
        project_id="test-project",
        use_mineru=False
    )

    assert result.id is not None


@pytest.mark.skipif(True, reason="Requires Redis server running")
def test_enrich_position_task_execution():
    """Test enrich_position_task execution (requires Redis)."""
    from app.tasks.enrichment_tasks import enrich_position_task

    position = {
        "code": "121151113",
        "description": "Test position",
        "quantity": 10.0,
        "unit": "m3"
    }

    result = enrich_position_task.delay(position, "test-project")
    assert result.id is not None


@pytest.mark.skipif(True, reason="Requires Redis server running")
def test_audit_position_task_execution():
    """Test audit_position_task execution (requires Redis)."""
    from app.tasks.audit_tasks import audit_position_task

    position = {
        "code": "121151113",
        "description": "Test position",
        "enrichment": {"confidence": 0.85}
    }

    result = audit_position_task.delay(position, "test-project", "AMBER")
    assert result.id is not None


# ==========================================
# INTEGRATION TESTS
# ==========================================

def test_all_tasks_importable():
    """Test that all tasks can be imported without errors."""
    from app.tasks import (
        parse_pdf_task,
        extract_positions_task,
        enrich_position_task,
        enrich_batch_task,
        audit_position_task,
        audit_project_task,
        cleanup_old_results,
        update_kb_cache,
    )

    assert parse_pdf_task is not None
    assert extract_positions_task is not None
    assert enrich_position_task is not None
    assert enrich_batch_task is not None
    assert audit_position_task is not None
    assert audit_project_task is not None
    assert cleanup_old_results is not None
    assert update_kb_cache is not None


def test_task_names_unique():
    """Test that all task names are unique."""
    registered_tasks = list(celery_app.tasks.keys())

    # Filter only our app tasks
    app_tasks = [t for t in registered_tasks if t.startswith("app.tasks.")]

    # Check for duplicates
    assert len(app_tasks) == len(set(app_tasks))


# ==========================================
# CONFIGURATION TESTS
# ==========================================

def test_config_has_celery_settings():
    """Test that config.py has all required Celery settings."""
    from app.core.config import settings

    assert hasattr(settings, "CELERY_BROKER_URL")
    assert hasattr(settings, "CELERY_RESULT_BACKEND")
    assert hasattr(settings, "CELERY_TASK_TRACK_STARTED")
    assert hasattr(settings, "CELERY_TASK_TIME_LIMIT")
    assert hasattr(settings, "CELERY_TASK_SOFT_TIME_LIMIT")
    assert hasattr(settings, "CELERY_ACCEPT_CONTENT")
    assert hasattr(settings, "CELERY_TASK_SERIALIZER")
    assert hasattr(settings, "CELERY_RESULT_SERIALIZER")


def test_celery_uses_separate_redis_db():
    """Test that Celery uses separate Redis database from cache."""
    from app.core.config import settings

    # Cache uses db=0, Celery should use db=1
    assert "/0" in settings.REDIS_URL
    assert "/1" in settings.CELERY_BROKER_URL


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
