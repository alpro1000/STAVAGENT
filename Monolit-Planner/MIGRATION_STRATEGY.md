# Migration Strategy: Legacy → R0

**Цель:** Плавный переход от текущей системы к R0 Architecture без потери данных.

---

## 📊 Mapping: Legacy → R0

### 1. Projects

**Legacy:**
```sql
bridges (
  bridge_id,        -- "SO 11-20-01"
  project_name,     -- "Most přes Biokoridor"
  object_name,      -- "ZÁKLADY ZE ŽELEZOBETONU"
  concrete_m3,
  sum_kros_czk,
  ...
)
```

**R0:**
```sql
r0_projects (
  id,               -- UUID нового типа
  name,             -- = bridges.project_name
  shift_hours,
  time_utilization_k,
  ...
)

elements (
  id,
  project_id,       -- FK → r0_projects.id
  type,             -- "slab" / "wall" / "beam"
  name,             -- = bridges.object_name
  concrete_volume_m3, -- = bridges.concrete_m3
  formwork_area_m2,
  rebar_mass_t,
  ...
)
```

**Migration path:**
```
1 bridge → 1 r0_project + 1 element
```

---

### 2. Positions → Captures + Tasks

**Legacy:**
```sql
positions (
  id,
  bridge_id,
  part_name,        -- "ZÁKLADY", "ŘÍMSY"
  subtype,          -- "beton", "bednění", "výztuž"
  qty,
  unit,
  days,
  cost_czk,
  ...
)
```

**R0:**
```sql
captures (
  id,
  element_id,       -- FK → elements.id
  sequence_index,   -- 1, 2, 3... (по part_name)
  volume_m3,        -- = sum(positions.qty where subtype='beton')
  area_m2,          -- = sum(positions.qty where subtype='bednění')
  mass_t,           -- = sum(positions.qty where subtype='výztuž')
  ...
)

tasks (
  id,
  capture_id,       -- FK → captures.id
  type,             -- "rebar" / "formwork_in" / "pour" / ...
  duration_hours,   -- CALCULATED by deterministic engine
  labor_hours,
  cost_labor,
  ...
)
```

**Migration path:**
```
positions grouped by part_name
  → 1 capture per part
    → 6 tasks per capture (rebar, formwork_in, pour, wait, formwork_out, move_clean)
```

---

## 🔄 Migration Script (SQL)

### Step 1: Create R0 project from bridge

```sql
-- Migrate single bridge to R0
INSERT INTO r0_projects (
  id,
  name,
  shift_hours,
  time_utilization_k,
  days_per_month,
  wage_rebar_czk_h,
  wage_formwork_czk_h,
  wage_concreting_czk_h,
  status,
  owner_id
)
SELECT
  'r0_' || bridge_id,                    -- New UUID with prefix
  project_name,
  10.0,                                  -- Default shift_hours
  0.80,                                  -- Default k
  30,                                    -- Default days_per_month
  398.0,                                 -- Default wage
  398.0,
  398.0,
  status,
  owner_id
FROM bridges
WHERE bridge_id = 'SO 11-20-01';         -- Migrate one bridge at a time
```

### Step 2: Create element from bridge quantities

```sql
-- Create element (one per bridge for now)
INSERT INTO elements (
  id,
  project_id,
  type,
  name,
  concrete_volume_m3,
  formwork_area_m2,
  rebar_mass_t,
  source_tag,
  confidence
)
SELECT
  'elem_' || b.bridge_id,
  'r0_' || b.bridge_id,                  -- FK to r0_projects
  'custom',                              -- Type (user will refine)
  b.object_name,
  b.concrete_m3,

  -- Calculate formwork area from positions
  (SELECT COALESCE(SUM(qty), 0)
   FROM positions
   WHERE bridge_id = b.bridge_id AND subtype = 'bednění'),

  -- Calculate rebar mass from positions (kg → t)
  (SELECT COALESCE(SUM(qty), 0) / 1000.0
   FROM positions
   WHERE bridge_id = b.bridge_id AND subtype = 'výztuž'),

  'MIGRATED_FROM_LEGACY',
  0.75                                   -- Lower confidence for migrated data
FROM bridges b
WHERE b.bridge_id = 'SO 11-20-01';
```

### Step 3: Create captures from parts

```sql
-- Create one capture per part_name
INSERT INTO captures (
  id,
  element_id,
  sequence_index,
  name,
  volume_m3,
  area_m2,
  mass_t,
  source_tag,
  confidence
)
SELECT
  'capt_' || b.bridge_id || '_' || ROW_NUMBER() OVER (ORDER BY MIN(p.created_at)),
  'elem_' || b.bridge_id,
  ROW_NUMBER() OVER (ORDER BY MIN(p.created_at)),
  p.part_name,

  -- Volume = sum of beton positions
  COALESCE(SUM(CASE WHEN p.subtype = 'beton' THEN p.qty ELSE 0 END), 0),

  -- Area = sum of bednění positions
  COALESCE(SUM(CASE WHEN p.subtype = 'bednění' THEN p.qty ELSE 0 END), 0),

  -- Mass = sum of výztuž positions (kg → t)
  COALESCE(SUM(CASE WHEN p.subtype = 'výztuž' THEN p.qty ELSE 0 END), 0) / 1000.0,

  'MIGRATED_FROM_LEGACY',
  0.75
FROM positions p
JOIN bridges b ON p.bridge_id = b.bridge_id
WHERE b.bridge_id = 'SO 11-20-01'
GROUP BY b.bridge_id, p.part_name;
```

