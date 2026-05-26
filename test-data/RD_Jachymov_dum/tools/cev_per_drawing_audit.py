#!/usr/bin/env python3
"""
CEV addendum — per-drawing extraction completeness audit.

Background: standard "skladby konstrukcí - návrh" legenda appears at the bottom
of every drawing sheet (boilerplate). Each drawing also has UNIQUE annotations
(POZN refs, demolition markings, "stávající"/"návrh" callouts, local
dimensions) that are NOT in the legenda. Risk: prior CEV Layer 1 extraction
covered only TZ PDFs — drawing-specific annotations may be missing.

Approach:
  1. Inventory all 30 PDF sheets under inputs/vykresy_pdf/260219_dum/
  2. Extract text per sheet via pypdf; for 4 scanned sheets (D.2.3.01-04),
     reuse existing OCR data from outputs/ocr_pdfs_extracted.json.
  3. Identify boilerplate by cross-drawing line frequency — lines appearing
     in ≥10 drawings = legenda/razítko/project-info; lines in 1-3 drawings =
     sheet-specific.
  4. Per sheet, harvest distinctive content: POZN refs, S-codes, demolition
     keywords ("bourat", "odstranit", "demont"), "stávající"/"návrh" callouts,
     local dimensions, and statika-callout types.
  5. Compare against CEV Layer 1 TZ evidence corpus + items.json _source
     field to determine whether the sheet-specific content is consumed
     somewhere or is orphan data potentially impacting items.json.
  6. Emit outputs/cev_per_drawing_annotations_audit.json with gap list.

Output schema:
  {
    drawings_inventoried, drawings_with_unique_annotations,
    boilerplate_lines_top_30 (sanity check),
    annotations_per_drawing: {
      <pdf_name>: {
        unique_annotations: N,
        pozn_refs: [...],
        s_codes_called_out: [...],
        demolition_keywords_present: bool,
        stavajici_navrh_callouts: int,
        captured_in_cev_layer1: int,
        captured_in_items_source: int,
        missing_in_cev_and_items: int,
        missing_samples: [...]
      }
    },
    consolidated_missing_annotations: [...]
  }
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict, Counter
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parent.parent
INPUTS = ROOT / "inputs"
OUTPUTS = ROOT / "outputs"
DRAW_DIR = INPUTS / "vykresy_pdf" / "260219_dum"
GEN_AT = "2026-05-26"
GEN_BY = "tools/cev_per_drawing_audit.py"


# ---------------------------------------------------------------------------
# Text extraction (pypdf + OCR reuse for scanned sheets)
# ---------------------------------------------------------------------------


def _normalise(s: str) -> str:
    return " ".join(s.split())


def extract_drawing_text() -> dict[str, dict]:
    """Returns {pdf_basename: {source: 'pypdf'|'ocr', pages: N, text: str}}."""
    out: dict[str, dict] = {}
    # OCR reuse for D.2.3.01-04
    ocr_data: dict[str, str] = {}
    ocr_path = OUTPUTS / "ocr_pdfs_extracted.json"
    if ocr_path.exists():
        ocr = json.load(ocr_path.open())
        for pdf_name, payload in ocr.get("results_per_pdf", {}).items():
            # The OCR file stored 500-char prefixes only — concatenate them
            text = (payload.get("text_sample_first_500") or "") + " " + (payload.get("text_sample_middle_500") or "")
            ocr_data[pdf_name] = text
    for p in sorted(DRAW_DIR.glob("*.pdf")):
        name = p.name
        try:
            reader = pypdf.PdfReader(str(p))
        except Exception as e:
            out[name] = {"source": "error", "error": str(e), "text": ""}
            continue
        pages_text: list[str] = []
        for page in reader.pages:
            try:
                pages_text.append(page.extract_text() or "")
            except Exception:
                pages_text.append("")
        text = "\n".join(pages_text)
        # If pypdf yielded ≤30 chars but OCR data exists, fall back
        if len(text.strip()) < 30 and name in ocr_data:
            out[name] = {"source": "ocr_reuse", "pages": len(reader.pages), "text": ocr_data[name]}
        else:
            out[name] = {"source": "pypdf", "pages": len(reader.pages), "text": text}
    return out


# ---------------------------------------------------------------------------
# Line-frequency boilerplate detection
# ---------------------------------------------------------------------------


def line_split(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines():
        s = _normalise(raw)
        if len(s) >= 4:
            lines.append(s)
    return lines


def compute_line_frequencies(per_drawing: dict[str, dict]) -> Counter[str]:
    freq: Counter[str] = Counter()
    for name, payload in per_drawing.items():
        # De-dup per drawing (one drawing contributes one count per line)
        seen = set(line_split(payload.get("text", "")))
        for ln in seen:
            freq[ln] += 1
    return freq


# ---------------------------------------------------------------------------
# Per-drawing annotation extraction
# ---------------------------------------------------------------------------

POZN_RX = re.compile(r"POZN\.?\s*[\d\.IVXLM]+|\bpozn\.\s*\d+\b", re.IGNORECASE)
SCODE_RX = re.compile(r"\bS\d{1,2}[a-z]?\b")
FCODE_RX = re.compile(r"\bF\d{1,2}[a-z]?\b")
DEMO_RX = re.compile(r"\b(?:bour|demont|odstran|vybou|odbour|odebrat|vykli)\w*", re.IGNORECASE)
STAV_NAVRH_RX = re.compile(r"\b(?:stávající|stavajici|st[áa]v\.?|nový|novy|návrh|navrh)\b", re.IGNORECASE)
DIM_RX = re.compile(r"\b(\d{2,5})(?:[.,]\d{1,3})?\s*(?:mm|cm|m)\b", re.IGNORECASE)


def harvest_annotations(text: str) -> dict:
    pozn = sorted(set(m.group(0).upper().replace(" ", "") for m in POZN_RX.finditer(text)))
    s_codes = sorted(set(SCODE_RX.findall(text)))
    f_codes = sorted(set(FCODE_RX.findall(text)))
    demo_hits = len(DEMO_RX.findall(text))
    sn_hits = len(STAV_NAVRH_RX.findall(text))
    dims = sorted(set(DIM_RX.findall(text)))
    return {
        "pozn_refs": pozn,
        "s_codes_called_out": s_codes,
        "f_codes_called_out": f_codes,
        "demolition_keyword_hits": demo_hits,
        "stavajici_navrh_callout_hits": sn_hits,
        "distinct_dimension_values": dims[:20],
    }


def unique_lines(text: str, freq: Counter[str], boilerplate_threshold: int) -> list[str]:
    seen = set(line_split(text))
    return [ln for ln in seen if freq[ln] <= boilerplate_threshold]


# ---------------------------------------------------------------------------
# Cross-check against existing CEV Layer 1 + items.json
# ---------------------------------------------------------------------------


def load_check_corpora() -> dict:
    tz = json.load((OUTPUTS / "cev_tz_evidence.json").open())
    tz_text = " ".join(e["paragraph_excerpt"] for e in tz["tz_evidence"])
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    items_text = " ".join(
        (it.get("popis", "") + " " + (it.get("source") or "") + " " + (it.get("mnozstvi_formula") or ""))
        for it in items
    )

    def n(s: str) -> str:
        return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))

    return {
        "tz_text_norm": n(tz_text),
        "items_text_norm": n(items_text),
    }


def line_in_corpus(ln: str, corpus: dict) -> tuple[bool, bool]:
    """Returns (in_cev_layer1, in_items_source). Compares normalised tokens
    rather than exact substring to tolerate Czech inflection drift."""
    nl = "".join(c for c in unicodedata.normalize("NFKD", ln.lower()) if not unicodedata.combining(c))
    # Pull salient tokens ≥5 chars and check majority match
    tokens = re.findall(r"[a-z0-9]{5,}", nl)
    if not tokens:
        # Short / numeric — use direct substring
        return (nl in corpus["tz_text_norm"], nl in corpus["items_text_norm"])
    in_tz_count = sum(1 for t in tokens if t in corpus["tz_text_norm"])
    in_items_count = sum(1 for t in tokens if t in corpus["items_text_norm"])
    # "Captured" if ≥50 % of salient tokens match
    return (in_tz_count >= max(1, int(0.5 * len(tokens))),
            in_items_count >= max(1, int(0.5 * len(tokens))))


# ---------------------------------------------------------------------------
# Mojibake-decoded POZN content harvest + items.json cross-check
# ---------------------------------------------------------------------------

# Heuristic mojibake decoder for the custom font used in Půdorys/Řez sheets.
# pypdf and pdfplumber both inherit the broken ToUnicode CMap; only OCR would
# give clean text, but tesseract is not installed in this sandbox. The
# decoder produces readable Czech good enough to disambiguate POZN content
# against items.json.
_MOJIBAKE_TRANS = str.maketrans({
    "ú": "í",   # bouránú → bourání
    "č": "ý",   # nosnčch → nosných
    "ř": "ě",   # střnách → stěnách
    "š": "ě",   # stšnách → stěnách (second variant)
    "Ř": "č",   # Řásti → části
    "ě": "č",   # ěásteŘní → částečně
})
_CID_MAP = {
    "(cid:33)": "ů",
    "(cid:34)": "š",
    "(cid:35)": "ž",
    "(cid:36)": "Ž",
    "(cid:37)": "ž",
}


def _decode_mojibake(s: str) -> str:
    for cid, ch in _CID_MAP.items():
        s = s.replace(cid, ch)
    return s.translate(_MOJIBAKE_TRANS)


_POZN_BLOCK_RX = re.compile(
    r"(?:POZN|pozn)\.?\s*(\d+\.\d+)\s+(.{0,260}?)(?=(?:POZN|pozn)\.?\s*\d|\n\n|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def harvest_pozn_decoded(per_drawing_raw: dict[str, dict]) -> dict[str, dict]:
    """Returns {POZN.X.YY: {decoded_content, occurrence_drawings[]}}.
    Re-extracts via pdfplumber for richer layout when available."""
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        pdfplumber = None

    pozn_content: dict[str, dict] = {}
    for name, payload in per_drawing_raw.items():
        text = payload.get("text", "")
        # Try pdfplumber re-extract for better layout (POZN block recognition)
        path = DRAW_DIR / name
        if pdfplumber is not None and path.exists():
            try:
                with pdfplumber.open(path) as pdf:  # type: ignore
                    rich_text = pdf.pages[0].extract_text() or text
                text = rich_text
            except Exception:
                pass
        for m in _POZN_BLOCK_RX.finditer(text):
            ref_id = "POZN." + m.group(1)
            content = m.group(2).strip()
            if len(content) < 15:
                continue
            decoded = _decode_mojibake(content)
            entry = pozn_content.setdefault(ref_id, {
                "ref_id": ref_id,
                "raw_samples": [],
                "decoded_samples": [],
                "occurrence_drawings": [],
            })
            entry["raw_samples"].append(content[:240])
            entry["decoded_samples"].append(decoded[:240])
            entry["occurrence_drawings"].append(name)
    # Pick the longest / most legible decoded sample as canonical
    for ref_id, entry in pozn_content.items():
        canonical = max(entry["decoded_samples"], key=len)
        entry["canonical_decoded"] = canonical
        # Keep at most 3 raw samples for audit trail
        entry["raw_samples"] = entry["raw_samples"][:3]
        entry["decoded_samples"] = entry["decoded_samples"][:3]
    return pozn_content


# POZN ref → expected (kapitola, keyword set) for items.json match
POZN_EXPECTED_TARGETS: dict[str, dict] = {
    "POZN.1.01": {
        "summary": "Legenda bourání meta (lists demolition categories) — not a procurement item itself.",
        "kapitolas": [],
        "keywords": [],
        "verdict_if_no_match": "META",
    },
    "POZN.1.02": {
        "summary": "Zbourání vrchní části komínu v posledním podlaží",
        "kapitolas": ["HSV-6 Bourací práce"],
        "keywords": ["komín", "komin"],
        "verdict_if_no_match": "GAP",
    },
    "POZN.1.03": {
        "summary": "Částečné bourání opěrných zídek a schodiště (zahrada / dvůr)",
        "kapitolas": ["HSV-6 Bourací práce", "HSV-1 Zemní práce"],
        # Require demolition verb AND zídka/schodiště — else HSV6.004 'zajištění
        # schodiště' (stabilising during strop bourání) is a false positive.
        "keywords_primary": ["bourání opěrn", "bourání zíd", "bourání schod",
                              "demontáž opěrn", "demontáž zíd", "demontáž schod",
                              "odstran. opěrn", "odstran. zíd", "odstran. schod",
                              "odbourání zíd", "odbourání schod", "odbourání opěrn"],
        "keywords_secondary": [],
        "verdict_if_no_match": "GAP",
    },
    "POZN.1.1": {
        "summary": "Výškový systém Balt: ±0,000 = +662,05 m.n.m. (coordinate datum reference)",
        "kapitolas": [],
        "keywords": [],
        "verdict_if_no_match": "META",
    },
    "POZN.2.01": {
        "summary": "Nový vstup do domu přes mezipodestu — lehká ocelová konstrukce přisazená k domu",
        "kapitolas": ["PSV-76 Zámečnictví"],
        "keywords": ["ocelové schodiště", "mezipodest", "lehká ocel"],
        "verdict_if_no_match": "GAP",
    },
    "POZN.2.02": {
        "summary": "Opěrná stěna jako bílá vana + drenáž a odvod vody za opěrnou stěnou",
        "kapitolas": ["HSV-2 Základové a ŽB", "HSV-1 Zemní práce", "PSV-71 Izolace HI"],
        "keywords_primary": ["bílá vana", "opěrná stěn"],
        "keywords_secondary": ["drená", "drenáž", "odvod"],
        "verdict_if_no_match": "GAP",
    },
    "POZN.2.03": {
        "summary": "Posílení stropu/podlahy osazením nové stropnice (viz statika)",
        "kapitolas": ["HSV-4 Vodorovné"],
        "keywords": ["stropnic", "ipe", "hea", "ipn"],
        "verdict_if_no_match": "GAP",
    },
    "POZN.2.04": {
        "summary": "ŽB ztužující věnec (viz statika)",
        "kapitolas": ["HSV-2 Základové a ŽB", "HSV-4 Vodorovné"],
        "keywords": ["věnec", "ztužu"],
        "verdict_if_no_match": "GAP",
    },
    "POZN.2.05": {
        "summary": "Mykologický průzkum + průzkum výskytu dřevokazního hmyzu stávajících trámových stropů",
        "kapitolas": ["VRN — Průzkumy"],
        "keywords_primary": ["mykolog"],
        "keywords_secondary": ["dřevokaz", "drevokaz"],
        "verdict_if_no_match": "GAP",
    },
}


def match_pozn_to_items(pozn_decoded: dict[str, dict]) -> list[dict]:
    items = json.load((OUTPUTS / "items_rd_jachymov_complete.json").open())["items"]
    results: list[dict] = []
    for ref_id, expectation in POZN_EXPECTED_TARGETS.items():
        drawn_in = pozn_decoded.get(ref_id, {}).get("occurrence_drawings", [])
        canonical = pozn_decoded.get(ref_id, {}).get("canonical_decoded", "")
        if not expectation["kapitolas"]:
            results.append({
                "pozn_ref": ref_id,
                "verdict": expectation["verdict_if_no_match"],
                "summary": expectation["summary"],
                "drawn_in_drawings_count": len(drawn_in),
                "canonical_decoded_excerpt": canonical[:240],
                "matched_items_primary": [],
                "matched_items_secondary": [],
            })
            continue

        def _match(keys: list[str]) -> list[str]:
            out: list[str] = []
            for it in items:
                if expectation["kapitolas"] and not any(k in it["kapitola"] for k in expectation["kapitolas"]):
                    continue
                blob = (
                    it.get("popis", "") + " " + (it.get("source") or "") + " "
                    + (it.get("mnozstvi_formula") or "") + " " + it.get("subkapitola", "")
                ).lower()
                if any(kw.lower() in blob for kw in keys):
                    out.append(it["id"])
            return out

        if "keywords_primary" in expectation:
            primary = _match(expectation["keywords_primary"])
            secondary = _match(expectation.get("keywords_secondary", []))
            if primary and secondary:
                verdict = "COVERED"
            elif primary or secondary:
                verdict = "PARTIAL"
                if primary and not secondary:
                    # Primary covered but secondary aspect missing
                    verdict = "ENRICHMENT" if ref_id == "POZN.2.05" else "PARTIAL"
            else:
                verdict = expectation["verdict_if_no_match"]
        else:
            keys = expectation.get("keywords", [])
            primary = _match(keys)
            secondary = []
            verdict = "COVERED" if primary else expectation["verdict_if_no_match"]

        results.append({
            "pozn_ref": ref_id,
            "verdict": verdict,
            "summary": expectation["summary"],
            "drawn_in_drawings_count": len(drawn_in),
            "drawn_in_drawings": drawn_in[:8],
            "canonical_decoded_excerpt": canonical[:240],
            "expected_kapitolas": expectation["kapitolas"],
            "matched_items_primary": primary[:8],
            "matched_items_secondary": secondary[:8],
            "fix_recommendation": (
                None if verdict in ("COVERED", "META") else
                _gap_recommendation(ref_id, expectation, primary, secondary)
            ),
        })
    return results


def _gap_recommendation(ref_id: str, exp: dict, primary: list[str], secondary: list[str]) -> str:
    if ref_id == "POZN.1.02":
        return ("Add HSV-6 item 'Zbourání vrchní části komínu v posledním podlaží — manuální demolice "
                "+ likvidace cihelné suti' with qty per DXF or per estimate (~5-10 m³ suti).")
    if ref_id == "POZN.1.03":
        return ("Add HSV-6 item 'Bourání stávajících opěrných zídek + venkovního schodiště (zahrada/dvůr) — "
                "částečné' with qty per DXF cross-section. Current HSV6.004 covers trámový strop only.")
    if ref_id == "POZN.2.01":
        return ("Already COVERED by PSV76.001 — no action."  # never reached, here for completeness
                if primary else
                "Add PSV-76 Zámečnictví item for lehká ocelová konstrukce nového vstupu (mezipodesta).")
    if ref_id == "POZN.2.02":
        # BV covered, drenáž missing
        if primary and not secondary:
            return ("Add HSV-1 (or PSV-71 Izolace HI) item 'Drenáž za opěrnou stěnou (bílou vanou) — "
                    "drenážní trubka DN100 + štěrkový obsyp + geotextilie + napojení do dešťové "
                    "kanalizace, L≈10 m po obvodu BV per POZN.2.02 z půdorysů návrh + řez A-A.")
        return "Add bílá vana + drenáž items (HSV-2 + HSV-1/PSV-71)."
    if ref_id == "POZN.2.03":
        return ("Add HSV-4 stropnice items per POZN.2.03 + statika reference."
                if not primary else "Already COVERED — no action.")
    if ref_id == "POZN.2.04":
        return ("Add HSV-2/4 ŽB ztužující věnec items."
                if not primary else "Already COVERED — no action.")
    if ref_id == "POZN.2.05":
        # mykologický covered, dřevokazný hmyz survey missing — enrichment
        if primary and not secondary:
            return ("ENRICHMENT: VRN.001 'Mykologický průzkum' should be reworded to 'Mykologický "
                    "průzkum + průzkum výskytu dřevokazního hmyzu' per POZN.2.05 of návrh drawings. "
                    "Scope and price likely unchanged (same autorizovaný expert performs both).")
        return "Add VRN — Průzkumy mykologický + dřevokazný hmyz item."
    return "Manual review needed — see POZN.2.05 decoded sample."


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def main() -> None:
    per_drawing_raw = extract_drawing_text()
    freq = compute_line_frequencies(per_drawing_raw)
    n_draw = len(per_drawing_raw)
    # Boilerplate threshold: line appearing in ≥40 % of drawings counts as
    # legenda/razítko/project-info — treat as boilerplate to exclude.
    boilerplate_threshold = max(2, int(0.4 * n_draw))
    boilerplate_top = [(ln, c) for ln, c in freq.most_common(50) if c >= boilerplate_threshold]

    corpus = load_check_corpora()

    # Decode mojibake-safe POZN content extraction (separate pass — pdfplumber
    # extracts a custom-encoded font but ID + heuristic decoding gives
    # readable Czech that we can cross-check against items.json).
    pozn_decoded = harvest_pozn_decoded(per_drawing_raw)

    annotations_per_drawing: dict[str, dict] = {}
    consolidated_missing: list[dict] = []
    drawings_with_unique = 0

    for name, payload in per_drawing_raw.items():
        text = payload.get("text", "")
        if not text.strip():
            annotations_per_drawing[name] = {"source": payload.get("source"), "note": "Empty text (scanned, OCR fallback missing)", "unique_annotations": 0}
            continue
        anno = harvest_annotations(text)
        uniq = unique_lines(text, freq, boilerplate_threshold)
        actionable_lines: list[str] = []
        for ln in uniq:
            if (POZN_RX.search(ln) or SCODE_RX.search(ln) or DEMO_RX.search(ln)
                    or STAV_NAVRH_RX.search(ln)
                    or re.search(r"\b(?:tl\.?|tlouš|izolac|stena|krov|krokev|strop|podlah|překlad|sokl|atika)\w*", ln, re.IGNORECASE)):
                actionable_lines.append(ln)

        in_tz: list[str] = []
        in_items: list[str] = []
        missing: list[str] = []
        for ln in actionable_lines:
            in_t, in_i = line_in_corpus(ln, corpus)
            if in_t:
                in_tz.append(ln)
            if in_i:
                in_items.append(ln)
            if not (in_t or in_i):
                missing.append(ln)

        if actionable_lines:
            drawings_with_unique += 1

        pozn_not_captured = []
        for p in anno["pozn_refs"]:
            id_n = p.lower()
            if id_n not in corpus["tz_text_norm"] and id_n not in corpus["items_text_norm"]:
                pozn_not_captured.append(p)

        annotations_per_drawing[name] = {
            "source": payload.get("source"),
            "pages": payload.get("pages", 1),
            "text_chars": len(text),
            "unique_actionable_lines_total": len(actionable_lines),
            "captured_in_cev_layer1": len(in_tz),
            "captured_in_items_source": len(in_items),
            "missing_in_cev_and_items": len(missing),
            "missing_samples": missing[:8],
            "pozn_refs_total": len(anno["pozn_refs"]),
            "pozn_refs": anno["pozn_refs"][:40],
            "pozn_not_captured_anywhere": pozn_not_captured,
            "s_codes_called_out": anno["s_codes_called_out"][:40],
            "f_codes_called_out": anno["f_codes_called_out"][:20],
            "demolition_keyword_hits": anno["demolition_keyword_hits"],
            "stavajici_navrh_callout_hits": anno["stavajici_navrh_callout_hits"],
            "distinct_dimension_count": len(anno["distinct_dimension_values"]),
        }

        for ln in missing:
            if POZN_RX.search(ln) or DEMO_RX.search(ln):
                consolidated_missing.append({
                    "drawing": name,
                    "annotation_excerpt": ln[:240],
                    "category": (
                        "pozn_reference" if POZN_RX.search(ln) else
                        "demolition_callout" if DEMO_RX.search(ln) else
                        "other"
                    ),
                    "impact": (
                        "POZN reference appears on this drawing but its identifier is not in TZ Layer 1 evidence "
                        "and not in items.json source field — check whether it pertains to a procurement item."
                        if POZN_RX.search(ln) else
                        "Demolition callout on this drawing not directly cross-referenced in TZ / items.json — "
                        "verify HSV-6 items capture this scope."
                    ),
                })

    # Cross-check decoded POZN content against items.json to derive concrete
    # gap/cover verdicts.
    pozn_verdicts = match_pozn_to_items(pozn_decoded)

    output = {
        "_schema_version": "1.1",
        "_generated_at": GEN_AT,
        "_generated_by": GEN_BY,
        "_purpose": (
            "Per-drawing extraction completeness audit. Verifies whether unique "
            "annotations on each drawing (POZN refs, demolition markings, "
            "stav/návrh callouts, S-code call-outs) are captured in CEV Layer 1 "
            "evidence and/or items.json _source field. Boilerplate (skladby "
            "legenda, razítko, project info) excluded via cross-drawing line "
            "frequency analysis. Mojibake-decoded POZN content cross-matched "
            "against items.json kapitola+keyword for concrete gap verdicts."
        ),
        "drawings_inventoried": n_draw,
        "drawings_with_unique_annotations": drawings_with_unique,
        "boilerplate_threshold_drawings": boilerplate_threshold,
        "boilerplate_top_lines": [{"line": ln[:200], "appears_in_n_drawings": c} for ln, c in boilerplate_top],
        "pozn_decoded_content": pozn_decoded,
        "pozn_to_items_verdicts": pozn_verdicts,
        "annotations_per_drawing": annotations_per_drawing,
        "consolidated_missing_annotations": consolidated_missing,
        "_summary_counts": {
            "consolidated_missing_count": len(consolidated_missing),
            "total_unique_actionable_lines": sum(d.get("unique_actionable_lines_total", 0) for d in annotations_per_drawing.values()),
            "total_captured_in_cev_layer1": sum(d.get("captured_in_cev_layer1", 0) for d in annotations_per_drawing.values()),
            "total_captured_in_items_source": sum(d.get("captured_in_items_source", 0) for d in annotations_per_drawing.values()),
            "total_missing_in_cev_and_items": sum(d.get("missing_in_cev_and_items", 0) for d in annotations_per_drawing.values()),
            "pozn_gap_count": sum(1 for v in pozn_verdicts if v["verdict"] == "GAP"),
            "pozn_covered_count": sum(1 for v in pozn_verdicts if v["verdict"] == "COVERED"),
            "pozn_partial_count": sum(1 for v in pozn_verdicts if v["verdict"] == "PARTIAL"),
            "pozn_enrichment_count": sum(1 for v in pozn_verdicts if v["verdict"] == "ENRICHMENT"),
            "pozn_meta_count": sum(1 for v in pozn_verdicts if v["verdict"] == "META"),
        },
    }

    (OUTPUTS / "cev_per_drawing_annotations_audit.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False)
    )

    print(json.dumps({
        "drawings_inventoried": n_draw,
        "drawings_with_unique_annotations": drawings_with_unique,
        "summary_counts": output["_summary_counts"],
        "pozn_verdicts": [
            {"pozn_ref": v["pozn_ref"], "verdict": v["verdict"], "summary": v.get("summary", "")[:120]}
            for v in pozn_verdicts
        ],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
