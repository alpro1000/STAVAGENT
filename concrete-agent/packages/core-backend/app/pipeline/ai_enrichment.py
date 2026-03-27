"""
Layer 4: AI Enrichment — optional LLM analysis on top of regex extraction.

Providers: Gemini Flash (default) → Bedrock Claude Sonnet → Perplexity
NEVER overwrites regex facts (confidence=1.0). AI results have confidence=0.7-0.85.
"""

import json
import logging
from typing import Optional

from .models import DocType, ExtractedData, ExtractedFact, ExtractionSource

logger = logging.getLogger(__name__)

# System prompt template for AI enrichment
ENRICHMENT_PROMPT = """Jsi expert na českou stavební dokumentaci.
Analyzuješ dokument typu: {doc_type}.

Regex extrakce už našla tato data (NEPŘEPISUJ je, mají vyšší spolehlivost):
{regex_summary}

Tvůj úkol:
1. Stručné shrnutí dokumentu (2-3 věty česky)
2. Identifikuj rizika a varování, které regex nemůže zachytit (kontext, logické problémy)
3. Doplň strukturované požadavky

Odpověz POUZE platným JSON:
{{
  "summary": "2-3 věty shrnutí",
  "risks": ["riziko 1", "riziko 2"],
  "requirements": ["požadavek 1", "požadavek 2"],
  "key_parameters": {{"param_name": "value"}}
}}"""


async def enrich_with_ai(
    text: str,
    doc_type: DocType,
    regex_data: ExtractedData,
    provider: str = "gemini",
    max_text_chars: int = 8000,
) -> tuple[Optional[str], list[ExtractedFact]]:
    """
    Call AI to enrich extraction results.

    Returns:
        (ai_summary, additional_facts) — summary string + list of AI-derived facts
    """
    if provider == "none":
        return None, []

    # Build prompt with regex summary
    regex_summary = _summarize_regex_results(regex_data)
    prompt = ENRICHMENT_PROMPT.format(
        doc_type=doc_type.value,
        regex_summary=regex_summary,
    )

    # Truncate text to fit context window
    truncated_text = text[:max_text_chars]
    full_prompt = f"{prompt}\n\n--- DOKUMENT (prvních {len(truncated_text)} znaků) ---\n{truncated_text}"

    # Route to provider
    try:
        if provider == "gemini":
            response_text = await _call_gemini(full_prompt)
        elif provider == "bedrock":
            response_text = await _call_bedrock(full_prompt)
        elif provider == "perplexity":
            response_text = await _call_perplexity(full_prompt)
        else:
            logger.warning(f"[AI Enrichment] Unknown provider: {provider}")
            return None, []

        if not response_text:
            return None, []

        return _parse_ai_response(response_text, provider)

    except Exception as e:
        logger.warning(f"[AI Enrichment] {provider} failed: {e}")
        return None, []


def _summarize_regex_results(data: ExtractedData) -> str:
    """Create concise summary of regex results for AI prompt."""
    parts = []
    if data.identification.stavba:
        parts.append(f"Stavba: {data.identification.stavba}")
    if data.identification.investor:
        parts.append(f"Investor: {data.identification.investor}")
    if data.norms:
        parts.append(f"Normy: {len(data.norms)} nalezeno ({', '.join(n.code for n in data.norms[:5])})")
    if data.facts:
        parts.append(f"Parametry: {len(data.facts)} nalezeno")
        for f in data.facts[:10]:
            parts.append(f"  - {f.name}: {f.value} {f.unit or ''}")
    if data.risks:
        parts.append(f"Rizika: {len(data.risks)} nalezeno")
    if data.materials:
        parts.append(f"Materiály: {', '.join(data.materials[:5])}")
    return "\n".join(parts) if parts else "Žádná regex data"


def _parse_ai_response(
    response_text: str,
    provider: str,
) -> tuple[Optional[str], list[ExtractedFact]]:
    """Parse AI JSON response into summary + facts."""
    # Extract JSON from response
    json_match = None
    for m in [
        # Try to find JSON block
        __import__("re").search(r"\{[\s\S]*\}", response_text),
    ]:
        if m:
            json_match = m
            break

    if not json_match:
        logger.warning("[AI Enrichment] No JSON in response")
        return response_text[:500], []  # Use raw text as summary

    try:
        data = json.loads(json_match.group(0))
    except json.JSONDecodeError:
        logger.warning("[AI Enrichment] Invalid JSON in response")
        return response_text[:500], []

    summary = data.get("summary", "")
    facts: list[ExtractedFact] = []

    source = {
        "gemini": ExtractionSource.AI_GEMINI,
        "bedrock": ExtractionSource.AI_BEDROCK,
        "perplexity": ExtractionSource.AI_PERPLEXITY,
    }.get(provider, ExtractionSource.AI_GEMINI)

    confidence = {"gemini": 0.7, "bedrock": 0.8, "perplexity": 0.85}.get(provider, 0.7)

    # Extract risks as facts
    for risk in data.get("risks", []):
        if isinstance(risk, str) and risk.strip():
            facts.append(ExtractedFact(
                name="ai_risk",
                value=risk.strip(),
                confidence=confidence,
                source=source,
            ))

    # Extract key parameters
    for key, value in data.get("key_parameters", {}).items():
        if value:
            facts.append(ExtractedFact(
                name=f"ai_{key}",
                value=value,
                confidence=confidence,
                source=source,
            ))

    return summary, facts


# ═══════════════════════════════════════════════════════════
#  PROVIDER IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════

async def _call_gemini(prompt: str) -> Optional[str]:
    """Call Gemini Flash via existing PassportEnricher infrastructure."""
    try:
        from app.services.passport_enricher import PassportEnricher
        enricher = PassportEnricher(preferred_model="gemini")
        if enricher.gemini_model:
            response = enricher.gemini_model.generate_content(prompt)
            return response.text if hasattr(response, "text") else str(response)
        if enricher.vertex_gemini_model:
            response = enricher.vertex_gemini_model.generate_content(prompt)
            return response.text if hasattr(response, "text") else str(response)
    except Exception as e:
        logger.warning(f"[Gemini] Call failed: {e}")
    return None


async def _call_bedrock(prompt: str) -> Optional[str]:
    """Call AWS Bedrock Claude Sonnet."""
    try:
        from app.integrations.bedrock_client import BedrockClient
        client = BedrockClient()
        return await client.generate(prompt, max_tokens=2000)
    except ImportError:
        logger.debug("[Bedrock] Client not available")
    except Exception as e:
        logger.warning(f"[Bedrock] Call failed: {e}")
    return None


async def _call_perplexity(prompt: str) -> Optional[str]:
    """Call Perplexity for norm verification."""
    try:
        from app.core.config import settings
        import httpx
        if not getattr(settings, "PERPLEXITY_API_KEY", None):
            return None
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={"Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}"},
                json={
                    "model": "sonar",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"[Perplexity] Call failed: {e}")
    return None
