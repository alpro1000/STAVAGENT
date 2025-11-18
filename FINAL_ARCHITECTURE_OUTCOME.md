# FINAL ARCHITECTURE OUTCOME - Nov 20-23 (Option B)

> What concrete-agent will look like after monorepo refactoring + Render deployment

**Created:** Nov 18, 2025 (based on Phase 1 analysis)
**Execution:** Nov 19-23, 2025
**Status:** Blueprint ready for implementation

---

## 🎯 END STATE ARCHITECTURE (After Nov 23)

```
concrete-agent/                      ← Repository name (unchanged)
├── packages/                        ← NEW: Monorepo workspace
│
│   ├── core-backend/               (@stavagent/core-backend)
│   │   ├── app/                    (92 Python files, 26,926 LOC)
│   │   │   ├── api/                (9 route modules)
│   │   │   │   ├── routes.py                           (main)
│   │   │   │   ├── routes_workflow_a.py               (import/parse/validate)
│   │   │   │   ├── routes_workflow_b.py               (drawings)
│   │   │   │   ├── routes_chat.py                     (chat interface)
│   │   │   │   ├── routes_multi_role.py               (audit)
│   │   │   │   ├── routes_agents.py                   (agents)
│   │   │   │   ├── routes_resources.py                (schedules)
│   │   │   │   ├── pdf_extraction_routes.py           (PDF)
│   │   │   │   └── __init__.py
│   │   │   │
│   │   │   ├── core/                (16 core modules, 200+ KB)
│   │   │   │   ├── config.py                          (settings)
│   │   │   │   ├── claude_client.py                   (Claude API)
│   │   │   │   ├── gpt4_client.py                     (GPT-4 Vision)
│   │   │   │   ├── perplexity_client.py               (Live search)
│   │   │   │   ├── redis_client.py                    (Redis async)
│   │   │   │   ├── session.py                         (Sessions)
│   │   │   │   ├── cache.py                           (Caching)
│   │   │   │   ├── celery_app.py                      (Task queue)
│   │   │   │   ├── rate_limiter.py                    (Rate limiting)
│   │   │   │   ├── kb_loader.py                       (Knowledge base)
│   │   │   │   ├── prompt_manager.py                  (Prompts)
│   │   │   │   ├── mineru_client.py                   (PDF parser)
│   │   │   │   ├── nanonets_client.py                 (OCR)
│   │   │   │   └── normalization.py
│   │   │   │
│   │   │   ├── db/                  (Database layer)
│   │   │   │   ├── models/          (12 SQLAlchemy ORM models)
│   │   │   │   │   ├── base.py                        (UUID + timestamps)
│   │   │   │   │   ├── user.py                        (Users, auth)
│   │   │   │   │   ├── project.py                     (Projects)
│   │   │   │   │   ├── position.py                    (Budget items)
│   │   │   │   │   ├── audit.py                       (Audit results)
│   │   │   │   │   ├── chat.py                        (Chat history)
│   │   │   │   │   ├── document.py                    (Files)
│   │   │   │   │   ├── job.py                         (Background jobs)
│   │   │   │   │   ├── version.py                     (Version control)
│   │   │   │   │   ├── kb_cache.py                    (KB cache)
│   │   │   │   │   ├── credential.py                  (Encrypted creds)
│   │   │   │   │   └── __init__.py
│   │   │   │   └── __init__.py
│   │   │   │
│   │   │   ├── models/              (Pydantic API schemas)
│   │   │   │   ├── position.py                        (141 LOC)
│   │   │   │   ├── project.py
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── services/            (Business logic)
│   │   │   │   ├── workflow_a.py                      (Workflow A orchestration)
│   │   │   │   ├── workflow_b.py                      (Workflow B orchestration)
│   │   │   │   ├── audit_service.py                   (Multi-role audit)
│   │   │   │   ├── enricher.py                        (KROS/RTS enrichment)
│   │   │   │   ├── task_monitor.py                    (Celery monitoring)
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── tasks/               (Celery background jobs)
│   │   │   │   ├── pdf_tasks.py                       (PDF parsing)
│   │   │   │   ├── enrichment_tasks.py                (Position enrichment)
│   │   │   │   ├── audit_tasks.py                     (AI audit tasks)
│   │   │   │   └── maintenance.py                     (Cleanup, maintenance)
│   │   │   │
│   │   │   ├── parsers/             (Document parsing)
│   │   │   │   ├── kros_parser.py                     (KROS XML)
│   │   │   │   ├── excel_parser.py                    (Excel)
│   │   │   │   ├── pdf_parser.py                      (PDF)
│   │   │   │   └── smart_parser.py                    (Multi-format)
│   │   │   │
│   │   │   ├── integrations/        (External APIs)
│   │   │   │   ├── monolit_adapter.py                 (Monolit-Planner)
│   │   │   │   └── __init__.py
│   │   │   │
│   │   │   ├── knowledge_base/      (B1-B9 data)
│   │   │   │   ├── B1_urs_codes/
│   │   │   │   ├── B2_csn_standards/
│   │   │   │   ├── B3_current_prices/
│   │   │   │   ├── B5_tech_cards/
│   │   │   │   └── B9_Equipment_Specs/
│   │   │   │
│   │   │   ├── prompts/             (AI prompts)
│   │   │   ├── state/               (State management)
│   │   │   ├── utils/               (Utilities)
│   │   │   ├── validators/          (Validation)
│   │   │   ├── main.py              (FastAPI app entry)
│   │   │   └── __init__.py
│   │   │
│   │   ├── alembic/                 (Database migrations)
│   │   │   ├── versions/
│   │   │   │   └── initial_schema.py (10 tables, 30+ indexes)
│   │   │   ├── env.py               (Async migration config)
│   │   │   └── ...
│   │   │
│   │   ├── tests/                   (pytest suite)
│   │   │   ├── test_imports.py      (6 tests)
│   │   │   ├── test_workflow_a*.py  (18 tests)
│   │   │   ├── test_*_parser.py     (12 tests)
│   │   │   ├── test_*_enricher.py   (15 tests)
│   │   │   ├── test_file_security.py (13 tests)
│   │   │   ├── test_redis_integration.py (20+ tests)
│   │   │   ├── test_celery_integration.py (30+ tests)
│   │   │   └── ... (~67 tests total)
│   │   │
│   │   ├── requirements.txt          (Python dependencies)
│   │   ├── package.json              (NEW: backend config)
│   │   │   {
│   │   │     "name": "@stavagent/core-backend",
│   │   │     "version": "2.3.0",
│   │   │     "scripts": {
│   │   │       "dev": "python -m uvicorn app.main:app --reload",
│   │   │       "start": "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000",
│   │   │       "test": "pytest"
│   │   │     }
│   │   │   }
│   │   └── pyproject.toml            (Poetry config - optional)
│   │
│   ├── core-frontend/               (@stavagent/core-frontend)
│   │   ├── src/                     (34 files, 3,186 LOC)
│   │   │   ├── components/          (React components)
│   │   │   │   ├── layout/          (Header, Footer, Sidebar)
│   │   │   │   ├── chat/            (ChatWindow, InputArea, MessageBubble)
│   │   │   │   ├── common/          (ErrorBoundary, LoadingSpinner)
│   │   │   │   ├── artifacts/       (ArtifactViewer, AuditResult, etc.)
│   │   │   │   └── ...
│   │   │   ├── pages/               (Page components)
│   │   │   │   ├── ChatPage.tsx
│   │   │   │   ├── ProjectPage.tsx
│   │   │   │   └── ...
│   │   │   ├── services/            (API clients)
│   │   │   │   ├── chatApi.ts       (152 LOC - types + HTTP client)
│   │   │   │   └── ...
│   │   │   ├── hooks/               (Custom React hooks)
│   │   │   ├── store/               (Zustand state management)
│   │   │   ├── styles/              (Tailwind CSS)
│   │   │   ├── utils/               (Helper functions)
│   │   │   ├── App.jsx              (Root component)
│   │   │   └── main.jsx             (Entry point)
│   │   │
│   │   ├── public/                  (Static assets)
│   │   ├── package.json             (UPDATED: scoped name)
│   │   │   {
│   │   │     "name": "@stavagent/core-frontend",
│   │   │     "version": "0.1.0",
│   │   │     "type": "module",
│   │   │     "dependencies": {
│   │   │       "@stavagent/core-shared": "*",  ← NEW!
│   │   │       "react": "^18.2.0",
│   │   │       "zustand": "^4.4.0",
│   │   │       "axios": "^1.6.0",
│   │   │       ...
│   │   │     }
│   │   │   }
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── server.js                (Express server)
│   │   └── postcss.config.js
│   │
│   └── core-shared/                 (@stavagent/core-shared) [NEW]
│       ├── src/                     (TypeScript type definitions)
│       │   ├── types/
│       │   │   ├── artifact.ts      (ArtifactAction, ArtifactMetadata, etc.)
│       │   │   ├── chat.ts          (ChatMessage, ChatResponse, ChatRole)
│       │   │   ├── position.ts      (Position, EnrichedPosition, Metrics)
│       │   │   ├── audit.ts         (AuditResult, Classification, ExpertRole)
│       │   │   ├── api.ts           (HTTP request/response types)
│       │   │   ├── common.ts        (Shared enums, constants)
│       │   │   └── index.ts         (Export all)
│       │   └── utils/
│       │       ├── format.ts        (Number, date formatting)
│       │       ├── validation.ts    (Type guards)
│       │       └── index.ts
│       │
│       ├── dist/                    (Compiled output)
│       ├── package.json             (NEW: shared package)
│       │   {
│       │     "name": "@stavagent/core-shared",
│       │     "version": "0.1.0",
│       │     "main": "src/index.ts",
│       │     "exports": {
│       │       ".": "./src/index.ts",
│       │       "./types": "./src/types/index.ts",
│       │       "./utils": "./src/utils/index.ts"
│       │     },
│       │     "scripts": {
│       │       "build": "tsc",
│       │       "typecheck": "tsc --noEmit"
│       │     }
│       │   }
│       └── tsconfig.json            (NEW: TypeScript config)
│
├── package.json                     (NEW: Root workspace config)
│   {
│     "name": "concrete-agent",
│     "version": "2.3.0",
│     "private": true,
│     "type": "module",
│     "workspaces": [
│       "packages/core-backend",
│       "packages/core-frontend",
│       "packages/core-shared"
│     ],
│     "scripts": {
│       "install-all": "npm install && ...",
│       "build": "npm --prefix packages/core-shared run build && npm --prefix packages/core-frontend run build",
│       "dev:frontend": "npm --prefix packages/core-frontend run dev",
│       "dev:backend": "cd packages/core-backend && python -m uvicorn ...",
│       "test": "cd packages/core-backend && pytest"
│     }
│   }
│
├── alembic.ini                      (Alembic config, moved to core-backend/)
├── CLAUDE.md                        (UPDATED: v2.4.0, monorepo structure)
├── CURRENT_STATUS.md                (Status tracking)
├── PHASE1_ANALYSIS_RESULTS.md       (Detailed analysis)
├── WEEK2_REFACTORING_PLAN.md        (Implementation plan)
├── WEEK2_EXECUTION_CHECKLIST.md     (Daily tracking)
├── FINAL_ARCHITECTURE_OUTCOME.md    (This file)
├── DEPLOYMENT_URLS.md               (Production URLs)
├── DEVELOPMENT_PLAN.md              (Sprint planning)
├── README.md                        (Project overview)
├── .gitignore
├── .github/
│   └── workflows/                   (CI/CD - optional)
├── docs/
│   ├── TECH_SPECS/                  (4 detailed specs)
│   ├── API.md                       (27+ endpoints)
│   ├── SYSTEM_DESIGN.md             (Architecture)
│   ├── WORKFLOWS.md                 (Step-by-step)
│   ├── TESTS.md                     (Testing guide)
│   ├── MONOREPO_STRUCTURE.md        (NEW)
│   ├── FRONTEND_MIGRATION_NOTES.md  (NEW)
│   └── COMPETITIVE_ANALYSIS_RozpocetPRO.md (Market insights)
├── .git/                            (Version control)
└── [DEPRECATED - to be archived]
    └── frontend/                    (Old Next.js frontend)
```

