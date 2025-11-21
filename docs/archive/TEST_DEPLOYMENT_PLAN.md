# 🧪 Test Deployment Plan for monolit-planner-test.onrender.com

**Date:** November 20, 2025
**Test Environment:** https://monolit-planner-test.onrender.com/
**Production Environment:** https://monolit-planner-frontend.onrender.com/
**Purpose:** Verify all syntax fixes work before production deployment

---

## 📋 Pre-Deployment Checklist

### ✅ Local Verification (Already Done)
- [x] TypeScript compiles without errors
- [x] Frontend builds successfully with Vite
- [x] Backend starts without syntax errors
- [x] All 34 part templates load correctly
- [x] Database initializes properly
- [x] monolith-projects.js syntax verified

### 🔄 Test Server Verification (Next)
- [ ] Test server deploys without "Missing catch or finally after try" error
- [ ] Backend starts successfully on test server
- [ ] Frontend loads on test server
- [ ] All API endpoints respond correctly
- [ ] Sheathing calculator functions work
- [ ] Type safety improvements prevent runtime errors

---

## 🚀 Deployment Steps for Test Server

### 1. **Trigger Rebuild on Test Server**
The test server should automatically trigger from your branch. If not:
1. Go to Render dashboard → monolit-planner-test services
2. Click "Manual Deploy" or "Rebuild Latest"
3. Watch the build logs for completion

### 2. **Monitor Build Process**
Watch for:
```
✅ npm install (root)
✅ cd backend && npm install
✅ npm run prepare:shared
✅ TypeScript compilation (tsc)
✅ Backend node server.js starts
```

### ❌ If You See These Errors:
```
SyntaxError: Missing catch or finally after try
```
→ This means the fix wasn't applied. Check:
- Branch is `claude/fix-syntax-error-01TVupYbJbcVGQdcr3jTvzs8`
- render.yaml has root `npm install` commands
- shared/tsconfig.json has `"DOM"` in lib

---

## 🧪 Functional Testing (After Deploy Completes)

### Test 1: Frontend Loads ✅
```bash
# Check frontend is accessible
curl -I https://monolit-planner-test.onrender.com/ | grep "200\|301"

# Expected: HTTP 200 or 301 (redirect to SPA)
```

### Test 2: Backend API Health ✅
```bash
# Check backend health endpoint
curl https://monolit-planner-test.onrender.com/health

# Expected Response:
# {"status":"ok"} or similar
```

### Test 3: User Registration (Type Safety Test #1) ✅
```bash
curl -X POST https://monolit-planner-test.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Expected: 201 or 200 (account created)
# Not: 500 error about undefined properties
```

### Test 4: Project Creation (Sheathing Calculator Test #1) ✅
```bash
# First login to get token
curl -X POST https://monolit-planner-test.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Store the returned token, then create project
curl -X POST https://monolit-planner-test.onrender.com/api/monolith-projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "TEST-PROJ-001",
    "object_type": "bridge",
    "project_name": "Test Bridge",
    "object_name": "SO 201"
  }'

# Expected: 201 (project created with 12 default parts)
# Check response includes: parts_count: 12
```

### Test 5: Sheathing Captures (Type Safety Test #2) ✅
```bash
# Create a sheathing capture
curl -X POST https://monolit-planner-test.onrender.com/api/sheathing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "TEST-PROJ-001",
    "capture_id": "CAP-001",
    "part_name": "ZÁKLADY",
    "length_m": 50,
    "width_m": 8,
    "height_m": 2,
    "area_m2": 400,
    "assembly_norm_ph_m2": 1.5,
    "concrete_curing_days": 5,
    "num_kits": 2,
    "daily_rental_cost_czk": 5000,
    "work_method": "staggered"
  }'

# Expected: 201 (capture created)
# ✅ This tests the daily_rental_cost_czk fix!
```

### Test 6: Sheathing Capture Without Rental Cost (Type Safety Test #3) ✅
```bash
# Create capture WITHOUT daily_rental_cost_czk (optional field)
curl -X POST https://monolit-planner-test.onrender.com/api/sheathing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "TEST-PROJ-001",
    "capture_id": "CAP-002",
    "part_name": "PILÍŘE",
    "length_m": 30,
    "width_m": 4,
    "height_m": 3,
    "area_m2": 120,
    "assembly_norm_ph_m2": 1.2,
    "concrete_curing_days": 7,
    "num_kits": 3,
    "work_method": "sequential"
    // Note: NO daily_rental_cost_czk!
  }'

# Expected: 201 (capture created successfully)
# ✅ This confirms the ?? operator handles undefined correctly!
```

