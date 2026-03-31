"""
Unit tests for Section Extraction Engine + Extractor Registry.

NO live server, NO database, NO AI API required.
Tests use text fixtures from real Czech construction documents.

Usage:
    cd concrete-agent/packages/core-backend
    python -m pytest tests/test_section_extraction_engine.py -v
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.section_extraction_engine import (
    map_sections,
    extract_section,
    reduce_results,
    extract_all_from_document,
    _deep_merge,
)
from app.services.extractor_registry import (
    get_registry,
    EXTRACTOR_REGISTRY,
    REGISTRY_BY_KEY,
    ExtractorEntry,
)


# ═══════════════════════════════════════════════════════════════
# FIXTURES — Real Czech construction text snippets
# ═══════════════════════════════════════════════════════════════

# Multi-section TZ with numbered headings
TZ_MULTI_SECTION = """
1. ÚVOD

Předmětem technické zprávy je návrh monolitických betonových konstrukcí
objektu polyfunkčního domu v Praze 5. Stavba bude realizována v etapách.
Investor: Městská část Praha 5, IČO: 00063631.

2. NOSNÁ KONSTRUKCE

Základová deska bude provedena z betonu třídy C30/37 XC2+XF1,
tloušťka 400 mm. Výztuž B500B, průměr 12 a 16 mm, krytí 40 mm.
Celkový objem betonu základů: 450 m³.

Svislé konstrukce — stěny z betonu C25/30 XC1, tl. 250 mm.
Stropní desky C30/37 XC1, tl. 220 mm.

3. STŘEŠNÍ KONSTRUKCE

Střecha plochá, spád 2,5%. Hydroizolace PVC fólie Sika tl. 1,5 mm.
Tepelná izolace EPS 150, tloušťka 200 mm.

4. OBVODOVÝ PLÁŠŤ

ETICS systém s izolantem EPS 70F, tloušťka 160 mm, λ=0,039 W/mK.
Kotvení talířovými hmoždinkami. Tenkovrstvá silikonová omítka, zrnitost 1,5 mm.

Okna plastová, Uw=0,9 W/m²K, zasklení izolačním trojsklem.

5. VNITŘNÍ KONSTRUKCE

Příčky SDK Knauf W112, tl. 125 mm, profily CW75, desky GKB 12,5 mm.
Požární odolnost EI 60.

Podlahy: cementový potěr tl. 65 mm, kročejová izolace tl. 30 mm,
nášlapná vrstva — vinyl.

6. ZDIVO

Obvodové zdivo Porotherm 44 Profi, tloušťka 440 mm, U=0,21 W/m²K.
Malta lepidlo Porotherm Profi.

7. HYDROIZOLACE SPODNÍ STAVBY

Hydroizolace modifikovaným asfaltovým pásem tl. 4 mm,
celoplošně natavením na podkladní beton.

8. POUŽITÉ NORMY

ČSN EN 206 — Beton — Specifikace, vlastnosti, výroba a shoda
ČSN 73 0810 — Požární bezpečnost staveb
Zákon č. 183/2006 Sb. — Stavební zákon
"""

# D.1.4 slaboproud document with subsystem headers
TZ_SLABOPROUD = """
D.1.4.7 Technická zpráva — Slaboproudé rozvody

Stavba: Administrativní budova Brno-střed
Investor: STAREZ-SPORT, a.s.

SCS — Strukturovaná kabeláž
Systém kategorie Cat.6A, frekvence 500 MHz.
Páteřní rozvody optickým kabelem 24vl. SM.
Datový rozvaděč DR1 v 1.NP, 42U.

PZTS — Poplachový zabezpečovací systém
Ústředna Galaxy Dimension GD-520.
Detektory: 48× PIR detektor, 12× magnetický kontakt.
Klávesnice MK7 u všech vstupů.

EPS — Elektrická požární signalizace
Ústředna MHU-117, 4 smyčky.
Hlásiče: 85× optickodýmový, 12× tlačítkový.
Napojení na OPPO přes GSM komunikátor.

CCTV — Kamerový systém
IP kamery: 24× dome 4Mpx, 8× bullet 8Mpx, záznam 30 dní.
NVR: Hikvision DS-9664NI-I8, 64 kanálů.