### Step 4: Generate tasks (using calculators)

```sql
-- This step requires backend logic!
-- Cannot be done in pure SQL because we need deterministic calculators

-- Pseudo-code:
FOR EACH capture:
  1. Get default normset (ÚRS 2024)
  2. Calculate rebar task (using calculateRebar)
  3. Calculate formwork_in task
  4. Calculate pour task
  5. Add wait_strip task (72h)
  6. Calculate formwork_out task
  7. Add move_clean task (2h)

  INSERT INTO tasks (...)
```

---

## 🔀 Migration API Endpoint

### `POST /api/r0/migrate-bridge`

Migrate single bridge from legacy to R0.

**Request:**
```json
{
  "bridge_id": "SO 11-20-01",
  "normset_id": "norm_urs_2024"
}
```

**Response:**
```json
{
  "success": true,
  "r0_project_id": "r0_SO_11-20-01",
  "elements_created": 1,
  "captures_created": 5,
  "tasks_created": 30,
  "migration_log": [
    "Created r0_project: Most přes Biokoridor",
    "Created element: ZÁKLADY ZE ŽELEZOBETONU (41.0 m³)",
    "Created 5 captures from parts",
    "Generated 30 tasks using ÚRS 2024 norms",
    "Scheduled 30 tasks (project duration: 27.5 days)"
  ]
}
```

---

## 🚦 Feature Flag Strategy

### Environment Variable

```bash
# .env
FF_R0_PLANNING=true    # Enable R0 Planning Mode
```

### Frontend Toggle

```tsx
// frontend/src/components/Header.tsx

const Header = () => {
  const isR0Enabled = config?.feature_flags?.FF_R0_PLANNING ?? false;
  const [mode, setMode] = useState<'legacy' | 'r0'>('legacy');

  if (!isR0Enabled) {
    // Show only legacy mode
    return <LegacyHeader />;
  }

  return (
    <div className="header">
      <h1>Monolit Planner</h1>

      <ToggleSwitch
        value={mode}
        onChange={setMode}
        options={[
          { value: 'legacy', label: 'Legacy Mode' },
          { value: 'r0', label: 'R0 Planning' }
        ]}
      />
    </div>
  );
};
```

### Route Structure

```
/projects                    ← Legacy mode (existing)
/projects/:id               ← Legacy project detail

/r0/projects                ← R0 mode (new)
/r0/projects/:id            ← R0 project detail
/r0/projects/:id/elements   ← Elements table
/r0/projects/:id/captures   ← Captures & takts
/r0/projects/:id/schedule   ← Gantt chart
/r0/projects/:id/cost       ← Cost breakdown
```

---

## 📊 Database Coexistence

### Same Database, Different Tables

```
monolith_planner.db (SQLite) or PostgreSQL
├── Legacy tables
│   ├── bridges
│   ├── positions
│   ├── parts
│   └── monolith_projects
│
└── R0 tables
    ├── r0_projects
    ├── elements
    ├── normsets
    ├── captures
    ├── tasks
    ├── schedule
    ├── cost_breakdown
    └── bottlenecks
```

**No conflicts!** - Different table names, can coexist.

---

## 🔄 User Migration Flow

### Phase 1: Both modes available (1-2 months)

Users can:
- Continue using Legacy Mode (no changes)
- Try R0 Planning Mode (new features)
- Migrate projects one by one

### Phase 2: Encourage migration (2-3 months)

Show banner in Legacy Mode:
```
⚠️ Legacy Mode will be deprecated. Migrate to R0 Planning for:
- Deterministic calculations
- Resource scheduling
- Cost traceability
- Bottleneck detection

[Migrate My Projects] [Learn More]
```

### Phase 3: Deprecate Legacy (3+ months)

- Legacy Mode becomes read-only
- New projects can only be created in R0
- Old projects still accessible for reference

---

## 🎯 Recommendation

**Use Variant A: R0 as new tab in Monolit-Planner**

**Pros:**
- ✅ One codebase, one deployment
- ✅ Smooth transition for users
- ✅ Can migrate projects gradually
- ✅ Shared UI components (Header, Sidebar)

**Implementation:**
1. Week 1: Add R0 tables to existing DB (Migration 006)
2. Week 2: Create `/r0/*` routes + basic UI
3. Week 3: Implement migration endpoint
4. Week 4: User testing + feedback
5. Week 5+: Gradual rollout with feature flag

---

## 📋 Checklist

- [ ] Run Migration 006 (add R0 tables)
- [ ] Add `FF_R0_PLANNING` feature flag
- [ ] Create `/r0/*` routes
- [ ] Implement R0 UI (Elements, Captures, Tasks)
- [ ] Create migration API endpoint
- [ ] Test migration with 1-2 bridges
- [ ] User documentation
- [ ] Gradual rollout

---

**Status:** 📝 Planning Phase
**Next Step:** Decision - Variant A (tab) or Variant B (separate kiosk)?
