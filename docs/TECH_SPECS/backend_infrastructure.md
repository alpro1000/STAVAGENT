# Backend Infrastructure - Technical Specification

**Created:** 2025-11-06
**Status:** 🟡 Implementation Pending
**Priority:** ⭐⭐⭐⭐⭐ CRITICAL
**Phase:** 4 - Backend Infrastructure

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [PostgreSQL Migration](#postgresql-migration)
4. [Redis Integration](#redis-integration)
5. [Celery Queue System](#celery-queue-system)
6. [WebSocket Real-time Updates](#websocket-real-time-updates)
7. [Implementation Timeline](#implementation-timeline)
8. [Rollback Strategy](#rollback-strategy)
9. [Testing Requirements](#testing-requirements)

---

## Executive Summary

### Problem Statement

**Current limitations:**
- File-based storage (`data/projects/{id}/`) не масштабируется
- Нет транзакций (риск потери данных при crashes)
- Медленные запросы (нужно читать все файлы)
- Невозможен true multi-user access
- Нет real-time updates
- Long-running tasks блокируют HTTP requests

**Solution:**
Migrate to production-grade infrastructure:
- PostgreSQL для persistent data
- Redis для caching & sessions
- Celery для background jobs
- WebSocket для real-time communication

### Success Criteria

- ✅ Все проекты мигрированы из файлов в PostgreSQL без потерь
- ✅ API response time < 200ms (95th percentile)
- ✅ Support 100+ concurrent users
- ✅ Background jobs не блокируют UI
- ✅ Real-time progress updates в UI
- ✅ Zero downtime deployment capability

---

## Current State Analysis

### File-based Storage

**Structure:**
```
data/projects/
  ├── project-abc-123/
  │   ├── project.json           (metadata)
  │   ├── audit_results.json     (audit data)
  │   ├── positions.json         (budget positions)
  │   ├── raw/                   (uploaded files)
  │   ├── processed/             (parsed data)
  │   └── artifacts/             (generated outputs)
```

**Problems:**
```python
# Current code (problematic):
def get_project(project_id: str):
    path = DATA_DIR / "projects" / project_id / "project.json"
    with open(path) as f:
        return json.load(f)  # ❌ No caching, reads file every time

def update_position(project_id: str, position: dict):
    positions = load_positions(project_id)  # ❌ Load ALL positions
    positions.append(position)
    save_positions(project_id, positions)   # ❌ No transaction
    # If crash here → data lost!
```

**Metrics (current):**
- Project load time: ~50-100ms (for small projects)
- Search across projects: N/A (impossible without scanning all files)
- Concurrent writes: ❌ Race conditions possible
- Analytics queries: ❌ Not feasible

---

## PostgreSQL Migration

### Database Schema Design

#### Core Tables

**1. users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',  -- user, pro, business, enterprise
    status VARCHAR(50) DEFAULT 'pending',  -- pending, active, suspended
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    metadata JSONB  -- Flexible storage for user preferences
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
```

**2. projects**
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    workflow VARCHAR(20) NOT NULL,  -- workflow_a, workflow_b
    status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, parsing, enriching, auditing, completed, archived
    progress DECIMAL(5,2) DEFAULT 0.00,  -- 0.00 to 100.00
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB,  -- Original project config, flexible fields

    -- Cached aggregates (for performance)
    total_positions INTEGER DEFAULT 0,
    total_cost DECIMAL(15,2),
    issues_count_green INTEGER DEFAULT 0,
    issues_count_amber INTEGER DEFAULT 0,
    issues_count_red INTEGER DEFAULT 0
);

CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_workflow ON projects(workflow);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
```

**3. project_documents**
```sql
CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- pdf, xlsx, xml, etc
    file_size BIGINT NOT NULL,  -- bytes
    mime_type VARCHAR(100),
    storage_path VARCHAR(1000),  -- S3 path or local path
    content_hash VARCHAR(64),  -- SHA256 for deduplication
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parsed_at TIMESTAMP,
    parse_status VARCHAR(50) DEFAULT 'pending',  -- pending, parsing, completed, failed
    parse_error TEXT,
    metadata JSONB,  -- Parser-specific metadata

    -- For document intelligence
    indexed_content TEXT,  -- Full text for search
    extracted_data JSONB   -- Structured data extracted
);

CREATE INDEX idx_documents_project ON project_documents(project_id);
CREATE INDEX idx_documents_status ON project_documents(parse_status);
CREATE INDEX idx_documents_hash ON project_documents(content_hash);
-- Full-text search index
CREATE INDEX idx_documents_search ON project_documents USING GIN(to_tsvector('english', indexed_content));
```

**4. budget_versions**
```sql
CREATE TABLE budget_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    trigger_type VARCHAR(50) NOT NULL,  -- initial, document_added, user_edit, chat_modification, recalculation
    trigger_details JSONB,

    -- Snapshot of budget state
    total_positions INTEGER,
    total_cost DECIMAL(15,2),
    summary JSONB,  -- High-level summary

    -- Changes from previous version
    changes JSONB,  -- {added: [], removed: [], modified: []}
    delta_cost DECIMAL(15,2),

    UNIQUE(project_id, version)
);

CREATE INDEX idx_budget_versions_project ON budget_versions(project_id, version DESC);
CREATE INDEX idx_budget_versions_trigger ON budget_versions(trigger_type);
```

**5. positions**
```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,

    -- Position data
    position_number VARCHAR(50),
    code VARCHAR(100),  -- KROS/RTS/OTSKP code
    description TEXT NOT NULL,
    category VARCHAR(100),

    -- Quantities
    quantity DECIMAL(15,4),
    unit VARCHAR(50),
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2),

    -- Audit status
    status VARCHAR(20),  -- green, amber, red
    confidence DECIMAL(5,2),  -- 0.00 to 100.00

    -- Source tracking
    source VARCHAR(50),  -- uploaded, generated, manual, ai_suggested
    source_document_id UUID REFERENCES project_documents(id),
    source_line INTEGER,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Flexible data
    enrichment JSONB,  -- KROS match data, pricing info, etc
    metadata JSONB
);

CREATE INDEX idx_positions_project ON positions(project_id);
CREATE INDEX idx_positions_version ON positions(version_id);
CREATE INDEX idx_positions_code ON positions(code);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_category ON positions(category);
```

**6. audit_results**
```sql
CREATE TABLE audit_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,

    expert_role VARCHAR(50) NOT NULL,  -- structural, concrete, cost, standards, validator, orchestrator
    recommendation VARCHAR(20) NOT NULL,  -- GREEN, AMBER, RED
    confidence DECIMAL(5,2) NOT NULL,
    reasoning TEXT,
    evidence JSONB,

    -- Issue tracking
    issues JSONB,  -- [{type, severity, description, suggestion}]
    suggestions JSONB,  -- [{action, benefit, risk}]

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- For conflict resolution
    conflicts_with UUID[],  -- Array of other audit_result IDs
    resolved BOOLEAN DEFAULT FALSE,
    resolution JSONB
);

CREATE INDEX idx_audit_project ON audit_results(project_id);
CREATE INDEX idx_audit_position ON audit_results(position_id);
CREATE INDEX idx_audit_role ON audit_results(expert_role);
CREATE INDEX idx_audit_recommendation ON audit_results(recommendation);
```

**7. chat_history**
```sql
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),

    role VARCHAR(20) NOT NULL,  -- user, assistant, system
    message TEXT NOT NULL,
    message_type VARCHAR(50),  -- question, answer, clarification, command

    -- Context
    context JSONB,  -- Relevant project data at time of message
    position_ids UUID[],  -- Related positions
    document_ids UUID[],  -- Related documents

    -- For document Q&A
    question_id UUID,  -- If part of Q&A flow
    answer_confidence DECIMAL(5,2),
    answer_source TEXT,

    -- Actions taken
    actions JSONB,  -- [{action, before, after, result}]

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_project ON chat_history(project_id, created_at DESC);
CREATE INDEX idx_chat_user ON chat_history(user_id);
CREATE INDEX idx_chat_question ON chat_history(question_id);
```

**8. background_jobs**
```sql
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,  -- audit, parse, enrich, generate, export
    status VARCHAR(50) NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed
    priority INTEGER DEFAULT 1,  -- 1=low, 2=normal, 3=high, 4=critical

    -- Job data
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    input_data JSONB NOT NULL,
    result_data JSONB,
    error TEXT,

    -- Progress tracking
    progress DECIMAL(5,2) DEFAULT 0.00,
    current_step VARCHAR(200),
    total_steps INTEGER,

    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Celery task ID
    celery_task_id VARCHAR(255)
);

CREATE INDEX idx_jobs_status ON background_jobs(status, priority DESC);
CREATE INDEX idx_jobs_project ON background_jobs(project_id);
CREATE INDEX idx_jobs_type ON background_jobs(job_type);
CREATE INDEX idx_jobs_created ON background_jobs(created_at DESC);
```

**9. kb_cache** (Perplexity & web search cache)
```sql
CREATE TABLE kb_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) UNIQUE NOT NULL,  -- MD5 of normalized query
    query_text TEXT NOT NULL,
    query_type VARCHAR(50),  -- code_lookup, price_lookup, standard_lookup, web_search

    result JSONB NOT NULL,
    sources JSONB,  -- URLs and citations

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_cache_hash ON kb_cache(query_hash);
CREATE INDEX idx_kb_cache_expires ON kb_cache(expires_at);
CREATE INDEX idx_kb_cache_type ON kb_cache(query_type);
```

#### Relationships Diagram

```
users (1) ──── (M) projects
                      │
                      ├── (M) project_documents
                      ├── (M) budget_versions
                      │          │
                      │          └── (M) positions
                      │                   │
                      │                   └── (M) audit_results
                      ├── (M) chat_history
                      └── (M) background_jobs
```

### SQLAlchemy Models

**Directory structure:**
```
app/models/
  ├── __init__.py
  ├── base.py              # Base model with common fields
  ├── user.py
  ├── project.py
  ├── document.py
  ├── position.py
  ├── audit.py
  ├── chat.py
  └── job.py
```

**Example: base.py**
```python
from datetime import datetime
from sqlalchemy import Column, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()

class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class UUIDMixin:
    """Mixin for UUID primary key"""
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

**Example: project.py**
```python
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin

class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(500), nullable=False)
    description = Column(String)
    workflow = Column(String(20), nullable=False)
    status = Column(String(50), nullable=False, default="draft")
    progress = Column(Numeric(5,2), default=0.00)
    completed_at = Column(DateTime)
    metadata = Column(JSONB)

    # Cached aggregates
    total_positions = Column(Integer, default=0)
    total_cost = Column(Numeric(15,2))
    issues_count_green = Column(Integer, default=0)
    issues_count_amber = Column(Integer, default=0)
    issues_count_red = Column(Integer, default=0)

    # Relationships
    user = relationship("User", back_populates="projects")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("BudgetVersion", back_populates="project", cascade="all, delete-orphan")
    chat_history = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")
    jobs = relationship("BackgroundJob", back_populates="project")

    # Indexes
    __table_args__ = (
        Index('idx_projects_user', 'user_id'),
        Index('idx_projects_status', 'status'),
        Index('idx_projects_created', 'created_at'),
    )
```

### Migration Strategy

**Phase 1: Database Setup**
```python
# app/db/migration_v1.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.models import Base
from app.core.config import settings

async def create_database():
    """Create all tables"""
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database schema created")

asyncio.run(create_database())
```

**Phase 2: Data Migration**
```python
# app/db/migrate_projects.py
import json
from pathlib import Path
from app.models import Project, ProjectDocument, Position
from app.db.session import async_session

async def migrate_project(project_dir: Path):
    """Migrate single project from files to PostgreSQL"""

    # 1. Load project.json
    project_json = json.loads((project_dir / "project.json").read_text())

    # 2. Create Project record
    async with async_session() as session:
        project = Project(
            id=project_json["id"],
            user_id=project_json.get("user_id", DEFAULT_USER_ID),
            name=project_json["name"],
            workflow=project_json["workflow"],
            status=project_json["status"],
            metadata=project_json
        )
        session.add(project)

        # 3. Migrate documents
        raw_dir = project_dir / "raw"
        if raw_dir.exists():
            for doc_path in raw_dir.glob("*"):
                document = ProjectDocument(
                    project_id=project.id,
                    filename=doc_path.name,
                    original_filename=doc_path.name,
                    file_type=doc_path.suffix.lstrip('.'),
                    file_size=doc_path.stat().st_size,
                    storage_path=str(doc_path)
                )
                session.add(document)

        # 4. Migrate positions
        positions_json = json.loads((project_dir / "positions.json").read_text())
        for pos_data in positions_json:
            position = Position(
                project_id=project.id,
                version_id=initial_version.id,
                code=pos_data.get("code"),
                description=pos_data.get("description"),
                quantity=pos_data.get("quantity"),
                unit=pos_data.get("unit"),
                unit_price=pos_data.get("unit_price"),
                metadata=pos_data
            )
            session.add(position)

        await session.commit()
        print(f"✅ Migrated project: {project.name}")

async def migrate_all_projects():
    """Migrate all projects from data/projects/"""
    projects_dir = Path("data/projects")

    for project_dir in projects_dir.iterdir():
        if project_dir.is_dir():
            try:
                await migrate_project(project_dir)
            except Exception as e:
                print(f"❌ Failed to migrate {project_dir.name}: {e}")

    print("✅ Migration complete!")
```

**Phase 3: Dual-Write Strategy**
```python
# app/services/project_service.py
class ProjectService:
    """Service layer with dual-write during migration"""

    async def create_project(self, user_id: str, name: str, workflow: str):
        # Write to BOTH systems during migration

        # 1. Write to PostgreSQL (new)
        async with async_session() as session:
            project = Project(
                user_id=user_id,
                name=name,
                workflow=workflow,
                status="draft"
            )
            session.add(project)
            await session.commit()
            project_id = project.id

        # 2. Write to files (old) - for safety during migration
        if settings.MIGRATION_DUAL_WRITE:
            project_dir = DATA_DIR / "projects" / str(project_id)
            project_dir.mkdir(parents=True, exist_ok=True)
            (project_dir / "project.json").write_text(json.dumps({
                "id": str(project_id),
                "name": name,
                "workflow": workflow,
                "status": "draft"
            }))

        return project
```

**Phase 4: Cutover**
```env
# .env - Migration flags
MIGRATION_MODE=dual_write  # dual_write, postgres_only, files_only
MIGRATION_DUAL_WRITE=true
MIGRATION_READ_FROM=postgres  # postgres, files
```

### Performance Optimizations

**1. Indexes**
```sql
-- Already created in table definitions above
-- Additional composite indexes for common queries

CREATE INDEX idx_positions_project_status ON positions(project_id, status);
CREATE INDEX idx_positions_project_category ON positions(project_id, category);
CREATE INDEX idx_chat_project_created ON chat_history(project_id, created_at DESC);
```

**2. Materialized Views** (for analytics)
```sql
CREATE MATERIALIZED VIEW project_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as projects_created,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    AVG(total_cost) as avg_cost
FROM projects
GROUP BY DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON project_analytics(date);

-- Refresh daily
REFRESH MATERIALIZED VIEW CONCURRENTLY project_analytics;
```

**3. Connection Pooling**
```python
# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,  # Number of connections to keep open
    max_overflow=10,  # Additional connections on demand
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600  # Recycle connections after 1 hour
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)
```

---

## Redis Integration

### Purpose

- **Caching:** Frequently accessed data (projects, KB queries)
- **Sessions:** User authentication sessions
- **Real-time state:** Job progress, WebSocket connection tracking
- **Rate limiting:** API call throttling
- **Pub/Sub:** WebSocket broadcasting

### Redis Key Structure

```
# Sessions
session:{session_id} → {user_id, expires_at, data}
TTL: 24 hours

# User cache
user:{user_id}:projects → [project_ids]
TTL: 1 hour

# Project cache
project:{project_id}:state → {status, progress, current_position}
TTL: 1 hour

# Job status
job:{job_id}:status → {status, progress, message, eta}
TTL: 24 hours

# Perplexity cache
perplexity:{query_hash} → {result, sources, timestamp}
TTL: 24 hours

# KB search cache
kb:search:{query_hash} → [results]
TTL: 1 hour

# Rate limiting
ratelimit:{user_id}:{endpoint} → call_count
TTL: 1 minute

# WebSocket connections
ws:connections:{user_id} → [connection_ids]
TTL: permanent (cleaned on disconnect)

# Pub/Sub channels
channel:project:{project_id} → real-time events
channel:user:{user_id} → user notifications
```

### Redis Client Setup

```python
# app/core/redis_client.py
import redis.asyncio as redis
from app.core.config import settings

class RedisClient:
    def __init__(self):
        self.redis = None

    async def connect(self):
        self.redis = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50
        )
        print("✅ Connected to Redis")

    async def disconnect(self):
        if self.redis:
            await self.redis.close()

    # Cache operations
    async def get_cached(self, key: str):
        return await self.redis.get(key)

    async def set_cached(self, key: str, value: str, ttl: int = 3600):
        await self.redis.setex(key, ttl, value)

    async def delete_cached(self, key: str):
        await self.redis.delete(key)

    # Pub/Sub
    async def publish(self, channel: str, message: str):
        await self.redis.publish(channel, message)

    async def subscribe(self, channel: str):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        return pubsub

redis_client = RedisClient()
```

### Caching Strategy

**Cache-Aside Pattern:**
```python
async def get_project(project_id: str):
    # 1. Check cache
    cache_key = f"project:{project_id}:state"
    cached = await redis_client.get_cached(cache_key)

    if cached:
        return json.loads(cached)

    # 2. Cache miss - fetch from database
    async with async_session() as session:
        project = await session.get(Project, project_id)

    # 3. Store in cache
    await redis_client.set_cached(
        cache_key,
        json.dumps(project.to_dict()),
        ttl=3600
    )

    return project
```

**Cache Invalidation:**
```python
async def update_project(project_id: str, updates: dict):
    # 1. Update database
    async with async_session() as session:
        project = await session.get(Project, project_id)
        for key, value in updates.items():
            setattr(project, key, value)
        await session.commit()

    # 2. Invalidate cache
    await redis_client.delete_cached(f"project:{project_id}:state")
```

---

## Celery Queue System

### Purpose

- **Long-running tasks** не блокируют HTTP requests
- **Parallel processing** multiple projects simultaneously
- **Retry logic** for failed jobs
- **Priority queues** urgent vs background tasks
- **Progress tracking** real-time updates to users

### Job Types

```python
# app/workers/tasks.py
from celery import Celery, Task
from app.core.config import settings

celery_app = Celery(
    "concrete_agent",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

class BaseTask(Task):
    """Base task with common functionality"""

    def on_success(self, retval, task_id, args, kwargs):
        # Update job status in PostgreSQL
        pass

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        # Log error, update job status
        pass

# Task 1: Audit Project
@celery_app.task(base=BaseTask, bind=True)
def audit_project(self, project_id: str):
    """
    Background task for project audit
    Duration: 2-5 minutes
    """
    from app.services.audit_service import audit_service

    # Update progress
    self.update_state(
        state='PROGRESS',
        meta={'progress': 0.0, 'message': 'Starting audit...'}
    )

    # Run audit
    result = audit_service.audit(project_id, progress_callback=self.update_state)

    return result

# Task 2: Parse Document
@celery_app.task(base=BaseTask)
def parse_document(document_id: str):
    """
    Background task for document parsing
    Duration: 30 seconds - 2 minutes
    """
    from app.parsers import get_parser

    # Load document
    document = get_document(document_id)

    # Parse
    parser = get_parser(document.file_type)
    result = parser.parse(document.storage_path)

    # Save results
    save_parsed_data(document_id, result)

    return {"success": True, "positions_found": len(result.get("positions", []))}

# Task 3: Generate Budget from Drawings
@celery_app.task(base=BaseTask, bind=True)
def generate_budget_from_drawings(self, project_id: str):
    """
    Background task for Workflow B
    Duration: 5-10 minutes
    """
    from app.services.workflow_b import workflow_b

    self.update_state(state='PROGRESS', meta={'progress': 0.0, 'message': 'Analyzing drawings...'})

    result = workflow_b.run(project_id, progress_callback=lambda p, m: self.update_state(
        state='PROGRESS',
        meta={'progress': p, 'message': m}
    ))

    return result
```

### Queue Configuration

```python
# app/workers/celery_config.py
from kombu import Exchange, Queue

celery_app.conf.update(
    task_queues=(
        Queue('high', Exchange('high'), routing_key='high', priority=10),
        Queue('default', Exchange('default'), routing_key='default', priority=5),
        Queue('low', Exchange('low'), routing_key='low', priority=1),
    ),
    task_routes={
        'app.workers.tasks.audit_project': {'queue': 'high'},
        'app.workers.tasks.parse_document': {'queue': 'default'},
        'app.workers.tasks.generate_budget_from_drawings': {'queue': 'high'},
    },
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',

    # Result backend
    result_backend=settings.REDIS_URL,
    result_expires=3600,  # 1 hour

    # Concurrency
    worker_concurrency=4,  # 4 parallel workers
    worker_prefetch_multiplier=1,

    # Retry
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
```

### API Integration

```python
# app/api/routes_jobs.py
from fastapi import APIRouter, BackgroundTasks
from app.workers.tasks import audit_project

router = APIRouter()

@router.post("/projects/{project_id}/audit")
async def start_audit(project_id: str):
    """Start background audit job"""

    # Create job record
    job = await create_job(
        job_type="audit",
        project_id=project_id,
        status="queued"
    )

    # Enqueue Celery task
    task = audit_project.apply_async(
        args=[project_id],
        queue='high',
        task_id=str(job.id)
    )

    return {
        "job_id": str(job.id),
        "status": "queued",
        "estimated_time": "2-3 minutes"
    }

@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get job progress"""

    # Check Celery task status
    task = celery_app.AsyncResult(job_id)

    if task.state == 'PROGRESS':
        return {
            "status": "running",
            "progress": task.info.get('progress', 0),
            "message": task.info.get('message', ''),
            "eta_seconds": task.info.get('eta', None)
        }
    elif task.state == 'SUCCESS':
        return {
            "status": "completed",
            "progress": 100,
            "result": task.result
        }
    elif task.state == 'FAILURE':
        return {
            "status": "failed",
            "error": str(task.info)
        }
    else:
        return {
            "status": "queued",
            "progress": 0
        }
```

---

## WebSocket Real-time Updates

### Purpose

- Show live progress during audits
- Notify users of completed jobs
- Real-time chat updates
- Live collaboration (multi-user editing)
- Instant notifications

### WebSocket Server

```python
# app/api/websocket.py
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.core.redis_client import redis_client
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        # Track in Redis
        await redis_client.redis.sadd(f"ws:connections:{user_id}", id(websocket))

    async def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Remove from Redis
        await redis_client.redis.srem(f"ws:connections:{user_id}", id(websocket))

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

    async def broadcast_to_project(self, message: dict, project_id: str):
        # Publish to Redis channel
        await redis_client.publish(
            f"channel:project:{project_id}",
            json.dumps(message)
        )

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    user_id: str = Depends(get_current_user_from_token)
):
    await manager.connect(websocket, user_id)

    try:
        # Subscribe to user's Redis channel
        pubsub = await redis_client.subscribe(f"channel:user:{user_id}")

        while True:
            # Listen for messages from Redis Pub/Sub
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)

            if message:
                await websocket.send_json(json.loads(message['data']))

            # Also handle direct WebSocket messages from client
            try:
                data = await websocket.receive_json()
                # Handle client commands (e.g., join project channel)
                if data.get('action') == 'join_project':
                    project_id = data.get('project_id')
                    # Subscribe to project channel
                    await pubsub.subscribe(f"channel:project:{project_id}")
            except:
                pass

    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
```

### Event Types

```python
# app/models/websocket_events.py
from enum import Enum
from pydantic import BaseModel

class EventType(str, Enum):
    PROGRESS = "progress"
    JOB_COMPLETE = "job_complete"
    JOB_FAILED = "job_failed"
    POSITION_UPDATED = "position_updated"
    DOCUMENT_UPLOADED = "document_uploaded"
    BUDGET_RECALCULATED = "budget_recalculated"
    CHAT_MESSAGE = "chat_message"
    NOTIFICATION = "notification"

class WSEvent(BaseModel):
    type: EventType
    data: dict
    timestamp: str
```

### Sending Events

```python
# From Celery task
@celery_app.task(bind=True)
def audit_project(self, project_id: str):
    # Send progress update
    await send_websocket_event(
        user_id=user_id,
        event=WSEvent(
            type=EventType.PROGRESS,
            data={
                "job_id": self.request.id,
                "progress": 0.35,
                "message": "Auditing position 15/53: Beton C30/37",
                "eta_seconds": 120
            },
            timestamp=datetime.utcnow().isoformat()
        )
    )
```

---

## Implementation Timeline

### Week 1 (Nov 6-13, 2025)

**Day 1-2: PostgreSQL Setup**
- [ ] Install PostgreSQL on Render.com
- [ ] Create database schema
- [ ] Write SQLAlchemy models
- [ ] Create migration scripts
- [ ] Test migrations with sample data

**Day 3: Redis Integration**
- [ ] Install Redis (Upstash free tier)
- [ ] Implement Redis client
- [ ] Add caching layer
- [ ] Implement session management

**Day 4-5: Celery Queue**
- [ ] Install Celery
- [ ] Define background tasks
- [ ] Configure queues (high/default/low)
- [ ] Test job execution

### Week 2 (Nov 13-20, 2025)

**Day 6-7: WebSocket**
- [ ] Implement WebSocket server
- [ ] Connection management
- [ ] Redis Pub/Sub integration
- [ ] Frontend WebSocket client

**Day 8-9: Integration**
- [ ] Update API routes to use PostgreSQL
- [ ] Implement dual-write for safety
- [ ] Testing with real data
- [ ] Performance optimization

**Day 10: Production Deploy**
- [ ] Deploy to Render.com
- [ ] Monitor performance
- [ ] Fix issues
- [ ] Documentation

---

## Rollback Strategy

**If PostgreSQL migration fails:**

```env
MIGRATION_MODE=files_only
MIGRATION_READ_FROM=files
```

**Rollback steps:**
1. Switch `MIGRATION_READ_FROM` to `files`
2. Disable PostgreSQL writes
3. Investigate issue
4. Fix problems
5. Re-enable PostgreSQL gradually

**Data safety:**
- Keep file-based backups for 30 days
- PostgreSQL daily backups
- Test rollback procedure before launch

---

## Testing Requirements

### Unit Tests
```python
# tests/test_db_models.py
import pytest
from app.models import Project, Position

@pytest.mark.asyncio
async def test_create_project():
    project = Project(
        user_id="test-user",
        name="Test Project",
        workflow="workflow_a"
    )
    assert project.status == "draft"
    assert project.progress == 0.0
```

### Integration Tests
```python
# tests/test_migration.py
@pytest.mark.asyncio
async def test_migrate_project():
    # Migrate sample project
    result = await migrate_project(sample_project_dir)

    # Verify data integrity
    async with async_session() as session:
        project = await session.get(Project, result.id)
        assert project.name == "Sample Project"
        assert len(project.positions) == 53
```

### Performance Tests
```python
# tests/test_performance.py
@pytest.mark.asyncio
async def test_query_performance():
    # Test that queries are fast
    start = time.time()
    projects = await get_user_projects(user_id)
    duration = time.time() - start

    assert duration < 0.2  # Must be < 200ms
```

---

## Configuration

### Environment Variables

```env
# PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/concrete_agent
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://default:password@host:6379
REDIS_MAX_CONNECTIONS=50

# Celery
CELERY_BROKER_URL=redis://host:6379/0
CELERY_RESULT_BACKEND=redis://host:6379/1
CELERY_WORKER_CONCURRENCY=4

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PING_INTERVAL=30
WEBSOCKET_PING_TIMEOUT=10

# Migration
MIGRATION_MODE=dual_write  # files_only, dual_write, postgres_only
MIGRATION_READ_FROM=postgres
MIGRATION_DUAL_WRITE=true
```

---

## Success Metrics

**After implementation:**

- ✅ API response time < 200ms (95th percentile)
- ✅ Support 100+ concurrent users
- ✅ Background jobs complete successfully
- ✅ Zero data loss during migration
- ✅ WebSocket latency < 50ms
- ✅ Cache hit rate > 60%
- ✅ Database queries < 50ms average
- ✅ 99.9% uptime

---

**Document Status:** ✅ Complete
**Next Steps:** Implement according to timeline
**Questions:** Contact dev team

---

**Last Updated:** 2025-11-06
**Author:** Claude Code (AI Development Assistant)
**Reviewed By:** [Pending]
