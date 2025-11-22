# concrete-agent Backend Architecture

**Detailed architecture of the core processing system**

---

## Table of Contents

1. [Overview](#overview)
2. [5-Layer Architecture](#5-layer-architecture)
3. [Request Flow](#request-flow)
4. [Main Components](#main-components)
5. [Database Schema](#database-schema)
6. [Caching & Sessions](#caching--sessions)
7. [Task Queue](#task-queue)
8. [Error Handling](#error-handling)
9. [Future Enhancements](#future-enhancements)

---

## Overview

concrete-agent is built using a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────┐
│  HTTP Clients (Portal, Apps)    │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  API Layer (FastAPI routes)     │  ← Request validation, response formatting
├─────────────────────────────────┤
│  Service Layer (Workflows)      │  ← Business logic orchestration
├─────────────────────────────────┤
│  Parser Layer (Document parsing)│  ← Multiple parsers with fallback
├─────────────────────────────────┤
│  AI Clients & Knowledge Base    │  ← Claude, GPT-4, Perplexity, KB
├─────────────────────────────────┤
│  Data Layer (DB, Cache, Files)  │  ← Persistence
└─────────────────────────────────┘
```

---

## 5-Layer Architecture

### Layer 1: API Layer

**Location**: `/app/api`

**Responsibility**: HTTP request handling, input validation, response formatting.

**Key Files**:
- `main.py` - FastAPI application setup
- `routes.py` - Utility endpoints
- `routes_workflow_a.py` - Import & Audit workflow endpoints
- `routes_workflow_b.py` - Drawing analysis workflow endpoints
- `routes_chat.py` - Chat endpoints
- `pdf_extraction_routes.py` - PDF extraction endpoints
- `routes_multi_role.py` - Multi-role audit endpoints
- `routes_agents.py` - Agent-specific endpoints
- `routes_resources.py` - Resource management endpoints

**What Happens**:
1. FastAPI receives HTTP request
2. Pydantic validates request body
3. Route handler extracts data
4. Calls Service layer
5. Formats and returns response

**Example**:
```python
@router.post("/workflow/a/import")
async def import_document(
    files: List[UploadFile],
    project_id: str = None
):
    # Validate files
    # Call service
    # Return results
```

---

### Layer 2: Service Layer

**Location**: `/app/services`

**Responsibility**: Business logic, workflow orchestration, state management.

**Key Services**:

| Service | Purpose | Size |
|---------|---------|------|
| `workflow_a.py` | Import document → Parse → Enrich → Audit | 1,388 LOC |
| `workflow_b.py` | Drawing analysis → Quantity estimation | 724 LOC |
| `audit_service.py` | Multi-role expert voting | ~300 LOC |
| `position_enricher.py` | Match positions to KROS/RTS codes | ~250 LOC |
| `task_classifier.py` | Classify positions for workflow routing | ~478 LOC |
| `task_monitor.py` | Monitor Celery background tasks | ~347 LOC |
| `orchestrator.py` | Coordinate between parsers, AI, DB | ~400 LOC |
| Other services | Drawing analyzer, KB enrichment, etc. | ~500 LOC |

**Workflow A Example** (simplified):
```python
async def import_and_audit(files, project_id):
    # 1. Parse documents
    positions = await parse_documents(files)

    # 2. Validate positions
    validated = await validate_positions(positions)

    # 3. Enrich with KB
    enriched = await enrich_with_kros(validated)

    # 4. Multi-role audit
    audit_results = await perform_audit(enriched)

    # 5. Return results
    return {
        'positions': enriched,
        'audit': audit_results,
        'classification': compute_overall(audit_results)
    }
```

---

### Layer 3: Parser Layer

**Location**: `/app/parsers`

**Responsibility**: Convert documents into structured data (positions).

**Key Parsers**:

| Parser | Input | Fallback | Used By |
|--------|-------|----------|---------|
| `smart_parser.py` | Excel, CSV | AI analysis | Workflow A (primary) |
| `pdf_parser.py` | PDF | MinerU → pdfplumber → Claude Vision | Workflow B |
| `kros_parser.py` | KROS/RTS/OTSKP XML | Pattern matching → KB search | Position enrichment |
| `excel_parser.py` | XLSX (streaming) | Smart parser | Large files |
| `xc4_parser.py` | XC4 format | XML fallback | Legacy systems |
| `drawing_specs_parser.py` | Drawing specs | OCR | Workflow B |

**Parser Chain** (example - PDF):
```
PDF File
  ↓ Try MinerU (fast, local)
  ↓ On fail: Try pdfplumber (Python library)
  ↓ On fail: Use Claude Vision API (AI OCR)
  ↓ On fail: Return error with details
```

**Output Format** (all parsers):
```python
{
    'positions': [
        {
            'description': str,
            'quantity': float,
            'unit': str,
            'confidence': 0.0-1.0,
            'source_row': int,
            'otskp_code': str (optional)
        }
    ],
    'metadata': {
        'parser_used': str,
        'parsing_time_ms': int,
        'success_rate': float
    }
}
```

---

### Layer 4: AI Clients & Knowledge Base

**Location**: `/app/core` (clients) + `/app/knowledge_base` (KB)

**Responsibility**: AI model integration and knowledge base management.

**AI Clients**:

| Client | Purpose | When Used | Rate Limits |
|--------|---------|-----------|------------|
| `claude_client.py` | Document analysis, enrichment | Parse failures, enrichment | 25k tokens/min |
| `gpt4_client.py` | Drawing analysis via Vision API | Workflow B (drawing OCR) | 8k tokens/min |
| `perplexity_client.py` | Live web search for unknown codes | KB enrichment, fallback | Custom |

**Knowledge Base** (9 Categories):

| Category | Location | Purpose | Size |
|----------|----------|---------|------|
| B1_urs_codes | `/knowledge_base/B1_urs_codes/` | KROS, RTS, OTSKP codes | ~20k codes |
| B2_csn_standards | `/knowledge_base/B2_csn_standards/` | ČSN Czech standards | ~500 standards |
| B3_current_prices | `/knowledge_base/B3_current_prices/` | Labor, material costs | Regional |
| B4_production_benchmarks | `/knowledge_base/B4_production_benchmarks/` | Productivity rates | ~200 items |
| B5_tech_cards | `/knowledge_base/B5_tech_cards/` | Work procedures | ~300 cards |
| B7_regulations | `/knowledge_base/B7_regulations/` | Legal requirements | ~100 docs |
| B9_Equipment_Specs | `/knowledge_base/B9_Equipment_Specs/` | Equipment specs | ~50 items |

**KB Loading**:
```python
# At startup:
kb_loader = KBLoader(KB_DIR)
kb_index = kb_loader.load_all_categories()
# Loaded into memory for fast access
```

**KB Usage**:
```python
# In enrichment:
code = kb_index.search_kros("betonování základů")
# Returns: KROSCode(code='301 211', name='Betonování', price=...)
```

---

### Layer 5: Data Layer

**Location**: `/app/db` (database models) + File system + Cache

**Responsibility**: Persistence, caching, state storage.

**Database** (PostgreSQL):

```
┌─────────────────────────────┐
│  PostgreSQL 16              │
├─────────────────────────────┤
│ Tables:                     │
│ - users                     │ Auth & user management
│ - projects                  │ Project metadata
│ - documents                 │ Uploaded files
│ - positions                 │ Parsed work items
│ - audit_results             │ Expert audit votes
│ - chat_messages             │ Conversation logs
│ - background_jobs           │ Celery task tracking
│ - kb_cache                  │ Query results cache
│ - user_credentials          │ Encrypted API keys
└─────────────────────────────┘
```

**Cache** (Redis):

```
┌─────────────────────────────┐
│  Redis 5.0                  │
├─────────────────────────────┤
│ Keys:                       │
│ - project:{id}:state        │ Project processing state
│ - session:{token}           │ User session data (TTL 24h)
│ - kb_search:*               │ KB query cache (TTL 7d)
│ - rate_limit:*              │ Token bucket counters (TTL 1min)
└─────────────────────────────┘
```

**File System**:

```
/data/
├── projects/
│   └── {project_id}/
│       ├── raw/              ← Uploaded files
│       ├── processed/        ← Parsed data
│       └── artifacts/        ← Generated outputs
├── logs/
│   ├── claude_calls/        ← API call logs
│   └── gpt4_calls/
└── knowledge_base/          ← B1-B9 categories
```

---

## Request Flow

### Workflow A: Upload & Audit

```
1. User uploads file
   ↓
2. API: POST /workflow/a/import
   ├─ Validate file format
   ├─ Generate project_id
   └─ Call service.import_and_audit()
   ↓
3. Service Layer: import_and_audit()
   ├─ Call parser layer (smart_parser)
   ├─ Receive positions list
   ├─ Call enricher (match to KROS)
   ├─ Call audit_service (4-role vote)
   ├─ Save to database
   └─ Return results
   ↓
4. Parser: smart_parser.parse()
   ├─ Try pandas for Excel
   ├─ Try regex for CSV
   ├─ On fail: Call Claude API
   └─ Return normalized positions
   ↓
5. AI Client: claude_client.extract_positions()
   ├─ Format prompt with examples
   ├─ Call Claude API
   ├─ Parse JSON response
   └─ Return positions
   ↓
6. API: Return 200 OK
   {
     "processing_id": "uuid",
     "positions": [...],
     "audit_results": {...}
   }
```

### Workflow B: Drawing Analysis

```
1. User uploads drawing (PDF/JPG)
   ↓
2. API: POST /workflow/b/analyze_drawing
   ├─ Validate image format
   └─ Call service.analyze_drawing()
   ↓
3. Service: analyze_drawing()
   ├─ Call GPT-4 Vision (structure extraction)
   ├─ Call Claude (quantity calculation)
   ├─ Match to OTSKP codes
   └─ Return suggestions
   ↓
4. AI Clients:
   ├─ gpt4_client.extract_from_image()
   │   └─ Returns: dimensions, materials, layout
   ├─ claude_client.calculate_quantities()
   │   └─ Returns: concrete m³, rebar kg, formwork m²
   └─ perplexity_client.search_codes()
       └─ Returns: matching OTSKP codes
   ↓
5. API: Return 200 OK
   {
     "analysis": {...},
     "suggested_positions": [...]
   }
```

---

## Main Components

### Database Models (`/app/db/models`)

```python
# User Management
class User(Base):
    id: UUID
    email: str
    hashed_password: str
    roles: List[str]  # ["user", "admin"]
    created_at: DateTime

# Project Management
class Project(Base):
    id: UUID
    name: str
    owner_id: UUID
    status: str  # "draft", "processing", "completed"
    metadata: JSON
    created_at: DateTime

# Document Processing
class ProjectDocument(Base):
    id: UUID
    project_id: UUID
    filename: str
    file_path: str
    document_type: str  # "estimate", "drawing", etc.
    full_text: str  # For full-text search
    parsed_data: JSON

# Position Data
class Position(Base):
    id: UUID
    project_id: UUID
    description: str
    quantity: float
    unit: str
    confidence: float  # 0-1
    otskp_code: str (optional)
    enrichment_data: JSON

# Audit Results
class AuditResult(Base):
    id: UUID
    position_id: UUID
    role: str  # "sme", "architect", "engineer", "supervisor"
    classification: str  # "green", "amber", "red"
    score: float  # 0-1
    comment: str

# Background Jobs
class BackgroundJob(Base):
    id: UUID
    task_id: str  # Celery task ID
    project_id: UUID
    status: str  # "pending", "progress", "completed", "failed"
    progress: int  # 0-100
    result: JSON
    error: str (optional)
```

---

## Caching & Sessions

### Session Management

```python
# User logs in → JWT token created
token = jwt.encode({'user_id': user_id, 'exp': time+24h})

# Store in Redis for quick lookup
redis.set(f'session:{token}', user_data, ex=86400)

# On each request → Check session cache
user = redis.get(f'session:{token}')
if not user:
    raise Unauthorized()
```

### Knowledge Base Caching

```python
# On first KROS search
result = kb_index.search("betonování")  # Slow: ~500ms
redis.set('kb_search:betonování', result, ex=604800)  # Cache 7 days

# On next search
cached = redis.get('kb_search:betonování')  # Fast: <5ms
if cached:
    return cached
```

### Rate Limiting

```python
# Token bucket: limit Claude to 25k tokens/min
bucket = redis.get('rate_limit:claude')
if bucket.tokens_available >= tokens_needed:
    bucket.consume(tokens_needed)
else:
    raise RateLimitExceeded()
```

---

## Task Queue

**Celery + Redis for async processing:**

```python
# Long-running task registration
@celery.task
async def process_pdf_extraction(file_id, project_id):
    # Update DB: status = "processing"
    # Download file
    # Extract via MinerU
    # Save results
    # Update DB: status = "completed"

# Trigger from API (non-blocking)
task = process_pdf_extraction.delay(file_id, project_id)
# Immediately return: {"task_id": "uuid", "status": "pending"}

# Client polls for status
GET /status/{task_id}
# Returns: {"status": "processing", "progress": 45}
```

**Celery Tasks** (`/app/tasks`):
- `pdf_tasks.py` - PDF processing
- `audit_tasks.py` - Multi-role audit
- `enrichment_tasks.py` - Position enrichment
- `maintenance.py` - Cleanup, KB updates

---

## Error Handling

**Standard Error Response**:

```json
{
  "error": "parsing_failed",
  "message": "Could not extract text from PDF",
  "details": {
    "file_id": "uuid",
    "parsers_tried": ["mineru", "pdfplumber"],
    "suggestions": "Try converting to images or manually uploading XLSX"
  },
  "timestamp": "2025-11-22T10:30:00Z",
  "request_id": "req_123"
}
```

**Error Recovery**:
- Parser fails → Try next parser in chain
- API times out → Return partial results with status
- DB fails → Return 503 Service Unavailable
- Auth fails → Return 401 Unauthorized

---

## Future Enhancements

### TODO Items

**Planned**:
- [ ] Implement caching of parsed documents
- [ ] Add database connection pooling for high load
- [ ] Create batch processing API for bulk uploads
- [ ] Add webhook notifications for async processing
- [ ] Implement audit trail for all changes
- [ ] Add CSV export for audit results
- [ ] Performance monitoring dashboard

**Under Consideration**:
- [ ] GraphQL API as alternative to REST
- [ ] WebSocket for real-time status updates
- [ ] Streaming responses for large exports
- [ ] Multi-tenant support
- [ ] Role-based API access control

---

## References

- **Related Docs**:
  - [`README.md`](../README.md) - Service overview
  - [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md) - API contracts
  - [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) - System overview

---

**Created**: November 2025
**Last Updated**: November 2025
**Status**: Foundation document - implementation details may evolve
