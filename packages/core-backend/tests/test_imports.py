"""
Import validation tests for CI/CD pipeline
Tests that all critical modules can be imported
"""
import pytest
import sys
from pathlib import Path


def test_config_import():
    """Test that config module imports successfully"""
    try:
        from app.core.config import settings
        assert settings is not None
        assert settings.BASE_DIR is not None
        print(f"✅ Config imported: BASE_DIR={settings.BASE_DIR}")
    except Exception as e:
        pytest.fail(f"Failed to import config: {e}")


def test_config_paths():
    """Test that config paths are properly initialized"""
    from app.core.config import settings
    
    assert settings.DATA_DIR is not None, "DATA_DIR should not be None"
    assert settings.KB_DIR is not None, "KB_DIR should not be None"
    assert settings.PROMPTS_DIR is not None, "PROMPTS_DIR should not be None"
    assert settings.LOGS_DIR is not None, "LOGS_DIR should not be None"
    assert settings.WEB_DIR is not None, "WEB_DIR should not be None"
    
    print(f"✅ All config paths initialized:")
    print(f"   DATA_DIR: {settings.DATA_DIR}")
    print(f"   KB_DIR: {settings.KB_DIR}")
    print(f"   PROMPTS_DIR: {settings.PROMPTS_DIR}")
    print(f"   LOGS_DIR: {settings.LOGS_DIR}")
    print(f"   WEB_DIR: {settings.WEB_DIR}")


def test_fastapi_app_import():
    """Test that FastAPI app imports successfully"""
    try:
        from app.main import app
        assert app is not None
        assert hasattr(app, 'routes')
        print(f"✅ FastAPI app imported successfully")
        print(f"   Routes: {len(app.routes)}")
    except Exception as e:
        pytest.fail(f"Failed to import FastAPI app: {e}")


def test_multi_role_config():
    """Test that multi-role configuration is accessible"""
    from app.core.config import settings
    
    assert hasattr(settings, 'multi_role')
    assert settings.multi_role.enabled is not None
    
    print(f"✅ Multi-role config accessible:")
    print(f"   Enabled: {settings.multi_role.enabled}")
    print(f"   Green roles: {settings.multi_role.green_roles}")
    print(f"   HITL on red: {settings.multi_role.hitl_on_red}")


def test_feature_flags():
    """Test that feature flags are properly set"""
    from app.core.config import settings
    
    # Check that feature flags exist and are boolean
    assert isinstance(settings.ENABLE_WORKFLOW_A, bool)
    assert isinstance(settings.ENABLE_WORKFLOW_B, bool)
    assert isinstance(settings.ENABLE_KROS_MATCHING, bool)
    assert isinstance(settings.ENABLE_RTS_MATCHING, bool)
    
    print(f"✅ Feature flags validated:")
    print(f"   Workflow A: {settings.ENABLE_WORKFLOW_A}")
    print(f"   Workflow B: {settings.ENABLE_WORKFLOW_B}")
    print(f"   KROS matching: {settings.ENABLE_KROS_MATCHING}")
    print(f"   RTS matching: {settings.ENABLE_RTS_MATCHING}")


def test_environment_detection():
    """Test that environment is properly detected"""
    from app.core.config import settings
    
    assert settings.ENVIRONMENT in ['development', 'staging', 'production']
    
    # Test helper properties
    is_dev = settings.is_development
    is_prod = settings.is_production
    
    assert isinstance(is_dev, bool)
    assert isinstance(is_prod, bool)
    assert not (is_dev and is_prod)  # Can't be both
    
    print(f"✅ Environment detected: {settings.ENVIRONMENT}")
    print(f"   Is development: {is_dev}")
    print(f"   Is production: {is_prod}")


if __name__ == "__main__":
    # Run tests when called directly
    pytest.main([__file__, "-v", "--tb=short"])
