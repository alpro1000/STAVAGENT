# 📚 STAVAGENT MONOREPO: ПОЛНОЕ РУКОВОДСТВО

**Последнее обновление:** 2024-11-21
**Статус:** Активная разработка (Migration Phase 1)

---

## 🗂️ СТРУКТУРА РЕПОЗИТОРИЯ

Это **монорепозиторий** (monorepo) с тремя основными сервисами + общие пакеты.

### Current Structure (v1.0)

```
STAVAGENT/
│
├── 📦 ОСНОВНЫЕ СЕРВИСЫ (Backend + Frontend):
│
├── Monolit-Planner/
│   ├── backend/              Express.js + SQLite
│   ├── frontend/             Vite + React 18
│   └── shared/               Типы данных
│
├── stavagent-portal/
│   ├── backend/              Express.js + SQLite
│   ├── frontend/             Vite + React 18
│   └── shared/               Типы данных
│
├── concrete-agent/
│   ├── packages/
│   │   ├── core-backend/     FastAPI (Python) ⚠️ Currently Broken
│   │   ├── core-frontend/    Vite + React 18
│   │   └── core-shared/      TypeScript Types
│   └── frontend/             Next.js 16 (wrapper)
│
├── 📚 SHARED PACKAGES (In Development):
│
└── packages/                 (PLANNED - Phase 2)
    ├── shared-types/         ← Unified types (TODO)
    ├── auth/                 ← Shared AuthContext (TODO)
    ├── api-client/           ← Shared API wrapper (TODO)
    ├── ui-components/        ← Shared UI (TODO)
    └── auth-routes/          ← Shared backend routes (TODO)
```

### Planned Structure (v2.0 - After Consolidation)

```
STAVAGENT/
├── packages/
│   ├── shared-types/
│   ├── auth/
│   ├── api-client/
│   ├── ui-components/
│   │   ├── AnalysisPreview        (13,238 LOC currently duplicated)
│   │   ├── OtskpAutocomplete      (5,000 LOC currently duplicated)
│   │   ├── DocumentUpload         (6,500 LOC currently duplicated)
│   │   └── ...
│   ├── auth-routes/
│   └── ...
│
├── Monolit-Planner/               ✅ Fully Functional
│   ├── backend/
│   ├── frontend/
│   └── shared/
│
├── stavagent-portal/              ✅ Fully Functional
│   ├── backend/
│   ├── frontend/
│   └── shared/
│
└── concrete-agent/                ⚠️ Backend Broken (Frontend Not Needed)
```

---

## 🚀 БЫСТРЫЙ СТАРТ

### Локальная разработка

```bash
# Клонирование
git clone https://github.com/alpro1000/STAVAGENT.git
cd STAVAGENT

# Установка зависимостей
npm install

# Запуск (выбрать проект)
npm run dev:monolit        # Monolit-Planner backend + frontend
npm run dev:portal         # stavagent-portal backend + frontend
npm run dev:concrete       # concrete-agent (⚠️ not recommended now)
```

### Деплой на Render

#### Текущая конфигурация (v1.0 - Oct 2024)

```
1. monolit-planner-api
   ├── Repository: alpro1000/STAVAGENT
   ├── Root Directory: Monolit-Planner
   ├── Build: npm install
   └── Start: npm start
   └── URL: https://monolit-planner-api.onrender.com

2. stavagent-portal-backend
   ├── Repository: alpro1000/STAVAGENT
   ├── Root Directory: stavagent-portal
   ├── Build: npm install
   └── Start: npm start
   └── URL: https://stavagent-portal-backend.onrender.com

3. concrete-agent (PAUSED - do not deploy)
   ├── Status: 🔴 Broken
   └── Action: Remove from Render
```

#### старые фронтенды (DEPRECATED - Consider Removing)

```
- monolit-planner-frontend (deprecated)
  └── Using old backend repository
  └── Should be consolidated with backend

- stavagent-portal-frontend (deprecated)
  └── Using old backend repository
  └── Should be consolidated with backend
```

---

## 📋 КАЖДЫЙ СЕРВИС: ЧТО ДЕЛАЕТ

### 🔵 Monolit-Planner

**Назначение:** Калькулятор конструкций монолитных бетонных конструкций (начало разработки с примера мостов)

**Стек:**
- Backend: Express.js (Node.js), SQLite база
- Frontend: Vite + React 18, CSS Modules
- Основной фокус: расчеты, анализ, экспорт в Excel

**Основные функции:**
- ✅ Расчёт позиций монолитных конструкций (мосты, фундаменты, стены, опоры и т.д.)
- ✅ Анализ конструкции (нагрузки, прочность, материалы)
- ✅ Экспорт результатов в Excel
- ✅ Аудит позиций по OTSKP (чешский стандарт)
- ✅ Управление проектами и версионирование
- ✅ Снимки (snapshots) для версионирования расчётов

