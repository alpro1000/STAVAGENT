"""
Parser for pumps (čerpadla) section.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import CerpadloItem

logger = logging.getLogger(__name__)

PARSE_CERPADLA_PROMPT = """\
Z tohoto textu ceníku extrahuj seznam čerpadel betonu.
Pro každé čerpadlo vrať:
- type: typ čerpadla (např. "PUMI 21m", "Autočerpadlo 36m")
- pristaveni: cena za přístavení v Kč (číslo nebo null)
- hodinova_sazba: hodinová sazba v Kč/h (číslo nebo null)
- cena_per_m3: cena za m³ v Kč (číslo nebo null)
- km_sazba: sazba za km v Kč/km (číslo nebo null)

Vrať JSON array. Pokud cena chybí, dej null.
Vrať POUZE validní JSON array.

TEXT:
{text}
"""


async def parse_cerpadla(text: str | None) -> list[CerpadloItem]:
    """Parse pumps section via LLM."""
    if not text:
        return []

    try:
        data = await ask_llm_json(PARSE_CERPADLA_PROMPT.format(text=text))
        if isinstance(data, list):
            return [CerpadloItem(**item) for item in data]
    except Exception as e:
        logger.warning("Failed to parse cerpadla: %s", e)

    return []
