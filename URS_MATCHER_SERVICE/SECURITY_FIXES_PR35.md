# 🔒 Security Fixes for PR #35 - URS Matcher Service

**Date:** 2025-12-02
**Status:** Identified & Ready for Implementation
**Severity:** 🔴 CRITICAL + 🟡 MEDIUM + 🔵 LOW

---

## Executive Summary

PR #35 introduces `/universal-match` and `/feedback` endpoints which have **5 critical security issues** and **4 optimization recommendations**.

### Issues Found
- ❌ Error/info exposure (raw error messages returned to client)
- ❌ Unbounded DB query load (DoS vulnerability)
- ❌ Unvalidated LLM response handling (resource exhaustion risk)
- ❌ KB poisoning risk (no data validation before insert)
- ❌ Limited input validation (quantity, unit types not enforced)
- ⚠️ PII in logs (user text logged without redaction)

### Recommendations
- ✨ Cache hit efficiency optimization
- ✨ Add execution_time_ms consistency
- ✨ Fix logic errors in cleanup functions
- ✨ Better null handling for unused arguments

---

## 🔴 Critical Issues

### Issue #1: Error/Info Exposure and DoS Risk

**Location:** `jobs.js:838-880` - `/universal-match` endpoint

**Problem:**
```javascript
// ❌ CURRENT - Returns raw error messages
catch (error) {
  logger.error(`[UNIVERSAL-MATCH] Error: ${error.message}`);
  res.status(500).json({
    error: error.message,    // 🚨 Exposes internal details
    status: 'error'
  });
}
```

**Why it's dangerous:**
1. Stack traces expose internal implementation details
2. Helps attackers understand system architecture
3. Database errors might leak schema information
4. No rate limiting on endpoint that calls LLM (DoS vector)

**Solution:**

```javascript
// ✅ FIXED - Sanitized error response
import { generateRequestId } from '../../utils/requestId.js';

const ERROR_MESSAGES = {
  'INVALID_REQUEST': 'Invalid request parameters',
  'LLM_ERROR': 'Processing failed. Please try again.',
  'DB_ERROR': 'Database operation failed',
  'TIMEOUT': 'Request processing timeout',
  'DEFAULT': 'An error occurred. Please contact support.'
};

function getSafeErrorMessage(error) {
  if (error.message.includes('timeout')) return ERROR_MESSAGES.TIMEOUT;
  if (error.message.includes('database')) return ERROR_MESSAGES.DB_ERROR;
  if (error.message.includes('INVALID')) return ERROR_MESSAGES.INVALID_REQUEST;
  return ERROR_MESSAGES.DEFAULT;
}

router.post('/universal-match', async (req, res) => {
  const requestId = generateRequestId();
  try {
    // ... endpoint logic
  } catch (error) {
    const safeMessage = getSafeErrorMessage(error);
    logger.error(`[UNIVERSAL-MATCH] ${requestId} Error: ${error.message}`);
    logger.debug(`[UNIVERSAL-MATCH] ${requestId} Stack: ${error.stack}`);

    res.status(500).json({
      error: safeMessage,
      status: 'error',
      request_id: requestId  // для трейсинга в логах
    });
  }
});
```

**Files to modify:**
- `backend/src/api/routes/jobs.js` - lines 838-880, 920-943
- `backend/src/utils/requestId.js` - create new

---

### Issue #2: Unbounded DB Query Load (DoS)

**Location:** `knowledgeBase.js:60-101` - Fuzzy match LIKE queries

**Problem:**
```javascript
// ❌ CURRENT - No input length validation
const fuzzyMatches = await db.all(
  `SELECT * FROM kb_mappings
   WHERE normalized_text_cs LIKE '%' || ? || '%'  -- unbounded LIKE
   ORDER BY confidence DESC
   LIMIT 5`,
  [normalizedText]  // Could be very long string causing expensive scan
);
```

**Attack scenario:**
```javascript
// Attacker sends massive text input
{
  "text": "a".repeat(100000),  // 100KB string
  "use_llm": false
}
// Results in expensive LIKE '%aaaa...%' scan
```

