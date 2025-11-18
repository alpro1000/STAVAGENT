"""
Specialized parsers for construction documents
БЕЗ CLAUDE FALLBACK - только локальные парсеры

Экспорты:
- SmartParser - умный выбор парсера (рекомендуется!)
- ExcelParser - Excel парсер
- PDFParser - PDF парсер
- KROSParser - KROS XML парсер
- MemoryEfficientExcelParser - streaming Excel
- MemoryEfficientPDFParser - streaming PDF
- MemoryEfficientXMLParser - streaming XML
"""
from app.parsers.smart_parser import SmartParser
from app.parsers.excel_parser import ExcelParser
from app.parsers.pdf_parser import PDFParser
from app.parsers.kros_parser import KROSParser
from app.parsers.memory_efficient import (
    MemoryEfficientExcelParser,
    MemoryEfficientPDFParser,
    MemoryEfficientXMLParser
)

__all__ = [
    # Рекомендуемый - умный выбор парсера
    'SmartParser',
    
    # Стандартные парсеры
    'ExcelParser',
    'PDFParser',
    'KROSParser',
    
    # Memory-efficient парсеры (для больших файлов)
    'MemoryEfficientExcelParser',
    'MemoryEfficientPDFParser',
    'MemoryEfficientXMLParser',
]
