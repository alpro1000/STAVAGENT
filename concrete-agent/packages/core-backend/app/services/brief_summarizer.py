"""
Adaptive Document Summarizer — Universal Document Analysis

NotebookLM-inspired 2-step approach:
  Step 1 (INDEX):  Discover all topics/themes present in the document
  Step 2 (EXPLAIN): Deep-dive each topic with facts, numbers, context

Works with ANY document type — construction, legal, financial, technical.
No hardcoded fields. Output adapts to the document content.

Replaces the old brief_summarizer.py which was hardcoded for concrete documents.

Performance:
  - Processing time: 3-5 seconds (single LLM call, 2-step prompt)
  - Input: up to 8K chars of document text
  - Output: JSON with dynamic topics array

Author: STAVAGENT Team
Version: 2.0.0
Date: 2026-03-17
"""

import logging
import time
import json
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.config import settings
from app.services.passport_enricher import PassportEnricher

logger = logging.getLogger(__name__)


# =============================================================================
# ADAPTIVE PROMPT — INDEX + EXPLAIN in one LLM call
# =============================================================================

ADAPTIVE_SUMMARY_PROMPT_CS = """Analyzuj tento dokument a vytvoř KOMPLEXNÍ SHRNUTÍ.

DOKUMENT:
{document_text}

TVŮJ ÚKOL (2 kroky):

KROK 1 — INDEXACE: Nejprve identifikuj VŠECHNA témata a oblasti, které dokument pokrývá.
Neomezuj se na předem danou strukturu. Přizpůsob se obsahu dokumentu.

KROK 2 — VYSVĚTLENÍ: Pro každé nalezené téma poskytni podrobné vysvětlení.
Ne shrnutí — VYSVĚTLENÍ. Zachovej detaily, čísla, jednotky, specifika.

PRAVIDLA:
- Pouze fakta z dokumentu. NEVYMÝŠLEJ.
- Pokud informace v dokumentu není, nezmiňuj ji.
- Buď KONKRÉTNÍ — čísla, jednotky, kódy, názvy.
- Neomezuj se na stavební terminologii — analyzuj JAKÝKOLIV typ dokumentu.
- Nebuď povrchní. Jdi do hloubky. Buď trpělivý v analýze.
- Každé téma zpracuj důkladně — raději více detailů než méně.

VRAŤ POUZE VALIDNÍ JSON (žádný text před ani za):
{{
  "document_type": "typ dokumentu (technická zpráva, smlouva, rozpočet, výkresová dokumentace, ...)",
  "document_title": "název nebo identifikátor dokumentu",
  "topics": [
    {{
      "title": "Název tématu",
      "icon": "emoji ikona (📋, 🏗️, 💰, 📐, ⚠️, 📅, 👤, 🔧, 📊, 🏢, 🌍, 📝, ...)",
      "content": "Podrobné vysvětlení tématu. Několik vět. Zachovej všechna čísla a specifika.",
      "key_facts": ["fakt 1 s čísly", "fakt 2 s čísly", "fakt 3"],
      "importance": "high | medium | low"
    }}
  ],
  "executive_summary": "2-3 věty — hlavní účel a závěr dokumentu",
  "warnings": ["důležité upozornění nebo rizika (pokud jsou)"]
}}

PŘÍKLADY MOŽNÝCH TÉMAT (podle typu dokumentu — použij pouze relevantní):
- Identifikace projektu, Účastníci stavby, Lokace a pozemky
- Technické parametry, Materiálové specifikace, Objemy a množství
- Rozpočet a náklady, Harmonogram, Smluvní podmínky
- Normy a předpisy, Speciální požadavky, Bezpečnost
- Životní prostředí, Kvalita, Rizika
- Jakékoliv jiné téma které najdeš v dokumentu!

VRAŤ POUZE JSON."""

