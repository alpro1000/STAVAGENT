"""Chunked TZ → quantified-elements front-half (T2).

Routes a LONG technical-report (TZ) full-text through the chunker
(`document_chunker.chunk_pdf_text`) and runs the stage-1 extractor
(`extract_tz_fields`) per chunk, then merges the per-chunk results back into ONE
`{object, elements}` shape — keyed BY ELEMENT IDENTITY, never a flat value-deduped
fact bag. That `elements[]` is exactly the shape `map_soupis_to_elements`
(`stage_gating/soupis_quantity_join.py`) consumes, so the caller assembles
quantified elements through the EXISTING deterministic join — NOT through the
broken `norm_ingestion_pipeline._merge_chunk_results` / `_deduplicate_facts`
(recon failure-mode A: those flatten facts into global value-keyed lists with no
element container, so facts from the same structural element never reassemble).

Why a per-chunk pass at all (recon §5):

  - It lets a LONG multi-SO TZ be processed WITHOUT the truncating inline
    extractor (`text[:30000]` / `pages[:50]`) — every chunk reaches the regex
    layer (failure-mode B).
  - Hardened chunk boundaries (value-safe overlap in `document_chunker`) mean a
    value spanning a boundary (e.g. `C30/37`) reassembles into ONE element here
    (failure-mode C → A avoidance).

Merge contract (the failure-mode-A fix, at the ELEMENT grain):

  - Elements from different chunks that share an identity key (normalized name)
    are the SAME element → merged into one row; the higher-confidence
    `concrete_class` wins, `volume_m3` stays None (stage 2), provenance is kept.
  - This is element-keyed grouping, not value-string dedup — two distinct opěry
    both "C30/37" remain two elements.

Deterministic-first: the per-chunk extractor's LLM fallback is OFF here unless an
``llm`` hook is injected. No network, no DB, no KB load.

Reference: docs/tasks/FINDINGS_T2_chunk-extract_2026-06-19.md §5.
"""

from __future__ import annotations

import logging
import re
from typing import Callable, Optional

from app.services.document_chunker import chunk_pdf_text

logger = logging.getLogger(__name__)

# A trailing PARTIAL concrete-class fragment ("C30/", "C 30 /", a bare "C30")
# left on an element name when a hard chunk boundary cut a line mid-class. The
# value-safe overlap keeps the value WHOLE in the neighbouring chunk, but the
# truncated chunk can still emit a name like "Dřík C30/". Stripping the partial
# fragment for the identity key folds that ghost into the clean element so the
# class from the whole-value chunk wins (recon failure-mode C → A avoidance).
_PARTIAL_CLASS_TAIL_RE = re.compile(r"\s+C\s*\d{1,3}\s*/?\s*\d{0,3}\s*$", re.IGNORECASE)

# Above this many chars the document is treated as "long" and chunked. Below it,
# the single-pass extractor already sees the whole text — chunking would only add
# boundary risk for no gain. (The chunker itself also short-circuits ≤5 pages to a
# single "full" chunk, so this threshold mostly governs page-less plain text.)
_CHUNK_THRESHOLD_CHARS = 25000


def _identity_key(element: dict) -> str:
    """Stable per-element identity for cross-chunk merge.

    The element NAME (already stripped of its class tail by extract_tz_fields)
    plus its object_code is the grouping key — NOT the concrete-class value. This
    keeps two distinct elements that happen to share "C30/37" apart, while folding
    the same element seen in two chunks (boundary overlap) into one row."""
    name = (element.get("name") or "").strip()
    name = _PARTIAL_CLASS_TAIL_RE.sub("", name).strip().lower()
    code = (element.get("object_code") or "").strip().lower()
    return f"{code}::{name}"


