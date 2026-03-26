"""
Universal Parser API — single endpoint for parsing any construction document.

POST /api/v1/parse/document — upload file → ParsedDocument response

Author: STAVAGENT Team
Version: 5.0.0
"""

import os
import logging
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/parse", tags=["parser"])


@router.post("/document")
async def parse_document(file: UploadFile = File(...)):
    """
    Parse any supported construction document.

    Supported formats:
    - .xlsx → Export Komplet OR #RTSROZP# (auto-detected)
    - .xml → OTSKP catalog OR TSKP classification
    - .pdf → TZ or tabular budget
    - .ifc → BIM model
    - .dxf → CAD drawing

    Returns: ParsedDocument with normalized positions.
    """
    suffix = os.path.splitext(file.filename or "unknown.xlsx")[1].lower()

    if suffix not in ('.xlsx', '.xlsm', '.xls', '.xml', '.pdf', '.ifc', '.dxf', '.dwg'):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {suffix}. "
                   f"Supported: .xlsx, .xml, .pdf, .ifc, .dxf"
        )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from app.parsers.universal_parser import parse_any
        doc = parse_any(tmp_path)

        return {
            "success": True,
            "format": doc.source_format.value,
            "project_id": doc.project_id,
            "project_name": doc.project_name,
            "client": doc.client,
            "positions_count": doc.positions_count,
            "coverage_pct": doc.coverage_pct,
            "so_count": len(doc.stavebni_objekty),
            "stavebni_objekty": [
                {
                    "so_id": so.so_id,
                    "so_name": so.so_name,
                    "chapters_count": len(so.chapters),
                    "positions_count": sum(len(ch.positions) for ch in so.chapters),
                    "chapters": [
                        {
                            "code": ch.code,
                            "name": ch.name,
                            "positions": [
                                {
                                    "pc": p.pc,
                                    "code": p.code,
                                    "description": p.description,
                                    "unit": p.unit,
                                    "quantity": float(p.quantity) if p.quantity else None,
                                    "unit_price": float(p.unit_price) if p.unit_price else None,
                                    "total_price": float(p.total_price) if p.total_price else None,
                                    "price_source": p.price_source,
                                    "specification": p.specification[:200] if p.specification else None,
                                    "vv_lines_count": len(p.vv_lines),
                                    "url": p.url,
                                    "source_row": p.source_row,
                                }
                                for p in ch.positions
                            ],
                        }
                        for ch in so.chapters
                    ],
                }
                for so in doc.stavebni_objekty
            ],
            "warnings": doc.parser_warnings[:20],
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logger.error(f"Parse error: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Parse failed: {str(e)}")
    finally:
        os.unlink(tmp_path)
