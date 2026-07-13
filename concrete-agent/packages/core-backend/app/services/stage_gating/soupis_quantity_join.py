"""Deterministic soupis → element quantity join (P1).

Fills ``volume_m3`` on the TZ element list from a parsed construction budget
(soupis), keyed on ``element_type`` via the existing classifier. This is the
pure, hermetic core of the "document → quantified-elements" step — the seam the
recon (``docs/audits/pipeline_state_recon/2026-06-08_pipeline_recon.md``)
identified as the last manual stitch. Wiring it into the DOCUMENT_ANALYSIS
recipe step is P2 (a separate gated task); this module does no I/O and imports
nothing from the recipe.

The classifier is INJECTED (``classify``) so hermetic tests need no KB load —
the live caller passes the deterministic core of
``app.mcp.tools.classifier`` (keyword + OTSKP matching, no LLM).

Design + decisions: ``docs/specs/doc_to_quantified_elements/design.md``.
- D2: M soupis beton-m3 lines → 1 element, summed, keyed on element_type.
- D3 / D5: TZ geometry is a CROSS-CHECK only (divergence flag), never a source
  of volume; soupis is authoritative; flags are never auto-resolved.
- D4: no soupis match → honest-blank (``volume_m3`` stays None,
  ``quantity_status='missing'``); the element is KEPT, never dropped, never a
  fabricated number.
- Same element_type shared by >1 element that has soupis volume → 'ambiguous'
  (``volume_m3`` stays None + ``candidates[]``), never a silent split
  (design open question #1 — per-instance disambiguation deferred).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Callable, Optional

from .volume_geometry import check_volume_geometry

# TZ cross_section_type vocab (extract_tz_fields._CROSS_SECTION) → the TS
# DECK_SUBTYPE_EQ_THICKNESS_M keys. Both komora variants are 0.7, so mapping the
# undistinguished "komorovy" → "jednokomora" is value-correct.
_DECK_SUBTYPE_FROM_CROSS_SECTION = {
    "deskovy": "deskovy",
    "sprazeny": "sprazeny",
    "jednotramovy": "jednotram",
    "dvoutramovy": "dvoutram",
    "vicetramovy": "vicetram",
    "komorovy": "jednokomora",
}

# Keyword-tier confidence cap: this join classifies on names/descriptions, so a
# matched volume can be at most the keyword tier. A code-tier (OTSKP code → 1.0)
# volume requires code-aware classification — a later increment.
_KEYWORD_CONF_CAP = 0.9


def _is_m3(unit: Optional[str]) -> bool:
    return (unit or "").strip().lower().replace(" ", "") in {"m3", "m³", "m^3"}


def _is_tonne(unit: Optional[str]) -> bool:
    return (unit or "").strip().lower() in {"t", "tuna", "tun"}


def _is_kg(unit: Optional[str]) -> bool:
    return (unit or "").strip().lower() == "kg"


def _is_bm(unit: Optional[str]) -> bool:
    return (unit or "").strip().lower() in {"m", "bm", "mb"}


def _norm(text: Optional[str]) -> str:
    """Lowercase + strip diacritics — mirrors classifier._normalize so the
    keyword regexes below match real soupis wording (VÝZTUŽ, PŘEDPÍNACÍ, …)."""
    decomposed = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def _norm_so(code: Optional[str]) -> str:
    """Canonicalize an SO / object code for equality — «SO 202», «SO-202»,
    «SO202» all compare equal. Used to filter a whole-stavba soupis to the
    passport's construction object."""
    return re.sub(r"[\s\-]+", "", (code or "").strip().upper())


# Mass-line kind detection (half-B Gate 3 増: quantities beyond m³). PRESTRESS is
# checked FIRST — «výztuž předpínací» matches both stems and the strands must
# never be double-counted into the passive rebar mass.
_PRESTRESS_RE = re.compile(r"predpin|predpjat|kabel|lana|strand|y\s*1860")
_REBAR_RE = re.compile(r"vyztuz|armatur|betonarsk|b\s*500")


def _mass_kind(desc_norm: str) -> Optional[str]:
    if _PRESTRESS_RE.search(desc_norm):
        return "prestress"
    if _REBAR_RE.search(desc_norm):
        return "rebar"
    return None


def _classify_etype(classify: Callable, name: str, object_code, object_type) -> dict:
    """Call the injected classifier, tolerant of a simpler 1-arg test stub."""
    try:
        return classify(name, object_code, object_type) or {}
    except TypeError:
        return classify(name) or {}


def _deck_subtype(geometry: dict) -> Optional[str]:
    raw = (geometry.get("cross_section_type") or "").strip().lower()
    return _DECK_SUBTYPE_FROM_CROSS_SECTION.get(raw)


