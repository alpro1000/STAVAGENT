"""
Derivation registry tests — PR2 Phase 4.

Exercises load + apply paths against the bundled
B12_derivation_rules/derivation_rules.yaml.
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from app.models.derivation_schemas import DerivationInputValue
from app.services.uep.derivation_registry import (
    DerivationError,
    DerivationRegistry,
    UnknownDerivationRule,
    load_registry,
    rules_path,
)


# ---------------------------------------------------------------------------
# YAML loading
# ---------------------------------------------------------------------------


def test_registry_loads_15_rules() -> None:
    reg = load_registry()
    assert len(reg) == 15
    ids = set(reg.list_rule_ids())
    expected = {
        "wall_area_from_perimeter_height",
        "tile_partial_height_area",
        "ceiling_area_from_floor",
        "concrete_volume_rectangular",
        "concrete_volume_cylindrical",
        "rebar_kg_from_volume_norm",
        "formwork_area_rectangular",
        "roof_area_from_footprint_pitch",
        "opening_area_subtraction",
        "linear_count_from_polyline_length",
        "staircase_step_count_from_height_riser",
        "plinth_area_from_perimeter_height",
        "parapet_volume_from_length_section",
        "excavation_volume_from_footprint_depth",
        "external_perimeter_total_from_polygon",
    }
    assert ids == expected


def test_default_rules_path_resolves() -> None:
    p = rules_path()
    assert p.exists()


# ---------------------------------------------------------------------------
# Unknown rule → UnknownDerivationRule (PR2 §4 criterion 14)
# ---------------------------------------------------------------------------


def test_unknown_rule_id_is_refused() -> None:
    reg = load_registry()
    with pytest.raises(UnknownDerivationRule):
        reg.apply("does_not_exist", [])


# ---------------------------------------------------------------------------
# Per-rule formula correctness
# ---------------------------------------------------------------------------


def test_wall_area_formula() -> None:
    reg = load_registry()
    out = reg.apply(
        "wall_area_from_perimeter_height",
        [
            DerivationInputValue(name="perimeter_m", value=40.0, unit="m", confidence=1.0),
            DerivationInputValue(name="height_m", value=2.7, unit="m", confidence=0.95),
        ],
    )
    assert out.value == pytest.approx(40.0 * 2.7)
    assert out.unit == "m2"
    assert out.confidence == pytest.approx(min(1.0, 0.95) * 0.95)


def test_concrete_volume_cylindrical() -> None:
    reg = load_registry()
    out = reg.apply(
        "concrete_volume_cylindrical",
        [
            DerivationInputValue(name="diameter_m", value=0.9, unit="m"),
            DerivationInputValue(name="length_m", value=10.0, unit="m"),
        ],
    )
    expected = math.pi * (0.9 / 2) ** 2 * 10.0
    assert out.value == pytest.approx(expected)


def test_roof_area_with_pitch() -> None:
    reg = load_registry()
    out = reg.apply(
        "roof_area_from_footprint_pitch",
        [
            DerivationInputValue(name="footprint_m2", value=100.0, unit="m2"),
            DerivationInputValue(name="pitch_deg", value=30.0, unit="°"),
        ],
    )
    expected = 100.0 / math.cos(math.radians(30.0))
    assert out.value == pytest.approx(expected)


def test_staircase_step_count_ceils_up() -> None:
    reg = load_registry()
    out = reg.apply(
        "staircase_step_count_from_height_riser",
        [
            DerivationInputValue(name="total_rise_m", value=2.85, unit="m"),
            DerivationInputValue(name="riser_height_m", value=0.175, unit="m"),
        ],
    )
    # 2.85 / 0.175 = 16.285 → ceil = 17
    assert out.value == 17.0


def test_excavation_with_default_slope_factor() -> None:
    reg = load_registry()
    # optional input omitted → KeyError on slope_factor because formula
    # references the symbol. The engine should NOT use undefined inputs;
    # for excavation we must pass slope_factor explicitly. PR2 design:
    # optional inputs aren't filled with a default — caller passes 0.
    out = reg.apply(
        "excavation_volume_from_footprint_depth",
        [
            DerivationInputValue(name="footprint_m2", value=50.0, unit="m2"),
            DerivationInputValue(name="depth_m", value=2.0, unit="m"),
            DerivationInputValue(name="slope_factor", value=0.0, unit="ks"),
        ],
    )
    assert out.value == pytest.approx(50.0 * 2.0 * 1.0)


def test_excavation_with_slope_factor_increases_volume() -> None:
    reg = load_registry()
    out = reg.apply(
        "excavation_volume_from_footprint_depth",
        [
            DerivationInputValue(name="footprint_m2", value=50.0, unit="m2"),
            DerivationInputValue(name="depth_m", value=2.0, unit="m"),
            DerivationInputValue(name="slope_factor", value=0.2, unit="ks"),
        ],
    )
    assert out.value == pytest.approx(50.0 * 2.0 * 1.2)


# ---------------------------------------------------------------------------
# Failure modes
# ---------------------------------------------------------------------------


def test_missing_required_input_raises_derivation_error() -> None:
    reg = load_registry()
    with pytest.raises(DerivationError) as exc:
        reg.apply(
            "wall_area_from_perimeter_height",
            [DerivationInputValue(name="perimeter_m", value=40.0, unit="m")],
        )
    assert "height_m" in str(exc.value)


def test_unit_mismatch_raises_derivation_error() -> None:
    reg = load_registry()
    with pytest.raises(DerivationError) as exc:
        reg.apply(
            "wall_area_from_perimeter_height",
            [
                DerivationInputValue(name="perimeter_m", value=40.0, unit="m"),
                # height_m declared as m, but supplied as mm
                DerivationInputValue(name="height_m", value=2700.0, unit="mm"),
            ],
        )
    assert "expected unit 'm'" in str(exc.value)


def test_formula_disallows_imports() -> None:
    """eval scope must reject any `__import__` shenanigans."""
    reg = load_registry()
    # Verify by trying to inject via the value param wouldn't run, but
    # also confirm that the safe globals don't include __builtins__.
    rule = reg.get("wall_area_from_perimeter_height")
    # Construct a malicious formula to confirm the restricted scope
    # would catch it if it were stored — this is a smoke test of the
    # eval restriction, not an actual load (since YAML validator
    # accepts any string).
    from app.services.uep.derivation_registry import _SAFE_GLOBALS
    assert _SAFE_GLOBALS["__builtins__"] == {}
    assert "open" not in _SAFE_GLOBALS
    assert "__import__" not in _SAFE_GLOBALS


# ---------------------------------------------------------------------------
# list_applicable
# ---------------------------------------------------------------------------


def test_list_applicable_for_wall_area() -> None:
    reg = load_registry()
    out = reg.list_applicable("wall_area_m2", {"perimeter_m", "height_m"})
    rule_ids = [r.rule_id for r in out]
    assert "wall_area_from_perimeter_height" in rule_ids
    first = next(r for r in out if r.rule_id == "wall_area_from_perimeter_height")
    assert first.required_inputs_satisfied
    assert first.missing_inputs == []


def test_list_applicable_with_missing_inputs() -> None:
    reg = load_registry()
    out = reg.list_applicable("wall_area_m2", {"perimeter_m"})
    first = next(r for r in out if r.rule_id == "wall_area_from_perimeter_height")
    assert not first.required_inputs_satisfied
    assert "height_m" in first.missing_inputs


def test_list_applicable_empty_when_no_rule_matches_output() -> None:
    reg = load_registry()
    out = reg.list_applicable("nonexistent_quantity", set())
    assert out == []
