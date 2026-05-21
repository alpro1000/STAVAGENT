"""Smoke tests for PR4a mep_base + 7 D.1.4 subtype matrices.

Mirrors `test_uep_coverage_matrices_pr3.py`. Each subtype matrix:
  - parses via `load_matrix()` with `extends: mep_base` resolution;
  - inherits every mep_base category (15 sdílených kategorií);
  - declares at least the calibrated discipline-specific categories the
    vyhláška 499/2006 D.1.4.x checklist implies;
  - keeps the high-signal categories at `optional: false` (no silent
    gate disablement);
  - rejects ambient duplicates — `evaluate_coverage` should not see two
    rows with the same `category` for one subtype matrix.

Multi-subtype union (`load_matrices_for_subtypes`) gets one E2E
smoke test that asserts a 3-subtype project (silnoproud + ZTI + VZT)
returns the unioned categories of all three matrices without
duplicates and with mep_base inherited only once.
"""

from __future__ import annotations

import pytest

from app.services.uep.coverage_engine import (
    load_matrices_for_subtypes,
    load_matrix,
    matrix_path_for,
)


# ---------------------------------------------------------------------------
# mep_base sanity
# ---------------------------------------------------------------------------


_MEP_BASE_CATEGORIES = {
    "project_identification",
    "norm_references",
    "rozvadec_locations",
    "cable_routing",
    "penetrations_through_constructions",
    "storey_assignment",
    "coordination_with_professions",
    "thermal_insulation",
    "building_envelope",
    "hvac_zone",
    "safety_classification",
    "ip_protection_class",
}


def test_mep_base_loads_and_carries_shared_categories() -> None:
    path = matrix_path_for("mep_base")
    assert path.exists(), f"missing mep_base matrix: {path}"

    reqs = load_matrix(path, "mep_base")
    assert len(reqs) >= 12, (
        f"mep_base matrix has {len(reqs)} requirements, expected >= 12"
    )

    actual = {r.category for r in reqs}
    missing = _MEP_BASE_CATEGORIES - actual
    assert not missing, f"mep_base missing core categories: {missing}"


# ---------------------------------------------------------------------------
# Per-subtype calibration
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "project_type,min_categories,subtype_required,subtype_blocking",
    [
        (
            "mep_d14_silnoproud",
            25,
            {
                "electrical_installed_power_kw",
                "electrical_main_distribution_board",
                "electrical_subdistribution_boards",
                "electrical_cable_specifications",
                "electrical_overcurrent_protection",
                "electrical_residual_current_protection",
                "electrical_surge_protection",
                "electrical_grounding",
                "electrical_lighting_design",
                "electrical_socket_circuits",
                "electrical_measurement_metering",
            },
            [
                "electrical_installed_power_kw",
                "electrical_main_distribution_board",
                "electrical_grounding",
            ],
        ),
        (
            "mep_d14_slaboproud",
            25,
            {
                "slaboproud_eps_system",
                "slaboproud_eps_zones",
                "slaboproud_structured_cabling",
                "slaboproud_data_rack",
                "slaboproud_co_smoke_detectors",
            },
            [
                "slaboproud_eps_system",
                "slaboproud_structured_cabling",
                "slaboproud_co_smoke_detectors",
            ],
        ),
        (
            "mep_d14_zti",
            25,
            {
                "zti_water_supply_dn",
                "zti_water_supply_pipe_material",
                "zti_water_supply_pressure",
                "zti_water_flow_rates",
                "zti_hot_water_preparation",
                "zti_drainage_dn",
                "zti_drainage_pipe_material",
                "zti_drainage_slopes",
                "zti_drainage_ventilation",
                "zti_rainwater_drainage",
                "zti_sanitary_fixtures",
                "zti_water_connection",
            },
            [
                "zti_water_supply_dn",
                "zti_drainage_dn",
                "zti_water_connection",
                "zti_hot_water_preparation",
            ],
        ),
        (
            "mep_d14_vzt",
            25,
            {
                "vzt_air_flow_rates",
                "vzt_pressure_losses",
                "vzt_duct_specifications",
                "vzt_air_velocities",
                "vzt_air_handling_units",
                "vzt_heat_recovery",
                "vzt_air_filters",
                "vzt_air_diffusers",
                "vzt_noise_attenuators",
                "vzt_fire_dampers",
                "vzt_pressure_balance",
            },
            [
                "vzt_air_flow_rates",
                "vzt_air_handling_units",
                "vzt_heat_recovery",
                "vzt_fire_dampers",
            ],
        ),
        (
            "mep_d14_ut",
            25,
            {
                "ut_heat_losses_kw",
                "ut_heat_source_type",
                "ut_heat_source_specification",
                "ut_distribution_system",
                "ut_pipe_specifications",
                "ut_circulation_pumps",
                "ut_expansion_vessel",
                "ut_thermostatic_control",
                "ut_dhw_preparation",
                "ut_central_control",
            },
            [
                "ut_heat_losses_kw",
                "ut_heat_source_type",
                "ut_distribution_system",
                "ut_central_control",
            ],
        ),
        (
            "mep_d14_plyn",
            25,
            {
                "plyn_connection",
                "plyn_main_shutoff_valve",
                "plyn_gas_meter",
                "plyn_indoor_pipes_dn",
                "plyn_indoor_pipe_material",
                "plyn_pressure_class",
                "plyn_appliances",
                "plyn_flue_gas_system",
                "plyn_pressure_test_certificate",
            },
            [
                "plyn_connection",
                "plyn_main_shutoff_valve",
                "plyn_appliances",
                "plyn_pressure_test_certificate",
            ],
        ),
        (
            "mep_d14_mar",
            25,
            {
                "mar_bms_topology",
                "mar_bms_server",
                "mar_communication_protocols",
                "mar_field_bus_network",
                "mar_temperature_sensors",
                "mar_controllers_ddc",
                "mar_servo_actuators",
                "mar_visualization_hmi",
                "mar_alarm_management",
                "mar_data_historization",
            },
            [
                "mar_bms_topology",
                "mar_communication_protocols",
                "mar_controllers_ddc",
                "mar_alarm_management",
            ],
        ),
    ],
)
def test_pr4a_subtype_matrix_loads_and_carries_calibrated_categories(
    project_type: str,
    min_categories: int,
    subtype_required: set[str],
    subtype_blocking: list[str],
) -> None:
    path = matrix_path_for(project_type)
    assert path.exists(), f"missing matrix YAML: {path}"

    reqs = load_matrix(path, project_type)

    # Hierarchical merge means every subtype inherits all base categories.
    assert len(reqs) >= min_categories, (
        f"{project_type} matrix has {len(reqs)} requirements, "
        f"expected >= {min_categories}"
    )

    actual_categories = {r.category for r in reqs}

    # mep_base shared rows inherited (sampling — full set covered by
    # test_mep_base_loads_and_carries_shared_categories).
    assert "norm_references" in actual_categories
    assert "rozvadec_locations" in actual_categories
    assert "coordination_with_professions" in actual_categories

    # Subtype-specific rows present.
    missing_subtype = subtype_required - actual_categories
    assert not missing_subtype, (
        f"{project_type} matrix missing calibrated subtype rows: {missing_subtype}"
    )

    # Calibrated blocking rows must stay non-optional.
    by_cat = {r.category: r for r in reqs}
    for cat in subtype_blocking:
        assert by_cat[cat].optional is False, (
            f"{project_type}/{cat} was flipped to optional=True — "
            f"that would silently disable the coverage gate."
        )


