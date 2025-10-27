# CLAUDE.md

> Guidelines for Claude Code (claude.ai/code) when working with this repository

**Version:** 2.0.0
**Last updated:** 2025-01-26

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [Development Commands](#development-commands)
5. [Documentation Structure](#documentation-structure)
6. [Coding Standards](#coding-standards)
7. [Git Workflow](#git-workflow)
8. [Modular Changes](#modular-changes)
9. [Testing Strategy](#testing-strategy)
10. [Common Tasks](#common-tasks)
11. [Debugging](#debugging)

---

## Project Overview

**Concrete Agent** is a Czech/Slovak construction cost estimation and audit system powered by AI (Claude and GPT-4 Vision). The system processes construction estimates (Výkaz výměr/Rozpočet), performs automated audits against KROS/RTS databases, and generates engineering deliverables.

### Key Features

- **Workflow A**: Import existing estimates → Parse → Validate → Enrich → Audit → Export
- **Workflow B**: Upload drawings → Extract specs → Calculate quantities → Generate positions → Audit
- **Multi-role AI audit**: SME, ARCH, ENG, SUP expert consensus
- **Knowledge base**: KROS, RTS, ČSN standards, company rules
- **Deliverables**: Tech cards, resource schedules, Excel reports

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI (Python 3.10+) |
| **AI** | Claude (Anthropic), GPT-4 Vision (OpenAI) |
| **Database** | KROS/RTS databases (JSON) |
| **Testing** | pytest, pytest-asyncio |
| **API Docs** | OpenAPI (Swagger) |

---

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```env
# Required for Workflow A
ANTHROPIC_API_KEY=sk-ant-...

# Required for Workflow B
OPENAI_API_KEY=sk-...

# Optional
PERPLEXITY_API_KEY=pplx-...
ENVIRONMENT=development
```

### 3. Run Application

```bash
# Development (hot reload)
python -m uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 4. Access API Docs

- Interactive: http://localhost:8000/docs
- Alternative: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

---

## Architecture Overview

### Two Main Workflows

**Workflow A (Import & Audit):**

```
Upload → Parse → Validate → Enrich → Audit → Export
  ↓        ↓        ↓          ↓        ↓        ↓
 XML/    Smart   Pydantic   KROS    Multi-   Excel
Excel   Parser   Schema    Match    Role     Report
```

**Reference:** [WORKFLOWS.md](docs/WORKFLOWS.md)

**Workflow B (Generate from Drawings):**

```
Upload → Analyze → Calculate → Generate → Audit → Export
  ↓         ↓          ↓           ↓        ↓        ↓
 PDF     GPT-4    Concrete/   Claude   Multi-   Excel
Drawing  Vision   Rebar Qty   KROS     Role    Report
```

**Reference:** [WORKFLOWS.md](docs/WORKFLOWS.md)

### Core Architecture Layers

**5-Layer Architecture:**

```
┌─────────────────────────────────────────┐
│ 1. API Layer (FastAPI)                  │ ← routes.py, routes_workflow_a.py
├─────────────────────────────────────────┤
│ 2. Service Layer                        │ ← workflow_a.py, audit_service.py
├─────────────────────────────────────────┤
│ 3. Parser Layer                         │ ← kros_parser.py, excel_parser.py
├─────────────────────────────────────────┤
│ 4. AI Layer                             │ ← claude_client.py, gpt4_client.py
├─────────────────────────────────────────┤
│ 5. Data Layer (KB + Models)             │ ← knowledge_base/, models/
└─────────────────────────────────────────┘
```

**Reference:** [ARCHITECTURE.md](ARCHITECTURE.md)

**Key directories:**

```
app/
├── api/                    # Layer 1: API routes
├── services/               # Layer 2: Business logic
├── parsers/                # Layer 3: Document parsing
├── core/                   # Layer 4: AI clients, config
├── models/                 # Layer 5: Pydantic models
├── knowledge_base/         # Layer 5: KB (B1-B9)
└── utils/                  # Shared utilities

tests/                      # 67 tests (97% pass rate)
docs/                       # Complete documentation
data/                       # Project files (gitignored)
```

### Architectural Patterns

**1. Fallback Chain Pattern:**

```python
Primary Parser → Fallback Parser → AI Extraction → Diagnostics
```

All parsers implement multi-tier fallback for robustness.

**Reference:** [ARCHITECTURE.md](ARCHITECTURE.md#fallback-chain-pattern)

**2. Cache-Aside Pattern:**

```python
Check cache → If miss, generate → Store in cache → Return
```

Project state cached in `data/projects/{project_id}/`.

**Reference:** [ARCHITECTURE.md](ARCHITECTURE.md#cache-aside-pattern)

**3. Multi-Role Validation:**

```python
Position → [SME, ARCH, ENG, SUP] → Consensus → GREEN/AMBER/RED
```

**Reference:** [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md#multi-role-expert-system)

**4. Rate Limiting (Token Bucket):**

All AI API calls go through `rate_limiter.py`:
- Claude: 25k tokens/min
- GPT-4: 8k tokens/min

**Reference:** [ARCHITECTURE.md](ARCHITECTURE.md#rate-limiting-pattern)

---

## Development Commands

### Running the Application

```bash
# Development (hot reload)
python -m uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Direct entry point
python app/main.py

# Custom port
uvicorn app.main:app --port 8001
```

### Testing

```bash
# Run all tests (67 tests, ~17 seconds)
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_imports.py

# Run specific test
pytest tests/test_imports.py::test_config_import

# Run by pattern
pytest -k "workflow_a"

# Run with coverage (requires pytest-cov)
pip install pytest-cov
pytest --cov=app --cov-report=html

# Exclude failing tests
pytest --ignore=tests/test_workflow_a_artifacts.py

# Stop on first failure
pytest -x

# Show print statements
pytest -s
```

**Reference:** [TESTS.md](docs/TESTS.md)

### Git Commands

```bash
# Check status
git status

# Stage files
git add <file>

# Commit with conventional format
git commit -m "feat: add new parser for XC4 format"

# Push to remote
git push origin master

# View commit history
git log --oneline -10
```

**Reference:** [Git Workflow](#git-workflow)

### Linting & Formatting

```bash
# (Not configured - add if needed)
# flake8 app/
# black app/
# mypy app/
```

---

## Documentation Structure

### Primary Documentation Files

All documentation is comprehensive and cross-referenced:

| File | Purpose | Lines | Last Updated |
|------|---------|-------|--------------|
| **[README.md](README.md)** | Project overview, quickstart | 450+ | 2025-01-26 |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | 5-layer architecture, patterns | 800+ | 2025-01-26 |
| **[docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)** | Technical specification | 1200+ | 2025-01-26 |
| **[docs/CONFIG.md](docs/CONFIG.md)** | Configuration reference | 600+ | 2025-01-26 |
| **[docs/API.md](docs/API.md)** | All 27+ API endpoints | 2230 | 2025-01-26 |
| **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)** | Step-by-step workflows | 1351 | 2025-01-26 |
| **[docs/TESTS.md](docs/TESTS.md)** | Testing guide | 1706 | 2025-01-26 |
| **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** | Contributor guidelines | - | 2025-01-26 |
| **[CLAUDE.md](CLAUDE.md)** | Claude Code guidelines | This file | 2025-01-26 |

### When to Update Documentation

**IMPORTANT:** Always update relevant documentation when making changes:

| Change Type | Update These Docs |
|-------------|-------------------|
| New API endpoint | API.md |
| New workflow step | WORKFLOWS.md |
| New test | TESTS.md |
| New config option | CONFIG.md |
| New architecture pattern | ARCHITECTURE.md |
| New feature | README.md + SYSTEM_DESIGN.md |

### Documentation Cross-References

Always add cross-references between related docs:

```markdown
**Reference:** [WORKFLOWS.md](docs/WORKFLOWS.md#workflow-a-step-4)
**See also:** [API.md](docs/API.md#post-apiworkflowaenrich)
```

---

## Coding Standards

### Python Style

**1. Type Hints (Required):**

```python
# ✅ Good
def enrich_position(position: dict, kb_loader: KBLoader) -> dict:
    enriched: dict = position.copy()
    return enriched

# ❌ Bad
def enrich_position(position, kb_loader):
    enriched = position.copy()
    return enriched
```

**2. Async/Await (Required for I/O):**

```python
# ✅ Good
@router.post("/api/workflow/a/{project_id}/audit")
async def audit_project(project_id: str) -> dict:
    result = await workflow_a.run(project_id, action="audit")
    return result

# ❌ Bad (blocking I/O)
@router.post("/api/workflow/a/{project_id}/audit")
def audit_project(project_id: str) -> dict:
    result = workflow_a.run_sync(project_id, action="audit")  # Blocks event loop!
    return result
```

**3. Pydantic Models (Required for Data):**

```python
# ✅ Good
from pydantic import BaseModel, Field

class Position(BaseModel):
    code: str = Field(..., description="KROS code")
    description: str
    quantity: float = Field(gt=0)
    unit: str

# ❌ Bad (untyped dicts)
position = {
    "code": "121151113",
    "description": "Beton C30/37",
    "quantity": 10.5,
    "unit": "m3"
}
```

**4. Error Handling (Specific Exceptions):**

```python
# ✅ Good
try:
    result = parser.parse(file_path)
except FileNotFoundError:
    logger.error(f"File not found: {file_path}")
    raise HTTPException(status_code=404, detail="File not found")
except ValueError as e:
    logger.error(f"Invalid file format: {e}")
    raise HTTPException(status_code=400, detail="Invalid format")

# ❌ Bad (bare except)
try:
    result = parser.parse(file_path)
except:  # Too broad!
    raise HTTPException(status_code=500, detail="Error")
```

**5. Naming Conventions:**

```python
# Domain terms in Czech, tech terms in English
class VykazVymerParser:  # Czech: "bill of quantities"
    def parse(self, file_path: Path) -> dict:  # English: technical
        pozice = self._extract_positions()  # Czech: "positions"
        return {"positions": pozice}  # Mixed
```

**6. Comments (Czech for Domain Logic):**

```python
def classify_position(position: dict) -> str:
    # Klasifikace podle normy ČSN 73 1201
    if position["beton_trida"] >= "C30/37":
        return "GREEN"  # Vysoká kvalita betonu
    return "AMBER"  # Vyžaduje kontrolu
```

### File Structure Standards

**1. Import Order:**

```python
# 1. Standard library
import json
from pathlib import Path
from typing import Optional, List

# 2. Third-party
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# 3. Local (absolute imports)
from app.core.config import settings
from app.services.workflow_a import workflow_a
from app.models.position import Position
```

**2. Module Docstrings:**

```python
"""
Module for KROS UNIXML parsing with fallback strategies.

This parser handles Czech construction estimates in KROS format.
Implements multi-tier fallback: UNIXML → Table XML → Claude AI.

Reference: docs/SYSTEM_DESIGN.md#kros-parsing
"""
```

**3. Function Docstrings:**

```python
def enrich_position(position: dict, kb_loader: KBLoader) -> dict:
    """
    Enrich position with KROS/RTS database information.

    Args:
        position: Position dict with code, description, unit, quantity
        kb_loader: Knowledge base loader instance

    Returns:
        Enriched position dict with match, score, evidence

    Raises:
        ValueError: If position missing required fields

    Reference: docs/WORKFLOWS.md#workflow-a-step-4
    """
    ...
```

---

## Git Workflow

### Conventional Commits

**Format:** `<type>(<scope>): <subject>`

**Types:**

| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat(parser): add XC4 format support` |
| `fix` | Bug fix | `fix(audit): correct price deviation logic` |
| `docs` | Documentation | `docs: update WORKFLOWS.md with diagrams` |
| `test` | Tests | `test: add E2E test for Workflow B` |
| `refactor` | Code refactor | `refactor(enricher): simplify matching logic` |
| `perf` | Performance | `perf(parser): optimize XML parsing` |
| `chore` | Maintenance | `chore: update dependencies` |

**Examples:**

```bash
# Good commit messages
git commit -m "feat(api): add endpoint for tech card generation"
git commit -m "fix(parser): handle European number format (1 200,50)"
git commit -m "docs: add business-critical test scenarios to TESTS.md"
git commit -m "test(security): add path traversal attack tests"

# Bad commit messages
git commit -m "updates"
git commit -m "fix bug"
git commit -m "WIP"
```

### Commit Body Format

For complex changes, use multi-line commits:

```bash
git commit -m "$(cat <<'EOF'
feat(audit): implement multi-role expert consensus

- Add SME, ARCH, ENG, SUP expert roles
- Implement consensus algorithm
- Add conflict resolution logic
- Update classification thresholds

BREAKING CHANGE: Audit API now requires role_config parameter

Reference: docs/SYSTEM_DESIGN.md#multi-role-expert-system

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Branch Strategy

**Current:** Single `master` branch (simple project)

**For larger teams, consider:**

```
master (production)
  ├── develop (integration)
  │   ├── feature/workflow-b-improvements
  │   ├── feature/new-parser-xc5
  │   └── fix/audit-classification-bug
  └── hotfix/critical-security-patch
```

---

## Modular Changes

### Principle: Small, Focused Changes

**✅ Good:** One logical change per commit

```bash
# Commit 1: Add parser
git add app/parsers/xc5_parser.py
git commit -m "feat(parser): add XC5 format parser"

# Commit 2: Add tests
git add tests/test_xc5_parser.py
git commit -m "test(parser): add XC5 parser unit tests"

# Commit 3: Update docs
git add docs/SYSTEM_DESIGN.md
git commit -m "docs: add XC5 parser to SYSTEM_DESIGN.md"
```

**❌ Bad:** Multiple unrelated changes

```bash
# DON'T DO THIS
git add app/parsers/xc5_parser.py \
        app/services/workflow_a.py \
        tests/test_xc5_parser.py \
        docs/API.md \
        docs/WORKFLOWS.md
git commit -m "updates"
```

### When to Combine Changes

**Acceptable to combine when tightly coupled:**

```bash
# OK: Interface change requires updating implementation
git add app/models/position.py app/services/enricher.py
git commit -m "refactor(models): change Position.enrichment to nested dict"
```

### File-Level Changes

**1. New File:** Full implementation in one commit

```bash
git add app/parsers/new_parser.py
git commit -m "feat(parser): add NewParser with fallback chain"
```

**2. Modify Existing:** Focused changes only

```python
# ✅ Good: Single responsibility change
def enrich_position(position: dict) -> dict:
    # Add new field
    position["confidence_score"] = calculate_confidence(position)
    return position

# ❌ Bad: Multiple unrelated changes
def enrich_position(position: dict) -> dict:
    # Add confidence score
    position["confidence_score"] = calculate_confidence(position)
    # Also refactor validation (should be separate commit!)
    position = validate_position(position)
    # Also add logging (should be separate commit!)
    logger.info(f"Enriched: {position['code']}")
    return position
```

### Testing Changes

**Always add tests for new code:**

```bash
# 1. Write code
git add app/services/new_feature.py
git commit -m "feat(service): add new feature"

# 2. Write tests
git add tests/test_new_feature.py
git commit -m "test(service): add tests for new feature"

# 3. Update docs
git add docs/SYSTEM_DESIGN.md
git commit -m "docs: document new feature in SYSTEM_DESIGN.md"
```

---

## Testing Strategy

### Test Categories (7 types)

| Category | Count | Purpose | Reference |
|----------|-------|---------|-----------|
| **Import** | 6 | CI/CD validation | tests/test_imports.py |
| **Integration** | 5 | Component interaction | tests/test_workflow_a_integration.py |
| **E2E** | 1 | Full pipeline | tests/test_workflow_a_e2e_numbers.py |
| **API** | 2 | REST endpoints | tests/test_workflow_a_artifacts.py |
| **Security** | 13 | Path traversal, etc. | tests/test_file_security.py |
| **Parser** | 12 | Document parsing | tests/test_*_parser.py |
| **Service** | 15 | Business logic | tests/test_*_enricher.py |

**Total:** 67 tests (65 passing, 2 failing, 97% pass rate)

**Reference:** [TESTS.md](docs/TESTS.md)

### Test Structure (AAA Pattern)

```python
def test_position_enrichment():
    # ARRANGE: Set up test data
    position = {"code": "121151113", "description": "Beton C30/37"}
    enricher = PositionEnricher(kb_loader=dummy_kb)

    # ACT: Execute operation
    result = enricher.enrich(position)

    # ASSERT: Verify outcome
    assert result["enrichment_status"] == "matched"
    assert result["unit_price"] > 0
    assert result["enrichment"]["match"] == "exact"
```

### Mock Patterns

**1. AsyncMock for Async Functions:**

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_workflow_execution():
    with patch.object(WorkflowA, 'execute', new_callable=AsyncMock) as mock:
        mock.return_value = {"success": True}
        result = await workflow_a.run(project_id="test-123")
    assert result["success"] is True
```

**2. TestClient for FastAPI:**

```python
from fastapi.testclient import TestClient
from app.main import app

def test_upload_endpoint():
    client = TestClient(app)
    response = client.post("/api/upload", files={"file": ...})
    assert response.status_code == 200
```

**3. tmp_path for Files:**

```python
def test_excel_export(tmp_path):
    output_file = tmp_path / "output.xlsx"
    exporter.export(data, output_file)
    assert output_file.exists()
    # Cleanup automatic
```

**Reference:** [TESTS.md](docs/TESTS.md#mock-structures)

### Business-Critical Tests

**⭐⭐⭐⭐⭐ Must always pass:**

1. **Complete Workflow A Pipeline** (test_workflow_a_e2e_numbers.py)
   - 53 positions → Parse → Validate → Enrich → Audit → Export
   - European number format handling
   - GREEN/AMBER/RED classification

2. **Security: No Server Path Leakage** (test_file_security.py)
   - 13 tests covering upload, download, listing
   - Path traversal attack prevention

3. **KROS/OTSKP Position Enrichment** (test_position_enricher.py)
   - Exact/partial/no match strategies
   - Confidence scoring

**Reference:** [TESTS.md](docs/TESTS.md#business-critical-scenarios)

---

## Common Tasks

### 1. Adding a New API Endpoint

**Steps:**

1. Choose router file in `app/api/`
2. Add endpoint function
3. Update `app/api/__init__.py` if new router
4. Add tests in `tests/`
5. Update `docs/API.md`

**Example:**

```python
# app/api/routes_workflow_a.py
@router.post("/api/workflow/a/{project_id}/custom-action")
async def custom_action(project_id: str) -> dict:
    """
    Perform custom action on project.

    Reference: docs/WORKFLOWS.md#custom-action
    """
    result = await workflow_a.run(project_id, action="custom")
    return result
```

**Reference:** [API.md](docs/API.md)

### 2. Adding a New Parser

**Steps:**

1. Create `app/parsers/new_parser.py`
2. Implement `parse()` method
3. Add fallback chain
4. Add tests in `tests/test_new_parser.py`
5. Update `docs/SYSTEM_DESIGN.md`

**Template:**

```python
# app/parsers/new_parser.py
from pathlib import Path
from typing import Optional

class NewParser:
    """Parser for NEW format with fallback."""

    def parse(self, file_path: Path) -> dict:
        """
        Parse NEW format file.

        Returns:
            dict with positions, diagnostics

        Reference: docs/SYSTEM_DESIGN.md#new-parser
        """
        try:
            return self._primary_parse(file_path)
        except Exception as e:
            return self._fallback_parse(file_path)
```

### 3. Adding Knowledge Base Content

**Steps:**

1. Identify KB category: `app/knowledge_base/B{N}_category/`
2. Add JSON/Markdown files
3. Update `metadata.json`
4. KB auto-loads on startup

**Structure:**

```
app/knowledge_base/
├── B1_urs_codes/         # Construction codes
├── B2_csn_standards/     # Czech standards
├── B3_current_prices/    # Market prices
├── B5_tech_cards/        # Technical specs
└── B9_Equipment_Specs/   # Equipment
```

### 4. Modifying AI Prompts

**Location:** `app/prompts/`

**Special case - PDF prompt:**

1. Edit `docs/pdf_extraction_system_prompt_v2_1.md`
2. Run `scripts/sync_pdf_prompt.sh` to generate runtime module
3. Verify with `scripts/check_pdf_prompt.sh`
4. Commit both Markdown and Python files

**Reference:** [CONTRIBUTING.md](docs/CONTRIBUTING.md#pdf-prompt-workflow)

### 5. Working with Project State

**Use project cache API:**

```python
from app.services.project_cache import load_project_cache, save_project_cache

# Load project
project = load_project_cache(project_id)

# Modify
project["status"] = "analyzing"
project["progress"] = 0.5

# Save
save_project_cache(project_id, project)
```

**Or use utility paths:**

```python
from app.core.config import settings

audit_path = settings.DATA_DIR / "projects" / project_id / "audit_results.json"
```

---

## Debugging

### Enable Verbose Logging

**In `.env`:**

```env
LOG_LEVEL=DEBUG
LOG_CLAUDE_CALLS=true
LOG_GPT4_CALLS=true
```

**Log locations:**

```
logs/
├── claude_calls/      # Claude API interactions
├── gpt4_calls/        # GPT-4 API interactions
└── perplexity_calls/  # Perplexity API interactions
```

### Check Project State

**All project state in:**

```
data/projects/{project_id}/
├── project.json           # Main metadata
├── raw/                   # Uploaded files
├── processed/             # Parsed data
└── artifacts/             # Generated outputs
```

**Read to understand workflow state:**

```python
import json
from pathlib import Path

project_file = Path(f"data/projects/{project_id}/project.json")
project = json.loads(project_file.read_text())
print(f"Status: {project['status']}")
print(f"Progress: {project.get('progress', 0)}")
```

### Check API Rate Limits

```python
from app.core.rate_limiter import get_rate_limiter

limiter = get_rate_limiter()
stats = limiter.get_usage_stats()
print(f"Claude: {stats['claude']['tokens_used']}/{stats['claude']['tokens_limit']}")
print(f"GPT-4: {stats['gpt4']['tokens_used']}/{stats['gpt4']['tokens_limit']}")
```

### Test Parsers Independently

```python
from app.parsers.kros_parser import KROSParser
from app.core.claude_client import ClaudeClient

claude = ClaudeClient()
parser = KROSParser(claude_client=claude)
result = parser.parse(Path("test_files/sample.xml"))

print(f"Positions: {len(result['positions'])}")
print(f"Diagnostics: {result['diagnostics']}")
```

### Debug Tests

```bash
# Show print statements
pytest tests/test_imports.py -s

# Show full traceback
pytest tests/test_workflow_a_integration.py -v --tb=long

# Drop into debugger on failure
pytest tests/test_file_security.py --pdb

# Show local variables on failure
pytest tests/test_enricher.py -l
```

### Common Issues

**1. Import Errors**

```bash
# Add project root to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
pytest
```

**2. 404 in API Tests**

Check route path matches:
- Test uses: `/api/workflow-a/workflow/a/{id}/tech-card`
- Actual route: `/api/workflow/a/{id}/tech-card` (likely)

**3. Async Test Warnings**

```python
# Missing decorator
@pytest.mark.asyncio  # Add this!
async def test_async_function():
    ...
```

**Reference:** [TESTS.md](docs/TESTS.md#troubleshooting)

---

## Important Notes

### Configuration

All configuration in `app/core/config.py` loaded from `.env`:

**Critical settings:**
- `ANTHROPIC_API_KEY` - Required for Workflow A
- `OPENAI_API_KEY` - Required for Workflow B
- `PERPLEXITY_API_KEY` - Optional for live KB search

**Feature flags:**
- `ENABLE_WORKFLOW_A` (default: true)
- `ENABLE_WORKFLOW_B` (default: false)
- `ENABLE_KROS_MATCHING` (default: true)
- `ENRICHMENT_ENABLED` (default: true)

**Reference:** [CONFIG.md](docs/CONFIG.md)

### Audit Classification Logic

```python
GREEN (≥95% confidence):
- High-quality match
- Proceed automatically

AMBER (75-95% confidence):
- Reasonable match
- May need review

RED (<75% confidence):
- Poor match
- Requires human review (HITL)
```

**Additional HITL triggers:**
- Price deviation >15% from norm
- Conflict between expert roles
- Missing critical fields

**Reference:** [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md#classification-logic)

### PDF Text Recovery

**Intelligent extraction pipeline:**

1. Try pdfplumber (primary)
2. Check valid character ratio (≥60%)
3. Detect PUA glyphs (encoding issues)
4. Fallback to Poppler/pdftotext
5. Queue for OCR if needed (max 5 pages)
6. Per-page timeouts prevent hanging

**Reference:** [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md#pdf-extraction)

### Multi-Role Expert System

**Four expert roles:**
- **SME** (Subject Matter Expert) - Domain knowledge
- **ARCH** (Architect) - Design compliance
- **ENG** (Engineer) - Technical feasibility
- **SUP** (Supervisor) - Construction practicality

**Consensus required before classification.**

**Reference:** [ARCHITECTURE.md](ARCHITECTURE.md#multi-role-validation-pattern)

---

## Starter Repository Recommendations

This project follows best practices from modern Python starter repositories:

### 1. Project Structure (FastAPI Best Practices)

```
✅ Layered architecture (API → Service → Data)
✅ Pydantic models for validation
✅ Dependency injection patterns
✅ Async/await throughout
✅ OpenAPI documentation auto-generated
```

### 2. Testing (pytest Best Practices)

```
✅ Comprehensive test coverage (97%)
✅ Multiple test categories (unit, integration, E2E)
✅ Mock patterns for external dependencies
✅ Fixtures for reusable test data
✅ Fast execution (~17 seconds for 67 tests)
```

### 3. Documentation (README Driven Development)

```
✅ Comprehensive README with badges
✅ Architecture documentation
✅ API documentation (OpenAPI + custom)
✅ Contributing guidelines
✅ Workflow documentation
```

### 4. Configuration (12-Factor App)

```
✅ Environment variables for config (.env)
✅ Feature flags for toggles
✅ Separate dev/staging/prod environments
✅ No secrets in code
```

### 5. Git Workflow (Conventional Commits)

```
✅ Conventional commit messages
✅ Semantic versioning
✅ Changelog generation ready
✅ Small, focused commits
```

### 6. Code Quality

```
⚠️ Type hints (present, could be more complete)
⚠️ Linting (not configured - add flake8/black)
⚠️ Pre-commit hooks (not configured)
✅ Error handling with specific exceptions
✅ Logging throughout
```

**Recommendations for improvement:**

1. Add `pre-commit` hooks for linting
2. Add `black` for code formatting
3. Add `mypy` for type checking
4. Add `flake8` for linting
5. Add CI/CD pipeline (GitHub Actions)
6. Add changelog generation (conventional-changelog)

---

**Last updated:** 2025-01-26
**Maintained by:** Development Team
**Questions?** See [CONTRIBUTING.md](docs/CONTRIBUTING.md)
