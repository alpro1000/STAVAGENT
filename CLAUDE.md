# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 1.4.0
**Last Updated:** 2026-01-26
**Repository:** STAVAGENT (Monorepo)

**NEW (2026-01-26):** Rozpočet Registry Classification System Migration - Rule-based classifier with uppercase codes (2 commits) ✅ Complete
**PREVIOUS (2026-01-21 Part 2):** R0 Deterministic Core + Unified Project Architecture - Portal aggregates all kiosks (5 commits) ⏳ PR Ready
**PREVIOUS (2026-01-21 Part 1):** Portal Integration + AI Suggestion Enablement - Audit trail + Feature flag tools (6 commits) ⏳ Awaiting user SQL execution
**PREVIOUS (2026-01-16 Part 2):** Monolit Planner UX Improvements - Modal fixes + Editable work names + Resizable columns (5 commits) ✅
**PREVIOUS (2026-01-16 Part 1):** Rozpočet Registry Phase 6 & 7 Complete - Multi-Project Search + Excel Export (Production Ready ✅)
**PREVIOUS (2026-01-13-14):** Google Drive Integration Complete (Day 1 + Day 2) + Auth Fix + All 8 PRs Merged ✅
**PREVIOUS (2026-01-12):** Document Accumulator API Fix + Keep-Alive System (Render Free Tier)
**PREVIOUS (2026-01-12):** OTSKP Import Fix + KPI Header Compact + WorkTypeSelector + Project Deletion Fix
**PREVIOUS (2026-01-08):** PartHeader OTSKP Catalog Price + Calculated Kč/m³ Comparison + Object Info Display
**PREVIOUS (2026-01-07):** Slate Minimal Design System (Web UI + Excel Export) - 7 commits, 919 lines, complete styling overhaul
**PREVIOUS (2025-12-29):** Document Accumulator Enhanced (Version Tracking + Comparison + Excel/PDF Export) + Workflow C Deployment Fix

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (ЯДРО) - Python FastAPI
├── stavagent-portal/      ← Portal (Dispatcher) - Node.js
├── Monolit-Planner/       ← Kiosk (Concrete Calculator) - Node.js
├── URS_MATCHER_SERVICE/   ← Kiosk (URS Matching) - Node.js
├── rozpocet-registry/     ← Kiosk (BOQ Registry) - React/Vite (Browser-only)
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

## 5 Services - Detailed Description

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

### 5. rozpocet-registry (Kiosk)

**Location:** `/rozpocet-registry`
**Technology:** React 18 + TypeScript + Vite (Browser-only, no backend)
**Port (Dev):** 5173
**Platform:** Static hosting (Vercel, Netlify, GitHub Pages)

**Purpose:** Web application for managing, classifying, and searching BOQ (Bill of Quantities) items from construction budgets.

**Key Features:**
- 📥 **Excel Import** - Flexible .xlsx/.xls file parsing with configurable templates
- 🔍 **Fuzzy Search** - Multi-project search with Fuse.js (weighted: kod 40%, popis 30%)
- 📊 **Auto-Classification** - AI-assisted categorization of items into work groups
- 🔗 **Traceability** - Hyperlinks to original files and row numbers
- 📤 **Excel Export** - Export with HYPERLINK formulas for clickable navigation
- 📁 **Multi-Project** - Manage multiple projects simultaneously
- 💾 **Browser Storage** - All data stored in localStorage (no server required)

**7-Phase Architecture:**
1. **Phase 1: Design System** - Digital Concrete Design System + TypeScript types
2. **Phase 2: Template Selector** - Import wizard with predefined templates
3. **Phase 3: Custom Templates** - User-configurable import mappings
4. **Phase 4: Auto-Detection** - Automatic Excel structure detection
5. **Phase 5: Auto-Classification** - Rule-based item classification (NEW 2026-01-26)
6. **Phase 6: Multi-Project Search** - Fuzzy search with advanced filters (NEW 2026-01-16)
7. **Phase 7: Excel Export** - Export with hyperlinks and 3 sheets (NEW 2026-01-16)

**Tech Stack:**
```javascript
Frontend: React 18 + TypeScript 5.3 + Vite 7
Styling: Tailwind CSS (Digital Concrete Design)
State: Zustand (persistent store)
Tables: TanStack Table v8
Excel: SheetJS (xlsx)
Search: Fuse.js (fuzzy search)
Icons: Lucide React
```

**Search Features (Phase 6):**
- Weighted fuzzy search (Fuse.js)
  - Code (kod): 40% weight
  - Description (popis): 30% weight
  - Full description (popisFull): 20% weight
  - Unit (mj): 5% weight
  - Group (skupina): 5% weight
- Advanced filters: projects, groups, price range, classification status
- Character-level match highlighting
- Performance: ~50ms for 1000+ items

**Export Features (Phase 7):**
- 3 Excel sheets:
  - **Položky** - All items with HYPERLINK formulas (clickable links back to app)
  - **Souhrn** - Statistics and group distribution
  - **Metadata** - Project info and import configuration
- Group-by-skupina option
- Automatic column widths
- Professional formatting

**Classification System (Phase 5 - NEW 2026-01-26):**
- **Rule-based Classifier** - Deterministic pattern matching (migrated from Python YAML)
- **10 Work Groups** - Uppercase codes (ZEMNI_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENI, BEDNENI, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA)
- **Scoring Algorithm:**
  - +1.0 for each include match (keywords like "vykop", "betonaz", "kotvy")
  - -2.0 for each exclude match (strong penalty)
  - +0.5 for unit boost (m³, kg, etc.)
  - +0.3 for priority conflicts (KOTVENI > VYZTUŽ, BETON_PREFAB > BETON_MONOLIT)
- **Diacritics Normalization** - Remove accents for matching (výkop → vykop)
- **Evidence Trail** - Shows 2-4 matched keywords proving classification
- **Confidence Scoring** - Formula: `min(100, (score / 2.0) * 100)`
- **Priority Resolution** - Conflict resolution with bonuses
- **Version:** 2.0.0 (synchronized with concrete-agent Python classifier)