**Расширяемость:**
- Можно добавлять калькуляторы для новых типов конструкций
- Каждый калькулятор как отдельный маршрут в backend
- Переиспользуются общие компоненты (AnalysisPreview, DocumentUpload, OtskpAutocomplete)

**URL:** https://monolit-planner-api.onrender.com

---

### 🟣 stavagent-portal

**Назначение:** Центральный портал управления проектами и интеграция с CORE

**Стек:**
- Backend: Express.js (Node.js), SQLite база
- Frontend: Vite + React 18, CSS Modules
- Основной фокус: управление, авторизация, интеграция

**Основные функции:**
- ✅ Авторизация пользователей
- ✅ Управление проектами
- ✅ Загрузка документов
- ✅ Интеграция с CORE API
- ✅ Выстраивание на основе concrete-agent

**URL:** https://stavagent-portal-backend.onrender.com

**Интеграция с CORE:**
```
stavagent-portal → CORE_API_URL → concrete-agent
                   (парсинг документов, извлечение данных)
```

---

### 🔵 concrete-agent (ЯДРО СИСТЕМЫ)

**Статус:** ✅ ПОЛНОСТЬЮ РАБОЧИЙ И КРИТИЧНЫЙ

**Назначение:** Ядро системы STAVAGENT - парсеры, ИИ логика, обогащение данных

**Архитектура:**
- **Backend:** FastAPI (Python) - ✅ РАБОЧИЙ И КРИТИЧНЫЙ
  - Парсинг документов (MinerU + Claude API)
  - Извлечение данных из документов
  - Обогащение позиций (enrichment)
  - Heavy ML/AI логика (Anthropic Claude)
  - REST API для других сервисов
  - **Нет фронтенда - это чисто API сервис**

**Интеграция:**
- stavagent-portal → использует CORE_API_URL для парсинга
- Monolit-Planner → может использовать для расширенного анализа
- Входит как `concrete-agent/packages/core-backend/`

**Очень важная часть системы!**
- Без этого нет парсинга документов
- Без этого нет ML обогащения данных
- Это ядро всей AI логики системы

**URL:** (когда деплоится) `https://concrete-agent-xxxxx.onrender.com`

---

## 🔗 КОНТРАКТ ВЗАИМОДЕЙСТВИЯ СЕРВИСОВ

### API Endpoints: Единый стиль

#### Authenticate
```
POST /api/auth/verify
POST /api/auth/me
POST /api/auth/change-password
```

#### Projects Management
```
GET    /api/monolith-projects
POST   /api/monolith-projects
GET    /api/monolith-projects/{id}
PUT    /api/monolith-projects/{id}
DELETE /api/monolith-projects/{id}
```

#### Positions / Bridge Elements
```
GET    /api/positions
POST   /api/positions
PUT    /api/positions/{id}
DELETE /api/positions/{id}
```

#### File Upload
```
POST /api/upload/document
POST /api/upload/image
```

#### OTSKP (Pricing Catalog)
```
GET /api/otskp/search?q=...
GET /api/otskp/{code}
```

---

## 📊 ДУБЛИРОВАНИЕ КОДА (KNOWN ISSUES)

### ⚠️ Frontend Duplication

| Компонент | Monolit | Portal | LOC | Статус |
|-----------|---------|--------|-----|--------|
| AuthContext.tsx | ✓ | ✓ | 100 | 🔴 Identical |
| api.ts (axios wrapper) | ✓ | ✓ | 525 | 🔴 99% identical |
| ProtectedRoute.tsx | ✓ | ✓ | 50 | 🔴 Identical |
| AnalysisPreview.tsx | ✓ | ✓ | 13,238 | 🔴 Identical |
| OtskpAutocomplete.tsx | ✓ | ✓ | 5,000 | 🔴 Identical |
| DocumentUpload.tsx | ✓ | ✓ | 6,562 | 🔴 Identical |

**Total duplicated code: ~31,475 LOC**

### ⚠️ Backend Duplication

| Route | Monolit | Portal | Size | Status |
|-------|---------|--------|------|--------|
| auth.js | ✓ | ✓ | 19 KB | 🔴 100% identical |
| admin.js | ✓ | ✓ | 11 KB | 🔴 100% identical |
| otskp.js | ✓ | ✓ | 12 KB | 🔴 100% identical |

**Total duplicated code: ~42 KB**

---

## 🛠️ РАЗРАБОТКА: ДОБАВИТЬ НОВУЮ ФУНКЦИЮ

### Сценарий: Добавить новый калькулятор (например, Калькулятор крыши)

#### Шаг 1: Backend (Monolit-Planner)

```bash
# Создать новый route файл
touch Monolit-Planner/backend/src/routes/roofing-calc.js
```

