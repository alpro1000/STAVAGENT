"""
Hermetic tests for the Work-First / Catalog-Last matching chain.

No network / DB / AI — the catalog is a fake, the embeddings provider is an
injected stub. Covers acceptance §6 items 1,2,3,4,6,7 at the chain level plus
an end-to-end pass through find_otskp_code with a fake catalog.
"""

import pytest

from app.services import catalog_matching as cm


# ── Fakes ────────────────────────────────────────────────────────────────────
class _FakeItem:
    def __init__(self, d):
        self.code = d["code"]
        self.nazev = d["nazev"]
        self.mj = d.get("mj", "m3")
        self.cena = d.get("cena", 0.0)


class FakeCatalog:
    """Mimics OTSKPDatabase.get + token-substring search."""

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
        out = []
        for it in self._items:
            name = it["nazev"].upper()
            if ku in name or any(t in name for t in terms):
                out.append(_FakeItem(it))
        return out[:limit]


PILIR_BETON = {"code": "334411", "nazev": "Beton pilířů C35/45 železobeton", "mj": "M3", "cena": 3200.0}
PILIR_OBKLAD = {"code": "334222", "nazev": "Obklad pilířů z lomového kamene", "mj": "M2", "cena": 1800.0}
PRECHOD = {"code": "451318", "nazev": "Přechod desky opěr beton C25/30", "mj": "M3", "cena": 2900.0}
PILIR_BETON_LOWCLASS = {"code": "334410", "nazev": "Beton pilířů C25/30", "mj": "M3", "cena": 2600.0}

CATALOG_ITEMS = [PILIR_BETON, PILIR_OBKLAD, PRECHOD, PILIR_BETON_LOWCLASS]


def _raw(*items):
    return [{"code": i["code"], "description": i["nazev"], "unit": i["mj"],
             "unit_price_czk": i["cena"], "source": "keyword"} for i in items]


# ── work-type axis ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("text,expected", [
    ("Beton pilířů C35/45", "beton"),
    ("Betonářská ocel B500B", "vyztuz"),
    ("Obklad pilířů z lomového kamene", "obklad"),
    ("Bednění mostních pilířů", "bedneni"),
    ("Předpínací výztuž Y1860", "predpinaci"),
    ("Hydroizolace mostovky natavená", "izolace"),
    ("Něco úplně jiného", "ostatni"),
])
def test_work_type_axis(text, expected):
    assert cm.classify_work_type(text) == expected


# ── AC#2 UWO gate ────────────────────────────────────────────────────────────
def test_uwo_gate_filters_wrong_basket():
    carrier = cm.match_catalog("beton mostních pilířů C35/45", _raw(PILIR_BETON, PILIR_OBKLAD, PRECHOD))
    codes = [c["code"] for c in carrier["candidates"]]
    assert PILIR_BETON["code"] in codes
    assert PILIR_OBKLAD["code"] not in codes, "obklad (cladding) must be gated out"
    assert PRECHOD["code"] not in codes, "přechod desky opěr must be gated out"
    assert carrier["query_work_type"] == "beton"


# ── AC#3 param prefilter ─────────────────────────────────────────────────────
def test_param_prefilter_drops_wrong_concrete_class():
    carrier = cm.match_catalog("beton mostních pilířů C35/45", _raw(PILIR_BETON, PILIR_BETON_LOWCLASS))
    codes = [c["code"] for c in carrier["candidates"]]
    assert PILIR_BETON["code"] in codes
    assert PILIR_BETON_LOWCLASS["code"] not in codes, "C25/30 must be dropped for a C35/45 query"


def test_param_prefilter_keeps_silent_candidate():
    silent = {"code": "334499", "nazev": "Beton pilířů železobeton", "mj": "M3", "cena": 3000.0}
    assert cm.param_prefilter({"concrete_class": "C35/45"}, cm.extract_params(silent["nazev"])) is True


# ── AC#1 honest confidence ───────────────────────────────────────────────────
def test_no_hardcoded_one_point_zero_on_keyword_hit():
    carrier = cm.match_catalog("beton mostních pilířů C35/45", _raw(PILIR_BETON))
    assert carrier["candidates"], "expected the real pier-concrete code to survive"
    for c in carrier["candidates"]:
        assert c["confidence"] <= 0.9, "keyword candidate must never reach 1.0"
        assert c["confidence"] > 0.5


def test_wrong_work_keyword_hit_is_not_high_confidence():
    # 'obklad pilířů' shares the 'pilíř' token with a beton query but is a
    # different work — it must be gated out entirely (never surfaced at 1.0).
    carrier = cm.match_catalog("beton pilířů", _raw(PILIR_OBKLAD))
    assert carrier["candidates"] == []


# ── AC#4 recall via embeddings seam ──────────────────────────────────────────
def test_embeddings_seam_repairs_recall():
    # keyword search misses the correct code; the embeddings provider surfaces it.
    def keyword_only_misses(_q):
        return []

    def fake_provider(query, limit):
        return [{"code": PILIR_BETON["code"], "description": PILIR_BETON["nazev"],
                 "unit": "M3", "unit_price_czk": 3200.0, "source": "embeddings", "similarity": 0.9}]

    raw = cm.retrieve_candidates("beton pilířů C35/45", keyword_only_misses, embeddings_provider=fake_provider)
    assert PILIR_BETON["code"] in [c["code"] for c in raw], "embeddings must repair recall"
    carrier = cm.match_catalog("beton pilířů C35/45", raw)
    assert PILIR_BETON["code"] in [c["code"] for c in carrier["candidates"]]


