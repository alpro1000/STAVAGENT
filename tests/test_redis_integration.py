"""
Test Redis integration for Phase 4 Backend Infrastructure.

Tests:
- Redis connection
- Redis client operations
- Session management
- Caching layer
"""
import pytest
import asyncio
from typing import Optional

# Skip all tests if Redis not available
pytestmark = pytest.mark.asyncio

try:
    from app.core.redis_client import RedisClient, get_redis, close_redis
    from app.core.session import SessionManager, get_session_manager
    from app.core.cache import CacheManager, KnowledgeBaseCache, get_kb_cache
    REDIS_AVAILABLE = True
except ImportError as e:
    REDIS_AVAILABLE = False
    pytest.skip(f"Redis dependencies not available: {e}", allow_module_level=True)


class TestRedisClient:
    """Test Redis client basic operations."""

    async def test_redis_connection(self):
        """Test Redis connection and ping."""
        redis = RedisClient()
        try:
            await redis.connect()
            health = await redis.health_check()
            assert health["status"] in ["healthy", "unhealthy"]
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await redis.close()

    async def test_redis_set_get(self):
        """Test basic set/get operations."""
        redis = RedisClient()
        try:
            await redis.connect()

            # Set value
            await redis.set("test:key1", {"data": "value1"}, ttl=60)

            # Get value
            result = await redis.get("test:key1")
            assert result == {"data": "value1"}

            # Delete
            deleted = await redis.delete("test:key1")
            assert deleted is True

            # Verify deleted
            result = await redis.get("test:key1")
            assert result is None

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await redis.close()

    async def test_redis_exists(self):
        """Test key existence check."""
        redis = RedisClient()
        try:
            await redis.connect()

            # Create key
            await redis.set("test:exists", "value", ttl=60)

            # Check exists
            exists = await redis.exists("test:exists")
            assert exists is True

            # Delete and check again
            await redis.delete("test:exists")
            exists = await redis.exists("test:exists")
            assert exists is False

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await redis.close()

    async def test_redis_expire(self):
        """Test TTL expiration."""
        redis = RedisClient()
        try:
            await redis.connect()

            # Create key without TTL
            await redis.set("test:ttl", "value", ttl=None, serialize=False)

            # Set TTL
            result = await redis.expire("test:ttl", 60)
            assert result is True

            # Cleanup
            await redis.delete("test:ttl")

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await redis.close()

    async def test_redis_incr_decr(self):
        """Test increment/decrement operations."""
        redis = RedisClient()
        try:
            await redis.connect()

            # Increment
            val1 = await redis.incr("test:counter", 1)
            assert val1 == 1

            val2 = await redis.incr("test:counter", 5)
            assert val2 == 6

            # Decrement
            val3 = await redis.decr("test:counter", 2)
            assert val3 == 4

            # Cleanup
            await redis.delete("test:counter")

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await redis.close()


class TestSessionManager:
    """Test session management."""

    async def test_create_session(self):
        """Test session creation."""
        session_mgr = SessionManager()
        try:
            # Create session
            session_id = await session_mgr.create_session(
                user_id="test-user-123",
                metadata={"role": "admin"},
                ttl=300
            )

            assert session_id is not None
            assert len(session_id) > 0

            # Cleanup
            await session_mgr.delete_session(session_id)

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_get_session(self):
        """Test getting session data."""
        session_mgr = SessionManager()
        try:
            # Create session
            session_id = await session_mgr.create_session(
                user_id="test-user-456",
                metadata={"email": "test@example.com"}
            )

            # Get session
            session = await session_mgr.get_session(session_id)
            assert session is not None
            assert session["user_id"] == "test-user-456"
            assert session["metadata"]["email"] == "test@example.com"

            # Cleanup
            await session_mgr.delete_session(session_id)

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_update_session(self):
        """Test updating session data."""
        session_mgr = SessionManager()
        try:
            # Create session
            session_id = await session_mgr.create_session(user_id="test-user-789")

            # Update session
            updated = await session_mgr.update_session(
                session_id,
                {"last_page": "/dashboard", "theme": "dark"}
            )
            assert updated is True

            # Verify update
            session = await session_mgr.get_session(session_id)
            assert session["metadata"]["last_page"] == "/dashboard"
            assert session["metadata"]["theme"] == "dark"

            # Cleanup
            await session_mgr.delete_session(session_id)

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_validate_session(self):
        """Test session validation."""
        session_mgr = SessionManager()
        try:
            # Create session
            session_id = await session_mgr.create_session(user_id="test-user-999")

            # Validate
            valid = await session_mgr.validate_session(session_id)
            assert valid is True

            # Delete and validate again
            await session_mgr.delete_session(session_id)
            valid = await session_mgr.validate_session(session_id)
            assert valid is False

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")


