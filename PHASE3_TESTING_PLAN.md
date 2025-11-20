# 🧪 PHASE 3: Comprehensive Testing Plan

**Date:** November 20, 2025
**Status:** Ready for implementation
**Duration:** ~2-3 hours
**Effort:** Manual testing + data verification

---

## 📋 Overview

Phase 3 tests the complete implementation of project hierarchy with real Excel files. This ensures:
- Metadata extraction works correctly
- Object types detected accurately from descriptions
- Hierarchy created properly in database
- Response includes all hierarchy information
- No regressions in existing functionality

---

## 🎯 Testing Objectives

| Objective | Expected Result | Verification |
|-----------|-----------------|--------------|
| Metadata extraction | Stavba, Objekt, Сoupis extracted from headers | Check logs and response |
| Type detection | Correct type from description keywords | Query database for object_type |
| Hierarchy creation | Objects linked to parent project | parent_project_id populated |
| CORE integration | Only concrete items imported | No false positives |
| Backward compatibility | Bridges table still populated | Data in bridges table |
| Response format | Includes hierarchy information | JSON response contains stavbaProject |

---

## 📊 Test Data Requirements

### Test File 1: Single Bridge (Minimal Test)
**Purpose:** Verify basic functionality

**File Structure:**
```
Row 1: Stavba | I/20 HNĚVKOV - SEDLICE
Row 2: Objekt | SO 202 - MOST PŘES POTOK
Row 3: Сoupis | 202 - MOST PŘES POTOK

Row 6 (Headers): Popis | MJ | Množství
Row 7: ZÁKLADY MOSTU - Beton C30/37 XC2 | m3 | 150
Row 8: PILÍŘE - Beton C30/37 | m3 | 75
```

**Expected Results:**
- ✅ Stavba extracted: "I/20 HNĚVKOV - SEDLICE"
- ✅ Object created with type: "bridge"
- ✅ parent_project_id populated
- ✅ 2 concrete positions imported
- ✅ Response includes stavbaProject

---

### Test File 2: Multiple Objects (Real-World Test)
**Purpose:** Verify hierarchy with varied types

**File Structure:**
```
Row 1: Stavba | I/20 HNĚVKOV - SEDLICE

[First object section]
Row 3: Objekt | SO 202 - MOST PŘES POTOK V KM 2,710
Row 4: Сoupis | 202 - MOST PŘES POTOK V KM 2,710
Row 6 (Headers): Popis | MJ | Množství
Row 7: Beton C30/37 | m3 | 150
Row 8: Výztuž (will be filtered) | t | 25

[Second object section]
Row 10: Objekt | SO 203 - TUNEL POD SILNICÍ
Row 11: Сoupis | 203 - TUNEL
Row 13 (Headers): Popis | MJ | Množství
Row 14: Beton C25/30 | m3 | 200
Row 15: Výztuž (will be filtered) | t | 35

[Third object section]
Row 17: Objekt | SO 204 - BUDOVA SPRÁVY
Row 18: Сoupis | 204 - BUDOVA
Row 20 (Headers): Popis | MJ | Množství
Row 21: Beton C30/37 | m3 | 75
```

**Expected Results:**
- ✅ Stavba extracted once: "I/20 HNĚVKOV - SEDLICE"
- ✅ 3 objects created with different types:
  - SO 202: type='bridge', concrete_m3=150
  - SO 203: type='tunnel', concrete_m3=200
  - SO 204: type='building', concrete_m3=75
- ✅ All linked to same parent project
- ✅ Reinforcement items filtered out (not concrete)
- ✅ Response shows all 3 objects with correct types

---

### Test File 3: No Metadata (Edge Case)
**Purpose:** Verify fallback behavior

**File Structure:**
```
Row 6 (Headers): Popis | MJ | Množství
Row 7: Beton C30/37 | m3 | 100
Row 8: Beton C25/30 | m3 | 50
```

**Expected Results:**
- ✅ No stavbaProject created (metadata missing)
- ✅ Objects created but parent_project_id = NULL
- ✅ stavba field in response = null
- ✅ Objects still imported successfully
- ✅ No errors in logs

---

### Test File 4: No Concrete (Error Case)
**Purpose:** Verify CORE-only approach (no M3 fallback)

**File Structure:**
```
Row 1: Stavba | TEST PROJECT
Row 6 (Headers): Popis | MJ | Množství
Row 7: Výztuž | t | 50
Row 8: Tvárnice | ks | 1000
```

**Expected Results:**
- ✅ CORE returns empty concrete list
- ✅ Response: success=false
- ✅ Error: "No concrete projects identified"
- ✅ No objects created
- ✅ No fallback to M3 detection
- ✅ Clear message in response

---

## 🔧 Testing Procedure

