"""
Tests for Regex Extractor (Layer 2)

Tests deterministic extraction of Czech construction data.
All extractions should have confidence=1.0 (no guessing).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-02-10
"""

import pytest
from app.services.regex_extractor import CzechConstructionExtractor
from app.models.passport_schema import (
    SteelGrade,
    ExposureClass,
    ExposedConcreteClass
)


class TestConcreteExtraction:
    """Test concrete class extraction"""

    def test_basic_concrete_class(self):
        """Test basic concrete class extraction: C30/37"""
        text = "Pro základy bude použit beton C30/37."
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        assert len(results['concrete_specifications']) == 1
        spec = results['concrete_specifications'][0]

        assert spec.concrete_class == "C30/37"
        assert spec.characteristic_strength == 30
        assert spec.cube_strength == 37
        assert spec.confidence == 1.0

    def test_concrete_with_exposure_classes(self):
        """Test concrete with exposure classes: C30/37 XC4 XF1"""
        text = "Beton pro obvodové stěny: C30/37 XC4 XF1"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        assert len(results['concrete_specifications']) == 1
        spec = results['concrete_specifications'][0]

        assert spec.concrete_class == "C30/37"
        assert ExposureClass.XC4 in spec.exposure_classes
        assert ExposureClass.XF1 in spec.exposure_classes
        assert len(spec.exposure_classes) == 2

    def test_multiple_concrete_classes(self):
        """Test multiple concrete classes in one document"""
        text = """
        Základy: C25/30 XC2
        Stěny: C30/37 XC4 XF1 XD2
        Stropy: C35/45 XC1
        """
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        assert len(results['concrete_specifications']) == 3

        classes = [s.concrete_class for s in results['concrete_specifications']]
        assert "C25/30" in classes
        assert "C30/37" in classes
        assert "C35/45" in classes

    def test_concrete_with_multiple_exposure(self):
        """Test concrete with multiple exposure classes"""
        text = "Základová deska: C30/37 XC4 XF4 XD2 XA1"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        spec = results['concrete_specifications'][0]
        assert len(spec.exposure_classes) == 4
        assert ExposureClass.XC4 in spec.exposure_classes
        assert ExposureClass.XF4 in spec.exposure_classes
        assert ExposureClass.XD2 in spec.exposure_classes
        assert ExposureClass.XA1 in spec.exposure_classes

    def test_standalone_exposure_classes(self):
        """Test finding all exposure classes in document"""
        text = """
        Třída prostředí:
        - Vnější: XC4, XF3
        - Garáž: XD3
        - Základy: XA2
        """
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        exposure_classes = results['exposure_classes_found']
        assert 'XC4' in exposure_classes
        assert 'XF3' in exposure_classes
        assert 'XD3' in exposure_classes
        assert 'XA2' in exposure_classes


class TestSteelExtraction:
    """Test reinforcement steel extraction"""

    def test_steel_grade_b500b(self):
        """Test B500B steel grade extraction"""
        text = "Betonářská výztuž B500B"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        assert len(results['reinforcement']) == 1
        steel = results['reinforcement'][0]

        assert steel.steel_grade == SteelGrade.B500B
        assert steel.confidence == 1.0

    def test_steel_grade_b500a(self):
        """Test B500A steel grade extraction"""
        text = "Hladká výztuž B500A"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        steel = results['reinforcement'][0]
        assert steel.steel_grade == SteelGrade.B500A

    def test_steel_grade_old_notation(self):
        """Test old steel notation: 10 505 (R)"""
        text = "Ocel 10 505 (R) pro předpínání"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        steel = results['reinforcement'][0]
        assert steel.steel_grade == SteelGrade.R10505

    def test_steel_with_total_mass(self):
        """Test steel with total mass extraction"""
        text = "Výztuž B500B, celkem 45,5 t"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        steel = results['reinforcement'][0]
        assert steel.total_mass_tons == 45.5


