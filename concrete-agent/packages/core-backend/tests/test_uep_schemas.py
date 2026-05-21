"""
Schema validation tests for `app.models.uep_schemas`.

These guard the universal contract that every PR1 extractor and the
coverage engine depend on. If any field name / enum value drifts, these
fail before downstream tests do — same pattern as `test_imports.py`.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.uep_schemas import (
    CoverageCategoryReport,
    CoverageReport,
    CoverageRequirement,
    CoverageStatus,
    ExtractedFact,
    PerSourceExtraction,
    SourceFormat,
    SourceProvenance,
)


def test_source_format_pr1_values_present() -> None:
    """PR1 only handles DXF + PDF_TZ; the enum must expose both."""
    assert SourceFormat.DXF.value == "dxf"
    assert SourceFormat.PDF_TZ.value == "pdf_tz"


def test_source_format_pr3_placeholders_present() -> None:
    """PR3 formats are declared (placeholders) so coverage matrix YAML
    can reference them without an import error today."""
    for value in ("dwg", "ifc", "xml_unixml", "xml_landxml", "xml_gbxml"):
        assert SourceFormat(value)


def test_source_provenance_requires_extractor_name() -> None:
    """The extractor identifier is mandatory — task §1.2: every fact must
    have source attribution, which includes which extractor produced it."""
    with pytest.raises(ValidationError):
        SourceProvenance(source_file="foo.dxf", source_format=SourceFormat.DXF)


def test_extracted_fact_confidence_bounds() -> None:
    """Confidence is bounded 0..1 per `ge=0.0, le=1.0`."""
    with pytest.raises(ValidationError):
        ExtractedFact(category="x", field="y", value=1, confidence=1.5)
    with pytest.raises(ValidationError):
        ExtractedFact(category="x", field="y", value=1, confidence=-0.1)
    ExtractedFact(category="x", field="y", value=1, confidence=0.0)
    ExtractedFact(category="x", field="y", value=1, confidence=1.0)


def test_per_source_extraction_serialises_to_json() -> None:
    """Pydantic must JSON-serialise the full record incl. numpy-style
    floats from the DXF extractor (the engine smoke uses model_dump_json)."""
    prov = SourceProvenance(
        source_file="foo.dxf",
        source_format=SourceFormat.DXF,
        extractor="uep.dxf_extractor",
    )
    extraction = PerSourceExtraction(
        provenance=prov,
        confidence=0.9,
        facts=[ExtractedFact(category="dxf_meta", field="entity_count_total", value=42)],
    )
    json_str = extraction.model_dump_json()
    assert "entity_count_total" in json_str
    assert "uep.dxf_extractor" in json_str


def test_coverage_requirement_defaults_to_residential() -> None:
    """When YAML omits `project_types`, the requirement defaults to
    `["residential"]` — matrix YAML relies on this for terseness."""
    req = CoverageRequirement(category="x", label_cs="X")
    assert req.project_types == ["residential"]
    assert req.optional is False
    assert req.required_fields == []
    assert req.expected_sources == []


def test_coverage_status_enum_czech() -> None:
    """Status uses Czech values per existing repo convention."""
    assert CoverageStatus.POKRYTO.value == "pokryto"
    assert CoverageStatus.CASTECNE.value == "castecne"
    assert CoverageStatus.CHYBI.value == "chybi"
    assert CoverageStatus.SKIP.value == "skip"


def test_coverage_report_gate_passed_logic() -> None:
    """Gate releases iff `blocking_gaps` is empty — direct from method."""
    report_pass = CoverageReport(
        project_type="residential",
        matrix_file="x.yaml",
        blocking_gaps=[],
    )
    assert report_pass.gate_passed() is True

    report_block = CoverageReport(
        project_type="residential",
        matrix_file="x.yaml",
        blocking_gaps=["concrete_grade"],
    )
    assert report_block.gate_passed() is False


def test_coverage_category_report_required_minimum_fields() -> None:
    """Status + category + label_cs must be present (Pydantic v2)."""
    cat = CoverageCategoryReport(
        category="foo",
        label_cs="Foo",
        status=CoverageStatus.POKRYTO,
    )
    assert cat.fact_count == 0
    assert cat.contributing_sources == []
    assert cat.filled_fields == []
