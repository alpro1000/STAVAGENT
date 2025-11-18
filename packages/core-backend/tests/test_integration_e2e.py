"""
End-to-End Integration Tests for Multi-Role AI System

Tests the complete pipeline from user question to final answer:
1. Task Classifier → TaskClassification
2. Orchestrator → FinalOutput

Run with: pytest tests/test_integration_e2e.py -v
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime

from app.services.task_classifier import classify_task, TaskComplexity, Domain, Role
from app.services.orchestrator import execute_multi_role, MultiRoleOrchestrator


# ============================================================================
# E2E TESTS WITH MOCKED CLAUDE API
# ============================================================================

class TestEndToEndSimpleTask:
    """Test simple single-role tasks end-to-end"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_simple_otskp_lookup(self, mock_claude_class):
        """Test: Simple OTSKP code lookup"""
        # Mock Claude response
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": """
## COST ESTIMATE - Concrete Foundation

### OTSKP CODE
**272325** - Zřizování základových konstrukcí z prostého betonu

### DESCRIPTION
This code covers concrete foundation construction works including:
- Preparation
- Formwork
- Concrete pouring
- Finishing

### REFERENCE
OTSKP 2024 Catalog, Section 272 - Concrete Works
"""
        }
        mock_claude_class.return_value = mock_claude_instance

        # User question
        question = "What's the OTSKP code for concrete foundation?"

        # Step 1: Classify
        classification = classify_task(question)

        # Verify classification
        assert classification.complexity == TaskComplexity.SIMPLE
        assert Domain.CODES in classification.domains
        assert any(r.role == Role.COST_ESTIMATOR for r in classification.roles)
        assert not classification.requires_rfi

        # Step 2: Execute orchestrator
        result = execute_multi_role(question, classification)

        # Verify result
        assert result is not None
        assert "272325" in result.answer
        assert Role.COST_ESTIMATOR in result.roles_consulted
        assert len(result.critical_issues) == 0
        assert result.get_status() in ["✅ OK", "⚠️ WARNINGS"]


class TestEndToEndStandardCalculation:
    """Test standard engineering calculations"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_volume_calculation(self, mock_claude_class):
        """Test: Standard volume calculation"""
        # Mock Claude response
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": """
## STRUCTURAL ANALYSIS - Foundation Volume

### RESULT
**Volume:** 45.0 m³

### CALCULATIONS

**Step 1: Volume Calculation**
V = L × W × H
V = 15m × 6m × 0.5m
V = 45.0 m³

**Step 2: Required Concrete Class**
For typical foundation, recommend C30/37

### CONFIDENCE
Confidence: 95%

### REVIEWED BY
- Structural Engineer ✅
"""
        }
        mock_claude_class.return_value = mock_claude_instance

        # User question
        question = "Calculate concrete volume for foundation 15m × 6m × 0.5m"

        # Step 1: Classify
        classification = classify_task(question)

        # Verify classification
        assert classification.complexity == TaskComplexity.STANDARD
        assert Domain.CALCULATION in classification.domains
        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in classification.roles)

        # Step 2: Execute
        result = execute_multi_role(question, classification)

        # Verify result
        assert "45" in result.answer or "45.0" in result.answer
        assert result.confidence >= 0.8
        assert result.total_tokens > 0


class TestEndToEndComplexValidation:
    """Test complex multi-role validation tasks"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_project_validation_with_errors(self, mock_claude_class):
        """Test: Complex project validation finding errors"""
        # Mock responses from multiple roles
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = [
            # Document Validator
            {
                "raw_text": """
## DOCUMENT VALIDATION REPORT

### SUMMARY
Found 2 critical issues and 1 warning

### CRITICAL ISSUES

🚨 CRITICAL: Missing foundation thickness dimension
   Location: Drawing A-02
   Impact: Cannot calculate concrete volume

🚨 CRITICAL: Contradictory concrete class
   Spec says C30/37, BOQ says C25/30

### WARNINGS

⚠️ WARNING: Incomplete material specification
   Exposure class not specified

### REVIEWED BY
- Document Validator ✅
"""
            },
            # Structural Engineer
            {
                "raw_text": """
## STRUCTURAL ANALYSIS

### RESULT
Cannot verify structural adequacy without foundation thickness.

⚠️ WARNING: Missing critical dimension prevents safety verification

### REVIEWED BY
- Structural Engineer ✅
"""
            },
            # Standards Checker
            {
                "raw_text": """
## STANDARDS COMPLIANCE CHECK

### STATUS
❌ NON-COMPLIANT

### ISSUES
🚨 CRITICAL: Missing mandatory data prevents compliance verification

### RECOMMENDATION
Resolve critical issues and re-submit

### REVIEWED BY
- Standards Checker ✅
"""
            },
        ]
        mock_claude_class.return_value = mock_claude_instance

        # User question
        question = "Check my foundation design for errors and compliance"

        # Step 1: Classify
        classification = classify_task(question)

        # Verify classification
        assert classification.complexity == TaskComplexity.COMPLEX
        assert Domain.VALIDATION in classification.domains

        # Step 2: Execute
        result = execute_multi_role(question, classification, context={"has_files": True})

        # Verify result
        assert len(result.roles_consulted) >= 2
        assert len(result.critical_issues) > 0
        assert result.get_status() == "❌ CRITICAL ISSUES FOUND"
        assert result.has_critical_issues()

        # Verify roles were invoked in correct order
        ordered_roles = [r for r in result.roles_consulted]
        # Document Validator should be first
        assert ordered_roles[0] == Role.DOCUMENT_VALIDATOR


