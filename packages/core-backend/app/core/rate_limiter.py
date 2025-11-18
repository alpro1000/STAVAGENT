"""
API Rate Limiter for Claude, GPT-4, and Nanonets
Управление лимитами API для предотвращения превышения квот
"""
import asyncio
import logging
import time
from typing import Dict, Any, Optional, Callable
from collections import deque
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class APIRateLimiter:
    """
    Rate limiting для всех AI API:
    - Claude: 30k токенов/мин (по умолчанию 25k для безопасности)
    - GPT-4: 10k токенов/мин (по умолчанию 8k для безопасности)  
    - Nanonets: 100 запросов/мин (по умолчанию 80 для безопасности)
    """
    
    def __init__(
        self,
        claude_tokens_per_min: int = 25000,
        gpt4_tokens_per_min: int = 8000,
        nanonets_calls_per_min: int = 80
    ):
        """
        Args:
            claude_tokens_per_min: Claude token limit per minute
            gpt4_tokens_per_min: GPT-4 token limit per minute
            nanonets_calls_per_min: Nanonets calls per minute
        """
        self.claude_limit = claude_tokens_per_min
        self.gpt4_limit = gpt4_tokens_per_min
        self.nanonets_limit = nanonets_calls_per_min
        
        # Track usage
        self.claude_usage = deque()  # [(timestamp, tokens), ...]
        self.gpt4_usage = deque()
        self.nanonets_usage = deque()
        
        # Locks for thread safety
        self.claude_lock = asyncio.Lock()
        self.gpt4_lock = asyncio.Lock()
        self.nanonets_lock = asyncio.Lock()
        
        logger.info(f"Rate limiter initialized: Claude={self.claude_limit} tokens/min, "
                   f"GPT-4={self.gpt4_limit} tokens/min, Nanonets={self.nanonets_limit} calls/min")
    
    async def claude_call_with_limit(
        self,
        func: Callable,
        estimated_tokens: int,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute Claude API call with rate limiting
        
        Args:
            func: Function to call (e.g., claude_client.call)
            estimated_tokens: Estimated token count for this call
            *args, **kwargs: Arguments for the function
            
        Returns:
            Function result
        """
        async with self.claude_lock:
            # Wait if necessary
            await self._wait_if_needed('claude', estimated_tokens)
            
            # Record usage
            self._record_usage('claude', estimated_tokens)
            
            # Execute call
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                logger.debug(f"Claude call executed: {estimated_tokens} tokens")
                return result
                
            except Exception as e:
                logger.error(f"Claude call failed: {e}")
                raise
    
    async def gpt4_call_with_limit(
        self,
        func: Callable,
        estimated_tokens: int,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute GPT-4 API call with rate limiting
        
        Args:
            func: Function to call
            estimated_tokens: Estimated token count
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
        """
        async with self.gpt4_lock:
            # Wait if necessary
            await self._wait_if_needed('gpt4', estimated_tokens)
            
            # Record usage
            self._record_usage('gpt4', estimated_tokens)
            
            # Execute call
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                logger.debug(f"GPT-4 call executed: {estimated_tokens} tokens")
                return result
                
            except Exception as e:
                logger.error(f"GPT-4 call failed: {e}")
                raise
    
    async def nanonets_call_with_limit(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute Nanonets API call with rate limiting
        
        Args:
            func: Function to call
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
        """
        async with self.nanonets_lock:
            # Wait if necessary (1 call = 1 unit)
            await self._wait_if_needed('nanonets', 1)
            
            # Record usage
            self._record_usage('nanonets', 1)
            
            # Execute call
            try:
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                logger.debug("Nanonets call executed")
                return result
                
            except Exception as e:
                logger.error(f"Nanonets call failed: {e}")
                raise
    
    async def batch_process_positions(
        self,
        positions: list,
        process_func: Callable,
        api_type: str = 'claude',
        tokens_per_position: int = 500
    ) -> list:
        """
        Batch process positions with rate limiting
        
        Args:
            positions: List of positions to process
            process_func: Function to process each position
            api_type: 'claude', 'gpt4', or 'nanonets'
            tokens_per_position: Estimated tokens per position
            
        Returns:
            List of processed results
        """
        logger.info(f"Batch processing {len(positions)} positions with {api_type}")
        
        results = []
        
        for idx, position in enumerate(positions, 1):
            try:
                # Select appropriate rate-limited call
                if api_type == 'claude':
                    result = await self.claude_call_with_limit(
                        process_func, 
                        tokens_per_position,
                        position
                    )
                elif api_type == 'gpt4':
                    result = await self.gpt4_call_with_limit(
                        process_func,
                        tokens_per_position,
                        position
                    )
                elif api_type == 'nanonets':
                    result = await self.nanonets_call_with_limit(
                        process_func,
                        position
                    )
                else:
                    raise ValueError(f"Unknown API type: {api_type}")
                
                results.append(result)
                
                if idx % 10 == 0:
                    logger.info(f"Processed {idx}/{len(positions)} positions")
                    
            except Exception as e:
                logger.error(f"Failed to process position {idx}: {e}")
                results.append({"error": str(e)})
        
        logger.info(f"✅ Batch processing complete: {len(results)}/{len(positions)} positions")
        return results
    
    async def _wait_if_needed(self, api_type: str, amount: int):
        """
        Wait if rate limit would be exceeded
        
        Args:
            api_type: 'claude', 'gpt4', or 'nanonets'
            amount: Tokens or calls to add
        """
        # Clean old entries
        self._clean_old_entries(api_type)
        
        # Get current usage
        current_usage = self._get_current_usage(api_type)
        limit = self._get_limit(api_type)
        
        # Check if we need to wait
        if current_usage + amount > limit:
            # Calculate wait time
            oldest_entry = self._get_oldest_entry(api_type)
            if oldest_entry:
                oldest_time = oldest_entry[0]
                time_since_oldest = time.time() - oldest_time
                wait_time = max(0, 60 - time_since_oldest)
                
                if wait_time > 0:
                    logger.warning(f"Rate limit approaching for {api_type}. "
                                 f"Current: {current_usage}/{limit}. "
                                 f"Waiting {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                    
                    # Clean again after wait
                    self._clean_old_entries(api_type)
    
    def _record_usage(self, api_type: str, amount: int):
        """Record API usage"""
        timestamp = time.time()
        
        if api_type == 'claude':
            self.claude_usage.append((timestamp, amount))
        elif api_type == 'gpt4':
            self.gpt4_usage.append((timestamp, amount))
        elif api_type == 'nanonets':
            self.nanonets_usage.append((timestamp, amount))
    
    def _clean_old_entries(self, api_type: str):
        """Remove entries older than 1 minute"""
        cutoff_time = time.time() - 60
        
        if api_type == 'claude':
            while self.claude_usage and self.claude_usage[0][0] < cutoff_time:
                self.claude_usage.popleft()
        elif api_type == 'gpt4':
            while self.gpt4_usage and self.gpt4_usage[0][0] < cutoff_time:
                self.gpt4_usage.popleft()
        elif api_type == 'nanonets':
            while self.nanonets_usage and self.nanonets_usage[0][0] < cutoff_time:
                self.nanonets_usage.popleft()
    
    def _get_current_usage(self, api_type: str) -> int:
        """Get current usage in the last minute"""
        if api_type == 'claude':
            return sum(tokens for _, tokens in self.claude_usage)
        elif api_type == 'gpt4':
            return sum(tokens for _, tokens in self.gpt4_usage)
        elif api_type == 'nanonets':
            return len(self.nanonets_usage)
        return 0
    
    def _get_limit(self, api_type: str) -> int:
        """Get rate limit for API type"""
        if api_type == 'claude':
            return self.claude_limit
        elif api_type == 'gpt4':
            return self.gpt4_limit
        elif api_type == 'nanonets':
            return self.nanonets_limit
        return 0
    
    def _get_oldest_entry(self, api_type: str) -> Optional[tuple]:
        """Get oldest entry for API type"""
        if api_type == 'claude' and self.claude_usage:
            return self.claude_usage[0]
        elif api_type == 'gpt4' and self.gpt4_usage:
            return self.gpt4_usage[0]
        elif api_type == 'nanonets' and self.nanonets_usage:
            return self.nanonets_usage[0]
        return None
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current usage statistics"""
        return {
            "claude": {
                "current": self._get_current_usage('claude'),
                "limit": self.claude_limit,
                "utilization": f"{(self._get_current_usage('claude') / self.claude_limit * 100):.1f}%"
            },
            "gpt4": {
                "current": self._get_current_usage('gpt4'),
                "limit": self.gpt4_limit,
                "utilization": f"{(self._get_current_usage('gpt4') / self.gpt4_limit * 100):.1f}%"
            },
            "nanonets": {
                "current": self._get_current_usage('nanonets'),
                "limit": self.nanonets_limit,
                "utilization": f"{(self._get_current_usage('nanonets') / self.nanonets_limit * 100):.1f}%"
            }
        }


# Global rate limiter instance
_rate_limiter: Optional[APIRateLimiter] = None


def get_rate_limiter() -> APIRateLimiter:
    """Get or create global rate limiter instance"""
    global _rate_limiter
    
    if _rate_limiter is None:
        _rate_limiter = APIRateLimiter(
            claude_tokens_per_min=getattr(settings, 'CLAUDE_TOKENS_PER_MINUTE', 25000),
            gpt4_tokens_per_min=getattr(settings, 'GPT4_TOKENS_PER_MINUTE', 8000),
            nanonets_calls_per_min=getattr(settings, 'NANONETS_CALLS_PER_MINUTE', 80)
        )
    
    return _rate_limiter
