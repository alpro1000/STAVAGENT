"""
Session management using Redis for Phase 4 Backend Infrastructure.

Provides:
- User session storage and retrieval
- Session expiration with TTL
- Session validation
- Session cleanup
"""
import logging
import uuid
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from app.core.redis_client import RedisClient, get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manage user sessions stored in Redis.

    Sessions are stored with key pattern: session:{session_id}
    Session data includes: user_id, created_at, last_accessed, metadata

    Example:
        session_mgr = SessionManager()

        # Create session
        session_id = await session_mgr.create_session(
            user_id="user-uuid",
            metadata={"role": "admin"}
        )

        # Get session
        session = await session_mgr.get_session(session_id)

        # Update session
        await session_mgr.update_session(session_id, {"last_page": "/dashboard"})

        # Delete session (logout)
        await session_mgr.delete_session(session_id)
    """

    def __init__(self, redis_client: Optional[RedisClient] = None):
        """
        Initialize session manager.

        Args:
            redis_client: Redis client instance (optional, will use global if not provided)
        """
        self.redis_client = redis_client
        self.session_ttl = settings.SESSION_TTL
        self.key_prefix = "session:"

    async def _get_redis(self) -> RedisClient:
        """Get Redis client (lazy initialization)."""
        if self.redis_client is None:
            self.redis_client = await get_redis()
        return self.redis_client

    def _make_session_key(self, session_id: str) -> str:
        """
        Create Redis key for session.

        Args:
            session_id: Session ID

        Returns:
            Redis key (e.g., "session:abc-123")
        """
        return f"{self.key_prefix}{session_id}"

    async def create_session(
        self,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> str:
        """
        Create new session.

        Args:
            user_id: User ID (UUID string)
            metadata: Additional session data (optional)
            ttl: Session TTL in seconds (default from settings)

        Returns:
            Session ID (UUID string)

        Example:
            session_id = await session_mgr.create_session(
                user_id="user-123",
                metadata={"role": "admin", "email": "admin@example.com"}
            )
        """
        redis = await self._get_redis()

        # Generate session ID
        session_id = str(uuid.uuid4())

        # Create session data
        now = datetime.utcnow().isoformat()
        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": now,
            "last_accessed": now,
            "metadata": metadata or {}
        }

        # Store in Redis
        session_key = self._make_session_key(session_id)
        ttl = ttl or self.session_ttl

        await redis.set(session_key, session_data, ttl=ttl)

        logger.info(f"✅ Session created: {session_id} for user {user_id} (TTL: {ttl}s)")

        return session_id

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session data.

        Args:
            session_id: Session ID

        Returns:
            Session data dict or None if not found/expired

        Example:
            session = await session_mgr.get_session("abc-123")
            if session:
                user_id = session["user_id"]
        """
        redis = await self._get_redis()

        session_key = self._make_session_key(session_id)
        session_data = await redis.get(session_key)

        if session_data is None:
            logger.warning(f"Session not found or expired: {session_id}")
            return None

        # Update last_accessed timestamp
        session_data["last_accessed"] = datetime.utcnow().isoformat()
        await redis.set(session_key, session_data, ttl=self.session_ttl)

        return session_data

    async def update_session(
        self,
        session_id: str,
        data: Dict[str, Any],
        extend_ttl: bool = True
    ) -> bool:
        """
        Update session data.

        Args:
            session_id: Session ID
            data: Data to merge into session
            extend_ttl: Whether to reset TTL (default True)

        Returns:
            True if successful, False if session not found

        Example:
            await session_mgr.update_session(
                "abc-123",
                {"last_page": "/dashboard", "theme": "dark"}
            )
        """
        redis = await self._get_redis()

        # Get existing session
        session_key = self._make_session_key(session_id)
        session_data = await redis.get(session_key)

        if session_data is None:
            logger.warning(f"Cannot update - session not found: {session_id}")
            return False

        # Merge data into metadata
        if "metadata" not in session_data:
            session_data["metadata"] = {}

        session_data["metadata"].update(data)
        session_data["last_accessed"] = datetime.utcnow().isoformat()

        # Save updated session
        ttl = self.session_ttl if extend_ttl else None
        await redis.set(session_key, session_data, ttl=ttl)

        logger.debug(f"Session updated: {session_id}")

        return True

    async def delete_session(self, session_id: str) -> bool:
        """
        Delete session (logout).

        Args:
            session_id: Session ID

        Returns:
            True if session was deleted, False if not found

        Example:
            # User logout
            await session_mgr.delete_session(session_id)
        """
        redis = await self._get_redis()

        session_key = self._make_session_key(session_id)
        result = await redis.delete(session_key)

        if result:
            logger.info(f"✅ Session deleted: {session_id}")
        else:
            logger.warning(f"Session not found for deletion: {session_id}")

        return result

    async def validate_session(self, session_id: str) -> bool:
        """
        Check if session exists and is valid.

        Args:
            session_id: Session ID

        Returns:
            True if valid, False otherwise

        Example:
            if await session_mgr.validate_session(session_id):
                # Session is valid, proceed
                pass
            else:
                # Session expired or invalid, redirect to login
                return {"error": "Session expired"}
        """
        redis = await self._get_redis()

        session_key = self._make_session_key(session_id)
        exists = await redis.exists(session_key)

        return exists

    async def extend_session(self, session_id: str, ttl: Optional[int] = None) -> bool:
        """
        Extend session TTL.

        Args:
            session_id: Session ID
            ttl: New TTL in seconds (default from settings)

        Returns:
            True if successful, False if session not found

        Example:
            # Extend session when user performs action
            await session_mgr.extend_session(session_id)
        """
        redis = await self._get_redis()

        session_key = self._make_session_key(session_id)
        ttl = ttl or self.session_ttl

        result = await redis.expire(session_key, ttl)

        if result:
            logger.debug(f"Session extended: {session_id} (TTL: {ttl}s)")
        else:
            logger.warning(f"Cannot extend - session not found: {session_id}")

        return result

    async def get_user_sessions(self, user_id: str) -> list[Dict[str, Any]]:
        """
        Get all sessions for a user.

        WARNING: Uses KEYS command - use with caution in production.

        Args:
            user_id: User ID

        Returns:
            List of session data dicts

        Example:
            # Get all sessions for user (e.g., for logout all devices)
            sessions = await session_mgr.get_user_sessions("user-123")
        """
        redis = await self._get_redis()

        # Get all session keys
        all_session_keys = await redis.keys(f"{self.key_prefix}*")

        user_sessions = []

        for key in all_session_keys:
            session_data = await redis.get(key)
            if session_data and session_data.get("user_id") == user_id:
                user_sessions.append(session_data)

        logger.debug(f"Found {len(user_sessions)} sessions for user {user_id}")

        return user_sessions

    async def delete_user_sessions(self, user_id: str) -> int:
        """
        Delete all sessions for a user (logout all devices).

        Args:
            user_id: User ID

        Returns:
            Number of sessions deleted

        Example:
            # Force logout all devices for user
            count = await session_mgr.delete_user_sessions("user-123")
        """
        redis = await self._get_redis()

        # Get all user sessions
        user_sessions = await self.get_user_sessions(user_id)

        # Delete each session
        deleted_count = 0
        for session in user_sessions:
            session_id = session.get("session_id")
            if session_id:
                session_key = self._make_session_key(session_id)
                if await redis.delete(session_key):
                    deleted_count += 1

        logger.info(f"✅ Deleted {deleted_count} sessions for user {user_id}")

        return deleted_count

    async def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions.

        Note: Redis automatically removes expired keys, so this is mainly
        for logging/monitoring purposes.

        Returns:
            Number of active sessions

        Example:
            # Run periodically as maintenance task
            active_count = await session_mgr.cleanup_expired_sessions()
        """
        redis = await self._get_redis()

        # Get all session keys
        all_session_keys = await redis.keys(f"{self.key_prefix}*")

        logger.info(f"Active sessions: {len(all_session_keys)}")

        return len(all_session_keys)


# Global session manager instance
_session_manager: Optional[SessionManager] = None


async def get_session_manager() -> SessionManager:
    """
    Get global session manager instance.

    Returns:
        SessionManager instance

    Example:
        session_mgr = await get_session_manager()
        session_id = await session_mgr.create_session("user-123")
    """
    global _session_manager

    if _session_manager is None:
        _session_manager = SessionManager()

    return _session_manager
