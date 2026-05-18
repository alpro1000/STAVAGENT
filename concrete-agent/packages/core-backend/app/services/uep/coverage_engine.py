"""
UEP coverage matrix engine — Phase 2.

`load_matrix(yaml_path, project_type) -> list[CoverageRequirement]` reads
YAML coverage matrices from `app/knowledge_base/B10_coverage_matrices/`
and filters by project_type. `evaluate_coverage(extractions, requirements,
project_type, matrix_file) -> CoverageReport` walks every requirement,
inspects the stream of `PerSourceExtraction.facts`, and emits per-category
`POKRYTO / CASTECNE / CHYBI / SKIP` plus the project-wide gate verdict.

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


def load_matrix(
    yaml_path: Path,
    project_type: str | None = None,
) -> list[CoverageRequirement]:
    """Load a coverage matrix YAML and return validated requirements.

    `project_type` filters `CoverageRequirement.project_types` when the
    YAML contains entries for more than one type. When `None`, every
    requirement is returned regardless of `project_types`.
    """
    if not yaml_path.exists():
        raise FileNotFoundError(f"Coverage matrix not found: {yaml_path}")

    with yaml_path.open("r", encoding="utf-8") as fp:
        raw = yaml.safe_load(fp)

    if not isinstance(raw, dict):
        raise ValueError(f"Matrix YAML root must be a mapping: {yaml_path}")
    requirements_raw = raw.get("requirements", [])
    if not isinstance(requirements_raw, list):
        raise ValueError(f"`requirements` must be a list in {yaml_path}")

    # YAML uses string source format names; Pydantic validates them against
    # the `SourceFormat` enum on construction.
    requirements: list[CoverageRequirement] = []
    for idx, req_raw in enumerate(requirements_raw):
        if not isinstance(req_raw, dict):
            raise ValueError(f"requirement[{idx}] must be a mapping in {yaml_path}")
        req_raw.setdefault("project_types", [raw.get("project_type", "residential")])
        try:
            req = CoverageRequirement(**req_raw)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(
                f"Invalid requirement[{idx}] (category={req_raw.get('category')}): {exc}"
            ) from exc
        if project_type is None or project_type in req.project_types:
            requirements.append(req)

    if not requirements:
        raise ValueError(
            f"No requirements loaded from {yaml_path} for project_type={project_type!r}"
        )

    return requirements


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
