"""Position model - budget line items."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class Position(Base):
    """Budget position/line item."""

    __tablename__ = "positions"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    position_number = Column(Integer(), nullable=False)
    code = Column(String(50), nullable=True, index=True)
    description = Column(Text(), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    unit = Column(String(20), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=True)
    total_price = Column(Numeric(15, 2), nullable=True)
    enrichment_status = Column(String(50), nullable=False, server_default='pending', index=True)
    enrichment_data = Column(JSONB, nullable=True)
    position_metadata = Column("metadata", JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("enrichment_status IN ('pending', 'processing', 'matched', 'no_match', 'error')", name='check_position_enrichment_status'),
        UniqueConstraint('project_id', 'position_number', name='uq_project_position_number'),
    )

    # Relationships
    # project = relationship("Project", back_populates="positions")
    # audit_result = relationship("AuditResult", back_populates="position", uselist=False)

    def calculate_total(self):
        """Calculate total_price from quantity * unit_price."""
        if self.quantity and self.unit_price:
            self.total_price = self.quantity * self.unit_price

    def __repr__(self):
        return f"<Position(id={self.id}, code='{self.code}', qty={self.quantity})>"
