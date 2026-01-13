# FIX: Document Accumulator API + Keep-Alive system + Auth configuration

## Summary
Critical fixes for Document Accumulator + Keep-Alive system implementation + Authentication configuration.

## Changes (6 commits)

### 1. Document Accumulator API Fix (8662772)
- Fixed API path mismatch: added `/api/v1` prefix to router
- Frontend was calling `/api/v1/accumulator/summarize/file`
- Backend router had only `/accumulator` prefix
- **Fixes:** 404 errors on document upload

### 2. Keep-Alive System (a20480a)
- Implemented Keep-Alive system to prevent Render Free Tier sleep
- Added secure `/healthcheck` endpoints (all 3 services)
- GitHub Actions workflow: ping every 14 minutes with retry logic
- Clean logs: excluded healthcheck from access logs
- **Files:** `.github/workflows/keep-alive.yml`, `KEEP_ALIVE_SETUP.md` (460 lines)
- **Benefits:** Zero 30s cold starts, 24/7 uptime, $0 cost

### 3. Keep-Alive Documentation (27f8222)
- Updated `CLAUDE.md` with Keep-Alive system documentation (v1.3.4)
- Comprehensive setup guide with security features

### 4. Document Summary Modal + Parser Fix (4217880)
- Fixed modal opening on any page click (stopPropagation)
- Fixed parser 'str' object error (removed str() wrapper, parse expects Path)
- **Fixes:** Critical 500 Internal Server Error on file upload

### 5. Security Documentation (57eeafe)
- Created `.env.production`, `.env.example`, `SECURITY.md`
- Updated `.gitignore` to allow `.env.production` commits
- Authentication controlled via `VITE_DISABLE_AUTH` environment variable

### 6. Auth Bypass Re-enabled (d912fb9)
- Re-enabled auth bypass for development (по запросу пользователя)
- Changed console.warn → console.info (less scary message)

## Testing

All changes tested locally:
- ✅ Document Accumulator API endpoints responding
- ✅ Modal close handlers working
- ✅ Parser accepts Path objects correctly
- ✅ Keep-Alive endpoints secured with X-Keep-Alive-Key
- ✅ Authentication bypass working in development

## Deployment Required

After merge, configure secrets:
1. Generate key: `openssl rand -base64 32`
2. Add to GitHub Secrets: `KEEP_ALIVE_KEY`
3. Add to Render Environment Variables (all 3 services):
   - concrete-agent
   - monolit-planner
   - stavagent-portal

## Breaking Changes

None - all changes backward compatible.

## Files Modified

**concrete-agent:**
- `packages/core-backend/app/api/routes_accumulator.py`
- `packages/core-backend/app/main.py`
- `render.yaml` (autoDeploy: true)

**monolit-planner:**
- `backend/server.js`

**stavagent-portal:**
- `frontend/src/pages/PortalPage.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/.env.production`, `.env.example`
- `frontend/SECURITY.md`
- `backend/server.js`

**root:**
- `.github/workflows/keep-alive.yml`
- `KEEP_ALIVE_SETUP.md`
- `CLAUDE.md`

## How to Create PR

1. Go to: https://github.com/alpro1000/STAVAGENT/compare/main...claude/fix-excel-import-kpi-JFqYB
2. Click "Create pull request"
3. Copy this description into PR body
4. Click "Create pull request"

## After Merge

Services will auto-deploy (concrete-agent has `autoDeploy: true`).

Then configure Keep-Alive secrets as described above.
