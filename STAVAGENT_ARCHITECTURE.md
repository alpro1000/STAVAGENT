# 🏗️ STAVAGENT: АРХИТЕКТУРНОЕ ОПИСАНИЕ

**Статус:** v1.0 (Monorepo consolidation)
**Дата:** 2024-11-21

---

## 🎯 ВЫСОКОУРОВНЕВАЯ АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS / BROWSERS                      │
└─────────────────────────────────────────────────────────────┘
         │                      │                      │
         ↓                      ↓                      ↓
┌─────────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Monolit-Planner   │ │ stavagent-portal │ │  Future Projects │
│     FRONTEND        │ │    FRONTEND      │ │     (Planned)    │
│  (Vite + React 18)  │ │ (Vite + React 18)│ │                  │
└─────────────────────┘ └──────────────────┘ └──────────────────┘
         │                      │                      │
         ↓                      ↓                      ↓
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────┴────────────┐
                    ↓                        ↓
         ┌─────────────────────┐  ┌────────────────────┐
         │  Monolit-Planner    │  │ stavagent-portal   │
         │     BACKEND         │  │     BACKEND        │
         │ (Express + SQLite)  │  │ (Express + SQLite) │
         │                     │  │                    │
         │ Routes:             │  │ Routes:            │
         │ • /api/positions    │  │ • /api/projects    │
         │ • /api/bridges      │  │ • /api/users       │
         │ • /api/analysis     │  │ • /api/uploads     │
         │ • /api/otskp        │  │ • /api/kiosk       │
         │ • /api/export       │  │ • /api/auth        │
         │ • /api/auth         │  │ • /api/otskp       │
         └─────────────────────┘  └────────────────────┘
                    │                        │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
                    ↓                        ↓
            ┌──────────────┐        ┌──────────────┐
            │  SQLite DB   │        │  SQLite DB   │
            │  monolit.db  │        │  portal.db   │
            └──────────────┘        └──────────────┘


Deployment on Render:
┌─────────────────────────────────────────────────────────────┐
│  RENDER.COM                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Service 1: monolit-planner-api                            │
│  ├── Repository: alpro1000/STAVAGENT                       │
│  ├── Root: Monolit-Planner/                                │
│  ├── Build: npm install                                    │
│  ├── Start: npm start                                      │
│  └── URL: https://monolit-planner-api.onrender.com        │
│                                                             │
│  Service 2: stavagent-portal-backend                       │
│  ├── Repository: alpro1000/STAVAGENT                       │
│  ├── Root: stavagent-portal/                               │
│  ├── Build: npm install                                    │
│  ├── Start: npm start                                      │
│  └── URL: https://stavagent-portal-backend.onrender.com   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 КОМПОНЕНТ-WISE АРХИТЕКТУРА

### 1. MONOLIT-PLANNER

**Назначение:** Калькулятор мостовых конструкций

#### Backend Structure

```
Monolit-Planner/backend/
├── src/
│   ├── server.js                      (Entry point)
│   │
│   ├── routes/
│   │   ├── auth.js                    (Аутентификация)
│   │   ├── admin.js                   (Администрирование)
│   │   ├── positions.js               (Управление позициями)
│   │   ├── bridges.js                 (Управление мостами)
│   │   ├── snapshots.js               (Версионирование)
│   │   ├── upload.js                  (Загрузка файлов)
│   │   ├── otskp.js                   (Ценовой каталог)
│   │   ├── export.js                  (Экспорт Excel)
│   │   ├── sheathing.js               (Расчёты опалубки)
│   │   ├── parts.js                   (Детали конструкции)
│   │   ├── documents.js               (Управление документами)
│   │   └── config.js                  (Конфигурация)
│   │
│   ├── middleware/
│   │   ├── auth.js                    (JWT verification)
│   │   └── errorHandler.js
│   │
│   ├── controllers/
│   │   ├── positionController.js
│   │   ├── bridgeController.js
│   │   └── analysisController.js
│   │
│   ├── models/
│   │   ├── Position.js
│   │   ├── Bridge.js
│   │   ├── Project.js
│   │   └── User.js
│   │
│   ├── services/
│   │   ├── analysisService.js         (Расчётная логика)
│   │   ├── parsingService.js          (Парсинг документов)
│   │   ├── excelExportService.js      (Экспорт в Excel)
│   │   └── otskpService.js            (OTSKP данные)
│   │
│   ├── utils/
│   │   ├── validators.js
│   │   ├── fileUpload.js
│   │   └── helpers.js
│   │
│   └── db/
│       ├── init.js                    (Инициализация БД)
│       └── schemas/
│           ├── positions.sql
│           ├── bridges.sql
│           └── users.sql
│
├── package.json
│   ├── dependencies: express, better-sqlite3, bcrypt, jsonwebtoken
│   └── engines: node >=18.0.0
│
└── .env.example
    ├── NODE_ENV=production
    ├── PORT=3001
    ├── DB_PATH=./data/monolit.db
    └── JWT_SECRET=...
```

