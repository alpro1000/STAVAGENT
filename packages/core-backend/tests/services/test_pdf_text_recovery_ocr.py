from __future__ import annotations

import sys
from pathlib import Path

from app.core.config import settings
from app.services.pdf_text_recovery import PdfTextRecovery


def test_ocr_circuit_breaker_limits_total_time(monkeypatch, tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    recovery = PdfTextRecovery()

    monkeypatch.setattr(
        PdfTextRecovery,
        "_extract_pdfminer",
        lambda self, path: ["", "", ""],
    )
    monkeypatch.setattr(PdfTextRecovery, "_recover_with_pdfium", lambda self, path, pages: {})
    monkeypatch.setattr(PdfTextRecovery, "_check_pdfium", lambda self: True)
    recovery._pdfium_available = True  # type: ignore[attr-defined]

    monkeypatch.setattr(settings, "PDF_ENABLE_OCR", True)
    monkeypatch.setattr(settings, "PDF_ENABLE_POPPLER", False)
    monkeypatch.setattr(settings, "PDF_MAX_PAGES_FOR_OCR", 5)
    monkeypatch.setattr(settings, "PDF_OCR_PAGE_TIMEOUT_SEC", 5.0)
    monkeypatch.setattr(settings, "PDF_OCR_TOTAL_TIMEOUT_SEC", 0.02)

    durations = [0.011, 0.012, 0.013]
    call_count = {"value": 0}

    def fake_perform(self, path: Path, page_number: int, timeout: float):
        index = call_count["value"]
        call_count["value"] += 1
        return (f"ocr text {page_number}", durations[index], None)

    monkeypatch.setattr(PdfTextRecovery, "_perform_ocr", fake_perform)

    dummy_module = type("TesseractModule", (), {"image_to_string": lambda *args, **kwargs: ""})
    monkeypatch.setitem(sys.modules, "pytesseract", dummy_module)

    result = recovery.recover(pdf_path, use_ocr=True)

    assert call_count["value"] == 2
    assert result.queued_ocr_pages == [1, 2]
    assert result.pages[0].extractor == "ocr"
    assert result.pages[1].extractor == "ocr"
    assert result.pages[2].extractor == "pdfminer"
    assert result.ocr_elapsed_ms >= (durations[0] + durations[1]) * 1000 - 1
    assert result.ocr_elapsed_ms < 100
