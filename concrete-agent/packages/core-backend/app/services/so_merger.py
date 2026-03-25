"""
SO Merger — Priority-based multi-document merge with contradiction detection.

Merges extraction results from multiple documents belonging to the same SO
(Stavební Objekt) into a single MergedSO object.

Merge priority (lower = wins):
  1. TZ-D (dílčí technická zpráva) — most authoritative
  2. VY-* (výkresy) — drawings have exact dimensions
  3. GE-GTP/IGP (geotechnický průzkum) — ground truth data
  4. TZ-S (souhrnná TZ) — overview, lower priority
  5. RO (rozpočet) — budget data
  6. PD (podmínky) — tender conditions
  7. HA (harmonogram) — schedule
  8. SM (smlouva) — contract
  99. OT (ostatní) — fallback

Contradiction detection:
  When two documents provide different values for the same field,
  a ContradictionRecord is created. Contradictions are flagged as
  "critical" (structural dimensions), "warning" (materials), or
  "info" (administrative).

Author: STAVAGENT Team
Version: 3.0.0
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal

from app.models.passport_schema import (
    BridgeSOParams,
    GTPExtraction,
    TenderExtraction,
    ContradictionRecord,
    MergedSO,
    SOFile,
    SOFileGroup,
    ClassificationInfo,
    DocCategory,
    DocSubType,
)
from app.services.document_classifier import SUB_TYPE_PRIORITY

logger = logging.getLogger(__name__)

# Fields that trigger "critical" severity when contradicted
CRITICAL_FIELDS = {
    "bridge_length_m", "bridge_width_m", "free_width_m", "span_m",
    "light_span_m", "nk_length_m", "structural_height_m",
    "pile_diameter_mm", "pile_length_m", "load_class",
    "concrete_nk", "concrete_substructure",
}

# Fields that trigger "warning" severity
WARNING_FIELDS = {
    "beam_count", "beam_spacing_mm", "slab_thickness_mm",
    "reinforcement", "foundation_type", "clearance_under_m",
    "bridge_height_m", "settlement_abutment_1_mm",
}

# Numeric tolerance for "same value" (relative %)
NUMERIC_TOLERANCE_PCT = 2.0


def _values_differ(val1: Any, val2: Any) -> bool:
    """Check if two values differ, with numeric tolerance."""
    if val1 is None or val2 is None:
        return False  # Can't contradict if one is missing

    # Both numeric — check tolerance
    if isinstance(val1, (int, float, Decimal)) and isinstance(val2, (int, float, Decimal)):
        v1, v2 = float(val1), float(val2)
        if v1 == 0 and v2 == 0:
            return False
        avg = (abs(v1) + abs(v2)) / 2
        if avg == 0:
            return v1 != v2
        pct_diff = abs(v1 - v2) / avg * 100
        return pct_diff > NUMERIC_TOLERANCE_PCT

    # String comparison (case-insensitive, strip whitespace)
    if isinstance(val1, str) and isinstance(val2, str):
        return val1.strip().lower() != val2.strip().lower()

    return val1 != val2


def _get_severity(field_name: str) -> str:
    """Determine contradiction severity based on field name."""
    if field_name in CRITICAL_FIELDS:
        return "critical"
    if field_name in WARNING_FIELDS:
        return "warning"
    return "info"


def detect_contradictions(
    extractions: List[Tuple[str, int, Dict[str, Any]]],
) -> List[ContradictionRecord]:
    """
    Detect contradictions across multiple extraction results for the same SO.

    Args:
        extractions: List of (source_filename, priority, extracted_dict) tuples,
                     sorted by priority (lower = higher authority).

    Returns:
        List of ContradictionRecord objects.
    """
    contradictions: List[ContradictionRecord] = []

    if len(extractions) < 2:
        return contradictions

    # Compare each pair (higher priority vs lower priority)
    for i in range(len(extractions)):
        source_1, priority_1, data_1 = extractions[i]
        for j in range(i + 1, len(extractions)):
            source_2, priority_2, data_2 = extractions[j]

            # Find common fields
            common_keys = set(data_1.keys()) & set(data_2.keys())

            for key in common_keys:
                val1 = data_1[key]
                val2 = data_2[key]

                if _values_differ(val1, val2):
                    severity = _get_severity(key)
                    # Higher priority source wins
                    resolution = f"Použita hodnota z {source_1} (priorita {priority_1})"

                    contradictions.append(ContradictionRecord(
                        so_code=None,  # Will be set by caller
                        field_name=key,
                        value_1=str(val1),
                        source_1=source_1,
                        value_2=str(val2),
                        source_2=source_2,
                        resolution=resolution,
                        severity=severity,
                    ))

                    logger.info(
                        f"Contradiction [{severity}]: {key} = "
                        f"'{val1}' ({source_1}) vs '{val2}' ({source_2})"
                    )

    return contradictions


def merge_bridge_params(
    extractions: List[Tuple[str, int, Dict[str, Any]]],
    so_code: str,
) -> Tuple[Optional[BridgeSOParams], List[ContradictionRecord]]:
    """
    Merge multiple BridgeSOParams extractions with priority-based override.

    Args:
        extractions: List of (source_filename, priority, bridge_dict) tuples.
        so_code: The SO code for this group.

    Returns:
        (merged BridgeSOParams, list of contradictions)
    """
    if not extractions:
        return None, []

    # Sort by priority (lower = higher authority)
    sorted_exts = sorted(extractions, key=lambda x: x[1])

    # Detect contradictions before merging
    contradictions = detect_contradictions(sorted_exts)
    for c in contradictions:
        c.so_code = so_code

    # Merge: iterate from lowest priority to highest, overwriting
    merged: Dict[str, Any] = {}
    sources: Dict[str, str] = {}

    for source, priority, data in reversed(sorted_exts):
        for key, val in data.items():
            if val is not None:
                merged[key] = val
                sources[key] = source

    # Higher priority overwrites (iterate again in priority order)
    for source, priority, data in sorted_exts:
        for key, val in data.items():
            if val is not None:
                merged[key] = val
                sources[key] = source

    # Add source tracking
    merged["sources"] = sources

    try:
        bridge = BridgeSOParams(**{k: v for k, v in merged.items() if k != "sources"})
        bridge.sources = sources
        return bridge, contradictions
    except Exception as e:
        logger.warning(f"Failed to build BridgeSOParams for {so_code}: {e}")
        return None, contradictions


def merge_so_group(
    so_code: str,
    file_results: List[Dict[str, Any]],
) -> MergedSO:
    """
    Merge results from all files in an SO group.

    Args:
        so_code: The SO code (e.g., "SO 201")
        file_results: List of dicts, each containing:
            - "filename": str
            - "classification": ClassificationInfo
            - "bridge_params": dict or None (from BRIDGE_TZ_PROMPT)
            - "gtp": dict or None (from GTP prompt)
            - "tender": dict or None (from FULL_PD_PROMPT)
            - "technical": dict or None (from standard TZ prompt)
            - "passport": dict or None (Layer 2 regex facts)

    Returns:
        MergedSO with merged data, contradictions, and source tracking.
    """
    bridge_extractions: List[Tuple[str, int, Dict[str, Any]]] = []
    gtp_data: Optional[Dict[str, Any]] = None
    gtp_source: Optional[str] = None
    tender_data: Optional[Dict[str, Any]] = None
    tender_source: Optional[str] = None
    all_contradictions: List[ContradictionRecord] = []
    sources: Dict[str, str] = {}
    file_list: List[str] = []

    for fr in file_results:
        filename = fr.get("filename", "unknown")
        file_list.append(filename)
        classification = fr.get("classification")
        priority = 99

        if classification:
            sub_type = getattr(classification, "sub_type", None)
            if sub_type:
                priority = SUB_TYPE_PRIORITY.get(sub_type, 99)

        # Collect bridge params for merge
        bp = fr.get("bridge_params")
        if bp and isinstance(bp, dict):
            bridge_extractions.append((filename, priority, bp))

        # Also merge bridge fields from standard TZ extraction
        tech = fr.get("technical")
        if tech and isinstance(tech, dict):
            # Extract bridge-relevant fields from standard TZ
            bridge_fields = {}
            for k in ["total_length_m", "width_m", "height_m", "span_count",
                       "span_lengths_m", "concrete_grade", "reinforcement_grade",
                       "foundation_type", "load_class"]:
                if k in tech and tech[k] is not None:
                    bridge_fields[k] = tech[k]
            if bridge_fields:
                bridge_extractions.append((filename, priority, bridge_fields))

        # GTP: take highest priority
        gtp = fr.get("gtp")
        if gtp and isinstance(gtp, dict):
            if gtp_data is None or priority < (SUB_TYPE_PRIORITY.get(DocSubType.GE_GTP, 3)):
                gtp_data = gtp
                gtp_source = filename

        # Tender: take highest priority
        tender = fr.get("tender")
        if tender and isinstance(tender, dict):
            if tender_data is None:
                tender_data = tender
                tender_source = filename

    # Merge bridge params with contradiction detection
    merged_bridge, bridge_contradictions = merge_bridge_params(
        bridge_extractions, so_code
    )
    all_contradictions.extend(bridge_contradictions)

    # Build GTP extraction
    merged_gtp = None
    if gtp_data:
        try:
            merged_gtp = GTPExtraction(**gtp_data)
            sources["gtp"] = gtp_source
        except Exception as e:
            logger.warning(f"Failed to build GTPExtraction for {so_code}: {e}")

    # Build Tender extraction
    merged_tender = None
    if tender_data:
        try:
            merged_tender = TenderExtraction(**tender_data)
            sources["tender"] = tender_source
        except Exception as e:
            logger.warning(f"Failed to build TenderExtraction for {so_code}: {e}")

    # Compute coverage
    categories_found = set()
    for fr in file_results:
        cls = fr.get("classification")
        if cls and hasattr(cls, "category"):
            categories_found.add(cls.category.value if hasattr(cls.category, "value") else str(cls.category))

    coverage = {
        cat.value: (cat.value in categories_found)
        for cat in [DocCategory.TZ, DocCategory.VY, DocCategory.GE,
                    DocCategory.RO, DocCategory.HA, DocCategory.SM,
                    DocCategory.PD, DocCategory.ZP]
    }

    merged = MergedSO(
        so_code=so_code,
        bridge_params=merged_bridge,
        gtp=merged_gtp,
        tender=merged_tender,
        contradictions=all_contradictions,
        sources=sources,
        file_count=len(file_list),
        files=file_list,
        coverage=coverage,
    )

    logger.info(
        f"Merged SO {so_code}: {len(file_list)} files, "
        f"{len(all_contradictions)} contradictions "
        f"({sum(1 for c in all_contradictions if c.severity == 'critical')} critical)"
    )

    return merged
