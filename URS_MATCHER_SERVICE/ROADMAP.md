# URS Matcher Service - Roadmap для контекстного анализа блоков работ

**Дата создания:** 2025-11-24
**Статус:** В разработке
**Версия:** 1.0.0

---

## 🎯 Цель проекта

Расширение URS Matcher Service для поддержки контекстного анализа блоков работ с использованием инфраструктуры STAVAGENT.

**Ключевые возможности:**
1. Автоматическое извлечение контекста проекта из документов (техзадание, чертежи)
2. Группировка работ в технологические блоки
3. AI-анализ блоков с учетом контекста проекта
4. Автоматическое предложение сопутствующих работ
5. Проверка технологической полноты блока

---

## 📊 Архитектура интеграции

```
┌─────────────────────────────────────────────────────────────┐
│ URS_MATCHER_SERVICE (Frontend + API)                        │
│                                                              │
│ ┌──────────────┐        ┌─────────────────────────────┐    │
│ │ Frontend UI  │────────│ Backend API                 │    │
│ │              │        │ - /text-match               │    │
│ │ - File upload│        │ - /file-upload              │    │
│ │ - Text input │        │ - /block-match (NEW)        │    │
│ │ - Results    │        │ - /project-context (NEW)    │    │
│ └──────────────┘        └─────────────┬───────────────┘    │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                    ┌───────────────────┴────────────────────┐
                    │ Интеграция с STAVAGENT                 │
                    │                                        │
                    │ Вариант A: REST API вызовы            │
                    │ Вариант B: Импорт модулей (shared)    │
                    │ Вариант C: Общая база данных          │
                    └───────────────────┬────────────────────┘
                                        │
┌───────────────────────────────────────┼──────────────────────┐
│ STAVAGENT (concrete-agent core)       ▼                      │
│                                                              │
│ ┌──────────────────┐  ┌─────────────────────────────────┐  │
│ │ Document Parsers │  │ Multi-Role AI System            │  │
│ │ - SmartParser    │  │ - Document Validator            │  │
│ │ - PDFParser      │  │ - Structural Engineer           │  │
│ │ - ExcelParser    │  │ - Concrete Specialist           │  │
│ └──────────────────┘  │ - Cost Estimator                │  │
│                       │ - Standards Checker             │  │
│ ┌──────────────────┐  └─────────────────────────────────┘  │
│ │ Document Q&A     │                                        │
│ │ - Extract context│  ┌─────────────────────────────────┐  │
│ │ - Generate Q     │  │ Knowledge Base                  │  │
│ │ - Find answers   │  │ - TŘÍDNÍK classification        │  │
│ └──────────────────┘  │ - KROS/OTSKP codes              │  │
│                       │ - ČSN standards                 │  │
│                       └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗓️ MVP Roadmap

### ✅ Фаза 0: Подготовка (ЗАВЕРШЕНО)

- [x] Изучение существующей инфраструктуры STAVAGENT
- [x] Анализ Document Q&A Flow
- [x] Изучение Multi-Role System
- [x] Интеграция TŘÍDNÍK classification в URS Matcher
- [x] Базовая группировка по кодам (2-digit prefix)

---

### ✅ Фаза 1: Ручной context + TŘÍDNÍK группировка (2 недели)

**Цель:** Реализовать базовый режим `mode: "boq_block_analysis"` с ручным вводом контекста

**Статус:** ✅ ЗАВЕРШЕНО (2025-11-24)

#### Задачи:

- [x] **Backend: Block matching endpoint**
  - [x] Создать `/api/block-match` endpoint
  - [x] Принимать `project_context` (ручной ввод)
  - [x] Принимать `boq_block` (массив строк)
  - [x] Параллельные Perplexity запросы для кандидатов

- [x] **Backend: Расширение ursMatcher.prompt.js**
  - [x] Добавить `mode: "boq_block_analysis"` в промпт
  - [x] Добавить инструкции для контекстного анализа
  - [x] Добавить логику для `related_items`
  - [x] Добавить `block_summary` генерацию

- [x] **Backend: TŘÍDNÍK auto-группировка**
  - [x] Функция `groupItemsByWorkType(rows)` в tridnikParser.js
  - [x] Определение блоков по ключевым словам (11 категорий)
  - [x] Группировка по типам работ

- [x] **Frontend: Форма для project_context**
  - [x] Manual JSON input для project_context
  - [x] Curl/API testing доступен

- [x] **LLM Integration**
  - [x] Функция `analyzeBlock()` в llmClient.js
  - [x] Extended timeout для блочного анализа
  - [x] ZERO HALLUCINATION валидация

- [x] **Testing**
  - [x] Все 32 backend теста проходят
  - [x] Совместимость с существующими endpoints

**Критерии завершения:**
- ✅ Пользователь может загрузить файл + ввести контекст вручную
- ✅ Система группирует работы по TŘÍDNÍK кодам
- ✅ Claude анализирует блок и предлагает сопутствующие работы
- ✅ Результаты отображаются в JSON response

**Коммит:** f5c2bac - "FEAT: Implement Фаза 1 - BOQ Block Analysis with context"

---

### 🟡 Фаза 2: Парсинг документов (4 недели)

**Цель:** Автоматическое извлечение `project_context` из документов

**Статус:** 🔄 В РАБОТЕ

#### Задачи:

- [x] **Интеграция SmartParser из STAVAGENT**
  - [x] Python subprocess интеграция через stavagentClient.js
  - [x] Поддержка PDF (техзадание)
  - [x] Поддержка Excel (материалы)
  - [x] Endpoint `/api/jobs/parse-document`

- [x] **Document Q&A Flow интеграция**
  - [x] Автоматическая генерация вопросов (documentQAService.js)
  - [x] Автоматическое извлечение ответов из документов (pattern-based MVP)
  - [x] Endpoint POST /api/jobs/:jobId/confirm-qa для подтверждения ответов
  - [x] RFI detection (requires_user_input, rfi_needed flags)

- [ ] **Document Validator интеграция**
  - [ ] Проверка полноты загруженных документов
  - [ ] Определение missing data (RFI)
  - [ ] Подсказки пользователю: "Загрузите геологию для анализа фундаментов"

- [ ] **Frontend: Document upload + preview**
  - [ ] Multi-file upload (TechSpec.pdf, Materials.xlsx, etc.)
  - [ ] Предпросмотр извлеченного контекста
  - [ ] Возможность редактировать автоматически извлеченные данные

- [ ] **Кэширование**
  - [ ] Кэш парсинга документов (Redis/файл)
  - [ ] Кэш извлеченного контекста

**Критерии завершения:**
- ✅ Пользователь загружает техзадание → система автоматически извлекает контекст
- ✅ Если данных не хватает → система запрашивает недостающие документы
- ✅ Все извлеченные данные показываются с источниками (страница, файл)

---

### 🟡 Фаза 3: Multi-Role System (6 недель)

**Цель:** Полная интеграция мультиролевой AI экспертизы

**Статус:** 🔄 В РАБОТЕ

#### Задачи:

- [x] **Multi-Role интеграция (MVP)**
  - [x] multiRoleClient.js - HTTP client для STAVAGENT Multi-Role API
  - [x] validateBoqBlock() - Document Validator для проверки блока
  - [x] verifyUrsCode() - верификация выбора URS кода
  - [x] resolveUrsConflict() - разрешение конфликтов между кандидатами
  - [x] Интеграция с /block-match endpoint

- [x] **Automatic validation**
  - [x] Completeness score (0-100%)
  - [x] Missing items detection
  - [x] Warnings and critical issues
  - [x] Graceful degradation если Multi-Role API недоступен

- [ ] **Advanced Multi-Role features**
  - [ ] Вызов Structural Engineer для расчетов
  - [ ] Вызов Concrete Specialist для материалов
  - [ ] Вызов Standards Checker для норм ČSN
  - [ ] Full Orchestrator integration

- [ ] **Conflict Resolution (advanced)**
  - [ ] Автоматическое обнаружение конфликтов в URS кодах
  - [ ] Применение consensus rules
  - [ ] Отображение разрешенных конфликтов

- [ ] **Tech_rules интеграция**
  - [ ] Импорт `tech_rules.js` из STAVAGENT
  - [ ] Проверка обязательных сопутствующих работ
  - [ ] Валидация предложенных `related_items`

**Критерии завершения:**
- ✅ Базовая Multi-Role validation работает (MVP)
- ⏳ Система использует все 6 AI ролей для анализа
- ⏳ Конфликты автоматически разрешаются с объяснениями
- ⏳ Related_items проверяются на обязательность (tech_rules)
- ⏳ Высокая точность предложений (< 10% ложных срабатываний)

---

### 🔴 Фаза 4: Optimization (2 недели)

**Цель:** Повышение производительности и снижение затрат

**Статус:** ⏳ Запланировано

#### Задачи:

- [ ] **Perplexity оптимизация**
  - [ ] Кэширование Perplexity результатов (Redis)
  - [ ] Similarity search для кэша (избежать дублирующих запросов)
  - [ ] Batch API для Perplexity (если доступно)
  - [ ] Параллельные запросы с лимитом (5-10 одновременно)

- [ ] **Performance tuning**
  - [ ] Профилирование узких мест
  - [ ] Оптимизация TŘÍDNÍK parsing (однократная загрузка)
  - [ ] Lazy loading для больших документов
  - [ ] Pagination для результатов

- [ ] **Cost optimization**
  - [ ] Мониторинг затрат на AI API
  - [ ] Использование более дешевых моделей для простых задач
  - [ ] Кэширование LLM ответов (semantic cache)

- [ ] **Monitoring & Analytics**
  - [ ] Логирование всех block analysis запросов
  - [ ] Метрики точности (user feedback)
  - [ ] Dashboard для отслеживания usage

**Критерии завершения:**
- ✅ Анализ блока 30 строк < 2 минуты (vs 10+ минут сейчас)
- ✅ Экономия 70%+ на Perplexity (через кэширование)
- ✅ Мониторинг позволяет отслеживать качество и затраты

---

## 📈 Метрики успеха

### Фаза 1:
- ⏱️ Время анализа блока: < 5 минут
- 🎯 Точность группировки: > 85%
- 💡 Related items релевантность: > 70%

### Фаза 2:
- 📄 Автоматическое извлечение context: > 90%
- ❓ RFI точность (правильные вопросы): > 85%
- ⏱️ Время парсинга документов: < 1 минута

### Фаза 3:
- 🤖 Multi-role accuracy: > 95%
- ⚖️ Conflict resolution: 100% (все конфликты разрешены)
- 📋 Tech_rules coverage: > 80% обязательных работ найдено

### Фаза 4:
- ⚡ Performance: < 2 минуты для блока 30 строк
- 💰 Cost reduction: 70% экономии на API вызовах
- 📊 Cache hit rate: > 60%

---

## 🔧 Технические решения

### Режимы работы URS Matcher:

1. **`mode: "single_work"`** (существующий)
   - Ручной ввод одной работы
   - Perplexity + LLM re-ranking
   - Результат: 1-3 URS кода

2. **`mode: "boq_block_analysis"`** (новый - ФАЗА 1-3)
   - Загрузка файла с блоком работ
   - Ручной/автоматический ввод контекста
   - TŘÍDNÍK группировка
   - Multi-role анализ
   - Результат: URS коды + related_items + block_summary

3. **`mode: "full_project_audit"`** (будущее расширение)
   - Анализ всего проекта сразу
   - Кросс-валидация между блоками
   - Глобальные missing items

---

## 📚 Связанные документы

- [SYSTEM_DESIGN.md](../concrete-agent/docs/SYSTEM_DESIGN.md) - Архитектура STAVAGENT
- [MULTI_ROLE_SYSTEM.md](../concrete-agent/docs/MULTI_ROLE_SYSTEM.md) - Multi-Role AI
- [document_qa_flow.md](../concrete-agent/docs/TECH_SPECS/document_qa_flow.md) - Document Q&A
- [README.md](./README.md) - Основная документация URS Matcher

---

## 🤝 Вклад и обратная связь

Если вы нашли баг или у вас есть предложение:
1. Создайте issue с тегом `[URS-Block-Analysis]`
2. Опишите ожидаемое vs фактическое поведение
3. Приложите примеры данных (если возможно)

---

**Последнее обновление:** 2025-11-24
**Ответственный:** Development Team
**Статус проекта:** 🔵 Активная разработка - Фаза 1
