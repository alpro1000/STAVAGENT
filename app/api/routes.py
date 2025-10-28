"""
API Routes - UPDATED with Enrichment Support
Добавлена поддержка обогащения позиций из чертежей
"""
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import json
import logging
import uuid
import aiofiles
import mimetypes

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form, Query
from fastapi.responses import FileResponse

from app.core.config import settings, ArtifactPaths
from app.services.workflow_a import WorkflowA
from app.services.workflow_b import WorkflowB
from app.state.project_store import project_store
from app.models.project import (
    Project,
    ProjectStatus,
    ProjectResponse,
    ProjectStatusResponse,
    WorkflowResultResponse,
    ProjectListResponse,
    ProjectSummary,
    ProjectFilesResponse,
    WorkflowType,
    FileMetadata,
)
from app.services.workflow_selector import select
from app.utils.datetime_utils import get_utc_timestamp_iso


def normalize_status(status: Union[ProjectStatus, str]) -> str:
    """
    Конвертирует статус в нижний регистр строку
    Адаптер между внутренним enum и внешним API
    """
    if isinstance(status, ProjectStatus):
        return status.value.lower()
    return str(status).lower()


logger = logging.getLogger(__name__)

DATA_DIR = settings.DATA_DIR or settings.BASE_DIR / "data"

# Создаём каталог для артефактов
CURATED_DIR = DATA_DIR / "curated"
CURATED_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()

# Constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {
    'vykaz': {'.xml', '.xlsx', '.xls', '.pdf', '.csv'},
    'vykresy': {'.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.txt'},
    'dokumentace': {'.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt', '.csv'},
}

def create_safe_file_metadata(
    file_path: Path,
    file_type: str,
    project_id: str,
    uploaded_at: Optional[datetime] = None
) -> Dict[str, Any]:
    """Create safe metadata for a stored file without exposing server paths."""

    file_path = Path(file_path)
    if uploaded_at is None:
        uploaded_at = datetime.now()

    # Determine file size (0 if file missing)
    try:
        file_size = file_path.stat().st_size
    except FileNotFoundError:
        file_size = 0

    return {
        "file_id": f"{project_id}:{file_type}:{file_path.name}",
        "filename": file_path.name,
        "file_type": file_type,
        "size": file_size,
        "uploaded_at": uploaded_at.isoformat(),
    }


def _parse_uploaded_at(value: Union[str, datetime, None]) -> datetime:
    """Parse uploaded_at value from FileMetadata safely."""

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass

    return datetime.now()


def _normalize_optional_file(file: Any) -> Optional[UploadFile]:
    """Convert empty string to None"""
    if file is None:
        return None
    if isinstance(file, str) and file == "":
        return None
    if hasattr(file, "filename"):
        if not getattr(file, "filename"):
            return None
        return file
    return None


def _normalize_file_list(files: Any) -> List[UploadFile]:
    """Convert file list, filtering empty values"""
    if files is None:
        return []
    if isinstance(files, str) and files == "":
        return []
    if not isinstance(files, list):
        files = [files]

    result = []
    for f in files:
        if hasattr(f, "filename") and getattr(f, "filename"):
            result.append(f)

    return result


def _sanitize_filename(filename: str) -> str:
    """Ensure uploaded filename cannot escape storage directories."""
    if not filename:
        raise HTTPException(400, "Filename is required")

    safe_name = Path(filename).name
    if safe_name != filename:
        logger.warning("Rejected unsafe filename '%s'", filename)
        raise HTTPException(400, "Invalid filename")

    if safe_name in {"", ".", ".."}:
        logger.warning("Rejected empty or dot filename '%s'", filename)
        raise HTTPException(400, "Invalid filename")

    return safe_name


async def _save_file_streaming(
    file: UploadFile,
    target_dir: Path,
    safe_filename: str
) -> FileMetadata:
    """Save uploaded file with streaming ensuring path safety."""
    target_dir.mkdir(parents=True, exist_ok=True)

    resolved_dir = target_dir.resolve()
    save_path = (resolved_dir / safe_filename).resolve()

    try:
        save_path.relative_to(resolved_dir)
    except ValueError:
        logger.warning(
            "Rejected path traversal attempt for '%s' -> %s",
            safe_filename,
            save_path,
        )
        raise HTTPException(400, "Invalid filename")

    file_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks

    async with aiofiles.open(save_path, 'wb') as f:
        while chunk := await file.read(chunk_size):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                Path(save_path).unlink(missing_ok=True)
                raise HTTPException(400, f"File {safe_filename} exceeds 50MB limit")
            await f.write(chunk)

    return FileMetadata(
        filename=safe_filename,
        size=file_size,
        uploaded_at=datetime.now().isoformat(),
        file_type=Path(safe_filename).suffix[1:]
    )


