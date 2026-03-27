"""
NKB API Routes — Normative Knowledge Base endpoints.

Layer 1: GET /norms, GET /norms/:id, POST /norms/search, POST /norms/ingest
Layer 2: GET /norms/rules, GET /norms/rules/:id, POST /norms/rules/search
Layer 3: POST /project/{id}/check-compliance, POST /norms/advisor
Stats:   GET /norms/stats

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.models.norm_schemas import (
    AdvisorContext,
    AdvisorResponse,
    ComplianceReport,
    NormativeDocument,
    NormativeRule,
    NormSearchQuery,
    RuleSearchQuery,
)
from app.services.norm_storage import get_norm_store
from app.services.norm_matcher import match_norms, match_rules, check_compliance
from app.services.norm_advisor import get_advisor_recommendations

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/nkb", tags=["NKB"])


# ---------------------------------------------------------------------------
# Layer 1: Registry — Norms
# ---------------------------------------------------------------------------

@router.get("/norms", response_model=List[NormativeDocument])
async def list_norms(
    category: Optional[str] = Query(None, description="Filter by NormCategory"),
    construction_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(50, le=200),
):
    """List all norms, optionally filtered."""
    store = get_norm_store()
    query = NormSearchQuery(
        category=category,
        construction_type=construction_type,
        active_only=active_only,
        limit=limit,
    )
    return store.search_norms(query)


@router.get("/norms/{norm_id}", response_model=NormativeDocument)
async def get_norm(norm_id: str):
    """Get a single norm by ID."""
    store = get_norm_store()
    norm = store.get_norm(norm_id)
    if not norm:
        raise HTTPException(status_code=404, detail=f"Norm {norm_id} not found")
    return norm


@router.post("/norms/search", response_model=List[NormativeDocument])
async def search_norms(query: NormSearchQuery):
    """Search norms with full filter options."""
    store = get_norm_store()
    return store.search_norms(query)


@router.post("/norms/ingest", response_model=NormativeDocument)
async def ingest_norm(doc: NormativeDocument):
    """Add or update a norm in the registry."""
    store = get_norm_store()
    store.add_norm(doc)
    logger.info(f"[NKB] Ingested norm: {doc.norm_id} ({doc.designation})")
    return doc


# ---------------------------------------------------------------------------
# Layer 2: Rules
# ---------------------------------------------------------------------------

@router.get("/rules", response_model=List[NormativeRule])
async def list_rules(
    norm_id: Optional[str] = Query(None),
    rule_type: Optional[str] = Query(None),
    mandatory_only: bool = Query(False),
    limit: int = Query(100, le=500),
):
    """List rules, optionally filtered by norm or type."""
    store = get_norm_store()
    query = RuleSearchQuery(
        norm_id=norm_id,
        rule_type=rule_type,
        mandatory_only=mandatory_only,
        limit=limit,
    )
    return store.search_rules(query)


@router.get("/rules/{rule_id}", response_model=NormativeRule)
async def get_rule(rule_id: str):
    """Get a single rule by ID."""
    store = get_norm_store()
    rule = store.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    return rule


@router.post("/rules/search", response_model=List[NormativeRule])
async def search_rules(query: RuleSearchQuery):
    """Search rules with full filter options."""
    store = get_norm_store()
    return store.search_rules(query)


@router.post("/rules/ingest", response_model=NormativeRule)
async def ingest_rule(rule: NormativeRule):
    """Add or update a rule."""
    store = get_norm_store()
    # Validate parent norm exists
    if not store.get_norm(rule.norm_id):
        raise HTTPException(
            status_code=400,
            detail=f"Parent norm {rule.norm_id} not found. Ingest the norm first.",
        )
    store.add_rule(rule)
    logger.info(f"[NKB] Ingested rule: {rule.rule_id} (norm: {rule.norm_id})")
    return rule


# ---------------------------------------------------------------------------
# Layer 3: Compliance & Advisor
# ---------------------------------------------------------------------------

class ComplianceRequest(BaseModel):
    document_data: dict = {}
    construction_type: Optional[str] = None
    phase: Optional[str] = None


@router.post("/project/{project_id}/check-compliance", response_model=ComplianceReport)
async def check_project_compliance(project_id: str, req: ComplianceRequest):
    """
    Check a project's documents against NKB rules.

    document_data should contain:
    - materials: list of {name, spec, ...}
    - standards: list of standard references
    - objects: list of object types
    - searchable_text: document text for analysis
    """
    report = check_compliance(
        project_id=project_id,
        document_data=req.document_data,
        construction_type=req.construction_type,
        phase=req.phase,
    )
    logger.info(
        f"[NKB] Compliance check for {project_id}: "
        f"{report.passed}/{report.total_rules_checked} passed, "
        f"{report.violations} violations, score={report.score:.2f}"
    )
    return report


@router.post("/advisor", response_model=AdvisorResponse)
async def get_advisor(context: AdvisorContext):
    """
    Get AI-powered norm recommendations.

    Combines deterministic rule matching with Gemini analysis
    and optional Perplexity web-search verification.
    """
    response = await get_advisor_recommendations(context)
    logger.info(
        f"[NKB Advisor] {response.matched_norms} norms, "
        f"{response.matched_rules} rules, "
        f"{len(response.recommendations)} recommendations"
    )
    return response


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def nkb_stats():
    """Get NKB statistics."""
    store = get_norm_store()
    return store.stats()
