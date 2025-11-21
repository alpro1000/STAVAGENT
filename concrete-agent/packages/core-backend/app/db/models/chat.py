"""ChatMessage model - project conversation history."""
from sqlalchemy import CheckConstraint, Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class ChatMessage(Base):
    """Chat message in project conversation."""

    __tablename__ = "chat_messages"

    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(20), nullable=False, index=True)
    content = Column(Text(), nullable=False)
    expert_type = Column(String(20), nullable=True)
    chat_metadata = Column("metadata", JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name='check_chat_role'),
        CheckConstraint("expert_type IS NULL OR expert_type IN ('SME', 'ARCH', 'ENG', 'SUP', 'ADMIN', 'PROJ')", name='check_chat_expert_type'),
    )

    # Relationships
    # project = relationship("Project", back_populates="chat_messages")

    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role='{self.role}', expert='{self.expert_type}')>"
