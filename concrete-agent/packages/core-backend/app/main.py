"""
FastAPI Application Entry Point
Czech Building Audit System
"""
import logging
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress pdfminer warnings (invalid PDF patterns)
logging.getLogger("pdfminer").setLevel(logging.ERROR)


# ── MCP server (Model Context Protocol) ──────────────────────────────────────
# Build the MCP ASGI app at module load so its lifespan can be combined with
# the FastAPI app's lifespan. FastMCP's StreamableHTTPSessionManager requires
# its lifespan to run in the parent ASGI app — otherwise mounted routes return
# "Task group is not initialized" / 404.
#
# `path="/"` is mandatory: by default `http_app()` prefixes its single route
# with `/mcp`, so mounting at `/mcp` would resolve to `/mcp/mcp` instead of
# `/mcp/`.

try:
    from app.mcp.server import mcp as mcp_server
    _mcp_http_app = mcp_server.http_app(path="/")
    _mcp_init_error = None
except Exception as exc:  # noqa: BLE001 — MCP must never block the API boot
    _mcp_http_app = None
    _mcp_init_error = exc


# Allow-list for the MCP /mcp/ endpoint. Currently runs in dry-run mode:
# non-whitelisted origins are logged but NOT rejected. Flip
# MCP_ORIGIN_ENFORCE=1 to start returning 403.
_MCP_ALLOWED_ORIGIN_PREFIXES = (
    "https://claude.ai",
    "https://chat.openai.com",
    "https://chatgpt.com",
    "http://localhost",
    "http://127.0.0.1",
)
_MCP_ORIGIN_ENFORCE = os.getenv("MCP_ORIGIN_ENFORCE", "").lower() in {"1", "true", "yes"}


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
    """RFC 9728 §5.3 — emit `WWW-Authenticate` on every 401 from /mcp/,
    pointing clients at the protected-resource metadata.

    Two responsibilities:

    1. **Active 401 gate** — a write request (POST/PUT/PATCH/DELETE)
       without an `Authorization` header is rejected immediately with
       a 401 carrying the challenge. ChatGPT and Claude.ai use this
       challenge to discover where to find the OAuth metadata.

    2. **Passive 401 augmentation** — if the wrapped FastMCP app
       itself responds 401 (because the bearer token failed an
       internal validation), inject the same `WWW-Authenticate`
       header into the response on its way out.

    Read-only methods (GET, HEAD, OPTIONS) pass through unmodified so
    SSE handshakes and CORS preflights aren't broken.
    """

    _GATE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, app):
        self.app = app

    def _challenge_header(self, scope) -> str:
        base = _external_base_url_from_scope(scope)
        resource_metadata = f"{base}/.well-known/oauth-protected-resource"
        # RFC 6750 §3 + RFC 9728 §5.3 — quote attribute values, comma-
        # separated. `error="invalid_token"` per RFC 6750 §3.1 when an
        # invalid/absent token is the reason for the 401.
        return (
            f'Bearer realm="STAVAGENT MCP", '
            f'resource_metadata="{resource_metadata}", '
            f'error="invalid_token"'
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "").upper()
        headers = {k.decode("latin-1").lower(): v.decode("latin-1")
                   for k, v in scope.get("headers", [])}
        has_auth = "authorization" in headers and bool(headers["authorization"].strip())

        # Active gate — unauthenticated write requests get the 401
        # challenge directly. Skip the wrapped FastMCP app entirely.
        if method in self._GATE_METHODS and not has_auth:
            from starlette.responses import JSONResponse
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


# ── Application lifespan (replaces deprecated @app.on_event decorators) ──────

