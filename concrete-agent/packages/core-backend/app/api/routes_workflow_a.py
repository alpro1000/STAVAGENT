"""Workflow A artifact endpoints with unified body-based API."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import ArtifactPaths, settings
from app.models.project import APIResponse
from app.services.workflow_a import workflow_a  # re-exported for legacy integrations
from app.state.project_store import project_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/workflow/a", tags=["Workflow A"])
legacy_router = APIRouter(prefix="/api/workflow-a", tags=["Workflow A Legacy"])


# ============================================================================
# REQUEST MODELS (Body-based)
# ============================================================================


class WorkflowATechCardRequest(BaseModel):
    """Request for tech card generation (Workflow A)."""
    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    action: str = Field(default="tech_card", description="Action type")


class WorkflowAResourceSheetRequest(BaseModel):
    """Request for resource sheet (TOV) generation (Workflow A)."""
    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    action: str = Field(default="resource_sheet", description="Action type")


class WorkflowAMaterialsRequest(BaseModel):
    """Request for materials specification (Workflow A)."""
    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    action: str = Field(default="materials", description="Action type")


class WorkflowAEnrichPositionRequest(BaseModel):
    """Request for enrichment of a position (Workflow A)."""

    project_id: str = Field(..., description="Project ID")
    position_id: str = Field(..., description="Position ID")
    include_claude_analysis: bool = Field(
        default=False,
        description="Enable Claude analysis",
    )


class WorkflowAPositionsRequest(BaseModel):
    """Request for listing positions (Workflow A)."""
    project_id: str = Field(..., description="Project ID")


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def _validate_project_exists(project_id: str) -> Dict[str, Any]:
    """Validate project exists in store."""
    if project_id not in project_store:
        logger.warning("Project %s not found in store", project_id)
        raise HTTPException(404, f"Project {project_id} not found")

    project = project_store[project_id]
    logger.info("✅ Project %s validated: %s", project_id, project.get("project_name"))
    return project


def _load_json(path: Path) -> Optional[Any]:
    """Load JSON file safely."""
    if not path.exists():
        logger.debug("File not found: %s", path)
        return None
    try:
        with path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
            logger.debug("✅ Loaded JSON: %s", path)
            return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to read %s: %s", path, exc)
        return None


def _dump_json(path: Path, payload: Any) -> None:
    """Save JSON file safely."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)
        logger.info("💾 Saved JSON: %s", path)
    except OSError as exc:
        logger.error("Failed to save %s: %s", path, exc)
        raise HTTPException(500, f"Failed to save artifact: {exc}")


def _extract_position(payload: Any, position_id: str) -> Optional[Dict[str, Any]]:
    """Extract position from audit results by ID."""
    items: list[Dict[str, Any]] = []

    if isinstance(payload, dict):
        candidates = payload.get("items") or payload.get("positions")
        if isinstance(candidates, list):
            items = [item for item in candidates if isinstance(item, dict)]
    elif isinstance(payload, list):
        items = [item for item in payload if isinstance(item, dict)]

    for item in items:
        identifiers = (
            item.get("id"),
            item.get("position_id"),
            item.get("code"),
            item.get("position"),
        )
        if any(str(identifier) == position_id for identifier in identifiers if identifier is not None):
            logger.info("✅ Found position %s: %s", position_id, item.get("description"))
            return item

    logger.warning("Position %s not found in payload", position_id)
    return None


def _iter_positions(payload: Any) -> list[Dict[str, Any]]:
    if isinstance(payload, dict):
        candidates = payload.get("items") or payload.get("positions") or []
        return [item for item in candidates if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def _first_position_id(payload: Any) -> Optional[str]:
    for item in _iter_positions(payload):
        for key in ("id", "position_id", "code", "position"):
            value = item.get(key)
            if value:
                return str(value)
    return None


def _get_audit_payload(project_id: str) -> Optional[Any]:
    project = project_store.get(project_id)
    if project is not None:
        audit_results = project.get("audit_results")
        if audit_results:
            return audit_results
    return _load_json(ArtifactPaths.audit_results(project_id))


def _legacy_artifact_filename(kind: str) -> str:
    mapping = {
        "tech_card": "tech_card.json",
        "resource_sheet": "resource_sheet.json",
        "material_analysis": "material_analysis.json",
    }
    filename = mapping.get(kind)
    if filename is None:
        raise ValueError(f"Unknown artifact kind: {kind}")
    return filename


def _legacy_artifact_path(project_id: str, filename: str) -> Path:
    curated_dir = settings.DATA_DIR / "curated" / project_id
    curated_dir.mkdir(parents=True, exist_ok=True)
    return curated_dir / filename


def _write_legacy_artifact(project_id: str, kind: str, payload: Any) -> Optional[Path]:
    filename = _legacy_artifact_filename(kind)
    path = _legacy_artifact_path(project_id, filename)
    try:
        with path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)
        logger.debug("💾 Legacy artifact saved: %s", path)
        return path
    except OSError as exc:
        logger.warning("Failed to write legacy artifact %s: %s", path, exc)
        return None


