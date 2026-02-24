# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 2.0.7
**Last Updated:** 2026-02-24
**Repository:** STAVAGENT (Monorepo)

---

## Recent Activity

| Date | Service | Summary | Status |
|------|---------|---------|--------|
| 2026-02-24 | rozpocet-registry | R0 Pump Calculator v2: realistic Beton Union 2026 pricing model (hourly + km + accessories) | ✅ Pushed |
| 2026-02-24 | rozpocet-registry | R0 Pump Calculator v1: initial pump rental section in MachineryTab | ✅ Pushed |
| 2026-02-24 | rozpocet-registry | FIX: Bot review — TOVModal formwork auto-save race condition, stale closure, isAutoSaving ref | ✅ Pushed |
| 2026-02-24 | rozpocet-registry | FIX: TOVModal FormworkRentalSection — auto-persist rows (useRef isAutoSaving) | ✅ Pushed |
| 2026-02-18 | stavagent-portal | Universal Parser Phase 1: parse Excel once, serve filtered data per kiosk (monolit/registry/urs_matcher) | ✅ Pushed |
| 2026-02-18 | rozpocet-registry | Fix TS build errors in FormworkRentalCalculator (imports, interface) | ✅ Pushed |
| 2026-02-10 | Monolit + Registry + Portal | Monolit-Registry integration via Portal API (Phase 1): 3 endpoints, TOV mapping, unified storage | ✅ PR Created |
| 2026-02-10 | stavagent-portal | Portal production fixes: timeout 300s, CORS, file input modal, API endpoint | ✅ Pushed |
| 2026-02-10 | URS_MATCHER_SERVICE | Batch processing diagnosis: identified Perplexity API requirement (2-API architecture) | 📋 Analysis |
| 2026-02-09 | Monolit + Registry | Inter-kiosk data transfer via postMessage (Monolit → Registry) | ✅ Pushed |
| 2026-02-09 | rozpocet-registry | Export-to-original rewrite: JSZip direct XML patching (no XLSX.write) | ✅ Pushed |
| 2026-02-09 | stavagent-portal | Public landing page for stavagent.cz (no auth) | ✅ Pushed |

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

| Service | URL |
|---------|-----|
| concrete-agent (CORE) | https://concrete-agent.onrender.com |
| stavagent-portal | https://stav-agent.onrender.com |
| Monolit-Planner Frontend | https://monolit-planner-frontend.onrender.com |
| Monolit-Planner API | https://monolit-planner-api.onrender.com |
| URS_MATCHER_SERVICE | https://urs-matcher-service.onrender.com |
| Rozpočet Registry | Static hosting (Vercel) |

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
POST https://concrete-agent.onrender.com/workflow/a/import
Content-Type: multipart/form-data

# Portal → Kiosk
POST https://kiosk-url/import
Content-Type: application/json
{ projectId, projectName, positions[] }

# Kiosk → concrete-agent (Multi-Role)
POST https://concrete-agent.onrender.com/api/v1/multi-role/ask
Content-Type: application/json
{ role, question, context }
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
GEMINI_MODEL=gemini-2.0-flash-exp
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
- `packages/core-backend/app/core/config.py` - Configuration

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

**Database Tables:**
```sql
portal_projects, portal_files, kiosk_links, chat_sessions, chat_messages, users
```

**Key API Endpoints:**
```
POST /api/portal/projects              ← Create project
GET  /api/portal/projects              ← List projects
POST /api/portal/projects/:id/files    ← Upload file
POST /api/portal/projects/:id/core/submit ← Send to CORE
GET  /api/portal-projects/:id/unified  ← Aggregated data from all linked kiosks
POST /api/portal-projects/:id/link-kiosk ← Link kiosk project to portal
```

**Key Files:**
- `backend/src/routes/portal-projects.js` - Project management
- `backend/src/routes/auth.js` - Authentication
- `frontend/src/components/portal/ProjectAudit.tsx` - Workflow C UI
- `frontend/src/components/portal/ProjectDocuments.tsx` - Document Accumulator UI
- `frontend/src/components/portal/ServiceCard.tsx` - Services Hub cards
- `frontend/src/pages/PortalPage.tsx` - Portal landing page

