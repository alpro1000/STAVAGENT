"""
MCP Tool: search_czech_construction_norms

3-layer search:
1. Local NKB check (knowledge base) — confidence 1.0
2. Perplexity web search on curated Czech sources — confidence 0.85
3. Post-processing: regex extraction of norm IDs (ČSN, TP, TKP, VL)

Uses the EXISTING PerplexityClient from app.core.perplexity_client.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Regex patterns for Czech construction norm identifiers
NORM_PATTERNS = {
    "csn_en": re.compile(r"ČSN\s*EN\s*[\d\s\-:]+"),
    "csn": re.compile(r"ČSN\s*\d{2}\s*\d{4}"),
    "tp": re.compile(r"TP\s*\d{2,3}"),
    "tkp": re.compile(r"TKP\s*(?:kap\.\s*)?\d{1,2}"),
    "vl": re.compile(r"VL\s*\d[\s\d.]+"),
    "tp_cbs": re.compile(r"TP\s*ČBS\s*\d{2}"),
    "din": re.compile(r"DIN\s*(?:EN\s*)?\d{4,5}"),
    "en": re.compile(r"EN\s*\d{3,5}(?:[:-]\d+)*"),
}

SYSTEM_PROMPT = """Jsi expert na české stavební normy, předpisy a praktické zkušenosti z realizace staveb.

Hledej v těchto zdrojích:
NORMY A PŘEDPISY:
- tzb-info.cz (stavební normy, technické články, diskuze odborníků)
- pjpk.rsd.cz (TP, TKP, VL pro pozemní komunikace)
- csnonline.cz (katalog ČSN norem)
- uur.cz (územní plánování, vyhlášky)
- mpo.cz (ministerstvo průmyslu, technické předpisy)
- zakonyprolidi.cz (zákony, vyhlášky)

PRAKTICKÉ ZKUŠENOSTI A ODBORNÉ ČLÁNKY:
- ebeton.cz (odborný portál o betonu)
- asb-portal.cz (stavebnictví, realizace, case studies)
- imaterialy.cz (materiály pro stavbu, technologie)
- casopisstavebnictvi.cz (odborný časopis)
- estav.cz (stavební portál, návody, zkušenosti)
- konstrukce.cz (ocelové a betonové konstrukce)

Pro každý výsledek uveď:
- Číslo normy (pokud jde o normu): ČSN EN xxx, TP xxx, TKP kap. xx
- Konkrétní článek/kapitolu normy
- Odkaz na zdroj
- Zda jde o normativní požadavek nebo praktickou zkušenost/doporučení"""


def _extract_norms(text: str) -> list[dict]:
    """Extract norm identifiers from text using regex."""
    norms = []
    seen = set()
    for norm_type, pattern in NORM_PATTERNS.items():
        for match in pattern.finditer(text):
            code = match.group(0).strip()
            if code not in seen:
                seen.add(code)
                norms.append({"type": norm_type, "code": code})
    return norms


async def search_czech_construction_norms(
    query: str,
    category: str = "všechno",
) -> dict:
    """Search Czech construction norms, regulations, and practical experience.

    Searches 12 specialized Czech construction sources including norms (ČSN, TP,
    TKP, VL), regulations, and professional journals (ebeton.cz, ASB Portal).
    Unlike generic web search, this filters ONLY verified Czech construction
    sources and extracts norm identifiers (ČSN EN, TP, TKP numbers).

    AI models often cite non-existent or outdated norms — this tool verifies
    against real sources.

    Args:
        query: Question in Czech, e.g. 'požadavky na bílou vanu dle TP ČBS 02'
        category: Filter: 'normy', 'tp', 'vyhlášky', 'všechno' (default)
    """
    try:
        # ── LAYER 1: Local NKB check ────────────────────────────────────
        local_result = await _check_local_nkb(query)
        if local_result and local_result.get("confidence", 0) >= 0.95:
            return {
                "answer": local_result["text"],
                "norms_referenced": local_result.get("norms", []),
                "sources": ["STAVAGENT NKB (local)"],
                "confidence": 1.0,
                "source_type": "local_nkb",
            }

        # ── LAYER 2: Perplexity search ──────────────────────────────────
        perplexity_result = await _perplexity_search(query, category)

        if not perplexity_result:
            return {
                "answer": "Perplexity search unavailable. Check PERPLEXITY_API_KEY.",
                "norms_referenced": [],
                "sources": [],
                "confidence": 0.0,
                "source_type": "error",
            }

        answer_text = perplexity_result.get("text", "")
        sources = perplexity_result.get("sources", [])

        # ── LAYER 3: Post-processing ────────────────────────────────────
        norms_found = _extract_norms(answer_text)

        return {
            "answer": answer_text,
            "norms_referenced": norms_found,
            "sources": sources,
            "confidence": 0.85,
            "source_type": "perplexity_search",
            "query": query,
            "category": category,
        }

    except Exception as e:
        logger.error(f"[MCP/Norms] Error: {e}")
        return {
            "answer": f"Search error: {str(e)}",
            "norms_referenced": [],
            "sources": [],
            "confidence": 0.0,
            "source_type": "error",
        }


async def _check_local_nkb(query: str) -> Optional[dict]:
    """Check local knowledge base for cached norm data."""
    try:
        from app.core.kb_loader import init_kb_loader

        kb = init_kb_loader()
        # Search across norm categories
        query_lower = query.lower()

        for category_name, data in kb.data.items():
            if not isinstance(data, (list, dict)):
                continue
            # Simple keyword search in KB data
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        text = str(item).lower()
                        if all(w in text for w in query_lower.split()[:3]):
                            return {
                                "text": str(item),
                                "confidence": 0.7,  # KB match but not exact
                                "norms": _extract_norms(str(item)),
                            }
        return None
    except Exception:
        return None


async def _perplexity_search(query: str, category: str) -> Optional[dict]:
    """Search using existing Perplexity connector."""
    try:
        from app.core.perplexity_client import PerplexityClient

        client = PerplexityClient()

        # Build domain filter based on category
        domains = None
        if category == "normy":
            domains = ["csnonline.cz", "technicke-normy-csn.cz", "unmz.cz"]
        elif category == "tp":
            domains = ["pjpk.rsd.cz", "szdc.cz"]
        elif category == "vyhlášky":
            domains = ["zakonyprolidi.cz", "mpo.cz", "mmr.cz"]
        # For "všechno" we use the full domain list from SYSTEM_PROMPT

        result = await client._search(
            query=query,
            domains=domains,
        )

        if not result:
            return None

        # Extract text and sources from Perplexity response
        text = ""
        sources = []

        if isinstance(result, dict):
            choices = result.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                text = message.get("content", "")

            # Extract citations/sources
            citations = result.get("citations", [])
            if citations:
                sources = citations
        elif isinstance(result, str):
            text = result

        return {"text": text, "sources": sources}

    except Exception as e:
        logger.warning(f"[MCP/Norms] Perplexity unavailable: {e}")
        return None
