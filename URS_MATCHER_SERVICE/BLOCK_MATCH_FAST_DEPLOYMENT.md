# BLOCK-MATCH-FAST: Deployment & Testing Guide

**Version:** 1.0
**Last Updated:** 2025-12-10
**Status:** ✅ Ready for Deployment

---

## 🚀 Pre-Deployment Checklist

### 1. Code Files Check
```bash
# Verify all 4 new services are created
ls -la backend/src/services/ | grep -E "(geminiBlockClassifier|ursLocalMatcher|mappingCacheService)\.js"

# Output should be:
# ✅ geminiBlockClassifier.js (330+ lines)
# ✅ ursLocalMatcher.js (380+ lines)
# ✅ mappingCacheService.js (280+ lines)
# ✅ perplexityClient.js (updated with selectBestCandidate function)
```

### 2. Endpoint Check
```bash
# Verify /block-match-fast endpoint is in jobs.js
grep -n "'/block-match-fast'" backend/src/api/routes/jobs.js

# Output should show: Line 1829: router.post('/block-match-fast', ...)
```

### 3. Database Schema Check
```bash
# Verify kb_mappings table exists and is indexed
sqlite3 data/urs_matcher.db ".schema kb_mappings"

# Should see:
# - normalized_text_cs (indexed)
# - context_hash (indexed)
# - urs_code (indexed)
# - confidence (indexed)
```

---

## 📦 Installation Steps

### Step 1: Pull Latest Code
```bash
cd /home/user/STAVAGENT/URS_MATCHER_SERVICE
git pull origin main

# Or if working on branch:
git fetch origin claude/update-gemini-docs-01XFZBm5SqiPzfUGUGesCZXV
git checkout claude/update-gemini-docs-01XFZBm5SqiPzfUGUGesCZXV
```

### Step 2: Verify Dependencies
```bash
cd backend
npm list | grep -E "(google-generativeai|string-similarity|sqlite)"

# Should see:
# ✅ google-generativeai (for Gemini)
# ✅ sqlite (database driver)

# If missing, install:
npm install google-generativeai@0.8.3
```

### Step 3: Database Initialization
```bash
# The schema is auto-created on startup, but verify:
npm run db:init  # If this command exists

# Or manually check:
sqlite3 data/urs_matcher.db "SELECT COUNT(*) FROM kb_mappings;"
# Should return: 0 (if new) or existing count
```

### Step 4: Environment Variables
```bash
# Add to .env (or set in Render dashboard):

# Gemini (for classification)
GOOGLE_API_KEY=your-google-gemini-key-here
GEMINI_MODEL=gemini-2.0-flash-exp

# Perplexity (for selection)
PERPLEXITY_API_KEY=your-perplexity-key-here
PERPLEXITY_CONFIG.enabled=true
PERPLEXITY_CONFIG.timeoutMs=15000

# Logging
LOG_LEVEL=info  # Use 'debug' to see detailed logs
```

### Step 5: Start Service
```bash
# Local development
npm run dev

# Expected logs:
# [DB] Connected to: file:./data/urs_matcher.db
# [DB] Schema initialized
# [Gemini-Classifier] Ready (using google-generativeai v0.8.3)
# [URS-LocalMatcher] Ready (3 indexes on kb_mappings)
# [Server] Listening on http://localhost:3001
```

---

## 🧪 Testing: Step by Step

### Test 1: Health Check
```bash
curl http://localhost:3001/health
# Expected: { "status": "ok" }
```

### Test 2: Single Row Matching (Old Endpoint)
```bash
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Základové pasy z betonu C30/37",
    "quantity": 10,
    "unit": "m3",
    "use_llm": false
  }'

# Expected response:
# {
#   "candidates": [
#     {
#       "urs_code": "274313821",
#       "urs_name": "Základové pasy z betonu C30/37",
#       "confidence": 0.95
#     }
#   ],
#   "processing_time_ms": 45
# }
```

### Test 3: Block-Match-Fast with Small File
```bash
# Create test file (test_boq.csv):
# description,quantity,unit
# Základové pasy z betonu C30/37,10,m3
# Bednění patek,20,m2
# Výztuž B 500,500,kg

curl -X POST http://localhost:3001/api/jobs/block-match-fast \
  -F "file=@test_boq.csv" \
  -F "project_context={\"building_type\":\"bytový dům\",\"storeys\":4,\"main_system\":[\"monolitický ŽB\"]}"

# Expected response time: 3-8 seconds
# Status: "completed"
# blocks_count: 3 (Betonové konstrukce, Bednění, Výztuž)
```

### Test 4: Logs Inspection
```bash
# Check logs for performance metrics:
tail -50 logs/app.log | grep -i "block-match-fast"

# Expected log lines:
# [BLOCK-MATCH-FAST] Job abc-123 started
# [GEMINI-CLASSIFIER] Classifying rows with Gemini...
# [GEMINI-CLASSIFIER] Classification done: 3 blocks in 2150ms (source: gemini)
# [URS-LOCAL] Cache HIT: 274313821 (confidence: 0.98)
# [URS-LOCAL] Found 3 candidates, best confidence: 0.92
# [BLOCK-MATCH-FAST] Job abc-123 COMPLETE in 8340ms
```

