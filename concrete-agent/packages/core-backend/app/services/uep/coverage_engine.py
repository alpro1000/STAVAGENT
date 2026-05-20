"""
UEP coverage matrix engine — Phase 2.

`load_matrix(yaml_path, project_type) -> list[CoverageRequirement]` reads
YAML coverage matrices from `app/knowledge_base/B10_coverage_matrices/`
and filters by project_type. PR4a §3.1 adds **hierarchical matrices** —
a YAML with `extends: <parent>` at the root loads the parent first and
merges its `requirements:` on top (subtype rows override base rows with
the same category). `load_matrices_for_subtypes(subtypes)` is the
multi-subtype helper: it loads every subtype matrix and returns the
union of categories so a single project (e.g. D.1.4 silnoproud + ZTI +
VZT bundled together) can be evaluated against every relevant matrix.

`evaluate_coverage(extractions, requirements, project_type, matrix_file)
-> CoverageReport` walks every requirement, inspects the stream of
`PerSourceExtraction.facts`, and emits per-category `POKRYTO / CASTECNE
/ CHYBI / SKIP` plus the project-wide gate verdict.

Algorithm per requirement (see task §3.2):

1. Find every fact whose `fact.category == requirement.category` across
   all input extractions.
2. If the requirement declares `required_fields`:
   - filled = required_fields whose name appears as `fact.field`
   - missing = required_fields - filled
   - all filled → POKRYTO
   - some filled → CASTECNE
   - none filled → CHYBI
3. Else (no required_fields — "any fact counts"):
   - ≥1 fact in category → POKRYTO
   - 0 facts → CHYBI
4. Optional categories with status=CHYBI do NOT enter `blocking_gaps`.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.2, §7.2
"""
from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

import yaml

from app.models.uep_schemas import (
    CoverageCategoryReport,
    CoverageReport,
    CoverageRequirement,
    CoverageStatus,
    PerSourceExtraction,
    SourceFormat,
)

logger = logging.getLogger(__name__)


# Bundled matrices live next to the engine — `Path(__file__).parent / ../...`
# is brittle; we resolve from the known KB sub-package and let callers pass
# an explicit path when running matrices from GCS (PR2) or outside the repo.
DEFAULT_MATRIX_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "knowledge_base"
    / "B10_coverage_matrices"
)


def matrix_path_for(project_type: str) -> Path:
    """Return the bundled matrix path for a project type.

    Convention: `coverage_matrix_{project_type}.yaml` in the B10 KB dir.
    """
    return DEFAULT_MATRIX_DIR / f"coverage_matrix_{project_type}.yaml"


def _safe_load_yaml(yaml_path: Path) -> dict[str, Any]:
    """Load a YAML file as a dict, surfacing parse/IO failures with the
    source path attached so REST handlers don't bleed internal detail.

    Shared by `load_matrix()` and `_load_raw_matrix()` (hierarchical
    base+delta path). Mirrors the same wrap done elsewhere in
    `services/uep/` — single canonical site to keep behaviour consistent.
    """

    if not yaml_path.exists():
        raise FileNotFoundError(f"Coverage matrix not found: {yaml_path}")
    try:
        with yaml_path.open("r", encoding="utf-8") as fp:
            raw = yaml.safe_load(fp)
    except (OSError, yaml.YAMLError) as exc:
        raise RuntimeError(
            f"Failed to load coverage matrix from {yaml_path}: {exc}"
        ) from exc
    if not isinstance(raw, dict):
        raise ValueError(f"Matrix YAML root must be a mapping: {yaml_path}")
    return raw


def _requirements_from_raw(
    raw: dict[str, Any],
    yaml_path: Path,
    project_type: str | None,
) -> list[CoverageRequirement]:
    """Convert the raw `requirements:` list of dicts into validated
    `CoverageRequirement` instances, applying the project_type filter.

    Pure — does not look at `extends:` (hierarchical merge happens in
    `load_matrix()` before calling this helper).
    """

    requirements_raw = raw.get("requirements", [])
    if not isinstance(requirements_raw, list):
        raise ValueError(f"`requirements` must be a list in {yaml_path}")

    out: list[CoverageRequirement] = []
    for idx, req_raw in enumerate(requirements_raw):
        if not isinstance(req_raw, dict):
            raise ValueError(f"requirement[{idx}] must be a mapping in {yaml_path}")
        # YAML default for project_types: the file-level `project_type`
        # field falls back to "residential" only for legacy single-type
        # files. Hierarchical matrices (PR4a) inherit the subtype name
        # from their own file-level `project_type`.
        req_raw.setdefault("project_types", [raw.get("project_type", "residential")])
        try:
            req = CoverageRequirement(**req_raw)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(
                f"Invalid requirement[{idx}] (category={req_raw.get('category')}): {exc}"
            ) from exc
        if project_type is None or project_type in req.project_types:
            out.append(req)
    return out


