"""
half-B Gate 4 (ADR-008 §3): the notes branch of validate_drawing_element.

The construction_process trio lives as an IMAGE on the drawing (SO-202
výkres 202/17 POZN. 3: «NK BETONOVÁNA V 3 TAKTECH NA PEVNÉ SKRUŽI») — the
host's vision reads it, THIS gate re-parses the verbatim text and rejects
any claim the text does not carry. Same sync-over-coroutine discipline as
the other golden suites (no fastmcp import).
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.walk_drawings import validate_drawing_element

_NOTE = "NOSNÁ KONSTRUKCE BETONOVÁNA V 3 TAKTECH NA PEVNÉ SKRUŽI"
_SRC = "výkres 202/17 POZN. 3"


def _call(**kw):
    return asyncio.run(validate_drawing_element(
        element_type="nk", reasoning="note read from drawing", **kw,
    ))


def test_verified_trio_with_tz_corroboration_yields_passport_fragment():
    out = _call(source=_SRC, note_text=_NOTE, pour_stages=3,
                falsework_technology="fixed_scaffolding",
                tz_text="Betonáž nosné konstrukce proběhne ve třech taktech na pevné skruži.")
    assert out["verdict"] == "VERIFIED"
    assert out["confidence"] == 0.95
    cp = out["construction_process"]
    assert cp == {
        "deck_pour_stages": 3,
        "deck_pour_stages_source": _SRC,
        "falsework_technology": "fixed_scaffolding",
    }


def test_verified_from_note_alone_is_090():
    out = _call(source=_SRC, note_text=_NOTE, pour_stages=3,
                falsework_technology="fixed_scaffolding")
    assert out["verdict"] == "VERIFIED"
    assert out["confidence"] == 0.90


def test_stage_count_the_note_does_not_carry_is_not_verified():
    out = _call(source=_SRC, note_text=_NOTE, pour_stages=4,
                falsework_technology="fixed_scaffolding")
    assert out["verdict"] == "VISION_ONLY_OVERIT"      # falsework ok, stages not
    assert out["overit"] is True
    assert "construction_process" not in out            # nothing to paste
    assert any("4" in p for p in out["problems"])


def test_falsework_contradiction_is_hard_reject():
    """Note says pevná skruž; host claims MSS → poison, 0.0."""
    out = _call(source=_SRC, note_text=_NOTE, pour_stages=3,
                falsework_technology="mss")
    assert out["verdict"] == "REJECTED_MISMATCH"
    assert out["confidence"] == 0.0


def test_posuvna_skruz_parses_as_mss_not_fixed():
    """Ordering trap: «posuvná skruž» contains the bare skruž stem too."""
    out = _call(source=_SRC, note_text="BETONÁŽ NA POSUVNÉ SKRUŽI VE 2 TAKTECH",
                pour_stages=2, falsework_technology="mss")
    assert out["verdict"] == "VERIFIED"


def test_czech_numeral_words_ground_the_count():
    out = _call(source=_SRC, note_text="Betonováno ve třech etapách na skruži",
                pour_stages=3, falsework_technology="fixed_scaffolding")
    assert out["verdict"] == "VERIFIED"


def test_empty_note_and_missing_source_are_rejected():
    assert _call(source=_SRC, note_text="  ")["verdict"] == "REJECTED_UNGROUNDED"
    out = _call(source="", note_text=_NOTE, pour_stages=3)
    assert out["verdict"] == "REJECTED_UNGROUNDED"      # P40: no source, no pass


def test_element_mode_unchanged_by_the_new_params():
    """Regression pin: the classic element path ignores the notes params."""
    out = _call(source="řez A-A", area_m2=100.0,
                dxf_rooms=[{"cislo": "101", "nazev": "sklad", "area_m2": 100.0}])
    assert out["verdict"] == "VISION_ONLY_OVERIT"       # area matches but no label link...
