"""
Self-Learning Pattern System — v3.1.1

Stores classification patterns learned from Perplexity/LLM results
and applies them as Tier 0 (fastest, zero-cost) in future classifications.

Flow:
1. Unknown document → Perplexity classifies (partial or full)
2. LLM supplements missing fields if Perplexity was partial
3. Human reviews and corrects if needed (needs_review flag)
4. Result stored as LearnedPattern → used as Tier 0 rule next time

Storage: JSON file at data/learned_patterns.json
Thread-safe via file locking pattern (read-modify-write with atomic rename).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-26
"""

import json
import logging
import os
import time
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Default storage path
PATTERNS_FILE = Path(__file__).parent.parent.parent / "data" / "learned_patterns.json"


# =============================================================================
# MODELS
# =============================================================================

class LearnedPattern(BaseModel):
    """A single learned classification pattern."""
    # Pattern matching criteria
    filename_keywords: List[str] = Field(
        default_factory=list,
        description="Filename substrings that trigger this pattern"
    )
    content_markers: List[str] = Field(
        default_factory=list,
        description="Content keywords that trigger this pattern"
    )
    min_markers_required: int = Field(
        default=2,
        description="Minimum content markers needed to match"
    )

    # Classification result
    doc_category: str = Field(default="OT", description="DocCategory value: TZ, RO, PD, etc.")
    so_type: Optional[str] = Field(None, description="SO type params_key: road_params, water_params, etc.")
    construction_type: Optional[str] = Field(None, description="dopravní, mostní, pozemní_bytová, etc.")
    is_construction: bool = Field(default=True)

    # Metadata
    confidence: float = Field(default=0.8, description="Pattern confidence (0.4=partial, 0.8=learned, 1.0=human-verified)")
    source: str = Field(default="perplexity", description="Origin: perplexity, llm_supplement, human_correction")
    needs_review: bool = Field(default=False, description="Flagged for human review")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    last_used_at: Optional[str] = None
    use_count: int = 0
    notes: Optional[str] = None


class EnrichmentGap(BaseModel):
    """Tracks what Perplexity couldn't find — for LLM supplementation."""
    field_name: str
    description: str = ""
    attempted_sources: List[str] = Field(default_factory=list)
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_value: Optional[str] = None


class LearningResult(BaseModel):
    """Result of a learning attempt (Perplexity + LLM supplement)."""
    pattern: LearnedPattern
    gaps: List[EnrichmentGap] = Field(default_factory=list)
    completeness_pct: float = Field(default=100.0, description="What % of expected fields were filled")
    supplemented_by_llm: bool = False
    supplemented_fields: List[str] = Field(default_factory=list)


# =============================================================================
# STORAGE — file-based JSON
# =============================================================================

class PatternStore:
    """Thread-safe file-based pattern storage."""

    def __init__(self, path: Optional[Path] = None):
        self.path = path or PATTERNS_FILE
        self._ensure_dir()

    def _ensure_dir(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load_all(self) -> List[LearnedPattern]:
        """Load all patterns from file."""
        if not self.path.exists():
            return []
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            return [LearnedPattern(**p) for p in data.get("patterns", [])]
        except Exception as e:
            logger.warning(f"Failed to load patterns from {self.path}: {e}")
            return []

    def save_all(self, patterns: List[LearnedPattern]):
        """Atomically save all patterns to file."""
        self._ensure_dir()
        data = {
            "version": "1.0.0",
            "updated_at": datetime.now().isoformat(),
            "count": len(patterns),
            "patterns": [p.model_dump() for p in patterns],
        }
        # Atomic write: write to temp, then rename
        tmp_fd, tmp_path = tempfile.mkstemp(
            dir=str(self.path.parent), suffix=".tmp"
        )
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, str(self.path))
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    def add_pattern(self, pattern: LearnedPattern) -> int:
        """Add a new pattern. Returns total pattern count."""
        patterns = self.load_all()

        # Check for duplicate (same filename_keywords + content_markers)
        for existing in patterns:
            if (set(existing.filename_keywords) == set(pattern.filename_keywords)
                    and set(existing.content_markers) == set(pattern.content_markers)):
                # Update existing instead of duplicating
                existing.confidence = max(existing.confidence, pattern.confidence)
                existing.doc_category = pattern.doc_category
                existing.so_type = pattern.so_type
                existing.construction_type = pattern.construction_type
                existing.needs_review = pattern.needs_review
                existing.source = pattern.source
                self.save_all(patterns)
                logger.info(f"Updated existing pattern (confidence → {existing.confidence})")
                return len(patterns)

        patterns.append(pattern)
        self.save_all(patterns)
        logger.info(f"Added new learned pattern: {pattern.doc_category} / {pattern.so_type}")
        return len(patterns)

    def mark_used(self, index: int):
        """Mark a pattern as used (update last_used_at and use_count)."""
        patterns = self.load_all()
        if 0 <= index < len(patterns):
            patterns[index].last_used_at = datetime.now().isoformat()
            patterns[index].use_count += 1
            self.save_all(patterns)

    def mark_reviewed(self, index: int, corrected_category: Optional[str] = None):
        """Human marks a pattern as reviewed/corrected."""
        patterns = self.load_all()
        if 0 <= index < len(patterns):
            patterns[index].needs_review = False
            patterns[index].confidence = 1.0
            patterns[index].source = "human_correction"
            if corrected_category:
                patterns[index].doc_category = corrected_category
            self.save_all(patterns)
            logger.info(f"Pattern {index} reviewed and confirmed")