def _class_confidence(element: dict) -> float:
    src = (element.get("_source") or {}).get("concrete_class") or {}
    try:
        return float(src.get("confidence") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _merge_element(existing: dict, incoming: dict) -> dict:
    """Fold ``incoming`` (same identity) into ``existing``.

    Higher-confidence concrete_class wins; a class found in any chunk beats a
    None; `volume_m3` stays None (stage 2). `_source.chunk_ids` accumulates so the
    provenance trail shows every chunk the element surfaced in."""
    merged = dict(existing)
    merged["_source"] = dict(existing.get("_source") or {})

    # Prefer the CLEAN name: a name still carrying a partial-class tail came from
    # the chunk whose boundary cut the line; the sibling chunk has the whole value
    # AND the clean name. Adopt it (+ its name provenance) so the merged element
    # reads cleanly.
    cur_dirty = bool(_PARTIAL_CLASS_TAIL_RE.search(existing.get("name") or ""))
    inc_dirty = bool(_PARTIAL_CLASS_TAIL_RE.search(incoming.get("name") or ""))
    if cur_dirty and not inc_dirty:
        merged["name"] = incoming.get("name")
        inc_name_src = (incoming.get("_source") or {}).get("name")
        if inc_name_src is not None:
            merged["_source"]["name"] = inc_name_src

    inc_class = incoming.get("concrete_class")
    cur_class = existing.get("concrete_class")
    if inc_class and (not cur_class or _class_confidence(incoming) > _class_confidence(existing)):
        merged["concrete_class"] = inc_class
        merged["_source"]["concrete_class"] = (incoming.get("_source") or {}).get("concrete_class")
        merged["needs_verify"] = incoming.get("concrete_class") is None

    chunk_ids = list(merged["_source"].get("chunk_ids") or [])
    for cid in (incoming.get("_source") or {}).get("chunk_ids") or []:
        if cid and cid not in chunk_ids:
            chunk_ids.append(cid)
    merged["_source"]["chunk_ids"] = chunk_ids
    return merged


def _merge_geometry(base: Optional[dict], incoming: Optional[dict]) -> Optional[dict]:
    """Per-field, confidence-aware geometry merge (first clean value wins, a
    higher-confidence value upgrades). Geometry is element-less, so a plain
    per-field fold is correct — and it lets the NK geometry survive even if it sat
    in a different chunk from the materials list."""
    if not incoming:
        return base
    if not base:
        return dict(incoming)
    out = dict(base)
    out["_source"] = dict(base.get("_source") or {})
    in_src = incoming.get("_source") or {}
    for field, in_val in incoming.items():
        if field in ("_source", "needs_verify"):
            continue
        cur_val = out.get(field)
        if cur_val in (None, [], {}):
            out[field] = in_val
            if field in in_src:
                out["_source"][field] = in_src[field]
        elif field in in_src:
            cur_conf = (out["_source"].get(field) or {}).get("confidence", 0.0)
            in_conf = (in_src.get(field) or {}).get("confidence", 0.0)
            if in_conf > cur_conf:
                out[field] = in_val
                out["_source"][field] = in_src[field]
    return out


def _tag_chunk(extracted: dict, chunk_id: str) -> None:
    """Stamp the chunk id into each element's provenance (in place)."""
    for el in extracted.get("elements") or []:
        src = el.setdefault("_source", {})
        src["chunk_ids"] = [chunk_id]


async def extract_tz_elements_chunked(
    text: str,
    *,
    total_pages: Optional[int] = None,
    doc_type: str = "tz",
    llm: Optional[Callable[[str], list]] = None,
    extract_fn: Optional[Callable] = None,
) -> dict:
    """Long TZ full-text → merged ``{object, elements, _extraction_meta}``.

    Short documents bypass chunking (single pass over the whole text). Long ones
    are split by the hardened chunker and each chunk is run through the stage-1
    extractor; the per-chunk element lists are merged BY ELEMENT IDENTITY so a
    value split across a boundary reassembles into ONE element. The returned shape
    is byte-compatible with `extract_tz_fields` — i.e. the `map_soupis_to_elements`
    input.

    Args:
        text: TZ full-text, page-marked ("--- PAGE n ---") for best chunking.
        total_pages: page count hint (defaults to a marker count, else 1).
        doc_type: chunker doc_type ("tz" | "drawing" | …).
        llm: optional materials-fallback hook forwarded to the extractor (OFF by
            default — deterministic-first).
        extract_fn: injectable stage-1 extractor (defaults to the real
            `extract_tz_fields`); tests pass a stub to stay hermetic.

    Returns the same dict shape as `extract_tz_fields`, plus
    `_extraction_meta.chunking` = {chunked, n_chunks, chunk_strategy,
    pages_processed, chars_processed} (honest-coverage marker; no truncation).
    """
    if extract_fn is None:
        from app.mcp.tools.extract_tz_fields import extract_tz_fields as extract_fn  # noqa: E501
        from app.mcp.tools import extract_tz_fields as _ex_mod

        prev_llm = _ex_mod._LLM
        _ex_mod._LLM = llm
        try:
            return await _run(text, total_pages, doc_type, extract_fn)
        finally:
            _ex_mod._LLM = prev_llm
    return await _run(text, total_pages, doc_type, extract_fn)


async def _run(text, total_pages, doc_type, extract_fn) -> dict:
    if not text or not text.strip():
        return {"error": "Empty document text", "object": {}, "elements": []}

    # Short document → single pass (the extractor already sees everything).
    if len(text) <= _CHUNK_THRESHOLD_CHARS:
        single = await extract_fn(text=text)
        single.setdefault("_extraction_meta", {})["chunking"] = {
            "chunked": False,
            "n_chunks": 1,
            "chunk_strategy": "full",
            "pages_processed": total_pages,
            "chars_processed": len(text),
        }
        return single

    chunks = chunk_pdf_text(
        text,
        total_pages=total_pages or (text.count("--- PAGE") or 1),
        doc_type=doc_type,
    )
    if not chunks:
        return {"error": "Empty document text", "object": {}, "elements": []}

    merged_object: Optional[dict] = None
    merged_geometry: Optional[dict] = None
    merged_elements: dict[str, dict] = {}
    order: list[str] = []
    unbound: list[str] = []
    strategies: set[str] = set()
    chars_processed = 0

    for chunk_info, chunk_text in chunks:
        chars_processed += len(chunk_text)
        strategies.add(chunk_info.strategy)
        extracted = await extract_fn(text=chunk_text)
        if "error" in extracted:
            logger.warning(
                "[ChunkedTZ] chunk %s extraction error: %s",
                chunk_info.chunk_id, extracted.get("error"),
            )
            continue
        _tag_chunk(extracted, chunk_info.chunk_id)

        obj = extracted.get("object") or {}
        if merged_object is None and (obj.get("object_name") or obj.get("object_code")):
            merged_object = {k: v for k, v in obj.items() if k != "geometry"}
        merged_geometry = _merge_geometry(merged_geometry, obj.get("geometry"))

        for el in extracted.get("elements") or []:
            key = _identity_key(el)
            if key in merged_elements:
                merged_elements[key] = _merge_element(merged_elements[key], el)
            else:
                merged_elements[key] = el
                order.append(key)

        for cc in (extracted.get("_extraction_meta") or {}).get("unbound_concrete_classes") or []:
            if cc not in unbound:
                unbound.append(cc)

    if merged_object is None:
        merged_object = {"object_code": None, "object_name": None,
                         "charakteristika": None, "needs_verify": True, "_source": {}}
    merged_object["geometry"] = merged_geometry or {}

    elements = [merged_elements[k] for k in order]
    return {
        "object": merged_object,
        "elements": elements,
        "_extraction_meta": {
            "stage": 1,
            "sections_found": [],
            "unbound_concrete_classes": unbound,
            "elements_needs_verify": [e["name"] for e in elements if e.get("needs_verify")],
            "chunking": {
                "chunked": True,
                "n_chunks": len(chunks),
                "chunk_strategy": sorted(strategies),
                "pages_processed": total_pages or (text.count("--- PAGE") or None),
                "chars_processed": chars_processed,
            },
        },
    }
