"""Hierarchical coverage matrix engine tests — PR4a §3.1.

Two layers of coverage:

  - `_merge_hierarchical_requirements` purely composes a base + delta
    requirement list (algorithm verification).

  - `load_matrix(..., extends:)` resolves the `extends:` chain from
    sibling YAML files in the same matrix directory (file-level
    integration). Tests write small fixture YAMLs to `tmp_path` so the
    bundled `B10_coverage_matrices/` directory is not touched.

  - `load_matrices_for_subtypes` returns a deduplicated union when one
    project has multiple MEP subtypes detected (silnoproud + ZTI + VZT).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.uep_schemas import CoverageRequirement
from app.services.uep.coverage_engine import (
    _merge_hierarchical_requirements,
    load_matrices_for_subtypes,
    load_matrix,
)


def _req(category: str, *, label: str = "x", optional: bool = False) -> CoverageRequirement:
    return CoverageRequirement(category=category, label_cs=label, optional=optional)


# ---------------------------------------------------------------------------
# _merge_hierarchical_requirements — pure unit
# ---------------------------------------------------------------------------


def test_merge_appends_new_categories_from_delta() -> None:
    base = [_req("norm_references"), _req("safety_classification")]
    delta = [_req("electrical_installed_power_kw")]
    merged = _merge_hierarchical_requirements(base, delta)
    assert [r.category for r in merged] == [
        "norm_references",
        "safety_classification",
        "electrical_installed_power_kw",
    ]


def test_merge_delta_overrides_existing_base_category() -> None:
    """Delta row with same category replaces the base row in place."""

    base_norm = _req("norm_references", label="base", optional=False)
    delta_norm = _req("norm_references", label="silnoproud override", optional=True)
    merged = _merge_hierarchical_requirements([base_norm], [delta_norm])
    assert len(merged) == 1
    assert merged[0].label_cs == "silnoproud override"
    assert merged[0].optional is True


def test_merge_preserves_base_order_then_appends_delta() -> None:
    base = [_req("a"), _req("b"), _req("c")]
    delta = [_req("c", label="overridden"), _req("d"), _req("e")]
    merged = _merge_hierarchical_requirements(base, delta)
    assert [r.category for r in merged] == ["a", "b", "c", "d", "e"]
    c_row = next(r for r in merged if r.category == "c")
    assert c_row.label_cs == "overridden"


# ---------------------------------------------------------------------------
# load_matrix(..., extends:) — file-level integration
# ---------------------------------------------------------------------------


_BASE_YAML = """
version: 1
project_type: mep_base
requirements:
  - category: norm_references
    label_cs: Citované normy ČSN EN
    required_fields: [citation]
    expected_sources: [pdf_tz]
    optional: false
  - category: rozvadec_locations
    label_cs: Umístění rozvaděčů
    required_fields: []
    expected_sources: [pdf_tz, dxf]
    optional: false
"""

_SUBTYPE_YAML = """
version: 1
project_type: mep_d14_silnoproud
extends: mep_base
requirements:
  - category: electrical_installed_power_kw
    label_cs: Celkový instalovaný výkon (kW)
    required_fields: [value]
    expected_sources: [pdf_tz]
    optional: false
  - category: norm_references
    label_cs: Citované normy ČSN ED + ČSN 33 2000
    required_fields: [citation]
    expected_sources: [pdf_tz]
    optional: false
"""


def _write_base_and_subtype(tmp_path: Path) -> Path:
    (tmp_path / "coverage_matrix_mep_base.yaml").write_text(_BASE_YAML, encoding="utf-8")
    subtype_path = tmp_path / "coverage_matrix_mep_d14_silnoproud.yaml"
    subtype_path.write_text(_SUBTYPE_YAML, encoding="utf-8")
    return subtype_path


def test_load_matrix_resolves_extends_from_sibling_yaml(tmp_path: Path) -> None:
    subtype_path = _write_base_and_subtype(tmp_path)

    reqs = load_matrix(subtype_path, project_type="mep_d14_silnoproud")

    categories = [r.category for r in reqs]
    # All base categories present, even though they declare `mep_base`.
    assert "rozvadec_locations" in categories
    # Subtype-specific category appended.
    assert "electrical_installed_power_kw" in categories
    # Base row order preserved.
    assert categories.index("norm_references") < categories.index("rozvadec_locations")


def test_load_matrix_delta_overrides_base_label(tmp_path: Path) -> None:
    subtype_path = _write_base_and_subtype(tmp_path)
    reqs = load_matrix(subtype_path, project_type="mep_d14_silnoproud")
    norm = next(r for r in reqs if r.category == "norm_references")
    assert norm.label_cs == "Citované normy ČSN ED + ČSN 33 2000"


def test_load_matrix_inherits_base_when_project_type_is_subtype(
    tmp_path: Path,
) -> None:
    """Base rows must be inherited even when project_type filter is on the
    subtype name (PR4a §3.1 — "subtype matrix inherits ALL base
    categories"). We do this by passing project_type=None when recursing
    into the base — the public docstring spells this out."""

    subtype_path = _write_base_and_subtype(tmp_path)
    reqs = load_matrix(subtype_path, project_type="mep_d14_silnoproud")
    categories = {r.category for r in reqs}
    assert {"norm_references", "rozvadec_locations", "electrical_installed_power_kw"} <= categories


def test_load_matrix_rejects_unknown_extends(tmp_path: Path) -> None:
    p = tmp_path / "coverage_matrix_orphan.yaml"
    p.write_text(
        """
version: 1
project_type: orphan
extends: nonexistent_parent
requirements:
  - category: x
    label_cs: x
""",
        encoding="utf-8",
    )
    with pytest.raises(FileNotFoundError):
        load_matrix(p, project_type="orphan")


def test_load_matrix_rejects_empty_extends_value(tmp_path: Path) -> None:
    p = tmp_path / "coverage_matrix_bad.yaml"
    p.write_text(
        """
version: 1
project_type: bad
extends: ""
requirements:
  - category: x
    label_cs: x
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="non-empty project_type"):
        load_matrix(p, project_type="bad")