class TestQuantitiesExtraction:
    """Test quantities extraction (m³, m², t)"""

    def test_volume_m3_extraction(self):
        """Test m³ volume extraction"""
        text = "Objem betonu: 150 m³"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        quantities = results['quantities']
        volumes = [q for q in quantities if q.volume_m3]

        assert len(volumes) > 0
        assert volumes[0].volume_m3 == 150.0

    def test_volume_with_comma(self):
        """Test m³ with Czech comma notation"""
        text = "Stropy celkem 45,5 m³"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        volumes = [q for q in results['quantities'] if q.volume_m3]
        assert volumes[0].volume_m3 == 45.5

    def test_area_m2_extraction(self):
        """Test m² area extraction"""
        text = "Bednění celkem 1200 m²"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        areas = [q for q in results['quantities'] if q.area_m2]
        assert len(areas) > 0
        assert areas[0].area_m2 == 1200.0

    def test_mass_tons_extraction(self):
        """Test tons mass extraction"""
        text = "Výztuž celkem 12,3 t"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        masses = [q for q in results['quantities'] if q.mass_tons]
        assert len(masses) > 0
        assert masses[0].mass_tons == 12.3

    def test_multiple_quantities(self):
        """Test multiple quantities in document"""
        text = """
        Základy: 50 m³ betonu, 800 m² bednění
        Stěny: 80 m³ betonu, 1200 m² bednění
        Výztuž: 15,5 t
        """
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        volumes = [q.volume_m3 for q in results['quantities'] if q.volume_m3]
        areas = [q.area_m2 for q in results['quantities'] if q.area_m2]
        masses = [q.mass_tons for q in results['quantities'] if q.mass_tons]

        assert 50.0 in volumes
        assert 80.0 in volumes
        assert 800.0 in areas
        assert 1200.0 in areas
        assert 15.5 in masses


class TestBuildingDimensions:
    """Test building dimensions extraction"""

    def test_underground_floors(self):
        """Test underground floors extraction: 2PP"""
        text = "Budova má 2PP a 6NP"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        dimensions = results['dimensions']
        assert dimensions is not None
        assert dimensions.floors_underground == 2

    def test_above_ground_floors(self):
        """Test above-ground floors: 6NP"""
        text = "Objekt má 6 nadzemních podlaží"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        dimensions = results['dimensions']
        assert dimensions.floors_above_ground == 6

    def test_building_height(self):
        """Test building height extraction"""
        text = "Výška objektu: 24 m"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        dimensions = results['dimensions']
        assert dimensions.height_m == 24.0

    def test_built_up_area(self):
        """Test built-up area extraction"""
        text = "Zastavěná plocha 1500 m²"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        dimensions = results['dimensions']
        assert dimensions.built_up_area_m2 == 1500.0

    def test_complete_dimensions(self):
        """Test complete dimensions extraction"""
        text = """
        Objekt má 2.PP a 6.NP, výška 24 m.
        Zastavěná plocha 1200 m²
        """
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        dim = results['dimensions']
        assert dim.floors_underground == 2
        assert dim.floors_above_ground == 6
        assert dim.height_m == 24.0
        assert dim.built_up_area_m2 == 1200.0
        assert dim.confidence == 1.0


class TestSpecialRequirements:
    """Test special requirements extraction"""

    def test_white_tank_bila_vana(self):
        """Test Bílá vana (white tank) detection"""
        text = "Základová deska bude provedena jako bílá vana, vodotěsnost V8"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        reqs = results['special_requirements']
        assert len(reqs) > 0

        white_tank = [r for r in reqs if 'vana' in r.requirement_type.lower()]
        assert len(white_tank) > 0
        assert white_tank[0].confidence == 1.0

    def test_exposed_concrete(self):
        """Test Pohledový beton (exposed concrete)"""
        text = "Stěny budou provedeny jako pohledový beton PB2"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        reqs = results['special_requirements']
        exposed = [r for r in reqs if 'Pohledový' in r.requirement_type]

        assert len(exposed) > 0
        assert 'PB2' in exposed[0].description

    def test_watertightness_class(self):
        """Test watertightness class detection in white tank"""
        text = "Bílá vana tl. 300 mm, vodotěsnost V8"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        reqs = results['special_requirements']
        white_tank = [r for r in reqs if 'vana' in r.requirement_type.lower()]

        assert len(white_tank) > 0
        assert 'V8' in white_tank[0].description


