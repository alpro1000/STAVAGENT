"""
Unit tests for the PR2 policy gateway + tool registry + grounding-gate.

No network, no AI, no DB — the gateway, registry and grounding-gate are pure and
read the PR1 workflow YAML as the single source of truth for tool→stage.

Covers (W2/PR2 acceptance criteria):
  AC3  — manifest registry has the 6-value side_effect_level enum
  AC4  — registry validation fails on a registered tool without a manifest
  AC5  — the 9 workflow tools have manifests with correct derived policy_stage
  AC6/7— STAGE_VIOLATION (find_urs_code in WORK_ATOMIZATION) + audit hook fires
  AC8  — SESSION_REQUIRED when a session-requiring tool is called in enforced
         mode without a session
  AC19 — create_work_breakdown mode=work_first attaches no codes/prices
  grounding-gate — Pattern 29 (no _source ⇒ UNVERIFIED)

Reference: docs/tasks/TASK_Orchestrator_StageGating_MVP.md §2-§7
"""
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from app.services.stage_gating import (
    GROUNDING_UNVERIFIED,
    GROUNDING_VERIFIED,
    PolicyError,
    RegistryValidationError,
    SideEffectLevel,
    WorkflowState,
    evaluate_tool_policy,
    get_manifest,
    load_workflow_config,
    stages_for_tool,
    validate_grounding,
    validate_registry,
)

CFG = load_workflow_config()


# ── Registry / manifests (AC3, AC4, AC5) ─────────────────────────────────────

def test_side_effect_level_has_six_values():
    assert len(list(SideEffectLevel)) == 6
    assert {e.value for e in SideEffectLevel} == {
        "none",
        "session_only",
        "draft_only",
        "persistent_mutation",
        "reversible_mutation",
        "external_io",
    }


def test_nine_workflow_tools_have_manifests():
    for tool in (
        "read_project_documentation",
        "analyze_construction_document",
        "parse_construction_budget",
        "classify_construction_element",
        "calculate_concrete_works",
        "create_work_breakdown",
        "find_urs_code",
        "find_otskp_code",
        "search_czech_construction_norms",
    ):
        assert get_manifest(tool) is not None, tool


def test_policy_stage_derived_from_yaml_not_manifest():
    """tool→stage is derived from the YAML, never stored on the manifest."""
    assert not hasattr(get_manifest("find_urs_code"), "policy_stage")
    assert stages_for_tool(CFG, "find_urs_code") == frozenset(
        {WorkflowState.CATALOG_BINDING}
    )
    assert stages_for_tool(CFG, "find_otskp_code") == frozenset(
        {WorkflowState.CATALOG_BINDING}
    )
    assert stages_for_tool(CFG, "create_work_breakdown") == frozenset(
        {WorkflowState.WORK_ATOMIZATION}
    )


