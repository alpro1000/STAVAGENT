# URS MATCHER SERVICE - Полное описание для Claude

**Дата обновления:** 2025-11-25
**Версия:** 2.0.0
**Статус:** Production Ready (Фаза 1-3 завершены)

---

## 📋 ОГЛАВЛЕНИЕ
1. [Обзор сервиса](#обзор-сервиса)
2. [Архитектура](#архитектура)
3. [Технический стек](#технический-стек)
4. [API Endpoints](#api-endpoints)
5. [Структура данных](#структура-данных)
6. [Workflow и режимы работы](#workflow-и-режимы-работы)
7. [LLM интеграция](#llm-интеграция)
8. [Структура кода](#структура-кода)
9. [Установка и запуск](#установка-и-запуск)
10. [Конфигурация](#конфигурация)
11. [Примеры использования](#примеры-использования)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 ОБЗОР СЕРВИСА

### Что это?
**URS Matcher Service** - это интеллектуальный сервис для автоматического сопоставления описаний строительных работ (из спецификаций, смет) с позициями каталога **ÚRS** (Jednotný katalog stavebních prací Česku).

### Основные возможности:
- ✅ Текстовый поиск с использованием Levenshtein distance
- ✅ LLM-усиленный поиск (Claude, OpenAI, Perplexity)
- ✅ Загрузка и парсинг файлов (Excel, CSV, ODS)
- ✅ Анализ блоков работ с контекстом проекта
- ✅ Техничские правила для генерации сопутствующих работ
- ✅ Multi-Role система для проверки полноты (если STAVAGENT доступен)
- ✅ Веб-интерфейс для интерактивного поиска

### Целевая аудитория:
- 👷 Сметчики (rozpočtář) - для быстрого подбора ÚRS кодов
- 🏗️ Проектировщики (projektant) - для проверки полноты спецификаций
- 💼 Бизнес-аналитики - для анализа стоимости и ресурсов

---

## 🏗️ АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ HTML/CSS/JavaScript Kiosk Interface                 │  │
│  │ - Text input для одного поиска                      │  │
│  │ - File upload для BOQ файлов                        │  │
│  │ - Block-match с project_context                     │  │
│  │ - Results display (URS codes, confidence scores)    │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API (Express.js)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Routes:                                              │  │
│  │ - POST /api/jobs/text-match                         │  │
│  │ - POST /api/jobs/file-upload                        │  │
│  │ - POST /api/jobs/block-match                        │  │
│  │ - POST /api/jobs/parse-document (Фаза 2)           │  │
│  │ - POST /api/jobs/:jobId/confirm-qa (Фаза 2)        │  │
│  │ - GET  /api/urs-catalog/search                      │  │
│  │ - GET  /health                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────┘
               │
      ┌────────┴────────────────────┐
      │                             │
      ▼                             ▼
┌──────────────────────┐  ┌──────────────────────┐
│   SERVICES LAYER     │  │   EXTERNAL APIS      │
├──────────────────────┤  ├──────────────────────┤
│ - ursMatcher.js      │  │ - Claude API         │
│ - fileParser.js      │  │ - OpenAI API         │
│ - llmClient.js       │  │ - Perplexity API     │
│ - techRules.js       │  │ - STAVAGENT (Python) │
│ - perplexityClient   │  │ - STAVAGENT SmartPar │
│ - stavagentClient.js │  │ - Multi-Role System  │
│ - documentQAService  │  │                      │
│ - multiRoleClient.js │  │                      │
│ - tridnikParser.js   │  │                      │
└──────────────────────┘  └──────────────────────┘
      │
      ▼
┌──────────────────────┐
│   DATA LAYER         │
├──────────────────────┤
│ SQLite Database      │
│ - jobs table         │
│ - job_items table    │
│ - urs_items table    │
│ (20 sample items)    │
└──────────────────────┘
```

---

## 💻 ТЕХНИЧЕСКИЙ СТЕК

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (веб-сервер)
- **Database:** SQLite3 (локальное хранилище)
- **File Upload:** Multer (парсинг файлов)
- **Text Similarity:** levenshtein (встроенный алгоритм)
- **Async/Concurrency:** Promise, async/await

### Frontend
- **HTML5, CSS3, Vanilla JavaScript**
- **No frameworks** (чистый JS для простоты в кеске)
- **Fetch API** для коммуникации с backend

### Внешние сервисы
- **Claude API** (Anthropic) - LLM для анализа
- **OpenAI API** - альтернативный LLM
- **Perplexity API** - улучшенный поиск через web
- **STAVAGENT** (Python) - парсинг документов, Multi-Role система

### Инструменты
- **npm** - управление зависимостями
- **Jest** - unit-тестирование
- **Docker/Docker Compose** - контейнеризация
- **Render** - production hosting

---

## 🔌 API ENDPOINTS

### 1. Text Matching - Одна работа

**Endpoint:** `POST /api/jobs/text-match`

**Request:**
```json
{
  "text": "бетон C25/30",
  "quantity": 50,
  "unit": "m3",
  "use_llm": true
}
```

**Response:**
```json
{
  "candidates": [
    {
      "urs_code": "801421111",
      "urs_name": "Lože z betonu C 12/15",
      "unit": "m3",
      "confidence": 0.95,
      "match_type": "llm"
    }
  ],
  "best_match": { ... },
  "related_items": [ ... ],
  "llm_enabled": true,
  "processing_time_ms": 1250
}
```

### 2. File Upload - BOQ файл

**Endpoint:** `POST /api/jobs/file-upload`

**Request:** (multipart/form-data)
```
file: test_boq.csv (Excel, CSV, ODS)
```

**Response:**
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "filename": "test_boq.csv",
  "total_rows": 10,
  "items_created": 10,
  "message": "File processed successfully"
}
```

### 3. Block Match Analysis - Группа работ с контекстом

**Endpoint:** `POST /api/jobs/block-match`

**Request:** (multipart/form-data)
```
file: boq.csv
project_context: {
  "building_type": "bytový dům",
  "storeys": 5,
  "main_system": ["Porotherm 40", "ŽB desky"],
  "foundation_type": "C25/30"
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "blocks": [
    {
      "block_name": "Základy",
      "block_id": "ZAKLADY",
      "rows_count": 3,
      "analysis": {
        "mode": "boq_block_analysis",
        "block_summary": {
          "main_systems": ["beton C25/30", "výkopy"],
          "potential_missing_work_groups": ["lešení", "odvoz"]
        },
        "items": [
          {
            "row_id": 1,
            "selected_urs": {
              "urs_code": "3112389",
              "urs_name": "Výkopy základových konstrukcí",
              "confidence": 0.9
            }
          }
        ],
        "multi_role_validation": {
          "completeness_score": 85,
          "missing_items": ["Odvoz výkopku"],
          "warnings": [],
          "critical_issues": []
        }
      }
    }
  ]
}
```

### 4. Document Parsing (Фаза 2) - STAVAGENT required

**Endpoint:** `POST /api/jobs/parse-document`

**Request:** (multipart/form-data)
```
file: techspec.pdf или .txt
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "parsed_document": { ... },
  "project_context": {
    "building_type": "bytový dům",
    "storeys": 5,
    "main_system": ["Porotherm", "ŽB desky"]
  },
  "qa_flow": {
    "questions": [ ... ],
    "answered_count": 4,
    "unanswered_count": 2
  }
}
```

### 5. Q&A Confirmation (Фаза 2)

**Endpoint:** `POST /api/jobs/:jobId/confirm-qa`

**Request:**
```json
{
  "confirmed_answers": {
    "q_building_type": {
      "value": "bytový dům",
      "user_edited": false
    },
    "q_storeys": {
      "value": "5",
      "user_edited": false
    }
  }
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "ready_for_analysis",
  "final_context": { ... },
  "message": "Q&A answers confirmed"
}
```

### 6. URS Catalog Search

**Endpoint:** `GET /api/urs-catalog/search?q=beton`

**Response:**
```json
{
  "query": "beton",
  "results": [
    {
      "urs_code": "801421111",
      "urs_name": "Lože z betonu C 12/15",
      "unit": "m3"
    }
  ],
  "total": 3
}
```

### 7. Health Check

**Endpoint:** `GET /health` или `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "service": "URS Matcher Service",
  "timestamp": "2025-11-25T10:30:00Z",
  "database": "connected"
}
```

---

## 📊 СТРУКТУРА ДАННЫХ

### Database Schema

#### jobs таблица
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  filename TEXT,
  status TEXT,  -- 'processing', 'completed', 'error'
  total_rows INTEGER,
  created_at DATETIME,
  updated_at DATETIME,
  project_context JSON,
  qa_results JSON
);
```

#### job_items таблица
```sql
CREATE TABLE job_items (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  row_id INTEGER,
  input_text TEXT,
  selected_urs_code TEXT,
  confidence REAL,
  match_type TEXT,  -- 'local', 'llm', 'perplexity'
  related_items JSON,
  created_at DATETIME
);
```

#### urs_items таблица
```sql
CREATE TABLE urs_items (
  urs_code TEXT PRIMARY KEY,
  urs_name TEXT,
  unit TEXT,
  category TEXT,
  description TEXT,
  created_at DATETIME
);
```

### JSON Response Objects

#### URS Item
```json
{
  "urs_code": "801421111",
  "urs_name": "Lože z betonu C 12/15",
  "unit": "m3",
  "confidence": 0.95,
  "match_type": "llm|local|perplexity",
  "explanation": "Vybrán kód ÚRS..."
}
```

#### Block Analysis
```json
{
  "block_name": "Základy",
  "block_id": "ZAKLADY",
  "rows_count": 3,
  "analysis": {
    "mode": "boq_block_analysis",
    "block_summary": {
      "block_id": "ZAKLADY",
      "main_systems": [],
      "potential_missing_work_groups": []
    },
    "items": [],
    "global_related_items": [],
    "multi_role_validation": {
      "completeness_score": 85,
      "missing_items": [],
      "warnings": [],
      "critical_issues": []
    }
  }
}
```

---

## 🔄 WORKFLOW И РЕЖИМЫ РАБОТЫ

### Режим 1: Single Work (Одна работа)

```
User вводит текст "бетон"
    ↓
Text-match endpoint
    ↓
1. Поиск в локальной БД (Levenshtein)
    ↓
2. (опционально) Perplexity поиск через web
    ↓
3. (опционально) LLM re-ranking результатов
    ↓
Вывод: 3 кандидата ÚRS с confidence scores
```

### Режим 2: File Upload (Загрузка файла)

```
User загружает Excel/CSV/ODS файл
    ↓
File-upload endpoint
    ↓
1. Парсинг файла (fileParser.js)
    ↓
2. Для каждой строки: text-match
    ↓
3. Генерация related items (tech-rules)
    ↓
4. Сохранение в БД
    ↓
Вывод: job_id с обработанными строками
```

### Режим 3: Block-Match Analysis (Анализ блока с контекстом) - ФАЗА 1

```
User загружает BOQ + вводит project_context
    ↓
Block-match endpoint
    ↓
1. Группировка строк по TŘÍDNÍK (11 категорий)
    ↓
2. Для каждого блока:
   a) Определение основного типа работ
   b) LLM анализ блока с контекстом
   c) Генерация related items
   d) (опционально) Multi-Role валидация
    ↓
Вывод: 4-11 блоков с анализом и ÚRS кодами
```

### Режим 4: Document Parsing (Парсинг документа) - ФАЗА 2

```
User загружает техническое задание (PDF/TXT)
    ↓
Parse-document endpoint
    ↓
1. STAVAGENT SmartParser парсит документ
    ↓
2. Извлечение project_context (здание, материалы, конструкция)
    ↓
3. Document Q&A Flow (автоматическая генерация вопросов)
    ↓
4. Auto-answering из документа
    ↓
Вывод: Контекст проекта + список вопросов/ответов
    ↓
User подтверждает ответы (confirm-qa endpoint)
    ↓
Готово для block-match анализа
```

### Режим 5: Multi-Role Validation (Проверка полноты) - ФАЗА 3

```
После block-match анализа
    ↓
Multi-Role Client вызывает STAVAGENT
    ↓
STAVAGENT проверяет:
  - Structural Engineer: конструктивная целостность
  - Concrete Specialist: наличие материалов
  - Cost Estimator: полнота смет
  - Document Validator: соответствие техзаданию
    ↓
Возвращает:
  - completeness_score (0-100%)
  - missing_items (недостающие работы)
  - warnings & critical_issues
    ↓
Вывод: Полная валидация блока
```

---

## 🧠 LLM ИНТЕГРАЦИЯ

### Как работает LLM?

**1. Configuration (llmConfig.js)**
```javascript
export function getLLMConfig() {
  // Читает:
  // - LLM_PROVIDER (claude или openai)
  // - LLM_API_KEY или OPENAI_API_KEY
  // - LLM_MODEL (claude-3-sonnet или gpt-4)
  // - LLM_TIMEOUT_MS (30000)

  if (!apiKey) {
    return { enabled: false };  // Graceful fallback
  }

  return { enabled: true, ... };
}
```

**2. Client Initialization (llmClient.js)**

Функции:
- `initializeLLMClient()` - создание HTTP клиента
- `matchUrsItemWithAI(text, candidates)` - LLM re-ranking
- `explainMapping(text, selectedCode)` - объяснение выбора
- `analyzeBlock(blockData, context)` - анализ блока работ
- `isLLMEnabled()` - проверка доступности

**3. Prompts (src/prompts/)**

- `ursMatcher.prompt.js` - main system prompt
  - Режим `single_work` - для одной работы
  - Режим `boq_block_analysis` - для блока работ
  - Инструкции по выбору ÚRS кода
  - Tech-rules для related items

- `perplexityUrsSearch.prompt.js` - для Perplexity поиска

**4. Integration Points**

```javascript
// В jobs.js endpoint text-match:
const matches = await matchUrsItems(text, quantity, unit);
if (isLLMEnabled() && use_llm) {
  const reranked = await matchUrsItemWithAI(text, matches);
  return reranked;
}

// В jobs.js endpoint block-match:
const analysis = await analyzeBlock(block, projectContext);
// LLM возвращает:
// - selected_urs_code
// - confidence
// - block_summary
// - related_items
// - explanation
```

### API Providers

**Claude (Anthropic)**
```javascript
{
  provider: 'claude',
  apiUrl: 'https://api.anthropic.com/v1/messages',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  },
  model: 'claude-3-sonnet-20240229'
}
```

**OpenAI**
```javascript
{
  provider: 'openai',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  headers: {
    'authorization': `Bearer ${apiKey}`
  },
  model: 'gpt-4'
}
```

**Perplexity**
```javascript
{
  provider: 'perplexity',
  apiUrl: 'https://api.perplexity.ai/chat/completions',
  headers: {
    'authorization': `Bearer ${apiKey}`
  },
  model: 'sonar'
}
```

---

## 📁 СТРУКТУРА КОДА

```
URS_MATCHER_SERVICE/
├── backend/
│   ├── src/
│   │   ├── app.js                           # Main Express app
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── jobs.js                 # POST text-match, file-upload, block-match
│   │   │   │   ├── catalog.js              # GET catalog search
│   │   │   │   ├── health.js               # GET health check
│   │   │   │   └── tridnik.js              # TŘÍDNÍK parser
│   │   │   └── middleware/
│   │   │       ├── errorHandler.js         # Global error handling
│   │   │       └── requestLogger.js        # Request logging
│   │   ├── services/
│   │   │   ├── ursMatcher.js               # Core matching logic
│   │   │   ├── fileParser.js               # Excel/CSV/ODS parsing
│   │   │   ├── llmClient.js                # LLM API client
│   │   │   ├── perplexityClient.js         # Perplexity API wrapper
│   │   │   ├── techRules.js                # Tech-rules engine
│   │   │   ├── stavagentClient.js          # STAVAGENT integration
│   │   │   ├── documentQAService.js        # Document Q&A flow (Фаза 2)
│   │   │   ├── multiRoleClient.js          # Multi-Role validation (Фаза 3)
│   │   │   └── tridnikParser.js            # TŘÍDNÍK grouping
│   │   ├── db/
│   │   │   ├── init.js                     # DB initialization
│   │   │   └── schema.sql                  # DDL statements
│   │   ├── config/
│   │   │   └── llmConfig.js                # LLM configuration factory
│   │   ├── prompts/
│   │   │   ├── ursMatcher.prompt.js        # Main system prompt (390 строк)
│   │   │   └── perplexityUrsSearch.prompt.js
│   │   └── utils/
│   │       ├── logger.js                   # Custom logger
│   │       └── textNormalizer.js           # Text normalization
│   ├── tests/
│   │   ├── ursMatcher.test.js              # Unit tests for matching
│   │   ├── fileParser.test.js              # Unit tests for parsing
│   │   ├── techRules.test.js               # Tech-rules tests
│   │   └── fixtures/                       # Test data
│   ├── data/
│   │   └── urs_matcher.db                  # SQLite database
│   ├── uploads/                            # Uploaded files
│   ├── package.json                        # Dependencies
│   ├── .env.example                        # Configuration template
│   └── .gitignore                          # Git ignore rules
│
├── frontend/
│   ├── public/
│   │   ├── index.html                      # Main HTML
│   │   ├── app.js                          # Frontend logic (900+ lines)
│   │   └── styles.css                      # Styling
│   └── package.json
│
├── README.md                               # Main documentation
├── ROADMAP.md                              # Development roadmap
├── TESTING_GUIDE.md                        # Testing instructions
├── API.md                                  # API documentation
├── ARCHITECTURE.md                         # Architecture details
├── DEV_NOTES.md                            # Development notes
├── IMPLEMENTATION_SUMMARY.md               # Implementation status
├── docker-compose.yml                      # Docker configuration
├── Dockerfile.backend                      # Backend Docker image
├── Dockerfile.frontend                     # Frontend Docker image
└── nginx.conf                              # Nginx configuration
```

---

## 🚀 УСТАНОВКА И ЗАПУСК

### Требования
- Node.js v18+
- npm или yarn
- Python 3.8+ (если использовать STAVAGENT)
- Git

### Quick Start

```bash
# 1. Клонировать репозиторий
git clone https://github.com/alpro1000/STAVAGENT.git
cd STAVAGENT/URS_MATCHER_SERVICE

# 2. Установить зависимости backend
cd backend
npm install

# 3. Создать .env файл с API ключами
cp .env.example .env
nano .env  # Отредактировать с реальными ключами

# 4. Запустить backend (development)
npm run dev
# Backend запустится на http://localhost:3001

# 5. В другом терминале - тестирование
npm test  # Запустить все 32 теста

# 6. Тестирование API
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{"text":"beton"}'
```

### Docker запуск

```bash
# Запустить frontend + backend + nginx
docker-compose up

# Frontend: http://localhost
# Backend API: http://localhost/api
```

---

## ⚙️ КОНФИГУРАЦИЯ

### .env.example файл

```bash
# LLM PROVIDER: claude или openai
LLM_PROVIDER=claude
LLM_API_KEY=sk-ant-YOUR_KEY
LLM_MODEL=claude-3-sonnet-20240229
LLM_TIMEOUT_MS=30000

# OpenAI (опционально)
# OPENAI_API_KEY=sk-proj-YOUR_KEY

# Perplexity (опционально)
PPLX_API_KEY=pplx-YOUR_KEY
PPLX_MODEL=sonar
PPLX_TIMEOUT_MS=60000

# Node
NODE_ENV=development
PORT=3001

# CORS
CORS_ORIGIN=*
```

### Logging

```javascript
// src/utils/logger.js
logger.info('[SERVICE_NAME] Message');     // INFO level
logger.warn('[SERVICE_NAME] Warning');     // WARN level
logger.error('[SERVICE_NAME] Error');      // ERROR level
logger.debug('[SERVICE_NAME] Debug info'); // DEBUG level (если LOG_LEVEL=debug)
```

### Environment Variables

| Переменная | Значение | Обязательна? | Описание |
|-----------|----------|-------------|---------|
| LLM_API_KEY | sk-ant-... | ❌ | Claude API ключ |
| OPENAI_API_KEY | sk-proj-... | ❌ | OpenAI API ключ |
| PPLX_API_KEY | pplx-... | ❌ | Perplexity API ключ |
| LLM_PROVIDER | claude\|openai | ❌ | Выбор провайдера |
| LLM_MODEL | claude-3-sonnet | ❌ | Модель LLM |
| PPLX_MODEL | sonar | ❌ | Модель Perplexity |
| NODE_ENV | development\|production | ❌ | Окружение |
| PORT | 3001 | ❌ | Порт сервера |
| CORS_ORIGIN | * | ❌ | CORS origins |

---

## 💡 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Поиск одной работы

```bash
curl -X POST http://localhost:3001/api/jobs/text-match \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Betonáž základů C25/30",
    "quantity": 38,
    "unit": "m3",
    "use_llm": true
  }'
```

**Результат:**
```json
{
  "candidates": [
    {
      "urs_code": "801421111",
      "urs_name": "Lože z betonu C 12/15",
      "confidence": 0.92,
      "match_type": "llm"
    }
  ],
  "best_match": {...},
  "llm_enabled": true,
  "processing_time_ms": 1250
}
```

### Пример 2: Загрузка BOQ файла

```bash
curl -X POST http://localhost:3001/api/jobs/file-upload \
  -F "file=@myboq.xlsx"
```

### Пример 3: Block-match анализ

```bash
curl -X POST http://localhost:3001/api/jobs/block-match \
  -F "file=@boq.csv" \
  -F 'project_context={
    "building_type":"bytový dům",
    "storeys":5,
    "main_system":["Porotherm 40","ŽB desky"],
    "foundation_type":"C25/30"
  }'
```

### Пример 4: Document parsing (требует STAVAGENT)

```bash
curl -X POST http://localhost:3001/api/jobs/parse-document \
  -F "file=@techspec.pdf"
```

### Пример 5: Q&A confirmation

```bash
curl -X POST http://localhost:3001/api/jobs/ABC-123/confirm-qa \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_answers": {
      "q_building_type": {
        "value": "bytový dům",
        "user_edited": false
      },
      "q_storeys": {
        "value": "5",
        "user_edited": false
      }
    }
  }'
```

---

## 🔧 TROUBLESHOOTING

### Проблема 1: "LLM features will be disabled"

**Причина:** Нет LLM API ключа в .env

**Решение:**
```bash
# Проверить .env файл
cat /home/user/STAVAGENT/URS_MATCHER_SERVICE/backend/.env | grep LLM_API_KEY

# Добавить ключ
nano .env
# Добавить: LLM_API_KEY=sk-ant-YOUR_KEY

# Перезапустить
npm run dev
```

### Проблема 2: "STAVAGENT SmartParser not available"

**Причина:** STAVAGENT (concrete-agent) не запущен

**Решение:**
```bash
# Это нормально для Фазы 1 - тесты работают без STAVAGENT
# Для Фазы 2 нужно запустить:
cd ../../concrete-agent
# Следуйте инструкциям в README
```

### Проблема 3: Tests failing

**Причина:** Зависимости не установлены или конфликт версий

**Решение:**
```bash
# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install

# Запустить тесты
npm test
```

### Проблема 4: Database locked

**Причина:** Несколько процессов обращаются к БД одновременно

**Решение:**
```bash
# Удалить БД и пересоздать
rm backend/data/urs_matcher.db
npm run dev
# БД будет пересоздана при запуске
```

### Проблема 5: Port 3001 already in use

**Причина:** Другой процесс слушает на том же порту

**Решение:**
```bash
# Способ 1: Использовать другой порт
PORT=3002 npm run dev

# Способ 2: Убить процесс на порту 3001
lsof -i :3001
kill -9 <PID>
npm run dev
```

---

## 📊 ТЕКУЩИЙ СТАТУС (2025-11-25)

### ✅ ЗАВЕРШЕНО (Фаза 1-3)

**MVP-1:** ✅ Полностью готов
- Text matching с Levenshtein distance
- File upload & parsing (Excel/CSV/ODS)
- Frontend интерфейс
- 32/32 тестов passing

**MVP-2 Фаза 1:** ✅ Полностью готов
- Tech-rules engine (9 правил)
- Related items генерация
- 92% test coverage для tech-rules

**MVP-2 Фаза 2:** ✅ MVP готов
- Document parsing (STAVAGENT SmartParser)
- Document Q&A Flow
- Auto-answering
- RFI detection

**MVP-2 Фаза 3:** ✅ MVP готов
- Multi-Role System интеграция
- Completeness validation
- Missing items detection
- Graceful degradation

**LLM Integration:** ✅ Готово
- Claude, OpenAI, Perplexity поддержка
- .env.example template
- Configuration factory
- Fallback режим

### ⏳ В РАЗРАБОТКЕ

**Фаза 4: Performance & Optimization**
- Кэширование Perplexity результатов
- Batch API для оптимизации
- Lazy loading для больших файлов
- Мониторинг и аналитика

### 🔮 БУДУЩЕЕ

**Advanced Features:**
- Conflict resolution между LLM кандидатами
- Advanced tech-rules (30+ правил)
- Custom rules editor через UI
- Mobile app версия

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Файлы документации
- **README.md** - основная информация
- **ROADMAP.md** - план развития
- **API.md** - детальное описание endpoints
- **ARCHITECTURE.md** - архитектурные решения
- **TESTING_GUIDE.md** - инструкции по тестированию
- **DEV_NOTES.md** - заметки разработчика
- **IMPLEMENTATION_SUMMARY.md** - итоги реализации

### GitHub репозиторий
https://github.com/alpro1000/STAVAGENT

### Развертывание
- **Production:** https://urs-matcher-service.onrender.com
- **Development:** http://localhost:3001

### Контакты разработчика
Проект: URS_MATCHER_SERVICE (alpro1000)
Язык: Czech, English, Russian

---

## 🎯 КЛЮЧЕВЫЕ КОНЦЕПЦИИ

### 1. ÚRS (Jednotný katalog stavebních prací)
Чешский классификатор строительных работ. Каждому описанию работы нужно найти соответствующий ÚRS код.

### 2. TŘÍDNÍK (Классификация по работам)
11 основных категорий строительных работ:
- Základy (Фундаменты)
- Svislé konstrukce (Вертикальные конструкции)
- ŽB konstrukce (Железобетонные конструкции)
- Izolace (Изоляция)
- Pokrývačské práce (Кровельные работы)
- итд.

### 3. Block-Match Analysis
Анализ группы работ с учетом контекста проекта (здание, материалы, конструкция).

### 4. Tech-Rules Engine
Система правил для генерации сопутствующих/обязательных работ.
Пример: Если выбран "бетон C25/30" → автоматически добавить "лесне", "опалубка".

### 5. Multi-Role System (STAVAGENT)
Использование нескольких AI ролей для проверки полноты спецификации.

---

**Документ создан:** 2025-11-25
**Версия:** 2.0.0
**Статус:** Production Ready ✅