**Data Structure:**
```typescript
interface ParsedItem {
  id: string;                    // UUID
  kod: string;                   // Item code "231112"
  popis: string;                 // Main description
  skupina: string | null;        // Work group
  mnozstvi: number;              // Quantity
  cenaJednotkova: number;        // Unit price
  cenaCelkem: number;            // Total price
  source: ItemSource;            // Source (project, sheet, row)
}
```

**Storage:**
- Browser localStorage for all data
- No server/database required
- Zustand store with persistence
- Data survives browser refresh

**Key Files:**
- `src/services/search/searchService.ts` - Fuzzy search implementation (209 lines)
- `src/services/export/excelExportService.ts` - Excel export with hyperlinks (276 lines)
- `src/services/parser/excelParser.ts` - Excel file parsing
- `src/services/autoDetect/autoDetectService.ts` - Structure detection
- `src/services/classification/classificationService.ts` - Classification wrapper
- `src/services/classification/classificationRules.ts` - Rule-based classifier (336 lines, NEW 2026-01-26)
- `src/utils/constants.ts` - Work group definitions (10 groups, NEW 2026-01-26)
- `src/components/search/SearchBar.tsx` - Search UI (220 lines)
- `src/components/search/SearchResults.tsx` - Results display (172 lines)
- `src/components/items/ItemsTable.tsx` - Main data table
- `src/App.tsx` - Main application (11,582 lines total)

**Status:** ✅ **Production Ready (v2.1.0)** - All 7 phases complete + Classification 2.0.0 (2026-01-26)

**Documentation:**
- `README.md` - Project overview and quick start (v2.1.0)
- `SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md` - Classification system migration (1200+ lines)
- `SESSION_2026-01-16_PHASE6_7.md` - Phase 6 & 7 implementation details

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

## Current Status (2026-01-26)

### ✅ COMPLETED: Rozpočet Registry Classification Migration (2026-01-26)

**Branch:** `claude/review-session-notes-4I53w`

**Status:** ✅ Complete, ✅ Pushed to remote

**Summary:**
Complete migration of classification system from old Czech work group names (25 groups) to new rule-based system with uppercase codes (10 groups), matching Python YAML classifier in concrete-agent.

**Key Changes:**

| Component | Description | Status |
|-----------|-------------|--------|
| Work Groups | 25 Czech names → 10 uppercase codes | ✅ Complete |
| Classification Rules | Complete rewrite (336 lines) with scoring algorithm | ✅ Complete |
| Diacritics Normalization | Remove accents for matching (výkop → vykop) | ✅ Complete |
| Priority Resolution | KOTVENI > VYZTUŽ, BETON_PREFAB > BETON_MONOLIT | ✅ Complete |
| Evidence Trail | Show 2-4 matched keywords | ✅ Complete |
| Horizontal Scrolling | Fix infinite tab expansion | ✅ Complete |

**Key Commits:**

| Commit | Description | Status |
|--------|-------------|--------|
| `19c29ff` | FEAT: Migrate classification to rule-based system with uppercase codes | ✅ Pushed |
| `a6c084f` | FIX: Prevent infinite horizontal expansion of project/sheet tabs | ✅ Pushed |

**Total:** 2 commits, 2 files rewritten, 1 file patched, ~370 lines modified

**10 Work Groups (NEW):**
```
ZEMNI_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENI,
BEDNENI, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA
```

**Scoring Algorithm:**
- +1.0 for each include match (keywords like "vykop", "betonaz", "kotvy")
- -2.0 for each exclude match (strong penalty)
- +0.5 for unit boost (m³, kg, etc.)
- +0.3 for priority conflicts

**Files Modified:**
- `src/utils/constants.ts` (28 lines, complete rewrite)
- `src/services/classification/classificationRules.ts` (336 lines, complete rewrite)
- `src/App.tsx` (+6 lines, horizontal scrolling fix)

**Documentation:**
- `SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md` (1200+ lines)

**Build:** ✅ TypeScript compilation successful, 11.09s

**Version:** rozpocet-registry v2.1.0 (Classification 2.0.0)

---

### ⏳ IN PROGRESS: R0 Deterministic Core + Unified Project Architecture (2026-01-21 Part 2)

**Branch:** `claude/portal-audit-improvements-8F2Co`

**Status:** ✅ Code complete, ⏳ PR ready for merge

**Summary:**
Implemented R0 Deterministic Core calculators and unified project architecture. Portal now serves as central registry linking all kiosk projects.

**Key Changes:**

| Component | Description | Status |
|-----------|-------------|--------|
| R0 API | `/api/r0/projects`, `/api/r0/elements`, `/api/r0/captures` | ✅ Complete |
| R0 UI | React components for R0 calculations | ✅ Complete |
| R0 Migrations | PostgreSQL with portal_project_id | ✅ Complete |
| Portal Unified API | `/api/portal-projects/:id/unified` | ✅ Complete |
| Kiosk Linking | `/api/portal-projects/:id/link-kiosk` | ✅ Complete |
| Reverse Lookup | `/api/portal-projects/by-kiosk/:type/:id` | ✅ Complete |

**Key Commits:**

| Commit | Description |
|--------|-------------|
| `16561a4` | FEAT: Add R0 Deterministic Core API + Portal services update |
| `6e6ae7e` | FEAT: Add R0 Deterministic Core UI components |
| `df74e25` | FEAT: Add Phase 6 R0 auto-migrations for PostgreSQL |
| `1635e1c` | FIX: Add .js extensions to ESM imports for Node.js compatibility |
| `6b1c137` | FEAT: Unified project architecture across all kiosks |

**Total:** 5 commits, 4 files, +326 lines

**Architecture:**
```
Portal (Central Registry)
  ↓ unified API
  ├── Monolit Planner (portal_project_id in monolith_projects)
  ├── R0 Calculators (portal_project_id in r0_projects)
  └── URS Matcher (portal_project_id in jobs)
```

**New Portal API Endpoints:**
```
GET  /api/portal-projects/:id/unified      - Aggregated data from all linked kiosks
POST /api/portal-projects/:id/link-kiosk   - Link kiosk project to portal
GET  /api/portal-projects/by-kiosk/:t/:id  - Reverse lookup by kiosk reference
```

