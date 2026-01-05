"""
Workflow C: Complete End-to-End Pipeline

Full automated workflow from file upload to project summary.
Combines best practices from Workflow A and Workflow B with
optimized Multi-Role AI and Summary Generation.

PIPELINE (v1.0 - 2025-12-28):
1. UPLOAD   → Accept files (Excel, PDF, XML)
2. PARSE    → SmartParser with fallback chain
3. VALIDATE → Schema validation + completeness check
4. ENRICH   → KROS/RTS database matching
5. AUDIT    → Multi-Role AI audit (parallel execution)
6. SUMMARY  → Automatic summary generation

TARGET PERFORMANCE:
- Total pipeline: 30-60 seconds
- Multi-Role audit: 15-20 seconds (with parallel)
- Summary generation: 15-20 seconds (with parallel)

IMPROVEMENTS OVER WORKFLOW A:
- Parallel Multi-Role execution (3-4x faster)
- Automatic summary generation
- Better progress tracking
- Unified error handling
"""

import logging
import time
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.core.config import settings
from app.parsers.smart_parser import SmartParser
from app.services.position_enricher import PositionEnricher
from app.validators import PositionValidator
from app.services.orchestrator import execute_multi_role
from app.services.task_classifier import (
    TaskClassification,
    TaskComplexity,
    Role,
    RoleInvocation,
    Domain,
    classify_task,
)
from app.services.summary_generator import (
    SummaryGenerator,
    SummaryLanguage,
    SummaryFormat,
    ProjectSummary,
)

logger = logging.getLogger(__name__)


class WorkflowStage(str, Enum):
    """Workflow C stages"""
    PENDING = "pending"
    UPLOADING = "uploading"
    PARSING = "parsing"
    VALIDATING = "validating"
    ENRICHING = "enriching"
    AUDITING = "auditing"
    SUMMARIZING = "summarizing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class StageResult:
    """Result of a workflow stage"""
    stage: WorkflowStage
    success: bool
    duration_ms: int
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class WorkflowProgress:
    """Track workflow progress"""
    project_id: str
    current_stage: WorkflowStage
    stages_completed: List[WorkflowStage] = field(default_factory=list)
    stage_results: Dict[str, StageResult] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    @property
    def progress_percentage(self) -> float:
        """Calculate progress as percentage"""
        total_stages = 6  # parsing, validating, enriching, auditing, summarizing, completed
        completed = len(self.stages_completed)
        return (completed / total_stages) * 100

    @property
    def duration_seconds(self) -> float:
        """Total duration in seconds"""
        end = self.completed_at or datetime.now()
        return (end - self.started_at).total_seconds()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "project_id": self.project_id,
            "current_stage": self.current_stage.value,
            "progress_percentage": self.progress_percentage,
            "stages_completed": [s.value for s in self.stages_completed],
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "error": self.error,
        }


@dataclass
class WorkflowCResult:
    """Complete Workflow C result"""
    project_id: str
    project_name: str
    success: bool
    progress: WorkflowProgress

    # Parsed data
    positions: List[Dict[str, Any]]
    positions_count: int

    # Audit results
    audit_classification: str  # GREEN, AMBER, RED
    audit_confidence: float
    critical_issues: List[str]
    warnings: List[str]

    # Summary
    summary: Optional[ProjectSummary] = None

    # Performance metrics
    total_duration_seconds: float = 0.0
    stage_durations: Dict[str, float] = field(default_factory=dict)
    multi_role_speedup: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "project_id": self.project_id,
            "project_name": self.project_name,
            "success": self.success,
            "progress": self.progress.to_dict(),
            "positions_count": self.positions_count,
            "audit_classification": self.audit_classification,
            "audit_confidence": self.audit_confidence,
            "critical_issues": self.critical_issues,
            "warnings": self.warnings,
            "summary": self.summary.to_dict() if self.summary else None,
            "total_duration_seconds": self.total_duration_seconds,
            "stage_durations": self.stage_durations,
            "multi_role_speedup": self.multi_role_speedup,
        }


