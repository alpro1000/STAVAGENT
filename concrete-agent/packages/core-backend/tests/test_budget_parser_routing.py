"""
Bug `budget-parser-routing` (2026-07-11, found by the half-B Gate 0 audit):
parse_construction_budget imported NONEXISTENT functions for its dedicated
xlsx sub-parsers (`parse_komplet` / `parse_rts_rozpocet`; real names are
`parse_xlsx_komplet` / `parse_xlsx_rtsrozp`), so komplet/rts-named soupisy
died on ImportError — and the fallback then called a nonexistent
`UniversalParser().parse_file` (real API: `parse_any`), so they errored out
entirely. The golden E_Soupis…MOSTY_PHS.xlsx only worked because 'soupis'
routes to the generic ExcelParser.

These tests pin the fixed routing hermetically (parsers monkeypatched — no
real workbook needed) and the ParsedDocument → items flattening.
"""

import asyncio
import base64
import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.mcp.tools.budget import (
    _positions_from_parsed_document,
    parse_construction_budget,
)
from app.parsers.models import (
    ParsedChapter,
    ParsedDocument,
    ParsedPosition,
    ParsedSO,
    SourceFormat,
)

# Minimal ZIP magic so _detect_file_kind sniffs 'xlsx' (content wins over name).
_FAKE_XLSX_B64 = base64.b64encode(b"PK\x03\x04fake-workbook").decode()


def _doc() -> ParsedDocument:
    return ParsedDocument(
        source_format=SourceFormat.XLSX_KOMPLET,
        stavebni_objekty=[
            ParsedSO(
                so_id="SO 202",
                so_name="Most",
                chapters=[
                    ParsedChapter(
                        code="1",
                        name="Beton",
                        positions=[
                            ParsedPosition(
                                code="421321109",
                                description="NK ze železobetonu C35/45",
                                unit="m3",
                                quantity=Decimal("2697.941"),
                                unit_price=Decimal("4500"),
                                total_price=Decimal("12140734.5"),
                            ),
                        ],
                    )
                ],
            )
        ],
    )


def test_flattener_maps_parsed_document_to_json_safe_items():
    items = _positions_from_parsed_document(_doc())
    assert items == [{
        "code": "421321109",
        "description": "NK ze železobetonu C35/45",
        "unit": "m3",
        "quantity": 2697.941,          # float, not Decimal — JSON-safe
        "unit_price": 4500.0,
        "total_price": 12140734.5,
    }]


def test_komplet_named_file_routes_to_dedicated_parser(monkeypatch):
    """Pre-fix this path died on ImportError; now it must parse."""
    import app.parsers.xlsx_komplet_parser as komplet_mod

    monkeypatch.setattr(komplet_mod, "parse_xlsx_komplet", lambda path: _doc())
    out = asyncio.run(parse_construction_budget(
        file_base64=_FAKE_XLSX_B64, filename="rozpocet_KOMPLET_stavba.xlsx",
    ))
    assert out.get("error") is None or "error" not in out
    assert out["format_detected"] == "komplet"
    assert out["total_items"] == 1
    assert out["items"][0]["code"] == "421321109"
    assert out["diagnostics"]["parser"] == "xlsx_komplet"


def test_rts_named_file_routes_to_dedicated_parser(monkeypatch):
    import app.parsers.xlsx_rtsrozp_parser as rts_mod

    monkeypatch.setattr(rts_mod, "parse_xlsx_rtsrozp", lambda path: _doc())
    out = asyncio.run(parse_construction_budget(
        file_base64=_FAKE_XLSX_B64, filename="RTS_rozpocet.xlsx",
    ))
    assert out["format_detected"] == "rts"
    assert out["total_items"] == 1
    assert out["diagnostics"]["parser"] == "xlsx_rtsrozp"


def test_dedicated_parser_crash_falls_back_to_universal(monkeypatch):
    """Fallback-chain: a crashing dedicated parser degrades to parse_any
    (the REAL universal API — the old code called a nonexistent method)."""
    import app.parsers.universal_parser as uni_mod
    import app.parsers.xlsx_komplet_parser as komplet_mod

    def _boom(path):
        raise ValueError("workbook corrupted")

    monkeypatch.setattr(komplet_mod, "parse_xlsx_komplet", _boom)
    monkeypatch.setattr(uni_mod, "parse_any", lambda path: _doc())
    out = asyncio.run(parse_construction_budget(
        file_base64=_FAKE_XLSX_B64, filename="soupis_komplet.xlsx",
    ))
    assert out["total_items"] == 1
    assert out["diagnostics"]["parser"] == "universal_fallback"
    assert "workbook corrupted" in out["diagnostics"]["primary_error"]
