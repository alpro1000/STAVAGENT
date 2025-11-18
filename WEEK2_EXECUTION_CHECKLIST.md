# WEEK 2 EXECUTION CHECKLIST - Nov 19-23

> Daily progress tracking for Option B: Monorepo Refactoring + Render Deployment

---

## 📅 Nov 19 (Monday) - PHASE 1: ANALYSIS

### Morning (09:00-12:00) - Analysis

- [ ] Read WEEK2_REFACTORING_PLAN.md (20 min)
- [ ] Read CORE_REFACTORING_INSTRUCTIONS.md (20 min)
- [ ] Check current structure
  ```bash
  ls -la concrete-agent/
  find concrete-agent -maxdepth 2 -name "package.json"
  ```
- [ ] **Step 1.1: Frontend Analysis** (30 min)
  - [ ] Analyze `/frontend` package.json
  - [ ] Analyze `/stav-agent` package.json
  - [ ] Count lines of code in each
  - [ ] Check which one is in production
  - [ ] **DECISION: Confirm Vite (stav-agent)**

- [ ] **Step 1.2: Backend Analysis** (20 min)
  - [ ] Check app/ structure
  - [ ] List all Python imports
  - [ ] Verify current FastAPI setup

- [ ] **Step 1.3: Shared Types Inventory** (20 min)
  - [ ] Find all .ts/.tsx files in frontend
  - [ ] Identify common types
  - [ ] List Position, AuditResult, etc.

- [ ] **Step 1.4: Document Results** (10 min)
  - [ ] Create PHASE1_ANALYSIS_RESULTS.md
  - [ ] List all findings

### Afternoon (12:00-15:00) - Planning & Decisions

- [ ] **Step 2.1: Confirm Frontend Decision**
  - [ ] Decision: Use **Vite** (stav-agent/) ✅
  - [ ] Reason documented

- [ ] **Step 2.2: Confirm Package Naming**
  - [ ] `@stavagent/core-backend` ✅
  - [ ] `@stavagent/core-frontend` ✅
  - [ ] `@stavagent/core-shared` ✅

- [ ] **Step 2.3: Confirm Monorepo Structure**
  - [ ] packages/core-backend/
  - [ ] packages/core-frontend/
  - [ ] packages/core-shared/
  - [ ] Root package.json with workspaces

### Late Afternoon (15:00-17:00) - Start Execution

- [ ] **Step 4.1: Create Directory Structure** (1 hour)
  ```bash
  mkdir -p packages/core-backend
  mkdir -p packages/core-frontend
  mkdir -p packages/core-shared/src/{types,utils}
  ```

- [ ] **Backup Current State**
  ```bash
  git status
  git log --oneline -5
  git branch -v
  ```

### End of Day (17:00+)

- [ ] **Commit Phase 1 Results**
  ```bash
  git add PHASE1_ANALYSIS_RESULTS.md WEEK2_EXECUTION_CHECKLIST.md
  git commit -m "docs(phase1): Analysis and planning complete"
  ```

- [ ] Update this checklist ✏️

---

## 📅 Nov 20 (Tuesday) - PHASES 4-5: EXECUTION & TESTING

### Morning (09:00-12:00) - Move Files

- [ ] **Step 4.1: Create Package Structure** (30 min)
  - [ ] Verify packages/ created
  - [ ] Move app → packages/core-backend/app/
    ```bash
    mv app/* packages/core-backend/app/
    mv alembic packages/core-backend/
    mv tests packages/core-backend/
    mv requirements.txt packages/core-backend/
    ```
  - [ ] Move stav-agent → packages/core-frontend/
    ```bash
    mv stav-agent/* packages/core-frontend/
    ```
  - [ ] Verify structure
    ```bash
    tree -L 3 packages/
    ```

- [ ] **Step 4.2: Create Shared Package** (1.5 hours)
  - [ ] Create package.json
  - [ ] Create tsconfig.json
  - [ ] Create src/types/ directory
  - [ ] Extract types from frontend:
    - [ ] position.ts
    - [ ] audit.ts
    - [ ] enrichment.ts
    - [ ] index.ts

### Midday (12:00-14:00) - Root Configuration

