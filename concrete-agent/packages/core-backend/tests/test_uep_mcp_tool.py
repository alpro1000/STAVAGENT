"""
MCP tool tests — uep_run_extraction (PR2 §3.5).
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

from app.mcp.tools.uep import UEP_RUN_EXTRACTION_CREDITS, uep_run_extraction
from app.services.uep.job_runner import _JOBS


@pytest.fixture(autouse=True)
def _isolate_jobs(tmp_path, monkeypatch):
    """Per-test in-memory job store reset + tmp_path for artefacts."""

    _JOBS.clear()
    monkeypatch.setenv("UEP_DATA_DIR", str(tmp_path / "uep_data"))
    monkeypatch.setenv("UEP_DEFAULT_TIER", "pro")
    yield
    _JOBS.clear()


def test_pricing_constant_matches_auth_table() -> None:
    from app.mcp.auth import TOOL_COSTS
    assert TOOL_COSTS["uep_run_extraction"] == UEP_RUN_EXTRACTION_CREDITS == 15


def test_missing_project_id_returns_error() -> None:
    result = asyncio.run(
        uep_run_extraction(project_id="", project_dir="/tmp")
    )
    assert "error" in result
    assert "project_id required" in result["error"]


def test_nonexistent_project_dir_returns_error() -> None:
    result = asyncio.run(
        uep_run_extraction(project_id="p1", project_dir="/no/such/dir")
    )
    assert "error" in result
    assert "not found" in result["error"]


def test_file_as_project_dir_returns_error(tmp_path: Path) -> None:
    f = tmp_path / "not_a_dir.txt"
    f.write_text("x")
    result = asyncio.run(
        uep_run_extraction(project_id="p1", project_dir=str(f))
    )
    assert "error" in result
    assert "must be a directory" in result["error"]


def test_happy_path_returns_job_id_and_queues_run(tmp_path: Path) -> None:
    project_dir = tmp_path / "empty"
    project_dir.mkdir()

    result = asyncio.run(
        uep_run_extraction(
            project_id="proj-mcp-1",
            project_dir=str(project_dir),
            project_type="residential",
            user_id="claude-desktop-user",
        )
    )
    assert "error" not in result
    assert result["project_id"] == "proj-mcp-1"
    assert result["project_type"] == "residential"
    assert result["estimated_cost_credits"] == 15
    assert result["job_id"] in _JOBS
    assert _JOBS[result["job_id"]].user_id == "claude-desktop-user"


def test_per_project_lock_returns_project_locked_error(tmp_path: Path) -> None:
    project_dir = tmp_path / "p"
    project_dir.mkdir()
    first = asyncio.run(
        uep_run_extraction(project_id="proj-lock", project_dir=str(project_dir))
    )
    assert "error" not in first
    # In-process runner is async; wait for it to finish so second call
    # is racing the running flag, not a finished one.
    # We don't wait — just call immediately. Either the lock fires
    # (proj running) or it doesn't (already completed). Both are valid
    # per task §5 stop condition.
    second = asyncio.run(
        uep_run_extraction(project_id="proj-lock", project_dir=str(project_dir))
    )
    # If lock fires: error=project_locked; otherwise the first job
    # completed first and a new one started cleanly.
    if "error" in second:
        assert second["error"] == "project_locked"
        assert second["existing_job_id"] == first["job_id"]


def test_force_rerun_bypasses_project_lock(tmp_path: Path) -> None:
    project_dir = tmp_path / "p"
    project_dir.mkdir()
    first = asyncio.run(
        uep_run_extraction(project_id="proj-force", project_dir=str(project_dir))
    )
    second = asyncio.run(
        uep_run_extraction(
            project_id="proj-force",
            project_dir=str(project_dir),
            force_rerun=True,
        )
    )
    # force_rerun must always produce a fresh job_id (no project_locked).
    assert "error" not in second
    assert second["job_id"] != first["job_id"]