**Solution:**

```javascript
// ✅ FIXED - Input validation + optimized queries
const MAX_TEXT_LENGTH = 500;  // Reasonable limit
const MAX_NORMALIZED_LENGTH = 100;

export async function searchKnowledgeBase(normalizedText, contextHash) {
  // Validate input length
  if (!normalizedText || normalizedText.length > MAX_NORMALIZED_LENGTH) {
    logger.warn(`[KB] Input too long: ${normalizedText?.length || 0} chars`);
    return [];
  }

  try {
    const db = getDatabase();

    // Try exact match first (indexed, fast)
    if (contextHash) {
      const exactMatch = await db.get(
        `SELECT * FROM kb_mappings
         WHERE normalized_text_cs = ? AND context_hash = ?
         ORDER BY confidence DESC, usage_count DESC
         LIMIT 1`,
        [normalizedText, contextHash]
      );

      if (exactMatch) {
        logger.info(`[KB] Exact match found: confidence=${exactMatch.confidence}`);
        return [exactMatch];
      }
    }

    // Fuzzy match with length guard + LIMIT to prevent expensive scans
    // Use SUBSTR for prefix matching (more efficient than LIKE %)
    const fuzzyMatches = await db.all(
      `SELECT * FROM kb_mappings
       WHERE (normalized_text_cs LIKE ? || '%'  -- Prefix matching (uses index)
              OR normalized_text_cs LIKE '%' || ? || '%')  -- Fallback to substring
       AND length(normalized_text_cs) <= ?  -- Prevent massive entries
       ORDER BY confidence DESC, usage_count DESC
       LIMIT 5`,  -- Hard limit
      [
        normalizedText.substring(0, 20),  // Limit prefix search length
        normalizedText.substring(0, 20),
        MAX_NORMALIZED_LENGTH * 2
      ]
    );

    return fuzzyMatches || [];

  } catch (error) {
    logger.error(`[KB] Search error: ${error.message}`);
    throw error;
  }
}
```

**Database optimization:**
```sql
-- Add COVERING INDEX for faster queries (if not exists)
CREATE INDEX IF NOT EXISTS kb_mappings_prefix_idx
ON kb_mappings(normalized_text_cs, confidence DESC, usage_count DESC)
WHERE normalized_text_cs IS NOT NULL;
```

---

### Issue #3: Unvalidated LLM Response Handling

**Location:** `universalMatcher.js:214-247`

**Problem:**
```javascript
// ❌ CURRENT - No size limits or schema validation
async function callUniversalLLM(prompt) {
  const response = await llmClient.chat({
    model: 'claude-3-5-sonnet',
    messages: [{ role: 'user', content: prompt }]
  });

  // Assumes response is safe JSON
  const parsed = JSON.parse(response.content[0].text);
  return parsed;  // Could be huge or malformed
}
```

**Attack scenario:**
```javascript
// Attacker jailbreaks LLM to return massive JSON
{
  "matches": [
    { "urs_code": "01.01.01", "data": "x".repeat(1000000) },
    // ... millions of entries
  ]
}
// Results in memory exhaustion
```

**Solution:**

