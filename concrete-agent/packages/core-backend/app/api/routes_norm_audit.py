"""
NKB Audit API — Endpoints for normative source audit and gap analysis.

Endpoints:
  POST /api/v1/nkb/audit/start          — Start audit (all or selected sources)
  GET  /api/v1/nkb/audit/status          — Current audit status/progress
  GET  /api/v1/nkb/audit/result          — Full audit result with gap entries
  GET  /api/v1/nkb/audit/sources         — List all configured sources
  POST /api/v1/nkb/audit/download-missing — Download missing priority documents
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.models.audit_schemas import (
    AuditResult,
    DownloadMissingRequest,
    StartAuditRequest,
)
from app.services.norm_audit_service import (
    get_current_audit,
    start_audit,
)
from app.services.norm_source_catalog import NORM_SOURCES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/nkb/audit", tags=["NKB Audit"])


# ── Models ────────────────────────────────────────────────────────────────────

class AuditStatusResponse(BaseModel):
    audit_id: Optional[str] = None
    status: str = "idle"
    progress: int = 0
    current_source: Optional[str] = None
    sources_checked: list[str] = []
    total_unique_documents: int = 0
    error: Optional[str] = None


class SourceInfo(BaseModel):
    source_code: str
    name: str
    url: str
    priority: int
    doc_types: list[str]
    oblasti: list[str]
    is_signal_only: bool
    scraper_implemented: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start")
async def api_start_audit(
    request: StartAuditRequest,
    background_tasks: BackgroundTasks,
):
    """Start a new NKB audit. Runs in background, poll /status for progress."""
    current = get_current_audit()
    if current and current.status == "running":
        raise HTTPException(400, "Audit already running. Wait for completion or check /status.")

    # Run in background
    background_tasks.add_task(start_audit, request)

    return {
        "success": True,
        "message": "Audit started. Poll /api/v1/nkb/audit/status for progress.",
    }


@router.get("/status", response_model=AuditStatusResponse)
async def api_audit_status():
    """Get current audit status."""
    current = get_current_audit()
    if not current:
        return AuditStatusResponse(status="idle")

    return AuditStatusResponse(
        audit_id=current.audit_id,
        status=current.status,
        progress=current.progress,
        current_source=current.current_source,
        sources_checked=current.sources_checked,
        total_unique_documents=current.total_unique_documents,
        error=current.error,
    )


@router.get("/result")
async def api_audit_result(
    status_filter: Optional[str] = None,
    source_filter: Optional[str] = None,
    oblast_filter: Optional[str] = None,
    priority_filter: Optional[int] = None,
    doc_type_filter: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
):
    """Get full audit result with gap entries. Supports filtering."""
    current = get_current_audit()
    if not current:
        raise HTTPException(404, "No audit results available. Run /start first.")

    entries = current.gap_entries

    # Apply filters
    if status_filter:
        entries = [e for e in entries if e.status.value == status_filter]
    if source_filter:
        entries = [e for e in entries if source_filter in e.zdroje]
    if oblast_filter:
        entries = [e for e in entries if e.oblast == oblast_filter]
    if priority_filter:
        entries = [e for e in entries if e.priorita.value >= priority_filter]
    if doc_type_filter:
        entries = [e for e in entries if e.doc_type.value == doc_type_filter]

    total = len(entries)
    entries = entries[offset:offset + limit]

    return {
        "success": True,
        "audit_id": current.audit_id,
        "status": current.status,
        "started_at": current.started_at,
        "completed_at": current.completed_at,
        "source_summaries": [s.model_dump() for s in current.source_summaries],
        "gap_entries": [e.model_dump() for e in entries],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/sources")
async def api_list_sources():
    """List all configured normative sources."""
    sources = []
    for code, src in NORM_SOURCES.items():
        sources.append(SourceInfo(
            source_code=src.source_code,
            name=src.name,
            url=src.url,
            priority=src.priority.value,
            doc_types=[dt.value for dt in src.doc_types],
            oblasti=src.oblasti,
            is_signal_only=src.is_signal_only,
            scraper_implemented=src.scraper_implemented,
        ))
    return {"success": True, "sources": [s.model_dump() for s in sources]}


@router.post("/download-missing")
async def api_download_missing(request: DownloadMissingRequest):
    """Placeholder: Download missing documents with priority filter."""
    current = get_current_audit()
    if not current or current.status != "completed":
        raise HTTPException(400, "No completed audit. Run /start first.")

    missing = [
        e for e in current.gap_entries
        if e.status.value == "chybí"
        and e.priorita.value >= request.min_priority
        and e.url_ke_stazeni
    ]

    if request.oznaceni_list:
        missing = [e for e in missing if e.oznaceni in request.oznaceni_list]

    # For now, return the list of downloadable documents
    # Actual download pipeline would be implemented here
    return {
        "success": True,
        "message": f"Found {len(missing)} documents available for download",
        "documents": [
            {
                "oznaceni": e.oznaceni,
                "nazev": e.nazev,
                "url": e.url_ke_stazeni,
                "priorita": e.priorita.value,
            }
            for e in missing
        ],
    }
