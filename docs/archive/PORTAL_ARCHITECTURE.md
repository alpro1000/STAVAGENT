# 🏛️ Архитектура Портала

## Обзор

**Портал** - главный вход в систему. Он НЕ калькулятор, а диспетчер:
- Авторизация пользователей
- Управление проектами (создание, список, карточка)
- Загрузка исходных файлов (ТЗ, смета, чертежи)
- Маршрутизация к киоскам (Monolit, Pump, Formwork...)
- Интеграция с Ядром (Concrete-Agent CORE)
- Чат-ассистент StavAgent

---

## 🗄️ База данных Портала

### 1. Таблица `portal_projects`

**Главная таблица проектов в системе.**

```sql
CREATE TABLE portal_projects (
  portal_project_id TEXT PRIMARY KEY,      -- UUID (главный ID во всей системе)

  -- Основная информация
  project_name TEXT NOT NULL,              -- "Мост Starý Rožmitál"
  project_type TEXT,                       -- 'bridge', 'building', 'road', 'reconstruction'
  description TEXT,
  location TEXT,                           -- "Starý Rožmitál, Příbram"

  -- Владелец
  owner_id INTEGER NOT NULL,               -- REFERENCES users(id)

  -- Статусы
  status TEXT DEFAULT 'active',            -- 'active', 'in_progress', 'completed', 'archived'

  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Связи с внешними системами
  core_project_id TEXT,                    -- ID в Concrete-Agent CORE (если отправлен)
  core_status TEXT,                        -- 'not_sent', 'processing', 'completed', 'error'
  core_audit_result TEXT,                  -- 'GREEN', 'AMBER', 'RED' (из CORE)
  core_last_sync TIMESTAMP,

  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_portal_projects_owner ON portal_projects(owner_id);
CREATE INDEX idx_portal_projects_type ON portal_projects(project_type);
CREATE INDEX idx_portal_projects_status ON portal_projects(status);
```

---

### 2. Таблица `portal_files`

**Хранит все загруженные файлы проекта.**

```sql
CREATE TABLE portal_files (
  file_id TEXT PRIMARY KEY,                -- UUID
  portal_project_id TEXT NOT NULL,

  -- Информация о файле
  file_name TEXT NOT NULL,                 -- "VV_most.xlsx"
  file_type TEXT NOT NULL,                 -- 'vv', 'tz', 'drawing', 'smeta', 'other'
  mime_type TEXT,                          -- 'application/pdf', 'application/vnd.ms-excel'
  file_size INTEGER,                       -- bytes

  -- Хранение
  storage_path TEXT NOT NULL,              -- "/uploads/2025/11/uuid.xlsx"
  storage_url TEXT,                        -- URL для скачивания (если S3/external)

  -- Метаданные
  uploaded_by INTEGER,                     -- user_id
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Обработка
  processed BOOLEAN DEFAULT false,         -- Был ли обработан CORE/киосками
  processing_status TEXT,                  -- 'pending', 'processing', 'completed', 'error'
  processing_result JSON,                  -- Результаты обработки

  FOREIGN KEY (portal_project_id) REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE INDEX idx_portal_files_project ON portal_files(portal_project_id);
CREATE INDEX idx_portal_files_type ON portal_files(file_type);
```

---

### 3. Таблица `kiosk_links`

**Связь проекта портала с проектами в киосках.**

```sql
CREATE TABLE kiosk_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_project_id TEXT NOT NULL,

  -- Идентификация киоска
  kiosk_type TEXT NOT NULL,                -- 'monolit', 'pump', 'formwork', 'earthworks'
  kiosk_project_id TEXT NOT NULL,          -- ID проекта В киоске

  -- Статус
  status TEXT DEFAULT 'active',            -- 'active', 'synced', 'outdated', 'disabled'

  -- Метаданные
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP,
  sync_direction TEXT,                     -- 'portal_to_kiosk', 'kiosk_to_portal', 'bidirectional'

  -- Дополнительные данные
  metadata JSON,                           -- Любые доп. данные для синхронизации

  FOREIGN KEY (portal_project_id) REFERENCES portal_projects(portal_project_id) ON DELETE CASCADE,
  UNIQUE(portal_project_id, kiosk_type)    -- Один проект → один киоск одного типа
);

CREATE INDEX idx_kiosk_links_portal ON kiosk_links(portal_project_id);
CREATE INDEX idx_kiosk_links_type ON kiosk_links(kiosk_type);
```

**Примеры данных:**
```json
[
  {
    "portal_project_id": "proj_abc123",
    "kiosk_type": "monolit",
    "kiosk_project_id": "SO201",
    "status": "active"
  },
  {
    "portal_project_id": "proj_abc123",
    "kiosk_type": "pump",
    "kiosk_project_id": "pump_12",
    "status": "active"
  }
]
```

---

