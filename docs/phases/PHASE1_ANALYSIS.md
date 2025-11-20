# Phase 1 Implementation Analysis Report - Monolit-Planner

## Executive Summary

The Phase 1 implementation for Universal MonolithProject introduces a new data model supporting multiple construction types (bridge, building, parking, road, custom). However, **critical inconsistencies exist between database schemas, API endpoints, and frontend implementation**, creating data integrity risks and incomplete integration.

**Status: INCOMPLETE - Frontend not fully integrated with new API**

---

## 1. DATABASE SCHEMA CONSISTENCY ANALYSIS

### 1.1 Critical Issues: SQLite vs PostgreSQL Inconsistencies

#### Issue #1: Foreign Key CASCADE Constraints Missing in SQLite

**Severity**: CRITICAL - Data Integrity Risk

| Table | Relationship | SQLite | PostgreSQL | Impact |
|-------|--------------|--------|-----------|--------|
| monolith_projects | owner_id → users(id) | NO CASCADE | CASCADE | User deletion leaves orphaned projects |
| bridges | owner_id → users(id) | NO CASCADE (migration) | CASCADE | User deletion leaves orphaned bridges |
| snapshots | bridge_id → bridges | NO CASCADE | CASCADE | Bridge deletion leaves orphaned snapshots |
| snapshots | parent_snapshot_id | NO CASCADE | SET NULL | Snapshot hierarchy broken on deletion |
| positions | bridge_id → bridges | NO CASCADE | CASCADE | Bridge deletion leaves orphaned positions |

**SQLite Schema Gaps** (migrations.js lines 341-365):
```javascript
FOREIGN KEY (owner_id) REFERENCES users(id)  // Missing ON DELETE CASCADE
```

