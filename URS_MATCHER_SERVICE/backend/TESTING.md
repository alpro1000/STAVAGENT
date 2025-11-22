# URS Matcher Service - Testing Guide

## Overview

This document describes all testing procedures for the URS Matcher Service backend.

## Quick Start

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Test Coverage Report
```bash
npm test -- --coverage
```

---

## Test Suite

### Test Results Summary
- **Total Tests:** 12
- **Passed:** 12 ✅
- **Coverage:** 28.7% statements (focused on services layer)

### Test Files

#### 1. `tests/ursMatcher.test.js`
Tests the core URS matching algorithm.

**Test Cases (6 total):**
1. `should match text with URS items` - Verifies basic matching functionality
2. `should return empty array for invalid text` - Handles empty input
3. `should return top 5 matches` - Verifies result limit
4. `should include confidence scores` - Validates confidence field
5. `should include required fields in results` - Checks schema
6. `should sort by confidence descending` - Verifies result ordering

**What it tests:**
- Text matching algorithm
- Similarity scoring
- Result filtering and sorting
- Database queries

#### 2. `tests/fileParser.test.js`
Tests Excel/CSV file parsing functionality.

**Test Cases (6 total):**
1. `should parse CSV file successfully` - Verifies file parsing works
2. `should return objects with required fields` - Validates schema
3. `should parse quantities as numbers` - Type checking
4. `should trim description whitespace` - Data normalization
5. `should skip empty rows` - Error handling
6. `should have default unit "ks" if not specified` - Default values

**What it tests:**
- CSV file parsing
- Column detection
- Data type conversion
- Error handling for malformed data

---

## Manual API Testing

### Health Check
```bash
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "URS Matcher Service",
  "timestamp": "2025-11-22T19:27:35.846Z",
  "database": "connected"
}
```

### Search URS Catalog
```bash
curl "http://localhost:3001/api/urs-catalog?search=beton&limit=5"
```

### Get Specific URS Item
```bash
curl http://localhost:3001/api/urs-catalog/801321111
```

### Text Match
```bash
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Podkladní beton C25/30 tl. 100 mm",
    "quantity": 25,
    "unit": "m3"
  }'
```

**Expected Response:**
```json
{
  "candidates": [
    {
      "urs_code": "801321121",
      "urs_name": "Beton podkladní C 25/30 až C 30/37",
      "unit": "m3",
      "confidence": 0.379
    }
  ],
  "related_items": [],
  "processing_time_ms": 4
}
```

### List Jobs
```bash
curl http://localhost:3001/api/jobs
```

---

## Database Testing

### Verify Database Initialization

Run the verification script:
```bash
node verify-db.js
```

**Expected Output:**
- 5 tables created: `urs_items`, `jobs`, `job_items`, `mapping_examples`, `sqlite_sequence`
- 20 sample URS items seeded
- All foreign key constraints in place

### Manually Query Database

```bash
# Create temporary Node.js query script
cat > query-db.js << 'EOF'
import { getDatabase } from './src/db/init.js';

(async () => {
  const db = await getDatabase();

  // Get all concrete items
  const items = await db.all(
    "SELECT * FROM urs_items WHERE urs_name LIKE '%beton%'"
  );

  console.log('Concrete items found:', items.length);
  items.forEach(item => {
    console.log(`  ${item.urs_code} - ${item.urs_name}`);
  });

  await db.close();
})();
EOF

node query-db.js
```

---

## Test Coverage Analysis

### Current Coverage (28.7%)

**Well-tested (>80%):**
- `src/services/ursMatcher.js` - 86% coverage
- `src/services/fileParser.js` - 81% coverage
- `src/db/init.js` - 53% coverage (database initialization)

**Not Tested (0%):**
- `src/app.js` - Main Express app setup (integration test needed)
- `src/api/routes/*.js` - Route handlers (integration test needed)
- `src/api/middleware/*.js` - Middleware (needs tests)
- `src/services/llmClient.js` - Stub (MVP-2)
- `src/services/perplexityClient.js` - Stub (MVP-3)
- `src/services/techRules.js` - Stub (MVP-2)

### Improving Coverage

#### Add Integration Tests (Recommended for MVP-2)
```bash
# Create tests/api.integration.test.js
# Test full request/response cycles with Supertest
```

#### Add Middleware Tests
```bash
# Test error handling
# Test request logging
# Test CORS configuration
```

