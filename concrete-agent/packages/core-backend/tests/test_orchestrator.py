"""
Tests for Multi-Role Orchestrator

Run with: pytest tests/test_orchestrator.py -v
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from app.services.orchestrator import (
    MultiRoleOrchestrator,
    RoleOutput,
    Conflict,
    ConflictType,
    FinalOutput,
    execute_multi_role,
)
from app.services.task_classifier import (
    TaskClassification,
    TaskComplexity,
    Domain,
    Role,
    RoleInvocation,
)


class TestOrchestratorDataStructures:
    """Test data structures"""

    def test_role_output_creation(self):
        """Test RoleOutput dataclass"""
        output = RoleOutput(
            role=Role.STRUCTURAL_ENGINEER,
            content="Test output",
            temperature_used=0.3,
            tokens_used=150,
            timestamp=datetime.now(),
            confidence=0.95,
            warnings=["Warning 1"],
            critical_issues=["Critical 1"],
        )

        assert output.role == Role.STRUCTURAL_ENGINEER
        assert output.content == "Test output"
        assert output.confidence == 0.95
        assert len(output.warnings) == 1
        assert len(output.critical_issues) == 1

    def test_conflict_creation(self):
        """Test Conflict dataclass"""
        conflict = Conflict(
            conflict_type=ConflictType.CONCRETE_CLASS,
            roles_involved=[Role.STRUCTURAL_ENGINEER, Role.CONCRETE_SPECIALIST],
            descriptions=["C25/30", "C30/37"],
            resolution="C30/37 selected (stricter requirement)",
            winner=Role.CONCRETE_SPECIALIST,
        )

        assert conflict.conflict_type == ConflictType.CONCRETE_CLASS
        assert len(conflict.roles_involved) == 2
        assert conflict.winner == Role.CONCRETE_SPECIALIST

    def test_final_output_status(self):
        """Test FinalOutput status methods"""
        # No issues
        output1 = FinalOutput(
            answer="Test",
            complexity=TaskComplexity.SIMPLE,
            roles_consulted=[Role.COST_ESTIMATOR],
            conflicts=[],
            warnings=[],
            critical_issues=[],
            total_tokens=100,
            execution_time_seconds=1.5,
            confidence=0.9,
        )

        assert output1.get_status() == "✅ OK"
        assert not output1.has_critical_issues()

        # With warnings
        output2 = FinalOutput(
            answer="Test",
            complexity=TaskComplexity.SIMPLE,
            roles_consulted=[Role.COST_ESTIMATOR],
            conflicts=[],
            warnings=["Warning 1"],
            critical_issues=[],
            total_tokens=100,
            execution_time_seconds=1.5,
            confidence=0.9,
        )

        assert output2.get_status() == "⚠️ WARNINGS"

        # With critical issues
        output3 = FinalOutput(
            answer="Test",
            complexity=TaskComplexity.SIMPLE,
            roles_consulted=[Role.COST_ESTIMATOR],
            conflicts=[],
            warnings=[],
            critical_issues=["Critical issue"],
            total_tokens=100,
            execution_time_seconds=1.5,
            confidence=0.9,
        )

        assert output3.get_status() == "❌ CRITICAL ISSUES FOUND"
        assert output3.has_critical_issues()


class TestOrchestratorLoading:
    """Test loading prompts and initialization"""

    def test_orchestrator_initialization(self):
        """Test orchestrator initializes correctly"""
        orchestrator = MultiRoleOrchestrator()

        assert orchestrator.prompts_dir.exists()
        assert orchestrator.role_outputs == []
        assert orchestrator.conflicts == []

    def test_load_role_prompt(self):
        """Test loading role prompts from files"""
        orchestrator = MultiRoleOrchestrator()

        # Load structural engineer prompt
        prompt = orchestrator._load_role_prompt(Role.STRUCTURAL_ENGINEER)

        assert len(prompt) > 100
        assert "ROLE:" in prompt or "Senior Structural Engineer" in prompt

    def test_load_nonexistent_prompt_raises_error(self):
        """Test loading nonexistent prompt raises error"""
        orchestrator = MultiRoleOrchestrator()

        # Create a fake role enum that doesn't have a file
        fake_role = Mock()
        fake_role.value = "nonexistent_role"

        with pytest.raises(FileNotFoundError):
            orchestrator._load_role_prompt(fake_role)


class TestContextBuilding:
    """Test building context from previous roles"""

    def test_build_context_empty(self):
        """Test building context with no previous roles"""
        orchestrator = MultiRoleOrchestrator()

        context = orchestrator._build_context_from_previous_roles(Role.STRUCTURAL_ENGINEER)

        assert context == ""

    def test_build_context_with_previous_roles(self):
        """Test building context with previous roles"""
        orchestrator = MultiRoleOrchestrator()

        # Add mock previous outputs
        orchestrator.role_outputs = [
            RoleOutput(
                role=Role.DOCUMENT_VALIDATOR,
                content="No errors found",
                temperature_used=0.2,
                tokens_used=50,
                timestamp=datetime.now(),
            ),
            RoleOutput(
                role=Role.STRUCTURAL_ENGINEER,
                content="C30/37 required",
                temperature_used=0.3,
                tokens_used=100,
                timestamp=datetime.now(),
            ),
        ]

        context = orchestrator._build_context_from_previous_roles(Role.CONCRETE_SPECIALIST)

        assert "CONTEXT FROM PREVIOUS ROLES" in context
        assert "DOCUMENT VALIDATOR" in context
        assert "No errors found" in context
        assert "STRUCTURAL ENGINEER" in context
        assert "C30/37 required" in context


class TestWarningAndIssuesParsing:
    """Test parsing warnings and critical issues from outputs"""

    def test_parse_warnings(self):
        """Test parsing warnings"""
        orchestrator = MultiRoleOrchestrator()

        content = """
        ## RESULT
        Analysis complete

        ⚠️ WARNING: Borderline safety factor (1.52)

        ⚠️ WARNING: High water table detected

        All checks passed.
        """

        warnings, critical = orchestrator._parse_warnings_and_issues(content)

        assert len(warnings) == 2
        assert "Borderline safety factor" in warnings[0]
        assert "High water table" in warnings[1]
        assert len(critical) == 0

    def test_parse_critical_issues(self):
        """Test parsing critical issues"""
        orchestrator = MultiRoleOrchestrator()

        content = """
        ## RESULT

        🚨 CRITICAL: Safety factor 1.42 < minimum 1.5

        🚨 CRITICAL: Missing reinforcement specification

        Please fix these issues.
        """

        warnings, critical = orchestrator._parse_warnings_and_issues(content)

        assert len(warnings) == 0
        assert len(critical) == 2
        assert "Safety factor" in critical[0]
        assert "Missing reinforcement" in critical[1]

    def test_parse_mixed_warnings_and_critical(self):
        """Test parsing both warnings and critical"""
        orchestrator = MultiRoleOrchestrator()

        content = """
        🚨 CRITICAL: Wrong concrete class
        ⚠️ WARNING: Consider higher grade
        """

        warnings, critical = orchestrator._parse_warnings_and_issues(content)

        assert len(warnings) == 1
        assert len(critical) == 1


class TestConfidenceExtraction:
    """Test extracting confidence from outputs"""

    def test_extract_confidence_percentage(self):
        """Test extracting confidence as percentage"""
        orchestrator = MultiRoleOrchestrator()

        content = "Confidence: 95%"
        confidence = orchestrator._extract_confidence(content)

        assert confidence == 0.95

    def test_extract_confidence_decimal(self):
        """Test extracting confidence as decimal"""
        orchestrator = MultiRoleOrchestrator()

        content = "Confidence: 0.85"
        confidence = orchestrator._extract_confidence(content)

        assert confidence == 0.85

    def test_extract_confidence_none(self):
        """Test when no confidence present"""
        orchestrator = MultiRoleOrchestrator()

        content = "No confidence mentioned"
        confidence = orchestrator._extract_confidence(content)

        assert confidence is None


class TestConcreteClassExtraction:
    """Test extracting concrete class from outputs"""

    def test_extract_concrete_class(self):
        """Test extracting concrete class"""
        orchestrator = MultiRoleOrchestrator()

        content = "Required concrete class: C30/37 for this structure"
        concrete_class = orchestrator._extract_concrete_class(content)

        assert concrete_class == "C30/37"

    def test_extract_concrete_class_multiple(self):
        """Test extracting first concrete class when multiple present"""
        orchestrator = MultiRoleOrchestrator()

        content = "C25/30 is minimum, but C30/37 recommended"
        concrete_class = orchestrator._extract_concrete_class(content)

        assert concrete_class == "C25/30"  # Returns first match

    def test_extract_concrete_class_none(self):
        """Test when no concrete class present"""
        orchestrator = MultiRoleOrchestrator()

        content = "No concrete class mentioned"
        concrete_class = orchestrator._extract_concrete_class(content)

        assert concrete_class is None


class TestConflictResolution:
    """Test conflict detection and resolution"""

    def test_resolve_concrete_class_conflict_stricter_wins(self):
        """Test stricter concrete class wins"""
        orchestrator = MultiRoleOrchestrator()

        winner, resolution = orchestrator._resolve_concrete_class_conflict(
            "C25/30",
            "C30/37",
            Role.STRUCTURAL_ENGINEER,
            Role.CONCRETE_SPECIALIST
        )

        assert winner == Role.CONCRETE_SPECIALIST
        assert "Stricter requirement wins" in resolution
        assert "C30/37 > C25/30" in resolution

    def test_resolve_concrete_class_conflict_standards_checker_wins(self):
        """Test Standards Checker always wins"""
        orchestrator = MultiRoleOrchestrator()

        winner, resolution = orchestrator._resolve_concrete_class_conflict(
            "C30/37",
            "C25/30",  # Lower class
            Role.STRUCTURAL_ENGINEER,
            Role.STANDARDS_CHECKER  # But Standards Checker says C25/30
        )

        # Standards Checker wins even with lower class (they have final authority)
        assert winner == Role.STANDARDS_CHECKER
        assert "Standards Checker has final authority" in resolution

    def test_detect_conflict_between_roles(self):
        """Test detecting conflict between roles"""
        orchestrator = MultiRoleOrchestrator()

        # Add outputs with different concrete classes
        orchestrator.role_outputs = [
            RoleOutput(
                role=Role.STRUCTURAL_ENGINEER,
                content="C25/30 is sufficient for load",
                temperature_used=0.3,
                tokens_used=100,
                timestamp=datetime.now(),
            ),
            RoleOutput(
                role=Role.CONCRETE_SPECIALIST,
                content="C30/37 required for XD2 exposure",
                temperature_used=0.3,
                tokens_used=100,
                timestamp=datetime.now(),
            ),
        ]

        orchestrator._detect_and_resolve_conflicts()

        assert len(orchestrator.conflicts) == 1
        conflict = orchestrator.conflicts[0]
        assert conflict.conflict_type == ConflictType.CONCRETE_CLASS
        assert len(conflict.roles_involved) == 2


class TestPromptConstruction:
    """Test constructing prompts for roles"""

    def test_construct_prompt_basic(self):
        """Test basic prompt construction"""
        orchestrator = MultiRoleOrchestrator()

        role_prompt = "# ROLE: Test Role"
        user_question = "Test question"
        role_invocation = RoleInvocation(
            role=Role.STRUCTURAL_ENGINEER,
            temperature=0.3,
            priority=0,
        )

        prompt = orchestrator._construct_prompt(
            role_prompt=role_prompt,
            user_question=user_question,
            previous_context="",
            role_invocation=role_invocation,
            context=None,
        )

        assert "# ROLE: Test Role" in prompt
        assert "USER QUESTION" in prompt
        assert "Test question" in prompt

    def test_construct_prompt_with_context(self):
        """Test prompt construction with previous context"""
        orchestrator = MultiRoleOrchestrator()

        role_prompt = "# ROLE: Test Role"
        user_question = "Test question"
        previous_context = "Previous role said: C30/37"
        role_invocation = RoleInvocation(
            role=Role.CONCRETE_SPECIALIST,
            temperature=0.3,
            priority=1,
        )

        prompt = orchestrator._construct_prompt(
            role_prompt=role_prompt,
            user_question=user_question,
            previous_context=previous_context,
            role_invocation=role_invocation,
            context=None,
        )

        assert "Previous role said" in prompt
        assert "C30/37" in prompt


class TestExecutionMocked:
    """Test execution with mocked Claude API"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_execute_simple_task(self, mock_claude_class):
        """Test executing simple task with one role"""
        # Mock Claude API response
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": "OTSKP code: 272325"
        }
        mock_claude_class.return_value = mock_claude_instance

        orchestrator = MultiRoleOrchestrator()

        # Create simple classification
        classification = TaskClassification(
            complexity=TaskComplexity.SIMPLE,
            domains=[Domain.CODES],
            roles=[
                RoleInvocation(
                    role=Role.COST_ESTIMATOR,
                    temperature=0.1,
                    priority=0
                )
            ],
            requires_rfi=False,
            missing_data=[],
            confidence=0.9,
        )

        result = orchestrator.execute(
            user_question="What's the OTSKP code for concrete?",
            classification=classification,
        )

        assert result.answer is not None
        assert len(result.roles_consulted) == 1
        assert result.roles_consulted[0] == Role.COST_ESTIMATOR
        assert result.total_tokens > 0
        assert result.execution_time_seconds >= 0  # Can be 0 if very fast

    @patch('app.services.orchestrator.ClaudeClient')
    def test_execute_complex_task_multiple_roles(self, mock_claude_class):
        """Test executing complex task with multiple roles"""
        # Mock different responses for different roles
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = [
            {"raw_text": "No errors found"},
            {"raw_text": "C30/37 required"},
            {"raw_text": "Compliant with ČSN EN 206"},
        ]
        mock_claude_class.return_value = mock_claude_instance

        orchestrator = MultiRoleOrchestrator()

        # Create complex classification
        classification = TaskClassification(
            complexity=TaskComplexity.COMPLEX,
            domains=[Domain.VALIDATION, Domain.STANDARDS],
            roles=[
                RoleInvocation(role=Role.DOCUMENT_VALIDATOR, temperature=0.2, priority=0),
                RoleInvocation(role=Role.STRUCTURAL_ENGINEER, temperature=0.3, priority=1),
                RoleInvocation(role=Role.STANDARDS_CHECKER, temperature=0.2, priority=2),
            ],
            requires_rfi=False,
            missing_data=[],
            confidence=0.85,
        )

        result = orchestrator.execute(
            user_question="Check my foundation design",
            classification=classification,
        )

        assert len(result.roles_consulted) == 3
        assert result.total_tokens > 0  # Token estimation based on text length
        assert mock_claude_instance.call.call_count == 3


