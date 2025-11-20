# Portal Copy Guide - stavagent-portal Repository Setup

**Дата создания:** 2025-11-15
**Источник:** Monolit-Planner repository
**Назначение:** Инструкция для создания stavagent-portal с нуля

---

## 🎯 Цель

Создать отдельный репозиторий **stavagent-portal** со всем необходимым кодом для:
- Авторизации и регистрации пользователей
- Админ панели
- Portal API (проекты, файлы, kiosk links)
- CORE интеграции
- Chat (будущее)

---

## 📦 Структура репозитория

```
stavagent-portal/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js                    ✅ КОПИРОВАТЬ
│   │   │   ├── admin.js                   ✅ КОПИРОВАТЬ
│   │   │   ├── portal-projects.js         ✅ КОПИРОВАТЬ
│   │   │   ├── portal-files.js            ✅ КОПИРОВАТЬ
│   │   │   ├── kiosk-links.js             ✅ КОПИРОВАТЬ
│   │   │   ├── otskp.js                   ✅ КОПИРОВАТЬ
│   │   │   └── debug.js                   ✅ КОПИРОВАТЬ
│   │   ├── middleware/
│   │   │   ├── auth.js                    ✅ КОПИРОВАТЬ
│   │   │   └── rateLimiter.js             ✅ КОПИРОВАТЬ
│   │   ├── services/
│   │   │   ├── emailService.js            ✅ КОПИРОВАТЬ
│   │   │   └── concreteAgentClient.js     ✅ КОПИРОВАТЬ
│   │   ├── db/
│   │   │   ├── init.js                    ✅ КОПИРОВАТЬ
│   │   │   ├── postgres.js                ✅ КОПИРОВАТЬ
│   │   │   ├── index.js                   ✅ КОПИРОВАТЬ
│   │   │   └── schema-postgres.sql        ✅ КОПИРОВАТЬ (Portal tables)
│   │   └── utils/
│   │       ├── logger.js                  ✅ КОПИРОВАТЬ
│   │       ├── errorHandler.js            ✅ КОПИРОВАТЬ
│   │       └── fileCleanup.js             ✅ КОПИРОВАТЬ
│   └── scripts/
│       └── ensure-shared-build.js         ✅ КОПИРОВАТЬ
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx                        🆕 СОЗДАТЬ НОВЫЙ
│   │   ├── main.tsx                       ✅ КОПИРОВАТЬ
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx              ✅ КОПИРОВАТЬ
│   │   │   ├── RegisterPage.tsx           ✅ КОПИРОВАТЬ
│   │   │   ├── DashboardPage.tsx          ✅ КОПИРОВАТЬ
│   │   │   ├── VerifyEmailPage.tsx        ✅ КОПИРОВАТЬ
│   │   │   ├── ForgotPasswordPage.tsx     ✅ КОПИРОВАТЬ
│   │   │   ├── ResetPasswordPage.tsx      ✅ КОПИРОВАТЬ
│   │   │   ├── ChangePasswordPage.tsx     ✅ КОПИРОВАТЬ
│   │   │   ├── AdminDashboard.tsx         ✅ КОПИРОВАТЬ
│   │   │   └── PortalPage.tsx             ✅ КОПИРОВАТЬ
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx         ✅ КОПИРОВАТЬ
│   │   │   └── portal/
│   │   │       ├── ProjectCard.tsx        ✅ КОПИРОВАТЬ
│   │   │       ├── CreateProjectModal.tsx ✅ КОПИРОВАТЬ
│   │   │       └── CorePanel.tsx          ✅ КОПИРОВАТЬ
│   │   └── styles/
│   │       └── components.css             ✅ КОПИРОВАТЬ
│   └── scripts/
│       └── ensure-shared-build.js         ✅ КОПИРОВАТЬ
├── shared/
│   ├── package.json                       ✅ КОПИРОВАТЬ
│   ├── tsconfig.json                      ✅ КОПИРОВАТЬ
│   └── src/
│       └── types.ts                       ✅ КОПИРОВАТЬ
├── docs/
│   ├── STAVAGENT_CONTRACT.md              ✅ КОПИРОВАТЬ
│   └── PORTAL_ARCHITECTURE.md             ✅ КОПИРОВАТЬ
├── .gitignore                             ✅ КОПИРОВАТЬ
├── .nvmrc                                 ✅ КОПИРОВАТЬ
├── package.json                           ✅ КОПИРОВАТЬ
└── README.md                              🆕 СОЗДАТЬ НОВЫЙ
```

