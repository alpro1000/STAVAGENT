"""
Tests for drawing notes → work requirements → soupis pipeline.

Verifies that výkresové poznámky (any format) are correctly converted to
WorkRequirements and can be fed into the soupis assembler alongside TZ text.

Usage:
    cd concrete-agent/packages/core-backend
    python -m pytest tests/test_drawing_notes_pipeline.py -v
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.tz_work_extractor import (
    WorkRequirement,
    ExtractedParam,
    convert_drawing_notes_to_requirements,
    extract_requirements_from_engine,
    requirements_to_dict,
    detect_work_type,
)


# ═══════════════════════════════════════════════════════════════
# FIXTURES — Drawing notes in various formats
# ═══════════════════════════════════════════════════════════════

# PZ/XX format (numbered drawing notes)
NOTES_PZ_FORMAT = [
    {
        "id": "PZ/01",
        "text": "Betonáž základové desky C30/37 XC2, tl. 400 mm, výztuž B500B",
        "work_type": "BETON",
    },
    {
        "id": "PZ/02",
        "text": "Sanace nosného zdiva — bourání omítek, reprofilace, nová omítka tl. 15 mm",
        "work_type": "BOURÁNÍ",
    },
    {
        "id": "PZ/03",
        "text": "Zateplení fasády kontaktním systémem ETICS, EPS 150 tl. 160 mm, U = 0,22 W/m²K",
        "work_type": "ZATEPLENÍ",
    },
]

# POZN. format (single labeled note)
NOTES_POZN_FORMAT = [
    {
        "note_id": "POZN.1",
        "text": "Podlahová konstrukce: mazanina C16/20 tl. 60 mm na PE fólii, nášlapná vrstva PVC",
        "work_type": "PODLAHY",
    },
]

# Free text format (no ID)
NOTES_FREE_FORMAT = [
    {
        "text": "Hydroizolace spodní stavby — 2× asfaltový pás SBS modifikovaný, celoplošně natavený",
        "work_type": None,  # Not pre-classified
    },
    {
        "text": "Střešní krytina: PVC fólie Sika tl. 1,5 mm, kotvená mechanicky, sklon 2,5 %",
    },
]

# Mixed — realistic drawing with various note types
NOTES_MIXED = NOTES_PZ_FORMAT + NOTES_POZN_FORMAT + NOTES_FREE_FORMAT

# Engine extractions dict (as it comes from document_processor)
ENGINE_EXTRACTIONS_WITH_NOTES = {
    "vykresy": {
        "poznamky": NOTES_MIXED,
        "beton_po_prvcich": [
            "NK – C30/37 XC2+XF1 krytí 40/50 mm",
        ],
        "stavba": "Polyfunkční dům Praha 5",
    },
    "base_construction": {
        "concrete_class": "C30/37",
        "exposure_classes": ["XC2", "XF1"],
    },
}

ENGINE_EXTRACTIONS_NO_NOTES = {
    "vykresy": {
        "beton_po_prvcich": ["ZD – C25/30 XC1"],
    },
    "base_construction": {
        "concrete_class": "C25/30",
    },
}

ENGINE_EXTRACTIONS_EMPTY = {}


# ═══════════════════════════════════════════════════════════════
# TESTS — convert_drawing_notes_to_requirements
# ═══════════════════════════════════════════════════════════════

class TestConvertDrawingNotes:
    """Test conversion of drawing notes to WorkRequirements."""

    def test_pz_format_notes(self):
        """PZ/XX format notes produce valid requirements."""
        reqs = convert_drawing_notes_to_requirements(NOTES_PZ_FORMAT)
        assert len(reqs) == 3

        # First note: concrete work
        r0 = reqs[0]
        assert r0.work_type == "BETON"
        assert r0.source_type == "drawing_note"
        assert r0.confidence == 0.90
        assert r0.extraction_method == "regex"
        assert "C30/37" in r0.description

        # Check regex extracted params from note text
        param_types = [p.type for p in r0.params]
        assert "concrete_class" in param_types

    def test_free_format_auto_detect_work_type(self):
        """Notes without pre-classified work_type get auto-detected."""
        reqs = convert_drawing_notes_to_requirements(NOTES_FREE_FORMAT)
        assert len(reqs) == 2

        # Hydroizolace → IZOLACE
        r0 = reqs[0]
        assert r0.work_type == "IZOLACE"
        assert r0.source_type == "drawing_note"

        # Střešní krytina → STŘECHA
        r1 = reqs[1]
        assert r1.work_type == "STŘECHA"

    def test_pozn_format(self):
        """POZN. format notes are correctly converted."""
        reqs = convert_drawing_notes_to_requirements(NOTES_POZN_FORMAT)
        assert len(reqs) == 1
        assert reqs[0].work_type == "PODLAHY"
        assert reqs[0].source_type == "drawing_note"

    def test_mixed_notes(self):
        """All note formats work together."""
        reqs = convert_drawing_notes_to_requirements(NOTES_MIXED)
        assert len(reqs) == 6  # 3 PZ + 1 POZN + 2 free

        # All should be drawing_note source
        assert all(r.source_type == "drawing_note" for r in reqs)
        assert all(r.confidence == 0.90 for r in reqs)

    def test_empty_notes_list(self):
        """Empty list returns empty requirements."""
        reqs = convert_drawing_notes_to_requirements([])
        assert reqs == []

    def test_short_notes_filtered(self):
        """Notes shorter than 10 chars are filtered out."""
        short_notes = [
            {"text": "OK", "work_type": "BETON"},
            {"text": "", "work_type": None},
            {"text": "   ", "work_type": None},
        ]
        reqs = convert_drawing_notes_to_requirements(short_notes)
        assert len(reqs) == 0

    def test_params_extracted_from_note_text(self):
        """Regex params are extracted from note text (thicknesses, norms, etc.)."""
        notes = [{
            "text": "Izolace tepelná EPS 150 tl. 160 mm dle ČSN 73 0540",
            "work_type": "ZATEPLENÍ",
        }]
        reqs = convert_drawing_notes_to_requirements(notes)
        assert len(reqs) == 1

        param_types = [p.type for p in reqs[0].params]
        assert "thickness" in param_types
        assert "norm" in param_types


# ═══════════════════════════════════════════════════════════════
# TESTS — extract_requirements_from_engine
# ═══════════════════════════════════════════════════════════════

class TestExtractFromEngine:
    """Test extraction of requirements from engine_extractions dict."""

    def test_with_drawing_notes(self):
        """Engine extractions with výkresy.poznamky produce requirements."""
        reqs = extract_requirements_from_engine(ENGINE_EXTRACTIONS_WITH_NOTES)
        assert len(reqs) == 6  # All 6 mixed notes
        assert all(r.source_type == "drawing_note" for r in reqs)

    def test_without_drawing_notes(self):
        """Engine extractions without poznámky produce zero requirements."""
        reqs = extract_requirements_from_engine(ENGINE_EXTRACTIONS_NO_NOTES)
        assert len(reqs) == 0

    def test_empty_engine(self):
        """Empty engine_extractions produce zero requirements."""
        reqs = extract_requirements_from_engine(ENGINE_EXTRACTIONS_EMPTY)
        assert len(reqs) == 0

    def test_ignores_non_vykresy_domains(self):
        """Only vykresy.poznamky is used, not base_construction or others."""
        reqs = extract_requirements_from_engine({
            "base_construction": {"concrete_class": "C30/37"},
            "norms": [{"csn": "ČSN EN 206"}],
        })
        assert len(reqs) == 0


# ═══════════════════════════════════════════════════════════════
# TESTS — Serialization with source_type
# ═══════════════════════════════════════════════════════════════

class TestSerialization:
    """Test that source_type is preserved in serialization."""

    def test_requirements_to_dict_includes_source_type(self):
        """requirements_to_dict includes source_type field."""
        reqs = convert_drawing_notes_to_requirements(NOTES_PZ_FORMAT[:1])
        dicts = requirements_to_dict(reqs)

        assert len(dicts) == 1
        assert dicts[0]["source_type"] == "drawing_note"
        assert dicts[0]["extraction_method"] == "regex"

    def test_tz_text_default_source_type(self):
        """Default WorkRequirement has source_type='tz_text'."""
        req = WorkRequirement(description="Test requirement")
        d = requirements_to_dict([req])
        assert d[0]["source_type"] == "tz_text"


# ═══════════════════════════════════════════════════════════════
# TESTS — AI metrics in engine merge
# ═══════════════════════════════════════════════════════════════

class TestAIMetrics:
    """Test AI merge metrics tracking."""

    def test_merge_metrics_fields_added(self):
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex_results = {
            "base_construction": {"concrete_class": "C30/37"},
        }
        ai_results = {
            "base_construction": {"concrete_class": "C25/30", "exposure": "XC2"},
            "strecha": {"hydroizolace_typ": "PVC fólie"},
        }

        merged, metrics = _merge_ai_into_regex(regex_results, ai_results)

        # concrete_class: regex wins → rejected
        # exposure: new field → added
        # strecha: new domain → added (1 field)
        assert metrics["ai_fields_rejected"] == 1
        assert metrics["ai_fields_added"] == 2  # exposure + hydroizolace_typ
        assert metrics["ai_domains_new"] == 1   # strecha

        # Verify regex value preserved
        assert merged["base_construction"]["concrete_class"] == "C30/37"
        # Verify AI field added
        assert merged["base_construction"]["exposure"] == "XC2"
        # Verify new domain from AI
        assert merged["strecha"]["hydroizolace_typ"] == "PVC fólie"

    def test_merge_metrics_no_ai(self):
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex_results = {"a": {"x": 1}}
        ai_results = {}

        merged, metrics = _merge_ai_into_regex(regex_results, ai_results)
        assert metrics["ai_fields_added"] == 0
        assert metrics["ai_fields_rejected"] == 0
        assert metrics["ai_domains_new"] == 0

    def test_merge_metrics_all_new(self):
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex_results = {}
        ai_results = {
            "domain_a": {"f1": "v1", "f2": "v2"},
            "domain_b": {"f3": "v3"},
        }

        merged, metrics = _merge_ai_into_regex(regex_results, ai_results)
        assert metrics["ai_fields_added"] == 3
        assert metrics["ai_fields_rejected"] == 0
        assert metrics["ai_domains_new"] == 2
