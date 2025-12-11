# Critical Bugs Found - Session 2025-12-11

**Branch:** `claude/fix-excel-export-01S5qVgsohB9QwAb4CiZvYJ1`
**Status:** 🔴 CRITICAL - Multiple PostgreSQL compatibility issues found
**Severity:** HIGH - These bugs break PostgreSQL functionality

---

## 🚨 Executive Summary

**Found:** 5 critical bugs that break PostgreSQL compatibility
**Fixed:** 1 bug (bridges.js:266)
**Remaining:** 4 critical bugs (snapshots.js, monolith-projects.js)

**Impact:**
- snapshots.js: **COMPLETELY BROKEN** in PostgreSQL (7 non-async routes)
- monolith-projects.js: **BROKEN** in SQLite (hardcoded PostgreSQL placeholders)

---

## Critical Bug #1: snapshots.js - Non-Async Routes (CRITICAL)

### Problem
ALL 7 routes in `snapshots.js` are **synchronous** (`(req, res) => {}`), but use async database operations.

### Impact
- ✅ Works in SQLite (synchronous db.prepare())
- ❌ **BROKEN in PostgreSQL** (async db.prepare())

### Affected Routes
1. `POST /api/snapshots/create` (line 19)
2. `GET /api/snapshots/:bridge_id` (line 83)
3. `GET /api/snapshots/detail/:snapshot_id` (line 124)
4. `POST /api/snapshots/:snapshot_id/restore` (line 163)
5. `POST /api/snapshots/:snapshot_id/unlock` (line 233)
6. `DELETE /api/snapshots/:snapshot_id` (line 291)
7. `GET /api/snapshots/active/:bridge_id` (line 322)

### Example (Line 19-34)
```javascript
// BROKEN ❌
router.post('/create', (req, res) => {  // Not async!
  try {
    const previousLocked = db.prepare(`
      SELECT id FROM snapshots
      WHERE bridge_id = ? AND is_locked = 1
    `).get(bridge_id);  // No await - returns Promise in PostgreSQL

    if (previousLocked) {
      db.prepare('UPDATE snapshots SET is_locked = 0 WHERE id = ?')
        .run(previousLocked.id);  // No await - doesn't execute in PostgreSQL
    }
    // ...
  } catch (error) {
    // ...
  }
});
```

### Fix Required
Convert ALL 7 routes to async and add await to ALL database operations:

```javascript
// CORRECT ✅
router.post('/create', async (req, res) => {  // async
  try {
    const previousLocked = await db.prepare(`
      SELECT id FROM snapshots
      WHERE bridge_id = ? AND is_locked = 1
    `).get(bridge_id);  // await

    if (previousLocked) {
      await db.prepare('UPDATE snapshots SET is_locked = 0 WHERE id = ?')
        .run(previousLocked.id);  // await
    }
    // ... (add await to ALL db operations)
  } catch (error) {
    // ...
  }
});
```

