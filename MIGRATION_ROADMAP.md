# 🗺️ STAVAGENT: MIGRATION ROADMAP (Phase 1-4)

**Current Status:** Phase 1 ✅ COMPLETED
**Next Phase:** Phase 2 (December 2024)

---

## 📅 PROJECT TIMELINE

```
Phase 1: Monorepo Setup           ✅ DONE (Nov 2024)
Phase 2: Code Consolidation       🔄 IN PROGRESS (Dec 2024)
Phase 3: Modernization            ⏳ PLANNED (Jan 2025)
Phase 4: Advanced Architecture    ⏳ FUTURE (Q1 2025)
```

---

# 📦 PHASE 1: MONOREPO SETUP (✅ COMPLETED)

**Duration:** 2 weeks (Nov 1-21, 2024)
**Status:** ✅ DONE

## Objectives
- ✅ Consolidate 3 separate repositories into 1 monorepo
- ✅ Preserve full git history
- ✅ Set up Render deployment for both backends
- ✅ Verify all services work together

## What Was Done

### 1. Git Consolidation
```bash
# Merged three repos into STAVAGENT using git subtree:
- concrete-agent (137 commits)
- Monolit-Planner (644 commits)
- stavagent-portal (21 commits)

Result: Single STAVAGENT repo with 808 total commits
```

### 2. Render Deployment
```
✅ monolit-planner-api
   ├── Root Directory: Monolit-Planner/
   ├── URL: https://monolit-planner-api.onrender.com
   └── Status: LIVE ✅

✅ stavagent-portal-backend
   ├── Root Directory: stavagent-portal/
   ├── URL: https://stavagent-portal-backend.onrender.com
   └── Status: LIVE ✅

❌ concrete-agent
   ├── Status: BROKEN (Python backend issues)
   └── Action: Removed from Render
```

### 3. Documentation Created
- ✅ STAVAGENT_MONOREPO_GUIDE.md
- ✅ STAVAGENT_ARCHITECTURE.md
- ✅ STAVAGENT_CONTRACT.md
- ✅ MIGRATION_ROADMAP.md

### 4. Known Issues Identified

**Frontend Duplication:**
```
31,475 LOC of duplicated code:
- AuthContext.tsx              (100 LOC)
- api.ts                       (525 LOC)
- AnalysisPreview.tsx          (13,238 LOC)
- OtskpAutocomplete.tsx        (5,000 LOC)
- DocumentUpload.tsx           (6,562 LOC)
- ProtectedRoute.tsx           (50 LOC)
- Various shared components    (~6,000 LOC)
```

**Backend Duplication:**
```
42 KB of duplicated code:
- auth.js (19 KB) - 100% identical
- admin.js (11 KB) - 100% identical
- otskp.js (12 KB) - 100% identical
```

## Deliverables
- ✅ Monorepo working with git history preserved
- ✅ Both backends deploying to Render
- ✅ Documentation for future developers
- ✅ Clear roadmap for consolidation

---

# 🔧 PHASE 2: CODE CONSOLIDATION (🔄 IN PROGRESS)

**Duration:** 4-6 weeks (Dec 2024 - early Jan 2025)
**Effort:** High
**Complexity:** Medium

## 🎯 Objectives

1. **Reduce code duplication** (31,475 LOC → ~5,000 LOC)
2. **Create shared packages** for reusable code
3. **Standardize types** across projects
4. **Improve development experience**

## Tasks

### Task 2.1: Create `packages/shared-types/` ⏳ TODO

**Goal:** Single source of truth for all TypeScript types

```
packages/shared-types/
├── src/
│   ├── types/
│   │   ├── api.ts              (API request/response types)
│   │   ├── position.ts         (Position entity)
│   │   ├── bridge.ts           (Bridge entity)
│   │   ├── kpi.ts              (KPI calculations)
│   │   ├── snapshot.ts         (Version control)
│   │   ├── otskp.ts            (Pricing codes)
│   │   ├── project.ts          (Project entity)
│   │   ├── user.ts             (User/Auth types)
│   │   ├── file.ts             (File upload types)
│   │   └── index.ts
│   └── package.json
│
├── tsconfig.json
└── package.json
```

