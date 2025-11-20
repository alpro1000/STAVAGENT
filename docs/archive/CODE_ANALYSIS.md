# 🔍 Анализ существующего кода

**Дата:** 2025-11-15
**Цель:** Определить что можно переиспользовать для архитектуры ПОРТАЛ → КИОСКИ → ЯДРО

---

## 📊 Текущая структура проекта

### Backend (`backend/src/`)

```
backend/src/
├── routes/
│   ├── auth.js ..................... ✅ Авторизация (переиспользуем для портала)
│   ├── admin.js .................... ✅ Админка (переиспользуем)
│   ├── otskp.js .................... ✅ Справочник OTSKP (переиспользуем)
│   ├── documents.js ................ ✅ Загрузка документов (ГОТОВ!)
│   ├── monolith-projects.js ........ ❌ → Переносим в киоск Monolit
│   ├── parts.js .................... ❌ → Переносим в киоск Monolit
│   ├── positions.js ................ ❌ → Переносим в киоск Monolit
│   ├── bridges.js .................. ❌ → Устаревший (backward compatibility)
│   ├── upload.js ................... ❌ → Заменяем на documents.js
│   ├── export.js ................... ❌ → Переносим в киоск Monolit
│   ├── snapshots.js ................ ❌ → Переносим в киоск Monolit
│   ├── mapping.js .................. ❌ → Переносим в киоск Monolit
│   ├── config.js ................... ✅ Конфиг (переиспользуем)
│   └── debug.js .................... ⚠️ Временные debug-эндпоинты
│
├── services/
│   ├── concreteAgentClient.js ...... ✅ ГОТОВ! (клиент для CORE)
│   ├── emailService.js ............. ✅ Email (переиспользуем)
│   ├── calculator.js ............... ❌ → Переносим в киоск Monolit
│   ├── concreteExtractor.js ........ ❌ → Переносим в киоск Monolit
│   ├── parser.js ................... ❌ → Переносим в киоск Monolit
│   ├── exporter.js ................. ❌ → Переносим в киоск Monolit
│   └── snapshot.js ................. ❌ → Переносим в киоск Monolit
│
├── middleware/
│   ├── auth.js ..................... ✅ JWT auth (переиспользуем)
│   ├── adminOnly.js ................ ✅ Admin check (переиспользуем)
│   └── rateLimiter.js .............. ✅ Rate limiting (переиспользуем)
│
├── db/
│   ├── init.js ..................... ⚠️ Нужно расширить (добавить portal таблицы)
│   ├── migrations.js ............... ⚠️ Нужно добавить новые миграции
│   └── postgres.js ................. ✅ PostgreSQL клиент (переиспользуем)
│
└── utils/
    ├── logger.js ................... ✅ Логирование (переиспользуем)
    ├── auditLogger.js .............. ✅ Audit logs (переиспользуем)
    ├── errorHandler.js ............. ✅ Error handling (переиспользуем)
    ├── fileCleanup.js .............. ✅ File cleanup (переиспользуем)
    └── text.js ..................... ✅ Text utils (переиспользуем)
```

---

### Frontend (`frontend/src/`)

```
frontend/src/
├── pages/
│   ├── LoginPage.tsx ............... ✅ Вход (переиспользуем)
│   ├── DashboardPage.tsx ........... ⚠️ Заменим на PortalPage
│   ├── AdminDashboard.tsx .......... ✅ Админка (переиспользуем)
│   ├── VerifyEmailPage.tsx ......... ✅ Верификация email (переиспользуем)
│   ├── ChangePasswordPage.tsx ...... ✅ Смена пароля (переиспользуем)
│   ├── ForgotPasswordPage.tsx ...... ✅ Забыли пароль (переиспользуем)
│   ├── ResetPasswordPage.tsx ....... ✅ Сброс пароля (переиспользуем)
│   └── DocumentUploadPage.tsx ...... ✅ Загрузка документов (ГОТОВ!)
│
├── components/
│   ├── MainApp.tsx ................. ❌ → Переносим в киоск Monolit
│   ├── Header.tsx .................. ⚠️ Адаптируем для портала
│   ├── Sidebar.tsx ................. ❌ → Переносим в киоск Monolit
│   ├── PositionsTable.tsx .......... ❌ → Переносим в киоск Monolit
│   ├── KPIPanel.tsx ................ ❌ → Переносим в киоск Monolit
│   ├── ProtectedRoute.tsx .......... ✅ Auth guard (переиспользуем)
│   ├── OtskpAutocomplete.tsx ....... ✅ Поиск OTSKP (переиспользуем)
│   ├── DocumentUpload.tsx .......... ✅ Загрузка файлов (ГОТОВ!)
│   ├── AnalysisPreview.tsx ......... ✅ Preview анализа CORE (ГОТОВ!)
│   └── admin/ ...................... ✅ Админские компоненты (переиспользуем)
│       ├── UserManagement.tsx
│       ├── AuditLogs.tsx
│       └── AdminStats.tsx
│
├── context/
│   ├── AuthContext.tsx ............. ✅ Авторизация context (переиспользуем)
│   └── AppContext.tsx .............. ❌ → Переносим в киоск Monolit
│
├── hooks/
│   ├── useAuth.ts .................. ✅ Auth hook (переиспользуем)
│   └── useDarkMode.ts .............. ✅ Dark mode (переиспользуем)
│
└── services/
    └── api.ts ...................... ⚠️ Нужно расширить (добавить portal API)
```

