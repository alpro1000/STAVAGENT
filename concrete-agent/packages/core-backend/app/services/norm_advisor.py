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
from typing import Any, Dict, List, Optional, Tuple

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
1. Kontextu projektu (typ stavby, scope, fáze, materiály)
2. Referenčních precedentů z KB B5 (top-3 podobných projektů — pokud poskytnuty)
3. Nalezených normativních pravidel (poskytnuty níže)
4. Případného dotazu uživatele

PRAVIDLA:
- Odpovídej česky
- Cituj konkrétní normy a paragrafy
- Rozlišuj povinné požadavky (MUSÍ) a doporučení (MĚLO BY)
- Pokud pravidla mají specifické tolerance/hodnoty, uveď je přesně
- Upozorni na potenciální konflikty mezi normami (např. ZTP vždy přebíjí VTP)
- Priorita: Zákon > Vyhláška > ČSN > TKP > VTP > Metodický pokyn

POUŽITÍ PRECEDENTŮ (pokud jsou poskytnuty v sekci REFERENČNÍ PRECEDENTY):
- Tvůj výstup MUSÍ být konzistentní s patterny / pásmy poměrů demonstrovanými v top-3
  precedentech (např. ZS poměr, BOZP cena, polír staffing model).
- Cituj konkrétní precedent kdykoli aplikuješ jeho hodnotu (např. "per Kfely I/20 mostovy
  benchmark BOZP 80k" nebo "per Žihle 2062-1 part-time stavbyvedoucí 30k/měs").
- Pokud se odchyluješ od precedentního pásma, explicitně uveď DŮVOD ve `warnings`
  (např. atypický scope, geographic specificita, vendor-driven outlier).
- Když projekt-typ context nemá žádné podobné precedenty (top-3 prázdný), pokračuj jen
  s normami a v `warnings` uveď "Žádné KB precedenty pre daný project_type/scope".

Odpověz jako JSON:
{
  "analysis": "stručná analýza situace + jak precedent shaped doporučení",
  "recommendations": [
    {
      "norm": "označení normy nebo KB:precedent_name",
      "rule": "název pravidla",
      "text": "konkrétní doporučení",
      "severity": "critical|high|medium|low",
      "applies_to": ["materiál/objekt"],
      "precedent_cited": "name z top-3 nebo null"
    }
  ],
  "precedent_alignment": "describe how output aligns to top-3 precedent benchmarks",
  "warnings": ["případná varování o konfliktech, neaktuálních normách, nebo precedent-deviations"]
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
async def _call_gemini_advisor(prompt: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Call Gemini for norm advisory analysis."""
    import time as _time
    logger.info(f"[NKB Advisor] _call_gemini_advisor: prompt={len(prompt)}ch")
    try:
        # Try Vertex AI first (free on Cloud Run)
        try:
            t0 = _time.time()
            from app.core.gemini_client import VertexGeminiClient
            logger.info("[NKB Advisor] Trying Vertex AI Gemini...")
            client = VertexGeminiClient()
            response = client.call(prompt)
            elapsed_ms = int((_time.time() - t0) * 1000)
            if response:
                parsed = _parse_json_response(response)
                if parsed:
                    logger.info(f"[NKB Advisor] ✅ Vertex AI OK: {elapsed_ms}ms, keys={list(parsed.keys()) if isinstance(parsed, dict) else '?'}")
                    return parsed, "vertex-ai-gemini"
                else:
                    logger.warning(f"[NKB Advisor] Vertex AI returned non-JSON: {elapsed_ms}ms")
            else:
                logger.warning(f"[NKB Advisor] Vertex AI returned None: {elapsed_ms}ms")
        except Exception as e:
            logger.warning(f"[NKB Advisor] Vertex AI FAILED: {type(e).__name__}: {e}")

        # Fallback to Gemini API key
        if settings.GOOGLE_API_KEY:
            try:
                t0 = _time.time()
                from app.core.gemini_client import GeminiClient
                logger.info("[NKB Advisor] Falling back to Gemini API key...")
                client = GeminiClient()
                response = client.call(prompt)
                elapsed_ms = int((_time.time() - t0) * 1000)
                if response:
                    parsed = _parse_json_response(response)
                    if parsed:
                        logger.info(f"[NKB Advisor] ✅ Gemini API OK: {elapsed_ms}ms")
                        return parsed, "gemini-api"
            except Exception as e:
                logger.warning(f"[NKB Advisor] Gemini API FAILED: {type(e).__name__}: {e}")
        else:
            logger.warning("[NKB Advisor] No GOOGLE_API_KEY set, cannot fall back to Gemini API")

        logger.error("[NKB Advisor] ❌ No Gemini provider succeeded")
        return None, None
    except Exception as e:
        logger.error(f"[NKB Advisor] Gemini call FAILED: {type(e).__name__}: {e}")
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
    use_precedents: bool = True,
    precedent_top_k: int = 3,
) -> AdvisorResponse:
    """
    Get NKB advisor recommendations for a given context.

    Steps:
      1. Match norms & rules deterministically
      2. Retrieve top-K KB B5 precedents (project_type + scope_range similarity)
      3. Build prompt: norms + matched rules + few-shot precedent block
      4. Call Gemini for analysis (instructed to align output to precedents)
      5. Call Perplexity for supplement (optional)
      6. Return structured response

    Args:
      context: AdvisorContext with project_type + scope_kc_bez_dph + scope_range
        used for precedent matching. Falls back to construction_type if
        project_type omitted.
      use_perplexity: enable Perplexity supplemental web-search.
      use_precedents: enable KB B5 precedent retrieval + few-shot injection.
      precedent_top_k: how many precedents to inject (default 3).
    """
    # Auto-derive scope_range from scope_kc_bez_dph if needed
    if context.scope_range is None and context.scope_kc_bez_dph is not None:
        from app.services.precedent_retriever import derive_scope_range
        context.scope_range = derive_scope_range(context.scope_kc_bez_dph)

    logger.info(
        f"[NKB Advisor] get_advisor_recommendations: "
        f"construction_type={context.construction_type!r}, project_type={context.project_type!r}, "
        f"scope_range={context.scope_range!r}, scope_kc={context.scope_kc_bez_dph!r}, "
        f"phase={context.phase!r}, materials={context.materials}, "
        f"question={context.question[:80] if context.question else 'none'}..."
    )

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

    # Step 2: Retrieve top-K precedents from KB B5 (real_world_examples + ZS_templates)
    precedents = []
    precedents_block = ""
    if use_precedents:
        try:
            from app.services.precedent_retriever import (
                retrieve_precedents,
                format_precedents_for_prompt,
            )
            precedents = retrieve_precedents(context, top_k=precedent_top_k)
            precedents_block = format_precedents_for_prompt(precedents)
            logger.info(
                f"[NKB Advisor] precedents retrieved: {len(precedents)} "
                f"(top scores={[p.score for p in precedents]})"
            )
        except Exception as e:
            logger.warning(
                f"[NKB Advisor] precedent retrieval failed: {type(e).__name__}: {e}"
            )

    # Step 3: Build context prompt
    rules_text = _format_rules_for_prompt(matched_rules[:20])  # Top 20 rules
    norms_text = "\n".join(f"- {n.designation}: {n.title}" for n in matched_norms[:15])

    scope_str = (
        f"{context.scope_kc_bez_dph:,.0f} Kč bez DPH"
        if context.scope_kc_bez_dph else "neurčen"
    )
    if context.scope_range:
        scope_str += f" (bucket: {context.scope_range})"
    project_type_str = context.project_type or context.construction_type or "neurčen"
    duration_str = (
        f"{context.duration_mes:.0f} měs" if context.duration_mes else "neurčena"
    )

    user_prompt = f"""KONTEXT PROJEKTU:
- Project type (KB matching): {project_type_str}
- Construction type (legacy): {context.construction_type or 'neurčen'}
- Scope: {scope_str}
- Duration: {duration_str}
- Fáze: {context.phase or 'neurčena'}
- Objekty: {', '.join(context.objects) if context.objects else 'neurčeny'}
- Materiály: {', '.join(context.materials) if context.materials else 'neurčeny'}

{precedents_block}

NALEZENÉ NORMY:
{norms_text}

RELEVANTNÍ PRAVIDLA:
{rules_text}

{f'DOTAZ: {context.question}' if context.question else ''}
{f'TEXT DOKUMENTU (úryvek): {context.document_text[:2000]}' if context.document_text else ''}

Analyzuj a poskytni strukturovaná doporučení. Pokud byly poskytnuty REFERENČNÍ PRECEDENTY,
align tvůj výstup k jejich pásmům a explicitně cituj precedent_name v polích recommendations.precedent_cited."""

    full_prompt = f"{_ADVISOR_SYSTEM_PROMPT}\n\n{user_prompt}"

    # Step 4: Call Gemini
    recommendations: List[AdvisorRecommendation] = []
    ai_analysis = None
    ai_model = None
    warnings: List[str] = []
    precedent_alignment: Optional[str] = None

    result, model_name = await _call_gemini_advisor(full_prompt)
    if result:
        ai_model = model_name
        ai_analysis = result.get("analysis", "")
        precedent_alignment = result.get("precedent_alignment")
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

    # Note when precedents requested but none found — surfaced to caller as warning
    if use_precedents and not precedents:
        warnings.append(
            "Žádné KB precedenty pre daný project_type/scope. "
            "Doporučení odvozeno pouze z norem; align-to-precedent step skipped."
        )

    # Step 5: Perplexity supplement
    perplexity_text = None
    if use_perplexity and matched_norms:
        context_str = f"{context.construction_type or ''} {context.phase or ''} {' '.join(context.materials)}"
        perplexity_text = await _call_perplexity_supplement(
            norms=[n.designation for n in matched_norms[:10]],
            context=context_str,
        )

    # Step 6: Build response
    context_parts = []
    if context.project_type or context.construction_type:
        context_parts.append(f"typ: {context.project_type or context.construction_type}")
    if context.scope_range:
        context_parts.append(f"scope: {context.scope_range}")
    if context.phase:
        context_parts.append(f"fáze: {context.phase}")
    if context.objects:
        context_parts.append(f"objekty: {', '.join(context.objects)}")
    if precedents:
        context_parts.append(f"{len(precedents)} KB precedentů")

    return AdvisorResponse(
        context_summary=f"Analýza pro {', '.join(context_parts) if context_parts else 'obecný kontext'}",
        matched_norms=len(matched_norms),
        matched_rules=len(matched_rules),
        recommendations=recommendations,
        ai_analysis=ai_analysis,
        ai_model_used=ai_model,
        perplexity_supplement=perplexity_text,
        warnings=warnings,
        precedents=precedents,
        precedent_alignment=precedent_alignment,
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