async def run_workflow_b(project_id: str, drawings_path: str, project_name: str) -> None:
    """Background task to process Workflow B projects."""

    project = project_store.get(project_id)
    if not project:
        logger.error(
            "Workflow B background task: project %s not found in store",
            project_id,
        )
        return

    workflow_service = WorkflowB()

    try:
        project["status"] = ProjectStatus.PROCESSING
        project["updated_at"] = datetime.now().isoformat()

        drawings_dir = Path(drawings_path)
        if not drawings_dir.exists():
            raise FileNotFoundError(
                f"Drawings directory does not exist: {drawings_dir}"
            )

        drawing_files = [
            path for path in sorted(drawings_dir.iterdir()) if path.is_file()
        ]

        if not drawing_files:
            raise ValueError(
                f"No drawing files found in directory: {drawings_dir}"
            )

        result = await workflow_service.execute(
            project_id=project_id,
            drawing_paths=drawing_files,
            project_name=project_name,
        )

        if not result.get("success", False):
            raise RuntimeError(result.get("error", "Workflow B execution failed"))

        project.update(
            {
                "status": ProjectStatus.COMPLETED,
                "updated_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "message": "Workflow B processing completed successfully.",
                "progress": 100,
                "error": None,
                "audit_results": result,
                "total_positions": result.get("total_positions", 0),
                "positions_total": result.get("total_positions", 0),
                "positions_processed": result.get("total_positions", 0),
                "green_count": result.get("green_count", 0),
                "amber_count": result.get("amber_count", 0),
                "red_count": result.get("red_count", 0),
            }
        )

        logger.info(
            "Workflow B background task completed for project %s", project_id
        )

    except Exception as exc:  # pylint: disable=broad-except
        logger.error(
            "Workflow B background task failed for project %s: %s",
            project_id,
            exc,
            exc_info=True,
        )
        project.update(
            {
                "status": ProjectStatus.FAILED,
                "updated_at": datetime.now().isoformat(),
                "error": str(exc),
                "message": f"Workflow B processing failed: {exc}",
            }
        )


@router.get("/", operation_id="get_root_status")
async def root():
    """Health check endpoint"""
    return {
        "service": "Czech Building Audit System",
        "status": normalize_status("running"),
        "version": "2.0.0",
        "features": {
            "workflow_a": settings.ENABLE_WORKFLOW_A,
            "workflow_b": settings.ENABLE_WORKFLOW_B,
            "drawing_enrichment": True,  # NEW FEATURE
            "csn_validation": True        # NEW FEATURE
        }
    }


