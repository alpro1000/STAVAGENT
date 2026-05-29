"""
Loader + validator for the workflow-definitions YAML.

Turns workflow_definitions.yaml into validated, in-memory structures the state
machine and (later) the policy gateway consume. Validation is strict: every
state key and every transition target must resolve to a known WorkflowState, or
loading raises — this is the "config is data but still validated" guarantee.

PR1 scope: load + validate + expose the adjacency map, per-state tool
allow-lists, and named workflow sequences. No enforcement here.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §5
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from app.services.stage_gating.workflow_state import WorkflowState

_DEFINITIONS_PATH = Path(__file__).with_name("workflow_definitions.yaml")


class WorkflowDefinitionError(ValueError):
    """Raised when the workflow-definitions file is malformed or inconsistent."""


@dataclass(frozen=True)
class WorkflowDefinition:
    """One named workflow — an ordered sequence of states."""

    name: str
    description: str
    start_state: WorkflowState
    sequence: tuple[WorkflowState, ...]


@dataclass(frozen=True)
class WorkflowConfig:
    """Parsed, validated view of workflow_definitions.yaml."""

    version: int
    # Effective per-state tool allow-list (state-specific tools + _all_stages).
    tools_by_state: dict[WorkflowState, frozenset[str]]
    # Adjacency map consumed by workflow_state.transition().
    transitions: dict[WorkflowState, frozenset[WorkflowState]]
    optional_states: frozenset[WorkflowState]
    terminal_states: frozenset[WorkflowState]
    workflows: dict[str, WorkflowDefinition] = field(default_factory=dict)

    def tools_allowed_in(self, state: WorkflowState) -> frozenset[str]:
        """Return the set of tool names allowed in `state` (gateway queries this)."""
        return self.tools_by_state.get(state, frozenset())


def _coerce_state(raw: str) -> WorkflowState:
    try:
        return WorkflowState(raw)
    except ValueError as exc:  # unknown state name in the YAML
        raise WorkflowDefinitionError(
            f"Unknown workflow state '{raw}'. Known states: "
            f"{[s.value for s in WorkflowState]}"
        ) from exc


def load_workflow_config(path: Path | None = None) -> WorkflowConfig:
    """Parse + validate the workflow-definitions YAML into a WorkflowConfig.

    Raises WorkflowDefinitionError on any inconsistency (unknown state, transition
    target that isn't a state, workflow sequence referencing an unknown state).
    """
    cfg_path = path or _DEFINITIONS_PATH
    if not cfg_path.is_file():
        raise WorkflowDefinitionError(f"Workflow definitions not found: {cfg_path}")

    raw = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}

    version = int(raw.get("version", 0))
    all_stage_tools = frozenset(raw.get("_all_stages", []) or [])

    states_raw = raw.get("states") or {}
    if not states_raw:
        raise WorkflowDefinitionError("No 'states' block in workflow definitions.")

    tools_by_state: dict[WorkflowState, frozenset[str]] = {}
    optional_states: set[WorkflowState] = set()
    terminal_states: set[WorkflowState] = set()

    for state_name, body in states_raw.items():
        state = _coerce_state(state_name)
        body = body or {}
        state_tools = frozenset(body.get("tools", []) or [])
        tools_by_state[state] = state_tools | all_stage_tools
        if body.get("optional"):
            optional_states.add(state)
        if body.get("terminal"):
            terminal_states.add(state)

    # Every WorkflowState must appear in the YAML — no silent gaps.
    missing = [s.value for s in WorkflowState if s not in tools_by_state]
    if missing:
        raise WorkflowDefinitionError(
            f"States missing from workflow definitions: {missing}"
        )

    transitions_raw = raw.get("transitions") or {}
    transitions: dict[WorkflowState, frozenset[WorkflowState]] = {}
    for state_name, targets in transitions_raw.items():
        state = _coerce_state(state_name)
        transitions[state] = frozenset(_coerce_state(t) for t in (targets or []))
    # Default any state without an explicit edge list to "no outgoing edges".
    for state in WorkflowState:
        transitions.setdefault(state, frozenset())

    workflows: dict[str, WorkflowDefinition] = {}
    for wf_name, wf_body in (raw.get("workflows") or {}).items():
        wf_body = wf_body or {}
        sequence_raw = wf_body.get("sequence") or []
        if not sequence_raw:
            raise WorkflowDefinitionError(
                f"Workflow '{wf_name}' has an empty sequence."
            )
        sequence = tuple(_coerce_state(s) for s in sequence_raw)
        start_raw = wf_body.get("start_state", sequence_raw[0])
        workflows[wf_name] = WorkflowDefinition(
            name=wf_name,
            description=str(wf_body.get("description", "")).strip(),
            start_state=_coerce_state(start_raw),
            sequence=sequence,
        )

    return WorkflowConfig(
        version=version,
        tools_by_state=tools_by_state,
        transitions=transitions,
        optional_states=frozenset(optional_states),
        terminal_states=frozenset(terminal_states),
        workflows=workflows,
    )
