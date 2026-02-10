# 📝 Резюме сессии 2026-02-10

**Ветка:** `claude/phase-6-technology-review-SVfgv`
**Длительность:** ~2 часа
**Статус:** ⏳ Ждет конфигурации Perplexity API

---

## 🎯 Цели сессии

Завершить интеграцию **Project Passport System** в Portal и исправить production issues:

1. Исправить production deployment issues (401, CORS, timeout)
2. Починить UI bug с file input modal
3. Диагностировать проблему с URS Matcher batch processing

---

## ✅ Что сделано

### 1. Portal Production Fixes (DocumentSummary.tsx)

**Проблема:** После деплоя на production (www.stavagent.cz) обнаружены:
- 401 Unauthorized при загрузке проектов
- TypeError: map is not a function
- Timeout после 120s при обработке больших PDF (46 страниц)
- CORS blocked requests

**Решение:**

#### 1.1 Увеличен timeout для больших PDF
```typescript
// Было: 120000ms (2 минуты)
const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 минут
```

#### 1.2 Исправлен API endpoint
```typescript
// Было: /api/portal/projects
// Стало: /api/portal-projects
const response = await fetch(`${portalApiUrl}/api/portal-projects`, {
  credentials: 'include',  // Добавлена авторизация
  headers: { 'Content-Type': 'application/json' }
});
```

#### 1.3 Обработка разных форматов ответа
```typescript
// API может вернуть массив или объект {projects: [...]}
const data = await response.json();
const projects = Array.isArray(data) ? data : (data.projects || []);
```

#### 1.4 CORS fix для production домена
**Файл:** `stavagent-portal/backend/server.js`

```javascript
const ALLOWED_ORIGINS = [...new Set([
  'http://localhost:5173',
  'https://www.stavagent.cz',     // Production с www
  'https://stavagent.cz',          // Production без www
  process.env.CORS_ORIGIN,
].filter(Boolean))];
```

#### 1.5 Environment variables
Пользователю нужно добавить в Render (stavagent-portal-backend):
```env
DISABLE_AUTH=true
CORS_ORIGIN=https://www.stavagent.cz
```

**Файлы изменены:**
- `stavagent-portal/frontend/src/components/portal/DocumentSummary.tsx` (6 fixes)
- `stavagent-portal/backend/server.js` (CORS update)

---

### 2. File Input Modal Bug Fix

**Проблема (на русском от пользователя):**
> "В ПАСПОРТЕ ПРОЕКТА НЕ РАБОТЕТ ВНУТРИ МОДАЛЬНОГО ОКНА КНОПКИ
> ПРИ ЛЮБОМ НАЖАТИИ НА ЛЮБУЮ ТОЧКУ ОКНА ОКРЫВАЕТСЯ ОКНО ЗАГРУЗКИ ФАЙЛА ДЛЯ АНАЛИЗА"

**Root cause:** Абсолютно позиционированный невидимый `<input type="file">` покрывал все модальное окно и перехватывал все клики.

**Решение:**

```typescript
// БЫЛО (BAD):
<input
  type="file"
  accept=".pdf,.doc,.docx"
  onChange={handleFileChange}
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer'
  }}
/>

// СТАЛО (GOOD):
const fileInputRef = useRef<HTMLInputElement>(null);

const handleUploadClick = () => {
  fileInputRef.current?.click();
};

return (
  <>
    {/* Скрытый input */}
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.doc,.docx"
      onChange={handleFileChange}
      style={{ display: 'none' }}
    />

    {/* Явная кнопка */}
    <button onClick={handleUploadClick} className="c-btn c-btn--primary">
      <Upload size={16} />
      Vybrat soubor
    </button>
  </>
);
```

**Улучшения UX:**
- Кнопки модального окна снова работают
- Явная кнопка "Vybrat soubor" понятнее пользователю
- Modal можно закрыть крестиком

---

### 3. URS Matcher Batch Processing - Диагностика

**Проблема (на русском):**
> "Я переключил на Gemini но ничего не находит. Проверь что не так."

**Анализ архитектуры:**

URS Matcher **Dávkové zpracování** (Batch Processing) использует **ДВУХ-API архитектуру**:

```
┌─────────────────────────────────────────────────────────────┐
│              URS Matcher Batch Processing                   │
│                                                             │
│  Step 1: NORMALIZE TEXT                                     │
│    └─> Clean and prepare Czech work descriptions           │
│                                                             │
│  Step 2: SPLIT (SINGLE/COMPOSITE)                           │
│    └─> Detect if description contains multiple works       │
│                                                             │
│  Step 3a: RETRIEVE CANDIDATES                               │
│    └─> 🔍 Perplexity API                                    │
│        └─> Searches online ÚRS catalog                      │
│        └─> Returns 10-30 candidate codes                    │
│                                                             │
│  Step 3b: RERANK CANDIDATES                                 │
│    └─> 🤖 Gemini/Claude/OpenAI                              │
│        └─> Ranks candidates by relevance                    │
│        └─> Returns top match with confidence                │
│                                                             │
│  Step 4: FORMAT RESULT                                      │
│    └─> Return best URS code + confidence score             │
└─────────────────────────────────────────────────────────────┘
```