#### Frontend Structure

```
Monolit-Planner/frontend/
├── src/
│   ├── main.tsx                       (Entry point)
│   ├── App.tsx                        (Root component)
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── BridgeListPage.tsx
│   │   ├── BridgeDetailPage.tsx
│   │   ├── AnalysisPage.tsx
│   │   ├── DocumentUploadPage.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── SettingsPage.tsx
│   │   └── 404Page.tsx
│   │
│   ├── components/
│   │   ├── MainApp.tsx
│   │   ├── Sidebar.tsx                (Navigation)
│   │   ├── Header.tsx                 (Top bar)
│   │   │
│   │   ├── ProtectedRoute.tsx         (Auth wrapper)
│   │   │
│   │   ├── BridgeComponents/
│   │   │   ├── BridgeForm.tsx
│   │   │   ├── PositionTable.tsx
│   │   │   ├── BridgeCard.tsx
│   │   │   └── BridgeViewer.tsx
│   │   │
│   │   ├── AnalysisComponents/
│   │   │   ├── AnalysisPreview.tsx    (HUGE: 13,238 LOC)
│   │   │   ├── ResultsChart.tsx
│   │   │   ├── SnapshotsManager.tsx
│   │   │   └── ComparisonView.tsx
│   │   │
│   │   ├── FileUploadComponents/
│   │   │   ├── DocumentUpload.tsx     (6,562 LOC)
│   │   │   ├── UploadProgress.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── ParsingResults.tsx
│   │   │
│   │   ├── OtskpComponents/
│   │   │   ├── OtskpAutocomplete.tsx  (5,000 LOC)
│   │   │   ├── OtskpDetails.tsx
│   │   │   └── PricingTable.tsx
│   │   │
│   │   └── AdminComponents/
│   │       ├── UserManagement.tsx
│   │       ├── AuditLogs.tsx
│   │       └── SystemStats.tsx
│   │
│   ├── services/
│   │   ├── api.ts                     (Axios wrapper - 527 LOC)
│   │   │   ├── GET /api/positions
│   │   │   ├── POST /api/positions
│   │   │   ├── GET /api/bridges
│   │   │   ├── POST /api/bridges
│   │   │   ├── GET /api/analysis/{id}
│   │   │   └── POST /api/export
│   │   │
│   │   └── http.ts                    (Interceptors, error handling)
│   │
│   ├── context/
│   │   ├── AuthContext.tsx            (100 LOC - DUPLICATED!)
│   │   │   └── useAuth() hook
│   │   │
│   │   └── AppContext.tsx             (Global state)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 (Auth logic)
│   │   ├── useBridges.ts              (Bridge CRUD)
│   │   ├── usePositions.ts            (Position CRUD)
│   │   ├── useQuery.ts                (React Query wrapper)
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   └── useWindowSize.ts
│   │
│   ├── styles/
│   │   ├── global.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   └── [component-name].module.css
│   │
│   └── types/
│       └── index.ts                   (TypeScript types)
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
    ├── dependencies: react@18.2.0, react-router-dom@7.9.5
    ├── devDependencies: vite@5.0.0, typescript@5.3.3
    └── scripts: dev, build, preview
```

#### Type Definitions (shared/)

```
Monolit-Planner/shared/
└── src/
    ├── types/
    │   ├── api.ts           (API request/response types)
    │   ├── position.ts      (Position entity)
    │   ├── bridge.ts        (Bridge entity)
    │   ├── kpi.ts           (KPI calculations)
    │   ├── snapshot.ts      (Version control)
    │   ├── otskp.ts         (Pricing codes)
    │   ├── sheathing.ts     (Formwork types)
    │   └── user.ts          (User/Auth types)
    │
    └── index.ts             (Export all types)
```

---

### 2. STAVAGENT-PORTAL

**Назначение:** Центральный портал управления проектами

#### Backend Structure

