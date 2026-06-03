"""
MCP Tool: create_work_breakdown

From a list of structural elements, creates a complete bill of quantities
(výkaz výměr / soupis prací) with OTSKP/ÚRS codes.

Pipeline: element classification → work decomposition (formwork, rebar,
concrete, insulation...) → OTSKP/ÚRS code matching from the database.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Work decomposition templates per element type
# Each element generates these work items
WORK_TEMPLATES = {
    "default": [
        {"work": "Bednění {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV3"},
        {"work": "Odbednění {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV3"},
        {"work": "Výztuž {element} z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4"},
        {"work": "Beton {element} {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV2"},
        {"work": "Ošetřování betonu {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV2"},
    ],
    "pilota": [
        {"work": "Zřízení pilot svislých {concrete_class}", "unit": "m", "qty_factor": "length", "hsv": "HSV2"},
        {"work": "Výztuž pilot z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4"},
    ],
    "mostovkova_deska": [
        {"work": "Skruž pevná/posuvná pro NK", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4"},
        {"work": "Bednění NK — spodní deska", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4"},
        {"work": "Výztuž NK z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4"},
        {"work": "Beton NK {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4"},
        {"work": "Předpínací výztuž Y1860 S7", "unit": "t", "qty_factor": "prestress_tons", "hsv": "HSV4"},
        {"work": "Ošetřování betonu NK", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4"},
    ],
    "rimsa": [
        {"work": "Římsový vozík — montáž", "unit": "kpl", "qty_factor": "1", "hsv": "HSV4"},
        {"work": "Bednění říms", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4"},
        {"work": "Výztuž říms z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4"},
        {"work": "Beton říms {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4"},
    ],
}


# Work-first contract (W2/PR2 — Pattern 15). `mode` is a first-class parameter.
#   work_first        — produce a frozen, code-less, price-less work list. Catalog
#                       binding is a SEPARATE stage (CATALOG_BINDING) behind the
#                       STOP gate. This is the default (Pattern 15).
#   work_with_catalog — legacy single-pass: attach OTSKP codes + prices inline.
# `catalog="none"` is an accepted alias that forces work_first regardless of mode.
MODE_WORK_FIRST = "work_first"
MODE_WORK_WITH_CATALOG = "work_with_catalog"


def _attach_catalog_codes(items: list[dict], otskp_catalog, catalog: str) -> list[dict]:
    """Catalog-binding step, DECOUPLED from work decomposition.

    Mutates each item in place, attaching OTSKP code + unit/total price when a
    match is found. This runs only in mode=work_with_catalog — in work_first the
    breakdown ends on the frozen work list and this is never called (the catalog
    stage is reached separately, after the WORK_ATOMIZATION → CATALOG_BINDING
    transition, via find_otskp_code / find_urs_code under CATALOG_BINDING policy).
    """
    if catalog not in ("otskp", "both"):
        return items
    for item in items:
        search_results = otskp_catalog.search(item["work_description"], limit=1)
        if search_results:
            r = search_results[0]
            item["otskp_code"] = r.code
            item["otskp_description"] = r.nazev
            item["unit_price_czk"] = r.cena
            item["total_price_czk"] = round(r.cena * item["quantity"], 0)
    return items


async def create_work_breakdown(
    elements: list[dict],
    project_type: str = "most",
    catalog: str = "otskp",
    mode: str = MODE_WORK_FIRST,
    project_id: Optional[str] = None,
    object_types: Optional[dict] = None,
) -> dict:
    """From a list of structural elements, create a complete bill of quantities
    (výkaz výměr / soupis prací) with OTSKP/ÚRS codes and prices.

    Pipeline: element classification (22 types) → work decomposition (formwork
    assembly+disassembly, rebar, concrete, curing, prestress...) → OTSKP/ÚRS
    code matching from the real database of 17,904 OTSKP + 39,000 ÚRS items.

    AI models CANNOT reliably assign Czech catalog codes — this tool uses
    deterministic database lookup with verified prices.

    Returns: list of work items grouped by HSV section (HSV2 concrete,
    HSV3 formwork, HSV4 reinforcement), each with OTSKP code, unit price,
    and total price. Also returns total_price_czk for the whole breakdown.

    Cost: 20 credits (most expensive tool — generates full bill of quantities).

    Args:
        elements: List of structural elements from TZ documentation.
            Each element is a dict with fields:
            - name (required): Element name in Czech, e.g. 'Pilíř P2, C35/45'
            - concrete_class: e.g. 'C30/37' (default: C30/37)
            - volume_m3: Concrete volume in m³
            - area_m2: Formwork area in m² (estimated if missing)
            - height_m: Element height in m (default: 3.0)
            - exposure: Exposure class, e.g. 'XF4'
            - is_prestressed: boolean (triggers prestress steel item)
            - rebar_tons: Rebar mass in tons (estimated from volume if missing)

            Example for SO-202 bridge:
            [
              {"name": "Piloty OP1 Ø900", "volume_m3": 50.9, "concrete_class": "C30/37"},
              {"name": "Základ opěry OP1", "volume_m3": 35, "concrete_class": "C25/30", "height_m": 1.2},
              {"name": "Dřík opěry OP1", "volume_m3": 55, "concrete_class": "C30/37", "height_m": 5.0},
              {"name": "NK mostovka", "volume_m3": 605, "concrete_class": "C35/45", "is_prestressed": true}
            ]

        project_type: Project type — determines catalog preference and
            work item templates.
            - 'most': bridge structure (default) — uses OTSKP catalog,
              adds scaffolding + prestress items for NK
            - 'budova': building — uses ÚRS catalog
            - 'inzenyrsky_objekt': engineering structure (tunnels, walls)
            - 'komunikace': road/communication infrastructure

        catalog: Preferred pricing catalog for code matching.
            - 'otskp': OTSKP D6 catalog (17,904 items, transport structures)
            - 'urs': ÚRS catalog (39,000+ items, building construction)
            - 'both': search both catalogs (slower, more complete)
            - 'none': work-first alias — forces a code-less list (no matching)

        mode: Work-first contract (Pattern 15 — Work-First, Catalog-Last).
            - 'work_first' (DEFAULT): produce a frozen, code-less, price-less
              work list. Catalog binding is a SEPARATE stage (CATALOG_BINDING)
              behind the STOP gate — do NOT attach codes/prices here.
            - 'work_with_catalog': legacy single-pass — attach OTSKP codes +
              prices inline (only when `catalog` is a real catalog).
            Response echoes `mode` + `catalog_bound` so callers can tell whether
            the list is frozen-work-only or already catalog-bound.
    """
    try:
        from app.mcp.tools.classifier import _classify, ELEMENT_TYPES
        from app.mcp.tools.otskp import _get_catalog

        all_items = []
        otskp_catalog = _get_catalog()

        # W3b: resolve the authoritative object type per element. Priority:
        # explicit `object_types` map (already-resolved, e.g. from project state)
        # → cache read by SO code (project_id) → None (W3 name+code fallback, #76).
        # Detection itself happens ONCE at document-analysis time, NOT here — this
        # path only reads the cache (criterion #75).
        from app.mcp.tools.object_type_detector import get_cached_object_type

        explicit_types = object_types or {}

        for elem in elements:
            name = elem.get("name", "")
            if not name:
                continue

            so_code = elem.get("object_code")
            object_type = explicit_types.get(so_code) if so_code else None
            if object_type is None:
                object_type = get_cached_object_type(project_id, so_code)

            # Step 1: Classify element (object_type is authoritative when present)
            classification = _classify(name, object_code=so_code, object_type=object_type)
            etype = classification["element_type"]
            profile = ELEMENT_TYPES.get(etype, ELEMENT_TYPES["jine"])

            # Step 2: Get quantities. Stage-1 extract ships volume_m3=None
            # (volumes are stage 2) — coalesce to 0 so the qty<=0 skip applies
            # cleanly instead of crashing on a None comparison.
            volume = elem.get("volume_m3", 0) or 0
            height = elem.get("height_m", 3.0)
            concrete_class = elem.get("concrete_class", "C30/37")
            rebar_tons = elem.get("rebar_tons", volume * profile["rebar_kg_m3"] / 1000 if volume else 0)

            # Estimate formwork area
            fw_area = elem.get("area_m2", 0)
            if not fw_area and volume:
                width = 0.3
                if profile["orientation"] == "horizontal":
                    fw_area = volume / 0.25  # rough: volume / thickness
                else:
                    fw_area = volume / width * 2

            # Step 3: Decompose into work items
            templates = WORK_TEMPLATES.get(etype, WORK_TEMPLATES["default"])

            for tmpl in templates:
                work_name = tmpl["work"].format(
                    element=profile["label_cs"],
                    concrete_class=concrete_class,
                )

                # Calculate quantity
                qty = 0
                factor = tmpl["qty_factor"]
                if factor == "volume":
                    qty = volume
                elif factor == "formwork_area":
                    qty = fw_area
                elif factor == "rebar_tons":
                    qty = rebar_tons
                elif factor == "length":
                    qty = height
                elif factor == "prestress_tons":
                    qty = rebar_tons * 0.3 if elem.get("is_prestressed") else 0
                elif factor == "1":
                    qty = 1

                if qty <= 0:
                    continue

                # Build the work item (code-less). Each item carries `_source`
                # tracing it to the originating input element + work template —
                # the grounding-gate (Pattern 29) marks items without `_source`
                # as UNVERIFIED. Catalog binding is NOT done here (Pattern 15).
                item = {
                    "work_description": work_name,
                    "unit": tmpl["unit"],
                    "quantity": round(qty, 2),
                    "hsv_section": tmpl.get("hsv", ""),
                    "element_name": name,
                    "element_type": etype,
                    "_source": f"element:{name} / template:{tmpl['work']}",
                }
                all_items.append(item)

        # Work-first decoupling (Pattern 15): the breakdown ends on the frozen
        # work list. Catalog codes/prices are attached ONLY in the explicit
        # work_with_catalog mode (and only for real catalogs). catalog="none"
        # forces work-first regardless of `mode`.
        work_first = mode != MODE_WORK_WITH_CATALOG or catalog == "none"
        if not work_first:
            _attach_catalog_codes(all_items, otskp_catalog, catalog)

        # Group by HSV section
        sections = {}
        for item in all_items:
            sec = item.get("hsv_section", "Other")
            if sec not in sections:
                sections[sec] = []
            sections[sec].append(item)

        total_price = sum(it.get("total_price_czk", 0) for it in all_items)

        return {
            "items": all_items,
            "total_items": len(all_items),
            "sections": {k: len(v) for k, v in sections.items()},
            "total_price_czk": round(total_price, 0),
            "elements_processed": len(elements),
            "catalog": catalog,
            "project_type": project_type,
            "mode": MODE_WORK_FIRST if work_first else MODE_WORK_WITH_CATALOG,
            "catalog_bound": not work_first,
        }

    except Exception:
        # Fail loud (#1262). The old handler swallowed every exception into an
        # error-dict that DROPPED `mode`/`catalog_bound` — so a TypeError (e.g. a
        # stubbed callable with the wrong signature) silently became a downstream
        # KeyError on `result["mode"]`, masking the real cause. create_work_breakdown
        # is pure/deterministic: an exception here is a bug, not a recoverable
        # runtime condition. Log the full traceback and re-raise so the real error
        # surfaces in CI / the caller instead of quietly breaking the response
        # contract.
        logger.exception("[MCP/Breakdown] create_work_breakdown failed")
        raise
