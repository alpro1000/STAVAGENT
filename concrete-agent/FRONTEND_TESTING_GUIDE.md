# FRONTEND TESTING GUIDE - Complete Manual

**Date:** 2025-11-01
**Purpose:** Step-by-step guide for testing frontend + backend integration
**Status:** System is online and ready for testing ✅

---

## 🎯 TESTING OVERVIEW

**What we're testing:**
1. ✅ Frontend loads and displays correctly
2. ✅ Backend API connection works
3. ✅ File upload functionality (Workflow A)
4. ✅ Position parsing and display
5. ✅ Tech card generation (AI)
6. ✅ Chat interface
7. ✅ Artifact rendering

**3 Testing Methods Available:**
1. **Method 1:** Manual browser testing (most comprehensive)
2. **Method 2:** Automated Python script (fast, requires Excel file)
3. **Method 3:** Swagger UI testing (API only, no frontend)

---

## 📋 METHOD 1: MANUAL BROWSER TESTING (RECOMMENDED)

### Prerequisites

You'll need:
- ✅ Browser (Chrome/Firefox recommended)
- ✅ Real Czech Excel file (BOQ/Výkaz výměr)
  - Format: `.xlsx` or `.xls`
  - Content: Construction positions with quantities
  - Example columns: Položka, Popis, Množství, Jednotka, Cena

### Step 1: Open Frontend

```
URL: https://stav-agent.onrender.com
```

**Expected:**
- ✅ Page loads
- ✅ "Stav Agent" title visible
- ✅ UI renders without errors
- ✅ No console errors (press F12 → Console tab)

**Check:**
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for failed requests

**Screenshot this!** 📸

---

### Step 2: Check Backend Connection

**Look for:**
- ✅ Connection status indicator
- ✅ "Backend connected" or similar message
- ✅ No error banners

**If you see connection errors:**
```
Backend URL should be: https://concrete-agent.onrender.com
Check Network tab in DevTools to see actual requests
```

**Screenshot this!** 📸

---

### Step 3: Create New Project

**Actions:**
1. Click "New Project" or "Upload" button
2. Modal/dialog should open

**Fill in:**
- Project Name: "Test Project 2025-11-01"
- Workflow: Select "A" (Import & Validation)
- File: Click "Browse" or drag-and-drop area

**Upload your Excel file:**
- Select your Czech BOQ/Výkaz výměr file
- File should appear in upload area
- Click "Upload" or "Start" button

**Expected:**
- ✅ Loading spinner appears
- ✅ Progress indicator (maybe)
- ✅ Success message after upload
- ✅ Redirect to project view

**Possible Errors:**
- ❌ "Invalid file format" → Check file is `.xlsx` or `.xls`
- ❌ "Upload failed" → Check file size < 20MB
- ❌ "Backend error" → Check browser console for details

**Screenshot:**
- Upload dialog
- Progress indicator
- Success message

---

### Step 4: View Parsed Positions

**After upload succeeds:**

**Expected:**
- ✅ Table/list of positions appears
- ✅ Each position shows:
  - Position number
  - Description
  - Quantity + unit
  - Price (if available)
  - OTSKP code (if detected)

**Check:**
- Count how many positions parsed
- Do they match your Excel file?
- Are quantities correct?
- Are units correct?

**Example Position:**
```
Position: 1
Description: Beton C30/37 - XC3, Dmax 16
Quantity: 15.5 m³
Unit Price: 2,450 CZK/m³
OTSKP: 271.321.21.1
```

**Test Actions:**
- ✅ Click on a position (should select it)
- ✅ Check if details panel appears
- ✅ Scroll through all positions

**Screenshot this!** 📸

---

### Step 5: Generate Tech Card (AI Test!)

**Actions:**
1. Select first position with concrete/beton
2. Click "Generate Tech Card" or "Technický list" button

**Expected:**
- ✅ Loading indicator (AI is working)
- ✅ Wait 10-30 seconds
- ✅ Right panel opens with tech card
- ✅ Tech card shows:
  - Concrete class (e.g., C30/37)
  - Exposure class (e.g., XC3)
  - Mix design details
  - Material specifications
  - Standards references (ČSN)
  - Cost breakdown

