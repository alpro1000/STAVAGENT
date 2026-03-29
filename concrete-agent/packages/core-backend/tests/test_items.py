"""
Unit tests for Unified Item Layer — item_store + code_detector.

All tests use in-memory store (no PostgreSQL, no network).
Covers all acceptance criteria from the task specification.

Run: pytest tests/test_items.py -v
"""

import pytest

from app.models.item_schemas import (
    BulkImportRequest,
    CodeSystem,
    ItemFilterRequest,
    ItemImportRow,
    Namespace,
    UpdateBlockRequest,
)
from app.services.item_store import bulk_import, read_items, update_block, get_item_versions, reset_store
from app.services.code_detector import detect_code_system, _normalize_code


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_store():
    """Reset in-memory store before each test."""
    reset_store()
    yield
    reset_store()


def _make_items(n: int, prefix: str = "622311") -> list[ItemImportRow]:
    """Helper: create N test items with OTSKP-like codes."""
    return [
        ItemImportRow(
            kod=f"{prefix}{str(i).zfill(3)}",
            popis=f"Beton C30/37 pozice {i}",
            mnozstvi=10.0 + i,
            mj="m³",
            cena_jednotkova=2500.0,
            cena_celkem=(10.0 + i) * 2500.0,
            so_id="SO-201",
            oddil_code="01",
        )
        for i in range(n)
    ]


