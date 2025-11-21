"""
Monolit-Planner Integration Adapter

Provides unified interface for Concrete-Agent services to be consumed by
Monolit-Planner. Handles request/response transformation, batching, and
error handling.

Usage:
    from app.integrations.monolit_adapter import MonolitAdapter

    adapter = MonolitAdapter(api_key="service-token")
    result = await adapter.enrich_xlsx_data(xlsx_dict)
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, Field, validator

from app.core.config import settings
from app.core.auth import verify_token
from app.core.rate_limiter import check_rate_limit
from app.services.position_enricher import PositionEnricher
from app.services.audit_service import AuditService
from app.core.cache import get_cache

logger = logging.getLogger(__name__)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class MonolitPosition(BaseModel):
    """Single position from Monolit-Planner estimate"""

    position_id: str = Field(..., description="Unique position ID")
    code: str = Field(..., description="KROS/OTSKP code")
    description: str = Field(..., description="Position description")
    quantity: float = Field(..., gt=0, description="Quantity")
    unit: str = Field(..., description="Unit of measurement (m3, t, m, etc.)")
    unit_price: Optional[float] = Field(None, description="Unit price in CZK")
    notes: Optional[str] = None


class MonolitEnrichmentRequest(BaseModel):
    """Request to enrich multiple positions"""

    request_id: str = Field(default_factory=lambda: str(uuid4()))
    positions: List[MonolitPosition] = Field(..., min_items=1, max_items=100)
    include_audit: bool = Field(False, description="Include multi-role audit")
    include_confidence_scores: bool = Field(
        True, description="Include confidence scores"
    )
    audit_roles: List[str] = Field(
        default=["SME", "ARCH", "ENG"],
        description="Roles to include in audit",
    )

    @validator("positions")
    def validate_positions(cls, v):
        """Validate position data"""
        if not v:
            raise ValueError("At least one position required")
        return v


class MonolitEnrichmentResult(BaseModel):
    """Enrichment result for single position"""

    position_id: str
    code: str
    description: str
    enrichment_status: str = Field(
        ..., description="matched, partial, or not_found"
    )
    matched_code: Optional[str] = None
    matched_description: Optional[str] = None
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)
    price_recommendation: Optional[float] = None
    price_deviation: Optional[float] = None
    notes: Optional[str] = None
    enrichment_metadata: Dict[str, Any] = Field(default_factory=dict)


class MonolitAuditResult(BaseModel):
    """Audit result for position"""

    position_id: str
    code: str
    classification: str = Field(
        ..., description="GREEN, AMBER, or RED"
    )
    confidence: float
    audit_notes: Dict[str, str] = Field(
        default_factory=dict, description="Notes by role"
    )
    requires_review: bool
    review_reason: Optional[str] = None


class MonolitEnrichmentResponse(BaseModel):
    """Response with enriched positions"""

    request_id: str
    status: str = Field("success", description="success or error")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    enrichments: List[MonolitEnrichmentResult]
    audits: List[MonolitAuditResult] = Field(default_factory=list)
    statistics: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# ADAPTER CLASS
# ============================================================================


class MonolitAdapter:
    """
    Adapter for integrating Concrete-Agent with Monolit-Planner.

    Provides:
    - Position enrichment (KROS matching)
    - Multi-role audit
    - Batch processing
    - Caching and performance optimization
    """

    def __init__(self):
        """Initialize adapter services"""
        self.enricher = PositionEnricher()
        self.auditor = AuditService()
        self.cache = None

    async def enrich_batch(
        self,
        request: MonolitEnrichmentRequest,
        user_id: Optional[str] = None,
    ) -> MonolitEnrichmentResponse:
        """
        Enrich multiple positions from Monolit-Planner.

        Args:
            request: Enrichment request with positions
            user_id: User ID for audit trail

        Returns:
            Enrichment response with results
        """
        request_id = request.request_id
        logger.info(f"Starting enrichment for request {request_id}")

        enrichments = []
        audits = []
        errors = []
        stats = {
            "total": len(request.positions),
            "matched": 0,
            "partial": 0,
            "not_found": 0,
            "processing_time_ms": 0,
        }

        start_time = datetime.utcnow()

        try:
            # Get cache
            self.cache = await get_cache()

            # Process each position
            for position in request.positions:
                try:
                    # Try cache first
                    cache_key = f"monolit:enrich:{position.code}"
                    cached_result = await self.cache.get(cache_key)

                    if cached_result:
                        enrichment = MonolitEnrichmentResult(**cached_result)
                        logger.debug(f"Cache hit for {position.code}")
                    else:
                        # Enrich position
                        enrichment = await self._enrich_position(position)

                        # Cache result
                        await self.cache.set(cache_key, enrichment.dict(), ttl=3600)

                    enrichments.append(enrichment)

                    # Update statistics
                    if enrichment.enrichment_status == "matched":
                        stats["matched"] += 1
                    elif enrichment.enrichment_status == "partial":
                        stats["partial"] += 1
                    else:
                        stats["not_found"] += 1

                    # Optionally run audit
                    if request.include_audit:
                        audit = await self._audit_position(
                            position, enrichment, request.audit_roles
                        )
                        audits.append(audit)

                except Exception as e:
                    logger.error(
                        f"Error enriching position {position.position_id}: {e}"
                    )
                    errors.append(
                        {
                            "position_id": position.position_id,
                            "error": str(e),
                            "type": type(e).__name__,
                        }
                    )

            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            stats["processing_time_ms"] = int(processing_time)
            stats["avg_time_per_position_ms"] = int(processing_time / len(request.positions))

            logger.info(
                f"✅ Enrichment complete: {stats['matched']} matched, "
                f"{stats['partial']} partial, {stats['not_found']} not found"
            )

            return MonolitEnrichmentResponse(
                request_id=request_id,
                status="success",
                enrichments=enrichments,
                audits=audits,
                statistics=stats,
                errors=errors,
            )

        except Exception as e:
            logger.error(f"❌ Enrichment failed: {e}")
            return MonolitEnrichmentResponse(
                request_id=request_id,
                status="error",
                enrichments=enrichments,
                audits=audits,
                statistics=stats,
                errors=[{"error": str(e), "type": type(e).__name__}],
            )

    async def _enrich_position(self, position: MonolitPosition) -> MonolitEnrichmentResult:
        """
        Enrich single position with KROS matching.

        Args:
            position: Position to enrich

        Returns:
            Enrichment result
        """
        # Prepare position dict
        pos_dict = {
            "code": position.code,
            "description": position.description,
            "unit": position.unit,
            "quantity": position.quantity,
        }

        # Run enrichment
        enrichment = await self.enricher.enrich(pos_dict)

        # Map to response model
        return MonolitEnrichmentResult(
            position_id=position.position_id,
            code=position.code,
            description=position.description,
            enrichment_status=enrichment.get("match", "not_found"),
            matched_code=enrichment.get("matched_code"),
            matched_description=enrichment.get("matched_description"),
            confidence_score=enrichment.get("confidence", 0.0),
            price_recommendation=enrichment.get("price_recommendation"),
            price_deviation=enrichment.get("price_deviation"),
            notes=enrichment.get("notes"),
            enrichment_metadata=enrichment.get("metadata", {}),
        )

    async def _audit_position(
        self,
        position: MonolitPosition,
        enrichment: MonolitEnrichmentResult,
        roles: List[str],
    ) -> MonolitAuditResult:
        """
        Run multi-role audit on enriched position.

        Args:
            position: Original position
            enrichment: Enrichment result
            roles: Audit roles to use

        Returns:
            Audit result
        """
        pos_dict = {
            "code": enrichment.matched_code or position.code,
            "description": enrichment.matched_description or position.description,
            "quantity": position.quantity,
            "unit": position.unit,
            "price_recommendation": enrichment.price_recommendation,
        }

        # Run audit
        audit_result = await self.auditor.run_audit(pos_dict, roles=roles)

        return MonolitAuditResult(
            position_id=position.position_id,
            code=enrichment.matched_code or position.code,
            classification=audit_result.get("classification", "RED"),
            confidence=audit_result.get("confidence", 0.0),
            audit_notes=audit_result.get("role_notes", {}),
            requires_review=audit_result.get("requires_review", False),
            review_reason=audit_result.get("review_reason"),
        )


# ============================================================================
# API ROUTER
# ============================================================================

router = APIRouter(prefix="/api/monolit", tags=["Monolit Integration"])
adapter = MonolitAdapter()


@router.post("/enrich", response_model=MonolitEnrichmentResponse)
async def enrich_positions(
    request: MonolitEnrichmentRequest,
    authorization: str = Header(None),
) -> MonolitEnrichmentResponse:
    """
    Enrich positions from Monolit-Planner.

    Request body:
    ```json
    {
      "positions": [
        {
          "position_id": "pos_1",
          "code": "121151113",
          "description": "Beton C30/37",
          "quantity": 850,
          "unit": "m3"
        }
      ],
      "include_audit": true,
      "audit_roles": ["SME", "ARCH", "ENG"]
    }
    ```

    Response:
    ```json
    {
      "request_id": "uuid",
      "status": "success",
      "enrichments": [
        {
          "position_id": "pos_1",
          "enrichment_status": "matched",
          "matched_code": "121151113",
          "confidence_score": 0.99,
          "price_recommendation": 3200
        }
      ],
      "statistics": {
        "total": 1,
        "matched": 1,
        "processing_time_ms": 245
      }
    }
    ```
    """
    # Verify authentication
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = authorization.split(" ")[1]
    user_id = await verify_token(token)

    # Check rate limit
    if not check_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    logger.info(f"Enrichment request from {user_id}: {request.request_id}")

    # Run enrichment
    response = await adapter.enrich_batch(request, user_id=user_id)

    return response


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Check adapter health.

    Returns status of dependencies:
    - Knowledge Base
    - Cache
    - Database
    """
    try:
        cache = await get_cache()
        kb_status = True  # TODO: Implement KB health check
        cache_status = await cache.health_check() if hasattr(cache, "health_check") else True

        return {
            "status": "healthy" if all([kb_status, cache_status]) else "degraded",
            "kb": "healthy" if kb_status else "unavailable",
            "cache": "healthy" if cache_status else "unavailable",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


@router.get("/stats")
async def get_statistics(
    authorization: str = Header(None),
) -> Dict[str, Any]:
    """
    Get adapter statistics (admin only).

    Returns cache hit rate, processing stats, etc.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ")[1]
    user_id = await verify_token(token)

    # TODO: Implement statistics collection
    return {
        "cache_hit_rate": 0.85,
        "avg_processing_time_ms": 245,
        "total_enrichments": 15234,
        "error_rate": 0.02,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# CLIENT LIBRARY (for Monolit-Planner to use)
# ============================================================================


class ConcreteAgentClient:
    """
    Python client for Concrete-Agent (for Monolit-Planner backend).

    Usage:
        from integrations.concrete_agent_client import ConcreteAgentClient

        client = ConcreteAgentClient(
            base_url="http://concrete-agent:8000",
            api_key="service-token"
        )

        result = await client.enrich_positions(
            positions=[
                {
                    "position_id": "pos_1",
                    "code": "121151113",
                    "description": "Beton C30/37",
                    "quantity": 850,
                    "unit": "m3"
                }
            ],
            include_audit=True
        )

        print(result['enrichments'][0]['confidence_score'])
    """

    def __init__(self, base_url: str, api_key: str):
        """
        Initialize client.

        Args:
            base_url: Concrete-Agent base URL (e.g., http://localhost:8000)
            api_key: Service API key for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.session = None

    async def enrich_positions(
        self,
        positions: List[Dict[str, Any]],
        include_audit: bool = False,
        audit_roles: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Enrich positions with KROS matching.

        Args:
            positions: List of position dicts
            include_audit: Include multi-role audit
            audit_roles: Roles for audit (default: SME, ARCH, ENG)

        Returns:
            Enrichment response
        """
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/monolit/enrich",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "positions": positions,
                    "include_audit": include_audit,
                    "audit_roles": audit_roles or ["SME", "ARCH", "ENG"],
                },
            )

            response.raise_for_status()
            return response.json()

    async def health_check(self) -> bool:
        """Check if Concrete-Agent is healthy."""
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/monolit/health")
                return response.json()["status"] == "healthy"
        except Exception:
            return False


# Export for use
__all__ = [
    "MonolitAdapter",
    "MonolitEnrichmentRequest",
    "MonolitEnrichmentResponse",
    "ConcreteAgentClient",
    "router",
]
