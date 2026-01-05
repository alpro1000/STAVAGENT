"""
Multi-Role AI System API Routes

This module provides endpoints for the multi-role AI system that orchestrates
specialized AI agents (Structural Engineer, Concrete Specialist, etc.) to
answer construction engineering questions.

Features:
- Automatic task classification
- Multi-role orchestration with consensus
- Knowledge Base integration (B1-B9)
- Perplexity integration for live standards search
- Intelligent caching
- Learning from user feedback
"""

import logging
import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.task_classifier import classify_task, TaskClassification
from app.services.orchestrator import execute_multi_role, FinalOutput
from app.services.orchestrator_hybrid import HybridMultiRoleOrchestrator
from app.core.config import settings
from app.core.kb_loader import KnowledgeBaseLoader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/multi-role", tags=["multi-role"])

# ============================================================================
# GLOBAL INSTANCES
# ============================================================================

# Knowledge Base loader (singleton)
_kb_loader: Optional[KnowledgeBaseLoader] = None
_kb_data: Optional[Dict[str, Any]] = None

# Cache storage
_response_cache: Dict[str, Dict[str, Any]] = {}

# Interaction log storage
_interaction_log: List[Dict[str, Any]] = []


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class AskRequest(BaseModel):
    """Request model for asking questions"""

    question: str = Field(
        ...,
        description="The construction engineering question to ask",
        min_length=3,
        max_length=2000,
        examples=["What's the OTSKP code for concrete foundation?"]
    )

    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional context (project data, files, etc.)"
    )

    project_id: Optional[str] = Field(
        default=None,
        description="Optional project ID to attach context"
    )

    enable_kb: bool = Field(
        default=True,
        description="Enable Knowledge Base context (B1-B9)"
    )

    enable_perplexity: bool = Field(
        default=False,
        description="Enable Perplexity search for live standards"
    )

    use_cache: bool = Field(
        default=True,
        description="Use cached responses for repeated questions"
    )

    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for conversation tracking"
    )

    parallel: bool = Field(
        default=True,
        description="Use parallel execution (3-4x faster, enabled by default)"
    )


class ConflictResponse(BaseModel):
    """Conflict between roles"""
    conflict_type: str
    roles_involved: List[str]
    descriptions: List[str]
    resolution: Optional[str] = None
    winner: Optional[str] = None


class AskResponse(BaseModel):
    """Response model with structured answer"""

    success: bool = Field(default=True)

    answer: str = Field(
        ...,
        description="The final answer from the multi-role system"
    )

    status: str = Field(
        ...,
        description="Overall status: ✅ OK / ⚠️ WARNINGS / ❌ CRITICAL"
    )

    complexity: str = Field(
        ...,
        description="Task complexity: simple/standard/complex/creative"
    )

    roles_consulted: List[str] = Field(
        ...,
        description="List of roles that were consulted"
    )

    conflicts: List[ConflictResponse] = Field(
        default_factory=list,
        description="Conflicts detected and resolved"
    )

    warnings: List[str] = Field(
        default_factory=list,
        description="Warning messages"
    )

    critical_issues: List[str] = Field(
        default_factory=list,
        description="Critical issues found"
    )

    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall confidence score (0-1)"
    )

    total_tokens: int = Field(
        ...,
        description="Total tokens used"
    )

    execution_time_seconds: float = Field(
        ...,
        description="Execution time in seconds"
    )

    kb_context_used: bool = Field(
        default=False,
        description="Whether Knowledge Base context was used"
    )

    perplexity_used: bool = Field(
        default=False,
        description="Whether Perplexity search was used"
    )

    from_cache: bool = Field(
        default=False,
        description="Whether response was served from cache"
    )

    timestamp: str = Field(
        ...,
        description="Response timestamp (ISO format)"
    )

    interaction_id: str = Field(
        ...,
        description="Unique interaction ID for feedback"
    )

    execution_mode: str = Field(
        default="parallel",
        description="Execution mode: 'parallel' (fast) or 'sequential' (legacy)"
    )

    parallel_speedup: Optional[float] = Field(
        default=None,
        description="Parallel speedup factor (e.g., 2.5x) when parallel mode is used"
    )

    stage_times_ms: Optional[Dict[str, int]] = Field(
        default=None,
        description="Time per stage in ms: {'first': 5000, 'parallel': 8000, 'last': 3000}"
    )