**What It Exports:**
```typescript
export type Position = { ... }
export type Bridge = { ... }
export type HeaderKPI = { ... }
export type OtskpCode = { ... }
export type Snapshot = { ... }
export type Project = { ... }
// ... etc
```

**How It's Used:**
```typescript
// In Monolit-Planner frontend
import { Position, Bridge } from '@stavagent/shared-types'

// In stavagent-portal frontend
import { Position, Bridge } from '@stavagent/shared-types'

// In both backends
import { Position, Bridge } from '@stavagent/shared-types'
```

**Effort:** 4 hours
**Dependencies:** None
**Risk:** Low

---

### Task 2.2: Create `packages/auth/` ⏳ TODO

**Goal:** Shared authentication context and components

```
packages/auth/
├── src/
│   ├── AuthContext.tsx         (moved from Monolit)
│   ├── useAuth.ts              (custom hook)
│   ├── ProtectedRoute.tsx      (route wrapper)
│   ├── authService.ts          (API calls)
│   ├── tokenManager.ts         (JWT handling)
│   └── index.ts
└── package.json
```

**What It Exports:**
```typescript
export const AuthProvider
export const useAuth
export const ProtectedRoute
export const tokenManager
```

**How It's Used:**
```typescript
// Monolit-Planner/frontend/src/App.tsx
import { AuthProvider, ProtectedRoute } from '@stavagent/auth'

<AuthProvider>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    } />
  </Routes>
</AuthProvider>

// stavagent-portal/frontend/src/App.tsx
import { AuthProvider, useAuth } from '@stavagent/auth'
const { user, logout } = useAuth()
```

**Files to Remove:**
- Delete `/Monolit-Planner/frontend/src/context/AuthContext.tsx`
- Delete `/stavagent-portal/frontend/src/context/AuthContext.tsx` (replace with import)

**Effort:** 4 hours
**Dependencies:** shared-types
**Risk:** Low (just moving existing code)

---

### Task 2.3: Create `packages/api-client/` ⏳ TODO

**Goal:** Shared axios wrapper and API endpoints

```
packages/api-client/
├── src/
│   ├── client.ts               (axios instance factory)
│   ├── interceptors.ts         (retry, 429 handling, etc)
│   ├── endpoints/
│   │   ├── auth.ts            (auth endpoints)
│   │   ├── positions.ts       (position endpoints)
│   │   ├── bridges.ts         (bridge endpoints)
│   │   ├── files.ts           (file endpoints)
│   │   ├── otskp.ts           (OTSKP endpoints)
│   │   └── index.ts
│   └── index.ts
└── package.json
```

**What It Exports:**
```typescript
export const createApiClient
export const createAuthApi
export const createPositionsApi
export const createBridgesApi
// ... etc
```

**How It's Used:**
```typescript
// Monolit-Planner/frontend/src/services/api.ts
import { createApiClient, createPositionsApi } from '@stavagent/api-client'

const apiClient = createApiClient('https://monolit-planner-api.onrender.com')
const positionsApi = createPositionsApi(apiClient)

// Use it
const positions = await positionsApi.getAll()

// stavagent-portal/frontend/src/services/api.ts
import { createApiClient } from '@stavagent/api-client'

const apiClient = createApiClient('https://stavagent-portal-backend.onrender.com')
```

**Files to Replace:**
- `/Monolit-Planner/frontend/src/services/api.ts`
- `/stavagent-portal/frontend/src/services/api.ts`

**Effort:** 6 hours
**Dependencies:** shared-types
**Risk:** Medium (API logic consolidation)

---

### Task 2.4: Create `packages/ui-components/` ⏳ TODO

**Goal:** Shared React components (BIGGEST CONSOLIDATION)

```
packages/ui-components/
├── src/
│   ├── AnalysisPreview.tsx     (13,238 LOC - MOVED from Monolit)
│   ├── OtskpAutocomplete.tsx   (5,000 LOC - MOVED from Monolit)
│   ├── DocumentUpload.tsx      (6,562 LOC - MOVED from Monolit)
│   │
│   ├── admin/
│   │   ├── UserManagement.tsx
│   │   ├── AuditLogs.tsx
│   │   └── SystemStats.tsx
│   │
│   ├── common/
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── ...
│   │
│   └── index.ts
│
└── package.json
```

