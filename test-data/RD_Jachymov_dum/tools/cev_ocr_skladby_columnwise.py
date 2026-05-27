#!/usr/bin/env python3
"""
Column-aware OCR for SKLADBY KONSTRUKCÍ tables.

Problem: tesseract --psm 6 reads architectural drawings line-by-line,
interleaving multi-column layouts (S01 | S03a | S04 on the same OCR line).
Solution: use --tsv mode to get word-level bounding boxes, then cluster
words by their LEFT x-coordinate to identify columns, then reconstruct
each column independently.

Output: outputs/cev_ocr_skladby_columnwise.json
  Per sheet, per S-code: clean layer list parsed from a single column.

Targets the sheets most likely to carry SKLADBY KONSTRUKCÍ legendy:
  - D.1.1.02.R1 sklad půdorys (sklad S01-S05)
  - D.1.1.2.2.21 dům řez A-A + B-B + C-C návrh (dům S01-S12)
  - D.1.1.03.R2 dům příčný řez A-A
  - D.1.1.04.R1 dům podélný řez B-B
  - D.1.1.2.2.01 dům řez A-A stav
"""

from __future__ import annotations

import csv
import io
import json
import re
import subprocess
import tempfile
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs" / "cev_ocr_skladby_columnwise.json"
GEN_AT = "2026-05-26"

TARGETS = [
    ROOT / "inputs" / "vykresy_pdf" / "260217_sklad" / "D.1.1.02.R1 - Půdorys suterénu_skladu _ EAR.pdf",
    ROOT / "inputs" / "vykresy_pdf" / "260219_dum" / "D.1.1.2.2.21 - Řez A-A, Řez B-B - návrh _ EAR.pdf",
    ROOT / "inputs" / "vykresy_pdf" / "260219_dum" / "D.1.1.03.R2 - Příčný řez A-A _ EAR.pdf",
    ROOT / "inputs" / "vykresy_pdf" / "260219_dum" / "D.1.1.04.R1 - Podélný řez B-B _ EAR.pdf",
    ROOT / "inputs" / "vykresy_pdf" / "260219_dum" / "D.1.1.2.2.01 - Řez A-A - stav _ EAR.pdf",
]

SCODE_RX = re.compile(r"^S\d{1,2}[a-z]?$")
SCODE_HEADER_RX = re.compile(r"^S\d{1,2}[a-z]?$")


def ocr_tsv(image_path: Path) -> list[dict]:
    """Run tesseract in TSV mode → list of word dicts with bbox."""
    proc = subprocess.run(
        ["tesseract", str(image_path), "-", "-l", "ces+eng", "--psm", "6", "tsv"],
        capture_output=True, text=True, timeout=120,
    )
    if proc.returncode != 0:
        return []
    words = []
    reader = csv.DictReader(io.StringIO(proc.stdout), delimiter="\t")
    for row in reader:
        text = (row.get("text") or "").strip()
        if not text:
            continue
        try:
            words.append({
                "text": text,
                "left": int(row["left"]),
                "top": int(row["top"]),
                "width": int(row["width"]),
                "height": int(row["height"]),
                "conf": float(row.get("conf", -1)),
                "line_num": int(row.get("line_num", 0)),
                "block_num": int(row.get("block_num", 0)),
            })
        except (KeyError, ValueError):
            continue
    return words


def find_s_code_anchors(words: list[dict]) -> list[dict]:
    """Identify words that look like S-code headers (S01, S03a, etc.)."""
    return [w for w in words if SCODE_HEADER_RX.match(w["text"])]


def find_skladby_band(words: list[dict]) -> tuple[int, int] | None:
    """Find the vertical band (top, bottom) of the SKLADBY KONSTRUKCÍ table.
    Anchored by the 'SKLADBY' word + first S-code below it. Bottom = highest
    Y of last layer line (we approximate to 'end of S-code clusters')."""
    skladby_word = None
    for w in words:
        if w["text"].upper().startswith("SKLAD") and "KONSTRUK" in w["text"].upper() + (words[words.index(w) + 1]["text"].upper() if words.index(w) + 1 < len(words) else ""):
            skladby_word = w
            break
    # Fallback: look for any word "SKLADBY"
    if not skladby_word:
        for w in words:
            if w["text"].upper() == "SKLADBY":
                skladby_word = w
                break
    if not skladby_word:
        return None
    top = skladby_word["top"]
    # Bottom = max Y of any S-code anchor + 400 px buffer
    anchors = [w for w in find_s_code_anchors(words) if w["top"] >= top]
    if not anchors:
        return None
    bottom_anchor_y = max(w["top"] for w in anchors)
    bottom = bottom_anchor_y + 500  # buffer for layer rows below last anchor
    return (top, bottom)


def cluster_columns(anchors: list[dict], tolerance: int = 80) -> list[list[dict]]:
    """Cluster S-code anchors into columns by left-x. Anchors with
    similar `left` go to the same column."""
    if not anchors:
        return []
    sorted_a = sorted(anchors, key=lambda w: w["left"])
    columns: list[list[dict]] = []
    for w in sorted_a:
        placed = False
        for col in columns:
            if abs(col[0]["left"] - w["left"]) <= tolerance:
                col.append(w)
                placed = True
                break
        if not placed:
            columns.append([w])
    return columns


