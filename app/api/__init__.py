"""
API Package initialization
Правильное подключение всех routerов с обновленными prefixes
"""
from fastapi import APIRouter

# Import всех routerів
from app.api.routes import router as main_router
from app.api.routes_workflow_a import (
    router as workflow_a_router,
    legacy_router as workflow_a_legacy_router,
)
from app.api.routes_workflow_b import router as workflow_b_router
from app.api.routes_chat import router as chat_router
from app.api.pdf_extraction_routes import router as pdf_router
from app.api.routes_agents import router as agents_router

# Création hlavního API routeru
api_router = APIRouter()

# Připojení всех routerů
api_router.include_router(main_router)
api_router.include_router(workflow_a_router)      # /api/workflow/a/*
api_router.include_router(workflow_a_legacy_router)  # /api/workflow-a/* (legacy compatibility)
api_router.include_router(workflow_b_router)      # /api/workflow/b/*
api_router.include_router(chat_router)            # /api/chat/*
api_router.include_router(pdf_router)             # /api/pdf/*
api_router.include_router(agents_router)          # /api/agents/*

__all__ = ["api_router"]
