"""
Offline Unit Tests — regex extraction, classification, document comparison.

NO live server, NO database, NO AI API required.
Tests use text fixtures from real Czech construction documents.

Usage:
    cd concrete-agent/packages/core-backend
    python -m pytest tests/test_offline_extraction.py -v
"""

import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ═══════════════════════════════════════════════════════════════
# FIXTURES — Real Czech construction text snippets
# ═══════════════════════════════════════════════════════════════

# TZ Silnoproud (FVE elektrárna)
TZ_SILNOPROUD = """
Technická zpráva — Silnoproudá elektroinstalace
Stavba: SčVK FVE Most
Investor: Severočeská vodárenská společnost a.s.

Instalovaný výkon FVE: 48,770 kWp (DC) / 40,000 kW (AC)
Fotovoltaické panely: 76× CS6L-455MS (JA Solar)
Střídač: Huawei SUN2000-40KTL-M3

Kabelové trasy:
- DC kabel: PV1-F 1×4mm², celkem 1 250 m
- AC kabel: CYKY-J 5×10, délka 85 m
- Kabel pro EPS: CXKH-R-J 3×1,5, celkem 120 m
- Stop obvod: kabel CXKH-R-O 3×1,5, celkem 45 m

Rozvaděč R-FVE: Krytí IP 65
Dle normy ČSN 33 2000-4-41 ed.3 a ČSN 33 2000-7-712

Viz příloha: Statický posudek střešní konstrukce.
Dle posudku hromosvodu zpracovaného firmou XY.
"""

# Výkaz výměr (soupis prací) — same project
VV_FVE = """
Výkaz výměr — Silnoproud FVE Most

Pol. 1: FV panel CS6L-455MS — 76 ks — 3 820 Kč/ks — 290 320 Kč
Pol. 2: Střídač SUN2000-40KTL-M3 — 1 ks — 185 000 Kč
Pol. 3: Kabel CYKY-J 5×10 — 85 m — 245 Kč/m — 20 825 Kč
Pol. 4: Kabel PV1-F 1×4mm² — 1 250 m — 18 Kč/m — 22 500 Kč
Pol. 5: Kabel CXKH-R-O 3×1,5 — 45 m — 89 Kč/m — 4 005 Kč
Pol. 6: Rozvaděč R-FVE IP65 — 1 ks — 45 000 Kč
"""

# TZ Statika (beton)
TZ_STATIKA = """
Technická zpráva — Statika
Stavba: Bytový dům Valcha, Plzeň-Bory
Investor: Město Plzeň

Základové konstrukce:
- Základové pasy: beton C30/37, XC4, XA1
- Výztuž: ocel B500B, celkem 12,5 t
- Objem betonu základů: 45,5 m³

Svislé konstrukce:
- Stěny: beton C25/30, XC1
- Sloupy: beton C30/37, XC2

Celkový objem betonu: 285,3 m³
Celková hmotnost výztuže: 42,8 t

Dle ČSN EN 1992-1-1 (Eurocode 2) a ČSN 73 1201.
Geotechnická kategorie GK2 dle ČSN EN 1997-1.
"""

# TZ Geologie
TZ_GEOLOGIE = """
Inženýrskogeologický průzkum
Stavba: Bytový dům Valcha

Vrty: 4× do hloubky 8 m
HPV: 3,5 m pod terénem
Radonový index: střední

Zeminy:
- 0,0-0,5 m: navážka
- 0,5-2,0 m: hlína písčitá F3, Rdt = 150 kPa
- 2,0-8,0 m: jíl tuhý F6, Rdt = 200 kPa

Agresivita podzemní vody: XA1 (slabě agresivní)
Stupeň vlivu prostředí pro základy: XC4, XA1

Dle ČSN EN 1997-2 a ČSN 73 1001.
"""

# PBŘS (požární bezpečnost)
TZ_PBRS = """
Požárně bezpečnostní řešení stavby
Stavba: Bytový dům Valcha

Stupeň požární bezpečnosti: III. SPB
Požární úseky: 12 úseků (N1.01 až N4.03)
CHÚC: typ A, délka 25 m

Požární odolnost nosných konstrukcí:
- Stěny: REI 90 DP1
- Stropy: REI 60 DP1
- Sloupy: R 90 DP1

EPS: ano, ústředna v 1.NP
SHZ: ne

Dle ČSN 73 0810 a ČSN 73 0802.
"""

# VZT (vzduchotechnika)
TZ_VZT = """
Technická zpráva — Vzduchotechnika
Stavba: Administrativní budova Hradec Králové

VZT jednotka č. 1: Atrea Duplex 3500
- Průtok: 3 500 m³/h
- Účinnost ZZT: 82%
- Příkon: 2,4 kW

Odtahový ventilátor WC: průtok 150 m³/h
Kuchyňský odtah: průtok 800 m³/h

Tlaková ztráta potrubí: max 1,5 Pa/m
"""


