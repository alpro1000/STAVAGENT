# Architecture - Concrete Agent

> System architecture overview: layers, modules, patterns, and workflows

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Layer Breakdown](#layer-breakdown)
3. [Architectural Patterns](#architectural-patterns)
4. [Workflow A Architecture](#workflow-a-architecture)
5. [Workflow B Architecture](#workflow-b-architecture)
6. [Data Flow](#data-flow)
7. [Module Dependencies](#module-dependencies)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION                             │
│                 Web UI | Mobile | API Clients                    │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER (FastAPI)                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ routes_workflow_ │  │ routes_workflow_ │  │ routes.py     │  │
│  │ a.py             │  │ b.py             │  │ (utilities)   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│  • Request validation (Pydantic)                                 │
│  • Response formatting                                           │
│  • HTTP status handling                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ workflow_a   │  │ workflow_b   │  │ audit_service          │ │
│  │ Orchestrates │  │ Orchestrates │  │ Multi-role validation  │ │
│  │ import &     │  │ drawing      │  │ GREEN/AMBER/RED        │ │
│  │ audit        │  │ generation   │  │ classification         │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ position_    │  │ project_     │                             │
│  │ enricher     │  │ cache        │                             │
│  │ KB matching  │  │ State mgmt   │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       PARSER LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ kros_parser  │  │ pdf_parser   │  │ excel_parser           │ │
│  │ UNIXML       │  │ pdfplumber → │  │ pandas/openpyxl        │ │
│  │ Table XML    │  │ MinerU →     │  │ Streaming for memory   │ │
│  │ XC4/OTSKP    │  │ Claude Vision│  │ efficiency             │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  • Fallback chains (3-tier)                                      │
│  • Schema normalization                                          │
│  • Format auto-detection                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                   AI CLIENTS & KNOWLEDGE BASE                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ claude_      │  │ gpt4_client  │  │ perplexity_client      │ │
│  │ client       │  │ Vision API   │  │ Live KB search         │ │
│  │ Document AI  │  │ Drawing OCR  │  │ Unknown norm lookup    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ kb_loader    │  │ rate_limiter │  │ nanonets_client        │ │
│  │ B1-B9 index  │  │ Token bucket │  │ Document AI (optional) │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ projects/    │  │ artifacts/   │  │ knowledge_base/        │ │
│  │ {id}.json    │  │ (outputs)    │  │ B1-B9 categories       │ │
│  │ State cache  │  │ Tech cards   │  │ KROS/RTS/ČSN codes     │ │
│  │              │  │ Reports      │  │ Pricing, benchmarks    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────────┐                                                │
│  │ logs/        │                                                │
│  │ API calls    │                                                │
│  │ Debug traces │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Communication

```
┌──────┐   HTTP    ┌──────┐   Call   ┌──────┐   Call   ┌──────┐   File I/O  ┌──────┐
│ API  │ ────────> │Service│ ───────> │Parser│ ───────> │ AI   │ ──────────> │ Data │
│Layer │           │Layer  │          │Layer │          │Client│             │Layer │
└──────┘           └──────┘          └──────┘          └──────┘             └──────┘
   ↓                  ↓                  ↓                 ↓                     ↓
Pydantic          Business          Document          AI API              File System
Validation        Logic             Parsing           Calls               + Cache
```

---

## Layer Breakdown

### 1. API Layer (FastAPI)

**Purpose**: HTTP interface, request/response handling, authentication

**Modules**:
```
app/api/
├── routes.py                 # Health checks, utility endpoints
├── routes_workflow_a.py      # Workflow A: Import & Audit
├── routes_workflow_b.py      # Workflow B: Generate from Drawings
├── pdf_extraction_routes.py  # PDF-specific endpoints
├── routes_chat.py            # Chat/conversational interface
└── routes_agents.py          # Agent-based processing
```

**Responsibilities**:
- Request validation using Pydantic models
- Response formatting (standardized `APIResponse`)
- HTTP status code management
- Error handling and user-friendly messages
- Authentication/authorization (if enabled)

**Key Patterns**:
- **Dependency Injection**: FastAPI's DI for shared resources
- **Request/Response Models**: Strong typing with Pydantic
- **Error Handlers**: Global exception handling

---

### 2. Service Layer

**Purpose**: Business logic orchestration, workflow coordination

**Modules**:
```
app/services/
├── workflow_a.py             # Orchestrate import & audit
├── workflow_b.py             # Orchestrate drawing generation
├── audit_service.py          # Multi-role audit logic
├── position_enricher.py      # KB enrichment
├── project_cache.py          # Project state management
└── pdf_extraction_reasoner.py # PDF analysis coordination
```

**Responsibilities**:
- Workflow state management
- Parser selection and fallback coordination
- KB lookup and enrichment
- Multi-role audit orchestration
- Artifact generation coordination
- Caching and performance optimization

**Key Patterns**:
- **Facade Pattern**: Simple interface for complex workflows
- **Strategy Pattern**: Dynamic parser/validator selection
- **State Machine**: Project status transitions
- **Cache-Aside**: Transparent caching layer

---

### 3. Parser Layer

**Purpose**: Document parsing with fallback strategies

**Modules**:
```
app/parsers/
├── kros_parser.py            # KROS XML (UNIXML, Table, XC4)
├── pdf_parser.py             # PDF (pdfplumber → MinerU → Claude)
├── excel_parser.py           # Excel/CSV (pandas)
├── xc4_parser.py             # XC4 format handler
└── memory_efficient.py       # Streaming parsers for large files
```

**Responsibilities**:
- Format detection (auto-detect XML/Excel/PDF)
- Document parsing (extract positions)
- Schema normalization (standardize field names)
- Fallback chain execution (primary → secondary → AI)
- Data cleaning and validation

**Fallback Strategy**:
```
┌──────────────┐  Fail   ┌──────────────┐  Fail   ┌──────────────┐
│ PRIMARY      │ ──────> │ FALLBACK 1   │ ──────> │ FALLBACK 2   │
│ Direct Parser│         │ External API │         │ AI Vision    │
│ (fast, free) │         │ (medium cost)│         │ (slow, $$$)  │
└──────────────┘         └──────────────┘         └──────────────┘
```

**Key Patterns**:
- **Chain of Responsibility**: Fallback chain
- **Factory Pattern**: Parser selection
- **Adapter Pattern**: Normalize different formats to common schema

---

### 4. AI Clients & Knowledge Base

**Purpose**: AI API integration, KB management, rate limiting

**Modules**:
```
app/core/
├── claude_client.py          # Anthropic Claude API
├── gpt4_client.py            # OpenAI GPT-4 Vision
├── perplexity_client.py      # Perplexity live search
├── nanonets_client.py        # Nanonets Document AI (optional)
├── mineru_client.py          # MinerU PDF parser (optional)
├── kb_loader.py              # Knowledge Base loader & indexer
└── rate_limiter.py           # Token-based rate limiting
```

**Knowledge Base Structure**:
```
app/knowledge_base/
├── B1_urs_codes/             # KROS, OTSKP, RTS codes
├── B2_csn_standards/         # Czech national standards
├── B3_current_prices/        # Market pricing data
├── B4_production_benchmarks/ # Productivity rates
├── B5_tech_cards/            # Technical specifications
├── B6_research_papers/       # Best practices
├── B7_regulations/           # Building regulations
├── B8_company_specific/      # Company rules
└── B9_Equipment_Specs/       # Equipment specifications
```

**Responsibilities**:
- AI API calls with retry logic
- Rate limiting (token bucket algorithm)
- KB loading and indexing at startup
- Runtime KB enrichment (Perplexity)
- Response caching
- Error recovery

**Key Patterns**:
- **Singleton**: KB loader (load once, use many times)
- **Token Bucket**: Rate limiting algorithm
- **Circuit Breaker**: Fail fast on repeated API errors
- **Cache-Aside**: Response caching

---

### 5. Data Layer

**Purpose**: Data persistence, artifact storage, logging

**Structure**:
```
data/
├── projects/
│   └── {project_id}/
│       ├── project.json      # Project metadata & state
│       └── artifacts/        # Generated outputs
│           ├── audit_results.json
│           ├── tech_cards/
│           ├── resource_sheets/
│           └── reports/
└── logs/
    ├── claude_calls/         # Claude API interaction logs
    ├── gpt4_calls/           # GPT-4 API interaction logs
    └── perplexity_calls/     # Perplexity API logs
```

**Responsibilities**:
- Project state persistence (JSON)
- Artifact generation and storage
- API call logging for debugging
- Cache management
- File cleanup and retention

**Key Patterns**:
- **Repository Pattern**: Abstract data access
- **Unit of Work**: Transactional updates
- **Write-Through Cache**: Immediate persistence

---

## Architectural Patterns

### 1. Fallback Chain Pattern

**Problem**: Document parsing is unreliable; single parser may fail

**Solution**: Try multiple parsers in sequence until success

```python
def parse_with_fallback(file_path: Path) -> List[Position]:
    """Parse with automatic fallback."""

    # Try primary parser
    try:
        return primary_parser.parse(file_path)
    except ParserError as e:
        logger.warning(f"Primary failed: {e}, trying fallback")

    # Try fallback 1
    try:
        return fallback_parser_1.parse(file_path)
    except ParserError as e:
        logger.warning(f"Fallback 1 failed: {e}, trying AI")

    # Try AI-based fallback
    return ai_parser.parse(file_path)  # Expensive but reliable
```

**Used In**:
- `pdf_parser.py` (pdfplumber → MinerU → Claude)
- `kros_parser.py` (direct → XC4 → generic)
- All parser modules

---

### 2. Cache-Aside Pattern

**Problem**: Repeated API calls are expensive and slow

**Solution**: Check cache first, populate on miss

```python
def get_position_enrichment(position: Position) -> Dict:
    """Get enrichment with caching."""

    cache_key = f"enrichment:{position.code}"

    # Check cache
    cached = cache.get(cache_key)
    if cached and is_valid(cached):
        return cached

    # Cache miss - fetch from KB/API
    enrichment = kb_loader.enrich_position(position)

    # Store in cache
    cache.set(cache_key, enrichment, ttl=3600)

    return enrichment
```

**Used In**:
- `position_enricher.py` (KB enrichment)
- `project_cache.py` (project state)
- `kb_loader.py` (code indices)
- Artifact generation (tech cards, reports)

---

### 3. Multi-Role Validation Pattern

**Problem**: Single AI perspective may miss issues

**Solution**: Multiple expert "roles" validate independently, then consensus

```python
def audit_position(position: Position, severity: str) -> AuditResult:
    """Multi-role audit with consensus."""

    # Select roles based on severity
    roles = select_roles(position, severity)
    # e.g., ["SME", "ARCH", "ENG", "SUP"]

    # Each role validates independently
    role_scores = {}
    for role in roles:
        score = validate_with_role(position, role)
        role_scores[role] = score

    # Calculate consensus
    avg_score = mean(role_scores.values())
    min_score = min(role_scores.values())
    consensus = (min_score >= avg_score * 0.9)

    # Classify
    if avg_score >= 0.95 and consensus:
        classification = "GREEN"
    elif avg_score >= 0.75 and consensus:
        classification = "AMBER"
    else:
        classification = "RED"

    return AuditResult(
        classification=classification,
        confidence=avg_score,
        role_scores=role_scores,
        consensus=consensus
    )
```

**Used In**:
- `audit_service.py` (position validation)

---

### 4. Rate Limiting (Token Bucket)

**Problem**: AI APIs have strict rate limits

**Solution**: Token bucket algorithm manages request pacing

```python
class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, tokens_per_minute: int):
        self.capacity = tokens_per_minute
        self.tokens = tokens_per_minute
        self.last_refill = time.time()

    def acquire(self, tokens: int) -> bool:
        """Acquire tokens (block if insufficient)."""

        # Refill bucket based on time elapsed
        self._refill()

        # Wait if insufficient tokens
        while self.tokens < tokens:
            time.sleep(0.1)
            self._refill()

        # Consume tokens
        self.tokens -= tokens
        return True

    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        refill = elapsed * (self.capacity / 60.0)

        self.tokens = min(self.capacity, self.tokens + refill)
        self.last_refill = now
```

**Usage**:
```python
# Before Claude API call
rate_limiter.acquire(estimate_tokens(prompt))
response = claude_client.call(prompt)
```

**Used In**:
- `rate_limiter.py` (global limiter)
- `claude_client.py`, `gpt4_client.py` (wrapped calls)

---

### 5. Project State Machine

**Problem**: Workflow has complex state transitions

**Solution**: Explicit state machine with valid transitions

```
┌──────────┐
│ CREATED  │
└──────────┘
     ↓
┌──────────┐
│ PARSING  │ ←───────┐ (retry)
└──────────┘         │
     ↓               │
┌──────────┐         │
│ PARSED   │ ────────┘ (error)
└──────────┘
     ↓
┌──────────┐
│ENRICHING │
└──────────┘
     ↓
┌──────────┐
│ AUDITING │
└──────────┘
     ↓
┌──────────┐
│ COMPLETE │
└──────────┘
```

**Transitions Enforced**:
```python
VALID_TRANSITIONS = {
    "created": ["parsing"],
    "parsing": ["parsed", "error"],
    "parsed": ["enriching", "error"],
    "enriching": ["auditing", "error"],
    "auditing": ["complete", "error"],
    "complete": [],
    "error": ["parsing"]  # Can retry
}
```

**Used In**:
- `project_cache.py` (state validation)
- `workflow_a.py`, `workflow_b.py` (state updates)

---

## Workflow A Architecture

### Sequence Diagram

```
┌──────┐  ┌─────┐  ┌─────────┐  ┌────────┐  ┌─────┐  ┌─────┐  ┌──────┐
│Client│  │ API │  │ Service │  │ Parser │  │ KB  │  │ AI  │  │ Data │
└──┬───┘  └──┬──┘  └────┬────┘  └───┬────┘  └──┬──┘  └──┬──┘  └───┬──┘
   │         │          │            │          │        │         │
   │ Upload  │          │            │          │        │         │
   │ XML File│          │            │          │        │         │
   ├────────>│          │            │          │        │         │
   │         │ Parse    │            │          │        │         │
   │         ├─────────>│ Detect     │          │        │         │
   │         │          │ Format     │          │        │         │
   │         │          ├───────────>│          │        │         │
   │         │          │            │ Parse    │        │         │
   │         │          │            │ XML      │        │         │
   │         │          │<───────────┤          │        │         │
   │         │          │ Normalize  │          │        │         │
   │         │          │ Schema     │          │        │         │
   │         │          │            │          │        │         │
   │         │          │ Enrich     │          │        │         │
   │         │          ├─────────────────────>│        │         │
   │         │          │            │  Lookup  │        │         │
   │         │          │            │  KROS    │        │         │
   │         │          │<───────────────────────┤        │         │
   │         │          │            │          │        │         │
   │         │          │ Audit      │          │        │         │
   │         │          ├───────────────────────────────>│         │
   │         │          │            │          │  Multi │         │
   │         │          │            │          │  Role  │         │
   │         │          │<───────────────────────────────┤         │
   │         │          │            │          │  GREEN │         │
   │         │          │ Save       │          │  /AMBER│         │
   │         │          │ Project    │          │  /RED  │         │
   │         │          ├────────────────────────────────────────>│
   │         │          │            │          │        │   Save  │
   │         │          │<────────────────────────────────────────┤
   │         │  Return  │            │          │        │         │
   │         │ Results  │            │          │        │         │
   │         │<─────────┤            │          │        │         │
   │<────────┤          │            │          │        │         │
   │ 200 OK  │          │            │          │        │         │
   │         │          │            │          │        │         │
```

### Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                      Workflow A Components                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  routes_workflow_a.py  ────>  workflow_a.py                     │
│         │                           │                            │
│         │                           ├──> kros_parser.py          │
│         │                           │    excel_parser.py         │
│         │                           │    pdf_parser.py           │
│         │                           │                            │
│         │                           ├──> position_enricher.py    │
│         │                           │         └──> kb_loader.py  │
│         │                           │                            │
│         │                           ├──> audit_service.py        │
│         │                           │         └──> claude_client │
│         │                           │              (multi-role)  │
│         │                           │                            │
│         │                           └──> project_cache.py        │
│         │                                   └──> data/projects/  │
│         │                                                         │
│         └──> Artifact Generation:                                │
│              ├──> tech_card.json                                 │
│              ├──> resource_sheet.json                            │
│              └──> audit_report.json                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow B Architecture

### Sequence Diagram

```
┌──────┐  ┌─────┐  ┌─────────┐  ┌──────┐  ┌─────┐  ┌──────┐
│Client│  │ API │  │ Service │  │ GPT4 │  │Claude│  │ Data │
└──┬───┘  └──┬──┘  └────┬────┘  └───┬──┘  └──┬──┘  └───┬──┘
   │         │          │            │        │         │
   │ Upload  │          │            │        │         │
   │Drawings │          │            │        │         │
   ├────────>│          │            │        │         │
   │         │ Extract  │            │        │         │
   │         ├─────────>│ Vision     │        │         │
   │         │          ├───────────>│        │         │
   │         │          │ Extract    │        │         │
   │         │          │ Dimensions │        │         │
   │         │          │ Materials  │        │         │
   │         │          │<───────────┤        │         │
   │         │          │ Calculate  │        │         │
   │         │          │ Quantities │        │         │
   │         │          │            │        │         │
   │         │          │ Generate   │        │         │
   │         │          │ KROS Codes │        │         │
   │         │          ├────────────────────>│         │
   │         │          │            │  Map   │         │
   │         │          │            │  to    │         │
   │         │          │            │  Codes │         │
   │         │          │<────────────────────┤         │
   │         │          │ Validate   │        │         │
   │         │          │ & Enrich   │        │         │
   │         │          │ (KB)       │        │         │
   │         │          │            │        │         │
   │         │          │ Save       │        │         │
   │         │          │ Estimate   │        │         │
   │         │          ├────────────────────────────>│
   │         │          │            │        │   Save  │
   │         │          │<────────────────────────────┤
   │         │  Return  │            │        │         │
   │         │ Estimate │            │        │         │
   │         │<─────────┤            │        │         │
   │<────────┤          │            │        │         │
   │ 200 OK  │          │            │        │         │
   │         │          │            │        │         │
```

### Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                      Workflow B Components                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  routes_workflow_b.py  ────>  workflow_b.py                     │
│         │                           │                            │
│         │                           ├──> gpt4_client.py          │
│         │                           │    (Vision API)            │
│         │                           │    Extract dimensions      │
│         │                           │    Identify materials      │
│         │                           │                            │
│         │                           ├──> Calculate quantities:   │
│         │                           │    • Concrete (m³)         │
│         │                           │    • Reinforcement (t)     │
│         │                           │    • Formwork (m²)         │
│         │                           │                            │
│         │                           ├──> claude_client.py        │
│         │                           │    Generate KROS codes     │
│         │                           │    Map to standards        │
│         │                           │                            │
│         │                           ├──> kb_loader.py            │
│         │                           │    Validate codes          │
│         │                           │    Enrich with norms       │
│         │                           │                            │
│         │                           └──> project_cache.py        │
│         │                                   └──> data/projects/  │
│         │                                                         │
│         └──> Artifact Generation:                                │
│              ├──> generated_estimate.json                        │
│              ├──> tech_cards/                                    │
│              └──> calculations.json                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Position Data Flow (Workflow A)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. RAW DOCUMENT (XML/Excel/PDF)                                 │
│    <Polozka>                                                     │
│      <Kod>121151113</Kod>                                       │
│      <Popis>Beton C30/37-XA2</Popis>                            │
│      <Mnozstvi>123.000</Mnozstvi>                               │
│    </Polozka>                                                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Parser
┌─────────────────────────────────────────────────────────────────┐
│ 2. PARSED POSITION (normalized)                                 │
│    {                                                             │
│      "code": "121151113",                                       │
│      "description": "Beton C30/37-XA2",                         │
│      "quantity": 123.0,                                         │
│      "unit": "m³"                                               │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Enricher
┌─────────────────────────────────────────────────────────────────┐
│ 3. ENRICHED POSITION (with KB data)                             │
│    {                                                             │
│      "code": "121151113",                                       │
│      "description": "Beton C30/37-XA2",                         │
│      "quantity": 123.0,                                         │
│      "unit": "m³",                                              │
│      "enrichment": {                                            │
│        "kros_name": "Beton konstrukční prostý",                 │
│        "norms": ["ČSN EN 206"],                                 │
│        "unit_price": 2850.0                                     │
│      }                                                           │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓ Auditor
┌─────────────────────────────────────────────────────────────────┐
│ 4. AUDITED POSITION (with classification)                       │
│    {                                                             │
│      "code": "121151113",                                       │
│      "description": "Beton C30/37-XA2",                         │
│      "quantity": 123.0,                                         │
│      "classification": "GREEN",                                 │
│      "confidence": 0.97,                                        │
│      "audit": {                                                 │
│        "roles": ["SME", "ENG"],                                 │
│        "evidence": [...],                                       │
│        "recommendations": [...]                                 │
│      },                                                          │
│      "resources": {                                             │
│        "labor": {...},                                          │
│        "materials": [...],                                      │
│        "equipment": [...]                                       │
│      }                                                           │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Dependencies

### Layer Dependency Map

```
┌──────────────────────────────────────────────────────────────┐
│                         API Layer                             │
│  Depends on: Service Layer, Models                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                       Service Layer                           │
│  Depends on: Parser Layer, AI Clients, KB, Models            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                       Parser Layer                            │
│  Depends on: AI Clients (fallback), Models, Utilities        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                   AI Clients & KB                             │
│  Depends on: Models, Config, Rate Limiter                    │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                       Data Layer                              │
│  Depends on: File System, Models                             │
└──────────────────────────────────────────────────────────────┘
```

### Cross-Layer Dependencies

| From → To | Dependency Type | Examples |
|-----------|----------------|----------|
| API → Service | Direct calls | `workflow_a.run_workflow()` |
| Service → Parser | Factory pattern | `get_parser(file_type)` |
| Service → AI | Client wrapper | `claude_client.call()` |
| Service → KB | Loader singleton | `kb_loader.enrich()` |
| Parser → AI | Fallback only | `claude_client.parse_pdf()` |
| AI → Rate Limiter | Pre-call check | `limiter.acquire(tokens)` |
| All → Models | Import | `from app.models import Position` |

### Circular Dependency Prevention

**Rule**: Lower layers cannot depend on upper layers

✅ **Allowed**:
- API → Service → Parser → AI
- Service → KB
- Parser → AI (fallback)

❌ **Forbidden**:
- Parser → Service
- AI → Service
- KB → Parser

**Enforcement**:
- Code review guidelines
- Import linting (optional: `import-linter`)

---

## Performance Characteristics

### Latency by Layer

| Layer | Operation | Avg Latency | Notes |
|-------|-----------|-------------|-------|
| **API** | Request validation | <5ms | Pydantic validation |
| **Service** | Workflow orchestration | ~100ms | Coordination overhead |
| **Parser** | KROS XML (100 pos) | ~3s | Direct parsing |
| **Parser** | PDF (10 pages) | ~22s | Multi-tier fallback |
| **AI** | Claude call (audit) | ~2s | Network + inference |
| **AI** | GPT-4 Vision (drawing) | ~8s | Vision inference |
| **KB** | Code lookup | <50ms | In-memory index |
| **Data** | Project save | ~100ms | File I/O |

### Bottleneck Analysis

**Primary Bottlenecks**:
1. **AI API Calls** (rate-limited, network latency)
   - Mitigation: Caching, batching, parallel processing
2. **PDF Parsing** (complex layouts, OCR fallback)
   - Mitigation: Streaming, page-by-page processing
3. **Large File Uploads** (network bandwidth)
   - Mitigation: Chunked uploads, compression

---

## Deployment Architecture

### Single-Instance Deployment

```
┌─────────────────────────────────────────────────────┐
│                    Docker Container                  │
│  ┌────────────────────────────────────────────────┐ │
│  │         FastAPI Application (Uvicorn)          │ │
│  │  • API Layer                                   │ │
│  │  • Service Layer                               │ │
│  │  • Parser Layer                                │ │
│  │  • AI Clients                                  │ │
│  │  • KB Loader (in-memory)                       │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │              File System                       │ │
│  │  • /data/projects/                             │ │
│  │  • /data/artifacts/                            │ │
│  │  • /logs/                                      │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                    ↕
              External APIs:
              • Anthropic Claude
              • OpenAI GPT-4
              • Perplexity
```

### Scaled Deployment (Future)

```
┌─────────────────┐
│  Load Balancer  │
└─────────────────┘
        ↓
   ┌────┴────┬────────────┬────────────┐
   ↓         ↓            ↓            ↓
┌─────┐  ┌─────┐      ┌─────┐      ┌─────┐
│API  │  │API  │      │API  │      │API  │
│Node1│  │Node2│      │Node3│      │Node4│
└─────┘  └─────┘      └─────┘      └─────┘
   ↓         ↓            ↓            ↓
   └────┬────┴────────────┴────────────┘
        ↓
   ┌─────────┐
   │  Redis  │  (shared cache)
   └─────────┘
        ↓
   ┌─────────┐
   │PostgreSQL│ (shared state)
   └─────────┘
        ↓
   ┌─────────┐
   │ S3/Blob │  (shared artifacts)
   └─────────┘
```

---

## Summary

### Key Architectural Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Layered Architecture** | Clear separation of concerns | Slight overhead from layers |
| **Fallback Chains** | Robustness over single point of failure | Increased complexity |
| **Multi-Role Audit** | Comprehensive validation | Higher AI API costs |
| **In-Memory KB** | Fast lookups | Memory usage (~200MB) |
| **File-Based State** | Simple deployment | Not suitable for multi-instance |
| **Rate Limiting** | Prevent quota exhaustion | May slow down batch processing |
| **Pydantic Models** | Strong typing & validation | Slight serialization overhead |

### Design Principles Applied

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Inversion**: Depend on abstractions, not concretions
3. **Open/Closed**: Open for extension (new parsers), closed for modification
4. **Interface Segregation**: Small, focused interfaces
5. **DRY**: Shared utilities, no code duplication
6. **YAGNI**: No speculative features, implement what's needed

### Future Enhancements

- [ ] Redis for distributed caching
- [ ] PostgreSQL for multi-instance state
- [ ] Message queue for async processing (RabbitMQ/Redis)
- [ ] Horizontal scaling with load balancer
- [ ] GraphQL API as alternative to REST
- [ ] WebSocket for real-time progress updates

---

**Document Version**: 1.0
**Last Updated**: 2024-10-26
**Author**: Concrete Agent Team