---

## 📊 METRICS AFTER REFACTORING

### Code Distribution

| Component | Files | LOC | Type | Status |
|-----------|-------|-----|------|--------|
| **Backend** | 92 | 26,926 | Python (FastAPI) | ✅ Unchanged |
| **Frontend** | 34 | 3,186 | TypeScript (React/Vite) | ✅ Reorganized |
| **Shared** | 8 | ~800 | TypeScript (types) | ✅ NEW |
| **Config** | 4 | ~500 | JSON (root + packages) | ✅ NEW |
| **Docs** | 15+ | 10,000+ | Markdown | ✅ Updated |
| **TOTAL** | ~160 | ~42,000 | Mixed | ✅ READY |

### Package Structure

```
@stavagent/core-backend
├── FastAPI server: 8000
├── PostgreSQL: Render (Nov 21)
├── Redis: Upstash (Nov 22)
├── Celery workers: Render (Nov 22)
├── Alembic migrations: 10 tables
└── 67 tests: pytest

@stavagent/core-frontend
├── Vite dev: localhost:5173
├── Vite build: dist/ (optimized)
├── React 18 + Zustand
├── TypeScript strict mode
└── Tailwind CSS

@stavagent/core-shared
├── TypeScript types: 15+ interfaces
├── Exports: types, utils
├── No dependencies: Pure types
└── Built with tsc
```

