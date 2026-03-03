# STAVAGENT - AI система для строительной отрасли

Монорепозиторий из 4 микросервисов: CORE (Python AI), Portal (диспетчер), Monolit-Planner (калькулятор бетона), URS_MATCHER_SERVICE (URS матчинг).

---

## 🚀 Быстрый старт

**Новая сессия?** → Читай **[SESSION_START.md](SESSION_START.md)** (готовые команды для копирования)

**Полная документация?** → Читай **[CLAUDE.md](CLAUDE.md)** (архитектура, API, формулы)

**Детали последней сессии?** → Читай **[NEXT_SESSION.md](NEXT_SESSION.md)** (что сделано, что дальше)

---

## 📋 Текущий статус (2025-01-XX)

- ✅ **Testing**: 37+ integration tests готовы
- ✅ **CI/CD**: GitHub Actions работает (6 jobs)
- ✅ **CORS Fix**: concrete-agent разрешает запросы от Portal
- ✅ **Git Hooks**: Pre-commit + Pre-push настроены
- ✅ **Node.js 20.11.0** - обновлён с 18.20.4 (EOL)
- ✅ **npm vulnerabilities** - 1/2 исправлено (jws ✅, xlsx ⚠️ no fix)
- ✅ **Formwork Rental Calculator** - калькулятор аренды бедения в Registry TOV
- ✅ **Time Norms Automation** - AI-powered work duration estimates (KROS/RTS/ČSN)
- ✅ **Unified Registry Foundation** - Weeks 1-4 complete (8 tables, 11 endpoints, Monolit adapter)
- ✅ **Pump Calculator** - Multi-supplier UI + Excel export + Practical performance data
- ⏳ **MinerU PDF Parser** - stub only (not used, using pdfplumber)
- 🟢 **Production**: All services operational

---

## 🔗 Production URLs

| Сервис | URL |
|--------|-----|
| Portal Frontend | https://www.stavagent.cz |
| Portal API | https://stavagent-backend.vercel.app |
| Monolit Backend | https://monolit-planner-api.onrender.com |
| Monolit Frontend | https://monolit-planner-frontend.vercel.app |
| Registry TOV | https://stavagent-backend-ktwx.vercel.app |
| CORE (AI) | https://concrete-agent.onrender.com |
| URS Matcher | https://urs-matcher-service.onrender.com |

---

## 🎯 Приоритетные задачи

1. **✅ DONE: Unified Registry Foundation (Weeks 1-4)**
   - ✅ Database schema (8 tables)
   - ✅ API endpoints (11 endpoints)
   - ✅ File versioning (SHA-256 hash)
   - ✅ Monolit adapter (backward compatible)
   - ✅ Registry TOV adapter
   - ✅ Security fixes (Amazon Q review)
   - 📄 See: [WEEK_4_SUMMARY.md](docs/WEEK_4_SUMMARY.md)
2. **🔜 NEXT: Unified Registry (Weeks 5-6)** - Frontend Integration (OPTIONAL)
   - 🔜 Registry tab in Monolit UI
   - 🔜 Unified position view
   - 🔜 Cross-kiosk navigation
3. **🔜 FUTURE: Unified Registry (Weeks 7-9)** - Relink Algorithm
4. **🔜 FUTURE: Unified Registry (Weeks 10-12)** - Template System + Production

**Детали:** см. [NEXT_SESSION.md](NEXT_SESSION.md) → готовые команды для копирования

---

## 📁 Структура проекта

```
STAVAGENT/
├── concrete-agent/         ← ЯДРО (Python FastAPI) - Multi-Role AI
├── stavagent-portal/       ← Диспетчер (Node.js) - вход пользователей
├── Monolit-Planner/        ← Киоск (Node.js) - калькулятор бетона
├── rozpocet-registry/      ← Киоск (React) - Registry TOV + калькулятор аренды
├── rozpocet-registry-backend/ ← Backend для Registry TOV
├── URS_MATCHER_SERVICE/    ← Киоск (Node.js) - URS матчинг
├── docs/                   ← Системная документация
├── .github/workflows/      ← CI/CD (6 jobs)
├── CLAUDE.md               ← Полная документация системы
├── SESSION_START.md        ← Быстрый старт новой сессии
└── NEXT_SESSION.md         ← Детали последней сессии
```

---

## 🛠️ Разработка

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
cd backend
npm run test:unit              # Unit tests
npm run test:integration       # Integration tests (⚠️ требует фикса)
npm run test:all               # Все тесты
npm run test:coverage          # С покрытием

