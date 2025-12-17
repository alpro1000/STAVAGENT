# NEXT_SESSION.md - Monolit-Planner Stability Issues

**Date:** 2025-12-17
**Status:** ⚠️ Service Working But Unstable
**Branch:** `claude/read-context-files-5RH5X` (merged to main via PR #121)

---

## Session Summary

### What Was Done

1. **Repository Cleanup**
   - Deleted 130+ obsolete markdown files from root, URS_MATCHER_SERVICE, Monolit-Planner, concrete-agent
   - Removed empty `concrete-agent/stav-agent/` directory
   - Removed orphan `stav-agent` service from concrete-agent/render.yaml

2. **Render.yaml Fixes**
   - Added `autoDeploy: false` to ALL services (prevents cascading deploys)
   - Added `rootDir` to all services for proper monorepo isolation
   - Created missing `URS_MATCHER_SERVICE/render.yaml`

3. **Cache-Busting for Frontend**
   - Created `Monolit-Planner/frontend/public/_headers` with Render.com cache headers
   - Added meta cache-control tags to `index.html`
   - Added content hashing in `vite.config.ts` (rollupOptions)
   - Added build timestamp logging in `main.tsx`

4. **URL Encoding Fix for Project IDs**
   - Added `encodeURIComponent()` to ALL routes in `api.ts`:
     - `bridgesAPI.getOne`, `update`, `delete`, `updateStatus`, `complete`
     - `monolithProjectsAPI.getOne`, `update`, `delete`
   - Added input validation in `CreateMonolithForm.tsx` to reject `/\?#%` characters

---

## Known Issues (Unresolved)

### 1. Service Instability
**Symptom:** Service works but sometimes becomes unresponsive or shows stale data.
**Possible Causes:**
- Render.com free tier cold starts
- Database connection pool issues
- React Query cache not invalidating properly

**Investigation Needed:**
- Check Render.com logs for errors
- Monitor API response times
- Review React Query configuration in `useBridges.ts`

### 2. Frontend Shows Stale UI
**Symptom:** After deploy, some users still see old UI (e.g., ObjectTypeSelector that was removed).
**Fixes Applied:** Cache-busting headers, meta tags, content hashing
**Status:** May still occur - requires manual browser cache clear or incognito mode

### 3. autoDeploy Disabled
**Impact:** Code changes require manual deploy on Render.com
**Reason:** Prevented URS_MATCHER_SERVICE from redeploying when Monolit-Planner changed
**Action Required:** After each merge to main, manually deploy affected services

---

## Files Modified This Session

```
Monolit-Planner/
├── frontend/
│   ├── public/_headers          # NEW - Render.com cache headers
│   ├── index.html               # MODIFIED - meta cache tags
│   ├── vite.config.ts           # MODIFIED - content hashing
│   └── src/
│       ├── main.tsx             # MODIFIED - build timestamp
│       ├── services/api.ts      # MODIFIED - encodeURIComponent
│       └── components/
│           └── CreateMonolithForm.tsx  # MODIFIED - input validation
└── render.yaml                  # MODIFIED - autoDeploy: false

URS_MATCHER_SERVICE/
└── render.yaml                  # NEW - was missing

concrete-agent/
└── render.yaml                  # MODIFIED - autoDeploy: false, removed stav-agent

stavagent-portal/
└── render.yaml                  # MODIFIED - autoDeploy: false
```

---

## Commits This Session

| Hash | Message |
|------|---------|
| `177f557` | FIX: Handle slashes in project IDs to prevent 404 errors |
| `d56ba81` | CLEANUP: Remove 130 obsolete files and fix render.yaml configs |
| `46b40e4` | FIX: Add cache-busting for frontend to resolve stale UI issue |

---

## Next Steps for Stability

1. **Monitor Render.com Logs**
   - Check for timeout errors
   - Look for database connection issues
   - Watch for memory limits

2. **Review React Query Configuration**
   - Check `staleTime` and `cacheTime` settings
   - Ensure `refetchOnMount: true` is set where needed
   - Consider adding `refetchOnWindowFocus`

3. **Database Connection Pooling**
   - PostgreSQL connection pool may need tuning
   - Check for connection leaks

4. **Consider Upgrading Render Tier**
   - Free tier has cold starts (30+ seconds)
   - Paid tier keeps services warm

---

## Quick Commands

```bash
# Manual deploy on Render (via CLI if gh available)
# Or use Render.com dashboard → Service → Manual Deploy

# Check service health
curl https://monolit-planner-api.onrender.com/health

# View recent logs (requires Render CLI)
render logs --service monolit-planner-api --tail 100
```

---

**Last Updated:** 2025-12-17
