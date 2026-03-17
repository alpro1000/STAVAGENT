"""
Vertex AI Search Integration
Использует GenAI кредит $1000 для семантического поиска по нормам ÚRS/OTSKP/ČSN

Graceful degradation: если VERTEX_DATA_STORE_ID не задан — логирует warning и возвращает [].
"""

import logging
from typing import List, Optional
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class NormMatch:
    """Результат поиска нормы"""
    norm_code: str
    title: str
    description: str
    unit: str
    unit_price_czk: float
    labor_hours: float
    confidence: float
    source: str  # "URS" | "OTSKP" | "CSN"


@dataclass
class DocumentSearchResult:
    """Универсальный результат поиска документа"""
    text: str
    source: str
    page: Optional[int]
    score: float
    metadata: dict


class VertexSearchClient:
    """
    Vertex AI Search для поиска по документам и нормам.

    Graceful degradation:
    - Если VERTEX_DATA_STORE_ID пуст → warning + return []
    - Если google-cloud-discoveryengine не установлен → warning + return []
    - Если credentials отсутствуют → warning + return []
    """

    def __init__(self):
        self.project_id = settings.GOOGLE_PROJECT_ID
        self.location = settings.VERTEX_LOCATION
        self.datastore_id = settings.VERTEX_DATA_STORE_ID
        self.collection = settings.VERTEX_COLLECTION
        self._client = None
        self._available = False

        if not self.datastore_id:
            logger.warning(
                "VERTEX_DATA_STORE_ID not set — Vertex AI Search disabled. "
                "Will fallback to Sonar/Perplexity for search."
            )
            return

        if not self.project_id:
            logger.warning(
                "GOOGLE_PROJECT_ID not set — Vertex AI Search disabled."
            )
            return

        # Lazy init: try to create client
        try:
            from google.cloud import discoveryengine_v1 as discoveryengine
            self._discoveryengine = discoveryengine
            self._client = discoveryengine.SearchServiceClient()
            self._available = True
            logger.info(
                f"Vertex AI Search initialized: project={self.project_id}, "
                f"datastore={self.datastore_id}, location={self.location}"
            )
        except ImportError:
            logger.warning(
                "google-cloud-discoveryengine not installed — Vertex AI Search disabled."
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Vertex AI Search client: {e}")

    @property
    def is_available(self) -> bool:
        """Check if Vertex AI Search is ready"""
        return self._available and self._client is not None

    def _build_serving_config(self) -> str:
        """Build the serving config path"""
        return (
            f"projects/{self.project_id}/locations/{self.location}/"
            f"collections/{self.collection}/dataStores/{self.datastore_id}/"
            f"servingConfigs/default_config"
        )

    async def search_documents(
        self,
        query: str,
        top_k: int = 5,
        source_filter: Optional[str] = None
    ) -> List[DocumentSearchResult]:
        """
        Поиск по документам в Data Store.

        Args:
            query: Поисковый запрос
            top_k: Количество результатов (1-20)
            source_filter: Фильтр по типу источника

        Returns:
            Список результатов. Пустой список если Vertex недоступен.
        """
        if not self.is_available:
            logger.debug("Vertex AI Search not available — returning empty results")
            return []

        try:
            discoveryengine = self._discoveryengine

            request = discoveryengine.SearchRequest(
                serving_config=self._build_serving_config(),
                query=query,
                page_size=top_k,
                query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                    condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO,
                ),
                spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                    mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                ),
            )

            if source_filter:
                request.filter = f'source: ANY("{source_filter}")'

            response = self._client.search(request)

            results = []
            for result in response.results:
                doc = result.document.derived_struct_data

                results.append(DocumentSearchResult(
                    text=doc.get("snippets", [{}])[0].get("snippet", "") if doc.get("snippets") else doc.get("description", doc.get("title", "")),
                    source=doc.get("link", doc.get("source", "vertex")),
                    page=int(doc.get("page", 0)) if doc.get("page") else None,
                    score=float(result.relevance_score or 0),
                    metadata={
                        "title": doc.get("title", ""),
                        "code": doc.get("code", ""),
                        "unit": doc.get("unit", ""),
                        "unit_price": doc.get("unit_price", ""),
                    }
                ))

            logger.info(f"Vertex search '{query[:50]}...' → {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Vertex AI Search error: {e}")
            return []

    async def search_norms(
        self,
        work_description: str,
        top_k: int = 5,
        source_filter: Optional[str] = None
    ) -> List[NormMatch]:
        """
        Семантический поиск норм по описанию работы.
        Обратная совместимость с существующим API.

        Returns:
            Список NormMatch. Пустой если Vertex недоступен.
        """
        if not self.is_available:
            logger.debug("Vertex AI Search not available — returning empty norms")
            return []

        try:
            discoveryengine = self._discoveryengine

            request = discoveryengine.SearchRequest(
                serving_config=self._build_serving_config(),
                query=work_description,
                page_size=top_k,
                query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                    condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO,
                ),
                spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                    mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                ),
            )

            if source_filter:
                request.filter = f'source: ANY("{source_filter}")'

            response = self._client.search(request)

            matches = []
            for result in response.results:
                doc = result.document.derived_struct_data

                matches.append(NormMatch(
                    norm_code=doc.get("code", ""),
                    title=doc.get("title", ""),
                    description=doc.get("description", ""),
                    unit=doc.get("unit", ""),
                    unit_price_czk=float(doc.get("unit_price", 0)),
                    labor_hours=float(doc.get("labor_hours", 0)),
                    confidence=float(result.relevance_score or 0),
                    source=doc.get("source", "UNKNOWN"),
                ))

            logger.info(f"Vertex norms search '{work_description[:50]}...' → {len(matches)} matches")
            return matches

        except Exception as e:
            logger.error(f"Vertex AI Search norms error: {e}")
            return []

    async def search_similar_positions(
        self,
        position_description: str,
        position_code: Optional[str] = None
    ) -> List[NormMatch]:
        """
        Найти похожие позиции для сопоставления.
        Используется в аудите для проверки цен.
        """
        query = position_description
        if position_code:
            query = f"{position_code} {position_description}"

        return await self.search_norms(query, top_k=3)


# Singleton instance with lazy initialization
_vertex_client: Optional[VertexSearchClient] = None


def get_vertex_client() -> VertexSearchClient:
    """Get or create Vertex AI Search client (always returns client, may be inactive)"""
    global _vertex_client
    if _vertex_client is None:
        _vertex_client = VertexSearchClient()
    return _vertex_client
