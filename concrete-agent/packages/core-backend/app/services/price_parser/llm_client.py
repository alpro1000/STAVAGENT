"""
LLM client wrapper for price parser.

Uses Gemini (default, cheap) with Claude fallback.
Reuses app-level config (GOOGLE_API_KEY, ANTHROPIC_API_KEY, GEMINI_MODEL).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 2


async def ask_llm(prompt: str, *, temperature: float = 0.1) -> str:
    """
    Send a prompt to the configured LLM and return raw text response.

    Tries Gemini first (cheap), then Claude as fallback.
    """
    # Try Gemini first
    if settings.GOOGLE_API_KEY:
        try:
            return await _ask_gemini(prompt, temperature=temperature)
        except Exception as e:
            logger.warning("Gemini failed: %s, falling back to Claude", e)

    # Fallback to Claude
    if settings.ANTHROPIC_API_KEY:
        try:
            return await _ask_claude(prompt, temperature=temperature)
        except Exception as e:
            logger.error("Claude also failed: %s", e)
            raise

    raise RuntimeError("No LLM API key configured (GOOGLE_API_KEY or ANTHROPIC_API_KEY)")


async def ask_llm_json(prompt: str, *, temperature: float = 0.1) -> dict | list:
    """
    Send a prompt and parse the response as JSON.
    Retries up to MAX_RETRIES times on parse failure.
    """
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            raw = await ask_llm(prompt, temperature=temperature)
            return _extract_json(raw)
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            logger.warning("JSON parse failed (attempt %d/%d): %s", attempt + 1, MAX_RETRIES + 1, e)
            if attempt < MAX_RETRIES:
                # Add clarification to prompt
                prompt = prompt + "\n\nIMPORTANT: Return ONLY valid JSON, no extra text."

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


# ── Gemini ───────────────────────────────────────────────────────────────────

async def _ask_gemini(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Google Gemini API."""
    import google.generativeai as genai

    genai.configure(api_key=settings.GOOGLE_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    response = await model.generate_content_async(
        prompt,
        generation_config=genai.GenerationConfig(temperature=temperature),
    )
    return response.text


# ── Claude ───────────────────────────────────────────────────────────────────

async def _ask_claude(prompt: str, *, temperature: float = 0.1) -> str:
    """Call Anthropic Claude API."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
