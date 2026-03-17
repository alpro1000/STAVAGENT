"""
Document Search Router — гибридный поиск по документам.

Стратегия:
1. mode="internal" → только Vertex AI Search (наши документы в GCS)
2. mode="web"      → только Perplexity Sonar (интернет)
3. mode="hybrid"   → Vertex AI сначала, fallback на Sonar если confidence < threshold

Graceful degradation на каждом уровне:
- Vertex недоступен → автоматически Sonar
- Sonar недоступен → возвращаем то что есть
- Оба недоступны → пустой результат с пояснением
"""

import logging
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict

from app.integrations.vertex_search import get_vertex_client, DocumentSearchResult
from app.services.sonar_search import get_sonar_search

logger = logging.getLogger(__name__)

# Минимальный confidence для результатов Vertex (ниже → fallback на Sonar)
VERTEX_CONFIDENCE_THRESHOLD = 0.5


@dataclass
class SearchCitation:
    """Цитата с источником"""
    text: str
    source: str
    url: Optional[str] = None
    page: Optional[int] = None


@dataclass
class HybridSearchResponse:
    """Унифицированный ответ гибридного поиска"""
    source: str  # "vertex" | "sonar" | "hybrid" | "none"
    results: List[Dict[str, Any]] = field(default_factory=list)
    citations: List[Dict[str, Any]] = field(default_factory=list)
    query: str = ""
    mode: str = "hybrid"
    duration_ms: int = 0
    vertex_available: bool = False
    sonar_available: bool = False
    fallback_used: bool = False
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class DocumentSearchRouter:
    """
    Гибридный поисковый роутер.

    Приоритет использования:
    - Нормы ČSN, OTSKP расценки → mode="internal" (Vertex)
    - Актуальные цены материалов → mode="web" (Sonar)
    - Анализ сметы + рыночный контекст → mode="hybrid"
    """

    def __init__(self):
        self._vertex = get_vertex_client()
        self._sonar = get_sonar_search()
        logger.info(
            f"DocumentSearchRouter initialized: "
            f"vertex={'ON' if self._vertex.is_available else 'OFF'}, "
            f"sonar={'ON' if self._sonar.is_available else 'OFF'}"
        )

    @property
    def vertex_available(self) -> bool:
        return self._vertex.is_available

    @property
    def sonar_available(self) -> bool:
        return self._sonar.is_available

    async def hybrid_search(
        self,
        query: str,
        mode: str = "hybrid",
        top_k: int = 5,
        confidence_threshold: float = VERTEX_CONFIDENCE_THRESHOLD
    ) -> HybridSearchResponse:
        """
        Выполнить поиск в выбранном режиме.

        Args:
            query: Поисковый запрос
            mode: "internal" | "web" | "hybrid"
            top_k: Количество результатов
            confidence_threshold: Порог confidence для Vertex (ниже → fallback)

        Returns:
            HybridSearchResponse с результатами и метаданными
        """
        start_time = time.time()

        response = HybridSearchResponse(
            source="none",
            query=query,
            mode=mode,
            vertex_available=self.vertex_available,
            sonar_available=self.sonar_available,
        )

        try:
            if mode == "internal":
                response = await self._search_internal(query, top_k, response)
            elif mode == "web":
                response = await self._search_web(query, response)
            elif mode == "hybrid":
                response = await self._search_hybrid(query, top_k, confidence_threshold, response)
            else:
                response.error = f"Unknown search mode: {mode}. Use 'internal', 'web', or 'hybrid'."

        except Exception as e:
            logger.error(f"DocumentSearchRouter error: {e}")
            response.error = str(e)

        response.duration_ms = int((time.time() - start_time) * 1000)

        logger.info(
            f"Search complete: mode={mode}, source={response.source}, "
            f"results={len(response.results)}, duration={response.duration_ms}ms, "
            f"fallback={response.fallback_used}"
        )
        return response

    async def _search_internal(
        self,
        query: str,
        top_k: int,
        response: HybridSearchResponse
    ) -> HybridSearchResponse:
        """Поиск только через Vertex AI (наши документы)"""
        if not self.vertex_available:
            response.source = "none"
            response.error = "Vertex AI Search not configured (VERTEX_DATA_STORE_ID is empty)"
            logger.warning("Internal search requested but Vertex AI not available")
            return response

        vertex_results = await self._vertex.search_documents(query, top_k=top_k)

        if vertex_results:
            response.source = "vertex"
            response.results = [
                {
                    "text": r.text,
                    "source": r.source,
                    "page": r.page,
                    "score": r.score,
                    "metadata": r.metadata,
                }
                for r in vertex_results
            ]
            response.citations = [
                {
                    "text": r.text[:200],
                    "source": r.source,
                    "page": r.page,
                }
                for r in vertex_results
            ]
        else:
            response.source = "vertex"
            # Пустые результаты — Vertex работает, но ничего не нашёл

        return response

    async def _search_web(
        self,
        query: str,
        response: HybridSearchResponse
    ) -> HybridSearchResponse:
        """Поиск только через Sonar (интернет)"""
        if not self.sonar_available:
            response.source = "none"
            response.error = "Perplexity Sonar not configured (PERPLEXITY_API_KEY is empty)"
            logger.warning("Web search requested but Sonar not available")
            return response

        sonar_result = await self._sonar.search_web(query)

        if sonar_result.get("found"):
            response.source = "sonar"
            response.results = sonar_result.get("results", [])
            response.citations = [
                {"text": "", "source": url, "url": url}
                for url in sonar_result.get("citations", [])
                if isinstance(url, str)
            ]
        else:
            response.source = "sonar"

        return response

    async def _search_hybrid(
        self,
        query: str,
        top_k: int,
        confidence_threshold: float,
        response: HybridSearchResponse
    ) -> HybridSearchResponse:
        """
        Гибридный поиск: Vertex → Sonar fallback.

        Логика:
        1. Пробуем Vertex AI Search
        2. Если Vertex недоступен или результаты ниже threshold → Sonar
        3. Если оба недоступны → пустой результат
        """
        # Step 1: Try Vertex
        vertex_results = []
        vertex_ok = False

        if self.vertex_available:
            vertex_results = await self._vertex.search_documents(query, top_k=top_k)

            # Проверяем confidence
            if vertex_results:
                max_score = max(r.score for r in vertex_results)
                if max_score >= confidence_threshold:
                    vertex_ok = True
                    logger.info(f"Vertex returned {len(vertex_results)} results, max_score={max_score:.2f} >= {confidence_threshold}")
                else:
                    logger.info(f"Vertex results below threshold: max_score={max_score:.2f} < {confidence_threshold}")

        # Step 2: If Vertex OK → use it
        if vertex_ok:
            response.source = "vertex"
            response.results = [
                {
                    "text": r.text,
                    "source": r.source,
                    "page": r.page,
                    "score": r.score,
                    "metadata": r.metadata,
                }
                for r in vertex_results
            ]
            response.citations = [
                {"text": r.text[:200], "source": r.source, "page": r.page}
                for r in vertex_results
            ]
            return response

        # Step 3: Fallback to Sonar
        if self.sonar_available:
            logger.info("Falling back to Sonar search")
            response.fallback_used = True

            sonar_result = await self._sonar.search_web(query)

            if sonar_result.get("found"):
                # Если Vertex тоже что-то нашёл (но ниже threshold), объединяем
                if vertex_results:
                    response.source = "hybrid"
                    response.results = [
                        {
                            "text": r.text,
                            "source": r.source,
                            "page": r.page,
                            "score": r.score,
                            "metadata": r.metadata,
                        }
                        for r in vertex_results
                    ] + sonar_result.get("results", [])
                    response.citations = [
                        {"text": r.text[:200], "source": r.source, "page": r.page}
                        for r in vertex_results
                    ] + [
                        {"text": "", "source": url, "url": url}
                        for url in sonar_result.get("citations", [])
                        if isinstance(url, str)
                    ]
                else:
                    response.source = "sonar"
                    response.results = sonar_result.get("results", [])
                    response.citations = [
                        {"text": "", "source": url, "url": url}
                        for url in sonar_result.get("citations", [])
                        if isinstance(url, str)
                    ]
            else:
                # Sonar тоже ничего не нашёл — возвращаем Vertex результаты если есть
                if vertex_results:
                    response.source = "vertex"
                    response.results = [
                        {
                            "text": r.text,
                            "source": r.source,
                            "page": r.page,
                            "score": r.score,
                            "metadata": r.metadata,
                        }
                        for r in vertex_results
                    ]
                else:
                    response.source = "none"
        else:
            # Sonar недоступен — возвращаем Vertex результаты если есть (даже ниже threshold)
            if vertex_results:
                response.source = "vertex"
                response.results = [
                    {
                        "text": r.text,
                        "source": r.source,
                        "page": r.page,
                        "score": r.score,
                        "metadata": r.metadata,
                    }
                    for r in vertex_results
                ]
            else:
                response.source = "none"
                if not self.vertex_available and not self.sonar_available:
                    response.error = "Both Vertex AI Search and Perplexity Sonar are not configured"

        return response


# Singleton
_router: Optional[DocumentSearchRouter] = None


def get_document_search_router() -> DocumentSearchRouter:
    """Get or create DocumentSearchRouter instance"""
    global _router
    if _router is None:
        _router = DocumentSearchRouter()
    return _router
