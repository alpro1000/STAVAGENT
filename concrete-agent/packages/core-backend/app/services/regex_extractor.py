"""
Regex Extractor - Layer 2

Deterministic extraction of Czech construction data using regex patterns.
All extractions have confidence=1.0 (no guessing, only matched text).

Extracts:
- Concrete classes: C25/30, C30/37 XC4 XF1
- Exposure classes: XC1-XC4, XD1-XD3, XF1-XF4, XA1-XA3, XM1-XM3
- Steel grades: B500A, B500B, 10 505 (R)
- Quantities: 150 m³, 45,5 m², 12,3 t
- Building dimensions: 2PP, 6NP
- Special requirements: Bílá vana, Pohledový beton PB2

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-02-10
"""

import re
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass
import logging

from app.models.passport_schema import (
    ConcreteSpecification,
    ReinforcementSpecification,
    QuantityItem,
    BuildingDimensions,
    SpecialRequirement,
    ExposureClass,
    SteelGrade,
    ConcreteType,
    ExposedConcreteClass,
    TenderInfo,
    ConcreteByElement,
    DrawingNote,
    DrawingNormFinding,
    TitleBlock,
    DrawingData,
)

logger = logging.getLogger(__name__)


@dataclass
class ExtractedFact:
    """A single extracted fact with context"""
    type: str
    value: str
    raw_text: str
    context: str  # Surrounding text for debugging
    confidence: float = 1.0  # Regex = 100% confidence


