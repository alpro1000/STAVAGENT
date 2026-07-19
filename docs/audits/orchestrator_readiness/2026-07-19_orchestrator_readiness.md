# Аудит готовности к оркестратору (discovery-only)

**Тип:** discovery / audit. Кода не менялось, PR не открывался. Единственный созданный файл — этот отчёт.
**Дата:** 2026-07-19
**Ветка аудита:** `claude/formwork-architecture-audit-r98c31` (tip = `d2eae7d`, дерево чистое на момент старта)
**Задание:** `docs/tasks/…/TASK_Audit_Orchestrator_Readiness.md` (загружено в сессию)

**Ответы Pre-Implementation Interview (§1 задания):**
1. Ветки в полёте — **учтены** (раздел 0.2).
2. Язык отчёта — **русский**.
3. Детерминизм — **гонять локально где можно** (TS-движок через vitest, живой MCP статически + идемпотентно).
4. Живые вызовы MCP — **разрешены идемпотентные** (использованы `find_otskp_code` ×2 и `calculate_concrete_works` ×2).

**Метод.** 5 параллельных read-only под-аудитов по коду + прямое чтение канонических доков и ADR + 4 живых идемпотентных MCP-вызова против прод Cloud Run + 2 локальных прогона golden-набора (`vitest`). Каждое утверждение из документации перепроверено по коду и помечено (раздел 12).

**Ограничения доказательной базы (честно).**
- `test-data/**` и KB JSON/XML закрыты на чтение (`.claude/settings.json`), поэтому по SO-250 я опирался на golden-**тесты** (`.py`/`.ts`), `soul.md` и ADR, а не на сырой корпус.
- Побайтовое сравнение «один вход через UI-путь И MCP-путь» я **не** делал (golden SO-202 гоняет полный orchestrator с другими параметрами, чем мой одиночный MCP-вызов). Что сделано и что нет — в §3.7.
- Живые MCP-вызовы идут в **прод** (каталог OTSKP 2026). Номера в §3.7 — реальные из прода.
- Номера строк указаны там, где их подтвердил под-аудит или прямое чтение; где не уверен — ссылаюсь на файл+символ.

---

## 0. Резюме

### 0.1 Ключевая гипотеза задания — **ПОДТВЕРЖДЕНА с уточнением**

> «Расчётная логика существует в двух независимых реализациях, а оркестрации не существует ни в одной.»

- **Расчёт** — ПОДТВЕРЖДЕНО частично и с важным нюансом: тяжёлый бетонный расчёт (7 движков) и `planPassport` — **НЕ** дублированы, они единый источник в TS-движке, а Python/MCP делегирует по HTTP (`monolit_delegate.py`). Дублирована **классификация прибора** (данные общие через codegen, но **алгоритм** скоринга реализован дважды и расходится) плюс три меньших параллельных расчёта (`calculate_pump`, `get_construction_advisor`, нормализатор имён). См. §3.1.
- **Оркестрация** — ПОДТВЕРЖДЕНО для продуктовой (MCP) поверхности: сквозного детерминированного оркестратора «документ → пасспорт → расчёт → соупис → выход» на MCP-поверхности **нет**. Оркестратор-как-код (`StageGatingOrchestrator`) существует, но за Portal-JWT, вне MCP, bridge-only/deck-only, а половина его конвейера — пустые стадии. Флагманская passport-цепочка оркестратора не имеет вовсе. См. §3.2.

### 0.2 Ветки в полёте (ответ на Q1 интервью)

Открытых PR — **30, все до одного Dependabot** (bump зависимостей: `Monolit-Planner`, `rozpocet-registry`, `URS_MATCHER_SERVICE`, `stavagent-portal`, `concrete-agent`). **Ни один не касается аудируемых подсистем** (оркестратор / MCP / классификатор / пасспорт / онтология / каталоги). ⇒ **выводы аудита держатся против main.**

Отдельно: в репо десятки давно висящих незамёрженных `claude/*` веток (Pattern 12 «ветки живут долго») — среди них по имени релевантны `claude/adk-spike-orchestrator`, `claude/audit-mcp-server-lAbOS`, `claude/calc-output-provenance-7k2p9`, `claude/atomizer-localize`. Это **не** открытые PR и не на main; как расхождения к сверке их не считаю, фиксирую как контекст (ADK-оркестратор существует лишь как spike-ветка, не в проде).

### 0.3 Вердикты по §3 (сводка)

| § | Тема | Вердикт |
|---|---|---|
| 3.1 | Дублирование расчёта | **ЧАСТИЧНО** — тяжёлый расчёт делегирован (единый источник); классификация + 3 мелких пути дублированы |
| 3.2 | Оркестрация | **НЕТ** (на MCP-поверхности); ЧАСТИЧНО в коде (за Portal-JWT, bridge/deck-only) |
| 3.3 | MCP поверхность | **есть, с дефектами** — 22 тула, счётчики в 6–7 файлах, redundancy, MCP только в Core |
| 3.4 | Замороженные факты (чтение≠решение) | **ЧАСТИЧНО** — понятие есть, но 5 разных кэшей, 1 со staleness-guard, эфемерный диск на Cloud Run |
| 3.5 | Смешение декомпозиции и привязки | **НЕТ смешения** (разделено, Pattern 15); но детерминированный Bind-адаптер **не построен** |
| 3.6 | Коллизия имён онтологии | **ДА, 3 оси** — репо само это опознало и частично починило (ADR-009) |
| 3.7 | Детерминизм | **ЧАСТИЧНО** — движок детерминирован (числа ниже), но LLM-шов включён по умолчанию на Cloud Run; нет result-id |
| 3.8 | Выходные формы | XLSX(KROS)+JSON в проде; **нет BC3/GAEB**; audit-trail в строке есть, `vypocet_kroky` нет |
| 3.9 | Маршрутизация каталогов | **ЧАСТИЧНО** — правило захардкожено, YAML не читается, `design_build` схлопнут в `urs` |
| 3.10 | Нормативы в коде | **есть нарушения** — ключевые калибровки STAVAGENT = голые константы (список в §3.10) |
| 3.11 | Измеримость стоимости расчёта | **ЧАСТИЧНО** — кредиты MCP логируются; реальный расход токенов не логируется (оценка `len//4`) |

---

## 3.1 Дублирование расчёта

**Вывод: ЧАСТИЧНО.** Тяжёлый расчёт единый; классификация и три мелких пути — реально дублированы.

### AC1 — таблица «движок → реализации → расхождения»

