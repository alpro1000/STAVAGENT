"""
Golden tests for Fix 3 (T3): price is NOT a ranking signal + data-driven `source`.

Demo case (STATUS / FINDINGS_T3):
    find_otskp_code("beton mostních pilířů C30/37")  (no "předpjatý")
      → 334325 (železobeton) must rank ABOVE 334335 (předpjatý)

Two watch-points asserted here:
  * WP1 — price removed from the *sort order* only. The `unit_price_czk` /
    `cena` VALUES returned to callers stay BYTE-IDENTICAL; price is no longer the
    ranker's final tie-break (now `code` ascending) nor the keyword recall order.
  * WP2 — `source` reflects the row's real `catalog_version` (settings fallback
    when a row carries none), never a hardcoded date literal.

Hermetic: no DB / network / AI. The catalog is a fake.
"""

import pytest

from app.services import catalog_matching as cm


# Real OTSKP rows from the 2025_03_otskp.xml (verbatim names + prices). The
# železobeton row (334325) is the CHEAPER of the pair; an inverted-price variant
# below proves the tie-break is price-blind regardless of which is cheaper.
ZELEZOBETON = {
    "code": "334325",
    "nazev": "MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)",
    "mj": "M3",
    "cena": 12934.89,
}
PREDPJATY = {
    "code": "334335",
    "nazev": "MOSTNÍ PILÍŘE A STATIVA Z PŘEDPJ BET DO C30/37",
    "mj": "M3",
    "cena": 16781.04,
}


class _FakeItem:
    def __init__(self, d):
        self.code = d["code"]
        self.nazev = d["nazev"]
        self.mj = d.get("mj", "m3")
        self.cena = d.get("cena", 0.0)
        # mirror the new OTSKPItem field; a per-row version present on the DB path
        self.catalog_version = d.get("catalog_version")


class FakeCatalog:
    """Mimics OTSKPDatabase.get + token-substring search (no price ORDER BY)."""

    def __init__(self, items):
        self._items = items

    def get(self, code):
        for it in self._items:
            if it["code"] == code:
                return _FakeItem(it)
        return None

    def search(self, keyword, limit=10):
        ku = keyword.upper()
        terms = [w for w in ku.split() if len(w) >= 2]
        out = [_FakeItem(it) for it in self._items
               if ku in it["nazev"].upper() or any(t in it["nazev"].upper() for t in terms)]
        return out[:limit]


def _embed(item, similarity):
    """An embeddings-shaped raw candidate (the demo regression rides on these)."""
    return {
        "code": item["code"],
        "description": item["nazev"],
        "unit": item["mj"],
        "unit_price_czk": item["cena"],
        "source": "embeddings",
        "similarity": similarity,
        "catalog_version": item.get("catalog_version"),
    }


# ── WP1: the decisive ranker tie-break is price-free ─────────────────────────
def test_ranker_tiebreak_is_code_not_price():
    """Equal (confidence, score) → resolve by `code` ascending, NOT cheaper-first."""
    cands = [
        {"code": "334335", "confidence": 0.78, "score": 0.11, "unit_price_czk": 16781.04},
        {"code": "334325", "confidence": 0.78, "score": 0.11, "unit_price_czk": 12934.89},
    ]
    ordered = cm.deterministic_ranker("q", cands)
    assert [c["code"] for c in ordered] == ["334325", "334335"]


def test_ranker_tiebreak_ignores_price_even_when_inverted():
    """Price-blind: 334325 wins by code even when it is the MORE expensive row.

    This is the load-bearing WP1 assertion — under the old `unit_price_czk`
    tie-break the cheaper 334335 would win here; under `code` asc, 334325 wins.
    """
    cands = [
        {"code": "334335", "confidence": 0.78, "score": 0.11, "unit_price_czk": 1.0},
        {"code": "334325", "confidence": 0.78, "score": 0.11, "unit_price_czk": 99999.0},
    ]
    ordered = cm.deterministic_ranker("q", cands)
    assert [c["code"] for c in ordered] == ["334325", "334335"], \
        "tie-break must be code-asc (price-free), independent of which row is cheaper"


# ── Golden: the demo case through match_catalog ──────────────────────────────
def test_golden_zelezobeton_ranks_above_predpjaty():
    """`beton mostních pilířů C30/37` → 334325 (železobeton) above 334335 (předpjatý)."""
    raw = [_embed(ZELEZOBETON, 0.8), _embed(PREDPJATY, 0.8)]
    carrier = cm.match_catalog("beton mostních pilířů C30/37", raw)
    codes = [c["code"] for c in carrier["candidates"]]
    assert "334325" in codes and "334335" in codes
    assert codes.index("334325") < codes.index("334335"), \
        "železobeton (334325) must rank above předpjatý (334335) for a non-předpjatý query"


