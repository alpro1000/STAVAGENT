# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Czech/Slovak construction cost estimation and audit system powered by AI (Claude and GPT-4 Vision). The system processes construction estimates (Výkaz výměr/Rozpočet), performs automated audits against KROS/RTS databases, and generates engineering deliverables like technical cards and resource schedules.

## Development Commands

### Run the application
```bash
# Development server with hot reload
python -m uvicorn app.main:app --reload

# Production server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Using the entry point directly
python app/main.py
```

### Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_workflow_a_integration.py

# Run with verbose output
pytest -v

# Run tests with coverage (requires pytest-cov)
pytest --cov=app --cov-report=html
```

### API Documentation
- Interactive docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

## Architecture Overview

### Two Main Workflows

**Workflow A (With Existing Estimate):**
1. Upload cost estimate (XML/Excel/PDF) + documentation
2. Parse and normalize positions using specialized parsers
3. Cache project state in `/data/projects/{project_id}.json`
4. User selects positions to analyze via UI
5. Audit positions against KROS/RTS knowledge base
6. Classify as GREEN/AMBER/RED based on confidence
7. Generate deliverables (tech cards, resource schedules, Excel reports)

**Workflow B (Generate from Drawings):**
1. Upload technical drawings (PDF/images)
2. GPT-4 Vision extracts dimensions and materials
3. Calculate quantities (concrete, reinforcement, formwork)
4. Claude generates KROS-coded positions
5. Validate and audit generated positions
6. Export estimate and tech cards

### Core Architecture Layers

**1. API Layer** (`app/api/`)
- `routes.py` - Main routes and health endpoints
- `routes_workflow_a.py` - Workflow A endpoints (/api/workflow/a/*)
- `routes_workflow_b.py` - Workflow B endpoints (/api/workflow/b/*)
- `pdf_extraction_routes.py` - PDF processing endpoints
- `routes_chat.py` - Chat/conversational endpoints
- `routes_agents.py` - Agent-based processing

**2. Service Layer** (`app/services/`)
- `workflow_a.py` - Orchestrates estimate import and audit pipeline
- `workflow_b.py` - Orchestrates drawing-based generation
- `position_enricher.py` - Enriches positions with KB data
- `audit_service.py` - Classifies positions (GREEN/AMBER/RED)
- `pdf_extraction_reasoner.py` - AI-based PDF understanding
- `project_cache.py` - Manages project state persistence

**3. Parser Layer** (`app/parsers/`)
- `kros_parser.py` - KROS XML (UNIXML/Table XML) with fallback strategies
- `pdf_parser.py` - PDF parsing (MinerU → pdfplumber → Claude fallback)
- `excel_parser.py` - Excel/CSV parsing with smart column detection
- `xc4_parser.py` - XC4 format handling
- Each parser implements fallback chains for robustness

**4. AI Clients** (`app/core/`)
- `claude_client.py` - Anthropic Claude API wrapper
- `gpt4_client.py` - OpenAI GPT-4 Vision client
- `perplexity_client.py` - Perplexity API for live KB search
- `nanonets_client.py` - Nanonets Document AI (optional)
- `mineru_client.py` - MinerU PDF parser (optional)
- `rate_limiter.py` - Token-based rate limiting across APIs

**5. Data Models** (`app/models/`)
- `position.py` - Position, PositionAudit, PositionResources, ResourceLabor/Equipment/Material
- `project.py` - Project metadata and state
- `enriched_position.py` - Enriched position with KB evidence
- `audit_result.py` - Audit classification results
- `drawing.py` - Drawing metadata

**6. Knowledge Base** (`app/knowledge_base/`)
- `B1_urs_codes/` - URS construction codes
- `B1_otkskp_codes/` - OTKSKP codes
- `B1_rts_codes/` - RTS codes
- `B2_csn_standards/` - Czech standards (ČSN)
- `B3_current_prices/` - Market pricing data
- `B4_production_benchmarks/` - Productivity rates
- `B5_tech_cards/` - Technical specification cards
- `B6_research_papers/` - Construction research
- `B7_regulations/` - Building regulations
- `B8_company_specific/` - Company-specific rules
- `B9_Equipment_Specs/` - Equipment specifications (pumps, cranes, excavators)

### Key Architectural Patterns

**Project Cache Pattern:**
All project state is persisted in `/data/projects/{project_id}/`:
- `project.json` - Main metadata (status, progress, timestamps)
- `artifacts/` - Generated outputs (tech cards, audit results)
- `raw/` - Original uploaded files

**Fallback Chain Pattern:**
Parsers implement multi-tier fallback strategies:
```
Primary Method → Fallback Method → AI-based Extraction → Failure with diagnostics
```

**Rate Limiting Pattern:**
All AI API calls go through `rate_limiter.py` to prevent quota exhaustion:
- Claude: 25k tokens/min
- GPT-4: 8k tokens/min
- Nanonets: 80 calls/min

**Enrichment Layer:**
Lightweight enrichment (`position_enricher.py`) matches positions against KB before full audit, improving accuracy and reducing API costs.

## Configuration

All configuration is in `app/core/config.py` and loaded from `.env`:

### Critical Settings
- `ANTHROPIC_API_KEY` - Required for Workflow A
- `OPENAI_API_KEY` - Required for Workflow B
- `PERPLEXITY_API_KEY` - Optional for live KB search
- `NANONETS_API_KEY` - Optional for enhanced parsing

### Feature Flags
- `ENABLE_WORKFLOW_A` - Enable/disable Workflow A (default: true)
- `ENABLE_WORKFLOW_B` - Enable/disable Workflow B (default: false)
- `ENABLE_KROS_MATCHING` - Enable KROS database matching (default: true)
- `ENRICHMENT_ENABLED` - Enable enrichment layer (default: true)
- `ALLOW_WEB_SEARCH` - Enable Perplexity live search (default: true)

### Parser Configuration
- `PRIMARY_PARSER` - "claude", "mineru", or "nanonets" (default: "claude")
- `FALLBACK_ENABLED` - Allow parser fallback chains (default: true)
- `PARSER_H_ENABLE` - Enable Task H normalization pipeline (default: true)

## Common Development Tasks

### Adding a New API Endpoint

1. Choose the appropriate router file in `app/api/`
2. Add endpoint function with FastAPI decorators
3. Update `app/api/__init__.py` if adding a new router
4. Document in OpenAPI schema (FastAPI auto-generates)

### Adding a New Parser

1. Create parser class in `app/parsers/`
2. Implement `parse()` method returning standardized format
3. Add fallback chain if needed
4. Register in parser factory/selector
5. Add tests in `tests/`

### Adding Knowledge Base Content

1. Identify correct B{N}_category directory in `app/knowledge_base/`
2. Add JSON/Markdown files with consistent structure
3. Update `metadata.json` in that category
4. KB loader (`app/core/kb_loader.py`) auto-loads on startup

### Modifying AI Prompts

Prompts are in `app/prompts/`:
- Claude prompts: `app/prompts/claude/{parsing,audit,generation}/`
- GPT-4 prompts: `app/prompts/gpt4/{vision,ocr}/`
- Load via `app/core/prompt_manager.py`

### Working with Project State

Use `app/services/project_cache.py` to load/save project state:
```python
from app.services.project_cache import load_project, save_project