def _auth_tool_costs():
    """Load TOOL_COSTS from auth.py source without importing it.

    app/mcp/auth.py imports bcrypt at module load, which is not installed in the
    minimal test sandbox. We only need the TOOL_COSTS literal, so parse it out of
    the source with AST rather than importing the module.
    """
    import ast
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "app" / "mcp" / "auth.py"
    tree = ast.parse(src.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "TOOL_COSTS":
                    return ast.literal_eval(node.value)
    return {}


def test_manifest_credits_match_auth_tool_costs():
    """Manifest credits stay in lockstep with auth.py TOOL_COSTS (no drift)."""
    tool_costs = _auth_tool_costs()
    assert tool_costs, "could not load TOOL_COSTS from auth.py"
    for name, manifest in _manifests().items():
        if name in tool_costs:
            assert manifest.credits == tool_costs[name], name


def _manifests():
    from app.services.stage_gating.tool_manifest import TOOL_MANIFESTS

    return TOOL_MANIFESTS


def test_registry_validation_passes_for_known_set():
    reg = {
        "find_otskp_code",
        "find_urs_code",
        "classify_construction_element",
        "calculate_concrete_works",
        "parse_construction_budget",
        "analyze_construction_document",
        "create_work_breakdown",
        "search_czech_construction_norms",
    }
    validate_registry(CFG, reg, exempt=set())  # must not raise


def test_registry_validation_fails_on_missing_manifest():
    """AC4 — a registered tool without a manifest makes validation raise."""
    with pytest.raises(RegistryValidationError):
        validate_registry(CFG, {"a_tool_with_no_manifest"}, exempt=set())


# ── Policy gateway error codes (AC6, AC7, AC8) ───────────────────────────────

def test_stage_violation_find_urs_in_work_atomization():
    """AC7 — find_urs_code in WORK_ATOMIZATION → STAGE_VIOLATION + audit entry."""
    audit_records = []
    decision = evaluate_tool_policy(
        tool_name="find_urs_code",
        config=CFG,
        session_id="sess-1",
        current_state=WorkflowState.WORK_ATOMIZATION,
        audit_hook=audit_records.append,
    )
    assert not decision.allowed
    assert decision.error_code == PolicyError.STAGE_VIOLATION
    assert len(audit_records) == 1
    rec = audit_records[0]
    assert rec["event"] == "STAGE_VIOLATION"
    assert rec["tool_name"] == "find_urs_code"
    assert rec["attempted_in_state"] == "WORK_ATOMIZATION"


def test_catalog_tool_allowed_in_catalog_binding():
    decision = evaluate_tool_policy(
        tool_name="find_urs_code",
        config=CFG,
        session_id="sess-1",
        current_state=WorkflowState.CATALOG_BINDING,
    )
    assert decision.allowed


def test_unknown_tool_refused():
    decision = evaluate_tool_policy(
        tool_name="no_such_tool",
        config=CFG,
        session_id="sess-1",
        current_state=WorkflowState.WORK_ATOMIZATION,
    )
    assert not decision.allowed
    assert decision.error_code == PolicyError.UNKNOWN_TOOL


def test_session_required_in_enforced_mode():
    """AC8 — requires_session tool, no session, enforced → SESSION_REQUIRED."""
    decision = evaluate_tool_policy(
        tool_name="create_work_breakdown",
        config=CFG,
        session_id=None,
        current_state=None,
        enforce_session=True,
    )
    assert not decision.allowed
    assert decision.error_code == PolicyError.SESSION_REQUIRED


def test_sessionless_call_allowed_when_not_enforced():
    """Opt-in model: no session_id + not enforced → allow (preserve behavior)."""
    decision = evaluate_tool_policy(
        tool_name="create_work_breakdown",
        config=CFG,
        session_id=None,
        current_state=None,
    )
    assert decision.allowed


def test_create_work_breakdown_allowed_in_work_atomization():
    decision = evaluate_tool_policy(
        tool_name="create_work_breakdown",
        config=CFG,
        session_id="sess-1",
        current_state=WorkflowState.WORK_ATOMIZATION,
    )
    assert decision.allowed


def test_create_work_breakdown_blocked_in_catalog_binding():
    decision = evaluate_tool_policy(
        tool_name="create_work_breakdown",
        config=CFG,
        session_id="sess-1",
        current_state=WorkflowState.CATALOG_BINDING,
    )
    assert not decision.allowed
    assert decision.error_code == PolicyError.STAGE_VIOLATION


def test_all_nine_states_resolve_some_allowlist():
    """Every workflow state is queryable; terminal states allow no gated tools."""
    for state in WorkflowState:
        allowed = CFG.tools_allowed_in(state)
        assert isinstance(allowed, frozenset)
    # find_otskp_code blocked everywhere except CATALOG_BINDING
    for state in WorkflowState:
        decision = evaluate_tool_policy(
            tool_name="find_otskp_code",
            config=CFG,
            session_id="s",
            current_state=state,
        )
        assert decision.allowed == (state == WorkflowState.CATALOG_BINDING), state


# ── Grounding-gate (Pattern 29) ──────────────────────────────────────────────

def test_grounding_marks_unsourced_unverified():
    items = [
        {"work_description": "Beton", "_source": "TZ §4.2"},
        {"work_description": "Bednění"},  # no _source
        {"work_description": "Výztuž", "_source": "   "},  # blank _source
    ]
    result = validate_grounding(items)
    assert result.verified_count == 1
    assert result.unverified_count == 2
    statuses = [i["verification_status"] for i in result.items]
    assert statuses[0] == GROUNDING_VERIFIED
    assert statuses[1] == GROUNDING_UNVERIFIED
    assert statuses[2] == GROUNDING_UNVERIFIED
    assert not result.all_verified


def test_grounding_reject_mode_pulls_unverified_out():
    items = [
        {"work_description": "Beton", "_source": "TZ §4.2"},
        {"work_description": "Bednění"},
    ]
    result = validate_grounding(items, reject_unverified=True)
    assert len(result.items) == 1
    assert len(result.rejected) == 1
    assert result.rejected[0]["work_description"] == "Bednění"


# ── create_work_breakdown work-first decoupling (AC19) ───────────────────────

def _run_breakdown(**kwargs):
    from app.mcp.tools import breakdown
    import app.mcp.tools.classifier as clf
    import app.mcp.tools.otskp as ot

    fake_profile = {
        "rebar_kg_m3": 120,
        "orientation": "vertical",
        "label_cs": "Pilíř",
    }

    class FakeCat:
        def search(self, q, limit=1):
            r = MagicMock()
            r.code = "317321"
            r.nazev = "X"
            r.cena = 100.0
            return [r]

    with patch.object(clf, "_classify", lambda n: {"element_type": "jine"}), patch.dict(
        clf.ELEMENT_TYPES, {"jine": fake_profile}, clear=False
    ), patch.object(ot, "_get_catalog", lambda: FakeCat()):
        elements = [{"name": "Pilíř P2", "volume_m3": 10, "concrete_class": "C30/37"}]
        return asyncio.run(breakdown.create_work_breakdown(elements, **kwargs))


def test_breakdown_work_first_is_default_and_codeless():
    """AC19 — default mode=work_first attaches no catalog codes/prices."""
    r = _run_breakdown()
    assert r["mode"] == "work_first"
    assert r["catalog_bound"] is False
    assert r["total_price_czk"] == 0
    assert all("otskp_code" not in i for i in r["items"])
    # every item is grounded with a _source (feeds the grounding-gate)
    assert all("_source" in i for i in r["items"])


def test_breakdown_work_with_catalog_attaches_codes():
    r = _run_breakdown(mode="work_with_catalog")
    assert r["mode"] == "work_with_catalog"
    assert r["catalog_bound"] is True
    assert any("otskp_code" in i for i in r["items"])


def test_breakdown_catalog_none_alias_forces_work_first():
    r = _run_breakdown(mode="work_with_catalog", catalog="none")
    assert r["mode"] == "work_first"
    assert r["catalog_bound"] is False
    assert all("otskp_code" not in i for i in r["items"])
