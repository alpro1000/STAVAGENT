"""
Parser for delivery (doprava) section.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import Doprava, DopravaZona

logger = logging.getLogger(__name__)

PARSE_DOPRAVA_PROMPT = """\
Z tohoto textu ceníku extrahuj informace o dopravě betonu.
Vrať JSON objekt:
{{
  "min_objem_m3": minimální objem objednávky v m³ (číslo nebo null),
  "volny_cas_min": volný čas na staveništi v minutách (číslo nebo null),
  "cekani_per_15min": cena za čekání za 15 min v Kč (číslo nebo null),
  "zony": [
    {{"km_from": 0, "km_to": 5, "price_per_m3": 300}},
    ...
  ],
  "pristaveni_ks": cena za přístavení (za autodomíchávač) v Kč (číslo nebo null)
}}

Pokud hodnota chybí, dej null. Zóny: prázdný array pokud nejsou.
Vrať POUZE validní JSON.

TEXT:
{text}
"""


async def parse_doprava(text: str | None) -> Doprava:
    """Parse delivery section via LLM."""
    if not text:
        return Doprava()

    try:
        data = await ask_llm_json(PARSE_DOPRAVA_PROMPT.format(text=text))
        zony = [DopravaZona(**z) for z in data.get("zony", [])]
        return Doprava(
            min_objem_m3=data.get("min_objem_m3"),
            volny_cas_min=data.get("volny_cas_min"),
            cekani_per_15min=data.get("cekani_per_15min"),
            zony=zony,
            pristaveni_ks=data.get("pristaveni_ks"),
        )
    except Exception as e:
        logger.warning("Failed to parse doprava: %s", e)
        return Doprava()
