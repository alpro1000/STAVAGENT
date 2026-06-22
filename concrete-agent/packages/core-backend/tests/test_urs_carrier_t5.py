"""
Golden tests: find_urs_code carrier shape (T5).

Asserts the response envelope is unified with find_otskp_code (adds
`retrieve_summary`) without breaking the per-result contract T1 landed
(catalog / catalog_version / match_kind). Hermetic — both search branches
are monkeypatched, no network.

Runs WITHOUT fastmcp / pytest-asyncio (drives the real coroutine through
asyncio.run as a plain sync test) so a missing dep is a red collection error,
never a silent skip.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app.mcp.tools.urs as urs_mod  # noqa: E402
from app.mcp.tools.urs import find_urs_code  # noqa: E402


def _patch(pplx, matcher):
    """Swap the two search branches; returns a restore() callable."""
    op, om = urs_mod._perplexity_urs_search, urs_mod._urs_matcher_search
    urs_mod._perplexity_urs_search = pplx
    urs_mod._urs_matcher_search = matcher

    def restore():
        urs_mod._perplexity_urs_search = op
        urs_mod._urs_matcher_search = om
    return restore


def test_carrier_shape_with_retrieve_summary():
    async def fake_pplx(description, context=None):
        return [{"code": "784411", "description": "x", "confidence": 0.80,
                 "source": "perplexity_urs_search", "unit": None,
                 "unit_price_czk": None, "catalog": "urs",
                 "catalog_version": None, "match_kind": "item"}]

    async def fake_matcher(description):
        return [{"code": "784412", "description": "y", "confidence": 0.85,
                 "source": "urs_matcher_service", "unit": "m2",
                 "unit_price_czk": None, "catalog": "urs",
                 "catalog_version": None, "match_kind": "item"},
                {"code": "784413", "description": "z", "confidence": 0.82,
                 "source": "urs_matcher_service", "unit": "m2",
                 "unit_price_czk": None, "catalog": "urs",
                 "catalog_version": None, "match_kind": "item"}]

    restore = _patch(fake_pplx, fake_matcher)
    try:
        r = asyncio.run(find_urs_code("Malba stěn vnitřní 2×", "byt"))
    finally:
        restore()

    # Envelope parity (the carrier keys T5 unifies with find_otskp_code).
    for k in ("results", "total_found", "query", "catalog", "retrieve_summary"):
        assert k in r, f"missing carrier key: {k}"
    assert r["catalog"] == "urs"
    assert r["query"] == "Malba stěn vnitřní 2×"
    assert r["total_found"] == 3
    assert r["retrieve_summary"] == {
        "perplexity": 1, "matcher": 2, "merged": 3, "kept": 3,
    }
    # T1 per-result contract preserved (NOT broken by the carrier change).
    for it in r["results"]:
        assert it["catalog"] == "urs"
        assert it["catalog_version"] is None  # honest null, never a constant
        assert it["match_kind"] in ("item", "group", "raw_context", "none")


def test_error_envelope_carries_shape():
    async def boom_pplx(description, context=None):
        raise RuntimeError("perplexity down")

    async def boom_matcher(description):
        raise RuntimeError("matcher down")

    restore = _patch(boom_pplx, boom_matcher)
    try:
        r = asyncio.run(find_urs_code("cokoliv"))
    finally:
        restore()

    # Error path keeps the same carrier keys (shape stability for consumers).
    assert r["error"]
    assert r["results"] == []
    assert r["total_found"] == 0
    assert r["catalog"] == "urs"
    assert r["retrieve_summary"] == {
        "perplexity": 0, "matcher": 0, "merged": 0, "kept": 0,
    }


if __name__ == "__main__":  # offline self-run (no pytest needed)
    fns = [v for k, v in sorted(globals().items())
           if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
