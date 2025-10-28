# Frontend-Backend Integration Plan
## Based on Production Log Analysis (2025-10-28)

**Source**: Production logs from https://concrete-agent.onrender.com
**Analysis Date**: 2025-10-28
**Status**: 2 critical backend bugs FIXED ✅, Frontend issues identified ⚠️

---

## 📊 Current Status

### ✅ **WORKING PERFECTLY**

1. **File Upload & Processing**
   ```
   ✅ POST /api/upload - Creates project
   ✅ Excel parsing (53 positions extracted)
   ✅ PDF drawing analysis (17 specifications)
   ✅ Audit execution (GREEN/AMBER/RED classification)
   ✅ Artifact generation
   ```

2. **GET Endpoints**
   ```
   ✅ GET /api/projects/{id}/status
   ✅ GET /api/projects/{id}/results
   ✅ GET /api/projects/{id}/files
   ✅ GET /api/workflow/a/positions?project_id={id}
   ✅ GET /api/agents/agents
   ✅ GET /api/pdf/extract-full?project_id={id}
   ```

3. **Example Success** (from logs):
   ```
   Project: proj_e70ac1ce4522
   Name: aa251028
   File: 049-25-DZMS-DI-32-36 - I-20 HNĚVKOV - SEDLICE.xlsx
   Positions: 53 (0 GREEN, 48 AMBER, 5 RED)
   Status: COMPLETED ✅
   ```

### ❌ **BROKEN - NEEDS FIXING**

#### Backend Issues (FIXED ✅)
1. ~~routes_chat.py line 911: `datetime` not defined~~ ✅ **FIXED**
2. ~~enrichment_service.py: wrong import path~~ ✅ **FIXED**

#### Frontend Issues (NEEDS FIXING ⚠️)
3. **Frontend sends "string" instead of real IDs** 🚨 CRITICAL
   ```
   ❌ POST /api/workflow/a/tech-card - body: {project_id: "string", position_id: "string"}
   ❌ POST /api/workflow/a/resource-sheet - body: {project_id: "string", position_id: "string"}
   ❌ POST /api/workflow/a/materials - body: {project_id: "string", position_id: "string"}
   ❌ POST /api/workflow/a/enrich - body: {project_id: "string", position_id: "string"}
   ❌ POST /api/agents/execute - body: {agent_id: "string"}
   ```

---

## 🎯 STEP-BY-STEP FIX PLAN

### **Phase 1: Backend Fixes** ✅ **COMPLETED**

#### ✅ Step 1.1: Fix datetime import in routes_chat.py
**Status**: ✅ FIXED (commit 0bd7ce6)

**What was wrong**:
```python
# Line 911-912 (BEFORE):
"created_at": datetime.now().isoformat(),  # ❌ datetime not imported
```

**Fixed to**:
```python
# Line 911-912 (AFTER):
"created_at": get_utc_timestamp_iso(),  # ✅ Using utility
```

**Impact**: `/api/chat/projects` endpoint now works (was 500 error)

---

#### ✅ Step 1.2: Fix import path in enrichment_service.py
**Status**: ✅ FIXED (commit 0bd7ce6)

**What was wrong**:
```python
# Line 10 (BEFORE):
from app.core.knowledge_base import kb_loader  # ❌ Module doesn't exist
```

**Fixed to**:
```python
# Line 10 (AFTER):
from app.core.kb_loader import kb_loader  # ✅ Correct path
```

**Impact**: `/api/chat/enrich` endpoint now works (was 500 error)

---

### **Phase 2: Frontend Debugging** ⚠️ **IN PROGRESS**

The main issue is that **frontend sends placeholder "string"** instead of real IDs from backend responses.

---

#### 🔴 Step 2.1: Debug Upload Response Handling

**Problem**: After successful upload, frontend doesn't capture `project_id`

**Expected Flow**:
```javascript
// 1. User uploads files
const formData = new FormData();
formData.append('files', file);
formData.append('project_name', 'My Project');
formData.append('workflow', 'A');

// 2. POST /api/upload
const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

// 3. Backend returns:
const data = await response.json();
// {
//   "success": true,
//   "project_id": "proj_e70ac1ce4522",  ← NEED TO CAPTURE THIS
//   "project_name": "aa251028",
//   "workflow": "A",
//   "message": "Upload successful"
// }

// 4. Frontend MUST store project_id:
const projectId = data.project_id;  // ← THIS IS MISSING
```

