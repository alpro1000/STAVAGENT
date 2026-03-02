"""
Brief Document Summarizer - Quick Text Summary

Provides SHORT text summaries (5-10 sentences) instead of structured JSON.
This is what users expect when they say "shrnutí dokumentu" (document summary).

Difference from passport_enricher.py:
- passport_enricher.py: Structured data extraction (JSON with 50+ fields)
- brief_summarizer.py: Plain text summary (5-10 sentences)

Performance:
- Processing time: 2-3 seconds (vs 300s for full passport)
- Prompt length: 2K chars (vs 30K for full passport)
- Output: Plain text (vs complex JSON)

Author: STAVAGENT Team
Version: 1.0.0
Date: 2025-03-02
"""

import logging
import time
from typing import Optional
from datetime import datetime

from app.core.config import settings
from app.services.passport_enricher import PassportEnricher

logger = logging.getLogger(__name__)


class BriefDocumentSummarizer:
    """
    Generates brief text summaries of construction documents.
    
    Use cases:
    - Quick document overview
    - Email notifications
    - Dashboard previews
    - User-friendly summaries
    """
    
    # Short prompt for brief summary (Czech)
    BRIEF_SUMMARY_PROMPT_CS = """Analyzuj tento stavební dokument a vytvoř KRÁTKÉ SHRNUTÍ (5-10 vět).

DOKUMENT:
{document_text}

ÚKOL: Napiš stručné shrnutí, které obsahuje:
1. Název projektu
2. Typ stavby (most, budova, silnice, atd.)
3. Lokace (město, km, adresa)
4. Klíčové parametry (beton, výztuž, objemy)
5. Speciální požadavky (pokud jsou)
6. Termín realizace (pokud je uveden)
7. Investor/Objednatel (pokud je uveden)

FORMÁT ODPOVĚDI:
Projekt: [název]
Typ: [typ stavby]
Lokace: [místo]
Parametry: [klíčové údaje]
Speciální požadavky: [pokud jsou]
Termín: [pokud je]
Investor: [pokud je]

PRAVIDLA:
- Maximálně 10 vět
- Pouze fakta z dokumentu, NEVYMÝŠLEJ
- Pokud informace není v dokumentu, nepiš ji
- Používej české termíny
- Buď konkrétní (čísla, jednotky)

PŘÍKLAD:
Projekt: Most přes Chrudimku km 15.2
Typ: Silniční most, monolitická ŽB konstrukce
Lokace: Silnice I/37, okres Chrudim
Parametry: Beton C30/37 XC4 XF4 XD2, celkem 450 m³. Výztuž B500B, 85 tun. Rozpětí 3×25m.
Speciální požadavky: Vysoké třídy prostředí (XC4 XF4 XD2), pohledový beton na líci.
Termín: Zahájení 2025-06, dokončení 2026-03 (9 měsíců).
Investor: Ředitelství silnic a dálnic ČR.

Vrať POUZE shrnutí, žádný další text."""

    BRIEF_SUMMARY_PROMPT_EN = """Analyze this construction document and create a BRIEF SUMMARY (5-10 sentences).

DOCUMENT:
{document_text}

TASK: Write a concise summary that includes:
1. Project name
2. Structure type (bridge, building, road, etc.)
3. Location (city, km, address)
4. Key parameters (concrete, reinforcement, volumes)
5. Special requirements (if any)
6. Timeline (if mentioned)
7. Client/Investor (if mentioned)

RESPONSE FORMAT:
Project: [name]
Type: [structure type]
Location: [place]
Parameters: [key data]
Special requirements: [if any]
Timeline: [if any]
Client: [if any]

RULES:
- Maximum 10 sentences
- Only facts from document, DO NOT INVENT
- If information is not in document, don't write it
- Be specific (numbers, units)

Return ONLY the summary, no other text."""

    def __init__(self, preferred_model: Optional[str] = None):
        """
        Initialize brief summarizer.
        
        Args:
            preferred_model: Preferred AI model (gemini, claude-haiku, openai-mini)
                Default: gemini (FREE, fast)
        """
        # Use same enricher but with different prompt
        self.enricher = PassportEnricher(preferred_model=preferred_model or "gemini")
        logger.info(f"BriefDocumentSummarizer initialized (model: {preferred_model or 'gemini'})")
    
    async def summarize(
        self,
        document_text: str,
        language: str = "cs",
        max_chars: int = 2000
    ) -> dict:
        """
        Generate brief text summary of document.
        
        Args:
            document_text: Full document text
            language: Language for summary (cs, en)
            max_chars: Maximum characters to send to LLM (default: 2000)
        
        Returns:
            {
                "summary": str,           # Brief text summary
                "processing_time_ms": int,
                "chars_processed": int,
                "model_used": str
            }
        """
        start_time = time.time()
        
        logger.info(f"Generating brief summary ({language})")
        
        # Truncate document to first 2K chars (much shorter than passport's 30K)
        truncated_text = document_text[:max_chars] if len(document_text) > max_chars else document_text
        
        # Select prompt based on language
        if language == "cs":
            prompt = self.BRIEF_SUMMARY_PROMPT_CS.format(document_text=truncated_text)
        else:
            prompt = self.BRIEF_SUMMARY_PROMPT_EN.format(document_text=truncated_text)
        
        # Call LLM
        try:
            response = await self.enricher._call_llm(prompt)
            
            if response:
                # Extract summary text (response might be JSON or plain text)
                if isinstance(response, dict):
                    summary_text = response.get('summary', str(response))
                else:
                    summary_text = str(response)
            else:
                summary_text = "Nepodařilo se vygenerovat shrnutí. Zkuste to prosím znovu."
                logger.warning("LLM returned no response")
        
        except Exception as e:
            logger.error(f"Brief summary generation failed: {e}")
            summary_text = f"Chyba při generování shrnutí: {str(e)}"
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Brief summary complete: {processing_time}ms")
        
        return {
            "summary": summary_text,
            "processing_time_ms": processing_time,
            "chars_processed": len(truncated_text),
            "model_used": self.enricher.preferred_model,
            "generated_at": datetime.now().isoformat()
        }


# Convenience function
async def summarize_document_brief(
    document_text: str,
    language: str = "cs",
    preferred_model: Optional[str] = None
) -> dict:
    """
    Convenience function to generate brief summary.
    
    Usage:
        result = await summarize_document_brief(
            document_text=full_text,
            language="cs",
            preferred_model="gemini"
        )
        
        print(result["summary"])
    """
    summarizer = BriefDocumentSummarizer(preferred_model=preferred_model)
    return await summarizer.summarize(document_text, language)
