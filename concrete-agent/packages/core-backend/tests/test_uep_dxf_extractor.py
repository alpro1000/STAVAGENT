"""
DXF extractor tests — synthetic fixtures + a real Jáchymov DXF when present.

Universal entity coverage is verified via a hand-built ezdxf doc so the
test is hermetic. The real-file pass is `xfail`-tolerant when the
test-data corpus is not vendored into the deployment image.
"""
from __future__ import annotations

from pathlib import Path

import ezdxf
import pytest

from app.services.uep import DxfExtractor

# Path to the Phase-0b reference DXF — present in dev checkout, may be
# absent in CI containers that don't sync test-data/. We skip rather
# than fail so the suite stays green on minimal images.
JACHYMOV_DPZ = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "test-data"
    / "RD_Jachymov_dum"
    / "inputs"
    / "vykresy_dxf"
    / "260219_dum"
    / "RD Jachymov dum _ DPZ _ 10.dxf"
)


def _make_minimal_dxf(path: Path) -> None:
    """Build a tiny DXF with one of every entity type the extractor handles."""
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()

    # Closed LWPOLYLINE (room outline).
    msp.add_lwpolyline(
        [(0, 0), (4, 0), (4, 3), (0, 3)],
        close=True,
        dxfattribs={"layer": "rooms"},
    )
    # Open LWPOLYLINE (wall axis).
    msp.add_lwpolyline(
        [(0, 0), (10, 0)],
        close=False,
        dxfattribs={"layer": "walls"},
    )
    # LINE (edge).
    msp.add_line((0, 0), (5, 5), dxfattribs={"layer": "edges"})

    # TEXT + MTEXT.
    msp.add_text("1.01", dxfattribs={"layer": "room_codes"}).set_placement((2, 1.5))
    msp.add_mtext("Tabulka místností\\P1.01 vstup", dxfattribs={"layer": "tables"})

    # Block + INSERT with ATTRIB.
    block = doc.blocks.new(name="DOOR_BLK")
    block.add_line((0, 0), (1, 0))
    block.add_attdef("DOOR_ID", (0, 0), dxfattribs={"prompt": "Door ID"})
    insert = msp.add_blockref(
        "DOOR_BLK",
        (5, 2),
        dxfattribs={"layer": "doors"},
    )
    insert.add_auto_attribs({"DOOR_ID": "D101"})

    # Dimension.
    msp.add_aligned_dim(
        p1=(0, 0),
        p2=(4, 0),
        distance=1.0,
        dxfattribs={"layer": "dims"},
    )

    doc.saveas(path)


def test_extractor_id_and_format() -> None:
    ex = DxfExtractor()
    assert ex.extractor_id == "uep.dxf_extractor"
    assert ex.source_format.value == "dxf"
    assert 0.0 < ex.default_confidence <= 1.0


def test_minimal_dxf_yields_universal_facts(tmp_path: Path) -> None:
    """Synthetic DXF exercises every PR1 facet — counts, polygons, blocks, text."""
    dxf_path = tmp_path / "min.dxf"
    _make_minimal_dxf(dxf_path)

    extraction = DxfExtractor().extract(dxf_path)
    assert extraction.extractor_error is None
    facts_by_cat: dict[str, list] = {}
    for f in extraction.facts:
        facts_by_cat.setdefault(f.category, []).append(f)

    # Universal categories that any DXF must produce.
    assert "dxf_meta" in facts_by_cat
    assert "layer_inventory" in facts_by_cat
    assert "closed_polygons" in facts_by_cat
    assert "open_polylines" in facts_by_cat
    assert "block_inventory" in facts_by_cat
    assert "text_inventory" in facts_by_cat

    # Closed room polygon area = 4 × 3 = 12 m² (we put DXF in metres).
    rooms_fact = next(f for f in facts_by_cat["closed_polygons"] if f.field == "rooms")
    assert rooms_fact.value["count"] == 1
    assert abs(rooms_fact.value["sum_m2"] - 12.0) < 0.001

    # Open polyline (wall) = 10 m segment + LINE 5√2 m.
    walls_fact = next(f for f in facts_by_cat["open_polylines"] if f.field == "walls")
    assert walls_fact.value["count"] == 1
    assert abs(walls_fact.value["sum_m"] - 10.0) < 0.001

    # Block inventory recorded a DOOR_BLK INSERT on layer "doors".
    door_fact = next(f for f in facts_by_cat["block_inventory"] if f.field == "DOOR_BLK")
    assert door_fact.value["count"] == 1
    assert door_fact.value["by_layer"]["doors"] == 1

    # Block attribs captured the DOOR_ID value.
    assert "block_attribs" in facts_by_cat
    attribs_fact = facts_by_cat["block_attribs"][0]
    sample = attribs_fact.evidence["sample"]
    assert any(a["tag"] == "DOOR_ID" and a["text"] == "D101" for a in sample)


def test_corrupt_dxf_surfaces_extractor_error(tmp_path: Path) -> None:
    """Garbage bytes → `extractor_error`, not silent skip."""
    bad = tmp_path / "junk.dxf"
    bad.write_bytes(b"not a real dxf at all")
    result = DxfExtractor().extract(bad)
    assert result.extractor_error is not None
    assert result.facts == []