def extract_column_text(words: list[dict], col_left: int, col_width: int,
                        band_top: int, band_bottom: int) -> list[str]:
    """Pull all words within (col_left ± col_width/2) × (band_top..band_bottom),
    group by line_num/top, return list of line strings."""
    col_right = col_left + col_width
    in_col = []
    for w in words:
        if w["top"] < band_top or w["top"] > band_bottom:
            continue
        cx = w["left"] + w["width"] / 2
        if col_left - 20 <= cx <= col_right + 20:
            in_col.append(w)
    # Group by top-Y bucket (within 12 px = same line)
    in_col.sort(key=lambda w: (w["top"], w["left"]))
    lines: list[list[dict]] = []
    cur_line: list[dict] = []
    cur_y = None
    for w in in_col:
        if cur_y is None or abs(w["top"] - cur_y) < 14:
            cur_line.append(w)
            cur_y = w["top"] if cur_y is None else (cur_y + w["top"]) // 2
        else:
            lines.append(cur_line)
            cur_line = [w]
            cur_y = w["top"]
    if cur_line:
        lines.append(cur_line)
    return [" ".join(w["text"] for w in line) for line in lines]


def parse_skladby_columns(words: list[dict]) -> list[dict]:
    """Returns list of skladby dicts: [{code, name, layers, column_left}]."""
    band = find_skladby_band(words)
    if not band:
        return []
    band_top, band_bottom = band
    # Filter S-code anchors within band
    anchors = [w for w in find_s_code_anchors(words)
               if band_top <= w["top"] <= band_bottom]
    if not anchors:
        return []
    columns = cluster_columns(anchors, tolerance=80)
    # Column widths — estimate as distance to next column or 380 px default
    sorted_col_lefts = sorted([c[0]["left"] for c in columns])
    col_widths: dict[int, int] = {}
    for i, left in enumerate(sorted_col_lefts):
        if i + 1 < len(sorted_col_lefts):
            col_widths[left] = sorted_col_lefts[i + 1] - left - 20
        else:
            col_widths[left] = 380  # default for last column

    skladby: list[dict] = []
    for col in columns:
        col_anchors = sorted(col, key=lambda w: w["top"])
        col_left = col[0]["left"]
        col_w = col_widths.get(col_left, 380)
        # Extract all column text (within band + column x-range)
        col_lines = extract_column_text(words, col_left, col_w, band_top, band_bottom)
        # Partition: each S-code anchor starts a new skladba; line containing
        # the anchor becomes the header; subsequent lines until next anchor
        # are layers.
        current: dict | None = None
        for line in col_lines:
            m = re.match(r"^(S\d{1,2}[a-z]?)\s*(.*)$", line.strip())
            if m and SCODE_HEADER_RX.match(m.group(1)):
                if current:
                    skladby.append(current)
                current = {
                    "code": m.group(1),
                    "name": m.group(2).strip()[:120],
                    "layers": [],
                    "column_left": col_left,
                }
            elif current is not None:
                # Layer line — strip leading dash/bullet artifacts
                clean = re.sub(r"^[\-•©©•\*\s]+", "", line).strip()
                if clean and len(clean) >= 3:
                    current["layers"].append(clean[:140])
        if current:
            skladby.append(current)
    return skladby


def process_pdf(pdf_path: Path) -> dict:
    with tempfile.TemporaryDirectory() as td:
        prefix = Path(td) / "page"
        subprocess.run(
            ["pdftoppm", "-r", "300", "-png", str(pdf_path), str(prefix)],
            check=True, capture_output=True, timeout=60,
        )
        page_files = sorted(Path(td).glob("page-*.png"))
        all_skladby = []
        for pf in page_files:
            words = ocr_tsv(pf)
            sk = parse_skladby_columns(words)
            if sk:
                all_skladby.extend(sk)
    return {"pdf": str(pdf_path.relative_to(ROOT)), "skladby": all_skladby}


def main() -> None:
    out = {
        "_schema_version": "1.0",
        "_generated_at": GEN_AT,
        "_purpose": "Column-aware OCR (tesseract TSV mode + x-coordinate clustering) for SKLADBY KONSTRUKCÍ tables.",
        "per_sheet": {},
    }
    for pdf in TARGETS:
        if not pdf.exists():
            continue
        print(f"  parsing {pdf.name[:70]} ...", flush=True)
        result = process_pdf(pdf)
        out["per_sheet"][pdf.name] = result

    # Consolidate by S-code — keep longest layer list per code
    consolidated: dict[str, dict] = {}
    for sheet_data in out["per_sheet"].values():
        for sk in sheet_data["skladby"]:
            code = sk["code"]
            existing = consolidated.get(code)
            if existing is None or len(sk["layers"]) > len(existing["layers"]):
                consolidated[code] = {
                    "code": code,
                    "name": sk["name"],
                    "layers": sk["layers"],
                    "_source_pdf": Path(sheet_data["pdf"]).name,
                }
    out["consolidated_skladby"] = [consolidated[k] for k in sorted(consolidated.keys())]
    out["n_codes_decoded"] = len(consolidated)

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(json.dumps({
        "codes_decoded": len(consolidated),
        "codes": sorted(consolidated.keys()),
        "output": str(OUT.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
