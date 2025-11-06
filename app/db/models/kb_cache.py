"""KnowledgeBaseCache model - query result caching."""
from sqlalchemy import CheckConstraint, Column, DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.db.models.base import Base


class KnowledgeBaseCache(Base):
    """Cached knowledge base query results."""

    __tablename__ = "knowledge_base_cache"

    query_hash = Column(String(64), nullable=False, unique=True, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    query = Column(Text(), nullable=False)
    result = Column(JSONB, nullable=False)
    source = Column(String(50), nullable=False)
    confidence = Column(Numeric(5, 2), nullable=True)
    cost = Column(Numeric(10, 4), nullable=False, server_default='0.0')
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        CheckConstraint("task_type IN ('static_lookup', 'current_price', 'equipment_spec', 'document_qa', 'standard_text', 'best_practice', 'validation')", name='check_kb_cache_task_type'),
        CheckConstraint("source IN ('local_kb', 'perplexity', 'claude', 'urs', 'cenovamapa', 'csn_online')", name='check_kb_cache_source'),
    )

    def is_expired(self) -> bool:
        """Check if cache entry is expired."""
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) > self.expires_at

    def __repr__(self):
        return f"<KnowledgeBaseCache(id={self.id}, task_type='{self.task_type}', source='{self.source}')>"
