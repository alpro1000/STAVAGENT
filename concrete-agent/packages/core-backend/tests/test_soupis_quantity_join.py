"""Hermetic unit tests for the soupis → element quantity join (P1).

Fully offline: no KB, no network, no DB. The classifier is a tiny injected stub
(substring → element_type), so these tests assert the JOIN logic, not the live
classifier. A missing dep would ERROR (red), never silently skip.

Covers the design's join contract (docs/specs/doc_to_quantified_elements):
  - beton+m3 line → element.volume_m3 (+ provenance + confidence)
  - M soupis lines → 1 element (grouping / summation)
  - honest-blank for unmatched elements (kept, None, status='missing')
  - same-type ambiguity → status='ambiguous' + candidates, never a silent split
  - non-beton lines (m2/t) + unmatched m3 (výkop) never become volume
  - geometry divergence is a flag only; soupis volume is never overwritten
  - inputs are not mutated
"""

from app.services.stage_gating.soupis_quantity_join import map_soupis_to_elements


# ── injected hermetic classifier (substring → element_type) ───────────────────
def fake_classify(name, object_code=None, object_type=None):
    n = (name or "").lower()
    if "mostovk" in n or n.strip() in {"nk", "nosná konstrukce"}:
        etype = "mostovkova_deska"
    elif "pilot" in n:
        etype = "pilota"
    elif "oper" in n or "opěr" in n:
        etype = "operne_zdi"
    elif "rims" in n or "říms" in n:
        etype = "rimsa"
    elif "výkop" in n or "vykop" in n or "zásyp" in n or "zasyp" in n:
        etype = "jine"
    else:
        etype = "jine"
    if etype == "jine":
        return {"element_type": "jine", "confidence": 0.3, "classification_source": "fallback"}
    return {"element_type": etype, "confidence": 0.85, "classification_source": "keywords"}


def _src_stub():
    return {"name": {"section": "materialy", "confidence": 1.0},
            "volume_m3": {"status": "stage_2", "confidence": 0.0}}


def _budget(items):
    return {"items": items, "total_items": len(items)}


# ── 1. single beton+m3 line → element.volume_m3 + provenance ──────────────────
def test_single_beton_line_fills_volume_with_provenance():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka železobeton C35/45",
         "unit": "m3", "quantity": 605},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    el = out[0]
    assert el["volume_m3"] == 605
    assert el["quantity_status"] == "extracted"
    prov = el["_source"]["volume_m3"]
    assert prov["source"] == "soupis"
    assert prov["matched_by"] == "element_type:mostovkova_deska"
    assert 0 < prov["confidence"] <= 0.9
    assert "605" in prov["evidence"] and "27 33" in prov["evidence"]


