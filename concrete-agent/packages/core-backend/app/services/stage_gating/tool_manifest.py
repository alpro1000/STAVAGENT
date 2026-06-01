"""
Tool metadata registry for the orchestrator stage-gating layer (PR2).

Each MCP tool ships a manifest declaring its side-effect profile, session needs,
billing, and audit/replay flags (task §2). The registry is validated at startup
(task §4 / AC4): a registered MCP tool without a manifest makes validation fail
loudly.

CRITICAL — single source of truth for tool→stage (per the W2/PR2 brief):
`policy_stage` is NOT stored here. The per-state tool allow-lists live ONLY in
`workflow_definitions.yaml` (PR1). This registry DERIVES `policy_stage` by
inverting the loaded `WorkflowConfig`. Storing a parallel tool→stage map here
would drift from the YAML — that is the explicit anti-pattern to avoid.

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §2, §4, §7
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.services.stage_gating.workflow_loader import WorkflowConfig
from app.services.stage_gating.workflow_state import WorkflowState


class SideEffectLevel(str, Enum):
    """The 6 side-effect levels a tool can declare (task §2 — all 6 values)."""

    NONE = "none"
    SESSION_ONLY = "session_only"
    DRAFT_ONLY = "draft_only"
    PERSISTENT_MUTATION = "persistent_mutation"
    REVERSIBLE_MUTATION = "reversible_mutation"
    EXTERNAL_IO = "external_io"


class ToolCategory(str, Enum):
    """Tool categories (task §2)."""

    DETERMINISTIC_CALCULATION = "deterministic_calculation"
    DOCUMENT_PROCESSING = "document_processing"
    CATALOG_BINDING = "catalog_binding"
    COMMIT = "commit"
    SESSION = "session"
    DECISION = "decision"
    RENDER = "render"
    POLICY_META = "policy_meta"


@dataclass(frozen=True)
class ToolManifest:
    """Per-tool metadata. `policy_stage` is intentionally absent — it is derived
    from the workflow YAML, never stored here (see module docstring)."""

    tool_name: str
    category: ToolCategory
    side_effect_level: SideEffectLevel
    requires_session: bool
    writes_state: bool
    audit_required: bool
    replayable: bool
    billable: bool
    credits: int
    requires_confirmation: bool
    version: str


# ── Manifests for the existing MCP tools ─────────────────────────────────────
# policy_stage for each is governed by workflow_definitions.yaml (PR1), NOT here.
# `credits` mirrors app/mcp/auth.py TOOL_COSTS (kept in sync by a test).
# All current tools are read-only/deterministic (side_effect_level=none); the
# commit/render/decision categories will gain entries in later PRs.
TOOL_MANIFESTS: dict[str, ToolManifest] = {
    "analyze_construction_document": ToolManifest(
        tool_name="analyze_construction_document",
        category=ToolCategory.DOCUMENT_PROCESSING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=10,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "parse_construction_budget": ToolManifest(
        tool_name="parse_construction_budget",
        category=ToolCategory.DOCUMENT_PROCESSING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=5,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "classify_construction_element": ToolManifest(
        tool_name="classify_construction_element",
        category=ToolCategory.DETERMINISTIC_CALCULATION,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=False,
        replayable=True,
        billable=False,
        credits=0,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "calculate_concrete_works": ToolManifest(
        tool_name="calculate_concrete_works",
        category=ToolCategory.DETERMINISTIC_CALCULATION,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=5,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "create_work_breakdown": ToolManifest(
        tool_name="create_work_breakdown",
        category=ToolCategory.DETERMINISTIC_CALCULATION,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=True,  # produces the frozen work list within a session
        writes_state=False,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=20,
        requires_confirmation=False,
        version="2.0.0",  # v2: explicit work_first/work_with_catalog mode (PR2)
    ),
    "find_urs_code": ToolManifest(
        tool_name="find_urs_code",
        category=ToolCategory.CATALOG_BINDING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=3,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "find_otskp_code": ToolManifest(
        tool_name="find_otskp_code",
        category=ToolCategory.CATALOG_BINDING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=False,
        replayable=True,
        billable=False,
        credits=0,
        requires_confirmation=False,
        version="1.0.0",
    ),
    "search_czech_construction_norms": ToolManifest(
        tool_name="search_czech_construction_norms",
        category=ToolCategory.DOCUMENT_PROCESSING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=False,
        replayable=True,
        billable=True,
        credits=1,
        requires_confirmation=False,
        version="1.0.0",
    ),
    # W3b object-type detector exposed as a tool (document-analysis time).
    # Deterministic, free, read-only.
    "detect_object_type": ToolManifest(
        tool_name="detect_object_type",
        category=ToolCategory.DOCUMENT_PROCESSING,
        side_effect_level=SideEffectLevel.NONE,
        requires_session=False,
        writes_state=False,
        audit_required=False,
        replayable=True,
        billable=False,
        credits=0,
        requires_confirmation=False,
        version="1.0.0",
    ),
    # First deliverable export (soupis prací). Deterministic render. writes_state
    # so it drives COMMITTED → EXPORTED; allowed in the terminal COMMITTED state
    # only via RE_EXPORT_ALLOW_LIST (policy_gateway).
    "export_soupis": ToolManifest(
        tool_name="export_soupis",
        category=ToolCategory.RENDER,
        side_effect_level=SideEffectLevel.DRAFT_ONLY,
        requires_session=False,
        writes_state=True,
        audit_required=True,
        replayable=True,
        billable=True,
        credits=10,
        requires_confirmation=False,
        version="1.0.0",
    ),
}


class RegistryValidationError(RuntimeError):
    """Raised at startup when the manifest registry is inconsistent."""


def get_manifest(tool_name: str) -> ToolManifest | None:
    """Return the manifest for `tool_name`, or None if unregistered."""
    return TOOL_MANIFESTS.get(tool_name)


def stages_for_tool(config: WorkflowConfig, tool_name: str) -> frozenset[WorkflowState]:
    """Derive a tool's policy_stage allow-list from the workflow YAML.

    This is the single source of truth for tool→stage — inverted from
    `config.tools_by_state`, never stored in the manifest.
    """
    return frozenset(
        state for state in WorkflowState if tool_name in config.tools_allowed_in(state)
    )


def validate_registry(
    config: WorkflowConfig,
    registered_tools: set[str],
    *,
    exempt: set[str] | None = None,
) -> None:
    """Validate the manifest registry at startup (AC4).

    Two checks, both fail the server start with a clear error:
    - Every registered MCP tool (minus `exempt`) must have a manifest.
    - Every tool that appears in any YAML stage allow-list must have a manifest
      (so the gateway can resolve its metadata).

    `exempt` covers tools intentionally outside the stage-gated workflow surface
    (e.g. the UEP pipeline tools and the pump/advisor helpers), which are billed
    + auth-gated but not part of the document→export state machine yet.
    """
    exempt = exempt or set()

    missing = sorted(registered_tools - set(TOOL_MANIFESTS) - exempt)
    if missing:
        raise RegistryValidationError(
            "MCP tools registered without a manifest (server cannot start): "
            f"{missing}. Add a ToolManifest in app/services/stage_gating/"
            "tool_manifest.py or add them to the documented exempt set."
        )

    # Every tool named in the YAML allow-lists must be known to the registry.
    yaml_tools: set[str] = set()
    for state in WorkflowState:
        yaml_tools |= set(config.tools_allowed_in(state))
    yaml_unmanifested = sorted(yaml_tools - set(TOOL_MANIFESTS))
    if yaml_unmanifested:
        raise RegistryValidationError(
            "Tools referenced in workflow_definitions.yaml have no manifest: "
            f"{yaml_unmanifested}."
        )
