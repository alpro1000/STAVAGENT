"""
UWO F3 — unified catalog-binding status-enum (design.md §2.2 / §5.1).

Before F3 the `code_status` field carried divergent string literals: the
catalog-binding adapter used `candidate`/`not_verified` while the work-breakdown
OTSKP path used `bound`/`no_match` for the SAME outcomes. F3 introduces a single
`CodeStatus` enum in item_schemas.py and collapses the synonyms. These tests pin
the enum, the adapter mapping, and that the legacy literals are gone from the
producers.
"""
from pathlib import Path

from app.models.item_schemas import CodeStatus

_VALID = {s.value for s in CodeStatus}


def test_enum_canonical_values():
    # Design's four binding outcomes + two real extension states.
    assert CodeStatus.EXACT.value == "exact"
    assert CodeStatus.CANDIDATE.value == "candidate"
    assert CodeStatus.GROUP_ONLY.value == "group_only"
    assert CodeStatus.NOT_VERIFIED.value == "not_verified"
    assert CodeStatus.BUNDLED.value == "bundled"
    assert CodeStatus.NOT_CALCULATED.value == "not_calculated"
    # The collapsed synonyms must NOT exist as members.
    assert "bound" not in _VALID
    assert "no_match" not in _VALID


def test_map_status_emits_only_valid_codestatus_and_never_exact():
    from app.mcp.tools.catalog_binding_adapter import URS_CANDIDATE_FLOOR, map_status

    cases = [
        ("item", 0.85, "urs_matcher_service"),
        ("item", URS_CANDIDATE_FLOOR - 0.01, "urs_matcher_service"),
        ("item", 0.80, "perplexity_urs_search"),
        ("group", 0.55, "urs_matcher_service"),
        ("raw_context", 0.5, "perplexity_urs_search"),
        ("none", 0.0, None),
        (None, None, None),
    ]
    for mk, conf, src in cases:
        status = map_status(mk, conf, src)
        assert status in _VALID, (mk, status)
        # INVARIANT: the adapter never fabricates `exact` — reserved for a
        # deterministic OTSKP DB code hit, unreachable from a text/URS match.
        assert status != CodeStatus.EXACT.value


def test_map_status_unchanged_semantics():
    """The unification is vocabulary-only; the match_kind→status mapping that the
    UWO atomizer test pins must still hold (regression guard)."""
    from app.mcp.tools.catalog_binding_adapter import URS_CANDIDATE_FLOOR, map_status

    assert map_status("item", 0.85, "urs_matcher_service") == CodeStatus.CANDIDATE.value
    assert map_status("item", URS_CANDIDATE_FLOOR - 0.01, "urs_matcher_service") == CodeStatus.NOT_VERIFIED.value
    assert map_status("item", 0.5, "perplexity_urs_search") == CodeStatus.CANDIDATE.value
    assert map_status("group", 0.55, "urs_matcher_service") == CodeStatus.GROUP_ONLY.value
    assert map_status("none", 0.0, None) == CodeStatus.NOT_VERIFIED.value


def test_legacy_literals_removed_from_producers():
    """Call-site guard: the two producers must no longer assign the collapsed
    synonyms to code_status. A revert re-introduces the divergence and fails here
    (same source-inspection idiom as test_stage_gating_policy's auth.py parse)."""
    base = Path(__file__).resolve().parents[1] / "app" / "mcp" / "tools"
    for fname in ("breakdown.py", "catalog_binding_adapter.py"):
        src = (base / fname).read_text(encoding="utf-8")
        assert 'code_status"] = "bound"' not in src, fname
        assert 'code_status"] = "no_match"' not in src, fname
        assert 'status="bound"' not in src, fname


def test_psv_decompose_emits_not_calculated():
    """The interiér/PSV work-first decomposition emits the frozen NOT_CALCULATED
    state (codeless, catalog binding deferred — Pattern 15) via the enum."""
    from app.mcp.tools.breakdown import _decompose_interier_psv

    atoms = _decompose_interier_psv("Malba — vnitřní malířské práce", {"area_m2": 12.0})
    assert atoms, "malba template should decompose into at least one atom"
    for a in atoms:
        assert a["code_status"] == CodeStatus.NOT_CALCULATED.value
        assert a["code_status"] in _VALID
