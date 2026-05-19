"""
ASGI middlewares for the /mcp mount.

Extracted from `app/main.py` so tests + future re-mounts can import
without pulling in the full FastAPI app (KB loader, fastmcp, etc.).

`app/main.py` re-exports these names for backward-compat with any
external code that has been importing them from there.

Reference: docs/audits/mcp_status/ — RFC 9728 §5.3 challenge wiring,
the X-Forwarded-Proto rewrite, and the dual-prefix bearer routing
land here.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ── Allow-listed Origins (for `MCPOriginMiddleware` only — NOT CORS) ───────
#
# This list governs the SERVER-side warning + 403 enforcement that
# Anthropic's Connectors Directory requires. The Browser-side CORS
# allow-list lives separately on the CORSMiddleware that wraps the
# /mcp mount (see app/main.py).

_MCP_ALLOWED_ORIGIN_PREFIXES = (
    "https://claude.ai",
    "https://chatgpt.com",
    "https://chat.openai.com",
    "https://stavagent.cz",
    "https://www.stavagent.cz",
    "http://localhost",
    "http://127.0.0.1",
)

_MCP_ORIGIN_ENFORCE = os.getenv("MCP_ORIGIN_ENFORCE", "").lower() in ("1", "true", "yes")


def _external_base_url_from_scope(scope) -> str:
    """ASGI-scope variant of the request-based helper. Builds
    `https://host` from `host` + `X-Forwarded-Proto` so Cloud Run's
    HTTP-to-edge-TLS proxy doesn't make us advertise http:// URLs in
    the WWW-Authenticate challenge."""
    headers = {k.decode("latin-1").lower(): v.decode("latin-1")
               for k, v in scope.get("headers", [])}
    forwarded_proto = headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    if forwarded_proto in ("http", "https"):
        scheme = forwarded_proto
    else:
        scheme = scope.get("scheme") or "http"
    host = headers.get("host") or "localhost"
    return f"{scheme}://{host}"


def _origin_allowed(origin: str) -> bool:
    if not origin:
        return True  # No Origin header → non-browser client (Claude Desktop, curl)
    return any(origin.startswith(prefix) for prefix in _MCP_ALLOWED_ORIGIN_PREFIXES)


class MCPOriginMiddleware:
    """ASGI middleware that logs (and optionally blocks) non-whitelisted Origin
    headers on the /mcp/ endpoint. Required by Anthropic Connectors Directory.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            origin = ""
            for k, v in scope.get("headers", []):
                if k == b"origin":
                    origin = v.decode("latin-1")
                    break
            if origin and not _origin_allowed(origin):
                if _MCP_ORIGIN_ENFORCE:
                    logger.warning(f"[MCP/Origin] BLOCKED: {origin}")
                    from starlette.responses import JSONResponse
                    response = JSONResponse(
                        {"error": "origin_not_allowed", "origin": origin},
                        status_code=403,
                    )
                    await response(scope, receive, send)
                    return
                logger.warning(
                    f"[MCP/Origin] non-whitelisted origin {origin!r} "
                    f"(dry-run: allowing — set MCP_ORIGIN_ENFORCE=1 to block)"
                )
        await self.app(scope, receive, send)


