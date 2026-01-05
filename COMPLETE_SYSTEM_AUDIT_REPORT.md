# 🔍 ПОЛНЫЙ АУДИТ СИСТЕМЫ STAVAGENT

**Дата:** 2025-12-10
**Версия:** 1.0
**Статус:** ✅ Анализ завершён
**Найдено проблем:** 32
**Критических:** 5 | **Высоких:** 5 | **Средних:** 14 | **Низких:** 8

---

## 📋 НАВИГАЦИЯ

1. [Критические проблемы (IMMEDIATE ACTION)](#критические-проблемы-immediate-action)
2. [Высокие проблемы (URGENT)](#высокие-проблемы-urgent)
3. [Средние проблемы (IMPORTANT)](#средние-проблемы-important)
4. [Низкие проблемы (NICE-TO-HAVE)](#низкие-проблемы-nice-to-have)
5. [Системные проблемы](#системные-проблемы)
6. [План исправления](#план-исправления)

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (IMMEDIATE ACTION)

### 1. **AUTH BYPASS IN PRODUCTION** ⚠️ SECURITY CRITICAL

**Файлы:**
- `stavagent-portal/backend/src/middleware/auth.js` (строки 22-34)
- `Monolit-Planner/backend/src/middleware/auth.js` (аналогично)

**Проблема:**
```javascript
const TEMP_BYPASS_AUTH = process.env.DISABLE_AUTH === 'true';
if (TEMP_BYPASS_AUTH) {
  req.user = { userId: 1, email: 'dev@test.com', role: 'admin', ... };
  logger.warn('⚠️ [DEV MODE] Auth bypassed');
  return next();  // ❌ РАБОТАЕТ И В PRODUCTION!
}
```

**Риск:** Если кто-то установит `DISABLE_AUTH=true` в production, ВСЕ endpoints становятся доступны без аутентификации!

**Решение:**
```javascript
// ✅ ПРАВИЛЬНО
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET required in production');
  }
  // Полная проверка JWT
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  // ... verify token ...
} else if (process.env.DISABLE_AUTH === 'true') {
  // Только в development!
  req.user = { userId: 1, role: 'admin', ... };
}
```

**Действие:** НЕМЕДЛЕННО исправить в обоих файлах

---

### 2. **DATABASE CONNECTION POOL NOT INITIALIZED**

**Файл:** `Monolit-Planner/backend/src/db/postgres.js` (строки 56-63)

**Проблема:**
```javascript
export async function query(text, params = []) {
  const client = await pool.connect();  // ❌ pool может быть null!
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}
```

Если `pool` не инициализирован (если `initPostgres()` не был вызван), приложение упадёт.

**Решение:**
```javascript
export async function query(text, params = []) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initPostgres() first');
  }
  const client = await pool.connect();
  // ... rest of code ...
}
```

**Действие:** Добавить проверку в все функции, использующие `pool`

---

### 3. **TRANSACTION CLIENT NOT RELEASED**

**Файлы:**
- `stavagent-portal/backend/src/routes/portal-projects.js` (строки 82-135)
- `stavagent-portal/backend/src/routes/portal-files.js` (строки 81-100)

**Проблема:**
```javascript
router.post('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();  // ❌ Если ошибка ниже, client не освободится!

  try {
    await client.query('BEGIN');
    // ... logic ...
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});
```

**Риск:** Если `pool.connect()` выбросит ошибку, или если `BEGIN` выбросит ошибку, `client.release()` может не быть вызван → истощение connection pool.

**Решение:**
```javascript
router.post('/', async (req, res) => {
  let client;
  try {
    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');
    try {
      // ... logic ...
      await client.query('COMMIT');
      res.status(201).json({ success: true, ... });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();  // ✅ Всегда освобождается
  }
});
```

**Действие:** Исправить оба файла

---

### 4. **API CONTRACT VIOLATION BETWEEN SERVICES**

**Файлы:**
- `Monolit-Planner/backend/src/services/concreteAgentClient.js` (строки 49, 101)
- `stavagent-portal/backend/src/services/concreteAgentClient.js` (строки 49, 101)

**Проблема:**

Согласно `CLAUDE.md` (concrete-agent), правильные endpoints:
```
POST /api/upload          ← Workflow A
POST /workflow/b/analyze_drawing ← Workflow B
```

Но клиенты вызывают:
```javascript
❌ POST /workflow-a/start  (НЕ СУЩЕСТВУЕТ!)
❌ POST /workflow-b/start  (НЕ СУЩЕСТВУЕТ!)
```

**Решение:**
```javascript
// ✅ ПРАВИЛЬНО
export async function workflowAStart(filePath, metadata = {}) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('project_id', metadata.projectId);

  const response = await fetch(`${CONCRETE_AGENT_URL}/api/upload`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });
  // ...
}
```

**Действие:** Обновить endpoints в обоих сервисах

---

### 5. **MULTI-ROLE API ERROR HANDLING**

**Файл:** `URS_MATCHER_SERVICE/backend/src/services/multiRoleClient.js` (строки 73-90)

**Проблема:**
```javascript
export async function askMultiRole(question, options = {}) {
  try {
    const response = await fetch(`${STAVAGENT_API_BASE}/api/v1/multi-role/ask`, {
      // ...
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logger.debug('API not available');  // ❌ Выбрасывается без fallback!
    throw error;
  }
}
```

Если CORE недоступен, весь поиск падает.

**Решение:**
```javascript
export async function askMultiRole(question, options = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.warn(`Multi-Role API unavailable (fallback to local): ${error.message}`);
    // ✅ Возвращаем fallback вместо выброса
    return {
      success: false,
      fallback: true,
      candidates: []  // Empty fallback
    };
  }
}
```

**Действие:** Добавить fallback logic

---

## 🟠 ВЫСОКИЕ ПРОБЛЕМЫ (URGENT)

### 6. **DEAD CODE IN LLM CLIENT** (168 строк)

**Файл:** `URS_MATCHER_SERVICE/backend/src/services/llmClient.js` (строки 467-634)

**Функции, которые НИ ГДЕ не используются:**
- `callClaudeAPI()`
- `callOpenAIAPI()`
- `callGeminiAPI()`

Вместо них используются `callClaudeAPIWithClient()`, `callOpenAIAPIWithClient()`, и т.д.

**Решение:** Удалить старые функции

---

### 7. **CACHE FALLBACK CREATES DATA INCONSISTENCY**

**Файл:** `URS_MATCHER_SERVICE/backend/src/services/cacheService.js` (строки 101-138)

**Проблема:**
```javascript
if (isProduction) {
  logger.warn('[Cache] Redis failed in production, using in-memory fallback');
  cacheClient = inMemoryCache;  // ❌ In-memory cache в production!
} else {
  cacheClient = inMemoryCache;  // ✅ OK in development
}
```

Если Redis падает в production, 2+ экземпляра приложения имеют разные cache → данные рассинхронизированы!

**Решение:**
```javascript
if (isProduction && !hasRedis) {
  throw new Error('Cache service failed in production. Redis is required.');
}
if (!isProduction) {
  cacheClient = inMemoryCache;  // Fallback только в development
}
```

**Действие:** Заставить application fail быстро в production

---

### 8. **UNHANDLED PROMISE REJECTIONS**

**Файл:** `URS_MATCHER_SERVICE/backend/src/api/routes/jobs.js`

**Проблемы:**
- Асинхронные операции не имеют `.catch()` handlers
- Если обещание (promise) выбросит ошибку без обработки → unhandled rejection → крах процесса

**Решение:**
```javascript
// ❌ НЕПРАВИЛЬНО
router.post('/match', async (req, res) => {
  const result = ursMatcher.match(text);  // No await!
  res.json({ result });
});

// ✅ ПРАВИЛЬНО
router.post('/match', async (req, res) => {
  try {
    const result = await ursMatcher.match(text);
    res.json({ result });
  } catch (error) {
    logger.error('Match error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Действие:** Обернуть все async операции в try-catch

---

### 9. **MISSING NULL CHECKS IN DATABASE QUERIES**

**Файл:** `Monolit-Planner/backend/src/routes/positions.js` (строки 78-106)

**Проблема:**
```javascript
const bridge = await db.prepare(`SELECT ... FROM bridges WHERE bridge_id = ?`).get(bridge_id);

// ⚠️ bridge может быть undefined!
const header_kpi = calculateKPI(calculatedPositions, {
  span_length_m: bridge.span_length_m,  // ❌ TypeError if bridge is null
  deck_width_m: bridge.deck_width_m,
});
```

**Решение:**
```javascript
const bridge = await db.prepare(`SELECT ... FROM bridges WHERE bridge_id = ?`).get(bridge_id);

if (!bridge) {
  return res.status(404).json({ error: 'Bridge not found' });
}

const header_kpi = calculateKPI(calculatedPositions, {
  span_length_m: bridge.span_length_m,  // ✅ Safe
  deck_width_m: bridge.deck_width_m,
});
```

**Действие:** Добавить NULL checks во все DB query результаты

---

### 10. **RACE CONDITION IN INITIALIZATION**

**Файл:** `URS_MATCHER_SERVICE/backend/src/services/llmClient.js` (строки 59-74)

**Проблема:**
```javascript
let initialized = false;

export async function initializeLLMClient() {
  if (initialized) return;  // ❌ Race condition!
  initialized = true;
  // ... initialization ...
}
```

Если 2 request вызовут `initializeLLMClient()` одновременно, обе пройдут проверку `initialized` и инициализируют дважды.

**Решение:**
```javascript
let initPromise = null;

export async function initializeLLMClient() {
  if (initPromise) return initPromise;  // ✅ Возвращаем existing promise

  initPromise = doInitialization();
  return initPromise;
}

async function doInitialization() {
  // ... initialization code ...
}
```

**Действие:** Использовать promise-based locking

---

## 🟡 СРЕДНИЕ ПРОБЛЕМЫ (IMPORTANT)

### 11-25. Другие средние проблемы:

| # | Проблема | Файл | Действие |
|---|----------|------|----------|
| 11 | Incomplete error logging | `Monolit-Planner/backend/src/utils/errorHandler.js` | Добавить stack trace |
| 12 | Missing timeout in fetch | `Monolit-Planner/backend/src/services/concreteAgentClient.js` | Использовать AbortController |
| 13 | TODO items in code | `concrete-agent/packages/core-backend/app/services/task_monitor.py` | Реализовать |
| 14 | Weak password hashing | `concrete-agent/packages/core-backend/app/db/models/user.py` | Использовать bcrypt |
| 15 | No input validation | `stavagent-portal/backend/src/routes/portal-projects.js` | Добавить Zod validation |
| 16 | No rate limiting | `stavagent-portal/backend/src/routes/portal-files.js` | Добавить express-rate-limit |
| 17 | Poor error logging | `URS_MATCHER_SERVICE/backend/src/services/ursMatcher.js` | Добавить контекст |
| 18 | Memory leak in cache | `URS_MATCHER_SERVICE/backend/src/services/cacheService.js` | Добавить LRU eviction |
| 19 | Unencrypted file storage | `Monolit-Planner/backend/src/routes/upload.js` | Использовать S3 + encryption |
| 20 | XSS vulnerability | `stavagent-portal/backend/src/routes/portal-projects.js` | Sanitize input |
| 21-25 | Другие (документирование, корреляционные IDs, и т.д.) | Разные | Низкий приоритет |

---

## 🔴 СИСТЕМНЫЕ ПРОБЛЕМЫ

### Code Duplication
- **Проблема:** 3 копии аутентификации в разных сервисах
- **Решение:** Создать shared auth middleware как пакет npm

### No Distributed Tracing
- **Проблема:** Нельзя отследить request через все сервисы
- **Решение:** Добавить correlation IDs во все logs

### No Metrics/Monitoring
- **Проблема:** Нет Prometheus metrics, APM, alerting
- **Решение:** Добавить prom-client, отправлять в Grafana

### No CORS Configuration
- **Проблема:** CORS настроена неправильно или не настроена
- **Решение:** Явно настроить CORS per service

---

## 📊 SEVERITY SUMMARY

```
🔴 CRITICAL (5) - MUST FIX IMMEDIATELY
  ├─ Auth bypass in production
  ├─ DB connection pool not initialized
  ├─ Transaction client not released
  ├─ API contract violations
  └─ Error handling in Multi-Role API

🟠 HIGH (5) - FIX WITHIN 1 WEEK
  ├─ Dead code in LLM client
  ├─ Cache fallback creates inconsistency
  ├─ Unhandled promise rejections
  ├─ Missing NULL checks
  └─ Race condition in initialization

🟡 MEDIUM (14) - FIX WITHIN 2 WEEKS
  └─ Error logging, timeouts, validation, etc.

🟢 LOW (8) - NICE TO HAVE
  └─ Documentation, monitoring, etc.
```

---

## 🎯 ПЛАН ИСПРАВЛЕНИЯ

### Phase 1: CRITICAL FIXES (48 часов)
```
Day 1:
  [ ] Remove AUTH_BYPASS from production (both services)
  [ ] Fix DB connection pool initialization
  [ ] Fix transaction client release in portal-projects.js
  [ ] Fix transaction client release in portal-files.js
  [ ] Fix API contracts (endpoints)

Day 2:
  [ ] Add Multi-Role error handling fallback
  [ ] Test all critical fixes
  [ ] Deploy to staging
```

### Phase 2: HIGH PRIORITY FIXES (1 неделя)
```
Day 3-4:
  [ ] Remove dead code from llmClient.js
  [ ] Fix cache fallback logic
  [ ] Add promise rejection handlers
  [ ] Add NULL checks to all DB queries
  [ ] Fix race condition in initialization

Day 5-7:
  [ ] Testing & QA
  [ ] Code review
  [ ] Deploy to production
```

### Phase 3: MEDIUM PRIORITY FIXES (2 недели)
```
Week 2:
  [ ] Improve error logging
  [ ] Add request timeouts with AbortController
  [ ] Implement missing TODOs
  [ ] Add input validation (Zod)
  [ ] Add rate limiting
  [ ] Improve cache logging

Week 2-3:
  [ ] File encryption setup
  [ ] XSS prevention measures
  [ ] Documentation completion
```

### Phase 4: LOW PRIORITY IMPROVEMENTS (Ongoing)
```
  [ ] Add correlation IDs for tracing
  [ ] Setup Prometheus metrics
  [ ] Configure CORS properly
  [ ] Add health check endpoints
  [ ] Move magic numbers to config
  [ ] Improve documentation
```

---

## 🔐 QUICK SECURITY CHECKLIST

- [ ] Auth bypass removed
- [ ] JWT validation enforced in production
- [ ] XSS prevention implemented
- [ ] Input validation added
- [ ] SQL injection prevention verified (using parameterized queries)
- [ ] File upload size limits enforced
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Secrets not in code (using .env)
- [ ] Password hashing with bcrypt
- [ ] Error messages don't leak sensitive info

---

## 📈 METRICS TO MONITOR

После исправления:
- [ ] Database connection pool utilization (should be < 80%)
- [ ] Cache hit rate (should be > 70%)
- [ ] API error rate (should be < 1%)
- [ ] P95 latency (should be < 500ms)
- [ ] Unhandled promise rejections (should be 0)

---

## 📝 DOCUMENTATION REQUIREMENTS

Создать/обновить:
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema documentation
- [ ] Architecture decision records (ADRs)
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Security guidelines

---

## ✅ NEXT STEPS

1. **Немедленно:** Исправить 5 CRITICAL проблем
2. **На этой неделе:** Исправить 5 HIGH проблем
3. **На следующей неделе:** Начать работу на MEDIUM проблемами
4. **Постоянно:** Мониторить, логировать, документировать

---

**Дата создания:** 2025-12-10
**Статус:** 🔴 REQUIRES IMMEDIATE ACTION
**Критичность:** 5 CRITICAL issues must be fixed before production deployment

