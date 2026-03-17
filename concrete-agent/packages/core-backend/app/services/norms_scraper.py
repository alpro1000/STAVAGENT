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
    # ═══════════════════════════════════════════════════════════════════════════
    # CONCRETE WORK (6 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "concrete_formwork": {
        "label": "Concrete — Formwork",
        "queries": [
            "site:methvin.co formwork man-hours production rates. Formwork construction man-hours per m2 assuming 5 uses. Column pier foundations F1, strip footing F1, attached beam F4 F1, column F4 F1, lintels beams F4 F1, wall F4 F1, suspended slab F4 F1, stairs landings F4 F1, edge 0-100mm 100-200mm 200-300mm F4. Tradesman hours. Return ALL numbers as JSON.",
            "site:methvin.co formwork production rates m2 per hour. Pilecaps small medium large, ground beams, elevated slab soffit, walls framed small large, columns square timber, staircases soffit. Each with slow average fast. Return ALL numbers as JSON.",
            "site:methvin.co formwork adjustment factors. Number of uses: 4 uses +2.5%, 3 uses +6%, 2 uses +12.5%, 1 use +20%. Complexity factors for different element types. Access scaffolding additions. Return ALL data as JSON.",
        ],
    },
    "concrete_scaffolding": {
        "label": "Concrete — Scaffolding",
        "queries": [
            "site:methvin.co scaffolding production rates man-hours. Tube and fitting scaffolding, system scaffolding, birdcage scaffold, independent scaffold. Erection and dismantling rates. m2 per hour per man. All data as JSON.",
            "site:methvin.co scaffolding types labour outputs. Putlog scaffold, independent tied scaffold, mobile tower scaffold, cantilever scaffold. Access scaffolding for formwork. Hours per m2 erect and strike.",
        ],
    },
    "concrete_placement": {
        "label": "Concrete — Placement",
        "queries": [
            "site:methvin.co concrete placement man-hours for UNREINFORCED concrete. Blinding 50mm, column pier foundations, strip footings, mass fill, raft foundations. Tradesman hours per m3. Return ALL numbers as JSON.",
            "site:methvin.co concrete placement man-hours for REINFORCED concrete. Column pier foundations, strip footings, slabs on fill, suspended slabs 150-300mm, walls 150-300mm, columns, attached beams, isolated beams, stairs landings. Tradesman hours per m3. ALL numbers as JSON.",
            "site:methvin.co concrete placement production rates. Lorry pump m3/hr (slow average fast), wheelbarrow 1-10m 10-20m 20-50m, readymix mass fill pile caps ground slab, tower crane thin slabs thick slabs walls columns. ALL rates as JSON.",
            "site:methvin.co concrete mixing production rates. Site mixing, hand mixing, machine mixing. Batching plant output. m3 per hour. Mixer sizes 0.15 0.30 0.50 m3. ALL data as JSON.",
        ],
    },
    "concrete_reinforcement": {
        "label": "Concrete — Reinforcement",
        "queries": [
            "site:methvin.co reinforcement placing fixing man-hours. Mesh: slabs small areas, slabs large areas, walls. Hours per m2. Bars: stirrups 6-12mm, bars 16-32mm for slabs walls columns beams. Hours per tonne. ALL numbers as JSON.",
            "site:methvin.co reinforcement DETAILED rates by bar diameter for SLABS: 6mm 8mm 10mm 12mm 16mm 20mm 25mm 32mm. Hours per tonne with slow average fast. Return complete table as JSON.",
            "site:methvin.co reinforcement DETAILED rates by bar diameter for COLUMNS and BEAMS: 12mm 16mm 20mm 25mm 32mm. Hours per tonne with slow average fast. Return complete table as JSON.",
            "site:methvin.co reinforcement DETAILED rates by bar diameter for WALLS: 12mm 16mm 20mm 25mm 32mm. Hours per tonne with slow average fast. Return complete table as JSON.",
            "site:methvin.co reinforcement production rates. Bar bending schedules, cutting lists, laps and couplers, spacers, chairs, tying wire. Wastage factors by bar size. Prefabricated cages. ALL data as JSON.",
        ],
    },
    "concrete_finishing": {
        "label": "Concrete — Surface Finishes",
        "queries": [
            "site:methvin.co concrete finishing surface finishes production rates. Power float, hand trowel, brush finish, tamped finish, exposed aggregate, bush hammered, acid etched, polished concrete. m2 per hour slow average fast. ALL numbers as JSON.",
            "site:methvin.co concrete curing requirements and stripping times. Minimum days before formwork removal by element type (slabs walls columns beams foundations). Temperature dependent. Striking times table. ALL data as JSON.",
        ],
    },
    "concrete_joints": {
        "label": "Concrete — Joints & Waterstops",
        "queries": [
            "site:methvin.co expansion joints waterstops production rates man-hours. Joint types: expansion contraction construction cold joints. Waterstop installation rates. Sealant application rates. Metres per hour. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # EXCAVATION (8 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "excavation_bulk": {
        "label": "Excavation — Bulk",
        "queries": [
            "site:methvin.co bulk excavation production rates. Hydraulic excavator in sand/soil, gravel, clay, hard ground. Bucket sizes 0.3m3 0.4m3 0.5m3. m3 per hour slow average fast. ALL numbers as JSON.",
            "site:methvin.co bulk excavation dozers scrapers. Dozer production rates by soil type. Scraper loading hauling spreading. m3 per hour. ALL data as JSON.",
        ],
    },
    "excavation_trench": {
        "label": "Excavation — Trench",
        "queries": [
            "site:methvin.co trench excavation production rates. By trench width 300mm 450mm 600mm 900mm and depth 1m 1.5m 2m 3m. Excavator and hand dig rates. m3 per hour or m per hour. ALL numbers as JSON.",
        ],
    },
    "excavation_deep": {
        "label": "Excavation — Small/Deep",
        "queries": [
            "site:methvin.co small or deep excavation production rates. Pit excavation, basement excavation, shaft sinking. Hand excavation rates by soil type. m3 per hour. ALL data as JSON.",
        ],
    },
    "excavation_backfill": {
        "label": "Excavation — Backfill & Compaction",
        "queries": [
            "site:methvin.co backfilling compaction production rates. Backfill placement rates, compaction plate vibrator roller. Layer thickness requirements. m3 per hour. Compaction equipment output. ALL data as JSON.",
        ],
    },
    "excavation_factors": {
        "label": "Excavation — Bulking & Spoil",
        "queries": [
            "site:methvin.co bulking factors spoil weight density. Sand soil 0.15, gravel 0.33, clay chalk 0.40, boulder clay 0.45, rock 0.60. Spoil weight: rock 2.5 t/m3, concrete 2.4, landfill 1.9, sand 1.8. ALL factors as JSON.",
        ],
    },
    "excavation_dewatering": {
        "label": "Excavation — Dewatering",
        "queries": [
            "site:methvin.co dewatering production rates. Pump capacities, wellpoint systems, sump pumping. Litres per minute by pump size. Installation rates. ALL data as JSON.",
        ],
    },
    "excavation_milling": {
        "label": "Excavation — Milling",
        "queries": [
            "site:methvin.co milling estimating production rates. Road milling machine output. Milling depth rates. m2 per hour by depth. ALL data as JSON.",
        ],
    },
    "excavation_spread_level": {
        "label": "Excavation — Spread & Level",
        "queries": [
            "site:methvin.co spread and level production rates. Grading trimming leveling. Machine and hand rates. m2 or m3 per hour. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # MASONRY / BUILDING CONSTANTS (7 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "masonry_blockwork": {
        "label": "Masonry — Blockwork",
        "queries": [
            "site:methvin.co blockwork man-hours. Hollow blocks 400x200 in 100mm 150mm 200mm thickness. Tradesman and labourer hours per m2. Reinforced blockwork. Pointing cleaning. Lintel blocks per metre. ALL numbers as JSON.",
            "site:methvin.co blockwork production rates. Thermalite under/over 100mm 150mm. Lightweight blocks. Heavyweight blocks. m2 per hour slow average fast by thickness. Concrete filling cores. ALL data as JSON.",
        ],
    },
    "masonry_brickwork": {
        "label": "Masonry — Brickwork",
        "queries": [
            "site:methvin.co brickwork man-hours production rates. Common brick, face brick, engineering brick. Half brick wall, one brick wall, cavity wall. m2 per hour slow average fast. Pointing rates. ALL numbers as JSON.",
            "site:methvin.co brickwork mortar consumption. Mortar per m2 by bond type. Stretcher bond, English bond, Flemish bond. Wastage factors. ALL data as JSON.",
        ],
    },
    "masonry_stonework": {
        "label": "Masonry — Stonework",
        "queries": [
            "site:methvin.co stonework production rates man-hours. Random rubble, coursed rubble, ashlar, dressed stone. Walling rates m2 per hour. Pointing stone. Copings. ALL data as JSON.",
        ],
    },
    "masonry_restoration": {
        "label": "Masonry — Restoration",
        "queries": [
            "site:methvin.co restoration works production rates. Repointing, brick cleaning, stone repair, crack stitching, damp proofing. m2 per hour or m per hour. ALL data as JSON.",
        ],
    },
    "plastering": {
        "label": "Building — Plastering",
        "queries": [
            "site:methvin.co plastering man-hours. Cement render 13mm: walls soffits columns beams. Hardwall plaster 16mm: walls soffits columns beams. Tradesman and labourer hours per m2. ALL numbers as JSON.",
            "site:methvin.co plastering production rates. Browning: walls under/over 2.5m, reveals columns 100-200-300mm. Skimming: walls reveals. Ceilings: plasterboard, bonding skim, topcoat. m2 per hour slow average fast. ALL data as JSON.",
            "site:methvin.co dry lining plasterboard production rates. Dot and dab, metal stud partition, ceiling board fixing. m2 per hour. Taping and jointing rates. ALL data as JSON.",
        ],
    },
    "floor_coverings": {
        "label": "Building — Floor Coverings",
        "queries": [
            "site:methvin.co floor coverings production rates. Screed laying, vinyl tiles, carpet tiles, timber flooring, epoxy coating. m2 per hour slow average fast. ALL data as JSON.",
        ],
    },
    "glazing_precast": {
        "label": "Building — Glazing & Precast",
        "queries": [
            "site:methvin.co glazing production rates man-hours. Window installation, curtain wall, glazed partitions. Units per hour or m2 per hour. Precast element installation rates: panels beams columns. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # PAINTING & TILING (2 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "painting": {
        "label": "Finishing — Painting",
        "queries": [
            "site:methvin.co painting man-hours ALL types. Acrylic: walls ceilings soffits timber metal. Enamel: walls ceilings soffits timber metal polyurethane stain. Paper hanging: walls ceilings. Tradesman hours per m2. ALL numbers as JSON.",
            "site:methvin.co painting production rates. Spray painting, roller painting, brush painting. Primer undercoat topcoat rates. Steel painting blast cleaning. m2 per hour by surface type. ALL data as JSON.",
        ],
    },
    "tiling": {
        "label": "Finishing — Tiling",
        "queries": [
            "site:methvin.co tiling production rates ALL tile sizes. Ceramic 150x150: ledges, under 1.5m2, 1.5-2.5m2, over 2.5m2. Ceramic 108x108 same. Cutting rates (number per hour). Grouting m2/hr. ALL numbers as JSON.",
            "site:methvin.co tiling large format tiles mosaic tiles natural stone. Production rates m2 per hour. Wall vs floor tiling. Waterproofing tanking. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # DEMOLITION (4 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "demolition_concrete": {
        "label": "Demolition — Concrete",
        "queries": [
            "site:methvin.co concrete demolition production rates. Hydraulic breaker, diamond cutting, wire sawing, crushing. Demolishing reinforced concrete slabs walls columns. m3 per hour by thickness. ALL numbers as JSON.",
            "site:methvin.co cutting back concrete production rates. Kango hammer, diamond saw. Pile cutting back by diameter 300 450 600 750 900 1200mm. Hours per pile. ALL data as JSON.",
        ],
    },
    "demolition_structures": {
        "label": "Demolition — Structures",
        "queries": [
            "site:methvin.co demolishing structures production rates. Building demolition, bridge demolition, chimney demolition. Mechanical vs hand demolition. Tonnes per hour. ALL data as JSON.",
        ],
    },
    "demolition_masonry": {
        "label": "Demolition — Masonry & Non-explosive",
        "queries": [
            "site:methvin.co masonry demolition rates. Brick wall removal, block wall removal. Non-explosive demolition methods. m2 or m3 per hour. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # FOUNDATION / PILING (6 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "foundation_bored_piling": {
        "label": "Foundation — Bored Piling",
        "queries": [
            "site:methvin.co bored piling production rates. CFA piles, rotary bored piles. Piling rig output by diameter 300 450 600 750 900 1200mm. Metres per shift. Concrete volume per pile. ALL data as JSON.",
        ],
    },
    "foundation_driven_piling": {
        "label": "Foundation — Driven Piling",
        "queries": [
            "site:methvin.co driven piling production rates. Precast concrete piles, steel H piles, sheet piling. Piles per day by size. Hammer types. ALL data as JSON.",
        ],
    },
    "foundation_pile_cutting": {
        "label": "Foundation — Pile Cutting Back",
        "queries": [
            "site:methvin.co pile cutting back man-hours. By pile diameter 300mm 450mm 600mm 750mm 900mm 1050mm 1200mm. Reinforced and unreinforced. Hours per pile. ALL numbers as JSON.",
        ],
    },
    "foundation_other": {
        "label": "Foundation — Other (Micropiles, Anchors, Caissons)",
        "queries": [
            "site:methvin.co micropiles secant piling barrette piles ground anchors hand dug caissons production rates. Installation rates per day. Metres per shift. ALL data as JSON.",
        ],
    },
    "foundation_retaining": {
        "label": "Foundation — Retaining Structures",
        "queries": [
            "site:methvin.co retaining structures production rates. Retaining walls, gabions, crib walls, soil nails, reinforced earth. m2 or m per day. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # STRUCTURAL STEEL (5 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "steel_fabrication": {
        "label": "Steel — Workshop Fabrication",
        "queries": [
            "site:methvin.co structural steel workshop fabrication man-hours. Light sections under 20kg/m, medium 20-40kg/m, heavy over 40kg/m. Cutting drilling welding assembly painting. Hours per tonne. ALL numbers as JSON.",
            "site:methvin.co steel fabrication detailed rates. Plate work, box sections, trusses, lattice girders. Welding types: fillet butt TIG MIG. Hours per tonne or per metre of weld. ALL data as JSON.",
        ],
    },
    "steel_erection": {
        "label": "Steel — Site Erection",
        "queries": [
            "site:methvin.co structural steel erection man-hours. Site erection bolted connections welded connections. Single storey multi storey portal frame. Tonnes per day slow average fast. Crane requirements. ALL numbers as JSON.",
        ],
    },
    "steel_frames": {
        "label": "Steel — Frames & Bracing",
        "queries": [
            "site:methvin.co steel frames bracing production rates. Portal frames, multi-storey frames, bracing systems, purlins rails. Tonnes per day. ALL data as JSON.",
        ],
    },
    "steel_cladding": {
        "label": "Steel — Cladding & Stairs",
        "queries": [
            "site:methvin.co steel cladding framing production rates. Metal deck, profiled sheeting, composite floor deck. m2 per hour. Stairs balustrades ladders man-hours. ALL data as JSON.",
        ],
    },
    "steel_surface": {
        "label": "Steel — Surface Treatment",
        "queries": [
            "site:methvin.co steel surface treatment production rates. Blast cleaning SA 2.5, primer application, intumescent coating, galvanizing. m2 per hour. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # MECHANICAL & ELECTRICAL (4 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "mep_conduit_cable": {
        "label": "M&E — Conduit & Cable",
        "queries": [
            "site:methvin.co conduit production rates man-hours. PVC conduit, steel conduit, trunking. By diameter 20mm 25mm 32mm. Metres per hour. Cable pulling rates by size. ALL numbers as JSON.",
        ],
    },
    "mep_cable_laying": {
        "label": "M&E — Cable Laying",
        "queries": [
            "site:methvin.co cable laying production rates. Cable tray, cable ladder, underground cable. Metres per hour by cable size. Jointing termination rates. ALL data as JSON.",
        ],
    },
    "mep_power_supply": {
        "label": "M&E — Power Supply & Distribution",
        "queries": [
            "site:methvin.co power supply installation rates. Switchboards, distribution boards, transformers, generators. Installation hours per unit. ALL data as JSON.",
        ],
    },
    "mep_hvac_plumbing": {
        "label": "M&E — HVAC & Plumbing",
        "queries": [
            "site:methvin.co HVAC plumbing installation rates. Ductwork m2/hr, pipework metres per hour by diameter, radiators per day, sanitary fittings. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # PROCESS PLANT ENGINEERING (3 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "piping_welding": {
        "label": "Process — Pipe Welding",
        "queries": [
            "site:methvin.co pipe welding man-hours COMPLETE TABLE. By nominal diameter 1/2\" to 36\" and wall thickness schedule 10 40 80 160. Carbon steel butt weld. Hours per joint. ALL numbers as JSON.",
            "site:methvin.co pipe welding stainless steel alloy. TIG welding rates by diameter. Socket weld rates. Orbital welding. Hours per joint. ALL data as JSON.",
        ],
    },
    "piping_erection": {
        "label": "Process — Pipe Erection",
        "queries": [
            "site:methvin.co piping erection man-hours. Small bore under 2\", large bore over 2\". Pipe supports hangers, valves, flanges, fittings. Hours per metre or per unit. ALL numbers as JSON.",
        ],
    },
    "piping_insulation": {
        "label": "Process — Pipe Insulation",
        "queries": [
            "site:methvin.co pipe insulation man-hours. By pipe diameter and insulation thickness. Mineral wool, calcium silicate, cellular glass. Metres per hour. Cladding rates. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # PLANT PRODUCTIVITY (4 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "plant_cranes": {
        "label": "Plant — Tower Cranes",
        "queries": [
            "site:methvin.co tower crane production rates. Crane output by capacity 25t 50t 80t 120t. Lifts per hour. Reach capacity charts. Erection dismantling times. ALL data as JSON.",
        ],
    },
    "plant_excavators": {
        "label": "Plant — Excavator Load Cycles",
        "queries": [
            "site:methvin.co excavator load cycle times. Cycle time by excavator size and swing angle. Bucket fill factors by soil type. Load cycle optimization. ALL data as JSON.",
        ],
    },
    "plant_trucks": {
        "label": "Plant — Truck Haulage",
        "queries": [
            "site:methvin.co truck haulage capacity production rates. Dump truck payload 6 12 20 30 tonne. Haul distance vs cycle time. Truck fleet calculation. Density load factors. ALL data as JSON.",
        ],
    },
    "plant_compaction": {
        "label": "Plant — Compaction & Other",
        "queries": [
            "site:methvin.co compaction equipment production rates. Vibratory roller, plate compactor, rammer. m2 or m3 per hour by layer thickness. Concrete pump output by type. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # ROAD & RAIL (3 subcategories)
    # ═══════════════════════════════════════════════════════════════════════════
    "road_asphalt": {
        "label": "Road — Asphalt & Paving",
        "queries": [
            "site:methvin.co asphalt paving production rates. Paver output by width. Base course wearing course. Tonnes per hour. m2 per hour by layer thickness. Tack coat spray rate. ALL data as JSON.",
        ],
    },
    "road_kerbing": {
        "label": "Road — Kerbing & Drainage",
        "queries": [
            "site:methvin.co kerbing production rates. Concrete kerbs, granite kerbs, dropped kerbs. Metres per hour. Drainage channels, gulley installation, pipe laying rates by diameter. ALL data as JSON.",
        ],
    },
    "road_subbase": {
        "label": "Road — Sub-base & Earthworks",
        "queries": [
            "site:methvin.co sub-base preparation production rates. Type 1 granular, cement bound, lean mix concrete. Spreading compaction rates. m2 or m3 per hour. Geotextile laying. ALL data as JSON.",
        ],
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # TUNNELING & MINING (1 category)
    # ═══════════════════════════════════════════════════════════════════════════
    "tunneling": {
        "label": "Tunneling & Mining",
        "queries": [
            "site:methvin.co tunneling mining production rates. TBM output, drill and blast, NATM, sprayed concrete lining. Metres per day. Rock bolt installation. Shotcrete application rates. ALL data as JSON.",
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