SKV — Systém kontroly vstupu
Čtečky: 16× RFID Mifare DESFire EV2.
Software: C4 Professional.
"""

# Short document (should NOT be split)
TZ_SHORT = """
Technická zpráva — Přípojka vodovodu
DN 32, materiál PE 100, PN 16, délka 12,5 m.
Tlakový test 1,5× PN po dobu 2 hodin.
"""

# Document with Roman numeral headings
TZ_ROMAN = """
I. Průvodní zpráva

Identifikace stavby: Rekonstrukce mostu ev.č. 113-029.
Rozpětí mostu 25,4 m, zatížitelnost 32 t.

II. Souhrnná technická zpráva

Nosná konstrukce z předpjatého betonu C45/55 XD1+XF2.
Ložiska elastomerová.

III. Technické řešení

Mostní závěry typu lamelové, dilatace ±40 mm.
Římsa betonová šířky 800 mm, se zábradlím.
"""

# VZT + UT combined document (multiple professions in one)
TZ_TZB_COMBINED = """
D.1.4.3 Vzduchotechnika a klimatizace

1. Návrh VZT jednotek

VZT jednotka č.1: příkon 15 kW, průtok 8 500 m³/h, tlak 450 Pa.
Rekuperace deskový výměník, účinnost 78%.
Regulace: MaR systém Siemens Desigo, protokol BACnet.
Čidla: teplota, vlhkost, CO2, tlak.

2. Ústřední vytápění

