"""Smoke tests for PR3 bridge / road / industrial reconciliation rule sets.

The engine algorithm tests in `test_uep_reconciliation_engine.py`
cover behaviour. These tests just confirm the YAML rule sets:

  - parse via load_rules() without raising
  - have the expected minimum rule count
  - include the high-signal rules the calibrated corpus implies
"""

from __future__ import annotations

import pytest

from app.services.uep.reconciliation_engine import load_rules, rules_path_for


@pytest.mark.parametrize(
    "project_type,min_rules,required_rule_ids",
    [
        (
            "bridge",
            10,
            {
                "bridge_span_geometry_tz_vs_drawing",
                "bridge_concrete_class_tz_vs_drawing",
                "bridge_exposure_class_xf4_check",
                "bridge_total_volume_tz_vs_soupis",
                "bridge_bearings_count_tz_vs_drawing",
                "bridge_geology_xa_vs_concrete_exposure",
            },
        ),
        (
            "road",
            8,
            {
                "road_alignment_length_tz_vs_landxml",
                "road_pavement_layer_thickness",
                "road_asphalt_volume_tz_vs_soupis",
                "road_earthworks_volume_tz_vs_landxml",
                "road_bearing_capacity_edef",
            },
        ),
        (
            "industrial",
            8,
            {
                "industrial_portal_frame_geometry",
                "industrial_steel_grade_tz_vs_drawing",
                "industrial_floor_slab_thickness",
                "industrial_floor_load_capacity",
                "industrial_fire_compartment_area",
                "industrial_atex_zone_classification",
            },
        ),
    ],
)
def test_pr3_rules_load_and_carry_calibrated_ids(
    project_type: str,
    min_rules: int,
    required_rule_ids: set[str],
) -> None:
    path = rules_path_for(project_type)
    assert path.exists(), f"Missing rules YAML: {path}"

    rs = load_rules(path, project_type)
    assert len(rs.rules) >= min_rules, (
        f"{project_type} rules has {len(rs.rules)} entries, "
        f"expected >= {min_rules}"
    )

    actual_ids = {r.id for r in rs.rules}
    missing = required_rule_ids - actual_ids
    assert not missing, f"{project_type} rules missing: {missing}"


def test_pr3_rules_critical_severity_preserved() -> None:
    """High-signal rules must keep severity=critical (not downgraded)."""

    critical_per_type = {
        "bridge": [
            "bridge_span_geometry_tz_vs_drawing",
            "bridge_concrete_class_tz_vs_drawing",
            "bridge_exposure_class_xf4_check",
            "bridge_total_volume_tz_vs_soupis",
        ],
        "road": [
            "road_alignment_length_tz_vs_landxml",
            "road_pavement_layer_thickness",
            "road_pavement_class_tz_vs_soupis",
            "road_bearing_capacity_edef",
        ],
        "industrial": [
            "industrial_portal_frame_geometry",
            "industrial_steel_grade_tz_vs_drawing",
            "industrial_floor_slab_thickness",
            "industrial_floor_load_capacity",
            "industrial_fire_compartment_area",
            "industrial_atex_zone_classification",
        ],
    }
    for project_type, rule_ids in critical_per_type.items():
        rs = load_rules(rules_path_for(project_type), project_type)
        by_id = {r.id: r for r in rs.rules}
        for rid in rule_ids:
            assert by_id[rid].severity.value == "critical", (
                f"{project_type}/{rid} was downgraded from critical — "
                f"would silently weaken the reconciliation gate."
            )
