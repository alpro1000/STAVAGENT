# CORE API Configuration - Diagnostics & Troubleshooting Guide

**Date:** November 22, 2025
**Issue:** Excel imports fail with 404 error from CORE API
**Status:** ⚠️ Diagnostics added - awaiting investigation on production

---

## Problem Summary

Excel file uploads to Monolit-Planner are failing with the error:

```
[CORE] ❌ Parse failed: Request failed with status code 404
[Upload] ⚠️ Neither CORE nor local parser identified any concrete projects
```

**Root Cause:** HTTP 404 response from `https://concrete-agent-srv-d38odtemcj7s738gp30g.onrender.com/api/upload`

---

## Investigation: What We Know

### From Production Logs

The logs reveal:
1. **URL being used:** `https://concrete-agent-srv-d38odtemcj7s738gp30g.onrender.com`
2. **Endpoint being called:** `/api/upload`
3. **Response:** HTTP 404 (Not Found)
4. **Secondary Issue:** Local fallback parser can't understand XLSX structure due to UUID column headers

### The 404 Error Possibilities

| Possibility | Likelihood | Evidence |
|-------------|------------|----------|
| **CORE_API_URL is misconfigured** | 🔴 HIGH | URL in logs differs from default `https://concrete-agent.onrender.com` |
| **/api/upload endpoint doesn't exist** | 🟡 MEDIUM | concrete-agent deployment might not have this endpoint |
| **Service is deployed but authentication required** | 🟡 MEDIUM | No 401 error → unlikely, but possible different endpoint structure |
| **Service is not running** | 🟢 LOW | Would return 503 or connection refused, not 404 |

---

## Changes Made: Enhanced Diagnostics

### 1. Improved Error Logging in `coreAPI.js`

**Location:** `/backend/src/services/coreAPI.js:294-350`

**Enhanced with:**
- Logs HTTP status code and response headers
- Specific diagnostic messages for common errors:
  - **404 NOT FOUND:** Shows possible causes and suggests testing endpoints
  - **401 UNAUTHORIZED:** Suggests authentication may be needed
  - **500 INTERNAL SERVER ERROR:** Logs error details
  - **Connection errors:** ECONNREFUSED, ETIMEDOUT, ENOTFOUND with guidance
- Shows current CORE_API_URL in every error message for verification

**Example error output:**
```
[CORE] ❌ PARSE ERROR: Request failed with status code 404
[CORE] 🔍 DIAGNOSTIC INFO:
[CORE]   - CORE_API_URL: https://concrete-agent.onrender.com
[CORE]   - CORE_TIMEOUT: 30000ms
[CORE] 🚨 404 NOT FOUND: The endpoint does not exist at https://concrete-agent.onrender.com/api/upload
[CORE] Possible issues:
[CORE]   1. CORE_API_URL environment variable is set to wrong service
[CORE]   2. concrete-agent deployment doesn't have /api/upload endpoint
[CORE]   3. Service is deployed but endpoint structure changed
[CORE] Try checking: POST https://concrete-agent.onrender.com/health or GET https://concrete-agent.onrender.com/
```

### 2. New Diagnostic Endpoint: `/api/upload/diagnostics`

**Location:** `/backend/src/routes/upload.js:568-703`

**What it does:**
- Shows current CORE configuration (CORE_API_URL, CORE_TIMEOUT, CORE_ENABLED)
- Tests connectivity to CORE health endpoint
- Tests connectivity to CORE root endpoint
- Returns detailed success/error information
- Provides clear recommendations

**How to use:**
```bash
# Local development
curl http://localhost:3001/api/upload/diagnostics

# Production (you'll need to implement authentication)
curl https://your-monolit-planner/api/upload/diagnostics
```

**Example response (success):**
```json
{
  "timestamp": "2025-11-22T...",
  "environment": {
    "CORE_API_URL": "https://concrete-agent.onrender.com",
    "CORE_TIMEOUT": 30000,
    "CORE_ENABLED": true,
    "NODE_ENV": "production"
  },
  "checks": {
    "connectivity": {
      "status": "success",
      "message": "CORE health endpoint is reachable",
      "endpoint": "https://concrete-agent.onrender.com/health"
    },
    "api_root": {
      "status": "success",
      "message": "CORE root endpoint is reachable",
      "endpoint": "https://concrete-agent.onrender.com/"
    }
  },
  "summary": {
    "core_reachable": true,
    "recommendation": "✅ CORE service is reachable..."
  }
}
```

**Example response (failure):**
```json
{
  "environment": {
    "CORE_API_URL": "https://concrete-agent-srv-d38odtemcj7s738gp30g.onrender.com"
  },
  "checks": {
    "connectivity": {
      "status": "error",
      "message": "Health endpoint failed: 404 Not Found",
      "error": {
        "status": 404
      }
    }
  },
  "summary": {
    "core_reachable": false,
    "recommendation": "🚨 CORE service at https://concrete-agent-srv-d38odtemcj7s738gp30g.onrender.com is not reachable..."
  }
}
```

---

## Troubleshooting Steps

### Step 1: Identify the Current Configuration Issue

**Action:** Run the diagnostics endpoint on your Render instance

```bash
# On your Monolit-Planner instance
curl https://your-monolit-planner.onrender.com/api/upload/diagnostics
```

**Expected outcomes:**

**Scenario A: CORE is reachable** ✅
```
"core_reachable": true
```
→ The issue is NOT with configuration, but with the `/api/upload` endpoint specifically. Check:
- Does concrete-agent have `/api/upload` endpoint?
- Do we need to send the request to a different endpoint?
- Are we sending the right parameters in the form?

