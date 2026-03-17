"""
Norms Scraper Service — Systematic extraction of construction productivity norms
from methvin.co via Perplexity API.

Scrapes man-hours, production rates, and productivity norms by category,
stores structured results in KB B4_production_benchmarks/methvin_norms/.

Categories:
  - concrete_work: formwork, reinforcement, placement, finishing
  - excavation: hand, machine, trenching, backfill
  - structural_steel: fabrication, erection, welding
  - masonry: blockwork, brickwork, stonework
  - finishing: plastering, painting, tiling, flooring
  - demolition: concrete, masonry, steel
  - foundation: piling, pile cutting, ground beams
  - road_rail: asphalt, kerbing, drainage
  - mechanical_electrical: piping, cabling, ducting
  - plant_productivity: crane, excavator, loader
"""

import json
import logging
import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Methvin category definitions ─────────────────────────────────────────────

METHVIN_CATEGORIES = {
    "concrete_formwork": {
        "label": "Concrete Work — Formwork",
        "queries": [
            "methvin.co formwork man-hours production rates per m2 for walls columns slabs beams foundations. Include assembly and dismantling hours per m2 for each element type. Slow average fast rates.",
            "methvin.co formwork construction man-hours assumes 5 uses. Column pier foundations, strip footings, attached beams, columns, lintels, walls, suspended slabs, stairs landings, edge formwork. Tradesman hours per m2.",
            "methvin.co formwork production rates pilecaps small medium large, ground beams, elevated slab soffit, walls framed small large, columns square timber, staircases soffit. m2 per hour slow average fast.",
        ],
    },
    "concrete_placement": {
        "label": "Concrete Work — Placement",
        "queries": [
            "methvin.co concrete placement man-hours unreinforced and reinforced. Blinding, foundations, strip footings, slabs on fill, suspended slabs, walls, columns, beams, stairs. Tradesman hours per m3.",
            "methvin.co concrete placement production rates. Lorry pump m3/hr, wheelbarrow various distances, readymix mass fill pile caps ground slab, tower crane slabs walls columns. Slow average fast rates.",
        ],
    },
    "concrete_reinforcement": {
        "label": "Concrete Work — Reinforcement",
        "queries": [
            "methvin.co reinforcement placing fixing man-hours. Mesh slabs walls. Bars stirrups 6-12mm, bars 16-32mm for slabs walls columns beams. Hours per tonne.",
            "methvin.co reinforcement detailed rates by bar diameter 6mm 8mm 10mm 12mm 16mm 20mm 25mm 32mm. Separate rates for slabs, columns/beams, walls. Hours per tonne slow average fast.",
        ],
    },
    "concrete_finishing": {
        "label": "Concrete Work — Finishing & Curing",
        "queries": [
            "methvin.co concrete finishing production rates. Power float, hand trowel, brush finish, tamped finish, exposed aggregate. m2 per hour slow average fast.",
            "methvin.co concrete curing stripping times by element type. Minimum days before formwork removal for slabs walls columns beams. Temperature factors.",
        ],
    },
    "excavation": {
        "label": "Excavation & Earthwork",
        "queries": [
            "methvin.co excavation production rates hydraulic excavator. Sand soil gravel clay hard ground. Bucket sizes 0.3 0.4 0.5 m3. m3 per hour slow average fast.",
            "methvin.co excavation bulking factors spoil weight. Sand soil gravel clay boulder rock concrete. Tonnes per m3. Hand excavation rates m3 per day.",
            "methvin.co trenching backfill compaction production rates. Trench excavation by width depth, backfill compaction plate vibrator roller. m3 per hour.",
        ],
    },
    "structural_steel": {
        "label": "Structural Steel",
        "queries": [
            "methvin.co structural steel fabrication man-hours. Workshop fabrication by section weight light medium heavy. Cutting drilling welding assembly. Hours per tonne.",
            "methvin.co structural steel erection man-hours production rates. Site erection bolted connections, welded connections. Crane time. Tonnes per day slow average fast.",
        ],
    },
    "masonry": {
        "label": "Masonry",
        "queries": [
            "methvin.co masonry blockwork man-hours. Hollow blocks 100mm 150mm 200mm. Tradesman and labourer hours per m2. Reinforced blockwork, pointing, lintel blocks.",
            "methvin.co masonry production rates. Thermalite lightweight heavyweight blocks by thickness. m2 per hour slow average fast. Concrete filling cores.",
            "methvin.co brickwork man-hours production rates. Common brick face brick engineering brick. Half brick one brick cavity wall. m2 per hour.",
        ],
    },
    "plastering": {
        "label": "Plastering",
        "queries": [
            "methvin.co plastering man-hours. Cement render 13mm walls soffits columns beams. Hardwall plaster 16mm. Tradesman and labourer hours per m2.",
            "methvin.co plastering production rates. Browning walls under and over 2.5m, reveals columns. Skimming walls reveals. Ceilings plasterboard bonding skim. m2 per hour slow average fast.",
        ],
    },
    "painting_tiling": {
        "label": "Painting & Tiling",
        "queries": [
            "methvin.co painting man-hours. Acrylic enamel walls ceilings soffits timber metal. Paper hanging. Hours per m2. Polyurethane stain.",
            "methvin.co tiling production rates. Ceramic 150x150 108x108. Ledges upstands small medium large areas. Cutting rate. Grouting. m2 per hour or number per hour slow average fast.",
        ],
    },
    "demolition": {
        "label": "Demolition",
        "queries": [
            "methvin.co demolition production rates. Concrete demolition cutting back. Masonry demolition. Steel structure demolition. m3 or m2 per hour. Equipment requirements.",
        ],
    },
    "foundation": {
        "label": "Foundation",
        "queries": [
            "methvin.co foundation production rates. Piling driven bored. Pile cutting back man-hours by pile diameter. Ground beams pile caps. Hours per unit.",
        ],
    },
    "road_rail": {
        "label": "Road & Rail",
        "queries": [
            "methvin.co road construction production rates. Asphalt laying kerbing drainage channels. m2 per hour or m per hour. Sub-base preparation compaction.",
        ],
    },
    "plant_productivity": {
        "label": "Plant & Equipment Productivity",
        "queries": [
            "methvin.co plant productivity rates. Crane lifting capacity output. Excavator trenching loading. Concrete pump output. Compactor roller. Units per hour.",
        ],
    },
    "piping_mechanical": {
        "label": "Piping & Mechanical",
        "queries": [
            "methvin.co pipe welding man-hours by diameter and wall thickness. Carbon steel stainless steel. Butt weld socket weld. Hours per joint or per inch-diameter.",
            "methvin.co piping erection man-hours. Small bore large bore. Supports hangers valves flanges. Hours per metre or per unit.",
        ],
    },
}