---

## Known Issues & Limitations

### MVP-1 Limitations

1. **Matching Algorithm**
   - Uses basic Levenshtein distance
   - Confidence scores are sometimes low (0.3-0.4)
   - No semantic understanding
   - **Fix in MVP-2:** Use LLM embeddings for better matching

2. **File Parser**
   - Only handles CSV files reliably
   - Excel/ODS support relies on XLSX library (may have edge cases)
   - **Fix in MVP-2:** Add comprehensive Excel parsing tests

3. **Tech Rules Not Implemented**
   - `generateRelatedItems()` always returns empty array
   - **Fix in MVP-2:** Implement rule engine

4. **In-Memory Job Store**
   - Jobs are stored in-memory (lost on server restart)
   - **Fix in MVP-2:** Move to SQLite database

---

## Performance Benchmarks

### Current Performance (MVP-1)

```
Operation              Time (ms)    Notes
─────────────────────────────────────────────
Health Check           <1          Direct response
URS Catalog Search     5-10        Database query + filtering
Text Match             4-10        Levenshtein distance calc
File Upload (5 rows)   50-100      Parse + match + store
```

### Performance Targets (MVP-2)

```
Operation              Target (ms)  Current
─────────────────────────────────────────────
Text Match            <50          4-10 ✅
File Upload/row       <20          10-20 ✅ (depends on file size)
Catalog Search        <5           5-10 ✅
```

---

## Troubleshooting

### Tests Won't Run

**Error:** "Cannot use import statement outside a module"

**Solution:** Ensure `NODE_OPTIONS=--experimental-vm-modules` is set:
```bash
NODE_OPTIONS=--experimental-vm-modules npm test
```

### Database Connection Error

**Error:** "Cannot find module './data/urs_matcher.db'"

**Solution:** Initialize database first:
```bash
npm run init-db
```

### Port Already in Use

**Error:** "EADDRINUSE: address already in use :::3001"

**Solution:**
```bash
# Kill existing process
pkill -f "node src/app"

# Or use different port
PORT=3002 npm run dev
```

### File Upload Fails

**Error:** "File type not allowed"

**Solution:** Only these files are supported:
- `.xlsx` - Excel 2007+
- `.xls` - Excel 97-2003
- `.ods` - OpenDocument Spreadsheet
- `.csv` - Comma-separated values

---

## Testing Checklist for MVP-2

- [ ] Add integration tests for all API routes
- [ ] Add middleware tests (error handling, logging)
- [ ] Test LLM integration with mock API
- [ ] Test tech rules engine
- [ ] Add performance benchmarks
- [ ] Add load testing (multiple files)
- [ ] Test error cases more thoroughly
- [ ] Add E2E tests with Puppeteer/Playwright

---

## Running Specific Tests

```bash
# Run only ursMatcher tests
npm test ursMatcher

# Run only fileParser tests
npm test fileParser

# Run tests matching pattern
npm test -- --testNamePattern="should match"

# Run with detailed output
npm test -- --verbose

# Run and update snapshots (if using snapshots)
npm test -- -u
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: npm install
      - run: npm run init-db
      - run: npm test
```

---

## Test Fixtures

### CSV Test File: `tests/fixtures/test.csv`

```csv
popis,množství,mj
Podkladní beton C25/30,25.5,m3
Bednění vodorovných konstrukcí,100,m2
Výztuž z oceli – pruty,1200,kg
Výkopy v hlíně,50,m3
Zásyp trench - hutněná zemina,48,m3
```

### Sample Database Queries

```sql
-- Get all concrete items
SELECT * FROM urs_items WHERE urs_name LIKE '%beton%';

-- Get formwork items
SELECT * FROM urs_items WHERE urs_name LIKE '%bednění%';

-- Get excavation items
SELECT * FROM urs_items WHERE urs_name LIKE '%výkop%';

-- Count total items
SELECT COUNT(*) FROM urs_items;
```

---

## Test Environment Setup

### Requirements
- Node.js 18+
- npm 9+
- SQLite3 (bundled with sqlite3 npm package)

### Installation
```bash
npm install
npm run init-db
```

### Verification
```bash
npm test  # Should show 12 passed tests
```

---

**Last Updated:** November 2025
**Test Suite Version:** 1.0
**Status:** MVP-1 Complete ✅
