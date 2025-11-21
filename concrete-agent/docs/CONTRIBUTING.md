# Contributing Guide

> Welcome to Concrete Agent! This guide helps new contributors get started.

**Version:** 1.0.0
**Last updated:** 2025-01-26

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Coding Standards](#coding-standards)
4. [Git Commit Conventions](#git-commit-conventions)
5. [Testing Requirements](#testing-requirements)
6. [Documentation Standards](#documentation-standards)
7. [Pull Request Process](#pull-request-process)
8. [Code Review Guidelines](#code-review-guidelines)
9. [Special Workflows](#special-workflows)

---

## Getting Started

### Prerequisites

**Required:**
- Python 3.10 or higher
- Git
- Virtual environment tool (`venv`, `conda`, etc.)

**Optional:**
- Docker (for containerized deployment)
- `pre-commit` hooks (recommended)

### Initial Setup

**1. Clone the repository:**

```bash
git clone https://github.com/your-org/concrete-agent.git
cd concrete-agent
```

**2. Create virtual environment:**

```bash
# Using venv
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Or using conda
conda create -n concrete-agent python=3.10
conda activate concrete-agent
```

**3. Install dependencies:**

```bash
pip install -r requirements.txt
```

**4. Configure environment:**

Create `.env` file (copy from `.env.example` if available):

```env
# Required for Workflow A
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Required for Workflow B
OPENAI_API_KEY=sk-your-key-here

# Optional
PERPLEXITY_API_KEY=pplx-your-key-here
ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

**5. Verify installation:**

```bash
# Run tests
pytest

# Start development server
python -m uvicorn app.main:app --reload
```

**6. Access API docs:**

Open http://localhost:8000/docs in your browser.

---

## Development Workflow

### Standard Development Cycle

**1. Create a feature branch (if using branching):**

```bash
git checkout -b feature/your-feature-name
```

**2. Make changes:**

Follow [Coding Standards](#coding-standards) and make focused, modular changes.

**3. Write tests:**

Add tests for new functionality. See [Testing Requirements](#testing-requirements).

**4. Run tests:**

```bash
pytest
```

**5. Update documentation:**

Update relevant docs. See [Documentation Standards](#documentation-standards).

**6. Commit changes:**

Use [Conventional Commits](#git-commit-conventions):

```bash
git add <files>
git commit -m "feat(parser): add XC5 format support"
```

**7. Push changes:**

```bash
git push origin feature/your-feature-name
```

**8. Create Pull Request:**

Follow [Pull Request Process](#pull-request-process).

### Local Development Commands

```bash
# Run application (hot reload)
python -m uvicorn app.main:app --reload

# Run all tests
pytest

# Run specific test file
pytest tests/test_imports.py -v

# Run tests with coverage
pytest --cov=app --cov-report=html

# Format code (if black configured)
black app/ tests/

# Lint code (if flake8 configured)
flake8 app/ tests/

# Type check (if mypy configured)
mypy app/
```

---

## Coding Standards

### Python Style Guide

**1. Follow PEP 8** with these additions:

- Line length: 100 characters (not strict 80)
- Use 4 spaces for indentation (no tabs)
- Two blank lines between top-level functions/classes
- One blank line between methods

**2. Type Hints (Required):**

```python
from typing import Optional, List, Dict
from pathlib import Path

def enrich_position(
    position: dict,
    kb_loader: KBLoader,
    enable_cache: bool = True
) -> dict:
    """Enrich position with KB data."""
    ...
```

**3. Async/Await (Required for I/O):**

```python
# ✅ Good: Async for I/O operations
@router.post("/api/upload")
async def upload_project(file: UploadFile) -> dict:
    content = await file.read()
    result = await process_file(content)
    return result

# ❌ Bad: Blocking I/O in async function
@router.post("/api/upload")
async def upload_project(file: UploadFile) -> dict:
    content = file.read()  # Blocks event loop!
    return process_file_sync(content)
```

**4. Pydantic Models (Required):**

```python
from pydantic import BaseModel, Field, validator

class Position(BaseModel):
    code: str = Field(..., description="KROS position code")
    description: str
    quantity: float = Field(gt=0, description="Quantity must be positive")
    unit: str

    @validator('code')
    def validate_code(cls, v):
        if not v or len(v) < 3:
            raise ValueError("Invalid code format")
        return v
```

**5. Error Handling (Specific Exceptions):**

```python
# ✅ Good: Specific exceptions
try:
    result = parser.parse(file_path)
except FileNotFoundError:
    logger.error(f"File not found: {file_path}")
    raise HTTPException(status_code=404, detail="File not found")
except ValueError as e:
    logger.error(f"Invalid format: {e}")
    raise HTTPException(status_code=400, detail=f"Invalid format: {e}")

# ❌ Bad: Bare except or too broad
try:
    result = parser.parse(file_path)
except Exception as e:  # Too broad
    raise HTTPException(status_code=500, detail="Error")
```

**6. Naming Conventions:**

```python
# Domain terms in Czech, tech terms in English
class VykazVymerParser:      # Czech: bill of quantities
    def parse_xml(self, file_path: Path) -> dict:  # English: tech
        pozice = self._extract_pozice()  # Czech: positions
        return {"positions": pozice, "total": len(pozice)}

# Constants: UPPER_CASE
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB

# Private methods: _leading_underscore
def _internal_helper(self) -> str:
    ...
```

**7. Docstrings (Google Style):**

```python
def enrich_position(position: dict, kb_loader: KBLoader) -> dict:
    """
    Enrich position with KROS/RTS database information.

    Args:
        position: Position dict with code, description, unit, quantity
        kb_loader: Knowledge base loader instance

    Returns:
        Enriched position dict with:
            - enrichment_status: "matched" | "partial" | "unmatched"
            - unit_price: float | None
            - enrichment: dict with match details

    Raises:
        ValueError: If position missing required fields
        KeyError: If KB not loaded

    Example:
        >>> position = {"code": "121151113", "description": "Beton C30/37"}
        >>> enriched = enrich_position(position, kb_loader)
        >>> enriched["enrichment_status"]
        "matched"

    Reference:
        docs/WORKFLOWS.md#workflow-a-step-4
    """
    ...
```

### File Organization

**1. Import Order:**

```python
# Standard library imports
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict

# Third-party imports
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, Field

# Local application imports
from app.core.config import settings
from app.services.workflow_a import workflow_a
from app.models.position import Position
from app.utils.validators import validate_file_type
```

**2. Module Structure:**

```python
"""
Module docstring describing purpose.

Reference: docs/SYSTEM_DESIGN.md#module-name
"""

# Imports
...

# Constants
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30

# Module-level variables
logger = logging.getLogger(__name__)

# Classes
class MyClass:
    ...

# Functions
def my_function():
    ...

# Entry point (if applicable)
if __name__ == "__main__":
    main()
```

---

## Git Commit Conventions

### Conventional Commits Format

**Format:** `<type>(<scope>): <subject>`

**Types:**

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(parser): add XC5 format support` |
| `fix` | Bug fix | `fix(audit): correct price deviation calculation` |
| `docs` | Documentation only | `docs: update WORKFLOWS.md with diagrams` |
| `test` | Adding/updating tests | `test(security): add path traversal tests` |
| `refactor` | Code refactoring | `refactor(enricher): simplify matching logic` |
| `perf` | Performance improvement | `perf(parser): optimize XML parsing speed` |
| `style` | Code style/formatting | `style: apply black formatting` |
| `chore` | Maintenance tasks | `chore: update dependencies` |

**Scope (optional but recommended):**

Common scopes: `parser`, `api`, `service`, `audit`, `workflow`, `security`, `config`, `docs`, `test`

**Subject:**

- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Maximum 50-72 characters

### Examples

**✅ Good commit messages:**

```bash
feat(parser): add XC5 format support with fallback chain
fix(audit): correct GREEN/AMBER threshold from 90% to 95%
docs: add business-critical test scenarios to TESTS.md
test(security): add 13 path traversal attack tests
refactor(enricher): extract KROS matching into separate method
perf(parser): reduce XML parsing time by 40%
```

**❌ Bad commit messages:**

```bash
updates
fix bug
WIP
added stuff
changes to parser
```

### Multi-Line Commits

For complex changes:

```bash
git commit -m "$(cat <<'EOF'
feat(audit): implement multi-role expert consensus system

- Add SME, ARCH, ENG, SUP expert roles
- Implement consensus algorithm with voting
- Add conflict resolution for disagreements
- Update classification thresholds (GREEN: 95%+, AMBER: 75-95%, RED: <75%)

BREAKING CHANGE: Audit API now requires role_config parameter

This implements the multi-role validation pattern described in
ARCHITECTURE.md. The system now consults 4 expert roles before
classifying positions, improving accuracy by ~15%.

Reference: docs/SYSTEM_DESIGN.md#multi-role-expert-system
Closes: #42

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Commit Best Practices

**✅ Do:**

- Make atomic commits (one logical change)
- Write clear, descriptive messages
- Reference issues/PRs when relevant
- Add breaking change notes if applicable
- Keep commits small and focused

**❌ Don't:**

- Combine unrelated changes
- Use vague messages ("fix", "updates")
- Commit broken code
- Skip tests before committing
- Leave TODO comments without tracking

---

## Testing Requirements

### Test Coverage Requirements

| Layer | Target Coverage | Required for Merge |
|-------|----------------|-------------------|
| Security | 100% | ✅ Yes |
| Services | 85%+ | ✅ Yes |
| Parsers | 80%+ | ✅ Yes |
| API Routes | 75%+ | ⚠️ Recommended |
| Validators | 75%+ | ⚠️ Recommended |

**Check coverage:**

```bash
pytest --cov=app --cov-report=term-missing
```

### Test Types Required

**For new features, include:**

1. **Unit tests** - Individual functions/methods
2. **Integration tests** - Component interactions
3. **E2E tests** - Full workflow (if applicable)

**Example structure:**

```python
"""
Tests for XC5 parser.
"""
import pytest
from pathlib import Path
from unittest.mock import MagicMock

from app.parsers.xc5_parser import XC5Parser


# ==========================================
# FIXTURES
# ==========================================

@pytest.fixture
def sample_xc5_file(tmp_path):
    """Create sample XC5 file for testing."""
    file_path = tmp_path / "sample.xc5"
    file_path.write_text("XC5 test content")
    return file_path


# ==========================================
# UNIT TESTS
# ==========================================

def test_xc5_parser_initialization():
    """Test XC5Parser initializes correctly."""
    parser = XC5Parser()
    assert parser is not None


def test_xc5_parser_parses_valid_file(sample_xc5_file):
    """Test parsing valid XC5 file."""
    parser = XC5Parser()
    result = parser.parse(sample_xc5_file)

    assert "positions" in result
    assert "diagnostics" in result
    assert result["diagnostics"]["format"] == "XC5"


def test_xc5_parser_handles_invalid_file():
    """Test parser handles invalid file gracefully."""
    parser = XC5Parser()

    with pytest.raises(ValueError, match="Invalid XC5 format"):
        parser.parse(Path("nonexistent.xc5"))


# ==========================================
# INTEGRATION TESTS
# ==========================================

def test_xc5_parser_with_workflow_integration(sample_xc5_file):
    """Test XC5 parser integrates with workflow."""
    from app.services.workflow_a import WorkflowA

    workflow = WorkflowA()
    # Integration test logic...
```

### Test Naming Convention

```python
# Pattern: test_<function>_<scenario>_<expected_result>

def test_enrich_position_exact_match_returns_matched_status():
    """Test position enrichment with exact KROS match returns matched status."""
    ...

def test_parse_xml_invalid_format_raises_value_error():
    """Test XML parser raises ValueError for invalid format."""
    ...
```

### Running Tests Before Commit

**Always run tests before committing:**

```bash
# Quick smoke test
pytest tests/test_imports.py -v

# Full test suite
pytest -v

# With coverage
pytest --cov=app --cov-report=term-missing
```

**Fix any failing tests before committing!**

---

## Documentation Standards

### When to Update Documentation

**ALWAYS update docs when you:**

| Change Type | Update These Files |
|-------------|-------------------|
| Add API endpoint | `docs/API.md` |
| Add workflow step | `docs/WORKFLOWS.md` |
| Add test | `docs/TESTS.md` |
| Add config option | `docs/CONFIG.md` |
| Add architecture pattern | `ARCHITECTURE.md` |
| Add major feature | `README.md`, `docs/SYSTEM_DESIGN.md` |
| Fix bug | Add comment in code + changelog |

### Documentation Style

**1. Use clear, concise language:**

```markdown
# ✅ Good
The parser implements a three-tier fallback strategy: primary method,
fallback method, and AI-based extraction.

# ❌ Bad
The parser like does some fallback stuff if the first thing doesn't work.
```

**2. Include code examples:**

```markdown
**Example:**

​```python
from app.parsers import XC5Parser

parser = XC5Parser()
result = parser.parse(file_path)
print(f"Found {len(result['positions'])} positions")
​```
```

**3. Add cross-references:**

```markdown
**Reference:** [WORKFLOWS.md](docs/WORKFLOWS.md#workflow-a-step-4)
**See also:** [API.md](docs/API.md#post-apiworkflowaenrich)
```

**4. Use tables for structured data:**

```markdown
| Parser | Format | Fallback | Test Coverage |
|--------|--------|----------|---------------|
| KROS | XML | Claude AI | 95% |
| XC4 | Binary | None | 80% |
```

**5. Include diagrams where helpful:**

```markdown
​```
Upload → Parse → Validate → Enrich → Audit → Export
  ↓        ↓        ↓          ↓        ↓        ↓
 XML    Smart    Pydantic   KROS   Multi-   Excel
       Parser    Schema    Match   Role    Report
​```
```

### Documentation Files Structure

**README.md:**
- Project overview
- Quick start
- Installation
- Basic usage

**ARCHITECTURE.md:**
- System architecture (5 layers)
- Design patterns
- Data flow

**docs/SYSTEM_DESIGN.md:**
- Technical specification
- Workflow details
- Data models
- API contracts

**docs/API.md:**
- All API endpoints
- Request/response examples
- Error handling

**docs/WORKFLOWS.md:**
- Step-by-step workflows
- Input/output examples
- Module specifications

**docs/TESTS.md:**
- Test organization
- Test categories
- Mock structures
- Business-critical scenarios

**docs/CONFIG.md:**
- Configuration options
- Environment variables
- Feature flags

---

## Pull Request Process

### Before Creating a PR

**1. Ensure all tests pass:**

```bash
pytest -v
```

**2. Update documentation:**

Add/update relevant documentation files.

**3. Check code style:**

```bash
# If configured
black app/ tests/
flake8 app/ tests/
mypy app/
```

**4. Review your changes:**

```bash
git diff
```

### Creating a Pull Request

**1. Push your branch:**

```bash
git push origin feature/your-feature-name
```

**2. Create PR on GitHub/GitLab:**

**PR Title:** Use conventional commit format

```
feat(parser): add XC5 format support with fallback chain
```

**PR Description Template:**

```markdown
## Description

Brief description of what this PR does.

## Changes

- Add XC5Parser class with parse() method
- Implement three-tier fallback strategy
- Add 12 unit tests for XC5 parser
- Update docs/SYSTEM_DESIGN.md with XC5 parser section

## Testing

- [x] All existing tests pass
- [x] Added new tests (12 tests, 100% coverage for new code)
- [x] Manual testing performed
- [x] Documentation updated

## Breaking Changes

None / Describe any breaking changes

## Related Issues

Closes #42
Relates to #38

## Checklist

- [x] Code follows project coding standards
- [x] Tests added/updated
- [x] Documentation updated
- [x] No secrets in code
- [x] Commit messages follow conventions
```

### PR Review Process

**Reviewers will check:**

1. ✅ Code quality and style
2. ✅ Test coverage (≥target for layer)
3. ✅ Documentation completeness
4. ✅ No security vulnerabilities
5. ✅ Performance impact
6. ✅ Breaking changes documented

**Address review comments:**

```bash
# Make changes
git add <files>
git commit -m "fix: address review comments"
git push origin feature/your-feature-name
```

---

## Code Review Guidelines

### For Reviewers

**What to review:**

1. **Correctness:**
   - Does the code do what it claims?
   - Are edge cases handled?
   - Is error handling appropriate?

2. **Code Quality:**
   - Follows coding standards?
   - Type hints present?
   - Clear naming?
   - Appropriate abstractions?

3. **Tests:**
   - Sufficient coverage?
   - Tests actually test the code?
   - Edge cases covered?

4. **Documentation:**
   - Docstrings complete?
   - Updated relevant docs?
   - Clear commit messages?

5. **Security:**
   - No secrets in code?
   - Input validation?
   - No SQL injection, path traversal, etc.?

**How to provide feedback:**

```markdown
# ✅ Good: Specific, constructive
Consider using `async with` here to ensure file closure:
​```python
async with aiofiles.open(file_path, 'r') as f:
    content = await f.read()
​```

# ❌ Bad: Vague, unconstructive
This doesn't look right.
```

### For Contributors

**Responding to reviews:**

- Address all comments (fix or explain)
- Don't take feedback personally
- Ask for clarification if needed
- Update PR with requested changes
- Thank reviewers for their time

---

## Special Workflows

### PDF Prompt Workflow

**The PDF extraction prompt requires special handling:**

**1. Edit the source file:**

```bash
# Edit Markdown source
vim docs/pdf_extraction_system_prompt_v2_1.md
```

**2. Sync to runtime module:**

```bash
# Generate Python module
scripts/sync_pdf_prompt.sh

# Or on Windows
python scripts/sync_pdf_prompt.py
```

**3. Verify synchronization:**

```bash
scripts/check_pdf_prompt.sh
```

**4. Commit BOTH files:**

```bash
git add docs/pdf_extraction_system_prompt_v2_1.md \
        app/prompts/pdf_extraction_system_prompt_v2_1.py
git commit -m "feat(prompts): update PDF extraction prompt v2.1"
```

**Why this workflow?**

- Single source of truth: Markdown in docs/
- Runtime module auto-generated from Markdown
- CI pipeline verifies they match
- Prevents drift between docs and code

### Adding Knowledge Base Content

**1. Identify category:**

```
app/knowledge_base/
├── B1_urs_codes/         # Construction codes
├── B2_csn_standards/     # Czech standards
├── B3_current_prices/    # Market pricing
├── B5_tech_cards/        # Technical specs
└── B9_Equipment_Specs/   # Equipment data
```

**2. Add content:**

```bash
# Add JSON file
cat > app/knowledge_base/B1_urs_codes/new_codes.json <<EOF
{
  "code": "123456789",
  "description": "New construction code",
  "unit": "m3",
  "category": "HSV"
}
EOF
```

**3. Update metadata:**

```bash
# Edit metadata.json in category
vim app/knowledge_base/B1_urs_codes/metadata.json
```

**4. KB auto-loads on startup:**

No need to manually register - the KB loader scans all B{N} directories.

### Adding a New Parser

**1. Create parser file:**

```bash
touch app/parsers/xc5_parser.py
```

**2. Implement parser:**

```python
from pathlib import Path
from typing import Optional

class XC5Parser:
    """Parser for XC5 format with fallback."""

    def parse(self, file_path: Path) -> dict:
        """Parse XC5 file."""
        try:
            return self._primary_parse(file_path)
        except Exception as e:
            return self._fallback_parse(file_path)

    def _primary_parse(self, file_path: Path) -> dict:
        """Primary parsing method."""
        # Implementation
        return {"positions": [], "diagnostics": {}}

    def _fallback_parse(self, file_path: Path) -> dict:
        """Fallback parsing method."""
        # Fallback implementation
        return {"positions": [], "diagnostics": {"fallback": True}}
```

**3. Add tests:**

```bash
touch tests/test_xc5_parser.py
```

**4. Update documentation:**

- Add to `docs/SYSTEM_DESIGN.md`
- Add to `README.md` (if major parser)

### Adding a New API Endpoint

**1. Choose router:**

- `app/api/routes.py` - Main endpoints
- `app/api/routes_workflow_a.py` - Workflow A
- `app/api/routes_workflow_b.py` - Workflow B

**2. Add endpoint:**

```python
@router.post("/api/workflow/a/{project_id}/custom-action")
async def custom_action(
    project_id: str,
    payload: CustomActionRequest
) -> dict:
    """
    Perform custom action on project.

    Args:
        project_id: Project identifier
        payload: Action parameters

    Returns:
        dict with action results

    Raises:
        HTTPException: 404 if project not found

    Reference: docs/WORKFLOWS.md#custom-action
    """
    result = await workflow_a.run(project_id, action="custom", **payload.dict())
    return result
```

**3. Add tests:**

```python
def test_custom_action_endpoint(client):
    """Test custom action endpoint."""
    response = client.post(
        "/api/workflow/a/test-project/custom-action",
        json={"param": "value"}
    )
    assert response.status_code == 200
```

**4. Update docs/API.md:**

Add endpoint documentation with examples.

---

## Getting Help

### Resources

- **Documentation:** See all files in `docs/`
- **CLAUDE.md:** Guidelines for Claude Code assistant
- **Issues:** https://github.com/your-org/concrete-agent/issues
- **Discussions:** https://github.com/your-org/concrete-agent/discussions

### Contact

- **Maintainer:** Development Team
- **Email:** dev-team@example.com (if applicable)
- **Slack/Discord:** #concrete-agent (if applicable)

### Common Questions

**Q: How do I add a new parser?**
A: See [Adding a New Parser](#adding-a-new-parser)

**Q: Tests are failing - what do I do?**
A: See [TESTS.md](TESTS.md#troubleshooting)

**Q: How do I update the PDF prompt?**
A: See [PDF Prompt Workflow](#pdf-prompt-workflow)

**Q: What's the commit message format?**
A: See [Git Commit Conventions](#git-commit-conventions)

---

## License

This project is licensed under [LICENSE TYPE] - see LICENSE file for details.

---

**Last updated:** 2025-01-26
**Maintained by:** Development Team
**Questions?** Open an issue on GitHub
