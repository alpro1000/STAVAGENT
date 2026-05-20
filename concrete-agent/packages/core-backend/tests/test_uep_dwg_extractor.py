"""DWG extractor wrapper tests — PR3 §3.1."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.uep.dwg_extractor import DwgExtractor


def _build_real_dxf_via_ezdxf(target: Path) -> None:
    import ezdxf
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (4, 0), (4, 3), (0, 3)], close=True, dxfattribs={"layer": "rooms"})
    target.parent.mkdir(parents=True, exist_ok=True)
    doc.saveas(str(target))


def _fake_oda_factory(dwg_stem: str):
    def _fake(_dwg, out_dir):
        _build_real_dxf_via_ezdxf(out_dir / f"{dwg_stem}.dxf")
        return True, "", 50
    return _fake


def test_dwg_extractor_oda_success_emits_dwg_converted_warning(tmp_path: Path) -> None:
    dwg = tmp_path / "input.dwg"
    dwg.write_bytes(b"FAKE_DWG" * 100)

    with patch(
        "app.services.uep.dwg_converter._run_oda",
        side_effect=_fake_oda_factory("input"),
    ):
        result = DwgExtractor().extract(dwg)

    assert result.extractor_error is None
    # Conversion trace + DXF parse warnings combined.
    codes = [w["code"] for w in result.decode_warnings]
    assert "dwg_converted" in codes
    # raw_data carries conversion metadata for audit replay.
    assert "dwg_conversion" in result.data
    assert result.data["dwg_conversion"]["source"] == "oda"
    assert result.data["dwg_conversion"]["confidence"] == 0.95
    # DXF facts present (closed_polygon from the LWPOLYLINE).
    assert any(f.category == "closed_polygons" for f in result.facts)


def test_dwg_extractor_caps_fact_confidence_at_conversion_confidence(tmp_path: Path) -> None:
    """LibreDWG path: fact confidence floored at 0.80."""

    dwg = tmp_path / "input.dwg"
    dwg.write_bytes(b"FAKE_DWG" * 100)

    def _fake_libredwg(_dwg, out_dxf):
        _build_real_dxf_via_ezdxf(out_dxf)
        return True, "", 50

    with patch(
        "app.services.uep.dwg_converter._run_oda",
        return_value=(False, "no oda", 1),
    ), patch(
        "app.services.uep.dwg_converter._run_libredwg",
        side_effect=_fake_libredwg,
    ):
        result = DwgExtractor().extract(dwg)

    assert result.extractor_error is None
    assert result.data["dwg_conversion"]["source"] == "libredwg"
    # Every fact's confidence ≤ 0.80.
    for f in result.facts:
        assert f.confidence <= 0.80, f"fact {f.category}/{f.field} = {f.confidence}"


def test_dwg_extractor_escalates_on_both_conversion_failure(tmp_path: Path) -> None:
    """Task constraint: NEVER silent drop. extractor_error must surface."""

    dwg = tmp_path / "input.dwg"
    dwg.write_bytes(b"FAKE_DWG" * 100)

    with patch(
        "app.services.uep.dwg_converter._run_oda",
        return_value=(False, "no oda", 1),
    ), patch(
        "app.services.uep.dwg_converter._run_libredwg",
        return_value=(False, "no libredwg", 1),
    ):
        result = DwgExtractor().extract(dwg)

    # The base class returns extractor_error + empty decode_warnings
    # on ExtractorError (it strips warnings collected pre-raise — a
    # base-class limitation, not relevant to the no-silent-drop
    # invariant). Surface check: extractor_error MUST carry the
    # DWG_CONVERSION_FAILED sentinel so the coverage report wires
    # the failure to the operator.
    assert result.extractor_error is not None
    assert "DWG_CONVERSION_FAILED" in result.extractor_error


def test_registry_routes_dwg_to_dwg_extractor(tmp_path: Path) -> None:
    """The registry must wire .dwg → DwgExtractor."""

    from app.services.uep.registry import detect_format, get_extractor
    from app.models.uep_schemas import SourceFormat

    p = tmp_path / "drawing.dwg"
    p.write_bytes(b"x")
    assert detect_format(p) == SourceFormat.DWG
    ex = get_extractor(p)
    assert isinstance(ex, DwgExtractor)
