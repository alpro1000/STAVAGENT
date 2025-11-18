import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.audit_contracts import build_audit_contract, ensure_audit_contract


def test_audit_contract_roundtrip_from_positions():
    positions = [
        {
            "position_id": "001",
            "code": "123",
            "description": "Exact match",
            "unit": "m2",
            "quantity": 12.5,
            "audit": "GREEN",
            "validation_results": {"warnings": ["unit_check"]},
        },
        {
            "position_id": "002",
            "code": "",
            "description": "Needs attention",
            "unit": "kg",
            "quantity": "1\u202f200,5",
            "validation_results": {"errors": ["code_not_found_in_otskp"]},
            "notes": "manual review",
            "audit": "AMBER",
        },
    ]

    contract = build_audit_contract(
        positions,
        enrichment_stats={"matched": 1, "partial": 0},
        validation_stats={"warning": 1, "failed": 1},
        audit_stats={"green": 1, "amber": 1, "red": 0},
        schema_stats={"validated_total": 2},
        classify=lambda payload: payload.get("audit"),
    )

    assert contract["totals"] == {"g": 1, "a": 1, "r": 0, "total": 2}
    assert contract["items"][0]["status"] == "GREEN"
    assert contract["items"][1]["issues"]
    assert contract["meta"]["audit"] == {"green": 1, "amber": 1, "red": 0}

    roundtrip, changed = ensure_audit_contract(contract)
    assert not changed
    assert roundtrip == contract


def test_ensure_audit_contract_migrates_legacy():
    legacy_payload = {
        "positions": [
            {
                "position_id": "a-1",
                "code": "A1",
                "description": "Legacy row",
                "unit": "m",
                "quantity": 3,
                "classification": "AMBER",
                "validation_results": {"warnings": ["quantity_missing"]},
            }
        ],
        "total_positions": 1,
        "green": 0,
        "amber": 1,
        "red": 0,
        "enrichment_stats": {},
        "validation_stats": {"warning": 1},
        "schema_validation": {"validated_total": 1},
    }

    migrated, changed = ensure_audit_contract(legacy_payload)
    assert changed is True
    assert migrated["totals"] == {"g": 0, "a": 1, "r": 0, "total": 1}
    assert migrated["items"][0]["status"] == "AMBER"
    assert migrated["items"][0]["issues"]
