# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 1.3.0
**Last Updated:** 2025-12-29
**Repository:** STAVAGENT (Monorepo)

**NEW (2025-12-29):** Document Accumulator Enhanced (Version Tracking + Comparison + Excel/PDF Export) + Workflow C Deployment Fix
**PREVIOUS (2025-12-28):** Multi-Role Parallel Execution (3-4x speedup) + Workflow C (end-to-end pipeline) + Document Accumulator (incremental analysis)
**PREVIOUS (2025-12-26):** Time Norms Automation (AI-powered days estimation) + Portal Services Hub + Digital Concrete Design System

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (ЯДРО) - Python FastAPI
├── stavagent-portal/      ← Portal (Dispatcher) - Node.js
├── Monolit-Planner/       ← Kiosk (Concrete Calculator) - Node.js
├── URS_MATCHER_SERVICE/   ← Kiosk (URS Matching) - Node.js
└── docs/                  ← System-level documentation
```

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        STAVAGENT ECOSYSTEM                               │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                    stavagent-portal                             │    │
│   │                 (Main Entry Point / Dispatcher)                 │    │
│   │                                                                 │    │
│   │  - User Authentication (JWT)                                    │    │
│   │  - Project Management                                           │    │
│   │  - File Upload & Storage                                        │    │
│   │  - Route to Kiosks                                              │    │
│   │  - Chat Assistant (StavAgent)                                   │    │
│   └────────────────────────┬───────────────────────────────────────┘    │
│                            │                                             │
│            ┌───────────────┼───────────────┬───────────────┐            │
│            │               │               │               │            │
│            ▼               ▼               ▼               ▼            │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │ concrete-   │  │  Monolit-   │  │    URS_     │  │  (Future    │   │
│   │   agent     │  │  Planner    │  │  MATCHER_   │  │   Kiosks)   │   │
│   │             │  │             │  │  SERVICE    │  │             │   │
│   │  ═══════    │  │   Kiosk     │  │             │  │  - Pump     │   │
│   │   CORE      │  │  Concrete   │  │   Kiosk     │  │  - Formwork │   │
│   │  (ЯДРО)     │  │   Cost      │  │    URS      │  │  - Earth    │   │
│   │  ═══════    │  │  Calculator │  │  Matching   │  │             │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4 Services - Detailed Description

### 1. concrete-agent (CORE / ЯДРО)

**Location:** `/concrete-agent`
**Technology:** Python 3.10+, FastAPI
**Production URL:** `https://concrete-agent.onrender.com`
**Port (Dev):** 8000

**Purpose:** Central AI system that processes documents, performs audits, and provides Multi-Role validation.

**Key Capabilities:**
- Multi-Role AI System (6 specialist roles):
  - Document Validator
  - Structural Engineer
  - Concrete Specialist
  - Cost Estimator
  - Standards Checker
  - Project Manager
- Document parsing (PDF, Excel, XML via SmartParser)
- Knowledge Base (KROS, RTS, ČSN standards)
- Workflow A: Import → Parse → Validate → Enrich → Audit → Export
- Workflow B: Drawing → GPT-4 Vision → Quantities → Positions

**API Endpoints:**
```
POST /api/v1/multi-role/ask         ← Multi-Role AI validation (parallel execution)
POST /api/upload                     ← File upload and parsing
POST /workflow/a/import              ← Workflow A processing
POST /workflow/b/analyze_drawing     ← Drawing analysis
GET  /health                         ← Health check

# NEW (2025-12-28): Workflow C - Complete Pipeline
POST /api/v1/workflow/c/execute      ← Execute with positions
POST /api/v1/workflow/c/upload       ← Upload file + execute
POST /api/v1/workflow/c/execute-async ← Async execution
GET  /api/v1/workflow/c/{id}/status  ← Get progress
GET  /api/v1/workflow/c/{id}/result  ← Get final result

# NEW (2025-12-28): Document Accumulator
POST /api/v1/accumulator/folders     ← Add folder (background scan)
POST /api/v1/accumulator/files/upload ← Upload file
POST /api/v1/accumulator/parse-all   ← Parse pending files
POST /api/v1/accumulator/generate-summary ← LLM summary
GET  /api/v1/accumulator/projects/{id}/status ← Project status
WS   /api/v1/accumulator/ws/{id}     ← WebSocket progress

# NEW (2025-12-29): Document Accumulator - Version Tracking & Export
GET  /api/v1/accumulator/projects/{id}/versions ← Get all versions
GET  /api/v1/accumulator/projects/{id}/versions/{version_id} ← Get specific version
GET  /api/v1/accumulator/projects/{id}/compare?from=X&to=Y ← Compare versions
GET  /api/v1/accumulator/projects/{id}/export/excel ← Export to Excel
GET  /api/v1/accumulator/projects/{id}/export/pdf ← Export to PDF
```

**Monorepo Structure:**
```
concrete-agent/
├── packages/
│   ├── core-backend/    (@stavagent/core-backend - FastAPI)
│   ├── core-frontend/   (@stavagent/core-frontend - React/Vite)
│   └── core-shared/     (@stavagent/core-shared - TypeScript types)
└── CLAUDE.md            (Detailed CORE documentation)
```

