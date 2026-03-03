# Week 8: Relink Algorithm Testing Guide

**Status:** Ready for Testing  
**Prerequisites:** Migration 011 applied, server running  
**Estimated Time:** 10-12 hours

---

## 🎯 Week 8 Goals

1. ✅ Apply migration 011 (auto on server start)
2. ⏳ Test relink API endpoints with real data
3. ⏳ Create sample Excel files for testing
4. ⏳ Write integration tests
5. ⏳ Optimize fuzzy matching performance

---

## 📋 Prerequisites

### 1. Apply Migration 011

Migration will auto-apply when server starts. To verify:

```sql
-- Check if migration applied
SELECT * FROM schema_migrations WHERE version = '011';

-- Check new columns exist
\d registry_file_versions
\d registry_position_instances
\d registry_relink_reports
```

### 2. Start Server

```bash
cd Monolit-Planner/backend

# Option 1: Development mode (auto-restart)
npm run dev

# Option 2: Direct start (if npm issues)
node server.js
```

**Expected output:**
```
✅ Migration 011 applied successfully
🚀 Server running on port 3001
📊 Relink routes registered: /api/relink/*
```

---

## 🧪 Testing Scenarios

### Scenario 1: Generate Relink Report

**Setup:**
1. Upload Excel file (version 1)
2. Parse positions → creates position_instances
3. Modify Excel file (add/remove/change rows)
4. Upload modified file (version 2)
5. Generate relink report

**API Call:**
```bash
curl -X POST http://localhost:3001/api/relink/generate \
  -H "Content-Type: application/json" \
  -d '{
    "old_version_id": 1,
    "new_version_id": 2
  }'
```

**Expected Response:**
```json
{
  "report_id": 1,
  "summary": {
    "total_old": 150,
    "total_new": 155,
    "matched_exact": 140,
    "matched_fallback": 5,
    "matched_fuzzy": 3,
    "orphaned": 2,
    "new_positions": 5
  },
  "confidence_breakdown": {
    "GREEN": 140,
    "AMBER": 8,
    "RED": 0
  }
}
```

### Scenario 2: Get Report Details

```bash
curl http://localhost:3001/api/relink/reports/1
```

**Expected Response:**
```json
{
  "report_id": 1,
  "summary": { ... },
  "details": {
    "matches": [
      {
        "old_position_id": "uuid-1",
        "new_position_id": "uuid-2",
        "confidence": "GREEN",
        "match_type": "primary",
        "similarity": 1.0
      }
    ],
    "orphaned": [
      {
        "position_id": "uuid-3",
        "catalog_code": "272324",
        "description": "Removed position"
      }
    ],
    "new_positions": [
      {
        "position_id": "uuid-4",
        "catalog_code": "272325",
        "description": "New position"
      }
    ]
  }
}
```

### Scenario 3: Apply Relink

```bash
curl -X POST http://localhost:3001/api/relink/reports/1/apply
```

**Expected:**
- Copies `kiosk_data` from old positions to matched new positions
- Updates `status` to 'archived' for orphaned positions
- Returns count of applied matches

### Scenario 4: Manual Match

```bash
curl -X POST http://localhost:3001/api/relink/reports/1/manual-match \
  -H "Content-Type: application/json" \
  -d '{
    "old_position_id": "uuid-3",
    "new_position_id": "uuid-5"
  }'
```

**Expected:**
- Creates manual match override
- Copies kiosk_data
- Updates report details

---

## 📊 Test Data Creation

### Sample Excel Files

Create 3 versions of test file:

**Version 1 (baseline):**
```
Row | Code   | Description           | Unit | Qty
1   | 272324 | Beton C25/30         | m3   | 100
2   | 272325 | Výztuž B500B         | t    | 10
3   | 272326 | Bednění systémové    | m2   | 200
```

**Version 2 (minor changes):**
```
Row | Code   | Description           | Unit | Qty
1   | 272324 | Beton C25/30         | m3   | 105  ← qty changed
2   | 272325 | Výztuž B500B         | t    | 10
3   | 272326 | Bednění systémové    | m2   | 200
4   | 272327 | Doprava betonu       | km   | 50   ← NEW
```

