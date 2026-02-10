"""
Project Passport API Routes

Generate complete project passports from construction documents.

ENDPOINTS:
- POST /api/v1/passport/generate - Generate passport from file
- POST /api/v1/passport/generate-multiple - Generate from multiple files
- GET /api/v1/passport/{passport_id} - Get passport by ID
- GET /api/v1/passport/health - Health check

VERSION: 1.0.0 (2026-02-10)
"""

import logging
from pathlib import Path
from typing import Dict, Any, Optional
import tempfile
import os

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.services.document_processor import DocumentProcessor, process_document
from app.models.passport_schema import (
    ProjectPassport,
    PassportGenerationRequest,
    PassportGenerationResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/passport", tags=["Project Passport"])

# In-memory storage for passports (TODO: Replace with database)
_passport_storage: Dict[str, ProjectPassport] = {}


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/generate", response_model=PassportGenerationResponse)
async def generate_passport(
    file: UploadFile = File(..., description="Construction document (PDF, Excel, XML)"),
    project_name: str = Form(..., description="Project name"),
    enable_ai_enrichment: bool = Form(True, description="Enable AI enrichment (Layer 3)"),
    project_id: Optional[str] = Form(None, description="Optional project ID")
):
    """
    Generate project passport from a single document.

    **3-Layer Architecture:**
    - Layer 1: Document parsing (MinerU/SmartParser) - 1-3s
    - Layer 2: Regex extraction (deterministic facts) - <100ms
    - Layer 3: AI enrichment (Claude/Gemini, optional) - 3-5s

    **Returns:**
    - Passport with concrete specs, reinforcement, quantities
    - Special requirements (Bílá vana, Pohledový beton)
    - Building dimensions and layout
    - AI-enriched: risks, location, timeline, stakeholders

    **Example:**
    ```bash
    curl -X POST "http://localhost:8000/api/v1/passport/generate" \\
      -F "file=@technicka_zprava.pdf" \\
      -F "project_name=Polyfunkční dům Praha 5" \\
      -F "enable_ai_enrichment=true"
    ```
    """
    logger.info(f"Generating passport: {project_name}, AI: {enable_ai_enrichment}")

    # Validate file type
    allowed_extensions = ['.pdf', '.xlsx', '.xls', '.xml']
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {allowed_extensions}"
        )

    # Save uploaded file to temp location
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file.filename)

    try:
        # Write uploaded file
        with open(temp_file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.info(f"Saved file to: {temp_file_path} ({len(content)} bytes)")

        # Process document
        response = await process_document(
            file_path=temp_file_path,
            project_name=project_name,
            enable_ai=enable_ai_enrichment,
            project_id=project_id
        )

        if response.success and response.passport:
            # Store passport in memory
            passport_id = response.passport.passport_id
            _passport_storage[passport_id] = response.passport

            logger.info(f"Passport generated: {passport_id}, time: {response.processing_time_ms}ms")

        return response

    except Exception as e:
        logger.error(f"Failed to generate passport: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup temp file
        try:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp files: {e}")


@router.post("/generate-from-path")
async def generate_passport_from_path(
    request: PassportGenerationRequest
) -> PassportGenerationResponse:
    """
    Generate passport from existing file path.

    Useful when file is already uploaded to server.

    **Request Body:**
    ```json
    {
      "project_id": "proj_12345",
      "file_paths": ["/data/projects/proj_12345/technicka_zprava.pdf"],
      "enable_ai_enrichment": true,
      "language": "cs"
    }
    ```
    """
    logger.info(f"Generating passport from path: {request.file_paths}")

    if not request.file_paths:
        raise HTTPException(status_code=400, detail="No file paths provided")

    # Process first file (or all files and merge)
    file_path = request.file_paths[0]

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        response = await process_document(
            file_path=file_path,
            project_name=request.project_id,  # Use project_id as name for now
            enable_ai=request.enable_ai_enrichment,
            project_id=request.project_id
        )

        if response.success and response.passport:
            # Store passport
            passport_id = response.passport.passport_id
            _passport_storage[passport_id] = response.passport

        return response

    except Exception as e:
        logger.error(f"Failed to generate passport: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{passport_id}", response_model=ProjectPassport)
async def get_passport(passport_id: str):
    """
    Get passport by ID.

    **Example:**
    ```bash
    curl "http://localhost:8000/api/v1/passport/passport_abc123"
    ```
    """
    if passport_id not in _passport_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Passport not found: {passport_id}"
        )

    return _passport_storage[passport_id]


@router.get("/list/all")
async def list_passports():
    """
    List all generated passports (IDs only).

    **Example:**
    ```bash
    curl "http://localhost:8000/api/v1/passport/list/all"
    ```
    """
    return {
        "total": len(_passport_storage),
        "passports": [
            {
                "passport_id": p.passport_id,
                "project_name": p.project_name,
                "generated_at": p.generated_at.isoformat(),
                "source_documents": p.source_documents
            }
            for p in _passport_storage.values()
        ]
    }


@router.delete("/{passport_id}")
async def delete_passport(passport_id: str):
    """
    Delete passport by ID.

    **Example:**
    ```bash
    curl -X DELETE "http://localhost:8000/api/v1/passport/passport_abc123"
    ```
    """
    if passport_id not in _passport_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Passport not found: {passport_id}"
        )

    del _passport_storage[passport_id]

    return {"message": f"Passport {passport_id} deleted"}


