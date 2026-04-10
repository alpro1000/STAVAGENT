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


async def create_work_breakdown(
    elements: list[dict],
    project_type: str = "most",
    catalog: str = "otskp",
) -> dict:
    """From a list of structural elements, create a complete bill of quantities
    (výkaz výměr) with OTSKP/ÚRS codes.

    Pipeline: element classification (22 types) → work decomposition (formwork,
    rebar, concrete, insulation...) → OTSKP/ÚRS code matching from the database.
    AI models CANNOT reliably assign Czech catalog codes — this tool uses the
    database of 17,904 OTSKP items + ÚRS matcher.

    Args:
        elements: List of structural elements from TZ documentation.
                  Each element: {name, concrete_class?, volume_m3?, area_m2?,
                  height_m?, exposure?, is_prestressed?, rebar_tons?}
        project_type: Project type: most, budova, inzenyrsky_objekt, komunikace
        catalog: Preferred catalog: 'otskp' (transport), 'urs' (building), 'both'
    """
    try:
        from app.mcp.tools.classifier import _classify, ELEMENT_TYPES
        from app.mcp.tools.otskp import _get_catalog

        all_items = []
        otskp_catalog = _get_catalog()

        for elem in elements:
            name = elem.get("name", "")
            if not name:
                continue

            # Step 1: Classify element
            classification = _classify(name)
            etype = classification["element_type"]
            profile = ELEMENT_TYPES.get(etype, ELEMENT_TYPES["jine"])

            # Step 2: Get quantities
            volume = elem.get("volume_m3", 0)
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

                # Step 4: Find OTSKP code
                otskp_match = None
                if catalog in ("otskp", "both"):
                    search_results = otskp_catalog.search(work_name, limit=1)
                    if search_results:
                        r = search_results[0]
                        otskp_match = {
                            "code": r.code,
                            "description": r.nazev,
                            "unit_price_czk": r.cena,
                        }

                item = {
                    "work_description": work_name,
                    "unit": tmpl["unit"],
                    "quantity": round(qty, 2),
                    "hsv_section": tmpl.get("hsv", ""),
                    "element_name": name,
                    "element_type": etype,
                }
                if otskp_match:
                    item["otskp_code"] = otskp_match["code"]
                    item["otskp_description"] = otskp_match["description"]
                    item["unit_price_czk"] = otskp_match["unit_price_czk"]
                    item["total_price_czk"] = round(otskp_match["unit_price_czk"] * qty, 0)

                all_items.append(item)

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
        }

    except Exception as e:
        logger.error(f"[MCP/Breakdown] Error: {e}")
        return {"error": str(e), "items": [], "total_items": 0}