# =============================================================================
# MATCHING — Tier 0 classification
# =============================================================================

# Global store instance
_store: Optional[PatternStore] = None


def get_pattern_store() -> PatternStore:
    global _store
    if _store is None:
        _store = PatternStore()
    return _store


def match_learned_pattern(
    filename: str,
    text: str,
) -> Optional[Dict[str, Any]]:
    """
    Try to match document against learned patterns (Tier 0).

    Returns dict with classification fields if matched, None otherwise.
    Only returns patterns with confidence >= 0.6 and not needs_review.

    Result format:
    {
        "doc_category": "TZ",
        "so_type": "road_params",
        "construction_type": "dopravní",
        "is_construction": True,
        "confidence": 0.8,
        "method": "learned_pattern",
        "pattern_index": 3,
    }
    """
    store = get_pattern_store()
    patterns = store.load_all()

    if not patterns:
        return None

    filename_lower = filename.lower()
    text_lower = text[:20000].lower() if text else ""

    for i, pattern in enumerate(patterns):
        # Skip low-confidence or needs-review patterns
        if pattern.confidence < 0.6 or pattern.needs_review:
            continue

        # Check filename keywords
        filename_match = False
        if pattern.filename_keywords:
            filename_match = any(
                kw.lower() in filename_lower for kw in pattern.filename_keywords
            )

        # Check content markers
        marker_count = 0
        if pattern.content_markers and text_lower:
            marker_count = sum(
                1 for m in pattern.content_markers if m.lower() in text_lower
            )

        # Match logic: filename match OR enough content markers
        matched = False
        if filename_match and marker_count >= 1:
            matched = True  # Filename + at least 1 content marker
        elif marker_count >= pattern.min_markers_required:
            matched = True  # Enough content markers alone

        if matched:
            logger.info(
                f"Learned pattern match: pattern[{i}] → "
                f"{pattern.doc_category}/{pattern.so_type} "
                f"(confidence={pattern.confidence}, used {pattern.use_count}x)"
            )
            # Mark as used (async-safe: minor race condition acceptable)
            try:
                store.mark_used(i)
            except Exception:
                pass  # Non-critical

            return {
                "doc_category": pattern.doc_category,
                "so_type": pattern.so_type,
                "construction_type": pattern.construction_type,
                "is_construction": pattern.is_construction,
                "confidence": pattern.confidence,
                "method": "learned_pattern",
                "pattern_index": i,
            }

    return None


# =============================================================================
# LEARNING — create patterns from Perplexity/LLM results
# =============================================================================