| Движок / расчёт | Реализация(и) | В проде | Расхождение |
|---|---|---|---|
| Formwork (DIN 18218), Rebar-lite, Pour-decision, Maturity (Saul), Scheduler (RCPSP), PERT, Pump-в-плане | **TS единственный** `Monolit-Planner/shared/src/calculators/*`. MCP `calculate_concrete_works`/`calculate_from_passport` **делегируют** по HTTP | да | **Нет** дубля. `monolit_delegate.py:25-27`: «NEVER fall back to a divergent Python calculation». `calculator.py:8-9,880`, `passport_plan.py:118-127` |
| **Классификация прибора** | ДАННЫЕ едины: `element_rules/element_types.yaml` → `gen-knowledge.mjs:97-105` → `kb-generated/element-classification-rules.ts` (drift-guard CI `monolit-planner-ci.yml:52`). **АЛГОРИТМ дважды**: TS `element-classifier.ts:959-1013` vs Python `classifier.py:341,355-360` (Python читает тот же YAML напрямую `classifier.py:259-262`) | да, оба | **ДА.** (а) порог неоднозначности: TS — near-tie ≤3 очка; Python — только точное равенство очков. (б) confidence: TS — градуированная формула `min(0.9,0.6+score·0.04)`; Python — плоские `0.9/0.7`. Один и тот же вход даёт разные confidence и разный вердикт «ambiguous?» |
| Head-noun нормализатор имени | Python `element_name_normalizer.py` vs TS `element-name-normalizer.ts` (два ручных порта) | да, оба | **ДА, намеренное.** `element_name_normalizer.py:159-161`: `pilíř`→pier безусловно. `element-name-normalizer.ts:93-101`: явный отказ портировать это правило. «Beton pilířů» без контекста → **pier** (Python) vs **sloup** (TS). Задокументировано, но это стоящее расхождение |
| **Pump** (`calculate_pump`) | Python пере-реализация `calculator.py:931-1157` (`PUMP_COEFFICIENTS`, напр. `cerpadlo_sh_per_m3: 0.07510`) **параллельно** TS `pump-engine.ts` | да, оба | **ДА.** Не делегирует. Разные модели ценообразования; общего источника/drift-guard нет |
| Тактность + боковое давление в **советнике** | `advisor.py:105-115` считает `num_tacts=ceil(h/3.0)`, `pressure=2500·9.81·min(h,3)/1000` инлайн, экипаж захардкожен `4/3/5/12` | да | **ДА.** Третий независимый путь тактов+DIN 18218; может противоречить движку |
| Person-hours / harmonogram (историческое) | Ранее считалось независимо в калькуляторе и планировщике (326.7 д vs 622.8 д) → сведено в `labor-projection.ts` (v4.35) | сведено | Закрыто, но это подтверждённый прецедент «одно число — два пути» в этой кодовой базе |

**Итог:** гипотеза «расчёт в двух реализациях» верна для **классификации** и трёх мелких путей; для **тяжёлого расчёта** — опровергнута (единый источник + делегирование, это правильный SSOT-паттерн).

---

## 3.2 Существует ли оркестрация

**Вывод: НЕТ на продуктовой (MCP) поверхности. ЧАСТИЧНО в коде — но невидимо MCP-клиентам, bridge/deck-only, половина стадий пуста.**

- **Оркестратор-как-код существует, но за Portal-JWT и вне MCP.** `StageGatingOrchestrator` → `routes_orchestrator.py:137` `@router.post("/orchestrate")`, смонтирован `/api/v1/orchestrate`, гейт `require_principal` (Portal JWT). Его **нет** в `TOOL_ORDER`/`EXPECTED_TOOLS` ⇒ коннекторы, через которые продукт продаётся (Claude.ai, ChatGPT GPT Actions), до него дотянуться не могут — им доступны только 22 отдельных тула. Для MCP-вызывающего «оркестрации нет» — фактически верно.
- **Единственный живой рецепт — bridge-only и deck-only.** `recipe_runner.py:361-365` хардкодит `project_type="most"`; `:378-391` — в калькулятор попадает только `mostovkova_deska`, все прочие элементы `calculate_concrete_works` пропускают. Демо-конвейер, не общий.
- **Половина объявленного стейт-машины — пустые стадии.** `workflow_definitions.yaml:61-66`: `PRICING/REVIEW/COMMIT_PENDING` → `tools: []`. Дефолтный прод-раннер (`orchestrator.py:394-427`, `make_checkpoint_tool_runner`) диспетчит `{"checkpoint": True}` и переходит дальше, ничего не вызывая.
- **Флагманская passport-цепочка оркестратора не имеет вовсе.** `build_bridge_passport` (`passport_build.py:82-158`) собирает extract+parse+assemble, но **останавливается на пасспорте — не считает**. `calculate_from_passport` считает, но не экспортирует. `export_soupis` рендерит. Ни один из трёх не используется `recipe_runner`. Каллер обязан сам вызвать `build_bridge_passport` → `calculate_from_passport` → `export_soupis` как ≥3 отдельных MCP-вызова, вручную перекидывая dict'ы. Это ровно «цепочка руками».
- **Состояние реального (мульти-МБ) соуписа передаётся непрозрачным хэндлом**, не оркестрируемым run-объектом: `passport_build.py:94-122`, `soupis-{hex32}`.
- **«Join saga» (v4.42) — это чистый parser-join, не сага.** `soupis_quantity_join.py:1-9`: «does no I/O and imports nothing from the recipe». Функция суммирования по ключу, без сессии/стейт-машины/run-id.
- **Расчётная стадия физически в другом сервисе, вызывается по HTTP из тула.** `monolit_delegate.py:44-46` POST на `monolit-planner-api…run.app`. Скрытая распределённая зависимость с ретраями/таймаутами внутри MCP-тула.

**Что заявлено vs что есть (ADR-009 сам это фиксирует).** Объявлен «6-стадийный хребет» document→worklist (D1): Extract→Structure→Quantify→Decompose→Bind→Plan с зрелостью A/B/C/D. Стадия 5 **Bind (детерминированный UWO-адаптер) — не построена** (маркер B, «UWO-keyed adapter not built»). Worklist-аудит, цитируемый в ADR-009 §Context, называет **«четыре несвязанных реализации `seznam prací`»** — это независимо подтверждает три-четыре параллельных пути (recipe_runner / passport-цепочка / UEP), найденных по коду.

**Интент.** `docs/STAVAGENT_Agent_First_Architecture_Vision.md` §2.1/§3.2 (принцип 5): оркестрация **намеренно** отдана LLM-агенту ADK, «No business logic в agent code… Никаких if/else workflows hardcoded. LLM-driven planning». Т.е. композиция стадий проектируется **недетерминированной** — это в прямом напряжении с «детерминированный конвейер + replay». Панель audit-trail в том же документе помечена как ещё не построенная («Не отображается в UI»).

---

## 3.3 Поверхность MCP

**Вывод: поверхность есть (22 тула), но с дефектами связности и дублированием; MCP существует ТОЛЬКО в Core.**

- **22 тула, по группам** (из `EXPECTED_TOOLS` `tests/test_mcp_compatibility.py:59` + `TOOL_ORDER` `routes.py:1257`):
  - детерминированный lookup: `find_otskp_code`, `find_urs_code`, `classify_construction_element`, `detect_object_type`, `search_czech_construction_norms`;
  - HTTP-делегаты во внешний Monolit: `calculate_concrete_works`, `calculate_from_passport`;
  - парсеры/ingestion: `parse_construction_budget`, `analyze_construction_document`, `extract_tz_fields`;
  - внутренние композиты: `create_work_breakdown`, `build_bridge_passport`, `get_construction_advisor`, `export_soupis`, `calculate_pump`, `validate_drawing_element`;
  - семейство `uep_*` (6): `uep_run_extraction` + 5 бесплатных read-only инспекторов.
