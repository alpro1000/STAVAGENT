# AUDIT: Monolit Planner — Part A (Main App)

**Scope:** Everything EXCEPT `/planner` (Kalkulátor betonáže)
**Date:** 2026-04-02
**Method:** Static read-only analysis of all Part A source files
**Files analyzed:** 30+ frontend components/hooks, 8 backend routes, shared package, DB schema

---

## 1. Component Map

### Route Structure (`App.tsx`, 76 lines)

```
/                    → AppProvider → MainApp
/planner             → PlannerPage          ← Part B (OUT OF SCOPE)
/registry/:projectId → AppProvider → RegistryView
/project-gantt       → AppProvider → ProjectGantt
/tariffs             → AppProvider → TariffPage
```

**Critical:** Each route wraps its own `<AppProvider>`, so all Context state (selectedBridge, positions, headerKPI) is destroyed on navigation. `/planner` has NO AppProvider at all.

### Component Tree (Part A)

```
MainApp (271L)
├── Header (550L)                    ← GOD COMPONENT
│   ├── CreateMonolithForm (271L)
│   ├── EditBridgeForm (309L)
│   ├── PortalImportModal (253L)
│   └── ExportHistory (95L)
├── Sidebar (773L)                   ← GOD COMPONENT
│   ├── DeleteBridgeModal (94L)
│   ├── DeleteProjectModal (91L)
│   └── RenameProjectModal (106L)
├── PortalBreadcrumb (118L)
├── KPIPanel (199L)
│   └── ErrorBoundary wrapper
├── SnapshotBadge (93L)
├── DaysPerMonthToggle (36L)
└── PositionsTable (735L)
    ├── ErrorBoundary wrapper
    ├── PartHeader (417L)
    │   ├── OtskpAutocomplete (165L)
    │   └── NewPartModal (114L)
    ├── PositionRow (815L)           ← GOD COMPONENT
    │   ├── FormulaDetailsModal (187L)
    │   ├── WorkTypeSelector (270L)
    │   └── CustomWorkModal (141L)
    └── HistoryModal (238L)
```

### Hooks

| Hook | Lines | Purpose |
|------|-------|---------|
| `usePositions.ts` | 104 | React Query positions + mutations, syncs to AppContext |
| `useBridges.ts` | 135 | React Query bridges + 7 mutations |
| `useConfig.ts` | 51 | Server config (daysPerMonth, wage, shift_hours) |
| `useSnapshots.ts` | 48 | Active snapshot for selected bridge |
| `useCreateSnapshot.ts` | 27 | Snapshot creation mutation |
| `useDarkMode.ts` | 23 | Dark mode toggle |
| `useExports.ts` | 39 | Export history query |

### Dead Code (never imported anywhere)

| File | Lines | Notes |
|------|-------|-------|
| `FormworkCalculatorModal.tsx` | 669 | Replaced by `/planner` route |
| `AnalysisPreview.tsx` | 423 | — |
| `BatchCalculatorUI.tsx` | 384 | — |
| `ExportToRegistry.tsx` | 283 | — |
| `SheathingCapturesTable.tsx` | 297 | — |
| `SheathingCaptureRow.tsx` | 275 | — |
| `ImportErrorRecovery.tsx` | 236 | — |
| `DocumentUpload.tsx` | 236 | — |
| **Total** | **3,197** | ~10% of Monolit frontend LOC |

### Backend Routes (Part A relevant)

| File | Lines | Endpoints | Auth |
|------|-------|-----------|------|
| `positions.js` | 527 | GET/POST/PUT/DELETE positions, POST suggest-days | Optional JWT |
| `monolith-projects.js` | 786 | Full project CRUD, bulk delete, status, rename | Optional JWT |
| `import-from-registry.js` | 272 | POST /import (Portal→Monolit) | Optional JWT |
| `export-to-registry.js` | 761 | POST /export-to-registry, portal sync | Optional JWT |
| `snapshots.js` | 354 | CRUD snapshots, restore, compare | Optional JWT |
| `config.js` | 102 | GET/PUT config per bridge | None |
| `upload.js` | 655 | POST /upload (XLSX parse) | Optional JWT |
| `export.js` | 159 | GET /export/xlsx | None |

---

## 2. Data Map

### State Architecture

```
                  ┌─────────────────────┐
                  │   React Query Cache  │  ← Source of truth (server state)
                  │  usePositions query  │
                  │  useBridges query    │
                  └──────────┬──────────┘
                             │ useEffect sync
                             ▼
                  ┌─────────────────────┐
                  │   AppContext (React) │  ← Duplicate state (UI convenience)
                  │  positions[]        │
                  │  selectedBridge     │
                  │  headerKPI          │
                  │  bridges[]          │
                  │  daysPerMonth       │
                  │  showOnlyRFI        │
                  │  activeSnapshot     │
                  └─────────────────────┘
```

**Problem:** Dual state means React Query and Context can diverge. `usePositions.ts` syncs via `useEffect`, but there's a render cycle where Context still holds stale data.

