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

# Create FastAPI app
app = FastAPI(
    title="Czech Building Audit System",
    description="AI-powered construction audit system for Czech market",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
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
    
    logger.info("=" * 80)
    logger.info("✅ System ready!")
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
    # Get the Keep-Alive key from environment
    keep_alive_key = os.getenv("KEEP_ALIVE_KEY")

    # If no key is configured, disable this endpoint
    if not keep_alive_key:
        raise HTTPException(status_code=404, detail="Not found")

    # Validate the X-Keep-Alive-Key header
    provided_key = request.headers.get("X-Keep-Alive-Key")

    if provided_key != keep_alive_key:
        # Return 404 instead of 403 to hide endpoint existence
        raise HTTPException(status_code=404, detail="Not found")

    # Return minimal response (no DB queries, no heavy processing)
    return {"status": "alive", "service": "concrete-agent"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
