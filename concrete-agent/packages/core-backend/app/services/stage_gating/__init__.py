"""
Orchestrator stage-gating layer (PR1 foundation).

Public surface:
  - WorkflowState, TERMINAL_STATES, transition, is_resumable, StateTransitionError
  - load_workflow_config, WorkflowConfig, WorkflowDefinition, WorkflowDefinitionError
  - SessionManager, SessionState + typed errors
  - InMemorySessionRepository, SqlAlchemySessionRepository

PR1 ships the rails (state machine + workflow config + session model + resume).
PR2 adds enforcement OVER those rails: the tool-manifest registry, the single
policy gateway (`evaluate_tool_policy`), and the grounding-gate
(`validate_grounding`) — all reading the PR1 YAML allow-lists as the single
source of truth. Audit-hash chaining, replay verification and HITL are PR3.

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
    SyncSqlAlchemySessionRepository,
    make_sync_session_factory,
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
from app.services.stage_gating.tool_manifest import (
    TOOL_MANIFESTS,
    RegistryValidationError,
    SideEffectLevel,
    ToolCategory,
    ToolManifest,
    get_manifest,
    stages_for_tool,
    validate_registry,
)
from app.services.stage_gating.policy_gateway import (
    GROUNDING_UNVERIFIED,
    GROUNDING_VERIFIED,
    GroundingResult,
    PolicyDecision,
    PolicyError,
    evaluate_tool_policy,
    validate_grounding,
)
from app.services.stage_gating.audit_log import (
    CORE_ENGINE_VERSION,
    AuditEntry,
    AuditLogWriter,
    InMemoryAuditLogWriter,
    NullAuditLogWriter,
    SyncAuditLogWriter,
    hash_payload,
)
from app.services.stage_gating.intent_classifier import (
    DEFAULT_WORKFLOW,
    IntentClassificationError,
    classify_intent,
)
from app.services.stage_gating.orchestrator import (
    STATUS_COMPLETED,
    STATUS_ERROR,
    STATUS_PAUSED,
    OrchestrateRequest,
    OrchestrateResult,
    StageGatingOrchestrator,
    StepContext,
    StepResult,
    ToolRunner,
    make_checkpoint_tool_runner,
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
    "SyncSqlAlchemySessionRepository",
    "make_sync_session_factory",
    # PR2 — tool registry
    "TOOL_MANIFESTS",
    "ToolManifest",
    "ToolCategory",
    "SideEffectLevel",
    "RegistryValidationError",
    "get_manifest",
    "stages_for_tool",
    "validate_registry",
    # PR2 — policy gateway + grounding-gate
    "PolicyDecision",
    "PolicyError",
    "evaluate_tool_policy",
    "validate_grounding",
    "GroundingResult",
    "GROUNDING_VERIFIED",
    "GROUNDING_UNVERIFIED",
    # PR3a — intent classification + orchestrator
    "classify_intent",
    "IntentClassificationError",
    "DEFAULT_WORKFLOW",
    "StageGatingOrchestrator",
    "OrchestrateRequest",
    "OrchestrateResult",
    "StepContext",
    "StepResult",
    "ToolRunner",
    "make_checkpoint_tool_runner",
    "STATUS_COMPLETED",
    "STATUS_PAUSED",
    "STATUS_ERROR",
    # PR3b — audit log
    "AuditEntry",
    "AuditLogWriter",
    "InMemoryAuditLogWriter",
    "NullAuditLogWriter",
    "SyncAuditLogWriter",
    "hash_payload",
    "CORE_ENGINE_VERSION",
]