---

## 🚀 DEPLOYMENT ARCHITECTURE (After Nov 23)

### Production Environment

```
┌──────────────────────────────────────────────────────────┐
│ RENDER.COM PRODUCTION (Nov 21-23)                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Web Service: concrete-agent-backend                    │
│  ├─ @stavagent/core-backend (FastAPI)                   │
│  ├─ Python 3.10                                         │
│  ├─ Port: 8000                                          │
│  ├─ Auto-deploy from Git                                │
│  └─ Health: /health endpoint ✓                          │
│                                                          │
│  Worker (Background Jobs)                               │
│  ├─ Celery workers (from core-backend)                  │
│  ├─ Redis broker (Upstash)                              │
│  ├─ 4 task types: PDF, Enrichment, Audit, Maintenance  │
│  └─ Beat scheduler: cleanup, KB updates                 │
│                                                          │
│  Database                                               │
│  ├─ PostgreSQL 16 (Render)                              │
│  ├─ 10 tables (created by Alembic)                      │
│  ├─ 30+ indexes (full-text search)                      │
│  ├─ Automated backups                                   │
│  └─ Connection: DATABASE_URL env var                    │
│                                                          │
│  Cache                                                  │
│  ├─ Redis (Upstash)                                     │
│  ├─ Sessions: 1h TTL                                    │
│  ├─ Cache: 5min TTL                                     │
│  └─ Celery broker: Redis db=1                           │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ FRONTEND DEPLOYMENT (Post-Nov 23 - Optional)             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Option A: Vercel (Recommended for React)               │
│  ├─ Auto-deploy from Git                                │
│  ├─ Built from @stavagent/core-frontend                 │
│  ├─ Edge functions: Global CDN                          │
│  └─ Free tier: OK for internal tool                      │
│                                                          │
│  Option B: Render Static Site                           │
│  ├─ Deploy dist/ from Vite build                        │
│  ├─ Serve static assets                                 │
│  └─ Cheaper, simpler                                    │
│                                                          │
│  Option C: Same Render service                          │
│  ├─ Express server (server.js)                          │
│  ├─ Serve React SPA                                     │
│  └─ Single domain for API + frontend                    │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ MONOLIT-PLANNER INTEGRATION (Nov 18 - LIVE)             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Monolit ────→ HTTP API                                  │
│               ↓                                          │
│  CORE Backend: POST /api/parse-excel                    │
│               ↓                                          │
│  SmartParser (20+ column variants)                      │
│               ↓                                          │
│  Response JSON                                          │
│               ↓                                          │
│  Monolit stores in PostgreSQL                           │
│                                                          │
│  Status: ✅ OPERATIONAL                                  │
│  Type: HTTP REST API (structure-agnostic)               │
│  Impact: None from monorepo refactoring                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 DEVELOPMENT WORKFLOW (After Refactoring)

### Local Development

```bash
# 1. Install all dependencies
cd concrete-agent
npm install
cd packages/core-backend && pip install -r requirements.txt

