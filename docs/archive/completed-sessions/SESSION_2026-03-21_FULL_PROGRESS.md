# SESSION 2026-03-21 — Полный отчёт о проделанной работе

**Дата:** 2026-03-21
**Период:** Март 2026 (коммиты с 2026-03-09)
**Репозиторий:** STAVAGENT (Monorepo)

---

## Обзор

За март 2026 выполнено **60+ коммитов** — масштабная работа по 7 направлениям:
1. Pump Calculator — миграция на портал
2. Element Planner — 20 типов элементов + Gantt + XLSX
3. LLM / Vertex AI — переход на GCP credits
4. Cloud Build — CI/CD инфраструктура
5. URS Matcher — стабилизация LLM
6. Portal — Cabinets + Roles (Sprint 1)
7. Общие фиксы и рефакторинг

---

## 1. Pump Calculator — Миграция на портал (Phase 9)

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `68a4704` | FEAT: Unified Pump Calculator — Phase 9 migration + API |
| `bd74359` | FEAT: Connect Pump Calculator frontend to backend API |

### Что сделано
- **Калькулятор черпадел** мигрирован из rozpocet-registry (R0) на **stavagent-portal**
- Роут `/pump` → `PumpCalculatorPage` (lazy loaded)
- Карточка на портале: "Kalkulačka čerpadel" (⚙️, статус: active)
- Подключение к backend API (получение поставщиков из БД)
- Offline fallback — работает без API с хардкоженными данными
- Мобильная версия (mobile-first дизайн для прораба на стройке)
- 3 поставщика, чешский календář (víkend/svátek/noc příplatky)
- **R0 Kalkulátory** карточка удалена с портала (`01de737`)

### Файлы
- `stavagent-portal/frontend/src/pages/PumpCalculatorPage.tsx`
- `stavagent-portal/frontend/src/App.tsx` — роут `/pump`
- `stavagent-portal/frontend/src/pages/PortalPage.tsx` — карточка

---

## 2. Element Planner — 20 типов элементов

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `b521441` | FEAT: universal element planner — 20 element types |
| `799f2ca` | FEAT: visual Gantt chart, Excel export |
| `2355a79` | FEAT: Props calculator — shoring/propping |
| `2bab3c8` | FEAT: Comprehensive help panel with math models |
| `2f9a421` | FEAT: Add help panel to Planner UI |
| `cab2c93` | FEAT: AI advisor for PlannerPage + spáry UX fix |
| `89cffa4` | FEAT: Skruž vs maturity comparison |
| `90ddb03` | FEAT: Methvin.co norms scraper |
| `c94927d` | FEAT: Add "Stáhnout normy z methvin.co" button |
| `29b3720` | FEAT: Expand methvin.co scraper to 51 categories |
| `55e3087` | STYLE: consolidate design tokens |
| `2eb05a5` | STYLE: Planner XLSX export — Slate Minimal |
| `8dbb7f6` | FIX: Show actual crew_size, enable Monte Carlo |

### Что сделано
- **20 типов элементов:** 9 мостовых + 11 строительных
- **7-engine pipeline:** Element Classifier → Pour Decision → Formwork 3-Phase → Rebar Lite → Pour Task → RCPSP Scheduler (DAG) → PERT Monte Carlo
- **Gantt chart** — визуальное расписание с зависимостями
- **XLSX экспорт** — выгрузка в Excel в стиле Slate Minimal
- **Props calculator** — расчёт подпорок/стоек для горизонтальных элементов
- **Help panel** — документация математических моделей прямо в UI
- **AI advisor** — AI-помощник для планировщика
- **Methvin.co scraper** — 51 категория, 72 запроса, Perplexity-powered
- **Skruž vs maturity** — сравнение подмостей vs ускоренного твердения
- **Дизайн:** Slate Minimal — CSS variables (`--r0-*`), zero hardcoded hex

### Файлы (основные)
- `Monolit-Planner/shared/` — формулы + scheduler (336 тестов)
- `Monolit-Planner/frontend/src/pages/PlannerPage.tsx`
- `Monolit-Planner/frontend/src/components/planner/`

---

