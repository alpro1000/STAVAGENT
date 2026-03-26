"""
Perplexity Tier 3 Classifier — Web-search-based document verification.

Used when Tiers 1-2 (filename + keywords) fail to classify a document.
Perplexity searches Czech construction norms/standards to identify
unknown document types and suggest appropriate extraction schemas.

Also handles non-construction document summarization.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-26
"""

import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


CLASSIFY_UNKNOWN_PROMPT = """Analyzuj tento úryvek z českého dokumentu a urči:

1. Je to STAVEBNÍ dokument? (technická zpráva, projekt, rozpočet, geologie...)
2. Pokud ANO — jaký typ SO (stavební objekt): most, silnice, vodovod, kanalizace, plynovod, elektro, vegetace, budova, průmysl, jiné
3. Pokud NE — jaký typ: právní_dokument, faktura, korespondence, jiné

ÚRYVEK (prvních 2000 znaků):
{text_snippet}

Název souboru: {filename}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "is_construction": true/false,
  "document_type": "typ",
  "so_type": "most/silnice/vodovod/...",
  "confidence": 0.0-1.0,
  "reasoning": "krátké odůvodnění"
}}"""


SUMMARIZE_NONCONSTRUCTION_PROMPT = """Shrň tento nestavební dokument ve 2-3 větách.
Extrahuj klíčové entity (osoby, firmy, data, částky).

ÚRYVEK:
{text_snippet}

VRAŤ POUZE VALIDNÍ JSON:
{{
  "document_type": "legal/invoice/correspondence/other",
  "title": "název nebo hlavní předmět",
  "summary": "2-3 věty shrnutí",
  "key_entities": ["osoba1", "firma1", ...],
  "dates_found": ["2026-01-15", ...],
  "amounts_found": ["1 250 000 Kč", ...]
}}"""


# Maps Perplexity so_type responses to our params_key
PERPLEXITY_TYPE_TO_PARAMS_KEY = {
    "most": "bridge_params",
    "silnice": "road_params",
    "vodovod": "water_params",
    "kanalizace": "water_params",
    "plynovod": "pipeline_params",
    "elektro": "electro_params",
    "vegetace": "vegetation_params",
    "budova": None,  # Uses generic TechnicalExtraction
    "průmysl": None,
    "DIO": "traffic_params",
    "značení": "signage_params",
}


async def classify_unknown_document(
    filename: str,
    text: str,
    llm_call=None,
) -> Optional[Dict[str, Any]]:
    """
    Tier 3: Use Perplexity (or fallback LLM) to classify an unknown document.

    Args:
        filename: Original filename
        text: Extracted document text
        llm_call: Async callable (prompt) -> dict|None

    Returns:
        Dict with classification result, or None if classification fails.
        {
            "is_construction": bool,
            "document_type": str,
            "so_type": str | None,
            "params_key": str | None,
            "confidence": float,
            "reasoning": str
        }
    """
    if not llm_call or not text:
        return None

    try:
        snippet = text[:2000]
        prompt = CLASSIFY_UNKNOWN_PROMPT.format(
            text_snippet=snippet, filename=filename
        )
        result = await llm_call(prompt)

        if not result or not isinstance(result, dict):
            return None

        # Map so_type to params_key
        so_type = result.get("so_type", "")
        params_key = PERPLEXITY_TYPE_TO_PARAMS_KEY.get(so_type)

        return {
            "is_construction": result.get("is_construction", True),
            "document_type": result.get("document_type", "unknown"),
            "so_type": so_type,
            "params_key": params_key,
            "confidence": result.get("confidence", 0.5),
            "reasoning": result.get("reasoning", ""),
        }

    except Exception as e:
        logger.warning(f"Perplexity classification failed for '{filename}': {e}")
        return None


async def summarize_non_construction(
    text: str,
    llm_call=None,
) -> Optional[Dict[str, Any]]:
    """
    Generate a GenericSummary for a non-construction document.

    Args:
        text: Extracted document text
        llm_call: Async callable (prompt) -> dict|None

    Returns:
        Dict matching GenericSummary schema, or None on failure.
    """
    if not llm_call or not text:
        return None

    try:
        snippet = text[:3000]
        prompt = SUMMARIZE_NONCONSTRUCTION_PROMPT.format(text_snippet=snippet)
        result = await llm_call(prompt)

        if not result or not isinstance(result, dict):
            return None

        return {
            "document_type": result.get("document_type", "other"),
            "title": result.get("title"),
            "summary": result.get("summary"),
            "key_entities": result.get("key_entities", []),
            "dates_found": result.get("dates_found", []),
            "amounts_found": result.get("amounts_found", []),
            "confidence": 0.6,
        }

    except Exception as e:
        logger.warning(f"Non-construction summarization failed: {e}")
        return None