**What to check in frontend code**:
```javascript
// Find the upload handler function
// Look for something like:

async function handleUpload(files) {
  const formData = new FormData();
  // ... add files ...

  const response = await fetch('/api/upload', { ... });
  const result = await response.json();

  // ❌ PROBLEM: Frontend likely does this:
  setProjectId("string");  // Hardcoded placeholder

  // ✅ SHOULD DO:
  setProjectId(result.project_id);  // Use real ID from response
}
```

**Files to check**:
- `web/src/components/Upload.tsx` (or .jsx)
- `web/src/pages/ProjectPage.tsx`
- `web/src/services/api.ts`

**Fix**:
```typescript
// BEFORE (WRONG):
interface UploadResponse {
  project_id: string;  // Type is correct
}

const handleUpload = async (files: File[]) => {
  const response = await uploadFiles(files);
  setProjectId("string");  // ❌ HARDCODED
};

// AFTER (CORRECT):
const handleUpload = async (files: File[]) => {
  const response = await uploadFiles(files);
  setProjectId(response.project_id);  // ✅ FROM BACKEND

  // Debug log to verify:
  console.log('Project created:', response.project_id);
};
```

---

#### 🔴 Step 2.2: Debug Position List Handling

**Problem**: When displaying positions list, frontend doesn't extract `position_id`

**Expected Flow**:
```javascript
// 1. Fetch positions for project
const response = await fetch(`/api/workflow/a/positions?project_id=${projectId}`);
const data = await response.json();

// 2. Backend returns:
// {
//   "positions": [
//     {
//       "position_id": "pos_001",  ← NEED TO CAPTURE THIS
//       "code": "17120",
//       "description": "Betonářská výztuž ...",
//       "quantity": 28.5,
//       "unit": "t"
//     },
//     // ... more positions
//   ],
//   "total": 53
// }

// 3. Frontend renders list:
positions.map(pos => (
  <div key={pos.position_id}>  {/* ✅ Key is correct */}
    <button onClick={() => generateTechCard(pos.position_id)}>  {/* ✅ */}
      Tech Card
    </button>
  </div>
))
```

**What to check**:
```typescript
// Find the positions list component
// Look for:

const PositionsList = ({ projectId }) => {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    fetch(`/api/workflow/a/positions?project_id=${projectId}`)
      .then(r => r.json())
      .then(data => setPositions(data.positions));
  }, [projectId]);

  // ❌ PROBLEM: Button handlers likely do this:
  const handleTechCard = (position) => {
    generateTechCard("string", "string");  // Hardcoded
  };

  // ✅ SHOULD DO:
  const handleTechCard = (position) => {
    generateTechCard(projectId, position.position_id);  // Real IDs
  };

  return positions.map(pos => (
    <button onClick={() => handleTechCard(pos)}>
      Tech Card
    </button>
  ));
};
```

**Files to check**:
- `web/src/components/PositionsList.tsx`
- `web/src/components/PositionItem.tsx`
- `web/src/hooks/usePositions.ts`

---

#### 🔴 Step 2.3: Fix API Call Functions

**Problem**: API call functions have hardcoded "string" placeholders

**Check these functions**:

```typescript
// FILE: web/src/services/api.ts (or similar)

// ❌ WRONG - Hardcoded placeholder:
export const generateTechCard = async () => {
  return fetch('/api/workflow/a/tech-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: "string",    // ❌ HARDCODED
      position_id: "string"    // ❌ HARDCODED
    })
  });
};

// ✅ CORRECT - Accept parameters:
export const generateTechCard = async (projectId: string, positionId: string) => {
  console.log('Generating tech card:', { projectId, positionId });  // Debug

  return fetch('/api/workflow/a/tech-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,    // ✅ FROM PARAMETER
      position_id: positionId   // ✅ FROM PARAMETER
    })
  });
};
```

**Functions to fix**:
```typescript
// 1. Tech Card
generateTechCard(projectId: string, positionId: string)

// 2. Resource Sheet
generateResourceSheet(projectId: string, positionId: string)

// 3. Materials
generateMaterials(projectId: string, positionId: string)

// 4. Enrich Position
enrichPosition(projectId: string, positionId: string)

// 5. Execute Agent
executeAgent(agentId: string, projectId?: string, inputData?: any)
```

