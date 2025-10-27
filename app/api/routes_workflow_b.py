"""Workflow B artifact endpoints with unified body-based API."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import ArtifactPaths
from app.models.project import APIResponse
from app.state.project_store import project_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workflow/b", tags=["Workflow B"])


# ============================================================================
# REQUEST MODELS (Body-based)
# ============================================================================


class TechCardRequest(BaseModel):
    """Request for tech card generation."""
    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    action: str = Field(default="tech_card", description="Action type")


class ResourceSheetRequest(BaseModel):
    """Request for resource sheet generation."""
    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    action: str = Field(default="resource_sheet", description="Action type")


class PositionsRequest(BaseModel):
    """Request for listing positions."""
    project_id: str = Field(..., description="Project ID")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def _validate_project_exists(project_id: str) -> Dict[str, Any]:
    """Validate project exists in store."""
    if project_id not in project_store:
        logger.warning(f"Project {project_id} not found in store")
        raise HTTPException(404, f"Project {project_id} not found")
    
    project = project_store[project_id]
    logger.info(f"✅ Project {project_id} validated: {project.get('project_name')}")
    return project


def _load_json(path: Path) -> Optional[Any]:
    """Load JSON file safely."""
    if not path.exists():
        logger.debug(f"File not found: {path}")
        return None
    try:
        with path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
            logger.debug(f"✅ Loaded JSON: {path}")
            return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(f"Failed to read {path}: {exc}")
        return None


def _dump_json(path: Path, payload: Any) -> None:
    """Save JSON file safely."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)
        logger.info(f"💾 Saved JSON: {path}")
    except OSError as exc:
        logger.error(f"Failed to save {path}: {exc}")
        raise HTTPException(500, f"Failed to save artifact: {exc}")


def _load_generated_positions(project_id: str) -> Optional[list[Dict[str, Any]]]:
    """Load generated positions from project."""
    payload = _load_json(ArtifactPaths.generated_positions(project_id))
    if payload is None:
        return None
    
    if isinstance(payload, dict):
        candidates = payload.get("items") or payload.get("positions")
        if isinstance(candidates, list):
            return [item for item in candidates if isinstance(item, dict)]
    
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    
    return None


def _extract_generated_position(project_id: str, position_id: str) -> Optional[Dict[str, Any]]:
    """Extract position from generated list."""
    positions = _load_generated_positions(project_id) or []
    
    for item in positions:
        identifiers = (
            item.get("id"),
            item.get("position_id"),
            item.get("code"),
            item.get("position"),
        )
        if any(str(identifier) == position_id for identifier in identifiers if identifier is not None):
            logger.info(f"✅ Found generated position {position_id}")
            return item
    
    logger.warning(f"Position {position_id} not found in generated positions")
    return None


# ============================================================================
# ARTIFACT GENERATION
# ============================================================================


def _generate_tech_card_artifact(position: Dict[str, Any], position_id: str) -> Dict[str, Any]:
    """Generate tech card from generated position."""
    
    artifact = {
        "type": "tech_card",
        "position_id": position_id,
        "title": f"Technologická karta - {position.get('code', position_id)}",
        "data": {
            "position_id": position_id,
            "code": position.get("code"),
            "description": position.get("description") or position.get("name"),
            "unit": position.get("unit"),
            "quantity": position.get("quantity"),
            "source": "workflow_b_generated",
            "materials": position.get("materials", []),
            "workflow_notes": position.get("generation_notes", []),
        },
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "workflow_b_generation",
        }
    }
    
    logger.info(f"✅ Generated tech card for {position_id}")
    return artifact


