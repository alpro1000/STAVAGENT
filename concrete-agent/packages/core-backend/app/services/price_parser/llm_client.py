"""
LLM client wrapper for price parser.

Uses Vertex AI Gemini (primary, GCP credits) with Bedrock/Claude fallback.
Falls back to direct Gemini API only if Vertex AI unavailable (local dev).
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


async def ask_llm(prompt: str, *, temperature: float = 0.1) -> str:
    """
    Send a prompt to the configured LLM and return raw text response.

    Priority: Vertex AI Gemini → direct Gemini → Bedrock → Claude.
    """
    import os
    prompt_len = len(prompt)
    is_cloud_run = bool(os.getenv("K_SERVICE"))
    has_google_key = bool(settings.GOOGLE_API_KEY)
    has_anthropic_key = bool(settings.ANTHROPIC_API_KEY)
    has_bedrock = bool(settings.BEDROCK_ENABLED and settings.AWS_ACCESS_KEY_ID)

    logger.info(
        f"[PRICE-PARSER LLM] ask_llm called: prompt={prompt_len}ch, temp={temperature}, "
        f"CloudRun={is_cloud_run}, GOOGLE_API_KEY={'yes' if has_google_key else 'no'}, "
        f"ANTHROPIC_API_KEY={'yes' if has_anthropic_key else 'no'}, "
        f"Bedrock={'yes' if has_bedrock else 'no'}"
    )

    t_total = time.time()

    # Try Vertex AI Gemini first (GCP credits, primary)
    try:
        logger.info("[PRICE-PARSER LLM] → Trying provider 1/4: Vertex AI Gemini...")
        t0 = time.time()
        result = await _ask_vertex_gemini(prompt, temperature=temperature)
        elapsed = int((time.time() - t0) * 1000)
        logger.info(f"[PRICE-PARSER LLM] ✅ Vertex AI Gemini OK: {elapsed}ms, response={len(result)}ch")
        return result
    except Exception as e:
        elapsed = int((time.time() - t0) * 1000)
        logger.warning(f"[PRICE-PARSER LLM] ❌ Vertex AI Gemini FAILED: {elapsed}ms, {type(e).__name__}: {e}")

    # Fallback: direct Gemini API (local dev)
    if has_google_key:
        try:
            logger.info("[PRICE-PARSER LLM] → Trying provider 2/4: Direct Gemini API...")
            t0 = time.time()
            result = await _ask_gemini(prompt, temperature=temperature)
            elapsed = int((time.time() - t0) * 1000)
            logger.info(f"[PRICE-PARSER LLM] ✅ Direct Gemini OK: {elapsed}ms, response={len(result)}ch")
            return result
        except Exception as e:
            elapsed = int((time.time() - t0) * 1000)
            logger.warning(f"[PRICE-PARSER LLM] ❌ Direct Gemini FAILED: {elapsed}ms, {type(e).__name__}: {e}")
    else:
        logger.info("[PRICE-PARSER LLM] ⏭️ Skipping Direct Gemini (no GOOGLE_API_KEY)")

    # Fallback to AWS Bedrock Claude (uses AWS Activate credits)
    if has_bedrock:
        try:
            logger.info("[PRICE-PARSER LLM] → Trying provider 3/4: AWS Bedrock...")
            t0 = time.time()
            result = await _ask_bedrock(prompt, temperature=temperature)
            elapsed = int((time.time() - t0) * 1000)
            logger.info(f"[PRICE-PARSER LLM] ✅ Bedrock OK: {elapsed}ms, response={len(result)}ch")
            return result
        except Exception as e:
            elapsed = int((time.time() - t0) * 1000)
            logger.warning(f"[PRICE-PARSER LLM] ❌ Bedrock FAILED: {elapsed}ms, {type(e).__name__}: {e}")
    else:
        logger.info("[PRICE-PARSER LLM] ⏭️ Skipping Bedrock (disabled or no AWS keys)")

    # Final fallback to direct Claude API
    if has_anthropic_key:
        try:
            logger.info("[PRICE-PARSER LLM] → Trying provider 4/4: Direct Claude API...")
            t0 = time.time()
            result = await _ask_claude(prompt, temperature=temperature)
            elapsed = int((time.time() - t0) * 1000)
            logger.info(f"[PRICE-PARSER LLM] ✅ Direct Claude OK: {elapsed}ms, response={len(result)}ch")
            return result
        except Exception as e:
            elapsed = int((time.time() - t0) * 1000)
            logger.error(f"[PRICE-PARSER LLM] ❌ Direct Claude FAILED: {elapsed}ms, {type(e).__name__}: {e}")
            raise
    else:
        logger.info("[PRICE-PARSER LLM] ⏭️ Skipping Direct Claude (no ANTHROPIC_API_KEY)")

    total_elapsed = int((time.time() - t_total) * 1000)
    logger.error(f"[PRICE-PARSER LLM] ❌ ALL PROVIDERS FAILED after {total_elapsed}ms")
    raise RuntimeError("No LLM API key configured (GOOGLE_API_KEY, AWS Bedrock, or ANTHROPIC_API_KEY)")


async def ask_llm_json(prompt: str, *, temperature: float = 0.1) -> dict | list:
    """
    Send a prompt and parse the response as JSON.
    Retries up to MAX_RETRIES times on parse failure.
    """
    last_error: Optional[Exception] = None
    logger.info(f"[PRICE-PARSER LLM] ask_llm_json: prompt={len(prompt)}ch, max_retries={MAX_RETRIES}")

    for attempt in range(MAX_RETRIES + 1):
        try:
            raw = await ask_llm(prompt, temperature=temperature)
            result = _extract_json(raw)
            logger.info(f"[PRICE-PARSER LLM] ✅ JSON parsed OK on attempt {attempt + 1}, type={type(result).__name__}")
            return result
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            logger.warning(
                f"[PRICE-PARSER LLM] JSON parse FAILED (attempt {attempt + 1}/{MAX_RETRIES + 1}): "
                f"{type(e).__name__}: {e}"
            )
            if attempt < MAX_RETRIES:
                # Add clarification to prompt
                prompt = prompt + "\n\nIMPORTANT: Return ONLY valid JSON, no extra text."

    logger.error(f"[PRICE-PARSER LLM] ❌ Failed to get valid JSON after {MAX_RETRIES + 1} attempts: {last_error}")
    raise ValueError(f"Failed to get valid JSON after {MAX_RETRIES + 1} attempts: {last_error}")


def _extract_json(text: str) -> dict | list:
    """Extract JSON from LLM response, handling markdown code blocks."""
    # Strip markdown code fences
    text = text.strip()
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()

    # Try direct parse
    return json.loads(text)


# ── Bedrock ──────────────────────────────────────────────────────────────────

async def _ask_bedrock(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Claude via AWS Bedrock (uses AWS Activate credits)."""
    from app.core.bedrock_client import ask_bedrock_claude
    logger.info(f"[PRICE-PARSER LLM] Bedrock: calling ask_bedrock_claude, prompt={len(prompt)}ch")
    result = await ask_bedrock_claude(prompt, temperature=temperature)
    logger.info(f"[PRICE-PARSER LLM] Bedrock: response={len(result)}ch")
    return result


