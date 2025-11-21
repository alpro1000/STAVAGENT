import asyncio
"""
Test workflow_a integration with routes
Validates the fix for ImportError and method signature
"""
import pytest
from unittest.mock import AsyncMock, patch


def test_workflow_a_import():
    """Test that workflow_a instance can be imported"""
    from app.services.workflow_a import workflow_a
    
    assert workflow_a is not None
    assert hasattr(workflow_a, 'run')
    print("✅ workflow_a instance imported successfully")


def test_workflow_a_method_signature():
    """Test that run() method has correct signature"""
    import inspect
    from app.services.workflow_a import workflow_a
    
    sig = inspect.signature(workflow_a.run)
    params = list(sig.parameters.keys())
    
    assert 'project_id' in params
    assert 'action' in params
    
    param_project_id = sig.parameters['project_id']
    param_action = sig.parameters['action']
    param_kwargs = sig.parameters['kwargs']
    
    def _normalize(annotation):
        return str if annotation == 'str' else annotation

    assert _normalize(param_project_id.annotation) is str
    assert _normalize(param_action.annotation) is str
    assert param_action.default == 'execute'
    assert param_kwargs.kind == inspect.Parameter.VAR_KEYWORD
    
    print("✅ run() method signature is correct")
    print(f"   Signature: {sig}")


def test_workflow_a_routes_import():
    """Test that routes.py can import workflow_a"""
    try:
        from app.api.routes_workflow_a import workflow_a
        assert workflow_a is not None
        print("✅ workflow_a imported in routes_workflow_a.py")
    except ImportError as e:
        pytest.fail(f"Failed to import workflow_a in routes_workflow_a: {e}")


def test_workflow_a_run_with_invalid_project():
    """Test that run() raises error for invalid project_id"""
    from app.services.workflow_a import workflow_a

    async def _invoke() -> None:
        await workflow_a.run(project_id="nonexistent-id")

    workflow_a._workflows.clear()
    with pytest.raises(ValueError, match="not found in store"):
        asyncio.run(_invoke())
    workflow_a._workflows.clear()

    print("✅ run() correctly raises error for invalid project")


def test_workflow_a_run_with_mock_project():
    """Test that run() forwards calls to WorkflowA.execute"""
    from app.services.workflow_a import workflow_a, WorkflowA

    test_project_id = "test-project-123"

    async def _invoke():
        return await workflow_a.run(
            project_id=test_project_id,
            action="tech_card",
            extra_option=True,
        )

    workflow_a._workflows.clear()
    with patch.object(WorkflowA, 'execute', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = {"success": True, "artifact": "tech_card"}
        result = asyncio.run(_invoke())

    assert result == {"success": True, "artifact": "tech_card"}
    mock_execute.assert_awaited_once_with(
        project_id=test_project_id,
        action="tech_card",
        extra_option=True,
    )
    workflow_a._workflows.clear()

    print("✅ run() executed via WorkflowA.execute with forwarded kwargs")



if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