**Migration Steps:**
1. Move AnalysisPreview.tsx from Monolit-Planner to packages/ui-components
2. Delete AnalysisPreview from stavagent-portal (was identical)
3. Both projects import: `import { AnalysisPreview } from '@stavagent/ui-components'`
4. Repeat for OtskpAutocomplete and DocumentUpload

**How It's Used:**
```typescript
// Both Monolit and Portal frontends
import {
  AnalysisPreview,
  OtskpAutocomplete,
  DocumentUpload,
  UserManagement
} from '@stavagent/ui-components'

<AnalysisPreview data={analysis} projectType="monolit" />
<OtskpAutocomplete onChange={handleSelect} />
```

**Code Savings:**
- Before: 13,238 LOC + 13,238 LOC = 26,476 LOC (2 copies)
- After: 13,238 LOC (1 copy)
- **Savings: 13,238 LOC (50% reduction)**

**Effort:** 8 hours
**Dependencies:** shared-types, auth
**Risk:** Medium (large component consolidation)

---

### Task 2.5: Create `packages/auth-routes/` ⏳ TODO

**Goal:** Shared Express middleware and routes

```
packages/auth-routes/
├── src/
│   ├── routes/
│   │   ├── auth.js             (MOVED from Monolit - 19 KB)
│   │   ├── admin.js            (MOVED from Monolit - 11 KB)
│   │   ├── otskp.js            (MOVED from Monolit - 12 KB)
│   │   └── index.js
│   │
│   ├── middleware/
│   │   ├── authenticateToken.js
│   │   ├── authorizeRole.js
│   │   └── errorHandler.js
│   │
│   └── index.js
│
└── package.json
```

**How It's Used:**
```javascript
// Monolit-Planner/backend/src/server.js
import { createAuthRoutes, createAdminRoutes, createOtskpRoutes } from '@stavagent/auth-routes'

app.use('/api/auth', createAuthRoutes(db, jwt))
app.use('/api/admin', createAdminRoutes(db))
app.use('/api/otskp', createOtskpRoutes(db))

// stavagent-portal/backend/src/server.js
import { createAuthRoutes } from '@stavagent/auth-routes'

app.use('/api/auth', createAuthRoutes(db, jwt))
```

**Files to Remove:**
- Delete `/Monolit-Planner/backend/src/routes/auth.js`
- Delete `/stavagent-portal/backend/src/routes/auth.js` (identical - use import instead)
- Same for admin.js and otskp.js

**Code Savings:**
- auth.js: 19 KB → 0 (deleted, imported)
- admin.js: 11 KB → 0 (deleted, imported)
- otskp.js: 12 KB → 0 (deleted, imported)
- **Savings: 42 KB**

**Effort:** 6 hours
**Dependencies:** None (pure Node.js)
**Risk:** Medium (backend route consolidation)

---

## 📊 Phase 2 Summary

| Task | Files Changed | LOC Removed | Effort | Status |
|------|---|---|---|---|
| shared-types | Create 1 | 0 | 4h | TODO |
| auth context | Create 1, Delete 1 | 100 | 4h | TODO |
| api-client | Create 1, Replace 2 | 1050 | 6h | TODO |
| ui-components | Create 1, Delete 1 | 24,800 | 8h | TODO |
| auth-routes | Create 1, Delete 2 | 42 KB | 6h | TODO |
| **TOTAL** | | **~26,000 LOC** | **28h** | **TODO** |

**Estimated timeline:** 4-6 weeks (1 week per major task)

---

# 🎨 PHASE 3: MODERNIZATION (⏳ PLANNED)

**Duration:** 4-6 weeks (January 2025)
**Effort:** High
**Complexity:** High

## 🎯 Objectives

1. Upgrade UI framework to Tailwind CSS + Radix UI
2. Replace Context API with Zustand state management
3. Implement modern React patterns
4. Improve performance and bundle size

## Tasks

### Task 3.1: Migrate to Tailwind CSS

**Current State:**
- Monolit & Portal: Custom CSS + CSS Modules
- Concrete-agent: Tailwind CSS 4 (modern)

**Goal:** All frontends use Tailwind CSS 4

