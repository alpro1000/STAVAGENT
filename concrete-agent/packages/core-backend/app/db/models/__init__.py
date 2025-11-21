"""
SQLAlchemy ORM models for Phase 4 Backend Infrastructure.

All models inherit from Base which provides:
- UUID primary key
- Timestamps (created_at, updated_at)
- Common utility methods (to_dict, from_dict)
"""
from app.db.models.base import Base, BaseModel, UUIDMixin, TimestampMixin
from app.db.models.user import User
from app.db.models.project import Project
from app.db.models.document import ProjectDocument
from app.db.models.position import Position
from app.db.models.audit import AuditResult
from app.db.models.chat import ChatMessage
from app.db.models.job import BackgroundJob
from app.db.models.version import BudgetVersion
from app.db.models.kb_cache import KnowledgeBaseCache
from app.db.models.credential import UserCredential

__all__ = [
    # Base classes
    "Base",
    "BaseModel",
    "UUIDMixin",
    "TimestampMixin",
    # Models
    "User",
    "Project",
    "ProjectDocument",
    "Position",
    "AuditResult",
    "ChatMessage",
    "BackgroundJob",
    "BudgetVersion",
    "KnowledgeBaseCache",
    "UserCredential",
]