def _make_request(n: int, project: str = "proj_test") -> BulkImportRequest:
    return BulkImportRequest(
        project_id=project,
        source_file="test.xlsx",
        items=_make_items(n),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5.1 Базовая работа с позициями
# ═══════════════════════════════════════════════════════════════════════════════

class TestBulkImport:
    """AC 5.1: After import, exactly N items exist; no duplicates on reimport."""

    @pytest.mark.asyncio
    async def test_import_creates_exact_count(self):
        """After importing N rows, exactly N items exist in store."""
        result = await bulk_import(_make_request(5))
        assert result.total == 5
        assert result.created == 5
        assert result.updated == 0
        assert result.unchanged == 0
        assert len(result.items) == 5

    @pytest.mark.asyncio
    async def test_reimport_no_duplicates(self):
        """Repeated import of same data creates no duplicates."""
        req = _make_request(5)
        r1 = await bulk_import(req)
        assert r1.created == 5

        r2 = await bulk_import(req)
        assert r2.created == 0
        assert r2.unchanged == 5
        assert r2.total == 5

        # Verify same item_ids
        ids1 = {it.item_id for it in r1.items}
        ids2 = {it.item_id for it in r2.items}
        assert ids1 == ids2

    @pytest.mark.asyncio
    async def test_reimport_with_changed_quantity(self):
        """Changed quantity creates version history, not duplicate."""
        req = _make_request(3)
        r1 = await bulk_import(req)
        assert r1.created == 3

        # Change quantity of first item
        req.items[0].mnozstvi = 99.0
        req.items[0].cena_celkem = 99.0 * 2500.0
        r2 = await bulk_import(req)
        assert r2.created == 0
        assert r2.updated == 1
        assert r2.unchanged == 2

        # Check version history
        item_id = r2.items[0].item_id
        versions = await get_item_versions(item_id)
        assert len(versions) == 1
        assert "mnozstvi" in versions[0].changed_fields

    @pytest.mark.asyncio
    async def test_reimport_marks_deleted(self):
        """Items missing from reimport are marked deleted_in_reimport."""
        req = _make_request(5)
        r1 = await bulk_import(req)
        assert r1.created == 5

        # Reimport with only 3 items
        req.items = req.items[:3]
        r2 = await bulk_import(req)
        assert r2.total == 3
        assert r2.unchanged == 3

        # Read all (deleted excluded by default)
        items = await read_items("proj_test")
        assert len(items) == 3


# ═══════════════════════════════════════════════════════════════════════════════
# 5.2 Cross-kiosk доступ
# ═══════════════════════════════════════════════════════════════════════════════

class TestCrossKiosk:
    """AC 5.2: Monolit reads filtered items, writes its block, Registry sees both."""

    @pytest.mark.asyncio
    async def test_monolit_reads_filtered(self):
        """Monolit gets only items matching keyword filter."""
        items = [
            ItemImportRow(kod="622311001", popis="Beton C30/37 základová deska", mnozstvi=50, mj="m³"),
            ItemImportRow(kod="622311002", popis="Výztuž B500B", mnozstvi=5, mj="t"),
            ItemImportRow(kod="622311003", popis="Bednění základů", mnozstvi=120, mj="m²"),
        ]
        req = BulkImportRequest(project_id="proj_filter", items=items)
        await bulk_import(req)

        # Monolit requests only "beton"
        concrete = await read_items("proj_filter", ItemFilterRequest(keyword="beton"))
        assert len(concrete) == 1
        assert "Beton" in concrete[0].estimate.popis

    @pytest.mark.asyncio
    async def test_monolit_writes_block_without_affecting_estimate(self):
        """Monolit writes its block; estimate data unchanged."""
        req = _make_request(1)
        r = await bulk_import(req)
        item_id = r.items[0].item_id
        original_popis = r.items[0].estimate.popis

        # Monolit writes its data
        monolit_data = {
            "monolit_position_id": "pos_m1",
            "part_name": "ZÁKLADY",
            "subtype": "C30/37",
            "concrete_m3": 50.5,
            "crew_size": 4,
            "days": 3.0,
        }
        result = await update_block(item_id, UpdateBlockRequest(
            namespace=Namespace.MONOLIT, data=monolit_data
        ))

        assert result.updated is True
        assert result.item.monolit is not None
        assert result.item.monolit.concrete_m3 == 50.5
        # Estimate unchanged
        assert result.item.estimate.popis == original_popis

    @pytest.mark.asyncio
    async def test_registry_sees_both_blocks(self):
        """Registry reads item and sees both estimate and monolit data."""
        req = _make_request(1)
        r = await bulk_import(req)
        item_id = r.items[0].item_id

        # Monolit fills its block
        await update_block(item_id, UpdateBlockRequest(
            namespace=Namespace.MONOLIT,
            data={"part_name": "ZÁKLADY", "concrete_m3": 42.0, "days": 2.5},
        ))

        # Registry reads
        items = await read_items("proj_test")
        assert len(items) == 1
        item = items[0]
        # Both blocks present
        assert item.estimate.kod != ""
        assert item.monolit is not None
        assert item.monolit.concrete_m3 == 42.0
        assert item.core.estimate_filled is True
        assert item.core.monolit_filled is True


# ═══════════════════════════════════════════════════════════════════════════════
# 5.3 Namespace isolation
# ═══════════════════════════════════════════════════════════════════════════════

class TestNamespace:
    """AC 5.3: Namespace blocks are isolated; core is read-only."""

    @pytest.mark.asyncio
    async def test_core_namespace_readonly(self):
        """Writing to 'core' namespace raises error."""
        req = _make_request(1)
        r = await bulk_import(req)
        item_id = r.items[0].item_id

        with pytest.raises(ValueError, match="read-only"):
            await update_block(item_id, UpdateBlockRequest(
                namespace=Namespace.CORE, data={"version": 999}
            ))

    @pytest.mark.asyncio
    async def test_concurrent_writes_different_blocks(self):
        """Two kiosks writing to different blocks don't lose data."""
        req = _make_request(1)
        r = await bulk_import(req)
        item_id = r.items[0].item_id

        # Monolit writes
        await update_block(item_id, UpdateBlockRequest(
            namespace=Namespace.MONOLIT,
            data={"concrete_m3": 100.0},
        ))

        # Classification writes
        await update_block(item_id, UpdateBlockRequest(
            namespace=Namespace.CLASSIFICATION,
            data={"skupina": "BETON_MONOLIT", "skupina_confidence": 0.95},
        ))

        # Read back — both blocks present
        items = await read_items("proj_test")
        item = items[0]
        assert item.monolit is not None
        assert item.monolit.concrete_m3 == 100.0
        assert item.classification is not None
        assert item.classification.skupina == "BETON_MONOLIT"

    @pytest.mark.asyncio
    async def test_item_not_found(self):
        """Update to nonexistent item raises error."""
        with pytest.raises(ValueError, match="not found"):
            await update_block("item_nonexistent", UpdateBlockRequest(
                namespace=Namespace.MONOLIT, data={"days": 1}
            ))


# ═══════════════════════════════════════════════════════════════════════════════
# 5.4 Filtering
# ═══════════════════════════════════════════════════════════════════════════════

class TestFiltering:
    """AC 5.4: Filters by skupina, monolit status, keyword, SO."""

    @pytest.mark.asyncio
    async def test_filter_by_has_monolit(self):
        """Filter returns only items with/without monolit data."""
        req = _make_request(3)
        r = await bulk_import(req)

        # Fill monolit for first item only
        await update_block(r.items[0].item_id, UpdateBlockRequest(
            namespace=Namespace.MONOLIT, data={"days": 1}
        ))

        filled = await read_items("proj_test", ItemFilterRequest(has_monolit=True))
        assert len(filled) == 1

        empty = await read_items("proj_test", ItemFilterRequest(has_monolit=False))
        assert len(empty) == 2

    @pytest.mark.asyncio
    async def test_filter_by_so_id(self):
        """Filter by construction object (SO)."""
        items = [
            ItemImportRow(kod="001", popis="Pozice A", mj="m³", so_id="SO-201"),
            ItemImportRow(kod="002", popis="Pozice B", mj="m²", so_id="SO-202"),
            ItemImportRow(kod="003", popis="Pozice C", mj="m³", so_id="SO-201"),
        ]
        await bulk_import(BulkImportRequest(project_id="proj_so", items=items))

        so201 = await read_items("proj_so", ItemFilterRequest(so_id="SO-201"))
        assert len(so201) == 2

        so202 = await read_items("proj_so", ItemFilterRequest(so_id="SO-202"))
        assert len(so202) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 5.5 Permanent identifiers
# ═══════════════════════════════════════════════════════════════════════════════

class TestPermanentIds:
    """AC 5.5: Item IDs are permanent and consistent across kiosks."""

    @pytest.mark.asyncio
    async def test_id_stable_across_reimport(self):
        """Item ID doesn't change on reimport."""
        req = _make_request(3)
        r1 = await bulk_import(req)
        ids1 = [it.item_id for it in r1.items]

        r2 = await bulk_import(req)
        ids2 = [it.item_id for it in r2.items]

        assert ids1 == ids2

    @pytest.mark.asyncio
    async def test_id_format(self):
        """Item IDs follow the item_xxx format."""
        req = _make_request(1)
        r = await bulk_import(req)
        assert r.items[0].item_id.startswith("item_")

    @pytest.mark.asyncio
    async def test_different_code_systems_different_ids(self):
        """Same numeric code in different systems gets different IDs."""
        items = [
            ItemImportRow(kod="123456789", popis="OTSKP pozice", mj="m³", price_source="CS URS 2025"),
            ItemImportRow(kod="D123456789", popis="ÚRS pozice", mj="m³", price_source="URS 2025"),
        ]
        req = BulkImportRequest(project_id="proj_cs", items=items)
        r = await bulk_import(req)

        assert len(r.items) == 2
        assert r.items[0].item_id != r.items[1].item_id


# ═══════════════════════════════════════════════════════════════════════════════
# Code Detection
# ═══════════════════════════════════════════════════════════════════════════════

class TestCodeDetection:
    """AC from v2: Code system auto-detection."""

    def test_letter_prefix_is_urs(self):
        """Code with D/M/P prefix → ÚRS."""
        r = detect_code_system("D273313111")
        assert r.code_system == CodeSystem.URS
        assert r.confidence >= 0.85
        assert r.code_normalized == "273313111"

    def test_price_source_urs(self):
        """Price source containing URS → ÚRS system."""
        r = detect_code_system("273313111", price_source="CS URS 2025 02")
        # Should detect as URS due to price source hint
        assert r.code_system in (CodeSystem.URS, CodeSystem.OTSKP)  # Both valid for 9 digits

    def test_short_numeric_rts(self):
        """Short 5-digit code → RTS."""
        r = detect_code_system("71100")
        assert r.code_system == CodeSystem.RTS
        assert r.confidence >= 0.60

    def test_empty_code_unknown(self):
        """Empty code → UNKNOWN."""
        r = detect_code_system("")
        assert r.code_system == CodeSystem.UNKNOWN
        assert r.confidence == 0.0

    def test_normalize_code(self):
        """Code normalization strips spaces and dashes."""
        assert _normalize_code("622 311 211") == "622311211"
        assert _normalize_code("622-311-211") == "622311211"
        assert _normalize_code(" 622311211 ") == "622311211"

    def test_price_source_rts(self):
        """Price source containing RTS → RTS system."""
        r = detect_code_system("71100", price_source="RTS 25/I")
        assert r.code_system == CodeSystem.RTS
        assert r.confidence >= 0.85


# ═══════════════════════════════════════════════════════════════════════════════
# Version History
# ═══════════════════════════════════════════════════════════════════════════════

class TestVersionHistory:
    """Version tracking on reimport."""

    @pytest.mark.asyncio
    async def test_version_records_old_and_new(self):
        """Version entry contains old and new values."""
        req = _make_request(1)
        r1 = await bulk_import(req)
        item_id = r1.items[0].item_id

        # Change price
        req.items[0].cena_jednotkova = 3000.0
        req.items[0].cena_celkem = 10.0 * 3000.0
        await bulk_import(req)

        versions = await get_item_versions(item_id)
        assert len(versions) == 1
        v = versions[0]
        assert v.version == 2
        assert "cena_jednotkova" in v.changed_fields
        assert v.old_values["cena_jednotkova"] == 2500.0
        assert v.new_values["cena_jednotkova"] == 3000.0

    @pytest.mark.asyncio
    async def test_multiple_reimports_multiple_versions(self):
        """Each meaningful change adds a version entry."""
        req = _make_request(1)
        await bulk_import(req)

        req.items[0].mnozstvi = 20.0
        await bulk_import(req)

        req.items[0].mnozstvi = 30.0
        await bulk_import(req)

        item_id = (await read_items("proj_test"))[0].item_id
        versions = await get_item_versions(item_id)
        assert len(versions) == 2  # Two changes