```javascript
// ✅ FIXED - Strict validation + size limits
const MAX_RESPONSE_SIZE = 50 * 1024;  // 50KB max
const MAX_MATCHES = 10;
const MAX_TEXT_LENGTH_IN_RESPONSE = 1000;

async function callUniversalLLM(prompt) {
  try {
    const response = await llmClient.chat({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }]
    });

    const rawText = response.content[0].text;

    // Validate response size
    if (rawText.length > MAX_RESPONSE_SIZE) {
      logger.error(`[LLM] Response too large: ${rawText.length} bytes`);
      throw new Error('LLM response exceeds maximum size');
    }

    // Parse and validate structure
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      logger.error(`[LLM] Invalid JSON: ${parseError.message}`);
      throw new Error('LLM returned invalid JSON');
    }

    // Validate response schema
    if (!parsed.matches || !Array.isArray(parsed.matches)) {
      throw new Error('LLM response missing "matches" array');
    }

    if (parsed.matches.length > MAX_MATCHES) {
      logger.warn(`[LLM] Trimming ${parsed.matches.length} matches to ${MAX_MATCHES}`);
      parsed.matches = parsed.matches.slice(0, MAX_MATCHES);
    }

    // Validate each match
    const validatedMatches = parsed.matches
      .filter(match => {
        // Check required fields
        if (!match.urs_code || typeof match.urs_code !== 'string') {
          logger.warn(`[LLM] Invalid match: missing or invalid urs_code`);
          return false;
        }

        // Truncate text fields
        if (match.reason_cs && match.reason_cs.length > MAX_TEXT_LENGTH_IN_RESPONSE) {
          match.reason_cs = match.reason_cs.substring(0, MAX_TEXT_LENGTH_IN_RESPONSE) + '...';
        }

        return true;
      });

    return {
      ...parsed,
      matches: validatedMatches
    };

  } catch (error) {
    logger.error(`[LLM] Error: ${error.message}`);
    throw error;
  }
}
```

---

### Issue #4: KB Poisoning Risk

**Location:** `knowledgeBase.js:131-180` - `insertMapping()`

**Problem:**
```javascript
// ❌ CURRENT - No validation against canonical catalog
export async function insertMapping(
  normalizedTextCs,
  languageHint,
  projectType,
  buildingSystem,
  ursCode,        // 🚨 Not validated!
  ursName,        // 🚨 Not validated!
  unit,           // 🚨 Not validated!
  confidence = 0.8
) {
  const db = getDatabase();

  // Directly insert without verification
  await db.run(
    `INSERT INTO kb_mappings (...)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
    [normalizedTextCs, languageHint, contextHash, projectType, buildingSystem,
     ursCode, ursName, unit, confidence, validatedByUser, ...]
  );
}
```

**Attack scenario:**
```javascript
// Attacker submits feedback with fake URS code
{
  "text": "walls",
  "urs_code": "99.99.99",  // Fake code not in catalog
  "urs_name": "Malicious entry",
  "is_correct": true
}
// Gets stored and corrupts knowledge base
```

**Solution:**

```javascript
// ✅ FIXED - Validate against canonical catalog
export async function insertMapping(
  normalizedTextCs,
  languageHint,
  projectType,
  buildingSystem,
  ursCode,
  ursName,
  unit,
  confidence = 0.8,
  validatedByUser = false
) {
  try {
    const db = getDatabase();

    // CRITICAL: Validate URS code exists in canonical catalog
    const canonicalItem = await db.get(
      `SELECT id, urs_code, urs_name, unit FROM urs_items WHERE urs_code = ?`,
      [ursCode]
    );

    if (!canonicalItem) {
      logger.warn(`[KB] Insert blocked: Unknown URS code "${ursCode}"`);
      throw new Error(`Unknown URS code: ${ursCode}`);
    }

    // Validate unit consistency
    if (canonicalItem.unit && unit && canonicalItem.unit !== unit) {
      logger.warn(`[KB] Unit mismatch for ${ursCode}: expected "${canonicalItem.unit}", got "${unit}"`);
      // Optionally allow override if validatedByUser
      if (!validatedByUser) {
        unit = canonicalItem.unit;
      }
    }

    // Validate text normalization
    if (normalizedTextCs.length > 255) {
      throw new Error('Normalized text too long');
    }

    // Validate context parameters
    const validProjectTypes = ['bytova', 'nondp', 'infrastruktura'];
    if (projectType && !validProjectTypes.includes(projectType)) {
      throw new Error(`Invalid project type: ${projectType}`);
    }

    const contextHash = computeContextHash(projectType, buildingSystem);

    // Insert validated mapping
    const result = await db.run(
      `INSERT INTO kb_mappings
       (normalized_text_cs, language_hint, context_hash, project_type, building_system,
        urs_code, urs_name, unit, confidence, usage_count, validated_by_user, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(normalized_text_cs, context_hash) DO UPDATE SET
       confidence = max(confidence, excluded.confidence),
       usage_count = usage_count + 1,
       validated_by_user = (validated_by_user OR excluded.validated_by_user),
       last_used_at = CURRENT_TIMESTAMP`,
      [normalizedTextCs, languageHint, contextHash, projectType, buildingSystem,
       ursCode, canonicalItem.urs_name, unit, confidence, validatedByUser]
    );

    logger.info(`[KB] Mapping inserted: "${normalizedTextCs}" → ${ursCode}`);
    return result;

  } catch (error) {
    logger.error(`[KB] Insert failed: ${error.message}`);
    throw error;
  }
}
```

---

### Issue #5: Limited Input Validation

**Location:** `jobs.js:838-880` - `/universal-match` endpoint

**Problem:**
```javascript
// ❌ CURRENT - Minimal validation
const { text, quantity, unit, projectType, buildingSystem, candidateItems } = req.body;

