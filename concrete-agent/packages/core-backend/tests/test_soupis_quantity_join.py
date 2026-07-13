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
