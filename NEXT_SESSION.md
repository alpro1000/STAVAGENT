# Next Session - Quick Start

**Last Updated:** 2026-02-25
**Current Branch:** `claude/pump-calculator-tovmodal-fix-FcLSo`
**Last Session:** Poradna norem в Portal + Universal Parser Preview UI (Phase 2)

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md

# 2. Check branch and recent commits
git checkout claude/formwork-calculator-review-ArdKs
git log --oneline -10

# 3. TypeScript check (rozpocet-registry)
cd rozpocet-registry && npx tsc --noEmit --skipLibCheck

# 4. Run tests
cd ../Monolit-Planner/shared && npx vitest run        # 51 tests
```

---

## Сессия 2026-02-25: Резюме

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| FormworkAIModal (Monolit) | Добавлен OpenAI GPT-4o mini как 3-й вариант модели | ✅ |
| FormworkAIModal (Monolit) | Исправлен лейбл Gemini 2.0 → 2.5 Flash | ✅ |
| concrete-agent | Новый endpoint POST /api/v1/kb/research (Poradna norem) | ✅ |
| Monolit backend | Прокси /api/kb/research → concrete-agent | ✅ |
| FormworkAIModal (Monolit) | Вкладка "Poradna norem" с поиском и кэшем в KB | ✅ |
| concrete-agent | FIX: Shrnutí — подключён реальный SummaryGenerator | ✅ |
| routes_accumulator.py | GenerateSummaryRequest + project_name проброшен через цепочку | ✅ |
| FormworkRentalSection (registry) | FIX: rental_czk_m2_month null → 0 (TS2322 build error) | ✅ |

---

### Ключевые изменения:

#### 1. FormworkAIModal — 3 модели
```
[Gemini 2.5 Flash]  ~1s  · concrete-agent Multi-Role (brief prompt)
[GPT-4o mini]       ~2s  · OpenAI API напрямую (если OPENAI_API_KEY) / Multi-Role fallback
[Claude Sonnet 4.6] ~5s  · concrete-agent Multi-Role (detailed prompt)
```

#### 2. Poradna norem — новая вкладка в FormworkAIModal
```
Вкладка [Poradna norem] в FormworkAIModal:
  6 suggested chips → textarea (Ctrl+Enter submit)
  → POST /api/kb/research (Monolit backend proxy)
    → POST /api/v1/kb/research (concrete-agent)
      1. Проверить KB cache (research_<md5>.json) → бесплатно
      2. Perplexity sonar-pro (10 чешских стройных сайтов)
      3. Gemini fallback (если нет PERPLEXITY_API_KEY)
      4. Сохранить → KB/B5_tech_cards/research_<key>.json

Бейджи результата:
  [Z KB cache]      ← зелёный, повторный запрос
  [perplexity/...] ← синий, новый поиск
  [Uloženo → KB/B5] ← жёлтый, сохранено
```

#### 3. Shrnutí в Portal — ИСПРАВЛЕН
```
БЫЛО: _execute_generate_summary() → fallback "Project contains N positions"
СТАЛО: → SummaryGenerator.generate_summary() → 5 Multi-Role AI ролей
         (Document Validator, Structural Engineer, Concrete Specialist,
          Cost Estimator, Standards Checker)
       → полный ProjectSummary (executive_summary, key_findings,
         recommendations, critical_issues, overall_status)
       → graceful fallback при ошибке AI

project_name теперь передаётся через весь путь:
  Portal UI → GenerateSummaryRequest → queue_generate_summary → _execute
