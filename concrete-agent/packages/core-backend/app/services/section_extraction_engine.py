"""
Section Extraction Engine — Universal map-reduce for construction documents.

The engine does NOT know what type of document it processes.
It simply:
  1. MAP  — splits document into sections (universal heuristics)
  2. For each section — runs ALL extractors from the registry
  3. (optional) AI — calls Gemini per section with extraction schemas as hints
  4. REDUCE — merges results (regex conf=1.0 wins over AI conf=0.7)

Adding a new document type = adding entries to extractor_registry.py.
This file NEVER changes when a new domain is added.

Author: STAVAGENT Team
Version: 2.0.0
Date: 2026-03-31
"""

import re
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple

from app.services.extractor_registry import get_registry, ExtractorEntry

logger = logging.getLogger(__name__)

# AI confidence vs regex confidence
AI_CONFIDENCE = 0.7
REGEX_CONFIDENCE = 1.0

# Max tokens per section for AI call (chars ≈ tokens * 4)
_MAX_SECTION_CHARS_FOR_AI = 24000  # ~6000 tokens


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
# AI extraction — per-section Gemini call with registry schemas as hints
# ---------------------------------------------------------------------------

def _build_extraction_schemas(registry: List[ExtractorEntry]) -> str:
    """Build a compact JSON schema description from all registry entries for the AI prompt."""
    schemas = {}
    for entry in registry:
        # Try to extract field names from the extractor's patterns or function
        field_names = _infer_fields_from_extractor(entry)
        if field_names:
            schemas[entry.key] = {
                "label": entry.label_cs,
                "fields": field_names,
            }
    return json.dumps(schemas, ensure_ascii=False, indent=None)


def _infer_fields_from_extractor(entry: ExtractorEntry) -> List[str]:
    """Infer field names from extractor by calling it with empty string or inspecting patterns."""
    # Check if the parse function has a related _PATTERNS dict
    func = entry.parse
    func_name = getattr(func, "__name__", "")

    # Try to find the pattern dict in the module globals
    import app.services.extractor_registry as reg_module
    for attr_name in dir(reg_module):
        if attr_name.startswith("_") and attr_name.endswith("_PATTERNS"):
            domain = attr_name[1:].rsplit("_PATTERNS", 1)[0].lower()
            if domain in entry.key.lower() or entry.key.lower() in domain:
                patterns_dict = getattr(reg_module, attr_name, None)
                if isinstance(patterns_dict, dict):
                    return list(patterns_dict.keys())

    # For imported extractors, try known field lists
    _KNOWN_FIELDS: Dict[str, List[str]] = {
        "base_construction": ["concrete_class", "exposure_class", "steel_grade", "dimensions", "rebar_diameter", "cover_mm"],
        "norms": ["csn_standards", "tolerances", "deadlines", "materials"],
        "road_params": ["road_class", "road_width_m", "surface_type", "speed_limit_kmh"],
        "traffic_params": ["dio_type", "detour_length_m", "traffic_signs"],
        "water_params": ["pipe_material", "pipe_dn", "flow_rate"],
        "vegetation_params": ["tree_species", "planting_area_m2", "soil_type"],
        "electro_params": ["voltage_kv", "cable_type", "cable_length_m"],
        "pipeline_params": ["pipe_material", "pipe_dn", "pressure_bar", "medium"],
        "silnoproud_params": ["napeti_v", "jistic_a", "kabel_typ", "rozvodna", "osvetleni"],
        "slaboproud_params": ["scs_kategorie", "pzts_typ", "eps_ustredna", "cctv_kamery", "avt_typ"],
        "vzt_params": ["vzt_typ", "prutok_m3h", "ventilator", "rekuperace", "filtrace"],
        "zti_params": ["vodovod_material", "kanalizace_material", "zarizeni", "ohrev_tv"],
        "ut_params": ["zdroj_tepla", "otopna_telesa", "potrubi_material", "vykon_kw"],
        "zel_svrsek_params": ["kolejnice_typ", "prazce_typ", "sterkove_loze", "vyhybky"],
        "zel_spodek_params": ["zemni_prace", "odvodneni", "geotextilie", "stabilizace"],
        "igp_params": ["sondy_pocet", "hloubka_m", "hladina_podzemni_vody", "typ_zeminy"],
    }
    return _KNOWN_FIELDS.get(entry.key, [])


