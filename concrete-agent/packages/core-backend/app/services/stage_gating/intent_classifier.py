"""
Deterministic intent → workflow mapping for the orchestrator (PR3a).

The orchestrator picks which named workflow (from workflow_definitions.yaml) to
walk by classifying the caller's intent. Per the W3 decision this mapping is
DETERMINISTIC — no LLM. Determinism is a hard requirement: the replay/audit
layer (PR3b) re-runs a recorded session and must reach the identical workflow,
which is only guaranteed if intent classification is a pure function of the
request (Determinism > AI — the project's first key rule).

Resolution order (first match wins):
  1. An explicit `options.target_output` — the structured, unambiguous signal a
     UI sends. An unrecognized explicit value raises (fail loud: the caller
     asked for something we don't have, don't silently fall back).
  2. A keyword heuristic over the free-text `message` — covers chat/MCP callers
     that send prose instead of a structured option.
  3. Default to the canonical end-to-end workflow.

The returned name is always validated against the loaded WorkflowConfig, so a
drift between this map and the YAML fails loudly rather than 500-ing deep in the
orchestrator loop.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §5.
"""
from __future__ import annotations

from typing import Any, Mapping, Optional

from app.services.stage_gating.workflow_loader import WorkflowConfig

# Canonical workflow names defined in workflow_definitions.yaml.
WORKFLOW_FULL_TAKEOFF = "full_takeoff"
WORKFLOW_WORK_LIST_ONLY = "work_list_only"

DEFAULT_WORKFLOW = WORKFLOW_FULL_TAKEOFF

# Explicit `options.target_output` values → workflow name. This is the
# unambiguous path; the keys are the contract a UI codes against.
_TARGET_OUTPUT_MAP: dict[str, str] = {
    "work_list": WORKFLOW_WORK_LIST_ONLY,
    "work_list_only": WORKFLOW_WORK_LIST_ONLY,
    "atomization": WORKFLOW_WORK_LIST_ONLY,
    "full": WORKFLOW_FULL_TAKEOFF,
    "full_takeoff": WORKFLOW_FULL_TAKEOFF,
    "takeoff": WORKFLOW_FULL_TAKEOFF,
    "priced": WORKFLOW_FULL_TAKEOFF,
    "soupis": WORKFLOW_FULL_TAKEOFF,
    "export": WORKFLOW_FULL_TAKEOFF,
}

# Lowercased substrings in the free-text message that select work_list_only.
# Anything else falls through to the default (full takeoff). Czech + English.
_WORK_LIST_KEYWORDS: tuple[str, ...] = (
    "work list",
    "worklist",
    "jen prác",       # "jen práce" / "jen práci"
    "jen seznam prac",
    "výkaz prac",     # "výkaz prací" without catalog/prices
    "vykaz prac",
    "atomiz",
    "bez cen",
    "bez katalog",
    "without price",
    "without catalog",
    "no pricing",
)


class IntentClassificationError(ValueError):
    """Raised when intent cannot be resolved to a known workflow.

    Either an explicit target_output named an unknown output, or the resolved
    workflow name is absent from the loaded WorkflowConfig (map↔YAML drift).
    """


def classify_intent(
    *,
    config: WorkflowConfig,
    message: Optional[str] = None,
    options: Optional[Mapping[str, Any]] = None,
) -> str:
    """Return the workflow name to run for this request. Pure + deterministic.

    Raises IntentClassificationError if an explicit `options.target_output` is
    not recognized, or if the resolved name is not defined in `config`.
    """
    target_output = None
    if options:
        raw = options.get("target_output")
        if raw is not None:
            target_output = str(raw).strip().lower()

    if target_output:
        workflow = _TARGET_OUTPUT_MAP.get(target_output)
        if workflow is None:
            raise IntentClassificationError(
                f"Unknown target_output '{target_output}'. "
                f"Known: {sorted(_TARGET_OUTPUT_MAP)}."
            )
    else:
        workflow = _classify_from_message(message)

    if workflow not in config.workflows:
        raise IntentClassificationError(
            f"Resolved workflow '{workflow}' is not defined in the workflow "
            f"config. Defined: {sorted(config.workflows)}."
        )
    return workflow


def _classify_from_message(message: Optional[str]) -> str:
    if not message:
        return DEFAULT_WORKFLOW
    lowered = message.lower()
    if any(keyword in lowered for keyword in _WORK_LIST_KEYWORDS):
        return WORKFLOW_WORK_LIST_ONLY
    return DEFAULT_WORKFLOW
