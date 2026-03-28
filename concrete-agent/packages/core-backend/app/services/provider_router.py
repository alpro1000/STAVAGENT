"""
Provider Router — Task-based LLM routing for v3.2.

Routes different tasks to optimal LLM providers:
- Classification → Gemini Flash (fast, cheap)
- Extraction → Claude Sonnet (precise structured output)
- Contradiction detection → Bedrock Claude Haiku (AWS credits, fast comparison)
- Unknown type verification → Perplexity (web search)
- Heavy analysis → Gemini Pro or Bedrock Claude Sonnet 4.6

Bedrock burns AWS Activate credits — preferred over direct Anthropic API.
Fallback: Vertex AI (free ADC) → Bedrock (AWS credits) → Direct API (paid)

Author: STAVAGENT Team
Version: 2.0.0
Date: 2026-03-27
"""

import logging
from typing import Optional, Dict
from enum import Enum

logger = logging.getLogger(__name__)


class TaskType(str, Enum):
    """LLM task categories for routing."""
    CLASSIFY = "classify"           # Document classification
    EXTRACT = "extract"             # Structured data extraction
    CONTRADICTION = "contradiction" # Cross-document comparison
    VERIFY_UNKNOWN = "verify"       # Unknown type verification (Perplexity)
    SUMMARIZE = "summarize"         # Non-construction doc summary
    HEAVY_ANALYSIS = "heavy"        # Complex multi-page analysis


# Provider preferences per task type.
# Each entry: list of (provider, model) tuples in priority order.
# Falls through if provider unavailable.
#
# Strategy:
#   1. Vertex AI Gemini (free on Cloud Run via ADC)
#   2. Bedrock (burns AWS credits — $1,144 available)
#   3. Direct Gemini API key
#   4. Direct Claude API (most expensive)
#   5. Perplexity (web search only)
TASK_PROVIDER_MAP: Dict[TaskType, list] = {
    TaskType.CLASSIFY: [
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("bedrock", "anthropic.claude-3-haiku-20240307-v1:0"),  # $0.25/1M, confirmed
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.EXTRACT: [
        ("bedrock", "anthropic.claude-3-sonnet-20240229-v1:0"),  # AWS credits, confirmed
        ("claude", "claude-sonnet-4-6"),
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.CONTRADICTION: [
        ("bedrock", "anthropic.claude-3-haiku-20240307-v1:0"),  # AWS credits, fast
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.VERIFY_UNKNOWN: [
        ("perplexity", "sonar-pro"),
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("bedrock", "anthropic.claude-3-sonnet-20240229-v1:0"),
    ],
    TaskType.SUMMARIZE: [
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("bedrock", "anthropic.claude-3-haiku-20240307-v1:0"),  # Cheap
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.HEAVY_ANALYSIS: [
        ("vertex-ai-gemini", "gemini-2.5-pro"),
        ("bedrock", "anthropic.claude-3-sonnet-20240229-v1:0"),  # AWS credits
        ("claude", "claude-sonnet-4-6"),
    ],
}


def get_preferred_provider(
    task: TaskType,
    available_providers: Optional[set] = None,
) -> tuple:
    """
    Get the best available provider for a given task.

    Args:
        task: The type of LLM task
        available_providers: Set of available provider names.
            If None, returns the first (ideal) provider.

    Returns:
        Tuple of (provider_name, model_name)
    """
    candidates = TASK_PROVIDER_MAP.get(task, [])
    if not candidates:
        logger.warning(f"[ROUTER] No providers configured for task={task}")
        return ("vertex-ai-gemini", "gemini-2.5-flash")

    if available_providers is None:
        selected = candidates[0]
        logger.info(f"[ROUTER] task={task.value} → {selected[0]}:{selected[1]} (no availability check)")
        return selected

    # Log the full candidate chain and which are available
    chain_str = " → ".join(f"{p}:{m}" for p, m in candidates)
    logger.info(f"[ROUTER] task={task.value} chain: [{chain_str}], available={sorted(available_providers)}")

    for provider, model in candidates:
        if provider in available_providers:
            logger.info(f"[ROUTER] task={task.value} → SELECTED {provider}:{model}")
            return (provider, model)

    # Fallback: return first candidate anyway
    logger.warning(
        f"[ROUTER] task={task.value} → NO available provider! "
        f"Falling back to {candidates[0][0]}:{candidates[0][1]}"
    )
    return candidates[0]


def detect_available_providers() -> set:
    """
    Detect which LLM providers are configured and available.
    Checks API keys / ADC / AWS credentials.
    """
    available = set()
    reasons = []

    try:
        from app.core.config import settings
        import os

        # Vertex AI Gemini (ADC — no key needed on Cloud Run)
        is_cloud_run = bool(os.getenv("K_SERVICE"))
        has_gcp_project = bool(os.getenv("GOOGLE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT"))
        available.add("vertex-ai-gemini")
        reasons.append(f"vertex-ai-gemini=YES (CloudRun={is_cloud_run}, project_env={has_gcp_project})")

        if settings.GOOGLE_API_KEY:
            available.add("gemini")
            reasons.append("gemini=YES (GOOGLE_API_KEY set)")
        else:
            # Still add gemini as available since we can try Vertex path
            available.add("gemini")
            reasons.append("gemini=YES (via Vertex ADC fallback, no GOOGLE_API_KEY)")

        if settings.ANTHROPIC_API_KEY:
            available.add("claude")
            reasons.append("claude=YES (ANTHROPIC_API_KEY set)")
        else:
            reasons.append("claude=NO (ANTHROPIC_API_KEY missing)")

        if settings.PERPLEXITY_API_KEY:
            available.add("perplexity")
            reasons.append("perplexity=YES")
        else:
            reasons.append("perplexity=NO (PERPLEXITY_API_KEY missing)")

        if getattr(settings, "OPENAI_API_KEY", ""):
            available.add("openai")
            reasons.append("openai=YES")
        else:
            reasons.append("openai=NO")

        # AWS Bedrock (uses AWS credentials)
        has_aws_key = bool(getattr(settings, "AWS_ACCESS_KEY_ID", ""))
        has_aws_secret = bool(getattr(settings, "AWS_SECRET_ACCESS_KEY", ""))
        bedrock_enabled = getattr(settings, "BEDROCK_ENABLED", True)
        if has_aws_key and has_aws_secret and bedrock_enabled:
            available.add("bedrock")
            reasons.append("bedrock=YES (AWS creds + enabled)")
        else:
            reasons.append(f"bedrock=NO (key={has_aws_key}, secret={has_aws_secret}, enabled={bedrock_enabled})")

    except Exception as e:
        logger.warning(f"[ROUTER] Error detecting providers: {e}")
        available.add("vertex-ai-gemini")
        reasons.append(f"ERROR: {e}, defaulting to vertex-ai-gemini")

    logger.info(f"[ROUTER] Available providers: {sorted(available)} | Details: {'; '.join(reasons)}")
    return available


def get_task_provider(task: TaskType) -> tuple:
    """
    Convenience function: detect available providers and route task.
    Returns (provider_name, model_name).
    """
    available = detect_available_providers()
    result = get_preferred_provider(task, available)
    logger.info(f"[ROUTER] get_task_provider({task.value}) → {result[0]}:{result[1]}")
    return result
