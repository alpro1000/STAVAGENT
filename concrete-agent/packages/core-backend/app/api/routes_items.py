"""
Unified Item Layer API — Three operations for cross-kiosk position management.

Endpoints:
  POST /api/v1/items/import                — Bulk import positions from Excel
  GET  /api/v1/items/{project_id}          — Read items with filters
  PATCH /api/v1/items/{item_id}/{namespace} — Update a namespace block
  GET  /api/v1/items/{item_id}/versions    — Version history
  POST /api/v1/items/detect-codes          — Detect code systems for a batch
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.item_schemas import (
    BulkImportRequest,
    BulkImportResponse,
    CodeSystem,
    ItemFilterRequest,
    Namespace,
    ProjectItem,
    UpdateBlockRequest,
    UpdateBlockResponse,
)
from app.services import item_store
from app.services.code_detector import detect_code_system, detect_batch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/items", tags=["Unified Item Layer"])


# ── Operation 1: Bulk Import ─────────────────────────────────────────────────

@router.post("/import", response_model=BulkImportResponse)
async def api_bulk_import(request: BulkImportRequest):
    """
    Bulk import positions from Excel.

    - Atomic: all or nothing.
    - Idempotent: repeated calls don't create duplicates.
    - Matching: by code_system + kod + mj (identity triple).
    - Returns permanent item_id for each position.
    """
    if not request.items:
        raise HTTPException(400, "No items to import")

    if not request.project_id:
        raise HTTPException(400, "project_id is required")

    try:
        result = await item_store.bulk_import(request)
        logger.info(
            f"[Items] Imported {result.total} items for project {request.project_id}: "
            f"{result.created} created, {result.updated} updated, {result.unchanged} unchanged"
        )
        return result
    except Exception as e:
        logger.error(f"[Items] Import error: {e}")
        raise HTTPException(500, f"Import failed: {str(e)}")


# ── Operation 2: Read Items with Filters ──────────────────────────────────────

@router.get("/{project_id}", response_model=list[ProjectItem])
async def api_read_items(
    project_id: str,
    skupina: Optional[str] = Query(None, description="Work group filter (BETON_MONOLIT, etc.)"),
    code_system: Optional[str] = Query(None, description="Code system filter (otskp, urs, rts)"),
    has_monolit: Optional[bool] = Query(None, description="Filter by Monolit data presence"),
    has_classification: Optional[bool] = Query(None, description="Filter by classification presence"),
    keyword: Optional[str] = Query(None, description="Search in description (popis)"),
    so_id: Optional[str] = Query(None, description="Filter by SO identifier"),
):
    """
    Read project items with optional filters.

    Monolit can request only concrete positions:
      GET /api/v1/items/{project_id}?skupina=BETON_MONOLIT

    Registry can request unfilled positions:
      GET /api/v1/items/{project_id}?has_monolit=false
    """
    filters = ItemFilterRequest(
        skupina=skupina,
        code_system=CodeSystem(code_system) if code_system else None,
        has_monolit=has_monolit,
        has_classification=has_classification,
        keyword=keyword,
        so_id=so_id,
    )

    try:
        items = await item_store.read_items(project_id, filters)
        return items
    except Exception as e:
        logger.error(f"[Items] Read error: {e}")
        raise HTTPException(500, f"Read failed: {str(e)}")


# ── Operation 3: Update Namespace Block ───────────────────────────────────────

@router.patch("/{item_id}/{namespace}", response_model=UpdateBlockResponse)
async def api_update_block(item_id: str, namespace: str, request: UpdateBlockRequest):
    """
    Update a specific namespace block of an item.

    Each kiosk writes ONLY to its own namespace:
    - estimate: Registry (Excel import data)
    - monolit: Monolit kiosk (concrete parameters)
    - classification: Classification engine (work groups, codes)
    - core: READ-ONLY (managed by Core Engine)

    Writing to another kiosk's namespace is rejected with 403.
    """
    try:
        ns = Namespace(namespace)
    except ValueError:
        raise HTTPException(400, f"Invalid namespace: {namespace}. Valid: {[n.value for n in Namespace]}")

    # Override namespace in request to match URL
    request.namespace = ns

    try:
        result = await item_store.update_block(item_id, request)
        return result
    except ValueError as e:
        if "read-only" in str(e).lower():
            raise HTTPException(403, str(e))
        if "not found" in str(e).lower():
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"[Items] Update block error: {e}")
        raise HTTPException(500, f"Update failed: {str(e)}")


# ── Grouped Items (Construction Cards for Monolit) ───────────────────────────

@router.get("/{project_id}/grouped")
async def api_grouped_items(project_id: str):
    """
    Get construction cards — concrete positions with linked rebar and formwork.

    Returns groups where each has a beton leader + optional armatura/opalubka members.
    Used by Monolit to show card-based UI instead of flat list.
    """
    try:
        all_items = await item_store.read_items(project_id)

        # Build lookup
        by_id = {it.item_id: it for it in all_items}

        cards = []
        for item in all_items:
            if item.core.group_role != "beton":
                continue

            members_rebar = []
            members_formwork = []
            for mid in (item.core.group_members or []):
                member = by_id.get(mid)
                if not member:
                    continue
                if member.core.group_role == "armatura":
                    members_rebar.append(member)
                elif member.core.group_role == "opalubka":
                    members_formwork.append(member)

            cards.append({
                "beton": item.model_dump(),
                "armatura": [m.model_dump() for m in members_rebar],
                "opalubka": [m.model_dump() for m in members_formwork],
                "armatura_included": item.core.armatura_included,
                "opalubka_included": item.core.opalubka_included,
                "is_complete": (
                    (item.core.armatura_included or len(members_rebar) > 0) and
                    (item.core.opalubka_included or len(members_formwork) > 0)
                ),
            })

        # Also return ungrouped concrete items (group_role=None but might be concrete by unit)
        return {
            "project_id": project_id,
            "cards": cards,
            "total_cards": len(cards),
            "total_items": len(all_items),
        }
    except Exception as e:
        logger.error(f"[Items] Grouped error: {e}")
        raise HTTPException(500, f"Failed: {str(e)}")


# ── Version History ───────────────────────────────────────────────────────────

@router.get("/{item_id}/versions")
async def api_item_versions(item_id: str):
    """Get version history for an item (changes on reimport)."""
    try:
        versions = await item_store.get_item_versions(item_id)
        return {"item_id": item_id, "versions": [v.model_dump() for v in versions]}
    except Exception as e:
        logger.error(f"[Items] Versions error: {e}")
        raise HTTPException(500, f"Failed: {str(e)}")


# ── Code Detection ────────────────────────────────────────────────────────────

@router.post("/detect-codes")
async def api_detect_codes(items: list[dict]):
    """
    Detect code systems (OTSKP/ÚRS/RTS) for a batch of items.

    Each item dict should have: kod, popis (optional), price_source (optional).
    Returns detection result with confidence for each item.
    """
    if not items:
        raise HTTPException(400, "No items to detect")

    results = detect_batch(items)
    return {
        "total": len(results),
        "results": [r.model_dump() for r in results],
        "summary": {
            "otskp": sum(1 for r in results if r.code_system == CodeSystem.OTSKP),
            "urs": sum(1 for r in results if r.code_system == CodeSystem.URS),
            "rts": sum(1 for r in results if r.code_system == CodeSystem.RTS),
            "unknown": sum(1 for r in results if r.code_system == CodeSystem.UNKNOWN),
        },
    }
