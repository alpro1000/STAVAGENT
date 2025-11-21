# Testing Guide

> Complete testing documentation for Concrete Agent

**Document version:** 2.0.0
**Last updated:** 2025-01-26
**Maintainer:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Organization](#test-organization)
4. [Test Categories](#test-categories)
5. [Running Tests](#running-tests)
6. [Mock Structures](#mock-structures)
7. [Business-Critical Scenarios](#business-critical-scenarios)
8. [Passing & Failing Tests](#passing--failing-tests)
9. [Coverage Analysis](#coverage-analysis)
10. [Writing Tests](#writing-tests)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### Testing Philosophy

Concrete Agent uses **pytest** for comprehensive testing across all layers:

- **Unit tests**: Individual functions and classes
- **Integration tests**: Component interactions
- **E2E tests**: Complete workflows
- **API tests**: REST endpoint validation
- **Security tests**: Vulnerability checks
- **Performance tests**: Bottleneck identification

### Current Test Statistics

**As of 2025-01-26:**

```
Total tests: 67
✅ Passing: 65 (97%)
❌ Failing: 2 (3%)
Test files: 16
Test execution time: ~17 seconds
```

**Test distribution by category:**

| Category | Count | % |
|----------|-------|---|
| Security | 13 | 19.4% |
| Integration | 8 | 11.9% |
| Import/Validation | 6 | 9.0% |
| Unit (Services) | 15 | 22.4% |
| Parser | 12 | 17.9% |
| E2E | 5 | 7.5% |
| API | 8 | 11.9% |

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

# Run with coverage report (requires pytest-cov)
pip install pytest-cov
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

# E2E test: complete workflow
pytest tests/test_workflow_a_e2e_numbers.py -v
```

---

## Test Organization

### Directory Structure

```
tests/
├── conftest.py                       # (NOT PRESENT - fixtures are local)
│
├── test_imports.py                   # [6] Import validation (CI/CD)
├── test_workflow_a_integration.py    # [5] Workflow A integration
├── test_workflow_a_e2e_numbers.py    # [1] E2E: European number parsing
├── test_workflow_a_artifacts.py      # [2] ❌ Artifact generation (2 failing)
│
├── test_file_security.py             # [13] Security tests (path traversal, etc.)
├── test_empty_file_params.py         # [2] Edge case handling
│
├── test_kros_parsing.py              # [1] KROS UNIXML parsing
├── test_xc4_parser.py                # [3] XC4 parser
├── test_otskp_normalizer.py          # [4] OTSKP normalization
│
├── test_position_enricher.py         # [3] Position enrichment
├── test_export_and_enrich.py         # [5] Export functionality
├── test_audit_counters.py            # [1] Audit statistics
├── test_audit_contract_structures.py # [8] Contract validation
├── test_model_unification.py         # [8] Data model tests
│
├── services/
│   └── test_pdf_text_recovery_ocr.py # [3] PDF OCR recovery
│
└── prompts/
    └── test_pdf_prompt_v2_1.py       # [3] Prompt validation
```

**Legend:** `[N]` = number of test cases in file

### Naming Conventions

- **Test files**: `test_*.py` (pytest auto-discovery)
- **Test functions**: `test_*()` (pytest auto-discovery)
- **Test classes**: `Test*` (optional, for grouping)
- **Fixtures**: `@pytest.fixture` decorator
- **Async tests**: `async def test_*()` with `@pytest.mark.asyncio`

### No Global conftest.py

**Important:** This project does NOT use a global `conftest.py`. All fixtures are defined locally within test files where they're used. This approach:

✅ **Advantages:**
- Explicit fixture dependencies
- Easier to understand test context
- No hidden global state

❌ **Disadvantages:**
- Fixture duplication (e.g., `client`, `tmp_path` usage)
- Slightly more verbose

---

## Test Categories

### 1. Import Validation Tests

**File:** `tests/test_imports.py` (6 tests)

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

**Tests included:**
1. `test_config_import()` - Config module loads
2. `test_config_paths()` - All paths initialized (DATA_DIR, KB_DIR, etc.)
3. `test_fastapi_app_import()` - FastAPI app loads
4. `test_multi_role_config()` - Multi-role settings accessible
5. `test_feature_flags()` - Feature flags (ENABLE_WORKFLOW_A, etc.)
6. `test_environment_detection()` - Environment detection (dev/staging/prod)

**Purpose:**
- Catch circular import errors
- Validate environment setup
- Ensure configuration loads correctly
- CI/CD pipeline validation

**Reference:** tests/test_imports.py:10-103

---

### 2. Integration Tests

**File:** `tests/test_workflow_a_integration.py` (5 tests)

Tests interactions between components without full E2E flow.

```python
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

**Tests included:**
1. `test_workflow_a_import()` - Workflow instance loads
2. `test_workflow_a_method_signature()` - Method signature validation
3. `test_workflow_a_routes_import()` - Routes can import workflow
4. `test_workflow_a_run_with_invalid_project()` - Error handling for invalid project
5. `test_workflow_a_run_with_mock_project()` - Mocked execution

**Covers:**
- Service layer interactions
- Method signature validation
- Async workflow execution
- Error handling
- Argument forwarding (kwargs)

**Reference:** tests/test_workflow_a_integration.py:10-103

---

### 3. End-to-End (E2E) Tests

**File:** `tests/test_workflow_a_e2e_numbers.py` (1 test, 120 lines)

Tests complete workflows from input to output WITHOUT mocking.

```python
def test_e2e_excel_to_export(tmp_path):
    """Complete workflow: Excel parsing → validation → audit → export"""

    # 1. Create test data with European numbers (spaces, commas)
    source_path = tmp_path / "eu_numbers.xlsx"
    _build_test_workbook(source_path)

    # 2. Parse Excel
    parser = ExcelParser()
    parsed = parser.parse(source_path)
    assert len(parsed["positions"]) == 53
    assert parsed["diagnostics"]["normalization"]["numbers_locale"] == "EU"

    # 3. Validate schema
    validator = PositionValidator()
    result = validator.validate(parsed["positions"])
    assert result.stats["validated_total"] == 53
    assert result.stats["invalid_total"] == 0

    # 4. Enrich positions (mocked)
    for idx, position in enumerate(result.positions):
        payload = dict(position)
        if idx < 48:
            payload["validation_status"] = "passed"
            payload["enrichment"] = {"match": "exact"}
            payload["unit_price"] = 120.0
        # ... amber and red positions

    # 5. Audit classification
    classifier = AuditClassifier()
    audited, stats = classifier.classify(prepared_positions)
    assert stats["green"] == 48
    assert stats["amber"] == 3
    assert stats["red"] == 2

    # 6. Export to Excel
    exporter = AuditExcelExporter()
    output_path = tmp_path / "export.xlsx"
    exported_path = await exporter.export(project, output_path)
    assert exported_path.exists()

    # 7. Verify Excel structure
    workbook = load_workbook(exported_path)
    assert "Audit_Triage" in workbook.sheetnames
    assert "Positions" in workbook.sheetnames
```

**E2E Scenarios Tested:**
- ✅ European number format parsing (spaces: `1 200,50`, NBSP: `2 000,75`, NNBSP: `3 500,00`)
- ✅ Complete pipeline: Parse → Validate → Enrich → Audit → Export
- ✅ Multi-step data transformations (53 positions)
- ✅ Excel file I/O operations
- ✅ Color-coded export (GREEN/AMBER/RED sheets)
- ✅ Statistics aggregation (48 green, 3 amber, 2 red)

**Reference:** tests/test_workflow_a_e2e_numbers.py:39-120

---

### 4. API Tests

**File:** `tests/test_workflow_a_artifacts.py` (2 tests, ❌ BOTH FAILING)

Tests FastAPI REST endpoint functionality.

```python
@pytest.fixture
def artifact_project() -> str:
    """Create test project with audit results"""
    project_store.clear()
    workflow_a._workflows.clear()

    project_id = "workflow-a-artifacts"

    # Create audit payload
    audit_payload = {
        "totals": {"g": 1, "a": 1, "r": 0, "total": 2},
        "items": [
            {
                "code": "BET001",
                "description": "Beton základů C30/37",
                "unit": "m3",
                "quantity": 12.5,
                "status": "GREEN",
            },
            # ... more items
        ],
        # ... meta, diagnostics
    }

    # Save to project store
    project_store[project_id] = {
        "project_id": project_id,
        "workflow": "A",
        "audit_results": audit_payload,
    }

    # Save cache
    save_project_cache(project_id, cache_payload)

    yield project_id

    # Cleanup
    workflow_a._workflows.clear()
    project_store.clear()


def test_workflow_a_tech_card_generation_and_caching(client, artifact_project):
    """Test tech card generation via API"""
    project_id = artifact_project

    # First request: generate artifact
    response = client.get(f"/api/workflow-a/workflow/a/{project_id}/tech-card")
    assert response.status_code == 200  # ❌ FAILS: 404 Not Found
    tech_card = response.json()

    assert tech_card["type"] == "tech_card"
    assert "steps" in tech_card["data"]

    # Verify file cached
    tech_path = _curated_path(project_id, "tech_card.json")
    assert tech_path.exists()

    # Second request: should use cache
    second_response = client.get(f"/api/workflow-a/workflow/a/{project_id}/tech-card")
    assert second_response.status_code == 200
    assert second_response.json() == tech_card
```

**API Tests:**
1. ❌ `test_workflow_a_tech_card_generation_and_caching` - Tech card generation + caching
2. ❌ `test_workflow_a_resource_and_material_artifacts` - Resource sheet + material analysis

**Tested endpoints:**
- `GET /api/workflow-a/workflow/a/{project_id}/tech-card`
- `GET /api/workflow-a/workflow/a/{project_id}/resource-sheet`
- `GET /api/workflow-a/workflow/a/{project_id}/material-analysis`

**Why failing:**
- 404 Not Found - Likely route mismatch or missing route registration
- Endpoints may not exist or have different paths
- See [Failing Tests](#passing--failing-tests) section for details

**Reference:** tests/test_workflow_a_artifacts.py:142-191

---

### 5. Security Tests

**File:** `tests/test_file_security.py` (13 tests, ✅ ALL PASSING)

Tests security vulnerabilities and protection mechanisms.

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

        # CRITICAL: Verify NO server paths
        assert "path" not in metadata
        assert str(temp_project_dir) not in str(metadata)
        assert "/opt" not in str(metadata)
        assert "/home" not in str(metadata)


class TestDownloadEndpointSecurity:
    """Test download endpoint security protections"""

    def test_path_traversal_protection(self, client):
        """Test that path traversal attacks are blocked"""
        malicious_file_ids = [
            "proj_test123:vykresy:../../etc/passwd",
            "proj_test123:vykresy:../../../etc/shadow",
            "proj_test123:vykresy:..%2F..%2Fetc%2Fpasswd",
        ]

        for file_id in malicious_file_ids:
            response = client.get(f"/api/projects/proj_test123/files/{file_id}/download")

            # Should be rejected (403 or 404)
            assert response.status_code in [403, 404]
```

**Security test coverage:**

**1. File Metadata Safety (3 tests):**
- ✅ `test_creates_safe_metadata_without_paths` - No server paths exposed
- ✅ `test_file_id_format` - Correct file_id format (project_id:file_type:filename)
- ✅ `test_includes_all_required_fields` - All safe fields present

**2. Upload Security (2 tests):**
- ✅ `test_upload_response_has_no_paths` - Upload response has no server paths
- ✅ `test_upload_rejects_traversal_filename` - Path traversal in filename rejected

**3. Download Security (3 tests):**
- ✅ `test_path_traversal_protection` - Path traversal attacks blocked
- ✅ `test_cross_project_access_denied` - Cross-project file access denied
- ✅ `test_invalid_file_id_format` - Invalid file_id formats rejected

**4. File Listing Security (1 test):**
- ✅ `test_file_listing_has_no_paths` - File listing has no server paths

**5. Integration Security (4 tests):**
- ✅ `test_complete_secure_flow` - Upload → List → Download flow secure

**Attack vectors tested:**
- `../../etc/passwd` - Standard path traversal
- `../../../etc/shadow` - Multi-level traversal
- `..%2F..%2Fetc%2Fpasswd` - URL-encoded traversal
- `....//....//etc/passwd` - Double-dot traversal
- Cross-project access attempts
- Invalid file_id formats

**Reference:** tests/test_file_security.py:42-384

---

### 6. Parser Tests

**Files:**
- `tests/test_kros_parsing.py` (1 test)
- `tests/test_xc4_parser.py` (3 tests)
- `tests/test_otskp_normalizer.py` (4 tests)

Tests document parsing logic for various formats.

```python
def test_kros_unixml_parsing():
    """Test KROS UNIXML file parsing"""
    client = ClaudeClient()
    test_xml_path = Path("test_files/RD_Valcha_SO1_SO2.xml")

    if not test_xml_path.exists():
        print(f"❌ Test file not found: {test_xml_path}")
        return False

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

**Parser coverage:**
1. **KROS UNIXML parsing** (tests/test_kros_parsing.py)
   - XML structure detection
   - Document metadata extraction
   - Position parsing
   - Object/section hierarchy

2. **XC4 format parsing** (tests/test_xc4_parser.py)
   - XC4 binary format
   - Czech construction software format

3. **Excel parsing** (test_workflow_a_e2e_numbers.py)
   - XLSX parsing with openpyxl
   - European number normalization
   - Multi-sheet handling

4. **PDF parsing** (tests/services/test_pdf_text_recovery_ocr.py)
   - Text extraction with pdfplumber
   - OCR fallback for scanned PDFs

5. **OTSKP normalization** (tests/test_otskp_normalizer.py)
   - Text normalization (accents, spaces)
   - Entity extraction (concrete classes, exposure, units)

**Reference:** tests/test_kros_parsing.py:16-140

---

### 7. Service Layer Tests

**Files:**
- `tests/test_position_enricher.py` (3 tests)
- `tests/test_audit_counters.py` (1 test)
- `tests/test_audit_contract_structures.py` (8 tests)
- `tests/test_export_and_enrich.py` (5 tests)

Tests business logic services.

```python
@pytest.fixture()
def dummy_kb() -> types.SimpleNamespace:
    """Create dummy knowledge base for testing"""
    return types.SimpleNamespace(
        kb_b1={
            "otskp": {
                "AAA-001": {
                    "code": "AAA-001",
                    "name": "Beton C20/25 základová deska",
                    "unit": "m3",
                    "tech_spec": "C20/25 XC2",
                },
            }
        }
    )


def test_enricher_exact_match_by_code(dummy_kb):
    """Test position enrichment with exact KROS code match"""
    enricher = PositionEnricher(enabled=True, kb_loader=dummy_kb)
    positions = [{"code": "AAA-001", "description": "Beton C20/25", "unit": "m3"}]

    enriched, stats = enricher.enrich(positions, drawing_payload=[])

    assert stats["matched"] == 1
    block = enriched[0]["enrichment"]
    assert block["match"] == "exact"
    assert block["score"] == 1.0
    assert block["evidence"]
```

**Services tested:**

1. **Position Enrichment** (test_position_enricher.py)
   - Exact code matching
   - Partial fuzzy matching
   - Unmatched positions
   - KROS/RTS database lookup
   - Evidence generation

2. **Audit Classification** (test_audit_contract_structures.py)
   - GREEN/AMBER/RED classification
   - Multi-role expert system (SME, ARCH, ENG, SUP)
   - Consensus algorithm
   - Statistics aggregation

3. **Audit Counters** (test_audit_counters.py)
   - Counter propagation to project store
   - Statistics consistency
   - Diagnostics metadata sync

4. **Export** (test_export_and_enrich.py)
   - Excel export with openpyxl
   - Multi-sheet structure (Summary, All, GREEN, AMBER, RED)
   - Color coding
   - Formulas and conditional formatting

**Reference:** tests/test_position_enricher.py:46-74

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
pip install pytest-xdist
pytest -n auto
```

### Filtering Tests

```bash
# Run only integration tests
pytest tests/test_workflow_a_integration.py

# Run only E2E tests
pytest tests/test_workflow_a_e2e_numbers.py

# Run only security tests
pytest tests/test_file_security.py

# Run tests with markers (if defined in pytest.ini)
pytest -m "slow"
pytest -m "not slow"

# Exclude specific tests
pytest --ignore=tests/test_workflow_a_artifacts.py
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

# Show local variables on failure
pytest -l
```

### Coverage Reports

```bash
# Install coverage plugin
pip install pytest-cov

# Generate coverage report
pytest --cov=app

# HTML coverage report
pytest --cov=app --cov-report=html
# Open: htmlcov/index.html

# Terminal coverage report with missing lines
pytest --cov=app --cov-report=term-missing

# Coverage for specific module
pytest --cov=app.parsers tests/test_kros_parsing.py

# Fail if coverage below threshold
pytest --cov=app --cov-fail-under=80
```

---

## Mock Structures

### Mock Patterns Used

This project uses several mocking patterns for testing external dependencies, async operations, and I/O.

#### 1. AsyncMock for Async Functions

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_workflow_execution():
    """Test async workflow execution with mocked execute"""
    from app.services.workflow_a import workflow_a, WorkflowA

    with patch.object(WorkflowA, 'execute', new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = {"success": True, "artifact": "tech_card"}

        result = await workflow_a.run(
            project_id="test-123",
            action="tech_card",
            extra_option=True
        )

    assert result["success"] is True
    mock_execute.assert_awaited_once_with(
        project_id="test-123",
        action="tech_card",
        extra_option=True
    )
```

**Key points:**
- Use `new_callable=AsyncMock` for async functions
- Verify with `assert_awaited_once()` or `assert_awaited_once_with()`
- Mock async return values with `mock.return_value = ...`

**Reference:** tests/test_workflow_a_integration.py:71-98

---

#### 2. TestClient for FastAPI

```python
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    """Create FastAPI test client"""
    return TestClient(app)


def test_upload_endpoint(client):
    """Test file upload endpoint"""
    response = client.post(
        "/api/upload",
        data={
            "project_name": "Test Project",
            "workflow": "A",
            "auto_start_audit": "false"
        },
        files={
            "vykaz_vymer": ("test.xml", BytesIO(b"content"), "application/xml"),
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "project_id" in data
```

**Key points:**
- `TestClient` doesn't start a real server (runs ASGI app directly)
- No need for `@pytest.mark.asyncio` with TestClient
- Supports multipart form data with `files=...`

**Reference:** tests/test_file_security.py:19-23, 108-135

---

#### 3. monkeypatch for Environment Variables

```python
def test_with_env_var(monkeypatch):
    """Test with mocked environment variable"""
    import tempfile
    temp_data_dir = Path(tempfile.mkdtemp())

    from app.core import config
    monkeypatch.setattr(config.settings, 'DATA_DIR', temp_data_dir)

    # Now settings.DATA_DIR points to temp directory
    assert config.settings.DATA_DIR == temp_data_dir
```

**Key points:**
- Use `monkeypatch.setattr()` to modify attributes
- Use `monkeypatch.setenv()` for environment variables
- Automatically restored after test

**Reference:** tests/test_file_security.py:108-116

---

#### 4. SimpleNamespace for Dummy Objects

```python
import types

@pytest.fixture()
def dummy_kb() -> types.SimpleNamespace:
    """Create dummy knowledge base"""
    return types.SimpleNamespace(
        kb_b1={
            "otskp": {
                "AAA-001": {
                    "code": "AAA-001",
                    "name": "Beton C20/25 základová deska",
                    "unit": "m3",
                },
            }
        }
    )


def test_enricher(dummy_kb):
    """Test with dummy KB"""
    enricher = PositionEnricher(enabled=True, kb_loader=dummy_kb)
    # enricher.kb_loader.kb_b1["otskp"]["AAA-001"] works!
```

**Key points:**
- `SimpleNamespace` allows attribute access (`obj.attr`)
- Useful for mocking complex objects without full class implementation
- Lighter than `MagicMock` when you only need data

**Reference:** tests/test_position_enricher.py:14-32

---

#### 5. tmp_path for Temporary Files

```python
def test_excel_export(tmp_path):
    """Test Excel export with temporary file"""
    # tmp_path is a pathlib.Path to a temporary directory

    # Create test file
    source_file = tmp_path / "input.xlsx"
    _build_test_workbook(source_file)

    # Process
    parser = ExcelParser()
    result = parser.parse(source_file)

    # Export
    output_file = tmp_path / "output.xlsx"
    exporter.export(result, output_file)

    # Verify
    assert output_file.exists()

    # Cleanup is automatic - pytest removes tmp_path after test
```

**Key points:**
- `tmp_path` is a built-in pytest fixture (no import needed)
- Returns a `pathlib.Path` to a unique temporary directory
- Automatically cleaned up after test
- Unique per test (no conflicts)

**Reference:** tests/test_workflow_a_e2e_numbers.py:39-109

---

#### 6. patch for External APIs

```python
from unittest.mock import patch, MagicMock

@patch('app.core.claude_client.anthropic.Anthropic')
def test_claude_api_call(mock_anthropic):
    """Mock Anthropic Claude API"""
    # Setup mock response
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"result": "success"}')]
    mock_anthropic.return_value.messages.create.return_value = mock_response

    # Call code that uses Claude
    client = ClaudeClient()
    result = client.parse_xml(Path("test.xml"))

    assert result == {"result": "success"}

    # Verify API was called
    mock_anthropic.return_value.messages.create.assert_called_once()
```

**Key points:**
- Patch where the object is IMPORTED, not where it's DEFINED
- ❌ Wrong: `@patch('anthropic.Anthropic')`
- ✅ Correct: `@patch('app.core.claude_client.anthropic.Anthropic')`
- Use `MagicMock()` for complex nested objects

---

### Fixture Scopes

| Scope | Lifetime | Use Case | Example |
|-------|----------|----------|---------|
| `function` | Per test (default) | Most common | `@pytest.fixture` |
| `class` | Per test class | Shared setup for class | `@pytest.fixture(scope="class")` |
| `module` | Per module | Expensive setup (DB) | `@pytest.fixture(scope="module")` |
| `session` | Entire test session | Global config | `@pytest.fixture(scope="session")` |

```python
@pytest.fixture(scope="session")
def database_connection():
    """Expensive: create once per session"""
    conn = create_connection()
    yield conn
    conn.close()
```

---

## Business-Critical Scenarios

These are the **most important test scenarios** that validate core business functionality. If these fail, the system is broken.

### 1. Complete Workflow A Pipeline ⭐⭐⭐⭐⭐

**File:** tests/test_workflow_a_e2e_numbers.py::test_e2e_excel_to_export

**Scenario:** User uploads Excel BoQ → System parses → validates → enriches → audits → exports classified report

**Critical because:**
- This is the PRIMARY use case (Workflow A)
- Tests entire data pipeline
- Validates European number parsing (Czech locale)
- Tests classification logic (GREEN/AMBER/RED)
- Verifies Excel export structure

**Input:**
- 53 positions with European numbers (`1 200,50`, `2 000,75`, `3 500,00`)
- Mixed validation status (48 passed, 3 warning, 2 failed)

**Expected output:**
- 48 GREEN positions (approved)
- 3 AMBER positions (review needed)
- 2 RED positions (rejected)
- Excel file with 5 sheets: Summary, All Positions, GREEN, AMBER, RED

**Reference:** tests/test_workflow_a_e2e_numbers.py:39-120

---

### 2. Security: No Server Path Leakage ⭐⭐⭐⭐⭐

**File:** tests/test_file_security.py (13 tests)

**Scenario:** All API endpoints must NEVER expose server file paths to prevent information disclosure vulnerability

**Critical because:**
- Security vulnerability (CWE-200: Information Disclosure)
- Could expose server structure to attackers
- Could lead to path traversal attacks
- Compliance requirement (GDPR, data protection)

**Test coverage:**
- ✅ Upload response has no paths
- ✅ File listing has no paths
- ✅ Download endpoint protected
- ✅ Path traversal attacks blocked
- ✅ Cross-project access denied

**Attack vectors tested:**
- `../../etc/passwd`
- `../../../etc/shadow`
- `..%2F..%2Fetc%2Fpasswd` (URL encoded)
- Cross-project file access

**Reference:** tests/test_file_security.py:42-384

---

### 3. KROS/OTSKP Position Enrichment ⭐⭐⭐⭐

**File:** tests/test_position_enricher.py

**Scenario:** System must match positions to KROS/OTSKP database to provide pricing and specifications

**Critical because:**
- Core business logic for Workflow A
- Determines position pricing
- Provides technical specifications
- Affects audit classification

**Matching strategies:**
1. **Exact match by code** (score: 1.0)
   - Input: `{"code": "AAA-001", "description": "Beton C20/25"}`
   - Match: KROS code AAA-001
   - Result: `{"match": "exact", "score": 1.0}`

2. **Partial fuzzy match** (score: 0.75+)
   - Input: `{"code": "", "description": "Betonáž základové desky C20/25"}`
   - Match: Fuzzy search finds "Beton C20/25 základová deska"
   - Result: `{"match": "partial", "score": 0.85}`

3. **No match** (score: 0.0)
   - Input: `{"code": "UNKNOWN", "description": "Special custom material"}`
   - Match: None
   - Result: `{"match": "none", "enrichment_status": "unmatched"}`

**Reference:** tests/test_position_enricher.py:46-74

---

### 4. Multi-Role Audit Classification ⭐⭐⭐⭐

**File:** tests/test_audit_contract_structures.py (8 tests)

**Scenario:** AI audit system with multiple expert roles (SME, ARCH, ENG, SUP) must classify positions as GREEN/AMBER/RED with consensus

**Critical because:**
- Core differentiation feature (multi-expert validation)
- Affects project approval workflow
- Determines which positions need human review
- Business logic for HITL (Human-in-the-Loop)

**Classification logic:**

```python
GREEN (Approved):
- validation_status: "passed"
- enrichment: {"match": "exact"}
- All expert roles agree
- No issues found

AMBER (Review needed):
- validation_status: "warning"
- enrichment: {"match": "partial"}
- Partial match or minor issues
- Requires human review

RED (Rejected):
- validation_status: "failed"
- enrichment: {"match": "none"}
- Critical issues found
- Requires correction
```

**Test scenarios:**
1. All GREEN classification
2. Mixed GREEN/AMBER/RED
3. Counter propagation to project store
4. Audit statistics accuracy
5. Contract structure validation

**Reference:** tests/test_audit_contract_structures.py

---

### 5. Excel Export with Classification ⭐⭐⭐⭐

**File:** tests/test_export_and_enrich.py (5 tests)

**Scenario:** System must export audit results to Excel with color-coded sheets and statistics

**Critical because:**
- PRIMARY output format for users
- Must be accurate for downstream workflows
- Color coding helps users identify issues
- Statistics must match audit results

**Excel structure:**

```
Workbook:
├── Summary Sheet
│   ├── Project metadata
│   ├── Statistics (total, green, amber, red)
│   └── Diagnostic summary
│
├── All Positions (53 rows)
│   ├── Color coded by status
│   └── All fields included
│
├── GREEN (48 rows)
│   └── Approved positions only
│
├── AMBER (3 rows)
│   └── Positions needing review
│
└── RED (2 rows)
    └── Rejected positions
```

**Validation:**
- ✅ All sheets present
- ✅ Correct row counts per sheet
- ✅ Statistics match classification
- ✅ Color coding applied
- ✅ Formulas work (totals, percentages)

**Reference:** tests/test_export_and_enrich.py

---

### 6. Import Validation (CI/CD) ⭐⭐⭐

**File:** tests/test_imports.py (6 tests)

**Scenario:** All critical modules must import successfully without errors

**Critical because:**
- First test run in CI/CD pipeline
- Catches circular import errors
- Validates environment setup
- Fast feedback (< 1 second)

**Modules tested:**
- ✅ Config module loads
- ✅ FastAPI app loads
- ✅ All routes registered
- ✅ Feature flags accessible
- ✅ Multi-role config loads
- ✅ Environment detected

**CI/CD workflow:**
```bash
# Run imports first (fast failure)
pytest tests/test_imports.py -v

# If pass, run full test suite
pytest -v
```

**Reference:** tests/test_imports.py:10-103

---

### 7. Async Workflow Execution ⭐⭐⭐

**File:** tests/test_workflow_a_integration.py

**Scenario:** Workflow execution must be async and handle concurrent requests

**Critical because:**
- System uses FastAPI (async framework)
- Must handle multiple users concurrently
- Prevents blocking I/O operations
- Validates async/await patterns

**Test patterns:**
```python
@pytest.mark.asyncio
async def test_async_workflow():
    """Test async workflow execution"""
    result = await workflow_a.run(
        project_id="test-123",
        action="execute"
    )
    assert result["status"] == "completed"
```

**Reference:** tests/test_workflow_a_integration.py:71-98

---

## Passing & Failing Tests

### Current Status (2025-01-26)

```
Total: 67 tests
✅ Passing: 65 (97%)
❌ Failing: 2 (3%)
⏱️ Execution time: ~17 seconds
```

### Passing Tests Summary

**All tests pass except for artifact generation.** Here's the breakdown:

| Category | File | Tests | Status |
|----------|------|-------|--------|
| **Import** | test_imports.py | 6 | ✅ 6/6 |
| **Integration** | test_workflow_a_integration.py | 5 | ✅ 5/5 |
| **E2E** | test_workflow_a_e2e_numbers.py | 1 | ✅ 1/1 |
| **Security** | test_file_security.py | 13 | ✅ 13/13 |
| **Parser** | test_kros_parsing.py | 1 | ✅ 1/1 |
| **Parser** | test_xc4_parser.py | 3 | ✅ 3/3 |
| **Parser** | test_otskp_normalizer.py | 4 | ✅ 4/4 |
| **Service** | test_position_enricher.py | 3 | ✅ 3/3 |
| **Service** | test_audit_counters.py | 1 | ✅ 1/1 |
| **Service** | test_audit_contract_structures.py | 8 | ✅ 8/8 |
| **Service** | test_export_and_enrich.py | 5 | ✅ 5/5 |
| **Service** | test_model_unification.py | 8 | ✅ 8/8 |
| **Edge Cases** | test_empty_file_params.py | 2 | ✅ 2/2 |
| **PDF** | test_pdf_text_recovery_ocr.py | 3 | ✅ 3/3 |
| **Prompts** | test_pdf_prompt_v2_1.py | 3 | ✅ 3/3 |
| **API** | test_workflow_a_artifacts.py | 2 | ❌ 0/2 |

---

### Failing Tests (2)

#### ❌ Test 1: tech_card_generation_and_caching

**File:** tests/test_workflow_a_artifacts.py:142
**Status:** FAILING
**Error:** `assert 404 == 200`

```python
def test_workflow_a_tech_card_generation_and_caching(client, artifact_project):
    project_id = artifact_project

    response = client.get(f"/api/workflow-a/workflow/a/{project_id}/tech-card")
    assert response.status_code == 200  # ❌ FAILS: 404 Not Found
```

**Actual response:** `404 Not Found`
**Expected response:** `200 OK` with tech_card JSON

**Root cause:**
- Route not found: `/api/workflow-a/workflow/a/{project_id}/tech-card`
- Likely route mismatch or endpoint not registered
- Possible duplicate prefix: `/workflow-a/workflow/a/` looks incorrect

**Investigation needed:**
1. Check `app/api/routes_workflow_a.py` for correct route path
2. Verify route registration in `app/api/__init__.py`
3. Check if endpoint exists or was renamed

**Reference:** tests/test_workflow_a_artifacts.py:142-166

---

#### ❌ Test 2: resource_and_material_artifacts

**File:** tests/test_workflow_a_artifacts.py:168
**Status:** FAILING
**Error:** `assert 404 == 200`

```python
def test_workflow_a_resource_and_material_artifacts(client, artifact_project):
    project_id = artifact_project

    resource_response = client.get(
        f"/api/workflow-a/workflow/a/{project_id}/resource-sheet"
    )
    assert resource_response.status_code == 200  # ❌ FAILS: 404 Not Found
```

**Actual response:** `404 Not Found`
**Expected response:** `200 OK` with resource_sheet JSON

**Root cause:** Same as Test 1
- Route not found: `/api/workflow-a/workflow/a/{project_id}/resource-sheet`
- Also tests: `/api/workflow-a/workflow/a/{project_id}/material-analysis`

**Reference:** tests/test_workflow_a_artifacts.py:168-191

---

### Why These Tests Fail

**Hypothesis:** Route prefix mismatch

The test uses:
```
/api/workflow-a/workflow/a/{project_id}/tech-card
```

But the actual route is likely:
```
/api/workflow/a/{project_id}/tech-card
```

Notice the duplicate `workflow-a/workflow/a/` → should be just `workflow/a/`.

**To fix:**
1. Check `app/api/routes_workflow_a.py` for route definitions
2. Update test URLs to match actual routes
3. Or update route registration if test URLs are correct

---

### Warnings (Non-Critical)

During test execution, several warnings appear (not causing failures):

```
⚠️  ANTHROPIC_API_KEY not set! Workflow A will not work.
⚠️  PERPLEXITY_API_KEY not set. Will use local KB only.
⚠️  pytest-asyncio deprecation warning
⚠️  Pydantic deprecation warnings (class-based config)
⚠️  SQLAlchemy MovedIn20Warning (declarative_base)
⚠️  FastAPI on_event deprecated (use lifespan)
⚠️  python_multipart pending deprecation
```

**Impact:** None (tests still pass)
**Action:** These can be addressed in future refactoring

---

## Coverage Analysis

### Coverage by Layer (Estimated)

| Layer | Coverage | Priority | Status |
|-------|----------|----------|--------|
| **API Routes** | ~70% | High | 🟡 Good |
| **Services** | ~85% | High | 🟢 Excellent |
| **Parsers** | ~80% | High | 🟢 Excellent |
| **Security** | ~95% | Critical | 🟢 Excellent |
| **Validators** | ~75% | Medium | 🟢 Good |
| **Utils** | ~60% | Medium | 🟡 Fair |
| **Models** | ~50% | Low | 🟡 Fair |

**Note:** These are estimates. Install `pytest-cov` for exact coverage:

```bash
pip install pytest-cov
pytest --cov=app --cov-report=html
```

---

### Coverage Goals

| Component | Target | Actual | Gap |
|-----------|--------|--------|-----|
| Security (file operations) | 100% | ~95% | -5% |
| Workflow A pipeline | 90% | ~85% | -5% |
| Parsers (KROS, Excel, XC4) | 90% | ~80% | -10% |
| Position enrichment | 85% | ~85% | ✅ |
| Audit classification | 85% | ~85% | ✅ |
| API endpoints | 80% | ~70% | -10% |

---

### Uncovered Areas

**Known gaps:**
1. **Workflow B** - No comprehensive E2E tests (only partial)
2. **PDF extraction** - Limited test coverage
3. **Drawing specifications parser** - No dedicated tests
4. **Chat endpoints** - No API tests
5. **Agent endpoints** - No API tests
6. **Error recovery** - Limited edge case testing
7. **Performance** - No load/stress tests

**Recommended additions:**
- E2E test for Workflow B (drawing → analysis → generation → audit)
- API tests for chat and agent endpoints
- Performance benchmarks (pytest-benchmark)
- Load testing (Locust or similar)

---

## Writing Tests

### Test Template

```python
"""
Tests for <component>
Description of what this test module covers
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
    # Create file...
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


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
```

---

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
# 2. In conftest.py (this project doesn't use it)
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

#### 5. 404 in API Tests

**Problem:**
```
assert 404 == 200
```

**Solution:**
```python
# Check route path in test vs. actual route
# Test uses:
response = client.get("/api/workflow-a/workflow/a/{id}/tech-card")

# But actual route might be:
# /api/workflow/a/{id}/tech-card
# (without duplicate "workflow-a/workflow")
```

---

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

---

## Related Documentation

- [API.md](API.md) - Complete API endpoint reference
- [WORKFLOWS.md](WORKFLOWS.md) - Workflow A and B step-by-step guides
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture and patterns
- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Technical specification
- [CONFIG.md](CONFIG.md) - Configuration reference
- [README.md](../README.md) - Project overview

---

**Last updated:** 2025-01-26
**Maintainer:** Development Team
**Questions?** Open an issue on GitHub
