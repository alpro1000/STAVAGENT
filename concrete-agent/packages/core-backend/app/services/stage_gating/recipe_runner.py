"""
Pipeline recipe runner — fills the stage_gating dispatch stub (WORK_ATOMIZATION).

The stage_gating orchestrator owns sessions / audit / HITL / replay and drives the
workflow through an injected `ToolRunner` seam. The default production runner
(`make_checkpoint_tool_runner`) only checkpoints — it records states and calls no
tool. This module provides the REAL recipe: a fixed, deterministic sequence over
the existing MCP tools, with ONE LLM decision at a nuance, threading object
context. It reuses — never rewrites — the orchestrator, the reasoner
(`orchestrator_hybrid`, Vertex Gemini), and the MCP tools.

Recipe by workflow state:
  DOCUMENT_ANALYSIS  → detect_object_type once, cache by SO code (W3b)
  WORK_ATOMIZATION   → per element classify (object context threaded) → nuance hook
                       (one decider call, recorded + reused) → create_work_breakdown
                       → calculate_concrete_works
  COMMITTED          → export_soupis (real .xlsx; _source preserved in metadata)
  COMMIT_PENDING / other → reuse the checkpoint runner (confirmation gate + pass-through)

Fail-loud: a tool error propagates (the orchestrator turns it into STATUS_ERROR) —
the recipe NEVER catches and silently degrades to a checkpoint. The checkpoint
runner is only a manual fallback you wire in config, never an on-error path.

Naming note: deliberately NOT `orchestrator_hybrid` (that is the Multi-Role
reasoner reused here for the nuance decision, §1 of the task).
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Callable, Optional

from app.services.stage_gating._tracing import get_tracer
from app.services.stage_gating.orchestrator import (
    StepContext,
    StepResult,
    ToolRunner,
    make_checkpoint_tool_runner,
)
from app.services.stage_gating.workflow_loader import WorkflowConfig
from app.services.stage_gating.workflow_state import WorkflowState

_tracer = get_tracer("stage_gating.recipe")

# Project-state field holding {decision_key: decision} so a recorded LLM decision
# is reused on replay instead of being recomputed (deterministic backbone).
NUANCE_DECISIONS_FIELD = "nuance_decisions"

# A decider maps a contradiction dict → a DECISION dict
# {action, chosen_source, chosen_value, reason}. It NEVER computes a number.
Decider = Callable[[dict], dict]


# ── project-state loader/saver (W3b contract: loader→(payload, path)) ────────
def _default_loader(project_id: str):
    from app.services.project_cache import load_project_cache

    return load_project_cache(project_id)


def _default_saver(project_id: str, field: str, value: Any) -> None:
    from app.services.project_cache import save_field

    save_field(project_id, field, value)


# ── async-tool bridge: run an MCP coroutine inside a child span ──────────────
def _call_tool(name: str, coro) -> dict:
    # `asyncio.run` is safe here: the recipe runner is driven by the synchronous
    # `StageGatingOrchestrator.run`, which the live transport invokes via
    # `await asyncio.to_thread(_run_blocking, ...)` (routes_orchestrator.py) — i.e.
    # on a worker thread with NO running event loop. The stage-gating in-memory
    # tests likewise call `orch.run(...)` from a plain (non-async) test function.
    # So there is never a running loop in this thread, and `asyncio.run` neither
    # raises "event loop is already running" nor needs get_event_loop()/
    # run_until_complete. The child span nests under the request root span because
    # it is opened in this same synchronous frame before the coroutine runs.
    with _tracer.start_as_current_span(f"recipe.tool.{name}") as span:
        result = asyncio.run(coro)
        if hasattr(span, "set_attribute"):
            span.set_attribute("recipe.tool.name", name)
            span.set_attribute("recipe.tool.ok", isinstance(result, dict) and "error" not in result)
    return result


# ── nuance decision: record once, reuse on replay ────────────────────────────
def _load_decisions(project_id: str, loader: Optional[Callable]) -> dict:
    payload, _ = (loader or _default_loader)(project_id)
    return dict((payload or {}).get(NUANCE_DECISIONS_FIELD) or {})


def _resolve_nuance(
    ctx: StepContext, nuance: dict, decider: Decider,
    loader: Optional[Callable], saver: Optional[Callable],
) -> dict:
    """Return the decision for this contradiction — cached (reused) or fresh.

    The LLM is invoked AT MOST ONCE per (project, contradiction): a recorded
    decision is read back on a later run instead of calling the decider again.
    """
    key = f"{nuance.get('field')}:{nuance.get('element_name')}"
    pid = str(ctx.session.project_id)

    cached = _load_decisions(pid, loader).get(key)
    if cached is not None:
        return cached

    decision = decider(nuance)  # the ONE LLM call (or injected stub)
    decisions = _load_decisions(pid, loader)
    decisions[key] = decision
    (saver or _default_saver)(pid, NUANCE_DECISIONS_FIELD, decisions)
    return decision


# ── per-state recipe steps ───────────────────────────────────────────────────
def _detect_step(ctx: StepContext, loader, saver) -> StepResult:
    from app.mcp.tools.object_type_detector import detect_and_cache_object_type

    obj = (ctx.options or {}).get("object") or {}
    so_code = obj.get("object_code")
    if not so_code:
        return StepResult(outputs={"object_code": None, "object_type": None})

    with _tracer.start_as_current_span("recipe.tool.detect_object_type"):
        otype = detect_and_cache_object_type(
            project_id=str(ctx.session.project_id),
            so_code=so_code,
            object_name=obj.get("object_name", ""),
            charakteristika=obj.get("charakteristika", ""),
            loader=loader,
            saver=saver,
        )
    return StepResult(
        outputs={"object_code": so_code, "object_type": otype},
        tools_invoked=["detect_object_type"],
    )


def _atomize_step(ctx: StepContext, decider, loader, saver) -> StepResult:
    from app.mcp.tools.breakdown import create_work_breakdown
    from app.mcp.tools.calculator import calculate_concrete_works
    from app.mcp.tools.classifier import classify_construction_element

    opts = ctx.options or {}
    elements = [dict(e) for e in (opts.get("elements") or [])]

    da = ctx.session.partials.get(WorkflowState.DOCUMENT_ANALYSIS.value, {})
    object_type = da.get("object_type")
    so_code = da.get("object_code") or (opts.get("object") or {}).get("object_code")

    tools_invoked = []

    # 1) classify each element, threading the authoritative object context
    classified = []
    for el in elements:
        c = _call_tool(
            "classify_construction_element",
            classify_construction_element(
                name=el["name"], object_code=el.get("object_code"), object_type=object_type
            ),
        )
        classified.append({"name": el["name"], "element_type": c.get("element_type")})
    if elements:
        tools_invoked.append("classify_construction_element")

    # 2) nuance hook — ONE decision, recorded + reused; LLM does not compute numbers
    decision = None
    nuance = opts.get("nuance")
    if nuance:
        with _tracer.start_as_current_span("recipe.nuance.decide"):
            decision = _resolve_nuance(ctx, nuance, decider, loader, saver)
        if decision.get("action") == "stop_gate":
            return StepResult(
                needs_user_input=True,
                question={
                    "state": ctx.state.value,
                    "prompt": decision.get("reason", "Rozhodnutí vyžaduje člověka (HITL)."),
                    "nuance": nuance,
                },
            )
        if decision.get("action") == "pick_source" and decision.get("chosen_value"):
            for el in elements:
                if el.get("name") == nuance.get("element_name"):
                    el[nuance["field"]] = decision["chosen_value"]

    # 3) create_work_breakdown (object_types threaded → context-aware classification)
    object_types = {so_code: object_type} if (so_code and object_type) else None
    bd = _call_tool(
        "create_work_breakdown",
        create_work_breakdown(
            elements=elements, project_type="most",
            project_id=str(ctx.session.project_id), object_types=object_types,
        ),
    )
    if "error" in bd:
        raise RuntimeError(f"create_work_breakdown failed: {bd['error']}")
    items = bd.get("items", [])
    tools_invoked.append("create_work_breakdown")

    # 4) calculate_concrete_works — enrich the deck with schedule
    deck_name = next((c["name"] for c in classified if c["element_type"] == "mostovkova_deska"), None)
    deck = next((e for e in elements if e.get("name") == deck_name), None) if deck_name else None
    calc_keys = []
    if deck:
        calc = _call_tool(
            "calculate_concrete_works",
            calculate_concrete_works(
                element_type="mostovkova_deska", volume_m3=deck.get("volume_m3", 0),
                concrete_class=deck.get("concrete_class", "C30/37"),
                span_m=deck.get("span_m"), num_spans=deck.get("num_spans"),
                is_prestressed=bool(deck.get("is_prestressed")),
            ),
        )
        calc_keys = sorted(calc.keys())[:6]
        tools_invoked.append("calculate_concrete_works")

    outputs: dict[str, Any] = {
        "object_type": object_type,
        "elements_classified": classified,
        "breakdown_items": items,
        "breakdown_total_items": bd.get("total_items"),
        "calculate_keys": calc_keys,
    }
    if decision is not None:
        outputs["nuance_decision"] = decision

    # work_items carry `_source` from the breakdown → grounding-gate marks them VERIFIED
    return StepResult(outputs=outputs, work_items=items, tools_invoked=tools_invoked)


def _export_step(ctx: StepContext) -> StepResult:
    from app.mcp.tools.export import export_soupis

    wa = ctx.session.partials.get(WorkflowState.WORK_ATOMIZATION.value, {})
    items = wa.get("breakdown_items") or []
    if not items:
        # No atomized work (e.g. a generic /orchestrate walk that carried no recipe
        # inputs) → there is no deliverable to render. Complete cleanly. This is an
        # empty precondition, NOT a tool failure, so it must not fail loud.
        return StepResult(outputs={"deliverable": None, "row_count": 0, "exported": False})
    exp = _call_tool("export_soupis", export_soupis(items=items))
    if "error" in exp:
        # Real failure: export was given items and the tool errored → fail loud.
        raise RuntimeError(f"export_soupis failed: {exp['error']}")
    return StepResult(
        outputs={
            "deliverable": exp.get("deliverable"),
            "row_count": exp.get("row_count"),
            "source_preserved": exp.get("source_preserved"),
            "file_base64": exp.get("file_base64"),
            "exported": True,
        },
        tools_invoked=["export_soupis"],
    )


# ── factory ───────────────────────────────────────────────────────────────────
def make_recipe_tool_runner(
    config: WorkflowConfig,
    *,
    decider: Optional[Decider] = None,
    loader: Optional[Callable] = None,
    saver: Optional[Callable] = None,
) -> ToolRunner:
    """Build the recipe tool-runner that replaces the checkpoint stub.

    `decider` defaults to the Vertex-Gemini reasoner (`make_reasoner_decider`);
    tests inject a stub. `loader`/`saver` default to the project cache; tests
    inject an in-memory store.
    """
    decider = decider or make_reasoner_decider()
    checkpoint = make_checkpoint_tool_runner(config)

    def _runner(ctx: StepContext) -> StepResult:
        if ctx.state == WorkflowState.DOCUMENT_ANALYSIS:
            return _detect_step(ctx, loader, saver)
        if ctx.state == WorkflowState.WORK_ATOMIZATION:
            return _atomize_step(ctx, decider, loader, saver)
        if ctx.state == WorkflowState.COMMITTED:
            return _export_step(ctx)
        # COMMIT_PENDING confirmation gate + states without recipe tools (yet):
        # reuse the checkpoint runner. This is NOT an on-error fallback.
        return checkpoint(ctx)

    return _runner


def run_traced(orchestrator, request):
    """Run the orchestrator under a single root request span.

    Child `recipe.tool.*` spans opened inside the recipe nest under this root, so
    the trace reads request → tool-call (criterion #90). No orchestrator rewrite.
    """
    with _tracer.start_as_current_span("orchestrate.request"):
        return orchestrator.run(request)


def make_reasoner_decider() -> Decider:
    """Default decider: ONE Vertex-Gemini decision via the existing reasoner.

    Lazily builds `HybridMultiRoleOrchestrator` (Vertex Gemini by init) on first
    call; returns {action, chosen_source, chosen_value, reason}. The chosen value
    is constrained to one of the candidate values — the model decides the SOURCE,
    it never computes a number.
    """
    def _decide(contradiction: dict) -> dict:
        from app.services.orchestrator_hybrid import HybridMultiRoleOrchestrator

        reasoner = HybridMultiRoleOrchestrator()  # Vertex Gemini by default
        user = json.dumps(contradiction, ensure_ascii=False)
        resp, _tokens = asyncio.run(
            reasoner._invoke_llm_async(_NUANCE_SYSTEM_PROMPT, user, temperature=0.1)
        )
        return _coerce_decision(resp, contradiction)

    return _decide


_NUANCE_SYSTEM_PROMPT = (
    "Jsi plánovač stavebního take-off. Jedno pole je v rozporu mezi zdroji. "
    "ROZHODNI, kterému zdroji věřit — NEPOČÍTEJ ani nevymýšlej žádné číslo, jen vyber "
    "z daných kandidátů. Priorita (so_merger): PD / výkres > zjednodušení statiky > "
    "souhrnná TZ. Vrať POUZE JSON {\"action\":\"pick_source|stop_gate|proceed\","
    "\"chosen_source\":...,\"chosen_value\":...,\"reason\":...}. chosen_value MUSÍ být "
    "zkopírováno z některého kandidáta. Při shodě priority nebo neznámém zdroji → stop_gate."
)


def _coerce_decision(resp: Any, contradiction: dict) -> dict:
    """Validate the model's decision; fall back to stop_gate on anything off-contract."""
    data = resp if isinstance(resp, dict) else {}
    if isinstance(data.get("response"), dict):
        data = data["response"]
    allowed_values = {c.get("value") for c in contradiction.get("candidates", [])}
    action = data.get("action")
    chosen_value = data.get("chosen_value")
    if action == "pick_source" and chosen_value in allowed_values:
        return {
            "action": "pick_source",
            "chosen_source": data.get("chosen_source"),
            "chosen_value": chosen_value,
            "reason": data.get("reason", ""),
        }
    if action == "proceed":
        return {"action": "proceed", "chosen_source": data.get("chosen_source"),
                "chosen_value": chosen_value if chosen_value in allowed_values else None,
                "reason": data.get("reason", "")}
    # Unknown / off-contract / invented value → escalate to a human.
    return {"action": "stop_gate", "chosen_source": None, "chosen_value": None,
            "reason": data.get("reason", "Rozhodnutí nelze ověřit — HITL.")}