**Unified Summary Metrics:**
- `total_concrete_m3` - Sum from Monolit + R0
- `total_cost_czk` - Total cost from Monolit
- `total_elements` - Element count across kiosks
- `urs_matched_items` - Matched items from URS Matcher

**PR URL:** `https://github.com/alpro1000/STAVAGENT/compare/main...claude/portal-audit-improvements-8F2Co`

---

### ⏳ AWAITING: Portal Integration + AI Suggestion Enablement (2026-01-21 Part 1)

**Branch:** `claude/create-onboarding-guide-E4wrx`

**Status:** ✅ Code complete, ⏳ Awaiting user SQL execution

**Summary:**
Enhanced AI suggestions with audit trail. Discovered AI button (✨) exists since Dec 2025 but hidden by disabled feature flag. Created 5 automatic tools to enable it.

**Key Changes:**

| Component | Description | Status |
|-----------|-------------|--------|
| Backend Audit Trail | position_suggestions table logging | ✅ Complete |
| Migration 007 | portal_project_id + normsets + position_suggestions | ✅ Created |
| Migration 008 | Enable FF_AI_DAYS_SUGGEST feature flag | ✅ Created |
| Automatic Tools | 5 tools (HTML, bash, node.js, SQL, docs) | ✅ Complete |
| Feature Flag | FF_AI_DAYS_SUGGEST enabled in database | ⏳ Pending |
| UI Button | ✨ Sparkles button visible | ⏳ Pending |

**Key Commits:**

| Commit | Description | Files | Lines |
|--------|-------------|-------|-------|
| `5f44a4a` | Portal integration backend (Migration 007 + API) | 3 | +611 |
| `64d6a0c` | Refactor: enhance AI suggestions with audit trail | 3 | +28/-386 |
| `abe3ea5` | Migration 008: Enable AI suggestion feature flag | 1 | +47 |
| `47eadc5` | Add automatic tools to enable AI button | 3 | +697 |
| `ce30dc9` | Add Russian instructions for enabling AI button | 1 | +79 |
| `e602ec9` | Add step-by-step SQL fix for empty project_config | 2 | +168 |

**Total:** 6 commits, 13 files, ~1630 lines added

**Architecture:**

**Before:**
```
User clicks ✨ → AI suggestion → Display in UI
```

**After:**
```
User clicks ✨ → AI suggestion → Display in UI
                              ↓
                    Save to position_suggestions
                         (audit trail)
```

**Database Schema Changes:**
```sql
-- Migration 007
CREATE TABLE normsets (id, name, source_tag, rebar_h_per_t, ...);
  -- 4 seed datasets: ÚRS 2024, RTS 2023, KROS 2024, Internal

CREATE TABLE position_suggestions (
  id, position_id, suggested_days, suggested_by,
  normset_id, norm_source, assumptions_log, confidence,
  status, user_decision_days, user_note
);

ALTER TABLE bridges ADD COLUMN portal_project_id TEXT;
ALTER TABLE monolith_projects ADD COLUMN portal_project_id TEXT;
```

**Root Cause Analysis:**

Feature flag `FF_AI_DAYS_SUGGEST` controls button visibility:
```javascript
// PositionRow.tsx:53
const isAiDaysSuggestEnabled = config?.feature_flags?.FF_AI_DAYS_SUGGEST ?? false;

// Line 468-491
{isAiDaysSuggestEnabled && (
  <button className="ai-suggest-button">
    <Sparkles size={16} color="white" />
  </button>
)}
```

**Problem:** `project_config` table empty → API returns empty response → flag defaults to `false` → button hidden

**Solution:** Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in PostgreSQL to create config and enable flag

**Automatic Tools Created:**

1. **ENABLE_AI_BUTTON.html** - Browser-based automatic enabler with UI
2. **enable-ai-button.sh** - Bash script with retry logic
3. **scripts/enable-ai-suggestion.js** - Node.js migration runner
4. **БЫСТРОЕ_РЕШЕНИЕ.sql** - SQL script for Render Dashboard ⭐ (ACTIVE)
5. **ИНСТРУКЦИЯ_RENDER.txt** - Step-by-step guide in Russian

**User Action Required:**
```
1. Open Render Dashboard → monolit-db → Shell
2. Execute: psql -U monolit_user -d monolit_planner
3. Copy-paste SQL from БЫСТРОЕ_РЕШЕНИЕ.sql
4. Refresh Monolit Planner frontend
5. Verify ✨ button appears in "Dny" column
```

**Documentation:**
- `SESSION_2026-01-21_PORTAL_INTEGRATION.md` - Complete session summary (550+ lines)
- `NEXT_SESSION.md` - Starter commands for next session (350+ lines)
- `БЫСТРОЕ_РЕШЕНИЕ.sql` - SQL fix (47 lines)
- `ИНСТРУКЦИЯ_RENDER.txt` - User guide (168 lines)

**Next Session:** Verify feature flag enabled → Test AI suggestion → Create PR

---

### ✅ COMPLETED: Monolit Planner UX Improvements (2026-01-16 Part 2)

**Branch:** `claude/add-fuzzy-search-oKCKp`

**Status:** ✅ **PRODUCTION READY** - All improvements deployed

**Summary:**
- Modal windows - close only on X button (prevent accidental closing)
- Editable work names with pencil icon ✏️
- Resizable "Práce" column (80-400px)
- Fixed work type names (Bednění, Výztuž, Betonování)

**Key Commits:**

| Commit | Description | Status |
|--------|-------------|--------|
| `8bad06c` | FIX: Use work type names instead of 'Nová práce' | ✅ Merged |
| `3b5b60c` | FEAT: Fix work name editing + add resizable work column | ✅ Merged |
| `d2c8a00` | REFACTOR: Restore original work names + add edit pencil icon | ✅ Merged |
| `d18fdb4` | FEAT: Modal improvements + editable work names | ✅ Merged |
| `9216f7d` | Merge branch 'main' into claude/add-fuzzy-search-oKCKp | ✅ Merged |