```
stavagent-portal/backend/
├── src/
│   ├── server.js                      (Entry point)
│   │
│   ├── routes/
│   │   ├── auth.js                    (100% identical to Monolit!)
│   │   ├── admin.js                   (100% identical to Monolit!)
│   │   ├── otskp.js                   (100% identical to Monolit!)
│   │   ├── portal-projects.js         (Portal-specific projects)
│   │   ├── portal-files.js            (Portal file management)
│   │   ├── kiosk-links.js             (Kiosk integration)
│   │   └── debug.js                   (Debug endpoints)
│   │
│   └── [same structure as Monolit]
│
├── package.json
├── .env.example
│   ├── NODE_ENV=production
│   ├── PORT=3001
│   ├── DB_PATH=./data/stavagent-portal.db
│   ├── CORE_API_URL=https://concrete-agent.onrender.com
│   └── JWT_SECRET=...
│
└── [same middleware, models, services as Monolit]
```

#### Frontend Structure

```
stavagent-portal/frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ProjectsPage.tsx          (Portal-specific)
│   │   ├── ProjectDetailPage.tsx     (Portal-specific)
│   │   ├── DocumentUploadPage.tsx
│   │   ├── KioskPage.tsx             (Portal-specific)
│   │   ├── AdminPage.tsx
│   │   └── 404Page.tsx
│   │
│   ├── components/
│   │   ├── ProtectedRoute.tsx         (DUPLICATED!)
│   │   ├── AnalysisPreview.tsx        (DUPLICATED! 13,238 LOC)
│   │   ├── OtskpAutocomplete.tsx      (DUPLICATED! 5,000 LOC)
│   │   ├── DocumentUpload.tsx         (DUPLICATED! 6,562 LOC)
│   │   │
│   │   ├── PortalComponents/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── CreateProjectModal.tsx
│   │   │   ├── CorePanel.tsx
│   │   │   └── KioskIntegration.tsx
│   │   │
│   │   └── AdminComponents/
│   │       ├── UserManagement.tsx
│   │       ├── AuditLogs.tsx
│   │       └── SystemStats.tsx
│   │
│   ├── services/
│   │   └── api.ts                     (99% identical to Monolit!)
│   │
│   ├── context/
│   │   └── AuthContext.tsx            (100% identical to Monolit!)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 (Identical!)
│   │   └── [same as Monolit]
│   │
│   └── [same structure as Monolit frontend]
│
└── package.json
    └── [same dependencies as Monolit]
```

---

### 3. CONCRETE-AGENT (ЯДРО СИСТЕМЫ)

**Статус:** ✅ ЯДРО СИСТЕМЫ - КРИТИЧНЫЙ И РАБОЧИЙ

```
concrete-agent/
├── packages/
│   ├── core-backend/                  (FastAPI + Python) ✅ РАБОТАЕТ
│   │   ├── app/
│   │   │   ├── main.py                (FastAPI приложение)
│   │   │   ├── models/                (SQLAlchemy models)
│   │   │   ├── routes/                (REST endpoints)
│   │   │   ├── services/
│   │   │   │   ├── parsing_service.py (Парсинг MinerU)
│   │   │   │   ├── enrichment.py      (ML обогащение)
│   │   │   │   └── claude_service.py  (Anthropic Claude API)
│   │   │   └── prompts/               (AI промпты)
│   │   ├── requirements.txt           (MinerU, Claude, FastAPI, etc)
│   │   └── ...
│   │
│   ├── core-frontend/                 (Vite + React 18)
│   │   └── [компоненты для визуализации]
│   │
│   └── core-shared/                   (TypeScript types)
│       └── [API contracts]
│
└── frontend/                          (Next.js wrapper)
    └── [не критично - не используется]
```

**ЯДРО СИСТЕМЫ - ОЧЕНЬ ВАЖНО:**
- ✅ Это парсеры документов (MinerU)
- ✅ Это ИИ логика (Anthropic Claude)
- ✅ Это обогащение данных (enrichment)
- ✅ REST API для других сервисов
- ✅ Полностью рабочий и критичный!

---

## 🗄️ ДАННЫЕ И БАЗЫ ДАННЫХ

### Текущая архитектура (v1.0)

