# NEXT SESSION - CI/Build Fixes + Position Write-back Pending

**Date:** 2026-03-04
**Branch:** `claude/monolit-position-writeback-LotnK`
**Status:** CI build fixes applied, write-back integration pending

---

## What Was Done This Session (2026-03-04)

### 2 commits, 2 files changed

#### stavagent-portal — TS build fix
- **Problem:** `PortalPage.tsx:583-584` — TypeScript TS2322 error on Vercel build
  - `ProjectCard` declares `onOpen: () => void` and `onDelete: () => void`
  - `PortalPage` passed `handleOpenProject(project)` and `handleDeleteProject(projectId)` directly — type mismatch
- **Fix:** Wrapped with arrow functions:
  ```tsx
  onOpen={() => handleOpenProject(project)}
  onDelete={() => handleDeleteProject(project.portal_project_id)}
  ```
- **File:** `stavagent-portal/frontend/src/pages/PortalPage.tsx` (2 lines changed)

#### Monolit-Planner — Lockfile sync fix
- **Problem:** `npm ci` fails in CI with `Missing: string-similarity@4.0.4 from lock file`
  - `backend/package.json` has `"string-similarity": "^4.0.4"` (used by `relinkService.js`)
  - Root `Monolit-Planner/package-lock.json` was out of sync — missing the entry
- **Fix:** Ran `npm install` from `Monolit-Planner/` root to regenerate lockfile
- **File:** `Monolit-Planner/package-lock.json` (+8 lines)

---

## Priority Tasks (Unchanged)

### 1. Monolit Position Write-back
- Monolit → POST `/api/positions/:instanceId/monolith`
- Portal API exists (13 endpoints), kiosk integration pending

### 2. Registry DOV Write-back
- Registry TOVModal → POST `/api/positions/:instanceId/dov`
- Portal API exists, UI integration pending

### 3. Deep Links + URL Routing
- `?project_id=X&position_instance_id=Y` for cross-kiosk navigation
- RegistryView already supports `position_instance_id` URL param

### 4. Deploy Portal Backend
- Phase 8 DB migration (position_instance_id columns)
- 13 new `/api/positions/` endpoints

### 5. Set Environment Variables (Render)
- `PERPLEXITY_API_KEY` for concrete-agent
- `OPENAI_API_KEY` for concrete-agent
- Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB (AI suggestion enablement)

---

## Testing Status

| Component | Tests | Status |
|-----------|-------|--------|
| Monolit formulas | 55 | Pass |
| RCPSP scheduler | 27 | Pass |
| Monolit integration | 4 | Pass |
| Relink service | 20+ | Pass |
| URS Matcher | 159 | Pass |
| **Total** | **265+** | **Pass** |

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

---

**Version:** 2.0.1
**Last Updated:** 2026-03-04
**Status:** CI fixes applied, Unified Registry Foundation complete (Weeks 1-9)