### 4. Таблица `chat_sessions` (для StavAgent)

**Чат-сессии пользователей.**

```sql
CREATE TABLE chat_sessions (
  session_id TEXT PRIMARY KEY,             -- UUID
  user_id INTEGER NOT NULL,
  portal_project_id TEXT,                  -- NULL = общий чат, не привязан к проекту

  -- Метаданные
  session_name TEXT,                       -- "Помощь по мосту Starý Rožmitál"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Статус
  status TEXT DEFAULT 'active',            -- 'active', 'archived'

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (portal_project_id) REFERENCES portal_projects(portal_project_id) ON DELETE SET NULL
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_project ON chat_sessions(portal_project_id);
```

---

### 5. Таблица `chat_messages`

**Сообщения в чате.**

```sql
CREATE TABLE chat_messages (
  message_id TEXT PRIMARY KEY,             -- UUID
  session_id TEXT NOT NULL,

  -- Роль и содержание
  role TEXT NOT NULL,                      -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,

  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Метаданные
  metadata JSON,                           -- Контекст (упоминание файлов, киосков и т.д.)

  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
```

---

## 🔌 API Портала

### Проекты

```javascript
// Создать проект
POST /api/portal/projects
Body: {
  project_name: "Мост Starý Rožmitál",
  project_type: "bridge",
  description: "Реконструкция моста",
  location: "Starý Rožmitál"
}
Response: {
  portal_project_id: "proj_abc123",
  ...
}

// Список проектов пользователя
GET /api/portal/projects
Response: [
  {
    portal_project_id: "proj_abc123",
    project_name: "Мост Starý Rožmitál",
    project_type: "bridge",
    status: "active",
    kiosks: ["monolit", "pump"],
    core_status: "completed",
    core_audit_result: "GREEN"
  }
]

// Детали проекта
GET /api/portal/projects/:portal_project_id
Response: {
  portal_project_id: "proj_abc123",
  project_name: "...",
  files: [...],
  kiosks: {
    monolit: { kiosk_project_id: "SO201", status: "active" },
    pump: { kiosk_project_id: "pump_12", status: "active" }
  },
  core: {
    core_project_id: "core_xyz",
    status: "completed",
    audit_result: "GREEN"
  }
}
```

---

### Файлы

```javascript
// Загрузить файл
POST /api/portal/projects/:portal_project_id/files
Form-data: {
  file: File,
  file_type: "vv" | "tz" | "drawing" | "smeta"
}
Response: {
  file_id: "file_def456",
  file_name: "VV_most.xlsx",
  storage_url: "/uploads/..."
}

// Список файлов проекта
GET /api/portal/projects/:portal_project_id/files
Response: [
  {
    file_id: "file_def456",
    file_name: "VV_most.xlsx",
    file_type: "vv",
    file_size: 125000,
    uploaded_at: "2025-11-15T10:30:00Z",
    storage_url: "/uploads/..."
  }
]

// Скачать файл
GET /api/portal/files/:file_id/download
Response: File stream
```

---

### Киоски

```javascript
// Подключить киоск к проекту
POST /api/portal/projects/:portal_project_id/kiosks
Body: {
  kiosk_type: "monolit",
  kiosk_project_id: "SO201"  // ID проекта В киоске
}
Response: {
  link_id: 123,
  status: "active"
}

// Список киосков проекта
GET /api/portal/projects/:portal_project_id/kiosks
Response: [
  {
    kiosk_type: "monolit",
    kiosk_project_id: "SO201",
    status: "active",
    last_sync: "2025-11-15T12:00:00Z"
  }
]

// Открыть киоск (редирект)
GET /api/portal/projects/:portal_project_id/kiosks/:kiosk_type/open
Response: {
  redirect_url: "https://monolit-kiosk.onrender.com/projects/SO201?token=..."
}
```

---

### CORE Integration

```javascript
// Отправить проект в CORE
POST /api/portal/projects/:portal_project_id/core/submit
Body: {
  workflow: "workflow-a",  // или "workflow-b"
  file_ids: ["file_def456", "file_ghi789"]
}
Response: {
  core_project_id: "core_xyz",
  status: "processing",
  job_id: "job_123"
}

// Получить результаты CORE
GET /api/portal/projects/:portal_project_id/core/results
Response: {
  core_project_id: "core_xyz",
  status: "completed",
  audit_result: "GREEN",
  positions: [...],
  materials: {...},
  warnings: [...]
}

// Принять результаты CORE в киоск
POST /api/portal/projects/:portal_project_id/core/accept-to-kiosk
Body: {
  kiosk_type: "monolit",
  positions: [...]  // Какие позиции принять
}
Response: {
  accepted_count: 15,
  kiosk_project_id: "SO201"
}
```

---

### Чат