### Step 1: Setup (Pre-Testing)

```bash
# 1. Check current branch
git branch

# Expected: * claude/fix-syntax-error-01TVupYbJbcVGQdcr3jTvzs8

# 2. Verify migration file
cat backend/src/db/migrations/001-add-project-hierarchy.sql | head -20

# Expected: Clean PostgreSQL ALTER TABLE syntax (no MySQL COMMENT)

# 3. Start backend
npm start

# Expected: Server starts without errors on port 3000
```

### Step 2: Apply Migration (First Time Only)

```bash
# 1. Backup existing database (if using real DB)
pg_dump -U user -d monolit_planner > backup_$(date +%s).sql

# 2. Apply migration
psql -U user -d monolit_planner -f backend/src/db/migrations/001-add-project-hierarchy.sql

# Expected: No errors, all tables created

# 3. Verify migration success
psql -U user -d monolit_planner -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name='monolith_projects'
   AND column_name IN ('stavba','objekt','soupis','parent_project_id');"

# Expected: 4 rows (all columns present)
```

### Step 3: Run Tests

#### Test 3.1: Single Bridge File

```bash
# 1. Create test file (Excel format with metadata)
# Use headers in first rows: Stavba, Objekt, Сoupis
# Add one concrete item with description containing "MOST"

# 2. Upload file via API
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test_single_bridge.xlsx" \
  -H "Authorization: Bearer <token>"

# 3. Capture response and check:
# - Response status: 200
# - stavbaProject not null
# - bridges[0].object_type = "bridge"
# - bridges[0].parent_project not null
# - message contains "in project"
```

#### Test 3.2: Multiple Objects File

```bash
# 1. Create test file with:
# - Stavba header in row 1
# - Multiple object sections (SO 202, SO 203, SO 204)
# - Each with different type keyword (MOST, TUNEL, BUDOVA)

# 2. Upload file
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test_multiple_objects.xlsx" \
  -H "Authorization: Bearer <token>"

# 3. Check response:
# - bridges.length = 3
# - bridges[0].object_type = "bridge"
# - bridges[1].object_type = "tunnel"
# - bridges[2].object_type = "building"
# - All have same parent_project
```

#### Test 3.3: No Metadata File

```bash
# 1. Create test file WITHOUT headers (Stavba, Objekt)
# 2. Upload file
# 3. Check response:
# - stavbaProject = null
# - stavba = null
# - Objects still created
# - No errors
```

#### Test 3.4: No Concrete File

```bash
# 1. Create test file with non-concrete items only
# 2. Upload file
# 3. Check response:
# - success = false
# - error = "No concrete projects identified"
# - bridges.length = 0
# - No fallback attempt
```

### Step 4: Database Verification

```sql
-- After each test, verify database state

-- Check projects created
SELECT project_id, object_type, stavba, parent_project_id, concrete_m3
FROM monolith_projects
WHERE project_id LIKE 'i20_%' OR project_id LIKE 'so_%'
ORDER BY parent_project_id, object_type;

-- Check hierarchy
SELECT child.project_id, child.object_type, parent.stavba
FROM monolith_projects child
LEFT JOIN monolith_projects parent ON child.parent_project_id = parent.project_id
WHERE child.parent_project_id IS NOT NULL
ORDER BY parent.stavba;

-- Check type distribution
SELECT object_type, COUNT(*) as count
FROM monolith_projects
WHERE object_type IN ('bridge','tunnel','building','embankment','parking','road','custom')
GROUP BY object_type;

-- Check for orphaned objects
SELECT project_id, object_type, stavba
FROM monolith_projects
WHERE parent_project_id IS NULL
AND object_type != 'project'
AND stavba IS NOT NULL;
```

### Step 5: Log Verification

```bash
# Check backend logs for expected messages:

# For successful import with metadata:
# "[Upload] File metadata: Stavba=\"I/20...\""
# "[Upload] Created stavba project: i20_hnevkov__sedlice"
# "[Upload] Created object: so_202_most (type: bridge, 150 m³)"

# For failed import (no concrete):
# "[Upload] CORE did not identify any concrete bridges"
# Response should be success=false

# Check for errors:
# Should see NO "Error creating stavba record"
# Should see NO "Error creating object"
```

---

## ✅ Test Checklist

### Functionality Tests
- [ ] Test 3.1: Single bridge file imports correctly
- [ ] Test 3.2: Multiple objects create proper hierarchy
- [ ] Test 3.3: No metadata handled gracefully
- [ ] Test 3.4: No concrete returns error (no fallback)

### Data Verification
- [ ] Stavba projects created at project level
- [ ] Objects linked to parent projects
- [ ] Object types correctly detected
- [ ] All concrete items imported
- [ ] Non-concrete items filtered out