def test_module_level_provider_used_when_not_passed(monkeypatch):
    def provider(query, limit):
        return [{"code": "999999", "description": "Beton pilířů C35/45", "unit": "M3",
                 "unit_price_czk": 1.0, "source": "embeddings", "similarity": 0.5}]

    monkeypatch.setattr(cm, "_EMBEDDINGS_PROVIDER", provider)
    raw = cm.retrieve_candidates("beton pilířů C35/45", lambda q: [])
    assert "999999" in [c["code"] for c in raw]


# ── AC#6 Vertex bounds ───────────────────────────────────────────────────────
def test_embeddings_candidate_stays_in_ai_band():
    raw = [{"code": PILIR_BETON["code"], "description": PILIR_BETON["nazev"], "unit": "M3",
            "unit_price_czk": 3200.0, "source": "embeddings", "similarity": 1.0}]
    carrier = cm.match_catalog("beton pilířů C35/45", raw)
    c = carrier["candidates"][0]
    assert 0.70 <= c["confidence"] <= 0.80, "embeddings candidate must carry the AI band"
    assert c["confidence"] != 1.0


# ── AC#4 live bug: embeddings skip the family axis, keyword does not ──────────
def test_embeddings_skip_family_axis_keyword_does_not():
    # Query resolves to a SPECIFIC family (driki_piliru). A beton candidate the
    # classifier buckets into ANOTHER specific family is gated out as KEYWORD but
    # MUST survive as EMBEDDINGS — otherwise recall is dead for specific-family
    # queries (the live "beton mostních pilířů C35/45" → 0 embeddings symptom).
    q = "beton mostních pilířů C35/45"
    base = {"code": "990001", "description": "Beton mostní konstrukce",
            "unit": "M3", "unit_price_czk": 3000.0,
            "work_type": "beton", "element_family": "opery_ulozne_prahy"}

    kw = cm.match_catalog(q, [{**base, "source": "keyword"}])
    assert "990001" not in [c["code"] for c in kw["candidates"]], "keyword keeps family axis"

    emb = cm.match_catalog(q, [{**base, "source": "embeddings", "similarity": 0.83}])
    survivors = [c for c in emb["candidates"] if c["code"] == "990001"]
    assert survivors, "embeddings candidate must survive the family axis"
    assert survivors[0]["source"] == "embeddings"
    assert 0.70 <= survivors[0]["confidence"] <= 0.80


def test_embeddings_still_respects_work_type_axis():
    # The coarse work-type axis still applies to embeddings: a beton query must
    # not admit an obklad (cladding) candidate, however high its similarity.
    q = "beton mostních pilířů C35/45"
    cand = {"code": "990002", "description": "Obklad kamenný", "unit": "M2",
            "unit_price_czk": 1000.0, "work_type": "obklad", "element_family": "jine",
            "source": "embeddings", "similarity": 0.95}
    carrier = cm.match_catalog(q, [cand])
    assert "990002" not in [c["code"] for c in carrier["candidates"]], \
        "embeddings still gated by work-type (beton query vs obklad candidate)"


# ── AC#7 reranker seam ───────────────────────────────────────────────────────
def test_ranking_is_pluggable_audited_and_replayable():
    raw = _raw(PILIR_BETON, PILIR_BETON_LOWCLASS)
    # default deterministic ranker
    carrier = cm.match_catalog("beton pilířů", raw)
    audit = carrier["ranking_audit"]
    assert audit["ranker"] == "deterministic_ranker"
    assert set(audit["input_codes"]) == set(audit["output_codes"]), "ranking only reorders"
    # replay: the recorded order is authoritative without re-running
    assert [c["code"] for c in carrier["candidates"]] == audit["output_codes"]


def test_custom_ranker_plugs_in_without_changing_confidence():
    cands = [
        {"code": "A", "confidence": 0.8, "score": 0.5, "unit_price_czk": 10},
        {"code": "B", "confidence": 0.7, "score": 0.9, "unit_price_czk": 5},
    ]
    reverse = lambda q, cs: sorted(cs, key=lambda c: c["code"], reverse=True)
    ordered, audit = cm.rank("q", cands, ranker=reverse)
    assert [c["code"] for c in ordered] == ["B", "A"]
    assert audit["ranker"] == "<lambda>"
    assert ordered[0]["confidence"] == 0.7, "ranking must not mutate confidence"


# ── End-to-end through find_otskp_code (fake catalog) ────────────────────────
@pytest.mark.asyncio
async def test_find_otskp_code_honest_confidence(monkeypatch):
    from app.mcp.tools import otskp
    monkeypatch.setattr(otskp, "_catalog", FakeCatalog(CATALOG_ITEMS))

    data = await otskp.find_otskp_code(query="beton mostních pilířů C35/45", max_results=5)
    codes = [r["code"] for r in data["results"]]
    assert PILIR_BETON["code"] in codes
    assert PILIR_OBKLAD["code"] not in codes
    assert PRECHOD["code"] not in codes
    for r in data["results"]:
        assert r["confidence"] <= 0.9, "search results must not be hardcoded 1.0"


@pytest.mark.asyncio
async def test_find_otskp_code_exact_lookup_stays_one(monkeypatch):
    from app.mcp.tools import otskp
    monkeypatch.setattr(otskp, "_catalog", FakeCatalog(CATALOG_ITEMS))

    data = await otskp.find_otskp_code(query="x", code=PILIR_BETON["code"])
    assert data["total_found"] == 1
    assert data["results"][0]["confidence"] == 1.0, "exact code lookup remains 1.0 (verified DB row)"
