"""
AWS Bedrock Client — Multi-provider LLM access via AWS credits.

Supports ALL Bedrock providers:
- Anthropic Claude (Messages API)
- Amazon Nova (Messages API variant)
- Meta Llama (Messages API variant)
- DeepSeek (Messages API variant)
- Mistral (Messages API variant)

Uses boto3 bedrock-runtime. Burns AWS Activate credits instead of direct API costs.
Fallback priority: Gemini (free) → Bedrock (AWS credits) → Direct Claude (paid)

Environment variables:
  AWS_ACCESS_KEY_ID       — AWS access key
  AWS_SECRET_ACCESS_KEY   — AWS secret key
  AWS_DEFAULT_REGION      — AWS region (default: us-east-1)
  BEDROCK_MODEL_ID        — Bedrock model ID (default: anthropic.claude-haiku-4-5-20251001-v1:0)
  BEDROCK_ENABLED         — Enable/disable Bedrock (default: true if AWS keys present)
"""

import json
import logging
from typing import Optional, AsyncIterator

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.info("boto3 not installed — Bedrock client unavailable. pip install boto3")


# ============================================================================
# MODEL CATALOG — all models available in us-east-1 (March 2026)
# ============================================================================

BEDROCK_MODELS = {
    # ---- Anthropic Claude ----
    "claude-sonnet-4.6":    "anthropic.claude-sonnet-4-6",
    "claude-opus-4.6":      "anthropic.claude-opus-4-6-v1",
    "claude-sonnet-4":      "anthropic.claude-sonnet-4-20250514-v1:0",
    "claude-haiku-4.5":     "anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-sonnet-4.5":    "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "claude-sonnet-3.7":    "anthropic.claude-3-7-sonnet-20250219-v1:0",
    "claude-sonnet-3.5-v2": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "claude-haiku-3.5":     "anthropic.claude-3-5-haiku-20241022-v1:0",

    # ---- Amazon Nova ----
    "nova-premier":  "amazon.nova-premier-v1:0",
    "nova-pro":      "amazon.nova-pro-v1:0",
    "nova-lite":     "amazon.nova-lite-v1:0",
    "nova-micro":    "amazon.nova-micro-v1:0",

    # ---- Meta Llama ----
    "llama4-scout":    "meta.llama4-scout-17b-instruct-v1:0",
    "llama4-maverick": "meta.llama4-maverick-17b-instruct-v1:0",
    "llama3.3-70b":    "meta.llama3-3-70b-instruct-v1:0",
    "llama3.2-90b":    "meta.llama3-2-90b-instruct-v1:0",

    # ---- DeepSeek ----
    "deepseek-r1":  "deepseek.r1-v1:0",
    "deepseek-v3":  "deepseek.v3.2",

    # ---- Mistral ----
    "mistral-large":  "mistral.mistral-large-2402-v1:0",
    "pixtral-large":  "mistral.pixtral-large-2502-v1:0",
}

# Default: Haiku 4.5 (cheapest Anthropic on Bedrock)
DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"

# Provider detection from model ID prefix
PROVIDER_PREFIXES = {
    "anthropic.": "anthropic",
    "amazon.":    "amazon",
    "meta.":      "meta",
    "deepseek.":  "deepseek",
    "mistral.":   "mistral",
    "cohere.":    "cohere",
    "ai21.":      "ai21",
    "nvidia.":    "nvidia",
}


def _detect_provider(model_id: str) -> str:
    """Detect provider from Bedrock model ID prefix."""
    for prefix, provider in PROVIDER_PREFIXES.items():
        if model_id.startswith(prefix):
            return provider
    return "unknown"


def _build_request_body(
    model_id: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str:
    """Build provider-specific request body for Bedrock invoke_model."""
    provider = _detect_provider(model_id)

    if provider == "anthropic":
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            body["system"] = system_prompt
        return json.dumps(body)

    if provider == "amazon":
        # Amazon Nova uses Converse-style Messages API
        body = {
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"max_new_tokens": max_tokens, "temperature": temperature},
        }
        if system_prompt:
            body["system"] = [{"text": system_prompt}]
        return json.dumps(body)

    if provider in ("meta", "deepseek", "mistral"):
        # Meta Llama, DeepSeek, Mistral — Messages API format on Bedrock
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        body = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        return json.dumps(body)

    # Fallback: generic Messages API
    body = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    return json.dumps(body)


def _parse_response(model_id: str, response_body: dict) -> str:
    """Parse provider-specific response from Bedrock."""
    provider = _detect_provider(model_id)

    if provider == "anthropic":
        content = response_body.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")

    if provider == "amazon":
        output = response_body.get("output", {})
        message = output.get("message", {})
        content = message.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")

    if provider in ("meta", "deepseek", "mistral"):
        # Standard chat completion format
        choices = response_body.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        # Fallback: some models return content directly
        content = response_body.get("content", [])
        if content and isinstance(content, list):
            return content[0].get("text", "")

    # Generic fallback: try common patterns
    for key in ("content", "output", "choices", "generation"):
        val = response_body.get(key)
        if isinstance(val, list) and val:
            item = val[0]
            if isinstance(item, dict):
                return item.get("text", "") or item.get("message", {}).get("content", "")
            if isinstance(item, str):
                return item
        if isinstance(val, str):
            return val

    raise ValueError(f"Unexpected Bedrock response format for {model_id}: {list(response_body.keys())}")


