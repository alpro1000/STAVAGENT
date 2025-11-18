# WEEK 2 REFACTORING PLAN - Option B (Nov 19-23)

> Monorepo Refactoring + Render Deployment

**Version:** 1.0.0
**Start Date:** Nov 19, 2025
**Status:** Ready to Execute

---

## 🎯 Executive Summary

**Goal:** Transform concrete-agent into production-ready monorepo with clean @stavagent scope before deploying to Render.

**Timeline:**
- **Nov 19-20**: Monorepo refactoring (Phases 1-5)
- **Nov 21-22**: Deploy refactored version to Render
- **Nov 23**: Final integration testing + Go-live

**Key Decisions Made:**
- ✅ Keep repository name: `concrete-agent`
- ✅ Frontend: **Vite** (from `/stav-agent`, fast for internal tool)
- ✅ Package scope: **@stavagent/core-***
- ✅ Path: Option B (proper architecture first)

---

## 📊 Current Structure Analysis (Nov 18)

### Current Layout

```
concrete-agent/
├── app/                          (FastAPI backend - Python)
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── parsers/
│   ├── services/
│   ├── tasks/
│   └── main.py
├── frontend/                     (Next.js - NOT recommended)
│   ├── src/
│   └── package.json (name: "frontend", Next.js)
├── stav-agent/                   (Vite - RECOMMENDED)
│   ├── src/
│   ├── public/
│   └── package.json (name: "stav-agent", Vite)
├── alembic/                      (DB migrations)
├── tests/                        (Python tests)
├── requirements.txt              (Python dependencies)
├── CLAUDE.md
├── CURRENT_STATUS.md
└── No root package.json (NOT a monorepo yet)
```

### Issues Identified

| Issue | Current State | Target State |
|-------|---------------|--------------|
| **Package naming** | `frontend`, `stav-agent` | `@stavagent/core-frontend`, `@stavagent/core-backend` |
| **Root config** | No root package.json | Root with workspaces |
| **Shared types** | Scattered | Centralized in `@stavagent/core-shared` |
| **Frontend** | Two versions (Next.js + Vite) | Single: Vite in `/packages/core-frontend` |
| **Import paths** | Relative paths | Absolute scoped paths |
| **Project structure** | Not organized for monorepo | Organized by layer (backend, frontend, shared) |

---

## 🚀 Phase-by-Phase Plan

### PHASE 1: Analysis (Nov 19, 9:00-12:00) ✏️

**Objective:** Complete inventory of structure, imports, types

#### Step 1.1: Frontend Analysis (30 min)

```bash
# Check both frontends
cat concrete-agent/frontend/package.json
cat concrete-agent/stav-agent/package.json

# Count lines
wc -l concrete-agent/frontend/src/**/*.{tsx,ts,jsx,js}
wc -l concrete-agent/stav-agent/src/**/*.{tsx,ts,jsx,js}

# Find imports in each
grep -r "import.*from" concrete-agent/frontend/src | head -20
grep -r "import.*from" concrete-agent/stav-agent/src | head -20

# Check if they share components
ls -la concrete-agent/frontend/src/components/
ls -la concrete-agent/stav-agent/src/components/
```

**Decision Point:** Which frontend is in production?
- [ ] Check DEPLOYMENT_URLS.md
- [ ] Check GitHub Actions/CI-CD
- [ ] Ask: Which one is actively used?

**Recommendation:** Use **Vite (stav-agent)**
- ✅ Simpler (SPA vs SSR)
- ✅ Better for internal tools
- ✅ Faster build times
- ✅ No database required

#### Step 1.2: Backend Analysis (20 min)

```bash
# Python structure
tree -L 2 concrete-agent/app/

# Count Python lines
find concrete-agent/app -name "*.py" | xargs wc -l | tail -1

# Find all imports from app
grep -r "^from app\." concrete-agent/app/ | cut -d: -f2 | sort | uniq | head -20

# Check internal imports
grep -r "^import app\." concrete-agent/tests/ | cut -d: -f2 | sort | uniq
```