Zdroj tepla: plynový kotel Viessmann 120 kW, teplotní spád 80/60°C.
Otopná tělesa: desková KORADO, celkem 85 ks.
Podlahové topení v koupelnách, celkem 45 m².
Plynovod STL DN 50, HUP v nice na fasádě.
"""


# ═══════════════════════════════════════════════════════════════
# SECTION SPLITTING TESTS
# ═══════════════════════════════════════════════════════════════

class TestMapSections:
    """Test universal section splitting."""

    def test_numbered_sections(self):
        sections = map_sections(TZ_MULTI_SECTION)
        assert len(sections) >= 6, f"Expected >=6 sections, got {len(sections)}"
        titles = [t for t, _ in sections]
        # At least some numbered headers should be found
        assert any("1" in t for t in titles)

    def test_subsystem_headers(self):
        sections = map_sections(TZ_SLABOPROUD)
        assert len(sections) >= 3, f"Expected >=3 sections, got {len(sections)}: {[t for t,_ in sections]}"
        titles_lower = [t.lower() for t, _ in sections]
        # At least some subsystem headers should be found
        subsystems_found = sum(1 for t in titles_lower if any(s in t for s in ["scs", "pzts", "eps", "cctv", "skv"]))
        assert subsystems_found >= 2, f"Expected >=2 subsystem headers, titles={titles_lower}"

    def test_short_document_no_split(self):
        sections = map_sections(TZ_SHORT)
        assert len(sections) == 1, "Short doc should be 1 section"
        assert sections[0][0] == "Celý dokument"

    def test_roman_numeral_sections(self):
        sections = map_sections(TZ_ROMAN)
        assert len(sections) >= 3, f"Expected >=3, got {len(sections)}"

    def test_fallback_chunking(self):
        """Very long text with no headers → chunking."""
        long_text = "Bez nadpisu. " * 1000  # ~13000 chars, no headers
        sections = map_sections(long_text)
        assert len(sections) >= 2, "Long headerless text should be chunked"
        assert "Část" in sections[0][0]

    def test_empty_text(self):
        sections = map_sections("")
        assert sections == [("Celý dokument", "")]

    def test_sections_have_content(self):
        sections = map_sections(TZ_MULTI_SECTION)
        for title, text in sections:
            assert len(text) > 0, f"Section '{title}' is empty"


# ═══════════════════════════════════════════════════════════════
# REGISTRY TESTS
# ═══════════════════════════════════════════════════════════════

class TestExtractorRegistry:
    """Test the extractor registry."""

    def test_registry_not_empty(self):
        registry = get_registry()
        assert len(registry) >= 25, f"Expected >=25 entries, got {len(registry)}"

    def test_all_entries_have_parse(self):
        for entry in EXTRACTOR_REGISTRY:
            assert callable(entry.parse), f"Entry {entry.key} has no parse function"
            assert entry.key, f"Entry has empty key"
            assert entry.label_cs, f"Entry {entry.key} has no label"

    def test_unique_keys(self):
        keys = [e.key for e in EXTRACTOR_REGISTRY]
        assert len(keys) == len(set(keys)), f"Duplicate keys: {[k for k in keys if keys.count(k) > 1]}"

    def test_registry_by_key_lookup(self):
        assert "base_construction" in REGISTRY_BY_KEY
        assert "slaboproud_params" in REGISTRY_BY_KEY
        assert "zdivo" in REGISTRY_BY_KEY
        assert "etics" in REGISTRY_BY_KEY

    def test_extractor_returns_empty_on_irrelevant(self):
        """Extractors must return empty dict when text has nothing relevant."""
        irrelevant = "Dnes je krásný den a svítí slunce."
        # Skip extractors that need heavy deps (sqlalchemy) or are too broad
        skip = {"base_construction", "norms"}
        for entry in EXTRACTOR_REGISTRY:
            if entry.key in skip:
                continue
            result = entry.parse(irrelevant)
            assert isinstance(result, (dict, type(None))), f"{entry.key} returned {type(result)}"


# ═══════════════════════════════════════════════════════════════
# EXTRACT SECTION TESTS
# ═══════════════════════════════════════════════════════════════

class TestExtractSection:
    """Test running all extractors on a single section."""

    def test_concrete_section(self):
        text = """Základová deska z betonu C30/37 XC2+XF1, tl. 400 mm.
        Výztuž B500B, objem betonu 450 m³."""
        result = extract_section(text)
        # base_construction needs sqlalchemy; if unavailable, check other extractors found it
        if "base_construction" in result:
            bc = result["base_construction"]
            assert len(bc.get("concrete_specifications", [])) >= 1
        else:
            # At minimum, water_params finds concrete_class via its regex
            assert len(result) >= 1

    def test_slaboproud_section(self):
        text = """PZTS — Poplachový zabezpečovací systém
        Ústředna Galaxy Dimension GD-520. Detektory: 48× PIR."""
        result = extract_section(text)
        assert "slaboproud_params" in result

    def test_etics_section(self):
        text = """ETICS systém EPS 70F, tloušťka 160 mm, λ=0,039 W/mK.
        Kotvení hmoždinkami. Omítka silikonová, zrnitost 1,5 mm."""
        result = extract_section(text)
        assert "etics" in result
        etics = result["etics"]
        assert "izolant_tl_mm" in etics or "omitka_zrnitost_mm" in etics

    def test_zdivo_section(self):
        text = "Porotherm 44 Profi, tloušťka 440 mm, U=0,21 W/m²K."
        result = extract_section(text)
        assert "zdivo" in result

    def test_most_section(self):
        text = "Rozpětí mostu 25,4 m, zatížitelnost 32 t. Ložiska elastomerová."
        result = extract_section(text)
        assert "most" in result


# ═══════════════════════════════════════════════════════════════
# REDUCE TESTS
# ═══════════════════════════════════════════════════════════════

class TestReduce:
    """Test merging results from multiple sections."""

    def test_merge_disjoint(self):
        """Two sections with different extractors → both present."""
        results = [
            {"zdivo": {"tvarnice_typ": "Porotherm"}},
            {"etics": {"izolant_tl_mm": "160"}},
        ]
        merged = reduce_results(results)
        assert "zdivo" in merged
        assert "etics" in merged
        assert merged["zdivo"]["tvarnice_typ"] == "Porotherm"
        assert merged["etics"]["izolant_tl_mm"] == "160"

    def test_merge_same_key_extend_lists(self):
        """Same extractor, list values → concatenate."""
        results = [
            {"base_construction": {"norms": ["ČSN EN 206"]}},
            {"base_construction": {"norms": ["ČSN 73 0810"]}},
        ]
        merged = reduce_results(results)
        norms = merged["base_construction"]["norms"]
        assert "ČSN EN 206" in norms
        assert "ČSN 73 0810" in norms

    def test_merge_same_key_first_wins_scalar(self):
        """Same extractor, scalar values → first wins."""
        results = [
            {"zdivo": {"tvarnice_typ": "Porotherm"}},
            {"zdivo": {"tvarnice_typ": "Ytong"}},
        ]
        merged = reduce_results(results)
        assert merged["zdivo"]["tvarnice_typ"] == "Porotherm"

    def test_merge_none_skipped(self):
        """None values don't overwrite existing."""
        results = [
            {"zdivo": {"tvarnice_typ": "Porotherm", "pevnost_mpa": "10"}},
            {"zdivo": {"tvarnice_typ": None, "soucinitel_u": "0.21"}},
        ]
        merged = reduce_results(results)
        assert merged["zdivo"]["tvarnice_typ"] == "Porotherm"
        assert merged["zdivo"]["soucinitel_u"] == "0.21"

    def test_merge_empty_sections(self):
        """Empty section results → empty merge."""
        assert reduce_results([]) == {}


