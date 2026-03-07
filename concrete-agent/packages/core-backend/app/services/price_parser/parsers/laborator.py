"""
Parser for laboratory services section.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import LaboratorItem

logger = logging.getLogger(__name__)

PARSE_LABORATOR_PROMPT = """\
Z tohoto textu ceníku extrahuj laboratorní služby.
Pro každou službu vrať:
- nazev: název služby (např. "Odběr vzorků", "Zkouška pevnosti")
- jednotka: jednotka (např. "ks", "sada", "zkouška") nebo null
- cena: cena v Kč (číslo) nebo null

Vrať JSON array.
Vrať POUZE validní JSON array.

TEXT:
{text}
"""


async def parse_laborator(text: str | None) -> list[LaboratorItem]:
    """Parse laboratory services section via LLM."""
    if not text:
        return []

    try:
        data = await ask_llm_json(PARSE_LABORATOR_PROMPT.format(text=text))
        if isinstance(data, list):
            return [LaboratorItem(**item) for item in data]
    except Exception as e:
        logger.warning("Failed to parse laborator: %s", e)

    return []
