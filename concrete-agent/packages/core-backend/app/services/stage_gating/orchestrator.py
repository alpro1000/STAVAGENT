"""
Thin stage-gating orchestrator loop (PR3a).

The orchestrator is the ONLY component that owns session state and drives the
workflow. It:

  1. classifies intent → a named workflow (deterministic, `intent_classifier`),
  2. creates or resumes a session,
  3. walks the workflow's state `sequence` one state at a time — for each state
     it runs that state's *step* through an injected tool-runner, records the
     outputs onto the session, then advances to the next state via the validated
     state-machine edge (`SessionManager.advance`),
  4. pauses for human-in-the-loop (HITL) input whenever a step asks for it, and
     resumes exactly where it left off on the next call.

Design constraints honoured:
  - Thin: the orchestrator contains NO domain/tool logic. Which tool runs and
    what it returns is entirely the tool-runner's job (the seam injected by the
    transport). Tools never mutate workflow state — only the orchestrator does
    (Domain Rule).
  - Deterministic: given the same request and the same tool-runner outputs, the
    orchestrator visits the identical state sequence and writes the identical
    log. This is what makes PR3b replay verification possible.
  - Atomic steps: a step either COMPLETES (outputs recorded, then advance) or
    PAUSES (nothing recorded, state unchanged). So a resume safely re-runs the
    paused step — no half-applied state, no double-execution.

NOT here (PR3b): audit-hash chaining, replay verification, the append-only audit
DB table, cross-user RLS hardening. The per-step records this loop appends to the
session logs are what those layers will consume.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §1, §5, §6.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, Optional
from uuid import UUID, uuid4

from app.services.stage_gating.audit_log import (
    AuditLogWriter,
    NullAuditLogWriter,
    build_state_transition_entry,
    build_tool_call_entry,
)
from app.services.stage_gating.intent_classifier import classify_intent
from app.services.stage_gating.policy_gateway import validate_grounding
from app.services.stage_gating.session_manager import SessionManager, SessionState
from app.services.stage_gating.workflow_loader import WorkflowConfig
from app.services.stage_gating.workflow_state import WorkflowState

# ── status values returned to the caller ─────────────────────────────────────
STATUS_COMPLETED = "completed"
STATUS_PAUSED = "paused_for_input"
STATUS_ERROR = "error"

# Reserved keys the orchestrator owns inside `session.partials`.
PARTIALS_WORKFLOW_KEY = "_orchestrator_workflow"
PARTIALS_STEPS_KEY = "_orchestrator_steps"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── tool-runner seam ─────────────────────────────────────────────────────────
@dataclass
class StepContext:
    """Everything a tool-runner needs to execute one workflow state's step."""

    state: WorkflowState
    workflow_name: str
    session: SessionState
    message: Optional[str]
    options: Mapping[str, Any]
    # The user's answer to a prior pause, present only on the first step of a
    # resume. None on every other step.
    user_response: Optional[Any]
    confirmation_token: Optional[str]


@dataclass
class StepResult:
    """Outcome of running one state's step.

    Either it completes (default) or it requests HITL input by setting
    `needs_user_input=True` and supplying a `question`. `work_items`, if present,
    are run through the grounding-gate by the orchestrator and their verified /
    unverified counts recorded on the step.
    """

    outputs: dict[str, Any] = field(default_factory=dict)
    work_items: list[dict[str, Any]] = field(default_factory=list)
    # Tools the runner actually invoked (real dispatch). The checkpoint runner
    # leaves this empty and populates `tools_allowed` instead — names must not
    # claim a tool ran when none did (audit/replay honesty).
    tools_invoked: list[str] = field(default_factory=list)
    tools_allowed: list[str] = field(default_factory=list)
    tool_version: Optional[str] = None
    needs_user_input: bool = False
    question: Optional[dict[str, Any]] = None


# A tool-runner maps a StepContext → StepResult. Injected by the transport so
# tests stub it and production wires real dispatch. Pure from the orchestrator's
# point of view: the orchestrator never inspects how the result was produced.
ToolRunner = Callable[[StepContext], StepResult]


# ── request / result (transport-agnostic) ────────────────────────────────────
@dataclass
class OrchestrateRequest:
    user_id: UUID
    project_id: UUID
    session_id: Optional[UUID] = None
    message: Optional[str] = None
    options: Mapping[str, Any] = field(default_factory=dict)
    confirmation_token: Optional[str] = None
    user_response: Optional[Any] = None


