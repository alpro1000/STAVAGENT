"""
Provider Router — Task-based LLM routing for v3.1.1.

Routes different tasks to optimal LLM providers:
- Classification → Gemini Flash (fast, cheap)
- Extraction → Claude Sonnet (precise structured output)
- Contradiction detection → Claude Haiku (fast comparison)
- Unknown type verification → Perplexity (web search)
- Heavy analysis → Gemini Pro (last resort)

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-26
"""

import logging
from typing import Optional, Dict, Any
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
TASK_PROVIDER_MAP: Dict[TaskType, list] = {
    TaskType.CLASSIFY: [
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.5-flash"),
        ("claude", "claude-haiku-4-5-20251001"),
    ],
    TaskType.EXTRACT: [
        ("claude", "claude-sonnet-4-6"),
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.CONTRADICTION: [
        ("claude", "claude-haiku-4-5-20251001"),
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.5-flash"),
    ],
    TaskType.VERIFY_UNKNOWN: [
        ("perplexity", "sonar-pro"),
        ("vertex-ai-gemini", "gemini-2.5-flash"),
    ],
    TaskType.SUMMARIZE: [
        ("vertex-ai-gemini", "gemini-2.5-flash"),
        ("claude", "claude-haiku-4-5-20251001"),
    ],
    TaskType.HEAVY_ANALYSIS: [
        ("vertex-ai-gemini", "gemini-2.5-pro"),
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
        logger.warning(f"No providers configured for task {task}")
        return ("vertex-ai-gemini", "gemini-2.5-flash")

    if available_providers is None:
        return candidates[0]

    for provider, model in candidates:
        if provider in available_providers:
            return (provider, model)

    # Fallback: return first candidate anyway
    logger.warning(
        f"No available provider for task {task}, "
        f"falling back to {candidates[0][0]}"
    )
    return candidates[0]


def detect_available_providers() -> set:
    """
    Detect which LLM providers are configured and available.
    Checks API keys / ADC availability.
    """
    available = set()

    try:
        from app.core.config import settings

        # Vertex AI Gemini (ADC — no key needed on Cloud Run)
        # Always available as default
        available.add("vertex-ai-gemini")
        available.add("gemini")

        if settings.ANTHROPIC_API_KEY:
            available.add("claude")

        if settings.PERPLEXITY_API_KEY:
            available.add("perplexity")

        if getattr(settings, "OPENAI_API_KEY", ""):
            available.add("openai")

    except Exception as e:
        logger.warning(f"Error detecting providers: {e}")
        available.add("vertex-ai-gemini")

    return available


def get_task_provider(task: TaskType) -> tuple:
    """
    Convenience function: detect available providers and route task.
    Returns (provider_name, model_name).
    """
    available = detect_available_providers()
    return get_preferred_provider(task, available)
