"""
Parser for mortars/screeds (malty/potěry) section.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import MaltaPotěrItem

logger = logging.getLogger(__name__)

PARSE_MALTY_PROMPT = """\
Z tohoto textu ceníku extrahuj seznam malt a potěrů.
Pro každou položku vrať:
- name: název (např. "CT - C20", "MC 10")
- type: typ (např. "cementový potěr", "malta") nebo null
- price_per_m3: cena za m³ bez DPH (číslo) nebo null
- price_per_m3_vat: cena za m³ s DPH (číslo) nebo null

Vrať JSON array. Pokud cena chybí, dej null.
Vrať POUZE validní JSON array.

TEXT:
{text}
"""


async def parse_malty(text: str | None) -> list[MaltaPotěrItem]:
    """Parse mortars/screeds section via LLM."""
    if not text:
        return []

    try:
        data = await ask_llm_json(PARSE_MALTY_PROMPT.format(text=text))
        if isinstance(data, list):
            return [MaltaPotěrItem(**item) for item in data]
    except Exception as e:
        logger.warning("Failed to parse malty: %s", e)

    return []
