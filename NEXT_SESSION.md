# Next Session - Quick Start

**Last Updated:** 2026-02-08
**Current Branch:** `claude/continue-implementation-96tR9`
**Last Session:** URS Matcher - Price Module + Norms KB

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md

# 2. Read current session summary
cat docs/SESSION_2026-02-08_PRICES_MODULE.md

# 3. Check branch and recent commits
git checkout claude/continue-implementation-96tR9
git log --oneline -10

# 4. Start development
cd URS_MATCHER_SERVICE/backend && npm run dev   # URS :3001

# 5. Continue implementation (see Next Steps below)
```

---

## Сессия 2026-02-08: Резюме

### Что сделано:

| Phase | Задача | Статус |
|-------|--------|--------|
| 1-2 | Runtime model selection for all LLM endpoints | ✅ |
| 3 | 6 specialist roles (KONSTRUKTOR, BETONÁŘ, etc.) | ✅ |
| 4 | Norms KB with Brave + Tavily web search | ✅ |
| 5 | Price module (DEK.cz + Betonárny) | ✅ |

### Коммиты (2026-02-08):
```
bebd3dc FIX: Add named export for TRUSTED_SOURCES in webSearchClient
b7bceb8 FEAT: Add DEK.cz and concrete supplier parsers
d0a88a0 FEAT: Add price module with commercial offers and history
54a1130 FEAT: Add norms knowledge base with web search integration
73c9de7 FEAT: Add project analysis with 6 specialist roles
57396fc FEAT: Apply runtime model selection to all LLM endpoints
```

### Новые модули:

```
URS_MATCHER_SERVICE/backend/src/
├── services/prices/
│   ├── priceSources.js         # Источники: DEK, betonárny, hutní
│   ├── priceDatabase.js        # JSON storage + история + КП
│   ├── priceService.js         # Оркестратор с приоритетами
│   ├── dekParser.js            # Парсер DEK.cz
│   └── concreteSupplierParser.js  # Парсер бетонарен
├── services/norms/
│   ├── webSearchClient.js      # Brave + Tavily
│   ├── normParser.js           # ČSN/EN парсинг
│   ├── knowledgeBase.js        # JSON storage + индексы
│   └── normsService.js         # Оркестратор
├── services/projectAnalysis/
│   ├── roles.js                # 6 ролей специалистов
│   └── orchestrator.js         # Координация ролей
└── api/routes/
    ├── norms.js                # Norms API
    ├── prices.js               # Prices API
    └── projectAnalysis.js      # Project Analysis API
```

---

## Приоритет источников цен

```
1. Коммерческое предложение (привязано к проекту)
2. Свежие данные из базы (< 7 дней)
3. Web-поиск (DEK.cz, betonárny)
4. Исторические данные из опыта (fallback)
```

---

## API Endpoints

### Prices (`/api/prices/`)
```
GET  /find              - Найти цену
POST /offer             - Загрузить КП
GET  /offers/:projectId - КП по проекту
POST /manual            - Ручной ввод

# DEK.cz
GET  /dek/find          - Поиск материала
GET  /dek/catalog/:cat  - Каталог по категории
GET  /dek/categories    - Все категории

# Бетон
GET  /concrete/find     - Цена бетона
GET  /concrete/compare  - Сравнение поставщиков
GET  /concrete/classes  - Классы бетона
GET  /concrete/suppliers - Поставщики
POST /concrete/delivery - Расчёт доставки
```

### Norms (`/api/norms/`)
```
GET  /search            - Поиск норм
GET  /fetch/:code       - Конкретная норма
GET  /laws              - Законы и vyhlášky
GET  /stats             - Статистика KB
```

### Project Analysis (`/api/project-analysis/`)
```
POST /analyze           - Полный анализ (6 ролей)
POST /role/:roleId      - Вопрос конкретной роли
GET  /roles             - Список ролей
```

---

## Next Steps (Phase 6+)

### Phase 6: Technology Calculations
- [ ] Расчёт площади опалубки из объёма бетона
- [ ] Оценка армирования (kg/m³ по типу конструкции)
- [ ] Разбивка по этапам работ
- [ ] Интеграция с формулами Monolit-Planner

### Phase 7: Integration with Other Kiosks
- [ ] Связь модуля цен с позициями Monolit-Planner
- [ ] Обмен данными norms KB с concrete-agent
- [ ] Унифицированный поток данных через Portal

### Technical Debt
- [ ] Тесты для новых модулей price/norms
- [ ] API документация (Swagger/OpenAPI)
- [ ] Рассмотреть SQLite вместо JSON файлов

---

## Архитектура БД (Справка)

```
Portal (Hub) ────┬──→ Monolit (PostgreSQL/SQLite)
                 │     └── positions, snapshots
                 │
                 ├──→ URS Matcher (SQLite)
                 │     └── jobs, urs_items, kb_mappings
                 │
                 ├──→ concrete-agent (PostgreSQL)
                 │     └── projects, audit_results
                 │
                 └──→ rozpocet-registry (localStorage)
                       └── Browser-only

Связующий ключ: portal_project_id (UUID)
```

---

## Environment Variables

```env
# Web Search (для norms/prices)
BRAVE_API_KEY=...
TAVILY_API_KEY=...

# LLM (для извлечения)
ANTHROPIC_API_KEY=...
GOOGLE_AI_KEY=...
OPENAI_API_KEY=...

# concrete-agent
STAVAGENT_API_URL=https://concrete-agent.onrender.com
```

---

## Service URLs

| Service | URL |
|---------|-----|
| Portal | https://stav-agent.onrender.com |
| Monolit API | https://monolit-planner-api.onrender.com |
| URS Matcher | https://urs-matcher-service.onrender.com |
| CORE | https://concrete-agent.onrender.com |

---

**При старте следующей сессии:**
```
1. Прочитай CLAUDE.md
2. Прочитай docs/SESSION_2026-02-08_PRICES_MODULE.md
3. Проверь NEXT_SESSION.md — текущая фаза
4. Продолжай реализацию Phase 6
```

*Ready for next session!*
