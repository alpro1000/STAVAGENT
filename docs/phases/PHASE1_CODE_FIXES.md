# Phase 1 - Code Fixes Reference

## Quick Links to Issues

All issues with exact line numbers and suggested fixes.

---

## CRITICAL FIX #1: API Contract Mismatch

### Problem Location
**File**: `frontend/src/components/CreateMonolithForm.tsx`
**Lines**: 50-62

**Current Code** (BROKEN):
```typescript
await createBridge({
  bridge_id: projectId.trim(),  // ❌ Wrong parameter
  object_type: objectType,
  project_name: projectName.trim() || undefined,
  object_name: objectName.trim() || projectId.trim(),
  span_length_m: spanLength ? parseFloat(spanLength) : undefined,
  deck_width_m: deckWidth ? parseFloat(deckWidth) : undefined,
  pd_weeks: pdWeeks ? parseFloat(pdWeeks) : undefined,
  building_area_m2: buildingArea ? parseFloat(buildingArea) : undefined,
  building_floors: buildingFloors ? parseInt(buildingFloors) : undefined,
  road_length_km: roadLength ? parseFloat(roadLength) : undefined,
  road_width_m: roadWidth ? parseFloat(roadWidth) : undefined,
});
```

**Issue**: Calls wrong API endpoint (/api/bridges) instead of /api/monolith-projects

**Required Changes**:
1. Change import: `import { createMonolithProject } from '../services/api';`
2. Replace `createBridge()` call with `createMonolithProject()`
3. Change `bridge_id` parameter to `project_id`
4. Update parameter names to match monolith-projects API

**Corrected Code**:
```typescript
await createMonolithProject({
  project_id: projectId.trim(),  // ✅ Correct parameter
  object_type: objectType,
  project_name: projectName.trim() || undefined,
  object_name: objectName.trim() || projectId.trim(),
  span_length_m: spanLength ? parseFloat(spanLength) : undefined,
  deck_width_m: deckWidth ? parseFloat(deckWidth) : undefined,
  pd_weeks: pdWeeks ? parseFloat(pdWeeks) : undefined,
  building_area_m2: buildingArea ? parseFloat(buildingArea) : undefined,
  building_floors: buildingFloors ? parseInt(buildingFloors) : undefined,
  road_length_km: roadLength ? parseFloat(roadLength) : undefined,
  road_width_m: roadWidth ? parseFloat(roadWidth) : undefined,
});
```

---

## CRITICAL FIX #2: Add Missing API Function

### Problem Location
**File**: `frontend/src/services/api.ts`
**Lines**: After line 114 (after bridgesAPI)

**Current Code** (MISSING):
```typescript
// No monolithProjectsAPI defined!
```

**Required Addition**:
```typescript
// MonolithProjects
export const monolithProjectsAPI = {
  getAll: async (type?: string, status?: string): Promise<MonolithProject[]> => {
    const params: any = {};
    if (type) params.type = type;
    if (status) params.status = status;
    
    const { data } = await api.get('/api/monolith-projects', { params });
    return data;
  },

  getOne: async (projectId: string): Promise<MonolithProject> => {
    const { data } = await api.get(`/api/monolith-projects/${projectId}`);
    return data;
  },

  create: async (params: {
    project_id: string;
    object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom';
    project_name?: string;
    object_name?: string;
    description?: string;
    span_length_m?: number;
    deck_width_m?: number;
    pd_weeks?: number;
    building_area_m2?: number;
    building_floors?: number;
    road_length_km?: number;
    road_width_m?: number;
  }): Promise<MonolithProject> => {
    const { data } = await api.post('/api/monolith-projects', params);
    return data;
  },

  update: async (projectId: string, params: Partial<MonolithProject>): Promise<MonolithProject> => {
    const { data } = await api.put(`/api/monolith-projects/${projectId}`, params);
    return data;
  },

  delete: async (projectId: string): Promise<void> => {
    await api.delete(`/api/monolith-projects/${projectId}`);
  },

  searchByType: async (type: string): Promise<MonolithProject[]> => {
    const { data } = await api.get(`/api/monolith-projects/search/${type}`);
    return data;
  }
};

// Helper export
export const createMonolithProject = monolithProjectsAPI.create;
```

---

## CRITICAL FIX #3: Add TypeScript Interface

### Problem Location
**File**: `frontend/src/services/api.ts`
**Lines**: Top of file (before imports)

**Current Code** (MISSING):
```typescript
// No MonolithProject interface!
```

**Required Addition** (after other imports):
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
  description?: string;
  status: 'active' | 'completed' | 'archived';
  // Type-specific fields
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  building_area_m2?: number;
  building_floors?: number;
  road_length_km?: number;
  road_width_m?: number;
  parts_count?: number;
  parts?: Part[];
  templates?: PartTemplate[];
}

interface Part {
  part_id: string;
  project_id: string;
  part_name: string;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
  positions_count?: number;
}

