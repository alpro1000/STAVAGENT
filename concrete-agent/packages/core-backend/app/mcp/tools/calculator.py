"""
MCP Tool: calculate_concrete_works

Calculates concrete works for a single RC structural element.
The full 7-engine pipeline is in TypeScript (Monolit-Planner/shared),
so this MCP tool calls the Monolit-Planner backend API if available,
or provides a simplified estimation based on known formulas.
"""

import logging
import math
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Constants from the shared calculator ─────────────────────────────────────

# DIN 18218 lateral pressure: p = ρ × g × h × k
CONCRETE_DENSITY = 2500  # kg/m³
GRAVITY = 9.81  # m/s²

# Formwork capacity limits
FRAMI_MAX_PRESSURE = 80  # kN/m²
FRAMI_MAX_HEIGHT = 3.0  # m
FRAMAX_MAX_PRESSURE = 100  # kN/m²
FRAMAX_MAX_HEIGHT = 6.75  # m
VARIO_MAX_PRESSURE = 150  # kN/m²
VARIO_MAX_HEIGHT = 12.0  # m

# Labor norms (h/m²) from methvin.co KB
FORMWORK_NORM_H_M2 = 0.5  # average assembly
REBAR_NORM_H_T = 45  # average tying/placing
CONCRETE_NORM_H_M3 = 0.3  # placing + vibrating
CURING_DAYS_MIN = 3
CURING_DAYS_TYPICAL = 7

# Typical pour rates
MAX_POUR_HEIGHT_PER_TACT = 3.0  # m (default záběr height for vertical elements)

# Crew sizes
DEFAULT_CREW = {"formwork": 4, "rebar": 3, "concrete": 5}
SHIFT_HOURS = 8


def _lateral_pressure(height_m: float, pour_rate_factor: float = 1.0) -> float:
    """Calculate lateral pressure in kN/m² using DIN 18218 simplified."""
    return CONCRETE_DENSITY * GRAVITY * height_m * pour_rate_factor / 1000


def _select_formwork(height_m: float, pressure_kn: float) -> dict:
    """Select formwork system based on pressure and height."""
    if pressure_kn <= FRAMI_MAX_PRESSURE and height_m <= FRAMI_MAX_HEIGHT:
        return {"system": "Frami Xlife", "max_pressure_kn_m2": 80, "manufacturer": "DOKA"}
    elif pressure_kn <= FRAMAX_MAX_PRESSURE and height_m <= FRAMAX_MAX_HEIGHT:
        return {"system": "Framax Xlife", "max_pressure_kn_m2": 100, "manufacturer": "DOKA"}
    elif pressure_kn <= VARIO_MAX_PRESSURE:
        return {"system": "VARIO GT 24", "max_pressure_kn_m2": 150, "manufacturer": "DOKA"}
    else:
        return {"system": "Speciální bednění", "max_pressure_kn_m2": 200, "manufacturer": "Custom"}


def _calculate_tacts(height_m: float, volume_m3: float, element_type: str) -> int:
    """Calculate number of pour tacts (záběry)."""
    if element_type in ("pilota", "zakladova_deska", "deska", "prechodova_deska"):
        return 1  # Single pour for horizontal/pile elements

    if height_m and height_m > 0:
        return max(1, math.ceil(height_m / MAX_POUR_HEIGHT_PER_TACT))

    # Fallback: estimate from volume
    if volume_m3 > 50:
        return max(2, math.ceil(volume_m3 / 30))
    return 1


def _estimate_days(
    volume_m3: float,
    formwork_area_m2: float,
    rebar_tons: float,
    num_tacts: int,
) -> dict:
    """Estimate schedule in working days."""
    fw_days = max(1, math.ceil(formwork_area_m2 * FORMWORK_NORM_H_M2 / (DEFAULT_CREW["formwork"] * SHIFT_HOURS)))
    rb_days = max(1, math.ceil(rebar_tons * REBAR_NORM_H_T / (DEFAULT_CREW["rebar"] * SHIFT_HOURS)))
    conc_days = max(1, math.ceil(volume_m3 * CONCRETE_NORM_H_M3 / (DEFAULT_CREW["concrete"] * SHIFT_HOURS)))
    cure_days = CURING_DAYS_TYPICAL

    # Per tact: formwork + rebar + concrete + curing
    per_tact = fw_days + rb_days + conc_days + cure_days
    total = per_tact * num_tacts

    return {
        "formwork_days": fw_days * num_tacts,
        "rebar_days": rb_days * num_tacts,
        "concrete_days": conc_days * num_tacts,
        "curing_days": cure_days * num_tacts,
        "per_tact_days": per_tact,
        "total_days": total,
        "num_tacts": num_tacts,
    }


