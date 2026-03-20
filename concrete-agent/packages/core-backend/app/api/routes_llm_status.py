"""
LLM Status endpoint — shows which LLM is active and runs a live probe test.

GET /api/v1/llm/status
"""
import logging
import os
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm-status"])


class LLMProbeResult(BaseModel):
    ok: bool
    latency_ms: Optional[int] = None
    response_preview: Optional[str] = None
    error: Optional[str] = None


class LLMStatusResponse(BaseModel):
    configured_llm: str
    active_llm: Optional[str] = None
    model_name: Optional[str] = None
    project_id: Optional[str] = None
    location: Optional[str] = None
    vertex_sdk_available: bool
    gemini_sdk_available: bool
    google_api_key_set: bool
    google_project_id_env: Optional[str] = None
    google_application_credentials: Optional[str] = None
    probe: LLMProbeResult
    init_error: Optional[str] = None
    timestamp: str


@router.get("/status", response_model=LLMStatusResponse, summary="LLM health + probe test")
async def llm_status() -> Dict[str, Any]:
    """
    Instantiate the configured LLM client and send a tiny probe request.

    Useful for diagnosing Vertex AI auth issues, missing IAM roles, or wrong project IDs.
    Returns full init details and a live latency measurement.
    """
    import datetime

    from app.core.config import settings

    # --- SDK availability flags ---
    try:
        import google.generativeai  # noqa: F401
        gemini_sdk = True
    except ImportError:
        gemini_sdk = False

    try:
        import vertexai  # noqa: F401
        vertex_sdk = True
    except ImportError:
        vertex_sdk = False

    configured_llm = getattr(settings, "MULTI_ROLE_LLM", "vertex-ai-gemini")
    google_api_key_set = bool(getattr(settings, "GOOGLE_API_KEY", ""))
    google_project_id_env = os.getenv("GOOGLE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
    creds_env = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    active_llm: Optional[str] = None
    model_name: Optional[str] = None
    project_id_used: Optional[str] = None
    location_used: Optional[str] = None
    init_error: Optional[str] = None
    probe = LLMProbeResult(ok=False)

    logger.info(f"[llm/status] probe requested — configured_llm={configured_llm!r}")

    try:
        # Always try Vertex first (same logic as orchestrator default)
        from app.core.gemini_client import VertexGeminiClient, VERTEX_AVAILABLE

        if not VERTEX_AVAILABLE:
            raise ImportError("google-cloud-aiplatform not installed")

        client = VertexGeminiClient()
        active_llm = "vertex-ai-gemini"
        model_name = client.model_name
        project_id_used = client._project_id
        location_used = client._location

        # --- Live probe: minimal prompt ---
        probe_prompt = (
            'Return exactly this JSON and nothing else: {"status": "ok", "llm": "vertex"}'
        )
        t0 = time.monotonic()
        try:
            result = client.call(probe_prompt, temperature=0.0)
            elapsed = int((time.monotonic() - t0) * 1000)
            preview = str(result)[:120]
            probe = LLMProbeResult(ok=True, latency_ms=elapsed, response_preview=preview)
            logger.info(f"[llm/status] ✅ probe OK in {elapsed}ms: {preview!r}")
        except Exception as probe_err:
            elapsed = int((time.monotonic() - t0) * 1000)
            err_msg = f"{type(probe_err).__name__}: {probe_err}"
            probe = LLMProbeResult(ok=False, latency_ms=elapsed, error=err_msg)
            logger.error(f"[llm/status] ❌ probe FAILED in {elapsed}ms: {err_msg}")

    except Exception as init_err:
        init_error = f"{type(init_err).__name__}: {init_err}"
        logger.error(f"[llm/status] ❌ VertexGeminiClient init FAILED: {init_error}")
        probe = LLMProbeResult(ok=False, error=init_error)

    return LLMStatusResponse(
        configured_llm=configured_llm,
        active_llm=active_llm,
        model_name=model_name,
        project_id=project_id_used,
        location=location_used,
        vertex_sdk_available=vertex_sdk,
        gemini_sdk_available=gemini_sdk,
        google_api_key_set=google_api_key_set,
        google_project_id_env=google_project_id_env,
        google_application_credentials=creds_env,
        probe=probe,
        init_error=init_error,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
    ).model_dump()
