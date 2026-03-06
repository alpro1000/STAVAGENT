# NEXT SESSION - PERT/Maturity + Backend Sync Complete

**Date:** 2026-03-06
**Branch:** `claude/fix-projectcard-types-cZHyb`
**Status:** PERT/Maturity modules + Backend sync layer complete

---

## What Was Done This Session (2026-03-06)

### 8 commits across 3 sessions, 15+ files changed

#### 1. PERT 3-Point Estimation Module (Monolit shared)
- `shared/src/calculators/pert.ts` — PERT formula, Monte Carlo simulation (Mulberry32 PRNG), P50/P80/P90/P95
- `shared/src/calculators/pert.test.ts` — 20 tests
- Integrated into `element-scheduler.ts` (optional `pert_params`)

#### 2. Concrete Maturity/Curing Module (Monolit shared)
- `shared/src/calculators/maturity.ts` — ČSN EN 13670, Nurse-Saul maturity index, 6 concrete classes, 3 cement types
- `shared/src/calculators/maturity.test.ts` — 21 tests
- Integrated into `element-scheduler.ts` (optional `maturity_params`, auto-calculates `effective_curing_days`)
- `shared/src/calculators/formwork.ts` — added `calculateFullCycleRentalDays()`

#### 3. Maturity UI Panel (Monolit frontend)
- `frontend/src/components/MaturityConfigPanel.tsx` — concrete class selector, Czech month picker (auto-temp), cement/element type, curing display
- Integrated into `FormworkCalculatorModal.tsx` — shows "Zrání: X dní" + PERT range

#### 4. Registry Backend Sync Layer
- `rozpocet-registry/src/services/backendSync.ts` — localStorage ↔ PostgreSQL mirror
  - `loadFromBackend()` — startup: loads projects from DB, merges with local
  - `pushProjectToBackend()` — full sync: project + sheets + items (bulk upsert)
  - `debouncedPushToBackend()` — 5s debounce on project changes
- `rozpocet-registry/src/services/registryAPI.ts` — fixed `isBackendAvailable()` for old+new health formats; `bulkCreateItems()` now uses bulk endpoint
- Wired into `App.tsx` — startup load + change listener
- Removed dead `registryStoreAPI.ts` (replaced by backendSync.ts)

#### 5. Registry Backend — Bulk Items Endpoint
- `rozpocet-registry-backend/server.js` — `POST /api/registry/sheets/:id/items/bulk` with `ON CONFLICT` upsert

#### 6. Portal Cleanup
- Removed unused `ProjectCard` import from `PortalPage.tsx`

---

## Data Flow (Current)

```
Registry (browser)
  ├─ IndexedDB/localStorage (primary, fast, offline)    ← Zustand
  ├─ PostgreSQL backend (mirror, 5s debounced push)     ← backendSync.ts
  └─ Portal auto-sync (3s debounce)                     ← portalAutoSync.ts
      └─ Projects appear in Portal UI ✅
```

---

## Priority Tasks

### 1. Deploy Registry Backend (NEW code)
- `rozpocet-registry-backend/server.js` was rewritten with graceful DB startup
- The deployed version on Render is still OLD code
- Need: Render Dashboard → Manual Deploy or auto-deploy on push
- Need: Set `DATABASE_URL` env var on Render if not done

### 2. Monolit Position Write-back
- Monolit → POST `/api/positions/:instanceId/monolith`
- Portal API exists (13 endpoints), kiosk integration pending

### 3. Deep Links + URL Routing
- `?project_id=X&position_instance_id=Y` for cross-kiosk navigation

### 4. Deploy Portal Backend
- Phase 8 DB migration (position_instance_id columns)
- 13 new `/api/positions/` endpoints

### 5. Set Environment Variables (Render)
- `PERPLEXITY_API_KEY`, `OPENAI_API_KEY` for concrete-agent
- Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB

---

## Quick Start Commands

```bash
# Start development (any service)
cd Monolit-Planner/shared && npm test           # 145 tests (formulas + PERT + maturity + scheduler)
cd Monolit-Planner/backend && npm run dev       # Backend :3001
cd Monolit-Planner/frontend && npm run dev      # Frontend :5173

cd rozpocet-registry && npm run dev             # Registry :5173
cd rozpocet-registry && npm run build           # Verify TS + Vite build

cd stavagent-portal/frontend && npx tsc --noEmit  # Portal TS check

cd rozpocet-registry-backend && node server.js  # Registry backend :3002
```

---

## Testing Status

| Component | Tests | Status |
|-----------|-------|--------|
| Monolit formulas | 55 | ✅ Pass |
| RCPSP scheduler | 27 | ✅ Pass |
| PERT estimation | 20 | ✅ Pass |
| Concrete maturity | 21 | ✅ Pass |
| Pour decision | 22 | ✅ Pass |
| URS Matcher | 159 | ✅ Pass |
| **Total** | **304+** | **✅ Pass** |

---

## Production URLs

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent.onrender.com |
| stavagent-portal (Frontend) | https://www.stavagent.cz |
| stavagent-portal (API) | https://stavagent-backend.vercel.app |
| Monolit Frontend | https://monolit-planner-frontend.vercel.app |
| Monolit API | https://monolit-planner-api.onrender.com |
| URS Matcher | https://urs-matcher-service.onrender.com |
| Rozpočet Registry | https://stavagent-backend-ktwx.vercel.app |
| Registry Backend | https://rozpocet-registry-backend.onrender.com |

---

**Version:** 2.1.1
**Last Updated:** 2026-03-06
