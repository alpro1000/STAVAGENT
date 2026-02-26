# Next Session - Quick Start

**Last Updated:** 2026-02-26
**Current Branch:** `claude/pump-calculator-tovmodal-fix-FcLSo`
**Last Session:** Pump Calculator fixes, Poradna v Portal, Universal Parser Preview, Monolit bugs

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md && cat NEXT_SESSION.md

# 2. Check branch and recent commits
git log --oneline -10

# 3. TypeScript check (rozpocet-registry)
cd rozpocet-registry && npx tsc --noEmit --skipLibCheck

# 4. Run tests
cd ../Monolit-Planner/shared && npx vitest run        # 51 tests
```

---

## Сессия 2026-02-26: Резюме

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| TOVSummary (registry) | FIX: formwork + pump costs включены в "Celkem TOV:" | ✅ |
| Portal — Poradna norem | PoradnaWidget + бэкенд-прокси `/api/kb/research` → concrete-agent | ✅ |
| Portal — Universal Parser | ParsePreviewModal + drag-drop + сводка типов работ + kiosk cards | ✅ |
| concrete-agent render.yaml | Добавлены GOOGLE_API_KEY, PERPLEXITY_API_KEY, MULTI_ROLE_LLM | ✅ |
| PostgreSQL (Monolit) | FIX: connection timeout на Render Free Tier (DB sleep recovery) | ✅ |
| concrete-agent | FEAT: Multilingual Expert Standards Researcher (любой язык + KB cache) | ✅ |
| Monolit — Passport | FIX: blank screen, razítko detection, model names | ✅ |
| Monolit — CORS | FIX: CORS hang + migration 006 + formwork calculator (4 bugs) | ✅ |
| FormworkAIModal | FIX: z-index trap — рендер позади FormworkCalculatorModal | ✅ |
| FormworkAIModal | FIX: createPortal — document.body был в неверном return компонента | ✅ |
| Pump Calculator (Monolit) | FIX: pre-fill Název, m³ ÷ takty формула, result card в Mechanizmy | ✅ |

---

### Ключевые изменения:

#### 1. TOVSummary — исправлен расчёт Celkem TOV
```
БЫЛО: Celkem TOV = только бетон + арматура + бетонирование
СТАЛО: Celkem TOV = бетон + арматура + бетонирование + formwork + pump
FIX: formworkCost + pumpCost теперь суммируются в итоговую строку
```

#### 2. Poradna norem — виджет на PortalPage
```
PortalPage → PoradnaWidget (сворачиваемый блок)
  6 suggested chips (ČSN normy, TKP, ceny, BOZP...)
  textarea → Ctrl+Enter submit
  → POST /api/kb/research (Portal backend proxy)
    → POST /api/v1/kb/research (concrete-agent)
      1. KB cache (research_<md5>.json)     → бесплатно, бейдж [Z KB cache]
      2. Perplexity sonar-pro               → бейдж [perplexity/sonar-pro]
      3. Gemini fallback (без Perplexity)   → бейдж [Gemini fallback]
      4. Сохранить → KB/<auto-category>/   → бейдж [Uloženo → KB/B5]
```

#### 3. Universal Parser Preview (Portal)
```
PortalPage → "Náhled výkazu" card → ParsePreviewModal
  drag-drop .xlsx/.xls → POST /api/parse-preview (in-memory, без проекта)
  Результат:
    - кол-во листов, строк, столбцов
    - work type distribution (ZEMNI_PRACE, BETON_MONOLIT, ...)
    - Kiosk cards с кнопкой "Otevřít kiosk" (Phase 3: Send to Kiosk)
```

#### 4. Multilingual Expert Standards Researcher
```
concrete-agent: новая роль "multilingual_expert_researcher"
  - Отвечает на любом языке (чешский, русский, английский, ...)
  - KB cache → Perplexity → Gemini fallback
  - Автоматически определяет категорию KB по ключевым словам:
      "čsn", "norma" → B2_csn_standards
      "cena", "kč"   → B3_current_prices
      "bozp", "zákon"→ B7_regulations
      "jeřáb", "pumpa"→ B9_Equipment_Specs
      default        → B5_tech_cards
```

#### 5. Pump Calculator — исправления (Monolit / Mechanizmy)
```
FIX 1: Název — pre-fill "Autočerpadlo Putzmeister" при открытии
FIX 2: m³ ÷ takty — правильная формула (часы × výkon × takty = m³)
FIX 3: result card — отображается в секции Mechanizmy после расчёта
```

#### 6. FormworkAIModal — z-index trap
```
БЫЛО: FormworkAIModal.tsx → return createPortal(<Modal>, document.body) внутри
      FormworkCalculatorModal → z-index: 50 перекрывал всё дочернее
СТАЛО: createPortal вызывается в правильном месте компонентного дерева
       FormworkAIModal отображается поверх FormworkCalculatorModal
