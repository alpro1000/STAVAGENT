"""
Document Search API — POST /api/search/docs

Гибридный поиск по документам:
- mode="internal" → Vertex AI Search (нормы, расценки в GCS)
- mode="web"      → Perplexity Sonar Pro (интернет, актуальные цены)
- mode="hybrid"   → Vertex сначала, fallback на Sonar

Graceful degradation: работает даже если один или оба провайдера недоступны.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

from app.services.document_search_router import get_document_search_router

router = APIRouter(prefix="/api/search", tags=["document-search"])


class SearchMode(str, Enum):
    internal = "internal"
    web = "web"
    hybrid = "hybrid"


class DocumentSearchRequest(BaseModel):
    """Запрос на поиск по документам"""
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        description="Поисковый запрос"
    )
    mode: SearchMode = Field(
        default=SearchMode.hybrid,
        description="Режим поиска: internal (Vertex), web (Sonar), hybrid (Vertex→Sonar fallback)"
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Количество результатов"
    )
    confidence_threshold: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Порог confidence для Vertex (ниже → fallback на Sonar)"
    )


class SearchResultItem(BaseModel):
    """Один результат поиска"""
    text: str
    source: str
    page: Optional[int] = None
    score: Optional[float] = None
    metadata: Dict[str, Any] = {}


class CitationItem(BaseModel):
    """Цитата с источником"""
    text: str = ""
    source: str = ""
    url: Optional[str] = None
    page: Optional[int] = None


class DocumentSearchResponse(BaseModel):
    """Ответ поиска по документам"""
    source: str = Field(description="Источник результатов: vertex | sonar | hybrid | none")
    results: List[Dict[str, Any]] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    query: str
    mode: str
    duration_ms: int = 0
    vertex_available: bool = False
    sonar_available: bool = False
    fallback_used: bool = False
    error: Optional[str] = None


class SearchStatusResponse(BaseModel):
    """Статус поисковых провайдеров"""
    vertex_available: bool
    sonar_available: bool
    vertex_data_store_id: str
    vertex_location: str


@router.post("/docs", response_model=DocumentSearchResponse)
async def search_documents(request: DocumentSearchRequest):
    """
    Гибридный поиск по документам.

    **Режимы:**
    - `internal` — поиск по нашим документам через Vertex AI Search (ÚRS, OTSKP, ČSN)
    - `web` — поиск в интернете через Perplexity Sonar Pro (актуальные цены, рынок)
    - `hybrid` — сначала Vertex, при низком confidence fallback на Sonar

    **Примеры использования:**
    - Нормы ČSN → `mode="internal"`, query="ČSN EN 206 beton specifikace"
    - Актуальные цены → `mode="web"`, query="cena betonu C30/37 Praha 2026"
    - Анализ сметы → `mode="hybrid"`, query="betonáž základů železobeton"

    **Graceful degradation:**
    - Если VERTEX_DATA_STORE_ID не задан → Vertex пропускается
    - Если PERPLEXITY_API_KEY не задан → Sonar пропускается
    - Если оба не настроены → пустой результат с error
    """
    try:
        search_router = get_document_search_router()

        result = await search_router.hybrid_search(
            query=request.query,
            mode=request.mode.value,
            top_k=request.top_k,
            confidence_threshold=request.confidence_threshold,
        )

        return DocumentSearchResponse(**result.to_dict())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.get("/status", response_model=SearchStatusResponse)
async def search_status():
    """
    Статус поисковых провайдеров.

    Проверяет доступность Vertex AI Search и Perplexity Sonar.
    """
    from app.core.config import settings

    search_router = get_document_search_router()

    return SearchStatusResponse(
        vertex_available=search_router.vertex_available,
        sonar_available=search_router.sonar_available,
        vertex_data_store_id=settings.VERTEX_DATA_STORE_ID or "(not set)",
        vertex_location=settings.VERTEX_LOCATION,
    )
