"""
Overpass API client — search OpenStreetMap for concrete plants and quarries.

Uses the free Overpass API (no API key needed).
Rate limit: be gentle, 1 request at a time, cache results.
"""

import logging
import math

import httpx

from .models import ConcretePlant, GeoPoint, PlantContact

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT = 30


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two GPS points."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _build_query(lat: float, lon: float, radius_km: float, include_quarries: bool) -> str:
    """Build Overpass QL query for concrete plants."""
    radius_m = int(radius_km * 1000)
    parts = [
        f'node["industrial"="concrete_plant"](around:{radius_m},{lat},{lon});',
        f'way["industrial"="concrete_plant"](around:{radius_m},{lat},{lon});',
        f'node["man_made"="works"]["product"="concrete"](around:{radius_m},{lat},{lon});',
        f'way["man_made"="works"]["product"="concrete"](around:{radius_m},{lat},{lon});',
    ]
    if include_quarries:
        parts.extend([
            f'node["landuse"="quarry"](around:{radius_m},{lat},{lon});',
            f'way["landuse"="quarry"](around:{radius_m},{lat},{lon});',
        ])

    union = "\n".join(parts)
    return f"[out:json][timeout:{TIMEOUT}];\n(\n{union}\n);\nout center body;"


def _extract_plant(element: dict, origin_lat: float, origin_lon: float) -> ConcretePlant | None:
    """Convert an Overpass element to ConcretePlant."""
    tags = element.get("tags", {})

    # Get coordinates (node: direct, way: from center)
    if element["type"] == "node":
        lat = element["lat"]
        lon = element["lon"]
    elif "center" in element:
        lat = element["center"]["lat"]
        lon = element["center"]["lon"]
    else:
        return None

    name = (
        tags.get("name")
        or tags.get("operator")
        or tags.get("brand")
        or f"Betonárna (OSM {element['id']})"
    )

    distance = _haversine(origin_lat, origin_lon, lat, lon)

    contact = PlantContact(
        phone=tags.get("phone") or tags.get("contact:phone"),
        email=tags.get("email") or tags.get("contact:email"),
        website=tags.get("website") or tags.get("contact:website"),
    )

    return ConcretePlant(
        id=f"osm:{element['id']}",
        name=name,
        company=tags.get("operator") or tags.get("brand"),
        address=_build_address(tags),
        location=GeoPoint(lat=lat, lon=lon),
        distance_km=round(distance, 1),
        source="osm",
        tags={k: v for k, v in tags.items() if k not in ("name", "operator", "brand", "phone", "email", "website")},
        contact=contact,
    )


def _build_address(tags: dict) -> str | None:
    """Build address string from OSM address tags."""
    parts = []
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    city = tags.get("addr:city")
    postcode = tags.get("addr:postcode")

    if street:
        parts.append(f"{street} {housenumber}" if housenumber else street)
    if city:
        parts.append(f"{postcode} {city}" if postcode else city)

    return ", ".join(parts) if parts else None


async def search_overpass(
    lat: float,
    lon: float,
    radius_km: float = 50,
    include_quarries: bool = False,
) -> list[ConcretePlant]:
    """
    Search Overpass API for concrete plants near a location.

    Returns list sorted by distance (nearest first).
    """
    query = _build_query(lat, lon, radius_km, include_quarries)
    logger.info("Overpass query: lat=%.4f, lon=%.4f, radius=%dkm", lat, lon, radius_km)

    async with httpx.AsyncClient(timeout=TIMEOUT + 5) as client:
        try:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("Overpass API error: %s", e)
            return []

    data = resp.json()
    elements = data.get("elements", [])
    logger.info("Overpass returned %d elements", len(elements))

    plants: list[ConcretePlant] = []
    for el in elements:
        plant = _extract_plant(el, lat, lon)
        if plant:
            plants.append(plant)

    # Sort by distance
    plants.sort(key=lambda p: p.distance_km or 999)
    return plants