ADAPTIVE_SUMMARY_PROMPT_EN = """Analyze this document and create a COMPREHENSIVE SUMMARY.

DOCUMENT:
{document_text}

YOUR TASK (2 steps):

STEP 1 — INDEX: First identify ALL topics and areas the document covers.
Do not limit yourself to a predefined structure. Adapt to the document content.

STEP 2 — EXPLAIN: For each discovered topic, provide a detailed explanation.
Not a summary — an EXPLANATION. Preserve details, numbers, units, specifics.

RULES:
- Only facts from the document. DO NOT INVENT.
- If information is not in the document, do not mention it.
- Be SPECIFIC — numbers, units, codes, names.
- Do not limit yourself to construction terminology — analyze ANY document type.
- Do not be superficial. Go deep. Be patient in analysis.
- Process each topic thoroughly — more detail is better than less.

RETURN ONLY VALID JSON (no text before or after):
{{
  "document_type": "document type (technical report, contract, budget, drawings, ...)",
  "document_title": "document name or identifier",
  "topics": [
    {{
      "title": "Topic name",
      "icon": "emoji icon (📋, 🏗️, 💰, 📐, ⚠️, 📅, 👤, 🔧, 📊, 🏢, 🌍, 📝, ...)",
      "content": "Detailed explanation of the topic. Several sentences. Preserve all numbers and specifics.",
      "key_facts": ["fact 1 with numbers", "fact 2 with numbers", "fact 3"],
      "importance": "high | medium | low"
    }}
  ],
  "executive_summary": "2-3 sentences — main purpose and conclusion of the document",
  "warnings": ["important warnings or risks (if any)"]
}}

RETURN ONLY JSON."""