class TestEndToEndConflictResolution:
    """Test conflict detection and resolution"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_concrete_class_conflict(self, mock_claude_class):
        """Test: Conflict between roles on concrete class"""
        # Mock conflicting responses
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = [
            # Structural Engineer
            {
                "raw_text": """
## STRUCTURAL ANALYSIS

### RESULT
**Required Concrete Class:** C25/30

### JUSTIFICATION
Load calculations show C25/30 is sufficient:
- Design load: 450 kN/m²
- Required strength: 25 MPa
- Safety factor: 1.55 ✅

Confidence: 90%
"""
            },
            # Concrete Specialist
            {
                "raw_text": """
## CONCRETE SPECIFICATION

### RESULT
**Required Concrete Class:** C30/37

### JUSTIFICATION
Exposure class XD2 (outdoor with deicing salts) requires minimum C30/37
per ČSN EN 206+A2:2021, Table F.1

⚠️ WARNING: C25/30 does not meet durability requirements

Confidence: 95%
"""
            },
            # Standards Checker
            {
                "raw_text": """
## STANDARDS COMPLIANCE

### VERIFICATION
✅ C30/37 compliant with ČSN EN 206 Table F.1 for XD2 exposure
❌ C25/30 does NOT meet minimum requirement

### FINAL VERDICT
C30/37 required

Confidence: 100%
"""
            },
        ]
        mock_claude_class.return_value = mock_claude_instance

        # User question
        question = "What concrete class for 5-story building foundation with deicing salts?"

        # Step 1: Classify
        classification = classify_task(question)

        # Step 2: Execute
        result = execute_multi_role(question, classification)

        # Verify conflict was detected
        assert len(result.conflicts) >= 1

        # Verify conflict resolution
        conflict = result.conflicts[0]
        assert "C25/30" in str(conflict.descriptions)
        assert "C30/37" in str(conflict.descriptions)
        assert conflict.resolution is not None

        # Final answer should use C30/37 (stricter requirement)
        assert "C30/37" in result.answer


class TestEndToEndCreativeTask:
    """Test creative/optimization tasks"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_cost_optimization(self, mock_claude_class):
        """Test: Creative optimization task"""
        # Mock responses
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = [
            # Structural Engineer
            {
                "raw_text": """
## STRUCTURAL ANALYSIS

### CURRENT DESIGN
C30/37, dimensions 15m × 6m × 0.6m

### OPTIMIZATION OPTIONS
1. Reduce thickness to 0.5m if soil bearing capacity allows
2. Use C25/30 if exposure permits

Safety factor with C25/30 and 0.5m: 1.52 (acceptable)
"""
            },
            # Concrete Specialist
            {
                "raw_text": """
## MATERIAL SPECIFICATION

### COST ANALYSIS
- C30/37: 2,850 Kč/m³
- C25/30: 2,700 Kč/m³ (5% savings)

⚠️ WARNING: C25/30 only suitable for XC3 or better exposure

### RECOMMENDATION
If exposure XC3, C25/30 acceptable for cost savings
"""
            },
            # Cost Estimator
            {
                "raw_text": """
## COST OPTIMIZATION REPORT

### OPTION 1: Current Design
C30/37, 0.6m thick: 54 m³ × 2,850 Kč = 153,900 Kč

### OPTION 2: Optimized Design
C25/30, 0.5m thick: 45 m³ × 2,700 Kč = 121,500 Kč

**Savings:** 32,400 Kč (21%)

### RECOMMENDATION
If exposure and soil conditions permit, Option 2 saves 21%
"""
            },
            # Standards Checker
            {
                "raw_text": """
## COMPLIANCE VERIFICATION

Option 2 (C25/30, 0.5m) compliant IF:
✅ Exposure class XC3 or better
✅ Soil bearing capacity ≥ 200 kPa
✅ Safety factor ≥ 1.5

User must confirm these conditions.
"""
            },
        ]
        mock_claude_class.return_value = mock_claude_instance

        # User question
        question = "Optimize foundation cost while maintaining safety"

        # Step 1: Classify
        classification = classify_task(question)

        # Verify creative classification
        assert classification.complexity == TaskComplexity.CREATIVE

        # Step 2: Execute
        result = execute_multi_role(question, classification)

        # Verify multiple options presented
        assert "optimization" in result.answer.lower() or "option" in result.answer.lower()
        assert len(result.roles_consulted) >= 3


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Test performance characteristics"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_execution_time_tracking(self, mock_claude_class):
        """Test that execution time is tracked"""
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {"raw_text": "Test"}
        mock_claude_class.return_value = mock_claude_instance

        question = "Test question"
        classification = classify_task(question)

        result = execute_multi_role(question, classification)

        assert result.execution_time_seconds >= 0

    @patch('app.services.orchestrator.ClaudeClient')
    def test_token_tracking(self, mock_claude_class):
        """Test that tokens are tracked"""
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {"raw_text": "Test response"}
        mock_claude_class.return_value = mock_claude_instance

        question = "Test question"
        classification = classify_task(question)

        result = execute_multi_role(question, classification)

        assert result.total_tokens > 0


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Test error handling in E2E scenarios"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_claude_api_error_handling(self, mock_claude_class):
        """Test graceful handling of Claude API errors"""
        # Mock API error
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = Exception("API Error")
        mock_claude_class.return_value = mock_claude_instance

        question = "Test question"
        classification = classify_task(question)

        # Should not crash, should return result with error message
        result = execute_multi_role(question, classification)

        assert result is not None
        assert result.answer is not None
        assert "ERROR" in result.answer or "error" in result.answer.lower()


