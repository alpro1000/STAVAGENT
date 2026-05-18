"""
UEP extractor base class — Phase 1 contract.

Every per-format extractor inherits `BaseExtractor` and implements
`_extract(path)` returning `(facts, raw_data, decode_warnings)`. The
base class handles timing, file existence, error capture, and packaging
into a `PerSourceExtraction` record per the universal schema.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.1
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from app.models.uep_schemas import (
    ExtractedFact,
    PerSourceExtraction,
    SourceFormat,
    SourceProvenance,
)

logger = logging.getLogger(__name__)


class ExtractorError(Exception):
    """Raised when an extractor cannot produce any output at all.

    Phase-1 gate must surface this — `extractor_error` field on the
    `PerSourceExtraction` carries the message instead of letting the
    file silently disappear.
    """


class BaseExtractor(ABC):
    """ABC for per-source extractors.

    Subclasses set class attributes `source_format`, `extractor_id`,
    `extractor_version`, `default_confidence`, then implement `_extract`.
    Public entry point is `extract(path)`.
    """

    # Subclass overrides.
    source_format: SourceFormat
    extractor_id: str = "uep.base_extractor"
    extractor_version: str = "1.0"
    default_confidence: float = 1.0

    def extract(self, path: Path) -> PerSourceExtraction:
        """Run the extractor on a single file.

        Returns a `PerSourceExtraction` always — even on failure. The
        `extractor_error` field flags fatal extraction errors so the
        coverage matrix sees the gap explicitly.
        """
        if not path.exists():
            return self._fail(path, f"File not found: {path}")
        if not path.is_file():
            return self._fail(path, f"Not a regular file: {path}")

        start = time.perf_counter()
        try:
            facts, raw_data, decode_warnings = self._extract(path)
        except ExtractorError as exc:
            logger.warning("[%s] fatal extraction error on %s: %s", self.extractor_id, path, exc)
            return self._fail(path, str(exc))
        except Exception as exc:  # noqa: BLE001 — surface unexpected failures, never silent drop
            logger.exception("[%s] unexpected error on %s", self.extractor_id, path)
            return self._fail(path, f"Unexpected error: {exc.__class__.__name__}: {exc}")
        duration_ms = int((time.perf_counter() - start) * 1000)

        # File-level confidence: default per format. Subclasses MAY shave
        # confidence in their `_extract` (we currently don't — that's a
        # PR2 concern when reconciliation lands).
        return PerSourceExtraction(
            provenance=self._provenance(path),
            confidence=self.default_confidence,
            parse_duration_ms=duration_ms,
            facts=facts,
            data=raw_data,
            decode_warnings=decode_warnings,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _provenance(self, path: Path) -> SourceProvenance:
        return SourceProvenance(
            source_file=path.name,
            source_format=self.source_format,
            extractor=self.extractor_id,
            extractor_version=self.extractor_version,
        )

    def _fail(self, path: Path, message: str) -> PerSourceExtraction:
        return PerSourceExtraction(
            provenance=self._provenance(path),
            confidence=0.0,
            parse_duration_ms=0,
            facts=[],
            data={},
            decode_warnings=[],
            extractor_error=message,
        )

    # ------------------------------------------------------------------
    # Subclass hook
    # ------------------------------------------------------------------

    @abstractmethod
    def _extract(
        self, path: Path
    ) -> tuple[list[ExtractedFact], dict[str, Any], list[dict[str, Any]]]:
        """Subclass entry point.

        Return `(facts, raw_data, decode_warnings)`. Raise `ExtractorError`
        for fatal errors. Any other exception is caught by the base class
        and surfaced via `extractor_error` so the gate never sees a silent
        skip.
        """
        raise NotImplementedError
