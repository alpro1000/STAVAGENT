"""
Tests for drawing (výkres) extraction — Layer 2 regex.

Covers:
- Concrete by element (legend tables on bridge/building drawings)
- Cover (krytí minimální/jmenovité)
- Penetration (průsak)
- SCC detection
- ETICS/KZS notes
- Drawing notes (PZ/01-PZ/10)
- Title block (razítko/štampové pole)

All tests are OFFLINE — no server, no DB, no AI API needed.
"""

import pytest
from app.services.regex_extractor import CzechConstructionExtractor


@pytest.fixture
def extractor():
    return CzechConstructionExtractor()


# =============================================================================
# Sample texts — realistic Czech construction drawing content
# =============================================================================

BRIDGE_DRAWING_LEGEND = """
LEGENDA BETONŮ:

ZÁKLADY: C30/37 – XF2, XC2, XA1 – CI 0,4 – Dmax 22
PILÍŘE: C35/45 – XF4, XD3, XC4 – CI 0,2 – Dmax 16 – S4
NOSNÁ KONSTRUKCE: C45/55 – XF2, XC4, XD1 – Cl 0,2 – Dmax 22 – S3
ŘÍMSY: C30/37 – XF4, XC4 – CI 0,4 – Dmax 16

KRYTÍ MINIMÁLNÍ 40 mm / JMENOVITÉ 50 mm
MAX. PRŮSAK 20 mm PODLE ČSN EN 12390-8

OCEL: B500B
"""

BUILDING_DRAWING_LEGEND = """
BETON:
Základová deska: C25/30 XC2 - Dmax 22 - S3
Stěny 1PP: C30/37 XC4,XF1 - CI 0,55 - Dmax 16
Stropy: C25/30 XC1 - Dmax 22
Sloupy: C30/37 XC1 - Dmax 16 - samozhutnitelný beton

Krytí min. 25 mm
Krytí jmenovité 30 mm
"""

SCC_DRAWING = """
POZNÁMKY K BETONÁŽI:
Pro sloupy 3.NP a 4.NP bude použit SCC beton třídy C35/45.
Samozhutnitelný beton požadován pro hustě vyztužené prvky.
"""

ETICS_DRAWING = """
ZATEPLENÍ KZS Z PĚNOVÉHO POLYSTYRÉNU EPS 70F O TL. 160MM
KONTAKTNÍ ZATEPLOVACÍ SYSTÉM ETICS, MINERÁLNÍ VATA TL. 120MM NA SOKLU
KZS FASÁDA - DESKY Z ČEDIČOVÉ VLNY TL. 200 MM
"""

NOTES_DRAWING = """
POZNÁMKY:

PZ/01: Betonáž základových patek provádět při teplotě nad +5°C. Ošetřování
betonu min. 7 dní. Třída betonu C25/30 XC2.

PZ/02 - Bednění stěn bude systémové (DOKA Framax nebo ekvivalent).
Odbedňovací lhůta min. 3 dny při průměrné teplotě 15°C.

PZ/03: Výztuž B500B, průměry dle statického výpočtu. Krytí výztuže
dle ČSN EN 1992-1-1, min. 25 mm.

PZ/04 – Hydroizolace spodní stavby – asfaltové pásy 2x, svařované.
Ochranná vrstva geotextílie 500 g/m².

PZ/05: ETICS fasáda — EPS 70F tl. 160mm, kotvy talířové 8ks/m².

POZN. 6: Podlahy v 1.NP — litý anhydritový potěr tl. 65 mm.
"""

TITLE_BLOCK_TEXT = """
STAVBA: Modernizace trati Brno - Přerov, 2. stavba
OBJEKT: SO 201 Most v km 15,234
OBSAH VÝKRESU: Příčný řez v polovině rozpětí
STUPEŇ PD: PDPS
MĚŘÍTKO: 1:50
FORMÁT: A1
ČÍSLO VÝKRESU: D.2.1.01
DATUM: 15.03.2026
REVIZE: B
VYPRACOVAL: Ing. Jan Novák
ZODPOVĚDNÝ PROJEKTANT: Ing. Pavel Dvořák, Ph.D., ČKAIT 0123456
"""

COVER_COMBINED_TEXT = """
KRYTÍ min./jmen. 40/50 mm
"""

COVER_SEPARATE_TEXT = """
KRYTÍ MINIMÁLNÍ 35 mm
KRYTÍ JMENOVITÉ 45 mm
"""

PENETRATION_TEXT = """
Průsak max 25mm dle ČSN EN 12390-8
Vodotěsnost dle ČSN EN 12390-8, max. průsak 20 mm
"""


# =============================================================================
# Tests: Concrete by element
# =============================================================================

