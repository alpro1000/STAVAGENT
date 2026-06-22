# FINDINGS — T1: Локализация общестроительного атомизатора (recon)

> **Тип:** recon, гейт. Имплементации НЕТ. Прод-код не тронут.
> **Ветка:** `claude/atomizer-localize` · **Дата:** 2026-06-19
> **Таск:** `docs/tasks/TASK_atomizer-obshchestroy-localize_2026-06-19.md`
> **Метод:** чтение кода (Explore-свип + точечная верификация путей). Каждый вердикт — по коду, не догадка.

---

## 0. Главное за 30 секунд

1. **Слой декомпозиции в проде найден** — словарь `WORK_TEMPLATES` в `breakdown.py`, бетон-only. Это точка вставки.
2. **Тест-проверенная не-бетонная логика найдена** — `sandbox/uwo-interier-mezonet/` (полный 3-стадийный пайплайн, 10 PSV-секций, harness-тесты). **ОРФАН**, не подключён.
3. **Вердикт: ПАРАЛЛЕЛЬНАЯ реализация** (JS-sandbox vs Python-прод, разные архитектуры). Обоснование §3.
4. **⚠️ Корректировка STATUS:** план интеграции **уже существует** как design-спека `docs/specs/universal-work-decomposer/design.md` (стадия review). T1 — это не «спроектировать порт», а «валидировать существующий дизайн + закрыть одну дыру».
5. **⚠️ Корректировка STATUS §11:** утверждение «ÚRS-биндинг для общестроя уже есть» — **наполовину неверно по коду** (§4).

---

## 1. Прод-атомизатор (LIVE, бетон-only)

**Файл:** `concrete-agent/packages/core-backend/app/mcp/tools/breakdown.py`

- MCP-инструмент `create_work_breakdown(elements, project_type, catalog, mode)` (строка 198).
- **Слой декомпозиции = `WORK_TEMPLATES`** (строки ~20–50): dict, ключ = `element_type`, fallback `WORK_TEMPLATES["default"]`.
- Все шаблоны бетонные: `bednění / odbednění / výztuž B500B / beton / ošetřování / předpětí Y1860`. Ключи: `default`, `pilota`, `mostovkova_deska`, `rimsa`.
- Декомпозиция выбирается строкой 312: `templates = WORK_TEMPLATES.get(etype, WORK_TEMPLATES["default"])`.
- `etype` приходит из `_classify` (`app/mcp/tools/classifier.py`, `ELEMENT_TYPES`) — **22 конструктивных типа**, не-бетонных профессий там нет.
- `qty_factor` тоже бетонные: `formwork_area / rebar_tons / volume / length / prestress_tons`.

**Вывод:** декомпозиция фундаментально завязана на бетонные element-типы. Не-бетонный scope, попав сюда сегодня, провалится в `default` и вернёт бетонные атомы — «sebevědomě-špatně» (это же зафиксировано в design.md §0.1).

---

## 2. Тест-проверенная не-бетонная логика (ОРФАН) — где лежит

### 2a. ⭐ Главное — UWO sandbox (полный пайплайн всех PSV-работ)
**Директория:** `sandbox/uwo-interier-mezonet/src/` (verified, файлы существуют)

| Файл | Что | Грань |
|---|---|---|
| `scope-router.mjs` | scope-текст → ветка (`monolit` / `interier_psv` / `null` honest-blank) по keyword-словарям | Stage 1 |
| `decomposer.mjs` | секция → ПАК work-атомов, codeless+priceless (Pattern 15) | Stage 2 |
| `templates.mjs` | **10 секций S1–S10** не-бетонных шаблонов (malba/štuk/koupelna/vinyl/parkety/SDK/elektro/kotel/okna/schody/VRN) | библиотека |
| `catalog-adapter.mjs` | work-атом → каталог-кандидат со status-enum `exact\|candidate\|group_only\|not_verified` | Stage 3 |
| `cost.mjs` | ориентировочная цена + сверка с baseline | post |
| `pipeline.mjs` | сборка 4 стадий | orchestr |
| `harness.test.mjs` | acceptance-тесты (8 AC: koupelna=пак, honest-blank, status-enum, malba как gap, kotel-цепочка, sanity-flags, total ±15%) | тесты |