class WorkflowC:
    """
    Complete End-to-End Pipeline

    Combines upload, parsing, validation, enrichment,
    multi-role audit, and summary generation into
    a single optimized workflow.
    """

    def __init__(self):
        self.parser = SmartParser()
        self.enricher = PositionEnricher()
        self.validator = PositionValidator()
        self.summary_generator = SummaryGenerator()

        # Progress callbacks
        self._progress_callbacks: List[Callable[[WorkflowProgress], None]] = []

    def on_progress(self, callback: Callable[[WorkflowProgress], None]) -> None:
        """Register progress callback"""
        self._progress_callbacks.append(callback)

    def _notify_progress(self, progress: WorkflowProgress) -> None:
        """Notify all progress callbacks"""
        for callback in self._progress_callbacks:
            try:
                callback(progress)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")

    async def execute(
        self,
        project_id: str,
        project_name: str,
        file_path: Optional[Path] = None,
        file_content: Optional[bytes] = None,
        file_name: Optional[str] = None,
        positions: Optional[List[Dict[str, Any]]] = None,
        generate_summary: bool = True,
        use_parallel: bool = True,
        language: str = "cs",
    ) -> WorkflowCResult:
        """
        Execute complete Workflow C pipeline.

        Args:
            project_id: Unique project identifier
            project_name: Human-readable project name
            file_path: Path to input file (Excel, PDF, XML)
            file_content: Raw file content (alternative to file_path)
            file_name: Original file name (when using file_content)
            positions: Pre-parsed positions (skips parsing stage)
            generate_summary: Generate project summary at end
            use_parallel: Use parallel Multi-Role execution
            language: Output language for summary

        Returns:
            WorkflowCResult with all data and metrics
        """
        start_time = time.time()
        stage_durations: Dict[str, float] = {}

        # Initialize progress
        progress = WorkflowProgress(
            project_id=project_id,
            current_stage=WorkflowStage.PENDING,
        )

        logger.info(f"🚀 Workflow C: Starting for project {project_id}")

        try:
            # =========================================================
            # STAGE 1: PARSING
            # =========================================================
            if positions is None:
                progress.current_stage = WorkflowStage.PARSING
                self._notify_progress(progress)

                stage_start = time.time()
                logger.info(f"📄 Stage 1: Parsing...")

                if file_path:
                    positions = await self._parse_file(file_path)
                elif file_content and file_name:
                    positions = await self._parse_content(file_content, file_name)
                else:
                    raise ValueError("Either file_path or (file_content, file_name) required")

                stage_durations["parsing"] = time.time() - stage_start
                progress.stages_completed.append(WorkflowStage.PARSING)
                logger.info(f"   ✅ Parsed {len(positions)} positions in {stage_durations['parsing']:.2f}s")

            # =========================================================
            # STAGE 2: VALIDATION
            # =========================================================
            progress.current_stage = WorkflowStage.VALIDATING
            self._notify_progress(progress)

            stage_start = time.time()
            logger.info(f"✓ Stage 2: Validating {len(positions)} positions...")

            positions = self._validate_positions(positions)

            stage_durations["validating"] = time.time() - stage_start
            progress.stages_completed.append(WorkflowStage.VALIDATING)
            logger.info(f"   ✅ Validated in {stage_durations['validating']:.2f}s")

            # =========================================================
            # STAGE 3: ENRICHMENT
            # =========================================================
            progress.current_stage = WorkflowStage.ENRICHING
            self._notify_progress(progress)

            stage_start = time.time()
            logger.info(f"🔍 Stage 3: Enriching positions...")

            positions = await self._enrich_positions(positions)

            stage_durations["enriching"] = time.time() - stage_start
            progress.stages_completed.append(WorkflowStage.ENRICHING)
            logger.info(f"   ✅ Enriched in {stage_durations['enriching']:.2f}s")

            # =========================================================
            # STAGE 4: MULTI-ROLE AUDIT
            # =========================================================
            progress.current_stage = WorkflowStage.AUDITING
            self._notify_progress(progress)

            stage_start = time.time()
            logger.info(f"🎭 Stage 4: Multi-Role Audit (parallel={use_parallel})...")

            audit_result = await self._audit_positions(
                positions=positions,
                project_name=project_name,
                use_parallel=use_parallel,
            )

            stage_durations["auditing"] = time.time() - stage_start
            progress.stages_completed.append(WorkflowStage.AUDITING)

            multi_role_speedup = audit_result.get("speedup")
            logger.info(
                f"   ✅ Audited in {stage_durations['auditing']:.2f}s "
                f"(speedup: {multi_role_speedup:.2f}x)" if multi_role_speedup else ""
            )

            # Apply audit results to positions
            positions = self._apply_audit_results(positions, audit_result)

            # =========================================================
            # STAGE 5: SUMMARY GENERATION (optional)
            # =========================================================
            summary = None
            if generate_summary:
                progress.current_stage = WorkflowStage.SUMMARIZING
                self._notify_progress(progress)

                stage_start = time.time()
                logger.info(f"📊 Stage 5: Generating Summary...")

                lang = SummaryLanguage.CZECH
                if language == "en":
                    lang = SummaryLanguage.ENGLISH
                elif language == "sk":
                    lang = SummaryLanguage.SLOVAK

                summary = await self.summary_generator.generate_summary(
                    project_id=project_id,
                    project_name=project_name,
                    positions=positions,
                    language=lang,
                    use_parallel=use_parallel,
                )

                stage_durations["summarizing"] = time.time() - stage_start
                progress.stages_completed.append(WorkflowStage.SUMMARIZING)
                logger.info(f"   ✅ Summary generated in {stage_durations['summarizing']:.2f}s")

            # =========================================================
            # COMPLETE
            # =========================================================
            progress.current_stage = WorkflowStage.COMPLETED
            progress.completed_at = datetime.now()
            progress.stages_completed.append(WorkflowStage.COMPLETED)
            self._notify_progress(progress)

            total_duration = time.time() - start_time

            logger.info(
                f"✅ Workflow C complete for {project_id}: "
                f"{len(positions)} positions, "
                f"{audit_result.get('classification', 'N/A')} status, "
                f"{total_duration:.2f}s total"
            )

            return WorkflowCResult(
                project_id=project_id,
                project_name=project_name,
                success=True,
                progress=progress,
                positions=positions,
                positions_count=len(positions),
                audit_classification=audit_result.get("classification", "AMBER"),
                audit_confidence=audit_result.get("confidence", 0.8),
                critical_issues=audit_result.get("critical_issues", []),
                warnings=audit_result.get("warnings", []),
                summary=summary,
                total_duration_seconds=total_duration,
                stage_durations=stage_durations,
                multi_role_speedup=multi_role_speedup,
            )

        except Exception as e:
            logger.error(f"❌ Workflow C failed: {str(e)}", exc_info=True)

            progress.current_stage = WorkflowStage.FAILED
            progress.error = str(e)
            progress.completed_at = datetime.now()
            self._notify_progress(progress)

            return WorkflowCResult(
                project_id=project_id,
                project_name=project_name,
                success=False,
                progress=progress,
                positions=[],
                positions_count=0,
                audit_classification="RED",
                audit_confidence=0.0,
                critical_issues=[str(e)],
                warnings=[],
                total_duration_seconds=time.time() - start_time,
                stage_durations=stage_durations,
            )

    async def _parse_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """Parse file using SmartParser"""
        result = self.parser.parse(file_path)

        if not result.get("success"):
            raise ValueError(f"Parsing failed: {result.get('error', 'Unknown error')}")

        return result.get("positions", [])

    async def _parse_content(
        self,
        content: bytes,
        file_name: str,
    ) -> List[Dict[str, Any]]:
        """Parse file content"""
        # Save to temp file and parse
        import tempfile

        suffix = Path(file_name).suffix
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            temp_path = Path(f.name)

        try:
            return await self._parse_file(temp_path)
        finally:
            temp_path.unlink(missing_ok=True)

    def _validate_positions(
        self,
        positions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Validate positions and add validation status"""
        validated = []

        for pos in positions:
            try:
                # Basic validation
                is_valid = True
                errors = []

                if not pos.get("description"):
                    is_valid = False
                    errors.append("Missing description")

                if pos.get("quantity") is not None:
                    try:
                        qty = float(pos["quantity"])
                        if qty <= 0:
                            is_valid = False
                            errors.append("Quantity must be positive")
                    except (ValueError, TypeError):
                        is_valid = False
                        errors.append("Invalid quantity format")

                pos["validation_status"] = "passed" if is_valid else "failed"
                pos["validation_errors"] = errors

            except Exception as e:
                pos["validation_status"] = "error"
                pos["validation_errors"] = [str(e)]

            validated.append(pos)

        return validated

    async def _enrich_positions(
        self,
        positions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Enrich positions with KROS/RTS data"""
        enriched = []

        for pos in positions:
            try:
                result = self.enricher.enrich(pos)
                pos.update(result)
                pos["enriched"] = True
            except Exception as e:
                logger.warning(f"Enrichment failed for position: {e}")
                pos["enriched"] = False
                pos["enrichment_error"] = str(e)

            enriched.append(pos)

        return enriched

    async def _audit_positions(
        self,
        positions: List[Dict[str, Any]],
        project_name: str,
        use_parallel: bool = True,
    ) -> Dict[str, Any]:
        """Run Multi-Role audit on positions"""
        # Build audit question
        position_summary = f"{len(positions)} positions"
        question = f"""Please audit the construction estimate for project "{project_name}".

The estimate contains {position_summary}.

Sample positions (first 10):
{json.dumps(positions[:10], indent=2, ensure_ascii=False, default=str)[:2000]}

Please:
1. Validate the positions against Czech construction standards (ČSN EN)
2. Check prices against current market rates
3. Identify any critical issues or missing information
4. Provide classification: GREEN (OK), AMBER (warnings), RED (critical)

Respond in JSON format:
{{
    "classification": "GREEN|AMBER|RED",
    "confidence": 0.0-1.0,
    "key_findings": ["...", "..."],
    "critical_issues": ["...", "..."],
    "warnings": ["...", "..."]
}}"""

        # Create classification for audit task
        classification = TaskClassification(
            complexity=TaskComplexity.COMPLEX,
            domains=[Domain.VALIDATION, Domain.CODES],
            roles=[
                RoleInvocation(role=Role.DOCUMENT_VALIDATOR, temperature=0.2, priority=0),
                RoleInvocation(role=Role.STRUCTURAL_ENGINEER, temperature=0.3, priority=1),
                RoleInvocation(role=Role.CONCRETE_SPECIALIST, temperature=0.3, priority=2),
                RoleInvocation(role=Role.COST_ESTIMATOR, temperature=0.2, priority=3),
                RoleInvocation(role=Role.STANDARDS_CHECKER, temperature=0.2, priority=4),
            ],
            requires_rfi=False,
            missing_data=[],
            confidence=0.85,
        )

        # Execute Multi-Role
        result = execute_multi_role(
            user_question=question,
            classification=classification,
            context={"positions": positions[:20]},  # Limit context
            parallel=use_parallel,
        )

        # Parse response
        import re

        audit_data = {
            "classification": "AMBER",
            "confidence": result.confidence,
            "critical_issues": result.critical_issues,
            "warnings": result.warnings,
            "speedup": result.performance.parallel_speedup if result.performance else None,
        }

        # Try to extract classification from response
        try:
            json_match = re.search(r'\{[^{}]*"classification"[^{}]*\}', result.answer, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                audit_data.update(parsed)
        except (json.JSONDecodeError, AttributeError):
            # Fallback: determine from critical issues
            if result.critical_issues:
                audit_data["classification"] = "RED"
            elif result.warnings:
                audit_data["classification"] = "AMBER"
            else:
                audit_data["classification"] = "GREEN"

        return audit_data

    def _apply_audit_results(
        self,
        positions: List[Dict[str, Any]],
        audit_result: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Apply audit results to positions"""
        classification = audit_result.get("classification", "AMBER")

        for pos in positions:
            # Individual position classification based on validation + enrichment
            if pos.get("validation_status") == "failed":
                pos["classification"] = "RED"
            elif pos.get("enriched") and pos.get("enrichment", {}).get("match") == "exact":
                pos["classification"] = "GREEN"
            elif pos.get("enriched") and pos.get("enrichment", {}).get("match") == "partial":
                pos["classification"] = "AMBER"
            else:
                pos["classification"] = classification

        return positions


# Convenience function
async def execute_workflow_c(
    project_id: str,
    project_name: str,
    file_path: Optional[Path] = None,
    positions: Optional[List[Dict[str, Any]]] = None,
    generate_summary: bool = True,
    use_parallel: bool = True,
    language: str = "cs",
) -> Dict[str, Any]:
    """
    Convenience function to execute Workflow C.

    Args:
        project_id: Project ID
        project_name: Project name
        file_path: Input file path (optional if positions provided)
        positions: Pre-parsed positions (optional)
        generate_summary: Generate summary at end
        use_parallel: Use parallel execution
        language: Output language

    Returns:
        Dictionary with workflow result
    """
    workflow = WorkflowC()

    result = await workflow.execute(
        project_id=project_id,
        project_name=project_name,
        file_path=file_path,
        positions=positions,
        generate_summary=generate_summary,
        use_parallel=use_parallel,
        language=language,
    )

    return result.to_dict()
