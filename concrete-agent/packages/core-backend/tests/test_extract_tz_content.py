"""half-B live-run extraction fixes — CONTENT assertions (not just structure).

The golden (keys ⊆ example) passed while extraction silently dropped exposure
classes; these tests assert WHAT is extracted. No network, no fastmcp.
"""

from app.mcp.tools.extract_tz_fields import _concrete_classes


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
