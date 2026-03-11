# ПРАВИЛЬНАЯ СТРАТЕГИЯ Google Cloud ($1300)
## С учетом реальных ограничений кредитов

---

## 💰 Что можно и нельзя

### $1000 GenAI App Builder кредит

**✅ МОЖНО (только эти сервисы):**
- Vertex AI Search (поиск по документам)
- Vertex AI Conversation (чат-бот)
- Document AI (OCR для PDF)
- Agent Builder Data Store

**❌ НЕЛЬЗЯ:**
- Gemini API вызовы
- Vertex AI Studio
- Cloud Storage
- Cloud Run
- Embeddings

### $300 Free Trial кредит

**✅ МОЖНО:**
- Vertex AI Gemini (через SDK, не AI Studio!)
- Cloud Run, Cloud Storage
- Embeddings для pgvector
- Cloud SQL

**❌ НЕЛЬЗЯ:**
- AI Studio API ключи (generativelanguage.googleapis.com)

---

## 🎯 ОПТИМАЛЬНАЯ СТРАТЕГИЯ для STAVAGENT

```
┌─────────────────────────────────────────────────────────┐
│  $1000 GenAI → Vertex AI Search                         │
│  ├─ Загрузить: ÚRS каталог (PDF)                       │
│  ├─ Загрузить: OTSKP нормы (Excel → PDF)               │
│  ├─ Загрузить: ČSN нормы                                │
│  └─ Использовать: Поиск норм при аудите                │
│     Хватит на: 666,666 запросов = 18 ЛЕТ               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  $300 Free Trial → Vertex AI Gemini (через SDK)        │
│  ├─ Embeddings для pgvector (RAG)                      │
│  ├─ Cloud Storage для документов                        │
│  └─ Cloud Run для деплоя (если нужно)                  │
│     Хватит на: 1-2 года умеренного использования       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Anthropic Claude (платно) → ОСНОВНОЙ AI               │
│  ├─ Парсинг PDF смет (лучшее качество)                 │
│  ├─ Аудит позиций (6 ролей)                            │
│  ├─ Сложные промпты                                     │
│  └─ Уже работает в коде (anthropic==0.40.0)            │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 ЧТО ДЕЛАТЬ

### 1. Vertex AI Search ($1000) - Поиск норм

**Файл:** `concrete-agent/packages/core-backend/app/integrations/vertex_search.py`

```python
# ✅ Это оплачивается $1000 кредитом
from google.cloud import discoveryengine_v1

client = discoveryengine_v1.SearchServiceClient()
response = client.search(
    serving_config="projects/.../servingConfigs/default_config",
    query="Бетонирование фундамента C25/30"
)
# Вернет топ-5 норм ÚRS с ценами
```

**Использование:**
```python
# В workflow_c.py при аудите
norm_matches = await vertex_client.search_norms(position['description'])
# Сравнить цены из сметы с нормами
```

---

### 2. Vertex AI Embeddings ($300) - RAG

**Файл:** `concrete-agent/packages/core-backend/app/integrations/vertex_embeddings.py`

```python
# ✅ Это оплачивается $300 Free Trial
from vertexai.language_models import TextEmbeddingModel

model = TextEmbeddingModel.from_pretrained("textembedding-gecko@003")
embeddings = model.get_embeddings(["текст для embedding"])

# Сохранить в pgvector для RAG
await vector_store.upsert(chunk_id, embeddings[0].values)
```

**НЕ использовать Gemini для парсинга** - Claude лучше для строительных документов.

---

### 3. Claude (платно) - Основной AI

**Уже работает:**
```python
# concrete-agent/packages/core-backend/app/services/workflow_c.py
# Использует Claude для всех промптов
```

**Оставить как есть** - Claude лучше для:
- Парсинг PDF смет
- Аудит позиций
- Технические документы

---

## 🚀 SETUP (минимальный)

### Шаг 1: Vertex AI Search

```bash
# 1. Console → Vertex AI Agent Builder
# 2. Create App → Search
# 3. Upload: urs_catalog.pdf, otskp_norms.pdf, csn_standards.pdf
# 4. Copy Datastore ID
```

### Шаг 2: Service Account

```bash
# 1. IAM → Service Accounts → Create
# 2. Role: Discovery Engine Admin
# 3. Create Key → JSON
# 4. Save as: concrete-agent/service-account.json
```

### Шаг 3: .env

```bash
# concrete-agent/.env
GOOGLE_PROJECT_ID=project-947a512a-481d-49b5-81c
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VERTEX_SEARCH_DATASTORE_ID=your_datastore_id

# Включить только поиск норм
ENABLE_VERTEX_SEARCH=true
ENABLE_GEMINI_PARSER=false  # Claude лучше

# Claude остается основным
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 💡 ИТОГО

| Задача | Сервис | Кредит | Стоимость |
|--------|--------|--------|-----------|
| **Поиск норм ÚRS** | Vertex AI Search | $1000 GenAI | $1.50/1000 запросов |
| **Embeddings для RAG** | Vertex AI Embeddings | $300 Free Trial | Бесплатно в квотах |
| **Парсинг PDF** | Claude Vision | Платно | ~$0.01/страница |
| **Аудит позиций** | Claude Sonnet | Платно | ~$0.003/1K токенов |

**Вывод:** 
- $1000 → только поиск норм (хватит на годы)
- $300 → embeddings для RAG
- Claude → основная работа (уже настроен)

---

## ✅ Checklist

- [ ] Vertex AI Search Data Store создан
- [ ] Загружены: ÚRS, OTSKP, ČSN (PDF)
- [ ] Service Account JSON скачан
- [ ] `.env` настроен
- [ ] `vertex_search.py` интегрирован в workflow_c
- [ ] Claude остается основным AI (не менять!)

**НЕ тратить кредиты на Gemini парсинг - Claude лучше!**
