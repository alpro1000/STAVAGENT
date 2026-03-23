# SESSION 2026-03-23 — Gemini Model Fix + VertexGeminiClient Probe

**Дата:** 2026-03-23
**Ветка:** `claude/fix-worker-teardown-tYAkq`
**Коммиты:** 2

---

## Проблема

`gemini-2.5-flash-lite` возвращает 404 в europe-west3:
```
Publisher Model `projects/.../publishers/google/models/gemini-2.5-flash-lite` was not found
```

Несмотря на то, что Google Docs (обновлено 2026-03-16) утверждают, что модель доступна в europe-west3.

### Диагностика

| Проверка | Результат |
|----------|-----------|
| `roles/aiplatform.user` на SA | ✅ Есть |
| Vertex AI API включен | ✅ `aiplatform.googleapis.com` |
| `gemini-2.5-flash` работает | ✅ Подтверждено |
| `gemini-2.5-flash-lite` | ❌ 404 (баг Google или не раскатана) |

### Причина ошибки в коде

`VertexGenerativeModel()` конструктор **не валидирует** существование модели. Ошибка 404 происходит только при вызове `generate_content()`. Fallback-цикл в `__init__` ловил исключение конструктора, но конструктор никогда не падал — он просто создавал объект с несуществующей моделью.

---

## Коммит 1: FIX: VertexGeminiClient probe call + class-level cache

### Изменения

**concrete-agent/packages/core-backend/app/core/gemini_client.py:**
- Добавлен **probe call** (`"Reply with exactly: ok"`) при первой инициализации — каждая модель тестируется реальным запросом
- Если probe 404 → автоматический переход к следующей модели в списке
- **Class-level cache** (`_validated_model_cls`, `_validated_model_name`) — probe запускается ОДИН РАЗ на весь процесс
- Все последующие `VertexGeminiClient()` (orchestrator, price_parser, passport_enricher, routes_llm_status) переиспользуют результат мгновенно
- Логирование версии SDK (`google-cloud-aiplatform X.Y.Z`) для диагностики

**Файлы (15 штук):**
- `app/core/gemini_client.py` — probe call + cache (основной фикс)
- `app/core/config.py` — default model
- `app/services/passport_enricher.py` — model references
- `app/api/routes_kb_research.py` — model references
- `app/services/price_parser/llm_client.py` — comment update
- `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml`, `cloudbuild.yaml` — env vars
- `concrete-agent/render.yaml`, `.env.example` — defaults
- `URS_MATCHER_SERVICE/backend/.env.example` — defaults
- `stavagent-portal/backend/src/routes/connections.js` — model override
- `CLAUDE.md` — documentation

---

## Коммит 2: FIX: switch default from gemini-2.5-flash-lite to gemini-2.5-flash

### Изменения

Полный переход дефолта на `gemini-2.5-flash` (подтверждённо работающую модель) во **всех сервисах**:

| Сервис | Файлы |
|--------|-------|
| concrete-agent | `config.py`, `gemini_client.py`, `passport_enricher.py`, `routes_kb_research.py`, `.env.example`, `render.yaml` |
| URS_MATCHER_SERVICE | `llmConfig.js`, `geminiBlockClassifier.js`, `.env.example` |
| Monolit-Planner | `formwork-assistant.js` |
| stavagent-portal | `connections.js` |
| Cloud Build | `cloudbuild.yaml`, `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml` |
| Docs | `CLAUDE.md` |

### VERTEX_MODELS fallback порядок (после фикса)

```python
VERTEX_MODELS = [
    "gemini-2.5-flash",         # ✅ GA: verified working in europe-west3
    "gemini-2.5-flash-lite",    # ❌ 404 as of 2026-03-23 (kept as fallback)
    "gemini-2.5-pro",           # ✅ GA: expensive, last resort
]
```

---

## Cloud Run деплой (выполнен пользователем)

```bash
gcloud run services update concrete-agent \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --region europe-west3
# → Revision concrete-agent-00068-hzt deployed, 100% traffic
```

---

## IAM проверка (полный вывод)

SA `1086027517695-compute@developer.gserviceaccount.com` имеет роли:
- `roles/aiplatform.user` ✅
- `roles/artifactregistry.admin`
- `roles/artifactregistry.writer`
- `roles/cloudsql.client`
- `roles/iam.serviceAccountUser`
- `roles/logging.logWriter`
- `roles/run.admin`
- `roles/secretmanager.secretAccessor`
- `roles/storage.admin`

---

## Выводы

1. **Google Docs могут врать** — `gemini-2.5-flash-lite` значится как доступная в europe-west3, но возвращает 404
2. **Probe call обязателен** — конструктор `VertexGenerativeModel()` не валидирует модель
3. **Class-level cache** предотвращает лишние LLM-вызовы при создании множества клиентов
4. **Всегда используй `gemini-2.5-flash`** как дефолт до появления подтверждения что flash-lite работает

---

## ВАЖНО: Правило документирования

**КАЖДУЮ сессию работы нужно документировать:**
1. Создать файл `docs/SESSION_YYYY-MM-DD_<ТЕМА>.md`
2. Записать: проблема → диагностика → решение → изменённые файлы → выводы
3. Обновить `CLAUDE.md` (раздел Backlog/Completed)
4. Обновить `NEXT_SESSION.md` (что делать дальше)
5. Обновить `BACKLOG.md` (если появились новые задачи)
6. Обновить `CURRENT_STATUS_SUMMARY.md` (если статус изменился)
