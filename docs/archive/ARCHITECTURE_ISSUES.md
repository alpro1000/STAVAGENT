# Phase 1 Architecture Issues - Visual Analysis

## Current Architecture (BROKEN)

```
FRONTEND
  |
  ├─ CreateMonolithForm.tsx
  |     └─ Calls: createBridge() ❌ WRONG ENDPOINT
  |           └─ /api/bridges (LEGACY)
  |
  └─ ObjectTypeSelector.tsx
        └─ Selects object_type (bridge, building, etc.)


BACKEND - TWO CONFLICTING DATA MODELS
  |
  ├─ LEGACY MODEL (Still Used)
  |  │
  |  ├─ /api/bridges
  |  │   └─ Creates: bridges table ✓
  |  │
  |  └─ positions table
  |      └─ References: bridges(bridge_id) ✓
  |
  └─ NEW MODEL (Unused by Frontend)
     │
     ├─ /api/monolith-projects ❌ NOT CALLED
     │   └─ Creates: monolith_projects table (EMPTY)
     │
     ├─ /api/parts ❌ BROKEN QUERY
     │   └─ References: monolith_projects(project_id)
     │       └─ Joins: positions.bridge_id ❌ WRONG TABLE
     │
     └─ /api/parts/templates
         └─ References: part_templates table


DATABASE - SPLIT REFERENCES (MAJOR FLAW)
  
  monolith_projects        <--  parts (NEW MODEL)
      (EMPTY!)
  
  bridges                  <--  positions (LEGACY)
      (POPULATED)              (LARGE DATA SET)
      |
      ├─ snapshots
      └─ (user relationship)


CONSEQUENCE:
  
  ┌─────────────────────────────────────┐
  │ DISCONNECTED DATA MODELS            │
  │                                     │
  │ ├─ monolith_projects table: EMPTY  │
  │ ├─ parts table: EMPTY              │
  │ ├─ part_templates table: HAS DATA  │
  │                                     │
  │ ├─ bridges table: POPULATED        │
  │ ├─ positions table: POPULATED      │
  │ └─ Legacy queries still work       │
  │                                     │
  │ PHASE 1 NEVER ACTIVATES            │
  └─────────────────────────────────────┘
```

---

## Issue #1: API Contract Mismatch

### Current Flow (BROKEN)

```typescript
// frontend/src/components/CreateMonolithForm.tsx (line 50)
await createBridge({
  bridge_id: projectId,        // ❌ Wrong parameter name
  object_type: objectType,
  project_name: projectName,
  object_name: objectName,
  span_length_m: spanLength,
  // ...
});
```

### Where it goes...

```javascript
// frontend/src/services/api.ts (line 311)
export const createBridge = bridgesAPI.create;

// api.ts (lines 94-96)
create: async (params) => {
  await api.post('/api/bridges', params);  // ❌ LEGACY ENDPOINT
}
```

### Backend receives...

```javascript
// backend/src/routes/bridges.js (line 88-115)
router.post('/', async (req, res) => {
  const { bridge_id, project_name, object_name, ... } = req.body;
  
  // INSERT INTO bridges (legacy table)
  // NOT INTO monolith_projects (new table)
});
```

### Expected but never used...

```javascript
// backend/src/routes/monolith-projects.js (line 79-164)
router.post('/', async (req, res) => {
  const { project_id, object_type, ... } = req.body;  // ❌ Expects project_id
  
  // INSERT INTO monolith_projects (new table)
  // NEVER CALLED BY FRONTEND
});
```

---

## Issue #2: Database Schema Mismatch (SQLite vs PostgreSQL)

### Boolean Type Issue

```
┌─────────────────────────────────────┐
│ part_templates.is_default           │
├─────────────────────────────────────┤
│ SQLite:      INTEGER DEFAULT 1 (0/1)│
│ PostgreSQL:  BOOLEAN DEFAULT TRUE   │
├─────────────────────────────────────┤
│ IMPACT: Migration bug                │
│ Test in SQLite: is_default = 1      │
│ Query in PG: is_default = TRUE      │
│ Result: Type mismatch!              │
└─────────────────────────────────────┘
```

### CASCADE Delete Issue

```
┌──────────────────────────────────────┐
│ users → monolith_projects            │
├──────────────────────────────────────┤
│ SQLite:      NO CASCADE              │
│              ↓                        │
│ DELETE users: projects remain        │
│ (orphaned, invalid foreign key)      │
│                                      │
│ PostgreSQL:  ON DELETE CASCADE       │
│              ↓                        │
│ DELETE users: projects deleted too   │
│ (correct cascading)                  │
├──────────────────────────────────────┤
│ RESULT: Different behavior!          │
│ Data integrity violation in SQLite   │
└──────────────────────────────────────┘
```

---

## Issue #3: Mixed Data Models in Queries

### The Broken Join (parts.js line 83)

```javascript
LEFT JOIN positions pos ON 
  p.part_name = pos.part_name AND 
  p.project_id = pos.bridge_id     // ❌ JOINS DIFFERENT TABLES!
```

```
parts table                  positions table
───────────────              ───────────────
project_id (ref:            bridge_id (ref: bridges table)
 monolith_projects table)    

        ↓
   TRYING TO JOIN
   Different ID Spaces!
```