**Result:** Confirm all imports are relative/absolute

#### Step 1.3: Shared Type Inventory (20 min)

```bash
# Find TypeScript types/interfaces
find concrete-agent/frontend concrete-agent/stav-agent -name "*.ts" -o -name "*.tsx" \
  | xargs grep "^interface\|^type\|^export.*interface\|^export.*type" \
  | head -30

# Identify common types
# (Position, AuditResult, EnrichmentResult, etc.)
```

**Expected:** List of 10-20 types that should be shared

#### Step 1.4: Documentation (10 min)

Create file: `PHASE1_ANALYSIS_RESULTS.md`

```markdown
# Phase 1 Analysis Results

## Frontend Decision
- [ ] Next.js (frontend/) - Active? Dev only? Deprecated?
- [ ] Vite (stav-agent/) - Active? Production?
- **Decision:** Use Vite (stav-agent/)

## Backend Structure
- Files: X
- Modules: X
- Current imports: relative paths
- Will need: No changes (Python doesn't use monorepo structure)

## Shared Types Found
- Position
- AuditResult
- EnrichmentResult
- (list all found)

## Import Refactoring Scope
- Frontend: X imports to update
- Backend: N/A (Python)
- Shared: X types to extract

## Risks/Notes
- (Any concerns found)
```

---

### PHASE 2-3: Planning & Decisions (Nov 19, 12:00-15:00) ⚙️

**Objective:** Finalize decisions before execution

#### Step 2.1: Frontend Decision ✅ DONE

**Decision:** Use **Vite (stav-agent/)**

**Rationale:**
- ✅ Simpler than Next.js (no SSR complexity)
- ✅ Better suited for internal engineering tool
- ✅ Faster development/build cycles
- ✅ Existing codebase with React + Zustand
- ❌ Next.js: Overkill for CRUD UI

**Action:**
- [ ] Mark `/frontend` (Next.js) for deprecation
- [ ] Mark `/stav-agent` as official frontend

#### Step 2.2: Package Naming ✅ DONE

```json
{
  "backend": "app/",
  "packages": {
    "core-backend": "@stavagent/core-backend",
    "core-frontend": "@stavagent/core-frontend",
    "core-shared": "@stavagent/core-shared"
  }
}
```

#### Step 2.3: Monorepo Structure ✅ DONE

```
concrete-agent/
├── packages/
│   ├── core-backend/               (from /app, Python)
│   │   ├── app/                    (FastAPI code)
│   │   ├── alembic/                (migrations)
│   │   ├── tests/                  (pytest)
│   │   ├── requirements.txt         (Python deps)
│   │   └── pyproject.toml           (Poetry config, NEW)
│   │
│   ├── core-frontend/              (from /stav-agent, Vite)
│   │   ├── src/
│   │   ├── package.json            (name: @stavagent/core-frontend)
│   │   └── vite.config.ts
│   │
│   └── core-shared/                (NEW - TypeScript types)
│       ├── src/
│       │   ├── types/
│       │   │   ├── position.ts
│       │   │   ├── audit.ts
│       │   │   ├── enrichment.ts
│       │   │   └── index.ts
│       │   └── utils/
│       ├── package.json            (name: @stavagent/core-shared)
│       └── tsconfig.json
│
├── root package.json               (with workspaces)
├── README.md                       (root-level)
├── CLAUDE.md                       (update refs)
└── ...
```

---

### PHASE 4: Execution (Nov 20, 9:00-18:00) 🔨

**Objective:** Transform to monorepo structure

#### Step 4.1: Create Root Structure (1 hour)

```bash
cd concrete-agent

# 1. Create packages directory
mkdir -p packages/core-backend
mkdir -p packages/core-frontend
mkdir -p packages/core-shared/src/{types,utils}

# 2. Move backend
mv app/* packages/core-backend/app/
mv alembic packages/core-backend/
mv tests packages/core-backend/
mv requirements.txt packages/core-backend/
mv pyproject.toml packages/core-backend/ 2>/dev/null || echo "Create new"

# 3. Move frontend
mv stav-agent/* packages/core-frontend/
# Keep original stav-agent dir for reference during transition, then delete

# 4. Verify
tree -L 3 packages/
```

