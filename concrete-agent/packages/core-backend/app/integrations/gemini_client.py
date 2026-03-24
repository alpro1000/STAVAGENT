"""
Google Gemini Integration
Использует Free Trial $300 для парсинга PDF и аудита
"""

import os
import base64
from typing import Optional, List, Dict, Any
from pathlib import Path
import google.generativeai as genai

class GeminiClient:
    """
    Google Gemini API для парсинга документов.
    Использует Free Trial $300 (не GenAI кредит).
    
    Преимущества:
    - Бесплатно до 1500 запросов/день (Gemini 1.5 Flash)
    - Поддержка PDF, изображений, видео
    - Контекст до 1M токенов
    """
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not set")
        
        genai.configure(api_key=api_key)
        
        # Gemini 2.5 Flash - быстрая и дешевая модель
        self.model = genai.GenerativeModel('gemini-2.5-flash')

        # Gemini 2.5 Pro - для сложных задач
        self.model_pro = genai.GenerativeModel('gemini-2.5-pro')
    
    async def parse_pdf(
        self,
        file_path: Path,
        prompt: str = "Extract all text, tables, and structure from this document"
    ) -> Dict[str, Any]:
        """
        ⚠️ НЕ РЕКОМЕНДУЕТСЯ: Gemini хуже Claude для строительных документов.
        Используй только для тестирования.
        
        Для production используй Claude Vision в workflow_c.py
        """
        raise NotImplementedError(
            "Gemini парсинг отключен. Используй Claude в workflow_c.py (лучшее качество)"
        )
    
    async def parse_smeta_pdf(self, file_path: Path) -> Dict[str, Any]:
        """
        Специализированный парсинг сметы из PDF.
        """
        
        prompt = """
        Извлеки из этой сметы следующую информацию в формате JSON:
        
        {
          "positions": [
            {
              "code": "код позиции",
              "description": "описание работы",
              "unit": "единица измерения",
              "quantity": число,
              "unit_price": число,
              "total_price": число
            }
          ],
          "summary": {
            "total_cost": число,
            "currency": "CZK"
          }
        }
        
        Если таблица не найдена, верни пустой массив positions.
        """
        
        return await self.parse_pdf(file_path, prompt)
    
    async def parse_drawing_pdf(self, file_path: Path) -> Dict[str, Any]:
        """
        Парсинг чертежа (с Vision).
        """
        
        prompt = """
        Проанализируй этот строительный чертёж и извлеки:
        
        1. Тип конструкции (фундамент, стена, колонна и т.д.)
        2. Размеры (длина, ширина, высота в метрах)
        3. Материалы (бетон, арматура)
        4. Класс бетона (если указан)
        5. Диаметр и шаг арматуры
        
        Верни в формате JSON.
        """
        
        return await self.parse_pdf(file_path, prompt)
    
    async def audit_position(
        self,
        position: Dict[str, Any],
        norm_matches: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Аудит позиции сметы с использованием найденных норм.
        
        Args:
            position: Позиция из сметы
            norm_matches: Совпадающие нормы из Vertex AI Search
        
        Returns:
            {
                "status": "GREEN" | "AMBER" | "RED",
                "confidence": 0.0-1.0,
                "issues": List[str],
                "recommendations": List[str]
            }
        """
        
        prompt = f"""
        Проверь позицию сметы на соответствие нормам:
        
        ПОЗИЦИЯ:
        {position}
        
        НАЙДЕННЫЕ НОРМЫ:
        {norm_matches}
        
        Проверь:
        1. Соответствие единиц измерения
        2. Разницу в ценах (если >10% → RED)
        3. Корректность описания работы
        
        Верни JSON:
        {{
          "status": "GREEN|AMBER|RED",
          "confidence": 0.0-1.0,
          "issues": ["проблема 1", "проблема 2"],
          "recommendations": ["рекомендация 1"]
        }}
        """
        
        response = self.model.generate_content(prompt)
        
        # Parse JSON from response
        import json
        try:
            return json.loads(response.text)
        except:
            return {
                "status": "AMBER",
                "confidence": 0.5,
                "issues": ["Failed to parse audit result"],
                "recommendations": []
            }
    
    def _extract_tables(self, text: str) -> List[Dict]:
        """Extract tables from markdown text"""
        # Simple markdown table parser
        tables = []
        lines = text.split('\n')
        
        current_table = []
        in_table = False
        
        for line in lines:
            if '|' in line:
                if not in_table:
                    in_table = True
                    current_table = []
                current_table.append(line)
            else:
                if in_table and current_table:
                    tables.append(self._parse_markdown_table(current_table))
                    current_table = []
                    in_table = False
        
        return tables
    
    def _parse_markdown_table(self, lines: List[str]) -> Dict:
        """Parse markdown table to dict"""
        if len(lines) < 2:
            return {}
        
        # Header
        headers = [h.strip() for h in lines[0].split('|')[1:-1]]
        
        # Rows (skip separator line)
        rows = []
        for line in lines[2:]:
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if len(cells) == len(headers):
                rows.append(dict(zip(headers, cells)))
        
        return {
            "headers": headers,
            "rows": rows
        }


# Singleton
_gemini_client: Optional[GeminiClient] = None

def get_gemini_client() -> GeminiClient:
    """Get or create Gemini client"""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
