"""
UEP DWG extractor — PR3 §3.1.

Wraps the DWG → DXF fallback chain (`dwg_converter`) then delegates
to the existing DxfExtractor. Confidence is downgraded to match the
conversion source (ODA 0.95, LibreDWG 0.80).

Emits `DWG_CONVERSION_FAILED` decode_warning on escalation so the
coverage report consumer can surface the failure to the operator.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §15.1
Reference: docs/tasks/TASK_UEP_PR3.md §3.1
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.models.uep_schemas import ExtractedFact, SourceFormat
from app.services.uep.dwg_converter import (
    ConversionResult,
    convert_dwg_to_dxf,
)
from app.services.uep.dxf_extractor import DxfExtractor
from app.services.uep.extractor_base import BaseExtractor, ExtractorError

logger = logging.getLogger(__name__)


class DwgExtractor(BaseExtractor):
    """Universal DWG extractor.

    The conversion confidence floors the extracted-fact confidence —
    we never report fact confidence > conversion confidence, since any
    fact derived from a converted DXF inherits the conversion fidelity.
    """

    source_format = SourceFormat.DWG
    extractor_id = "uep.dwg_extractor"
    extractor_version = "1.0"
    default_confidence = 0.80  # LibreDWG floor; ODA path bumps higher

    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        decode_warnings: list[dict[str, Any]] = []
        work_dir = Path(self._work_dir_for(path))

        conversion: ConversionResult = convert_dwg_to_dxf(path, work_dir)

        attempts_payload = [
            {
                "tool": a.tool,
                "success": a.success,
                "duration_ms": a.duration_ms,
                "error": a.error,
                "dxf_size_bytes": a.dxf_size_bytes,
            }
            for a in conversion.attempts
        ]

        if not conversion.success or conversion.dxf_path is None:
            # Task constraint: NEVER silent drop. Surface the failure
            # via decode_warnings + extractor_error so the coverage
            # report flags it.
            decode_warnings.append({
                "code": "DWG_CONVERSION_FAILED",
                "message": (
                    "DWG conversion failed via ODA + LibreDWG fallback chain. "
                    "Operator escalation required."
                ),
                "attempts": attempts_payload,
            })
            raise ExtractorError(
                f"DWG_CONVERSION_FAILED: all chain attempts failed for {path.name}"
            )

        # Successful conversion — record the chain trace, then parse
        # the resulting DXF with the existing extractor.
        decode_warnings.append({
            "code": "dwg_converted",
            "message": (
                f"DWG converted via {conversion.source} "
                f"(confidence={conversion.confidence}, "
                f"cache_hit={conversion.cache_hit})"
            ),
            "source": conversion.source,
            "confidence": conversion.confidence,
            "cache_hit": conversion.cache_hit,
            "attempts": attempts_payload,
        })

        dxf_extractor = DxfExtractor()
        # We use the DxfExtractor's public extract() rather than
        # _extract() so it owns the full envelope (timing, fact
        # capture, recovery, etc.). The PerSourceExtraction it
        # returns gets unwrapped here into the (facts, data, warnings)
        # tuple our own _extract signature uses.
        inner = dxf_extractor.extract(conversion.dxf_path)

        if inner.extractor_error:
            # The DXF that came out of conversion was itself broken.
            # Still NOT a silent drop — escalate explicitly.
            decode_warnings.append({
                "code": "dwg_dxf_parse_failed",
                "message": f"converted DXF failed parse: {inner.extractor_error}",
            })
            raise ExtractorError(
                f"DWG converted but DXF parse failed: {inner.extractor_error}"
            )

        # Floor every extracted fact's confidence at the conversion
        # confidence — a fact can't be more reliable than its source.
        capped_facts: list[ExtractedFact] = []
        for f in inner.facts:
            new_conf = min(f.confidence, conversion.confidence)
            if new_conf != f.confidence:
                capped_facts.append(
                    f.model_copy(update={"confidence": new_conf})
                )
            else:
                capped_facts.append(f)

        # Merge the inner DXF decode_warnings into ours (the
        # outer envelope preserves the conversion trace + the
        # downstream parse warnings).
        for w in inner.decode_warnings:
            decode_warnings.append(w)

        # Build the raw_data envelope — preserve everything the DxfExtractor
        # produced + the conversion metadata so audit replay can trace
        # source-of-source-of-source.
        raw_data: dict[str, Any] = dict(inner.data) if inner.data else {}
        raw_data["dwg_conversion"] = {
            "source": conversion.source,
            "confidence": conversion.confidence,
            "cache_hit": conversion.cache_hit,
            "dxf_path": str(conversion.dxf_path),
            "attempts": attempts_payload,
        }

        return capped_facts, raw_data, decode_warnings

    @staticmethod
    def _work_dir_for(dwg_path: Path) -> Path:
        """Default work dir = sibling `_uep_dwg_work/<dwg_stem>/`."""

        return dwg_path.parent / "_uep_dwg_work" / dwg_path.stem
