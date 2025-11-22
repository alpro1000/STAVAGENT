# concrete-agent: Core Backend System

**Status**: ✅ Production-Ready (Backend) | Legacy Frontend (Not Used)

**Role in StavAgent**: The backend core of the entire system. Handles document parsing, AI-powered analysis, multi-role audit, and construction knowledge base management.

**Part of**: [STAVAGENT Monorepo](../../docs/ARCHITECTURE.md)

---

## What is concrete-agent?

concrete-agent is a **Python FastAPI service** that powers document processing in the StavAgent system:

- 📄 **Parse documents**: PDF, Excel, XML, drawings → structured data
- 🤖 **AI analysis**: Use Claude, GPT-4 Vision, Perplexity for intelligent extraction
- ✅ **Audit & validate**: Multi-role consensus (4 expert perspectives: SME, Architect, Engineer, Supervisor)
- 🏗️ **Knowledge base**: 9 categories of Czech construction codes, prices, standards
- 📊 **Enrich data**: Match positions to KROS/RTS codes with confidence scoring
- 🔄 **Async processing**: Celery task queue + Redis caching for background jobs

**Technologies**:
- Framework: FastAPI (Python 3.10+)
- Database: PostgreSQL (SQLAlchemy 2.0, async)
- Cache/Queue: Redis, Celery
- AI: Anthropic Claude, OpenAI GPT-4 Vision, Perplexity API
- PDF Processing: MinerU, pdfplumber, Claude Vision
- Data: pandas, openpyxl, xlsxwriter

## Quick Start (Local Development)

### Prerequisites

- Python 3.10+
- PostgreSQL (or can use in-memory cache for testing)
- Redis (for task queue and caching)
- API keys: Anthropic Claude (required), OpenAI (optional for Workflow B)

### Installation

```bash
# 1. Clone the monorepo
git clone https://github.com/alpro1000/STAVAGENT.git
cd STAVAGENT/concrete-agent

# 2. Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
cd packages/core-backend
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API keys and database URLs
```

### Running the Service

```bash
# From /concrete-agent/packages/core-backend directory:

# Development server with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

**API will be available at**:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Running Tests

```bash
# All tests
pytest

# With coverage report
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_workflow_a_integration.py -v
```

---

## ✅ Important Notes

### Backend is Production-Ready
The **backend code in this directory is the core of StavAgent** and is fully operational. It MUST remain intact.

### Frontend in This Directory is Legacy
There is an **old frontend attempt** (`/packages/core-frontend`) in this repository:
- **Status**: Legacy, not maintained
- **Production Use**: NO - do not use in production
- **Actual Frontend**: Use `stavagent-portal` instead
- **Keep or Delete**: Can be kept for reference but is not part of the production system

---

## Architecture Overview

The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer (FastAPI)                  │
│  routes_workflow_a.py | routes_workflow_b.py | routes.py │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  workflow_a.py | workflow_b.py | audit_service.py        │
│  position_enricher.py | project_cache.py                 │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Parser Layer                           │
│  kros_parser.py | pdf_parser.py | excel_parser.py        │
│  (fallback chains: direct → external API → AI)          │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│            AI Clients & Knowledge Base                   │
│  claude_client.py | gpt4_client.py | kb_loader.py        │
│  rate_limiter.py | perplexity_client.py                  │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────┐
│  Portal, Mobile, API Clients    │
└────────────┬────────────────────┘
             │ HTTP/REST
┌────────────▼────────────────────┐
│ concrete-agent (FastAPI)        │
│ - Parsers                       │
│ - AI Clients                    │
│ - Workflows (A & B)             │
│ - Audit Service                 │
│ - Knowledge Base                │
└────────────┬────────────────────┘
             │
     ┌───────┴────────┬──────────┐
     ▼                ▼          ▼
 PostgreSQL      Redis        File Storage
 (Database)   (Cache/Queue)   (Projects)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed backend architecture.

---

## Workflows

### Workflow A: Import & Audit Existing Estimate

Process existing cost estimates (Výkaz výměr/Rozpočet) with automatic validation:

```bash
# Upload estimate document
curl -X POST "http://localhost:8000/api/workflow/a/upload" \
  -F "estimate_file=@estimate.xml" \
  -F "project_name=My Project"

