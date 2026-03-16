# STAVAGENT Security Hardening Plan

**Date:** 2026-03-16
**Scope:** All 5 services + infrastructure
**Based on:** Full codebase security audit

---

## Executive Summary

Аудит выявил **6 критических**, **7 высоких** и **8 средних** уязвимостей.
Наиболее опасные: отключённая аутентификация в продакшене, публичные Cloud Run сервисы без IAM, захардкоженный JWT secret fallback, и полностью открытые integration/kiosk API.

---

## PHASE 0 — EMERGENCY (день 1, немедленно)

### 0.1 Включить аутентификацию в продакшене
**Severity:** CRITICAL | **Service:** stavagent-portal

**Проблема:** `VITE_DISABLE_AUTH=true` в `frontend/.env.production` + `DISABLE_AUTH=true` в backend env.
Вся аутентификация отключена — любой может получить доступ ко всем API.

**Файлы:**
- `stavagent-portal/frontend/.env.production:11`
- `stavagent-portal/backend/src/middleware/auth.js:17-36`

**Действия:**
```bash
# 1. Frontend: изменить .env.production
VITE_DISABLE_AUTH=false

# 2. Backend: убрать DISABLE_AUTH из Cloud Run env
gcloud run services update stavagent-portal-backend \
  --region=europe-west3 \
  --remove-env-vars=DISABLE_AUTH

# 3. Убедиться что JWT_SECRET установлен в Secret Manager
gcloud secrets versions access latest --secret=JWT_SECRET
```

### 0.2 Убрать захардкоженный JWT secret fallback
**Severity:** CRITICAL | **Service:** stavagent-portal

**Проблема:** `auth.js:10` — `const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'`
Если env var не установлен, используется публичный секрет → любой может подделать токены.

**Действия:**
```javascript
// auth.js — убрать fallback, падать при отсутствии
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
```

### 0.3 Защитить опасные публичные эндпоинты
**Severity:** CRITICAL | **Service:** stavagent-portal

**Проблема:** Эндпоинты без аутентификации позволяют:
- `POST /api/auth/create-admin-if-first` — захват первого админа
- `POST /api/auth/force-verify-email` — обход верификации email
- `POST /api/portal-projects/create-from-kiosk` — создание проектов извне
- `POST /api/integration/*` — модификация cross-kiosk данных

**Действия:**
```javascript
// 1. create-admin-if-first — добавить одноразовый setup token
router.post('/create-admin-if-first', (req, res) => {
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken || req.headers['x-setup-token'] !== setupToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... existing logic
});

// 2. force-verify-email — убрать или защитить adminOnly
router.post('/force-verify-email', authenticateToken, adminOnly, ...);

// 3. Integration API — добавить API key
const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY;
function requireIntegrationKey(req, res, next) {
  const key = req.headers['x-integration-key'];
  if (!INTEGRATION_API_KEY || key !== INTEGRATION_API_KEY) {
    return res.status(401).json({ error: 'Invalid integration key' });
  }
  next();
}
// Применить ко всем /api/integration/* маршрутам
```

### 0.4 Отключить debug эндпоинт в продакшене
**Severity:** HIGH | **Service:** stavagent-portal

**Проблема:** `/api/debug` доступен в продакшене, раскрывает конфигурацию.

**Файл:** `stavagent-portal/backend/server.js:220`

**Действия:**
```javascript
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
}
```

---

## PHASE 1 — CRITICAL (неделя 1)

### 1.1 Inter-service authentication (API Keys для кiosков)
**Severity:** CRITICAL | **Services:** Monolit, URS, Registry, Portal

**Проблема:** Все кioски (Monolit, URS, Registry) не имеют аутентификации.
Любой может вызвать их API напрямую, минуя Portal.

**Архитектура решения:**
```
Portal ──[X-Service-Key: xxx]──→ Monolit
Portal ──[X-Service-Key: xxx]──→ URS Matcher
Portal ──[X-Service-Key: xxx]──→ Registry Backend
Monolit ──[X-Service-Key: xxx]──→ concrete-agent
```