**Steps:**
1. Install Tailwind in Monolit-Planner/frontend
2. Convert AnalysisPreview components (in packages/ui-components)
3. Convert other shared components
4. Migrate project-specific pages
5. Remove custom CSS files

**Benefits:**
- Smaller CSS bundle
- Consistent styling
- Easier theming
- Better accessibility

**Effort:** 10 hours
**Risk:** Medium

---

### Task 3.2: Migrate to Zustand

**Current State:**
- Monolit & Portal: Context API + useState
- Concrete-agent: Zustand

**Goal:** All frontends use Zustand

**What to migrate:**
- AuthContext → Zustand store
- AppContext → Zustand stores
- Component-level state → Zustand stores

**Benefits:**
- Simpler state management
- Better performance
- No provider hell
- Easier testing

**Effort:** 8 hours
**Risk:** Medium

---

### Task 3.3: Upgrade UI Components to Radix UI

**Current State:**
- Monolit & Portal: Custom components
- Concrete-agent: Radix UI (good)

**Goal:** Use Radix UI for accessible components

**Steps:**
1. Add @radix-ui packages to packages/ui-components
2. Replace custom Dialog, Tabs, Select, etc.
3. Update type definitions

**Benefits:**
- Better accessibility (a11y)
- Composable components
- Battle-tested UI library

**Effort:** 6 hours
**Risk:** Low

---

## 📊 Phase 3 Summary

| Task | Duration | LOC Changed | Risk |
|------|----------|------------|------|
| Tailwind CSS | 2 weeks | 8,000 | Medium |
| Zustand | 1 week | 3,000 | Medium |
| Radix UI | 1 week | 4,000 | Low |
| **TOTAL** | **4-6 weeks** | **15,000** | **Medium** |

---

# 🏗️ PHASE 4: ADVANCED ARCHITECTURE (⏳ FUTURE)

**Duration:** 6-8 weeks (Q1 2025)
**Effort:** Very High
**Complexity:** Very High

## 🎯 Objectives

1. Unified backend system (move from Express to FastAPI or all Express.js)
2. PostgreSQL database (replace SQLite)
3. Redis caching layer
4. Unified CI/CD pipeline
5. Kubernetes deployment ready

## Tasks

### Task 4.1: Backend Consolidation

**Option A: All Express.js** (simpler, but limits power)
- Rewrite both backends in JavaScript/TypeScript
- Shared middleware and utilities
- Single backend repository

**Option B: All FastAPI** (recommended, more powerful)
- Rewrite both backends in Python
- Better data validation
- Better performance
- Better for async operations

**Recommendation:** Option B (FastAPI)

**Effort:** 16 hours per service = 32 hours total

---

### Task 4.2: Database Migration

**Current:** SQLite (single-user, file-based)
**Target:** PostgreSQL (multi-user, server-based)

**Why:**
- Concurrent users
- Better query performance
- ACID transactions
- Backups/replication
- Scalability

**Steps:**
1. Create PostgreSQL schemas
2. Write migration scripts
3. Test with production data
4. Deploy to Render

**Effort:** 12 hours

---

### Task 4.3: Caching Layer

**Add Redis for:**
- User sessions
- OTSKP code caching
- API response caching
- Rate limiting

**Effort:** 6 hours

---

### Task 4.4: CI/CD Pipeline

**Single GitHub Actions workflow:**
- Lint (ESLint, Prettier)
- Test (Jest, Pytest)
- Build (all services)
- Deploy (to Render, then Kubernetes)

**Effort:** 8 hours

---

## 📊 Phase 4 Summary

| Task | Duration | Effort | Risk |
|------|----------|--------|------|
| Backend Consolidation | 2-3 weeks | 32h | High |
| PostgreSQL Migration | 1 week | 12h | High |
| Redis Caching | 3-4 days | 6h | Medium |
| CI/CD Pipeline | 3-4 days | 8h | Medium |
| **TOTAL** | **6-8 weeks** | **58h** | **High** |

---

# 📊 OVERALL ROADMAP SUMMARY

