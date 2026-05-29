"""
Workflow state machine for the orchestrator stage-gating layer.

This is PR1 (foundation) of TASK_Orchestrator_StageGating_MVP. It provides a
deterministic state-machine primitive only — NO policy enforcement, NO audit
hashing, NO replay verification (those are PR2/PR3).

Design note (per task §1): the state machine is a deterministic primitive, not
a class with hidden state. Given a current state and a desired transition it
returns either the new state or raises a typed violation. The orchestrator owns
the state; tools never mutate it.

Naming: the task prose says "eight states" but enumerates NINE (DECOMPOSITION
is explicitly the optional 9th and is referenced by the calculate_concrete_works
policy_stage). All nine are implemented; the discrepancy is intentional and
documented in the PR description.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §1, §4
"""
from __future__ import annotations

from enum import Enum


class WorkflowState(str, Enum):
    """The workflow stages a session can occupy.

    `str` mixin so values serialize directly to JSON / DB enum strings and
    compare cleanly against the CHECK-constraint values on the session table.
    """

    DOCUMENT_ANALYSIS = "DOCUMENT_ANALYSIS"
    WORK_ATOMIZATION = "WORK_ATOMIZATION"
    DECOMPOSITION = "DECOMPOSITION"  # optional — not all workflows enter this
    CATALOG_BINDING = "CATALOG_BINDING"
    PRICING = "PRICING"
    REVIEW = "REVIEW"
    COMMIT_PENDING = "COMMIT_PENDING"
    COMMITTED = "COMMITTED"
    EXPORTED = "EXPORTED"


# Terminal states — a session in one of these is not resumable in the
# workflow-continuation sense (task §3 names both as terminal for writes_state
# tools, with re-export as the documented exception handled in PR2 enforcement).
TERMINAL_STATES: frozenset[WorkflowState] = frozenset(
    {WorkflowState.COMMITTED, WorkflowState.EXPORTED}
)


class StateTransitionError(ValueError):
    """Raised when a requested state transition is not permitted."""

    def __init__(self, current: WorkflowState, target: WorkflowState) -> None:
        self.current = current
        self.target = target
        super().__init__(
            f"Illegal workflow transition: {current.value} -> {target.value}"
        )


def transition(
    current: WorkflowState,
    target: WorkflowState,
    allowed: dict[WorkflowState, frozenset[WorkflowState]],
) -> WorkflowState:
    """Return `target` if the transition is allowed, else raise.

    Pure function — no side effects, no hidden state. `allowed` is the adjacency
    map (typically built from the workflow-definitions YAML so transitions are
    data, not hardcoded).
    """
    if target not in allowed.get(current, frozenset()):
        raise StateTransitionError(current, target)
    return target


def is_resumable(state: WorkflowState) -> bool:
    """A session is resumable iff it is not in a terminal state."""
    return state not in TERMINAL_STATES
