"""
User model for authentication and authorization.

Phase 4 - Backend Infrastructure
"""
from sqlalchemy import Boolean, CheckConstraint, Column, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.models.base import Base


class User(Base):
    """
    User account model.

    Attributes:
        email: User's email address (unique)
        password_hash: Hashed password (bcrypt)
        role: User role (admin, user, guest)
        status: Account status (pending, active, suspended, deleted)
        email_verified: Whether email is verified
        organization_id: Optional organization membership
        metadata: Additional user metadata (JSONB)

    Relationships:
        projects: User's projects (one-to-many)
        credentials: User's stored credentials (one-to-many)
        background_jobs: Jobs initiated by user (one-to-many)
        budget_versions: Versions created by user (one-to-many)
    """

    __tablename__ = "users"

    # ================================================================
    # COLUMNS
    # ================================================================

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="User's email address (unique)"
    )

    password_hash = Column(
        String(255),
        nullable=False,
        comment="Hashed password (bcrypt)"
    )

    role = Column(
        String(50),
        nullable=False,
        server_default='user',
        comment="User role: admin, user, guest"
    )

    status = Column(
        String(50),
        nullable=False,
        server_default='pending',
        comment="Account status: pending, active, suspended, deleted"
    )

    email_verified = Column(
        Boolean(),
        nullable=False,
        server_default='false',
        comment="Whether email is verified"
    )

    organization_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Organization ID (for shared resources)"
    )

    user_metadata = Column(
        "metadata",  # Column name in database
        JSONB,
        nullable=True,
        comment="Additional user metadata"
    )

    # ================================================================
    # CONSTRAINTS
    # ================================================================

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'user', 'guest')",
            name='check_user_role'
        ),
        CheckConstraint(
            "status IN ('pending', 'active', 'suspended', 'deleted')",
            name='check_user_status'
        ),
    )

    # ================================================================
    # RELATIONSHIPS
    # ================================================================

    # Will be added after other models are created
    # projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    # credentials = relationship("UserCredential", back_populates="user", cascade="all, delete-orphan")
    # background_jobs = relationship("BackgroundJob", back_populates="user")
    # budget_versions = relationship("BudgetVersion", back_populates="created_by_user")

    # ================================================================
    # METHODS
    # ================================================================

    def verify_password(self, password: str) -> bool:
        """
        Verify password against stored hash.

        Args:
            password: Plain text password to verify

        Returns:
            True if password matches, False otherwise

        Note:
            Requires bcrypt library (will be added in auth implementation)
        """
        # TODO: Implement with bcrypt when adding authentication
        # import bcrypt
        # return bcrypt.checkpw(password.encode(), self.password_hash.encode())
        raise NotImplementedError("Password verification not yet implemented")

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using bcrypt.

        Args:
            password: Plain text password

        Returns:
            Hashed password string

        Note:
            Requires bcrypt library (will be added in auth implementation)
        """
        # TODO: Implement with bcrypt when adding authentication
        # import bcrypt
        # return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        raise NotImplementedError("Password hashing not yet implemented")

    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role == 'admin'

    def is_active(self) -> bool:
        """Check if user account is active."""
        return self.status == 'active'

    def __repr__(self) -> str:
        """String representation."""
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
