# Perplexity API Routing - Technical Specification

**Created:** 2025-11-06
**Status:** 🟡 Implementation Pending
**Priority:** ⭐⭐⭐⭐ HIGH (Cost Optimization + Quality)
**Phase:** 4 - Backend Infrastructure

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [SMART Routing Strategy](#smart-routing-strategy)
4. [Task Classification System](#task-classification-system)
5. [Routing Rules Matrix](#routing-rules-matrix)
6. [Cost Management](#cost-management)
7. [Caching Strategy](#caching-strategy)
8. [Implementation Details](#implementation-details)
9. [Monitoring & Analytics](#monitoring--analytics)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Current Problem

**Current implementation:**
```python
USE_PERPLEXITY_PRIMARY=true   # Or false - binary choice!
```

**Issues:**
- ❌ Binary decision (true/false) is too simplistic
- ❌ Either use Perplexity for EVERYTHING or NOTHING
- ❌ Wastes money on tasks local KB can handle
- ❌ Wastes time on tasks Perplexity isn't good at
- ❌ No optimization based on task type

### Our Solution: SMART Routing

**SMART = Selective, Multi-source, Adaptive, Rules-based, Threshold-driven**

```python
# Instead of binary flag, intelligent routing:
def get_knowledge_source(task_type: str, query: str) -> KnowledgeSource:
    if task_type == "KROS_CODE_LOOKUP":
        return KnowledgeSource.LOCAL_KB  # Fast, free, accurate

    elif task_type == "CURRENT_PRICE_LOOKUP":
        return KnowledgeSource.PERPLEXITY  # Up-to-date, required

    elif task_type == "EQUIPMENT_SPECS":
        # Check local KB first, fallback to Perplexity
        local_result = kb_loader.search(query)
        if local_result['confidence'] > 0.9:
            return KnowledgeSource.LOCAL_KB
        return KnowledgeSource.PERPLEXITY

    elif task_type == "DOCUMENT_QA":
        return KnowledgeSource.CLAUDE  # Never use Perplexity for docs
```

**Benefits:**
- ✅ 70% cost reduction (use Perplexity only when needed)
- ✅ Faster responses (local KB is instant)
- ✅ Higher accuracy (right tool for each task)
- ✅ Adaptive (learns from usage patterns)

---

## Problem Statement

### Current Architecture

```
User Query
    ↓
if USE_PERPLEXITY_PRIMARY == true:
    → Perplexity (ALWAYS!) 💰💰💰
else:
    → Local KB (ALWAYS!)
```

### Real-World Issues

**Example 1: KROS Code Lookup**
```
Query: "Beton C25/30 classification code"
Current: Sends to Perplexity ($0.005) 💰
Optimal: Local KB has exact match (FREE, faster) ✅
```

**Example 2: Current Equipment Prices**
```
Query: "Current price for HILTI TE 500-AVR 2024"
Current: If false, checks old local data ❌
Optimal: Must use Perplexity for current prices ✅
```

**Example 3: Document Q&A**
```
Query: "What concrete grade is specified in TechSpec.pdf?"
Current: Might send to Perplexity ❌
Optimal: Claude reads uploaded document (correct source) ✅
```

### Cost Analysis

**Current (USE_PERPLEXITY_PRIMARY=true):**
```
100 queries/day
  ↓
100 queries × $0.005 = $0.50/day
  ↓
$15/month per user
  ↓
100 users = $1,500/month 💰💰💰
```

**With SMART Routing:**
```
100 queries/day
  ↓
70 queries → Local KB (FREE)
20 queries → Perplexity ($0.10/day)
10 queries → Claude (existing cost)
  ↓
$3/month per user
  ↓
100 users = $300/month ✅
```

**Savings: $1,200/month (80% cost reduction!)**

---

## SMART Routing Strategy

### Decision Tree

```
User Query
    ↓
┌─────────────────────┐
│ Classify Task Type  │
└──────────┬──────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │                                              │
┌───▼────────┐                           ┌────────▼────────┐
│ STATIC KB? │                           │ DYNAMIC LOOKUP? │
│ (codes,    │                           │ (prices, specs) │
│  standards)│                           └────────┬────────┘
└───┬────────┘                                    │
    │                                             │
    ├─YES→ Local KB ✅                            │
    │                                             │
    ├─NO→ Continue                                │
                                                  │
                                         ┌────────▼────────┐
                                         │ Check Local KB  │
                                         │ Confidence      │
                                         └────────┬────────┘
                                                  │
                                    ┌─────────────┼──────────────┐
                                    │             │              │
                               ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
                               │ >90%    │   │ 70-90%  │   │ <70%    │
                               │ HIGH    │   │ MEDIUM  │   │ LOW     │
                               └────┬────┘   └────┬────┘   └────┬────┘
                                    │             │              │
                                    │             │              │
                               LOCAL KB ✅    PERPLEXITY   PERPLEXITY
                                              + CACHE       + CACHE
```

### Task Categories

| Category | Description | Primary Source | Fallback |
|----------|-------------|----------------|----------|
| **STATIC_LOOKUP** | KROS codes, ČSN standards, RTS codes | Local KB | None |
| **CURRENT_PRICE** | Equipment prices, material costs | Perplexity | Local (outdated) |
| **EQUIPMENT_SPEC** | Equipment specifications | Local KB → Perplexity | None |
| **DOCUMENT_QA** | Questions about uploaded docs | Claude | None |
| **STANDARD_TEXT** | ČSN full text, regulation details | Perplexity* | Local |
| **BEST_PRACTICE** | Construction best practices | Perplexity | Local KB |
| **VALIDATION** | Budget validation, quantity checks | Claude | None |

*Note: Only if user has purchased access credentials (see credential_management.md)

---

## Task Classification System

### Auto-Classification Rules

```python
from enum import Enum
from typing import Literal

class TaskType(str, Enum):
    STATIC_LOOKUP = "static_lookup"
    CURRENT_PRICE = "current_price"
    EQUIPMENT_SPEC = "equipment_spec"
    DOCUMENT_QA = "document_qa"
    STANDARD_TEXT = "standard_text"
    BEST_PRACTICE = "best_practice"
    VALIDATION = "validation"

class TaskClassifier:
    """Classify query into task type"""

    PRICE_KEYWORDS = [
        'price', 'cost', 'cena', 'kolik stojí', 'current',
        'aktuální', '2024', '2025', 'market rate'
    ]

    CODE_KEYWORDS = [
        'kros', 'rts', 'otskp', 'jkso', 'code', 'kód',
        'classification', 'klasifikace', '121151113'
    ]

    DOCUMENT_KEYWORDS = [
        'techspec', 'drawing', 'výkres', 'specification',
        'upload', 'document', 'pdf', 'excel', 'v dokumentu'
    ]

    def classify(self, query: str, context: dict = None) -> TaskType:
        """
        Classify query into task type.

        Args:
            query: User's question
            context: Additional context (uploaded docs, project stage, etc.)

        Returns:
            TaskType enum
        """
        query_lower = query.lower()

        # 1. Check for uploaded document context
        if context and context.get('has_documents'):
            if any(kw in query_lower for kw in self.DOCUMENT_KEYWORDS):
                return TaskType.DOCUMENT_QA

        # 2. Check for price queries
        if any(kw in query_lower for kw in self.PRICE_KEYWORDS):
            return TaskType.CURRENT_PRICE

        # 3. Check for code lookups
        if any(kw in query_lower for kw in self.CODE_KEYWORDS):
            return TaskType.STATIC_LOOKUP

        # 4. Check for equipment specifications
        if 'specification' in query_lower or 'tech data' in query_lower:
            return TaskType.EQUIPMENT_SPEC

        # 5. Check for standard text requests
        if 'čsn' in query_lower and 'full text' in query_lower:
            return TaskType.STANDARD_TEXT

        # 6. Default to best practice
        return TaskType.BEST_PRACTICE

# Usage
classifier = TaskClassifier()
task_type = classifier.classify(
    "Jaká je aktuální cena HILTI TE 500?",
    context={'has_documents': False}
)
# Returns: TaskType.CURRENT_PRICE
```

---

## Routing Rules Matrix

### Detailed Routing Logic

```python
from dataclasses import dataclass
from typing import Optional, List

@dataclass
class RoutingRule:
    task_type: TaskType
    primary_source: str
    fallback_sources: List[str]
    use_cache: bool
    cache_ttl_hours: int
    cost_per_query: float
    requires_credentials: bool = False

ROUTING_RULES = {
    TaskType.STATIC_LOOKUP: RoutingRule(
        task_type=TaskType.STATIC_LOOKUP,
        primary_source="local_kb",
        fallback_sources=[],
        use_cache=True,
        cache_ttl_hours=720,  # 30 days (static data)
        cost_per_query=0.0,
        requires_credentials=False
    ),

    TaskType.CURRENT_PRICE: RoutingRule(
        task_type=TaskType.CURRENT_PRICE,
        primary_source="perplexity",
        fallback_sources=["local_kb"],  # Outdated, but better than nothing
        use_cache=True,
        cache_ttl_hours=24,  # Daily updates
        cost_per_query=0.005,
        requires_credentials=False
    ),

    TaskType.EQUIPMENT_SPEC: RoutingRule(
        task_type=TaskType.EQUIPMENT_SPEC,
        primary_source="local_kb",  # Try local first
        fallback_sources=["perplexity"],
        use_cache=True,
        cache_ttl_hours=168,  # 7 days
        cost_per_query=0.0,  # Only if fallback needed
        requires_credentials=False
    ),

    TaskType.DOCUMENT_QA: RoutingRule(
        task_type=TaskType.DOCUMENT_QA,
        primary_source="claude",
        fallback_sources=[],
        use_cache=False,  # Always read fresh (docs may change)
        cache_ttl_hours=0,
        cost_per_query=0.0,  # Using existing Claude budget
        requires_credentials=False
    ),

    TaskType.STANDARD_TEXT: RoutingRule(
        task_type=TaskType.STANDARD_TEXT,
        primary_source="perplexity_with_credentials",
        fallback_sources=["local_kb"],
        use_cache=True,
        cache_ttl_hours=8760,  # 1 year (standards rarely change)
        cost_per_query=0.005,
        requires_credentials=True  # CSN Online, etc.
    ),

    TaskType.BEST_PRACTICE: RoutingRule(
        task_type=TaskType.BEST_PRACTICE,
        primary_source="perplexity",
        fallback_sources=["local_kb"],
        use_cache=True,
        cache_ttl_hours=168,  # 7 days
        cost_per_query=0.005,
        requires_credentials=False
    ),

    TaskType.VALIDATION: RoutingRule(
        task_type=TaskType.VALIDATION,
        primary_source="claude",
        fallback_sources=[],
        use_cache=False,
        cache_ttl_hours=0,
        cost_per_query=0.0,
        requires_credentials=False
    ),
}
```

### Router Implementation

```python
class KnowledgeRouter:
    """Route queries to optimal knowledge source"""

    def __init__(
        self,
        kb_loader,
        claude_client,
        perplexity_client,
        redis_cache,
        credential_manager
    ):
        self.kb_loader = kb_loader
        self.claude = claude_client
        self.perplexity = perplexity_client
        self.cache = redis_cache
        self.credentials = credential_manager
        self.classifier = TaskClassifier()

    async def route_query(
        self,
        query: str,
        context: dict = None
    ) -> dict:
        """
        Route query to optimal source.

        Returns:
            {
                'answer': str,
                'source': 'local_kb' | 'perplexity' | 'claude',
                'confidence': float,
                'cost': float,
                'cached': bool,
                'citations': List[str]
            }
        """
        # 1. Classify task type
        task_type = self.classifier.classify(query, context)
        rule = ROUTING_RULES[task_type]

        # 2. Check cache if enabled
        if rule.use_cache:
            cache_key = self._generate_cache_key(query, task_type)
            cached = await self.cache.get(cache_key)
            if cached:
                return {
                    **cached,
                    'cached': True,
                    'cost': 0.0
                }

        # 3. Try primary source
        result = await self._query_source(
            rule.primary_source,
            query,
            context,
            rule.requires_credentials
        )

        # 4. Check confidence
        if result['confidence'] < 0.7 and rule.fallback_sources:
            # Try fallback
            for fallback in rule.fallback_sources:
                fallback_result = await self._query_source(
                    fallback,
                    query,
                    context,
                    False
                )
                if fallback_result['confidence'] > result['confidence']:
                    result = fallback_result
                    break

        # 5. Cache if enabled
        if rule.use_cache:
            await self.cache.set(
                cache_key,
                result,
                ttl_hours=rule.cache_ttl_hours
            )

        # 6. Track cost
        result['cost'] = rule.cost_per_query if not result.get('cached') else 0.0

        return result

    async def _query_source(
        self,
        source: str,
        query: str,
        context: dict,
        requires_credentials: bool
    ) -> dict:
        """Query specific knowledge source"""

        if source == "local_kb":
            return await self._query_local_kb(query)

        elif source == "perplexity":
            return await self._query_perplexity(query, requires_credentials)

        elif source == "perplexity_with_credentials":
            if not self.credentials.has_credentials():
                # Fallback to regular Perplexity
                return await self._query_perplexity(query, False)
            return await self._query_perplexity(query, True)

        elif source == "claude":
            return await self._query_claude(query, context)

        else:
            raise ValueError(f"Unknown source: {source}")

    async def _query_local_kb(self, query: str) -> dict:
        """Query local knowledge base"""
        results = self.kb_loader.search(query, top_k=3)

        if not results:
            return {
                'answer': None,
                'source': 'local_kb',
                'confidence': 0.0,
                'citations': []
            }

        return {
            'answer': results[0]['content'],
            'source': 'local_kb',
            'confidence': results[0]['score'],
            'citations': [r['source'] for r in results]
        }

    async def _query_perplexity(
        self,
        query: str,
        use_credentials: bool
    ) -> dict:
        """Query Perplexity API"""

        # Build query with credentials if needed
        if use_credentials:
            credentials = await self.credentials.get_active_credentials()
            # Credentials handled by Proxy Service (see credential_management.md)

        response = await self.perplexity.query(query)

        return {
            'answer': response['answer'],
            'source': 'perplexity',
            'confidence': 0.95,  # Perplexity is usually reliable
            'citations': response.get('citations', [])
        }

    async def _query_claude(self, query: str, context: dict) -> dict:
        """Query Claude (for document Q&A, validation)"""

        # For document Q&A, include uploaded documents
        documents = context.get('documents', [])

        prompt = f"""
Answer this question based on the uploaded documents:

QUESTION: {query}

DOCUMENTS:
{self._format_documents(documents)}

Provide answer with source references.
"""

        response = await self.claude.complete(prompt)

        return {
            'answer': response['content'],
            'source': 'claude',
            'confidence': 0.9,
            'citations': self._extract_citations(response['content'])
        }

    def _generate_cache_key(self, query: str, task_type: TaskType) -> str:
        """Generate cache key"""
        import hashlib
        query_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
        return f"knowledge:{task_type.value}:{query_hash}"

    def _format_documents(self, documents: List[dict]) -> str:
        """Format documents for Claude"""
        formatted = []
        for doc in documents:
            formatted.append(f"""
Document: {doc['filename']}
Content:
{doc['content'][:2000]}...
""")
        return "\n---\n".join(formatted)

    def _extract_citations(self, text: str) -> List[str]:
        """Extract citations from Claude response"""
        # Simple regex to find [Source: filename, page X]
        import re
        pattern = r'\[Source: ([^\]]+)\]'
        return re.findall(pattern, text)
```

---

## Cost Management

### Daily Budget Limits

```python
from datetime import datetime, timedelta

class CostManager:
    """Manage Perplexity API costs"""

    def __init__(self, redis_cache):
        self.cache = redis_cache

    async def check_budget(self, user_id: str) -> dict:
        """
        Check if user is within budget.

        Returns:
            {
                'allowed': bool,
                'used_today': float,
                'limit': float,
                'remaining': float
            }
        """
        today = datetime.now().strftime('%Y-%m-%d')
        key = f"cost:{user_id}:{today}"

        used_today = float(await self.cache.get(key) or 0.0)
        limit = await self._get_user_limit(user_id)

        return {
            'allowed': used_today < limit,
            'used_today': used_today,
            'limit': limit,
            'remaining': max(0, limit - used_today)
        }

    async def track_cost(self, user_id: str, cost: float):
        """Track cost for user"""
        today = datetime.now().strftime('%Y-%m-%d')
        key = f"cost:{user_id}:{today}"

        # Increment cost
        await self.cache.incr_by(key, cost)

        # Set expiry (2 days to allow grace period)
        await self.cache.expire(key, hours=48)

    async def _get_user_limit(self, user_id: str) -> float:
        """Get user's daily limit"""
        # Default: $0.50/day ($15/month)
        # Premium users: $2.00/day ($60/month)

        user = await get_user(user_id)

        if user['subscription'] == 'premium':
            return 2.00
        return 0.50
```

### Cost Alerts

```python
async def query_with_cost_check(router, user_id, query, context):
    """Wrap router with cost checking"""

    cost_manager = CostManager(redis_cache)

    # Check budget
    budget = await cost_manager.check_budget(user_id)

    if not budget['allowed']:
        return {
            'error': 'Daily budget exceeded',
            'used_today': budget['used_today'],
            'limit': budget['limit'],
            'message': 'Please upgrade to premium or wait until tomorrow'
        }

    # Execute query
    result = await router.route_query(query, context)

    # Track cost
    if result['cost'] > 0:
        await cost_manager.track_cost(user_id, result['cost'])

    # Warn if approaching limit
    if budget['remaining'] < 0.10:
        result['warning'] = f"Budget warning: ${budget['remaining']:.2f} remaining today"

    return result
```

---

## Caching Strategy

### Redis Cache Structure

```
knowledge:{task_type}:{query_hash} → {answer, source, confidence, citations}
TTL varies by task type:
  - static_lookup: 30 days
  - current_price: 1 day
  - equipment_spec: 7 days
  - standard_text: 365 days
  - best_practice: 7 days
```

### Cache Implementation

```python
import hashlib
import json

class KnowledgeCache:
    """Cache knowledge queries in Redis"""

    def __init__(self, redis_client):
        self.redis = redis_client

    async def get(self, cache_key: str) -> Optional[dict]:
        """Get cached result"""
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)
        return None

    async def set(
        self,
        cache_key: str,
        result: dict,
        ttl_hours: int
    ):
        """Cache result"""
        await self.redis.setex(
            cache_key,
            ttl_hours * 3600,  # Convert to seconds
            json.dumps(result)
        )

    async def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern"""
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)

    async def get_stats(self) -> dict:
        """Get cache statistics"""
        total_keys = len(await self.redis.keys("knowledge:*"))

        stats = {
            'total_cached': total_keys,
            'by_type': {}
        }

        for task_type in TaskType:
            pattern = f"knowledge:{task_type.value}:*"
            count = len(await self.redis.keys(pattern))
            stats['by_type'][task_type.value] = count

        return stats
```

### Cache Warming

```python
async def warm_cache():
    """Pre-populate cache with common queries"""

    common_queries = [
        ("KROS code for concrete C25/30", TaskType.STATIC_LOOKUP),
        ("Standard thickness for foundation", TaskType.BEST_PRACTICE),
        # ... more common queries
    ]

    router = KnowledgeRouter(...)

    for query, task_type in common_queries:
        await router.route_query(query, context={'task_type': task_type})
```

---

## Implementation Details

### Configuration

```python
# .env
# Perplexity API
PERPLEXITY_API_KEY=pplx-your_key_here
PERPLEXITY_CACHE_TTL=86400  # 24 hours default

# Cost limits
PERPLEXITY_DAILY_BUDGET_FREE=0.50
PERPLEXITY_DAILY_BUDGET_PREMIUM=2.00

# Routing thresholds
LOCAL_KB_CONFIDENCE_THRESHOLD=0.7
FALLBACK_ENABLED=true
```

### API Endpoints

```python
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])

@router.post("/query")
async def query_knowledge(
    query: str,
    user_id: str,
    context: dict = None
) -> dict:
    """
    Query knowledge with smart routing.

    Example:
        POST /api/knowledge/query
        {
            "query": "Current price for HILTI TE 500-AVR",
            "user_id": "user-123",
            "context": {"project_id": "proj-456"}
        }

    Returns:
        {
            "answer": "...",
            "source": "perplexity",
            "confidence": 0.95,
            "cost": 0.005,
            "cached": false,
            "citations": [...]
        }
    """
    router = get_knowledge_router()
    result = await query_with_cost_check(router, user_id, query, context)
    return result

@router.get("/stats/{user_id}")
async def get_user_stats(user_id: str) -> dict:
    """Get user's usage statistics"""
    cost_manager = CostManager(redis_cache)
    budget = await cost_manager.check_budget(user_id)

    cache = KnowledgeCache(redis_client)
    cache_stats = await cache.get_stats()

    return {
        'budget': budget,
        'cache': cache_stats
    }

@router.post("/cache/clear")
async def clear_cache(pattern: str = "knowledge:*"):
    """Clear cache (admin only)"""
    cache = KnowledgeCache(redis_client)
    await cache.invalidate_pattern(pattern)
    return {"status": "cleared", "pattern": pattern}
```

---

## Monitoring & Analytics

### Metrics to Track

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class QueryMetrics:
    timestamp: datetime
    user_id: str
    query: str
    task_type: TaskType
    source_used: str  # local_kb, perplexity, claude
    fallback_used: bool
    response_time_ms: int
    confidence: float
    cost: float
    cached: bool

class MetricsCollector:
    """Collect routing metrics"""

    async def log_query(self, metrics: QueryMetrics):
        """Log query metrics to PostgreSQL"""
        await db.execute("""
            INSERT INTO knowledge_queries (
                timestamp, user_id, query, task_type,
                source_used, fallback_used, response_time_ms,
                confidence, cost, cached
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """, metrics.timestamp, metrics.user_id, metrics.query,
            metrics.task_type.value, metrics.source_used,
            metrics.fallback_used, metrics.response_time_ms,
            metrics.confidence, metrics.cost, metrics.cached)

    async def get_analytics(self, start_date: datetime, end_date: datetime) -> dict:
        """Get routing analytics"""

        results = await db.fetch_all("""
            SELECT
                task_type,
                source_used,
                COUNT(*) as count,
                AVG(response_time_ms) as avg_response_time,
                AVG(confidence) as avg_confidence,
                SUM(cost) as total_cost,
                SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hits
            FROM knowledge_queries
            WHERE timestamp BETWEEN $1 AND $2
            GROUP BY task_type, source_used
            ORDER BY count DESC
        """, start_date, end_date)

        return {
            'breakdown': [dict(row) for row in results],
            'summary': self._calculate_summary(results)
        }

    def _calculate_summary(self, results) -> dict:
        total_queries = sum(r['count'] for r in results)
        total_cost = sum(r['total_cost'] for r in results)
        total_cache_hits = sum(r['cache_hits'] for r in results)

        return {
            'total_queries': total_queries,
            'total_cost': total_cost,
            'avg_cost_per_query': total_cost / total_queries if total_queries > 0 else 0,
            'cache_hit_rate': total_cache_hits / total_queries if total_queries > 0 else 0
        }
```

### Dashboard Queries

```sql
-- Most expensive queries
SELECT
    query,
    task_type,
    source_used,
    SUM(cost) as total_cost,
    COUNT(*) as frequency
FROM knowledge_queries
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY query, task_type, source_used
ORDER BY total_cost DESC
LIMIT 20;

-- Routing efficiency
SELECT
    task_type,
    source_used,
    AVG(confidence) as avg_confidence,
    SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END)::float / COUNT(*) as fallback_rate
FROM knowledge_queries
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY task_type, source_used;

-- Cost by user
SELECT
    user_id,
    DATE(timestamp) as date,
    SUM(cost) as daily_cost
FROM knowledge_queries
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY user_id, DATE(timestamp)
ORDER BY daily_cost DESC;
```

---

## Testing Strategy

### Unit Tests

```python
import pytest
from unittest.mock import AsyncMock, Mock

@pytest.mark.asyncio
async def test_task_classification():
    """Test task classifier"""
    classifier = TaskClassifier()

    # Price query
    result = classifier.classify("Jaká je aktuální cena HILTI TE 500?")
    assert result == TaskType.CURRENT_PRICE

    # Code lookup
    result = classifier.classify("KROS code for concrete C25/30")
    assert result == TaskType.STATIC_LOOKUP

    # Document Q&A
    result = classifier.classify(
        "What concrete grade is in TechSpec.pdf?",
        context={'has_documents': True}
    )
    assert result == TaskType.DOCUMENT_QA

@pytest.mark.asyncio
async def test_routing_rules():
    """Test routing logic"""
    router = KnowledgeRouter(...)

    # Static lookup should use local KB
    result = await router.route_query("KROS 121151113")
    assert result['source'] == 'local_kb'
    assert result['cost'] == 0.0

    # Current price should use Perplexity
    result = await router.route_query("Current price HILTI TE 500 2024")
    assert result['source'] == 'perplexity'
    assert result['cost'] > 0.0

@pytest.mark.asyncio
async def test_cost_management():
    """Test cost limits"""
    cost_manager = CostManager(redis_cache)

    # Track costs
    await cost_manager.track_cost('user-123', 0.30)
    budget = await cost_manager.check_budget('user-123')
    assert budget['used_today'] == 0.30
    assert budget['remaining'] == 0.20  # 0.50 limit - 0.30 used

    # Exceed budget
    await cost_manager.track_cost('user-123', 0.25)
    budget = await cost_manager.check_budget('user-123')
    assert budget['allowed'] == False

@pytest.mark.asyncio
async def test_caching():
    """Test cache functionality"""
    cache = KnowledgeCache(redis_client)

    # Cache miss
    result = await cache.get('knowledge:static_lookup:abc123')
    assert result is None

    # Cache set
    await cache.set(
        'knowledge:static_lookup:abc123',
        {'answer': 'Beton C25/30', 'confidence': 0.95},
        ttl_hours=24
    )

    # Cache hit
    result = await cache.get('knowledge:static_lookup:abc123')
    assert result['answer'] == 'Beton C25/30'
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_full_routing_flow():
    """Test complete routing flow"""

    # Setup
    router = KnowledgeRouter(
        kb_loader=kb_loader,
        claude_client=claude_client,
        perplexity_client=perplexity_client,
        redis_cache=redis_cache,
        credential_manager=credential_manager
    )

    # Query 1: Local KB (free)
    result1 = await router.route_query("KROS code for Beton C25/30")
    assert result1['source'] == 'local_kb'
    assert result1['cost'] == 0.0
    assert not result1['cached']

    # Query 2: Same query (cached)
    result2 = await router.route_query("KROS code for Beton C25/30")
    assert result2['cached'] == True
    assert result2['cost'] == 0.0

    # Query 3: Perplexity (paid)
    result3 = await router.route_query("Current price HILTI TE 500-AVR 2024")
    assert result3['source'] == 'perplexity'
    assert result3['cost'] == 0.005
```

---

## Migration Plan

### Phase 1: Add Smart Routing (Week 1)

**Day 1-2:**
- [ ] Implement `TaskClassifier`
- [ ] Define `ROUTING_RULES`
- [ ] Create `KnowledgeRouter` class

**Day 3-4:**
- [ ] Implement `CostManager`
- [ ] Add Redis caching layer
- [ ] Write unit tests

**Day 5:**
- [ ] Integration testing
- [ ] Deploy to staging

### Phase 2: Monitor & Optimize (Week 2)

**Day 1-2:**
- [ ] Add metrics collection
- [ ] Create analytics dashboard
- [ ] Monitor cost savings

**Day 3-5:**
- [ ] Tune confidence thresholds
- [ ] Optimize cache TTLs
- [ ] A/B test routing rules

### Phase 3: Advanced Features (Week 3+)

- [ ] Machine learning for task classification
- [ ] Adaptive routing based on user feedback
- [ ] Custom routing rules per user

---

## Success Metrics

**Target Metrics (After 1 Month):**

- ✅ 70%+ queries served by local KB (free)
- ✅ 80%+ cost reduction vs current approach
- ✅ 95%+ cache hit rate for static queries
- ✅ <200ms avg response time
- ✅ >90% user satisfaction with answer quality
- ✅ <5% fallback rate (primary source works most of the time)

**Cost Comparison:**

| Metric | Current (Binary) | SMART Routing | Improvement |
|--------|------------------|---------------|-------------|
| Queries/day | 100 | 100 | - |
| Perplexity queries | 100 (if true) | 20-30 | 70% reduction |
| Daily cost | $0.50 | $0.10-$0.15 | 70-80% savings |
| Response time | 2-3s | 0.5-2s | 50% faster |
| Cache hit rate | 0% | 40-60% | +60% |

---

**Document Status:** ✅ Complete
**Next Steps:** Implement after backend_infrastructure.md
**Dependencies:** Redis (caching), PostgreSQL (metrics)

---

**Last Updated:** 2025-11-06
**Author:** Claude Code (AI Development Assistant)
**Reviewed By:** [Pending]