### Database Tables (Part A relevant)

```sql
monolith_projects    -- Source of truth for projects
  project_id (PK), object_name, project_name, portal_user_id, portal_project_id, ...

bridges              -- FK compatibility layer (mirrors monolith_projects)
  bridge_id (PK = monolith_projects.project_id), object_name, project_name

positions            -- Work items
  position_id (PK), bridge_id (FK→bridges), part_name, subtype, qty, crew_size, ...
  portal_position_id, position_instance_id

snapshots            -- Named save points
  snapshot_id (PK), bridge_id (FK→bridges), name, data (JSON)

config               -- Per-bridge settings
  config_id (PK), bridge_id, key, value

export_history       -- XLSX export log
  export_id (PK), bridge_id, filename, exported_at
```

### API Data Flow

```
Frontend (React)
  │
  ├─ GET  /api/monolith-projects              → list projects (filtered by portal_user_id)
  ├─ GET  /api/positions?bridge_id=X          → positions for selected bridge
  ├─ POST /api/positions                      → create position (auto-creates bridge if missing)
  ├─ PUT  /api/positions/:id                  → update position fields
  ├─ DELETE /api/positions/:id                → delete position
  │
  ├─ POST /api/upload                         → parse XLSX → insert positions
  ├─ POST /api/import                         → Portal→Monolit import
  ├─ POST /api/export-to-registry             → Monolit→Portal export (TOV sync)
  │
  ├─ GET  /api/config?bridge_id=X             → wage, shift_hours, daysPerMonth
  ├─ PUT  /api/config                         → update config
  │
  └─ CRUD /api/snapshots                      → snapshot management
```

### Shared Package (`@stavagent/monolit-shared`)

Used by Part A:
- `calculatePositionFields(pos, config)` — computes labor_hours, cost_czk, unit_cost_on_m3, kros_unit_czk, kros_total_czk
- `calculateHeaderKPI(positions, config)` — aggregates per-part and overall KPIs
- `Position`, `HeaderKPI`, `Bridge`, `Subtype`, `Unit` — TypeScript interfaces

---

## 3. Found Problems

### P1 — Critical

| # | File:Line | Problem | Impact |
|---|-----------|---------|--------|
| 1 | `monolith-projects.js:680` | `GET /debug/database` endpoint with **NO authentication** — returns all monolith_projects, bridges, positions, config rows | **Security:** Full database dump accessible to anyone |
| 2 | `useConfig.ts:29-31` | `setDaysPerMonth(data.value === '30' ? 30 : 22)` called **during render** (inside React Query `onSuccess` which fires during render in v5) | **Bug:** React strict mode warning; potential infinite re-render loop |
| 3 | `App.tsx:36-61` | Each route creates a **separate `<AppProvider>`** instance — Context state destroyed on every route navigation | **UX:** Selected bridge, positions, KPI all lost when navigating to `/registry/:id`, `/project-gantt`, `/tariffs` and back |

### P2 — Significant

| # | File:Line | Problem | Impact |
|---|-----------|---------|--------|
| 4 | `useSnapshots.ts:41` | useEffect deps `[bridgeId, setActiveSnapshot]` missing `refetchActiveSnapshot` | **Bug:** Stale snapshot data after bridge change until manual refetch |
| 5 | `MainApp.tsx:109` | `bridges` in useEffect dependency array — `bridges` is a new array ref on every React Query refetch, causing useEffect to re-run unnecessarily | **Perf:** Excessive re-renders and potential flickering |
| 6 | `positions.js:POST` | FK auto-heal creates `bridges` row on GET if missing, but original project creation in `monolith-projects.js:154-164` has try-catch that **swallows** bridge creation errors silently | **Data:** Silent failures in project creation; auto-heal masks the root cause |
| 7 | `Header.tsx` (550L), `Sidebar.tsx` (773L), `PositionRow.tsx` (815L) | **God components** with 13-15+ useState hooks each, mixed concerns (UI + data + modals + events) | **Maintainability:** Hard to test, debug, or modify without regressions |
| 8 | 8 files, 3,197 lines | **Dead code** — never imported, never rendered | **Maintenance:** Confusion, false grep hits, bloated bundle (if not tree-shaken) |

### P3 — Minor

| # | File:Line | Problem | Impact |
|---|-----------|---------|--------|
| 9 | `Header.tsx:492-547` | Inline `<style>` tag in component JSX — styles re-injected on every render | **Perf:** Minor; should be in CSS file |
| 10 | `config.js` routes | No authentication at all on `GET /api/config` and `PUT /api/config` | **Security:** Anyone can read/write per-bridge config (wage, shift hours) |
| 11 | `export.js` routes | No authentication on `GET /api/export/xlsx` | **Security:** Anyone can export any bridge's data as XLSX |
| 12 | `positions.js:GET` | `SELECT * FROM positions` with only `bridge_id` filter — no pagination, no limit | **Perf:** Could be slow for bridges with hundreds of positions (unlikely but unbounded) |
| 13 | `Sidebar.tsx` | Resize handle via `mousemove`/`mouseup` on `document` — no throttle/debounce | **Perf:** High-frequency DOM updates during resize |
| 14 | Multiple backend routes | `portal_user_id` auth is optional (`optionalAuthMiddleware`) — without JWT, all data is accessible | **Security:** Account isolation depends entirely on frontend sending the token |

