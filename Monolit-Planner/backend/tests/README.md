# Monolit Planner Backend Tests

## Test Structure

```
tests/
├── helpers/                  # Test utilities
│   ├── test-db.js           # Test database setup and fixtures
│   └── test-server.js       # Test server configuration
├── integration/             # Integration tests (with real database)
│   ├── positions.integration.test.js
│   └── monolith-projects.integration.test.js
└── routes/                  # Unit tests (with mocked database)
    └── positions.test.js
```

## Running Tests

### Unit Tests (Mocked Database)
```bash
npm run test               # Run all unit tests
npm run test:unit          # Run unit tests only
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
```

### Integration Tests (Real Database)
```bash
npm run test:integration   # Run integration tests
npm run test:all          # Run both unit and integration tests
```

## Integration Test Setup

Integration tests use an **in-memory SQLite database** by default for speed and isolation.

### Configuration

- **In-Memory (default)**: `TEST_DB_IN_MEMORY=true` (or unset)
- **File-based (debugging)**: `TEST_DB_IN_MEMORY=false`

When using file-based testing, the test database is created at `backend/data/test.db` and is automatically cleaned up after tests.

## Test Database Helpers

The `tests/helpers/test-db.js` module provides utilities for integration tests:

### Setup/Teardown
```javascript
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearTestData
} from '../helpers/test-db.js';

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(() => {
  clearTestData();
});
```

### Fixtures
```javascript
import {
  createTestUser,
  createTestProject,
  createTestBridge,
  createTestPart,
  createTestPosition,
  seedTestOtskpCodes
} from '../helpers/test-db.js';

// Create test data
const user = createTestUser({ email: 'test@example.com' });
const project = createTestProject(user.id, { project_name: 'Test Project' });
const bridge = createTestBridge(project.project_id);
const part = createTestPart(project.project_id, { part_name: 'ZÁKLADY' });
const position = createTestPosition(bridge.bridge_id, part.part_id);
```

### Database Adapter
```javascript
import { createTestDbAdapter } from '../helpers/test-db.js';

const testDb = createTestDbAdapter();
// Use testDb like the production db module
```

## Current Status

### ✅ Completed
- Test database utilities with in-memory SQLite
- Comprehensive integration test suites for:
  - Positions CRUD operations
  - Monolith Projects CRUD operations
  - KROS rounding logic
  - Speed column calculations
  - VARIANT 1 architecture validation
- Jest configurations for unit and integration tests
- NPM scripts for running different test suites

### ⚠️ Known Issues
Integration tests require ES module mocking setup. Current integration tests are well-structured but need additional configuration to properly mock the database module due to ES module limitations.

### 🔄 Future Work
1. Complete ES module mocking setup for integration tests
2. Add integration tests for:
   - Bridges routes
   - Parts routes
   - Excel import/export
   - OTSKP code search
3. Increase test coverage to 80%+
4. Add performance benchmarks
5. Add E2E tests with real browser

## Writing New Tests

### Unit Test Example
```javascript
import { jest } from '@jest/globals';
import request from 'supertest';

// Mock database
const mockDb = {
  prepare: jest.fn()
};

jest.unstable_mockModule('../../src/db/init.js', () => ({
  default: mockDb
}));

describe('My Route', () => {
  it('should do something', async () => {
    // Test implementation
  });
});
```

### Integration Test Example
```javascript
import {
  setupTestDatabase,
  clearTestData,
  createTestUser
} from '../helpers/test-db.js';

describe('My Integration Test', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(() => {
    clearTestData();
  });

  it('should work with real database', () => {
    const user = createTestUser();
    // Test with real database operations
  });
});
```

## Test Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Routes | 80% | ~40% |
| Services | 80% | ~30% |
| Utilities | 90% | ~60% |
| Overall | 75% | ~35% |

## CI/CD Integration

Tests run automatically on:
- Pre-commit: Critical formula tests (34 tests, ~470ms)
- Pre-push: Unit tests + critical tests
- GitHub Actions: Full test suite (unit + integration)

See `.husky/pre-commit` and `.github/workflows/ci.yml` for configuration.
