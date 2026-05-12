"""Phase 0b — TZ PDF token extractor for hk212_hala.

Deterministic regex pass over all 7 TZ PDFs. Extracts the canonical
construction tokens from spec §3.3:

- Concrete classes (C20/25, C25/30, ...)
- Exposure classes (XC1..XC4, XF1..XF4, XD1..XD3, XA1..XA3, XS1..XS3)
- Steel grades (S235, S355JR, B500B, R25)
- Fire resistance (EI/EW/R/REI <minutes> DP1..DP3, BROOF(t1..t4))
- Czech standards (ČSN EN 206, ČSN EN 62305, ČSN 73 ..., etc.)
- Powers (kW), flows (m³/h), dimensions (NNNN×NNNN mm)
- Reinforcement densities (kg/m³), spans, diameters (Ø600..Ø1500 mm)

Uses PyMuPDF (fitz) for text extraction — pdfplumber is unavailable in this
sandbox (system cryptography binding is broken; venv install of pdfplumber
fails on cffi/pyo3 conflict).

Run from repo root::

    python3 test-data/hk212_hala/scripts/extract_tz.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import fitz  # PyMuPDF

REPO_ROOT = Path(__file__).resolve().parents[3]
INPUTS_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "inputs" / "tz"
OUTPUT_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "outputs" / "tz_specs"


# --- Regex patterns (deterministic, confidence 1.0 per spec §5) ---
PATTERNS: dict[str, re.Pattern[str]] = {
    "concrete_class": re.compile(r"\bC\s?\d{1,2}\s?/\s?\d{1,2}\b"),
    "exposure_class": re.compile(r"\bX[CFDSAB]\d\b"),
    "steel_grade":    re.compile(r"\bS\s?\d{3}(?:[JR][LRWLOR]?)?(?:\s?[+]?[NTQM])?\b"),
    "rebar_grade":    re.compile(r"\bB\s?\d{3}[AB]?\b"),
    "rebar_round":    re.compile(r"\bR\s?\d{1,3}(?:\s?mm)?\b"),
    "fire_class":     re.compile(r"\b(?:EI|EW|REI|R)\s?\d{1,3}\s?(?:DP[123])?\b"),
    "broof":          re.compile(r"\bBROOF\s?\(\s?t\d\s?\)"),
    "csn":            re.compile(r"\bČSN(?:\s+EN)?\s+\d{2,4}(?:[-\s]\d{1,4})?(?:-\d{1,4})?", re.IGNORECASE),
    "power_kw":       re.compile(r"\b\d+(?:[,.]\d+)?\s?kW\b"),
    "flow_m3h":       re.compile(r"\b\d+\s?m[³3]\s?/\s?h\b"),
    "dim_mm":         re.compile(r"\b\d{2,5}\s?[x×X]\s?\d{2,5}(?:\s?[x×X]\s?\d{2,5})?\s?mm\b"),
    "depth_m":        re.compile(r"-?\d+[,.]?\d*\s?m\b"),
    "diameter_pile":  re.compile(r"\bØ\s?(\d{2,4})\b"),
    "rebar_kg_m3":    re.compile(r"\b\d{2,3}\s?kg\s?/\s?m[³3]\b"),
    "span_m":         re.compile(r"(?:\brozpětí\b|\bspan\b|\bL\s?=\s?)\s?\d+(?:[,.]\d+)?\s?m\b", re.IGNORECASE),
    "thickness_mm":   re.compile(r"\btl\.?\s?\d{2,4}\s?mm\b", re.IGNORECASE),
    "load_kpa":       re.compile(r"\b\d+(?:[,.]\d+)?\s?(?:kPa|kN/m[²2])\b"),
    "ipe":            re.compile(r"\bIPE\s?\d{2,4}\b"),
    "hea":            re.compile(r"\bHEA\s?\d{2,4}\b"),
    "heb":            re.compile(r"\bHEB\s?\d{2,4}\b"),
    "upe":            re.compile(r"\bUPE\s?\d{2,4}\b"),
    "upn":            re.compile(r"\bUPN\s?\d{2,4}\b"),
    "L_angle":        re.compile(r"\bL\s?\d{2,3}\s?/\s?\d{2,3}\s?/\s?\d{1,2}\b"),
    "kari_mesh":      re.compile(r"\bKARI\s+Ø?\s?\d{1,2}\s+(?:oka\s+)?\d{2,3}\s?[x×]\s?\d{2,3}\b", re.IGNORECASE),
    "amperage_3p":    re.compile(r"\b3\s?[x×]\s?\d{2,4}\s?A\b"),
    "cable_cyky":     re.compile(r"\bCYKY-?[JO]?\s+\d{1,2}[x×]\d{1,3}(?:[,.]\d{1,3})?\s?(?:mm[²2])?\b"),
    "potrubi":        re.compile(r"\b(?:PE|PP-?RCT?|PVC[\s-]?KG)\s?\d{1,4}(?:\s?mm)?\b"),
    "dn":             re.compile(r"\bDN\s?\d{1,4}\b"),
}


def extract_text(pdf_path: Path) -> tuple[str, int]:
    """Return concatenated text from all pages + page count."""
    doc = fitz.open(str(pdf_path))
    try:
        pages = [page.get_text("text") for page in doc]
        return "\n\n".join(pages), len(pages)
    finally:
        doc.close()


def regex_pass(text: str) -> dict[str, dict[str, int]]:
    """Return {pattern_name: {match_value: count}}."""
    out: dict[str, dict[str, int]] = {}
    for name, rx in PATTERNS.items():
        counter: Counter[str] = Counter()
        for m in rx.finditer(text):
            value = m.group(0).strip()
            # Normalize whitespace inside the match
            value = re.sub(r"\s+", " ", value)
            counter[value] += 1
        if counter:
            out[name] = dict(counter.most_common())
    return out


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(INPUTS_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"ERROR: no PDFs in {INPUTS_DIR}", file=sys.stderr)
        return 1

    print(f"# Extracting tokens from {len(pdfs)} TZ PDFs\n")
    aggregate: dict[str, Counter[str]] = defaultdict(Counter)

    for path in pdfs:
        text, pages = extract_text(path)
        tokens = regex_pass(text)
        out_path = OUTPUT_DIR / (path.stem + ".json")
        out_path.write_text(json.dumps({
            "file": path.name,
            "pages": pages,
            "char_count": len(text),
            "tokens": tokens,
        }, ensure_ascii=False, indent=2))
        kinds = len(tokens)
        total_tokens = sum(sum(v.values()) for v in tokens.values())
        print(f"  ✓ {path.name:42s}  {pages:3d}p  {len(text):>7d}ch  {kinds:2d}kinds  {total_tokens:4d}tokens")
        for kind, values in tokens.items():
            for v, c in values.items():
                aggregate[kind][v] += c

    # Aggregate summary
    summary_path = OUTPUT_DIR / "_aggregate.json"
    summary_path.write_text(json.dumps(
        {k: dict(v.most_common()) for k, v in aggregate.items()},
        ensure_ascii=False, indent=2,
    ))
    print(f"\n  → aggregate: {summary_path.relative_to(REPO_ROOT)}")

    # Surface most interesting findings on stdout
    print(f"\n# Top findings across all TZ PDFs")
    for kind in ["concrete_class", "exposure_class", "steel_grade", "rebar_grade",
                 "fire_class", "broof", "ipe", "hea", "heb", "upe", "L_angle",
                 "kari_mesh", "csn", "power_kw", "flow_m3h", "dim_mm",
                 "amperage_3p", "cable_cyky", "diameter_pile"]:
        if kind not in aggregate:
            continue
        items = aggregate[kind].most_common(8)
        rendered = ", ".join(f"{v}×{c}" for v, c in items)
        print(f"  {kind:18s} {rendered}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