def _generate_resource_sheet_artifact(position: Dict[str, Any], position_id: str) -> Dict[str, Any]:
    """Generate resource sheet from generated position."""
    
    resources = position.get("resources") or position.get("materials") or []
    
    artifact = {
        "type": "resource_sheet",
        "position_id": position_id,
        "title": f"Zdroje - {position.get('code', position_id)}",
        "data": {
            "position_id": position_id,
            "code": position.get("code"),
            "description": position.get("description") or position.get("name"),
            "quantity": position.get("quantity"),
            "unit": position.get("unit"),
            "resources": resources,
            "workflow_notes": position.get("generation_notes", []),
        },
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "workflow_b_generation",
        }
    }
    
    logger.info(f"✅ Generated resource sheet for {position_id}")
    return artifact


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.get("/positions", response_model=APIResponse)
async def list_generated_positions(project_id: str) -> APIResponse:
    """
    List all generated positions for Workflow B project.
    
    **Query Parameter:**
    - `project_id`: Project identifier
    """
    logger.info(f"📋 Listing generated positions for {project_id}")
    
    project = _validate_project_exists(project_id)
    positions = _load_generated_positions(project_id)
    
    if positions is None:
        logger.warning(f"Generated positions not available for {project_id}")
        return APIResponse(
            status="pending",
            data=None,
            warning="Generated positions not yet available - generation may still be in progress",
            meta={
                "project_id": project_id,
                "project_name": project.get("project_name"),
                "status": project.get("status"),
            },
        )

    logger.info(f"✅ Returned {len(positions)} generated positions for {project_id}")
    return APIResponse(
        status="success",
        data={"items": positions, "count": len(positions)},
        meta={
            "project_id": project_id,
            "project_name": project.get("project_name"),
            "count": len(positions),
        },
    )


@router.post("/tech-card", response_model=APIResponse)
async def generate_tech_card(request: TechCardRequest) -> APIResponse:
    """
    Generate or fetch tech card for a generated position.
    
    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_b001"
    }
    ```
    """
    logger.info(f"🛠️ Generating tech card for {request.project_id}:{request.position_id}")
    
    project = _validate_project_exists(request.project_id)
    artifact_path = ArtifactPaths.tech_card(request.project_id, request.position_id)
    
    # Check cache
    cached = _load_json(artifact_path)
    if cached is not None:
        logger.info(f"✅ Tech card from cache: {request.position_id}")
        return APIResponse(
            status="success",
            data={"artifact": cached},
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
                "source": "cache",
            },
        )

    # Extract generated position
    position = _extract_generated_position(request.project_id, request.position_id)
    if position is None:
        logger.warning(f"Generated position {request.position_id} not found")
        return APIResponse(
            status="pending",
            data=None,
            warning="Generated positions not yet available",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    # Generate artifact
    artifact = _generate_tech_card_artifact(position, request.position_id)
    _dump_json(artifact_path, artifact)

    logger.info(f"✅ Tech card generated and cached: {request.position_id}")
    return APIResponse(
        status="success",
        data={"artifact": artifact},
        meta={
            "project_id": request.project_id,
            "position_id": request.position_id,
            "source": "generated",
        },
    )


@router.post("/resource-sheet", response_model=APIResponse)
async def generate_resource_sheet(request: ResourceSheetRequest) -> APIResponse:
    """
    Generate or fetch resource sheet for a generated position.
    
    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_b001"
    }
    ```
    """
    logger.info(f"⚙️ Generating resource sheet for {request.project_id}:{request.position_id}")
    
    project = _validate_project_exists(request.project_id)
    artifact_path = ArtifactPaths.resource_sheet(request.project_id, request.position_id)
    
    # Check cache
    cached = _load_json(artifact_path)
    if cached is not None:
        logger.info(f"✅ Resource sheet from cache: {request.position_id}")
        return APIResponse(
            status="success",
            data={"artifact": cached},
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
                "source": "cache",
            },
        )

    # Extract generated position
    position = _extract_generated_position(request.project_id, request.position_id)
    if position is None:
        logger.warning(f"Generated position {request.position_id} not found")
        return APIResponse(
            status="pending",
            data=None,
            warning="Generated positions not yet available",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    # Generate artifact
    artifact = _generate_resource_sheet_artifact(position, request.position_id)
    _dump_json(artifact_path, artifact)

    logger.info(f"✅ Resource sheet generated and cached: {request.position_id}")
    return APIResponse(
        status="success",
        data={"artifact": artifact},
        meta={
            "project_id": request.project_id,
            "position_id": request.position_id,
            "source": "generated",
        },
    )
