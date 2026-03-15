# STAVAGENT - AI система для строительной отрасли

Монорепозиторий из 5 микросервисов: CORE (Python AI), Portal (диспетчер), Monolit-Planner (калькулятор бетона), URS_MATCHER_SERVICE (URS матчинг), rozpocet-registry (BOQ Registry).

---

## Быстрый старт

**Полная документация?** → Читай **[CLAUDE.md](CLAUDE.md)** (архитектура, API, формулы)

**Детали последней сессии?** → Читай **[NEXT_SESSION.md](NEXT_SESSION.md)** (что сделано, что дальше)

---

## Текущий статус (2026-03-14)

- ✅ **Cloud Run**: Все 5 бэкендов на Google Cloud Run (europe-west3)
- ✅ **Vercel**: Все фронтенды на Vercel
- ✅ **Cloud SQL**: PostgreSQL 15 (stavagent-db)
- ✅ **Cloud Build**: CI/CD per-service triggers (push to main)
- ✅ **Testing**: 332+ shared formula tests, 159 URS tests, 87+ CORE tests
- ✅ **CI/CD**: GitHub Actions + Cloud Build
- ✅ **Git Hooks**: Pre-commit + Pre-push (Husky)
- ✅ **Unified Registry**: Weeks 1-9 complete (DB, API, Relink, UI)
- ✅ **Pump Calculator**: Multi-supplier + Excel export
- ✅ **PDF Price Parser**: 7 section parsers + 21 tests
- ✅ **Document Passport**: 300s → 2-8s optimization
- 🟢 **Production**: All services operational

---

## Production URLs

| Сервис | Тип | URL |
|--------|-----|-----|
| concrete-agent (CORE) | Backend (Cloud Run) | https://concrete-agent-1086027517695.europe-west3.run.app |
| stavagent-portal | Backend (Cloud Run) | https://stavagent-portal-backend-1086027517695.europe-west3.run.app |
| stavagent-portal | Frontend (Vercel) | https://www.stavagent.cz |
| Monolit-Planner | Backend (Cloud Run) | https://monolit-planner-api-1086027517695.europe-west3.run.app |
| Monolit-Planner | Frontend (Vercel) | https://monolit-planner-frontend.vercel.app |
| URS_MATCHER_SERVICE | Backend (Cloud Run) | https://urs-matcher-service-1086027517695.europe-west3.run.app |
| rozpocet-registry | Backend (Cloud Run) | https://rozpocet-registry-backend-1086027517695.europe-west3.run.app |
| rozpocet-registry | Frontend (Vercel) | https://stavagent-backend-ktwx.vercel.app |

---

## Структура проекта

```
STAVAGENT/
├── concrete-agent/           ← ЯДРО (Python FastAPI) - Multi-Role AI
├── stavagent-portal/         ← Диспетчер (Node.js) - вход пользователей
├── Monolit-Planner/          ← Киоск (Node.js) - калькулятор бетона
├── rozpocet-registry/        ← Киоск (React/Vite) - Registry TOV (browser-only)
├── rozpocet-registry-backend/← Backend для Registry TOV
├── URS_MATCHER_SERVICE/      ← Киоск (Node.js) - URS матчинг
├── docs/                     ← Системная документация
├── cloudbuild-*.yaml         ← Cloud Build конфиги (5 сервисов)
├── triggers/                 ← Cloud Build триггеры
├── .github/workflows/        ← CI/CD (keep-alive, monolit CI, tests)
├── .husky/                   ← Git hooks (pre-commit, pre-push)
├── CLAUDE.md                 ← Полная документация системы
└── NEXT_SESSION.md           ← Детали последней сессии
```

---

## Разработка

### Monolit-Planner (основной киоск)

```bash
cd Monolit-Planner

# Установка
cd shared && npm install && npm run build && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Разработка
cd backend && npm run dev      # API на :3001
cd frontend && npm run dev     # UI на :5173

# Тесты
cd shared && npm test          # 332 formula tests
cd backend && npm run test:all # Backend tests
```

### concrete-agent (CORE)

```bash
cd concrete-agent
npm install
npm run dev:backend            # FastAPI на :8000
npm run test                   # pytest suite
```

### Git Hooks (автоматические)

```bash
# Pre-commit: 34 formula tests (~470ms)
# Pre-push: branch validation + tests
```

---

## Документация

| Файл | Описание |
|------|----------|
| **[CLAUDE.md](CLAUDE.md)** | Полная документация системы (v2.8.0) |
| **[NEXT_SESSION.md](NEXT_SESSION.md)** | Детали последней сессии |
| **[BACKLOG.md](BACKLOG.md)** | Pending задачи и приоритеты |
| **[Monolit-Planner/CLAUDE.MD](Monolit-Planner/CLAUDE.MD)** | Документация Monolit Planner |
| **[concrete-agent/CLAUDE.md](concrete-agent/CLAUDE.md)** | Документация CORE |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Multi-kiosk архитектура |

---

## CI/CD

**Cloud Build** (per-service, push to main):
```
cloudbuild-concrete.yaml  → concrete-agent/**
cloudbuild-monolit.yaml   → Monolit-Planner/**
cloudbuild-portal.yaml    → stavagent-portal/**
cloudbuild-urs.yaml       → URS_MATCHER_SERVICE/**
cloudbuild-registry.yaml  → rozpocet-registry-backend/**
```

**GitHub Actions**: keep-alive, monolit CI, test coverage, URS tests

---

## Ресурсы

- **GitHub**: https://github.com/alpro1000/STAVAGENT
- **Issues**: https://github.com/alpro1000/STAVAGENT/issues
- **GCP Console**: https://console.cloud.google.com

---

**Версия:** 2.0.0
**Последнее обновление:** 2026-03-14