interface PartTemplate {
  template_id: string;
  object_type: string;
  part_name: string;
  display_order: number;
  is_default: boolean;
  description?: string;
  created_at: string;
}
```

---

## HIGH PRIORITY FIX #4: Fix Parts-Positions Join

### Problem Location
**File**: `backend/src/routes/parts.js`
**Lines**: 73-87

**Current Code** (BROKEN):
```javascript
const parts = await db.prepare(`
  SELECT
    p.part_id,
    p.project_id,
    p.part_name,
    p.is_predefined,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT pos.id) as positions_count
  FROM parts p
  LEFT JOIN positions pos ON p.part_name = pos.part_name AND p.project_id = pos.bridge_id
  WHERE p.project_id = ?
  GROUP BY p.part_id
  ORDER BY p.part_name
`).all(projectId);
```

**Issue**: `p.project_id = pos.bridge_id` joins different table references

**Option A: Quick Fix (Workaround)**
```javascript
const parts = await db.prepare(`
  SELECT
    p.part_id,
    p.project_id,
    p.part_name,
    p.is_predefined,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT pos.id) as positions_count
  FROM parts p
  LEFT JOIN positions pos ON p.part_name = pos.part_name AND pos.bridge_id = ?
  WHERE p.project_id = ?
  GROUP BY p.part_id
  ORDER BY p.part_name
`).all(projectId, projectId);  // Pass projectId twice
```

**Option B: Long-term Fix (Proper)**
- Create migration to add `project_id` to positions table
- Update positions table foreign key to reference monolith_projects
- Deprecate bridge_id references

---

## HIGH PRIORITY FIX #5: SQLite CASCADE Deletes

### Problem Location
**File**: `backend/src/db/migrations.js`
**Lines**: 341-365 (monolith_projects table)

**Current Code** (MISSING CASCADE):
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS monolith_projects (
    project_id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL DEFAULT 'custom',
    project_name TEXT,
    object_name TEXT NOT NULL DEFAULT '',
    owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    element_count INTEGER DEFAULT 0,
    concrete_m3 REAL DEFAULT 0,
    sum_kros_czk REAL DEFAULT 0,
    span_length_m REAL,
    deck_width_m REAL,
    pd_weeks REAL,
    building_area_m2 REAL,
    building_floors INTEGER,
    road_length_km REAL,
    road_width_m REAL,
    description TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (owner_id) REFERENCES users(id)  // ❌ NO CASCADE
  );
`);
```

**Required Fix** (add ON DELETE CASCADE):
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS monolith_projects (
    project_id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL DEFAULT 'custom',
    project_name TEXT,
    object_name TEXT NOT NULL DEFAULT '',
    owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    element_count INTEGER DEFAULT 0,
    concrete_m3 REAL DEFAULT 0,
    sum_kros_czk REAL DEFAULT 0,
    span_length_m REAL,
    deck_width_m REAL,
    pd_weeks REAL,
    building_area_m2 REAL,
    building_floors INTEGER,
    road_length_km REAL,
    road_width_m REAL,
    description TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE  // ✅ ADDED
  );
`);
```

**Also Fix bridges table** (line 164-177):
```javascript
// Current (BROKEN)
db.exec(`
  CREATE TABLE IF NOT EXISTS bridges (
    bridge_id TEXT PRIMARY KEY,
    // ...
    FOREIGN KEY (owner_id) REFERENCES users(id)  // ❌ NO CASCADE (MIGRATION ADDS IT)
  );
`);

// Fixed
db.exec(`
  CREATE TABLE IF NOT EXISTS bridges (
    bridge_id TEXT PRIMARY KEY,
    // ...
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE  // ✅ ADDED
  );
`);
```

**Also Fix snapshots table** (line 198-200):
```javascript
// Current (BROKEN)
FOREIGN KEY (bridge_id) REFERENCES bridges(bridge_id),
FOREIGN KEY (parent_snapshot_id) REFERENCES snapshots(id)

// Fixed
FOREIGN KEY (bridge_id) REFERENCES bridges(bridge_id) ON DELETE CASCADE,
FOREIGN KEY (parent_snapshot_id) REFERENCES snapshots(id) ON DELETE SET NULL
```

---

## MEDIUM PRIORITY FIX #6: Part ID Generation

### Problem Location
**File**: `backend/src/routes/parts.js`
**Lines**: 100-141 (POST /api/parts)

**Current Code** (COLLISION RISK):
```javascript
// Generate part ID
const partId = `${project_id}_${part_name}_${Date.now()}`;
```

**Required Changes**:
1. Add UUID import at top:
```javascript
import { v4 as uuidv4 } from 'uuid';
```

2. Replace ID generation:
```javascript
// Generate part ID
const partId = `${project_id}_${part_name}_${uuidv4()}`;
```

---

## MEDIUM PRIORITY FIX #7: Input Validation

### Problem Location
**File**: `backend/src/routes/monolith-projects.js`
**Lines**: 79-164 (POST route)

**Required Addition** (after existing validation):
```javascript
// Existing validation
if (!project_id || !object_type) {
  return res.status(400).json({ error: 'project_id and object_type are required' });
}

