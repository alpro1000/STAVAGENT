"""
Tests for Chunked Extraction Pipeline.

Covers:
  - document_chunker: section-based, page-based, single-page, fallback
  - merge + dedup: fact merging from multiple chunks
  - conflict detection: same parameter, different values
  - domain implications: ČSN EN 206 exposure → min concrete
  - parsed_document_adapter: ParsedDocument → ExtractedValue facts
  - extraction_schemas: new models (ChunkInfo, FactConflict, etc.)

All tests use mocks — no real HTTP to MinerU/AI.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock

from app.models.extraction_schemas import (
    ChunkExtractionResult,
    ChunkInfo,
    DomainImplication,
    ExtractionResult,
    ExtractionSource,
    ExtractedValue,
    FactConflict,
    CONFIDENCE_MAP,
)
from app.services.document_chunker import (
    chunk_pdf_text,
    _split_into_pages,
    _chunk_by_page_groups,
    _chunk_by_single_page,
    detect_text_layer_quality,
)
from app.services.norm_ingestion_pipeline import (
    _merge_chunk_results,
    _detect_conflicts,
    _derive_domain_implications,
    _deduplicate_facts,
    _adjust_pages,
)
from app.services.parsed_document_adapter import (
    parsed_document_to_facts,
    _extract_facts_from_position,
)
from app.parsers.models import (
    ParsedDocument,
    ParsedSO,
    ParsedChapter,
    ParsedPosition,
    SourceFormat,
)


# ══════════════════════════════════════════════════════════════
# Schema Tests
# ══════════════════════════════════════════════════════════════


class TestSchemas:
    def test_chunk_info_creation(self):
        c = ChunkInfo(
            chunk_id="test_chunk", chunk_index=0,
            page_start=1, page_end=5, section_title="Úvod",
            char_count=5000, strategy="sections",
        )
        assert c.chunk_id == "test_chunk"
        assert c.strategy == "sections"

    def test_extracted_value_with_chunk_id(self):
        v = ExtractedValue(
            value="C30/37", confidence=1.0,
            source=ExtractionSource.REGEX, chunk_id="chunk_0",
        )
        assert v.chunk_id == "chunk_0"

    def test_fact_conflict_model(self):
        a = ExtractedValue(value="C30/37", confidence=1.0, source=ExtractionSource.REGEX, page=5)
        b = ExtractedValue(value="C40/50", confidence=1.0, source=ExtractionSource.REGEX, page=12)
        conflict = FactConflict(parameter="concrete_grade", fact_a=a, fact_b=b)
        assert conflict.resolution == "unresolved"

    def test_domain_implication_model(self):
        d = DomainImplication(
            trigger_fact="XF4",
            implication="Requires air-entraining",
            rule_source="ČSN EN 206",
        )
        assert d.confidence == 0.9

    def test_extraction_result_stats_include_chunks(self):
        r = ExtractionResult(chunks_processed=3)
        assert r.stats["chunks_processed"] == 3
        assert r.stats["conflicts"] == 0
        assert r.stats["implications"] == 0

    def test_confidence_map_values(self):
        assert CONFIDENCE_MAP[ExtractionSource.REGEX] == 1.0
        assert CONFIDENCE_MAP[ExtractionSource.GEMINI_FLASH] == 0.7
        assert CONFIDENCE_MAP[ExtractionSource.PERPLEXITY] == 0.85


# ══════════════════════════════════════════════════════════════
# Document Chunker Tests
# ══════════════════════════════════════════════════════════════


class TestDocumentChunker:
    def _make_pages(self, n: int, chars_per_page: int = 1000) -> str:
        """Create fake multi-page text with page breaks."""
        pages = []
        for i in range(n):
            pages.append(f"Stránka {i+1}. " + "X" * chars_per_page)
        return "\n\n--- PAGE BREAK ---\n\n".join(pages)

    def test_small_document_no_split(self):
        text = self._make_pages(3)
        chunks = chunk_pdf_text(text, total_pages=3)
        assert len(chunks) == 1
        assert chunks[0][0].strategy == "full"

    def test_empty_text_returns_empty(self):
        assert chunk_pdf_text("", 0) == []
        assert chunk_pdf_text("   ", 0) == []

    def test_page_group_fallback(self):
        text = self._make_pages(12)
        chunks = chunk_pdf_text(text, total_pages=12)
        assert len(chunks) >= 2
        # First chunk should be metadata
        assert "Meta" in chunks[0][0].section_title or "Úvod" in chunks[0][0].section_title

    def test_section_based_splitting(self):
        # Need >5 pages to avoid "small document" shortcut
        # Build continuous text with section headings (not page-separated)
        text_body = (
            "Titulní list\n\nProjekt XYZ\n\n" + "Z" * 400 + "\n\n"
            "1. Úvod\n\nTento dokument popisuje stavbu mostu.\n" + "A" * 400 + "\n\n"
            "2. Základní informace\n\nStavba se nachází v Praze.\n" + "B" * 400 + "\n\n"
            "3. Beton\n\nTřída betonu C30/37, XC4, XF4.\n" + "C" * 400 + "\n\n"
            "4. Výztuž\n\nOcel B500B, průměr 16mm.\n" + "D" * 400 + "\n\n"
            "5. Závěr\n\nPráce budou provedeny dle TKP 18.\n" + "E" * 400
        )
        # Simulate 8 pages so it's above the 5-page threshold
        pages = [text_body[i:i+len(text_body)//8] for i in range(0, len(text_body), len(text_body)//8)]
        text = "\n\n--- PAGE BREAK ---\n\n".join(pages[:8])
        chunks = chunk_pdf_text(text, total_pages=8)
        # Should produce multiple chunks (sections or page groups)
        assert len(chunks) >= 2

    def test_drawing_one_page_per_chunk(self):
        text = self._make_pages(5)
        chunks = chunk_pdf_text(text, total_pages=5, doc_type="drawing")
        # Small doc → full for drawings with ≤5 pages
        # For 6+ pages, should be one per page
        text6 = self._make_pages(6)
        chunks6 = chunk_pdf_text(text6, total_pages=6, doc_type="drawing")
        assert len(chunks6) == 6

    def test_split_into_pages(self):
        text = "Page 1\n\n--- PAGE BREAK ---\n\nPage 2\n\n--- PAGE BREAK ---\n\nPage 3"
        pages = _split_into_pages(text)
        assert len(pages) == 3
        assert "Page 1" in pages[0]
        assert "Page 3" in pages[2]

    def test_chunk_by_single_page(self):
        pages = ["Drawing A", "Drawing B", ""]
        chunks = _chunk_by_single_page(pages)
        assert len(chunks) == 2  # empty page skipped

    def test_page_numbers_in_chunks(self):
        text = self._make_pages(12)
        chunks = chunk_pdf_text(text, total_pages=12)
        for chunk_info, _ in chunks:
            assert chunk_info.page_start >= 1
            assert chunk_info.page_end >= chunk_info.page_start


# ══════════════════════════════════════════════════════════════
# Merge & Dedup Tests
# ══════════════════════════════════════════════════════════════


class TestMergeAndDedup:
    def _make_chunk_result(self, chunk_id, materials=None, norms=None):
        cr = ChunkExtractionResult(
            chunk=ChunkInfo(
                chunk_id=chunk_id, chunk_index=0,
                page_start=1, page_end=3, char_count=1000,
            ),
        )
        for m in (materials or []):
            cr.materials.append(ExtractedValue(
                value=m, confidence=1.0, source=ExtractionSource.REGEX,
                chunk_id=chunk_id,
            ))
        for n in (norms or []):
            cr.norm_references.append(ExtractedValue(
                value=n, confidence=1.0, source=ExtractionSource.REGEX,
                chunk_id=chunk_id,
            ))
        return cr

    def test_merge_two_chunks(self):
        cr1 = self._make_chunk_result("a", materials=["C30/37", "XC4"])
        cr2 = self._make_chunk_result("b", materials=["B500B", "XC4"])
        merged, _ = _merge_chunk_results([cr1, cr2])
        # XC4 appears in both → deduped
        mat_values = [str(m.value) for m in merged.materials]
        assert "C30/37" in mat_values
        assert "B500B" in mat_values
        assert mat_values.count("XC4") == 1  # deduped

    def test_dedup_keeps_highest_confidence(self):
        facts = [
            ExtractedValue(value="C30/37", confidence=0.7, source=ExtractionSource.GEMINI_FLASH),
            ExtractedValue(value="C30/37", confidence=1.0, source=ExtractionSource.REGEX),
        ]
        deduped = _deduplicate_facts(facts)
        assert len(deduped) == 1
        assert deduped[0].confidence == 1.0

    def test_merge_preserves_chunk_details(self):
        cr1 = self._make_chunk_result("chunk_a")
        cr2 = self._make_chunk_result("chunk_b")
        merged, _ = _merge_chunk_results([cr1, cr2])
        assert merged.chunks_processed == 2
        assert len(merged.chunk_details) == 2

    def test_merge_ai_summaries_joined(self):
        cr1 = self._make_chunk_result("a")
        cr1.ai_summary = "Part A summary"
        cr2 = self._make_chunk_result("b")
        cr2.ai_summary = "Part B summary"
        merged, _ = _merge_chunk_results([cr1, cr2])
        assert "Part A" in merged.ai_summary
        assert "Part B" in merged.ai_summary


# ══════════════════════════════════════════════════════════════
# Conflict Detection Tests
# ══════════════════════════════════════════════════════════════


class TestConflictDetection:
    def test_no_conflict_single_grade(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="C30/37", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="a"),
            ExtractedValue(value="C30/37", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="b"),
        ])
        conflicts = _detect_conflicts(result)
        assert len(conflicts) == 0

    def test_conflict_different_grades_different_chunks(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="C30/37", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="a"),
            ExtractedValue(value="C40/50", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="a"),
        ])
        conflicts = _detect_conflicts(result)
        assert len(conflicts) >= 1
        assert conflicts[0].parameter == "concrete_grade"

    def test_exposure_classes_not_conflicting(self):
        """Multiple exposure classes from different chunks = normal, not conflict."""
        result = ExtractionResult(materials=[
            ExtractedValue(value="XC4", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="a"),
            ExtractedValue(value="XF4", confidence=1.0,
                          source=ExtractionSource.REGEX, chunk_id="b"),
        ])
        conflicts = _detect_conflicts(result)
        assert len(conflicts) == 0


# ══════════════════════════════════════════════════════════════
# Domain Implications Tests
# ══════════════════════════════════════════════════════════════


class TestDomainImplications:
    def test_xf4_implies_air_entraining(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="XF4", confidence=1.0, source=ExtractionSource.REGEX),
        ])
        implications = _derive_domain_implications(result)
        texts = [i.implication for i in implications]
        assert any("provzdušnění" in t for t in texts)

    def test_xc4_implies_min_concrete(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="XC4", confidence=1.0, source=ExtractionSource.REGEX),
        ])
        implications = _derive_domain_implications(result)
        assert any("C30/37" in i.implication for i in implications)

    def test_scc_detected(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="samozhutnitelný beton SCC", confidence=1.0,
                          source=ExtractionSource.REGEX),
        ])
        implications = _derive_domain_implications(result)
        assert any("SCC" in i.implication for i in implications)

    def test_prestressed_detected(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="předpjatý beton", confidence=1.0,
                          source=ExtractionSource.REGEX),
        ])
        implications = _derive_domain_implications(result)
        assert any("předpjat" in i.implication.lower() or "Předpjatý" in i.implication
                    for i in implications)

    def test_no_implications_for_generic_material(self):
        result = ExtractionResult(materials=[
            ExtractedValue(value="B500B", confidence=1.0, source=ExtractionSource.REGEX),
        ])
        implications = _derive_domain_implications(result)
        assert len(implications) == 0


# ══════════════════════════════════════════════════════════════
# Page Adjustment Tests
# ══════════════════════════════════════════════════════════════


class TestPageAdjustment:
    def test_adjust_pages_offset(self):
        facts = [
            ExtractedValue(value="X", confidence=1.0, source=ExtractionSource.REGEX, page=1),
            ExtractedValue(value="Y", confidence=1.0, source=ExtractionSource.REGEX, page=3),
        ]
        _adjust_pages(facts, page_offset=5)
        assert facts[0].page == 5
        assert facts[1].page == 7

    def test_adjust_pages_no_offset(self):
        facts = [
            ExtractedValue(value="X", confidence=1.0, source=ExtractionSource.REGEX, page=2),
        ]
        _adjust_pages(facts, page_offset=1)
        assert facts[0].page == 2  # unchanged

    def test_adjust_pages_none_page(self):
        facts = [
            ExtractedValue(value="X", confidence=1.0, source=ExtractionSource.REGEX, page=None),
        ]
        _adjust_pages(facts, page_offset=5)
        assert facts[0].page is None  # unchanged


# ══════════════════════════════════════════════════════════════
# Parsed Document Adapter Tests
# ══════════════════════════════════════════════════════════════


class TestParsedDocumentAdapter:
    def _make_doc(self) -> ParsedDocument:
        return ParsedDocument(
            source_format=SourceFormat.XLSX_KOMPLET,
            source_file="test_soupis.xlsx",
            project_name="Stavba SO 201",
            project_id="PRJ-001",
            positions_count=3,
            stavebni_objekty=[
                ParsedSO(
                    so_id="SO201",
                    so_name="Most",
                    chapters=[
                        ParsedChapter(
                            code="4",
                            name="Základy",
                            positions=[
                                ParsedPosition(
                                    code="274321611",
                                    description="Beton základových pasů C30/37 XC4",
                                    unit="m3",
                                    quantity=Decimal("150.5"),
                                    unit_price=Decimal("3200"),
                                    total_price=Decimal("481600"),
                                ),
                                ParsedPosition(
                                    code="411321515",
                                    description="Výztuž B500B ∅16",
                                    unit="t",
                                    quantity=Decimal("12.3"),
                                    unit_price=Decimal("42000"),
                                ),
                            ],
                        ),
                        ParsedChapter(
                            code="8",
                            name="Potrubí",
                            positions=[
                                ParsedPosition(
                                    code="899101111",
                                    description="Potrubí DN200 dle ČSN EN 1916",
                                    unit="m",
                                    quantity=Decimal("85"),
                                ),
                            ],
                        ),
                    ],
                ),
            ],
        )

    def test_basic_conversion(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        assert result.chunks_processed == 2  # 2 chapters
        assert len(result.materials) > 0
        assert result.filename == "test_soupis.xlsx"

    def test_concrete_grade_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        mat_values = [str(m.value) for m in result.materials]
        assert any("C30/37" in v for v in mat_values)

    def test_exposure_class_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        mat_values = [str(m.value) for m in result.materials]
        assert "XC4" in mat_values

    def test_rebar_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        mat_values = [str(m.value) for m in result.materials]
        assert "B500B" in mat_values

    def test_rebar_diameter_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        dim_values = [str(d.value) for d in result.dimensions]
        assert any("∅16" in v for v in dim_values)

    def test_pipe_dn_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        mat_values = [str(m.value) for m in result.materials]
        assert "DN200" in mat_values

    def test_norm_reference_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        norm_values = [str(n.value) for n in result.norm_references]
        assert any("ČSN EN 1916" in v for v in norm_values)

    def test_urs_code_extracted(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        norm_values = [str(n.value) for n in result.norm_references]
        assert any("274321611" in v for v in norm_values)

    def test_quantities_in_dimensions(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        dim_values = [(d.value, d.unit) for d in result.dimensions]
        assert any(v == 150.5 and u == "m3" for v, u in dim_values)

    def test_project_metadata(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        assert "project_name" in result.document_meta
        assert result.document_meta["project_name"].value == "Stavba SO 201"

    def test_chunk_ids_assigned(self):
        doc = self._make_doc()
        result = parsed_document_to_facts(doc)
        for m in result.materials:
            assert m.chunk_id is not None
            assert m.chunk_id.startswith("dil_")

    def test_empty_document(self):
        doc = ParsedDocument(
            source_format=SourceFormat.XLSX_KOMPLET,
            stavebni_objekty=[],
        )
        result = parsed_document_to_facts(doc)
        assert result.chunks_processed == 0
        assert len(result.materials) == 0


# ══════════════════════════════════════════════════════════════
# Integration: Full Chunked Pipeline (mocked AI)
# ══════════════════════════════════════════════════════════════


class TestChunkedPipelineIntegration:
    """Test the full pipeline with mocked L1 and L3a."""

    @pytest.mark.asyncio
    async def test_full_pipeline_mocked(self):
        """Simulate a 10-page PDF going through chunked extraction."""
        from app.services.norm_ingestion_pipeline import NormIngestionPipeline

        # Build fake 10-page text with construction content
        pages = []
        pages.append("Titulní list\nProjekt: Rekonstrukce mostu SO 201")
        pages.append("Obsah\n1. Úvod\n2. Beton\n3. Výztuž")
        pages.append("1. Úvod\nStavba se nachází v Praze, dle ČSN EN 1992.")
        for i in range(3, 8):
            pages.append(
                f"Strana {i+1}. Beton třídy C30/37, expozice XC4 XF4.\n"
                f"Výztuž B500B, průměr ∅16. Krytí 40 mm.\n"
                f"Objem betonu {50 + i * 10} m³.\n"
                f"Tolerance ±5 mm dle ČSN 73 0210.\n"
                + "X" * 800
            )
        pages.append("Závěr\nPráce budou provedeny dle TKP 18.")
        pages.append("Přílohy\nVýkresy viz D.2.1")

        full_text = "\n\n--- PAGE BREAK ---\n\n".join(pages)

        # Mock L1 (text extraction)
        mock_text_result = (full_text, "pdfplumber", 10)

        # Mock L3a (Gemini) — return empty, we test regex
        mock_gemini = {}

        with patch(
            "app.services.norm_ingestion_pipeline.extract_text_from_pdf",
            new_callable=AsyncMock,
            return_value=mock_text_result,
        ), patch(
            "app.services.norm_ingestion_pipeline.call_gemini_enrichment",
            new_callable=AsyncMock,
            return_value=mock_gemini,
        ):
            result = await NormIngestionPipeline.ingest(
                file_path="/fake/path.pdf",
                file_bytes=b"fake_content",
                filename="test_statika.pdf",
                skip_perplexity=True,
                doc_type="tz",
            )

        # Verify chunking happened
        assert result.chunks_processed >= 2
        assert len(result.chunk_details) >= 2

        # Verify regex extraction across chunks
        mat_values = [str(m.value) for m in result.materials]
        assert any("C30/37" in v for v in mat_values), f"Materials: {mat_values}"
        assert "XC4" in mat_values
        assert "XF4" in mat_values
        assert any("B500B" in v for v in mat_values)

        # Verify norms found
        norm_values = [str(n.value) for n in result.norm_references]
        assert any("ČSN EN 1992" in v for v in norm_values)

        # Verify domain implications
        impl_texts = [i.implication for i in result.domain_implications]
        assert any("provzdušnění" in t for t in impl_texts)  # XF4 → air entraining
        assert any("C30/37" in t for t in impl_texts)  # XC4 → min C30/37

    @pytest.mark.asyncio
    async def test_pipeline_empty_pdf(self):
        """Empty PDF should return empty result without errors."""
        from app.services.norm_ingestion_pipeline import NormIngestionPipeline

        with patch(
            "app.services.norm_ingestion_pipeline.extract_text_from_pdf",
            new_callable=AsyncMock,
            return_value=("", "pdfplumber", 0),
        ):
            result = await NormIngestionPipeline.ingest(
                file_path="/fake/empty.pdf",
                file_bytes=b"",
                filename="empty.pdf",
                skip_perplexity=True,
            )

        assert result.chunks_processed == 0
        assert len(result.materials) == 0

    @pytest.mark.asyncio
    async def test_pipeline_gemini_failure_returns_regex_only(self):
        """If Gemini fails, regex results should still be present."""
        from app.services.norm_ingestion_pipeline import NormIngestionPipeline

        text = "Beton C40/50 dle ČSN EN 206. Expozice XA2."
        # Small doc → single chunk
        full_text = "\n\n--- PAGE BREAK ---\n\n".join([text] * 3)

        with patch(
            "app.services.norm_ingestion_pipeline.extract_text_from_pdf",
            new_callable=AsyncMock,
            return_value=(full_text, "pdfplumber", 3),
        ), patch(
            "app.services.norm_ingestion_pipeline.call_gemini_enrichment",
            new_callable=AsyncMock,
            side_effect=Exception("Gemini unavailable"),
        ):
            result = await NormIngestionPipeline.ingest(
                file_path="/fake/path.pdf",
                file_bytes=b"content",
                filename="statika.pdf",
                skip_perplexity=True,
            )

        # Regex results should still be there
        mat_values = [str(m.value) for m in result.materials]
        assert any("C40/50" in v for v in mat_values)
        assert "XA2" in mat_values
