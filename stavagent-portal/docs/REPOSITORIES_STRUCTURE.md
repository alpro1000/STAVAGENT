# 🗂️ Структура репозиториев StavAgent

**Дата:** 2025-11-15
**Статус:** 📋 План

---

## 🎯 Принцип: Один сервис = Один репозиторий

**Почему НЕ сливать репозитории:**
- ✅ Независимое развитие сервисов
- ✅ Разные команды могут работать параллельно
- ✅ Разный деплоймент (Portal на Vercel, Киоски на Render, CORE на своем)
- ✅ AI видит только один репо за раз (упрощает работу)
- ✅ Разные версии и релизы
- ✅ Четкое разделение ответственности

---

## 📦 Текущие репозитории

### 1. ✅ Monolit-Planner (текущий)
```
Репо: https://github.com/alpro1000/Monolit-Planner
Статус: ✅ Существует
Что содержит СЕЙЧАС:
  - Backend (Express + PostgreSQL)
  - Frontend (React + TypeScript)
  - Auth система
  - Admin панель
  - OTSKP справочник (17,904 кодов)
  - MonolithProjects API (киоск Monolit)
  - Документы (CORE integration уже частично есть)
```

**⚠️ ПРОБЛЕМА:** Смешано всё:
- Портал + Киоск Monolit + общие компоненты

---

### 2. ✅ Concrete-Agent (CORE)
```
Репо: https://github.com/alpro1000/concrete-agent
Статус: ✅ Существует
URL: https://concrete-agent-3uxelthc4q-ey.a.run.app
Tech: Python + FastAPI
Что содержит:
  - Workflow A (парсинг документов)
  - Workflow B (анализ чертежей)
  - Knowledge Base (B1-B9)
  - Multi-role аудит
  - AI обогащение
  - Калькуляторы
```

**✅ ХОРОШО:** Уже отдельный репо, работает независимо

---

## 🆕 Новая структура репозиториев

### Схема

```
┌─────────────────────────────────────────────────┐
│  stavagent-spec (новый, опционально)            │
│  └─ STAVAGENT_CONTRACT.md (эталон)              │
└─────────────────────────────────────────────────┘
                     ↓ (копируется во все репо)
         ┌───────────┴──────────┬──────────────────┐
         ↓                      ↓                   ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  stavagent-portal│  │ kiosk-monolit    │  │ concrete-agent   │
│  (новый)         │  │ (из текущего)    │  │ (существует)     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         ↓
    ┌────┴─────┬──────────┬───────────┐
    ↓          ↓          ↓           ↓
kiosk-pump  kiosk-formwork  kiosk-earthworks  ...
(будущие киоски)
```

---

## 📋 План миграции

### ✅ Этап 1: Создать репо для Портала (СЕЙЧАС)

**Репо:** `stavagent-portal`
```
URL: https://github.com/alpro1000/stavagent-portal
Deployment: https://portal.stavagent.com (или Vercel)
```