async def _run_startup() -> None:
    """One-shot startup tasks (run before MCP lifespan starts)."""
    logger.info("=" * 80)
    logger.info("🚀 Czech Building Audit System Starting...")
    logger.info("=" * 80)
    logger.info(f"🌐 Port: {os.getenv('PORT', '8000')} (Render: $PORT env var)")
    logger.info(f"📂 Base directory: {settings.BASE_DIR}")
    logger.info(f"📂 Data directory: {settings.DATA_DIR}")
    logger.info(f"📚 KB directory: {settings.KB_DIR}")
    logger.info(f"📝 Prompts directory: {settings.PROMPTS_DIR}")
    logger.info(f"📊 Logs directory: {settings.LOGS_DIR}")
    logger.info("-" * 80)
    raw_a = os.getenv("ENABLE_WORKFLOW_A")
    raw_b = os.getenv("ENABLE_WORKFLOW_B")
    logger.info(
        "⚙️  ENABLE_WORKFLOW_A env=%s parsed=%s",
        raw_a,
        settings.ENABLE_WORKFLOW_A,
    )
    logger.info(
        "⚙️  ENABLE_WORKFLOW_B env=%s parsed=%s",
        raw_b,
        settings.ENABLE_WORKFLOW_B,
    )
    logger.info(f"⚙️  KROS matching: {settings.ENABLE_KROS_MATCHING}")
    logger.info("-" * 80)

    # Ensure base project directories exist
    settings.PROJECT_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("✅ Project directories initialized at %s", settings.PROJECT_DIR)

    # Load Knowledge Base
    try:
        from app.core.kb_loader import init_kb_loader

        kb_loader = init_kb_loader()
        logger.info(f"✅ Knowledge Base loaded: {len(kb_loader.data)} categories")

        for category, payload in kb_loader.data.items():
            if isinstance(payload, list):
                logger.info(f"   - {category}: {len(payload)} items")
            elif isinstance(payload, dict):
                logger.info(f"   - {category}: {len(payload)} entries")
            else:
                logger.info(f"   - {category}: loaded")

    except Exception as e:  # noqa: BLE001
        logger.error(f"⚠️  KB loading failed: {str(e)}")

    # Seed calculator suggestions test data
    try:
        from app.services.calculator_suggestions_seed import seed_test_data
        seed_test_data()
        logger.info("✅ Calculator suggestions test data seeded")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"⚠️  Calculator suggestions seed failed: {e}")

    # Apply pending DB migrations + drift check
    # ────────────────────────────────────────────
    # Replaces the cloudbuild `psql -f migrations/*.sql` step that has
    # silently no-op'd since PR #1147 (Cloud Build VM has no /cloudsql/
    # socket mount). Runs in-container where /cloudsql/ IS mounted.
    # On failure: exception propagates → lifespan fails → Cloud Run
    # health check goes red → traffic stays on previous revision.
    # See docs/audits/mcp_status/2026-05-14_cloudsql_connection_bug.md §5.
    if os.getenv("DATABASE_URL") or os.getenv("MCP_DATABASE_URL"):
        try:
            from app.db.startup_migrations import (
                apply_pending_migrations, assert_critical_schema,
            )
            applied = apply_pending_migrations()
            if applied:
                logger.info(f"✅ DB migrations applied: {len(applied)} file(s)")
            else:
                logger.info("✅ DB schema up to date")
            assert_critical_schema()
            logger.info("✅ DB schema drift check passed")
        except Exception as e:  # noqa: BLE001 — fail loudly so traffic doesn't shift
            logger.error(f"🛑 DB migration / drift check failed: {e}")
            raise
    else:
        logger.warning(
            "⚠️  DATABASE_URL not set — skipping startup migrations "
            "(local dev without Postgres)"
        )

    if _mcp_init_error is not None:
        logger.warning(f"⚠️  MCP server not available: {_mcp_init_error}")

    logger.info("=" * 80)
    logger.info("✅ System ready! Listening on 0.0.0.0:%s", os.getenv('PORT', '8000'))
    logger.info("=" * 80)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _run_startup()
    if _mcp_http_app is not None:
        async with _mcp_http_app.lifespan(app):
            yield
    else:
        yield
    logger.info("🛑 Czech Building Audit System shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Czech Building Audit System",
    description="AI-powered construction audit system for Czech market",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration — applied at TWO layers so a stale browser cache or a
# future ASGI quirk in the FastMCP mount can't strip the headers:
#
#   1. `app.add_middleware(CORSMiddleware, ...)` wraps every request,
#      including ones routed to the `/mcp/*` mount. This is the
#      outer/canonical layer.
#   2. An explicit `CORSMiddleware(...)` instance is also wrapped *around
#      the /mcp/ mount* below — defensive belt-and-braces so the
#      `Access-Control-Allow-Origin` + `WWW-Authenticate` headers are
#      always present on responses from the mounted ASGI sub-app, even
#      if a third-party middleware were inserted between them and
#      somehow ate the outer CORS pass.
#
# The two layers share the same config via the `_CORS_*` constants below
# (DRY — origins and expose-headers can't drift between layers).

_CORS_ALLOW_ORIGINS = [
    "https://claude.ai",
    "https://chatgpt.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
]
_CORS_ALLOW_ORIGIN_REGEX = (
    r"https://.*\.(vercel\.app|run\.app)|https://(www\.)?stavagent\.cz"
)
# Browser CORS hides response headers from JavaScript by default — only a
# small CORS-safelist is exposed. ChatGPT's OAuth pop-up and Claude.ai's
# connector iframe both read `WWW-Authenticate` off the 401 from /mcp/ to
# discover the protected-resource metadata URL (RFC 9728 §5.3). Without
# this allow-list entry the discovery chain breaks at the browser layer
# even though the server is correctly emitting the header (curl sees it,
# JS doesn't).
_CORS_EXPOSE_HEADERS = ["WWW-Authenticate"]


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_CORS_ALLOW_ORIGIN_REGEX,
    allow_origins=_CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=_CORS_EXPOSE_HEADERS,
)