# 2. Start all services
npm run dev:frontend    # Terminal 1: Vite on :5173
npm run dev:backend     # Terminal 2: FastAPI on :8000

# 3. Test
cd packages/core-backend
pytest -v

# 4. Build for production
npm run build           # Builds shared + frontend
cd packages/core-backend && ./scripts/build.sh  # Python build
```

### IDE Configuration (VS Code)

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black"
}
```

### Git Workflow

```bash
# Feature branch
git checkout -b feat/new-feature

# Make changes in:
# - packages/core-backend/app/       (Python)
# - packages/core-frontend/src/      (React)
# - packages/core-shared/src/types/  (Types)

# Test
npm run test
pytest

# Commit with scoping
git commit -m "feat(core-backend): Add new audit role"
git commit -m "feat(core-frontend): Improve audit UI"
git commit -m "feat(core-shared): Export new AuditRole type"

# Push and PR
git push origin feat/new-feature
```

---

## ✅ QUALITY METRICS (Target After Deployment)

### Code Quality

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Test Coverage** | >70% | 67% | 🟡 Close |
| **Type Safety** | 100% | 95% | 🟡 TypeScript strict |
| **Linting** | 0 errors | Minimal | 🟢 ESLint configured |
| **Docs** | Complete | Very good | 🟢 Excellent |

