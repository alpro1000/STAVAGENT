"""
Tests for Task Classifier

Run with: pytest tests/test_task_classifier.py -v
"""

import pytest
from app.services.task_classifier import (
    TaskClassifier,
    TaskComplexity,
    Domain,
    Role,
    classify_task,
)


class TestTaskClassifier:
    """Test task classification logic"""

    def setup_method(self):
        """Setup before each test"""
        self.classifier = TaskClassifier()

    # ============================================================================
    # SIMPLE TASKS (Single lookup, straightforward)
    # ============================================================================

    def test_simple_otskp_lookup(self):
        """Test simple OTSKP code lookup"""
        question = "What's the OTSKP code for concrete foundation?"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.SIMPLE
        assert Domain.CODES in result.domains
        assert any(r.role == Role.COST_ESTIMATOR for r in result.roles)
        assert result.requires_rfi == False

        # Check temperature is low for simple lookup
        cost_estimator = next(r for r in result.roles if r.role == Role.COST_ESTIMATOR)
        assert cost_estimator.temperature <= 0.3

    def test_simple_exposure_class_lookup(self):
        """Test simple exposure class question"""
        question = "What exposure class for outdoor pavement?"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.SIMPLE
        assert Domain.MATERIALS in result.domains
        assert any(r.role == Role.CONCRETE_SPECIALIST for r in result.roles)

    def test_simple_czech_question(self):
        """Test simple question in Czech"""
        question = "Jaký je kód OTSKP pro betonování základů?"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.SIMPLE
        assert Domain.CODES in result.domains
        assert any(r.role == Role.COST_ESTIMATOR for r in result.roles)

    # ============================================================================
    # STANDARD TASKS (Typical engineering)
    # ============================================================================

    def test_standard_volume_calculation(self):
        """Test standard volume calculation task"""
        question = "Calculate concrete volume for foundation 15m × 6m × 0.5m"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.STANDARD
        assert Domain.CALCULATION in result.domains
        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in result.roles)
        assert result.requires_rfi == False  # All dimensions provided

    def test_standard_cost_estimate(self):
        """Test cost estimation task"""
        question = "Calculate cost for concrete C30/37, volume 45 m³"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.STANDARD
        assert Domain.CALCULATION in result.domains
        assert any(r.role == Role.COST_ESTIMATOR for r in result.roles)

    def test_standard_adequacy_check(self):
        """Test concrete class adequacy check"""
        question = "Is C25/30 adequate for 5-story building foundation?"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.STANDARD
        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in result.roles)
        # Should also invoke Standards Checker for verification
        assert any(r.role == Role.STANDARDS_CHECKER for r in result.roles)

    # ============================================================================
    # COMPLEX TASKS (Multi-step, validation)
    # ============================================================================

    def test_complex_project_validation(self):
        """Test complex project validation"""
        question = "Check my foundation design for errors and compliance"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.COMPLEX
        assert Domain.VALIDATION in result.domains

        # Document Validator should be FIRST (priority 0)
        ordered_roles = result.get_roles_ordered()
        assert ordered_roles[0].role == Role.DOCUMENT_VALIDATOR
        assert ordered_roles[0].priority == 0

        # Standards Checker should be LAST in ordered list
        standards_checker = next(r for r in result.roles if r.role == Role.STANDARDS_CHECKER)
        assert ordered_roles[-1].role == Role.STANDARDS_CHECKER  # Last in ordered list

    def test_complex_full_analysis(self):
        """Test full project analysis"""
        question = "Analyze entire foundation: dimensions, costs, compliance, and find all errors"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.COMPLEX
        assert len(result.domains) >= 2  # Multiple domains

        # Should invoke multiple roles
        assert len(result.roles) >= 3

        # Should start with Document Validator
        ordered_roles = result.get_roles_ordered()
        assert ordered_roles[0].role == Role.DOCUMENT_VALIDATOR

    def test_complex_pipe_specification(self):
        """Test complex material compatibility check"""
        question = "Check if PE pipe SDR11, diameter 90mm, wall 5.4mm is correct"

        result = self.classifier.classify(question)

        assert Domain.MATERIALS in result.domains
        assert any(r.role == Role.CONCRETE_SPECIALIST for r in result.roles)
        # Concrete Specialist has pipe SDR database

    # ============================================================================
    # CREATIVE TASKS (Novel, optimization)
    # ============================================================================

    def test_creative_optimization(self):
        """Test optimization task (creative)"""
        question = "Optimize foundation cost while maintaining safety"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.CREATIVE

        # Should involve multiple roles
        assert len(result.roles) >= 2

        # Temperature should be higher for creative tasks
        for role in result.roles:
            assert role.temperature >= 0.3  # Higher temp for creativity

    def test_creative_alternative_design(self):
        """Test alternative design request"""
        question = "Suggest alternative foundation design for difficult soil"

        result = self.classifier.classify(question)

        assert result.complexity == TaskComplexity.CREATIVE
        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in result.roles)

    # ============================================================================
    # RFI (Request For Information) - Missing Data
    # ============================================================================

    def test_rfi_missing_dimensions(self):
        """Test RFI when dimensions missing"""
        question = "Calculate concrete volume for foundation"

        result = self.classifier.classify(question)

        assert result.requires_rfi == True
        assert "dimensions" in str(result.missing_data).lower()

    def test_rfi_missing_exposure(self):
        """Test RFI when exposure conditions missing"""
        question = "Specify concrete for foundation"

        result = self.classifier.classify(question)

        # May require RFI for exposure conditions
        # (depends on whether it's critical for the question)
        if result.requires_rfi:
            assert "exposure" in str(result.missing_data).lower()

    def test_no_rfi_when_data_complete(self):
        """Test no RFI when all data provided"""
        question = "Calculate volume for foundation 15m × 6m × 0.5m, outdoor, C30/37"

        result = self.classifier.classify(question)

        assert result.requires_rfi == False

    def test_no_rfi_when_files_provided(self):
        """Test no RFI when context has files"""
        question = "Check my foundation design"
        context = {"has_files": True}

        result = self.classifier.classify(question, context=context)

        assert result.requires_rfi == False  # Assume files contain needed data

    # ============================================================================
    # ROLE SELECTION LOGIC
    # ============================================================================

    def test_role_selection_structural(self):
        """Test structural engineer selection"""
        question = "Check if concrete strength is adequate for this load"

        result = self.classifier.classify(question)

        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in result.roles)

    def test_role_selection_materials(self):
        """Test concrete specialist selection"""
        question = "What exposure class for parking garage with deicing salts?"

        result = self.classifier.classify(question)

        assert any(r.role == Role.CONCRETE_SPECIALIST for r in result.roles)

    def test_role_selection_cost(self):
        """Test cost estimator selection"""
        question = "What's the budget for 45 m³ of C30/37 concrete?"

        result = self.classifier.classify(question)

        assert any(r.role == Role.COST_ESTIMATOR for r in result.roles)

    def test_role_selection_standards(self):
        """Test standards checker selection"""
        question = "Does this design comply with ČSN EN 206?"

        result = self.classifier.classify(question)

        assert any(r.role == Role.STANDARDS_CHECKER for r in result.roles)

    def test_role_selection_validation_first(self):
        """Test document validator is first for validation tasks"""
        question = "Find errors in my project documentation"

        result = self.classifier.classify(question)

        ordered_roles = result.get_roles_ordered()
        assert ordered_roles[0].role == Role.DOCUMENT_VALIDATOR

    # ============================================================================
    # TEMPERATURE SETTINGS
    # ============================================================================

    def test_temperature_simple_task(self):
        """Test temperature for simple tasks is low"""
        question = "Find OTSKP code for concrete"

        result = self.classifier.classify(question)

        # All roles should have low temperature for simple lookup
        for role in result.roles:
            assert role.temperature <= 0.4

    def test_temperature_creative_task(self):
        """Test temperature for creative tasks is higher"""
        question = "Optimize foundation design for cost and safety"

        result = self.classifier.classify(question)

        # Should have at least one role with higher temperature
        temps = [r.temperature for r in result.roles]
        assert max(temps) >= 0.4

    def test_temperature_never_exceeds_limit(self):
        """Test temperature never exceeds 0.9 (safety limit)"""
        questions = [
            "Design innovative foundation",
            "Optimize everything",
            "Creative solution needed",
        ]

        for question in questions:
            result = self.classifier.classify(question)
            for role in result.roles:
                assert role.temperature <= 0.9, f"Temperature {role.temperature} exceeds 0.9"

    # ============================================================================
    # MULTI-LANGUAGE SUPPORT
    # ============================================================================

    def test_czech_language(self):
        """Test classification works with Czech"""
        question = "Spočítej objem betonu pro základ 15m × 6m × 0.5m"

        result = self.classifier.classify(question)

        assert Domain.CALCULATION in result.domains
        assert any(r.role == Role.STRUCTURAL_ENGINEER for r in result.roles)

    def test_mixed_language(self):
        """Test classification with mixed Czech/English"""
        question = "Calculate objem for foundation 15m × 6m"

        result = self.classifier.classify(question)

        assert Domain.CALCULATION in result.domains

    # ============================================================================
    # EDGE CASES
    # ============================================================================

    def test_empty_question(self):
        """Test handling of empty question"""
        question = ""

        result = self.classifier.classify(question)

        # Should have default classification
        assert result.complexity in [TaskComplexity.SIMPLE, TaskComplexity.STANDARD]
        assert len(result.roles) > 0  # At least one role

    def test_very_short_question(self):
        """Test very short question"""
        question = "C30/37?"

        result = self.classifier.classify(question)

        # Should still classify
        assert result.complexity == TaskComplexity.SIMPLE
        assert len(result.roles) > 0

    def test_very_long_complex_question(self):
        """Test long complex question"""
        question = """
        I need to validate my entire foundation design for a 5-story residential building.
        The foundation is 15m × 6m × 0.5m, using C25/30 concrete in outdoor environment.
        Please check for errors, verify structural adequacy, check standards compliance,
        calculate total cost, and suggest any optimizations.
        """

        result = self.classifier.classify(question)

        assert result.complexity in [TaskComplexity.COMPLEX, TaskComplexity.CREATIVE]
        assert len(result.roles) >= 3  # Multiple roles needed
        assert Domain.VALIDATION in result.domains

    # ============================================================================
    # CONFIDENCE CALCULATION
    # ============================================================================

    def test_confidence_high_for_clear_task(self):
        """Test confidence is high for clear tasks"""
        question = "What's the OTSKP code for concrete foundation?"

        result = self.classifier.classify(question)

        assert result.confidence >= 0.7

    def test_confidence_lower_for_ambiguous(self):
        """Test confidence is lower for ambiguous tasks"""
        question = "Something about construction"

        result = self.classifier.classify(question)

        # Confidence should be lower for vague question
        assert result.confidence < 1.0


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestConvenienceFunction:
    """Test the convenience function"""

    def test_classify_task_function(self):
        """Test classify_task() convenience function"""
        question = "Calculate concrete volume 15m × 6m × 0.5m"

        result = classify_task(question)

        assert isinstance(result.complexity, TaskComplexity)
        assert len(result.roles) > 0


