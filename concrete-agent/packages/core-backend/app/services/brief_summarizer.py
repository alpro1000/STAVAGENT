"""
Adaptive Document Summarizer — Universal Document Analysis

NotebookLM-inspired 2-step approach:
  Step 1 (INDEX):  Discover all topics/themes present in the document
  Step 2 (EXPLAIN): Deep-dive each topic with facts, numbers, context

Works with ANY document type — construction, legal, financial, technical.
No hardcoded fields. Output adapts to the document content.

Large document support (45-50+ pages):
  - Gemini 2.5 Flash: sends up to 100K chars directly (1M token context)
  - Other models (Claude, OpenAI): map-reduce chunked approach
    Phase 1 (MAP): chunk document → extract topic indices per chunk
    Phase 2 (REDUCE): merge indices → generate unified explanation

Author: STAVAGENT Team
Version: 2.1.0
Date: 2026-03-17
"""

import logging
import time
import json
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.config import settings
from app.services.passport_enricher import PassportEnricher

logger = logging.getLogger(__name__)


# =============================================================================
# MODEL CONTEXT LIMITS (chars, ~4 chars per token)
# =============================================================================

MODEL_CONTEXT_LIMITS = {
    # Gemini 2.5 family: 1M tokens = ~400K chars (safe limit)
    "gemini": 200_000,
    # Claude family
    "claude-sonnet": 150_000,   # 200K tokens
    "claude-haiku": 150_000,    # 200K tokens
    # OpenAI
    "openai": 100_000,          # 128K tokens
    "openai-mini": 100_000,     # 128K tokens
    # Vertex AI (same as Gemini)
    "vertex-ai-gemini": 200_000,
    "vertex-ai-search": 200_000,
    # Perplexity
    "perplexity": 50_000,       # ~128K tokens but slower
    # Default fallback
    "auto": 100_000,
}

# Chunk size for map-reduce (when document exceeds model limit)
CHUNK_SIZE = 15_000  # ~15K chars per chunk (~4 pages)
CHUNK_OVERLAP = 500  # Overlap between chunks to preserve context


# =============================================================================
# PROMPTS
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

# Map prompt: extract topic index from a single chunk
CHUNK_INDEX_PROMPT_CS = """Analyzuj tento ÚSEK dokumentu (část {chunk_num} z {total_chunks}).

ÚSEK DOKUMENTU:
{chunk_text}

ÚKOL: Identifikuj VŠECHNA témata a klíčová fakta v tomto úseku.
Pro každé téma extrahuj konkrétní čísla, jednotky, kódy, názvy.

VRAŤ POUZE VALIDNÍ JSON:
{{
  "document_type": "typ dokumentu (pokud lze určit z tohoto úseku)",
  "document_title": "název dokumentu (pokud je v tomto úseku)",
  "topics": [
    {{
      "title": "Název tématu",
      "icon": "emoji",
      "key_facts": ["konkrétní fakt s čísly", "další fakt"],
      "importance": "high | medium | low"
    }}
  ],
  "warnings": ["varování pokud existují"]
}}

PRAVIDLA:
- Pouze fakta z textu. NEVYMÝŠLEJ.
- Buď maximálně konkrétní — čísla, jednotky, kódy.
- Toto je úsek většího dokumentu, neděj závěry o celku.

VRAŤ POUZE JSON."""

