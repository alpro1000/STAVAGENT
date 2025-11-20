# 🔄 Database Migration Guide: Project Hierarchy Implementation

**Date:** November 20, 2025
**Version:** 1.0
**Status:** Ready for deployment

---

## 📋 Overview

This migration adds project hierarchy support to the `monolith_projects` table, enabling the Stavba → Objects → Positions relationship structure.

**Affected Table:** `monolith_projects`

**New Columns:**
- `stavba` - Project name from file header
- `objekt` - Object description from file
- `soupis` - Budget/list name
- `parent_project_id` - Link to parent project

---

## ⚙️ Migration Steps

### For New Installations

**Automatic:** The schema will be created correctly with `schema-postgres.sql`

```bash
# Schema file will create the table with all columns
psql -U user -d monolit_planner -f backend/src/db/schema-postgres.sql
```

### For Existing Installations

**Manual Migration Required:** Run the migration script

#### Option 1: Using Migration Script (Recommended)

```bash
# Apply the migration
psql -U user -d monolit_planner -f backend/src/db/migrations/001-add-project-hierarchy.sql
```

#### Option 2: Manual SQL Commands

```sql
-- 1. Add new columns
ALTER TABLE monolith_projects
ADD COLUMN IF NOT EXISTS stavba VARCHAR(255),
ADD COLUMN IF NOT EXISTS objekt VARCHAR(255),
ADD COLUMN IF NOT EXISTS soupis VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_project_id VARCHAR(255);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_monolith_projects_stavba ON monolith_projects(stavba);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_parent ON monolith_projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_hierarchy ON monolith_projects(parent_project_id, object_type);
CREATE INDEX IF NOT EXISTS idx_monolith_projects_parent_type ON monolith_projects(parent_project_id, object_type) WHERE parent_project_id IS NOT NULL;

-- 3. Create views (optional but recommended)
CREATE OR REPLACE VIEW v_project_hierarchy AS
SELECT
  mp.project_id,
  mp.object_type,
  mp.object_name,
  mp.stavba,
  mp.parent_project_id,
  parent_mp.stavba AS parent_stavba,
  mp.concrete_m3,
  mp.owner_id,
  mp.created_at
FROM monolith_projects mp
LEFT JOIN monolith_projects parent_mp ON mp.parent_project_id = parent_mp.project_id;

CREATE OR REPLACE VIEW v_project_statistics AS
SELECT
  mp.project_id,
  mp.stavba,
  COUNT(DISTINCT CASE WHEN child.object_type = 'bridge' THEN child.project_id END) AS bridge_count,
  COUNT(DISTINCT CASE WHEN child.object_type = 'tunnel' THEN child.project_id END) AS tunnel_count,
  COUNT(DISTINCT CASE WHEN child.object_type = 'building' THEN child.project_id END) AS building_count,
  COUNT(DISTINCT CASE WHEN child.object_type != 'project' THEN child.project_id END) AS total_objects,
  SUM(CASE WHEN child.object_type != 'project' THEN child.concrete_m3 ELSE 0 END) AS total_concrete_m3
FROM monolith_projects mp
LEFT JOIN monolith_projects child ON mp.project_id = child.parent_project_id
WHERE mp.object_type = 'project'
GROUP BY mp.project_id, mp.stavba;
```

---

## ✅ Migration Verification

### Check Migration Success

```sql
-- 1. Verify new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'monolith_projects'
  AND column_name IN ('stavba', 'objekt', 'soupis', 'parent_project_id');

-- Expected output:
-- column_name      | data_type
-- stavba          | character varying
-- objekt          | character varying
-- soupis          | character varying
-- parent_project_id| character varying
```

### Check Indexes

```sql
-- 2. Verify indexes created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'monolith_projects'
  AND indexname LIKE 'idx_monolith_projects_%';

-- Expected output should include:
-- idx_monolith_projects_stavba
-- idx_monolith_projects_parent
-- idx_monolith_projects_hierarchy
```

### Check Views

```sql
-- 3. Verify views created (optional)
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'v_project_%';

-- Expected output:
-- v_project_hierarchy
-- v_project_statistics
-- v_orphaned_objects
```

---

## 📊 Data Migration (Optional)

If you want to backfill existing data:

### Scenario 1: Existing Projects Without Hierarchy

```sql
-- For existing projects that were created manually (no file metadata)
-- They will have parent_project_id = NULL, which is correct

-- Verify no data needs migration
SELECT COUNT(*) FROM monolith_projects
WHERE parent_project_id IS NULL
  AND object_type != 'project';
-- This is expected - objects created before migration won't have parents
```

### Scenario 2: Create Project-Level Records from Existing Objects

