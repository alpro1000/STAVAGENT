"""
FastAPI Application Entry Point
Czech Building Audit System
"""
import logging
import os
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

# Create FastAPI app
app = FastAPI(
    title="Czech Building Audit System",
    description="AI-powered construction audit system for Czech market",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
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

# Mount static files (if web directory exists)
web_dir = settings.BASE_DIR / "web"
if web_dir.exists():
    app.mount("/web", StaticFiles(directory=str(web_dir)), name="web")
    logger.info(f"📁 Static files mounted: {web_dir}")


@app.on_event("startup")
async def startup_event():
    """Application startup"""
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
        
        # Log each category
        for category, payload in kb_loader.data.items():
            if isinstance(payload, list):
                logger.info(f"   - {category}: {len(payload)} items")
            elif isinstance(payload, dict):
                logger.info(f"   - {category}: {len(payload)} entries")
            else:
                logger.info(f"   - {category}: loaded")
                
    except Exception as e:
        logger.error(f"⚠️  KB loading failed: {str(e)}")
    
    # Seed calculator suggestions test data
    try:
        from app.services.calculator_suggestions_seed import seed_test_data
        seed_test_data()
        logger.info("✅ Calculator suggestions test data seeded")
    except Exception as e:
        logger.warning(f"⚠️  Calculator suggestions seed failed: {e}")

    logger.info("=" * 80)
    logger.info("✅ System ready! Listening on 0.0.0.0:%s", os.getenv('PORT', '8000'))
    logger.info("=" * 80)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("🛑 Czech Building Audit System shutting down...")


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