**This tests:**
- ✅ Multi-role AI system
- ✅ Knowledge Base integration
- ✅ Enhanced prompts (Phase 2 Week 1!)
- ✅ Claude API
- ✅ Artifact rendering

**Check artifact panel contains:**
- Structural Engineer analysis
- Concrete Specialist recommendations
- Standards Checker validation
- Cost Estimator calculations

**Screenshot:**
- Loading state
- Complete tech card
- Artifact panel

---

### Step 6: Test Other Actions

**Run Audit:**
1. Select position
2. Click "Audit" button
3. Check audit results show:
   - Compliance status
   - Standards checked
   - Warnings/errors
   - Suggestions

**View Materials:**
1. Select position
2. Click "Materials" or "Materiály"
3. Check materials breakdown:
   - Cement type
   - Aggregate specs
   - Admixtures
   - Water-cement ratio

**Calculate Resources:**
1. Select position
2. Click "Resources" or "Zdroje"
3. Check resource sheet:
   - Labor hours
   - Equipment needed
   - Material quantities
   - Cost estimates

**Screenshot each artifact type!** 📸

---

### Step 7: Test Chat Interface

**Actions:**
1. Find chat input area (usually at bottom)
2. Type message in Czech or English

**Test Messages:**

**Message 1: Simple question**
```
Jaká třída betonu je vhodná pro sloup 5m?
```

**Expected:**
- ✅ AI responds in Czech
- ✅ Mentions concrete class (C25/30 or higher)
- ✅ References ČSN standards
- ✅ May suggest C30/37 for 5m column

**Message 2: Project question**
```
Shrň tento projekt
```

**Expected:**
- ✅ Summary of uploaded project
- ✅ Total positions count
- ✅ Main materials
- ✅ Estimated cost

**Message 3: Standards question**
```
Co říká ČSN EN 206 o třídě XC3?
```

**Expected:**
- ✅ Explanation of XC3 exposure class
- ✅ Requirements (min cement, max w/c)
- ✅ Reference to Knowledge Base

**Check:**
- ✅ Chat history persists
- ✅ AI responses are relevant
- ✅ Czech language works
- ✅ Artifacts can appear in chat

**Screenshot:**
- Chat interface
- AI responses
- Any artifacts

---

### Step 8: Test Quick Actions

**If UI has quick action buttons, test:**

**"Audit pozice"**
- Should run audit on current position
- Results in artifact panel

**"Materiály"**
- Should show materials for position
- Detailed breakdown

**"Zdroje"**
- Should calculate resources
- Labor + equipment

**"Rozebrat"**
- Should break down position
- Detailed analysis

**Screenshot quick actions panel!** 📸

---

### Step 9: Test UI Features

**Sidebar:**
- ✅ Toggle open/close works
- ✅ Project list visible
- ✅ Can switch between projects
- ✅ File list shows uploaded files

**Resizable Panels:**
- ✅ Drag panel borders to resize
- ✅ Chat panel resizes
- ✅ Artifact panel resizes
- ✅ Panels don't overlap

**Loading States:**
- ✅ Spinners show during API calls
- ✅ Buttons disabled while loading
- ✅ Progress indicators work

**Error Handling:**
- ✅ Error messages are user-friendly
- ✅ No crashes/white screens
- ✅ Errors don't block other features

---

### Step 10: Browser Console Check

**Final check - Open DevTools (F12):**

**Console Tab:**
- ✅ No red errors (warnings OK)
- ✅ API calls logged
- ✅ No CORS errors
- ✅ No 404s for assets

**Network Tab:**
- ✅ All API calls return 200 OK
- ✅ No failed requests
- ✅ Response times reasonable (<5s)
- ✅ Correct backend URL used

**Screenshot any errors!** 📸

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: "Backend not connected"
**Symptoms:** Red banner, connection error
**Check:**
```javascript
// In browser console:
console.log(import.meta.env.VITE_API_URL)
// Should be: https://concrete-agent.onrender.com
```
**Fix:** Check `.env` file in `stav-agent/`

---

