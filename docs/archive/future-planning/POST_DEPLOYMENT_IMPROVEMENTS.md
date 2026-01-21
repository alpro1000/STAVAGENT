# Post-Deployment Improvements

**Created:** 2025-12-25
**Priority:** Medium
**Status:** Pending

## 1. Update Node.js Version (High Priority)

**Current Status:**
```
Node.js version 18.20.4 has reached end-of-life
```

**Impact:** Security vulnerabilities, no updates

**Action Required:**
1. Update `.nvmrc` in all services:
   - `/Monolit-Planner/.nvmrc`: 18.20.4 → 20.x or 22.x
   - Test locally before deployment

2. Recommended versions:
   - **Node.js 20.11.0+** (LTS, active until 2026-04-30)
   - **Node.js 22.x** (Current, latest features)

**Files to Update:**
```
Monolit-Planner/.nvmrc
Monolit-Planner/backend/.nvmrc (if exists)
Monolit-Planner/frontend/.nvmrc (if exists)
```

**Testing Checklist:**
- [ ] Local backend builds successfully
- [ ] Local frontend builds successfully
- [ ] All tests pass
- [ ] Production deployment successful

**Estimated Time:** 30 minutes

---

## 2. Fix npm Security Vulnerabilities (High Priority)

**Current Status:**
```
4 vulnerabilities (2 moderate, 2 high)
```

**Action Required:**
```bash
# In each service directory
cd Monolit-Planner/backend
npm audit
npm audit fix

cd ../frontend
npm audit
npm audit fix

cd ../shared
npm audit
npm audit fix
```

**If `npm audit fix` doesn't resolve:**
```bash
# Check which packages need manual updates
npm audit

# Update specific packages
npm update <package-name>

# Or use --force (breaking changes possible)
npm audit fix --force
```

**Testing After Fix:**
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Build succeeds
- [ ] Application works correctly

**Estimated Time:** 1-2 hours

---

## 3. CI/CD Improvements (Medium Priority)

### 3a. Add npm Caching Back (Optional)

**Current:** No caching (removed to fix errors)
**Impact:** ~2 minutes slower builds

**Solution:** Use manual cache with `actions/cache@v4`:

```yaml
- name: Cache npm dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20.x'  # Updated version
```

**Estimated Time:** 20 minutes

### 3b. Add Dependency Review Action

Automatically check for vulnerable dependencies in PRs:

```yaml
# .github/workflows/dependency-review.yml
name: Dependency Review
on: [pull_request]

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
```

**Estimated Time:** 15 minutes

---

## 4. Integration Tests - Fix ES Module Mocking (Low Priority)

**Current Status:** Tests written but need proper ES module setup

**Options:**
1. **Migrate to Vitest** (recommended)
   - Better ESM support
   - Faster than Jest
   - Same API as Jest

2. **Add Dependency Injection** to routes
   - Refactor routes to accept database as parameter
   - More testable architecture

3. **Use environment-based config**
   - Set `TEST_DB_PATH` environment variable
   - Routes read from env instead of import

**Recommended:** Option 1 (Vitest migration)

**Estimated Time:** 4-6 hours

---

## 5. Documentation Updates (Low Priority)

**Tasks:**
- [ ] Update README with Node.js 20.x requirement
- [ ] Document npm audit process
- [ ] Add troubleshooting guide for CI failures
- [ ] Update TESTING_SETUP.md with Vitest info (when done)

**Estimated Time:** 1 hour

---

## Priority Summary

| Priority | Task | Time | Impact |
|----------|------|------|--------|
| 🔴 High | Update Node.js to 20.x | 30m | Security |
| 🔴 High | Fix npm vulnerabilities | 1-2h | Security |
| 🟡 Medium | Add npm caching | 20m | Performance |
| 🟡 Medium | Dependency review action | 15m | Security |
| 🟢 Low | Fix integration tests | 4-6h | Testing |
| 🟢 Low | Update docs | 1h | Maintenance |

**Total Estimated Time:** 7-10 hours
**Critical Path:** Node.js update + npm audit = 2-3 hours

---

## Next Session Checklist

**Start with:**
1. ✅ Update Node.js version
2. ✅ Run npm audit and fix vulnerabilities
3. ✅ Test locally
4. ✅ Deploy and verify

**Then:**
5. Add npm caching back to CI
6. Add dependency review workflow

**Later:**
7. Migrate integration tests to Vitest
8. Update documentation

---

## Success Criteria

- ✅ Node.js on supported LTS version
- ✅ Zero high/critical npm vulnerabilities
- ✅ CI builds in < 5 minutes
- ✅ All tests passing
- ✅ Production deployments successful

---

**Assigned To:** Next development session
**Due Date:** Within 1 week for critical items
