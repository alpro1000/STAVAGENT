"""
MCP Tool: find_otskp_code

Searches the OTSKP catalog (17,904 verified items from Czech pricing system
for transport and engineering structures). Uses the existing OTSKPDatabase
from app.pricing.otskp_engine and the XML-parsed in-memory catalog.

AI models do NOT know these codes and generate non-existent ones.
This tool searches the real database.
"""

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded singleton
_catalog = None


def _get_catalog():
    """Lazy-load OTSKP catalog from XML (17MB, ~17,904 items)."""
    global _catalog
    if _catalog is not None:
        return _catalog

    from app.pricing.otskp_engine import OTSKPDatabase

    # Find the XML-derived SQLite DB or fall back to in-memory XML parse
    base = Path(__file__).resolve().parent.parent.parent
    db_path = base / "otskp.db"

    if db_path.exists():
        _catalog = OTSKPDatabase(str(db_path))
        _catalog.connect()
        logger.info(f"[MCP/OTSKP] Loaded SQLite DB: {db_path}")
        return _catalog

    # No SQLite DB — parse XML into memory
    xml_path = base / "app" / "knowledge_base" / "B1_otkskp_codes" / "2025_03_otskp.xml"
    if not xml_path.exists():
        # Try relative to app dir
        xml_path = base.parent / "app" / "knowledge_base" / "B1_otkskp_codes" / "2025_03_otskp.xml"

    _catalog = _InMemoryOTSKP(xml_path)
    return _catalog


class _InMemoryOTSKP:
    """In-memory OTSKP catalog parsed from XML. Fallback when no .db file."""

    def __init__(self, xml_path: Path):
        self.items: dict = {}
        self._load(xml_path)

    def _load(self, xml_path: Path):
        if not xml_path.exists():
            logger.warning(f"[MCP/OTSKP] XML not found: {xml_path}")
            return

        import re as _re

        content = xml_path.read_text(encoding="utf-8")
        # Strip BOM
        content = content.lstrip("\ufeff")

        polozka_re = _re.compile(r"<Polozka>(.*?)</Polozka>", _re.DOTALL)
        tag_re = {
            "code": _re.compile(r"<znacka>(.*?)</znacka>"),
            "nazev": _re.compile(r"<nazev>(.*?)</nazev>"),
            "mj": _re.compile(r"<MJ>(.*?)</MJ>"),
            "cena": _re.compile(r"<jedn_cena>(.*?)</jedn_cena>"),
            "spec": _re.compile(r"<technicka_specifikace>(.*?)</technicka_specifikace>", _re.DOTALL),
        }

        for m in polozka_re.finditer(content):
            block = m.group(1)
            code_m = tag_re["code"].search(block)
            if not code_m:
                continue
            code = code_m.group(1).strip()
            nazev_m = tag_re["nazev"].search(block)
            mj_m = tag_re["mj"].search(block)
            cena_m = tag_re["cena"].search(block)
            spec_m = tag_re["spec"].search(block)

            self.items[code] = {
                "code": code,
                "nazev": nazev_m.group(1).strip() if nazev_m else "",
                "mj": mj_m.group(1).strip() if mj_m else "",
                "cena": float(cena_m.group(1)) if cena_m else 0.0,
                "spec": spec_m.group(1).strip() if spec_m else "",
            }

        logger.info(f"[MCP/OTSKP] Loaded {len(self.items)} items from XML")

    def get(self, code: str):
        item = self.items.get(code)
        if not item:
            return None
        return _DictItem(item)

    def search(self, keyword: str, limit: int = 10):
        keyword_upper = keyword.upper()
        words = [w for w in keyword_upper.split() if len(w) >= 2]
        if not words:
            return []

        scored = []
        for item in self.items.values():
            name_upper = item["nazev"].upper()
            matched = sum(1 for w in words if w in name_upper)
            if matched == 0:
                continue
            # Score: fraction of query words matched (1.0 = all words match)
            score = matched / len(words)
            scored.append((score, item))

        # Sort by score descending, then by price ascending for ties
        scored.sort(key=lambda x: (-x[0], x[1].get("cena", 0)))
        return [_DictItem(item) for _, item in scored[:limit]]


class _DictItem:
    """Adapter to match OTSKPItem interface."""
    def __init__(self, d: dict):
        self.code = d["code"]
        self.nazev = d["nazev"]
        self.mj = d["mj"]
        self.cena = d["cena"]
        self.spec = d.get("spec", "")


async def find_otskp_code(
    query: str,
    code: Optional[str] = None,
    max_results: int = 5,
) -> dict:
    """Find OTSKP catalog codes for a construction work item.

    Database of 17,904 verified items from the Czech OTSKP pricing system
    for transport and engineering structures (cenová soustava OTSKP).
    AI models do NOT know these codes — this tool searches the real database.

    Returns code, description, unit, and indicative unit price.

    Args:
        query: Description of construction work in Czech,
               e.g. 'bednění pilot průměr 1200mm'
        code: Known OTSKP code (9 chars) for verification and detail lookup
        max_results: Maximum number of results (default 5)
    """
    try:
        catalog = _get_catalog()

        if code:
            # Exact code lookup
            item = catalog.get(code)
            if item:
                return {
                    "results": [{
                        "code": item.code,
                        "description": item.nazev,
                        "unit": item.mj,
                        "unit_price_czk": item.cena,
                        "confidence": 1.0,
                        "source": "OTSKP 1/2025",
                    }],
                    "total_found": 1,
                    "query": query,
                    "code_lookup": code,
                }
            return {
                "results": [],
                "total_found": 0,
                "query": query,
                "code_lookup": code,
                "note": f"Code '{code}' not found in OTSKP database",
            }

        # Fulltext search
        results = catalog.search(query, limit=max_results)
        return {
            "results": [
                {
                    "code": r.code,
                    "description": r.nazev,
                    "unit": r.mj,
                    "unit_price_czk": r.cena,
                    "confidence": 1.0,
                    "source": "OTSKP 1/2025",
                }
                for r in results
            ],
            "total_found": len(results),
            "query": query,
        }

    except Exception as e:
        logger.error(f"[MCP/OTSKP] Error: {e}")
        return {"error": str(e), "results": [], "total_found": 0}