# Reduce prompt: merge chunk indices into final summary
MERGE_TOPICS_PROMPT_CS = """Máš indexy témat extrahované z {total_chunks} úseků jednoho dokumentu.

INDEXY Z ÚSEKŮ:
{chunk_indices}

ÚKOL:
1. SLOUČ duplicitní témata (např. "Beton" z úseku 1 a "Betonové specifikace" z úseku 3).
2. Pro každé sloučené téma napiš PODROBNÉ VYSVĚTLENÍ — ne shrnutí, ale vysvětlení.
3. Zachovej VŠECHNA čísla, jednotky, kódy, názvy ze všech úseků.
4. Urči celkový typ a název dokumentu.

VRAŤ POUZE VALIDNÍ JSON:
{{
  "document_type": "typ dokumentu",
  "document_title": "název dokumentu",
  "topics": [
    {{
      "title": "Sloučený název tématu",
      "icon": "emoji",
      "content": "Podrobné vysvětlení tématu se VŠEMI fakty ze všech úseků. Několik vět.",
      "key_facts": ["fakt 1", "fakt 2", "fakt 3"],
      "importance": "high | medium | low"
    }}
  ],
  "executive_summary": "2-3 věty o celém dokumentu",
  "warnings": ["sloučená varování"]
}}

PRAVIDLA:
- Slouč témata se stejným nebo podobným názvem do jednoho.
- Zachovej VŠECHNY číselné údaje.
- Seřaď témata od nejdůležitějších.

VRAŤ POUZE JSON."""