class MCPAuthChallengeMiddleware:
    """RFC 9728 §5.3 + RFC 6750 — bearer-token gate on /mcp/.

    Three responsibilities:

    1. **Active 401 gate** — any non-OPTIONS request without an
       `Authorization` header is rejected immediately with a 401
       carrying the challenge. ChatGPT and Claude.ai use this
       challenge to discover where to find the OAuth metadata.

       This INCLUDES anonymous `GET /mcp/`. Claude.ai's connector
       probe does an unauthenticated GET before running OAuth and
       expects to see `401 + WWW-Authenticate` as the signal that
       auth is required. Without the GET gate, FastMCP itself
       responds 406 ("Not Acceptable: Client must accept
       text/event-stream") because the probe doesn't send the
       SSE `Accept` header — and 406 makes Claude.ai treat the
       server as unreachable instead of starting the OAuth flow.

    2. **Bearer token resolution + lifecycle check** — when a
       Bearer is present we route by prefix:
         sat-*          → mcp_oauth_tokens (DCR access tokens)
         sk-stavagent-* → mcp_api_keys (legacy API keys)
         else           → 401 invalid_token
       Lifecycle checks for sat-*: revoked_at IS NULL +
       access_expires_at > NOW(). Failure emits 401 with an
       `error_description` that tells the broker which next step
       (e.g. "use refresh_token") makes sense.

       On success we attach an `AuthContext` to `scope["state"]`
       so tool wrappers can read `user_api_key` for credit
       attribution + `oauth_client_id` for audit. The
       `last_used_at` column is bumped synchronously (~1ms,
       best-effort — exceptions swallowed).

    3. **Passive 401 augmentation** — if the wrapped FastMCP app
       itself responds 401 (because the bearer token failed an
       internal validation), inject the same `WWW-Authenticate`
       header into the response on its way out.

    `OPTIONS` is the one method that bypasses the gate, so browser
    CORS preflights still succeed without an `Authorization` header
    (the actual POST/GET that follows will be gated).
    """

    # Everything except OPTIONS is gated. The auth check runs BEFORE
    # the request reaches FastMCP — so for an anonymous GET, the 401
    # fires here and the Accept-header check inside FastMCP never
    # runs. Once a real client adds `Authorization`, the request flows
    # through to FastMCP and FastMCP's own Accept negotiation kicks
    # in (which is correct for authenticated MCP traffic).
    _GATE_METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, app):
        self.app = app

    def _challenge_header(self, scope, *, error: str = "invalid_token",
                          error_description: Optional[str] = None) -> str:
        base = _external_base_url_from_scope(scope)
        resource_metadata = f"{base}/.well-known/oauth-protected-resource"
        # RFC 6750 §3 + RFC 9728 §5.3 — quote attribute values, comma-
        # separated. `error="invalid_token"` per RFC 6750 §3.1 when an
        # invalid/absent token is the reason for the 401.
        parts = [
            'Bearer realm="STAVAGENT MCP"',
            f'resource_metadata="{resource_metadata}"',
            f'error="{error}"',
        ]
        if error_description:
            # Header value must escape internal quotes; we control the
            # source strings so a simple replace is sufficient.
            safe = error_description.replace('"', "'")
            parts.append(f'error_description="{safe}"')
        return ", ".join(parts)

    @staticmethod
    def _extract_bearer(auth_header: str) -> str:
        parts = (auth_header or "").split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return ""

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "").upper()
        headers = {k.decode("latin-1").lower(): v.decode("latin-1")
                   for k, v in scope.get("headers", [])}
        auth_value = (headers.get("authorization") or "").strip()
        bearer = self._extract_bearer(auth_value) if auth_value else ""

        from starlette.responses import JSONResponse

        # Active gate — unauthenticated write requests get the 401
        # challenge directly. Skip the wrapped FastMCP app entirely.
        if method in self._GATE_METHODS and not bearer:
            challenge = self._challenge_header(scope)
            response = JSONResponse(
                {
                    "error": "invalid_token",
                    "error_description": (
                        "MCP endpoint requires an OAuth 2.0 bearer token. "
                        "See /.well-known/oauth-protected-resource for the "
                        "authorization server."
                    ),
                },
                status_code=401,
                headers={"WWW-Authenticate": challenge},
            )
            await response(scope, receive, send)
            return

        # Bearer present → resolve through the unified DB lookup.
        # Skip the resolve for OPTIONS (preflight); it falls through
        # to the inner app + CORSMiddleware which handles it.
        if bearer and method in self._GATE_METHODS:
            # Lazy import — keeps middleware module out of cold start path
            # if it gets re-used by future MCP mounts that pre-import.
            from app.mcp import auth as _mcp_auth
            try:
                ctx = _mcp_auth.resolve_bearer_token(bearer)
            except Exception as exc:  # noqa: BLE001 — defensive: never 5xx the auth gate
                logger.exception("[MCP/Auth] resolve_bearer_token crashed")
                ctx = {
                    "status": "ok",  # fail open inside the middleware; downstream
                                      # tools will still reject via check_credits
                    "user_api_key": None, "oauth_client_id": None,
                    "grant_type": None, "scope": None, "token_row_id": None,
                    "error_description": "",
                    "_resolve_error": str(exc)[:200],
                }

            if ctx["status"] != "ok":
                challenge = self._challenge_header(
                    scope,
                    error="invalid_token",
                    error_description=ctx["error_description"],
                )
                response = JSONResponse(
                    {
                        "error": "invalid_token",
                        "error_description": ctx["error_description"],
                    },
                    status_code=401,
                    headers={"WWW-Authenticate": challenge},
                )
                await response(scope, receive, send)
                return

            # Attach the AuthContext for tool wrappers + audit log.
            # `scope["state"]` is the Starlette convention for per-request
            # data sharing across middleware → endpoint.
            scope.setdefault("state", {})
            scope["state"]["mcp_auth"] = {
                "user_api_key": ctx["user_api_key"],
                "oauth_client_id": ctx["oauth_client_id"],
                "grant_type": ctx["grant_type"],
                "scope": ctx["scope"],
            }

            # Bump last_used_at (best-effort; DCR tokens only — legacy
            # api_key path uses mcp_api_keys.last_used_at, updated by
            # check_credits when a paid tool runs).
            if ctx.get("token_row_id"):
                try:
                    _mcp_auth.update_token_last_used(ctx["token_row_id"])
                except Exception:  # noqa: BLE001
                    pass

        # Passive augmentation — wrap `send` so we can inject the
        # challenge header onto any 401 the inner app produces.
        async def send_with_challenge(message):
            if message["type"] == "http.response.start" and message.get("status") == 401:
                headers_list = list(message.get("headers", []))
                # Don't duplicate if the inner app already set one.
                has_www_auth = any(
                    k.lower() == b"www-authenticate" for k, _ in headers_list
                )
                if not has_www_auth:
                    challenge = self._challenge_header(scope)
                    headers_list.append(
                        (b"www-authenticate", challenge.encode("latin-1"))
                    )
                    message = {**message, "headers": headers_list}
            await send(message)

        await self.app(scope, receive, send_with_challenge)