def test_golden_prices_byte_identical_through_chain():
    """WP1: cena / unit_price_czk values are returned unchanged by the chain."""
    raw = [_embed(ZELEZOBETON, 0.8), _embed(PREDPJATY, 0.8)]
    carrier = cm.match_catalog("beton mostních pilířů C30/37", raw)
    by_price = {c["code"]: c["unit_price_czk"] for c in carrier["candidates"]}
    assert by_price["334325"] == 12934.89
    assert by_price["334335"] == 16781.04


def test_prestress_penalty_flag_set_only_on_plain_query():
    """The předpjatý popis is penalised for a plain `beton` query (sort-key only)."""
    raw = [_embed(ZELEZOBETON, 0.8), _embed(PREDPJATY, 0.8)]
    carrier = cm.match_catalog("beton mostních pilířů C30/37", raw)
    by = {c["code"]: c for c in carrier["candidates"]}
    assert by["334335"]["prestress_mismatch"] is True
    assert by["334325"]["prestress_mismatch"] is False
    # …and the penalty NEVER touches the displayed confidence (sort-key only).
    assert by["334335"]["confidence"] <= 0.80


def test_prestress_query_does_not_penalise_predpjaty():
    """When the user ASKS for předpjatý, the penalty must not fire (no mismatch)."""
    raw = [_embed(ZELEZOBETON, 0.8), _embed(PREDPJATY, 0.8)]
    carrier = cm.match_catalog("předpjatý beton mostních pilířů C30/37", raw)
    by = {c["code"]: c for c in carrier["candidates"]}
    # 334335 (předpjatý) survives the predpinaci work-type basket; not penalised.
    assert "334335" in by
    assert by["334335"]["prestress_mismatch"] is False


# ── End-to-end through find_otskp_code (fake catalog) ────────────────────────
@pytest.mark.asyncio
async def test_golden_end_to_end_keyword_demo(monkeypatch):
    """Through the MCP boundary: 334325 above 334335, prices intact, source data-driven."""
    from app.mcp.tools import otskp
    monkeypatch.setattr(otskp, "_catalog", FakeCatalog([ZELEZOBETON, PREDPJATY]))

    data = await otskp.find_otskp_code(query="beton mostních pilířů C30/37", max_results=5)
    codes = [r["code"] for r in data["results"]]
    assert "334325" in codes and "334335" in codes
    assert codes.index("334325") < codes.index("334335")

    by = {r["code"]: r for r in data["results"]}
    # Prices byte-identical (WP1)
    assert by["334325"]["unit_price_czk"] == 12934.89
    assert by["334335"]["unit_price_czk"] == 16781.04
    # source is data-driven, never the stale hardcoded literal (WP2)
    for r in data["results"]:
        assert r["source"] != "OTSKP 1/2025"
        assert r["source"], "source must carry a real version (row or settings fallback)"


@pytest.mark.asyncio
async def test_exact_lookup_source_is_real_catalog_version(monkeypatch):
    """Exact-code 334325: `source` = row's real catalog_version, price unchanged."""
    from app.mcp.tools import otskp
    row = {**ZELEZOBETON, "catalog_version": "OTSKP 2026"}
    monkeypatch.setattr(otskp, "_catalog", FakeCatalog([row, PREDPJATY]))

    data = await otskp.find_otskp_code(query="x", code="334325")
    assert data["total_found"] == 1
    r = data["results"][0]
    assert r["confidence"] == 1.0, "exact code lookup remains 1.0 (verified DB row)"
    assert r["source"] == "OTSKP 2026", "no longer the static 'OTSKP 1/2025'"
    assert r["unit_price_czk"] == 12934.89, "price byte-identical"


@pytest.mark.asyncio
async def test_exact_lookup_legacy_row_falls_back_to_settings(monkeypatch):
    """WP2: a row WITHOUT catalog_version → settings.OTSKP_CATALOG_VERSION, no crash."""
    from app.mcp.tools import otskp
    from app.core.config import settings
    monkeypatch.setattr(otskp, "_catalog", FakeCatalog([ZELEZOBETON]))  # no catalog_version

    data = await otskp.find_otskp_code(query="x", code="334325")
    assert data["total_found"] == 1
    assert data["results"][0]["source"] == settings.OTSKP_CATALOG_VERSION