### Locations to Fix
```bash
# All db.prepare() calls in snapshots.js need await
grep -n "db\.prepare" backend/src/routes/snapshots.js

# Results:
28:    const previousLocked = db.prepare(`         # Missing await
34:      db.prepare('UPDATE...').run(...);         # Missing await
46:    db.prepare(`INSERT...`).run(...);           # Missing await
87:    const snapshots = db.prepare(`              # Missing await
128:    const snapshot = db.prepare(`               # Missing await
196:    db.prepare(`UPDATE...`).run(...);           # Missing await
242:    const snapshot = db.prepare(`               # Missing await
254:    db.prepare(`UPDATE...`).run(...);           # Missing await
295:    const snapshot = db.prepare(`               # Missing await
307:    const result = db.prepare('DELETE...').run(...)  # Missing await
326:    const snapshot = db.prepare(`               # Missing await
```

### Testing
```bash
# Test in development (SQLite)
curl -X POST http://localhost:3001/api/snapshots/create \
  -H "Content-Type: application/json" \
  -d '{"bridge_id":"TEST","positions":[]}'

# Test in production (PostgreSQL)
curl -X POST https://monolit-planner-api.onrender.com/api/snapshots/create \
  -H "Content-Type: application/json" \
  -d '{"bridge_id":"TEST","positions":[]}'

# Expected: Both should work identically
# Actual: PostgreSQL will fail silently or return wrong data
```

---

## Critical Bug #2: monolith-projects.js - Hardcoded PostgreSQL Syntax (HIGH)

### Problem
Transaction code uses **PostgreSQL placeholders** ($1, $2, ...) directly instead of using `client.prepare()` with SQLite placeholders (?, ?, ...).

### Impact
- ✅ Works in PostgreSQL
- ❌ **BROKEN in SQLite** (SQLite doesn't understand $1, $2)

### Root Cause
Code bypasses the abstraction layer by calling `client.query()` directly with PostgreSQL-specific SQL.

### Affected Code
**File:** `backend/src/routes/monolith-projects.js`

**Location 1: Line 184-212** - Create project
```javascript
// BROKEN ❌
await db.transaction(async (client) => {
  const insertProjectSql = `
    INSERT INTO monolith_projects (...)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `;  // PostgreSQL placeholders!

  await client.query(insertProjectSql, [...]); // Bypasses abstraction
```

**Location 2: Line 217-240** - Create parts (batch insert)
```javascript
// BROKEN ❌
const insertPartSql = `
  INSERT INTO parts (part_id, project_id, part_name, is_predefined)
  VALUES ($1, $2, $3, $4)
`;  // PostgreSQL placeholders!

const placeholders = templates.map((_, idx) => {
  const offset = idx * 4;
  return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
}).join(',');  // Dynamic PostgreSQL placeholders!

await client.query(batchInsertSql, values);  // Bypasses abstraction
```

**Location 3: Line 279-290** - Create positions (batch insert)
```javascript
// BROKEN ❌
const insertPositionsSql = `
  INSERT INTO positions (...)
  VALUES ($1, $2, ...)
`;  // PostgreSQL placeholders!

await client.query(insertPositionsSql, positionValues);  // Bypasses abstraction
```

### Fix Required
Replace `client.query()` with `client.prepare()` using SQLite placeholders:

```javascript
// CORRECT ✅
await db.transaction(async (client) => {
  const insertProjectSql = `
    INSERT INTO monolith_projects (...)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;  // SQLite placeholders (converted to $1, $2, ... by client.prepare)

  const stmt = client.prepare(insertProjectSql);
  await stmt.run(
    project_id,
    object_type,
    project_name || '',
    object_name || '',
    ownerId,
    description || '',
    span_length_m || null,
    deck_width_m || null,
    pd_weeks || null,
    building_area_m2 || null,
    building_floors || null,
    road_length_km || null,
    road_width_m || null
  );
});
```

### Testing
```bash
# Test with SQLite (will currently FAIL)
NODE_ENV=development npm run dev

curl -X POST http://localhost:3001/api/monolith-projects \
  -H "Content-Type: application/json" \
  -d '{"project_id":"TEST","object_type":"bridge"}'

# Expected: Should work in both SQLite and PostgreSQL
# Actual: Fails in SQLite with "no such column: $1"
```

---

## Bug #3: bridges.js:266 - Missing await (FIXED ✅)

### Problem
DELETE operation missing `await` keyword.

### Status
✅ **FIXED** in this session

### Fix Applied
```javascript
// Before (BROKEN ❌)
const deleteResult = db.prepare('DELETE FROM snapshots WHERE bridge_id = ?').run(bridge_id);

// After (FIXED ✅)
const deleteResult = await db.prepare('DELETE FROM snapshots WHERE bridge_id = ?').run(bridge_id);
```

---

## Summary Table

| File | Lines | Issue | Severity | Status |
|------|-------|-------|----------|--------|
| snapshots.js | 19, 83, 124, 163, 233, 291, 322 | Non-async routes with async db ops | CRITICAL | ⏳ TODO |
| snapshots.js | 28, 34, 46, 87, 128, 196, 242, 254, 295, 307, 326 | Missing await (11 locations) | CRITICAL | ⏳ TODO |
| monolith-projects.js | 198, 240, 290 | Hardcoded PostgreSQL syntax | HIGH | ⏳ TODO |
| bridges.js | 266 | Missing await | MEDIUM | ✅ FIXED |

---

## Recommended Action Plan

### Priority 1: snapshots.js (CRITICAL - Blocks PostgreSQL)
1. Convert all 7 routes to async
2. Add await to all 11 db.prepare() calls
3. Test all 7 endpoints in both SQLite and PostgreSQL

**Estimated Time:** 2-3 hours
**Risk:** Medium (large refactor, but straightforward pattern)

### Priority 2: monolith-projects.js (HIGH - Blocks SQLite dev)
1. Replace 3x `client.query()` with `client.prepare()`
2. Change PostgreSQL placeholders ($1, $2) to SQLite (?, ?)
3. Test project creation in both databases

**Estimated Time:** 1-2 hours
**Risk:** High (batch inserts with dynamic placeholders)

---

## Testing Checklist

### After Fixing snapshots.js
- [ ] Create snapshot (POST /create)
- [ ] List snapshots (GET /:bridge_id)
- [ ] Get snapshot details (GET /detail/:snapshot_id)
- [ ] Restore snapshot (POST /:snapshot_id/restore)
- [ ] Unlock snapshot (POST /:snapshot_id/unlock)
- [ ] Delete snapshot (DELETE /:snapshot_id)
- [ ] Get active snapshot (GET /active/:bridge_id)
- [ ] Verify rollback works (force error mid-transaction)

### After Fixing monolith-projects.js
- [ ] Create project with default parts (SQLite)
- [ ] Create project with default parts (PostgreSQL)
- [ ] Verify parts created correctly
- [ ] Verify positions created if templates provided

---

## Related Issues

### Previous Session (2025-12-10)
Session 2025-12-10 fixed similar issues in:
- ✅ positions.js (2 transaction fixes)
- ✅ bridges.js (1 transaction fix)
- ✅ otskp.js (2 transaction fixes)
- ✅ upload.js (1 transaction fix)
- ✅ auth.js (removed workaround)

### Root Cause Analysis
**Why these bugs exist:**
1. **SQLite is synchronous** - Code works without await in development
2. **PostgreSQL is async** - Same code fails silently in production
3. **Abstraction layer** - `db.prepare()` returns different objects:
   - SQLite: Synchronous methods (.run(), .get(), .all())
   - PostgreSQL: Async methods (return Promises)

**Prevention:**
- Always use `async` for routes that touch database
- Always use `await` with db.prepare().run/get/all
- Never call `client.query()` directly (use `client.prepare()`)
- Test in both SQLite (dev) and PostgreSQL (prod) before deploying

---

## Commands for Next Session

```bash
# Check current branch
git status

# Fix snapshots.js (manual edit required)
# TODO: Convert all routes to async + add await

# Fix monolith-projects.js (manual edit required)
# TODO: Replace client.query() with client.prepare()

# Test syntax
node -c backend/src/routes/snapshots.js
node -c backend/src/routes/monolith-projects.js

# Commit fixes
git add backend/src/routes/snapshots.js backend/src/routes/monolith-projects.js
git commit -m "FIX: Convert snapshots.js to async and fix monolith-projects.js SQLite compatibility"

# Push to remote
git push -u origin claude/fix-excel-export-01S5qVgsohB9QwAb4CiZvYJ1
```

---

**Generated:** 2025-12-11
**Session:** Error hunting continuation from 2025-12-10
**Next Session:** Fix snapshots.js and monolith-projects.js critical bugs
