"""The canonical `/orchestrate` endpoint (PR3a + PR3b).

Single REST surface the UI, MCP clients, and (later) the ADK call to drive a
stage-gated workflow. Thin transport adapter: validate, build the orchestrator
over the DURABLE session store + audit log, run one turn, map the typed result to
JSON.

PR3b changes (the durable + secured surface):
  - Session owner comes from the authenticated principal (Portal JWT), NEVER the
    request body — `SessionAccessError` is now a real HTTP boundary (AC18).
  - Sessions persist to Postgres via the sync repository, so HITL pause/resume is
    durable across Cloud Run instances/restarts (no more process-local store).
  - Every tool call + state transition is written to the append-only audit log.
  - The principal's user (and the referenced project) are auto-provisioned so the
    session FKs are satisfiable even though those ids originate in the Portal DB.

The orchestrator + session manager are synchronous; the endpoint runs them in a
worker thread (`asyncio.to_thread`) so the blocking DB I/O never blocks the
FastAPI event loop.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §5, AC9, AC11, AC18.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth_principal import (
    Principal,
    ensure_project_provisioned,
    ensure_user_provisioned,
    require_principal,
)
from app.core.config import settings
from app.services.stage_gating import (
    IntentClassificationError,
    OrchestrateRequest,
    OrchestrateResult,
    SessionAccessError,
    SessionManager,
    SessionNotFoundError,
    SessionTerminalError,
    StageGatingOrchestrator,
    SyncAuditLogWriter,
    SyncSqlAlchemySessionRepository,
    load_workflow_config,
    make_checkpoint_tool_runner,
    make_sync_session_factory,
)

router = APIRouter(prefix="/api/v1", tags=["orchestrator"])

# Parsed once per process (config is data; cheap, immutable).
_CONFIG = load_workflow_config()
_TOOL_RUNNER = make_checkpoint_tool_runner(_CONFIG)


def _session_factory():
    """Memoized sync sessionmaker for the configured DB (engine outlives request)."""
    return make_sync_session_factory(settings.DATABASE_URL)


def _build_orchestrator() -> StageGatingOrchestrator:
    factory = _session_factory()
    manager = SessionManager(SyncSqlAlchemySessionRepository(factory), config=_CONFIG)
    return StageGatingOrchestrator(
        manager=manager,
        config=_CONFIG,
        tool_runner=_TOOL_RUNNER,
        audit_writer=SyncAuditLogWriter(factory),
    )


class OrchestrateBody(BaseModel):
    """Request body. NOTE: no `user_id` — the owner is the authenticated principal."""

    project_id: UUID = Field(..., description="Project the session belongs to.")
    session_id: Optional[UUID] = Field(
        None, description="Omit to start a new session; supply to resume one."
    )
    message: Optional[str] = Field(
        None, description="Free-text intent for new sessions (chat/MCP callers)."
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured options; `target_output` selects the workflow.",
    )
    confirmation_token: Optional[str] = Field(
        None, description="Confirmation for gated steps (e.g. commit)."
    )
    user_response: Optional[Any] = Field(
        None, description="Answer to a prior HITL pause when resuming."
    )


class OrchestrateResponse(BaseModel):
    session_id: UUID
    status: str
    workflow_name: str
    workflow_state: str
    steps: list[dict[str, Any]] = Field(default_factory=list)
    question: Optional[dict[str, Any]] = None
    error: Optional[str] = None


def _run_blocking(principal: Principal, body: OrchestrateBody) -> OrchestrateResult:
    """Synchronous work: provision FKs, then drive the orchestrator one turn.

    Runs in a worker thread. Auto-provisioning the user + project keeps the
    session FKs satisfiable for ids that originate in the Portal DB. The owner is
    bound to the authenticated principal, never to a body field.
    """
    factory = _session_factory()
    ensure_user_provisioned(principal, factory)
    ensure_project_provisioned(
        user_id=principal.user_id, project_id=body.project_id, session_factory=factory
    )
    request = OrchestrateRequest(
        user_id=principal.user_id,
        project_id=body.project_id,
        session_id=body.session_id,
        message=body.message,
        options=body.options,
        confirmation_token=body.confirmation_token,
        user_response=body.user_response,
    )
    return _build_orchestrator().run(request)


@router.post("/orchestrate", response_model=OrchestrateResponse)
async def orchestrate(
    body: OrchestrateBody,
    principal: Principal = Depends(require_principal),
) -> OrchestrateResponse:
    """Create or resume a stage-gated workflow session and advance it one turn.

    Auth: `Authorization: Bearer <Portal JWT>` required (401 otherwise). The
    session owner is the JWT principal; a session created by user A cannot be
    read or resumed by user B (403 via the tenant guard).

    Returns `status`: `completed` / `paused_for_input` / `error`. Client errors
    map to 4xx: unknown intent → 400, unknown session → 404, wrong owner → 403,
    terminal/expired session → 409.
    """
    try:
        result = await asyncio.to_thread(_run_blocking, principal, body)
    except IntentClassificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except SessionAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except SessionTerminalError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    return OrchestrateResponse(
        session_id=result.session_id,
        status=result.status,
        workflow_name=result.workflow_name,
        workflow_state=result.workflow_state.value,
        steps=result.steps,
        question=result.question,
        error=result.error,
    )