**Key Files:**
- `packages/core-backend/app/api/routes_multi_role.py` - Multi-Role API
- `packages/core-backend/app/services/multi_role.py` - Multi-Role logic
- `packages/core-backend/app/services/orchestrator.py` - Parallel execution (NEW 2025-12-28)
- `packages/core-backend/app/services/workflow_c.py` - Workflow C pipeline (NEW 2025-12-28)
- `packages/core-backend/app/services/summary_generator.py` - Summary generation (NEW 2025-12-28)
- `packages/core-backend/app/services/document_accumulator.py` - Background processing + Version tracking (NEW 2025-12-28)
- `packages/core-backend/app/services/export_service.py` - Excel/PDF export (NEW 2025-12-29)
- `packages/core-backend/app/core/config.py` - Configuration

---

### 2. stavagent-portal (Dispatcher)

**Location:** `/stavagent-portal`
**Technology:** Node.js, Express, React
**Port (Dev):** 3001

**Purpose:** Main entry point for users. Manages projects, routes to kiosks, integrates with CORE.

**Key Features:**
- User authentication (JWT tokens)
- Project lifecycle management
- File upload and storage
- **Portal Services Hub (NEW 2025-12-26)** - Unified landing page displaying 6 kiosks
- Kiosk routing (Monolit, URS Matcher, future kiosks)
- Chat assistant (StavAgent)
- CORE integration for audit results
- **Digital Concrete Design System (NEW 2025-12-26)** - Brutalist Neumorphism UI/UX

**Database Tables:**
```sql
portal_projects   -- Main project table (portal_project_id as UUID)
portal_files      -- Uploaded files (file_id, file_type, storage_path)
kiosk_links       -- Project ↔ Kiosk connections
chat_sessions     -- Chat sessions with StavAgent
chat_messages     -- Chat history
users             -- User accounts
```

**API Endpoints:**
```
POST /api/portal/projects              ← Create project
GET  /api/portal/projects              ← List projects
POST /api/portal/projects/:id/files    ← Upload file
POST /api/portal/projects/:id/core/submit ← Send to CORE
GET  /api/portal/projects/:id/kiosks   ← List kiosks
POST /api/portal/chat/sessions         ← Start chat
```

**Key Files:**
- `backend/src/routes/portal-projects.js` - Project management
- `backend/src/routes/auth.js` - Authentication
- `docs/PORTAL_ARCHITECTURE.md` - Detailed architecture

**Portal Services Hub (Updated 2025-12-29):**
```
8 Services Displayed:
🔍 Audit projektu (Active) - AI audit výkazu výměr (Workflow C)
📁 Akumulace dokumentů (Active) - Incremental analysis + Version tracking + Export
🪨 Monolit Planner (Active) - Concrete cost calculator
🔎 URS Matcher (Active) - AI-powered BOQ matching
⚙️ Pump Module (Coming Soon) - Pumping logistics
📦 Formwork Calculator (Coming Soon) - Formwork optimization
🚜 Earthwork Planner (Coming Soon) - Excavation planning
🛠️ Rebar Optimizer (Coming Soon) - Reinforcement optimization
```

**New UI Components:**
- `ProjectAudit.tsx` - Workflow C UI (file upload → audit → GREEN/AMBER/RED results)
- `ProjectDocuments.tsx` - Document Accumulator UI:
  - Incremental file upload with background processing
  - Auto-generated summary (Multi-Role AI)
  - Version tracking and comparison (NEW 2025-12-29)
  - Excel/PDF export (NEW 2025-12-29)

