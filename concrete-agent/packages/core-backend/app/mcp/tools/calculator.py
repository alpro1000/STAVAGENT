"""
MCP Tool: calculate_concrete_works

Calculates concrete works for a single RC structural element by DELEGATING to
the canonical TypeScript engine (planElement) over HTTP — POST /api/calculate
on the Monolit-Planner backend (TASK_FIX_SSOT_MCP_Delegate, Phase 2).

The 7-engine pipeline is the SINGLE source of truth; this tool no longer keeps
a divergent Python re-implementation. It maps the MCP arguments to a
PlannerInput, forwards them, and returns the engine's PlannerOutput VERBATIM
(+ source="monolit_planner_api"). On engine failure it returns a typed error
(engine_unavailable / engine_error / engine_invalid_input) — NEVER a silently
computed number. MCP-only element types with no canonical equivalent are
refused as `unsupported_element_type` rather than estimated.
"""

import logging
import math
from typing import Optional

from app.mcp.tools.monolit_delegate import (
    EngineDelegationError,
    delegate_calculate,
    to_error_dict,
)

logger = logging.getLogger(__name__)

# ── MCP element_type → canonical engine StructuralElementType ────────────────
# Deterministic rename only (NOT a re-calculation): a handful of MCP type codes
# differ in spelling from the engine union but have a 1:1 equivalent. The engine
# still does all the math.
_MCP_TO_ENGINE_TYPE = {
    "deska": "stropni_deska",
    "operna_zed": "operne_zdi",
    "pricinik": "rigel",
    "zaklady": "zakladovy_pas",
    "jine": "other",
}

# MCP-only types with NO canonical engine equivalent. Masonry/cladding (W3),
# white-tank walls, shafts, tunnels/ramps are absent from the engine's
# StructuralElementType union — the canonical engine cannot price them, so we
# refuse rather than compute a divergent simplified estimate.
_ENGINE_UNSUPPORTED_TYPES = frozenset({
    "zdivo_obklad", "izolacni_stena", "sachta", "tunel_rampa",
})

# Engine catalog orientation (mirror of shared ELEMENT_CATALOG) — used ONLY to
# translate the MCP-level `width_m` hint into the engine's canonical
# `formwork_area_m2` estimate (horizontal: V/thickness; vertical: V/width × 2,
# same formula the pre-SSOT local engine used). The engine itself stays the
# single source of truth for everything downstream of the estimate.
_HORIZONTAL_ENGINE_TYPES = frozenset({
    "zaklady_piliru", "zaklady_oper", "rimsa", "mostovkova_deska", "rigel",
    "prechodova_deska", "zakladova_deska", "stropni_deska", "pruvlak",
    "schodiste", "podkladni_beton", "podlozkovy_blok",
})

# nk_subtype (MCP docstring vocabulary) → bridge_deck_subtype (engine enum).
_NK_SUBTYPE_TO_ENGINE = {
    "deskovy": "deskovy",
    "jednotramovy": "jednotram",
    "dvoutramovy": "dvoutram",
    "vicetramovy": "vicetram",
    "komorovy": "jednokomora",
    "sprazeny": "sprazeny",
}

# ── Formwork override catalog (semantic-warning surface only) ─────────────────
# Subset of the 29-system catalog (`Monolit-Planner/shared/.../formwork-systems`)
# used to validate `formwork_system_name` / `preferred_manufacturer` overrides
# against semantic intent. The MCP wrapper is intentionally read-only — it
# surfaces overrides in the result, warns on a semantic mismatch, but does not
# re-run the 7-engine pipeline. Authoritative selection still lives in the
# shared TypeScript code reached via /api/calculate when the Monolit-Planner
# backend is available.
KNOWN_MANUFACTURERS = ("DOKA", "PERI", "ULMA", "NOE", "Místní")

# system_name → (manufacturer, unit, allowed element_types, productivity hint)
# `allowed` is a tuple of element_type strings; empty tuple = "any".
KNOWN_FORMWORK_SYSTEMS = {
    # Říms-specific (T-bednění / římsový vozík) — unit is bm, not m²
    "Římsové bednění T": {
        "manufacturer": "DOKA",
        "unit": "bm",
        "allowed": ("rimsa",),
        "productivity": {
            "assembly_h_per_bm": 1.0,
            "strip_h_per_bm": 0.43,
        },
    },
    "Římsový vozík T": {
        "manufacturer": "DOKA", "unit": "bm", "allowed": ("rimsa",),
        "productivity": {"assembly_h_per_bm": 0.8, "strip_h_per_bm": 0.35},
    },
    "Římsový vozík TU": {
        "manufacturer": "DOKA", "unit": "bm", "allowed": ("rimsa",),
        "productivity": {"assembly_h_per_bm": 0.8, "strip_h_per_bm": 0.35},
    },
    # Wall / column systems (m², vertical only)
    "Frami Xlife": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("stena", "sloup", "zaklady", "operna_zed"),
    },
    "Framax Xlife": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("stena", "sloup", "driky_piliru", "opery_ulozne_prahy",
                    "kridla_opery", "operna_zed"),
    },
    "TRIO": {
        "manufacturer": "PERI", "unit": "m2",
        "allowed": ("stena", "sloup", "driky_piliru", "operna_zed"),
    },
    "MAXIMO": {
        "manufacturer": "PERI", "unit": "m2",
        "allowed": ("stena", "sloup", "driky_piliru"),
    },
    "VARIO GT 24": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("stena", "sloup", "driky_piliru", "operna_zed"),
    },
    # Slab / falsework systems
    "Dokaflex": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("deska", "stropni_deska", "zakladova_deska"),
    },
    "SKYDECK": {
        "manufacturer": "PERI", "unit": "m2",
        "allowed": ("deska", "stropni_deska"),
    },
    "Top 50": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("mostovkova_deska", "pruvlak", "pricinik"),
    },
    "Staxo 100": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("mostovkova_deska", "deska", "pruvlak"),
    },
    "VARIOKIT HD 200": {
        "manufacturer": "PERI", "unit": "m2",
        "allowed": ("mostovkova_deska", "pruvlak"),
    },
    # MSS (movable scaffolding)
    "DOKA MSS": {
        "manufacturer": "DOKA", "unit": "m2",
        "allowed": ("mostovkova_deska",),
    },
    "VARIOKIT Mobile": {
        "manufacturer": "PERI", "unit": "m2",
        "allowed": ("mostovkova_deska",),
    },
}


