"""
ADK Spike — runnable end-to-end driver for the SO-202 flow.

What this actually does in a credential-less sandbox:
  1. Attaches the existing FastMCP tools through ADK's `MCPToolset` over stdio and
     lists them  → LIVE evidence for criterion #1 (connection friction).
  2. Executes the backbone over the REAL MCP stdio transport (official mcp
     ClientSession.call_tool), each step in an OpenTelemetry span (criterion #4):
         detect → classify(per element) → [nuance decision] → breakdown
         → calculate → export_soupis → real .xlsx
  3. Injects the SO-202 concrete-class contradiction and resolves it by the
     so_merger priority. The Claude `LlmAgent` planner (adk_agent.py) is the
     intended decider; when no ANTHROPIC/Vertex creds are present it is NOT
     called and the deterministic equivalent (nuance_resolver, identical
     contract) runs instead — clearly logged.
  4. Construct-only check of the full ADK SequentialAgent graph (proves wiring;
     a live agent run additionally needs model creds).

Run (from repo root, in the spike venv):
    PYTHONPATH=concrete-agent/packages/core-backend \
      .adk-spike-venv/bin/python spikes/adk_orchestrator/run_spike.py
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from so202_fixture import SO202_OBJECT, SO202_ELEMENTS, NUANCE_CONTRADICTION, NUANCE_ELEMENT_NAME
from nuance_resolver import resolve_contradiction

# ── OpenTelemetry: real console traces (criterion #4) ─────────────────────────
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter

trace.set_tracer_provider(TracerProvider())
trace.get_tracer_provider().add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
tracer = trace.get_tracer("adk_spike.so202")

# ── MCP stdio client (official SDK — the same transport ADK MCPToolset uses) ──
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

_STDIO_SERVER = os.path.join(_HERE, "mcp_stdio_server.py")
_SERVER_PARAMS = StdioServerParameters(command=sys.executable, args=[_STDIO_SERVER])
_OUT_DIR = os.path.join(_HERE, "out")


def _unwrap(result) -> dict:
    """Pull the tool's dict out of an MCP CallToolResult."""
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict):
        # FastMCP wraps a plain return under {"result": ...} sometimes.
        return sc.get("result", sc) if set(sc.keys()) == {"result"} else sc
    content = getattr(result, "content", None) or []
    for block in content:
        text = getattr(block, "text", None)
        if text:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"text": text}
    return {}


async def _call(session: ClientSession, name: str, args: dict) -> dict:
    with tracer.start_as_current_span(f"mcp.tool.{name}") as span:
        span.set_attribute("mcp.tool.name", name)
        span.set_attribute("mcp.tool.args", json.dumps(args, ensure_ascii=False)[:500])
        res = await session.call_tool(name, args)
        out = _unwrap(res)
        span.set_attribute("mcp.tool.ok", "error" not in out)
        return out


def decide_nuance(contradiction: dict) -> tuple[dict, str]:
    """Return (decision, path). Claude LlmAgent if creds present, else deterministic."""
    has_claude = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("AWS_ACCESS_KEY_ID"))
    if has_claude:
        try:
            # Live ADK Claude planner path (only when creds exist).
            from adk_planner_run import run_claude_planner  # optional, lazy
            return run_claude_planner(contradiction), "adk_llm_agent(claude/litellm)"
        except Exception as e:  # pragma: no cover - creds/runtime dependent
            print(f"[nuance] Claude planner unavailable ({e}); using deterministic rule.")
    return resolve_contradiction(contradiction), "deterministic_so_merger_priority"


async def adk_toolset_discovery() -> list[str]:
    """Criterion #1: attach the FastMCP tools via ADK MCPToolset; list them."""
    from adk_agent import make_mcp_toolset
    toolset = make_mcp_toolset()
    try:
        tools = await toolset.get_tools()
        return [t.name for t in tools]
    finally:
        close = getattr(toolset, "close", None)
        if close:
            maybe = close()
            if asyncio.iscoroutine(maybe):
                await maybe