**Digital Concrete Design System:**
- Philosophy: Brutalist Neumorphism ("Элементы интерфейса = бетонные блоки")
- Monochrome palette + orange accent (#FF9F1C)
- Physical interaction: buttons press inward on click
- BEM naming: `.c-btn`, `.c-panel`, `.c-card`, `.c-input`
- Files: `/DESIGN_SYSTEM.md`, `tokens.css`, `components.css`

---

### 3. Monolit-Planner (Kiosk)

**Location:** `/Monolit-Planner`
**Technology:** Node.js, Express, React, SQLite
**Production URL:** `https://monolit-planner-frontend.onrender.com`
**Port (Dev):** Backend 3001, Frontend 5173

**Purpose:** Calculate costs for monolithic concrete structures (bridges, buildings, tunnels).

**Key Feature:** Convert ALL costs to unified metric: **CZK/m³ of concrete**

**Critical Formulas:**
```javascript
// Main metric - cost per m³ of concrete
unit_cost_on_m3 = cost_czk / concrete_m3

// KROS rounding (up, step 50 CZK)
kros_unit_czk = Math.ceil(unit_cost_on_m3 / 50) * 50

// Duration calculation
estimated_months = sum_kros_total_czk /
                   (avg_crew_size × avg_wage_czk_ph × avg_shift_hours × days_per_month)
```

**Work Types (Subtypes):**
- `beton` - Concrete work (m³)
- `bednění` - Formwork (m²)
- `výztuž` - Reinforcement (kg)
- `jiné` - Other work (various units)

**Key Files:**
- `shared/src/formulas.ts` - All calculation formulas
- `backend/src/routes/positions.js` - Position CRUD + Time Norms API
- `backend/src/services/timeNormsService.js` - **AI days estimation (NEW 2025-12-26)**
- `frontend/src/components/PositionsTable.tsx` - Main table
- `CLAUDE.MD` - Detailed kiosk documentation (v4.3.8)

**⭐ Time Norms Automation (NEW 2025-12-26):**
- **Feature:** AI-powered work duration estimation
- **API:** `POST /api/positions/:id/suggest-days`
- **UI:** Sparkles button (✨) next to days field → tooltip with AI reasoning
- **Data Sources:** KROS/RTS/ČSN norms from concrete-agent Knowledge Base
- **Feature Flag:** `FF_AI_DAYS_SUGGEST: true` (enabled by default)
- **Fallback:** Empirical calculations if AI unavailable
- **Response Example:**
  ```json
  {
    "success": true,
    "suggested_days": 6,
    "reasoning": "Pro betonování 100 m³ s partou 4 lidí...",
    "confidence": 92,
    "data_source": "KROS norma B4.3.1"
  }
  ```

**⭐ VARIANT 1 Architecture (2025-12-11):**
- **Simplified to Single Universal Object Type** - Users describe project type in `object_name` field
- **Database Schema:** Removed type-specific columns (span_length_m, deck_width_m, building_area_m2, etc.)
- **Form Simplified:** 4-field creation form (projectId, projectName, objectName, description)
- **No Type Selector:** Removed ObjectTypeSelector component entirely
- **API Unified:** All routes treat objects identically
- **Code Reduction:** ~35% complexity reduction (550 → 360 lines in monolith-projects.js)
- **Status:** ⚠️ Backend complete, Frontend caching issue blocking UI display (see NEXT_SESSION.md)

---

### 4. URS_MATCHER_SERVICE (Kiosk)

**Location:** `/URS_MATCHER_SERVICE`
**Technology:** Node.js, Express, SQLite
**Production URL:** `https://urs-matcher-service.onrender.com`
**Port (Dev):** Backend 3001, Frontend 3000

**Purpose:** Match BOQ (Bill of Quantities) descriptions to URS codes using AI.

**4-Phase Architecture:**
1. **Phase 1: Norms Search** - Fuzzy matching with `string-similarity`
2. **Phase 2: Multi-model LLM Routing** - Task-based model selection
3. **Phase 3: Knowledge Base** - Integration with concrete-agent Multi-Role API
4. **Phase 4: Learning System** - Knowledge accumulation

**LLM Fallback Chain:**
```
Primary (env) → Claude → Gemini → OpenAI
Each provider gets its own AbortController!
```

**Key Configuration (llmConfig.js):**
```javascript
LLM_TIMEOUT_MS: 90000      // 90 seconds (was 30s - caused timeouts)
PPLX_TIMEOUT_MS: 60000     // 60 seconds for Perplexity
```

**Multi-Role Integration:**
```javascript
// multiRoleClient.js
const STAVAGENT_API_BASE = 'https://concrete-agent.onrender.com';

// Calls concrete-agent CORE for validation
POST ${STAVAGENT_API_BASE}/api/v1/multi-role/ask
```

**Key Files:**
- `backend/src/config/llmConfig.js` - LLM configuration
- `backend/src/services/llmClient.js` - LLM client with fallback
- `backend/src/services/multiRoleClient.js` - CORE integration
- `backend/src/services/ursMatcher.js` - URS matching logic
- `backend/src/api/routes/jobs.js` - Job processing

---

## Service Communication

### ID Flow
```
Portal Project ID (UUID)
       │
       ├─→ core_processing_id (in concrete-agent)
       │
       └─→ kiosk_result_id (in each kiosk)
```

### Main Integration Flow
```
1. User uploads file → Portal
2. Portal sends to concrete-agent → Parse, Audit
3. concrete-agent returns audit results (GREEN/AMBER/RED)
4. User selects kiosk (Monolit or URS Matcher)
5. Portal sends positions to kiosk
6. Kiosk calculates/matches
7. Portal displays final results
```

### API Contract Between Services

**Portal → concrete-agent:**
```http
POST https://concrete-agent.onrender.com/workflow/a/import
Content-Type: multipart/form-data
```

**Portal → Kiosk:**
```http
POST https://kiosk-url/import
Content-Type: application/json
{ projectId, projectName, positions[] }
```

**Kiosk → concrete-agent (Multi-Role):**
```http
POST https://concrete-agent.onrender.com/api/v1/multi-role/ask
Content-Type: application/json
{ role, question, context }
```

---

## Current Status (2026-01-07)

### ✅ COMPLETED: Font Unification + Critical Error Fixes (2026-01-07)

**Branch:** `claude/fix-sidebar-null-handling-T1GHL`

**Commits:**

| Commit | Description | Files |
|--------|-------------|-------|
| `9e7c072` | FIX: Reduce column width & sidebar improvements | 2 |
| `f29eceb` | STYLE: Apply VARIANT A - Strict Font Unification | 5 |
| `d9eec01` | FIX: Critical errors from codebase audit | 4 |

**Key Changes:**

#### 1. VARIANT A - Strict Font Unification
**Problem:** 3 different font systems across codebase (Design System, Old System, Slate Table).

**Solution:** Complete font standardization to single hierarchical scale.

**Implementation:**
- **Font Family:** JetBrains Mono everywhere (replaced Roboto Mono)
- **Font Sizes:** Strict hierarchy 11px/12px/13px/14px/16px/20px/28px
- **Standard Body:** 14px for buttons, inputs, table cells (was 13px in table)
- **Unified:** All 4 font systems merged into one

**Files:**
- `global.css` - Font-mono + simplified scale
- `slate-table.css` - --num-md 13px→14px, --num-lg 15px→16px
- `design-system/components.css` - c-input--number 15px→14px
- `Header.tsx` - select fontSize 13px→14px

#### 2. UI/UX Optimizations
**Problem:** PRÁCE column too wide (160px→80px), sidebar too wide (280px).

**Solution:**
- PRÁCE column: min-width 80px→50px, **max-width 100px** (prevents stretching)
- Sidebar: DEFAULT_WIDTH 280px→200px
- Result: More horizontal space for data columns

**Files:**
- `slate-table.css` - Column width constraints
- `Sidebar.tsx` - DEFAULT_WIDTH, MIN_WIDTH

#### 3. Critical Error Fixes (5 bugs)
**Problem:** Codebase audit found 28 issues (6 critical errors).

**Solution:** Fixed all 5 actionable critical errors:

1. **Division by Zero** (`formulas.ts:206`)
   - Added check: `|| days_per_month === 0`
   - Prevents Infinity/NaN in KPI calculations

2. **Type Assertion** (`formulas.ts:175-186`)
   - Added runtime type checks before `as number`
   - Validates both weight and value are numbers
   - Prevents runtime errors with non-numeric fields

3. **Directory Traversal** (`exporter.js:1022`)
   - Added `path.basename()` validation
   - Added `realpath` check for EXPORTS_DIR boundary
   - Prevents encoded slash attacks (`%2F`, `%2E`)

4. **Unsafe substring** (`positions.js:293`)
   - Fixed: `u.id ? u.id.substring() + '...' : 'unknown'`
   - Prevents "undefined..." in logs

5. **Missing await** (`positions.js:206`)
   - Status: FALSE POSITIVE (PostgreSQL wrapper uses async)
   - Verified correct in `db/index.js:53`

**Audit Results:**
- **Before:** 28 issues (6 errors, 14 warnings, 8 info) - Code Health 8.5/10
- **After:** 22 issues (0 errors, 14 warnings, 8 info) - Code Health **9.5/10** ✅

**Remaining:** 14 warnings (empty onError callbacks, no Error Boundaries) + 8 info (code quality)

**Files:**
- `formulas.ts` - Division by zero + type assertion
- `exporter.js` - Directory traversal prevention
- `positions.js` - Unsafe substring fix

---

### ✅ COMPLETED: Document Accumulator Enhanced + Workflow C Deployment Fix (2025-12-29)

**Branch:** `claude/optimize-multi-role-audit-84a4u`

**Commits:**

| Commit | Description |
|--------|-------------|
| `5ef2c2e` | FEAT: Add version tracking, comparison, and export to Document Accumulator |
| `f5f70de` | FIX: Add rootDir to concrete-agent render.yaml for correct deployment path |
| `153fc3f` | DOCS: Add deployment instructions for Workflow C 404 fix |

**Key Changes:**

#### 1. Document Accumulator Enhancements (~1047 lines)
**Problem:** Document Accumulator lacked version history, comparison, and export capabilities.

**Solution:** Complete version tracking system with comparison and professional export.

**Implementation:**
- Version Tracking: Auto-snapshots on every summary generation
- Version Comparison: Detailed diff (files added/removed/modified, cost delta, risk changes)
- Excel Export: Professional formatting with Summary + Positions sheets (openpyxl)
- PDF Export: Color-coded risk assessment with reportlab
- API Endpoints: 5 new endpoints for versions, comparison, and export
- Frontend UI: Version history table, comparison panel, export buttons

**Files:**
- `packages/core-backend/app/services/export_service.py` (NEW - 330 lines)
- `packages/core-backend/app/services/document_accumulator.py` (+150 lines)
- `packages/core-backend/app/api/routes_accumulator.py` (+154 lines)
- `stavagent-portal/frontend/src/components/portal/ProjectDocuments.tsx` (+200 lines)

#### 2. Workflow C Deployment Fix
**Problem:** "Audit projektu" returned 404 Not Found - backend not deployed.

**Root Cause:** `autoDeploy: false` in render.yaml + missing `rootDir`

**Solution:**
- Added `rootDir: concrete-agent/packages/core-backend` to render.yaml
- Manual deployment triggered on Render
- Backend successfully deployed with Workflow C routes

**Status:** ✅ Backend live at https://concrete-agent.onrender.com

---

### ✅ COMPLETED: Time Norms Automation + Portal Services Hub (2025-12-26)

**Branches:**
- `claude/implement-time-norms-automation-qx8Wm` (Time Norms)
- `claude/add-portal-services-qx8Wm` (Portal + Design System)

**Commits:**

| Commit | Description |
|--------|-------------|
| `a787070` | FEAT: Add Portal Services Hub + Digital Concrete Design System |
| `80e724e` | FIX: Add feature flag check to AI suggestion button |
| `9279263` | FEAT: Implement Time Norms Automation with AI-powered days suggestion |

**Key Changes:**

#### 1. Time Norms Automation (4 hours)
**Problem:** Users didn't know how many days to enter for different work types.

**Solution:** AI-powered work duration estimation using concrete-agent Multi-Role API.

**Implementation:**
- Backend service: `Monolit-Planner/backend/src/services/timeNormsService.js` (350 lines)
- API endpoint: `POST /api/positions/:id/suggest-days`
- Frontend UI: Sparkles button (✨) with AI tooltip showing reasoning + confidence
- Feature flag: `FF_AI_DAYS_SUGGEST: true` (enabled by default)
- Data sources: KROS/RTS/ČSN norms from Knowledge Base
- Fallback: Empirical calculations if AI unavailable
- Dependency added: `lucide-react` for Sparkles icon

**User Flow:**
```
User enters qty → Clicks ✨ → Backend calls concrete-agent (1-2s)
→ Tooltip shows: "6 дней (KROS норма B4.3.1, 92% jistota)"
→ Days field auto-fills → User accepts or adjusts
```

**Testing:**
- ✅ 68/68 tests passing
- ✅ Manual testing: concrete, formwork, reinforcement scenarios
- ✅ Fallback working when AI unavailable

#### 2. Portal Services Hub + Design System (3 hours)
**Problem:** No unified landing page showing all STAVAGENT services.

**Solution:** Portal Services Hub with Digital Concrete design system.

**Implementation:**
- Design System: `/DESIGN_SYSTEM.md` (8 pages, 332 lines)
- CSS Files: `tokens.css` (120 lines) + `components.css` (320 lines)
- ServiceCard component: `ServiceCard.tsx` (112 lines)
- PortalPage rewrite: `PortalPage.tsx` (397 lines)
- Import in `main.tsx`: tokens → components → global CSS

**Portal Services (6 Kiosks):**
- 🪨 Monolit Planner (Active)
- 🔍 URS Matcher (Active)
- ⚙️ Pump Module (Coming Soon)
- 📦 Formwork Calculator (Coming Soon)
- 🚜 Earthwork Planner (Coming Soon)
- 🛠️ Rebar Optimizer (Coming Soon)

**Design System: "Digital Concrete" (Brutalist Neumorphism)**
- Monochrome palette + orange accent (#FF9F1C)
- Physical interaction: buttons press inward on click
- Neumorphic shadows (elevation + depression)
- BEM naming: `.c-btn`, `.c-panel`, `.c-card`, `.c-input`

**Files:**
- `DESIGN_SYSTEM.md` - Complete design system documentation
- `stavagent-portal/frontend/src/styles/design-system/tokens.css`
- `stavagent-portal/frontend/src/styles/design-system/components.css`
- `stavagent-portal/frontend/src/components/portal/ServiceCard.tsx`
- `stavagent-portal/frontend/src/pages/PortalPage.tsx`
- `Monolit-Planner/backend/src/services/timeNormsService.js`

---

### ✅ COMPLETED: Git Hooks Implementation + Production Build Fixes (2025-12-25)
**Branch:** `claude/fix-import-bridge-excel-5qHJV`

**Commits:**

| Commit | Description |
|--------|-------------|
| `a1ba4ff` | FEAT: Add pre-commit hooks with husky for automated testing |
| `a47a538` | FIX: Make pre-push hook POSIX-compatible and run only critical tests |
| `8a7f020` | FIX: Production build errors - Husky prepare script and TypeScript test types |

**Key Changes:**

1. **Husky Git Hooks:**
   - Installed husky v9.1.7 for automated testing
   - Pre-commit hook runs 34 critical formula tests (~470ms)
   - Pre-push hook validates branch naming + runs tests
   - POSIX-compatible (uses `case` instead of `[[]]`)
   - Backend integration tests deferred (require test database)

2. **Production Build Fixes:**
   - Fixed husky prepare script: `"husky || true"` (was failing in production)
   - Fixed TypeScript errors: 14 type assertions changed to `as unknown as Position`
   - TypeScript compilation now succeeds
   - Production builds no longer fail

**Testing:**
- ✅ 34/34 critical formula tests passing
- ✅ Pre-commit hook working correctly
- ✅ Pre-push hook working correctly
- ✅ Ready for production deployment

**Files:**
- `.husky/pre-commit` - Pre-commit hook
- `.husky/pre-push` - Pre-push hook
- `package.json` - Root monorepo config (prepare script fixed)
- `Monolit-Planner/package.json` - Prepare script fixed
- `Monolit-Planner/shared/src/formulas.test.ts` - Type assertions fixed

---

### ✅ COMPLETED: Import/Bridge Switch Fix + Multiple Improvements (2025-12-23)
**Branch:** `claude/update-docs-merge-IttbI`

**Fixes Applied:**

| Commit | Description |
|--------|-------------|
| `c99ac46` | FEAT: Remove template auto-loading on manual project/bridge creation |
| `be1ebdd` | FIX: Excel export - show custom name for 'jiné' instead of generic label |
| `ca7c9cb` | FIX: Speed (MJ/h) now editable with live recalculation |
| `e87ad10` | FIX: Import + bridge switch issue - positions now load correctly |

**Key Changes:**

1. **Template Auto-loading Removed:**
   - Manual project creation now creates empty projects
   - Templates only used during Excel import (parser-driven)
   - Code reduction: -180 lines across `monolith-projects.js` and `bridges.js`

2. **Import/Bridge Switch Fix (Critical):**
   - Added `project_name` and `status` to `monolith_projects` INSERT
   - Added useEffect to clear positions when bridge changes
   - Changed `refetchOnMount: false` → `true` in usePositions
   - Reduced staleTime from 10min to 5min

3. **Excel Export Fix:**
   - Custom work "jiné" now shows user-entered name instead of generic "jiné"

4. **Speed Column Live Recalculation:**
   - Speed now calculates from CURRENT edited values, not stale server data
   - Bidirectional: edit speed → days recalculate, edit days → speed recalculates

---

### ✅ COMPLETED: Security Fixes + Speed Column (2025-12-19)
**Branch:** `claude/fix-sidebar-custom-work-hbtGl` (merged)

**Security Fixes:**
| Проблема | Файл | Исправление |
|----------|------|-------------|
| SQL Injection | `positions.js:19-23` | Whitelist `ALLOWED_UPDATE_FIELDS` |
| JSON.parse crash | `positions.js:101-106, 233-238, 363-368` | try/catch с fallback |

**Обсуждённые идеи (не реализованы):**
- Дизайн "Digital Concrete / Brutal-Neumo" — спецификация готова
- LLM интеграция — AI подсказка норм (флаг `FF_AI_DAYS_SUGGEST` есть)
- Мобильная версия — рекомендация PWA + dashboard

---

### ⚠️ KNOWN ISSUE: PostgreSQL Connection Timeout (2025-12-17)
**Root Cause:** Render.com free tier PostgreSQL "sleeps" after ~15 minutes of inactivity.

**Error Log:**
```
Error: Connection terminated due to connection timeout
    at pg-pool/index.js:45:11
    cause: Error: Connection terminated unexpectedly
```

**Analysis:**
| Factor | Description |
|--------|-------------|
| **Free tier limits** | Database "sleeps", first connection after pause is slow |
| **No retry logic** | pg-pool not configured for reconnection attempts |
| **No graceful handling** | Unhandled error crashes the application |
| **Double cold start** | Both backend AND PostgreSQL can be "cold" simultaneously |

**Solution Options:**
1. Increase connection timeout in pg-pool settings
2. Add retry logic for initial connection
3. Configure keepalive to prevent disconnection
4. Wrap errors in try-catch to prevent crashes
5. **Upgrade to paid tier** (only 100% solution for production)

**Status:** ⏸️ Waiting for paid tier upgrade before implementing fixes

---

### ✅ COMPLETED: claude-mem Installation (2025-12-17)
**Persistent memory system now properly installed and running.**

**Installation Steps Completed:**
1. Cloned `github.com/thedotmack/claude-mem` to `~/claude-mem/`
2. Built plugin with `npm run build`
3. Synced to marketplace `~/.claude/plugins/marketplaces/thedotmack/`
4. Started worker service (Bun-managed, port 37777)
5. Verified health: `curl http://localhost:37777/api/health` → `{"status":"ok"}`

---

### Previous Session (2025-12-17 morning): Repository Cleanup
**Session Work Completed:**
1. **Repository Cleanup** - Deleted 130+ obsolete markdown files from all services
2. **Render.yaml Fixes** - Added `autoDeploy: false` and `rootDir` to all services
3. **Created URS_MATCHER_SERVICE/render.yaml** - Was missing
4. **URL Encoding Fix** - Added `encodeURIComponent()` to all API calls
5. **Input Validation** - Reject `/\?#%` characters in project IDs
6. **Cache-Busting** - Added `_headers` file, meta tags, vite content hashing

**Commits:**
| Commit | Description |
|--------|-------------|
| `177f557` | FIX: Handle slashes in project IDs to prevent 404 errors |
| `d56ba81` | CLEANUP: Remove 130 obsolete files and fix render.yaml configs |
| `46b40e4` | FIX: Add cache-busting for frontend to resolve stale UI issue |

**Known Issues:**
- ⚠️ autoDeploy disabled - manual deploy required after code changes

---

### ✅ COMPLETED: Monolit Planner UI Fixes (2025-12-18)
**Two frontend bugs fixed:**

**Bug 1: Sidebar не показывает импортированные мосты**
- **Причина:** `Sidebar.tsx` - новые проекты не раскрывались автоматически
- **Исправление:** Авто-раскрытие новых проектов + авто-выбор первого импортированного моста

**Bug 2: Custom work "Jiné" показывает "Jiné" вместо пользовательского названия**
- **Причина:** `PositionRow.tsx` всегда использовал `SUBTYPE_LABELS['jiné']`
- **Исправление:** Для `subtype === 'jiné'` используется `position.item_name`

**Изменённые файлы:**
| Файл | Изменение |
|------|-----------|
| `Header.tsx` | Auto-select первого импортированного моста, fix alert message |
| `PositionRow.tsx` | Показ item_name для "jiné" вместо generic label |
| `Sidebar.tsx` | Авто-раскрытие новых проектов после импорта |

**Commit:** `c050914` FIX: Monolit Planner - sidebar import refresh + custom work name display

---

### ✅ COMPLETED: Excel Import Fixes (2025-12-16)
**Multi-sheet Excel import fully working with PostgreSQL.**

**Fixes Applied:**
1. **PostgreSQL Transaction Signature** - `db.transaction()` passes `(client, ...args)`, split handling for PostgreSQL/SQLite
2. **useBridges Initial Load** - Changed `refetchOnMount: false` → `true` to load bridges on app start
3. **PostgreSQL Async/Await** - Added `await` to all `db.prepare()` operations
4. **OTSKP Codes Filter** - Exclude 5-6 digit integers (OTSKP codes like 43131) from volume detection
5. **Bridge ID Extraction** - Compound IDs like "SO 12-23-01" now extracted as full ID, not truncated
6. **Quantity Scoring System** - Prefer decimals (7.838) over integers (3.00) with scoring algorithm

**Scoring System for Quantity Detection (`concreteExtractor.js`):**
```javascript
let score = 0;
if (isQuantityColumn) score += 100;      // Column named "quantity/množství"
if (decimalPlaces >= 2) score += 50;     // 7.838 has 3 decimals = +50
if (decimalPlaces >= 1) score += 20;     // Any decimal = +20
if (Number.isInteger(num)) score -= 30;  // Integers penalized
if (num >= 5 && num <= 500) score += 25; // Typical concrete volume range
if (num < 5 && isInteger) score -= 40;   // Small integers likely not volumes
if (isLikelyPrice) score -= 20;          // Price-like numbers excluded
```

### Recent Commits (Monolit-Planner - 2025-12-16)
| Commit | Description | Impact |
|--------|-------------|--------|
| `bda9740` | FIX: Quantity detection - use scoring system instead of sorting | ✅ Volume detection accuracy |
| `79c329b` | FIX: Bridge ID extraction - use full compound ID | ✅ Sheet name parsing |
| `b0fc8ca` | FIX: Quantity extraction - exclude OTSKP codes and prices | ✅ Filter false positives |
| `435723a` | FIX: PostgreSQL async - add await to db.prepare() | ✅ FK constraint fixes |
| `79587df` | FIX: useBridges - refetchOnMount: true | ✅ Initial data loading |
| `74e86a9` | FIX: PostgreSQL transaction signature | ✅ Transaction handling |

### claude-mem Plugin (2025-12-17)
**Persistent memory across sessions via hooks (no worker needed).**
- **Installation:** `npm install -g claude-mem` (global)
- **Hooks Directory:** `~/.claude-mem/hooks/`
- **Database:** `~/.claude-mem/` (SQLite + Chroma vector store)
- **Settings:** `~/.claude/settings.json` (4 hooks configured)

**Configured Hooks:**
| Hook | Purpose |
|------|---------|
| SessionStart | Load context at session start |
| Stop | Save memory on session end |
| UserPromptSubmit | Process user input |
| PostToolUse | Process after tool use |

**Status:** ✅ Hooks-based (auto-starts with Claude Code)

### Previous Session Status (2025-12-11): VARIANT 1 Migration
**Architecture Simplification:** Migrated from multi-type system to single universal object type.
- **Database:** Simplified schema (removed type-specific columns)
- **Code Reduction:** ~35% complexity reduction (550 → 360 lines)
- **Status:** ✅ Complete and deployed

### Previous Session Status (2025-12-10): Gemini Integration
**Cost Optimization:** Integrated Google Gemini as primary LLM for Multi-Role API.
- **Savings:** 40-250x cheaper ($0.00 FREE vs $0.10-0.50 per request)
- **Status:** ✅ Implementation complete, ⏳ Awaiting production verification
- **See:** concrete-agent/GEMINI_SETUP.md

### Recent Commits (URS_MATCHER_SERVICE - 2025-12-09)
| Commit | Description |
|--------|-------------|
| `0662ec8` | PERF: Add failed provider cache to skip known-bad providers |
| `e2fee86` | FIX: Remove global state mutation in LLM fallback (race condition) |
| `371c021` | FIX: Improve LLM error visibility and increase timeouts |
| `774ab93` | FIX: Race condition, stack overflow, and resource leaks in LLM client |

### Known Issues Fixed (Session 2025-12-09 - URS_MATCHER_SERVICE)
1. **Race Condition:** Removed global `currentProviderIndex` → per-request index
2. **Stack Overflow:** Converted recursive `getNextProvider` to iterative `getProviderAtIndex`
3. **Resource Leaks:** Added `finally` blocks for `clearTimeout`
4. **Wrong Client in Fallback:** Use `WithClient` versions instead of global `llmClient`
5. **Global State Mutation:** Don't update global `llmClient` on fallback success
6. **Performance:** Added failed provider cache (skip known-bad providers for 60s)
7. **Multi-Role Health:** Fixed endpoint `/api/v1/health` → `/health`

### LLM Client Architecture (llmClient.js)
```javascript
// Per-request fallback (no global state = no race conditions)
Primary Provider → [if fails, cache for 60s] → Fallback Chain
                                                  ↓
                                      Skip recently failed providers
                                                  ↓
                                      Each provider gets own AbortController
```

### Tests
- URS_MATCHER_SERVICE: 159 tests passing
- Monolit-Planner: All tests passing
- concrete-agent: 87+ tests

---

## Development Commands

### concrete-agent (CORE)
```bash
cd concrete-agent
npm install                    # Install all workspaces
npm run dev:backend            # Start FastAPI on :8000
npm run dev:frontend           # Start React on :5173
```

### stavagent-portal
```bash
cd stavagent-portal
npm install
npm run dev                    # Start Express on :3001
```

### Monolit-Planner
```bash
cd Monolit-Planner
cd shared && npm install && npm run build && cd ..
cd backend && npm run dev      # Start on :3001
cd frontend && npm run dev     # Start on :5173
```

### URS_MATCHER_SERVICE
```bash
cd URS_MATCHER_SERVICE
npm install
npm run dev                    # Start backend on :3001
# Frontend served by Nginx or npm run dev in /frontend
```

---

## Production URLs

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent.onrender.com |
| stavagent-portal | https://stav-agent.onrender.com |
| Monolit-Planner Frontend | https://monolit-planner-frontend.onrender.com |
| Monolit-Planner API | https://monolit-planner-api.onrender.com |
| URS_MATCHER_SERVICE | https://urs-matcher-service.onrender.com |

---

## Key Documentation Files

| File | Purpose |
|------|---------|
| `/CLAUDE.md` | **THIS FILE** - System overview |
| `/docs/ARCHITECTURE.md` | Multi-kiosk architecture |
| `/docs/STAVAGENT_CONTRACT.md` | API contracts between services |
| `/concrete-agent/CLAUDE.md` | CORE system documentation |
| `/Monolit-Planner/CLAUDE.MD` | Monolit kiosk documentation |
| `/URS_MATCHER_SERVICE/ARCHITECTURE.md` | URS Matcher architecture |
| `/stavagent-portal/docs/PORTAL_ARCHITECTURE.md` | Portal architecture |

---

## Quick Debugging

### URS Matcher: Empty Results (Only Headers)
1. Check LLM timeout in `llmConfig.js` (should be 90s)
2. Check AbortController in `llmClient.js` (each provider needs own controller)
3. Check Multi-Role URL in `multiRoleClient.js` (should be concrete-agent.onrender.com)

### Monolit: Calculations Wrong
1. Check `concrete_m3` value in beton position
2. Check `unit_cost_on_m3 = cost_czk / concrete_m3`
3. Check KROS rounding: `Math.ceil(x / 50) * 50`

### CORE: Service Unavailable
1. Check Render deployment status
2. Check `/health` endpoint
3. Check API keys in environment

---

## Environment Variables

### URS_MATCHER_SERVICE
```env
NODE_ENV=production
PORT=3001
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
LLM_TIMEOUT_MS=90000
STAVAGENT_API_URL=https://concrete-agent.onrender.com
```

### Monolit-Planner
```env
NODE_ENV=production
PORT=3001
VITE_API_URL=https://monolit-planner-api.onrender.com
CORS_ORIGIN=https://monolit-planner-frontend.onrender.com
```

### concrete-agent
```env
# Claude API (expensive - $0.10-0.50 per Multi-Role request)
ANTHROPIC_API_KEY=sk-ant-...

# ⭐ NEW: Gemini API (FREE - 1500 req/day, or $0.002 per request paid)
GOOGLE_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-2.0-flash-exp

# ⭐ NEW: Multi-Role LLM: "gemini" (default), "claude", "auto" (Gemini + Claude fallback)
MULTI_ROLE_LLM=gemini

# Other APIs
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
```

---

**Last Updated:** 2025-12-28
**Maintained By:** Development Team

---

## 📖 Session Documentation

**Current Session (2025-12-28):** See `/NEXT_SESSION.md` and `URS_MATCHER_SERVICE/SESSION_2025-12-28.md` for:
- Document Parsing Architecture Analysis (484 lines)
- Parsers Inventory - All 7 CORE parsers including MinerU (838 lines)
- Workflow C Complete Specification with Project Summary (1018 lines)
- Summary Module Architecture - Separate saveable entity (933 lines)
- Multi-Role Performance Optimization - 3-4x speedup (573 lines)
- 5 commits, 5 documents created (3846 lines total), 6 hours

**Previous Sessions:**
- **2025-12-26:** Time Norms Automation + Portal Services Hub + Digital Concrete Design System
- **2025-12-25:** Git Hooks (Husky) + Production build fixes (TypeScript + prepare script)
- **2025-12-23:** Import/Bridge switch fix + Template removal + Excel export fix + Speed live recalc
- **2025-12-19:** Security fixes + Speed column (MJ/h) + дизайн/LLM/mobile обсуждение
- **2025-12-18:** Monolit Planner UI fixes (sidebar import refresh, custom work name)
- **2025-12-17:** Repository cleanup, render.yaml fixes, URL encoding, claude-mem hooks reinstallation
- **2025-12-16:** Excel Import Fixes, PostgreSQL compatibility
- **2025-12-11:** VARIANT 1 Architecture Migration
- **2025-12-10:** Gemini Integration (see `concrete-agent/GEMINI_SETUP.md`)
