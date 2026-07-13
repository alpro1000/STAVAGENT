"""half-B live-run extraction fixes — CONTENT assertions (not just structure).

The golden (keys ⊆ example) passed while extraction silently dropped exposure
classes; these tests assert WHAT is extracted. No network, no fastmcp.
"""

import asyncio

from app.mcp.tools.extract_tz_fields import (
    _concrete_classes,
    _deck_heights_over_terrain,
    _extract_construction_process,
    extract_tz_fields,
)


# ── exposure capture (bug #2): the full grade+exposure string, not grade-only ──
def test_full_exposure_chain_is_captured():
    assert _concrete_classes("Nosná konstrukce C35/45-XF2+XD1+XC4") == ["C35/45-XF2+XD1+XC4"]
    assert _concrete_classes("Opěry, úložné prahy C30/37-XF4+XD3+XC4") == ["C30/37-XF4+XD3+XC4"]
    assert _concrete_classes("Základy C30/37-XF1+XA2+XC2") == ["C30/37-XF1+XA2+XC2"]


def test_grade_only_when_no_adjacent_exposure():
    assert _concrete_classes("Podkladní beton C12/15") == ["C12/15"]
    assert _concrete_classes("Výplňový beton C16/20") == ["C16/20"]


def test_spacing_and_separator_tolerant():
    assert _concrete_classes("deska C35/45 - XF2 + XD1 + XC4") == ["C35/45-XF2+XD1+XC4"]
    assert _concrete_classes("dřík C35/45 XF1") == ["C35/45-XF1"]   # single token, space sep


def test_exposure_does_not_reach_across_words():
    # a class token separated from the grade by prose must NOT attach (conservative)
    assert _concrete_classes("beton C30/37, prostředí dle XF4") == ["C30/37"]


def test_two_concretes_on_one_line_keep_their_own_suffixes():
    out = _concrete_classes("NK C35/45-XF2 a dříky C35/45-XF1+XD1+XC4")
    assert out == ["C35/45-XF2", "C35/45-XF1+XD1+XC4"]


# ── construction_process from TZ text (bug #3): stages + falsework, not a gap ──
def test_pour_stages_and_fixed_scaffolding_from_text():
    cp = _extract_construction_process(
        "Nosná konstrukce bude vybetonována na pevné skruži ve třech etapách.")
    assert cp["deck_pour_stages"] == 3
    assert cp["falsework_technology"] == "fixed_scaffolding"
    assert cp["deck_pour_stages_source"].startswith("TZ text:")


def test_mss_and_digit_stage_count():
    cp = _extract_construction_process("Betonáž probíhá na posuvné skruži ve 2 taktech.")
    assert cp["deck_pour_stages"] == 2
    assert cp["falsework_technology"] == "mss"          # posuvná ⇒ MSS, not fixed


def test_cantilever_phrasing():
    assert _extract_construction_process(
        "NK bude budována letmou betonáží.")["falsework_technology"] == "cantilever"


def test_construction_process_absent_when_not_stated():
    assert _extract_construction_process("Běžný most bez zmínky o postupu výstavby.") == {}


def test_construction_process_flows_through_extract_tz_fields():
    txt = ("--- PAGE 1 ---\nB. CHARAKTERISTIKA MOSTU\n"
           "Nosná konstrukce bude vybetonována na pevné skruži ve třech etapách.\n")
    out = asyncio.run(extract_tz_fields(text=txt))
    cp = out.get("construction_process")
    assert cp and cp["deck_pour_stages"] == 3
    assert cp["falsework_technology"] == "fixed_scaffolding"


# ── deck heights over terrain from TZ text (bug #4): feeds height_m → skruž ────
def test_deck_heights_over_terrain_from_text():
    hs = _deck_heights_over_terrain("Výška mostu nad terénem je 8,10 / 14,90 / 9,90 m.")
    assert 14.9 in hs and 8.1 in hs and 9.9 in hs


def test_deck_heights_absent_when_phrase_missing():
    assert _deck_heights_over_terrain("Most o třech polích, spojitá deska.") == []


def test_deck_heights_flow_through_extract_tz_fields():
    txt = ("--- PAGE 1 ---\nA. ZÁKLADNÍ ÚDAJE\n"
           "Výška mostu nad terénem je 8,10 / 14,90 / 9,90 m.\n")
    out = asyncio.run(extract_tz_fields(text=txt))
    hs = out["object"]["geometry"]["deck_heights_over_terrain_m"]
    assert max(hs) == 14.9
