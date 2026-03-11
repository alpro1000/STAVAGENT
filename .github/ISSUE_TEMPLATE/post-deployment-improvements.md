---
name: Post-Deployment Improvements
about: Track post-deployment improvements and security updates
title: '[IMPROVEMENT] Post-Deployment: Node.js Update & Security Fixes'
labels: enhancement, security, technical-debt
assignees: ''
---

## 📋 Overview

Post-deployment improvements identified on 2025-12-25 after successful deployment of testing infrastructure and CI/CD workflows.

## 🔴 Critical Items (Do First)

### 1. Update Node.js to LTS Version

**Current:** Node.js 18.20.4 (EOL - end of life)
**Target:** Node.js 20.11.0+ (LTS) or 22.x (Current)

**Files to Update:**
- `Monolit-Planner/.nvmrc`
- GitHub Actions workflow: `.github/workflows/monolit-planner-ci.yml`

**Steps:**
```bash
# Update .nvmrc
echo "20.11.0" > Monolit-Planner/.nvmrc

# Test locally
cd Monolit-Planner/backend && npm install && npm test
cd ../frontend && npm install && npm run build
```

**Verification:**
- [ ] Local builds succeed
- [ ] All tests pass
- [ ] Production deployment successful
- [ ] No runtime errors

---

### 2. Fix npm Security Vulnerabilities

**Current:** 4 vulnerabilities (2 moderate, 2 high)

**Steps:**
```bash
# Backend
cd Monolit-Planner/backend
npm audit
npm audit fix
npm test

# Frontend
cd Monolit-Planner/frontend
npm audit
npm audit fix
npm run build

# Shared
cd Monolit-Planner/shared
npm audit
npm audit fix
npm test
```

**Verification:**
- [ ] Zero high/critical vulnerabilities
- [ ] All tests still pass
- [ ] No breaking changes introduced

---

## 🟡 Medium Priority

### 3. Re-enable npm Caching in CI

**Why:** Currently disabled to avoid path errors, but causes ~2min slower builds

**Solution:** Use `actions/cache@v4` with proper configuration:

```yaml
- name: Cache npm dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Verification:**
- [ ] CI builds complete successfully
- [ ] Build time reduced by ~30-50%

---

### 4. Add Dependency Review GitHub Action

**Purpose:** Automatically check PRs for vulnerable dependencies

**File:** `.github/workflows/dependency-review.yml`

**Verification:**
- [ ] Workflow triggers on PRs
- [ ] Blocks PRs with critical vulnerabilities

---

## 🟢 Low Priority (Future)

### 5. Fix Integration Tests ES Module Mocking

**Current:** Tests written but need configuration
**Options:**
1. Migrate to Vitest (recommended - better ESM support)
2. Add dependency injection to routes
3. Use environment-based database config

**Recommended:** Vitest migration

---

### 6. Documentation Updates

- [ ] Update README with Node.js 20.x requirement
- [ ] Document npm audit process
- [ ] Add CI troubleshooting guide
- [ ] Update TESTING_SETUP.md

---

## 📊 Success Metrics

- ✅ Node.js on supported LTS version
- ✅ Zero high/critical npm vulnerabilities
- ✅ CI builds complete in < 5 minutes
- ✅ All 34 formula tests passing
- ✅ Integration tests configured and passing
- ✅ Production deployments successful

---

## 📝 Implementation Plan

**Week 1 (Critical):**
- Day 1: Node.js update + npm audit
- Day 2: Test and deploy
- Day 3: Verify production stability

**Week 2 (Medium):**
- Day 1: Re-enable npm caching
- Day 2: Add dependency review action

**Future (Low):**
- Migrate to Vitest when time permits
- Update documentation

---

## 🔗 Related Documents

- [POST_DEPLOYMENT_IMPROVEMENTS.md](../../docs/POST_DEPLOYMENT_IMPROVEMENTS.md) - Detailed implementation guide
- [TESTING_SETUP.md](../../docs/TESTING_SETUP.md) - Current testing infrastructure
- [CI_STATUS.md](../../docs/CI_STATUS.md) - CI/CD status tracking

---

## ✅ Acceptance Criteria

- [ ] Node.js updated to 20.x or higher
- [ ] All npm vulnerabilities fixed (high/critical)
- [ ] CI pipeline green for all jobs
- [ ] Production services running without errors
- [ ] Documentation updated
- [ ] No performance regressions

---

**Estimated Total Time:** 7-10 hours
**Critical Path Time:** 2-3 hours (Node.js + npm audit)
**Priority:** High (Security)
**Target Completion:** Within 1 week