**Реализация — общий middleware `serviceAuth.js`:**
```javascript
// shared across all kiosks
function requireServiceKey(req, res, next) {
  // Health check — always allowed (Cloud Run probes)
  if (req.path === '/health' || req.path === '/healthcheck') {
    return next();
  }

  const key = req.headers['x-service-key'];
  const validKeys = (process.env.SERVICE_KEYS || '').split(',').filter(Boolean);

  if (validKeys.length === 0) {
    // No keys configured = development mode, allow all
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(500).json({ error: 'Service keys not configured' });
  }

  if (!key || !validKeys.includes(key)) {
    return res.status(401).json({ error: 'Invalid service key' });
  }
  next();
}
```

**Деплой:**
```bash
# Сгенерировать ключ
SERVICE_KEY=$(openssl rand -hex 32)

# Добавить в Secret Manager
gcloud secrets create SERVICE_KEYS --data-file=-

# Добавить в каждый Cloud Run сервис
gcloud run services update monolit-planner-api --update-secrets=SERVICE_KEYS=SERVICE_KEYS:latest
gcloud run services update urs-matcher-service --update-secrets=SERVICE_KEYS=SERVICE_KEYS:latest
# ... и т.д.
```

### 1.2 Rate limiting для URS Matcher
**Severity:** HIGH | **Service:** URS_MATCHER_SERVICE

**Проблема:** Нет rate limiting вообще. Нет helmet.

**Действия:**
```bash
cd URS_MATCHER_SERVICE/backend
npm install helmet express-rate-limit
```

```javascript
// app.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 LLM calls per minute per IP
});
app.use('/api/jobs', llmLimiter);
```

### 1.3 Rate limiting для Registry AI endpoints
**Severity:** HIGH | **Service:** rozpocet-registry

**Проблема:** Публичные Vercel functions вызывают LLM без ограничений.
3000 req/hour × ~$0.02/req = **$60/hour потенциальный ущерб.**

**Действия — Vercel Edge Middleware:**
```typescript
// rozpocet-registry/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 20;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return NextResponse.next();
  }

  if (entry.count >= maxRequests) {
    return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  entry.count++;
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
```

### 1.4 Ужесточить CORS (concrete-agent)
**Severity:** HIGH | **Service:** concrete-agent

**Проблема:** `allow_methods=["*"]`, `allow_headers=["*"]`, localhost в продакшене.

**Файл:** `concrete-agent/packages/core-backend/app/main.py:35-47`

**Действия:**
```python
import os

CORS_ORIGINS = [
    "https://www.stavagent.cz",
    "https://monolit-planner-frontend.vercel.app",
    "https://stavagent-backend-ktwx.vercel.app",
]

if os.getenv("ENVIRONMENT") != "production":
    CORS_ORIGINS += [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Vercel previews only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Api-Key", "X-Service-Key"],
)
```

### 1.5 Rate limiting на integration эндпоинты Portal
**Severity:** HIGH | **Service:** stavagent-portal

**Проблема:** `rateLimiter.js:20-23` — integration endpoints исключены из rate limiting.

**Действия:**
```javascript
// rateLimiter.js — убрать skip для integration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: (req) => req.path === '/health', // ТОЛЬКО health, не integration
});

// Отдельный лимитер для integration
const integrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 req/min (достаточно для sync)
});
app.use('/api/integration', integrationLimiter);
```

---

## PHASE 2 — HIGH (неделя 2)

### 2.1 Обновить зависимости с уязвимостями
**Service:** concrete-agent

```bash
# cryptography 41.0.7 → 43.x (known CVEs)
pip install --upgrade cryptography

# Полный аудит
pip install pip-audit
pip-audit --fix
```

### 2.2 Усилить парольную политику
**Service:** stavagent-portal

**Файл:** `backend/src/routes/auth.js:31`

```javascript
// Минимум 8 символов, 1 заглавная, 1 цифра
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function validatePassword(password) {
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters with 1 uppercase and 1 digit';
  }
  return null;
}
```

### 2.3 Перевести JWT tokens из localStorage в httpOnly cookies
**Service:** stavagent-portal

**Проблема:** `frontend/src/services/api.ts:68` — XSS может украсть токены из localStorage.

