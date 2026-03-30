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
from app.api.routes_multi_role import router as multi_role_router
from app.api.routes_summary import router as summary_router
from app.api.routes_workflow_c import router as workflow_c_router
from app.api.routes_accumulator import router as accumulator_router
from app.api.routes_google import router as google_router
from app.api.routes_passport import router as passport_router
from app.api.routes_kb_research import router as kb_research_router
from app.api.routes_price_parser import router as price_parser_router
from app.api.routes_betonarny_discovery import router as betonarny_router
from app.api.routes_vertex import router as vertex_router
from app.api.routes_document_search import router as document_search_router
from app.api.routes_norms_scraper import router as norms_scraper_router
from app.api.routes_llm_status import router as llm_status_router
from app.api.routes_project_documents import router as project_documents_router
from app.api.routes_nkb import router as nkb_router
from app.api.routes_norm_audit import router as norm_audit_router
from app.api.routes_items import router as items_router
from app.api.routes_scenario_b import router as scenario_b_router
from app.api.routes_soupis import router as soupis_router

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
api_router.include_router(multi_role_router)      # /api/v1/multi-role/*
api_router.include_router(summary_router)         # /api/v1/summary/*
api_router.include_router(workflow_c_router)      # /api/v1/workflow/c/*
api_router.include_router(accumulator_router)     # /api/v1/accumulator/* (Document Accumulator)
api_router.include_router(google_router)          # /api/v1/google/* (Google Drive Integration)
api_router.include_router(passport_router)        # /api/v1/passport/* (Project Passport)
api_router.include_router(kb_research_router)     # /api/v1/kb/* (KB Research)
api_router.include_router(price_parser_router)    # /api/v1/price-parser/* (Price List Parser)
api_router.include_router(betonarny_router)       # /api/v1/betonarny/* (Betonárny Discovery)
api_router.include_router(vertex_router)          # /api/v1/vertex/* (Vertex AI Search)
api_router.include_router(document_search_router) # /api/search/* (Hybrid Document Search)
api_router.include_router(norms_scraper_router)  # /api/v1/norms/* (Methvin Norms Scraper)
api_router.include_router(llm_status_router)     # /api/v1/llm/status (LLM health + probe)
api_router.include_router(project_documents_router)  # /api/v1/project/{id}/add-document, documents, status
api_router.include_router(nkb_router)                  # /api/v1/nkb/* (Normative Knowledge Base)
api_router.include_router(norm_audit_router)           # /api/v1/nkb/audit/* (NKB Audit & Gap Analysis)
api_router.include_router(items_router)                # /api/v1/items/* (Unified Item Layer)
api_router.include_router(scenario_b_router)           # /api/v1/scenario-b/* (TZ → Výkaz výměr)
api_router.include_router(soupis_router)               # /api/v1/soupis/* (TZ → Soupis prací pipeline)

__all__ = ["api_router"]