# Middleware to exclude /healthcheck from access logs
@app.middleware("http")
async def filter_healthcheck_logs(request: Request, call_next):
    """Exclude /healthcheck requests from access logs."""
    if request.url.path == "/healthcheck":
        # Temporarily disable logger for this request
        import logging
        logging.getLogger("uvicorn.access").disabled = True
        response = await call_next(request)
        logging.getLogger("uvicorn.access").disabled = False
        return response
    return await call_next(request)

# Include API routes
app.include_router(api_router)

# Universal Parser API (v5.0 — independent of old SmartParser pipeline)
from app.api.routes_parser import router as parser_router
app.include_router(parser_router)

# Public MCP health endpoint (Cloud Run uptime checks). Must be declared BEFORE
# `app.mount("/mcp", …)` so Starlette matches the explicit route before the
# mounted FastMCP ASGI app swallows the path.
@app.get("/mcp/health")
@app.head("/mcp/health")
async def mcp_health():
    return {
        "status": "ok",
        "version": app.version,
        "tools": 9,
        "mcp_available": _mcp_http_app is not None,
        "timestamp": int(time.time()),
    }


# RFC 8414 / OpenID Connect Discovery — required by ChatGPT custom
# connectors and Claude.ai MCP integration to learn the authorize +
# token endpoints. Public, no auth. Mounted at root so well-known URIs
# resolve at `/.well-known/oauth-authorization-server`,
# `/.well-known/openid-configuration`, and (RFC 9728)
# `/.well-known/oauth-protected-resource` — not under `/api/v1/mcp/`.