```sql
-- If you have objects with stavba values, create project records:
INSERT INTO monolith_projects
  (project_id, object_type, stavba, owner_id)
SELECT DISTINCT
  LOWER(REPLACE(stavba, ' ', '_')) || '_project' as project_id,
  'project' as object_type,
  stavba,
  owner_id
FROM monolith_projects
WHERE stavba IS NOT NULL
  AND object_type != 'project'
ON CONFLICT (project_id) DO NOTHING;

-- Then link objects to projects:
UPDATE monolith_projects child
SET parent_project_id = parent.project_id
FROM (
  SELECT project_id, stavba FROM monolith_projects WHERE object_type = 'project'
) parent
WHERE child.stavba = parent.stavba
  AND child.object_type != 'project'
  AND child.parent_project_id IS NULL;
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Backup database
- [ ] Test migration on development database first
- [ ] Verify all 4 new columns defined in schema
- [ ] Verify 3 indexes created

### Deployment

- [ ] Apply migration script
- [ ] Verify migration success (see verification section above)
- [ ] Restart backend service

### Post-Deployment

- [ ] Test file upload with metadata extraction
- [ ] Verify project records created
- [ ] Verify objects linked to projects
- [ ] Check response includes hierarchy info
- [ ] Monitor logs for any errors

---

## 🔍 Query Examples After Migration

### Find all objects in a project

```sql
-- Get all objects in a specific stavba project
SELECT project_id, object_type, object_name, concrete_m3
FROM monolith_projects
WHERE parent_project_id = 'i20_hnevkov__sedlice'
ORDER BY object_type, created_at;
```

### Get project summary

```sql
-- Get summary of all projects with their object counts
SELECT
  stavba,
  COUNT(DISTINCT project_id) as object_count,
  SUM(concrete_m3) as total_concrete_m3
FROM monolith_projects
WHERE parent_project_id IS NOT NULL
GROUP BY stavba
ORDER BY stavba;
```

### List project hierarchy

```sql
-- Use the view to see full hierarchy
SELECT * FROM v_project_hierarchy
WHERE parent_stavba IS NOT NULL
ORDER BY parent_stavba, object_type;
```

### Get project statistics

```sql
-- View project with object type breakdown
SELECT * FROM v_project_statistics
ORDER BY total_concrete_m3 DESC;
```

---

## 🛡️ Data Integrity

### Referential Integrity

**Foreign Key Constraint:**
```sql
-- The schema includes a self-referencing foreign key:
parent_project_id REFERENCES monolith_projects(project_id) ON DELETE SET NULL
```

**Behavior:**
- If a parent project is deleted, `parent_project_id` is set to NULL
- Child objects are not deleted
- This prevents orphaning objects when a project is removed

### Orphaned Objects View

The migration includes a view to identify orphaned objects:

```sql
SELECT * FROM v_orphaned_objects;

-- This shows objects with:
-- - parent_project_id IS NULL
-- - object_type != 'project'
-- - stavba IS NOT NULL (old data)
```

---

## 🔄 Rollback Instructions

If you need to rollback the migration:

```sql
-- Drop the new views
DROP VIEW IF EXISTS v_orphaned_objects;
DROP VIEW IF EXISTS v_project_statistics;
DROP VIEW IF EXISTS v_project_hierarchy;

-- Drop the new indexes
DROP INDEX IF EXISTS idx_monolith_projects_hierarchy;
DROP INDEX IF EXISTS idx_monolith_projects_parent_type;
DROP INDEX IF EXISTS idx_monolith_projects_parent;
DROP INDEX IF EXISTS idx_monolith_projects_stavba;

-- Drop the new columns
-- NOTE: This will lose any data in these columns!
ALTER TABLE monolith_projects
DROP COLUMN IF EXISTS parent_project_id,
DROP COLUMN IF EXISTS soupis,
DROP COLUMN IF EXISTS objekt,
DROP COLUMN IF EXISTS stavba;
```

---

## 📈 Performance Impact

### New Indexes

The migration creates 4 new indexes:

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_monolith_projects_stavba` | `stavba` | Query by project name |
| `idx_monolith_projects_parent` | `parent_project_id` | Find objects in project |
| `idx_monolith_projects_hierarchy` | `parent_project_id, object_type` | Hierarchy queries |
| `idx_monolith_projects_parent_type` | `parent_project_id, object_type` | Filtered hierarchy queries |

**Storage Impact:** ~50-100 MB additional index space (depending on data volume)

**Query Performance:**
- ✅ Queries by `stavba` will be much faster
- ✅ Hierarchy traversal optimized
- ✅ Minimal impact on existing queries

---

## 📝 Migration Verification Checklist

After running the migration, verify:

- [ ] All 4 new columns exist in monolith_projects
- [ ] All 4 new indexes created successfully
- [ ] Backend service starts without errors
- [ ] File upload endpoint works
- [ ] Metadata is extracted from file headers
- [ ] Stavba project records created
- [ ] Objects linked to parent projects
- [ ] Response includes hierarchy info
- [ ] No null constraint violations in logs

---

## 🆘 Troubleshooting

### Issue: "Column already exists" error

**Cause:** Column already added in previous migration

**Solution:** This is expected. Migration script uses `IF NOT EXISTS`, so it's safe to re-run.

### Issue: Foreign key constraint fails

**Cause:** Attempting to set parent_project_id to non-existent project_id

**Solution:** Ensure parent project exists before linking child objects

### Issue: Views fail to create

**Cause:** PostgreSQL version compatibility

**Solution:** Views are optional. They improve query performance but code works without them.

---

## 📚 Related Documentation

- `PROJECT_HIERARCHY_IMPLEMENTATION.md` - Implementation details
- `IMPLEMENTATION_CORRECT_ARCHITECTURE.md` - Architecture overview
- `CORRECTED_ARCHITECTURE_SO_NOT_TYPE.md` - Design explanation

---

**Status:** Ready for deployment ✅
