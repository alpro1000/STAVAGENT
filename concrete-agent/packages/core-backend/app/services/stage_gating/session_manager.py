"""
Session manager for the orchestrator stage-gating layer (PR1 foundation).

Owns the lifecycle of an OrchestratorSession: create (with TTL), advance state
through the validated state machine, append to the JSONB logs, and resume a
non-terminal session by returning its full state to the caller.

This module is DB-agnostic: it talks to a `SessionRepository` protocol. The
SQLAlchemy implementation lives in `session_repository.py`; unit tests inject an
in-memory fake so the core logic runs with no network/AI/DB (test convention
mirrors test_redis_integration.py's graceful-skip approach, but here the logic
is pure so it always runs).

NOT in PR1: policy enforcement (gateway), audit hashing, replay verification.
Those consume the logs this module writes but are PR2/PR3.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §1, §4, §6
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Protocol
from uuid import UUID

from app.services.stage_gating.workflow_loader import WorkflowConfig, load_workflow_config
from app.services.stage_gating.workflow_state import (
    WorkflowState,
    is_resumable,
    transition,
)

# Default session TTL (task §4 / AC10: default 7 days, configurable per project).
DEFAULT_TTL_DAYS = 7


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class SessionState:
    """In-memory snapshot of a session — what create/resume return to callers.

    Mirrors the OrchestratorSession columns but is plain data so the manager and
    its tests never depend on a live SQLAlchemy session.
    """

    id: UUID
    user_id: UUID
    project_id: UUID
    workflow_state: WorkflowState
    status: str = "active"
    expires_at: Optional[datetime] = None
    partials: dict[str, Any] = field(default_factory=dict)
    aggregates: dict[str, Any] = field(default_factory=dict)
    drafts: dict[str, Any] = field(default_factory=dict)
    decisions: list[dict[str, Any]] = field(default_factory=list)
    conversation_log: list[dict[str, Any]] = field(default_factory=list)
    tool_calls_log: list[dict[str, Any]] = field(default_factory=list)

    def is_expired(self, *, now: Optional[datetime] = None) -> bool:
        if self.expires_at is None:
            return False
        return (now or _utcnow()) >= self.expires_at

    def is_resumable(self, *, now: Optional[datetime] = None) -> bool:
        return is_resumable(self.workflow_state) and not self.is_expired(now=now)


class SessionRepository(Protocol):
    """Persistence boundary. SQLAlchemy impl + in-memory test fake both satisfy it."""

    def create(self, state: SessionState) -> SessionState: ...

    def get(self, session_id: UUID) -> Optional[SessionState]: ...

    def update(self, state: SessionState) -> SessionState: ...


class SessionNotFoundError(LookupError):
    """Raised when a session_id does not resolve to a stored session."""


class SessionAccessError(PermissionError):
    """Raised when a user attempts to access a session they do not own.

    Basic tenant guard only (user_id mismatch). Deeper RLS hardening is the
    parallel cross-user isolation P0 task (task "What Is NOT Included").
    """


class SessionTerminalError(RuntimeError):
    """Raised when attempting to advance/resume a terminal or expired session."""


class SessionManager:
    """Create / advance / resume orchestrator sessions over a repository."""

    def __init__(
        self,
        repository: SessionRepository,
        config: Optional[WorkflowConfig] = None,
    ) -> None:
        self._repo = repository
        self._config = config or load_workflow_config()

    # ── creation ──────────────────────────────────────────────────────────
    def create_session(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        project_id: UUID,
        start_state: WorkflowState = WorkflowState.DOCUMENT_ANALYSIS,
        ttl_days: int = DEFAULT_TTL_DAYS,
        now: Optional[datetime] = None,
    ) -> SessionState:
        """Create a new active session with a TTL (default 7 days)."""
        created_at = now or _utcnow()
        state = SessionState(
            id=session_id,
            user_id=user_id,
            project_id=project_id,
            workflow_state=start_state,
            status="active",
            expires_at=created_at + timedelta(days=ttl_days),
        )
        return self._repo.create(state)

    # ── state transitions ─────────────────────────────────────────────────
    def advance(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        target: WorkflowState,
        triggered_by: str,
        now: Optional[datetime] = None,
    ) -> SessionState:
        """Transition a session to `target`, validating against the state graph.

        Logs the transition to tool_calls_log with its source (tool name or
        orchestrator decision rule) per AC16. State changes are
        orchestrator-initiated; tools never call this directly with their own
        authority (task Domain Rules).
        """
        state = self._load_owned(session_id, user_id)
        if state.is_expired(now=now):
            raise SessionTerminalError(
                f"Session {session_id} is expired (expires_at={state.expires_at}); "
                f"cannot advance."
            )
        # Legality is owned solely by the transition map. Terminal states have no
        # outgoing edges EXCEPT the documented COMMITTED -> EXPORTED re-export
        # edge, which the map permits; transition() rejects everything else.
        new_state = transition(state.workflow_state, target, self._config.transitions)
        previous = state.workflow_state
        state.workflow_state = new_state
        state.tool_calls_log.append(
            {
                "type": "state_transition",
                "from": previous.value,
                "to": new_state.value,
                "triggered_by": triggered_by,
                "at": (now or _utcnow()).isoformat(),
            }
        )
        return self._repo.update(state)

    # ── resume ────────────────────────────────────────────────────────────
    def resume_session(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        now: Optional[datetime] = None,
    ) -> SessionState:
        """Return full state of a non-terminal session so the caller can continue.

        Raises SessionTerminalError if the session is terminal or expired
        (AC11: resume from any NON-terminal state).
        """
        state = self._load_owned(session_id, user_id)
        if not state.is_resumable(now=now):
            raise SessionTerminalError(
                f"Session {session_id} is not resumable "
                f"(state={state.workflow_state.value}, expired={state.is_expired(now=now)})."
            )
        return state

    # ── orchestrator support ───────────────────────────────────────────────
    def load(self, *, session_id: UUID, user_id: UUID) -> SessionState:
        """Return the owned session state without a resumability check.

        Public, ownership-checked accessor for the orchestrator. Unlike
        `resume_session` it does NOT reject terminal/expired sessions — the
        caller decides what to do with the state. Raises SessionNotFoundError /
        SessionAccessError via the same tenant guard as every other entry point.
        """
        return self._load_owned(session_id, user_id)

    def persist(self, state: SessionState, *, user_id: UUID) -> SessionState:
        """Persist orchestrator-mutated session data (partials/drafts/etc.).

        Ownership-checked: the orchestrator records per-step outputs onto a
        state it already loaded through an ownership-checked path, so this only
        re-asserts the tenant guard before writing back. State transitions still
        go exclusively through `advance` (the validated state-machine edge) —
        this method must NOT be used to change `workflow_state`.
        """
        if state.user_id != user_id:
            raise SessionAccessError(
                f"User {user_id} may not persist session {state.id}"
            )
        return self._repo.update(state)

    # ── internal ──────────────────────────────────────────────────────────
    def _load_owned(self, session_id: UUID, user_id: UUID) -> SessionState:
        state = self._repo.get(session_id)
        if state is None:
            raise SessionNotFoundError(f"No session {session_id}")
        if state.user_id != user_id:
            # Tenant guard: user B cannot touch user A's session (AC18).
            raise SessionAccessError(
                f"User {user_id} may not access session {session_id}"
            )
        return state
