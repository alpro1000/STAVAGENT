"""UserCredential model - encrypted credential storage."""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.models.base import Base


class UserCredential(Base):
    """Encrypted user credentials for paid services."""

    __tablename__ = "user_credentials"

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    service_name = Column(String(100), nullable=False, index=True)
    credential_type = Column(String(50), nullable=False)
    encrypted_username = Column(Text(), nullable=True)
    encrypted_password = Column(Text(), nullable=True)
    encrypted_api_key = Column(Text(), nullable=True)
    scope = Column(String(20), nullable=False, server_default='personal')
    status = Column(String(20), nullable=False, server_default='active')
    monthly_query_limit = Column(Integer(), nullable=False, server_default='1000')
    monthly_queries_used = Column(Integer(), nullable=False, server_default='0')
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    encryption_key_version = Column(Integer(), nullable=False, server_default='1')

    __table_args__ = (
        CheckConstraint("scope IN ('personal', 'shared')", name='check_credential_scope'),
        CheckConstraint("status IN ('active', 'expired', 'revoked')", name='check_credential_status'),
        CheckConstraint("credential_type IN ('username_password', 'api_key', 'oauth')", name='check_credential_type'),
        UniqueConstraint('user_id', 'service_name', name='uq_user_service'),
    )

    # Relationships
    # user = relationship("User", back_populates="credentials")

    def __repr__(self):
        return f"<UserCredential(id={self.id}, service='{self.service_name}', scope='{self.scope}')>"
