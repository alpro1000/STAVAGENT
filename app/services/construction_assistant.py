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
        """Load construction expert system prompt (STAV EXPERT v2)"""
        # Try v2 first
        prompt_v2_path = settings.PROMPTS_DIR / "claude" / "assistant" / "stav_expert_v2.txt"
        if prompt_v2_path.exists():
            try:
                with open(prompt_v2_path, 'r', encoding='utf-8') as f:
                    logger.info("✅ Loaded STAV EXPERT v2 prompt (RAG++)")
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to load v2 prompt: {e}")

        # Fallback to v1
        prompt_v1_path = settings.PROMPTS_DIR / "claude" / "assistant" / "construction_expert.txt"
        if prompt_v1_path.exists():
            try:
                with open(prompt_v1_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to load v1 prompt: {e}")

        # Ultimate fallback
        logger.warning("Using default system prompt")
        return self._default_system_prompt()

    def _default_system_prompt(self) -> str:
        """Fallback system prompt if file not found"""
        return """Jsi STAV EXPERT — odborník na české stavebnictví.
Odpovídáš MULTILINGVÁLNĚ (v jazyce dotazu).
Odpovídáš pouze na otázky o stavebnictví, normách ČSN, technologiích, materiálech.
Nerelevantní otázky zdvořile odmítneš.
Vždy uvedeš zdroje a confidence score."""

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
        Ask construction expert a question (STAV EXPERT RAG++)

        Args:
            question: User's question (any language)
            context: Optional context (project data, previous messages)

        Returns:
            Dict with answer and metadata:
            {
                "answer": str,
                "relevant": bool,
                "sources": List[str],
                "related_norms": List[str],
                "confidence": float,  # 0.0 - 1.0
                "rfi": List[str],     # Requests for Information
                "language": str        # Detected language
            }
        """
        logger.info(f"🏗️  STAV EXPERT: {question[:100]}...")

        # Detect question language
        detected_lang = self._detect_language(question)
        logger.info(f"📝 Detected language: {detected_lang}")

        # Check if question is construction-related
        is_relevant = self.is_construction_related(question)

        if not is_relevant:
            # Multilingual rejection
            rejection = self._get_rejection_message(detected_lang)
            return {
                "answer": rejection,
                "relevant": False,
                "sources": [],
                "related_norms": [],
                "confidence": 1.0,
                "rfi": [],
                "language": detected_lang
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

            # Extract metadata from answer
            related_norms = self._extract_norms(answer)
            confidence = self._extract_confidence(answer)
            rfi = self._extract_rfi(answer)
            sources = self._extract_sources(answer)

            return {
                "answer": answer,
                "relevant": True,
                "sources": sources or ["Knowledge Base", "ČSN Normy", "OTSKP"],
                "related_norms": related_norms,
                "confidence": confidence,
                "rfi": rfi,
                "language": detected_lang
            }

        except Exception as e:
            logger.error(f"Construction Assistant error: {e}", exc_info=True)
            return {
                "answer": f"Omlouváme se, došlo k chybě: {str(e)}",
                "relevant": True,
                "sources": [],
                "related_norms": [],
                "confidence": 0.0,
                "rfi": [f"ERROR: {str(e)}"],
                "language": detected_lang
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

    def _detect_language(self, text: str) -> str:
        """Detect language of text: 'cs', 'ru', 'en', or 'unknown'"""
        text_lower = text.lower()

        czech_words = ['jak', 'co', 'kde', 'kdy', 'proč', 'kolik']
        russian_words = ['как', 'что', 'где', 'когда', 'почему', 'сколько']
        english_words = ['how', 'what', 'where', 'when', 'why']

        czech_chars = ['ř', 'ž', 'č', 'š', 'ě', 'ů']
        russian_chars = ['ы', 'э', 'ъ', 'ё', 'ю', 'я']

        czech_score = sum(1 for w in czech_words if w in text_lower) + sum(1 for c in czech_chars if c in text_lower) * 2
        russian_score = sum(1 for w in russian_words if w in text_lower) + sum(1 for c in russian_chars if c in text_lower) * 2
        english_score = sum(1 for w in english_words if w in text_lower)

        scores = {'cs': czech_score, 'ru': russian_score, 'en': english_score}
        max_lang = max(scores, key=scores.get)
        return max_lang if scores[max_lang] > 0 else 'unknown'

    def _get_rejection_message(self, language: str) -> str:
        """Get rejection message in appropriate language"""
        messages = {
            'cs': "Promiň, jsem specializovaný asistent pro české stavebnictví. Pomůžu ti s technologickými postupy, normami ČSN, materiály a montáží. Máš nějaký stavební dotaz?",
            'ru': "Извини, я специализированный помощник по чешскому строительству. Помогу с технологическими процессами, нормами ČSN, материалами и монтажом. Есть строительный вопрос?",
            'en': "Sorry, I'm a specialized assistant for Czech construction. I can help with processes, ČSN norms, materials and installation. Do you have a construction question?"
        }
        return messages.get(language, messages['cs'])

    def _extract_confidence(self, text: str) -> float:
        """Extract confidence score from answer"""
        import re
        patterns = [r'CONFIDENCE[:\s]+([0-9]\.[0-9]+)', r'Důvěra[:\s]+([0-9]\.[0-9]+)']
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return min(max(float(match.group(1)), 0.0), 1.0)
                except ValueError:
                    continue
        return 0.85  # Default

    def _extract_rfi(self, text: str) -> List[str]:
        """Extract RFI (Requests for Information) from answer"""
        import re
        rfis = []
        numbered = re.findall(r'⚠️\s*RFI\s*#?\d+:\s*([^\n]+)', text)
        rfis.extend(numbered)
        if not rfis:
            general = re.findall(r'RFI[:\s]+([^\n]+)', text, re.IGNORECASE)
            rfis.extend(general)
        return rfis

    def _extract_sources(self, text: str) -> List[str]:
        """Extract sources mentioned in answer"""
        import re
        sources = []
        patterns = [r'🔍\s*Zdroj:\s*([^\n]+)', r'Zdroj:\s*([^\n]+)', r'Source:\s*([^\n]+)']
        for pattern in patterns:
            sources.extend(re.findall(pattern, text, re.IGNORECASE))
        csn_refs = self._extract_norms(text)
        if csn_refs:
            sources.extend([f"ČSN: {norm}" for norm in csn_refs])
        return list(set(sources))


# Singleton instance
construction_assistant = ConstructionAssistant()


__all__ = ["ConstructionAssistant", "construction_assistant"]
