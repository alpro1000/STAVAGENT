"""
GOLDEN (cost-audit task 3): the Monolit enrich cache degrades gracefully
without Redis.

Before the fallback, `await get_cache()` raising (Redis unreachable) turned
the whole enrich call into an error response (cost-audit 2026-06-10 §2.1).
After Redis retirement the in-memory fallback IS the cache — these tests
pin the contract: acquisition never raises, get/set round-trip, TTL expiry.
"""

import asyncio

import pytest

from app.integrations import monolit_adapter as ma


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_acquire_cache_falls_back_when_redis_unavailable(monkeypatch):
    async def boom():
        raise RuntimeError("simulated Redis outage")

    monkeypatch.setattr(ma, "get_cache", boom)
    cache = _run(ma._acquire_cache())
    assert cache is ma._mem_fallback_cache


def test_fallback_cache_roundtrip_and_miss():
    cache = ma._MemFallbackCache()

    async def scenario():
        assert await cache.get("monolit:enrich:121151113") is None
        await cache.set("monolit:enrich:121151113", {"match": "exact"}, ttl=3600)
        return await cache.get("monolit:enrich:121151113")

    assert _run(scenario()) == {"match": "exact"}


def test_fallback_cache_ttl_expiry(monkeypatch):
    cache = ma._MemFallbackCache()

    async def scenario():
        await cache.set("k", "v", ttl=3600)
        return await cache.get("k")

    assert _run(scenario()) == "v"

    # Rewind: pretend the entry was written >TTL ago.
    expires_at, value = cache._store["k"]
    cache._store["k"] = (expires_at - 7200, value)
    assert _run(cache.get("k")) is None
    assert "k" not in cache._store  # expired entry evicted on read


def test_fallback_cache_health_check_is_truthy():
    cache = ma._MemFallbackCache()
    health = _run(cache.health_check())
    assert health["status"] == "in_memory_fallback"
    assert bool(health)  # adapter /health treats truthy as healthy
