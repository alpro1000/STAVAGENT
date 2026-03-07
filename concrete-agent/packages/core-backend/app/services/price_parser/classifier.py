"""
Block classifier — splits raw price list text into semantic sections via LLM.

Sections: betony, malty_potere, doprava, cerpadla, priplatky, laborator, source, ostatni
"""

from __future__ import annotations

import logging
from typing import Optional

from app.services.price_parser.llm_client import ask_llm_json

logger = logging.getLogger(__name__)

CLASSIFY_PROMPT = """\
Toto je text z ceníku betonárny (výrobce betonu).
Rozděl ho do následujících sekcí. Pro každou sekci vrať přesný text, který k ní patří.

Sekce:
- "source" — hlavička: název firmy, provozovna, platnost ceníku, měna, DPH
- "betony" — seznam betonů (C 8/10, C 25/30, C 30/37 atd.) s cenami
- "malty_potere" — malty, potěry, cementové směsi
- "doprava" — doprava betonu, zóny, km sazby, čekání, přístavné
- "cerpadla" — čerpadla betonu, PUMI, autočerpadla, sazby
- "priplatky" — příplatky: časové (noc, sobota, neděle), zimní, technologické (konzistence, vlákna, přísady)
- "laborator" — laboratorní služby, zkoušky, odběr vzorků

Vrať JSON objekt:
{{
  "source": "...text sekce nebo null...",
  "betony": "...text sekce nebo null...",
  "malty_potere": "...text sekce nebo null...",
  "doprava": "...text sekce nebo null...",
  "cerpadla": "...text sekce nebo null...",
  "priplatky": "...text sekce nebo null...",
  "laborator": "...text sekce nebo null...",
  "ostatni": "...nezařazený text nebo null..."
}}

Pokud sekce neexistuje, vrať null.
Vrať POUZE validní JSON, žádný další text.

TEXT:
{text}
"""


async def classify_blocks(text: str) -> dict[str, Optional[str]]:
    """
    Classify price list text into semantic blocks using LLM.

    Returns dict with section names as keys and section text (or None) as values.
    """
    # Truncate very long texts to stay within LLM context
    max_chars = 30_000
    if len(text) > max_chars:
        logger.warning("Text too long (%d chars), truncating to %d", len(text), max_chars)
        text = text[:max_chars]

    prompt = CLASSIFY_PROMPT.format(text=text)
    result = await ask_llm_json(prompt)

    if not isinstance(result, dict):
        logger.error("Classifier returned non-dict: %s", type(result))
        return {"ostatni": text}

    # Ensure all expected keys exist
    expected = {"source", "betony", "malty_potere", "doprava", "cerpadla", "priplatky", "laborator", "ostatni"}
    for key in expected:
        if key not in result:
            result[key] = None

    non_empty = sum(1 for v in result.values() if v)
    logger.info("Classified into %d non-empty sections", non_empty)

    return result
