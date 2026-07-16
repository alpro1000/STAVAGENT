"""Canonical TZ → calculator-field extraction (HOTFIX-1, 2026-07-16).

The Kalkulátor «AI: doplnit pole z textu» button used to run through the
free-form chat endpoint (`/api/v1/multi-role/ask`) — no schema, no per-field
confidence, prose parsed by a fragile heuristic (the `ai_no_parse` / 422 class).

This is the SCHEMA-VALIDATED, force-JSON transport that replaces that path
(variant B2, ratified 2026-07-16). It is deliberately NARROW:

  * INPUT is the FINISHED prompt built by the SHARED manifest
    (`@stavagent/monolit-shared` `buildAiExtractionPrompt`) on the Monolit side.
    The field manifest (FormState/PlannerInput field names) is a
    frontend/engine concern and stays SINGLE-SOURCE in that one TS module —
    Core must NOT re-implement it (that would be drift #2, exactly what the
    hotfix fights). Core is the force-JSON LLM transport, not a second
    manifest owner.
  * OUTPUT is the flat `[{field, value, quote, confidence}]` the frontend
    `mergeAiParams` already consumes — contract unchanged.
  * `response_mime_type=application/json` (force-JSON) removes the prose-parse
    heuristic; a still-invalid payload (e.g. max_tokens cutoff) returns a TYPED
    `ai_invalid_json` error — honest-fail, never a 500 or a silent empty list.

This does NOT touch `/api/v1/multi-role/ask` (other consumers) and adds NO
MCP-billing gate (internal kiosk→Core call, mirrors the multi-role/ask posture).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tz", tags=["tz-extract"])

# Vertex seam — module-level so tests can monkeypatch it (mirrors extract_tz_fields).
# Returns the parsed LLM payload (list | dict | {"raw_text": ...} on non-JSON).
def _default_llm(prompt: str) -> Any:
    from app.core.gemini_client import VertexGeminiClient

    return VertexGeminiClient().call(prompt, temperature=0.1, json_mode=True)


_LLM = _default_llm


class ExtractCalculatorFieldsRequest(BaseModel):
    """Schema-validated input. `prompt` is the shared-manifest-built prompt;
    `element_type` is carried for logging/telemetry only (Core does not rebuild
    the prompt from it — single-source manifest lives in shared TS)."""
    prompt: str = Field(min_length=1)
    element_type: str = Field(min_length=1)


def _coerce_params(data: Any) -> Optional[list[dict]]:
    """Pull the `[{field,value,quote,confidence}]` array out of the LLM payload.

    Accepts a bare array, or an object wrapping it under a list value (force-JSON
    may return `{"params":[...]}` or `[...]`). Returns None when nothing
    array-shaped is present → caller emits typed `ai_invalid_json`."""
    if isinstance(data, list):
        return [p for p in data if isinstance(p, dict)]
    if isinstance(data, dict):
        # A raw_text marker means the model did NOT produce JSON (cutoff/refusal).
        if "raw_text" in data and len(data) == 1:
            return None
        named = data.get("params")
        if isinstance(named, list):
            return [p for p in named if isinstance(p, dict)]
        for v in data.values():
            if isinstance(v, list):
                dicts = [p for p in v if isinstance(p, dict)]
                if dicts:
                    return dicts
    return None


@router.post("/extract-calculator-fields")
async def extract_calculator_fields(body: ExtractCalculatorFieldsRequest):
    """Force-JSON TZ→calculator-field extraction.

    Returns `{params: [{field,value,quote,confidence}], model}` on success, or a
    TYPED error (`llm_unavailable` | `ai_invalid_json`) — never a 500 or a
    fabricated empty list dressed as success.
    """
    import asyncio

    try:
        data = await asyncio.to_thread(_LLM, body.prompt)
    except Exception as exc:  # transport / Vertex failure
        logger.warning("[TZ/extract-fields] LLM call failed: %s", exc)
        return JSONResponse(
            status_code=502,
            content={
                "error": "llm_unavailable",
                "message": f"AI služba není dostupná: {exc}",
            },
        )

    params = _coerce_params(data)
    if params is None:
        preview = ""
        if isinstance(data, dict):
            preview = str(data.get("raw_text", ""))[:160]
        logger.warning(
            "[TZ/extract-fields] force-JSON returned non-array payload "
            "(element_type=%s, preview=%r)", body.element_type, preview)
        return JSONResponse(
            status_code=422,
            content={
                "error": "ai_invalid_json",
                "message": "AI nevrátila platný JSON seznam parametrů "
                           "(možný ořez odpovědi) — zkuste to znovu.",
            },
        )

    return {"params": params, "model": "vertex-gemini"}