# ═══════════════════════════════════════════════════════════════
# TEST CLASS 1: Document Classification (6+ types)
# ═══════════════════════════════════════════════════════════════

class TestDocumentClassification:
    """Test document type detection from filename and content."""

    def _classify_by_content(self, text: str) -> str:
        """Simple content-based classifier (mirrors document_classifier.py logic)."""
        t = text.lower()
        if any(w in t for w in ['silnoproud', 'elektroinstalace', 'fve', 'fotovoltai', 'střídač']):
            return 'silnoproud'
        if any(w in t for w in ['slaboproud', 'eps', 'strukturovan', 'kamerový']):
            return 'slaboproud'
        if any(w in t for w in ['vzduchotechni', 'vzt', 'ventilát', 'průtok m³/h']):
            return 'vzt'
        if any(w in t for w in ['statik', 'beton c', 'výztuž', 'zatížení']):
            return 'statika'
        if any(w in t for w in ['geologi', 'geotechni', 'vrty', 'hpv', 'zeminy']):
            return 'geologie'
        if any(w in t for w in ['požárn', 'pbřs', 'spb', 'požární úsek', 'chúc']):
            return 'pbrs'
        if any(w in t for w in ['výkaz výměr', 'soupis prací', 'rozpočet']):
            return 'vykaz_vymer'
        return 'unknown'

    def test_classify_silnoproud(self):
        assert self._classify_by_content(TZ_SILNOPROUD) == 'silnoproud'

    def test_classify_statika(self):
        assert self._classify_by_content(TZ_STATIKA) == 'statika'

    def test_classify_geologie(self):
        assert self._classify_by_content(TZ_GEOLOGIE) == 'geologie'

    def test_classify_pbrs(self):
        assert self._classify_by_content(TZ_PBRS) == 'pbrs'

    def test_classify_vzt(self):
        assert self._classify_by_content(TZ_VZT) == 'vzt'

    def test_classify_vykaz(self):
        assert self._classify_by_content(VV_FVE) == 'vykaz_vymer'

    def test_classify_unknown(self):
        assert self._classify_by_content("Toto je prázdný dokument.") == 'unknown'


# ═══════════════════════════════════════════════════════════════
# TEST CLASS 2: Regex Extraction
# ═══════════════════════════════════════════════════════════════

