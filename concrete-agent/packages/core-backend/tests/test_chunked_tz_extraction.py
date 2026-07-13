"""Goldens for the chunked TZ → quantified-elements front-half (T2).

Proves the three recon failure-modes are cured at the seam the Kalkulátor consumes:

  A (element identity destroyed at merge) — per-chunk element lists are merged BY
    ELEMENT IDENTITY, never a flat value-deduped fact bag; a deck class
    (`C35/45`) spread across a chunk boundary reassembles into ONE element.
  B (truncation) — the chunker processes ALL chunks (chars_processed ≥ raw len,
    no `text[:30000]`/`pages[:50]` cap); honest-coverage marker emitted.
  C (boundary splits a value) — the hardened value-safe overlap keeps a token like
    `C30/37` whole in at least one chunk; the partial-fragment fold in the merge
    catches the truncated sibling.

End-to-end the produced `elements[]` is the EXACT shape `map_soupis_to_elements`
(the existing join) consumes — so quantification flows through the landed
deterministic join, with honest-blank for an element missing its soupis quantity.

Skip-proof like the other goldens: plain sync test_* functions drive the real
coroutines via asyncio.run — no @pytest.mark.asyncio, no fastmcp import. The
extractor is the REAL extract_tz_fields (deterministic regex layer, LLM off). A
missing dep ERRORS (red), never silently skips.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.chunked_tz_extraction import (
    _identity_key,
    _merge_element,
    extract_tz_elements_chunked,
)
from app.services.document_chunker import _value_safe_overlap, chunk_pdf_text
from app.services.stage_gating.soupis_quantity_join import map_soupis_to_elements


# ── injected hermetic classifier (mirror of the join's test stub) ─────────────
def fake_classify(name, object_code=None, object_type=None):
    n = (name or "").lower()
    if "mostovk" in n or "nosná konstrukce" in n or n.strip() == "nk":
        etype = "mostovkova_deska"
    elif "dřík" in n or "drik" in n or "pilíř" in n or "pilir" in n:
        etype = "driky_piliru"
    elif "říms" in n or "rims" in n:
        etype = "rimsa"
    else:
        etype = "jine"
    if etype == "jine":
        return {"element_type": "jine", "confidence": 0.3, "classification_source": "fallback"}
    return {"element_type": etype, "confidence": 0.85, "classification_source": "keywords"}


def _build_long_tz() -> str:
    """A genuine multi-page (>5), >25k-char TZ. Page-group chunking kicks in; the
    materials section (with the deck class) lands in a late chunk while the object
    name + charakteristika sit in the metadata chunk — so reassembly is real."""
    parts = [
        "A. ZÁKLADNÍ ÚDAJE\nNázev objektu: SO 202 – Most na sil. I/6 přes Lomnický potok",
        "B. CHARAKTERISTIKA MOSTU\nTrvalý dálniční most o třech polích. Spojitá předpjatá deska.",
    ]
    for i in range(1, 60):
        parts.append(f"{i}. Oddíl {i}\n" + "Z" * 700)
    parts.append(
        "D. POUŽITÉ MATERIÁLY\n"
        "Nosná konstrukce — mostovka C35/45 XF2, XC4\n"
        "Dřík pilíře C30/37 XF4, XC4\n"
        "Římsa monolitická C30/37 XF4, XD3\n"
        "Výztuž B500B"
    )
    return "".join(f"--- PAGE {i} ---\n{p}\n" for i, p in enumerate(parts, 1))


# ── 1. multi-chunk: deck class reassembles into ONE element (failure-mode A) ───
def test_chunked_reassembles_elements_and_classes():
    out = asyncio.run(extract_tz_elements_chunked(text=_build_long_tz()))
    meta = out["_extraction_meta"]["chunking"]
    assert meta["chunked"] is True
    assert meta["n_chunks"] >= 2, "must genuinely span multiple chunks"

    by_name = {e["name"]: e for e in out["elements"]}
    # the deck — its full class (grade+exposure) survives the chunk boundaries
    deck = next(e for e in out["elements"] if "mostovka" in e["name"].lower())
    assert deck["concrete_class"] == "C35/45-XF2+XC4"
    # the two distinct C30/37-grade elements stay SEPARATE (not value-deduped)
    c3037 = [e for e in out["elements"] if (e["concrete_class"] or "").startswith("C30/37")]
    assert len(c3037) == 2, "two distinct elements sharing a grade must NOT collapse"
    assert {e["name"] for e in c3037} == {"Dřík pilíře", "Římsa monolitická"}
    # each carries its own distinct exposure suffix
    assert {e["concrete_class"] for e in c3037} == {"C30/37-XF4+XC4", "C30/37-XF4+XD3"}
    # object name survived from the metadata chunk
    assert out["object"]["object_name"] == "Most na sil. I/6 přes Lomnický potok"


# ── 2. no truncation — every chunk processed, honest-coverage marker (mode B) ──
def test_no_truncation_full_coverage():
    text = _build_long_tz()
    out = asyncio.run(extract_tz_elements_chunked(text=text))
    meta = out["_extraction_meta"]["chunking"]
    # chars_processed ≥ raw length (overlap means ≥, never a truncated <)
    assert meta["chars_processed"] >= len(text)
    # all four materials lines surfaced (incl. the last, after 59 filler sections)
    names = {e["name"] for e in out["elements"]}
    assert any("mostovka" in n.lower() for n in names)
    assert "Dřík pilíře" in names
    assert "Římsa monolitická" in names


# ── 3. value-safe overlap keeps a token whole across a boundary (mode C) ───────
def test_value_safe_overlap_never_splits_a_value():
    # a deck class sitting at the very end of a page
    prev_page = "x" * 600 + " Nosná konstrukce mostovka C35/45 XF2"
    overlap = _value_safe_overlap(prev_page, max_chars=20)
    # the overlap starts on a token boundary, so the class is whole (or absent),
    # NEVER a severed "C35/" | "45"
    assert "C35/4" not in overlap or "C35/45" in overlap
    assert not overlap.startswith("5/45")  # would be the mid-token split bug


def test_chunker_recognises_numbered_page_marker():
    # 8 numbered-page sections → multi-page (not collapsed to one), so chunking
    # engages instead of falling back to a single chunk (failure-mode C).
    pages = [f"--- PAGE {i} ---\n{'A'*900}" for i in range(1, 9)]
    chunks = chunk_pdf_text("\n".join(pages), total_pages=8)
    assert len(chunks) >= 2, "numbered page markers must drive page-group chunking"


# ── 4. element-merge prefers the CLEAN name + best-confidence class (mode A/C) ──
def test_merge_folds_partial_class_ghost_into_clean_element():
    # the boundary-cut chunk emitted a dirty name with a partial class + no class
    dirty = {
        "name": "Dřík pilíře C30/", "object_code": "SO-202",
        "concrete_class": None, "needs_verify": True,
        "_source": {"name": {"section": "materialy", "confidence": 1.0},
                    "concrete_class": {"confidence": 0.0}, "chunk_ids": ["chunk_3"]},
    }
    # the sibling chunk (with the value-safe overlap) has the whole value + name
    clean = {
        "name": "Dřík pilíře", "object_code": "SO-202",
        "concrete_class": "C30/37", "needs_verify": False,
        "_source": {"name": {"section": "materialy", "confidence": 1.0},
                    "concrete_class": {"confidence": 1.0}, "chunk_ids": ["chunk_4"]},
    }
    # they hash to the SAME identity (partial-class tail stripped from the key)
    assert _identity_key(dirty) == _identity_key(clean)
    merged = _merge_element(dirty, clean)
    assert merged["name"] == "Dřík pilíře", "clean name must win over the ghost"
    assert merged["concrete_class"] == "C30/37"
    assert set(merged["_source"]["chunk_ids"]) == {"chunk_3", "chunk_4"}


# ── 5. end-to-end: chunked elements → existing join → quantified + honest-blank ─
def test_chunked_elements_feed_existing_join_with_honest_blank():
    out = asyncio.run(extract_tz_elements_chunked(text=_build_long_tz()))
    tz_elements = out["elements"]
    geometry = out["object"].get("geometry")

    # soupis has the deck volume but NOT the dřík nor the římsa → those stay
    # honest-blank (kept, flagged), the deck gets its volume.
    budget = {"items": [
        {"code": "27 33", "description": "Mostovka železobeton C35/45",
         "unit": "m3", "quantity": 605},
    ]}
    quantified = map_soupis_to_elements(
        budget, tz_elements, geometry, classify=fake_classify, object_type="bridge"
    )

    # SAME number of elements out as in — none dropped
    assert len(quantified) == len(tz_elements)
    deck = next(e for e in quantified if "mostovka" in e["name"].lower())
    assert deck["volume_m3"] == 605
    assert deck["quantity_status"] == "extracted"
    assert deck["_source"]["volume_m3"]["source"] == "soupis"

    # the unmatched ones are honest-blank — kept, None, flagged missing
    for e in quantified:
        if "mostovka" not in e["name"].lower():
            assert e["volume_m3"] is None
            assert e["quantity_status"] == "missing"
            assert e["_source"]["volume_m3"]["status"] == "not_extracted_from_soupis"


# ── 6. produced shape matches extract_tz_fields elements[] (the seam contract) ─
def test_produced_shape_matches_extract_tz_fields_contract():
    out = asyncio.run(extract_tz_elements_chunked(text=_build_long_tz()))
    assert set(out.keys()) >= {"object", "elements", "_extraction_meta"}
    for el in out["elements"]:
        # the exact field set extract_tz_fields emits (and the join + Kalkulátor
        # positionContext consume): name, object_code, concrete_class,
        # volume_m3 (None here — stage 2), needs_verify, _source.
        assert set(el.keys()) >= {
            "name", "object_code", "concrete_class", "volume_m3",
            "needs_verify", "_source",
        }
        assert el["volume_m3"] is None  # stage 1 — volumes come from the soupis


# ── 7. short text bypasses chunking (single pass, identical contract) ─────────
def test_short_text_single_pass():
    text = (
        "--- PAGE 1 ---\n"
        "A. ZÁKLADNÍ ÚDAJE\nNázev objektu: SO 202 – Most\n\n"
        "D. POUŽITÉ MATERIÁLY\nNosná konstrukce — mostovka C35/45\n"
    )
    out = asyncio.run(extract_tz_elements_chunked(text=text))
    assert out["_extraction_meta"]["chunking"]["chunked"] is False
    assert any("mostovka" in e["name"].lower() for e in out["elements"])


def test_empty_text_returns_error_not_crash():
    out = asyncio.run(extract_tz_elements_chunked(text="   "))
    assert out["elements"] == [] and "error" in out