### Issue 2: File upload fails
**Symptoms:** Upload returns error
**Possible causes:**
1. File too large (>20MB)
2. Wrong file format (not Excel)
3. Corrupted file
4. Backend parsing error

**Debug:**
```
1. Check browser Network tab
2. Look for /api/upload request
3. Check response body for error message
4. Try smaller file
```

---

### Issue 3: Positions don't appear
**Symptoms:** Upload succeeds but no positions
**Check:**
1. Excel file has proper structure?
2. Headers recognized (Položka, Množství, etc)?
3. Check browser console for parsing errors

**Workaround:**
Try different Excel file with clear table structure

---

### Issue 4: AI not responding
**Symptoms:** Tech card generation hangs/fails
**Possible causes:**
1. Claude API rate limit
2. Position data incomplete
3. Network timeout

**Check:**
```
Browser console → Network tab → look for:
- POST /api/workflow/a/tech-card
- Response time (should be 10-30s)
- Response status (should be 200)
```

---

### Issue 5: Artifacts don't render
**Symptoms:** Right panel empty or shows error
**Check:**
1. Artifact type supported?
   - audit_result ✅
   - materials_detailed ✅
   - tech_card ✅
   - vykaz_vymer ✅
   - resource_sheet ✅
   - project_summary ✅
2. Artifact data valid?
3. Check browser console for React errors

---

## 🤖 METHOD 2: AUTOMATED PYTHON TESTING

**I created a script for you!**

**Location:** `test_frontend_manually.py`

**Usage:**
```bash
# Install dependencies
pip install requests

# Run script
python test_frontend_manually.py
```

**What it tests:**
1. Backend health ✅
2. Projects list ✅
3. File upload ✅ (requires Excel file)
4. Position parsing ✅
5. Tech card generation ✅
6. Chat interface ✅

**Advantages:**
- Fast automated testing
- Tests same endpoints as frontend
- Detailed logging
- No browser needed

**Disadvantages:**
- Doesn't test UI rendering
- Doesn't test user interactions
- Requires Python environment

**Follow prompts in script to provide Excel file path.**

---

## 📊 METHOD 3: SWAGGER UI TESTING

**URL:** https://concrete-agent.onrender.com/docs

**Advantages:**
- No code needed
- Test API directly
- See exact request/response
- Interactive documentation

**How to use:**

### Test 1: Upload File
1. Find `POST /api/upload`
2. Click "Try it out"
3. Fill parameters:
   - `project_name`: "Test 2025-11-01"
   - `workflow`: "A"
   - `vykaz_vymer`: Upload Excel file
4. Click "Execute"
5. Check response for `project_id`

### Test 2: Get Positions
1. Find `GET /api/workflow/a/positions`
2. Click "Try it out"
3. Enter `project_id` from step 1
4. Click "Execute"
5. Check response contains positions array

### Test 3: Generate Tech Card
1. Find `POST /api/workflow/a/tech-card`
2. Click "Try it out"
3. Enter JSON:
```json
{
  "project_id": "your-project-id",
  "position_id": "1"
}
```
4. Click "Execute"
5. Wait 10-30 seconds
6. Check response has artifact

### Test 4: Chat
1. Find `POST /api/chat/message`
2. Click "Try it out"
3. Enter JSON:
```json
{
  "project_id": "your-project-id",
  "message": "Shrň tento projekt"
}
```
4. Click "Execute"
5. Check AI response

---

## 📸 SCREENSHOT CHECKLIST

**Please capture screenshots of:**