- **Побочные эффекты / межвызовная память.** Чистые (без стейта): `find_otskp_code`, `classify_construction_element`, `detect_object_type`, `calculate_*` (делегаты). С эффектами/персистом: `build_bridge_passport` (+`soupis`-хэндлы, passport-store), `parse_construction_budget`/`analyze_construction_document` (пишут в project cache), любой тул списывает кредиты (`mcp_credit_log`). **Понятие сессии есть только у `StageGatingOrchestrator`** (Postgres-сессии + append-only audit + HITL) — но он **вне MCP** (§3.2). Отдельный ответ на §3.3: **межвызовной памяти на самой MCP-поверхности нет**, кроме непрозрачных хэндлов (`soupis-{hex32}`) и project-cache-по-`project_id`, которые каллер должен продевать вручную.
- **Связность счётчиков — реальна (6, фактически 7).** Новый тул требует синхронных правок: `_REGISTERED_TOOL_NAMES` (`server.py:198`), `TOOL_ORDER`+`TOOL_DESCRIPTIONS` (`routes.py:1257/1145`), `TOOL_COSTS` (`auth.py:41`), `TOOL_MANIFESTS` (`tool_manifest.py:73`), `workflow_definitions.yaml:29`, `EXPECTED_TOOLS` (`test_mcp_compatibility.py:59`) + 7-й, enforced на старте: `server.py:223` `validate_registry(...)` (сервер не грузится при дрифте). **Стоимость кредита продублирована трижды**: `auth.py:50` (=15) vs `tool_manifest.py:170` (=15) vs `uep.py:31` (`UEP_RUN_EXTRACTION_CREDITS=15`).
- **Дублирование/redundancy.** Ingestion 4-кратно: `parse_construction_budget`, `analyze_construction_document`, `uep_run_extraction`, и внутренний вызов `parse_construction_budget` из `build_bridge_passport` (`passport_build.py:124-128`). Два генератора worklist: `create_work_breakdown` (`WORK_TEMPLATES`, `breakdown.py:30`) vs passport element map. Два расчётных повода: `calculate_concrete_works` (1 элемент) vs `calculate_from_passport` (N).
- **`uep_*` — реальная, но осиротевшая подсистема.** `app/services/uep/` содержит `dxf_extractor`, `dwg_extractor`, `gbxml_extractor`, `ifc_diff_engine`, `coverage_engine`, `reconciliation_engine`, `derivation_registry`, `passport_adapter` — не заглушки. Но тулы **stage-gating-exempt** (`server.py:184-196`) — вне стейт-машины document→export. Третий параллельный ingestion, не интегрированный ни в один оркестрационный путь.
- **Биллинг течёт в дизайн тулов.** Комментарии `auth.py:49`: read-only инспекторы `uep_get_*` вынесены в отдельные бесплатные тулы, «cost gate guards batch extraction, not config lookups» — гранулярность тулов формируется кредитной сеткой.
- **MCP существует ТОЛЬКО в Core** (моя проверка): 0 совпадений `FastMCP`/`mcp.tool` в `Monolit-Planner`, `rozpocet-registry(-backend)`, `URS_MATCHER_SERVICE`, `stavagent-portal`. «Aggregated MCP surface» из Vision (Registry-тулы, Classifier-тулы, Output/HITL MCP) **не построена**; все 22 тула — в Core, а связка Monolit↔Registry, объявленная «решённой оркестрацией без программной связки», по факту — **захардкоженный HTTP-делегат** внутри MCP-тула.

---

## 3.4 Разделение чтения и решения (замороженные факты)

**Вывод: ЧАСТИЧНО.** Понятие «замороженный факт с источником/уверенностью» есть, но реализовано как 5 разных кэшей с разными жизненными циклами; единой инвалидации нет; на Cloud Run бэкинг эфемерный.

Пять независимых хранилищ «замороженных фактов»:

| Хранилище | Бэкинг | TTL | Version-guard | Кросс-инстанс |
|---|---|---|---|---|
| `_PROJECT_FACTS` + `calculator_facts` | память + локальный JSON | нет | нет | **нет** |
| `passport_store` | память + локальный JSON | нет | нет | **нет** |
| `bridge_passport_store` | память + локальный JSON | нет | нет | **нет** |
| `mcp_soupis_handles` | Postgres | 24 ч | `PARSE_VERSION` | да |
| `project_cache.py` | локальный диск | нет | нет | **нет** |

- **Единая ли схема для MCP и UI?** По сути **нет единого «набора фактов»** — есть разные носители: пасспорт (`BridgePassport`, валидируется по схеме на запись/чтение: `bridge_passport_store.py:55/82`), calculator_facts (список dict), soupis-хэндл (компактный parsed_budget). Валидируется **форма**, но никогда **свежесть**.
- **Только 1 из 5 имеет staleness-guard.** `soupis_handles.py:171-174` возвращает `{"stale": True}` при несовпадении `parse_version` (`budget.py:24` `PARSE_VERSION=3`), потребляется как typed `soupis_ref_stale` (`passport_build.py:108-117`). Но это **вручную инкрементируемое целое, не контент-хэш**: изменение парсера, меняющее *значения* без bump — снова тот самый живой баг (24 ч старых чисел), под который guard и писали.
- **`_PROJECT_FACTS`: запись на диск — fire-and-forget, без версии.** `calculator_suggestions.py:600-603` глотает ошибку записи на уровне `logger.debug`; ре-экстракция перезаписывает без ordering-guard; факты текут в советы калькулятора (`get_calculator_suggestions:650`). Память может держать факты, которых нет на диске.
- **«disk is source of truth» ложно на фличе Cloud Run.** `config.py:380-383` — `data/projects/...` на локальном эфемерном диске контейнера; `cloudbuild-concrete.yaml` `--min-instances=1` **без** `--max-instances` и без volume-mount. Один тёплый инстанс держит факты в пределах своей жизни; при scale-out инстанс B не видит записанное инстансом A → `get()` вернёт пусто (это подтверждает и `concrete-agent/CLAUDE.md`: project cache в `data/projects/{id}/`).
- **Единой инвалидации нет:** 5 кэшей, 5 жизненных циклов, один со staleness-детекцией. Пасспорты/`calculator_facts` без TTL и версии «выглядят валидными» до явного `delete()`.

---

## 3.5 Смешение декомпозиции и привязки каталога

**Вывод: смешения НЕТ** (разделено по Pattern 15). Но детерминированный Bind-адаптер, ради которого разделение делалось, **не построен** — сегодня Bind фактически фаззи.

