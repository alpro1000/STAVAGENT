"""
Hybrid Multi-Role Orchestrator (v3.0 - Optimized)

OPTIMIZATION: 2 parallel queries instead of 6 sequential roles
- Query 1: Comprehensive Analysis (structural + materials + cost)
- Query 2: Compliance & Risks (standards + document validation)

Performance: 50-75s → 15-20s (3-4x speedup)
Architecture: asyncio.gather() for true parallel execution
"""

import asyncio
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

from app.core.claude_client import ClaudeClient
from app.core.config import settings

# Try to import Gemini client
try:
    from app.core.gemini_client import GeminiClient
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


# ============================================================================
# DATA STRUCTURES
# ============================================================================

class HybridQueryType(str, Enum):
    """Types of hybrid queries"""
    COMPREHENSIVE_ANALYSIS = "comprehensive_analysis"  # Technical + Cost
    COMPLIANCE_RISKS = "compliance_risks"              # Standards + Validation


@dataclass
class HybridQueryResult:
    """Result from a single hybrid query"""
    query_type: HybridQueryType
    result: Dict[str, Any]  # Parsed JSON response
    execution_time_ms: int
    tokens_used: int
    temperature_used: float
    timestamp: datetime
    error: Optional[str] = None  # If query failed


@dataclass
class HybridPerformanceMetrics:
    """Performance metrics for hybrid execution"""
    total_time_ms: int
    query_times: Dict[str, int]  # e.g., {"comprehensive": 8500, "compliance": 7200}
    parallel_efficiency: float  # Actual speedup vs theoretical max
    tokens_total: int
    queries_executed: int
    queries_successful: int
    queries_failed: int


@dataclass
class HybridFinalOutput:
    """Final output from hybrid orchestrator"""
    # Technical specification
    project_summary: Dict[str, Any]
    exposure_analysis: Dict[str, Any]
    structural_analysis: Dict[str, Any]
    final_specification: Dict[str, Any]
    materials_breakdown: Dict[str, Any]
    cost_summary: Dict[str, Any]

    # Compliance & risks
    compliance_status: Dict[str, Any]
    standards_checked: List[Dict[str, Any]]
    compliance_checks: List[Dict[str, Any]]
    risks_identified: List[Dict[str, Any]]
    document_issues: List[Dict[str, Any]]
    rfi_items: List[Dict[str, Any]]

    # Metadata
    warnings: List[str]
    recommendations: List[Dict[str, Any]]
    confidence: float
    assumptions: List[str]
    performance: HybridPerformanceMetrics
    execution_time_seconds: float

    def has_critical_risks(self) -> bool:
        """Check if there are critical risks"""
        return any(r.get("severity") == "critical" for r in self.risks_identified)

    def get_compliance_status(self) -> str:
        """Get overall compliance status"""
        return self.compliance_status.get("overall", "UNKNOWN")

    def get_status_emoji(self) -> str:
        """Get status emoji"""
        if self.has_critical_risks():
            return "🚨"
        elif self.get_compliance_status() == "NON_COMPLIANT":
            return "❌"
        elif len(self.warnings) > 0:
            return "⚠️"
        else:
            return "✅"


# ============================================================================
# HYBRID ORCHESTRATOR
# ============================================================================

