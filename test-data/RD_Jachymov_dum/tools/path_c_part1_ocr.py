#!/usr/bin/env python3
"""
Path C — Část 1: OCR attempt na 6 drawing-heavy / scanned PDFs.

Pipeline:
  1. pdftoppm — render PDF page → PNG @ 300 DPI
  2. tesseract (Czech language) → extract text
  3. Search for skladby legendy / dimensions / S-codes / tabulky
  4. Cross-reference s existing data

Honest mode: if OCR yields no useful text, log _ocr_failed_reason explicit.
Output: outputs/ocr_pdfs_extracted.json
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent
INPUTS = PROJ / "inputs"
OUT = PROJ / "outputs"

TARGETS = [
    INPUTS / "vykresy_pdf" / "260219_dum" / "D.2.3.01 - výkres tvaru 1.PP _ EAR.pdf",
    INPUTS / "vykresy_pdf" / "260219_dum" / "D.2.3.02 - výkres tvaru 1.NP _ EAR.pdf",
    INPUTS / "vykresy_pdf" / "260219_dum" / "D.2.3.03 - výkres tvaru 2.NP _ EAR.pdf",
    INPUTS / "vykresy_pdf" / "260219_dum" / "D.2.3.04 - výkres tvaru 3.NP _ EAR.pdf",
    INPUTS / "situace" / "C.01 - Situační výkres širších vztahů _ EAR.pdf",
    INPUTS / "dokladova_cast" / "03.03 - město Jáchymov - Vyjádření k žádosti.pdf",
]

SCODE_RE = re.compile(r"\bS\d{1,2}[a-z]?\b")
FCODE_RE = re.compile(r"\bF\d{1,2}[a-z]?\b")
DIM_RE = re.compile(r"\b\d{3,5}\s*mm\b|\b\d+[,.]\d+\s*m\b")
MATERIAL_RE = re.compile(r"\b(EPS|PIR|XPS|MW|HEA|IPE|IPN|UPE|JEKL|Porotherm|Ytong)\b", re.IGNORECASE)


def ocr_pdf(pdf_path: Path) -> dict:
    """Render PDF → PNG → tesseract OCR (Czech)."""
    result = {
        "path": str(pdf_path.relative_to(PROJ)),
        "size_bytes": pdf_path.stat().st_size,
    }
    if not pdf_path.exists():
        result["_ocr_failed_reason"] = "FILE_NOT_FOUND"
        return result

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        png_prefix = td_path / "page"
        # Render at 300 DPI
        try:
            subprocess.run(
                ["pdftoppm", "-r", "300", "-png", str(pdf_path), str(png_prefix)],
                capture_output=True, timeout=60, check=True,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            result["_ocr_failed_reason"] = f"pdftoppm_failed: {type(e).__name__}: {str(e)[:120]}"
            return result

        pngs = sorted(td_path.glob("page-*.png"))
        if not pngs:
            result["_ocr_failed_reason"] = "no_pages_rendered"
            return result

        all_text = []
        for i, png in enumerate(pngs):
            try:
                ocr_out = subprocess.run(
                    ["tesseract", str(png), "-", "-l", "ces+eng", "--psm", "6"],
                    capture_output=True, text=True, timeout=120,
                )
                page_text = ocr_out.stdout
                all_text.append(page_text)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                all_text.append(f"[OCR error page {i}: {type(e).__name__}]")
        text = "\n\n".join(all_text)

    result["pages_rendered"] = len(pngs)
    result["ocr_text_length"] = len(text)

    # Probe for useful markers
    scodes = sorted(set(SCODE_RE.findall(text)))
    fcodes = sorted(set(FCODE_RE.findall(text)))
    dimensions = sorted(set(DIM_RE.findall(text)))
    materials = sorted(set(MATERIAL_RE.findall(text)))
    result["scodes_found"] = scodes
    result["fcodes_found"] = fcodes
    result["dimensions_found"] = dimensions[:20]
    result["material_markers"] = materials

    # Sample text for review
    if text.strip():
        # First 500 chars + middle 500 chars
        result["text_sample_first_500"] = text[:500].strip()
        if len(text) > 1000:
            mid = len(text) // 2
            result["text_sample_middle_500"] = text[mid:mid + 500].strip()

    # Status
    if not text.strip():
        result["_ocr_failed_reason"] = "empty_after_ocr"
        result["probe_status"] = "ocr_empty"
    elif len(text) < 100:
        result["probe_status"] = "ocr_very_low_text"
    else:
        result["probe_status"] = "ocr_extracted"

    return result


def main():
    OUT.mkdir(exist_ok=True)
    print(f"[OCR] Processing {len(TARGETS)} drawing-heavy PDFs via pdftoppm 300 DPI + tesseract ces+eng...", file=sys.stderr)

    results = {}
    for i, pdf in enumerate(TARGETS, 1):
        print(f"  [{i}/{len(TARGETS)}] {pdf.name}", file=sys.stderr)
        results[pdf.name] = ocr_pdf(pdf)
        r = results[pdf.name]
        status = r.get("probe_status") or r.get("_ocr_failed_reason", "?")
        chars = r.get("ocr_text_length", 0)
        n_dims = len(r.get("dimensions_found", []))
        n_scodes = len(r.get("scodes_found", []))
        print(f"    → {status} | {chars} chars | {n_dims} dimensions | {n_scodes} S-codes",
              file=sys.stderr)

    out_path = OUT / "ocr_pdfs_extracted.json"
    out_path.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": str(date.today()),
        "_generated_by": "tools/path_c_part1_ocr.py",
        "_purpose": "Path C Část 1 — OCR attempt on 6 drawing-heavy / scanned PDFs via pdftoppm 300 DPI + tesseract ces+eng.",
        "_ocr_pipeline": "pdftoppm -r 300 -png → tesseract --psm 6 -l ces+eng",
        "results_per_pdf": results,
    }, indent=2, ensure_ascii=False))
    print(f"\n✓ Wrote {out_path.relative_to(PROJ)} ({out_path.stat().st_size:,} bytes)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
