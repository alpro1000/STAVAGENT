# Google Cloud Setup Guide
## Максимальное использование $1300 кредитов

**Кредиты:**
- ✅ Free Trial: $300 (90 дней)
- ✅ GenAI App Builder: $1000 (только для Vertex AI Search)

---

## 1. Настройка Vertex AI Search (GenAI кредит $1000)

### Шаг 1: Включить API

```bash
# В Google Cloud Console
1. Открыть https://console.cloud.google.com
2. Выбрать проект: project-947a512a-481d-49b5-81c
3. Поиск → "Vertex AI Agent Builder"
4. Enable API
```

### Шаг 2: Создать Data Store

```bash
# 1. Agent Builder → Create App → Search
# 2. Name: "STAVAGENT Norms Search"
# 3. Data Store → Create new
# 4. Name: "URS_OTSKP_CSN_Norms"
# 5. Type: Unstructured documents
```

### Шаг 3: Загрузить документы

**Что загрузить:**
```
1. ÚRS каталог (PDF) - нормы работ
2. OTSKP каталог (Excel → PDF) - позиции
3. ČSN нормы (релевантные разделы)
```

**Как загрузить:**
```bash
# Через Cloud Storage
gsutil cp urs_catalog.pdf gs://stavagent-norms/
gsutil cp otskp_catalog.pdf gs://stavagent-norms/
gsutil cp csn_norms.pdf gs://stavagent-norms/

# Подключить к Data Store
# Agent Builder → Data Stores → Import from Cloud Storage
# Bucket: stavagent-norms
```

### Шаг 4: Получить Datastore ID

```bash
# В Agent Builder → Data Stores → копировать ID
# Пример: projects/123/locations/global/collections/default_collection/dataStores/abc123

# Добавить в .env:
VERTEX_SEARCH_DATASTORE_ID=abc123
```

---

## 2. Настройка Gemini API (Free Trial $300)

### Шаг 1: Получить API ключ

```bash
# 1. https://aistudio.google.com/app/apikey
# 2. Create API Key
# 3. Копировать ключ
```

### Шаг 2: Добавить в .env

```bash
# concrete-agent/.env
GOOGLE_API_KEY=AIzaSy...
```

### Шаг 3: Установить SDK

```bash
cd concrete-agent/packages/core-backend
pip install google-generativeai
```

---

## 3. Service Account для Vertex AI

### Шаг 1: Создать Service Account

```bash
# Google Cloud Console → IAM & Admin → Service Accounts
# 1. Create Service Account
# 2. Name: stavagent-vertex-search
# 3. Role: Discovery Engine Admin
# 4. Create Key → JSON
```

### Шаг 2: Сохранить ключ

```bash
# Скачать JSON ключ
# Сохранить как: concrete-agent/service-account.json

# Добавить в .env:
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
```

### Шаг 3: Добавить в .gitignore

```bash
echo "service-account.json" >> .gitignore
```

---

## 4. Тестирование интеграции

### Test 1: Vertex AI Search

```python
# test_vertex_search.py
from app.integrations.vertex_search import get_vertex_client

client = get_vertex_client()
matches = await client.search_norms("Бетонирование фундамента C25/30")

for match in matches:
    print(f"{match.norm_code}: {match.title}")
    print(f"  Цена: {match.unit_price_czk} Kč/{match.unit}")
    print(f"  Трудозатраты: {match.labor_hours} ч")
    print(f"  Confidence: {match.confidence:.2f}")
```

### Test 2: Gemini PDF Parser

```python
# test_gemini_parser.py
from app.integrations.gemini_client import get_gemini_client
from pathlib import Path

client = get_gemini_client()
result = await client.parse_smeta_pdf(Path("test_smeta.pdf"))

print(f"Найдено позиций: {len(result['positions'])}")
print(f"Общая стоимость: {result['summary']['total_cost']} CZK")
```

---

## 5. Мониторинг расходов

### Проверить остаток кредитов

```bash
# Google Cloud Console → Billing → Credits
# Смотреть:
# - Free Trial: $300 (осталось)
# - GenAI App Builder: $1000 (осталось)
```

### Установить бюджетные алерты

