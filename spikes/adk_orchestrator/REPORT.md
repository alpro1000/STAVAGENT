# ADK Spike — Report (SO-202 one-flow orchestration)

**Date:** 2026-06-01 · **Branch:** `claude/adk-spike-orchestrator` (off #1278) · **Time-boxed.**
**Scope:** evaluate Google ADK as the orchestration layer on ONE real flow. Nothing
in prod touched (provider_router, W3 classifier/normalizer, stage_gating untouched;
ADK deps isolated in a venv / `requirements-adk-spike.txt`).

## What actually ran (this sandbox, no model credentials)

```
detect_object_type → classify (×5 elements) → [nuance decision] → create_work_breakdown
→ calculate_concrete_works → export_soupis → REAL soupis_SO202.xlsx (22 items)
```

- **ADK `MCPToolset` over stdio** attached the existing FastMCP server unmodified and
  `get_tools()` discovered all 5 tools: `classify_construction_element,
  calculate_concrete_works, create_work_breakdown, detect_object_type, export_soupis`.
- The backbone executed over the **real MCP stdio transport**, each tool-call in an
  **OpenTelemetry span nested under a root request span** (`adk_spike.so202.flow` →
  9 child `mcp.tool.*` spans).
- The **nuance** (concrete-class contradiction on `Pilíře P2-P3`: PD/výkres `C35/45`
  vs zjednodušení statiky `C30/37`) was resolved to a **decision** —
  `{action: pick_source, chosen_source: PD_vykres, chosen_value: C35/45, reason: …}` —
  by the so_merger priority rule. **No number was computed by the decider.**
- Real Excel written: `out/soupis_SO202.xlsx` (2 sheets, 22 rows; `Kód`/`Zdroj`
  columns clean — no fabricated codes, grounding `_source` kept in metadata).

**Not run live (needs credentials, not present here):** the Claude `LlmAgent` planner
call and the Gemini-Flash worker calls. Both are **wired and construct cleanly** in
`adk_agent.py` (the `SequentialAgent` builds with 6 steps). In this sandbox the nuance
took the **deterministic so_merger-priority path** (identical output contract to the
LlmAgent), clearly logged as `path: deterministic_so_merger_priority`.

## 6-criteria findings

| # | Criterion | Finding (from the run, not theory) |
|---|-----------|-----------------------------------|
| 1 | **FastMCP→ADK MCPToolset friction** | **Very low.** One `MCPToolset(StdioConnectionParams(StdioServerParameters(command, args)), tool_filter=[…])` (~12 lines) + a 1-line stdio launcher (`mcp.run(transport="stdio")` over the existing `app.mcp.server.mcp`). Zero tool-code changes; all 5 schemas discovered. The auth-gated `/mcp/` HTTP path is avoided entirely via stdio. |
| 2 | **Multi-provider (Claude planner + Flash workers)** | ADK composes both **in one graph** via per-agent `model=`: Gemini-Flash native (Vertex), **Claude via `LiteLlm("anthropic/…"` or `"bedrock/…")`**. Construction verified; **not executed live** (no creds). Matches infra reality: the app's `provider_router` serves Claude via **Bedrock/Anthropic, never Vertex** (Vertex = Gemini only) — so ADK needs LiteLLM for Claude. (Claude-on-Vertex via Model Garden also exists → a single Vertex backend could serve both, fewer creds but more Google lock-in.) **ADK does NOT reuse `provider_router`** — the Claude/Flash split is re-declared per agent. |
| 3 | **HITL / STOP-gate vs your stage_gating** | ADK expresses the gate as an agent **decision** (`action=stop_gate` → halt before breakdown) and has callback/HITL hooks. But it has **no equivalent of your stage_gating's durable sessions + append-only audit + replay + `RE_EXPORT_ALLOW_LIST`/terminal-state policy**. ADK = ergonomic agent-level HITL; your stage_gating = auditable/replayable workflow gate. Different layers — adopting ADK would **not** remove the need for stage_gating. |
| 4 | **Observability (OTel)** | **Strong, real.** ADK is OTel-native; the spike emitted a genuine nested trace (root flow → per-tool spans) with tool name/args/ok attributes. Prod would swap `ConsoleSpanExporter` for an OTLP→Cloud Trace exporter — no code change to the spans. This is a clear ADK win. |
| 5 | **Code/effort vs ~300-line own hybrid** | The ADK-specific orchestration (`adk_agent.py`) is ~130 LOC and yields SequentialAgent + per-step models + MCP attach + OTel "for free". **But** the run-driver proved the same wins are reachable directly: MCP attach via the `mcp` SDK (~15 lines) + OTel via the SDK (~5 lines). An own ~300-line hybrid (Sonnet planner → decision → deterministic tool dispatch) buys **native integration with existing stage_gating + provider_router** and **no new heavy dependency**. |
| 6 | **Lock-in surface** | Tools (MCP) and models (LiteLLM) stay **portable**. Lock-in concentrates in the **agent-graph layer** (`SequentialAgent`/`LlmAgent`) + Vertex-leaning deploy/telemetry. Migrating off ADK = rewriting the orchestration layer (the tools and the deterministic engines are untouched). Moderate, contained. |

## Decision

**Recommendation: (b) build the thin own hybrid for the planner/orchestrator, keep the
MCP tools.** Reasoning from the measurements, not theory:

1. ADK's two strongest wins here — **clean MCP attach** and **OTel tracing** — were both
   reproduced directly in this spike's run-driver in **~20 lines total** (`mcp`
   ClientSession + OpenTelemetry SDK). They are not ADK-exclusive.
2. ADK **does not integrate** with the project's already-shipped, battle-tested
   `stage_gating` (durable sessions, audit, replay, export allow-list) or
   `provider_router`. Adopting ADK means running a **parallel** orchestration/policy
   stack or replacing prod machinery that is explicitly out of scope to touch.
3. The nuance the LLM must handle is fundamentally **"one Sonnet call → a routing
   decision"** — a few dozen lines that plug straight into `provider_router`
   (`TaskType.CONTRADICTION`/`HEAVY_ANALYSIS`) and `stage_gating`. ADK's graph
   abstraction is more than this problem needs and adds lock-in at exactly that layer.

**When (a) ADK would win instead:** if the roadmap moves to **multi-agent**
orchestration beyond a linear recipe, wants **managed Vertex agent deployment**, and is
willing to standardize on the Google agent ecosystem (accepting graph-layer lock-in).
For the current single-flow, deterministic-backbone-+-one-decision need, the thin hybrid
is the better fit.

**Either way (audit backlog, provider-agnostic):** `detect_object_type` + `export_soupis`
are now real MCP tools (#1278); `extract_vymery` still needs promoting; `read_project_documentation`
dead tool removed (#1278); ELEMENT_TYPES(22)↔WORK_TEMPLATES(9) drift and grounding-gate
hardening remain.

## Reproduce

```bash
python -m venv .adk-spike-venv
.adk-spike-venv/bin/pip install -r spikes/adk_orchestrator/requirements-adk-spike.txt
PYTHONPATH=concrete-agent/packages/core-backend \
  .adk-spike-venv/bin/python spikes/adk_orchestrator/run_spike.py
# → out/soupis_SO202.xlsx + nested OTel trace on stdout
```
To exercise the live Claude planner + Flash workers, set `ANTHROPIC_API_KEY` (or AWS
creds) and Vertex creds (`GOOGLE_GENAI_USE_VERTEXAI=TRUE` + ADC/project), then run the
`build_root_agent()` graph from `adk_agent.py` via an ADK `Runner`.