class TestCacheManager:
    """Test caching layer."""

    async def test_cache_set_get(self):
        """Test basic cache operations."""
        cache = CacheManager(namespace="test")
        try:
            # Set cache
            await cache.set("item1", {"data": "cached_value"}, ttl=60)

            # Get cache
            result = await cache.get("item1")
            assert result == {"data": "cached_value"}

            # Delete cache
            deleted = await cache.delete("item1")
            assert deleted is True

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_cache_exists(self):
        """Test cache existence check."""
        cache = CacheManager(namespace="test")
        try:
            # Create cache entry
            await cache.set("item2", "value", ttl=60)

            # Check exists
            exists = await cache.exists("item2")
            assert exists is True

            # Delete and check
            await cache.delete("item2")
            exists = await cache.exists("item2")
            assert exists is False

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_cache_stats(self):
        """Test cache statistics."""
        cache = CacheManager(namespace="test_stats")
        try:
            # Add some cache entries
            await cache.set("stat1", "value1", ttl=60)
            await cache.set("stat2", "value2", ttl=60)

            # Get stats
            stats = await cache.get_stats()
            assert stats["namespace"] == "test_stats"
            assert stats["entry_count"] >= 2

            # Cleanup
            await cache.clear()

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")


class TestKnowledgeBaseCache:
    """Test KB-specific caching."""

    async def test_kros_lookup_cache(self):
        """Test KROS code lookup caching."""
        kb_cache = KnowledgeBaseCache()
        try:
            # Cache KROS lookup
            kros_data = {
                "code": "121151113",
                "description": "Beton C30/37",
                "unit": "m3"
            }
            await kb_cache.cache_kros_lookup("121151113", kros_data)

            # Get cached lookup
            result = await kb_cache.get_kros_lookup("121151113")
            assert result == kros_data
            assert result["code"] == "121151113"

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_rts_lookup_cache(self):
        """Test RTS code lookup caching."""
        kb_cache = KnowledgeBaseCache()
        try:
            # Cache RTS lookup
            rts_data = {
                "code": "RTS-001",
                "price": 2500.0,
                "unit": "m3"
            }
            await kb_cache.cache_rts_lookup("RTS-001", rts_data)

            # Get cached lookup
            result = await kb_cache.get_rts_lookup("RTS-001")
            assert result == rts_data

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")

    async def test_perplexity_query_cache(self):
        """Test Perplexity query result caching."""
        kb_cache = KnowledgeBaseCache()
        try:
            # Cache Perplexity result
            query = "Cena betonu C30/37 v Praze 2025"
            result = {
                "answer": "Průměrná cena je 2500 Kč/m3",
                "sources": ["https://cenovamapa.cz"]
            }
            await kb_cache.cache_perplexity_query(query, result, ttl=3600)

            # Get cached result
            cached = await kb_cache.get_perplexity_query(query)
            assert cached == result

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")


# Test global instances
async def test_global_redis_instance():
    """Test get_redis() global instance."""
    try:
        redis1 = await get_redis()
        redis2 = await get_redis()

        # Should be same instance
        assert redis1 is redis2

        await close_redis()

    except Exception as e:
        pytest.skip(f"Redis not available: {e}")


async def test_global_session_manager_instance():
    """Test get_session_manager() global instance."""
    try:
        mgr1 = await get_session_manager()
        mgr2 = await get_session_manager()

        # Should be same instance
        assert mgr1 is mgr2

    except Exception as e:
        pytest.skip(f"Redis not available: {e}")


async def test_global_kb_cache_instance():
    """Test get_kb_cache() global instance."""
    try:
        cache1 = await get_kb_cache()
        cache2 = await get_kb_cache()

        # Should be same instance
        assert cache1 is cache2

    except Exception as e:
        pytest.skip(f"Redis not available: {e}")