```

---

### Новые файлы этой сессии:
```
stavagent-portal/backend/src/routes/kb-research.js          NEW (~50 строк)
stavagent-portal/frontend/src/components/portal/PoradnaWidget.tsx  NEW
stavagent-portal/frontend/src/components/portal/ParsePreviewModal.tsx  NEW
```

### Изменённые файлы:
```
rozpocet-registry/src/components/tov/TOVSummary.tsx         +formworkCost +pumpCost
Monolit-Planner/frontend/src/components/FormworkAIModal.tsx  createPortal fix
Monolit-Planner/frontend/src/components/PumpCalculator.tsx   pre-fill, m³÷takty, result card
Monolit-Planner/backend/src/server.js                        +kbResearchRoutes, CORS fix
Monolit-Planner/backend/migrations/006_*.sql                 DB migration
stavagent-portal/frontend/src/pages/PortalPage.tsx           +PoradnaWidget +ParsePreviewModal
stavagent-portal/backend/src/routes/portal-projects.js       +parse-preview endpoint
concrete-agent/render.yaml                                   +GOOGLE_API_KEY +PERPLEXITY_API_KEY
concrete-agent/packages/core-backend/app/services/multi_role.py  +multilingual_expert_researcher
```

### Коммиты сессии:
```
72f0466 FIX: TOVSummary — formwork + pump costs included in Celkem TOV
d0fa7a4 FEAT: Poradna norem в Portal + Universal Parser Preview UI
b330b2c FIX: concrete-agent render.yaml — add GOOGLE_API_KEY + PERPLEXITY_API_KEY + explicit MULTI_ROLE_LLM
828db46 FIX: PostgreSQL connection timeout on Render Free Tier (DB sleep recovery)
face0e0 FEAT: Multilingual Expert Standards Researcher — KB + any-language portal
98c6f04 FIX: Passport module blank screen, razítko detection, model names
e7f4a1f FIX: Monolit — CORS hang, migration 006, formwork calculator (4 bugs)
47b9f47 FIX: FormworkAIModal renders behind FormworkCalculatorModal (z-index trap)
e91a020 FIX: createPortal args — document.body was in wrong component return
08827fc FIX: Pump calculator — Název pre-fill, m³ ÷ takty, result card in Mechanizmy
```

---

## ⏭️ Следующие задачи (приоритет)

### 🔴 Приоритет 1: Universal Parser Phase 3 — Send to Kiosk
```
ParsePreviewModal → кнопка "Odeslat do Monolitu" / "Odeslat do Registry"
  → POST /api/monolit-import (Portal backend)
    → POST https://monolit-planner-api.onrender.com/import
      body: { projectId, projectName, positions[] }

Monolit: добавить endpoint POST /import (принять items от Portal)
Registry: аналогично (открыть registry + передать items через postMessage или URL)
```

### 🔴 Приоритет 2: Pump Calculator (TOVModal в registry) — незакрытые задачи
```
Файл: rozpocet-registry/src/components/tov/TOVModal.tsx

[ ] handlePumpRentalChange — обработчик изменений (паттерн как handleFormworkRentalChange)
[ ] pumpCost — отображение в footer breakdown (строка "Čerpadlo")
[ ] auto-save PumpRentalSection — useRef isAutoSaving (как у FormworkRentalSection)
```

### 🟠 Приоритет 3: Poradna norem — расширение
```
[ ] Добавить suggested questions до 10-12 (сейчас 6)
[ ] Создать seed KB — 5-10 часто задаваемых вопросов заранее сохранённых
[ ] Проверить авто-определение категорий в браузере
[ ] Добавить Poradna как отдельную страницу в Portal (route /poradna)
```

### 🟡 Приоритет 4: Monolit — AI Suggestion Button
```
[ ] Выполнить БЫСТРОЕ_РЕШЕНИЕ.sql в Render DB Shell
    → активирует FF_AI_DAYS_SUGGEST = true
    → кнопка ✨ в колонке "Dny" станет активна
```

---

## ⏳ AWAITING USER ACTION

### 1. Переменные окружения (добавить в Render)
```env
# concrete-agent (для Perplexity в KB Research):
PERPLEXITY_API_KEY=pplx-...   # без него — fallback на Gemini (работает, но без источников)

# concrete-agent (для OpenAI в FormworkAssistant, если хотите GPT-4o mini):
OPENAI_API_KEY=sk-...         # без него — fallback на Multi-Role (работает)
```

### 2. Merge PR
```
Branch: claude/pump-calculator-tovmodal-fix-FcLSo
URL: https://github.com/alpro1000/STAVAGENT/compare/main...claude/pump-calculator-tovmodal-fix-FcLSo
```

### 3. AI Suggestion Button (Monolit) — ожидает SQL
```bash
# Render Dashboard → monolit-db → Shell:
psql -U monolit_user -d monolit_planner < БЫСТРОЕ_РЕШЕНИЕ.sql
```

### 4. Старые задачи (низкий приоритет)
- Google Drive Setup → `GOOGLE_DRIVE_SETUP.md`
- Keep-Alive → `KEEP_ALIVE_SETUP.md`
- R0 + Unified Architecture PR → `claude/portal-audit-improvements-8F2Co`

---

## 🧪 Статус тестов

| Сервис | Тесты | Статус |
|--------|-------|--------|
| Monolit shared formulas | 51/51 | ✅ Pass |
| rozpocet-registry tsc build | npx tsc --noEmit | ✅ Pass |
| URS Matcher | 159 | ⚠️ Не запускались в этой сессии |

---

## 🏗 Текущая архитектура Poradna / KB Research

```
Portal PortalPage
  └── PoradnaWidget
        ↓ POST /api/kb/research (stavagent-portal backend)
  kb-research.js (proxy)
        ↓ POST /api/v1/kb/research
  concrete-agent routes_kb_research.py
    1. KB cache (research_<md5>.json) → бесплатно
    2. Perplexity sonar-pro → чешские строительные сайты
    3. Gemini fallback
    4. Сохранить → KB/<auto-category>/research_<key>.json
    → { answer, sources[], from_kb, kb_saved, kb_category, model }

FormworkAIModal (Monolit)
  └── Вкладка [Poradna norem]
        ↓ POST /api/kb/research (Monolit backend proxy)
  kb-research.js → то же самое → concrete-agent
```

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай NEXT_SESSION.md (этот файл)
3. git log --oneline -10
4. Спроси: Universal Parser Phase 3 (Send to Kiosk) или Pump TOVModal или Poradna расширение?
```

*Ready for next session!*
