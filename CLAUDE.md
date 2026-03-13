# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 2.5.0
**Last Updated:** 2026-03-08
**Repository:** STAVAGENT (Monorepo)

---

## Recent Activity

| Date | Service | Summary | Status |
|------|---------|---------|--------|
| 2026-03-13 | rozpocet-registry + Portal | Session 10 (audit only): Registry→Portal infinite loop fix verified — syncInProgress guard, !portalLink check, kiosk_links UNIQUE constraint ok | ✅ No changes |
| 2026-03-11 | Portal + Monolit | Session 9: CORS cleanup (duplicate origins removed), full env vars reference for all 5 GCR services | ✅ Pushed |
| 2026-03-08 | Portal + Monolit | Session 8: Betonárny discovery, AWS Bedrock, Objednávka betonu page, CORE proxy, Universal Parser pipeline, CorePanel inline styles, curing days fix | ✅ Pushed |
| 2026-03-07 | Monolit shared | Calculator audit: 3 bugs fixed (calculateEstimatedWeeks 22d mode ÷7→÷5, dead effectiveRebarDays, pour-decision NaN guard). 332 tests pass | ✅ Pushed |
| 2026-03-07 | Monolit + Registry | TariffPage CRUD UI (/tariffs), Pump engine unification (registry mirrors shared API, Gauss Easter) | ✅ Pushed |
| 2026-03-07 | stavagent-portal | Price Parser UI: PriceParserPage (/price-parser), batch PDF upload, supplier comparison table, API types, service registration | ✅ Pushed |
| 2026-03-07 | concrete-agent | PDF Price Parser: 17 files, 7 section parsers (betony/doprava/cerpadla/priplatky/laborator/malty/source), regex+LLM, API endpoint, 21 tests | ✅ Pushed |
| 2026-03-07 | Monolit + Portal | PlannerPage UI, PumpCalculatorPage, Calendar dates, PortalBreadcrumb, 332 shared tests | ✅ Pushed |
| 2026-03-06 | Monolit-Planner | Formwork refactor: consolidate curing/strategies/norms into shared, ceil() work days fix, curing transfer to beton row | ✅ Pushed |
| 2026-03-06 | Monolit shared | PERT 3-point estimation + Concrete maturity model (ČSN EN 13670) — 41 new tests, Monte Carlo, scheduler integration | ✅ Pushed |
| 2026-03-06 | Monolit frontend | MaturityConfigPanel UI — concrete class/cement/month picker, integrated into FormworkCalculatorModal | ✅ Pushed |
| 2026-03-06 | rozpocet-registry | Backend sync layer: localStorage ↔ PostgreSQL mirror (loadFromBackend + pushProjectToBackend + bulk upsert) | ✅ Pushed |
| 2026-03-06 | rozpocet-registry-backend | Bulk items endpoint (POST /sheets/:id/items/bulk) + graceful DB startup + health check fix | ✅ Pushed |
| 2026-03-06 | stavagent-portal | Removed unused ProjectCard import from PortalPage.tsx | ✅ Pushed |
| 2026-03-04 | Portal + Monolit | CI/Build fixes: PortalPage TS2322 (ProjectCard props), Monolit lockfile sync (string-similarity) | ✅ Pushed |
| 2026-03-04 | Monolit + Registry | Week 7-9: Conflict Resolution UI — manual matching for AMBER/RED positions | ✅ Pushed |
| 2026-03-04 | Monolit + Registry | Week 6: Bulk selection + Advanced filters + Sorting in RegistryView | ✅ Pushed |
| 2026-03-03 | Monolit-Planner | Unified Registry Frontend (Weeks 5-6): RegistryView page, sidebar, CSV export, sorting, cross-kiosk nav (93% complete) | ✅ Pushed |
| 2026-03-03 | Monolit-Planner | Relink Algorithm (Weeks 7-9): 4-step confidence matching + 8.8x perf optimization + UI modal | ✅ Pushed |
| 2026-03-03 | Monolit-Planner | Unified Registry Foundation (Weeks 1-4): DB migrations, 11 API endpoints, adapters, file versioning | ✅ Pushed |
| 2026-03-03 | rozpocet-registry | Multi-supplier pump calculator: 3 billing models, supplier comparison, Excel export | ✅ Pushed |
| 2026-03-03 | rozpocet-registry | Pump calculator improvements: practical performance data (25-40 m³/h vs theoretical) | ✅ Pushed |
| 2026-03-02 | Monolit-Planner | Time Norms Automation — AI days suggestion implementation complete | ✅ Pushed |
| 2026-03-02 | rozpocet-registry | TOV profession mapping for Monolit→Registry import (Betonář, Tesař, Železář) | ✅ Pushed |
| 2026-03-02 | stavagent-portal | Portal tabs + modal redesign — Design system UI, Master-Detail layout, Czech labels | ✅ Pushed |
| 2026-03-02 | concrete-agent | Document Passport performance optimization (300s → 2-8s) + robust KB loading | ✅ Pushed |
| 2026-03-02 | concrete-agent | CORS fix for www.stavagent.cz + MinerU dependencies for 10x PDF speedup | ✅ Pushed |
| 2026-03-02 | All | Render Blueprint deployment config + region fix (Oregon → Frankfurt) | ✅ Pushed |
| 2026-03-01 | Monolit + Registry + Portal | Cross-kiosk project registry: KioskLinksPanel, auto-polling (30s/120s), MonolitCompareDrawer, conflict indicators | ✅ Pushed |
| 2026-02-27 | Monolit-Planner shared | RCPSP Element Scheduler: DAG, Kahn's topo sort, CPM, parallel scheduling scheme (82 tests) | ✅ Pushed |
| 2026-02-27 | docs + Registry + Portal | Position Instance Architecture v1.0 + Portal linking fixes | ✅ Pushed |

---

## Quick Reference