class TestConcreteByElement:
    def test_bridge_legend_basic(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        assert result is not None
        assert len(result.concrete_by_element) >= 4

    def test_bridge_zaklady(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        zaklady = [c for c in result.concrete_by_element if 'ZÁKLAD' in c.element]
        assert len(zaklady) == 1
        z = zaklady[0]
        assert z.concrete_class == 'C30/37'
        assert any(e.value == 'XF2' for e in z.exposure_classes)
        assert any(e.value == 'XC2' for e in z.exposure_classes)
        assert any(e.value == 'XA1' for e in z.exposure_classes)
        assert z.max_wc_ratio == 0.4
        assert z.dmax_mm == 22

    def test_bridge_pilire(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        pilire = [c for c in result.concrete_by_element if 'PILÍŘ' in c.element or 'PILIR' in c.element]
        assert len(pilire) == 1
        p = pilire[0]
        assert p.concrete_class == 'C35/45'
        assert p.consistency_class == 'S4'
        assert p.max_wc_ratio == 0.2

    def test_bridge_nk(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        nk = [c for c in result.concrete_by_element if 'NOSN' in c.element or 'NK' in c.element]
        assert len(nk) == 1
        assert nk[0].concrete_class == 'C45/55'
        assert nk[0].consistency_class == 'S3'

    def test_building_legend(self, extractor):
        result = extractor.extract_drawing(BUILDING_DRAWING_LEGEND)
        assert result is not None
        assert len(result.concrete_by_element) >= 3

    def test_building_scc_element(self, extractor):
        result = extractor.extract_drawing(BUILDING_DRAWING_LEGEND)
        sloupy = [c for c in result.concrete_by_element if 'SLOUP' in c.element]
        assert len(sloupy) == 1
        assert sloupy[0].scc is True

    def test_element_dedup(self, extractor):
        """Same element name should not appear twice."""
        text = """
        ZÁKLADY: C30/37 – XC2
        ZÁKLADY: C30/37 – XC2
        """
        result = extractor.extract_drawing(text)
        assert result is not None
        zaklady = [c for c in result.concrete_by_element if 'ZÁKLAD' in c.element]
        assert len(zaklady) == 1

    def test_confidence_always_1(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        for c in result.concrete_by_element:
            assert c.confidence == 1.0


# =============================================================================
# Tests: Cover + Penetration
# =============================================================================

class TestCoverAndPenetration:
    def test_cover_from_bridge(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        # Cover should be picked up for elements near the cover text
        has_cover = any(
            c.cover_min_mm is not None or c.cover_nom_mm is not None
            for c in result.concrete_by_element
        )
        assert has_cover

    def test_penetration_from_bridge(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        has_pen = any(c.max_penetration_mm is not None for c in result.concrete_by_element)
        assert has_pen

    def test_cover_combined(self, extractor):
        text = "STĚNY: C30/37 – XC4\n" + COVER_COMBINED_TEXT
        result = extractor.extract_drawing(text)
        assert result is not None
        steny = result.concrete_by_element[0]
        assert steny.cover_min_mm == 40
        assert steny.cover_nom_mm == 50

    def test_cover_separate(self, extractor):
        text = "SLOUPY: C35/45 – XC1\n" + COVER_SEPARATE_TEXT
        result = extractor.extract_drawing(text)
        assert result is not None
        sloupy = result.concrete_by_element[0]
        assert sloupy.cover_min_mm == 35
        assert sloupy.cover_nom_mm == 45


# =============================================================================
# Tests: SCC
# =============================================================================

class TestSCC:
    def test_scc_detected(self, extractor):
        result = extractor.extract_drawing(SCC_DRAWING)
        assert result is not None
        assert result.has_scc is True

    def test_no_scc(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        assert result is not None
        assert result.has_scc is False

    def test_scc_in_element(self, extractor):
        result = extractor.extract_drawing(BUILDING_DRAWING_LEGEND)
        sloupy = [c for c in result.concrete_by_element if 'SLOUP' in c.element]
        assert len(sloupy) == 1
        assert sloupy[0].scc is True


# =============================================================================
# Tests: ETICS
# =============================================================================

class TestETICS:
    def test_etics_found(self, extractor):
        result = extractor.extract_drawing(ETICS_DRAWING)
        assert result is not None
        assert len(result.etics_notes) >= 2

    def test_etics_content(self, extractor):
        result = extractor.extract_drawing(ETICS_DRAWING)
        texts = ' '.join(result.etics_notes).upper()
        assert 'POLYSTYR' in texts or 'EPS' in texts
        assert 'MINERÁLNÍ' in texts or 'ČEDIČ' in texts or 'KZS' in texts

    def test_no_etics(self, extractor):
        result = extractor.extract_drawing(BRIDGE_DRAWING_LEGEND)
        assert result is not None
        assert len(result.etics_notes) == 0


# =============================================================================
# Tests: Drawing Notes (PZ)
# =============================================================================

class TestDrawingNotes:
    def test_notes_found(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        assert result is not None
        assert len(result.notes) >= 5

    def test_note_ids(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        ids = {n.note_id for n in result.notes}
        assert 'PZ/01' in ids
        assert 'PZ/02' in ids
        assert 'PZ/03' in ids

    def test_note_work_type_beton(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        pz01 = [n for n in result.notes if n.note_id == 'PZ/01']
        assert len(pz01) == 1
        assert pz01[0].work_type == 'BETON'

    def test_note_work_type_bedneni(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        pz02 = [n for n in result.notes if n.note_id == 'PZ/02']
        assert len(pz02) == 1
        assert pz02[0].work_type == 'BEDNĚNÍ'

    def test_note_work_type_vyztuz(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        pz03 = [n for n in result.notes if n.note_id == 'PZ/03']
        assert len(pz03) == 1
        assert pz03[0].work_type == 'VÝZTUŽ'

    def test_note_work_type_izolace(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        pz04 = [n for n in result.notes if n.note_id == 'PZ/04']
        assert len(pz04) == 1
        assert pz04[0].work_type == 'IZOLACE'

    def test_note_work_type_etics(self, extractor):
        result = extractor.extract_drawing(NOTES_DRAWING)
        pz05 = [n for n in result.notes if n.note_id == 'PZ/05']
        assert len(pz05) == 1
        assert pz05[0].work_type == 'ETICS'


# =============================================================================
# Tests: Title Block (razítko)
# =============================================================================

class TestTitleBlock:
    def test_title_block_found(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert result is not None
        assert result.title_block is not None

    def test_title_block_stavba(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        tb = result.title_block
        assert 'Modernizace' in tb.stavba
        assert 'Brno' in tb.stavba

    def test_title_block_objekt(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        tb = result.title_block
        assert 'SO 201' in tb.objekt or 'Most' in tb.objekt

    def test_title_block_stupen(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert result.title_block.stupen_pd == 'PDPS'

    def test_title_block_meritko(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert '1' in result.title_block.meritko and '50' in result.title_block.meritko

    def test_title_block_format(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert result.title_block.format == 'A1'

    def test_title_block_cislo(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert 'D.2.1.01' in result.title_block.cislo_vykresu

    def test_title_block_datum(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert '15' in result.title_block.datum and '2026' in result.title_block.datum

    def test_title_block_revize(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert result.title_block.revize == 'B'

    def test_title_block_projektant(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert 'Novák' in result.title_block.projektant

    def test_title_block_zodpovedny(self, extractor):
        result = extractor.extract_drawing(TITLE_BLOCK_TEXT)
        assert 'Dvořák' in result.title_block.zodpovedny_projektant


# =============================================================================
# Tests: extract_all integration
# =============================================================================

class TestExtractAllIntegration:
    def test_drawing_data_in_extract_all(self, extractor):
        """Drawing data should be included in extract_all results."""
        result = extractor.extract_all(BRIDGE_DRAWING_LEGEND)
        assert 'drawing_data' in result
        assert result['drawing_data'] is not None
        assert len(result['drawing_data'].concrete_by_element) >= 4

    def test_no_drawing_for_plain_tz(self, extractor):
        """Plain TZ text without drawing patterns should return None."""
        text = """
        Technická zpráva popisuje provedení betonových prací.
        Beton třídy C30/37 bude použit pro základy.
        """
        result = extractor.extract_all(text)
        # extract_all includes drawing_data key but may be None
        assert result.get('drawing_data') is None

    def test_stats_updated(self, extractor):
        extractor.extract_all(BRIDGE_DRAWING_LEGEND)
        stats = extractor.get_stats()
        assert stats.get('drawing_elements', 0) >= 4


# =============================================================================
# Tests: Full drawing (combined bridge content)
# =============================================================================

class TestFullBridgeDrawing:
    """Simulate a real bridge drawing text (legend + notes + title block)."""

    FULL_TEXT = BRIDGE_DRAWING_LEGEND + "\n\n" + NOTES_DRAWING + "\n\n" + TITLE_BLOCK_TEXT

    def test_all_sections_present(self, extractor):
        result = extractor.extract_drawing(self.FULL_TEXT)
        assert result is not None
        assert len(result.concrete_by_element) >= 4
        assert len(result.notes) >= 5
        assert result.title_block is not None

    def test_no_false_positives(self, extractor):
        """Empty text should not match."""
        result = extractor.extract_drawing("")
        assert result is None

    def test_minimal_match(self, extractor):
        """Just a title block should be enough to create DrawingData."""
        text = "STAVBA: Test\nSTUPEŇ PD: DPS\nFORMÁT: A3"
        result = extractor.extract_drawing(text)
        assert result is not None
        assert result.title_block is not None
        assert result.title_block.stupen_pd == 'DPS'