**Действия (backend):**
```javascript
// auth.js — login endpoint
res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24h
});
res.json({ user }); // НЕ отправляем token в теле

// auth middleware — читать из cookie
const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
```

**Действия (frontend):**
```typescript
// api.ts — убрать localStorage, использовать credentials: 'include'
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // отправляет cookies
});
// Убрать interceptor с localStorage token
```

### 2.4 Улучшить .gitignore
**Проблема:** Минимальный .gitignore, нет защиты от случайного коммита секретов.

```gitignore
# Secrets
.env
.env.local
.env.*.local
*.pem
*.key
*.p12
credentials.json

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/

# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Build
dist/
build/
*.egg-info/

# Logs
*.log
npm-debug.log*
```

### 2.5 Удалить legacy render.yaml
**Проблема:** Содержит `DISABLE_AUTH: true` и `CORS_ORIGIN: "*"`. Deprecated, но в репо.

```bash
git rm render.yaml
git commit -m "SECURITY: Remove deprecated render.yaml with insecure defaults"
```

### 2.6 Implement bcrypt password hashing в concrete-agent
**Service:** concrete-agent

**Файл:** `packages/core-backend/app/db/models/user.py:130-154` — TODO: bcrypt not implemented.

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

---

## PHASE 3 — MEDIUM (неделя 3-4)

### 3.1 Cloud Run IAM authentication
Вместо `--allow-unauthenticated`, настроить IAM для inter-service вызовов.

```yaml
# cloudbuild-*.yaml — убрать --allow-unauthenticated для внутренних сервисов
# Оставить только для portal-backend (единая точка входа)

# Для inter-service: использовать Cloud Run invoker role
gcloud run services add-iam-policy-binding monolit-planner-api \
  --member="serviceAccount:stavagent-portal@project-id.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=europe-west3
```

**Архитектура:**
```
Internet → Portal (--allow-unauthenticated, JWT auth)
Portal → Monolit (IAM invoker, NO public access)
Portal → URS (IAM invoker, NO public access)
Portal → Registry Backend (IAM invoker, NO public access)
Portal → concrete-agent (IAM invoker, NO public access)
```

### 3.2 Content Security Policy (CSP)
**Services:** All frontends

```javascript
// Portal backend — helmet CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // для inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://concrete-agent-1086027517695.europe-west3.run.app",
        "https://monolit-planner-api-1086027517695.europe-west3.run.app",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
```

### 3.3 Audit logging
Добавить логирование security-событий во все сервисы.

```javascript
// shared/securityLogger.js
function logSecurityEvent(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    type: event.type, // AUTH_FAIL, RATE_LIMIT, INVALID_INPUT, FORBIDDEN
    ip: event.ip,
    path: event.path,
    userId: event.userId || null,
    details: event.details,
  };
  // Structured logging for Cloud Logging
  console.log(JSON.stringify({ severity: 'WARNING', ...entry }));
}
```

### 3.4 CSRF protection
**Service:** stavagent-portal

```bash
npm install csurf cookie-parser
```

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: { httpOnly: true, secure: true, sameSite: 'strict' } }));

// Frontend: читать CSRF token из cookie и добавлять в заголовок
```

### 3.5 Prompt injection protection (Registry AI)
**Service:** rozpocet-registry

```typescript
// ai-agent.ts — sanitize user input before sending to LLM
function sanitizeForLLM(text: string): string {
  // Remove control characters
  const cleaned = text.replace(/[\x00-\x1F\x7F]/g, '');
  // Truncate to max length
  return cleaned.slice(0, 500);
}

// Wrap items before building prompt
const sanitizedItems = items.map(item => ({
  ...item,
  popis: sanitizeForLLM(item.popis),
  kod: sanitizeForLLM(item.kod),
}));
```

### 3.6 File upload virus scanning
**Service:** concrete-agent

```python
# Integration with ClamAV (Docker sidecar or Cloud Run job)
import clamd