project = load_project(project_id)
project['status'] = 'analyzing'
save_project(project_id, project)
```

Or use utility paths from `app/core/config.py`:
```python
from app.core.config import ArtifactPaths

audit_path = ArtifactPaths.audit_results(project_id)
enriched_path = ArtifactPaths.enriched_position(project_id, position_id)
```

## Important Implementation Details

### Position Normalization Pipeline (Task H)

The system normalizes positions through multiple stages:
1. Parse raw data from various formats
2. Unify column naming (handles Czech/English/Slovak variants)
3. Convert measurement units to standard forms
4. Clean and validate descriptions
5. Remove duplicates and commentary rows
6. Allocate to discipline buckets (HSV, PSV, M, etc.)

### Audit Classification Logic

Positions are classified by confidence and evidence:
- **GREEN** (≥95% confidence): High-quality match, proceed automatically
- **AMBER** (75-95% confidence): Reasonable match, may need review
- **RED** (<75% confidence): Poor match, requires human review (HITL)

Additional HITL triggers:
- Price deviation >15% from norm
- Conflict between expert roles (multi-role system)
- Missing critical fields

### PDF Text Recovery (Task F2)

PDF parser implements intelligent text extraction:
1. Try primary extraction (pdfplumber)
2. Check valid character ratio (default 60%)
3. Detect Private Use Area glyphs (indicates encoding issues)
4. Fallback to Poppler/pdftotext if needed
5. Queue for OCR if text extraction fails (max 5 pages)
6. Per-page timeouts prevent hanging on problematic PDFs

### Rate Limiter Token Estimation

When calling AI APIs through rate limiter, estimate tokens conservatively:
- Position audit: ~500 tokens
- Tech card generation: ~1500 tokens
- PDF parsing: ~2000 tokens per page
- Better to overestimate than hit limits

### Multi-Role Expert System

Advanced audit mode uses multiple expert personas:
- SME (Subject Matter Expert)
- ARCH (Architect)
- ENG (Engineer)
- SUP (Supervisor)

Classification severity determines which roles are consulted. Roles must reach consensus before finalizing classification.

## Testing Strategy

- Unit tests for parsers: `tests/test_*_parser.py`
- Integration tests for workflows: `tests/test_workflow_a_integration.py`
- End-to-end tests: `tests/test_workflow_a_e2e_numbers.py`
- Service tests: `tests/services/`
- Always test with real Czech/Slovak construction data when possible

## Debugging Tips

### Enable Verbose Logging
Set in `.env`:
```
LOG_LEVEL=DEBUG
LOG_CLAUDE_CALLS=true
LOG_GPT4_CALLS=true
```

Logs are written to:
- `logs/claude_calls/` - Claude API interactions
- `logs/gpt4_calls/` - GPT-4 API interactions
- `logs/perplexity_calls/` - Perplexity API interactions

### Check Project State
All project state is in `/data/projects/{project_id}/project.json` - read this to understand current workflow state.

### Check API Limits
```python
from app.core.rate_limiter import get_rate_limiter
stats = get_rate_limiter().get_usage_stats()
print(stats)
```

### Test Parsers Independently
```python
from app.parsers import KROSParser
parser = KROSParser(claude_client=claude)
result = parser.parse(Path("test.xml"))
```

## Code Style Notes

- Mixed Czech/English naming (domain terms in Czech, tech terms in English)
- Pydantic models for all data structures
- Async/await for I/O operations
- Type hints throughout (`from typing import ...`)
- Comments often in Czech for domain-specific logic
- FastAPI dependency injection patterns