def _validate_formwork_override(
    system_name: str, element_type: str
) -> Optional[str]:
    """Return a warning string when system_name is not semantically valid
    for the given element_type. Unknown system names pass through silently
    so user-supplied systems outside the small Czech catalog aren't blocked."""
    spec = KNOWN_FORMWORK_SYSTEMS.get(system_name)
    if spec is None:
        return None  # unknown system → trust the user, no warning
    allowed = spec["allowed"]
    if allowed and element_type not in allowed:
        allowed_cs = ", ".join(allowed)
        return (
            f"⚠️ Bednění '{system_name}' ({spec['unit']}) je typicky určeno "
            f"pro element_type ∈ {{{allowed_cs}}}, ale zadáno '{element_type}'. "
            f"Výpočet pokračuje s overridem — ověřte technologickou správnost."
        )
    return None


def _build_planner_payload(
    *,
    element_type: str,
    volume_m3: float,
    concrete_class: str,
    height_m: Optional[float],
    exposure_class: Optional[str],
    formwork_area_m2: Optional[float],
    is_prestressed: bool,
    nk_subtype: Optional[str],
    span_m: Optional[float],
    num_spans: Optional[int],
    temperature_c: float,
    curing_class: Optional[int],
    construction_technology: Optional[str],
    num_bridges: int,
    pile_diameter_mm: Optional[int],
    pile_count: Optional[int],
    pile_geology: Optional[str],
    preferred_manufacturer: Optional[str],
    formwork_system_name: Optional[str],
    rental_czk_override: Optional[float],
    width_m: Optional[float] = None,
    length_m: Optional[float] = None,
    formwork_length_bm: Optional[float] = None,
    cycle_length_bm: Optional[float] = None,
    tz_technology: Optional[str] = None,
    tz_pour_stages: Optional[int] = None,
    tz_quote: Optional[str] = None,
    tz_anchor: Optional[str] = None,
    rebar_mass_kg: Optional[float] = None,
    prestress_strand_mass_kg: Optional[float] = None,
    num_tacts_override: Optional[int] = None,
    parts: Optional[list] = None,
    # ── uzavřený rám / tubus (element 24, §3) ────────────────────────────
    construction_mode: Optional[str] = None,
    tubus_dc_count: Optional[int] = None,
    tubus_clear_width_m: Optional[float] = None,
    tubus_clear_height_m: Optional[float] = None,
    tubus_bottom_thickness_m: Optional[float] = None,
    tubus_wall_thickness_m: Optional[float] = None,
    tubus_top_thickness_m: Optional[float] = None,
    tubus_section_length_m: Optional[float] = None,
    tubus_technology: Optional[str] = None,
    tubus_visual_concrete: Optional[bool] = None,
    tubus_internal_structures: Optional[bool] = None,
    exposure_from_documentation: Optional[bool] = None,
) -> dict:
    """Map MCP arguments → canonical engine PlannerInput.

    `element_type` is the (already alias-resolved) engine type. None values are
    omitted so the engine applies its own defaults; `has_dilatacni_spary` is
    always sent (the engine requires it) defaulting to monolithic (false).

    MCP-level hints with no 1:1 engine field are translated, not dropped:
    - width_m → nk_width_m (bridge deck) or a formwork_area_m2 estimate
      (other elements, only when the caller didn't supply the area);
    - formwork_length_bm → formwork_area_m2 for bm-unit systems (the engine
      consumes the area input as quantity in the system's unit);
    - formwork_length_bm + cycle_length_bm → num_tacts_override for říms
      (Czech practice 25–30 m záběry).
    """
    payload: dict = {
        "element_type": element_type,
        "volume_m3": float(volume_m3 or 0.0),
        "concrete_class": concrete_class,
        "is_prestressed": bool(is_prestressed),
        "num_bridges": num_bridges,
        "temperature_c": temperature_c,
        "has_dilatacni_spary": False,
    }
    optional = {
        "height_m": height_m,
        "exposure_class": exposure_class,
        "formwork_area_m2": formwork_area_m2,
        "span_m": span_m,
        "num_spans": num_spans,
        "curing_class": curing_class,
        "construction_technology": construction_technology,
        "pile_diameter_mm": pile_diameter_mm,
        "pile_count": pile_count,
        "pile_geology": pile_geology,
        "preferred_manufacturer": preferred_manufacturer,
        "formwork_system_name": formwork_system_name,
        "rental_czk_override": rental_czk_override,
        # SO-202 Žalmanov E2E findings (2026-07-07): exact soupis quantities +
        # documented pour staging were untranslatable via MCP — the engine
        # estimated rebar from type ratios (−20 % on základy) and the TZ's
        # «3 takty» could only FLAG, never compute. Straight passthroughs:
        "rebar_mass_kg": rebar_mass_kg,
        "prestress_strand_mass_kg": prestress_strand_mass_kg,
        "num_tacts_override": num_tacts_override,
        # ── uzavřený rám / tubus (element 24, §3) — 1:1 passthrough ───────
        # These map verbatim to the engine's PlannerInput.tubus_* / construction_mode
        # fields; runTubusPath early-branches on element_type and derives the box
        # geometry from THESE explicit inputs only (§2.10 — no breakdown heuristic).
        "construction_mode": construction_mode,
        "tubus_dc_count": tubus_dc_count,
        "tubus_clear_width_m": tubus_clear_width_m,
        "tubus_clear_height_m": tubus_clear_height_m,
        "tubus_bottom_thickness_m": tubus_bottom_thickness_m,
        "tubus_wall_thickness_m": tubus_wall_thickness_m,
        "tubus_top_thickness_m": tubus_top_thickness_m,
        "tubus_section_length_m": tubus_section_length_m,
        "tubus_technology": tubus_technology,
        "tubus_visual_concrete": tubus_visual_concrete,
        "tubus_internal_structures": tubus_internal_structures,
        "exposure_from_documentation": exposure_from_documentation,
    }
    for key, value in optional.items():
        if value is not None:
            payload[key] = value
    if nk_subtype:
        mapped = _NK_SUBTYPE_TO_ENGINE.get(nk_subtype)
        if mapped:
            payload["bridge_deck_subtype"] = mapped

    # ── Box geometry passthrough (Phase 5 Step 2) ────────────────────────
    # Forward length_m/width_m/height_m so the SHARED engine derives volume
    # (L·W·H) + formwork area for prismatic types when volume_m3 is omitted —
    # the same element-geometry rule the frontend uses (§4 parity). height_m is
    # already forwarded above; add the box length/width. The width_m hint
    # translation below only fires when volume_m3 is truthy, so it does not
    # collide with the volume-0 derive path.
    # NB 2026-07-17: uzavreny_ram_tubus is NON-prismatic (the frame is hollow;
    # a solid box would fabricate ~3× the real volume) — box dims never derive
    # its volume. A tubus without volume_m3 fails typed (§2.10 honest gate,
    # missing_fields names volume_m3) instead of returning a silent-wrong plan.
    if length_m and length_m > 0:
        payload["length_m"] = float(length_m)
    if width_m and width_m > 0 and element_type != "mostovkova_deska":
        payload["width_m"] = float(width_m)

    # ── width_m hint translation ──────────────────────────────────────────
    # NB: uzavreny_ram_tubus is EXCLUDED from the formwork-area heuristic (§2.10 /
    # AC14) — the tubus derives bednění/skruž/beton VÝHRADNĚ from its explicit
    # tubus_* geometry, never from a V/width breakdown shortcut.
    if width_m and width_m > 0 and element_type != "uzavreny_ram_tubus":
        if element_type == "mostovkova_deska":
            payload["nk_width_m"] = float(width_m)
        elif "formwork_area_m2" not in payload and volume_m3:
            if element_type in _HORIZONTAL_ENGINE_TYPES:
                payload["formwork_area_m2"] = round(
                    float(volume_m3) / max(0.15, width_m), 2
                )
            else:
                payload["formwork_area_m2"] = round(
                    float(volume_m3) / max(0.2, width_m) * 2, 2
                )

    # ── T-bednění (bm) quantity + záběr override ─────────────────────────
    spec = KNOWN_FORMWORK_SYSTEMS.get(formwork_system_name or "")
    is_bm = (spec or {}).get("unit") == "bm" or element_type == "rimsa"
    if formwork_length_bm and formwork_length_bm > 0 and is_bm:
        # Engine consumes the area input as PER-TACT quantity in the system's
        # unit; for bm systems that quantity is the záběr length, NOT the
        # whole-bridge total. Pre-fix this passed the full length per tact —
        # the engine's own sanity net flagged it (»16.4 m²/m³« on SO-202
        # Žalmanov, 2026-07-07) and formwork labor/rental inflated ~9×.
        tacts_from_cycle = (
            max(1, math.ceil(formwork_length_bm / cycle_length_bm))
            if cycle_length_bm and cycle_length_bm > 0
            else None
        )
        effective_tacts = num_tacts_override or tacts_from_cycle
        payload["formwork_area_m2"] = round(
            float(formwork_length_bm) / (effective_tacts or 1), 2
        )
        if tacts_from_cycle and "num_tacts_override" not in payload:
            payload["num_tacts_override"] = tacts_from_cycle

    # ── tz_facts (Part B/C validation rule input) ─────────────────────────
    # The documented construction technology / pour-stage count from the TZ.
    # The engine's validation rule compares this against the calculator input
    # and emits a VISIBLE FLAG (never a gate) on contradiction. Silent when
    # absent. Carried separately from construction_technology (the input side)
    # so a deviation can actually fire.
    if tz_technology or tz_pour_stages is not None:
        construction: dict = {
            "quote": tz_quote or "TZ (předáno přes MCP)",
            "anchor": tz_anchor or "TZ",
        }
        if tz_technology:
            construction["technology"] = tz_technology
        if tz_pour_stages is not None:
            construction["pour_stages_count"] = int(tz_pour_stages)
        payload["tz_facts"] = {"construction": construction}
    # ── Composite parts (Fáze 5 #7) — FORWARD-ONLY ───────────────────────────
    # MCP does NOT decompose: when the caller supplies structural sub-parts, pass
    # them through verbatim. The Monolit backend's planComposite (behind its
    # ENABLE_COMPOSITE_PARTS flag) treats this element as a container and does the
    # split + aggregation. No MCP-side logic.
    if parts:
        payload["parts"] = parts
    return payload


