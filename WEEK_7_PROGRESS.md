# Week 7-9 Progress: Relink Algorithm

**Branch:** `feature/relink-algorithm`  
**Status:** 🚀 Week 7 Day 1-2 COMPLETE  
**Time Spent:** ~3 hours  
**Remaining:** 21-29 hours

---

## ✅ Completed (Week 7, Day 1-2)

### 1. Database Migration (011)
**File:** `Monolit-Planner/backend/migrations/011_add_relink_support.sql`

**Changes:**
- ✅ Added `previous_version_id` to `registry_file_versions`
- ✅ Added `relink_status` enum (pending, in_progress, completed, failed, skipped)
- ✅ Added `summary` and `details` JSONB columns to `registry_relink_reports`
- ✅ Added `status` column to `registry_position_instances` (active, archived, needs_review, orphaned)
- ✅ Added `description_normalized` for fuzzy matching
- ✅ Created indexes for performance

### 2. Relink Service
**File:** `Monolit-Planner/backend/src/services/relinkService.js`

**Functions:**
- ✅ `primaryMatch()` - Exact match (sheet_name + position_no + catalog_code)
- ✅ `fallbackMatch()` - Positional match (row_index ±2 + catalog_code)
- ✅ `fuzzyMatch()` - Description similarity > 0.75
- ✅ `generateRelinkReport()` - Complete 4-step algorithm
- ✅ `applyRelink()` - Copy calculations from old to new
- ✅ `manualMatch()` - User override

**Algorithm:**
```
Step 1: Primary Match → 🟢 GREEN (80-90%)
Step 2: Fallback Match → 🟡 AMBER (5-10%)
Step 3: Fuzzy Match → 🟡 AMBER/🔴 RED (2-5%)
Step 4: Classify → Orphaned + New (5-10%)
```

### 3. API Routes
**File:** `Monolit-Planner/backend/src/routes/relink.js`

**Endpoints:**
- ✅ `POST /api/relink/generate` - Generate relink report
- ✅ `GET /api/relink/reports/:id` - Get report details
- ✅ `POST /api/relink/reports/:id/apply` - Apply relink
- ✅ `POST /api/relink/reports/:id/manual-match` - Manual override
- ✅ `POST /api/relink/reports/:id/reject` - Reject relink
- ✅ `GET /api/relink/file-versions/:id/history` - Version history

---

## 🔜 Next Steps (Week 7, Day 3-4)

### Day 3: Integration & Testing (3-4 hours)
1. [ ] Install `string-similarity` package
   ```bash
   cd Monolit-Planner/backend
   npm install string-similarity
   ```

2. [ ] Register relink routes in `app.js`
   ```javascript
   const relinkRoutes = require('./src/routes/relink');
   app.use('/api/relink', relinkRoutes);
   ```

3. [ ] Run migration
   ```bash
   npm run migrate
   ```

4. [ ] Test API endpoints
   ```bash
   # Generate report
   curl -X POST http://localhost:3001/api/relink/generate \
     -H "Content-Type: application/json" \
     -d '{"old_version_id": 1, "new_version_id": 2}'
   
   # Get report
   curl http://localhost:3001/api/relink/reports/1
   
   # Apply relink
   curl -X POST http://localhost:3001/api/relink/reports/1/apply
   ```

### Day 4: Unit Tests (2-3 hours)
1. [ ] Create test file: `Monolit-Planner/backend/tests/relinkService.test.js`
2. [ ] Test primary match (exact)
3. [ ] Test fallback match (positional)
4. [ ] Test fuzzy match (similarity)
5. [ ] Test edge cases (empty, duplicates, no matches)

---

## 📊 Progress Tracker

| Task | Status | Time |
|------|--------|------|
| **Week 7: File Version System** | 🟡 IN PROGRESS | 3/10h |
| Database migration | ✅ DONE | 1h |
| Relink service | ✅ DONE | 2h |
| API routes | ✅ DONE | 1h |
| Integration | ⏳ TODO | 2h |
| Unit tests | ⏳ TODO | 2h |
| **Week 8: Algorithm Core** | ⏳ TODO | 0/12h |
| **Week 9: UI & Resolution** | ⏳ TODO | 0/10h |

**Total:** 3/32 hours (9% complete)

---

## 🧪 Testing Plan

### Unit Tests (10+ tests)
```javascript
describe('Relink Service', () => {
  describe('primaryMatch', () => {
    test('exact match - all fields match', () => {});
    test('no match - different catalog_code', () => {});
    test('multiple matches - takes first', () => {});
  });

  describe('fallbackMatch', () => {
    test('row shift +2', () => {});
    test('row shift -2', () => {});
    test('row shift >2 - no match', () => {});
  });

  describe('fuzzyMatch', () => {
    test('high similarity (>0.9)', () => {});
    test('medium similarity (0.75-0.9)', () => {});
    test('low similarity (<0.75) - no match', () => {});
    test('qty change >20% - no match', () => {});
  });

  describe('generateRelinkReport', () => {
    test('complete workflow', () => {});
    test('empty old positions', () => {});
    test('empty new positions', () => {});
  });
});
```

### Integration Tests (5+ tests)
```javascript
describe('Relink API', () => {
  test('POST /api/relink/generate', () => {});
  test('GET /api/relink/reports/:id', () => {});
  test('POST /api/relink/reports/:id/apply', () => {});
  test('POST /api/relink/reports/:id/manual-match', () => {});
  test('POST /api/relink/reports/:id/reject', () => {});
});
```

---

## 📝 Notes

### Dependencies
- ✅ `string-similarity` - for fuzzy matching (Dice coefficient)
- ✅ Existing database tables from migration 010
- ✅ Express.js routes

### Performance
- Target: <10s for 500 positions
- Primary match: O(n²) → optimize with Map
- Fuzzy match: O(n²) → most expensive step

### Edge Cases
- [ ] Duplicate position codes
- [ ] Missing catalog codes
- [ ] Empty descriptions
- [ ] Qty = 0
- [ ] Very large files (1000+ positions)

---

## 🎯 Success Criteria

- [ ] 90%+ positions matched automatically
- [ ] <10s relink time for 500 positions
- [ ] User can review in <5 minutes
- [ ] Zero data loss
- [ ] All tests passing

---

**Next Session:**
1. Install `string-similarity`
2. Register routes in `app.js`
3. Run migration
4. Test endpoints
5. Write unit tests

**Estimated Time:** 5-7 hours to complete Week 7