```
STAVAGENT/
├── concrete-agent/        ← CORE (ЯДРО) - Python FastAPI
├── stavagent-portal/      ← Portal (Dispatcher) - Node.js/Express/React
├── Monolit-Planner/       ← Kiosk (Concrete Calculator) - Node.js/React
├── URS_MATCHER_SERVICE/   ← Kiosk (URS Matching) - Node.js
├── rozpocet-registry/     ← Kiosk (BOQ Registry) - React/Vite (Browser-only)
├── docs/                  ← System-level documentation
├── .github/workflows/     ← CI/CD (keep-alive, monolit CI, test coverage, URS tests)
└── .husky/                ← Git hooks (pre-commit, pre-push)
```

**Production URLs:**

ALL backends on **Render**, ALL frontends on **Vercel**.

| Service | Type | URL |
|---------|------|-----|
| concrete-agent (CORE) | Backend | https://concrete-agent-3uxelthc4q-ey.a.run.app |
| stavagent-portal | Backend | https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app |
| stavagent-portal | Frontend | https://www.stavagent.cz (Vercel: stavagent-backend-*.vercel.app) |
| Monolit-Planner | Backend | https://monolit-planner-api-3uxelthc4q-ey.a.run.app |
| Monolit-Planner | Frontend | https://monolit-planner-frontend.vercel.app |
| URS_MATCHER_SERVICE | Backend | https://urs-matcher-service-3uxelthc4q-ey.a.run.app |
| rozpocet-registry | Backend | https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app |
| rozpocet-registry | Frontend | https://stavagent-backend-ktwx.vercel.app (naming legacy) |

**DB (Render PostgreSQL):** `postgresql://stavagent_portal:***@dpg-d68br3mr433s73cht4r0-a/stavagent_portal`

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         STAVAGENT ECOSYSTEM                              │
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
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│   │ concrete-   │  │  Monolit-   │  │    URS_     │  │  rozpocet-  │  │
│   │   agent     │  │  Planner    │  │  MATCHER_   │  │  registry   │  │
│   │             │  │             │  │  SERVICE    │  │             │  │
│   │  ═══════    │  │   Kiosk     │  │             │  │   Kiosk     │  │
│   │   CORE      │  │  Concrete   │  │   Kiosk     │  │    BOQ      │  │
│   │  (ЯДРО)     │  │   Cost      │  │    URS      │  │  Registry   │  │
│   │  ═══════    │  │  Calculator │  │  Matching   │  │ (Browser)   │  │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                          │
│   Future Kiosks: Pump Module, Formwork Calculator,                       │
│                  Earthwork Planner, Rebar Optimizer                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Service Communication

```
Portal Project ID (UUID)
       │
       ├─→ core_processing_id (in concrete-agent)
       └─→ kiosk_result_id (in each kiosk)

Main Flow:
1. User uploads file → Portal
2. Portal sends to concrete-agent → Parse, Audit
3. concrete-agent returns audit results (GREEN/AMBER/RED)
4. User selects kiosk (Monolit, URS Matcher, etc.)
5. Portal sends positions to kiosk
6. Kiosk calculates/matches
7. Portal displays final results
```

### API Contracts

```http
# Portal → concrete-agent
POST https://concrete-agent-3uxelthc4q-ey.a.run.app/workflow/a/import
Content-Type: multipart/form-data

# Portal → Kiosk
POST https://kiosk-url/import
Content-Type: application/json
{ projectId, projectName, positions[] }

# Kiosk → concrete-agent (Multi-Role)
POST https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/multi-role/ask
Content-Type: application/json
{ role, question, context }
```

---

## 5 Services - Detailed Description

### 1. concrete-agent (CORE / ЯДРО)

**Location:** `/concrete-agent`
**Technology:** Python 3.10+, FastAPI
**Production URL:** `https://concrete-agent-3uxelthc4q-ey.a.run.app`
**Port (Dev):** 8000

**Purpose:** Central AI system that processes documents, performs audits, and provides Multi-Role validation.

**Key Capabilities:**
- Multi-Role AI System (6 specialist roles): Document Validator, Structural Engineer, Concrete Specialist, Cost Estimator, Standards Checker, Project Manager
- Document parsing (PDF, Excel, XML via SmartParser)
- Knowledge Base (KROS, RTS, ČSN standards)
- Rule-based work classifier (Python YAML, source of truth for classification)
- Workflow A: Import → Parse → Validate → Enrich → Audit → Export
- Workflow B: Drawing → GPT-4 Vision → Quantities → Positions
- Workflow C: Complete audit pipeline
- Document Accumulator: Background processing + Version tracking + Export
- Google Drive OAuth2 Integration

**LLM Configuration:**
```env
MULTI_ROLE_LLM=gemini          # "gemini" (default/cheap), "claude", "auto" (fallback)
GEMINI_MODEL=gemini-2.5-flash-lite
```

**Monorepo Structure:**
```
concrete-agent/
├── packages/
│   ├── core-backend/       (@stavagent/core-backend - FastAPI)
│   │   ├── app/
│   │   │   ├── api/        (13 route files)
│   │   │   ├── classifiers/ (Rule-based work classifier + YAML rules)
│   │   │   ├── services/   (Business logic)
│   │   │   ├── knowledge_base/ (13 domain subdirectories)
│   │   │   ├── parsers/    (Document parsers)
│   │   │   └── prompts/    (AI prompts)
│   │   ├── migrations/
│   │   └── tests/          (67 test files, 87+ tests)
│   ├── core-frontend/      (@stavagent/core-frontend - React/Vite)
│   └── core-shared/        (@stavagent/core-shared - TypeScript types)
├── CLAUDE.md               (Detailed CORE documentation v2.4.1)
└── render.yaml
```

**Key API Endpoints:**
```
POST /api/v1/multi-role/ask           ← Multi-Role AI validation
POST /api/upload                       ← File upload and parsing
POST /workflow/a/import                ← Workflow A processing
POST /workflow/b/analyze_drawing       ← Drawing analysis
POST /api/v1/workflow/c/execute        ← Workflow C pipeline
POST /api/v1/workflow/c/upload         ← Upload file + execute
POST /api/v1/accumulator/files/upload  ← Document Accumulator upload
POST /api/v1/accumulator/generate-summary ← LLM summary
GET  /api/v1/accumulator/projects/{id}/export/excel ← Excel export
GET  /api/v1/accumulator/projects/{id}/export/pdf   ← PDF export
GET  /api/v1/google/auth               ← Google Drive OAuth2
POST /api/v1/price-parser/parse         ← PDF price list → structured JSON
GET  /health                           ← Health check
```

