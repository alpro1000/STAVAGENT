"""
MCP Tool: get_construction_advisor

Expert recommendations for RC element construction.
Returns: recommended procedure, formwork selection with reasoning,
number of tacts with lateral pressure calculation, crew plan,
relevant ČSN EN norms, risks and warnings.

Uses knowledge base (methvin.co labor norms, TP ČBS,
DIN 18218 lateral pressure, DOKA/PERI formwork catalog).
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def get_construction_advisor(
    description: str,
    element_type: Optional[str] = None,
    volume_m3: Optional[float] = None,
    height_m: Optional[float] = None,
    concrete_class: Optional[str] = None,
    question: Optional[str] = None,
) -> dict:
    """Expert recommendations for constructing an RC element.

    Returns: recommended procedure, formwork selection with reasoning,
    number of tacts with lateral pressure calculation (DIN 18218),
    crew plan (typical 12-person team), relevant ČSN EN norms,
    risks and warnings.

    If volume_m3 is provided, also runs the calculator tool internally
    and includes schedule, formwork, and rebar estimates in the response.

    Knowledge base: methvin.co labor norms, TP ČBS 01/02,
    DIN 18218 lateral pressure, DOKA/PERI formwork catalog.

    Args:
        description: Free-text description of the element to advise on.
            Include dimensions, concrete class, special requirements.
            Examples:
            - 'výtahová šachta 1.6×2.41m, h=9.1m, bílá vana C30/37'
            - 'pilíř mostu P3, h=7.8m, C35/45 XF4, 20 m³'
            - 'mostovka dvoutrám 6×20m, C35/45, předpjatý'
            - 'základová deska 40×20m, tl. 0.4m, C25/30 XC2'

        element_type: Structural type code (from classify_construction_element).
            If omitted, auto-detected from description text.
            Examples: driky_piliru, sachta, mostovkova_deska, izolacni_stena.

        volume_m3: Concrete volume in m³. When provided, triggers full
            calculator run and includes schedule/formwork/rebar in response.

        height_m: Element height in meters. Critical for:
            - Tact calculation (>3m → multiple pours)
            - Lateral pressure (DIN 18218)
            - Formwork system selection
            - Stability warnings (>6m)

        concrete_class: Concrete class, e.g. 'C30/37', 'C35/45'.
            Affects norm selection — C40+ triggers TP ČBS 01 (high-performance).

        question: Specific question to focus the advisory response.
            Examples:
            - 'Kolik záběrů pro výšku 9m?'
            - 'Jaké bednění pro šachtu?'
            - 'Jaká je minimální doba ošetřování?'
            - 'Potřebuji podpěrnou konstrukci?'
    """
    try:
        # Classify element if not provided
        if not element_type:
            from app.mcp.tools.classifier import _classify
            classification = _classify(description)
            element_type = classification["element_type"]

        # Run calculator if volume provided
        calc_result = None
        if volume_m3:
            from app.mcp.tools.calculator import calculate_concrete_works
            calc_result = await calculate_concrete_works(
                element_type=element_type,
                volume_m3=volume_m3,
                concrete_class=concrete_class or "C30/37",
                height_m=height_m,
            )

        # Build advisory response
        from app.mcp.tools.classifier import ELEMENT_TYPES
        profile = ELEMENT_TYPES.get(element_type, ELEMENT_TYPES["jine"])

        advice = {
            "element_type": element_type,
            "label_cs": profile["label_cs"],
            "description": description,
        }

        # Formwork recommendation
        formwork_advice = _formwork_advice(element_type, height_m, profile)
        advice["formwork_recommendation"] = formwork_advice

        # Tacts / záběry
        if height_m and height_m > 3.0 and profile["orientation"] == "vertical":
            import math
            num_tacts = math.ceil(height_m / 3.0)
            pressure = 2500 * 9.81 * min(height_m, 3.0) / 1000
            advice["tacts"] = {
                "recommended": num_tacts,
                "max_pour_height_m": 3.0,
                "lateral_pressure_kn_m2": round(pressure, 1),
                "reasoning": f"Výška {height_m}m → {num_tacts} záběry po max 3.0m. "
                             f"Boční tlak {pressure:.1f} kN/m² (DIN 18218).",
            }

        # Crew plan
        advice["crew_plan"] = {
            "tesaři": 4,
            "železáři": 3,
            "betonáři": 5,
            "celkem": 12,
            "note": "Typická sestava pro prvek tohoto typu",
        }

        # Relevant norms
        advice["relevant_norms"] = _relevant_norms(element_type, concrete_class)

        # Risks and warnings
        advice["warnings"] = _warnings(element_type, height_m, concrete_class, description)

        # Include calculator results if available
        if calc_result and "error" not in calc_result:
            advice["calculation"] = {
                "schedule": calc_result.get("schedule"),
                "formwork": calc_result.get("formwork"),
                "rebar": calc_result.get("rebar"),
            }

        return advice

    except Exception as e:
        logger.error(f"[MCP/Advisor] Error: {e}")
        return {"error": str(e)}


def _formwork_advice(element_type: str, height_m: Optional[float], profile: dict) -> dict:
    """Generate formwork recommendation with reasoning."""
    recommended = profile["formwork"]
    if not recommended:
        return {"system": "N/A", "reasoning": "Tento typ prvku nevyžaduje systémové bednění."}

    primary = recommended[0]
    reasoning = f"Pro {profile['label_cs']} "

    if element_type in ("driky_piliru", "opery_ulozne_prahy", "pricinik"):
        if height_m and height_m > 6.75:
            primary = "VARIO GT 24"
            reasoning += f"(h={height_m}m > 6.75m) → VARIO GT 24 (max 12m, 150 kN/m²)."
        elif height_m and height_m > 3.0:
            primary = "Framax Xlife"
            reasoning += f"(h={height_m}m > 3.0m) → Framax Xlife (max 6.75m, 100 kN/m²)."
        else:
            primary = "Frami Xlife"
            reasoning += f"(h={height_m or '≤3'}m) → Frami Xlife (max 3.0m, 80 kN/m²)."

    elif element_type in ("stena", "izolacni_stena", "sachta"):
        if height_m and height_m > 3.0:
            primary = "Framax Xlife"
            reasoning += f"(h={height_m}m) → Framax Xlife. Oboustranné bednění."
        else:
            primary = "Frami Xlife"
            reasoning += "→ Frami Xlife. Ekonomické řešení pro nižší stěny."

    elif element_type == "mostovkova_deska":
        reasoning += "→ Pevná skruž nebo posuvná skruž dle rozpětí pole."
    else:
        reasoning += f"→ {primary} (doporučení dle typu prvku)."

    return {"system": primary, "alternatives": recommended[1:3], "reasoning": reasoning}


def _relevant_norms(element_type: str, concrete_class: Optional[str]) -> list[dict]:
    """List relevant Czech/European norms."""
    norms = [
        {"code": "ČSN EN 206", "name": "Beton — Specifikace, vlastnosti, výroba a shoda"},
        {"code": "ČSN EN 13670", "name": "Provádění betonových konstrukcí"},
    ]

    if element_type in ("mostovkova_deska", "driky_piliru", "rimsa", "opery_ulozne_prahy"):
        norms.append({"code": "TP ČBS 02", "name": "Bílá vana — vodonepropustné betonové konstrukce"})
        norms.append({"code": "TKP kap. 18", "name": "Betonové konstrukce a mosty"})

    if concrete_class and "40" in str(concrete_class) or "45" in str(concrete_class):
        norms.append({"code": "TP ČBS 01", "name": "Vysokohodnotný beton"})

    norms.append({"code": "DIN 18218", "name": "Frischbetondruck — boční tlak čerstvého betonu"})

    return norms


def _warnings(
    element_type: str,
    height_m: Optional[float],
    concrete_class: Optional[str],
    description: str,
) -> list[str]:
    """Generate warnings and risks."""
    warnings = []

    if height_m and height_m > 6:
        warnings.append(
            f"Výška {height_m}m → nutná kontrola stability bednění, "
            "podpěrné konstrukce a přístupu pro betonáž."
        )

    if "bílá vana" in description.lower() or "vodonep" in description.lower():
        warnings.append(
            "Bílá vana: požadavky TP ČBS 02 — těsnící pásy v pracovních "
            "spárách, max. šířka trhlin 0.2mm, průběžná kontrola kvality."
        )

    if "předp" in description.lower() or "prestress" in description.lower():
        warnings.append(
            "Předpjatý beton: koordinace se subdodavatelem předpínání, "
            "přesné vedení kanálků, kontrola napínacích sil."
        )

    if element_type == "sachta":
        warnings.append(
            "Šachta: omezený přístup, betonáž shora, bednění jednostranné "
            "nebo s jádrovým bedněním. Záběry max 3m."
        )

    if element_type == "mostovkova_deska":
        warnings.append(
            "Mostovka: zpracovat TePř (technologický předpis betonáže), "
            "zkušební záběr, monitoring teploty + trhlin."
        )

    return warnings
