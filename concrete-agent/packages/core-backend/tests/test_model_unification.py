from typing import get_args, get_origin

"""
Tests for model unification and naming consistency
Validates that the AuditStatus → ProjectStatus refactoring is complete
"""
import pytest


def test_project_status_import():
    """Test that ProjectStatus can be imported from project module"""
    from app.models.project import ProjectStatus
    assert ProjectStatus is not None
    print("✅ ProjectStatus imported successfully")


def test_project_status_values():
    """Test that ProjectStatus has correct enum values"""
    from app.models.project import ProjectStatus
    
    expected = {
        'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED',
    }
    actual = {s.name for s in ProjectStatus}
    
    assert expected == actual, f"Expected {expected}, got {actual}"
    print(f"✅ ProjectStatus has correct values: {actual}")


def test_audit_status_not_exists():
    """Test that AuditStatus no longer exists (was renamed to ProjectStatus)"""
    from app.models import project
    
    # AuditStatus should not exist anymore
    assert not hasattr(project, 'AuditStatus'), "AuditStatus should have been renamed to ProjectStatus"
    print("✅ AuditStatus correctly removed (renamed to ProjectStatus)")


def test_project_status_export():
    """Test that ProjectStatus is exported from app.models"""
    from app.models import ProjectStatus
    assert ProjectStatus is not None
    print("✅ ProjectStatus exported from app.models")


def test_routes_import():
    """Test that routes.py can import Project and ProjectStatus"""
    # This is the exact import that was failing in routes.py:17
    from app.models.project import Project, ProjectStatus
    
    assert Project is not None
    assert ProjectStatus is not None
    print("✅ routes.py imports work correctly")


def test_no_position_duplicate_in_project():
    """Test that Position is not duplicated in project.py"""
    from app.models import project
    
    # Position should NOT be in project module
    has_position = 'Position' in [name for name in dir(project) if name[0].isupper()]
    assert not has_position, "Position should not be defined in project.py"
    print("✅ Position correctly excluded from project.py")


def test_position_in_position_module():
    """Test that Position is properly defined in position.py"""
    from app.models.position import Position
    
    assert Position is not None
    # Check it has the detailed fields
    assert hasattr(Position, '__annotations__')
    annotations = Position.__annotations__
    assert 'position_number' in annotations
    assert 'description' in annotations
    assert 'quantity' in annotations
    print("✅ Position correctly defined in position.py with detailed fields")


def test_no_project_status_response_in_position():
    """Test that ProjectStatusResponse is not duplicated in position.py"""
    from app.models import position
    
    # ProjectStatusResponse should NOT be in position module
    has_psr = hasattr(position, 'ProjectStatusResponse')
    assert not has_psr, "ProjectStatusResponse should not be in position.py"
    print("✅ ProjectStatusResponse correctly excluded from position.py")


def test_project_status_response_in_project():
    """Test that ProjectStatusResponse is properly defined in project.py"""
    from app.models.project import ProjectStatusResponse, ProjectStatus
    
    assert ProjectStatusResponse is not None
    annotations = ProjectStatusResponse.__annotations__
    assert 'status' in annotations

    status_annotation = annotations['status']
    origin = get_origin(status_annotation)
    assert origin is not None, 'status field should allow union types'
    args = set(get_args(status_annotation))
    assert ProjectStatus in args
    assert str in args
    print("✅ ProjectStatusResponse status accepts ProjectStatus enum and strings")


def test_position_classification_in_position():
    """Test that PositionClassification is in position.py"""
    from app.models.position import PositionClassification
    
    assert PositionClassification is not None
    expected = {'GREEN', 'AMBER', 'RED'}
    actual = {c.name for c in PositionClassification}
    assert expected == actual
    print(f"✅ PositionClassification correctly in position.py with values: {actual}")


def test_no_position_classification_in_project():
    """Test that PositionClassification is not duplicated in project.py"""
    from app.models import project
    
    # PositionClassification should NOT be in project module
    has_pc = 'PositionClassification' in [name for name in dir(project) if name[0].isupper()]
    assert not has_pc, "PositionClassification should not be in project.py"
    print("✅ PositionClassification correctly excluded from project.py")


def test_unified_imports():
    """Test that all models can be imported from app.models"""
    from app.models import (
        ProjectStatus,
        Position,
        PositionClassification,
        ProjectStatusResponse,
        PositionAudit,
    )
    
    assert ProjectStatus is not None
    assert Position is not None
    assert PositionClassification is not None
    assert ProjectStatusResponse is not None
    assert PositionAudit is not None
    print("✅ All models can be imported from app.models")


def test_no_naming_conflicts():
    """Test that there are no naming conflicts between modules"""
    from app.models import project, position
    
    project_exports = {
        name for name in dir(project)
        if not name.startswith('_') and name[0].isupper()
    }
    position_exports = {
        name for name in dir(position)
        if not name.startswith('_') and name[0].isupper()
    }
    
    # Remove expected imports/re-exports
    common_imports = {'BaseModel', 'Field', 'Enum', 'Optional', 'List', 'Dict', 
                      'Any', 'Column', 'Integer', 'String', 'DateTime', 'Boolean',
                      'Text', 'Float', 'SQLEnum'}
    
    conflicts = (project_exports & position_exports) - common_imports
    
    assert len(conflicts) == 0, f"Found naming conflicts: {conflicts}"
    print("✅ No naming conflicts between project.py and position.py")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
