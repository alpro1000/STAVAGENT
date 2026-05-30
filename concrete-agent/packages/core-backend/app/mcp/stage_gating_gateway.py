"""
MCP ↔ stage-gating bridge (PR2).

Thin adapter that lets the MCP transport surfaces (REST wrappers in routes.py,
and later the FastMCP dispatch) call the single policy gateway from
`app.services.stage_gating` without embedding any stage logic in tool bodies
(AC6 — tools stay dumb).

Responsibilities:
  - resolve a session_id → current WorkflowState (via the SqlAlchemy session
    repository when a DB is configured; None when no session / no DB)
  - run `evaluate_tool_policy` against the PR1 YAML allow-lists (single source)
  - translate a refusal into an HTTPException with an appropriate status code

Opt-in session model (W2/PR2 decision): when no session_id is supplied the call
is session-less and allowed (preserves current standalone REST / GPT-Actions
behavior). Enforcement activates as soon as a session_id is provided.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §3
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional
from uuid import UUID

from fastapi import HTTPException

from app.services.stage_gating import (
    PolicyError,
    WorkflowState,
    evaluate_tool_policy,
    load_workflow_config,
)

logger = logging.getLogger(__name__)

# HTTP status per policy error code.
_STATUS_BY_ERROR = {
    PolicyError.UNKNOWN_TOOL: 404,
    PolicyError.SESSION_REQUIRED: 400,
    PolicyError.STAGE_VIOLATION: 409,
    PolicyError.CONFIRMATION_REQUIRED: 428,  # Precondition Required
    PolicyError.SESSION_TERMINAL: 409,
}


@lru_cache(maxsize=1)
def _config():
    """Load + cache the workflow config once per process."""
    return load_workflow_config()


async def _resolve_session_state(session_id: str) -> Optional[WorkflowState]:
    """Return the current WorkflowState for a session_id, or None if it cannot
    be resolved (no DB configured, malformed id, or session not found).

    Async: the gateway is invoked from FastAPI async handlers, which already run
    inside an event loop. We `await` the repository directly — never `asyncio.run`
    (that raises "cannot run event loop while another loop is running" and would
    crash every async caller).

    Kept defensive: any failure to reach the DB yields None rather than raising,
    so a misconfigured DB never 500s a tool call — the gateway then reports the
    appropriate SESSION_REQUIRED.
    """
    try:
        sid = UUID(str(session_id))
    except (ValueError, AttributeError):
        return None

    try:
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.core.config import settings  # type: ignore

        dsn = getattr(settings, "DATABASE_URL", None)
        if not dsn:
            return None
        # Local import to avoid a hard dependency at module import time.
        from app.services.stage_gating.session_repository import (
            SqlAlchemySessionRepository,
        )

        engine = create_async_engine(
            dsn.replace("postgresql://", "postgresql+asyncpg://", 1),
            future=True,
        )
        try:
            factory = async_sessionmaker(engine, expire_on_commit=False)
            repo = SqlAlchemySessionRepository(factory)
            state = await repo.get(sid)
            return state.workflow_state if state is not None else None
        finally:
            await engine.dispose()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("[StageGating] session state resolution failed: %s", exc)
        return None


async def enforce_or_raise(
    *,
    tool_name: str,
    session_id: Optional[str] = None,
    confirmation_token: Optional[str] = None,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None,
) -> None:
    """Run the policy gateway for `tool_name`; raise HTTPException on refusal.

    Async because session-state resolution awaits the DB repository. Call it with
    `await` from the async tool surfaces. No-op (allows) for session-less calls —
    preserves current behavior. When a session_id is supplied, resolves its state
    and enforces the YAML allow-list.
    """
    current_state = (
        await _resolve_session_state(session_id) if session_id else None
    )
    decision = evaluate_tool_policy(
        tool_name=tool_name,
        config=_config(),
        session_id=session_id,
        current_state=current_state,
        confirmation_token=confirmation_token,
        user_id=user_id,
        project_id=project_id,
    )
    if not decision.allowed:
        status = _STATUS_BY_ERROR.get(decision.error_code, 403)
        raise HTTPException(status_code=status, detail=decision.as_error_dict())
