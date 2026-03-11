from fastapi import APIRouter, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.services.monolit_import import preview_import

router = APIRouter()


class Position(BaseModel):
    code: Optional[str]
    name: str
    quantity: Optional[float]
    unit: Optional[str]
    meta: Optional[Dict[str, Any]] = None


class Sheet(BaseModel):
    id: Optional[str]
    name: str
    positions: List[Position]


class MonolitProject(BaseModel):
    id: Optional[str]
    name: str
    sheets: List[Sheet]


class RegistryPosition(Position):
    registry_id: Optional[str]


class RegistryObject(BaseModel):
    id: Optional[str]
    name: str
    positions: List[RegistryPosition]


class RegistryProject(BaseModel):
    id: Optional[str]
    name: str
    objects: List[RegistryObject] = Field(default_factory=list)


@router.post("/api/v1/monolit/import-preview")
async def monolit_import_preview(
    monolit: MonolitProject = Body(...),
    registry: Optional[RegistryProject] = Body(None),
    auto_save: bool = Body(False),
) -> Dict[str, Any]:
    """Preview import from Monolit Planner into Registry (Rozpis zdrojů).

    This endpoint performs matching between Monolit positions and Registry positions.
    It does NOT modify any persisted Registry state — intended for Preview+Confirm flow.

    Required: `monolit` payload. If `registry` is not provided the response will indicate
    that a target registry snapshot is required for matching.
    """
    if registry is None:
        return {
            "ok": False,
            "error": "registry snapshot required for preview",
            "hint": "Provide registry project data (objects with positions) or call the fetch endpoint first",
        }

    report = preview_import(monolit.dict(), registry.dict(), {"auto_save": bool(auto_save)})
    return {"ok": True, "report": report}
