# Next Session Quick Start Guide
## How to Continue Development

---

## 🎯 STARTING THIS SESSION

### 1. GET CONTEXT (First 5 minutes)
```bash
# Read this file first for full context
cat SESSION_SUMMARY_2025-12-03.md

# Review the phase status
cat ROADMAP.md
```

### 2. CHECK GIT STATUS
```bash
# You're on the correct branch already
git branch  # Should show: claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh

# Latest commits are:
# 4e28dab - FEAT: Phase 3 Advanced Orchestrator Integration in Backend
# 699c8b4 - FEAT: Phase 2 & 3 Frontend Integration
```

### 3. KEY FILES TO UNDERSTAND
- **Frontend Structure:** `/frontend/public/index.html` (new sections added)
- **Frontend Logic:** `/frontend/public/app.js` (new handlers added at line 774+)
- **Frontend Styling:** `/frontend/public/styles.css` (new styles at line 479+)
- **Backend Logic:** `/backend/src/api/routes/jobs.js` (orchestrator integration at line 85+)

---

## 📊 CURRENT STATE

### What's Working ✅
- Phase 0-1.5: Complete and tested
- Phase 3 Advanced: Frontend UI 100% done, Backend integration done
- 70/70 tests passing
- All 3 component loaders created (DocumentUpload, ContextEditor, Phase3Results)

### What's Missing 🔴
- **Phase 2 Document Validator Service** - Not implemented
- **Phase 2 Document Upload Handlers** - No backend handlers yet
- **Phase 2 Integration Test** - Haven't tested document flow
- **Phase 4 Optimization** - Not started

---

## 🚀 RECOMMENDED NEXT STEPS (In Priority Order)

### HIGH PRIORITY - Phase 2 Completion (3-4 hours)

#### Step 1: Implement Document Validator Service (1 hour)
```
File to create: /backend/src/services/documentValidatorService.js

What it should do:
1. Check if all required documents are present
2. Calculate completeness score (0-100%)
3. Identify missing documents
4. Suggest next steps to user

Needs to handle:
- PDF files (technical specifications)
- XLSX files (material lists)
- DWG files (drawings)
- CSV files (BOQ data)

Return format:
{
  "is_complete": true/false,
  "completeness_score": 85,
  "missing_documents": ["Geological survey"],
  "next_steps": ["Upload geology report"]
}
```

**Reference:** Look at `/backend/src/services/multiRoleClient.js` for similar structure

#### Step 2: Add Document Upload API Endpoint (1 hour)
```
Endpoint: POST /api/jobs/document-upload
Location: /backend/src/api/routes/jobs.js (add after block-match endpoint)

Should accept:
- Multiple files in one request
- File type validation
- Magic bytes check
- Store in database

Should return:
- Job ID
- Uploaded files list
- Completeness assessment
- Missing items list
```

#### Step 3: Wire Frontend to Document Upload (30 min)
```
File: /frontend/components/DocumentUpload.html

Add handlers for:
- Drag & drop file upload
- File list display
- Progress bar
- Upload button click
- Response handling

Use existing patterns from:
- /frontend/public/app.js (uploadFile function at line 132)
- /frontend/components/DocumentUpload.html (already has HTML structure)
```

---

### MEDIUM PRIORITY - Phase 3 Enhancements (2-3 hours)

#### Step 4: Add Role Temperature Configuration (1 hour)
```
File: /backend/src/services/roleIntegration/roleTemperatures.js (new)

Define temperatures for each role:
{
  "structural_engineer": {
    "load_calculation": 0.2,
    "concrete_class": 0.3,
    "safety": 0.2,
    "optimization": 0.5
  },
  "concrete_specialist": {
    "mix_design": 0.3,
    "durability": 0.3,
    "compatibility": 0.2
  },
  "standards_checker": {
    "compliance": 0.1,
    "interpretation": 0.3
  },
  "cost_estimator": {
    "pricing": 0.3,
    "optimization": 0.5
  },
  "tech_rules_engine": {
    "rule_application": 0.0
  }
}

Use in: Orchestrator passes to multiRoleClient when invoking each role
```

#### Step 5: Enhance Conflict Resolution UI (1 hour)
```
File: /frontend/public/app.js (enhance displayConflicts function)

Add interactive elements:
- Accept button (apply resolution)
- Reject button (flag for manual review)
- Edit button (modify resolution)
- Show reasoning (why conflict occurred)
- Show alternatives (other possible resolutions)

Update: /frontend/public/index.html (add buttons to conflict-item template)
Update: /frontend/public/styles.css (add button styling)
```

---

