"""
Golden Test: SO-250 D6 Olšová Vrata–Žalmanov, úhlová zárubní zeď (W3).

Validates the element-name normalization layer (task
docs/tasks/TASK_W3_NormalizeElementName_SO250.md). Inputs hand-transcribed from
the SO-250 probe corpus (Monolit-Planner/shared/SO-250_smartextractor_probe.md)
and the SO-202 bridge case (regression guards).

IMPORTANT — runs WITHOUT fastmcp / pytest-asyncio. These tests call the real
`classify_construction_element` coroutine (the exact body the MCP tool wraps)
through `asyncio.run`, as plain sync `test_*` functions. So:
  - no @pytest.mark.asyncio  → cannot silently no-await into a false green if
    pytest-asyncio is misconfigured;
  - no `app.mcp.server` import → does not depend on fastmcp being installed.
A missing dependency makes collection ERROR (red), never a silent skip.

8 criteria from §5 of the W3 task (classifier numbering continues from #63):

  #63 — "dřík" of a wall (SO 250)        → operna_zed, NOT driky_piliru
  #64 — "dřík" of a pier (SO 202)        → driky_piliru          (regression)
  #65 — prepositional tail not the head  → zdivo_obklad, NOT driky_piliru
  #66 — head noun "základ" (SO 250)      → zaklady, NOT jine
  #67 — "trám" of a římsa (SO 250)       → rimsa                 (regression)
  #68 — "trám" inside an NK (SO 202)     → mostovkova_deska, NOT pruvlak
  #69 — false bridge context neutralized → SO 250 not bridge; no pier/deck remap
  #70 — status binding                   → demolition text → status="stávající"
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.classifier import classify_construction_element


def _classify(name, object_code=None, object_type=None):
    """Run the real classifier coroutine synchronously (no event-loop fixture)."""
    data = asyncio.run(
        classify_construction_element(
            name=name, object_code=object_code, object_type=object_type
        )
    )
    assert "error" not in data, f"Classifier error: {data.get('error')}"
    return data


# ── #63 — "dřík" of a wall is NOT a pier ──────────────────────────────────────


def test_golden_63_drik_of_wall():
    """'Dřík konstrukce' on an úhlová zárubní zeď (SO 250) is the wall stem →
    operna_zed. Object type 'retaining_wall' is authoritative."""
    data = _classify("Dřík konstrukce", "SO 250", object_type="retaining_wall")
    assert data["element_type"] == "operna_zed", (
        f"#63 'Dřík konstrukce' on a retaining wall must be operna_zed, "
        f"not a bridge pier. Got: {data['element_type']}"
    )


# ── #64 — "dřík" of a pier stays a pier (regression) ──────────────────────────


def test_golden_64_drik_of_pier_regression():
    """'Dříky pilířů' in bridge context (SO 202) → driky_piliru. Stays green."""
    data = _classify("Dříky pilířů", "SO 202", object_type="bridge")
    assert data["element_type"] == "driky_piliru", (
        f"#64 'Dříky pilířů' on a bridge must stay driky_piliru. "
        f"Got: {data['element_type']}"
    )


# ── #65 — prepositional tail is not the head noun ─────────────────────────────


def test_golden_65_prepositional_tail_not_head():
    """'Lícový obklad z lomového kamene kotvený do dříku' → zdivo_obklad. Head is
    *obklad*; 'do dříku' is a modifier and must not win."""
    data = _classify(
        "Lícový obklad z lomového kamene kotvený do dříku",
        "SO 250",
        object_type="retaining_wall",
    )
    assert data["element_type"] == "zdivo_obklad", (
        f"#65 head noun is 'obklad' (cladding), not the 'do dříku' tail. "
        f"Expected zdivo_obklad, got: {data['element_type']}"
    )


# ── #66 — head noun "základ" canonized past the brittle suffix ────────────────


def test_golden_66_zaklad_head_noun():
    """'Železobetonový základ 0,56×2,75' → foundation family. The head-noun
    canonization ('základ' → 'základy', beating the suffix-restricted rule) still
    fires; under the single-source matcher (BUGS#5(3)) the canonical 'základy' scores
    to zaklady_piliru — the documented family-preserving convergence flip
    (zaklady→zaklady_piliru, soul.md §9; same family=foundation, NOT the residual)."""
    data = _classify(
        "Železobetonový základ 0,56×2,75", "SO 250", object_type="retaining_wall"
    )
    assert data["element_type"] == "zaklady_piliru", (
        f"#66 'základ' must classify in the foundation family (zaklady_piliru after "
        f"the single-source convergence), not the residual category. "
        f"Got: {data['element_type']}"
    )


# ── #67 — "trám" of a římsa stays a římsa (regression) ────────────────────────


def test_golden_67_rimsa_tram_regression():
    """'Římsa-kotevní trám' → rimsa. Stays green (říms before trám)."""
    data = _classify("Římsa-kotevní trám", "SO 250", object_type="retaining_wall")
    assert (
        data["element_type"] == "rimsa"
    ), f"#67 'Římsa-kotevní trám' must stay rimsa. Got: {data['element_type']}"


# ── #68 — "trám" inside an NK is the NK ────────────────────────────────────────


def test_golden_68_tram_in_nk():
    """'Trámy dvoutrámové nosné konstrukce' → mostovkova_deska (NK). The head is
    the nosná konstrukce; the 'trám' modifier must not win as průvlak."""
    data = _classify(
        "Trámy dvoutrámové nosné konstrukce", "SO 202", object_type="bridge"
    )
    assert data["element_type"] == "mostovkova_deska", (
        f"#68 head is the nosná konstrukce (NK), not a průvlak. "
        f"Expected mostovkova_deska, got: {data['element_type']}"
    )


# ── #69 — false bridge context neutralized for a retaining wall ───────────────


def test_golden_69_false_bridge_context_neutralized():
    """SO 250 is a retaining wall, not a bridge: object_type 'retaining_wall' (and a
    bare SO-number) must NOT set bridge context. The criterion is the CONTEXT flag —
    proven by is_bridge_context=False. The element type lands in the foundation
    family (zaklady_piliru via direct keyword score under the single-source matcher,
    NOT via a bridge remap — soul.md §9 convergence). Ships with #66."""
    data = _classify(
        "Železobetonový základ 0,56×2,75", "SO 250", object_type="retaining_wall"
    )
    assert data.get("is_bridge_context") is False, (
        "#69 SO 250 (zárubní zeď) must NOT be bridge context. "
        f"Got is_bridge_context={data.get('is_bridge_context')}"
    )
    assert data["element_type"] == "zaklady_piliru", (
        f"#69 'základ' on SO 250 → foundation family (zaklady_piliru by keyword score, "
        f"NOT bridge remap; non-bridge proven by is_bridge_context above). "
        f"Got: {data['element_type']}"
    )


def test_golden_69b_bare_code_alone_is_not_bridge():
    """Even WITHOUT object_type, a bare SO-number must not imply bridge — the
    SO\\d{3}=bridge assumption is removed (criterion #69 core). Element type lands in
    the foundation family (zaklady_piliru, single-source convergence — soul.md §9)."""
    data = _classify("Základ", "SO 250")
    assert data.get("is_bridge_context") is False
    assert data["element_type"] == "zaklady_piliru"


# ── #70 — status binding: existing/demolition is flagged out ──────────────────


def test_golden_70_status_existing():
    """An element from the description of the existing bridge ev.č. 6-049 and its
    demolition → status='stávající', excluded from the new object's atomization."""
    data = _classify("Demolice stávajícího mostu ev.č. 6-049", "SO 250")
    assert data.get("status") == "stávající", (
        f"#70 demolition of an existing structure must be flagged "
        f"status='stávající'. Got: {data.get('status')}"
    )


# ── object_type is authoritative over an overlapping name ─────────────────────


def test_object_type_authoritative_over_name_vocabulary():
    """A bridge element whose name carries wall-overlapping vocabulary ('opěra')
    must classify in bridge context when object_type='bridge' — proving context
    no longer depends on per-item name heuristics."""
    data = _classify("Opěra OP1 — dřík", "SO 202", object_type="bridge")
    assert data.get("is_bridge_context") is True, (
        "object_type='bridge' must be authoritative even when the name shares "
        f"wall vocabulary. Got is_bridge_context={data.get('is_bridge_context')}"
    )


# ── #77 — "dřík opěry" is an abutment stem, not a pier (TASK_2b Gate 4) ────────


def test_golden_77_drik_of_opera_is_abutment():
    """'Dřík opěry OP1' in bridge context → opery_ulozne_prahy, NOT driky_piliru.
    The genitive 'opěry' qualifier governs (same logic as 'základ opěry' →
    zaklady_oper). Mirrors the engine dřík/opěra suppression."""
    data = _classify("Dřík opěry OP1", "SO 202", object_type="bridge")
    assert data["element_type"] == "opery_ulozne_prahy", (
        f"#77 'Dřík opěry' (abutment stem) must be opery_ulozne_prahy, not a pier. "
        f"Got: {data['element_type']}"
    )


def test_golden_77b_telo_opery_is_abutment_drik_pilire_stays_pier():
    """Regression boundary: 'Tělo opěry' (abutment body) → opery_ulozne_prahy;
    'Dříky pilířů' (explicit pier) stays driky_piliru."""
    assert (
        _classify("Tělo opěry", "SO 202", object_type="bridge")["element_type"]
        == "opery_ulozne_prahy"
    )
    assert (
        _classify("Dříky pilířů", "SO 202", object_type="bridge")["element_type"]
        == "driky_piliru"
    )


# ── BUGS#5(3): wall single-source — zárubní fix + gabion reject + tížn ─────────
# Regression guards for the W3↔YAML wall-keyword convergence (the classifier now
# reads element_types.yaml + scores with the engine algorithm, so the wall vocab
# cannot drift between the two runtimes). These three were the motivating defects:
# 'zárubní zeď' false-negative (→jine), 'gabionová zeď' false-positive concrete
# (→operna_zed), 'tížná zeď' unclassified on the engine side.


def test_wall_zarubni_zed_is_retaining_wall():
    """'Zárubní zeď' → operna_zed (was jine@0.3 before the single-source fix). The
    YAML operne_zdi.include already carried 'zarubn'; W3 now reads it directly."""
    data = _classify("Zárubní zeď", "SO 250", object_type="retaining_wall")
    assert data["element_type"] == "operna_zed", (
        f"'Zárubní zeď' must be a retaining wall (operna_zed), not the residual "
        f"category. Got: {data['element_type']}"
    )


def test_wall_tizna_zed_is_retaining_wall():
    """'Tížná zeď' (gravity wall = monolithic ŽB) → operna_zed. 'tizn' added to
    operne_zdi.include for engine↔W3 parity (BUGS#5(3))."""
    data = _classify("Tížná zeď", "SO 250", object_type="retaining_wall")
    assert data["element_type"] == "operna_zed", (
        f"'Tížná zeď' (gravity retaining wall) must be operna_zed. "
        f"Got: {data['element_type']}"
    )


def test_wall_operna_zed_stays_retaining_wall():
    """Control: 'Opěrná zeď' stays operna_zed (no regression from the gabion split)."""
    assert (
        _classify("Opěrná zeď", "SO 250", object_type="retaining_wall")["element_type"]
        == "operna_zed"
    )


def test_wall_gabion_is_explicit_reject_not_concrete():
    """'Gabionová zeď' (drátokoš, NOT monolithic concrete) → explicit reject, NOT
    operna_zed. A gabion priced as a concrete retaining wall = confident wrong cost;
    the reject zeroes rebar and flags is_concrete_element=False (BUGS#5(3))."""
    data = _classify("Gabionová zeď", "SO 250", object_type="retaining_wall")
    assert data["element_type"] != "operna_zed", (
        f"'Gabionová zeď' must NOT classify as a concrete retaining wall. "
        f"Got: {data['element_type']}"
    )
    assert data.get("is_concrete_element") is False, (
        "'Gabionová zeď' must be an explicit reject (is_concrete_element=False). "
        f"Got: {data.get('is_concrete_element')}"
    )
    assert data.get("reject_reason") == "gabion_non_concrete"
    assert data["rebar_ratio_kg_m3"] == 0, "a reject carries no rebar"


def test_wall_masonry_cladding_is_explicit_reject():
    """Consistency: lícové zdivo / kamenný obklad (also family=reject) now carries
    the explicit is_concrete_element=False flag too (mirror of the TS engine)."""
    data = _classify(
        "Lícový obklad z lomového kamene", "SO 250", object_type="retaining_wall"
    )
    assert data["element_type"] == "zdivo_obklad"
    assert data.get("is_concrete_element") is False
    assert data.get("reject_reason") == "masonry_cladding"