if (!['bridge', 'building', 'parking', 'road', 'custom'].includes(object_type)) {
  return res.status(400).json({ error: 'Invalid object_type' });
}

// ADD NEW VALIDATION:
// Validate numeric ranges
if (span_length_m !== undefined && (span_length_m < 0 || span_length_m > 1000)) {
  return res.status(400).json({ error: 'span_length_m must be between 0 and 1000' });
}

if (deck_width_m !== undefined && (deck_width_m < 0 || deck_width_m > 100)) {
  return res.status(400).json({ error: 'deck_width_m must be between 0 and 100' });
}

if (pd_weeks !== undefined && (pd_weeks < 0 || pd_weeks > 10000)) {
  return res.status(400).json({ error: 'pd_weeks must be between 0 and 10000' });
}

if (building_area_m2 !== undefined && (building_area_m2 < 0 || building_area_m2 > 1000000)) {
  return res.status(400).json({ error: 'building_area_m2 must be between 0 and 1000000' });
}

if (building_floors !== undefined && (!Number.isInteger(building_floors) || building_floors < 0 || building_floors > 200)) {
  return res.status(400).json({ error: 'building_floors must be integer between 0 and 200' });
}

if (road_length_km !== undefined && (road_length_km < 0 || road_length_km > 10000)) {
  return res.status(400).json({ error: 'road_length_km must be between 0 and 10000' });
}

if (road_width_m !== undefined && (road_width_m < 0 || road_width_m > 50)) {
  return res.status(400).json({ error: 'road_width_m must be between 0 and 50' });
}

// Validate string lengths
if (project_name && project_name.length > 255) {
  return res.status(400).json({ error: 'project_name must be 255 characters or less' });
}

if (object_name && object_name.length > 255) {
  return res.status(400).json({ error: 'object_name must be 255 characters or less' });
}

if (description && description.length > 2000) {
  return res.status(400).json({ error: 'description must be 2000 characters or less' });
}
```

---

## MEDIUM PRIORITY FIX #8: Add Part Duplicate Check

### Problem Location
**File**: `backend/src/routes/parts.js`
**Lines**: 100-141 (POST /api/parts)

**Required Addition** (after project verification):
```javascript
// After verifying project ownership (line 112-117)

// Check for duplicate part name within project
const existingPart = await db.prepare(`
  SELECT part_id FROM parts 
  WHERE project_id = ? AND part_name = ?
`).get(project_id, part_name);

if (existingPart) {
  return res.status(409).json({ 
    error: `Part "${part_name}" already exists for this project` 
  });
}
```

---

## Database Schema Fixes

### Fix: Boolean Type in PostgreSQL

**File**: `backend/src/db/schema-postgres.sql`
**Line 136**: `is_default BOOLEAN DEFAULT TRUE` ✅ Already correct
**Line 146**: `is_predefined BOOLEAN DEFAULT FALSE` ✅ Already correct

No changes needed - PostgreSQL schema is correct.

### Fix: Boolean Type in SQLite

**File**: `backend/src/db/migrations.js`
**Lines**: 374, 386

These use INTEGER in SQLite (which is correct for SQLite), but ensure consistency:
- `is_default INTEGER DEFAULT 1` (SQLite) = `BOOLEAN DEFAULT TRUE` (PostgreSQL)
- `is_predefined INTEGER DEFAULT 0` (SQLite) = `BOOLEAN DEFAULT FALSE` (PostgreSQL)

The application code should normalize:
```javascript
// When reading from database
const isDefault = Boolean(dbRow.is_default);
const isPredefined = Boolean(dbRow.is_predefined);

// When writing to database
const isDefaultValue = isDefault ? 1 : 0;
const isPredefinedValue = isPredefined ? 1 : 0;
```

---

## Testing Checklist

After implementing fixes:

- [ ] Create monolith_project with object_type='building' - verify it goes to monolith_projects table
- [ ] List monolith_projects - verify not empty
- [ ] Get monolith_project/:id - verify all fields present
- [ ] Update monolith_project - verify only allowed fields update
- [ ] Delete monolith_project - verify parts cascade deleted
- [ ] Create part from template - verify part_id format
- [ ] Create concurrent parts - verify no collision
- [ ] Query /api/parts/list/:projectId - verify positions_count correct
- [ ] Invalid input: set building_floors=-5 - verify rejected
- [ ] Invalid input: part_name with 50KB string - verify rejected
- [ ] Delete user (PostgreSQL) - verify all cascade deleted
- [ ] Delete bridge (PostgreSQL) - verify positions cascade deleted

