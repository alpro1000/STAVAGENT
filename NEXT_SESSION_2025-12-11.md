# Next Session Quick Start - 2025-12-11

**Previous Session:** Error hunting (2025-12-11)
**Branch:** `claude/fix-excel-export-01S5qVgsohB9QwAb4CiZvYJ1`
**Status:** 🔴 CRITICAL BUGS FOUND - Requires immediate attention

---

## 🚨 Critical Issues Found (4 bugs remaining)

### **Priority 1: snapshots.js (CRITICAL - PostgreSQL completely broken)**
- **Issue:** All 7 routes are non-async, but use async database operations
- **Impact:** Snapshots feature **DOES NOT WORK** in PostgreSQL production
- **Files:** `backend/src/routes/snapshots.js`
- **Lines:** 19, 83, 124, 163, 233, 291, 322 (routes) + 11 db.prepare() calls
- **Fix:** Convert all routes to `async (req, res)` and add `await` to all db operations

### **Priority 2: monolith-projects.js (HIGH - SQLite broken for dev)**
- **Issue:** Hardcoded PostgreSQL syntax ($1, $2, ...) instead of SQLite (?, ?, ...)
- **Impact:** Cannot test monolith projects in development (SQLite)
- **Files:** `backend/src/routes/monolith-projects.js`
- **Lines:** 198, 240, 290
- **Fix:** Replace `client.query()` with `client.prepare()` and use ? placeholders

---

## What Was Fixed This Session

✅ **bridges.js:266** - Added missing `await` to snapshot deletion
✅ **Documented all bugs** in `CRITICAL_BUGS_FOUND_2025-12-11.md`

---

## Quick Commands

### Check current status
```bash
cd /home/user/STAVAGENT
git status
git log --oneline -5
```

### Read bug report
```bash
cat CRITICAL_BUGS_FOUND_2025-12-11.md
```

### Fix Priority 1 (snapshots.js)
```bash
# Edit snapshots.js - convert all 7 routes to async
# Example:
# Before: router.post('/create', (req, res) => {
# After:  router.post('/create', async (req, res) => {
#
# Then add await to all db.prepare() calls (11 locations)

# Test syntax
node -c backend/src/routes/snapshots.js

# Commit
git add backend/src/routes/snapshots.js
git commit -m "FIX: Convert snapshots.js routes to async (PostgreSQL compatibility)"
git push
```

### Fix Priority 2 (monolith-projects.js)
```bash
# Edit monolith-projects.js - replace client.query() with client.prepare()
# Replace: VALUES ($1, $2, $3, ...)
# With:    VALUES (?, ?, ?, ...)

# Test syntax
node -c backend/src/routes/monolith-projects.js

# Commit
git add backend/src/routes/monolith-projects.js
git commit -m "FIX: Use client.prepare() for SQLite compatibility in monolith-projects.js"
git push
```

---

## Testing After Fixes

### Test snapshots.js (Priority 1)
```bash
# Local (SQLite)
curl -X POST http://localhost:3001/api/snapshots/create \
  -H "Content-Type: application/json" \
  -d '{"bridge_id":"TEST","positions":[],"header_kpi":{}}'

# Production (PostgreSQL)
curl -X POST https://monolit-planner-api.onrender.com/api/snapshots/create \
  -H "Content-Type: application/json" \
  -d '{"bridge_id":"TEST","positions":[],"header_kpi":{}}'
```

### Test monolith-projects.js (Priority 2)
```bash
# Local (SQLite) - Currently fails, should work after fix
curl -X POST http://localhost:3001/api/monolith-projects \
  -H "Content-Type: application/json" \
  -d '{"project_id":"TEST","object_type":"bridge","object_name":"Test Bridge"}'
```

---

## Session Summary (2025-12-11)

### Analysis Completed
- ✅ Smart PK detection logic - Verified correct for all table types
- ✅ Null pointer exceptions - No critical issues found
- ✅ Transaction error handling - Correctly implemented
- ✅ Missing await keywords - Found 12 locations (1 fixed, 11 in snapshots.js)

### Bugs Found
1. ✅ **Fixed:** bridges.js:266 - Missing await (1 line)
2. ⏳ **TODO:** snapshots.js - Non-async routes (7 routes, 11 missing awaits)
3. ⏳ **TODO:** monolith-projects.js - Hardcoded PostgreSQL syntax (3 locations)

### Documentation Created
- `CRITICAL_BUGS_FOUND_2025-12-11.md` (detailed analysis, 344 lines)
- `NEXT_SESSION_2025-12-11.md` (this file - quick reference)

### Git Status
```
Commit: e7d9741
Message: FIX: Add missing await in bridges.js + Document critical PostgreSQL bugs
Branch: claude/fix-excel-export-01S5qVgsohB9QwAb4CiZvYJ1
Status: Pushed to remote
```

---

## Why These Bugs Exist

**Root Cause:**
- SQLite db.prepare() is **synchronous** - works without `await`
- PostgreSQL db.prepare() is **async** - returns Promises
- Code works in development (SQLite) but fails in production (PostgreSQL)

**Prevention for Future:**
- ✅ Always use `async (req, res)` for routes with database operations
- ✅ Always use `await` with db.prepare().run/get/all
- ✅ Always use `client.prepare()` with ? placeholders (never client.query())
- ✅ Test in BOTH SQLite and PostgreSQL before deploying

---

## Previous Session Context (2025-12-10)

The previous session fixed similar issues in:
- ✅ positions.js (2 transaction fixes)
- ✅ bridges.js (1 transaction fix)
- ✅ otskp.js (2 transaction fixes)
- ✅ upload.js (1 transaction fix)
- ✅ auth.js (removed workaround)

These fixes are working correctly. The bugs found in THIS session (snapshots.js, monolith-projects.js) are NEW discoveries.

---

**Generated:** 2025-12-11
**Next Action:** Fix snapshots.js (CRITICAL) then monolith-projects.js (HIGH)
**Estimated Time:** 3-5 hours for both fixes + testing
