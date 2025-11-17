# 📊 Анализ наименований в трёх репозиториях StavAgent

**Дата анализа:** 2025-11-17
**Репозитории:**
1. https://github.com/alpro1000/stavagent-portal.git
2. https://github.com/alpro1000/concrete-agent.git
3. https://github.com/alpro1000/Monolit-Planner.git

---

## 🔍 Текущее состояние наименований

### 1️⃣ stavagent-portal

| Уровень | Название | Правильно? | Примечание |
|---------|----------|------------|------------|
| **Root** | `stavagent-portal` | ✅ | Хорошо |
| **Backend** | `@stavagent/backend` | ✅ | Правильный scope |
| **Frontend** | `@monolit/frontend` | ❌ | **НЕПРАВИЛЬНО!** Должно быть `@stavagent/portal-frontend` |
| **Shared** | `@stavagent/shared` | ✅ | Правильный scope |

**Зависимости в Frontend:**
```json
"dependencies": {
  "@monolit/shared": "file:../shared",  // ❌ НЕПРАВИЛЬНО! Должно быть @stavagent/shared
  ...
}
```

**Проблемы:**
1. Frontend package.json использует `@monolit/frontend` вместо `@stavagent/portal-frontend`
2. Frontend ссылается на `@monolit/shared` вместо `@stavagent/shared`
3. Описание в frontend: "Frontend for Monolit Planner" ← устаревшее

---

### 2️⃣ concrete-agent (CORE)