def _get_usage_tokens(model_id: str, response_body: dict) -> int:
    """Extract token usage from response."""
    usage = response_body.get("usage", {})
    if usage:
        return usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
    # Amazon Nova style
    usage = response_body.get("amazon.usage", response_body.get("metrics", {}))
    if usage:
        return usage.get("inputTokenCount", 0) + usage.get("outputTokenCount", 0)
    return 0


# ============================================================================
# PUBLIC API
# ============================================================================

def is_bedrock_available() -> bool:
    """Check if Bedrock is configured and available."""
    if not BOTO3_AVAILABLE:
        return False
    return bool(
        getattr(settings, 'AWS_ACCESS_KEY_ID', '') and
        getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
    )


def resolve_model_id(model_id: Optional[str] = None) -> str:
    """Resolve a friendly name or raw ID to a Bedrock model ID."""
    if not model_id:
        return getattr(settings, 'BEDROCK_MODEL_ID', None) or DEFAULT_MODEL_ID

    # Check catalog first (friendly names)
    if model_id in BEDROCK_MODELS:
        return BEDROCK_MODELS[model_id]

    # Already a full Bedrock ID
    return model_id


async def ask_bedrock(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    model_id: Optional[str] = None,
) -> str:
    """
    Call any model via AWS Bedrock (async, runs boto3 in thread pool).

    Args:
        prompt: User message
        system_prompt: Optional system prompt
        temperature: Sampling temperature
        max_tokens: Max output tokens
        model_id: Bedrock model ID or catalog name (e.g. "claude-haiku-4.5", "nova-pro")

    Returns:
        Response text string
    """
    if not BOTO3_AVAILABLE:
        raise ImportError("boto3 required for Bedrock. pip install boto3")

    region = getattr(settings, 'AWS_DEFAULT_REGION', None) or 'us-east-1'
    model = resolve_model_id(model_id)

    client = boto3.client(
        'bedrock-runtime',
        region_name=region,
        aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
        aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
    )

    body = _build_request_body(model, prompt, system_prompt, temperature, max_tokens)

    logger.info("Bedrock invoke: model=%s, region=%s, provider=%s", model, region, _detect_provider(model))

    # boto3 is sync — run in thread pool to avoid blocking
    import asyncio
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.invoke_model(
            modelId=model,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
    )

    response_body = json.loads(response['body'].read())
    return _parse_response(model, response_body)


# Legacy alias
async def ask_bedrock_claude(
    prompt: str,
    *,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    model_id: Optional[str] = None,
) -> str:
    """Legacy alias — calls ask_bedrock with Anthropic defaults."""
    return await ask_bedrock(
        prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        model_id=model_id or DEFAULT_MODEL_ID,
    )


class BedrockClient:
    """
    Bedrock multi-provider client — drop-in replacement for ClaudeClient/GeminiClient.

    Provides the same .call() interface used by HybridMultiRoleOrchestrator.
    Supports all Bedrock providers (Anthropic, Amazon Nova, Meta Llama, DeepSeek, Mistral).
    """

    def __init__(self, model_id: Optional[str] = None):
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 required for Bedrock. pip install boto3")
        if not is_bedrock_available():
            raise ValueError("AWS credentials not configured for Bedrock")

        self.region = getattr(settings, 'AWS_DEFAULT_REGION', 'us-east-1')
        self.model_id = resolve_model_id(model_id)
        self.max_tokens = getattr(settings, 'CLAUDE_MAX_TOKENS', 4096)
        self.provider = _detect_provider(self.model_id)

        self._client = boto3.client(
            'bedrock-runtime',
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        logger.info(
            "Bedrock client initialized: model=%s, provider=%s, region=%s",
            self.model_id, self.provider, self.region
        )

    def call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
    ) -> dict:
        """
        Call LLM via Bedrock — same interface as ClaudeClient.call().

        Returns:
            dict with 'text', 'tokens', 'model' keys.
        """
        body = _build_request_body(
            self.model_id, prompt, system_prompt, temperature, self.max_tokens
        )

        response = self._client.invoke_model(
            modelId=self.model_id,
            contentType="application/json",
            accept="application/json",
            body=body,
        )

        response_body = json.loads(response['body'].read())
        text = _parse_response(self.model_id, response_body)
        total_tokens = _get_usage_tokens(self.model_id, response_body)

        return {
            "text": text,
            "tokens": total_tokens,
            "model": self.model_id,
            "provider": self.provider,
        }

    async def acall(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
    ) -> dict:
        """Async version of call() — runs boto3 in thread pool."""
        import asyncio
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.call(prompt, system_prompt, temperature)
        )
