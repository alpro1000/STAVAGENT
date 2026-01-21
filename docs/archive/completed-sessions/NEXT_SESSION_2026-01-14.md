# 📋 Задачи на следующую сессию - 2026-01-14

## 🔴 КРИТИЧНЫЕ (Сделать сегодня)

### 1. Увеличить timeout для парсинга больших документов
**Проблема:** PDF (58 страниц) обрабатывался **64 секунды**, timeout 30s → AbortError

**Логи:**
```
08:52:45 - Начало парсинга PDF (1.6MB, 58 pages)
08:53:49 - Завершение (64 секунды)
ERROR: AbortError - timeout 30s exceeded
```

**Решение:**
```typescript
// DocumentSummary.tsx:162
const timeoutId = setTimeout(() => controller.abort(), 120000); // 30s → 120s
```

**Файлы:**
- `stavagent-portal/frontend/src/components/portal/DocumentSummary.tsx:162`

**Приоритет:** 🔴 КРИТИЧНО (пользователи не могут загружать документы >30s)

---

### 2. Manual Deploy на Render (Parser Fix)
**Проблема:** Production backend на старом коде с багом `'str' object has no attribute 'suffix'`

**Доказательства:**
- ✅ Код в main правильный (commit `4217880`)
- ❌ Production ещё на старой версии (error в логах)

**Действия:**
1. Открыть https://dashboard.render.com/
2. Найти сервис **concrete-agent**
3. Нажать **"Manual Deploy"** → **"Deploy latest commit"**
4. Подождать 2-3 минуты
5. Проверить: `curl https://concrete-agent.onrender.com/health`

**Приоритет:** 🔴 КРИТИЧНО (блокирует работу Document Summary)

---

### 3. Backend URL 404 Error
**Проблема:**
```
GET https://stavagent-portal-backend.onrender.com/api/portal/projects 404
```

**Причина:** URL не существует на Render

**Решение:**
- Проверить `.env.production` в stavagent-portal/frontend
- Исправить `VITE_PORTAL_API_URL` на правильный URL
- Задеплоить stavagent-portal backend (если ещё не задеплоен)

**Файлы:**
- `stavagent-portal/frontend/.env.production`
- `stavagent-portal/frontend/src/components/portal/DocumentSummary.tsx:120`

**Приоритет:** 🔴 КРИТИЧНО (нельзя сохранять проекты)

---

## ⚠️ ВЫСОКИЙ ПРИОРИТЕТ (На этой неделе)

### 4. Оптимизировать Multi-Role промпты (67% reduction)
**Проблема:**
- `document_validator.md` = **1,521 строка** (~15,000 tokens)
- Multi-Role (6 ролей) = **90,000 tokens** только на промпты!

**План сокращения:**

**Удалить:**
- ❌ Секция 6: CZECH TABLES (300 строк) → переместить в Knowledge Base
- ❌ Секция 11: TEMPERATURE (не работает)
- ❌ Секция 16: SELF-IMPROVEMENT (не работает)
- ❌ Секция 4+9: Объединить дублирующиеся ERROR PATTERNS
- ❌ Секция 15: EXAMPLES (200 строк) → сократить до 1 примера

**Оставить:**
- ✅ Секция 1-2: IDENTITY + KNOWLEDGE (100 строк)
- ✅ Секция 7: OUTPUT FORMAT (50 строк)
- ✅ Секция 12-13: ANTI-FALSE-POSITIVE + CONFIDENCE (50 строк)
- ✅ Секция 14: KB INTEGRATION (100 строк)

**Результат:**
- 1,521 строк → **500-700 строк** (67% reduction)
- 15,000 tokens → **5,000-7,000 tokens**
- Экономия: **10,000 tokens per request**
- Стоимость: $0.48 → **$0.30 per Multi-Role** (38% cheaper)

**Задачи:**
- [ ] Оптимизировать document_validator.md
- [ ] Проанализировать остальные 5 ролей:
  - structural_engineer.md
  - concrete_specialist.md
  - cost_estimator.md
  - standards_checker.md
  - orchestrator.md (Project Manager)

**Файлы:**
- `concrete-agent/packages/core-backend/app/prompts/roles/document_validator.md`
- `concrete-agent/packages/core-backend/app/prompts/roles/*.md`

---

### 5. Document Accumulator - Database Migration
**Проблема:** In-memory storage → потеря данных при рестарте

**Блокеры для Production:**

| Проблема | Impact | Решение |
|----------|--------|---------|
| In-memory storage | ❌ Данные теряются при рестарте | PostgreSQL migration |
| No file size limits | ❌ DoS атака (100GB upload) | MAX_FILE_SIZE = 100 MB |
| Race conditions | ❌ Concurrent uploads fail | Thread-safe singleton |
| No retry logic | ❌ Temporary errors = FAILED | 3 retries + exponential backoff |

**Задачи:**
- [ ] Создать PostgreSQL schema (tables: projects, files, folders, caches, versions)
- [ ] Добавить file size limit + streaming upload
- [ ] Thread-safe singleton (double-checked locking)
- [ ] Retry logic для parse failures
- [ ] Async LLM calls (убрать ThreadPoolExecutor)

**Файлы:**
- `concrete-agent/packages/core-backend/app/services/document_accumulator.py`
- `concrete-agent/packages/core-backend/migrations/` (новые миграции)

**Готовность к Production:** 60% → **95%** после этих фиксов

---

## 🟢 СРЕДНИЙ ПРИОРИТЕТ (На следующей неделе)

