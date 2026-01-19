# Database Schema Fix - 2026-01-19

## Problem Resolved

**Issue:** Excel import data appeared in UI but disappeared after page refresh (F5)

**Root Cause:** PostgreSQL schema file (`schema-postgres.sql`) contained obsolete columns from VARIANT 0 architecture that no longer exist in VARIANT 1:
- `stavba`
- `objekt`
- `soupis`
- `parent_project_id`

**Database Logs Showed:**
```
ERROR: column "stavba" does not exist
STATEMENT: CREATE INDEX IF NOT EXISTS idx_monolith_projects_stavba ON monolith_projects(stavba);
ERROR: column "parent_project_id" does not exist
STATEMENT: CREATE INDEX IF NOT EXISTS idx_monolith_projects_parent ON monolith_projects(parent_project_id);
```

**Impact:** Database initialization failed → Excel import data couldn't persist → Data lost after refresh

---

## Solution Applied

**Commit:** `c3dbb73` - FIX: Remove VARIANT 0 architecture columns from PostgreSQL schema

**Changes Made:**
1. ✅ Removed 4 obsolete columns from `monolith_projects` table definition (lines 151-155)
2. ✅ Removed 3 obsolete indexes (lines 274-276):
   - `idx_monolith_projects_stavba`
   - `idx_monolith_projects_parent`
   - `idx_monolith_projects_hierarchy`

**File Modified:**
- `backend/src/db/schema-postgres.sql` (-11 lines)

---

## Next Steps to Restore Service

### 1. Deploy Backend with Schema Fix

**Option A: Automatic Deploy (if autoDeploy enabled)**
- Backend will automatically redeploy from branch `claude/create-onboarding-guide-E4wrx`
- Wait 2-3 minutes for deployment to complete
- Check logs for "Schema initialized successfully"

**Option B: Manual Deploy (if autoDeploy disabled)**
1. Go to https://dashboard.render.com
2. Find "Monolit-Planner API" service
3. Click "Manual Deploy" → Select branch `claude/create-onboarding-guide-E4wrx`
4. Wait for deployment to complete
5. Check logs for "Schema initialized successfully"

### 2. Clear Production Database

**Why?** Remove corrupted data from failed initialization attempts

**Method 1: Command Line (Recommended)**

```bash
psql "postgresql://monolit_user:XG78v4ASVxwe3X8uEg0Cma6tviE7xcVx@dpg-d4ao5tripnbc73aegphg-a.oregon-postgres.render.com/monolit_planner" << 'EOF'
BEGIN;
DELETE FROM positions;
DELETE FROM parts;
DELETE FROM snapshots;
DELETE FROM bridges;
DELETE FROM monolith_projects;
COMMIT;
SELECT 'Database cleared!' as status;
SELECT COUNT(*) as remaining_projects FROM monolith_projects;
EOF
```

**Expected Output:**
```
DELETE ... (number of rows deleted)
status
------------------
Database cleared!

remaining_projects
------------------
0
```

**Method 2: Render Dashboard (Visual)**

See detailed instructions in: `EXECUTE_CLEAR_DB.md` (Вариант 2)

### 3. Verify Fix

**Test Sequence:**
1. ✅ Open Monolit Planner frontend: https://monolit-planner-frontend.onrender.com
2. ✅ Page should load with empty project list
3. ✅ Import Excel file (same file that failed before)
4. ✅ Verify projects appear in UI
5. ✅ **Refresh page (F5)**
6. ✅ **Projects should still be visible** ← THIS IS THE FIX!

**If Test Fails:**
- Check backend logs for errors during Excel import
- Look for "Created bridge:" and "Inserted X positions" log lines
- If missing, there may be another issue

### 4. Backend Logs to Monitor

**Good Logs (Success):**
```
[PostgreSQL] Schema initialized successfully
[Upload] ✅ Created bridge: SO12-20-01 "MOST..." (123.45m³)
[Upload] 🚀 Inserted 10 concrete positions for SO12-20-01
```

**Bad Logs (Still Broken):**
```
ERROR: column "stavba" does not exist
[Upload] Error inserting positions: ...
```

---

## Architecture Background

### VARIANT 0 (Old - Removed)
- Complex hierarchy: `stavba` → `objekt` → `soupis`
- Parent-child relationships with `parent_project_id`
- Multiple object types with specific fields
- **Status:** Deprecated December 2025

### VARIANT 1 (Current - Simplified)
- Single universal object type: `monolith_projects`
- User describes project type in `object_name` field (free text)
- No hierarchy, no parent-child relationships
- **Status:** Active since December 2025

**The Problem:** Schema file wasn't updated to match VARIANT 1

**The Fix:** Removed old VARIANT 0 columns and indexes from schema

---

## Files Reference

| File | Purpose |
|------|---------|
| `SCHEMA_FIX_2026-01-19.md` | **THIS FILE** - What was fixed and how to proceed |
| `EXECUTE_CLEAR_DB.md` | Step-by-step database clearing instructions |
| `CLEAR_DATABASE.md` | General database maintenance guide |
| `clear-production-db.sql` | SQL script for clearing (can run directly) |
| `migrations/004_normalize_project_ids.sql` | Previous migration (ID normalization) |
| `backend/src/db/schema-postgres.sql` | **FIXED FILE** - PostgreSQL schema |
| `backend/src/db/migrations/001-add-project-hierarchy.sql` | Old VARIANT 0 migration (not used) |

---

## Summary

**Before:**
- Schema had obsolete columns → Database init failed → Data didn't persist

**After:**
- Schema cleaned up → Database init succeeds → Data persists after refresh ✅

**What Changed:**
- 11 lines removed from `schema-postgres.sql`
- No code changes needed
- No migration needed (fresh init will work)

**User Action Required:**
1. Wait for backend redeploy (2-3 min)
2. Clear production database (30 seconds)
3. Test Excel import + F5 refresh (2 min)
4. **Total time:** ~5 minutes

---

**Commit:** `c3dbb73`
**Branch:** `claude/create-onboarding-guide-E4wrx`
**Date:** 2026-01-19
**Impact:** Critical fix for data persistence issue