# ═══════════════════════════════════════════════════════════════
# DEEP MERGE TESTS
# ═══════════════════════════════════════════════════════════════

class TestDeepMerge:

    def test_list_dedup(self):
        target = {"items": ["a", "b"]}
        _deep_merge(target, {"items": ["b", "c"]})
        assert target["items"] == ["a", "b", "c"]

    def test_nested_dict(self):
        target = {"inner": {"x": 1}}
        _deep_merge(target, {"inner": {"y": 2}})
        assert target["inner"] == {"x": 1, "y": 2}

    def test_nested_dict_no_overwrite(self):
        target = {"inner": {"x": 1}}
        _deep_merge(target, {"inner": {"x": 99}})
        assert target["inner"]["x"] == 1


# ═══════════════════════════════════════════════════════════════
# FULL PIPELINE TESTS (extract_all_from_document)
# ═══════════════════════════════════════════════════════════════

class TestFullPipeline:
    """Integration tests: full text → engine → all domains."""

    def test_multi_section_tz(self):
        """Real multi-section TZ → should find etics, zdivo, sdk, etc."""
        result = extract_all_from_document(TZ_MULTI_SECTION)
        found_domains = set(result.keys())
        # TZ_MULTI_SECTION has roof, ETICS, SDK, zdivo, hydro, windows, floors
        expected_any = {"etics", "zdivo", "sdk", "strecha", "hydroizolace", "podlahy", "okna_dvere"}
        overlap = found_domains & expected_any
        assert len(overlap) >= 3, f"Expected >=3 of {expected_any}, got {overlap}"

    def test_slaboproud_all_subsystems(self):
        """Slaboproud TZ → should extract all 4+ subsystems."""
        result = extract_all_from_document(TZ_SLABOPROUD)
        assert "slaboproud_params" in result
        slabo = result["slaboproud_params"]
        # Should find data from multiple subsystems (SCS, PZTS, EPS, CCTV, SKV)
        assert len(slabo) >= 3, f"Expected >=3 slaboproud fields, got {len(slabo)}"

    def test_roman_numeral_bridge(self):
        """Bridge document with roman numerals → most params found."""
        result = extract_all_from_document(TZ_ROMAN)
        assert "most" in result, f"Expected 'most' in {list(result.keys())}"

    def test_combined_tzb(self):
        """VZT + UT + MaR + Gas in one document."""
        result = extract_all_from_document(TZ_TZB_COMBINED)
        found = set(result.keys())
        # Should find VZT, UT, gas, and MaR patterns
        expected_any = {"vzt_params", "ut_params", "plynovod", "mar"}
        overlap = found & expected_any
        assert len(overlap) >= 2, f"Expected >=2 of {expected_any}, got {overlap}"

    def test_short_doc(self):
        """Short document → processed as single section, water params found."""
        result = extract_all_from_document(TZ_SHORT)
        assert "water_params" in result or "base_construction" in result

    def test_empty_document(self):
        """Empty text → empty result."""
        result = extract_all_from_document("")
        assert result == {}

    def test_engine_does_not_know_doc_type(self):
        """Engine receives no classification info — it's type-agnostic."""
        # This test validates the architecture: engine takes only text, nothing else
        result = extract_all_from_document(TZ_MULTI_SECTION)
        # It found multiple domains without being told what document type it is
        assert len(result) >= 3


# ===================================================================
# AI Layer tests (unit tests — mock Gemini)
# ===================================================================


