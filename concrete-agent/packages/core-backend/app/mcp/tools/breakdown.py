"""
MCP Tool: create_work_breakdown

From a list of structural elements, creates a complete bill of quantities
(výkaz výměr / soupis prací) with OTSKP/ÚRS codes.

Pipeline: element classification → work decomposition (formwork, rebar,
concrete, insulation...) → OTSKP/ÚRS code matching from the database.
"""

import logging
import re
from typing import Optional

from app.models.item_schemas import CodeStatus, ItemQuantityStatus
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
        {"work": "Ošetřování betonu {element}", "unit": "m²", "qty_factor": "curing_area", "hsv": "HSV2", "vocabulary_code": "CONCRETE.CURING.SURFACE"},
    ],
    "pilota": [
        {"work": "Zřízení pilot svislých {concrete_class}", "unit": "m", "qty_factor": "length", "hsv": "HSV2", "vocabulary_code": "PILING.BORED.INSTALL"},
        {"work": "Výztuž pilot z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.CAGE"},
    ],
    "mostovkova_deska": [
        # Skruž ≠ bednění: FORMWORK.FALSEWORK.ERECT is priced per m³ of
        # obestavěný prostor (OTSKP canon, vocabulary v1.2 fix) — the atom's
        # MJ must match its vocabulary_code's unit_canonical (unit-parity
        # test-enforced; finding #11 on #1510: it silently emitted m²).
        {"work": "Skruž pevná/posuvná pro NK", "unit": "m³", "qty_factor": "falsework_volume", "hsv": "HSV4", "vocabulary_code": "FORMWORK.FALSEWORK.ERECT"},
        {"work": "Bednění NK — spodní deska", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "FORMWORK.PANEL.ERECT"},
        {"work": "Výztuž NK z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.INSTALL"},
        {"work": "Beton NK {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4", "vocabulary_code": "CONCRETE.POUR.STRUCTURE"},
        {"work": "Předpínací výztuž Y1860 S7", "unit": "t", "qty_factor": "prestress_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.PRESTRESS.TENDON"},
        {"work": "Ošetřování betonu NK", "unit": "m²", "qty_factor": "curing_area", "hsv": "HSV4", "vocabulary_code": "CONCRETE.CURING.SURFACE"},
    ],
    "rimsa": [
        {"work": "Římsový vozík — montáž", "unit": "kpl", "qty_factor": "1", "hsv": "HSV4", "vocabulary_code": "FORMWORK.TRAVELER.OPERATE"},
        {"work": "Bednění říms", "unit": "m²", "qty_factor": "formwork_area", "hsv": "HSV4", "vocabulary_code": "FORMWORK.PANEL.ERECT"},
        {"work": "Výztuž říms z oceli B500B", "unit": "t", "qty_factor": "rebar_tons", "hsv": "HSV4", "vocabulary_code": "REINFORCEMENT.REBAR.INSTALL"},
        {"work": "Beton říms {concrete_class}", "unit": "m³", "qty_factor": "volume", "hsv": "HSV4", "vocabulary_code": "CONCRETE.POUR.STRUCTURE"},
    ],
    # Prefabrikovaný uzavřený rám / tubus (element 24, task v2.1 §2.6 / AC2):
    # ŽÁDNÉ bednění, žádné betonářské fáze, žádná on-site výztuž (dílce jsou
    # vyztužené z výroby). Selected by construction_mode='prefab' (explicit
    # input > classifier signal) — monolitický tubus keeps the "default"
    # template with the §2.10 honest-blank guards.
    #
    # Review 2026-07-17 finding 5 (Alexander GO): the CARRIER atom «Dodávka a
    # montáž dílců» (m³ — OTSKP 3891x canon, pieces = param per rule 4) holds
    # the dominant cost; the zálivka note points to THIS in-list row, never
    # into the void. Names deliberately carry NO «— {element}» suffix — the
    # polluted label («Uzavřený rám (tubus) — …») was the root of the
    # confident-nonsense binds on BOTH catalog branches (finding 4).
    "uzavreny_ram_tubus__prefab": [
        {"work": "Dodávka a montáž prefabrikovaných rámových dílců", "unit": "m³", "qty_factor": "dilce_volume", "hsv": "HSV2", "vocabulary_code": "PRECAST.FRAME.INSTALL"},
        {"work": "Zálivka spár mezi prefabrikovanými dílci {concrete_class}", "unit": "m³", "qty_factor": "grout_volume", "hsv": "HSV2", "vocabulary_code": "CONCRETE.JOINT.GROUT"},
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

        # SPEC §6.3 quantity_status — uniform across branches (stage-3 Quantify).
        # `quantity_provenance` stays (shipped shape); status is the SPEC axis:
        # a missing výměra is an explicit NEPOČÍTÁNO with a reason (§6.4.2).
        if quantity is None:
            q_status = ItemQuantityStatus.nepocitano("chybí výměra z podkladu")
            q_formula = "m² sekce nejsou k dispozici (vstup area_m2 chybí)"
        elif qty_source == "fixed_1":
            q_status = ItemQuantityStatus.COMPUTED.value
            q_formula = "paušál: 1 komplet"
        else:
            q_status = ItemQuantityStatus.FROM_INPUT.value
            q_formula = f"m² ze scope geometrie: {quantity} (vstup area_m2)"

        items.append({
            "work_description": atom["work"],
            "unit": atom.get("unit", "m2"),
            "quantity": quantity,
            "quantity_status": q_status,
            "quantity_formula": q_formula,
            "quantity_provenance": provenance,
            "section_code": SECTION_INTERIER_PSV,
            "hsv_section": "PSV",
            "element_name": name,
            "element_type": "interier_psv",
            # axis-A code — static per-atom mapping carried by the KB YAML
            "vocabulary_code": atom.get("vocabulary_code"),
            # SPEC §6.3 item contract: emitted by a BUILT branch (§6.4.3)
            "coverage": "covered",
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

# Prefab tubus (element 24, §2.7-analog — catalog-TRUE per the OTSKP spec of
# 389125, verbatim: «dodání dílce … včetně komplexní technologie výroby a
# montáže dílců» + «výplň, těsnění a tmelení spár a spojů»).
#
# Review 2026-07-17 (findings 1/2/7, Alexander GO): keyed off the item's
# deterministic `vocabulary_code` + element_type + construction_mode — NEVER
# off a lexical re-derivation of the rendered Czech string (the retired
# global WORK_TYPE_RULES stems silently re-bucketed candidates on every
# element type). Confidence ladder: code 1.0 > lexika. The construction_mode
# key keeps a FUTURE monolithic-tubus grout atom (working joint) out of this
# bundle — a monolith pour has no dílce item to hide costs in.
_TUBUS_PREFAB_CARRIER_CODE = "PRECAST.FRAME.INSTALL"
_TUBUS_PREFAB_GROUT_CODE = "CONCRETE.JOINT.GROUT"
# Deterministic carrier query (live-ranked 38912 «MOSTNÍ RÁMOVÉ KONSTRUKCE
# Z DÍLCŮ ŽELEZOBETONOVÝCH» @0.9) — the carrier row CARRIES the price the
# grout note points to.
_TUBUS_PREFAB_CARRIER_QUERY = "mostní rámové konstrukce z dílců železobetonových"
_TUBUS_PREFAB_GROUT_NOTE = (
    "zahrnuto v položce „Dodávka a montáž prefabrikovaných rámových dílců“ "
    "(OTSKP 3891x — výplň, těsnění a tmelení spár v ceně dílce dle "
    "technické specifikace)"
)

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
    # Element 24 (live find 2026-07-17): the label-head fallback «Uzavřený rám
    # (tubus) — podchod» poisoned the fulltext — prod bound výztuž to 15411
    # «ZAJIŠTĚNÍ VÝRUBU TUNELU…» (60 390 Kč/t) and beton to 743742 «ROZVADĚČ…»
    # at conf 0.78. OTSKP titles the family «MOSTNÍ RÁMOVÉ KONSTRUKCE»:
    # beton 389325 «…ZE ŽELEZOBETONU C30/37» (nominative carries the material
    # so the monolith item outranks the prefab 3891x «Z DÍLCŮ» sibling on the
    # code-asc tie-break); výztuž 389365 «VÝZTUŽ MOSTNÍ RÁMOVÉ KONSTRUKCE…»
    # (genitive surface form equals the nominative stem).
    "uzavreny_ram_tubus": {
        "nom": "mostní rámové konstrukce ze železobetonu",
        "gen": "mostní rámové konstrukce",
    },
}

# Work-types whose OTSKP title governs the element GENITIVE ("VÝZTUŽ <gen>").
_GENITIVE_WORK_TYPES = {"vyztuz", "predpinaci"}


# Label-head pollution (floor hardening, ratified 2026-07-17): a fallback noun
# carrying parenthesis / dash / comma noise is NOT a trustworthy catalog
# query — fulltext over it produced the confident-nonsense class (tubus →
# tunnel-excavation steel at conf 0.78). A polluted fallback must yield an
# honest no-query (binding → not_verified + reason), never a confident code.
# Review finding 6: ALL dash forms (ASCII '-', en '–', em '—') — the first
# cut caught only the em-dash. Deliberately NOT delegated to
# element_name_normalizer._strip_modifiers: its tail-cut neither handles
# parentheticals nor is signal-safe (BACKLOG normalizer-sweep-findings —
# tail-cut swallows «prostý beton» class signals); a second normalization
# vocabulary here is accepted with this note.
_POLLUTED_NOUN_RE = re.compile(r"[()–—,;:-]")

# Grandfathered polluted fallbacks (sequential discipline: their binding
# behavior must NOT silently change under this micro-PR's flag). These four
# OLD types ride a parenthesized label head today («Sloup (pozemní)», «Základy
# (pozemní)», «Šachta (výtahová, technická)», «Gabionová zeď (drátokoš —
# nebetonová)») — candidates for canonical nouns in a follow-up (BACKLOG
# `otskp-binding-fallback-heads`, sibling of the normalizer-sweep table:
# same defect family «мусор на входе → уверенность на выходе»).
_POLLUTED_FALLBACK_GRANDFATHERED = frozenset({
    "sloup", "zaklady", "sachta", "gabionova_zed",
})


def _canonical_query(work_type: str, element_type: str) -> Optional[str]:
    """Clean search query: canonical work verb + element noun in the catalog's
    grammatical case for this work-type (genitive for výztuž/předpětí, nominative
    otherwise). Replaces the slash-labelled work_description that mis-fires the
    work-type + element-family detectors. Falls back to the element label's head
    (before the slash) for unmapped types; a POLLUTED fallback head (parens/
    dashes — no canonical catalog noun exists for the type) returns None so the
    caller degrades to an honest not_verified instead of querying garbage.
    """
    from app.mcp.tools.classifier import ELEMENT_TYPES

    case = "gen" if work_type in _GENITIVE_WORK_TYPES else "nom"
    forms = _OTSKP_QUERY_NOUN.get(element_type)
    if forms:
        noun = forms[case]
    else:
        label = (ELEMENT_TYPES.get(element_type) or {}).get("label_cs", "")
        noun = label.split("/")[0].strip() if label else element_type.replace("_", " ")
        if (
            _POLLUTED_NOUN_RE.search(noun)
            and element_type not in _POLLUTED_FALLBACK_GRANDFATHERED
        ):
            return None
    verb = WORK_VERB_CANON.get(work_type, work_type)
    suffix = " z oceli" if work_type == "vyztuz" else ""
    return f"{verb} {noun}{suffix}".strip()


def _mark_binding(
    item: dict, *, status: str, note: Optional[str] = None,
    confidence: float = 0.0,
) -> None:
    """One terminal shape for a no-code binding outcome (review 2026-07-17
    finding 10 — was 3 copy-pasted blocks; a 4th sibling lives in
    catalog_binding_adapter.attach_urs_codes, out of this module's scope)."""
    item["otskp_code"] = None
    item["unit_price_czk"] = None
    item["total_price_czk"] = None
    item["code_status"] = status
    if note is not None:
        item["code_note"] = note
    item["code_confidence"] = confidence


_POLLUTED_QUERY_NOTE = (
    "typ nemá kanonické katalogové substantivum a label-fallback "
    "je zamusořený — dotaz se nevydává, kód ověřte ručně"
)


async def _attach_catalog_codes(items: list[dict], catalog: str) -> list[dict]:
    """Catalog-binding step, DECOUPLED from work decomposition.

    Mutates each item in place. Runs only in mode=work_with_catalog (work_first
    ends on the frozen code-less list). Binding outcomes per row:

      * bundled work-type (per CATALOG_BUNDLING) → deterministic None +
        "zahrnuto v betonu dle OTSKP" (code_status="bundled" — a RULE, not a miss);
      * prefab-tubus grout atom (keyed by vocabulary_code + construction_mode)
        → deterministic bundle pointing to the IN-LIST carrier row;
      * polluted fallback query (None) → honest not_verified, no query issued;
      * otherwise → a clean canonical query routed through the SAME chain as
        find_otskp_code (retrieve → match_catalog two-axis gate → honest
        confidence), bound only when the top candidate clears
        OTSKP_CODE_BINDING_FLOOR; else code-less "no reliable match".

    Single source of truth: matching goes through find_otskp_code/match_catalog,
    never the naive whole-label catalog.search() — that path surfaced speed bumps
    / lawn care / roof formwork for abutment concrete (the SO-206 regression).
    """
    # ── ÚRS branch (gap closure, FINDINGS §4 / CONTRACT §5) ──────────────────
    # The catalog-binding adapter binds each work-atom to ÚRS (privátní
    # zakázka) via find_urs_code, deriving the status-enum from match_kind.
    #
    # Review 2026-07-17 finding 4: the pollution guard applies HERE TOO (it
    # used to sit below this early-return, leaving the confident-nonsense
    # class wide open on ÚRS). Catalog-aware discipline (Alexander verdict):
    # the OTSKP prefab bundle is an OTSKP-spec rule (389125) and is NOT
    # inherited by ÚRS — prefab atoms go through the honest per-row search
    # (their names carry no polluted «— {element}» suffix since this review).
    if catalog == "urs":
        from app.mcp.tools.catalog_binding_adapter import attach_urs_codes

        searchable: list[dict] = []
        for item in items:
            wt = classify_work_type(item.get("work_description", ""))
            if _canonical_query(wt, item.get("element_type", "jine")) is None:
                _mark_binding(
                    item, status=CodeStatus.NOT_VERIFIED.value,
                    note=_POLLUTED_QUERY_NOTE, confidence=0.0,
                )
            else:
                searchable.append(item)
        await attach_urs_codes(searchable, procurement_mode="privatni")
        return items

    if catalog not in ("otskp", "both"):
        return items

    from app.mcp.tools.otskp import find_otskp_code

    bundled = CATALOG_BUNDLING.get("otskp", set())
    for item in items:
        work_type = classify_work_type(item.get("work_description", ""))
        if work_type in bundled:
            _mark_binding(
                item, status=CodeStatus.BUNDLED.value,
                note="zahrnuto v betonu dle OTSKP", confidence=1.0,
            )
            continue

        # ── Prefab tubus — vocabulary-code-keyed handling (review findings
        # 1/2/5/7): the atom's deterministic vocabulary_code decides, never a
        # lexical re-derivation of the rendered string. construction_mode in
        # the key keeps monolithic-tubus grout atoms OUT of the prefab bundle.
        tubus_prefab_atom = (
            item.get("element_type") == "uzavreny_ram_tubus"
            and item.get("construction_mode") == "prefab"
        )
        if tubus_prefab_atom and item.get("vocabulary_code") == _TUBUS_PREFAB_GROUT_CODE:
            # Zálivka sits INSIDE the dílce item per the 389125 spec — the
            # note points at the CARRIER row, which exists in this list
            # (finding 5: a note must never point into the void).
            _mark_binding(
                item, status=CodeStatus.BUNDLED.value,
                note=_TUBUS_PREFAB_GROUT_NOTE, confidence=1.0,
            )
            continue

        if tubus_prefab_atom and item.get("vocabulary_code") == _TUBUS_PREFAB_CARRIER_CODE:
            # The carrier row PRICES the element — deterministic query into
            # the 3891x family (live-ranked @0.9), then the normal floor flow.
            query: Optional[str] = _TUBUS_PREFAB_CARRIER_QUERY
        else:
            query = _canonical_query(work_type, item.get("element_type", "jine"))
        item["code_query"] = query
        if query is None:
            # Floor hardening (2026-07-17): no canonical noun + polluted label
            # fallback → there is NO trustworthy query. Honest no-bind beats a
            # confident nonsense code (the tubus→tunnel class).
            _mark_binding(
                item, status=CodeStatus.NOT_VERIFIED.value,
                note=_POLLUTED_QUERY_NOTE, confidence=0.0,
            )
            continue
        result = await find_otskp_code(query, max_results=5)
        candidates = result.get("results", [])
        top = candidates[0] if candidates else None

        if top and (top.get("confidence") or 0.0) >= OTSKP_CODE_BINDING_FLOOR:
            item["otskp_code"] = top["code"]
            item["otskp_description"] = top["description"]
            item["unit_price_czk"] = top.get("unit_price_czk")
            # NEPOČÍTÁNO rows carry quantity=None — a code candidate is still
            # useful, but a total from None would TypeError (latent finding 3
            # of the #1510 review); the total stays honestly None.
            item["total_price_czk"] = (
                round((top.get("unit_price_czk") or 0.0) * item["quantity"], 0)
                if item["quantity"] is not None else None
            )
            # F3: OTSKP text-search top above floor = `candidate` (unified with the
            # catalog-binding adapter, which calls the identical operation
            # `candidate`). `exact` stays reserved for a deterministic DB code hit.
            item["code_status"] = CodeStatus.CANDIDATE.value
            item["code_confidence"] = top.get("confidence")
        else:
            _mark_binding(
                item, status=CodeStatus.NOT_VERIFIED.value,  # F3: was "no_match"
                note="v OTSKP nenalezena spolehlivá shoda",
                confidence=top.get("confidence") if top else 0.0,
            )
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
            - length_m: Element run length in m — linear elements (walls,
              bridges, blinding strips): formwork = 2 faces × length ×
              height/thickness (quantity_status 'computed' instead of the
              geometric 'assumed' estimate)
            - exposure: Exposure class, e.g. 'XF4'
            - is_prestressed: boolean (triggers prestress steel item)
            - rebar_tons: Rebar mass in tons (estimated from volume if missing)
            - construction_mode: 'monolit' (default) | 'prefab' — for
              uzavreny_ram_tubus a 'prefab' element yields an assembly-only
              plan, never concrete-pour atoms: a CARRIER row «Dodávka a
              montáž prefabrikovaných dílců» (m³ = volume_m3, the OTSKP 3891x
              pricing canon; missing → honest NEPOČÍTÁNO) + a zálivka row
              bundled into the carrier per the 389125 spec
            - pieces_count: Number of precast units (prefab tubus only) —
              second dimension per vocabulary rule 4: echoed in the carrier's
              quantity_formula, never a substitute for volume_m3
            - grout_volume_m3: Joint-grout volume in m³ (prefab tubus only;
              missing → honest NEPOČÍTÁNO — joint detail is vendor-specific)

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
                        # SPEC document-to-worklist §6.4.3: a branch that is not
                        # built returns not_covered_branch — never a silent
                        # fallback to the concrete decomposition.
                        "coverage": "not_covered_branch",
                        "_source": f"element:{name} / scope_router:{route['matched_rule']}",
                    })
                    continue

            # Step 2: Get quantities WITH provenance (stage-3 Quantify, SPEC
            # document-to-worklist §6.3 `quantity_status` + invariant §6.4.2).
            # Rule (SO-250 reality-check, 2026-07-14): a caller-provided number
            # ALWAYS beats a template default; a default is only a fallback and
            # must be labeled `assumed` — it must never look like a fact.
            # Status values: `from_input` = taken verbatim from the caller's
            # element field (the tool cannot attest soupis provenance — an
            # upstream joiner that knows may upgrade this to `from_soupis`);
            # `computed` = deterministic formula over caller values;
            # `assumed` = element-type default estimate.
            # Stage-1 extract ships volume_m3=None (volumes are stage 2) —
            # coalesce to 0 so the qty<=0 skip applies cleanly.
            volume = elem.get("volume_m3", 0) or 0

            height_provided = elem.get("height_m") is not None
            height = elem["height_m"] if height_provided else 3.0
            # Linear-element geometry (SO-250 round-3): zárubní/opěrné zdi and
            # bridges are LINEAR by definition — when the document carries the
            # length, guessing the footprint shape is just a geometric default,
            # and input beats default applies to geometry too.
            length_provided = (elem.get("length_m") or 0) > 0
            length_m = elem.get("length_m") or 0
            concrete_class = elem.get("concrete_class", "C30/37")

            rebar_provided = elem.get("rebar_tons") is not None
            if rebar_provided:
                rebar_tons = elem["rebar_tons"] or 0
                rebar_status = ItemQuantityStatus.FROM_INPUT.value
                rebar_formula = f"výztuž z podkladu: {rebar_tons} t (vstup rebar_tons)"
            else:
                rebar_tons = volume * profile["rebar_kg_m3"] / 1000 if volume else 0
                rebar_status = ItemQuantityStatus.ASSUMED.value
                rebar_formula = (
                    f"odhad: {volume} m³ × {profile['rebar_kg_m3']} kg/m³ (typový default)"
                )

            # Formwork (bednění) vs curing (ošetřování) are DIFFERENT physical
            # surfaces (review #1510 finding 2): a slab/blinding cures its TOP
            # (footprint = V / tl.) while its formwork is the side strip; a wall
            # cures the same faces the formwork covered. Each gets its own
            # qty_factor ('formwork_area' / 'curing_area') — never shared.
            #
            # Provenance rule (SPEC §6.3, ratified after review #1510 finding 4):
            # MIXED provenance = the WORSE status. `computed` only when EVERY
            # factor of the formula comes from the input/document; any defaulted
            # factor (e.g. thickness) downgrades the row to `assumed`.
            #
            # Orientation decides FIRST (finding 1): the linear-wall formula
            # 2×L×H must never capture a horizontal element — a deck's height_m
            # is not a face height, and 2×L×H on a slab is nonsense labeled
            # `computed`, the exact sebevědomě-špatně class this axis fights.
            blinding = etype == "podkladni_beton"
            horizontal = profile["orientation"] == "horizontal"
            # §2.10 / AC14 — the uzavřený rám (tubus) is EXCLUDED from the generic
            # V/thickness breakdown heuristics (soffit V/0.25, wall V/0.3×2). Those
            # overstate a closed frame (the 450 mm strop's soffit ~1.8×) and their
            # defects are pinned by the parity test (#1514) — they must NOT be
            # inherited by the new type. The authoritative tubus geometry lives in
            # the calculator engine (runTubusPath), from the explicit tubus_* fields.
            # Here (soupis path) tubus quantities come ONLY from caller-provided
            # numbers (area_m2 / volume_m3 / rebar_tons); a missing formwork/curing
            # area is an honest NEPOČÍTÁNO, never a fabricated default.
            tubus = etype == "uzavreny_ram_tubus"
            # Slab thickness for horizontal surfaces: on blinding, a small
            # height_m (≤ 0.5) is read as the slab thickness — interim carrier
            # until an explicit thickness_m input exists (deferred with GO).
            thickness_provided = blinding and height_provided and 0 < height <= 0.5
            thickness = height if thickness_provided else (0.15 if blinding else 0.25)

            fw_area = elem.get("area_m2", 0) or 0
            if fw_area:
                fw_status = ItemQuantityStatus.FROM_INPUT.value
                fw_formula = f"plocha bednění z podkladu: {fw_area} m² (vstup area_m2)"
            elif tubus:
                # §2.10 — no explicit area → honest NEPOČÍTÁNO, never V/thickness.
                fw_area = None
                fw_status = ItemQuantityStatus.nepocitano(
                    "geometrie tubusu jen z explicitních vstupů (§2.10) — "
                    "zadej area_m2 nebo použij kalkulátor betonáže (runTubusPath)"
                )
                fw_formula = (
                    "tubus: plocha bednění z explicitní geometrie rámu "
                    "(délka sekce × rozměry), NE breakdown heuristika V/tl."
                )
            elif volume:
                fw_status = ItemQuantityStatus.ASSUMED.value
                if horizontal:
                    if blinding and length_provided:
                        # Strip blinding: 2 long edges × length × thickness.
                        fw_area = 2 * length_m * thickness
                        fw_status = ItemQuantityStatus.COMPUTED.value if thickness_provided else ItemQuantityStatus.ASSUMED.value
                        fw_formula = (
                            f"2 líce × {length_m} m × tl. {thickness} m"
                            + (" (vstupy length_m + height_m)" if thickness_provided
                               else " (vstup length_m; tl. typový default)")
                        )
                    elif blinding:
                        # No length: square-footprint hypothesis (patky,
                        # isolated slabs) — an honest fallback, assumed.
                        footprint = volume / thickness
                        fw_area = 4 * (footprint ** 0.5) * thickness
                        fw_formula = (
                            f"odhad: obvod čtvercového půdorysu (4×√({volume}/{thickness})) "
                            f"× tl. {thickness} m — boční bednění podkladního betonu"
                        )
                    else:
                        fw_area = volume / 0.25  # soffit estimate: footprint @ typ. tl.
                        fw_formula = f"odhad: {volume} m³ / 0.25 m (typová tloušťka)"
                elif length_provided and height_provided and height > 0:
                    # VERTICAL linear element with documented length AND height:
                    # both faces over the full run — deterministic over inputs.
                    fw_area = 2 * length_m * height
                    fw_status = ItemQuantityStatus.COMPUTED.value
                    fw_formula = (
                        f"2 líce × {length_m} m × výška {height} m "
                        f"(vstupy length_m + height_m)"
                    )
                else:
                    width = 0.3
                    fw_area = volume / width * 2
                    fw_formula = f"odhad: {volume} m³ / {width} m × 2 (obě líce)"
            else:
                fw_status = ItemQuantityStatus.ASSUMED.value
                fw_formula = ""

            # Curing surface: horizontal → the TOP (footprint = V / tl.);
            # vertical → the same faces as the formwork (values coincide, the
            # factor stays separate so a formwork fix never drags curing along).
            if tubus:
                # §2.10 — ošetřování betonu tubusu se neodvozuje breakdown
                # heuristikou; navíc v OTSKP je zahrnuto v ceně betonu (bundled).
                curing_area = None
                curing_status = ItemQuantityStatus.nepocitano(
                    "ošetřování tubusu jen z explicitní geometrie (§2.10); "
                    "v OTSKP zahrnuto v betonu"
                )
                curing_formula = (
                    "tubus: plocha ošetřování z explicitní geometrie, "
                    "NE breakdown heuristika"
                )
            elif volume and horizontal:
                curing_area = volume / thickness
                curing_status = ItemQuantityStatus.COMPUTED.value if thickness_provided else ItemQuantityStatus.ASSUMED.value
                curing_formula = (
                    f"horní povrch (půdorys): {volume} m³ / tl. {thickness} m"
                    + ("" if thickness_provided else " (tl. typový default)")
                )
            else:
                curing_area = fw_area
                curing_status = fw_status
                curing_formula = fw_formula

            # Step 3: Decompose into work items
            #
            # AC2 (element 24): prefabrikovaný tubus → montážní plán (montáž
            # dílců + zálivky spár), NIKDY betonářské atomy. construction_mode
            # resolution mirrors the confidence ladder: explicit caller input
            # wins over the classifier's prefab signal (_TUBUS_PREFAB_RE);
            # default is monolit (cast-in-place keeps the default template
            # with the §2.10 honest-blank guards above).
            tubus_mode = (
                elem.get("construction_mode")
                or classification.get("construction_mode")
                or "monolit"
            ) if tubus else None
            tubus_prefab = tubus_mode == "prefab"
            if tubus_prefab:
                templates = WORK_TEMPLATES["uzavreny_ram_tubus__prefab"]
            else:
                templates = WORK_TEMPLATES.get(etype, WORK_TEMPLATES["default"])

            for tmpl in templates:
                work_name = tmpl["work"].format(
                    element=profile["label_cs"],
                    concrete_class=concrete_class,
                )

                # Calculate quantity + its provenance (stage-3 Quantify)
                qty = 0
                q_status, q_formula = ItemQuantityStatus.ASSUMED.value, ""
                factor = tmpl["qty_factor"]
                if factor == "volume":
                    qty = volume
                    q_status = ItemQuantityStatus.FROM_INPUT.value
                    q_formula = f"objem z podkladu: {volume} m³ (vstup volume_m3)"
                elif factor == "formwork_area":
                    qty = fw_area
                    q_status, q_formula = fw_status, fw_formula
                elif factor == "curing_area":
                    qty = curing_area
                    q_status, q_formula = curing_status, curing_formula
                elif factor == "falsework_volume":
                    # Skruž = obestavěný prostor pod NK v m³ (OTSKP canon):
                    # půdorys (footprint = V / typ. tl.) × výška pod NK
                    # (height_m). Without the height there is NO honest number
                    # — the row is an explicit NEPOČÍTÁNO in m³ (§6.4.2),
                    # never a fabricated default height.
                    if volume and height_provided and height > 0:
                        qty = (volume / thickness) * height
                        q_status = ItemQuantityStatus.ASSUMED.value  # thickness is a default → worse status
                        q_formula = (
                            f"obestavěný prostor: půdorys ({volume} m³ / tl. {thickness} m — "
                            f"typový default) × výška pod NK {height} m (vstup height_m)"
                        )
                    else:
                        qty = None
                        q_status = ItemQuantityStatus.nepocitano("chybí výška pod NK — vstup height_m")
                        q_formula = (
                            "obestavěný prostor = půdorys × výška pod NK; "
                            "výška není ve vstupu"
                        )
                elif factor == "rebar_tons":
                    qty = rebar_tons
                    q_status, q_formula = rebar_status, rebar_formula
                elif factor == "length":
                    # A documented run length (length_m) IS the length quantity
                    # (pile length, wall run); height_m stays the legacy carrier.
                    if length_provided:
                        qty = length_m
                        q_status = ItemQuantityStatus.FROM_INPUT.value
                        q_formula = f"délka z podkladu: {length_m} m (vstup length_m)"
                    elif height_provided:
                        qty = height
                        q_status = ItemQuantityStatus.FROM_INPUT.value
                        q_formula = f"výška z podkladu: {height} m (vstup height_m)"
                    else:
                        qty = height
                        q_formula = f"typový default výšky: {height} m"
                elif factor == "prestress_tons":
                    qty = rebar_tons * 0.3 if elem.get("is_prestressed") else 0
                    if rebar_provided:
                        q_status = ItemQuantityStatus.COMPUTED.value
                        q_formula = f"{rebar_tons} t výztuže (vstup) × 0.3"
                    else:
                        q_formula = f"odhad: {round(rebar_tons, 2)} t výztuže (default) × 0.3"
                elif factor == "dilce_volume":
                    # Prefab tubus CARRIER (review finding 5): objem dílců v m³
                    # (OTSKP 3891x kánon) JEN ze vstupu volume_m3; počet kusů =
                    # druhá dimenze → echo ve formuli (pravidlo 4), nikdy
                    # náhrada objemu (objem dílce je výrobní údaj dodavatele).
                    pieces = elem.get("pieces_count")
                    pieces_note = f"; {pieces} ks dílců (vstup pieces_count)" if pieces else ""
                    if volume and volume > 0:
                        qty = volume
                        q_status = ItemQuantityStatus.FROM_INPUT.value
                        q_formula = (
                            f"objem dílců z podkladu: {volume} m³ (vstup volume_m3)"
                            + pieces_note
                        )
                    else:
                        qty = None
                        q_status = ItemQuantityStatus.nepocitano(
                            "chybí objem prefabrikovaných dílců — vstup volume_m3"
                        )
                        q_formula = (
                            "objem dílců = výrobní údaj dodavatele, neodhaduje se"
                            + pieces_note
                        )
                elif factor == "grout_volume":
                    # Zálivka spár: objem JEN ze vstupu (závisí na detailu spáry
                    # dle výrobce dílců) — žádný V/geometrie odhad.
                    grout = elem.get("grout_volume_m3")
                    if grout and grout > 0:
                        qty = grout
                        q_status = ItemQuantityStatus.FROM_INPUT.value
                        q_formula = f"objem zálivky z podkladu: {grout} m³ (vstup grout_volume_m3)"
                    else:
                        qty = None
                        q_status = ItemQuantityStatus.nepocitano(
                            "chybí objem zálivky spár — vstup grout_volume_m3 (detail spáry dle výrobce)"
                        )
                        q_formula = "objem zálivky = detail spáry dle výrobce dílců, neodhaduje se"
                elif factor == "1":
                    qty = 1
                    q_status = ItemQuantityStatus.COMPUTED.value
                    q_formula = "paušál: 1 kpl"

                if qty is None:
                    pass  # explicit NEPOČÍTÁNO row is KEPT (§6.4.2), quantity stays None
                elif qty <= 0:
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
                    "quantity": round(qty, 2) if qty is not None else None,
                    # SPEC §6.3 / §6.4.2 — no number without a formula + an honest
                    # status; an `assumed` default must scream, never look like a fact.
                    "quantity_status": q_status,
                    "quantity_formula": q_formula,
                    "hsv_section": tmpl.get("hsv", ""),
                    "element_name": name,
                    "element_type": etype,
                    # axis-A code — static template mapping, deterministic 1.0
                    # (Gate 4; stage-5 Bind maps it, SPEC §5.1/§6.3)
                    "vocabulary_code": tmpl.get("vocabulary_code"),
                    # SPEC §6.3 item contract: emitted by a BUILT branch (§6.4.3;
                    # the not-built case lands in `unresolved` as not_covered_branch)
                    "coverage": "covered",
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
                # Tubus rows carry the resolved construction mode — the
                # vocabulary-keyed prefab handling in the binding stage keys
                # on it (review finding 7: a monolithic-tubus grout atom must
                # never be swallowed into the prefab-dílce bundle).
                if tubus_mode is not None:
                    item["construction_mode"] = tubus_mode
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
