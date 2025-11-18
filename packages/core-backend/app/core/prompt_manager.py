"""
Prompt Manager - загрузка и управление промптами
"""
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.core.config import settings


class PromptManager:
    """Manages loading and formatting prompts"""
    
    def __init__(self):
        self.prompts_dir = settings.PROMPTS_DIR
        self.cache = {}  # Cache loaded prompts
    
    def _load_prompt(self, path: str) -> str:
        """
        Load prompt from file
        
        Args:
            path: Relative path to prompt file (e.g., "claude/parsing/parse_vykaz.txt")
        
        Returns:
            Prompt content
        """
        if path in self.cache:
            return self.cache[path]
        
        full_path = self.prompts_dir / path
        
        if not full_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {full_path}")
        
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        self.cache[path] = content
        return content
    
    def get_parsing_prompt(self, doc_type: str) -> str:
        """
        Get parsing prompt for document type
        
        Args:
            doc_type: Type of document (vykaz, dokumentace, etc.)
        
        Returns:
            Formatted prompt
        """
        prompt_map = {
            "vykaz": "claude/parsing/parse_vykaz_vymer.txt",
            "dokumentace": "claude/parsing/parse_dokumentace.txt",
            "positions": "claude/parsing/extract_positions.txt"
        }
        
        prompt_path = prompt_map.get(doc_type)
        if not prompt_path:
            raise ValueError(f"Unknown document type: {doc_type}")
        
        try:
            return self._load_prompt(prompt_path)
        except FileNotFoundError:
            # Fallback to generic parsing prompt
            return self._get_fallback_parsing_prompt(doc_type)
    
    def get_audit_prompt(
        self,
        position: Dict[str, Any],
        kros_database: Optional[List[Dict]] = None,
        csn_standards: Optional[List[Dict]] = None,
        classification: str = "AMBER"
    ) -> str:
        """
        Get audit prompt for position
        
        Args:
            position: Position data
            kros_database: KROS codes database
            csn_standards: ČSN standards
            classification: GREEN/AMBER/RED
        
        Returns:
            Formatted audit prompt
        """
        try:
            base_prompt = self._load_prompt("claude/audit/audit_position.txt")
        except FileNotFoundError:
            base_prompt = self._get_fallback_audit_prompt()
        
        # Add multi-role if enabled
        if settings.multi_role.enabled:
            try:
                multi_role_prompt = self._load_prompt("claude/audit/multi_role/system.txt")
                base_prompt = f"{base_prompt}\n\n{multi_role_prompt}"
            except FileNotFoundError:
                pass  # Multi-role prompt is optional
        
        # Format with position data
        formatted_prompt = self._format_audit_prompt(
            base_prompt,
            position,
            kros_database,
            csn_standards,
            classification
        )
        
        return formatted_prompt
    
    def get_resource_calculation_prompt(
        self,
        work_type: str,
        position: Dict[str, Any],
        depth: str = "standard"
    ) -> str:
        """
        Get resource calculation prompt
        
        Args:
            work_type: Type of work (concrete, masonry, earthwork, etc.)
            position: Position data
            depth: Depth level (quick, standard, deep)
        
        Returns:
            Formatted prompt
        """
        try:
            # Load master framework
            master = self._load_prompt("resource_calculation/master_framework.txt")
            
            # Load work module
            module_path = f"resource_calculation/modules/{work_type}_work.txt"
            module = self._load_prompt(module_path)
            
            # Combine
            full_prompt = f"{master}\n\n# ACTIVE MODULE: {work_type.upper()}\n\n{module}"
            
            # Add position data
            position_json = json.dumps(position, ensure_ascii=False, indent=2)
            full_prompt += f"\n\n# POSITION TO ANALYZE:\n{position_json}"
            
            # Add depth instruction
            full_prompt += f"\n\n# DEPTH LEVEL: {depth.upper()}"
            
            return full_prompt
        
        except FileNotFoundError as e:
            # Fallback to master framework only
            try:
                return self._load_prompt("resource_calculation/master_framework.txt")
            except FileNotFoundError:
                return self._get_fallback_resource_prompt()
    
    def _format_audit_prompt(
        self,
        base_prompt: str,
        position: Dict[str, Any],
        kros_database: Optional[List[Dict]],
        csn_standards: Optional[List[Dict]],
        classification: str
    ) -> str:
        """Format audit prompt with data"""
        
        # Position data
        position_json = json.dumps(position, ensure_ascii=False, indent=2)
        
        # KROS database
        kros_json = json.dumps(
            kros_database[:10] if kros_database else [],
            ensure_ascii=False,
            indent=2
        )
        
        # ČSN standards
        csn_json = json.dumps(
            csn_standards[:5] if csn_standards else [],
            ensure_ascii=False,
            indent=2
        )
        
        # Build full prompt
        formatted = f"""{base_prompt}

# CLASSIFICATION: {classification}

# POSITION TO AUDIT:
{position_json}

# KROS DATABASE (sample):
{kros_json}

# ČSN STANDARDS (sample):
{csn_json}

# INSTRUCTIONS:
Analyze this position according to the framework above.
Output must be valid JSON with all required fields.
"""
        
        return formatted
    
    def _get_fallback_parsing_prompt(self, doc_type: str) -> str:
        """Fallback parsing prompt if file not found"""
        return f"""You are parsing a Czech construction document of type: {doc_type}

Extract all positions/items with:
- Position number (Poz., Č., #)
- Description (Popis, Název)
- Quantity (Množství)
- Unit (MJ, Jednotka)
- Unit price (Cena/MJ, Jednotková cena)
- Total price (Celkem, Cena celkem)

Return as JSON:
{{
  "total_positions": <number>,
  "positions": [
    {{
      "position_number": "...",
      "description": "...",
      "quantity": <number>,
      "unit": "...",
      "unit_price": <number>,
      "total_price": <number>
    }}
  ]
}}
"""
    
    def _get_fallback_audit_prompt(self) -> str:
        """Fallback audit prompt if file not found"""
        return """You are auditing a construction position from a Czech project.

Analyze:
1. CODE MATCHING: Find appropriate code from KROS/RTS database
2. PRICE CHECK: Compare unit price with market rates
3. NORM VALIDATION: Check ČSN compliance

Return as JSON:
{
  "status": "GREEN|AMBER|RED",
  "code_match": {
    "code": "...",
    "confidence": 0.0-1.0,
    "alternatives": []
  },
  "price_check": {
    "given_price": <number>,
    "market_price": <number>,
    "difference_pct": <number>,
    "status": "OK|HIGH|LOW"
  },
  "norm_validation": {
    "compliant": true|false,
    "standards": [],
    "issues": []
  },
  "recommendations": [],
  "hitl_required": true|false
}
"""
    
    def _get_fallback_resource_prompt(self) -> str:
        """Fallback resource calculation prompt"""
        return """You are calculating resources for a construction work position.

Analyze:
1. WORK TYPE: Classify the work (concrete, masonry, earthwork, etc.)
2. TECHNOLOGY: Determine step-by-step process
3. PRODUCTIVITY: Find rates from knowledge base or estimate
4. RESOURCES: Calculate labor, equipment, materials, time

Return as JSON:
{
  "work_type": "...",
  "technology_steps": [],
  "resources": {
    "labor": [],
    "equipment": [],
    "materials": []
  },
  "total_time_days": <number>,
  "total_cost": <number>,
  "confidence": "HIGH|MEDIUM|LOW"
}
"""


# Global instance
prompt_manager = PromptManager()