- **Язык:** JavaScript/Node (`node --test`), **офлайн** (каталог-проба заморожена в `data/catalog-findings.json`).
- **Wiring:** ❌ не в MCP, ❌ не во фронте, ❌ не в продакшн-KB. Чистый sandbox.
- `qty_source` provenance: `needs_input / derived_from_scope / from_soupis / fixed_1` — количества не хардкод.

### 2b. Pilot-генераторы (frozen outputs, не библиотека)
- `test-data/RD_Jachymov_dum/tools/atomic_decomposition.py` — 212 позиций → 181 атом по 9 профессиям (skladba→vrstva split, montáž/materiál auto-split). Output `outputs/atomic_decomposition_map.json`. ОРФАН (test-data-only).
- `test-data/hk212_hala/scripts/` — фазовые скрипты HSV+M секций. Полу-привязаны к golden-тестам, не библиотека.

> Pilot-скрипты = **доказательство, что логика работает на реальных документах**, но это per-project генераторы, НЕ переиспользуемый слой. Канонический источник шаблонов для порта = **2a (UWO sandbox templates.mjs)**.

### 2c. Design-спека (уже существует!)
**Файлы:** `docs/specs/universal-work-decomposer/{design.md (24 КБ), requirements.md}` — стадия **review**.
Содержит готовый план интеграции (см. §5). Это меняет суть T1.

---

## 3. ВЕРДИКТ: та же или параллельная? → **ПАРАЛЛЕЛЬНАЯ** (по коду)

| Ось | Прод `breakdown.py` | Sandbox UWO |
|---|---|---|
| Язык | Python | JavaScript/Node |
| Архитектура | один dict `WORK_TEMPLATES` + inline-биндинг | 3 стадии: router → decomposer → adapter |
| Маршрутизация | нет (сразу по element_type) | scope-router отделяет ветки + honest-blank |
| Покрытие | бетон/конструктив | 10 PSV-секций (не-бетон) |
| Каталог-биндинг | `find_otskp_code` инлайн, ранний return для не-OTSKP | отдельный adapter, status-enum, frozen ÚRS-проба |

**Где именно расходятся:** на всех трёх осях (классификация → декомпозиция → биндинг). Это не «та же логика в двух местах», это **две разные реализации одной идеи**.

**Но design.md уже предписывает их СВЕСТИ, не плодить:**
- design.md §0.1 + §4.1 (строки 77, 230): «`breakdown.py` `WORK_TEMPLATES` → reuse как **ветка `monolit`** в реестре. Nezdvojovat; zaregistrovat.»
- §4.1 (строка 78): не-бетонные словари router'а живут в **параллельной** структуре (`dictionaries.<section>` / sibling YAML), **не форк** бетонной онтологии.
→ Целевое состояние по дизайну — ОДИН механизм (UWO в concrete-agent), где монолит = одна из веток. Это соответствует CLAUDE.md «no parallel data structures».

---

## 4. ⚠️ Состояние ÚRS-биндинга — корректировка STATUS §11

STATUS §11 утверждает: «ÚRS-биндинг для общестроя уже есть (`catalog='urs'`, `project_type='budova'`)». **По коду — наполовину неверно:**

**Что РЕАЛЬНО есть:**
- `find_urs_code` (`app/mcp/tools/urs.py`) — самостоятельный MCP-инструмент. Ищет ÚRS (39k) через Perplexity (`urs.cz`/`podminky.urs.cz`) + `urs-matcher-service` (Cloud Run). Принимает building-контекст. ✅
- `create_work_breakdown` принимает `project_type='budova'` и `catalog='urs'` как параметры. ✅ (на уровне сигнатуры)

**Чего НЕТ (дыра):**
- `_attach_catalog_codes` (`breakdown.py:157`) делает **ранний `return` для `catalog not in ("otskp","both")`** и зовёт **только** `find_otskp_code`. Вызова `find_urs_code` в атомизаторе **нет вообще** (grep по `app/mcp/`: find_urs_code зарегистрирован как tool, но из `breakdown.py` не вызывается).
- → При `catalog='urs'` атомизатор отдаёт work-first список, но **биндинг молча ничего не делает**. URS-кодов не будет.
- Sandbox-adapter тоже не зовёт живой `find_urs_code` — использует **замороженную** пробу `data/catalog-findings.json`.

