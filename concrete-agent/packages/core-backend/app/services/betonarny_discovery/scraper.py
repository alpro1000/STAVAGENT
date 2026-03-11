"""
BetonServer.cz scraper — extract concrete plant listings.

BetonServer blocks simple bot User-Agents with 403.
Uses full browser headers to bypass anti-bot protection.

URL structure:
  - Main listing: /beton-a-cerpani/beton-betonarny-v-cr
  - Alphabetical: /beton-a-cerpani/beton-betonarny-v-cr?l=A&listtype=kar
  - Pagination:   /beton-a-cerpani/beton-betonarny-v-cr?page=2
  - Company page: /<company-slug>
"""

import logging
import re
from typing import Optional

import httpx

from .models import ConcretePlant, GeoPoint, PlantContact

logger = logging.getLogger(__name__)

BASE_URL = "https://www.betonserver.cz"
LISTING_PATH = "/beton-a-cerpani/beton-betonarny-v-cr"
TIMEOUT = 25

# Full browser headers to avoid 403 bot blocking
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

# Czech alphabet letters used by BetonServer for filtering
ALPHABET = list("ABCČDEFGHIJKLMNOPQRSŠTUVWXYZŽ")

# Keywords for finding price list URLs on company websites
PRICE_KEYWORDS = ["cenik", "cenník", "ceník", "pricelist", "ke-stazeni", "download", "nabidka"]

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

    Strategy:
      1. Try paginated listing (page=1,2,3...)
      2. If that fails or returns few results, try alphabetical (l=A,B,C...)

    Args:
        region: Optional region slug (not used currently, reserved for future)
        max_pages: Maximum pages to scrape

    Returns:
        List of ConcretePlant objects
    """
    plants: list[ConcretePlant] = []

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers=BROWSER_HEADERS,
    ) as client:
        # Strategy 1: Paginated listing
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}{LISTING_PATH}"
            params = {}
            if page > 1:
                params["page"] = str(page)

            logger.info("Scraping page %d: %s", page, url)

            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 403:
                    logger.warning("BetonServer returned 403 (bot blocked) on page %d", page)
                    break
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

        # Strategy 2: If pagination returned nothing, try alphabetical
        if not plants:
            logger.info("Pagination returned no results, trying alphabetical listing")
            for letter in ALPHABET[:max_pages]:  # Limit by max_pages
                url = f"{BASE_URL}{LISTING_PATH}"
                params = {"l": letter, "listtype": "kar"}

                try:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 403:
                        logger.warning("BetonServer returned 403 for letter %s", letter)
                        break
                    if resp.status_code != 200:
                        continue
                except httpx.HTTPError as e:
                    logger.error("BetonServer error for letter %s: %s", letter, e)
                    continue

                letter_plants = _parse_listing_page(resp.text, ord(letter))
                if letter_plants:
                    plants.extend(letter_plants)
                    logger.info("Letter %s: found %d plants", letter, len(letter_plants))

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

    # BetonServer uses various possible selectors — try broad range
    # Common CMS patterns: card containers, firm listings, table rows
    selectors = [
        # Specific to directory/listing sites
        ".firm-item", ".firma", ".company-card", ".listing-item",
        ".company-item", ".catalog-item", ".result-item",
        # Generic card patterns
        "[class*='firm']", "[class*='firma']", "[class*='company']",
        "[class*='plant']", "[class*='item-']",
        # Common CMS structures
        ".card", ".list-item", ".entry",
        "article",
        # Table-based listings
        "table.catalog tr", "table.list tr",
        # divs inside a main content area
        "#content .item", "#main .item", ".content .item",
    ]

    items = []
    for sel in selectors:
        try:
            items = soup.select(sel)
            if items and len(items) >= 2:  # At least 2 to avoid false positives
                logger.debug("BS4 found %d items with selector: %s", len(items), sel)
                break
        except Exception:
            continue

    if not items:
        # Fallback: look for links with company/betonárna text
        all_links = soup.find_all("a", href=True)
        # Filter links that look like company profile links
        company_links = []
        for link in all_links:
            href = link.get("href", "")
            text = link.get_text(strip=True)
            # Company profiles: /<slug> with reasonable text length
            if (
                href.startswith("/")
                and not href.startswith("/beton-")
                and not href.startswith("/materialy")
                and not href.startswith("/stroje")
                and not href.startswith("/vyhledavani")
                and len(text) >= 3
                and len(text) <= 100
                and not any(kw in text.lower() for kw in [
                    "navigace", "menu", "kontakt", "footer", "hlavní",
                    "přihlášení", "registrace", "domů", "home",
                    "mapa stránek", "ochrana", "cookies",
                ])
            ):
                company_links.append(link)

        for idx, link in enumerate(company_links):
            name = link.get_text(strip=True)
            href = link.get("href", "")
            plant = ConcretePlant(
                id=f"bs:p{page_num}i{idx}",
                name=name,
                location=GeoPoint(lat=50.0, lon=14.4),  # Default: Prague
                source="betonserver",
                contact=PlantContact(
                    website=f"{BASE_URL}{href}" if href.startswith("/") else href
                ),
            )
            plants.append(plant)

        return plants

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
    # Name: try headings first, then strong/b, then link text
    name_el = item.select_one("h2, h3, h4, .name, .title, .firma-name, strong, b")
    name = name_el.get_text(strip=True) if name_el else item.get_text(strip=True)[:100]
    if not name or len(name) < 3:
        return None

    # Skip navigation/boilerplate
    skip_words = ["navigace", "menu", "kontakt", "footer", "hlavní", "přihlášení",
                   "registrace", "mapa stránek", "cookies", "vyhledávání"]
    if any(kw in name.lower() for kw in skip_words):
        return None

    # Address
    addr_el = item.select_one(".address, .location, .addr, [class*='addr'], .mesto, .city")
    address = addr_el.get_text(strip=True) if addr_el else None

    # Website link
    link_el = item.select_one("a[href*='http']")
    if not link_el:
        link_el = item.find("a", href=True)
    website = None
    if link_el:
        href = link_el.get("href", "")
        if href.startswith("http"):
            website = href
        elif href.startswith("/"):
            website = f"{BASE_URL}{href}"

    # Phone
    phone_el = item.select_one("[href^='tel:']")
    phone = phone_el.get_text(strip=True) if phone_el else None

    # GPS from data attributes
    lat = _float_attr(item, "data-lat", "data-latitude", "data-gps-lat")
    lon = _float_attr(item, "data-lng", "data-lon", "data-longitude", "data-gps-lng")

    return ConcretePlant(
        id=f"bs:p{page_num}i{idx}",
        name=name,
        address=address,
        location=GeoPoint(lat=lat or 50.0, lon=lon or 14.4),
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

    # Strategy 1: Find company profile links — /<slug> pattern
    # Most listing sites have <a href="/company-slug">Company Name</a>
    link_pattern = re.compile(
        r'<a\s+[^>]*href="(/[a-z0-9][a-z0-9\-]{2,60})"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )

    skip_prefixes = {
        "/beton-", "/materialy", "/stroje", "/vyhledavani",
        "/kontakt", "/registr", "/prihlaseni", "/about", "/cookies",
    }
    skip_names = {
        "navigace", "menu", "kontakt", "footer", "hlavní", "domů",
        "přihlášení", "registrace", "mapa", "cookies",
    }

    seen_slugs: set[str] = set()
    for match in link_pattern.finditer(html):
        href = match.group(1)
        raw_name = match.group(2)

        # Skip non-company links
        if any(href.startswith(p) for p in skip_prefixes):
            continue

        name = re.sub(r'<[^>]+>', '', raw_name).strip()
        if not name or len(name) < 3 or len(name) > 100:
            continue
        if any(kw in name.lower() for kw in skip_names):
            continue
        if href in seen_slugs:
            continue
        seen_slugs.add(href)

        plants.append(ConcretePlant(
            id=f"bs:p{page_num}r{len(plants)}",
            name=name,
            location=GeoPoint(lat=50.0, lon=14.4),
            source="betonserver",
            contact=PlantContact(website=f"{BASE_URL}{href}"),
        ))

    # Strategy 2: If no links found, fall back to headings
    if not plants:
        heading_pattern = re.compile(r'<h[2-4][^>]*>(.*?)</h[2-4]>', re.IGNORECASE | re.DOTALL)
        for idx, raw_name in enumerate(heading_pattern.findall(html)):
            name = re.sub(r'<[^>]+>', '', raw_name).strip()
            if not name or len(name) < 3:
                continue
            if any(kw in name.lower() for kw in skip_names):
                continue
            plants.append(ConcretePlant(
                id=f"bs:p{page_num}h{idx}",
                name=name,
                location=GeoPoint(lat=50.0, lon=14.4),
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
        headers=BROWSER_HEADERS,
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

    # Strategy 2: Links with price keywords in href or text
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
