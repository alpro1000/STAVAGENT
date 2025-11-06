"""Project model - tracks construction projects through workflows."""
from decimal import Decimal
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class Project(Base):
    """Construction project tracking."""

    __tablename__ = "projects"

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    workflow = Column(String(20), nullable=False)
    status = Column(String(50), nullable=False, server_default='draft', index=True)
    progress = Column(Numeric(5, 2), nullable=False, server_default='0.00')
    total_positions = Column(Integer(), nullable=False, server_default='0')
    total_cost = Column(Numeric(15, 2), nullable=True)
    issues_count_green = Column(Integer(), nullable=False, server_default='0')
    issues_count_amber = Column(Integer(), nullable=False, server_default='0')
    issues_count_red = Column(Integer(), nullable=False, server_default='0')
    project_metadata = Column("metadata", JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("workflow IN ('workflow_a', 'workflow_b')", name='check_project_workflow'),
        CheckConstraint("status IN ('draft', 'parsing', 'enriching', 'auditing', 'completed', 'error')", name='check_project_status'),
        CheckConstraint("progress >= 0 AND progress <= 100", name='check_project_progress'),
    )

    # Relationships (will be added after all models created)
    # user = relationship("User", back_populates="projects")
    # documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")
    # positions = relationship("Position", back_populates="project", cascade="all, delete-orphan")
    # audit_results = relationship("AuditResult", back_populates="project", cascade="all, delete-orphan")
    # chat_messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")
    # background_jobs = relationship("BackgroundJob", back_populates="project", cascade="all, delete-orphan")
    # budget_versions = relationship("BudgetVersion", back_populates="project", cascade="all, delete-orphan")

    def calculate_totals(self):
        """Recalculate total_cost and total_positions from positions."""
        # TODO: Implement after Position model
        pass

    def update_progress(self, new_progress: Decimal):
        """Update project progress (0-100)."""
        if 0 <= new_progress <= 100:
            self.progress = new_progress

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', status='{self.status}')>"
