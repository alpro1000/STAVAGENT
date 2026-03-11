"""
Matching utility for Monolit Planner → Rozpis zdrojů (TOV) integration.

Provides functions for:
1. Exact code matching
2. Fuzzy name + quantity matching
3. Confidence scoring
4. Material/profession mapping
"""

import re
import unicodedata
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum


class ConfidenceLevel(Enum):
    """Match confidence levels."""
    HIGH = 0.9  # Auto-write
    MEDIUM = 0.6  # Require user confirm
    LOW = 0.0  # Skip


class NormalizationMode(Enum):
    """Text normalization modes."""
    STRICT = "strict"  # Code-based
    FUZZY = "fuzzy"  # Name-based


def strip_diacritics(text: str) -> str:
    """Remove diacritics from text (výkop → vykop)."""
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def normalize_text(text: str, mode: NormalizationMode = NormalizationMode.FUZZY) -> str:
    """
    Normalize text for matching.
    
    Args:
        text: Input text
        mode: STRICT (exact code) or FUZZY (name matching)
    
    Returns:
        Normalized text (lowercase, diacritics removed, whitespace compressed)
    """
    if not text:
        return ""
    
    text = str(text).strip()
    text = strip_diacritics(text).lower()
    
    if mode == NormalizationMode.FUZZY:
        # Remove common variations
        text = re.sub(r'\s+', ' ', text)  # Compress whitespace
        text = re.sub(r'[^\w\s]', '', text)  # Remove special chars
    
    return text


def extract_code_from_position(position: Dict[str, Any]) -> Optional[str]:
    """
    Extract standardized code from Monolit position.
    
    Supports formats:
    - kod: "231112" (direct)
    - popis contains code pattern (fallback)
    """
    if code := position.get("kod"):
        return str(code).strip()
    
    # Fallback: extract from popis
    if popis := position.get("popis"):
        match = re.search(r'\b(\d{6})\b', str(popis))
        if match:
            return match.group(1)
    
    return None


def extract_quantity(position: Dict[str, Any]) -> Optional[float]:
    """Extract quantity from Monolit position (mnozstvi)."""
    if qty := position.get("mnozstvi"):
        try:
            return float(qty)
        except (ValueError, TypeError):
            pass
    return None


def extract_material_grade(position: Dict[str, Any]) -> Optional[str]:
    """
    Extract concrete grade from position „Název části konstrukce" or popis.
    
    Supported formats: C20/25, B25, C30, etc.
    """
    # Search in structured field first
    if nazev := position.get("nazev_casti_konstrukce"):
        if match := re.search(r'(C\d+/\d+|B\d+|C\d+)', str(nazev)):
            return match.group(1)
    
    # Fallback to popis
    if popis := position.get("popis"):
        if match := re.search(r'(C\d+/\d+|B\d+|C\d+)', str(popis)):
            return match.group(1)
    
    return None


def extract_profession_from_work_type(work_type: str) -> Optional[str]:
    """
    Map Monolit work type → registry profession.
    
    Mapping:
    - Betonování → Betonář
    - Bednění → Tesař / Bednář
    - Výztuž → Zedník / Železář
    - etc.
    """
    mapping = {
        "betonování": "Betonář",
        "bednění": "Tesař/Bednář",
        "bednaření": "Tesař/Bednář",
        "výztuž": "Železář",
        "výztužování": "Železář",
        "armování": "Železář",
        "doprava": "Řidič",
        "příprava": "Pomocný pracovník",
        "bourání": "Demontér",
    }
    
    normalized = normalize_text(work_type, NormalizationMode.FUZZY)
    
    for work_pattern, profession in mapping.items():
        if work_pattern in normalized:
            return profession
    
    return work_type  # Return original if no mapping


