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
- ✅ **Production**: Backend + Frontend развёрнуты на Render
- ✅ **Git Hooks**: Pre-commit + Pre-push настроены
- ✅ **Node.js 20.11.0** - обновлён с 18.20.4 (EOL)
- ✅ **npm vulnerabilities** - 1/2 исправлено (jws ✅, xlsx ⚠️ no fix)
- ✅ **Formwork Rental Calculator** - калькулятор аренды бедения в Registry TOV
- 🟢 **Time Norms Design** - готов к реализации (4-6 часов)

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

1. **✅ DONE: Update Node.js** - 18.20.4 → 20.11.0 (LTS)
2. **✅ DONE: Fix npm vulnerabilities** - jws fixed, xlsx documented
3. **✅ DONE: Formwork Rental Calculator** - калькулятор аренды бедения (2 часа)
   - Backend API endpoint в Registry TOV
   - Frontend калькулятор с DOKA ценами
   - Интеграция с Monolit Planner (alert с параметрами)
4. **🟢 READY: Implement Time Norms Automation** - AI-powered work duration estimates
   - Design complete (8 pages)
   - Backend service + API endpoint + Frontend UI
   - Leverages concrete-agent Multi-Role API + KROS/RTS norms
5. Re-enable npm cache в CI (~2min speedup) - optional
6. Fix integration tests ES module mocking - optional

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
| **[SESSION_START.md](SESSION_START.md)** | Быстрый старт - готовые команды |
| **[CLAUDE.md](CLAUDE.md)** | Полная документация системы |
| **[NEXT_SESSION.md](NEXT_SESSION.md)** | Детали последней сессии |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Multi-kiosk архитектура |
| [docs/FORMWORK_RENTAL_CALCULATOR.md](docs/FORMWORK_RENTAL_CALCULATOR.md) | Калькулятор аренды бедения |
| [docs/FORMWORK_RENTAL_USER_GUIDE.md](docs/FORMWORK_RENTAL_USER_GUIDE.md) | Руководство пользователя |
| [docs/TESTING_SETUP.md](docs/TESTING_SETUP.md) | Настройка тестов |
| [docs/POST_DEPLOYMENT_IMPROVEMENTS.md](docs/POST_DEPLOYMENT_IMPROVEMENTS.md) | План улучшений |
| [Monolit-Planner/CLAUDE.MD](Monolit-Planner/CLAUDE.MD) | Документация Monolit Planner |

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

**Версия:** 1.0.12
**Последнее обновление:** 2025-01-XX
**Текущая ветка:** `main`
**Последние коммиты:**
- `3c79ed3` FEATURE: Formwork rental calculator in Registry TOV
- `5326457` REFACTOR: Formwork calculator - labor only (Montáž + Demontáž)
- `e967324` FIX: Remove npm cache from test-coverage workflow

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
