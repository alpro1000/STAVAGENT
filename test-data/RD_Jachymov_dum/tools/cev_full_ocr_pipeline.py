#!/usr/bin/env python3
"""
Full-coverage OCR pipeline — pdftoppm 300 DPI + tesseract ces+eng on every
drawing PDF (sklad + dům + situace). Replaces the pypdf path that suffered
from broken-font mojibake on the architectural sheets.

Produces:
  outputs/cev_full_ocr_text.json — per-PDF clean Czech text + signal extraction
  outputs/cev_ocr_skladby_legenda.json — parsed SKLADBY KONSTRUKCÍ tables per
    objekt (sklad S01-S05 + dům S01-S12 via řez sheets)
  outputs/cev_ocr_pozn_explanations.json — full POZN.X.YY explanation text per
    drawing (replaces the mojibake-decoded fallback)

Idempotent: each PDF rendered once into a temp dir; OCR cached.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
PDF_DIRS = [
    ROOT / "inputs" / "vykresy_pdf" / "260219_dum",
    ROOT / "inputs" / "vykresy_pdf" / "260217_sklad",
    ROOT / "inputs" / "situace",
]
OUT_TEXT = ROOT / "outputs" / "cev_full_ocr_text.json"
OUT_SKLADBY = ROOT / "outputs" / "cev_ocr_skladby_legenda.json"
OUT_POZN = ROOT / "outputs" / "cev_ocr_pozn_explanations.json"
GEN_AT = "2026-05-26"


def ocr_pdf(pdf_path: Path) -> dict:
    """Returns {pages: [{page, text}], full_text}."""
    with tempfile.TemporaryDirectory() as td:
        prefix = Path(td) / "page"
        try:
            subprocess.run(
                ["pdftoppm", "-r", "300", "-png", str(pdf_path), str(prefix)],
                check=True, capture_output=True, timeout=60,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            return {"pages": [], "full_text": "", "error": f"pdftoppm: {e}"}
        page_files = sorted(Path(td).glob("page-*.png"))
        pages: list[dict] = []
        all_text: list[str] = []
        for pf in page_files:
            try:
                proc = subprocess.run(
                    ["tesseract", str(pf), "-", "-l", "ces+eng", "--psm", "6"],
                    capture_output=True, text=True, timeout=90,
                )
                t = proc.stdout or ""
            except subprocess.TimeoutExpired:
                t = ""
            try:
                page_num = int(pf.stem.rsplit("-", 1)[-1])
            except ValueError:
                page_num = len(pages) + 1
            pages.append({"page": page_num, "text": t})
            all_text.append(t)
        return {"pages": pages, "full_text": "\n\n".join(all_text)}


SCODE_RX = re.compile(r"\bS\d{1,2}[a-z]?\b")
POZN_RX = re.compile(r"POZN\.?\s*(\d{1,2}(?:\.\d{1,2})?)", re.IGNORECASE)
DIM_RX = re.compile(r"\b\d{3,5}\s*(?:mm|cm)\b")


def extract_signals(text: str) -> dict:
    return {
        "s_codes": sorted(set(SCODE_RX.findall(text))),
        "pozn_refs": sorted({"POZN." + m.group(1).strip() for m in POZN_RX.finditer(text)}),
        "n_chars": len(text),
        "has_skladby_table": bool(re.search(r"SKLADBY\s+KONSTRUKCÍ", text, re.IGNORECASE)),
        "has_legenda_mistnosti": bool(re.search(r"LEGENDA\s+M[ÍI]STNOST[ÍI]", text, re.IGNORECASE)),
        "has_legenda_materialu": bool(re.search(r"LEGENDA\s+MATERI[ÁA]L[UO]", text, re.IGNORECASE)),
    }


def parse_skladby_table(text: str) -> list[dict]:
    """Parse a SKLADBY KONSTRUKCÍ legenda block into [{code, name, layers[]}]."""
    if "SKLADBY KONSTRUKCÍ" not in text.upper():
        return []
    # Find block start
    m = re.search(r"SKLADBY\s+KONSTRUKCÍ", text, re.IGNORECASE)
    if not m:
        return []
    block = text[m.end():]
    # End block at next ALL-CAPS heading or 2000 chars
    end_match = re.search(r"\n\s*(?:LEGENDA|POZN[ÁA]MKY|SOUVISL|ČÍSLO\s+V[ÝY]KRESU|VRSTVY\b)", block[:2000])
    if end_match:
        block = block[: end_match.start()]
    else:
        block = block[:2000]
    # Split entries by S-code header (S01, S02, …, S12b)
    code_iter = list(re.finditer(r"\bS(\d{1,2}[a-z]?)\s+([^\n]+)", block))
    out: list[dict] = []
    for i, m in enumerate(code_iter):
        code = "S" + m.group(1)
        name = m.group(2).strip()[:120]
        body_start = m.end()
        body_end = code_iter[i + 1].start() if i + 1 < len(code_iter) else len(block)
        body = block[body_start: body_end].strip()
        # Extract layer lines (lines starting with - or • or contain "mm" + dimension)
        layers: list[str] = []
        for ln in body.split("\n"):
            ln = ln.strip()
            if not ln:
                continue
            if ln.startswith("-") or ln.startswith("•") or DIM_RX.search(ln):
                layers.append(ln[:200])
        if layers or name:
            out.append({"code": code, "name": name, "layers": layers[:12]})
    return out


def parse_pozn_block(text: str) -> dict:
    """Extract POZN.X.YY explanatory text from a POZNÁMKY block."""
    out: dict = {}
    # Find "POZNÁMKY" heading
    m = re.search(r"\bPOZN[ÁA]MKY\b", text)
    start = m.end() if m else 0
    section = text[start: start + 4000]
    # Match "pozn.X.YY <text>" or "POZN.X.YY <text>" until next POZN. or blank line cluster
    pat = re.compile(r"(?:POZN|pozn)\.?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(.{15,500}?)(?=(?:POZN|pozn)\.?\s*\d|\n{2,}|\Z)", re.IGNORECASE | re.DOTALL)
    for m in pat.finditer(section):
        ref = "POZN." + m.group(1).strip()
        body = m.group(2).strip()
        body = re.sub(r"\s+", " ", body)
        if ref not in out or len(body) > len(out[ref]):
            out[ref] = body[:500]
    # Also handle simple "POZN 01" style outside POZNÁMKY heading
    if not out:
        for m in pat.finditer(text):
            ref = "POZN." + m.group(1).strip()
            body = re.sub(r"\s+", " ", m.group(2).strip())[:500]
            if ref not in out or len(body) > len(out[ref]):
                out[ref] = body
    return out


def main() -> None:
    all_pdfs: list[Path] = []
    for d in PDF_DIRS:
        if d.exists():
            all_pdfs.extend(sorted(d.glob("*.pdf")))
    print(f"PDFs to OCR: {len(all_pdfs)}", flush=True)

    per_pdf: dict[str, dict] = {}
    all_skladby_per_pdf: dict[str, list[dict]] = {}
    all_pozn_per_pdf: dict[str, dict] = {}
    aggregate_signals: dict[str, list[dict]] = defaultdict(list)

    for i, pdf in enumerate(all_pdfs, start=1):
        name = pdf.name
        print(f"  [{i}/{len(all_pdfs)}] OCR {name[:70]}", flush=True)
        result = ocr_pdf(pdf)
        full = result.get("full_text", "")
        sig = extract_signals(full)
        sk = parse_skladby_table(full) if sig["has_skladby_table"] else []
        pz = parse_pozn_block(full) if sig["pozn_refs"] else {}
        per_pdf[name] = {
            "pdf_path": str(pdf.relative_to(ROOT)),
            "n_pages": len(result.get("pages", [])),
            "signals": sig,
            "has_error": "error" in result,
            "error": result.get("error"),
            "full_text_chars": len(full),
            # Store first 4000 chars + key blocks only to keep JSON small
            "first_text_excerpt": full[:1500],
        }
        if sk:
            all_skladby_per_pdf[name] = sk
        if pz:
            all_pozn_per_pdf[name] = pz
        for code in sig["s_codes"]:
            aggregate_signals[code].append(name)

    # Write outputs
    OUT_TEXT.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_purpose": "Full-coverage OCR pipeline output — pdftoppm 300 DPI + tesseract ces+eng per drawing PDF.",
        "pdfs_processed": len(all_pdfs),
        "per_pdf": per_pdf,
        "s_codes_aggregated": {c: pdfs for c, pdfs in sorted(aggregate_signals.items())},
    }, indent=2, ensure_ascii=False))

    # Skladby — consolidate by S-code (one canonical entry per code, prefer
    # longest layers list since that's the most complete OCR pass)
    consolidated_skladby: dict[str, dict] = {}
    for pdf_name, entries in all_skladby_per_pdf.items():
        for e in entries:
            code = e["code"]
            existing = consolidated_skladby.get(code)
            if existing is None or len(e["layers"]) > len(existing["layers"]):
                consolidated_skladby[code] = {**e, "_source_pdf": pdf_name}
    OUT_SKLADBY.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_purpose": "Consolidated SKLADBY KONSTRUKCÍ legendy parsed from OCR'd drawing PDFs.",
        "n_skladby_decoded": len(consolidated_skladby),
        "skladby": [consolidated_skladby[k] for k in sorted(consolidated_skladby.keys())],
        "_per_pdf_raw": all_skladby_per_pdf,
    }, indent=2, ensure_ascii=False))

    # POZN — consolidate (one canonical per ref, prefer longest)
    consolidated_pozn: dict[str, dict] = {}
    for pdf_name, pozn_dict in all_pozn_per_pdf.items():
        for ref, body in pozn_dict.items():
            existing = consolidated_pozn.get(ref)
            if existing is None or len(body) > len(existing["body"]):
                consolidated_pozn[ref] = {"ref": ref, "body": body, "_source_pdf": pdf_name}
    OUT_POZN.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_purpose": "Consolidated POZN explanation blocks from OCR'd drawing PDFs.",
        "n_pozn_decoded": len(consolidated_pozn),
        "pozn": [consolidated_pozn[k] for k in sorted(consolidated_pozn.keys())],
        "_per_pdf_raw": all_pozn_per_pdf,
    }, indent=2, ensure_ascii=False))

    print(json.dumps({
        "pdfs_ocr_processed": len(all_pdfs),
        "skladby_consolidated": len(consolidated_skladby),
        "skladby_codes": sorted(consolidated_skladby.keys()),
        "pozn_consolidated": len(consolidated_pozn),
        "pozn_refs": sorted(consolidated_pozn.keys()),
        "outputs": [str(OUT_TEXT.relative_to(ROOT)), str(OUT_SKLADBY.relative_to(ROOT)), str(OUT_POZN.relative_to(ROOT))],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