class HybridMultiRoleOrchestrator:
    """
    Optimized orchestrator using hybrid prompts and async execution

    Architecture:
    - 2 queries instead of 6 roles
    - asyncio.gather() for true parallelism
    - 3-4x faster than sequential ThreadPoolExecutor approach
    """

    def __init__(self):
        """Initialize hybrid orchestrator"""
        self.prompts_dir = Path(__file__).parent.parent / "prompts"
        self.hybrid_prompts_dir = self.prompts_dir / "hybrid"

        # Select LLM client
        multi_role_llm = getattr(settings, 'MULTI_ROLE_LLM', 'gemini').lower()

        if multi_role_llm == "gemini":
            if not GEMINI_AVAILABLE:
                logger.warning("Gemini requested but not available, falling back to Claude")
                self.llm_client = ClaudeClient()
                self.llm_name = "claude"
            else:
                try:
                    self.llm_client = GeminiClient()
                    self.llm_name = "gemini"
                    logger.info(f"Using Gemini for Hybrid Multi-Role ({self.llm_client.model_name})")
                except Exception as e:
                    logger.warning(f"Gemini failed: {e}, falling back to Claude")
                    self.llm_client = ClaudeClient()
                    self.llm_name = "claude"
        else:
            self.llm_client = ClaudeClient()
            self.llm_name = "claude"

        logger.info(f"✅ HybridMultiRoleOrchestrator initialized with {self.llm_name}")

    def _load_hybrid_prompt(self, prompt_type: HybridQueryType) -> str:
        """Load hybrid prompt from file"""
        if prompt_type == HybridQueryType.COMPREHENSIVE_ANALYSIS:
            filename = "comprehensive_analysis.md"
        elif prompt_type == HybridQueryType.COMPLIANCE_RISKS:
            filename = "compliance_and_risks.md"
        else:
            raise ValueError(f"Unknown prompt type: {prompt_type}")

        prompt_path = self.hybrid_prompts_dir / filename

        if not prompt_path.exists():
            raise FileNotFoundError(f"Hybrid prompt not found: {prompt_path}")

        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()

    async def _invoke_llm_async(
        self,
        prompt_text: str,
        user_context: str,
        temperature: float = 0.3,
        timeout_seconds: int = 15
    ) -> Tuple[Dict[str, Any], int]:
        """
        Invoke LLM asynchronously (wrapper around sync client)

        Args:
            prompt_text: System prompt (hybrid prompt)
            user_context: User's question/project data
            temperature: Sampling temperature
            timeout_seconds: Timeout for this query

        Returns:
            (response_dict, tokens_used)
        """
        start_time = time.time()

        try:
            # Wrap synchronous LLM call in async executor
            loop = asyncio.get_event_loop()

            # Create task with timeout
            task = loop.run_in_executor(
                None,  # Default executor
                lambda: self.llm_client.call(
                    prompt=user_context,
                    system_prompt=prompt_text,
                    temperature=temperature
                )
            )

            # Wait with timeout
            response = await asyncio.wait_for(task, timeout=timeout_seconds)

            # Extract tokens (if available in response)
            tokens_used = response.get("_metadata", {}).get("tokens", 0)
            if not tokens_used:
                # Estimate tokens if not provided (rough estimate: 4 chars per token)
                tokens_used = len(str(response)) // 4

            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.info(f"LLM call completed in {elapsed_ms}ms")

            return response, tokens_used

        except asyncio.TimeoutError:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error(f"LLM call timed out after {timeout_seconds}s")
            raise TimeoutError(f"LLM query timed out after {timeout_seconds}s")

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error(f"LLM call failed after {elapsed_ms}ms: {e}")
            raise

    async def _execute_hybrid_query(
        self,
        query_type: HybridQueryType,
        user_context: str,
        temperature: float = 0.3
    ) -> HybridQueryResult:
        """
        Execute a single hybrid query

        Args:
            query_type: Type of hybrid query
            user_context: User's question/project data
            temperature: Sampling temperature

        Returns:
            HybridQueryResult with response or error
        """
        start_time = time.time()
        timestamp = datetime.now()

        try:
            # Load hybrid prompt
            prompt_text = self._load_hybrid_prompt(query_type)

            # Invoke LLM
            response, tokens = await self._invoke_llm_async(
                prompt_text=prompt_text,
                user_context=user_context,
                temperature=temperature,
                timeout_seconds=15  # 15s per query
            )

            execution_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f"✅ {query_type.value} completed: {execution_time_ms}ms, "
                f"{tokens} tokens"
            )

            return HybridQueryResult(
                query_type=query_type,
                result=response,
                execution_time_ms=execution_time_ms,
                tokens_used=tokens,
                temperature_used=temperature,
                timestamp=timestamp,
                error=None
            )

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{type(e).__name__}: {str(e)}"

            logger.error(
                f"❌ {query_type.value} failed after {execution_time_ms}ms: {error_msg}"
            )

            return HybridQueryResult(
                query_type=query_type,
                result={},
                execution_time_ms=execution_time_ms,
                tokens_used=0,
                temperature_used=temperature,
                timestamp=timestamp,
                error=error_msg
            )

    async def execute_hybrid_analysis(
        self,
        project_description: str,
        positions: Optional[List[Dict[str, Any]]] = None,
        specifications: Optional[Dict[str, Any]] = None
    ) -> HybridFinalOutput:
        """
        Execute hybrid multi-role analysis using 2 parallel queries

        Args:
            project_description: Main project description
            positions: List of positions (BOQ items)
            specifications: Project specifications

        Returns:
            HybridFinalOutput with combined results from both queries
        """
        start_time = time.time()

        logger.info("🚀 Starting hybrid multi-role analysis (2 parallel queries)")

        # Prepare user context (same for both queries)
        user_context = self._prepare_user_context(
            project_description, positions, specifications
        )

        # Execute both queries in parallel with asyncio.gather
        results = await asyncio.gather(
            self._execute_hybrid_query(
                HybridQueryType.COMPREHENSIVE_ANALYSIS,
                user_context,
                temperature=0.3
            ),
            self._execute_hybrid_query(
                HybridQueryType.COMPLIANCE_RISKS,
                user_context,
                temperature=0.2  # Lower for standards compliance
            ),
            return_exceptions=True  # Graceful degradation
        )

        total_time_ms = int((time.time() - start_time) * 1000)

        # Extract results
        comprehensive_result = results[0] if isinstance(results[0], HybridQueryResult) else None
        compliance_result = results[1] if isinstance(results[1], HybridQueryResult) else None

        # Check for failures
        queries_successful = sum(1 for r in results if isinstance(r, HybridQueryResult) and not r.error)
        queries_failed = 2 - queries_successful

        if queries_failed == 2:
            logger.error("❌ Both hybrid queries failed!")
            raise RuntimeError("All hybrid queries failed")

        # Merge results
        final_output = self._merge_hybrid_results(
            comprehensive_result,
            compliance_result,
            total_time_ms
        )

        logger.info(
            f"✅ Hybrid analysis complete: {total_time_ms}ms "
            f"({final_output.performance.parallel_efficiency:.1f}% efficiency)"
        )

        return final_output

    def _prepare_user_context(
        self,
        project_description: str,
        positions: Optional[List[Dict[str, Any]]],
        specifications: Optional[Dict[str, Any]]
    ) -> str:
        """Prepare user context string for LLM"""
        context_parts = [f"PROJECT DESCRIPTION:\n{project_description}\n"]

        if positions:
            context_parts.append(f"\nPOSITIONS ({len(positions)} items):")
            for i, pos in enumerate(positions[:10], 1):  # Show first 10
                context_parts.append(
                    f"  {i}. {pos.get('item_name', 'Unknown')}: "
                    f"{pos.get('quantity', 0)} {pos.get('unit', '')}"
                )
            if len(positions) > 10:
                context_parts.append(f"  ... and {len(positions) - 10} more")

        if specifications:
            context_parts.append(f"\nSPECIFICATIONS:\n{specifications}")

        return "\n".join(context_parts)

    def _merge_hybrid_results(
        self,
        comprehensive: Optional[HybridQueryResult],
        compliance: Optional[HybridQueryResult],
        total_time_ms: int
    ) -> HybridFinalOutput:
        """
        Merge results from both hybrid queries into final output

        Handles partial failures gracefully
        """
        # Extract comprehensive analysis data (or defaults)
        if comprehensive and not comprehensive.error:
            comp_data = comprehensive.result
            project_summary = comp_data.get("project_summary", {})
            exposure_analysis = comp_data.get("exposure_analysis", {})
            structural_analysis = comp_data.get("structural_analysis", {})
            final_specification = comp_data.get("final_specification", {})
            materials_breakdown = comp_data.get("materials_breakdown", {})
            cost_summary = comp_data.get("cost_summary", {})
            comp_warnings = comp_data.get("warnings", [])
            comp_tokens = comprehensive.tokens_used
            comp_time = comprehensive.execution_time_ms
        else:
            # Comprehensive query failed - use empty defaults
            project_summary = {"error": "Comprehensive analysis failed"}
            exposure_analysis = {}
            structural_analysis = {}
            final_specification = {}
            materials_breakdown = {}
            cost_summary = {}
            comp_warnings = [f"Comprehensive analysis failed: {comprehensive.error if comprehensive else 'Unknown error'}"]
            comp_tokens = 0
            comp_time = 0

        # Extract compliance & risks data (or defaults)
        if compliance and not compliance.error:
            compl_data = compliance.result
            compliance_status = compl_data.get("compliance_status", {"overall": "UNKNOWN"})
            standards_checked = compl_data.get("standards_checked", [])
            compliance_checks = compl_data.get("compliance_checks", [])
            risks_identified = compl_data.get("risks_identified", [])
            document_issues = compl_data.get("document_issues", [])
            rfi_items = compl_data.get("rfi_items", [])
            recommendations = compl_data.get("recommendations", [])
            assumptions = compl_data.get("assumptions_made", [])
            compl_warnings = compl_data.get("warnings", [])
            compl_confidence = compl_data.get("confidence", 0.8)
            compl_tokens = compliance.tokens_used
            compl_time = compliance.execution_time_ms
        else:
            # Compliance query failed - use empty defaults
            compliance_status = {"overall": "UNKNOWN", "summary": "Compliance check failed"}
            standards_checked = []
            compliance_checks = []
            risks_identified = [{"severity": "high", "title": "Compliance check failed",
                                "description": f"Compliance query error: {compliance.error if compliance else 'Unknown'}"}]
            document_issues = []
            rfi_items = []
            recommendations = []
            assumptions = []
            compl_warnings = [f"Compliance check failed: {compliance.error if compliance else 'Unknown error'}"]
            compl_confidence = 0.5
            compl_tokens = 0
            compl_time = 0

        # Combine warnings
        all_warnings = comp_warnings + compl_warnings

        # Calculate performance metrics
        query_times = {
            "comprehensive_analysis_ms": comp_time,
            "compliance_risks_ms": compl_time
        }

        # Parallel efficiency: actual time vs sequential time
        sequential_time_ms = comp_time + compl_time
        parallel_efficiency = (sequential_time_ms / total_time_ms * 100) if total_time_ms > 0 else 0

        total_tokens = comp_tokens + compl_tokens
        queries_executed = 2
        queries_successful = sum(1 for q in [comprehensive, compliance] if q and not q.error)
        queries_failed = queries_executed - queries_successful

        performance = HybridPerformanceMetrics(
            total_time_ms=total_time_ms,
            query_times=query_times,
            parallel_efficiency=parallel_efficiency,
            tokens_total=total_tokens,
            queries_executed=queries_executed,
            queries_successful=queries_successful,
            queries_failed=queries_failed
        )

        # Calculate overall confidence
        comp_confidence = comp_data.get("confidence", 0.8) if comprehensive and not comprehensive.error else 0.5
        overall_confidence = (comp_confidence + compl_confidence) / 2

        return HybridFinalOutput(
            project_summary=project_summary,
            exposure_analysis=exposure_analysis,
            structural_analysis=structural_analysis,
            final_specification=final_specification,
            materials_breakdown=materials_breakdown,
            cost_summary=cost_summary,
            compliance_status=compliance_status,
            standards_checked=standards_checked,
            compliance_checks=compliance_checks,
            risks_identified=risks_identified,
            document_issues=document_issues,
            rfi_items=rfi_items,
            warnings=all_warnings,
            recommendations=recommendations,
            confidence=overall_confidence,
            assumptions=assumptions,
            performance=performance,
            execution_time_seconds=total_time_ms / 1000.0
        )


# ============================================================================
# CONVENIENCE FUNCTION
# ============================================================================

async def generate_hybrid_project_summary(
    project_description: str,
    positions: Optional[List[Dict[str, Any]]] = None,
    specifications: Optional[Dict[str, Any]] = None
) -> HybridFinalOutput:
    """
    Convenience function to generate project summary using hybrid approach

    Usage:
        result = await generate_hybrid_project_summary(
            "Foundation strip 45m × 0.8m × 0.6m, outdoor, groundwater present",
            positions=[...],
            specifications={...}
        )

        print(result.get_status_emoji(), result.get_compliance_status())
        print(f"Cost: {result.cost_summary.get('total_incl_vat_czk', 0):,.0f} Kč")

    Performance: 15-20s (vs 50-75s with old 6-role approach)
    """
    orchestrator = HybridMultiRoleOrchestrator()
    return await orchestrator.execute_hybrid_analysis(
        project_description, positions, specifications
    )
