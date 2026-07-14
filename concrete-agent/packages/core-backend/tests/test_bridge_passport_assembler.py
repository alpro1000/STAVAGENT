"""
half-B Gate 3: assembler + inverse map + store — hermetic suite.

The assembler composes stage 1 (extract_tz_fields shape) + stage 3 (soupis
join) into a BridgePassport that the HALF-A mapper already consumes; the emit
is schema-validated (invalid emit raises, never returned). Honest-blank all
the way: missing sources land in _meta.gaps, elements without quantities are
still emitted (half-A marks them NEPOČÍTÁNO — AC 3).
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.models.bridge_passport import BridgePassport
from app.models.bridge_passport_element_map import passport_key_for_engine_type
from app.services import bridge_passport_store
from app.services.bridge_passport_assembler import assemble_bridge_passport


# ── injected hermetic classifier (substring → element_type) ───────────────────
def fake_classify(name, object_code=None, object_type=None):
    n = (name or "").lower()
    if "nosn" in n or "mostovk" in n or "nk" == n.strip():
        etype = "mostovkova_deska"
    elif "dřík" in n or "drik" in n or "pilíř" in n or "pilir" in n:
        etype = "driky_piliru"
    elif "křídl" in n or "kridl" in n:
        etype = "kridla_opery"          # deliberately NO passport key
    else:
        return {"element_type": "jine", "confidence": 0.3}
    return {"element_type": etype, "confidence": 0.85, "classification_source": "keywords"}


def _tz_fields():
    return {
        "object": {
            "object_code": "SO-202",
            "object_name": "Most přes Mladotický potok",
            "geometry": {
                "num_spans": 3,
                "span_lengths_m": [32.0, 44.5, 32.0],
                "nk_width_m": 13.65,
            },
        },
        "elements": [
            {"name": "Nosná konstrukce", "object_code": "SO-202",
             "concrete_class": "C35/45", "volume_m3": None, "_source": {}},
            {"name": "Dříky pilířů", "object_code": "SO-202",
             "concrete_class": "C35/45", "volume_m3": None, "_source": {}},
            {"name": "Křídla opěr", "object_code": "SO-202",
             "concrete_class": "C30/37", "volume_m3": None, "_source": {}},
        ],
    }


def _budget():
    return {"items": [
        {"code": "421321109", "description": "Nosná konstrukce železobeton",
         "unit": "m3", "quantity": 2697.941},
        {"code": "421361109", "description": "VÝZTUŽ NOSNÉ KONSTRUKCE B500B",
         "unit": "t", "quantity": 468.886},
    ]}


def test_assembles_schema_valid_passport_with_quantities_and_concretes():
    p = assemble_bridge_passport(_tz_fields(), _budget(), classify=fake_classify)
    BridgePassport.model_validate(p)  # belt & braces — assembler validates too
    assert p["_meta"]["schema"] == "tz-bridge-passport"

    items = {it["element"]: it for it in p["quantities"]["items"]}
    deck = items["superstructure_deck"]
    assert deck["volume_m3"] == pytest.approx(2697.941)
    assert deck["rebar_mass_kg"] == pytest.approx(468886.0)   # t → kg via join
    # Piers: no soupis line → element STILL emitted, no fabricated quantity
    assert "volume_m3" not in items["pier_shafts"]

    uses = {c["use"]: c["class"] for c in p["materials_and_standards"]["concretes"]}
    assert uses["superstructure_deck"] == "C35/45"
    assert uses["pier_shafts"] == "C35/45"

    assert p["geometry"]["spans"] == [32.0, 44.5, 32.0]
    assert p["structural_system"]["spans_count"] == 3
    assert p["superstructure"]["deck"]["width_per_deck_m"] == 13.65


def test_unmapped_element_and_stage2_fields_are_honest_gaps():
    p = assemble_bridge_passport(_tz_fields(), _budget(), classify=fake_classify)
    gaps = " | ".join(p["_meta"]["gaps"])
    assert "kridla_opery" in gaps                      # no passport key — skipped, said aloud
    assert "construction_process" in gaps              # stage 2 vision — Gate 4
    assert "geometry.decks" in gaps                    # drawing-side heights
    # And the skipped element is NOT smuggled into quantities:
    keys = [it["element"] for it in p["quantities"]["items"]]
    assert all(k in {"superstructure_deck", "pier_shafts"} for k in keys)


def test_no_budget_means_elements_emitted_without_quantities():
    p = assemble_bridge_passport(_tz_fields(), None, classify=fake_classify)
    assert any("no soupis" in g for g in p["_meta"]["gaps"])
    assert all("volume_m3" not in it for it in p["quantities"]["items"])


def test_duplicate_elements_collapse_to_one_item_per_key():
    """live SO-202 regress: 3 deck-name spans became 3 superstructure_deck items
    (deck ×3 in the calc). The assembler must emit ONE item per passport key."""
    tz = _tz_fields()
    tz["elements"] = [
        {"name": "Nosná konstrukce", "object_code": "SO-202", "concrete_class": "C35/45"},
        {"name": "mostovka", "object_code": "SO-202", "concrete_class": "C35/45"},
        {"name": "NK", "object_code": "SO-202", "concrete_class": "C35/45"},
    ]
    p = assemble_bridge_passport(tz, None, classify=fake_classify)
    keys = [it["element"] for it in p["quantities"]["items"]]
    assert keys.count("superstructure_deck") == 1
    assert len(keys) == len(set(keys))                 # no duplicate keys at all
    # concretes deduped too
    assert sum(1 for c in p["materials_and_standards"]["concretes"]
               if c["use"] == "superstructure_deck") == 1


def test_split_soupis_quantities_merge_additively_on_one_key():
    """Two soupis lines for the deck (e.g. trámy + příčníky) sum into one item's
    volume — additive merge, not overwrite, not duplicate."""
    tz = _tz_fields()
    tz["elements"] = [
        {"name": "Nosná konstrukce — trámy", "object_code": "SO-202",
         "concrete_class": "C35/45", "volume_m3": 2535.668},
        {"name": "Nosná konstrukce — příčníky", "object_code": "SO-202",
         "concrete_class": "C35/45", "volume_m3": 162.273},
    ]
    p = assemble_bridge_passport(tz, None, classify=fake_classify)
    decks = [it for it in p["quantities"]["items"] if it["element"] == "superstructure_deck"]
    assert len(decks) == 1
    assert decks[0]["volume_m3"] == pytest.approx(2697.941)


def test_deck_heights_from_tz_text_build_geometry_decks():
    """live SO-202 bug #4: «výška nad terénem» is in the TZ text — the assembler
    builds geometry.decks with the MAX height (half-A's falsework height)."""
    tz = _tz_fields()
    tz["object"]["geometry"]["deck_heights_over_terrain_m"] = [8.1, 14.9, 9.9]
    p = assemble_bridge_passport(tz, None, classify=fake_classify)
    assert p["geometry"]["decks"][0]["deck_height_over_terrain_m"] == 14.9
    # the full drawing-side decks gap is downgraded to widths-only
    assert not any("deck_height_over_terrain_m): stage 2" in g for g in p["_meta"]["gaps"])


def test_construction_process_from_tz_text_clears_its_gap():
    """live SO-202 bug #3: «na pevné skruži ve třech etapách» is in the TZ text —
    when stage 1 extracts it, the assembler emits it and clears the trio gap."""
    tz = _tz_fields()
    tz["construction_process"] = {"deck_pour_stages": 3,
                                  "falsework_technology": "fixed_scaffolding"}
    p = assemble_bridge_passport(tz, None, classify=fake_classify)
    assert p["construction_process"]["deck_pour_stages"] == 3
    assert p["construction_process"]["falsework_technology"] == "fixed_scaffolding"
    assert not any(g.startswith("construction_process") for g in p["_meta"]["gaps"])


def test_soupis_provenance_cites_source_in_quantities_and_meta():
    """Quantities must name their source (Pattern 2/29), not just say 'join'."""
    prov = {"ref": "soupis-abc", "filename": "E_Soupis.xlsx", "total_items": 99}
    p = assemble_bridge_passport(_tz_fields(), _budget(), classify=fake_classify,
                                 soupis_provenance=prov)
    assert p["quantities"]["source"] == "soupis join: E_Soupis.xlsx (99 items)"
    assert p["_meta"]["soupis"] == prov


def test_no_soupis_source_stays_none_and_no_meta_soupis():
    p = assemble_bridge_passport(_tz_fields(), None, classify=fake_classify)
    assert p["quantities"]["source"] == "none"
    assert "soupis" not in p["_meta"]


def test_inverse_map_direction():
    assert passport_key_for_engine_type("mostovkova_deska") == "superstructure_deck"
    assert passport_key_for_engine_type("podkladni_beton") == "blinding_concrete"  # first-declared wins
    assert passport_key_for_engine_type("kridla_opery") is None                    # honest gap


def test_store_roundtrip_and_schema_lock(tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "PROJECT_DIR", tmp_path)
    bridge_passport_store._memory.clear()

    p = assemble_bridge_passport(_tz_fields(), _budget(), classify=fake_classify)
    bridge_passport_store.save("SO-202", p)
    # cold-start: wipe memory, rehydrate from disk
    bridge_passport_store._memory.clear()
    loaded = bridge_passport_store.get("SO-202")
    assert loaded == p
    assert bridge_passport_store.list_ids() == ["SO-202"]
    # invalid passport must never be stored
    with pytest.raises(Exception):
        bridge_passport_store.save("bad", {"_meta": {"schema": "wrong", "schema_version": "0.1-draft"}})
    assert bridge_passport_store.get("bad") is None
    # unsafe id never touches the filesystem
    bridge_passport_store.save("../evil", p)
    assert not (tmp_path / "bridge_passports" / ".." ).joinpath("evil.json").exists()


def test_assembler_filters_soupis_to_passport_so_not_whole_stavba():
    """Regression bug `passport-soupis-join-whole-stavba`: a real soupis is the
    WHOLE stavba (many <objekt>). The assembler must thread the passport's SO
    code into the join so an identical deck code in another SO is NOT summed in."""
    tz = _tz_fields()                       # object_code = "SO-202"
    budget = {"items": [
        {"code": "421321109", "description": "Nosná konstrukce železobeton",
         "unit": "m3", "quantity": 2697.941, "object_code": "SO 202"},
        {"code": "421321109", "description": "Nosná konstrukce železobeton",
         "unit": "m3", "quantity": 9999.0, "object_code": "SO 201"},  # other SO — must be excluded
    ]}
    p = assemble_bridge_passport(tz, budget, classify=fake_classify)
    deck = next(it for it in p["quantities"]["items"] if it["element"] == "superstructure_deck")
    assert deck["volume_m3"] == pytest.approx(2697.941)  # SO-201's 9999 never bleeds in