### Test 7: Get Sheathing Captures ✅
```bash
curl -X GET "https://monolit-planner-test.onrender.com/api/sheathing/TEST-PROJ-001" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 with array of 2 captures
# Both should have calculations completed
```

---

## 🔍 What These Tests Verify

| Test | Verifies | Fix # |
|------|----------|-------|
| Test 1 | Frontend loads without 404 | Render config |
| Test 2 | Backend started successfully | TypeScript config |
| Test 3 | Type system works (registration) | TypeScript + Render config |
| Test 4 | Shared package resolves (projects created) | Render config |
| Test 5 | Optional field with value works | daily_rental_cost_czk fix |
| Test 6 | Optional field without value works | daily_rental_cost_czk fix |
| Test 7 | Calculations complete successfully | Overall system health |

---

## 📊 Browser Testing (Visual)

### 1. **Visit Frontend**
```
https://monolit-planner-test.onrender.com/
```
- ✅ Should see login page (not 500 error)
- ✅ No TypeScript errors in console
- ✅ No undefined property errors

### 2. **Register New Account**
```
Email: testuser@test.com
Password: TestPassword123
Name: Test User
```
- ✅ Registration succeeds
- ✅ Email verification prompt appears
- ✅ No "undefined" or "cannot read property" errors

### 3. **Login**
```
Email: testuser@test.com
Password: TestPassword123
```
- ✅ Login succeeds (after email verification)
- ✅ Dashboard loads
- ✅ Sidebar shows projects

### 4. **Create Bridge Project**
- Click "New Project"
- Select "Bridge" as object type
- Fill in details
- ✅ Project created successfully
- ✅ 12 default parts appear

### 5. **Test Sheathing Calculator** (if implemented)
- Navigate to Sheathing Captures
- Add capture with rental cost
- ✅ Calculations show without errors
- Add capture without rental cost
- ✅ Still works (optional field handled)

---

## 🐛 Debugging Commands

### Check Backend Logs
```bash
# Via Render dashboard → Services → monolit-planner-test (backend) → Logs
# Look for:
# - [Database] Using SQLite
# - [OTSKP] Successfully auto-loaded 17904 codes
# - [Part Templates] Successfully loaded 34 templates
# - 🚀 Monolit Planner Backend running on port 3001
```

### Check Build Errors
If deploy fails, check:
1. **Render Build Log** → look for "error TS"
2. **npm output** → look for "Missing catch or finally"
3. **workspace errors** → look for "Cannot find module '@stavagent/monolit-shared'"

### Frontend Console Errors
In browser (DevTools → Console):
- [ ] No red error messages
- [ ] No "Cannot read property 'capture_id' of undefined"
- [ ] No "daily_rental_cost_czk is undefined" errors

---

## ✅ Success Criteria

**Deploy is successful if:**
1. ✅ No build errors on Render
2. ✅ Frontend loads without 500 error
3. ✅ Backend health endpoint responds
4. ✅ Can register and login
5. ✅ Can create projects
6. ✅ Can create sheathing captures (with or without rental cost)
7. ✅ No TypeScript/undefined errors in console

**If all above pass → Ready for production deployment!**

---

## 🚨 Rollback Plan

If test server fails:
1. Check the specific error in Render logs
2. Verify fixes were applied locally:
   - `git show 2199cb7` (TypeScript config)
   - `git show c586ce2` (Type safety)
   - `git show 45f6296` (Render config)
3. If fixes look correct → likely a Render cache issue
   - Try "Clear Build Cache" in Render dashboard
   - Retry manual deploy
4. If still fails → investigate the specific error

---

## 📝 Reporting Results

Once you've tested, please share:
```
✅ Frontend loads: YES/NO
✅ Backend responds: YES/NO
✅ Registration works: YES/NO
✅ Projects create: YES/NO
✅ Sheathing captures: YES/NO
✅ No console errors: YES/NO
✅ Ready for production: YES/NO

Notes: [Any issues encountered]
```

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
```bash
git push  # Already done
# Then merge branch to main when ready:
# Pull Request → Merge
```

### If Tests Fail ❌
1. Check error in Render logs
2. Create new commit with fix
3. Push to same branch
4. Retry test deploy (Render auto-rebuilds)

---

**Last Updated:** November 20, 2025
**Status:** Ready for test deployment
**Test Server:** https://monolit-planner-test.onrender.com/
