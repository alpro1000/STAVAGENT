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

    Supports 3 formats: Komplet/FORESTINA, OTSKP D6 for transport structures,
    AspeEsticon/SŽ railway. Automatically detects the format.
    Returns a structured list of items with codes, descriptions, units,
    quantities, and prices.

    Args:
        file_base64: Excel file content encoded as base64 (xlsx, xls)
        filename: Original filename (helps with format detection)
    """
    try:
        # Decode base64 to temp file
        file_bytes = base64.b64decode(file_base64)

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)

        try:
            result = await _parse_file(tmp_path, filename)
            return result
        finally:
            tmp_path.unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"[MCP/Budget] Error: {e}")
        return {"error": str(e), "items": [], "format_detected": None}


async def _parse_file(file_path: Path, filename: str) -> dict:
    """Parse Excel file using existing parsers."""

    # Try format detection
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

    # Normalize items to a consistent format
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

    return {
        "items": normalized,
        "total_items": len(normalized),
        "format_detected": detected_format,
        "filename": filename,
        "diagnostics": diagnostics,
    }


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