# ── Perplexity query helper ──────────────────────────────────────────────────


async def _query_perplexity(query: str, timeout: float = 60.0) -> dict:
    """
    Query Perplexity sonar-pro for construction norms data.
    Returns raw API response dict.
    """
    api_key = getattr(settings, "PERPLEXITY_API_KEY", None)
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY not configured")

    payload = {
        "model": "sonar-pro",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a construction productivity norms database extractor. "
                    "Extract ALL numerical data: man-hours, production rates, units. "
                    "Return data as structured JSON with clear keys. "
                    "Include slow/average/fast ranges where available. "
                    "Use standardized units: h/m2, h/m3, h/tonne, m2/hr, m3/hr. "
                    "Always include the source URL from methvin.co."
                ),
            },
            {"role": "user", "content": query},
        ],
        "max_tokens": 4000,
        "temperature": 0.0,
        "return_citations": True,
        "return_images": False,
        "search_domain_filter": ["methvin.co", "methvin.us"],
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def _extract_structured_data(raw_response: dict) -> dict:
    """Extract structured JSON from Perplexity response text."""
    content = (
        raw_response.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    citations = raw_response.get("citations", [])

    # Try to parse JSON from response
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            data["_sources"] = citations
            return data
        except json.JSONDecodeError:
            pass

    # Try raw JSON
    json_match = re.search(r"\{.*\}", content, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            data["_sources"] = citations
            return data
        except json.JSONDecodeError:
            pass

    # Fallback: store raw text
    return {
        "_raw_text": content,
        "_sources": citations,
        "_parse_failed": True,
    }


# ── Storage helpers ──────────────────────────────────────────────────────────

def _norms_dir() -> Path:
    """Get the methvin_norms storage directory."""
    d = settings.BASE_DIR / "app" / "knowledge_base" / "B4_production_benchmarks" / "methvin_norms"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_norm(category: str, query_index: int, data: dict) -> Path:
    """Save scraped norm to JSON file."""
    target = _norms_dir() / f"{category}_q{query_index}.json"
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def _load_norm(category: str, query_index: int) -> Optional[dict]:
    """Load cached norm if exists."""
    target = _norms_dir() / f"{category}_q{query_index}.json"
    if target.exists():
        try:
            return json.loads(target.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _merge_category_norms(category: str) -> dict:
    """Merge all query results for a category into one dict."""
    merged = {
        "category": category,
        "label": METHVIN_CATEGORIES.get(category, {}).get("label", category),
        "source": "methvin.co",
        "scraped_at": None,
        "data": {},
        "sources": [],
    }
    norms_path = _norms_dir()
    for f in sorted(norms_path.glob(f"{category}_q*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
            scraped = d.get("scraped_at")
            if scraped:
                merged["scraped_at"] = scraped
            # Merge data keys
            for k, v in d.items():
                if k.startswith("_") or k in ("scraped_at", "category", "query"):
                    continue
                merged["data"][k] = v
            # Collect sources
            for s in d.get("_sources", []):
                if s not in merged["sources"]:
                    merged["sources"].append(s)
        except Exception:
            continue
    return merged


# ── Main scraping functions ──────────────────────────────────────────────────


async def scrape_category(category: str, force: bool = False) -> dict:
    """
    Scrape all queries for a single category.

    Args:
        category: Key from METHVIN_CATEGORIES
        force: If True, re-scrape even if cached

    Returns:
        Merged norms dict for the category
    """
    if category not in METHVIN_CATEGORIES:
        raise ValueError(f"Unknown category: {category}. Available: {list(METHVIN_CATEGORIES.keys())}")

    cat_def = METHVIN_CATEGORIES[category]
    queries = cat_def["queries"]
    results = []

    for i, query in enumerate(queries):
        # Check cache
        if not force:
            cached = _load_norm(category, i)
            if cached:
                logger.info(f"[NormsScraper] Cache hit: {category} q{i}")
                results.append(cached)
                continue

        # Query Perplexity
        logger.info(f"[NormsScraper] Querying Perplexity: {category} q{i}")
        try:
            raw = await _query_perplexity(query)
            data = _extract_structured_data(raw)
            data["scraped_at"] = datetime.utcnow().isoformat()
            data["category"] = category
            data["query"] = query

            _save_norm(category, i, data)
            results.append(data)
            logger.info(f"[NormsScraper] Saved: {category} q{i}")
        except Exception as exc:
            logger.error(f"[NormsScraper] Failed {category} q{i}: {exc}")
            results.append({"_error": str(exc), "category": category, "query": query})

    return _merge_category_norms(category)


async def scrape_all(force: bool = False) -> dict:
    """
    Scrape all categories. Returns summary.

    Args:
        force: If True, re-scrape everything
    """
    summary = {
        "started_at": datetime.utcnow().isoformat(),
        "categories": {},
        "total_queries": 0,
        "success_count": 0,
        "error_count": 0,
    }

    for category in METHVIN_CATEGORIES:
        try:
            result = await scrape_category(category, force=force)
            has_data = bool(result.get("data"))
            summary["categories"][category] = {
                "label": result.get("label", ""),
                "has_data": has_data,
                "sources_count": len(result.get("sources", [])),
            }
            query_count = len(METHVIN_CATEGORIES[category]["queries"])
            summary["total_queries"] += query_count
            if has_data:
                summary["success_count"] += query_count
            else:
                summary["error_count"] += query_count
        except Exception as exc:
            logger.error(f"[NormsScraper] Category {category} failed: {exc}")
            summary["categories"][category] = {"error": str(exc)}
            summary["error_count"] += len(METHVIN_CATEGORIES[category].get("queries", []))

    summary["completed_at"] = datetime.utcnow().isoformat()

    # Save summary
    summary_path = _norms_dir() / "_scrape_summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    return summary


def get_norms_for_work_type(work_type: str) -> dict:
    """
    Get relevant norms for a work type used by calculators.

    Args:
        work_type: One of: beton, bedneni, vyztuž, zemni_prace, zdivo, ocel, etc.

    Returns:
        Dict with relevant norms from both existing KB and scraped methvin data
    """
    # Map Czech work types to methvin categories
    type_to_categories = {
        "beton": ["concrete_placement", "concrete_finishing"],
        "bedneni": ["concrete_formwork"],
        "vyztuž": ["concrete_reinforcement"],
        "zemni_prace": ["excavation"],
        "zdivo": ["masonry"],
        "ocel": ["structural_steel"],
        "omitky": ["plastering"],
        "malba": ["painting_tiling"],
        "demolice": ["demolition"],
        "zaklady": ["foundation", "concrete_formwork"],
        "komunikace": ["road_rail"],
        "mechanizace": ["plant_productivity"],
        "potrubi": ["piping_mechanical"],
    }

    categories = type_to_categories.get(work_type, [])
    if not categories:
        return {"work_type": work_type, "norms": {}, "message": f"No methvin mapping for '{work_type}'"}

    norms = {}
    sources = []

    for cat in categories:
        merged = _merge_category_norms(cat)
        if merged.get("data"):
            norms[cat] = merged["data"]
            sources.extend(merged.get("sources", []))

    # Also load from existing KB files
    existing_kb = _load_existing_kb_norms(work_type)

    return {
        "work_type": work_type,
        "methvin_norms": norms,
        "existing_kb_norms": existing_kb,
        "sources": list(set(sources)),
        "categories_checked": categories,
    }


def _load_existing_kb_norms(work_type: str) -> dict:
    """Load relevant norms from the existing KB JSON files."""
    kb_dir = settings.BASE_DIR / "app" / "knowledge_base" / "B4_production_benchmarks"
    result = {}

    # Map work type to sections in construction_productivity_norms.json
    type_to_sections = {
        "beton": ["concrete_placement"],
        "bedneni": ["formwork"],
        "vyztuž": ["reinforcement"],
        "zemni_prace": ["excavation"],
        "zdivo": ["masonry"],
        "omitky": ["plastering"],
        "malba": ["painting"],
        "obklady": ["tiling"],
    }

    sections = type_to_sections.get(work_type, [])
    if not sections:
        return result

    # Load main norms file
    norms_file = kb_dir / "construction_productivity_norms.json"
    if norms_file.exists():
        try:
            all_norms = json.loads(norms_file.read_text(encoding="utf-8"))
            for section in sections:
                if section in all_norms:
                    result[section] = all_norms[section]
        except Exception:
            pass

    # Load bedneni.json for formwork
    if work_type == "bedneni":
        bedneni_file = kb_dir / "bedneni.json"
        if bedneni_file.exists():
            try:
                result["bedneni_systems"] = json.loads(bedneni_file.read_text(encoding="utf-8"))
            except Exception:
                pass

    return result


def list_scraped_categories() -> dict:
    """List all scraped categories and their status."""
    norms_path = _norms_dir()
    if not norms_path.exists():
        return {"categories": {}, "total_files": 0}

    files = list(norms_path.glob("*.json"))
    categories = {}

    for cat_key in METHVIN_CATEGORIES:
        cat_files = [f for f in files if f.name.startswith(f"{cat_key}_q")]
        expected = len(METHVIN_CATEGORIES[cat_key]["queries"])
        categories[cat_key] = {
            "label": METHVIN_CATEGORIES[cat_key]["label"],
            "scraped_files": len(cat_files),
            "expected_queries": expected,
            "complete": len(cat_files) >= expected,
        }

    return {
        "categories": categories,
        "total_files": len(files),
        "storage_path": str(norms_path),
    }
