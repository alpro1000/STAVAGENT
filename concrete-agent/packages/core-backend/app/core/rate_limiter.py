"""
Rate limiter for Claude API calls
Manages token limits and request throttling for batch processing
"""
import asyncio
import logging
import time
from typing import Optional, Callable, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    tokens_per_minute: int = 25000  # Safe margin from 30k TPM
    requests_per_minute: int = 20   # Safe margin from 50 RPM
    retry_after: int = 60  # Seconds to wait after rate limit hit


class TokenBucket:
    """Token bucket algorithm for rate limiting"""

    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket

        Args:
            capacity: Max tokens (tokens per minute)
            refill_rate: Tokens per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens/sec
        self.tokens = capacity
        self.last_refill = time.time()

    def consume(self, tokens: int) -> bool:
        """
        Try to consume tokens

        Returns:
            True if consumed, False if not enough tokens
        """
        self._refill()

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def wait_for(self, tokens: int) -> float:
        """
        Wait until tokens are available and consume them

        Returns:
            Time waited in seconds
        """
        start = time.time()

        while not self.consume(tokens):
            # Calculate wait time
            deficit = tokens - self.tokens
            wait_time = deficit / self.refill_rate

            logger.debug(f"Rate limit: waiting {wait_time:.1f}s for {tokens} tokens")
            time.sleep(min(wait_time, 0.1))  # Sleep in 100ms chunks

        return time.time() - start

    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill

        refill = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + refill)
        self.last_refill = now


class RateLimiter:
    """
    Rate limiter for API calls
    Prevents hitting token/request limits during batch processing
    """

    def __init__(self, config: Optional[RateLimitConfig] = None):
        """Initialize rate limiter"""
        self.config = config or RateLimitConfig()

        # Token bucket: 25000 tokens per minute = 416 tokens per second
        self.token_bucket = TokenBucket(
            capacity=self.config.tokens_per_minute,
            refill_rate=self.config.tokens_per_minute / 60
        )

        # Request bucket: 20 requests per minute = 0.33 requests per second
        self.request_bucket = TokenBucket(
            capacity=self.config.requests_per_minute,
            refill_rate=self.config.requests_per_minute / 60
        )

        self.hit_count = 0
        self.last_reset = datetime.now()

    async def check_tokens(self, estimated_tokens: int) -> bool:
        """Check if enough tokens available"""
        self.token_bucket._refill()
        return self.token_bucket.tokens >= estimated_tokens

    async def acquire(self, estimated_tokens: int = 1000) -> None:
        """
        Wait for rate limit to allow request

        Args:
            estimated_tokens: Estimated tokens for this request
        """
        # Check both token and request limits
        while True:
            if self.token_bucket.consume(estimated_tokens):
                if self.request_bucket.consume(1):
                    logger.debug(
                        f"Rate limit acquired: {estimated_tokens} tokens, "
                        f"{self.token_bucket.tokens:.0f} remaining"
                    )
                    return
                else:
                    # Request limit hit, put tokens back
                    self.token_bucket.tokens += estimated_tokens
                    await asyncio.sleep(0.1)
            else:
                # Token limit hit
                await asyncio.sleep(0.1)

    def get_status(self) -> dict:
        """Get current rate limit status"""
        self.token_bucket._refill()
        self.request_bucket._refill()

        return {
            'tokens_available': int(self.token_bucket.tokens),
            'tokens_capacity': self.token_bucket.capacity,
            'requests_available': int(self.request_bucket.tokens),
            'requests_capacity': self.request_bucket.capacity,
            'rate_limit_hits': self.hit_count,
            'reset_time': self.last_reset.isoformat()
        }

    def reset(self) -> None:
        """Reset rate limiter"""
        self.token_bucket.tokens = self.token_bucket.capacity
        self.request_bucket.tokens = self.request_bucket.capacity
        self.hit_count = 0
        self.last_reset = datetime.now()
        logger.info("Rate limiter reset")


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get or create global rate limiter"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
        logger.info("Initialized rate limiter: 25k TPM, 20 RPM")
    return _rate_limiter


def rate_limit_async(fn: Callable) -> Callable:
    """
    Decorator for async functions to add rate limiting

    Usage:
        @rate_limit_async
        async def call_claude_api(prompt):
            ...
    """
    async def wrapper(*args, estimated_tokens: int = 2000, **kwargs) -> Any:
        limiter = get_rate_limiter()
        await limiter.acquire(estimated_tokens)
        return await fn(*args, **kwargs)

    return wrapper
