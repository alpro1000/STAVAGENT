"""
Tests for calculator_suggestions service — fact-to-param mapping + warning engine.

Tests:
  1. Direct mapping: concrete class, exposure, volume extraction
  2. Special concrete detection: SCC, prestressed, winter, massive, architectural
  3. Conflict resolution: two sources disagree on concrete class
  4. Warning generation: exposure class vs concrete class minimum
  5. SO filtering: only facts for the requested SO are returned
  6. Empty project: no facts → empty response, calculator works as before
  7. Czech number format: '1 386,7' → 1386.7

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import pytest
from app.services.calculator_suggestions import (
    map_facts_to_suggestions,
    get_calculator_suggestions,
    store_project_facts,
    _normalize_number,
    _extract_concrete_class,
    _extract_exposure_classes,
    _extract_volume,
    _is_scc,
    _is_prestressed,
    _concrete_class_rank,
)


# ── Helper: build a minimal extraction result doc ──

def _doc(name, so=None, text="", extractions=None, source_type="regex", pages=None):
    return {
        "document_name": name,
        "building_object": so,
        "source_type": source_type,
        "extractions": extractions or {},
        "raw_text": text,
        "pages": pages or {},
    }


# ─── Unit tests: utility functions ──────────────────────────────────────────

class TestNumberParsing:
    def test_czech_number(self):
        assert _normalize_number("1 386,7") == 1386.7

    def test_simple_number(self):
        assert _normalize_number("120.5") == 120.5

    def test_integer(self):
        assert _normalize_number("500") == 500.0

    def test_empty(self):
        assert _normalize_number("") is None

    def test_invalid(self):
        assert _normalize_number("abc") is None


class TestConcreteClassExtraction:
    def test_standard(self):
        assert _extract_concrete_class("beton C30/37") == "C30/37"

    def test_high_strength(self):
        assert _extract_concrete_class("beton C40/50") == "C40/50"

    def test_in_sentence(self):
        assert _extract_concrete_class("Nosná konstrukce z betonu třídy C25/30 dle ČSN") == "C25/30"

    def test_none(self):
        assert _extract_concrete_class("žádný beton") is None


class TestExposureClassExtraction:
    def test_single(self):
        result = _extract_exposure_classes("prostředí XC2")
        assert "XC2" in result

    def test_multiple(self):
        result = _extract_exposure_classes("XD1+XF2")
        assert "XD1" in result
        assert "XF2" in result

    def test_none(self):
        assert _extract_exposure_classes("žádné prostředí") == []


class TestVolumeExtraction:
    def test_standard(self):
        assert _extract_volume("objem 1386,7 m³") == 1386.7

    def test_m3(self):
        assert _extract_volume("245 m3") == 245.0

    def test_no_volume(self):
        assert _extract_volume("žádný objem") is None


class TestSpecialConcreteDetection:
    def test_scc(self):
        assert _is_scc("samozhutnitelný beton") is True
        assert _is_scc("SCC beton") is True
        assert _is_scc("beton C30/37") is False

    def test_prestressed(self):
        assert _is_prestressed("předpjatý beton") is True
        assert _is_prestressed("beton C30/37") is False


class TestConcreteClassRank:
    def test_order(self):
        assert _concrete_class_rank("C12/15") < _concrete_class_rank("C30/37")
        assert _concrete_class_rank("C30/37") < _concrete_class_rank("C40/50")

    def test_unknown(self):
        assert _concrete_class_rank("C99/99") == -1


# ─── Integration tests: map_facts_to_suggestions ────────────────────────────

class TestDirectMapping:
    def test_concrete_class_from_extractions(self):
        docs = [_doc("TZ", extractions={"base_construction": {"concrete_class": "C40/50"}})]
        resp = map_facts_to_suggestions(docs)
        by_param = {s.param: s for s in resp.suggestions}
        assert "concrete_class" in by_param
        assert by_param["concrete_class"].value == "C40/50"
        assert by_param["concrete_class"].source.confidence == 1.0

    def test_exposure_from_extractions(self):
        docs = [_doc("TZ", extractions={"base_construction": {"exposure_classes": "XD1+XF2"}})]
        resp = map_facts_to_suggestions(docs)
        by_param = {s.param: s for s in resp.suggestions}
        assert "exposure_class" in by_param
        vals = by_param["exposure_class"].value
        assert "XD1" in vals
        assert "XF2" in vals

    def test_volume_from_text(self):
        docs = [_doc("VV", text="NOSNÁ KONSTRUKCE beton C40/50: 1386,7 m³")]
        resp = map_facts_to_suggestions(docs)
        by_param = {s.param: s for s in resp.suggestions}
        assert "volume_m3" in by_param
        assert by_param["volume_m3"].value == 1386.7

    def test_scc_detected(self):
        docs = [_doc("TZ", text="Bude použit samozhutnitelný beton SCC")]
        resp = map_facts_to_suggestions(docs)
        by_param = {s.param: s for s in resp.suggestions}
        assert "is_scc" in by_param
        assert by_param["is_scc"].value is True

    def test_prestressed_detected(self):
        docs = [_doc("TZ", text="Nosná konstrukce z předpjatého betonu C40/50")]
        resp = map_facts_to_suggestions(docs)
        by_param = {s.param: s for s in resp.suggestions}
        assert "is_prestressed" in by_param
        assert "concrete_class" in by_param


class TestSOFiltering:
    def test_filters_by_so(self):
        docs = [
            _doc("TZ SO-203", so="SO-203", text="C40/50, objem 500 m³"),
            _doc("TZ SO-201", so="SO-201", text="C25/30, objem 180 m³"),
        ]
        resp = map_facts_to_suggestions(docs, building_object="SO-203")
        # Should only contain facts from SO-203
        assert len(resp.documents_used) == 1
        assert "TZ SO-203" in resp.documents_used

    def test_global_facts_included(self):
        docs = [
            _doc("TZ SO-203", so="SO-203", text="C40/50 beton"),
            _doc("Obecné podmínky", so=None, text="Zimní betonáž požadována"),
        ]
        resp = map_facts_to_suggestions(docs, building_object="SO-203")
        # Both SO-203 specific and global (so=None) docs should be included
        assert len(resp.documents_used) == 2

    def test_no_filter_returns_all(self):
        docs = [
            _doc("TZ SO-203", so="SO-203", text="C40/50 beton, objem 500 m³"),
            _doc("TZ SO-201", so="SO-201", text="C25/30 beton, objem 180 m³"),
        ]
        resp = map_facts_to_suggestions(docs, building_object=None)
        assert len(resp.documents_used) == 2


class TestConflictResolution:
    def test_same_value_no_conflict(self):
        docs = [
            _doc("TZ", extractions={"base_construction": {"concrete_class": "C40/50"}}),
            _doc("VV", extractions={"base_construction": {"concrete_class": "C40/50"}}),
        ]
        resp = map_facts_to_suggestions(docs)
        assert len(resp.conflicts) == 0

    def test_different_values_creates_conflict(self):
        docs = [
            _doc("TZ Statika", extractions={"base_construction": {"concrete_class": "C30/37"}}),
            _doc("Výkaz výměr", extractions={"base_construction": {"concrete_class": "C40/50"}}),
        ]
        resp = map_facts_to_suggestions(docs)
        assert len(resp.conflicts) == 1
        c = resp.conflicts[0]
        assert c.param == "concrete_class"
        assert len(c.values) == 2
        # TZ Statika has higher document priority → should be recommended
        assert c.recommended_value == "C30/37"

    def test_conflict_generates_warning(self):
        docs = [
            _doc("TZ", extractions={"base_construction": {"concrete_class": "C30/37"}}),
            _doc("VV", extractions={"base_construction": {"concrete_class": "C40/50"}}),
        ]
        resp = map_facts_to_suggestions(docs)
        conflict_warnings = [w for w in resp.warnings if w.rule == "conflict"]
        assert len(conflict_warnings) == 1


class TestWarningGeneration:
    def test_insufficient_concrete_class_for_exposure(self):
        """C25/30 is below minimum C30/37 for XA2."""
        docs = [_doc("TZ",
            extractions={"base_construction": {
                "concrete_class": "C25/30",
                "exposure_classes": "XA2",
            }}
        )]
        resp = map_facts_to_suggestions(docs)
        blocking = [w for w in resp.warnings if w.severity == "blocking"]
        assert len(blocking) >= 1
        assert "XA2" in blocking[0].message
        assert "C30/37" in blocking[0].message

    def test_sufficient_class_no_warning(self):
        """C40/50 is above minimum for XD1 (C25/30)."""
        docs = [_doc("TZ",
            extractions={"base_construction": {
                "concrete_class": "C40/50",
                "exposure_classes": "XD1",
            }}
        )]
        resp = map_facts_to_suggestions(docs)
        blocking = [w for w in resp.warnings if w.severity == "blocking"]
        assert len(blocking) == 0

    def test_prestressed_warning(self):
        docs = [_doc("TZ", text="Nosná konstrukce z předpjatého betonu")]
        resp = map_facts_to_suggestions(docs)
        blocking = [w for w in resp.warnings if w.severity == "blocking"]
        assert any("předpjat" in w.message.lower() for w in blocking)

    def test_scc_warning(self):
        docs = [_doc("TZ", text="Bude použit samozhutnitelný beton SCC")]
        resp = map_facts_to_suggestions(docs)
        recommended = [w for w in resp.warnings if w.severity == "recommended"]
        assert any("vibrování" in w.message.lower() for w in recommended)

    def test_winter_warning(self):
        docs = [_doc("TZ", text="Při zimní betonáži je nutno zajistit prohřev")]
        resp = map_facts_to_suggestions(docs)
        recommended = [w for w in resp.warnings if w.severity == "recommended"]
        assert any("zimní" in w.message.lower() for w in recommended)

    def test_architectural_warning(self):
        docs = [_doc("TZ", text="Požadavek na pohledový beton třídy PB2")]
        resp = map_facts_to_suggestions(docs)
        recommended = [w for w in resp.warnings if w.severity == "recommended"]
        assert any("pohledový" in w.message.lower() for w in recommended)


class TestEmptyProject:
    def test_empty_facts_returns_empty_response(self):
        resp = get_calculator_suggestions("nonexistent-project")
        assert len(resp.suggestions) == 0
        assert len(resp.warnings) == 0
        assert len(resp.conflicts) == 0


class TestSeededData:
    def test_so203_returns_suggestions(self):
        from app.services.calculator_suggestions_seed import seed_test_data, TEST_PROJECT_ID
        seed_test_data()

        resp = get_calculator_suggestions(TEST_PROJECT_ID, building_object="SO-203")
        assert resp.facts_count > 0
        by_param = {s.param: s for s in resp.suggestions}
        # Should find concrete class C40/50 from TZ Statika
        assert "concrete_class" in by_param
        assert by_param["concrete_class"].value == "C40/50"
        # Should find prestressed
        assert "is_prestressed" in by_param
        # SO-201 facts should NOT be present
        assert "TZ Statika — SO-201 Opěrná zeď" not in resp.documents_used

    def test_conflict_project(self):
        from app.services.calculator_suggestions_seed import seed_test_data
        seed_test_data()

        resp = get_calculator_suggestions("test-conflict-project", building_object="SO-301")
        assert len(resp.conflicts) >= 1
        # TZ Statika should win over Výkaz výměr
        by_param = {s.param: s for s in resp.suggestions}
        assert by_param["concrete_class"].value == "C30/37"

    def test_insufficient_class_project(self):
        from app.services.calculator_suggestions_seed import seed_test_data
        seed_test_data()

        resp = get_calculator_suggestions("test-insufficient-class", building_object="SO-401")
        blocking = [w for w in resp.warnings if w.severity == "blocking"]
        assert len(blocking) >= 1
        assert "XA2" in blocking[0].message