#### Step 4.2: Create Shared Package (1.5 hours)

**File: `/packages/core-shared/package.json`**
```json
{
  "name": "@stavagent/core-shared",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./utils": "./src/utils/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**File: `/packages/core-shared/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**File: `/packages/core-shared/src/types/position.ts`**

Extract from frontend code and create:

```typescript
// Position types
export interface Position {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface EnrichedPosition extends Position {
  kros_match?: string;
  rts_price?: number;
  confidence_score?: number;
}

export interface AuditResult {
  position_id: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  reasons: string[];
  expert_roles: {
    SME: string;
    ARCH: string;
    ENG: string;
    SUP: string;
  };
}

// ... other types
```

**File: `/packages/core-shared/src/types/index.ts`**
```typescript
export * from './position';
export * from './audit';
export * from './enrichment';
// etc.
```

#### Step 4.3: Update Root package.json (30 min)

**File: `/package.json` (NEW - ROOT)**

```json
{
  "name": "concrete-agent",
  "version": "2.3.0",
  "description": "Czech construction cost estimation and audit system",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/core-backend",
    "packages/core-frontend",
    "packages/core-shared"
  ],
  "scripts": {
    "install-all": "npm install && npm --prefix packages/core-shared install && npm --prefix packages/core-frontend install",
    "build": "npm --prefix packages/core-shared run build && npm --prefix packages/core-frontend run build",
    "dev:frontend": "npm --prefix packages/core-frontend run dev",
    "dev:backend": "cd packages/core-backend && python -m uvicorn app.main:app --reload",
    "lint": "npm --prefix packages/core-frontend run lint",
    "test": "cd packages/core-backend && pytest"
  },
  "devDependencies": {}
}
```

#### Step 4.4: Update Frontend package.json (30 min)

**File: `/packages/core-frontend/package.json`**

```json
{
  "name": "@stavagent/core-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx,ts,tsx"
  },
  "dependencies": {
    "@stavagent/core-shared": "*",
    "axios": "^1.6.0",
    "express": "^4.21.2",
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-resizable-panels": "^3.0.6",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.1.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

#### Step 4.5: Create Backend package.json (30 min)

**File: `/packages/core-backend/package.json`** (NEW)

```json
{
  "name": "@stavagent/core-backend",
  "version": "2.3.0",
  "description": "concrete-agent backend - FastAPI service",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "python -m uvicorn app.main:app --reload",
    "start": "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000",
    "migrate": "alembic upgrade head",
    "test": "pytest",
    "test:cov": "pytest --cov=app"
  }
}
```

#### Step 4.6: Update All Import Paths in Frontend (2 hours)

**Find all import issues:**
```bash
grep -r "^import.*from.*\.\." packages/core-frontend/src/ | wc -l
grep -r "^from.*import" packages/core-backend/app/ | head -20
```

**Update frontend imports:**

Before:
```typescript
import { Position } from '../types/position';
import { useStore } from '../store';
```

After:
```typescript
import { Position } from '@stavagent/core-shared/types';
import { useStore } from './store';
```

**Strategy:**
1. First update relative imports within same package to local references
2. Then add imports from `@stavagent/core-shared`
3. Test as you go

---

### PHASE 5: Testing (Nov 20, 18:00-20:00) ✅

**Objective:** Verify all packages build and run correctly

#### Step 5.1: Install Dependencies (30 min)

```bash
cd concrete-agent

# Install monorepo deps
npm install

# This should install:
# - Root node_modules
# - packages/core-shared/node_modules
# - packages/core-frontend/node_modules

# Verify
ls -la node_modules/@stavagent/
```

#### Step 5.2: Build Shared Package (15 min)

```bash
cd packages/core-shared
npm run build

# Verify dist/ was created
ls -la dist/
```

#### Step 5.3: Build Frontend (20 min)

```bash
cd packages/core-frontend
npm run build