_AI_SYSTEM_PROMPT = """Jsi expert na stavební dokumentaci. Analyzuj text sekce technické zprávy a extrahuj strukturovaná data.

VÝSTUP: Vrať POUZE platný JSON objekt. Žádný jiný text.

Formát výstupu:
{
  "domain_key": {
    "field_name": "extrahovaná hodnota",
    ...
  },
  ...
}

Pravidla:
1. Extrahuj POUZE hodnoty, které jsou explicitně uvedeny v textu
2. Neodhaduj ani nevymýšlej hodnoty
3. Pokud doména nemá žádné relevantní údaje, vynech ji
4. Čísla vrať jako čísla (ne stringy), jednotky ponech v hodnotě
5. Seznamy vrať jako pole
"""


async def extract_section_with_ai(
    section_text: str,
    section_title: str,
    registry: List[ExtractorEntry],
) -> Dict[str, Dict[str, Any]]:
    """
    Call Gemini Flash to extract structured data from a section.

    Args:
        section_text: Text of one document section
        section_title: Title/heading of the section
        registry: Extractor registry (used to build schema hints)

    Returns:
        {domain_key: {field: value}} — AI-extracted data
    """
    # Skip very short or very long sections
    if len(section_text.strip()) < 100:
        return {}
    text_for_ai = section_text[:_MAX_SECTION_CHARS_FOR_AI]

    schemas_json = _build_extraction_schemas(registry)

    prompt = f"""Sekce: "{section_title}"

Dostupné extrakční schémata (domain_key → fields):
{schemas_json}

Text sekce:
---
{text_for_ai}
---

Extrahuj strukturovaná data ze sekce podle schémat výše. Vrať JSON."""

    try:
        # Lazy import to avoid circular deps and startup cost
        from app.core.gemini_client import VertexGeminiClient

        # Use class-level cached client if available
        if not hasattr(extract_section_with_ai, "_gemini_client"):
            try:
                extract_section_with_ai._gemini_client = VertexGeminiClient()
            except Exception as e:
                logger.warning(f"AI extraction unavailable (Gemini init failed): {e}")
                extract_section_with_ai._gemini_client = None
                return {}

        client = extract_section_with_ai._gemini_client
        if client is None:
            return {}

        result = client.call(
            prompt=prompt,
            system_prompt=_AI_SYSTEM_PROMPT,
            temperature=0.1,
        )

        if isinstance(result, dict):
            # Filter: keep only keys that match registry entries
            registry_keys = {e.key for e in registry}
            filtered = {}
            for k, v in result.items():
                if k in registry_keys and isinstance(v, dict) and v:
                    filtered[k] = v
            return filtered

        return {}

    except Exception as e:
        logger.warning(f"AI extraction failed for section '{section_title[:50]}': {e}")
        return {}


