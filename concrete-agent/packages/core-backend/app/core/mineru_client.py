"""
MinerU Client for high-quality PDF parsing (v2.x API)
Интеграция с MinerU 2.x для качественного извлечения данных из PDF

Package: mineru[all]>=2.7.0  (formerly magic-pdf)
Docs: https://github.com/opendatalab/MinerU
"""
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import json

logger = logging.getLogger(__name__)


class MinerUClient:
    """
    MinerU 2.x для высококачественного парсинга PDF

    Features:
    - Hybrid backend (VLM + pipeline) — better table/image parsing
    - No pymupdf dependency (removed in v2.0)
    - Built-in small-parameter VLM (<1B) for document understanding

    Install: pip install mineru[all]  (or: uv pip install mineru[all])
    """

    def __init__(self, output_dir: Optional[Path] = None, ocr_engine: str = "paddle"):
        """
        Args:
            output_dir: Directory for temporary files
            ocr_engine: OCR engine to use ('paddle', 'tesseract')
        """
        self.output_dir = output_dir or Path("./temp/mineru")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ocr_engine = ocr_engine

        # Check if MinerU 2.x is available
        self.available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if MinerU 2.x is available"""
        try:
            from mineru.cli import cli  # noqa: F401
            logger.info("MinerU 2.x is available")
            return True
        except ImportError:
            try:
                # Fallback: check CLI binary
                import shutil
                if shutil.which("mineru"):
                    logger.info("MinerU CLI binary found")
                    return True
            except Exception:
                pass
            logger.warning("MinerU not installed. Install with: pip install mineru[all]")
            return False

    def parse_pdf_estimate(self, pdf_path: str) -> Dict[str, Any]:
        """
        Парсинг PDF сметы с сохранением структуры

        Args:
            pdf_path: Path to PDF file

        Returns:
            Dict with parsed data:
            {
                "positions": List[Dict],
                "totals": Dict,
                "metadata": Dict
            }
        """
        if not self.available:
            raise ImportError("MinerU not available. Install with: pip install mineru[all]")

        logger.info(f"Parsing PDF with MinerU 2.x: {pdf_path}")

        try:
            # MinerU 2.x: use CLI subprocess (stable API across versions)
            import subprocess
            import tempfile

            out_dir = Path(tempfile.mkdtemp(dir=str(self.output_dir)))
            cmd = ["mineru", "-p", str(pdf_path), "-o", str(out_dir), "-d", "cpu"]

            result_proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300
            )

            if result_proc.returncode != 0:
                logger.error(f"MinerU failed: {result_proc.stderr[:500]}")
                raise RuntimeError(f"MinerU exit code {result_proc.returncode}")

            # Read output markdown
            md_files = list(out_dir.rglob("*.md"))
            if not md_files:
                return {"positions": [], "totals": {}, "metadata": {}}

            md_content = md_files[0].read_text(encoding="utf-8", errors="replace")

            # Extract tables and positions
            tables = self._extract_estimate_tables_from_md(md_content)
            totals = self._extract_totals_from_text(md_content)

            return {
                "positions": tables,
                "total_positions": len(tables),
                "totals": totals,
                "metadata": {"parser": "mineru-2.x", "backend": "hybrid-auto-engine"},
                "document_info": {
                    "document_type": "PDF Estimate",
                    "format": "PDF_MINERU_V2"
                },
                "sections": []
            }

        except Exception as e:
            logger.error(f"MinerU parsing failed: {e}")
            raise

    def parse_technical_drawings(self, pdf_path: str) -> Dict[str, Any]:
        """
        Парсинг технических чертежей

        Args:
            pdf_path: Path to drawing PDF

        Returns:
            Dict with extracted data:
            - Размеры элементов
            - Спецификации материалов
            - Технические условия
        """
        if not self.available:
            raise ImportError("MinerU not available. Install with: pip install mineru[all]")

        logger.info(f"Parsing technical drawing with MinerU 2.x: {pdf_path}")

        try:
            import subprocess
            import tempfile

            out_dir = Path(tempfile.mkdtemp(dir=str(self.output_dir)))
            cmd = ["mineru", "-p", str(pdf_path), "-o", str(out_dir), "-d", "cpu"]

            result_proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300
            )

            if result_proc.returncode != 0:
                logger.error(f"MinerU failed: {result_proc.stderr[:500]}")
                raise RuntimeError(f"MinerU exit code {result_proc.returncode}")

            md_files = list(out_dir.rglob("*.md"))
            text = md_files[0].read_text(encoding="utf-8", errors="replace") if md_files else ""

            dimensions = self._extract_dimensions(text)
            materials = self._extract_materials(text)

            return {
                "dimensions": dimensions,
                "materials": materials,
                "metadata": {"parser": "mineru-2.x"},
                "raw_text": text[:5000]
            }

        except Exception as e:
            logger.error(f"MinerU drawing parsing failed: {e}")
            raise

    def _extract_estimate_tables_from_md(self, md_content: str) -> List[Dict[str, Any]]:
        """Extract estimate tables from MinerU markdown output"""
        import re

        positions = []

        # MinerU 2.x outputs HTML tables or markdown tables in .md
        rows = re.findall(r"<tr>(.*?)</tr>", md_content, re.DOTALL)
        for row_idx, row in enumerate(rows):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if len(cells) >= 2 and cells[0]:
                position = self._parse_table_cells(cells, row_idx)
                if position:
                    positions.append(position)

        # Also try markdown pipe tables: | col1 | col2 |
        if not positions:
            for line in md_content.split("\n"):
                if "|" in line and not line.strip().startswith("|--"):
                    cells = [c.strip() for c in line.split("|") if c.strip()]
                    if len(cells) >= 2:
                        position = self._parse_table_cells(cells, len(positions))
                        if position:
                            positions.append(position)

        logger.info(f"Extracted {len(positions)} positions from MinerU output")
        return positions

    def _parse_table_cells(self, cells: List[str], row_idx: int) -> Optional[Dict[str, Any]]:
        """Parse table cells into position dict"""
        if not cells or len(cells) < 2:
            return None

        position = {
            "code": cells[0] if len(cells) > 0 else "",
            "description": cells[1] if len(cells) > 1 else "",
            "unit": cells[2] if len(cells) > 2 else "",
            "row_index": row_idx,
        }

        # Try to parse price from last cell
        if len(cells) > 3:
            position["price"] = self._parse_float(cells[-1])

        if position.get("description"):
            return position
        return None

    def _extract_totals_from_text(self, text: str) -> Dict[str, Any]:
        """Extract total amounts from text"""
        import re
        totals = {}
        total_pattern = r'(?:total|celkem|suma)[:\s]*(\d+[\d\s,\.]*)'
        matches = re.findall(total_pattern, text.lower())
        if matches:
            totals['total_amount'] = self._parse_float(matches[0])
        return totals

    def _extract_dimensions(self, text: str) -> List[Dict[str, Any]]:
        """Extract dimensions from technical drawing text"""
        import re
        dimensions = []
        patterns = [
            r'(\d+[\d\.,]*)\s*x\s*(\d+[\d\.,]*)',  # 100 x 200
            r'([LlBbHh])\s*=\s*(\d+[\d\.,]*)',      # L=500
        ]
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                dimensions.append({"raw": match, "type": "dimension"})
        return dimensions

    def _extract_materials(self, text: str) -> List[Dict[str, Any]]:
        """Extract material specifications"""
        materials = []
        material_keywords = ['beton', 'concrete', 'C20/25', 'C25/30', 'ocel', 'steel', 'B500']
        for keyword in material_keywords:
            if keyword.lower() in text.lower():
                materials.append({"material": keyword, "found": True})
        return materials

    def _parse_float(self, text: str) -> float:
        """Parse float from text"""
        try:
            text = text.strip().replace(' ', '').replace(',', '.')
            return float(text)
        except (ValueError, AttributeError):
            return 0.0
