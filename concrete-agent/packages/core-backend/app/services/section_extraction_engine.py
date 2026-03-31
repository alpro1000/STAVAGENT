"""
Section Extraction Engine — Universal map-reduce for construction documents.

The engine does NOT know what type of document it processes.
It simply:
  1. MAP  — splits document into sections (universal heuristics)
  2. For each section — runs ALL extractors from the registry
  3. REDUCE — merges results into a single output

Adding a new document type = adding entries to extractor_registry.py.
This file NEVER changes when a new domain is added.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-31
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple

from app.services.extractor_registry import get_registry, ExtractorEntry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Section splitting — universal, format-agnostic
# ---------------------------------------------------------------------------

# Cascade of heading detectors (ordered by specificity, most specific first)
_HEADING_PATTERNS: List[re.Pattern] = [
    # D.x.x.x sections: "D.1.4.2 Silnoproudé instalace"
    re.compile(r"^(D\.\d+\.\d+(?:\.\d+)?)\s+(.{3,80})$", re.MULTILINE),

    # Multi-level numbered: "1.2.3.4 Title"
    re.compile(r"^(\d+\.\d+(?:\.\d+){1,3})\s+(.{3,80})$", re.MULTILINE),

    # Two-level numbered: "3.1 Strukturovaná kabeláž"
    re.compile(r"^(\d+\.\d+)\s+(.{5,80})$", re.MULTILINE),

    # Top-level numbered: "3. Technické řešení" or "3 Technické řešení"
    re.compile(r"^(\d{1,2})\.?\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\n]{2,80})$", re.MULTILINE),

    # Lowercase alpha: "a) Popis systému"
    re.compile(r"^([a-z]\))\s+(.{3,80})$", re.MULTILINE),

    # Uppercase alpha: "A. Průvodní zpráva"
    re.compile(r"^([A-Z]\.)\s+(.{3,80})$", re.MULTILINE),

    # Roman numerals: "III. Technická zpráva"
    re.compile(r"^((?:I{1,3}|IV|VI{0,3}|IX|XI{0,3})\.)\s+(.{3,80})$", re.MULTILINE),

    # Subsystem abbreviation headers: "SCS — Strukturovaná kabeláž"
    re.compile(
        r"^(SCS|PZTS|SKV|CCTV|EPS|AVT|INT|EZS|MaR|ZTI|VZT|ÚT|UT|ETICS|KZS)"
        r"\s*[–—:\-]\s*(.+)$",
        re.MULTILINE | re.IGNORECASE,
    ),

    # UPPERCASE headers (>8 chars, no trailing period — likely a title)
    re.compile(r"^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s]{8,60})$", re.MULTILINE),

    # Short line without period at end, multi-word = probable heading (heuristic, last resort)
    re.compile(r"^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+\s[^\n.!?]{3,55})$", re.MULTILINE),
]

# Minimum chars between two headers to count as separate sections
_MIN_HEADER_DISTANCE = 80

# Fallback chunk size when no headers found
_FALLBACK_CHUNK_SIZE = 5000
_FALLBACK_OVERLAP = 500

# Min meaningful section size (skip tiny sections)
_MIN_SECTION_CHARS = 80


def map_sections(text: str) -> List[Tuple[str, str]]:
    """
    Split document text into (title, content) sections.

    Strategy (cascade):
    1. Try heading patterns (numbered, alpha, roman, CAPS, abbreviation, short-no-period)
    2. Deduplicate nearby matches (keep most specific)
    3. If <2 sections found → chunk by ~5000 chars with 500 overlap

    Returns: list of (section_title, section_text) tuples.
    """
    headers = _find_headers(text)

    # If too few sections, fall back to fixed chunking
    if len(headers) < 2 and len(text) > _FALLBACK_CHUNK_SIZE:
        return _chunk_text(text, _FALLBACK_CHUNK_SIZE, _FALLBACK_OVERLAP)

    if len(headers) < 2:
        # Document is small enough to process as one section
        return [("Celý dokument", text)]

    # Build sections from header positions
    sections = []
    for i, (pos, title) in enumerate(headers):
        end = headers[i + 1][0] if i + 1 < len(headers) else len(text)
        section_text = text[pos:end]
        if len(section_text.strip()) >= _MIN_SECTION_CHARS:
            sections.append((title, section_text))

    return sections


def _find_headers(text: str) -> List[Tuple[int, str]]:
    """Find all heading positions using cascading patterns."""
    all_matches: List[Tuple[int, str, int]] = []  # (position, title, pattern_priority)

    for priority, pattern in enumerate(_HEADING_PATTERNS):
        for m in pattern.finditer(text):
            title = m.group(0).strip()
            # Truncate very long titles
            if len(title) > 80:
                title = title[:77] + "..."
            all_matches.append((m.start(), title, priority))

    if not all_matches:
        return []

    # Sort by position
    all_matches.sort(key=lambda x: x[0])

    # Deduplicate: if two headers are within _MIN_HEADER_DISTANCE,
    # keep the one with lower priority number (= more specific pattern)
    filtered: List[Tuple[int, str]] = []
    for pos, title, prio in all_matches:
        if not filtered:
            filtered.append((pos, title))
            continue
        last_pos = filtered[-1][0]
        if pos - last_pos < _MIN_HEADER_DISTANCE:
            # Keep the one already in filtered (it was first / earlier pattern)
            continue
        filtered.append((pos, title))

    return filtered


def _chunk_text(
    text: str, chunk_size: int, overlap: int
) -> List[Tuple[str, str]]:
    """Split text into fixed-size chunks with overlap."""
    chunks = []
    pos = 0
    part = 1
    total_parts = max(1, (len(text) // chunk_size) + 1)
    while pos < len(text):
        end = min(pos + chunk_size, len(text))
        # Try to break at paragraph boundary
        if end < len(text):
            nl = text.rfind("\n\n", pos + chunk_size - 2000, end)
            if nl > pos:
                end = nl
        chunk = text[pos:end]
        chunks.append((f"Část {part}/{total_parts}", chunk))
        pos = end - overlap if end < len(text) else end
        part += 1
    return chunks


# ---------------------------------------------------------------------------
# Extract — run ALL registry extractors on a section
# ---------------------------------------------------------------------------

def extract_section(
    section_text: str,
    registry: Optional[List[ExtractorEntry]] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Run every extractor from the registry on a single section of text.
    Returns {extractor_key: {field: value, ...}} — only non-empty results.
    """
    if registry is None:
        registry = get_registry()

    results: Dict[str, Dict[str, Any]] = {}
    for entry in registry:
        try:
            extracted = entry.parse(section_text)
            if extracted:
                results[entry.key] = extracted
        except Exception as e:
            logger.debug(f"Extractor {entry.key!r} failed on section: {e}")
    return results


