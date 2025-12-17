# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 1.0.5
**Last Updated:** 2025-12-17
**Repository:** STAVAGENT (Monorepo)

**⭐ NEW (2025-12-17):** claude-mem Plugin Installation + PostgreSQL Timeout Analysis
**⭐ PREVIOUS (2025-12-16):** Excel Import Fixes - PostgreSQL compatibility, quantity detection scoring system
**⭐ PREVIOUS (2025-12-11):** VARIANT 1 Architecture Migration - Monolit-Planner Kiosk Simplified

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
POST /api/v1/multi-role/ask     ← Multi-Role AI validation
POST /api/upload                 ← File upload and parsing
POST /workflow/a/import          ← Workflow A processing
POST /workflow/b/analyze_drawing ← Drawing analysis
GET  /health                     ← Health check
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
- Kiosk routing (Monolit, URS Matcher, future kiosks)
- Chat assistant (StavAgent)
- CORE integration for audit results

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
- `backend/src/routes/positions.js` - Position CRUD
- `frontend/src/components/PositionsTable.tsx` - Main table
- `CLAUDE.MD` - Detailed kiosk documentation (v4.3.8)

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

## Current Status (2025-12-17)

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

**Last Updated:** 2025-12-17
**Maintained By:** Development Team

---

## 📖 Session Documentation

**Current Session (2025-12-17):** See `/NEXT_SESSION.md` for:
- PostgreSQL connection timeout analysis
- claude-mem plugin installation details
- Known issues awaiting paid tier upgrade

**Previous Sessions:**
- **2025-12-17:** Repository cleanup, render.yaml fixes, URL encoding, claude-mem hooks reinstallation
- **2025-12-16:** Excel Import Fixes, PostgreSQL compatibility
- **2025-12-11:** VARIANT 1 Architecture Migration
- **2025-12-10:** Gemini Integration (see `concrete-agent/GEMINI_SETUP.md`)