---

## ✅ ЧТО УЖЕ ГОТОВО И МОЖНО ПЕРЕИСПОЛЬЗОВАТЬ

### 1. **Интеграция с Concrete-Agent CORE** ✨

**Файл:** `backend/src/services/concreteAgentClient.js` (375 строк)

**Готовые методы:**
```javascript
✅ workflowAStart(filePath, metadata)      // Парсинг документов (KROS, Excel, PDF)
✅ workflowBStart(filePath, metadata)      // Анализ чертежей (OCR + AI)
✅ performAudit(workflowId, data, roles)   // Мульти-ролевой аудит
✅ enrichWithAI(workflowId, data)          // AI обогащение
✅ searchKnowledgeBase(query, category)    // Поиск в KB
✅ calculateBridge(params)                 // Калькулятор мостов
✅ calculateBuilding(params)               // Калькулятор зданий
✅ healthCheck()                           // Проверка доступности CORE
✅ getServiceInfo()                        // Информация о CORE
```

**Что это значит:**
- ✅ **НЕ НУЖНО писать клиент заново!**
- ✅ Просто используем эти методы в портале
- ✅ Уже настроено: timeout, error handling, logging

---

### 2. **Загрузка и анализ документов** ✨

**Файл:** `backend/src/routes/documents.js` (400+ строк)

**Готовые endpoints:**
```javascript
✅ POST /api/documents/upload          // Загрузка файла + async анализ CORE
✅ GET  /api/documents/:id             // Детали документа
✅ GET  /api/documents/:id/analysis    // Результаты анализа CORE
✅ POST /api/documents/:id/confirm     // Подтверждение анализа
✅ DELETE /api/documents/:id           // Удаление документа
✅ GET  /api/documents?project_id=X    // Список документов проекта
```

**Что уже реализовано:**
- ✅ Multer для загрузки файлов (50MB max)
- ✅ Валидация типов (PDF, Excel, images)
- ✅ Async анализ через CORE (workflowAStart)
- ✅ Сохранение в БД (таблица `documents`)
- ✅ Polling для проверки статуса анализа

**Что это значит:**
- ✅ **Портал уже умеет загружать и анализировать файлы!**
- ✅ Просто адаптируем под новую схему БД (portal_files)

---

**Frontend компонент:** `DocumentUploadPage.tsx` + `DocumentUpload.tsx`

**Что есть:**
- ✅ Drag-drop загрузка файлов
- ✅ Progress bar
- ✅ Preview результатов анализа
- ✅ Polling статуса (каждые 2 секунды)

---

### 3. **Авторизация и пользователи** ✅

**Backend:**
- ✅ `routes/auth.js` - login, register, verify email, reset password
- ✅ `middleware/auth.js` - JWT validation
- ✅ `middleware/adminOnly.js` - admin role check
- ✅ `services/emailService.js` - отправка email (Resend)

**Frontend:**
- ✅ `LoginPage.tsx` - форма входа/регистрации
- ✅ `VerifyEmailPage.tsx` - верификация email
- ✅ `ChangePasswordPage.tsx` - смена пароля
- ✅ `ForgotPasswordPage.tsx` + `ResetPasswordPage.tsx` - сброс пароля
- ✅ `AuthContext.tsx` - контекст авторизации

**Что это значит:**
- ✅ **Вся авторизация уже работает!**
- ✅ Портал может использовать это как есть
- ✅ Не нужно переписывать

---

### 4. **Админ-панель** ✅

**Backend:**
- ✅ `routes/admin.js` - управление пользователями
- ✅ `utils/auditLogger.js` - логирование действий

