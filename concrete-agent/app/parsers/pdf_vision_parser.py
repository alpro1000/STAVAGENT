"""Claude Vision PDF parser — renders pages to PNG in memory, sends to Claude API."""
from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Optional

from loguru import logger

PROMPT_SMETA_VISION = """
Ты — эксперт по строительным сметам (ЧР/Чехия, каталог ÚRS/KROS).
Из этого изображения страницы сметы извлеки СПИСОК ПОЗИЦИЙ.

Для каждой позиции верни JSON-объект:
{
  "code": "код позиции (например 631311121)",
  "name": "наименование работы",
  "unit": "единица измерения (m, m2, m3, t, kg, h, ks)",
  "quantity": число или null,
  "unit_price": число или null,
  "total_price": число или null
}

Верни ТОЛЬКО валидный JSON массив позиций. Если позиций нет — верни [].
"""

PROMPT_DRAWING_VISION = """
Ты — эксперт по строительным чертежам.
Из этого изображения страницы чертежа извлеки:
1. Размеры конструктивных элементов (длина, ширина, высота, площадь, объём)
2. Наименования элементов
3. Материалы если указаны

Верни JSON массив объектов:
{
  "element": "название элемента",
  "dimensions": {"length": число, "width": число, "height": число},
  "area": число или null,
  "volume": число или null,
  "material": "материал или null",
  "unit": "единица измерения"
}

Верни ТОЛЬКО валидный JSON массив. Если данных нет — верни [].
"""

PROMPT_TZ_VISION = """
Ты — эксперт по строительным техническим заданиям.
Из этого изображения страницы ТЗ извлеки ключевые требования:
- Типы работ
- Материалы и их характеристики
- Технические требования
- Объёмы если указаны

Верни JSON массив объектов:
{
  "section": "раздел или категория",
  "requirement": "текст требования",
  "material": "материал или null",
  "specification": "спецификация или null"
}

Верни ТОЛЬКО валидный JSON массив. Если данных нет — верни [].
"""


class PdfVisionParser:
    """Parse PDF using Claude Vision API (PyMuPDF renders pages to PNG in memory)."""

    MAX_IMAGE_BYTES = 4_500_000  # Claude limit ~5MB, leave margin
    DEFAULT_DPI = 150
    REDUCED_DPI = 96

    def __init__(self, anthropic_api_key: Optional[str] = None) -> None:
        self._api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        if not self._api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for PdfVisionParser")

    def is_scanned_pdf(self, pdf_path: Path) -> bool:
        """Heuristic: if text layer has < 50 chars per page → treat as scanned."""
        try:
            import pdfplumber

            with pdfplumber.open(pdf_path) as pdf:
                total_chars = sum(
                    len(page.extract_text() or "") for page in pdf.pages[:3]
                )
                avg_chars = total_chars / max(len(pdf.pages), 1)
                return avg_chars < 50
        except Exception:
            return True

    def parse(self, pdf_path: Path, doc_type: str = "smeta") -> dict:
        """Render each page to PNG and send to Claude Vision.

        Args:
            pdf_path: Path to PDF file.
            doc_type: One of 'smeta', 'drawing', 'tz'.

        Returns:
            dict with 'positions' list and 'diagnostics' dict.
        """
        try:
            import fitz  # PyMuPDF
        except ImportError as exc:
            raise ImportError("PyMuPDF (fitz) is required: pip install pymupdf") from exc

        try:
            import anthropic
        except ImportError as exc:
            raise ImportError("anthropic is required: pip install anthropic") from exc

        prompt = self._select_prompt(doc_type)
        client = anthropic.Anthropic(api_key=self._api_key)

        all_positions: list = []
        diagnostics = {"pages_processed": 0, "pages_failed": 0, "strategy_used": "vision"}

        try:
            doc = fitz.open(str(pdf_path))
        except Exception as exc:
            logger.error(f"PdfVisionParser: cannot open {pdf_path}: {exc}")
            return {"positions": [], "diagnostics": {**diagnostics, "error": str(exc)}}

        for page_num in range(len(doc)):
            try:
                page_positions = self._process_page(
                    doc=doc,
                    page_num=page_num,
                    client=client,
                    prompt=prompt,
                )
                all_positions.extend(page_positions)
                diagnostics["pages_processed"] += 1
            except Exception as exc:
                logger.warning(f"PdfVisionParser: page {page_num} failed: {exc}")
                diagnostics["pages_failed"] += 1

        doc.close()
        logger.info(
            f"PdfVisionParser: {pdf_path.name} → {len(all_positions)} items "
            f"({diagnostics['pages_processed']} pages OK, {diagnostics['pages_failed']} failed)"
        )
        return {"positions": all_positions, "diagnostics": diagnostics}

    def _process_page(
        self,
        doc,
        page_num: int,
        client,
        prompt: str,
    ) -> list:
        """Render single page and call Claude Vision."""
        import json

        page = doc[page_num]

        # Try normal DPI first, reduce if too large
        png_bytes = self._render_page_to_png(page, dpi=self.DEFAULT_DPI)
        if len(png_bytes) > self.MAX_IMAGE_BYTES:
            png_bytes = self._render_page_to_png(page, dpi=self.REDUCED_DPI)

        image_b64 = base64.standard_b64encode(png_bytes).decode()

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        raw_text = response.content[0].text.strip()
        return self._parse_json_response(raw_text)

    def _render_page_to_png(self, page, dpi: int) -> bytes:
        """Render page to PNG bytes in memory (no disk I/O)."""
        zoom = dpi / 72.0
        matrix = __import__("fitz").Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        return pixmap.tobytes("png")

    def _parse_json_response(self, raw_text: str) -> list:
        """Extract JSON array from Claude response."""
        import json
        import re

        # Try direct parse
        try:
            result = json.loads(raw_text)
            return result if isinstance(result, list) else []
        except json.JSONDecodeError:
            pass

        # Extract from markdown code block
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", raw_text)
        if match:
            try:
                result = json.loads(match.group(1).strip())
                return result if isinstance(result, list) else []
            except json.JSONDecodeError:
                pass

        logger.warning(f"PdfVisionParser: cannot parse JSON from response: {raw_text[:200]}")
        return []

    @staticmethod
    def _select_prompt(doc_type: str) -> str:
        prompts = {
            "smeta": PROMPT_SMETA_VISION,
            "drawing": PROMPT_DRAWING_VISION,
            "tz": PROMPT_TZ_VISION,
        }
        return prompts.get(doc_type, PROMPT_SMETA_VISION)