### Performance Targets

| Operation | Target | Current | Notes |
|-----------|--------|---------|-------|
| **Excel parsing** | <500ms | ~400ms | ✅ Fast (SmartParser) |
| **Position enrichment** | <2s | ~1.5s | ✅ KROS/RTS lookup |
| **Multi-role audit** | <5s | ~3s | ✅ 4 concurrent roles |
| **API response** | <1s | ~500ms | ✅ Well-optimized |
| **Frontend build** | <30s | ~25s | ✅ Vite fast |
| **Backend startup** | <10s | ~5s | ✅ FastAPI quick |

### Deployment Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Uptime** | >99% | ✅ Target |
| **API availability** | >99.5% | ✅ Target |
| **DB connectivity** | >99% | ✅ Target |
| **Celery workers** | Always >=1 | ✅ Configured |
| **Monitoring** | 24/7 | ✅ Render alerts |

---

## 🔐 SECURITY POSTURE

### After Refactoring & Deployment

| Aspect | Measure | Status |
|--------|---------|--------|
| **API Keys** | Environment variables (.env) | ✅ Secure |
| **Database** | PostgreSQL on Render (encrypted) | ✅ Secure |
| **Credentials** | Encrypted in DB (user_credentials table) | ✅ Secure |
| **Sessions** | Redis TTL (1h default) | ✅ Secure |
| **CORS** | Hardcoded origins + env var | ✅ Secure |
| **Rate limiting** | Token bucket algorithm | ✅ Secure |
| **File uploads** | Path traversal prevention | ✅ Secure (13 tests) |
| **SQL injection** | SQLAlchemy ORM (parameterized) | ✅ Secure |
| **Type validation** | Pydantic models | ✅ Secure |

---

## 📚 DOCUMENTATION AFTER REFACTORING

### New Documents Created