**Frontend:**
- ✅ `AdminDashboard.tsx` - админская панель
- ✅ `admin/UserManagement.tsx` - управление пользователями
- ✅ `admin/AuditLogs.tsx` - логи действий
- ✅ `admin/AdminStats.tsx` - статистика

**Что это значит:**
- ✅ **Админка готова!**
- ✅ Портал может использовать это как есть

---

### 5. **OTSKP справочник** ✅

**Backend:**
- ✅ `routes/otskp.js` - поиск кодов (17,904 кодов)

**Frontend:**
- ✅ `OtskpAutocomplete.tsx` - autocomplete поиск

**Что это значит:**
- ✅ **Справочник готов!**
- ✅ Может использоваться и порталом, и киосками

---

### 6. **Инфраструктура** ✅

- ✅ **Database**: PostgreSQL клиент (`db/postgres.js`)
- ✅ **Logging**: Winston logger (`utils/logger.js`)
- ✅ **Error handling**: Global error handler (`utils/errorHandler.js`)
- ✅ **Rate limiting**: Rate limiters (`middleware/rateLimiter.js`)
- ✅ **File cleanup**: Periodic cleanup (`utils/fileCleanup.js`)

---

## ❌ ЧТО НУЖНО ПЕРЕНЕСТИ В КИОСК MONOLIT

Эти компоненты специфичны для монолитного калькулятора:

### Backend
```
❌ routes/monolith-projects.js   → Киоск Monolit
❌ routes/parts.js                → Киоск Monolit
❌ routes/positions.js            → Киоск Monolit
❌ routes/bridges.js              → Киоск Monolit (legacy)
❌ routes/upload.js               → Киоск Monolit
❌ routes/export.js               → Киоск Monolit
❌ routes/snapshots.js            → Киоск Monolit
❌ routes/mapping.js              → Киоск Monolit

❌ services/calculator.js         → Киоск Monolit
❌ services/concreteExtractor.js  → Киоск Monolit
❌ services/parser.js             → Киоск Monolit
❌ services/exporter.js           → Киоск Monolit
❌ services/snapshot.js           → Киоск Monolit
```

### Frontend
```
❌ components/MainApp.tsx         → Киоск Monolit
❌ components/Sidebar.tsx         → Киоск Monolit
❌ components/PositionsTable.tsx  → Киоск Monolit
❌ components/KPIPanel.tsx        → Киоск Monolit
❌ components/PositionRow.tsx     → Киоск Monolit
❌ components/PartHeader.tsx      → Киоск Monolit
❌ components/Create*.tsx         → Киоск Monolit
❌ components/Edit*.tsx           → Киоск Monolit
❌ components/Delete*.tsx         → Киоск Monolit
❌ components/ExportHistory.tsx   → Киоск Monolit
❌ components/WorkTypeSelector.tsx→ Киоск Monolit
❌ context/AppContext.tsx         → Киоск Monolit
```

---

## ⚠️ ЧТО НУЖНО АДАПТИРОВАТЬ

### 1. База данных

**Текущие таблицы:**
```sql
✅ users                    -- Переиспользуем
✅ otskp_codes              -- Переиспользуем
✅ audit_logs               -- Переиспользуем
✅ email_verification_tokens-- Переиспользуем
✅ password_reset_tokens    -- Переиспользуем
✅ documents                -- АДАПТИРУЕМ → portal_files
❌ monolith_projects        -- → Киоск Monolit
❌ parts                    -- → Киоск Monolit
❌ positions                -- → Киоск Monolit
❌ part_templates           -- → Киоск Monolit
❌ snapshots                -- → Киоск Monolit
```

**Новые таблицы для портала:**
```sql
🆕 portal_projects          -- Главная таблица проектов
🆕 portal_files             -- Файлы проектов (адаптация documents)
🆕 kiosk_links              -- Связь портал ↔ киоски
🆕 chat_sessions            -- Чат-сессии
🆕 chat_messages            -- Сообщения чата
```

---

### 2. API

**Нужно создать новые endpoints:**
```javascript
// Проекты портала
POST   /api/portal/projects
GET    /api/portal/projects
GET    /api/portal/projects/:id
PUT    /api/portal/projects/:id
DELETE /api/portal/projects/:id

// Файлы (адаптация /api/documents)
POST   /api/portal/projects/:id/files
GET    /api/portal/projects/:id/files
GET    /api/portal/files/:id/download
DELETE /api/portal/files/:id

// Киоски
POST   /api/portal/projects/:id/kiosks
GET    /api/portal/projects/:id/kiosks
GET    /api/portal/projects/:id/kiosks/:type/open

// CORE Integration
POST   /api/portal/projects/:id/core/submit
GET    /api/portal/projects/:id/core/results
POST   /api/portal/projects/:id/core/accept-to-kiosk

// Чат
POST   /api/portal/chat/sessions
POST   /api/portal/chat/sessions/:id/messages
GET    /api/portal/chat/sessions/:id/messages
```