if (!text || typeof text !== 'string') {  // Only checks text
  return res.status(400).json({ error: 'Missing "text"' });
}
// quantity, unit, projectType not validated!
```

**Solution:**

```javascript
// ✅ FIXED - Comprehensive input validation
import Joi from 'joi';  // or simple manual validation

const universalMatchSchema = {
  text: (value) => {
    if (!value || typeof value !== 'string') return 'Text is required';
    if (value.length < 3) return 'Text must be at least 3 characters';
    if (value.length > 500) return 'Text must be less than 500 characters';
    return null;
  },
  quantity: (value) => {
    if (value === undefined || value === null) return null; // Optional
    const num = Number(value);
    if (isNaN(num) || num <= 0 || num > 10000) return 'Quantity must be 0-10000';
    return null;
  },
  unit: (value) => {
    const validUnits = ['m2', 'm3', 'ks', 'kg', 't', 'm', 'h', 'lm'];
    if (value === undefined || value === null) return null;
    if (!validUnits.includes(value)) return `Unit must be one of: ${validUnits.join(', ')}`;
    return null;
  },
  projectType: (value) => {
    const validTypes = ['bytova', 'nondp', 'infrastruktura'];
    if (value === undefined || value === null) return null;
    if (!validTypes.includes(value)) return `Project type must be one of: ${validTypes.join(', ')}`;
    return null;
  },
  buildingSystem: (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > 100) return 'Building system too long';
    return null;
  }
};

function validateInput(body) {
  const errors = {};

  for (const [field, validator] of Object.entries(universalMatchSchema)) {
    const error = validator(body[field]);
    if (error) errors[field] = error;
  }

  return errors;
}

router.post('/universal-match', async (req, res) => {
  const requestId = generateRequestId();

  try {
    // Validate input
    const errors = validateInput(req.body);
    if (Object.keys(errors).length > 0) {
      logger.warn(`[UNIVERSAL-MATCH] ${requestId} Validation failed:`, errors);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        request_id: requestId
      });
    }

    const { text, quantity = null, unit = 'ks', projectType = null, buildingSystem = null } = req.body;

    // ... rest of endpoint
  } catch (error) {
    // ... error handling
  }
});
```

---

## 🟡 Medium Priority Issues

### Issue #6: PII in Logs

**Location:** Multiple endpoints - raw user text in logs

**Problem:**
```javascript
// ❌ CURRENT - Logs contain user data
logger.info(`[UNIVERSAL-MATCH] Request: "${text.substring(0, 80)}..."`);
logger.info(`[JOBS] Parsed context: ${JSON.stringify(projectContext)}`);
```

**Solution:**

```javascript
// ✅ FIXED - Redact sensitive information
function redactText(text, maxLen = 20) {
  if (!text) return '[empty]';
  if (text.length <= maxLen) return `[${text.length} chars]`;
  return `[${text.length} chars: "${text.substring(0, maxLen)}..."]`;
}