def _record_project_artifact(
    project_id: str,
    artifact_key: str,
    position_id: str,
    artifact_path: Path,
    legacy_path: Optional[Path],
    artifact_type: str,
    source: str,
) -> None:
    project = project_store.get(project_id)
    if project is None:
        return

    artifacts = project.setdefault("artifacts", {})
    artifacts[artifact_key] = {
        "position_id": position_id,
        "path": str(artifact_path),
        "legacy_path": str(legacy_path) if legacy_path else None,
        "type": artifact_type,
        "source": source,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _default_position_id(project_id: str) -> Optional[str]:
    project = project_store.get(project_id, {})
    for candidate in (
        project.get("audit_results"),
        _get_audit_payload(project_id),
        _load_json(ArtifactPaths.parsed_positions(project_id)),
    ):
        if candidate is None:
            continue
        position_id = _first_position_id(candidate)
        if position_id:
            return position_id
    return None


# ============================================================================
# ARTIFACT GENERATION
# ============================================================================


def _generate_tech_card_artifact(position: Dict[str, Any], position_id: str) -> Dict[str, Any]:
    """Generate tech card from position data."""

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
            "classification": position.get("classification"),
            "audit_status": position.get("audit", {}).get("status"),
            "steps": [
                {
                    "step_num": 1,
                    "title": "Příprava",
                    "description": "Příprava podkladu",
                    "duration_minutes": 45,
                    "workers": 2,
                }
            ],
            "norms": position.get("applicable_norms", []),
            "materials": position.get("materials", []),
            "safety_requirements": position.get("safety_requirements", []),
        },
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "workflow_a_audit",
        },
    }

    logger.info("✅ Generated tech card for %s", position_id)
    return artifact


def _generate_resource_sheet_artifact(position: Dict[str, Any], position_id: str) -> Dict[str, Any]:
    """Generate resource sheet (TOV) from position data."""

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
            "labor": {
                "total_hours": position.get("labor_hours", 0),
                "trades": position.get("trades", []),
            },
            "equipment": {
                "items": position.get("equipment", []),
            },
            "materials": resources,
            "cost_estimate": position.get("cost_estimate", 0),
        },
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "workflow_a_audit",
        },
    }

    logger.info("✅ Generated resource sheet for %s", position_id)
    return artifact


def _generate_materials_artifact(position: Dict[str, Any], position_id: str) -> Dict[str, Any]:
    """Generate materials specification from position data."""

    materials = position.get("materials") or position.get("resources") or []

    artifact = {
        "type": "materials_detailed",
        "position_id": position_id,
        "title": f"Materiály - {position.get('code', position_id)}",
        "data": {
            "position_id": position_id,
            "code": position.get("code"),
            "description": position.get("description") or position.get("name"),
            "materials": materials,
            "total_items": len(materials),
            "material_types": list({m.get("type") for m in materials if m.get("type")}),
        },
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "workflow_a_audit",
        },
    }

    logger.info("✅ Generated materials artifact for %s", position_id)
    return artifact


def _prepare_workflow_a_artifact(
    project_id: str,
    position_id: str,
    generator: Any,
    artifact_path: Path,
    artifact_key: str,
) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    cached = _load_json(artifact_path)
    source = "cache"

    if cached is not None:
        artifact = cached
    else:
        audit_payload = _get_audit_payload(project_id)
        if audit_payload is None:
            logger.warning("Audit results not ready for %s", project_id)
            return None, None

        position = _extract_position(audit_payload, position_id)
        if position is None:
            logger.error("Position %s not found in audit results", position_id)
            raise HTTPException(
                status_code=404,
                detail=f"Position {position_id} not found in audit results",
            )

        artifact = generator(position, position_id)
        _dump_json(artifact_path, artifact)
        source = "generated"

    legacy_path = _write_legacy_artifact(project_id, artifact_key, artifact)
    _record_project_artifact(
        project_id,
        artifact_key,
        position_id,
        artifact_path,
        legacy_path,
        artifact.get("type", artifact_key) if isinstance(artifact, dict) else artifact_key,
        source,
    )

    return artifact, source


