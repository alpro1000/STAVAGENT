# NEXT SESSION - Deep Links Complete + Deployment Pending

**Date:** 2026-03-06
**Branch:** `claude/review-next-session-Zjn4C`
**Status:** Deep links implemented across all services, all tests pass

---

## What Was Done This Session (2026-03-06)

### 8 commits total on branch

#### Formwork Refactor (4 commits, verified)
1. REFACTOR: Consolidate curing/strategies/formwork norms — eliminate 3 duplications
2. FIX: Formwork calculator — ceil() for work days + curing transfer to beton row
3. FIX: Use fresh API positions for curing days lookup (stale state bug)
4. FIX: Add Position type annotation (TS7006 build error)

#### Deep Links Implementation (3 commits, new)
5. DOCS: Update session status — write-backs confirmed complete
6. FEAT: PositionsPanel + enhanced KioskLinksPanel deep links
   - **New component:** `PositionsPanel.tsx` — shows linked positions table in Portal project detail
   - Deep-link buttons to open position in Monolit or Registry
   - Enhanced `KioskLinksPanel.handleOpen` with kiosk-specific URL routing
   - Integrated into `CorePanel` below KioskLinksPanel
7. FEAT: position_instance_id deep links across Portal, Registry, Monolit
   - `ProjectCard.tsx` — kiosk URLs now include project_id + portal_project
   - `TOVModal.tsx` — Monolit link appends position_instance_id
   - `ItemsTable.tsx` — Monolit icon click appends position_instance_id

### Deep Link Architecture (Complete)

| Component | URL Pattern | position_instance_id |
|-----------|-------------|---------------------|
| Monolit MainApp | `?project=X&position_instance_id=Z` | Scroll + highlight |
| Monolit RegistryView | `/registry/:projectId?position_instance_id=Z` | Opens modal |
| Registry App | `?position_instance_id=Z` | Scroll + highlight |
| Portal → Monolit | `?project=X&portal_project=Y` | Via PositionsPanel |
| Portal → Registry | `?project_id=X&portal_project=Y` | Via PositionsPanel |
| Registry TOVModal → Monolit | `?project=X&part=Y&position_instance_id=Z` | Deep link |
| Registry ItemsTable → Monolit | `monolit_url&position_instance_id=Z` | Deep link |

### Write-back Features (COMPLETE)
Both confirmed fully implemented:
- **Monolit → Portal:** `portalWriteBack.js` (auto on PUT /api/positions)
- **Registry → Portal:** `dovWriteBack.ts` (auto on TOV save)

---

## Remaining Tasks (User Action Required)

### 1. Deploy Portal Backend
- Phase 8 DB migration auto-applies on startup (no manual SQL needed)
- 13 new `/api/positions/` endpoints in `position-instances.js`
- Just deploy the latest code to Render

### 2. Environment Variables (Render)
- `PERPLEXITY_API_KEY` for concrete-agent
- `OPENAI_API_KEY` for concrete-agent
- Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Monolit DB (AI suggestion)

### 3. Future Enhancements
- Portal → Kiosk back-navigation (breadcrumbs)
- Template application workflow testing
- Two-way sync (Portal → Registry)

---

## Testing Status

| Component | Tests | Status |
|-----------|-------|--------|
| Monolit formulas | 55 | Pass |
| PERT estimation | 20 | Pass |
| Concrete maturity | 21 | Pass |
| Pour decision | 22 | Pass |
| RCPSP scheduler | 27 | Pass |
| URS Matcher | 159 | Pass |
| rozpocet-registry TS | - | Compiles clean |
| **Total** | **304+** | **Pass** |

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

**Version:** 2.0.3
**Last Updated:** 2026-03-06
**Status:** Deep links complete, formwork refactored, write-backs verified, Portal deploy pending