**PostgreSQL Implementation** (schema-postgres.sql line 113):
```sql
owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

**Consequence**: 
- In PostgreSQL: User deletion cascades deletes to all projects/bridges
- In SQLite: Orphaned records remain, violating referential integrity

---

#### Issue #2: Boolean Type Inconsistency in SQLite vs PostgreSQL

**Severity**: HIGH - Data Type Mismatch

SQLite uses `INTEGER` (0/1) for booleans, PostgreSQL uses `BOOLEAN` type.

**Affected Columns**:

1. **part_templates.is_default**
   - SQLite (line 374): `is_default INTEGER DEFAULT 1`
   - PostgreSQL (line 136): `is_default BOOLEAN DEFAULT TRUE`

2. **parts.is_predefined**
   - SQLite (line 386): `is_predefined INTEGER DEFAULT 0`
   - PostgreSQL (line 146): `is_predefined BOOLEAN DEFAULT FALSE`

**Consequence**:
- Data type mismatch during migration from SQLite to PostgreSQL
- Query results inconsistent (1/0 vs TRUE/FALSE)
- Frontend type safety compromised

**Files Affected**:
- `/home/user/Monolit-Planner/backend/src/db/migrations.js` (lines 368-391)
- `/home/user/Monolit-Planner/backend/src/db/schema-postgres.sql` (lines 131-149)

---

#### Issue #3: Timestamp Type Inconsistency

**Severity**: MEDIUM - Type Mismatch

| Database | Type |
|----------|------|
| SQLite | TEXT DEFAULT CURRENT_TIMESTAMP (returns string) |
| PostgreSQL | TIMESTAMP DEFAULT CURRENT_TIMESTAMP (returns timestamp) |

**Impact**: Frontend must handle both string and timestamp formats, adding complexity to parsing/formatting.

---

### 1.2 Architectural Issues: Coexisting Data Models

#### Issue #4: Legacy Bridge Table vs New MonolithProjects Table

**Severity**: HIGH - Architectural Confusion

The codebase maintains **both** legacy `bridges` and new `monolith_projects` tables simultaneously:

**bridges table** (migrations.js lines 164-177):
- Legacy schema for bridge-specific data
- Still referenced by positions table

**monolith_projects table** (migrations.js lines 341-365):
- New universal schema for all construction types
- Referenced by parts table

**Problem**: These tables are not synchronized. The positions API still queries the legacy bridges table:

**positions.js line 38**:
```javascript
LEFT JOIN positions pos ON p.part_name = pos.part_name AND p.project_id = pos.bridge_id
```

This joins:
- `p.project_id` (monolith_projects reference)
- `pos.bridge_id` (bridges reference)

**This join assumes project_id values match bridge_id values**, which is a fragile coupling.

**Files Affected**:
- `/home/user/Monolit-Planner/backend/src/routes/parts.js` (line 83)
- `/home/user/Monolit-Planner/backend/src/db/migrations.js`
- `/home/user/Monolit-Planner/backend/src/db/schema-postgres.sql`

---

### 1.3 Index Coverage

**Status**: ADEQUATE

Both SQLite and PostgreSQL have identical indexes:
- ✅ idx_monolith_projects_owner
- ✅ idx_monolith_projects_type
- ✅ idx_monolith_projects_status
- ✅ idx_parts_project
- ✅ idx_part_templates_type

However, **no unique constraint on (object_type, part_name)** in part_templates could allow duplicates.

---

## 2. API ENDPOINT CONSISTENCY ANALYSIS

### 2.1 Critical Integration Issue: Frontend Using Legacy API

#### Issue #5: CreateMonolithForm Calling Wrong API Endpoint

**Severity**: CRITICAL - Phase 1 Implementation Incomplete

**Location**: `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx` (line 50)

```typescript
await createBridge({
  bridge_id: projectId.trim(),
  object_type: objectType,
  project_name: projectName.trim() || undefined,
  // ...
});
```

**Problem**: 
- `createBridge()` is defined in api.ts as `bridgesAPI.create` (line 311)
- This calls `/api/bridges` endpoint (legacy)
- Should call `/api/monolith-projects` endpoint (new)

**Verification**:
- `/home/user/Monolit-Planner/frontend/src/services/api.ts` (line 94-96)
  - `bridgesAPI.create` POSTs to `/api/bridges`
  - Sends `bridge_id` parameter
  
- `/home/user/Monolit-Planner/backend/src/routes/bridges.js` (line 88-115)
  - Creates entry in legacy `bridges` table
  - NOT in `monolith_projects` table

- `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js` (line 79-164)
  - Expects `project_id`, not `bridge_id`
  - Creates in `monolith_projects` table
  - Never called by frontend

**Consequence**: 
- New projects are created in legacy `bridges` table
- `monolith_projects` table remains empty
- Part templates and parts APIs never used
- Phase 1 objectives not achieved

**Files Affected**:
- Frontend: `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`
- Frontend API: `/home/user/Monolit-Planner/frontend/src/services/api.ts` (line 311)
- Backend: Both `/api/bridges` and `/api/monolith-projects` exist but not coordinated

---

### 2.2 API Endpoint Review

#### monolith-projects.js Endpoints

**File**: `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js`

✅ **Strengths**:
- Authentication properly enforced (line 21)
- Ownership verification consistent (lines 30, 173, 212)
- Type validation (lines 103-104)
- CASCADE delete handled by database (line 305-306)

⚠️ **Concerns**:
- Project ID globally unique (not per-user) - check ownership only on read operations
- No input sanitization beyond required field checks
- No validation for numeric field ranges (can set negative concrete_m3, span_length_m)

**Status Check**:
- GET /api/monolith-projects - ✅ Lists user's projects
- POST /api/monolith-projects - ✅ Creates new project
- GET /api/monolith-projects/:id - ✅ Checks ownership
- PUT /api/monolith-projects/:id - ✅ Checks ownership, COALESCE for updates
- DELETE /api/monolith-projects/:id - ✅ Checks ownership
- GET /api/monolith-projects/search/:type - ✅ Filters by type

---

#### Issue #6: Part Name Join Inconsistency in parts.js

**Severity**: HIGH - Query Logic Error

**Location**: `/home/user/Monolit-Planner/backend/src/routes/parts.js` (line 83)

```javascript
LEFT JOIN positions pos ON p.part_name = pos.part_name AND p.project_id = pos.bridge_id
```

**Problem**: Joining on `p.project_id = pos.bridge_id`
- `p.project_id` references `monolith_projects(project_id)`
- `pos.bridge_id` references `bridges(bridge_id)`
- These are different tables with potentially different ID spaces

**Consequence**: Query returns incorrect position counts when:
- Project IDs don't match bridge IDs
- Multiple data models coexist

**Test Case**: 
- Create project with ID "proj001"
- Query /api/parts/list/proj001
- Position count will be 0 (unless legacy bridge_id happened to be "proj001")

---

#### Issue #7: Insufficient Input Validation

**Severity**: MEDIUM - Security/UX

**monolith-projects.js**:
- No validation for numeric field ranges
  - `span_length_m` can be negative
  - `building_floors` can be -5
  - `concrete_m3` can be negative

**parts.js**:
- No validation for `part_name` length (could be 50KB string)
- No check for duplicate part names per project

---

### 2.3 parts.js Endpoints

**File**: `/home/user/Monolit-Planner/backend/src/routes/parts.js`

✅ **Strengths**:
- Templates endpoint has no auth requirement (correct for bootstrap)
- Ownership verification through project lookup
- Transaction consistency

⚠️ **Concerns**:
- Part ID generation uses `Date.now()` (line 120) - not collision-proof
- No check for duplicate part names within project
- Part rename validation (lines 164-181) assumes positions are global (part_name only)

**Recommended Fix for Part ID**:
```javascript
// Better approach
import { v4 as uuidv4 } from 'uuid';
const partId = `${project_id}_${part_name}_${uuidv4()}`;
```

---

## 3. FRONTEND COMPONENTS ANALYSIS

### 3.1 CreateMonolithForm.tsx

**File**: `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`

#### Issue #8: Type Mismatch - Incorrect Parameter Names

**Severity**: CRITICAL - API Contract Violation

```typescript
// Line 50-62: Sending bridge_id but API expects project_id
await createBridge({
  bridge_id: projectId.trim(),  // ❌ Wrong parameter name
  object_type: objectType,
  project_name: projectName.trim() || undefined,
  object_name: objectName.trim() || projectId.trim(),
  // ...
});
```

**Expected by /api/monolith-projects** (monolith-projects.js line 83):
```javascript
const { project_id, object_type, ... } = req.body;
```

**Consequence**: 
- Form submission fails silently or creates wrong data structure
- Never tested against actual /api/monolith-projects endpoint

---

#### Issue #9: No TypeScript Types for New API

**Severity**: MEDIUM - Type Safety

No TypeScript interfaces defined for `monolith_projects` response structure.

**Current State**: 
- Uses generic `Bridge` type from shared types (line 6)
- Should have dedicated `MonolithProject` type

**Missing Types**:
```typescript
interface MonolithProject {
  project_id: string;
  object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
  project_name?: string;
  object_name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  // Type-specific fields
  span_length_m?: number;
  deck_width_m?: number;
  building_area_m2?: number;
  // ...
}
```

---

#### Issue #10: Form Submission Without Error Recovery

**Severity**: MEDIUM - UX

```typescript
// Line 38-69: Catch block only shows error message
} catch (err: any) {
  setError(err.response?.data?.error || err.message || 'Chyba...');
}
```

**Issues**:
- No retry logic for transient failures
- No form field clearing on success
- No distinction between validation errors (400) and server errors (500)

---

### 3.2 ObjectTypeSelector.tsx

**File**: `/home/user/Monolit-Planner/frontend/src/components/ObjectTypeSelector.tsx`

✅ **Strengths**:
- Good TypeScript typing (ObjectTypeSelectorProps interface)
- Proper disabled state handling
- Descriptive labels for each type

⚠️ **Concerns**:
- Hidden select not validated before form submission (relies on form-level required)
- No accessibility improvements (aria-labels)

---

## 4. DATA INTEGRITY ISSUES

### 4.1 CASCADE Delete Implementation Status

**Summary Table**:

| Relationship | SQLite | PostgreSQL | Risk Level |
|--------------|--------|-----------|-----------|
| users → monolith_projects | NO | YES | CRITICAL |
| users → bridges | NO | YES | CRITICAL |
| monolith_projects → parts | YES | YES | LOW |
| bridges → positions | NO | YES | HIGH |
| bridges → snapshots | NO | YES | HIGH |
| snapshots → child snapshots | NO | SET NULL | MEDIUM |

**High Risk Scenarios**:

**Scenario 1: User Deletion**
- PostgreSQL: All projects, bridges, parts, positions, snapshots deleted
- SQLite: User deleted, all their data remains as orphaned records
- **Result**: Referential integrity violation

**Scenario 2: Bridge Deletion** (legacy)
- PostgreSQL: All positions and snapshots deleted
- SQLite: Positions and snapshots remain but bridge_id now invalid
- **Result**: Foreign key violation, orphaned records

**Scenario 3: Snapshot Hierarchy** (nested snapshots)
- PostgreSQL: parent_snapshot_id set to NULL when parent deleted
- SQLite: parent_snapshot_id remains pointing to deleted snapshot
- **Result**: Broken hierarchy reference

### 4.2 Orphaned Records Risk Assessment

**Current Risk Level**: HIGH (SQLite) → CRITICAL after migration to PostgreSQL

**Automatic Cascade Only For**:
- ✅ monolith_projects → parts (both)

**NO Cascade For** (SQLite only):
- ❌ users → monolith_projects
- ❌ users → bridges
- ❌ bridges → positions
- ❌ bridges → snapshots
- ❌ snapshots → snapshots (self-reference)

### 4.3 Foreign Key Relationship Issues

#### Issue #11: Architectural Flaw - Mixed Data Models

**The Core Problem**:

The `positions` table still references the legacy `bridges` table:

```sql
-- positions table references bridges (legacy)
bridge_id VARCHAR(255) NOT NULL REFERENCES bridges(bridge_id) ON DELETE CASCADE

