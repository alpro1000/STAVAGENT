"""BudgetVersion model - Git-like version control for budgets."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class BudgetVersion(Base):
    """Budget version snapshot (Git-like)."""

    __tablename__ = "budget_versions"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    version = Column(Integer(), nullable=False)
    trigger_type = Column(String(50), nullable=False)
    changes = Column(JSONB, nullable=True)
    delta_cost = Column(Numeric(15, 2), nullable=True)
    snapshot = Column(JSONB, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    __table_args__ = (
        CheckConstraint("trigger_type IN ('initial_generation', 'document_added', 'user_edit', 'chat_modification', 'enrichment_update')", name='check_version_trigger_type'),
        UniqueConstraint('project_id', 'version', name='uq_project_version'),
    )

    # Relationships
    # project = relationship("Project", back_populates="budget_versions")
    # created_by_user = relationship("User", back_populates="budget_versions")

    def __repr__(self):
        return f"<BudgetVersion(id={self.id}, project_id={self.project_id}, version={self.version})>"