async def calculate_concrete_works(
    element_type: str,
    volume_m3: float,
    concrete_class: str,
    height_m: Optional[float] = None,
    exposure_class: Optional[str] = None,
    width_m: Optional[float] = None,
    formwork_area_m2: Optional[float] = None,
    is_prestressed: bool = False,
    nk_subtype: Optional[str] = None,
    span_m: Optional[float] = None,
    num_spans: Optional[int] = None,
    temperature_c: float = 15.0,
) -> dict:
    """Calculate concrete works for a single RC structural element.

    7 calculation engines: formwork (system selection DOKA/PERI + unit price),
    rebar (reinforcement index), concrete (pour method, crew), maturity
    (Saul model), schedule (tacts, days), PERT Monte Carlo (risks), pump.

    Returns: recommended formwork, number of tacts, schedule, crew plan,
    indicative price. Covers 22 element types including bridge structures.

    Args:
        element_type: Element type (from classify_element or manual):
                      pilota, stena, sloup, mostovkova_deska, rimsa, etc.
        volume_m3: Concrete volume in m³
        concrete_class: Concrete class, e.g. 'C30/37'
        height_m: Element height in meters (for tacts and formwork selection)
        exposure_class: Exposure class, e.g. 'XF2', 'XA2'
        width_m: Element width/thickness in meters
        formwork_area_m2: Formwork area in m² (optional, calculator estimates)
        is_prestressed: Prestressed concrete (default false)
        nk_subtype: For bridge deck: deskovy, jednotramovy, dvoutramovy,
                    komorovy, sprazeny
        span_m: For bridge deck: span length in meters
        num_spans: For bridge deck: number of spans
        temperature_c: Ambient temperature in °C (for maturity, default 15)
    """
    try:
        # ── Try Monolit-Planner API first ────────────────────────────────
        api_result = await _try_monolit_api(
            element_type, volume_m3, concrete_class, height_m,
            width_m, formwork_area_m2, is_prestressed,
        )
        if api_result:
            return api_result

        # ── Fallback: simplified calculation ─────────────────────────────
        from app.mcp.tools.classifier import ELEMENT_TYPES

        profile = ELEMENT_TYPES.get(element_type, ELEMENT_TYPES["jine"])
        h = height_m or 3.0  # default height

        # Rebar estimate
        rebar_kg_m3 = profile["rebar_kg_m3"]
        rebar_tons = volume_m3 * rebar_kg_m3 / 1000

        # Formwork area estimate (if not provided)
        if not formwork_area_m2:
            if profile["orientation"] == "horizontal":
                formwork_area_m2 = volume_m3 / max(0.15, (width_m or 0.25))
            else:
                formwork_area_m2 = volume_m3 / max(0.2, (width_m or 0.3)) * 2  # two sides

        # Lateral pressure (vertical elements only) — uses per-tact height, not total
        pressure_kn = 0
        formwork_system = {}
        pour_height = min(h, MAX_POUR_HEIGHT_PER_TACT)  # pressure per záběr
        if profile["orientation"] == "vertical" and h > 0:
            pressure_kn = _lateral_pressure(pour_height)
            formwork_system = _select_formwork(h, pressure_kn)
        else:
            formwork_system = {
                "system": profile["formwork"][0] if profile["formwork"] else "N/A",
                "manufacturer": "DOKA",
            }

        # Number of tacts
        num_tacts = _calculate_tacts(h, volume_m3, element_type)

        # Schedule
        schedule = _estimate_days(volume_m3, formwork_area_m2, rebar_tons, num_tacts)

        # Maturity (simplified Saul model)
        # Maturity M = Σ (T + 10) × Δt, target M ≈ 720 °C·h for 70% f_ck
        maturity_hours = 720 / max(1, temperature_c + 10)
        maturity_days = math.ceil(maturity_hours / 24)

        # Bridge deck specifics
        bridge_tech = None
        if element_type == "mostovkova_deska" and span_m:
            if span_m < 25:
                bridge_tech = "Pevná skruž (fixed falsework)"
            elif span_m < 50:
                bridge_tech = "Posuvná skruž (MSS)"
            else:
                bridge_tech = "Letmá betonáž (CFT / balanced cantilever)"

        return {
            "element_type": element_type,
            "label_cs": profile["label_cs"],
            "input": {
                "volume_m3": volume_m3,
                "concrete_class": concrete_class,
                "height_m": h,
                "width_m": width_m,
                "is_prestressed": is_prestressed,
            },
            "formwork": {
                **formwork_system,
                "area_m2": round(formwork_area_m2, 1),
                "lateral_pressure_kn_m2": round(pressure_kn, 1),
            },
            "rebar": {
                "ratio_kg_m3": rebar_kg_m3,
                "estimated_tons": round(rebar_tons, 2),
                "range_kg_m3": profile["rebar_range"],
            },
            "schedule": schedule,
            "maturity": {
                "target_strength_pct": 70,
                "estimated_days": maturity_days,
                "temperature_c": temperature_c,
            },
            "crew": DEFAULT_CREW,
            "difficulty_factor": profile["difficulty"],
            "bridge_technology": bridge_tech,
            "num_tacts": num_tacts,
            "note": "Simplified estimate. For detailed calculation use Monolit Planner at kalkulator.stavagent.cz",
            "source": "mcp_simplified",
        }

    except Exception as e:
        logger.error(f"[MCP/Calculator] Error: {e}")
        return {"error": str(e)}


async def _try_monolit_api(
    element_type, volume_m3, concrete_class, height_m,
    width_m, formwork_area_m2, is_prestressed,
) -> Optional[dict]:
    """Try calling the full Monolit-Planner calculator API."""
    try:
        import httpx

        api_url = os.getenv(
            "MONOLIT_API_URL",
            "https://monolit-planner-api-1086027517695.europe-west3.run.app",
        )

        payload = {
            "element_type": element_type,
            "concrete_m3": volume_m3,
            "concrete_class": concrete_class,
            "height_m": height_m or 3.0,
            "width_m": width_m or 0.3,
            "is_prestressed": is_prestressed,
        }
        if formwork_area_m2:
            payload["formwork_area_m2"] = formwork_area_m2

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{api_url}/api/calculate", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                data["source"] = "monolit_planner_api"
                return data

        return None
    except Exception as e:
        logger.debug(f"[MCP/Calculator] Monolit API unavailable: {e}")
        return None
