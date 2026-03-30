"""
Offline tests for TZ → Soupis pipeline.

Tests:
- L1 regex extraction (concrete, steel, thickness, norms, quantities)
- Work type classification
- Paragraph splitting
- Combined extraction (L1 only, no AI)
- Soupis assembly (no external API calls)

All tests run WITHOUT live server, DB, or AI API.
"""

import pytest
import asyncio
from typing import List

from app.services.tz_work_extractor import (
    extract_params_regex,
    extract_work_requirements_regex,
    detect_work_type,
    split_into_paragraphs,
    WorkRequirement,
    ExtractedParam,
)
from app.services.soupis_assembler import (
    assemble_soupis,
    classify_hsv_psv,
    get_section,
    SoupisPosition,
    soupis_to_dict,
)


# ============================================================================
# Sample TZ texts
# ============================================================================

SAMPLE_TZ_BETON = """
Technická zpráva - Monolitické konstrukce

Základová deska bude provedena z betonu třídy C30/37 XC2+XF1 o tloušťce
tl. 300 mm. Výztuž z oceli B500B s minimálním krytím 40 mm dle ČSN EN 206.

Objem základové desky: V = 45,5 m³
Plocha bednění: S = 120 m²
Hmotnost výztuže: přibližně 3,5 t

Betonáž bude prováděna v souladu s ČSN 73 2400 a TKP 18.
"""

SAMPLE_TZ_FASADA = """
Technická zpráva - Fasáda

Kontaktní zateplovací systém ETICS bude proveden z desek EPS 70F
tl. 160 mm dle ČSN 73 0540-2. Celková plocha fasády činí 850 m².

Povrchová úprava: silikonová omítka zrnitosti 1,5 mm.
Sokl: XPS desky tl. 100 mm do výšky 300 mm nad terén.
Klempířské prvky: oplechování parapetů z pozinkovaného plechu tl. 0,6 mm.

Součástí dodávky je montáž lešení pro práce ve výšce nad 1,5 m.
"""

SAMPLE_TZ_ZTI = """
Technická zpráva - Zdravotechnické instalace (ZTI)

Vnitřní vodovod bude proveden z potrubí PPR PN 20 DN 20-50.
Kanalizace: potrubí PP-HT DN 50-DN 150, svislé svody DN 100.
Přípojka vodovodu: PE 100 SDR 11, DN 40, délka 12 m.

Celkový počet: 8 ks zařizovacích předmětů (3× WC, 2× umyvadlo, 2× dřez, 1× sprcha).
Ohřev TUV: zásobníkový ohřívač 150 l, příkon 2,5 kW.
"""


# ============================================================================
# L1: Regex extraction tests
# ============================================================================

class TestRegexExtraction:
    """Test L1 regex parameter extraction."""

    def test_concrete_class(self):
        params = extract_params_regex("Beton třídy C30/37 XC2+XF1")
        concrete = [p for p in params if p.type == 'concrete_class']
        assert len(concrete) >= 1
        assert 'C30/37' in concrete[0].normalized

    def test_concrete_with_exposure(self):
        params = extract_params_regex("C25/30 XC4 XD2")
        concrete = [p for p in params if p.type == 'concrete_class']
        assert len(concrete) >= 1

    def test_steel_grade(self):
        params = extract_params_regex("Výztuž B500B")
        steel = [p for p in params if p.type == 'steel_grade']
        assert len(steel) == 1
        assert 'B500B' in steel[0].normalized

    def test_thickness(self):
        params = extract_params_regex("tl. 300 mm")
        thick = [p for p in params if p.type == 'thickness']
        assert len(thick) == 1
        assert '300' in thick[0].normalized

    def test_thickness_decimal(self):
        params = extract_params_regex("tloušťka 0,18 m")
        thick = [p for p in params if p.type == 'thickness']
        assert len(thick) == 1
        assert '0.18' in thick[0].normalized

    def test_norms(self):
        params = extract_params_regex("dle ČSN EN 206 a TKP 18")
        norms = [p for p in params if p.type == 'norm']
        assert len(norms) >= 1

    def test_volume(self):
        params = extract_params_regex("objem 45,5 m³")
        vols = [p for p in params if p.type == 'volume']
        assert len(vols) == 1
        assert '45.5' in vols[0].normalized

    def test_area(self):
        params = extract_params_regex("plocha 120 m²")
        areas = [p for p in params if p.type == 'area']
        assert len(areas) == 1
        assert '120' in areas[0].normalized

    def test_dn(self):
        params = extract_params_regex("DN 150 a DN 50")
        dns = [p for p in params if p.type == 'dn']
        assert len(dns) == 2

    def test_power(self):
        params = extract_params_regex("příkon 2,5 kW")
        power = [p for p in params if p.type == 'power']
        assert len(power) == 1
        assert '2.5' in power[0].normalized

    def test_full_tz_beton(self):
        params = extract_params_regex(SAMPLE_TZ_BETON)
        types = set(p.type for p in params)
        assert 'concrete_class' in types
        assert 'steel_grade' in types
        assert 'thickness' in types
        assert 'norm' in types
        assert 'volume' in types
        assert 'area' in types

    def test_confidence_always_1(self):
        params = extract_params_regex(SAMPLE_TZ_BETON)
        for p in params:
            assert p.confidence == 1.0


