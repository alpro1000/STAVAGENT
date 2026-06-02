"""
Thin-hybrid pipeline orchestrator — recipe runner (TASK_ThinHybrid_PipelineOrchestrator).

Replaces the stage_gating dispatch STUB (make_checkpoint_tool_runner — records
states, calls no tool) with a deterministic RECIPE that drives the MCP tools and
fires ONE injectable LLM decision at a nuance, threading object context. Reuses
stage_gating (sessions/audit/HITL/replay) and the reasoner — does not rewrite them.

Skip-proof, like test_mcp_golden_so250b.py: plain sync test_* functions, no
@pytest.mark.asyncio, no fastmcp/app.mcp.server import. The decider is an injected
stub (counting), so #87/#91 run with NO model credentials. A missing dep ERRORS
(red), never silently skips.

Criteria §4:
  #85 dispatch stub replaced — recipe really invokes tools (tools_invoked populated)
  #86 object context detected once + threaded → generic "Dřík" reaches driky_piliru
      (RED base = operna_zed without context)
  #87 nuance hook makes ONE decider call → {action,chosen_source,chosen_value,reason}
  #88 action=stop_gate raises HITL via stage_gating (paused, session intact)
  #89 flow reaches export_soupis → real Excel; _source preserved (metadata)
  #90 OTel: one root request span + a child span per tool-call
  #91 replay: decision recorded + reused — decider called EXACTLY ONCE across two runs
  #92 LLM decision via the reasoner (Vertex Gemini), not Bedrock; no AWS creds → no crash
"""

import base64
import os
import sys
from io import BytesIO
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.stage_gating import (
    InMemorySessionRepository,
    OrchestrateRequest,
    SessionManager,
    StageGatingOrchestrator,
    WorkflowState,
    load_workflow_config,
)
from app.services.stage_gating.orchestrator import STATUS_COMPLETED, STATUS_PAUSED
from app.services.stage_gating.recipe_runner import make_recipe_tool_runner, run_traced

CFG = load_workflow_config()

# ── SO-202 ready structures (from golden fixtures; extract layer is the next task) ─
SO202_OBJECT = {
    "object_code": "SO-202",
    "object_name": "Most na sil. I/6 přes Lomnický potok",
    "charakteristika": "Trvalý dálniční most o třech polích.",
}
SO202_ELEMENTS = [
    {"name": "NK mostovka", "object_code": "SO-202", "volume_m3": 605,
     "concrete_class": "C35/45", "is_prestressed": True, "span_m": 20, "num_spans": 6},
    # The #86 subject: a GENERIC name that only classifies right WITH object context.
    {"name": "Dřík", "object_code": "SO-202", "volume_m3": 20, "concrete_class": "C35/45"},
    {"name": "Piloty OP1 Ø900", "object_code": "SO-202", "volume_m3": 50.9,
     "concrete_class": "C30/37"},
]
# Injected concrete-class contradiction on one element (PD vs simplified statics).
SO202_NUANCE = {
    "field": "concrete_class",
    "element_name": "Dřík",
    "candidates": [
        {"value": "C35/45", "source": "PD_vykres"},
        {"value": "C30/37", "source": "statika_zjednoduseni"},
    ],
}

PICK_DECISION = {
    "action": "pick_source",
    "chosen_source": "PD_vykres",
    "chosen_value": "C35/45",
    "reason": "PD/výkres > zjednodušení statiky (so_merger priority).",
}
STOP_DECISION = {
    "action": "stop_gate",
    "chosen_source": None,
    "chosen_value": None,
    "reason": "Sources tie at equal priority — HITL.",
}


class FakeStore:
    """In-memory project store with the W3b loader/saver contract (no disk)."""

    def __init__(self):
        self.data: dict = {}

    def loader(self, project_id):
        return self.data.get(project_id), f"/fake/{project_id}"

    def saver(self, project_id, field, value):
        self.data.setdefault(project_id, {})[field] = value


