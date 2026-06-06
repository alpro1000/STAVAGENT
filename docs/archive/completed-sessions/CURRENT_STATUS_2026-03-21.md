# STAVAGENT — Текущий статус системы

**Дата:** 2026-03-21
**Версия:** 3.1.0

---

## Статус сервисов

| Сервис | Версия | Статус | URL |
|--------|--------|--------|-----|
| concrete-agent (CORE) | v2.4.1 | ✅ Production | [Cloud Run](https://concrete-agent-1086027517695.europe-west3.run.app) |
| stavagent-portal backend | — | ✅ Production | [Cloud Run](https://stavagent-portal-backend-1086027517695.europe-west3.run.app) |
| stavagent-portal frontend | — | ✅ Production | [Vercel](https://www.stavagent.cz) |
| Monolit-Planner API | v4.3.8 | ✅ Production | [Cloud Run](https://monolit-planner-api-1086027517695.europe-west3.run.app) |
| Monolit-Planner frontend | — | ✅ Production | [Vercel](https://monolit-planner-frontend.vercel.app) |
| URS Matcher | — | ✅ Production | [Cloud Run](https://urs-matcher-service-1086027517695.europe-west3.run.app) |
| Registry backend | — | ✅ Production | [Cloud Run](https://rozpocet-registry-backend-1086027517695.europe-west3.run.app) |
| Registry frontend | — | ✅ Production | [Vercel](https://stavagent-backend-ktwx.vercel.app) |

---

## Инфраструктура

| Компонент | Технология | Статус |
|-----------|-----------|--------|
| Compute | Google Cloud Run (europe-west3) | ✅ |
| Frontend hosting | Vercel | ✅ |
| Database | Cloud SQL PostgreSQL 15 | ✅ |
| CI/CD | Cloud Build (5 per-service triggers) | ✅ |
| LLM | Vertex AI Gemini (ADC auth) | ✅ |
| GitHub Actions | keep-alive, CI, tests | ✅ |
| Secret Manager | GCP Secret Manager | ✅ |

---

## Модули портала

| Модуль | Роут | Статус | Описание |
|--------|------|--------|----------|
| Pasport projektu | `/projects` | ✅ active | Управление проектами |
| Monolit Planner | `/monolit` | ✅ active | CZK/m³ калькулятор |
| Element Planner | `/planner` | ✅ active | 20 элементов, Gantt, XLSX |
| Objednávka betonu | `/objednavka-betonu` | ✅ active | Заказ бетона |
| Ceníky dodavatelů | `/price-parser` | ✅ active | PDF парсер ценников |
| **Kalkulačka čerpadel** | **`/pump`** | **✅ active** | **Мигрирован из R0** |
| Formwork Calculator | `/formwork` | ✅ active | Калькулятор опалубки |
| Cabinets (Sprint 1) | `/cabinet` | ✅ active | Организации + роли |

---

## Что завершено в марте 2026

### Новые фичи
- [x] Pump Calculator мигрирован на портал (`/pump`)
- [x] Element Planner — 20 типов элементов (9 мостовых + 11 строительных)
- [x] Gantt chart + XLSX экспорт
- [x] Props calculator (подпорки/стойки)
- [x] Help panel с документацией математических моделей
- [x] AI advisor для PlannerPage
- [x] Methvin.co norms scraper (51 категория, 72 запроса)
- [x] Vertex AI Gemini — основной LLM (ADC auth)
- [x] Document Search Module (Vertex AI Search + Perplexity Sonar)
- [x] Large document support (chunked map-reduce)
- [x] Sprint 1 Cabinets + Roles (5 ролей, 12 API endpoints)

### Инфраструктура
- [x] Cloud Build — все 5 сервисов + deploy-all trigger
- [x] Все бэкенды на Google Cloud Run
- [x] Все фронтенды на Vercel
- [x] LLM на GCP credits (Vertex AI)
- [x] Унификация GOOGLE_AI_KEY → GOOGLE_API_KEY

### Фиксы
- [x] URS Matcher LLM стабилизация (Vertex AI + OpenAI + DeepSeek fallback)
- [x] Cloud Build FAILED_PRECONDITION
- [x] Cross-service CORS, Cloud SQL, Portal URLs
- [x] Mobile responsive layout
- [x] 401 LLM auth errors
- [x] PostgreSQL migration safety (IF NOT EXISTS)

---

## Ожидает действий пользователя

| Задача | Описание |
|--------|----------|
| MASTER_ENCRYPTION_KEY | `openssl rand -hex 32` → Secret Manager (Sprint 2) |
| API ключи | Реальные значения в Secret Manager |

---

## Backlog (следующие шаги)

1. Sprint 2: Service Connections API + frontend + encryption
2. Position write-back: Monolit + Registry → Portal
3. Deep Links
4. React Error Boundaries
5. Vitest migration
6. Document Accumulator → persistent storage
