"""
Extraction Pipeline — Confidence-tracked value models.

Every extracted value carries:
  - confidence (0.0-1.0)
  - source (regex/gemini/perplexity/human)
  - source_detail (which regex pattern, which AI call)
  - page number + context snippet

Principle: each layer ADDS to previous results,
never overwrites data with higher confidence.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExtractionSource(str, Enum):
    REGEX = "regex"
    GEMINI_FLASH = "gemini_flash"
    PERPLEXITY = "perplexity"
    HUMAN = "human"


# Confidence ranges — NEVER overwrite higher confidence
CONFIDENCE_MAP = {
    ExtractionSource.REGEX: 1.0,
    ExtractionSource.HUMAN: 0.99,
    ExtractionSource.PERPLEXITY: 0.85,
    ExtractionSource.GEMINI_FLASH: 0.7,
}


class ExtractedValue(BaseModel):
    """Single extracted value with provenance metadata."""
    value: Any
    unit: Optional[str] = None
    confidence: float
    source: ExtractionSource
    source_detail: str = ""
    page: Optional[int] = None
    context: Optional[str] = None


class ExtractionResult(BaseModel):
    """Full pipeline result for one document."""
    document_hash: str = ""
    filename: str = ""
    extracted_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    # Layer 1: Raw text
    total_pages: int = 0
    raw_text_length: int = 0
    parser_used: str = ""

    # Layer 2: Regex findings (confidence=1.0)
    norm_references: List[ExtractedValue] = Field(default_factory=list)
    tolerances: List[ExtractedValue] = Field(default_factory=list)
    deadlines: List[ExtractedValue] = Field(default_factory=list)
    formulas: List[ExtractedValue] = Field(default_factory=list)
    materials: List[ExtractedValue] = Field(default_factory=list)
    dimensions: List[ExtractedValue] = Field(default_factory=list)
    document_meta: Dict[str, ExtractedValue] = Field(default_factory=dict)

    # Layer 3a: Gemini enrichment (confidence=0.7)
    ai_summary: Optional[str] = None
    ai_key_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    ai_risks: List[Dict[str, Any]] = Field(default_factory=list)
    ai_volumes: List[Dict[str, Any]] = Field(default_factory=list)
    ai_cross_references: List[Dict[str, Any]] = Field(default_factory=list)

    # Layer 3b: Perplexity verification (confidence=0.85)
    verified_norms: List[Dict[str, Any]] = Field(default_factory=list)
    supplemented_data: List[Dict[str, Any]] = Field(default_factory=list)

    # Compiled rules ready for NKB
    extracted_rules: List[Dict[str, Any]] = Field(default_factory=list)

    @property
    def stats(self) -> Dict[str, int]:
        return {
            "pages": self.total_pages,
            "parser": self.parser_used,
            "norms_found": len(self.norm_references),
            "tolerances_found": len(self.tolerances),
            "deadlines_found": len(self.deadlines),
            "materials_found": len(self.materials),
            "formulas_found": len(self.formulas),
            "ai_requirements": len(self.ai_key_requirements),
            "ai_risks": len(self.ai_risks),
            "verified_norms": len(self.verified_norms),
            "total_rules": len(self.extracted_rules),
        }