class BriefDocumentSummarizer:
    """
    Adaptive Document Summarizer — works with ANY document type.

    Handles documents of any size:
    - Small (< context limit): Single LLM call with INDEX → EXPLAIN
    - Large (> context limit): Map-reduce chunked approach
      - MAP: extract topic indices from each chunk (parallel)
      - REDUCE: merge indices into unified explanation

    Context limits per model:
    - Gemini 2.5 Flash: 200K chars (~50 pages)
    - Claude Sonnet/Haiku: 150K chars (~37 pages)
    - OpenAI: 100K chars (~25 pages)
    - Documents exceeding limit → automatic chunking
    """

    def __init__(self, preferred_model: Optional[str] = None):
        self.enricher = PassportEnricher(preferred_model=preferred_model or "gemini")
        self.preferred_model = preferred_model or "gemini"
        self._context_limit = MODEL_CONTEXT_LIMITS.get(
            self.preferred_model, MODEL_CONTEXT_LIMITS["auto"]
        )
        logger.info(
            f"AdaptiveDocumentSummarizer initialized "
            f"(model: {self.preferred_model}, context_limit: {self._context_limit} chars)"
        )

    async def summarize(
        self,
        document_text: str,
        language: str = "cs",
        max_chars: int = 0,  # 0 = use model's context limit
    ) -> dict:
        """
        Generate adaptive summary with dynamic topics.

        Automatically selects strategy based on document size:
        - Direct (< context_limit): single LLM call
        - Chunked (>= context_limit): map-reduce with parallel chunk processing
        """
        start_time = time.time()
        doc_len = len(document_text)

        # Determine effective limit
        effective_limit = max_chars if max_chars > 0 else self._context_limit
        # Reserve ~2K for prompt template itself
        effective_limit = effective_limit - 2000

        logger.info(
            f"Adaptive summary ({language}): {doc_len} chars input, "
            f"limit: {effective_limit} chars, "
            f"strategy: {'direct' if doc_len <= effective_limit else 'chunked'}"
        )

        if doc_len <= effective_limit:
            # === DIRECT: fits in context window ===
            result = await self._summarize_direct(document_text, language)
        else:
            # === CHUNKED MAP-REDUCE: document too large ===
            result = await self._summarize_chunked(document_text, language, effective_limit)

        processing_time = int((time.time() - start_time) * 1000)
        result["processing_time_ms"] = processing_time
        result["chars_processed"] = doc_len
        result["strategy"] = "direct" if doc_len <= effective_limit else "chunked"

        topic_count = len(result.get("topics", []))
        logger.info(
            f"Adaptive summary complete: {processing_time}ms, "
            f"{topic_count} topics, {doc_len} chars processed"
        )

        return result

    # =========================================================================
    # DIRECT STRATEGY (small-medium documents)
    # =========================================================================

    async def _summarize_direct(self, document_text: str, language: str) -> dict:
        """Single LLM call for documents that fit in context window."""
        if language == "cs":
            prompt = ADAPTIVE_SUMMARY_PROMPT_CS.format(document_text=document_text)
        else:
            prompt = ADAPTIVE_SUMMARY_PROMPT_EN.format(document_text=document_text)

        try:
            response = await self.enricher._call_llm(prompt)
            return self._parse_llm_response(response, document_text)
        except Exception as e:
            logger.error(f"Direct summary failed: {e}")
            return self._build_fallback_result(
                f"Chyba při generování shrnutí: {str(e)}", document_text
            )

    # =========================================================================
    # CHUNKED MAP-REDUCE STRATEGY (large documents, 45-50+ pages)
    # =========================================================================

    async def _summarize_chunked(
        self, document_text: str, language: str, effective_limit: int
    ) -> dict:
        """
        Map-reduce approach for large documents.

        Phase 1 (MAP): Split document into chunks, extract topic index from each
        Phase 2 (REDUCE): Merge all indices, generate unified explanation
        """
        # Split into chunks
        chunks = self._split_into_chunks(document_text)
        logger.info(f"Chunked analysis: {len(chunks)} chunks of ~{CHUNK_SIZE} chars")

        # Phase 1: MAP — extract topic indices from each chunk (sequential to respect rate limits)
        chunk_indices = []
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            try:
                prompt = CHUNK_INDEX_PROMPT_CS.format(
                    chunk_num=i + 1,
                    total_chunks=len(chunks),
                    chunk_text=chunk,
                )
                response = await self.enricher._call_llm(prompt)
                if response and isinstance(response, dict):
                    chunk_indices.append(response)
                elif response and isinstance(response, str):
                    try:
                        parsed = json.loads(response)
                        chunk_indices.append(parsed)
                    except json.JSONDecodeError:
                        logger.warning(f"Chunk {i+1}: failed to parse JSON")
                else:
                    logger.warning(f"Chunk {i+1}: no response")
            except Exception as e:
                logger.warning(f"Chunk {i+1} failed: {e}")

        if not chunk_indices:
            return self._build_fallback_result(
                "Nepodařilo se analyzovat žádný úsek dokumentu.", document_text
            )

        logger.info(f"MAP phase complete: {len(chunk_indices)}/{len(chunks)} chunks processed")

        # Phase 2: REDUCE — merge indices into final summary
        return await self._merge_chunk_indices(chunk_indices, len(chunks))

    def _split_into_chunks(self, text: str) -> List[str]:
        """Split document text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + CHUNK_SIZE
            # Try to split at paragraph boundary
            if end < len(text):
                # Look for paragraph break near the end
                newline_pos = text.rfind("\n\n", start + CHUNK_SIZE - 1000, end + 500)
                if newline_pos > start:
                    end = newline_pos
                else:
                    # Fallback: split at last newline
                    newline_pos = text.rfind("\n", start + CHUNK_SIZE - 500, end + 200)
                    if newline_pos > start:
                        end = newline_pos

            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk)

            # Move forward with overlap
            start = end - CHUNK_OVERLAP if end < len(text) else end

        return chunks

    async def _merge_chunk_indices(
        self, chunk_indices: List[Dict], total_chunks: int
    ) -> dict:
        """Merge chunk topic indices into a unified summary."""
        # Format indices for the merge prompt
        indices_text = ""
        for i, idx in enumerate(chunk_indices):
            indices_text += f"\n--- ÚSEK {i+1} ---\n"
            # Extract topics from this chunk index
            topics = idx.get("topics", [])
            doc_type = idx.get("document_type", "")
            doc_title = idx.get("document_title", "")
            if doc_type:
                indices_text += f"Typ dokumentu: {doc_type}\n"
            if doc_title:
                indices_text += f"Název: {doc_title}\n"
            for topic in topics:
                title = topic.get("title", "?")
                facts = topic.get("key_facts", [])
                importance = topic.get("importance", "medium")
                indices_text += f"  Téma: {title} [{importance}]\n"
                for fact in facts:
                    indices_text += f"    • {fact}\n"
            warnings = idx.get("warnings", [])
            for w in warnings:
                indices_text += f"  ⚠️ {w}\n"

        prompt = MERGE_TOPICS_PROMPT_CS.format(
            total_chunks=total_chunks,
            chunk_indices=indices_text,
        )

        try:
            response = await self.enricher._call_llm(prompt)
            result = self._parse_llm_response(response, indices_text)
            result["chunks_processed"] = len(chunk_indices)
            result["total_chunks"] = total_chunks
            return result
        except Exception as e:
            logger.error(f"Merge phase failed: {e}")
            # Fallback: manually combine chunk topics without merging
            return self._manual_merge_fallback(chunk_indices)

    def _manual_merge_fallback(self, chunk_indices: List[Dict]) -> dict:
        """Fallback when LLM merge fails — simple concatenation of all topics."""
        all_topics = []
        doc_type = ""
        doc_title = ""
        all_warnings = []

        for idx in chunk_indices:
            if not doc_type and idx.get("document_type"):
                doc_type = idx["document_type"]
            if not doc_title and idx.get("document_title"):
                doc_title = idx["document_title"]
            for topic in idx.get("topics", []):
                all_topics.append({
                    "title": topic.get("title", "Bez názvu"),
                    "icon": topic.get("icon", "📋"),
                    "content": ", ".join(topic.get("key_facts", [])),
                    "key_facts": topic.get("key_facts", []),
                    "importance": topic.get("importance", "medium"),
                })
            all_warnings.extend(idx.get("warnings", []))

        return {
            "summary": f"Dokument typu '{doc_type}' obsahuje {len(all_topics)} témat.",
            "document_type": doc_type,
            "document_title": doc_title,
            "topics": all_topics,
            "warnings": list(set(all_warnings)),
            "model_used": self.preferred_model,
            "generated_at": datetime.now().isoformat(),
            "format": "adaptive_v2",
        }

    # =========================================================================
    # RESPONSE PARSING
    # =========================================================================

    def _parse_llm_response(self, response: Any, context_text: str) -> dict:
        """Parse LLM response (dict or string) into standardized result."""
        if response and isinstance(response, dict):
            return self._build_result(response)
        elif response and isinstance(response, str):
            try:
                parsed = json.loads(response)
                return self._build_result(parsed)
            except json.JSONDecodeError:
                return self._build_fallback_result(response, context_text)
        else:
            return self._build_fallback_result(
                "Nepodařilo se vygenerovat shrnutí.", context_text
            )

    def _build_result(self, data: dict) -> dict:
        """Build result from successfully parsed LLM JSON response."""
        topics = data.get("topics", [])

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

        return {
            "summary": data.get("executive_summary", ""),
            "document_type": data.get("document_type", "neznámý"),
            "document_title": data.get("document_title", ""),
            "topics": normalized_topics,
            "warnings": data.get("warnings", []),
            "model_used": self.preferred_model,
            "generated_at": datetime.now().isoformat(),
            "format": "adaptive_v2",
        }

    def _build_fallback_result(self, text: str, context_text: str) -> dict:
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
            "model_used": self.preferred_model,
            "generated_at": datetime.now().isoformat(),
            "format": "adaptive_v2",
        }


# =============================================================================
# CONVENIENCE FUNCTION (backward compatible)
# =============================================================================

async def summarize_document_brief(
    document_text: str,
    language: str = "cs",
    preferred_model: Optional[str] = None,
) -> dict:
    """
    Convenience function to generate adaptive summary.

    Handles any document size automatically:
    - Small docs: single LLM call (~3-5s)
    - Large docs (50+ pages): chunked map-reduce (~15-30s)

    Usage:
        result = await summarize_document_brief(
            document_text=full_text,
            language="cs",
            preferred_model="gemini"
        )

        print(f"Strategy: {result['strategy']}")
        for topic in result["topics"]:
            print(f"{topic['icon']} {topic['title']}")
            for fact in topic["key_facts"]:
                print(f"  • {fact}")
    """
    summarizer = BriefDocumentSummarizer(preferred_model=preferred_model)
    return await summarizer.summarize(document_text, language)