**Key Changes:**

#### 1. Modal Windows - Close Only on X Button
**Problem:** Modals closed accidentally when clicking outside

**Solution:**
- Removed `onClick` from modal overlays
- Added close buttons (✕) where missing
- 9 modals affected: CreateMonolithForm, EditBridgeForm, ExportHistory, NewPartModal, DeleteBridgeModal, DeleteProjectModal, FormulaDetailsModal, HistoryModal, CustomWorkModal

**Files:** 8 components modified

#### 2. Editable Work Names
**Problem:** Cannot edit work names like "Bednění" → "Bednění-1фаза"

**Solution:**
- Pencil icon ✏️ appears on hover
- Click pencil → edit mode with input field
- Save ✓ / Cancel ✕ buttons
- Keyboard shortcuts: Enter (save), Escape (cancel)
- Can revert to default by clearing custom name

**User Flow:**
```
📦 Bednění → hover → ✏️ appears
Click ✏️ → input field with "Bednění"
Edit to "Bednění-1фаза" → click ✓
Result: 📦 Bednění-1фаза
```

**Files:** PositionRow.tsx

#### 3. Resizable "Práce" Column
**Problem:** Fixed 80px width, long names truncated

**Solution:**
- Drag handle on right edge of column header
- Resize range: 80px - 400px (default 150px)
- Visual feedback: gray → orange when dragging
- Cursor changes to col-resize (⇔)
- Other columns auto-adjust

**Implementation:**
- CSS variable `--work-column-width`
- Mouse event handlers for drag
- Synchronized header + body rows

**Files:** PositionsTable.tsx, slate-table.css

#### 4. Fixed Work Type Names
**CRITICAL FIX:** Wrong names when adding work

**Before:**
- Add Bednění → showed "Nová práce" ❌
- Create new part → Betonování showed "ZÁKLADY ZE ŽELEZOBETONU..." ❌

**After:**
- Add Bednění → shows "Bednění" ✅
- Create new part → Betonování shows "Betonování" ✅

**Solution:** Use `SUBTYPE_LABELS` dictionary instead of hardcoded strings

**Files:** PositionsTable.tsx

**Documentation:**
- `SESSION_2026-01-16_MODAL_WORK_NAMES.md` - Detailed session summary (900+ lines)
- `CLAUDE.md` v1.3.7 - Updated with session info

**Total Changes:**
- Files modified: 10
- Lines added: ~285
- Lines removed: ~45
- Backend changes: None (frontend only)

---

### ✅ COMPLETED: Google Drive Integration + Auth Fix (2026-01-13-14)

**Branch:** `claude/fix-excel-import-kpi-JFqYB` (ALL 8 PRs MERGED TO MAIN ✅)

**Status:** 🎉 **PRODUCTION READY** - All features deployed to Render

**Summary:**
- Complete Google Drive OAuth2 integration (Day 1: Backend + Day 2: Frontend)
- Authentication fix for production (.env.production)
- Parser fix deployed and verified
- All 8 PRs successfully merged to main

**Key Commits:**

| Commit | Description | Status |
|--------|-------------|--------|
| `c800e2e` | FIX: Disable authentication in production (.env.production) | ✅ Merged PR #246 |
| `7b29ed3` | DOCS: Add comprehensive session summary for Day 2 | ✅ Merged PR #245 |
| `f05e700` | DOCS: Update PR description with Day 2 Google Drive frontend | ✅ Merged PR #245 |
| `8725009` | FEAT: Google Drive Integration - Day 2 Frontend Complete | ✅ Merged PR #245 |
| `c267a56` | DOCS: Add comprehensive session summary for Day 1 | ✅ Merged PR #244 |
| `4fc0abd` | FEAT: Google Drive OAuth2 Integration (Day 1 Complete) | ✅ Merged PR #242 |
| `4217880` | FIX: Document Summary modal click propagation + parser Path type | ✅ Merged PR #241 |
| `a20480a` | FEAT: Add Keep-Alive system to prevent Render Free Tier sleep | ✅ Merged earlier |

**Key Features:**

#### 1. Google Drive OAuth2 Backend (Day 1)
**Location:** `concrete-agent/packages/core-backend/`

**Implementation:**
- Complete OAuth2 service with Fernet encryption (AES-128)
- 7 API endpoints for auth, folders, upload, webhooks
- Database schema (google_credentials, google_webhooks)
- Beautiful callback UI with countdown timer
- CSRF protection with Redis state tokens
- HMAC webhook verification (SHA256)
- Minimal scopes (`drive.file` only)

**Files:**
- `app/services/google_drive_service.py` (600+ lines)
- `app/api/routes_google.py` (400+ lines)
- `migrations/003_google_drive_tables.sql`
- `app/core/database.py`

**API Endpoints:**
```
GET  /api/v1/google/auth           # Initiate OAuth2
GET  /api/v1/google/callback       # Handle callback
GET  /api/v1/google/folders        # List folders
POST /api/v1/google/upload         # Upload file
POST /api/v1/google/webhook        # Change notifications
POST /api/v1/google/setup-watch    # Setup monitoring
GET  /api/v1/google/health         # Health check
```

#### 2. Google Drive Frontend UI (Day 2)
**Location:** `stavagent-portal/frontend/src/components/portal/`

**Implementation:**
- OAuth2 popup handler with postMessage communication
- Google Drive folder selector dropdown
- Upload with progress tracking
- Success/error feedback (spinners, checkmarks)
- 5 new React state variables
- Clean UI integration (Digital Concrete design)

**Files:**
- `DocumentSummary.tsx` (+150 lines)

**UI Components:**
```tsx
// Before authorization
<button onClick={handleGoogleAuth}>
  <Cloud /> Připojit Google Drive
</button>

// After authorization
<select>{googleFolders.map(...)}</select>
<button onClick={handleUploadToDrive}>
  <Cloud /> Nahrát do Drive
</button>
```

**User Flow:**
```
1. User clicks "Připojit Google Drive"
2. OAuth2 popup opens (600x700)
3. Google consent screen
4. User grants permissions
5. Callback sends postMessage
6. Frontend loads folders
7. User selects folder
8. User clicks "Nahrát do Drive"
9. File uploaded to Google Drive
10. Success checkmark (3 seconds)
```

