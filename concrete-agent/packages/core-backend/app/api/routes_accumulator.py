"""
Document Accumulator API Routes

Endpoints for managing project documents with background processing:
- Add files and folders
- Track processing progress
- Generate summaries from accumulated data

Version: 1.0.0
Date: 2025-12-28
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import asyncio
import json
import logging
import tempfile
import os
from pathlib import Path

from app.services.document_accumulator import (
    get_accumulator,
    initialize_accumulator,
    DocumentAccumulator,
    FileStatus,
    TaskStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/accumulator",
    tags=["Document Accumulator"],
)


# ==================== Request/Response Models ====================

class AddFolderRequest(BaseModel):
    """Request to add a folder to a project."""
    project_id: str = Field(..., description="Project ID")
    folder_path: str = Field(..., description="Path to folder")
    folder_type: str = Field(default="local", description="Folder type: local, google_drive, sharepoint")


class AddFileRequest(BaseModel):
    """Request to add a file to a project."""
    project_id: str = Field(..., description="Project ID")
    file_path: str = Field(..., description="Path to file")


class GenerateSummaryRequest(BaseModel):
    """Request to generate summary."""
    project_id: str = Field(..., description="Project ID")
    language: str = Field(default="cs", description="Output language: cs, en, sk")


class TaskResponse(BaseModel):
    """Response with task information."""
    task_id: str
    task_type: str
    status: str
    progress: float
    message: str


class ProjectStatusResponse(BaseModel):
    """Response with project status."""
    project_id: str
    files: Dict[str, int]
    folders: Dict[str, int]
    cache: Optional[Dict[str, Any]]
    active_tasks: List[Dict[str, Any]]
    has_pending_work: bool


# ==================== Startup/Shutdown ====================

_accumulator_started = False


async def ensure_accumulator_started():
    """Ensure the accumulator is started."""
    global _accumulator_started
    if not _accumulator_started:
        accumulator = get_accumulator()
        await accumulator.start()
        _accumulator_started = True
        logger.info("Document Accumulator started via API")


# ==================== Endpoints ====================

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "document_accumulator", "version": "1.0.0"}


@router.post("/folders", response_model=TaskResponse)
async def add_folder(request: AddFolderRequest):
    """
    Add a folder to the project.

    The folder will be scanned in the background.
    Returns a task ID to track progress.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    try:
        folder = await accumulator.add_folder(
            project_id=request.project_id,
            folder_path=request.folder_path,
            folder_type=request.folder_type,
        )

        # Get the scan task
        tasks = accumulator.get_project_tasks(request.project_id)
        scan_task = next(
            (t for t in tasks if t.task_type == 'scan_folder' and t.status == TaskStatus.QUEUED),
            None
        )

        return TaskResponse(
            task_id=scan_task.task_id if scan_task else folder.folder_id,
            task_type="scan_folder",
            status="queued",
            progress=0.0,
            message=f"Folder added: {folder.folder_path}",
        )

    except Exception as e:
        logger.error(f"Failed to add folder: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/files/upload")