def _geometry_for_check(element_type: str, geometry: dict) -> Optional[dict]:
    """Adapt TZ NK geometry (extract_tz_fields._extract_geometry) → the
    cross-check input. Returns None when the inputs are insufficient. Pile
    geometry is not present in TZ NK prose (stage-2 drawings), so the pilota
    cross-check stays inert here — honest, not faked."""
    if element_type == "mostovkova_deska":
        num_spans = geometry.get("num_spans")
        total = geometry.get("total_span_length_m")
        nk_width = geometry.get("nk_width_m")
        if not num_spans or not total or not nk_width:
            return None
        # span_m × num_spans reproduces the authoritative total exactly.
        return {
            "span_m": total / num_spans,
            "num_spans": num_spans,
            "nk_width_m": nk_width,
            "bridge_deck_subtype": _deck_subtype(geometry),
        }
    return None


def _divergence(element_type: str, volume_m3: float, geometry: Optional[dict]) -> Optional[dict]:
    if not geometry:
        return None
    geo = _geometry_for_check(element_type, geometry)
    if geo is None:
        return None
    issue = check_volume_geometry(element_type, volume_m3, geo)
    if not issue:
        return None
    return {
        "soupis_m3": volume_m3,
        "geometry_expected_m3": issue["expected_m3"],
        "ratio": issue["ratio"],
        "severity": issue["severity"],
    }