| Уровень | Название | Правильно? | Примечание |
|---------|----------|------------|------------|
| **Root** | _нет package.json_ | ⚠️ | Не монорепозиторий |
| **stav-agent/** | `stav-agent` | ⚠️ | Vite + Express (Frontend+Backend вместе) |
| **frontend/** | `frontend` | ⚠️ | Next.js приложение (отдельное?) |

**Структура:**
```
concrete-agent/
├── stav-agent/          # Основное приложение (Vite + React + Express)
│   ├── package.json     # name: "stav-agent"
│   ├── server.js        # Express backend
│   └── src/            # React frontend (Vite)
│
└── frontend/           # Next.js приложение (непонятно зачем?)
    └── package.json    # name: "frontend"
```

**Проблемы:**
1. Два фронтенда (Vite в stav-agent/ и Next.js в frontend/) - **запутанно!**
2. Название `stav-agent` не содержит упоминания CORE
3. Нет единой структуры (root package.json отсутствует)
4. Scope не используется (`@concrete-agent/...` или `@stavagent/core-...`)

---

### 3️⃣ Monolit-Planner (будущий kiosk-monolit)

| Уровень | Название | Правильно? | Примечание |
|---------|----------|------------|------------|
| **Root** | `monolit-planner` | ⚠️ | Нужно переименовать в `kiosk-monolit` |
| **Backend** | `@monolit/backend` | ⚠️ | Нужно переименовать в `@stavagent/kiosk-monolit-backend` |
| **Frontend** | `@monolit/frontend` | ✅ | Правильно для Kiosk (НО уберём auth/admin) |
| **Shared** | `@monolit/shared` | ⚠️ | Нужно переименовать в `@stavagent/kiosk-monolit-shared` |

**Описание:**
- Root: "Planning and calculation tool for bridge concrete structures in Czech Republic" ← **правильно описывает Kiosk!**

**Проблемы:**
1. Root название `monolit-planner` не соответствует новой архитектуре (должно быть `kiosk-monolit`)
2. Все пакеты используют scope `@monolit` вместо `@stavagent`
3. Backend и Frontend всё ещё содержат Auth/Admin код (нужно удалить)

---

## 🎯 Рекомендуемая структура наименований

### Единый scope: `@stavagent`

Все репозитории должны использовать единый scope `@stavagent` для единообразия.

### 1️⃣ stavagent-portal (Портал)

```
stavagent-portal/
├── package.json                     name: "stavagent-portal"
├── backend/package.json             name: "@stavagent/portal-backend"
├── frontend/package.json            name: "@stavagent/portal-frontend"
└── shared/package.json              name: "@stavagent/portal-shared"
```

**Назначение:** Главный вход, авторизация, управление проектами, координация киосков.

---

### 2️⃣ concrete-agent → stavagent-core (CORE Engine)

**Переименовать репо:** `concrete-agent` → `stavagent-core`

```
stavagent-core/
├── package.json                     name: "stavagent-core"
├── backend/package.json             name: "@stavagent/core-backend"
├── frontend/package.json            name: "@stavagent/core-frontend" (опционально)
└── shared/package.json              name: "@stavagent/core-shared"
```

**Назначение:** Парсинг документов, аудит, TOV, AI enrichment.

**Вопросы:**
- Зачем два фронтенда (stav-agent/ и frontend/)?
- Нужен ли отдельный frontend для CORE, или только API?
- Если нужен UI для CORE - объединить в один frontend

---

### 3️⃣ Monolit-Planner → kiosk-monolit (Kiosk)

**Переименовать репо:** `Monolit-Planner` → `kiosk-monolit`

```
kiosk-monolit/
├── package.json                     name: "kiosk-monolit"
├── backend/package.json             name: "@stavagent/kiosk-monolit-backend"
├── frontend/package.json            name: "@stavagent/kiosk-monolit-frontend"
└── shared/package.json              name: "@stavagent/kiosk-monolit-shared"
```

**Назначение:** Калькулятор бетона для мостов (только расчёты, без auth!).

**Будущие киоски:**
- `kiosk-pump` - @stavagent/kiosk-pump-*
- `kiosk-formwork` - @stavagent/kiosk-formwork-*
- и т.д.

---

## 📋 Сводная таблица всех пакетов

| Репозиторий | Пакет | Текущее название | Правильное название |
|-------------|-------|------------------|---------------------|
| **stavagent-portal** | Root | `stavagent-portal` | ✅ `stavagent-portal` |
| | Backend | `@stavagent/backend` | ⚠️ `@stavagent/portal-backend` |
| | Frontend | `@monolit/frontend` | ❌ `@stavagent/portal-frontend` |
| | Shared | `@stavagent/shared` | ⚠️ `@stavagent/portal-shared` |
| **concrete-agent** | Root | _нет_ | ❌ `stavagent-core` |
| | Main App | `stav-agent` | ❌ `@stavagent/core-backend` |
| | Frontend | `frontend` | ❌ `@stavagent/core-frontend` (?) |
| **Monolit-Planner** | Root | `monolit-planner` | ❌ `kiosk-monolit` |
| | Backend | `@monolit/backend` | ❌ `@stavagent/kiosk-monolit-backend` |
| | Frontend | `@monolit/frontend` | ❌ `@stavagent/kiosk-monolit-frontend` |
| | Shared | `@monolit/shared` | ❌ `@stavagent/kiosk-monolit-shared` |

---

## 🔧 План исправления

### Этап 1: Исправить stavagent-portal ✅ (ПРИОРИТЕТ)

**Файлы для изменения:**

1. **frontend/package.json:**
   ```json
   {
     "name": "@stavagent/portal-frontend",  // было @monolit/frontend
     "description": "Frontend for StavAgent Portal",  // было "Frontend for Monolit Planner"
     "dependencies": {
       "@stavagent/portal-shared": "file:../shared"  // было @monolit/shared
     }
   }
   ```

2. **backend/package.json:**
   ```json
   {
     "name": "@stavagent/portal-backend",  // было @stavagent/backend
     "description": "Backend API for StavAgent Portal"
   }
   ```

3. **shared/package.json:**
   ```json
   {
     "name": "@stavagent/portal-shared",  // было @stavagent/shared
     "description": "Shared types and utilities for StavAgent Portal"
   }
   ```

4. **backend/src/** - изменить все импорты:
   ```javascript
   // Было:
   import { Something } from '@stavagent/shared';
   // Стало:
   import { Something } from '@stavagent/portal-shared';
   ```

5. **frontend/src/** - изменить все импорты аналогично

**Коммит:** "🏷️ Refactor: Rename packages to @stavagent/portal-* scope"

---

### Этап 2: Исправить Monolit-Planner (будущий kiosk-monolit)

**Действия:**

1. **Переименовать репо** на GitHub: `Monolit-Planner` → `kiosk-monolit`

2. **package.json (root):**
   ```json
   {
     "name": "kiosk-monolit",  // было monolit-planner
     "description": "Concrete calculator kiosk for bridges (StavAgent)"
   }
   ```

3. **backend/package.json:**
   ```json
   {
     "name": "@stavagent/kiosk-monolit-backend",
     "description": "Backend for Monolit Kiosk calculator"
   }
   ```

4. **frontend/package.json:**
   ```json
   {
     "name": "@stavagent/kiosk-monolit-frontend",
     "description": "Frontend for Monolit Kiosk calculator"
   }
   ```

5. **shared/package.json:**
   ```json
   {
     "name": "@stavagent/kiosk-monolit-shared",
     "description": "Shared formulas and types for Monolit Kiosk"
   }
   ```

6. **Удалить Portal код:**
   - auth routes
   - admin routes
   - email service
   - auth frontend pages

**Коммит:** "🏷️ Refactor: Rename to kiosk-monolit with @stavagent scope"

---

### Этап 3: Исправить concrete-agent (будущий stavagent-core)

**Вопросы для решения:**

1. **Зачем два фронтенда?**
   - `stav-agent/` - React (Vite) + Express
   - `frontend/` - Next.js

   **Варианты:**
   - A) Оставить только один (какой?)
   - B) Разделить: React для demo/test UI, Next.js для production frontend
   - C) Убрать оба, сделать только API (backend-only)

2. **Структура:**
   - Создать root package.json с workspaces
   - Разделить backend и frontend (если нужен)

3. **Переименовать репо:**
   - GitHub: `concrete-agent` → `stavagent-core`

**Предложенная структура:**

```
stavagent-core/
├── package.json                      # Root workspace
├── backend/
│   └── package.json                  # @stavagent/core-backend
├── frontend/                         # Если нужен UI
│   └── package.json                  # @stavagent/core-frontend
└── shared/
    └── package.json                  # @stavagent/core-shared
```

**Коммит:** "🏷️ Refactor: Restructure to stavagent-core with monorepo"

---

## 🎨 Итоговая архитектура наименований

```
StavAgent System (@stavagent scope)
│
├── stavagent-portal/              (GitHub: stavagent-portal)
│   ├── @stavagent/portal-backend
│   ├── @stavagent/portal-frontend
│   └── @stavagent/portal-shared
│
├── stavagent-core/                (GitHub: concrete-agent → rename)
│   ├── @stavagent/core-backend
│   ├── @stavagent/core-frontend   (опционально)
│   └── @stavagent/core-shared
│
└── Kiosks/
    ├── kiosk-monolit/             (GitHub: Monolit-Planner → rename)
    │   ├── @stavagent/kiosk-monolit-backend
    │   ├── @stavagent/kiosk-monolit-frontend
    │   └── @stavagent/kiosk-monolit-shared
    │
    ├── kiosk-pump/                (будущее)
    │   └── @stavagent/kiosk-pump-*
    │
    └── kiosk-formwork/            (будущее)
        └── @stavagent/kiosk-formwork-*
```

---

## ✅ Чек-лист исправлений

### stavagent-portal:
- [ ] Переименовать `frontend/package.json` → `@stavagent/portal-frontend`
- [ ] Переименовать `backend/package.json` → `@stavagent/portal-backend`
- [ ] Переименовать `shared/package.json` → `@stavagent/portal-shared`
- [ ] Обновить импорты в backend (shared)
- [ ] Обновить импорты в frontend (shared)
- [ ] Обновить описания в package.json
- [ ] Коммит и push

### Monolit-Planner → kiosk-monolit:
- [ ] Переименовать GitHub репо
- [ ] Переименовать root package.json → `kiosk-monolit`
- [ ] Переименовать backend → `@stavagent/kiosk-monolit-backend`
- [ ] Переименовать frontend → `@stavagent/kiosk-monolit-frontend`
- [ ] Переименовать shared → `@stavagent/kiosk-monolit-shared`
- [ ] Удалить auth/admin код
- [ ] Обновить импорты
- [ ] Обновить описания
- [ ] Коммит и push

### concrete-agent → stavagent-core:
- [ ] Решить что делать с двумя фронтендами
- [ ] Создать root package.json с workspaces
- [ ] Реструктурировать в monorepo
- [ ] Переименовать пакеты → `@stavagent/core-*`
- [ ] Переименовать GitHub репо
- [ ] Обновить импорты
- [ ] Коммит и push

---

## 💡 Рекомендация

**Начать с stavagent-portal** (самый простой и важный):
1. Исправить package.json файлы (5 минут)
2. Обновить импорты (find/replace)
3. Коммит и push
4. Протестировать деплой

**Затем Monolit-Planner → kiosk-monolit:**
1. Переименовать репо на GitHub
2. Переименовать пакеты
3. Удалить Portal код (уже сделано)
4. Обновить импорты

**В конце concrete-agent → stavagent-core:**
1. Сначала понять зачем два фронтенда
2. Решить нужен ли UI для CORE
3. Реструктурировать
4. Переименовать репо

---

**Автор:** Claude Code
**Дата:** 2025-11-17
