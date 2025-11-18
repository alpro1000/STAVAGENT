"""Unit tests for audit counter propagation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.workflow_a import WorkflowA
from app.state.project_store import project_store


def test_project_store_counters_follow_audit(tmp_path):
    project_store.clear()
    workflow = WorkflowA.__new__(WorkflowA)

    project_id = "counter-sync-test"
    audit_payload = {
        "totals": {"g": 0, "a": 47, "r": 6, "total": 10},
        "items": [],
        "preview": [],
        "meta": {
            "enrichment": {"matched": 0, "partial": 3},
            "validation": {"warning": 2, "failed": 1},
            "schema_validation": {"validated_total": 10},
            "audit": {"green": 0, "amber": 47, "red": 6},
        },
    }

    uploads = {"files_by_type": {}, "missing_files": []}
    workflow._update_project_store_after_audit(  # type: ignore[attr-defined]
        project_id=project_id,
        cache_path=Path(tmp_path),
        uploads=uploads,
        audit_payload=audit_payload,
        enable_enrichment=True,
        parsing_diagnostics={"raw_total": 10},
        drawing_diagnostics={"files_processed": 0},
    )

    project = project_store[project_id]

    assert project["amber_count"] == 47
    assert project["red_count"] == 6
    assert project["green_count"] == 0
    assert project["summary"] == {
        "positions_total": 10,
        "green": 0,
        "amber": 47,
        "red": 6,
    }
    assert project["diagnostics"]["audit"] == {"green": 0, "amber": 47, "red": 6}
    assert project["audit_results"]["meta"]["audit"] == {
        "green": 0,
        "amber": 47,
        "red": 6,
    }

    project_store.clear()
