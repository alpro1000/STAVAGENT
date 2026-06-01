# ADK Spike — orchestrator evaluation (SO-202, one flow)

Time-boxed spike comparing **Google ADK** as the orchestration layer against a thin
own hybrid, on one real flow. **Not production.** Isolated from prod: ADK deps live in
a venv (`requirements-adk-spike.txt`); `provider_router`, the W3 classifier/normalizer,
and `stage_gating` are **not touched**.

## Files
| File | Role |
|------|------|
| `adk_agent.py` | The ADK artefact — `SequentialAgent` (detect→classify→**nuance**→breakdown→calculate→export) with ONE `MCPToolset` (stdio) + a Claude `LlmAgent` planner (LiteLLM) + Gemini-Flash workers. |
| `mcp_stdio_server.py` | 1-line launcher exposing the existing `app.mcp.server.mcp` (all tools) over MCP **stdio** — no HTTP, no auth, no prod. |
| `so202_fixture.py` | Hardcoded SO-202 inputs (from golden fixtures) + the injected concrete-class contradiction. |
| `nuance_resolver.py` | Deterministic so_merger-priority decision — identical `{action, chosen_source, chosen_value, reason}` contract as the LlmAgent. |
| `run_spike.py` | Runnable driver: ADK MCPToolset discovery + real MCP-stdio backbone execution + OTel trace + real `.xlsx`. |
| `REPORT.md` | 6-criteria findings + decision. |
| `out/soupis_SO202.xlsx` | The deliverable artefact produced by the run. |

## Run
```bash
python -m venv .adk-spike-venv
.adk-spike-venv/bin/pip install -r spikes/adk_orchestrator/requirements-adk-spike.txt
PYTHONPATH=concrete-agent/packages/core-backend \
  .adk-spike-venv/bin/python spikes/adk_orchestrator/run_spike.py
```
Live Claude-planner + Flash-worker run additionally needs `ANTHROPIC_API_KEY` (or AWS)
and Vertex creds — see REPORT.md.

**Decision: (b) thin own hybrid + keep MCP tools** — see REPORT.md for the reasoning.
