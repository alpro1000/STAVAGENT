import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.main import app
from app.services.project_cache import save_project_cache
from app.services.workflow_a import workflow_a
from app.state.project_store import project_store


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def artifact_project() -> str:
    project_store.clear()
    workflow_a._workflows.clear()

    project_id = "workflow-a-artifacts"

    audit_payload = {
        "totals": {"g": 1, "a": 1, "r": 0, "total": 2},
        "items": [
            {
                "code": "BET001",
                "description": "Beton základů C30/37",
                "unit": "m3",
                "quantity": 12.5,
                "status": "GREEN",
                "issues": [],
                "provenance": {
                    "position_id": "BET001",
                    "section": "SO-201",
                    "sheet": "Most - list 01",
                },
            },
            {
                "code": "ARM001",
                "description": "Armatura stěn B500B",
                "unit": "t",
                "quantity": 4.2,
                "status": "AMBER",
                "issues": ["partial match"],
                "provenance": {
                    "position_id": "ARM001",
                    "section": "SO-202",
                    "sheet": "Most - list 02",
                },
            },
        ],
        "preview": [],
        "meta": {
            "enrichment": {"matched": 1, "partial": 1, "unmatched": 0},
            "validation": {"passed": 1, "warning": 1},
            "audit": {"green": 1, "amber": 1, "red": 0},
            "schema_validation": {"validated_total": 2, "invalid_total": 0},
        },
    }

    parsing_diagnostics = {
        "documents_processed": 1,
        "raw_total": 2,
        "normalized_total": 2,
        "skipped_total": 0,
        "total_positions": 2,
    }

    drawing_summary = {
        "specifications": [
            {
                "id": "SPEC-1",
                "title": "Betonáž opěr",
                "standard": "ČSN 73 2400",
                "description": "Betonáž konstrukčních částí s krytím výztuže",
            },
            {
                "id": "SPEC-2",
                "title": "Armatura",
                "standard": "ČSN EN 10080",
                "description": "Použití oceli B500B pro mostní konstrukce",
            },
        ],
        "diagnostics": {
            "files_processed": 1,
            "specifications_found": 2,
            "page_states": {"good_text": 2, "encoded_text": 0, "image_only": 0},
        },
    }

    project_store[project_id] = {
        "project_id": project_id,
        "project_name": "Testovaný most",
        "workflow": "A",
        "file_locations": {},
        "files_metadata": [],
        "diagnostics": {"parsing": parsing_diagnostics},
        "audit_results": audit_payload,
    }

    cache_payload = {
        "project_id": project_id,
        "workflow": "A",
        "files": {},
        "diagnostics": {
            "parsing": parsing_diagnostics,
            "schema_validation": {"validated_total": 2, "invalid_total": 0},
            "enrichment": {"matched": 1, "partial": 1, "unmatched": 0},
            "validation": {"passed": 1, "warning": 1},
        },
        "audit_results": audit_payload,
        "drawing_specs": drawing_summary,
    }

    save_project_cache(project_id, cache_payload)

    yield project_id

    workflow_a._workflows.clear()
    project_store.clear()

    cache_path = settings.DATA_DIR / "projects" / f"{project_id}.json"
    if cache_path.exists():
        cache_path.unlink()

    curated_dir = settings.DATA_DIR / "curated" / project_id
    shutil.rmtree(curated_dir, ignore_errors=True)


def _curated_path(project_id: str, filename: str) -> Path:
    return settings.DATA_DIR / "curated" / project_id / filename


def test_workflow_a_tech_card_generation_and_caching(client: TestClient, artifact_project: str):
    project_id = artifact_project
    tech_path = _curated_path(project_id, "tech_card.json")
    if tech_path.exists():
        tech_path.unlink()

    response = client.get(f"/api/workflow-a/workflow/a/{project_id}/tech-card")
    assert response.status_code == 200
    tech_card = response.json()

    assert tech_card["type"] == "tech_card"
    assert "steps" in tech_card["data"]
    assert tech_path.exists()

    stored = json.loads(tech_path.read_text(encoding="utf-8"))
    assert stored["type"] == "tech_card"

    project_meta = project_store[project_id]
    assert "tech_card" in project_meta.get("artifacts", {})

    project_meta["artifacts"].pop("tech_card")
    second_response = client.get(f"/api/workflow-a/workflow/a/{project_id}/tech-card")
    assert second_response.status_code == 200
    assert second_response.json() == stored


def test_workflow_a_resource_and_material_artifacts(client: TestClient, artifact_project: str):
    project_id = artifact_project

    resource_response = client.get(
        f"/api/workflow-a/workflow/a/{project_id}/resource-sheet"
    )
    assert resource_response.status_code == 200
    resource_sheet = resource_response.json()
    assert resource_sheet["type"] == "resource_sheet"
    assert _curated_path(project_id, "resource_sheet.json").exists()

    materials_response = client.get(
        f"/api/workflow-a/workflow/a/{project_id}/material-analysis"
    )
    assert materials_response.status_code == 200
    materials = materials_response.json()
    assert materials["type"] == "materials_detailed"
    assert _curated_path(project_id, "material_analysis.json").exists()

    project_meta = project_store[project_id]
    artifacts = project_meta.get("artifacts", {})
    assert "resource_sheet" in artifacts
    assert "material_analysis" in artifacts