---

## 📋 Детальный список файлов для копирования

### Backend Routes (8 файлов)

```bash
# Из: Monolit-Planner/backend/src/routes/
# В:   stavagent-portal/backend/src/routes/

✅ auth.js (400+ строк)
   - POST /api/auth/register
   - POST /api/auth/login
   - POST /api/auth/verify-email
   - POST /api/auth/forgot-password
   - POST /api/auth/reset-password
   - GET  /api/auth/me

✅ admin.js (300+ строк)
   - GET    /api/admin/users
   - PUT    /api/admin/users/:id
   - DELETE /api/admin/users/:id
   - GET    /api/admin/audit-logs

✅ portal-projects.js (479 строк)
   - GET    /api/portal-projects
   - POST   /api/portal-projects
   - GET    /api/portal-projects/:id
   - PUT    /api/portal-projects/:id
   - DELETE /api/portal-projects/:id
   - POST   /api/portal-projects/:id/send-to-core
   - GET    /api/portal-projects/:id/files
   - GET    /api/portal-projects/:id/kiosks

✅ portal-files.js (420 строк)
   - POST   /api/portal-files/:projectId/upload
   - GET    /api/portal-files/:fileId
   - DELETE /api/portal-files/:fileId
   - GET    /api/portal-files/:fileId/download
   - POST   /api/portal-files/:fileId/analyze

✅ kiosk-links.js (413 строк)
   - POST   /api/kiosk-links
   - GET    /api/kiosk-links/:linkId
   - PUT    /api/kiosk-links/:linkId
   - DELETE /api/kiosk-links/:linkId
   - POST   /api/kiosk-links/:linkId/sync
   - GET    /api/kiosk-links/by-kiosk/:type/:id

✅ otskp.js (200+ строк)
   - GET /api/otskp/search
   - GET /api/otskp/code/:code

✅ debug.js (100+ строк)
   - GET /api/debug/db-status
   - GET /api/debug/tables

🆕 chat.js (СОЗДАТЬ В БУДУЩЕМ)
   - POST /api/chat/sessions
   - POST /api/chat/messages
   - GET  /api/chat/sessions/:projectId
```

### Backend Middleware (2 файла)

```bash
✅ middleware/auth.js
   - export function requireAuth()
   - export function generateToken()
   - export function verifyToken()

✅ middleware/rateLimiter.js
   - export const apiLimiter
   - export const authLimiter
   - export const uploadLimiter
   - export const otskpLimiter
```

### Backend Services (2 файла)

```bash
✅ services/emailService.js
   - export async function sendVerificationEmail()
   - export async function sendPasswordResetEmail()

✅ services/concreteAgentClient.js (375 строк)
   - export async function workflowAStart()
   - export async function workflowBStart()
   - export async function performAudit()
   - export async function enrichWithAI()
   - export async function searchKnowledgeBase()
   - export async function calculateBridge()
```

### Backend Database (4 файла)

```bash
✅ db/init.js
   - export async function initDatabase()

✅ db/postgres.js
   - export function getPool()

✅ db/index.js
   - export default db

✅ db/schema-postgres.sql
   КОПИРОВАТЬ ТОЛЬКО ЭТИ ТАБЛИЦЫ:
   - users
   - email_verification_tokens
   - password_reset_tokens
   - audit_logs
   - portal_projects ✅
   - portal_files ✅
   - kiosk_links ✅
   - chat_sessions ✅
   - chat_messages ✅
   - otskp_codes
```

### Backend Utils (3 файла)

```bash
✅ utils/logger.js
   - export const logger

✅ utils/errorHandler.js
   - export const errorHandler

✅ utils/fileCleanup.js
   - export function schedulePeriodicCleanup()
```

### Backend Config (1 файл)

```bash
✅ server.js (МОДИФИЦИРОВАТЬ)
   Убрать импорты:
   - bridgesRoutes
   - positionsRoutes
   - monolithProjectsRoutes
   - partsRoutes
   - exportRoutes
   - mappingRoutes
   - configRoutes
   - snapshotsRoutes
   - uploadRoutes
   - documentsRoutes

   Оставить импорты:
   - authRoutes ✅
   - adminRoutes ✅
   - portalProjectsRoutes ✅
   - portalFilesRoutes ✅
   - kioskLinksRoutes ✅
   - otskpRoutes ✅
   - debugRoutes ✅
```

