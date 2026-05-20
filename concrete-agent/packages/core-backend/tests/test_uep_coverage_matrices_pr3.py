"""Smoke tests for PR3 bridge / road / industrial coverage matrices.

The engine tests in `test_uep_coverage_engine.py` cover algorithmic
behaviour with hermetic in-memory fixtures. These tests just confirm
the three new YAMLs:

  - parse via load_matrix() without raising
  - have the expected minimum requirement count
  - include the high-signal categories the calibrated corpus implies
    (Žihle bridge → bridge_span_geometry + foundation_system;
     SO 250 road → pavement_layers + road_alignment;
     hk212 industrial → steel_frame + industrial_floor_slab)
"""

from __future__ import annotations

import pytest

from app.services.uep.coverage_engine import load_matrix, matrix_path_for


@pytest.mark.parametrize(
    "project_type,min_categories,required_categories",
    [
        (
            "bridge",
            25,
            {
                "bridge_span_geometry",
                "bridge_substructure",
                "bridge_superstructure",
                "bridge_deck_finishes",
                "foundation_system",
                "concrete_grade",
                "exposure_class",
                "construction_technology",
            },
        ),
        (
            "road",
            25,
            {
                "road_alignment",
                "road_cross_section",
                "pavement_layers",
                "road_bearing_capacity",
                "earthworks",
                "road_markings",
                "asphalt_mix_specification",
            },
        ),
        (
            "industrial",
            25,
            {
                "portal_frame_geometry",
                "steel_frame",
                "industrial_floor_slab",
                "floor_load_capacity",
                "cladding_walls",
                "industrial_doors",
                "fire_compartmentation",
            },
        ),
    ],
)
def test_pr3_matrix_loads_and_carries_calibrated_categories(
    project_type: str,
    min_categories: int,
    required_categories: set[str],
) -> None:
    path = matrix_path_for(project_type)
    assert path.exists(), f"Missing matrix YAML: {path}"

    reqs = load_matrix(path, project_type)
    assert len(reqs) >= min_categories, (
        f"{project_type} matrix has {len(reqs)} requirements, "
        f"expected >= {min_categories}"
    )

    actual_categories = {r.category for r in reqs}
    missing = required_categories - actual_categories
    assert not missing, f"{project_type} matrix missing: {missing}"


def test_pr3_matrix_blocking_categories_have_optional_false() -> None:
    """Calibrated high-signal categories must not slip to optional=True."""

    blocking_per_type = {
        "bridge": ["bridge_span_geometry", "foundation_system", "concrete_grade"],
        "road": ["pavement_layers", "road_alignment", "road_cross_section"],
        "industrial": ["steel_frame", "industrial_floor_slab", "floor_load_capacity"],
    }
    for project_type, categories in blocking_per_type.items():
        reqs = load_matrix(matrix_path_for(project_type), project_type)
        by_cat = {r.category: r for r in reqs}
        for cat in categories:
            assert by_cat[cat].optional is False, (
                f"{project_type}/{cat} was flipped to optional=True — "
                f"that would silently disable the coverage gate."
            )