# Response includes project_id and parsed positions
# → System automatically performs:
#   1. Parsing (XML/Excel/PDF)
#   2. Schema validation
#   3. KB enrichment
#   4. Multi-role audit
#   5. Classification (GREEN/AMBER/RED)
```

**Outputs**: Audit results with classification, tech cards, resource sheets, material analysis

### Workflow B: Generate from Technical Drawings

Generate cost estimates from architectural drawings (PDF/images):

```bash
# Upload technical drawings
curl -X POST "http://localhost:8000/api/workflow/b/upload" \
  -F "drawings=@floor_plan.pdf" \
  -F "project_name=New Building"

# System uses GPT-4 Vision to:
# 1. Extract dimensions and materials
# 2. Calculate quantities (concrete, reinforcement, formwork)
# 3. Generate KROS-coded positions
# 4. Validate against standards
```

**Outputs**: Generated estimate, technical calculations, material specifications

See [docs/WORKFLOWS.md](docs/WORKFLOWS.md) for detailed workflow documentation.

## Knowledge Base

The system includes 9 construction standards categories (auto-loaded at startup):

| Category | Description | Examples |
|----------|-------------|----------|
| **B1_urs_codes** | URS construction codes | KROS, OTSKP, RTS classification |
| **B2_csn_standards** | Czech national standards | ČSN EN 206, ČSN 73 2601 |
| **B3_current_prices** | Market pricing data | Material/labor costs, regional pricing |
| **B4_production_benchmarks** | Productivity rates | Labor hours per unit, equipment requirements |
| **B5_tech_cards** | Technical specification cards | Work procedures, safety requirements |
| **B6_research_papers** | Construction research | Best practices, innovations |
| **B7_regulations** | Building regulations | Legal requirements, compliance |
| **B8_company_specific** | Company rules | Internal standards, templates |
| **B9_Equipment_Specs** | Equipment specifications | Pumps, cranes, excavators |

Knowledge base supports runtime updates and live enrichment via Perplexity API.

## API Documentation

### Core Endpoints

```http
# Workflow A
POST   /api/workflow/a/upload           # Upload estimate
GET    /api/workflow/a/{project_id}     # Get project status
POST   /api/workflow/a/{project_id}/analyze  # Run analysis

# Workflow B
POST   /api/workflow/b/upload           # Upload drawings
GET    /api/workflow/b/{project_id}/results  # Get generated estimate

# Artifacts
GET    /api/workflow/a/{project_id}/tech-card      # Technical card
GET    /api/workflow/a/{project_id}/resource-sheet # Resource planning
GET    /api/workflow/a/{project_id}/materials      # Material analysis

# Utility
GET    /health                          # Health check
GET    /api/parse/formats              # Supported formats
POST   /api/parse/hybrid               # Multi-strategy parsing
```

See [docs/API.md](docs/API.md) for complete API reference with examples.

## Project Structure

```
concrete-agent/
├── app/
│   ├── api/              # FastAPI routes and endpoints
│   ├── core/             # AI clients, config, KB loader
│   ├── services/         # Business logic (workflows, audit)
│   ├── parsers/          # Document parsers with fallbacks
│   ├── models/           # Pydantic data models
│   ├── utils/            # Utilities (normalization, export)
│   ├── knowledge_base/   # B1-B9 construction standards
│   └── prompts/          # AI prompt templates
├── tests/                # Pytest test suite (67 tests)
├── docs/                 # Detailed documentation
│   ├── SYSTEM_DESIGN.md  # Technical specification
│   ├── CONFIG.md         # Configuration reference
│   ├── API.md            # API documentation
│   ├── WORKFLOWS.md      # Workflow details
│   └── TESTS.md          # Testing guide
├── data/                 # Runtime data (projects, artifacts)
└── logs/                 # API call logs (Claude, GPT-4, Perplexity)
```

## Development

### Code Quality

```bash
# Run linters
ruff check .
black .
mypy app/

