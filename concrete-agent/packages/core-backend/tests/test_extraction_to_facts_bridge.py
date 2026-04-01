"""
Tests for ExtractionResult → Calculator Facts bridge.

Covers:
  - extraction_to_facts_bridge: ExtractionResult → fact dicts
  - SO-number tagging from context and chunk titles
  - Integration with calculator_suggestions (map_facts_to_suggestions)
  - XF4 air-entraining warning
  - End-to-end: extraction → bridge → suggestions → warnings

All tests use mocked data — no HTTP.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import pytest
from unittest.mock import patch, MagicMock

from app.models.extraction_schemas import (
    ChunkInfo,
    DomainImplication,
    ExtractionResult,
    ExtractionSource,
    ExtractedValue,
)
from app.services.extraction_to_facts_bridge import (
    extraction_result_to_facts,
    _detect_so_from_fact,
    _FactCollector,
)
from app.services.calculator_suggestions import (
    map_facts_to_suggestions,
    store_project_facts,
    get_project_facts,
    get_calculator_suggestions,
    _generate_warnings,
)


# ══════════════════════════════════════════════════════════════
# Bridge Tests
# ══════════════════════════════════════════════════════════════


class TestBridge:
    def _make_extraction(self, **kwargs) -> ExtractionResult:
        """Create a minimal ExtractionResult for testing."""
        defaults = {
            "filename": "TZ_Statika.pdf",
            "parser_used": "pdfplumber",
            "total_pages": 10,
            "raw_text_length": 5000,
            "chunks_processed": 2,
        }
        defaults.update(kwargs)
        return ExtractionResult(**defaults)

    def test_basic_conversion(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX, page=5),
                ExtractedValue(value="XC4", confidence=1.0,
                              source=ExtractionSource.REGEX, page=5),
                ExtractedValue(value="B500B", confidence=1.0,
                              source=ExtractionSource.REGEX, page=7),
            ],
        )
        facts = extraction_result_to_facts(extraction, document_name="TZ Statika")
        assert len(facts) >= 1
        # Check base_construction
        base = facts[0]["extractions"]["base_construction"]
        assert base.get("concrete_class") == "C30/37"
        assert "XC4" in base.get("exposure_classes", "")
        assert base.get("steel_grade") == "B500B"

    def test_so_grouping_from_context(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C40/50", confidence=1.0,
                              source=ExtractionSource.REGEX,
                              context="Most SO-203 nosná konstrukce C40/50"),
                ExtractedValue(value="C25/30", confidence=1.0,
                              source=ExtractionSource.REGEX,
                              context="Opěrná zeď SO-201 beton C25/30"),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        # Should produce 2 fact groups (SO-203 and SO-201)
        so_numbers = [f["building_object"] for f in facts]
        assert "SO-203" in so_numbers
        assert "SO-201" in so_numbers

    def test_so_grouping_from_chunk_title(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C35/45", confidence=1.0,
                              source=ExtractionSource.REGEX,
                              chunk_id="chunk_so203"),
            ],
            chunk_details=[
                ChunkInfo(
                    chunk_id="chunk_so203", chunk_index=0,
                    page_start=1, page_end=5,
                    section_title="SO-203 Nosná konstrukce mostu",
                    char_count=2000,
                ),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        assert any(f["building_object"] == "SO-203" for f in facts)

    def test_global_facts_no_so(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        assert len(facts) >= 1
        assert facts[0]["building_object"] is None

    def test_document_name_preserved(self):
        extraction = self._make_extraction()
        facts = extraction_result_to_facts(
            extraction, document_name="TZ Statika D.1.2"
        )
        if facts:
            assert facts[0]["document_name"] == "TZ Statika D.1.2"

    def test_pages_populated(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX, page=12),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        if facts:
            assert facts[0]["pages"].get("concrete_class") == 12

    def test_source_type_from_regex(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        assert facts[0]["source_type"] == "regex"

    def test_source_type_from_ai(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="C30/37", confidence=0.7,
                              source=ExtractionSource.GEMINI_FLASH),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        assert facts[0]["source_type"] == "gemini_flash"

    def test_domain_implications_in_raw_text(self):
        extraction = self._make_extraction(
            materials=[
                ExtractedValue(value="XF4", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
            domain_implications=[
                DomainImplication(
                    trigger_fact="XF4",
                    implication="Požadavek na provzdušnění betonu",
                    rule_source="ČSN EN 206",
                ),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        assert any("provzdušnění" in f.get("raw_text", "") for f in facts)

    def test_empty_extraction(self):
        extraction = self._make_extraction()
        facts = extraction_result_to_facts(extraction)
        assert facts == []

    def test_dimensions_not_lost(self):
        extraction = self._make_extraction(
            dimensions=[
                ExtractedValue(value=150.5, unit="m3", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )
        facts = extraction_result_to_facts(extraction)
        # Dimensions should create a fact group even without materials
        assert len(facts) >= 1


# ══════════════════════════════════════════════════════════════
# Integration: Bridge → Calculator Suggestions
# ══════════════════════════════════════════════════════════════


class TestBridgeToSuggestions:
    def test_bridge_facts_produce_suggestions(self):
        extraction = ExtractionResult(
            filename="TZ_Statika.pdf",
            materials=[
                ExtractedValue(value="C40/50", confidence=1.0,
                              source=ExtractionSource.REGEX, page=12,
                              context="Most SO-203 beton C40/50"),
                ExtractedValue(value="XD1", confidence=1.0,
                              source=ExtractionSource.REGEX, page=14),
                ExtractedValue(value="XF2", confidence=1.0,
                              source=ExtractionSource.REGEX, page=14),
                ExtractedValue(value="B500B", confidence=1.0,
                              source=ExtractionSource.REGEX, page=15),
            ],
            ai_summary="Předpjatý beton třídy C40/50, samozhutnitelný SCC.",
        )

        facts = extraction_result_to_facts(extraction, document_name="TZ Statika D.1.2")
        response = map_facts_to_suggestions(facts, building_object="SO-203")

        # Should have concrete class suggestion
        params = [s.param for s in response.suggestions]
        assert "concrete_class" in params

        # Verify concrete class value
        cc = next(s for s in response.suggestions if s.param == "concrete_class")
        assert cc.value == "C40/50"

    def test_so_filter_works(self):
        extraction = ExtractionResult(
            materials=[
                ExtractedValue(value="C40/50", confidence=1.0,
                              source=ExtractionSource.REGEX,
                              context="Most SO-203 beton C40/50"),
                ExtractedValue(value="C25/30", confidence=1.0,
                              source=ExtractionSource.REGEX,
                              context="Zeď SO-201 beton C25/30"),
            ],
        )

        facts = extraction_result_to_facts(extraction)
        # Filter for SO-203 only
        response = map_facts_to_suggestions(facts, building_object="SO-203")

        # Should only have SO-203 facts
        for s in response.suggestions:
            if s.param == "concrete_class":
                assert s.value == "C40/50"  # not C25/30

    def test_store_and_retrieve_facts(self):
        extraction = ExtractionResult(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )

        facts = extraction_result_to_facts(extraction, document_name="Test doc")
        store_project_facts("test-bridge-project", facts)

        retrieved = get_project_facts("test-bridge-project")
        assert len(retrieved) == len(facts)

        # Full round-trip: suggestions
        response = get_calculator_suggestions("test-bridge-project")
        params = [s.param for s in response.suggestions]
        assert "concrete_class" in params

    def test_xf4_warning_generated(self):
        extraction = ExtractionResult(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX),
                ExtractedValue(value="XF4", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )

        facts = extraction_result_to_facts(extraction)
        response = map_facts_to_suggestions(facts)

        # Should have XF4 air-entraining warning
        warning_rules = [w.rule for w in response.warnings]
        assert "CSN_EN_206_XF4" in warning_rules

    def test_insufficient_concrete_class_warning(self):
        extraction = ExtractionResult(
            materials=[
                ExtractedValue(value="C20/25", confidence=1.0,
                              source=ExtractionSource.REGEX),
                ExtractedValue(value="XD2", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )

        facts = extraction_result_to_facts(extraction)
        response = map_facts_to_suggestions(facts)

        # XD2 requires min C30/37, but we have C20/25 → blocking warning
        blocking = [w for w in response.warnings if w.severity == "blocking"]
        assert len(blocking) >= 1
        assert any("nižší než minimum" in w.message for w in blocking)

    def test_prestressed_flag_from_raw_text(self):
        extraction = ExtractionResult(
            materials=[
                ExtractedValue(value="C40/50", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
            ai_summary="Nosná konstrukce z předpjatého betonu C40/50.",
        )

        facts = extraction_result_to_facts(extraction)
        response = map_facts_to_suggestions(facts)

        # Should detect prestressed from raw_text (ai_summary)
        params = [s.param for s in response.suggestions]
        assert "is_prestressed" in params

    def test_multiple_documents_merge(self):
        ext1 = ExtractionResult(
            materials=[
                ExtractedValue(value="C30/37", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )
        ext2 = ExtractionResult(
            materials=[
                ExtractedValue(value="B500B", confidence=1.0,
                              source=ExtractionSource.REGEX),
            ],
        )

        facts1 = extraction_result_to_facts(ext1, document_name="Doc 1")
        facts2 = extraction_result_to_facts(ext2, document_name="Doc 2")

        store_project_facts("test-multi-doc", facts1 + facts2)
        response = get_calculator_suggestions("test-multi-doc")

        assert response.facts_count >= 2
        assert len(response.documents_used) == 2
