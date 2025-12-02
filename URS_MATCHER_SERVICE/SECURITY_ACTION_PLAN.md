# 🚨 Security Action Plan - PR #35 Urgent Fixes

**Priority:** 🔴 CRITICAL - Must fix before production merge

---

## Phase 1: Immediate Fixes (2-3 hours)

### 1. Create Input Validation Middleware
**File:** `backend/src/middleware/inputValidation.js`
**Why:** Prevent DoS and injection attacks

```javascript
// Centralized validation for all endpoints
export const validateUniversalMatch = (req, res, next) => {
  const { text, quantity, unit } = req.body;

  // Text validation
  if (!text || text.length < 3 || text.length > 500) {
    return res.status(400).json({
      error: 'Invalid text: must be 3-500 characters'
    });
  }

  // Quantity validation
  if (quantity !== undefined) {
    const num = Number(quantity);
    if (isNaN(num) || num < 0 || num > 10000) {
      return res.status(400).json({
        error: 'Invalid quantity: must be 0-10000'
      });
    }
  }

  // Unit validation
  if (unit && !['m2', 'm3', 'ks', 'kg', 't', 'm', 'h'].includes(unit)) {
    return res.status(400).json({
      error: 'Invalid unit'
    });
  }

  next();
};
```

**Apply in jobs.js:**
```javascript
router.post('/universal-match', validateUniversalMatch, async (req, res) => {
  // ... endpoint logic
});
```

---

### 2. Safe Error Handler
**File:** `backend/src/api/middleware/errorHandler.js` (update)
**Why:** Prevent information disclosure

```javascript
export const safeErrorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';

  // Log full error for debugging
  logger.error(`[ERROR] ${requestId}: ${err.message}`, err.stack);

  // Return safe error to client
  const statusCode = err.statusCode || 500;
  const safeMessage = getSafeMessage(statusCode, err.message);

  res.status(statusCode).json({
    error: safeMessage,
    status: 'error',
    request_id: requestId
  });
};

function getSafeMessage(status, originalMessage) {
  const messages = {
    400: 'Invalid request parameters',
    404: 'Resource not found',
    500: 'Internal server error'
  };
  return messages[status] || 'An error occurred';
}
```

---

### 3. Fix DB Query DoS in knowledgeBase.js
**Location:** Line 60-101
**Time:** 30 minutes

```javascript
// ✅ Add input length checks
const MAX_NORMALIZED_LENGTH = 100;

if (!normalizedText || normalizedText.length > MAX_NORMALIZED_LENGTH) {
  return [];
}

// ✅ Change LIKE '%' || ? || '%' to prefix matching
const fuzzyMatches = await db.all(
  `SELECT * FROM kb_mappings
   WHERE (normalized_text_cs LIKE ? || '%'
          OR normalized_text_cs LIKE ? || '%')
   AND length(normalized_text_cs) <= ?
   ORDER BY confidence DESC
   LIMIT 5`,
  [
    normalizedText.substring(0, 20),
    normalizedText.substring(0, 20),
    MAX_NORMALIZED_LENGTH * 2
  ]
);
```

---

### 4. Fix KB Poisoning in insertMapping()
**Location:** Line 131-180
**Time:** 1 hour

```javascript
// ✅ Add validation before insert
export async function insertMapping(...) {
  // Check URS code exists in catalog
  const canonicalItem = await db.get(
    `SELECT urs_code FROM urs_items WHERE urs_code = ?`,
    [ursCode]
  );

  if (!canonicalItem) {
    throw new Error(`Invalid URS code: ${ursCode}`);
  }

  // ... proceed with insert
}
```

---

### 5. Validate LLM Responses
**Location:** `universalMatcher.js:214-247`
**Time:** 45 minutes

```javascript
const MAX_RESPONSE_SIZE = 50 * 1024;  // 50KB
const MAX_MATCHES = 10;

async function callUniversalLLM(prompt) {
  const response = await llmClient.chat(...);
  const rawText = response.content[0].text;

  // Size check
  if (rawText.length > MAX_RESPONSE_SIZE) {
    throw new Error('Response too large');
  }

  // Parse check
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error('Invalid JSON from LLM');
  }

  // Schema check
  if (!Array.isArray(parsed.matches)) {
    throw new Error('Missing matches array');
  }

  // Trim if needed
  if (parsed.matches.length > MAX_MATCHES) {
    parsed.matches = parsed.matches.slice(0, MAX_MATCHES);
  }

  return parsed;
}
```