```
┌─────────────────────────────────────────┐
│        Monolit-Planner Backend          │
│        (Express + SQLite)               │
├─────────────────────────────────────────┤
│  SQLite Database: ./data/monolit.db    │
├─────────────────────────────────────────┤
│ Tables:                                 │
│ • users                                 │
│ • projects                              │
│ • positions                             │
│ • bridges                               │
│ • snapshots (version control)           │
│ • uploads (file metadata)               │
│ • otskp_codes (pricing)                 │
│ • audit_logs                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      stavagent-portal Backend           │
│        (Express + SQLite)               │
├─────────────────────────────────────────┤
│  SQLite Database: ./data/portal.db      │
├─────────────────────────────────────────┤
│ Tables:                                 │
│ • users                                 │
│ • projects                              │
│ • documents (file uploads)              │
│ • kiosk_sessions                        │
│ • integrations (CORE API)               │
│ • audit_logs                            │
└─────────────────────────────────────────┘
```

### Будущая архитектура (v2.0 - Phase 4)

```
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
│         (Shared across all projects)    │
├─────────────────────────────────────────┤
│ Schemas:                                │
│ • public (shared)                       │
│   - users                               │
│   - projects                            │
│   - audit_logs                          │
│                                         │
│ • monolit (Monolit-Planner specific)   │
│   - positions                           │
│   - bridges                             │
│   - snapshots                           │
│                                         │
│ • portal (Portal specific)              │
│   - kiosk_sessions                      │
│   - integrations                        │
│                                         │
│ • shared (shared calculations)          │
│   - otskp_codes                         │
│   - materials                           │
│   - standards                           │
└─────────────────────────────────────────┘
```

---

## 🔐 АУТЕНТИФИКАЦИЯ И АВТОРИЗАЦИЯ

### Current Implementation (v1.0)

```
┌─────────────────────────────────────────┐
│         CLIENT (Browser)                │
└─────────────────────────────────────────┘
                    │
                    │ POST /api/auth/verify
                    │ { username, password }
                    ↓
┌─────────────────────────────────────────┐
│      Backend Server (Express)           │
├─────────────────────────────────────────┤
│ 1. Validate credentials                 │
│ 2. Hash password with bcrypt            │
│ 3. Generate JWT token                   │
│ 4. Return token                         │
└─────────────────────────────────────────┘
                    │
                    │ JWT token stored in localStorage
                    ↓
┌─────────────────────────────────────────┐
│      Frontend (React)                   │
├─────────────────────────────────────────┤
│ Store token: localStorage               │
│ Include in requests:                    │
│   Authorization: Bearer <token>         │
└─────────────────────────────────────────┘
                    │
                    │ Each request includes token
                    ↓
┌─────────────────────────────────────────┐
│    Backend Auth Middleware              │
├─────────────────────────────────────────┤
│ 1. Extract token from header            │
│ 2. Verify JWT signature                 │
│ 3. Check expiration                     │
│ 4. Attach user to request               │
│ 5. If 401: redirect to /login           │
└─────────────────────────────────────────┘
```

### JWT Token Structure

```
header.payload.signature

payload = {
  "sub": "user_id",
  "username": "username",
  "role": "admin|user",
  "iat": 1700000000,
  "exp": 1700086400,
  "iss": "STAVAGENT"
}
```

### Protected Routes

```typescript
// Frontend
<ProtectedRoute
  requiredRole="admin"
  fallback={<LoginPage />}
>
  <AdminDashboard />
</ProtectedRoute>

// Backend
app.use('/api/admin', authenticateToken, authorizeRole('admin'))
```

---

## 🔗 ИНТЕГРАЦИЯ МЕЖДУ СЕРВИСАМИ

### Текущая архитектура (v1.0)

```
                    ┌─────────────────────┐
                    │  stavagent-portal   │
                    │     FRONTEND        │
                    └─────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ↓                    ↓
        ┌──────────────────┐  ┌──────────────────┐
        │  Portal BACKEND  │  │ Monolit BACKEND  │
        │  (API routes)    │  │  (API routes)    │
        └──────────────────┘  └──────────────────┘
                    │                    │
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ↓                    ↓
            ┌──────────────┐     ┌──────────────┐
            │  Portal DB   │     │  Monolit DB  │
            │ (SQLite)     │     │  (SQLite)    │
            └──────────────┘     └──────────────┘

Endpoints:
- GET  /api/positions              (from Monolit)
- POST /api/projects               (to Portal)
- GET  /api/projects/{id}/analysis (via Portal → Monolit)
```

### Планируемая архитектура (v2.0)

