"""
SSOT delegation seam — concrete-agent MCP → Zeleznice-Planner canonical engine.

Sibling of `monolit_delegate.py` (same fail-mode contract, same retry budgets,
same service-key auth), pointed at the railway kiosk:

    POST /api/rail/calculate → planRailSection(RailPlannerInput): RailPlanResult
    GET  /api/rail/catalog   → KB registry snapshot (sestavy / stroje / výhybky)

The single source of truth is the TypeScript engine in
`Zeleznice-Planner/shared` (planRailSection). This module is the ONLY place
the MCP railway tool reaches that engine. Fail-mode contract (mirrors
monolit_delegate exactly):

    200            → return the TS result verbatim.
    4xx            → permanent bad-input error → EngineInvalidInput, NO retry
                     (422 uncalculated = honest NEPOČÍTÁNO, carried in reason_cs).
    5xx            → engine error → up to _RETRIES_5XX retry, then EngineError.
    timeout / conn → cold start → up to _RETRIES_UNAVAILABLE retries,
                     then EngineUnavailable.

NEVER fall back to a divergent Python calculation. Test seam: monkeypatch the
module-level `_http_request` (per MCP authoring rules — seams via module
globals, never Callable params).
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

from app.mcp.tools.monolit_delegate import (
    EngineDelegationError,
    EngineError,
    EngineInvalidInput,
    EngineUnavailable,
    _err_text,
)

logger = logging.getLogger(__name__)

# Canonical railway engine base URL (Cloud Run). Overridable for local/dev/tests.
ZELEZNICE_API_URL = os.getenv(
    "ZELEZNICE_API_URL",
    "https://zeleznice-planner-api-1086027517695.europe-west3.run.app",
)


# Server-to-server auth — the SAME shared ecosystem service key the
# Monolit delegate uses (SERVICE_API_KEY), not a second secret.
def _service_key() -> Optional[str]:
    return os.getenv("SERVICE_API_KEY") or None


_CONNECT_TIMEOUT_S = 8.0
_READ_TIMEOUT_S = 30.0
_RETRIES_UNAVAILABLE = 2
_RETRIES_5XX = 1
_MAX_TOTAL_ATTEMPTS = _RETRIES_UNAVAILABLE + _RETRIES_5XX + 1
_RETRY_BACKOFF_S = 0.5


def to_error_dict(exc: EngineDelegationError) -> dict:
    """Typed delegation failure → MCP tool error contract (source = railway API)."""
    return {
        "error": exc.kind,
        "message": str(exc),
        "status": exc.status,
        "source": "zeleznice_planner_api",
    }


# ── Transport seam (monkeypatched in tests) ──────────────────────────────────


async def _http_request(
    method: str, path: str, payload: Optional[dict]
) -> tuple[int, Any]:
    """Single network touchpoint: request against ZELEZNICE_API_URL + path."""
    import httpx

    headers = {}
    key = _service_key()
    if key:
        headers["X-Service-Key"] = key

    timeout = httpx.Timeout(_READ_TIMEOUT_S, connect=_CONNECT_TIMEOUT_S)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if method == "GET":
            resp = await client.get(f"{ZELEZNICE_API_URL}{path}", headers=headers)
        else:
            resp = await client.post(
                f"{ZELEZNICE_API_URL}{path}", json=payload, headers=headers
            )
        try:
            body = resp.json()
        except Exception:
            body = {"error": "non_json_response", "text": resp.text[:500]}
        return resp.status_code, body


# ── Fail-mode state machine (mirror of monolit_delegate.delegate) ────────────


async def _delegate(method: str, path: str, payload: Optional[dict] = None) -> dict:
    import httpx

    transport_errors = (
        httpx.ConnectError,
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
        httpx.PoolTimeout,
        httpx.WriteTimeout,
        httpx.TimeoutException,
    )

    unavailable_retries = 0
    server_error_retries = 0
    iteration = 0
    while True:
        iteration += 1
        try:
            status, body = await _http_request(method, path, payload)
        except transport_errors as exc:
            if (
                unavailable_retries < _RETRIES_UNAVAILABLE
                and iteration < _MAX_TOTAL_ATTEMPTS
            ):
                unavailable_retries += 1
                if _RETRY_BACKOFF_S:
                    await asyncio.sleep(_RETRY_BACKOFF_S * unavailable_retries)
                continue
            raise EngineUnavailable(
                f"Railway engine unreachable at {ZELEZNICE_API_URL}{path}: {exc!r}"
            ) from exc
        except Exception as exc:  # unexpected transport failure → unavailable
            raise EngineUnavailable(
                f"Unexpected delegation failure to {ZELEZNICE_API_URL}{path}: {exc!r}"
            ) from exc

        if 200 <= status < 300:
            return body

        if 400 <= status < 500:
            raise EngineInvalidInput(
                f"Railway engine rejected input ({status}): {_err_text(body)}",
                status=status,
                detail=body,
            )

        if server_error_retries < _RETRIES_5XX and iteration < _MAX_TOTAL_ATTEMPTS:
            server_error_retries += 1
            if _RETRY_BACKOFF_S:
                await asyncio.sleep(_RETRY_BACKOFF_S * server_error_retries)
            continue
        raise EngineError(
            f"Railway engine error ({status}): {_err_text(body)}",
            status=status,
            detail=body,
        )


async def delegate_rail_calculate(payload: dict) -> dict:
    """POST /api/rail/calculate — returns RailPlanResult verbatim or raises."""
    return await _delegate("POST", "/api/rail/calculate", payload)


async def delegate_rail_catalog() -> dict:
    """GET /api/rail/catalog — returns the KB registry snapshot or raises."""
    return await _delegate("GET", "/api/rail/catalog")