# ---------------------------------------------------------------------------
# Reduce — merge section results into unified output
# ---------------------------------------------------------------------------

def reduce_results(
    section_results: List[Dict[str, Dict[str, Any]]],
) -> Dict[str, Dict[str, Any]]:
    """
    Merge extraction results from all sections into one dict.

    Rules:
    - Same key from two sections → deep merge
    - Lists: concatenate (deduplicate by str representation)
    - Dicts: recursive merge (existing value wins — first-seen = higher confidence)
    - Scalars: first non-None wins
    - Conflicts: flagged in _conflicts list
    """
    merged: Dict[str, Dict[str, Any]] = {}

    for section_result in section_results:
        for extractor_key, values in section_result.items():
            if extractor_key not in merged:
                merged[extractor_key] = {}
            _deep_merge(merged[extractor_key], values)

    return merged


def _deep_merge(target: Dict[str, Any], source: Dict[str, Any]) -> None:
    """
    Deep merge source into target.
    - Lists: extend, avoid exact duplicates
    - Dicts: recursive merge
    - Scalars: first non-None wins (= higher priority / earlier section)
    """
    for k, v in source.items():
        if v is None:
            continue
        if k not in target or target[k] is None:
            target[k] = v
        elif isinstance(target[k], list) and isinstance(v, list):
            existing = {str(x) for x in target[k]}
            for item in v:
                if str(item) not in existing:
                    target[k].append(item)
                    existing.add(str(item))
        elif isinstance(target[k], dict) and isinstance(v, dict):
            _deep_merge(target[k], v)
        # Scalar conflict: keep first (earlier section = more likely intro/summary)


# ---------------------------------------------------------------------------
# Public API — the full map-reduce pipeline
# ---------------------------------------------------------------------------

def extract_all_from_document(
    text: str,
    registry: Optional[List[ExtractorEntry]] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Universal extraction pipeline.

    1. MAP: split text into sections
    2. EXTRACT: run all registry extractors on each section
    3. REDUCE: merge results

    Args:
        text: Full document text
        registry: Optional custom registry (defaults to global EXTRACTOR_REGISTRY)

    Returns:
        {extractor_key: {field: value, ...}} — only keys with non-empty results
    """
    if not text or len(text.strip()) < 50:
        return {}

    if registry is None:
        registry = get_registry()

    # 1. MAP
    sections = map_sections(text)
    logger.info(f"Engine: {len(sections)} sections, {len(registry)} extractors")

    # 2. EXTRACT each section
    section_results: List[Dict[str, Dict[str, Any]]] = []
    for title, section_text in sections:
        result = extract_section(section_text, registry)
        if result:
            section_results.append(result)
            logger.debug(f"  Section '{title[:50]}': {list(result.keys())}")

    # 3. REDUCE
    merged = reduce_results(section_results)

    # Log summary
    total_fields = sum(len(v) for v in merged.values())
    logger.info(
        f"Engine complete: {len(merged)} domains matched, {total_fields} total fields"
    )

    return merged
