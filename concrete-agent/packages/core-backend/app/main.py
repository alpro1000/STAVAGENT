"""
FastAPI Application Entry Point
Czech Building Audit System
"""
import logging
import os
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

# CORS middleware - Allow all STAVAGENT services
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.(vercel\.app|run\.app)|https://(www\.)?stavagent\.cz",
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# Mount MCP server (its lifespan is already wired into the FastAPI lifespan above)
if _mcp_http_app is not None:
    app.mount("/mcp", MCPOriginMiddleware(_mcp_http_app))
    logger.info("🔌 MCP server mounted at /mcp (9 tools)")

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
