"""Π.0a Foundation Extraction Layer — entry point.

Step 1: skeleton + idempotency wrapper.
Step 2: DXF block-name attrs absorption — populates openings[] for D
(via existing dxf_parser_test.json since DWG→DXF conversion isn't
wired into pi_0/ yet; A/B/C deferred to Step 5+).

Usage:
    python -m pi_0.extract --objekt={A|B|C|D}
    python -m pi_0.extract --all
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
from pathlib import Path

from pi_0 import SCHEMA_VERSION, __version__
from pi_0.extractors.dxf_openings import parse_block_name, parsed_anything
from pi_0.schema import write_canonical

# Resolve the repo root from this file's location:
# scripts/pi_0/extract.py → ../../../../../  → repo root
REPO_ROOT = Path(__file__).resolve().parents[5]
SOURCES_ROOT = REPO_ROOT / "test-data" / "libuse" / "sources"
OUTPUTS_ROOT = REPO_ROOT / "test-data" / "libuse" / "outputs"

VALID_OBJEKTY = ("A", "B", "C", "D")

# Step 2: legacy DXF parse output (covers D drawings only). Used as
# the temporary source of opening block_names until pi_0/ wires DWG→DXF
# conversion for A/B/C in Step 5+.
LEGACY_DXF_PARSER_TEST_JSON = OUTPUTS_ROOT / "dxf_parser_test.json"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


EXTRACTABLE_SUFFIXES = {".dwg", ".dxf", ".pdf", ".xlsx", ".docx"}


def _kind_for(suffix: str) -> str:
    return {".dwg": "dwg", ".dxf": "dxf", ".pdf": "pdf",
            ".xlsx": "xlsx", ".docx": "docx"}.get(suffix.lower(), "other")


def files_for_objekt(objekt: str) -> list[Path]:
    """Yield extractable source files for `objekt`: per-objekt + shared.

    Filters to the formats extractors actually read (dwg/dxf/pdf/xlsx/docx).
    INVENTORY.md, .gitkeep, and other meta files are skipped.
    """
    if objekt not in VALID_OBJEKTY:
        raise ValueError(f"objekt must be one of {VALID_OBJEKTY}, got {objekt!r}")
    found: list[Path] = []
    for bucket in (SOURCES_ROOT / objekt, SOURCES_ROOT / "shared"):
        if not bucket.exists():
            continue
        for path in sorted(bucket.rglob("*")):
            if path.is_file() and path.suffix.lower() in EXTRACTABLE_SUFFIXES:
                found.append(path)
    return found


def build_metadata(objekt: str, source_files: list[Path]) -> dict:
    """metadata section: objekt + extractor version + source file catalog."""
    return {
        "objekt": objekt,
        "extracted_at": _dt.datetime.now(tz=_dt.timezone.utc).isoformat(timespec="seconds"),
        "extractor_version": __version__,
        "schema_version": SCHEMA_VERSION,
        "source_files": [
            {
                "path": str(p.relative_to(REPO_ROOT)),
                "sha256": _sha256_file(p),
                "kind": _kind_for(p.suffix),
                "size_bytes": p.stat().st_size,
            }
            for p in source_files
        ],
    }


def _load_legacy_dxf_parse() -> dict:
    """Read existing dxf_parser_test.json (read-only). Returns {} if absent."""
    if not LEGACY_DXF_PARSER_TEST_JSON.exists():
        return {}
    with open(LEGACY_DXF_PARSER_TEST_JSON, encoding="utf-8") as f:
        return json.load(f)


def extract_openings(objekt: str) -> tuple[list[dict], list[dict]]:
    """Extract opening blocks for `objekt` from existing DXF parse output.

    Returns (openings, warnings). Each opening carries the raw block_name
    plus parsed `block_attrs` per parse_block_name(). Currently uses
    `outputs/dxf_parser_test.json` as the source — covers D drawings
    only. A/B/C return empty + a warning until DWG→DXF wiring lands in
    Step 5+.

    Schema follows TASK_PHASE_PI_0_SPEC.md §2.4.
    """
    if objekt != "D":
        return [], [{
            "level": "info",
            "category": "deferred_extraction",
            "message": (
                f"Openings for objekt {objekt} not extracted in Step 2 — pi_0/ "
                "doesn't wire DWG→DXF conversion yet. Deferred to Step 5+ when "
                "per-objekt scope wiring lands."
            ),
            "source_evidence": f"sources/{objekt}/dwg/*.dwg present but unparsed",
        }]

    legacy = _load_legacy_dxf_parse()
    if not legacy:
        return [], [{
            "level": "warning",
            "category": "missing_legacy_input",
            "message": (
                "outputs/dxf_parser_test.json absent — cannot extract D "
                "openings via Step 2 fallback. Skipping."
            ),
            "source_evidence": str(LEGACY_DXF_PARSER_TEST_JSON.relative_to(REPO_ROOT)),
        }]

    openings: list[dict] = []
    warnings: list[dict] = []
    unparseable_count = 0

    for drawing_key, drawing_data in legacy.items():
        for op in drawing_data.get("openings", []):
            block_name = op.get("block_name")
            block_attrs = parse_block_name(block_name)
            entry = {
                "id": f"{objekt}.{drawing_key}.{op.get('type_code', 'unknown')}.{len(openings):04d}",
                "otvor_type": op.get("otvor_type"),
                "type_code": op.get("type_code"),
                "source_drawing": drawing_key,
                "source_layer": op.get("source_layer"),
                "block_name": {
                    "value": block_name,
                    "source": f"DXF|{drawing_key}|{op.get('source_layer', '?')}",
                    "confidence": 1.0,
                },
                "block_attrs": block_attrs,
                "position": op.get("position"),
                "width_mm": {
                    "value": op.get("width_mm"),
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
                "height_mm": {
                    "value": op.get("height_mm"),
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
                "depth_mm": {
                    "value": op.get("depth_mm"),
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
            }
            openings.append(entry)
            if not parsed_anything(block_attrs):
                unparseable_count += 1
                warnings.append({
                    "level": "warning",
                    "category": "block_name_unparseable",
                    "message": f"Could not parse any attribute from block_name: {block_name!r}",
                    "source_evidence": f"DXF|{drawing_key}|opening_id={entry['id']}",
                })

    # Coverage gate (per SPEC §5 step 2: ≥90 % parseable)
    if openings:
        parsed_pct = (len(openings) - unparseable_count) / len(openings)
        warnings.append({
            "level": "info",
            "category": "step_2_gate",
            "message": (
                f"Step 2 gate: {len(openings) - unparseable_count}/{len(openings)} "
                f"openings parseable ({parsed_pct:.1%}); "
                f"target ≥90 %; gate {'PASSED' if parsed_pct >= 0.90 else 'FAILED'}."
            ),
            "source_evidence": LEGACY_DXF_PARSER_TEST_JSON.name,
        })

    return openings, warnings


def extract(objekt: str) -> dict:
    """Produce master_extract for `objekt`.

    Step 1: metadata + empty section stubs.
    Step 2: openings[] populated from legacy DXF parse output (D only).
    Subsequent steps fill rooms / walls / skladby / doors / windows / etc.
    See TASK_PHASE_PI_0_SPEC.md §2 for the full schema.
    """
    sources = files_for_objekt(objekt)
    openings, opening_warnings = extract_openings(objekt)
    return {
        "metadata": build_metadata(objekt, sources),
        "rooms": [],
        "walls": [],
        "openings": openings,
        "skladby": {},
        "doors": [],
        "windows": [],
        "glass_partitions": [],
        "locksmith": [],
        "sheet_metal_TP": [],
        "lintels": [],
        "others_OP": [],
        "segment_counts": {},
        "footprint_areas": {},
        "legacy_vv": {},
        "warnings": opening_warnings,
        "validation": {},
    }


def write_output(objekt: str, data: dict) -> Path:
    out = OUTPUTS_ROOT / f"master_extract_{objekt}.json"
    write_canonical(out, data)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pi_0.extract", description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--objekt", choices=VALID_OBJEKTY, help="Single objekt")
    group.add_argument("--all", action="store_true", help="Run A + B + C + D")
    args = parser.parse_args(argv)

    targets = list(VALID_OBJEKTY) if args.all else [args.objekt]
    for obj in targets:
        data = extract(obj)
        path = write_output(obj, data)
        n_sources = len(data["metadata"]["source_files"])
        print(f"  {obj}: {n_sources} source files → {path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
