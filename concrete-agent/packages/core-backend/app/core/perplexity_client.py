"""
Perplexity API Client for Live Knowledge Base Search
Searches Czech construction norms and codes on real websites
"""
import json
from typing import Optional, List, Dict, Any
import httpx

from app.core.config import settings


class PerplexityClient:
    """
    Wrapper for Perplexity API
    Used for real-time search of KROS codes, prices, and norms
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.PERPLEXITY_API_KEY
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY not found")
        
        self.base_url = "https://api.perplexity.ai"
        self.model = "sonar-pro"  # Best for citations
    
    async def search_kros_code(
        self,
        description: str,
        quantity: Optional[float] = None,
        unit: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for KROS/RTS code on podminky.urs.cz
        
        Args:
            description: Czech description of work
            quantity: Quantity (optional, helps with context)
            unit: Unit (m³, m², etc.)
        
        Returns:
            {
                "found": True/False,
                "codes": [
                    {
                        "code": "121-01-015",
                        "name": "Betonové konstrukce monolitické",
                        "source": "podminky.urs.cz",
                        "url": "https://...",
                        "confidence": 0.95
                    }
                ],
                "raw_response": "..."
            }
        """
        
        # Build search query
        query = self._build_kros_query(description, quantity, unit)
        
        # Search with domain restriction
        result = await self._search(
            query=query,
            domains=["podminky.urs.cz", "urs.cz"],
            search_recency_filter="year"  # Last year for current codes
        )
        
        # Parse results
        return self._parse_kros_response(result)
    
    async def search_market_price(
        self,
        description: str,
        unit: str,
        region: str = "Prague"
    ) -> Dict[str, Any]:
        """
        Search for current market prices
        
        Args:
            description: Work description
            unit: Unit (m³, m², etc.)
            region: Czech region for localized pricing
        
        Returns:
            {
                "found": True/False,
                "price_range": {
                    "min": 2200,
                    "avg": 2450,
                    "max": 2800,
                    "unit": "m³",
                    "currency": "CZK"
                },
                "sources": [...],
                "date": "2025-01"
            }
        """
        
        query = f"""
        Aktuální tržní cena v České republice pro:
        {description}
        Jednotka: {unit}
        Region: {region}
        Hledám průměrnou cenu za jednotku v Kč.
        """
        
        result = await self._search(
            query=query,
            domains=[
                "cenovamapa.cz",
                "stavebnistandardy.cz",
                "cenystavebnichpraci.cz"
            ],
            search_recency_filter="month"  # Last month for current prices
        )
        
        return self._parse_price_response(result)
    
    async def search_csn_standard(
        self,
        work_type: str,
        material: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for relevant ČSN standards
        
        Args:
            work_type: Type of construction work
            material: Material used (concrete, steel, etc.)
        
        Returns:
            {
                "standards": [
                    {
                        "code": "ČSN EN 206",
                        "name": "Beton - Specifikace...",
                        "relevant": True,
                        "requirements": [...]
                    }
                ]
            }
        """
        
        query = f"""
        Které ČSN normy platí pro:
        Typ práce: {work_type}
        {"Materiál: " + material if material else ""}
        Hledám platné české technické normy.
        """
        
        result = await self._search(
            query=query,
            domains=[
                "technicke-normy-csn.cz",
                "csnonline.cz",
                "unmz.cz"
            ]
        )
        
        return self._parse_standard_response(result)
    
    async def verify_position(
        self,
        position: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Comprehensive verification of position using multiple searches
        
        Args:
            position: Position dict with description, quantity, unit, price
        
        Returns:
            Combined verification result
        """
        
        description = position.get("description", "")
        unit = position.get("unit", "")
        given_price = position.get("unit_price")
        
        # Run searches in parallel
        kros_task = self.search_kros_code(description, position.get("quantity"), unit)
        price_task = self.search_market_price(description, unit)
        
        # Get work type for standards
        work_type = self._classify_work_type(description)
        standard_task = self.search_csn_standard(work_type)
        
        # Await all
        import asyncio
        kros_result, price_result, standard_result = await asyncio.gather(
            kros_task,
            price_task,
            standard_task
        )
        
        # Combine
        verification = {
            "kros": kros_result,
            "pricing": price_result,
            "standards": standard_result,
            "summary": self._create_verification_summary(
                kros_result,
                price_result,
                standard_result,
                given_price
            )
        }
        
        return verification
    
    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================
    
    def _build_kros_query(
        self,
        description: str,
        quantity: Optional[float],
        unit: Optional[str]
    ) -> str:
        """Build optimized query for KROS search"""
        
        query = f"""
        Najdi kód KROS nebo ÚRS pro stavební práci:
        "{description}"
        """
        
        if unit:
            query += f"\nJednotka: {unit}"
        
        if quantity:
            query += f"\nMnožství: {quantity} {unit}"
        
        query += "\n\nVrať kód, název, a URL zdroje."
        
        return query
    
    async def _search(
        self,
        query: str,
        domains: Optional[List[str]] = None,
        search_recency_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Core Perplexity API search
        
        Args:
            query: Search query
            domains: List of domains to search (domain-specific search)
            search_recency_filter: "day", "week", "month", "year"
        
        Returns:
            Perplexity API response
        """
        
        # Build request
        messages = [
            {
                "role": "system",
                "content": "You are a precise search assistant for Czech construction data. Always provide citations and URLs."
            },
            {
                "role": "user",
                "content": query
            }
        ]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.0,
            "return_citations": True,
            "return_images": False
        }
        
        # Add domain restriction if provided
        if domains:
            payload["search_domain_filter"] = domains
        
        # Add recency filter
        if search_recency_filter:
            payload["search_recency_filter"] = search_recency_filter
        
        # Call API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )
            
            response.raise_for_status()
            return response.json()
    
    def _parse_kros_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Perplexity response for KROS codes"""
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = response.get("citations", [])
        
        # Extract codes from response
        # This is simplified - in production, use regex or LLM to parse
        codes = []
        
        # Check if response contains code pattern (xxx-xx-xxx)
        import re
        code_pattern = r'\d{3}-\d{2}-\d{3}'
        found_codes = re.findall(code_pattern, content)
        
        for code in found_codes:
            codes.append({
                "code": code,
                "name": "Extracted from search",
                "source": "podminky.urs.cz",
                "confidence": 0.8,
                "raw_context": content[:200]
            })
        
        return {
            "found": len(codes) > 0,
            "codes": codes,
            "raw_response": content,
            "citations": citations
        }
    
    def _parse_price_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse price information from search"""
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = response.get("citations", [])
        
        # Extract prices (simplified)
        import re
        price_pattern = r'(\d+[\s,]?\d*)\s*(?:Kč|CZK)'
        found_prices = re.findall(price_pattern, content.replace(',', ''))
        
        prices = [float(p.replace(' ', '')) for p in found_prices if p]
        
        if prices:
            return {
                "found": True,
                "price_range": {
                    "min": min(prices),
                    "avg": sum(prices) / len(prices),
                    "max": max(prices),
                    "currency": "CZK"
                },
                "sources": citations,
                "raw_response": content
            }
        else:
            return {
                "found": False,
                "price_range": None,
                "raw_response": content
            }
    
    def _parse_standard_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse ČSN standards from search"""
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = response.get("citations", [])
        
        # Extract standard codes
        import re
        standard_pattern = r'ČSN\s+(?:EN\s+)?\d+'
        found_standards = re.findall(standard_pattern, content)
        
        standards = []
        for std in found_standards:
            standards.append({
                "code": std,
                "name": "From search",
                "relevant": True
            })
        
        return {
            "standards": standards,
            "raw_response": content,
            "citations": citations
        }
    
    def _classify_work_type(self, description: str) -> str:
        """Classify work type from description"""
        
        description_lower = description.lower()
        
        if any(kw in description_lower for kw in ["beton", "železobeton"]):
            return "betonové práce"
        elif any(kw in description_lower for kw in ["zdivo", "cihla"]):
            return "zednické práce"
        elif any(kw in description_lower for kw in ["výkop", "terén"]):
            return "zemní práce"
        elif any(kw in description_lower for kw in ["ocel", "konstrukce"]):
            return "ocelové konstrukce"
        else:
            return "obecné stavební práce"
    
    def _create_verification_summary(
        self,
        kros_result: Dict,
        price_result: Dict,
        standard_result: Dict,
        given_price: Optional[float]
    ) -> Dict[str, Any]:
        """Create summary of verification"""
        
        summary = {
            "kros_found": kros_result.get("found", False),
            "price_verified": False,
            "standards_found": len(standard_result.get("standards", [])) > 0,
            "overall_status": "UNKNOWN"
        }
        
        # Check price
        if price_result.get("found") and given_price:
            market_avg = price_result["price_range"]["avg"]
            diff_pct = abs((given_price - market_avg) / market_avg * 100)
            
            summary["price_verified"] = True
            summary["price_difference_pct"] = diff_pct
            
            if diff_pct < 10:
                summary["price_status"] = "GREEN"
            elif diff_pct < 20:
                summary["price_status"] = "AMBER"
            else:
                summary["price_status"] = "RED"
        
        # Overall status
        if summary["kros_found"] and summary["price_verified"]:
            if summary.get("price_status") == "GREEN":
                summary["overall_status"] = "GREEN"
            elif summary.get("price_status") == "AMBER":
                summary["overall_status"] = "AMBER"
            else:
                summary["overall_status"] = "RED"
        else:
            summary["overall_status"] = "AMBER"
        
        return summary


# Global instance
perplexity_client = None

def get_perplexity_client() -> Optional[PerplexityClient]:
    """Get Perplexity client if enabled"""
    global perplexity_client
    
    if settings.ALLOW_WEB_SEARCH and settings.PERPLEXITY_API_KEY:
        if perplexity_client is None:
            perplexity_client = PerplexityClient()
        return perplexity_client
    
    return None