---

## 4. Boundary with Kalkulátor betonáže (Part B)

### Navigation: Part A → Part B

**File:** `PositionsTable.tsx:559-582`

```
Part A stores scroll position in sessionStorage('monolit-planner-return-part')
   ↓
navigate(`/planner?bridgeId=${bridgeId}&partName=${partName}&objectName=${objectName}`)
   ↓
Part B (PlannerPage) reads URL params, fetches its own data
```

### Navigation: Part B → Part A

```
Part B renders a simple <a href="/"> link back
   ↓
Part A reads sessionStorage, scrolls to saved part, highlights for 3s
```

### Shared Resources

| Resource | Used by Part A | Used by Part B |
|----------|---------------|----------------|
| `@stavagent/monolit-shared` formulas | `calculatePositionFields`, `calculateHeaderKPI` | All 16 calculators, `scheduleElement()` |
| `positions` table | CRUD via React Query | Read-only via own API calls |
| `config` table | wage, shift_hours, daysPerMonth | Same config values |
| `bridges` table | FK target | FK target (same bridge_id) |
| Backend `/api/positions` | Primary consumer | Reads for element planning |
| CSS | `index.css` (Part A styles) | `planner.css` (own styles) |
| AppContext | Yes (per-route instance) | **No** — PlannerPage has no AppProvider |

### Isolation Assessment

Part B is **well isolated** from Part A:
- Own route (`/planner`) with own page component
- Own CSS file
- No shared React state (no AppContext)
- Communicates only via URL params and shared DB tables
- Can be developed/tested independently

**Risk:** The shared `@stavagent/monolit-shared` package is the only tight coupling. Changes to formula signatures or Position type affect both parts.

---

## 5. Recommendations

### Option A — Minimal (Fix Critical Bugs Only)

**Effort:** ~2-4 hours | **Risk:** Low

1. **Remove or protect** `GET /debug/database` endpoint (`monolith-projects.js:680`)
2. **Fix** `useConfig.ts:29-31` — move `setDaysPerMonth` into a `useEffect`
3. **Fix** `useSnapshots.ts:41` — add `refetchActiveSnapshot` to deps
4. **Add auth** to `config.js` and `export.js` routes (use existing `optionalAuthMiddleware`)
5. **Delete 8 dead code files** (3,197 lines) — zero risk, they are never imported

**Outcome:** Fixes security holes and React bugs. No architectural change.

### Option B — Moderate (A + Structural Improvements)

**Effort:** ~2-3 days | **Risk:** Medium

Everything in Option A, plus:

6. **Lift AppProvider** to `App.tsx` root level (wrap `<Routes>`, not each route) — fixes state loss on navigation
7. **Remove dual state** — eliminate AppContext sync from `usePositions`/`useBridges`; components read directly from React Query hooks
8. **Split God components:**
   - `Header.tsx` → `BridgeSelector`, `HeaderActions`, `ImportExportMenu`
   - `Sidebar.tsx` → `ProjectList`, `ProjectListItem`, `ResizablePanel`
   - `PositionRow.tsx` → `PositionRow` (display) + `PositionEditor` (inline edit) + `SuggestionTooltip`
9. **Fix bridge creation** in `monolith-projects.js:154-164` — don't swallow errors; make bridge creation part of the same transaction

**Outcome:** Cleaner architecture, fewer bugs from state divergence, testable components.

### Option C — Major (B + Full Modernization)

**Effort:** ~1-2 weeks | **Risk:** High

Everything in Options A and B, plus:

10. **Replace AppContext with Zustand** — single store, no dual state, persistence to sessionStorage
11. **Add pagination** to positions API (`?page=1&limit=50`)
12. **Add integration tests** — currently 0 frontend tests for Part A
13. **Enforce auth** — make `authMiddleware` required (not optional) on all mutating endpoints
14. **Move inline styles** from Header.tsx to CSS module
15. **Add E2E tests** for critical flows: create project → add positions → export → snapshot → restore

**Outcome:** Production-grade reliability. Significant effort but addresses all found issues.

### Recommendation

**Start with Option A immediately** (critical security + bugs), then proceed to **Option B** items 6-7 (state management) as the highest-value architectural improvement. Option C items can be tackled incrementally.

The single most impactful change after fixing bugs is **item 6+7**: lifting AppProvider and removing dual state. This eliminates an entire class of state-sync bugs and simplifies every component that currently reads from both React Query and Context.

---

*Generated by static analysis. No code was modified during this audit.*
