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

import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
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
# PDF Norm Ingestion Pipeline
# ---------------------------------------------------------------------------

@router.post("/ingest-pdf")
async def ingest_norm_pdf(
    file: UploadFile = File(...),
    skip_perplexity: bool = Form(False),
    auto_save: bool = Form(False),
):
    """
    Ingest a normative PDF through the full 4-layer pipeline.

    Pipeline: PDF → pdfplumber/MinerU → Regex (conf=1.0)
              → Gemini Flash (conf=0.7) → Perplexity (conf=0.85)
              → Compile rules for NKB

    Args:
        file: PDF document to ingest
        skip_perplexity: Skip Perplexity verification (faster)
        auto_save: Auto-save extracted rules to NKB
    """
    from app.services.norm_ingestion_pipeline import NormIngestionPipeline
    from pathlib import Path

    filename = file.filename or "unknown.pdf"
    ext = Path(filename).suffix.lower()
    if ext not in (".pdf",):
        raise HTTPException(status_code=400, detail="Only PDF files supported for norm ingestion")

    content = await file.read()
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        result = await NormIngestionPipeline.ingest(
            file_path=tmp_path,
            file_bytes=content,
            filename=filename,
            skip_perplexity=skip_perplexity,
        )

        # Auto-save extracted rules to NKB store
        saved_rules = 0
        if auto_save and result.extracted_rules:
            store = get_norm_store()
            for rule_data in result.extracted_rules:
                try:
                    from app.models.norm_schemas import NormativeRule, RuleType
                    rule_type_str = rule_data.get("rule_type", "requirement")
                    try:
                        rt = RuleType(rule_type_str)
                    except ValueError:
                        rt = RuleType.REQUIREMENT

                    rule = NormativeRule(
                        rule_id=rule_data.get("rule_id", f"auto_{saved_rules}"),
                        norm_id=rule_data.get("norm_id", "AUTO_INGEST"),
                        rule_type=rt,
                        title=str(rule_data.get("value", ""))[:200],
                        description=rule_data.get("context", ""),
                        priority=int(rule_data.get("confidence", 0.5) * 100),
                    )
                    store.add_rule(rule)
                    saved_rules += 1
                except Exception as e:
                    logger.debug("Failed to auto-save rule: %s", e)

        logger.info(
            "[NKB] PDF ingestion complete: %s — %d rules extracted, %d saved",
            filename, len(result.extracted_rules), saved_rules,
        )

        return {
            "status": "completed",
            "filename": filename,
            "stats": result.stats,
            "rules": result.extracted_rules,
            "verified_norms": result.verified_norms,
            "supplemented_data": result.supplemented_data,
            "ai_summary": result.ai_summary,
            "needs_human_review": [
                r for r in result.extracted_rules if r.get("needs_human_review")
            ],
            "auto_saved": saved_rules,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[NKB] PDF ingestion error: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"Ingestion failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def nkb_stats():
    """Get NKB statistics."""
    store = get_norm_store()
    return store.stats()
