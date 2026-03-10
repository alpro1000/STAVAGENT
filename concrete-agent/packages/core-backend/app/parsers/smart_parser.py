"""
Smart Parser - автоматический выбор оптимального парсера
Waterfall: pdfplumber -> MinerU (async) -> streaming

Логика:
 - PDF < 20MB -> pdfplumber (быстро)
 - PDF без текста (скан) -> MinerU async worker
 - Файл > 20MB -> Streaming парсеры (memory-efficient)
 - Автовыбор формата (Excel, PDF, XML)
"""
import asyncio
import logging
import os
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path
from typing import Dict, Any, Optional

from app.parsers.excel_parser import ExcelParser
from app.parsers.pdf_parser import PDFParser
from app.parsers.kros_parser import KROSParser
from app.parsers.memory_efficient import (
    MemoryEfficientExcelParser,
    MemoryEfficientPDFParser,
    MemoryEfficientXMLParser
)

logger = logging.getLogger(__name__)

# Порог размера файла для переключения на streaming (20MB)
SIZE_THRESHOLD_MB = 20

# MinerU включён только если явно задан в env
ENABLE_MINERU = os.getenv("ENABLE_MINERU", "false").lower() == "true"


def _slugify(text: str) -> str:
    """
    Convert filename stem to ASCII-safe slug.
    Prevents MinerU crash on Windows with diacritics (CWE-22 safe).
    e.g. 'IV MM-Ceník2026' -> 'IV_MM-Cenik2026'
    """
    # Normalize unicode -> decomposed form
    normalized = unicodedata.normalize("NFKD", text)
    # Keep only ASCII, replace spaces with underscore
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    # Replace non-alphanumeric (except - _) with underscore
    safe = re.sub(r"[^\w\-]", "_", ascii_text)
    return safe.strip("_") or "document"


def _get_file_size_mb(file_path: Path) -> float:
    """Return file size in megabytes."""
    return file_path.stat().st_size / (1024 * 1024)


