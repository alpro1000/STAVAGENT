"""
SSOT delegation seam — concrete-agent MCP → Monolit-Planner canonical engine.

TASK_FIX_SSOT_MCP_Delegate, Phase 2. The MCP/agent surface MUST return the same
numbers as the UI. The single source of truth is the TypeScript engine
(`planElement` / `classifyElement`) exposed over HTTP by Phase 1:

    POST /api/calculate  → planElement(PlannerInput): PlannerOutput
    POST /api/classify   → classifyElement(name, {is_bridge}): ElementProfile

This module is the ONLY place the MCP tools reach that engine. It owns the
fail-mode contract (per task §3, refined in review):

    200            → return the TS result verbatim.
    4xx            → permanent bad-input error → EngineInvalidInput, NO retry.
    5xx            → engine error → up to _RETRIES_5XX retry, then EngineError.
    timeout / conn → cold start (2–8 s) → up to _RETRIES_UNAVAILABLE retries,
                     then EngineUnavailable.

The two retry budgets are INDEPENDENT: a spent timeout retry never consumes the
5xx retry, and vice-versa. A hard ceiling on total loop iterations
(_MAX_TOTAL_ATTEMPTS = _RETRIES_UNAVAILABLE + _RETRIES_5XX + 1) guarantees an
alternating timeout↔5xx sequence always terminates.

NEVER fall back to a divergent Python calculation. A failure is surfaced as a
typed exception (the tools translate it to an `{"error": <kind>, …}` dict) — it
is never a silently-computed number.

Test seam: monkeypatch the module-level `_http_post` (per the MCP authoring
rule — inject seams via module-level globals, never via function params, so the
FastMCP JSON-schema build never sees a Callable).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Canonical engine base URL (Cloud Run). Overridable for local/dev/tests.
MONOLIT_API_URL = os.getenv(
    "MONOLIT_API_URL",
    "https://monolit-planner-api-1086027517695.europe-west3.run.app",
)

# Per-attempt HTTP timeouts. Connect is generous for Cloud Run cold start
# (min-instances=0 → 2–8 s spin-up); read covers the synchronous engine run.
_CONNECT_TIMEOUT_S = 8.0
_READ_TIMEOUT_S = 30.0

# Retry budget — tracked INDEPENDENTLY per failure type (a spent timeout retry
# must not consume the 5xx retry, and vice-versa). Unavailable (conn/timeout) is
# transient on cold start → retry. 5xx engine errors get exactly ONE retry
# (task §3). 4xx never retries.
_RETRIES_UNAVAILABLE = 2  # → up to 3 unavailable attempts
_RETRIES_5XX = 1          # → up to 2 server-error attempts
# Hard ceiling on total loop iterations — guarantees an alternating
# timeout↔5xx sequence always terminates (defence-in-depth over the per-type
# budgets, which already bound the total but are easy to regress).
_MAX_TOTAL_ATTEMPTS = _RETRIES_UNAVAILABLE + _RETRIES_5XX + 1
# Backoff between retries (seconds). Tests set this to 0 to stay instant.
_RETRY_BACKOFF_S = 0.5


# ── Typed failures (never a silent number) ───────────────────────────────────

class EngineDelegationError(Exception):
    """Base — the canonical engine could not produce a result."""
    kind = "engine_error"

    def __init__(self, message: str, *, status: Optional[int] = None, detail: Any = None):
        super().__init__(message)
        self.status = status
        self.detail = detail


class EngineUnavailable(EngineDelegationError):
    """Connection refused / timeout — engine not reachable (e.g. cold start)."""
    kind = "engine_unavailable"


class EngineError(EngineDelegationError):
    """Engine returned 5xx (an internal engine_error) after the retry."""
    kind = "engine_error"


class EngineInvalidInput(EngineDelegationError):
    """Engine returned 4xx — permanent bad input. The caller must fix the input."""
    kind = "engine_invalid_input"


def to_error_dict(exc: EngineDelegationError) -> dict:
    """Translate a typed delegation failure into the MCP tool error contract.

    Shape: {"error": <kind>, "message": str, "status": int|None, "source": ...}.
    `error` is one of engine_unavailable / engine_error / engine_invalid_input —
    NEVER a computed quantity.
    """
    return {
        "error": exc.kind,
        "message": str(exc),
        "status": exc.status,
        "source": "monolit_planner_api",
    }


# ── Transport seam (monkeypatched in tests) ──────────────────────────────────

async def _http_post(path: str, payload: dict) -> tuple[int, Any]:
    """POST `payload` as JSON to `MONOLIT_API_URL + path`; return (status, body).

    The ONLY function that touches the network. Tests replace it wholesale to
    drive the fail-mode state machine (return 4xx/5xx, raise httpx errors)
    without real HTTP. Raises httpx transport exceptions on connect/timeout —
    `delegate()` maps those to EngineUnavailable.
    """
    import httpx

    timeout = httpx.Timeout(_READ_TIMEOUT_S, connect=_CONNECT_TIMEOUT_S)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{MONOLIT_API_URL}{path}", json=payload)
        try:
            body = resp.json()
        except Exception:
            body = {"error": "non_json_response", "text": resp.text[:500]}
        return resp.status_code, body


# ── Fail-mode state machine ──────────────────────────────────────────────────

async def delegate(path: str, payload: dict) -> dict:
    """POST to the canonical engine and enforce the fail-mode contract.

    Returns the engine's JSON body on 2xx. Raises EngineInvalidInput (4xx, no
    retry), EngineError (5xx after up to _RETRIES_5XX retries), or
    EngineUnavailable (connect/timeout after up to _RETRIES_UNAVAILABLE retries).
    Never returns a Python-computed fallback.

    The two retry budgets are tracked INDEPENDENTLY — a spent timeout retry must
    not consume the 5xx retry (and vice-versa). A hard ceiling on total
    iterations (`_MAX_TOTAL_ATTEMPTS`) guarantees an alternating timeout↔5xx
    sequence always terminates.
    """
    import httpx

    transport_errors = (
        httpx.ConnectError,
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
        httpx.PoolTimeout,
        httpx.WriteTimeout,
        httpx.TimeoutException,
    )

    unavailable_retries = 0  # consumed ONLY by connect/timeout failures
    server_error_retries = 0  # consumed ONLY by 5xx responses
    iteration = 0
    while True:
        iteration += 1
        try:
            status, body = await _http_post(path, payload)
        except transport_errors as exc:
            # Cold start / network blip → unavailable. Retry within its OWN
            # budget (independent of the 5xx budget) and the total ceiling.
            if unavailable_retries < _RETRIES_UNAVAILABLE and iteration < _MAX_TOTAL_ATTEMPTS:
                unavailable_retries += 1
                if _RETRY_BACKOFF_S:
                    await asyncio.sleep(_RETRY_BACKOFF_S * unavailable_retries)
                continue
            raise EngineUnavailable(
                f"Canonical engine unreachable at {MONOLIT_API_URL}{path}: {exc!r}"
            ) from exc
        except Exception as exc:  # unexpected transport failure → unavailable, no silent compute
            raise EngineUnavailable(
                f"Unexpected delegation failure to {MONOLIT_API_URL}{path}: {exc!r}"
            ) from exc

        if 200 <= status < 300:
            return body

        if 400 <= status < 500:
            # Permanent bad input — return to caller, DO NOT retry.
            raise EngineInvalidInput(
                f"Engine rejected input ({status}): {_err_text(body)}",
                status=status,
                detail=body,
            )

        # 5xx — engine_error. Retry within its OWN budget (independent of the
        # unavailable budget) and the total ceiling, then surface as engine error.
        if server_error_retries < _RETRIES_5XX and iteration < _MAX_TOTAL_ATTEMPTS:
            server_error_retries += 1
            if _RETRY_BACKOFF_S:
                await asyncio.sleep(_RETRY_BACKOFF_S * server_error_retries)
            continue
        raise EngineError(
            f"Engine error ({status}): {_err_text(body)}",
            status=status,
            detail=body,
        )


def _err_text(body: Any) -> str:
    if isinstance(body, dict):
        return str(body.get("error") or body.get("message") or body)
    return str(body)


async def delegate_calculate(payload: dict) -> dict:
    """POST /api/calculate — returns PlannerOutput (verbatim) or raises."""
    return await delegate("/api/calculate", payload)


async def delegate_classify(payload: dict) -> dict:
    """POST /api/classify — returns ElementProfile (verbatim) or raises."""
    return await delegate("/api/classify", payload)