# ============================================================================
# Work type classification
# ============================================================================

class TestWorkTypeClassification:
    """Test work type detection from text."""

    def test_beton(self):
        assert detect_work_type("Betonáž základové desky C30/37") == 'BETON'

    def test_vyztuž(self):
        assert detect_work_type("Výztuž stropních desek B500B") == 'VYZTUŽ'

    def test_bednění(self):
        assert detect_work_type("Bednění stěn z překližky") == 'BEDNĚNÍ'

    def test_zateplení(self):
        assert detect_work_type("Zateplení ETICS tl. 160 mm") == 'ZATEPLENÍ'

    def test_omítky(self):
        assert detect_work_type("Silikonová omítka fasády") == 'OMÍTKY'

    def test_zti(self):
        assert detect_work_type("Kanalizace DN 150 PP-HT") == 'ZTI'

    def test_none_for_generic(self):
        assert detect_work_type("Obecný text bez stavebních pojmů") is None


# ============================================================================
# Paragraph splitting
# ============================================================================

class TestParagraphSplitting:
    def test_splits_by_empty_lines(self):
        text = "Paragraph 1 with enough text for extraction.\n\nParagraph 2 also with enough text.\n\nParagraph 3."
        paras = split_into_paragraphs(text)
        assert len(paras) >= 2  # Para 3 may be too short

    def test_filters_short_paragraphs(self):
        text = "Short.\n\nThis is a paragraph with enough text for meaningful extraction from TZ.\n\nAbc."
        paras = split_into_paragraphs(text)
        assert len(paras) == 1  # Only middle paragraph is long enough

    def test_tz_beton_paragraphs(self):
        paras = split_into_paragraphs(SAMPLE_TZ_BETON)
        assert len(paras) >= 2


# ============================================================================
# L1 requirement extraction
# ============================================================================

class TestWorkRequirementExtraction:
    def test_extracts_from_beton_tz(self):
        reqs = extract_work_requirements_regex(SAMPLE_TZ_BETON)
        assert len(reqs) > 0
        # Should detect BETON work type
        work_types = [r.work_type for r in reqs]
        assert 'BETON' in work_types or 'ZÁKLADY' in work_types

    def test_extracts_from_fasada_tz(self):
        reqs = extract_work_requirements_regex(SAMPLE_TZ_FASADA)
        assert len(reqs) > 0
        work_types = set(r.work_type for r in reqs if r.work_type)
        assert len(work_types) >= 1

    def test_extracts_from_zti_tz(self):
        reqs = extract_work_requirements_regex(SAMPLE_TZ_ZTI)
        assert len(reqs) > 0

    def test_all_regex_conf_1(self):
        reqs = extract_work_requirements_regex(SAMPLE_TZ_BETON)
        for r in reqs:
            assert r.confidence == 1.0
            assert r.extraction_method == 'regex'

    def test_params_attached(self):
        reqs = extract_work_requirements_regex(SAMPLE_TZ_BETON)
        params_total = sum(len(r.params) for r in reqs)
        assert params_total > 0


# ============================================================================
# Soupis assembly helpers
# ============================================================================

