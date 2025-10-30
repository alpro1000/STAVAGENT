"""
Construction Assistant Service
Строительный помощник без документов - отвечает на вопросы о технологиях, нормах, материалах
"""
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.core.claude_client import ClaudeClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConstructionAssistant:
    """
    Строительный AI-помощник

    Отвечает на вопросы о:
    - Технологических процессах (монтаж, укладка, бетонирование)
    - Чешских нормах ČSN
    - Материалах и спецификациях
    - OTSKP/KROS/RTS кодах
    - Безопасности работ

    Фильтрует нерелевантные вопросы (не о строительстве).
    """

    def __init__(self):
        """Initialize Construction Assistant"""
        self.claude = ClaudeClient()
        self.system_prompt = self._load_system_prompt()

        # Keywords для определения строительных тем
        self.construction_keywords = {
            # Материалы
            "beton", "cement", "ocel", "armatura", "výztuž", "bednění", "opálubka",
            "trubka", "potrubí", "kanalizace", "vodovod", "izolace", "hydroizolace",

            # Конструкции
            "základ", "pilíř", "stěna", "strop", "sloup", "průvlak", "překlad",
            "šachta", "jímka", "základová deska", "základový pás",

            # Процессы
            "montáž", "instalace", "pokládka", "betonáž", "výstavba", "stavba",
            "výkop", "zhutňování", "zatěsnění", "izolování",

            # Нормы и коды
            "čsn", "otskp", "kros", "rts", "úrs", "norma", "standard",
            "eurokód", "předpis", "technická norma",

            # Общие строительные термины
            "stavba", "stavební", "konstrukce", "projekt", "výkres",
            "rozpočet", "kalkulace", "výměra", "soupis prací",

            # Типы работ
            "zemní práce", "základy", "hrubá stavba", "dokončovací práce",
            "zednické práce", "betonářské práce",

            # Инструменты и техника
            "beton", "malta", "rýpadlo", "vibrační deska", "míchačka",
        }

    def _load_system_prompt(self) -> str:
        """Load construction expert system prompt"""
        prompt_path = settings.PROMPTS_DIR / "claude" / "assistant" / "construction_expert.txt"

        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"System prompt not found at {prompt_path}, using default")
            return self._default_system_prompt()

    def _default_system_prompt(self) -> str:
        """Fallback system prompt if file not found"""
        return """Jsi odborník na české stavebnictví. Odpovídáš pouze na otázky týkající se stavebnictví,
                  norem ČSN, technologických postupů, materiálů a montáže. Nerelevantní otázky zdvořile odmítneš."""

    def is_construction_related(self, question: str) -> bool:
        """
        Check if question is related to construction

        Args:
            question: User's question

        Returns:
            True if question is about construction, False otherwise
        """
        question_lower = question.lower()

        # Check for construction keywords
        keyword_matches = sum(
            1 for keyword in self.construction_keywords
            if keyword in question_lower
        )

        # If multiple keywords found, likely construction-related
        if keyword_matches >= 2:
            return True

        # Single keyword + question words = likely construction
        if keyword_matches >= 1:
            question_indicators = ["jak", "co", "kde", "kdy", "proč", "kolik", "?"]
            if any(indicator in question_lower for indicator in question_indicators):
                return True

        # Use Claude to double-check ambiguous cases
        if keyword_matches == 0:
            return self._claude_topic_check(question)

        return keyword_matches > 0

    def _claude_topic_check(self, question: str) -> bool:
        """
        Use Claude to check if question is construction-related

        Args:
            question: User's question

        Returns:
            True if construction-related, False otherwise
        """
        try:
            check_prompt = f"""Určete, zda je tato otázka relevantní pro české stavebnictví, montáž, technologie nebo normy ČSN.

Otázka: "{question}"

Odpovězte pouze "ANO" nebo "NE":
- ANO - pokud je otázka o stavebnictví, materiálech, nормách, montáži, technologiích
- NE - pokud je o jiném tématu (vaření, politika, zdraví, programování, atd.)

Odpověď:"""

            response = self.claude.call(check_prompt, temperature=0.1)
            answer = response.get("raw_text", "").strip().upper()

            return "ANO" in answer or "YES" in answer

        except Exception as e:
            logger.warning(f"Topic check failed: {e}, assuming construction-related")
            # If check fails, assume it's construction-related to be safe
            return True

    def ask(
        self,
        question: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ask construction expert a question

        Args:
            question: User's question
            context: Optional context (project data, previous messages)

        Returns:
            Dict with answer and metadata:
            {
                "answer": str,
                "relevant": bool,
                "sources": List[str],
                "related_norms": List[str]
            }
        """
        logger.info(f"Construction Assistant: Received question: {question[:100]}...")

        # Check if question is construction-related
        is_relevant = self.is_construction_related(question)

        if not is_relevant:
            return {
                "answer": (
                    "Promiň, jsem specializovaný asistent pro české stavebnictví. "
                    "Pomůžu ti s technologickými postupy, normami ČSN, materiály a montáží. "
                    "Máš nějaký stavební dotaz? Například o montáži vodoměrné šachty, "
                    "pokládce potrubí nebo betonáži konstrukcí?"
                ),
                "relevant": False,
                "sources": [],
                "related_norms": []
            }

        # Build prompt with context
        full_prompt = self._build_prompt(question, context)

        # Get answer from Claude
        try:
            response = self.claude.call(
                full_prompt,
                system_prompt=self.system_prompt,
                temperature=0.3
            )

            answer = response.get("raw_text", "Omlouváme se, nepodařilo se získat odpověď.")

            # Extract norms mentioned in answer
            related_norms = self._extract_norms(answer)

            return {
                "answer": answer,
                "relevant": True,
                "sources": ["Knowledge Base", "ČSN Normy", "OTSKP"],
                "related_norms": related_norms
            }

        except Exception as e:
            logger.error(f"Construction Assistant error: {e}", exc_info=True)
            return {
                "answer": f"Omlouváme se, došlo k chybě: {str(e)}",
                "relevant": True,
                "sources": [],
                "related_norms": []
            }

    def _build_prompt(self, question: str, context: Optional[Dict[str, Any]]) -> str:
        """Build full prompt with question and context"""
        prompt_parts = []

        # Add context if provided
        if context:
            project_name = context.get("project_name")
            if project_name:
                prompt_parts.append(f"KONTEXT: Projekt '{project_name}'")

            materials = context.get("materials")
            if materials:
                prompt_parts.append(f"MATERIÁLY V PROJEKTU: {', '.join(materials[:5])}")

        # Add main question
        prompt_parts.append(f"\nOTÁZKA: {question}")

        return "\n\n".join(prompt_parts)

    def _extract_norms(self, text: str) -> List[str]:
        """Extract ČSN norm references from text"""
        import re

        # Pattern for ČSN norms: ČSN EN 206+A2, ČSN 73 0600, etc.
        patterns = [
            r'ČSN\s+EN\s+\d+(?:\+[A-Z]\d+)?',  # ČSN EN 206+A2
            r'ČSN\s+\d+\s+\d+',                 # ČSN 73 0600
        ]

        norms = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            norms.extend(matches)

        # Remove duplicates and return
        return list(set(norms))


# Singleton instance
construction_assistant = ConstructionAssistant()


__all__ = ["ConstructionAssistant", "construction_assistant"]