```javascript
// Создать чат-сессию
POST /api/portal/chat/sessions
Body: {
  portal_project_id: "proj_abc123",  // или null для общего чата
  session_name: "Помощь по мосту"
}
Response: {
  session_id: "chat_session_123",
  ...
}

// Отправить сообщение
POST /api/portal/chat/sessions/:session_id/messages
Body: {
  content: "Как отправить проект в CORE?"
}
Response: {
  message_id: "msg_456",
  role: "user",
  content: "...",
  assistant_response: {
    message_id: "msg_457",
    role: "assistant",
    content: "Чтобы отправить проект в CORE..."
  }
}

// История чата
GET /api/portal/chat/sessions/:session_id/messages
Response: [
  { message_id: "msg_456", role: "user", content: "..." },
  { message_id: "msg_457", role: "assistant", content: "..." }
]
```

---

## 🎨 Frontend Портала

### Структура страниц

```
/login                    - Авторизация (уже есть)
/register                 - Регистрация (уже есть)

/portal                   - Главная страница портала
  /portal/projects        - Список проектов
  /portal/projects/new    - Создать проект
  /portal/projects/:id    - Карточка проекта
    /files                - Вкладка: файлы
    /kiosks               - Вкладка: киоски
    /core                 - Вкладка: CORE анализ
    /chat                 - Вкладка: чат StavAgent

/kiosk-selector          - Выбор киоска (после выбора проекта)

/admin                   - Админка (уже есть)
```

---

### Компоненты Портала

```typescript
// Главная страница портала
PortalPage.tsx
  ├─ ProjectList.tsx          // Список проектов с фильтрами
  └─ CreateProjectButton.tsx

// Карточка проекта
ProjectCard.tsx
  ├─ ProjectHeader.tsx        // Название, статус, CORE статус
  ├─ FilesList.tsx            // Загруженные файлы
  ├─ KiosksList.tsx           // Подключенные киоски
  ├─ CoreIntegration.tsx      // Кнопки отправки в CORE, результаты
  └─ ChatPanel.tsx            // Чат-панель

// Выбор киоска
KioskSelector.tsx
  ├─ KioskCard (Monolit)      // Карточка киоска Monolit
  ├─ KioskCard (Pump)         // Карточка киоска Pump
  ├─ KioskCard (Formwork)     // Карточка киоска Formwork
  └─ ...                      // Другие киоски

// Загрузка файлов
FileUpload.tsx
  ├─ Drag-drop zone
  ├─ Выбор типа файла (VV, TZ, Drawing, Smeta)
  └─ Прогресс загрузки

// CORE интеграция
CorePanel.tsx
  ├─ SubmitToCoreButton       // Кнопка отправки
  ├─ CoreStatus               // Статус обработки
  ├─ AuditResults             // GREEN/AMBER/RED
  └─ AcceptPositionsButton    // Принять в киоск

// Чат
ChatPanel.tsx
  ├─ MessageList              // История сообщений
  ├─ MessageInput             // Ввод сообщения
  └─ ContextInfo              // Контекст (файлы, киоски)
```

---

## 🔄 Сценарии работы

### Сценарий 1: Создание проекта и отправка в CORE

```
1. Пользователь логинится → /portal
2. Нажимает "Создать проект"
3. Заполняет:
   - Название: "Мост Starý Rožmitál"
   - Тип: Bridge
   - Описание: "Реконструкция моста"
4. Создается portal_project_id: "proj_abc123"
5. Загружает файлы:
   - VV_most.xlsx (type: vv)
   - TZ_most.pdf (type: tz)
   - Drawing_01.pdf (type: drawing)
6. Нажимает "Отправить в CORE" → выбирает файлы
7. CORE обрабатывает → возвращает:
   - Audit: GREEN
   - Positions: 150 строк
   - Бетонные работы: 35 строк
8. Пользователь видит результаты
9. Нажимает "Принять в киоск Monolit"
10. Система создает:
    - Проект в киоске Monolit (kiosk_project_id: "SO201")
    - Заполняет таблицу 35 бетонными работами
11. Нажимает "Открыть киоск Monolit"
12. Редирект на https://monolit-kiosk.onrender.com/projects/SO201
```

---

### Сценарий 2: Работа с киоском

```
1. Пользователь в карточке проекта
2. Видит список киосков:
   - Monolit: SO201 (active)
   - Pump: pump_12 (active)
3. Нажимает на "Monolit"
4. Редирект на киоск Monolit:
   - URL: https://monolit-kiosk.onrender.com/projects/SO201
   - Token передается автоматически
5. Киоск Monolit:
   - Загружает свой проект SO201
   - Показывает таблицу бетонных работ
   - Пользователь редактирует, добавляет позиции
6. При необходимости:
   - Киоск может запросить у портала список файлов
   - GET /api/portal/projects/proj_abc123/files
```

---

### Сценарий 3: Чат StavAgent