class BareOptionsAllowMiddleware:
    """Return 204 + CORS headers for `OPTIONS` requests that AREN'T a
    real CORS preflight.

    Why this exists
    ===============

    Starlette's `CORSMiddleware` short-circuits OPTIONS requests with
    a 200 + CORS headers — but only when the request looks like a real
    preflight, i.e. it carries `Access-Control-Request-Method` (per
    the Fetch spec). Anything else falls through to route dispatch,
    which 405s because no FastAPI route (and no FastMCP route on the
    `/mcp/` mount) registers an OPTIONS handler.

    Some legitimate clients send bare OPTIONS without
    `Access-Control-Request-Method`:

      - `curl -X OPTIONS …` for a health probe
      - Intermediary proxies / gateways that strip the request-method
        header on retry
      - Some MCP client implementations probing `/mcp/` for liveness

    Without an OPTIONS handler, those clients see 405 + no CORS
    headers → browser surfaces a `CORS_ERROR` and Claude.ai treats
    the server as unreachable.

    What this middleware does
    =========================

      1. Pass through anything that isn't an HTTP OPTIONS request.
      2. Pass through OPTIONS requests that ARE real preflights
         (Access-Control-Request-Method present) — Starlette's
         `CORSMiddleware` further down the stack handles them with
         its normal 200 + CORS-headers response.
      3. For bare OPTIONS from an allow-listed `Origin`, short-circuit
         with a `204 No Content` and the same CORS headers that
         CORSMiddleware would have set on a preflight (so the browser
         is happy regardless of which path the request took).
      4. Bare OPTIONS without `Origin`, or with a non-allow-listed
         origin, still pass through (returning 405 is correct for
         non-CORS clients hitting routes that don't define OPTIONS).
    """

    def __init__(self, app, allow_origins, allow_origin_regex=None):
        self.app = app
        self.allow_origins = set(allow_origins or [])
        self.allow_origin_regex = (
            re.compile(allow_origin_regex) if allow_origin_regex else None
        )

    def _origin_allowed(self, origin: str) -> bool:
        if not origin:
            return False
        if origin in self.allow_origins:
            return True
        if self.allow_origin_regex and self.allow_origin_regex.fullmatch(origin):
            return True
        return False

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") != "OPTIONS":
            await self.app(scope, receive, send)
            return

        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1")
            for k, v in scope.get("headers", [])
        }
        # Real preflight → defer to CORSMiddleware further down.
        if "access-control-request-method" in headers:
            await self.app(scope, receive, send)
            return

        origin = headers.get("origin", "")
        if not self._origin_allowed(origin):
            await self.app(scope, receive, send)
            return

        # Bare OPTIONS from allow-listed origin → 204 + CORS headers.
        from starlette.responses import Response
        cors_headers = {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            "vary": "Origin",
        }
        response = Response(status_code=204, headers=cors_headers)
        await response(scope, receive, send)