class TestConvenienceFunction:
    """Test convenience function"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_execute_multi_role_function(self, mock_claude_class):
        """Test execute_multi_role convenience function"""
        mock_claude_instance = Mock()
        mock_claude_instance.call.return_value = {
            "raw_text": "Test response"
        }
        mock_claude_class.return_value = mock_claude_instance

        classification = TaskClassification(
            complexity=TaskComplexity.SIMPLE,
            domains=[Domain.CODES],
            roles=[
                RoleInvocation(role=Role.COST_ESTIMATOR, temperature=0.1, priority=0)
            ],
            requires_rfi=False,
            missing_data=[],
            confidence=0.9,
        )

        result = execute_multi_role(
            user_question="Test question",
            classification=classification,
        )

        assert isinstance(result, FinalOutput)
        assert result.answer is not None


# ============================================================================
# INTEGRATION-STYLE TESTS (mock API but test full workflow)
# ============================================================================

class TestFullWorkflow:
    """Test full orchestration workflow"""

    @patch('app.services.orchestrator.ClaudeClient')
    def test_conflict_detection_and_resolution(self, mock_claude_class):
        """Test conflict detection between roles"""
        # Mock responses with conflicting concrete classes
        mock_claude_instance = Mock()
        mock_claude_instance.call.side_effect = [
            {"raw_text": "C25/30 is sufficient for this load"},
            {"raw_text": "C30/37 required for XD2 exposure class per ČSN EN 206"},
        ]
        mock_claude_class.return_value = mock_claude_instance

        orchestrator = MultiRoleOrchestrator()

        classification = TaskClassification(
            complexity=TaskComplexity.STANDARD,
            domains=[Domain.CALCULATION, Domain.MATERIALS],
            roles=[
                RoleInvocation(role=Role.STRUCTURAL_ENGINEER, temperature=0.3, priority=0),
                RoleInvocation(role=Role.CONCRETE_SPECIALIST, temperature=0.3, priority=1),
            ],
            requires_rfi=False,
            missing_data=[],
            confidence=0.85,
        )

        result = orchestrator.execute(
            user_question="What concrete class for 5-story building foundation?",
            classification=classification,
        )

        # Should detect conflict and resolve it
        assert len(result.conflicts) == 1
        conflict = result.conflicts[0]
        assert conflict.conflict_type == ConflictType.CONCRETE_CLASS
        assert conflict.winner == Role.CONCRETE_SPECIALIST  # Stricter wins
        assert "C30/37" in conflict.resolution
