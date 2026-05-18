"""
UEP PDF TZ extractor — Phase 1.

Baseline `pdfplumber` + regex (`services/regex_extractor.py`) extractor
for Czech technická zpráva (TZ) documents. NO LLM in PR1 — only the
existing deterministic `CzechConstructionExtractor` per the repo
mantra "determinism prior to AI".

Reuses `services/regex_extractor.extract_from_text` so PR1 doesn't fork
a second regex catalogue. Translates the existing dict result shape
(`concrete_specifications`, `reinforcement`, `quantities`, …) into
universal `ExtractedFact` records that the coverage matrix can read.

If a PDF is scanned (no extractable text), the extractor flags the file
with `extractor_error="ocr_required"` and ZERO facts — Phase-2 sees
the gap and the operator can route the file through the existing
MinerU OCR service (PR2 wiring).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.1
Reference: services/regex_extractor.py (existing patterns)
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pdfplumber

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.regex_extractor import extract_from_text
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


# Minimum characters per page to consider the PDF text-bearing. Below this
# threshold we assume the PDF is scanned / image-only and signal the
# `ocr_required` path. 50 chars × N pages keeps title pages from triggering
# the heuristic on otherwise-good documents.
_MIN_CHARS_PER_PAGE = 50


class PdfTzExtractor(BaseExtractor):
    """Universal extractor for PDF technická zpráva (TZ)."""

    source_format = SourceFormat.PDF_TZ
    extractor_id = "uep.pdf_tz_extractor"
    extractor_version = "1.0"
    # Task §3.1 confidence band for text PDFs is 0.85-1.00.
    default_confidence = 0.90

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        decode_warnings: list[dict[str, Any]] = []

        text_per_page: list[str] = []
        try:
            with pdfplumber.open(str(path)) as pdf:
                page_count = len(pdf.pages)
                for page_num, page in enumerate(pdf.pages, start=1):
                    try:
                        text = page.extract_text() or ""
                    except Exception as exc:  # noqa: BLE001
                        decode_warnings.append(
                            {
                                "code": "page_extract_failed",
                                "page": page_num,
                                "message": str(exc),
                            }
                        )
                        text = ""
                    text_per_page.append(text)
        except Exception as exc:  # noqa: BLE001
            raise ExtractorError(f"pdfplumber.open() failed: {exc}") from exc

        combined_text = "\n".join(text_per_page)
        total_chars = len(combined_text)

        # OCR gate — empty / near-empty PDFs are flagged so coverage matrix
        # surfaces the gap. NEVER silently return zero facts.
        if total_chars < _MIN_CHARS_PER_PAGE * max(1, page_count):
            raise ExtractorError(
                f"Insufficient extractable text ({total_chars} chars across "
                f"{page_count} pages) — PDF likely scanned, route through "
                "MinerU OCR (PR2 wiring)."
            )

        # Existing deterministic patterns — single source of truth.
        # `extract_from_text` returns a mix of dicts and Pydantic / dataclass
        # instances; normalise to plain dicts here so the downstream
        # `.get()` calls work uniformly.
        regex_result_raw = extract_from_text(combined_text)
        regex_result = _normalise_to_plain(regex_result_raw)

        facts: list[ExtractedFact] = []

        # ------------------------------------------------------------------
        # Concrete specifications.
        # `concrete_specifications` items come from `ConcreteSpecification`
        # in services/regex_extractor.py — fields: `concrete_class`,
        # `exposure_classes` (list), `raw_text`, `context_text`, …
        # Coverage matrix category: `concrete_grade`.
        # ------------------------------------------------------------------
        for spec in regex_result.get("concrete_specifications", []) or []:
            klass = spec.get("concrete_class") or spec.get("class")
            if not klass:
                continue
            facts.append(
                ExtractedFact(
                    category="concrete_grade",
                    field="class",
                    value=klass,
                    unit=None,
                    confidence=1.0,
                    evidence={
                        "raw": spec.get("raw_text") or "",
                        "context": (
                            spec.get("context_text") or spec.get("context") or ""
                        )[:200],
                    },
                )
            )
            exposure = spec.get("exposure_classes") or spec.get("exposure") or []
            for xclass in exposure:
                facts.append(
                    ExtractedFact(
                        category="exposure_class",
                        field="class",
                        value=xclass,
                        unit=None,
                        confidence=1.0,
                        evidence={"derived_from": klass},
                    )
                )

        # Standalone exposure classes not attached to a specific concrete spec.
        for xclass in regex_result.get("exposure_classes_found", []) or []:
            facts.append(
                ExtractedFact(
                    category="exposure_class",
                    field="class",
                    value=xclass,
                    unit=None,
                    confidence=1.0,
                    evidence={"source": "standalone"},
                )
            )

        # ------------------------------------------------------------------
        # Reinforcement — `ReinforcementSpecification`: `steel_grade`,
        # `diameter_mm`, `total_mass_tons`, `raw_text`.
        # ------------------------------------------------------------------
        for steel in regex_result.get("reinforcement", []) or []:
            grade = steel.get("steel_grade") or steel.get("grade")
            if grade:
                facts.append(
                    ExtractedFact(
                        category="reinforcement",
                        field="steel_grade",
                        value=grade,
                        unit=None,
                        confidence=1.0,
                        evidence={
                            "raw_text": (steel.get("raw_text") or "")[:200],
                            "diameter_mm": steel.get("diameter_mm"),
                            "total_mass_tons": steel.get("total_mass_tons"),
                        },
                    )
                )

        # ------------------------------------------------------------------
        # Quantities — `QuantityItem`: `element_type`, `description`,
        # `volume_m3`, `area_m2`, `mass_tons`, `length_m`, `concrete_class`.
        # Emit one fact per non-null metric so the coverage matrix can ask
        # for `quantities.volume_m3` etc. directly.
        # ------------------------------------------------------------------
        metric_units = {
            "volume_m3": "m3",
            "area_m2": "m2",
            "mass_tons": "t",
            "length_m": "m",
        }
        for quantity in regex_result.get("quantities", []) or []:
            for metric, unit in metric_units.items():
                value = quantity.get(metric)
                if value is None:
                    continue
                facts.append(
                    ExtractedFact(
                        category="quantities",
                        field=metric,
                        value=value,
                        unit=unit,
                        confidence=1.0,
                        evidence={
                            "element_type": quantity.get("element_type") or "",
                            "description": (quantity.get("description") or "")[:120],
                            "source_section": quantity.get("source_section"),
                        },
                    )
                )

        # ------------------------------------------------------------------
        # Dimensions — `BuildingDimensions` is a single dict (or None).
        # Each non-null field becomes a fact under `dimensions`.
        # ------------------------------------------------------------------
        dims_payload = regex_result.get("dimensions")
        if isinstance(dims_payload, dict):
            dims_iter = [dims_payload]
        elif isinstance(dims_payload, list):
            dims_iter = [d for d in dims_payload if isinstance(d, dict)]
        else:
            dims_iter = []
        dim_units = {
            "floors_underground": "ks",
            "floors_above_ground": "ks",
            "total_floors": "ks",
            "height_m": "m",
            "built_up_area_m2": "m2",
            "gross_floor_area_m2": "m2",
        }
        for dims in dims_iter:
            for field_name, unit in dim_units.items():
                value = dims.get(field_name)
                if value is None:
                    continue
                facts.append(
                    ExtractedFact(
                        category="dimensions",
                        field=field_name,
                        value=value,
                        unit=unit,
                        confidence=1.0,
                        evidence={},
                    )
                )

        # ------------------------------------------------------------------
        # Special requirements — `SpecialRequirement`: `requirement_type`,
        # `description`, `parameters`, `raw_text`.
        # ------------------------------------------------------------------
        for req in regex_result.get("special_requirements", []) or []:
            req_type = req.get("requirement_type") or req.get("type") or "unknown"
            facts.append(
                ExtractedFact(
                    category="special_requirements",
                    field=req_type,
                    value=req.get("description") or req.get("value") or True,
                    unit=None,
                    confidence=1.0,
                    evidence={
                        "parameters": req.get("parameters") or {},
                        "raw_text": (req.get("raw_text") or "")[:200],
                    },
                )
            )

        # ------------------------------------------------------------------
        # Norms (`_extract_norms` returns `List[str]`) — coverage matrix
        # wants at least one citation present.
        # ------------------------------------------------------------------
        for norm in regex_result.get("norms", []) or []:
            if isinstance(norm, str):
                citation = norm
            elif isinstance(norm, dict):
                citation = norm.get("number") or norm.get("value") or norm.get("citation") or ""
            else:
                citation = str(norm)
            if not citation:
                continue
            facts.append(
                ExtractedFact(
                    category="norm_references",
                    field="citation",
                    value=citation,
                    unit=None,
                    confidence=1.0,
                    evidence={},
                )
            )

        # ------------------------------------------------------------------
        # Identification — `_extract_identification` returns `Dict[str, str]`
        # with keys like `investor`, `project_name`, `address`.
        # ------------------------------------------------------------------
        identification = regex_result.get("identification") or {}
        if isinstance(identification, dict):
            for key, val in identification.items():
                if not val:
                    continue
                facts.append(
                    ExtractedFact(
                        category="project_identification",
                        field=key,
                        value=val,
                        unit=None,
                        confidence=0.95,
                        evidence={},
                    )
                )

        # ------------------------------------------------------------------
        # Referenced documents (drawing list cited in TZ).
        # ------------------------------------------------------------------
        for ref in regex_result.get("referenced_documents", []) or []:
            if isinstance(ref, str):
                doc_value = ref
            elif isinstance(ref, dict):
                doc_value = ref.get("name") or ref.get("title") or str(ref)
            else:
                doc_value = str(ref)
            facts.append(
                ExtractedFact(
                    category="referenced_documents",
                    field="document",
                    value=doc_value,
                    unit=None,
                    confidence=0.85,
                    evidence={},
                )
            )

        # ------------------------------------------------------------------
        # Raw data — pages text + full regex result for downstream phases.
        # We DON'T put full text in facts.evidence (too verbose); raw_data
        # carries it for audit replay.
        # ------------------------------------------------------------------
        raw_data: dict[str, Any] = {
            "page_count": page_count,
            "char_count_total": total_chars,
            "text_per_page_truncated": [t[:500] for t in text_per_page],
            "regex_result": regex_result,  # already normalised to plain types
        }

        return facts, raw_data, decode_warnings


def _normalise_to_plain(obj: Any) -> Any:
    """Recursively coerce `regex_extractor` output (Pydantic models,
    dataclasses, enums) to plain JSON-able primitives.

    The existing `services/regex_extractor.py` returns a mix:
      - dict of category → list/dict
      - inner items are Pydantic models (ConcreteSpecification, …),
        dataclasses (`ExtractedFact`, …), or plain dicts depending on
        the category.

    Normalisation rules (in priority order):
      1. Pydantic v2 model → `model_dump()`
      2. Pydantic v1 model → `dict()`
      3. dataclass → `{field: normalised value}`
      4. Enum → `value`
      5. dict / list / tuple → recurse
      6. primitives → as-is
      7. fallback → `str(obj)`
    """
    # Pydantic v2 has `model_dump`; v1 has `dict()` — try both.
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        try:
            return _normalise_to_plain(obj.model_dump())
        except Exception:  # noqa: BLE001
            pass
    if hasattr(obj, "dict") and callable(obj.dict) and not isinstance(obj, type):
        try:
            return _normalise_to_plain(obj.dict())
        except Exception:  # noqa: BLE001
            pass
    if hasattr(obj, "__dataclass_fields__"):
        return {f: _normalise_to_plain(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, dict):
        return {k: _normalise_to_plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_normalise_to_plain(v) for v in obj]
    if hasattr(obj, "value") and obj.__class__.__module__ != "builtins":
        # Likely a stdlib Enum or similar. Use the `.value` attribute.
        try:
            return obj.value
        except Exception:  # noqa: BLE001
            pass
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)