def _merge_hierarchical_requirements(
    base: list[CoverageRequirement],
    delta: list[CoverageRequirement],
) -> list[CoverageRequirement]:
    """Merge a subtype `delta` matrix into its `base`.

    Algorithm (per Q16 = C hierarchical, PR4a task §3.1):

    1. Start with every base requirement.
    2. For each delta requirement: if its `category` matches a base row,
       the delta REPLACES the base row (subtype-specific
       `required_fields` / `optional` / `notes` win). Otherwise the
       delta is APPENDED as a new row.
    3. Order is preserved — base rows first (in their original order),
       then any net-new delta rows in their original order.

    This is purely additive at the YAML-load layer; the runtime
    `CoverageRequirement` model is unchanged so all existing PR1-3
    coverage logic still applies.
    """

    by_cat = {req.category: i for i, req in enumerate(base)}
    merged = list(base)
    for d_req in delta:
        if d_req.category in by_cat:
            merged[by_cat[d_req.category]] = d_req
        else:
            by_cat[d_req.category] = len(merged)
            merged.append(d_req)
    return merged


def load_matrix(
    yaml_path: Path,
    project_type: str | None = None,
    *,
    base_dir: Path | None = None,
    _seen: set[Path] | None = None,
) -> list[CoverageRequirement]:
    """Load a coverage matrix YAML and return validated requirements.

    `project_type` filters `CoverageRequirement.project_types` when the
    YAML contains entries for more than one type. When `None`, every
    requirement is returned regardless of `project_types`.

    **Hierarchical matrices (PR4a)** — if the YAML root carries an
    `extends:` key naming another matrix project_type (e.g. `mep_base`),
    the base matrix is loaded first and the current matrix's
    `requirements:` are merged on top:

        # coverage_matrix_mep_d14_silnoproud.yaml
        version: 1
        project_type: mep_d14_silnoproud
        extends: mep_base
        requirements:
          - category: electrical_installed_power_kw
            …
          - category: norm_references     # also defined in mep_base
            required_fields: [citation]   # subtype override

    `base_dir` lets tests point at a fixture directory; production
    callers leave it `None` to use the bundled `DEFAULT_MATRIX_DIR`.
    `_seen` is the internal cycle-guard — passing it explicitly is not
    part of the public API.
    """
    raw = _safe_load_yaml(yaml_path)

    # Cycle guard: a YAML that `extends:` itself, directly or via a
    # chain, would loop forever. We track the resolved paths we've
    # already visited and refuse to re-enter.
    seen = set(_seen) if _seen is not None else set()
    canonical = yaml_path.resolve()
    if canonical in seen:
        raise ValueError(
            f"Cycle in coverage matrix `extends:` chain at {yaml_path}"
        )
    seen.add(canonical)

    delta_reqs = _requirements_from_raw(raw, yaml_path, project_type)

    if "extends" in raw:
        extends = raw["extends"]
        if not isinstance(extends, str) or not extends.strip():
            raise ValueError(
                f"`extends:` must be a non-empty project_type string in {yaml_path}"
            )
        base_root = base_dir or yaml_path.parent
        base_path = base_root / f"coverage_matrix_{extends.strip()}.yaml"
        # Pass project_type=None to the base load so we get every row;
        # the subtype filter is applied on the subtype's own rows only.
        # This matches the intent of "inherit ALL base categories".
        base_reqs = load_matrix(
            base_path,
            project_type=None,
            base_dir=base_root,
            _seen=seen,
        )
        requirements = _merge_hierarchical_requirements(base_reqs, delta_reqs)
    else:
        requirements = delta_reqs

    if not requirements:
        raise ValueError(
            f"No requirements loaded from {yaml_path} for project_type={project_type!r}"
        )

    return requirements


def load_matrices_for_subtypes(
    subtypes: list[str],
    *,
    base_dir: Path | None = None,
) -> list[CoverageRequirement]:
    """Convenience helper for multi-subtype projects (PR4a §3.1).

    When `project_type_detector` reports several MEP subtypes for one
    project (e.g. silnoproud + ZTI + VZT bundled in one TZ pack), the
    coverage gate must apply every relevant matrix and union the
    categories. Each subtype's hierarchical matrix already inherits
    `mep_base`, so the merge here is at the requirement level:

    1. Load each subtype matrix (each one already merged with mep_base).
    2. De-duplicate by category — the FIRST subtype's row wins when two
       subtypes both redefine a base category. Order = caller-supplied.

    Returning the unioned `CoverageRequirement` list lets the existing
    `evaluate_coverage()` consume it without any further change.
    """

    if not subtypes:
        raise ValueError("load_matrices_for_subtypes requires ≥1 subtype")

    root = base_dir or DEFAULT_MATRIX_DIR
    by_cat: dict[str, CoverageRequirement] = {}
    order: list[str] = []
    for subtype in subtypes:
        path = root / f"coverage_matrix_{subtype}.yaml"
        reqs = load_matrix(path, project_type=subtype, base_dir=root)
        for req in reqs:
            if req.category not in by_cat:
                by_cat[req.category] = req
                order.append(req.category)
    return [by_cat[c] for c in order]


