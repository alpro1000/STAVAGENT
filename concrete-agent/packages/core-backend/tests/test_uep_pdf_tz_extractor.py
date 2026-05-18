"""
PDF TZ extractor tests.

Hermetic — synthesises a tiny PDF via `pdfplumber.open()` is not feasible
for generation, so we use `reportlab` (already pulled transitively) for
the synthesis branch, and otherwise rely on regex-extraction unit tests
in the existing `tests/` suite for catalogue correctness.

If `reportlab` isn't present in the test environment, the synthesis
test skips rather than fails.
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest

from app.services.uep import PdfTzExtractor

# Czech TZ snippet that exercises the regex catalogue.
SAMPLE_TZ_TEXT = (
    "TECHNICKÁ ZPRÁVA\n\n"
    "Investor: STAVAGENT s.r.o., IČO: 12345678\n\n"
    "1. ZÁKLADNÍ ÚDAJE\n"
    "Beton C30/37 XC4 XF1 dle ČSN EN 206.\n"
    "Výztuž třídy B500B podle ČSN EN 1992-1-1.\n"
    "Objekt má 2 PP a 4 NP, výška 18,5 m.\n\n"
    "2. KONSTRUKCE\n"
    "Stěny tl. 250 mm, monolitický železobeton.\n"
    "Vodotěsná konstrukce — bílá vana V8.\n"
    "Celkový objem betonu 1 200 m³, plocha bednění 4 500 m².\n"
)


def _make_minimal_pdf(path: Path, text: str) -> bool:
    """Render a single-page PDF with the given text. Returns False if
    `reportlab` is unavailable (caller should skip the test)."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:
        return False
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setFont("Helvetica", 9)
    y = 800
    for line in text.split("\n"):
        c.drawString(50, y, line)
        y -= 14
    c.save()
    return True


def test_extractor_metadata() -> None:
    ex = PdfTzExtractor()
    assert ex.extractor_id == "uep.pdf_tz_extractor"
    assert ex.source_format.value == "pdf_tz"
    assert 0.0 < ex.default_confidence <= 1.0


def test_pdf_with_text_yields_universal_facts(tmp_path: Path) -> None:
    """Synthesised TZ PDF → expected universal facts via regex catalogue."""
    pdf_path = tmp_path / "tz_min.pdf"
    if not _make_minimal_pdf(pdf_path, SAMPLE_TZ_TEXT):
        pytest.skip("reportlab unavailable — synthesis path skipped")

    extraction = PdfTzExtractor().extract(pdf_path)
    assert extraction.extractor_error is None, extraction.extractor_error

    facts_by_cat: dict[str, list] = {}
    for f in extraction.facts:
        facts_by_cat.setdefault(f.category, []).append(f)

    # Concrete + exposure + steel grade come straight from the regex
    # catalogue (`services/regex_extractor.py`).
    assert any(f.value == "C30/37" for f in facts_by_cat.get("concrete_grade", []))
    exposures = {f.value for f in facts_by_cat.get("exposure_class", [])}
    assert "XC4" in exposures
    assert "XF1" in exposures
    steel = {f.value for f in facts_by_cat.get("reinforcement", [])}
    assert "B500B" in steel or any("B500" in s for s in steel)

    # Raw data sanity.
    assert extraction.data["page_count"] == 1
    assert extraction.data["char_count_total"] > 0


def test_empty_pdf_raises_ocr_required(tmp_path: Path) -> None:
    """PDF with no extractable text → `extractor_error='ocr_required'`."""
    pdf_path = tmp_path / "scanned.pdf"
    if not _make_minimal_pdf(pdf_path, ""):
        pytest.skip("reportlab unavailable — synthesis path skipped")
    # Overwrite with a one-page PDF that has no text content beyond whitespace.
    # reportlab still emits structural bytes; we use a near-empty PDF.
    extraction = PdfTzExtractor().extract(pdf_path)
    assert extraction.extractor_error is not None
    assert "ocr" in extraction.extractor_error.lower() or "text" in extraction.extractor_error.lower()


def test_missing_file_returns_error_record(tmp_path: Path) -> None:
    extraction = PdfTzExtractor().extract(tmp_path / "nope.pdf")
    assert extraction.extractor_error is not None
    assert extraction.facts == []