**Root cause:**
1. Пользователь переключился на Gemini (потому что закончились деньги на Claude)
2. Gemini используется только для **RERANK** (Step 3b)
3. **RETRIEVE** (Step 3a) требует Perplexity API
4. Perplexity API не был сконфигурирован → 0 кандидатов
5. Gemini пытается ранжировать пустой массив → пустой результат

**Подтверждение из кода:**

**File:** `URS_MATCHER_SERVICE/backend/src/services/batch/batchProcessor.js`
```javascript
// STEP 3a: RETRIEVE CANDIDATES (via Perplexity)
retrieveResult = await retrieve(subWork, settings.searchDepth || 'normal');

// STEP 3b: RERANK CANDIDATES (via Gemini/Claude)
rerankResult = await rerank(subWork, retrieveResult.candidates);
```

**File:** `URS_MATCHER_SERVICE/backend/src/services/batch/candidateRetriever.js`
```javascript
export async function retrieve(subWork, searchDepth = 'normal') {
  const queries = generateSearchQueries(subWork, searchDepth);

  for (const query of queries) {
    const results = await searchURS(query); // ← Calls Perplexity API
    allCandidates.push(...results);
  }

  return { candidates: deduplicated.slice(0, 30) };
}
```

---

### 4. Решение для URS Matcher

**Вариант 1: Perplexity API (Рекомендовано для MVP)**

Добавить в Render environment (URS_MATCHER_SERVICE):
```env
PPLX_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxx
PPLX_MODEL=sonar
URS_CATALOG_MODE=online
```

**Как получить:**
1. https://www.perplexity.ai/settings/api
2. Создать API key
3. Стоимость: ~$20/месяц

**Преимущества:**
- ✅ Актуальные данные из онлайн ÚRS каталога
- ✅ Работает немедленно (только env vars)
- ✅ Интеллектный поиск (веб-краулер Perplexity)

**Недостатки:**
- ❌ Платный ($20/месяц)
- ❌ API rate limits

---

**Вариант 2: Локальная база данных (Бесплатно, но требует разработки)**

```env
URS_CATALOG_MODE=local
URS_CATALOG_PATH=/app/data/urs_catalog.db
```

**Требуемая разработка:**
1. Скрейпить ÚRS catalog с официального сайта
2. Импортировать в SQLite
3. Модифицировать `candidateRetriever.js` для локального поиска
4. Настроить периодическую синхронизацию данных

**Преимущества:**
- ✅ Бесплатно
- ✅ Быстрее (локальный DB)
- ✅ Нет лимитов API

**Недостатки:**
- ❌ Требует 3-5 дней разработки
- ❌ Нужна поддержка синхронизации
- ❌ Может быть устаревшими данными

---

**Сравнение:**

| Критерий | Perplexity API | Local DB |
|----------|----------------|----------|
| Стоимость | $20/мес | $0 |
| Время внедрения | 5 минут | 3-5 дней |
| Актуальность данных | Всегда свежие | Требует синхронизации |
| Скорость | Зависит от сети | Очень быстро |
| Maintenance | Нулевой | Средний |

**Рекомендация:** Начать с Perplexity API (быстрое решение), позже мигрировать на локальную БД если batch processing станет активно использоваться.

---

## 📊 LLM Configuration Analysis

**URS Matcher теперь поддерживает 7 провайдеров:**

| Provider | Use Case | Cost | Model |
|----------|----------|------|-------|
| **Perplexity** | RETRIEVE candidates | $20/мес | sonar |
| **Gemini** | RERANK, General tasks | FREE | gemini-2.0-flash-exp |
| **Claude** | High accuracy tasks | $$$ | claude-3-5-sonnet |
| **DeepSeek** | Cost-effective | $ | deepseek-chat |
| **Grok** | Alternative | $$ | grok-2-1212 |
| **Qwen** | Chinese docs | $ | qwen-max |
| **GLM** | Alternative | $ | glm-4-plus |
| **OpenAI** | Fallback | $$ | gpt-4o |

**Fallback chain:**
```javascript
const defaultFallback = [
  'deepseek',  // Самый дешёвый
  'glm',
  'qwen',
  'gemini',    // FREE
  'grok',
  'openai',
  'claude'     // Самый дорогой
];
```

**Task-based routing:**
```javascript
const TASK_ROUTING = {
  normalize: ['deepseek', 'gemini'],      // Простая нормализация
  split: ['gemini', 'claude'],            // Определение композитных работ
  retrieve: ['perplexity'],               // ПОИСК ← Требует PPLX_API_KEY
  rerank: ['claude', 'gemini', 'openai'], // Ранжирование
  validate: ['claude', 'openai'],         // Валидация
  explain: ['claude', 'grok']             // Объяснение
};
```