class CountingDecider:
    def __init__(self, decision):
        self.decision = decision
        self.calls = 0

    def __call__(self, contradiction):
        self.calls += 1
        return dict(self.decision)


def _options(with_nuance=True):
    opts = {"object": dict(SO202_OBJECT), "elements": [dict(e) for e in SO202_ELEMENTS]}
    if with_nuance:
        opts["nuance"] = dict(SO202_NUANCE)
    return opts


def _orchestrator(decider, store, repo):
    mgr = SessionManager(repo, config=CFG)
    runner = make_recipe_tool_runner(
        CFG, decider=decider, loader=store.loader, saver=store.saver
    )
    return StageGatingOrchestrator(manager=mgr, config=CFG, tool_runner=runner)


def _run(decider=None, store=None, repo=None, options=None, project_id=None,
         confirmation_token="ok"):
    store = store or FakeStore()
    repo = repo or InMemorySessionRepository()
    decider = decider or CountingDecider(PICK_DECISION)
    orch = _orchestrator(decider, store, repo)
    res = orch.run(OrchestrateRequest(
        user_id=uuid4(), project_id=project_id or uuid4(),
        options=options if options is not None else _options(),
        confirmation_token=confirmation_token,
    ))
    return res, decider, store, repo


def _partials(repo, res, state_value):
    state = repo.get(res.session_id)
    return (state.partials.get(state_value) or {}) if state else {}


# ── #85 — dispatch stub replaced: tools are really invoked ────────────────────

def test_85_recipe_invokes_real_tools():
    res, _, _, _ = _run()
    assert res.status == STATUS_COMPLETED, res.error
    atom = next(s for s in res.steps if s["state"] == "WORK_ATOMIZATION")
    # The checkpoint stub left tools_invoked EMPTY; the recipe must populate it.
    assert "create_work_breakdown" in atom["tools_invoked"], atom
    assert "classify_construction_element" in atom["tools_invoked"], atom


# ── #86 — object context detected once + threaded: generic Dřík → driky_piliru ─

def test_86_object_context_makes_generic_drik_a_pier():
    res, _, store, repo = _run()
    classified = _partials(repo, res, "WORK_ATOMIZATION")["elements_classified"]
    types = {c["name"]: c["element_type"] for c in classified}
    assert types["Dřík"] == "driky_piliru", types  # GREEN via threaded bridge context
    # object_type was detected once and cached by SO code.
    assert any(v.get("object_types", {}).get("SO-202") == "bridge"
               for v in store.data.values()), store.data


def test_86_red_base_without_context_is_operna_zed():
    """Documents the gap #86 closes: the live classifier with NO object context."""
    import asyncio
    from app.mcp.tools.classifier import classify_construction_element
    r = asyncio.run(classify_construction_element(name="Dřík", object_code="SO-202"))
    assert r["element_type"] == "operna_zed", r


# ── #87 — nuance hook: exactly ONE decider call, structured decision ──────────

def test_87_nuance_makes_one_decision_no_numbers():
    decider = CountingDecider(PICK_DECISION)
    res, decider, _, repo = _run(decider=decider)
    assert decider.calls == 1, decider.calls
    decision = _partials(repo, res, "WORK_ATOMIZATION")["nuance_decision"]
    assert decision["action"] == "pick_source"
    assert decision["chosen_value"] == "C35/45"
    # The chosen value is one of the candidates — the LLM did not invent a number.
    assert decision["chosen_value"] in {"C35/45", "C30/37"}


# ── #88 — stop_gate raises HITL via stage_gating (paused, session intact) ──────

def test_88_stop_gate_pauses_via_stage_gating():
    decider = CountingDecider(STOP_DECISION)
    res, _, _, _ = _run(decider=decider)
    assert res.status == STATUS_PAUSED, res
    assert res.workflow_state == WorkflowState.WORK_ATOMIZATION
    assert res.question is not None


# ── #89 — flow reaches export → real Excel; _source preserved ─────────────────

