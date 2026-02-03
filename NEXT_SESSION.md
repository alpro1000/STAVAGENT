# Next Session - Quick Start

**Last Updated:** 2026-02-03 (09:00 UTC)
**Current Branch:** `claude/test-pdf-extraction-7MpQt`
**Last Session:** Deployment Timeout Fixes + Document Extraction Testing

---

## 🚀 Quick Start Commands

```bash
# Current working directory
cd /home/user/STAVAGENT

# Check branch and status
git status
git log --oneline -5

# Pull latest changes
git pull origin claude/test-pdf-extraction-7MpQt

# Start development (choose service)
cd URS_MATCHER_SERVICE/backend && npm run dev        # URS Matcher backend
cd URS_MATCHER_SERVICE/frontend && npm run dev       # URS Matcher frontend
cd Monolit-Planner/backend && npm run dev            # Monolit backend
cd Monolit-Planner/frontend && npm run dev           # Monolit frontend
cd concrete-agent && npm run dev:backend             # CORE backend
```

---

## 📋 Recent Work (2026-02-03)

### ✅ LATEST: Deployment Timeout Fixes (09:00 UTC)

**Problems Fixed:**
1. **Redis Connection Hang** - Deployment timeout (15+ minutes) due to Redis connection without timeout
2. **MinerU Parsing Timeout** - 2-minute timeout insufficient for cold start + large PDF parsing

**Solutions:**
- `6d1ca88` - FIX: Add Redis connection timeout (10s) + fallback to in-memory cache
- `08c43bd` - FIX: Increase MinerU timeout to 5 minutes for cold start + large PDFs

**Files changed:**
- `URS_MATCHER_SERVICE/backend/src/services/cacheService.js` (+27 -11)
- `URS_MATCHER_SERVICE/backend/src/services/documentExtractionService.js` (+9 -2)

**Status:** ✅ Pushed, awaiting Render deployment (2-3 minutes)

**Details:** See `DEPLOYMENT_FIX_2026-02-03.md`

---

### ✅ Completed Earlier: Document Work Extraction Pipeline

**What was built:**
- Full pipeline: PDF → MinerU → LLM → TSKP → Deduplication → Batch
- Backend: `documentExtractionService.js` (520 lines)
- Frontend: Extraction UI with stats cards and confidence badges
- Export to Excel + Send to Batch integration

**Commits:**
- `714b306` - FEAT: Add Document Work Extraction Pipeline
- `b76de3a` - FIX: Document extraction service import error
- `b4a2cc7` - FIX: Use correct Workflow C endpoint for document parsing

**Session Summary:** See `docs/archive/completed-sessions/SESSION_2026-02-03_DOCUMENT_EXTRACTION.md`

---

## 🎯 Next Tasks (Priority Order)

### 1. Test Document Extraction (High Priority)
- [ ] Test with real PDF documents (sample: `203_01_Techn zprava.pdf`)
- [ ] Verify MinerU parsing works correctly
- [ ] Check LLM extraction produces valid structured data
- [ ] Test TSKP matching accuracy
- [ ] Verify deduplication (85% threshold)
- [ ] Test Excel export (UTF-8 BOM encoding)
- [ ] Test "Send to Batch" integration

### 2. Monitor Performance
- [ ] Check MinerU response times (target: <2 min)
- [ ] Monitor LLM extraction times (target: <90s)
- [ ] Check memory usage for large PDFs
- [ ] Analyze TSKP matching performance

### 3. Edge Case Testing
- [ ] Empty PDF (no works found)
- [ ] Large PDF (>10MB, 100+ pages)
- [ ] Non-Czech documents (language detection)
- [ ] Malformed Excel files
- [ ] Network timeout scenarios

### 4. Optimization (If Needed)
- [ ] Add caching for parsed documents (by file hash)
- [ ] Parallel LLM calls for large work lists
- [ ] Batch TSKP matching (instead of sequential)
- [ ] Progressive UI updates (stream results)

### 5. Documentation Updates
- [ ] Update `CLAUDE.md` with Document Extraction section
- [ ] Update `URS_MATCHER_SERVICE/README.md`
- [ ] Add API documentation for `/api/jobs/document-extract`
- [ ] Create user guide for "Nahrát Dokumenty" workflow

---

## 🔧 Known Issues

### ✅ All Fixed (2026-02-03 09:00 UTC)
✅ Redis connection hang → Fixed with 10s timeout + fallback
✅ MinerU parsing timeout → Fixed with 5-minute timeout
✅ Import error resolved (llmClient named exports)
✅ API endpoint error resolved (Workflow C)

### ⚠️ Performance Considerations
- **Cold Start:** concrete-agent may take 30-60s to wake up (Render Free tier)
- **First PDF parse:** May take 2-4 minutes (cold start + parsing)
- **Subsequent parses:** 1-2 minutes (warm instance)
- **Keep-Alive:** GitHub Actions cron runs every 14 minutes to prevent sleep

---

## 🏗️ Architecture Context

### Document Extraction Flow
```
User uploads PDF/DOCX
    ↓
Frontend: DocumentUpload.html → "🔬 Extrahovat Práce" button
    ↓
POST /api/jobs/document-extract (jobs.js)
    ↓
documentExtractionService.js:
    1. parseDocumentWithMinerU() → concrete-agent Workflow C
    2. extractWorksWithLLM() → LLM with JSON/free-form fallback
    3. matchToTSKP() → tskpParserService (64,737 items)
    4. deduplicateWorks() → 85% Levenshtein similarity
    5. groupBySection() → Construction sections
    ↓
Return structured results with stats
    ↓
Frontend: displayExtractedWorks() → Render UI
    ↓
User actions:
    - Export to Excel (CSV with UTF-8 BOM)
    - Send to Batch processor
```

