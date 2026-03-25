"""
File Grouper — Groups uploaded files by SO (Stavební Objekt) code.

Extracts SO codes from filenames using regex patterns and groups files
into SOFileGroup objects for multi-document merge processing.

Filename conventions supported:
  - "201_01_TZ.pdf"         → SO 201
  - "SO_202_TZ.pdf"         → SO 202
  - "SO 203 situace.pdf"    → SO 203
  - "technicka_zprava.pdf"  → SO 000 (project-level, no SO code)

Author: STAVAGENT Team
Version: 3.0.0
"""

import logging
import hashlib
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

from app.models.passport_schema import (
    DocCategory,
    ClassificationInfo,
    SOFile,
    SOFileGroup,
)
from app.services.document_classifier import (
    classify_document,
    enrich_classification,
    extract_so_code,
    detect_sub_type,
)

logger = logging.getLogger(__name__)

# Default SO code for project-level files (no SO in filename)
PROJECT_LEVEL_SO = "SO 000"


def _file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of file for deduplication."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def create_so_file(file_path: str, text: str = "") -> SOFile:
    """
    Create an SOFile from a file path with classification.

    Runs tier 1-2 classification (no AI) and enriches with sub_type/SO code.
    """
    path = Path(file_path)
    filename = path.name

    # Classify (sync, tiers 1-2 only)
    classification = classify_document(filename, text)
    classification = enrich_classification(classification, filename)

    # Extract SO code
    so_code = extract_so_code(filename) or PROJECT_LEVEL_SO

    # File hash for dedup
    file_hash = _file_hash(path) if path.exists() else None

    return SOFile(
        filename=filename,
        file_path=file_path,
        so_code=so_code,
        classification=classification,
        file_hash=file_hash,
    )


def group_files_by_so(file_paths: List[str], texts: Optional[Dict[str, str]] = None) -> List[SOFileGroup]:
    """
    Group files by SO code.

    Args:
        file_paths: List of file paths to group
        texts: Optional dict of {file_path: extracted_text} for better classification

    Returns:
        List of SOFileGroup, sorted by SO code.
        Project-level files (no SO) go into "SO 000".
    """
    texts = texts or {}
    groups: Dict[str, List[SOFile]] = {}

    for fp in file_paths:
        text = texts.get(fp, "")
        so_file = create_so_file(fp, text)

        so_code = so_file.so_code or PROJECT_LEVEL_SO
        if so_code not in groups:
            groups[so_code] = []
        groups[so_code].append(so_file)

    # Deduplicate files within each SO group (by hash)
    for so_code, files in groups.items():
        seen_hashes = set()
        deduped = []
        for f in files:
            if f.file_hash and f.file_hash in seen_hashes:
                logger.warning(f"Duplicate file skipped: {f.filename} in {so_code}")
                continue
            if f.file_hash:
                seen_hashes.add(f.file_hash)
            deduped.append(f)
        groups[so_code] = deduped

    # Build SOFileGroup objects
    result = []
    for so_code, files in sorted(groups.items()):
        # Compute coverage: which DocCategories are present
        categories_present = set()
        for f in files:
            if f.classification and f.classification.confidence >= 0.4:
                categories_present.add(f.classification.category)

        # All categories we care about
        all_categories = {
            DocCategory.TZ, DocCategory.VY, DocCategory.GE,
            DocCategory.RO, DocCategory.HA, DocCategory.SM,
            DocCategory.PD, DocCategory.ZP,
        }
        missing = all_categories - categories_present

        coverage = {
            cat.value: (cat in categories_present)
            for cat in all_categories
        }

        group = SOFileGroup(
            so_code=so_code,
            files=files,
            coverage=coverage,
            missing_categories=[cat.value for cat in sorted(missing, key=lambda c: c.value)],
        )
        result.append(group)

    logger.info(
        f"File grouping: {len(file_paths)} files → {len(result)} SO groups "
        f"({', '.join(g.so_code for g in result)})"
    )

    return result


def get_coverage_report(groups: List[SOFileGroup]) -> Dict[str, Any]:
    """
    Generate a coverage report for all SO groups.

    Returns:
        {
            "total_files": 12,
            "total_groups": 3,
            "groups": {
                "SO 201": {"TZ": true, "VY": true, "GE": false, ...},
                ...
            },
            "missing": {
                "SO 201": ["GE", "HA"],
                ...
            }
        }
    """
    from typing import Any

    report: Dict[str, Any] = {
        "total_files": sum(len(g.files) for g in groups),
        "total_groups": len(groups),
        "groups": {},
        "missing": {},
    }

    for g in groups:
        report["groups"][g.so_code] = g.coverage
        if g.missing_categories:
            report["missing"][g.so_code] = g.missing_categories

    return report
