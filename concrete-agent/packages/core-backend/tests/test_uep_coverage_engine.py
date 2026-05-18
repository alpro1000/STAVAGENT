"""
Coverage matrix engine algorithm tests.

Hermetic — no real files needed. Synthesises `PerSourceExtraction`
records with known fact streams and verifies the engine returns the
expected category status + gate verdict per task §3.2.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import (
    CoverageRequirement,
    CoverageStatus,
    ExtractedFact,
    PerSourceExtraction,
    SourceFormat,
    SourceProvenance,
)
from app.services.uep.coverage_engine import (
    evaluate_coverage,
    expected_format_diagnostics,
    load_matrix,
    matrix_path_for,
)


def _extraction(
    source_file: str,
    facts: list[ExtractedFact],
    *,
    source_format: SourceFormat = SourceFormat.DXF,
    extractor_error: str | None = None,
) -> PerSourceExtraction:
    return PerSourceExtraction(
        provenance=SourceProvenance(
            source_file=source_file,
            source_format=source_format,
            extractor=f"uep.{source_format.value}_extractor",
        ),
        confidence=0.0 if extractor_error else 0.9,
        facts=[] if extractor_error else facts,
        data={},
        extractor_error=extractor_error,
    )


def test_category_with_no_required_fields_passes_on_any_fact() -> None:
    """`required_fields=[]` → category POKRYTO if at least one fact in it."""
    req = CoverageRequirement(category="rooms", label_cs="Rooms")
    extraction = _extraction(
        "plan.dxf",
        [ExtractedFact(category="rooms", field="count", value=12)],
    )
    report = evaluate_coverage(
        [extraction], [req], project_type="residential", matrix_file="x.yaml"
    )
    assert report.categories[0].status == CoverageStatus.POKRYTO
    assert report.categories[0].fact_count == 1
    assert report.gate_passed() is True


def test_category_with_no_facts_marks_chybi() -> None:
    """No facts in category → CHYBI, blocking the gate when not optional."""
    req = CoverageRequirement(category="concrete_grade", label_cs="Concrete")
    extraction = _extraction(
        "plan.dxf",
        [ExtractedFact(category="layer_inventory", field="any", value=1)],
    )
    report = evaluate_coverage(
        [extraction], [req], project_type="residential", matrix_file="x.yaml"
    )
    assert report.categories[0].status == CoverageStatus.CHYBI
    assert "concrete_grade" in report.blocking_gaps
    assert report.gate_passed() is False


def test_optional_chybi_does_not_block_gate() -> None:
    """Optional categories with CHYBI status stay out of `blocking_gaps`."""
    req = CoverageRequirement(
        category="cooling_chl", label_cs="Chlazení", optional=True
    )
    extraction = _extraction(
        "plan.dxf",
        [ExtractedFact(category="layer_inventory", field="x", value=1)],
    )
    report = evaluate_coverage(
        [extraction], [req], project_type="residential", matrix_file="x.yaml"
    )
    assert report.categories[0].status == CoverageStatus.CHYBI
    assert report.blocking_gaps == []
    assert report.gate_passed() is True


def test_required_fields_partial_yields_castecne() -> None:
    """All required fields → POKRYTO; some present → CASTECNE; none → CHYBI."""
    req = CoverageRequirement(
        category="dxf_meta",
        label_cs="DXF meta",
        required_fields=["entity_count_total", "layer_count"],
    )
    half = _extraction(
        "plan.dxf",
        [ExtractedFact(category="dxf_meta", field="entity_count_total", value=7000)],
    )
    report = evaluate_coverage(
        [half], [req], project_type="residential", matrix_file="x.yaml"
    )
    cat = report.categories[0]
    assert cat.status == CoverageStatus.CASTECNE
    assert "entity_count_total" in cat.filled_fields
    assert "layer_count" in cat.missing_fields
    assert "dxf_meta" not in report.blocking_gaps  # CASTECNE doesn't block


def test_required_fields_all_present_yields_pokryto() -> None:
    req = CoverageRequirement(
        category="dxf_meta",
        label_cs="DXF meta",
        required_fields=["entity_count_total", "layer_count"],
    )
    full = _extraction(
        "plan.dxf",
        [
            ExtractedFact(category="dxf_meta", field="entity_count_total", value=7000),
            ExtractedFact(category="dxf_meta", field="layer_count", value=53),
        ],
    )
    report = evaluate_coverage(
        [full], [req], project_type="residential", matrix_file="x.yaml"
    )
    assert report.categories[0].status == CoverageStatus.POKRYTO
    assert report.gate_passed() is True


def test_multiple_sources_aggregate_per_category() -> None:
    """Facts from different files count toward the same category — the
    coverage gate sees the union."""
    req = CoverageRequirement(
        category="quantities",
        label_cs="Quantities",
        required_fields=["volume_m3", "area_m2"],
    )
    src1 = _extraction(
        "tz.pdf",
        [ExtractedFact(category="quantities", field="volume_m3", value=1200)],
        source_format=SourceFormat.PDF_TZ,
    )
    src2 = _extraction(
        "soupis.xlsx",
        [ExtractedFact(category="quantities", field="area_m2", value=4500)],
        source_format=SourceFormat.XLSX_SOUPIS,
    )
    report = evaluate_coverage(
        [src1, src2], [req], project_type="residential", matrix_file="x.yaml"
    )
    cat = report.categories[0]
    assert cat.status == CoverageStatus.POKRYTO
    assert set(cat.contributing_sources) == {"tz.pdf", "soupis.xlsx"}


def test_failed_extraction_does_not_silently_pass() -> None:
    """A file with `extractor_error` set contributes no facts but the
    report can still surface the file via the manifest (this engine
    surfaces it as zero contribution; coverage for required categories
    remains CHYBI, not POKRYTO)."""
    req = CoverageRequirement(category="rooms", label_cs="Rooms")
    failed = _extraction("scanned.pdf", [], extractor_error="ocr_required")
    report = evaluate_coverage(
        [failed], [req], project_type="residential", matrix_file="x.yaml"
    )
    assert report.categories[0].status == CoverageStatus.CHYBI
    # The contributing_sources list is empty because the failed file produced
    # zero facts — the failure is visible in the (separate) manifest.
    assert report.categories[0].contributing_sources == []


def test_bundled_residential_matrix_loads_and_has_expected_size() -> None:
    """The PR1 residential matrix must load via the loader."""
    path = matrix_path_for("residential")
    reqs = load_matrix(path, project_type="residential")
    # 38 categories per the committed YAML.
    assert len(reqs) == 38

    # Spot-check expected sources are typed properly.
    by_cat = {r.category: r for r in reqs}
    assert SourceFormat.PDF_TZ in by_cat["concrete_grade"].expected_sources
    assert SourceFormat.DXF in by_cat["layer_inventory"].expected_sources
    assert by_cat["cooling_chl"].optional is True
    assert by_cat["concrete_grade"].optional is False


def test_pokryto_pct_computation() -> None:
    """pokryto_pct is exact percentage rounded to 2 decimals."""
    reqs = [
        CoverageRequirement(category="a", label_cs="A"),
        CoverageRequirement(category="b", label_cs="B"),
        CoverageRequirement(category="c", label_cs="C"),
    ]
    one_fact_extraction = _extraction(
        "x.dxf",
        [
            ExtractedFact(category="a", field="f", value=1),
            ExtractedFact(category="b", field="f", value=1),
        ],
    )
    report = evaluate_coverage(
        [one_fact_extraction], reqs, project_type="residential", matrix_file="x.yaml"
    )
    assert report.pokryto_count == 2
    assert report.chybi_count == 1
    # 2 / 3 = 66.6666… → rounded to 66.67
    assert report.pokryto_pct == 66.67


def test_expected_format_diagnostics_flags_missing_pdf_tz() -> None:
    """Helper surfaces categories the upload format won't cover."""
    reqs = [
        CoverageRequirement(
            category="concrete_grade",
            label_cs="Concrete",
            expected_sources=[SourceFormat.PDF_TZ],
        ),
        CoverageRequirement(
            category="layer_inventory",
            label_cs="Layers",
            expected_sources=[SourceFormat.DXF, SourceFormat.DWG],
        ),
    ]
    diag = expected_format_diagnostics(reqs, available_formats={SourceFormat.DXF})
    assert "pdf_tz" in diag["missing_formats"]
    assert "concrete_grade" in diag["missing_formats"]["pdf_tz"]
    # DXF is available so layer_inventory category does NOT show up under missing.
    assert "layer_inventory" not in diag["missing_formats"].get("dxf", [])