async def run_backbone() -> dict:
    # Root request span — child tool spans nest under it so the trace reads
    # "request → tool-call" end-to-end (criterion #4).
    with tracer.start_as_current_span("adk_spike.so202.flow"):
        async with stdio_client(_SERVER_PARAMS) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await _drive(session)


async def _drive(session: ClientSession) -> dict:
    summary: dict = {}

    # 1) detect_object_type (name + charakteristika only)
    det = await _call(session, "detect_object_type", {
        "object_name": SO202_OBJECT["object_name"],
        "charakteristika": SO202_OBJECT["charakteristika"],
    })
    object_type = det.get("object_type")
    summary["detect"] = {"object_type": object_type, "_source": det.get("_source")}

    # 2) classify each element (authoritative object_type threaded in)
    classified = []
    for el in SO202_ELEMENTS:
        c = await _call(session, "classify_construction_element", {
            "name": el["name"], "object_code": el["object_code"],
            "object_type": object_type,
        })
        classified.append({"name": el["name"], "element_type": c.get("element_type")})
    summary["classify"] = classified

    # 3) NUANCE — decide which source wins (NO number computed by the LLM)
    decision, path = decide_nuance(NUANCE_CONTRADICTION)
    summary["nuance"] = {"path": path, "decision": decision}

    elements = [dict(e) for e in SO202_ELEMENTS]
    if decision["action"] == "stop_gate":
        summary["result"] = "HITL STOP-gate — flow halted before breakdown."
        return summary
    if decision["action"] == "pick_source" and decision.get("chosen_value"):
        for e in elements:
            if e["name"] == NUANCE_ELEMENT_NAME:
                e["concrete_class"] = decision["chosen_value"]

    # 4) create_work_breakdown (deterministic; codes/qty by engines)
    bd = await _call(session, "create_work_breakdown", {
        "elements": elements, "project_type": "most",
        "project_id": "spike-so202",
        "object_types": {SO202_OBJECT["object_code"]: object_type},
    })
    items = bd.get("items", [])
    summary["breakdown"] = {"total_items": bd.get("total_items"),
                            "sections": bd.get("sections")}

    # 5) calculate_concrete_works for the deck (schedule attach)
    deck = SO202_ELEMENTS[0]
    calc = await _call(session, "calculate_concrete_works", {
        "element_type": "mostovkova_deska", "volume_m3": deck["volume_m3"],
        "concrete_class": deck["concrete_class"], "span_m": deck["span_m"],
        "num_spans": deck["num_spans"], "is_prestressed": True,
    })
    summary["calculate"] = {"keys": sorted(calc.keys())[:8]}

    # 6) export_soupis → REAL .xlsx
    exp = await _call(session, "export_soupis", {"items": items})
    os.makedirs(_OUT_DIR, exist_ok=True)
    xlsx_path = os.path.join(_OUT_DIR, "soupis_SO202.xlsx")
    if exp.get("file_base64"):
        with open(xlsx_path, "wb") as fh:
            fh.write(base64.b64decode(exp["file_base64"]))
    summary["export"] = {
        "row_count": exp.get("row_count"),
        "source_preserved": exp.get("source_preserved"),
        "xlsx_path": xlsx_path if exp.get("file_base64") else None,
    }
    return summary


async def main():
    print("=" * 72)
    print("ADK SPIKE — SO-202 take-off (detect→classify→nuance→breakdown→calc→export)")
    print("=" * 72)

    print("\n[1] ADK MCPToolset discovery over stdio (criterion #1):")
    try:
        names = await adk_toolset_discovery()
        print(f"    MCPToolset.get_tools() → {len(names)} tools: {names}")
    except Exception as e:
        print(f"    MCPToolset discovery FAILED: {e!r}")

    print("\n[2] Backbone execution over real MCP stdio (OTel spans below):")
    summary = await run_backbone()

    print("\n[3] ADK SequentialAgent graph (construct-only — live run needs creds):")
    try:
        from adk_agent import build_root_agent
        root = build_root_agent()
        print(f"    Built '{root.name}' with steps: {[s.name for s in root.sub_agents]}")
    except Exception as e:
        print(f"    graph build FAILED: {e!r}")

    print("\n[4] RESULT SUMMARY:")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
