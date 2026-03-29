"""
Unit tests for Position Grouper — beton + armatura + opalubka linking.

Tests the deterministic algorithm that groups related positions
after bulk import. No AI, no network, no DB.

Run: pytest tests/test_position_grouper.py -v
"""

import pytest

from app.models.item_schemas import (
    BulkImportRequest,
    ItemImportRow,
)
from app.services.item_store import bulk_import, read_items, reset_store


@pytest.fixture(autouse=True)
def clean_store():
    reset_store()
    yield
    reset_store()


def _import(items: list[ItemImportRow], project: str = "proj_group") -> list:
    """Helper: import items and return result items."""
    import asyncio
    req = BulkImportRequest(project_id=project, items=items)
    result = asyncio.get_event_loop().run_until_complete(bulk_import(req))
    return result.items


class TestConcreteDetection:
    """Concrete positions are correctly identified."""

    def test_concrete_with_class_detected(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.group_role == "beton"

    def test_non_concrete_not_detected(self):
        items = _import([
            ItemImportRow(kod="111111111", popis="Výkopy zeminy", mj="m³", mnozstvi=100),
        ])
        assert items[0].core.group_role is None

    def test_concrete_without_class_not_detected(self):
        """m³ alone without concrete class → not concrete."""
        items = _import([
            ItemImportRow(kod="111111111", popis="Zásyp zeminou", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.group_role is None


class TestInclusionMarkers:
    """Positions with 'vč. bednění' / 'vč. výztuže' are flagged."""

    def test_vcetne_vyztuze(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37 vč. výztuže", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.armatura_included is True
        assert items[0].core.opalubka_included is False

    def test_vcetne_bedneni(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37 včetně bednění", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.opalubka_included is True
        assert items[0].core.armatura_included is False

    def test_vcetne_both(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton C30/37 vč. výztuže a vč. bednění", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.armatura_included is True
        assert items[0].core.opalubka_included is True


class TestAdjacentLinking:
    """Rebar and formwork positions after concrete are linked."""

    def test_rebar_linked_to_concrete(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
            ItemImportRow(kod="622361111", popis="Výztuž stěn B500B", mj="t", mnozstvi=3),
        ])
        beton = items[0]
        rebar = items[1]
        assert beton.core.group_role == "beton"
        assert rebar.core.group_role == "armatura"
        assert rebar.core.group_leader_id == beton.item_id
        assert rebar.item_id in beton.core.group_members

    def test_formwork_linked_to_concrete(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton základů C25/30", mj="m³", mnozstvi=80),
            ItemImportRow(kod="622381111", popis="Bednění základů", mj="m²", mnozstvi=120),
        ])
        beton = items[0]
        formwork = items[1]
        assert formwork.core.group_role == "opalubka"
        assert formwork.core.group_leader_id == beton.item_id

    def test_full_group_beton_rebar_formwork(self):
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
            ItemImportRow(kod="622361111", popis="Výztuž stěn B500B", mj="t", mnozstvi=3),
            ItemImportRow(kod="622381111", popis="Bednění stěn", mj="m²", mnozstvi=120),
        ])
        beton = items[0]
        assert beton.core.group_role == "beton"
        assert len(beton.core.group_members) == 2
        assert items[1].core.group_role == "armatura"
        assert items[2].core.group_role == "opalubka"

    def test_no_rebar_linked_when_included(self):
        """If 'vč. výztuže' → rebar position not linked even if adjacent."""
        items = _import([
            ItemImportRow(kod="622311211", popis="Beton stěn C30/37 vč. výztuže", mj="m³", mnozstvi=50),
            ItemImportRow(kod="622361111", popis="Výztuž stěn B500B", mj="t", mnozstvi=3),
        ])
        beton = items[0]
        rebar = items[1]
        assert beton.core.armatura_included is True
        assert rebar.core.group_role is None  # Not linked
        assert len(beton.core.group_members) == 0


class TestMultipleGroups:
    """Multiple concrete positions create separate groups."""

    def test_two_separate_groups(self):
        items = _import([
            ItemImportRow(kod="001", popis="Beton základů C25/30", mj="m³", mnozstvi=80),
            ItemImportRow(kod="002", popis="Výztuž základů B500B", mj="t", mnozstvi=4),
            ItemImportRow(kod="003", popis="Bednění základů", mj="m²", mnozstvi=100),
            ItemImportRow(kod="004", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
            ItemImportRow(kod="005", popis="Výztuž stěn B500B", mj="t", mnozstvi=3),
        ])
        # First group
        assert items[0].core.group_role == "beton"
        assert items[1].core.group_leader_id == items[0].item_id
        assert items[2].core.group_leader_id == items[0].item_id
        # Second group
        assert items[3].core.group_role == "beton"
        assert items[4].core.group_leader_id == items[3].item_id
        # No cross-contamination
        assert items[1].core.group_leader_id != items[3].item_id

    def test_unrelated_positions_not_grouped(self):
        items = _import([
            ItemImportRow(kod="001", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
            ItemImportRow(kod="002", popis="Hydroizolace spodní stavby", mj="m²", mnozstvi=200),
            ItemImportRow(kod="003", popis="Zemní práce výkopy", mj="m³", mnozstvi=300),
        ])
        assert items[0].core.group_role == "beton"
        assert items[1].core.group_role is None  # m² but not formwork
        assert items[2].core.group_role is None
        assert len(items[0].core.group_members) == 0


class TestEdgeCases:
    """Edge cases in grouping."""

    def test_empty_import_no_crash(self):
        items = _import([])
        assert len(items) == 0

    def test_single_position_no_group(self):
        items = _import([
            ItemImportRow(kod="001", popis="Beton C25/30", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.group_role == "beton"
        assert len(items[0].core.group_members) == 0

    def test_rebar_before_concrete_not_linked(self):
        """Rebar BEFORE concrete is not linked (scan only forward)."""
        items = _import([
            ItemImportRow(kod="001", popis="Výztuž stěn B500B", mj="t", mnozstvi=3),
            ItemImportRow(kod="002", popis="Beton stěn C30/37", mj="m³", mnozstvi=50),
        ])
        assert items[0].core.group_role is None
        assert items[1].core.group_role == "beton"