#### 3. Authentication Fix (Production)
**Problem:** `.env.production` missing `VITE_DISABLE_AUTH=true` → Users couldn't access portal

**Solution:**
```bash
# stavagent-portal/frontend/.env.production
VITE_DISABLE_AUTH=true  # Added
```

**Result:** Direct portal access without login/password

#### 4. Parser Fix Verification
**Problem:** User saw error `'str' object has no attribute 'suffix'`

**Root Cause:** Browser cache (old JavaScript)

**Verification:**
```python
# ✅ Correct code in main
parsed_result = parser.parse(temp_path, project_id="temp")
# NOT: parser.parse(str(temp_path)) ❌
```

**Status:** ✅ Fixed in commit 4217880, merged to main

---

### 📦 Deployment Status

**All 8 PRs Merged:**
- PR #246 - Auth fix (2026-01-14 07:04 UTC+1)
- PR #245 - Google Drive Day 2 docs
- PR #244 - Google Drive Day 1 docs
- PR #243 - Google Drive environment variables
- PR #242 - Google Drive Day 1 backend
- PR #241 - Parser fix + modal fix
- PR #240 - Google Drive architecture docs
- PR #239 - Google Drive setup guide

**Production URLs:**
- concrete-agent: https://concrete-agent.onrender.com ✅
- stavagent-portal: https://stav-agent.onrender.com ✅

**Health Checks:**
- concrete-agent/health: ✅ 200 OK
- concrete-agent/api/v1/google/health: ✅ 200 OK (when setup)

---

### ⏳ Pending Setup (Google Cloud)

**Manual Configuration Required (15 minutes):**

1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 consent screen (External)
4. Create OAuth2 credentials
5. Add redirect URIs:
   - `https://concrete-agent.onrender.com/api/v1/google/callback`
6. Generate encryption keys:
   ```bash
   openssl rand -base64 32  # GOOGLE_CREDENTIALS_ENCRYPTION_KEY
   openssl rand -hex 32     # GOOGLE_WEBHOOK_SECRET_KEY
   ```
7. Add to Render Environment (concrete-agent):
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_OAUTH_REDIRECT_URI
   - GOOGLE_CREDENTIALS_ENCRYPTION_KEY
   - GOOGLE_WEBHOOK_SECRET_KEY
   - PUBLIC_URL

**Testing:**
1. Open Portal → Shrnutí dokumentu
2. Upload document → Analyze
3. Click "Připojit Google Drive"
4. Authorize in popup
5. Select folder
6. Click "Nahrát do Drive"
7. Verify file in Google Drive

---

### 📚 Documentation

**Session Summaries:**
- `SESSION_2026-01-14_AUTH_FIX_AND_STATUS.md` - Auth fix + deployment verification
- `SESSION_2026-01-13_GOOGLE_DRIVE_DAY2.md` - Frontend integration (538 lines)
- `SESSION_2026-01-13_GOOGLE_DRIVE_DAY1.md` - Backend OAuth2 (500+ lines)

**Architecture:**
- `docs/GOOGLE_DRIVE_API_ARCHITECTURE.md` - Complete technical spec (1200+ lines)
- `GOOGLE_DRIVE_SETUP.md` - User setup guide (800+ lines)

**Configuration:**
- `concrete-agent/packages/core-backend/.env.example` - Environment variables
- `KEEP_ALIVE_SETUP.md` - Keep-Alive system guide (460 lines)

---

### 🎯 Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Backend Implementation | Day 1 | Day 1 | ✅ |
| Frontend Integration | Day 2 | Day 2 | ✅ |
| Lines of Code | 1000+ | 1200+ | ✅ |
| API Endpoints | 7 | 7 | ✅ |
| PRs Merged | All | 8/8 | ✅ |
| Production Deploy | Yes | Yes | ✅ |
| Auth Fixed | Yes | Yes | ✅ |
| Parser Fixed | Yes | Yes | ✅ |

---

### ✅ COMPLETED: Document Accumulator API Fix + Keep-Alive System (2026-01-12 - Part 2)

**Branch:** `claude/fix-excel-import-kpi-JFqYB`

**Commits:**

| Commit | Description |
|--------|-------------|
| `8662772` | FIX: Document Accumulator API path - add /api/v1 prefix to router |
| `a20480a` | FEAT: Add Keep-Alive system to prevent Render Free Tier sleep |

**Key Changes:**

#### 1. Document Accumulator API Path Fix
**Problem:** Frontend calling `/api/v1/accumulator/summarize/file` but backend router had prefix `/accumulator` (missing `/api/v1`).

**Solution:**
- Changed router prefix from `/accumulator` to `/api/v1/accumulator` in `routes_accumulator.py`
- Aligned with other routers (multi-role, summary, workflow-c all use `/api/v1/` prefix)
- Fixed 404 errors in Document Summary feature

**Files:** `concrete-agent/packages/core-backend/app/api/routes_accumulator.py`

#### 2. Keep-Alive System for Render Free Tier
**Problem:** Services sleep after 15 minutes of inactivity on Render Free Tier, causing 30+ second cold starts.

**Solution:** Implemented professional Keep-Alive system with security features:

**Architecture:**
```
GitHub Actions (cron: */14 * * * *)
    ↓
    Ping /healthcheck with X-Keep-Alive-Key header
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ concrete-agent  │ monolit-planner │ stavagent-portal│
│ (FastAPI)       │ (Express)       │ (Express)       │
└─────────────────┴─────────────────┴─────────────────┘
```

**Security Features:**
- Secret key authentication via `X-Keep-Alive-Key` header
- Returns 404 (not 403) to hide endpoint existence
- Endpoint disabled if `KEEP_ALIVE_KEY` env var not set

**Reliability Features:**
- Retry logic: 3 attempts with 10-second delays
- Handles cold-start scenarios (first ping may timeout)
- 30-second timeout per request

**Clean Logs:**
- Express: `morgan` skip filter for `/healthcheck` path
- FastAPI: Custom middleware to disable `uvicorn.access` logger
- GitHub Actions: Silent curl (`-s` flag)