### Why This Breaks

```
Scenario: Create project "proj001"

Step 1: Form submits object_type=bridge
Step 2: createBridge() called (wrong endpoint)
Step 3: Inserts into bridges with bridge_id="proj001"
Step 4: No entry in monolith_projects table

Step 5: User adds parts
Step 6: part_id, project_id="proj001" inserted
Step 7: Query: /api/parts/list/proj001

Step 8: JOIN fails because:
        - p.project_id = "proj001" (monolith_projects reference)
        - pos.bridge_id = doesn't exist (positions has no rows!)
        
Result: positions_count = 0 (always wrong!)
```

---

## Issue #4: Orphaned Records in SQLite

### User Deletion Cascade

```
PostgreSQL (Correct):
  DELETE users WHERE id=5
    ↓
  ON DELETE CASCADE triggers:
    DELETE monolith_projects WHERE owner_id=5
    DELETE bridges WHERE owner_id=5
    DELETE parts WHERE project_id IN (...)
    DELETE positions WHERE bridge_id IN (...)
    DELETE snapshots WHERE bridge_id IN (...)
  Result: Clean deletion

SQLite (Broken):
  DELETE users WHERE id=5
    ↓
  Foreign keys NOT enforced by default!
    ↓
  NO cascading
    ↓
  Result: 
    - User deleted
    - monolith_projects remain (orphaned)
    - bridges remain (orphaned)
    - parts remain (orphaned)
    - positions remain (orphaned)
    - Referential integrity broken!
```

---

## Issue #5: Part ID Generation Collision Risk

### Current Approach (Problematic)

```javascript
// parts.js line 120
const partId = `${project_id}_${part_name}_${Date.now()}`;

Example: "proj001_ZÁKLADY_1731456789123"
         ^       ^        ^
         |       |        └─ Millisecond timestamp
         |       └── Part name
         └── Project ID

PROBLEM:
If two requests arrive simultaneously:
  Request 1: Date.now() = 1731456789123
  Request 2: Date.now() = 1731456789123 (same millisecond!)
  
Result: Both generate same ID, collision occurs!
```

### Recommended Approach

```javascript
import { v4 as uuidv4 } from 'uuid';

const partId = `${project_id}_${part_name}_${uuidv4()}`;

Example: "proj001_ZÁKLADY_550e8400-e29b-41d4-a716-446655440000"

BENEFIT:
- Cryptographically random
- Collision probability: 1 in 5.3 x 10^36
- No race conditions
```

---

## Summary: Data Flow Issues

### PHASE 1 Intent (What should happen)

```
1. User creates new project via CreateMonolithForm
2. Form selects object_type (bridge/building/parking/road)
3. API creates entry in monolith_projects table
4. Part templates auto-create default parts
5. User can add positions to parts
6. Positions now use monolith_projects as reference
7. New universal data model active
```

### PHASE 1 Reality (What actually happens)

```
1. User creates new project via CreateMonolithForm
2. Form selects object_type (ignored!)
3. API creates entry in LEGACY bridges table (wrong!)
4. monolith_projects table REMAINS EMPTY
5. Part templates are never used
6. Positions still reference bridges table
7. Legacy model continues unchanged
8. Phase 1 objectives NOT achieved
```

---

## Files Requiring Changes (Priority)

### CRITICAL (Must fix immediately)

| File | Change | Reason |
|------|--------|--------|
| frontend/src/components/CreateMonolithForm.tsx | Use /api/monolith-projects, send project_id | API contract fix |
| frontend/src/services/api.ts | Add monolithProjectsAPI, export new function | API contract fix |
| backend/src/db/migrations.js | Add ON DELETE CASCADE to SQLite | Data integrity |
| backend/src/db/schema-postgres.sql | Verify CASCADE settings | Data integrity |

### HIGH (Critical for functionality)

| File | Change | Reason |
|------|--------|--------|
| backend/src/routes/parts.js | Fix positions join query | Query logic error |
| frontend/src/services/api.ts | Add MonolithProject TypeScript interface | Type safety |

### MEDIUM (Important for robustness)

| File | Change | Reason |
|------|--------|--------|
| backend/src/routes/monolith-projects.js | Add input validation | Security/UX |
| backend/src/routes/parts.js | Replace Date.now() with UUID | Collision prevention |
| backend/src/routes/parts.js | Add duplicate check | Data quality |

---

## Testing Matrix

```
Test Case                          SQLite    PostgreSQL   Status
──────────────────────────────────────────────────────────────
Create monolith_project            ❌        ❌           NOT WORKING
List monolith_projects             ❌        ❌           NOT WORKING
Get monolith_project details       ❌        ❌           NOT WORKING
Create part from template          ❌        ❌           NOT WORKING
Create custom part                 ❌        ❌           NOT WORKING
Delete user cascades projects      ❌        ✓            INCONSISTENT
Delete bridge cascades positions   ❌        ✓            INCONSISTENT
Query positions for project        ❌        ❌           BROKEN JOIN
Concurrent part creation           ❌        ❌           COLLISION RISK
```

