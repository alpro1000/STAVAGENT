"""
PDF text & table extraction.

Strategy:
  1. pdfplumber — extract text + tables from text-based PDFs
  2. If text quality is poor (< 60% valid chars) — fall back to OCR via pytesseract
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)


def _valid_char_ratio(text: str) -> float:
    """Fraction of text that is standard printable + Czech diacritics."""
    if not text:
        return 0.0
    valid = sum(1 for c in text if c.isprintable() or c in "\n\r\t")
    return valid / len(text)


def extract_text_from_pdf(file_path: Path, *, max_pages: int = 30) -> str:
    """
    Extract full text from a PDF price list.

    Returns concatenated text from all pages (up to *max_pages*).
    Falls back to OCR if pdfplumber yields low-quality output.
    """
    logger.info("Extracting text from %s", file_path.name)
    pages_text: list[str] = []

    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages]):
            text = page.extract_text() or ""
            pages_text.append(text)

    full_text = "\n\n".join(pages_text)

    ratio = _valid_char_ratio(full_text)
    logger.info("Extracted %d chars, valid ratio %.1f%%", len(full_text), ratio * 100)

    if ratio < 0.6 or len(full_text.strip()) < 50:
        logger.warning("Low quality text (%.0f%%), attempting OCR fallback", ratio * 100)
        ocr_text = _ocr_fallback(file_path, max_pages=max_pages)
        if ocr_text and len(ocr_text.strip()) > len(full_text.strip()):
            return ocr_text

    return full_text


def extract_tables_from_pdf(file_path: Path, *, max_pages: int = 30) -> list[list[list[Optional[str]]]]:
    """
    Extract all tables from a PDF.

    Returns list of tables, each table is a list of rows, each row is a list of cell strings.
    """
    all_tables: list[list[list[Optional[str]]]] = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages[:max_pages]:
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)

    logger.info("Extracted %d table(s) from %s", len(all_tables), file_path.name)
    return all_tables


def extract_all(file_path: Path, *, max_pages: int = 30) -> dict:
    """
    Extract both text and tables from a PDF.

    Returns {"text": str, "tables": list[table]}
    """
    text = extract_text_from_pdf(file_path, max_pages=max_pages)
    tables = extract_tables_from_pdf(file_path, max_pages=max_pages)
    return {"text": text, "tables": tables}


def extract_text_from_bytes(data: bytes, *, max_pages: int = 30) -> str:
    """Extract text from in-memory PDF bytes."""
    import io
    pages_text: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            pages_text.append(text)
    return "\n\n".join(pages_text)


# ── OCR fallback ─────────────────────────────────────────────────────────────

def _ocr_fallback(file_path: Path, *, max_pages: int = 10) -> str:
    """
    OCR fallback using pytesseract + pdf2image.
    Returns empty string if dependencies are not installed.
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        logger.warning("OCR dependencies (pytesseract, pdf2image) not installed, skipping OCR")
        return ""

    try:
        images = convert_from_path(str(file_path), last_page=max_pages, dpi=300)
        texts = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang="ces+eng")
            texts.append(text)
            logger.debug("OCR page %d: %d chars", i + 1, len(text))
        return "\n\n".join(texts)
    except Exception as e:
        logger.error("OCR failed: %s", e)
        return ""