### Frontend Pages (9 файлов)

```bash
✅ pages/LoginPage.tsx
✅ pages/RegisterPage.tsx
✅ pages/DashboardPage.tsx
✅ pages/VerifyEmailPage.tsx
✅ pages/ForgotPasswordPage.tsx
✅ pages/ResetPasswordPage.tsx
✅ pages/ChangePasswordPage.tsx
✅ pages/AdminDashboard.tsx
✅ pages/PortalPage.tsx (297 строк)
```

### Frontend Components (4 файла)

```bash
✅ components/ProtectedRoute.tsx

✅ components/portal/ProjectCard.tsx (174 строки)
✅ components/portal/CreateProjectModal.tsx (161 строка)
✅ components/portal/CorePanel.tsx (276 строк)
```

### Frontend App (СОЗДАТЬ НОВЫЙ)

```typescript
// App.tsx - НОВАЯ ВЕРСИЯ ДЛЯ PORTAL
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminDashboard from './pages/AdminDashboard';
import PortalPage from './pages/PortalPage';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/components.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          <Route path="/portal" element={<ProtectedRoute><PortalPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/portal" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
```

### Shared (3 файла)

```bash
✅ shared/package.json
✅ shared/tsconfig.json
✅ shared/src/types.ts
```

### Documentation (2 файла)

```bash
✅ docs/STAVAGENT_CONTRACT.md (728 строк)
✅ docs/PORTAL_ARCHITECTURE.md (659 строк)
```

### Root Config (5 файлов)

```bash
✅ .gitignore
✅ .nvmrc (Node.js 18.20.4)
✅ package.json (root workspace)

🆕 README.md - СОЗДАТЬ НОВЫЙ:
```markdown
# StavAgent Portal

Main entry point for StavAgent microservices architecture.

## Services

- **Auth & Admin**: User management, authentication, authorization
- **Portal Projects**: Project registry, file storage
- **CORE Integration**: Document parsing, audit, AI enrichment
- **Kiosk Coordination**: Links to calculator services (Monolit, Pump, etc.)
- **Chat**: AI chat with project context (coming soon)

## Architecture

```
Portal (YOU ARE HERE)
├── Stores all files (TZ, výkaz, drawings)
├── Manages users & auth
├── Coordinates CORE & Kiosks
└── Hosts chat

CORE (concrete-agent)
├── Document parsing
├── Multi-role audit
└── AI enrichment

Kiosks (separate repos)
├── kiosk-monolit - Concrete calculator
├── kiosk-pump - Pump calculator
└── kiosk-formwork - Formwork calculator
```

## Deploy

Deploy on Render:
- Build: `cd backend && npm install && cd ../frontend && npm install && npm run build`
- Start: `cd backend && npm start`

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
CORE_API_URL=https://concrete-agent.onrender.com
```
```

🆕 .env.example - СОЗДАТЬ:
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=24h

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# CORE API
CORE_API_URL=https://concrete-agent.onrender.com

# CORS
CORS_ORIGIN=https://stavagent-portal-frontend.onrender.com

# Server
PORT=3001
NODE_ENV=production
```
```

### Package.json файлы

**Root package.json:**
```json
{
  "name": "stavagent-portal",
  "version": "1.0.0",
  "description": "StavAgent Portal - Main entry point",
  "private": true,
  "workspaces": [
    "backend",
    "frontend",
    "shared"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=backend & npm run dev --workspace=frontend",
    "build": "npm run build --workspace=frontend"
  }
}
```