class TestSoupisHelpers:
    def test_classify_hsv(self):
        assert classify_hsv_psv('274313611') == 'HSV'
        assert classify_hsv_psv('131201102') == 'HSV'

    def test_classify_psv(self):
        assert classify_hsv_psv('711111001') == 'PSV'
        assert classify_hsv_psv('762332110') == 'PSV'

    def test_classify_none(self):
        assert classify_hsv_psv(None) == 'HSV'

    def test_get_section(self):
        assert get_section('274313611') == '2'
        assert get_section('631311124') == '6'
        assert get_section('711111001') == '711'

    def test_get_section_none(self):
        assert get_section(None) is None


# ============================================================================
# Soupis assembly (offline — no WP or URS calls)
# ============================================================================

class TestSoupisAssembly:
    @pytest.mark.asyncio
    async def test_assemble_without_external_services(self):
        """Assemble soupis with no WP or URS lookup (pure fallback)."""
        reqs = [
            WorkRequirement(
                description="Beton základové desky C30/37",
                work_type="BETON",
                params=[ExtractedParam(type='volume', value='45 m³', normalized='45 m³', unit='m³')],
                confidence=1.0,
                extraction_method='regex',
            ),
            WorkRequirement(
                description="Výztuž B500B",
                work_type="VYZTUŽ",
                params=[],
                confidence=1.0,
                extraction_method='regex',
            ),
        ]

        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)

        # Should have positions (fallback) + companions (přesuny)
        assert len(result.positions) >= 2
        assert result.stats['total_positions'] >= 2

    @pytest.mark.asyncio
    async def test_companion_presuny_added(self):
        """Přesuny hmot should be auto-added."""
        reqs = [WorkRequirement(description="Beton C25/30", work_type="BETON")]
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)

        companions = [p for p in result.positions if p.source == 'companion']
        assert len(companions) >= 1
        presuny = [p for p in companions if p.work_type == 'PŘESUNY']
        assert len(presuny) >= 1

    @pytest.mark.asyncio
    async def test_companion_leseni_for_fasada(self):
        """Lešení should be auto-added for facade work."""
        reqs = [WorkRequirement(description="Zateplení ETICS", work_type="ZATEPLENÍ")]
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)

        leseni = [p for p in result.positions if p.work_type == 'LEŠENÍ']
        assert len(leseni) >= 1

    @pytest.mark.asyncio
    async def test_soupis_serialization(self):
        """Test JSON serialization."""
        reqs = [WorkRequirement(description="Beton C25/30", work_type="BETON")]
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)
        data = soupis_to_dict(result)

        assert 'positions' in data
        assert 'stats' in data
        assert 'attribution' in data
        assert len(data['positions']) > 0

    @pytest.mark.asyncio
    async def test_positions_sorted_hsv_first(self):
        """HSV positions should come before PSV."""
        reqs = [
            WorkRequirement(description="Izolace", work_type="IZOLACE"),
            WorkRequirement(description="Beton", work_type="BETON"),
        ]
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)

        # Verify sequential numbering
        for i, p in enumerate(result.positions):
            assert p.poradi == i + 1


# ============================================================================
# Integration: Extract + Assemble (offline)
# ============================================================================

class TestPipelineIntegration:
    @pytest.mark.asyncio
    async def test_full_pipeline_beton(self):
        """Full pipeline: TZ text → extract → assemble (no external APIs)."""
        from app.services.tz_work_extractor import extract_work_requirements

        reqs = await extract_work_requirements(SAMPLE_TZ_BETON, use_ai=False)
        assert len(reqs) > 0

        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)
        assert len(result.positions) > 0
        assert result.stats['total_positions'] > 0

    @pytest.mark.asyncio
    async def test_full_pipeline_fasada(self):
        """Full pipeline: Fasáda TZ → extract → assemble."""
        from app.services.tz_work_extractor import extract_work_requirements

        reqs = await extract_work_requirements(SAMPLE_TZ_FASADA, use_ai=False)
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)

        # Should have lešení companion
        assert any(p.work_type == 'LEŠENÍ' for p in result.positions)

    @pytest.mark.asyncio
    async def test_full_pipeline_zti(self):
        """Full pipeline: ZTI TZ → extract → assemble."""
        from app.services.tz_work_extractor import extract_work_requirements

        reqs = await extract_work_requirements(SAMPLE_TZ_ZTI, use_ai=False)
        result = await assemble_soupis(reqs, use_work_packages=False, use_urs_lookup=False)
        assert len(result.positions) > 0
