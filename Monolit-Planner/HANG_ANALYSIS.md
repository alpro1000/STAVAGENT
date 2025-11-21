# Project Creation and Upload Hang Analysis

## SUMMARY OF FINDINGS

Based on thorough codebase analysis, I've identified **multiple potential hang points** in the project creation and file upload flows. The system has both short and long-running operations without proper timeout/error handling.

---

## PART 1: BACKEND HANG POINTS

### HANG POINT 1: CORE API Parser (HIGH RISK)
**File:** `/home/user/Monolit-Planner/backend/src/services/coreAPI.js`
**Lines:** 45-156
**Issue:** CORE API calls can hang with limited timeout handling

```javascript
// Line 45-56: Main CORE API call with 30-second timeout
const response = await axios.post(
  `${CORE_API_URL}/api/upload`,
  form,
  {
    headers: { ...form.getHeaders() },
    timeout: CORE_TIMEOUT,  // Only 30 seconds (line 12)
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  }
);
```

**Problems:**
1. **Timeout value only 30s** - If CORE service is slow, request hangs until timeout
2. **Async fallback without retry logic** (Lines 121-140): If CORE returns empty, tries to fetch async results with only 500ms delay
3. **No maximum wait time for async fetch** - Can wait indefinitely for results
4. **Errors are thrown but not caught properly in upload.js** - causes entire upload to fail

**Potential Duration:** 30-35 seconds (timeout) + 5 seconds (async fallback)

---

### HANG POINT 2: File Upload Endpoint - Synchronous CORE Dependency
**File:** `/home/user/Monolit-Planner/backend/src/routes/upload.js`
**Lines:** 128-156
**Issue:** Upload endpoint blocks while waiting for CORE API

```javascript
// Lines 128-156: CORE parser is awaited synchronously
try {
  logger.info(`[Upload] ✨ Attempting CORE parser (PRIMARY)...`);
  const corePositions = await parseExcelByCORE(filePath);  // ← BLOCKING CALL
  
  if (corePositions && corePositions.length > 0) {
    const coreProjects = extractProjectsFromCOREResponse(corePositions);
    // ... process results
  }
} catch (coreError) {
  logger.error(`[Upload] ❌ CORE parser failed: ${coreError.message}`);
  // ... no fallback, just logs error
}
```

**Problems:**
1. **CORE call is synchronous** - entire upload request hangs waiting for CORE
2. **No timeout or cancellation logic** at upload endpoint level
3. **If CORE is down**, request waits 30+ seconds before failing
4. **Response sent only AFTER** all CORE operations complete (line 332-346)

**Potential Duration:** 30-35 seconds per upload if CORE is unavailable

---

### HANG POINT 3: Database Transaction Lock (MEDIUM RISK)
**File:** `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js`
**Lines:** 162-228
**Issue:** PostgreSQL transaction can deadlock or hold locks too long

```javascript
// Lines 162-228: Long-running transaction
try {
  const pool = getPool();
  client = await pool.connect();
  await client.query('BEGIN');
  
  // Line 181: Insert project
  await client.query(insertProjectSql, [...]);
  
  // Lines 206-211: Insert multiple parts in loop
  for (const template of templates) {
    const partId = `${project_id}_${template.part_name}`;
    await client.query(insertPartSql, [partId, project_id, template.part_name, true]);
    // Multiple DB round-trips in loop
  }
  
  // Line 215: Commit (only after all inserts)
  await client.query('COMMIT');
}
```

**Problems:**
1. **Loop with individual queries** (lines 206-211) - creates N DB round-trips instead of batch insert
2. **No timeout on transaction** - can hold database locks indefinitely
3. **Connection pool exhaustion risk** - if many concurrent creates, pool can max out
4. **No query timeout** on individual `client.query()` calls

**Potential Duration:** 5-30 seconds depending on template count and DB load

---

### HANG POINT 4: Upload Endpoint Position Insertion Loop (MEDIUM RISK)
**File:** `/home/user/Monolit-Planner/backend/src/routes/upload.js`
**Lines:** 284-306
**Issue:** Synchronous loop inserting positions one-by-one

```javascript
// Lines 284-306: Create all positions sequentially
for (const pos of positionsToInsert) {
  const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.prepare(`
    INSERT INTO positions (...)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(  // ← Individual insert per position
    id, bridgeId, pos.part_name, pos.item_name, ...
  );
}
```

**Problems:**
1. **One INSERT per position** - if 168 positions, that's 168 DB round-trips
2. **Sequential execution** - queries run one after another, not in parallel
3. **No batch insert optimization** - should use INSERT ... VALUES (...), (...), ... syntax
4. **No transaction wrapping** - each insert is individual, less efficient

**Potential Duration:** 5-30 seconds for large file uploads (100+ positions)

---

### HANG POINT 5: XLSX Parsing (LOW RISK but slow)
**File:** `/home/user/Monolit-Planner/backend/src/services/parser.js`
**Lines:** 12-58
**Issue:** Large Excel files can take time to parse

```javascript
// Lines 15-28: Synchronous file parsing
const workbook = XLSX.readFile(filePath, {
  cellFormula: true,  // ← Parse formulas (slow for large sheets)
  cellStyles: true,   // ← Parse styles (slow)
  cellDates: true     // ← Parse dates
});

