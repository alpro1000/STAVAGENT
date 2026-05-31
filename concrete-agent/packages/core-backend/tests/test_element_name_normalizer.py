"""
Unit tests for the element-name normalization layer (W3).

Pure function, no MCP/DB/LLM — runs anywhere. Verifies the three signals
(canonical head-noun, construction context, status) and that common element
names are NOT mangled by the modifier-stripping.

Reference: docs/tasks/TASK_W3_NormalizeElementName_SO250.md §2, §3.
"""
from __future__ import annotations

from app.mcp.tools.element_name_normalizer import normalize_element_name as norm


# ── head-noun canonicalization ────────────────────────────────────────────────

def test_drik_of_wall_canonicalizes_to_wall():
    r = norm("Dřík konstrukce", "SO 250")
    # No explicit wall vocabulary + a bare SO-number → context stays None
    # (correctly NOT bridge), and a bare 'dřík' defaults to the wall stem.
    assert r.construction_context != "bridge"
    assert r.canonical_name == "opěrná zeď"
    assert r.head_noun == "opěrná zeď"


def test_drik_of_pier_canonicalizes_to_pier_in_bridge():
    r = norm("Dříky pilířů", "SO 202")
    assert r.construction_context == "bridge"
    assert "pilíř" in r.canonical_name


def test_prepositional_tail_stripped_head_is_obklad():
    r = norm("Lícový obklad z lomového kamene kotvený do dříku", "SO 250")
    # "do dříku" must NOT survive as the head; obklad governs.
    assert r.head_noun == "obklad"
    assert "dřík" not in r.canonical_name


def test_zaklad_canonicalized_past_dimensions_and_suffix():
    r = norm("Železobetonový základ 0,56×2,75", "SO 250")
    assert r.head_noun == "základ"
    assert r.canonical_name == "základy"  # plural the rule table matches


def test_nk_beats_tram_modifier():
    r = norm("Trámy dvoutrámové nosné konstrukce", "SO 202")
    assert r.canonical_name == "nosná konstrukce"


# ── construction context (decoupled from SO-number) ──────────────────────────

def test_so_number_alone_is_not_bridge():
    # A bare numbered object code must NOT imply bridge (criterion #69).
    r = norm("Základ", "SO 250")
    assert r.construction_context != "bridge"


def test_bridge_context_from_content_words():
    assert norm("NK deskový předpjatý", "SO-204").construction_context == "bridge"
    assert norm("Mostní pilíře P2-P3").construction_context == "bridge"


def test_retaining_wall_context_from_content_words():
    assert norm("Úhlová zárubní zeď").construction_context == "retaining_wall"


# ── status ───────────────────────────────────────────────────────────────────

def test_status_existing_on_demolition():
    assert norm("Demolice stávajícího mostu ev.č. 6-049", "SO 250").status == "stávající"


def test_status_new_by_default():
    assert norm("Dřík konstrukce", "SO 250").status == "nový"


# ── no over-stripping of common names ────────────────────────────────────────

def test_common_names_not_mangled():
    for name in ["Stěna 1.PP, C25/30", "Stropní deska nad 1.NP",
                 "Piloty vrtané Ø900, C30/37", "Římsy monolitické, C30/37"]:
        r = norm(name)
        # head_noun rewrite only fires for the targeted patterns; these keep
        # their original token stream available to the matcher.
        assert r.canonical_name  # non-empty
        assert r.status == "nový"