@dataclass
class OrchestrateResult:
    session_id: UUID
    status: str
    workflow_name: str
    workflow_state: WorkflowState
    steps: list[dict[str, Any]] = field(default_factory=list)
    question: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class StageGatingOrchestrator:
    """Drives a session through a named workflow via an injected tool-runner."""

    def __init__(
        self,
        *,
        manager: SessionManager,
        config: WorkflowConfig,
        tool_runner: ToolRunner,
        audit_writer: Optional[AuditLogWriter] = None,
    ) -> None:
        self._manager = manager
        self._config = config
        self._run_step = tool_runner
        # Append-only audit sink. Defaults to a no-op so the orchestrator stays
        # callable without a DB (PR3a in-memory path / pure unit tests).
        self._audit = audit_writer or NullAuditLogWriter()

    # ── entry point ─────────────────────────────────────────────────────────
    def run(self, request: OrchestrateRequest) -> OrchestrateResult:
        """Create-or-resume a session and walk it forward until done or paused.

        Raises the manager's typed client errors (SessionNotFoundError,
        SessionAccessError, SessionTerminalError) and IntentClassificationError
        for the transport to map to 4xx. A tool-runner failure is caught and
        returned as a STATUS_ERROR result so partial progress already persisted
        is preserved.
        """
        state, workflow_name = self._start_or_resume(request)
        sequence = self._config.workflows[workflow_name].sequence

        # A resumed session may sit in a state that is not part of the resolved
        # workflow's sequence (e.g. it entered the optional DECOMPOSITION branch,
        # or its workflow tag disagrees with its state). `sequence.index()` would
        # raise ValueError → unhandled 500. Guard it into a clean STATUS_ERROR so
        # the caller gets an actionable message instead of a stack trace.
        if state.workflow_state not in sequence:
            return OrchestrateResult(
                session_id=state.id,
                status=STATUS_ERROR,
                workflow_name=workflow_name,
                workflow_state=state.workflow_state,
                error=(
                    f"session state '{state.workflow_state.value}' is not in "
                    f"workflow '{workflow_name}' sequence "
                    f"{[s.value for s in sequence]}; cannot resume here."
                ),
            )

        steps_this_run: list[dict[str, Any]] = []
        # The user's answer applies only to the FIRST step executed this run
        # (the one that was paused). Cleared once that step completes so later
        # steps in the same run don't see a stale response.
        pending_response = request.user_response

        # The loop advances strictly forward through `sequence`, so it is bounded
        # by the sequence length; the guard is belt-and-braces against a
        # malformed config.
        for _ in range(len(sequence) + 1):
            current = state.workflow_state
            idx = sequence.index(current)

            ctx = StepContext(
                state=current,
                workflow_name=workflow_name,
                session=state,
                message=request.message,
                options=request.options,
                user_response=pending_response,
                confirmation_token=request.confirmation_token,
            )
            try:
                result = self._run_step(ctx)
            except Exception as exc:  # tool-runner failure — don't 500 the loop
                return OrchestrateResult(
                    session_id=state.id,
                    status=STATUS_ERROR,
                    workflow_name=workflow_name,
                    workflow_state=current,
                    steps=steps_this_run,
                    error=f"step '{current.value}' failed: {exc}",
                )

            if result.needs_user_input:
                # PAUSE: record nothing, leave state on `current` so the resume
                # re-runs this same step. Idempotent by construction.
                self._append_pause_marker(state, current, result, request.user_id)
                return OrchestrateResult(
                    session_id=state.id,
                    status=STATUS_PAUSED,
                    workflow_name=workflow_name,
                    workflow_state=current,
                    steps=steps_this_run,
                    question=result.question
                    or {"state": current.value, "prompt": "Input required."},
                )

            step_record = self._record_step(state, current, result, request.user_id)
            steps_this_run.append(step_record)

            # Append-only audit: one tool_call row per completed step. Hashes are
            # computed over volatile-stripped payloads so replay reproduces them.
            # tool_name is a SHORT identifier (a single invoked tool, or the step
            # state as a label) — NOT a joined list, which would overflow the
            # column. The full invoked/allowed tool sets live in `detail` (JSONB).
            if len(result.tools_invoked) == 1:
                tool_name = result.tools_invoked[0]
            elif result.tools_invoked:
                tool_name = f"{current.value}[{len(result.tools_invoked)} tools]"
            else:
                tool_name = current.value
            self._audit.write(
                build_tool_call_entry(
                    session_id=state.id,
                    user_id=state.user_id,
                    project_id=state.project_id,
                    tool_name=tool_name,
                    tool_version=result.tool_version,
                    inputs={
                        "state": current.value,
                        "message": request.message,
                        "options": dict(request.options),
                        "has_user_response": pending_response is not None,
                    },
                    outputs={
                        "outputs": result.outputs,
                        "work_items_count": len(result.work_items),
                    },
                    detail={
                        "tools_invoked": list(result.tools_invoked),
                        "tools_allowed": list(result.tools_allowed),
                    },
                )
            )
            pending_response = None  # consumed by the step that just completed

            if idx == len(sequence) - 1:
                # Reached the final state in the sequence — workflow complete.
                return OrchestrateResult(
                    session_id=state.id,
                    status=STATUS_COMPLETED,
                    workflow_name=workflow_name,
                    workflow_state=current,
                    steps=steps_this_run,
                )

            next_state = sequence[idx + 1]
            source = f"orchestrator:{current.value}->{next_state.value}"
            state = self._manager.advance(
                session_id=state.id,
                user_id=request.user_id,
                target=next_state,
                triggered_by=source,
            )
            # Append-only audit: state transition with its source (AC16).
            self._audit.write(
                build_state_transition_entry(
                    session_id=state.id,
                    user_id=state.user_id,
                    project_id=state.project_id,
                    transition_from=current.value,
                    transition_to=next_state.value,
                    transition_source=source,
                )
            )

        # Unreachable for a well-formed config (loop returns at the terminal
        # state); surfaced as an error rather than silently looping.
        return OrchestrateResult(
            session_id=state.id,
            status=STATUS_ERROR,
            workflow_name=workflow_name,
            workflow_state=state.workflow_state,
            steps=steps_this_run,
            error="workflow sequence did not terminate (malformed config).",
        )

    # ── internals ─────────────────────────────────────────────────────────
    def _start_or_resume(
        self, request: OrchestrateRequest
    ) -> tuple[SessionState, str]:
        if request.session_id is None:
            workflow_name = classify_intent(
                config=self._config,
                message=request.message,
                options=request.options,
            )
            start_state = self._config.workflows[workflow_name].start_state
            state = self._manager.create_session(
                session_id=uuid4(),
                user_id=request.user_id,
                project_id=request.project_id,
                start_state=start_state,
            )
            state.partials[PARTIALS_WORKFLOW_KEY] = workflow_name
            state.partials.setdefault(PARTIALS_STEPS_KEY, [])
            state = self._manager.persist(state, user_id=request.user_id)
            return state, workflow_name

        # Resume: raises SessionTerminalError for terminal/expired sessions.
        state = self._manager.resume_session(
            session_id=request.session_id, user_id=request.user_id
        )
        workflow_name = state.partials.get(PARTIALS_WORKFLOW_KEY)
        if workflow_name not in self._config.workflows:
            # A session created outside the orchestrator (no workflow tag) can't
            # be resumed by it — classify fresh from the resume request instead.
            workflow_name = classify_intent(
                config=self._config,
                message=request.message,
                options=request.options,
            )
            state.partials[PARTIALS_WORKFLOW_KEY] = workflow_name
            state = self._manager.persist(state, user_id=request.user_id)
        return state, workflow_name

    def _record_step(
        self,
        state: SessionState,
        current: WorkflowState,
        result: StepResult,
        user_id: UUID,
    ) -> dict[str, Any]:
        record: dict[str, Any] = {
            "state": current.value,
            "tools_invoked": list(result.tools_invoked),
            "tools_allowed": list(result.tools_allowed),
            "at": _utcnow_iso(),
        }
        if result.work_items:
            grounding = validate_grounding(result.work_items)
            record["work_items_verified"] = grounding.verified_count
            record["work_items_unverified"] = grounding.unverified_count
        if result.outputs:
            # Merge step outputs into session partials under the state's name so
            # downstream states (and resume) can read prior outputs.
            state.partials.setdefault(current.value, {}).update(result.outputs)
        state.partials.setdefault(PARTIALS_STEPS_KEY, []).append(record)
        self._manager.persist(state, user_id=user_id)
        return record

    def _append_pause_marker(
        self,
        state: SessionState,
        current: WorkflowState,
        result: StepResult,
        user_id: UUID,
    ) -> None:
        state.conversation_log.append(
            {
                "type": "hitl_pause",
                "state": current.value,
                "question": result.question,
                "at": _utcnow_iso(),
            }
        )
        self._manager.persist(state, user_id=user_id)