def evaluate_coverage(
    extractions: Iterable[PerSourceExtraction],
    requirements: list[CoverageRequirement],
    *,
    project_type: str,
    matrix_file: str,
    project_id: str | None = None,
) -> CoverageReport:
    """Phase-2 evaluation — produce a `CoverageReport`.

    `extractions` is iterated once. Files with `extractor_error` set still
    contribute zero facts but their `source_file` shows up in any category
    they would have populated (we surface the gap, not the silence).
    """
    extractions_list = list(extractions)

    # Index facts by category for O(N) total over all facts. Also remember
    # which source files contribute to each category so the report can list
    # provenance for each row.
    facts_by_category: dict[str, list[tuple[str, str]]] = defaultdict(list)
    failed_sources: list[str] = []
    for extraction in extractions_list:
        if extraction.extractor_error:
            failed_sources.append(extraction.provenance.source_file)
            continue
        for fact in extraction.facts:
            facts_by_category[fact.category].append(
                (fact.field, extraction.provenance.source_file)
            )

    category_reports: list[CoverageCategoryReport] = []
    pokryto_count = 0
    castecne_count = 0
    chybi_count = 0
    skip_count = 0
    blocking_gaps: list[str] = []

    for req in requirements:
        facts_for_cat = facts_by_category.get(req.category, [])
        contributing_sources = sorted({src for _, src in facts_for_cat})
        fact_count = len(facts_for_cat)

        if req.required_fields:
            present_fields = {field for field, _ in facts_for_cat}
            filled = [f for f in req.required_fields if f in present_fields]
            missing = [f for f in req.required_fields if f not in present_fields]
            if not filled:
                status = CoverageStatus.CHYBI
            elif missing:
                status = CoverageStatus.CASTECNE
            else:
                status = CoverageStatus.POKRYTO
        else:
            filled = sorted({field for field, _ in facts_for_cat})
            missing = []
            status = CoverageStatus.POKRYTO if fact_count > 0 else CoverageStatus.CHYBI

        category_reports.append(
            CoverageCategoryReport(
                category=req.category,
                label_cs=req.label_cs,
                status=status,
                filled_fields=filled,
                missing_fields=missing,
                contributing_sources=contributing_sources,
                fact_count=fact_count,
                optional=req.optional,
                notes=req.notes,
            )
        )

        if status == CoverageStatus.POKRYTO:
            pokryto_count += 1
        elif status == CoverageStatus.CASTECNE:
            castecne_count += 1
        elif status == CoverageStatus.CHYBI:
            chybi_count += 1
            if not req.optional:
                blocking_gaps.append(req.category)
        elif status == CoverageStatus.SKIP:
            skip_count += 1

    total = len(requirements)
    pokryto_pct = 0.0 if total == 0 else (pokryto_count / total) * 100.0

    return CoverageReport(
        project_type=project_type,
        matrix_file=matrix_file,
        project_id=project_id,
        total_categories=total,
        pokryto_count=pokryto_count,
        castecne_count=castecne_count,
        chybi_count=chybi_count,
        skip_count=skip_count,
        pokryto_pct=round(pokryto_pct, 2),
        blocking_gaps=blocking_gaps,
        categories=category_reports,
    )


def expected_format_diagnostics(
    requirements: list[CoverageRequirement],
    available_formats: set[SourceFormat],
) -> dict[str, Any]:
    """Helper for Phase-1 gate diagnostics.

    Returns `{missing_format: [categories]}` showing which expected source
    formats are absent from the project upload. Used by the CLI e2e script
    to print operator-friendly hints (e.g. "no PDF_TZ uploaded → 12
    categories will be CHYBI").
    """
    by_missing: dict[str, list[str]] = defaultdict(list)
    for req in requirements:
        if not req.expected_sources:
            continue
        if any(fmt in available_formats for fmt in req.expected_sources):
            continue
        for fmt in req.expected_sources:
            by_missing[fmt.value].append(req.category)
    return {
        "missing_formats": {
            fmt: sorted(set(cats)) for fmt, cats in by_missing.items()
        }
    }
