"""
MCP Tool: create_work_breakdown

From a list of structural elements, creates a complete bill of quantities
(výkaz výměr / soupis prací) with OTSKP/ÚRS codes.

Pipeline: element classification → work decomposition (formwork, rebar,
concrete, insulation...) → OTSKP/ÚRS code matching from the database.
"""

import logging
from typing import Optional

from app.models.item_schemas import CodeStatus
from app.services.catalog_matching import classify_work_type

logger = logging.getLogger(__name__)

# Work decomposition templates per element type
# Each element generates these work items
# Each template atom carries its axis-A `vocabulary_code` as STATIC data
# (Gate 4 retrofit, ADR-009 D2 / SPEC document-to-worklist §6.3): the
# template→code mapping is a deterministic table, never an LLM pick. A
# template atom whose mapping is unclear is a VOCABULARY HOLE — stop and
# file a registration proposal; do not "pick something similar" here.
# Coverage contract: the set of codes these atoms emit must equal the set
# of `coverage: covered` codes in uwo_vocabulary.yaml (test-enforced).
WORK_TEMPLATES = {
    "default": [
        {"work": "Bednění {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV3", "vocabulary_code": "FORMWORK.PANEL.ERECT"},
        {"work": "Odbednění {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV3", "vocabulary_code": "FORMWORK.PANEL.STRIP"},
        {"work": "Výztuž {element} z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.INSTALL"},
        {"work": "Beton {element} {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV2", "vocabulary_code": "CONCRETE.POUR.STRUCTURE"},
        {"work": "Ošetřování betonu {element}", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV2", "vocabulary_code": "CONCRETE.CURING.SURFACE"},
    ],
    "pilota": [
        {"work": "Zřízení pilot svislých {concrete_class}", "unit": "m", "qty_factor": "length", "hsv": "HSV2", "vocabulary_code": "PILING.BORED.INSTALL"},
        {"work": "Výztuž pilot z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.CAGE"},
    ],
    "mostovkova_deska": [
        {"work": "Skruž pevná/posuvná pro NK", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "FORMWORK.FALSEWORK.ERECT"},
        {"work": "Bednění NK — spodní deska", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "FORMWORK.PANEL.ERECT"},
        {"work": "Výztuž NK z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.INSTALL"},
        {"work": "Beton NK {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4", "vocabulary_code": "CONCRETE.POUR.STRUCTURE"},
        {"work": "Předpínací výztuž Y1860 S7", "unit": "t", "qty_factor": "prestress_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.PRESTRESS.TENDON"},
        {"work": "Ošetřování betonu NK", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "CONCRETE.CURING.SURFACE"},
    ],
    "rimsa": [
        {"work": "Římsový vozík — montáž", "unit": "kpl", "qty_factor": "1", "hsv": "HSV4", "vocabulary_code": "FORMWORK.TRAVELER.OPERATE"},
        {"work": "Bednění říms", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "FORMWORK.PANEL.ERECT"},
        {"work": "Výztuž říms z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.INSTALL"},
        {"work": "Beton říms {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4", "vocabulary_code": "CONCRETE.POUR.STRUCTURE"},
    ],
}


# ── UWO branch registry (design.md §1 / §10 F0) ──────────────────────────────
# Monolit is ONE registered branch — the existing WORK_TEMPLATES, NOT re-cut. A
# scope routed to 'monolit' decomposes exactly as before (bit-identical). Non-
# concrete sections register their own KB-backed branches (this MVP: interier_psv,
# section "malba"). Adding a section = (router rule + KB branch + dictionary),
# without touching the concrete path or the other branches.
SECTION_MONOLIT = "monolit"
SECTION_INTERIER_PSV = "interier_psv"

# Lazy cache of KB-loaded interiér/PSV section templates: section_key → [atoms].
_INTERIER_PSV_TEMPLATES: Optional[dict] = None


def _load_interier_psv_templates() -> dict:
    """Load interiér/PSV work-atom templates from KB YAML (lazy, cached).

    Templates live in B5_tech_cards/technological_postupy/interier_psv/<section>.yaml
    (sibling of zemni_prace_bourani/). This MVP ships only `malba`; more sections
    register by dropping a YAML here — no code change. A malformed / missing dir
    yields an empty registry (honest-blank downstream), never a crash.
    """
    global _INTERIER_PSV_TEMPLATES
    if _INTERIER_PSV_TEMPLATES is not None:
        return _INTERIER_PSV_TEMPLATES

    import yaml
    from pathlib import Path

    # __file__ = app/mcp/tools/breakdown.py → parent×3 = app/
    app_dir = Path(__file__).resolve().parent.parent.parent
    psv_dir = (
        app_dir / "knowledge_base" / "B5_tech_cards"
        / "technological_postupy" / "interier_psv"
    )
    registry: dict = {}
    if psv_dir.is_dir():
        for yaml_path in sorted(psv_dir.glob("*.yaml")):
            try:
                data = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
            except Exception as e:  # pragma: no cover - defensive
                logger.warning("[UWO/PSV] Skipped %s: %s", yaml_path.name, e)
                continue
            key = data.get("section_key")
            atoms = data.get("atoms")
            if key and isinstance(atoms, list):
                registry[key] = data
    _INTERIER_PSV_TEMPLATES = registry
    return registry


def _decompose_interier_psv(name: str, elem: dict) -> list[dict]:
    """Decompose ONE interiér/PSV scope item into its PACK of work-atoms.

    Section is resolved by matching the scope name against each KB section's
    keyword set (the section_key itself + label tokens). MVP: only `malba`. Each
    atom is codeless/priceless (Pattern 15); quantity comes from scope geometry
    (area_m2) when present, else honest needs_input. Items with qty ≤ 0 from a
    `section_m2` source are kept with quantity=None + needs_input (NOT dropped) —
    the work is real even when the m² is not yet known.
    """
    registry = _load_interier_psv_templates()
    if not registry:
        return []

    lname = (name or "").lower()
    # Pick the section whose key/label appears in the scope name.
    section = None
    for key, data in registry.items():
        label = (data.get("label_cs") or "").lower()
        if key in lname or any(tok and tok in lname for tok in label.replace("—", " ").split()):
            section = data
            break
    if section is None:
        return []

    area_m2 = elem.get("area_m2") or 0
    items: list[dict] = []
    for atom in section.get("atoms", []):
        qty_source = atom.get("qty_source")
        if qty_source == "section_m2":
            quantity = round(area_m2, 2) if area_m2 else None
            provenance = "derived_from_scope" if area_m2 else "needs_input"
        elif qty_source == "fixed_1":
            quantity = 1
            provenance = atom.get("quantity_provenance", "needs_input")
        else:
            quantity = None
            provenance = "needs_input"

        items.append({
            "work_description": atom["work"],
            "unit": atom.get("unit", "m2"),
            "quantity": quantity,
            "quantity_provenance": provenance,
            "section_code": SECTION_INTERIER_PSV,
            "hsv_section": "PSV",
            "element_name": name,
            "element_type": "interier_psv",
            # axis-A code — static per-atom mapping carried by the KB YAML
            "vocabulary_code": atom.get("vocabulary_code"),
            "_source": f"element:{name} / psv_template:{section.get('section_key')}:{atom['key']}",
            # reserved catalog/price slots — bound later by the ÚRS adapter
            "urs_code": None,
            "unit_price_czk": None,
            "code_status": CodeStatus.NOT_CALCULATED.value,
            "calc": None,
            "calc_status": "not_calculated",
            "calc_warnings": [],
        })
    return items


# Work-first contract (W2/PR2 — Pattern 15). `mode` is a first-class parameter.
#   work_first        — produce a frozen, code-less, price-less work list. Catalog
#                       binding is a SEPARATE stage (CATALOG_BINDING) behind the
#                       STOP gate. This is the default (Pattern 15).
#   work_with_catalog — legacy single-pass: attach OTSKP codes + prices inline.
# `catalog="none"` is an accepted alias that forces work_first regardless of mode.
MODE_WORK_FIRST = "work_first"
MODE_WORK_WITH_CATALOG = "work_with_catalog"


# ── Catalog binding policy (Work-First / Catalog-Last) ────────────────────────
# Confidence floor for a match to be BOUND to a work row. Below it the row stays
# code-less with an honest "no reliable match" note rather than surfacing a
# plausible-but-wrong code.
OTSKP_CODE_BINDING_FLOOR = 0.60  # calibrated on SO 206 (n=1); revisit as the corpus grows

# Catalog-aware bundling declaration. In OTSKP D6, formwork (bednění/odbednění)
# and concrete curing (ošetřování) of monolithic members are PRICED INSIDE the
# concrete item — they have no standalone code. This is a property of the
# CATALOG, not a global rule: ÚRS/RTS price each work separately, so their sets
# are empty and every work row is matched. A bundled work-type binds to a
# deterministic None with reason "zahrnuto v betonu dle OTSKP" (a RULE at
# confidence 1.0 — NOT a floor-driven "nenalezeno"). Skruž for NK is its OWN
# work-type (not bedneni) and is therefore matched, not bundled.
CATALOG_BUNDLING: dict[str, set[str]] = {
    "otskp": {"bedneni", "osetrovani"},
    "urs": set(),
    "rts": set(),
}

# Canonical work verb per work-type axis. Used to build a clean search query
# (work verb + element noun) instead of the slash-labelled work_description,
# which poisons BOTH the work-type and element-family detectors.
WORK_VERB_CANON: dict[str, str] = {
    "beton": "beton",
    "vyztuz": "výztuž",
    "predpinaci": "předpínací výztuž",
    "skruz": "skruž",
    "bedneni": "bednění",
    "izolace": "izolace",
}

# Element noun per element type, in BOTH grammatical cases the OTSKP catalog uses
# by work-type: concrete codes are titled by the element in the NOMINATIVE
# ("ZÁKLADY ZE ŽELEZOBETONU", "MOSTNÍ OPĚRY A KŘÍDLA"), reinforcement codes are
# "VÝZTUŽ <element-GENITIVE>" ("VÝZTUŽ ZÁKLADŮ", "VÝZTUŽ MOSTNÍCH OPĚR"). The query
# must mirror that convention or it mis-ranks (live: nominative "základy" for
# výztuž pulled niche 74A310 over the real 272364; genitive "základů" for beton
# pulled telescopic-mast junk over 27232). Nominative is ALSO what the family-axis
# gate needs for opěry (genitive "opěr" suppresses to family 'jine'); for
# foundations the 'základ' canon classifies in both cases.
# TODO(single-source): migrate to `otskp_query_noun_{nom,gen}` element-type fields.
_OTSKP_QUERY_NOUN: dict[str, dict[str, str]] = {
    # OTSKP prices abutments + wings in ONE basket ("MOSTNÍ OPĚRY A KŘÍDLA",
    # 333xx) — so opěry query the SAME combined phrase as křídla. The "a křídel"
    # tokens also outrank the přechod-desek false-friend ("VÝZTUŽ PŘECHOD DESEK
    # MOSTNÍCH OPĚR") that hijacks a bare-genitive "mostních opěr".
    "opery_ulozne_prahy": {"nom": "mostní opěry a křídla", "gen": "mostních opěr a křídel"},
    "kridla_opery": {"nom": "mostní opěry a křídla", "gen": "mostních opěr a křídel"},
    "zaklady_oper": {"nom": "základy", "gen": "základů"},
    "zaklady_piliru": {"nom": "základy", "gen": "základů"},
    "driky_piliru": {"nom": "mostní pilíře", "gen": "mostních pilířů"},
    "rimsa": {"nom": "římsy", "gen": "říms"},
    "mostovkova_deska": {"nom": "mostovka nosná konstrukce", "gen": "mostovky"},
}

# Work-types whose OTSKP title governs the element GENITIVE ("VÝZTUŽ <gen>").
_GENITIVE_WORK_TYPES = {"vyztuz", "predpinaci"}


def _canonical_query(work_type: str, element_type: str) -> str:
    """Clean search query: canonical work verb + element noun in the catalog's
    grammatical case for this work-type (genitive for výztuž/předpětí, nominative
    otherwise). Replaces the slash-labelled work_description that mis-fires the
    work-type + element-family detectors. Falls back to the element label's head
    (before the slash) for unmapped types.
    """
    from app.mcp.tools.classifier import ELEMENT_TYPES

    case = "gen" if work_type in _GENITIVE_WORK_TYPES else "nom"
    forms = _OTSKP_QUERY_NOUN.get(element_type)
    if forms:
        noun = forms[case]
    else:
        label = (ELEMENT_TYPES.get(element_type) or {}).get("label_cs", "")
        noun = label.split("/")[0].strip() if label else element_type.replace("_", " ")
    verb = WORK_VERB_CANON.get(work_type, work_type)
    suffix = " z oceli" if work_type == "vyztuz" else ""
    return f"{verb} {noun}{suffix}".strip()


async def _attach_catalog_codes(items: list[dict], catalog: str) -> list[dict]:
    """Catalog-binding step, DECOUPLED from work decomposition.

    Mutates each item in place. Runs only in mode=work_with_catalog (work_first
    ends on the frozen code-less list). Two binding outcomes per row:

      * bundled work-type (per CATALOG_BUNDLING) → deterministic None +
        "zahrnuto v betonu dle OTSKP" (code_status="bundled" — a RULE, not a miss);
      * otherwise → a clean canonical query routed through the SAME chain as
        find_otskp_code (retrieve → match_catalog two-axis gate → honest
        confidence), bound only when the top candidate clears
        OTSKP_CODE_BINDING_FLOOR; else code-less "no reliable match".

    Single source of truth: matching goes through find_otskp_code/match_catalog,
    never the naive whole-label catalog.search() — that path surfaced speed bumps
    / lawn care / roof formwork for abutment concrete (the SO-206 regression).
    """
    # ── ÚRS branch (gap closure, FINDINGS §4 / CONTRACT §5) ──────────────────
    # Previously this early-returned for catalog != otskp/both — so catalog='urs'
    # produced a work-first list with NO binding (find_urs_code was never called
    # from the atomizer). The catalog-binding adapter now binds each work-atom to
    # ÚRS (privátní zakázka) via find_urs_code, deriving the status-enum from
    # match_kind. Signatures untouched; the adapter is internal (design.md §5.3).
    if catalog == "urs":
        from app.mcp.tools.catalog_binding_adapter import attach_urs_codes

        await attach_urs_codes(items, procurement_mode="privatni")
        return items

    if catalog not in ("otskp", "both"):
        return items

    from app.mcp.tools.otskp import find_otskp_code

    bundled = CATALOG_BUNDLING.get("otskp", set())
    for item in items:
        work_type = classify_work_type(item.get("work_description", ""))
        if work_type in bundled:
            item["otskp_code"] = None
            item["unit_price_czk"] = None
            item["total_price_czk"] = None
            item["code_status"] = CodeStatus.BUNDLED.value
            item["code_note"] = "zahrnuto v betonu dle OTSKP"
            item["code_confidence"] = 1.0
            continue

        query = _canonical_query(work_type, item.get("element_type", "jine"))
        item["code_query"] = query
        result = await find_otskp_code(query, max_results=5)
        candidates = result.get("results", [])
        top = candidates[0] if candidates else None

        if top and (top.get("confidence") or 0.0) >= OTSKP_CODE_BINDING_FLOOR:
            item["otskp_code"] = top["code"]
            item["otskp_description"] = top["description"]
            item["unit_price_czk"] = top.get("unit_price_czk")
            item["total_price_czk"] = round((top.get("unit_price_czk") or 0.0) * item["quantity"], 0)
            # F3: OTSKP text-search top above floor = `candidate` (unified with the
            # catalog-binding adapter, which calls the identical operation
            # `candidate`). `exact` stays reserved for a deterministic DB code hit.
            item["code_status"] = CodeStatus.CANDIDATE.value
            item["code_confidence"] = top.get("confidence")
        else:
            item["otskp_code"] = None
            item["unit_price_czk"] = None
            item["total_price_czk"] = None
            item["code_status"] = CodeStatus.NOT_VERIFIED.value  # F3: was "no_match"
            item["code_note"] = "v OTSKP nenalezena spolehlivá shoda"
            item["code_confidence"] = top.get("confidence") if top else 0.0
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

    Pipeline: element classification (23 types) → work decomposition (formwork
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
        from app.mcp.tools.scope_router import route_scope

        all_items = []
        unresolved: list[dict] = []  # honest-blank scopes (no template for section)

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

            # Step 1: Resolve element type. An EXPLICIT `element_type` on the
            # input wins over name-classification (#1b — honor explicit
            # element_type; confidence ladder: caller-provided > classifier).
            # Closes BUGS#5(1): a passed element_type was silently re-classified
            # from the name. Falls back to _classify when the field is absent or
            # not a known type (object_type stays authoritative for the
            # bridge/building/wall axis on that path).
            explicit_etype = elem.get("element_type")
            if explicit_etype and explicit_etype in ELEMENT_TYPES:
                etype = explicit_etype
                classification = {
                    "element_type": etype,
                    "confidence": 0.99,
                    "classification_source": "explicit_input",
                }
            else:
                classification = _classify(name, object_code=so_code, object_type=object_type)
                etype = classification["element_type"]
            profile = ELEMENT_TYPES.get(etype, ELEMENT_TYPES["jine"])

            # Step 1b: Scope-Router (UWO Stage 1) — decide the branch. The concrete
            # classifier is AUTHORITATIVE for "is this a concrete element?": a
            # confident structural type (etype != 'jine') ALWAYS takes the monolit
            # branch, so every existing concrete caller stays bit-identical and
            # "Schodiště" (a real concrete stair) is never mis-routed to PSV. The
            # router only diverts when the classifier falls back to 'jine' AND the
            # scope is NOT monolit-positive (a 'jine' element whose name still
            # carries a monolit keyword, e.g. "Beton XY", keeps the concrete-default
            # template — unchanged). For a non-monolit 'jine' scope:
            #   * router 'interier_psv' + a matching KB section → PSV branch (pack);
            #   * otherwise → honest-blank (NO monolit atoms — the cure for
            #     "sebevědomě-špatně"; an unknown scope like fotovoltaika yields no
            #     concrete rows).
            if etype == "jine":
                route = route_scope(name)
                if route["section_code"] != SECTION_MONOLIT:
                    if route["section_code"] == SECTION_INTERIER_PSV:
                        psv_items = _decompose_interier_psv(name, elem)
                        if psv_items:
                            all_items.extend(psv_items)
                            continue
                    # No branch / no template for this section → honest-blank.
                    unresolved.append({
                        "element_name": name,
                        "section_code": route["section_code"],
                        "scope_guard_status": "no_template_for_section",
                        "_source": f"element:{name} / scope_router:{route['matched_rule']}",
                    })
                    continue

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
                #
                # The row contract is designed ONCE here so downstream stages fill
                # existing keys rather than re-cutting it:
                #   - classification provenance (confidence + source) is stamped
                #     where classification actually drives the item — so it is no
                #     longer dropped at the recipe's atomize seam.
                #   - reserved catalog/price slots (otskp_code / unit_price_czk /
                #     total_price_czk) start None; CATALOG_BINDING / PRICING fill
                #     the SAME keys (the work_with_catalog path below already does).
                #   - calc slot starts honest-blank (calc=None,
                #     calc_status="not_calculated"); the recipe's calculate step
                #     fills it for the elements the engine actually computes.
                item = {
                    "work_description": work_name,
                    "unit": tmpl["unit"],
                    "quantity": round(qty, 2),
                    "hsv_section": tmpl.get("hsv", ""),
                    "element_name": name,
                    "element_type": etype,
                    # axis-A code — static template mapping, deterministic 1.0
                    # (Gate 4; stage-5 Bind maps it, SPEC §5.1/§6.3)
                    "vocabulary_code": tmpl.get("vocabulary_code"),
                    "_source": f"element:{name} / template:{tmpl['work']}",
                    # classification provenance (separate from any calc confidence)
                    "classification_confidence": classification.get("confidence"),
                    "classification_source": classification.get("classification_source"),
                    # reserved slots — CATALOG_BINDING / PRICING (not filled here)
                    "otskp_code": None,
                    "unit_price_czk": None,
                    "total_price_czk": None,
                    # calc enrichment — honest-blank until the engine computes it
                    "calc": None,
                    "calc_status": "not_calculated",
                    "calc_warnings": [],
                }
                all_items.append(item)

        # Work-first decoupling (Pattern 15): the breakdown ends on the frozen
        # work list. Catalog codes/prices are attached ONLY in the explicit
        # work_with_catalog mode (and only for real catalogs). catalog="none"
        # forces work-first regardless of `mode`.
        work_first = mode != MODE_WORK_WITH_CATALOG or catalog == "none"
        if not work_first:
            await _attach_catalog_codes(all_items, catalog)

        # Group by HSV section
        sections = {}
        for item in all_items:
            sec = item.get("hsv_section", "Other")
            if sec not in sections:
                sections[sec] = []
            sections[sec].append(item)

        # `total_price_czk` is a reserved slot that starts None (filled by PRICING);
        # coalesce so the sum works whether it is unset, None, or a real price.
        total_price = sum(it.get("total_price_czk") or 0 for it in all_items)

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
            # UWO scope-guard (design.md §3.1): scopes with no branch/template land
            # here as honest-blank instead of getting confidently-wrong monolit atoms.
            "unresolved": unresolved,
            "scope_guard_status": "no_template_for_section" if unresolved else "ok",
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