**Структура:**
```
stavagent-portal/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js              ← из Monolit-Planner
│   │   │   ├── admin.js             ← из Monolit-Planner
│   │   │   ├── otskp.js             ← из Monolit-Planner
│   │   │   ├── portal-projects.js   ← НОВЫЙ
│   │   │   ├── portal-files.js      ← адаптация documents.js
│   │   │   ├── kiosk-links.js       ← НОВЫЙ
│   │   │   └── chat.js              ← НОВЫЙ
│   │   ├── services/
│   │   │   ├── concreteAgentClient.js ← из Monolit-Planner
│   │   │   └── emailService.js      ← из Monolit-Planner
│   │   ├── middleware/
│   │   │   ├── auth.js              ← из Monolit-Planner
│   │   │   ├── adminOnly.js         ← из Monolit-Planner
│   │   │   └── rateLimiter.js       ← из Monolit-Planner
│   │   └── db/
│   │       └── migrations.js        ← новые таблицы портала
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        ← из Monolit-Planner
│   │   │   ├── DashboardPage.tsx    ← адаптировать
│   │   │   ├── AdminDashboard.tsx   ← из Monolit-Planner
│   │   │   ├── PortalPage.tsx       ← НОВЫЙ (главная)
│   │   │   ├── ProjectCard.tsx      ← НОВЫЙ
│   │   │   └── DocumentUploadPage.tsx ← из Monolit-Planner
│   │   ├── components/
│   │   │   ├── KioskSelector.tsx    ← НОВЫЙ
│   │   │   ├── CorePanel.tsx        ← НОВЫЙ
│   │   │   ├── ChatPanel.tsx        ← НОВЫЙ
│   │   │   ├── FilesList.tsx        ← НОВЫЙ
│   │   │   ├── DocumentUpload.tsx   ← из Monolit-Planner
│   │   │   ├── AnalysisPreview.tsx  ← из Monolit-Planner
│   │   │   └── admin/               ← из Monolit-Planner
│   │   └── context/
│   │       └── AuthContext.tsx      ← из Monolit-Planner
│   └── vite.config.ts
│
├── docs/
│   ├── STAVAGENT_CONTRACT.md        ← копия из spec
│   ├── PORTAL_ARCHITECTURE.md       ← из Monolit-Planner
│   └── README.md
│
├── package.json
└── .env.example
```