# ── Vertex AI Gemini (primary) ───────────────────────────────────────────────

async def _ask_vertex_gemini(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Gemini via Vertex AI (ADC, GCP credits). Primary path on Cloud Run."""
    try:
        from app.core.gemini_client import VertexGeminiClient, VERTEX_AVAILABLE
    except ImportError as e:
        logger.error(f"[PRICE-PARSER LLM] Vertex AI: ImportError — {e}")
        raise RuntimeError("google-cloud-aiplatform not installed")

    if not VERTEX_AVAILABLE:
        logger.warning("[PRICE-PARSER LLM] Vertex AI: VERTEX_AVAILABLE=False")
        raise RuntimeError("Vertex AI SDK not available")

    logger.info(f"[PRICE-PARSER LLM] Vertex AI: creating VertexGeminiClient, prompt={len(prompt)}ch")
    # Probe runs once (class-level cache), subsequent inits are instant
    client = VertexGeminiClient()
    logger.info(f"[PRICE-PARSER LLM] Vertex AI: client ready, model={getattr(client, '_model_name', '?')}")

    result = client.call(prompt, temperature=temperature)
    logger.info(f"[PRICE-PARSER LLM] Vertex AI: raw result type={type(result).__name__}")

    # Result is dict with raw_text or parsed JSON
    if isinstance(result, dict) and "raw_text" in result:
        text = result["raw_text"]
        logger.info(f"[PRICE-PARSER LLM] Vertex AI: extracted raw_text={len(text)}ch")
        return text
    text = json.dumps(result, ensure_ascii=False)
    logger.info(f"[PRICE-PARSER LLM] Vertex AI: serialized JSON result={len(text)}ch")
    return text


# ── Gemini direct (local dev fallback) ───────────────────────────────────────

async def _ask_gemini(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Google Gemini API directly (local dev fallback only)."""
    import google.generativeai as genai

    model_name = settings.GEMINI_MODEL
    logger.info(f"[PRICE-PARSER LLM] Direct Gemini: model={model_name}, prompt={len(prompt)}ch")
    genai.configure(api_key=settings.GOOGLE_API_KEY)
    model = genai.GenerativeModel(model_name)

    response = await model.generate_content_async(
        prompt,
        generation_config=genai.GenerationConfig(temperature=temperature),
    )
    text = response.text
    logger.info(f"[PRICE-PARSER LLM] Direct Gemini: response={len(text)}ch")
    return text


# ── Claude ───────────────────────────────────────────────────────────────────

async def _ask_claude(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Anthropic Claude API."""
    import anthropic

    model_name = "claude-haiku-4-5-20251001"
    logger.info(f"[PRICE-PARSER LLM] Direct Claude: model={model_name}, prompt={len(prompt)}ch")
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=model_name,
        max_tokens=4096,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    usage = getattr(response, "usage", None)
    logger.info(
        f"[PRICE-PARSER LLM] Direct Claude: response={len(text)}ch, "
        f"usage={{'input': {usage.input_tokens}, 'output': {usage.output_tokens}}} "
        if usage else f"[PRICE-PARSER LLM] Direct Claude: response={len(text)}ch"
    )
    return text