def match_positions(
    monolit_positions: List[Dict[str, Any]],
    registry_positions: List[Dict[str, Any]],
    quantity_tolerance_pct: float = 1.0,
) -> Dict[str, Any]:
    """
    Match Monolit positions to Registry positions.
    
    Strategy:
    1. Exact code match (highest confidence)
    2. Code + name fuzziness (high confidence)
    3. Name + quantity tolerance (medium confidence)
    
    Returns:
        {
            "matches": [
                {
                    "monolit": position,
                    "registry": position,
                    "confidence": 0.95,
                    "match_type": "exact_code" | "code_fuzzy_name" | "name_quantity",
                    "diff": {}
                }
            ],
            "unmatched_monolit": [...],
            "unmatched_registry": [...],
            "total_confidence_score": 0.85
        }
    """
    matches = []
    matched_registry_ids = set()
    
    for monolit_pos in monolit_positions:
        monolit_code = extract_code_from_position(monolit_pos)
        monolit_name = normalize_text(monolit_pos.get("popis", ""), NormalizationMode.FUZZY)
        monolit_qty = extract_quantity(monolit_pos)
        
        best_match = None
        best_confidence = 0.0
        best_match_type = None
        
        for registry_pos in registry_positions:
            registry_code = extract_code_from_position(registry_pos)
            registry_name = normalize_text(registry_pos.get("popis", ""), NormalizationMode.FUZZY)
            registry_qty = extract_quantity(registry_pos)
            
            confidence = 0.0
            match_type = None
            
            # Strategy 1: Exact code match
            if monolit_code and registry_code and monolit_code == registry_code:
                confidence = 0.95
                match_type = "exact_code"
            
            # Strategy 2: Code + name similarity
            elif monolit_code and registry_code and monolit_code == registry_code:
                similarity = SequenceMatcher(None, monolit_name, registry_name).ratio()
                if similarity >= 0.8:
                    confidence = 0.92
                    match_type = "code_fuzzy_name"
            
            # Strategy 3: Name similarity + quantity tolerance
            elif monolit_name and registry_name:
                name_similarity = SequenceMatcher(None, monolit_name, registry_name).ratio()
                
                qty_match = True
                if monolit_qty and registry_qty:
                    tolerance = (quantity_tolerance_pct / 100.0) * registry_qty
                    qty_match = abs(monolit_qty - registry_qty) <= tolerance
                
                if name_similarity >= 0.85 and qty_match:
                    confidence = name_similarity * 0.9  # Scale down to 0.6-0.8 range
                    match_type = "name_quantity"
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = (registry_pos, match_type)
        
        if best_match and best_confidence >= ConfidenceLevel.LOW.value:
            registry_pos, match_type = best_match
            matched_registry_ids.add(id(registry_pos))
            
            matches.append({
                "monolit_position": monolit_pos,
                "registry_position": registry_pos,
                "confidence": best_confidence,
                "match_type": match_type,
                "recommendation": (
                    "auto_apply" if best_confidence >= ConfidenceLevel.HIGH.value
                    else "user_confirm" if best_confidence >= ConfidenceLevel.MEDIUM.value
                    else "skip"
                ),
            })
    
    unmatched_monolit = [
        pos for pos in monolit_positions
        if not any(m["monolit_position"] is pos for m in matches)
    ]
    
    unmatched_registry = [
        pos for pos in registry_positions
        if id(pos) not in matched_registry_ids
    ]
    
    avg_confidence = (
        sum(m["confidence"] for m in matches) / len(matches)
        if matches else 0.0
    )
    
    return {
        "matches": matches,
        "unmatched_monolit": unmatched_monolit,
        "unmatched_registry": unmatched_registry,
        "total_confidence_score": avg_confidence,
        "stats": {
            "total_monolit": len(monolit_positions),
            "total_registry": len(registry_positions),
            "matched": len(matches),
            "auto_apply_count": sum(1 for m in matches if m["recommendation"] == "auto_apply"),
            "user_confirm_count": sum(1 for m in matches if m["recommendation"] == "user_confirm"),
            "skip_count": sum(1 for m in matches if m["recommendation"] == "skip"),
        }
    }


def build_tov_entry_from_monolit(
    monolit_position: Dict[str, Any],
    profession_mapping: Optional[Dict[str, str]] = None,
    material_mapping: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Transform Monolit position → TOV (Rozpis zdrojů) entry.
    
    Extracts: Počet, Hodiny, Normohodiny, Sazba (Kč/h), Náklady (labour)
              Materiál, Množství, MJ, Cena (materials)
    
    Returns:
        {
            "work_type": "Betonování",
            "profession": "Betonář",
            "quantity": 10,
            "hours": 100,
            "norm_hours": 120,
            "rate_per_hour": 250,
            "total_cost": 25000,
            "material_grade": "C25/30",
            "material_id": None,  # Will be looked up in catalog
            "source": "MonolitPlanner",
            "external_id": position_id,
        }
    """
    
    work_type = monolit_position.get("typ_prace", "")
    profession = extract_profession_from_work_type(work_type)
    
    return {
        "work_type": work_type,
        "profession": profession,
        "quantity": extract_quantity(monolit_position),
        "hours": monolit_position.get("hodiny"),
        "norm_hours": monolit_position.get("normohodiny"),
        "rate_per_hour": monolit_position.get("sazba_kc_h"),
        "total_cost": monolit_position.get("naklady"),
        "material_grade": extract_material_grade(monolit_position),
        "source": "MonolitPlanner",
        "external_id": monolit_position.get("id"),
    }