## 3. LLM / Vertex AI — Переход на GCP credits

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `c09ff95` | FEAT: Switch all LLM traffic to GCP credits |
| `ac73b69` | FEAT: Switch to Vertex AI Gemini as primary LLM |
| `31cf339` | FIX: Fix 401 LLM auth errors |
| `6e8bc10` | FIX: Update all LLM model IDs to verified 2026-03 versions |
| `397a386` | FEAT: VertexGeminiClient verbose logging + probe endpoint |
| `ce23ef4` | REFACTOR: unify GOOGLE_AI_KEY → GOOGLE_API_KEY |

### Что сделано
- **Vertex AI Gemini** — основной LLM провайдер (ADC auth, без API ключей на Cloud Run)
- Модели: `gemini-2.5-flash-lite` (fast), `gemini-2.5-pro` (heavy)
- Унификация переменных: `GOOGLE_AI_KEY → GOOGLE_API_KEY`
- Эндпоинт `/api/v1/llm/status` — диагностика LLM
- Фиксы 401 ошибок авторизации

---

## 4. Cloud Build — CI/CD инфраструктура

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `6866e83` | FIX: resolve Cloud Build FAILED_PRECONDITION errors |
| `7606a76` | FIX: add SERVICE_TOKEN secret to cloudbuild |
| `8bdd483` | DOCS: mark Cloud Build deploy as completed |

### Что сделано
- Создан `cloudbuild.yaml` (deploy-all)
- Исправлены маппинги секретов
- Добавлен `location: europe-west3` во все триггеры
- Добавлен `serviceAccount` во все триггеры
- Недостающие API: logging, aiplatform, iam
- Недостающие секреты: CONCRETE_DATABASE_URL, SERVICE_TOKEN, PERPLEXITY_API_KEY
- IAM bindings: logging.logWriter, aiplatform.user

**Полная документация:** `docs/archive/completed-sessions/SESSION_2026-03-21_CLOUD_BUILD_FIX.md`

---

## 5. URS Matcher — Стабилизация LLM

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `fe17bd2` | FEAT: URS Matcher — Vertex AI ADC |
| `f3718c8` | FIX: add OpenAI and DeepSeek as real fallbacks |
| `02bcd48` | FIX: 404 Gemini model + fallback to gemini-2.0-flash |
| `ced3b9b` | FIX: wrong secret name + outdated fallback model |
| `ce6884f` | FIX: API key naming + Vertex AI ADC support |
| `5bfa104` | FIX: Perplexity reads both PPLX_API_KEY and PERPLEXITY_API_KEY |
| `afa2fbe` | FIX: return raw OTSKP candidates when LLM unavailable |
| `f03fa4b` | FIX: URS Matcher 404 + workflow_c parsing |
| `dfdf850` | STYLE: frontend přejmenování na česky |

### Что сделано
- Vertex AI ADC как основной провайдер Gemini
- LLM fallback chain: Vertex AI → OpenAI → DeepSeek
- Фикс 404 ошибок (неправильные model IDs)
- Исправление имён секретов
- Возврат raw OTSKP кандидатов при недоступности LLM
- Чешская локализация фронтенда

---

## 6. Portal — Cabinets + Roles (Sprint 1)

### Коммиты
| Хэш | Сообщение |
|------|-----------|
| `3fea990` | FEAT: Sprint 1 Backend — Organizations + Roles + Cabinet |
| `28c6784` | FEAT: Sprint 1 Frontend — CabinetPage, OrgPage, OrgInvitePage |
| `afcd4be` | FEAT: Sprint 2 — Service Connections + AI Model Routing |

### Что сделано
- **Organizations + org_members** — таблицы в БД
- **5 ролей:** admin / manager / estimator / viewer / api_client
- **orgRole.js middleware** — проверка ролей
- **12 API эндпоинтов:** cabinet.js + orgs.js
- **PATCH /api/auth/me** — обновление профиля
- **Frontend:** CabinetPage, CabinetOrgsPage, OrgPage, OrgInvitePage
- Sprint 2 (schema only): service_connections (AES-256-GCM)

---

## 7. Дополнительные фичи и фиксы

