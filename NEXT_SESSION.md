# NEXT SESSION TASKS

**Created:** 2025-12-09
**Service:** URS_MATCHER_SERVICE
**Branch:** `claude/add-system-docs-01YAV6C3qDGnjPg3DMTPrsbi`

---

## Session Summary (2025-12-09)

### Completed Tasks
- [x] Fixed race condition with global `currentProviderIndex` → per-request index
- [x] Fixed stack overflow risk → converted recursion to iteration (`getProviderAtIndex`)
- [x] Fixed resource leaks → added `finally` blocks for `clearTimeout`
- [x] Fixed fallback using wrong client → use `WithClient` versions
- [x] Fixed global `llmClient` mutation → no more race conditions
- [x] Added failed provider cache → skip known-bad providers for 60s
- [x] Fixed Multi-Role health endpoint `/api/v1/health` → `/health`
- [x] Updated `.env.example` with `LLM_TIMEOUT_MS=90000`
- [x] All 159 tests passing

### Commits (on branch `claude/add-system-docs-01YAV6C3qDGnjPg3DMTPrsbi`)
```
0662ec8 PERF: Add failed provider cache to skip known-bad providers
e2fee86 FIX: Remove global state mutation in LLM fallback (race condition)
371c021 FIX: Improve LLM error visibility and increase timeouts
774ab93 FIX: Race condition, stack overflow, and resource leaks in LLM client
```

### Key Code Changes

**llmClient.js - Failed Provider Cache:**
```javascript
const recentlyFailedProviders = new Map();
const PROVIDER_FAILURE_CACHE_MS = 60000; // 60 seconds

function isProviderRecentlyFailed(providerName) { ... }
function markProviderFailed(providerName) { ... }
```

**llmClient.js - Per-Request Fallback (no global state):**
```javascript
// Each request has its own currentIndex
let currentIndex = 0;
while (currentIndex < fallbackChain.length) {
  const { provider, nextIndex } = getProviderAtIndex(currentIndex, skipProvider);
  // Use provider...
  currentIndex = nextIndex;
}
```

**multiRoleClient.js - Correct Health Endpoint:**
```javascript
// Before: /api/v1/health (WRONG)
// After: /health (CORRECT)
const response = await fetch(`${STAVAGENT_API_BASE}/health`, { ... });
```

---

## Tasks for Next Session

### Priority 1: Merge PR and Deploy

**Goal:** Merge branch to main and deploy to Render

```bash
# Merge the PR (4 commits)
git checkout main
git pull origin main
git merge claude/add-system-docs-01YAV6C3qDGnjPg3DMTPrsbi
git push origin main
```

**CRITICAL: Update Render Environment Variables**
```
LLM_TIMEOUT_MS=90000
```

---

### Priority 2: Verify Production Fixes

**Goal:** Confirm all fixes work in production

**Expected Logs (Success):**
```
[LLMClient] Primary provider claude succeeded
[MULTI-ROLE] API available at https://concrete-agent.onrender.com
```

**Expected Logs (Graceful Fallback):**
```
[LLMClient] Primary provider claude failed: timeout. Trying fallback...
[LLMClient] Marked claude as failed (will skip for 60s)
[LLMClient] Trying fallback provider: gemini
[LLMClient] Fallback to gemini succeeded for this request
```

**Expected Logs (Provider Cache Working):**
```
[LLMClient] Skipping primary provider claude (recently failed), going straight to fallback
[LLMClient] Skipping claude - failed 45s ago
```

---

### Priority 3: Test with Real BOQ File

**Test Scenario:**
1. Upload Czech construction BOQ (Výkaz výměr)
2. Enable TŘÍDNÍK grouping
3. Verify:
   - [ ] Processing completes < 2 minutes
   - [ ] Blocks have items (not just headers)
   - [ ] Items have URS codes with confidence scores
   - [ ] No "All LLM providers failed" errors

---

### Priority 4: Monitor Performance

**What to Watch:**
1. How often does primary provider fail?
2. How often does fallback succeed?
3. Is 60s cache duration appropriate?

**If All Providers Fail:**
1. Check API keys in Render env
2. Check rate limits on Claude/Gemini/OpenAI
3. Consider increasing `LLM_TIMEOUT_MS` to 120s

---

## Architecture Reference

### LLM Fallback Chain (llmClient.js)
```
Request arrives
     │
     ▼
Check if primary provider recently failed (60s cache)
     │
     ├─ No → Try primary provider
     │         │
     │         ├─ Success → Return result
     │         └─ Fail → Mark as failed, try fallback
     │
     └─ Yes → Skip to fallback chain
               │
               ▼
          For each fallback provider:
               │
               ├─ Skip if recently failed (60s cache)
               ├─ Try provider (own AbortController)
               ├─ Success → Return result (don't update global state)
               └─ Fail → Mark as failed, continue
               │
               ▼
          All failed → throw Error
```

### Key Files
```
backend/src/config/llmConfig.js     ← Timeout: 90000ms
backend/src/services/llmClient.js   ← Fallback chain + provider cache
backend/src/services/multiRoleClient.js ← Health: /health (not /api/v1/health)
```

---

## Session Start Checklist

When starting the next session:

1. [ ] Read `/CLAUDE.md` for full system context
2. [ ] Check git status: `git status`
3. [ ] Check current branch: `git branch`
4. [ ] Check if PR merged: `git log --oneline -5 origin/main`
5. [ ] Run tests: `cd URS_MATCHER_SERVICE/backend && npm test`
6. [ ] Check Render logs for production behavior

---

**Tests:** 159 passing
**Branch Status:** Ready to merge
