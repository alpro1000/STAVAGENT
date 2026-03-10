"""
Vertex AI Search API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.integrations.vertex_search import get_vertex_client, NormMatch

router = APIRouter(prefix="/api/v1/vertex", tags=["vertex-search"])


class SearchRequest(BaseModel):
    work_description: str = Field(..., description="Описание работы")
    top_k: int = Field(5, ge=1, le=20, description="Количество результатов")
    source_filter: Optional[str] = Field(None, description="Фильтр по источнику (URS/OTSKP/CSN)")


class NormMatchResponse(BaseModel):
    norm_code: str
    title: str
    description: str
    unit: str
    unit_price_czk: float
    labor_hours: float
    confidence: float
    source: str


@router.post("/search", response_model=List[NormMatchResponse])
async def search_norms(request: SearchRequest):
    """
    Семантический поиск норм по описанию работы.
    
    Использует Vertex AI Search для поиска в базе ÚRS/OTSKP/ČSN.
    """
    try:
        client = get_vertex_client()
        matches = await client.search_norms(
            work_description=request.work_description,
            top_k=request.top_k,
            source_filter=request.source_filter
        )
        return [
            NormMatchResponse(
                norm_code=m.norm_code,
                title=m.title,
                description=m.description,
                unit=m.unit,
                unit_price_czk=m.unit_price_czk,
                labor_hours=m.labor_hours,
                confidence=m.confidence,
                source=m.source
            )
            for m in matches
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similar", response_model=List[NormMatchResponse])
async def search_similar_positions(
    position_description: str,
    position_code: Optional[str] = None
):
    """
    Найти похожие позиции для сопоставления.
    
    Используется в аудите для проверки цен.
    """
    try:
        client = get_vertex_client()
        matches = await client.search_similar_positions(
            position_description=position_description,
            position_code=position_code
        )
        return [
            NormMatchResponse(
                norm_code=m.norm_code,
                title=m.title,
                description=m.description,
                unit=m.unit,
                unit_price_czk=m.unit_price_czk,
                labor_hours=m.labor_hours,
                confidence=m.confidence,
                source=m.source
            )
            for m in matches
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
