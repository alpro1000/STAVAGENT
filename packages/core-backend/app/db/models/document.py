"""ProjectDocument model - uploaded files and parsing status."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class ProjectDocument(Base):
    """Uploaded project documents."""

    __tablename__ = "project_documents"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    file_size = Column(Integer(), nullable=True)
    content_hash = Column(String(64), nullable=True, index=True)
    parse_status = Column(String(50), nullable=False, server_default='pending', index=True)
    indexed_content = Column(Text(), nullable=True)  # Full-text search
    extracted_data = Column(JSONB, nullable=True)
    document_metadata = Column("metadata", JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("file_type IN ('pdf', 'xlsx', 'docx', 'xml', 'csv', 'jpg', 'png')", name='check_document_file_type'),
        CheckConstraint("parse_status IN ('pending', 'processing', 'completed', 'failed')", name='check_document_parse_status'),
    )

    # Relationships
    # project = relationship("Project", back_populates="documents")

    def __repr__(self):
        return f"<ProjectDocument(id={self.id}, filename='{self.filename}', status='{self.parse_status}')>"
