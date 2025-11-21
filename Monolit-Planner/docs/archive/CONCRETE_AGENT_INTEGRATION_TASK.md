# 🚨 URGENT: Concrete-Agent API Integration Task

**Status:** PRODUCTION CRITICAL - 404 Error on Parser Endpoint
**Date:** November 20, 2025
**Context:** Monolit-Planner needs correct API endpoint from concrete-agent for Excel parsing

---

## 🎯 Task for Concrete-Agent Repository Chat

### Problem
Monolit-Planner is calling concrete-agent with endpoint `/workflow-a/start` but getting **404 Not Found** error in production logs:

```
[ERROR] [CORE] ❌ Parse failed: Request failed with status code 404
```

### What We Need

Please help us identify the **CORRECT API endpoint** for parsing Excel files in concrete-agent.

We need to know:

1. **The correct POST endpoint** that accepts Excel files and parses them
   - Is it `/api/upload`?
   - Is it `/api/monolit/enrich`?
   - Is it something else?
   - What is the full correct path?

2. **Request format** for this endpoint:
   - Should we send `multipart/form-data` (file upload)?
   - Should we send JSON body?
   - What parameters are required?
   - Does it need authentication (Bearer token)?

3. **Response format** from this endpoint:
   - What does the response structure look like?
   - Where are the parsed positions in the response?
   - What format are they in?

4. **Example working request** would be helpful:
   ```bash
   curl -X POST https://concrete-agent.onrender.com/[CORRECT_ENDPOINT] \
     -F "file=@myfile.xlsx" \
     [OTHER_PARAMS]
   ```

### Current Implementation (Broken)

**File:** `backend/src/services/coreAPI.js`
**Current Code:**
```javascript
const response = await axios.post(
  `${CORE_API_URL}/workflow-a/start`,  // ← RETURNS 404
  form,
  { headers: { ...form.getHeaders() } }
);
```

### Context Information

- **Monolit-Planner URL:** https://github.com/alpro1000/Monolit-Planner
- **Our concrete-agent integration goal:** Parse Excel spreadsheets with position data
- **Files in Monolit-Planner that need this:**
  - `backend/src/services/coreAPI.js` - The API client
  - `backend/src/routes/upload.js` - Uses the parser when local extraction fails

### Fallback Chain in Monolit-Planner

If this endpoint works:
```
Local parser (extracts positions)
  ├─ SUCCESS → Use extracted positions ✅
  └─ FAIL → Call concrete-agent (this endpoint) ← CURRENTLY BROKEN
      ├─ SUCCESS → Use concrete-agent parsed positions ✅
      └─ FAIL → Fall back to template positions 📋
```

Currently, when local parser gets 0 positions, we try concrete-agent but fail with 404, so users get template positions instead of AI-parsed positions.

---

## 🔧 What We'll Do Once We Know

Once you provide the correct endpoint details, we will:

1. Update `backend/src/services/coreAPI.js` with correct endpoint
2. Fix request format (headers, body, parameters)
3. Fix response parsing (where to get parsed positions)
4. Test on production
5. Deploy fix immediately

---

## 📞 Response Format Needed

Please respond with:

```markdown
# Concrete-Agent API Endpoint for Excel Parsing

## Correct Endpoint
POST /[correct/path]

## Request
Method: POST
Headers:
  - Content-Type: multipart/form-data OR application/json
Authentication: Bearer token required? YES/NO
Parameters/Body:
  - file: <Excel file>
  - [other parameters]: [description]

## Response
```json
{
  "positions": [
    { "description": "...", "quantity": 123, ... }
  ],
  "metadata": { ... }
}
```

## Example CURL
```bash
curl -X POST https://concrete-agent.onrender.com/[ENDPOINT] ...
```

## Notes
[Any additional information about rate limits, timeouts, etc.]
```

---

## 🏃 Timeline

- **NOW:** Need correct endpoint details
- **In 5 minutes:** Update Monolit-Planner code
- **In 10 minutes:** Push fix to production
- **Result:** Production working again with proper Excel parsing

---

## 📎 Additional Files You Might Need

From concrete-agent repo:
- `packages/core-backend/app/api/routes.py` - List all endpoints
- `packages/core-backend/app/api/routes_workflow_a.py` - Workflow A endpoints
- `packages/core-backend/app/main.py` - API configuration
- `packages/core-backend/app/models/` - Request/Response models
- `.env.example` or documentation about required auth

---

**This is urgent - production users are currently getting generic template positions instead of AI-parsed positions from their Excel files. Your help will fix this immediately!** 🚀