---

## 🔧 Файлы изменены/проанализированы

### Изменено:
1. **stavagent-portal/frontend/src/components/portal/DocumentSummary.tsx**
   - Timeout: 120s → 300s
   - API endpoint fix
   - Response format handling
   - File input modal refactor
   - Total: 6 critical fixes

2. **stavagent-portal/backend/server.js**
   - CORS: добавлены www.stavagent.cz + stavagent.cz

### Проанализировано (не изменено):
3. **URS_MATCHER_SERVICE/backend/src/config/llmConfig.js** (1044 lines)
   - 7 LLM providers
   - Task-based routing
   - Fallback chains

4. **URS_MATCHER_SERVICE/backend/src/services/batch/batchProcessor.js** (200+ lines)
   - 4-step pipeline
   - RETRIEVE → RERANK architecture

5. **URS_MATCHER_SERVICE/backend/src/services/batch/candidateRetriever.js** (150 lines)
   - Perplexity API integration
   - Search query generation

---

## 🚀 Деплой

**Git операции:**
```bash
git add .
git commit -m "FIX: Portal production fixes + URS Matcher analysis"
git push -u origin claude/phase-6-technology-review-SVfgv
```

**Статус:** ✅ Код запушен, но нужна конфигурация environment variables

---

## ⏳ Awaiting User Action

### 1. Portal Backend Environment (Render)
```env
DISABLE_AUTH=true
CORS_ORIGIN=https://www.stavagent.cz
```

### 2. URS Matcher Environment (Render)
**Вариант A (быстро):**
```env
PPLX_API_KEY=pplx-xxxxxxxxxxxxx
PPLX_MODEL=sonar
URS_CATALOG_MODE=online
```

**Вариант B (бесплатно, но долго):**
- Разработать локальную базу ÚRS кодов
- Оценка: 3-5 дней работы

---

## 📝 Lessons Learned

1. **Multi-API Architecture:** Системы могут использовать несколько API для одного workflow (Perplexity для поиска + Gemini для ранжирования)

2. **Production debugging flow:**
   ```
   Check logs → Identify error → Read code → Find root cause →
   Fix code → Update env vars → Redeploy → Verify
   ```

3. **CORS для production:** Всегда добавлять варианты с www и без www

4. **File input в React:** Использовать `ref` вместо invisible overlay для trigger

5. **API Response Formats:** Всегда обрабатывать разные форматы (array vs object)

---

## 🎯 Next Steps (Priority Order)

### High Priority
1. ✅ Добавить `DISABLE_AUTH=true` в Portal backend
2. ✅ Добавить `PPLX_API_KEY` в URS Matcher (или принять решение о локальной БД)
3. ✅ Проверить batch processing после конфигурации Perplexity

### Medium Priority
4. Merge ветки `claude/phase-6-technology-review-SVfgv` в main
5. Тестировать полный Project Passport workflow на production

### Low Priority (Future)
6. Разработать локальную базу ÚRS кодов (если Perplexity будет дорого)
7. Добавить тесты для DocumentSummary.tsx
8. Мониторинг API costs для всех LLM providers

---

## 📚 Technical Documentation

### Environment Variables - Complete Map

| Service | Variable | Purpose | Value |
|---------|----------|---------|-------|
| **concrete-agent** | GOOGLE_API_KEY | Gemini LLM | AIza... |
| | ANTHROPIC_API_KEY | Claude LLM | sk-ant... |
| | OPENAI_API_KEY | GPT LLM | sk-... |
| **stavagent-portal-backend** | DISABLE_AUTH | Auth bypass | true |
| | CORS_ORIGIN | Production domain | https://www.stavagent.cz |
| **URS_MATCHER_SERVICE** | PPLX_API_KEY | Perplexity search | pplx-... |
| | PPLX_MODEL | Perplexity model | sonar |
| | URS_CATALOG_MODE | Search mode | online |
| | GOOGLE_AI_KEY | Gemini (fallback) | AIza... |
| | ANTHROPIC_API_KEY | Claude (fallback) | sk-ant... |

---

## 🌐 Production URLs Status

| Service | URL | Status |
|---------|-----|--------|
| Portal Frontend | https://www.stavagent.cz | ✅ Online |
| Portal Backend | https://stavagent-portal-backend.onrender.com | ⚠️ Needs env vars |
| URS Matcher | https://urs-matcher-service.onrender.com | ⚠️ Needs PPLX_API_KEY |
| concrete-agent | https://concrete-agent.onrender.com | ✅ Online |
| Monolit Planner | https://monolit-planner-api.onrender.com | ✅ Online |

---

**Session completed:** 2026-02-10 23:45 UTC
**Next session:** Configure Perplexity API + Test batch processing