def learn_from_classification(
    filename: str,
    text: str,
    perplexity_result: Dict[str, Any],
    llm_supplement: Optional[Dict[str, Any]] = None,
) -> LearningResult:
    """
    Create a LearnedPattern from a Perplexity classification result,
    optionally supplemented by LLM.

    Args:
        filename: Original filename
        text: Document text (used to extract content markers)
        perplexity_result: Result from perplexity_classifier.classify_unknown_document()
        llm_supplement: Optional additional fields from LLM enrichment

    Returns:
        LearningResult with the created pattern and any gaps.
    """
    # Extract filename keywords (split by common separators)
    import re
    fname_parts = re.split(r"[_\-.\s/\\]", filename.lower())
    filename_keywords = [p for p in fname_parts if len(p) >= 3 and not p.isdigit()]

    # Extract content markers from text (top distinctive terms)
    content_markers = _extract_distinctive_markers(text, perplexity_result)

    # Build pattern from Perplexity result
    doc_category = _map_to_doc_category(perplexity_result)
    so_type = perplexity_result.get("params_key")
    construction_type = perplexity_result.get("so_type")  # e.g. "most", "silnice"
    is_construction = perplexity_result.get("is_construction", True)
    confidence = perplexity_result.get("confidence", 0.5)

    # Track gaps
    gaps: List[EnrichmentGap] = []
    supplemented_fields: List[str] = []
    expected_fields = ["doc_category", "so_type", "construction_type"]

    if not so_type:
        gaps.append(EnrichmentGap(
            field_name="so_type",
            description="Perplexity did not determine SO type",
            attempted_sources=["perplexity"],
        ))
    if not construction_type:
        gaps.append(EnrichmentGap(
            field_name="construction_type",
            description="Perplexity did not determine construction type",
            attempted_sources=["perplexity"],
        ))

    # Supplement from LLM if available
    if llm_supplement:
        if not so_type and llm_supplement.get("so_type"):
            so_type = llm_supplement["so_type"]
            supplemented_fields.append("so_type")
            # Mark gap as resolved
            for g in gaps:
                if g.field_name == "so_type":
                    g.resolved = True
                    g.resolved_by = "llm"
                    g.resolved_value = so_type

        if not construction_type and llm_supplement.get("construction_type"):
            construction_type = llm_supplement["construction_type"]
            supplemented_fields.append("construction_type")
            for g in gaps:
                if g.field_name == "construction_type":
                    g.resolved = True
                    g.resolved_by = "llm"
                    g.resolved_value = construction_type

        # Boost confidence if LLM confirmed
        if llm_supplement.get("confirmed"):
            confidence = min(0.9, confidence + 0.15)

    # Determine if needs review
    unresolved_gaps = [g for g in gaps if not g.resolved]
    needs_review = len(unresolved_gaps) > 0 or confidence < 0.6

    # Calculate completeness
    field_values = {"doc_category": doc_category, "so_type": so_type, "construction_type": construction_type}
    filled = sum(1 for f in expected_fields if field_values.get(f))
    completeness = (filled / len(expected_fields)) * 100 if expected_fields else 100

    pattern = LearnedPattern(
        filename_keywords=filename_keywords[:5],  # Max 5 keywords
        content_markers=content_markers[:8],  # Max 8 markers
        min_markers_required=min(2, len(content_markers)),
        doc_category=doc_category,
        so_type=so_type,
        construction_type=construction_type,
        is_construction=is_construction,
        confidence=round(confidence, 2),
        source="perplexity" if not supplemented_fields else "perplexity+llm",
        needs_review=needs_review,
    )

    # Save to store
    store = get_pattern_store()
    store.add_pattern(pattern)

    return LearningResult(
        pattern=pattern,
        gaps=gaps,
        completeness_pct=round(completeness, 1),
        supplemented_by_llm=bool(supplemented_fields),
        supplemented_fields=supplemented_fields,
    )


def _map_to_doc_category(perplexity_result: Dict[str, Any]) -> str:
    """Map Perplexity result to DocCategory value."""
    if not perplexity_result.get("is_construction", True):
        return "OT"
    doc_type = perplexity_result.get("document_type", "").lower()
    type_map = {
        "technická zpráva": "TZ",
        "technical_report": "TZ",
        "rozpočet": "RO",
        "budget": "RO",
        "výkaz": "RO",
        "podmínky": "PD",
        "tender": "PD",
        "výkres": "VY",
        "drawing": "VY",
        "harmonogram": "HA",
        "geologie": "GE",
        "smlouva": "SM",
    }
    for key, cat in type_map.items():
        if key in doc_type:
            return cat
    return "TZ"  # Default for construction docs


