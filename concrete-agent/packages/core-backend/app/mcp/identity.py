"""Caller identity for owner-scoped MCP resources.

MCP tools are context-free by convention (no auth param — root CLAUDE.md authoring
rules). Two entry points know the verified caller:

  * REST wrappers in ``routes.py`` — hold ``api_key`` via ``_extract_bearer``;
    they bind it on a ContextVar around the tool call;
  * the raw ``/mcp`` path — ``MCPAuthChallengeMiddleware`` stashes ``user_api_key``
    on the request scope (``scope["state"]["mcp_auth"]``); FastMCP's
    ``get_http_request()`` reaches it inside a tool.

``current_owner_api_key()`` abstracts both so a resource helper (soupis-handle
resolve) can enforce owner isolation WITHOUT the tool declaring an auth param.
None on either path = "no verified owner" — callers must reject for isolation
(never mint or read owned state anonymously).
"""
from __future__ import annotations

import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_rest_owner: contextvars.ContextVar = contextvars.ContextVar(
    "_mcp_rest_owner_api_key", default=None
)


def set_rest_owner(api_key: Optional[str]):
    """REST wrapper: bind the verified api_key for the duration of a tool call.
    Returns a token to pass to ``reset_rest_owner`` in a ``finally``."""
    return _rest_owner.set(api_key or None)


def reset_rest_owner(token) -> None:
    try:
        _rest_owner.reset(token)
    except (LookupError, ValueError):  # token from a different context — ignore
        pass


def current_owner_api_key() -> Optional[str]:
    """The verified caller's ``user_api_key``, or None if anonymous/unresolvable.

    REST path: the ContextVar the wrapper set. ``/mcp`` path: the ``user_api_key``
    the auth middleware stashed on the request scope, read via FastMCP's
    HTTP-request accessor. Any failure (no HTTP request in scope, e.g. an
    in-process test transport) returns None — a not-owner, which callers reject.
    """
    v = _rest_owner.get()
    if v:
        return v
    try:
        from fastmcp.server.dependencies import get_http_request

        req = get_http_request()
        state = (getattr(req, "scope", {}) or {}).get("state") or {}
        return (state.get("mcp_auth") or {}).get("user_api_key")
    except Exception:  # noqa: BLE001 — no request context ⇒ no owner, never crash
        return None
