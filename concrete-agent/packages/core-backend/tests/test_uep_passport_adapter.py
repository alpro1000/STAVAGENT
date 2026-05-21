"""
passport_schema bridge tests — PR2 §3.7.

The adapter is duck-typed against the MergedSO shape (Q12 = A read-only).
Tests use minimal in-process classes to avoid importing the entire
passport_schema bundle.
"""

from __future__ import annotations

from app.models.uep_schemas import SourceFormat
from app.services.uep import (
    merged_so_to_extraction,
    merged_sos_to_extractions,
)


class _TechStub:
    """Mimics passport_schema.TechnicalExtraction sufficiently for the adapter."""

    project_name = "Test most"
    structure_type = "mostni"
    structure_subtype = None
    total_length_m = 124.0
    width_m = 8.5
    height_m = None
    area_m2 = None
    volume_m3 = 256.0
    span_count = None
    span_lengths_m: list = []
    concrete_grade = "C30/37"
    reinforcement_grade = "B500B"
    foundation_type = None
    fabrication_method = None
    load_class = None
    design_life_years = None
    applicable_standards = ["ČSN EN 1990", "ČSN EN 1992-1-1"]
    construction_duration_months = None
    special_conditions: list = []
    source_pages: dict = {}


class _BridgeParams:
    """Mimics BridgeSOParams for quantities extraction."""

    concrete_volume_m3 = 245.6
    reinforcement_tons = 5.7


class _MergedStub:
    """Mimics passport_schema.MergedSO root."""

    so_code = "SO 201"
    so_name = "Mostní objekt"
    so_category = "mostní"
    technical = _TechStub()
    bridge_params: object = None
    construction_type = "mostní"
    d14_profession = None
    file_count = 5


# ---------------------------------------------------------------------------
# Adapter contract
# ---------------------------------------------------------------------------


def test_merged_so_to_extraction_emits_passport_provenance() -> None:
    ext = merged_so_to_extraction(_MergedStub())
    assert ext.provenance.source_format == SourceFormat.PASSPORT_SCHEMA
    assert ext.provenance.extractor == "uep.passport_adapter"
    assert ext.provenance.source_file == "SO 201"


def test_merged_so_facts_all_at_passport_confidence() -> None:
    ext = merged_so_to_extraction(_MergedStub())
    # PR2 §3.7 Q12=A — every passport fact carries the same 0.95.
    assert all(f.confidence == 0.95 for f in ext.facts)


def test_merged_so_facts_cover_canonical_categories() -> None:
    ext = merged_so_to_extraction(_MergedStub())
    cats = {(f.category, f.field) for f in ext.facts}
    assert ("project_identification", "so_code") in cats
    assert ("project_identification", "so_name") in cats
    assert ("project_identification", "project_name") in cats
    assert ("concrete_grade", "class") in cats
    assert ("reinforcement", "steel_grade") in cats
    assert ("dimensions", "length_m") in cats
    assert ("dimensions", "width_m") in cats
    assert ("dimensions", "volume_m3") in cats
    assert ("norm_references", "citation") in cats


def test_merged_so_bridge_params_emits_quantities() -> None:
    stub = _MergedStub()
    stub.bridge_params = _BridgeParams()
    ext = merged_so_to_extraction(stub)
    qty_volume = [
        f for f in ext.facts
        if f.category == "quantities" and f.field == "volume_m3"
    ]
    qty_mass = [
        f for f in ext.facts
        if f.category == "quantities" and f.field == "mass_tons"
    ]
    assert len(qty_volume) == 1
    assert qty_volume[0].value == 245.6
    assert qty_volume[0].unit == "m3"
    assert len(qty_mass) == 1
    assert qty_mass[0].value == 5.7


def test_merged_so_missing_technical_does_not_crash() -> None:
    class Bare:
        so_code = "SO 999"
        so_name = ""
        technical = None
        bridge_params = None
        construction_type = None
        d14_profession = None
        file_count = 0
    ext = merged_so_to_extraction(Bare())
    # Should at least emit so_code identification fact.
    assert any(
        f.category == "project_identification" and f.field == "so_code"
        for f in ext.facts
    )


def test_batch_helper_returns_list_of_extractions() -> None:
    out = merged_sos_to_extractions([_MergedStub(), _MergedStub()])
    assert len(out) == 2
    assert all(o.provenance.source_format == SourceFormat.PASSPORT_SCHEMA for o in out)