### Integration Points
1. **concrete-agent** - `/api/v1/workflow/c/upload`
   - MinerU parser (magic-pdf)
   - Document text extraction
   - Requires: project_id, project_name, generate_summary, use_parallel, language

2. **llmClient** - `callLLMForTask(TASKS.BLOCK_ANALYSIS, ...)`
   - Task-based model routing
   - Fallback chain: Gemini → Claude → OpenAI
   - 90s timeout

3. **tskpParserService** - `search(searchText, limit)`
   - TSKP classifier (64,737 work items)
   - Confidence scoring (exact match, name match, word match, fuzzy)
   - Returns: tskp_code, name, confidence, parent_code

---

## 📝 Important Notes

### Deployment
- **Branch:** `claude/test-pdf-extraction-7MpQt`
- **Must start with:** `claude/`
- **Must end with:** matching session ID
- **Push command:** `git push -u origin claude/test-pdf-extraction-7MpQt`

### Git Retry Logic
- **Fetch/Pull/Push failures:** Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
- **Network errors only:** Don't retry permission errors

### Testing
- Use real PDF: `203_01_Techn zprava.pdf` (4.3MB)
- Expected: 40-50 work items extracted
- Expected sections: Zemní práce, Základy, Nosné konstrukce, Izolace, Komunikace, Doprava

---

## 🔍 Debug Commands

```bash
# Check URS Matcher logs
cd /home/user/STAVAGENT/URS_MATCHER_SERVICE/backend
npm run dev

# Check concrete-agent logs (if needed)
cd /home/user/STAVAGENT/concrete-agent
npm run dev:backend

# Test API endpoint directly
curl -X POST http://localhost:3001/api/jobs/document-extract \
  -F "file=@/path/to/document.pdf" \
  -H "Content-Type: multipart/form-data"

# Check TSKP parser
cd /home/user/STAVAGENT/URS_MATCHER_SERVICE/backend
node -e "
  const tskp = require('./src/services/tskpParserService.js').default;
  tskp.load().then(() => {
    const results = tskp.search('výkop stavební jámy', 5);
    console.log(JSON.stringify(results, null, 2));
  });
"
```

---

## 📚 Documentation Files

### Main Documentation
- `CLAUDE.md` - System overview (v2.0.1)
- `NEXT_SESSION.md` - **THIS FILE** - Quick start for next session
- `BACKLOG.md` - Pending tasks and priorities
- `README.md` - Project overview (Russian)

### Service Documentation
- `concrete-agent/CLAUDE.md` - CORE system (v2.4.1)
- `Monolit-Planner/CLAUDE.MD` - Monolit kiosk (v4.3.8)
- `rozpocet-registry/README.md` - BOQ Registry (v2.1.0)
- `URS_MATCHER_SERVICE/README.md` - URS Matcher

### Session Archives
- `docs/archive/completed-sessions/SESSION_2026-02-03_DOCUMENT_EXTRACTION.md` - Latest session
- Previous sessions in same directory

---

## 🚦 Service Status

| Service | Status | URL | Port (Dev) |
|---------|--------|-----|------------|
| concrete-agent | ✅ Running | https://concrete-agent.onrender.com | 8000 |
| stavagent-portal | ✅ Running | https://stav-agent.onrender.com | 3001 |
| Monolit-Planner API | ✅ Running | https://monolit-planner-api.onrender.com | 3001 |
| Monolit-Planner Frontend | ✅ Running | https://monolit-planner-frontend.onrender.com | 5173 |
| URS_MATCHER_SERVICE | ✅ Running | https://urs-matcher-service.onrender.com | 3001 (BE), 3000 (FE) |
| rozpocet-registry | ✅ Static | Vercel | 5173 |

---

## 🎓 Context for Claude

### What Just Happened (Latest Session)
**Fixed critical deployment issues:**
1. ✅ **Redis connection hang** - Added 10s timeout + Promise.race + fallback to in-memory cache
2. ✅ **MinerU parsing timeout** - Increased from 2 minutes to 5 minutes for cold start + large PDFs

**Previous Work:**
Complete Document Work Extraction Pipeline implementation (PDF → MinerU → LLM → TSKP → Batch)

### Key Technical Decisions
- **Redis timeout strategy:** 10s connection timeout + graceful fallback (no crash)
- **MinerU timeout:** 5 minutes (300000ms) for cold start + parsing
- **Workflow C endpoint** (`/api/v1/workflow/c/upload`) - Requires project_id, project_name, etc.
- **JSON + Free-form fallback** - Handles both structured and unstructured LLM responses
- **85% similarity threshold** - Balance between accuracy and deduplication

### Current State
- ✅ All deployment fixes committed and pushed
- ✅ Awaiting Render deployment (2-3 minutes)
- ✅ Document extraction pipeline complete
- ⏳ Production testing pending

### Next Actions
1. **Verify deployment** - Check URS service starts successfully
2. **Test PDF extraction** - Use `203_01_Techn zprava.pdf` (4.3 MB)
3. **Monitor performance** - Measure cold start vs warm times
4. **Edge case testing** - Large files, non-Czech docs, network issues
5. **Optimization** - Cache, parallelization if needed

---

**Ready for next session!** 🚀