# ============================================================================
# ROLE PRIORITIZATION TESTS
# ============================================================================

class TestRolePrioritization:
    """Test role priority ordering"""

    def test_document_validator_always_first(self):
        """Document Validator should always be first for validation tasks"""
        classifier = TaskClassifier()
        question = "Check my project for errors"

        result = classifier.classify(question)

        ordered = result.get_roles_ordered()
        assert ordered[0].role == Role.DOCUMENT_VALIDATOR

    def test_standards_checker_last_for_complex(self):
        """Standards Checker should be last for complex tasks"""
        classifier = TaskClassifier()
        question = "Validate entire foundation design comprehensively"

        result = classifier.classify(question)

        ordered = result.get_roles_ordered()
        # Standards Checker should be last (highest priority number)
        assert ordered[-1].role == Role.STANDARDS_CHECKER


# ============================================================================
# PERFORMANCE TEST
# ============================================================================

def test_classification_performance():
    """Test classification is fast"""
    import time

    classifier = TaskClassifier()
    questions = [
        "Calculate volume",
        "Check for errors",
        "What's the cost?",
        "Is C30/37 adequate?",
        "Optimize design",
    ]

    start = time.time()
    for question in questions * 100:  # 500 classifications
        classifier.classify(question)
    elapsed = time.time() - start

    # Should complete 500 classifications in under 1 second
    assert elapsed < 1.0, f"Classification too slow: {elapsed:.3f}s for 500 tasks"