@router.post("/api/upload", response_model=ProjectResponse)
async def upload_project(
    background_tasks: BackgroundTasks,
    
    # Required parameters
    project_name: str = Form(..., description="Project name"),
    workflow: str = Form(..., description="Workflow type: 'A' or 'B'"),
    
    # Main files
    vykaz_vymer: Union[UploadFile, str, None] = File(
        None, 
        description="Výkaz výměr (required for Workflow A)"
    ),
    
    vykresy: Union[List[UploadFile], List[str], List[Any]] = File(
        default=[],
        description="Drawings (required for both workflows)"
    ),
    
    # Optional files
    rozpocet: Union[UploadFile, str, None] = File(
        None,
        description="Budget with prices (optional)"
    ),
    
    dokumentace: Union[List[UploadFile], List[str], List[Any]] = File(
        default=[],
        description="Project documentation (optional)"
    ),
    
    zmeny: Union[List[UploadFile], List[str], List[Any]] = File(
        default=[],
        description="Changes and amendments (optional)"
    ),
    
    # Options
    generate_summary: bool = Form(default=True, description="Generate summary"),
    auto_start_audit: bool = Form(default=True, description="Auto-start audit"),
    
    # ✨ NEW: Enrichment option
    enable_enrichment: bool = Form(
        default=True,
        description="Enable position enrichment with drawing specifications"
    )
    
) -> ProjectResponse:
    """
    Upload project for audit
    
    **NEW in v2.0:** Drawing Enrichment Support
    - Automatically extracts material specifications from drawings
    - Matches positions with drawing specs using AI
    - Validates against ČSN standards
    - Enriches positions with technical parameters
    
    Set enable_enrichment=true to use this feature (default: true)
    """
    
    try:
        # Validate workflow
        workflow = workflow.upper()
        if workflow not in ['A', 'B']:
            raise HTTPException(400, "workflow must be 'A' or 'B'")

        if workflow == 'B' and not settings.ENABLE_WORKFLOW_B:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Workflow B is currently disabled. Please contact the system "
                    "administrator to enable it or try Workflow A."
                ),
            )
        
        # Normalize files
        vykaz_vymer = _normalize_optional_file(vykaz_vymer)
        rozpocet = _normalize_optional_file(rozpocet)
        vykresy_files = _normalize_file_list(vykresy)
        dokumentace_files = _normalize_file_list(dokumentace)
        zmeny_files = _normalize_file_list(zmeny)
        
        # Validate required files
        if workflow == 'A' and not vykaz_vymer:
            raise HTTPException(400, "vykaz_vymer required for Workflow A")
        
        if workflow == 'B' and not vykresy_files:
            raise HTTPException(400, "vykresy required for Workflow B")
        
        # Create project ID
        project_id = f"proj_{uuid.uuid4().hex[:12]}"
        
        logger.info(
            f"📤 Nové nahrání: {project_id} - {project_name} "
            f"(Workflow {workflow}, Enrichment: {'enabled' if enable_enrichment else 'disabled'})"
        )
        logger.info(
            f"Soubory po filtraci: "
            f"vykresy={len(vykresy_files)}, "
            f"dokumentace={len(dokumentace_files)}, "
            f"zmeny={len(zmeny_files)}"
        )
        
        # Create project directory
        project_dir = ArtifactPaths.raw_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)

        safe_files: List[Dict[str, Any]] = []
        file_locations: Dict[str, str] = {}
        saved_file_paths: List[Path] = []

        # Save files
        vykaz_vymer_meta = None
        vykaz_vymer_name: Optional[str] = None
        if vykaz_vymer:
            vykaz_dir = project_dir / "vykaz_vymer"
            vykaz_vymer_name = _sanitize_filename(vykaz_vymer.filename)
            vykaz_vymer_meta = await _save_file_streaming(
                vykaz_vymer,
                vykaz_dir,
                vykaz_vymer_name,
            )
            vykaz_path = vykaz_dir / vykaz_vymer_name
            logger.info(
                f"✅ Validace OK: {vykaz_vymer_name} "
                f"({vykaz_vymer_meta.size / 1024:.1f} KB)"
            )
            logger.info(
                f"💾 Uloženo: {vykaz_vymer_name} "
                f"({vykaz_vymer_meta.size / 1024:.1f} KB)"
            )

            safe_meta = create_safe_file_metadata(
                file_path=vykaz_path,
                file_type="vykaz_vymer",
                project_id=project_id,
                uploaded_at=_parse_uploaded_at(vykaz_vymer_meta.uploaded_at)
            )
            safe_files.append(safe_meta)
            file_locations[safe_meta["file_id"]] = str(vykaz_path)
            saved_file_paths.append(vykaz_path)

        rozpocet_meta = None
        rozpocet_name: Optional[str] = None
        if rozpocet:
            rozpocet_dir = project_dir / "rozpocet"
            rozpocet_name = _sanitize_filename(rozpocet.filename)
            rozpocet_meta = await _save_file_streaming(
                rozpocet,
                rozpocet_dir,
                rozpocet_name,
            )
            rozpocet_path = rozpocet_dir / rozpocet_name
            logger.info(
                f"💾 Uloženo: {rozpocet_name} "
                f"({rozpocet_meta.size / 1024:.1f} KB)"
            )

            safe_meta = create_safe_file_metadata(
                file_path=rozpocet_path,
                file_type="rozpocet",
                project_id=project_id,
                uploaded_at=_parse_uploaded_at(rozpocet_meta.uploaded_at)
            )
            safe_files.append(safe_meta)
            file_locations[safe_meta["file_id"]] = str(rozpocet_path)
            saved_file_paths.append(rozpocet_path)

        # Save vykresy
        vykresy_dir = project_dir / "vykresy"
        vykresy_names: List[str] = []
        for vykres in vykresy_files:
            vykres_name = _sanitize_filename(vykres.filename)
            vykres_meta = await _save_file_streaming(
                vykres,
                vykresy_dir,
                vykres_name,
            )
            vykres_path = vykresy_dir / vykres_name
            logger.info(f"💾 Uloženo: {vykres_name}")

            safe_meta = create_safe_file_metadata(
                file_path=vykres_path,
                file_type="vykresy",
                project_id=project_id,
                uploaded_at=_parse_uploaded_at(vykres_meta.uploaded_at)
            )
            safe_files.append(safe_meta)
            file_locations[safe_meta["file_id"]] = str(vykres_path)
            vykresy_names.append(vykres_name)
            saved_file_paths.append(vykres_path)

        # Save dokumentace
        dokumentace_dir = project_dir / "dokumentace"
        dokumentace_names: List[str] = []
        for doc in dokumentace_files:
            doc_name = _sanitize_filename(doc.filename)
            doc_meta = await _save_file_streaming(
                doc,
                dokumentace_dir,
                doc_name,
            )
            doc_path = dokumentace_dir / doc_name
            logger.info(f"💾 Uloženo: {doc_name}")

            safe_meta = create_safe_file_metadata(
                file_path=doc_path,
                file_type="dokumentace",
                project_id=project_id,
                uploaded_at=_parse_uploaded_at(doc_meta.uploaded_at)
            )
            safe_files.append(safe_meta)
            file_locations[safe_meta["file_id"]] = str(doc_path)
            dokumentace_names.append(doc_name)
            saved_file_paths.append(doc_path)

        # Save zmeny
        zmeny_dir = project_dir / "zmeny"
        zmeny_names: List[str] = []
        for zmena in zmeny_files:
            zmena_name = _sanitize_filename(zmena.filename)
            zmena_meta = await _save_file_streaming(
                zmena,
                zmeny_dir,
                zmena_name,
            )
            zmena_path = zmeny_dir / zmena_name
            logger.info(f"💾 Uloženo: {zmena_name}")

            safe_meta = create_safe_file_metadata(
                file_path=zmena_path,
                file_type="zmeny",
                project_id=project_id,
                uploaded_at=_parse_uploaded_at(zmena_meta.uploaded_at)
            )
            safe_files.append(safe_meta)
            file_locations[safe_meta["file_id"]] = str(zmena_path)
            zmeny_names.append(zmena_name)
            saved_file_paths.append(zmena_path)
        
        ArtifactPaths.artifacts_dir(project_id).mkdir(parents=True, exist_ok=True)

        requested_workflow = workflow
        selected_workflow, selection_status = select(
            workflow_param=requested_workflow,
            enable_a=settings.ENABLE_WORKFLOW_A,
            enable_b=settings.ENABLE_WORKFLOW_B,
            saved_files=saved_file_paths,
        )

        if selected_workflow != requested_workflow:
            logger.warning(
                "Project %s: workflow override %s -> %s (status=%s)",
                project_id,
                requested_workflow,
                selected_workflow,
                selection_status,
            )
        workflow = selected_workflow
        logger.info(
            "Workflow selection for %s: requested=%s selected=%s status=%s",
            project_id,
            requested_workflow,
            workflow,
            selection_status,
        )

        # Store project metadata
        project_store[project_id] = {
            "project_id": project_id,
            "project_name": project_name,
            "workflow": workflow,
            "status": ProjectStatus.UPLOADED,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "enable_enrichment": enable_enrichment,  # ✨ NEW
            "progress": 0,
            "positions_total": 0,
            "positions_processed": 0,
            "positions_raw": 0,
            "positions_skipped": 0,
            "diagnostics": {
                "drawing_specs": {
                    "page_states": {
                        "status": "pending",
                        "good_text": 0,
                        "encoded_text": 0,
                        "image_only": 0,
                    }
                }
            },
            "message": f"Project uploaded successfully. ID: {project_id}",
            "error": None,
            "files": {
                "vykaz_vymer": vykaz_vymer_meta.model_dump() if vykaz_vymer_meta else None,
                "rozpocet": rozpocet_meta.model_dump() if rozpocet_meta else None,
                "vykresy": vykresy_names,
                "dokumentace": dokumentace_names,
                "zmeny": zmeny_names
            },
            "project_dir": str(project_dir),
            "files_metadata": safe_files,
            "file_locations": file_locations,
            "drawing_specs_detected": 0,
            "drawing_page_states": {
                "status": "pending",
                "good_text": 0,
                "encoded_text": 0,
                "image_only": 0,
            },
            "drawing_text_recovery": {
                "used_pdfium": 0,
                "used_poppler": 0,
                "ocr_pages": [],
            },
            "drawings_path": str(vykresy_dir) if workflow == 'B' else None,
            "workflow_selection": {
                "requested": requested_workflow,
                "selected": workflow,
                "status": selection_status,
            },
        }

        project_manifest = {
            "project_id": project_id,
            "project_name": project_name,
            "workflow": workflow,
            "requested_workflow": requested_workflow,
            "selected_workflow": workflow,
            "selection_status": selection_status,
            "uploaded_at": datetime.now().isoformat(),
            "files": safe_files,
        }
        try:
            with ArtifactPaths.project_info(project_id).open("w", encoding="utf-8") as fp:
                json.dump(project_manifest, fp, ensure_ascii=False, indent=2)
            with ArtifactPaths.project_json(project_id).open("w", encoding="utf-8") as fp:
                json.dump(project_manifest, fp, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Project %s: failed to persist project manifest: %s", project_id, exc)

        logger.info(f"✅ Nahrání dokončeno: {project_id}")

        # Start processing in background if requested
        if auto_start_audit:
            logger.info(
                f"🚀 Začínám zpracování projektu {project_id} "
                f"(Workflow {workflow}, Enrichment: {'ON' if enable_enrichment else 'OFF'})"
            )

            if workflow == 'A':
                workflow_service = WorkflowA()
                background_tasks.add_task(
                    workflow_service.execute,
                    project_id,
                    generate_summary,
                    enable_enrichment  # ✨ NEW: Pass enrichment flag
                )
            elif workflow == 'B':
                background_tasks.add_task(
                    run_workflow_b,
                    project_id,
                    str(vykresy_dir),
                    project_name
                )
        
        # ✅ Return project_id in response - using Pydantic model
        return ProjectResponse(
            success=True,
            project_id=project_id,
            project_name=project_name,
            name=project_name,  # Alternative field name
            workflow=workflow,
            status=normalize_status(ProjectStatus.UPLOADED),
            uploaded_at=datetime.now().isoformat(),
            created_at=datetime.now().isoformat(),
            progress=0,
            files_uploaded={
                "vykaz_vymer": vykaz_vymer_meta is not None,
                "vykresy": len(vykresy_files),
                "rozpocet": rozpocet_meta is not None,
                "dokumentace": len(dokumentace_files),
                "zmeny": len(zmeny_files)
            },
            enrichment_enabled=enable_enrichment,  # ✨ NEW
            files=safe_files,
            message=f"Project uploaded successfully. ID: {project_id}",
            positions_total=0,
            total_positions=0,
            positions_processed=0,
            green_count=0,
            amber_count=0,
            red_count=0
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.post("/api/upload-to-project", response_model=ProjectResponse)
async def upload_files_to_project(
    background_tasks: BackgroundTasks,
    project_id: str = Query(..., description="Existing project ID"),
    files: List[UploadFile] = File(..., description="Files to upload"),
) -> ProjectResponse:
    """
    Upload files to an existing project

    Use this endpoint to add files to a project created via POST /api/chat/projects.
    Files will be automatically categorized by extension:
    - .xlsx/.xls → vykaz_vymer
    - .pdf/.dwg/.png/.jpg → vykresy
    """
    try:
        # Check project exists
        if project_id not in project_store:
            raise HTTPException(404, f"Project {project_id} not found")

        project = project_store[project_id]
        workflow = project.get("workflow", "A")

        logger.info(f"📤 Uploading {len(files)} files to project {project_id}")

        # Create project directory
        project_dir = settings.DATA_DIR / "projects" / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        # Save files and categorize
        saved_files = {}
        vykaz_file = None
        drawing_files = []

        for file in files:
            if not file.filename:
                continue

            # Save file
            file_path = project_dir / file.filename
            content = await file.read()
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)

            logger.info(f"✅ Saved: {file.filename} ({len(content)} bytes)")

            # Categorize by extension
            ext = file.filename.lower().split('.')[-1]
            file_id = f"{project_id}:file:{file.filename}"

            saved_files[file_id] = {
                "file_id": file_id,
                "filename": file.filename,
                "file_type": "unknown",
                "size": len(content),
                "uploaded_at": get_utc_timestamp_iso()
            }

            if ext in ['xlsx', 'xls']:
                vykaz_file = file_path
                saved_files[file_id]["file_type"] = "vykaz_vymer"
            elif ext in ['pdf', 'dwg', 'png', 'jpg', 'jpeg']:
                drawing_files.append(file_path)
                saved_files[file_id]["file_type"] = "vykresy"

        # Update project with files
        project["files"] = saved_files
        project["status"] = ProjectStatus.PROCESSING
        project["message"] = f"Processing {len(files)} files..."
        project_store[project_id] = project

        # Start workflow processing in background
        if workflow == "A" and vykaz_file:
            background_tasks.add_task(
                _process_workflow_a,
                project_id,
                vykaz_file,
                drawing_files
            )
        elif workflow == "B" and drawing_files:
            background_tasks.add_task(
                _process_workflow_b,
                project_id,
                drawing_files
            )
        else:
            project["status"] = ProjectStatus.FAILED
            project["message"] = f"Workflow {workflow} requires specific files"
            project_store[project_id] = project

        return ProjectResponse(
            success=True,
            project_id=project_id,
            project_name=project["project_name"],
            workflow=workflow,
            status=ProjectStatus.PROCESSING,
            message=f"Uploaded {len(files)} files, processing started"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload to project error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.get("/api/projects/{project_id}/status", response_model=ProjectStatusResponse)
async def get_project_status(project_id: str):
    """Get project processing status"""

    if project_id not in project_store:
        raise HTTPException(404, f"Project {project_id} not found")

    project = project_store[project_id]

    return ProjectStatusResponse(
        project_id=project_id,
        project_name=project["project_name"],
        status=normalize_status(project["status"]),
        workflow=project["workflow"],
        created_at=project.get("created_at"),
        updated_at=project.get("updated_at"),
        uploaded_at=project.get("created_at"),
        processed_at=project.get("processed_at"),
        audit_completed_at=project.get("audit_completed_at"),
        progress=project.get("progress", 0),
        positions_total=project.get("positions_total", 0),
        positions_processed=project.get("positions_processed", 0),
        green_count=project.get("green_count", 0),
        amber_count=project.get("amber_count", 0),
        red_count=project.get("red_count", 0),
        message=project.get("message"),
        error_message=project.get("error"),
        enrichment_enabled=project.get("enable_enrichment")
    )


@router.get("/api/projects/{project_id}/results", response_model=WorkflowResultResponse)
async def get_project_results(project_id: str):
    """
    Get detailed project results including enriched positions

    ✨ NEW: Returns enriched positions with technical specifications
    """

    if project_id not in project_store:
        raise HTTPException(404, f"Project {project_id} not found")

    project = project_store[project_id]

    status = project["status"]

    summary_payload = project.get("summary")
    if not isinstance(summary_payload, dict):
        summary_payload = {
            "positions_total": project.get("positions_total", 0),
            "green": project.get("green_count", 0),
            "amber": project.get("amber_count", 0),
            "red": project.get("red_count", 0),
        }

    if status != ProjectStatus.COMPLETED:
        summary_payload.setdefault("message", "Project is still processing")
        return WorkflowResultResponse(
            project_id=project_id,
            project_name=project.get("project_name", ""),
            workflow=project.get("workflow", WorkflowType.A),
            status=normalize_status(status),
            enrichment_enabled=project.get("enable_enrichment", False),
            summary=summary_payload
        )

    audit_payload = project.get("audit_results", {})

    return WorkflowResultResponse(
        project_id=project_id,
        project_name=project["project_name"],
        workflow=project["workflow"],
        status=normalize_status(status),
        completed_at=project.get("completed_at"),
        enrichment_enabled=project.get("enable_enrichment", False),
        green_count=project.get("green_count", 0),
        amber_count=project.get("amber_count", 0),
        red_count=project.get("red_count", 0),
        audit_results=audit_payload,
        positions_preview=audit_payload.get("preview", []),
        summary=summary_payload,
        diagnostics=project.get("diagnostics", {})
    )


@router.get("/api/projects", response_model=ProjectListResponse)
async def list_projects(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0)
):
    """List all projects with pagination"""

    all_projects = list(project_store.values())
    total = len(all_projects)

    # Sort by created_at desc
    all_projects.sort(key=lambda x: x['created_at'], reverse=True)

    # Paginate
    projects = all_projects[offset:offset + limit]

    return ProjectListResponse(
        projects=[
            ProjectSummary(
                project_id=p["project_id"],
                project_name=p["project_name"],
                workflow=p["workflow"],
                status=normalize_status(p["status"]),
                enrichment_enabled=p.get("enable_enrichment", False),
                created_at=p["created_at"],
                positions_count=p.get("positions_total", 0)
            )
            for p in projects
        ],
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/api/projects/{project_id}/files", response_model=ProjectFilesResponse)
async def list_project_files(project_id: str):
    """List uploaded files with safe metadata"""

    if project_id not in project_store:
        raise HTTPException(404, f"Project {project_id} not found")

    project = project_store[project_id]
    files_metadata = project.get("files_metadata", [])

    return ProjectFilesResponse(
        project_id=project_id,
        project_name=project.get("project_name"),
        total_files=len(files_metadata),
        files=files_metadata
    )


@router.get("/api/projects/{project_id}/files/{file_id}/download")
async def download_project_file(project_id: str, file_id: str):
    """Securely download a project file using logical identifiers"""

    if project_id not in project_store:
        raise HTTPException(404, f"Project {project_id} not found")

    project = project_store[project_id]

    # Validate file_id format: project_id:file_type:filename
    try:
        file_project_id, file_type, filename = file_id.split(":", 2)
    except ValueError:
        raise HTTPException(400, "Invalid file_id format")

    if not file_project_id or not file_type or not filename:
        raise HTTPException(400, "Invalid file_id format")

    if file_project_id != project_id:
        raise HTTPException(403, "File does not belong to this project")

    safe_filename = Path(filename).name
    if safe_filename != filename:
        raise HTTPException(400, "Invalid filename")

    file_locations = project.get("file_locations", {})
    file_path_str = file_locations.get(file_id)
    if not file_path_str:
        raise HTTPException(404, "File not found")

    file_path = Path(file_path_str)
    project_dir = Path(project["project_dir"]).resolve()

    try:
        resolved_file = file_path.resolve(strict=True)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")

    # Ensure file is inside project directory to prevent traversal
    if not str(resolved_file).startswith(str(project_dir)):
        raise HTTPException(403, "Access denied")

    media_type, _ = mimetypes.guess_type(str(resolved_file))

    return FileResponse(
        path=resolved_file,
        filename=safe_filename,
        media_type=media_type or "application/octet-stream"
    )


@router.get("/api/projects/{project_id}/export/excel")
async def export_to_excel(project_id: str):
    """
    Export project results to Excel
    
    ✨ NEW: Includes enriched technical specifications in export
    """
    
    if project_id not in project_store:
        raise HTTPException(404, f"Project {project_id} not found")
    
    project = project_store[project_id]
    
    audit_results = project.get("audit_results") or {}
    meta = audit_results.get("meta", {}) if isinstance(audit_results, dict) else {}
    audit_block = meta.get("audit") if isinstance(meta, dict) else None
    if not audit_block:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "audit_not_ready",
                "hint": "Run enrichment+validation+audit (Steps 3–6) before export.",
            },
        )
    
    # Generate Excel file
    try:
        from app.utils.excel_exporter import export_enriched_results
        
        excel_path = await export_enriched_results(project)
        
        return FileResponse(
            path=excel_path,
            filename=f"{project['project_name']}_audit_results.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        
    except Exception as e:
        logger.error(f"Export failed: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Export failed: {str(e)}")


@router.get("/api/health")
async def health_check():
    """
    Detailed health check with system status
    """
    return {
        "status": normalize_status("healthy"),
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "features": {
            "workflow_a": settings.ENABLE_WORKFLOW_A,
            "workflow_b": settings.ENABLE_WORKFLOW_B,
            "drawing_enrichment": True,
            "csn_validation": True
        },
        "stats": {
            "total_projects": len(project_store),
            "uploaded": sum(1 for p in project_store.values() if p["status"] == ProjectStatus.UPLOADED),
            "processing": sum(1 for p in project_store.values() if p["status"] == ProjectStatus.PROCESSING),
            "completed": sum(1 for p in project_store.values() if p["status"] == ProjectStatus.COMPLETED),
            "failed": sum(1 for p in project_store.values() if p["status"] == ProjectStatus.FAILED)
        }
    }
