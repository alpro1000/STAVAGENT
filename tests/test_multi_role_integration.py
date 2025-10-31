"""
Integration Tests for Multi-Role API Endpoints

Tests the complete API flow:
1. POST /api/v1/multi-role/ask - Ask question
2. POST /api/v1/multi-role/feedback - Submit feedback
3. GET /api/v1/multi-role/stats - Get statistics
4. GET /api/v1/multi-role/health - Health check

Run with: pytest tests/test_multi_role_integration.py -v
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.task_classifier import TaskComplexity, Domain, Role
from app.services.orchestrator import FinalOutput


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_classification():
    """Mock task classification"""
    from app.services.task_classifier import TaskClassification, RoleInvocation

    return TaskClassification(
        complexity=TaskComplexity.SIMPLE,
        domains=[Domain.CODES],
        roles=[
            RoleInvocation(role=Role.COST_ESTIMATOR, temperature=0.2, priority=0)
        ],
        requires_rfi=False,
        missing_data=[],
        confidence=0.9,
    )


@pytest.fixture
def mock_result():
    """Mock orchestrator result"""
    return FinalOutput(
        answer="OTSKP code for concrete foundation is 272325",
        complexity=TaskComplexity.SIMPLE,
        roles_consulted=[Role.COST_ESTIMATOR],
        conflicts=[],
        warnings=[],
        critical_issues=[],
        total_tokens=150,
        execution_time_seconds=1.5,
        confidence=0.95,
    )


class TestAskEndpoint:
    """Test /api/v1/multi-role/ask endpoint"""

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_ask_simple_question(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test asking a simple question"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "What's the OTSKP code for concrete foundation?",
                "enable_kb": True,
                "use_cache": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "272325" in data["answer"]
        assert data["complexity"] == "simple"
        assert "cost_estimator" in data["roles_consulted"]
        assert data["total_tokens"] == 150
        assert data["confidence"] == 0.95
        assert "interaction_id" in data
        assert data["from_cache"] is False

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_ask_with_kb_context(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test asking with Knowledge Base context enabled"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "What's the ČSN standard for C30/37 concrete?",
                "enable_kb": True,
                "use_cache": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["kb_context_used"] in [True, False]  # Depends on KB availability

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_ask_with_perplexity(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test asking with Perplexity search enabled"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "Latest ČSN EN 206 requirements for XD2?",
                "enable_perplexity": True,
                "use_cache": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Perplexity is placeholder for now
        assert data["perplexity_used"] is False

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_ask_with_cache(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test caching functionality"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        question = "What's the OTSKP code for concrete foundation?"

        # First request - should not be cached
        response1 = client.post(
            "/api/v1/multi-role/ask",
            json={"question": question, "use_cache": True},
        )

        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["from_cache"] is False

        # Second request - should be cached
        response2 = client.post(
            "/api/v1/multi-role/ask",
            json={"question": question, "use_cache": True},
        )

        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["from_cache"] is True

        # Answers should be identical
        assert data1["answer"] == data2["answer"]

    def test_ask_invalid_question(self, client):
        """Test validation for invalid question"""
        response = client.post(
            "/api/v1/multi-role/ask",
            json={"question": "ab"},  # Too short
        )

        assert response.status_code == 422  # Validation error

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_ask_with_conflicts(self, mock_execute, mock_classify, client, mock_classification):
        """Test response with conflicts"""
        from app.services.orchestrator import Conflict, ConflictType

        mock_classify.return_value = mock_classification

        # Create result with conflict
        result_with_conflict = FinalOutput(
            answer="C30/37 is required (conflict resolved)",
            complexity=TaskComplexity.COMPLEX,
            roles_consulted=[Role.STRUCTURAL_ENGINEER, Role.CONCRETE_SPECIALIST],
            conflicts=[
                Conflict(
                    conflict_type=ConflictType.CONCRETE_CLASS,
                    roles_involved=[Role.STRUCTURAL_ENGINEER, Role.CONCRETE_SPECIALIST],
                    descriptions=["C25/30 sufficient", "C30/37 required"],
                    resolution="C30/37 selected (stricter requirement)",
                    winner=Role.CONCRETE_SPECIALIST,
                )
            ],
            warnings=["Borderline safety factor"],
            critical_issues=[],
            total_tokens=500,
            execution_time_seconds=5.2,
            confidence=0.85,
        )

        mock_execute.return_value = result_with_conflict

        response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "Is C25/30 adequate for 5-story building?",
                "use_cache": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["conflicts"]) == 1
        assert data["conflicts"][0]["conflict_type"] == "concrete_class"
        assert len(data["warnings"]) == 1
        assert data["status"] == "⚠️ WARNINGS"


class TestFeedbackEndpoint:
    """Test /api/v1/multi-role/feedback endpoint"""

    def test_submit_feedback(self, client):
        """Test submitting feedback"""
        response = client.post(
            "/api/v1/multi-role/feedback",
            json={
                "interaction_id": "int_test123",
                "rating": 5,
                "helpful": True,
                "correct": True,
                "comment": "Perfect answer!",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "feedback_id" in data
        assert "Thank you" in data["message"]

    def test_submit_feedback_with_correction(self, client):
        """Test submitting feedback with correction"""
        response = client.post(
            "/api/v1/multi-role/feedback",
            json={
                "interaction_id": "int_test456",
                "rating": 3,
                "helpful": False,
                "correct": False,
                "comment": "Wrong OTSKP code",
                "correction": "Should be 272326, not 272325",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True

    def test_submit_feedback_invalid_rating(self, client):
        """Test validation for invalid rating"""
        response = client.post(
            "/api/v1/multi-role/feedback",
            json={
                "interaction_id": "int_test789",
                "rating": 10,  # Invalid: must be 1-5
                "helpful": True,
            },
        )

        assert response.status_code == 422  # Validation error


class TestStatsEndpoint:
    """Test /api/v1/multi-role/stats endpoint"""

    def test_get_stats_empty(self, client):
        """Test stats when no interactions yet"""
        response = client.get("/api/v1/multi-role/stats")

        assert response.status_code == 200
        data = response.json()

        # Stats can be 0 or contain data from other tests
        assert "total_interactions" in data
        assert "cache_size" in data

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_get_stats_with_interactions(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test stats after making some requests"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        # Make a request first
        client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "Test question for stats",
                "use_cache": False,
            },
        )

        # Get stats
        response = client.get("/api/v1/multi-role/stats")

        assert response.status_code == 200
        data = response.json()

        assert data["total_interactions"] >= 1
        assert "performance" in data
        assert "complexity_distribution" in data


class TestHealthEndpoint:
    """Test /api/v1/multi-role/health endpoint"""

    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/api/v1/multi-role/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["system"] == "multi-role-ai"
        assert "version" in data
        assert "kb_loaded" in data
        assert "cache_entries" in data
        assert "timestamp" in data


class TestEndToEndScenarios:
    """Test complete end-to-end scenarios"""

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_full_workflow_with_feedback(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test complete workflow: question → answer → feedback"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        # Step 1: Ask question
        ask_response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "What's the OTSKP code for concrete foundation?",
                "use_cache": False,
            },
        )

        assert ask_response.status_code == 200
        ask_data = ask_response.json()
        interaction_id = ask_data["interaction_id"]

        # Step 2: Submit feedback
        feedback_response = client.post(
            "/api/v1/multi-role/feedback",
            json={
                "interaction_id": interaction_id,
                "rating": 5,
                "helpful": True,
                "correct": True,
                "comment": "Excellent answer!",
            },
        )

        assert feedback_response.status_code == 200

        # Step 3: Check stats
        stats_response = client.get("/api/v1/multi-role/stats")
        assert stats_response.status_code == 200

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_czech_language_question(
        self, mock_execute, mock_classify, client, mock_classification, mock_result
    ):
        """Test question in Czech language"""
        mock_classify.return_value = mock_classification
        mock_execute.return_value = mock_result

        response = client.post(
            "/api/v1/multi-role/ask",
            json={
                "question": "Jaký je kód OTSKP pro betonování základů?",
                "use_cache": False,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True


class TestErrorHandling:
    """Test error handling"""

    @patch('app.api.routes_multi_role.classify_task')
    def test_classification_error(self, mock_classify, client):
        """Test handling of classification errors"""
        mock_classify.side_effect = Exception("Classification failed")

        response = client.post(
            "/api/v1/multi-role/ask",
            json={"question": "Test question", "use_cache": False},
        )

        assert response.status_code == 500

    @patch('app.api.routes_multi_role.classify_task')
    @patch('app.api.routes_multi_role.execute_multi_role')
    def test_orchestration_error(
        self, mock_execute, mock_classify, client, mock_classification
    ):
        """Test handling of orchestration errors"""
        mock_classify.return_value = mock_classification
        mock_execute.side_effect = Exception("Orchestration failed")

        response = client.post(
            "/api/v1/multi-role/ask",
            json={"question": "Test question", "use_cache": False},
        )

        assert response.status_code == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
