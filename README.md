# Concrete Agent 🏗️

> AI-powered Czech/Slovak construction cost estimation and audit system using Claude AI and GPT-4 Vision

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg)](https://fastapi.tiangolo.com)
[![Tests](https://img.shields.io/badge/tests-65%2F67%20passing-brightgreen.svg)](./tests)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

Concrete Agent is a production-ready construction management system that automates cost estimation, audit, and resource planning for Czech/Slovak construction projects. The system processes various document formats (XML, Excel, PDF), performs intelligent validation against construction standards databases (KROS, RTS, ČSN), and generates comprehensive technical deliverables.

### Key Features

- 🤖 **Dual Workflow Architecture**: Import existing estimates (Workflow A) or generate from drawings (Workflow B)
- 🔍 **Intelligent Audit System**: Multi-role expert validation with automatic GREEN/AMBER/RED classification
- 📊 **Smart Document Parsing**: XML (KROS/OTSKP), Excel, PDF with automatic fallback chains
- 📚 **Knowledge Base Integration**: 9 construction standards categories (B1-B9) with live enrichment
- ⚡ **Production-Ready**: Rate limiting, caching, artifact management, comprehensive testing
- 🌐 **RESTful API**: FastAPI with OpenAPI documentation and async support

## Quick Start

### Prerequisites

- Python 3.10 or higher
- pip package manager
- Claude API key (from [Anthropic](https://www.anthropic.com))
- Optional: OpenAI API key for Workflow B (drawing analysis)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/concrete-agent.git
cd concrete-agent

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

### Configuration

Create `.env` file with minimum required settings:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional (for Workflow B)
OPENAI_API_KEY=sk-xxxxx
ENABLE_WORKFLOW_B=true

# Optional (for live knowledge base)
PERPLEXITY_API_KEY=pplx-xxxxx
ALLOW_WEB_SEARCH=true
```

See [docs/CONFIG.md](docs/CONFIG.md) for complete configuration reference.

### Running the Application

```bash
# Development server with hot reload
uvicorn app.main:app --reload

# Production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_workflow_a_integration.py -v
```

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

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

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

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for complete troubleshooting guide.

## Documentation

- 📘 [System Design](docs/SYSTEM_DESIGN.md) - Complete technical specification
- 🏗️ [Architecture](ARCHITECTURE.md) - System architecture and patterns
- ⚙️ [Configuration](docs/CONFIG.md) - Environment variables and settings
- 🔌 [API Reference](docs/API.md) - Endpoint documentation
- 🔄 [Workflows](docs/WORKFLOWS.md) - Detailed workflow guides
- 🧪 [Testing](docs/TESTS.md) - Testing guide and examples
- 🤝 [Contributing](docs/CONTRIBUTING.md) - Development guidelines
- 📝 [CLAUDE.md](CLAUDE.md) - Claude Code integration guide

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/concrete-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/concrete-agent/discussions)
- **Email**: support@your-org.com

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Claude AI](https://www.anthropic.com/) - Document parsing and audit
- [GPT-4 Vision](https://openai.com/) - Drawing analysis
- [Pydantic](https://pydantic.dev/) - Data validation
- [Pytest](https://pytest.org/) - Testing framework

---

**Made with ❤️ for the construction industry**