cd shared
npm test                       # 34 formula tests
```

### Git Hooks (автоматические)

```bash
# Pre-commit (автоматически)
.husky/pre-commit → запускает 34 formula tests (~470ms)

# Pre-push (автоматически)
.husky/pre-push → проверяет ветку + запускает backend tests
```

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| **[UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md](UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md)** | 12-week implementation plan |
| **[docs/UNIFIED_REGISTRY_WEEKS_1-3_SUMMARY.md](docs/UNIFIED_REGISTRY_WEEKS_1-3_SUMMARY.md)** | Weeks 1-3 progress |
| **[docs/WEEK_1_PROGRESS.md](docs/WEEK_1_PROGRESS.md)** | Week 1 details |
| **[docs/WEEK_2_PROGRESS.md](docs/WEEK_2_PROGRESS.md)** | Week 2 details |
| **[SESSION_START.md](SESSION_START.md)** | Быстрый старт - готовые команды |
| **[CLAUDE.md](CLAUDE.md)** | Полная документация системы |
| **[NEXT_SESSION.md](NEXT_SESSION.md)** | Детали последней сессии |
| **[concrete-agent/QUICK_DEPLOY.md](concrete-agent/QUICK_DEPLOY.md)** | Деплой CORE фикса |
| **[concrete-agent/RENDER_DEPLOYMENT_FIX.md](concrete-agent/RENDER_DEPLOYMENT_FIX.md)** | Диагностика Render |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Multi-kiosk архитектура |
| [docs/FORMWORK_RENTAL_CALCULATOR.md](docs/FORMWORK_RENTAL_CALCULATOR.md) | Калькулятор аренды бедения |
| [docs/FORMWORK_RENTAL_USER_GUIDE.md](docs/FORMWORK_RENTAL_USER_GUIDE.md) | Руководство пользователя |
| [docs/TESTING_SETUP.md](docs/TESTING_SETUP.md) | Настройка тестов |
| [docs/POST_DEPLOYMENT_IMPROVEMENTS.md](docs/POST_DEPLOYMENT_IMPROVEMENTS.md) | План улучшений |
| [Monolit-Planner/CLAUDE.MD](Monolit-Planner/CLAUDE.MD) | Документация Monolit Planner |
| [Monolit-Planner/docs/TIME_NORMS_AUTOMATION.md](Monolit-Planner/docs/TIME_NORMS_AUTOMATION.md) | Time Norms - Design |
| [Monolit-Planner/docs/TIME_NORMS_IMPLEMENTATION_STATUS.md](Monolit-Planner/docs/TIME_NORMS_IMPLEMENTATION_STATUS.md) | Time Norms - Status |

---

## 🔍 Полезные команды

```bash
# Статус CI/CD
gh workflow view monolit-planner-ci

# Логи deployment
gh run list --workflow=monolit-planner-ci

# Проверить уязвимости
cd Monolit-Planner/backend && npm audit

# Запустить все тесты
cd Monolit-Planner/backend && npm run test:all

# Проверить Git Hooks
.husky/pre-commit
.husky/pre-push
```

---

## 🎓 Ресурсы

- **GitHub**: https://github.com/alpro1000/STAVAGENT
- **Issues**: https://github.com/alpro1000/STAVAGENT/issues
- **CI/CD**: https://github.com/alpro1000/STAVAGENT/actions
- **Render**: https://dashboard.render.com

---

**Версия:** 1.0.16
**Последнее обновление:** 2025-01-XX
**Текущая ветка:** `feature/unified-registry-foundation`
**Последние коммиты:**
- `6a56977` DOCS: Week 4 summary - Foundation complete
- `80683a6` FIX: Security and validation issues from Amazon Q review
- `8068526` FEATURE: Unified Registry Foundation (Weeks 1-3)

---

## 📝 Шаблон для новой сессии

```markdown
Привет! Продолжаю работу над STAVAGENT.

Контекст:
- Последняя сессия: Integration Tests + CI/CD Setup
- Ветка: claude/setup-integration-tests-1EPUi
- Коммит: 1155391
- Статус: ✅ CI/CD работает, 🔴 Node.js EOL, 🔴 4 vulnerabilities

Приоритет сегодня:
1. [Выбрать из SESSION_START.md]

Начинаю...
```

---

**Вопросы?** → Открой issue или читай [CLAUDE.md](CLAUDE.md)
