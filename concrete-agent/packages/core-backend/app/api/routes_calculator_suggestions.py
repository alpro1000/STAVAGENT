"""
Calculator Suggestions API — maps extracted document facts to Monolit Planner parameters.

POST /api/v1/extraction/calculator-suggestions
  Input: { portal_project_id, building_object?, element_description? }
  Output: { suggestions[], warnings[], conflicts[], facts_count, documents_used[] }

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.calculator_suggestions import (
    CalculatorSuggestionsResponse,
    get_calculator_suggestions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/extraction", tags=["Extraction"])


class CalculatorSuggestionsRequest(BaseModel):
    portal_project_id: str
    building_object: Optional[str] = None   # SO-xxx filter
    element_description: Optional[str] = None  # context for smarter filtering


@router.post(
    "/calculator-suggestions",
    response_model=CalculatorSuggestionsResponse,
    summary="Get calculator parameter suggestions from extracted documents",
)
async def calculator_suggestions(req: CalculatorSuggestionsRequest):
    """
    Returns extracted facts mapped to Monolit Planner calculator parameters.

    Filters facts by building_object (SO-xxx) if provided.
    Generates warnings for rule violations (exposure class vs concrete class, etc.).
    Detects conflicts when multiple documents disagree on the same parameter.
    """
    if not req.portal_project_id:
        raise HTTPException(status_code=400, detail="portal_project_id is required")

    try:
        response = get_calculator_suggestions(
            portal_project_id=req.portal_project_id,
            building_object=req.building_object,
            element_description=req.element_description,
        )
        return response
    except Exception as e:
        logger.error(f"Calculator suggestions error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
