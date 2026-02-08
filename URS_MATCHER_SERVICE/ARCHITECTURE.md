# URS Matcher Service - Расширенная Архитектура v3.0

**Версия:** 3.0.0
**Дата:** 2026-02-07

---

## Общая Концепция

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAVAGENT URS MATCHER                                │
│                     Интеллектуальная система сметных расчетов               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ВХОДНЫЕ ДАННЫЕ                               │   │
│  │                                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │  Excel   │  │   PDF    │  │  Прайсы  │  │  Проект  │            │   │
│  │  │   BOQ    │  │  Docs    │  │  цен     │  │  .dwg    │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  └───────┼──────────────┼────────────┼─────────────┼─────────────────┘   │
│          │              │            │             │                       │
│          ▼              ▼            ▼             ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    УНИВЕРСАЛЬНЫЙ ПАРСЕР                              │   │
│  │                                                                      │   │
│  │  • Excel Parser (SheetJS)                                           │   │
│  │  • PDF Parser (MinerU / Workflow C)                                  │   │
│  │  • Price Parser (прайсы бетон, арматура, материалы)                 │   │
│  │  • DWG Parser (чертежи → объемы)                                    │   │
│  └───────────────────────────┬─────────────────────────────────────────┘   │
│                              │                                             │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     TŘÍDNÍK CLASSIFIER                               │   │
│  │                                                                      │   │
│  │  TSKP Categories (1-9):                                             │   │
│  │  1 - Zemní práce        5 - Komunikace                              │   │
│  │  2 - Zakládání          6 - Úpravy povrchů                          │   │
│  │  3 - Svislé konstrukce  7 - Izolace                                 │   │
│  │  4 - Vodorovné konstr.  8 - Trubní vedení                           │   │
│  │                         9 - Ostatní                                  │   │
│  └───────────────────────────┬─────────────────────────────────────────┘   │
│                              │                                             │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      URS MATCHER ENGINE                              │   │
│  │                                                                      │   │
│  │  Pipeline: Cache → Local DB → Perplexity → LLM                      │   │
│  │  Learning: Автообучение на высокой уверенности                      │   │
│  │  Model: Выбираемая модель (Gemini/Claude/DeepSeek/GLM)             │   │
│  └───────────────────────────┬─────────────────────────────────────────┘   │
│                              │                                             │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      БАЗА ЗНАНИЙ                                     │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │   Нормы    │  │    Цены    │  │ Технологии │                 │   │
│  │  │  ČSN/GOST  │  │  Материалы │  │  Работ     │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │  Расценки  │  │   Нормы    │  │  Прайсы    │                 │   │
│  │  │  Труд/Техн │  │ Выработки  │  │ Поставщик  │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └───────────────────────────┬─────────────────────────────────────────┘   │
│                              │                                             │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   ОРКЕСТРАТОР АГЕНТОВ                                │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │               6 СПЕЦИАЛИЗИРОВАННЫХ РОЛЕЙ                     │   │   │
│  │  │                                                              │   │   │
│  │  │  🏗️ Конструктор         → Проверка конструктивных решений   │   │   │
│  │  │  🧱 Бетонщик             → Такты бетонирования, опалубка    │   │   │
│  │  │  📐 Сметчик              → Расчет стоимости, объемы         │   │   │
│  │  │  📋 Нормоконтролёр       → ČSN/GOST проверки                │   │   │
│  │  │  🔧 Технолог             → Технология производства          │   │   │
│  │  │  📊 Координатор          → Общий контроль, резюме           │   │   │
│  │  │                                                              │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  Используется для:                                                  │   │
│  │  • Анализ проектной документации                                    │   │
│  │  • Планирование тактов бетонирования                                │   │
│  │  • Расчет опалубки и захваток                                       │   │
│  │  • Подбор технологии производства работ                             │   │
│  │  • Проверка соответствия нормам                                     │   │
│  │                                                                      │   │
│  │  НЕ используется для:                                               │   │
│  │  • Простой matching BOQ → URS                                       │   │
│  │  • Классификация по TŘÍDNÍK                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Структура Модулей

```
backend/src/services/
├── matching/                      # URS Matching (упрощенный pipeline)
│   ├── ursLocalMatcher.js         # Local DB matching
│   ├── ursCacheMatcher.js         # Cache layer
│   └── ursPerplexityMatcher.js    # Perplexity fallback
│
├── classifier/                    # TŘÍDNÍK Classification
│   ├── tridnikParser.js           # TSKP classifier
│   ├── tskpParserService.js       # Full TSKP (64k items)
│   └── geminiBlockClassifier.js   # Gemini-based classification
│
├── pricing/                       # Парсеры цен (NEW)
│   ├── concreteParser.js          # Бетон от производителей
│   ├── rebarParser.js             # Арматура, сетки
│   ├── aggregateParser.js         # Щебень, песок
│   ├── materialParser.js          # Материалы (штукатурка, плитка)
│   ├── equipmentParser.js         # Техника (аренда)
│   ├── laborParser.js             # Труд (ставки)
│   └── pricelistImporter.js       # PDF/Excel прайсы
│
├── norms/                         # База норм (IMPLEMENTED)
│   ├── webSearchClient.js         # Web Search (Brave + Tavily)
│   ├── normParser.js              # Парсер и нормализация ČSN/EN
│   ├── knowledgeBase.js           # База знаний (JSON + индексы)
│   └── normsService.js            # Оркестратор поиска и хранения
│
├── technology/                    # Технологические расчеты (NEW)
│   ├── formworkCalculator.js      # Расчет опалубки
│   ├── concretingPhases.js        # Такты бетонирования
│   ├── workSections.js            # Захватки
│   ├── craneReach.js              # Радиус крана
│   └── technologySelector.js      # Подбор технологии
│
├── projectAnalysis/               # Анализ проекта (IMPLEMENTED)
│   ├── orchestrator.js            # Главный оркестратор (6 ролей)
│   └── roles.js                   # Определения 6 ролей:
│       # 🏗️ KONSTRUKTOR    → Этапы бетонирования, швы
│       # 🧱 BETONÁŘ        → Технология бетона, уход
│       # 📐 ROZPOČTÁŘ      → Смета, расценки URS
│       # 📋 NORMOKONTROLÉR → ČSN/EN проверки
│       # 🔧 TECHNOLOG      → Опалубка, захватки
│       # 📊 KOORDINÁTOR    → Календарный план
│
└── config/
    └── llmConfig.js               # Выбор модели AI (глобально)
```