async def scan_file(file_path: str) -> bool:
    cd = clamd.ClamdUnixSocket()
    result = cd.scan(file_path)
    if result and file_path in result:
        status, virus_name = result[file_path]
        if status == 'FOUND':
            logger.warning(f"Virus detected: {virus_name} in {file_path}")
            os.unlink(file_path)
            return False
    return True
```

---

## PHASE 4 — LONG TERM (месяц 2+)

### 4.1 Secrets rotation
- Автоматическая ротация JWT_SECRET (каждые 90 дней)
- Ротация SERVICE_KEYS (каждые 30 дней)
- Ротация LLM API keys при подозрении на утечку

### 4.2 Dependency scanning (CI)
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]
jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high

  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install pip-audit && pip-audit -r concrete-agent/packages/core-backend/requirements.txt
```

### 4.3 WAF (Web Application Firewall)
Рассмотреть Cloud Armor перед Portal:
- SQL injection patterns
- XSS patterns
- Geo-blocking (только CZ/SK/EU)
- DDoS protection

### 4.4 Penetration testing
- Заказать внешний пентест после Phase 1-2
- Focus: Portal auth, integration API, file upload, LLM prompt injection

---

## Summary — Risk Matrix

| # | Issue | Severity | Phase | Effort |
|---|-------|----------|-------|--------|
| 0.1 | Auth disabled in production | CRITICAL | 0 | 1h |
| 0.2 | Hardcoded JWT secret fallback | CRITICAL | 0 | 30m |
| 0.3 | Dangerous unauthenticated endpoints | CRITICAL | 0 | 2h |
| 0.4 | Debug endpoint in production | HIGH | 0 | 15m |
| 1.1 | No inter-service authentication | CRITICAL | 1 | 4h |
| 1.2 | URS: no helmet/rate-limit | HIGH | 1 | 1h |
| 1.3 | Registry: no LLM rate-limit | HIGH | 1 | 2h |
| 1.4 | CORS too permissive (core) | HIGH | 1 | 1h |
| 1.5 | Integration endpoints no rate-limit | HIGH | 1 | 30m |
| 2.1 | Outdated cryptography package | HIGH | 2 | 30m |
| 2.2 | Weak password policy | MEDIUM | 2 | 1h |
| 2.3 | JWT in localStorage (XSS risk) | MEDIUM | 2 | 3h |
| 2.4 | Weak .gitignore | MEDIUM | 2 | 15m |
| 2.5 | Legacy render.yaml with secrets | MEDIUM | 2 | 5m |
| 2.6 | bcrypt not implemented (core) | MEDIUM | 2 | 1h |
| 3.1 | Cloud Run IAM (remove public) | MEDIUM | 3 | 4h |
| 3.2 | CSP headers | MEDIUM | 3 | 2h |
| 3.3 | Audit logging | MEDIUM | 3 | 3h |
| 3.4 | CSRF protection | MEDIUM | 3 | 2h |
| 3.5 | Prompt injection protection | MEDIUM | 3 | 1h |
| 3.6 | Virus scanning for uploads | LOW | 3 | 4h |
| 4.1 | Secrets rotation | LOW | 4 | 4h |
| 4.2 | CI security scanning | LOW | 4 | 2h |
| 4.3 | WAF (Cloud Armor) | LOW | 4 | 8h |
| 4.4 | External pentest | LOW | 4 | — |

**Total estimated effort:** Phase 0: ~4h, Phase 1: ~8h, Phase 2: ~6h, Phase 3: ~16h, Phase 4: ongoing

---

## Current Security Score

```
Authentication:     2/10  (disabled in prod, no inter-service auth)
Authorization:      4/10  (RBAC exists but bypassed)
Input Validation:   6/10  (Pydantic good, JS inconsistent)
SQL Injection:      9/10  (parameterized queries everywhere)
CORS:               5/10  (configured but too permissive)
Rate Limiting:      5/10  (Portal+Monolit good, URS+Registry missing)
Security Headers:   6/10  (Helmet on 2/4 backends)
Secrets Management: 7/10  (GCP Secret Manager, but fallbacks)
File Upload:        8/10  (good validation, no virus scan)
Infrastructure:     4/10  (all services publicly accessible)
```

**Overall: 5.6/10** → Target after Phase 2: **8/10**