### OPTIONAL - Phase 4 Optimization (To be scheduled)

#### Step 6: Cache Orchestrator Results (1 hour)
```
File: /backend/src/services/cacheService.js (enhance)

Add caching for:
- Block analysis by content hash
- Role outputs
- Conflict resolutions
- Audit trails

Key format: userId:jobId:contentHash:roleId

Add expiry logic for cache invalidation
```

#### Step 7: Optimize Performance (1 hour)
```
Profile and optimize:
- Parallel role execution (currently sequential)
- Image loading for diagrams
- JSON response size
- Database query optimization

Target times:
- Simple block: < 3s
- Standard block: < 10s
- Complex block: < 30s
```

---

## 🧪 TESTING STRATEGY

### Phase 2 Testing
```bash
# 1. Unit tests
npm test -- documentValidatorService.test.js

# 2. Integration test
curl -X POST http://localhost:5000/api/jobs/document-upload \
  -F "file=@document.pdf"

# 3. Frontend test
# - Open browser
# - Click "📄 Nahrát Dokumenty"
# - Upload sample files
# - Verify results display
```

### Phase 3 Testing
```bash
# 1. Test complexity classification
npm test -- phase3Advanced.test.js

# 2. Test with real orchestrator
curl -X POST http://localhost:5000/api/jobs/block-match \
  -F "file=@sample.xlsx" \
  -F "project_context={...}"

# 3. Verify Phase 3 Advanced display
# - Check browser console
# - Verify phase3_advanced object present
# - Verify all sections render correctly
```

---

## 🔍 KEY DEBUGGING TIPS

### Frontend Issues
```javascript
// Check browser console for errors
// All Phase 3 display functions start at line 872 in app.js

// Test component loading
openDocUploadBtn.click()  // Should load DocumentUpload.html

// Verify data structure
console.log(currentResults.phase3_advanced)
```

### Backend Issues
```bash
# Check logs
tail -f logs/*.log

# Test endpoints
curl http://localhost:5000/api/jobs/health

# Debug orchestrator
NODE_DEBUG=* npm start  # Enable debug output
```

---

## 📋 CHECKLIST FOR NEXT SESSION

Before starting work:
- [ ] Read SESSION_SUMMARY_2025-12-03.md
- [ ] Check git branch: `claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh`
- [ ] Review ROADMAP.md for priorities
- [ ] Run tests: `npm test` (should be 70/70 passing)
- [ ] Check no uncommitted changes: `git status`

During work:
- [ ] Use TodoWrite to track tasks
- [ ] Commit frequently with clear messages
- [ ] Test after each feature
- [ ] Update session summary at end

After work:
- [ ] All tests passing
- [ ] Git status clean
- [ ] Update SESSION_SUMMARY for next session
- [ ] Push to branch: `git push -u origin claude/review-session-docs-01FGnzx2R84sv64UbwdCJksh`

---

## 📞 QUICK REFERENCE

### Important Directories
```
/backend/src/
├── api/routes/jobs.js (main endpoints)
├── services/ (business logic)
├── utils/ (helpers)
└── db/ (database)

/frontend/
├── public/ (HTML, JS, CSS)
├── components/ (reusable HTML)
└── package.json
```

### Key Functions Location
```
Block Upload: jobs.js:89-180
Block Match: jobs.js:489-674
File Parser: fileParser.js
URS Matcher: ursMatcher.js
Multi-Role: multiRoleClient.js
Orchestrator: orchestrator.js:30-78
```

### Test Files
```
/backend/tests/
├── phase3Advanced.test.js (38 tests, 70/70 passing)
├── techRules.test.js
├── ursMatcher.test.js
└── fileParser.test.js
```

---

## 💡 TIPS & TRICKS

### Quick Development Loop
```bash
# Start backend
npm run dev

# In another terminal, run tests
npm test -- --watch

# Test specific endpoint
curl -X POST http://localhost:5000/api/jobs/block-match \
  -F "file=@test.xlsx" \
  -F 'project_context={"building_type":"bytový dům"}'
```

### Useful VS Code Extensions
- REST Client (for API testing)
- Thunder Client (alternative)
- Prettier (code formatting)
- ESLint (linting)

### Common Errors & Solutions
```
Error: "Cannot find module 'Orchestrator'"
→ Check import path, should be ../../services/roleIntegration/orchestrator.js

Error: "phase3_advanced is undefined"
→ Multi-role API not available, check logs

Error: "Document upload failed"
→ Check file size limits, file type validation
```

---

**Last Updated:** 2025-12-03
**For Questions:** Review SESSION_SUMMARY_2025-12-03.md
