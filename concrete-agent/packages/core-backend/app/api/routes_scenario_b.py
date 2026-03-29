"""
Scenario B API: TZ → Volumes → Výkaz výměr

Upload a technical documentation (TZ) file, extract construction elements
and volumes, generate bill of quantities (výkaz výměr).
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/scenario-b", tags=["Scenario B"])


class ScenarioBTextRequest(BaseModel):
    """Request for Scenario B from pre-parsed text."""
    text: str = Field(..., min_length=50, description="Full text of the TZ document")
    filename: str = Field(default="", description="Original filename for context")
    project_name: str = Field(default="", description="Project name")


@router.post("/generate")
async def generate_from_text(request: ScenarioBTextRequest):
    """
    Generate výkaz výměr from TZ text (already parsed).

    Accepts plain text extracted from a TZ document and runs the
    extraction + generation pipeline.
    """
    from app.services.scenario_b_generator import scenario_b

    logger.info(f"ScenarioB API: text request ({len(request.text)} chars)")

    result = await scenario_b.generate_from_tz(
        text=request.text,
        filename=request.filename,
        project_name=request.project_name,
    )

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Extraction failed"))

    return result


@router.post("/upload")
async def generate_from_upload(
    file: UploadFile = File(...),
    project_name: str = Form(default=""),
):
    """
    Upload a TZ file (PDF/DOCX) and generate výkaz výměr.

    The file is parsed to text first, then processed through the
    extraction pipeline.
    """
    from app.services.scenario_b_generator import scenario_b

    filename = file.filename or "unknown"
    logger.info(f"ScenarioB API: file upload '{filename}'")

    # Read file content
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Parse file to text
    text = await _parse_file_to_text(content, filename)
    if not text or len(text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Nepodařilo se extrahovat dostatek textu z dokumentu",
        )

    result = await scenario_b.generate_from_tz(
        text=text,
        filename=filename,
        project_name=project_name,
    )

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Extraction failed"))

    return result


async def _parse_file_to_text(content: bytes, filename: str) -> str:
    """Parse uploaded file to plain text using SmartParser."""
    import tempfile
    from pathlib import Path

    ext = Path(filename).suffix.lower()
    safe_name = Path(filename).name  # prevent path traversal

    with tempfile.NamedTemporaryFile(suffix=ext, delete=True) as tmp:
        tmp.write(content)
        tmp.flush()
        tmp_path = Path(tmp.name)

        try:
            from app.parsers.smart_parser import SmartParser
            parser = SmartParser()

            if ext == ".pdf":
                result = await parser.parse_pdf(str(tmp_path))
                return result.get("text", "")
            elif ext in (".docx", ".doc"):
                result = parser.parse_docx(str(tmp_path))
                return result.get("text", "")
            elif ext == ".txt":
                return content.decode("utf-8", errors="replace")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nepodporovaný formát: {ext}. Použijte PDF, DOCX nebo TXT.",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"ScenarioB: file parsing failed: {e}")
            # Try raw text decode as last resort
            try:
                return content.decode("utf-8", errors="replace")
            except Exception:
                return ""