**Version 3 (major changes):**
```
Row | Code   | Description           | Unit | Qty
1   | 272324 | Beton C30/37         | m3   | 120  ← desc changed
3   | 272326 | Bednění systémové    | m2   | 200  ← row 2 removed
4   | 272327 | Doprava betonu       | km   | 50
5   | 272328 | Čerpání betonu       | m3   | 120  ← NEW
```

### Expected Match Results

**V1 → V2:**
- Row 1: PRIMARY match (🟢 GREEN) - exact match
- Row 2: PRIMARY match (🟢 GREEN) - exact match
- Row 3: PRIMARY match (🟢 GREEN) - exact match
- Row 4: NEW position

**V2 → V3:**
- Row 1: FUZZY match (🟡 AMBER) - description changed
- Row 2: ORPHANED - removed from file
- Row 3: FALLBACK match (🟡 AMBER) - row shifted
- Row 4: PRIMARY match (🟢 GREEN) - exact match
- Row 5: NEW position

---

## 🔍 Integration Tests

### Test 1: Primary Match (Exact)

```javascript
describe('Relink Algorithm - Primary Match', () => {
  it('should match positions with same sheet_name + position_no + catalog_code', async () => {
    // Setup: Create 2 file versions with identical positions
    const v1 = await createFileVersion({ positions: [...] });
    const v2 = await createFileVersion({ positions: [...] });
    
    // Generate relink report
    const report = await generateRelinkReport(v1.id, v2.id);
    
    // Assert: All positions matched with GREEN confidence
    expect(report.summary.matched_exact).toBe(150);
    expect(report.summary.orphaned).toBe(0);
    expect(report.summary.new_positions).toBe(0);
  });
});
```

### Test 2: Fallback Match (Positional)

```javascript
it('should match positions by row_index when position_no missing', async () => {
  // Setup: Positions without position_no, but same row_index
  const v1 = await createFileVersion({ 
    positions: [{ row_index: 5, catalog_code: '272324' }] 
  });
  const v2 = await createFileVersion({ 
    positions: [{ row_index: 6, catalog_code: '272324' }] // ±2 rows
  });
  
  const report = await generateRelinkReport(v1.id, v2.id);
  
  expect(report.summary.matched_fallback).toBe(1);
  expect(report.details.matches[0].confidence).toBe('AMBER');
});
```

### Test 3: Fuzzy Match (Description Similarity)

```javascript
it('should match positions by description similarity > 0.75', async () => {
  const v1 = await createFileVersion({ 
    positions: [{ 
      catalog_code: '272324', 
      description: 'Beton C25/30 pro základy' 
    }] 
  });
  const v2 = await createFileVersion({ 
    positions: [{ 
      catalog_code: '272324', 
      description: 'Beton C25/30 pro základ' // similar
    }] 
  });
  
  const report = await generateRelinkReport(v1.id, v2.id);
  
  expect(report.summary.matched_fuzzy).toBeGreaterThan(0);
  expect(report.details.matches[0].similarity).toBeGreaterThan(0.75);
});
```

### Test 4: Orphaned Positions

```javascript
it('should mark removed positions as orphaned', async () => {
  const v1 = await createFileVersion({ 
    positions: [
      { catalog_code: '272324' },
      { catalog_code: '272325' }
    ] 
  });
  const v2 = await createFileVersion({ 
    positions: [{ catalog_code: '272324' }] // 272325 removed
  });
  
  const report = await generateRelinkReport(v1.id, v2.id);
  
  expect(report.summary.orphaned).toBe(1);
  expect(report.details.orphaned[0].catalog_code).toBe('272325');
});
```

### Test 5: New Positions

```javascript
it('should detect new positions in updated file', async () => {
  const v1 = await createFileVersion({ 
    positions: [{ catalog_code: '272324' }] 
  });
  const v2 = await createFileVersion({ 
    positions: [
      { catalog_code: '272324' },
      { catalog_code: '272325' } // NEW
    ] 
  });
  
  const report = await generateRelinkReport(v1.id, v2.id);
  
  expect(report.summary.new_positions).toBe(1);
  expect(report.details.new_positions[0].catalog_code).toBe('272325');
});
```

---

## ⚡ Performance Optimization

### Current Performance Targets

| Operation | Target | Current | Status |
|-----------|--------|---------|--------|
| Primary Match | <1s | TBD | ⏳ |
| Fallback Match | <2s | TBD | ⏳ |
| Fuzzy Match | <5s | TBD | ⏳ |
| Total (500 pos) | <10s | TBD | ⏳ |

