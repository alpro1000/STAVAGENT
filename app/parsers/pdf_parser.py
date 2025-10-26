"""
PDF Parser - ИСПРАВЛЕНО
Теперь конвертирует PDF таблицы в стандартный формат positions[]
"""
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import pdfplumber
import re

from app.utils.position_normalizer import normalize_positions

logger = logging.getLogger(__name__)


class PDFParser:
    """Parse construction estimates from PDF files"""
    
    def parse(self, file_path: Path) -> Dict[str, Any]:
        """
        Parse PDF file and extract positions
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            {
                "document_info": {...},
                "positions": [...]
            }
        """
        logger.info(f"📄 Parsing PDF: {file_path.name}")
        
        try:
            positions = []
            
            with pdfplumber.open(file_path) as pdf:
                total_pages = len(pdf.pages)
                logger.info(f"PDF has {total_pages} pages")
                
                # Extract tables from all pages
                for page_num, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables()
                    
                    if tables:
                        logger.info(f"Found {len(tables)} table(s) on page {page_num}")
                        
                        for table_idx, table in enumerate(tables, start=1):
                            logger.debug(
                                f"Processing table {table_idx} on page {page_num} "
                                f"({len(table)} rows)"
                            )
                            
                            # Convert table to positions
                            table_positions = self._table_to_positions(
                                table, 
                                page_num, 
                                table_idx
                            )
                            
                            positions.extend(table_positions)
                            logger.info(
                                f"Extracted {len(table_positions)} positions "
                                f"from table {table_idx} on page {page_num}"
                            )
            
            logger.info(f"Total raw positions extracted: {len(positions)}")

            # Normalize all positions and capture statistics
            normalized_positions, normalization_stats = normalize_positions(
                positions,
                return_stats=True
            )

            logger.info(
                f"✅ PDF parsed: {normalization_stats['normalized_total']} valid positions "
                f"from {total_pages} pages"
            )

            diagnostics = {
                "raw_total": normalization_stats.get("raw_total", len(positions)),
                "normalized_total": normalization_stats.get("normalized_total", len(normalized_positions)),
                "skipped_total": normalization_stats.get("skipped_total", 0),
                "pages_processed": total_pages,
                "normalization": normalization_stats,
            }

            for key in ("format", "evidence", "header_map", "numbers_locale", "positions", "unknown_headers"):
                if key in normalization_stats:
                    diagnostics[key] = normalization_stats[key]

            return {
                "document_info": {
                    "filename": file_path.name,
                    "format": "pdf",
                    "total_pages": total_pages,
                    "tables_found": len(positions)
                },
                "positions": normalized_positions,
                "diagnostics": diagnostics
            }

        except Exception as e:
            logger.error(f"❌ PDF parsing failed: {str(e)}", exc_info=True)
            return {
                "document_info": {
                    "filename": file_path.name,
                    "format": "pdf",
                    "error": str(e)
                },
                "positions": [],
                "diagnostics": {
                    "raw_total": 0,
                    "normalized_total": 0,
                    "skipped_total": 0,
                    "pages_processed": 0
                }
            }
    
    def _table_to_positions(
        self, 
        table: List[List[str]], 
        page_num: int,
        table_idx: int
    ) -> List[Dict[str, Any]]:
        """
        Convert PDF table to list of position dictionaries
        
        Args:
            table: List of table rows (each row is list of cells)
            page_num: Page number for reference
            table_idx: Table index on the page
            
        Returns:
            List of raw position dicts (not normalized yet)
        """
        if not table or len(table) < 2:
            logger.debug("Table too small or empty")
            return []
        
        # First row is usually header
        headers = table[0]
        
        if not headers:
            logger.debug("No headers found in table")
            return []
        
        # Clean and normalize headers
        clean_headers = []
        header_map: Dict[str, str] = {}
        for h in headers:
            if h:
                # Clean header: lowercase, remove special chars
                clean = str(h).lower().strip()
                clean = re.sub(r'[^\w\s]', '', clean)
                clean = re.sub(r'\s+', '_', clean)
                clean_headers.append(clean)
                header_map[clean] = str(h).strip()
            else:
                clean_headers.append(f"col_{len(clean_headers)}")
                header_map[clean_headers[-1]] = clean_headers[-1]
        
        logger.debug(f"Table headers: {clean_headers}")
        
        positions = []
        
        # Process data rows
        for row_idx, row in enumerate(table[1:], start=1):
            if not row or all(not cell for cell in row):
                # Skip empty rows
                continue

            # Create position dict from row
            position = {}
            row_values: List[str] = []
            for col_idx, cell in enumerate(row):
                if col_idx < len(clean_headers):
                    header = clean_headers[col_idx]
                    if cell and str(cell).strip():
                        position[header] = str(cell).strip()
                        row_values.append(str(cell).strip())
                    else:
                        row_values.append("")
                else:
                    row_values.append(str(cell).strip() if cell else "")

            # Skip rows that look like sub-headers or separators
            if self._is_separator_row(position):
                continue

            # Add metadata
            position['_source'] = f"page_{page_num}_table_{table_idx}_row_{row_idx}"
            position['_row_values'] = row_values
            if row_values:
                position['_row_first_value'] = row_values[0]
            if header_map:
                position['_header_map'] = dict(header_map)

            if position:
                positions.append(position)
        
        logger.debug(f"Converted table to {len(positions)} raw positions")
        
        return positions
    
    @staticmethod
    def _is_separator_row(position: Dict[str, Any]) -> bool:
        """
        Check if row is a separator or sub-header
        
        Returns True if row should be skipped
        """
        if not position:
            return True
        
        # Check if all values are short (likely header/separator)
        all_values = ' '.join(str(v) for v in position.values())
        
        # Separators often have repeated characters
        if re.match(r'^[\-\=\*\s]+$', all_values):
            return True
        
        # Very short rows (< 5 chars) are likely not positions
        if len(all_values) < 5:
            return True
        
        return False
    
    def get_supported_extensions(self) -> set:
        """Return supported file extensions"""
        return {'.pdf'}


# ==============================================================================
# USAGE EXAMPLE
# ==============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        pdf_path = Path(sys.argv[1])
        
        parser = PDFParser()
        result = parser.parse(pdf_path)
        
        print(f"\n📊 Parsing Results:")
        print(f"File: {result['document_info']['filename']}")
        print(f"Pages: {result['document_info'].get('total_pages', 0)}")
        print(f"Positions found: {len(result['positions'])}")
        
        if result['positions']:
            print(f"\n📝 First 3 positions:")
            for pos in result['positions'][:3]:
                print(f"\n  Position: {pos.get('position_number', 'N/A')}")
                print(f"  Description: {pos.get('description', 'N/A')[:50]}")
                print(f"  Quantity: {pos.get('quantity', 0)} {pos.get('unit', '')}")
                if 'unit_price' in pos:
                    print(f"  Price: {pos['unit_price']} CZK")
    else:
        print("Usage: python pdf_parser.py <path_to_pdf>")
        print("Example: python pdf_parser.py data/raw/project1/vykresy/estimate.pdf")