**Design System:** Digital Concrete / Brutalist Neumorphism
- Monochrome palette + orange accent (#FF9F1C)
- BEM naming: `.c-btn`, `.c-panel`, `.c-card`, `.c-input`
- Files: `/DESIGN_SYSTEM.md`, `tokens.css`, `components.css`

---

### 3. Monolit-Planner (Kiosk)

**Location:** `/Monolit-Planner`
**Technology:** Node.js 20.x, Express, React, PostgreSQL (prod) / SQLite (dev)
**Production URL:** `https://monolit-planner-frontend.onrender.com`
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

**Structure:**
```
Monolit-Planner/
├── shared/        (formulas.ts + 34 tests)
├── backend/       (Express API, PostgreSQL/SQLite)
├── frontend/      (React + TypeScript, 45+ components)
├── CLAUDE.MD      (Detailed documentation v4.3.8)
└── render.yaml
```

**Key Files:**
- `shared/src/formulas.ts` - All calculation formulas
- `backend/src/routes/positions.js` - Position CRUD + Time Norms API
- `backend/src/services/timeNormsService.js` - AI days estimation
- `backend/src/services/exporter.js` - Excel export with Slate styling
- `backend/src/services/concreteExtractor.js` - Excel import parsing
- `frontend/src/components/PositionsTable.tsx` - Main table
- `frontend/src/components/PartHeader.tsx` - OTSKP + catalog price display
- `frontend/src/styles/slate-table.css` - Slate design system (593 lines)

---

### 4. URS_MATCHER_SERVICE (Kiosk)

**Location:** `/URS_MATCHER_SERVICE`
**Technology:** Node.js, Express, SQLite
**Production URL:** `https://urs-matcher-service.onrender.com`
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
│   │   ├── items/ItemsTable.tsx   (Main data table)
│   │   ├── items/SkupinaAutocomplete.tsx (Work group autocomplete)
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
│   │   ├── export/excelExportService.ts (Excel export with hyperlinks)
│   │   ├── parser/excelParser.ts        (Excel file parsing)
│   │   ├── autoDetect/autoDetectService.ts (Structure detection)
│   │   ├── ai/                    (AI service integration)
│   │   ├── similarity/            (Similarity matching)
│   │   └── priceRequest/          (Price request service)
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
GEMINI_MODEL=gemini-2.0-flash-exp
MULTI_ROLE_LLM=gemini           # "gemini", "claude", "auto"
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
# Google Drive (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent.onrender.com/api/v1/google/callback
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=...
```

### Monolit-Planner
```env
NODE_ENV=production
PORT=3001
VITE_API_URL=https://monolit-planner-api.onrender.com
CORS_ORIGIN=https://monolit-planner-frontend.onrender.com
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
STAVAGENT_API_URL=https://concrete-agent.onrender.com
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
3. Check Multi-Role URL in `multiRoleClient.js` (concrete-agent.onrender.com)

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
1. **AI Suggestion Button** (Monolit) - Execute `БЫСТРОЕ_РЕШЕНИЕ.sql` in Render DB shell
2. **R0 + Unified Architecture PR** - Review and merge `claude/portal-audit-improvements-8F2Co`
3. **Google Drive Setup** (optional) - Create Google Cloud project + OAuth2 credentials
4. **Keep-Alive Setup** (optional) - Add `KEEP_ALIVE_KEY` to GitHub + Render secrets

### Technical Debt
- Node.js 18.x → 20.x upgrade (all services)
- npm security vulnerabilities (4 items)
- Document Accumulator: in-memory storage, no file size limits, no temp cleanup
- React Error Boundaries missing
- CI/CD: Add npm caching, Dependency Review Action

### Feature Roadmap
- **Monolit-Registry Integration Phase 2** - Auto-sync TOV, bi-directional sync, conflict resolution
- URS Matcher Phase 2-4 (Document Parsing, Multi-Role, Optimization)
- Vitest migration for Monolit (better ESM support)
- Czech label mapping for rozpocet-registry work groups (UX enhancement)
- Data migration for users with old Czech group names in localStorage

---

## Documentation Index

### Root Level
| File | Purpose |
|------|---------|
| `CLAUDE.md` | **THIS FILE** - System overview (v2.0.0) |
| `NEXT_SESSION.md` | Quick start commands + context for next session |
| `BACKLOG.md` | Pending tasks and priorities |
| `README.md` | Project overview (Russian) |
| `DESIGN_SYSTEM.md` | Digital Concrete design specification |
| `KEEP_ALIVE_SETUP.md` | Render Free Tier sleep prevention guide |
| `UNIFIED_ARCHITECTURE.md` | Portal-centric project integration |
| `docs/MONOLIT_REGISTRY_INTEGRATION.md` | Monolit-Registry integration guide (Phase 1) |

### Service Documentation
| File | Purpose |
|------|---------|
| `concrete-agent/CLAUDE.md` | CORE system documentation (v2.4.1) |
| `Monolit-Planner/CLAUDE.MD` | Monolit kiosk documentation (v4.3.8) |
| `rozpocet-registry/README.md` | BOQ Registry overview (v2.1.0) |
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

**Last Updated:** 2026-02-04
**Maintained By:** Development Team
