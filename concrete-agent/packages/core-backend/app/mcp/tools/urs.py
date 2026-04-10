"""
MCP Tool: find_urs_code

Searches for ÚRS catalog codes using:
1. Perplexity web search on urs.cz / podminky.urs.cz
2. URS Matcher Service (if available)

Confidence: 0.80-0.85 (lower than OTSKP because it goes through web search).
Uses the EXISTING PerplexityClient from app.core.perplexity_client.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


async def find_urs_code(
    description: str,
    context: Optional[str] = None,
) -> dict:
    """Find ÚRS catalog codes for a construction work item.

    Searches the ÚRS/RTS pricing system via Perplexity web search on urs.cz
    and the URS Matcher service. AI models do NOT reliably know ÚRS codes —
    this tool searches the real catalog.

    Confidence 0.80-0.85 (lower than OTSKP as it uses web search).

    Args:
        description: Description of construction work in Czech,
                     e.g. 'Zřízení bednění stěn základových zdí jednostranné'
        context: Additional context — building type, material, dimensions
    """
    try:
        results = []

        # ── Method 1: Perplexity search on urs.cz ───────────────────────
        perplexity_results = await _perplexity_urs_search(description, context)
        if perplexity_results:
            results.extend(perplexity_results)

        # ── Method 2: URS Matcher Service (if available) ─────────────────
        matcher_results = await _urs_matcher_search(description)
        if matcher_results:
            # Merge — prefer matcher results (higher confidence)
            existing_codes = {r["code"] for r in results}
            for mr in matcher_results:
                if mr["code"] not in existing_codes:
                    results.append(mr)

        # Sort by confidence
        results.sort(key=lambda x: x.get("confidence", 0), reverse=True)

        return {
            "results": results[:10],
            "total_found": len(results),
            "query": description,
            "context": context,
        }

    except Exception as e:
        logger.error(f"[MCP/URS] Error: {e}")
        return {"error": str(e), "results": [], "total_found": 0}


async def _perplexity_urs_search(description: str, context: Optional[str]) -> list[dict]:
    """Search urs.cz via Perplexity."""
    try:
        from app.core.perplexity_client import PerplexityClient

        client = PerplexityClient()

        query = f"Najdi kód ÚRS pro stavební práci: \"{description}\""
        if context:
            query += f"\nKontext: {context}"
        query += "\nVrať kód ÚRS, název, měrnou jednotku."

        result = await client._search(
            query=query,
            domains=["podminky.urs.cz", "urs.cz", "cenova-soustava.cz"],
        )

        if not result:
            return []

        # Parse response
        text = ""
        if isinstance(result, dict):
            choices = result.get("choices", [])
            if choices:
                text = choices[0].get("message", {}).get("content", "")
        elif isinstance(result, str):
            text = result

        if not text:
            return []

        # Extract URS codes from response text
        import re
        codes = []
        # Pattern: code followed by description
        code_pattern = re.compile(r"(\d{3}[-\s]?\d{2}[-\s]?\d{3,4})")
        for match in code_pattern.finditer(text):
            code = match.group(1).replace(" ", "").replace("-", "")
            codes.append({
                "code": code,
                "description": description,
                "confidence": 0.80,
                "source": "perplexity_urs_search",
            })

        # If no codes extracted, return the raw text as context
        if not codes:
            return [{
                "code": "N/A",
                "description": text[:500],
                "confidence": 0.5,
                "source": "perplexity_urs_search",
                "note": "No specific code extracted — see description for context",
            }]

        return codes[:5]

    except Exception as e:
        logger.warning(f"[MCP/URS] Perplexity unavailable: {e}")
        return []


async def _urs_matcher_search(description: str) -> list[dict]:
    """Call URS Matcher Service if available."""
    try:
        import httpx

        matcher_url = os.getenv(
            "URS_MATCHER_URL",
            "https://urs-matcher-service-1086027517695.europe-west3.run.app",
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{matcher_url}/api/pipeline/match",
                json={
                    "text": description,
                    "topN": 5,
                    "minConfidence": 0.3,
                },
            )
            if resp.status_code != 200:
                return []

            data = resp.json()
            candidates = data.get("data", {}).get("candidates", [])
            return [
                {
                    "code": c.get("code", c.get("urs_code", "")),
                    "description": c.get("name", c.get("urs_name", "")),
                    "unit": c.get("unit", ""),
                    "confidence": c.get("confidence", 0.5),
                    "source": "urs_matcher_service",
                }
                for c in candidates
            ]

    except Exception as e:
        logger.debug(f"[MCP/URS] Matcher service unavailable: {e}")
        return []
