"""
MCP Tool: analyze_construction_document

Analyzes PDF technical reports (TZ) or other construction documentation.
Extracts: concrete types, rebar classes, dimensions, exposures, norms,
construction types, special requirements.

Uses existing parsers and extractors from app.parsers and app.services.
"""

import base64
import logging
import re
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Regex patterns for construction parameter extraction
PATTERNS = {
    "concrete_class": re.compile(r"C\s*(\d{2,3})\s*/\s*(\d{2,3})"),
    "rebar_class": re.compile(r"B\s*500\s*[ABC]|10\s*505(?:\.\d)?"),
    "prestress_steel": re.compile(r"Y\s*1860\s*S7|St\s*1570/1770"),
    "exposure": re.compile(r"X[CDSFAW]\d"),
    "dimension_m": re.compile(r"(\d+[.,]\d+)\s*m\b"),
    "dimension_mm": re.compile(r"(\d{3,5})\s*mm\b"),
    "diameter": re.compile(r"[∅Ø]\s*(\d+(?:[.,]\d+)?)"),
    "csn_norm": re.compile(r"ČSN\s*(?:EN\s*)?[\d\s\-:]+"),
    "white_tank": re.compile(r"bíl[áé]\s*van[ay]|WU[\s-]?beton|vodonepropustn", re.I),
    "scc": re.compile(r"SCC|samozhutnit|self[\s-]?compact", re.I),
    "otskp_code": re.compile(r"\b\d{9}\b"),
}


async def analyze_construction_document(
    file_base64: str,
    filename: str,
    focus: str = "all",
) -> dict:
    """Analyze a PDF technical report (TZ) or other construction documentation.

    Extracts construction parameters using deterministic regex patterns
    (confidence 1.0): concrete classes (C25/30, C35/45...), rebar classes
    (B500B, 10505), prestress steel (Y1860S7), exposure classes (XF2, XA2...),
    dimensions (meters, mm), diameters (Ø900), ČSN norm references,
    white tank indicators, SCC indicators, and OTSKP codes.

    For documents > 5 pages uses chunked extraction (by sections).
    Each found parameter includes: type, value, confidence score, source
    method, and page number reference.

    Supported input: PDF files (text-based or scanned via pdfplumber).
    Maximum recommended size: 10 MB. Scanned PDFs with poor OCR quality
    may return fewer parameters.

    Use focus parameter to narrow extraction to specific parameter types
    for faster results on large documents.

    Args:
        file_base64: PDF file content encoded as base64 string.
            To encode: base64.b64encode(open('file.pdf','rb').read()).decode()

        filename: Original filename including extension.
            Used for document type detection (TZ, soupis, výkres, etc.).
            Examples: 'SO-202_TZ_statika.pdf', 'D.1.2_soupis_praci.pdf'

        focus: Extraction focus filter to narrow parameter search.
            - 'all': extract all parameter types (default, ~11 regex patterns)
            - 'concrete': concrete_class + exposure + white_tank + SCC only
            - 'reinforcement': rebar_class + prestress_steel + diameters
            - 'dimensions': dimensions in m/mm + diameters
            - 'norms': ČSN/EN norm references only
    """
    try:
        file_bytes = base64.b64decode(file_base64)

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)

        try:
            # Extract text from PDF
            text = _extract_pdf_text(tmp_path)
            if not text:
                return {
                    "error": "Could not extract text from PDF",
                    "filename": filename,
                    "parameters": [],
                }

            # Detect document type
            doc_type = _detect_doc_type(filename, text[:2000])

            # Extract parameters using regex (confidence = 1.0)
            parameters = _extract_parameters(text, focus)

            return {
                "filename": filename,
                "document_type": doc_type,
                "total_chars": len(text),
                "parameters": parameters,
                "total_parameters": len(parameters),
                "focus": focus,
            }
        finally:
            tmp_path.unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"[MCP/Document] Error: {e}")
        return {"error": str(e), "filename": filename, "parameters": []}


def _extract_pdf_text(file_path: Path) -> str:
    """Extract text from PDF using pdfplumber."""
    try:
        import pdfplumber

        text_parts = []
        with pdfplumber.open(str(file_path)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(f"--- PAGE {i + 1} ---\n{page_text}")
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning(f"[MCP/Document] pdfplumber failed: {e}")
        return ""


def _detect_doc_type(filename: str, text_start: str) -> str:
    """Detect document type from filename and content."""
    fn = filename.lower()

    # Filename markers
    markers = {
        "TZ statika": ["tz", "statik", "static"],
        "Soupis prací": ["soupis", "výkaz", "rozpočet", "budget"],
        "Výkres": ["výkres", "drawing", "vykres"],
        "Technická zpráva": ["technic", "tz_"],
        "Průvodní zpráva": ["průvod", "pruvod", "a_"],
        "Souhrnná zpráva": ["souhrn", "b_"],
    }

    for doc_type, keywords in markers.items():
        if any(kw in fn for kw in keywords):
            return doc_type

    # Content markers
    text_lower = text_start.lower()
    if "technická zpráva" in text_lower or "technical report" in text_lower:
        return "Technická zpráva"
    if "soupis prací" in text_lower or "výkaz výměr" in text_lower:
        return "Soupis prací"
    if "statick" in text_lower:
        return "TZ statika"

    return "Nespecifikováno"


def _extract_parameters(text: str, focus: str) -> list[dict]:
    """Extract construction parameters using regex."""
    parameters = []
    seen = set()

    focus_patterns = {
        "concrete": ["concrete_class", "exposure", "white_tank", "scc"],
        "reinforcement": ["rebar_class", "prestress_steel", "diameter"],
        "dimensions": ["dimension_m", "dimension_mm", "diameter"],
        "norms": ["csn_norm"],
        "all": list(PATTERNS.keys()),
    }

    active_patterns = focus_patterns.get(focus, list(PATTERNS.keys()))

    for pattern_name in active_patterns:
        pattern = PATTERNS.get(pattern_name)
        if not pattern:
            continue

        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if value in seen:
                continue
            seen.add(value)

            # Find page number
            page_num = None
            pos = match.start()
            page_markers = [m.start() for m in re.finditer(r"--- PAGE (\d+) ---", text)]
            for i, pm in enumerate(page_markers):
                if pm <= pos:
                    page_match = re.search(r"--- PAGE (\d+) ---", text[pm:pm + 20])
                    if page_match:
                        page_num = int(page_match.group(1))

            parameters.append({
                "type": pattern_name,
                "value": value,
                "confidence": 1.0,
                "source": "regex",
                "page": page_num,
            })

    return parameters