### Document Processing
| Хэш | Сообщение |
|------|-----------|
| `0c40ea0` | FEAT: Document Search Module — Vertex AI Search + Perplexity Sonar |
| `b8dcb17` | FEAT: Large document support — chunked map-reduce |
| `89501c3` | FEAT: Adaptive document summarizer |
| `659445b` | FIX: adaptive context limits across all services |

### Production Fixes
| Хэш | Сообщение |
|------|-----------|
| `a32dcd7` | FIX: resolve 4 production errors |
| `7deaa51` | FIX: 4 Monolit frontend errors (registry 404, export 503, CORS) |
| `8e7c6e2` | FIX: cross-service audit — CORS, Portal URLs, Cloud SQL |
| `082a272` | FIX: Mobile responsive Master-Detail layout |
| `8467694` | FIX: Unify all modals to design system |
| `a150064` | FIX: IF NOT EXISTS in ALTER TABLE migrations |
| `f2ff9aa` | FIX: 3 kritické chyby v logice kalkulátoru mostovky |

### Infrastructure
| Хэш | Сообщение |
|------|-----------|
| `37da257` | FIX: Restore Vercel for frontends, clarify no Render |
| `b7690d9` | REFACTOR: Update all Cloud Run URLs |
| `310c519` | FIX: Force SSL off for Cloud SQL Unix socket |
| `290b65d` | REFACTOR: Trim CLAUDE.md 82% (51KB→9KB) |

---

## Архитектура системы (текущее состояние)

```
Portal (Dispatcher) ──┬──→ concrete-agent (CORE: AI, parsing, audit)
                      ├──→ Monolit-Planner (concrete calculator + Element Planner)
                      ├──→ URS_MATCHER_SERVICE (BOQ→URS matching)
                      └──→ rozpocet-registry (BOQ classification)

Портал также содержит:
  /pump                → Калькулятор черпадел (мигрирован из R0)
  /objednavka-betonu   → Заказ бетона (поиск + сравнение)
  /price-parser        → PDF парсер ценников поставщиков
  /planner             → Element Planner (20 типов, Gantt, XLSX)
```

### Инфраструктура
| Компонент | Платформа |
|-----------|-----------|
| Backends | Google Cloud Run (europe-west3) |
| Frontends | Vercel |
| CI/CD | Cloud Build (per-service triggers) |
| DB | Cloud SQL PostgreSQL 15 |
| LLM | Vertex AI Gemini (ADC auth) |
| GitHub | Actions: keep-alive, CI, test-coverage |

---

## Сервисы Portal — Полный список карточек

| # | Название | URL | Описание |
|---|----------|-----|----------|
| 1 | Pasport projektu | /projects | Управление проектами, загрузка документов |
| 2 | Monolit Planner | /monolit | Калькулятор бетона CZK/m³ |
| 3 | Element Planner | /planner | 20 типов элементов, Gantt, XLSX |
| 4 | Objednávka betonu | /objednavka-betonu | Поиск бетонарен, сравнение цен |
| 5 | Ceníky dodavatelů | /price-parser | PDF парсер ценников |
| 6 | Kalkulačka čerpadel | /pump | 3 поставщика, příplatky, мобильная |
| 7 | Formwork Calculator | /formwork | Калькулятор опалубки |
| 8 | URS Matcher | external | BOQ→URS matching |
| 9 | Rozpočet Registry | external | BOQ классификация |
| 10 | Cabinets | /cabinet | Организации + роли (Sprint 1) |

---

## Статистика

- **Коммитов за период:** ~60+
- **Новых фич:** 15+
- **Фиксов:** 25+
- **Сервисов затронуто:** все 5
- **Тестов в Monolit shared:** 336
- **Тестов в URS Matcher:** 159

---

## Следующие шаги (Backlog)

1. **Sprint 2:** Service Connections API + frontend + MASTER_ENCRYPTION_KEY
2. **Position write-back:** Monolit + Registry → Portal
3. **Deep Links:** Прямые ссылки на конкретные проекты/позиции
4. **React Error Boundaries:** Для всех сервисов
5. **Vitest migration:** Переход с Jest на Vitest
6. **Document Accumulator:** Заменить in-memory storage на persistent