**Files:**
- `.github/workflows/keep-alive.yml` - GitHub Actions workflow (67 lines)
- `KEEP_ALIVE_SETUP.md` - Comprehensive setup guide (460 lines)
- `concrete-agent/packages/core-backend/app/main.py` - FastAPI endpoint + middleware
- `Monolit-Planner/backend/server.js` - Express endpoint + morgan filter
- `stavagent-portal/backend/server.js` - Express endpoint + morgan filter

**Setup Required:**
1. Generate random secret key: `openssl rand -base64 32`
2. Add `KEEP_ALIVE_KEY` to GitHub Secrets
3. Add `KEEP_ALIVE_KEY` to Render Environment Variables (all 3 services)
4. Redeploy services
5. Enable workflow in GitHub Actions

**Benefits:**
- Services stay warm 24/7 on Render Free Tier
- Zero cost (GitHub Actions free tier: 2,000 min/month, usage: ~1,440 min/month)
- No more 30-second cold starts
- Professional security (secret key protection)

**Documentation:** See `KEEP_ALIVE_SETUP.md` for detailed setup instructions.

---

### ✅ COMPLETED: Excel Import + UI/UX Improvements + Project Deletion Fix (2026-01-12 - Part 1)

**Branch:** `claude/add-price-comparison-I1tFe`

**Commits:**

| Commit | Description |
|--------|-------------|
| `2ac4251` | FIX: Extract and save OTSKP code during Excel import |
| `b1450af` | STYLE: Compact KPI header - single line layout |
| `68ff508` | FIX: Hide Betonování from work type selector |
| `2b9b985` | FIX: Project deletion - route order and sidebar refresh |

**Key Changes:**

#### 1. OTSKP Code Import Fix
**Problem:** OTSKP codes were not saved when importing Excel files. Function `extractConcreteOnlyM3()` didn't extract codes, INSERT didn't include `otskp_code` field.

**Solution:**
- Added OTSKP extraction in `extractConcreteOnlyM3()`: searches "Kód" column and 5-6 digit codes
- Updated INSERT in `upload.js` for PostgreSQL and SQLite with `otskp_code` field
- Added logging to show extracted codes

**Files:**
- `Monolit-Planner/backend/src/services/concreteExtractor.js`
- `Monolit-Planner/backend/src/routes/upload.js`

#### 2. Compact KPI Header
**Problem:** KPI header took too much vertical space (3 lines).

**Solution:** Combined all info into single horizontal line:
```
🏗️ SO203 | MOST PŘES BIOKORIDO... | 📁 Import | 🧱 1 209,70 m³
```

**Files:** `Monolit-Planner/frontend/src/components/KPIPanel.tsx`

#### 3. Hide Betonování from WorkTypeSelector
**Problem:** User could add duplicate Betonování (auto-created with each part), which couldn't be deleted.

**Solution:** Hid "Betonování" button from work type selector. Users can still add: Bednění, Výztuž, Oboustranné bednění, Jiné.

**Files:** `Monolit-Planner/frontend/src/components/WorkTypeSelector.tsx`

#### 4. Project Deletion Fix
**Problem:**
- 404 error when deleting projects - route `/by-project-name/:projectName` was AFTER `/:id`
- Sidebar didn't refresh after deletion

**Solution:**
- Moved `/by-project-name` route BEFORE `/:id` route
- Added `refetchBridges()` after `confirmDelete()` and `confirmDeleteProject()`

**Files:**
- `Monolit-Planner/backend/src/routes/monolith-projects.js`
- `Monolit-Planner/frontend/src/components/Sidebar.tsx`

---

### ✅ COMPLETED: OTSKP Catalog Price & Object Info Display (2026-01-08)

**Branch:** `claude/resolve-merge-conflicts-96zgf`

**Commits:**

| Commit | Description |
|--------|-------------|
| `1d6521a` | FEAT: Add calculated Kč/m³ field for comparison with catalog price |
| `1f6cbff` | FIX: Load OTSKP catalog price on component mount |
| `47b1514` | FEAT: Add object info display + OTSKP catalog price field |
| `c448395` | FIX: Sidebar toggle button fully visible (right: -36px → -2px) |

**Key Changes:**

#### 1. Object Info Display in KPIPanel
**Problem:** Header only showed bridge_id (e.g., "SO 12-20-01"), no other object details.

**Solution:** Added display of:
- `object_name` - Full object name
- `project_name` - Project folder name (with 📁 icon)
- `sum_concrete_m3` - Total concrete volume (with 🧱 icon)

**Files:** `Monolit-Planner/frontend/src/components/KPIPanel.tsx`

#### 2. OTSKP Catalog Price Field
**Problem:** No way to see catalog price when OTSKP code is selected.

**Solution:** Added "Cena dle katalogu" field in PartHeader:
- Green background when price loaded
- Shows price from OTSKP catalog (e.g., `13 886,89 Kč/M3`)
- Auto-loads price on component mount if OTSKP code exists
- Updates immediately when selecting new code from dropdown

**Files:**
- `Monolit-Planner/frontend/src/components/PartHeader.tsx`
- `Monolit-Planner/frontend/src/components/OtskpAutocomplete.tsx`

#### 3. Calculated Kč/m³ for Comparison
**Problem:** No way to compare calculated price with catalog price.

**Solution:** Added "⭐ Kč/m³ (výpočet)" field:
- Blue background for calculated values
- Formula: `partTotalKrosCzk / betonQuantity`
- Allows direct comparison:
  - 📗 **Katalog:** `4 856,37 Kč/M3` (official price)
  - 📘 **Výpočet:** `5 120,00 Kč/m³` (your calculation)

**Files:**
- `Monolit-Planner/frontend/src/components/PartHeader.tsx`
- `Monolit-Planner/frontend/src/components/PositionsTable.tsx`

#### 4. Sidebar Toggle Button Fix
**Problem:** Button barely visible (only orange stripe due to `right: -24px`).

**Solution:** Changed to `right: -2px` for full button visibility.

