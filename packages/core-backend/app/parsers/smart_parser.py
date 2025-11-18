"""
Smart Parser - автоматический выбор оптимального парсера
БЕЗ CLAUDE FALLBACK - только локальные парсеры

Логика:
- Файл < 20MB → Стандартные парсеры (pandas, pdfplumber)
- Файл > 20MB → Streaming парсеры (memory-efficient)
- Автовыбор формата (Excel, PDF, XML)
"""
import logging
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


class SmartParser:
    """
    Умный парсер - выбирает оптимальную стратегию
    
    Преимущества:
    - Автоматический выбор метода по размеру файла
    - Memory-safe для больших файлов
    - Без Claude fallback = без трат
    - Простой API
    """
    
    def __init__(self):
        # Стандартные парсеры (быстрые, удобные)
        self.excel_parser = ExcelParser()
        self.pdf_parser = PDFParser()
        self.kros_parser = KROSParser()
        
        # Streaming парсеры (экономные по памяти)
        self.streaming_excel = MemoryEfficientExcelParser()
        self.streaming_pdf = MemoryEfficientPDFParser()
        self.streaming_xml = MemoryEfficientXMLParser()
    
    def parse(self, file_path: Path, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Умный парсинг - автоопределение формата и метода
        
        Args:
            file_path: Path to file
            
        Returns:
            Parsed data
        """
        # Определить тип файла
        suffix = file_path.suffix.lower()
        
        if suffix in ['.xlsx', '.xls']:
            return self.parse_excel(file_path, project_id=project_id)
        elif suffix == '.pdf':
            return self.parse_pdf(file_path, project_id=project_id)
        elif suffix == '.xml':
            return self.parse_xml(file_path, project_id=project_id)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")
    
    def parse_excel(self, file_path: Path, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse Excel с автоматическим выбором метода
        
        Args:
            file_path: Path to Excel file
            
        Returns:
            Parsed data
        """
        size_mb = file_path.stat().st_size / (1024 * 1024)
        
        project_prefix = f"[project={project_id}] " if project_id else ""

        logger.info(
            "%s📊 Excel file: %s (%.1fMB)",
            project_prefix,
            file_path.name,
            size_mb,
        )
        
        if size_mb < SIZE_THRESHOLD_MB:
            # Небольшой файл → стандартный парсер
            logger.info("%s✅ Using standard pandas parser", project_prefix)
            try:
                return self.excel_parser.parse(file_path, project_id=project_id)
            except Exception as e:
                logger.warning("%sStandard parser failed: %s", project_prefix, e)
                logger.info("%s⚠️ Falling back to streaming parser", project_prefix)
                return self.streaming_excel.parse(file_path)
        else:
            # Большой файл → streaming парсер
            logger.info("%s✅ Using streaming parser (large file)", project_prefix)
            return self.streaming_excel.parse(file_path)
    
    def parse_pdf(self, file_path: Path, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse PDF с автоматическим выбором метода
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            Parsed data
        """
        size_mb = file_path.stat().st_size / (1024 * 1024)
        
        project_prefix = f"[project={project_id}] " if project_id else ""

        logger.info(
            "%s📄 PDF file: %s (%.1fMB)",
            project_prefix,
            file_path.name,
            size_mb,
        )
        
        if size_mb < SIZE_THRESHOLD_MB:
            # Небольшой файл → стандартный парсер
            logger.info("%s✅ Using standard pdfplumber parser", project_prefix)
            try:
                return self.pdf_parser.parse(file_path)
            except Exception as e:
                logger.warning("%sStandard parser failed: %s", project_prefix, e)
                logger.info("%s⚠️ Falling back to streaming parser", project_prefix)
                return self.streaming_pdf.parse(file_path, max_pages=100)
        else:
            # Большой файл → streaming парсер
            logger.info("%s✅ Using streaming parser (large file)", project_prefix)
            return self.streaming_pdf.parse(file_path, max_pages=100)
    
    def parse_xml(self, file_path: Path, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse XML с автоматическим выбором метода
        
        Args:
            file_path: Path to XML file
            
        Returns:
            Parsed data
        """
        size_mb = file_path.stat().st_size / (1024 * 1024)
        
        project_prefix = f"[project={project_id}] " if project_id else ""

        logger.info(
            "%s📝 XML file: %s (%.1fMB)",
            project_prefix,
            file_path.name,
            size_mb,
        )
        
        if size_mb < SIZE_THRESHOLD_MB:
            # Небольшой файл → стандартный KROS парсер
            logger.info("%s✅ Using standard KROS parser", project_prefix)
            try:
                return self.kros_parser.parse(file_path, project_id=project_id)
            except Exception as e:
                logger.warning("%sStandard parser failed: %s", project_prefix, e)
                logger.info("%s⚠️ Falling back to streaming parser", project_prefix)
                return self.streaming_xml.parse(file_path)
        else:
            # Большой файл → streaming парсер
            logger.info("%s✅ Using streaming parser (large file)", project_prefix)
            return self.streaming_xml.parse(file_path)
    
    def get_file_info(self, file_path: Path) -> Dict[str, Any]:
        """
        Get file information without parsing
        
        Args:
            file_path: Path to file
            
        Returns:
            File info
        """
        size_bytes = file_path.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        
        will_use_streaming = size_mb >= SIZE_THRESHOLD_MB
        
        return {
            "filename": file_path.name,
            "format": file_path.suffix.lower(),
            "size_bytes": size_bytes,
            "size_mb": round(size_mb, 2),
            "will_use_streaming": will_use_streaming,
            "recommended_parser": "streaming" if will_use_streaming else "standard"
        }