class SmartParser:
    """
    Умный парсер - выбирает оптимальную стратегию.

    Преимущества:
    - Автоматический выбор метода по размеру файла
    - Memory-safe для больших файлов
    - MinerU async worker для сканов (не блокирует event loop)
    - slugify имени файла перед передачей в MinerU
    - UTF-8 при чтении результата MinerU
    """

    def __init__(self):
        # Стандартные парсеры (быстрые, удобные)
        self.excel_parser = ExcelParser()
        self.pdf_parser = PDFParser()
        self.kros_parser = KROSParser()

        # Memory-efficient парсеры (для больших файлов)
        self.memory_excel = MemoryEfficientExcelParser()
        self.memory_pdf = MemoryEfficientPDFParser()
        self.memory_xml = MemoryEfficientXMLParser()

    def parse(self, file_path: str, file_type: Optional[str] = None) -> Dict[str, Any]:
        """Synchronous entry point — delegates to async internally."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        detected_type = file_type or self._detect_type(path)

        if detected_type == "excel":
            return self.parse_excel(path)
        elif detected_type == "xml":
            return self.parse_xml(path)
        else:
            return self.parse_pdf(path)

    def parse_excel(self, path: Path) -> Dict[str, Any]:
        size_mb = _get_file_size_mb(path)
        logger.info(f"SmartParser: Excel {path.name} ({size_mb:.1f}MB)")
        if size_mb > SIZE_THRESHOLD_MB:
            return self.memory_excel.parse(str(path))
        return self.excel_parser.parse(str(path))

    def parse_xml(self, path: Path) -> Dict[str, Any]:
        size_mb = _get_file_size_mb(path)
        logger.info(f"SmartParser: XML {path.name} ({size_mb:.1f}MB)")
        if size_mb > SIZE_THRESHOLD_MB:
            return self.memory_xml.parse(str(path))
        return self.kros_parser.parse(str(path))

    def parse_pdf(self, path: Path) -> Dict[str, Any]:
        """PDF waterfall: pdfplumber -> MinerU async -> streaming."""
        size_mb = _get_file_size_mb(path)
        logger.info(f"SmartParser: PDF {path.name} ({size_mb:.1f}MB)")

        if size_mb > SIZE_THRESHOLD_MB:
            logger.info(f"SmartParser: large PDF, using memory-efficient parser")
            return self.memory_pdf.parse(str(path))

        # Step 1: try pdfplumber
        try:
            result = self.pdf_parser.parse(str(path))
            positions = result if isinstance(result, list) else result.get("positions", [])
            if positions:
                logger.info(f"SmartParser: pdfplumber extracted {len(positions)} positions")
                return {"positions": positions, "strategy": "pdfplumber"}
            logger.info(f"SmartParser: pdfplumber returned 0 positions, trying MinerU")
        except Exception as e:
            logger.warning(f"SmartParser: pdfplumber failed: {e}")

        # Step 2: MinerU async (if enabled)
        if ENABLE_MINERU:
            try:
                mineru_result = asyncio.run(self._parse_with_mineru_async(path))
                if mineru_result and mineru_result.get("positions"):
                    return mineru_result
            except Exception as e:
                logger.warning(f"SmartParser: MinerU failed: {e}")

        # Step 3: fallback streaming
        logger.info(f"SmartParser: fallback to memory-efficient PDF parser")
        return self.memory_pdf.parse(str(path))

    async def _parse_with_mineru_async(self, pdf_path: Path) -> Dict[str, Any]:
        """
        Run MinerU CLI in a subprocess without blocking the event loop.
        - slugify filename to avoid Windows diacritics crash
        - read output with explicit UTF-8 encoding
        """
        # Create safe output dir in system temp
        safe_stem = _slugify(pdf_path.stem)
        output_dir = Path(tempfile.gettempdir()) / "mineru_output" / safe_stem
        output_dir.mkdir(parents=True, exist_ok=True)

        # Copy file with safe name if original has non-ASCII chars
        if safe_stem != pdf_path.stem:
            safe_pdf = output_dir / f"{safe_stem}.pdf"
            import shutil
            shutil.copy2(pdf_path, safe_pdf)
            source_path = safe_pdf
        else:
            source_path = pdf_path

        cmd = [
            "mineru",
            "-p", str(source_path),
            "-o", str(output_dir),
            "-b", "pipeline",
            "-d", "cpu",
        ]

        logger.info(f"SmartParser: running MinerU async: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            err = stderr.decode("utf-8", errors="replace")
            logger.error(f"SmartParser: MinerU exited {proc.returncode}: {err[:500]}")
            return {"positions": [], "strategy": "mineru_failed", "error": err[:200]}

        # Find generated .md file — always in auto/ subdir
        md_files = list(output_dir.rglob("*.md"))
        if not md_files:
            logger.warning(f"SmartParser: MinerU produced no .md file in {output_dir}")
            return {"positions": [], "strategy": "mineru_no_output"}

        # Read with explicit UTF-8 (fixes Windows cp1252 mojibake)
        md_content = md_files[0].read_text(encoding="utf-8", errors="replace")
        positions = self._extract_positions_from_markdown(md_content)

        logger.info(f"SmartParser: MinerU extracted {len(positions)} positions")
        return {
            "positions": positions,
            "strategy": "mineru",
            "md_path": str(md_files[0]),
        }

    def _extract_positions_from_markdown(self, md_content: str) -> list:
        """
        Extract table rows from MinerU markdown output.
        MinerU outputs HTML tables: <table><tr><td>code</td><td>name</td>...<td>price</td></tr></table>
        """
        import re
        positions = []
        # Find all table rows
        rows = re.findall(r"<tr>(.*?)</tr>", md_content, re.DOTALL)
        for row in rows:
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
            # Clean HTML tags from cells
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if len(cells) >= 2 and cells[0]:  # at least code + name
                positions.append({
                    "code": cells[0] if len(cells) > 0 else "",
                    "name": cells[1] if len(cells) > 1 else "",
                    "unit": cells[2] if len(cells) > 2 else "",
                    "price": cells[-1] if len(cells) > 1 else "",
                })
        return positions

    def _detect_type(self, path: Path) -> str:
        """Detect file type from extension."""
        ext = path.suffix.lower()
        if ext in (".xlsx", ".xls", ".xlsm"):
            return "excel"
        elif ext in (".xml",):
            return "xml"
        else:
            return "pdf"

    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """Return file metadata."""
        path = Path(file_path)
        size_mb = _get_file_size_mb(path)
        return {
            "name": path.name,
            "size_mb": round(size_mb, 2),
            "type": self._detect_type(path),
            "strategy": "streaming" if size_mb > SIZE_THRESHOLD_MB else "standard",
            "mineru_enabled": ENABLE_MINERU,
        }
