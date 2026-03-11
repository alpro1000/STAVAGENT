# CORS Fix - Deployment Instructions

**Date:** 2025-01-XX  
**Commit:** `62d1604`  
**Status:** ✅ Pushed to main

---

## 🔴 Problem Fixed

**Error:**
```
Access to fetch at 'https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/passport/generate' 
from origin 'https://www.stavagent.cz' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Impact:**
- Portal (www.stavagent.cz) couldn't call concrete-agent API
- Document Passport module broken
- 502 Bad Gateway errors

---

## ✅ Solution Applied

**File:** `concrete-agent/packages/core-backend/app/main.py`

**Change:**
```python
# Before: Wildcard CORS (doesn't work with credentials)
allow_origins=["*"]

# After: Specific origins
allow_origins=[
    "https://www.stavagent.cz",
    "https://stavagent.cz",
    "https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app",
    "https://monolit-planner-frontend.vercel.app",
    "https://monolit-planner-api-3uxelthc4q-ey.a.run.app",
    "https://stavagent-backend-ktwx.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000"
]
```

---

## 🚀 Deployment Status

### 1. Git Push
- ✅ Committed: `62d1604`
- ✅ Pushed to main
- ✅ GitHub: https://github.com/alpro1000/STAVAGENT/commit/62d1604

### 2. Render Auto-Deploy
**Service:** concrete-agent  
**URL:** https://concrete-agent-3uxelthc4q-ey.a.run.app

**Expected:**
- Render detects commit on main
- Triggers auto-deploy (~5-10 minutes)
- Service restarts with new CORS config

**Check deployment:**
```bash
# 1. Check Render dashboard
https://dashboard.render.com

# 2. Check logs for CORS config
# Should see: "CORS middleware configured with 9 origins"

# 3. Test CORS headers
curl -I https://concrete-agent-3uxelthc4q-ey.a.run.app/health \
  -H "Origin: https://www.stavagent.cz"

# Expected response headers:
# Access-Control-Allow-Origin: https://www.stavagent.cz
# Access-Control-Allow-Credentials: true
```

---

## 🧪 Testing

### Test 1: Portal → CORE API

1. Open: https://www.stavagent.cz
2. Navigate to Document Passport
3. Upload PDF document
4. Click "Generate Passport"
5. Verify:
   - ✅ No CORS error in console
   - ✅ Request succeeds
   - ✅ Passport generated

### Test 2: CORS Headers

```bash
# Test from Portal origin
curl -X OPTIONS https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/passport/generate \
  -H "Origin: https://www.stavagent.cz" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Expected:
# < HTTP/2 200
# < access-control-allow-origin: https://www.stavagent.cz
# < access-control-allow-credentials: true
# < access-control-allow-methods: *
# < access-control-allow-headers: *
```

---

## ⏱️ Timeline

| Step | Status | Time |
|------|--------|------|
| Code change | ✅ Done | 0 min |
| Git commit | ✅ Done | 0 min |
| Git push | ✅ Done | 0 min |
| Render deploy | ⏳ Pending | ~5-10 min |
| Service restart | ⏳ Pending | ~2-3 min |
| Testing | ⏳ Pending | ~5 min |

**Total:** ~15-20 minutes

---

## 📝 Notes

### Why wildcard didn't work?

```python
# This doesn't work with credentials:
allow_origins=["*"]
allow_credentials=True  # ❌ Conflict!

# Browser blocks requests when:
# - Origin is wildcard (*)
# - Credentials are enabled
# - Request includes cookies/auth headers
```

### Security

- ✅ Only STAVAGENT services allowed
- ✅ No wildcard (secure)
- ✅ Localhost for development
- ✅ All production URLs included

---

## 🔗 Related

- **Issue:** CORS blocking Portal → CORE API
- **Priority:** #1 (URGENT - CORE Deployment Fix)
- **Commit:** https://github.com/alpro1000/STAVAGENT/commit/62d1604

---

## ✅ Success Criteria

- [ ] Render deployment complete
- [ ] Service restarted
- [ ] CORS headers present in response
- [ ] Portal can call concrete-agent API
- [ ] Document Passport works
- [ ] No console errors

---

**Status:** ⏳ Waiting for Render deployment  
**ETA:** ~15-20 minutes  
**Next:** Test in production after deployment
