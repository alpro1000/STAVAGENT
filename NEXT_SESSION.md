# NEXT SESSION - Unified Registry Complete + Position Write-back Pending

**Date:** 2026-03-04
**Branch:** `main` (120 commits merged Mar 2-4)
**Status:** Unified Registry Foundation complete, Write-back integration pending

---

## What Was Done (March 2-4, 2026)

### 120 commits, 155 files changed, +21,572 / -5,411 lines

#### Monolit-Planner (31 files, +4,678 lines)

**Unified Registry Foundation (Weeks 1-4):**
- DB migrations: `010_create_unified_registry.sql` (8 tables), `011_add_relink_support.sql`
- Registry API: 11 endpoints (`backend/src/routes/registry.js`, 270 lines)
- Adapters: `monolitRegistryAdapter.js` (139 lines), `registryTOVAdapter.js` (137 lines)
- File versioning: SHA256 hash-based version detection

**Relink Algorithm (Weeks 7-9):**
- `relinkService.js` (402 lines) — 4-step confidence matching:
  - GREEN (100%): exact sheet+position+code
  - AMBER (75%): positional ±2 rows + code
  - FUZZY (50-75%): description similarity > 0.75
  - ORPHANED/NEW: unmatched positions
- 8.8x performance optimization (Map-based O(1) lookups)
- `RelinkReportModal.tsx` (393 lines) — confidence UI + manual conflict resolution
- Relink API: 6 endpoints (`backend/src/routes/relink.js`, 202 lines)

**Unified Registry Frontend (Weeks 5-6, 93%):**
- `RegistryView.tsx` (264 lines) — browse, filter, sort, CSV export, bulk selection
- `UnifiedPositionModal.tsx` (111 lines) — cross-kiosk position details
- Sidebar routing, cross-kiosk navigation
- Table sorting (all columns), advanced filters (kiosk type, work category)

**Time Norms Automation:**
- AI-powered days estimation via concrete-agent Multi-Role system
- Backend endpoint + frontend sparkles button
- `test-time-norms.js` test script

**Bug Fixes:**
- OTSKP 500 errors, delete project 404, sidebar refetch after XLSX import

#### rozpocet-registry (16 files, +1,836 lines)

**Multi-Supplier Pump Calculator:**
- `pumpCalculator.ts` (149 lines) — 3 billing models (hourly, hourly+m³, per-15min)
- `pump_suppliers.json` — Berger, Frischbeton, Beton Union pricing
- `concrete_prices.json` — 2026 concrete supplier pricing (83 entries)
- Practical pump performance data (25-40 m³/h vs theoretical 56-163 m³/h)

**TOV Integration:**
- `tovProfessionMapper.js` — Betonář/Tesař/Železář profession mapping
- Excel export with TOV formulas and Materials sheet

**Cross-Kiosk Comparison:**
- `monolithPolling.ts` (186 lines) — auto-polling 30s/120s
- `MonolitCompareDrawer.tsx` — side-by-side price comparison with conflict severity

#### stavagent-portal (5 files, +657/-276 lines)

- Tab-based navigation: Služby / Projekty
- Master-Detail layout for projects
- `KioskLinksPanel.tsx` (468 lines) — linked kiosks with status/sync info
- `CreateProjectModal.tsx` — Czech labels, Digital Concrete design
- CorePanel visibility fix (Projekty tab only)

#### concrete-agent (32 files, +1,051/-4,835 lines)

- `brief_summarizer.py` (214 lines) — quick 2-3s summaries (vs 300s passport)
- KB loader optimization: file size limits, page limits, per-page error handling
- CORS fix for www.stavagent.cz
- MinerU system dependencies for 10x PDF speedup
- Removed redundant PDFs (~11MB saved)

#### Infrastructure

- Render Blueprint deployment config (`render.yaml`)
- Region fix: Oregon → Frankfurt for Portal backend
- npm cache enabled in CI
- PR template update

---

## Priority Tasks

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

**Version:** 2.0.0
**Last Updated:** 2026-03-04
**Status:** Unified Registry Foundation complete (Weeks 1-9)
