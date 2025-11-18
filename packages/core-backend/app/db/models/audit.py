"""AuditResult model - AI audit outcomes."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class AuditResult(Base):
    """AI audit result for position."""

    __tablename__ = "audit_results"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey('positions.id', ondelete='CASCADE'), nullable=True, index=True)
    classification = Column(String(20), nullable=False, index=True)
    confidence = Column(Numeric(5, 2), nullable=False)
    expert_votes = Column(JSONB, nullable=True)
    issues = Column(JSONB, nullable=True)
    recommendations = Column(JSONB, nullable=True)
    audit_metadata = Column("metadata", JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("classification IN ('GREEN', 'AMBER', 'RED')", name='check_audit_classification'),
        CheckConstraint("confidence >= 0 AND confidence <= 100", name='check_audit_confidence'),
    )

    # Relationships
    # project = relationship("Project", back_populates="audit_results")
    # position = relationship("Position", back_populates="audit_result")

    def __repr__(self):
        return f"<AuditResult(id={self.id}, classification='{self.classification}', confidence={self.confidence})>"