def test_pr4a_subtype_matrices_have_no_duplicate_categories() -> None:
    """Hierarchical merge must dedupe by category — a subtype overriding
    a base row should REPLACE it, not produce two rows with the same key.
    """

    for subtype in (
        "mep_d14_silnoproud",
        "mep_d14_slaboproud",
        "mep_d14_zti",
        "mep_d14_vzt",
        "mep_d14_ut",
        "mep_d14_plyn",
        "mep_d14_mar",
    ):
        reqs = load_matrix(matrix_path_for(subtype), subtype)
        cats = [r.category for r in reqs]
        seen: dict[str, int] = {}
        for c in cats:
            seen[c] = seen.get(c, 0) + 1
        dups = {c: n for c, n in seen.items() if n > 1}
        assert not dups, f"{subtype} has duplicate categories: {dups}"


def test_pr4a_subtype_overrides_replace_base_label() -> None:
    """When a subtype redefines a base category, its label_cs must win
    (this is the user-visible signal that the override took effect)."""

    reqs = load_matrix(
        matrix_path_for("mep_d14_silnoproud"), "mep_d14_silnoproud"
    )
    norm = next(r for r in reqs if r.category == "norm_references")
    # silnoproud override mentions ČSN 33 2000; base only says "ČSN EN".
    assert "33 2000" in norm.label_cs or "33 2130" in norm.label_cs

    # hvac_zone is OPTIONAL in mep_base, REQUIRED in VZT + ÚT subtypes.
    vzt_reqs = load_matrix(matrix_path_for("mep_d14_vzt"), "mep_d14_vzt")
    vzt_hvac = next(r for r in vzt_reqs if r.category == "hvac_zone")
    assert vzt_hvac.optional is False, "VZT must override hvac_zone to required"

    ut_reqs = load_matrix(matrix_path_for("mep_d14_ut"), "mep_d14_ut")
    ut_hvac = next(r for r in ut_reqs if r.category == "hvac_zone")
    assert ut_hvac.optional is False, "ÚT must override hvac_zone to required"


# ---------------------------------------------------------------------------
# Multi-subtype union — single project with multiple D.1.4 disciplines
# ---------------------------------------------------------------------------


def test_multi_subtype_project_unions_categories() -> None:
    """A real D.1.4 package bundles silnoproud + ZTI + VZT in one TZ
    pack. `load_matrices_for_subtypes` returns the union of categories
    across all three matrices, with `mep_base` inherited exactly once.
    """

    reqs = load_matrices_for_subtypes(
        ["mep_d14_silnoproud", "mep_d14_zti", "mep_d14_vzt"]
    )

    categories = [r.category for r in reqs]
    distinct = set(categories)

    # No category appears twice in the union.
    assert len(categories) == len(distinct), (
        f"Duplicates in unioned matrix: "
        f"{[c for c in distinct if categories.count(c) > 1]}"
    )

    # Discipline-specific rows from each subtype present.
    assert "electrical_installed_power_kw" in distinct  # silnoproud
    assert "zti_water_supply_dn" in distinct            # ZTI
    assert "vzt_air_flow_rates" in distinct             # VZT

    # mep_base categories inherited exactly once.
    assert "rozvadec_locations" in distinct
    assert "norm_references" in distinct