# ── 2. M soupis lines of one element_type → 1 element, summed ──────────────────
def test_multiple_lines_same_type_are_summed():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka C35/45", "unit": "m3", "quantity": 600},
        {"code": "27 34", "description": "Mostovka — dobetonávka", "unit": "m3", "quantity": 5},
    ])
    elements = [{"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert out[0]["volume_m3"] == 605
    assert out[0]["_source"]["volume_m3"]["n_lines"] == 2


# ── 3. honest-blank: unmatched element kept, None, status='missing' ───────────
def test_unmatched_element_is_honest_blank():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka C35/45", "unit": "m3", "quantity": 605},
    ])
    elements = [
        {"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()},
        {"name": "Římsa monolitická", "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    rimsa = next(e for e in out if e["name"].startswith("Římsa"))
    assert rimsa["volume_m3"] is None
    assert rimsa["quantity_status"] == "missing"
    assert rimsa["_source"]["volume_m3"]["status"] == "not_extracted_from_soupis"
    # element is KEPT, never dropped
    assert len(out) == 2


# ── 4. same-type ambiguity → 'ambiguous' + candidates, never a silent split ───
def test_two_elements_same_type_are_ambiguous_not_split():
    budget = _budget([
        {"code": "32 11", "description": "Opěrná zeď železobeton", "unit": "m3", "quantity": 200},
    ])
    elements = [
        {"name": "Opěra OP1", "volume_m3": None, "_source": _src_stub()},
        {"name": "Opěra OP2", "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    for el in out:
        assert el["volume_m3"] is None, "must NOT silently split a shared volume"
        assert el["quantity_status"] == "ambiguous"
        assert el["candidates"] and el["candidates"][0]["quantity"] == 200
        assert el["_source"]["volume_m3"]["status"] == "ambiguous_multiple_elements_same_type"


# ── 5. non-beton lines (m2/t) + unmatched m3 (výkop) never become volume ──────
def test_non_beton_and_unmatched_m3_excluded():
    budget = _budget([
        {"code": "a", "description": "Bednění mostovky", "unit": "m2", "quantity": 547},
        {"code": "b", "description": "Výztuž B500B", "unit": "t", "quantity": 5.6},
        {"code": "c", "description": "Výkop jámy", "unit": "m3", "quantity": 120},
    ])
    elements = [{"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    # bednění (m2) + výztuž (t) skipped by unit; výkop (m3) skipped as 'jine'
    assert out[0]["volume_m3"] is None
    assert out[0]["quantity_status"] == "missing"


# ── 6. divergence is a flag only — soupis volume never overwritten ────────────
def test_geometry_divergence_flags_but_keeps_soupis_volume():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka C35/45", "unit": "m3", "quantity": 605},
    ])
    elements = [{"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()}]
    # nk_width 70 m → expected ≈ 120×70×0.5 = 4200 m³, ratio 605/4200 ≈ 0.14 < 0.3 → critical
    geometry = {"num_spans": 6, "total_span_length_m": 120, "nk_width_m": 70,
                "cross_section_type": "deskovy"}
    out = map_soupis_to_elements(budget, elements, geometry=geometry, classify=fake_classify)
    el = out[0]
    assert el["volume_m3"] == 605, "soupis stays authoritative — never overwritten"
    div = el["quantity_divergence"]
    assert div is not None and div["severity"] == "critical"
    assert div["soupis_m3"] == 605
    assert div["geometry_expected_m3"] == 4200.0


def test_geometry_consistent_sets_no_divergence():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka C35/45", "unit": "m3", "quantity": 605},
    ])
    elements = [{"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()}]
    # expected = 120×12×0.5 = 720, ratio 605/720 ≈ 0.84 ∈ [0.7,1.5] → consistent
    geometry = {"num_spans": 6, "total_span_length_m": 120, "nk_width_m": 12,
                "cross_section_type": "deskovy"}
    out = map_soupis_to_elements(budget, elements, geometry=geometry, classify=fake_classify)
    assert out[0]["quantity_divergence"] is None


# ── 7. inputs are not mutated ─────────────────────────────────────────────────
def test_inputs_are_not_mutated():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka C35/45", "unit": "m3", "quantity": 605},
    ])
    elements = [{"name": "NK mostovka", "volume_m3": None, "_source": _src_stub()}]
    map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert elements[0]["volume_m3"] is None
    assert "quantity_status" not in elements[0]
    assert elements[0]["_source"]["volume_m3"] == {"status": "stage_2", "confidence": 0.0}


# ── 8. empty / missing inputs degrade gracefully ──────────────────────────────
def test_empty_inputs_return_empty():
    assert map_soupis_to_elements(None, None, classify=fake_classify) == []
    assert map_soupis_to_elements({"items": []}, [], classify=fake_classify) == []


# ── half-B Gate 3 増: masses (rebar/prestress) + rimsa length ─────────────────
def test_rebar_tonnage_line_fills_rebar_mass_kg():
    budget = _budget([
        {"code": "27 33", "description": "Mostovka železobeton C35/45",
         "unit": "m3", "quantity": 605},
        {"code": "421 36", "description": "VÝZTUŽ MOSTOVKY Z OCELI B500B",
         "unit": "t", "quantity": 468.886},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    el = out[0]
    assert el["volume_m3"] == 605                      # volume path untouched
    assert el["rebar_mass_kg"] == 468886.0             # t → kg
    prov = el["_source"]["rebar_mass_kg"]
    assert prov["source"] == "soupis"
    assert "B500B" in prov["evidence"]
    assert prov["confidence"] <= 0.9                   # keyword-tier cap


def test_prestress_line_never_double_counts_into_rebar():
    """«VÝZTUŽ PŘEDPÍNACÍ» matches both stems — prestress must win."""
    budget = _budget([
        {"code": "421 37", "description": "VÝZTUŽ MOSTOVKY PŘEDPÍNACÍ Y1860 KABELY",
         "unit": "t", "quantity": 41.42},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    el = out[0]
    assert el["prestress_strand_mass_kg"] == 41420.0
    assert "rebar_mass_kg" not in el


def test_plain_tonnage_line_without_keywords_is_skipped():
    budget = _budget([
        {"code": "x", "description": "Mostovka ocelové zábradlí",
         "unit": "t", "quantity": 3.2},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert "rebar_mass_kg" not in out[0]
    assert "prestress_strand_mass_kg" not in out[0]


def test_masses_not_assigned_on_same_type_ambiguity():
    budget = _budget([
        {"code": "421 36", "description": "VÝZTUŽ MOSTOVKY B500B",
         "unit": "t", "quantity": 100},
    ])
    elements = [
        {"name": "NK mostovka levá", "object_code": "SO-202",
         "volume_m3": None, "_source": _src_stub()},
        {"name": "NK mostovka pravá", "object_code": "SO-202",
         "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert all("rebar_mass_kg" not in el for el in out)  # never a silent split


def test_bm_line_fills_length_only_for_rimsa():
    budget = _budget([
        {"code": "465 12", "description": "ŘÍMSA MONOLITICKÁ C30/37",
         "unit": "bm", "quantity": 213},
        {"code": "x", "description": "Mostovka odvodnění žlab",
         "unit": "bm", "quantity": 213},
    ])
    elements = [
        {"name": "Římsy", "object_code": "SO-202",
         "volume_m3": None, "_source": _src_stub()},
        {"name": "NK mostovka", "object_code": "SO-202",
         "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    rimsa = next(e for e in out if e["name"] == "Římsy")
    deck = next(e for e in out if e["name"] == "NK mostovka")
    assert rimsa["length_bm"] == 213
    assert "length_bm" not in deck  # bm lines only meaningful for římsy


# ── SO filter: whole-stavba soupis must be restricted to the passport's object ─
# Regression for bug `passport-soupis-join-whole-stavba` (live: deck ×3.2, piers
# ×20 because the join summed the same code across all 125 SO sections).
def _multi_so_budget():
    return _budget([
        {"code": "422336", "description": "Nosná konstrukce mostovka železobeton",
         "unit": "m3", "quantity": 2697.941, "object_code": "SO 202"},
        {"code": "422336", "description": "Nosná konstrukce mostovka železobeton",
         "unit": "m3", "quantity": 3321.904, "object_code": "SO 201"},
    ])


def test_so_filter_restricts_join_to_target_object():
    elements = [{"name": "NK mostovka", "object_code": "SO 202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(_multi_so_budget(), elements,
                                 classify=fake_classify, so_code="SO 202")
    # ONLY SO 202's line — never summed with SO 201's identical code.
    assert out[0]["volume_m3"] == 2697.941


def test_so_filter_normalizes_spacing_and_dashes():
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    # passport says "SO-202", soupis tags "SO 202" — must compare equal.
    out = map_soupis_to_elements(_multi_so_budget(), elements,
                                 classify=fake_classify, so_code="SO-202")
    assert out[0]["volume_m3"] == 2697.941


def test_no_so_code_keeps_legacy_whole_list_behaviour():
    elements = [{"name": "NK mostovka", "object_code": "SO 202",
                 "volume_m3": None, "_source": _src_stub()}]
    # No so_code passed (single-SO callers) → both lines summed, as before.
    out = map_soupis_to_elements(_multi_so_budget(), elements, classify=fake_classify)
    assert out[0]["volume_m3"] == round(2697.941 + 3321.904, 6)


def test_so_filter_is_noop_when_soupis_has_no_object_tags():
    # An untagged soupis (format without <objekt>) must NOT be filtered to empty —
    # degrade to whole-list rather than drop every line to a false NEPOČÍTÁNO.
    budget = _budget([
        {"code": "422336", "description": "Nosná konstrukce mostovka",
         "unit": "m3", "quantity": 605.0},  # no object_code
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO 202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify,
                                 so_code="SO 202")
    assert out[0]["volume_m3"] == 605.0


# ── catalog_name (OTSKP <nazev>) is the classification signal, not popis ──────
# Regression bug `passport-soupis-join-whole-stavba` increment 2: live XC4 lines
# 334326/333325 carry <popis>="vč. nátěru ALP+2x ALN…" (a project sub-note with
# NO element noun) while the real OTSKP name lives in <nazev>. Classifying on the
# note drops or misfiles them; classifying on catalog_name recovers them.
def test_classification_prefers_catalog_name_over_note_description():
    budget = _budget([
        {"code": "333325", "unit": "m3", "quantity": 557.851,
         "description": "vč. nátěru ALP+2x ALN všech součástí v kontaktu se zeminou",
         "catalog_name": "MOSTNÍ OPĚRY ZE ŽELEZOBETONU"},  # <nazev> → opěry
    ])
    elements = [{"name": "Opěry", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    # note-only description would classify 'jine' (dropped); catalog_name saves it
    assert out[0]["volume_m3"] == 557.851
    assert out[0]["quantity_status"] == "extracted"


def test_classification_falls_back_to_description_without_catalog_name():
    # Formats that don't split name/note (xlsx) have no catalog_name → description.
    budget = _budget([
        {"code": "333325", "unit": "m3", "quantity": 557.851,
         "description": "Mostní opěry ze železobetonu"},  # no catalog_name
    ])
    elements = [{"name": "Opěry", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert out[0]["volume_m3"] == 557.851


# ── increment 3 (live SO-202, 20 % of concrete lost): A collapse / B prostý / C orphans ─
def test_collapse_same_type_assigns_bucket_once_to_carrier():
    """A: TZ prose names Opěry + Úložné prahy + Křídla — all one passport key
    downstream. Never-split ambiguity lost abutments 557.851 live; with
    collapse_same_type the carrier gets the bucket ONCE, siblings carry None."""
    budget = _budget([
        {"code": "333325", "unit": "m3", "quantity": 557.851,
         "description": "opěry", "catalog_name": "Mostní opěry ze železobetonu"},
    ])
    elements = [
        {"name": "Opěry", "object_code": "SO-202", "volume_m3": None, "_source": _src_stub()},
        {"name": "Opěry — úložné prahy", "object_code": "SO-202", "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify,
                                 collapse_same_type=True)
    assert out[0]["volume_m3"] == 557.851 and out[0]["quantity_status"] == "extracted"
    assert out[1]["volume_m3"] is None
    assert out[1]["quantity_status"] == "collapsed_into_sibling"
    # sum across the family is the bucket EXACTLY once (no multiplication)
    assert sum(e["volume_m3"] or 0 for e in out) == 557.851


def test_without_collapse_same_type_ambiguity_rule_unchanged():
    budget = _budget([
        {"code": "333325", "unit": "m3", "quantity": 557.851,
         "description": "opěry", "catalog_name": "Mostní opěry ze železobetonu"},
    ])
    elements = [
        {"name": "Opěry", "object_code": "SO-202", "volume_m3": None, "_source": _src_stub()},
        {"name": "Opěry — úložné prahy", "object_code": "SO-202", "volume_m3": None, "_source": _src_stub()},
    ]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert all(e["quantity_status"] == "ambiguous" for e in out)


def test_prosty_beton_never_merges_into_zb_bucket():
    """B: «PATKY Z PROSTÉHO BETONU» name-classifies as a ŽB foundation — but
    prostý ≠ železobeton (live: 12.733 m³ poisoned foundations 867.136)."""
    def classify_patky(name, object_code=None, object_type=None):
        n = (name or "").lower()
        if "základy" in n or "zaklady" in n or "patky" in n:
            return {"element_type": "zaklady_piliru", "confidence": 0.9,
                    "classification_source": "keywords"}
        return {"element_type": "jine", "confidence": 0.3}
    budget = _budget([
        {"code": "272325", "unit": "m3", "quantity": 867.136,
         "description": "zb", "catalog_name": "ZÁKLADY ZE ŽELEZOVÉHO BETONU"},
        {"code": "461314", "unit": "m3", "quantity": 12.733,
         "description": "pb", "catalog_name": "PATKY Z PROSTÉHO BETONU"},
    ])
    elements = [{"name": "Základy", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=classify_patky,
                                 emit_soupis_only=True)
    assert out[0]["volume_m3"] == 867.136          # ŽB only — 12.733 NOT mixed in
    # the prostý line landed in its own podkladni_beton soupis-only element
    orphans = [e for e in out if e.get("_soupis_only")]
    assert len(orphans) == 1 and orphans[0]["volume_m3"] == 12.733


def test_soupis_only_buckets_become_elements_not_silently_dropped():
    """C: TZ prose rarely narrates přechodové desky / podkladní beton — their
    soupis buckets must become quantity-carrying elements (live: ~1043 m³ lost)."""
    def classify_pd(name, object_code=None, object_type=None):
        n = (name or "").lower()
        if "přechodov" in n or "prechodov" in n:
            return {"element_type": "prechodova_deska", "confidence": 0.9,
                    "classification_source": "keywords"}
        if "mostovk" in n:
            return {"element_type": "mostovkova_deska", "confidence": 0.9,
                    "classification_source": "keywords"}
        return {"element_type": "jine", "confidence": 0.3}
    budget = _budget([
        {"code": "421", "unit": "m3", "quantity": 2697.941,
         "description": "nk", "catalog_name": "Mostovka železobeton"},
        {"code": "420324", "unit": "m3", "quantity": 81.9,
         "description": "pd", "catalog_name": "PŘECHODOVÉ DESKY Z PŘEDPJATÉHO BETONU"},
    ])
    elements = [{"name": "Mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=classify_pd,
                                 emit_soupis_only=True)
    assert out[0]["volume_m3"] == 2697.941
    orphan = next(e for e in out if e.get("_soupis_only"))
    assert orphan["volume_m3"] == 81.9
    assert "no TZ element" in orphan["_source"]["volume_m3"]["matched_by"]
    # default (no flag) keeps the old TZ-driven behaviour
    out_default = map_soupis_to_elements(budget, elements, classify=classify_pd)
    assert not any(e.get("_soupis_only") for e in out_default)


# ── material guard (live regress caught by Alexander: gravel in blinding) ─────
def _classify_podkladni(name, object_code=None, object_type=None):
    n = (name or "").lower()
    if "podkladn" in n or "dlažb" in n or "dlazb" in n:
        return {"element_type": "podkladni_beton", "confidence": 0.9,
                "classification_source": "keywords"}
    return {"element_type": "jine", "confidence": 0.3}


def test_kamenivo_and_dlazby_never_enter_concrete_buckets():
    """45152 «…Z KAMENIVA DRCENÉHO» (crushed stone, 144.69 m³) entered
    blinding_concrete via the shared «PODKLADNÍ A VÝPLŇOVÉ VRSTVY» prefix;
    465512 «DLAŽBY Z LOMOVÉHO KAMENE NA MC» is the same trap class. A concrete
    element computed from gravel fabricates betonáž/curing/formwork from nothing."""
    budget = _budget([
        {"code": "451312", "unit": "m3", "quantity": 120.481, "description": "pb",
         "catalog_name": "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15"},
        {"code": "45152", "unit": "m3", "quantity": 144.690, "description": "kam",
         "catalog_name": "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA DRCENÉHO"},
        {"code": "465512", "unit": "m3", "quantity": 188.815, "description": "dl",
         "catalog_name": "DLAŽBY Z LOMOVÉHO KAMENE NA MC"},
    ])
    elements = [{"name": "Podkladní beton", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=_classify_podkladni)
    # ONLY the concrete line — gravel + stone paving never summed in
    assert out[0]["volume_m3"] == 120.481
    ev = out[0]["_source"]["volume_m3"]["evidence"]
    assert "45152" not in ev and "465512" not in ev


def test_soupis_only_bucket_without_concrete_signal_is_not_emitted():
    """The orphan path (no TZ corroboration) requires an explicit concrete signal
    — otherwise any accidentally-typed material becomes a fabricated element."""
    budget = _budget([
        {"code": "45152", "unit": "m3", "quantity": 144.690, "description": "kam",
         # hypothetical name WITHOUT a non-concrete token but also without any
         # concrete signal — the negative guard alone would let it through
         "catalog_name": "PODKLADNÍ A VÝPLŇOVÉ VRSTVY"},
    ])
    out = map_soupis_to_elements(budget, [], classify=_classify_podkladni,
                                 emit_soupis_only=True)
    assert out == []  # not emitted — no TZ element AND no concrete evidence


def test_soupis_only_bucket_with_concrete_signal_is_emitted():
    budget = _budget([
        {"code": "451312", "unit": "m3", "quantity": 120.481, "description": "pb",
         "catalog_name": "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15"},
    ])
    out = map_soupis_to_elements(budget, [], classify=_classify_podkladni,
                                 emit_soupis_only=True)
    assert len(out) == 1 and out[0]["volume_m3"] == 120.481


def test_tz_joined_short_name_without_beton_word_still_joins():
    """The negative guard must NOT become a strict positive requirement on the
    TZ-joined path — a legit short line («Nosná konstrukce mostovka», no beton
    word, no material word) still joins; only explicit non-concrete materials
    are barred."""
    budget = _budget([
        {"code": "421", "unit": "m3", "quantity": 605.0,
         "description": "Nosná konstrukce mostovka"},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert out[0]["volume_m3"] == 605.0


# ── positive concrete-signal guard on catalog_name (Alexander's data refutation:
#    all 8 real SO-202 concrete positions name their material in <nazev>) ───────
def test_gabiony_with_oper_noun_never_enter_abutments():
    """3272A7 «ZDI OPĚR, ZÁRUBNÍCH… Z GABIONŮ» (283.47 m³, stone-in-mesh)
    contains «OPĚR» — one classifier change away from abutments. The positive
    guard bars it structurally, not by classifier luck: an OTSKP nazev with NO
    concrete signal is not a concrete volume."""
    def classify_as_opery(name, object_code=None, object_type=None):
        # simulate the feared classifier change: gabion wall types as opěry
        return {"element_type": "operne_zdi", "confidence": 0.9,
                "classification_source": "keywords"}
    budget = _budget([
        {"code": "3272A7", "unit": "m3", "quantity": 283.47, "description": "gab",
         "catalog_name": "ZDI OPĚR, ZÁRUBNÍCH A OPĚRNÝCH Z GABIONŮ"},
    ])
    elements = [{"name": "Opěrné zdi", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=classify_as_opery,
                                 emit_soupis_only=True)
    assert out[0]["volume_m3"] is None                # nothing joined
    assert not any(e.get("_soupis_only") for e in out)  # nothing fabricated


def test_poplatky_za_skladku_m3_never_become_an_element():
    """014101 «POPLATKY ZA SKLÁDKU» is 4 639 m³ of LANDFILL FEES — an m³ unit is
    not proof of concrete. No concrete signal in the nazev → never element-bound."""
    def classify_greedy(name, object_code=None, object_type=None):
        return {"element_type": "podkladni_beton", "confidence": 0.9,
                "classification_source": "keywords"}
    budget = _budget([
        {"code": "014101", "unit": "m3", "quantity": 4639.56, "description": "popl",
         "catalog_name": "POPLATKY ZA SKLÁDKU"},
    ])
    out = map_soupis_to_elements(budget, [], classify=classify_greedy,
                                 emit_soupis_only=True)
    assert out == []


def test_rebar_tonne_line_exempt_from_positive_guard():
    """Mass lines are STEEL, not concrete-volume claims — «VÝZTUŽ NOSNÉ
    KONSTRUKCE B500B» carries no beton word and must still join the rebar mass."""
    budget = _budget([
        {"code": "421321109", "unit": "m3", "quantity": 605.0, "description": "nk",
         "catalog_name": "Mostovka železobeton C35/45"},
        {"code": "421361109", "unit": "t", "quantity": 46.8, "description": "vyztuz",
         "catalog_name": "Výztuž mostovka B500B"},  # STEEL grade, no beton word
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert out[0]["volume_m3"] == 605.0
    assert out[0]["rebar_mass_kg"] == 46800.0  # t→kg, NOT dropped by the guard


def test_mass_line_with_empty_popis_joins_via_catalog_name():
    """Real XC4 mass lines («VÝZTUŽ MOSTNÍ TRÁMOVÉ KONSTRUKCE… B500B») carry an
    EMPTY <popis> — the old `if not desc: continue` silently dropped every
    rebar/prestress tonne line of the real soupis (caught on the real file)."""
    budget = _budget([
        {"code": "421321109", "unit": "m3", "quantity": 605.0, "description": "nk",
         "catalog_name": "Mostovka železobeton C35/45"},
        {"code": "422365", "unit": "t", "quantity": 468.886,
         "description": "",  # ← empty popis, like the real file
         "catalog_name": "Výztuž mostovka z oceli 10505, B500B"},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=fake_classify)
    assert out[0]["volume_m3"] == 605.0
    assert out[0]["rebar_mass_kg"] == 468886.0
    # evidence falls back to the nazev when popis is empty
    assert "Výztuž mostovka" in out[0]["_source"]["rebar_mass_kg"]["evidence"]


def test_negative_guard_applies_to_tonne_axis_too():
    """Alexander's t-axis watch-point: the positive guard exempts mass lines
    (steel grades carry no beton word) — so the NEGATIVE guard must hold there.
    «GEOTEXTILIE VÝZTUŽNÁ» in tonnes passes the rebar kind-gate («vyztuz» is a
    substring match) — the material guard must kill it before it becomes rebar."""
    def classify_greedy(name, object_code=None, object_type=None):
        return {"element_type": "mostovkova_deska", "confidence": 0.9,
                "classification_source": "keywords"}
    budget = _budget([
        {"code": "421", "unit": "m3", "quantity": 605.0, "description": "nk",
         "catalog_name": "Mostovka železobeton C35/45"},
        {"code": "X1", "unit": "t", "quantity": 8.9, "description": "",
         "catalog_name": "GEOTEXTILIE VÝZTUŽNÁ 500 G/M2"},
        {"code": "015760", "unit": "t", "quantity": 8.867, "description": "",
         "catalog_name": "POPLATKY ZA LIKVIDACI ODPADŮ Z IZOLACÍ"},
    ])
    elements = [{"name": "NK mostovka", "object_code": "SO-202",
                 "volume_m3": None, "_source": _src_stub()}]
    out = map_soupis_to_elements(budget, elements, classify=classify_greedy)
    assert out[0]["volume_m3"] == 605.0
    assert "rebar_mass_kg" not in out[0]   # neither fake-rebar line joined