```
┌─────────────────────────┐
│  Unified Shared Types   │
│  (@stavagent/shared)    │
└─────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐
│ Monolit Frontend    │ │ Portal Frontend     │ │ Future Projects  │
│                     │ │                     │ │                  │
└─────────────────────┘ └─────────────────────┘ └──────────────────┘
         │                    │                    │
         └────────┬───────────┴────────┬───────────┘
                  │                    │
         ┌────────┴─────┐    ┌────────┴─────┐
         │              │    │              │
         ↓              ↓    ↓              ↓
    ┌─────────┐     ┌─────────┐
    │ Monolit │     │ Portal  │
    │ Backend │     │ Backend │
    └─────────┘     └─────────┘
         │              │
         └──────┬───────┘
                │
         ┌──────┴──────┐
         │              │
         ↓              ↓
    ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │  Redis   │
    │  (Shared)│   │ (Cache)  │
    └──────────┘   └──────────┘
```

---

## 📡 API CONTRACT МЕЖДУ СЕРВИСАМИ

### Shared Endpoints (Identical in both backends)

```
Authentication:
  POST   /api/auth/verify              { username, password }
  POST   /api/auth/me                  (get current user)
  POST   /api/auth/change-password     { oldPassword, newPassword }
  POST   /api/auth/logout              (clear session)

OTSKP (Pricing Catalog):
  GET    /api/otskp/search?q=...      (search codes)
  GET    /api/otskp/{code}            (get code details)
  GET    /api/otskp/categories        (list categories)

Admin:
  GET    /api/admin/users             (list users)
  POST   /api/admin/users             (create user)
  PUT    /api/admin/users/{id}        (update user)
  DELETE /api/admin/users/{id}        (delete user)
  GET    /api/admin/logs              (audit logs)
```

### Monolit-Specific Endpoints

```
Positions:
  GET    /api/positions
  POST   /api/positions               { name, type, config }
  PUT    /api/positions/{id}
  DELETE /api/positions/{id}

Bridges:
  GET    /api/bridges
  POST   /api/bridges                 { name, positions }
  GET    /api/bridges/{id}
  PUT    /api/bridges/{id}
  DELETE /api/bridges/{id}

Analysis:
  POST   /api/bridges/{id}/analyze    (calculate results)
  GET    /api/bridges/{id}/analysis   (get results)

Snapshots:
  GET    /api/bridges/{id}/snapshots  (version history)
  POST   /api/bridges/{id}/snapshots  (save version)

Export:
  POST   /api/bridges/{id}/export     { format: 'excel' | 'pdf' }
```

### Portal-Specific Endpoints

```
Projects:
  GET    /api/projects
  POST   /api/projects                { name, description }
  GET    /api/projects/{id}
  PUT    /api/projects/{id}
  DELETE /api/projects/{id}

Files:
  POST   /api/files/upload            (multipart)
  GET    /api/files/{id}              (download)
  DELETE /api/files/{id}

Kiosk:
  POST   /api/kiosk/start-session     { sessionData }
  GET    /api/kiosk/session/{id}
  POST   /api/kiosk/session/{id}/end

Integrations:
  GET    /api/integrations            (configured services)
  POST   /api/integrations/core       (sync with CORE)
```

---

## 🚀 DEPLOYMENT ARCHITECTURE

### Current (Render.com)

```
GitHub (alpro1000/STAVAGENT)
         │
         │ git push origin main
         │
         ↓
    Render Dashboard
         │
    ┌────┴────┬─────────┐
    │          │         │
    ↓          ↓         ↓
[Service 1] [Service 2] [Service 3]
│            │           │
├─ Name: monolit-planner-api
├─ Root: Monolit-Planner/
├─ Build: npm install
├─ Start: npm start
├─ URL: https://monolit-planner-api.onrender.com
│
│
├─ Name: stavagent-portal-backend
├─ Root: stavagent-portal/
├─ Build: npm install
├─ Start: npm start
├─ URL: https://stavagent-portal-backend.onrender.com
│
│
└─ OLD: monolit-planner-frontend (deprecated)
   └─ Should be removed
```

### Future (v2.0 - Kubernetes)

```
STAVAGENT Cluster
├── Namespace: monolit
│   ├── Pod: monolit-backend
│   ├── Pod: monolit-frontend
│   ├── Service: monolit-api (LoadBalancer)
│   └── PersistentVolume: monolit-data
│
├── Namespace: portal
│   ├── Pod: portal-backend
│   ├── Pod: portal-frontend
│   ├── Service: portal-api (LoadBalancer)
│   └── PersistentVolume: portal-data
│
├── Namespace: shared
│   ├── Pod: postgres-db
│   ├── Pod: redis-cache
│   ├── Service: postgres-service (ClusterIP)
│   └── Service: redis-service (ClusterIP)
│
└── Ingress: API Gateway
    ├── api.stavagent.io/monolit → monolit-api
    ├── api.stavagent.io/portal → portal-api
    └── api.stavagent.io/health → health-check
```

