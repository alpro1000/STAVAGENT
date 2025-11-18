"""
MinerU Client for high-quality PDF parsing
Интеграция с MinerU для качественного извлечения данных из PDF
"""
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import json

logger = logging.getLogger(__name__)


class MinerUClient:
    """
    MinerU для высококачественного парсинга PDF
    
    Features:
    - Сохраняет структуру таблиц
    - Извлекает изображения чертежей
    - Распознает формулы и расчеты
    
    Note: This is a stub implementation. MinerU (magic-pdf) needs to be installed:
    pip install magic-pdf
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
        
        # Check if MinerU is available
        self.available = self._check_availability()
    
    def _check_availability(self) -> bool:
        """Check if MinerU is available"""
        try:
            from magic_pdf.api import magic_pdf_parse
            logger.info("✅ MinerU (magic-pdf) is available")
            return True
        except ImportError:
            logger.warning("⚠️  MinerU (magic-pdf) not installed. Install with: pip install magic-pdf")
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
            raise ImportError("MinerU not available. Install with: pip install magic-pdf")
        
        logger.info(f"Parsing PDF with MinerU: {pdf_path}")
        
        try:
            from magic_pdf.api import magic_pdf_parse
            
            # Parse PDF
            result = magic_pdf_parse(
                pdf_path=pdf_path,
                output_dir=str(self.output_dir),
                mode="auto"  # auto, ocr, txt
            )
            
            # Extract tables and positions
            tables = self._extract_estimate_tables(result)
            totals = self._extract_totals(result)
            
            return {
                "positions": tables,
                "total_positions": len(tables),
                "totals": totals,
                "metadata": result.get("metadata", {}),
                "document_info": {
                    "document_type": "PDF Estimate",
                    "format": "PDF_MINERU"
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
            raise ImportError("MinerU not available. Install with: pip install magic-pdf")
        
        logger.info(f"Parsing technical drawing with MinerU: {pdf_path}")
        
        try:
            from magic_pdf.api import magic_pdf_parse
            
            # Parse PDF with OCR for drawings
            result = magic_pdf_parse(
                pdf_path=pdf_path,
                output_dir=str(self.output_dir),
                mode="ocr"  # Force OCR for drawings
            )
            
            # Extract dimensions and specifications
            dimensions = self._extract_dimensions(result)
            materials = self._extract_materials(result)
            
            return {
                "dimensions": dimensions,
                "materials": materials,
                "metadata": result.get("metadata", {}),
                "raw_text": result.get("text", "")[:5000]
            }
            
        except Exception as e:
            logger.error(f"MinerU drawing parsing failed: {e}")
            raise
    
    def _extract_estimate_tables(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract estimate tables from MinerU result
        
        Args:
            result: MinerU parse result
            
        Returns:
            List of position dicts
        """
        tables = result.get("tables", [])
        positions = []
        
        for table_idx, table in enumerate(tables):
            # Table is a 2D list of cells
            if not table or len(table) < 2:
                continue
            
            # First row is header
            header = table[0]
            
            # Parse data rows
            for row_idx, row in enumerate(table[1:], 1):
                position = self._parse_table_row(header, row, table_idx, row_idx)
                if position:
                    positions.append(position)
        
        logger.info(f"Extracted {len(positions)} positions from {len(tables)} tables")
        return positions
    
    def _parse_table_row(self, header: List[str], row: List[str], table_idx: int, row_idx: int) -> Optional[Dict[str, Any]]:
        """Parse a single table row into position dict"""
        if not row:
            return None
        
        # Map header to values
        position = {}
        
        for col_idx, (header_cell, data_cell) in enumerate(zip(header, row)):
            header_lower = str(header_cell).lower()
            
            if 'code' in header_lower or 'kód' in header_lower:
                position['code'] = str(data_cell)
            elif 'description' in header_lower or 'popis' in header_lower:
                position['description'] = str(data_cell)
            elif 'unit' in header_lower or 'mj' in header_lower:
                position['unit'] = str(data_cell)
            elif 'quantity' in header_lower or 'množství' in header_lower:
                position['quantity'] = self._parse_float(str(data_cell))
            elif 'price' in header_lower or 'cena' in header_lower:
                if 'unit' in header_lower:
                    position['unit_price'] = self._parse_float(str(data_cell))
                else:
                    position['total_price'] = self._parse_float(str(data_cell))
        
        # Add metadata
        position['table_index'] = table_idx
        position['row_index'] = row_idx
        
        # Only return if we have description
        if position.get('description'):
            return position
        
        return None
    
    def _extract_totals(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract total amounts from result"""
        # Look for total keywords in text
        text = result.get("text", "")
        totals = {}
        
        # Simple extraction - can be improved
        import re
        total_pattern = r'(?:total|celkem|suma)[:\s]*(\d+[\d\s,\.]*)'
        
        matches = re.findall(total_pattern, text.lower())
        if matches:
            totals['total_amount'] = self._parse_float(matches[0])
        
        return totals
    
    def _extract_dimensions(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dimensions from technical drawing"""
        # Parse text for dimension patterns
        text = result.get("text", "")
        dimensions = []
        
        # Look for dimension patterns like "100 x 200" or "L=500"
        import re
        patterns = [
            r'(\d+[\d\.,]*)\s*x\s*(\d+[\d\.,]*)',  # 100 x 200
            r'([LlBbHh])\s*=\s*(\d+[\d\.,]*)',      # L=500
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                dimensions.append({
                    "raw": match,
                    "type": "dimension"
                })
        
        return dimensions
    
    def _extract_materials(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract material specifications"""
        text = result.get("text", "")
        materials = []
        
        # Look for material keywords
        material_keywords = ['beton', 'concrete', 'C20/25', 'C25/30', 'ocel', 'steel', 'B500']
        
        for keyword in material_keywords:
            if keyword.lower() in text.lower():
                materials.append({
                    "material": keyword,
                    "found": True
                })
        
        return materials
    
    def _parse_float(self, text: str) -> float:
        """Parse float from text"""
        try:
            text = text.strip().replace(' ', '').replace(',', '.')
            return float(text)
        except (ValueError, AttributeError):
            return 0.0