- [ ] 1. Frontend homepage (https://stav-agent.onrender.com)
- [ ] 2. Upload dialog
- [ ] 3. File upload progress
- [ ] 4. Parsed positions table
- [ ] 5. Position details panel
- [ ] 6. Tech card artifact (full)
- [ ] 7. Audit results
- [ ] 8. Materials breakdown
- [ ] 9. Resource sheet
- [ ] 10. Chat interface with messages
- [ ] 11. Quick actions panel
- [ ] 12. Browser console (no errors)
- [ ] 13. Network tab (successful API calls)
- [ ] 14. Any errors encountered

---

## ✅ TESTING COMPLETION CHECKLIST

### Basic Functionality
- [ ] Frontend loads without errors
- [ ] Backend connection works
- [ ] Can create new project
- [ ] Can upload Excel file
- [ ] Positions parse correctly
- [ ] Position count matches Excel

### AI Features
- [ ] Tech card generation works
- [ ] Multi-role AI responds
- [ ] Knowledge Base accessed
- [ ] Czech standards referenced
- [ ] OTSKP codes assigned
- [ ] Cost estimation works

### Chat Interface
- [ ] Chat accepts messages
- [ ] AI responds in Czech/English
- [ ] Responses are relevant
- [ ] Artifacts appear in chat
- [ ] Chat history persists

### UI/UX
- [ ] All components render
- [ ] No visual glitches
- [ ] Loading states show
- [ ] Error messages clear
- [ ] Sidebar toggles
- [ ] Panels resize
- [ ] Mobile responsive (optional)

### Performance
- [ ] Page loads fast (<3s)
- [ ] API calls complete (<30s)
- [ ] UI remains responsive
- [ ] No memory leaks (long session test)

### Error Handling
- [ ] Invalid file handled gracefully
- [ ] Network errors don't crash
- [ ] Missing data shown clearly
- [ ] User gets helpful messages

---

## 🐛 BUG REPORT TEMPLATE

**If you find bugs, report like this:**

```markdown
## Bug #X: [Short Description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happened

**Screenshots:**
[Attach screenshots]

**Browser Console:**
[Copy any error messages]

**Network Tab:**
[Failed API calls]

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Date: 2025-11-01
- Backend: https://concrete-agent.onrender.com
- Frontend: https://stav-agent.onrender.com
```

---

## 📊 TESTING RESULTS TEMPLATE

**After testing, fill this:**

```markdown
## Frontend Testing Results - [Date]

**Tester:** [Your name]
**Duration:** [X hours]
**Excel File Used:** [File name, size, rows]

### Summary
- ✅ Tests Passed: X/Y
- ❌ Tests Failed: Z
- ⚠️ Warnings: W
- 🐛 Bugs Found: B

### Detailed Results

**1. Frontend Loading**
- Status: ✅ / ❌
- Notes: [Any observations]

**2. File Upload**
- Status: ✅ / ❌
- Time: [X seconds]
- File size: [Y MB]
- Notes: [Any issues]

**3. Position Parsing**
- Status: ✅ / ❌
- Positions expected: X
- Positions parsed: Y
- Accuracy: Z%
- Notes: [Missing fields, wrong values]

**4. Tech Card Generation**
- Status: ✅ / ❌
- Time: [X seconds]
- Quality: Good / Medium / Poor
- Notes: [AI response quality]

**5. Chat Interface**
- Status: ✅ / ❌
- Messages tested: X
- Responses correct: Y
- Notes: [Response quality]

**6. Artifacts**
- audit_result: ✅ / ❌
- materials_detailed: ✅ / ❌
- tech_card: ✅ / ❌
- vykaz_vymer: ✅ / ❌
- resource_sheet: ✅ / ❌
- project_summary: ✅ / ❌

**7. Performance**
- Page load: [X seconds]
- API average: [Y seconds]
- UI responsive: Yes / No

### Bugs Found
1. [Bug #1 description]
2. [Bug #2 description]

### Recommendations
1. [Improvement 1]
2. [Improvement 2]

### Overall Assessment
[Your verdict: Ready for production / Needs fixes / Major issues]
```

---

## 🎯 NEXT STEPS AFTER TESTING

**If all tests pass:**
1. ✅ Mark Phase 3 Week 4 as complete
2. ✅ Move to Phase 3 Week 5 (Advanced features)
3. ✅ Consider user acceptance testing

**If bugs found:**
1. 🐛 Document all bugs
2. 🐛 Prioritize (Critical → High → Medium → Low)
3. 🐛 Fix critical bugs first
4. 🐛 Retest after fixes

**If major issues:**
1. ❌ Create detailed bug report
2. ❌ Check backend logs
3. ❌ Review system audit
4. ❌ Plan fix strategy

---

*End of Testing Guide*
*Good luck with testing!* 🚀