**Files:** `Monolit-Planner/frontend/src/components/Sidebar.tsx`

---

### ✅ COMPLETED: Slate Minimal Design System Implementation (2026-01-07 morning)

**Branch:** `claude/cleanup-session-files-iCP0L`

**Commits:**

| Commit | Description |
|--------|-------------|
| `dfbc455` | FIX: Sidebar toggle button z-index - prevent resize handle overlap |
| `c9b13b0` | FIX: Handle 'Bez projektu' (NULL project_name) deletion correctly |
| `84c93f1` | STYLE: Implement Slate minimal table design |
| `07de681` | FIX: Excel formulas not displaying - add calcProperties and result values |
| `7e359f7` | REFACTOR: Implement precise color system & column widths per spec |
| `cc52855` | FIX: Add KROS JC CEILING formula to Excel export |
| `f033557` | STYLE: Apply Slate color system to Excel export |

**Key Changes:**

#### 1. Sidebar Toggle Button Visibility Fix
**Problem:** Button hidden behind resize handle (z-index 10 vs resize handle z-index 20).

**Solution:**
- Increased button z-index from 10 to 30
- Moved button position: `right: -12px → -24px`
- Added orange background and shadow for better visibility

**Files:** `Monolit-Planner/frontend/src/components/Sidebar.tsx`

#### 2. Delete Project NULL Handling Fix
**Problem:** 404 error when deleting projects named "Bez projektu" (which have NULL project_name in DB).

**Solution:**
```javascript
const isNullProject = projectName === 'Bez projektu';
if (isNullProject) {
  projectsToDelete = await db.prepare(`
    SELECT project_id FROM monolith_projects WHERE project_name IS NULL
  `).all();
}
```

**Files:** `Monolit-Planner/backend/src/routes/monolith-projects.js`

#### 3. Slate Minimal Table Design (Web UI) - 593 lines
**Created:** `/frontend/src/styles/slate-table.css`

**Features:**
- **Tailwind Slate Color Palette:** 10 shades (slate-50 to slate-900)
- **Semantic Colors:** Emerald 600 (positive), Amber 600 (warning), Sky 600 (info)
- **Precise Column Widths:** Fixed layout with exact pixel widths for all 15 columns
- **Typography:** `font-variant-numeric: tabular-nums` for perfect number alignment
- **Semantic Column Colors:**
  - Days (Dny): Bold Emerald 600 (green - positive metric)
  - KPI (Kč/m³): Emerald 600 (green - key performance indicator)
  - KROS JC: Slate 400 (muted - reference data)
  - Quantity, KROS celkem: Bold Slate 900 (emphasis)

**Files:**
- `Monolit-Planner/frontend/src/styles/slate-table.css` (NEW - 593 lines)
- `Monolit-Planner/frontend/src/main.tsx` (import added)

#### 4. Excel Formulas Display Fix
**Problem:** Formulas exported but not visible/recalculating in Excel.

**Solution:**
1. Added `workbook.calcProperties.fullCalcOnLoad = true`
2. Added `result: 0` field to all SUM formulas in totals row

```javascript
workbook.calcProperties.fullCalcOnLoad = true;

totalsRow.getCell(3).value = {
  formula: `SUM(C${firstDataRow}:C${lastDataRow})`,
  result: 0  // Required for Excel to recognize formula
};
```

**Files:** `Monolit-Planner/backend/src/services/exporter.js`

#### 5. Precise Color System & Column Widths
**Updated:** `slate-table.css` with exact hex values and widths per specification.

**Changes:**
- Exact hex colors from Tailwind Slate palette
- `table-layout: fixed` for precise width control
- `!important` rules for all column widths
- Semantic colors for specific columns

#### 6. KROS JC Formula in Excel Export
**Problem:** KROS JC column exported as static number from database.

**Solution:** Added CEILING formula to Excel export:
```javascript
const krosUnitCzk = unitCostPerM3 > 0 ? Math.ceil(unitCostPerM3 / 50) * 50 : 0;
dataRow.getCell(13).value = {
  formula: `CEILING(K${rowNumber},50)`,
  result: krosUnitCzk
};
```

#### 7. Slate Color System - Excel Export (~280 lines)
**Complete Excel styling matching web UI design.**

**Implementation:**
- **Color Palette:** Excel ARGB format (23-47 lines)
- **Column Widths:** Precise widths for all 15 columns (49-68 lines)
- **Style Functions:** (193-300 lines)
  - `applyHeaderStyle()` - Slate 50 bg, Slate 600 text, medium border
  - `applyGroupHeaderStyle()` - Slate 100 bg, thick left accent border
  - `applyDataRowStyle()` - Alternating white/near-white backgrounds
  - `applyTotalRowStyle()` - Double top border, Slate 50 bg, bold
  - `applyPreciseColumnWidths()` - Apply exact column widths
- **Semantic Colors Applied:** (467-524 lines)
  - Množství (C): Bold Slate 900
  - Dny (G): Bold Emerald 600 (green)
  - Kč/m³ (K): Emerald 600 (green KPI)
  - KROS JC (M): Slate 400 (muted)
  - KROS celkem (N): Bold Slate 900

**Files:** `Monolit-Planner/backend/src/services/exporter.js` (280 lines modified)

**Status:** ✅ Complete - Web UI and Excel export now share identical Slate design system

---

### ✅ COMPLETED: Font Unification + Critical Error Fixes (2026-01-07 afternoon)

**Branch:** `claude/fix-sidebar-null-handling-T1GHL`

**Commits:**

| Commit | Description | Files |
|--------|-------------|-------|
| `9e7c072` | FIX: Reduce column width & sidebar improvements | 2 |
| `f29eceb` | STYLE: Apply VARIANT A - Strict Font Unification | 5 |
| `d9eec01` | FIX: Critical errors from codebase audit | 4 |
| `afb416d` | DOCS: Session 2026-01-07 summary | 3 |

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

**Detailed Session Report:** See `Monolit-Planner/SESSION_2026-01-07.md` (572 lines)

**Status:** ✅ Complete - Typography unified, layout optimized, all critical errors fixed

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

