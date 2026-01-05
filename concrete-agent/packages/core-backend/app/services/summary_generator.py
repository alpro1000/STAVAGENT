"""
Summary Generator Module

Generates comprehensive project summaries using Multi-Role AI system.
Aggregates audit results, position data, and generates executive summary.

ARCHITECTURE (v1.0 - 2025-12-28):
- Uses optimized parallel Multi-Role execution (3-4x faster)
- Aggregates data from all positions
- Generates multilingual summaries (Czech/English)
- Supports multiple output formats (JSON, Markdown, PDF-ready)

Target: Generate complete project summary in 15-20 seconds (with parallel Multi-Role)
"""

import logging
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.core.config import settings
from app.core.claude_client import ClaudeClient
from app.services.orchestrator import (
    execute_multi_role,
    PerformanceMetrics,
)
from app.services.task_classifier import (
    TaskClassification,
    TaskComplexity,
    Role,
    RoleInvocation,
    Domain,
)

logger = logging.getLogger(__name__)


class SummaryFormat(str, Enum):
    """Output format for summary"""
    JSON = "json"
    MARKDOWN = "markdown"
    HTML = "html"


class SummaryLanguage(str, Enum):
    """Language for summary output"""
    CZECH = "cs"
    ENGLISH = "en"
    SLOVAK = "sk"


@dataclass
class PositionSummary:
    """Summary statistics for positions"""
    total_count: int
    green_count: int
    amber_count: int
    red_count: int
    total_value_czk: float
    enriched_count: int
    needs_review_count: int

    @property
    def green_percentage(self) -> float:
        return (self.green_count / self.total_count * 100) if self.total_count > 0 else 0

    @property
    def pass_rate(self) -> float:
        return ((self.green_count + self.amber_count) / self.total_count * 100) if self.total_count > 0 else 0


@dataclass
class ProjectSummary:
    """Complete project summary"""
    project_id: str
    project_name: str
    generated_at: datetime

    # Position statistics
    position_summary: PositionSummary

    # Content
    executive_summary: str
    key_findings: List[str]
    recommendations: List[str]
    critical_issues: List[str]
    warnings: List[str]

    # Audit results
    overall_status: str  # GREEN, AMBER, RED
    confidence_score: float

    # Performance
    generation_time_seconds: float
    multi_role_speedup: Optional[float] = None

    # Metadata
    language: SummaryLanguage = SummaryLanguage.CZECH
    format: SummaryFormat = SummaryFormat.JSON
    roles_consulted: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "project_id": self.project_id,
            "project_name": self.project_name,
            "generated_at": self.generated_at.isoformat(),
            "position_summary": {
                "total_count": self.position_summary.total_count,
                "green_count": self.position_summary.green_count,
                "amber_count": self.position_summary.amber_count,
                "red_count": self.position_summary.red_count,
                "total_value_czk": self.position_summary.total_value_czk,
                "enriched_count": self.position_summary.enriched_count,
                "needs_review_count": self.position_summary.needs_review_count,
                "green_percentage": self.position_summary.green_percentage,
                "pass_rate": self.position_summary.pass_rate,
            },
            "executive_summary": self.executive_summary,
            "key_findings": self.key_findings,
            "recommendations": self.recommendations,
            "critical_issues": self.critical_issues,
            "warnings": self.warnings,
            "overall_status": self.overall_status,
            "confidence_score": self.confidence_score,
            "generation_time_seconds": self.generation_time_seconds,
            "multi_role_speedup": self.multi_role_speedup,
            "language": self.language.value,
            "format": self.format.value,
            "roles_consulted": self.roles_consulted,
        }

    def to_markdown(self) -> str:
        """Convert to Markdown format"""
        md = f"""# Shrnutí projektu: {self.project_name}

**ID projektu:** {self.project_id}
**Vygenerováno:** {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}
**Celkový status:** {self.overall_status}
**Spolehlivost:** {self.confidence_score:.1%}

---

## Shrnutí pro vedení

{self.executive_summary}

---

## Statistiky pozic

| Metrika | Hodnota |
|---------|---------|
| Celkem pozic | {self.position_summary.total_count} |
| Zelené (OK) | {self.position_summary.green_count} ({self.position_summary.green_percentage:.1f}%) |
| Oranžové (Varování) | {self.position_summary.amber_count} |
| Červené (Kritické) | {self.position_summary.red_count} |
| Celková hodnota | {self.position_summary.total_value_czk:,.2f} CZK |
| Míra úspěšnosti | {self.position_summary.pass_rate:.1f}% |

---

## Klíčová zjištění

"""
        for i, finding in enumerate(self.key_findings, 1):
            md += f"{i}. {finding}\n"

        if self.critical_issues:
            md += "\n---\n\n## ⚠️ Kritické problémy\n\n"
            for issue in self.critical_issues:
                md += f"- ❌ {issue}\n"

        if self.warnings:
            md += "\n---\n\n## ⚡ Varování\n\n"
            for warning in self.warnings:
                md += f"- ⚠️ {warning}\n"

        if self.recommendations:
            md += "\n---\n\n## Doporučení\n\n"
            for i, rec in enumerate(self.recommendations, 1):
                md += f"{i}. {rec}\n"

        md += f"""
---

## Metadata

- **Čas generování:** {self.generation_time_seconds:.2f}s
- **Konzultované role:** {', '.join(self.roles_consulted)}
- **Jazyk:** {self.language.value}
"""
        if self.multi_role_speedup:
            md += f"- **Zrychlení paralelním zpracováním:** {self.multi_role_speedup:.2f}x\n"

        return md