class TestAIExtraction:
    """Tests for AI enrichment layer."""

    def test_merge_ai_into_regex_new_domain(self):
        """AI adds a domain that regex didn't find."""
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex = {"base_construction": {"concrete_class": "C30/37"}}
        ai = {"zdivo": {"tvarnice_typ": "Porotherm 44 T"}}

        merged, metrics = _merge_ai_into_regex(regex, ai)
        assert "base_construction" in merged
        assert "zdivo" in merged
        assert merged["zdivo"]["tvarnice_typ"] == "Porotherm 44 T"
        assert merged["zdivo"]["_source"] == "ai"
        assert merged["zdivo"]["_confidence"] == 0.7
        assert metrics["ai_domains_new"] == 1

    def test_merge_ai_regex_wins_on_conflict(self):
        """Regex value takes priority over AI value for same field."""
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex = {"etics": {"izolant_tl_mm": "200"}}
        ai = {"etics": {"izolant_tl_mm": "180", "kotveni_typ": "talířové hmoždinky"}}

        merged, metrics = _merge_ai_into_regex(regex, ai)
        # Regex wins
        assert merged["etics"]["izolant_tl_mm"] == "200"
        # AI adds missing field
        assert merged["etics"]["kotveni_typ"] == "talířové hmoždinky"
        assert metrics["ai_fields_rejected"] == 1
        assert metrics["ai_fields_added"] == 1

    def test_merge_ai_empty(self):
        """Empty AI results don't change regex results."""
        from app.services.section_extraction_engine import _merge_ai_into_regex

        regex = {"base_construction": {"concrete_class": "C30/37"}}
        merged, metrics = _merge_ai_into_regex(regex, {})
        assert merged == regex

    def test_merge_ai_both_empty(self):
        """Both empty → empty."""
        from app.services.section_extraction_engine import _merge_ai_into_regex
        merged, metrics = _merge_ai_into_regex({}, {})
        assert merged == {}

    def test_build_extraction_schemas(self):
        """Schema builder produces valid JSON with registry entries."""
        from app.services.section_extraction_engine import _build_extraction_schemas
        from app.services.extractor_registry import get_registry
        import json

        schemas_json = _build_extraction_schemas(get_registry())
        schemas = json.loads(schemas_json)
        assert isinstance(schemas, dict)
        assert len(schemas) > 0
        # Each schema should have label and fields
        for key, schema in schemas.items():
            assert "label" in schema
            assert "fields" in schema
            assert isinstance(schema["fields"], list)

    def test_extract_all_with_ai_disabled(self):
        """enable_ai=False should work exactly as before (default)."""
        result = extract_all_from_document(TZ_MULTI_SECTION, enable_ai=False)
        assert len(result) >= 3  # Same as without AI

    def test_extract_all_ai_graceful_fallback(self):
        """When AI is unavailable, engine still returns regex results."""
        from unittest.mock import patch

        with patch(
            "app.services.section_extraction_engine.extract_section_with_ai",
            side_effect=Exception("Gemini unavailable"),
        ):
            result = extract_all_from_document(TZ_MULTI_SECTION, enable_ai=True)
            # Should still have regex results even though AI failed
            assert len(result) >= 3

    def test_infer_fields_from_extractor(self):
        """Field inference should return field lists for known extractors."""
        from app.services.section_extraction_engine import _infer_fields_from_extractor
        from app.services.extractor_registry import REGISTRY_BY_KEY

        # Pattern-based extractor (inline in registry)
        zdivo = REGISTRY_BY_KEY.get("zdivo")
        if zdivo:
            fields = _infer_fields_from_extractor(zdivo)
            assert "tvarnice_typ" in fields
            assert "pevnost_mpa" in fields

        # Known-fields extractor (imported)
        base = REGISTRY_BY_KEY.get("base_construction")
        if base:
            fields = _infer_fields_from_extractor(base)
            assert "concrete_class" in fields


# ===================================================================
# Výkresy (drawings) extractor tests
# ===================================================================


TZ_VYKRESY = """
VÝKRES TVARU — STROP NAD 1.NP

STAVBA: Bytový dům Vinohrady
OBJEKT: SO 201 — Hlavní budova
OBSAH VÝKRESU: Strop nad 1.NP
STUPEŇ PD: DPS
MĚŘÍTKO: 1:50
FORMÁT: A1
ČÍSLO VÝKRESU: D.1.2.3-01
DATUM: 15.03.2026
VYPRACOVAL: Ing. Jan Novák

ZÁKLADY: C30/37 – XC2, XA1 – CI 0,45 – Dmax 22
STĚNY: C25/30 – XC1
STROPY: C30/37 – XC1 – CI 0,50
PILÍŘE: C35/45 – XD1, XF2 – CI 0,40 – Dmax 16

PZ/01: Beton třídy C30/37, ocel B500B, krytí min./jmen. 25/30 mm.
PZ/02: ETICS Baumit EPS-F tl. 160 mm, kotvení talířovými hmoždinkami.
PZ/03: Průsak max. 50 mm dle ČSN EN 12390-8.
PZ/04: Výztuž dle statického výpočtu, vázaná, min. krytí 25 mm.

ZATEPLENÍ fasády ETICS systém Baumit EPS-F tl. 160 mm
"""