class FeedbackRequest(BaseModel):
    """User feedback on a response"""

    interaction_id: str = Field(
        ...,
        description="The interaction ID to provide feedback for"
    )

    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Rating from 1 (poor) to 5 (excellent)"
    )

    helpful: bool = Field(
        ...,
        description="Was the answer helpful?"
    )

    correct: Optional[bool] = Field(
        default=None,
        description="Was the answer technically correct?"
    )

    comment: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional feedback comment"
    )

    correction: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Suggested correction (for learning)"
    )


class FeedbackResponse(BaseModel):
    """Feedback submission response"""
    success: bool = Field(default=True)
    message: str = Field(...)
    feedback_id: str = Field(...)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_kb_loader() -> KnowledgeBaseLoader:
    """Get or create Knowledge Base loader singleton"""
    global _kb_loader, _kb_data

    if _kb_loader is None:
        kb_dir = settings.BASE_DIR / "app" / "knowledge_base"
        _kb_loader = KnowledgeBaseLoader(kb_dir)

        if not kb_dir.exists():
            logger.warning(f"⚠️ Knowledge Base directory not found: {kb_dir}")
            _kb_data = {}
        else:
            try:
                _kb_data = _kb_loader.load_all()
                logger.info(f"✅ Knowledge Base loaded: {len(_kb_data)} categories")
            except Exception as e:
                logger.error(f"❌ Failed to load Knowledge Base: {e}")
                _kb_data = {}

    return _kb_loader


def build_kb_context(
    question: str,
    kb_data: Dict[str, Any],
    max_context_size: int = 3000
) -> Optional[str]:
    """
    Build relevant Knowledge Base context for a question

    Intelligently selects relevant data from B1-B9 based on keywords.

    Args:
        question: The user's question
        kb_data: Loaded Knowledge Base data
        max_context_size: Maximum context size in characters

    Returns:
        Formatted context string or None
    """
    if not kb_data:
        return None

    question_lower = question.lower()
    context_parts = []

    # Keyword-based selection
    keywords = {
        "B1_otkskp_codes": ["otskp", "kód", "code", "katalog", "položka"],
        "B1_rts_codes": ["rts", "cena", "price", "cenov"],
        "B1_urs_codes": ["úrs", "urs", "norma času", "normočas"],
        "B2_csn_standards": ["čsn", "en", "standard", "norma", "exposure", "třída"],
        "B3_current_prices": ["cena", "price", "kolik stojí", "cost"],
        "B4_production_benchmarks": ["výkon", "produkce", "production", "benchmark"],
        "B5_tech_cards": ["technolog", "postup", "procedure", "tech card"],
        "B9_Equipment_Specs": ["trubka", "pipe", "sdr", "průměr", "diameter"]
    }

    # Check which categories are relevant
    relevant_categories = []
    for category, kws in keywords.items():
        if any(kw in question_lower for kw in kws):
            relevant_categories.append(category)

    # If no specific keywords, use B1 and B2 by default
    if not relevant_categories:
        relevant_categories = ["B1_otkskp_codes", "B2_csn_standards"]

    # Build context from relevant categories
    for category in relevant_categories:
        if category not in kb_data:
            continue

        category_data = kb_data[category]

        # Format category data (simplified)
        if isinstance(category_data, dict):
            # Take first few entries
            for key, value in list(category_data.items())[:3]:
                context_parts.append(f"{category} - {key}: {str(value)[:200]}...")

        # Stop if context is getting too large
        current_size = sum(len(p) for p in context_parts)
        if current_size > max_context_size:
            break

    if not context_parts:
        return None

    return "\n\n".join(context_parts)