---

## Phase 2: Code Quality Fixes (1 hour)

### Fix #1: Cleanup Logic (Line 294-314)
```javascript
// BEFORE
WHERE confidence < ? AND usage_count < ?

// AFTER
WHERE confidence < ? AND usage_count <= ?
```

### Fix #2: KB Cache Hit (Line 84-95)
```javascript
// BEFORE
if (kbHits && kbHits.length > 0 && kbHits[0].confidence >= 0.85)

// AFTER
const kbHit = kbHits?.find(hit => hit.confidence >= 0.85);
if (kbHit)
```

### Fix #3: Execution Time (Line 193-226)
```javascript
// Add to formatResultFromKB response:
execution_time_ms: Date.now() - startTime
```

---

## Phase 3: Logging Security (1 hour)

### Redact User Input in Logs

```javascript
// Create helper
function redactText(text, maxChars = 20) {
  if (!text) return '[empty]';
  if (text.length <= maxChars) return `[${text.length} chars]`;
  return `[${text.length} chars]`;
}

// Use in logs
logger.info(`[UNIVERSAL-MATCH] Input: ${redactText(text)}`);
logger.debug(`[UNIVERSAL-MATCH] Full input: ${text}`);  // DEBUG level only
```

---

## 📊 Risk Matrix

| Issue | Severity | Impact | Fix Time | Priority |
|-------|----------|--------|----------|----------|
| Error exposure | 🔴 | Information leak | 30 min | P0 |
| DB DoS | 🔴 | Service disruption | 30 min | P0 |
| LLM validation | 🔴 | Resource exhaustion | 45 min | P0 |
| KB poisoning | 🟡 | Data corruption | 1 hour | P1 |
| Input validation | 🟡 | Injection attacks | 30 min | P1 |
| PII logging | 🟡 | Privacy breach | 30 min | P1 |
| Cleanup logic | 🔵 | Function broken | 5 min | P2 |
| Cache efficiency | 🔵 | Suboptimal perf | 15 min | P2 |

---

## ✅ Implementation Order

1. ✅ **Create Input Validation Middleware** - 30 min - Use across all endpoints
2. ✅ **Fix Error Handler** - 30 min - Apply globally
3. ✅ **Fix DB DoS** - 30 min - Critical for scale
4. ✅ **Validate LLM Responses** - 45 min - Prevent exhaustion
5. ✅ **Fix KB Poisoning** - 1 hour - Data integrity
6. ✅ **Add Logging Redaction** - 30 min - Privacy
7. ✅ **Quick Code Fixes** - 30 min - Cleanup, cache, execution_time
8. ✅ **Add Security Tests** - 1 hour - Prevent regression

**Total Time:** ~4-5 hours for comprehensive security fix

---

## 🧪 Quick Test Commands

```bash
# Test oversized input
curl -X POST http://localhost:3001/api/jobs/universal-match \
  -H "Content-Type: application/json" \
  -d '{"text":"'$(printf 'a%.0s' {1..501})'","quantity":1}'

# Should return 400, not 500

# Test error response (missing required field)
curl -X POST http://localhost:3001/api/jobs/universal-match \
  -H "Content-Type: application/json" \
  -d '{}'

# Should NOT expose error details

# Test KB insert with invalid code
curl -X POST http://localhost:3001/api/jobs/universal-match/feedback \
  -H "Content-Type: application/json" \
  -d '{"urs_code":"99.99.99","urs_name":"Fake","unit":"m2","is_correct":true}'

# Should reject gracefully
```

---

## 📝 PR Merge Checklist

Before merging PR #35:

- [ ] All input validation checks pass
- [ ] Error messages are sanitized (no stack traces)
- [ ] DB queries have length limits
- [ ] LLM responses validated for size & schema
- [ ] KB insert validates against catalog
- [ ] All logs redact user data (except DEBUG level)
- [ ] Security tests added and passing
- [ ] Staging deployment tested
- [ ] Performance benchmarks OK (< 2s per request)

---

## 🚀 Next PR Title

```
SECURITY: Comprehensive fixes for PR #35 URS Matcher endpoints

- Add input validation middleware (DoS prevention)
- Sanitize error responses (information disclosure)
- Validate LLM responses (resource exhaustion)
- Validate KB inserts against catalog (data poisoning)
- Redact PII from logs (privacy)
- Fix cleanup and cache logic
- Add comprehensive security tests
```