### Database Checks
- [ ] All new columns populated correctly
- [ ] Indexes created and working
- [ ] Foreign keys enforced
- [ ] No orphaned records

### Response Validation
- [ ] stavbaProject field present
- [ ] object_type field present for each object
- [ ] parent_project field populated
- [ ] Error responses clear and helpful

### Backward Compatibility
- [ ] Bridges table still populated
- [ ] Existing queries still work
- [ ] No regressions in other functionality

### Performance
- [ ] Upload completes in reasonable time
- [ ] No timeout errors
- [ ] Large files handled correctly

---

## 📈 Expected Test Results Summary

| Test | Scenario | Status | Result |
|------|----------|--------|--------|
| 3.1 | Single bridge | ✅ Pass | 1 project, 1 object, type=bridge |
| 3.2 | Multiple objects | ✅ Pass | 1 project, 3 objects, types=bridge/tunnel/building |
| 3.3 | No metadata | ✅ Pass | Objects created, parent_project_id=null |
| 3.4 | No concrete | ✅ Pass | success=false, no objects created |

---

## 🐛 Troubleshooting Guide

### Issue: Migration fails with "syntax error"
**Cause:** PostgreSQL COMMENT syntax issue
**Solution:** Ensure migration uses separate COMMENT ON COLUMN statements
**Check:** `cat backend/src/db/migrations/001-add-project-hierarchy.sql | grep COMMENT`

### Issue: Stavba not extracted
**Cause:** Headers not in expected format
**Solution:** Verify file has "Stavba:" label in first 15 rows
**Check:** Look for logs: `[Parser] Found Stavba:`

### Issue: Types not detected correctly
**Cause:** Description keywords not matching
**Solution:** Verify description contains expected keywords (MOST, TUNEL, BUDOVA, etc.)
**Check:** Look for logs: `[Parser] Created project from CORE concrete: ... (type: ...)`

### Issue: parent_project_id is NULL
**Cause:** Stavba not extracted or stavba project not created
**Solution:** Check if Stavba header exists in file
**Check:** Verify stavbaProject in response is not null

### Issue: No objects imported but CORE returns positions
**Cause:** material_type not = 'concrete'
**Solution:** Verify file contains concrete specifications (C20/25, C30/37, XC2, etc.)
**Check:** CORE should identify material_type='concrete'

---

## 📝 Logging to Monitor

**Key Log Messages to Track:**

```
[Upload] File metadata: Stavba="...", Objekt="...", Сoupis="..."
[Upload] Created stavba project: ...
[Upload] ✅ CORE identified X concrete projects
[Upload] Created object: ... (type: ..., X m³)
[Upload] Using X positions from CORE for ...
[Parser] Created project from CORE concrete: ... (type: ...)
```

**Error Messages to Avoid:**

```
[Upload] Error creating stavba record  ❌
[Upload] Error creating object         ❌
[Upload] ⚠️ CORE did not identify...   ✅ Expected for no-concrete test
[Upload] Cannot identify concrete...   ✅ Expected when CORE unavailable
```

---

## 🎯 Success Criteria

Phase 3 testing is **PASS** when:
- ✅ All 4 test scenarios complete without errors
- ✅ Metadata extraction verified in all cases
- ✅ Object types correctly detected
- ✅ Hierarchy properly created in database
- ✅ No regressions in existing functionality
- ✅ Response formats include all hierarchy fields
- ✅ CORE-only approach maintained (no M3 fallback)

---

## 📊 Test Results Template

**Date:** [Date]
**Tester:** [Name]
**Database:** [Dev/Test/Prod]
**Backend Version:** [Commit hash]

### Test 3.1: Single Bridge
- File uploaded: ✅ / ❌
- Metadata extracted: ✅ / ❌
- Object type detected: ✅ / ❌ (Expected: bridge)
- Parent project linked: ✅ / ❌
- Database verified: ✅ / ❌
- Notes: [Any issues or observations]

### Test 3.2: Multiple Objects
- File uploaded: ✅ / ❌
- Objects created: ✅ / ❌ (Expected: 3)
- Type accuracy: ✅ / ❌ (bridge/tunnel/building)
- Hierarchy correct: ✅ / ❌
- Database verified: ✅ / ❌
- Notes: [Any issues or observations]

### Test 3.3: No Metadata
- File uploaded: ✅ / ❌
- Graceful handling: ✅ / ❌
- Objects created: ✅ / ❌
- No errors: ✅ / ❌
- Notes: [Any issues or observations]

### Test 3.4: No Concrete
- File uploaded: ✅ / ❌
- Error response: ✅ / ❌
- No fallback: ✅ / ❌
- Clear message: ✅ / ❌
- Notes: [Any issues or observations]

---

**Phase 3 Status:** Ready for testing
