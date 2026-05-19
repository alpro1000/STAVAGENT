"""
Reconciliation engine tests — PR2 Phase 3.

Exercises evaluate_reconciliation() with in-memory PerSourceExtraction
fixtures. No I/O beyond the bundled residential YAML loader.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.reconciliation_schemas import (
    MatchStatus,
    OnMismatch,
    ReconciliationRule,
    ReconciliationRuleSet,
    Severity,
    Tolerance,
    ToleranceType,
)
from app.models.uep_schemas import (
    ExtractedFact,
    PerSourceExtraction,
    SourceFormat,
    SourceProvenance,
)
from app.services.uep import (
    evaluate_reconciliation,
    load_rules,
    rules_path_for,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mk_extraction(source_format: SourceFormat, facts: list[ExtractedFact]) -> PerSourceExtraction:
    return PerSourceExtraction(
        provenance=SourceProvenance(
            source_file=f"fixture.{source_format.value}",
            source_format=source_format,
            extractor=f"test.{source_format.value}",
            extractor_version="1.0",
        ),
        confidence=0.95,
        parse_duration_ms=1,
        facts=facts,
    )


def _mk_fact(category: str, field: str, value, confidence: float = 1.0):
    return ExtractedFact(
        category=category,
        field=field,
        value=value,
        unit=None,
        confidence=confidence,
        evidence={},
    )


# ---------------------------------------------------------------------------
# YAML load
# ---------------------------------------------------------------------------


def test_residential_yaml_loads_with_10_rules() -> None:
    p = rules_path_for("residential")
    assert p.exists()
    rs = load_rules(p, "residential")
    assert rs.project_type == "residential"
    assert len(rs.rules) == 10
    assert any(r.id == "geometry_room_area_agreement" for r in rs.rules)


def test_load_rules_rejects_project_type_mismatch(tmp_path: Path) -> None:
    p = tmp_path / "bad.yaml"
    p.write_text("version: 1\nproject_type: bridge\nrules: []\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_rules(p, "residential")


# ---------------------------------------------------------------------------
# Engine: confirmed match
# ---------------------------------------------------------------------------


def test_engine_confirmed_match_within_tolerance() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="test_pct",
                description="test percentage tolerance",
                left_source="dxf",
                right_source="pdf_tz",
                join_on="field",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.PERCENTAGE, value=2.0),
                severity=Severity.IMPORTANT,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.DXF, [_mk_fact("area", "room_101", 100.0)])
    right = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("area", "room_101", 101.5)])

    report = evaluate_reconciliation([left, right], rs)
    assert report.rules_evaluated == 1
    assert report.confirmed_count == 1
    assert report.conflict_count == 0
    assert report.matches[0].status == MatchStatus.CONFIRMED
    # 1.5 / 100 = 1.5 % → within 2 %.
    assert abs(report.matches[0].delta - 1.5) < 1e-6
    assert abs(report.matches[0].delta_pct - 1.5) < 1e-6


# ---------------------------------------------------------------------------
# Engine: conflict
# ---------------------------------------------------------------------------


def test_engine_conflict_critical_blocks_gate() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="test_critical",
                description="critical conflict blocks gate",
                left_source="dxf",
                right_source="pdf_tz",
                join_on="field",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.PERCENTAGE, value=2.0),
                on_mismatch=OnMismatch.FLAG_CONFLICT,
                severity=Severity.CRITICAL,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.DXF, [_mk_fact("area", "room_101", 100.0)])
    right = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("area", "room_101", 110.0)])

    report = evaluate_reconciliation([left, right], rs)
    assert report.conflict_count == 1
    assert report.confirmed_count == 0
    assert report.critical_conflicts == ["test_critical"]
    assert not report.gate_passed()
    assert report.matches[0].status == MatchStatus.CONFLICT
    assert report.matches[0].resolution and "flagged" in report.matches[0].resolution


# ---------------------------------------------------------------------------
# Engine: left_only / right_only
# ---------------------------------------------------------------------------


def test_engine_left_only_emits_match() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="test_left_only",
                description="left-only emission",
                left_source="dxf",
                right_source="pdf_tz",
                join_on="field",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.EXACT),
                severity=Severity.INFORMATIONAL,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.DXF, [_mk_fact("area", "room_999", 50.0)])
    right = _mk_extraction(SourceFormat.PDF_TZ, [])

    report = evaluate_reconciliation([left, right], rs)
    assert report.left_only_count == 1
    assert report.right_only_count == 0
    assert report.matches[0].status == MatchStatus.LEFT_ONLY
    assert report.matches[0].left_evidence is not None
    assert report.matches[0].right_evidence is None


def test_engine_right_only_emits_match() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="test_right_only",
                description="right-only emission",
                left_source="dxf",
                right_source="pdf_tz",
                join_on="field",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.EXACT),
                severity=Severity.INFORMATIONAL,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.DXF, [])
    right = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("area", "room_xx", 99.0)])

    report = evaluate_reconciliation([left, right], rs)
    assert report.left_only_count == 0
    assert report.right_only_count == 1
    assert report.matches[0].status == MatchStatus.RIGHT_ONLY


# ---------------------------------------------------------------------------
# Engine: exact match for strings
# ---------------------------------------------------------------------------


def test_engine_exact_match_strings() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="test_exact_str",
                description="concrete grade exact match",
                left_source="pdf_tz",
                right_source="dxf",
                join_on="category",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.EXACT),
                severity=Severity.CRITICAL,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("concrete_grade", "class", "C30/37")])
    right = _mk_extraction(SourceFormat.DXF, [_mk_fact("concrete_grade", "class", "C30/37")])
    report = evaluate_reconciliation([left, right], rs)
    assert report.confirmed_count == 1

    left2 = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("concrete_grade", "class", "C25/30")])
    right2 = _mk_extraction(SourceFormat.DXF, [_mk_fact("concrete_grade", "class", "C30/37")])
    report2 = evaluate_reconciliation([left2, right2], rs)
    assert report2.conflict_count == 1
    assert report2.critical_conflicts == ["test_exact_str"]


# ---------------------------------------------------------------------------
# Engine: passport_schema wildcard right + on_mismatch=passport_wins
# ---------------------------------------------------------------------------


def test_engine_passport_wins_on_mismatch() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="passport_wins_test",
                description="passport authoritative on mismatch",
                left_source="passport_schema",
                right_source="pdf_tz",
                join_on="category",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.EXACT),
                on_mismatch=OnMismatch.PASSPORT_WINS,
                severity=Severity.IMPORTANT,
            )
        ],
    )

    left = _mk_extraction(
        SourceFormat.PASSPORT_SCHEMA, [_mk_fact("concrete_grade", "class", "C35/45")]
    )
    right = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("concrete_grade", "class", "C30/37")])
    report = evaluate_reconciliation([left, right], rs)
    assert report.conflict_count == 1
    assert report.matches[0].resolution == "passport schema wins"


# ---------------------------------------------------------------------------
# Engine: dotted compare_field into nested value
# ---------------------------------------------------------------------------


def test_engine_dotted_compare_field() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="dotted_test",
                description="nested-value compare",
                left_source="dxf",
                right_source="xlsx_soupis",
                join_on="field",
                compare_field="value.sum_m2",
                tolerance=Tolerance(type=ToleranceType.PERCENTAGE, value=2.0),
                severity=Severity.IMPORTANT,
            )
        ],
    )

    left = _mk_extraction(
        SourceFormat.DXF,
        [
            ExtractedFact(
                category="closed_polygons",
                field="room_101",
                value={"sum_m2": 100.0, "count": 1},
                unit="m2",
                confidence=0.9,
                evidence={},
            )
        ],
    )
    right = _mk_extraction(
        SourceFormat.XLSX_SOUPIS,
        [
            ExtractedFact(
                category="quantities",
                field="room_101",
                value={"sum_m2": 101.0, "count": 1},
                unit="m2",
                confidence=1.0,
                evidence={},
            )
        ],
    )
    report = evaluate_reconciliation([left, right], rs)
    assert report.confirmed_count == 1
    assert abs(report.matches[0].delta - 1.0) < 1e-6


# ---------------------------------------------------------------------------
# Engine: wildcard source
# ---------------------------------------------------------------------------


def test_engine_wildcard_right_source_collects_from_any_format() -> None:
    rs = ReconciliationRuleSet(
        version=1,
        project_type="residential",
        rules=[
            ReconciliationRule(
                id="wildcard_test",
                description="left from pdf_tz, right from anywhere",
                left_source="pdf_tz",
                right_source="*",
                join_on="value",
                compare_field="value",
                tolerance=Tolerance(type=ToleranceType.EXACT),
                severity=Severity.INFORMATIONAL,
            )
        ],
    )

    left = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("ref", "doc", "C.03 situace")])
    right_a = _mk_extraction(SourceFormat.DXF, [_mk_fact("ref", "doc", "C.03 situace")])
    right_b = _mk_extraction(SourceFormat.PDF_TZ, [_mk_fact("ref", "doc", "C.04 situace")])

    report = evaluate_reconciliation([left, right_a, right_b], rs)
    # C.03 confirmed (left + right_a), C.04 right_only via the wildcard
    # picking up the PDF_TZ row's fact again.
    statuses = sorted(m.status.value for m in report.matches)
    assert "confirmed" in statuses