### Test 5: Cache Verification
```bash
# After first request, check if mappings were cached:
sqlite3 data/urs_matcher.db "SELECT COUNT(*) FROM kb_mappings;"

# Should return: > 0 (if new) or increased count

# Check specific mapping:
sqlite3 data/urs_matcher.db "
  SELECT normalized_text_cs, urs_code, confidence, usage_count
  FROM kb_mappings
  LIMIT 5;
"

# Expected:
# Základové pasy z betonu C30/37|274313821|0.95|2
# (usage_count increases on each cache hit)
```

### Test 6: Perplexity Queue Test
```bash
# Create file with ambiguous items that need Perplexity help:
# description,quantity,unit
# Úprava desek přehlazením,100,m2
# Speciální bitumenová izolace,50,m2
# Kompletace drenážní vrstvy,30,m2

curl -X POST http://localhost:3001/api/jobs/block-match-fast \
  -F "file=@complex_boq.csv" \
  -F "project_context={\"building_type\":\"bytový dům\",\"storeys\":4}"

# Expected:
# - Some items: source "local_match" (~1ms each)
# - Some items: source "perplexity_selection" (~3-5s each)
# - Total time: 15-25 seconds
# - Log: "Processing Perplexity queue: X items (sequential)"
```

### Test 7: Error Scenarios

#### Test 7a: Empty File
```bash
# Create empty CSV
echo "" > empty.csv

curl -X POST http://localhost:3001/api/jobs/block-match-fast \
  -F "file=@empty.csv" \
  -F "project_context={}"

# Expected: 400 error "No data rows found in file"
```

#### Test 7b: Invalid Project Context
```bash
curl -X POST http://localhost:3001/api/jobs/block-match-fast \
  -F "file=@test_boq.csv" \
  -F "project_context=INVALID_JSON"

# Expected: Service uses default context, continues processing
# Log: "[BLOCK-MATCH-FAST] Invalid project context, using defaults"
```

#### Test 7c: Gemini Timeout (Simulate)
```bash
# Modify environment:
export GEMINI_CLASSIFICATION_TIMEOUT=100  # 100ms (too short)

# Try request - should fallback to local classifier
curl -X POST http://localhost:3001/api/jobs/block-match-fast \
  -F "file=@test_boq.csv" \
  -F "project_context={...}"

# Expected log:
# [GEMINI-CLASSIFIER] Gemini classification failed
# [GEMINI-CLASSIFIER] Falling back to local keyword-based classification
# classification_source: "local_fallback"
```

---

## 📊 Performance Monitoring

### Expected Benchmarks

| File Size | Expected Time | Components |
|-----------|---------------|-----------|
| 10 rows | 2-5s | Mostly local matches |
| 50 rows | 5-15s | Mix of local & Perplexity |
| 100 rows | 10-30s | Sequential queue processing |
| 200 rows | 20-60s | Multiple Perplexity batches |

### Metrics to Track

```bash
# In logs, look for:
[BLOCK-MATCH-FAST] Classification done: X blocks in XXXms
[BLOCK-MATCH-FAST] Block "name" done in XXXms
[URS-LOCAL] Matched in XXXms
[Perplexity] Processing Perplexity queue: X items
[BLOCK-MATCH-FAST] Job completed in XXXms

# Performance is good if:
✅ Classification: < 5s (Gemini)
✅ Local match per row: < 100ms
✅ Perplexity per row: 2-5s
✅ Total for 100 rows: < 30s
```

### Database Query Performance

```bash
# Check if indexes are being used:
sqlite3 data/urs_matcher.db

# EXPLAIN QUERY PLAN
EXPLAIN QUERY PLAN
SELECT * FROM kb_mappings
WHERE normalized_text_cs = 'test'
AND context_hash = 'hash123';

# Expected: SEARCH kb_mappings USING idx_kb_normalized_text
```

---

## 🔍 Troubleshooting

### Issue 1: "GOOGLE_API_KEY not set"
```
Error: [GEMINI-CLASSIFIER] GOOGLE_API_KEY not set

Solution:
1. Check .env file: echo $GOOGLE_API_KEY
2. If empty, set it: export GOOGLE_API_KEY=sk-...
3. Restart service: npm run dev
```

### Issue 2: "Gemini timeout after 20000ms"
```
Error: [GEMINI-CLASSIFIER] Gemini timeout after 20000ms

Causes:
1. Gemini API slow (cold start)
2. Network latency
3. Large prompt (> 50 rows per chunk)

Solution:
1. Check network: ping -c 1 generativelanguage.googleapis.com
2. Verify chunking: MAX_ROWS_PER_CHUNK should be 50
3. Restart service to clear cache
4. Check Gemini quota at https://aistudio.google.com/
```