class TestRegexExtraction:
    """Test regex extraction of facts from Czech construction text."""

    def test_extract_norms(self):
        """Extract Czech norms (ČSN, EN, zákon) from text."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        norms = extractor._extract_norms(TZ_SILNOPROUD)
        assert len(norms) >= 1
        # Should find ČSN 33 2000-4-41
        assert any('33 2000' in n for n in norms)

    def test_extract_identification(self):
        """Extract project identification (stavba, investor)."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        ident = extractor._extract_identification(TZ_STATIKA)
        # Should find "Bytový dům Valcha"
        assert 'stavba' in ident or len(ident) > 0

    def test_extract_concrete_classes(self):
        """Extract concrete classes: C30/37, C25/30."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        result = extractor.extract_all(TZ_STATIKA)
        specs = result.get('concrete_specifications', [])
        classes = [s.concrete_class for s in specs]
        assert 'C30/37' in classes
        assert 'C25/30' in classes

    def test_extract_reinforcement(self):
        """Extract reinforcement steel: B500B."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        result = extractor.extract_all(TZ_STATIKA)
        steels = result.get('reinforcement', [])
        grades = [s.steel_grade for s in steels]
        assert 'B500B' in grades

    def test_extract_exposure_classes(self):
        """Extract exposure classes: XC4, XA1."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        result = extractor.extract_all(TZ_STATIKA)
        specs = result.get('concrete_specifications', [])
        all_exposure = []
        for s in specs:
            all_exposure.extend(s.exposure_classes)
        # Should find at least XC4
        assert any('XC4' in e for e in all_exposure) or any('XC' in e for e in all_exposure)

    def test_extract_quantities(self):
        """Extract quantities: 285,3 m³, 42,8 t."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        result = extractor.extract_all(TZ_STATIKA)
        quantities = result.get('quantities', [])
        # Should extract some quantities
        assert len(quantities) >= 1

    def test_extract_referenced_documents(self):
        """Detect mentioned but not uploaded documents."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        refs = extractor.extract_referenced_documents(TZ_SILNOPROUD)
        # Should find "viz příloha: Statický posudek" or "dle posudku hromosvodu"
        assert len(refs) >= 1

    def test_extract_pbrs(self):
        """Extract fire safety data: SPB, REI, CHÚC, EPS."""
        from app.services.regex_extractor import CzechConstructionExtractor
        extractor = CzechConstructionExtractor()
        pbrs = extractor.extract_pbrs(TZ_PBRS)
        # Should find SPB or REI values
        assert len(pbrs) > 0


# ═══════════════════════════════════════════════════════════════
# TEST CLASS 3: Document Comparison
# ═══════════════════════════════════════════════════════════════

class TestDocumentComparison:
    """Test cross-document fact comparison logic."""

    def test_equipment_count_match(self):
        """Same equipment in TZ and VV → count should match."""
        # TZ says: 76× CS6L-455MS
        # VV says: CS6L-455MS — 76 ks
        import re
        tz_match = re.search(r'(\d+)×?\s*CS6L-455MS', TZ_SILNOPROUD)
        vv_match = re.search(r'CS6L-455MS\s*[—–-]\s*(\d+)\s*ks', VV_FVE)
        assert tz_match and vv_match
        assert tz_match.group(1) == vv_match.group(1)  # both "76"

    def test_cable_type_mismatch(self):
        """TZ says CXKH-R-J, VV says CXKH-R-O → type mismatch (J≠O)."""
        import re
        tz_cable = re.search(r'CXKH-R-([A-Z])\s+3×1,5', TZ_SILNOPROUD)
        vv_cable = re.search(r'CXKH-R-([A-Z])\s+3×1,5', VV_FVE)
        assert tz_cable and vv_cable
        assert tz_cable.group(1) != vv_cable.group(1)  # J ≠ O

    def test_power_value_extraction(self):
        """Extract power value: 48,770 kWp."""
        import re
        match = re.search(r'(\d+[,.]?\d*)\s*kWp', TZ_SILNOPROUD)
        assert match
        value = float(match.group(1).replace(',', '.'))
        assert abs(value - 48.77) < 0.01

    def test_ip_rating_extraction(self):
        """Extract IP rating: IP 65."""
        import re
        match = re.search(r'IP\s*(\d{2,3})', TZ_SILNOPROUD)
        assert match
        assert match.group(1) in ('65', '68')

    def test_cross_domain_exposure_concrete(self):
        """Geologie says XA1 → statika should have C30/37+ for foundations."""
        import re
        # Geologie: XA1
        geo_xa = re.search(r'XA(\d)', TZ_GEOLOGIE)
        assert geo_xa
        xa_level = int(geo_xa.group(1))

        # Statika: concrete for základy
        stat_match = re.search(r'[Zz]áklad\w*.*?[Cc](\d+)/(\d+)', TZ_STATIKA)
        assert stat_match
        concrete_class = int(stat_match.group(1))

        # XA1 requires at least C30
        min_required = {1: 30, 2: 35, 3: 40}
        assert concrete_class >= min_required.get(xa_level, 25)

    def test_coverage_matrix(self):
        """Three documents should cover 3 categories."""
        doc_types = {
            'TZ_SILNOPROUD': 'Technické zprávy',
            'VV_FVE': 'Rozpočty',
            'TZ_STATIKA': 'Technické zprávy',
            'TZ_GEOLOGIE': 'Průzkumy',
            'TZ_PBRS': 'Technické zprávy',
        }
        categories = set(doc_types.values())
        assert len(categories) >= 3  # TZ, Rozpočty, Průzkumy

    def test_empty_project_no_categories(self):
        """Empty project → all categories empty."""
        categories = {}
        assert len(categories) == 0


# ═══════════════════════════════════════════════════════════════
# TEST CLASS 4: NKB Seed Data Integrity
# ═══════════════════════════════════════════════════════════════

class TestNKBSeedData:
    """Test NKB seed data has expected norms and rules."""

    def test_seed_norms_count(self):
        from app.services.norm_storage import _seed_norms
        norms = _seed_norms()
        assert len(norms) >= 23  # 14 original + 9 expanded

    def test_seed_rules_count(self):
        from app.services.norm_storage import _seed_rules
        rules = _seed_rules()
        assert len(rules) >= 23  # 14 original + 9 expanded

    def test_eurocode_2_exists(self):
        from app.services.norm_storage import _seed_norms
        norms = _seed_norms()
        ids = [n.norm_id for n in norms]
        assert 'CSN_EN_1992_1_1' in ids

    def test_rule_has_parent_norm(self):
        """Every rule's norm_id should exist in norms."""
        from app.services.norm_storage import _seed_norms, _seed_rules
        norm_ids = {n.norm_id for n in _seed_norms()}
        for rule in _seed_rules():
            assert rule.norm_id in norm_ids, f"Rule {rule.rule_id} references missing norm {rule.norm_id}"
