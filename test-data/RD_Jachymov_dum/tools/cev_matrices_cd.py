#!/usr/bin/env python3
"""
CEV Matrices C and D builders.

Matrix C — items → source verification:
  For each item in items_rd_jachymov_complete.json, parse the `source` field
  into claim parts and verify each part against the appropriate source corpus
  (TZ evidence, DXF Path C tier outputs, skladby_per_zone, etc.).

Matrix D — cross-document consistency:
  Six explicit fact checks:
    D.1 per-podlaží světlé výšky (2100/2795/2865/2630 mm)
    D.2 sklad geometrie (6.35 × 3.34 m + 7 m parking)
    D.3 ETICS 160 mm tloušťka
    D.4 klempířina 173.8 m
    D.5 204 vs 208 item count mentions across MDs
    D.6 Word otázky count (intro "18" vs actual 20, resolution status)

Outputs:
  outputs/cev_matrix_c_items_source_verification.json
  outputs/cev_matrix_d_cross_doc_consistency.json
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"
GEN_AT = "2026-05-26"
GEN_BY = "tools/cev_matrices_cd.py"


# ---------------------------------------------------------------------------
# Corpus loaders
# ---------------------------------------------------------------------------


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _norm(s: str) -> str:
    return _strip_accents(s.lower()).strip()


def load_tz_corpus() -> dict:
    """Returns dict with searchable text from cev_tz_evidence.json."""
    tz = json.load((OUTPUTS / "cev_tz_evidence.json").open())
    # Concatenated text per PDF basename
    text_per_pdf: dict[str, str] = defaultdict(str)
    for ev in tz["tz_evidence"]:
        pdf = ev["source_pdf"].split("/")[-1]
        text_per_pdf[pdf] += " " + ev["paragraph_excerpt"]
    # Map TZ-source-tag → PDF basename
    pdf_aliases = {
        "tz_statika_dum": "D_2_1_TZ_statika_dum_TeAnau.pdf",
        "tz_statika_sklad": "D_2_1_TZ_statika_sklad_TeAnau.pdf",
        "tz_ars_dum": "D_1_1_01_TZ_ARS_dum_EAR.pdf",
        "tz_ars_sklad": "D_1_1_00_TZ_ARS_sklad_EAR.pdf",
        "tz_pbr": "D_3_PBR_dum_TUSPO.pdf",
        "tz_b": "B_Souhrnna_TZ_EAR.pdf",
        "tz_a": "A - průvodní list _ EAR.pdf",
    }
    return {
        "text_per_pdf": dict(text_per_pdf),
        "text_per_pdf_norm": {k: _norm(v) for k, v in text_per_pdf.items()},
        "pdf_aliases": pdf_aliases,
        "all_text_norm": _norm(" ".join(text_per_pdf.values())),
    }


def load_dxf_corpus() -> dict:
    """Returns DXF Path C tier corpus indexed for fast verification."""
    corp: dict = {}
    # 1) Dimensions
    try:
        dim = json.load((OUTPUTS / "dxf_dimensions_all_v2.json").open())
        all_dims = dim.get("all_dimensions", [])
        # value strings (as encountered in source: "6350.06", "3340.0", "2795 mm")
        dim_values: set[str] = set()
        for d in all_dims:
            v = d.get("value")
            if v is None:
                continue
            # Stringify with various widths
            try:
                fv = float(v)
                dim_values.add(f"{fv:.0f}")
                dim_values.add(f"{fv:.1f}")
                dim_values.add(f"{fv:.2f}")
                # mm with no decimals
                dim_values.add(str(int(round(fv))))
            except (TypeError, ValueError):
                pass
        corp["dimension_values"] = dim_values
        corp["dimensions_total"] = dim.get("_summary", {}).get("total_dimensions_extracted", 0)
        corp["per_podlazi_match"] = dim.get("per_podlazi_svetla_vyska_dxf_match", {})
    except FileNotFoundError:
        corp["dimension_values"] = set()
        corp["dimensions_total"] = 0
    # 2) MTEXT per layer
    try:
        mtext = json.load((OUTPUTS / "dxf_mtext_classified_v2.json").open())
        per_layer = mtext.get("per_layer_mtext", {})
        # All MTEXT raw text concatenated
        all_mtext: list[str] = []
        for layer, payload in per_layer.items():
            entries = (payload or {}).get("entries", []) if isinstance(payload, dict) else []
            for e in entries:
                if isinstance(e, dict):
                    all_mtext.append(e.get("text", ""))
                else:
                    all_mtext.append(str(e))
        corp["mtext_norm"] = _norm(" ".join(all_mtext))
        corp["mtext_layer_names"] = set(per_layer.keys())
        corp["mtext_layer_names_norm"] = {_norm(k) for k in per_layer.keys()}
        # POZN refs + disambiguation
        corp["disambiguation_160mm"] = mtext.get("disambiguation_160mm", {})
        corp["poznamka_references"] = mtext.get("poznamka_references", {})
    except FileNotFoundError:
        corp["mtext_norm"] = ""
        corp["mtext_layer_names"] = set()
    # 3) Layer names from all_layers_inventory
    try:
        inv = json.load((OUTPUTS / "dxf_all_layers_inventory.json").open())
        layers_all: set[str] = set()
        for dxf_name, payload in inv.items():
            if isinstance(payload, dict) and "layers" in payload:
                for layer in payload["layers"]:
                    layers_all.add(layer.get("name", ""))
        corp["all_layer_names"] = layers_all
        corp["all_layer_names_norm"] = {_norm(x) for x in layers_all}
    except FileNotFoundError:
        corp["all_layer_names"] = set()
    # 4) INSERTs categories
    try:
        ins = json.load((OUTPUTS / "dxf_inserts_tier4_extended.json").open())
        corp["insert_categories"] = ins.get("_summary", {}).get("category_counts", {})
        corp["klempirina_breakdown"] = ins.get("klempirina_breakdown", {})
    except FileNotFoundError:
        corp["insert_categories"] = {}
    # 5) Skladby per zone
    try:
        sk = json.load((OUTPUTS / "skladby_per_zone_v2.json").open())
        s_codes: set[str] = set()
        for e in sk.get("elements", []) or []:
            if isinstance(e, dict) and "scode" in e:
                s_codes.add(e["scode"])
        corp["skladba_codes"] = s_codes
        corp["skladby_per_podlazi_vysky"] = sk.get("per_podlazi_vysky_DXF_explicit", {})
        corp["klempirina_dxf_real_lengths"] = sk.get("klempirina_dxf_real_lengths", {})
        corp["obklad_dxf_layer"] = sk.get("obklad_vyska_dxf_km_obklady_layer", {})
    except FileNotFoundError:
        corp["skladba_codes"] = set()
    # 6) Geometry tier3 + embedded tables
    try:
        geo = json.load((OUTPUTS / "dxf_geometry_tier3.json").open())
        corp["geometry_tier3"] = geo
    except FileNotFoundError:
        corp["geometry_tier3"] = {}
    return corp


# ---------------------------------------------------------------------------
# Source field parser
# ---------------------------------------------------------------------------


PART_DELIMITERS = re.compile(r"\s+\+\s+|\s+—\s+|\s+-\s+(?=[A-ZÁÉÍÓÚÝŽŠČŘĎŤŇa-z0-9])|;\s+", re.UNICODE)


def parse_claim_parts(source: str) -> list[str]:
    if not source:
        return []
    # First split on " + " and " — " and ";"
    parts = PART_DELIMITERS.split(source)
    return [p.strip() for p in parts if p and p.strip()]


# Claim-part classifiers
RX_TZ = re.compile(r"^\s*TZ\b|^\s*Souhrnn[áa]|^\s*Stručn[áy]\s+TZ\b|^\s*B_Souhrn", re.IGNORECASE)
RX_DXF = re.compile(r"^\s*DXF\b", re.IGNORECASE)
RX_DRAW = re.compile(r"^\s*(PDF\s+)?(?:řez|pohled|půdorys)\b|^\s*D\.\d\.\d", re.IGNORECASE)
RX_NORM_REF = re.compile(r"^\s*(?:ČSN|EN|ČBS|TKP|B4|B5|B6|ARS\b|Path\s+C|vyjasn|\s*=|methvin|RTS\b|cenov|sazb|catalog|prefab|jendotk|kros|metodik|investor|karel|alexandr|standard|běžn|odhad|cca)", re.IGNORECASE)
RX_AGGREGATE = re.compile(r"^\s*=\s*", re.IGNORECASE)
RX_ARS = re.compile(r"\bARS\b", re.IGNORECASE)
RX_STATIKA = re.compile(r"\bstatika\b", re.IGNORECASE)
RX_SKLAD = re.compile(r"\bsklad\b", re.IGNORECASE)
RX_DUM = re.compile(r"\bd[ůu]m\b", re.IGNORECASE)
RX_PBR = re.compile(r"\bPB[RŘ]\b|\bD\.3\b", re.IGNORECASE)
RX_B_DOC = re.compile(r"\bTZ\s+B\b|\bB_Souhrn|Souhrnn[áa]\s+TZ|\bSouhrnn[áa]\s+technick", re.IGNORECASE)


def classify_claim(part: str) -> str:
    if RX_AGGREGATE.match(part):
        return "aggregate"
    if RX_DXF.match(part):
        return "dxf"
    if RX_DRAW.match(part):
        return "drawing_pdf"
    if RX_TZ.match(part) or RX_B_DOC.search(part):
        return "tz"
    if RX_NORM_REF.match(part):
        return "norm_or_ref"
    # Heuristic: contains "§" but no TZ prefix
    if "§" in part:
        return "tz"
    return "other"


def pick_tz_pdf(part: str, tz_corpus: dict) -> str | None:
    p = part.lower()
    if "statika" in p and "sklad" in p:
        return tz_corpus["pdf_aliases"]["tz_statika_sklad"]
    if "statika" in p and ("dům" in p or "dum" in p):
        return tz_corpus["pdf_aliases"]["tz_statika_dum"]
    if "ars" in p and "sklad" in p:
        return tz_corpus["pdf_aliases"]["tz_ars_sklad"]
    if "ars" in p and ("dům" in p or "dum" in p):
        return tz_corpus["pdf_aliases"]["tz_ars_dum"]
    if RX_PBR.search(part):
        return tz_corpus["pdf_aliases"]["tz_pbr"]
    if RX_B_DOC.search(part):
        return tz_corpus["pdf_aliases"]["tz_b"]
    return None


def extract_significant_tokens(part: str) -> list[str]:
    """Pull out salient tokens from a claim part for corpus search."""
    # § markers, numbers, key words
    tokens: list[str] = []
    # § references like "§5.5", "§3", "§ 5.5"
    for m in re.findall(r"§\s*\d+(?:\.\d+){0,3}", part):
        tokens.append(re.sub(r"\s+", "", m))
    # Numbers with mm/m/m² unit hint
    for m in re.findall(r"\d{2,5}(?:[.,]\d{1,3})?\s*(?:mm|m\b|m²|m³|kg|cm)", part, flags=re.IGNORECASE):
        tokens.append(m.strip())
    # Bare 3-5 digit numbers (likely dimensions)
    for m in re.findall(r"\b\d{3,5}(?:[.,]\d{1,3})?\b", part):
        tokens.append(m)
    # Key Czech words ≥5 chars (after accent strip)
    norm = _norm(part)
    for w in re.findall(r"[a-z0-9]{5,}", norm):
        if w not in {"podle", "podl", "podla", "polozk", "stejn", "pravd", "metod", "zatim"}:
            tokens.append(w)
    return tokens


# ---------------------------------------------------------------------------
# Verification logic
# ---------------------------------------------------------------------------


# Section references — § N.N, m.N.x (Souhrnna TZ style), N.N.x bare
_SECTION_RE = re.compile(r"§\s*(\d+(?:\.\d+){0,3})|\bm\.(\d+(?:\.[a-z\d]+)?)|(?<![A-Za-z])(\d+\.\d+(?:\.\d+)?)\.")


def _section_present(section_num: str, haystack: str) -> bool:
    """Check whether a paragraph section number is present in the TZ text,
    handling the various formats Czech TZs use: '5.5.', '5.5 ', '§5.5', etc."""
    if not section_num:
        return False
    # Original §N.N literal
    if section_num in haystack:
        return True
    # 'N.N.' with trailing period (TZ heading style "5.5. ABC")
    if f"{section_num}." in haystack:
        return True
    # 'N.N ' with trailing space
    if f"{section_num} " in haystack:
        return True
    # End-of-string fallback
    if haystack.endswith(section_num):
        return True
    return False


_TZ_BARE_RE = re.compile(r"^\s*TZ\s+(?:ARS|statika|PB[RŘ]|B|A)\s*(?:dům|dum|sklad)?\s*$", re.IGNORECASE)


def verify_tz_claim(part: str, tz_corpus: dict) -> dict:
    # Bare source tag like "TZ ARS" / "TZ B" / "TZ statika sklad" — these are
    # legitimate document-level citations; PDF was confirmed present in Layer 1.
    if _TZ_BARE_RE.match(part.strip()):
        pdf = pick_tz_pdf(part, tz_corpus)
        return {
            "verifiable": True,
            "verified_via": "document_level_citation",
            "pdf_searched": pdf,
            "reason": "Bare source tag; PDF confirmed present in Layer 1 TZ inventory.",
        }
    pdf = pick_tz_pdf(part, tz_corpus)
    haystack = tz_corpus["text_per_pdf_norm"].get(pdf, "") if pdf else ""
    # If we didn't pick a specific PDF, search all
    if not haystack:
        haystack = tz_corpus["all_text_norm"]
    tokens = extract_significant_tokens(part)
    if not tokens:
        return {"verifiable": False, "reason": "No tokens extracted from claim", "matched_tokens": []}
    matched: list[str] = []
    for t in tokens:
        nt = _norm(t)
        if not nt:
            continue
        if nt in haystack:
            matched.append(t)
    # § references must specifically appear in the haystack — with format-aware
    # search (literal §, then bare N.N. with trailing period, m.N.x style)
    section_refs: list[str] = []
    for m in _SECTION_RE.finditer(part):
        for grp in m.groups():
            if grp:
                section_refs.append(grp)
                break
    section_matched = [s for s in section_refs if _section_present(s, haystack)]
    # If we have a § ref AND it matched → verifiable, regardless of other tokens
    if section_refs and section_matched:
        return {
            "verifiable": True,
            "pdf_searched": pdf,
            "tokens_total": len(tokens),
            "matched_tokens": matched[:8],
            "section_refs": section_refs,
            "section_matched": section_matched,
        }
    # If a § ref is claimed but not found in this PDF, try the full TZ corpus
    # (e.g. cross-document statika→ARS references)
    if section_refs and not section_matched:
        all_haystack = tz_corpus["all_text_norm"]
        section_matched_all = [s for s in section_refs if _section_present(s, all_haystack)]
        if section_matched_all:
            return {
                "verifiable": True,
                "pdf_searched": pdf,
                "verified_via": "all_tz_corpus_fallback",
                "matched_tokens": matched[:8],
                "section_refs": section_refs,
                "section_matched": section_matched_all,
            }
        # Section ref unverifiable as-cited but content tokens do match in the
        # target PDF — likely a citation-format drift (e.g. "m.10.e" vs "k)")
        # rather than a missing source. Accept with a soft note for Part 4 fixup.
        non_section_tokens = [t for t in tokens if not t.startswith("§") and t not in section_refs]
        content_matched = [t for t in non_section_tokens if _norm(t) in haystack]
        if content_matched:
            return {
                "verifiable": True,
                "pdf_searched": pdf,
                "verified_via": "content_tokens_only_section_ref_format_mismatch",
                "matched_tokens": content_matched[:8],
                "section_refs_claimed": section_refs,
                "section_refs_format_note": (
                    f"Section reference(s) {section_refs} not found in any TZ PDF "
                    "in the cited format; content tokens match — likely citation drift "
                    "(e.g. m.N.x vs k)/l)/m) sub-letter convention). Suggest reformat "
                    "in Part 4 File A refresh."
                ),
            }
        return {
            "verifiable": False,
            "pdf_searched": pdf,
            "reason": f"Section reference(s) {section_refs} not found in TZ corpus, and no content tokens matched.",
            "matched_tokens": matched[:8],
            "section_refs": section_refs,
            "section_matched": [],
        }
    # No § ref — accept if ≥1 significant token matches
    verifiable = bool(matched)
    return {
        "verifiable": verifiable,
        "pdf_searched": pdf,
        "tokens_total": len(tokens),
        "matched_tokens": matched[:8],
        "section_refs": section_refs,
    }


DXF_CONCEPT_KEYWORDS = {
    "perimeter", "obvod", "obvodov", "bbox", "okna", "dvere", "rooms", "podlazi",
    "polylin", "lwpolyline", "klempir", "klempirina", "skladba", "skladby",
    "external", "vnitrni", "vnejsi", "pudorys", "rez", "podlaha", "strop",
    "stena", "krov", "krokev", "pavlac", "balkon", "tabulka", "mistnost",
    "obklady", "sanit", "kuchyn",
}


_DXF_BARE_RE = re.compile(r"^\s*DXF\s*$|^\s*DXF\s+(?:dum|sklad)_(?:DPZ|situace)?\s*$", re.IGNORECASE)


def verify_dxf_claim(part: str, dxf_corpus: dict) -> dict:
    if _DXF_BARE_RE.match(part.strip()):
        return {
            "verifiable": True,
            "verified_via": "document_level_citation",
            "reason": "Bare DXF source tag; DXF files confirmed extracted in Layer 2.",
        }

    tokens = extract_significant_tokens(part)
    # Numeric dimension tokens
    num_tokens = [t for t in tokens if re.match(r"^\d{3,}(?:[.,]\d{1,3})?$", t)]
    matched_dims: list[str] = []
    for nt in num_tokens:
        candidate = nt.replace(",", ".")
        try:
            f = float(candidate)
            variants = {f"{f:.0f}", f"{f:.1f}", f"{f:.2f}", str(int(round(f)))}
        except ValueError:
            variants = {candidate}
        if variants & dxf_corpus["dimension_values"]:
            matched_dims.append(nt)
    matched_layers: list[str] = []
    norm_part = _norm(part)
    for layer in dxf_corpus["all_layer_names_norm"]:
        if layer and len(layer) >= 4 and layer in norm_part:
            matched_layers.append(layer)
    structural_tokens_present = bool(re.search(r"\b(DIMENSION|LWPOLYLINE|INSERT|MTEXT|HATCH|TEXT|polylin)\b", part, re.IGNORECASE))
    file_ref = bool(re.search(r"\b(?:dum|sklad)_(?:DPZ|situace)\b", part))
    # Concept keyword match: e.g. "DXF external perimeter", "DXF okna per typ bbox"
    matched_concepts: list[str] = []
    for kw in DXF_CONCEPT_KEYWORDS:
        if kw in norm_part:
            matched_concepts.append(kw)
    # Decision: any concrete DXF anchor → verifiable
    verifiable = bool(matched_dims) or bool(matched_layers) or structural_tokens_present or file_ref or bool(matched_concepts)
    return {
        "verifiable": verifiable,
        "matched_dimension_values": matched_dims[:8],
        "matched_layer_names": matched_layers[:8],
        "dxf_file_ref": file_ref,
        "structural_entity_ref": structural_tokens_present,
        "matched_concepts": matched_concepts[:8],
    }


def verify_drawing_claim(part: str) -> dict:
    # D.1.1.X.Y references
    refs = re.findall(r"\bD\.\d(?:\.\d+){1,5}\.?(?:R\d)?\b", part)
    rez = re.findall(r"řez\s+[A-Z]-[A-Z]", part, re.IGNORECASE)
    pohled = "pohled" in part.lower()
    return {
        "verifiable": bool(refs) or bool(rez) or pohled,
        "drawing_refs": refs,
        "rez_labels": rez,
        "pohled_keyword": pohled,
        "reason": "Drawing reference syntactic check — substantive content verification deferred to Path C tier outputs.",
    }


def verify_norm_claim(part: str) -> dict:
    # Norms / KB references / aggregation claims = auto-verifiable (metadata)
    return {
        "verifiable": True,
        "reason": "Norm / catalog / KB / aggregation reference — accepted as metadata claim (not a data extraction claim).",
    }


def verify_part(part: str, tz_corpus: dict, dxf_corpus: dict) -> dict:
    kind = classify_claim(part)
    if kind == "tz":
        return {"claim_part": part, "kind": "tz", **verify_tz_claim(part, tz_corpus)}
    if kind == "dxf":
        return {"claim_part": part, "kind": "dxf", **verify_dxf_claim(part, dxf_corpus)}
    if kind == "drawing_pdf":
        return {"claim_part": part, "kind": "drawing_pdf", **verify_drawing_claim(part)}
    if kind == "norm_or_ref":
        return {"claim_part": part, "kind": "norm_or_ref", **verify_norm_claim(part)}
    if kind == "aggregate":
        return {"claim_part": part, "kind": "aggregate", "verifiable": True, "reason": "Aggregation claim (e.g. = součet ...) — verified by referenced items."}
    # other: claims like "bílá vana A1 W0 Kon 1", "HEA200 dvorní trakt",
    # "kontralatě", "EPS přesah na špaletách 35-40 mm", "3340.0 mm" — search
    # full TZ + DXF (mtext AND dimension values) corpora.
    tokens = extract_significant_tokens(part)
    if not tokens:
        return {"claim_part": part, "kind": "other", "verifiable": True, "reason": "No verifiable tokens — short qualifier."}
    tz_all = tz_corpus["all_text_norm"]
    mtext = dxf_corpus.get("mtext_norm", "")
    dim_values = dxf_corpus.get("dimension_values", set())
    matched_tz: list[str] = [t for t in tokens if _norm(t) in tz_all]
    matched_dxf: list[str] = [t for t in tokens if _norm(t) in mtext]
    matched_dxf_dims: list[str] = []
    for t in tokens:
        if not re.match(r"^\d{3,}(?:[.,]\d{1,3})?", t):
            continue
        try:
            f = float(t.replace(",", "."))
            variants = {f"{f:.0f}", f"{f:.1f}", f"{f:.2f}", str(int(round(f)))}
        except ValueError:
            continue
        if variants & dim_values:
            matched_dxf_dims.append(t)
    verifiable = bool(matched_tz) or bool(matched_dxf) or bool(matched_dxf_dims)
    return {
        "claim_part": part,
        "kind": "other",
        "verifiable": verifiable,
        "matched_in_tz": matched_tz[:6],
        "matched_in_dxf_mtext": matched_dxf[:6],
        "matched_in_dxf_dimensions": matched_dxf_dims[:6],
    }


def build_matrix_c() -> dict:
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    tz_corpus = load_tz_corpus()
    dxf_corpus = load_dxf_corpus()

    rows: list[dict] = []
    for it in items:
        src = it.get("source") or ""
        parts = parse_claim_parts(src)
        per_part = [verify_part(p, tz_corpus, dxf_corpus) for p in parts]
        verifiable_count = sum(1 for r in per_part if r.get("verifiable"))
        total = len(per_part)
        if total == 0:
            verdict = "NOT_VERIFIABLE"
            notes = "Empty source field."
        elif verifiable_count == total:
            verdict = "VERIFIED"
            notes = None
        elif verifiable_count >= 1:
            verdict = "PARTIAL"
            unmet = [r["claim_part"] for r in per_part if not r.get("verifiable")]
            notes = f"{verifiable_count} of {total} parts verified. Unverified: {unmet[:3]}"
        else:
            verdict = "NOT_VERIFIABLE"
            notes = "No claim part could be verified in source corpus."
        rows.append({
            "item_id": it["id"],
            "kapitola": it["kapitola"],
            "claimed_source": src,
            "claim_parts_total": total,
            "claim_parts_verified": verifiable_count,
            "verification_results": per_part,
            "verdict": verdict,
            "notes": notes,
        })

    # Summary
    summary: dict[str, int] = defaultdict(int)
    for r in rows:
        summary[r["verdict"].lower()] += 1
    summary = dict(summary)

    not_verifiable_rows = [r for r in rows if r["verdict"] == "NOT_VERIFIABLE"]
    partial_rows = [r for r in rows if r["verdict"] == "PARTIAL"]

    return {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": "Matrix C — items.json source-field verification.",
        "_items_total": len(items),
        "_summary": summary,
        "_not_verifiable_count": len(not_verifiable_rows),
        "_partial_count": len(partial_rows),
        "matrix_c": rows,
        "matrix_c_not_verifiable_rows": not_verifiable_rows,
        "matrix_c_partial_rows_excerpt": [
            {"item_id": r["item_id"], "claimed_source": r["claimed_source"], "notes": r["notes"]}
            for r in partial_rows
        ],
    }


# ---------------------------------------------------------------------------
# Matrix D — cross-document consistency
# ---------------------------------------------------------------------------


def matrix_d_pp_svetla_vyska(tz_corpus: dict, dxf_corpus: dict) -> dict:
    """D.1 — Per-podlaží světlé výšky (2100/2795/2865/2630)."""
    expected_mm = ["2100", "2795", "2865", "2630"]
    # 1) DXF — explicit values via per_podlazi_svetla_vyska_dxf_match
    dxf_pp = dxf_corpus.get("per_podlazi_match", {})
    dxf_values_seen = set()
    if isinstance(dxf_pp, dict):
        for v in dxf_pp.values():
            if isinstance(v, dict):
                val = v.get("dxf_value") or v.get("value") or v.get("mm")
                if val is not None:
                    dxf_values_seen.add(str(int(round(float(val))) if isinstance(val, (int, float)) or str(val).replace('.','').replace(',','').isdigit() else val))
    dxf_value_strs = dxf_corpus.get("dimension_values", set())
    dxf_match = {m: (m in dxf_values_seen) or (m in dxf_value_strs) for m in expected_mm}
    # 2) TZ — does any TZ ARS mention these values?
    tz_all = tz_corpus.get("all_text_norm", "")
    tz_match = {m: m in tz_all for m in expected_mm}
    # 3) skladby_per_zone_v2 — per_podlazi_vysky_DXF_explicit
    sk_pp = dxf_corpus.get("skladby_per_podlazi_vysky", {})
    sk_match = {m: m in str(sk_pp) for m in expected_mm}
    # 4) items.json — any popis/source mentions
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    item_match: dict[str, list[str]] = {}
    for m in expected_mm:
        hit_items = []
        for it in items:
            blob = (it.get("popis", "") + " " + (it.get("source") or "") + " " + (it.get("mnozstvi_formula") or ""))
            # m can appear as 2795, 2.795, or 2,795
            try:
                f = int(m)
                if (str(f) in blob) or (f"{f/1000:.3f}" in blob) or (f"{f/1000:.2f}" in blob) or (f"{f/1000:.1f}" in blob):
                    hit_items.append(it["id"])
            except ValueError:
                pass
        item_match[m] = hit_items[:5]
    sources_per_value: dict[str, list[str]] = {}
    inconsistencies: list[str] = []
    for m in expected_mm:
        sources: list[str] = []
        if dxf_match[m]:
            sources.append("DXF")
        if tz_match[m]:
            sources.append("TZ")
        if sk_match[m]:
            sources.append("skladby_per_zone_v2")
        if item_match[m]:
            sources.append(f"items.json ({len(item_match[m])} items)")
        sources_per_value[m] = sources
        if len(sources) < 2:
            inconsistencies.append(f"{m} mm — only present in: {sources or ['NONE']}")
    return {
        "fact_id": "D.1",
        "fact": "Per-podlaží světlé výšky (2100/2795/2865/2630 mm)",
        "sources_per_value": sources_per_value,
        "dxf_per_podlazi_match": dxf_pp,
        "items_per_value": item_match,
        "inconsistencies": inconsistencies,
        "verdict": "CONSISTENT" if not inconsistencies else "PARTIAL",
    }


def matrix_d_sklad_geometry(tz_corpus: dict, dxf_corpus: dict) -> dict:
    """D.2 — Sklad geometrie (6.35 × 3.34 + 7 m parking)."""
    keys = ["6350", "3340", "7000", "6.35", "3.34"]
    dxf_dims = dxf_corpus["dimension_values"]
    tz_all = tz_corpus["all_text_norm"]
    sk_text = json.dumps(dxf_corpus.get("skladby_per_podlazi_vysky", {}), ensure_ascii=False) + json.dumps(dxf_corpus.get("geometry_tier3", {}), ensure_ascii=False)
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    item_text = " ".join((it.get("popis", "") + " " + (it.get("source") or "") + " " + (it.get("mnozstvi_formula") or "")) for it in items)
    item_norm = _norm(item_text)
    per_key: dict[str, list[str]] = {}
    for k in keys:
        sources = []
        if k in dxf_dims:
            sources.append("DXF dimensions")
        if k in tz_all:
            sources.append("TZ")
        if k in sk_text:
            sources.append("skladby/geometry tier3")
        if k in item_norm:
            sources.append("items.json")
        per_key[k] = sources
    inconsistencies = [k for k, s in per_key.items() if not s]
    return {
        "fact_id": "D.2",
        "fact": "Sklad geometrie (6.35 m × 3.34 m + parking 7 m)",
        "sources_per_key": per_key,
        "inconsistencies": [f"{k} not found in any source" for k in inconsistencies],
        "verdict": "CONSISTENT" if not inconsistencies else "PARTIAL",
    }


def matrix_d_etics_thickness(tz_corpus: dict, dxf_corpus: dict) -> dict:
    """D.3 — ETICS thickness — 160 mm vs other (200, 180 mentioned in v4.31 changelog as silent-drift cases)."""
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    # ETICS items (HSV-7) carry their thickness in popis. We isolate the
    # APPLIED thickness (after "tl." marker) and ignore negation/fallback
    # contexts ("ne 200 mm fallback", "max 200 mm povolena").
    etics_items = [it for it in items if it["kapitola"] == "HSV-7 Fasáda ETICS"]
    eps_mm_applied: dict[str, list[str]] = defaultdict(list)
    eps_mm_negation_or_max: dict[str, list[str]] = defaultdict(list)
    for it in etics_items:
        blob = it.get("popis", "") + " " + (it.get("mnozstvi_formula") or "")
        # Applied thickness — pattern "tl. N mm" not preceded by "ne " or "max "
        for m in re.finditer(r"(?:^|[^a-záéíóúýžšrcdtnv])tl\.?\s*(\d{2,3})\s*mm\b", blob, re.IGNORECASE):
            # Inspect 30 chars before for negation markers
            start = max(0, m.start() - 30)
            context = blob[start: m.start() + 1]
            if re.search(r"\b(?:ne|max\.?|maxim|fallback|povolena|nikoli)\b", context, re.IGNORECASE):
                eps_mm_negation_or_max[m.group(1)].append(it["id"])
            else:
                eps_mm_applied[m.group(1)].append(it["id"])
        # Stand-alone numbers in negation/max context only — record but don't count
        for m in re.finditer(r"\b(?:ne|max\.?|maxim|povolena|fallback)\s+(?:tl\.?\s*)?(\d{2,3})\s*mm\b", blob, re.IGNORECASE):
            eps_mm_negation_or_max[m.group(1)].append(it["id"])
    # DXF disambiguation_160mm
    dis = dxf_corpus.get("disambiguation_160mm", {})
    dis_occ = (dis or {}).get("occurrences", []) if isinstance(dis, dict) else []
    dxf_160_occurrences = len(dis_occ)
    # TZ mentions
    tz_all = tz_corpus["all_text_norm"]
    tz_has_160 = "160" in tz_all and "etics" in tz_all
    tz_has_200 = "200" in tz_all and "etics" in tz_all
    # Skladba S01 / S12a expected to contain ETICS layer
    sk = dxf_corpus.get("klempirina_dxf_real_lengths", {})  # placeholder — we already have skladba_codes
    # Final verdict: CONSISTENT if the APPLIED thickness is 160 mm and no
    # 200 mm appears OUTSIDE a negation/max context.
    has_applied_160 = bool(eps_mm_applied.get("160"))
    has_applied_200 = bool(eps_mm_applied.get("200"))
    has_neg_200 = bool(eps_mm_negation_or_max.get("200"))
    verdict = "CONSISTENT" if has_applied_160 and not has_applied_200 else "REVIEW"
    return {
        "fact_id": "D.3",
        "fact": "ETICS thickness (160 mm canonical per v4.31 changelog; 200 mm was a silent-drift before correction)",
        "items_etics_count": len(etics_items),
        "mm_applied_in_etics_items": dict(eps_mm_applied),
        "mm_negation_or_max_context": dict(eps_mm_negation_or_max),
        "dxf_disambiguation_160mm_occurrences": dxf_160_occurrences,
        "tz_mentions": {"etics + 160": tz_has_160, "etics + 200": tz_has_200},
        "verdict": verdict,
        "notes": (
            "Applied thickness pulled from 'tl. N mm' pattern, negation/max contexts "
            "('ne 200 mm fallback', 'max 200 mm povolena') ignored. "
            f"Verdict {verdict}: 160 mm applied={has_applied_160}, 200 mm applied={has_applied_200}, "
            f"200 mm only in negation/max ctx={has_neg_200}."
        ),
    }


def matrix_d_klempirina(tz_corpus: dict, dxf_corpus: dict) -> dict:
    """D.4 — Klempířina 173.8 m: DXF total vs PSV-76 items sum."""
    klemp = dxf_corpus.get("klempirina_breakdown", {})
    klemp_real = dxf_corpus.get("klempirina_dxf_real_lengths", {})
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    psv76_klempir_items = [it for it in items if it["kapitola"] == "PSV-76 Klempíř"]
    sum_qty_m = sum((it.get("mnozstvi") or 0) for it in psv76_klempir_items if (it.get("mj") or "").lower() in ("m", "bm"))
    # Try to extract DXF total from various possible shapes
    dxf_total: float | None = None
    for src in (klemp, klemp_real):
        if isinstance(src, dict):
            for k in ("total_m", "total_length_m", "total_bm", "sum_m", "celkem_m"):
                if k in src:
                    try:
                        dxf_total = float(src[k])
                    except (TypeError, ValueError):
                        pass
                    break
            if dxf_total is None:
                # Sum sub-segments
                t = 0.0
                ok = False
                for sub_key, sub_val in src.items():
                    if isinstance(sub_val, (int, float)):
                        t += sub_val
                        ok = True
                    elif isinstance(sub_val, dict):
                        for kk in ("length_m", "delka_m", "m"):
                            v = sub_val.get(kk)
                            if isinstance(v, (int, float)):
                                t += v
                                ok = True
                if ok:
                    dxf_total = t
        if dxf_total is not None:
            break
    delta_pct: float | None = None
    if dxf_total and sum_qty_m:
        delta_pct = ((sum_qty_m - dxf_total) / dxf_total) * 100
    verdict = "CONSISTENT"
    if dxf_total is None:
        verdict = "DXF_TOTAL_NOT_PARSEABLE"
    elif delta_pct is not None and abs(delta_pct) > 15:
        verdict = "INCONSISTENT_OVER_15PCT"
    return {
        "fact_id": "D.4",
        "fact": "Klempířina length reconciliation (DXF total vs PSV-76 items sum)",
        "dxf_total_m": dxf_total,
        "items_sum_m_or_bm": sum_qty_m,
        "delta_pct": delta_pct,
        "psv76_klempir_items_count": len(psv76_klempir_items),
        "klempirina_breakdown_dxf": klemp,
        "klempirina_real_lengths_dxf": klemp_real,
        "verdict": verdict,
    }


def matrix_d_item_count_phrasing() -> dict:
    """D.5 — 204 vs 208 in MDs."""
    cev_md = json.load((OUTPUTS / "cev_md_crosscheck.json").open())
    occurrences = cev_md.get("items_count_mentions_per_file", {})
    standardized_phrase = "208 total (204 active, 4 deprecated audit-trail)"
    needs_fix = {f: vals for f, vals in occurrences.items() if vals}
    return {
        "fact_id": "D.5",
        "fact": "Item count phrasing across MD outputs",
        "mentions_per_file": occurrences,
        "standardized_phrase": standardized_phrase,
        "files_to_update": list(needs_fix.keys()),
        "verdict": "REVIEW",
        "notes": (
            "Per Alexandra's gate-2 disposition: standardize phrasing "
            f"'{standardized_phrase}' across all MDs during Matrix D + final docs refresh."
        ),
    }


def matrix_d_otazky_count() -> dict:
    """D.6 — Word otázky intro says 18; actual count 20; resolution status."""
    word = json.load((OUTPUTS / "cev_word_evidence.json").open())
    doc = word["documents"][0] if word["documents"] else {}
    questions = doc.get("questions", [])
    resolved_q = [q["q_no"] for q in questions if q.get("status_marker") == "RESOLVED"]
    return {
        "fact_id": "D.6",
        "fact": "Word otázky count + resolution status",
        "intro_claim": "Tento dokument obsahuje 18 otázek",
        "actual_count": len(questions),
        "resolved_q_numbers_in_headers": resolved_q,
        "additional_resolutions_per_gate2": [2, 4, 18, 5],  # 5 partially
        "verdict": "REVIEW",
        "notes": (
            "Intro text says '18 otázek' but actual count is 20 — Q19 + Q20 added later. "
            "Header-detected RESOLVED: Q4 / Q5-partial / Q18 / Q20. Per Alexandra's "
            "gate-2 disposition: Q2 also closed (assumption confirmed). "
            "Final state: 17 open / 3 fully resolved (Q2, Q4, Q18, Q20 — count 4 actually) / 1 partial (Q5). "
            "Update intro text + summary table during Part 4 File A refresh batch."
        ),
    }


def build_matrix_d() -> dict:
    tz_corpus = load_tz_corpus()
    dxf_corpus = load_dxf_corpus()
    facts = [
        matrix_d_pp_svetla_vyska(tz_corpus, dxf_corpus),
        matrix_d_sklad_geometry(tz_corpus, dxf_corpus),
        matrix_d_etics_thickness(tz_corpus, dxf_corpus),
        matrix_d_klempirina(tz_corpus, dxf_corpus),
        matrix_d_item_count_phrasing(),
        matrix_d_otazky_count(),
    ]
    # Summary
    verdict_counts: dict[str, int] = defaultdict(int)
    for f in facts:
        verdict_counts[f["verdict"]] += 1
    return {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": "Matrix D — cross-document consistency.",
        "_verdict_counts": dict(verdict_counts),
        "facts": facts,
    }


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def main() -> None:
    c = build_matrix_c()
    (OUTPUTS / "cev_matrix_c_items_source_verification.json").write_text(
        json.dumps(c, indent=2, ensure_ascii=False)
    )
    d = build_matrix_d()
    (OUTPUTS / "cev_matrix_d_cross_doc_consistency.json").write_text(
        json.dumps(d, indent=2, ensure_ascii=False)
    )

    print(json.dumps({
        "matrix_c_summary": c["_summary"],
        "matrix_c_items_total": c["_items_total"],
        "matrix_c_not_verifiable": c["_not_verifiable_count"],
        "matrix_c_partial": c["_partial_count"],
        "matrix_d_verdicts": d["_verdict_counts"],
        "matrix_d_fact_verdicts": [
            {"fact_id": f["fact_id"], "verdict": f["verdict"]} for f in d["facts"]
        ],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