### Issue 3: "Classification source: local_fallback"
```
Info: classification_source: "local_fallback"

Meaning:
- Gemini failed (timeout/error)
- Using local keyword-based classification
- Result quality may be lower

Action:
1. Check Gemini API status
2. Monitor Render logs for errors
3. Increase GEMINI_CLASSIFICATION_TIMEOUT if needed
```

### Issue 4: "No candidates found"
```
response: {
  "rows_count": 3,
  "items": [
    { "urs_code": null, "source": "not_found" }
  ]
}

Causes:
1. Description too vague/misspelled
2. Not in local urs_items catalog
3. Perplexity API disabled

Solution:
1. Verify description is in Czech
2. Check urs_items catalog: SELECT * FROM urs_items LIMIT 10
3. Enable Perplexity: PERPLEXITY_CONFIG.enabled = true
```

### Issue 5: "502 Bad Gateway on /block-match-fast"
```
Error: 502 Bad Gateway

Common causes:
1. Gemini timeout (20s) → Entire endpoint times out
2. Perplexity sequential queue too long
3. DB locked (too many concurrent requests)

Solution:
1. Use smaller files (< 50 rows)
2. Check Gemini status at aistudio.google.com
3. Restart service
4. Check logs: tail -100 logs/error.log
```

---

## 📈 Rollout Strategy

### Phase 1: Testing (1-2 days)
- [ ] Deploy to development environment
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Performance benchmarks
- [ ] Error scenario testing

### Phase 2: Staging (2-3 days)
- [ ] Deploy to staging environment
- [ ] User acceptance testing
- [ ] Load testing (simulate 100+ concurrent users)
- [ ] Monitor logs & metrics
- [ ] Frontend compatibility check

### Phase 3: Production (1 day)
- [ ] Blue-green deployment (old endpoint still available)
- [ ] Monitor response times
- [ ] Check error rates
- [ ] Verify cache hit rates
- [ ] Gradual traffic shift to /block-match-fast

### Phase 4: Cleanup (after 1-2 weeks)
- [ ] Confirm /block-match-fast is stable
- [ ] Deprecate old /block-match endpoint
- [ ] Archive logs
- [ ] Update documentation

---

## ✅ Production Verification

After deployment to production, run this checklist:

```bash
# 1. Health check
curl https://urs-matcher-service.onrender.com/health
# Expected: { "status": "ok" }

# 2. Sample request
curl -X POST https://urs-matcher-service.onrender.com/api/jobs/block-match-fast \
  -F "file=@sample_boq.xlsx" \
  -F "project_context={...}"
# Expected: Response in < 30s, blocks_count > 0

# 3. Check logs (Render dashboard)
# Expected: "Classification done in XXXms"
# Expected: "Job completed in XXXms"
# NOT expected: "Gemini timeout"

# 4. Verify cache is working
# Run same request twice
# Second request should be much faster (cache hits)

# 5. Monitor performance
# Use Render metrics dashboard:
# - Response time: < 30s for typical BOQ
# - Error rate: < 1%
# - Cache hit rate: > 70%
```

---

## 📝 Rollback Plan

If issues occur in production:

### Option 1: Revert to Old Endpoint
```bash
# Frontend code to try /block-match-fast first, fallback to /block-match:

async function analyzeBoq(file, context) {
  try {
    // Try new optimized endpoint
    return await fetch('/api/jobs/block-match-fast', {
      method: 'POST',
      body: formData
    });
  } catch (error) {
    console.warn('block-match-fast failed, falling back to block-match');

    // Fallback to old endpoint
    return await fetch('/api/jobs/block-match', {
      method: 'POST',
      body: formData
    });
  }
}
```

### Option 2: Disable Perplexity
```bash
# If Perplexity causes issues:
export PERPLEXITY_CONFIG.enabled=false

# Service will use only local matching
# Results quality may be lower, but system stable
# Response time: 5-10s (very fast!)
```

### Option 3: Disable Gemini Classification
```bash
# If Gemini causes issues:
export GEMINI_CLASSIFICATION_TIMEOUT=500  # Very short timeout

# Service will immediately fallback to local keyword-based
# Results quality: ~80% of normal, but very fast
# Response time: 2-5s
```

---

## 📞 Support

If issues persist:

1. **Check logs:** Render dashboard → Logs tab
2. **Monitor metrics:** Render dashboard → Metrics tab
3. **Database health:** `sqlite3 data/urs_matcher.db ".tables"`
4. **API health:** `curl /health endpoint`
5. **LLM status:**
   - Gemini: https://aistudio.google.com/
   - Perplexity: Check API quota
6. **Contact:** Open issue on GitHub

---

**Version:** 1.0
**Last Updated:** 2025-12-10
**Status:** ✅ Ready for Deployment
