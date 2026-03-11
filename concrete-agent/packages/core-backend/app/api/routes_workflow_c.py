"""
Workflow C API Routes

Complete end-to-end pipeline from upload to summary.

ENDPOINTS:
- POST /api/v1/workflow/c/execute - Execute full pipeline
- POST /api/v1/workflow/c/upload - Upload and execute
- GET /api/v1/workflow/c/{project_id}/status - Get progress
- GET /api/v1/workflow/c/{project_id}/result - Get result
- GET /api/v1/workflow/c/health - Health check

VERSION: 1.0.0 (2025-12-28)
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.workflow_c import (
    WorkflowC,
    WorkflowCResult,
    WorkflowStage,
    execute_workflow_c,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workflow/c", tags=["Workflow C"])

# In-memory storage for workflow results and progress
_workflow_results: Dict[str, Dict[str, Any]] = {}
_workflow_progress: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class PositionInput(BaseModel):
    """Position data for workflow execution"""
    code: Optional[str] = None
    description: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None


class ExecuteRequest(BaseModel):
    """Request for workflow execution with pre-parsed positions"""
    project_id: str = Field(..., description="Unique project identifier")
    project_name: str = Field(..., description="Human-readable project name")
    positions: List[PositionInput] = Field(
        ...,
        description="List of positions to process",
        min_length=1,
    )
    generate_summary: bool = Field(
        default=True,
        description="Generate project summary at end"
    )
    use_parallel: bool = Field(
        default=True,
        description="Use parallel Multi-Role execution (3-4x faster)"
    )
    language: str = Field(
        default="cs",
        description="Output language: cs, en, sk"
    )


class ProgressResponse(BaseModel):
    """Workflow progress response"""
    project_id: str
    current_stage: str
    progress_percentage: float
    stages_completed: List[str]
    duration_seconds: float
    error: Optional[str] = None


class WorkflowResultResponse(BaseModel):
    """Complete workflow result response"""
    success: bool
    project_id: str
    project_name: str
    positions_count: int
    audit_classification: str
    audit_confidence: float
    critical_issues: List[str]
    warnings: List[str]
    summary: Optional[Dict[str, Any]] = None
    total_duration_seconds: float
    stage_durations: Dict[str, float]
    multi_role_speedup: Optional[float] = None


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/execute", response_model=WorkflowResultResponse)
async def execute_workflow(request: ExecuteRequest) -> WorkflowResultResponse:
    """
    Execute complete Workflow C pipeline with pre-parsed positions.

    **Pipeline stages:**
    1. VALIDATION - Validate position data
    2. ENRICHMENT - Match against KROS/RTS database
    3. AUDIT - Multi-Role AI audit (parallel)
    4. SUMMARY - Generate project summary (optional)

    **Performance:**
    - Sequential: 60-90 seconds
    - Parallel: 30-45 seconds (2-3x faster)

    **Request:**
    - project_id: Unique identifier
    - project_name: Human-readable name
    - positions: List of positions to process
    - use_parallel: Enable parallel execution (recommended)
    - generate_summary: Generate summary at end

    **Response:**
    - audit_classification: GREEN/AMBER/RED
    - critical_issues: Issues requiring attention
    - summary: Project summary (if requested)
    """
    try:
        logger.info(
            f"🚀 Workflow C: Starting for {request.project_id} "
            f"({len(request.positions)} positions)"
        )

        # Convert positions
        positions = [pos.model_dump() for pos in request.positions]

        # Create workflow and set up progress tracking
        workflow = WorkflowC()

        def on_progress(progress):
            _workflow_progress[request.project_id] = progress.to_dict()

        workflow.on_progress(on_progress)

        # Execute workflow
        result = await workflow.execute(
            project_id=request.project_id,
            project_name=request.project_name,
            positions=positions,
            generate_summary=request.generate_summary,
            use_parallel=request.use_parallel,
            language=request.language,
        )

        # Store result
        result_dict = result.to_dict()
        _workflow_results[request.project_id] = result_dict

        logger.info(
            f"✅ Workflow C complete: {request.project_id}, "
            f"{result.audit_classification}, "
            f"{result.total_duration_seconds:.2f}s"
        )

        return WorkflowResultResponse(
            success=result.success,
            project_id=result.project_id,
            project_name=result.project_name,
            positions_count=result.positions_count,
            audit_classification=result.audit_classification,
            audit_confidence=result.audit_confidence,
            critical_issues=result.critical_issues,
            warnings=result.warnings,
            summary=result.summary.to_dict() if result.summary else None,
            total_duration_seconds=result.total_duration_seconds,
            stage_durations=result.stage_durations,
            multi_role_speedup=result.multi_role_speedup,
        )

    except Exception as e:
        logger.error(f"❌ Workflow C failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Workflow C failed: {str(e)}")


@router.post("/upload")
async def upload_and_execute(
    file: UploadFile = File(..., description="Excel, PDF, or XML file"),
    project_id: str = Form(..., description="Project ID"),
    project_name: str = Form(..., description="Project name"),
    generate_summary: bool = Form(default=True),
    use_parallel: bool = Form(default=True),
    language: str = Form(default="cs"),
) -> WorkflowResultResponse:
    """
    Upload file and execute complete Workflow C pipeline.

    **Supported formats:**
    - Excel (.xlsx, .xls)
    - PDF (.pdf)
    - XML (.xml)

    **Pipeline stages:**
    1. PARSING - Parse uploaded file
    2. VALIDATION - Validate positions
    3. ENRICHMENT - Match against KROS/RTS
    4. AUDIT - Multi-Role AI audit
    5. SUMMARY - Generate summary

    **Example:**
    ```bash
    curl -X POST /api/v1/workflow/c/upload \\
      -F "file=@estimate.xlsx" \\
      -F "project_id=proj-123" \\
      -F "project_name=Bridge SO-101"
    ```
    """
    try:
        logger.info(
            f"📤 Workflow C Upload: {file.filename} for {project_id}"
        )

        # Read file content
        content = await file.read()

        # Save to temp file
        suffix = Path(file.filename).suffix if file.filename else ".xlsx"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            temp_path = Path(f.name)

        try:
            # Create workflow
            workflow = WorkflowC()

            def on_progress(progress):
                _workflow_progress[project_id] = progress.to_dict()

            workflow.on_progress(on_progress)

            # Execute
            result = await workflow.execute(
                project_id=project_id,
                project_name=project_name,
                file_path=temp_path,
                generate_summary=generate_summary,
                use_parallel=use_parallel,
                language=language,
            )

            # Store result
            _workflow_results[project_id] = result.to_dict()

            return WorkflowResultResponse(
                success=result.success,
                project_id=result.project_id,
                project_name=result.project_name,
                positions_count=result.positions_count,
                audit_classification=result.audit_classification,
                audit_confidence=result.audit_confidence,
                critical_issues=result.critical_issues,
                warnings=result.warnings,
                summary=result.summary.to_dict() if result.summary else None,
                total_duration_seconds=result.total_duration_seconds,
                stage_durations=result.stage_durations,
                multi_role_speedup=result.multi_role_speedup,
            )

        finally:
            temp_path.unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"❌ Workflow C upload failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Workflow C failed: {str(e)}")


@router.post("/execute-async")
async def execute_workflow_async(
    request: ExecuteRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    Execute Workflow C asynchronously in background.

    Returns immediately with task ID.
    Use GET /{project_id}/status to check progress.
    Use GET /{project_id}/result to get final result.

    **Ideal for:**
    - Large files (>100 positions)
    - Non-blocking UI
    - Webhook callbacks
    """
    try:
        logger.info(f"🚀 Workflow C Async: Starting for {request.project_id}")

        # Initialize progress
        _workflow_progress[request.project_id] = {
            "project_id": request.project_id,
            "current_stage": "pending",
            "progress_percentage": 0,
            "stages_completed": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

        # Add background task
        positions = [pos.model_dump() for pos in request.positions]

        async def run_workflow():
            workflow = WorkflowC()

            def on_progress(progress):
                _workflow_progress[request.project_id] = progress.to_dict()

            workflow.on_progress(on_progress)

            result = await workflow.execute(
                project_id=request.project_id,
                project_name=request.project_name,
                positions=positions,
                generate_summary=request.generate_summary,
                use_parallel=request.use_parallel,
                language=request.language,
            )

            _workflow_results[request.project_id] = result.to_dict()

        background_tasks.add_task(run_workflow)

        return {
            "success": True,
            "project_id": request.project_id,
            "status": "started",
            "message": "Workflow started in background",
            "status_url": f"/api/v1/workflow/c/{request.project_id}/status",
            "result_url": f"/api/v1/workflow/c/{request.project_id}/result",
        }

    except Exception as e:
        logger.error(f"❌ Workflow C async start failed: {str(e)}")
        raise HTTPException(500, f"Failed to start workflow: {str(e)}")


@router.get("/{project_id}/status", response_model=ProgressResponse)
async def get_workflow_status(project_id: str) -> ProgressResponse:
    """
    Get current workflow progress.

    **Response:**
    - current_stage: Current pipeline stage
    - progress_percentage: 0-100%
    - stages_completed: List of completed stages
    - duration_seconds: Time elapsed
    """
    if project_id not in _workflow_progress:
        raise HTTPException(404, f"No workflow found for project {project_id}")

    progress = _workflow_progress[project_id]

    return ProgressResponse(
        project_id=project_id,
        current_stage=progress.get("current_stage", "unknown"),
        progress_percentage=progress.get("progress_percentage", 0),
        stages_completed=progress.get("stages_completed", []),
        duration_seconds=progress.get("duration_seconds", 0),
        error=progress.get("error"),
    )


@router.get("/{project_id}/result", response_model=WorkflowResultResponse)
async def get_workflow_result(project_id: str) -> WorkflowResultResponse:
    """
    Get completed workflow result.

    Returns 404 if workflow not found or not completed.
    """
    if project_id not in _workflow_results:
        # Check if still in progress
        if project_id in _workflow_progress:
            progress = _workflow_progress[project_id]
            if progress.get("current_stage") != "completed":
                raise HTTPException(
                    202,
                    f"Workflow still in progress: {progress.get('current_stage')}"
                )

        raise HTTPException(404, f"No result found for project {project_id}")

    result = _workflow_results[project_id]

    return WorkflowResultResponse(
        success=result.get("success", False),
        project_id=result.get("project_id", project_id),
        project_name=result.get("project_name", "Unknown"),
        positions_count=result.get("positions_count", 0),
        audit_classification=result.get("audit_classification", "UNKNOWN"),
        audit_confidence=result.get("audit_confidence", 0),
        critical_issues=result.get("critical_issues", []),
        warnings=result.get("warnings", []),
        summary=result.get("summary"),
        total_duration_seconds=result.get("total_duration_seconds", 0),
        stage_durations=result.get("stage_durations", {}),
        multi_role_speedup=result.get("multi_role_speedup"),
    )


@router.delete("/{project_id}")
async def delete_workflow_data(project_id: str) -> Dict[str, Any]:
    """
    Delete workflow data for a project.
    """
    deleted_progress = project_id in _workflow_progress
    deleted_result = project_id in _workflow_results

    if project_id in _workflow_progress:
        del _workflow_progress[project_id]

    if project_id in _workflow_results:
        del _workflow_results[project_id]

    return {
        "success": True,
        "project_id": project_id,
        "deleted_progress": deleted_progress,
        "deleted_result": deleted_result,
    }


@router.get("/health")
async def health() -> Dict[str, Any]:
    """
    Workflow C module health check.
    """
    return {
        "status": "healthy",
        "system": "workflow-c",
        "version": "1.0.0",
        "features": {
            "parallel_execution": True,
            "summary_generation": True,
            "async_execution": True,
            "file_upload": True,
            "supported_formats": ["xlsx", "xls", "pdf", "xml"],
        },
        "pipeline_stages": [
            "parsing",
            "validating",
            "enriching",
            "auditing",
            "summarizing",
        ],
        "active_workflows": len(_workflow_progress),
        "cached_results": len(_workflow_results),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
