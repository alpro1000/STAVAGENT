"""
Sonar Search — обёртка над Perplexity Sonar Pro API для внешнего поиска.

Использует существующий PerplexityClient для:
- Поиска актуальных цен материалов на рынке
- Поиска информации из открытых источников
- Fallback когда Vertex AI Search недоступен

Graceful degradation: если PERPLEXITY_API_KEY не задан — логирует warning и возвращает пустой результат.
"""

import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict

from app.core.config import settings
from app.core.perplexity_client import get_perplexity_client

logger = logging.getLogger(__name__)


@dataclass
class SonarSearchResult:
    """Результат поиска Sonar"""
    text: str
    source: str
    score: float
    citations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class SonarSearch:
    """
    Web-поиск через Perplexity Sonar Pro API.

    Обёртка над существующим PerplexityClient с унифицированным форматом ответа.
    Если Perplexity недоступен — graceful degradation (пустые результаты).
    """

    def __init__(self):
        self._client = get_perplexity_client()
        if self._client:
            logger.info("SonarSearch initialized with Perplexity Sonar Pro")
        else:
            logger.warning(
                "Perplexity API not configured — SonarSearch disabled. "
                "Set PERPLEXITY_API_KEY and ALLOW_WEB_SEARCH=true to enable."
            )

    @property
    def is_available(self) -> bool:
        """Check if Sonar search is ready"""
        return self._client is not None

    async def search_web(self, query: str) -> Dict[str, Any]:
        """
        Общий веб-поиск через Sonar Pro.

        Args:
            query: Поисковый запрос (свободный текст)

        Returns:
            {
                "found": bool,
                "text": str,         # Основной текст ответа
                "citations": [...],   # Ссылки на источники
                "results": [...]      # Список SonarSearchResult
            }
        """
        if not self.is_available:
            logger.debug("SonarSearch not available — returning empty results")
            return {"found": False, "text": "", "citations": [], "results": []}

        try:
            # Используем _search() метод PerplexityClient напрямую
            response = await self._client._search(
                query=query,
                search_recency_filter="month"
            )

            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
            citations = response.get("citations", [])

            results = []
            if content:
                results.append(SonarSearchResult(
                    text=content,
                    source="perplexity_sonar",
                    score=0.8,  # Sonar не возвращает score, ставим базовый
                    citations=citations if isinstance(citations, list) else [],
                    metadata={"model": "sonar-pro", "query": query}
                ))

            logger.info(f"Sonar search '{query[:50]}...' → {len(content)} chars, {len(citations)} citations")
            return {
                "found": bool(content),
                "text": content,
                "citations": citations if isinstance(citations, list) else [],
                "results": [r.to_dict() for r in results]
            }

        except Exception as e:
            logger.error(f"SonarSearch error: {e}")
            return {"found": False, "text": "", "citations": [], "results": [], "error": str(e)}

    async def search_market_prices(self, query: str, region: str = "Czech Republic") -> Dict[str, Any]:
        """
        Поиск актуальных рыночных цен материалов.

        Args:
            query: Описание материала/работы
            region: Регион для цен

        Returns:
            Результат с ценами и источниками
        """
        if not self.is_available:
            return {"found": False, "text": "", "citations": [], "results": []}

        try:
            # Используем специализированный метод PerplexityClient
            result = await self._client.search_market_price(
                description=query,
                unit="",  # Не ограничиваем единицу
                region=region
            )

            citations = result.get("citations", [])
            raw_response = result.get("raw_response", "")

            results = []
            if result.get("found"):
                results.append(SonarSearchResult(
                    text=raw_response,
                    source="perplexity_sonar",
                    score=0.85,
                    citations=citations if isinstance(citations, list) else [],
                    metadata={
                        "price_range": result.get("price_range"),
                        "type": "market_price"
                    }
                ))

            return {
                "found": result.get("found", False),
                "text": raw_response,
                "citations": citations if isinstance(citations, list) else [],
                "results": [r.to_dict() for r in results],
                "price_range": result.get("price_range")
            }

        except Exception as e:
            logger.error(f"SonarSearch market price error: {e}")
            return {"found": False, "text": "", "citations": [], "results": [], "error": str(e)}

    async def search_norms(self, query: str) -> Dict[str, Any]:
        """
        Поиск норм ČSN, KROS кодов через веб.
        Fallback когда Vertex AI Search недоступен.

        Args:
            query: Описание работы или код нормы

        Returns:
            Результат с найденными нормами
        """
        if not self.is_available:
            return {"found": False, "text": "", "citations": [], "results": []}

        try:
            # Используем специализированный метод для KROS
            result = await self._client.search_kros_code(
                description=query
            )

            citations = result.get("citations", [])
            raw_response = result.get("raw_response", "")

            results = []
            if result.get("found"):
                results.append(SonarSearchResult(
                    text=raw_response,
                    source="perplexity_sonar",
                    score=0.75,
                    citations=citations if isinstance(citations, list) else [],
                    metadata={
                        "codes": result.get("codes", []),
                        "type": "norms_search"
                    }
                ))

            return {
                "found": result.get("found", False),
                "text": raw_response,
                "citations": citations if isinstance(citations, list) else [],
                "results": [r.to_dict() for r in results],
                "codes": result.get("codes", [])
            }

        except Exception as e:
            logger.error(f"SonarSearch norms error: {e}")
            return {"found": False, "text": "", "citations": [], "results": [], "error": str(e)}


# Singleton
_sonar_search: Optional[SonarSearch] = None


def get_sonar_search() -> SonarSearch:
    """Get or create SonarSearch instance"""
    global _sonar_search
    if _sonar_search is None:
        _sonar_search = SonarSearch()
    return _sonar_search
