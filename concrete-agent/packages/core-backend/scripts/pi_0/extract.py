"""Π.0a Foundation Extraction Layer — entry point.

Step 1 deliverable: skeleton + idempotency wrapper. Produces a
master_extract_{objekt}.json containing only the metadata section
(sources catalogued by SHA-256). Extractors for rooms / openings /
skladby / etc. land in subsequent steps.

Usage:
    python -m pi_0.extract --objekt={A|B|C|D}
    python -m pi_0.extract --all
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
from pathlib import Path

from pi_0 import SCHEMA_VERSION, __version__
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


def extract(objekt: str) -> dict:
    """Step 1: produce master_extract with metadata only.

    Subsequent steps populate rooms / walls / openings / skladby / etc.
    See TASK_PHASE_PI_0_SPEC.md §2 for the full schema.
    """
    sources = files_for_objekt(objekt)
    return {
        "metadata": build_metadata(objekt, sources),
        "rooms": [],
        "walls": [],
        "openings": [],
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
        "warnings": [],
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