class BriefDocumentSummarizer:
    """
    Adaptive Document Summarizer — works with ANY document type.

    NotebookLM-inspired approach:
    1. INDEX — discover topics present in the document
    2. EXPLAIN — deep-dive each topic with facts and numbers

    No hardcoded fields. Output structure adapts to document content.

    Use cases:
    - Quick document overview (any document type)
    - Dashboard previews
    - Document comparison
    - Project documentation analysis
    """

    def __init__(self, preferred_model: Optional[str] = None):
        """
        Initialize adaptive summarizer.

        Args:
            preferred_model: Preferred AI model (gemini, claude-haiku, openai-mini)
                Default: gemini (FREE, fast)
        """
        self.enricher = PassportEnricher(preferred_model=preferred_model or "gemini")
        logger.info(f"AdaptiveDocumentSummarizer initialized (model: {preferred_model or 'gemini'})")

    async def summarize(
        self,
        document_text: str,
        language: str = "cs",
        max_chars: int = 8000
    ) -> dict:
        """
        Generate adaptive summary with dynamic topics.

        Args:
            document_text: Full document text
            language: Language for summary (cs, en)
            max_chars: Maximum characters to send to LLM (default: 8000)

        Returns:
            {
                "summary": str,               # Executive summary (backward compat)
                "document_type": str,          # Detected document type
                "document_title": str,         # Document title/identifier
                "topics": [                    # Dynamic topics array
                    {
                        "title": str,
                        "icon": str,
                        "content": str,
                        "key_facts": [str],
                        "importance": "high" | "medium" | "low"
                    }
                ],
                "warnings": [str],
                "processing_time_ms": int,
                "chars_processed": int,
                "model_used": str,
                "format": "adaptive_v2"        # Version marker
            }
        """
        start_time = time.time()

        logger.info(f"Generating adaptive summary ({language}), {len(document_text)} chars input")

        # Use more text than old version (8K vs 2K) for better topic discovery
        truncated_text = document_text[:max_chars] if len(document_text) > max_chars else document_text

        # Select prompt based on language
        if language == "cs":
            prompt = ADAPTIVE_SUMMARY_PROMPT_CS.format(document_text=truncated_text)
        else:
            prompt = ADAPTIVE_SUMMARY_PROMPT_EN.format(document_text=truncated_text)

        # Call LLM — single call, 2-step prompt (INDEX + EXPLAIN)
        try:
            response = await self.enricher._call_llm(prompt)

            if response and isinstance(response, dict):
                # Successfully parsed JSON response
                result = self._build_result(response, truncated_text, start_time)
            elif response:
                # Got a string response — try to parse as JSON
                if isinstance(response, str):
                    try:
                        parsed = json.loads(response)
                        result = self._build_result(parsed, truncated_text, start_time)
                    except json.JSONDecodeError:
                        # Plain text fallback — wrap in legacy format
                        result = self._build_fallback_result(str(response), truncated_text, start_time)
                else:
                    result = self._build_fallback_result(str(response), truncated_text, start_time)
            else:
                logger.warning("LLM returned no response")
                result = self._build_fallback_result(
                    "Nepodařilo se vygenerovat shrnutí. Zkuste to prosím znovu.",
                    truncated_text,
                    start_time
                )

        except Exception as e:
            logger.error(f"Adaptive summary generation failed: {e}")
            result = self._build_fallback_result(
                f"Chyba při generování shrnutí: {str(e)}",
                truncated_text,
                start_time
            )

        processing_time = int((time.time() - start_time) * 1000)
        result["processing_time_ms"] = processing_time

        topic_count = len(result.get("topics", []))
        logger.info(f"Adaptive summary complete: {processing_time}ms, {topic_count} topics discovered")

        return result

    def _build_result(self, data: dict, truncated_text: str, start_time: float) -> dict:
        """Build result from successfully parsed LLM JSON response."""
        topics = data.get("topics", [])

        # Validate and normalize topics
        normalized_topics = []
        for topic in topics:
            if not isinstance(topic, dict):
                continue
            normalized_topics.append({
                "title": topic.get("title", "Bez názvu"),
                "icon": topic.get("icon", "📋"),
                "content": topic.get("content", ""),
                "key_facts": topic.get("key_facts", []),
                "importance": topic.get("importance", "medium"),
            })

        # Sort: high → medium → low
        importance_order = {"high": 0, "medium": 1, "low": 2}
        normalized_topics.sort(key=lambda t: importance_order.get(t["importance"], 1))

        executive_summary = data.get("executive_summary", "")

        return {
            "summary": executive_summary,  # Backward compatibility with v1
            "document_type": data.get("document_type", "neznámý"),
            "document_title": data.get("document_title", ""),
            "topics": normalized_topics,
            "warnings": data.get("warnings", []),
            "chars_processed": len(truncated_text),
            "model_used": self.enricher.preferred_model,
            "generated_at": datetime.now().isoformat(),
            "format": "adaptive_v2",
        }

    def _build_fallback_result(self, text: str, truncated_text: str, start_time: float) -> dict:
        """Build fallback result when LLM returns plain text or errors."""
        return {
            "summary": text,
            "document_type": "neznámý",
            "document_title": "",
            "topics": [
                {
                    "title": "Shrnutí dokumentu",
                    "icon": "📄",
                    "content": text,
                    "key_facts": [],
                    "importance": "high",
                }
            ],
            "warnings": [],
            "chars_processed": len(truncated_text),
            "model_used": self.enricher.preferred_model,
            "generated_at": datetime.now().isoformat(),
            "format": "adaptive_v2",
        }


# =============================================================================
# CONVENIENCE FUNCTION (backward compatible)
# =============================================================================

async def summarize_document_brief(
    document_text: str,
    language: str = "cs",
    preferred_model: Optional[str] = None
) -> dict:
    """
    Convenience function to generate adaptive summary.

    Usage:
        result = await summarize_document_brief(
            document_text=full_text,
            language="cs",
            preferred_model="gemini"
        )

        # New adaptive format
        for topic in result["topics"]:
            print(f"{topic['icon']} {topic['title']}")
            print(f"  {topic['content']}")
            for fact in topic["key_facts"]:
                print(f"  • {fact}")

        # Backward compatible
        print(result["summary"])
    """
    summarizer = BriefDocumentSummarizer(preferred_model=preferred_model)
    return await summarizer.summarize(document_text, language)
