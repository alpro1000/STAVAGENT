"""
ADK Spike — nuance decision (so_merger priority).

This is the DETERMINISTIC equivalent of the Claude LlmAgent planner branch
(adk_agent.py): given a field contradiction with N candidate (value, source)
pairs, it returns a DECISION about which source to trust — it never computes a
number, exactly mirroring the LLM contract:

    {action, chosen_source, chosen_value, reason}

with action ∈ {proceed, pick_source, flag_revision, stop_gate}.

Priority ladder taken from app/services/so_merger.py (PD / výkres wins over a
simplification in the static calculation; souhrnná TZ is lowest). The spike does
NOT modify so_merger — it reuses its rule. When ANTHROPIC creds are present,
run_spike calls the ADK LlmAgent instead; the contract is identical so the
backbone is provider-agnostic.
"""

from typing import Any

# Lower number = higher priority (mirrors so_merger SUB_TYPE_PRIORITY intent:
# project documentation / drawing > engineering simplification > summary TZ).
SOURCE_PRIORITY = {
    "PD_vykres": 1,            # PD / výkres — authoritative
    "statika": 2,             # static calculation (primary)
    "statika_zjednoduseni": 3,  # a simplification noted in the calc
    "TZ_souhrnna": 4,          # summary technical report — lowest
}


def resolve_contradiction(contradiction: dict[str, Any]) -> dict[str, Any]:
    """Decide which source wins a field contradiction (no number is computed)."""
    field = contradiction["field"]
    element = contradiction.get("element_name", "?")
    candidates = contradiction["candidates"]

    distinct_values = {c["value"] for c in candidates}
    if len(distinct_values) <= 1:
        only = next(iter(distinct_values), None)
        return {
            "action": "proceed",
            "chosen_source": candidates[0]["source"] if candidates else None,
            "chosen_value": only,
            "reason": f"{element}.{field}: sources agree ({only}); no conflict.",
        }

    ranked = sorted(candidates, key=lambda c: SOURCE_PRIORITY.get(c["source"], 99))
    best, runner = ranked[0], ranked[1]
    best_rank = SOURCE_PRIORITY.get(best["source"], 99)
    runner_rank = SOURCE_PRIORITY.get(runner["source"], 99)

    # Unknown source, or a genuine tie at the same priority → escalate to a human.
    if best_rank == 99 or best_rank == runner_rank:
        return {
            "action": "stop_gate",
            "chosen_source": None,
            "chosen_value": None,
            "reason": (
                f"{element}.{field}: cannot resolve by priority "
                f"({best['source']} vs {runner['source']}) — HITL STOP-gate."
            ),
        }

    return {
        "action": "pick_source",
        "chosen_source": best["source"],
        "chosen_value": best["value"],
        "reason": (
            f"{element}.{field}: {best['value']} from {best['source']} wins over "
            f"{runner['value']} from {runner['source']} per so_merger priority "
            f"(PD/výkres > zjednodušení statiky)."
        ),
    }