```javascript
// Monolit-Planner/backend/src/routes/roofing-calc.js
const express = require('express');
const router = express.Router();

// POST /api/roofing/calculate
router.post('/calculate', (req, res) => {
  const { materials, area, slope } = req.body;

  // Calculate roofing
  const result = calculateRoof(materials, area, slope);

  res.json({
    success: true,
    data: result,
    timestamp: new Date()
  });
});

// GET /api/roofing/materials
router.get('/materials', (req, res) => {
  res.json({
    materials: [
      { id: 1, name: 'Concrete Tile', price: 450 },
      // ...
    ]
  });
});

module.exports = router;
```

```javascript
// Monolit-Planner/backend/src/server.js - добавить route
const roofingCalc = require('./routes/roofing-calc');
app.use('/api/roofing', roofingCalc);
```

#### Шаг 2: Frontend (Monolit-Planner)

```bash
# Создать страницу
touch Monolit-Planner/frontend/src/pages/RoofingCalcPage.tsx
```

```typescript
// Monolit-Planner/frontend/src/pages/RoofingCalcPage.tsx
import React, { useState } from 'react'
import { AnalysisPreview } from '@stavagent/ui-components' // Shared component!
import { api } from '../services/api'

export const RoofingCalcPage: React.FC = () => {
  const [result, setResult] = useState(null)

  const handleCalculate = async (data) => {
    const response = await api.post('/api/roofing/calculate', data)
    setResult(response.data)
  }

  return (
    <div>
      <h1>Расчёт крыши</h1>
      <form onSubmit={handleCalculate}>
        {/* form fields */}
      </form>
      {result && <AnalysisPreview data={result} />}
    </div>
  )
}
```

```typescript
// Monolit-Planner/frontend/src/App.tsx - добавить route
import { RoofingCalcPage } from './pages/RoofingCalcPage'

<Route path="/roofing-calc" element={<RoofingCalcPage />} />
```

#### Шаг 3: Деплой на Render (AUTOMATIC!)

```bash
# Push to GitHub
git add .
git commit -m "Add roofing calculator"
git push origin main

# Render автоматически:
# 1. Видит изменения в Monolit-Planner/
# 2. Запускает Build: npm install
# 3. Запускает Start: npm start
# 4. Сервис обновляется
# 5. Новый роут доступен на https://monolit-planner-api.onrender.com/api/roofing
```

**Результат:** Один push = один деплой = обновлены backend + frontend одновременно! ✅

---

## 🎯 ЕСЛИ НУЖНО ДОБАВИТЬ НОВЫЙ ПОЛНОФУНКЦИОНАЛЬНЫЙ ПРОЕКТ

### Пример: Новый калькулятор для деревообработки

#### Шаг 1: Создать структуру

```bash
mkdir -p woodwork-calc/{backend,frontend,shared}/src
```

#### Шаг 2: Настроить package.json

```json
// woodwork-calc/package.json
{
  "name": "woodwork-calc",
  "version": "1.0.0",
  "workspaces": ["backend", "frontend", "shared"]
}

// woodwork-calc/backend/package.json
{
  "name": "woodwork-calc-backend",
  "type": "module",
  "scripts": { "start": "node src/server.js" }
}

// woodwork-calc/frontend/package.json
{
  "name": "woodwork-calc-frontend",
  "scripts": { "dev": "vite", "build": "vite build" }
}
```

#### Шаг 3: Деплой на Render

```
Render Dashboard → New Web Service
├── Repository: alpro1000/STAVAGENT
├── Root Directory: woodwork-calc
├── Build: npm install
├── Start: npm start
└── Deploy!
```

**Результат:** Новый проект, один сервис, один Render instance! 🎉

---

## 📝 ВАЖНЫЕ ПРАВИЛА ПРИ РАЗРАБОТКЕ

### ✅ ДЕЛАЙ:

1. **Используй shared компоненты** (когда они будут созданы в Phase 2)
   ```typescript
   import { AnalysisPreview } from '@stavagent/ui-components'
   ```

2. **Пиши типы правильно** (TypeScript)
   ```typescript
   interface ProjectData {
     id: string
     name: string
     status: 'draft' | 'completed' | 'archived'
   }
   ```

3. **Коммитируй в правильную ветку**
   ```bash
   git push origin claude/monorepo-migration-011eRD83Euv24KvhYWGjV8Jj
   ```

4. **Документируй новые API endpoints**
   ```typescript
   /**
    * Calculate roofing materials needed
    * @param {Object} data - { materials, area, slope }
    * @returns {Object} { success, data, timestamp }
    */
   router.post('/calculate', ...)
   ```

5. **Тестируй локально перед пушем**
   ```bash
   npm run dev:monolit
   # Visit http://localhost:5173
   ```

