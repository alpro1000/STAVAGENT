"""
NKB Advisor — Layer 3: AI-powered norm recommendations.

Uses matched rules as context + Gemini/Perplexity for intelligent advice.
Pipeline:
  1. Match norms & rules deterministically (norm_matcher)
  2. Build context prompt from matched rules
  3. Call Gemini for analysis + recommendations
  4. Optionally call Perplexity for web-search supplement (standards updates, best practices)
  5. Return structured AdvisorResponse

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.models.norm_schemas import (
    AdvisorContext,
    AdvisorRecommendation,
    AdvisorResponse,
    NormativeRule,
)
from app.services.norm_matcher import match_norms, match_rules
from app.services.norm_storage import get_norm_store

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System prompt for Gemini advisor
# ---------------------------------------------------------------------------
_ADVISOR_SYSTEM_PROMPT = """Jsi expert na české stavební normy a předpisy (ČSN, TKP, VTP, ZTP, PPK).
Tvým úkolem je poskytnout odborné doporučení na základě:
1. Kontextu projektu (typ stavby, fáze, materiály)
2. Nalezených normativních pravidel (poskytnuty níže)
3. Případného dotazu uživatele

PRAVIDLA:
- Odpovídej česky
- Cituj konkrétní normy a paragrafy
- Rozlišuj povinné požadavky (MUSÍ) a doporučení (MĚLO BY)
- Pokud pravidla mají specifické tolerance/hodnoty, uveď je přesně
- Upozorni na potenciální konflikty mezi normami (např. ZTP vždy přebíjí VTP)
- Priorita: Zákon > Vyhláška > ČSN > TKP > VTP > Metodický pokyn

Odpověz jako JSON:
{
  "analysis": "stručná analýza situace",
  "recommendations": [
    {
      "norm": "označení normy",
      "rule": "název pravidla",
      "text": "konkrétní doporučení",
      "severity": "critical|high|medium|low",
      "applies_to": ["materiál/objekt"]
    }
  ],
  "warnings": ["případná varování o konfliktech nebo neaktuálních normách"]
}"""


_PERPLEXITY_SUPPLEMENT_PROMPT = """Ověř aktuálnost a doplň informace k následujícím českým stavebním normám:
{norms_list}

Kontext: {context}

Odpověz stručně česky:
1. Jsou tyto normy stále platné? (změny po 2024?)
2. Existují novější verze nebo náhrady?
3. Jsou známé změny v praxi nebo interpretaci?
Pokud norma neexistuje nebo ji neznáš, uveď to."""


# ---------------------------------------------------------------------------
# Gemini call
# ---------------------------------------------------------------------------
async def _call_gemini_advisor(prompt: str) -> Optional[Dict[str, Any]]:
    """Call Gemini for norm advisory analysis."""
    try:
        # Try Vertex AI first (free on Cloud Run)
        try:
            from app.core.gemini_client import VertexGeminiClient
            client = VertexGeminiClient()
            response = await client.call(prompt)
            if response:
                return _parse_json_response(response), "vertex-ai-gemini"
        except Exception as e:
            logger.debug(f"[NKB Advisor] Vertex AI failed: {e}")

        # Fallback to Gemini API key
        if settings.GOOGLE_API_KEY:
            from app.core.gemini_client import GeminiClient
            client = GeminiClient()
            response = await client.call(prompt)
            if response:
                return _parse_json_response(response), "gemini-api"

        return None, None
    except Exception as e:
        logger.warning(f"[NKB Advisor] Gemini call failed: {e}")
        return None, None


def _parse_json_response(text: str) -> Optional[Dict]:
    """Extract JSON from LLM response."""
    if not text:
        return None
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting from markdown code block
    import re
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None


# ---------------------------------------------------------------------------
# Perplexity supplement
# ---------------------------------------------------------------------------
async def _call_perplexity_supplement(
    norms: List[str],
    context: str,
) -> Optional[str]:
    """Call Perplexity to verify norm currency and get updates."""
    if not settings.has_perplexity:
        return None

    try:
        import httpx
        prompt = _PERPLEXITY_SUPPLEMENT_PROMPT.format(
            norms_list="\n".join(f"- {n}" for n in norms),
            context=context,
        )
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar-pro",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 2048,
                },
            )
        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            logger.info(f"[NKB Advisor] Perplexity supplement: {len(content)} chars")
            return content
        logger.warning(f"[NKB Advisor] Perplexity HTTP {response.status_code}")
        return None
    except Exception as e:
        logger.warning(f"[NKB Advisor] Perplexity failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Main advisor function
# ---------------------------------------------------------------------------
async def get_advisor_recommendations(
    context: AdvisorContext,
    use_perplexity: bool = True,
) -> AdvisorResponse:
    """
    Get NKB advisor recommendations for a given context.

    Steps:
      1. Match norms & rules
      2. Build prompt with matched rules
      3. Call Gemini for analysis
      4. Call Perplexity for supplement (optional)
      5. Return structured response
    """
    # Step 1: Match norms and rules
    matched_norms = match_norms(
        construction_type=context.construction_type,
        phase=context.phase,
        objects=context.objects,
        materials=context.materials,
        standards_mentioned=context.standards_mentioned,
    )
    norm_ids = [n.norm_id for n in matched_norms]

    matched_rules = match_rules(
        construction_type=context.construction_type,
        phase=context.phase,
        objects=context.objects,
        materials=context.materials,
        norm_ids=norm_ids,
    )

    if not matched_norms and not matched_rules:
        return AdvisorResponse(
            context_summary="Nenalezeny žádné relevantní normy pro daný kontext.",
            matched_norms=0,
            matched_rules=0,
            warnings=["Upřesněte typ stavby, fázi nebo materiály pro lepší výsledky."],
        )

    # Step 2: Build context prompt
    rules_text = _format_rules_for_prompt(matched_rules[:20])  # Top 20 rules
    norms_text = "\n".join(f"- {n.designation}: {n.title}" for n in matched_norms[:15])

    user_prompt = f"""KONTEXT PROJEKTU:
- Typ stavby: {context.construction_type or 'neurčen'}
- Fáze: {context.phase or 'neurčena'}
- Objekty: {', '.join(context.objects) if context.objects else 'neurčeny'}
- Materiály: {', '.join(context.materials) if context.materials else 'neurčeny'}

NALEZENÉ NORMY:
{norms_text}

RELEVANTNÍ PRAVIDLA:
{rules_text}

{f'DOTAZ: {context.question}' if context.question else ''}
{f'TEXT DOKUMENTU (úryvek): {context.document_text[:2000]}' if context.document_text else ''}

Analyzuj a poskytni strukturovaná doporučení."""

    full_prompt = f"{_ADVISOR_SYSTEM_PROMPT}\n\n{user_prompt}"

    # Step 3: Call Gemini
    recommendations: List[AdvisorRecommendation] = []
    ai_analysis = None
    ai_model = None
    warnings: List[str] = []

    result, model_name = await _call_gemini_advisor(full_prompt)
    if result:
        ai_model = model_name
        ai_analysis = result.get("analysis", "")
        for rec in result.get("recommendations", []):
            recommendations.append(AdvisorRecommendation(
                norm_designation=rec.get("norm", ""),
                rule_title=rec.get("rule", ""),
                recommendation=rec.get("text", ""),
                severity=rec.get("severity", "medium"),
                applies_to=rec.get("applies_to", []),
                confidence=0.8,
            ))
        warnings.extend(result.get("warnings", []))

    # Step 4: Perplexity supplement
    perplexity_text = None
    if use_perplexity and matched_norms:
        context_str = f"{context.construction_type or ''} {context.phase or ''} {' '.join(context.materials)}"
        perplexity_text = await _call_perplexity_supplement(
            norms=[n.designation for n in matched_norms[:10]],
            context=context_str,
        )

    # Step 5: Build response
    context_parts = []
    if context.construction_type:
        context_parts.append(f"typ stavby: {context.construction_type}")
    if context.phase:
        context_parts.append(f"fáze: {context.phase}")
    if context.objects:
        context_parts.append(f"objekty: {', '.join(context.objects)}")

    return AdvisorResponse(
        context_summary=f"Analýza pro {', '.join(context_parts) if context_parts else 'obecný kontext'}",
        matched_norms=len(matched_norms),
        matched_rules=len(matched_rules),
        recommendations=recommendations,
        ai_analysis=ai_analysis,
        ai_model_used=ai_model,
        perplexity_supplement=perplexity_text,
        warnings=warnings,
    )


def _format_rules_for_prompt(rules: List[NormativeRule]) -> str:
    """Format rules for LLM prompt."""
    lines = []
    store = get_norm_store()
    for rule in rules:
        norm = store.get_norm(rule.norm_id)
        designation = norm.designation if norm else rule.norm_id
        parts = [f"[{designation}] {rule.title}"]
        if rule.description:
            parts.append(f"  Popis: {rule.description}")
        if rule.parameter:
            val_parts = []
            if rule.min_value is not None:
                val_parts.append(f"min={rule.min_value}")
            if rule.max_value is not None:
                val_parts.append(f"max={rule.max_value}")
            if rule.value:
                val_parts.append(f"hodnota={rule.value}")
            if rule.unit:
                val_parts.append(f"jednotka={rule.unit}")
            parts.append(f"  Parametr: {rule.parameter} ({', '.join(val_parts)})")
        if rule.is_mandatory:
            parts.append(f"  ⚠️ POVINNÉ (priorita {rule.priority})")
        lines.append("\n".join(parts))
    return "\n\n".join(lines)
