"""
MCP Tool: parse_construction_budget

Parses Excel files with construction budgets (rozpočet / soupis prací).
Supports 3 formats: Komplet/FORESTINA, OTSKP D6, AspeEsticon/SŽ.
Uses existing parsers from app.parsers.
"""

import base64
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


async def parse_construction_budget(
    file_base64: str,
    filename: str,
) -> dict:
    """Parse an Excel file with a construction budget or bill of quantities.

    Supports 4 formats with automatic detection from filename:
    - Komplet/FORESTINA: general construction budgets (keyword: 'komplet', 'forestina')
    - RTS/AspeEsticon/SŽ: railway structures (keyword: 'rts', 'aspe', 'sz', 'szdc')
    - OTSKP D6: transport structures (keyword: 'otskp', 'd6')
    - Soupis prací: generic bill of quantities (keyword: 'soupis')
    Falls back to universal parser if format cannot be determined.

    Returns a normalized list of items, each with: code, description, unit,
    quantity, unit_price, total_price. Also includes format_detected and
    parser diagnostics.

    Supported file types: .xlsx, .xls (Excel). Maximum recommended: 50 MB.

    Args:
        file_base64: Excel file content encoded as base64 string.
            To encode: base64.b64encode(open('budget.xlsx','rb').read()).decode()

        filename: Original filename with extension. Used for format detection.
            Examples:
            - 'SO-202_rozpocet_komplet.xlsx' → detected as 'komplet'
            - 'D6_otskp_soupis.xlsx' → detected as 'otskp'
            - 'stavba_rts_rozpocet.xlsx' → detected as 'rts'
            - 'soupis_praci_2026.xlsx' → detected as 'soupis'
            If no keyword matches, uses generic auto-detection.
    """
    try:
        # Decode base64 to temp file
        file_bytes = base64.b64decode(file_base64)

        # Deterministic format routing (content-sniff + extension): a KROS XML
        # soupis must reach the KROS parser, NOT the xlsx/zip reader — feeding XML
        # to openpyxl silently yields 0 items (the Gap A bug). Content wins over a
        # (possibly mislabeled) filename; an unrecognized format is an HONEST error,
        # never a silent 0.
        kind = _detect_file_kind(file_bytes, filename)
        if kind == "unknown":
            return {
                "error": (
                    f"Unrecognized soupis format for '{filename}': the content is "
                    "neither a KROS XML nor an XLSX workbook."
                ),
                "items": [],
                "total_items": 0,
                "format_detected": "unknown",
            }

        with tempfile.NamedTemporaryFile(
            suffix=(".xml" if kind == "xml" else ".xlsx"), delete=False
        ) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)

        try:
            result = await _parse_file(tmp_path, filename, kind=kind)
            return result
        finally:
            tmp_path.unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"[MCP/Budget] Error: {e}")
        return {"error": str(e), "items": [], "format_detected": None}