**Что копируется из Monolit-Planner:**
- ✅ Auth система (routes/auth.js, middleware/auth.js)
- ✅ Admin панель (routes/admin.js, components/admin/*)
- ✅ OTSKP справочник (routes/otskp.js)
- ✅ concreteAgentClient.js (CORE клиент)
- ✅ documents.js (адаптировать → portal-files.js)
- ✅ emailService.js
- ✅ Frontend auth pages (LoginPage, VerifyEmail, etc.)

**Что создается НОВОЕ:**
- 🆕 portal-projects.js
- 🆕 kiosk-links.js
- 🆕 chat.js
- 🆕 PortalPage.tsx
- 🆕 ProjectCard.tsx
- 🆕 KioskSelector.tsx
- 🆕 CorePanel.tsx
- 🆕 ChatPanel.tsx

---

### ✅ Этап 2: Вынести киоск Monolit в отдельный репо

**Репо:** `kiosk-monolit`
```
URL: https://github.com/alpro1000/kiosk-monolit
Deployment: https://monolit.stavagent.com
```

**Структура:**
```
kiosk-monolit/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── monolith-projects.js ← из Monolit-Planner
│   │   │   ├── parts.js             ← из Monolit-Planner
│   │   │   ├── positions.js         ← из Monolit-Planner
│   │   │   ├── export.js            ← из Monolit-Planner
│   │   │   ├── snapshots.js         ← из Monolit-Planner
│   │   │   └── portal-integration.js ← НОВЫЙ (handshake с порталом)
│   │   ├── services/
│   │   │   ├── calculator.js        ← из Monolit-Planner
│   │   │   ├── concreteExtractor.js ← из Monolit-Planner
│   │   │   ├── parser.js            ← из Monolit-Planner
│   │   │   └── exporter.js          ← из Monolit-Planner
│   │   └── db/
│   │       └── migrations.js        ← таблицы Monolit
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MainApp.tsx          ← из Monolit-Planner
│   │   │   ├── Sidebar.tsx          ← из Monolit-Planner
│   │   │   ├── PositionsTable.tsx   ← из Monolit-Planner
│   │   │   ├── KPIPanel.tsx         ← из Monolit-Planner
│   │   │   └── ...                  ← все Monolit компоненты
│   │   └── context/
│   │       └── AppContext.tsx       ← из Monolit-Planner
│   └── vite.config.ts
│
├── docs/
│   ├── STAVAGENT_CONTRACT.md        ← копия из spec
│   └── README.md
│
└── package.json
```

**Что переносится из Monolit-Planner:**
- ✅ Все routes для Monolit (monolith-projects, parts, positions)
- ✅ Все services (calculator, parser, exporter)
- ✅ Весь frontend (MainApp, Sidebar, PositionsTable)
- ✅ Таблицы БД (monolith_projects, parts, positions)

**Что добавляется НОВОЕ:**
- 🆕 portal-integration.js (handshake с порталом)
- 🆕 Поддержка portal_project_id в API

---

### ✅ Этап 3: Обновить concrete-agent

**Репо:** `concrete-agent` (уже существует)
```
URL: https://github.com/alpro1000/concrete-agent
Статус: ✅ Уже существует, только добавить контракт
```

**Что добавить:**
```
concrete-agent/
├── docs/
│   └── STAVAGENT_CONTRACT.md        ← копия из spec
└── ... (остальное не трогаем)
```

---

### 🔮 Этап 4: Создать репо для других киосков (будущее)

**Киоск Pump:**
```
Репо: https://github.com/alpro1000/kiosk-pump
Deployment: https://pump.stavagent.com
```

**Киоск Formwork:**
```
Репо: https://github.com/alpro1000/kiosk-formwork
Deployment: https://formwork.stavagent.com
```

**Киоск Earthworks:**
```
Репо: https://github.com/alpro1000/kiosk-earthworks
Deployment: https://earthworks.stavagent.com
```

---

## 📝 Опционально: Репо для контракта

**Репо:** `stavagent-spec` (опционально)
```
URL: https://github.com/alpro1000/stavagent-spec
Назначение: Хранение эталонного контракта
```

**Структура:**
```
stavagent-spec/
├── STAVAGENT_CONTRACT.md     ← эталон
├── README.md
└── CHANGELOG.md              ← история изменений контракта
```

**Плюсы:**
- ✅ Один источник правды для контракта
- ✅ История изменений контракта
- ✅ Можно делать PR для изменения контракта

**Минусы:**
- ❌ Нужно синхронизировать копии во все репо
- ❌ Еще один репо для управления

**Альтернатива:**
- Держать эталон в `stavagent-portal/docs/STAVAGENT_CONTRACT.md`
- Копировать вручную в другие репо при изменении

---

## 🔄 Процесс работы

### Когда работаешь с AI (Claude Code):

#### 1. Открываешь один репо за раз

```bash
# Работа с Порталом
cd ~/stavagent-portal
code .
# AI видит: STAVAGENT_CONTRACT.md в docs/
# Говоришь: "Работай строго по контракту в docs/STAVAGENT_CONTRACT.md"
```

```bash
# Работа с Monolit
cd ~/kiosk-monolit
code .
# AI видит: STAVAGENT_CONTRACT.md в docs/
# Говоришь: "Реализуй portal-integration.js по контракту"
```

```bash
# Работа с CORE
cd ~/concrete-agent
code .
# AI видит: STAVAGENT_CONTRACT.md в docs/
# Говоришь: "Проверь что /workflow-a/start соответствует контракту"
```

#### 2. Изменяешь контракт

Если нужно изменить интеграцию:

1. **Сначала:** Обнови `STAVAGENT_CONTRACT.md` (в эталонном месте)
2. **Потом:** Скопируй в все репо:
   ```bash
   cp stavagent-spec/STAVAGENT_CONTRACT.md stavagent-portal/docs/
   cp stavagent-spec/STAVAGENT_CONTRACT.md kiosk-monolit/docs/
   cp stavagent-spec/STAVAGENT_CONTRACT.md concrete-agent/docs/
   ```
3. **После:** По очереди обнови код в каждом репо

---

## 🚀 План действий ПРЯМО СЕЙЧАС

### Шаг 1: Создать репо `stavagent-portal` ✨

```bash
# На GitHub создать новый репо:
# https://github.com/alpro1000/stavagent-portal

# Инициализировать локально:
mkdir ~/stavagent-portal
cd ~/stavagent-portal
git init
git remote add origin https://github.com/alpro1000/stavagent-portal.git
```

### Шаг 2: Скопировать нужные файлы из Monolit-Planner

```bash
# Создать структуру
mkdir -p backend/src/{routes,services,middleware,db,utils}
mkdir -p frontend/src/{pages,components,context,hooks,services,styles}
mkdir -p docs

# Скопировать документы
cp ~/Monolit-Planner/STAVAGENT_CONTRACT.md ~/stavagent-portal/docs/
cp ~/Monolit-Planner/PORTAL_ARCHITECTURE.md ~/stavagent-portal/docs/
cp ~/Monolit-Planner/CODE_ANALYSIS.md ~/stavagent-portal/docs/

# Скопировать backend файлы (переиспользуемые)
cp ~/Monolit-Planner/backend/src/routes/auth.js ~/stavagent-portal/backend/src/routes/
cp ~/Monolit-Planner/backend/src/routes/admin.js ~/stavagent-portal/backend/src/routes/
cp ~/Monolit-Planner/backend/src/routes/otskp.js ~/stavagent-portal/backend/src/routes/

# И так далее...
```

### Шаг 3: Создать новые файлы для портала

```bash
# Backend routes (НОВЫЕ)
touch ~/stavagent-portal/backend/src/routes/portal-projects.js
touch ~/stavagent-portal/backend/src/routes/portal-files.js
touch ~/stavagent-portal/backend/src/routes/kiosk-links.js
touch ~/stavagent-portal/backend/src/routes/chat.js

# Frontend pages (НОВЫЕ)
touch ~/stavagent-portal/frontend/src/pages/PortalPage.tsx
touch ~/stavagent-portal/frontend/src/pages/ProjectCard.tsx
touch ~/stavagent-portal/frontend/src/components/KioskSelector.tsx
touch ~/stavagent-portal/frontend/src/components/CorePanel.tsx
touch ~/stavagent-portal/frontend/src/components/ChatPanel.tsx
```

### Шаг 4: Первый коммит

```bash
cd ~/stavagent-portal
git add .
git commit -m "🎉 Initial commit: StavAgent Portal

- Скопированы переиспользуемые компоненты из Monolit-Planner
- Добавлена документация (STAVAGENT_CONTRACT.md, PORTAL_ARCHITECTURE.md)
- Создана структура для новых компонентов
"
git push -u origin main
```

---

## 📊 Итоговая структура репозиториев

| Репо | URL | Статус | Назначение |
|------|-----|--------|-----------|
| **stavagent-portal** | `github.com/alpro1000/stavagent-portal` | 🆕 Создать | Портал (главный вход, проекты, файлы) |
| **kiosk-monolit** | `github.com/alpro1000/kiosk-monolit` | 🆕 Создать | Киоск монолита (калькулятор бетона) |
| **concrete-agent** | `github.com/alpro1000/concrete-agent` | ✅ Существует | CORE (парсинг, AI, аудит) |
| **Monolit-Planner** | `github.com/alpro1000/Monolit-Planner` | ⚠️ Архив | Старый монолит (не удалять, для истории) |
| stavagent-spec | `github.com/alpro1000/stavagent-spec` | 🔮 Опционально | Эталонный контракт |

---

## ✅ Чек-лист

### Для создания портала:
- [ ] Создать репо `stavagent-portal` на GitHub
- [ ] Скопировать STAVAGENT_CONTRACT.md в docs/
- [ ] Скопировать переиспользуемые файлы из Monolit-Planner
- [ ] Создать структуру для новых компонентов
- [ ] Первый коммит
- [ ] Настроить deployment (Render/Vercel)

### Для киоска Monolit:
- [ ] Создать репо `kiosk-monolit` на GitHub
- [ ] Скопировать STAVAGENT_CONTRACT.md в docs/
- [ ] Переместить Monolit-специфичные файлы
- [ ] Добавить portal-integration.js
- [ ] Настроить deployment

### Для CORE:
- [ ] Скопировать STAVAGENT_CONTRACT.md в docs/
- [ ] Проверить соответствие endpoints контракту
- [ ] Добавить GET /projects/{core_project_id}/concrete-items

---

**Последнее обновление:** 2025-11-15
**Статус:** 📋 План готов к исполнению
**Следующий шаг:** Создать репо `stavagent-portal`
