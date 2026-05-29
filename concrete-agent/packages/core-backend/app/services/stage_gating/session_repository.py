"""
Persistence implementations for the SessionRepository protocol.

Two implementations:

  - InMemorySessionRepository — pure dict store. Used by unit tests so the
    state-machine + manager logic runs with NO database (test convention: fast,
    network-free). Also handy for a dry-run orchestrator.
  - SqlAlchemySessionRepository — async-SQLAlchemy-backed store against the
    `orchestrator_sessions` table. Used by the integration test gated on
    DATABASE_URL and by the real orchestrator (PR2+).

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §4
"""
from __future__ import annotations

import copy
from typing import Optional
from uuid import UUID

from app.services.stage_gating.session_manager import SessionState


class InMemorySessionRepository:
    """Dict-backed repository for tests and dry runs.

    Deep-copies on read/write so callers cannot mutate stored state by reference
    (mirrors the round-trip a real DB enforces — important for the resume test).
    """

    def __init__(self) -> None:
        self._store: dict[UUID, SessionState] = {}

    def create(self, state: SessionState) -> SessionState:
        if state.id in self._store:
            raise ValueError(f"Session {state.id} already exists")
        self._store[state.id] = copy.deepcopy(state)
        return copy.deepcopy(state)

    def get(self, session_id: UUID) -> Optional[SessionState]:
        stored = self._store.get(session_id)
        return copy.deepcopy(stored) if stored is not None else None

    def update(self, state: SessionState) -> SessionState:
        if state.id not in self._store:
            raise ValueError(f"Session {state.id} does not exist")
        self._store[state.id] = copy.deepcopy(state)
        return copy.deepcopy(state)


class SqlAlchemySessionRepository:
    """Async-SQLAlchemy repository against the orchestrator_sessions table.

    Synchronous protocol surface is kept (create/get/update) for symmetry with
    the in-memory fake and the PR1 manager; the methods run the async ORM calls
    on the provided AsyncSession via the caller's event loop. PR2 wires this into
    the orchestrator endpoint where an AsyncSession is already in scope.

    Kept deliberately thin — no business logic; mapping only.
    """

    def __init__(self, session_factory) -> None:
        # session_factory: a callable returning an AsyncSession context manager
        # (async_sessionmaker). Stored, not opened, so construction is cheap and
        # import-safe even when no DB is configured.
        self._session_factory = session_factory

    @staticmethod
    def _to_model(state: SessionState):
        from app.db.models.orchestrator_session import OrchestratorSession

        return OrchestratorSession(
            id=state.id,
            user_id=state.user_id,
            project_id=state.project_id,
            workflow_state=state.workflow_state.value,
            status=state.status,
            expires_at=state.expires_at,
            partials=state.partials,
            aggregates=state.aggregates,
            drafts=state.drafts,
            decisions=state.decisions,
            conversation_log=state.conversation_log,
            tool_calls_log=state.tool_calls_log,
        )

    @staticmethod
    def _from_model(row) -> SessionState:
        from app.services.stage_gating.workflow_state import WorkflowState

        return SessionState(
            id=row.id,
            user_id=row.user_id,
            project_id=row.project_id,
            workflow_state=WorkflowState(row.workflow_state),
            status=row.status,
            expires_at=row.expires_at,
            partials=row.partials or {},
            aggregates=row.aggregates or {},
            drafts=row.drafts or {},
            decisions=row.decisions or [],
            conversation_log=row.conversation_log or [],
            tool_calls_log=row.tool_calls_log or [],
        )

    async def create(self, state: SessionState) -> SessionState:
        async with self._session_factory() as session:
            model = self._to_model(state)
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._from_model(model)

    async def get(self, session_id: UUID) -> Optional[SessionState]:
        from app.db.models.orchestrator_session import OrchestratorSession

        async with self._session_factory() as session:
            row = await session.get(OrchestratorSession, session_id)
            return self._from_model(row) if row is not None else None

    async def update(self, state: SessionState) -> SessionState:
        from app.db.models.orchestrator_session import OrchestratorSession

        async with self._session_factory() as session:
            row = await session.get(OrchestratorSession, state.id)
            if row is None:
                raise ValueError(f"Session {state.id} does not exist")
            row.workflow_state = state.workflow_state.value
            row.status = state.status
            row.expires_at = state.expires_at
            row.partials = state.partials
            row.aggregates = state.aggregates
            row.drafts = state.drafts
            row.decisions = state.decisions
            row.conversation_log = state.conversation_log
            row.tool_calls_log = state.tool_calls_log
            await session.commit()
            await session.refresh(row)
            return self._from_model(row)