**Scenario B: CORE is NOT reachable** 🔴
```
"core_reachable": false
"error": { "status": 404 }
```
→ The CORE_API_URL is pointing to a non-existent service or URL. Check step 2.

---

### Step 2: Verify CORE_API_URL Environment Variable on Render

**Where to check:** Monolit-Planner on Render → Settings → Environment

**Current configuration (from logs):**
```
CORE_API_URL = https://concrete-agent-srv-d38odtemcj7s738gp30g.onrender.com
```

**What it should be (options):**
```
# Option 1: Default production (RECOMMENDED)
CORE_API_URL=https://concrete-agent.onrender.com

# Option 2: Local testing (for development)
CORE_API_URL=http://localhost:8000

# Option 3: Internal Render URL (if concrete-agent is private service)
CORE_API_URL=https://concrete-agent-internal.onrender.com
```

**Action required:**
1. Check Monolit-Planner's Render environment variables
2. Compare CORE_API_URL with the endpoint we're trying to reach
3. Update to correct value if needed
4. Redeploy Monolit-Planner

---

### Step 3: Verify concrete-agent Service Status on Render

**Action:** Check the concrete-agent service on Render

1. Go to https://dashboard.render.com
2. Find the concrete-agent service
3. Check its deployment status (should be "Live")
4. Check recent deployment logs for errors
5. Try accessing `/health` endpoint directly:
   ```bash
   curl https://concrete-agent.onrender.com/health
   ```

**Expected response:** 200 OK with some health information

---

### Step 4: Verify /api/upload Endpoint Exists

**If concrete-agent is reachable, test the upload endpoint:**

```bash
# Test with HEAD (no file)
curl -I -X POST https://concrete-agent.onrender.com/api/upload

# Expected: 400 (missing file) or 405 (method not allowed) - NOT 404
# If 404: The endpoint doesn't exist in concrete-agent
```

**If 404 is returned:**
- The concrete-agent deployment may have changed
- The endpoint might be under a different path (e.g., `/upload` instead of `/api/upload`)
- The service might be a different API altogether

---

## How the System Works (CORE Integration Flow)

### Current Architecture

```
User uploads Excel file
        ↓
[upload.js] Preprocesses file
        ↓
Try CORE parser [PRIMARY]
    ├─ Sends to https://concrete-agent.onrender.com/api/upload
    ├─ CORE returns 404 ❌
    └─ Falls back to local parser
        ↓
Try Local ConcreteExtractor [FALLBACK]
    ├─ Finds 150 data rows ✓
    ├─ Looks for column names: "Popis", "MJ", "Kód" ✓
    ├─ Gets UUID and __EMPTY columns instead 💥
    └─ Can't extract concrete positions (0 found)
        ↓
Error: "Neither CORE nor local parser identified any concrete projects"
```

### Why It's Failing

1. **Primary (CORE):** Returns 404 because:
   - CORE_API_URL may be wrong
   - OR /api/upload endpoint doesn't exist
   - OR concrete-agent service not deployed

2. **Secondary (Local Fallback):** Can't help because:
   - Excel has UUID column headers (system-generated IDs)
   - Parser expects Czech column names
   - Without proper column names, can't identify data structure

---

## Next Steps for User

### Immediate Actions (Required)

1. **Run diagnostics endpoint** on your production Render instance
   - Access: `GET https://your-monolit-planner.onrender.com/api/upload/diagnostics`
   - Share the output with us

2. **Check Render environment variables**
   - Verify CORE_API_URL value
   - If set to something other than `https://concrete-agent.onrender.com`, note the value

3. **Check concrete-agent service status**
   - Is it deployed and running on Render?
   - What's its current URL?

### After Getting Diagnostics Results

**If CORE is reachable:**
→ We need to investigate the `/api/upload` endpoint further
- Check concrete-agent source code for actual endpoints
- May need to modify how we're calling the API

**If CORE is NOT reachable:**
→ Fix the CORE_API_URL environment variable
- Update on Render
- Redeploy
- Test again

---

## Rollback Plan

If diagnostics show the system was previously working with a different CORE_API_URL, we can:
1. Check git history for old working configuration
2. Revert to that URL
3. Re-test

---

## Files Changed in This Session

### Enhanced Error Diagnostics
- **`backend/src/services/coreAPI.js`** - Added comprehensive error logging (lines 294-350)
  - Shows HTTP status codes
  - Specific guidance for different error types
  - Logs current configuration in every error

### New Diagnostic Endpoint
- **`backend/src/routes/upload.js`** - Added `/api/upload/diagnostics` endpoint (lines 568-703)
  - Tests CORE connectivity
  - Shows environment configuration
  - Returns JSON with detailed results

### Committed
- **Commit:** `2e00ff1` "CHORE: Add comprehensive CORE API diagnostics and enhanced error logging"

---

## Related Issues

### Secondary Issue: Local Fallback Parser Can't Handle UUID Columns

Once CORE is fixed, if Excel imports still fail, we can improve the local fallback parser to:
- Detect columns by content analysis (looking for concrete grades like "C30/37")
- Handle UUID column names
- Be more robust for malformed XLSX structures

This is a secondary enhancement - not blocking if CORE works correctly.

---

## Resources

- **CORE Integration Code:** `/backend/src/services/coreAPI.js`
- **Upload Route:** `/backend/src/routes/upload.js`
- **Concrete Extractor (Fallback):** `/backend/src/services/concreteExtractor.js`
- **Data Preprocessor:** `/backend/src/services/dataPreprocessor.js`

---

## Questions?

If diagnostics show unexpected results or you need clarification on any step, refer back to this document. The enhanced error logging in coreAPI.js should now provide much more actionable error messages.
