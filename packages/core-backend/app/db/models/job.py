"""BackgroundJob model - async task tracking."""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class BackgroundJob(Base):
    """Background job/task (Celery integration)."""

    __tablename__ = "background_jobs"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    task_name = Column(String(200), nullable=False)
    task_id = Column(String(200), nullable=True, unique=True, index=True)
    status = Column(String(50), nullable=False, server_default='pending', index=True)
    progress = Column(Numeric(5, 2), nullable=False, server_default='0.00')
    message = Column(Text(), nullable=True)
    result = Column(JSONB, nullable=True)
    error = Column(Text(), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')", name='check_job_status'),
        CheckConstraint("progress >= 0 AND progress <= 100", name='check_job_progress'),
    )

    # Relationships
    # project = relationship("Project", back_populates="background_jobs")
    # user = relationship("User", back_populates="background_jobs")

    def update_progress(self, progress: float, message: str = None):
        """Update job progress."""
        if 0 <= progress <= 100:
            self.progress = progress
        if message:
            self.message = message

    def __repr__(self):
        return f"<BackgroundJob(id={self.id}, task='{self.task_name}', status='{self.status}')>"
