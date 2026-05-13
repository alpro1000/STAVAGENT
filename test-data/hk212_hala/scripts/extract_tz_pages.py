"""Phase 0b RE-RUN — per-page TZ PDF text dump.

Dumps each TZ PDF page as plain text so facts extraction scripts can cite
"<filename>, page <N>". Uses PyMuPDF (fitz). Pages stored 1-indexed in JSON
+ as separate .txt files for grep convenience.

Run from repo root::

    python3 test-data/hk212_hala/scripts/extract_tz_pages.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz  # PyMuPDF

REPO_ROOT = Path(__file__).resolve().parents[3]
TZ_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "inputs" / "tz"
OUT_DIR = REPO_ROOT / "test-data" / "hk212_hala" / "outputs" / "tz_pages"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(TZ_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"ERROR: no PDFs in {TZ_DIR}", file=sys.stderr)
        return 1

    index: dict[str, list[dict]] = {}
    for pdf in pdfs:
        doc = fitz.open(str(pdf))
        pages_info: list[dict] = []
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text")
            page_path = OUT_DIR / f"{pdf.stem}__p{i:02d}.txt"
            page_path.write_text(text, encoding="utf-8")
            pages_info.append({
                "page_number": i,
                "char_count": len(text),
                "path": str(page_path.relative_to(REPO_ROOT)),
            })
        index[pdf.name] = pages_info
        doc.close()
        print(f"  ✓ {pdf.name:42s} {len(pages_info):3d} pages")

    (OUT_DIR / "_index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2))
    print(f"\n→ {(OUT_DIR / '_index.json').relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