-- parts table references monolith_projects (new)
project_id VARCHAR(255) NOT NULL REFERENCES monolith_projects(project_id) ON DELETE CASCADE
```

**Result**: Impossible to directly query positions for a monolith_project without bridge intermediary.

**Current "Solution"** (parts.js line 83):
```javascript
LEFT JOIN positions pos ON p.part_name = pos.part_name AND p.project_id = pos.bridge_id
```

This assumes `project_id` values match `bridge_id` values - a fragile assumption.

---

## 5. SUMMARY OF FINDINGS

### Critical Issues (Must Fix Before Production)

| # | Issue | Severity | Component | Impact |
|---|-------|----------|-----------|--------|
| 1 | SQLite missing CASCADE deletes | CRITICAL | DB Schema | Orphaned records, referential integrity violation |
| 2 | Frontend using legacy /api/bridges | CRITICAL | Frontend + Backend | Phase 1 objectives not met |
| 3 | Boolean type mismatch (INT vs BOOLEAN) | HIGH | DB Schema | Data type inconsistency |
| 4 | Coexisting bridge/monolith_projects tables | HIGH | Architecture | Architectural confusion, mixed models |
| 5 | Wrong parameter names (bridge_id vs project_id) | CRITICAL | API Contract | Form submission fails |
| 6 | Part position join on wrong columns | HIGH | API Logic | Incorrect query results |

### High-Priority Issues

| # | Issue | Severity | Component |
|---|-------|----------|-----------|
| 7 | Insufficient input validation | MEDIUM | API |
| 8 | No TypeScript types for MonolithProject | MEDIUM | Frontend |
| 9 | Part ID generation not collision-proof | MEDIUM | API |
| 10 | SQLite positions → bridges no CASCADE | HIGH | DB Schema |

### Design Issues

- Mixed legacy/new data models create confusion
- monolith_projects and bridges tables not synchronized
- Positions still tied to legacy bridges table

---

## 6. RECOMMENDATIONS

### Immediate Actions (Before Production)

1. **Fix API Contract Mismatch**
   - Update CreateMonolithForm to call /api/monolith-projects
   - Change `bridge_id` → `project_id` parameter
   - Add MonolithProject TypeScript interface

2. **Fix SQLite Foreign Keys**
   - Add ON DELETE CASCADE to all foreign key constraints in SQLite
   - Or implement application-level cascade logic

3. **Fix Parts-Positions Join**
   - Update positions table to reference monolith_projects instead of bridges
   - Or create migration to standardize on monolith_projects

4. **Add Input Validation**
   - Validate numeric field ranges (no negative values)
   - Add length validation for text fields
   - Check for duplicate part names per project

### Short-Term Improvements

5. **Consolidate Data Models**
   - Deprecate legacy bridges table
   - Migrate all bridge data to monolith_projects
   - Update all references from bridges to monolith_projects

6. **Improve Part ID Generation**
   - Use UUID v4 instead of Date.now()
   - Prevents collision in high-concurrency scenarios

7. **Add TypeScript Types**
   - Define MonolithProject interface
   - Define Part, PartTemplate interfaces
   - Update API response types

### Testing Recommendations

- [ ] Test Phase 1: Create project using new /api/monolith-projects
- [ ] Test Phase 1: List projects and verify object_type
- [ ] Test Phase 1: Create part from template
- [ ] Test user deletion cascades properly (PostgreSQL)
- [ ] Test invalid input (negative numbers, oversized strings)
- [ ] Test concurrent part creation (collision detection)

---

## Appendix: File Locations

**Database**:
- `/home/user/Monolit-Planner/backend/src/db/migrations.js` (SQLite)
- `/home/user/Monolit-Planner/backend/src/db/schema-postgres.sql` (PostgreSQL)
- `/home/user/Monolit-Planner/backend/src/db/index.js` (Unified interface)

**Backend API**:
- `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js`
- `/home/user/Monolit-Planner/backend/src/routes/parts.js`
- `/home/user/Monolit-Planner/backend/src/routes/bridges.js` (Legacy)

**Frontend**:
- `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`
- `/home/user/Monolit-Planner/frontend/src/components/ObjectTypeSelector.tsx`
- `/home/user/Monolit-Planner/frontend/src/services/api.ts`
