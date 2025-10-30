# Perplexity Integration - EXTERNAL_RESOLVER

**Интеграция Perplexity API для поиска актуальных чешских норм в реальном времени**

---

## 🌐 Что такое EXTERNAL_RESOLVER?

EXTERNAL_RESOLVER — это feature flag из STAV EXPERT v2, который позволяет системе искать **актуальные** чешские строительные нормы (ČSN) в интернете через Perplexity API.

**Когда использовать:**
- ✅ Когда нужны **текущие/актуальные** нормы
- ✅ Когда локальная база знаний устарела
- ✅ Когда нужна **верификация с источниками**

**Когда НЕ использовать:**
- ❌ Для стандартных вопросов (монтаж, технологии)
- ❌ Когда скорость критична (Perplexity медленнее локальной БЗ)

---

## ⚙️ Настройка

### 1. Получить API ключ Perplexity

1. Зарегистрироваться на [perplexity.ai](https://www.perplexity.ai)
2. Перейти в [API Settings](https://www.perplexity.ai/settings/api)
3. Создать новый API ключ
4. Скопировать ключ (начинается с `pplx-`)

### 2. Настроить переменные окружения

**.env:**
```bash
# Required
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (defaults shown)
ALLOW_WEB_SEARCH=true                # Enable web search
USE_PERPLEXITY_PRIMARY=false         # Use as fallback (recommended)
PERPLEXITY_CACHE_TTL=86400           # Cache results for 24h (seconds)
LOG_PERPLEXITY_CALLS=true            # Log API calls for debugging

# Domains to search (default)
PERPLEXITY_SEARCH_DOMAINS=["podminky.urs.cz", "urs.cz", "technicke-normy-csn.cz", "csnonline.cz", "unmz.cz"]
```

### 3. Проверить статус

При запуске FastAPI приложения вы увидите:
```
✅ EXTERNAL_RESOLVER enabled - Perplexity available for current norms
```

Или если не настроен:
```
⚠️ EXTERNAL_RESOLVER disabled - using local knowledge only
```

---

## 🔍 Как работает автоматическое определение?

Система автоматически решает, нужен ли поиск в интернете, на основе **ключевых слов** в вопросе.

### Триггеры (запускают поиск):

**1. Явный запрос интернета:**
```
❓ "Najdi na internetu normy pro beton"
❓ "Search online for current standards"
❓ "Найди в интернете текущие нормы"
```

**2. Комбинация "актуальный/новый" + "норма":**
```
❓ "Jaké jsou aktuální normy ČSN pro beton C30/37?"
❓ "What are the latest standards for concrete?"
❓ "Какие текущие нормы для армирования?"
```

**Детектируемые слова:**

| Категория | Ключевые слова |
|-----------|----------------|
| **Актуальность** | aktuální, current, текущ, latest, nové, new, нов, platné, valid, действующ, poslední, recent |
| **Нормы** | norma, norm, норм, čsn, standard, předpis |
| **Интернет** | internet, web, online, perplexity |

### НЕ триггеры (используют локальную БЗ):

```
❌ "Jak montovat vodoměrnou šachtu?"         # нет "current"
❌ "Jaké normy pro beton?"                   # нет "current/latest"
❌ "Co je to bednění?"                       # общий вопрос
```

---

## 📡 API Usage

### Пример запроса с Perplexity

**POST** `/api/chat/assistant`

```json
{
  "question": "Jaké jsou aktuální normy ČSN pro beton C30/37?",
  "context": {
    "project_name": "Most přes potok"
  }
}
```

**Response:**
```json
{
  "answer": "Podle aktuálních norem nalezených online:\n\n**ČSN EN 206:2021+A2 - Beton - Specifikace, vlastnosti, výroba a shoda**\n\nPro beton C30/37 platí:\n- Minimální obsah cementu: 280 kg/m³\n- Maximální w/c poměr: 0.55\n- Třída konzistence: doporučeno S3 nebo S4\n\n🔍 Zdroje:\n- Perplexity: https://technicke-normy-csn.cz/csn-en-206\n- ČSN Normy\n- Knowledge Base",
  "relevant": true,
  "sources": [
    "Perplexity: https://technicke-normy-csn.cz/csn-en-206",
    "Perplexity: https://csnonline.cz/...",
    "ČSN Normy",
    "Knowledge Base"
  ],
  "related_norms": ["ČSN EN 206:2021+A2", "ČSN EN 1992-1-1"],
  "confidence": 0.92,
  "rfi": [],
  "language": "cs"
}
```

### Без Perplexity (локальная БЗ)

```json
{
  "question": "Jak montovat vodoměrnou šachtu?"
}
```

Response будет из локальной базы знаний (быстрее).

---

## 🧠 Внутренняя логика

### Последовательность обработки:

1. **Детекция языка** (`_detect_language`)
   - Определяет CS/RU/EN

2. **Проверка релевантности** (`is_construction_related`)
   - Фильтрует нестроительные темы

3. **Проверка триггеров EXTERNAL_RESOLVER** (`_should_use_external_search`)
   - Ищет ключевые слова "current" + "norm"

4. **Поиск в Perplexity** (если триггер сработал)
   - `_search_current_norms()` → async вызов Perplexity
   - Извлекает work_type: "betonové práce", "armování"
   - Извлекает material: "C30/37", "ocel"

5. **Построение промпта** (`_build_prompt`)
   - Добавляет секцию "🌐 AKTUÁLNÍ NORMY Z INTERNETU"
   - Включает найденные нормы и источники

6. **Вызов Claude** с обогащённым промптом

7. **Извлечение метаданных**
   - Нормы, confidence, RFI, sources

8. **Добавление внешних источников**
   - "Perplexity: [URL]" в массив sources

---

## 🔧 Методы в ConstructionAssistant

### 1. `_should_use_external_search(question: str) -> bool`
Проверяет, нужен ли внешний поиск.

**Returns:**
- `True` - если вопрос содержит "current/latest" + "norm/standard"
- `False` - используем локальную БЗ

### 2. `_search_current_norms(question, work_type, material) -> Dict`
Асинхронный поиск через Perplexity.

**Returns:**
```python
{
    "standards": [
        {"code": "ČSN EN 206", "name": "Beton - Specifikace...", "relevant": True}
    ],
    "sources": ["https://technicke-normy-csn.cz/..."],
    "raw_response": "Full Perplexity response...",
    "searched": True
}
```

### 3. `_extract_work_type_from_question(question: str) -> str`
Классифицирует тип работы из вопроса.

**Returns:**
- "betonové práce"
- "armování, ocelové konstrukce"
- "základy a konstrukce"
- "zemní práce"
- "bednění"
- "montážní práce"
- "obecné stavební práce"

### 4. `_extract_material_from_question(question: str) -> Optional[str]`
Извлекает материал из вопроса (регексом).

**Examples:**
- "beton C30/37" → "C30/37"
- "armatura B500B" → "ocel, armatura"
- "cihla" → "zdivo"

---

## 💰 Стоимость Perplexity API

**Model:** `sonar-pro` (используется для цитирований)

**Pricing (примерно):**
- $5 за 1000 запросов
- ~$0.005 за запрос

**Оптимизация:**
- Кэширование результатов (24h по умолчанию)
- Срабатывает только при явном запросе "current/latest"
- Fallback на локальную БЗ при ошибках

**Среднее использование:**
- ~10-20 запросов в день = $0.05-0.10/день = $1.50-3.00/месяц

---

## 🧪 Тестирование

### Вопросы, которые ТРИГГЕРЯТ Perplexity:

**Czech:**
```bash
curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "Jaké jsou aktuální normy ČSN pro beton C30/37?"}'
```

**Russian:**
```bash
curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "Какие текущие нормы для бетона C30/37?"}'
```

**English:**
```bash
curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the latest standards for C30/37 concrete?"}'
```

**Explicit internet:**
```bash
curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "Найди в интернете нормы для армирования"}'
```

### Вопросы, которые НЕ ТРИГГЕРЯТ:

```bash
# Используют локальную БЗ (быстрее)
curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "Jak montovat vodoměrnou šachtu?"}'

curl -X POST http://localhost:8000/api/chat/assistant \
  -H "Content-Type: application/json" \
  -d '{"question": "Jaké normy pro beton?"}'  # нет "current"
```

---

## 📊 Логи

При срабатывании EXTERNAL_RESOLVER вы увидите:

```
INFO: 🏗️  STAV EXPERT: Jaké jsou aktuální normy ČSN pro beton C30/37?...
INFO: 📝 Detected language: cs
INFO: 🌐 User requested current/latest norms - using EXTERNAL_RESOLVER
INFO: 🔍 EXTERNAL_RESOLVER: Searching current norms for: Jaké jsou aktuální normy ČSN pro beton C30/37?...
INFO: ✅ Found 3 standards via Perplexity
INFO: ✅ Added 2 external sources
```

---

## 🛡️ Безопасность и Zero Hallucination

**EXTERNAL_RESOLVER обеспечивает:**

1. **Только реальные источники**
   - Perplexity возвращает URLs
   - Все цитаты проверяемы

2. **Предупреждение в промпте**
   - Claude получает: "POZOR: Tyto informace jsou z internetu. Použij je jako doplňkový zdroj."

3. **Fallback на локальную БЗ**
   - При ошибке Perplexity продолжает работу

4. **Прозрачность источников**
   - Источники отмечены: "Perplexity: [URL]"

---

## 🚀 Production Tips

### Render.com Deployment

В `render.yaml`:
```yaml
envVars:
  - key: PERPLEXITY_API_KEY
    sync: false  # Secret, set in Render dashboard

  - key: ALLOW_WEB_SEARCH
    value: true

  - key: PERPLEXITY_CACHE_TTL
    value: 86400  # 24h cache
```

### Мониторинг

Включите логирование:
```bash
LOG_PERPLEXITY_CALLS=true
```

Следите за:
- Количество вызовов Perplexity в день
- Success rate поиска
- Время ответа (обычно 2-5 сек)

---

## 🔗 Ссылки

- **Perplexity API Docs:** https://docs.perplexity.ai
- **Perplexity Dashboard:** https://www.perplexity.ai/settings/api
- **ČSN Normy:** https://csnonline.cz
- **Technické normy:** https://technicke-normy-csn.cz
- **ÚRS:** https://podminky.urs.cz

---

## ❓ FAQ

**Q: Как отключить EXTERNAL_RESOLVER?**
```bash
ALLOW_WEB_SEARCH=false
# или не устанавливайте PERPLEXITY_API_KEY
```

**Q: Можно ли использовать Perplexity для всех вопросов?**
```bash
USE_PERPLEXITY_PRIMARY=true  # не рекомендуется (дороже и медленнее)
```

**Q: Что если Perplexity вернул неправильные данные?**
- Claude получает предупреждение: "информация из интернета"
- Используйте как дополнительный, не основной источник
- Confidence score учитывает качество источника

**Q: Сколько времени занимает поиск?**
- Обычно 2-5 секунд
- Кэшируется на 24 часа

---

**Создано с ❤️ для чешского строительства**