### ❌ НЕ ДЕЛАЙ:

1. **Не создавай дублирующийся код!**
   - Если компонент есть в другом проекте, используй shared
   - Если shared компонента нет, добавь её в packages/

2. **Не пушь в main без review**
   - Всегда пушь в branch
   - Создавай PR для review

3. **Не меняй port сервиса** (без уважительной причины)
   - Monolit: port 3001
   - Portal: port 3001 (отдельная БД)
   - Это может сломать интеграцию

4. **Не удаляй package-lock.json**
   - Нужен для воспроизводимых сборок

5. **Не коммитируй .env файлы**
   - Используй .env.example
   - Секреты добавляй в Render Environment variables

---

## 🔐 ОКРУЖЕНИЕ (Environment Variables)

### Monolit-Planner Backend

```env
# .env
NODE_ENV=production
PORT=3001
DB_PATH=./data/monolit.db
CORE_API_URL=https://concrete-agent-xxxxx.onrender.com  # (if needed)
LOG_LEVEL=INFO
```

### stavagent-portal Backend

```env
# .env
NODE_ENV=production
PORT=3001
DB_PATH=./data/stavagent-portal.db
CORE_API_URL=https://concrete-agent-xxxxx.onrender.com  # for document parsing
JWT_SECRET=your-super-secret-key
UPLOAD_DIR=./uploads
```

### Frontend (Both)

```env
# .env
VITE_API_URL=http://localhost:3001  # dev
VITE_API_URL=https://monolit-planner-api.onrender.com  # prod
```

---

## 📚 ДОКУМЕНТАЦИЯ

Читай эти файлы для глубокого понимания:

1. **STAVAGENT_ARCHITECTURE.md** — техническая архитектура
2. **STAVAGENT_CONTRACT.md** — контракт между сервисами
3. **MIGRATION_ROADMAP.md** — план консолидации (Phase 1-4)
4. **API_ENDPOINTS.md** — полный список API (TODO)

---

## 🐛 TROUBLESHOOTING

### Проблема: "Cannot find module '@stavagent/auth'"

**Решение:**
```bash
# packages/auth/ ещё не создана
# Используй локальный AuthContext до Phase 2
import { AuthContext } from '../context/AuthContext'
```

### Проблема: "CORS error from portal to API"

**Проверь:**
```javascript
// backend/src/server.js
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://stavagent-portal-backend.onrender.com',
    'https://monolit-planner-api.onrender.com'
  ]
}))
```

### Проблема: "Render deploy failed"

**Проверь логи:**
1. Render Dashboard → Service → Logs
2. Ищи "Build failed" и сообщение об ошибке
3. Обычно: неправильный Root Directory или неправильная команда

**Решение:**
```
Root Directory: Monolit-Planner  (без слэшей!)
Build Command: npm install       (не yarn install)
Start Command: npm start         (не node server.js)
```

---

## 🚀 БЫСТРЫЕ КОМАНДЫ

```bash
# Локальная разработка
npm install                    # Установить всё
npm run dev:monolit           # Запустить Monolit backend + frontend
npm run dev:portal            # Запустить Portal backend + frontend

# Git
git push origin main                           # Push в main
git push -u origin branch-name                # Push в новую ветку
git pull origin main                          # Pull latest changes

# Render Deploy (automatic on git push)
# Просто push → Render автоматически делает:
# 1. Видит изменения
# 2. Запускает Build: npm install
# 3. Запускает Start: npm start
# 4. Сервис обновляется
```

---

## 📞 КОНТАКТЫ И ССЫЛКИ

```
GitHub:     https://github.com/alpro1000/STAVAGENT
Render:     https://dashboard.render.com
Monolit:    https://monolit-planner-api.onrender.com
Portal:     https://stavagent-portal-backend.onrender.com
```

---

## 📅 МИГРАЦИЯ И ПЛАНЫ

### Phase 1: ✅ DONE (Nov 2024)
- ✅ Создан монорепо STAVAGENT
- ✅ Все три сервиса добавлены как git subtree
- ✅ История коммитов сохранена
- ✅ Оба backend сервиса деплоятся на Render

### Phase 2: 🔄 IN PROGRESS (Dec 2024)
- 🟡 Создать packages/ с shared кодом
- 🟡 Консолидировать типы
- 🟡 Консолидировать компоненты
- Статус: Планирование

### Phase 3: ⏳ UPCOMING (Jan 2025)
- Стандартизировать UI фреймворк (Tailwind + Radix)
- Стандартизировать state management (Zustand)
- Удалить дублирующийся код

### Phase 4: ⏳ FUTURE (Q1 2025)
- Полная консолидация backend
- Единая БД (PostgreSQL)
- Один CI/CD pipeline

---

**Last Updated:** 2024-11-21
**Next Review:** 2024-12-01
