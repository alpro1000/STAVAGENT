"""
Parser for source/header section — company name, provozovna, validity dates.
"""

from __future__ import annotations

import logging

from app.services.price_parser.llm_client import ask_llm_json
from app.services.price_parser.models import Source

logger = logging.getLogger(__name__)

PARSE_SOURCE_PROMPT = """\
Z tohoto textu hlavičky ceníku betonárny extrahuj:
- company: název firmy
- provozovna: provozovna / závod / místo
- valid_from: datum platnosti od (formát YYYY-MM-DD nebo null)
- valid_to: datum platnosti do (formát YYYY-MM-DD nebo null)
- currency: měna (default "CZK")
- vat_rate: sazba DPH v % (default 21)

Vrať JSON objekt. Pokud hodnota chybí, dej null.
Vrať POUZE validní JSON.

TEXT:
{text}
"""


async def parse_source(text: str | None) -> Source:
    """Parse source/header block into Source model."""
    if not text:
        return Source()

    try:
        data = await ask_llm_json(PARSE_SOURCE_PROMPT.format(text=text))
        return Source(**{k: v for k, v in data.items() if v is not None})
    except Exception as e:
        logger.warning("Failed to parse source: %s", e)
        return Source()
