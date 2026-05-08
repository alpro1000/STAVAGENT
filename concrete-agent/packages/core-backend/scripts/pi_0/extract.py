"""Π.0a Foundation Extraction Layer — entry point.

Step 1: skeleton + idempotency wrapper.
Step 2: DXF block-name attrs absorption (parse_block_name).
Step 2.5: ezdxf-based direct DXF reading — full A/B/C/D coverage now
that scripts/infrastructure/build_libredwg.sh + dwg_to_dxf_batch.py
produce DXFs from sources/{objekt}/dwg/. Replaces the earlier legacy
dxf_parser_test.json fallback.

Usage:
    python -m pi_0.extract --objekt={A|B|C|D}
    python -m pi_0.extract --all

If sources/{objekt}/dxf/ is missing or empty, openings stays empty +
warning. Run scripts/infrastructure/dwg_to_dxf_batch.py (or the
Libuše-specific phase_0_5_batch_convert.py) first.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
from pathlib import Path

from pi_0 import SCHEMA_VERSION, __version__
from pi_0.extractors.dxf_openings import (
    extract_openings_from_dxf, parse_block_name, parsed_anything,
)
from pi_0.schema import write_canonical

# Resolve the repo root from this file's location:
# scripts/pi_0/extract.py → ../../../../../  → repo root
REPO_ROOT = Path(__file__).resolve().parents[5]
SOURCES_ROOT = REPO_ROOT / "test-data" / "libuse" / "sources"
OUTPUTS_ROOT = REPO_ROOT / "test-data" / "libuse" / "outputs"

VALID_OBJEKTY = ("A", "B", "C", "D")


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


def _dxf_files_for_objekt(objekt: str) -> list[Path]:
    """Return DXF files for `objekt`: per-objekt + shared. Sorted, stable."""
    found: list[Path] = []
    for bucket in (SOURCES_ROOT / objekt, SOURCES_ROOT / "shared"):
        dxf_dir = bucket / "dxf"
        if dxf_dir.exists():
            found.extend(sorted(dxf_dir.glob("*.dxf")))
    return found


def extract_openings(objekt: str) -> tuple[list[dict], list[dict]]:
    """Extract opening blocks for `objekt` directly from sources DXFs.

    Returns (openings, warnings). Each opening carries the raw block_name
    plus parsed `block_attrs` per parse_block_name(), shaped per
    TASK_PHASE_PI_0_SPEC.md §2.4.

    Reads `sources/{objekt}/dxf/*.dxf` and `sources/shared/dxf/*.dxf`
    (the 1.PP komplex drawings shared across all objekty). DXFs are
    produced by `scripts/infrastructure/dwg_to_dxf_batch.py` from the
    DWGs under `sources/{objekt}/dwg/`. Missing DXFs → empty openings
    + warning suggesting the converter run.
    """
    dxf_files = _dxf_files_for_objekt(objekt)
    if not dxf_files:
        return [], [{
            "level": "warning",
            "category": "missing_dxf_input",
            "message": (
                f"No DXF files under sources/{objekt}/dxf/ or sources/shared/"
                f"dxf/. Run scripts/infrastructure/dwg_to_dxf_batch.py or "
                f"phase_0_5_batch_convert.py to convert DWGs first."
            ),
            "source_evidence": f"sources/{objekt}/dxf/ + sources/shared/dxf/",
        }]

    openings: list[dict] = []
    warnings: list[dict] = []
    unparseable_count = 0
    drawings_read = 0

    for dxf_path in dxf_files:
        raw_openings = extract_openings_from_dxf(dxf_path)
        drawings_read += 1
        for raw in raw_openings:
            block_name = raw["block_name"]
            block_attrs = parse_block_name(block_name)
            entry = {
                "id": f"{objekt}.{raw['source_drawing']}."
                      f"{raw.get('type_code') or 'unknown'}.{len(openings):04d}",
                "otvor_type": raw["otvor_type"],
                "type_code": raw.get("type_code"),
                "source_drawing": raw["source_drawing"],
                "source_layer": raw["source_layer"],
                "block_name": {
                    "value": block_name,
                    "source": f"DXF|{raw['source_drawing']}|{raw['source_layer']}",
                    "confidence": 1.0,
                },
                "block_attrs": block_attrs,
                "position": raw["position"],
                "width_mm": {
                    "value": raw["width_mm"],
                    "source": f"DXF|{raw['source_drawing']}|block_name",
                    "confidence": 0.95,
                },
                "height_mm": {
                    "value": raw["height_mm"],
                    "source": f"DXF|{raw['source_drawing']}|block_name",
                    "confidence": 0.95,
                },
                "depth_mm": {
                    "value": raw["depth_mm"],
                    "source": f"DXF|{raw['source_drawing']}|block_name",
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
                    "source_evidence": f"DXF|{raw['source_drawing']}|opening_id={entry['id']}",
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
                f"target ≥90 %; gate {'PASSED' if parsed_pct >= 0.90 else 'FAILED'}; "
                f"DXFs read: {drawings_read}."
            ),
            "source_evidence": f"sources/{objekt}/dxf/ + sources/shared/dxf/",
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