# ============================================================================
# ENDPOINTS
# ============================================================================


@router.get("/positions", response_model=APIResponse)
async def list_positions(project_id: str) -> APIResponse:
    """
    List all parsed positions for project.

    **Query Parameter:**
    - `project_id`: Project identifier
    """
    logger.info("📋 Listing positions for project %s", project_id)

    project = _validate_project_exists(project_id)
    positions_path = ArtifactPaths.parsed_positions(project_id)
    payload = _load_json(positions_path)

    if payload is None:
        logger.warning("Project %s: positions not yet parsed", project_id)
        return APIResponse(
            status="pending",
            data=None,
            warning="Positions not yet parsed - processing may still be in progress",
            meta={
                "project_id": project_id,
                "project_name": project.get("project_name"),
                "status": project.get("status"),
            },
        )

    positions = _iter_positions(payload)

    logger.info("✅ Returned %d positions for %s", len(positions), project_id)
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
async def generate_tech_card(request: WorkflowATechCardRequest) -> APIResponse:
    """
    Generate or fetch tech card artifact for a position.

    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_001"
    }
    ```

    **Response:**
    Returns cached artifact if available, otherwise generates from audit results.
    """
    logger.info("🛠️ Generating tech card for %s:%s", request.project_id, request.position_id)

    project = _validate_project_exists(request.project_id)
    artifact_path = ArtifactPaths.tech_card(request.project_id, request.position_id)

    artifact, source = _prepare_workflow_a_artifact(
        request.project_id,
        request.position_id,
        _generate_tech_card_artifact,
        artifact_path,
        "tech_card",
    )

    if artifact is None:
        return APIResponse(
            status="pending",
            data=None,
            warning="Audit results not yet available",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    logger.info("✅ Tech card %s served via %s", request.position_id, source)
    return APIResponse(
        status="success",
        data={"artifact": artifact},
        meta={
            "project_id": request.project_id,
            "project_name": project.get("project_name"),
            "position_id": request.position_id,
            "source": source,
        },
    )


@router.post("/resource-sheet", response_model=APIResponse)
async def generate_resource_sheet(request: WorkflowAResourceSheetRequest) -> APIResponse:
    """
    Generate or fetch resource sheet (TOV) artifact for a position.

    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_001"
    }
    ```
    """
    logger.info("⚙️ Generating resource sheet for %s:%s", request.project_id, request.position_id)

    project = _validate_project_exists(request.project_id)
    artifact_path = ArtifactPaths.resource_sheet(request.project_id, request.position_id)

    artifact, source = _prepare_workflow_a_artifact(
        request.project_id,
        request.position_id,
        _generate_resource_sheet_artifact,
        artifact_path,
        "resource_sheet",
    )

    if artifact is None:
        return APIResponse(
            status="pending",
            data=None,
            warning="Audit results not yet available",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    logger.info("✅ Resource sheet %s served via %s", request.position_id, source)
    return APIResponse(
        status="success",
        data={"artifact": artifact},
        meta={
            "project_id": request.project_id,
            "project_name": project.get("project_name"),
            "position_id": request.position_id,
            "source": source,
        },
    )


@router.post("/materials", response_model=APIResponse)
async def generate_materials(request: WorkflowAMaterialsRequest) -> APIResponse:
    """
    Generate or fetch materials specification for a position.

    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_001"
    }
    ```
    """
    logger.info("🧱 Generating materials for %s:%s", request.project_id, request.position_id)

    project = _validate_project_exists(request.project_id)
    artifact_path = ArtifactPaths.materials(request.project_id, request.position_id)

    artifact, source = _prepare_workflow_a_artifact(
        request.project_id,
        request.position_id,
        _generate_materials_artifact,
        artifact_path,
        "material_analysis",
    )

    if artifact is None:
        return APIResponse(
            status="pending",
            data=None,
            warning="Audit results not yet available",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    logger.info("✅ Materials %s served via %s", request.position_id, source)
    return APIResponse(
        status="success",
        data={"artifact": artifact},
        meta={
            "project_id": request.project_id,
            "project_name": project.get("project_name"),
            "position_id": request.position_id,
            "source": source,
        },
    )


@router.post("/enrich", response_model=APIResponse)
async def enrich_position(request: WorkflowAEnrichPositionRequest) -> APIResponse:
    """
    Enrich a position with full technical information.

    Обогащение добавляет:
    - ✅ Материалы и характеристики
    - ✅ Применимые нормы (ČSN, TKP)
    - ✅ Поставщиков и ориентировочные цены
    - ✅ Трудозатраты (labor hours, workers)
    - ✅ Необходимое оборудование
    - ✅ Claude анализ (опционально)

    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_001",
        "include_claude_analysis": true
    }
    ```
    """

    logger.info("🧬 Enrich request: %s:%s", request.project_id, request.position_id)

    project = _validate_project_exists(request.project_id)

    audit_payload = _load_json(ArtifactPaths.audit_results(request.project_id))
    if audit_payload is None:
        return APIResponse(
            status="pending",
            data=None,
            warning="Audit results not ready",
            meta={
                "project_id": request.project_id,
                "position_id": request.position_id,
            },
        )

    position = _extract_position(audit_payload, request.position_id)
    if position is None:
        raise HTTPException(404, f"Position {request.position_id} not found")

    try:
        from app.services.enrichment_service import PositionEnricher

        enricher = PositionEnricher()
        enriched = await enricher.enrich_position(
            position,
            request.project_id,
            enable_claude=request.include_claude_analysis,
        )

        enriched_path = ArtifactPaths.enriched_position(
            request.project_id,
            request.position_id,
        )
        _dump_json(enriched_path, enriched)

        logger.info("✅ Position enriched: %s", request.position_id)

        return APIResponse(
            status="success",
            data={"enriched_position": enriched},
            meta={
                "project_id": request.project_id,
                "project_name": project.get("project_name"),
                "position_id": request.position_id,
                "confidence": enriched.get("enrichment", {}).get("confidence"),
                "warnings": enriched.get("enrichment", {}).get("warnings"),
            },
        )

    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Enrichment failed: %s", exc, exc_info=True)
        raise HTTPException(500, f"Enrichment failed: {str(exc)}")


# ============================================================================
# LEGACY COMPATIBILITY ENDPOINTS
# ============================================================================


@legacy_router.get("/{project_id}/tech-card", include_in_schema=False)
async def legacy_get_tech_card(
    project_id: str,
    position_id: Optional[str] = Query(default=None, alias="positionId"),
) -> Dict[str, Any]:
    project = _validate_project_exists(project_id)
    resolved_position_id = position_id or _default_position_id(project_id)
    if not resolved_position_id:
        raise HTTPException(404, "No positions available for project")

    response = await generate_tech_card(
        TechCardRequest(project_id=project_id, position_id=resolved_position_id)
    )

    if response.status != "success" or response.data is None:
        raise HTTPException(404, "Tech card not available")

    logger.debug(
        "Legacy tech card request served for %s (%s)",
        project_id,
        resolved_position_id,
    )
    return response.data["artifact"]


@legacy_router.get("/{project_id}/resource-sheet", include_in_schema=False)
async def legacy_get_resource_sheet(
    project_id: str,
    position_id: Optional[str] = Query(default=None, alias="positionId"),
) -> Dict[str, Any]:
    _validate_project_exists(project_id)
    resolved_position_id = position_id or _default_position_id(project_id)
    if not resolved_position_id:
        raise HTTPException(404, "No positions available for project")

    response = await generate_resource_sheet(
        ResourceSheetRequest(project_id=project_id, position_id=resolved_position_id)
    )

    if response.status != "success" or response.data is None:
        raise HTTPException(404, "Resource sheet not available")

    logger.debug(
        "Legacy resource sheet request served for %s (%s)",
        project_id,
        resolved_position_id,
    )
    return response.data["artifact"]


@legacy_router.get("/{project_id}/material-analysis", include_in_schema=False)
async def legacy_get_materials(
    project_id: str,
    position_id: Optional[str] = Query(default=None, alias="positionId"),
) -> Dict[str, Any]:
    _validate_project_exists(project_id)
    resolved_position_id = position_id or _default_position_id(project_id)
    if not resolved_position_id:
        raise HTTPException(404, "No positions available for project")

    response = await generate_materials(
        MaterialsRequest(project_id=project_id, position_id=resolved_position_id)
    )

    if response.status != "success" or response.data is None:
        raise HTTPException(404, "Materials not available")

    logger.debug(
        "Legacy materials request served for %s (%s)",
        project_id,
        resolved_position_id,
    )
    return response.data["artifact"]


__all__ = ["router", "legacy_router", "workflow_a"]
