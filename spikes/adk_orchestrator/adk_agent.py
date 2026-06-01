"""
ADK Spike — the orchestration graph (artefact under evaluation).

ONE flow as an ADK SequentialAgent:

    detect → (per element) classify → [nuance planner] → breakdown → calculate → export

- Backbone tools are the existing FastMCP tools, attached via ONE `MCPToolset`
  over **stdio** (mcp_stdio_server.py) — zero prod/auth contact.
- Cheap backbone steps run on **Gemini Flash via Vertex** (criterion #2, cheap tier).
- The nuance branch is an `LlmAgent` PLANNER on **Claude via LiteLLM**
  (Anthropic or Bedrock) — it DECIDES which source wins a contradiction and
  returns {action, chosen_source, chosen_value, reason}; it never computes a
  number. so_merger's priority rule is in its system prompt.

Constructing this graph requires NO network (models are bound lazily; the MCP
subprocess spawns only on get_tools()/run). Running it LIVE needs:
  - Flash: Vertex creds (GOOGLE_GENAI_USE_VERTEXAI=TRUE + ADC/project), and
  - Claude: ANTHROPIC_API_KEY (LiteLlm "anthropic/…") or AWS creds ("bedrock/…").

Multi-provider note (criterion #2): the app's provider_router serves Claude via
**Bedrock / Anthropic**, NOT Vertex (Vertex = Gemini only). ADK composes the two
providers in one graph by giving each agent its own `model=`: Gemini natively,
Claude through LiteLlm. (Claude-on-Vertex via Model Garden also exists and would
let a single Vertex backend serve both — noted as the simpler-lock-in option.)
"""

from __future__ import annotations

import os
import sys

from pydantic import BaseModel, Field

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

_HERE = os.path.dirname(os.path.abspath(__file__))
_STDIO_SERVER = os.path.join(_HERE, "mcp_stdio_server.py")

# Configurable model ids (no creds needed to construct).
CLAUDE_PLANNER_MODEL = os.environ.get("ADK_CLAUDE_MODEL", "anthropic/claude-sonnet-4-5")
FLASH_MODEL = os.environ.get("ADK_FLASH_MODEL", "gemini-2.5-flash")

BACKBONE_TOOLS = [
    "detect_object_type",
    "classify_construction_element",
    "create_work_breakdown",
    "calculate_concrete_works",
    "export_soupis",
]


def make_mcp_toolset() -> MCPToolset:
    """ONE MCPToolset attaching the 5 backbone tools over stdio (criterion #1)."""
    return MCPToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[_STDIO_SERVER],
            ),
            timeout=30.0,
        ),
        tool_filter=BACKBONE_TOOLS,
    )


class NuanceDecision(BaseModel):
    """Planner output contract — a DECISION, never a computed number."""

    action: str = Field(description="proceed | pick_source | flag_revision | stop_gate")
    chosen_source: str | None = Field(default=None, description="winning source id")
    chosen_value: str | None = Field(default=None, description="value of the winning source")
    reason: str = Field(description="short justification citing the priority rule")


_PLANNER_INSTRUCTION = """\
You are the orchestration PLANNER for a Czech construction take-off. A single
field is contradicted across sources. DECIDE which source to trust — do NOT
compute or invent any number; only choose among the given candidate values.

Priority rule (from so_merger): PD / výkres (drawing) outranks a simplification
in the static calculation, which outranks the summary technical report (TZ-S).

Return ONLY the structured decision:
  - action="pick_source" + chosen_source/chosen_value when priority resolves it,
  - action="stop_gate" when sources tie at equal priority or a source is unknown
    (a human must resolve — HITL),
  - action="proceed" when the sources actually agree.
The chosen_value MUST be copied verbatim from a candidate; never a new value.
"""


def make_nuance_planner() -> LlmAgent:
    """Claude planner (LiteLLM). output_schema → pure decision, no tool calls."""
    return LlmAgent(
        name="nuance_planner",
        model=LiteLlm(model=CLAUDE_PLANNER_MODEL),
        instruction=_PLANNER_INSTRUCTION,
        output_schema=NuanceDecision,
        output_key="nuance_decision",
    )


def make_flash_step(name: str, instruction: str, toolset: MCPToolset) -> LlmAgent:
    """A cheap backbone step on Gemini Flash (Vertex), holding the MCP toolset."""
    return LlmAgent(
        name=name,
        model=FLASH_MODEL,  # Gemini Flash via Vertex (GOOGLE_GENAI_USE_VERTEXAI=TRUE)
        instruction=instruction,
        tools=[toolset],
    )


def build_root_agent() -> SequentialAgent:
    """The full deterministic-backbone + one-LLM-branch flow as a SequentialAgent."""
    toolset = make_mcp_toolset()
    return SequentialAgent(
        name="so202_takeoff_spike",
        sub_agents=[
            make_flash_step(
                "detect",
                "Call detect_object_type with the object name + charakteristika; "
                "report the object_type.",
                toolset,
            ),
            make_flash_step(
                "classify",
                "For each element call classify_construction_element with its name, "
                "object_code and the detected object_type; collect element_types.",
                toolset,
            ),
            make_nuance_planner(),  # the ONE Claude decision branch, BEFORE breakdown
            make_flash_step(
                "breakdown",
                "Apply the nuance_decision (if pick_source, use chosen_value for that "
                "element's concrete_class), then call create_work_breakdown.",
                toolset,
            ),
            make_flash_step(
                "calculate",
                "Call calculate_concrete_works for the deck element to attach schedule.",
                toolset,
            ),
            make_flash_step(
                "export",
                "Call export_soupis with the breakdown items; return the file metadata.",
                toolset,
            ),
        ],
    )


if __name__ == "__main__":
    # Construct-only smoke check (no network, no creds).
    agent = build_root_agent()
    print(f"Built ADK SequentialAgent '{agent.name}' with "
          f"{len(agent.sub_agents)} steps:")
    for sub in agent.sub_agents:
        print(f"  - {sub.name}: {type(sub).__name__}")