class CzechConstructionExtractor:
    """
    Regex-based extractor for Czech construction documents.

    All patterns are deterministic - if matched, confidence is 1.0.
    No AI guessing at this layer.
    """

    # =============================================================================
    # REGEX PATTERNS
    # =============================================================================

    PATTERNS = {
        # Concrete class: C25/30, C30/37, C35/45, etc.
        # Optional exposure classes after: XC4 XF1 XD2
        'concrete_class': r'C\s?(\d{2})/(\d{2})(?:\s+((?:X[CADFMS]\d\s*)+))?',

        # Exposure classes standalone: XC1, XC4, XF3, XA2
        'exposure_class': r'X[CADFMS]\d',

        # Steel grades: B500A, B500B, B500C, 10 505 (R)
        'steel_grade': r'B\s?500\s?[ABC]|10\s?505(?:\s?\([Rr]\))?',

        # Volumes: 150 m³, 1500m3, 45,5 m³, 12.5 m3
        'volume_m3': r'(\d+[\s,.]?\d*)\s*m[³3]',

        # Areas: 1200 m², 45,5 m2
        'area_m2': r'(\d+[\s,.]?\d*)\s*m[²2]',

        # Mass: 45,5 t, 12.3 tun, 150t
        'mass_tons': r'(\d+[\s,.]?\d*)\s*[tT](?:un)?(?:\s|$)',

        # Watertightness: V4, V8, V12, vodotěsnost
        'watertight': r'(?:^|\s)(V[48]|V1[02])(?:\s|$|,)|[Vv]odot[eě]sn\w*\s+(V[48]|V1[02])',

        # White tank: Bílá vana, bílá vana, vodotěsná konstrukce
        'white_tank': r'[Bb][íi]l[aá]\s+vana|vodot[eě]sn[aá]\s+konstrukce',

        # Exposed concrete: Pohledový beton, PB1, PB2, PB3
        'exposed_concrete': r'[Pp]ohledov[ýy]\s+beton|PB[123]',

        # Thickness: tl. 250 mm, tloušťka 300mm, tl. 30 cm
        'thickness_mm': r'(?:tl\.?|tlou[šs][tť]k[ay])\s*(\d+)\s*(mm|cm)',

        # Underground floors: 2PP, 2.PP, 2 PP, 2 podzemní podlaží
        'floors_underground': r'(\d+)\s*\.?\s*[Pp][Pp]|(\d+)\s+podzemn[íi]',

        # Above-ground floors: 6NP, 6.NP, 6 NP, 6 nadzemních podlaží
        'floors_above': r'(\d+)\s*\.?\s*[Nn][Pp]|(\d+)\s+nadzemn[íi]',

        # Total floors: celkem 8 podlaží
        'total_floors': r'celkem\s+(\d+)\s+podla[žz][íi]',

        # Building height: výška 24 m, 24m, v. 24,5 m
        'height_m': r'(?:v[ýy][šs]ka|v\.)\s*(?:objektu|budovy|stavby)?\s*:?\s*(\d+[\.,]?\d*)\s*m(?:\s|$|,|\.)',

        # Built-up area: zastavěná plocha 1200 m²
        'built_up_area': r'zastav[eě]n[aá]\s+plocha\s*:?\s*(\d+[\s,.]?\d*)\s*m[²2]',

        # Consistency class: S3, S4, F4, F5
        'consistency': r'(?:^|\s)([SF]\d)(?:\s|$)',

        # Min cement content: min. 320 kg/m³ cementu
        'min_cement': r'min\.?\s*(\d+)\s*kg/m[³3]\s*cement',

        # Max w/c ratio: w/c ≤ 0,55, w/c max 0.55
        'max_wc_ratio': r'w/c\s*(?:[≤<]|max\.?)\s*(\d[,.]?\d+)',
    }

    # Tender / procurement patterns (Zadávací dokumentace)
    TENDER_PATTERNS = {
        # IČO: 00075370, IČ: 12345678
        'ico': r'I[ČC](?:O|O\s+zadavatele)?[:\s]+(\d{8})',

        # ISDS: 2dibh62
        'isds': r'(?:ISDS|datov[aáé]\s+schr[aá]nk[ay])[:\s]+([a-zA-Z0-9]{7})',

        # CPV: 45311000-1, 45000000-7
        'cpv_code': r'CPV[:\s]*(\d{8}-\d)',

        # Předpokládaná hodnota: 6 310 000,00 Kč, 6310000 Kč
        'predpokladana_hodnota': r'[Pp]ředpokl[aá]dan[aá]\s+hodnot[ay].*?(?:činí|celkem|je)?\s*(\d[\d\s]*[\d,]+)\s*(?:,-\s*)?K[čc]',

        # Hodnota včetně/vč. změny závazku: 8 203 000,00 Kč
        'hodnota_zmena_zavazku': r'(?:včetně|vč\.)\s+(?:vyhrazené?\s+)?změny\s+závazku.*?(\d[\d\s]*[\d,]+)\s*(?:,-\s*)?K[čc]',

        # Vyhrazená změna závazku max: 1 893 000 Kč, max. 30 %
        'vyhrazena_zmena_czk': r'(?:maximáln[eě]|max\.?|tj\.?)\s+(?:do\s+)?(\d[\d\s]*[\d,]+)\s*(?:,-\s*)?K[čc]',
        'vyhrazena_zmena_pct': r'(?:až\s+do\s+výše|max\.?|nepřevýší)\s+(\d+)\s*%',

        # Jistota: 120 000 Kč, jistota ve výši 120 000,00 Kč
        'jistota': r'[Jj]istot[ay]\s+(?:ve\s+výši\s+)?(\d[\d\s]*[\d,]+)\s*(?:,-\s*)?K[čc]',

        # Číslo účtu: 4842100217, kód banky: 0100
        'cislo_uctu': r'[Čč][íi]slo\s+[úu][čc]tu[:\s]+(\d+)',
        'kod_banky': r'[Kk][óo]d\s+bank[yY][:\s]+(\d{4})',
        'nazev_banky': r'[Nn][áa]zev\s+bank[yY][:\s]+(.+?)(?:\n|$)',

        # Lhůta pro podání: 24. 1. 2024 v 14:00, do 15.02.2024 do 12:00
        'lhuta_podani': r'(?:končí|lhůta.*?končí|podání\s+nabídek.*?(?:do|končí))\s+(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\s*(?:v|do|ve)?\s*(\d{1,2}[.:]\d{2})?',

        # Zadávací lhůta: 90 dnů, 60 dní
        'zadavaci_lhuta': r'(?:zadávací|vázanosti)\s+lh[uů]t[auy]\s+(?:činí\s+|je\s+|stanovuje\s+)?(\d+)\s*dn[ůuí]',

        # Prohlídka místa: 7. 12. 2023 v 10:00
        'prohlidka_mista': r'[Pp]rohl[íi]dk[ay]\s+m[íi]st[ay].*?(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\s*(?:v|ve|od)?\s*(\d{1,2}[.:]\d{2})?',

        # Hodnotící kritérium: ekonomická výhodnost, nejnižší cena
        'hodnotici_kriterium': r'(?:hodnotící|hodnocení)\s+krit[ée]ri(?:um|em)\s+.*?(?:je\s+)?(.+?)(?:\.|$)',

        # Váha: 100 %, váha 80%
        'hodnotici_vaha': r'v[áa]ha\s+(\d+)\s*%',

        # Tender URL: tenderarena.cz, e-zak.cz, nen.nipez.cz
        'tender_url': r'(https?://(?:tenderarena|e-zak|nen\.nipez|zakazky|ezak|vhodne-uverejneni)[^\s<>"]+)',

        # Max velikost nabídky: 200 MB
        'max_velikost_mb': r'(?:nepřesáhnout|max\.?)\s+(?:objem\s+dat\s+)?(\d+)\s*MB',

        # Zákon: 134/2016 Sb., zákon č. 134/2016
        'zakon_vz': r'z[aá]kon[auy]?\s+(?:č\.?\s*)?(\d+/\d{4})\s*Sb\.',

        # Přílohy: Příloha č. 1 — Návrh smlouvy o dílo
        'prilohy': r'[Pp]říloha\s+č\.\s*(\d+)\s*[-–—]\s*(.+?)(?:\n|$)',
    }

    # Czech diacritics normalization table
    DIACRITICS_MAP = str.maketrans({
        'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e',
        'í': 'i', 'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's',
        'ť': 't', 'ú': 'u', 'ů': 'u', 'ý': 'y', 'ž': 'z',
        'Á': 'A', 'Č': 'C', 'Ď': 'D', 'É': 'E', 'Ě': 'E',
        'Í': 'I', 'Ň': 'N', 'Ó': 'O', 'Ř': 'R', 'Š': 'S',
        'Ť': 'T', 'Ú': 'U', 'Ů': 'U', 'Ý': 'Y', 'Ž': 'Z',
    })

    def __init__(self):
        """Initialize extractor"""
        self.stats = {
            'concrete_matches': 0,
            'steel_matches': 0,
            'quantity_matches': 0,
            'special_req_matches': 0
        }

    # =============================================================================
    # MAIN EXTRACTION METHOD
    # =============================================================================

    def extract_all(self, text: str) -> Dict[str, Any]:
        """
        Extract all facts from text.

        Returns structured data ready for ProjectPassport.
        All confidence scores = 1.0 (deterministic regex).
        """
        logger.info("Starting regex extraction")

        results = {
            'concrete_specifications': [],
            'reinforcement': [],
            'quantities': [],
            'dimensions': None,
            'special_requirements': [],
            'exposure_classes_found': set(),
            'raw_facts': [],
            'norms': [],
            'identification': {},
        }

        # Extract concrete specifications
        results['concrete_specifications'] = self._extract_concrete(text)
        self.stats['concrete_matches'] = len(results['concrete_specifications'])

        # Extract reinforcement
        results['reinforcement'] = self._extract_steel(text)
        self.stats['steel_matches'] = len(results['reinforcement'])

        # Extract quantities
        results['quantities'] = self._extract_quantities(text)
        self.stats['quantity_matches'] = len(results['quantities'])

        # Extract building dimensions
        results['dimensions'] = self._extract_dimensions(text)

        # Extract special requirements
        results['special_requirements'] = self._extract_special_requirements(text)
        self.stats['special_req_matches'] = len(results['special_requirements'])

        # Collect all exposure classes
        results['exposure_classes_found'] = self._find_all_exposure_classes(text)

        # Extract norm references (ČSN, zákony, vyhlášky)
        results['norms'] = self._extract_norms(text)
        self.stats['norm_matches'] = len(results['norms'])

        # Extract project identification
        results['identification'] = self._extract_identification(text)

        # Extract referenced documents (potentially missing)
        results['referenced_documents'] = self.extract_referenced_documents(text)

        # Extract drawing-specific data (výkresy)
        results['drawing_data'] = self.extract_drawing(text)
        if results['drawing_data']:
            self.stats['drawing_elements'] = len(results['drawing_data'].concrete_by_element)

        # Extract tender / procurement data (Zadávací dokumentace)
        results['tender_info'] = self._extract_tender_info(text)
        if results['tender_info']:
            self.stats['tender_fields'] = sum(1 for v in results['tender_info'].dict().values() if v is not None and v != [] and v != 0.9)

        logger.info(f"Extraction complete: {self.stats}")
        return results

    # =============================================================================
    # CONCRETE EXTRACTION
    # =============================================================================

    def _extract_concrete(self, text: str) -> List[ConcreteSpecification]:
        """Extract all concrete class specifications"""
        specs = []

        for match in re.finditer(self.PATTERNS['concrete_class'], text, re.IGNORECASE):
            fck = int(match.group(1))
            fck_cube = int(match.group(2))
            exposure_text = match.group(3) or ""

            # Find all exposure classes in the matched text
            exposure_classes = []
            for exp_match in re.finditer(self.PATTERNS['exposure_class'], exposure_text):
                exp_code = exp_match.group(0).upper()
                try:
                    exposure_classes.append(ExposureClass(exp_code))
                except ValueError:
                    logger.warning(f"Unknown exposure class: {exp_code}")

            # Get context (50 chars before and after)
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            context = text[start:end]

            # Determine concrete type from context
            concrete_type = self._infer_concrete_type(context)

            # Extract quality parameters if nearby
            min_cement = self._find_nearby_pattern(
                text, match.start(), self.PATTERNS['min_cement'], 200
            )
            max_wc = self._find_nearby_pattern(
                text, match.start(), self.PATTERNS['max_wc_ratio'], 200
            )
            consistency = self._find_nearby_pattern(
                text, match.start(), self.PATTERNS['consistency'], 200
            )

            spec = ConcreteSpecification(
                concrete_class=f"C{fck}/{fck_cube}",
                characteristic_strength=fck,
                cube_strength=fck_cube,
                exposure_classes=exposure_classes,
                concrete_type=concrete_type,
                min_cement_content=int(min_cement.group(1)) if min_cement else None,
                max_water_cement_ratio=float(max_wc.group(1).replace(',', '.')) if max_wc else None,
                consistency_class=consistency.group(1).upper() if consistency else None,
                raw_text=match.group(0),
                confidence=1.0
            )
            specs.append(spec)

        return specs

    def _infer_concrete_type(self, context: str) -> Optional[ConcreteType]:
        """Infer concrete type from context keywords"""
        context_lower = context.lower()

        if any(kw in context_lower for kw in ['monolit', 'lití', 'betonáž']):
            return ConcreteType.CAST_IN_PLACE
        elif any(kw in context_lower for kw in ['prefabr', 'montáž', 'dílec']):
            return ConcreteType.PRECAST
        elif any(kw in context_lower for kw in ['předpjat', 'předpínac']):
            return ConcreteType.PRESTRESSED
        elif any(kw in context_lower for kw in ['vláknový', 'vlákno']):
            return ConcreteType.FIBRE_REINFORCED

        return None

    def _find_all_exposure_classes(self, text: str) -> Set[str]:
        """Find all exposure classes in text"""
        classes = set()
        for match in re.finditer(self.PATTERNS['exposure_class'], text):
            classes.add(match.group(0).upper())
        return classes

    # =============================================================================
    # STEEL EXTRACTION
    # =============================================================================

    def _extract_steel(self, text: str) -> List[ReinforcementSpecification]:
        """Extract reinforcement steel specifications"""
        specs = []

        for match in re.finditer(self.PATTERNS['steel_grade'], text, re.IGNORECASE):
            steel_text = match.group(0).replace(' ', '')

            # Normalize to enum value
            if 'B500A' in steel_text.upper():
                grade = SteelGrade.B500A
            elif 'B500B' in steel_text.upper():
                grade = SteelGrade.B500B
            elif 'B500C' in steel_text.upper():
                grade = SteelGrade.B500C
            elif '10' in steel_text and '505' in steel_text:
                grade = SteelGrade.R10505
            else:
                continue

            # Get context
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            context = text[start:end]

            # Try to find total mass nearby
            total_mass = None
            mass_match = self._find_nearby_pattern(
                text, match.start(), self.PATTERNS['mass_tons'], 100
            )
            if mass_match:
                total_mass = float(mass_match.group(1).replace(',', '.').replace(' ', ''))

            spec = ReinforcementSpecification(
                steel_grade=grade,
                diameter_mm=None,  # Would need more complex parsing
                total_mass_tons=total_mass,
                raw_text=match.group(0),
                confidence=1.0
            )
            specs.append(spec)

        return specs

    # =============================================================================
    # QUANTITIES EXTRACTION
    # =============================================================================

    def _extract_quantities(self, text: str) -> List[QuantityItem]:
        """Extract quantities (m³, m², tons)"""
        quantities = []

        # Volume (m³)
        for match in re.finditer(self.PATTERNS['volume_m3'], text):
            value = float(match.group(1).replace(',', '.').replace(' ', ''))

            # Get surrounding context to infer element type
            start = max(0, match.start() - 100)
            end = min(len(text), match.end() + 50)
            context = text[start:end]

            element_type = self._infer_element_type(context)

            quantities.append(QuantityItem(
                element_type=element_type or "Beton",
                description=context.strip()[:100],
                volume_m3=value,
                confidence=1.0
            ))

        # Area (m²)
        for match in re.finditer(self.PATTERNS['area_m2'], text):
            value = float(match.group(1).replace(',', '.').replace(' ', ''))

            start = max(0, match.start() - 100)
            end = min(len(text), match.end() + 50)
            context = text[start:end]

            element_type = self._infer_element_type(context)

            quantities.append(QuantityItem(
                element_type=element_type or "Plocha",
                description=context.strip()[:100],
                area_m2=value,
                confidence=1.0
            ))

        # Mass (tons)
        for match in re.finditer(self.PATTERNS['mass_tons'], text):
            value = float(match.group(1).replace(',', '.').replace(' ', ''))

            start = max(0, match.start() - 100)
            end = min(len(text), match.end() + 50)
            context = text[start:end]

            # Likely reinforcement if mass is mentioned
            quantities.append(QuantityItem(
                element_type="Výztuž",
                description=context.strip()[:100],
                mass_tons=value,
                confidence=1.0
            ))

        return quantities

    def _infer_element_type(self, context: str) -> Optional[str]:
        """Infer element type from context"""
        context_lower = self._normalize_diacritics(context.lower())

        element_keywords = {
            'Základy': ['zaklad', 'patkovy', 'pasovy'],
            'Stěny': ['stena', 'steny', 'obvodove'],
            'Stropy': ['strop', 'stropy', 'deska'],
            'Sloupy': ['sloup', 'sloupy', 'pilir'],
            'Schodiště': ['schod', 'schodiste'],
            'Výztuž': ['vyztuz', 'armatura', 'betonarsk'],
            'Bednění': ['bedneni', 'formwork']
        }

        for element, keywords in element_keywords.items():
            if any(kw in context_lower for kw in keywords):
                return element

        return None

    # =============================================================================
    # DIMENSIONS EXTRACTION
    # =============================================================================

    def _extract_dimensions(self, text: str) -> Optional[BuildingDimensions]:
        """Extract building dimensions"""
        dimensions = {}

        # Underground floors
        pp_match = re.search(self.PATTERNS['floors_underground'], text, re.IGNORECASE)
        if pp_match:
            dimensions['floors_underground'] = int(pp_match.group(1) or pp_match.group(2))

        # Above-ground floors
        np_match = re.search(self.PATTERNS['floors_above'], text, re.IGNORECASE)
        if np_match:
            dimensions['floors_above_ground'] = int(np_match.group(1) or np_match.group(2))

        # Total floors
        total_match = re.search(self.PATTERNS['total_floors'], text, re.IGNORECASE)
        if total_match:
            dimensions['total_floors'] = int(total_match.group(1))

        # Height
        height_match = re.search(self.PATTERNS['height_m'], text, re.IGNORECASE)
        if height_match:
            dimensions['height_m'] = float(height_match.group(1).replace(',', '.'))

        # Built-up area
        area_match = re.search(self.PATTERNS['built_up_area'], text, re.IGNORECASE)
        if area_match:
            dimensions['built_up_area_m2'] = float(area_match.group(1).replace(',', '.').replace(' ', ''))

        if dimensions:
            return BuildingDimensions(**dimensions, confidence=1.0)

        return None

    # =============================================================================
    # SPECIAL REQUIREMENTS EXTRACTION
    # =============================================================================

    def _extract_special_requirements(self, text: str) -> List[SpecialRequirement]:
        """Extract special construction requirements"""
        requirements = []

        # White tank (Bílá vana)
        for match in re.finditer(self.PATTERNS['white_tank'], text, re.IGNORECASE):
            context = text[max(0, match.start()-100):min(len(text), match.end()+100)]

            # Try to find watertightness class
            watertight_match = re.search(self.PATTERNS['watertight'], context)
            if watertight_match:
                # Extract V8, V4, etc from groups
                wt_class = watertight_match.group(1) or watertight_match.group(2) if watertight_match.lastindex else watertight_match.group(0)
                # Clean up if it's just "vodotěsnost" without class
                if 'vodot' in wt_class.lower() and not re.search(r'V\d', wt_class):
                    wt_class = "neurčeno"
            else:
                wt_class = "neurčeno"

            # Try to find thickness
            thickness_match = re.search(self.PATTERNS['thickness_mm'], context)
            thickness = None
            if thickness_match:
                val = int(thickness_match.group(1))
                unit = thickness_match.group(2)
                thickness = val if unit == 'mm' else val * 10  # Convert cm to mm

            requirements.append(SpecialRequirement(
                requirement_type="Bílá vana (vodotěsný beton)",
                description=f"Vodotěsná konstrukce třídy {wt_class}",
                parameters={
                    'watertight_class': wt_class,
                    'thickness_mm': thickness
                },
                raw_text=match.group(0),
                confidence=1.0
            ))

        # Exposed concrete (Pohledový beton)
        for match in re.finditer(self.PATTERNS['exposed_concrete'], text, re.IGNORECASE):
            context = text[max(0, match.start()-50):min(len(text), match.end()+50)]

            # Try to find PB class
            pb_match = re.search(r'PB[123]', context, re.IGNORECASE)
            pb_class = pb_match.group(0).upper() if pb_match else "PB neurčeno"

            requirements.append(SpecialRequirement(
                requirement_type="Pohledový beton",
                description=f"Pohledový beton třídy {pb_class}",
                parameters={'class': pb_class},
                raw_text=match.group(0),
                confidence=1.0
            ))

        return requirements

    # =============================================================================
    # V3: PD (TENDER) EXTRACTION — confidence = 1.0
    # =============================================================================

    PD_PATTERNS = {
        # Estimated value: "1 279 250 000 Kč", "1279250000 CZK"
        'estimated_value': r'[Pp]ředpokládan[áa]\s+hodnot[ay].*?(?:činí|je)?\s*:?\s*([\d\s]+(?:[.,]\d+)?)\s*(?:mil\.?\s*)?(?:Kč|CZK)',
        'value_czk': r'([\d\s,.]+)\s*(?:mil\.?\s*)?Kč\s*bez\s*DPH',

        # Jistota: "15 000 000 Kč", "15 mil. Kč"
        'jistota_amount': r'jistot[uůay].*?(?:ve\s+výši|částk[auě])\s*\*?\*?([\d\s]+(?:[.,]\d+)?)\s*(?:mil\.?\s*)?(?:Kč|CZK)',

        # Zadávací lhůta: "10 měsíců"
        'binding_period': r'(?:zadávací\s+lhůta|účastníci.*?nesmí.*?odstoupit).*?(\d+)\s*měsíc',

        # Evaluation weights: "**Cena** **90 %**", "Cena 90%"
        'eval_weight': r'(?:\*{2})?([^*\n]{3,60}?)(?:\*{2})?\s+(?:\*{2})?(\d+)\s*%',

        # Qualification: "400 mil. Kč", "600 mil. Kč"
        'qualification_mil': r'(\d+)\s*mil\.?\s*Kč',
        'qualification_min': r'minimálně\s*([\d\s]+)\s*(?:mil\.?\s*)?(?:Kč|CZK)',

        # Záruční doba: "60 měsíců", "84 měsíců"
        'warranty_months': r'záruční\s+dob[ayuě].*?(\d+)\s*měsíc',

        # Bank account: "10006-15937031/0710"
        'bank_account': r'účet.*?č\.\s*([\d-]+/\d+)',
        'variable_symbol': r'variabilní\s+symbol.*?(\d{6,})',

        # Tender number
        'tender_number': r'[Čč]íslo\s+(?:veřejné\s+)?zakázky[:\s]*([\w-]+)',
        'isprofin': r'ISPROFIN[:/\s]*([\d\s]+)',

        # FIDIC
        'fidic': r'(FIDIC)',
        'fidic_book': r'(Red\s+Book|Yellow\s+Book|Silver\s+Book)',

        # File limits
        'file_size_mb': r'(\d+)\s*MB',

        # Electronic tool
        'e_tool': r'(?:elektronický\s+nástroj|Tender\s+arena|eGORDION)',

        # Přílohy: "Příloha č. 1 – Dopis nabídky"
        'attachment': r'Příloha\s+č\.\s*(\d+)\s*[-–—]\s*(.+?)(?:\n|$)',

        # Own capacity
        'own_capacity': r'vlastními\s+kapacitami.*?:\s*(.*?)(?:\.|$)',

        # IČO
        'ico': r'IČ[O:]?\s*(\d{8})',
    }

    def extract_pd(self, text: str) -> Dict[str, Any]:
        """
        Extract tender (PD) data from text. All confidence = 1.0.

        Returns dict with keys matching TenderExtraction fields.
        """
        result: Dict[str, Any] = {}

        # Estimated value
        for pat in [self.PD_PATTERNS['estimated_value'], self.PD_PATTERNS['value_czk']]:
            m = re.search(pat, text, re.IGNORECASE | re.DOTALL)
            if m:
                result['estimated_value_czk'] = self._parse_czech_number(m.group(1))
                break

        # Jistota
        m = re.search(self.PD_PATTERNS['jistota_amount'], text, re.IGNORECASE | re.DOTALL)
        if m:
            result['jistota_amount_czk'] = self._parse_czech_number(m.group(1))
            result['jistota_required'] = True

        # Binding period
        m = re.search(self.PD_PATTERNS['binding_period'], text, re.IGNORECASE | re.DOTALL)
        if m:
            result['binding_period_months'] = int(m.group(1))

        # Evaluation criteria weights
        weights = []
        for m in re.finditer(self.PD_PATTERNS['eval_weight'], text):
            name = m.group(1).strip()
            pct = float(m.group(2))
            if 3 < pct <= 100 and len(name) > 3:
                direction = 'lower_better' if 'cen' in name.lower() else 'higher_better'
                weights.append({'name': name, 'weight_pct': pct, 'direction': direction})
        if weights:
            result['evaluation_criteria'] = weights

        # Warranty
        m = re.search(self.PD_PATTERNS['warranty_months'], text, re.IGNORECASE | re.DOTALL)
        if m:
            result['warranty_months'] = int(m.group(1))

        # Bank account + VS
        m = re.search(self.PD_PATTERNS['bank_account'], text, re.IGNORECASE)
        if m:
            result['jistota_bank_account'] = m.group(1)
        m = re.search(self.PD_PATTERNS['variable_symbol'], text, re.IGNORECASE)
        if m:
            result['jistota_variable_symbol'] = m.group(1)

        # Tender number
        m = re.search(self.PD_PATTERNS['tender_number'], text, re.IGNORECASE)
        if m:
            result['tender_number'] = m.group(1)

        # FIDIC
        m = re.search(self.PD_PATTERNS['fidic'], text)
        if m:
            result['contract_type'] = 'FIDIC'
            book_m = re.search(self.PD_PATTERNS['fidic_book'], text, re.IGNORECASE)
            if book_m:
                result['contract_type'] = f'FIDIC {book_m.group(1)}'

        # File size limits
        sizes = [int(m.group(1)) for m in re.finditer(self.PD_PATTERNS['file_size_mb'], text)]
        if sizes:
            result['max_file_size_mb'] = max(sizes)

        # Electronic tool
        m = re.search(self.PD_PATTERNS['e_tool'], text, re.IGNORECASE)
        if m:
            result['electronic_tool'] = m.group(0)

        # Attachments
        attachments = []
        for m in re.finditer(self.PD_PATTERNS['attachment'], text):
            attachments.append({'number': int(m.group(1)), 'name': m.group(2).strip()})
        if attachments:
            result['attachments'] = attachments

        # IČO
        m = re.search(self.PD_PATTERNS['ico'], text, re.IGNORECASE)
        if m:
            result['authority_ico'] = m.group(1)

        # Qualification thresholds (all mil CZK amounts)
        qual_amounts = []
        for m in re.finditer(self.PD_PATTERNS['qualification_mil'], text):
            qual_amounts.append(int(m.group(1)))
        if qual_amounts:
            result['qualification_thresholds_mil_czk'] = sorted(set(qual_amounts), reverse=True)

        logger.info(f"PD regex extraction: {len(result)} fields found")
        return result

    # =============================================================================
    # V3.3: PBŘS (FIRE SAFETY) EXTRACTION
    # =============================================================================

    PBRS_PATTERNS = {
        'fire_compartment': r'požární\s+úsek\s+(\S+)',
        'spb': r'SPB\s*[:=]?\s*([I]{1,3}V?)',
        'fire_resistance': r'(REI?\s*\d+(?:/\d+)?)',
        'escape_route': r'(CHÚC|NÚC|chráněná\s+úniková\s+cesta)',
        'fire_load': r'požární\s+zatížení\s*[:=]?\s*(\d+[\.,]?\d*)\s*(kg/m[²2]|MJ/m[²2])',
        'eps': r'(EPS|elektrická\s+požární\s+signalizace)',
        'shz': r'(SHZ|stabilní\s+hasicí\s+zařízení|sprinkler)',
        'zokt': r'(ZOKT|zařízení\s+pro\s+odvod\s+kouře\s+a\s+tepla)',
        'fire_distance': r'odstupov[áé]\s+vzdálenost[i]?\s*[:=]?\s*(\d+[\.,]?\d*)\s*m',
        'fire_water': r'požární\s+vod[ay]\s*[:=]?\s*(\d+[\.,]?\d*)\s*(l/s|m³/h)',
    }

    def extract_pbrs(self, text: str) -> Dict[str, Any]:
        """Extract fire safety parameters from PBŘS document."""
        result: Dict[str, Any] = {}

        # Fire compartments
        compartments = list(set(re.findall(self.PBRS_PATTERNS['fire_compartment'], text, re.IGNORECASE)))
        if compartments:
            result['fire_compartments'] = sorted(compartments)

        # SPB (stupeň požární bezpečnosti)
        spb_values = list(set(re.findall(self.PBRS_PATTERNS['spb'], text)))
        if spb_values:
            result['spb_values'] = spb_values

        # Fire resistance
        resistances = list(set(re.findall(self.PBRS_PATTERNS['fire_resistance'], text)))
        if resistances:
            result['fire_resistance_ratings'] = resistances

        # Escape routes
        routes = list(set(re.findall(self.PBRS_PATTERNS['escape_route'], text, re.IGNORECASE)))
        if routes:
            result['escape_routes'] = routes

        # Fire detection/suppression systems
        for key, pattern_key in [('has_eps', 'eps'), ('has_shz', 'shz'), ('has_zokt', 'zokt')]:
            if re.search(self.PBRS_PATTERNS[pattern_key], text, re.IGNORECASE):
                result[key] = True

        # Fire distance
        m = re.search(self.PBRS_PATTERNS['fire_distance'], text, re.IGNORECASE)
        if m:
            result['fire_distance_m'] = float(m.group(1).replace(',', '.'))

        # Fire water supply
        m = re.search(self.PBRS_PATTERNS['fire_water'], text, re.IGNORECASE)
        if m:
            result['fire_water_supply'] = f"{m.group(1)} {m.group(2)}"

        logger.info(f"PBRS regex extraction: {len(result)} fields found")
        return result

    # =============================================================================
    # V3: BRIDGE DIMENSION EXTRACTION
    # =============================================================================

    BRIDGE_PATTERNS = {
        # ČSN 73 6200 Odst. 5 dimensions
        'bridge_length': r'délka\s+mostu[:\s]*(\d+[\.,]?\d*)\s*m',
        'bridge_width': r'šířka\s+mostu[:\s]*(\d+[\.,]?\d*)\s*m',
        'free_width': r'voln[áa]\s+šířk[ay][:\s]*(\d+[\.,]?\d*)\s*m',
        'bridge_height': r'výška\s+mostu[:\s]*(\d+[\.,]?\d*)\s*m',
        'clearance_under': r'voln[áa]\s+výšk[ay]\s+pod\s+most[:\w\s]*?(\d+[\.,]?\d*)\s*m',
        'span': r'rozpětí[:\s]*(\d+[\.,]?\d*)\s*m',
        'light_span': r'světlost[:\s]*(\d+[\.,]?\d*)\s*m',
        'nk_length': r'délka\s+(?:nosné\s+konstrukce|NK)[:\s]*(\d+[\.,]?\d*)\s*m',
        'nk_area': r'plocha\s+(?:nosné\s+konstrukce|NK)[:\s]*(\d+[\.,]?\d*)\s*m[²2]',

        # Structural details
        'beam_count': r'(\d+)\s*[×x]\s*(?:nosník|předpjat)',
        'beam_spacing': r'(?:osová\s+)?vzdálenost\s+nosníků[:\s]*(\d+)\s*mm',
        'slab_thickness': r'(?:spřažen[áa]\s+)?desk[ay]\s+(?:tl\.?|tloušťk[ay])[:\s]*(\d+)\s*mm',
        'pile_diameter': r'(?:pilotyø|průměr\w*\s+pilot)[:\s]*(\d+)\s*mm',
        'pile_length': r'délk[ay]\s+pilot[:\s]*(\d+[\.,]?\d*)\s*m',

        # Slopes
        'transverse_slope': r'příčný\s+sklon[:\s]*(\d+[\.,]?\d*)\s*%',
        'longitudinal_slope': r'podélný\s+sklon[:\s]*(\d+[\.,]?\d*)\s*%',

        # Settlement
        'settlement': r'sedání[:\s]*(\d+[\.,]?\d*)\s*mm',
        'deflection': r'průhyb[:\s]*(\d+[\.,]?\d*)\s*mm',

        # SO code
        'so_code': r'SO\s*(\d{3})',

        # Related SOs
        'related_so_list': r'SO\s+\d{3}',

        # Chainage
        'chainage': r'(?:km|staničení)[:\s]*(\d+[\.,]\d+)',
    }

    def extract_bridge(self, text: str) -> Dict[str, Any]:
        """Extract bridge parameters from text. Confidence = 1.0."""
        result: Dict[str, Any] = {}

        float_fields = {
            'bridge_length_m': 'bridge_length',
            'bridge_width_m': 'bridge_width',
            'free_width_m': 'free_width',
            'bridge_height_m': 'bridge_height',
            'clearance_under_m': 'clearance_under',
            'span_m': 'span',
            'light_span_m': 'light_span',
            'nk_length_m': 'nk_length',
            'nk_area_m2': 'nk_area',
            'pile_length_m': 'pile_length',
            'transverse_slope_pct': 'transverse_slope',
            'longitudinal_slope_pct': 'longitudinal_slope',
            'chainage_km': 'chainage',
        }

        for field, pattern_key in float_fields.items():
            m = re.search(self.BRIDGE_PATTERNS[pattern_key], text, re.IGNORECASE)
            if m:
                result[field] = float(m.group(1).replace(',', '.'))

        int_fields = {
            'beam_count': 'beam_count',
            'beam_spacing_mm': 'beam_spacing',
            'slab_thickness_mm': 'slab_thickness',
            'pile_diameter_mm': 'pile_diameter',
        }

        for field, pattern_key in int_fields.items():
            m = re.search(self.BRIDGE_PATTERNS[pattern_key], text, re.IGNORECASE)
            if m:
                result[field] = int(m.group(1))

        # Settlement / deflection
        m = re.search(self.BRIDGE_PATTERNS['settlement'], text, re.IGNORECASE)
        if m:
            result['settlement_abutment_1_mm'] = float(m.group(1).replace(',', '.'))
        m = re.search(self.BRIDGE_PATTERNS['deflection'], text, re.IGNORECASE)
        if m:
            result['deflection_span_mm'] = float(m.group(1).replace(',', '.'))

        # Related SOs
        so_codes = list(set(re.findall(self.BRIDGE_PATTERNS['related_so_list'], text)))
        if so_codes:
            result['related_sos'] = sorted(so_codes)

        # Concrete specs from text: "C30/37-XF2,XD1,XC4"
        concrete_spec = re.search(r'(C\d{2}/\d{2}[-\w,\s]+)', text)
        if concrete_spec:
            result['concrete_nk'] = concrete_spec.group(1).strip()

        # Reinforcement
        rebar = re.search(r'(B500[ABC])', text)
        if rebar:
            result['reinforcement'] = rebar.group(1)

        # Cover
        cover = re.search(r'krytí[:\s]*(\d+/\d+)\s*mm', text, re.IGNORECASE)
        if cover:
            result['cover_mm'] = cover.group(1) + ' mm'

        logger.info(f"Bridge regex extraction: {len(result)} fields found")
        return result

    # =============================================================================
    # V3: GTP (GEOTECHNICAL) EXTRACTION
    # =============================================================================

    GTP_PATTERNS = {
        # Aggressivity class
        'xa_class': r'(XA[123])',
        # Groundwater level
        'hpv': r'(?:HPV|hladina\s+podzemní\s+vody)[:\s]*(\d+[\.,]\d+)\s*m',
        # Borehole ID
        'borehole': r'(J\d{2,4}|JV\d{2,4})',
        # Stray currents
        'stray_current': r'bludný(?:ch)?\s+proud[ůy].*?stupeň\s+(\d)',
        # Geotechnical category
        'geo_category': r'geotechnick[áa]\s+kategorie[:\s]*(\d)',
        # Soil aggressivity values
        'so4': r'SO[₄4].*?(\d+[\.,]\d+)',
        'ph': r'pH[:\s]*(\d+[\.,]\d+)',
        'co2_agr': r'CO[₂2]\s*(?:agr)?[:\s]*(\d+[\.,]?\d*)',
    }

    def extract_gtp(self, text: str) -> Dict[str, Any]:
        """Extract geotechnical data from text. Confidence = 1.0."""
        result: Dict[str, Any] = {}

        # XA class
        m = re.search(self.GTP_PATTERNS['xa_class'], text)
        if m:
            result['water_aggressivity'] = m.group(1)

        # HPV
        levels = [float(m.group(1).replace(',', '.'))
                  for m in re.finditer(self.GTP_PATTERNS['hpv'], text, re.IGNORECASE)]
        if levels:
            result['groundwater_level_m'] = f"{min(levels):.2f}-{max(levels):.2f} m" if len(levels) > 1 else f"{levels[0]:.2f} m"

        # Boreholes
        boreholes = list(set(re.findall(self.GTP_PATTERNS['borehole'], text)))
        if boreholes:
            result['gtp_boreholes'] = sorted(boreholes)

        # Stray currents
        m = re.search(self.GTP_PATTERNS['stray_current'], text, re.IGNORECASE)
        if m:
            result['stray_current_class'] = int(m.group(1))

        # Geotechnical category
        m = re.search(self.GTP_PATTERNS['geo_category'], text, re.IGNORECASE)
        if m:
            result['geotechnical_category'] = int(m.group(1))

        # Aggressivity details
        details: Dict[str, float] = {}
        m = re.search(self.GTP_PATTERNS['so4'], text)
        if m:
            details['SO4'] = float(m.group(1).replace(',', '.'))
        m = re.search(self.GTP_PATTERNS['ph'], text)
        if m:
            details['pH'] = float(m.group(1).replace(',', '.'))
        m = re.search(self.GTP_PATTERNS['co2_agr'], text)
        if m:
            details['CO2_agr'] = float(m.group(1).replace(',', '.'))
        if details:
            result['aggressivity_details'] = details

        logger.info(f"GTP regex extraction: {len(result)} fields found")
        return result

    # =============================================================================
    # V3: CZECH NUMBER PARSER
    # =============================================================================

    def _parse_czech_number(self, text: str) -> Optional[float]:
        """Parse Czech-formatted number: '1 279 250 000' or '1.279.250.000' or '15,5'."""
        if not text:
            return None
        cleaned = text.strip().replace('\xa0', '').replace(' ', '')
        # Handle "1.279.250.000" (thousands dots) vs "15,5" (decimal comma)
        if ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace('.', '').replace(',', '.')
        elif ',' in cleaned:
            # Could be decimal comma or thousands separator
            parts = cleaned.split(',')
            if len(parts[-1]) <= 2:
                cleaned = cleaned.replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        elif cleaned.count('.') > 1:
            cleaned = cleaned.replace('.', '')
        try:
            return float(cleaned)
        except ValueError:
            return None

    # =============================================================================
    # HELPER METHODS
    # =============================================================================

    def _find_nearby_pattern(
        self,
        text: str,
        pos: int,
        pattern: str,
        max_distance: int = 200
    ) -> Optional[re.Match]:
        """Find pattern within max_distance from position"""
        start = max(0, pos - max_distance)
        end = min(len(text), pos + max_distance)
        search_text = text[start:end]

        return re.search(pattern, search_text, re.IGNORECASE)

    def _normalize_diacritics(self, text: str) -> str:
        """Remove Czech diacritics for keyword matching"""
        return text.translate(self.DIACRITICS_MAP)

    # =============================================================================
    # MISSING DOCUMENT REFERENCES
    # =============================================================================

    MISSING_DOC_PATTERNS = [
        r'viz\s+příloha\s+(.{5,60})',
        r'dle\s+(?:posudku|výkresu|projektu|zprávy)\s+(.{5,60})',
        r'(?:statický|geotechnický|geologický|radonový)\s+(?:posudek|průzkum|protokol)',
        r'projekt\s+(?:hromosvodu|uzemn[ěe]n[ií]|požárně\s+bezpečnostní)',
        r'(?:energetický|průkaz)\s+(?:štítek|PENB)',
        r'protokol\s+o\s+(?:zkoušce|měření|autorizaci)',
    ]

    def extract_referenced_documents(self, text: str) -> List[str]:
        """Scan text for mentions of other documents (potentially missing)."""
        refs: List[str] = []
        seen: set = set()
        for pattern in self.MISSING_DOC_PATTERNS:
            for m in re.finditer(pattern, text, re.IGNORECASE):
                ref = m.group(0).strip().rstrip('.,;:')
                if len(ref) > 10 and ref not in seen:
                    seen.add(ref)
                    refs.append(ref)
        return refs[:20]

    # =============================================================================
    # NORM REFERENCES EXTRACTION
    # =============================================================================

    NORM_PATTERNS = [
        r'(ČSN\s+(?:EN\s+)?(?:ISO\s+)?\d[\d\s\-]+\d)',
        r'(zákon\s+č\.\s*\d+/\d+\s*Sb\.)',
        r'(vyhláška\s+č\.\s*\d+/\d+\s*Sb\.)',
        r'(nařízení\s+vlády\s+č\.\s*\d+/\d+\s*Sb\.)',
        r'(TKP\s+\d+)',
        r'(VTP\s+\w+/\d+)',
        r'(TPG\s+\d[\d\s]+\d)',
        r'(Eurocode\s+\d+)',
        r'(EN\s+199\d[\-\d]*)',
    ]

    def _extract_norms(self, text: str) -> List[str]:
        """Extract all referenced standards and norms from text."""
        norms: List[str] = []
        seen: set = set()
        for pattern in self.NORM_PATTERNS:
            for m in re.finditer(pattern, text, re.IGNORECASE):
                code = re.sub(r'\s+', ' ', m.group(1).strip())
                if code not in seen:
                    seen.add(code)
                    norms.append(code)
        return norms

    # =============================================================================
    # PROJECT IDENTIFICATION EXTRACTION
    # =============================================================================

    IDENT_PATTERNS = {
        'stavba': r'[Ss]tavba[:\s]+(.+?)(?:\n|Investor|Místo|Formát|Objednat)',
        'investor': r'[Ii]nvestor[:\s]+(.+?)(?:\n|Tel|IČ|Stavba|Místo)',
        'misto': r'[Mm]ísto\s+stavby[:\s]+(.+?)(?:\n|Kraj|Investor|Katastr)',
        'kraj': r'[Kk]raj[:\s]+(.+?)(?:\n|Okres|Místo|Obec)',
        'projektant': r'[Pp]rojektant[:\s]+(.+?)(?:\n|IČ|ČKAIT|Tel)',
        'datum': r'[Dd]atum[:\s]+(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})',
        'stupen_pd': r'(?:stupeň|stupen)\s*(?:PD)?[:\s]*(D[ÚU]R|DSP|DPS|DVZ|DSPS|PDPS)',
    }

    def _extract_identification(self, text: str) -> Dict[str, str]:
        """Extract project identification from first ~3000 chars."""
        head = text[:3000]
        result: Dict[str, str] = {}
        for field, pattern in self.IDENT_PATTERNS.items():
            m = re.search(pattern, head, re.IGNORECASE)
            if m:
                val = m.group(1).strip().rstrip(',.')
                if val and len(val) < 200:
                    result[field] = val
        return result

    # =============================================================================
    # TENDER / PROCUREMENT EXTRACTION
    # =============================================================================

    def _parse_czk_amount(self, text: str) -> Optional[float]:
        """Parse Czech currency amount: '6 310 000,00' → 6310000.0"""
        if not text:
            return None
        cleaned = text.replace('\xa0', '').replace(' ', '').replace('.', '').strip()
        cleaned = cleaned.replace(',', '.')
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _extract_tender_info(self, text: str) -> Optional[TenderInfo]:
        """Extract public procurement / tender data from Zadávací dokumentace."""
        # Quick check: is this a tender document?
        tender_keywords = ['zadávací dokumentac', 'veřejn', 'zakázk', 'nabídek', 'zadavatel']
        text_lower = text.lower()
        keyword_hits = sum(1 for kw in tender_keywords if kw in text_lower)
        if keyword_hits < 2:
            return None

        logger.info("Detected tender document, extracting procurement data")
        tp = self.TENDER_PATTERNS
        data: Dict[str, Any] = {}

        # IČO
        m = re.search(tp['ico'], text)
        if m:
            data['ico'] = m.group(1)

        # ISDS
        m = re.search(tp['isds'], text, re.IGNORECASE)
        if m:
            data['isds'] = m.group(1)

        # CPV
        m = re.search(tp['cpv_code'], text)
        if m:
            data['cpv_code'] = m.group(1)
            # Try to get CPV name from same line
            cpv_line = re.search(r'(\S.*?)\s+' + re.escape(m.group(1)), text)
            if cpv_line:
                data['cpv_name'] = cpv_line.group(1).strip()

        # Zákon
        m = re.search(tp['zakon_vz'], text, re.IGNORECASE)
        if m:
            data['zakon'] = f"{m.group(1)} Sb."

        # Předpokládaná hodnota
        m = re.search(tp['predpokladana_hodnota'], text, re.IGNORECASE)
        if m:
            data['predpokladana_hodnota_czk'] = self._parse_czk_amount(m.group(1))

        # Hodnota včetně změny závazku
        m = re.search(tp['hodnota_zmena_zavazku'], text, re.IGNORECASE)
        if m:
            data['hodnota_zmena_zavazku_czk'] = self._parse_czk_amount(m.group(1))

        # Vyhrazená změna — CZK
        m = re.search(tp['vyhrazena_zmena_czk'], text, re.IGNORECASE)
        if m:
            data['vyhrazena_zmena_czk'] = self._parse_czk_amount(m.group(1))

        # Vyhrazená změna — %
        m = re.search(tp['vyhrazena_zmena_pct'], text, re.IGNORECASE)
        if m:
            data['vyhrazena_zmena_pct'] = float(m.group(1))

        # Jistota
        m = re.search(tp['jistota'], text, re.IGNORECASE)
        if m:
            data['jistota_czk'] = self._parse_czk_amount(m.group(1))

        # Bank details
        m = re.search(tp['cislo_uctu'], text, re.IGNORECASE)
        if m:
            data['cislo_uctu'] = m.group(1)
        m = re.search(tp['kod_banky'], text, re.IGNORECASE)
        if m:
            data['kod_banky'] = m.group(1)
        m = re.search(tp['nazev_banky'], text, re.IGNORECASE)
        if m:
            data['nazev_banky'] = m.group(1).strip()

        # Lhůta podání
        m = re.search(tp['lhuta_podani'], text, re.IGNORECASE)
        if m:
            date_str = m.group(1).strip()
            time_str = m.group(2).strip() if m.group(2) else ''
            data['lhuta_podani'] = f"{date_str} {time_str}".strip()

        # Zadávací lhůta
        m = re.search(tp['zadavaci_lhuta'], text, re.IGNORECASE)
        if m:
            data['zadavaci_lhuta_dnu'] = int(m.group(1))

        # Prohlídka místa
        m = re.search(tp['prohlidka_mista'], text, re.IGNORECASE)
        if m:
            date_str = m.group(1).strip()
            time_str = m.group(2).strip() if m.group(2) else ''
            data['prohlidka_mista'] = f"{date_str} {time_str}".strip()

        # Hodnotící kritérium
        m = re.search(tp['hodnotici_kriterium'], text, re.IGNORECASE)
        if m:
            data['hodnotici_kriterium'] = m.group(1).strip()

        # Váha
        m = re.search(tp['hodnotici_vaha'], text, re.IGNORECASE)
        if m:
            data['hodnotici_vaha_pct'] = float(m.group(1))

        # Tender URL
        m = re.search(tp['tender_url'], text, re.IGNORECASE)
        if m:
            data['tender_url'] = m.group(1)

        # Max velikost
        m = re.search(tp['max_velikost_mb'], text, re.IGNORECASE)
        if m:
            data['max_velikost_nabidky_mb'] = int(m.group(1))

        # Přílohy
        prilohy = re.findall(tp['prilohy'], text)
        if prilohy:
            data['prilohy'] = [f"Příloha č. {num} – {name.strip()}" for num, name in prilohy]

        if not data:
            return None

        logger.info(f"Extracted {len(data)} tender fields")
        return TenderInfo(**data)

    # =============================================================================
    # V5: REGISTRY-BASED DRAWING EXTRACTION FRAMEWORK
    # =============================================================================
    #
    # Adding a new extraction type = adding a record to DRAWING_REGISTRY.
    # The framework iterates over ALL entries and runs each extractor.
    #
    # Modes:
    #   "element_value"  — ELEMENT: value params (concrete, reinforcement)
    #   "header_text"    — HEADER: text (notes)
    #   "field_patterns" — each field has its own pattern (title block)
    #   "collect_all"    — collect all matches (ETICS, skladba)
    #   "boolean"        — does pattern exist? (SCC)
    # =============================================================================

    # Known element abbreviations → full name
    ELEMENT_ALIASES: Dict[str, str] = {
        'NK': 'NOSNÁ KONSTRUKCE',
        'ŽB': 'ŽELEZOBETON',
        'OP': 'OPĚRA',
        'PD': 'PŘECHODOVÁ DESKA',
        'ZD': 'ZÁKLADOVÁ DESKA',
        'ÚD': 'ÚLOŽNÝ PRÁH',
        'MK': 'MOSTOVKA',
        'KČ': 'KRAJNÍ ČÁST',
    }

    # Element name pattern — accepts abbreviations (2+ chars) and full names
    _ELEMENT_RE = (
        r'(?P<element>'
        r'(?:NK|ŽB|OP|PD|ZD|ÚD|MK|KČ)'          # known 2-char abbreviations
        r'|'
        r'[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]'                    # first uppercase
        r'[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž\s/]{2,30}?'  # 2-30 more
        r')'
    )

    # ── DRAWING REGISTRY ─────────────────────────────────────────────────────
    # Each entry: mode, patterns/config, output_field in DrawingData
    # To add a new extraction type → add a dict here. No new methods needed.

    DRAWING_REGISTRY: List[Dict[str, Any]] = [
        # ── concrete per element ──────────────────────────────────────────
        {
            'id': 'concrete_by_element',
            'mode': 'element_value',
            'output_field': 'concrete_by_element',
            'main_pattern': (
                _ELEMENT_RE
                + r'\s*[:–\-]\s*'
                r'(?P<class>C\s?\d{2,3}/\d{2,3})'
                r'(?P<rest>[^;\n]{0,200})'
            ),
            'sub_patterns': {
                'exposure':    r'X[CADFMS]\d',
                'wc_ratio':    r'(?:CI|Cl|w/c)\s*[=:\s]\s*(\d[,.]?\d+)',
                'dmax':        r'[Dd]\s*max\s*[=:\s]\s*(\d+)',
                'consistency': r'(?:^|\s)([SF]\d)(?:\s|$|,)',
                'scc':         r'SCC|samozhutn[ěi]teln[ýé]\s+beton',
            },
            'context_patterns': {
                'cover_combined': r'kryt[íi]\s+(?:min\.?\s*/\s*jmen\.?|minimální\s*/\s*jmenovité)\s*[:.]?\s*(\d+)\s*/\s*(\d+)\s*mm',
                'cover_min':      r'kryt[íi]\s+min(?:imáln[íi])?\s*[:.]?\s*(\d+)\s*mm',
                'cover_nom':      r'kryt[íi]\s+jmenovit[ée]\s*[:.]?\s*(\d+)\s*mm',
                'penetration':    r'(?:max\.?\s+)?průsak\s+(?:max\.?\s+)?(\d+)\s*mm',
            },
            'context_radius': 300,
            'norm_tables': {
                'min_class': {
                    'XC1': 20, 'XC2': 25, 'XC3': 30, 'XC4': 30,
                    'XD1': 30, 'XD2': 30, 'XD3': 35,
                    'XS1': 30, 'XS2': 35, 'XS3': 35,
                    'XF1': 25, 'XF2': 25, 'XF3': 25, 'XF4': 30,
                    'XA1': 30, 'XA2': 35, 'XA3': 40,
                    'XM1': 30, 'XM2': 30, 'XM3': 35,
                },
                'max_wc': {
                    'XC1': 0.65, 'XC2': 0.60, 'XC3': 0.55, 'XC4': 0.50,
                    'XD1': 0.55, 'XD2': 0.55, 'XD3': 0.45,
                    'XS1': 0.50, 'XS2': 0.45, 'XS3': 0.45,
                    'XF1': 0.55, 'XF2': 0.55, 'XF3': 0.50, 'XF4': 0.45,
                    'XA1': 0.55, 'XA2': 0.50, 'XA3': 0.45,
                },
                'min_cover_mm': {
                    'XC1': 15, 'XC2': 25, 'XC3': 25, 'XC4': 30,
                    'XD1': 35, 'XD2': 40, 'XD3': 45,
                    'XS1': 35, 'XS2': 40, 'XS3': 45,
                    'XF1': 25, 'XF2': 30, 'XF3': 30, 'XF4': 30,
                    'XA1': 25, 'XA2': 30, 'XA3': 35,
                },
            },
        },
        # ── drawing notes (PZ/01–PZ/10) ──────────────────────────────────
        {
            'id': 'notes',
            'mode': 'header_text',
            'output_field': 'notes',
            'main_pattern': (
                r'(?P<id>PZ\s*/\s*\d{1,2}|POZN(?:\.|ÁMKA)?\s*\.?\s*\d{1,2})'
                r'\s*[:–\-]?\s*'
                r'(?P<text>[^\n]{10,500})'
            ),
            'classify_keywords': {
                'BETON':    ['beton', 'betonáž', 'betonov', 'monolitick'],
                'ETICS':    ['etics', 'kzs', 'zateplen', 'polystyr', 'minerální vat'],
                'IZOLACE':  ['izolac', 'hydroizolac', 'těsn', 'parozábran'],
                'BEDNĚNÍ':  ['bednění', 'bedneni', 'opalubn', 'formwork'],
                'VÝZTUŽ':   ['výztuž', 'vyztuz', 'armatura', 'armování'],
                'PODLAHY':  ['podlah', 'anhydrit', 'nivelační', 'litý potěr'],
                'STŘECHA':  ['střech', 'strech', 'krytina', 'klempíř'],
                'ELEKTRO':  ['elektro', 'kabel', 'rozvodna', 'silnoproud', 'slaboproud'],
                'ZTI':      ['kanalizac', 'vodovod', 'potrub', 'zti', 'splašk'],
                'VZT':      ['vzduchotech', 'vzt', 'klimatizac', 'ventilac'],
                'ÚT':       ['vytápěn', 'topení', 'kotel', 'radiátor', 'podlahov'],
            },
            'max_items': 20,
        },
        # ── title block (razítko) ────────────────────────────────────────
        {
            'id': 'title_block',
            'mode': 'field_patterns',
            'output_field': 'title_block',
            'field_patterns': {
                'stavba':     r'(?:STAVBA|AKCE)\s*[:]\s*(.+?)(?:\n|$)',
                'objekt':     r'(?:OBJEKT|SO)\s*[:]\s*(.+?)(?:\n|$)',
                'obsah':      r'OBSAH\s+(?:VÝKRESU)?\s*[:]\s*(.+?)(?:\n|$)',
                'stupen_pd':  r'(?:STUPEŇ|STUPEN)\s*(?:PD)?\s*[:]\s*(D[ÚU]R|DSP|DPS|DVZ|DSPS|PDPS)',
                'meritko':    r'(?:MĚŘÍTKO|MERITKO|M)\s*[:]\s*(1\s*:\s*\d+)',
                'format':     r'FORMÁT\s*[:]\s*(A[0-4])',
                'cislo_vykresu': r'(?:ČÍSLO\s+VÝKRESU|Č\.\s*VÝK(?:R\.?)?|VÝKRES\s+Č\.)\s*[:]\s*(\S+)',
                'datum':      r'DATUM\s*[:]\s*(\d{1,2}[\./]\d{1,2}[\./]\d{2,4})',
                'revize':     r'REVIZE\s*[:]\s*(\S+)',
                'projektant': r'(?:VYPRACOVAL|ZPRACOVAL)\s*[:]\s*(.+?)(?:\n|$)',
                'zodpovedny_projektant': r'(?:ZODPOVĚDNÝ\s+PROJEKTANT|HLAVNÍ\s+(?:INŽENÝR|PROJEKTANT)|HIP)\s*[:]\s*(.+?)(?:\n|$)',
            },
        },
        # ── ETICS / KZS ─────────────────────────────────────────────────
        {
            'id': 'etics',
            'mode': 'collect_all',
            'output_field': 'etics_notes',
            'main_pattern': (
                r'((?:ZATEPLEN[ÍI]|KZS|ETICS|kontaktn[íi]\s+zateplovac[íi])'
                r'[^.;\n]{10,200})'
            ),
            'max_items': 10,
        },
        # ── SCC detection ────────────────────────────────────────────────
        {
            'id': 'scc',
            'mode': 'boolean',
            'output_field': 'has_scc',
            'main_pattern': r'SCC|samozhutn[ěi]teln[ýé]\s+beton',
        },
        # ── To add new types, add records here: ──────────────────────────
        # {
        #     'id': 'skladba_vrstev',
        #     'mode': 'collect_all',
        #     'output_field': 'skladba_vrstev',  # add field to DrawingData first
        #     'main_pattern': r'(SKLADBA\s*[:–].{10,200})',
        #     'max_items': 20,
        # },
    ]

    # ── FRAMEWORK: iterate over registry ─────────────────────────────────

    def extract_drawing(self, text: str) -> Optional[DrawingData]:
        """
        Registry-driven extraction. Iterates over DRAWING_REGISTRY,
        runs the appropriate handler per mode, collects results into DrawingData.
        """
        results: Dict[str, Any] = {}

        for entry in self.DRAWING_REGISTRY:
            mode = entry['mode']
            field = entry['output_field']

            if mode == 'boolean':
                results[field] = bool(re.search(entry['main_pattern'], text, re.IGNORECASE))
            elif mode == 'collect_all':
                matches = [m.group(1).strip()
                           for m in re.finditer(entry['main_pattern'], text, re.IGNORECASE)]
                results[field] = matches[:entry.get('max_items', 50)]
            elif mode == 'field_patterns':
                results[field] = self._run_field_patterns(text, entry['field_patterns'])
            elif mode == 'header_text':
                results[field] = self._run_header_text(text, entry)
            elif mode == 'element_value':
                elements = self._run_element_value(text, entry)
                results[field] = elements
                # Norm validation for concrete elements
                if entry.get('norm_tables'):
                    results.setdefault('norm_findings', []).extend(
                        self._run_norm_validation(elements, entry['norm_tables'])
                    )

        # Check if anything was found
        has_content = any([
            results.get('concrete_by_element'),
            results.get('notes'),
            results.get('title_block'),
            results.get('etics_notes'),
            results.get('has_scc'),
        ])
        if not has_content:
            return None

        # Stats
        self.stats['drawing_concrete_elements'] = len(results.get('concrete_by_element', []))
        self.stats['drawing_notes'] = len(results.get('notes', []))
        self.stats['drawing_etics'] = len(results.get('etics_notes', []))
        self.stats['drawing_has_scc'] = results.get('has_scc', False)
        self.stats['drawing_norm_findings'] = len(results.get('norm_findings', []))

        return DrawingData(
            concrete_by_element=results.get('concrete_by_element', []),
            notes=results.get('notes', []),
            title_block=results.get('title_block'),
            etics_notes=results.get('etics_notes', []),
            has_scc=results.get('has_scc', False),
            norm_findings=results.get('norm_findings', []),
        )

    # ── Mode handlers ────────────────────────────────────────────────────

    def _run_element_value(self, text: str, entry: Dict) -> List[ConcreteByElement]:
        """Mode 'element_value': ELEMENT: C30/37 – XF2, XC2 – CI 0,4 – Dmax 22"""
        pattern = re.compile(entry['main_pattern'], re.MULTILINE | re.IGNORECASE)
        sub = entry.get('sub_patterns', {})
        ctx = entry.get('context_patterns', {})
        radius = entry.get('context_radius', 300)

        results: List[ConcreteByElement] = []
        seen: set = set()

        for m in pattern.finditer(text):
            raw_element = m.group('element').strip().rstrip(':–- ')
            concrete_class = m.group('class').replace(' ', '')
            rest = m.group('rest') or ''

            # Expand abbreviations, normalize
            element_upper = raw_element.upper().strip()
            element_upper = self.ELEMENT_ALIASES.get(element_upper, element_upper)
            if element_upper in seen:
                continue
            seen.add(element_upper)

            # Sub-pattern extraction from "rest"
            exposure_classes: List[ExposureClass] = []
            if sub.get('exposure'):
                for exp_m in re.finditer(sub['exposure'], rest):
                    try:
                        exposure_classes.append(ExposureClass(exp_m.group(0).upper()))
                    except ValueError:
                        pass

            wc_m = re.search(sub['wc_ratio'], rest, re.IGNORECASE) if sub.get('wc_ratio') else None
            max_wc = float(wc_m.group(1).replace(',', '.')) if wc_m else None

            dmax_m = re.search(sub['dmax'], rest, re.IGNORECASE) if sub.get('dmax') else None
            dmax = int(dmax_m.group(1)) if dmax_m else None

            cons_m = re.search(sub['consistency'], rest) if sub.get('consistency') else None
            consistency = cons_m.group(1).upper() if cons_m else None

            scc = bool(re.search(sub['scc'], rest, re.IGNORECASE)) if sub.get('scc') else False

            # Context patterns (search nearby text)
            nearby = text[max(0, m.start() - radius):min(len(text), m.end() + radius)]
            cover_min = cover_nom = penetration = None

            if ctx.get('cover_combined'):
                cc_m = re.search(ctx['cover_combined'], nearby, re.IGNORECASE)
                if cc_m:
                    cover_min = int(cc_m.group(1))
                    cover_nom = int(cc_m.group(2))

            if cover_min is None and ctx.get('cover_min'):
                cm_m = re.search(ctx['cover_min'], nearby, re.IGNORECASE)
                if cm_m:
                    cover_min = int(cm_m.group(1))
            if cover_nom is None and ctx.get('cover_nom'):
                cn_m = re.search(ctx['cover_nom'], nearby, re.IGNORECASE)
                if cn_m:
                    cover_nom = int(cn_m.group(1))

            if ctx.get('penetration'):
                pen_m = re.search(ctx['penetration'], nearby, re.IGNORECASE)
                if pen_m:
                    penetration = int(pen_m.group(1))

            results.append(ConcreteByElement(
                element=element_upper,
                concrete_class=concrete_class,
                exposure_classes=exposure_classes,
                max_wc_ratio=max_wc,
                dmax_mm=dmax,
                consistency_class=consistency,
                scc=scc,
                cover_min_mm=cover_min,
                cover_nom_mm=cover_nom,
                max_penetration_mm=penetration,
                raw_text=m.group(0).strip()[:200],
            ))

        return results

    def _run_header_text(self, text: str, entry: Dict) -> List[DrawingNote]:
        """Mode 'header_text': PZ/01: Betonáž základových patek..."""
        pattern = re.compile(entry['main_pattern'], re.IGNORECASE)
        keywords = entry.get('classify_keywords', {})
        max_items = entry.get('max_items', 50)

        notes: List[DrawingNote] = []
        seen: set = set()

        for m in pattern.finditer(text):
            note_id = re.sub(r'\s+', '', m.group('id')).upper()
            note_text = m.group('text').strip()

            if note_id in seen:
                continue
            seen.add(note_id)

            # Classify work type via keywords
            work_type = None
            text_norm = self._normalize_diacritics(note_text.lower())
            for wtype, kws in keywords.items():
                for kw in kws:
                    if self._normalize_diacritics(kw.lower()) in text_norm:
                        work_type = wtype
                        break
                if work_type:
                    break

            notes.append(DrawingNote(note_id=note_id, text=note_text, work_type=work_type))

        return notes[:max_items]

    def _run_field_patterns(self, text: str, field_patterns: Dict[str, str]) -> Optional[TitleBlock]:
        """Mode 'field_patterns': each field matched independently."""
        data: Dict[str, str] = {}
        for field, pat in field_patterns.items():
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).strip().rstrip(',.')
                if val and len(val) < 200:
                    data[field] = val
        return TitleBlock(**data) if data else None

    def _run_norm_validation(
        self, elements: List[ConcreteByElement], tables: Dict
    ) -> List[DrawingNormFinding]:
        """Validate concrete elements against norm tables from registry."""
        findings: List[DrawingNormFinding] = []
        min_class_tbl = tables.get('min_class', {})
        max_wc_tbl = tables.get('max_wc', {})
        min_cover_tbl = tables.get('min_cover_mm', {})

        for elem in elements:
            class_m = re.match(r'C(\d{2,3})/\d{2,3}', elem.concrete_class)
            if not class_m:
                continue
            fck = int(class_m.group(1))

            # Check 1: min concrete class per exposure
            for exp in elem.exposure_classes:
                ec = exp.value
                req = min_class_tbl.get(ec)
                if req:
                    ok = fck >= req
                    findings.append(DrawingNormFinding(
                        element=elem.element, status='pass' if ok else 'violation',
                        rule='CSN_EN_206_MIN_CLASS',
                        message=(f'{elem.element}: {elem.concrete_class} '
                                 f'{"vyhovuje" if ok else "nesplňuje"} {ec} '
                                 f'(min. C{req}{"" if ok else f", skutečnost C{fck}"})'),
                        norm='ČSN EN 206, Tab. F.1',
                    ))

            # Check 2: max w/c ratio
            if elem.max_wc_ratio is not None:
                for exp in elem.exposure_classes:
                    ec = exp.value
                    limit = max_wc_tbl.get(ec)
                    if limit:
                        ok = elem.max_wc_ratio <= limit
                        findings.append(DrawingNormFinding(
                            element=elem.element, status='pass' if ok else 'violation',
                            rule='CSN_EN_206_MAX_WC',
                            message=(f'{elem.element}: w/c={elem.max_wc_ratio:.2f} '
                                     f'{"vyhovuje" if ok else "překračuje limit"} '
                                     f'{ec} (max. {limit:.2f})'),
                            norm='ČSN EN 206, Tab. F.1',
                        ))
                        break  # one check per element is enough

            # Check 3: min cover
            if elem.cover_min_mm is not None:
                worst_req, worst_ec = 0, ''
                for exp in elem.exposure_classes:
                    r = min_cover_tbl.get(exp.value, 0)
                    if r > worst_req:
                        worst_req, worst_ec = r, exp.value
                if worst_req > 0:
                    ok = elem.cover_min_mm >= worst_req
                    findings.append(DrawingNormFinding(
                        element=elem.element, status='pass' if ok else 'violation',
                        rule='CSN_EN_1992_MIN_COVER',
                        message=(f'{elem.element}: krytí min. {elem.cover_min_mm} mm '
                                 f'{"vyhovuje" if ok else "<"} '
                                 f'{"" if ok else "požadavek "}{worst_ec} ({worst_req} mm)'),
                        norm='ČSN EN 1992-1-1, Tab. 4.4N',
                    ))

            # Check 4: missing exposure
            if not elem.exposure_classes:
                findings.append(DrawingNormFinding(
                    element=elem.element, status='warning',
                    rule='CSN_EN_206_EXPOSURE_MISSING',
                    message=f'{elem.element}: chybí stupeň vlivu prostředí (XC/XD/XF/XA/XS)',
                    norm='ČSN EN 206',
                ))

        return findings

    def get_stats(self) -> Dict[str, int]:
        """Get extraction statistics"""
        return self.stats


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def extract_from_text(text: str) -> Dict[str, Any]:
    """
    Convenience function to extract all facts from text.

    Usage:
        results = extract_from_text(document_text)
        concrete_specs = results['concrete_specifications']
    """
    extractor = CzechConstructionExtractor()
    return extractor.extract_all(text)
