"""
MCP Tool: calculate_from_passport

Turns a per-SO **bridge passport** (structured JSON extracted from the
documentation — TZ + drawings + soupis) into a whole-SO concrete-works PLAN in
ONE call, by DELEGATING to the canonical TypeScript engine over HTTP:

    POST /api/calculate-from-passport  → planPassport(passport): {mapping, project}

This is Gate 2 of tz-passport-json (ratified 2026-07-07). Half A — the
deterministic mapper `planPassport` (passport → PlannerInput[] → planProject) —
already lives in the shared engine (`Monolit-Planner/shared/.../bridge-passport.ts`)
and is the SINGLE source of truth. This tool does NO calculation or mapping of
its own: it validates the passport against the single-source schema
(`app/models/bridge_passport.py`), forwards the passport VERBATIM to the engine,
and returns the engine's `{mapping, project}` output (+ source). On engine
failure it returns a typed error (engine_unavailable / engine_error /
engine_invalid_input) — NEVER a silently computed number.

Schema governance (interview answer 1): the Pydantic `BridgePassport` model owns
the passport shape and validates the passport here at the consume point. A
malformed passport is rejected as `invalid_passport` with the validation detail,
before any engine call — the same drift-guard discipline as the golden fixture.
"""

import logging
from typing import Any

from pydantic import ValidationError

from app.mcp.tools.monolit_delegate import (
    EngineDelegationError,
    delegate_calculate_from_passport,
    to_error_dict,
)

logger = logging.getLogger(__name__)


async def calculate_from_passport(passport: dict) -> dict:
    """Compute a whole-SO concrete-works plan from a per-SO bridge passport.

    The passport is a structured JSON (schema = tz-bridge-passport, single-source
    Pydantic `app/models/bridge_passport.py`) carrying, per bridge SO, the
    quantities (soupis-joined), geometry (spans, deck widths, heights), the
    structural system, the TZ concrete classes per element use, and the
    documented construction process (pour staging, falsework technology).

    The canonical engine maps it to a `PlannerInput[]` (one per concrete element
    — deck, piers, abutments, foundations, transition slabs, parapets, blinding
    concrete) and computes the whole SO via `planProject`, returning per-element
    plans plus an aggregate (norm hours, days, cost) with honest partial totals:
    a missing quantity yields an element marked NEPOČÍTÁNO
    (`aggregate.elements_uncalculated`), never a fabricated volume.

    Deterministic behaviour (ratified ACs):
    - TZ concrete class is the calculation default; a soupis class that differs
      is a VISIBLE warning — unless it is an OTSKP price band («DO C40/50»,
      Pattern 53), which is an informative note, not a conflict.
    - Documented pour staging (`construction_process.deck_pour_stages`) is honored
      as the deck tact count AND carried as `tz_facts` provenance for the
      validation rule.
    - Symmetric bridge elements are split per deck (volume ÷ decks, num_bridges =
      decks); whole-SO elements (blinding concrete, plain footings) stay unsplit.
    - Unknown passport sections/elements are ignored without error (honest-ignore).

    Args:
        passport: The per-SO bridge passport JSON. Must carry `_meta` with
            `schema: "tz-bridge-passport"` and a supported `schema_version`.
            Typically produced by the extraction side (half B: TZ text + drawing
            vision + soupis join) or hand-built. Example / golden fixture:
            `docs/specs/tz-passport-json/example_SO202_zalmanov.json` (SO-202
            Žalmanov: 9 concrete elements, deck poured in 3 takty on fixed
            scaffolding, TZ↔soupis OTSKP-band notes).

    Returns:
        On success, the engine's output VERBATIM plus `source`:
          {
            "mapping": {"elements": [{"key", "input", "notes"}...], "warnings": [...]},
            "project": {"aggregate": {...}, "elements": [...]},
            "source": "monolit_planner_api"
          }
        On a malformed passport: {"error": "invalid_passport", "message", "details"}.
        On engine failure: {"error": "engine_unavailable"|"engine_error"|
        "engine_invalid_input", ...} — never a computed fallback.
    """
    try:
        # ── Validate against the single-source schema (drift-guard at consume) ──
        # Reject malformed passports up front with a clear message, before any
        # engine call. We forward the ORIGINAL dict (not the re-dumped model) so
        # the engine sees the exact aliased shape it reads (_meta, class, use).
        if not isinstance(passport, dict):
            return {
                "error": "invalid_passport",
                "message": "passport must be a JSON object (tz-bridge-passport schema).",
                "source": "monolit_planner_api",
            }
        try:
            from app.models.bridge_passport import BridgePassport

            BridgePassport.model_validate(passport)
        except ValidationError as ve:
            return {
                "error": "invalid_passport",
                "message": "Passport nevyhovuje schématu tz-bridge-passport.",
                "details": ve.errors(),
                "source": "monolit_planner_api",
            }

        # ── Delegate to the canonical engine (single source of truth) ──────────
        try:
            output = await delegate_calculate_from_passport(passport)
        except EngineDelegationError as exc:
            logger.warning("[MCP/PassportPlan] delegation failed: %s", exc)
            return to_error_dict(exc)

        if isinstance(output, dict):
            output["source"] = "monolit_planner_api"
        return output

    except Exception as e:  # noqa: BLE001 — surface, never a silent number
        logger.error(f"[MCP/PassportPlan] Error: {e}")
        return {"error": str(e), "source": "monolit_planner_api"}