def _merge_ai_into_regex(
    regex_results: Dict[str, Dict[str, Any]],
    ai_results: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """
    Merge AI results into regex results. Regex wins on conflicts (conf=1.0 > 0.7).

    - If regex already has a field, keep it (deterministic > probabilistic)
    - If AI has a field regex doesn't, add it with _source marker
    """
    merged = {}
    # Start with all regex results
    for key, fields in regex_results.items():
        merged[key] = dict(fields)

    # Add AI results where regex didn't find anything
    for key, ai_fields in ai_results.items():
        if key not in merged:
            # Entire domain is new from AI
            merged[key] = dict(ai_fields)
            merged[key]["_source"] = "ai"
            merged[key]["_confidence"] = AI_CONFIDENCE
        else:
            # Domain exists from regex — add only missing fields
            for field, value in ai_fields.items():
                if field.startswith("_"):
                    continue
                if field not in merged[key] or merged[key][field] is None:
                    merged[key][field] = value

    return merged


# ---------------------------------------------------------------------------
# Public API — the full map-reduce pipeline
# ---------------------------------------------------------------------------

def extract_all_from_document(
    text: str,
    registry: Optional[List[ExtractorEntry]] = None,
    enable_ai: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """
    Universal extraction pipeline (sync wrapper).

    1. MAP: split text into sections
    2. EXTRACT: run all registry extractors on each section
    3. (optional) AI: call Gemini per section with schemas as hints
    4. REDUCE: merge results (regex conf=1.0 > AI conf=0.7)

    Args:
        text: Full document text
        registry: Optional custom registry (defaults to global EXTRACTOR_REGISTRY)
        enable_ai: If True, run AI extraction per section (adds latency)

    Returns:
        {extractor_key: {field: value, ...}} — only keys with non-empty results
    """
    if not text or len(text.strip()) < 50:
        return {}

    if registry is None:
        registry = get_registry()

    # 1. MAP
    sections = map_sections(text)
    logger.info(f"Engine: {len(sections)} sections, {len(registry)} extractors, ai={enable_ai}")

    # 2. EXTRACT each section (regex — deterministic)
    section_results: List[Dict[str, Dict[str, Any]]] = []
    for title, section_text in sections:
        result = extract_section(section_text, registry)
        if result:
            section_results.append(result)
            logger.debug(f"  Section '{title[:50]}': {list(result.keys())}")

    # 3. REDUCE regex results
    merged = reduce_results(section_results)

    # 4. AI ENRICHMENT (optional)
    if enable_ai:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Inside async context (FastAPI) — run in a thread with a fresh loop
                import concurrent.futures
                def _run_in_new_loop():
                    new_loop = asyncio.new_event_loop()
                    try:
                        return new_loop.run_until_complete(
                            _run_ai_extraction(sections, registry)
                        )
                    finally:
                        new_loop.close()

                with concurrent.futures.ThreadPoolExecutor() as pool:
                    ai_merged = pool.submit(_run_in_new_loop).result(timeout=120)
            else:
                ai_merged = loop.run_until_complete(
                    _run_ai_extraction(sections, registry)
                )
        except Exception:
            try:
                ai_merged = asyncio.run(
                    _run_ai_extraction(sections, registry)
                )
            except Exception as e:
                logger.warning(f"AI extraction failed: {e}")
                ai_merged = {}

        if ai_merged:
            merged = _merge_ai_into_regex(merged, ai_merged)
            ai_fields = sum(len(v) for v in ai_merged.values())
            logger.info(f"AI enrichment: {len(ai_merged)} domains, {ai_fields} fields added/merged")

    # Log summary
    total_fields = sum(len(v) for v in merged.values())
    logger.info(
        f"Engine complete: {len(merged)} domains matched, {total_fields} total fields"
    )

    return merged


async def extract_all_from_document_async(
    text: str,
    registry: Optional[List[ExtractorEntry]] = None,
    enable_ai: bool = False,
) -> Dict[str, Dict[str, Any]]:
    """
    Async version of extract_all_from_document.
    Preferred when called from FastAPI async endpoints.
    """
    if not text or len(text.strip()) < 50:
        return {}

    if registry is None:
        registry = get_registry()

    # 1. MAP
    sections = map_sections(text)
    logger.info(f"Engine (async): {len(sections)} sections, {len(registry)} extractors, ai={enable_ai}")

    # 2. EXTRACT each section (regex)
    section_results: List[Dict[str, Dict[str, Any]]] = []
    for title, section_text in sections:
        result = extract_section(section_text, registry)
        if result:
            section_results.append(result)

    # 3. REDUCE regex results
    merged = reduce_results(section_results)

    # 4. AI ENRICHMENT
    if enable_ai:
        ai_merged = await _run_ai_extraction(sections, registry)
        if ai_merged:
            merged = _merge_ai_into_regex(merged, ai_merged)
            ai_fields = sum(len(v) for v in ai_merged.values())
            logger.info(f"AI enrichment: {len(ai_merged)} domains, {ai_fields} fields added/merged")

    total_fields = sum(len(v) for v in merged.values())
    logger.info(f"Engine complete: {len(merged)} domains matched, {total_fields} total fields")
    return merged


async def _run_ai_extraction(
    sections: List[Tuple[str, str]],
    registry: List[ExtractorEntry],
) -> Dict[str, Dict[str, Any]]:
    """Run AI extraction on all sections and reduce results."""
    import time
    t0 = time.time()

    ai_section_results: List[Dict[str, Dict[str, Any]]] = []
    for title, section_text in sections:
        ai_result = await extract_section_with_ai(section_text, title, registry)
        if ai_result:
            ai_section_results.append(ai_result)
            logger.debug(f"  AI section '{title[:50]}': {list(ai_result.keys())}")

    ai_merged = reduce_results(ai_section_results)
    elapsed = int((time.time() - t0) * 1000)
    logger.info(f"AI extraction complete: {elapsed}ms, {len(ai_merged)} domains")
    return ai_merged
