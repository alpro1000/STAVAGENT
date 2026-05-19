"""
UEP end-to-end CLI runner — Phase 1 + Phase 2 against a local project dir.

Usage:
    python -m scripts.uep_run_e2e \\
        --project-dir test-data/RD_Jachymov_dum/inputs/vykresy_dxf \\
        --project-type residential \\
        --project-id rd_jachymov_dum \\
        --out-dir data/uep/rd_jachymov_dum/

Discovers every supported file under `--project-dir`, routes each through
the right extractor, evaluates the residential coverage matrix, and
writes JSON artefacts mirroring the GCS layout task §14.6 sketches for
PR2:

    {out_dir}/manifest.json
    {out_dir}/phase1/per_source/{sha8}_{filename}.json
    {out_dir}/phase2/coverage_report.json

Stdout: short coverage summary suitable for CI logs.

This script intentionally has NO HTTP dependencies — PR2 wires the same
flow into a REST endpoint (`/api/v1/uep/run`) and Cloud Tasks. Today it
runs from `python -m scripts.uep_run_e2e ...`.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3, §14.6
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.uep_schemas import PerSourceExtraction, SourceFormat
from app.services.uep import (
    evaluate_coverage,
    get_extractor,
    list_supported_formats,
    load_matrix,
)
from app.services.uep.coverage_engine import (
    expected_format_diagnostics,
    matrix_path_for,
)
from app.services.uep.registry import detect_format

logger = logging.getLogger(__name__)


def _short_hash(path: Path) -> str:
    """Stable 8-char SHA-256 prefix of file content — used in output filenames."""
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()[:8]


def discover_files(project_dir: Path) -> list[tuple[Path, SourceFormat]]:
    """Return every supported file under `project_dir` with its detected format."""
    discovered: list[tuple[Path, SourceFormat]] = []
    unsupported: list[Path] = []
    for path in sorted(project_dir.rglob("*")):
        if not path.is_file():
            continue
        fmt = detect_format(path)
        if fmt is None:
            unsupported.append(path)
            continue
        discovered.append((path, fmt))
    if unsupported:
        logger.info(
            "%d unsupported files skipped (extensions not wired in PR1): %s",
            len(unsupported),
            sorted({p.suffix.lower() for p in unsupported}),
        )
    return discovered


def run_phase1(
    files: list[tuple[Path, SourceFormat]],
) -> list[PerSourceExtraction]:
    """Run every extractor; return the list of `PerSourceExtraction` records."""
    extractions: list[PerSourceExtraction] = []
    for path, fmt in files:
        extractor = get_extractor(path)
        if extractor is None:
            logger.warning("No extractor registered for %s (format=%s)", path.name, fmt)
            continue
        logger.info("[%s] extracting %s", extractor.extractor_id, path.name)
        result = extractor.extract(path)
        extractions.append(result)
        if result.extractor_error:
            logger.warning(
                "[%s] %s — extractor_error=%s",
                extractor.extractor_id,
                path.name,
                result.extractor_error,
            )
    return extractions


def write_artifacts(
    out_dir: Path,
    files: list[tuple[Path, SourceFormat]],
    extractions: list[PerSourceExtraction],
    coverage_report: Any,
    *,
    project_type: str,
    project_id: str | None,
    matrix_file: str,
) -> dict[str, str]:
    """Persist Phase-1 per-source JSONs + Phase-2 coverage report + manifest."""
    out_dir.mkdir(parents=True, exist_ok=True)
    phase1_dir = out_dir / "phase1" / "per_source"
    phase1_dir.mkdir(parents=True, exist_ok=True)
    phase2_dir = out_dir / "phase2"
    phase2_dir.mkdir(parents=True, exist_ok=True)

    file_artifacts: list[dict[str, str]] = []
    for (path, fmt), extraction in zip(files, extractions, strict=True):
        slug = "".join(c if c.isalnum() or c in "._-" else "_" for c in path.name)
        out_path = phase1_dir / f"{_short_hash(path)}_{slug}.json"
        out_path.write_text(extraction.model_dump_json(indent=2), encoding="utf-8")
        file_artifacts.append(
            {
                "source_file": path.name,
                "source_format": fmt.value,
                "extractor": extraction.provenance.extractor,
                "extractor_error": extraction.extractor_error or "",
                "facts_count": str(len(extraction.facts)),
                "artifact": str(out_path.relative_to(out_dir)),
            }
        )

    coverage_path = phase2_dir / "coverage_report.json"
    coverage_path.write_text(coverage_report.model_dump_json(indent=2), encoding="utf-8")

    manifest = {
        "uep_version": "PR1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "project_type": project_type,
        "matrix_file": matrix_file,
        "supported_formats": [f.value for f in list_supported_formats()],
        "phase1": file_artifacts,
        "phase2": {
            "artifact": str(coverage_path.relative_to(out_dir)),
            "gate_passed": coverage_report.gate_passed(),
            "pokryto_pct": coverage_report.pokryto_pct,
            "blocking_gaps": coverage_report.blocking_gaps,
        },
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "manifest": str(manifest_path),
        "phase1_dir": str(phase1_dir),
        "phase2_report": str(coverage_path),
    }


def print_summary(coverage_report: Any, diagnostics: dict[str, Any]) -> None:
    print()
    print("─" * 72)
    print(f"UEP coverage report — {coverage_report.project_type}")
    print(f"matrix:     {coverage_report.matrix_file}")
    print(f"project_id: {coverage_report.project_id or '(unset)'}")
    print(
        f"total:      {coverage_report.total_categories} categories  |  "
        f"pokryto={coverage_report.pokryto_count}  "
        f"castecne={coverage_report.castecne_count}  "
        f"chybi={coverage_report.chybi_count}  "
        f"skip={coverage_report.skip_count}"
    )
    print(
        f"score:      {coverage_report.pokryto_pct} %   "
        f"gate_passed={coverage_report.gate_passed()}"
    )
    print("─" * 72)
    if coverage_report.blocking_gaps:
        print(f"Blocking gaps ({len(coverage_report.blocking_gaps)}):")
        for gap in coverage_report.blocking_gaps:
            cat = next(
                (c for c in coverage_report.categories if c.category == gap), None
            )
            if cat:
                label = cat.label_cs
            else:
                label = ""
            print(f"  - {gap:<32} {label}")
    missing = diagnostics.get("missing_formats", {})
    if missing:
        print()
        print("Expected source formats not present in upload:")
        for fmt, cats in missing.items():
            print(f"  - {fmt:<10} would cover: {', '.join(cats[:5])}{'…' if len(cats) > 5 else ''}")
    print("─" * 72)
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="UEP end-to-end runner (Phase 1 + Phase 2)",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        required=True,
        help="Directory holding input files (recursively scanned).",
    )
    parser.add_argument(
        "--project-type",
        default="residential",
        choices=["residential"],  # PR3 adds 'bridge' and 'road'
        help="Coverage matrix to evaluate against.",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="Optional project identifier echoed in manifest + report.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        required=True,
        help="Where to write phase1/phase2/manifest JSONs.",
    )
    parser.add_argument(
        "--matrix",
        type=Path,
        default=None,
        help="Override coverage matrix YAML path (default: bundled B10).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable INFO logging.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    project_dir: Path = args.project_dir.resolve()
    if not project_dir.is_dir():
        parser.error(f"--project-dir must be a directory: {project_dir}")

    matrix_path: Path = args.matrix or matrix_path_for(args.project_type)
    if not matrix_path.exists():
        parser.error(f"Coverage matrix not found: {matrix_path}")

    requirements = load_matrix(matrix_path, project_type=args.project_type)

    files = discover_files(project_dir)
    if not files:
        parser.error(
            f"No supported files found in {project_dir} "
            f"(supported formats: {[f.value for f in list_supported_formats()]})"
        )

    extractions = run_phase1(files)
    coverage_report = evaluate_coverage(
        extractions,
        requirements,
        project_type=args.project_type,
        matrix_file=matrix_path.name,
        project_id=args.project_id,
    )

    available_formats = {fmt for _, fmt in files}
    diagnostics = expected_format_diagnostics(requirements, available_formats)

    paths = write_artifacts(
        args.out_dir.resolve(),
        files,
        extractions,
        coverage_report,
        project_type=args.project_type,
        project_id=args.project_id,
        matrix_file=matrix_path.name,
    )

    print_summary(coverage_report, diagnostics)
    print(f"manifest:      {paths['manifest']}")
    print(f"phase1 dir:    {paths['phase1_dir']}")
    print(f"phase2 report: {paths['phase2_report']}")
    return 0 if coverage_report.gate_passed() else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
