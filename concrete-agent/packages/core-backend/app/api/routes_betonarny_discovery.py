"""
Betonárny Discovery API — search for concrete plants near a location.

Endpoints:
  POST /api/v1/betonarny/search     — Find plants near GPS coords
  POST /api/v1/betonarny/scrape     — Admin: scrape BetonServer.cz
  GET  /api/v1/betonarny/cache      — List cached plants
"""

import logging

from fastapi import APIRouter, HTTPException

from app.services.betonarny_discovery.main import (
    search_plants,
    scrape_and_cache,
    get_cached_plants,
)
from app.services.betonarny_discovery.models import (
    SearchRequest,
    SearchResult,
    ScrapeRequest,
    ScrapeResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/betonarny", tags=["Betonárny Discovery"])


@router.post("/search", response_model=SearchResult)
async def search_betonarny(request: SearchRequest):
    """
    Search for concrete plants near a GPS location.

    Uses Overpass API (OpenStreetMap) + cached BetonServer data.
    Returns plants sorted by distance.
    """
    try:
        result = await search_plants(request)
        return result
    except Exception as e:
        logger.error("Search failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/scrape", response_model=ScrapeResult)
async def scrape_betonserver(request: ScrapeRequest):
    """
    Admin endpoint: scrape BetonServer.cz for plant listings.

    Should be triggered manually (monthly/yearly).
    Updates the in-memory plant cache.
    """
    try:
        result = await scrape_and_cache(request)
        return result
    except Exception as e:
        logger.error("Scrape failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")


@router.get("/cache")
async def get_cache():
    """Get all cached plants from previous scraping sessions."""
    plants = get_cached_plants()
    return {"plants": [p.model_dump() for p in plants], "total": len(plants)}
