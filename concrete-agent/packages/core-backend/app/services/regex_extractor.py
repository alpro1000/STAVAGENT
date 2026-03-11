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