**Key Files:**
- `packages/core-backend/app/api/routes_multi_role.py` - Multi-Role API
- `packages/core-backend/app/services/multi_role.py` - Multi-Role logic
- `packages/core-backend/app/services/workflow_c.py` - Workflow C pipeline
- `packages/core-backend/app/services/document_accumulator.py` - Background processing + Versions
- `packages/core-backend/app/services/export_service.py` - Excel/PDF export
- `packages/core-backend/app/classifiers/work_classifier.py` - Rule-based classifier
- `packages/core-backend/app/classifiers/rules/default_rules.yaml` - Classification rules (source of truth)
- `packages/core-backend/app/services/google_drive_service.py` - Google Drive OAuth2
- `packages/core-backend/app/services/brief_summarizer.py` - Quick document summaries (2-3s vs 300s passport)
- `packages/core-backend/app/core/config.py` - Configuration
- `packages/core-backend/app/core/kb_loader.py` - Knowledge base loader (optimized, MinerU-ready)
- `packages/core-backend/app/services/price_parser/` - PDF price list parser (7 section parsers, 21 tests)

---

### 2. stavagent-portal (Dispatcher)

**Location:** `/stavagent-portal`
**Technology:** Node.js, Express, React
**Port (Dev):** 3001

**Purpose:** Main entry point for users. Manages projects, routes to kiosks, integrates with CORE.

**Key Features:**
- User authentication (JWT tokens, `VITE_DISABLE_AUTH=true` in production)
- Project lifecycle management
- File upload and storage
- Portal Services Hub - Unified landing page displaying 8 kiosks (4 active, 4 coming soon)
- Kiosk routing (Monolit, URS Matcher, R0, future kiosks)
- Chat assistant (StavAgent)
- CORE integration for audit results
- Digital Concrete Design System (Brutalist Neumorphism)
- Unified project architecture (Portal aggregates all kiosks)
- **NEW:** Tab-based navigation (Služby / Projekty) with Master-Detail layout
- **NEW:** KioskLinksPanel — linked kiosks display with status, sync info, open/unlink actions
- **NEW:** Position Instance API (13 endpoints) — cross-kiosk position tracking

**Database Tables:**
```sql
portal_projects, portal_files, kiosk_links, chat_sessions, chat_messages, users,
position_instances, position_templates, position_audit_log
```

**Key API Endpoints:**
```
POST /api/portal/projects              ← Create project
GET  /api/portal/projects              ← List projects
POST /api/portal/projects/:id/files    ← Upload file
POST /api/portal/projects/:id/core/submit ← Send to CORE
GET  /api/portal-projects/:id/unified  ← Aggregated data from all linked kiosks
POST /api/portal-projects/:id/link-kiosk ← Link kiosk project to portal
GET  /api/portal-projects/:id/kiosks   ← List linked kiosks with status
GET  /api/positions/project/:projectId ← Position instances for project
POST /api/positions/:instanceId/monolith ← Monolit payload write-back
POST /api/positions/:instanceId/dov    ← Registry DOV payload write-back
```

**Key Files:**
- `backend/src/routes/portal-projects.js` - Project management
- `backend/src/routes/auth.js` - Authentication
- `frontend/src/components/portal/ProjectAudit.tsx` - Workflow C UI
- `frontend/src/components/portal/ProjectDocuments.tsx` - Document Accumulator UI
- `frontend/src/components/portal/ServiceCard.tsx` - Services Hub cards
- `frontend/src/components/portal/KioskLinksPanel.tsx` - Linked kiosks panel (468 lines)
- `frontend/src/pages/PortalPage.tsx` - Portal landing page (tab-based)

