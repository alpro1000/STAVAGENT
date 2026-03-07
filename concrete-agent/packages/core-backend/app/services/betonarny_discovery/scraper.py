"""
BetonServer.cz scraper — extract concrete plant listings.

Scrapes the public directory at betonserver.cz for supplier info.
Uses httpx + regex/string parsing (no BS4 dependency needed for simple pages).
If beautifulsoup4 is available, uses it for richer extraction.
"""

import logging
import re
from typing import Optional

import httpx

from .models import ConcretePlant, GeoPoint, PlantContact

logger = logging.getLogger(__name__)

BASE_URL = "https://www.betonserver.cz"
LISTING_URL = f"{BASE_URL}/betonarny"
TIMEOUT = 20

# Common price keywords on supplier websites
PRICE_KEYWORDS = ["cenik", "cenník", "pricelist", "ke-stazeni", "download", "nabidka", "ceník"]


try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    logger.info("beautifulsoup4 not installed — using regex fallback for scraping")


async def scrape_betonserver(
    region: Optional[str] = None,
    max_pages: int = 5,
) -> list[ConcretePlant]:
    """
    Scrape BetonServer.cz for concrete plant listings.

    Args:
        region: Optional region slug (e.g. "karlovarsky-kraj")
        max_pages: Maximum pages to scrape

    Returns:
        List of ConcretePlant objects
    """
    plants: list[ConcretePlant] = []

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": "StavAgent/1.0 (construction cost tool)"},
    ) as client:
        for page in range(1, max_pages + 1):
            url = LISTING_URL
            if region:
                url = f"{LISTING_URL}/{region}"
            if page > 1:
                url = f"{url}?page={page}"

            logger.info("Scraping page %d: %s", page, url)

            try:
                resp = await client.get(url)
                if resp.status_code == 404:
                    logger.info("Page %d returned 404, stopping", page)
                    break
                resp.raise_for_status()
            except httpx.HTTPError as e:
                logger.error("BetonServer scrape error on page %d: %s", page, e)
                break

            page_plants = _parse_listing_page(resp.text, page)
            if not page_plants:
                logger.info("No plants found on page %d, stopping", page)
                break

            plants.extend(page_plants)
            logger.info("Found %d plants on page %d", len(page_plants), page)

    # Deduplicate by name
    seen: set[str] = set()
    unique: list[ConcretePlant] = []
    for p in plants:
        key = p.name.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(p)

    logger.info("Total unique plants from BetonServer: %d", len(unique))
    return unique


def _parse_listing_page(html: str, page_num: int) -> list[ConcretePlant]:
    """Parse a single listing page for plant entries."""
    if HAS_BS4:
        return _parse_with_bs4(html, page_num)
    return _parse_with_regex(html, page_num)


def _parse_with_bs4(html: str, page_num: int) -> list[ConcretePlant]:
    """Parse using BeautifulSoup (rich extraction)."""
    soup = BeautifulSoup(html, "html.parser")
    plants: list[ConcretePlant] = []

    # Look for firm/company cards — common patterns on listing sites
    selectors = [
        ".firm-item", ".company-card", ".listing-item",
        "[class*='firm']", "[class*='company']", "[class*='plant']",
        "article", ".result-item",
    ]

    items = []
    for sel in selectors:
        items = soup.select(sel)
        if items:
            break

    if not items:
        # Fallback: look for links with betonárna-related text
        items = soup.find_all("a", href=True, string=re.compile(r"beton|betonárn", re.IGNORECASE))

    for idx, item in enumerate(items):
        try:
            plant = _extract_plant_bs4(item, page_num, idx)
            if plant:
                plants.append(plant)
        except Exception as e:
            logger.debug("Failed to extract plant from item %d: %s", idx, e)

    return plants


def _extract_plant_bs4(item, page_num: int, idx: int) -> Optional[ConcretePlant]:
    """Extract plant info from a BS4 element."""
    # Name
    name_el = item.select_one("h2, h3, h4, .name, .title, strong")
    name = name_el.get_text(strip=True) if name_el else item.get_text(strip=True)[:100]
    if not name or len(name) < 3:
        return None

    # Address
    addr_el = item.select_one(".address, .location, [class*='addr']")
    address = addr_el.get_text(strip=True) if addr_el else None

    # Website link
    link_el = item.select_one("a[href*='http']") or item.find("a", href=True)
    website = link_el["href"] if link_el and link_el["href"].startswith("http") else None

    # Phone
    phone_el = item.select_one("[href^='tel:']")
    phone = phone_el.get_text(strip=True) if phone_el else None

    # GPS from data attributes
    lat = _float_attr(item, "data-lat", "data-latitude")
    lon = _float_attr(item, "data-lng", "data-lon", "data-longitude")

    return ConcretePlant(
        id=f"bs:p{page_num}i{idx}",
        name=name,
        address=address,
        location=GeoPoint(lat=lat or 50.0, lon=lon or 14.4),  # Default: Prague if no GPS
        source="betonserver",
        contact=PlantContact(phone=phone, website=website),
    )


def _float_attr(el, *attrs) -> Optional[float]:
    """Try to extract a float from element attributes."""
    for attr in attrs:
        val = el.get(attr)
        if val:
            try:
                return float(val)
            except (ValueError, TypeError):
                pass
    return None


def _parse_with_regex(html: str, page_num: int) -> list[ConcretePlant]:
    """Parse using regex (fallback when BS4 not available)."""
    plants: list[ConcretePlant] = []

    # Find company names in headings
    heading_pattern = re.compile(r'<h[2-4][^>]*>(.*?)</h[2-4]>', re.IGNORECASE | re.DOTALL)
    matches = heading_pattern.findall(html)

    for idx, raw_name in enumerate(matches):
        name = re.sub(r'<[^>]+>', '', raw_name).strip()
        if not name or len(name) < 3:
            continue
        # Skip navigation headings
        if any(kw in name.lower() for kw in ["navigace", "menu", "kontakt", "footer", "hlavní"]):
            continue

        plants.append(ConcretePlant(
            id=f"bs:p{page_num}r{idx}",
            name=name,
            location=GeoPoint(lat=50.0, lon=14.4),  # Default: Prague
            source="betonserver",
        ))

    return plants


async def find_price_list_url(company_url: str) -> Optional[str]:
    """
    Visit a company website and try to find a link to their price list.

    Returns URL to PDF/XLSX if found, None otherwise.
    """
    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=True,
        headers={"User-Agent": "StavAgent/1.0"},
    ) as client:
        try:
            resp = await client.get(company_url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Cannot access %s: %s", company_url, e)
            return None

    html = resp.text.lower()

    # Strategy 1: Direct file links (PDF, XLSX)
    file_pattern = re.compile(
        r'href=["\']([^"\']*\.(?:pdf|xlsx?|xls))["\']',
        re.IGNORECASE,
    )
    for match in file_pattern.finditer(html):
        href = match.group(1)
        if any(kw in href.lower() for kw in PRICE_KEYWORDS):
            if href.startswith("http"):
                return href
            return f"{company_url.rstrip('/')}/{href.lstrip('/')}"

    # Strategy 2: Links with price keywords in href
    link_pattern = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
    for match in link_pattern.finditer(html):
        href = match.group(1)
        if any(kw in href.lower() for kw in PRICE_KEYWORDS):
            if href.startswith("http"):
                return href
            if href.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(company_url)
                return f"{parsed.scheme}://{parsed.netloc}{href}"

    return None