# Should create dist/ without errors
ls -la dist/
```

#### Step 5.4: Test Backend (15 min)

```bash
cd packages/core-backend

# Install Python deps
pip install -r requirements.txt

# Run tests
pytest -v

# Check imports work
python -c "from app.main import app; print('✅ Backend imports OK')"

# Start server (Ctrl+C to stop)
python -m uvicorn app.main:app --reload
```

#### Step 5.5: Start Full Stack (10 min)

```bash
# Terminal 1: Backend
cd packages/core-backend && python -m uvicorn app.main:app --reload

# Terminal 2: Frontend
cd packages/core-frontend && npm run dev

# Terminal 3: Verify
curl http://localhost:8000/health
curl http://localhost:5173  # Vite default port
```

#### Step 5.6: Integration Check (10 min)

- [ ] Frontend loads without errors
- [ ] Can make API calls to backend
- [ ] All imports resolve correctly
- [ ] No TypeScript errors

---

### PHASE 6: Git & Documentation (Nov 21, 9:00-12:00) 📝

**Objective:** Commit changes and document

#### Step 6.1: Create Refactoring Commit (1 hour)

```bash
cd concrete-agent

# Add all new structure
git add packages/
git add package.json
git add PHASE1_ANALYSIS_RESULTS.md

# Commit
git commit -m "$(cat <<'EOF'
refactor(monorepo): Transform to @stavagent/core-* monorepo structure

## Major Changes

### Directory Structure
- Created packages/ directory with three packages
- Moved app/ → packages/core-backend/
- Moved stav-agent/ → packages/core-frontend/
- Created packages/core-shared/ for shared TypeScript types

### Package Renaming
- frontend → @stavagent/core-frontend (Vite)
- stav-agent → @stavagent/core-frontend (consolidated)
- NEW → @stavagent/core-shared (TypeScript types)
- app → @stavagent/core-backend (FastAPI)

### Configuration
- Added root package.json with npm workspaces
- Added root TypeScript support
- Each package has tsconfig.json

### Frontend Decision
- Selected Vite (from stav-agent) as official frontend
- Reason: Better suited for internal engineering tool
- Next.js version (frontend/) marked for deprecation

### Shared Types
- Extracted Position, AuditResult, EnrichmentResult types
- Centralized in @stavagent/core-shared
- Frontend updated to use scoped imports

### Breaking Changes
- All import paths updated to use @stavagent/ scope
- Node workspace structure for npm/yarn
- Python backend unchanged (no workspace support needed)

### Verification
- ✅ All packages build successfully
- ✅ Frontend dev server runs on localhost:5173
- ✅ Backend runs on localhost:8000
- ✅ Shared types import correctly
- ✅ Integration tests pass

### Next Steps
- Deploy refactored version to Render (Nov 21-22)
- Complete Monolit-Planner integration (Nov 23)
- Archive deprecated Next.js frontend (post-deployment)

Reference: PHASE1_ANALYSIS_RESULTS.md, CORE_REFACTORING_INSTRUCTIONS.md
EOF
)"
```

#### Step 6.2: Update Documentation (30 min)

**Update: CLAUDE.md**
- [ ] Version 2.4.0 (monorepo complete)
- [ ] Add @stavagent/core-* scope info
- [ ] Document new structure
- [ ] Add workspace commands

**Create: docs/MONOREPO_STRUCTURE.md**
- [ ] Explain new layout
- [ ] Document workspace commands
- [ ] List migration notes

**Create: docs/FRONTEND_MIGRATION_NOTES.md**
- [ ] Why Vite was chosen
- [ ] Next.js deprecation notice
- [ ] Steps for developers

#### Step 6.3: Push to Feature Branch (30 min)

```bash
git push origin claude/monorepo-refactoring-week2

# Create PR
gh pr create \
  --title "refactor(monorepo): Transform to @stavagent/core-* structure" \
  --body "Option B execution: Proper architecture before Render deployment"
