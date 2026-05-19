"""
UEP end-to-end residential pipeline test.

Wires PR1 Phase-1 (DXF extractor) + Phase-2 (coverage matrix engine) and
verifies the contract holds on a real Jáchymov DXF when the corpus is
vendored. The test focuses on three invariants:

1. Every input file gets a `PerSourceExtraction` record (or an explicit
   `extractor_error`) — task §3.1 forbidden behaviour pin.
2. The DXF-derived universal categories (`dxf_meta`, `layer_inventory`,
   `closed_polygons`, `open_polylines`, `block_inventory`,
   `text_inventory`) all flip to POKRYTO on a real architectural DXF.
3. Gate correctly BLOCKS for DXF-only input because TZ-driven categories
   (concrete_grade, exposure_class, …) stay CHYBI — that's the whole
   point of the anti-omission matrix.

If the test-data corpus is absent (minimal CI image), the test skips.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import CoverageStatus
from app.services.uep import (
    DxfExtractor,
    evaluate_coverage,
    load_matrix,
)
from app.services.uep.coverage_engine import matrix_path_for


JACHYMOV_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "test-data"
    / "RD_Jachymov_dum"
    / "inputs"
    / "vykresy_dxf"
    / "260219_dum"
)

LIBUSE_HVAC_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "test-data"
    / "libuse"
    / "sources"
    / "D"
    / "dxf"
)


def _run_pipeline(dxf_files: list[Path]) -> tuple[list, object]:
    """Helper — extract every file, then evaluate the residential matrix."""
    matrix_path = matrix_path_for("residential")
    reqs = load_matrix(matrix_path, project_type="residential")
    extractor = DxfExtractor()
    extractions = [extractor.extract(p) for p in dxf_files]
    report = evaluate_coverage(
        extractions,
        reqs,
        project_type="residential",
        matrix_file=matrix_path.name,
        project_id="test_e2e",
    )
    return extractions, report


@pytest.mark.skipif(
    not JACHYMOV_DIR.exists(),
    reason="RD Jáchymov corpus not present in this checkout",
)
def test_e2e_jachymov_dxf_only_blocks_gate_via_missing_tz() -> None:
    """Phase-1 extracts architectural DXFs; Phase-2 correctly blocks the
    gate because no TZ was uploaded (project_identification, concrete_grade,
    etc. are CHYBI)."""
    dxfs = sorted(JACHYMOV_DIR.glob("*.dxf"))
    assert dxfs, "Jáchymov 260219_dum directory has DXFs"

    extractions, report = _run_pipeline(dxfs)

    # Invariant 1: every input got a record.
    assert len(extractions) == len(dxfs)
    fatal = [e for e in extractions if e.extractor_error]
    # All files in this corpus parse cleanly — no fatal errors expected.
    assert fatal == [], f"unexpected fatal errors: {[e.extractor_error for e in fatal]}"

    # Invariant 2: DXF-derived universal categories are POKRYTO.
    pokryto_cats = {c.category for c in report.categories if c.status == CoverageStatus.POKRYTO}
    for expected in (
        "dxf_meta",
        "layer_inventory",
        "closed_polygons",
        "open_polylines",
        "block_inventory",
        "text_inventory",
    ):
        assert expected in pokryto_cats, (
            f"category {expected} expected POKRYTO with DXF-only input, "
            f"got categories={pokryto_cats}"
        )

    # Invariant 3: gate is BLOCKED on TZ-driven categories.
    assert not report.gate_passed()
    blocking = set(report.blocking_gaps)
    for tz_cat in ("project_identification", "concrete_grade", "exposure_class", "norm_references"):
        assert tz_cat in blocking, (
            f"expected {tz_cat} in blocking_gaps for DXF-only input; "
            f"got {blocking}"
        )

    # Sanity: pokryto_pct is between 10 % and 50 % for DXF-only — exact
    # value depends on how many DXFs are in the corpus.
    assert 10.0 < report.pokryto_pct < 50.0, (
        f"pokryto_pct={report.pokryto_pct} outside reasonable DXF-only band"
    )


@pytest.mark.skipif(
    not LIBUSE_HVAC_DIR.exists() or not list(LIBUSE_HVAC_DIR.glob("*.dxf")),
    reason="Libuše objekt D HVAC corpus not present in this checkout",
)
def test_e2e_libuse_objekt_d_hvac_smoke() -> None:
    """Smoke: Libuše/objekt D ships only HVAC chl/vzt DXFs (architectural
    layouts are DWG-only and DWG is out of PR1 scope). The pipeline must
    not crash; coverage gate stays BLOCKED. This is the deliberate corpus
    deviation from task §10's nominal Libuše e2e — flagged in the open
    questions list, kept here as a smoke so the regression is visible."""
    dxfs = sorted(LIBUSE_HVAC_DIR.glob("*.dxf"))
    assert dxfs, "Libuše/objekt D dxf/ should contain HVAC DXFs"

    extractions, report = _run_pipeline(dxfs)

    # Every file accounted for, none fatally errored.
    assert len(extractions) == len(dxfs)
    assert not any(e.extractor_error for e in extractions), (
        f"unexpected fatal errors on Libuše HVAC DXFs: "
        f"{[(e.provenance.source_file, e.extractor_error) for e in extractions if e.extractor_error]}"
    )

    # Universal DXF facts present, gate still blocked (no TZ).
    pokryto_cats = {c.category for c in report.categories if c.status == CoverageStatus.POKRYTO}
    assert "layer_inventory" in pokryto_cats
    assert "dxf_meta" in pokryto_cats
    assert not report.gate_passed()