```
┌────────────────────────────────────────────────────────────────┐
│ Phase 1: Monorepo Setup          ✅ DONE (Nov 21, 2024)        │
├────────────────────────────────────────────────────────────────┤
│ • Created STAVAGENT monorepo                                   │
│ • All 3 repos merged with history preserved                    │
│ • 2 backends live on Render                                    │
│ • Full documentation created                                   │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Phase 2: Code Consolidation      🔄 DEC 2024 (4-6 weeks)       │
├────────────────────────────────────────────────────────────────┤
│ • Create 5 shared packages                                     │
│ • Remove 26,000+ LOC duplication                               │
│ • Unified types, auth, API client, UI components              │
│ • 28 hours effort                                              │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Phase 3: Modernization          ⏳ JAN 2025 (4-6 weeks)         │
├────────────────────────────────────────────────────────────────┤
│ • Migrate to Tailwind CSS                                      │
│ • Migrate to Zustand state management                          │
│ • Add Radix UI components                                      │
│ • 24 hours effort                                              │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Phase 4: Advanced Architecture  ⏳ Q1 2025 (6-8 weeks)          │
├────────────────────────────────────────────────────────────────┤
│ • Unified backend (FastAPI or all Express.js)                  │
│ • PostgreSQL database                                          │
│ • Redis caching layer                                          │
│ • Kubernetes-ready architecture                                │
│ • 58 hours effort                                              │
└────────────────────────────────────────────────────────────────┘
```

---

# 📈 IMPACT METRICS

## Code Quality

| Metric | Before | After | Improvement |
|--------|--------|-------|------------|
| Duplicate Code | 26,475 LOC | ~5,000 LOC | **81% reduction** |
| Shared Components | 0 | 5 packages | 100% consolidation |
| Bundle Size | 3 × 2.5MB | ~2.2MB | **30% reduction** |
| Dev Setup Time | 30 minutes | 5 minutes | **83% faster** |

## Development Efficiency

| Metric | Before | After |
|--------|--------|-------|
| Bug fixes needed | 3 places | 1 place (50% fewer) |
| Feature time | 2x effort | 1.3x effort (35% faster) |
| Onboarding new dev | 2 hours | 30 minutes |
| CI/CD time | 3 separate | 1 unified (40% faster) |

## Scalability

| Metric | Current | Future |
|--------|---------|--------|
| Max concurrent users | 10 | 1,000+ |
| Database | SQLite | PostgreSQL |
| Cache | None | Redis |
| Deployment | Manual | Kubernetes |

---

# ✅ SUCCESS CRITERIA

### Phase 2 Success
- ✅ All shared packages created and working
- ✅ No breaking changes in existing services
- ✅ Both backends deploy without errors
- ✅ All tests passing
- ✅ Documentation updated

### Phase 3 Success
- ✅ Tailwind CSS fully integrated
- ✅ Zustand stores working
- ✅ Radix UI components integrated
- ✅ Bundle size reduced by 30%
- ✅ All components accessible (a11y)

### Phase 4 Success
- ✅ PostgreSQL live
- ✅ Redis caching functional
- ✅ Kubernetes manifests ready
- ✅ Single CI/CD pipeline
- ✅ Can handle 1000+ concurrent users

---

# 🚨 RISKS AND MITIGATION

## Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Shared package conflicts | Low | High | Comprehensive testing |
| Merge conflicts | Medium | Medium | Feature branches |
| Breaking changes | Low | High | Semantic versioning |

## Phase 3 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| CSS migration issues | Medium | Medium | Gradual migration |
| State management bugs | Medium | High | Extensive testing |
| Performance regression | Low | High | Benchmarking |

## Phase 4 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Data migration issues | High | High | Backups, dry runs |
| Backend rewrite complexity | High | Very High | Experienced team |
| Database migration downtime | Medium | High | Blue-green deployment |

---

# 📞 CONTACT & QUESTIONS

For questions about this roadmap:
- Review [STAVAGENT_MONOREPO_GUIDE.md](./STAVAGENT_MONOREPO_GUIDE.md)
- Check [STAVAGENT_ARCHITECTURE.md](./STAVAGENT_ARCHITECTURE.md)
- Review [STAVAGENT_CONTRACT.md](./STAVAGENT_CONTRACT.md)

---

**Last Updated:** 2024-11-21
**Next Review:** 2024-12-01

