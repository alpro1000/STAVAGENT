# Registry Rozpočtů - Multi-User Architecture

## Текущее состояние (Single-User)
- ❌ Данные в localStorage браузера
- ❌ Каждый пользователь видит только свои данные
- ❌ Нет синхронизации между пользователями
- ❌ Потеря данных при очистке браузера

## Целевая архитектура (Multi-User)

### 1. Backend API (Node.js + PostgreSQL)
```
rozpocet-registry-backend/
├── server.js
├── routes/
│   ├── projects.js      # CRUD проектов
│   ├── sheets.js        # CRUD листов (SO 201, SO 202)
│   ├── items.js         # CRUD позиций
│   └── tov.js           # CRUD TOV данных
├── db/
│   ├── schema.sql       # Схема БД
│   └── migrations.js
└── middleware/
    └── auth.js          # JWT auth
```

### 2. Database Schema
```sql
-- Проекты Registry
CREATE TABLE registry_projects (
  project_id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  portal_project_id VARCHAR(255) REFERENCES portal_projects(portal_project_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Листы (SO 201, SO 202, etc.)
CREATE TABLE registry_sheets (
  sheet_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES registry_projects(project_id) ON DELETE CASCADE,
  sheet_name VARCHAR(255) NOT NULL,
  sheet_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Позиции
CREATE TABLE registry_items (
  item_id VARCHAR(255) PRIMARY KEY,
  sheet_id VARCHAR(255) NOT NULL REFERENCES registry_sheets(sheet_id) ON DELETE CASCADE,
  kod VARCHAR(50),
  popis TEXT NOT NULL,
  mnozstvi REAL DEFAULT 0,
  mj VARCHAR(20),
  cena_jednotkova REAL,
  cena_celkem REAL,
  item_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TOV данные (Labor, Machinery, Materials)
CREATE TABLE registry_tov (
  tov_id VARCHAR(255) PRIMARY KEY,
  item_id VARCHAR(255) NOT NULL REFERENCES registry_items(item_id) ON DELETE CASCADE,
  tov_type VARCHAR(20) NOT NULL, -- 'labor', 'machinery', 'materials'
  tov_data TEXT NOT NULL, -- JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Права доступа (для совместной работы)
CREATE TABLE registry_permissions (
  permission_id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES registry_projects(project_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'owner', 'editor', 'viewer'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);
```

### 3. API Endpoints

#### Projects
```
GET    /api/registry/projects              # Список проектов пользователя
POST   /api/registry/projects              # Создать проект
GET    /api/registry/projects/:id          # Получить проект
PUT    /api/registry/projects/:id          # Обновить проект
DELETE /api/registry/projects/:id          # Удалить проект
POST   /api/registry/projects/:id/share    # Поделиться проектом
```

#### Sheets
```
GET    /api/registry/projects/:id/sheets   # Листы проекта
POST   /api/registry/projects/:id/sheets   # Создать лист
PUT    /api/registry/sheets/:id            # Обновить лист
DELETE /api/registry/sheets/:id            # Удалить лист
```

#### Items
```
GET    /api/registry/sheets/:id/items      # Позиции листа
POST   /api/registry/sheets/:id/items      # Создать позицию
PUT    /api/registry/items/:id             # Обновить позицию
DELETE /api/registry/items/:id             # Удалить позицию
PATCH  /api/registry/items/:id/tov         # Обновить TOV данные
```

### 4. Real-Time Sync (WebSocket)
```javascript
// Server
io.on('connection', (socket) => {
  socket.on('join-project', (projectId) => {
    socket.join(`project:${projectId}`);
  });
  
  socket.on('item-updated', (data) => {
    io.to(`project:${data.projectId}`).emit('item-changed', data);
  });
});

// Client
socket.on('item-changed', (data) => {
  // Обновить UI без перезагрузки
  updateItemInState(data);
});
```

### 5. Migration Strategy

#### Phase 1: Backend Setup (2-3 часа)
1. Создать `rozpocet-registry-backend` сервис
2. Настроить PostgreSQL схему
3. Реализовать CRUD API
4. Деплой на Render

#### Phase 2: Frontend Integration (2-3 часа)
1. Заменить localStorage на API calls
2. Добавить loading states
3. Обработка ошибок сети
4. Оптимистичные обновления UI

#### Phase 3: Real-Time Sync (1-2 часа)
1. Добавить Socket.io
2. Broadcast изменений
3. Conflict resolution

#### Phase 4: Permissions (1-2 часа)
1. UI для sharing
2. Role-based access control
3. Audit log

### 6. Data Flow

#### Текущий (Single-User)
```
User → Registry Frontend → localStorage → User
```

#### Целевой (Multi-User)
```
User A → Registry Frontend → Registry Backend → PostgreSQL
                                    ↓
User B ← Registry Frontend ← WebSocket ← Registry Backend
```

### 7. Portal Integration

#### Import from Monolit
```
Monolit → Portal API → portal_objects/portal_positions
                ↓
Registry Backend → registry_projects/registry_items
                ↓
Registry Frontend (real-time update)
```

#### Export to Excel
```
Registry Frontend → Registry Backend → Generate XLSX
                                    ↓
                              Return file URL
```

### 8. Deployment

```yaml
# render.yaml
services:
  - type: web
    name: rozpocet-registry-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: stavagent-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
```

### 9. Cost Estimate
- Backend: Free tier Render (спит после 15 мин)
- Database: Shared PostgreSQL (уже есть)
- WebSocket: Free tier Socket.io
- **Total: $0/month** (на Free tier)

### 10. Implementation Priority

**Must Have (MVP):**
1. ✅ Backend CRUD API
2. ✅ PostgreSQL schema
3. ✅ Frontend API integration
4. ✅ Authentication

**Should Have:**
5. ⚠️ Real-time sync (WebSocket)
6. ⚠️ Permissions system

**Nice to Have:**
7. 🔵 Offline mode (Service Worker)
8. 🔵 Conflict resolution UI
9. 🔵 Version history

### 11. Breaking Changes
- ❌ localStorage data НЕ мигрируется автоматически
- ✅ Пользователи должны экспортировать → импортировать
- ✅ Или: одноразовая миграция через API

### 12. Next Steps
1. Создать `rozpocet-registry-backend` репозиторий
2. Скопировать структуру из `stavagent-portal/backend`
3. Реализовать 4 основных endpoint'а (projects, sheets, items, tov)
4. Обновить Registry frontend для работы с API
5. Деплой на Render
6. Тестирование multi-user сценариев
