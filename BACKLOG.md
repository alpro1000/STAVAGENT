# STAVAGENT Backlog & Pending Plans

**Last Updated:** 2026-01-21
**Maintained By:** Development Team

---

## Quick Navigation

- [Immediate / Pending User Action](#-immediate--pending-user-action)
- [High Priority](#-high-priority)
- [Medium Priority](#-medium-priority)
- [Low Priority / Future](#-low-priority--future)
- [Completed Work Reference](#-completed-work-reference)

---

## 🔴 Immediate / Pending User Action

### 1. AI Suggestion Button Enablement (Monolit Planner)

**Status:** ⏳ Code complete, awaiting user SQL execution
**Branch:** `claude/create-onboarding-guide-E4wrx` (merged)
**Service:** Monolit-Planner

**User Action Required:**
```bash
# In Render Dashboard → monolit-db → Shell:
psql -U monolit_user -d monolit_planner

# Execute:
# Monolit-Planner/БЫСТРОЕ_РЕШЕНИЕ.sql
```

**Verification:**
```bash
curl -s https://monolit-planner-api.onrender.com/api/config | jq '.feature_flags.FF_AI_DAYS_SUGGEST'
# Expected: true
```

**After SQL Executed:**
- [ ] Verify ✨ button visible in "Dny" column
- [ ] Test AI suggestion functionality
- [ ] Verify position_suggestions audit trail

**Reference:** `Monolit-Planner/SESSION_2026-01-21_PORTAL_INTEGRATION.md`

---

### 2. R0 Deterministic Core + Unified Architecture PR

**Status:** ⏳ PR ready for merge
**Branch:** `claude/portal-audit-improvements-8F2Co`
**Service:** Portal + All Kiosks

**User Action Required:**
- [ ] Review PR at: `https://github.com/alpro1000/STAVAGENT/compare/main...claude/portal-audit-improvements-8F2Co`
- [ ] Merge to main

**What's Included:**
- R0 Deterministic Core API, UI, migrations
- Unified Project Architecture (Portal aggregates all kiosks)
- ESM import fixes

---

### 3. Google Drive Setup (Optional)

**Status:** ✅ Code complete, ⏳ Google Cloud setup pending
**Service:** concrete-agent

**User Action Required (15 min):**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Configure OAuth2 credentials
4. Add environment variables to Render

**Reference:** `GOOGLE_DRIVE_SETUP.md`

---

### 4. Keep-Alive System Setup

**Status:** ✅ Code complete, ⏳ Secrets setup pending
**Service:** All services

**User Action Required:**
1. Generate secret key: `openssl rand -base64 32`
2. Add `KEEP_ALIVE_KEY` to GitHub Secrets
3. Add `KEEP_ALIVE_KEY` to Render (all 3 services)
4. Enable workflow in GitHub Actions

**Reference:** `KEEP_ALIVE_SETUP.md`

---

## 🟠 High Priority

### 5. Node.js Version Update

**Status:** ⏳ Not started
**Service:** All services
**Reason:** Node.js 18.x reached end-of-life

**Tasks:**
- [ ] Update `.nvmrc` to Node.js 20.x or 22.x
- [ ] Test locally
- [ ] Deploy and verify

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

### 6. npm Security Vulnerabilities

**Status:** ⏳ Not started
**Service:** All services
**Impact:** 4 vulnerabilities (2 moderate, 2 high)

**Tasks:**
```bash
cd Monolit-Planner/backend && npm audit fix
cd ../frontend && npm audit fix
cd ../shared && npm audit fix
```

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

### 7. rozpocet-registry Deployment

**Status:** ⏳ Not deployed
**Service:** rozpocet-registry
**Impact:** Link in Portal doesn't work

**Problem:** Service configured with `autoDeploy: false`, never manually deployed on Render. Portal shows as "Beta" but returns 403 error.

**Current Workaround:** Changed status from `beta` to `coming_soon` in PortalPage.tsx

**Tasks:**
- [ ] Create new Static Site service in Render Dashboard
- [ ] Deploy manually from `rozpocet-registry` folder
- [ ] Verify `https://rozpocet-registry.onrender.com` is accessible
- [ ] Change status back to `beta` or `active` in PortalPage.tsx

**Alternative:** Deploy to Vercel/Netlify (free static hosting)

---

## 🟡 Medium Priority

### 8. URS Matcher - Phase 2: Document Parsing

**Status:** 🔄 In Progress (partially complete)
**Service:** URS_MATCHER_SERVICE

**Completed:**
- [x] SmartParser integration via stavagentClient.js
- [x] PDF/Excel support
- [x] Document Q&A Flow integration
- [x] RFI detection

**Pending:**
- [ ] Document Validator integration (completeness check)
- [ ] Frontend: Multi-file upload + preview
- [ ] Caching (Redis/file)

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 9. URS Matcher - Phase 3: Multi-Role System

**Status:** 🔄 In Progress (MVP complete)
**Service:** URS_MATCHER_SERVICE

**Completed:**
- [x] multiRoleClient.js
- [x] validateBoqBlock(), verifyUrsCode(), resolveUrsConflict()
- [x] Completeness score (0-100%)

**Pending:**
- [ ] Advanced roles (Structural Engineer, Concrete Specialist, Standards Checker)
- [ ] Full Orchestrator integration
- [ ] Advanced conflict resolution
- [ ] tech_rules integration

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 10. CI/CD Improvements

**Status:** ⏳ Not started
**Service:** All services

**Tasks:**
- [ ] Add npm caching back (20 min)
- [ ] Add Dependency Review Action (15 min)

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

## 🟢 Low Priority / Future

### 11. URS Matcher - Phase 4: Optimization

**Status:** ⏳ Planned
**Service:** URS_MATCHER_SERVICE

**Tasks:**
- [ ] Perplexity caching (Redis)
- [ ] Performance tuning
- [ ] Cost optimization
- [ ] Monitoring & Analytics

**Target:** Block analysis < 2 min, 70% cost savings

**Reference:** `URS_MATCHER_SERVICE/ROADMAP.md`

---

### 12. Integration Tests - Vitest Migration

**Status:** ⏳ Planned
**Service:** Monolit-Planner

**Tasks:**
- [ ] Migrate from Jest to Vitest
- [ ] Better ESM support
- [ ] Fix ES module mocking

**Reference:** `docs/POST_DEPLOYMENT_IMPROVEMENTS.md`

---

### 13. Document Accumulator - Production Fixes

**Status:** ⏳ Identified but not started
**Service:** concrete-agent

**Issues Found (SESSION_2026-01-14_TIMEOUT_FIX.md):**
- In-memory storage (lost on restart)
- No file size limits
- No cleanup for temp files

**Tasks:**
- [ ] Add persistent storage
- [ ] Add file size validation
- [ ] Add temp file cleanup

---

### 14. Security Audit Follow-up

**Status:** ⏳ Some items fixed, some pending
**Service:** All services

**Pending from COMPLETE_SYSTEM_AUDIT_REPORT.md:**
- [ ] Review remaining vulnerabilities
- [ ] Add Error Boundaries (React)
- [ ] Fill empty onError callbacks

**Reference:** `docs/archive/analyses/COMPLETE_SYSTEM_AUDIT_REPORT.md`

---

## ✅ Completed Work Reference

For historical reference, completed work is archived in:

```
docs/archive/
├── completed-sessions/     # Session summaries (Google Drive, Multi-Role, etc.)
├── completed-fixes/        # Migration and schema fixes
├── completed-projects/     # Project completion summaries
├── analyses/               # Audit reports and analyses
└── future-planning/        # Speculative planning docs
```

---

## Priority Summary

| Priority | Items | Impact |
|----------|-------|--------|
| 🔴 Immediate | 4 | User action needed |
| 🟠 High | 3 | Security + Deployment |
| 🟡 Medium | 3 | Features |
| 🟢 Low | 4 | Optimization |

---

**Total Pending Items:** 14
**Next Critical Path:** AI Suggestion SQL → Node.js update → npm audit → rozpocet-registry deployment

