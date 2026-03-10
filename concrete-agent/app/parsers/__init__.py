"""PDF parsers package — export all parser classes."""
from app.parsers.smart_pdf_parser import SmartPdfParser
from app.parsers.pdf_vision_parser import PdfVisionParser
from app.parsers.mineru_parser import MineruParser

try:
    from app.parsers.pdf_parser import PDFParser
except ImportError:
    PDFParser = None  # type: ignore[assignment,misc]

__all__ = [
    "SmartPdfParser",
    "PdfVisionParser",
    "MineruParser",
    "PDFParser",
]