@router.get("/health")
async def health_check():
    """
    Health check for passport service.

    Returns:
    - Service status
    - Number of passports in memory
    - Layer availability (Parser, Regex, AI)
    """
    # Check if services are available
    try:
        processor = DocumentProcessor()
        has_ai = processor.enricher.gemini_model is not None or processor.enricher.claude_client is not None
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        has_ai = False

    return {
        "status": "healthy",
        "passports_in_memory": len(_passport_storage),
        "layers": {
            "layer1_parser": "available",
            "layer2_regex": "available",
            "layer3_ai": "available" if has_ai else "unavailable (no API keys)"
        },
        "timestamp": datetime.now().isoformat()
    }


# ============================================================================
# EXPORT ENDPOINTS
# ============================================================================

@router.get("/{passport_id}/export/json")
async def export_passport_json(passport_id: str):
    """
    Export passport as JSON.
    """
    if passport_id not in _passport_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Passport not found: {passport_id}"
        )

    passport = _passport_storage[passport_id]

    return JSONResponse(
        content=passport.model_dump(mode='json'),
        headers={
            "Content-Disposition": f"attachment; filename={passport_id}.json"
        }
    )


@router.get("/{passport_id}/summary")
async def get_passport_summary(passport_id: str):
    """
    Get compact summary of passport (key facts only).
    """
    if passport_id not in _passport_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Passport not found: {passport_id}"
        )

    passport = _passport_storage[passport_id]

    # Build summary
    summary = {
        "passport_id": passport.passport_id,
        "project_name": passport.project_name,
        "generated_at": passport.generated_at.isoformat(),

        # Key facts
        "concrete_classes": [
            {
                "class": spec.concrete_class,
                "exposure": [e.value for e in spec.exposure_classes]
            }
            for spec in passport.concrete_specifications
        ],

        "steel_grades": [
            steel.steel_grade.value
            for steel in passport.reinforcement
        ],

        "dimensions": {
            "floors_underground": passport.dimensions.floors_underground if passport.dimensions else None,
            "floors_above_ground": passport.dimensions.floors_above_ground if passport.dimensions else None,
            "height_m": passport.dimensions.height_m if passport.dimensions else None
        },

        "special_requirements": [
            req.requirement_type
            for req in passport.special_requirements
        ],

        "total_quantities": {
            "volume_m3": sum(q.volume_m3 or 0 for q in passport.quantities),
            "area_m2": sum(q.area_m2 or 0 for q in passport.quantities),
            "mass_tons": sum(q.mass_tons or 0 for q in passport.quantities)
        },

        # AI enrichments
        "structure_type": passport.structure_type.value if passport.structure_type else None,
        "risks_count": len(passport.risks),
        "stakeholders_count": len(passport.stakeholders),

        # Processing stats
        "processing_time_ms": passport.processing_time_ms,
        "extraction_stats": passport.extraction_stats
    }

    return summary


# Import at module level for FastAPI router registration
from datetime import datetime
