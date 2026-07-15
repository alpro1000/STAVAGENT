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

from app.models.item_schemas import ElementQuantityStatus
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

# Curated calculator-output subset carried onto a work-item (§2 interview:
# resource quantities + schedule metrics; the full PlannerOutput goes to the
# deliverable metadata, not duplicated per row). Warnings ride alongside in
# `calc_warnings`. Keys absent from the engine output stay absent (honest-blank).
_CALC_SUBSET_KEYS = ("total_days", "num_tacts", "resources")


def _calc_subset(calc: dict, *, element_name: str) -> dict:
    """Pick the curated, source-grounded subset of a PlannerOutput for a work-item.

    A carried number is traceable to the calc/element it came from (`_source`),
    consistent with the work-item `_source` provenance — the numeric chain becomes
    as replayable as the work provenance. NEVER fabricates: a missing key is simply
    absent, never defaulted to a number.
    """
    subset = {k: calc[k] for k in _CALC_SUBSET_KEYS if k in calc}
    subset["_source"] = (
        f"calculator:{element_name} ← {calc.get('source', 'monolit_planner_api')}"
    )
    return subset


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
def _document_analysis_step(ctx: StepContext, loader, saver) -> StepResult:
    """DOCUMENT_ANALYSIS: detect + cache the object type, and — when documents are
    supplied — extract TZ elements + parse the soupis, JOIN the soupis quantities
    into elements[] (P1 `map_soupis_to_elements`), and cache the quantified list
    plus a `quantification_summary`. WORK_ATOMIZATION consumes the quantified
    elements; it falls back to `options['elements']` when no documents were given
    (full back-compat with the pre-P2 contract).

    Soupis↔TZ volume divergences are surfaced as INGEST findings with an explicit
    `origin: "ingest:soupis_vs_geometry"`, never folded into the calculator's
    `calc_warnings` — they reach the deliverable on the same warning surface but
    keep their own identity (the P2 pin-A constraint).
    """
    from app.mcp.tools.object_type_detector import detect_and_cache_object_type

    opts = ctx.options or {}
    obj = opts.get("object") or {}
    so_code = obj.get("object_code")

    object_type = None
    tools_invoked: list[str] = []
    if so_code:
        with _tracer.start_as_current_span("recipe.tool.detect_object_type"):
            object_type = detect_and_cache_object_type(
                project_id=str(ctx.session.project_id),
                so_code=so_code,
                object_name=obj.get("object_name", ""),
                charakteristika=obj.get("charakteristika", ""),
                loader=loader,
                saver=saver,
            )
        tools_invoked.append("detect_object_type")

    outputs: dict[str, Any] = {"object_code": so_code, "object_type": object_type}

    # Documents → quantified elements[] (the seam P1's join was built for).
    documents = opts.get("documents") or {}
    if documents:
        quantified, summary, q_warnings, doc_tools = _quantify_from_documents(
            documents, object_type
        )
        tools_invoked.extend(doc_tools)
        if quantified is not None:
            outputs["elements"] = quantified
            outputs["quantification_summary"] = summary
            if q_warnings:
                outputs["quantification_warnings"] = q_warnings

    return StepResult(outputs=outputs, tools_invoked=tools_invoked)