---

## 🔄 DATA FLOW: ИСПОЛЬЗОВАНИЕ СЛУЧАЙ

### Use Case 1: Авторизация пользователя

```
1. User opens https://monolit-planner-api.onrender.com
2. Frontend (Vite) loads React app
3. User enters credentials
4. Frontend: POST /api/auth/verify { username, password }
5. Backend:
   - Lookup user in SQLite
   - Verify password hash with bcrypt
   - Generate JWT token
   - Return { token, user: { id, username, role } }
6. Frontend: localStorage.setItem('token', response.token)
7. Frontend: Redirect to /dashboard
8. Frontend: Include Authorization header in all requests
9. Backend: Middleware verifies JWT on each request
10. If token expired: Frontend redirects to /login
```

### Use Case 2: Расчёт моста

```
1. User navigates to /bridges/123 in Monolit-Planner frontend
2. Frontend: GET /api/bridges/123
3. Backend: Query SQLite, return bridge data
4. User modifies positions, clicks "Calculate"
5. Frontend: POST /api/bridges/123/analyze { positions }
6. Backend:
   - Run calculation service
   - Update database
   - Return { success, analysis: { kpi, results } }
7. Frontend: Display AnalysisPreview component with results
8. User clicks "Export"
9. Frontend: POST /api/bridges/123/export { format: 'excel' }
10. Backend:
    - Generate Excel file
    - Save to uploads/
    - Return { downloadUrl }
11. Frontend: Trigger browser download
```

### Use Case 3: Загрузка документа в Portal

```
1. User navigates to /upload in stavagent-portal
2. User selects Excel file
3. Frontend: POST /api/files/upload (multipart/form-data)
4. Backend:
   - Validate file type
   - Save to uploads/
   - Extract metadata
   - Store in SQLite
5. Backend: POST to Monolit API?
   (optional integration)
6. Frontend: Show "Upload successful"
7. User can now use document for analysis
```

---

## 🎓 KEY ARCHITECTURAL PRINCIPLES

### 1. **Separation of Concerns**
- Each service has own database
- Each service owns its routes
- Clean API boundaries

### 2. **Frontend Reusability**
- Shared components go in packages/ (Phase 2)
- Each project imports from shared
- Reduces duplication

### 3. **Backend Consolidation**
- Common auth logic → packages/auth-routes
- Common admin logic → packages/admin-routes
- Project-specific logic stays in service

### 4. **Type Safety**
- TypeScript across all frontends
- Shared types in @stavagent/shared-types
- Backend models match frontend types

### 5. **Monorepo Benefits**
- Single git repository
- Shared development workflow
- Consistent tooling
- Easy refactoring across services

---

## ⚡ PERFORMANCE CONSIDERATIONS

### Current Optimizations

```
Frontend:
✅ Vite (fast build)
✅ React 18 (automatic batching)
✅ React Query (caching)
✅ Code splitting (lazy routes)

Backend:
✅ SQLite (fast for single-user)
✅ JWT stateless auth
✅ Express middleware chain
✅ Connection pooling
```

### Future Optimizations (Phase 3-4)

```
Frontend:
- Add Zustand (better state management)
- Implement Tailwind CSS (smaller CSS)
- Add service worker (offline support)

Backend:
- PostgreSQL (concurrent users)
- Redis caching (frequently accessed data)
- Message queue (async operations)
- Database indexing (query optimization)
- API rate limiting (protection)
```

---

## 📊 SCALABILITY ROADMAP

### Phase 1 (Current): ✅ DONE
- Monorepo consolidation
- Both services on Render

### Phase 2 (Dec 2024): 🔄 IN PROGRESS
- Extract shared packages
- Reduce code duplication
- Standardize UI components

### Phase 3 (Jan 2025): ⏳ UPCOMING
- Unified styling (Tailwind)
- Unified state management (Zustand)
- Database unification (PostgreSQL)

### Phase 4 (Q1 2025): ⏳ FUTURE
- Kubernetes deployment
- Microservices architecture
- Distributed caching (Redis)
- Message queue (Celery/RabbitMQ)

---

**Last Updated:** 2024-11-21
**Next Review:** 2024-12-01
