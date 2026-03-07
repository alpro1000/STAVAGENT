"""
Pydantic models for Betonárny Discovery service.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    """GPS coordinates."""
    lat: float
    lon: float


class PlantContact(BaseModel):
    """Contact information for a concrete plant."""
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    price_list_url: Optional[str] = None


class ConcretePlant(BaseModel):
    """A single concrete plant / quarry."""
    id: str = Field(..., description="Unique ID (osm:<id> or bs:<slug>)")
    name: str
    company: Optional[str] = None
    address: Optional[str] = None
    location: GeoPoint
    distance_km: Optional[float] = Field(None, description="Distance from search origin")
    source: str = Field(..., description="osm | betonserver | manual")
    tags: dict[str, str] = Field(default_factory=dict, description="Raw OSM tags or metadata")
    contact: PlantContact = Field(default_factory=PlantContact)
    has_price_list: bool = False
    price_range_note: Optional[str] = None


class SearchRequest(BaseModel):
    """Request to search for concrete plants."""
    lat: float = Field(..., description="Search center latitude")
    lon: float = Field(..., description="Search center longitude")
    radius_km: float = Field(default=50, ge=1, le=200, description="Search radius in km")
    include_quarries: bool = Field(default=False, description="Also search for quarries")


class SearchResult(BaseModel):
    """Response from plant search."""
    query: SearchRequest
    plants: list[ConcretePlant] = Field(default_factory=list)
    total: int = 0
    sources_used: list[str] = Field(default_factory=list)


class ScrapeRequest(BaseModel):
    """Request to scrape BetonServer.cz for plants."""
    region: Optional[str] = Field(None, description="Region filter, e.g. 'karlovarsky-kraj'")
    max_pages: int = Field(default=5, ge=1, le=20)


class ScrapeResult(BaseModel):
    """Response from BetonServer scraping."""
    plants_found: int = 0
    plants_new: int = 0
    plants_updated: int = 0
    errors: list[str] = Field(default_factory=list)