- **Разделение реально и enforced гейтом `mode`.** `breakdown.py:387-388,584-591`: `work_first` (DEFAULT) даёт «frozen, code-less, price-less» список; привязка кода — отдельная стадия `work_with_catalog`. Декомпозиция несёт `vocabulary_code` (внутренняя онтология, `breakdown.py:22-28`), **не** каталожный код.
- **`CodeStatus` унифицировал двух producer'ов.** `item_schemas.py:35-63`; `catalog_binding_adapter.py:51-56` и `breakdown.py:500/504` (`# F3: was "no_match"`) эмитят из одного словаря. Старые `bound|no_match` vs `candidate|not_verified` схлопнуты.
- **Но есть намеренно НЕслитая параллельная ось.** `item_schemas.py:54-56` (docstring): `position_enricher`'s `match` (`exact|partial|none` — качество совпадения, не статус привязки) «intentionally NOT merged here; converging it is a follow-up». Подтверждено `position_enricher.py:156-218`. Две параллельные оси статуса живут по дизайну; читатель обязан знать, какой пайплайн породил строку.
- **Интент против реальности (ADR-009 D2).** Декомпозиция должна эмитить `uwo_code` из контролируемого словаря (~50–100), а Bind — быть **детерминированным адаптером** `uwo_code+params → catalog code`. Сегодня Bind — «честная фаззи-цепочка» (`catalog_matching.py`+`find_*_code`), UWO-keyed адаптер не построен. Класс бага, который это чинит (ADR-009 D2): `dohloubka patek` ∩ `Bednění základů patek` = {patek} → старый путь привязывает **FORMWORK** к строке **EXCAVATION**.

---

## 3.6 Коллизия в наименовании онтологии работ

**Вывод: ДА — три оси с близкими именами. Репо само это опознало и частично починило (ADR-009, ратифицирован 2026-07-14).**

`ADR-009_document_to_worklist_spine_and_uwo_canon.md` прямо называет «"WorkOntology" name-collision … worn by **three unrelated concerns**» и фиксирует **три оси (D3)**:

| Ось | Концерн | Каноничный носитель | Статус |
|---|---|---|---|
| **A — Vocabulary + Adapters (UWO)** | каталого-агностичный словарь работ `DOMAIN.CATEGORY…` + per-market адаптеры | `docs/specs/universal-work-decomposer/` | Accepted |
| **B — document-to-worklist (Orchestrator Workflow, 6 стадий)** | сам конвейер, «frozen Stage-1 work list», replay | `docs/specs/document-to-worklist/SPEC.md` | **жив, НЕ сделан** |
| **C — Element typing (head-noun)** | `dřík ≠ pilíř`, status/grounding | `element_types.yaml` + `element-name-normalizer.ts` | **отгружен** (v4.34), это компонент стадий 2/4 |

**Сколько их «в коде» на самом деле** (близко-именованные сущности, найдены по коду):
- `scope_router.py` («Scope-Router, UWO Stage 1, upstream») — маршрут scope-текста → `section_code` (`monolit|interier_psv|None`, honest_blank);
- `uwo_vocabulary.py` + `uwo_vocabulary.yaml` (ось A, словарь);
- `catalog_binding_adapter.py` (адаптер привязки, ось A/стадия 5);
- `element-name-normalizer.ts` / `element_name_normalizer.py` (ось C);
- `workflow_definitions.yaml` + `StageGatingOrchestrator` + `recipe_runner.py` (ось B);
- `docs/specs/universal-work-decomposer/` (ось A spec) и `docs/specs/document-to-worklist/SPEC.md` (ось B canon).

