"""SmartPdfParser — waterfall orchestrator: pdfplumber → Claude Vision → MinerU."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from loguru import logger


class SmartPdfParser:
    """Orchestrate PDF parsing with automatic strategy selection.

    Strategy per doc_type:
        smeta:   pdfplumber → Claude Vision → MinerU (if enabled)
        drawing: Claude Vision directly (pdfplumber useless for drawings)
        tz:      pdfplumber → Claude Vision

    Inject dependencies for testability:
        SmartPdfParser(pdf_parser=mock, vision_parser=mock, mineru_parser=mock)
    """

    MIN_POSITIONS_THRESHOLD = 1  # below this → escalate to next strategy

    def __init__(
        self,
        pdf_parser=None,
        vision_parser=None,
        mineru_parser=None,
    ) -> None:
        self._pdf_parser = pdf_parser or self._create_pdf_parser()
        self._vision_parser = vision_parser or self._create_vision_parser()
        self._mineru_parser = mineru_parser or self._create_mineru_parser()

    def parse(
        self,
        pdf_path: Path,
        doc_type: str = "smeta",
        force_vision: bool = False,
        force_mineru: bool = False,
    ) -> dict:
        """Parse PDF using best available strategy.

        Args:
            pdf_path: Path to PDF file.
            doc_type: 'smeta', 'drawing', or 'tz'.
            force_vision: Skip pdfplumber and go directly to Vision.
            force_mineru: Skip all other strategies and use MinerU.

        Returns:
            dict with 'positions' list and 'diagnostics' dict.
        """
        if not pdf_path.exists():
            logger.error(f"SmartPdfParser: file not found: {pdf_path}")
            return {"positions": [], "diagnostics": {"error": "file_not_found"}}

        logger.info(f"SmartPdfParser: parsing {pdf_path.name} (doc_type={doc_type})")

        if force_mineru:
            # Fix #1: guard against None when MinerU is unavailable
            result = self._try_mineru(pdf_path, doc_type)
            if result is not None:
                return result
            logger.warning("SmartPdfParser: force_mineru requested but MinerU unavailable, falling back")
            return {"positions": [], "diagnostics": {"strategy_used": "mineru", "error": "unavailable"}}

        if force_vision or doc_type == "drawing":
            return self._try_vision(pdf_path, doc_type)

        return self._run_waterfall(pdf_path, doc_type)

    def _run_waterfall(self, pdf_path: Path, doc_type: str) -> dict:
        """Try strategies in order: pdfplumber → Vision → MinerU."""
        # Step 1: pdfplumber
        result = self._try_pdfplumber(pdf_path, doc_type)
        if self._has_enough_positions(result):
            logger.info(f"SmartPdfParser: pdfplumber succeeded for {pdf_path.name}")
            return result

        logger.info(
            f"SmartPdfParser: pdfplumber returned {len(result.get('positions', []))} positions "
            f"for {pdf_path.name}, escalating to Vision"
        )

        # Step 2: Claude Vision
        result = self._try_vision(pdf_path, doc_type)
        if self._has_enough_positions(result):
            logger.info(f"SmartPdfParser: Vision succeeded for {pdf_path.name}")
            return result

        logger.info(
            f"SmartPdfParser: Vision returned {len(result.get('positions', []))} positions "
            f"for {pdf_path.name}, escalating to MinerU"
        )

        # Step 3: MinerU (optional)
        mineru_result = self._try_mineru(pdf_path, doc_type)
        if mineru_result is not None and self._has_enough_positions(mineru_result):
            logger.info(f"SmartPdfParser: MinerU succeeded for {pdf_path.name}")
            return mineru_result

        logger.warning(f"SmartPdfParser: all strategies exhausted for {pdf_path.name}")
        return result  # return Vision result as best effort

    def _try_pdfplumber(self, pdf_path: Path, doc_type: str) -> dict:
        """Parse with pdfplumber (existing PDFParser)."""
        # Fix #2: null check before calling .parse()
        if self._pdf_parser is None:
            logger.warning("SmartPdfParser: PDFParser not available, skipping pdfplumber step")
            return {"positions": [], "diagnostics": {"strategy_used": "pdfplumber", "error": "unavailable"}}
        try:
            result = self._pdf_parser.parse(str(pdf_path))
            positions = result if isinstance(result, list) else result.get("positions", [])
            return {
                "positions": positions,
                "diagnostics": {"strategy_used": "pdfplumber"},
            }
        except Exception as exc:
            logger.warning(f"SmartPdfParser: pdfplumber failed for {pdf_path.name}: {exc}")
            return {"positions": [], "diagnostics": {"strategy_used": "pdfplumber", "error": str(exc)}}

    def _try_vision(self, pdf_path: Path, doc_type: str) -> dict:
        """Parse with Claude Vision."""
        if self._vision_parser is None:
            logger.warning("SmartPdfParser: Vision parser not available (ANTHROPIC_API_KEY missing?)")
            return {"positions": [], "diagnostics": {"strategy_used": "vision", "error": "unavailable"}}
        try:
            return self._vision_parser.parse(pdf_path, doc_type=doc_type)
        except Exception as exc:
            logger.error(f"SmartPdfParser: Vision failed for {pdf_path.name}: {exc}", exc_info=True)
            return {"positions": [], "diagnostics": {"strategy_used": "vision", "error": str(exc)}}

    def _try_mineru(self, pdf_path: Path, doc_type: str) -> Optional[dict]:
        """Parse with MinerU (returns None if unavailable)."""
        if self._mineru_parser is None or not self._mineru_parser.is_available:
            return None
        return self._mineru_parser.parse(pdf_path, doc_type=doc_type)

    def _has_enough_positions(self, result: dict) -> bool:
        """Check if result has at least MIN_POSITIONS_THRESHOLD positions."""
        return len(result.get("positions", [])) >= self.MIN_POSITIONS_THRESHOLD

    @staticmethod
    def _create_pdf_parser():
        """Create default pdfplumber-based parser with graceful fallback."""
        try:
            from app.parsers.pdf_parser import PDFParser

            return PDFParser()
        except ImportError:
            logger.warning("SmartPdfParser: PDFParser not found, pdfplumber step disabled")
            return None

    @staticmethod
    def _create_vision_parser():
        """Create Vision parser if ANTHROPIC_API_KEY is set."""
        import os

        if not os.getenv("ANTHROPIC_API_KEY"):
            logger.warning("SmartPdfParser: ANTHROPIC_API_KEY not set, Vision parser disabled")
            return None
        try:
            from app.parsers.pdf_vision_parser import PdfVisionParser

            return PdfVisionParser()
        except Exception as exc:
            logger.warning(f"SmartPdfParser: cannot create Vision parser: {exc}")
            return None

    @staticmethod
    def _create_mineru_parser():
        """Create MinerU parser (may be disabled via env)."""
        try:
            from app.parsers.mineru_parser import MineruParser

            return MineruParser()
        except Exception as exc:
            logger.warning(f"SmartPdfParser: cannot create MinerU parser: {exc}")
            return None