def _quantify_from_documents(documents: dict, object_type: Optional[str]):
    """Extract TZ elements + parse the soupis, then JOIN the soupis quantities
    into the element list. Returns
    `(quantified_elements | None, summary, ingest_warnings, tools_invoked)`.

    The classifier's deterministic sync core (`_classify`) is the join seam — no
    LLM, reproducible. `None` quantified means no TZ text was supplied (nothing to
    build an element list from); the caller then leaves `options['elements']` to
    drive WORK_ATOMIZATION unchanged.
    """
    from app.mcp.tools.budget import parse_construction_budget
    from app.mcp.tools.classifier import _classify
    from app.mcp.tools.extract_tz_fields import extract_tz_fields
    from app.services.chunked_tz_extraction import (
        _CHUNK_THRESHOLD_CHARS,
        extract_tz_elements_chunked,
    )
    from app.services.stage_gating.soupis_quantity_join import map_soupis_to_elements

    tools: list[str] = []
    tz_text = documents.get("tz_text")
    tz_b64 = documents.get("tz_file_base64")
    if not tz_text and not tz_b64:
        return None, None, None, tools

    # Long TZ full-text → chunk it and run extract_tz_fields PER CHUNK, merging the
    # per-chunk element lists by element identity (recon failure-mode A/B/C cure),
    # before the SAME deterministic join. A base64 PDF or a short text stays on the
    # single-pass extractor (the chunker would only add boundary risk for no gain).
    if tz_text and len(tz_text) > _CHUNK_THRESHOLD_CHARS:
        tz = _call_tool(
            "extract_tz_fields_chunked",
            extract_tz_elements_chunked(text=tz_text),
        )
        tools.append("extract_tz_fields_chunked")
    else:
        tz = _call_tool(
            "extract_tz_fields",
            extract_tz_fields(
                text=tz_text, file_base64=tz_b64, filename=documents.get("tz_filename", "")
            ),
        )
        tools.append("extract_tz_fields")
    if "error" in tz:
        raise RuntimeError(f"extract_tz_fields failed: {tz['error']}")
    tz_elements = tz.get("elements") or []
    geometry = (tz.get("object") or {}).get("geometry")

    parsed_budget: dict = {"items": []}
    soupis_b64 = documents.get("soupis_file_base64")
    if soupis_b64:
        parsed_budget = _call_tool(
            "parse_construction_budget",
            parse_construction_budget(
                file_base64=soupis_b64,
                filename=documents.get("soupis_filename", "soupis.xlsx"),
            ),
        )
        tools.append("parse_construction_budget")
        if "error" in parsed_budget:
            raise RuntimeError(f"parse_construction_budget failed: {parsed_budget['error']}")

    quantified = map_soupis_to_elements(
        parsed_budget, tz_elements, geometry,
        classify=_classify, object_type=object_type,
    )
    summary, q_warnings = _summarize_quantification(quantified)
    return quantified, summary, q_warnings, tools


def _summarize_quantification(quantified: list):
    """Counts by `quantity_status` + structured INGEST divergence warnings.

    Each divergence warning carries an explicit `origin` so it never masquerades
    as a calculator warning when it reaches the deliverable alongside
    `calc_warnings` — shared surface, distinct identity.
    """
    # NOTE (recon 2026-07-15): COLLAPSED_INTO_SIBLING deliberately stays outside
    # this counter — adding it changes the `quantification_summary` shape
    # (behavioral), tracked as its own BACKLOG ticket; the enum step is
    # vocabulary-only.
    counts = {
        ElementQuantityStatus.EXTRACTED.value: 0,
        ElementQuantityStatus.MISSING.value: 0,
        ElementQuantityStatus.AMBIGUOUS.value: 0,
    }
    divergences: list[dict] = []
    q_warnings: list[dict] = []
    for el in quantified:
        st = el.get("quantity_status")
        if st in counts:
            counts[st] += 1
        div = el.get("quantity_divergence")
        if div:
            name = el.get("name")
            divergences.append({"element_name": name, **div})
            prefix = "⛔ KRITICKÉ" if div.get("severity") == "critical" else "⚠️"
            q_warnings.append({
                "origin": "ingest:soupis_vs_geometry",
                "severity": div.get("severity"),
                "element_name": name,
                "message": (
                    f"{prefix}: {name} — soupis {div.get('soupis_m3')} m³ vs "
                    f"geometrie ~{div.get('geometry_expected_m3')} m³ "
                    f"(poměr {div.get('ratio')})"
                ),
            })
    summary = {**counts, "divergent": len(divergences), "divergences": divergences}
    return summary, q_warnings


