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
    ExposedConcreteClass
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
            'raw_facts': []
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