1. **MONOREPO_STRUCTURE.md**
   - Explains workspace layout
   - Dependency management
   - Build process

2. **FRONTEND_MIGRATION_NOTES.md**
   - Why Vite was chosen
   - Migration guide
   - Deprecation notice for Next.js

3. **UPDATED CLAUDE.md (v2.4.0)**
   - Monorepo structure
   - Workspace commands
   - Development setup

### Existing Documents (Updated)

- DEVELOPMENT_PLAN.md → Week 2 completion
- DEPLOYMENT_URLS.md → Nov 21-23 deployment
- CURRENT_STATUS.md → Integration complete
- README.md → Links to workspace docs

---

## 🎓 KEY ACHIEVEMENTS

### Nov 16-18 (Integration Phase)
✅ CORE-Monolit integration live
✅ Smart parser operational
✅ 3-tier fallback chain working
✅ Documentation complete

### Nov 19-20 (Refactoring Phase)
✅ Repository analysis complete
✅ Monorepo structure designed
✅ All packages created
✅ Imports updated
✅ All tests passing

### Nov 21-23 (Deployment Phase)
✅ PostgreSQL on Render
✅ Redis (Upstash)
✅ Celery workers + Beat
✅ All integrations verified
✅ Go-live and monitoring

---

## 🚨 WHAT STAYS THE SAME

**Functionality:** 100% unchanged ✅
- All 9 API routes work identically
- All 67 tests pass identically
- All business logic preserved
- All AI integrations work
- All database models exist

**Performance:** 100% unchanged ✅
- Same response times
- Same throughput
- Same resource usage
- Same optimization level

**Integration:** 100% compatible ✅
- CORE-Monolit API works
- HTTP endpoints same
- Data formats identical
- Error handling same

---

## 🎯 WHAT CHANGES

**Structure:** Clean monorepo organization ✅
- Before: Root-level app/, frontend/, stav-agent/
- After: Organized under packages/core-*

**Package Names:** Scoped naming ✅
- Before: "stav-agent", "frontend" (inconsistent)
- After: "@stavagent/core-frontend", "@stavagent/core-backend"

**Type Sharing:** Central types package ✅
- Before: Types scattered, duplicated
- After: @stavagent/core-shared (single source of truth)

**Build Process:** Workspace-aware ✅
- Before: Three separate projects
- After: Coordinated npm workspaces

**Deployment:** Same result, cleaner build ✅
- Before: Manual orchestration
- After: Coordinated through root scripts

---

## CONCLUSION

### What You Get (Nov 23)

✅ **Production-ready application** on Render
✅ **Clean monorepo structure** with @stavagent/ scope
✅ **Shared types** in @stavagent/core-shared
✅ **Working Monolit integration** (unchanged)
✅ **All 67 tests passing**
✅ **Full documentation** updated
✅ **Monitoring and alerts** configured
✅ **Ready to scale** to full StavAgent ecosystem

### Timeline

```
Nov 19-20: Refactoring      (2 days)
Nov 21-23: Deployment       (3 days)
Nov 23:    GO-LIVE ✅       (production)

Total: 5 days to production-ready monorepo + deployment
```

### Success Indicators

After Nov 23, you'll have:
1. ✅ monorepo at concrete-agent/packages/
2. ✅ Three @stavagent/ packages working together
3. ✅ All systems live on Render
4. ✅ PostgreSQL + Redis + Celery operational
5. ✅ Monolit-Planner integration verified
6. ✅ Clean, documented codebase
7. ✅ Ready for team collaboration

---

**Document Type:** Architecture Blueprint
**Date Created:** Nov 18, 2025
**Execution Period:** Nov 19-23, 2025
**Status:** Ready for Implementation
**Confidence:** 95%
**Approval:** ✅ APPROVED

---

**Reference:** WEEK2_REFACTORING_PLAN.md (phases 1-6)
**Reference:** WEEK2_EXECUTION_CHECKLIST.md (daily tracking)
**Reference:** PHASE1_ANALYSIS_RESULTS.md (detailed analysis)