def _atomize_step(ctx: StepContext, decider, loader, saver) -> StepResult:
    from app.mcp.tools.breakdown import create_work_breakdown
    from app.mcp.tools.calculator import calculate_concrete_works
    from app.mcp.tools.classifier import classify_construction_element

    opts = ctx.options or {}
    da = ctx.session.partials.get(WorkflowState.DOCUMENT_ANALYSIS.value, {})

    # Elements come from DOCUMENT_ANALYSIS (quantified by the soupis→element join)
    # when documents were supplied; otherwise fall back to caller-supplied
    # options['elements'] (full back-compat with the pre-P2 contract).
    da_elements = da.get("elements")
    source_elements = da_elements if da_elements is not None else (opts.get("elements") or [])
    elements = [dict(e) for e in source_elements]

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
        classified.append({
            "name": el["name"],
            "element_type": c.get("element_type"),
            # classification confidence is no longer dropped at the seam
            "classification_confidence": c.get("confidence"),
            "classification_source": c.get("classification_source"),
        })
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

    # 4) calculate_concrete_works — the engine's output is NO LONGER discarded.
    #    Its curated subset + warnings are carried onto the calculated element's
    #    work-items; the full PlannerOutput is kept in the step metadata
    #    (replayable). Elements the engine does not compute stay honest-blank
    #    (calc=None, calc_status="not_calculated") from the breakdown contract.
    deck_name = next((c["name"] for c in classified if c["element_type"] == "mostovkova_deska"), None)
    deck = next((e for e in elements if e.get("name") == deck_name), None) if deck_name else None
    calc_keys = []
    calc_metadata: Optional[dict] = None
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
        tools_invoked.append("calculate_concrete_works")
        calc_keys = sorted(calc.keys())[:6]
        if "error" in calc:
            # Honest-blank: the engine failed (unavailable / invalid input). Do NOT
            # invent numbers — items keep calc_status="not_calculated"; the failure
            # is recorded in metadata so the gap is visible, not silent.
            calc_metadata = {
                "element_name": deck_name, "element_type": "mostovkova_deska",
                "status": "error", "error": calc.get("error"), "warnings": [],
            }
        else:
            subset = _calc_subset(calc, element_name=deck_name)
            warnings = list(calc.get("warnings") or [])
            for it in items:
                if it.get("element_name") == deck_name:
                    it["calc"] = subset
                    it["calc_status"] = "computed"
                    it["calc_warnings"] = warnings
            # Full PlannerOutput → deliverable metadata (replayable), not per-row.
            # Carries its own `_source` so the raw stash is provenance-grounded —
            # a replay knows which element/engine produced it (AC3), same as the
            # per-row calc subset.
            calc_metadata = {
                "element_name": deck_name, "element_type": "mostovkova_deska",
                "status": "computed", "raw": calc, "warnings": warnings,
                "_source": subset["_source"],
            }

    outputs: dict[str, Any] = {
        "object_type": object_type,
        "elements_classified": classified,
        "breakdown_items": items,
        "breakdown_total_items": bd.get("total_items"),
        "calculate_keys": calc_keys,
    }
    if calc_metadata is not None:
        outputs["calc_metadata"] = calc_metadata
    if decision is not None:
        outputs["nuance_decision"] = decision

    # work_items carry `_source` from the breakdown → grounding-gate marks them VERIFIED
    return StepResult(outputs=outputs, work_items=items, tools_invoked=tools_invoked)


def _export_step(ctx: StepContext) -> StepResult:
    from app.mcp.tools.export import export_soupis

    da = ctx.session.partials.get(WorkflowState.DOCUMENT_ANALYSIS.value, {})
    wa = ctx.session.partials.get(WorkflowState.WORK_ATOMIZATION.value, {})
    items = wa.get("breakdown_items") or []

    # INGEST quantification provenance rides to the COMMITTED deliverable next to
    # the calc metadata, with its own identity — `quantification_warnings` is
    # NEVER folded into `calc_warnings` (pin-A: shared surface, distinct origin).
    quant: dict[str, Any] = {}
    if da.get("quantification_summary") is not None:
        quant["quantification_summary"] = da["quantification_summary"]
    if da.get("quantification_warnings"):
        quant["quantification_warnings"] = da["quantification_warnings"]

    if not items:
        # No atomized work (e.g. a generic /orchestrate walk that carried no recipe
        # inputs) → there is no deliverable to render. Complete cleanly. This is an
        # empty precondition, NOT a tool failure, so it must not fail loud.
        return StepResult(
            outputs={"deliverable": None, "row_count": 0, "exported": False, **quant}
        )
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
            # carried calculator output reaches the COMMITTED deliverable metadata
            "calc_summary": exp.get("calc_summary"),
            "calc_warnings": exp.get("calc_warnings"),
            "exported": True,
            **quant,
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
            return _document_analysis_step(ctx, loader, saver)
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