**Task-файл онтологии SO-250 — прямой ответ на §3.6 (репо само пометило).** Файл `docs/tasks/TASK_ElementTyping_HeadNoun_SO250_acceptance.md` в шапке (стр. 3-11): «Přejmenováno 2026-07-14 per ADR-009 (a). Původní jméno `TASK_Orchestrator_WorkOntology_SO250.md` neslo **axis-B (workflow) jméno nad axis-C obsahem**». То есть по **имени** он был axis-B (оркестратор-workflow), по **содержанию** — axis-C (head-noun typing, критерии #63–70). ADR-009 D4 фиксирует ренейм (option a, контент нетронут). Родственные существующие файлы: `TASK_W3_NormalizeElementName_SO250.md` (ось C, «Žádný jazykový model; funkce je deterministická kvůli přehrávání») и `TASK_Orchestrator_WorkOntology_SO202_Bridge.md` (ось B, SO-202). Файла `TASK_Orchestrator_WorkOntology_SO250.md` больше **нет** (переименован).

*(По §3.6 задание оставляет решение за Александром; агент лишь предъявляет факты. Никакой рекомендации «какую ось выбрать» здесь нет.)*

**Дополнительно — коллизия значений онтологии (не только имён), 7 ручных таблиц маппинга** (места, где возможен дрифт):

| # | Таблица | Файл | Ось | Ведение |
|---|---|---|---|---|
| 1 | `passport_element_map.yaml elements` (9 ключей → 8 engine-типов) | `element_rules/passport_element_map.yaml:25-57` | B→A | руками |
| 2 | `_inverse_map()` A→B (first-declared-wins) | `bridge_passport_element_map.py:48-66` | A→B | производная от #1 |
| 3 | `type_core.w3_name` (engine-fine → W3-имя) | `element_types.yaml:45-85` | A→C | руками |
| 4 | `w3_family` (W3-coarse → parity family) | `element_types.yaml:93-115` | C→family | руками, инвариант `family==w3_family[w3_name[t]]` |
| 5 | `bridge_remap` (building→bridge) | `element_types.yaml:119-126` | A→A | руками |
| 6 | `_MCP_TO_ENGINE_TYPE` (W3-runtime → engine) | `calculator.py:33-39` | C→A | руками; **конфликт**: `zaklady→zakladovy_pas** |
| 7 | `ELEMENT_TYPES` (W3-runtime каталог, 26 ключей) | `classifier.py:27-243` | C runtime vocab | руками, параллельно ключам YAML |

Конкретные коллизии-тройки (то же физическое понятие названо до трёх раз, а иногда системы расходятся по цели):
- **Подпорная стена:** engine `operne_zdi` / W3 `operna_zed` / **нет ключа в пасспорте**.
- **Основание опоры:** пасспорт различает `foundations_abutments`→`zaklady_oper` и `foundations_piers`→`zaklady_piliru`, а классификатор **не может** — `element_types.yaml:48` `zaklady_oper → w3_name: zaklady_piliru` (слияние).
- **«Základ» разрешается в ТРИ разных engine-типа по пути:** passport-путь → `zaklady_piliru`; classify-путь (SO-250) → `zaklady_piliru` (`test_mcp_golden_so250.py:103`); delegate-путь → `zakladovy_pas` (`calculator.py:37`). Живое несведённое расхождение цели между таблицами #6 и classify.
- W3-only типы без engine-эквивалента: `izolacni_stena, sachta, tunel_rampa, zdivo_obklad, gabionova_zed`.

---

## 3.7 Детерминизм

**Вывод: ЧАСТИЧНО.** Расчётный движок детерминирован run-to-run (числа ниже, побайтово совпали); но недетерминизм на MCP-поверхности возможен через LLM-шов, включённый по умолчанию на Cloud Run, и через wall-clock в тарифах; result-id не существует вовсе.

### AC4 — фактические числа двух прогонов

**MCP-путь, `find_otskp_code(query="beton mostních pilířů C35/45", max_results=3)` — прогон 1 vs прогон 2: ПОБАЙТОВО ИДЕНТИЧНО.**
- коды: `334314 / 334323 / 334324` (оба раза, тот же порядок);
- `unit_price_czk`: `12973.47 / 12039.39 / 12362.76` (оба раза);
- `confidence`: `0.71`; `ranking_audit.output_codes` идентичны;
- **result-id / timestamp в ответе отсутствуют** → сравнивать «идентификатор результата» не с чем: его нет.

**MCP-путь, `calculate_concrete_works(mostovkova_deska, V=693.35, C35/45, XF2, curing=4, span=20, spans=6, h=1.2)` — прогон 1 vs 2: ПОБАЙТОВО ИДЕНТИЧНО.**
- `costs.total_labor_czk = 962385.19`; `formwork_labor_czk = 477806.27`;
- `schedule.total_days = 90.5`; `pour_decision.tact_volume_m3 = 115.56`; `rebar.mass_kg = 17334`;
- `mss_cost.total_czk = 11910000`;
- result-id / timestamp отсутствуют; `source: "monolit_planner_api"` (делегат подтверждён живьём).

**UI-путь (локальный TS-движок), `vitest golden-so202.test.ts` — прогон 1 vs 2: 16/16 pass оба раза, идентично** (RUN1 548 мс / RUN2 127 мс — отличается лишь время, оно не входит в вывод; закреплённые числа воспроизведены дважды).

**Что НЕ сделано (честно):** побайтовое сравнение «тот же вход через UI-путь И MCP-путь одновременно» — golden гоняет полный orchestrator SO-202 с иными параметрами, чем мой одиночный MCP-вызов. Архитектурно UI-путь и MCP-путь — **один движок** (MCP делегирует в тот же shared-движок по HTTP, `monolit_delegate.py`), но идентичность именно чисел этих двух путей на одном входе я не мерил.

### Источники недетерминизма (по коду)
- **LLM-шов в `extract_tz_fields` включён по умолчанию на Cloud Run.** `extract_tz_fields.py:169-178`: выключен только если `TZ_LLM_FALLBACK∈{0,false,off}`; иначе активен при `TZ_LLM_FALLBACK∈{1,true}` **ИЛИ при заданном `K_SERVICE`** (т.е. на Cloud Run активен, если явно не убит). Стреляет лишь когда детерминированный парс дал ноль элементов, видит только секцию материалов, ставит conf 0.7 (`:499,514-515`) — выше не перезаписывает, но это **живой недетерминированный путь**, питающий passport-конвейер, и он **намеренно исключён из goldens** (`:216-218` monkeypatch на None) — его воспроизводимость не тестируется.
- **PERT Monte Carlo сидирован в прод-пути.** `pert.ts:166` `seed!==undefined ? seededRng(seed) : Math.random`; orchestrator подаёт `seed:42` (`planner-orchestrator.ts:2351`). Воспроизводимо; `Math.random` достижим только прямым несидированным каллером.
- **Float/`Math.round` дрифт** пропатчен допуском, не точной арифметикой: `element-scheduler.ts:647-657` `Math.abs(nodeLS-es) < 0.5`. Стабильно в пределах прогона; чувствительно к кросс-рантайм/рефактору (для того и goldens).
- **Wall-clock в выборе тарифа.** `tariff-versioning.ts:240` `new Date()` (дефолт-на-сегодня, если дата явно не передана) — легитимная оговорка replay для стоимости на date-версионном тарифе. Мой calculate-вызов этот путь не задел (зарплата фикс 398 Kč/ч), но decision_log показал `Season not specified — defaulting to "podzim_jaro"` — сезон дефолтится фиксированно (не wall-clock), однако date-версионные тарифы дадут run-to-run расхождение стоимости.
- **Нет result-id / контент-адресации.** Ни один из двух живых ответов не несёт id/timestamp — «совпадает ли идентификатор результата» неприменимо, id отсутствует как концепт (связано с «нет run-объекта» в §3.2).

### Наблюдённая live-когерентность (факт, не баг к починке)
В ответе `calculate_concrete_works` одновременно: `bridge_technology.recommended = "mss"` (135 дней, 11.91 M Kč) **и** `schedule.total_days = 90.5` — обычный путь (Top 50 + стойки), `costs.is_mss_path = false`. Т.е. **рекомендация ≠ посчитанный план**: советует MSS, а сметный/графиковый результат — конвенциональный. Плюс `resource_ceiling` (kb_default: 21 чел, 2 насоса) не совпадает с посчитанным планом (5 чел на бетон, 1 насос). Зафиксировано как наблюдение.

---

## 3.8 Выходные формы

**Вывод: XLSX (KROS) + JSON в проде; UNIXML — только в пилотном скрипте; BC3/GAEB/x83/ÖNORM — НЕТ. Audit-trail в строке реален, но без `vypocet_kroky`. Схема выхода — в одном месте (Core).**

- **Форматы в проде:** XLSX (KROS-совместимый) — основной/единственный machine-deliverable, `export_soupis` (`export.py:118-215`) → `soupis_exporter.py:104`; колонки `soupis_exporter.py:37-48`: `P.č. | Typ | Kód | Popis | MJ | Množství | VV vzorec | Cen. soustava | Zdroj | Důvěra`. JSON — ответы MCP-тулов.
- **UNIXML (KROS XML)** — только в пилотном скрипте `test-data/most-2062-1-zihle/build_master_soupis.py:455-534`, **не** в проде (прод `kros_parser.py` только читает).
- **BC3 / GAEB / .x83 / ÖNORM — отсутствуют в коде.** Все совпадения `bc3`/`gaeb` — в стратегических доках (`product.md`, `STAVAGENT_DACH_Addendum.md`) и ложные (`proj_dbc3…`). Интерчейндж-форматы, которые эмитят конкуренты DACH/Испании, — roadmap в доках, не в коде.
- **Audit-trail в строке — реален (не только пилот).** `breakdown.py:184-185,977-990` эмитит per item `quantity_formula`, `quantity_status`, `classification_confidence`, `calc_status` (+ `vstupy` в тексте формулы `:766,:788`); `export.py:88-100` мапит их в видимые колонки KROS-XLSX (`VV vzorec ← quantity_formula`, `Důvěra ← classification_confidence`, `Zdroj ← calc-status-aware label`, непосчитанное → `… · NEPOČÍTÁNO`). Схема кодифицирована: `item_schemas.py` (`CodeStatus`, `ItemQuantityStatus`, `vv_lines:207`), `bridge_passport.py QuantityItem.source:64`.
- **Три разрыва:** (1) отдельного поля `vypocet_kroky` (пошагово) в machine-выходе **нет** — только строка-формула + статус; богатый `calc`-блок остаётся в метаданных ответа, намеренно вне KROS-листа (`export.py:182-200`). (2) «100% audit-trail coverage» с `vypocet_kroky` — свойство **пилотных** `items.json`, не формы MCP-выхода. (3) нет commodity-интерчейнджа (BC3/GAEB).
- **Дублирования схемы фронт↔ядро нет:** схема выхода определена в Core (`item_schemas.py`/`bridge_passport.py`/`soupis_exporter.py`).

---

## 3.9 Маршрутизация каталогов

**Вывод: ЧАСТИЧНО.** Content-роутера OTSKP↔URS нет; правило «публичная→OTSKP, частная→URS, D&B→оба» существует в каноничном YAML, **который код не читает**; ветка `design_build` схлопнута в `urs`. Правило bundling каталого-зависимое (это плюс).

- **Content-роутера нет.** OTSKP vs URS выбирается (а) тем, какой тул зовёт каллер (эвристика только в docstring: `otskp.py:184` «For transport structures… find_otskp_code», `urs.py:35` «For building… find_urs_code»), либо (б) явным параметром `catalog` у `create_work_breakdown` (`breakdown.py:514`, default `"otskp"`). `find_otskp_code` — детерминированный DB + fulltext (exact→conf 1.0 `otskp.py:218`, keyword ≤0.9); `find_urs_code` — Perplexity web (flat 0.80, `urs.py:170`) + удалённый HTTP URS-Matcher (`:207-255`), ÚRS никогда не `exact`.
- **Правило procurement-mode дублировано и частично не реализовано.** Каноничный `kb/urs_otskp_routing.yaml:23-46` описывает `verejna→OTSKP`, `privatni→URS`, `design_build→URS+OTSKP`. Но `catalog_binding_adapter.py:63-64` **хардкодит** правило (`return "otskp" if procurement_mode=="verejna" else "urs"`) и YAML **не загружается** (grep по `urs_otskp_routing` даёт только комментарий). Ветка `design_build` (две колонки) в `_primary_catalog` **отсутствует** — схлопывается в `urs`. Плюс `breakdown.py:430` на ÚRS-пути хардкодит `procurement_mode="privatni"`, перекрывая режим проекта.
- **Двойной каталог (URS201801 39 741 + KROS TSKP 11 994) и 4-стадийный TSKP-фаззи — не в проде.** Все следы — под `test-data/`/KB-доках (`…/rd_jachymov/patterns/05_*.md:32`). Прод-ÚRS идёт через удалённый HTTP-матчер (`urs.py:212`)+Perplexity; 4-стадийный алгоритм — backlog (`test-data/most-2062-1-zihle/backlog/otskp_search_algorithm.md:13-16`).
- **Отдельный роутинг-слой существует выше:** `scope_router.py` (UWO Stage 1) маршрутизирует scope-текст → `monolit | interier_psv | None` (honest_blank; каллер не должен падать в monolit по умолчанию) — но это скоуп-ветвление, не выбор каталога.

---

## 3.10 Нормативные значения в коде

**Вывод: есть нарушения собственного правила репо.** `structure.md §5` и §2.2 запрещают «hardcoded norma v kiosk/engine kódu — patří do kb/*.yaml». Провенанс непоследователен: три паттерна, и **ключевые калибровки STAVAGENT — голые константы** (только комментарий, без machine-source).

### AC5 — норм-константы, зашитые без machine-readable источника

| Значение | Место | Ссылка на норму |
|---|---|---|
| `REBAR_RATES_MATRIX` (напр. `walls {12:17.3, …}` ч/т) | `element-classifier.ts:1828-1845` | только блок-комментарий `:1808-1814` (methvin.co/RSMeans/IJERT); **нет** поля `source` |
| `PILE_PRODUCTIVITY_TABLE` (пилот/смена по Ø×грунт×метод) | `pile-engine.ts:187-212` | комментарий «TZ + ČSN 73 1002»; поля source нет |
| `computePourCrew` пороги `<20/<50/<80` + коэф. `pumps·2 / ceil(1.5n) / ceil(1.0n)` | `planner-orchestrator.ts:898-945` | ČSN 73 0212 только в комментарии `:936` |
| `FCK`, `STRIP_STRENGTH_PCT` (Record) | `maturity.ts:137-149` | норм-производные, но как данные не атрибутированы |
| `rental_czk_m2_month: 420.00` (и др. per-entry) | `kb/formwork_catalog_non_doka.yaml:35` | `source_citation` **только на уровне файла** (`:14`), не на запись |
| `num_tacts=ceil(h/3.0)`, `pressure=2500·9.81·min(h,3)/1000`, экипаж `4/3/5/12` | `advisor.py:105-124` (Python MCP-тул) | инлайн, без источника |
| `PUMP_COEFFICIENTS` (напр. `cerpadlo_sh_per_m3: 0.07510`) | `calculator.py:931-1157` | инлайн Python, «mirrors TOV widget», без source-поля |

### Контр-примеры (провенанс есть — паттерн, который стоит знать)
- `labor-norms.ts:23-27,61-64` — **per-record `source`** (`armovani 18 = SOURCE_ALEXANDER`, `betonaz_crew_model = Caltrans T1.1`). Единственный файл с машиночитаемым провенансом на запись.
- `kb/tkp18_maturity.yaml:9-16`, `kb/lateral_pressure.yaml:16-29`, `kb/doka_frami_catalog.yaml` — **file-level `source_citation`** (ČSN EN 13670 / ČSN EN 12812 / каталоги), codegen'ятся в TS с drift-guard.

**Итог:** ~половина норм-поверхности — данные-с-источником (KB YAML file-level или `labor-norms` per-record), ~половина — голые константы с провенансом только в комментарии; и именно **специфические для STAVAGENT калибровки** (rebar-матрица, пилот-productivity, pour-crew-формула, advisor) — наименее атрибутированы. Нормы **разбросаны** по многим TS-файлам + Python-тулам, не в одном KB.

---

## 3.11 Измеримость стоимости расчёта

**Вывод: ЧАСТИЧНО.** Измеримы **бизнес-кредиты** на MCP-тул (логируются в Postgres). **Реальный расход внешних моделей** (токены/USD) на один расчёт **не измеряется**: он либо оценивается грубо (`len//4`), либо не логируется, и агрегирующего sink'а нет.

- **Что логируется:** `auth.py:1194` `INSERT INTO mcp_credit_log …` — списание **кредитов** (фикс 0–20 на тул) на каждый MCP-вызов, в Cloud SQL. Это единственный персистируемый per-call учёт «стоимости».
- **Что НЕ логируется:** реальные токены LLM. `bedrock_client.py:378-382` возвращает `tokens` в ответе (читается, не персистится). `orchestrator.py:646/666` считает `tokens_used = len(content)//4` — **эвристическая оценка**, не реальный счётчик, суммируется в памяти (`:311/453`) и не сохраняется. У `gemini_client.py` извлечения `usage_metadata` не нашёл. Нет sink'а `tokens_used/cost_usd/spend` (grep пуст, кроме rate_limiter debug-лога и OAuth).
- **Смещение по путям:** расчётный путь (`calculate_*`) делегирует в Monolit HTTP и **LLM не зовёт** вообще — стоимость там нулевая по внешним моделям. LLM-стоимость сидит в extract/multi-role путях, которые токены не персистят. ⇒ «сколько стоит один расчёт в терминах обращений к внешним моделям» сегодня по логам **не восстановить**; можно узнать лишь сколько кредитов списал тул.
- **Что мешает:** нет единого учёта токенов на вызов (клиенты возвращают usage, но никто не пишет его в БД/лог с привязкой к run/tool); в multi-role оркестраторе вместо реального usage — оценка `len//4`.

### Побочно — измеримость строительной стоимости (CZK)
CZK-стоимость **структурно прослеживаема**: `formulas.ts:47-70` (`unit_cost_on_m3 = cost_czk/concrete_m3`, `kros_unit = ceil(x/50)·50`), `cost_czk = labor_hours·wage`, per-field формулы-тултипы (CLAUDE.md rule 3). Но **систематически не валидируется против реальности**: golden'ы **не ассертят ни одной CZK-величины** (только физ-объёмы и Nh-коридоры ±10–15%, напр. `golden-so202.test.ts:137` ассертит лишь `is_mss_path`); прод `reconciliation_engine.py` сверяет **кросс-источниковую экстракцию** (TZ vs DXF vs IFC), не стоимость-vs-эталон; «14/14 exact»/«16 flags» — ручная per-pilot работа в `build_master_soupis.py`, переиспользуемого diff-инструмента «движок vs эталон» в коде нет.

---

## 4. Доменные правила — соблюдаются ли в коде

| Правило (§4 задания) | Вердикт | Доказательство |
|---|---|---|
| Опалубка/распалубка/уход **включены** в позицию бетона в одном каталоге, **расцениваются отдельно** в другом; отдельно всегда только арматура | **ЧАСТИЧНО (каталого-зависимо)** | `CodeStatus.bundled` (v4.39.1, conf 1.0 «bednění/ošetřování в OTSKP-бетоне»); `applyPlanToPositions` сворачивает бедненье в бетон при `formwork_included`, `rebar_included` намеренно **НЕ** сворачивает. Т.е. это признак каталого-зависимой политики, как и требует правило. **Но** сам выбор каталога захардкожен (§3.9), так что «зависимость от каталога» реализована на уровне bundling-флагов, не через живой роутер |
| Тяжёлые и лёгкие подпорные системы **не смешиваются** в одной позиции; поставщики опалубки не смешиваются | **соблюдается** | `FormworkSystemSpec.pour_role` (`formwork|falsework|props|mss_integrated`, v4.21), allow-list `applicable_element_types`, `preferred_manufacturer` пре-фильтр. Живой вызов подтвердил разделение: Top 50 (formwork) + Eurex 20 (props) в отдельных блоках |
| Отсутствие данных → **честный пропуск с причиной**, не ноль и не выдумка | **соблюдается** | `UncalculatedError`/`NEPOČÍTÁNO` (v4.38): rebar=0 честный ноль, volume≤0 → typed 422, MCP пробрасывает `reason_cs`; `scope_router` honest_blank; `find_otskp_code` `reason: db_empty|no_match` |
| Продолжительность ухода = **max(технологический, нормативный)** | **соблюдается** | `labor-projection.ts` (v4.35.1) `max(span, curing_days)`. Живой вызов: decision_log «Skruž min (21d…) > maturity (9.0d) → using skruž minimum» — max() наблюдался в проде |

---

## 5. Приложение — сверка утверждений документации (AC3)

Каждое утверждение из PK/доков перепроверено по коду:

| Утверждение (источник) | Статус | Что показал код |
|---|---|---|
| «MCP server (9 tools)» (`product.md:83`) | **ОПРОВЕРГНУТО** | 22 тула (`EXPECTED_TOOLS`). README местами «20 MCP tools (15 work + 5 ops)» (`README.md:60,163`) — третье число. Три разных числа в канон-доках (9/20/22) |
| «7-engine pipeline (orchestrated, deterministic-first)» (`product.md:133`) | **ЧАСТИЧНО ОПРОВЕРГНУТО** | Движки едины и детерминированы, но «orchestrated» на MCP-поверхности не выполнено (§3.2). tech.md §1 рисует движки внутри Python-Core; `structure.md §8 v2.0` это **само опровергает** («7-engine je v Monolit-Planner/shared, ne v Core») |
| «disk is source of truth / survives cold start» (docstrings) | **ОПРОВЕРГНУТО на фличе** | эфемерный локальный диск, `min-instances=1` без max-cap (§3.4) |
| «reuse `kb/urs_otskp_routing.yaml`» (комментарий `catalog_binding_adapter.py`) | **ОПРОВЕРГНУТО** | YAML не загружается; правило захардкожено; `design_build` потерян (§3.9) |
| «100% audit-trail coverage (formula+vstupy+vypocet_kroky)» | **ЧАСТИЧНО** | В machine-выходе есть formula+source+confidence; `vypocet_kroky` — свойство пилотных `items.json`, не MCP-формы (§3.8) |
| «14/14 exact» / «16 reconciliation flags» (changelog v4.42/Žihle) | **НЕ ПОДТВЕРЖДЕНО как харнесс** | Пилот-артефакты + ручной расчёт; переиспользуемого diff-инструмента в коде нет (§3.11) |
| «monolit integration PRODUCTION LIVE» (concrete-agent/CLAUDE.md) | **ОПРОВЕРГНУТО (сам док признал)** | `monolit_adapter` router не был смонтирован и удалён; живой шов — обратный делегат `monolit_delegate.py` |
| «join saga» (changelog v4.42) | **ОПРОВЕРГНУТО** | чистый parser-join без сессии/стейта (`soupis_quantity_join.py:1-9`) |
| «MCP classify-delegation family-safe» (soul.md) | **ПОДТВЕРЖДЕНО как утверждение**, не как факт-в-коде | Голдены существуют; family-parity ассертится (`element-classifier.golden-w3-parity.test.ts:53-54`); но два классификатора всё ещё живут параллельно (§3.6/§7) |

---

## 6. SO 250 — только факты (решение за Александром)

*(§3.6 задания: «Это решение остаётся за Александром, задача агента — предъявить факты.» Ни рекомендации, ни «что делать» здесь нет.)*

- **Что такое SO-250:** референсный тест-объект «SO-250 D6 Olšová Vrata–Žalmanov, úhlová zárubní zeď» — **подпорная стена** (не мост), анти-паттерн, заставивший отвязать bridge-context от номера SO. Корпус `test-data/SO_250/` (закрыт на чтение); probe `Monolit-Planner/shared/SO-250_smartextractor_probe.md`.
- **W3 (Python) голдены — 2 файла, ~24 функции.** `test_mcp_golden_so250.py` (#63–#70, #77, wall-suite): `operna_zed`, `zdivo_obklad` (reject), `zaklady_piliru` (задокументированный family-preserving флип), `driky_piliru` (позитив-контроль моста), genitive-suppression `opery_ulozne_prahy`, gabion→reject. `test_mcp_golden_so250b.py` (#71–#76): object-type detection `retaining_wall` vs `bridge`.
- **Текущее расхождение (два живых классификатора):** для SO-250-класса входов W3 (`classifier.py`) эмитит `operna_zed / zaklady(→zaklady_piliru) / zdivo_obklad / pricinik / deska / jine`; TS-движок (`element-classifier.ts`) эмитит `operne_zdi / zaklady_piliru|zakladovy_pas / explicit reject / rigel / stropni_deska / other`. TS-parity-харнесс ассертит равенство **на уровне family** (`expectW3Family`); аудированное family-level расхождение = **ноль**.
- **Что «флипнет» при MCP-classify-delegation** (verbatim `soul.md:2207-2220`): `operna_zed→operne_zdi` (#63, so250b #74/#76); `zaklady→zaklady_piliru` (#66/#69/#69b); `zdivo_obklad→engine reject` (#65). Family во всех случаях сохраняется; «NO golden asserts a W3-specific BUG». Более ранняя оценка (var. D, `soul.md:2264`): «7/9 SO-250 goldenů by se rozbilo» — до порта head-noun; пост-порт аудит расхождений по family не нашёл.
- **Что «сломается» технически при делегации:** литералы двух golden-файлов (или маппинг engine→W3 через `type_core[t].w3_name`/`w3_family`); W3-only типы (`zdivo_obklad`, `izolacni_stena`, `sachta`, `tunel_rampa`, `gabionova_zed`) не имеют `StructuralElementType` — calc-delegate их уже отвергает `unsupported_element_type` (`calculator.py:814-821`); конфликт `_MCP_TO_ENGINE_TYPE` `zaklady→zakladovy_pas` vs classify `→zaklady_piliru` придётся сводить.
- **Что «сохранит» вариант «держать два»:** head-noun дизамбигуации W3 + более тонкий reject-словарь; ценой ведения таблиц #3/#4/#6/#7 (§3.6) и parity-голденов бессрочно (`element_types.yaml:91` называет `w3_family` roll-up «Transitory… lives only until the MCP side delegates typing»).
- **Task-файл онтологии SO-250:** по **имени** был axis-B (`TASK_Orchestrator_WorkOntology_SO250.md`), по **содержанию** — axis-C (head-noun #63–70); переименован 2026-07-14 в `TASK_ElementTyping_HeadNoun_SO250_acceptance.md` per ADR-009 (option a). Это и есть инстанс коллизии, о которой §3.6.

*Ожидающее решение (формулируется как факт, без совета): делегировать ли classify на единый TS-движок (как уже сделан calc-делегат) — с флипом литералов голденов и сведением таблиц; либо держать два классификатора в синхроне через codegen `element_types.yaml` + parity-голдены. Оба варианта family-safe по текущему аудиту.*

---

## 7. Открытые вопросы, требующие решения Александра

*(AC6: только вопросы, без предложений «что делать дальше».)*

1. **Оркестратор и MCP-поверхность.** `StageGatingOrchestrator` живёт за Portal-JWT и невидим MCP-коннекторам; продуктовый путь — ручная цепочка ≥3 тулов. Должен ли оркестратор быть достижим с MCP-поверхности, или связка остаётся на стороне LLM-агента (как в Agent-First Vision)?
2. **Детерминизм композиции vs детерминизм листа.** Числа отдельных тулов воспроизводимы побайтово; порядок вызовов — на усмотрение LLM-планировщика (Vision, «no if/else workflows»). Считается ли «replay» на уровне листа достаточным, или требуется run-объект/result-id и детерминированная композиция?
3. **Дубль алгоритма классификации.** Данные едины (codegen), но скоринг реализован дважды с разными порогами неоднозначности и разными confidence (TS градуированный vs Python плоский 0.9/0.7). Это допустимая двухрантаймовость или расхождение к сведению? (Смежно — SO-250, §6.)
4. **Эфемерность «замороженных фактов» на Cloud Run.** Пасспорты/`calculator_facts`/project-cache на локальном диске без TTL/версии; scale-out даёт stale-empty чтения. Приемлемо ли для целевого объёма?
5. **`PARSE_VERSION` как ручной guard.** Единственный staleness-guard (soupis-хэндлы) — ручной инкремент, не контент-хэш; изменение значений без bump = 24 ч старых чисел. Приемлемо ли?
6. **Правило маршрутизации каталогов.** Каноничный `kb/urs_otskp_routing.yaml` кодом не читается; `_primary_catalog` захардкожен; `design_build` (две колонки) отсутствует; ÚRS-путь хардкодит `procurement_mode="privatni"`. Какой источник правды — YAML или код?
7. **Bind-адаптер (ADR-009 D2).** Детерминированный `uwo_code+params → catalog code` не построен; сегодня Bind фаззи (риск token-overlap мис-байндинга). Это осознанный отложенный статус?
8. **Провенанс норм.** Специфические калибровки STAVAGENT (rebar-матрица, pile-productivity, pour-crew, advisor, pump-коэффициенты) — голые константы с провенансом только в комментарии, при действующем правиле репо «no hardcoded norma in engine code». Оставить как есть или это долг?
9. **Измеримость расхода моделей.** Реальные токены LLM не логируются (оценка `len//4`, без sink'а); измеримы лишь бизнес-кредиты на тул. Нужен ли per-run учёт токенов/USD?
10. **Выходные формы для DACH/Испании.** BC3/GAEB/x83/ÖNORM в коде отсутствуют (roadmap в доках). Входят ли они в скоуп коннектор-контракта?
11. **Три оси онтологии (ADR-009).** Оси A/B/C ратифицированы, но axis-B canon «жив, не сделан», а axis-B авторитетный spec был PK-only до 2026-07-12 (graveyard-дефект на критическом пути). Готова ли axis-B DoD служить основанием спеки оркестратора?
12. **Когерентность выхода `calculate_*`.** Ответ одновременно несёт `recommended="mss"` и посчитанный конвенциональный план (90.5 д), `is_mss_path=false`, плюс `resource_ceiling` (21 чел) ≠ посчитанный экипаж (5). Какой из двух — авторитетный для потребителя?

---

## 8. Соответствие критериям приёмки

- **AC1** — таблица дублирования: §3.1. ✅
- **AC2** — вердикт есть/нет/частично по каждому §3 со ссылкой: §0.3 + заголовок каждого раздела. ✅
- **AC3** — утверждения из доков помечены проверено/опровергнуто/не подтверждено: §5. ✅
- **AC4** — детерминизм с фактическими числами двух прогонов: §3.7 (MCP ×2 побайтово + локальный golden ×2). ✅
- **AC5** — норм-константы без источника: §3.10. ✅
- **AC6** — открытые вопросы без предложений: §7. ✅
- **AC7** — ни один файл репо не изменён кроме этого отчёта; PR не открыт. ✅