- [ ] **Step 4.3: Root package.json** (30 min)
  - [ ] Create /package.json
  - [ ] Add workspaces: [packages/*]
  - [ ] Add root scripts (build, dev:frontend, dev:backend, test)

- [ ] **Step 4.4: Frontend package.json** (30 min)
  - [ ] Update packages/core-frontend/package.json
  - [ ] Change name to `@stavagent/core-frontend`
  - [ ] Add dependency: `@stavagent/core-shared`
  - [ ] Keep all dev deps

### Afternoon (14:00-17:00) - Backend & Import Updates

- [ ] **Step 4.5: Backend package.json** (30 min)
  - [ ] Create packages/core-backend/package.json
  - [ ] Set name to `@stavagent/core-backend`
  - [ ] Add scripts: dev, start, test, migrate

- [ ] **Step 4.6: Update Frontend Imports** (1.5 hours)
  ```bash
  # Find all relative imports
  grep -r "^import.*from.*\.\." packages/core-frontend/src/
  grep -r "^from \'\.\." packages/core-frontend/src/
  ```

  - [ ] Update Position imports → `@stavagent/core-shared`
  - [ ] Update AuditResult imports → `@stavagent/core-shared`
  - [ ] Update EnrichmentResult imports → `@stavagent/core-shared`
  - [ ] Keep local relative imports for local code

### Late Afternoon (17:00-18:00) - Checkpoint

- [ ] **Verify Directory Structure**
  ```bash
  ls -la packages/core-*/
  cat package.json
  cat packages/core-frontend/package.json
  cat packages/core-backend/package.json
  cat packages/core-shared/package.json
  ```

- [ ] **Commit Execution Phase**
  ```bash
  git add packages/
  git add package.json
  git add "packages/core-backend/package.json"
  git add "packages/core-frontend/package.json"
  git add "packages/core-shared/package.json"
  git commit -m "refactor(structure): Create monorepo with packages directory"
  ```

### Evening (18:00-20:00) - PHASE 5: TESTING

- [ ] **Step 5.1: Install Dependencies** (30 min)
  ```bash
  cd concrete-agent
  npm install

  # Should install all workspaces
  npm --prefix packages/core-shared install
  npm --prefix packages/core-frontend install
  ```

- [ ] **Step 5.2: Build Shared Package** (15 min)
  ```bash
  cd packages/core-shared
  npm run build

  # Verify
  ls -la dist/
  ```

- [ ] **Step 5.3: Build Frontend** (20 min)
  ```bash
  cd packages/core-frontend
  npm run build

  # Verify no errors
  ls -la dist/
  ```

- [ ] **Step 5.4: Test Backend** (15 min)
  ```bash
  cd packages/core-backend
  pip install -r requirements.txt
  pytest -v

  python -c "from app.main import app; print('✅ Backend OK')"
  ```

- [ ] **Step 5.5: Start Full Stack** (10 min)
  ```bash
  # Terminal 1
  cd packages/core-backend && python -m uvicorn app.main:app --reload

  # Terminal 2
  cd packages/core-frontend && npm run dev

  # Terminal 3
  curl http://localhost:8000/health
  curl http://localhost:5173
  ```

- [ ] **Step 5.6: Integration Check**
  - [ ] Frontend loads (localhost:5173)
  - [ ] Backend responds (localhost:8000)
  - [ ] No errors in console
  - [ ] Can make API calls

### End of Day (20:00+)

- [ ] **All Tests Passing?**
  - [ ] ✅ npm builds work
  - [ ] ✅ pytest passes
  - [ ] ✅ Servers start cleanly
  - [ ] ✅ No import errors

- [ ] **Commit Testing Results**
  ```bash
  git add "packages/core-backend/requirements.txt"
  git add "packages/core-shared/"
  git add "packages/core-frontend/package.json"
  git commit -m "refactor(testing): Verify all packages build and run"
  ```

- [ ] **Update this checklist** ✏️

---

## 📅 Nov 21 (Wednesday) - PHASE 6: DOCUMENTATION & DEPLOYMENT START

### Morning (09:00-12:00) - Documentation

- [ ] **Step 6.1: Update CLAUDE.md**
  - [ ] Version 2.4.0
  - [ ] Add monorepo structure section
  - [ ] Document @stavagent/core-* scope
  - [ ] Add workspace commands

- [ ] **Step 6.2: Create New Docs**
  - [ ] docs/MONOREPO_STRUCTURE.md
  - [ ] docs/FRONTEND_MIGRATION_NOTES.md

- [ ] **Step 6.3: Final Git Commit**
  ```bash
  git add CLAUDE.md docs/
  git commit -m "docs: Update CLAUDE.md with monorepo structure (v2.4.0)"

  git add -A
  git commit -m "refactor(monorepo): Complete transformation to @stavagent/core-*

  - All packages under @stavagent scope
  - Monorepo structure with npm workspaces
  - Shared TypeScript types
  - Vite selected as frontend
  - Full documentation updated

  Ready for Render deployment"
  ```

- [ ] **Push to Remote**
  ```bash
  git push origin claude/monorepo-refactoring-week2
  ```

### Afternoon (12:00-15:00) - DEPLOY DAY 1: PostgreSQL

**Reference:** DEPLOYMENT_URLS.md (Nov 16-21 plan)

- [ ] **Prepare Render.com**
  - [ ] Create new PostgreSQL instance (Render)
  - [ ] Note connection string
  - [ ] Create database: `concrete_agent_prod`

- [ ] **Configure Backend for Render**
  - [ ] Update .env for production
  - [ ] Set DATABASE_URL from Render
  - [ ] Set other prod variables

- [ ] **Deploy Backend to Render**
  - [ ] Push refactored code
  - [ ] Render auto-detects changes
  - [ ] Monitor deployment logs

- [ ] **Run Migrations**
  ```bash
  # On Render or locally with prod DB
  alembic upgrade head
  ```

- [ ] **Verify DB Connection**
  ```bash
  curl https://concrete-agent.onrender.com/health
  # Should show DB status
  ```

### Late Afternoon (15:00-18:00) - Verify DB

- [ ] **Health Check**
  ```bash
  curl https://concrete-agent.onrender.com/health
  ```

  Should return:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "redis": "pending",
    "celery": "pending"
  }
  ```

- [ ] **Check Logs**
  - [ ] No errors in Render logs
  - [ ] DB connection successful
  - [ ] Server started cleanly

### End of Day (18:00+)

- [ ] **Update CURRENT_STATUS.md**
  - [ ] PostgreSQL: ✅ Deployed (Nov 21)
  - [ ] Monorepo: ✅ Complete (Nov 20)

- [ ] **Commit Progress**
  ```bash
  git add CURRENT_STATUS.md
  git commit -m "docs: Update status - PostgreSQL deployed Nov 21"
  ```

---

## 📅 Nov 22 (Thursday) - DEPLOYMENT DAYS 2-3

### Morning (09:00-12:00) - Redis Setup

- [ ] **Setup Upstash Redis** (Render integration)
  - [ ] Create Redis instance on Upstash
  - [ ] Get connection string
  - [ ] Add to Render env vars (REDIS_URL)

- [ ] **Update Backend Config**
  - [ ] REDIS_URL set
  - [ ] SESSION_TTL, CACHE_TTL configured
  - [ ] CELERY_BROKER_URL set

- [ ] **Deploy Redis Config**
  - [ ] Push changes to Render
  - [ ] Verify connection

### Midday (12:00-15:00) - Celery Setup

- [ ] **Configure Celery for Render**
  - [ ] CELERY_BROKER_URL → Upstash Redis
  - [ ] CELERY_RESULT_BACKEND → Upstash Redis
  - [ ] Task concurrency set

- [ ] **Deploy Celery Workers**
  - [ ] Add worker dyno to Render
  - [ ] Configure Celery Beat scheduler
  - [ ] Verify task registration

- [ ] **Test Celery**
  ```bash
  curl -X POST https://concrete-agent.onrender.com/api/test-task
  # Should queue and execute
  ```

### Afternoon (15:00-18:00) - Integration Testing

- [ ] **Test Full Stack**
  - [ ] [ ] Upload Excel via Monolit
  - [ ] [ ] CORE parser endpoint works
  - [ ] [ ] Fallback chain functions
  - [ ] [ ] Results stored in DB
  - [ ] [ ] Celery tasks execute

- [ ] **Performance Check**
  - [ ] Excel parsing: <500ms
  - [ ] API response: <2s
  - [ ] Celery task queue: <5s

- [ ] **Monitoring Setup**
  - [ ] Render alerts configured
  - [ ] Error tracking enabled
  - [ ] Health check every 5min

### End of Day (18:00+)

- [ ] **Logs Check**
  - [ ] No errors
  - [ ] All services connected
  - [ ] Ready for final day

---

## 📅 Nov 23 (Friday) - FINAL DAY: GO-LIVE

### Morning (09:00-12:00) - Final Testing

- [ ] **Smoke Tests**
  - [ ] Health endpoint: ✅
  - [ ] DB connection: ✅
  - [ ] Redis connection: ✅
  - [ ] Celery connection: ✅

- [ ] **CORE-Monolit Integration**
  - [ ] Monolit can reach CORE
  - [ ] Parse Excel endpoint works
  - [ ] Fallback chain operational
  - [ ] All data flows correctly

- [ ] **Performance Baseline**
  - [ ] Measure response times
  - [ ] Document baseline metrics

### Midday (12:00-14:00) - Bug Fixes

- [ ] **If Issues Found**
  - [ ] Debug and fix
  - [ ] Re-deploy
  - [ ] Re-test

- [ ] **If All Good**
  - [ ] Prepare go-live announcement

### Afternoon (14:00-16:00) - Go-Live

- [ ] **Final Approval**
  - [ ] All tests passing
  - [ ] No critical issues
  - [ ] Team ready

- [ ] **Go-Live Actions**
  - [ ] DNS/routing updated (if needed)
  - [ ] Monitoring dashboards live
  - [ ] Alerts configured
  - [ ] Support notified

- [ ] **Post-Go-Live**
  - [ ] Monitor for 1 hour
  - [ ] Check error rates
  - [ ] Verify user access
  - [ ] Document any issues

### Late Afternoon (16:00+) - Stabilization

- [ ] **Close Phase 2**
  - [ ] All systems stable
  - [ ] Production ready
  - [ ] Documentation final

- [ ] **Update Status**
  ```bash
  git add CURRENT_STATUS.md
  git commit -m "docs: Production deployment complete Nov 23

  - All infrastructure deployed (PostgreSQL, Redis, Celery)
  - Monorepo refactoring complete
  - CORE-Monolit integration verified
  - Systems stable and monitoring
  - Ready for Phase 3 (complete integration)"
  ```

- [ ] **Push Final State**
  ```bash
  git push origin claude/monorepo-refactoring-week2
  ```

---

## ✅ Daily Sign-Offs

### Nov 19
- [ ] Phase 1 Analysis Complete
- [ ] Decisions documented
- [ ] Structure initiated
- **Status:** ✅ Ready for Nov 20

### Nov 20
- [ ] Monorepo structure created
- [ ] All packages built
- [ ] Tests passing
- [ ] Full stack running
- **Status:** ✅ Ready for Nov 21 deployment

### Nov 21
- [ ] PostgreSQL deployed
- [ ] DB migrations run
- [ ] Documentation complete
- **Status:** ✅ Ready for Nov 22 Redis/Celery

### Nov 22
- [ ] Redis deployed
- [ ] Celery workers running
- [ ] Full stack tested
- **Status:** ✅ Ready for Nov 23 go-live

### Nov 23
- [ ] All systems green
- [ ] Integration verified
- [ ] Monitoring active
- **Status:** ✅ PRODUCTION LIVE

---

## 🚨 If Something Breaks

### Can't Build Shared Package?
```bash
# Check TypeScript
cd packages/core-shared
npx tsc --noEmit

# Check tsconfig
cat tsconfig.json

# Rebuild
npm run build
```

### Frontend Import Errors?
```bash
# Find unupdated imports
grep -r "^from \'\." packages/core-frontend/src/

# Reinstall deps
cd packages/core-frontend
rm -rf node_modules
npm install
```

### Backend Import Errors?
```bash
# Check Python path
cd packages/core-backend
python -m pytest -v

# Reinstall Python deps
pip install -r requirements.txt --force-reinstall
```

### Render Deployment Issues?
```bash
# Check Render logs
# From Render dashboard → Logs

# Roll back
git reset --hard HEAD~1
git push origin claude/monorepo-refactoring-week2 --force
# ⚠️ Only if critical
```

---

## 📞 Key Contacts

- **Issues?** Check logs first
- **Stuck?** Review WEEK2_REFACTORING_PLAN.md
- **Decision needed?** Reference CURRENT_STATUS.md

---

**Last Updated:** Nov 18, 2025
**Execution Start:** Nov 19, 2025 09:00 UTC
**Expected Completion:** Nov 23, 2025 16:00 UTC
