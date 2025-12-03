# QUICK REFERENCE - URS Matcher Service
## Ready-to-Use Checklists & Commands

---

## 🚀 START NEXT SESSION (First 10 minutes)

```bash
# 1. Navigate to project
cd /home/user/STAVAGENT

# 2. Check branch
git branch
# Should see: claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh

# 3. Read context (5 minutes)
cat URS_MATCHER_SERVICE/SESSION_SUMMARY_2025-12-03.md

# 4. Check status (1 minute)
cd URS_MATCHER_SERVICE
git log --oneline -5
npm test 2>&1 | tail -20

# 5. Read next actions (3 minutes)
cat NEXT_SESSION_GUIDE.md | head -50
```

**Expected Output:**
- 70/70 tests passing ✅
- 3 commits showing (42015c1, 4e28dab, 699c8b4)
- No uncommitted changes

---

## 📚 IMPORTANT FILES TO READ (In Order)

### Session 1: Context (5 min) 📖
```
URS_MATCHER_SERVICE/SESSION_SUMMARY_2025-12-03.md
├─ What was delivered
├─ Data structure now returned
├─ Phase completion (Phase 2: 70%, Phase 3: 75%)
└─ Next priorities (High/Medium/Optional)
```

### Session 2: How To Continue (3 min) 🗺️
```
URS_MATCHER_SERVICE/NEXT_SESSION_GUIDE.md
├─ Quick start instructions
├─ What's missing (Phase 2 Validator)
├─ Recommended next steps (7 tasks)
└─ Testing & debugging tips
```

### Session 3: What Changed (2 min) 📋
```
URS_MATCHER_SERVICE/FILES_STATUS.md
├─ All modified files with line numbers
├─ All created files with purpose
├─ Git tracking status
└─ What to do next
```

---

## 💻 RUNNING THE PROJECT

### Start Development Server
```bash
cd /home/user/STAVAGENT/URS_MATCHER_SERVICE
npm run dev
# Backend will run on http://localhost:5000
```

### Run Tests
```bash
npm test
# Expected: 70/70 tests passing

# Run specific test
npm test -- phase3Advanced.test.js

# Watch mode
npm test -- --watch
```

### Test API Endpoint
```bash
# Test block-match with simple payload
curl -X POST http://localhost:5000/api/jobs/block-match \
  -F "file=@sample.xlsx" \
  -F 'project_context={"building_type":"bytový dům","storeys":4}'

# Check response includes phase3_advanced object
```

---

## 🎯 CURRENT STATE SUMMARY

### What's Complete ✅
```
Phase 0   → 100% - Preparation
Phase 1   → 100% - Manual context + TŘÍDNÍK
Phase 1.5 → 100% - LLM integration
Phase 2   → 70%  - Doc upload UI done, parser integrated, validator MISSING
Phase 3   → 75%  - Orchestrator integrated, UI done, role temps MISSING
Phase 4   → 0%   - Optimization not started
```

### What Works Now 🚀
```
✅ Upload BOQ files
✅ See multi-role validation
✅ View complexity classification (SIMPLE/STANDARD/COMPLEX/CREATIVE)
✅ See which specialists were consulted
✅ View conflicts with severity (CRITICAL/HIGH/MEDIUM/LOW)
✅ Review audit trail timeline
✅ Download/copy results
```

### What's Missing 🔴
```
🔴 Phase 2 Document Validator Service
🔴 Phase 2 Document Upload Handlers
🔴 Phase 3 Role Temperature Configuration
🔴 Phase 4 Optimization (caching, performance)
```

---

## 📝 GIT WORKFLOW

### View Recent Commits
```bash
git log --oneline -10

# Output should show:
# 42015c1 DOCS: Session Summary, Next Session Guide & Files Status
# 4e28dab FEAT: Phase 3 Advanced Orchestrator Integration in Backend
# 699c8b4 FEAT: Phase 2 & 3 Frontend Integration
```

### Create Feature Branch (For new work)
```bash
git checkout -b feature/phase2-validator
# Do work...
git add .
git commit -m "FEAT: Phase 2 Document Validator"
git push -u origin feature/phase2-validator
```

### Merge Back to Main Branch
```bash
git checkout claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh
git merge feature/phase2-validator
git push
```

---

## 🧪 TESTING STRATEGY

### Unit Tests
```bash
# All tests
npm test

# Specific test file
npm test -- phase3Advanced.test.js
npm test -- ursMatcher.test.js
npm test -- fileParser.test.js

# Watch mode during development
npm test -- --watch
```

### Manual API Testing
```bash
# Test 1: Simple text match
curl -X POST http://localhost:5000/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{"text":"Beton C25/30","quantity":50,"unit":"m3"}'

# Test 2: File upload + block match
curl -X POST http://localhost:5000/api/jobs/block-match \
  -F "file=@test.xlsx" \
  -F 'project_context={"building_type":"bytový dům"}'

# Test 3: Get results
curl http://localhost:5000/api/jobs/{jobId}
```

### Frontend Testing (Browser)
```
1. Open browser DevTools (F12)
2. Go to http://localhost:5000
3. Try:
   - Upload file (existing feature)
   - Click "📄 Nahrát Dokumenty" (Phase 2 - NEW)
   - Run block-match (existing)
   - Check console for Phase 3 Advanced data
4. Verify in console:
   - No errors
   - currentResults.phase3_advanced exists
   - All sections rendering
```

