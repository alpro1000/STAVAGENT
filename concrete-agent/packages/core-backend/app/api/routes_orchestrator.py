"""
The canonical `/orchestrate` endpoint (PR3a).

This is the single REST surface the UI, MCP clients, and (later) the ADK call to
drive a stage-gated workflow. It is a thin transport adapter: it validates the
request, builds the `StageGatingOrchestrator` over the shared session store +
workflow config, runs one turn (which either completes the workflow or pauses
for human-in-the-loop input), and maps the typed result back to JSON.

ALL workflow logic lives in `app.services.stage_gating.orchestrator` — this file
contains no stage logic, only request/response shaping and error mapping.

PR3a scope / known limitation (durability):
  Sessions are persisted in a PROCESS-LOCAL in-memory store. PR1 ships a sync
  `SessionManager` and an async `SqlAlchemySessionRepository` that are
  deliberately NOT wired together yet (the sync↔async repository bridge is
  PR3b). Until that bridge exists, HITL pause/resume works within a single
  running instance but is not durable across instances or restarts. This is a
  conscious MVP boundary, documented here and in the PR description — not an
  oversight. The orchestrator itself is storage-agnostic, so swapping in the
  DB-backed repository in PR3b is a one-line change at the wiring point below.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §5.
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.stage_gating import (
    InMemorySessionRepository,
    IntentClassificationError,
    OrchestrateRequest,
    SessionAccessError,
    SessionManager,
    SessionNotFoundError,
    SessionTerminalError,
    StageGatingOrchestrator,
    load_workflow_config,
    make_checkpoint_tool_runner,
)

router = APIRouter(prefix="/api/v1", tags=["orchestrator"])

# Shared, process-local wiring (see module docstring re: durability). Built once
# so the workflow config is parsed a single time per process.
_CONFIG = load_workflow_config()
_REPO = InMemorySessionRepository()
_MANAGER = SessionManager(_REPO, config=_CONFIG)
_TOOL_RUNNER = make_checkpoint_tool_runner(_CONFIG)


def _build_orchestrator() -> StageGatingOrchestrator:
    return StageGatingOrchestrator(
        manager=_MANAGER, config=_CONFIG, tool_runner=_TOOL_RUNNER
    )


class OrchestrateBody(BaseModel):
    """Request body for POST /api/v1/orchestrate."""

    user_id: UUID = Field(..., description="Owning user (tenant guard).")
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


@router.post("/orchestrate", response_model=OrchestrateResponse)
async def orchestrate(body: OrchestrateBody) -> OrchestrateResponse:
    """Create or resume a stage-gated workflow session and advance it one turn.

    Returns `status`:
      - `completed`        — workflow reached its terminal state this turn,
      - `paused_for_input` — a step needs HITL input; resume with `session_id`
                             (+ `user_response` / `confirmation_token`),
      - `error`            — a step failed (partial progress is preserved).

    Client errors map to 4xx: unknown intent → 400, unknown session → 404,
    wrong owner → 403, terminal/expired session → 409.
    """
    request = OrchestrateRequest(
        user_id=body.user_id,
        project_id=body.project_id,
        session_id=body.session_id,
        message=body.message,
        options=body.options,
        confirmation_token=body.confirmation_token,
        user_response=body.user_response,
    )
    orchestrator = _build_orchestrator()
    try:
        result = orchestrator.run(request)
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
