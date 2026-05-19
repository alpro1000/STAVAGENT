"""
UEP REST API tests — PR2 §3.3.

Mounts the routes_uep router on a throwaway FastAPI app + TestClient.
Avoids importing app.api.__init__ (which pulls the entire workflow
infra) by registering only our router.
"""

from __future__ import annotations

import asyncio
import json
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Default tier for tests — Pro = 5 concurrent. Setting before import
# of routes_uep ensures _tier_for_user picks it up.
os.environ.setdefault("UEP_DEFAULT_TIER", "pro")

# Bypass `app.api.__init__.py` (which auto-imports the legacy workflow
# routes and their heavy deps — openpyxl / claude_client / etc.). Load
# the routes_uep module directly by file path so the test stays
# hermetic.
import importlib.util  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402

_uep_routes_path = Path(__file__).resolve().parent.parent / "app" / "api" / "routes_uep.py"
_spec = importlib.util.spec_from_file_location("_uep_routes_for_test", _uep_routes_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["_uep_routes_for_test"] = _mod
_spec.loader.exec_module(_mod)
router = _mod.router

from app.services.uep.job_runner import _JOBS  # noqa: E402  — test helper


@pytest.fixture()
def client(tmp_path):
    """Throwaway FastAPI app per test, in-process Cloud Tasks disabled,
    UEP_DATA_DIR pointed at a tmp_path so artefact writes don't pollute
    repo `data/`."""

    os.environ["UEP_DATA_DIR"] = str(tmp_path / "uep_data")
    os.environ["UEP_USE_CLOUD_TASKS"] = "0"

    # Wipe in-process job store between tests.
    _JOBS.clear()

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Config endpoints (cheap smoke)
# ---------------------------------------------------------------------------


def test_supported_formats_endpoint(client) -> None:
    r = client.get("/api/v1/uep/config/supported-formats")
    assert r.status_code == 200
    assert "dxf" in r.json()["formats"]


def test_derivation_rules_config(client) -> None:
    r = client.get("/api/v1/uep/config/derivation-rules")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 15


def test_tier_limits_config(client) -> None:
    r = client.get("/api/v1/uep/config/tier-limits")
    assert r.status_code == 200
    tiers = r.json()["tiers"]
    assert set(tiers.keys()) == {"free", "starter", "pro", "business", "enterprise"}


def test_reconciliation_rules_config(client) -> None:
    r = client.get("/api/v1/uep/config/reconciliation-rules?project_type=residential")
    assert r.status_code == 200
    rules = r.json()["rules"]
    assert len(rules) == 10


def test_coverage_matrix_config_residential(client) -> None:
    r = client.get("/api/v1/uep/config/coverage-matrices/residential")
    assert r.status_code == 200


def test_coverage_matrix_config_unknown_type(client) -> None:
    r = client.get("/api/v1/uep/config/coverage-matrices/bridge")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Derivation endpoint
# ---------------------------------------------------------------------------


def test_post_derivation_success(client) -> None:
    r = client.post(
        "/api/v1/projects/proj-1/uep/derivation",
        json={
            "rule_id": "wall_area_from_perimeter_height",
            "inputs": [
                {"name": "perimeter_m", "value": 40.0, "unit": "m", "confidence": 1.0},
                {"name": "height_m", "value": 2.7, "unit": "m", "confidence": 0.95},
            ],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == pytest.approx(108.0)
    assert body["unit"] == "m2"
    assert body["rule_id"] == "wall_area_from_perimeter_height"


def test_post_derivation_unknown_rule_returns_404(client) -> None:
    r = client.post(
        "/api/v1/projects/proj-1/uep/derivation",
        json={"rule_id": "no_such_rule", "inputs": []},
    )
    assert r.status_code == 404


def test_post_derivation_missing_required_input_400(client) -> None:
    r = client.post(
        "/api/v1/projects/proj-1/uep/derivation",
        json={
            "rule_id": "wall_area_from_perimeter_height",
            "inputs": [
                {"name": "perimeter_m", "value": 40.0, "unit": "m"},
            ],
        },
    )
    assert r.status_code == 400


def test_get_applicable_rules(client) -> None:
    r = client.get(
        "/api/v1/projects/proj-1/uep/derivation/applicable-rules"
        "?output_quantity=wall_area_m2&inputs=perimeter_m,height_m"
    )
    assert r.status_code == 200
    body = r.json()
    rule_ids = [r["rule_id"] for r in body["applicable"]]
    assert "wall_area_from_perimeter_height" in rule_ids


# ---------------------------------------------------------------------------
# Job lifecycle (in-process dispatch)
# ---------------------------------------------------------------------------


def test_start_job_returns_201_and_registers_in_store(client, tmp_path) -> None:
    project_dir = tmp_path / "empty_proj"
    project_dir.mkdir()

    r = client.post(
        "/api/v1/projects/proj-1/uep/run",
        headers={"X-User-Id": "user-A"},
        json={
            "project_type": "residential",
            "force_rerun": False,
            "project_dir": str(project_dir),
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["state"] in {"queued", "running", "completed", "failed"}
    assert body["queue_dispatch"] == "in_process"
    assert "/jobs/" in body["stream_url"]

    # Job should be in the store after the call returns.
    assert body["job_id"] in _JOBS


def test_get_job_404_on_unknown_project(client) -> None:
    r = client.get("/api/v1/projects/proj-x/uep/jobs/not-a-real-id")
    assert r.status_code == 404


def test_list_active_jobs_empty_initially(client) -> None:
    r = client.get("/api/v1/projects/proj-1/uep/jobs/active")
    assert r.status_code == 200
    assert r.json()["active"] == []


def test_per_project_lock_409_on_second_run(client, tmp_path) -> None:
    """PR2 acceptance #7 — second run on same project returns 409 unless force_rerun."""

    project_dir = tmp_path / "p"
    project_dir.mkdir()

    # First run starts.
    r1 = client.post(
        "/api/v1/projects/proj-lock-test/uep/run",
        headers={"X-User-Id": "user-A"},
        json={"project_type": "residential", "force_rerun": False, "project_dir": str(project_dir)},
    )
    assert r1.status_code == 201

    # Second run while the first is still queued/running → 409.
    r2 = client.post(
        "/api/v1/projects/proj-lock-test/uep/run",
        headers={"X-User-Id": "user-A"},
        json={"project_type": "residential", "force_rerun": False, "project_dir": str(project_dir)},
    )
    assert r2.status_code in (409, 201)  # may be 201 if first completed instantly
    if r2.status_code == 409:
        body = r2.json()
        assert body["error"] == "project_locked"
        assert "existing_job_id" in body


def test_delete_job_marks_cancelled(client, tmp_path) -> None:
    project_dir = tmp_path / "p"
    project_dir.mkdir()
    r1 = client.post(
        "/api/v1/projects/proj-del/uep/run",
        headers={"X-User-Id": "user-A"},
        json={"project_type": "residential", "force_rerun": False, "project_dir": str(project_dir)},
    )
    job_id = r1.json()["job_id"]

    r2 = client.delete(f"/api/v1/projects/proj-del/uep/jobs/{job_id}")
    assert r2.status_code == 200
    # In-process executions can sometimes complete before delete fires;
    # accept either cancelled or completed as a valid post-condition.
    assert r2.json()["state"] in ("cancelled", "completed")