---

## 🐛 DEBUGGING COMMANDS

### View Backend Logs
```bash
tail -f /path/to/logs/app.log
tail -f /path/to/logs/error.log
```

### Debug Node Process
```bash
NODE_DEBUG=* npm start
```

### Check Database
```bash
# If using SQLite
sqlite3 /path/to/database.db
> SELECT * FROM jobs;
> .quit
```

### Frontend Console Debugging
```javascript
// In browser console
console.log(currentResults)        // View all results
console.log(currentResults.phase3_advanced)  // View Phase 3 data
debugLog('Test message')           // Use existing logger
```

---

## 📂 IMPORTANT DIRECTORIES

```
/backend/
├── src/
│   ├── api/routes/jobs.js         ← Main endpoints
│   ├── services/
│   │   ├── multiRoleClient.js     ← Multi-role API client
│   │   └── roleIntegration/
│   │       ├── orchestrator.js    ← Phase 3 Advanced
│   │       └── conflictResolver.js
│   └── utils/
├── tests/
│   ├── phase3Advanced.test.js     ← Phase 3 tests (70/70)
│   └── ...
└── uploads/                        ← User uploaded files

/frontend/
├── public/
│   ├── index.html                 ← HTML structure
│   ├── app.js                     ← JavaScript logic
│   └── styles.css                 ← Styling
└── components/
    ├── DocumentUpload.html        ← Phase 2 component
    └── ContextEditor.html         ← Phase 2 component
```

---

## 🎯 NEXT SESSION TASKS (Priority Order)

### HIGH PRIORITY (3-4 hours)
```
1. Implement Document Validator Service
   File: /backend/src/services/documentValidatorService.js
   Returns: completeness_score, missing_documents

2. Add Document Upload API Handler
   File: /backend/src/api/routes/jobs.js
   Endpoint: POST /api/jobs/document-upload

3. Test Phase 2 End-to-End
   - Upload documents
   - Extract context
   - Display results
```

### MEDIUM PRIORITY (2-3 hours)
```
4. Add Role Temperature Configuration
   File: /backend/src/services/roleIntegration/roleTemperatures.js
   Values: 0.0-0.5 per role per task

5. Enhance Conflict Resolution UI
   Files: app.js, index.html, styles.css
   Features: Accept/Reject/Edit buttons
```

### OPTIONAL (Future)
```
6. Phase 4 Optimization - Caching
7. Phase 4 Optimization - Performance
8. Admin dashboard
9. User feedback collection
```

---

## ✅ SESSION COMPLETION CHECKLIST

Before ending session, verify:

- [ ] All modifications committed to git
- [ ] Git status clean: `git status` shows nothing
- [ ] All tests passing: `npm test` shows 70/70+
- [ ] Session summary updated with new work
- [ ] Next session guide updated with new priorities
- [ ] Files STATUS document updated
- [ ] Changes pushed: `git push -u origin claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh`

### Final Verification
```bash
# Confirm all work is saved
git log --oneline -3
git status
npm test 2>&1 | grep -E "passing|failing"
```

---

## 📊 PROGRESS TRACKING

### Session 2025-12-03 Achievements
```
✅ Phase 2 Frontend: 100% of UI done
✅ Phase 3 Advanced Frontend: 100% done
✅ Phase 3 Advanced Backend: 100% integrated
✅ Documentation: Complete (3 technical + 3 session docs)
✅ Tests: 70/70 passing
✅ Git: 3 commits pushed successfully

Overall Progress: Phase 2 (70%), Phase 3 (75%), System (65%)
```

### Next Session Target
```
🎯 Phase 2 Document Validator: 100% done
🎯 Phase 2 Integration: 100% tested
🎯 Phase 2 Completion: READY FOR PRODUCTION
🎯 Phase 3 Enhancements: Started
🎯 Overall Progress: Phase 2 (100%), Phase 3 (80%), System (72%)
```

---

## 🆘 NEED HELP?

### Read These First
1. `SESSION_SUMMARY_2025-12-03.md` - Overview
2. `NEXT_SESSION_GUIDE.md` - Detailed instructions
3. `FILES_STATUS.md` - What changed where
4. `SERVICE_LOGIC_DIAGRAM.md` - System flow
5. `SYSTEM_ARCHITECTURE_ANALYSIS.md` - Architecture

### Quick Answers
```
Q: Where's the main code?
A: /backend/src/api/routes/jobs.js (backend endpoints)
   /frontend/public/app.js (frontend logic)

Q: How to run tests?
A: npm test (from URS_MATCHER_SERVICE directory)

Q: How to see changes?
A: git diff HEAD~1 (last commit)
   git log --oneline (commit history)

Q: Where's the Phase 3 Advanced code?
A: Backend: /backend/src/services/roleIntegration/orchestrator.js
   Frontend: /frontend/public/app.js (lines 872-1046)

Q: What data does Phase 3 return?
A: See FILES_STATUS.md "Data Structure Now Returned" section
   Or check block-match response with phase3_advanced key

Q: How to test Phase 3 Advanced?
A: See NEXT_SESSION_GUIDE.md "Testing Strategy" section
   Or run: npm test -- phase3Advanced.test.js
```

---

**Last Updated:** 2025-12-03
**Status:** ✅ Session Complete
**Ready for Next Session:** YES
**Next Priority:** Phase 2 Document Validator
**Estimated Time:** 3-4 hours