**Last Updated:** 2026-01-12
**Maintained By:** Development Team

---

## 📖 Session Documentation

**Current Session (2026-01-26):**
- **Classification System Migration** - Rule-based classifier with uppercase codes
  - Migrated from 25 Czech work group names → 10 uppercase codes
  - Complete rewrite of classificationRules.ts (336 lines)
  - Scoring algorithm: +1.0 include, -2.0 exclude, +0.5 unit boost, +0.3 priority
  - Diacritics normalization for matching (výkop → vykop)
  - Evidence trail with matched keywords
  - Priority resolution (KOTVENI > VYZTUŽ, BETON_PREFAB > BETON_MONOLIT)
- **UI Horizontal Scrolling Fix** - Tabs no longer expand screen infinitely
  - Fixed project tabs and sheet tabs with proper CSS container pattern
  - `overflow-hidden` wrapper + `overflow-x-auto` inner div + `flex-shrink-0` items
- **Files:** constants.ts (rewrite), classificationRules.ts (rewrite), App.tsx (+6 lines)
- **Commits:** 2 (19c29ff, a6c084f)
- **Documentation:** SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md (1200+ lines)
- **Build:** ✅ TypeScript successful (11.09s)
- Duration: ~2 hours

**Previous Session (2026-01-14):**
- **Authentication Fix** - Production portal access restored
  - Added `VITE_DISABLE_AUTH=true` to `.env.production`
  - Fixed: Users blocked at login screen with no credentials
  - 1 commit (c800e2e), merged in PR #246
- **Deployment Status Verification**
  - Confirmed all 8 PRs merged to main
  - Verified parser fix deployed (4217880)
  - Verified Google Drive Day 1 + Day 2 deployed
  - Identified browser cache as cause of lingering errors
- **Documentation**
  - Created SESSION_2026-01-14_AUTH_FIX_AND_STATUS.md
  - Updated CLAUDE.md v1.3.5
- Duration: ~30 minutes

**Previous Session (2026-01-13 - Day 2: Google Drive Frontend):**
- **Complete user-facing Google Drive integration**
  - OAuth2 popup handler with postMessage communication
  - Google Drive folder selector dropdown
  - Upload functionality with progress tracking
  - Success/error feedback (spinners, checkmarks)
  - 5 new React state variables
- **Backend error callback enhancement**
  - Added postMessage for error scenarios
  - Auto-close popup after 5 seconds
- **Files:** DocumentSummary.tsx (+150 lines), routes_google.py (+10 lines)
- **Commits:** 3 (8725009, f05e700, 7b29ed3)
- **Documentation:** SESSION_2026-01-13_GOOGLE_DRIVE_DAY2.md (538 lines)
- Duration: ~2 hours

**Previous Session (2026-01-13 - Day 1: Google Drive Backend):**
- **Complete OAuth2 backend implementation**
  - Google Drive service with Fernet encryption (600+ lines)
  - 7 API endpoints (auth, callback, folders, upload, webhooks)
  - Database schema (2 tables: credentials, webhooks)
  - Beautiful callback UI with countdown timer
  - CSRF protection with Redis state tokens
  - HMAC webhook verification (SHA256)
- **Security features**
  - Minimal OAuth scopes (drive.file only)
  - Encrypted credential storage (AES-128)
  - Automatic token refresh before expiry
- **Files:** google_drive_service.py, routes_google.py, 003_google_drive_tables.sql, database.py, .env.example
- **Commits:** 3 (4fc0abd, 0353b0f, b5b5f58)
- **Documentation:** SESSION_2026-01-13_GOOGLE_DRIVE_DAY1.md (500+ lines), GOOGLE_DRIVE_API_ARCHITECTURE.md (1200+ lines), GOOGLE_DRIVE_SETUP.md (800+ lines)
- Duration: ~4 hours

**Previous Session (2026-01-12 - Part 2):**
- Document Accumulator API path fix (/api/v1/accumulator prefix)
- Keep-Alive system for Render Free Tier (prevent sleep after 15min)
  - Secure /healthcheck endpoints with X-Keep-Alive-Key authentication
  - GitHub Actions workflow (ping every 14 minutes, retry logic)
  - Log filtering (exclude healthcheck from access logs)
  - Comprehensive setup guide (KEEP_ALIVE_SETUP.md, 460 lines)
- 2 commits, 620 lines added
- Duration: ~1.5 hours

**Previous Session (2026-01-12 - Part 1):**
- OTSKP code extraction during Excel import (was not being saved)
- Compact KPI header - single line layout (saves vertical space)
- Hide Betonování from work type selector (prevents duplicates)
- Project deletion fix - route order + sidebar refresh
- 4 commits, 6 files modified
- Duration: ~2 hours

**Previous Sessions:**
- **2026-01-08:** OTSKP Catalog Price display + Calculated Kč/m³ comparison + Object info in KPIPanel - 4 commits
- **2026-01-07:** Slate Minimal Design System (Web UI + Excel Export) - 7 commits, 919 lines
- **2025-12-29:** Document Accumulator Enhanced (Version Tracking + Comparison + Excel/PDF Export) + Workflow C Deployment Fix
- **2025-12-28:** Document Parsing Architecture + Workflow C + Summary Module + Multi-Role Performance (3-4x speedup)
- **2025-12-26:** Time Norms Automation + Portal Services Hub + Digital Concrete Design System
- **2025-12-25:** Git Hooks (Husky) + Production build fixes (TypeScript + prepare script)
- **2025-12-23:** Import/Bridge switch fix + Template removal + Excel export fix + Speed live recalc
- **2025-12-19:** Security fixes + Speed column (MJ/h) + дизайн/LLM/mobile обсуждение
- **2025-12-18:** Monolit Planner UI fixes (sidebar import refresh, custom work name)
- **2025-12-17:** Repository cleanup, render.yaml fixes, URL encoding, claude-mem hooks reinstallation
- **2025-12-16:** Excel Import Fixes, PostgreSQL compatibility
- **2025-12-11:** VARIANT 1 Architecture Migration
- **2025-12-10:** Gemini Integration (see `concrete-agent/GEMINI_SETUP.md`)
