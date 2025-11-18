"""
Base models and mixins for SQLAlchemy ORM.

Phase 4 - Backend Infrastructure
Day 3: SQLAlchemy Models

This module provides:
- UUIDMixin: UUID primary key generation
- TimestampMixin: Automatic created_at/updated_at timestamps
- Base: Declarative base for all models
"""
from datetime import datetime
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import declarative_base


# ================================================================
# MIXINS
# ================================================================

class UUIDMixin:
    """
    Mixin to add UUID primary key with server-side generation.

    Uses PostgreSQL's gen_random_uuid() for UUID generation.
    """

    @declared_attr
    def id(cls):
        """UUID primary key."""
        return Column(
            PostgreSQLUUID(as_uuid=True),
            primary_key=True,
            server_default=func.gen_random_uuid(),
            comment="Primary key (UUID)"
        )


class TimestampMixin:
    """
    Mixin to add created_at and updated_at timestamp columns.

    Automatically sets timestamps on creation and updates.
    """

    @declared_attr
    def created_at(cls):
        """Timestamp when record was created."""
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            comment="Record creation timestamp"
        )

    @declared_attr
    def updated_at(cls):
        """Timestamp when record was last updated."""
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
            comment="Record last update timestamp"
        )


# ================================================================
# BASE MODEL
# ================================================================

# Create declarative base
BaseModel = declarative_base()


class Base(BaseModel, UUIDMixin, TimestampMixin):
    """
    Base model for all database models.

    Includes:
    - UUID primary key (id)
    - Timestamps (created_at, updated_at)
    - Common utility methods

    Example:
        class User(Base):
            __tablename__ = "users"
            email = Column(String(255), nullable=False)
    """

    __abstract__ = True  # This is an abstract base class

    def to_dict(self, exclude: list = None) -> Dict[str, Any]:
        """
        Convert model instance to dictionary.

        Args:
            exclude: List of column names to exclude from result

        Returns:
            Dictionary representation of model

        Example:
            user = User(email="test@example.com")
            user_dict = user.to_dict(exclude=['password_hash'])
        """
        exclude = exclude or []
        result = {}

        for column in self.__table__.columns:
            if column.name not in exclude:
                value = getattr(self, column.name)

                # Handle special types
                if isinstance(value, UUID):
                    value = str(value)
                elif isinstance(value, datetime):
                    value = value.isoformat()

                result[column.name] = value

        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Base":
        """
        Create model instance from dictionary.

        Args:
            data: Dictionary with column values

        Returns:
            Model instance

        Example:
            user = User.from_dict({
                'email': 'test@example.com',
                'role': 'user'
            })
        """
        # Filter data to only include valid columns
        valid_columns = {col.name for col in cls.__table__.columns}
        filtered_data = {
            key: value
            for key, value in data.items()
            if key in valid_columns
        }

        return cls(**filtered_data)

    def __repr__(self) -> str:
        """String representation of model."""
        return f"<{self.__class__.__name__}(id={self.id})>"