```

---

## 🎯 Week 2 Timeline Summary

```
┌─────────────────────────────────────────────────────────────┐
│ WEEK 2: Nov 19-23 Option B Execution                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Nov 19 (Monday)                                              │
│ ├─ 09:00-12:00: Phase 1 Analysis                            │
│ ├─ 12:00-15:00: Phase 2-3 Planning & Decisions             │
│ └─ 15:00-17:00: Phase 4 Execution (start)                   │
│                                                              │
│ Nov 20 (Tuesday)                                             │
│ ├─ 09:00-12:00: Phase 4 Execution (continue)                │
│ │  ├─ Step 4.1-4.3: Structure & shared package              │
│ │  ├─ Step 4.4-4.5: package.json files                      │
│ │  └─ Step 4.6: Import path updates                          │
│ ├─ 14:00-18:00: Phase 5 Testing                             │
│ ├─ 18:00-20:00: Integration verification                    │
│ └─ 20:00+: Phase 6 Git & Docs (start)                       │
│                                                              │
│ Nov 21 (Wednesday) - DEPLOY DAY 1                            │
│ ├─ 09:00-12:00: Phase 6 completion                          │
│ ├─ 12:00-15:00: PostgreSQL migration to Render              │
│ ├─ 15:00-18:00: Verify DB connection                        │
│ └─ 18:00+: Documentation finalization                       │
│                                                              │
│ Nov 22 (Thursday) - DEPLOY DAY 2                             │
│ ├─ 09:00-12:00: Redis (Upstash) setup                       │
│ ├─ 12:00-15:00: Celery workers + Beat                       │
│ ├─ 15:00-18:00: Integration testing                         │
│ └─ 18:00+: Performance optimization                         │
│                                                              │
│ Nov 23 (Friday) - FINAL DAY                                  │
│ ├─ 09:00-12:00: Final testing + bug fixes                   │
│ ├─ 12:00-14:00: Monolit integration verification            │
│ ├─ 14:00-16:00: Go-live checks                              │
│ └─ 16:00+: Final monitoring                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Total: 5 days to production-ready monorepo + deployment
```

---

## ✅ Deliverables

### Nov 20 (End of Refactoring)

- ✅ Monorepo structure created
- ✅ `@stavagent/core-*` packages defined
- ✅ All tests passing
- ✅ Frontend dev server running
- ✅ Backend running locally
- ✅ Git commit prepared
- ✅ Documentation updated

### Nov 23 (End of Week 2)

- ✅ PostgreSQL, Redis, Celery on Render
- ✅ All systems green
- ✅ Integration with Monolit-Planner verified
- ✅ Monitoring/alerts configured
- ✅ Go-live complete

---

## 🚨 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Import breaks during refactor | Test incrementally, use grep to find all refs |
| TypeScript errors | Build shared first, then frontend |
| Python backend issues | Keep Python code unchanged, only move directories |
| Render deployment complexity | Test locally first with docker-compose |
| Monolit integration | Already works (Nov 18), verify after refactor |

---

## 📋 Pre-Start Checklist

Before executing this plan:

- [ ] CORE_REFACTORING_INSTRUCTIONS.md reviewed
- [ ] Current repository structure understood
- [ ] Frontend choice confirmed (Vite)
- [ ] Package naming confirmed (@stavagent/core-*)
- [ ] Deployment approach confirmed (Option B)
- [ ] All team members notified
- [ ] Backup of current state made

---

## 📞 Success Criteria

**Refactoring is SUCCESSFUL when:**

1. ✅ All three packages build without errors
2. ✅ Frontend dev server starts on :5173
3. ✅ Backend starts on :8000 with no import errors
4. ✅ Shared types import correctly in frontend
5. ✅ All tests pass (backend pytest)
6. ✅ API health check responds
7. ✅ CORE integration (Nov 18) still works
8. ✅ Git history clean with descriptive commits
9. ✅ Documentation updated
10. ✅ Ready for Nov 21 Render deployment

---

**Ready to Execute? Start Nov 19, 09:00 UTC**
