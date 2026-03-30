"""
TZ → Soupis prací Pipeline API

Endpoints for generating soupis prací from technical documentation.

Stage 5: POST /api/v1/soupis/extract — TZ text → WorkRequirements
Stage 6: POST /api/v1/soupis/assemble — WorkRequirements → Soupis prací
Stage 5+6: POST /api/v1/soupis/generate — TZ upload → full Soupis
"""

import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from app.services.tz_work_extractor import (
    extract_work_requirements,
    extract_work_requirements_regex,
    requirements_to_dict,
)
from app.services.soupis_assembler import (
    assemble_soupis,
    soupis_to_dict,
    WorkRequirement,
    ExtractedParam,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/soupis", tags=["soupis"])


@router.post("/extract")
async def extract_requirements(
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    use_ai: bool = Form(True),
):
    """
    Stage 5: Extract work requirements from TZ text.

    Accepts either raw text or file upload (PDF/DOCX).
    Returns structured WorkRequirements.
    """
    tz_text = None

    if text:
        tz_text = text
    elif file:
        # Parse uploaded file
        tz_text = await _parse_file(file)
    else:
        raise HTTPException(status_code=400, detail="Either 'text' or 'file' must be provided")

    if len(tz_text) < 50:
        raise HTTPException(status_code=400, detail="Text too short for extraction")

    requirements = await extract_work_requirements(tz_text, use_ai=use_ai)

    return {
        "requirements": requirements_to_dict(requirements),
        "count": len(requirements),
        "extraction_methods": {
            "regex": sum(1 for r in requirements if r.extraction_method == 'regex'),
            "ai": sum(1 for r in requirements if r.extraction_method == 'ai'),
        },
        "work_types": list(set(r.work_type for r in requirements if r.work_type)),
    }


@router.post("/assemble")
async def assemble_from_requirements(
    requirements: list,
    use_work_packages: bool = True,
    use_urs_lookup: bool = True,
):
    """
    Stage 6: Assemble soupis from work requirements.

    Input: list of WorkRequirement dicts (from /extract endpoint).
    Returns structured soupis prací.
    """
    # Convert dicts to WorkRequirement objects
    work_reqs = []
    for req_dict in requirements:
        params = []
        for p in req_dict.get('params', []):
            params.append(ExtractedParam(
                type=p.get('type', 'unknown'),
                value=p.get('value', ''),
                normalized=p.get('normalized', p.get('value', '')),
                unit=p.get('unit'),
                confidence=p.get('confidence', 0.7),
            ))

        work_reqs.append(WorkRequirement(
            description=req_dict.get('description', ''),
            work_type=req_dict.get('work_type'),
            params=params,
            confidence=req_dict.get('confidence', 0.7),
            extraction_method=req_dict.get('extraction_method', 'api'),
        ))

    result = await assemble_soupis(
        work_reqs,
        use_work_packages=use_work_packages,
        use_urs_lookup=use_urs_lookup,
    )

    return soupis_to_dict(result)


@router.post("/generate")
async def generate_soupis(
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    use_ai: bool = Form(True),
    use_work_packages: bool = Form(True),
    use_urs_lookup: bool = Form(True),
):
    """
    Stage 5+6: Full pipeline — TZ → WorkRequirements → Soupis prací.

    One-shot endpoint: upload TZ document → get complete soupis.
    """
    tz_text = None

    if text:
        tz_text = text
    elif file:
        tz_text = await _parse_file(file)
    else:
        raise HTTPException(status_code=400, detail="Either 'text' or 'file' must be provided")

    if len(tz_text) < 50:
        raise HTTPException(status_code=400, detail="Text too short for extraction")

    # Stage 5: Extract
    requirements = await extract_work_requirements(tz_text, use_ai=use_ai)

    # Stage 6: Assemble
    result = await assemble_soupis(
        requirements,
        use_work_packages=use_work_packages,
        use_urs_lookup=use_urs_lookup,
    )

    return {
        **soupis_to_dict(result),
        "extraction": {
            "requirements_count": len(requirements),
            "methods": {
                "regex": sum(1 for r in requirements if r.extraction_method == 'regex'),
                "ai": sum(1 for r in requirements if r.extraction_method == 'ai'),
            },
        },
    }


@router.post("/export-xlsx")
async def export_soupis_xlsx_endpoint(
    text: str = Form(None),
    file: Optional[UploadFile] = File(None),
    use_ai: bool = Form(True),
    use_work_packages: bool = Form(True),
    use_urs_lookup: bool = Form(True),
):
    """
    Full pipeline + xlsx export.
    TZ document → extract → assemble → KROS-compatible xlsx download.
    """
    from fastapi.responses import StreamingResponse
    from io import BytesIO

    tz_text = text if text else (await _parse_file(file) if file else None)
    if not tz_text or len(tz_text) < 50:
        raise HTTPException(status_code=400, detail="Either 'text' or 'file' must be provided (min 50 chars)")

    # Pipeline
    requirements = await extract_work_requirements(tz_text, use_ai=use_ai)
    result = await assemble_soupis(requirements, use_work_packages=use_work_packages, use_urs_lookup=use_urs_lookup)

    # Export xlsx
    from app.utils.soupis_exporter import export_soupis_xlsx
    xlsx_bytes = export_soupis_xlsx(soupis_to_dict(result))

    filename = f"soupis_praci_{len(result.positions)}pol.xlsx"
    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================================
# File parsing helper
# ============================================================================

async def _parse_file(file: UploadFile) -> str:
    """Parse uploaded file to text using SmartParser."""
    import tempfile
    import os
    from pathlib import Path

    # Validate extension
    name = Path(file.filename).name if file.filename else 'upload.pdf'
    ext = Path(name).suffix.lower()
    if ext not in ('.pdf', '.docx', '.doc', '.txt'):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Save to temp file
    content = await file.read()
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Use SmartParser
        try:
            from app.parsers.smart_parser import SmartParser
            parser = SmartParser()
            if ext == '.pdf':
                text = parser.parse_pdf(tmp_path)
            elif ext in ('.docx', '.doc'):
                text = parser.parse_docx(tmp_path)
            elif ext == '.txt':
                text = content.decode('utf-8', errors='replace')
            else:
                text = content.decode('utf-8', errors='replace')
        except ImportError:
            # Fallback: plain text for .txt, error for others
            if ext == '.txt':
                text = content.decode('utf-8', errors='replace')
            else:
                raise HTTPException(status_code=500, detail="Document parser not available")

        if not text or len(text) < 20:
            raise HTTPException(status_code=400, detail="Could not extract text from document")

        return text
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
