"""
Summary API Routes

Endpoints for generating project summaries using Multi-Role AI.

ENDPOINTS:
- POST /api/v1/summary/generate - Generate project summary
- GET /api/v1/summary/{project_id} - Get cached summary
- GET /api/v1/summary/health - Health check

VERSION: 1.0.0 (2025-12-28)
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.summary_generator import (
    SummaryGenerator,
    SummaryFormat,
    SummaryLanguage,
    generate_project_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/summary", tags=["Summary"])

# In-memory cache for summaries (replace with Redis in production)
_summary_cache: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class PositionInput(BaseModel):
    """Position data for summary generation"""
    code: Optional[str] = Field(default=None, description="KROS/URS code")
    description: str = Field(..., description="Position description")
    quantity: Optional[float] = Field(default=None, description="Quantity")
    unit: Optional[str] = Field(default=None, description="Unit (m³, m², kg, etc.)")
    unit_price: Optional[float] = Field(default=None, description="Unit price in CZK")
    total_price: Optional[float] = Field(default=None, description="Total price in CZK")
    classification: Optional[str] = Field(
        default=None,
        description="Audit classification: GREEN, AMBER, RED"
    )
    enrichment: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Enrichment data from KROS/RTS"
    )


class SummaryRequest(BaseModel):
    """Request for summary generation"""
    project_id: str = Field(..., description="Unique project identifier")
    project_name: str = Field(..., description="Human-readable project name")
    positions: List[PositionInput] = Field(
        ...,
        description="List of positions to analyze",
        min_length=1,
    )
    language: str = Field(
        default="cs",
        description="Output language: cs (Czech), en (English), sk (Slovak)"
    )
    output_format: str = Field(
        default="json",
        description="Output format: json, markdown, html"
    )
    use_parallel: bool = Field(
        default=True,
        description="Use parallel Multi-Role execution (3-4x faster)"
    )
    use_cache: bool = Field(
        default=True,
        description="Use cached summary if available"
    )


class PositionSummaryResponse(BaseModel):
    """Position statistics in response"""
    total_count: int
    green_count: int
    amber_count: int
    red_count: int
    total_value_czk: float
    enriched_count: int
    needs_review_count: int
    green_percentage: float
    pass_rate: float


class SummaryResponse(BaseModel):
    """Response with generated summary"""
    success: bool = True
    project_id: str
    project_name: str
    generated_at: str
    position_summary: PositionSummaryResponse
    executive_summary: str
    key_findings: List[str]
    recommendations: List[str]
    critical_issues: List[str]
    warnings: List[str]
    overall_status: str = Field(description="GREEN, AMBER, or RED")
    confidence_score: float = Field(ge=0.0, le=1.0)
    generation_time_seconds: float
    multi_role_speedup: Optional[float] = None
    language: str
    output_format: str = Field(alias="format")
    roles_consulted: List[str]
    from_cache: bool = False

    class Config:
        populate_by_name = True


class MarkdownResponse(BaseModel):
    """Response with Markdown-formatted summary"""
    success: bool = True
    project_id: str
    markdown: str
    generation_time_seconds: float


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest) -> SummaryResponse:
    """
    Generate comprehensive project summary using Multi-Role AI.

    Uses optimized parallel execution for 3-4x speedup.

    **Request:**
    - project_id: Unique identifier
    - project_name: Human-readable name
    - positions: List of positions with audit data
    - language: Output language (cs/en/sk)
    - use_parallel: Enable parallel execution (recommended)

    **Response:**
    - executive_summary: 2-3 paragraph summary for executives
    - key_findings: 3-5 main findings
    - recommendations: Suggested next steps
    - critical_issues: Issues requiring immediate attention
    - overall_status: GREEN/AMBER/RED

    **Performance:**
    - Sequential: 50-75 seconds
    - Parallel: 15-20 seconds (3-4x faster)
    """
    try:
        # Check cache
        cache_key = f"{request.project_id}:{request.language}"
        if request.use_cache and cache_key in _summary_cache:
            cached = _summary_cache[cache_key]
            logger.info(f"📦 Returning cached summary for {request.project_id}")
            cached["from_cache"] = True
            return SummaryResponse(**cached)

        logger.info(
            f"🚀 Generating summary for {request.project_id} "
            f"({len(request.positions)} positions, parallel={request.use_parallel})"
        )

        # Convert positions to dict
        positions = [pos.model_dump() for pos in request.positions]

        # Generate summary
        generator = SummaryGenerator()

        # Map language
        lang = SummaryLanguage.CZECH
        if request.language == "en":
            lang = SummaryLanguage.ENGLISH
        elif request.language == "sk":
            lang = SummaryLanguage.SLOVAK

        # Map format
        fmt = SummaryFormat.JSON
        if request.output_format == "markdown":
            fmt = SummaryFormat.MARKDOWN
        elif request.output_format == "html":
            fmt = SummaryFormat.HTML

        summary = await generator.generate_summary(
            project_id=request.project_id,
            project_name=request.project_name,
            positions=positions,
            language=lang,
            output_format=fmt,
            use_parallel=request.use_parallel,
        )

        # Convert to response
        response_data = summary.to_dict()
        response_data["success"] = True
        response_data["from_cache"] = False
        response_data["format"] = response_data.pop("output_format", request.output_format)

        # Cache response
        if request.use_cache:
            _summary_cache[cache_key] = response_data

        logger.info(
            f"✅ Summary generated for {request.project_id}: "
            f"{summary.overall_status} in {summary.generation_time_seconds:.2f}s"
        )

        return SummaryResponse(**response_data)

    except Exception as e:
        logger.error(f"❌ Summary generation failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Summary generation failed: {str(e)}")


@router.post("/generate/markdown", response_model=MarkdownResponse)
async def generate_summary_markdown(request: SummaryRequest) -> MarkdownResponse:
    """
    Generate project summary in Markdown format.

    Ideal for documentation, reports, and README files.
    """
    try:
        logger.info(f"📝 Generating Markdown summary for {request.project_id}")

        positions = [pos.model_dump() for pos in request.positions]

        generator = SummaryGenerator()

        lang = SummaryLanguage.CZECH
        if request.language == "en":
            lang = SummaryLanguage.ENGLISH
        elif request.language == "sk":
            lang = SummaryLanguage.SLOVAK

        summary = await generator.generate_summary(
            project_id=request.project_id,
            project_name=request.project_name,
            positions=positions,
            language=lang,
            output_format=SummaryFormat.MARKDOWN,
            use_parallel=request.use_parallel,
        )

        return MarkdownResponse(
            success=True,
            project_id=request.project_id,
            markdown=summary.to_markdown(),
            generation_time_seconds=summary.generation_time_seconds,
        )

    except Exception as e:
        logger.error(f"❌ Markdown summary failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Markdown summary failed: {str(e)}")


@router.get("/{project_id}", response_model=SummaryResponse)
async def get_summary(
    project_id: str,
    language: str = "cs",
) -> SummaryResponse:
    """
    Get cached summary for a project.

    Returns cached summary if available, otherwise returns 404.
    """
    cache_key = f"{project_id}:{language}"

    if cache_key in _summary_cache:
        cached = _summary_cache[cache_key]
        cached["from_cache"] = True
        return SummaryResponse(**cached)

    raise HTTPException(404, f"No cached summary found for project {project_id}")


@router.delete("/{project_id}")
async def delete_summary(project_id: str) -> Dict[str, Any]:
    """
    Delete cached summary for a project.
    """
    deleted = 0
    keys_to_delete = [k for k in _summary_cache if k.startswith(f"{project_id}:")]

    for key in keys_to_delete:
        del _summary_cache[key]
        deleted += 1

    return {
        "success": True,
        "project_id": project_id,
        "deleted_count": deleted,
    }


@router.get("/health")
async def health() -> Dict[str, Any]:
    """
    Summary module health check.
    """
    return {
        "status": "healthy",
        "system": "summary-generator",
        "version": "1.0.0",
        "features": {
            "parallel_execution": True,
            "expected_speedup": "3-4x",
            "languages": ["cs", "en", "sk"],
            "formats": ["json", "markdown", "html"],
        },
        "cache_entries": len(_summary_cache),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