def test_load_matrix_detects_extends_cycle(tmp_path: Path) -> None:
    """A → B → A must surface as ValueError, not blow the stack."""

    (tmp_path / "coverage_matrix_a.yaml").write_text(
        """
version: 1
project_type: a
extends: b
requirements:
  - category: x
    label_cs: x
""",
        encoding="utf-8",
    )
    (tmp_path / "coverage_matrix_b.yaml").write_text(
        """
version: 1
project_type: b
extends: a
requirements:
  - category: y
    label_cs: y
""",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="Cycle"):
        load_matrix(
            tmp_path / "coverage_matrix_a.yaml",
            project_type="a",
        )


# ---------------------------------------------------------------------------
# load_matrices_for_subtypes — multi-subtype union
# ---------------------------------------------------------------------------


_SUBTYPE_VZT = """
version: 1
project_type: mep_d14_vzt
extends: mep_base
requirements:
  - category: vzt_air_flow_m3h
    label_cs: Průtoky vzduchu m³/h
    required_fields: [value]
    expected_sources: [pdf_tz]
    optional: false
"""


def test_load_matrices_for_subtypes_unions_categories(tmp_path: Path) -> None:
    (tmp_path / "coverage_matrix_mep_base.yaml").write_text(_BASE_YAML, encoding="utf-8")
    (tmp_path / "coverage_matrix_mep_d14_silnoproud.yaml").write_text(
        _SUBTYPE_YAML, encoding="utf-8"
    )
    (tmp_path / "coverage_matrix_mep_d14_vzt.yaml").write_text(
        _SUBTYPE_VZT, encoding="utf-8"
    )

    reqs = load_matrices_for_subtypes(
        ["mep_d14_silnoproud", "mep_d14_vzt"],
        base_dir=tmp_path,
    )

    categories = {r.category for r in reqs}
    # Base categories present (inherited from mep_base via both subtypes).
    assert {"norm_references", "rozvadec_locations"} <= categories
    # Subtype-specific categories present once each.
    assert "electrical_installed_power_kw" in categories
    assert "vzt_air_flow_m3h" in categories
    # No duplicates.
    assert len([r for r in reqs if r.category == "norm_references"]) == 1


def test_load_matrices_for_subtypes_first_subtype_wins_on_conflict(
    tmp_path: Path,
) -> None:
    """When two subtypes both override the same base category, the FIRST
    subtype's row wins. Documented in the docstring; protects callers
    from non-deterministic merge order."""

    (tmp_path / "coverage_matrix_mep_base.yaml").write_text(_BASE_YAML, encoding="utf-8")
    (tmp_path / "coverage_matrix_mep_d14_silnoproud.yaml").write_text(
        _SUBTYPE_YAML, encoding="utf-8"
    )
    (tmp_path / "coverage_matrix_mep_d14_vzt.yaml").write_text(
        """
version: 1
project_type: mep_d14_vzt
extends: mep_base
requirements:
  - category: norm_references
    label_cs: Citované normy ČSN EN 12831 (VZT override)
    required_fields: [citation]
    expected_sources: [pdf_tz]
    optional: false
""",
        encoding="utf-8",
    )

    # silnoproud comes first → its norm_references override wins.
    reqs_silno_first = load_matrices_for_subtypes(
        ["mep_d14_silnoproud", "mep_d14_vzt"], base_dir=tmp_path
    )
    norm = next(r for r in reqs_silno_first if r.category == "norm_references")
    assert "silnoproud" in norm.label_cs.lower() or "ed" in norm.label_cs.lower()

    # vzt comes first → its norm_references override wins.
    reqs_vzt_first = load_matrices_for_subtypes(
        ["mep_d14_vzt", "mep_d14_silnoproud"], base_dir=tmp_path
    )
    norm_vzt = next(r for r in reqs_vzt_first if r.category == "norm_references")
    assert "12831" in norm_vzt.label_cs


def test_load_matrices_for_subtypes_rejects_empty_list() -> None:
    with pytest.raises(ValueError, match="≥1 subtype"):
        load_matrices_for_subtypes([])