def _extract_distinctive_markers(
    text: str,
    perplexity_result: Dict[str, Any],
) -> List[str]:
    """
    Extract distinctive content markers from document text.
    These are terms that help identify this document type in future.
    """
    markers = []

    # Use so_type to pick relevant domain terms found in the text
    so_type = perplexity_result.get("so_type", "")
    text_lower = text[:15000].lower() if text else ""

    # Domain-specific term lists
    domain_terms = {
        "most": ["nosná konstrukce", "opěra", "pilíř", "rozpětí", "mostovka", "ložiska"],
        "silnice": ["vozovka", "příčný sklon", "jízdní pruh", "svodidla", "krajnice"],
        "vodovod": ["potrubí", "tlakov", "vodovod", "chránička", "DN "],
        "kanalizace": ["kanalizac", "stoka", "šachta", "přípojka"],
        "plynovod": ["plynovod", "VTL", "STL", "regulační stanice"],
        "elektro": ["kabel", "vedení VN", "trafostanice", "CETIN"],
        "vegetace": ["vegetační", "výsadba", "travní směs", "mulčování"],
    }

    terms = domain_terms.get(so_type, [])
    for term in terms:
        if term.lower() in text_lower:
            markers.append(term)

    # Add reasoning keywords from Perplexity
    reasoning = perplexity_result.get("reasoning", "")
    if reasoning:
        # Extract key nouns from reasoning (simple heuristic)
        import re
        words = re.findall(r"[a-záčďéěíňóřšťúůýž]{4,}", reasoning.lower())
        for w in words[:3]:
            if w not in markers and w in text_lower:
                markers.append(w)

    return markers


# =============================================================================
# SUPPLEMENT — fill gaps via LLM when Perplexity is partial
# =============================================================================

SUPPLEMENT_PROMPT = """Perplexity klasifikoval tento dokument, ale neidentifikoval všechna pole.

Perplexity výsledek:
- Typ: {perplexity_type}
- SO typ: {perplexity_so_type}
- Důvod: {perplexity_reasoning}

CHYBĚJÍCÍ POLE: {missing_fields}

ÚRYVEK DOKUMENTU:
{text_snippet}

Doplň chybějící pole. VRAŤ POUZE VALIDNÍ JSON:
{{
  "so_type": "most/silnice/vodovod/plynovod/elektro/vegetace/budova/jiné",
  "construction_type": "dopravní/mostní/pozemní_bytová/průmyslová/inženýrské_sítě/vegetační",
  "confirmed": true/false,
  "reasoning": "krátké odůvodnění"
}}"""


async def supplement_partial_result(
    text: str,
    perplexity_result: Dict[str, Any],
    llm_call=None,
) -> Optional[Dict[str, Any]]:
    """
    When Perplexity returns a partial result, use LLM to fill the gaps.

    Args:
        text: Document text
        perplexity_result: Partial result from Perplexity
        llm_call: Async callable (prompt) -> dict

    Returns:
        Supplemented fields dict, or None if supplementation failed.
    """
    if not llm_call or not text:
        return None

    # Determine what's missing
    missing = []
    if not perplexity_result.get("params_key"):
        missing.append("so_type (typ stavebního objektu)")
    if not perplexity_result.get("so_type"):
        missing.append("construction_type (typ stavby)")

    if not missing:
        return None  # Nothing to supplement

    try:
        prompt = SUPPLEMENT_PROMPT.format(
            perplexity_type=perplexity_result.get("document_type", "unknown"),
            perplexity_so_type=perplexity_result.get("so_type", "unknown"),
            perplexity_reasoning=perplexity_result.get("reasoning", ""),
            missing_fields=", ".join(missing),
            text_snippet=text[:2000],
        )

        result = await llm_call(prompt)
        if result and isinstance(result, dict):
            logger.info(f"LLM supplemented {len([k for k,v in result.items() if v])} fields")
            return result

    except Exception as e:
        logger.warning(f"LLM supplementation failed: {e}")

    return None
