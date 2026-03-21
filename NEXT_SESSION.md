# NEXT SESSION — после 2026-03-21 (Session 16)

## Как начать следующий сеанс

```
Продолжи работу над STAVAGENT. Прочитай CLAUDE.md, BACKLOG.md и NEXT_SESSION.md.
[описание задачи]
```

---

## 🔴 Первоочередное: Merge текущей ветки

**Ветка:** `claude/read-markdown-files-aZoFV` (19 коммитов)
**Тесты:** 336/336 pass, TypeScript build ✅
**Действие:** Создать PR → merge в main → Cloud Build задеплоит автоматически

---

## 🟠 Задачи на следующий сеанс (по приоритету)

### 1. Sprint 2 — Service Connections CRUD
**Приоритет:** ВЫСОКИЙ
**Зависит от:** MASTER_ENCRYPTION_KEY в Secret Manager (нужно действие пользователя)
**Что делать:**
- `encryptionService.js` — AES-256-GCM wrapper
- `connections.js` — 8 API endpoints (CRUD + test + model-config + kiosk-toggles)
- `ConnectionsPage.tsx` — фронтенд UI (`/cabinet/connections`)
- Rate limiter: 5 req/min для connection test
- См. детали в BACKLOG.md → "Sprint 2"

### 2. Universal Parser Phase 2 — Portal Frontend
**Приоритет:** ВЫСОКИЙ
**Что делать:**
- Parse preview UI (summary, sheets, work types)
- "Send to Kiosk" кнопки из preview
- Parse status indicator
- Monolit/Registry/URS "Load from Portal" option
- См. BACKLOG.md → пункт 7

### 3. Pump Calculator — TOVModal интеграция
**Приоритет:** СРЕДНИЙ
**Что делать:**
- `handlePumpRentalChange` в TOVModal
- `pumpCost` в footer breakdown
- auto-save для PumpRentalSection
- См. BACKLOG.md → пункт 5

### 4. Node.js 20.x / 22.x обновление
**Приоритет:** СРЕДНИЙ
- Node.js 18.x EOL
- Обновить `.nvmrc`, протестировать, задеплоить

### 5. Document Accumulator → Cloud SQL
**Приоритет:** НИЗКИЙ
- concrete-agent: in-memory → persistent storage
- File size validation + temp file cleanup

---

## ⏳ Ожидает действий пользователя

| Задача | Что нужно | Статус |
|--------|-----------|--------|
| MASTER_ENCRYPTION_KEY | `openssl rand -hex 32` → Secret Manager | Блокирует Sprint 2 |
| Poradna env vars | PERPLEXITY_API_KEY, OPENAI_API_KEY → Secret Manager | Без них — Gemini fallback |
| AI Suggestion SQL | Выполнить `БЫСТРОЕ_РЕШЕНИЕ.sql` в Cloud SQL | Включит ✨ кнопку в Monolit |
| Stripe аккаунт | dashboard.stripe.com → 4 продукта | Блокирует Sprint 3 |
| Google Drive OAuth2 | Cloud Project → Drive API → credentials | Опционально |

---

## Контекст для Claude

Текущее состояние системы:
- **8 сервисов** на GCP (Cloud Run) + Vercel, все ✅
- **LLM:** Vertex AI Gemini (ADC auth, GCP credits)
- **CI/CD:** Cloud Build (5 per-service triggers) + GitHub Actions
- **Тесты:** 336 shared (Monolit) + 159 (URS Matcher)
- **Портал:** 10 модулей active, Sprint 1 Cabinets+Roles done
- **Дизайн:** Digital Concrete / Brutalist Neumorphism, Slate Minimal для Planner