def _external_base_url(request) -> str:
    """Build the externally-visible base URL (`https://host`) for issuer
    + discovery URL construction.

    Cloud Run terminates TLS at the edge load balancer and forwards
    plain HTTP to the container, so `request.url.scheme == "http"`
    even when the public URL is `https://...`. ChatGPT and Claude.ai
    refuse to register a connector whose OAuth metadata advertises
    `http://` endpoints, so we honour the standard `X-Forwarded-Proto`
    hop header (set by Google's front-end) before falling back to
    Starlette's view of the scheme. Local dev without a proxy keeps
    `http://localhost:8000` because the header isn't present there.
    """
    forwarded_proto = (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    )
    if forwarded_proto in ("http", "https"):
        scheme = forwarded_proto
    else:
        scheme = request.url.scheme
    base_url = request.base_url.replace(scheme=scheme)
    return str(base_url).rstrip("/")


def _external_base_url_from_scope(scope) -> str:
    """ASGI-scope variant of `_external_base_url` for use inside
    middleware where no Starlette `Request` object is constructed.

    Reads `x-forwarded-proto` + `host` from the raw header list
    (`scope["headers"]` is `list[tuple[bytes, bytes]]`).
    """
    headers = {k.decode("latin-1").lower(): v.decode("latin-1")
               for k, v in scope.get("headers", [])}
    forwarded_proto = headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    if forwarded_proto in ("http", "https"):
        scheme = forwarded_proto
    else:
        scheme = scope.get("scheme") or "http"
    host = headers.get("host") or "localhost"
    return f"{scheme}://{host}"


def _oauth_discovery_payload(request) -> dict:
    """RFC 8414 authorization-server metadata payload."""
    base = _external_base_url(request)
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/api/v1/mcp/oauth/authorize",
        "token_endpoint": f"{base}/api/v1/mcp/oauth/token",
        "grant_types_supported": ["authorization_code", "client_credentials"],
        "response_types_supported": ["code"],
        "code_challenge_methods_supported": ["S256"],
        # RFC 8707 — clients SHOULD include `resource` parameter to bind
        # the issued token to a specific MCP resource. We accept the
        # parameter today; advertising support tells ChatGPT/Claude.ai
        # to send it so future per-resource token scoping is wire-ready.
        "resource_indicators_supported": True,
        "token_endpoint_auth_methods_supported": [
            "client_secret_post",
            "client_secret_basic",
            "none",
        ],
    }


def _protected_resource_payload(request) -> dict:
    """RFC 9728 protected-resource metadata payload.

    Points clients at the MCP resource (`/mcp/`) and the
    authorization server that issues tokens for it (this same host's
    OAuth 2.0 endpoints).
    """
    base = _external_base_url(request)
    return {
        "resource": f"{base}/mcp/",
        "authorization_servers": [base],
        "bearer_methods_supported": ["header"],
        "scopes_supported": ["mcp:tools", "mcp:read"],
        "resource_documentation": f"{base}/docs",
    }


@app.get("/.well-known/oauth-authorization-server")
@app.get("/.well-known/openid-configuration")
async def oauth_discovery(request: Request):
    """RFC 8414 OAuth-2.0 authorization-server metadata.

    Both well-known URIs return the same payload — ChatGPT custom
    connectors and Claude.ai MCP integration probe one or the other
    depending on the client implementation. The OIDC URI is included
    for compatibility; we don't actually implement OIDC (no id_token,
    no userinfo), but the same OAuth-2.0 metadata is enough for both
    clients to discover the authorize + token endpoints with PKCE.

    Two `@app.get(...)` decorators on one handler so the two routes
    cannot drift apart on future edits — a single source of truth for
    issuer, scheme rewriting, and the supported-grant list.
    """
    return _oauth_discovery_payload(request)


@app.get("/.well-known/oauth-protected-resource")
async def oauth_protected_resource(request: Request):
    """RFC 9728 protected-resource metadata.

    Returned in the `WWW-Authenticate: Bearer ..., resource_metadata=<URL>`
    challenge on the MCP endpoint so unauthenticated clients can
    discover the auth_server that issues tokens for the resource.
    ChatGPT and Claude.ai both follow the RFC 9728 → RFC 8414 chain;
    without the protected-resource hop they fall back to a legacy
    OAuth flow that omits PKCE — which the `/authorize` handler then
    (correctly) rejects with 400 `invalid_request`.
    """
    return _protected_resource_payload(request)