class TestElementTypeInference:
    """Test element type inference from context"""

    def test_infer_zaklady(self):
        """Test inference of Základy (foundations)"""
        text = "Základové pasy celkem 50 m³ betonu"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        quantities = results['quantities']
        assert any('Základy' in q.element_type for q in quantities)

    def test_infer_steny(self):
        """Test inference of Stěny (walls)"""
        text = "Obvodové stěny: 80 m³ betonu"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        quantities = results['quantities']
        assert any('Stěny' in q.element_type for q in quantities)

    def test_infer_stropy(self):
        """Test inference of Stropy (slabs)"""
        text = "Stropní deska: 45,5 m³"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        quantities = results['quantities']
        assert any('Stropy' in q.element_type for q in quantities)

    def test_infer_vyztuz(self):
        """Test inference of Výztuž (reinforcement)"""
        text = "Betonářská výztuž celkem 15 t"
        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        quantities = results['quantities']
        assert any('Výztuž' in q.element_type for q in quantities)


class TestDiacriticsNormalization:
    """Test Czech diacritics handling"""

    def test_normalize_vyztuz(self):
        """Test výztuž → vyztuz normalization"""
        extractor = CzechConstructionExtractor()

        text1 = "výztuž armatura"
        text2 = "vyztuz armatura"

        norm1 = extractor._normalize_diacritics(text1)
        norm2 = extractor._normalize_diacritics(text2)

        assert norm1 == norm2

    def test_normalize_zaklad(self):
        """Test základ → zaklad normalization"""
        extractor = CzechConstructionExtractor()

        text1 = "základové pasy"
        text2 = "zakladove pasy"

        norm1 = extractor._normalize_diacritics(text1)
        norm2 = extractor._normalize_diacritics(text2)

        assert norm1 == norm2


class TestRealWorldSamples:
    """Test with real-world Czech construction documents"""

    def test_typical_technical_report(self):
        """Test typical technical report excerpt"""
        text = """
        3. KONSTRUKČNÍ ŘEŠENÍ

        3.1 Základy
        Objekt bude založen na základových pasech z betonu C25/30 XC2.
        Objem betonu: 50 m³
        Bednění: 800 m²

        3.2 Svislé nosné konstrukce
        Obvodové stěny tl. 300 mm z betonu C30/37 XC4 XF1.
        Vnitřní stěny tl. 250 mm z betonu C25/30 XC1.
        Celkem: 120 m³ betonu

        3.3 Vodorovné nosné konstrukce
        Stropy železobetonové monolitické tl. 250 mm z betonu C30/37 XC1.
        Celkem: 180 m³

        3.4 Výztuž
        Betonářská výztuž B500B, celkem 45,5 t

        3.5 Dispozice
        Objekt má 2 podzemní podlaží (2.PP) a 6 nadzemních podlaží (6.NP).
        Výška objektu: 24 m
        Zastavěná plocha: 1200 m²

        3.6 Speciální požadavky
        Základová deska bude provedena jako bílá vana, vodotěsnost V8, tl. 350 mm.
        """

        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        # Check concrete classes
        concrete_classes = [s.concrete_class for s in results['concrete_specifications']]
        assert "C25/30" in concrete_classes
        assert "C30/37" in concrete_classes

        # Check exposure classes
        specs = results['concrete_specifications']
        assert any(ExposureClass.XC4 in s.exposure_classes for s in specs)
        assert any(ExposureClass.XF1 in s.exposure_classes for s in specs)

        # Check steel
        assert len(results['reinforcement']) > 0
        assert results['reinforcement'][0].steel_grade == SteelGrade.B500B
        assert results['reinforcement'][0].total_mass_tons == 45.5

        # Check quantities
        volumes = [q.volume_m3 for q in results['quantities'] if q.volume_m3]
        assert 50.0 in volumes  # Základy
        assert 120.0 in volumes  # Stěny
        assert 180.0 in volumes  # Stropy

        # Check dimensions
        dim = results['dimensions']
        assert dim.floors_underground == 2
        assert dim.floors_above_ground == 6
        assert dim.height_m == 24.0
        assert dim.built_up_area_m2 == 1200.0

        # Check special requirements
        reqs = results['special_requirements']
        assert any('vana' in r.requirement_type.lower() for r in reqs)

    def test_extraction_stats(self):
        """Test extraction statistics"""
        text = """
        Základy: C25/30, 50 m³
        Stěny: C30/37 XC4, 80 m³
        Výztuž B500B: 25 t
        Pohledový beton PB2
        """

        extractor = CzechConstructionExtractor()
        results = extractor.extract_all(text)

        stats = extractor.get_stats()

        assert stats['concrete_matches'] == 2
        assert stats['steel_matches'] == 1
        assert stats['special_req_matches'] >= 1  # May match both "Pohledový beton" and "PB2"
        assert stats['quantity_matches'] > 0


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
