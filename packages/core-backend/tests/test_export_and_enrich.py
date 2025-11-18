import types
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.position_enricher import PositionEnricher
from app.services.workflow_a import _classify_position
from app.utils.audit_contracts import build_audit_contract


def _build_audit_payload(positions):
    return build_audit_contract(
        positions,
        classify=_classify_position,
    )


def test_export_contract_not_empty():
    sample_positions = [
        {"validation_status": "ok", "enrichment": {"match": "exact"}},
        {"validation_status": "ok", "enrichment": {"match": "partial"}},
        {"validation_status": "failed", "enrichment": {"match": "none"}},
    ]

    audit = _build_audit_payload(sample_positions)
    assert audit["totals"]["total"] > 0
    assert {"totals", "items", "meta"} <= set(audit.keys())
    assert audit["totals"]["g"] == 1
    assert audit["totals"]["a"] == 1
    assert audit["totals"]["r"] == 1


def test_classification_logic_examples():
    red = {"validation_status": "failed"}
    exact = {"validation_status": "ok", "enrichment": {"match": "exact"}}
    partial = {"validation_status": "ok", "enrichment": {"match": "partial"}}
    none = {"validation_status": "ok", "enrichment": {"match": "none"}}

    assert _classify_position(red) == "RED"
    assert _classify_position(exact) == "GREEN"
    assert _classify_position(partial) == "AMBER"
    assert _classify_position(none) == "RED"


def test_enrichment_optional_no_kb():
    empty_kb = types.SimpleNamespace(kb_b1={})
    enricher = PositionEnricher(enabled=True, kb_loader=empty_kb)
    enriched, _ = enricher.enrich([{"description": "", "unit": "m3"}], drawing_payload=[])
    match = enriched[0]["enrichment"]["match"]
    assert match in {"none", "partial", "exact"}