---

## API Endpoints

### Matching (Упрощенный Pipeline - БЕЗ Multi-Role)

```
POST /api/jobs/block-match-fast    → Rychlý режим
POST /api/jobs/block-match         → Rozšířený режим (+ простые проверки)
POST /api/jobs/text-match          → Одиночный matching
POST /api/jobs/document-extract    → Извлечение из PDF
```

### Анализ Проекта (6 ролей - IMPLEMENTED)

```
GET  /api/project-analysis/roles   → Список 6 ролей
GET  /api/project-analysis/tasks   → Типы задач (concrete_phases, formwork, ...)
POST /api/project-analysis/full    → Полный анализ (все 6 ролей)
POST /api/project-analysis/task/:type → Анализ по типу задачи
POST /api/project-analysis/ask/:role  → Вопрос конкретной роли
GET  /api/project-analysis/health  → Health check
```

### Цены и Материалы

```
GET  /api/prices/concrete          → Цены на бетон
GET  /api/prices/rebar             → Цены на арматуру
GET  /api/prices/materials         → Цены на материалы
POST /api/prices/import            → Импорт прайса PDF/Excel
GET  /api/prices/search            → Поиск по ценам
```

### Нормы и Стандарты (IMPLEMENTED)

```
GET  /api/norms/search?q=          → Поиск норм (Web + KB)
GET  /api/norms/code/:code         → Норма по коду (ČSN EN 13670)
GET  /api/norms/laws?topic=        → Поиск законов (stavební povolení)
POST /api/norms/for-work           → Нормы для вида работ
POST /api/norms/for-project        → Нормы для проекта
GET  /api/norms/categories         → Категории ČSN (27, 73, ...)
GET  /api/norms/types              → Типы норм (ČSN, EN, Vyhláška)
GET  /api/norms/sources            → Доверенные источники
GET  /api/norms/stats              → Статистика базы знаний
POST /api/norms/import             → Импорт норм
POST /api/norms/rebuild-index      → Перестроить индекс
```

**Web Search интеграция:**
- Brave Search API (2000 запросов/месяц бесплатно)
- Tavily API (извлечение контента, advanced search)

### Настройки LLM

```
GET  /api/settings/models          → Все доступные модели
GET  /api/settings/model           → Текущая модель
POST /api/settings/model           → Выбор модели (глобально)
GET  /api/settings/providers       → Провайдеры
```

---

## Фазы Реализации

### Фаза 1: Упрощение Pipeline ✅ ЗАВЕРШЕНА
- [x] Убрать Multi-Role из block-match
- [x] Простая валидация (completeness, warnings, norms hints)
- [x] Обновить TŘÍDNÍK classifier

### Фаза 2: Глобальный выбор модели ✅ ЗАВЕРШЕНА
- [x] Runtime model selection в llmConfig.js
- [x] Model change notification system
- [x] Применить ко всем LLM endpoints
- [x] Reset cache при смене модели

### Фаза 3: Оркестратор Агентов ✅ ЗАВЕРШЕНА
- [x] 6 специализированных ролей (roles.js)
- [x] Промпты для анализа проекта
- [x] API endpoints (/api/project-analysis/*)
- [x] Типы задач (concrete_phases, formwork, schedule, etc.)

### Фаза 4: База Норм ✅ ЗАВЕРШЕНА
- [x] Web Search (Brave + Tavily)
- [x] Парсер ČSN/EN норм
- [x] Нормализация в машиночитаемый JSON
- [x] База знаний с индексацией
- [x] API поиска норм (/api/norms/*)

### Фаза 5: База Цен (PENDING)
- [ ] Структура таблиц цен
- [ ] Парсер цен на бетон
- [ ] Импорт PDF прайсов
- [ ] API поиска цен

### Фаза 6: Технологические Расчеты (PENDING)
- [ ] Калькулятор опалубки
- [ ] Планировщик тактов
- [ ] Расчет захваток

---

## Выбор Модели AI (Глобально)

| Провайдер | Модель | Цена | Применение |
|-----------|--------|------|------------|
| GLM | glm-4-flash | ZDARMA | Простые задачи |
| DeepSeek | deepseek-chat | Очень дёшево | Matching, классификация |
| Gemini | gemini-flash | Дёшево | Быстрая классификация |
| Qwen | qwen-turbo | Дёшево | Альтернатива |
| OpenAI | gpt-4o-mini | Средне | Качественный matching |
| Claude | claude-sonnet | Дорого | Анализ проекта |
| Grok | grok-2 | Средне | Альтернатива |

---

**Последнее обновление:** 2026-02-07
