# CLAUDE.md - STAVAGENT System Context

> **IMPORTANT:** Read this file at the start of EVERY session to understand the full system architecture.

**Version:** 1.0.0
**Last Updated:** 2025-12-06
**Repository:** STAVAGENT (Monorepo)

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

## Current Status (2025-12-06)

### Recent Commits (URS_MATCHER_SERVICE)
| Commit | Description |
|--------|-------------|
| `1d00228` | FIX: Connect Multi-Role to concrete-agent.onrender.com |
| `4e11afa` | FEAT: Add local Multi-Role validation (fallback) |
| `517fe95` | FIX: LLM timeout 30s→90s + AbortController bug |

### Known Issues Fixed
1. **LLM Timeout:** Increased from 30s to 90s
2. **AbortController Bug:** Each provider now gets its own controller
3. **Multi-Role Connection:** Changed from localhost to production URL

### Tests
- URS_MATCHER_SERVICE: 108 tests passing
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
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
```

---

**Last Updated:** 2025-12-06
**Maintained By:** Development Team
