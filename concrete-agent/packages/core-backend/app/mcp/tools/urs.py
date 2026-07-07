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

    Searches the ÚRS/RTS pricing system (39,000+ items) via two methods:
    1. Perplexity web search on urs.cz / podminky.urs.cz / cenova-soustava.cz
    2. URS Matcher Service (4-phase matching with 17,904 seed items)

    AI models do NOT reliably know ÚRS codes — this tool searches the real
    catalog. ÚRS codes have format xxx-xx-xxxx (e.g. 273-32-1111).

    Confidence: 0.80-0.85 (lower than OTSKP because web-based search).
    Results are deduplicated across both search methods.

    Use this tool for BUILDING construction (pozemní stavby). For transport
    structures (mosty, silnice), use find_otskp_code instead.

    Args:
        description: Description of construction work in Czech.
            Be specific — include material, method, and element type.
            Examples:
            - 'Zřízení bednění stěn základových zdí jednostranné'
            - 'Betonáž základových desek z betonu C25/30'
            - 'Výztuž stěn z betonářské oceli B500B'
            - 'Montáž a demontáž lešení do 10m'
            - 'Izolace proti vodě svislá, natavená'

        context: Additional context to improve matching precision.
            Examples:
            - 'pozemní stavba, bytový dům, 1.PP'
            - 'výšková budova, 12 pater, ocelový skelet'
            - 'rekonstrukce, bourací práce'

    Each result carries provenance fields (carrier-parity with find_otskp_code):
    ``catalog="urs"``, ``catalog_version`` (honest null — ÚRS web/matcher does not
    report a catalog version, so it is NEVER a constant — Fix 3 lesson), ``unit``,
    ``unit_price_czk`` (honest null — ÚRS is licensed data, often priceless), and
    ``match_kind`` ∈ {``item`` | ``group`` | ``raw_context`` | ``none``}. Both
    search branches stamp ``match_kind`` on EVERY result so the catalog-binding
    adapter derives a status-enum deterministically without sort-sniffing the
    source. The status-enum itself lives in the adapter, NOT here ("tools stay
    dumb"); per design §5.1 ÚRS is never ``exact``.

    Returns (carrier shape — parity with find_otskp_code):
        {
          "results": [
            {"code": "784410010", "description": "Malba dvojnásobná …",
             "unit": "m2", "unit_price_czk": null, "confidence": 0.85,
             "source": "urs_matcher_service", "catalog": "urs",
             "catalog_version": null, "match_kind": "item"},
            ...
          ],
          "total_found": 7,
          "query": "Malba stěn vnitřní 2×",
          "context": "pozemní stavba, byt",
          "catalog": "urs",
          "retrieve_summary": {"perplexity": 3, "matcher": 5, "merged": 7, "kept": 7}
        }
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
            # Catalog marker at the envelope level (parity with OTSKP provenance).
            "catalog": "urs",
            # Retrieve transparency — parity with find_otskp_code.retrieve_summary:
            # how many candidates each method contributed, after merge, and kept.
            "retrieve_summary": {
                "perplexity": len(perplexity_results or []),
                "matcher": len(matcher_results or []),
                "merged": len(results),
                "kept": len(results[:10]),
            },
        }

    except Exception as e:
        logger.error(f"[MCP/URS] Error: {e}")
        return {
            "error": str(e), "results": [], "total_found": 0, "catalog": "urs",
            "retrieve_summary": {"perplexity": 0, "matcher": 0, "merged": 0, "kept": 0},
        }


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
                # unit/price are NOT reported by the web-search branch — honest null.
                "unit": None,
                "unit_price_czk": None,
                "confidence": 0.80,
                "source": "perplexity_urs_search",
                "catalog": "urs",
                # URS web-search does NOT report a catalog version → honest null,
                # never a constant (direct Fix 3 lesson — no hardcoded version).
                "catalog_version": None,
                # A concrete code was extracted → item-level match.
                "match_kind": "item",
                # Web-search result = suggestion to verify in the licensed
                # ÚRS catalog, not a catalog fact.
                "is_web_suggestion": True,
            })

        # If no codes extracted, return the raw text as context
        if not codes:
            return [{
                "code": "N/A",
                "description": text[:500],
                "unit": None,
                "unit_price_czk": None,
                "confidence": 0.5,
                "source": "perplexity_urs_search",
                "catalog": "urs",
                "catalog_version": None,
                # Raw prose, no code — the adapter maps this to not_verified.
                "match_kind": "raw_context",
                "is_web_suggestion": True,
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
                    # Matcher does not return a price — honest null (not 0).
                    "unit_price_czk": c.get("unit_price_czk"),
                    "confidence": c.get("confidence", 0.5),
                    "source": "urs_matcher_service",
                    "catalog": "urs",
                    # Matcher reports no catalog version → honest null (Fix 3).
                    "catalog_version": None,
                    # Matcher candidates are concrete item codes → item-level.
                    "match_kind": "item",
                    # Honest provenance passthrough: web-search-sourced ÚRS
                    # results are suggestions to VERIFY in the licensed
                    # catalog, not catalog facts (matcher sets the flag for
                    # perplexity/brave-sourced candidates).
                    "is_web_suggestion": bool(
                        c.get("is_web_suggestion")
                        or c.get("source") in ("perplexity", "brave_search")
                    ),
                }
                for c in candidates
            ]

    except Exception as e:
        logger.debug(f"[MCP/URS] Matcher service unavailable: {e}")
        return []