def generate_cache_key(question: str, context: Optional[Dict] = None) -> str:
    """Generate cache key for a question + context"""
    # Normalize question
    normalized_question = question.lower().strip()

    # Create hash
    hash_input = normalized_question
    if context:
        # Include relevant context keys only
        context_str = json.dumps(context, sort_keys=True)
        hash_input += context_str

    return hashlib.md5(hash_input.encode()).hexdigest()


def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get response from cache if available and fresh"""
    if cache_key not in _response_cache:
        return None

    cached = _response_cache[cache_key]
    cached_at = datetime.fromisoformat(cached["cached_at"])
    age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600

    # Cache valid for 24 hours
    if age_hours > 24:
        del _response_cache[cache_key]
        return None

    return cached


def save_to_cache(cache_key: str, response_data: Dict[str, Any]) -> None:
    """Save response to cache"""
    _response_cache[cache_key] = {
        **response_data,
        "cached_at": datetime.now(timezone.utc).isoformat()
    }

    # Limit cache size
    if len(_response_cache) > 1000:
        # Remove oldest entries
        sorted_keys = sorted(
            _response_cache.keys(),
            key=lambda k: _response_cache[k]["cached_at"]
        )
        for key in sorted_keys[:100]:
            del _response_cache[key]


async def search_perplexity(question: str) -> Optional[str]:
    """
    Search Perplexity for live standards and norms

    Intelligently detects query type and uses appropriate search:
    - KROS/RTS codes → search_kros_code()
    - ČSN standards → search_csn_standard()
    - Market prices → search_market_price()
    - General query → generic search

    Args:
        question: User's question

    Returns:
        Formatted search results or None if disabled/failed
    """
    try:
        from app.core.perplexity_client import get_perplexity_client

        client = get_perplexity_client()
        if not client:
            logger.debug("Perplexity client not available (API key not set)")
            return None

        logger.info(f"🔍 Perplexity search for: {question[:80]}...")

        question_lower = question.lower()

        # Detect query type and route to appropriate method

        # 1. KROS/RTS code search
        if any(kw in question_lower for kw in ["otskp", "kros", "rts", "úrs", "kód", "code"]):
            logger.debug("Detected KROS code search")
            result = await client.search_kros_code(
                description=question,
                quantity=None,
                unit=None
            )

            if result.get("found"):
                codes = result.get("codes", [])
                if codes:
                    response_parts = ["**Live KROS Search Results:**\n"]
                    for code_data in codes[:3]:  # Top 3
                        response_parts.append(
                            f"- Code: **{code_data['code']}**\n"
                            f"  Name: {code_data['name']}\n"
                            f"  Source: {code_data['source']}\n"
                        )
                    return "\n".join(response_parts)

        # 2. ČSN standard search
        elif any(kw in question_lower for kw in ["čsn", "csn", "en", "standard", "norma", "exposure"]):
            logger.debug("Detected ČSN standards search")

            # Extract work type and material
            work_type = question
            material = None

            if "beton" in question_lower or "concrete" in question_lower:
                material = "beton"
            elif "ocel" in question_lower or "steel" in question_lower:
                material = "ocel"

            result = await client.search_csn_standard(
                work_type=work_type,
                material=material
            )

            standards = result.get("standards", [])
            if standards:
                response_parts = ["**Live ČSN Standards Search:**\n"]
                for std in standards[:5]:  # Top 5
                    response_parts.append(
                        f"- Standard: **{std['code']}**\n"
                        f"  Name: {std['name']}\n"
                    )
                return "\n".join(response_parts)

        # 3. Price search
        elif any(kw in question_lower for kw in ["cena", "price", "kolik stojí", "cost", "stojí"]):
            logger.debug("Detected price search")

            # Extract unit if possible
            unit = "m³"  # Default
            if "m²" in question or "m2" in question:
                unit = "m²"
            elif "m³" in question or "m3" in question:
                unit = "m³"

            result = await client.search_market_price(
                description=question,
                unit=unit,
                region="Prague"
            )

            if result.get("found"):
                price_range = result["price_range"]
                response_parts = [
                    "**Live Market Price Search:**\n",
                    f"- Min: {price_range['min']:.0f} {price_range['currency']}/{unit}",
                    f"- Avg: {price_range['avg']:.0f} {price_range['currency']}/{unit}",
                    f"- Max: {price_range['max']:.0f} {price_range['currency']}/{unit}",
                    f"\nSources: {len(result.get('sources', []))} verified sources"
                ]
                return "\n".join(response_parts)

        # 4. Generic search (fallback)
        else:
            logger.debug("Using generic Perplexity search")

            # Build targeted query
            search_query = f"""
            Odpověz na otázku týkající se českého stavebnictví:
            {question}

            Poskytni přesnou odpověď s odkazy na zdroje.
            """

            result = await client._search(
                query=search_query,
                domains=["podminky.urs.cz", "urs.cz", "csnonline.cz"],
                search_recency_filter="year"
            )

            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content:
                return f"**Live Search Result:**\n\n{content[:500]}"

        logger.warning("Perplexity search returned no results")
        return None

    except Exception as e:
        logger.error(f"❌ Perplexity search failed: {str(e)}", exc_info=True)
        return None


def log_interaction(
    interaction_id: str,
    question: str,
    classification: TaskClassification,
    result: FinalOutput,
    kb_used: bool,
    perplexity_used: bool,
    from_cache: bool
) -> None:
    """Log interaction for learning and analytics"""

    log_entry = {
        "interaction_id": interaction_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "question": question,
        "classification": {
            "complexity": classification.complexity.value,
            "domains": [d.value for d in classification.domains],
            "roles": [r.role.value for r in classification.roles],
            "confidence": classification.confidence
        },
        "result": {
            "status": result.get_status(),
            "roles_consulted": [r.value for r in result.roles_consulted],
            "conflicts_count": len(result.conflicts),
            "warnings_count": len(result.warnings),
            "critical_count": len(result.critical_issues),
            "confidence": result.confidence,
            "tokens": result.total_tokens,
            "execution_time": result.execution_time_seconds
        },
        "kb_used": kb_used,
        "perplexity_used": perplexity_used,
        "from_cache": from_cache,
        "feedback": None  # Will be updated when feedback is submitted
    }

    _interaction_log.append(log_entry)

    # Persist to file for learning
    _persist_interaction_log()


def _persist_interaction_log() -> None:
    """Persist interaction log to file"""
    try:
        log_dir = settings.DATA_DIR / "logs" / "multi_role"
        log_dir.mkdir(parents=True, exist_ok=True)

        log_file = log_dir / f"interactions_{datetime.now().strftime('%Y%m%d')}.jsonl"

        # Append to JSONL file
        with open(log_file, 'a', encoding='utf-8') as f:
            # Write only the last entry
            if _interaction_log:
                f.write(json.dumps(_interaction_log[-1], ensure_ascii=False) + "\n")

    except Exception as e:
        logger.error(f"Failed to persist interaction log: {e}")


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest) -> AskResponse:
    """
    Ask a construction engineering question to the multi-role AI system

    The system will:
    1. Classify the question (complexity, domains, required roles)
    2. Load relevant Knowledge Base context (B1-B9)
    3. Optionally search Perplexity for live standards
    4. Orchestrate specialist roles sequentially
    5. Detect and resolve conflicts
    6. Return structured answer with confidence

    Examples:

    **Simple OTSKP lookup:**
    ```json
    {
        "question": "What's the OTSKP code for concrete foundation?",
        "enable_kb": true
    }
    ```

    **Complex validation with project context:**
    ```json
    {
        "question": "Check if C25/30 is adequate for 5-story building in XD2 environment",
        "project_id": "proj_abc123",
        "enable_kb": true,
        "enable_perplexity": true
    }
    ```
    """

    try:
        start_time = datetime.now()
        interaction_id = f"int_{hashlib.md5(f'{request.question}{start_time}'.encode()).hexdigest()[:12]}"

        logger.info(f"📥 Multi-role question: {request.question[:100]}...")

        # Check cache first
        from_cache = False
        if request.use_cache:
            cache_key = generate_cache_key(request.question, request.context)
            cached_response = get_cached_response(cache_key)

            if cached_response:
                logger.info(f"✨ Serving from cache: {cache_key}")
                cached_response["from_cache"] = True
                cached_response["interaction_id"] = interaction_id
                return AskResponse(**cached_response)

        # Step 1: Classify task
        logger.info("🔍 Classifying task...")
        classification = classify_task(request.question, request.context)

        logger.info(
            f"📊 Classification: {classification.complexity.value} complexity, "
            f"{len(classification.domains)} domains, {len(classification.roles)} roles"
        )

        # Step 2: Build Knowledge Base context if enabled
        kb_context = None
        kb_used = False
        if request.enable_kb:
            try:
                kb_loader = get_kb_loader()
                if _kb_data:
                    kb_context = build_kb_context(request.question, _kb_data)
                    if kb_context:
                        kb_used = True
                        logger.info(f"📚 KB context built: {len(kb_context)} chars")
            except Exception as e:
                logger.error(f"❌ KB context build failed: {e}")

        # Step 3: Search Perplexity if enabled
        perplexity_context = None
        perplexity_used = False
        if request.enable_perplexity:
            try:
                perplexity_context = await search_perplexity(request.question)
                if perplexity_context:
                    perplexity_used = True
                    logger.info(f"🔍 Perplexity context: {len(perplexity_context)} chars")
            except Exception as e:
                logger.error(f"❌ Perplexity search failed: {e}")

        # Step 4: Merge all context
        full_context = request.context or {}
        if kb_context:
            full_context["kb_context"] = kb_context
        if perplexity_context:
            full_context["perplexity_context"] = perplexity_context

        # Step 5: Execute multi-role orchestration
        mode = "parallel" if request.parallel else "sequential"
        logger.info(f"🎭 Executing multi-role orchestration ({mode} mode)...")
        result = execute_multi_role(
            user_question=request.question,
            classification=classification,
            context=full_context if full_context else None,
            parallel=request.parallel
        )

        # Step 6: Build response
        response_data = {
            "success": True,
            "answer": result.answer,
            "status": result.get_status(),
            "complexity": result.complexity.value,
            "roles_consulted": [r.value for r in result.roles_consulted],
            "conflicts": [
                ConflictResponse(
                    conflict_type=c.conflict_type.value,
                    roles_involved=[r.value for r in c.roles_involved],
                    descriptions=c.descriptions,
                    resolution=c.resolution,
                    winner=c.winner.value if c.winner else None
                )
                for c in result.conflicts
            ],
            "warnings": result.warnings,
            "critical_issues": result.critical_issues,
            "confidence": result.confidence,
            "total_tokens": result.total_tokens,
            "execution_time_seconds": result.execution_time_seconds,
            "kb_context_used": kb_used,
            "perplexity_used": perplexity_used,
            "from_cache": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "interaction_id": interaction_id,
            "execution_mode": "parallel" if request.parallel else "sequential",
            "parallel_speedup": result.performance.parallel_speedup if result.performance else None,
            "stage_times_ms": result.performance.stage_times if result.performance else None
        }

        # Step 7: Cache response
        if request.use_cache:
            cache_key = generate_cache_key(request.question, request.context)
            save_to_cache(cache_key, response_data)

        # Step 8: Log interaction
        log_interaction(
            interaction_id=interaction_id,
            question=request.question,
            classification=classification,
            result=result,
            kb_used=kb_used,
            perplexity_used=perplexity_used,
            from_cache=False
        )

        speedup_info = f", speedup: {result.performance.parallel_speedup:.2f}x" if result.performance else ""
        logger.info(
            f"✅ Multi-role completed ({mode}): {result.execution_time_seconds:.2f}s{speedup_info}, "
            f"{result.total_tokens} tokens, {result.get_status()}"
        )

        return AskResponse(**response_data)

    except Exception as e:
        logger.error(f"❌ Multi-role error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Multi-role system error: {str(e)}")


@router.post("/ask-stream")
async def ask_stream(request: AskRequest):
    """
    Ask a question and get real-time progress via Server-Sent Events (SSE)

    This endpoint streams progress events for the hybrid multi-role analysis:
    - query_started: When a query begins
    - query_completed: When a query finishes
    - completed: Final result

    Events are sent in SSE format:
    ```
    data: {"event": "query_started", "query": "comprehensive_analysis"}

    data: {"event": "query_completed", "query": "comprehensive_analysis", "time_ms": 8500}

    data: {"event": "completed", "result": {...}}
    ```

    Example usage (JavaScript):
    ```javascript
    const eventSource = new EventSource('/api/v1/multi-role/ask-stream');

    eventSource.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);
        console.log('Event:', data.event);
    });
    ```

    Args:
        request: AskRequest with question and optional context

    Returns:
        StreamingResponse with text/event-stream content type
    """
    try:
        logger.info(f"📡 SSE request: {request.question[:50]}...")

        # Create hybrid orchestrator
        orchestrator = HybridMultiRoleOrchestrator()

        # Prepare context (simplified for hybrid approach)
        positions = request.context.get("positions") if request.context else None
        specifications = request.context.get("specifications") if request.context else None

        async def event_generator():
            """Generate SSE events from orchestrator progress"""
            try:
                async for progress_event in orchestrator.execute_hybrid_analysis_with_progress(
                    project_description=request.question,
                    positions=positions,
                    specifications=specifications
                ):
                    # Convert HybridFinalOutput to dict if needed
                    if progress_event.get("event") == "completed":
                        result = progress_event.get("result")
                        if result and hasattr(result, '__dict__'):
                            # Convert dataclass to dict
                            result_dict = {
                                "project_summary": result.project_summary,
                                "exposure_analysis": result.exposure_analysis,
                                "structural_analysis": result.structural_analysis,
                                "final_specification": result.final_specification,
                                "materials_breakdown": result.materials_breakdown,
                                "cost_summary": result.cost_summary,
                                "compliance_status": result.compliance_status,
                                "standards_checked": result.standards_checked,
                                "compliance_checks": result.compliance_checks,
                                "risks_identified": result.risks_identified,
                                "document_issues": result.document_issues,
                                "rfi_items": result.rfi_items,
                                "warnings": result.warnings,
                                "recommendations": result.recommendations,
                                "confidence": result.confidence,
                                "assumptions": result.assumptions,
                                "execution_time_seconds": result.execution_time_seconds,
                                "performance": {
                                    "total_time_ms": result.performance.total_time_ms,
                                    "query_times": result.performance.query_times,
                                    "parallel_efficiency": result.performance.parallel_efficiency,
                                    "tokens_total": result.performance.tokens_total,
                                    "queries_successful": result.performance.queries_successful,
                                    "queries_failed": result.performance.queries_failed
                                }
                            }
                            progress_event["result"] = result_dict

                    # Send SSE event
                    event_data = json.dumps(progress_event)
                    yield f"data: {event_data}\n\n"

            except Exception as e:
                # Send error event
                error_event = {
                    "event": "error",
                    "message": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                yield f"data: {json.dumps(error_event)}\n\n"
                logger.error(f"❌ SSE stream error: {e}", exc_info=True)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )

    except Exception as e:
        logger.error(f"❌ SSE endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"SSE stream error: {str(e)}")


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest) -> FeedbackResponse:
    """
    Submit user feedback on a multi-role response

    Feedback is used to:
    - Improve role prompts
    - Adjust temperature settings
    - Refine conflict resolution
    - Train better classifiers

    Example:
    ```json
    {
        "interaction_id": "int_abc123456",
        "rating": 5,
        "helpful": true,
        "correct": true,
        "comment": "Perfect answer, very detailed!"
    }
    ```
    """

    try:
        feedback_id = f"fb_{hashlib.md5(f'{request.interaction_id}{datetime.now()}'.encode()).hexdigest()[:12]}"

        logger.info(f"📝 Feedback received for {request.interaction_id}: rating={request.rating}")

        # Find interaction in log
        interaction = next(
            (log for log in _interaction_log if log["interaction_id"] == request.interaction_id),
            None
        )

        if not interaction:
            logger.warning(f"⚠️ Interaction not found: {request.interaction_id}")
            # Don't fail, just log
        else:
            # Update interaction with feedback
            interaction["feedback"] = {
                "feedback_id": feedback_id,
                "rating": request.rating,
                "helpful": request.helpful,
                "correct": request.correct,
                "comment": request.comment,
                "correction": request.correction,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }

            # Re-persist log
            _persist_interaction_log()

        return FeedbackResponse(
            success=True,
            message="Feedback received. Thank you for helping us improve!",
            feedback_id=feedback_id
        )

    except Exception as e:
        logger.error(f"❌ Feedback error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Feedback submission error: {str(e)}")


@router.get("/stats")
async def get_stats():
    """
    Get multi-role system statistics

    Returns usage stats, performance metrics, and cache info.
    """

    try:
        total_interactions = len(_interaction_log)

        if total_interactions == 0:
            return {
                "total_interactions": 0,
                "cache_size": len(_response_cache),
                "message": "No interactions yet"
            }

        # Calculate stats
        avg_execution_time = sum(
            log["result"]["execution_time"] for log in _interaction_log
        ) / total_interactions

        avg_tokens = sum(
            log["result"]["tokens"] for log in _interaction_log
        ) / total_interactions

        avg_confidence = sum(
            log["result"]["confidence"] for log in _interaction_log
        ) / total_interactions

        # Count by complexity
        complexity_counts = {}
        for log in _interaction_log:
            complexity = log["classification"]["complexity"]
            complexity_counts[complexity] = complexity_counts.get(complexity, 0) + 1

        # Count feedback
        with_feedback = sum(1 for log in _interaction_log if log.get("feedback"))

        return {
            "total_interactions": total_interactions,
            "with_feedback": with_feedback,
            "feedback_rate": with_feedback / total_interactions if total_interactions > 0 else 0,
            "cache_size": len(_response_cache),
            "kb_loaded": _kb_data is not None,
            "kb_categories": len(_kb_data) if _kb_data else 0,
            "performance": {
                "avg_execution_time_seconds": round(avg_execution_time, 2),
                "avg_tokens": round(avg_tokens),
                "avg_confidence": round(avg_confidence, 2)
            },
            "complexity_distribution": complexity_counts,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Stats error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Stats error: {str(e)}")


@router.get("/health")
async def health_check():
    """
    Health check for multi-role system
    """

    kb_loaded = _kb_data is not None
    kb_categories = len(_kb_data) if _kb_data else 0

    return {
        "status": "healthy",
        "system": "multi-role-ai",
        "version": "2.0.0",
        "features": {
            "parallel_execution": True,
            "expected_speedup": "3-4x",
            "default_mode": "parallel"
        },
        "kb_loaded": kb_loaded,
        "kb_categories": kb_categories,
        "cache_entries": len(_response_cache),
        "total_interactions": len(_interaction_log),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
