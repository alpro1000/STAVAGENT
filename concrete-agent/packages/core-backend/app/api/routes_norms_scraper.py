"""
Norms Scraper API — Endpoints for scraping and retrieving construction norms
from methvin.co via Perplexity.

Endpoints:
  POST /api/v1/norms/scrape           — Scrape a single category
  POST /api/v1/norms/scrape-all       — Scrape all categories
  GET  /api/v1/norms/categories       — List available categories
  GET  /api/v1/norms/status           — Status of scraped data
  GET  /api/v1/norms/{work_type}      — Get norms for a work type
  GET  /api/v1/norms/category/{key}   — Get merged norms for a category
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.norms_scraper import (
    METHVIN_CATEGORIES,
    scrape_category,
    scrape_all,
    get_norms_for_work_type,
    list_scraped_categories,
    _merge_category_norms,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/norms", tags=["Norms Scraper"])


# ── Models ────────────────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    category: str
    force: bool = False


class ScrapeAllRequest(BaseModel):
    force: bool = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories():
    """List all available methvin.co norm categories with query counts."""
    return {
        "categories": {
            key: {
                "label": val["label"],
                "query_count": len(val["queries"]),
            }
            for key, val in METHVIN_CATEGORIES.items()
        },
        "total_categories": len(METHVIN_CATEGORIES),
    }


@router.get("/status")
async def scrape_status():
    """Get status of all scraped categories (what's been scraped, what's pending)."""
    return list_scraped_categories()


@router.post("/scrape")
async def scrape_single(request: ScrapeRequest):
    """
    Scrape norms for a single category using Perplexity → methvin.co.

    Categories: concrete_formwork, concrete_placement, concrete_reinforcement,
    concrete_finishing, excavation, structural_steel, masonry, plastering,
    painting_tiling, demolition, foundation, road_rail, plant_productivity,
    piping_mechanical.

    Set force=true to re-scrape even if cached.
    """
    if request.category not in METHVIN_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{request.category}'. Available: {list(METHVIN_CATEGORIES.keys())}",
        )

    try:
        result = await scrape_category(request.category, force=request.force)
        return {
            "status": "ok",
            "category": request.category,
            "has_data": bool(result.get("data")),
            "data_keys": list(result.get("data", {}).keys()),
            "sources_count": len(result.get("sources", [])),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error(f"[NormsAPI] Scrape failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(exc)[:200]}")


@router.post("/scrape-all")
async def scrape_all_categories(request: ScrapeAllRequest):
    """
    Scrape ALL categories sequentially. This may take several minutes.
    Results are cached — subsequent calls are fast unless force=true.
    """
    try:
        summary = await scrape_all(force=request.force)
        return {
            "status": "ok",
            "summary": summary,
        }
    except Exception as exc:
        logger.error(f"[NormsAPI] Scrape-all failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scrape-all failed: {str(exc)[:200]}")


@router.get("/work-type/{work_type}")
async def get_norms_by_work_type(work_type: str):
    """
    Get all relevant norms for a Czech work type.

    Work types: beton, bedneni, vyztuž, zemni_prace, zdivo, ocel, omitky,
    malba, demolice, zaklady, komunikace, mechanizace, potrubi.

    Combines data from:
    - Existing KB (construction_productivity_norms.json, bedneni.json)
    - Scraped methvin.co norms (if available)
    """
    return get_norms_for_work_type(work_type)


@router.get("/category/{category_key}")
async def get_category_data(category_key: str):
    """Get all merged scraped data for a specific methvin category."""
    if category_key not in METHVIN_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown category '{category_key}'. Available: {list(METHVIN_CATEGORIES.keys())}",
        )

    merged = _merge_category_norms(category_key)
    return merged
