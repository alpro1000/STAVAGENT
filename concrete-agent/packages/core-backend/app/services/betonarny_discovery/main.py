"""
Betonárny Discovery — main orchestrator.

Combines Overpass API (OSM) + BetonServer.cz scraping to find
concrete plants near a given location.
"""

import logging

from .models import (
    ConcretePlant,
    SearchRequest,
    SearchResult,
    ScrapeRequest,
    ScrapeResult,
)
from .overpass import search_overpass
from .scraper import scrape_betonserver

logger = logging.getLogger(__name__)

# In-memory cache for scraped plants (refreshed on admin trigger)
_plant_cache: list[ConcretePlant] = []


async def search_plants(request: SearchRequest) -> SearchResult:
    """
    Search for concrete plants near a location.

    Pipeline:
      1. Query Overpass API (OSM) for nearby plants
      2. Merge with cached BetonServer data (if available)
      3. Deduplicate by proximity (plants within 200m → same)
      4. Sort by distance
    """
    sources: list[str] = []
    all_plants: list[ConcretePlant] = []

    # 1. Overpass API (real-time, free)
    try:
        osm_plants = await search_overpass(
            lat=request.lat,
            lon=request.lon,
            radius_km=request.radius_km,
            include_quarries=request.include_quarries,
        )
        all_plants.extend(osm_plants)
        sources.append("osm")
        logger.info("OSM found %d plants", len(osm_plants))
    except Exception as e:
        logger.error("Overpass search failed: %s", e)

    # 2. Merge cached BetonServer data
    if _plant_cache:
        from .overpass import _haversine

        for cached in _plant_cache:
            # Calculate distance from search center
            dist = _haversine(
                request.lat, request.lon,
                cached.location.lat, cached.location.lon,
            )
            if dist <= request.radius_km:
                plant_copy = cached.model_copy()
                plant_copy.distance_km = round(dist, 1)
                all_plants.append(plant_copy)

        if "betonserver" not in sources:
            sources.append("betonserver_cache")

    # 3. Deduplicate (plants within 200m with similar names → merge)
    deduped = _deduplicate(all_plants)

    # 4. Sort by distance
    deduped.sort(key=lambda p: p.distance_km or 999)

    return SearchResult(
        query=request,
        plants=deduped,
        total=len(deduped),
        sources_used=sources,
    )


async def scrape_and_cache(request: ScrapeRequest) -> ScrapeResult:
    """
    Admin action: scrape BetonServer.cz and update plant cache.

    This should be triggered manually (monthly/yearly).
    """
    global _plant_cache

    errors: list[str] = []
    new_count = 0
    updated_count = 0

    try:
        scraped = await scrape_betonserver(
            region=request.region,
            max_pages=request.max_pages,
        )
    except Exception as e:
        logger.error("Scrape failed: %s", e)
        return ScrapeResult(errors=[str(e)])

    existing_names = {p.name.lower().strip() for p in _plant_cache}

    for plant in scraped:
        key = plant.name.lower().strip()
        if key in existing_names:
            updated_count += 1
            # Update existing entry
            _plant_cache = [p if p.name.lower().strip() != key else plant for p in _plant_cache]
        else:
            new_count += 1
            _plant_cache.append(plant)

    logger.info(
        "Scrape complete: %d found, %d new, %d updated",
        len(scraped), new_count, updated_count,
    )

    return ScrapeResult(
        plants_found=len(scraped),
        plants_new=new_count,
        plants_updated=updated_count,
        errors=errors,
    )


def get_cached_plants() -> list[ConcretePlant]:
    """Return all cached plants (from BetonServer scraping)."""
    return list(_plant_cache)


def _deduplicate(plants: list[ConcretePlant]) -> list[ConcretePlant]:
    """Remove duplicate plants (same name or within 200m)."""
    from .overpass import _haversine

    result: list[ConcretePlant] = []
    for plant in plants:
        is_dup = False
        for existing in result:
            # Same name (fuzzy)
            if _names_similar(plant.name, existing.name):
                # Prefer OSM data (has real GPS), merge contact info
                if plant.source == "osm" and existing.source != "osm":
                    # Replace with OSM version but keep contact
                    if existing.contact.website and not plant.contact.website:
                        plant.contact.website = existing.contact.website
                    if existing.contact.phone and not plant.contact.phone:
                        plant.contact.phone = existing.contact.phone
                    result = [p if p.id != existing.id else plant for p in result]
                is_dup = True
                break

            # Within 200m
            if (
                plant.location.lat and existing.location.lat
                and _haversine(
                    plant.location.lat, plant.location.lon,
                    existing.location.lat, existing.location.lon,
                ) < 0.2
            ):
                is_dup = True
                break

        if not is_dup:
            result.append(plant)

    return result


def _names_similar(a: str, b: str) -> bool:
    """Check if two plant names refer to the same entity."""
    a_norm = a.lower().strip()
    b_norm = b.lower().strip()
    if a_norm == b_norm:
        return True
    # One contains the other
    if a_norm in b_norm or b_norm in a_norm:
        return True
    return False
