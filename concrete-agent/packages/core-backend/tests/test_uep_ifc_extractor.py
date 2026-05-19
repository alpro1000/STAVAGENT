"""IFC extractor + streaming strategy tests — PR3 §3.2-3.3.

Most of these tests don't require ifcopenshell — they verify the
size-based strategy + reject-upfront invariants. The handful that
need a parsed IFC use a tiny in-memory mock.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.services.uep.extractor_base import ExtractorError
from app.services.uep.ifc_extractor import IfcExtractor
from app.services.uep.ifc_streaming import (
    IFC_REJECT_THRESHOLD_BYTES,
    PARTIAL_LIMIT_BYTES,
    RssAbortGuard,
    STANDARD_LIMIT_BYTES,
    STRICT_LIMIT_BYTES,
    StreamingStrategy,
    pick_streaming_strategy,
)


# ---------------------------------------------------------------------------
# Strategy selection
# ---------------------------------------------------------------------------


def test_strategy_standard_below_200mb() -> None:
    assert pick_streaming_strategy(100 * 1024 * 1024) == StreamingStrategy.STANDARD
    assert pick_streaming_strategy(STANDARD_LIMIT_BYTES) == StreamingStrategy.STANDARD


def test_strategy_partial_between_200mb_and_1gb() -> None:
    assert pick_streaming_strategy(500 * 1024 * 1024) == StreamingStrategy.PARTIAL
    assert pick_streaming_strategy(PARTIAL_LIMIT_BYTES) == StreamingStrategy.PARTIAL


def test_strategy_strict_between_1gb_and_2gb() -> None:
    assert pick_streaming_strategy(1_500_000_000) == StreamingStrategy.STRICT
    assert pick_streaming_strategy(STRICT_LIMIT_BYTES) == StreamingStrategy.STRICT


def test_strategy_reject_above_2gb() -> None:
    assert pick_streaming_strategy(STRICT_LIMIT_BYTES + 1) == StreamingStrategy.REJECT


# ---------------------------------------------------------------------------
# Reject upfront on giant file
# ---------------------------------------------------------------------------


def test_ifc_extractor_rejects_file_over_2gb(tmp_path: Path) -> None:
    p = tmp_path / "huge.ifc"
    p.write_bytes(b"x" * 16)
    with patch("pathlib.Path.stat") as m_stat:
        fake = MagicMock()
        fake.st_size = IFC_REJECT_THRESHOLD_BYTES + 1
        fake.st_mode = 0o100644  # IS_REG flag set
        m_stat.return_value = fake
        result = IfcExtractor().extract(p)
    assert result.extractor_error is not None
    assert "too large" in result.extractor_error.lower()


# ---------------------------------------------------------------------------
# Without ifcopenshell installed → clean error
# ---------------------------------------------------------------------------


def test_ifc_extractor_without_ifcopenshell_returns_clean_error(tmp_path: Path) -> None:
    p = tmp_path / "small.ifc"
    p.write_bytes(b"ISO-10303-21;\n")
    # Force the lazy-import to return None.
    with patch(
        "app.services.uep.ifc_extractor._try_import_ifcopenshell",
        return_value=None,
    ):
        result = IfcExtractor().extract(p)
    assert result.extractor_error is not None
    assert "ifcopenshell" in result.extractor_error.lower()


# ---------------------------------------------------------------------------
# Happy-path extraction with mocked IfcOpenShell
# ---------------------------------------------------------------------------


def _mock_ifc_model() -> MagicMock:
    """Build a fake IfcOpenShell model that returns a few entities per type."""

    model = MagicMock()
    model.schema = "IFC4"

    def _by_type(name: str):
        defs = {
            "IfcSite": [MagicMock(Name="Mladotice", GlobalId="gid_site")],
            "IfcBuilding": [MagicMock(Name="Most 2062-1", GlobalId="gid_b")],
            "IfcBuildingStorey": [MagicMock(Name="Mostovka", GlobalId="gid_s")],
            "IfcSpace": [MagicMock(Name="Pole 1", GlobalId="gid_sp1", LongName="")],
            "IfcWall": [MagicMock(Name="Wall1", GlobalId="gid_w")],
            "IfcSlab": [MagicMock(Name="Slab1", GlobalId="gid_sl")],
            "IfcBeam": [],
            "IfcColumn": [MagicMock(Name="Col1", GlobalId="gid_c")],
            "IfcFooting": [MagicMock(Name="Foot1", GlobalId="gid_f")],
            "IfcDoor": [MagicMock(Name="D1", GlobalId="gid_d")],
            "IfcWindow": [MagicMock(Name="W1", GlobalId="gid_win")],
            "IfcMaterial": [MagicMock(Name="C30/37")],
            "IfcWallStandardCase": [],
            "IfcQuantityArea": [MagicMock(AreaValue=125.5, Name="Area1")],
            "IfcQuantityVolume": [MagicMock(VolumeValue=42.7, Name="Vol1")],
            "IfcQuantityLength": [MagicMock(LengthValue=10.0, Name="Len1")],
            "IfcOwnerHistory": [MagicMock(CreationDate=1700000000, LastModifiedDate=1700001000)],
        }
        return iter(defs.get(name, []))

    model.by_type = _by_type
    return model


def test_ifc_extractor_emits_facts_across_all_categories(tmp_path: Path) -> None:
    p = tmp_path / "small.ifc"
    p.write_bytes(b"ISO-10303-21;\n")

    mock_module = MagicMock()
    mock_module.open = MagicMock(return_value=_mock_ifc_model())
    with patch(
        "app.services.uep.ifc_extractor._try_import_ifcopenshell",
        return_value=mock_module,
    ):
        result = IfcExtractor().extract(p)

    assert result.extractor_error is None, result.extractor_error
    categories = {f.category for f in result.facts}
    # Must cover all 8 v3 §15.3 categories where input had entities.
    expected = {
        "site_situation",
        "project_identification",
        "dimensions",
        "closed_polygons",
        "wall_system",
        "foundation_system",
        "windows_doors_specification",
        "quantities",
    }
    assert expected.issubset(categories), f"missing: {expected - categories}"

    # Quantity facts must carry exact values + units.
    qty_area = [f for f in result.facts if f.category == "quantities" and f.field == "area_m2"]
    assert qty_area and qty_area[0].value == pytest.approx(125.5)
    assert qty_area[0].unit == "m2"

    # Decode warnings include the chosen streaming strategy.
    codes = [w["code"] for w in result.decode_warnings]
    assert "ifc_streaming_strategy" in codes


# ---------------------------------------------------------------------------
# RssAbortGuard — no-op without psutil, sane lifecycle with it
# ---------------------------------------------------------------------------


def test_rss_guard_noop_when_psutil_missing() -> None:
    guard = RssAbortGuard()
    # Force psutil import to fail inside .start()
    with patch.dict("sys.modules", {"psutil": None}):
        guard.start()
        # Should not start a thread.
        assert guard._thread is None
        assert not guard.should_abort()
        guard.stop()
