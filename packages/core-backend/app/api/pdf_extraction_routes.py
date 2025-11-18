"""Routes exposing the PDF extraction runtime."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Dict, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.core.claude_client import ClaudeClient
from app.services.pdf_extraction_reasoner import (
    PDFExtractionReasonerV2_1,
    PDFExtractionRuntime,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf", tags=["PDF Extraction"])


@router.post("/extract-full")
async def extract_full_pdf(
    pdf_file: UploadFile = File(..., description="PDF document to extract"),
    project_id: str = Query(..., description="Project identifier"),
    use_ocr: bool = Query(True, description="Enable OCR fallback for encoded pages"),
) -> Dict[str, object]:
    """Run the PDF extraction pipeline on the provided document."""

    if not pdf_file.filename.lower().endswith(".pdf") and pdf_file.content_type not in {
        "application/pdf",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    tmp_path: Optional[Path] = None
    try:
        logger.info(
            "PDF extraction request project=%s file=%s use_ocr=%s",
            project_id,
            pdf_file.filename,
            use_ocr,
        )
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            data = await pdf_file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            tmp.write(data)
            tmp_path = Path(tmp.name)

        reasoner = PDFExtractionReasonerV2_1(ClaudeClient())
        runtime = PDFExtractionRuntime(reasoner)
        result = await runtime.extract_full(tmp_path, project_id=project_id, use_ocr=use_ocr)
        return result
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced via HTTP 500
        logger.exception("PDF extraction failed for %s: %s", pdf_file.filename, exc)
        raise HTTPException(status_code=500, detail="Failed to extract PDF markers") from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)
