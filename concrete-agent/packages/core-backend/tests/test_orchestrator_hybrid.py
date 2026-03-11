"""
Tests for HybridMultiRoleOrchestrator

Tests async parallel execution, error handling, and graceful degradation
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from pathlib import Path

from app.services.orchestrator_hybrid import (
    HybridMultiRoleOrchestrator,
    HybridQueryType,
    HybridQueryResult,
    HybridFinalOutput,
    generate_hybrid_project_summary
)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_llm_client():
    """Mock LLM client for testing"""
    client = Mock()
    client.call = Mock(return_value={
        "project_summary": {"element": "Test foundation"},
        "exposure_analysis": {"exposure_classes": ["XC4", "XF3"]},
        "structural_analysis": {"required_strength": {"from_calculation": "C25/30"}},
        "final_specification": {"concrete_class": "C30/37"},
        "materials_breakdown": {},
        "cost_summary": {"total_incl_vat_czk": 326908},
        "warnings": [],
        "confidence": 0.92
    })
    client.model_name = "test-model"
    return client


@pytest.fixture
def orchestrator(mock_llm_client):
    """Create orchestrator with mocked LLM client"""
    orch = HybridMultiRoleOrchestrator()
    orch.llm_client = mock_llm_client
    return orch


# ============================================================================
# UNIT TESTS
# ============================================================================

class TestHybridOrchestrator:
    """Test HybridMultiRoleOrchestrator functionality"""

    def test_initialization(self):
        """Test orchestrator initializes correctly"""
        orch = HybridMultiRoleOrchestrator()
        assert orch.prompts_dir.exists()
        assert orch.hybrid_prompts_dir.exists()
        assert hasattr(orch, 'llm_client')
        assert hasattr(orch, 'llm_name')

    def test_load_hybrid_prompt_comprehensive(self, orchestrator):
        """Test loading comprehensive analysis prompt"""
        prompt = orchestrator._load_hybrid_prompt(
            HybridQueryType.COMPREHENSIVE_ANALYSIS
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 100
        assert "HYBRID PROMPT" in prompt
        assert "Comprehensive" in prompt or "COMPREHENSIVE" in prompt

    def test_load_hybrid_prompt_compliance(self, orchestrator):
        """Test loading compliance & risks prompt"""
        prompt = orchestrator._load_hybrid_prompt(
            HybridQueryType.COMPLIANCE_RISKS
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 100
        assert "HYBRID PROMPT" in prompt or "Compliance" in prompt or "COMPLIANCE" in prompt

    def test_prepare_user_context_simple(self, orchestrator):
        """Test context preparation with project description only"""
        context = orchestrator._prepare_user_context(
            "Simple foundation project",
            positions=None,
            specifications=None
        )
        assert "Simple foundation project" in context
        assert "PROJECT DESCRIPTION" in context

    def test_prepare_user_context_with_positions(self, orchestrator):
        """Test context preparation with positions"""
        positions = [
            {"item_name": "Concrete C30/37", "quantity": 22.5, "unit": "m³"},
            {"item_name": "Reinforcement", "quantity": 2.25, "unit": "t"}
        ]
        context = orchestrator._prepare_user_context(
            "Foundation with positions",
            positions=positions,
            specifications=None
        )
        assert "Foundation with positions" in context
        assert "POSITIONS" in context
        assert "Concrete C30/37" in context
        assert "22.5" in context

    def test_prepare_user_context_with_many_positions(self, orchestrator):
        """Test context preparation truncates long position lists"""
        positions = [{"item_name": f"Item {i}", "quantity": i, "unit": "m³"} for i in range(20)]
        context = orchestrator._prepare_user_context(
            "Large project",
            positions=positions,
            specifications=None
        )
        assert "Large project" in context
        assert "and 10 more" in context or "..." in context

    @pytest.mark.asyncio
    async def test_invoke_llm_async_success(self, orchestrator):
        """Test async LLM invocation succeeds"""
        result, tokens = await orchestrator._invoke_llm_async(
            prompt_text="Test prompt",
            user_context="Test context",
            temperature=0.3,
            timeout_seconds=15
        )

        assert isinstance(result, dict)
        assert tokens > 0
        assert "project_summary" in result

    @pytest.mark.asyncio
    async def test_invoke_llm_async_timeout(self, orchestrator):
        """Test async LLM invocation times out correctly"""
        # Mock slow LLM response
        async def slow_call(*args, **kwargs):
            await asyncio.sleep(20)  # Longer than timeout
            return {}

        with patch.object(orchestrator.llm_client, 'call', side_effect=slow_call):
            with pytest.raises(TimeoutError):
                await orchestrator._invoke_llm_async(
                    "Test prompt",
                    "Test context",
                    timeout_seconds=1
                )

    @pytest.mark.asyncio
    async def test_execute_hybrid_query_comprehensive(self, orchestrator):
        """Test executing comprehensive analysis query"""
        result = await orchestrator._execute_hybrid_query(
            HybridQueryType.COMPREHENSIVE_ANALYSIS,
            "Test foundation project",
            temperature=0.3
        )

        assert isinstance(result, HybridQueryResult)
        assert result.query_type == HybridQueryType.COMPREHENSIVE_ANALYSIS
        assert result.error is None
        assert result.execution_time_ms > 0
        assert result.tokens_used > 0
        assert isinstance(result.result, dict)

    @pytest.mark.asyncio
    async def test_execute_hybrid_query_compliance(self, orchestrator):
        """Test executing compliance & risks query"""
        result = await orchestrator._execute_hybrid_query(
            HybridQueryType.COMPLIANCE_RISKS,
            "Test foundation project",
            temperature=0.2
        )

        assert isinstance(result, HybridQueryResult)
        assert result.query_type == HybridQueryType.COMPLIANCE_RISKS
        assert result.error is None

    @pytest.mark.asyncio
    async def test_execute_hybrid_query_error_handling(self, orchestrator):
        """Test hybrid query handles errors gracefully"""
        # Mock LLM to raise exception
        orchestrator.llm_client.call = Mock(side_effect=Exception("Test error"))

        result = await orchestrator._execute_hybrid_query(
            HybridQueryType.COMPREHENSIVE_ANALYSIS,
            "Test context"
        )

        assert isinstance(result, HybridQueryResult)
        assert result.error is not None
        assert "Test error" in result.error
        assert result.tokens_used == 0

    @pytest.mark.asyncio
    async def test_execute_hybrid_analysis_both_success(self, orchestrator):
        """Test full hybrid analysis with both queries succeeding"""
        result = await orchestrator.execute_hybrid_analysis(
            "Foundation strip 45m × 0.8m × 0.6m, outdoor, groundwater present",
            positions=[{"item_name": "Concrete", "quantity": 21.6, "unit": "m³"}],
            specifications=None
        )

        assert isinstance(result, HybridFinalOutput)
        assert result.project_summary is not None
        assert result.compliance_status is not None
        assert result.performance.queries_executed == 2
        assert result.performance.queries_successful == 2
        assert result.execution_time_seconds > 0

    @pytest.mark.asyncio
    async def test_execute_hybrid_analysis_partial_failure(self, orchestrator):
        """Test hybrid analysis handles partial failure (1 query fails)"""
        # Mock to make comprehensive query succeed, compliance fail
        call_count = [0]

        def mock_call(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # First call (comprehensive) succeeds
                return {
                    "project_summary": {"element": "Test"},
                    "exposure_analysis": {},
                    "structural_analysis": {},
                    "final_specification": {"concrete_class": "C30/37"},
                    "materials_breakdown": {},
                    "cost_summary": {},
                    "warnings": [],
                    "confidence": 0.9
                }
            else:
                # Second call (compliance) fails
                raise Exception("Compliance check failed")

        orchestrator.llm_client.call = Mock(side_effect=mock_call)

        result = await orchestrator.execute_hybrid_analysis(
            "Test project",
            positions=None,
            specifications=None
        )

        assert isinstance(result, HybridFinalOutput)
        assert result.performance.queries_successful == 1
        assert result.performance.queries_failed == 1
        assert len(result.warnings) > 0  # Should have warning about failed query
        assert "Compliance check failed" in str(result.warnings) or result.compliance_status.get("overall") == "UNKNOWN"

    @pytest.mark.asyncio
    async def test_execute_hybrid_analysis_total_failure(self, orchestrator):
        """Test hybrid analysis raises error if both queries fail"""
        orchestrator.llm_client.call = Mock(side_effect=Exception("Total failure"))

        with pytest.raises(RuntimeError, match="All hybrid queries failed"):
            await orchestrator.execute_hybrid_analysis(
                "Test project",
                positions=None,
                specifications=None
            )

    def test_merge_hybrid_results_both_success(self, orchestrator):
        """Test merging results when both queries succeed"""
        comp_result = HybridQueryResult(
            query_type=HybridQueryType.COMPREHENSIVE_ANALYSIS,
            result={
                "project_summary": {"element": "Foundation"},
                "exposure_analysis": {"exposure_classes": ["XC4"]},
                "structural_analysis": {},
                "final_specification": {"concrete_class": "C30/37"},
                "materials_breakdown": {},
                "cost_summary": {"total_incl_vat_czk": 300000},
                "warnings": ["Warning 1"],
                "confidence": 0.9
            },
            execution_time_ms=8500,
            tokens_used=1000,
            temperature_used=0.3,
            timestamp=datetime.now(),
            error=None
        )

        compl_result = HybridQueryResult(
            query_type=HybridQueryType.COMPLIANCE_RISKS,
            result={
                "compliance_status": {"overall": "COMPLIANT"},
                "standards_checked": [],
                "compliance_checks": [],
                "risks_identified": [],
                "document_issues": [],
                "rfi_items": [],
                "recommendations": [],
                "assumptions_made": ["Assumption 1"],
                "warnings": ["Warning 2"],
                "confidence": 0.85
            },
            execution_time_ms=7200,
            tokens_used=800,
            temperature_used=0.2,
            timestamp=datetime.now(),
            error=None
        )

        merged = orchestrator._merge_hybrid_results(comp_result, compl_result, 9000)

        assert isinstance(merged, HybridFinalOutput)
        assert merged.project_summary["element"] == "Foundation"
        assert merged.compliance_status["overall"] == "COMPLIANT"
        assert len(merged.warnings) == 2
        assert merged.performance.queries_successful == 2
        assert merged.performance.tokens_total == 1800
        assert merged.performance.parallel_efficiency > 100  # Should be > 100% (parallel gain)

    def test_merge_hybrid_results_comprehensive_failure(self, orchestrator):
        """Test merging when comprehensive query failed"""
        comp_result = HybridQueryResult(
            query_type=HybridQueryType.COMPREHENSIVE_ANALYSIS,
            result={},
            execution_time_ms=100,
            tokens_used=0,
            temperature_used=0.3,
            timestamp=datetime.now(),
            error="Comprehensive failed"
        )

        compl_result = HybridQueryResult(
            query_type=HybridQueryType.COMPLIANCE_RISKS,
            result={"compliance_status": {"overall": "COMPLIANT"}, "risks_identified": [], "warnings": [], "confidence": 0.85},
            execution_time_ms=7000,
            tokens_used=800,
            temperature_used=0.2,
            timestamp=datetime.now(),
            error=None
        )

        merged = orchestrator._merge_hybrid_results(comp_result, compl_result, 7100)

        assert isinstance(merged, HybridFinalOutput)
        assert "error" in merged.project_summary  # Should have error marker
        assert "Comprehensive analysis failed" in merged.warnings[0]
        assert merged.compliance_status["overall"] == "COMPLIANT"  # Compliance still worked

    def test_has_critical_risks(self, orchestrator):
        """Test HybridFinalOutput.has_critical_risks()"""
        # Create minimal output with critical risk
        output = HybridFinalOutput(
            project_summary={},
            exposure_analysis={},
            structural_analysis={},
            final_specification={},
            materials_breakdown={},
            cost_summary={},
            compliance_status={"overall": "COMPLIANT"},
            standards_checked=[],
            compliance_checks=[],
            risks_identified=[{"severity": "critical", "title": "Critical issue"}],
            document_issues=[],
            rfi_items=[],
            warnings=[],
            recommendations=[],
            confidence=0.8,
            assumptions=[],
            performance=Mock(),
            execution_time_seconds=10.0
        )

        assert output.has_critical_risks() is True

    def test_get_status_emoji(self, orchestrator):
        """Test status emoji generation"""
        # Critical risk
        output_critical = HybridFinalOutput(
            project_summary={},
            exposure_analysis={},
            structural_analysis={},
            final_specification={},
            materials_breakdown={},
            cost_summary={},
            compliance_status={"overall": "COMPLIANT"},
            standards_checked=[],
            compliance_checks=[],
            risks_identified=[{"severity": "critical"}],
            document_issues=[],
            rfi_items=[],
            warnings=[],
            recommendations=[],
            confidence=0.8,
            assumptions=[],
            performance=Mock(),
            execution_time_seconds=10.0
        )
        assert output_critical.get_status_emoji() == "🚨"

        # Non-compliant
        output_non_compliant = HybridFinalOutput(
            project_summary={},
            exposure_analysis={},
            structural_analysis={},
            final_specification={},
            materials_breakdown={},
            cost_summary={},
            compliance_status={"overall": "NON_COMPLIANT"},
            standards_checked=[],
            compliance_checks=[],
            risks_identified=[],
            document_issues=[],
            rfi_items=[],
            warnings=[],
            recommendations=[],
            confidence=0.8,
            assumptions=[],
            performance=Mock(),
            execution_time_seconds=10.0
        )
        assert output_non_compliant.get_status_emoji() == "❌"

        # Warnings only
        output_warnings = HybridFinalOutput(
            project_summary={},
            exposure_analysis={},
            structural_analysis={},
            final_specification={},
            materials_breakdown={},
            cost_summary={},
            compliance_status={"overall": "COMPLIANT"},
            standards_checked=[],
            compliance_checks=[],
            risks_identified=[],
            document_issues=[],
            rfi_items=[],
            warnings=["Some warning"],
            recommendations=[],
            confidence=0.8,
            assumptions=[],
            performance=Mock(),
            execution_time_seconds=10.0
        )
        assert output_warnings.get_status_emoji() == "⚠️"

        # All OK
        output_ok = HybridFinalOutput(
            project_summary={},
            exposure_analysis={},
            structural_analysis={},
            final_specification={},
            materials_breakdown={},
            cost_summary={},
            compliance_status={"overall": "COMPLIANT"},
            standards_checked=[],
            compliance_checks=[],
            risks_identified=[],
            document_issues=[],
            rfi_items=[],
            warnings=[],
            recommendations=[],
            confidence=0.8,
            assumptions=[],
            performance=Mock(),
            execution_time_seconds=10.0
        )
        assert output_ok.get_status_emoji() == "✅"


class TestConvenienceFunction:
    """Test generate_hybrid_project_summary convenience function"""

    @pytest.mark.asyncio
    async def test_convenience_function_basic(self):
        """Test convenience function works"""
        with patch('app.services.orchestrator_hybrid.HybridMultiRoleOrchestrator') as MockOrch:
            mock_orch_instance = Mock()
            mock_orch_instance.execute_hybrid_analysis = AsyncMock(return_value=Mock(spec=HybridFinalOutput))
            MockOrch.return_value = mock_orch_instance

            result = await generate_hybrid_project_summary(
                "Test project",
                positions=None,
                specifications=None
            )

            # Verify orchestrator was created and execute was called
            MockOrch.assert_called_once()
            mock_orch_instance.execute_hybrid_analysis.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
