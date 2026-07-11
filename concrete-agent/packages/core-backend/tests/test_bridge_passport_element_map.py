"""
half-B Gate 2 (ADR-008 §2): the passport element-key map is a SINGLE SOURCE
(passport_element_map.yaml). The TS side is locked by gen:knowledge:check;
this suite locks the Python read + the golden-fixture coverage, so a key
added to the fixture without a map entry (or vice versa) fails loudly.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.models.bridge_passport_element_map import (
    engine_type_for,
    load_passport_element_map,
)

_FIXTURE = (
    Path(__file__).resolve().parents[3]
    / ".." / "docs" / "specs" / "tz-passport-json" / "example_SO202_zalmanov.json"
).resolve()


def test_map_loads_with_ratified_content():
    m = load_passport_element_map()
    assert len(m) == 9
    assert m["superstructure_deck"] == {"engine_type": "mostovkova_deska", "per_deck": True}
    assert m["foundations_piers"]["concrete_use"] == "foundations"
    # Whole-SO scope entries stay unsplit
    assert m["blinding_concrete"]["per_deck"] is False
    assert m["plain_footings"]["engine_type"] == "podkladni_beton"


def test_every_golden_fixture_quantity_key_resolves():
    """Drift-guard: half-A maps every quantities key of the golden fixture —
    the Python map must resolve the same set (one source, two runtimes)."""
    passport = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    keys = [it["element"] for it in passport["quantities"]["items"]]
    assert keys, "golden fixture lost its quantities"
    unresolved = [k for k in keys if engine_type_for(k) is None]
    assert unresolved == [], f"fixture keys without a map entry: {unresolved}"


def test_unknown_key_is_honest_none():
    assert engine_type_for("space_elevator") is None