### Optimization Strategies

#### 1. Primary Match - Use Map for O(1) lookup

**Before (O(n²)):**
```javascript
for (const oldPos of oldPositions) {
  for (const newPos of newPositions) {
    if (match(oldPos, newPos)) { ... }
  }
}
```

**After (O(n)):**
```javascript
const newPosMap = new Map();
for (const newPos of newPositions) {
  const key = `${newPos.sheet_name}|${newPos.position_no}|${newPos.catalog_code}`;
  newPosMap.set(key, newPos);
}

for (const oldPos of oldPositions) {
  const key = `${oldPos.sheet_name}|${oldPos.position_no}|${oldPos.catalog_code}`;
  const match = newPosMap.get(key);
  if (match) { ... }
}
```

#### 2. Fuzzy Match - Batch similarity calculation

**Before:**
```javascript
for (const oldPos of unmatched) {
  for (const newPos of unmatched) {
    const similarity = stringSimilarity.compareTwoStrings(
      oldPos.description_normalized,
      newPos.description_normalized
    );
  }
}
```

**After:**
```javascript
// Pre-filter by catalog_code first
const grouped = groupBy(unmatched, 'catalog_code');

for (const [code, oldPositions] of grouped) {
  const newPositions = grouped[code] || [];
  // Only compare within same catalog_code
  for (const oldPos of oldPositions) {
    for (const newPos of newPositions) {
      const similarity = stringSimilarity.compareTwoStrings(...);
    }
  }
}
```

#### 3. Database Indexes

Already created in migration 011:
```sql
-- Primary match index
CREATE INDEX idx_positions_relink_primary 
  ON registry_position_instances(project_id, sheet_name, position_no, catalog_code);

-- Fallback match index
CREATE INDEX idx_positions_relink_fallback 
  ON registry_position_instances(project_id, sheet_index, row_index, catalog_code);

-- Fuzzy match index
CREATE INDEX idx_positions_description_normalized 
  ON registry_position_instances(description_normalized);
```

---

## 📝 Testing Checklist

### API Endpoints
- [ ] POST /api/relink/generate - Creates report
- [ ] GET /api/relink/reports/:id - Returns report details
- [ ] POST /api/relink/reports/:id/apply - Applies relink
- [ ] POST /api/relink/reports/:id/manual-match - Manual override
- [ ] POST /api/relink/reports/:id/reject - Rejects relink
- [ ] GET /api/relink/file-versions/:id/history - Version history

### Algorithm Steps
- [ ] Primary match works (exact matches)
- [ ] Fallback match works (positional ±2 rows)
- [ ] Fuzzy match works (similarity > 0.75)
- [ ] Orphaned detection works
- [ ] New position detection works

### Edge Cases
- [ ] Empty old file (all new positions)
- [ ] Empty new file (all orphaned)
- [ ] Duplicate positions in file
- [ ] Missing catalog_code
- [ ] Missing description
- [ ] Very long descriptions (>1000 chars)

### Performance
- [ ] 100 positions: <3s
- [ ] 500 positions: <10s
- [ ] 1000 positions: <20s

### Data Integrity
- [ ] kiosk_data preserved after relink
- [ ] No data loss on orphaned positions
- [ ] Manual matches override automatic
- [ ] Relink can be rejected/rolled back

---

## 🐛 Known Issues

### Issue 1: SSL Certificate (Corporate Proxy)
**Impact:** Cannot install npm packages  
**Workaround:** Add dependencies manually to package.json  
**Status:** Blocking local testing

### Issue 2: TypeScript Build
**Impact:** Cannot run `npm run dev`  
**Workaround:** Run `node server.js` directly  
**Status:** Minor inconvenience

---

## 🚀 Next Steps

### After Week 8 Testing:
1. Fix any bugs found in testing
2. Optimize performance bottlenecks
3. Add missing edge case handling
4. Update documentation with test results

### Week 9 Preview:
1. Create RelinkReportModal.tsx component
2. Show matches with confidence indicators
3. Manual relink UI
4. Approve/reject workflow
5. Version history UI

---

**Status:** Ready for Testing  
**Blockers:** SSL certificate issue (corporate proxy)  
**Estimated Time:** 10-12 hours  
**Next:** Apply migration 011 and start testing
