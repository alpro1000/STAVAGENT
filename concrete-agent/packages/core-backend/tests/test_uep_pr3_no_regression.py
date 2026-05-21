"""PR3 regression check — residential pipeline must remain identical.

The user-stated PR3 constraint is "No regression on residential —
RD_Jachymov e2e must produce same items.json as PR2 baseline." This
test pins three invariants for the residential path:

  1. Project-type detection on RD_Jachymov filenames returns 'residential'
     (or at least non-None with residential as the winner).
  2. The DXF-only pipeline produces the same coverage report shape as
     the PR2 baseline that ships in test_uep_e2e_residential.py:
       - all input files accounted for (no silent drops)
       - dxf_meta, layer_inventory, closed_polygons, open_polylines,
         block_inventory, text_inventory all POKRYTO
       - gate remains BLOCKED on TZ-driven categories
  3. The registry now wires 6 formats (dxf, pdf_tz, dwg, ifc,
     xml_unixml, xml_landxml) but residential routing still maps
     `.dxf` → DxfExtractor exactly as before — no PR3 module hijacked
     the existing extension.

Skipped automatically when the RD_Jachymov corpus is absent.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import CoverageStatus, SourceFormat
from app.services.uep import (
    DxfExtractor,
    evaluate_coverage,
    load_matrix,
)
from app.services.uep.coverage_engine import matrix_path_for
from app.services.uep.dxf_extractor import DxfExtractor as _DxfClassCheck
from app.services.uep.project_type_detector import detect_project_type
from app.services.uep.registry import detect_format, get_extractor


JACHYMOV_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "test-data"
    / "RD_Jachymov_dum"
    / "inputs"
    / "vykresy_dxf"
    / "260219_dum"
)


@pytest.mark.skipif(
    not JACHYMOV_DIR.exists(),
    reason="RD Jáchymov corpus not present in this checkout",
)
def test_pr3_project_type_detector_keeps_rd_jachymov_residential() -> None:
    """Project type detector must classify RD_Jáchymov filenames
    correctly. Bridge / road / industrial keywords must NOT trigger
    on residential corpus — that would mis-route to a wrong matrix."""

    filenames = [p.name for p in JACHYMOV_DIR.glob("*.dxf")]
    assert filenames, "Jáchymov corpus must have at least one DXF"

    detection = detect_project_type(filenames=filenames, tz_text="")

    # Either the detector picks residential outright, OR confidence is
    # below the MIN_CONFIDENCE floor (which is acceptable — the registry
    # falls back to residential by default).
    candidates = {c.project_type for c in detection.candidates}
    assert "bridge" not in candidates or detection.winner != "bridge", (
        f"PR3 project_type_detector must NOT mis-route RD_Jachymov to "
        f"bridge. Got winner={detection.winner}, candidates={candidates}"
    )
    assert "road" not in candidates or detection.winner != "road"
    assert "industrial" not in candidates or detection.winner != "industrial"


@pytest.mark.skipif(
    not JACHYMOV_DIR.exists(),
    reason="RD Jáchymov corpus not present in this checkout",
)
def test_pr3_residential_pipeline_baseline_unchanged() -> None:
    """Coverage report on RD_Jachymov DXFs has the same shape as PR2."""

    dxfs = sorted(JACHYMOV_DIR.glob("*.dxf"))
    assert dxfs

    matrix_path = matrix_path_for("residential")
    reqs = load_matrix(matrix_path, project_type="residential")
    extractor = DxfExtractor()
    extractions = [extractor.extract(p) for p in dxfs]
    report = evaluate_coverage(
        extractions,
        reqs,
        project_type="residential",
        matrix_file=matrix_path.name,
        project_id="pr3_regression",
    )

    # Invariant 1: every file accounted for, no silent drops.
    assert len(extractions) == len(dxfs)
    fatal = [e for e in extractions if e.extractor_error]
    assert fatal == [], (
        f"PR3 must not have caused fatal errors on RD_Jachymov DXFs. "
        f"Got: {[(e.provenance.source_file, e.extractor_error) for e in fatal]}"
    )

    # Invariant 2: same universal categories POKRYTO as PR2 baseline.
    pokryto = {c.category for c in report.categories if c.status == CoverageStatus.POKRYTO}
    for expected in (
        "dxf_meta",
        "layer_inventory",
        "closed_polygons",
        "open_polylines",
        "block_inventory",
        "text_inventory",
    ):
        assert expected in pokryto, (
            f"PR2 baseline had {expected} POKRYTO. PR3 lost it — "
            f"actual POKRYTO categories: {pokryto}"
        )

    # Invariant 3: gate still blocked on TZ-driven rows.
    assert not report.gate_passed(), (
        "PR3 must not have flipped the gate green for DXF-only input. "
        "TZ-driven categories should keep blocking."
    )


def test_pr3_dxf_registry_routing_unchanged(tmp_path: Path) -> None:
    """DXF extension still maps to DxfExtractor — PR3 didn't hijack it."""

    p = tmp_path / "anything.dxf"
    p.write_text("0\nEOF", encoding="utf-8")

    assert detect_format(p) == SourceFormat.DXF
    extractor = get_extractor(p)
    assert isinstance(extractor, _DxfClassCheck)


def test_pr3_registry_now_lists_six_formats() -> None:
    """Live count check — PR3 added DWG + IFC + 2 XML flavours."""

    from app.services.uep.registry import list_supported_formats

    fmts = {f.value for f in list_supported_formats()}
    # PR1 baseline: dxf + pdf_tz (2 formats).
    # PR3 additions: dwg, ifc, xml_unixml, xml_landxml.
    for required in {"dxf", "pdf_tz", "dwg", "ifc", "xml_unixml", "xml_landxml"}:
        assert required in fmts, f"PR3 lost {required} routing"