### 6. Создать PR с modal fixes ✅
**Status:** Код готов, коммит запушен

**Коммит:** `d81b685` - FIX: Document Summary modal error handling

**Изменения:**
- ✅ ESC key handler для закрытия модала
- ✅ Timeout 30s (НУЖНО УВЕЛИЧИТЬ до 120s!)
- ✅ Кнопки "Zkusit znovu" / "Zavřít"
- ✅ Понятные сообщения об ошибках

**Задачи:**
- [ ] Создать PR:
  ```bash
  gh pr create \
    --title "FIX: Document Summary error handling improvements" \
    --body "Modal freeze fix, timeout, better errors"
  ```
- [ ] Merge to main
- [ ] Deploy to production

---

### 7. Google Drive Integration - Setup (15 минут)
**Status:** Код готов (Day 1 + Day 2), нужна конфигурация

**Задачи:**
1. [ ] Создать Google Cloud Project
2. [ ] Включить Google Drive API
3. [ ] Создать OAuth2 credentials (External consent screen)
4. [ ] Добавить redirect URI: `https://concrete-agent.onrender.com/api/v1/google/callback`
5. [ ] Сгенерировать encryption keys:
   ```bash
   openssl rand -base64 32  # GOOGLE_CREDENTIALS_ENCRYPTION_KEY
   openssl rand -hex 32     # GOOGLE_WEBHOOK_SECRET_KEY
   ```
6. [ ] Добавить 6 env variables на Render (concrete-agent)
7. [ ] Проверить работу в Portal → "Shrnutí dokumentu"

**Гайд:** `GOOGLE_DRIVE_SETUP.md` (800+ строк, пошаговая инструкция)

---

### 8. Keep-Alive System - Enable (10 минут)
**Status:** Workflow создан, не настроен

**Задачи:**
1. [ ] Сгенерировать secret key: `openssl rand -base64 32`
2. [ ] Добавить `KEEP_ALIVE_KEY` в GitHub Secrets
3. [ ] Добавить `KEEP_ALIVE_KEY` на Render (3 сервиса):
   - concrete-agent
   - monolit-planner
   - stavagent-portal
4. [ ] Redeploy сервисы на Render
5. [ ] Enable workflow в GitHub Actions
6. [ ] Проверить через 15 минут (сервисы не должны sleep)

**Файлы:**
- `.github/workflows/keep-alive.yml` (готов)
- `KEEP_ALIVE_SETUP.md` (460 строк инструкций)

**Benefit:** Сервисы warm 24/7, нет cold start (30s → instant)

---

## 📊 АНАЛИЗ ТЕКУЩЕЙ СЕССИИ

### Успехи ✅
1. ✅ **Modal error handling** - fix создан и запушен (commit d81b685)
2. ✅ **Глубокий анализ Document Accumulator** - найдено 7 критичных проблем
3. ✅ **Multi-Role промпты** - проанализирован Document Validator (1521 строка!)
4. ✅ **Parser работает** - успешно извлёк позиции из 58-страничного PDF

### Проблемы ❌
1. ❌ **Timeout 30s недостаточно** - документ обрабатывался 64 секунды
2. ❌ **Production не задеплоен** - старый код с багом парсера
3. ❌ **Backend URL 404** - stavagent-portal-backend не существует
4. ❌ **Промпты слишком длинные** - 90k tokens на 6 ролей

### Метрики
- **Парсинг PDF:** 64 секунды (58 страниц, 1.6MB)
- **Узкое место:** Страница 42 (3 таблицы = 44 секунды!)
- **Извлечено:** ~80 позиций из таблиц

---

## 🎯 ПРИОРИТЕТ ВЫПОЛНЕНИЯ

### Сегодня (2-3 часа):
1. ✅ Увеличить timeout до 120s
2. ✅ Manual Deploy на Render (concrete-agent)
3. ✅ Исправить Backend URL (stavagent-portal)
4. ✅ Создать PR с modal fixes

### Завтра (4-6 часов):
5. 🔍 Оптимизировать Multi-Role промпты (6 ролей)
6. 🗄️ Database migration для Document Accumulator

### На неделе (8-12 часов):
7. 🔐 Google Drive setup (15 минут)
8. ⏰ Keep-Alive setup (10 минут)
9. ⚡ Parser optimization (страница 42 = 44 секунды!)

---

## 📝 QUICK COMMANDS

### Проверить Production:
```bash
# Health check
curl https://concrete-agent.onrender.com/health

# Test parse endpoint
curl -X POST https://concrete-agent.onrender.com/api/v1/accumulator/summarize/file \
  -F "file=@test.pdf" -F "language=cs" \
  --max-time 120

# Check deployed version (git commit)
curl https://concrete-agent.onrender.com/api/v1/health | jq .git_commit
```

### Локальная разработка:
```bash
# Frontend (Portal)
cd stavagent-portal/frontend
npm run dev  # Port 3000

# Backend (CORE)
cd concrete-agent/packages/core-backend
python -m uvicorn app.main:app --reload --port 8000
```

### Git commands:
```bash
# Создать PR
gh pr create \
  --title "FIX: Document Summary timeout + error handling" \
  --body "Increases timeout to 120s, adds better error messages"

# Проверить статус
git status
git log --oneline -5
```

---

**Создано:** 2026-01-14 09:05
**Автор:** Claude Code
**Ветка:** `claude/disable-auth-production-tU6kP`
**Последний коммит:** `d81b685`
**Status:** Код готов к PR, production needs deploy
