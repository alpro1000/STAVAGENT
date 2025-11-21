# Quick Reference: All Project Creation & Upload Related Files

## CRITICAL FILES TO REVIEW

### BACKEND - HANG POINTS (MOST CRITICAL)

#### 1. CORE API Timeout (30+ seconds hang potential)
**File:** `/home/user/Monolit-Planner/backend/src/services/coreAPI.js`
- Lines 11-12: Timeout configuration (30 seconds)
- Lines 20-156: parseExcelByCORE() function
- Lines 45-56: CORE API POST call (synchronous)
- Lines 121-140: Async fallback without timeout

#### 2. Upload Endpoint Hangs on CORE
**File:** `/home/user/Monolit-Planner/backend/src/routes/upload.js`
- Lines 67-360: Main upload handler
- Lines 128-156: Synchronous CORE call (BLOCKING)
- Lines 284-306: Position insertion loop (168+ DB round-trips)
- Lines 332-346: Response sent after all processing

#### 3. Project Creation Transaction Loop
**File:** `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js`
- Lines 81-246: POST /api/monolith-projects handler
- Lines 162-228: Transaction with loop inserts (5-30 seconds)
- Lines 206-211: Individual part inserts in loop (N DB calls)

#### 4. Database Connection Pool Configuration
**File:** `/home/user/Monolit-Planner/backend/src/db/postgres.js`
- Lines 26-32: Pool configuration
- Line 31: connectionTimeoutMillis: 2000 (very short)

### FRONTEND - HANG POINTS

#### 5. API Client with NO Timeout
**File:** `/home/user/Monolit-Planner/frontend/src/services/api.ts`
- Lines 59-64: Axios instance creation (NO TIMEOUT!)
- Lines 85-127: Retry logic without timeout handling
- Line 305-308: uploadAPI.uploadXLSX() (no timeout)

#### 6. Polling Without Cleanup
**File:** `/home/user/Monolit-Planner/frontend/src/pages/DocumentUploadPage.tsx`
- Lines 168-211: pollForAnalysis() function
- Line 171: setInterval() with no cleanup on error
- Line 207: 5-minute hard timeout

#### 7. Project Creation Form - No Timeout
**File:** `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`
- Lines 38-70: handleSubmit() function
- Line 50-62: createMonolithProject() call (no timeout)

### SUPPORTING FILES

#### 8. XLSX Parser (Slow)
**File:** `/home/user/Monolit-Planner/backend/src/services/parser.js`
- Lines 12-58: parseXLSX() function
- Lines 15-19: cellFormula, cellStyles enabled (slow)

#### 9. Position Extractor
**File:** `/home/user/Monolit-Planner/backend/src/services/concreteExtractor.js`
- Lines 14-66: extractConcretePositions() function

#### 10. Rate Limiter (May block uploads)
**File:** `/home/user/Monolit-Planner/backend/src/middleware/rateLimiter.js`
- Lines 57-70: uploadLimiter (10 uploads per hour)

#### 11. Server Configuration
**File:** `/home/user/Monolit-Planner/backend/server.js`
- Lines 100-101: Body size limit (10MB, no timeout)
- Lines 130, 140: Upload route rate limiter

---

## KEY CODE SECTIONS CAUSING HANGS

### SECTION A: CORE API Call (30+ second hang)
```
File: /home/user/Monolit-Planner/backend/src/routes/upload.js
Lines: 128-156
Problem: await parseExcelByCORE(filePath) blocks entire request

Fix: Make CORE call async, don't await in request handler
```

### SECTION B: Position Loop (5-30 second hang)
```
File: /home/user/Monolit-Planner/backend/src/routes/upload.js
Lines: 284-306
Problem: for (const pos of positionsToInsert) with individual INSERTs

Fix: Use batch insert: INSERT INTO positions VALUES (...), (...), ...
```

### SECTION C: Parts Loop in Transaction (5-30 second hang)
```
File: /home/user/Monolit-Planner/backend/src/routes/monolith-projects.js
Lines: 206-211
Problem: for (const template of templates) with individual client.query()

Fix: Batch insert all parts in single query
```

### SECTION D: No Frontend Timeout (indefinite hang)
```
File: /home/user/Monolit-Planner/frontend/src/services/api.ts
Lines: 59-64
Problem: axios.create() has no timeout property

Fix: Add timeout: 30000 to axios configuration
```

### SECTION E: Polling Never Stops (5+ minutes)
```
File: /home/user/Monolit-Planner/frontend/src/pages/DocumentUploadPage.tsx
Lines: 168-211, specifically 171-205
Problem: catch block doesn't clearInterval on error

Fix: Add clearInterval(pollInterval) in catch block
```

---

## FILE TREE FOR CONTEXT

```
/home/user/Monolit-Planner/
├── backend/
│   ├── server.js                          ← Server configuration
│   └── src/
│       ├── routes/
│       │   ├── monolith-projects.js       ← Project creation (HANG POINT)
│       │   └── upload.js                  ← File upload (HANG POINT)
│       ├── services/
│       │   ├── coreAPI.js                 ← CORE API client (HANG POINT)
│       │   ├── parser.js                  ← XLSX parsing
│       │   └── concreteExtractor.js       ← Position extraction
│       ├── db/
│       │   └── postgres.js                ← Connection pool config
│       └── middleware/
│           └── rateLimiter.js             ← Rate limiting
│
└── frontend/
    └── src/
        ├── services/
        │   └── api.ts                     ← API client (NO TIMEOUT!)
        ├── pages/
        │   └── DocumentUploadPage.tsx     ← Upload page (POLLING HANG)
        └── components/
            ├── CreateMonolithForm.tsx     ← Project form (NO TIMEOUT)
            └── DocumentUpload.tsx         ← Upload component
```

---

## HANG DURATION BY SCENARIO

| Scenario | Duration | Root Cause | File |
|----------|----------|-----------|------|
| Create Project | 5-30s | Loop inserts | monolith-projects.js:206-211 |
| Upload File | 30-60s | CORE API + position loop | upload.js:128-156 + 284-306 |
| Analyze Doc | 5+ min | Polling never stops | DocumentUploadPage.tsx:171-205 |
| Any Request | 5+ min | No axios timeout | api.ts:59-64 |

---

## CONFIGURATION TO CHECK

1. **CORE API URL:** Check env var `CORE_API_URL` (default: concrete-agent.onrender.com)
2. **CORE Timeout:** Check env var `CORE_TIMEOUT` (default: 30000ms)
3. **Database URL:** Check env var `DATABASE_URL` (PostgreSQL connection)
4. **Connection Pool:** Max 20, idleTimeout 30s, connectTimeout 2s
5. **Upload Limiter:** 10 uploads per hour per IP

---

## RELATED ANALYSIS DOCS

- `/home/user/Monolit-Planner/UPLOAD_FLOW_ANALYSIS.md` - Previous analysis of upload flow
- `/home/user/Monolit-Planner/DATABASE_MIGRATION_GUIDE.md` - Database schema info

