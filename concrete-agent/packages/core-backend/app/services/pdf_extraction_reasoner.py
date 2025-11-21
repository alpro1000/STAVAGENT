from __future__ import annotations

"""PDF extraction reasoner wiring and runtime orchestration."""

import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.claude_client import ClaudeClient
from app.prompts.pdf_extraction_system_prompt_v2_1 import (
    PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE,
)
from app.services.pdf_text_recovery import PdfRecoverySummary, PdfTextRecovery

DEFAULT_CONFIG_PATH = (
    Path(__file__).resolve().parent.parent.parent / "config" / "pdf_extractor_config.yaml"
)
LEGACY_SYSTEM_PROMPT = "Legacy PDF extraction prompt v1"

logger = logging.getLogger(__name__)

__all__ = ["PDFExtractionReasonerV2_1", "PDFExtractionRuntime", "load_prompt_version"]


@dataclass
class PDFExtractionReasonerV2_1:
    """Reasoner wrapper that injects the appropriate system prompt."""

    claude_client: ClaudeClient
    config_path: Optional[Path] = None

    def __post_init__(self) -> None:
        if self.config_path is None:
            self.config_path = DEFAULT_CONFIG_PATH
        else:
            self.config_path = Path(self.config_path)
        self._cached_prompt_version: Optional[str] = None

    def run(self, document_payload: str, *, temperature: float = 0.2) -> Any:
        """Call Claude with the configured system prompt."""

        system_prompt = self._resolve_system_prompt()
        return self.claude_client.call(
            document_payload,
            system_prompt=system_prompt,
            temperature=temperature,
        )

    def _resolve_system_prompt(self) -> str:
        version = self._get_prompt_version()
        if version == "legacy":
            return LEGACY_SYSTEM_PROMPT
        return PDF_EXTRACTION_SYSTEM_PROMPT_V2_1_COMPLETE or LEGACY_SYSTEM_PROMPT

    def _get_prompt_version(self) -> str:
        if self._cached_prompt_version is not None:
            return self._cached_prompt_version
        version = load_prompt_version(self.config_path)
        self._cached_prompt_version = version
        return version


@dataclass
class PDFExtractionRuntime:
    """High-level orchestrator for the PDF extraction pipeline."""

    reasoner: PDFExtractionReasonerV2_1
    text_recovery: PdfTextRecovery = field(default_factory=PdfTextRecovery)

    async def extract_full(
        self,
        file_path: Path,
        *,
        project_id: str,
        use_ocr: bool = True,
    ) -> Dict[str, Any]:
        recovery = self.text_recovery.recover(file_path, use_ocr=use_ocr)
        prompt_payload = self._build_reasoner_payload(recovery)
        result = await asyncio.to_thread(self.reasoner.run, prompt_payload)

        markers = self._extract_markers(result)
        telemetry = self._build_telemetry(recovery, markers, result)
        logger.info(
            "PDF extraction summary project=%s total_markers=%s unique_categories=%s quality=%s",
            project_id,
            telemetry.get("markers_total", 0),
            telemetry.get("marker_categories", []),
            telemetry.get("quality_score"),
        )

        return {
            "project_id": project_id,
            "summary": result.get("summary") if isinstance(result, dict) else None,
            "markers_preview": markers[:50],
            "telemetry": telemetry,
            "result": result,
        }

    def _build_reasoner_payload(self, recovery: PdfRecoverySummary) -> str:
        sections: List[str] = []

        for page in recovery.pages:
            text = (page.accepted.text or "").strip()
            if not text:
                text = "[EMPTY PAGE - OCR/TRACKING REQUIRED]"
            sections.append(
                "\n".join(
                    [
                        f"### PAGE {page.page_number}",
                        f"# state: {page.state}",
                        text,
                    ]
                )
            )

        return "\n\n".join(sections)

    @staticmethod
    def _extract_markers(result: Any) -> List[Dict[str, Any]]:
        if not isinstance(result, dict):
            return []

        markers = result.get("markers")
        if not isinstance(markers, list):
            return []

        return [marker for marker in markers if isinstance(marker, dict)]

    def _build_telemetry(
        self,
        recovery: PdfRecoverySummary,
        markers: List[Dict[str, Any]],
        result: Any,
    ) -> Dict[str, Any]:
        quality_score = None
        if isinstance(result, dict):
            quality_block = result.get("quality")
            if isinstance(quality_block, dict):
                quality_score = quality_block.get("score")

        category_set = {
            marker.get("category")
            for marker in markers
            if isinstance(marker, dict) and marker.get("category")
        }

        telemetry: Dict[str, Any] = {
            "pages": len(recovery.pages),
            "page_states": recovery.page_state_counters(),
            "used_pdfium": recovery.used_pdfium,
            "used_poppler": recovery.used_poppler,
            "ocr_pages": recovery.queued_ocr_pages,
            "ocr_elapsed_ms": recovery.ocr_elapsed_ms,
            "markers_total": len(markers),
            "marker_categories": sorted(category_set),
            "quality_score": quality_score,
            "recovery": recovery.to_dict(),
        }

        return telemetry


def load_prompt_version(config_path: Path) -> str:
    """Extract the ``prompt_version`` value from the YAML configuration."""

    try:
        raw = config_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "legacy"

    lines = raw.splitlines()
    in_section = False
    section_indent: Optional[int] = None

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip())

        if not in_section:
            if stripped == "pdf_extractor_p1:":
                in_section = True
                section_indent = indent
            continue

        if section_indent is not None and indent <= section_indent:
            break

        if stripped.startswith("prompt_version:"):
            _, value = stripped.split(":", 1)
            value = value.strip()
            if value and value[0] in {'"', "'"} and value[-1] == value[0]:
                value = value[1:-1]
            return value or "legacy"

    return "legacy"
