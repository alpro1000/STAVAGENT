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

# ── Curing class table (TKP kap. 18, §7.8.3) ───────────────────────────────
# Key: (curing_class, temperature_band) → days
# temperature_band: ">=25", "15-25", "10-15", "5-10"
CURING_DAYS_TABLE = {
    (2, ">=25"): 1.5, (2, "15-25"): 2.5, (2, "10-15"): 4, (2, "5-10"): 5,
    (3, ">=25"): 2.5, (3, "15-25"): 4,   (3, "10-15"): 7, (3, "5-10"): 9,
    (4, ">=25"): 5,   (4, "15-25"): 9,   (4, "10-15"): 13, (4, "5-10"): 18,
}

# XF3/XF4 exposure minimum curing days (TKP §7.8.3 note)
EXPOSURE_MIN_CURING = {"XF3": 7, "XF4": 7, "XD3": 7}


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
    curing_class: Optional[int] = None,
    construction_technology: Optional[str] = None,
    num_bridges: int = 1,
    pile_diameter_mm: Optional[int] = None,
    pile_count: Optional[int] = None,
    pile_geology: Optional[str] = None,
) -> dict:
    """Calculate concrete works for a single RC structural element.

    7 calculation engines: formwork (system selection DOKA/PERI + unit price),
    rebar (reinforcement index), concrete (pour method, crew), maturity
    (Saul model + curing class table from TKP kap. 18), schedule (tacts,
    days), PERT Monte Carlo (risks), pump.

    Returns: recommended formwork, number of tacts, schedule, crew plan,
    indicative price. Covers 22 element types including bridge structures.

    For most accurate results, provide element_type + volume_m3 +
    concrete_class + exposure_class + curing_class. Missing optional params
    are estimated from element_type defaults.

    Args:
        element_type: Structural element type. Use classify_construction_element
            tool first, or set manually. Valid values:

            Bridge elements (mostní objekty, SO-xxx):
            - mostovkova_deska: bridge deck / superstructure (C35/45 XF2, curing_class=4)
            - driky_piliru: bridge pier shafts (C35/45, XF4 in splash zone / XF2 outside)
            - opery_ulozne_prahy: abutment stems + bearing shelves (C30/37 XF4)
            - kridla_opery: abutment wing walls (C30/37 XF4)
            - zaklady_piliru: pile caps / pier foundations (C25/30 XF1 or XF3)
            - rimsa: bridge parapets / edge beams (C30/37 XF4, curing_class=4)
            - pricinik: cross-beams / diaphragms (C35/45 XF2)
            - prechodova_deska: transition slabs (C25/30 XF2)
            - pilota: bored piles (C30/37 XA2 under groundwater)

            Building elements (pozemní stavby):
            - stena: monolithic walls (C25/30-C30/37)
            - deska: floor slabs (C25/30-C30/37)
            - sloup: columns (C30/37-C40/50)
            - pruvlak: beams / girders
            - zaklady: strip/pad foundations (C20/25-C25/30)
            - zakladova_deska: foundation slabs
            - schodiste: staircases
            - izolacni_stena: waterproof walls / white tank (C30/37 XA1/XA2)
            - sachta: shafts (elevator, technical)
            - nadrz: tanks / reservoirs / retention
            - tunel_rampa: tunnels / ramps
            - operna_zed: retaining walls
            - jine: other / unspecified

        volume_m3: Total concrete volume in m³ for ONE structure.
            For bridges with num_bridges=2 (LM+PM), enter volume for 1 bridge —
            total is computed as volume_m3 × num_bridges.
            Example: SO-202 bridge deck NK = 605 m³ per bridge.

        concrete_class: Concrete class per ČSN EN 206.
            Format 'C{cube}/{cylinder}'. Typical values:
            - C12/15, C16/20: lean concrete, blinding
            - C20/25, C25/30: building foundations, transition slabs
            - C25/30 XF1/XF3: bridge foundations
            - C30/37 XA2: piles under groundwater (medium aggressivity)
            - C30/37 XF4: abutments, wing walls, parapets (splash zone)
            - C35/45 XF2: bridge deck NK, pier shafts outside splash
            - C35/45 XF4: pier shafts in splash zone
            - C40/50: high-performance columns, prestressed elements

        height_m: Element height in meters. Critical for:
            - Lateral pressure calculation (DIN 18218): p = ρ×g×h×k
            - Number of pour tacts (záběry): ceil(height / 3.0m)
            - Formwork system selection (Frami ≤3m, Framax ≤6.75m, VARIO ≤12m)
            For horizontal elements (deska, mostovka): use slab thickness.
            For piles: use pile length (depth).

        exposure_class: Exposure class per ČSN EN 206.
            Bridge elements:
            - XA1/XA2/XA3: piles under aggressive groundwater
            - XF1: dry covered foundation surfaces
            - XF3: foundations with freeze-thaw + water
            - XF4: elements in de-icing salt splash zone (abutments, wing
              walls, parapets, pier shafts near road level)
            - XF2: bridge deck NK, pier shafts above splash zone
            Building elements:
            - XC1/XC2: dry foundations
            - XC3/XC4: facades, exterior walls
            - XA1/XA2: white tank (waterproofing) per aggressivity
            WARNING: XF3/XF4 exposure enforces minimum 7-day curing per TKP §7.8.3.

        width_m: Element width or thickness in meters. Used for:
            - Formwork area estimation when formwork_area_m2 not provided
            - Horizontal: area ≈ volume / thickness
            - Vertical: area ≈ volume / width × 2 (both sides)

        formwork_area_m2: Formwork contact area in m². If omitted,
            estimated from volume_m3, width_m, and orientation.
            For foundations: 2×(L+W)×H (perimeter × height).
            For bridge deck: bottom form + side forms.

        is_prestressed: True for post-tensioned concrete (additional předpětí).
            When True, engine adds prestressing phase to schedule:
            - Wait for f_cm ≥ 33 MPa (typically ≥7 days)
            - Stressing: ~2 days
            - Grouting (injektáž): ~2 days
            Total addition: ~11 days (SO-202 real data).
            Also requires: nk_subtype, span_m, num_spans for bridge deck.

        nk_subtype: Bridge deck cross-section subtype. Values:
            - deskovy: solid slab deck (short spans <15m)
            - jednotramovy: single-beam T-section
            - dvoutramovy: twin-beam (2 webs, typical for 15-30m spans)
            - komorovy: box girder (long spans >30m, cantilever)
            - sprazeny: composite steel-concrete deck
            Example: SO-202 = 'dvoutramovy' (twin-beam, 6 spans 15+4×20+15m).

        span_m: Maximum span length in meters (for bridge deck).
            Drives construction technology recommendation:
            - span < 25m: fixed scaffolding (pevná skruž)
            - span 15-40m + num_spans ≥ 4: MSS (movable scaffolding system)
            - span > 40m: balanced cantilever (letmá betonáž / CFT)
            Example: SO-202 span_m=20 (max field), num_spans=6.

        num_spans: Number of bridge spans (počet polí).
            Together with span_m determines construction technology.
            ≥4 spans with span ≤40m → MSS is economically viable.
            Example: SO-202 num_spans=6.

        temperature_c: Ambient temperature in °C during curing (default 15).
            Affects maturity calculation (Saul model: M = Σ(T+10)×Δt)
            and curing duration from TKP table.
            Temperature bands: ≥25°C, 15-25°C, 10-15°C, 5-10°C.
            For winter concreting (<5°C): special measures required,
            not covered by this calculator.

        curing_class: Curing class per TKP kap. 18 §7.8.3. Values 2, 3, or 4.
            - 2: standard building elements (walls, slabs, columns)
            - 3: demanding elements — bridge substructure (foundations,
              abutments, pier shafts), elements with XF3/XF4 exposure
            - 4: bridge superstructure NK + bridge parapets (římsy).
              MANDATORY for bridge NK per TKP kap. 18.
            If omitted, auto-assigned: 4 for mostovkova_deska/rimsa,
            3 for bridge substructure, 2 for building elements.
            Curing durations at 15°C: class 2 = 2.5d, class 3 = 4d, class 4 = 9d.
            At 5°C: class 2 = 5d, class 3 = 9d, class 4 = 18d.

        construction_technology: Override for bridge deck construction method.
            - fixed_scaffolding: pevná skruž (under entire deck), standard ≤25m
            - mss: movable scaffolding system (posuvná skruž), for ≥4 spans
            - cantilever: balanced cantilever / CFT (letmá betonáž), spans >40m
            If omitted, recommended automatically from span_m + num_spans.
            Example: SO-202 TZ specifies 'fixed_scaffolding' (1 tact per span).

        num_bridges: Number of independent bridge structures in the object.
            - 1: single bridge (default)
            - 2: twin bridges (LM + PM — left + right carriageway)
            Volume and schedule are per single bridge. Total volume =
            volume_m3 × num_bridges. Schedule multiplier depends on
            construction sequence (sequential: ×2, parallel: ×1.1).
            Example: SO-202 num_bridges=2.

        pile_diameter_mm: Pile diameter in mm (for element_type='pilota').
            Affects drilling productivity and rebar index:
            - Ø600: ~3 piles/shift, rebar ~40 kg/m³
            - Ø900: ~1.5 piles/shift, rebar ~80-100 kg/m³ (bridge piles)
            - Ø1200: ~0.8 piles/shift, rebar ~90-120 kg/m³
            - Ø1500: ~0.5 piles/shift, rebar ~100-150 kg/m³
            Typical bridge piles: Ø900 or Ø1200.

        pile_count: Number of piles in the group (for element_type='pilota').
            Used for drilling schedule: drilling_days = ceil(count / productivity).
            Example: SO-202 OP1 = 10 piles (per bridge).

        pile_geology: Ground conditions at pile location.
            - above_gwt: above groundwater table — standard concreting
            - below_gwt: below GWT — REQUIRES casing (pažnice) + tremie pipe,
              concrete class ≥ C25/30 per practice, overpouring +0.5m
            - rock: bedrock — embedment 0.5-2m into rock
            - mixed: mixed conditions — use worst-case scenario
            Bridge piles typically: below_gwt (most Czech geology).
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

        # ── Auto-assign curing_class if not provided ─────────────────────
        effective_curing_class = curing_class
        if effective_curing_class is None:
            if element_type in ("mostovkova_deska", "rimsa"):
                effective_curing_class = 4  # TKP kap. 18 mandatory
            elif element_type in (
                "zaklady_piliru", "driky_piliru", "opery_ulozne_prahy",
                "kridla_opery", "pricinik", "prechodova_deska",
            ):
                effective_curing_class = 3  # bridge substructure
            else:
                effective_curing_class = 2  # building elements

        # Rebar estimate — bridge piles get higher default
        rebar_kg_m3 = profile["rebar_kg_m3"]
        if element_type == "pilota" and pile_diameter_mm and pile_diameter_mm >= 800:
            rebar_kg_m3 = 90  # bridge piles Ø≥800 real: 80-100 kg/m³
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
        if profile["orientation"] == "vertical" and h > 0 and element_type != "pilota":
            pressure_kn = _lateral_pressure(pour_height)
            formwork_system = _select_formwork(h, pressure_kn)
        elif element_type == "pilota":
            formwork_system = {"system": "Pažnice / casing (no formwork)", "manufacturer": "N/A"}
        else:
            formwork_system = {
                "system": profile["formwork"][0] if profile["formwork"] else "N/A",
                "manufacturer": "DOKA",
            }

        # Number of tacts
        num_tacts = _calculate_tacts(h, volume_m3, element_type)

        # ── Curing calculation with class table ──────────────────────────
        # Saul maturity model baseline
        maturity_hours = 720 / max(1, temperature_c + 10)
        maturity_days = math.ceil(maturity_hours / 24)

        # TKP curing class table lookup
        if temperature_c >= 25:
            temp_band = ">=25"
        elif temperature_c >= 15:
            temp_band = "15-25"
        elif temperature_c >= 10:
            temp_band = "10-15"
        else:
            temp_band = "5-10"

        tkp_curing = CURING_DAYS_TABLE.get(
            (effective_curing_class, temp_band), CURING_DAYS_TYPICAL
        )

        # XF3/XF4 minimum curing floor
        exposure_floor = 0
        if exposure_class:
            exposure_floor = EXPOSURE_MIN_CURING.get(exposure_class.upper(), 0)

        curing_days = max(maturity_days, math.ceil(tkp_curing), exposure_floor)

        # Schedule
        schedule = _estimate_days(volume_m3, formwork_area_m2, rebar_tons, num_tacts)
        # Override curing with TKP-aware value
        schedule["curing_days"] = curing_days * num_tacts
        schedule["total_days"] = (
            schedule["formwork_days"] + schedule["rebar_days"]
            + schedule["concrete_days"] + schedule["curing_days"]
        )

        # Prestress addition
        prestress_days = 0
        if is_prestressed:
            prestress_days = 11  # 7d wait + 2d stressing + 2d grouting
            schedule["prestress_days"] = prestress_days
            schedule["total_days"] += prestress_days

        # Bridge deck specifics
        bridge_tech = None
        bridge_tech_warning = None
        if element_type == "mostovkova_deska" and span_m:
            if construction_technology:
                tech_map = {
                    "fixed_scaffolding": "Pevná skruž (fixed falsework)",
                    "mss": "Posuvná skruž (MSS)",
                    "cantilever": "Letmá betonáž (CFT / balanced cantilever)",
                }
                bridge_tech = tech_map.get(construction_technology, construction_technology)
            elif span_m <= 25:
                bridge_tech = "Pevná skruž (fixed falsework)"
            elif span_m <= 40 and (num_spans or 0) >= 4:
                bridge_tech = "Posuvná skruž (MSS)"
            elif span_m > 40:
                bridge_tech = "Letmá betonáž (CFT / balanced cantilever)"
            else:
                bridge_tech = "Pevná skruž (fixed falsework)"

            if (num_spans or 0) >= 4 and span_m and span_m <= 40:
                bridge_tech_warning = (
                    f"{num_spans} polí × {span_m}m — zvažte MSS "
                    "(posuvnou skruž) pro ekonomičtější výstavbu."
                )

        # Warnings
        warnings = []
        if bridge_tech_warning:
            warnings.append(bridge_tech_warning)
        if num_bridges > 1:
            warnings.append(
                f"{num_bridges} samostatné mosty — celkový objem = "
                f"{round(volume_m3 * num_bridges, 1)} m³ "
                f"({volume_m3} m³ × {num_bridges})."
            )
        if element_type == "pilota" and pile_geology == "below_gwt":
            warnings.append(
                "Piloty pod HPV — povinné pažení (casing) a betonáž "
                "kontraktorovou rourou. Nadbetonávka +0.5m."
            )

        result = {
            "element_type": element_type,
            "label_cs": profile["label_cs"],
            "input": {
                "volume_m3": volume_m3,
                "concrete_class": concrete_class,
                "height_m": h,
                "width_m": width_m,
                "is_prestressed": is_prestressed,
                "curing_class": effective_curing_class,
                "exposure_class": exposure_class,
                "num_bridges": num_bridges,
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
            "curing": {
                "curing_class": effective_curing_class,
                "curing_days": curing_days,
                "temperature_c": temperature_c,
                "temperature_band": temp_band,
                "tkp_table_days": tkp_curing,
                "maturity_days": maturity_days,
                "exposure_floor_days": exposure_floor,
                "source": "TKP kap. 18 §7.8.3",
            },
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

        if warnings:
            result["warnings"] = warnings

        return result

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
