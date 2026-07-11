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