// Lines 31-42: Re-encode all strings
const encodedData = rawData.map(row => {
  const encodedRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      encodedRow[key] = String(value);  // ← Unnecessary re-encoding
    }
  }
  return encodedRow;
});
```

**Problems:**
1. **Parsing cell formulas and styles** is slow for large files
2. **Unnecessary re-encoding** of already-encoded strings
3. **No progress indication** - frontend doesn't know parsing is happening
4. **Blocks entire request** - nothing else happens until parsing done

**Potential Duration:** 5-20 seconds for large files (1000+ rows)

---

## PART 2: FRONTEND HANG POINTS

### HANG POINT 6: Polling Without Proper Cleanup (MEDIUM RISK)
**File:** `/home/user/Monolit-Planner/frontend/src/pages/DocumentUploadPage.tsx`
**Lines:** 168-211
**Issue:** Poll interval can accumulate and never clean up

```javascript
// Lines 168-205: Polling with potential cleanup issues
const pollForAnalysis = (documentId: string) => {
  setAnalyzing(true);
  
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const data = await response.json();
      
      if (doc.analysis_status === 'completed' && data.analysis) {
        // Line 193: Clear interval on success
        clearInterval(pollInterval);
        setAnalyzing(false);
      }
    } catch (err: any) {
      console.error('Poll error:', err);
      // ❌ No clearInterval on error! Continues polling!
    }
  }, 2000);  // Poll every 2 seconds
  
  // Line 208: Force stop after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    setAnalyzing(false);
  }, 5 * 60 * 1000);  // Only 5 minutes
};
```

**Problems:**
1. **Polling never stops on network errors** - continues every 2 seconds indefinitely
2. **5-minute hard timeout** - if analysis takes longer, polling suddenly stops
3. **No exponential backoff** - hammers API with constant 2-second requests
4. **Multiple poll intervals can stack** if user uploads multiple files - creates N polling loops

**Potential Duration:** 5 minutes + 30+ seconds of continued polling on error

---

### HANG POINT 7: CreateMonolithForm Synchronous Submit
**File:** `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`
**Lines:** 38-70
**Issue:** No timeout handling on API calls

```javascript
// Lines 38-70: Form submission
const handleSubmit = async (e: React.FormEvent) => {
  setIsSubmitting(true);
  
  try {
    // Line 50: No timeout - relies on axios default (indefinite)
    await createMonolithProject({
      project_id: projectId.trim(),
      object_type: objectType,
      // ... other fields
    });
    
    onSuccess(projectId.trim());
  } catch (err: any) {
    setError(err.response?.data?.error || err.message || 'Error');
  } finally {
    setIsSubmitting(false);
  }
};
```

**Problems:**
1. **No explicit timeout** on API call - relies on browser/axios default
2. **No loading indicator beyond isSubmitting flag** - users don't know if hanging
3. **No retry logic** - single failure = error, no retry option
4. **Button disabled until response** - user can't cancel or retry

**Potential Duration:** Browser's default timeout (usually 5+ minutes)

---

### HANG POINT 8: No Timeout in API Service
**File:** `/home/user/Monolit-Planner/frontend/src/services/api.ts`
**Lines:** 59-127
**Issue:** Axios instance has no request timeout

```javascript
// Lines 59-64: API instance creation
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
  // ❌ No timeout specified! Defaults to browser's infinite wait
});