**Backend package.json:**
```json
{
  "name": "@stavagent/portal-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "prepare:shared": "node ./scripts/ensure-shared-build.js",
    "prestart": "npm run prepare:shared",
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@stavagent/shared": "file:../shared",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.7",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1",
    "axios": "^1.6.5",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

**Frontend package.json:**
```json
{
  "name": "@stavagent/portal-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "prepare:shared": "node ./scripts/ensure-shared-build.js",
    "predev": "npm run prepare:shared",
    "dev": "vite",
    "prebuild": "npm run prepare:shared",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@stavagent/shared": "file:../shared",
    "@tanstack/react-query": "^5.17.9",
    "axios": "^1.6.5",
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.9.5",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.26",
    "@types/react-dom": "^18.3.7",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

---

## 🔧 Пошаговая инструкция для Claude Code

### Когда пользователь откроет новую сессию в ~/stavagent-portal:

1. **Прочитать этот файл:**
   ```
   Прочти PORTAL_COPY_GUIDE.md из Monolit-Planner
   ```

2. **Создать структуру директорий:**
   ```bash
   mkdir -p backend/src/{routes,middleware,services,db,utils}
   mkdir -p frontend/src/{pages,components/portal,styles}
   mkdir -p shared/src
   mkdir -p docs
   ```

3. **Скопировать файлы из Monolit-Planner:**
   - Использовать команду `cp` или создать файлы с тем же содержимым
   - Следовать списку выше

4. **Создать новые файлы:**
   - App.tsx (Portal-only version)
   - README.md
   - .env.example

5. **Модифицировать server.js:**
   - Убрать routes для Kiosk (bridges, positions, monolith-projects, etc.)
   - Оставить только Portal routes

6. **Инициализировать git:**
   ```bash
   git init
   git add .
   git commit -m "🎉 Initial commit: StavAgent Portal"
   git remote add origin https://github.com/alpro1000/stavagent-portal.git
   git branch -M main
   git push -u origin main
   ```

---

## 📊 Что НЕ копировать (остаётся в Kiosk)

❌ **Backend routes:**
- bridges.js
- positions.js
- monolith-projects.js
- parts.js
- export.js
- mapping.js
- config.js
- snapshots.js
- upload.js
- documents.js (если только для Kiosk)

❌ **Frontend components:**
- MainApp.tsx (Monolit calculator)
- PositionsTable.tsx
- KPIPanel.tsx
- Sidebar.tsx
- MonolithSpecific components

❌ **Database tables:**
- bridges
- positions
- snapshots
- mapping_profiles
- project_config
- monolith_projects (кроме portal_projects!)
- parts
- part_templates

---

## ✅ Чек-лист завершения

- [ ] Все backend routes скопированы (8 файлов)
- [ ] Все middleware скопированы (2 файла)
- [ ] Все services скопированы (2 файла)
- [ ] Все db файлы скопированы (4 файла, только Portal tables)
- [ ] Все utils скопированы (3 файла)
- [ ] Все frontend pages скопированы (9 файлов)
- [ ] Все frontend components скопированы (4 файла)
- [ ] App.tsx создан (Portal-only)
- [ ] Shared скопирован (3 файла)
- [ ] Documentation скопирована (2 файла)
- [ ] Root config создан (5 файлов)
- [ ] package.json файлы настроены (3 файла)
- [ ] README.md создан
- [ ] .env.example создан
- [ ] Git инициализирован
- [ ] Первый коммит сделан
- [ ] Pushed на GitHub

---

## 🚀 После создания репо

**Deploy на Render:**
1. Create new Web Service
2. Name: `stavagent-portal`
3. GitHub: `alpro1000/stavagent-portal`
4. Build: `cd backend && npm install && cd ../frontend && npm install && npm run build`
5. Start: `cd backend && npm start`
6. Env vars: Добавить все из .env.example

**Создать PostgreSQL:**
1. Create PostgreSQL database на Render
2. Name: `stavagent-portal-db`
3. Скопировать DATABASE_URL в env vars

**Тестирование:**
1. Открыть https://stavagent-portal.onrender.com
2. Зарегистрироваться
3. Создать проект
4. Загрузить файл
5. Отправить в CORE

---

## 📝 Итого

**Скопировать:**
- 8 backend routes
- 2 middleware
- 2 services
- 4 db files (только Portal tables)
- 3 utils
- 9 frontend pages
- 4 frontend components
- 3 shared files
- 2 docs

**Создать новые:**
- App.tsx (Portal-only)
- README.md
- .env.example
- package.json (3 файла)

**Общий объём:**
- ~3500 строк backend кода
- ~1500 строк frontend кода
- ~1400 строк документации
- **Итого: ~6400 строк кода**

Все готово для создания stavagent-portal! 🎉
