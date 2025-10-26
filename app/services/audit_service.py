"""
Audit Service - HYBRID approach
1. Try local KB first (if available)
2. Fallback to Perplexity API for live data
3. Cache Perplexity results for performance
"""
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.core.config import settings
from app.core.claude_client import ClaudeClient
from app.core.prompt_manager import prompt_manager
from app.core.perplexity_client import get_perplexity_client


class AuditService:
    """
    HYBRID AUDIT service
    - Local KB (fast, offline)
    - Perplexity API (slow, always current)
    - Smart caching
    """
    
    def __init__(self, claude_client: ClaudeClient):
        self.claude = claude_client
        self.config = settings
        self.prompt_manager = prompt_manager
        self.perplexity = get_perplexity_client()
        
        # Load local KB (if exists)
        self.kros_db = self._load_kros_database()
        self.csn_standards = self._load_csn_standards()
        
        # Cache for Perplexity results
        self.perplexity_cache = {}
    
    async def audit_position(
        self,
        position: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None,
        use_live_data: bool = True
    ) -> Dict[str, Any]:
        """
        AUDIT pozice s hybrid approach
        
        Args:
            position: Pozice ze smetá
            project_context: Kontext projektu
            use_live_data: Použít Perplexity pro aktuální data?
        
        Returns:
            Audit result
        """
        
        print(f"   Auditing: {position.get('description', 'N/A')[:50]}...")
        
        # Krok 1: Preliminary classification
        classification = self._classify_position(position)
        
        # Krok 2: Get data (hybrid approach)
        if use_live_data and self.perplexity and settings.ALLOW_WEB_SEARCH:
            print(f"      Using Perplexity for live data...")
            kb_data = await self._get_live_knowledge(position)
        else:
            print(f"      Using local KB...")
            kb_data = self._get_local_knowledge(position)
        
        # Krok 3: Build audit prompt
        audit_prompt = self._build_audit_prompt(
            position=position,
            kb_data=kb_data,
            classification=classification
        )
        
        # Krok 4: Call Claude
        try:
            audit_result = self.claude.call(audit_prompt)
            audit_result["position"] = position
            
            if "status" not in audit_result:
                audit_result["status"] = classification
            
            # Add data source info
            audit_result["data_source"] = kb_data.get("source", "local")
        
        except Exception as e:
            print(f"      ❌ AUDIT failed: {e}")
            audit_result = self._create_error_result(position, str(e))
        
        # Krok 5: HITL check
        audit_result["hitl_required"] = self._requires_hitl(
            audit_result,
            classification
        )
        
        if audit_result["hitl_required"] and "hitl_reason" not in audit_result:
            audit_result["hitl_reason"] = self._get_hitl_reason(audit_result)
        
        return audit_result
    
    async def _get_live_knowledge(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get live data from Perplexity API
        
        Returns:
            {
                "source": "perplexity",
                "kros_data": {...},
                "price_data": {...},
                "standards": [...]
            }
        """
        
        # Check cache first
        cache_key = self._get_cache_key(position)
        if cache_key in self.perplexity_cache:
            print(f"      ✅ Using cached Perplexity data")
            return self.perplexity_cache[cache_key]
        
        try:
            # Get comprehensive verification from Perplexity
            verification = await self.perplexity.verify_position(position)
            
            kb_data = {
                "source": "perplexity",
                "kros_data": verification.get("kros", {}),
                "price_data": verification.get("pricing", {}),
                "standards": verification.get("standards", {}),
                "summary": verification.get("summary", {}),
                "timestamp": self._get_timestamp()
            }
            
            # Cache result
            self.perplexity_cache[cache_key] = kb_data
            
            print(f"      ✅ Live data retrieved from Perplexity")
            return kb_data
        
        except Exception as e:
            print(f"      ⚠️  Perplexity failed, falling back to local KB: {e}")
            return self._get_local_knowledge(position)
    
    def _get_local_knowledge(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """Get data from local KB"""
        
        return {
            "source": "local",
            "kros_data": {
                "database": self.kros_db[:10] if self.kros_db else [],
                "found": len(self.kros_db) > 0
            },
            "price_data": {
                "found": False,
                "note": "Local KB has no pricing data"
            },
            "standards": {
                "standards": self.csn_standards[:5] if self.csn_standards else []
            }
        }
    
    def _build_audit_prompt(
        self,
        position: Dict[str, Any],
        kb_data: Dict[str, Any],
        classification: str
    ) -> str:
        """Build audit prompt with KB data"""
        
        # Get base prompt
        try:
            base_prompt = self.prompt_manager.get_audit_prompt(
                position=position,
                kros_database=None,  # Will add manually
                csn_standards=None,  # Will add manually
                classification=classification
            )
        except FileNotFoundError:
            base_prompt = self._get_fallback_audit_prompt()
        
        # Add KB data
        position_json = json.dumps(position, ensure_ascii=False, indent=2)
        kb_json = json.dumps(kb_data, ensure_ascii=False, indent=2)
        
        full_prompt = f"""{base_prompt}

# CLASSIFICATION: {classification}

# POSITION TO AUDIT:
{position_json}

# KNOWLEDGE BASE DATA:
{kb_json}

# DATA SOURCE: {kb_data.get('source', 'unknown')}

# INSTRUCTIONS:
Based on the knowledge base data above (from {kb_data.get('source')}), perform the audit.
If data source is "perplexity", the information is current (live from web).
If data source is "local", the information may be outdated.

Output must be valid JSON with all required fields.
"""
        
        return full_prompt
    
    def _classify_position(self, position: Dict[str, Any]) -> str:
        """Preliminary classification"""
        
        has_price = position.get("unit_price") is not None
        has_description = bool(position.get("description"))
        has_quantity = position.get("quantity", 0) > 0
        
        if not has_description or not has_quantity:
            return "RED"
        
        if not has_price:
            return "AMBER"
        
        description = position.get("description", "").lower()
        known_keywords = [
            "beton", "zdivo", "výkop", "cihla", "ocel",
            "omítka", "izolace", "dlažba", "obklad"
        ]
        
        has_known_keyword = any(kw in description for kw in known_keywords)
        
        return "GREEN" if has_known_keyword else "AMBER"
    
    def _requires_hitl(
        self,
        result: Dict[str, Any],
        classification: str
    ) -> bool:
        """Check if HITL required"""
        
        if not settings.multi_role.enabled:
            if classification == "RED" or result.get("status") == "RED":
                return True
            return False
        
        # Multi-role HITL triggers
        if classification == "RED" and settings.multi_role.hitl_on_red:
            return True
        
        price_check = result.get("price_check", {})
        price_diff = price_check.get("difference_pct", 0)
        if abs(price_diff) > settings.multi_role.hitl_price_threshold * 100:
            return True
        
        code_match = result.get("code_match", {})
        if code_match.get("confidence", 1.0) < 0.5:
            return True
        
        norm_validation = result.get("norm_validation", {})
        if not norm_validation.get("compliant", True):
            return True
        
        return False
    
    def _get_hitl_reason(self, result: Dict[str, Any]) -> str:
        """Get HITL reason"""
        
        reasons = []
        
        if result.get("status") == "RED":
            reasons.append("RED classification")
        
        price_check = result.get("price_check", {})
        price_diff = price_check.get("difference_pct", 0)
        if abs(price_diff) > 15:
            reasons.append(f"Price difference {price_diff:.1f}%")
        
        code_match = result.get("code_match", {})
        if code_match.get("confidence", 1.0) < 0.5:
            reasons.append("Low code confidence")
        
        norm_validation = result.get("norm_validation", {})
        if not norm_validation.get("compliant", True):
            reasons.append("Norm violations")
        
        return ", ".join(reasons) if reasons else "Manual review recommended"
    
    def _create_error_result(self, position: Dict[str, Any], error: str) -> Dict[str, Any]:
        """Create error result"""
        
        return {
            "position": position,
            "status": "RED",
            "error": error,
            "code_match": {"found": False, "confidence": 0.0},
            "price_check": {"status": "UNKNOWN"},
            "norm_validation": {"compliant": False, "issues": [error]},
            "overall_assessment": {
                "classification": "RED",
                "confidence": 0.0,
                "main_issues": ["AUDIT failed", error]
            },
            "hitl_required": True,
            "hitl_reason": f"AUDIT error: {error}"
        }
    
    def _get_cache_key(self, position: Dict[str, Any]) -> str:
        """Generate cache key for position"""
        
        description = position.get("description", "")
        unit = position.get("unit", "")
        return f"{description[:50]}_{unit}"
    
    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    def _load_kros_database(self) -> List[Dict]:
        """Load local KROS database"""
        
        kros_file = settings.KB_DIR / "B5_URS_KROS4" / "kros_sample.json"
        
        if kros_file.exists():
            with open(kros_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("positions", [])
        
        print("⚠️  KROS database not found, using empty database")
        return []
    
    def _load_csn_standards(self) -> List[Dict]:
        """Load local ČSN standards"""
        
        csn_file = settings.KB_DIR / "B1_Normy_Standardy" / "csn_en_206.json"
        
        if csn_file.exists():
            with open(csn_file, "r", encoding="utf-8") as f:
                return json.load(f)
        
        print("⚠️  ČSN database not found, using empty database")
        return []
    
    def _get_fallback_audit_prompt(self) -> str:
        """Fallback prompt if file not found"""
        
        return """You are auditing a construction position.

Analyze:
1. CODE MATCHING: Find appropriate code
2. PRICE CHECK: Compare with market
3. NORM VALIDATION: Check compliance

Return JSON:
{
  "status": "GREEN|AMBER|RED",
  "code_match": {"found": bool, "confidence": 0.0-1.0},
  "price_check": {"status": "OK|AMBER|RED"},
  "norm_validation": {"compliant": bool},
  "overall_assessment": {"classification": "...", "confidence": 0.0-1.0},
  "hitl_required": bool
}
"""
