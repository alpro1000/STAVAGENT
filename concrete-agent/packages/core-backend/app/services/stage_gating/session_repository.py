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
from datetime import datetime
from functools import lru_cache
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


class SyncSqlAlchemySessionRepository:
    """Synchronous SQLAlchemy repository against the orchestrator_sessions table.

    The PR1 `SessionManager` is synchronous (create/get/update are plain calls,
    not awaited) and so is the orchestrator loop built on it. The existing
    `SqlAlchemySessionRepository` is async and therefore cannot be driven by that
    sync manager (the PR1 DB test documents this gap). PR3a worked around it with
    a process-local in-memory store, which is not durable across Cloud Run
    instances/restarts.

    This sync repository closes that gap: it satisfies the same sync
    create/get/update protocol the `SessionManager` already expects, backed by a
    psycopg2 engine. The `/orchestrate` endpoint runs the sync orchestrator in a
    worker thread (`asyncio.to_thread`) so the blocking DB I/O here never blocks
    the FastAPI event loop. Sessions now survive across instances — durable HITL
    resume (the PR3b deliverable).

    Reuses the async repo's pure `_to_model` / `_from_model` mappers (no await in
    them) so there is one mapping definition, not two.
    """

    def __init__(self, session_factory) -> None:
        # session_factory: a callable returning a SQLAlchemy Session context
        # manager (sessionmaker bound to a sync engine).
        self._session_factory = session_factory

    def create(self, state: SessionState) -> SessionState:
        with self._session_factory() as session:
            model = SqlAlchemySessionRepository._to_model(state)
            session.add(model)
            session.commit()
            session.refresh(model)
            return SqlAlchemySessionRepository._from_model(model)

    def get(self, session_id: UUID) -> Optional[SessionState]:
        from app.db.models.orchestrator_session import OrchestratorSession

        with self._session_factory() as session:
            row = session.get(OrchestratorSession, session_id)
            return (
                SqlAlchemySessionRepository._from_model(row)
                if row is not None
                else None
            )

    def update(self, state: SessionState) -> SessionState:
        from app.db.models.orchestrator_session import OrchestratorSession

        with self._session_factory() as session:
            row = session.get(OrchestratorSession, state.id)
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
            session.commit()
            session.refresh(row)
            return SqlAlchemySessionRepository._from_model(row)

    def purge_expired(self, *, now: Optional[datetime] = None) -> int:
        """Delete sessions whose TTL has lapsed. Returns the row count removed.

        TTL eviction keeps the table bounded (the in-memory PR3a store grew
        unbounded). Expired sessions are already non-resumable at the manager
        layer (resume rejects them); this physically reclaims their rows. Safe to
        call opportunistically or from a periodic maintenance task.
        """
        from sqlalchemy import delete

        from app.db.models.orchestrator_session import OrchestratorSession

        cutoff = now or datetime.now(tz=_utc())
        with self._session_factory() as session:
            result = session.execute(
                delete(OrchestratorSession).where(
                    OrchestratorSession.expires_at.isnot(None),
                    OrchestratorSession.expires_at < cutoff,
                )
            )
            session.commit()
            return int(result.rowcount or 0)


def _utc():
    from datetime import timezone

    return timezone.utc


def _to_sync_dsn(dsn: str) -> str:
    """Normalize an async/whatever Postgres DSN to a psycopg2 (sync) DSN."""
    dsn = dsn.strip()
    if dsn.startswith("postgresql+asyncpg://"):
        return dsn.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if dsn.startswith("postgresql://"):
        return dsn.replace("postgresql://", "postgresql+psycopg2://", 1)
    return dsn


@lru_cache(maxsize=4)
def make_sync_session_factory(dsn: str):
    """Build + memoize a sync sessionmaker for a DSN.

    The engine owns a connection pool, so it MUST outlive a single request —
    memoized per (sync-normalized) DSN, mirroring the async-engine memoization in
    the MCP gateway. Built lazily on first use so module import stays DB-free.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(_to_sync_dsn(dsn), future=True, pool_pre_ping=True)
    return sessionmaker(bind=engine, expire_on_commit=False)