async def upload_file(
    project_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Upload a file to the project.

    The file will be saved and queued for parsing.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    try:
        # Save uploaded file to temp location
        temp_dir = Path(tempfile.gettempdir()) / "stavagent" / project_id
        temp_dir.mkdir(parents=True, exist_ok=True)

        file_path = temp_dir / file.filename
        content = await file.read()

        project_file = await accumulator.add_file(
            project_id=project_id,
            file_path=str(file_path),
            content=content,
        )

        return {
            "success": True,
            "file_id": project_file.file_id,
            "file_name": project_file.file_name,
            "file_size": project_file.file_size,
            "status": project_file.status.value,
            "content_hash": project_file.content_hash,
        }

    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/files", response_model=Dict[str, Any])
async def add_file(request: AddFileRequest):
    """
    Add an existing file to the project by path.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    try:
        project_file = await accumulator.add_file(
            project_id=request.project_id,
            file_path=request.file_path,
        )

        return project_file.to_dict()

    except Exception as e:
        logger.error(f"Failed to add file: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/parse-all", response_model=TaskResponse)
async def parse_all_files(project_id: str):
    """
    Parse all pending files in the project.

    Returns a task ID to track progress.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    try:
        task = await accumulator.queue_parse_all(project_id)

        return TaskResponse(
            task_id=task.task_id,
            task_type=task.task_type,
            status=task.status.value,
            progress=task.progress,
            message=task.message,
        )

    except Exception as e:
        logger.error(f"Failed to queue parse: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate-summary", response_model=TaskResponse)
async def generate_summary(request: GenerateSummaryRequest):
    """
    Generate summary from accumulated project data.

    Returns a task ID to track progress.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    try:
        task = await accumulator.queue_generate_summary(
            project_id=request.project_id,
            language=request.language,
        )

        return TaskResponse(
            task_id=task.task_id,
            task_type=task.task_type,
            status=task.status.value,
            progress=task.progress,
            message=task.message,
        )

    except Exception as e:
        logger.error(f"Failed to queue summary: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a background task."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    task = accumulator.get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task.to_dict()


@router.get("/projects/{project_id}/status", response_model=ProjectStatusResponse)
async def get_project_status(project_id: str):
    """Get overall status of a project."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    status = accumulator.get_project_summary(project_id)
    return status


@router.get("/projects/{project_id}/files")
async def get_project_files(project_id: str):
    """Get all files in a project."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    files = accumulator.get_project_files(project_id)
    return {
        "project_id": project_id,
        "files": [f.to_dict() for f in files],
        "total": len(files),
    }


@router.get("/projects/{project_id}/folders")
async def get_project_folders(project_id: str):
    """Get all folders in a project."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    folders = accumulator.get_project_folders(project_id)
    return {
        "project_id": project_id,
        "folders": [f.to_dict() for f in folders],
        "total": len(folders),
    }


@router.get("/projects/{project_id}/cache")
async def get_project_cache(project_id: str):
    """Get project cache with aggregated data."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    cache = accumulator.get_project_cache(project_id)
    if not cache:
        return {
            "project_id": project_id,
            "cache": None,
            "message": "No cache available",
        }

    return {
        "project_id": project_id,
        "cache": cache.to_dict(),
    }


@router.get("/projects/{project_id}/summary")
async def get_project_summary(project_id: str):
    """Get latest generated summary for a project."""
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    cache = accumulator.get_project_cache(project_id)
    if not cache or not cache.last_summary:
        raise HTTPException(
            status_code=404,
            detail="No summary available. Generate one first."
        )

    return {
        "project_id": project_id,
        "summary": cache.last_summary,
        "generated_at": cache.summary_generated_at.isoformat() if cache.summary_generated_at else None,
        "positions_count": len(cache.aggregated_positions),
        "files_count": len(cache.file_versions),
        "cache_valid": cache.cache_valid,
    }


# ==================== WebSocket for Real-time Updates ====================

class ConnectionManager:
    """Manage WebSocket connections per project."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        logger.info(f"WebSocket connected for project {project_id}")

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            logger.info(f"WebSocket disconnected for project {project_id}")

    async def broadcast(self, project_id: str, message: Dict[str, Any]):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WebSocket message: {e}")


manager = ConnectionManager()


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint for real-time project updates.

    Receives events:
    - task_started: A task has started
    - task_progress: Task progress update
    - task_completed: Task completed (success or failure)
    """
    await ensure_accumulator_started()
    await manager.connect(websocket, project_id)

    accumulator = get_accumulator()

    # Subscribe to accumulator events
    async def on_event(event_type: str, data: Dict[str, Any]):
        await manager.broadcast(project_id, {
            "event": event_type,
            "data": data,
            "project_id": project_id,
        })

    accumulator.subscribe(project_id, on_event)

    try:
        # Send initial status
        status = accumulator.get_project_summary(project_id)
        await websocket.send_json({
            "event": "connected",
            "data": status,
            "project_id": project_id,
        })

        # Keep connection alive
        while True:
            try:
                # Wait for client messages (ping/pong or commands)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )

                # Handle commands from client
                try:
                    command = json.loads(data)
                    if command.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif command.get("type") == "get_status":
                        status = accumulator.get_project_summary(project_id)
                        await websocket.send_json({
                            "event": "status",
                            "data": status,
                        })
                except json.JSONDecodeError:
                    pass

            except asyncio.TimeoutError:
                # Send periodic status update
                status = accumulator.get_project_summary(project_id)
                await websocket.send_json({
                    "event": "heartbeat",
                    "data": {"has_pending_work": status["has_pending_work"]},
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        accumulator.unsubscribe(project_id, on_event)

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, project_id)
        accumulator.unsubscribe(project_id, on_event)


# ==================== Quick Actions ====================

@router.post("/projects/{project_id}/sync-and-parse")
async def sync_and_parse(project_id: str):
    """
    Convenience endpoint: Sync all folders and parse all files.

    Returns task IDs for tracking.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    tasks = []

    # Re-scan all folders
    folders = accumulator.get_project_folders(project_id)
    for folder in folders:
        task = await accumulator.queue_scan_folder(project_id, folder.folder_id)
        tasks.append(task.to_dict())

    # Queue parse all (will run after scans complete)
    parse_task = await accumulator.queue_parse_all(project_id)
    tasks.append(parse_task.to_dict())

    return {
        "project_id": project_id,
        "tasks": tasks,
        "message": f"Queued {len(tasks)} tasks",
    }


@router.post("/projects/{project_id}/full-pipeline")
async def full_pipeline(
    project_id: str,
    language: str = "cs",
):
    """
    Execute full pipeline: Sync → Parse → Generate Summary.

    Returns task IDs for tracking all stages.
    """
    await ensure_accumulator_started()
    accumulator = get_accumulator()

    tasks = []

    # Re-scan all folders
    folders = accumulator.get_project_folders(project_id)
    for folder in folders:
        task = await accumulator.queue_scan_folder(project_id, folder.folder_id)
        tasks.append({"stage": "scan", **task.to_dict()})

    # Queue parse all
    parse_task = await accumulator.queue_parse_all(project_id)
    tasks.append({"stage": "parse", **parse_task.to_dict()})

    # Queue summary generation
    summary_task = await accumulator.queue_generate_summary(project_id, language)
    tasks.append({"stage": "summary", **summary_task.to_dict()})

    return {
        "project_id": project_id,
        "tasks": tasks,
        "message": f"Full pipeline started with {len(tasks)} tasks",
        "stages": ["scan", "parse", "summary"],
    }