# Mount MCP server (its lifespan is already wired into the FastAPI lifespan above)
#
# The stack from outside-in:
#
#   CORSMiddleware  (outer, app-level — already wraps every request)
#       │
#       └── CORSMiddleware  (this mount only — defensive duplicate so
#               │            response headers are guaranteed present
#               │            even if the outer pass is bypassed by a
#               │            future middleware insertion order change)
#               │
#               └── MCPAuthChallengeMiddleware  (emits WWW-Authenticate
#                       │                        on 401 for anonymous
#                       │                        writes; injects header
#                       │                        onto any inner 401)
#                       │
#                       └── MCPOriginMiddleware  (logs/blocks
#                               │                 non-allowlisted Origin
#                               │                 per Anthropic spec)
#                               │
#                               └── _mcp_http_app  (FastMCP — 9 tools)
#
# Both CORSMiddleware layers use `_CORS_ALLOW_ORIGINS` /
# `_CORS_EXPOSE_HEADERS` so config can't drift. CORSMiddleware.send()
# is idempotent on `Access-Control-Allow-Origin` for matched origins
# (both layers compute the same value), so the double-wrap is safe.
if _mcp_http_app is not None:
    mcp_inner = MCPAuthChallengeMiddleware(MCPOriginMiddleware(_mcp_http_app))
    mcp_with_cors = CORSMiddleware(
        app=mcp_inner,
        allow_origin_regex=_CORS_ALLOW_ORIGIN_REGEX,
        allow_origins=_CORS_ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=_CORS_EXPOSE_HEADERS,
    )
    app.mount("/mcp", mcp_with_cors)
    logger.info(
        "🔌 MCP server mounted at /mcp (9 tools, CORS + RFC 9728 challenge)"
    )

# MCP Auth + Billing + REST API (for GPT Actions)
try:
    from app.mcp.routes import router as mcp_routes
    app.include_router(mcp_routes)
    logger.info("🔑 MCP auth + REST API mounted at /api/v1/mcp/")
except Exception as e:  # noqa: BLE001
    logger.warning(f"⚠️  MCP routes not mounted: {e}")

# Mount static files (if web directory exists)
web_dir = settings.BASE_DIR / "web"
if web_dir.exists():
    app.mount("/web", StaticFiles(directory=str(web_dir)), name="web")
    logger.info(f"📁 Static files mounted: {web_dir}")


# Basic health endpoints for service discovery tooling
@app.get("/")
@app.head("/")
async def root():
    return {"status": "ok", "docs": "/docs"}


@app.get("/health")
@app.head("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/healthcheck")
@app.head("/healthcheck")
async def keep_alive_healthcheck(request: Request):
    """
    Lightweight healthcheck endpoint for Keep-Alive system.

    Validates X-Keep-Alive-Key header to prevent unauthorized access.
    This endpoint is designed to prevent server sleep on free-tier hosting (Render/Fly.io).
    """
    # If X-Keep-Alive-Key header present, validate it
    keep_alive_key = os.getenv("KEEP_ALIVE_KEY")
    provided_key = request.headers.get("X-Keep-Alive-Key")

    if keep_alive_key and provided_key and provided_key != keep_alive_key:
        raise HTTPException(status_code=404, detail="Not found")

    # Return minimal response (Cloud Run health probe + Keep-Alive compatible)
    return {"status": "alive", "service": "concrete-agent"}


if __name__ == "__main__":
    import uvicorn
    # Use PORT env var (Render requirement) or fallback to 8000 for local dev
    port = int(os.getenv("PORT", 8000))
    logger.info(f"🚀 Starting uvicorn on 0.0.0.0:{port}")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
