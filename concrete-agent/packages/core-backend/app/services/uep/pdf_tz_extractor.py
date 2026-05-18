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
        regex_result = extract_from_text(combined_text)

        facts: list[ExtractedFact] = []

        # ------------------------------------------------------------------
        # Concrete specifications.
        # `concrete_specifications` is a list of dicts:
        #   [{class: "C30/37", exposure: ["XC4", "XF1"], context: "..."}]
        # Coverage matrix category: `concrete_grade`.
        # ------------------------------------------------------------------
        for spec in regex_result.get("concrete_specifications", []) or []:
            klass = spec.get("class") or spec.get("concrete_class")
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
                        "raw": spec.get("raw_text") or spec.get("raw") or "",
                        "context": (spec.get("context") or "")[:200],
                    },
                )
            )
            exposure = spec.get("exposure") or []
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
        # Reinforcement.
        # ------------------------------------------------------------------
        for steel in regex_result.get("reinforcement", []) or []:
            grade = steel.get("grade") or steel.get("steel_grade")
            if grade:
                facts.append(
                    ExtractedFact(
                        category="reinforcement",
                        field="steel_grade",
                        value=grade,
                        unit=None,
                        confidence=1.0,
                        evidence={"context": (steel.get("context") or "")[:200]},
                    )
                )

        # ------------------------------------------------------------------
        # Quantities — volume_m3, area_m2, mass_tons.
        # Stored as ExtractedFact category=`quantities` with field=metric name.
        # ------------------------------------------------------------------
        for quantity in regex_result.get("quantities", []) or []:
            metric_type = quantity.get("type") or "unknown"
            value = quantity.get("value")
            if value is None:
                continue
            unit_map = {
                "volume_m3": "m3",
                "area_m2": "m2",
                "mass_tons": "t",
            }
            facts.append(
                ExtractedFact(
                    category="quantities",
                    field=metric_type,
                    value=value,
                    unit=unit_map.get(metric_type),
                    confidence=1.0,
                    evidence={"context": (quantity.get("context") or "")[:200]},
                )
            )

        # ------------------------------------------------------------------
        # Dimensions — thickness, floor counts, building height.
        # ------------------------------------------------------------------
        for dim in regex_result.get("dimensions", []) or []:
            metric_type = dim.get("type") or "unknown"
            value = dim.get("value")
            if value is None:
                continue
            facts.append(
                ExtractedFact(
                    category="dimensions",
                    field=metric_type,
                    value=value,
                    unit=dim.get("unit"),
                    confidence=1.0,
                    evidence={"context": (dim.get("context") or "")[:200]},
                )
            )

        # ------------------------------------------------------------------
        # Special requirements — bílá vana, pohledový beton, vodotěsnost.
        # ------------------------------------------------------------------
        for req in regex_result.get("special_requirements", []) or []:
            req_type = req.get("type") or "unknown"
            facts.append(
                ExtractedFact(
                    category="special_requirements",
                    field=req_type,
                    value=req.get("value") or True,
                    unit=None,
                    confidence=1.0,
                    evidence={"context": (req.get("context") or "")[:200]},
                )
            )

        # ------------------------------------------------------------------
        # Norms (ČSN EN …) — coverage matrix wants citations present.
        # ------------------------------------------------------------------
        for norm in regex_result.get("norms", []) or []:
            facts.append(
                ExtractedFact(
                    category="norm_references",
                    field="citation",
                    value=norm.get("number") or norm.get("value") or "",
                    unit=None,
                    confidence=1.0,
                    evidence={"context": (norm.get("context") or "")[:200]},
                )
            )

        # ------------------------------------------------------------------
        # Identification — investor, project name, etc.
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
        # Drawing references and referenced documents — knowing the
        # drawing inventory the TZ cites helps coverage matrix detect
        # missing drawings.
        # ------------------------------------------------------------------
        for ref in regex_result.get("referenced_documents", []) or []:
            facts.append(
                ExtractedFact(
                    category="referenced_documents",
                    field="document",
                    value=ref if isinstance(ref, str) else (ref.get("name") or str(ref)),
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
            "regex_result": _stringify_dataclasses(regex_result),
        }

        return facts, raw_data, decode_warnings


def _stringify_dataclasses(obj: Any) -> Any:
    """Best-effort coercion of regex_extractor's dataclass outputs to JSON-able
    dicts. `regex_result['drawing_data']` may be a custom dataclass; we
    fall back to str() for any non-serialisable leaf."""
    if hasattr(obj, "dict") and callable(obj.dict):
        try:
            return obj.dict()
        except Exception:  # noqa: BLE001
            pass
    if hasattr(obj, "__dataclass_fields__"):
        return {f: _stringify_dataclasses(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, dict):
        return {k: _stringify_dataclasses(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_stringify_dataclasses(v) for v in obj]
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)
