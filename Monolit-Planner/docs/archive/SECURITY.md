# 🔒 Security Audit & Recommendations

**Date**: November 11, 2025
**Status**: 🔴 CRITICAL ISSUES FOUND
**Session**: claude/fix-production-issues-011CV2CMcxEKgqJ78EPvHAJG

---

## Executive Summary

| Category | Status | Issues | Priority |
|----------|--------|--------|----------|
| **Authentication** | 🔴 MISSING | 0 middleware | CRITICAL |
| **Rate Limiting** | 🔴 MISSING | No protection | CRITICAL |
| **Input Validation** | 🟡 PARTIAL | Missing max values | HIGH |
| **File Upload** | 🟡 PARTIAL | No MIME check, no cleanup | HIGH |
| **SQL Injection** | ✅ SAFE | Prepared statements used | - |
| **XSS Attacks** | ✅ SAFE | React escaping enabled | - |
| **CORS** | ⚠️ UNKNOWN | Need to verify server.js | MEDIUM |
| **Credentials** | ✅ SAFE | Using env vars | - |

---

## 🔴 CRITICAL ISSUES

### 1. NO AUTHENTICATION (Authentication: Missing)

**Risk Level**: CRITICAL
**Impact**: Anyone can access ALL endpoints without authentication

**Affected Endpoints**:
- POST /api/bridges (create)
- PUT /api/bridges/:id (edit)
- DELETE /api/bridges/:id (delete)
- POST/PUT /api/positions (edit positions)
- DELETE /api/positions/:id (delete positions)
- POST /api/snapshots/create (lock data)
- POST /api/snapshots/restore (restore data)
- POST /api/upload (upload Excel files)

**Current State**: No authentication middleware

**Solution**: Implement JWT-based authentication

```javascript
// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
```

**Estimated Effort**: 4-6 hours

---

### 2. NO RATE LIMITING (DDoS/Brute Force Protection)

**Risk Level**: CRITICAL
**Impact**: Attacker can spam requests, cause DoS

**Current State**: No rate limiting on any endpoint

**Solution**: Add express-rate-limit

```javascript
// backend/src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Příliš mnoho požadavků, zkuste to znovu později'
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Maximálně 10 nahrání za hodinu'
});
```

**Estimated Effort**: 2-3 hours

---

### 3. UNSAFE FILE UPLOAD

**Risk Level**: CRITICAL
**Impact**: Malicious files can be uploaded and executed

**Issues**:

#### 3a. Only Extension-Based Validation
**File**: `backend/src/routes/upload.js:27-42`

```javascript
// Current (UNSAFE):
const ext = path.extname(file.originalname).toLowerCase();
if (!allowedExt.includes(ext)) { ... }
```

**Problem**: Can be bypassed by renaming executable.exe to file.xlsx

**Solution**: Add MIME type validation

```javascript
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Pouze .xlsx a .xls soubory jsou povoleny'));
  }
  cb(null, true);
};
```

#### 3b. Uploaded Files Not Deleted
**File**: `backend/src/routes/upload.js:337-512`

**Problem**: Files accumulate on disk indefinitely

**Solution**: Add cleanup in finally block

```javascript
let filePath;
try {
  filePath = req.file.path;
  const parseResult = await parseXLSX(filePath);
  // ... process
} finally {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
```

#### 3c. No Virus Scanning
**Problem**: Infected files cannot be detected

**Solution**: Integrate ClamAV

```javascript
const scanner = clamd.createScanner(3310, '127.0.0.1');

fileFilter: async (req, file, cb) => {
  try {
    const result = await scanner.scanFile(file.path);
    if (result.infected) return cb(new Error('Infected file'));
    cb(null, true);
  } catch (err) { cb(err); }
}
```

**Estimated Effort**: 3-4 hours

---

## 🟡 HIGH PRIORITY ISSUES

### 4. Incomplete Input Validation

**Risk Level**: HIGH
**File**: `backend/src/routes/positions.js:146-169, 244-263`

**Problem**: Missing max values for numeric fields

```javascript
// Current validation:
if (typeof qty !== 'number' || qty < 0) { ... }
// Missing: qty > 1000000?

if (item_name && item_name.length > 500) { ... }
// Missing: Any validation for item_name currently
```

**Solution**: Add comprehensive validation

```javascript
const validatePosition = (pos) => {
  const errors = [];

  if (typeof pos.qty !== 'number' || pos.qty < 0 || pos.qty > 1000000) {
    errors.push('qty must be 0-1000000');
  }

  if (pos.item_name && pos.item_name.length > 500) {
    errors.push('item_name too long (max 500)');
  }

  if (pos.part_name && pos.part_name.length > 500) {
    errors.push('part_name too long (max 500)');
  }

  if (pos.otskp_code && !/^\d{5,6}$/.test(pos.otskp_code)) {
    errors.push('otskp_code must be 5-6 digits');
  }

  return errors;
};
```

**Estimated Effort**: 1-2 hours

---

### 5. Export Directory Growth (Memory/Disk Leak)

**Risk Level**: HIGH
**File**: `backend/src/services/exporter.js`

**Problem**: Exported files accumulate indefinitely

**Solution**: Add cleanup function

```javascript
function cleanOldExports() {
  const files = fs.readdirSync(EXPORTS_DIR);
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  files.forEach(file => {
    const filepath = path.join(EXPORTS_DIR, file);
    const stats = fs.statSync(filepath);
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filepath);
      logger.info(`Cleaned old export: ${file}`);
    }
  });
}

// Call on startup
cleanOldExports();

// Schedule daily cleanup
setInterval(cleanOldExports, 24 * 60 * 60 * 1000);
```

**Estimated Effort**: 1 hour

---

## ⚠️ MEDIUM PRIORITY

### 6. Race Condition: useEffect Dependencies

**Risk Level**: MEDIUM
**File**: `frontend/src/hooks/usePositions.ts:42-48`

```javascript
useEffect(() => {
  if (query.data) {
    setPositions(query.data.positions);
  }
}, [query.data, setPositions]); // ← setPositions in deps causes loop
```

**Solution**: Remove function refs from dependencies

```javascript
}, [query.data]); // React guarantees setPositions is stable
```

**Estimated Effort**: 30 minutes

---

## ✅ VERIFIED SAFE

- ✅ **SQL Injection**: Protected by prepared statements
- ✅ **XSS Attacks**: React auto-escaping enabled
- ✅ **Credentials**: Using environment variables
- ✅ **Directory Traversal**: Protected by path normalization

---

## 📋 Implementation Roadmap

### Phase 1: Critical (Week 1)
- [ ] Implement JWT authentication middleware
- [ ] Add rate limiting to all endpoints
- [ ] Fix file upload validation (MIME type)
- [ ] Add file cleanup after processing

### Phase 2: High Priority (Week 2)
- [ ] Add comprehensive input validation
- [ ] Implement export directory cleanup
- [ ] Fix race condition in usePositions

### Phase 3: Nice to Have (Week 3)
- [ ] Add virus scanning with ClamAV
- [ ] Implement detailed audit logging
- [ ] Add security headers (helmet.js)

---

## Testing Checklist

- [ ] Test without authentication header (should fail)
- [ ] Test spam requests (should be rate limited)
- [ ] Test non-Excel file upload (should fail)
- [ ] Test max field lengths (should validate)
- [ ] Test SQL injection patterns (should fail safely)

---

## Reference

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security](https://nodejs.org/en/docs/guides/nodejs-security/)