**Design System:** Digital Concrete / Brutalist Neumorphism
- Monochrome palette + orange accent (#FF9F1C)
- BEM naming: `.c-btn`, `.c-panel`, `.c-card`, `.c-input`
- Files: `/DESIGN_SYSTEM.md`, `tokens.css`, `components.css`

---

### 3. Monolit-Planner (Kiosk)

**Location:** `/Monolit-Planner`
**Technology:** Node.js 20.x, Express, React, PostgreSQL (prod) / SQLite (dev)
**Production URL:** `https://monolit-planner-frontend.vercel.app`
**Port (Dev):** Backend 3001, Frontend 5173

**Purpose:** Calculate costs for monolithic concrete structures (bridges, buildings, tunnels). Convert ALL costs to unified metric: **CZK/m³ of concrete**.

**Critical Formulas:**
```javascript
unit_cost_on_m3 = cost_czk / concrete_m3
kros_unit_czk = Math.ceil(unit_cost_on_m3 / 50) * 50  // KROS rounding (up, step 50)
estimated_months = sum_kros_total_czk / (crew × wage × shift_hours × days_per_month)
```

**Work Types (Subtypes):**
- `beton` - Concrete work (m³)
- `bednění` - Formwork (m²)
- `výztuž` - Reinforcement (kg)
- `jiné` - Other work (various units)

**Key Features:**
- Excel import with multi-sheet parsing and OTSKP code extraction
- OTSKP catalog price display + calculated Kč/m³ comparison
- AI-powered days suggestion (✨ button, `FF_AI_DAYS_SUGGEST` feature flag)
- Editable work names with pencil icon
- Resizable "Práce" column (80-400px)
- Slate Minimal Design System (web + Excel export)
- R0 Deterministic Core calculators
- **NEW:** Unified Registry Foundation (Weeks 1-4) — cross-kiosk position tracking
- **NEW:** Relink Algorithm (Weeks 7-9) — 4-step confidence matching when files are updated
- **NEW:** RegistryView page — browse positions with filters, sorting, CSV export, bulk selection
- **NEW:** Time Norms Automation — AI-powered days estimation via concrete-agent

**Structure:**
```
Monolit-Planner/
├── shared/        (formulas.ts + element-scheduler.ts, 82 tests)
├── backend/       (Express API, PostgreSQL/SQLite)
│   ├── migrations/ (010_unified_registry, 011_relink_support)
│   ├── src/routes/ (positions, registry, relink)
│   └── src/services/ (relinkService, monolitRegistryAdapter, registryTOVAdapter, fileVersioningService)
├── frontend/      (React + TypeScript, 50+ components)
│   ├── src/pages/RegistryView.tsx
│   └── src/components/ (RelinkReportModal, UnifiedPositionModal)
├── CLAUDE.MD      (Detailed documentation v4.3.8)
└── render.yaml
```

**Key Files:**
- `shared/src/formulas.ts` - All calculation formulas
- `shared/src/element-scheduler.ts` - RCPSP scheduler (DAG, CPM, parallel scheme)
- `backend/src/routes/positions.js` - Position CRUD + Time Norms API
- `backend/src/routes/registry.js` - Unified Registry API (11 endpoints)
- `backend/src/routes/relink.js` - Relink workflow API (6 endpoints)
- `backend/src/services/relinkService.js` - 4-step confidence matching (402 lines)
- `backend/src/services/monolitRegistryAdapter.js` - Monolit → Registry position mapping
- `backend/src/services/registryTOVAdapter.js` - Registry → TOV profession mapping
- `backend/src/services/fileVersioningService.js` - SHA256 hash-based file versioning
- `backend/src/services/timeNormsService.js` - AI days estimation
- `backend/src/services/exporter.js` - Excel export with Slate styling
- `backend/src/services/concreteExtractor.js` - Excel import parsing
- `frontend/src/pages/RegistryView.tsx` - Unified registry browse page (264 lines)
- `frontend/src/components/RelinkReportModal.tsx` - Relink confidence UI (393 lines)
- `frontend/src/components/UnifiedPositionModal.tsx` - Cross-kiosk position details
- `frontend/src/components/PositionsTable.tsx` - Main table
- `frontend/src/components/PartHeader.tsx` - OTSKP + catalog price display
- `frontend/src/styles/slate-table.css` - Slate design system (593 lines)

**Relink Algorithm (4-Step Confidence Ladder):**
```
1. PRIMARY (GREEN 100%) — Exact: sheet_name + position_no + catalog_code
2. FALLBACK (AMBER 75%) — Positional: sheet_index + row_index(±2) + catalog_code
3. FUZZY (AMBER/RED 50-75%) — Description similarity > 0.75 (string-similarity)
4. ORPHANED/NEW — Unmatched positions classified as removed or added
```

---

### 4. URS_MATCHER_SERVICE (Kiosk)

**Location:** `/URS_MATCHER_SERVICE`
**Technology:** Node.js, Express, SQLite
**Production URL:** `https://urs-matcher-service-3uxelthc4q-ey.a.run.app`
**Port (Dev):** Backend 3001, Frontend 3000

**Purpose:** Match BOQ (Bill of Quantities) descriptions to URS codes using AI.

**4-Phase Architecture:**
1. **Norms Search** - Fuzzy matching with `string-similarity`
2. **Multi-model LLM Routing** - Task-based model selection
3. **Knowledge Base** - Integration with concrete-agent Multi-Role API
4. **Learning System** - Knowledge accumulation

**NEW: Document Work Extraction Pipeline (2026-02-03)**
Complete pipeline for extracting work descriptions from PDF/DOCX documents:
```
PDF/DOCX → MinerU (Workflow C) → LLM Extraction → TSKP Matching → Deduplication → Batch URS Matching
```

Features:
- Upload PDF/DOCX documents via "Nahrát Dokumenty" block
- MinerU parsing via concrete-agent Workflow C API
- LLM work extraction (JSON structured + free-form fallback)
- TSKP code matching (64,737 classifier items)
- Deduplication (85% Levenshtein similarity)
- Display by construction sections (Zemní práce, Základy, etc.)
- Export to Excel (CSV with UTF-8 BOM)
- Send to Batch processor integration

**LLM Fallback Chain:**
```
Primary (env) → Claude → Gemini → OpenAI
Each provider gets its own AbortController!
Timeouts: LLM 90s, Perplexity 60s
```

**Key Files:**
- `backend/src/services/documentExtractionService.js` - Document extraction pipeline (520 lines)
- `backend/src/services/tskpParserService.js` - TSKP classifier (307 lines, 64,737 items)
- `backend/src/config/llmConfig.js` - LLM configuration
- `backend/src/services/llmClient.js` - LLM client with per-request fallback
- `backend/src/services/multiRoleClient.js` - CORE integration
- `backend/src/services/ursMatcher.js` - URS matching logic
- `backend/src/api/routes/jobs.js` - Job processing (includes document-extract endpoint)
- `frontend/public/components/DocumentUpload.html` - Extraction UI with stats cards
- `frontend/public/app.js` - Extraction handlers and display logic
- Tests: 159 tests passing

---

### 5. rozpocet-registry (Kiosk)

**Location:** `/rozpocet-registry`
**Technology:** React 19 + TypeScript 5.9 + Vite 7 (Browser-only, no backend)
**Port (Dev):** 5173
**Platform:** Static hosting (Vercel)
**Version:** 2.1.0

**Purpose:** Web application for managing, classifying, and searching BOQ (Bill of Quantities) items from construction budgets.

**Key Features:**
- **Excel Import** - Flexible .xlsx/.xls file parsing with configurable templates
- **Multi-Sheet Import** - Import multiple sheets per file, organized as Project → Sheets hierarchy
- **Excel-style Tab Navigation** - Project tabs + Sheet tabs with horizontal scrolling
- **Auto-Classification** - Rule-based classification into 10 work groups (uppercase codes)
- **AI Agent** - Autonomous classification system with AI on/off toggle
  - AI Mode: Cache → Rules → Memory → Gemini (learning system)
  - Rules-only Mode: Deterministic classification (no AI costs)
  - Learns from user corrections (Memory Store)
- **AI Classification Panel** - AI-assisted classification with cascading to description rows
- **Similarity Search** - Sparkles button for similar item matching
- **Fuzzy Search** - Multi-project search with Fuse.js (weighted: kod 40%, popis 30%)
- **Excel Export** - Export with HYPERLINK formulas, KPI formulas, Materials sheet
- **Price Request Panel** - Supplier quotation workflow
- **Custom Modal Component** - Opaque background, close on X only
- **Skupina Autocomplete** - Searchable dropdown for work group assignment
- **Browser Storage** - All data in localStorage via Zustand (no server required)

**Tech Stack:**
```
React 19.2 + TypeScript 5.9 + Vite 7.3
Tailwind CSS (Digital Concrete Design)
Zustand 5 (persistent store, 376 lines)
TanStack Table v8
SheetJS (xlsx) for Excel I/O
Fuse.js (fuzzy search)
Lucide React (icons)
idb (IndexedDB)
```

**Data Architecture: Project → Sheets → Items**
```typescript
// Project contains multiple sheets (from Excel import)
interface Project {
  id: string;
  name: string;
  sheets: Sheet[];        // Multiple sheets per project
  metadata: ProjectMetadata;
}

interface Sheet {
  name: string;           // Excel sheet name
  items: ParsedItem[];    // Items from that sheet
}

interface ParsedItem {
  id: string;             // UUID
  kod: string;            // Item code "231112"
  popis: string;          // Main description
  skupina: string | null; // Work group (ZEMNI_PRACE, BETON_MONOLIT, etc.)
  mnozstvi: number;       // Quantity
  cenaJednotkova: number; // Unit price
  cenaCelkem: number;     // Total price
  source: ItemSource;     // Source (project, sheet, row)
}
```

**Classification System (10 Work Groups):**
```
ZEMNI_PRACE    - Earthwork (výkopy, hloubění, pažení)
BETON_MONOLIT  - Cast-in-place concrete (betonáž, železobeton)
BETON_PREFAB   - Precast concrete (obrubníky, dílce, prefabrikát)
VYZTUŽ         - Reinforcement (výztuž, armatura, kari, pruty)
KOTVENI        - Anchoring (kotvy, injektáž)
BEDNENI        - Formwork (bednění, systémové)
PILOTY         - Piles (piloty, mikropiloty, vrtané)
IZOLACE        - Insulation (hydroizolace, geotextilie)
KOMUNIKACE     - Roads (vozovka, asfalt, chodník, dlažba)
DOPRAVA        - Transport (doprava betonu, odvoz zeminy)
```

**Scoring Algorithm:**
- +1.0 for each include keyword match
- -2.0 for each exclude keyword match (strong penalty)
- +0.5 for unit boost (matching m³, kg, etc.)
- +0.3 for priority conflict resolution (KOTVENI > VYZTUŽ, BETON_PREFAB > BETON_MONOLIT, DOPRAVA > BETON_MONOLIT)
- Diacritics normalization (výkop → vykop) for matching
- Confidence: `min(100, (score / 2.0) * 100)`

**Application Structure:**
```
rozpocet-registry/
├── api/                           (Vercel Serverless Functions)
│   ├── ai-agent.ts                (Unified AI endpoint)
│   ├── agent/                     (AI Agent modules)
│   │   ├── types.ts               (Shared TypeScript interfaces)
│   │   ├── rowpack.ts             (RowPack Builder)
│   │   ├── rules.ts               (Rules Layer - 11 classification rules)
│   │   ├── memory.ts              (Memory Store - learning from corrections)
│   │   ├── gemini.ts              (Gemini Connector)
│   │   ├── orchestrator.ts        (Decision Orchestrator)
│   │   ├── classify-rules-only.ts (Rules-only service)
│   │   └── README.md              (AI Agent documentation - 727 lines)
│   ├── group.ts                   (Group management API)
│   └── search.ts                  (Search API)
├── src/
│   ├── App.tsx                    (591 lines - main application)
│   ├── stores/
│   │   └── registryStore.ts       (376 lines - Zustand persistent store)
│   ├── types/
│   │   ├── project.ts             (Project/Sheet types)
│   │   ├── item.ts                (ParsedItem types)
│   │   ├── template.ts            (Import template types)
│   │   ├── search.ts              (Search types)
│   │   ├── export.ts              (Export types)
│   │   └── config.ts              (Config types)
│   ├── components/
│   │   ├── ai/AIPanel.tsx         (AI classification panel with toggle)
│   │   ├── items/ItemsTable.tsx   (Main data table + conflict indicators)
│   │   ├── items/SkupinaAutocomplete.tsx (Work group autocomplete)
│   │   ├── comparison/MonolitCompareDrawer.tsx (Side-by-side price comparison)
│   │   ├── search/SearchBar.tsx   (Fuzzy search UI)
│   │   ├── search/SearchResults.tsx (Results with highlighting)
│   │   ├── priceRequest/PriceRequestPanel.tsx (Supplier quotations)
│   │   ├── ui/Modal.tsx           (Custom modal component)
│   │   ├── import/                (Import wizard components)
│   │   ├── templates/             (Template management)
│   │   ├── config/                (Configuration components)
│   │   └── common/                (Shared components)
│   ├── services/
│   │   ├── classification/
│   │   │   ├── classificationService.ts (Classification wrapper)
│   │   │   └── classificationRules.ts   (336 lines - rule-based classifier)
│   │   ├── search/searchService.ts      (209 lines - Fuse.js search)
│   │   ├── export/excelExportService.ts (Excel export with hyperlinks + TOV formulas)
│   │   ├── parser/excelParser.ts        (Excel file parsing)
│   │   ├── autoDetect/autoDetectService.ts (Structure detection)
│   │   ├── pumpCalculator.ts            (Multi-supplier pump cost calculator, 149 lines)
│   │   ├── monolithPolling.ts           (Auto-polling Monolit 30s/120s, 186 lines)
│   │   ├── ai/                    (AI service integration)
│   │   ├── similarity/            (Similarity matching)
│   │   └── priceRequest/          (Price request service)
│   ├── data/
│   │   ├── concrete_prices.json   (2026 supplier concrete pricing, 83 entries)
│   │   └── pump_suppliers.json    (Pump rental pricing, 3 suppliers)
│   ├── utils/
│   │   └── constants.ts           (11 work group definitions)
│   └── config/                    (App configuration)
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── render.yaml
├── README.md                      (v2.1.0)
└── package.json
```

**7-Phase Architecture (All Complete):**
1. Design System - Digital Concrete Design System + TypeScript types
2. Template Selector - Import wizard with predefined templates
3. Custom Templates - User-configurable import mappings
4. Auto-Detection - Automatic Excel structure detection
5. Auto-Classification - Rule-based (10 uppercase codes, synced with Python YAML)
6. Multi-Project Search - Fuzzy search with Fuse.js
7. Excel Export - 3 sheets with HYPERLINK formulas

---

## Development Commands

### concrete-agent (CORE)
```bash
cd concrete-agent
npm install                    # Install all workspaces
npm run dev:backend            # Start FastAPI on :8000
npm run dev:frontend           # Start React on :5173
npm run test                   # Run pytest suite

# Run classifier tests
cd packages/core-backend
python app/classifiers/tests/test_work_classifier.py
```

### stavagent-portal
```bash
cd stavagent-portal
npm install
npm run dev                    # Start Express + React concurrently
```

### Monolit-Planner
```bash
cd Monolit-Planner
cd shared && npm install && npm run build && cd ..
cd backend && npm run dev      # Start Express on :3001
cd frontend && npm run dev     # Start React on :5173
```

### URS_MATCHER_SERVICE
```bash
cd URS_MATCHER_SERVICE
npm install
npm run dev                    # Start backend on :3001
```

### rozpocet-registry
```bash
cd rozpocet-registry
npm install
npm run dev                    # Start Vite on :5173
npm run build                  # Production build (tsc + vite)
npm run lint                   # ESLint check
```

---

## Development Conventions

### Commit Message Format
```
FEAT: Add new feature
FIX: Fix bug
REFACTOR: Refactor code
DOCS: Update documentation
STYLE: Style changes
TEST: Add tests
WIP: Work in progress (squash before merge)
```

Multi-line format for significant commits:
```
FEAT: Add multi-sheet import with Project tabs

Added support for importing multiple Excel sheets per file.
Projects now organized as Project → Sheets → Items hierarchy.

Changes:
- Created registryStore.ts with Zustand persistent state
- Refactored types to support Sheet[] within Project
- Added tab navigation for projects and sheets

Files:
- src/stores/registryStore.ts (NEW - 376 lines)
- src/types/project.ts (+50 lines)
- src/App.tsx (refactored)
```

### Branch Naming
```
claude/<task-description>-<random5chars>
```

### Git Hooks (Husky)
- **Pre-commit:** Runs 34 critical formula tests (~470ms)
- **Pre-push:** Validates branch naming + runs tests

### Design System
- **Web UI:** Slate Minimal Design (Tailwind Slate palette + Emerald/Amber/Sky semantics)
- **Excel Export:** Matching Slate colors with professional formatting
- **Portal:** Digital Concrete / Brutalist Neumorphism (monochrome + orange #FF9F1C)
- **Component naming:** BEM (`.c-btn`, `.c-panel`, `.c-card`)

### Key Technical Decisions
- **rozpocet-registry:** Browser-only (no backend), all state in Zustand + localStorage
- **Monolit-Planner:** PostgreSQL in production, SQLite in development
- **URS Matcher:** Per-request LLM fallback (no global state mutation)
- **concrete-agent:** Gemini as default LLM (40-250x cheaper than Claude)
- **Portal:** Central registry linking all kiosks via `portal_project_id`

---

## Environment Variables

### concrete-agent
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...              # Gemini (default LLM - FREE/cheap)
GEMINI_MODEL=gemini-2.5-flash-lite
MULTI_ROLE_LLM=gemini           # "gemini", "claude", "auto"
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
# Google Drive (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/google/callback
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=...
```

### Monolit-Planner
```env
NODE_ENV=production
PORT=3001
VITE_API_URL=https://monolit-planner-api-3uxelthc4q-ey.a.run.app
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app
```

### URS_MATCHER_SERVICE
```env
NODE_ENV=production
PORT=3001
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
LLM_TIMEOUT_MS=90000
STAVAGENT_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app
```

### stavagent-portal
```env
VITE_DISABLE_AUTH=true          # Disables authentication in production
```

---

## Quick Debugging

### URS Matcher: Empty Results
1. Check LLM timeout in `llmConfig.js` (should be 90s)
2. Check AbortController in `llmClient.js` (each provider needs own controller)
3. Check Multi-Role URL in `multiRoleClient.js` (concrete-agent-3uxelthc4q-ey.a.run.app)

### Monolit: Calculations Wrong
1. Check `concrete_m3` value in beton position
2. Check `unit_cost_on_m3 = cost_czk / concrete_m3`
3. Check KROS rounding: `Math.ceil(x / 50) * 50`

### Rozpočet Registry: Classification Not Working
1. Check `constants.ts` has all 10 uppercase work groups
2. Check `classificationRules.ts` scoring algorithm
3. Verify diacritics normalization (výkop → vykop)
4. Test: "VYKOP JAM" → ZEMNI_PRACE

### Rozpočet Registry: Old Group Names Appear
1. Clear browser localStorage: `localStorage.clear()`
2. Re-import Excel files (re-classify with new rules)

### CORE: Service Unavailable
1. Check Render deployment status
2. Check `/health` endpoint
3. Check API keys in environment

### PostgreSQL Connection Timeout (Render Free Tier)
- Root cause: DB sleeps after 15min inactivity
- Keep-Alive system available (GitHub Actions cron, see KEEP_ALIVE_SETUP.md)
- Solution: Configure `KEEP_ALIVE_KEY` secret in GitHub + Render

---

## CI/CD & Workflows

### GitHub Actions (`.github/workflows/`)
1. **keep-alive.yml** - Pings all services every 14 min (prevents Render sleep)
2. **monolit-planner-ci.yml** - Tests, linting, coverage for Monolit
3. **test-coverage.yml** - Code coverage analysis
4. **test-urs-matcher.yml** - 159 URS Matcher tests

### Deployment
- All services deploy on Render.com
- Each service has `render.yaml` with deployment config
- `autoDeploy: true` for automatic deployment on push

---

## Pending Work (Backlog)

### Awaiting User Action
1. **Registry Backend Deploy** (Render) - Deploy new `server.js` with graceful DB startup + bulk endpoint; Set `DATABASE_URL` env var
2. **Environment Variables** (Render) - `PERPLEXITY_API_KEY`, `OPENAI_API_KEY` for concrete-agent
3. **AI Suggestion Button** (Monolit) - Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Render DB shell
4. **Portal Backend Deploy** - Phase 8 DB migration (position_instance_id columns + 13 endpoints)
5. **Google Drive Setup** (optional) - Create Google Cloud project + OAuth2 credentials
6. **Keep-Alive Setup** (optional) - Add `KEEP_ALIVE_KEY` to GitHub + Render secrets

### Recently Completed (March 2-6)
- ✅ PERT 3-point estimation + Monte Carlo simulation (20 tests)
- ✅ Concrete maturity/curing model ČSN EN 13670 (21 tests)
- ✅ MaturityConfigPanel UI in FormworkCalculatorModal
- ✅ Registry Backend Sync: localStorage ↔ PostgreSQL (backendSync.ts + bulk endpoint)
- ✅ Registry health check fix (old + new response format support)
- ✅ Removed dead registryStoreAPI.ts
- ✅ Unified Registry Foundation (Weeks 1-4): DB migrations, 11 API endpoints, adapters
- ✅ Relink Algorithm (Weeks 7-9): 4-step confidence matching, 8.8x perf, UI modal
- ✅ Unified Registry Frontend (Weeks 5-6, 93%): RegistryView, filters, sorting, CSV export
- ✅ Multi-supplier pump calculator: 3 billing models, supplier comparison
- ✅ Time Norms Automation: AI days suggestion implementation
- ✅ Portal tabs/modal redesign: Master-Detail layout, Czech labels
- ✅ Document Passport optimization: 300s → 2-8s
- ✅ CORS fix + MinerU dependencies + Render Blueprint

### Technical Debt
- Node.js 18.x → 20.x upgrade (all services)
- npm security vulnerabilities (4 items)
- Document Accumulator: in-memory storage, no file size limits, no temp cleanup
- React Error Boundaries missing

### Feature Roadmap
- **Monolit Position Write-back** - Monolit → Portal position_instance_id sync
- **Registry DOV Write-back** - Registry TOV → Portal payload sync
- **Deep Links** - URL routing with ?position_instance_id=...
- **Universal Parser Phase 2** - Portal UI + bulk import
- URS Matcher Phase 2-4 (Document Parsing, Multi-Role, Optimization)
- Vitest migration for Monolit (better ESM support)

---

## Documentation Index

### Root Level
| File | Purpose |
|------|---------|
| `CLAUDE.md` | **THIS FILE** - System overview (v2.1.0) |
| `NEXT_SESSION.md` | Quick start commands + context for next session |
| `BACKLOG.md` | Pending tasks and priorities |
| `README.md` | Project overview (Russian) |
| `DESIGN_SYSTEM.md` | Digital Concrete design specification |
| `KEEP_ALIVE_SETUP.md` | Render Free Tier sleep prevention guide |
| `UNIFIED_ARCHITECTURE.md` | Portal-centric project integration |
| `UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md` | Detailed implementation plan (Weeks 1-9) |
| `render.yaml` | Render Blueprint deployment config |
| `docs/POSITION_INSTANCE_ARCHITECTURE.ts` | Two-level identity model (PositionInstance + PositionTemplate) v1.0 |
| `docs/MONOLIT_REGISTRY_INTEGRATION.md` | Monolit-Registry integration guide (Phase 1+2) |
| `docs/UNIFIED_REGISTRY_WEEKS_1-3_SUMMARY.md` | Unified Registry Foundation summary |
| `docs/WEEK_4_SUMMARY.md` | Week 4: Foundation complete (11 endpoints) |
| `docs/WEEK_5_PROGRESS.md` | Week 5: Frontend integration progress |
| `docs/WEEK_6_PROGRESS.md` | Week 6: Bulk selection + filters + sorting |
| `docs/WEEK_7-9_PROGRESS.md` | Weeks 7-9: Relink algorithm + conflict resolution |

### Service Documentation
| File | Purpose |
|------|---------|
| `concrete-agent/CLAUDE.md` | CORE system documentation (v2.4.1) |
| `Monolit-Planner/CLAUDE.MD` | Monolit kiosk documentation (v4.3.8) |
| `Monolit-Planner/TESTING_GUIDE.md` | Testing guide for Monolit |
| `Monolit-Planner/docs/TIME_NORMS_IMPLEMENTATION_STATUS.md` | Time Norms AI feature status |
| `Monolit-Planner/docs/FORMWORK_CALCULATOR_V3_ENHANCEMENT.md` | Formwork v3 improvements |
| `rozpocet-registry/README.md` | BOQ Registry overview (v2.1.0) |
| `rozpocet-registry/MULTI_SUPPLIER_PUMP_CALCULATOR.md` | Multi-supplier pump calculator docs |
| `rozpocet-registry-backend/TOV_PROFESSION_MAPPING.md` | TOV profession mapping guide |
| `docs/ARCHITECTURE.md` | Multi-kiosk architecture |
| `docs/STAVAGENT_CONTRACT.md` | API contracts between services |
| `docs/GOOGLE_DRIVE_API_ARCHITECTURE.md` | Google Drive technical spec |

### Session Summaries (Archived)
```
docs/archive/completed-sessions/
├── SESSION_2025-12-28.md
├── SESSION_2026-01-06.md
├── SESSION_2026-01-07.md
├── SESSION_2026-01-13_GOOGLE_DRIVE_DAY1.md
├── SESSION_2026-01-13_GOOGLE_DRIVE_DAY2.md
├── SESSION_2026-01-14_AUTH_FIX_AND_STATUS.md
├── SESSION_2026-01-16_MODAL_WORK_NAMES.md
└── SESSION_2026-01-16_PHASE6_7.md

rozpocet-registry/
└── SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md
```

---

## Session History (Summary)

| Date | Service | Key Changes | Commits |
|------|---------|-------------|---------|
| 2026-03-08 | Portal + Monolit | Session 8: Betonárny discovery (GPS search), AWS Bedrock integration, Objednávka betonu page (search+calculate+compare), lazy-load pages (-22% bundle), CORE proxy + all workflows fix, Universal Parser 4-step pipeline, kiosk import buttons, CorePanel inline styles rewrite, curing days fix (elementTotalDays→FormworkCalc) | 8 |
| 2026-03-07 | concrete-agent | PDF Price Parser module: 17 files, pdfplumber+OCR extractor, LLM classifier, 7 section parsers (regex+LLM), Pydantic models, API endpoint, 21 tests | 1 |
| 2026-03-07 | Monolit + Portal | PlannerPage (orchestrator UI), PumpCalculatorPage (mobile), Calendar date mapping, PortalBreadcrumb, ServiceCard activation | 5 |
| 2026-03-06 | Monolit + Registry + Portal | PERT/Maturity modules (41 tests), MaturityConfigPanel UI, Backend sync layer (localStorage↔PostgreSQL), bulk items endpoint, Portal cleanup | 8 |
| 2026-03-04 | Monolit + Registry | Weeks 7-9: Conflict Resolution UI (manual AMBER/RED matching) + Week 6: Bulk selection, advanced filters, sorting | 4 |
| 2026-03-03 | Monolit-Planner | Unified Registry Frontend (Weeks 5-6): RegistryView, sidebar routing, CSV export, cross-kiosk nav, sorting (93%) | 20+ |
| 2026-03-03 | Monolit-Planner | Relink Algorithm (Weeks 7-9): 4-step confidence matching, 8.8x optimization, RelinkReportModal UI, migration scripts | 15+ |
| 2026-03-03 | Monolit-Planner | Unified Registry Foundation (Weeks 1-4): 2 DB migrations, 11 API endpoints, 2 adapters, file versioning, security fixes | 10+ |
| 2026-03-03 | rozpocet-registry | Multi-supplier pump calculator (3 billing models) + practical pump performance data + TOV formulas in Excel export | 5 |
| 2026-03-02 | Monolit-Planner | Time Norms Automation complete + Monolit backend fixes (OTSKP 500, delete 404, sidebar refetch) | 5 |
| 2026-03-02 | rozpocet-registry | TOV profession mapping (Betonář/Tesař/Železář) for Monolit→Registry import | 2 |
| 2026-03-02 | stavagent-portal | Portal tabs + modal redesign: Služby/Projekty tabs, Master-Detail layout, Czech labels, CorePanel fix | 4 |
| 2026-03-02 | concrete-agent | Document Passport perf (300s→2-8s), robust KB loading, CORS fix, MinerU dependencies, brief_summarizer.py | 6 |
| 2026-03-02 | All | Render Blueprint config, region fix (Oregon→Frankfurt), MinerU installation guide, PR template update | 8 |
| 2026-03-01 | Monolit + Registry + Portal | Cross-kiosk project registry: KioskLinksPanel, auto-polling (30s/120s), MonolitCompareDrawer, conflict indicators | 10+ |
| 2026-02-27 | Monolit-Planner shared | RCPSP Element Scheduler: DAG + Kahn's topo sort + CPM + parallel scheme, 27 scheduler tests + 4 integration tests | 3 |
| 2026-02-27 | docs + Registry + Portal | Position Instance Architecture v1.0 (two-level identity model), Portal auto-link fix, PortalLinkBadge project picker v2, sleeping backend UX, Registry URL fixes | 2 |
| 2026-02-10 | Monolit + Registry + Portal | Monolit-Registry integration (Phase 1): Portal API, TOV mapping, unified storage | 1 |
| 2026-02-04 | stavagent-portal + rozpocet-registry | Portal fix (safeGetPool), Price editing, Section totals, Excel export fixes, Import preview, Unification audit | 10+ |
| 2026-01-26 | rozpocet-registry | Classification migration, multi-sheet import, Project→Sheets refactoring, AI panel, Excel-style tabs, tab navigation, autocomplete, modal, price request, export improvements | 20+ |
| 2026-01-21 | Portal + Monolit | R0 Deterministic Core, Unified Architecture, AI suggestion audit trail | 11 |
| 2026-01-16 | rozpocet-registry + Monolit | Phase 6+7 (search+export), Modal fixes, Editable work names, Resizable columns | 9 |
| 2026-01-13-14 | concrete-agent + Portal | Google Drive OAuth2 (backend+frontend), Auth fix, Parser fix | 8 PRs |
| 2026-01-12 | concrete-agent + Monolit | Doc Accumulator API fix, Keep-Alive system, OTSKP import, KPI header, Project deletion | 6 |
| 2026-01-08 | Monolit-Planner | OTSKP catalog price, Calculated Kč/m³, Object info display | 4 |
| 2026-01-07 | Monolit-Planner | Slate Minimal Design System (web+Excel), Font unification, Critical error fixes | 11 |
| 2025-12-29 | concrete-agent + Portal | Doc Accumulator enhanced (versions+export), Workflow C deployment fix | 3 |
| 2025-12-26 | Monolit + Portal | Time Norms Automation (AI days), Portal Services Hub, Digital Concrete Design | 3 |
| 2025-12-25 | All | Git Hooks (Husky), Production build fixes | 3 |
| 2025-12-23 | Monolit-Planner | Import/Bridge switch fix, Template removal, Excel export fix | 4 |
| 2025-12-19 | Monolit-Planner | Security fixes (SQL injection, JSON.parse), Speed column | 2 |
| 2025-12-16-18 | Monolit-Planner | Excel import fixes, PostgreSQL compatibility, UI fixes | 8 |
| 2025-12-11 | Monolit-Planner | VARIANT 1 Architecture (single universal object type) | 2 |
| 2025-12-10 | concrete-agent | Gemini Integration (40-250x cost savings) | 2 |
| 2025-12-09 | URS_MATCHER_SERVICE | Race condition fix, Stack overflow fix, Resource leaks, Provider cache | 4 |

---

**Last Updated:** 2026-03-07
**Maintained By:** Development Team