async def _build_dotazy_section(
    *,
    concrete_class_sources: list,
    main_class: str,
    payload: dict,
    element_type: str,
    volume_m3: float,
) -> list[dict]:
    """§2.11 «Dotazy na projektanta» section for the calculate result.

    Detects concrete-class conflicts between the caller-supplied source
    claims, and for each PRICED conflict (otazka/chyba levels) computes:
      * a FULL engine variant per conflicting class ≠ main_class (the same
        payload re-delegated with the swapped class — «kalkulátor počítá
        OBĚ varianty»); a failed variant leg degrades to a typed reason;
      * the CZK delta from the OTSKP DB (honest None + reason when either
        item is not reliably found).
    sloppy_wording findings (DO-band containing the class, Pattern 53) carry
    citations only — a band is not a priced conflict.
    """
    from app.mcp.tools.dotazy_projektanta import (
        LEVEL_SLOPPY,
        concrete_class_delta_czk,
        detect_concrete_class_findings,
        normalize_concrete_class,
    )

    # Finding classes are normalized ('C25/30'); the caller's input may carry
    # exposure suffixes ('C25/30 XF2') — normalize before comparing.
    main_norm = normalize_concrete_class(main_class) or main_class

    findings = detect_concrete_class_findings(concrete_class_sources)
    for finding in findings:
        if finding["level"] == LEVEL_SLOPPY:
            continue  # pásmo obsahující třídu — citace stačí, žádná delta

        variant_classes = [c for c in finding["classes"] if c != main_norm]
        variants = []
        for cls in variant_classes:
            try:
                variant_out = await delegate_calculate({**payload, "concrete_class": cls})
                variants.append({"concrete_class": cls, "plan": variant_out})
            except EngineDelegationError as exc:
                logger.warning(
                    "[MCP/Calculator] §2.11 variant %s failed: %s", cls, exc)
                variants.append({
                    "concrete_class": cls,
                    "plan": None,
                    "error": to_error_dict(exc),
                })
        finding["variants"] = variants
        finding["main_variant_class"] = main_norm

        classes = finding["classes"]
        if len(classes) >= 2:
            finding["cena_delta"] = await concrete_class_delta_czk(
                classes[0], classes[-1], volume_m3, element_type,
            )
    return findings


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
    preferred_manufacturer: Optional[str] = None,
    formwork_system_name: Optional[str] = None,
    rental_czk_override: Optional[float] = None,
    formwork_length_bm: Optional[float] = None,
    cycle_length_bm: Optional[float] = None,
    length_m: Optional[float] = None,
    tz_technology: Optional[str] = None,
    tz_pour_stages: Optional[int] = None,
    tz_quote: Optional[str] = None,
    tz_anchor: Optional[str] = None,
    rebar_mass_kg: Optional[float] = None,
    prestress_strand_mass_kg: Optional[float] = None,
    num_tacts_override: Optional[int] = None,
    parts: Optional[list] = None,
    construction_mode: Optional[str] = None,
    tubus_dc_count: Optional[int] = None,
    tubus_clear_width_m: Optional[float] = None,
    tubus_clear_height_m: Optional[float] = None,
    tubus_bottom_thickness_m: Optional[float] = None,
    tubus_wall_thickness_m: Optional[float] = None,
    tubus_top_thickness_m: Optional[float] = None,
    tubus_section_length_m: Optional[float] = None,
    tubus_technology: Optional[str] = None,
    tubus_visual_concrete: Optional[bool] = None,
    tubus_internal_structures: Optional[bool] = None,
    exposure_from_documentation: Optional[bool] = None,
    concrete_class_sources: Optional[list] = None,
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

            Closed monolithic frame (uzavřený rám / tubus — element 24):
            - uzavreny_ram_tubus: closed RC box frame — pedestrian/rail
              underpass (podchod), box culvert (rámový propustek), utility
              collector (kolektor). Poured per dilatation unit (DC) in phases
              (bottom slab → walls → top slab). Geometry comes ONLY from the
              explicit tubus_* inputs below (never a breakdown heuristic). Use
              construction_mode='prefab' for precast frame units (no pour phases).

        volume_m3: Total concrete volume in m³ for ONE structure.
            For bridges with num_bridges=2 (LM+PM), enter volume for 1 bridge —
            total is computed as volume_m3 × num_bridges.
            Example: SO-202 bridge deck NK = 693.35 m³ per bridge
            (VV pos. 422336: 1 386.700 m³ both bridges ÷ 2).

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

        length_m: Element box length in meters (Phase 5 Step 2). When
            volume_m3 is omitted and length_m + width_m + height_m are all
            given for a PRISMATIC type (wall/slab/column/beam/foundation/
            abutment/pier), the shared engine derives volume = L·W·H +
            formwork area = 2(L+W)·H — the same rule the frontend uses
            (§4 parity). Non-prismatic types (deck/pile/cornice/stairs/tank/
            closed frame uzavreny_ram_tubus) ignore it and keep their own
            quantity source — a tubus without volume_m3 fails typed per
            §2.10 (the hollow frame must never get a solid-box volume).

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
            Example: SO-202 TZ §7.2 specifies 'fixed_scaffolding' with the
            whole deck poured in ONE tact («betonáž NK na pevné skruži
            v jednom taktu») — NOT one tact per span.

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

        preferred_manufacturer: Manufacturer pre-filter for the formwork
            auto-recommendation. Values: 'DOKA', 'PERI', 'ULMA', 'NOE',
            'Místní' (traditional carpentry). If omitted, the engine picks
            across all manufacturers based on geometry + lateral pressure.
            Mirrors the Calculator UI dropdown "Výrobce bednění".

        formwork_system_name: Manual override of the formwork system. Bypasses
            auto-detection. Pass the catalog name verbatim, e.g.:
            - 'Římsové bednění T' / 'Římsový vozík T' / 'Římsový vozík TU' —
              T-bednění for parapets / římsy. Triggers T-bednění math:
              · assembly norm 1.0 h/bm
              · strip + relocate norm 0.43 h/bm
              · rental priced per Kč/bm/month (use rental_czk_override).
              Unit switches from m² to bm — pass formwork_length_bm + cycle_length_bm.
            - 'Frami Xlife' (DOKA, walls ≤3m, 80 kN/m²)
            - 'Framax Xlife' (DOKA, walls/piers ≤6.75m, 100 kN/m²)
            - 'TRIO' / 'MAXIMO' (PERI walls/piers)
            - 'VARIO GT 24' (DOKA, walls ≤12m, custom 150 kN/m²)
            - 'Dokaflex' / 'SKYDECK' (slabs)
            - 'Top 50' / 'Staxo 100' / 'VARIOKIT HD 200' (bridge falsework)
            - 'DOKA MSS' / 'VARIOKIT Mobile' (movable scaffolding)
            Unknown system names pass through without a warning (so user-
            supplied systems outside the small Czech catalog aren't blocked).
            Known systems with element_type mismatch surface a ⚠️ warning in
            `warnings[]` but the calculation still runs with the override.

        rental_czk_override: Manual rental price override per system unit per
            month. For T-bednění / římsové systémy the unit is bm (Kč/bm/měs);
            for wall / slab systems it is m² (Kč/m²/měs). Surfaced in
            `formwork.rental_czk_override` and `formwork.rental_unit`.

        formwork_length_bm: User-supplied total formwork length in linear
            meters. Only meaningful for říms / linear elements where the unit
            is bm. When provided AND the chosen system uses bm, takes priority
            over the m² area estimate (and `formwork_area_m2` is ignored).

        cycle_length_bm: Záběr length in linear meters (typical 25–30 m for
            římsy per Czech practice). Used to recompute `num_tacts` for říms
            elements when both formwork_length_bm and cycle_length_bm are
            provided: `num_tacts = ceil(formwork_length_bm / cycle_length_bm)`.
        tz_technology: Construction technology documented in the TZ
            ('fixed_scaffolding' | 'mss' | 'cantilever'). Fed to the engine's
            validation rule, which flags a VISIBLE WARNING (never a gate) when
            the calculator's construction_technology contradicts it.
        tz_pour_stages: Number of NK pour stages/takty documented in the TZ
            (e.g. 1 = «v jednom taktu», 3 = «ve třech etapách»). Flagged
            against the engine-resolved num_tacts on mismatch.
        tz_quote: Verbatim TZ sentence backing tz_technology/tz_pour_stages
            (shown in the warning). Optional.
        tz_anchor: Section + page anchor of the quote, e.g. 'TZ §4.1.6, str. 11'.
            Optional.
        rebar_mass_kg: Exact B500B reinforcement mass in kg for the WHOLE
            element (soupis/VV tonnage, e.g. pos. 272365 «VÝZTUŽ ZÁKLADŮ»
            129 877 kg). When provided the engine uses it verbatim instead of
            estimating from the element-type ratio (estimates ran −15…−25 %
            vs soupis on SO-202 Žalmanov). For num_bridges=2 pass the
            PER-BRIDGE mass (like volume_m3).
        prestress_strand_mass_kg: Y1860S7 strand mass in kg (per bridge, e.g.
            pos. 42237 «VÝZTUŽ PŘEDPÍNACÍ» ÷ 2). Feeds the confirmed labor
            norm 35 Nh/t (v4.36); echo-only for schedule.
        num_tacts_override: Force the pour-tact count, e.g. to honor the TZ
            («ve 3 taktech na skruži» → 3). The engine recomputes per-tact
            volume + pour hours and emits mega-pour warnings honestly (crew
            relief, backup pump) instead of splitting by pour window. Wins
            over the cycle_length_bm-derived count.

        construction_mode: Build mode for uzavreny_ram_tubus:
            'monolit' (default) = cast-in-place frame with pour phases;
            'prefab' = precast frame units → NO formwork/pour phases, an
            assembly-only plan (montáž + zálivky). Extensible to 'hybrid'.
        tubus_dc_count: Number of dilatation units (dilatační celky). Taken
            from the input, NEVER computed by the calculator. 10 DC × 3 phases
            (conventional) = 30 frame pours.
        tubus_clear_width_m: Clear internal width of the box (světlá šířka).
        tubus_clear_height_m: Clear internal height of the frame (světlá výška).
            This — NOT the top-slab thickness — is the falsework working height
            (SO 11-20-04: 3.0 m).
        tubus_bottom_thickness_m: Bottom-slab thickness (spodní deska).
        tubus_wall_thickness_m: Wall thickness (stěny).
        tubus_top_thickness_m: Top-slab thickness (strop).
        tubus_section_length_m: Length of one section along the axis (délka sekce).
            Falsework/formwork/concrete quantities derive from these explicit
            dimensions only (§2.10) — no V/thickness breakdown heuristic.
        tubus_technology: Formwork technology — 'conventional' (3 frame phases
            per DC: bottom → walls → top), 'traveler' (bednící vozík: walls+top
            merged → 2 phases per DC), or 'auto' (data-driven A/B choice; a
            varied profile with niches/shafts/stairs → conventional, a long run
            of constant sections → traveler).
        tubus_visual_concrete: True when surfaces are pohledový beton (PB2/PB3
            or relief) — restricts formwork to beam-type wall systems and
            proposes an R-item surcharge.
        tubus_internal_structures: True when the section carries internal
            structures (niches, shafts, stairs) — a signal toward conventional.
        exposure_from_documentation: True when the exposure class was read
            verbatim from the project documentation — suppresses the
            atypical-exposure warning for the tubus (documented values are trusted).
        concrete_class_sources: Concrete-class claims from the project sources
            (§2.11 «Dotazy na projektanta»). Each: {source_document, anchor,
            concrete_class} with the VERBATIM value as written (e.g.
            [{"source_document": "TZ", "anchor": "§4.2 str. 12",
              "concrete_class": "C25/30"},
             {"source_document": "výkres D.4.2", "anchor": "legenda",
              "concrete_class": "C20/25"}]).
            On a conflict the result gains a `dotazy_na_projektanta` section:
            citations of ALL sources with anchors, the level
            (otazka_na_projektanta | sloppy_wording | chyba_v_dokumentaci),
            a CZK price delta from the OTSKP DB, and a FULL engine variant
            per conflicting class — the calculator computes BOTH variants and
            NEVER silently picks one (the main plan stays on the caller's
            explicit concrete_class input). Agreement or unreadable values
            are silent. Catalog DO-bands («do C40/50») containing the project
            class are flagged sloppy_wording, not priced conflicts.
    """
    try:
        # Stage-1 extract (extract_tz_fields) ships volume_m3=None — volumes are
        # stage 2 (drawings). Coalesce to 0.0 so the whole pipeline passes through
        # without crashing on arithmetic; the result is simply zero-quantity.
        volume_m3 = volume_m3 or 0.0
        # ── Collect formwork override warnings up-front ──────────────────
        # `override_warnings` is the channel for semantic validation hits
        # (e.g. T-bednění specified for a foundation). The result picks them
        # up in `warnings[]` at the very end.
        override_warnings: list[str] = []
        if (
            preferred_manufacturer
            and preferred_manufacturer not in KNOWN_MANUFACTURERS
        ):
            override_warnings.append(
                f"⚠️ preferred_manufacturer '{preferred_manufacturer}' není "
                f"v katalogu {KNOWN_MANUFACTURERS}. Hodnota přijata, ale "
                f"engine ji nemusí použít při auto-výběru."
            )
        if formwork_system_name:
            mismatch = _validate_formwork_override(
                formwork_system_name, element_type
            )
            if mismatch:
                override_warnings.append(mismatch)

        # ── MCP-only element types: refuse, never estimate ───────────────
        # zdivo_obklad / izolacni_stena / sachta / tunel_rampa have no canonical
        # StructuralElementType equivalent. The SSOT engine cannot price them, so
        # we return an explicit "unsupported" instead of a divergent guess.
        if element_type in _ENGINE_UNSUPPORTED_TYPES:
            return {
                "error": "unsupported_element_type",
                "element_type": element_type,
                "message": (
                    f"Element '{element_type}' nemá ekvivalent v kanonickém "
                    "výpočetním engine (mostní/pozemní ŽB prvky). Zděné/obkladové "
                    "konstrukce, bílá vana, šachty a tunely/rampy se zde nepočítají."
                ),
                "supported": False,
                "source": "monolit_planner_api",
            }

        # ── Delegate to the canonical engine (single source of truth) ────
        engine_type = _MCP_TO_ENGINE_TYPE.get(element_type, element_type)
        payload = _build_planner_payload(
            element_type=engine_type,
            volume_m3=volume_m3,
            concrete_class=concrete_class,
            height_m=height_m,
            exposure_class=exposure_class,
            formwork_area_m2=formwork_area_m2,
            is_prestressed=is_prestressed,
            nk_subtype=nk_subtype,
            span_m=span_m,
            num_spans=num_spans,
            temperature_c=temperature_c,
            curing_class=curing_class,
            construction_technology=construction_technology,
            num_bridges=num_bridges,
            pile_diameter_mm=pile_diameter_mm,
            pile_count=pile_count,
            pile_geology=pile_geology,
            preferred_manufacturer=preferred_manufacturer,
            formwork_system_name=formwork_system_name,
            rental_czk_override=rental_czk_override,
            width_m=width_m,
            length_m=length_m,
            formwork_length_bm=formwork_length_bm,
            cycle_length_bm=cycle_length_bm,
            tz_technology=tz_technology,
            tz_pour_stages=tz_pour_stages,
            tz_quote=tz_quote,
            tz_anchor=tz_anchor,
            rebar_mass_kg=rebar_mass_kg,
            prestress_strand_mass_kg=prestress_strand_mass_kg,
            num_tacts_override=num_tacts_override,
            parts=parts,
            construction_mode=construction_mode,
            tubus_dc_count=tubus_dc_count,
            tubus_clear_width_m=tubus_clear_width_m,
            tubus_clear_height_m=tubus_clear_height_m,
            tubus_bottom_thickness_m=tubus_bottom_thickness_m,
            tubus_wall_thickness_m=tubus_wall_thickness_m,
            tubus_top_thickness_m=tubus_top_thickness_m,
            tubus_section_length_m=tubus_section_length_m,
            tubus_technology=tubus_technology,
            tubus_visual_concrete=tubus_visual_concrete,
            tubus_internal_structures=tubus_internal_structures,
            exposure_from_documentation=exposure_from_documentation,
        )

        try:
            output = await delegate_calculate(payload)
        except EngineDelegationError as exc:
            # Fail loud — typed engine error, NEVER a silently computed number.
            logger.warning("[MCP/Calculator] delegation failed: %s", exc)
            return to_error_dict(exc)

        # Forward the engine's PlannerOutput VERBATIM (+ source). Merge the
        # semantic formwork-override warnings — the engine does not know the
        # small Czech catalog mismatch rules surfaced by _validate_formwork_override.
        output["source"] = "monolit_planner_api"
        if override_warnings:
            output.setdefault("warnings", []).extend(override_warnings)

        # ── §2.11 Dotazy na projektanta (element 24 Wave 3c, AC15) ───────
        # Source conflicts (TZ ↔ výkres ↔ výkaz) are DETECTED and REPORTED,
        # never silently resolved: for each conflicting class the engine is
        # re-run (full variant) and the CZK delta is priced from the OTSKP
        # DB. The MAIN plan stays on the caller's explicit concrete_class —
        # an explicit input is the caller's choice, not the engine's.
        # Agreement / unreadable values = silence. A variant-leg failure or
        # a missing OTSKP item degrades to an honest reason, never a number.
        if concrete_class_sources:
            output["dotazy_na_projektanta"] = await _build_dotazy_section(
                concrete_class_sources=concrete_class_sources,
                main_class=concrete_class,
                payload=payload,
                element_type=element_type,
                volume_m3=volume_m3,
            )

        return output

    except Exception as e:
        logger.error(f"[MCP/Calculator] Error: {e}")
        return {"error": str(e)}


# ═════════════════════════════════════════════════════════════════════════════
# MCP Tool: calculate_pump (TOV concrete pump cost calculator)
# ═════════════════════════════════════════════════════════════════════════════
#
# Mirrors the multi-supplier pump_calc widget in the Monolit-Planner TOV
# (technologicko-organizační vstup) panel. Coefficients per m³ come from
# the Registr Rozpočtů cenový katalog and are stable across all suppliers —
# only the hourly rates vary between betonárny.
#
# Reference: Monolit-Planner UI TOV pump_calc panel, Registr Rozpočtů
# vendor pricing median (DOKA / PERI / Lobr / Schwing).

# TOV coefficients per m³ of concrete (Czech praxe, validated on
# Žihle 2062-1 + SO-202 pilot data).
PUMP_COEFFICIENTS = {
    "cerpadlo_sh_per_m3": 0.07510,      # Bet. čerpadlo (Sh / m³)
    "pristaveni_sh_per_m3": 0.05864,    # Počet přistavení (Sh / m³)
    "doprava_km_per_m3": 0.27034,       # Doprava čerpadla (km / m³) — informative
    "vibrator_sh_per_m3": 0.07330,      # Ponorný vibrátor (Sh / m³)
    "preplatek_m3_per_m3": 1.03,        # Příplatek za přečerpaný m³ (× 1.03)
}

PUMP_DEFAULT_RATES = {
    "cerpadlo_czk_sh": 2500.0,
    "vibrator_czk_sh": 50.0,
    "transport_km": 72.0,
    "transport_czk_km": 68.0,
    "preplatek_czk_m3": 35.0,
}


async def calculate_pump(
    volume_m3: float,
    pump_supplier: Optional[str] = None,
    cerpadlo_rate_czk_sh: float = 2500.0,
    vibrator_rate_czk_sh: float = 50.0,
    transport_km: float = 72.0,
    transport_rate_czk_km: float = 68.0,
    preplatek_rate_czk_m3: float = 35.0,
    bedneni_doprava_czk: Optional[float] = None,
    bedneni_ztracene_dily_czk: Optional[float] = None,
    chemie_najezd_myti_czk: Optional[float] = None,
) -> dict:
    """Spočítá náklady na betonpumpu + dopravu + příplatky podle TOV vzorce.

    Mirrors the Monolit-Planner TOV pump_calc widget. Applies fixed
    coefficients per m³ of concrete (from Registr Rozpočtů median pricing)
    multiplied by user-supplied hourly rates. Pump-only subtotal aggregates
    the first 5 line items (čerpadlo + přistavení + doprava + vibrátor +
    příplatek). Optional bednění costs (doprava, ztracené díly, chemie)
    are added as standalone line items and aggregated into a separate
    "with-bednění" subtotal so callers can choose the right scope.

    TOV coefficients (per m³ of concrete):
      - 0.07510 Sh — Bet. čerpadlo
      - 0.05864 Sh — Počet přistavení
      - 0.07330 Sh — Ponorný vibrátor
      - 1.03 × m³ — Příplatek za přečerpaný m³
      - 0.27034 km/m³ — Doprava čerpadla (informative; quantity is
        `transport_km` parameter, not derived from volume)

    Verification example (266.328 m³ at default rates):
      čerpadlo: 0.07510 × 266.328 × 2500 ≈ 50 003 Kč
      přistavení: 0.05864 × 266.328 × 2500 ≈ 39 044 Kč
      doprava: 72 × 68 = 4 896 Kč
      vibrátor: 0.07330 × 266.328 × 50 ≈ 976 Kč
      příplatek: 1.03 × 266.328 × 35 ≈ 9 601 Kč
      ≈ 104 520 Kč total pump-only.

    Args:
        volume_m3: Concrete volume in m³ for the pour. Drives every
            coefficient-based line.
        pump_supplier: Optional supplier label echoed in the result
            (e.g. 'Lobr', 'Schwing', 'CEMEX'). Does not affect math.
        cerpadlo_rate_czk_sh: Hourly rate for the pump in Kč/Sh
            (default 2 500 — Czech median 2026).
        vibrator_rate_czk_sh: Hourly rate for the immersion vibrator
            in Kč/Sh (default 50).
        transport_km: One-way distance in km to the construction site
            (default 72 — median per Registr Rozpočtů 2026). The
            coefficient 0.27034 km/m³ is informative; quantity comes from
            this parameter, not from volume_m3.
        transport_rate_czk_km: Transport rate in Kč/km (default 68).
        preplatek_rate_czk_m3: Surcharge per m³ pumped (default 35).
        bedneni_doprava_czk: Optional flat-fee bednění transport cost in Kč.
            When provided, appears as a standalone line item and is included
            in `subtotal_with_bedneni_czk`.
        bedneni_ztracene_dily_czk: Optional flat-fee bednění consumables /
            ztracené díly cost in Kč.
        chemie_najezd_myti_czk: Optional flat-fee chemistry / nájezd / mytí
            cost in Kč.

    Returns:
        Dict with `lines[]` (one entry per cost component), pump-only
        subtotal, with-bednění subtotal, per-m³ unit cost, and an echo
        of the inputs for self-describing schemas.
    """
    try:
        if volume_m3 <= 0:
            return {
                "error": f"volume_m3 must be > 0 (got {volume_m3})",
                "source": "mcp_pump_calculator",
            }

        lines: list[dict] = []

        # ── 1. Bet. čerpadlo ────────────────────────────────────────────
        cerpadlo_qty = PUMP_COEFFICIENTS["cerpadlo_sh_per_m3"] * volume_m3
        cerpadlo_total = cerpadlo_qty * cerpadlo_rate_czk_sh
        lines.append({
            "name": "Bet. čerpadlo",
            "unit": "Sh",
            "coefficient": PUMP_COEFFICIENTS["cerpadlo_sh_per_m3"],
            "quantity": round(cerpadlo_qty, 4),
            "unit_price": cerpadlo_rate_czk_sh,
            "total_czk": round(cerpadlo_total, 2),
            "category": "pump",
        })

        # ── 2. Počet přistavení ────────────────────────────────────────
        pristaveni_qty = PUMP_COEFFICIENTS["pristaveni_sh_per_m3"] * volume_m3
        pristaveni_total = pristaveni_qty * cerpadlo_rate_czk_sh
        lines.append({
            "name": "Počet přistavení",
            "unit": "Sh",
            "coefficient": PUMP_COEFFICIENTS["pristaveni_sh_per_m3"],
            "quantity": round(pristaveni_qty, 4),
            "unit_price": cerpadlo_rate_czk_sh,
            "total_czk": round(pristaveni_total, 2),
            "category": "pump",
        })

        # ── 3. Doprava čerpadla — flat km × rate, NOT volume-driven ────
        doprava_total = transport_km * transport_rate_czk_km
        lines.append({
            "name": "Doprava čerpadla",
            "unit": "km",
            # Echo the informative volume-derived hint so callers see what
            # the coefficient would predict for this volume:
            "coefficient_hint_km_per_m3": PUMP_COEFFICIENTS["doprava_km_per_m3"],
            "coefficient_hint_km": round(
                PUMP_COEFFICIENTS["doprava_km_per_m3"] * volume_m3, 2,
            ),
            "quantity": transport_km,
            "unit_price": transport_rate_czk_km,
            "total_czk": round(doprava_total, 2),
            "category": "pump",
        })

        # ── 4. Ponorný vibrátor ────────────────────────────────────────
        vibrator_qty = PUMP_COEFFICIENTS["vibrator_sh_per_m3"] * volume_m3
        vibrator_total = vibrator_qty * vibrator_rate_czk_sh
        lines.append({
            "name": "Ponorný vibrátor",
            "unit": "Sh",
            "coefficient": PUMP_COEFFICIENTS["vibrator_sh_per_m3"],
            "quantity": round(vibrator_qty, 4),
            "unit_price": vibrator_rate_czk_sh,
            "total_czk": round(vibrator_total, 2),
            "category": "pump",
        })

        # ── 5. Příplatek za přečerpaný m³ ─────────────────────────────
        preplatek_qty = PUMP_COEFFICIENTS["preplatek_m3_per_m3"] * volume_m3
        preplatek_total = preplatek_qty * preplatek_rate_czk_m3
        lines.append({
            "name": "Příplatek za přečerpaný m³",
            "unit": "m³",
            "coefficient": PUMP_COEFFICIENTS["preplatek_m3_per_m3"],
            "quantity": round(preplatek_qty, 4),
            "unit_price": preplatek_rate_czk_m3,
            "total_czk": round(preplatek_total, 2),
            "category": "pump",
        })

        subtotal_pump_only = sum(line["total_czk"] for line in lines)

        # ── 6/7/8. Optional bednění + chemie lines (flat fees) ─────────
        if bedneni_doprava_czk is not None:
            lines.append({
                "name": "Doprava bednění",
                "unit": "fix",
                "coefficient": None,
                "quantity": 1,
                "unit_price": float(bedneni_doprava_czk),
                "total_czk": round(float(bedneni_doprava_czk), 2),
                "category": "bedneni",
            })
        if bedneni_ztracene_dily_czk is not None:
            lines.append({
                "name": "Bednění ztracené díly",
                "unit": "fix",
                "coefficient": None,
                "quantity": 1,
                "unit_price": float(bedneni_ztracene_dily_czk),
                "total_czk": round(float(bedneni_ztracene_dily_czk), 2),
                "category": "bedneni",
            })
        if chemie_najezd_myti_czk is not None:
            lines.append({
                "name": "Chemie nájezd + mytí",
                "unit": "fix",
                "coefficient": None,
                "quantity": 1,
                "unit_price": float(chemie_najezd_myti_czk),
                "total_czk": round(float(chemie_najezd_myti_czk), 2),
                "category": "bedneni",
            })

        subtotal_with_bedneni = sum(line["total_czk"] for line in lines)
        per_m3 = subtotal_pump_only / volume_m3

        return {
            "lines": lines,
            "subtotal_pump_only_czk": round(subtotal_pump_only, 2),
            "subtotal_with_bedneni_czk": round(subtotal_with_bedneni, 2),
            "per_m3_czk": round(per_m3, 2),
            "input": {
                "volume_m3": volume_m3,
                "pump_supplier": pump_supplier,
                "cerpadlo_rate_czk_sh": cerpadlo_rate_czk_sh,
                "vibrator_rate_czk_sh": vibrator_rate_czk_sh,
                "transport_km": transport_km,
                "transport_rate_czk_km": transport_rate_czk_km,
                "preplatek_rate_czk_m3": preplatek_rate_czk_m3,
                "bedneni_doprava_czk": bedneni_doprava_czk,
                "bedneni_ztracene_dily_czk": bedneni_ztracene_dily_czk,
                "chemie_najezd_myti_czk": chemie_najezd_myti_czk,
            },
            "coefficients": dict(PUMP_COEFFICIENTS),
            "note": (
                "TOV multi-supplier pump cost. Coefficients from Registr "
                "Rozpočtů median pricing. Hourly rates vary per betonárna — "
                "override defaults for vendor-specific quotes."
            ),
            "source": "mcp_pump_calculator",
        }

    except Exception as e:
        logger.error(f"[MCP/Pump] Error: {e}")
        return {"error": str(e), "source": "mcp_pump_calculator"}