# ── default production tool-runner (PR3a checkpoint runner) ───────────────────
def make_checkpoint_tool_runner(config: WorkflowConfig) -> ToolRunner:
    """Build the safe default runner for the live `/orchestrate` endpoint.

    PR3a ships the orchestrator + endpoint + HITL machinery; wiring each
    workflow state to its real MCP tool dispatch is the next increment. Until
    then this runner records each state as a checkpoint (naming the tools the
    YAML allows there, for the audit trail) and advances — WITHOUT fabricating
    domain outputs and WITHOUT crossing into a terminal/commit state unconfirmed.

    The one real gate it enforces is the commit confirmation: COMMIT_PENDING
    pauses for an explicit `confirmation_token` before the loop is allowed to
    advance into COMMITTED. This gives the live endpoint a genuine HITL gate and
    guarantees nothing is marked committed without the user saying so.

    Closes over `config` so each checkpoint can list the tools the YAML permits
    in that state — keeping the YAML the single source of truth.
    """

    def _runner(ctx: StepContext) -> StepResult:
        if ctx.state == WorkflowState.COMMIT_PENDING and not ctx.confirmation_token:
            return StepResult(
                needs_user_input=True,
                question={
                    "state": ctx.state.value,
                    "prompt": "Confirm commit of the assembled work breakdown?",
                    "required": "confirmation_token",
                },
            )
        # Checkpoint, not a real dispatch: record the tools the YAML ALLOWS in
        # this state under `tools_allowed` — never `tools_invoked` (no tool ran).
        return StepResult(
            outputs={"checkpoint": True},
            tools_allowed=sorted(config.tools_allowed_in(ctx.state)),
        )

    return _runner