def test_89_export_produces_real_xlsx_with_source_preserved():
    res, _, _, repo = _run()
    assert res.status == STATUS_COMPLETED, res.error
    committed = _partials(repo, res, "COMMITTED")
    assert committed.get("source_preserved") is True, committed
    raw = base64.b64decode(committed["file_base64"])
    import openpyxl
    wb = openpyxl.load_workbook(BytesIO(raw))
    assert "Soupis prací" in wb.sheetnames
    # work_items carried _source (grounding-gate marked them verified, not rejected).
    atom = next(s for s in res.steps if s["state"] == "WORK_ATOMIZATION")
    assert atom.get("work_items_verified", 0) > 0
    assert atom.get("work_items_unverified", 0) == 0


# ── #90 — OTel: one root request span + a child span per tool-call ────────────

def test_90_otel_root_and_child_spans():
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

    provider = TracerProvider()
    exporter = InMemorySpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    store, repo = FakeStore(), InMemorySessionRepository()
    orch = _orchestrator(CountingDecider(PICK_DECISION), store, repo)
    res = run_traced(orch, OrchestrateRequest(
        user_id=uuid4(), project_id=uuid4(), options=_options(), confirmation_token="ok",
    ))
    assert res.status == STATUS_COMPLETED, res.error

    spans = exporter.get_finished_spans()
    roots = [s for s in spans if s.parent is None]
    assert len(roots) == 1, [s.name for s in spans]
    assert roots[0].name == "orchestrate.request"
    tool_spans = [s for s in spans if s.name.startswith("recipe.tool.")]
    assert tool_spans, [s.name for s in spans]
    root_id = roots[0].context.span_id
    assert all(s.parent.span_id == root_id for s in tool_spans)


# ── #91 — replay: decider called EXACTLY ONCE across two runs ──────────────────

def test_91_replay_reuses_decision_decider_called_once():
    store = FakeStore()           # shared across both runs (project-scoped cache)
    decider = CountingDecider(PICK_DECISION)
    pid = uuid4()                 # same project → same decision key

    res1, _, _, repo1 = _run(decider=decider, store=store, project_id=pid)
    res2, _, _, repo2 = _run(decider=decider, store=store, project_id=pid)

    assert res1.status == res2.status == STATUS_COMPLETED
    assert decider.calls == 1, f"decider must be called once across two runs, was {decider.calls}"
    assert _partials(repo1, res1, "WORK_ATOMIZATION")["nuance_decision"]["chosen_value"] == \
        _partials(repo2, res2, "WORK_ATOMIZATION")["nuance_decision"]["chosen_value"]


# ── #92 — Vertex (Gemini) reasoner, not Bedrock; no AWS creds → no crash ──────

def test_92_reasoner_is_vertex_not_bedrock():
    import app.services.stage_gating.recipe_runner as rr
    src = open(rr.__file__, encoding="utf-8").read()
    assert "boto3" not in src and "bedrock" not in src.lower(), "recipe must not touch Bedrock"
    assert callable(rr.make_reasoner_decider())


def test_92_runs_without_aws_credentials():
    for v in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
        assert not os.environ.get(v)  # sandbox has none
    res, _, _, _ = _run()  # stub decider → no real LLM; must not crash
    assert res.status == STATUS_COMPLETED, res.error


# ── regression: generic walk with NO recipe inputs completes (empty pipeline) ──
# Mirrors the live /orchestrate full-takeoff walk that carries no SO-202 options:
# empty elements → empty breakdown → export has nothing to render. That is an
# empty precondition, NOT a tool failure, so the recipe must COMPLETE (the export
# step skips), not fail loud. Guards the pr3b endpoint contract.

def test_generic_walk_without_inputs_completes():
    res, _, _, _ = _run(options={})
    assert res.status == STATUS_COMPLETED, res.error
    committed = next((s for s in res.steps if s["state"] == "COMMITTED"), None)
    assert committed is not None  # reached the end without erroring