---

#### 🔴 Step 2.4: Add Debug Logging

**Add console.log to track data flow**:

```typescript
// In Upload component:
const handleUpload = async (files: File[]) => {
  console.log('📤 Uploading files:', files.map(f => f.name));

  const response = await uploadFiles(files);

  console.log('✅ Upload response:', response);
  console.log('📋 Project ID:', response.project_id);  // Should NOT be "string"

  setProjectId(response.project_id);
};

// In Positions list:
useEffect(() => {
  console.log('📥 Fetching positions for project:', projectId);

  fetch(`/api/workflow/a/positions?project_id=${projectId}`)
    .then(r => r.json())
    .then(data => {
      console.log('📋 Received positions:', data.positions.length);
      console.log('📋 First position:', data.positions[0]);
      setPositions(data.positions);
    });
}, [projectId]);

// In button handler:
const handleTechCard = (position) => {
  console.log('🛠️ Generating tech card:', {
    projectId,
    positionId: position.position_id,
    code: position.code
  });

  generateTechCard(projectId, position.position_id);
};
```

---

### **Phase 3: API Contract Verification**

#### Step 3.1: Verify Backend Response Format

**Check that backend returns correct structure**:

```bash
# 1. Upload and get project_id
curl -X POST http://localhost:8000/api/upload \
  -F "files=@test.xlsx" \
  -F "project_name=Test" \
  -F "workflow=A"

# Expected response:
# {
#   "success": true,
#   "project_id": "proj_xxxxx",  ← Check this exists
#   "project_name": "Test",
#   "workflow": "A"
# }

# 2. Fetch positions
curl http://localhost:8000/api/workflow/a/positions?project_id=proj_xxxxx

# Expected response:
# {
#   "positions": [
#     {
#       "position_id": "...",   ← Check this exists
#       "code": "17120",
#       "description": "...",
#       "quantity": 28.5,
#       "unit": "t"
#     }
#   ]
# }
```

---

#### Step 3.2: Update OpenAPI Schema

**Verify swagger docs match reality**:

1. Open: http://localhost:8000/docs
2. Check `/api/upload` response model
3. Check `/api/workflow/a/positions` response model
4. Ensure `position_id` field is documented

If mismatch found:
```python
# In app/models/project.py or similar:

class PositionResponse(BaseModel):
    position_id: str  # ← MUST be present
    code: str
    description: str
    quantity: float
    unit: str
    # ... other fields
```

---

### **Phase 4: Frontend TypeScript Fixes**

#### Step 4.1: Define Correct Types

```typescript
// types/api.ts

export interface UploadResponse {
  success: boolean;
  project_id: string;  // NOT "string" literal
  project_name: string;
  workflow: 'A' | 'B';
  message: string;
}

export interface Position {
  position_id: string;  // Ensure this exists
  code: string;
  description: string;
  quantity: number;
  unit: string;
  audit_status?: 'GREEN' | 'AMBER' | 'RED';
}

export interface PositionsResponse {
  positions: Position[];
  total: number;
}
```

#### Step 4.2: Use Types in API Calls

```typescript
// services/api.ts

export const uploadFiles = async (
  files: File[],
  projectName: string,
  workflow: 'A' | 'B'
): Promise<UploadResponse> => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('project_name', projectName);
  formData.append('workflow', workflow);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();  // Type: UploadResponse
};

export const fetchPositions = async (
  projectId: string
): Promise<PositionsResponse> => {
  const response = await fetch(
    `/api/workflow/a/positions?project_id=${projectId}`
  );

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.statusText}`);
  }

  return response.json();  // Type: PositionsResponse
};
```

---

### **Phase 5: E2E Testing**

#### Step 5.1: Manual Testing Checklist

```
[ ] 1. Open frontend: http://localhost:3000
[ ] 2. Upload test file (e.g., test.xlsx)
[ ] 3. Check browser console - should see:
      "📋 Project ID: proj_xxxxx" (NOT "string")
[ ] 4. Wait for processing to complete
[ ] 5. Click on any position in list
[ ] 6. Click "Tech Card" button
[ ] 7. Check browser console - should see:
      "🛠️ Generating tech card: { projectId: 'proj_xxx', positionId: 'pos_xxx' }"
