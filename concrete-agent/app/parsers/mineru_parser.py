"""MinerU 2.x wrapper — disabled by default, enabled via ENABLE_MINERU=true env var."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Optional

from loguru import logger

# Dedicated temp base to prevent path traversal via pdf_path.parent (CWE-22)
_MINERU_OUTPUT_BASE = Path(tempfile.gettempdir()) / "mineru_output"


class MineruParser:
    """Parse PDF using MinerU 2.x pipeline.

    Disabled by default. Activate with ENABLE_MINERU=true in .env.
    Requires: pip install 'mineru[pipeline]' --extra-index-url https://download.pytorch.org/whl/cpu
    """

    def __init__(self) -> None:
        self._enabled = os.getenv("ENABLE_MINERU", "false").lower() == "true"
        self._available = False

        if self._enabled:
            self._available = self._check_mineru_installed()
            if not self._available:
                logger.warning(
                    "MineruParser: ENABLE_MINERU=true but mineru is not installed. "
                    "Run: pip install 'mineru[pipeline]' "
                    "--extra-index-url https://download.pytorch.org/whl/cpu"
                )
        else:
            logger.debug("MineruParser: disabled (ENABLE_MINERU != true)")

    @property
    def is_available(self) -> bool:
        """True if MinerU is enabled and installed."""
        return self._enabled and self._available

    def parse(self, pdf_path: Path, doc_type: str = "smeta") -> Optional[dict]:
        """Parse PDF using MinerU pipeline.

        Returns:
            dict with 'positions' and 'diagnostics', or None if unavailable.
        """
        if not self.is_available:
            return None

        try:
            return self._run_mineru_pipeline(pdf_path, doc_type)
        except Exception as exc:
            logger.error(f"MineruParser: failed for {pdf_path.name}: {exc}", exc_info=True)
            return None

    def _run_mineru_pipeline(self, pdf_path: Path, doc_type: str) -> dict:
        """Execute MinerU 2.x pipeline and extract positions."""
        from mineru.data.data_reader_writer import FileBasedDataWriter
        from mineru.utils.enum_class import MinerUFileType
        from mineru.pipe.pipeline import PipelineFactory

        # Fix #4: use dedicated temp dir — prevents CWE-22 path traversal
        # via malicious pdf_path like '../../sensitive/dir/file.pdf'
        output_dir = self._resolve_safe_output_dir(pdf_path)
        output_dir.mkdir(parents=True, exist_ok=True)

        writer = FileBasedDataWriter(str(output_dir))
        pipeline = PipelineFactory.create(file_type=MinerUFileType.PDF)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        result = pipeline.process(pdf_bytes, writer=writer)
        positions = self._extract_positions_from_result(result, doc_type)

        logger.info(f"MineruParser: {pdf_path.name} → {len(positions)} positions")
        return {
            "positions": positions,
            "diagnostics": {"strategy_used": "mineru", "pages_processed": len(result)},
        }

    @staticmethod
    def _resolve_safe_output_dir(pdf_path: Path) -> Path:
        """Return a safe, sandboxed output directory under system temp.

        Uses pdf stem as subdirectory name — path components stripped,
        so '../../etc/passwd' becomes just 'passwd' under /tmp/mineru_output/.
        """
        safe_stem = Path(pdf_path.name).stem  # strips all directory components
        return _MINERU_OUTPUT_BASE / safe_stem

    def _extract_positions_from_result(self, result: list, doc_type: str) -> list:
        """Convert MinerU output blocks to position dicts."""
        positions = []
        for block in result:
            if not isinstance(block, dict):
                continue
            text = block.get("text", "").strip()
            if not text:
                continue
            positions.append(
                {
                    "code": None,
                    "name": text[:200],
                    "unit": None,
                    "quantity": None,
                    "unit_price": None,
                    "total_price": None,
                    "source": "mineru",
                }
            )
        return positions

    @staticmethod
    def _check_mineru_installed() -> bool:
        """Check if mineru package is importable."""
        try:
            import mineru  # noqa: F401

            return True
        except ImportError:
            return False
