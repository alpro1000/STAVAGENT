"""
ExtractionResult → Calculator Suggestions bridge.

Converts ExtractionResult (from chunked extraction pipeline) into the
fact-dict format expected by calculator_suggestions.map_facts_to_suggestions().

Called automatically when a document is processed via add-document endpoint.
Populates _PROJECT_FACTS so that calculator suggestions work with real data
(not just seed data).

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import logging
import re
from typing import Any, Dict, List, Optional

from app.models.extraction_schemas import (
    ExtractionResult,
    ExtractedValue,
)

logger = logging.getLogger(__name__)

# Regex for SO-number extraction from text context
_SO_RE = re.compile(r"SO[-\s]?(\d{3})", re.IGNORECASE)


def extraction_result_to_facts(
    extraction: ExtractionResult,
    document_name: str = "",
    document_type: str = "tz",
) -> List[Dict[str, Any]]:
    """
    Convert an ExtractionResult into a list of fact dicts
    compatible with calculator_suggestions.map_facts_to_suggestions().

    Each fact dict represents one document (or one SO within a document).
    Facts are grouped by building_object (SO-xxx) when possible.

    Args:
        extraction: ExtractionResult from chunked pipeline or adapter
        document_name: Human-readable document name
        document_type: "tz", "soupis", "drawing", etc.

    Returns:
        List of fact dicts in the format expected by map_facts_to_suggestions()
    """
    if not extraction:
        return []

    doc_name = document_name or extraction.filename or "Neznámý dokument"

    # Group facts by SO number
    so_facts: Dict[Optional[str], _FactCollector] = {}

    # Process materials (concrete grades, exposure classes, rebar, pipes)
    for mat in extraction.materials:
        so = _detect_so_from_fact(mat, extraction)
        collector = so_facts.setdefault(so, _FactCollector(so))
        val = str(mat.value).strip()

        if re.match(r"C\s*\d{2,3}\s*/\s*\d{2,3}", val):
            collector.concrete_classes.append(mat)
        elif re.match(r"X[CDFSAM]\d", val):
            collector.exposure_classes.append(mat)
        elif re.match(r"B\s*500\s*[ABC]", val):
            collector.steel_grades.append(mat)
        else:
            collector.other_materials.append(mat)

    # Process dimensions (volumes, quantities)
    for dim in extraction.dimensions:
        so = _detect_so_from_fact(dim, extraction)
        collector = so_facts.setdefault(so, _FactCollector(so))
        collector.dimensions.append(dim)

    # Process norms
    for norm in extraction.norm_references:
        so = _detect_so_from_fact(norm, extraction)
        collector = so_facts.setdefault(so, _FactCollector(so))
        collector.norms.append(norm)

    # Build raw_text from AI summaries and contexts
    raw_text_parts = []
    if extraction.ai_summary:
        raw_text_parts.append(extraction.ai_summary)
    for mat in extraction.materials:
        if mat.context:
            raw_text_parts.append(mat.context)
    for dim in extraction.dimensions:
        if dim.context:
            raw_text_parts.append(dim.context)
    # Add domain implications as text for boolean flag detection
    for impl in extraction.domain_implications:
        raw_text_parts.append(f"{impl.trigger_fact}: {impl.implication}")
    raw_text = "\n".join(raw_text_parts)

    # Build fact dicts (one per SO, plus one for project-global)
    result_facts: List[Dict[str, Any]] = []

    for so_num, collector in so_facts.items():
        fact = _build_fact_dict(
            collector, doc_name, document_type, so_num, raw_text
        )
        result_facts.append(fact)

    # If no facts grouped by SO, create one global entry
    if not result_facts and (extraction.materials or extraction.dimensions):
        fact = _build_fact_dict(
            _FactCollector(None), doc_name, document_type, None, raw_text,
        )
        # Add all materials/dimensions to the global entry
        fact["extractions"]["base_construction"] = _build_base_construction(
            extraction.materials, extraction.dimensions
        )
        result_facts.append(fact)

    logger.info(
        "[BRIDGE] %s: %d fact groups (%s) from %d materials, %d dimensions",
        doc_name, len(result_facts),
        ", ".join(f"SO-{c.so_num}" if c.so_num else "global" for c in so_facts.values()),
        len(extraction.materials), len(extraction.dimensions),
    )

    return result_facts


class _FactCollector:
    """Groups facts for one SO (or project-global)."""
    __slots__ = (
        "so_num", "concrete_classes", "exposure_classes",
        "steel_grades", "other_materials", "dimensions", "norms",
    )

    def __init__(self, so_num: Optional[str]):
        self.so_num = so_num
        self.concrete_classes: List[ExtractedValue] = []
        self.exposure_classes: List[ExtractedValue] = []
        self.steel_grades: List[ExtractedValue] = []
        self.other_materials: List[ExtractedValue] = []
        self.dimensions: List[ExtractedValue] = []
        self.norms: List[ExtractedValue] = []


def _detect_so_from_fact(
    fact: ExtractedValue,
    extraction: ExtractionResult,
) -> Optional[str]:
    """Try to detect SO number from fact context or chunk title."""
    # Check context text
    if fact.context:
        m = _SO_RE.search(fact.context)
        if m:
            return f"SO-{m.group(1)}"

    # Check chunk title
    if fact.chunk_id:
        for chunk in extraction.chunk_details:
            if chunk.chunk_id == fact.chunk_id and chunk.section_title:
                m = _SO_RE.search(chunk.section_title)
                if m:
                    return f"SO-{m.group(1)}"

    return None


def _build_fact_dict(
    collector: _FactCollector,
    doc_name: str,
    doc_type: str,
    so_num: Optional[str],
    raw_text: str,
) -> Dict[str, Any]:
    """Build a single fact dict from a collector."""
    base = _build_base_construction(
        collector.concrete_classes + collector.exposure_classes +
        collector.steel_grades + collector.other_materials,
        collector.dimensions,
    )

    pages: Dict[str, int] = {}
    for cc in collector.concrete_classes:
        if cc.page:
            pages["concrete_class"] = cc.page
            break
    for ec in collector.exposure_classes:
        if ec.page:
            pages["exposure_classes"] = ec.page
            break
    for sg in collector.steel_grades:
        if sg.page:
            pages["steel_grade"] = sg.page
            break

    # Determine source_type from highest-confidence fact
    all_facts = (
        collector.concrete_classes + collector.exposure_classes +
        collector.steel_grades + collector.dimensions
    )
    source_type = "regex"
    if all_facts:
        best = max(all_facts, key=lambda f: f.confidence)
        source_type = best.source.value

    return {
        "document_name": doc_name,
        "building_object": so_num,
        "source_type": source_type,
        "extractions": {
            "base_construction": base,
        },
        "raw_text": raw_text,
        "pages": pages,
    }


def _build_base_construction(
    materials: List[ExtractedValue],
    dimensions: List[ExtractedValue],
) -> Dict[str, Any]:
    """Build the base_construction dict from material/dimension facts."""
    base: Dict[str, Any] = {}

    # Concrete class (highest confidence)
    concrete = [
        m for m in materials
        if re.match(r"C\s*\d{2,3}\s*/\s*\d{2,3}", str(m.value))
    ]
    if concrete:
        best = max(concrete, key=lambda f: f.confidence)
        base["concrete_class"] = re.sub(r"\s", "", str(best.value))

    # Exposure classes (collect all unique)
    exposure = [
        m for m in materials
        if re.match(r"X[CDFSAM]\d", str(m.value))
    ]
    if exposure:
        unique_exp = sorted(set(str(e.value) for e in exposure))
        base["exposure_classes"] = "+".join(unique_exp)

    # Steel grade
    steel = [
        m for m in materials
        if re.match(r"B\s*500\s*[ABC]", str(m.value))
    ]
    if steel:
        base["steel_grade"] = re.sub(r"\s", "", str(steel[0].value))

    return base