```
1. Пользователь в карточке проекта
2. Открывает вкладку "Чат"
3. Вводит: "Как отправить проект в CORE?"
4. Чат:
   - Знает, что portal_project_id = "proj_abc123"
   - Знает, что есть 3 файла (VV, TZ, Drawing)
   - Видит статус CORE: "not_sent"
5. Отвечает:
   "Чтобы отправить проект в CORE:
   1. Перейдите на вкладку 'CORE'
   2. Нажмите 'Отправить в CORE'
   3. Выберите файлы: VV_most.xlsx, TZ_most.pdf
   4. Нажмите 'Запустить анализ'

   У вас есть все необходимые файлы."
```

---

## 📋 Миграция существующего кода

### Что переименовать

**Текущая структура:**
```
Monolit-Planner/
├─ backend/
│  ├─ src/routes/
│  │  ├─ auth.js ..................... ✅ Остается (портал использует)
│  │  ├─ monolith-projects.js ........ ❌ Переносится в киоск Monolit
│  │  ├─ parts.js .................... ❌ Переносится в киоск Monolit
│  │  ├─ positions.js ................ ❌ Переносится в киоск Monolit
│  │  ├─ otskp.js .................... ✅ Остается (общий справочник)
│  │  └─ admin.js .................... ✅ Остается (портал использует)
```

**Новая структура:**
```
Monolit-System/
├─ portal/                           ← НОВЫЙ сервис
│  ├─ backend/
│  │  ├─ routes/
│  │  │  ├─ auth.js               (из старого)
│  │  │  ├─ portal-projects.js    (НОВЫЙ)
│  │  │  ├─ portal-files.js       (НОВЫЙ)
│  │  │  ├─ kiosk-links.js        (НОВЫЙ)
│  │  │  ├─ core-integration.js   (НОВЫЙ)
│  │  │  ├─ chat.js               (НОВЫЙ)
│  │  │  ├─ otskp.js              (из старого)
│  │  │  └─ admin.js              (из старого)
│  │  └─ db/
│  │     └─ migrations.js         (новые таблицы)
│  └─ frontend/
│     ├─ pages/
│     │  ├─ PortalPage.tsx        (НОВЫЙ)
│     │  ├─ ProjectCard.tsx       (НОВЫЙ)
│     │  └─ KioskSelector.tsx     (НОВЫЙ)
│     └─ components/
│        ├─ FileUpload.tsx        (НОВЫЙ)
│        ├─ CorePanel.tsx         (НОВЫЙ)
│        └─ ChatPanel.tsx         (НОВЫЙ)
│
├─ kiosks/
│  ├─ monolit/                      ← Переименованный Monolit-Planner
│  │  ├─ backend/
│  │  │  └─ routes/
│  │  │     ├─ monolith-projects.js
│  │  │     ├─ parts.js
│  │  │     └─ positions.js
│  │  └─ frontend/
│  │     └─ ...
│  │
│  ├─ pump/                         ← НОВЫЙ киоск
│  ├─ formwork/                     ← НОВЫЙ киоск
│  └─ earthworks/                   ← НОВЫЙ киоск
│
└─ concrete-agent/                  ← Уже существует
   └─ (CORE)
```

---

## 🚀 План реализации

### Этап 1: Создание базы Портала (1-2 дня)
- [ ] Создать таблицы БД (portal_projects, portal_files, kiosk_links)
- [ ] Создать миграции
- [ ] Создать API endpoints для проектов
- [ ] Создать API endpoints для файлов

### Этап 2: Frontend Портала (2-3 дня)
- [ ] PortalPage (список проектов)
- [ ] ProjectCard (карточка проекта)
- [ ] FileUpload (загрузка файлов)
- [ ] KioskSelector (выбор киоска)

### Этап 3: Интеграция CORE (2-3 дня)
- [ ] CorePanel (UI для отправки в CORE)
- [ ] API для отправки в CORE
- [ ] API для получения результатов CORE
- [ ] Accept positions to kiosk

### Этап 4: Чат StavAgent (2-3 дня)
- [ ] Таблицы БД (chat_sessions, chat_messages)
- [ ] API для чата
- [ ] ChatPanel (UI)
- [ ] Интеграция с Claude AI

### Этап 5: Вынос Monolit в киоск (1-2 дня)
- [ ] Переименовать структуру
- [ ] Обновить API endpoints
- [ ] Добавить portal_project_id в киоске
- [ ] Интеграция с порталом

---

## ✅ Критерии готовности

### Портал готов, когда:
- [x] Можно создать проект
- [x] Можно загрузить файлы
- [x] Можно отправить в CORE
- [x] Можно открыть киоск
- [x] Можно общаться в чате
- [x] Все ID соответствия работают

---

**Последнее обновление:** 2025-11-15
**Статус:** 🚧 В разработке