**Точный вывод:** ÚRS *поиск* (capability) — есть. ÚRS *биндинг в атомизатор* — **НЕ построен**. Шаблонам общестроя будет к чему биндиться (`find_urs_code` живой), но связку «work-атом → find_urs_code → status-enum» надо **создать** (это и есть catalog-binding adapter из design.md §3).

---

## 5. План интеграции (по существу — валидация существующего дизайна)

> Ключевой сдвиг: **не проектировать с нуля**. План уже есть в `design.md`. Задача имплементации = реализовать его + закрыть дыру §4.

**Что портировать и куда (из design.md, подтверждено кодом):**
1. **Scope-router** (новый, Python, upstream) — порт логики `scope-router.mjs` → решает `section_code` ДО классификации. Element-classifier зовётся только для `section_code='monolit'`.
2. **Branch-registry в `breakdown.py`** — `WORK_TEMPLATES` зарегистрировать как ветку `monolit` (поведение бит-идентично). Не-бетонные шаблоны = порт `templates.mjs` (S1–S10) → KB `B5_tech_cards/technological_postupy/` (YAML).
3. **Catalog-binding adapter** (новый Python-модуль) — обёртка над `find_otskp_code`/`find_urs_code` **без изменения их сигнатур** (MCP-совместимость), нормализует в status-enum, выбирает каталог по режиму (`urs_otskp_routing.yaml`). **Закрывает дыру §4.**

**Что НЕЛЬЗЯ дублировать:**
- Не форкать `element_types.yaml` под общестрой — не-бетонные словари в **параллельной** структуре (design.md §4.1).
- Не зеркалить `WORK_TEMPLATES` — регистрировать, не копировать.
- Не плодить новый top-level MCP-tool в первой фазе — adapter **внутренний** (design.md §5.3); если выставлять — синхронизировать ВСЕ 6 счётчиков (`EXPECTED_TOOLS` и др. per `concrete-agent/CLAUDE.md`).
- Pilot-скрипты (RD Jáchymov / HK212) — НЕ тащить как код, только как golden-источник для тестов.

---

## 6. Риски

| Риск | Где | Митигация (по design.md) |
|---|---|---|
| **Регрессия бетон-пути** | `WORK_TEMPLATES` как ветка | golden-тест: выход монолита **бит-идентичен** (design.md §6) |
| **«Sebevědomě-špatně»** сегодня | `breakdown.py:312` fallback в бетонный `default` | scope-router + honest-blank гасит (не-бетон → не в монолит) |
| **Дубль структур** | element_types vs section-словари | параллельная sibling-структура, не форк (§4.1) |
| **Расхождение контрактов** | adapter vs `find_*_code` | adapter только читает выход, сигнатуры не трогает → MCP compat (§5.3) |
| **Язык-портирование** | JS sandbox → Python прод | sandbox = эталон поведения; AC-тесты переносятся как Python-goldens |
| **ÚRS rate-limit/5xx** | живой `find_urs_code` (Perplexity/matcher) | adapter: timeout → `status="not_verified"`, декомпозиция выживает (§7) |

---

## 7. Открытые вопросы к ревью (до имплементации)

1. **Статус design.md** — он в `review`. Имплементировать по нему как есть, или сначала апрув/правки спеки?
2. **Фазовость** — design.md предлагает interiér/PSV как первую ветку. Брать всю UWO или MVP = scope-router + monolit-ветка + одна не-бетонная (S2 koupelna) для доказательства шва?
3. **Дыра ÚRS §4** — закрывать в рамках T1-имплементации (catalog-adapter) или вынести в отдельный таск (связан с T5 «Phase 2 MCP find_urs_code»)?

---

## ГЕЙТ. Имплементацию не начинаю. Жду подтверждения плана отдельной командой.
**При имплементации (после апрува):** обновлю `STATUS §6/§11` (чекбоксы + находки), особенно корректировку ÚRS-биндинга.