```bash
# Billing → Budgets & alerts
# 1. Create Budget
# 2. Amount: $50/month
# 3. Alert at: 50%, 90%, 100%
```

---

## 6. Оптимизация расходов

### Vertex AI Search (GenAI кредит)

**Цены:**
- Standard: $1.50 / 1000 запросов
- Enterprise: $4.00 / 1000 запросов

**Оптимизация:**
```python
# Кэшировать результаты поиска
from functools import lru_cache

@lru_cache(maxsize=1000)
async def search_norms_cached(query: str):
    return await client.search_norms(query)
```

**Расчет:**
- $1000 / $1.50 = 666,666 запросов
- При 100 запросов/день = 18 лет кредита! 🎉

### Gemini API (Free Trial)

**Лимиты бесплатного уровня:**
- Gemini 1.5 Flash: 1500 запросов/день (бесплатно)
- Gemini 1.5 Pro: 50 запросов/день (бесплатно)

**После исчерпания Free Trial:**
- Flash: $0.075 / 1M токенов
- Pro: $1.25 / 1M токенов

**Оптимизация:**
```python
# Использовать Flash для простых задач
# Pro только для сложного аудита
if task_complexity == "simple":
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = genai.GenerativeModel('gemini-1.5-pro')
```

---

## 7. Интеграция в Workflow C

```python
# concrete-agent/packages/core-backend/app/services/workflow_c.py

from app.integrations.vertex_search import get_vertex_client
from app.integrations.gemini_client import get_gemini_client

async def _audit_positions(self, positions, project_name, use_parallel=True):
    vertex_client = get_vertex_client()
    gemini_client = get_gemini_client()
    
    for pos in positions:
        # 1. Найти нормы через Vertex AI Search (GenAI кредит)
        norm_matches = await vertex_client.search_norms(pos['description'])
        
        # 2. Аудит через Gemini (Free Trial)
        audit_result = await gemini_client.audit_position(pos, norm_matches)
        
        pos['audit'] = audit_result
        pos['norm_matches'] = norm_matches
    
    return positions
```

---

## 8. Environment Variables (финальный .env)

```bash
# Google Cloud
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_API_KEY=AIzaSy...

# Vertex AI Search (GenAI кредит $1000)
VERTEX_SEARCH_DATASTORE_ID=your_datastore_id
ENABLE_VERTEX_SEARCH=true

# Gemini API (Free Trial $300)
ENABLE_GEMINI_PARSER=true
GEMINI_MODEL=gemini-1.5-flash

# Fallback to Claude if Google quota exceeded
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 9. Deployment на Render

```bash
# Render Environment Variables
# Settings → Environment → Add from .env file

# Загрузить service-account.json как Secret File:
# Settings → Secret Files → Add Secret File
# Filename: service-account.json
# Content: <paste JSON>
```

---

## 10. Мониторинг использования

### Dashboard

```python
# app/api/routes_admin.py

@router.get("/admin/google-credits")
async def get_google_credits_status():
    """Показать остаток кредитов Google Cloud"""
    
    return {
        "free_trial": {
            "total": 300,
            "remaining": 285,  # TODO: получить из Billing API
            "expires_at": "2026-06-09"
        },
        "genai_credit": {
            "total": 1000,
            "remaining": 998,
            "usage": {
                "vertex_search_queries": 1234,
                "cost_usd": 1.85
            }
        },
        "gemini_api": {
            "daily_quota": 1500,
            "used_today": 45,
            "remaining_today": 1455
        }
    }
```

---

## ✅ Checklist

- [ ] Vertex AI API включен
- [ ] Data Store создан и заполнен (ÚRS, OTSKP, ČSN)
- [ ] Service Account создан и JSON ключ скачан
- [ ] Gemini API ключ получен
- [ ] `.env` настроен с правильными переменными
- [ ] `service-account.json` в `.gitignore`
- [ ] Тесты пройдены (Vertex Search + Gemini Parser)
- [ ] Бюджетные алерты настроены ($50/month)
- [ ] Интеграция в Workflow C работает

---

**Итого:** $1300 кредитов хватит на **1-2 года** активного использования! 🚀
