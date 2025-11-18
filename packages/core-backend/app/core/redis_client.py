"""
Redis client wrapper for Phase 4 Backend Infrastructure.

Provides async Redis operations with:
- Connection pool management
- JSON serialization/deserialization
- Key prefix support for namespacing
- TTL management
- Pattern-based operations
"""
import json
import logging
from typing import Any, Optional, Union, List
from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """
    Async Redis client with connection pooling and JSON serialization.

    Features:
    - Async/await support
    - Connection pooling for performance
    - Automatic JSON serialization/deserialization
    - Key prefixing for namespace isolation
    - TTL support with setex() and expire()
    - Pattern-based key operations

    Example:
        redis = RedisClient()
        await redis.connect()

        # Store data
        await redis.set("user:123", {"name": "John", "email": "john@example.com"}, ttl=3600)

        # Retrieve data
        user = await redis.get("user:123")

        # Delete
        await redis.delete("user:123")

        # Pattern deletion
        await redis.delete_pattern("user:*")

        await redis.close()
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key_prefix: str = "concrete:",
        decode_responses: bool = False  # We'll handle JSON decoding manually
    ):
        """
        Initialize Redis client.

        Args:
            url: Redis URL (default from settings.REDIS_URL)
            key_prefix: Prefix for all keys (default "concrete:")
            decode_responses: Whether to decode responses (we use JSON, so False)
        """
        self.url = url or settings.REDIS_URL
        self.key_prefix = key_prefix
        self.decode_responses = decode_responses

        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[Redis] = None

        logger.info(f"RedisClient initialized with URL: {self._sanitize_url(self.url)}")

    async def connect(self) -> None:
        """
        Create connection pool and Redis client.

        Call this before using Redis operations.
        """
        if self._client is not None:
            logger.warning("Redis client already connected")
            return

        try:
            self._pool = ConnectionPool.from_url(
                self.url,
                decode_responses=self.decode_responses,
                max_connections=10,
                socket_connect_timeout=5,
                socket_timeout=5,
            )

            self._client = Redis(connection_pool=self._pool)

            # Test connection
            await self._client.ping()
            logger.info("✅ Redis connection established")

        except RedisConnectionError as e:
            logger.error(f"❌ Redis connection failed: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Unexpected error connecting to Redis: {e}")
            raise

    async def close(self) -> None:
        """
        Close Redis connection and connection pool.

        Call this when shutting down the application.
        """
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis client closed")

        if self._pool:
            await self._pool.disconnect()
            self._pool = None
            logger.info("Redis connection pool closed")

    def _make_key(self, key: str) -> str:
        """
        Add prefix to key.

        Args:
            key: Base key name

        Returns:
            Prefixed key (e.g., "concrete:user:123")
        """
        return f"{self.key_prefix}{key}"

    def _sanitize_url(self, url: str) -> str:
        """
        Remove password from URL for logging.

        Args:
            url: Redis URL

        Returns:
            Sanitized URL with password masked
        """
        if "@" in url:
            # redis://user:password@host:port -> redis://user:***@host:port
            parts = url.split("@")
            auth_parts = parts[0].split(":")
            if len(auth_parts) >= 3:  # redis://user:password
                auth_parts[-1] = "***"
                parts[0] = ":".join(auth_parts)
            return "@".join(parts)
        return url

    async def get(self, key: str, deserialize: bool = True) -> Optional[Any]:
        """
        Get value from Redis.

        Args:
            key: Key name (will be prefixed)
            deserialize: Whether to deserialize JSON (default True)

        Returns:
            Deserialized value or None if key doesn't exist

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            value = await self._client.get(prefixed_key)

            if value is None:
                return None

            if deserialize:
                return json.loads(value)

            return value.decode('utf-8') if isinstance(value, bytes) else value

        except RedisError as e:
            logger.error(f"Redis GET error for key '{key}': {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for key '{key}': {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialize: bool = True
    ) -> bool:
        """
        Set value in Redis.

        Args:
            key: Key name (will be prefixed)
            value: Value to store (will be JSON-serialized if serialize=True)
            ttl: Time-to-live in seconds (optional)
            serialize: Whether to serialize value to JSON (default True)

        Returns:
            True if successful

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)

            # Serialize value
            if serialize:
                stored_value = json.dumps(value)
            else:
                stored_value = value

            # Set with or without TTL
            if ttl:
                await self._client.setex(prefixed_key, ttl, stored_value)
            else:
                await self._client.set(prefixed_key, stored_value)

            return True

        except RedisError as e:
            logger.error(f"Redis SET error for key '{key}': {e}")
            raise
        except (TypeError, ValueError) as e:
            logger.error(f"JSON serialize error for key '{key}': {e}")
            raise

    async def delete(self, key: str) -> bool:
        """
        Delete key from Redis.

        Args:
            key: Key name (will be prefixed)

        Returns:
            True if key was deleted, False if key didn't exist

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            result = await self._client.delete(prefixed_key)
            return result > 0

        except RedisError as e:
            logger.error(f"Redis DELETE error for key '{key}': {e}")
            raise

    async def exists(self, key: str) -> bool:
        """
        Check if key exists in Redis.

        Args:
            key: Key name (will be prefixed)

        Returns:
            True if key exists, False otherwise

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            result = await self._client.exists(prefixed_key)
            return result > 0

        except RedisError as e:
            logger.error(f"Redis EXISTS error for key '{key}': {e}")
            raise

    async def expire(self, key: str, ttl: int) -> bool:
        """
        Set TTL on existing key.

        Args:
            key: Key name (will be prefixed)
            ttl: Time-to-live in seconds

        Returns:
            True if TTL was set, False if key didn't exist

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            result = await self._client.expire(prefixed_key, ttl)
            return result

        except RedisError as e:
            logger.error(f"Redis EXPIRE error for key '{key}': {e}")
            raise

    async def keys(self, pattern: str = "*") -> List[str]:
        """
        Get all keys matching pattern.

        WARNING: This is a blocking operation. Use with caution in production.

        Args:
            pattern: Key pattern (will be prefixed, e.g., "user:*")

        Returns:
            List of matching keys (without prefix)

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_pattern = self._make_key(pattern)
            keys = await self._client.keys(prefixed_pattern)

            # Remove prefix from returned keys
            prefix_len = len(self.key_prefix)
            return [
                key.decode('utf-8')[prefix_len:] if isinstance(key, bytes) else key[prefix_len:]
                for key in keys
            ]

        except RedisError as e:
            logger.error(f"Redis KEYS error for pattern '{pattern}': {e}")
            raise

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.

        WARNING: This is a blocking operation. Use with caution in production.

        Args:
            pattern: Key pattern (will be prefixed, e.g., "session:*")

        Returns:
            Number of keys deleted

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_pattern = self._make_key(pattern)
            keys = await self._client.keys(prefixed_pattern)

            if not keys:
                return 0

            # Delete all matching keys
            result = await self._client.delete(*keys)
            logger.info(f"Deleted {result} keys matching pattern '{pattern}'")
            return result

        except RedisError as e:
            logger.error(f"Redis DELETE_PATTERN error for pattern '{pattern}': {e}")
            raise

    async def incr(self, key: str, amount: int = 1) -> int:
        """
        Increment key by amount.

        Args:
            key: Key name (will be prefixed)
            amount: Amount to increment (default 1)

        Returns:
            New value after increment

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            if amount == 1:
                return await self._client.incr(prefixed_key)
            else:
                return await self._client.incrby(prefixed_key, amount)

        except RedisError as e:
            logger.error(f"Redis INCR error for key '{key}': {e}")
            raise

    async def decr(self, key: str, amount: int = 1) -> int:
        """
        Decrement key by amount.

        Args:
            key: Key name (will be prefixed)
            amount: Amount to decrement (default 1)

        Returns:
            New value after decrement

        Raises:
            RedisError: If Redis operation fails
        """
        if not self._client:
            raise RuntimeError("Redis client not connected. Call connect() first.")

        try:
            prefixed_key = self._make_key(key)
            if amount == 1:
                return await self._client.decr(prefixed_key)
            else:
                return await self._client.decrby(prefixed_key, amount)

        except RedisError as e:
            logger.error(f"Redis DECR error for key '{key}': {e}")
            raise

    async def health_check(self) -> dict:
        """
        Check Redis connection health.

        Returns:
            Dict with health status information
        """
        try:
            if not self._client:
                return {
                    "status": "disconnected",
                    "message": "Redis client not connected"
                }

            # Ping Redis
            await self._client.ping()

            # Get info
            info = await self._client.info()

            return {
                "status": "healthy",
                "redis_version": info.get("redis_version", "unknown"),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0),
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global Redis client instance
_redis_client: Optional[RedisClient] = None


async def get_redis() -> RedisClient:
    """
    Get global Redis client instance.

    Creates and connects Redis client on first call (lazy initialization).

    Returns:
        Connected RedisClient instance

    Example:
        redis = await get_redis()
        await redis.set("key", "value")
    """
    global _redis_client

    if _redis_client is None:
        _redis_client = RedisClient()
        await _redis_client.connect()

    return _redis_client


async def close_redis() -> None:
    """
    Close global Redis client.

    Call this when shutting down the application.
    """
    global _redis_client

    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
