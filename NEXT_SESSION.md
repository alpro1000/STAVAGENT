# NEXT SESSION TASKS

**Created:** 2025-12-06
**Service:** URS_MATCHER_SERVICE
**Branch:** `claude/urs-matcher-architecture-012wZshjJSLtv2m62cgd6D1d`

---

## Session Summary (Previous)

### Completed Tasks
- [x] Fixed LLM timeout (30s → 90s) in `llmConfig.js`
- [x] Fixed AbortController bug in `llmClient.js` (each provider gets own controller)
- [x] Connected Multi-Role to `https://concrete-agent.onrender.com`
- [x] Created local Multi-Role fallback (`multiRoleLocalClient.js`)
- [x] Full repository revision and documentation
- [x] Created root `CLAUDE.md` with system architecture

### Commits
```
1d00228 FIX: Connect Multi-Role to concrete-agent.onrender.com (Core)
4e11afa FEAT: Add local Multi-Role AI validation (no external API required)
517fe95 FIX: LLM timeout issues causing empty results on Render
```

---

## Tasks for Next Session

### Priority 1: Deploy and Verify Fixes

**Goal:** Verify all fixes work on production (Render)

```bash
# 1. Merge branch to main
git checkout main
git merge claude/urs-matcher-architecture-012wZshjJSLtv2m62cgd6D1d
git push origin main

# 2. Check Render deployment
# URL: https://urs-matcher-service.onrender.com

# 3. Test with real BOQ file
# Expected: Blocks with items (not just headers)
```

**Verification Checklist:**
- [ ] LLM calls complete without timeout
- [ ] Fallback chain works (Claude → Gemini → OpenAI)
- [ ] Multi-Role API calls reach concrete-agent
- [ ] Results include item details (not just block headers)

---

### Priority 2: Check Multi-Role Integration Logs

**Goal:** Verify Multi-Role API is actually being called

**What to check in Render logs:**
```
[INFO] [JOBS] Multi-Role API available: true
[INFO] [JOBS] Multi-Role validation result: ...
```

**If logs show:** `Multi-Role API not available`
- Check `STAVAGENT_API_URL` environment variable on Render
- Should be: `https://concrete-agent.onrender.com`

---

### Priority 3: Test End-to-End Flow

**Test Scenario:**
1. Upload real BOQ Excel file (e.g., bridge estimate)
2. Wait for processing (should be < 2 minutes with 90s timeout)
3. Verify results:
   - Blocks have items
   - Items have URS codes
   - Confidence scores present
   - Multi-Role validation applied

**Test Files:**
- Use Czech construction BOQ (Výkaz výměr)
- Test with TŘÍDNÍK grouping enabled

---

### Priority 4: Performance Optimization (If Needed)

**If timeouts still occur:**
1. Consider increasing `LLM_TIMEOUT_MS` to 120s
2. Add request chunking for large BOQ files
3. Implement progress updates via WebSocket

**If Multi-Role slow:**
1. Add caching for repeated queries
2. Consider batch validation instead of per-item

---

### Priority 5: Documentation Updates

**Files to update after verification:**
- [ ] `/URS_MATCHER_SERVICE/DEPLOYMENT.md` - Add production config
- [ ] `/URS_MATCHER_SERVICE/README.md` - Update with current features
- [ ] `/CLAUDE.md` - Update status after deployment

---

## Known Issues to Monitor

### Issue 1: LLM Provider Availability
- **Symptom:** All providers fail
- **Solution:** Check API keys, rate limits
- **Log pattern:** `All LLM providers failed or unavailable`

### Issue 2: Multi-Role API Unreachable
- **Symptom:** Validation skipped
- **Solution:** Check concrete-agent health, network
- **Log pattern:** `Multi-Role API not available`

### Issue 3: Frontend Timeout
- **Symptom:** UI shows error before backend completes
- **Solution:** Frontend timeout is 120s in `app.js`
- **Location:** `frontend/public/app.js` line with `setTimeout`

---

## Architecture Notes for Next Session

### URS_MATCHER_SERVICE Data Flow
```
Upload Excel → Parse → Group by TŘÍDNÍK
                          │
                          ▼
                   For each block:
                   ┌─────────────────────────────┐
                   │ 1. Search URS candidates    │
                   │    (ursMatcher.js)          │
                   │                             │
                   │ 2. LLM Re-ranking           │
                   │    (llmClient.js)           │
                   │                             │
                   │ 3. Multi-Role Validation    │
                   │    (multiRoleClient.js)     │
                   │    → concrete-agent API     │
                   └─────────────────────────────┘
                          │
                          ▼
                   Save to SQLite
                          │
                          ▼
                   Return results to Frontend
```

### Key Files to Remember
```
backend/src/config/llmConfig.js     ← Timeout settings
backend/src/services/llmClient.js   ← LLM fallback chain
backend/src/services/multiRoleClient.js ← CORE integration
backend/src/api/routes/jobs.js      ← Main processing logic
```

---

## Contact Points

- **concrete-agent CORE:** `https://concrete-agent.onrender.com`
- **Multi-Role API:** `POST /api/v1/multi-role/ask`
- **Health check:** `GET /health`

---

## Session Start Checklist

When starting the next session:

1. [ ] Read `/CLAUDE.md` for full system context
2. [ ] Check git status and current branch
3. [ ] Review Render deployment logs
4. [ ] Check if previous commits are deployed
5. [ ] Run tests: `npm test` in URS_MATCHER_SERVICE

---

**Good luck with the next session!**