def map_soupis_to_elements(
    parsed_budget: Optional[dict],
    tz_elements: Optional[list],
    geometry: Optional[dict] = None,
    *,
    classify: Callable,
    object_type: Optional[str] = None,
    so_code: Optional[str] = None,
) -> list:
    """Return a NEW element list with ``volume_m3`` filled from the soupis.

    Args:
        parsed_budget: ``parse_construction_budget`` output — ``{"items": [...]}``
            where each item is ``{code, description, unit, quantity, object_code?}``.
        tz_elements: ``extract_tz_fields`` element list — each
            ``{name, object_code, concrete_class, volume_m3=None, _source}``.
        geometry: ``extract_tz_fields`` ``object["geometry"]`` block, or None.
        classify: deterministic ``element_type`` classifier (injected).
        object_type: authoritative object type threaded by the orchestrator
            ('bridge' | 'retaining_wall' | 'building'), or None.
        so_code: the passport's SO / construction-object code (e.g. "SO 202"). A
            BridgePassport is PER-SO, but a real soupis is the WHOLE stavba (many
            ``<objekt>`` sections). When given, the join is restricted to soupis
            lines whose ``object_code`` matches — otherwise quantities sum across
            every SO (bug `passport-soupis-join-whole-stavba`: deck ×3.2, piers
            ×20). No-op when the soupis carries no SO tags (untagged format).

    The input dicts are never mutated — each element is shallow-copied and its
    ``_source`` extended with a ``volume_m3`` provenance leaf.
    """
    items = (parsed_budget or {}).get("items", []) or []

    # Per-SO restriction (bug passport-soupis-join-whole-stavba). Only filter when
    # the target SO is known AND the soupis actually tags lines with an object_code
    # — a soupis format without SO tags degrades to the old whole-list behaviour
    # (better than dropping every line to a false NEPOČÍTÁNO). Untagged lines in an
    # otherwise-tagged soupis have an unknown SO → excluded from a per-SO join.
    if so_code:
        target = _norm_so(so_code)
        tagged = [it for it in items if it.get("object_code")]
        if tagged:
            items = [it for it in tagged if _norm_so(it.get("object_code")) == target]

    # 1. Soupis buckets keyed by element_type. Volume (m³) is the original P1
    #    field; rebar/prestress masses (t/kg) + rimsa length (bm) are the
    #    half-B Gate 3 additive increment — same discipline, separate fields.
    buckets: dict = {}
    mass_buckets: dict = {}
    for it in items:
        unit = it.get("unit")
        desc = (it.get("description") or "").strip()
        if not desc:
            continue
        is_m3 = _is_m3(unit)
        kind: Optional[str] = None
        if not is_m3:
            if _is_tonne(unit) or _is_kg(unit):
                kind = _mass_kind(_norm(desc))
            elif _is_bm(unit):
                kind = "length_bm"
            if kind is None:
                continue  # bednění m² etc. — other fields, later increment
        # Element classification keys on the OTSKP standard name (<nazev>,
        # `catalog_name`) when the parser captured it — `description` (popis) can be
        # a project sub-note («vč. nátěru…») that shadows the element noun, so on
        # those lines the note-only description misclassifies (bug
        # passport-soupis-join-whole-stavba increment 2: 334326/333325 recovered,
        # 451314 «…pod základy pilířů» no longer trapped into driky). Falls back to
        # description for formats without a separate catalog name.
        # NB: a soupis line code is an OTSKP/URS code, NOT an SO-xxx object code —
        # pass object_code=None so the classifier's bridge upgrade keys only on
        # the authoritative object_type.
        name_for_class = (it.get("catalog_name") or "").strip() or desc
        cls = _classify_etype(classify, name_for_class, None, object_type)
        etype = cls.get("element_type", "jine")
        if etype == "jine":
            continue  # unmatched line (výkop / zásyp / …) — not element-bound
        try:
            qty = float(it.get("quantity") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        if qty <= 0:
            continue
        conf = float(cls.get("confidence") or 0.0)
        line = {
            "code": (it.get("code") or "").strip(),
            "description": desc,
            "quantity": qty,
            "unit": (it.get("unit") or "").strip(),
            "classification_source": cls.get("classification_source"),
            "confidence": conf,
        }
        if is_m3:
            b = buckets.setdefault(etype, {"quantity": 0.0, "lines": [], "confidence": 1.0})
            b["quantity"] += qty
            b["confidence"] = min(b["confidence"], conf)
            b["lines"].append(line)
            continue
        if kind == "length_bm" and etype != "rimsa":
            continue  # bm lines are only meaningful for římsy (svodidla etc. skip)
        field = {
            "rebar": "rebar_mass_kg",
            "prestress": "prestress_strand_mass_kg",
            "length_bm": "length_bm",
        }[kind]
        value = qty * 1000.0 if (kind in ("rebar", "prestress") and _is_tonne(unit)) else qty
        mb = mass_buckets.setdefault(etype, {})
        fb = mb.setdefault(field, {"value": 0.0, "lines": [], "confidence": 1.0})
        fb["value"] += value
        fb["confidence"] = min(fb["confidence"], conf)
        fb["lines"].append(line)

    # 2. Classify the TZ elements + index by element_type (ambiguity detection).
    el_types: list = []
    by_type: dict = {}
    for idx, el in enumerate(tz_elements or []):
        cls = _classify_etype(classify, el.get("name", ""), el.get("object_code"), object_type)
        etype = cls.get("element_type", "jine")
        el_types.append(etype)
        by_type.setdefault(etype, []).append(idx)

    # 3. Build the quantified output.
    out: list = []
    for idx, el in enumerate(tz_elements or []):
        new_el = dict(el)
        new_el["_source"] = dict(el.get("_source") or {})
        etype = el_types[idx]
        bucket = buckets.get(etype)

        # Additive mass/length fields (rebar t→kg, prestress, rimsa bm) — only
        # on an unambiguous single element of the type; same never-split rule.
        if mass_buckets.get(etype) and len(by_type.get(etype, [])) == 1:
            for field, fb in mass_buckets[etype].items():
                new_el[field] = round(fb["value"], 3)
                new_el["_source"][field] = {
                    "source": "soupis",
                    "evidence": "; ".join(
                        f"{ln['code']} {ln['description']} qty={ln['quantity']} {ln['unit']}".strip()
                        for ln in fb["lines"]
                    ),
                    "matched_by": f"element_type:{etype}",
                    "confidence": min(_KEYWORD_CONF_CAP, fb["confidence"]),
                    "n_lines": len(fb["lines"]),
                }

        if bucket is None:
            # honest-blank — no soupis volume for this element_type
            new_el["volume_m3"] = el.get("volume_m3")  # keep as-is (None)
            new_el["quantity_status"] = "missing"
            new_el["_source"]["volume_m3"] = {
                "status": "not_extracted_from_soupis", "confidence": 0.0,
            }
            out.append(new_el)
            continue

        if len(by_type.get(etype, [])) > 1:
            # genuine same-type ambiguity → never silently split
            new_el["volume_m3"] = el.get("volume_m3")  # stays None
            new_el["quantity_status"] = "ambiguous"
            new_el["candidates"] = [dict(line) for line in bucket["lines"]]
            new_el["_source"]["volume_m3"] = {
                "status": "ambiguous_multiple_elements_same_type",
                "matched_by": f"element_type:{etype}",
                "confidence": 0.0,
            }
            out.append(new_el)
            continue

        # single match → assign summed soupis volume (authoritative)
        vol = round(bucket["quantity"], 6)
        new_el["volume_m3"] = vol
        new_el["quantity_status"] = "extracted"
        evidence = "; ".join(
            f"{line['code']} {line['description']} qty={line['quantity']} {line['unit']}".strip()
            for line in bucket["lines"]
        )
        new_el["_source"]["volume_m3"] = {
            "source": "soupis",
            "evidence": evidence,
            "matched_by": f"element_type:{etype}",
            "confidence": min(_KEYWORD_CONF_CAP, bucket["confidence"]),
            "n_lines": len(bucket["lines"]),
        }
        # geometry cross-check (soupis authoritative; flag only, never resolve)
        new_el["quantity_divergence"] = _divergence(etype, vol, geometry)
        out.append(new_el)

    return out