@pytest.mark.skipif(
    not JACHYMOV_DPZ.exists(),
    reason="RD Jáchymov corpus not present in this checkout",
)
def _build_dxf_with_units(path: Path, insunits: int, scale_coords_to_mm: bool) -> None:
    """Build a tiny DXF with explicit `$INSUNITS` and coords either in
    metre-scale (e.g. 4 m × 3 m) or mm-scale (4000 × 3000).

    The PR1 verification §3.2 bug was: insunits=0 + coords in mm →
    extractor scaled by 1.0 → bbox came back as 4 722 × 1 687 m.
    """

    doc = ezdxf.new("R2018")
    factor = 1000.0 if scale_coords_to_mm else 1.0
    points = [
        (0, 0),
        (4 * factor, 0),
        (4 * factor, 3 * factor),
        (0, 3 * factor),
    ]
    doc.modelspace().add_lwpolyline(
        points, close=True, dxfattribs={"layer": "rooms"}
    )
    doc.modelspace().add_line(
        (0, 0), (10 * factor, 0), dxfattribs={"layer": "walls"}
    )
    doc.header["$INSUNITS"] = insunits
    doc.saveas(path)


def test_dxf_explicit_mm_units_no_heuristic(tmp_path: Path) -> None:
    """`$INSUNITS=4` (mm) — heuristic must NOT fire; scale 0.001 applied
    deterministically."""

    p = tmp_path / "explicit_mm.dxf"
    _build_dxf_with_units(p, insunits=4, scale_coords_to_mm=True)

    extraction = DxfExtractor().extract(p)
    assert extraction.extractor_error is None

    # No magnitude-inferred warning when units are explicit.
    inferred = [
        w for w in extraction.decode_warnings
        if w.get("code") == "inferred_units_from_magnitude"
    ]
    assert inferred == []

    bbox = extraction.data["bbox"]
    # bbox spans the LINE (0,0)→(10000,0) and the polyline; max x = 10000
    # mm → 10 m, max y = 3000 mm → 3 m.
    assert abs(bbox["width_m"] - 10.0) < 0.001
    assert abs(bbox["height_m"] - 3.0) < 0.001


def test_dxf_unitless_with_mm_coords_infers_mm(tmp_path: Path) -> None:
    """`$INSUNITS=0` + coords like 4000 / 3000 → must infer mm.

    Reproduces the PR1 verification finding: RD_Jachymov situace DXFs.
    With the fix, bbox is correctly 4 m × 3 m (not 4 000 × 3 000 m).
    """

    p = tmp_path / "unitless_mm_coords.dxf"
    _build_dxf_with_units(p, insunits=0, scale_coords_to_mm=True)

    extraction = DxfExtractor().extract(p)
    assert extraction.extractor_error is None

    inferred = [
        w for w in extraction.decode_warnings
        if w.get("code") == "inferred_units_from_magnitude"
    ]
    assert len(inferred) == 1
    assert inferred[0]["inferred_unit"] == "mm"
    assert inferred[0]["scale_to_m"] == 0.001

    # Combined bbox: x_max = 10000 mm (from line) → 10 m, y_max = 3000
    # mm (from polyline) → 3 m.
    bbox = extraction.data["bbox"]
    assert abs(bbox["width_m"] - 10.0) < 0.001
    assert abs(bbox["height_m"] - 3.0) < 0.001

    # dxf_meta entity_count_total carries the inferred unit too.
    meta = [
        f for f in extraction.facts
        if f.category == "dxf_meta" and f.field == "entity_count_total"
    ][0]
    assert meta.evidence["inferred_unit"] == "mm"
    assert meta.evidence["scale_to_m"] == 0.001


def test_dxf_unitless_with_metre_coords_infers_m(tmp_path: Path) -> None:
    """`$INSUNITS=0` + coords like 4 / 3 → must infer metres (small
    typical-building drawing in metres)."""

    p = tmp_path / "unitless_metre_coords.dxf"
    _build_dxf_with_units(p, insunits=0, scale_coords_to_mm=False)

    extraction = DxfExtractor().extract(p)
    assert extraction.extractor_error is None

    inferred = [
        w for w in extraction.decode_warnings
        if w.get("code") == "inferred_units_from_magnitude"
    ]
    assert len(inferred) == 1
    # Median |x| on {0, 4, 4, 0, 0, 0, 4, 0, 0, 0, 0, 0} sample is in
    # (1, 1000) → "m" (or "m_low_signal" when too many zeros dominate).
    assert inferred[0]["inferred_unit"] in ("m", "m_low_signal")
    assert inferred[0]["scale_to_m"] == 1.0

    bbox = extraction.data["bbox"]
    assert abs(bbox["width_m"] - 10.0) < 0.001  # line goes to (10, 0)


def test_real_jachymov_dxf_meets_baseline() -> None:
    """Reference: 7 476 entities, 53 layers, 61 block defs. Use ≥-bounds
    so cosmetic ArchiCAD updates don't break the test."""
    extraction = DxfExtractor().extract(JACHYMOV_DPZ)
    assert extraction.extractor_error is None

    meta = {f.field: f.value for f in extraction.facts if f.category == "dxf_meta"}
    assert meta["entity_count_total"] >= 1000
    assert meta["layer_count"] >= 20
    assert meta["block_definition_count"] >= 10

    # At least one closed polygon and one block — architectural drawing
    # always has those.
    closed = [f for f in extraction.facts if f.category == "closed_polygons"]
    blocks = [f for f in extraction.facts if f.category == "block_inventory"]
    assert closed, "expected closed polygons in DPZ architectural drawing"
    assert blocks, "expected INSERT blocks in DPZ architectural drawing"