---

### 3. Frontend

**Нужно создать новые страницы:**
```typescript
🆕 PortalPage.tsx           // Главная страница портала (список проектов)
🆕 ProjectCard.tsx          // Карточка проекта (вкладки: files, kiosks, core, chat)
🆕 KioskSelector.tsx        // Выбор киоска после выбора проекта
🆕 CorePanel.tsx            // Панель для работы с CORE
🆕 ChatPanel.tsx            // Чат-панель StavAgent
🆕 FilesList.tsx            // Список файлов проекта
🆕 KiosksList.tsx           // Список киосков проекта
```

**Адаптировать:**
```typescript
⚠️ Header.tsx              // Убрать специфику Monolit
⚠️ DashboardPage.tsx       // Заменить на PortalPage или упростить
```

---

## 📋 План миграции

### Этап 1: Портал (база)
1. ✅ Создать таблицы БД (`portal_projects`, `portal_files`, `kiosk_links`)
2. ✅ Создать API routes (`portal-projects.js`, `portal-files.js`, `kiosk-links.js`)
3. ✅ Адаптировать `documents.js` → `portal-files.js`
4. ✅ Использовать **готовый** `concreteAgentClient.js`

### Этап 2: Frontend портала
1. ✅ Создать `PortalPage.tsx` (список проектов)
2. ✅ Создать `ProjectCard.tsx` (карточка проекта)
3. ✅ Переиспользовать `DocumentUpload.tsx` + `AnalysisPreview.tsx`
4. ✅ Создать `KioskSelector.tsx`
5. ✅ Создать `CorePanel.tsx` (использует `concreteAgentClient`)

### Этап 3: Чат
1. ✅ Создать таблицы (`chat_sessions`, `chat_messages`)
2. ✅ Создать API (`chat.js`)
3. ✅ Создать `ChatPanel.tsx`

### Этап 4: Вынос Monolit в киоск
1. ✅ Переместить код в `kiosks/monolit/`
2. ✅ Обновить API endpoints (добавить поддержку `portal_project_id`)
3. ✅ Добавить интеграцию с порталом

---

## 🎯 Выводы

### ✅ Что УЖЕ ГОТОВО (можно использовать как есть)

1. **Concrete-Agent клиент** - полностью готов! ✨
2. **Загрузка документов** - готова (нужна небольшая адаптация)
3. **Авторизация** - полностью готова
4. **Админ-панель** - полностью готова
5. **OTSKP справочник** - полностью готов
6. **Email сервис** - готов
7. **Вся инфраструктура** (logger, error handler, rate limiter)

### ⚠️ Что нужно СОЗДАТЬ

1. Таблицы БД портала (portal_projects, portal_files, kiosk_links, chat)
2. API routes для портала
3. Frontend страницы (PortalPage, ProjectCard, KioskSelector)
4. Чат-панель

### ❌ Что нужно ПЕРЕНЕСТИ

1. Весь код Monolit в отдельный киоск-сервис
2. Таблицы БД для Monolit (monolith_projects, parts, positions)

---

## 📊 Статистика

**Готовый код:**
- ✅ Backend services: 2 файла (concreteAgentClient.js, emailService.js)
- ✅ Backend routes: 4 файла (auth.js, admin.js, otskp.js, documents.js)
- ✅ Frontend pages: 7 файлов (Login, Admin, Verify, Change/Forgot/Reset Password, DocumentUpload)
- ✅ Frontend components: 5 файлов (DocumentUpload, AnalysisPreview, admin/*)

**Нужно создать:**
- 🆕 Backend routes: 3 файла (portal-projects.js, portal-files.js, chat.js)
- 🆕 Frontend pages: 3 файла (PortalPage.tsx, ProjectCard.tsx, KioskSelector.tsx)
- 🆕 Frontend components: 3 файла (CorePanel.tsx, ChatPanel.tsx, FilesList.tsx)

**Оценка:** ~70% кода уже готово! 🎉

---

**Последнее обновление:** 2025-11-15
**Статус:** ✅ Анализ завершен
