# FIX: Monolit Backend - OTSKP 500 + Delete Project 404 Errors

## 📋 Summary
Fixes two backend errors in Monolit Planner: OTSKP search 500 error and delete project 404 error.

## 🐛 Problems

### 1. OTSKP Search 500 Error
```
monolit-planner-api-3uxelthc4q-ey.a.run.app/api/otskp/search?q=420324
Status: 500 Internal Server Error
```

**Cause:** Database query fails when OTSKP table is empty or not initialized.

### 2. Delete Project 404 Error
```
DELETE /api/monolith-projects/by-project-name/Bez%20projektu
Status: 404 Not Found
```

**Cause:** Endpoint returns 404 when project doesn't exist, causing frontend error.

## ✅ Solutions

### 1. OTSKP Search - Add Table Check
**File:** `Monolit-Planner/backend/src/routes/otskp.js`

**Before:**
```javascript
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    // ... validation
    const results = await db.prepare(sql).all(...params); // ❌ Fails if table empty
```

**After:**
```javascript
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    // ... validation
    
    // Check if OTSKP table exists and has data
    try {
      const count = await db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
      if (count.count === 0) {
        return res.json({ query: q.trim(), count: 0, results: [], message: 'OTSKP codes not loaded yet' });
      }
    } catch (tableError) {
      return res.status(500).json({ error: 'OTSKP database not initialized', details: tableError.message });
    }
    
    const results = await db.prepare(sql).all(...params); // ✅ Safe
```

**Benefits:**
- Returns empty results instead of 500 error
- Clear message: "OTSKP codes not loaded yet"
- Frontend can handle gracefully

### 2. Delete Project - Idempotent Response
**File:** `Monolit-Planner/backend/src/routes/monolith-projects.js`

**Before:**
```javascript
if (projectsToDelete.length === 0) {
  return res.status(404).json({ error: 'No projects found with this project_name' }); // ❌ Error
}
```

**After:**
```javascript
if (projectsToDelete.length === 0) {
  logger.warn(`[DELETE PROJECT] No projects found with project_name: "${projectName}"`);
  // Return success with 0 deleted instead of 404 (idempotent)
  return res.json({
    success: true,
    message: `No objects found with project_name "${projectName}" (already deleted or never existed)`,
    deleted_count: 0,
    deleted_ids: []
  }); // ✅ Success
}
```

**Benefits:**
- Idempotent DELETE (safe to call multiple times)
- No frontend error when project already deleted
- Follows REST best practices

## 📊 Impact

### Before:
```
❌ OTSKP search: 500 error when table empty
❌ Delete project: 404 error when project not found
❌ Frontend shows error alerts
❌ User confused by error messages
```

### After:
```
✅ OTSKP search: Returns empty array with message
✅ Delete project: Returns success with 0 deleted
✅ Frontend handles gracefully
✅ Better user experience
```

## 📁 Files Changed

1. **Monolit-Planner/backend/src/routes/otskp.js** (+19, -0)
   - Added table existence check before search
   - Returns empty results instead of 500 error
   - Clear error message for uninitialized database

2. **Monolit-Planner/backend/src/routes/monolith-projects.js** (+8, -1)
   - Changed 404 to success response for missing projects
   - Idempotent DELETE operation
   - Better logging for debugging

## 🧪 Testing

### Test 1: OTSKP Search (Empty Database)
```bash
curl "https://monolit-planner-api-3uxelthc4q-ey.a.run.app/api/otskp/search?q=420324"
```
**Expected:**
```json
{
  "query": "420324",
  "count": 0,
  "results": [],
  "message": "OTSKP codes not loaded yet"
}
```

### Test 2: Delete Non-Existent Project
```bash
curl -X DELETE "https://monolit-planner-api-3uxelthc4q-ey.a.run.app/api/monolith-projects/by-project-name/NonExistent"
```
**Expected:**
```json
{
  "success": true,
  "message": "No objects found with project_name \"NonExistent\" (already deleted or never existed)",
  "deleted_count": 0,
  "deleted_ids": []
}
```

### Test 3: Delete Existing Project (Twice)
```bash
# First call - deletes project
curl -X DELETE ".../by-project-name/TestProject"
# Returns: { success: true, deleted_count: 3, deleted_ids: [...] }

# Second call - idempotent
curl -X DELETE ".../by-project-name/TestProject"
# Returns: { success: true, deleted_count: 0, deleted_ids: [] }
```

## 🚀 Deployment

### Backend Restart Required:
```bash
# Render will auto-deploy on push to main
# Or manual restart:
cd Monolit-Planner/backend
npm start
```

### No Database Changes
No migrations required.

### No Breaking Changes
- OTSKP search still returns same format (just handles empty case)
- Delete project still returns success (just doesn't error on missing)

## 📝 Notes

### OTSKP Table Initialization
If OTSKP codes are not loaded:
1. Upload `2025_03 OTSKP.xml` to `/app/` directory on Render
2. Call `POST /api/otskp/import` with `X-Import-Token` header
3. Verify with `GET /api/otskp/count`

### Idempotent DELETE
REST best practice: DELETE should be idempotent (safe to call multiple times).
- First call: Deletes project, returns deleted_count > 0
- Subsequent calls: Returns deleted_count = 0 (already deleted)
- No error thrown

## ✅ Checklist

- [x] OTSKP search handles empty database
- [x] Delete project is idempotent
- [x] Error messages are clear
- [x] Logging improved for debugging
- [x] No breaking changes
- [x] Backward compatible

## 🔗 Related

- Part of: Portal Tabs + Modal Redesign PR
- Fixes: Console errors in Monolit Planner frontend

## 👥 Reviewers

@alpro1000

---

**Type:** Bug Fix  
**Priority:** Medium  
**Impact:** Backend API (Monolit Planner)  
**Breaking Changes:** None  
**Lines Changed:** +27, -1
