"""bridge_passport_assembler — half-B emitter (ADR-008 §1, Gate 3).

Composes a per-SO **BridgePassport** (single-source schema
`app/models/bridge_passport.py`, consumed by half-A `calculate_from_passport`)
from the extraction INGREDIENTS that already exist:

    stage 1  extract_tz_fields output  → identity, geometry, concretes-per-use
    stage 3  map_soupis_to_elements    → quantities.items (m³ + rebar/prestress/length)
    stage 2  drawings (vision)         → construction_process trio — Gate 4,
                                          honestly ABSENT here (noted in _meta.gaps)

Placement per the ratified B-interview: a SIBLING of the recipe_runner seam —
recipe_runner and the future MCP tool `build_bridge_passport` both call THIS
module; no parallel extraction structure, ingredients are reused, not copied.

Honest-blank discipline (AC 5): a field the sources do not carry is OMITTED
and listed in `_meta.gaps`; every carried value keeps `source` provenance.
The result is validated against the Pydantic schema before returning — an
assembler that emits an invalid passport is a defect, not a warning.

Naming note: this module is deliberately `bridge_passport_*` — the codebase
has THREE «passport» concepts (`ProjectPassport` doc-analysis, `BridgePassport`
tz, UEP adapter); import-path discipline per the Gate 0 audit.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from app.models.bridge_passport import SCHEMA_NAME, BridgePassport
from app.models.bridge_passport_element_map import passport_key_for_engine_type
from app.services.stage_gating.soupis_quantity_join import map_soupis_to_elements

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "0.1-draft"

# Quantity fields the soupis join can fill today → passport QuantityItem fields.
_QUANTITY_FIELDS = ("volume_m3", "rebar_mass_kg", "prestress_strand_mass_kg", "length_bm")


def _classify_etype(classify: Callable, name: str, object_code, object_type) -> dict:
    """Injected-classifier call, tolerant of a 1-arg test stub (same seam
    convention as soupis_quantity_join)."""
    try:
        return classify(name, object_code, object_type) or {}
    except TypeError:
        return classify(name) or {}


def assemble_bridge_passport(
    tz_fields: dict,
    parsed_budget: Optional[dict] = None,
    *,
    classify: Callable,
    object_type: str = "bridge",
    construction_process: Optional[dict] = None,
    soupis_provenance: Optional[dict] = None,
) -> dict:
    """Compose + validate a per-SO BridgePassport from stage-1/3 outputs.

    Args:
        tz_fields: `extract_tz_fields` output ({object, elements, _extraction_meta}).
        parsed_budget: `parse_construction_budget` output ({items: [...]}) or None.
        classify: deterministic element-type classifier (injected — the live
            caller passes the core of `app.mcp.tools.classifier`, tests a stub).
        object_type: authoritative object type for the classifier bridge-upgrade.
        soupis_provenance: OPTIONAL {ref?, filename, total_items} — the soupis the
            quantities came from. Cited in `quantities.source` and `_meta.soupis`
            (Pattern 2/29: quantities must name their source, not just say "join").
        construction_process: OPTIONAL verified stage-2 trio fragment
            ({deck_pour_stages?, deck_pour_stages_source?, falsework_technology?}).
            Injected HERE (not spliced by the caller after the fact) so it passes
            the same emit-side `model_validate` as the rest of the passport, and
            so the honest gap is emitted PER MISSING trio member — a falsework-only
            fragment still declares the missing `deck_pour_stages`.

    Returns the passport as a plain dict (already `model_validate`d).
    Raises pydantic.ValidationError if the assembly violates the schema —
    an invalid emit is a defect, never silently returned.
    """
    obj = (tz_fields or {}).get("object") or {}
    tz_elements = (tz_fields or {}).get("elements") or []
    geometry_tz = obj.get("geometry") or {}
    gaps: list[str] = []

    # ── quantities (stage 3): soupis join on the classifier axis ─────────────
    # A BridgePassport is PER-SO; pass the object's SO code so a whole-stavba
    # soupis is filtered to THIS construction object, never summed across every SO
    # (bug passport-soupis-join-whole-stavba).
    quantified = map_soupis_to_elements(
        parsed_budget, tz_elements, geometry_tz,
        classify=classify, object_type=object_type,
        so_code=obj.get("object_code"),
    ) if parsed_budget else list(tz_elements)
    if not parsed_budget:
        gaps.append("quantities: no soupis provided — all elements NEPOČÍTÁNO downstream")

    # ── per-element: classifier etype → passport key (shared map) ────────────
    # Dedup by passport key: several TZ text spans (or soupis lines) can map to the
    # SAME element — emit ONE item per key, merging quantities ADDITIVELY (a soupis
    # element split across positions sums; text-only dups just collapse). Never
    # repeat a key — a duplicated deck would triple the volume downstream.
    concretes: list[dict] = []
    items_by_key: "dict[str, dict[str, Any]]" = {}  # insertion-ordered
    seen_uses: set[str] = set()
    for el in quantified:
        name = el.get("name", "")
        cls = _classify_etype(classify, name, el.get("object_code"), object_type)
        etype = cls.get("element_type", "jine")
        pkey = passport_key_for_engine_type(etype)
        if pkey is None:
            gaps.append(f"element '{name}' (etype={etype}) has no passport key — skipped (honest-ignore)")
            continue

        if el.get("concrete_class") and pkey not in seen_uses:
            seen_uses.add(pkey)
            concretes.append({
                "use": pkey,
                "class": str(el["concrete_class"]),
                "source": _source_str(el, "concrete_class") or "tz_stage1",
            })

        item = items_by_key.get(pkey)
        if item is None:
            item = {"element": pkey}
            items_by_key[pkey] = item
        for f in _QUANTITY_FIELDS:
            v = el.get(f)
            if isinstance(v, (int, float)) and v > 0:
                item[f] = float(item.get(f, 0.0)) + float(v)  # additive merge
                item.setdefault("source", _source_str(el, "volume_m3") or "soupis_join")

    items: list[dict] = []
    for pkey, item in items_by_key.items():
        if any(f in item for f in _QUANTITY_FIELDS):
            item.setdefault("source", "soupis_join")
        else:
            # No quantities joined — emit the key anyway (half-A marks it NEPOČÍTÁNO,
            # AC 3), honest gap once per key.
            item["source"] = "tz_stage1_no_quantities"
            gaps.append(f"quantities for '{pkey}': none joined from soupis")
        items.append(item)

    # ── geometry / structural system (stage 1 prose) ─────────────────────────
    geometry: dict[str, Any] = {}
    spans = geometry_tz.get("span_lengths_m") or []
    if spans:
        geometry["spans"] = [float(s) for s in spans]
    structural: dict[str, Any] = {}
    if geometry_tz.get("num_spans"):
        structural["spans_count"] = int(geometry_tz["num_spans"])
    # Deck height over terrain: primary source is the TZ text «výška nad terénem»
    # (live SO-202 bug #4 — it feeds height_m → skruž). half-A takes the max as the
    # falsework height; per-crossing widths stay a drawing-side gap.
    deck_heights = geometry_tz.get("deck_heights_over_terrain_m") or []
    if deck_heights:
        geometry["decks"] = [{"deck_height_over_terrain_m": max(float(h) for h in deck_heights)}]
        gaps.append("geometry.decks widths: stage 2 drawings — not extracted (heights from TZ text)")
    else:
        gaps.append("geometry.decks (widths, deck_height_over_terrain_m): stage 2 drawings — not extracted")

    superstructure: dict[str, Any] = {}
    deck: dict[str, Any] = {}
    if geometry_tz.get("nk_width_m"):
        deck["width_per_deck_m"] = float(geometry_tz["nk_width_m"])
    if spans:
        deck["spans_m"] = [float(s) for s in spans]
    if deck:
        superstructure["deck"] = deck

    # ── construction_process: the calculable-critical trio is Gate 4 ─────────
    # A VERIFIED fragment (host vision → notes gate) may be injected; anything it
    # does NOT carry stays an honest, PER-FIELD gap (a falsework-only fragment
    # still declares the missing pour-stage count — no wholesale gap clearing).
    # Primary source = deterministic TZ-text extraction (stage 1); a VERIFIED
    # drawing note (passed as `construction_process`) overrides/corroborates it.
    cp_text = (tz_fields or {}).get("construction_process") or {}
    cp = {**cp_text, **(construction_process or {})} or None
    missing_cp = []
    if not cp or cp.get("deck_pour_stages") is None:
        missing_cp.append("deck_pour_stages")
    if not cp or not cp.get("falsework_technology"):
        missing_cp.append("falsework_technology")
    if missing_cp:
        gaps.append(
            f"construction_process ({', '.join(missing_cp)}): stage 2 vision — not extracted")

    # quantities provenance — cite the soupis, not just "join" (Pattern 2/29:
    # a quantity must name its source). `_meta.soupis` carries the handle so the
    # passport is traceable back to the exact upload.
    if parsed_budget:
        _fn = (soupis_provenance or {}).get("filename")
        _n = (soupis_provenance or {}).get("total_items")
        quantities_source = (
            f"soupis join: {_fn}" + (f" ({_n} items)" if _n else "")
            if _fn else "soupis join"
        )
    else:
        quantities_source = "none"

    passport: dict[str, Any] = {
        "_meta": {
            "schema": SCHEMA_NAME,
            "schema_version": SCHEMA_VERSION,
            "source": "bridge_passport_assembler (stage 1 TZ text + stage 3 soupis join)",
            "gaps": gaps,
        },
        **({"geometry": geometry} if geometry else {}),
        **({"structural_system": structural} if structural else {}),
        **({"superstructure": superstructure} if superstructure else {}),
        **({"materials_and_standards": {"concretes": concretes}} if concretes else {}),
        **({"construction_process": cp} if cp else {}),
        "quantities": {"source": quantities_source, "items": items},
    }
    if obj.get("object_code") or obj.get("object_name"):
        passport["_meta"]["object"] = {
            "code": obj.get("object_code"), "name": obj.get("object_name"),
        }
    if soupis_provenance:
        passport["_meta"]["soupis"] = {
            k: v for k, v in soupis_provenance.items() if v is not None
        }

    BridgePassport.model_validate(passport)  # emit-side drift-guard (loud)
    return passport


def _source_str(el: dict, field: str) -> Optional[str]:
    """Compact provenance string from the join's `_source` leaf."""
    leaf = (el.get("_source") or {}).get(field)
    if not isinstance(leaf, dict):
        return None
    src = leaf.get("source") or leaf.get("status")
    ev = leaf.get("evidence")
    if src and ev:
        return f"{src}: {str(ev)[:160]}"
    return str(src) if src else None
