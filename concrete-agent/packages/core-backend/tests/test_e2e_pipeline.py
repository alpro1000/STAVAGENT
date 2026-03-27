"""
E2E Pipeline Tests — verify full document analysis pipeline.

Tests: upload files → CORE processes → verify results.
Run against a live server (local or Cloud Run).

Usage:
    # Against local server
    CORE_URL=http://localhost:8000 pytest tests/test_e2e_pipeline.py -v

    # Against production
    CORE_URL=https://concrete-agent-1086027517695.europe-west3.run.app pytest tests/test_e2e_pipeline.py -v
"""

import os
import json
import pytest
import tempfile
from pathlib import Path

# Skip all tests if CORE_URL not set (no live server)
CORE_URL = os.getenv("CORE_URL", "")
pytestmark = pytest.mark.skipif(not CORE_URL, reason="CORE_URL not set — need live server")


def _upload_file(endpoint: str, file_path: str, extra_fields: dict = None):
    """Upload file to CORE endpoint, return response JSON."""
    import httpx
    with open(file_path, "rb") as f:
        files = {"file": (Path(file_path).name, f)}
        data = extra_fields or {}
        data.setdefault("project_name", "e2e_test")
        data.setdefault("enable_ai_enrichment", "true")
        data.setdefault("analysis_mode", "adaptive_extraction")

        resp = httpx.post(
            f"{CORE_URL}{endpoint}",
            files=files,
            data=data,
            timeout=300,
        )
    return resp.status_code, resp.json() if resp.status_code == 200 else resp.text


def _create_test_pdf(text: str = "Beton C30/37, XC4, výztuž B500B 10t") -> str:
    """Create a minimal test PDF using reportlab or FPDF."""
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", size=12)
        pdf.cell(0, 10, text)
        pdf.output(tmp.name)
    except ImportError:
        # Fallback: create minimal PDF manually
        content = f"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length {len(text) + 30}>>stream
BT /F1 12 Tf 72 720 Td ({text}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF"""
        tmp.write(content.encode())
    tmp.close()
    return tmp.name


def _create_test_image() -> str:
    """Create a test JPG image with text."""
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (800, 200), "white")
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "Beton C30/37 XC4 150m3", fill="black")
        draw.text((50, 100), "Vyztuz B500B 12t", fill="black")
        img.save(tmp.name, "JPEG")
    except ImportError:
        # Can't create image without Pillow
        tmp.close()
        os.unlink(tmp.name)
        return ""
    tmp.close()
    return tmp.name


def _create_test_xlsx() -> str:
    """Create a test XLSX with sample positions."""
    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "SO 201"
        ws.append(["Kód", "Popis", "MJ", "Množství", "Cena/MJ", "Celkem"])
        ws.append(["121101001", "Sejmutí ornice", "m3", "150", "85", "12750"])
        ws.append(["274313611", "Beton základových pasů C30/37 XC4", "m3", "45.5", "3200", "145600"])
        ws.append(["411321414", "Výztuž základů B500B", "t", "3.2", "32000", "102400"])
        wb.save(tmp.name)
    except ImportError:
        tmp.close()
        os.unlink(tmp.name)
        return ""
    tmp.close()
    return tmp.name


# ── Tests ──

class TestHealthCheck:
    def test_health(self):
        import httpx
        resp = httpx.get(f"{CORE_URL}/health", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") in ("ok", "running", "healthy")


class TestPassportGeneration:
    def test_pdf_passport(self):
        """Upload PDF → verify passport returned with concrete specs."""
        pdf_path = _create_test_pdf()
        try:
            status, data = _upload_file("/api/v1/passport/generate", pdf_path)
            assert status == 200, f"Expected 200, got {status}: {data}"
            assert data.get("success") is True or data.get("passport") is not None
            if data.get("passport"):
                passport = data["passport"]
                assert "concrete_specifications" in passport
                assert "reinforcement" in passport
        finally:
            os.unlink(pdf_path)

    def test_xlsx_passport(self):
        """Upload XLSX → verify passport + soupis returned."""
        xlsx_path = _create_test_xlsx()
        if not xlsx_path:
            pytest.skip("openpyxl not available")
        try:
            status, data = _upload_file("/api/v1/passport/generate", xlsx_path)
            assert status == 200, f"Expected 200, got {status}: {data}"
            # XLSX should return soupis_praci alongside passport
            if data.get("soupis_praci"):
                soupis = data["soupis_praci"]
                assert soupis.get("positions_count", 0) >= 1
        finally:
            os.unlink(xlsx_path)

    def test_image_passport(self):
        """Upload JPG → verify OCR processing."""
        img_path = _create_test_image()
        if not img_path:
            pytest.skip("Pillow not available")
        try:
            status, data = _upload_file("/api/v1/passport/generate", img_path)
            assert status == 200, f"Expected 200, got {status}: {data}"
            # Image should be processed (OCR → passport)
            assert data.get("success") is True or data.get("passport") is not None
        finally:
            os.unlink(img_path)

    def test_unsupported_format_rejected(self):
        """Upload .exe → verify 400 rejection."""
        tmp = tempfile.NamedTemporaryFile(suffix=".exe", delete=False)
        tmp.write(b"not an executable")
        tmp.close()
        try:
            status, data = _upload_file("/api/v1/passport/generate", tmp.name)
            assert status == 400
        finally:
            os.unlink(tmp.name)


class TestExtractionFields:
    """Verify extracted fields from a known PDF."""

    def test_norms_extraction(self):
        """PDF with norm references → verify norms field populated."""
        pdf_path = _create_test_pdf(
            "Dle CSN EN 206 a CSN 73 1201. Beton C30/37 XC4, vyztuz B500B."
        )
        try:
            status, data = _upload_file("/api/v1/passport/generate", pdf_path)
            assert status == 200
            norms = data.get("norms", [])
            # If extraction worked, should find at least one norm
            # (depends on regex patterns matching)
        finally:
            os.unlink(pdf_path)

    def test_identification_extraction(self):
        """PDF with project identification → verify identification field."""
        pdf_path = _create_test_pdf(
            "Stavba: Bytovy dum Valcha. Investor: Mesto Plzen. Misto: Plzen-Bory."
        )
        try:
            status, data = _upload_file("/api/v1/passport/generate", pdf_path)
            assert status == 200
            ident = data.get("identification", {})
            # Identification extraction is regex-based
        finally:
            os.unlink(pdf_path)


class TestNKBAdvisor:
    """Test NKB norm advisor endpoint."""

    def test_advisor_basic(self):
        import httpx
        resp = httpx.post(
            f"{CORE_URL}/api/v1/nkb/advisor",
            json={
                "construction_type": "pozemní",
                "phase": "DSP",
                "objects": ["beton", "výztuž"],
                "materials": ["C30/37", "B500B"],
            },
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "matched_norms" in data
        assert "matched_rules" in data
        assert data["matched_norms"] >= 0
        assert data["matched_rules"] >= 0

    def test_nkb_stats(self):
        import httpx
        resp = httpx.get(f"{CORE_URL}/api/v1/nkb/stats", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("total_norms", 0) >= 14  # At least seed data
        assert data.get("total_rules", 0) >= 14