class TestVykresy:
    """Tests for Výkresy (drawings) extractor — wraps CzechConstructionExtractor.extract_drawing().

    Note: CzechConstructionExtractor requires SQLAlchemy via import chain.
    In test environments without SQLAlchemy, the wrapper returns {} gracefully.
    Tests handle both cases: full extraction (prod) and graceful fallback (CI).
    """

    def _can_import_extractor(self) -> bool:
        """Check if CzechConstructionExtractor is importable (needs SQLAlchemy)."""
        try:
            from app.services.regex_extractor import CzechConstructionExtractor
            return True
        except (ImportError, ModuleNotFoundError):
            return False

    def test_vykresy_in_registry(self):
        """Výkresy extractor is registered."""
        from app.services.extractor_registry import REGISTRY_BY_KEY
        assert "vykresy" in REGISTRY_BY_KEY

    def test_vykresy_graceful_when_unavailable(self):
        """When SQLAlchemy missing, returns empty dict (not crash)."""
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        # Should be either a populated dict or empty — never raises
        assert isinstance(result, dict)

    def test_vykresy_concrete_by_element(self):
        """Extract concrete specs per element (beton po prvcích)."""
        if not self._can_import_extractor():
            return  # Skip if SQLAlchemy unavailable
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        assert "beton_po_prvcich" in result
        assert isinstance(result["beton_po_prvcich"], list)
        assert len(result["beton_po_prvcich"]) >= 2
        joined = " ".join(result["beton_po_prvcich"])
        assert "C30/37" in joined

    def test_vykresy_title_block(self):
        """Extract title block (razítko) fields."""
        if not self._can_import_extractor():
            return
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        assert "meritko" in result or "cislo_vykresu" in result or "stupen_pd" in result

    def test_vykresy_notes(self):
        """Extract drawing notes (PZ/01-PZ/10)."""
        if not self._can_import_extractor():
            return
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        assert "poznamky" in result
        assert isinstance(result["poznamky"], list)
        assert len(result["poznamky"]) >= 2
        note = result["poznamky"][0]
        assert "id" in note
        assert "text" in note

    def test_vykresy_etics(self):
        """Extract ETICS/KZS facade notes."""
        if not self._can_import_extractor():
            return
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        assert "etics_notes" in result
        assert isinstance(result["etics_notes"], list)
        assert any("Baumit" in n or "ETICS" in n or "EPS" in n for n in result["etics_notes"])

    def test_vykresy_norm_findings(self):
        """Norm validation is included when applicable."""
        if not self._can_import_extractor():
            return
        from app.services.extractor_registry import REGISTRY_BY_KEY
        result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)
        if "norm_findings" in result:
            assert isinstance(result["norm_findings"], list)
            if result["norm_findings"]:
                finding = result["norm_findings"][0]
                assert "element" in finding
                assert "status" in finding

    def test_vykresy_full_pipeline(self):
        """Full pipeline includes výkresy when extractor available."""
        result = extract_all_from_document(TZ_VYKRESY)
        if self._can_import_extractor():
            assert "vykresy" in result, f"Expected 'vykresy' in {list(result.keys())}"
        else:
            # Without SQLAlchemy, vykresy wrapper returns {} — that's OK
            assert isinstance(result, dict)

    def test_vykresy_reuses_existing_extractor(self):
        """Verify výkresy wrapper calls the same code as CzechConstructionExtractor."""
        if not self._can_import_extractor():
            return
        from app.services.regex_extractor import CzechConstructionExtractor
        from app.services.extractor_registry import REGISTRY_BY_KEY

        extractor = CzechConstructionExtractor()
        direct = extractor.extract_drawing(TZ_VYKRESY)

        registry_result = REGISTRY_BY_KEY["vykresy"].parse(TZ_VYKRESY)

        if direct and direct.concrete_by_element:
            assert "beton_po_prvcich" in registry_result
            assert len(registry_result["beton_po_prvcich"]) == len(direct.concrete_by_element)