```

---

### Новые файлы этой сессии:
```
concrete-agent/packages/core-backend/app/api/routes_kb_research.py   NEW (~170 строк)
Monolit-Planner/backend/src/routes/kb-research.js                    NEW (~50 строк)
```

### Изменённые файлы:
```
concrete-agent/packages/core-backend/app/api/__init__.py              +kb_research_router
concrete-agent/packages/core-backend/app/services/document_accumulator.py  +SummaryGenerator
concrete-agent/packages/core-backend/app/api/routes_accumulator.py   +project_name field
stavagent-portal/frontend/src/components/portal/ProjectDocuments.tsx  +project_name in request
Monolit-Planner/backend/server.js                                     +kbResearchRoutes
Monolit-Planner/backend/src/routes/formwork-assistant.js              +OpenAI branch
Monolit-Planner/frontend/src/components/FormworkAIModal.tsx           +Poradna tab, 3 models
rozpocet-registry/src/components/tov/FormworkRentalSection.tsx        null ?? 0 fix
```

### Коммиты сессии:
```
0152a19 FIX: FormworkRentalSection — rental_czk_m2_month null → 0 (TS2322)
841fda5 FIX: Shrnutí — подключён реальный SummaryGenerator (Multi-Role AI)
7b8d573 FEAT: Poradna norem — KB Research module + FormworkAIModal tab
9b94c15 FIX: FormworkAIModal — Gemini 2.0 → 2.5 Flash
ea8aff7 FEAT: FormworkAIModal — добавлен OpenAI GPT-4o mini
```

---

## ⏭️ Следующие задачи (приоритет)

### ✅ Poradna norem в Portal — ЗАВЕРШЕНО (сессия 2026-02-25)
- [x] Portal backend: POST /api/kb/research → proxy → concrete-agent
- [x] Portal frontend: PoradnaWidget.tsx — chips + textarea + results + badges
- [x] PortalPage: Poradna section между Services и Stats (сворачиваемый)
- [ ] Добавить `STAVAGENT_CORE_URL` в Render (Portal backend) если не задан
- [ ] Добавить `PERPLEXITY_API_KEY` в Render (concrete-agent) если не задан
- [ ] Проверить в браузере: chip → поиск → ответ → from_kb/model badges

### ✅ Universal Parser Phase 2 — ЗАВЕРШЕНО (сессия 2026-02-25)
- [x] Portal backend: POST /api/parse-preview — in-memory parse без проекта
- [x] Portal frontend: ParsePreviewModal.tsx — drag-drop + metadata + types + kiosk cards
- [x] PortalPage: "Náhled výkazu" service card → открывает модал
- [ ] Поле "Send to Kiosk" с передачей данных (Phase 3 — POST to kiosk with parsed items)

### Приоритет 1: Poradna — доработка
- [ ] Проверить авто-определение категорий (B2 для ČSN, B3 для цен, B5 для поступов)
- [ ] Добавить ещё suggested questions (сейчас 6, добавить до 10-12)
- [ ] Создать начальный seed KB (5–10 часто задаваемых)

### ✅ Pump Calculator — ЗАВЕРШЕНО (сессия 2026-02-25)
- [x] `handlePumpRentalChange` в TOVModal (паттерн как handleFormworkRentalChange)
- [x] `pumpCost` в footer breakdown TOVModal
- [x] auto-save для PumpRentalSection (isAutoSaving ref)
- [x] **FIX: TOVSummary** — formwork + pump costs добавлены в `Celkem TOV:` (баг: ранее не учитывались)

### Приоритет 2: Universal Parser Phase 3
- [ ] "Send to Kiosk" с передачей данных (POST parsed items to kiosk API)
- [ ] Monolit: "Load from Portal" — принять items от portal parse-preview
- [ ] Registry: аналогично

---

## ⏳ AWAITING USER ACTION

### 1. Переменные окружения (добавить в Render)
```env
# Monolit-Planner backend (для Poradna norem):
STAVAGENT_CORE_URL=https://concrete-agent.onrender.com  # дефолт уже есть, но лучше явно

# concrete-agent (для Perplexity в KB Research):
PERPLEXITY_API_KEY=pplx-...   # без него — fallback на Gemini (работает, но без источников)

# concrete-agent (для OpenAI в FormworkAssistant, если хотите GPT-4o mini):
OPENAI_API_KEY=sk-...         # без него — fallback на Multi-Role (работает)
```

### 2. PR Review
- `claude/formwork-calculator-review-ArdKs` — содержит все изменения, готов к review

### 3. AI Suggestion Button (Monolit) — по-прежнему ожидает
```bash
# В Render Dashboard → monolit-db → Shell → БЫСТРОЕ_РЕШЕНИЕ.sql
```

### 4. Старые задачи
- Google Drive Setup → `GOOGLE_DRIVE_SETUP.md`
- Keep-Alive → `KEEP_ALIVE_SETUP.md`

---

## 🧪 Статус тестов

| Сервис | Тесты | Статус |
|--------|-------|--------|
| Monolit shared formulas | 51/51 | ✅ Pass |
| rozpocet-registry Vercel build | tsc -b && vite build | ✅ (после fix null→0) |
| URS Matcher | 159 | ⚠️ Not run this session |

---

## 🏗 Архитектура KB Research

```
FormworkAIModal
  └── Вкладка [Poradna norem]
        ↓ POST /api/kb/research (Monolit)
  Monolit backend: kb-research.js (proxy)
        ↓ POST /api/v1/kb/research
  concrete-agent: routes_kb_research.py
    1. Ищет research_<md5(question)>.json в KB/*
    2. Perplexity sonar-pro → csnonline.cz, tkp, beton.cz ...
    3. Gemini fallback (GOOGLE_API_KEY)
    4. Сохраняет в KB/<auto-category>/research_<key>.json
    5. Возвращает { answer, sources[], from_kb, kb_saved, kb_category }
```

**Авто-определение категории из вопроса:**
```
"čsn", "norma", "tkp"          → B2_csn_standards
"cena", "kč/m²", "ceník"       → B3_current_prices
"výkon", "produktivita", "nph"  → B4_production_benchmarks
"zákon", "bozp", "nařízení"    → B7_regulations
"jeřáb", "čerpadlo", "pumpa"   → B9_Equipment_Specs
default                         → B5_tech_cards
```

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай NEXT_SESSION.md (этот файл)
3. git log --oneline -10
4. Проверь: работает ли Poradna в браузере?
5. Спроси: продолжать Poradna или переключиться на Pump Calculator?
```

*Ready for next session!*
