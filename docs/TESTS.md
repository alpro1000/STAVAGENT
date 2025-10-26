# Testing Guide

> Complete testing documentation for Concrete Agent

**Document version:** 1.0.0
**Last updated:** 2025-01-26
**Maintainer:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Structure](#test-structure)
4. [Test Categories](#test-categories)
5. [Running Tests](#running-tests)
6. [Writing Tests](#writing-tests)
7. [Fixtures & Mocking](#fixtures--mocking)
8. [Test Data](#test-data)
9. [Coverage & CI/CD](#coverage--cicd)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Testing Philosophy

Concrete Agent uses **pytest** for comprehensive testing across all layers:

- **Unit tests**: Individual functions and classes
- **Integration tests**: Component interactions
- **E2E tests**: Complete workflows
- **Security tests**: Vulnerability checks
- **Performance tests**: Bottleneck identification

### Test Statistics

Current test coverage (as of last run):

```
Total tests: 67
Passing: 65 (97%)
Failing: 2 (pre-existing, documented)
Test files: 16
```

### Testing Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **pytest** | 8.3.4 | Test framework |
| **pytest-asyncio** | ≥0.21.0 | Async test support |
| **unittest.mock** | stdlib | Mocking framework |
| **FastAPI TestClient** | - | API endpoint testing |
| **openpyxl** | ≥3.1.0 | Excel test fixtures |
| **tempfile** | stdlib | Temporary test data |

---

## Quick Start

### Installation

```bash
# Install test dependencies
pip install pytest==8.3.4 pytest-asyncio>=0.21.0

# Or install from requirements.txt (includes all deps)
pip install -r requirements.txt
```

### Running All Tests

```bash
# Run all tests with verbose output
pytest -v

# Run with coverage report
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_imports.py -v

# Run specific test
pytest tests/test_imports.py::test_config_import -v
```

### Quick Validation

```bash
# Smoke test: verify imports work
pytest tests/test_imports.py -v

# Integration test: verify workflow
pytest tests/test_workflow_a_integration.py -v

# Security test: verify no path leakage
pytest tests/test_file_security.py -v
```

---

## Test Structure

### Directory Layout

```
tests/
├── test_imports.py                  # Import validation (CI/CD)
├── test_workflow_a_integration.py   # Workflow A integration
├── test_workflow_a_e2e_numbers.py   # E2E: European number parsing
├── test_workflow_a_artifacts.py     # Artifact generation
├── test_kros_parsing.py             # KROS XML parsing
├── test_xc4_parser.py               # XC4 parser
├── test_position_enricher.py        # Position enrichment
├── test_otskp_normalizer.py         # OTSKP normalization
├── test_audit_counters.py           # Audit statistics
├── test_audit_contract_structures.py # Contract validation
├── test_model_unification.py        # Data model tests
├── test_file_security.py            # Security tests
├── test_empty_file_params.py        # Edge case handling
├── test_export_and_enrich.py        # Export functionality
├── services/
│   └── test_pdf_text_recovery_ocr.py # PDF OCR recovery
└── prompts/
    └── test_pdf_prompt_v2_1.py      # Prompt validation
```

### Naming Conventions

- **Test files**: `test_*.py` (pytest auto-discovery)
- **Test functions**: `test_*()` (pytest auto-discovery)
- **Test classes**: `Test*` (optional, for grouping)
- **Fixtures**: `@pytest.fixture` decorator
- **Async tests**: `async def test_*()` with `@pytest.mark.asyncio`

---

## Test Categories

### 1. Import Validation Tests

**File**: `tests/test_imports.py`

Validates that all critical modules can be imported (essential for CI/CD).

```python
def test_config_import():
    """Test that config module imports successfully"""
    from app.core.config import settings
    assert settings is not None
    assert settings.BASE_DIR is not None

def test_fastapi_app_import():
    """Test that FastAPI app imports successfully"""
    from app.main import app
    assert app is not None
    assert hasattr(app, 'routes')
```

**Purpose:**
- Catch circular import errors
- Validate environment setup
- Ensure configuration loads correctly
- CI/CD pipeline validation

### 2. Integration Tests

**File**: `tests/test_workflow_a_integration.py`

Tests interactions between components.

```python
def test_workflow_a_import():
    """Test that workflow_a instance can be imported"""
    from app.services.workflow_a import workflow_a
    assert workflow_a is not None
    assert hasattr(workflow_a, 'run')

@pytest.mark.asyncio
async def test_workflow_a_run_with_mock_project():
    """Test that run() forwards calls to WorkflowA.execute"""
    from app.services.workflow_a import workflow_a, WorkflowA

    test_project_id = "test-project-123"

    with patch.object(WorkflowA, 'execute', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = {"success": True}
        result = await workflow_a.run(
            project_id=test_project_id,
            action="tech_card"
        )

    assert result == {"success": True}
    mock_execute.assert_awaited_once()
```

**Covers:**
- Service layer interactions
- Method signature validation
- Async workflow execution
- Error handling

### 3. End-to-End (E2E) Tests

**File**: `tests/test_workflow_a_e2e_numbers.py`

Tests complete workflows from input to output.

```python
def test_e2e_excel_to_export(tmp_path):
    """Complete workflow: Excel parsing → validation → audit → export"""

    # 1. Create test data
    source_path = tmp_path / "eu_numbers.xlsx"
    _build_test_workbook(source_path)

    # 2. Parse Excel
    parser = ExcelParser()
    parsed = parser.parse(source_path)
    assert len(parsed["positions"]) == 53
    assert parsed["diagnostics"]["normalization"]["numbers_locale"] == "EU"

    # 3. Validate
    validator = PositionValidator()
    result = validator.validate(parsed["positions"])
    assert result.stats["validated_total"] == 53
    assert result.stats["invalid_total"] == 0

    # 4. Audit
    classifier = AuditClassifier()
    audited, stats = classifier.classify(result.positions)

    # 5. Export
    exporter = AuditExcelExporter()
    output_path = tmp_path / "output.xlsx"
    exporter.export(audited, output_path)
    assert output_path.exists()
```

**Scenarios:**
- ✅ European number format (spaces, commas)
- ✅ Validation → Enrichment → Audit → Export
- ✅ Multi-step data transformations
- ✅ File I/O operations

### 4. Parser Tests

**Files**: `test_kros_parsing.py`, `test_xc4_parser.py`

Tests document parsing logic.

```python
def test_kros_unixml_parsing():
    """Test KROS UNIXML file parsing"""

    client = ClaudeClient()
    test_xml_path = Path("test_files/sample.xml")

    result = client.parse_xml(test_xml_path)

    # Validate structure
    assert 'document_info' in result
    assert 'positions' in result
    assert 'objects' in result

    # Validate data
    doc_info = result['document_info']
    assert doc_info.get('document_type') == 'vykaz_vymer'

    positions = result['positions']
    assert len(positions) > 0
    assert all('code' in pos for pos in positions)
```

**Coverage:**
- KROS UNIXML parsing
- XC4 format parsing
- Excel parsing (XLSX, XLS)
- PDF parsing (via pdfplumber)
- Error handling for malformed files

### 5. Security Tests

**File**: `tests/test_file_security.py`

Tests security vulnerabilities.

```python
class TestSafeFileMetadata:
    """Test the create_safe_file_metadata helper function"""

    def test_creates_safe_metadata_without_paths(self, temp_project_dir):
        """Test that metadata does NOT contain server paths"""

        test_file = temp_project_dir / "test.xml"
        test_file.write_text("test content")

        metadata = create_safe_file_metadata(
            file_path=test_file,
            file_type="vykaz_vymer",
            project_id="proj_test123"
        )

        # Verify NO server paths exposed
        metadata_str = json.dumps(metadata)
        assert str(test_file.parent) not in metadata_str
        assert str(test_file.absolute()) not in metadata_str

        # Verify safe fields present
        assert "file_id" in metadata
        assert "filename" in metadata
        assert "file_type" in metadata
```

**Tests:**
- ✅ No server path leakage in API responses
- ✅ Safe file metadata generation
- ✅ Input validation (SQL injection, path traversal)
- ✅ API key protection

### 6. Service Layer Tests

**Files**: `test_position_enricher.py`, `test_audit_counters.py`, etc.

Tests business logic services.

```python
def test_position_enrichment_with_kros_match():
    """Test position enrichment with KROS database match"""

    enricher = PositionEnricher()

    position = {
        "code": "121151113",
        "description": "Beton C 25/30",
        "unit": "m3",
        "quantity": 10.5
    }

    enriched = enricher.enrich(position)

    assert enriched["enrichment_status"] == "matched"
    assert enriched["unit_price"] > 0
    assert "kros_code" in enriched
    assert enriched["classification"] in ["GREEN", "AMBER", "RED"]
```

**Services Tested:**
- Position enrichment (KROS/RTS matching)
- Audit classification
- Multi-role expert system
- Project state machine
- Cache management

---

## Running Tests

### Basic Commands

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific file
pytest tests/test_imports.py

# Run specific test
pytest tests/test_imports.py::test_config_import

# Run tests matching pattern
pytest -k "import"

# Run tests in parallel (requires pytest-xdist)
pytest -n auto
```

### Filtering Tests

```bash
# Run only integration tests
pytest tests/test_workflow_a_integration.py

# Run only E2E tests
pytest tests/test_workflow_a_e2e_numbers.py

# Run tests with markers (if defined)
pytest -m "slow"
pytest -m "not slow"
```

### Output Control

```bash
# Show print statements
pytest -s

# Show short test summary
pytest --tb=short

# Show only failures
pytest --tb=line

# Stop on first failure
pytest -x

# Show captured logs
pytest --log-cli-level=DEBUG
```

### Coverage Reports

```bash
# Generate coverage report
pytest --cov=app

# HTML coverage report
pytest --cov=app --cov-report=html
# Open: htmlcov/index.html

# Terminal coverage report
pytest --cov=app --cov-report=term-missing

# Coverage for specific module
pytest --cov=app.parsers tests/test_kros_parsing.py
```

---

## Writing Tests

### Test Template

```python
"""
Module description
Tests for <component>
"""
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.config import settings
from app.services.my_service import MyService


# ==========================================
# FIXTURES
# ==========================================

@pytest.fixture
def sample_data():
    """Create sample data for testing"""
    return {
        "code": "121151113",
        "description": "Test position",
        "quantity": 10.5
    }


@pytest.fixture
def temp_file(tmp_path):
    """Create temporary file for testing"""
    file_path = tmp_path / "test.xlsx"
    # ... create file ...
    return file_path


# ==========================================
# UNIT TESTS
# ==========================================

def test_basic_functionality(sample_data):
    """Test basic functionality"""
    service = MyService()
    result = service.process(sample_data)

    assert result is not None
    assert result["status"] == "success"


def test_error_handling():
    """Test error handling"""
    service = MyService()

    with pytest.raises(ValueError, match="Invalid input"):
        service.process(None)


# ==========================================
# ASYNC TESTS
# ==========================================

@pytest.mark.asyncio
async def test_async_operation():
    """Test async operation"""
    service = MyService()

    result = await service.async_process()

    assert result["completed"] is True


# ==========================================
# MOCKED TESTS
# ==========================================

@patch('app.services.my_service.external_api')
def test_with_mocked_api(mock_api):
    """Test with mocked external API"""
    mock_api.return_value = {"data": "mocked"}

    service = MyService()
    result = service.call_external_api()

    assert result["data"] == "mocked"
    mock_api.assert_called_once()


@pytest.mark.asyncio
async def test_with_async_mock():
    """Test with async mock"""
    service = MyService()

    with patch.object(service, 'async_method', new_callable=AsyncMock) as mock_method:
        mock_method.return_value = {"success": True}

        result = await service.async_method()

        assert result["success"] is True
        mock_method.assert_awaited_once()
```

### Best Practices

#### 1. Test Naming

✅ **Good:**
```python
def test_position_enricher_with_exact_kros_match():
    """Test position enricher with exact KROS database match"""
    ...

def test_audit_classifier_handles_missing_fields():
    """Test that audit classifier handles missing required fields"""
    ...
```

❌ **Bad:**
```python
def test1():
    ...

def test_stuff():
    ...
```

#### 2. Test Structure (AAA Pattern)

```python
def test_example():
    # ARRANGE: Set up test data
    position = {"code": "121151113", "quantity": 10.5}
    enricher = PositionEnricher()

    # ACT: Execute the operation
    result = enricher.enrich(position)

    # ASSERT: Verify the outcome
    assert result["enrichment_status"] == "matched"
    assert result["unit_price"] > 0
```

#### 3. Assertions

✅ **Good:**
```python
assert result["status"] == "success"
assert len(positions) == 53
assert "error" not in response
```

❌ **Bad:**
```python
assert result  # Too vague
assert True  # Meaningless
```

#### 4. Error Testing

```python
# Test specific exception
with pytest.raises(ValueError, match="Invalid project ID"):
    service.process("invalid-id")

# Test exception attributes
with pytest.raises(ValidationError) as exc_info:
    validator.validate(bad_data)

assert "code" in str(exc_info.value)
```

#### 5. Async Testing

```python
@pytest.mark.asyncio
async def test_async_workflow():
    """Test async workflow execution"""
    workflow = WorkflowA()

    result = await workflow.run(project_id="test-123")

    assert result["status"] == "completed"
```

---

## Fixtures & Mocking

### Built-in Fixtures

```python
def test_with_temp_path(tmp_path):
    """tmp_path: Temporary directory (pathlib.Path)"""
    file_path = tmp_path / "test.txt"
    file_path.write_text("test content")
    assert file_path.exists()


def test_with_monkeypatch(monkeypatch):
    """monkeypatch: Modify environment, attributes, etc."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    from app.core.config import settings
    assert settings.ANTHROPIC_API_KEY == "test-key"


def test_with_caplog(caplog):
    """caplog: Capture log messages"""
    import logging

    logger = logging.getLogger("app")
    logger.warning("Test warning")

    assert "Test warning" in caplog.text
```

### Custom Fixtures

```python
@pytest.fixture
def sample_excel_file(tmp_path):
    """Create a sample Excel file for testing"""
    from openpyxl import Workbook

    file_path = tmp_path / "sample.xlsx"
    wb = Workbook()
    ws = wb.active

    ws.append(["Kód položky", "Popis", "MJ", "Množství"])
    ws.append(["121151113", "Beton C 25/30", "m3", "10,5"])

    wb.save(file_path)
    return file_path


@pytest.fixture
def mock_claude_client():
    """Create a mocked Claude client"""
    with patch('app.core.claude_client.ClaudeClient') as mock:
        mock.return_value.parse_xml.return_value = {
            "positions": [{"code": "121151113"}],
            "document_info": {"type": "vykaz_vymer"}
        }
        yield mock


@pytest.fixture(scope="session")
def test_config():
    """Session-wide test configuration"""
    return {
        "test_mode": True,
        "mock_ai": True,
        "timeout": 30
    }
```

### Fixture Scopes

| Scope | Lifetime | Use Case |
|-------|----------|----------|
| `function` | Per test | Default, most common |
| `class` | Per test class | Shared setup for class |
| `module` | Per module | Expensive setup (DB connection) |
| `session` | Entire test session | Global config, one-time setup |

```python
@pytest.fixture(scope="session")
def database_connection():
    """Expensive: create once per session"""
    conn = create_connection()
    yield conn
    conn.close()
```

### Mocking Patterns

#### 1. Mock External APIs

```python
@patch('app.core.claude_client.anthropic.Anthropic')
def test_claude_client_api_call(mock_anthropic):
    """Mock Anthropic API"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"result": "success"}')]
    mock_anthropic.return_value.messages.create.return_value = mock_response

    client = ClaudeClient()
    result = client.parse_xml(Path("test.xml"))

    assert result == {"result": "success"}
```

#### 2. Mock Async Functions

```python
@pytest.mark.asyncio
async def test_async_api_call():
    """Mock async API call"""
    with patch('app.services.workflow_a.fetch_data', new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {"data": "test"}

        result = await workflow.process()

        assert result["data"] == "test"
        mock_fetch.assert_awaited_once()
```

#### 3. Mock File I/O

```python
@patch('pathlib.Path.exists')
@patch('pathlib.Path.read_text')
def test_file_reading(mock_read, mock_exists):
    """Mock file operations"""
    mock_exists.return_value = True
    mock_read.return_value = "test content"

    content = read_config_file()

    assert content == "test content"
```

#### 4. Mock Environment Variables

```python
def test_with_env_var(monkeypatch):
    """Mock environment variable"""
    monkeypatch.setenv("ENABLE_WORKFLOW_A", "false")

    # Re-import to pick up new env var
    import importlib
    from app.core import config
    importlib.reload(config)

    assert config.settings.ENABLE_WORKFLOW_A is False
```

---

## Test Data

### Directory Structure

```
tests/
├── fixtures/              # Reusable test data (if created)
│   ├── excel/
│   │   ├── sample_vykaz.xlsx
│   │   └── sample_rozpocet.xlsx
│   ├── xml/
│   │   ├── kros_sample.xml
│   │   └── xc4_sample.xc4
│   └── pdf/
│       └── sample_drawing.pdf
└── test_*.py
```

### Creating Test Data

#### 1. In-Memory Test Data

```python
def _create_test_positions():
    """Create test position data"""
    return [
        {
            "code": "121151113",
            "description": "Beton C 25/30",
            "unit": "m3",
            "quantity": 10.5,
            "unit_price": 2500.0
        },
        {
            "code": "121151114",
            "description": "Beton C 30/37",
            "unit": "m3",
            "quantity": 5.0,
            "unit_price": 2800.0
        }
    ]
```

#### 2. Temporary Files

```python
def _build_test_workbook(path: Path) -> None:
    """Build test Excel workbook"""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Positions"

    # Headers
    ws.append(["Kód položky", "Popis", "MJ", "Množství", "Cena celkem"])

    # Data rows
    for i in range(10):
        ws.append([
            f"CODE{i:03d}",
            f"Position {i}",
            "m3",
            "10,5",
            "5 000,00"
        ])

    wb.save(path)


def test_excel_parsing(tmp_path):
    """Test Excel parsing with generated file"""
    file_path = tmp_path / "test.xlsx"
    _build_test_workbook(file_path)

    parser = ExcelParser()
    result = parser.parse(file_path)

    assert len(result["positions"]) == 10
```

#### 3. Fixture Files

For complex test data that's reused:

```python
# Store in tests/fixtures/
FIXTURES_DIR = Path(__file__).parent / "fixtures"

@pytest.fixture
def sample_kros_xml():
    """Load sample KROS XML file"""
    file_path = FIXTURES_DIR / "xml" / "kros_sample.xml"
    return file_path
```

### Test Data Best Practices

- ✅ Use `tmp_path` for temporary files
- ✅ Clean up after tests (pytest handles this for `tmp_path`)
- ✅ Keep test data small and focused
- ✅ Generate data programmatically when possible
- ❌ Don't commit large binary files to git
- ❌ Don't use production data in tests

---

## Coverage & CI/CD

### Coverage Configuration

Create `.coveragerc`:

```ini
[run]
source = app
omit =
    */tests/*
    */venv/*
    */__pycache__/*
    */site-packages/*

[report]
precision = 2
show_missing = True
skip_covered = False

[html]
directory = htmlcov
```

### Running Coverage

```bash
# Generate coverage report
pytest --cov=app --cov-report=term-missing

# HTML report (detailed)
pytest --cov=app --cov-report=html
open htmlcov/index.html

# XML report (for CI/CD)
pytest --cov=app --cov-report=xml

# Fail if coverage below threshold
pytest --cov=app --cov-fail-under=80
```

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Run tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          pytest -v --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
```

#### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Running tests..."
pytest tests/test_imports.py -v

if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi

echo "Tests passed. Proceeding with commit."
```

### Coverage Goals

| Layer | Target Coverage | Priority |
|-------|----------------|----------|
| **Parsers** | 90%+ | High |
| **Services** | 85%+ | High |
| **API Routes** | 80%+ | Medium |
| **Utils** | 80%+ | Medium |
| **Models** | 70%+ | Low |

---

## Troubleshooting

### Common Issues

#### 1. Import Errors

**Problem:**
```
ImportError: attempted relative import with no known parent package
```

**Solution:**
```bash
# Add project root to Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Or use pytest from project root
cd /path/to/concrete-agent
pytest
```

#### 2. Async Test Errors

**Problem:**
```
RuntimeWarning: coroutine 'test_async' was never awaited
```

**Solution:**
```python
# Add @pytest.mark.asyncio decorator
@pytest.mark.asyncio
async def test_async_function():
    result = await async_operation()
    assert result is not None
```

#### 3. Fixture Not Found

**Problem:**
```
fixture 'my_fixture' not found
```

**Solution:**
```python
# Ensure fixture is in scope:
# 1. Same file as test
# 2. In conftest.py
# 3. Imported correctly

@pytest.fixture
def my_fixture():
    return "test_data"
```

#### 4. Mock Not Working

**Problem:**
```
Mock was never called
```

**Solution:**
```python
# Ensure correct import path
# ❌ Wrong
@patch('anthropic.Anthropic')

# ✅ Correct (where it's imported)
@patch('app.core.claude_client.anthropic.Anthropic')
```

#### 5. Temp File Cleanup

**Problem:**
Files accumulate in `/tmp`

**Solution:**
```python
# Use tmp_path (auto-cleanup)
def test_with_temp_file(tmp_path):
    file_path = tmp_path / "test.txt"
    # pytest cleans up automatically

# Or manual cleanup
@pytest.fixture
def temp_file():
    path = Path("/tmp/test.txt")
    path.write_text("test")
    yield path
    path.unlink()  # Cleanup
```

### Debugging Tests

#### 1. Print Debug Info

```bash
# Show print statements
pytest -s

# Show captured logs
pytest --log-cli-level=DEBUG

# Verbose output
pytest -vv
```

#### 2. Drop into Debugger

```python
def test_with_debugger():
    result = complex_function()

    import pdb; pdb.set_trace()  # Debugger here

    assert result == expected
```

#### 3. Run Single Test

```bash
# Run specific test
pytest tests/test_imports.py::test_config_import -v

# Stop on first failure
pytest -x

# Show local variables on failure
pytest -l
```

### Performance Issues

#### 1. Slow Tests

```bash
# Identify slow tests
pytest --durations=10

# Run in parallel (requires pytest-xdist)
pip install pytest-xdist
pytest -n auto
```

#### 2. Mock Expensive Operations

```python
# Mock Claude API calls
@patch('app.core.claude_client.ClaudeClient.parse_xml')
def test_without_api_call(mock_parse):
    mock_parse.return_value = {"positions": []}
    # Test runs instantly, no API call
```

### Test Isolation

Ensure tests don't interfere with each other:

```python
# Clear state between tests
@pytest.fixture(autouse=True)
def reset_state():
    """Auto-run before each test"""
    from app.services.workflow_a import workflow_a
    workflow_a._workflows.clear()
    yield
    workflow_a._workflows.clear()
```

---

## Appendix

### Test Checklist

Before committing code:

- [ ] All tests pass locally (`pytest -v`)
- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] Tests are isolated (no interdependencies)
- [ ] Test names are descriptive
- [ ] Mocks are used for external APIs
- [ ] Coverage is adequate (aim for 80%+)
- [ ] No hardcoded paths or API keys
- [ ] Tests run in CI/CD

### Additional Resources

- **pytest documentation**: https://docs.pytest.org/
- **pytest-asyncio**: https://pytest-asyncio.readthedocs.io/
- **unittest.mock**: https://docs.python.org/3/library/unittest.mock.html
- **FastAPI testing**: https://fastapi.tiangolo.com/tutorial/testing/

### Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Technical specification
- [CONFIG.md](CONFIG.md) - Configuration reference
- [README.md](../README.md) - Project overview

---

**Last updated:** 2025-01-26
**Maintainer:** Development Team
**Questions?** Open an issue on GitHub
