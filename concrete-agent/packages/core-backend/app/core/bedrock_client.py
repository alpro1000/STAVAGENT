"""
AWS Bedrock Client — Claude via AWS credits.

Uses boto3 bedrock-runtime to call Claude models through AWS Bedrock.
This burns AWS Activate credits ($1,144 available) instead of direct Anthropic API costs.

Fallback priority: Gemini (free) → Bedrock Claude (AWS credits) → Direct Claude (paid)

Environment variables:
  AWS_ACCESS_KEY_ID       — AWS access key
  AWS_SECRET_ACCESS_KEY   — AWS secret key
  AWS_DEFAULT_REGION      — AWS region (default: eu-central-1 = Frankfurt)
  BEDROCK_MODEL_ID        — Bedrock model ID (default: anthropic.claude-3-5-haiku-20241022-v1:0)
  BEDROCK_ENABLED         — Enable/disable Bedrock (default: true if AWS keys present)
"""

import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.info("boto3 not installed — Bedrock client unavailable. pip install boto3")


# Default to Haiku 4.5 via Bedrock (cheapest, fastest)
# NOTE: claude-3-5-haiku-20241022 has been REMOVED by Anthropic — use claude-haiku-4-5
DEFAULT_MODEL_ID = "anthropic.claude-haiku-4-5-20251015-v1:0"


def is_bedrock_available() -> bool:
    """Check if Bedrock is configured and available."""
    if not BOTO3_AVAILABLE:
        return False
    return bool(
        getattr(settings, 'AWS_ACCESS_KEY_ID', '') and
        getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
    )


async def ask_bedrock_claude(
    prompt: str,
    *,
    temperature: float = 0.1,
    max_tokens: int = 4096,
    model_id: Optional[str] = None,
) -> str:
    """
    Call Claude via AWS Bedrock.

    Uses the Messages API format (Anthropic Bedrock integration).
    """
    if not BOTO3_AVAILABLE:
        raise ImportError("boto3 required for Bedrock. pip install boto3")

    region = getattr(settings, 'AWS_DEFAULT_REGION', None) or 'eu-central-1'
    model = model_id or getattr(settings, 'BEDROCK_MODEL_ID', None) or DEFAULT_MODEL_ID

    client = boto3.client(
        'bedrock-runtime',
        region_name=region,
        aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
        aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
    )

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    })

    logger.info("Bedrock invoke: model=%s, region=%s", model, region)

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

    # Extract text from Anthropic Messages format
    content = response_body.get('content', [])
    if content and isinstance(content, list):
        return content[0].get('text', '')

    raise ValueError(f"Unexpected Bedrock response format: {response_body}")


class BedrockClient:
    """
    Bedrock Claude client — drop-in replacement for ClaudeClient/GeminiClient.

    Provides the same .call() interface used by HybridMultiRoleOrchestrator.
    """

    def __init__(self):
        if not BOTO3_AVAILABLE:
            raise ImportError("boto3 required for Bedrock. pip install boto3")
        if not is_bedrock_available():
            raise ValueError("AWS credentials not configured for Bedrock")

        self.region = getattr(settings, 'AWS_DEFAULT_REGION', 'eu-central-1')
        self.model_id = getattr(settings, 'BEDROCK_MODEL_ID', DEFAULT_MODEL_ID)
        self.max_tokens = getattr(settings, 'CLAUDE_MAX_TOKENS', 4096)

        self._client = boto3.client(
            'bedrock-runtime',
            region_name=self.region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        logger.info(f"✅ Bedrock client initialized: model={self.model_id}, region={self.region}")

    def call(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
    ) -> dict:
        """
        Call Claude via Bedrock — same interface as ClaudeClient.call().

        Returns:
            dict with 'text', 'tokens', 'model' keys.
        """
        messages = [{"role": "user", "content": prompt}]

        body_dict = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": self.max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if system_prompt:
            body_dict["system"] = system_prompt

        response = self._client.invoke_model(
            modelId=self.model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body_dict),
        )

        response_body = json.loads(response['body'].read())
        content = response_body.get('content', [])
        text = content[0].get('text', '') if content else ''

        tokens_used = response_body.get('usage', {})
        total_tokens = tokens_used.get('input_tokens', 0) + tokens_used.get('output_tokens', 0)

        return {
            "text": text,
            "tokens": total_tokens,
            "model": self.model_id,
        }