// Lines 85-127: Retry logic doesn't include timeout adjustment
api.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    // Retries on 429 but no other timeout handling
    if (status === 429 && config.__retryCount < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);
      await delay(retryDelay);
      return api.request(config);
    }
  }
);
```

**Problems:**
1. **No request timeout** - requests can hang indefinitely
2. **No timeout on retries** - retries also have no timeout
3. **Frontend fully blocked** - no user interaction possible during hang
4. **No cancellation token** - can't cancel stuck requests

**Potential Duration:** 5+ minutes (browser's TCP timeout)

---

## PART 3: FILE LOCATIONS SUMMARY

### Frontend Files (Project Creation & Upload)
1. **Component:** `/home/user/Monolit-Planner/frontend/src/components/CreateMonolithForm.tsx`
   - Project creation form with no timeout handling

2. **Component:** `/home/user/Monolit-Planner/frontend/src/components/DocumentUpload.tsx`
   - File upload UI with no progress tracking

3. **Page:** `/home/user/Monolit-Planner/frontend/src/pages/DocumentUploadPage.tsx`
   - Upload page with polling logic (5-minute timeout)
   - Lines 168-211: Polling implementation

4. **Service:** `/home/user/Monolit-Planner/frontend/src/services/api.ts`
   - API client with NO timeout configuration
   - Lines 59-127: Axios setup and retry logic

### Backend Files (Project Creation & Upload)
1. **Route:** `/home/user/Monolit-Planner/backend/src/routes/monolith-projects.js`
   - POST /api/monolith-projects (create project)
   - Lines 81-246: Project creation with transaction
   - Lines 162-228: Transaction with loop inserts

2. **Route:** `/home/user/Monolit-Planner/backend/src/routes/upload.js`
   - POST /api/upload (file upload and parsing)
   - Lines 67-360: Main upload handler
   - Lines 128-156: CORE API integration (HANG POINT!)
   - Lines 284-306: Position insertion loop

3. **Service:** `/home/user/Monolit-Planner/backend/src/services/coreAPI.js`
   - CORE API client with 30-second timeout
   - Lines 20-156: parseExcelByCORE() - **CRITICAL HANG POINT**
   - Lines 121-140: Async result fetching without proper timeout

4. **Service:** `/home/user/Monolit-Planner/backend/src/services/parser.js`
   - XLSX file parsing
   - Lines 12-58: parseXLSX() function
   - Parses cell formulas and styles (slow)

5. **Service:** `/home/user/Monolit-Planner/backend/src/services/concreteExtractor.js`
   - Position extraction from Excel rows
   - Lines 14-66: extractConcretePositions() function

6. **Server Config:** `/home/user/Monolit-Planner/backend/server.js`
   - Lines 100-101: No timeout on body parsing (10MB limit but no timeout)
   - Rate limiting configured but not aggressive enough

7. **Database:** `/home/user/Monolit-Planner/backend/src/db/postgres.js`
   - Lines 26-32: Connection pool with 30-second idle timeout
   - connectionTimeoutMillis: 2000 (very short)

---

## PART 4: ROOT CAUSES BY SCENARIO

### Scenario 1: User Creates Project via CreateMonolithForm
**Flow:** Frontend → POST /api/monolith-projects → Backend creates project + parts
**Hang Duration:** 5-30 seconds (if database slow or many parts)

**Where:** Lines 81-246 in monolith-projects.js
**Why:** Loop inserting parts one-by-one instead of batch

---

### Scenario 2: User Uploads Excel File
**Flow:** Frontend → POST /api/upload → CORE API → Position insertion → Response
**Hang Duration:** 30-60 seconds (CORE timeout + position insertion)

**Where:**
- CORE API call (lines 45-56 in coreAPI.js): 30 seconds timeout
- Async fallback (lines 121-140): additional 5+ seconds
- Position insertion loop (lines 284-306): 5-30 seconds depending on count

**Why:** CORE is called synchronously, blocking entire request

---

### Scenario 3: User Uploads Document for Analysis
**Flow:** Frontend → POST /api/documents/upload → Polling → GET status (every 2 sec)
**Hang Duration:** Up to 5 minutes + 30+ seconds of continued polling on error

**Where:** Lines 168-211 in DocumentUploadPage.tsx
**Why:** Polling never stops on error, 5-minute hard timeout

---

## CRITICAL ISSUES RANKED BY SEVERITY

### 🔴 CRITICAL (System Hangs)
1. **CORE API Synchronous Call** (upload.js:128-156)
   - Blocks entire upload waiting for external service
   - 30+ second timeout
   - Solution: Make CORE call async, return immediately, process in background

2. **No Frontend Request Timeout** (api.ts:59-127)
   - All frontend requests can hang indefinitely
   - Solution: Add 30-second timeout to axios instance

### 🟠 HIGH (Significant Delay)
3. **Position Insertion Loop** (upload.js:284-306)
   - 168+ individual DB round-trips for large files
   - Solution: Batch insert using INSERT ... VALUES (...), (...), ...

4. **Transaction Loop Inserts** (monolith-projects.js:206-211)
   - Multiple DB round-trips in single transaction
   - Solution: Batch insert all parts in single query

5. **Polling Without Cleanup** (DocumentUploadPage.tsx:171-205)
   - Poll intervals accumulate and never stop on error
   - Solution: Clear interval on error, add exponential backoff

### 🟡 MEDIUM (Noticeable Delay)
6. **XLSX Parsing Overhead** (parser.js:15-42)
   - Parsing cell formulas and styles is slow
   - Solution: Only parse necessary cell data

7. **Connection Pool Configuration** (postgres.js:26-32)
   - connectionTimeoutMillis: 2000 is very short
   - Solution: Increase to 5000-10000ms

---

## RECOMMENDATIONS

### Immediate Actions
1. Add 30-second timeout to axios instance (frontend)
2. Add timeout to CORE API calls with fallback
3. Batch insert positions instead of loop
4. Fix polling cleanup on error

### Short Term
1. Implement async background processing for CORE API
2. Optimize XLSX parsing (don't parse formulas/styles)
3. Batch insert parts in transaction
4. Increase connection pool timeout

### Long Term
1. Implement job queue (Bull/BullMQ) for file uploads
2. Add progress tracking and webhooks
3. Implement proper async/await patterns throughout
4. Add comprehensive error handling and timeouts