# Run tests with coverage
pytest --cov=app --cov-report=html

# Generate API docs
python -m app.main  # Then visit /docs
```

### Adding New Parsers

1. Create parser class in `app/parsers/`
2. Implement `parse()` method returning standardized format
3. Add fallback chain if needed
4. Register in parser factory
5. Add tests in `tests/`

### Adding Knowledge Base Content

1. Identify correct B{N} category directory
2. Add JSON/Markdown files with consistent structure
3. Update `metadata.json` in category
4. KB loader auto-discovers on startup

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

## Testing

The project includes comprehensive test coverage (65/67 tests passing):

- **Unit tests**: Parsers, validators, utilities
- **Integration tests**: Workflow end-to-end scenarios
- **Service tests**: Audit classifier, enrichment
- **API tests**: Endpoint contracts

See [docs/TESTS.md](docs/TESTS.md) for testing guide and scenarios.

## Performance & Optimization

- **Rate Limiting**: Token-based limits for Claude (25k/min), GPT-4 (8k/min)
- **Caching**: Project-level caching with incremental updates
- **Parser Selection**: Automatic fallback chains (direct → API → AI)
- **Memory Efficient**: Streaming parsers for large documents
- **Batch Processing**: Parallel position analysis with rate limit management

## Troubleshooting

### Common Issues

**"No positions parsed from XML"**
```bash
# Try hybrid parsing
curl -X POST "http://localhost:8000/api/parse/hybrid" \
  -F "file=@estimate.xml" \
  -F "use_nanonets=true"
```

**"Rate limit exceeded"**
```python
# Check current usage
from app.core.rate_limiter import get_rate_limiter
stats = get_rate_limiter().get_usage_stats()
```

**"Workflow B not available"**
```env
# Enable in .env
ENABLE_WORKFLOW_B=true
OPENAI_API_KEY=sk-xxxxx
```

For more help, see [GitHub Issues](https://github.com/alpro1000/concrete-agent/issues).

## Documentation Map

**System-Level** (at STAVAGENT root):
- [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) - System overview (3 services)
- [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md) - Service API contracts
- [`/docs/LOCAL_SETUP.md`](../../docs/LOCAL_SETUP.md) - Local development setup
- [`/docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) - Render deployment

**concrete-agent Specific** (this service):
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Detailed backend architecture (read this next)
- `docs/MODULES.md` - Module breakdown (TODO)
- `docs/PARSERS.md` - Parser documentation (TODO)
- `docs/AI_INTEGRATION.md` - AI integration guide (TODO)
- `docs/WORKFLOWS.md` - Processing workflows (TODO)
- `docs/KNOWLEDGE_BASE.md` - KB structure (TODO)
- `docs/API_REFERENCE.md` - REST API endpoints (TODO)

---

## What's Next?

1. **Read system overview**: Start with [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) to understand how concrete-agent fits into StavAgent
2. **Understand the contract**: Read [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md) to see how this service communicates with portal and kiosks
3. **Read backend architecture**: See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detailed implementation details
4. **Try the API**: Open http://localhost:8000/docs in your browser after starting the service
5. **Explore code**: Start in `packages/core-backend/app/main.py` and follow the imports

---

## Integration with Other Services

**Portal calls concrete-agent for**:
- Document parsing and extraction
- Multi-role audit and validation
- Drawing analysis for quantity estimation

**Monolit-Planner can use concrete-agent for**:
- Advanced Excel parsing (fallback from local parser)
- Position enrichment with KROS codes
- Drawing analysis for initial estimations

See [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md) for detailed integration specifications.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **System Issues**: Report to [GitHub Issues](https://github.com/alpro1000/STAVAGENT/issues)
- **Documentation**: See [`/docs`](../../docs) for comprehensive guides

---

**Part of the StavAgent construction management system**