# ============================================================================
# REAL-WORLD SCENARIOS
# ============================================================================

class TestRealWorldScenarios:
    """Test realistic construction engineering scenarios"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_pipe_sdr_validation(self, mock_claude_class):
        """Test: PE pipe SDR compatibility check"""
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": """
## MATERIAL COMPATIBILITY CHECK

### SPECIFICATION ANALYSIS
PE pipe SDR11, Ø90mm, wall 5.4mm

### VALIDATION
❌ INCOMPATIBLE SPECIFICATION DETECTED

**SDR11 + Ø90mm requires wall thickness 8.2mm**
Specified wall 5.4mm = SDR17 (not SDR11)

### CORRECTION
Option 1: Use SDR11 with wall 8.2mm (PN16)
Option 2: Use SDR17 with wall 5.4mm (PN10)

### REVIEWED BY
- Concrete Specialist ✅ (pipe database)
"""
        }
        mock_claude_class.return_value = mock_claude_instance

        question = "Check if PE pipe SDR11, diameter 90mm, wall 5.4mm is correct"

        classification = classify_task(question)
        result = execute_multi_role(question, classification)

        # Should detect incompatibility
        assert "SDR" in result.answer
        assert "incompatible" in result.answer.lower() or "incorrect" in result.answer.lower()

    @patch('app.services.orchestrator.ClaudeClient')
    def test_multi_language_czech(self, mock_claude_class):
        """Test: Question in Czech language"""
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": """
## ANALÝZA OBJEMU BETONU

### VÝSLEDEK
Objem: 45.0 m³

### VÝPOČET
V = 15m × 6m × 0.5m = 45.0 m³

Třída betonu: C30/37
"""
        }
        mock_claude_class.return_value = mock_claude_instance

        question = "Spočítej objem betonu pro základ 15m × 6m × 0.5m"

        classification = classify_task(question)
        result = execute_multi_role(question, classification)

        assert result is not None
        assert "45" in result.answer


# ============================================================================
# SUMMARY TEST
# ============================================================================

def test_system_components_exist():
    """Smoke test: Verify all system components are importable"""
    from app.services.task_classifier import TaskClassifier, classify_task
    from app.services.orchestrator import MultiRoleOrchestrator, execute_multi_role

    # Verify classes can be instantiated
    classifier = TaskClassifier()
    orchestrator = MultiRoleOrchestrator()

    assert classifier is not None
    assert orchestrator is not None

    # Verify functions work
    classification = classify_task("Test")
    assert classification is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
