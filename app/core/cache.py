"""
Caching layer using Redis for Phase 4 Backend Infrastructure.

Provides:
- General-purpose caching with TTL
- Knowledge base query result caching
- API response caching
- Cache invalidation
- Cache statistics
"""
import logging
import hashlib
import json
from typing import Any, Callable, Optional, Union
from functools import wraps

from app.core.redis_client import RedisClient, get_redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheManager:
    """
    General-purpose cache manager using Redis.

    Supports:
    - Simple key-value caching
    - Automatic TTL management
    - Cache namespacing
    - Cache statistics
    - Decorator for function result caching

    Example:
        cache = CacheManager(namespace="kb_queries")

        # Cache a value
        await cache.set("query_123", result_data, ttl=300)

        # Get cached value
        result = await cache.get("query_123")

        # Cache decorator
        @cache.cached(ttl=60)
        async def expensive_query(query: str):
            return perform_search(query)
    """

    def __init__(
        self,
        namespace: str = "cache",
        redis_client: Optional[RedisClient] = None,
        default_ttl: Optional[int] = None
    ):
        """
        Initialize cache manager.

        Args:
            namespace: Cache namespace for key prefixing
            redis_client: Redis client instance (optional)
            default_ttl: Default TTL in seconds (from settings if not provided)
        """
        self.namespace = namespace
        self.redis_client = redis_client
        self.default_ttl = default_ttl or settings.CACHE_TTL
        self.key_prefix = f"cache:{namespace}:"

    async def _get_redis(self) -> RedisClient:
        """Get Redis client (lazy initialization)."""
        if self.redis_client is None:
            self.redis_client = await get_redis()
        return self.redis_client

    def _make_cache_key(self, key: str) -> str:
        """
        Create Redis key for cache entry.

        Args:
            key: Cache key

        Returns:
            Prefixed key (e.g., "cache:kb_queries:abc-123")
        """
        return f"{self.key_prefix}{key}"

    def _hash_args(self, *args, **kwargs) -> str:
        """
        Create hash from function arguments for cache key.

        Args:
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            MD5 hash string
        """
        # Create stable string representation
        key_parts = [str(arg) for arg in args]
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        key_str = ":".join(key_parts)

        # Hash it
        return hashlib.md5(key_str.encode()).hexdigest()

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired

        Example:
            result = await cache.get("query_123")
            if result is None:
                result = perform_expensive_query()
                await cache.set("query_123", result)
        """
        redis = await self._get_redis()

        cache_key = self._make_cache_key(key)
        value = await redis.get(cache_key)

        if value is None:
            logger.debug(f"Cache MISS: {self.namespace}:{key}")
            return None

        logger.debug(f"Cache HIT: {self.namespace}:{key}")
        return value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache (will be JSON-serialized)
            ttl: TTL in seconds (default from settings)

        Returns:
            True if successful

        Example:
            await cache.set("query_123", {"results": [...]}, ttl=300)
        """
        redis = await self._get_redis()

        cache_key = self._make_cache_key(key)
        ttl = ttl or self.default_ttl

        result = await redis.set(cache_key, value, ttl=ttl)

        logger.debug(f"Cache SET: {self.namespace}:{key} (TTL: {ttl}s)")

        return result

    async def delete(self, key: str) -> bool:
        """
        Delete cache entry.

        Args:
            key: Cache key

        Returns:
            True if deleted, False if not found

        Example:
            # Invalidate cache after update
            await cache.delete("query_123")
        """
        redis = await self._get_redis()

        cache_key = self._make_cache_key(key)
        result = await redis.delete(cache_key)

        if result:
            logger.debug(f"Cache DELETE: {self.namespace}:{key}")
        else:
            logger.debug(f"Cache DELETE failed (not found): {self.namespace}:{key}")

        return result

    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if exists, False otherwise
        """
        redis = await self._get_redis()

        cache_key = self._make_cache_key(key)
        return await redis.exists(cache_key)

    async def clear(self) -> int:
        """
        Clear all cache entries in this namespace.

        WARNING: Uses KEYS command - use with caution in production.

        Returns:
            Number of entries deleted

        Example:
            # Clear all KB query cache
            await kb_cache.clear()
        """
        redis = await self._get_redis()

        # Delete all keys in namespace
        pattern = f"{self.key_prefix}*"
        count = await redis.delete_pattern(pattern)

        logger.info(f"✅ Cleared {count} cache entries in namespace '{self.namespace}'")

        return count

    async def get_stats(self) -> dict:
        """
        Get cache statistics for this namespace.

        Returns:
            Dict with cache stats (entry_count, namespace)

        Example:
            stats = await cache.get_stats()
            print(f"Cache has {stats['entry_count']} entries")
        """
        redis = await self._get_redis()

        # Count keys in namespace
        pattern = f"{self.key_prefix}*"
        keys = await redis.keys(pattern)

        return {
            "namespace": self.namespace,
            "entry_count": len(keys),
            "default_ttl": self.default_ttl
        }

    def cached(
        self,
        ttl: Optional[int] = None,
        key_prefix: Optional[str] = None
    ):
        """
        Decorator for caching function results.

        Args:
            ttl: Cache TTL in seconds (default from cache manager)
            key_prefix: Custom key prefix (default: function name)

        Returns:
            Decorated function

        Example:
            @cache.cached(ttl=300)
            async def search_knowledge_base(query: str):
                return expensive_search(query)

            # First call - executes function and caches result
            result1 = await search_knowledge_base("concrete C30/37")

            # Second call - returns cached result
            result2 = await search_knowledge_base("concrete C30/37")
        """
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key from function name and arguments
                func_name = key_prefix or func.__name__
                args_hash = self._hash_args(*args, **kwargs)
                cache_key = f"{func_name}:{args_hash}"

                # Try to get from cache
                cached_result = await self.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Returning cached result for {func_name}")
                    return cached_result

                # Execute function
                logger.debug(f"Executing {func_name} (cache miss)")
                result = await func(*args, **kwargs)

                # Cache result
                await self.set(cache_key, result, ttl=ttl)

                return result

            return wrapper
        return decorator


class KnowledgeBaseCache(CacheManager):
    """
    Specialized cache for knowledge base queries.

    Extends CacheManager with KB-specific features:
    - KROS code lookup caching
    - RTS price caching
    - ČSN standard caching
    - Company rules caching

    Example:
        kb_cache = KnowledgeBaseCache()

        # Cache KROS code lookup
        await kb_cache.cache_kros_lookup("121151113", kros_data)

        # Get cached lookup
        data = await kb_cache.get_kros_lookup("121151113")
    """

    def __init__(self, redis_client: Optional[RedisClient] = None):
        """Initialize KB cache with namespace 'kb'."""
        super().__init__(
            namespace="kb",
            redis_client=redis_client,
            default_ttl=settings.CACHE_TTL
        )

    async def cache_kros_lookup(
        self,
        code: str,
        data: dict,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache KROS code lookup result.

        Args:
            code: KROS code (e.g., "121151113")
            data: KROS data dict
            ttl: TTL in seconds (default 5 minutes)

        Returns:
            True if successful
        """
        key = f"kros:{code}"
        return await self.set(key, data, ttl=ttl or 300)

    async def get_kros_lookup(self, code: str) -> Optional[dict]:
        """
        Get cached KROS code lookup.

        Args:
            code: KROS code

        Returns:
            KROS data or None if not cached
        """
        key = f"kros:{code}"
        return await self.get(key)

    async def cache_rts_lookup(
        self,
        code: str,
        data: dict,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache RTS code lookup result.

        Args:
            code: RTS code
            data: RTS data dict
            ttl: TTL in seconds (default 5 minutes)

        Returns:
            True if successful
        """
        key = f"rts:{code}"
        return await self.set(key, data, ttl=ttl or 300)

    async def get_rts_lookup(self, code: str) -> Optional[dict]:
        """
        Get cached RTS code lookup.

        Args:
            code: RTS code

        Returns:
            RTS data or None if not cached
        """
        key = f"rts:{code}"
        return await self.get(key)

    async def cache_perplexity_query(
        self,
        query: str,
        result: dict,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache Perplexity API query result.

        Args:
            query: Search query
            result: API result
            ttl: TTL in seconds (default 24 hours from settings)

        Returns:
            True if successful
        """
        # Hash query for key
        query_hash = hashlib.md5(query.encode()).hexdigest()
        key = f"perplexity:{query_hash}"

        ttl = ttl or settings.PERPLEXITY_CACHE_TTL

        return await self.set(key, result, ttl=ttl)

    async def get_perplexity_query(self, query: str) -> Optional[dict]:
        """
        Get cached Perplexity query result.

        Args:
            query: Search query

        Returns:
            Cached result or None
        """
        query_hash = hashlib.md5(query.encode()).hexdigest()
        key = f"perplexity:{query_hash}"

        return await self.get(key)


# Global cache instances
_general_cache: Optional[CacheManager] = None
_kb_cache: Optional[KnowledgeBaseCache] = None


async def get_cache(namespace: str = "general") -> CacheManager:
    """
    Get general-purpose cache manager.

    Args:
        namespace: Cache namespace

    Returns:
        CacheManager instance

    Example:
        cache = await get_cache("api_responses")
        await cache.set("endpoint_123", response_data)
    """
    global _general_cache

    if _general_cache is None or _general_cache.namespace != namespace:
        _general_cache = CacheManager(namespace=namespace)

    return _general_cache


async def get_kb_cache() -> KnowledgeBaseCache:
    """
    Get knowledge base cache instance.

    Returns:
        KnowledgeBaseCache instance

    Example:
        kb_cache = await get_kb_cache()
        await kb_cache.cache_kros_lookup("121151113", data)
    """
    global _kb_cache

    if _kb_cache is None:
        _kb_cache = KnowledgeBaseCache()

    return _kb_cache