[ ] 8. Check network tab - POST request body should contain real IDs
[ ] 9. Backend should return 200 OK (NOT 404)
```

#### Step 5.2: Automated E2E Test

```typescript
// e2e/workflow.spec.ts (Playwright/Cypress)

test('Complete workflow A', async ({ page }) => {
  // 1. Navigate to app
  await page.goto('http://localhost:3000');

  // 2. Upload file
  await page.setInputFiles('input[type="file"]', 'test.xlsx');
  await page.fill('input[name="projectName"]', 'E2E Test');
  await page.click('button:has-text("Upload")');

  // 3. Wait for processing
  await page.waitForSelector('text=Processing complete');

  // 4. Get project ID from UI
  const projectId = await page.textContent('[data-testid="project-id"]');
  expect(projectId).toMatch(/^proj_[a-f0-9]{12}$/);

  // 5. Click first position
  await page.click('[data-testid="position-item"]:first-child');

  // 6. Generate tech card
  await page.click('button:has-text("Tech Card")');

  // 7. Verify API call
  const request = await page.waitForRequest(
    req => req.url().includes('/api/workflow/a/tech-card')
  );
  const body = JSON.parse(request.postData());

  expect(body.project_id).not.toBe("string");
  expect(body.position_id).not.toBe("string");
  expect(body.project_id).toMatch(/^proj_/);
});
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

### Before Deploy:
```
✅ Backend bugs fixed (datetime, import)
✅ Tests passing (65/67)
⚠️  Frontend fixes applied
⚠️  Manual testing completed
⚠️  E2E tests passing
⚠️  No "string" placeholders in logs
```

### After Deploy to Production:
```
[ ] Check logs: no 404 on /api/workflow/a/* endpoints
[ ] Check logs: no "Project string not found"
[ ] Upload test file and verify full flow
[ ] Monitor Sentry/error tracking
```

---

## 📝 **QUICK FIXES SUMMARY**

### ✅ Backend (DONE)
1. Fixed `datetime` import in routes_chat.py
2. Fixed import path in enrichment_service.py

### ⚠️ Frontend (TODO)
1. **Capture `project_id` from upload response**
   - File: `Upload.tsx` or similar
   - Change: `setProjectId(response.project_id)` not `setProjectId("string")`

2. **Use real `position_id` from positions list**
   - File: `PositionsList.tsx` or similar
   - Change: Pass `position.position_id` to handlers

3. **Fix API call functions**
   - File: `api.ts` or `services/api.ts`
   - Change: Accept parameters instead of hardcoded "string"

4. **Add TypeScript types**
   - File: `types/api.ts`
   - Add: `UploadResponse`, `Position`, `PositionsResponse`

5. **Add debug logging**
   - All components that handle IDs
   - Log: `console.log('Project ID:', projectId)`

---

## 🆘 **TROUBLESHOOTING**

### Issue: Still seeing "string" in logs after fixes

**Check**:
1. Frontend cache cleared? (`Ctrl+Shift+R`)
2. Frontend rebuilt? (`npm run build`)
3. Correct API URL? (not using cached old version)
4. Browser console shows correct IDs?

### Issue: 404 errors persist

**Check**:
1. Backend deployed with latest code?
2. Environment variables set correctly?
3. Correct base URL in frontend? (`API_URL=https://...onrender.com`)

### Issue: CORS errors

**Backend** (`app/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],  # Update
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📞 **NEXT STEPS**

1. **Immediate** (This Session):
   - ✅ Backend fixes committed and pushed
   - ⚠️ Share this plan with frontend developer

2. **Short Term** (Next 2 hours):
   - Fix frontend ID handling
   - Test upload → positions → tech card flow
   - Deploy to production

3. **Medium Term** (Next week):
   - Add E2E tests
   - Add proper error boundaries in frontend
   - Add loading states for all async operations

4. **Long Term** (Next sprint):
   - Increase test coverage (currently 38%)
   - Add Sentry error tracking
   - Add analytics to track user flows

---

**Status**: Backend ready ✅ | Frontend needs fixes ⚠️
**Priority**: HIGH - System partially working
**ETA**: 2-4 hours with frontend access
