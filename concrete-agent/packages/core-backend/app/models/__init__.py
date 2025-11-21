"""
Models package initialization
Exports all models for easy import throughout the application
"""
from app.models.project import (
    # SQLAlchemy models
    Project,
    Base,

    # Enums
    ProjectStatus,
    AuditClassification,
    WorkflowType,

    # Pydantic API models
    ProjectCreate,
    ProjectResponse,
    ProjectStatusResponse,
    UploadedFile,
    FileMetadata,
    AuditReport,
    ErrorResponse,
    SuccessResponse,

    # Helper functions
    db_project_to_response,
    calculate_audit_summary,
)

from app.models.position import (
    Position,
    PositionAudit,
    PositionClassification,
)

try:  # Optional model
    from app.models.position import PositionAnalysis
except ImportError:  # pragma: no cover - optional dependency
    PositionAnalysis = None

__all__ = [
    # === SQLAlchemy ===
    "Project",
    "Base",
    
    # === Enums ===
    "ProjectStatus",
    "AuditClassification",
    "WorkflowType",
    
    # === Pydantic Models ===
    "ProjectCreate",
    "ProjectResponse",
    "ProjectStatusResponse",
    "UploadedFile",
    "FileMetadata",

    # === Position Models ===
    "Position",
    "PositionAudit",
    "PositionAnalysis",
    "PositionClassification",

    "AuditReport",
    "ErrorResponse",
    "SuccessResponse",
    
    # === Helper Functions ===
    "db_project_to_response",
    "calculate_audit_summary",
]