class SummaryGenerator:
    """
    Generates comprehensive project summaries using Multi-Role AI.

    Uses optimized parallel execution for 3-4x speedup.
    """

    def __init__(self):
        self.claude = ClaudeClient()

    async def generate_summary(
        self,
        project_id: str,
        project_name: str,
        positions: List[Dict[str, Any]],
        audit_results: Optional[Dict[str, Any]] = None,
        language: SummaryLanguage = SummaryLanguage.CZECH,
        output_format: SummaryFormat = SummaryFormat.JSON,
        use_parallel: bool = True,
    ) -> ProjectSummary:
        """
        Generate comprehensive project summary.

        Args:
            project_id: Unique project identifier
            project_name: Human-readable project name
            positions: List of position dictionaries with enrichment/audit data
            audit_results: Optional pre-computed audit results
            language: Output language
            output_format: Output format (JSON, Markdown, HTML)
            use_parallel: Use parallel Multi-Role execution (recommended)

        Returns:
            ProjectSummary with complete analysis
        """
        start_time = time.time()

        logger.info(f"🚀 Generating summary for project {project_id} ({len(positions)} positions)")

        # Step 1: Calculate position statistics
        position_summary = self._calculate_position_stats(positions)

        # Step 2: Build context for Multi-Role analysis
        context = self._build_summary_context(
            project_id=project_id,
            project_name=project_name,
            positions=positions,
            position_summary=position_summary,
            audit_results=audit_results,
        )

        # Step 3: Create classification for summary task
        classification = TaskClassification(
            complexity=TaskComplexity.COMPLEX,
            domains=[Domain.VALIDATION, Domain.CALCULATION],
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

        # Step 4: Generate summary question
        question = self._build_summary_question(
            project_name=project_name,
            position_summary=position_summary,
            language=language,
        )

        # Step 5: Execute Multi-Role analysis
        logger.info(f"📊 Executing Multi-Role analysis (parallel={use_parallel})")

        result = execute_multi_role(
            user_question=question,
            classification=classification,
            context=context,
            parallel=use_parallel,
        )

        # Step 6: Parse Multi-Role response
        summary_data = self._parse_multi_role_response(
            result.answer,
            result.warnings,
            result.critical_issues,
        )

        # Step 7: Determine overall status
        overall_status = self._determine_overall_status(
            position_summary=position_summary,
            critical_issues=result.critical_issues,
        )

        generation_time = time.time() - start_time

        # Build final summary
        summary = ProjectSummary(
            project_id=project_id,
            project_name=project_name,
            generated_at=datetime.now(),
            position_summary=position_summary,
            executive_summary=summary_data.get("executive_summary", result.answer[:500]),
            key_findings=summary_data.get("key_findings", []),
            recommendations=summary_data.get("recommendations", []),
            critical_issues=result.critical_issues,
            warnings=result.warnings,
            overall_status=overall_status,
            confidence_score=result.confidence,
            generation_time_seconds=generation_time,
            multi_role_speedup=result.performance.parallel_speedup if result.performance else None,
            language=language,
            format=output_format,
            roles_consulted=[r.value for r in result.roles_consulted],
        )

        logger.info(
            f"✅ Summary generated in {generation_time:.2f}s "
            f"(status: {overall_status}, confidence: {result.confidence:.1%})"
        )

        return summary

    def _calculate_position_stats(self, positions: List[Dict[str, Any]]) -> PositionSummary:
        """Calculate statistics from positions"""
        total = len(positions)
        green = 0
        amber = 0
        red = 0
        enriched = 0
        needs_review = 0
        total_value = 0.0

        for pos in positions:
            # Count by status
            status = pos.get("classification", pos.get("status", "")).upper()
            if status == "GREEN":
                green += 1
            elif status == "AMBER":
                amber += 1
                needs_review += 1
            elif status == "RED":
                red += 1
                needs_review += 1

            # Count enriched
            if pos.get("enrichment") or pos.get("enriched"):
                enriched += 1

            # Sum value
            value = pos.get("total_price", pos.get("value_czk", 0))
            if isinstance(value, (int, float)):
                total_value += value

        return PositionSummary(
            total_count=total,
            green_count=green,
            amber_count=amber,
            red_count=red,
            total_value_czk=total_value,
            enriched_count=enriched,
            needs_review_count=needs_review,
        )

    def _build_summary_context(
        self,
        project_id: str,
        project_name: str,
        positions: List[Dict[str, Any]],
        position_summary: PositionSummary,
        audit_results: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Build context for Multi-Role analysis"""
        # Sample positions for analysis (avoid token overflow)
        sample_positions = positions[:20] if len(positions) > 20 else positions

        # Extract critical positions
        critical_positions = [
            p for p in positions
            if p.get("classification", "").upper() == "RED"
            or p.get("status", "").upper() == "RED"
        ][:5]

        return {
            "project_info": {
                "id": project_id,
                "name": project_name,
                "total_positions": position_summary.total_count,
                "total_value_czk": position_summary.total_value_czk,
            },
            "statistics": {
                "green_count": position_summary.green_count,
                "amber_count": position_summary.amber_count,
                "red_count": position_summary.red_count,
                "pass_rate": position_summary.pass_rate,
            },
            "sample_positions": sample_positions,
            "critical_positions": critical_positions,
            "previous_audit": audit_results,
        }

    def _build_summary_question(
        self,
        project_name: str,
        position_summary: PositionSummary,
        language: SummaryLanguage,
    ) -> str:
        """Build summary question for Multi-Role"""
        if language == SummaryLanguage.CZECH:
            return f"""Prosím vygenerujte komplexní shrnutí projektu "{project_name}".

Statistiky pozic:
- Celkem: {position_summary.total_count} pozic
- Zelené (OK): {position_summary.green_count} ({position_summary.green_percentage:.1f}%)
- Oranžové (varování): {position_summary.amber_count}
- Červené (kritické): {position_summary.red_count}
- Celková hodnota: {position_summary.total_value_czk:,.0f} CZK
- Míra úspěšnosti: {position_summary.pass_rate:.1f}%

Prosím poskytněte:
1. Shrnutí pro vedení (2-3 odstavce)
2. Klíčová zjištění (3-5 bodů)
3. Doporučení pro další kroky (3-5 bodů)
4. Identifikujte kritické problémy vyžadující okamžitou pozornost

Odpovězte ve formátu JSON:
{{
    "executive_summary": "...",
    "key_findings": ["...", "..."],
    "recommendations": ["...", "..."]
}}"""
        else:  # English
            return f"""Please generate a comprehensive summary for project "{project_name}".

Position statistics:
- Total: {position_summary.total_count} positions
- Green (OK): {position_summary.green_count} ({position_summary.green_percentage:.1f}%)
- Amber (warning): {position_summary.amber_count}
- Red (critical): {position_summary.red_count}
- Total value: {position_summary.total_value_czk:,.0f} CZK
- Pass rate: {position_summary.pass_rate:.1f}%

Please provide:
1. Executive summary (2-3 paragraphs)
2. Key findings (3-5 points)
3. Recommendations for next steps (3-5 points)
4. Identify critical issues requiring immediate attention

Respond in JSON format:
{{
    "executive_summary": "...",
    "key_findings": ["...", "..."],
    "recommendations": ["...", "..."]
}}"""

    def _parse_multi_role_response(
        self,
        answer: str,
        warnings: List[str],
        critical_issues: List[str],
    ) -> Dict[str, Any]:
        """Parse Multi-Role response into structured data"""
        import json
        import re

        result = {
            "executive_summary": "",
            "key_findings": [],
            "recommendations": [],
        }

        # Try to extract JSON from response
        try:
            # Find JSON block in response
            json_match = re.search(r'\{[^{}]*"executive_summary"[^{}]*\}', answer, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                result.update(parsed)
                return result
        except (json.JSONDecodeError, AttributeError):
            pass

        # Fallback: use raw answer as executive summary
        result["executive_summary"] = answer[:1000]

        # Extract bullet points as key findings
        bullet_pattern = r'[-•]\s*(.+?)(?=\n[-•]|\n\n|$)'
        bullets = re.findall(bullet_pattern, answer)
        if bullets:
            result["key_findings"] = bullets[:5]

        return result

    def _determine_overall_status(
        self,
        position_summary: PositionSummary,
        critical_issues: List[str],
    ) -> str:
        """Determine overall project status"""
        # Critical issues = RED
        if critical_issues:
            return "RED"

        # Any red positions = RED
        if position_summary.red_count > 0:
            return "RED"

        # >10% amber = AMBER
        amber_percentage = (
            position_summary.amber_count / position_summary.total_count * 100
            if position_summary.total_count > 0 else 0
        )
        if amber_percentage > 10:
            return "AMBER"

        # >90% green = GREEN
        if position_summary.green_percentage >= 90:
            return "GREEN"

        return "AMBER"


# Convenience function
async def generate_project_summary(
    project_id: str,
    project_name: str,
    positions: List[Dict[str, Any]],
    language: str = "cs",
    use_parallel: bool = True,
) -> Dict[str, Any]:
    """
    Convenience function to generate project summary.

    Args:
        project_id: Project ID
        project_name: Project name
        positions: List of positions with audit data
        language: Output language (cs, en, sk)
        use_parallel: Use parallel execution (recommended)

    Returns:
        Dictionary with summary data
    """
    generator = SummaryGenerator()

    lang = SummaryLanguage.CZECH
    if language == "en":
        lang = SummaryLanguage.ENGLISH
    elif language == "sk":
        lang = SummaryLanguage.SLOVAK

    summary = await generator.generate_summary(
        project_id=project_id,
        project_name=project_name,
        positions=positions,
        language=lang,
        use_parallel=use_parallel,
    )

    return summary.to_dict()
