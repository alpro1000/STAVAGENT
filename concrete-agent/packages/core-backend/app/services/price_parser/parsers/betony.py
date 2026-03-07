"""
Parser for concrete (betony) section.

Strategy: regex first, LLM fallback.
"""

from __future__ import annotations

import logging
import re

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import BetonItem

logger = logging.getLogger(__name__)

# Match patterns like "C 25/30", "C25/30", "C 8/10"
BETON_REGEX = re.compile(
    r"(C\s*\d{1,2}\s*/\s*\d{1,2})"
    r"[^\d]*?"                        # skip non-digits
    r"(X[A-Z0-9,\s\-]+)?"            # optional exposure class
    r".*?"                            # anything
    r"(\d[\d\s]*[.,]?\d*)"            # first price (per m³ bez DPH)
    , re.IGNORECASE
)

PARSE_BETONY_PROMPT = """\
Z tohoto textu ceníku extrahuj seznam betonů.
Pro každý beton vrať:
- name: název (např. "C 25/30")
- exposure_class: třída prostředí (např. "XC2, XF1") nebo null
- price_per_m3: cena za m³ bez DPH (číslo) nebo null
- price_per_m3_vat: cena za m³ s DPH (číslo) nebo null
- notes: poznámky nebo null

Vrať JSON array. Pokud cena chybí, dej null.
Vrať POUZE validní JSON array.

TEXT:
{text}
"""


def _parse_price(s: str) -> float | None:
    """Parse Czech-format price: '3 440' or '3440' or '3.440,00'."""
    if not s:
        return None
    s = s.strip().replace(" ", "").replace("\xa0", "")
    # Handle EU format: 3.440,00 → 3440.00
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        val = float(s)
        return val if val > 0 else None
    except ValueError:
        return None


def _regex_parse(text: str) -> list[BetonItem]:
    """Try to extract concrete items via regex."""
    items: list[BetonItem] = []
    for m in BETON_REGEX.finditer(text):
        name = m.group(1).strip()
        exposure = m.group(2).strip() if m.group(2) else None
        price = _parse_price(m.group(3))
        if name and price:
            items.append(BetonItem(
                name=name,
                exposure_class=exposure,
                price_per_m3=price,
            ))
    return items


async def parse_betony(text: str | None) -> list[BetonItem]:
    """Parse concrete section. Regex first, LLM fallback."""
    if not text:
        return []

    # Try regex
    items = _regex_parse(text)
    if len(items) >= 3:
        logger.info("Regex extracted %d concrete items", len(items))
        return items

    # LLM fallback
    logger.info("Regex found only %d items, using LLM fallback", len(items))
    try:
        data = await ask_llm_json(PARSE_BETONY_PROMPT.format(text=text))
        if isinstance(data, list):
            return [BetonItem(**item) for item in data]
    except Exception as e:
        logger.warning("LLM betony parse failed: %s", e)

    return items  # return whatever regex found