logger.info(`[UNIVERSAL-MATCH] Request: ${redactText(text)}`);
logger.info(`[JOBS] Context keys: ${Object.keys(projectContext).join(', ')}`);
logger.debug(`[JOBS] Full context: ${JSON.stringify(projectContext)}`);  // DEBUG level only
```

---

## 🔵 Low Priority - Code Quality Issues

### Fix #1: Incorrect Cleanup Logic

**Location:** `knowledgeBase.js:294-314`

**Current (broken):**
```javascript
`DELETE FROM kb_mappings
 WHERE confidence < ? AND usage_count < ? AND validated_by_user = 0`
```

**Problem:** With `minUsageCount = 1` (default), condition `usage_count < 1` never matches anything with `usage_count >= 1`, so cleanup never happens.

**Fixed:**
```javascript
`DELETE FROM kb_mappings
 WHERE confidence < ? AND usage_count <= ? AND validated_by_user = 0`
```

---

### Fix #2: KB Cache Hit Efficiency

**Location:** `universalMatcher.js:84-95`

**Current:**
```javascript
if (kbHits && kbHits.length > 0 && kbHits[0].confidence >= 0.85) {
  // Only checks first result
  return formatResultFromKB(..., kbHits[0]);
}
```

**Improved:**
```javascript
const kbHit = kbHits?.find(hit => hit.confidence >= 0.85);
if (kbHit) {
  // Find first match above threshold, improves cache hit rate
  return formatResultFromKB(..., kbHit);
}
```

---

### Fix #3: Add Execution Time Consistency

**Location:** `universalMatcher.js:193-226`

**Current:** Missing `execution_time_ms` in KB path

**Fixed:**
```javascript
async function formatResultFromKB(input, detectedLanguage, normalizedCzech, kbHit, startTime) {
  // ... build response
  return {
    // ... other fields
    execution_time_ms: Date.now() - startTime  // Add this
  };
}
```

---

### Fix #4: Better Null Handling

**Location:** `jobs.js:930-943` - `/feedback` endpoint

**Current:**
```javascript
const result = await recordUserFeedback(
  {},  // matchResult (not used)
  { ... }
);
```

**Better:**
```javascript
const result = await recordUserFeedback(
  null,  // matchResult is not available in this context
  { ... }
);
```

---

## 📋 Implementation Checklist

- [ ] **Create** `backend/src/middleware/inputValidation.js` - centralized validation
- [ ] **Create** `backend/src/middleware/errorHandler.js` - safe error responses
- [ ] **Create** `backend/src/utils/requestId.js` - request tracking
- [ ] **Create** `backend/src/utils/logger.redaction.js` - text redaction
- [ ] **Update** `backend/src/api/routes/jobs.js` - apply all fixes
- [ ] **Update** `backend/src/services/knowledgeBase.js` - validate inputs & catalog
- [ ] **Update** `backend/src/services/universalMatcher.js` - validate LLM responses
- [ ] **Add** database indexes for performance
- [ ] **Write** security unit tests
- [ ] **Update** documentation with security guidelines

---

## 🧪 Testing

### Security Tests to Add

```javascript
// test/security.test.js
describe('Security', () => {
  test('should reject oversized text input', async () => {
    const response = await request(app)
      .post('/api/jobs/universal-match')
      .send({ text: 'a'.repeat(501) });
    expect(response.status).toBe(400);
  });

  test('should not expose error messages', async () => {
    const response = await request(app)
      .post('/api/jobs/universal-match')
      .send({});  // Missing required field
    expect(response.body.error).not.toContain('undefined');
  });

  test('should reject invalid URS codes in KB', async () => {
    const response = await knowledgeBase.insertMapping(
      'fake',
      'cs',
      'bytova',
      'brick',
      '99.99.99',  // Invalid code
      'Fake',
      'm2'
    );
    expect(response).toThrow('Unknown URS code');
  });

  test('should limit LLM response size', async () => {
    // Mock LLM to return huge response
    const response = await universalMatcher.callUniversalLLM(prompt);
    expect(response.length).toBeLessThan(50 * 1024);
  });
});
```

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Guide](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Next Steps:**
1. Review this document with team
2. Create separate issue for each fix
3. Implement fixes in order of severity
4. Add security tests
5. Deploy to staging for testing
6. Merge PR #35 with all fixes

