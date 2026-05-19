"""
UEP passport_schema bridge — read-only Phase 1 adapter (PR2).

`passport_schema.MergedSO` is the canonical project structure already
produced by Workflow A. PR2 treats it as just another Phase 1 source —
emits a `PerSourceExtraction` with `source_format='passport_schema'`
and `extractor='uep.passport_adapter'`, populating the same
`ExtractedFact` categories that the DXF / PDF TZ extractors use.

Direction (Q12 = A, defaulted from task §2): **read-only**. UEP never
writes back to MergedSO; reconciliation rules can compare passport
facts against extractor facts and the rule's `on_mismatch` decides
which side wins.

Confidence is fixed at 0.95 per task §2 Q12=A — MergedSO has already
been human-reviewed through Workflow A, so the fact is treated as
authoritative (passport_wins on tied reconciliation rules).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.7
Reference: docs/tasks/TASK_UEP_PR2.md §3.7
Reference: app/services/extraction_to_facts_bridge.py (existing
           regex→fact bridge; we share the spirit, not the code,
           because that module emits OTSKP-style facts, not the UEP
           ExtractedFact shape).
"""

from __future__ import annotations

import logging
from typing import Any, Iterable, Optional

from app.models.uep_schemas import (
    ExtractedFact,
    PerSourceExtraction,
    SourceFormat,
    SourceProvenance,
)

logger = logging.getLogger(__name__)

# Per task §2 Q12 = A: MergedSO is authoritative — Workflow A has
# already vetted these facts.
PASSPORT_CONFIDENCE = 0.95
PASSPORT_EXTRACTOR_ID = "uep.passport_adapter"
PASSPORT_EXTRACTOR_VERSION = "1.0"


def _mk_fact(category: str, field: str, value: Any, **evidence: Any) -> ExtractedFact:
    """Compact factory for adapter facts — confidence is always 0.95."""

    return ExtractedFact(
        category=category,
        field=field,
        value=value,
        unit=None,
        confidence=PASSPORT_CONFIDENCE,
        evidence={**evidence, "source": "passport_schema.MergedSO"},
    )


def _emit_concrete_facts(technical: Any) -> Iterable[ExtractedFact]:
    """concrete_grade + exposure_class from TechnicalExtraction."""

    if technical is None:
        return
    if getattr(technical, "concrete_grade", None):
        yield _mk_fact("concrete_grade", "class", technical.concrete_grade)
    if getattr(technical, "reinforcement_grade", None):
        yield _mk_fact("reinforcement", "steel_grade", technical.reinforcement_grade)


def _emit_dimensions(technical: Any) -> Iterable[ExtractedFact]:
    """Numerical dimensions from TechnicalExtraction."""

    if technical is None:
        return
    pairs = [
        ("total_length_m", "length_m", "m"),
        ("width_m", "width_m", "m"),
        ("height_m", "height_m", "m"),
        ("area_m2", "area_m2", "m2"),
        ("volume_m3", "volume_m3", "m3"),
    ]
    for src_attr, dst_field, unit in pairs:
        v = getattr(technical, src_attr, None)
        if v is None:
            continue
        yield ExtractedFact(
            category="dimensions",
            field=dst_field,
            value=float(v),
            unit=unit,
            confidence=PASSPORT_CONFIDENCE,
            evidence={"source": "passport_schema.MergedSO.technical"},
        )


def _emit_quantities(merged_so: Any) -> Iterable[ExtractedFact]:
    """concrete_volume / reinforcement_tons / earthwork from any sub-block.

    MergedSO carries both `technical.volume_m3` (TZ) and possibly
    embedded soupis quantities. PR2 reads the most common ones:
    technical-level volume, bridge_params.reinforcement_tons.
    """

    bp = getattr(merged_so, "bridge_params", None)
    if bp is not None:
        if getattr(bp, "concrete_volume_m3", None) is not None:
            yield ExtractedFact(
                category="quantities",
                field="volume_m3",
                value=float(bp.concrete_volume_m3),
                unit="m3",
                confidence=PASSPORT_CONFIDENCE,
                evidence={"source": "passport_schema.MergedSO.bridge_params"},
            )
        if getattr(bp, "reinforcement_tons", None) is not None:
            yield ExtractedFact(
                category="quantities",
                field="mass_tons",
                value=float(bp.reinforcement_tons),
                unit="t",
                confidence=PASSPORT_CONFIDENCE,
                evidence={
                    "source": "passport_schema.MergedSO.bridge_params",
                    "element_type": "reinforcement",
                },
            )


def _emit_identification(merged_so: Any) -> Iterable[ExtractedFact]:
    """Project identification — name, SO code."""

    if merged_so.so_code:
        yield _mk_fact("project_identification", "so_code", merged_so.so_code)
    if merged_so.so_name:
        yield _mk_fact("project_identification", "so_name", merged_so.so_name)
    technical = getattr(merged_so, "technical", None)
    if technical is not None and getattr(technical, "project_name", None):
        yield _mk_fact(
            "project_identification", "project_name", technical.project_name
        )


def _emit_norm_references(technical: Any) -> Iterable[ExtractedFact]:
    """Applicable standards declared on TechnicalExtraction."""

    if technical is None:
        return
    for citation in getattr(technical, "applicable_standards", None) or []:
        if not citation:
            continue
        yield _mk_fact("norm_references", "citation", str(citation))


# ---------------------------------------------------------------------------
# Public API.
# ---------------------------------------------------------------------------


def merged_so_to_extraction(merged_so: Any) -> PerSourceExtraction:
    """Convert one MergedSO instance to a UEP PerSourceExtraction.

    Read-only. The caller passes the MergedSO object verbatim; this
    function never mutates it.

    The duck-typed `Any` signature is deliberate — `MergedSO` is
    optional infrastructure that may not be importable in every
    deployment slice (e.g. when the passport module hasn't been
    bundled). The adapter touches only the attributes it needs;
    missing ones default to no-fact-emitted.
    """

    facts: list[ExtractedFact] = []
    technical = getattr(merged_so, "technical", None)

    facts.extend(_emit_identification(merged_so))
    facts.extend(_emit_concrete_facts(technical))
    facts.extend(_emit_dimensions(technical))
    facts.extend(_emit_quantities(merged_so))
    facts.extend(_emit_norm_references(technical))

    source_file = getattr(merged_so, "so_code", "passport_schema") or "passport_schema"
    provenance = SourceProvenance(
        source_file=source_file,
        source_format=SourceFormat.PASSPORT_SCHEMA,
        extractor=PASSPORT_EXTRACTOR_ID,
        extractor_version=PASSPORT_EXTRACTOR_VERSION,
    )

    raw_data = {
        "so_code": merged_so.so_code,
        "so_name": merged_so.so_name,
        "construction_type": getattr(merged_so, "construction_type", None),
        "d14_profession": getattr(merged_so, "d14_profession", None),
        "file_count": getattr(merged_so, "file_count", 0),
    }

    logger.info(
        "[uep.passport_adapter] %s — %d facts emitted",
        merged_so.so_code, len(facts),
    )

    return PerSourceExtraction(
        provenance=provenance,
        confidence=PASSPORT_CONFIDENCE,
        parse_duration_ms=0,
        facts=facts,
        data=raw_data,
        decode_warnings=[],
        extractor_error=None,
    )


def merged_sos_to_extractions(merged_sos: Iterable[Any]) -> list[PerSourceExtraction]:
    """Batch convenience."""

    return [merged_so_to_extraction(m) for m in merged_sos]
