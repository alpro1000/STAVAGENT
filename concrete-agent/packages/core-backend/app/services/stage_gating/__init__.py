"""
Orchestrator stage-gating layer (PR1 foundation).

Public surface:
  - WorkflowState, TERMINAL_STATES, transition, is_resumable, StateTransitionError
  - load_workflow_config, WorkflowConfig, WorkflowDefinition, WorkflowDefinitionError
  - SessionManager, SessionState + typed errors
  - InMemorySessionRepository, SqlAlchemySessionRepository

PR1 ships the rails (state machine + workflow config + session model + resume).
Policy enforcement, audit hashing, replay, work-first decoupling and the
grounding-gate are PR2/PR3.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md
"""
from app.services.stage_gating.session_manager import (
    DEFAULT_TTL_DAYS,
    SessionAccessError,
    SessionManager,
    SessionNotFoundError,
    SessionState,
    SessionTerminalError,
)
from app.services.stage_gating.session_repository import (
    InMemorySessionRepository,
    SqlAlchemySessionRepository,
)
from app.services.stage_gating.workflow_loader import (
    WorkflowConfig,
    WorkflowDefinition,
    WorkflowDefinitionError,
    load_workflow_config,
)
from app.services.stage_gating.workflow_state import (
    TERMINAL_STATES,
    StateTransitionError,
    WorkflowState,
    is_resumable,
    transition,
)

__all__ = [
    "WorkflowState",
    "TERMINAL_STATES",
    "transition",
    "is_resumable",
    "StateTransitionError",
    "load_workflow_config",
    "WorkflowConfig",
    "WorkflowDefinition",
    "WorkflowDefinitionError",
    "SessionManager",
    "SessionState",
    "SessionNotFoundError",
    "SessionAccessError",
    "SessionTerminalError",
    "DEFAULT_TTL_DAYS",
    "InMemorySessionRepository",
    "SqlAlchemySessionRepository",
]