async def _parse_file(file_path: Path, filename: str, kind: str = "xlsx") -> dict:
    """Parse a soupis/budget file using the existing parsers.

    `kind` ('xml' | 'xlsx') is the deterministic routing decision made by the
    caller (content-sniff + extension). XML → the existing KROS parser (it already
    handles the KROS/XC4 soupis — reused, not re-implemented); XLSX → the
    keyword-dispatched xlsx parsers. Both paths normalize through the SAME
    `_normalize_items` block — one item contract, no fork.
    """
    # KROS XML soupis → the KROS parser. Its `positions` already use the field
    # aliases `_normalize_items` understands (code/description/unit/quantity), so
    # the join consumes them identically to the xlsx items.
    if kind == "xml":
        from app.parsers.kros_parser import KROSParser

        result = KROSParser().parse(file_path)
        items = result.get("positions", result.get("items", []))
        normalized = _normalize_items(items)
        return {
            "items": normalized,
            "total_items": len(normalized),
            "format_detected": "kros_xml",
            "filename": filename,
            "diagnostics": result.get("diagnostics", {}),
        }

    # Try format detection (filename keyword → xlsx sub-format)
    detected_format = _detect_format(filename)

    items = []
    diagnostics = {}

    try:
        if detected_format == "komplet":
            from app.parsers.xlsx_komplet_parser import parse_komplet
            result = parse_komplet(str(file_path))
            items = result.get("positions", result.get("items", []))
            diagnostics = result.get("diagnostics", {})

        elif detected_format == "rts":
            from app.parsers.xlsx_rtsrozp_parser import parse_rts_rozpocet
            result = parse_rts_rozpocet(str(file_path))
            items = result.get("positions", result.get("items", []))
            diagnostics = result.get("diagnostics", {})

        else:
            # Generic Excel parser
            from app.parsers.excel_parser import ExcelParser
            parser = ExcelParser()
            result = parser.parse(file_path)
            items = result.get("positions", result.get("items", []))
            diagnostics = result.get("diagnostics", {})

    except ImportError:
        # Fallback: try universal parser
        try:
            from app.parsers.universal_parser import UniversalParser
            parser = UniversalParser()
            result = await parser.parse_file(file_path, filename)
            items = result.get("positions", result.get("items", []))
            diagnostics = result.get("diagnostics", {})
        except Exception as e2:
            return {
                "error": f"No suitable parser found: {e2}",
                "items": [],
                "format_detected": detected_format,
            }

    normalized = _normalize_items(items)
    return {
        "items": normalized,
        "total_items": len(normalized),
        "format_detected": detected_format,
        "filename": filename,
        "diagnostics": diagnostics,
    }


def _normalize_items(items: list) -> list:
    """Map parser positions/items → the canonical item contract the join consumes.

    Single normalization site for EVERY parser path (xlsx sub-formats + KROS XML)
    so a second item form is never forked. Tolerates both English and Czech field
    aliases (code/kod, description/popis/name, unit/mj, quantity/mnozstvi, …).
    """
    normalized = []
    for item in items:
        if isinstance(item, dict):
            normalized.append({
                "code": item.get("code", item.get("kod", "")),
                "description": item.get("description", item.get("popis", item.get("name", ""))),
                "unit": item.get("unit", item.get("mj", "")),
                "quantity": item.get("quantity", item.get("mnozstvi", 0)),
                "unit_price": item.get("unit_price", item.get("jc", item.get("jednotkova_cena", 0))),
                "total_price": item.get("total_price", item.get("celkem", 0)),
            })
    return normalized


def _detect_file_kind(file_bytes: bytes, filename: str) -> str:
    """Deterministic soupis-format routing: 'xml' (KROS) | 'xlsx' | 'unknown'.

    Content-sniff wins over the (possibly mislabeled) filename — xlsx/xlsm/xlsb are
    ZIP containers (PK magic), a KROS soupis is XML (`<?xml` / leading `<`). The
    filename extension is only a fallback when the content is inconclusive. No LLM.
    """
    name = (filename or "").lower()
    if file_bytes[:4] == b"PK\x03\x04":          # ZIP container → xlsx family
        return "xlsx"
    head = file_bytes.lstrip()[:5]
    if head[:5] == b"<?xml" or head[:1] == b"<":  # XML content
        return "xml"
    # Content inconclusive → trust the extension.
    if name.endswith((".xlsx", ".xlsm", ".xlsb", ".xls")):
        return "xlsx"
    if name.endswith(".xml"):
        return "xml"
    return "unknown"


def _detect_format(filename: str) -> str:
    """Detect budget format from filename."""
    fn = filename.lower()
    if "komplet" in fn or "forestina" in fn:
        return "komplet"
    elif "rts" in fn or "aspe" in fn or "sz" in fn or "szdc" in fn:
        return "rts"
    elif "otskp" in fn or "d6" in fn:
        return "otskp"
    elif "soupis" in fn:
        return "soupis"
    return "auto"
