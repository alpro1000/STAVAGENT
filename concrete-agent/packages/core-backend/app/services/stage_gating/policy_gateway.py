"""
Policy gateway for the orchestrator stage-gating layer (PR2).

THE single server-side enforcement point. Tools stay "dumb" — no tool body
contains stage-checking logic (AC6). Every gated surface calls
`evaluate_tool_policy()` at its head and refuses on a non-allowed decision.

Enforcement reads the per-state tool allow-lists from the PR1 workflow YAML via
`WorkflowConfig` (the single source of truth) — there is NO parallel tool→stage
manifest (drift = anti-pattern).

This module is also the home of the grounding-gate (`validate_grounding`) so
source-grounding validation lives in the SAME validation surface as policy
enforcement, not a second parallel validator. It codifies the patterns merged to
main: Pattern 29 (a populated `_source` is necessary but not sufficient —
citation present ≠ VERIFIED) and Pattern 9 (re-read / ground before deciding).

NOT in PR2: audit-hash chaining, replay verification, HITL pause/resume, the
append-only audit DB table. STAGE_VIOLATION attempts are surfaced via an audit
hook (logged); persisting them to the append-only audit table is PR3.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §3, §6; Domain Rules.
Reference: docs/STAVAGENT_PATTERNS.md Pattern 9 + Pattern 29.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

from app.services.stage_gating.tool_manifest import (
    ToolManifest,
    get_manifest,
    stages_for_tool,
)
from app.services.stage_gating.workflow_loader import WorkflowConfig
from app.services.stage_gating.workflow_state import (
    TERMINAL_STATES,
    WorkflowState,
)

logger = logging.getLogger(__name__)


class PolicyError(str, Enum):
    """Error codes the gateway returns on refusal (task §3)."""

    UNKNOWN_TOOL = "UNKNOWN_TOOL"
    SESSION_REQUIRED = "SESSION_REQUIRED"
    STAGE_VIOLATION = "STAGE_VIOLATION"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    SESSION_TERMINAL = "SESSION_TERMINAL"


# Tools permitted to write while a session is in a terminal state — the
# documented re-export exception (task §3). `export_soupis` renders the soupis
# deliverable from COMMITTED and drives COMMITTED → EXPORTED, so it must be allowed
# to run (writes_state) in that terminal state. Kept as an explicit allow-list,
# not ad-hoc logic.
RE_EXPORT_ALLOW_LIST: frozenset[str] = frozenset({"export_soupis"})


@dataclass(frozen=True)
class PolicyDecision:
    """Result of a policy evaluation. `allowed=True` means the call may proceed."""

    allowed: bool
    error_code: Optional[PolicyError] = None
    detail: str = ""
    manifest: Optional[ToolManifest] = None

    def as_error_dict(self) -> dict[str, Any]:
        """Shape returned to a caller on refusal (mirrors tool error contracts)."""
        return {
            "error": self.error_code.value if self.error_code else "POLICY_DENIED",
            "error_code": self.error_code.value if self.error_code else None,
            "detail": self.detail,
        }


# Audit hook signature: receives a structured violation record. PR3 will swap the
# default logger sink for the append-only audit table writer.
AuditHook = Callable[[dict[str, Any]], None]


def _default_audit_hook(record: dict[str, Any]) -> None:
    logger.warning("[StageGating/audit] %s", record)


def evaluate_tool_policy(
    *,
    tool_name: str,
    config: WorkflowConfig,
    session_id: Optional[str],
    current_state: Optional[WorkflowState],
    confirmation_token: Optional[str] = None,
    enforce_session: bool = False,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None,
    audit_hook: AuditHook = _default_audit_hook,
) -> PolicyDecision:
    """Evaluate whether `tool_name` may be invoked. Pure + deterministic.

    Opt-in session model (per W2/PR2 decision): when `session_id` is None and
    `enforce_session` is False, the call is treated as session-less and ALLOWED
    (preserves the current standalone REST / GPT-Actions behavior). Enforcement
    activates as soon as a `session_id` (and thus `current_state`) is supplied,
    or when a caller opts into strict mode via `enforce_session=True`.

    Order of checks (task §3):
      1. UNKNOWN_TOOL    — tool has no manifest
      2. SESSION_REQUIRED — requires_session but no session, in enforced mode
      3. (session-less + not enforced) → ALLOW (preserve current behavior)
      4. STAGE_VIOLATION — tool not in the YAML allow-list for current_state
                            (logged to the audit hook)
      5. CONFIRMATION_REQUIRED — requires_confirmation but no token
      6. SESSION_TERMINAL — writes_state in a terminal state, not re-export
    """
    manifest = get_manifest(tool_name)
    if manifest is None:
        return PolicyDecision(
            allowed=False,
            error_code=PolicyError.UNKNOWN_TOOL,
            detail=f"Tool '{tool_name}' is not registered.",
        )

    enforcing = enforce_session or session_id is not None

    if session_id is None:
        if manifest.requires_session and enforcing:
            return PolicyDecision(
                allowed=False,
                error_code=PolicyError.SESSION_REQUIRED,
                detail=f"Tool '{tool_name}' requires an active session.",
                manifest=manifest,
            )
        # Session-less and not enforced → preserve current standalone behavior.
        return PolicyDecision(allowed=True, manifest=manifest)

    # From here a session_id is present → full enforcement.
    if current_state is None:
        return PolicyDecision(
            allowed=False,
            error_code=PolicyError.SESSION_REQUIRED,
            detail=f"session_id '{session_id}' did not resolve to a workflow state.",
            manifest=manifest,
        )

    allowed_stages = stages_for_tool(config, tool_name)
    if current_state not in allowed_stages:
        record = {
            "event": "STAGE_VIOLATION",
            "tool_name": tool_name,
            "attempted_in_state": current_state.value,
            "allowed_stages": sorted(s.value for s in allowed_stages),
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
        }
        audit_hook(record)
        return PolicyDecision(
            allowed=False,
            error_code=PolicyError.STAGE_VIOLATION,
            detail=(
                f"Tool '{tool_name}' not allowed in state {current_state.value}. "
                f"Allowed: {sorted(s.value for s in allowed_stages)}."
            ),
            manifest=manifest,
        )

    if manifest.requires_confirmation and not confirmation_token:
        return PolicyDecision(
            allowed=False,
            error_code=PolicyError.CONFIRMATION_REQUIRED,
            detail=f"Tool '{tool_name}' requires a confirmation_token.",
            manifest=manifest,
        )

    if (
        manifest.writes_state
        and current_state in TERMINAL_STATES
        and tool_name not in RE_EXPORT_ALLOW_LIST
    ):
        return PolicyDecision(
            allowed=False,
            error_code=PolicyError.SESSION_TERMINAL,
            detail=(
                f"Session in terminal state {current_state.value}; "
                f"'{tool_name}' may not write state."
            ),
            manifest=manifest,
        )

    return PolicyDecision(allowed=True, manifest=manifest)


# ── Grounding-gate (Pattern 29 + Pattern 9) ──────────────────────────────────
# Same validation surface as the policy gate — NOT a second parallel validator.

# Status assigned to each work item by the grounding-gate.
GROUNDING_VERIFIED = "VERIFIED"
GROUNDING_UNVERIFIED = "UNVERIFIED"

# Field that must carry a concrete document reference per Pattern 29.
SOURCE_FIELD = "_source"


@dataclass
class GroundingResult:
    """Outcome of grounding a list of work items."""

    items: list[dict[str, Any]]  # items with `verification_status` annotated
    verified_count: int = 0
    unverified_count: int = 0
    rejected: list[dict[str, Any]] = field(default_factory=list)

    @property
    def all_verified(self) -> bool:
        return self.unverified_count == 0 and not self.rejected


def _is_grounded(item: dict[str, Any]) -> bool:
    """An item is grounded iff it carries a non-empty `_source` reference.

    Pattern 29: a populated `_source` is *necessary* (content-match on re-read is
    *sufficient*, but that re-read is the host's vision job per Pattern 40 — the
    deterministic gate enforces the necessary condition: presence + non-empty)."""
    src = item.get(SOURCE_FIELD)
    return isinstance(src, str) and src.strip() != ""


def validate_grounding(
    items: list[dict[str, Any]],
    *,
    reject_unverified: bool = False,
) -> GroundingResult:
    """Annotate each work item with a `verification_status` per the grounding-gate.

    Pattern 29 (citation ≠ VERIFIED → here enforced as: no `_source` ⇒ UNVERIFIED)
    and Pattern 9 (ground before deciding). Each item gets:
      - `verification_status = VERIFIED`   when it carries a `_source`
      - `verification_status = UNVERIFIED` otherwise

    `reject_unverified=True` additionally pulls ungrounded items out of the main
    list into `rejected` (used by stages that must not present ungrounded items
    as finished facts — e.g. before commit). Default annotates without removing,
    so a work-first breakdown can surface UNVERIFIED flags to the user.
    """
    result = GroundingResult(items=[])
    for item in items:
        annotated = dict(item)
        if _is_grounded(annotated):
            annotated["verification_status"] = GROUNDING_VERIFIED
            result.verified_count += 1
            result.items.append(annotated)
        else:
            annotated["verification_status"] = GROUNDING_UNVERIFIED
            result.unverified_count += 1
            if reject_unverified:
                result.rejected.append(annotated)
            else:
                result.items.append(annotated)
    return result
