"""
Parser for surcharges (příplatky) section — time, winter, technological.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import (
    Priplatky,
    PriplatekCasovy,
    PriplatekZimni,
    PriplatekTechnologicky,
)

logger = logging.getLogger(__name__)

PARSE_PRIPLATKY_PROMPT = """\
Z tohoto textu ceníku extrahuj příplatky. Rozděl je do tří kategorií:

1. "casove" — časové příplatky (noc, večer, sobota, neděle, svátky):
   [{{"nazev": "Sobota", "typ": "%" nebo "Kč/m³", "hodnota": 5}}]

2. "zimni" — zimní příplatky (podle teploty):
   [{{"teplota_from": 0, "teplota_to": 5, "price_per_m3": 150}}]

3. "technologicke" — technologické příplatky (konzistence, vlákna, přísady, přetřídění):
   [{{"nazev": "Konzistence S4", "typ": "Kč/m³", "hodnota": 100}}]

Vrať JSON objekt:
{{
  "casove": [...],
  "zimni": [...],
  "technologicke": [...]
}}

Pokud kategorie nemá položky, vrať prázdný array [].
Vrať POUZE validní JSON.

TEXT:
{text}
"""


async def parse_priplatky(text: str | None) -> Priplatky:
    """Parse surcharges section via LLM."""
    if not text:
        return Priplatky()

    try:
        data = await ask_llm_json(PARSE_PRIPLATKY_PROMPT.format(text=text))
        return Priplatky(
            casove=[PriplatekCasovy(**i) for i in data.get("casove", [])],
            zimni=[PriplatekZimni(**i) for i in data.get("zimni", [])],
            technologicke=[PriplatekTechnologicky(**i) for i in data.get("technologicke", [])],
        )
    except Exception as e:
        logger.warning("Failed to parse priplatky: %s", e)
        return Priplatky()
