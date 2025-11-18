"""
Nanonets API Client for document processing
Интеграция с Nanonets для извлечения данных из строительных документов
"""
import requests
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class NanonetsClient:
    """
    Nanonets Document AI для извлечения данных из:
    - Строительных смет
    - Технической документации
    - Сертификатов материалов
    - Актов выполненных работ
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: Nanonets API key (from settings if not provided)
        """
        self.api_key = api_key or settings.NANONETS_API_KEY
        if not self.api_key:
            logger.warning("NANONETS_API_KEY not set. Nanonets integration disabled.")
        
        self.base_url = "https://app.nanonets.com/api/v2"
        self.headers = {
            "Authorization": f"Basic {self.api_key}"
        } if self.api_key else {}
        
        self.available = bool(self.api_key)
    
    def extract_estimate_data(self, file_path: Path) -> Dict[str, Any]:
        """
        Извлечение данных сметы через Nanonets
        
        Args:
            file_path: Path to estimate file (PDF, image, etc.)
            
        Returns:
            Dict with extracted data:
            {
                "positions": List[Dict],
                "totals": Dict,
                "metadata": Dict
            }
        """
        if not self.available:
            raise ValueError("Nanonets API key not configured")
        
        logger.info(f"Extracting estimate data with Nanonets: {file_path}")
        
        try:
            # Upload and process file
            result = self._process_file(file_path, doc_type="estimate")
            
            # Parse result
            positions = self._extract_positions(result)
            totals = self._extract_totals(result)
            
            return {
                "positions": positions,
                "total_positions": len(positions),
                "totals": totals,
                "metadata": result.get("metadata", {}),
                "document_info": {
                    "document_type": "Estimate",
                    "format": "NANONETS_PARSED"
                }
            }
            
        except Exception as e:
            logger.error(f"Nanonets extraction failed: {e}")
            raise
    
    def parse_technical_docs(self, file_path: Path) -> Dict[str, Any]:
        """
        Парсинг технической документации
        
        Args:
            file_path: Path to technical document
            
        Returns:
            Dict with extracted data:
            - Спецификации материалов
            - Требования ČSN
            - Технические условия
        """
        if not self.available:
            raise ValueError("Nanonets API key not configured")
        
        logger.info(f"Parsing technical doc with Nanonets: {file_path}")
        
        try:
            result = self._process_file(file_path, doc_type="technical")
            
            return {
                "specifications": self._extract_specifications(result),
                "standards": self._extract_standards(result),
                "conditions": self._extract_conditions(result),
                "metadata": result.get("metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Nanonets technical doc parsing failed: {e}")
            raise
    
    def extract_drawing_specs(self, file_path: Path) -> Dict[str, Any]:
        """
        Извлечение данных с чертежей
        
        Args:
            file_path: Path to drawing file
            
        Returns:
            Dict with extracted data:
            - Размеры элементов
            - Марки бетона
            - Классы арматуры
        """
        if not self.available:
            raise ValueError("Nanonets API key not configured")
        
        logger.info(f"Extracting drawing specs with Nanonets: {file_path}")
        
        try:
            result = self._process_file(file_path, doc_type="drawing")
            
            return {
                "dimensions": self._extract_dimensions(result),
                "materials": self._extract_materials(result),
                "metadata": result.get("metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Nanonets drawing extraction failed: {e}")
            raise
    
    def _process_file(self, file_path: Path, doc_type: str = "estimate") -> Dict[str, Any]:
        """
        Process file with Nanonets API
        
        Args:
            file_path: Path to file
            doc_type: Type of document (estimate, technical, drawing)
            
        Returns:
            Nanonets API response
        """
        if not self.available:
            raise ValueError("Nanonets API key not configured")
        
        # Nanonets OCR endpoint
        url = f"{self.base_url}/OCR/Model/{self._get_model_id(doc_type)}/LabelFile/"
        
        # Prepare file
        with open(file_path, 'rb') as f:
            files = {'file': f}
            
            # Make request
            response = requests.post(
                url,
                headers=self.headers,
                files=files,
                timeout=60
            )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"✅ Nanonets processed {file_path.name}")
            return result
        else:
            error_msg = f"Nanonets API error: {response.status_code} - {response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
    
    def _get_model_id(self, doc_type: str) -> str:
        """
        Get Nanonets model ID for document type
        
        Note: You need to train and configure models in Nanonets dashboard
        """
        # These are placeholder IDs - replace with your actual model IDs
        model_ids = {
            "estimate": "construction-estimate-v1",
            "technical": "technical-doc-v1",
            "drawing": "construction-drawing-v1"
        }
        
        return model_ids.get(doc_type, "default")
    
    def _extract_positions(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract positions from Nanonets result"""
        positions = []
        
        # Nanonets returns predictions in specific format
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            # Group by position
            # This is simplified - actual implementation depends on your Nanonets model
            if "code" in label.lower():
                positions.append({"code": text})
            elif "description" in label.lower():
                if positions:
                    positions[-1]["description"] = text
            elif "quantity" in label.lower():
                if positions:
                    positions[-1]["quantity"] = self._parse_float(text)
        
        return positions
    
    def _extract_totals(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract total amounts"""
        totals = {}
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            if "total" in label.lower():
                totals["total_amount"] = self._parse_float(text)
        
        return totals
    
    def _extract_specifications(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract material specifications"""
        specs = []
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            if "specification" in label.lower() or "material" in label.lower():
                specs.append({
                    "label": label,
                    "value": text
                })
        
        return specs
    
    def _extract_standards(self, result: Dict[str, Any]) -> List[str]:
        """Extract standards references (ČSN, EN, etc.)"""
        standards = []
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            text = pred.get("ocr_text", "")
            
            # Look for standard patterns
            if "ČSN" in text or "EN" in text or "ISO" in text:
                standards.append(text)
        
        return standards
    
    def _extract_conditions(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract technical conditions"""
        conditions = []
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            if "condition" in label.lower():
                conditions.append({
                    "condition": text
                })
        
        return conditions
    
    def _extract_dimensions(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract dimensions from drawing"""
        dimensions = []
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            if "dimension" in label.lower() or any(c in text for c in ['x', '×', 'mm', 'cm', 'm']):
                dimensions.append({
                    "dimension": text,
                    "label": label
                })
        
        return dimensions
    
    def _extract_materials(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract material specifications from drawing"""
        materials = []
        
        predictions = result.get("result", [{}])[0].get("prediction", [])
        
        for pred in predictions:
            label = pred.get("label", "")
            text = pred.get("ocr_text", "")
            
            if "material" in label.lower() or "beton" in text.lower() or "ocel" in text.lower():
                materials.append({
                    "material": text,
                    "label": label
                })
        
        return materials
    
    def _parse_float(self, text: str) -> float:
        """Parse float from text"""
        try:
            text = text.strip().replace(' ', '').replace(',', '.')
            return float(text)
        except (ValueError, AttributeError):
            return 0.0
