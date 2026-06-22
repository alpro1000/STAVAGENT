# STAVAGENT — статус-хэндофф (продолжение после марафона 19.06)

> **Назначение:** единая точка входа в следующую сессию. Что подтверждено живьём, что хвосты,
> какой план векторной миграции, какие развилки надо зафиксировать.
> **Дата:** пт 19.06.2026 · **Ветка прод:** `main` (version-pin держит) · **Рекомендуемый путь файла в репо:** `docs/handoff/STAVAGENT_STATUS_HANDOFF_2026-06-19.md`

**Легенда провенанса:**
✅ проверено живьём в этой сессии · 📋 из рекона марафона · ⚠️ не подтверждено / нужен доступ извне

---

## 0. TL;DR — где мы

- Прод жив, version-pin `==1.154.0` держит. `vertexai` removal 24.06 — только из релизов SDK, прод не падает.
- Демо-путь OTSKP работает (✅ гонял `find_otskp_code` сейчас), но всплыли **два симптома Fix 3** и подтвердился **раскол версий Fix 4**.
- Векторная миграция (3072/halfvec) распланирована на фазы — см. §4. Исполнение Фаз 3+ **после Cemex 28.06**.
- ИИ-связки: ядро живое, но «шов» advisor↔engine не сшит, и runtime 5-ролёвого оркестратора отсюда не проверить.

---

## 1. Очередь работ (по приоритету)

| # | Задача | Статус | Блок |
|---|---|---|---|
| 1 | **Fix 3** — keyword `ORDER BY cena→relevance` + хардкод source `"OTSKP 1/2025"` → реальный `catalog_version` | ✅ оба симптома воспроизведены | pre-Cemex |
| 2 | **Fix 4** — rebake `otskp.db` → 2026 (keyword 2025/17904 vs embeddings 2026/17940) | ✅ раскол подтверждён | pre-Cemex |
| 3 | **Phase 2 MCP** — carrier-shape `find_urs_code`, счётчики→17940, docstring example | 📋 | pre-Cemex |
| 4 | **genai / 3072 / halfvec** миграция (без обрезки) | 📋 план готов (§4) | **post-Cemex** |
| 5 | **Phase 3** — UI-чистка (убрать селектор моделей, ladder Vertex→Bedrock) | 📋 | post-Cemex |

---

## 2. Fix 3 — живые находки (✅ эта сессия)

Демо-кейс: `find_otskp_code("beton mostních pilířů C30/37")`.

| Симптом | Статус | Что в проде сейчас |
|---|---|---|
| Хардкод `source` | ✅ подтверждён | Все 8 результатов помечены `source: "OTSKP 1/2025"` — статичная строка |
| `ORDER BY cena`, не relevance | ⚠️ воспроизвёлся | При равном confidence 0.78 первым идёт `334335` (předpjatý, 16 781 Kč), `334325` (železobeton, 12 935 Kč) — вторым |
| **Демо-регрессия** | ⚠️ новое | Хэндофф ждал «334325 в топе» — сейчас он №2. Для запроса без «předpjatý» наверху должен быть železobeton |

**Доказательство хардкода (exact-code lookup):** `code=334325` → confidence 1.0, `source: "OTSKP 1/2025"`, без retrieve-пути. Версия не читается из данных вообще — это константа.

**Форма фикса (отдать как task-spec Claude Code, прозой, без имён переменных):**
- *Часть A:* убрать строковый хардкод `"OTSKP 1/2025"`; штамповать реальный `catalog_version` той записи, что отдала строку.
- *Часть B:* в keyword-кандидатном SQL заменить сортировку по цене на relevance/score (или снять цену из `ORDER BY`, довериться `deterministic_ranker`); проверить тай-брейк в самом `deterministic_ranker` — при равном confidence он не должен ломать тай по цене (сейчас похоже, что ломает).
- *Golden:* `C30/37 без предпряга → 334325 первым` — чтобы регрессия не вернулась.

**Важная связь:** как только хардкод снять и штамповать реальную версию — выдача начнёт честно показывать смешанные «2025/2026», что **обнажает Fix 4**, а не прячет. Порядок Fix 3 → Fix 4 верный.

---

## 3. Fix 4 — раскол версий каталога

**Подтверждено живьём (✅):** штамп `source` оторван от данных на всех путях (embeddings-retrieve, exact-code, любой). Раскол 2025/2026 поэтому невидим никому — ни MCP, ни советнику, ни UI, ни демо.

**Что отсюда НЕ достать (честно):** точные тоталы 17904 vs 17940 и поле версии — MCP-поверхность не отдаёт метаданные каталога. `retrieve_summary` показал только per-query (keyword retrieved 137/kept 59, embeddings 26/kept 24) и что **в топ-8 не попала ни одна keyword-строка — все из embeddings**. → По факту чаще *показываются* цены из 2026-индекса, а *штампуются* 2025-м.

**✅ T4 ЗАМЕРЕНО ЖИВЬЁМ (2026-06-22, Cloud SQL `stavagent_portal` DB):**
- **pgvector = 0.8.1** → ≥0.7.0, **halfvec(3072) для T6 готов из коробки**, `ALTER EXTENSION` НЕ нужен.
- **embeddings-store** (`otskp_embeddings`) = **17 940 строк, ВСЕ `catalog_version='OTSKP 2026'`** — внутри раскола НЕТ, один чистый 2026.
- **keyword-store** (SQLite `otskp.db`) = **17 904 / 2025** (из `otskp_engine.py:5`; SQLite в образе, не live-count).
- **Дельта = 36** (17 940 − 17 904). **Раскол МЕЖДУ сторами**, не внутри: embeddings 2026 vs keyword 2025.

**Решение (подтверждено фактами):** Fix 4 = **ребейк keyword-store `otskp.db` → 2026/17940**, связать с Фазой 3 миграции (один проход = сразу 2026). Live primary-retrieve уже = embeddings/17940/OTSKP 2026 (top-8 идут оттуда) — лендинг с 17 940 фактически верен; отстаёт только keyword-store.

**Канон-синк (после ребейка):** числа 17 904 в `tech.md` / `product.md` / `domain.md` / корневой `CLAUDE.md` / MCP-инструкция → 17 940 одним проходом. NB: docstring `find_urs_code` про «17 904 seed» относится к OTSKP-seed URS-matcher'а (2025) — НЕ путать с ÚRS-каталогом (39 000+); правится вместе с ребейком, не раньше.

---

## 4. Векторная миграция → gemini-embedding-001, 3072 через halfvec (план)

**Решено:** полные 3072 dim, **без обрезки на 768**, колонка `vector(768)` → `halfvec(3072)`, HNSW, re-embed всех ~17 940. Исполнение Фаз 3+ — post-Cemex.

**Два риска, которые док к звонку недооценивал:**
1. Это **смена модели целиком** (`TextEmbeddingModel` 768 → `gemini-embedding-001` 3072), не просто рост размерности. Косинус-геометрия другая → пороги (0.78/0.71, `param_prefilter softened`) **поедут**, рекалибровка обязательна.
2. Doc-store и query-сторона должны быть в **одном пространстве**. Половинчатая миграция = мусорный косинус. Переключение атомарное, через флаг.

### Фазы

**Фаза 0 — Pre-flight (только проверки):**
- `pgvector >= 0.7.0`? (иначе `ALTER EXTENSION vector UPDATE`).
- `gemini-embedding-001` GA в `europe-west3`? → **Q5 на звонке Google**.
- `genai.Client` для эмбеддингов через ADC (`enterprise=True` vs `vertexai=True`?) → **Q2 на звонке**.
- Снять baseline cosine-скоров на фикс-наборе (C30/37 + 2–3 норм-запроса) — эталон «до».
- Вытащить count + version (SQL из §3) → зафиксировать развилку «связать с Fix 4».

> Сегодняшний звонок закрывает половину Фазы 0 (Q2 + Q5).

**Фаза 1 — Dual-write схема (аддитивно, обратимо):**
- Новая колонка `embedding_3072 halfvec(3072)` РЯДОМ со старой `vector(768)`. Старую не ALTER-ить, не дропать. Прод на старой. Ноль даунтайма.

**Фаза 2 — Новый embed-клиент (за флагом):**
- `genai` + `gemini-embedding-001`, `task_type=RETRIEVAL_DOCUMENT` (для запросов `RETRIEVAL_QUERY`), без `output_dimensionality` (default 3072), **без ручной L2-нормализации** (нужна была только при обрезке).
- Флаг `embedding_version = 768_legacy | 3072_genai`, дефолт legacy.
- ⚠️ Общий `genai.Client` с Krok A (chat). Если делаешь Krok A — клиент готов.

**Фаза 3 — Backfill (re-embed ~17 940):**
- Через **Batch API** (не срочно, дёшево), идемпотентно/резюмируемо.
- **Здесь же встать на 2026-каталог** → закрыть Fix 4 одним проходом.
- Гейт: у всех строк `embedding_3072` not null.

**Фаза 4 — Индекс + рекалибровка:**
- `CREATE INDEX ... USING hnsw (embedding_3072 halfvec_cosine_ops)` на заполненной колонке.
- Прогон baseline-набора, сравнение с эталоном «до», подкрутка порогов confidence / `param_prefilter`.
- Golden: `C30/37 без предпряга → 334325 первым`; норм-поиск отдаёт те же годные источники.

**Фаза 5 — Cutover (флип флага):**
- `embedding_version → 3072_genai`. Doc-store и query-путь оба 3072.
- Живой мониторинг `find_otskp_code` + норм-поиск.
- Откат = флип флага назад (старая колонка + индекс на месте).

**Фаза 6 — Cleanup (после стабильного окна):**
- Дроп старой `vector(768)` + индекс, удалить legacy-код + флаг, отпинить SDK (вместе с Krok A).

### Storage
~6 KB/вектор × 17 940 ≈ **108 МБ** (halfvec, пренебрежимо).

---

## 5. ИИ-связки — честная карта

**🟢 LIVE и рабочее:**
- Детерминированный классификатор (regex) — мгновенно (📋/✅).
- OTSKP embeddings + `deterministic_ranker` — ✅ гонял сейчас.
- URS matcher service — ✅ отдал реальный код `274311191` (conf 0.85).
- Поиск норм через Perplexity — 📋 марафон: реальные `pjpk.rsd.cz`.
- Советник + калькулятор (fusion) — 📋 марафон: план DOKA Top 50 / 4 záběry / 66.8 дн.

**🟡 Полу-подключено / деградирует:**
- **URS Perplexity-ветка** — ✅ живая, но вернула пустышку «пришлите каталог» (conf 0.5); спас matcher service. AI-fallback слабый. Демо-безопасно (matcher прикрывает), но это не «ИИ решает».
- **5-ролёвый Multi-Role оркестратор (Vertex)** — зашит, зовут 4 сервиса (Portal/URS/Registry/Monolit), но runtime под нагрузкой ⚠️ **не подтверждён**: на `/multi-role/ask` нет MCP-обёртки, egress закрыт. **Решение 19.06:** применение не найдено → убрать тег/окно из UI, оркестратор **припарковать под будущий «шов»** (его единственное оправданное место — шаг «ИИ предлагает/обосновывает»: 5 ролей = тот самый AI-слой над движком). Не выкидывать.

**🔴 Не сшито — «шов» (мечта: ТЗ → извлечение → KB → ИИ предлагает/обосновывает → движок считает):**
Сегодня опалубку и дробление решает движок по правилам (AI-last), ИИ только комментирует. Лежит тремя кусками:
1. **SmartInput PDF pipeline** — MinerU OCR + chunked extraction + cross-document fusion.
2. **`tz_facts` напойка** — извлечённая технология → в `planElement` + MCP.
3. **AI advisor v2** — советник цитирует нормы (TKP18 §7.8.3, curing class, prestress) с live-валидацией.
4. **Pattern 27** — внешняя LLM как N-й слой кросс-валидации матчинга — не построен.

**⚪ Рассинхрон доков (не баги, путают):** роли — CLAUDE.md «4» / лендинг «6» / **код 5**; MCP — CLAUDE.md «9» / **код 20**.

---

## 6. 🧵 НЕДОДЕЛКИ И ХВОСТЫ — мастер-чеклист

### Каталог / данные
- [ ] Fix 3-A: убрать хардкод `source "OTSKP 1/2025"` → реальный `catalog_version`.
- [ ] Fix 3-B: keyword `ORDER BY cena → relevance`; проверить тай-брейк в `deterministic_ranker`.
- [ ] Fix 3: golden-кейс `C30/37 без предпряга → 334325 первым`.
- [ ] Демо-регрессия: 334335 (předpjatý) всплывает выше 334325 (železobeton) — пофиксить до 28.06.
- [ ] Fix 4: SQL-замер дельты 17904 vs 17940 + version-поле (нужен Claude Code).
- [ ] Fix 4: ребейк `otskp.db` → 2026 (связать с Фазой 3 миграции).
- [ ] Phase 2 MCP: carrier-shape `find_urs_code`, счётчики → 17940, docstring example.
- [ ] URS: нет `catalog_version` штампа вообще — решить, нужен ли.
- [ ] URS Perplexity-ветка отдаёт деградированный ответ — усилить промпт/фоллбек.

### Миграция (хвосты для верификации, до имплементации)
- [ ] `enterprise=True` vs `vertexai=True` — что в установленной версии (`python -c` тест). → Q2.
- [ ] `pgvector >= 0.7.0` (для `halfvec`) — `SELECT extversion …`; иначе `ALTER EXTENSION vector UPDATE`.
- [ ] `response_schema` vs `response_json_schema` — точное имя в `GenerateContentConfig`.
- [ ] Точный batch-строп `embed_content` + quota rpm.
- [ ] Clean `pip install -r requirements.txt` во fresh venv (pin → транзитивный конфликт).
- [ ] `gemini-embedding-001` GA в `europe-west3`? `flash-lite` даёт 404 — какие модели GA. → Q5.
- [ ] Async переезжает на `client.aio.models.*` (касается `price_parser`).
- [ ] Рекалибровка порогов confidence/`param_prefilter` под 3072-пространство (Фаза 4).

### Файлы под genai-миграцию (из code-recon 📋)
- [ ] Krok A (chat): `core/gemini_client.py` (главный, Vertex/ADC), `integrations/gemini_client.py` (API-key), `passport_enricher.py` (обе ветки), `price_parser/llm_client.py` (**async**), `routes_llm_status.py` (тривиально), + `requirements.txt` (отпинить **последним**).
- [ ] Krok B (embeddings): `vertex_embeddings.py` (3072 + re-embed), DB-миграция `vector(768)` → `halfvec(3072)` + новый HNSW.

### Инфраструктура / эксплуатация
- [ ] Cloud SQL сейчас **ZONAL** (снижено с REGIONAL ради цены) — вопрос HA в рамках кредитов.
- [ ] `concrete-agent` `min-instances=0` → cold-start теряет in-memory KB cache — вопрос баланса.
- [ ] Кредиты $2,000: срок, покрытие (Cloud Run + SQL или только Vertex), апгрейд тира, суммирование со старыми $1,000. → Q6.

### Нельзя закрыть отсюда (нужен внешний доступ)
- [ ] ⚠️ Runtime 5 ролей — вызов с твоей машины (egress открыт) или через любой из 4 фронтов на `/multi-role/ask`.
- [ ] Живой срез шва через `create_work_breakdown` (20 кредитов) — показать, докуда доходит pipeline и где ИИ НЕ вызывается.

### Frontend / киоски (новое 19.06)
- [ ] Спрятать **Analýza dokumentace (BETA)** из дашборда (не удалять) — но сперва **вытащить chunk-логику и применить в Kalkulátor** (передняя половина «шва»: ТЗ→извлечение→вход калькулятора). Ещё не сделано.
- [ ] **Multi-Role**: убрать тег/окно из UI; оркестратор припарковать под будущий «шов».
- [ ] **Атомизатор бетон**: `create_work_breakdown` (MCP) покрывает только бетон/конструктив; живой прогон (20 кредитов) — подтвердить scope.
- [x] 🔴 **Атомизатор общестрой (T1-adapter MVP)** — ✅ **шов построен** (ветка `claude/atomizer-localize`; дизайн [`docs/specs/universal-work-decomposer/design.md`](../specs/universal-work-decomposer/design.md) §10 F0–F3). Scope-router (`app/mcp/tools/scope_router.py`) → branch-registry в `breakdown.py` (monolit = WORK_TEMPLATES, **бит-идентично**, golden-guard) → catalog-binding adapter (`app/mcp/tools/catalog_binding_adapter.py`) → `find_urs_code`. Первая не-бетонная секция **malba** (KB `technological_postupy/interier_psv/malba.yaml`) проходит router→decomposer→adapter→find_urs_code→atom-with-code. Honest-blank на неизвестном scope (фотовольтаика → no atoms). Подписи MCP-тулов не тронуты, новый top-level tool НЕ вводился (design §5.3), MCP-compat 29/29 зелёный. Осталось (отдельные таски, 1 YAML = 1 секция): остальные 9 PSV-секций.
- [ ] Свести киоски **URS-matcher + Generátor výkazu výměr** на единый `create_work_breakdown`.
- [ ] **Generátor výkazu výměr** — кандидат на **активацию** (бетон-часть рабочая), не на скрытие.

### 🧩 «Тест-проверено, но не локализовано» (рабочие прототипы без прод-прописки)
- [x] Общестроительный атомизатор (шаблоны декомпозиции) — ✅ **локализован для MVP-секции malba** (T1-adapter, ветка `claude/atomizer-localize`): из sandbox-эталона в прод-KB + Python-pipeline. Остальные секции — порт по одной.
- [ ] Chunk-извлечение из Analýzy dokumentace — работало, падало на чанках; код вытащить → Kalkulátor.
> Это отдельный класс долга — НЕ путать с «не работает». Это готовая логика без прод-прописки.

### Документация (cleanup-проход)
- [ ] CLAUDE.md: «9 tools» → 20; «4 roles» → 5.
- [ ] Лендинг: «6 expert roles» → 5.

---

## 7. Развилки — зафиксировать до старта

1. **Связать Fix 4 с Фазой 3** (один re-embed = сразу 2026) — *рекомендация: да.*
2. **Krok A (chat) до/вместе с Фазой 2** ради общего `genai.Client`, или вектор изолированно.
3. Усиливать ли URS Perplexity-ветку сейчас или оставить под прикрытием matcher service до post-Cemex.

---

## 8. Решения, уже принятые (не релитигировать)

- Freeze 21.06 **снят** (21.06 — только срок подачи Cemex, не freeze продакшна).
- Полная genai-миграция — **post-Cemex**.
- Эмбеддинги — **3072 через halfvec, без обрезки** на 768.
- **DeepSeek убран.**
- Version-pin на `main` держит прод.
- **Анализ документов как направление — деприоритизирован** (чат делает лучше); киоск Analýza dokumentace прячем из UI после ревизии chunk-логики.
- **Multi-Role оркестратор** — применения нет, паркуем под «шов», из UI убираем.
- **Атомизатор работ = `create_work_breakdown` (MCP)** — не строим заново, сводим параллельные киоски на него.

## 9. Даты

- **Cemex подача — 28.06** (нужен demo, не идеал).
- **`vertexai` removal — 24.06** (пин держит, прод не падает).
- **Звонок Google — пт 19.06 13:00** (Q2/Q5 кормят Фазу 0; Q6 — кредиты).

## 10. Запушенное на main (контекст)

- revert #1367 + diag-лог (#1390)
- next-session.md (#1389)
- `docs/handoff/GOOGLE_CALL_2026-06-19_FULL.md` (#1397)

---

## 11. Frontend / киоски — ревизия (новое 19.06, по скриншотам дашборда)

**🟢 Активные (AKTIVNÍ) — рабочее ядро, не трогаем:**
Klasifikátor stavebních prací · Registr Rozpočtů · Monolit-Planner (plánovač projektu) · Kalkulátor betonáže (rychlý výpočet) · Poradna norem (поиск ČSN/TKP, Perplexity + KB cache).

**🟡 Спрятать из UI (не удалять):**
- **Analýza dokumentace (BETA)** — алгоритм был и работал, но **падал на чанках**. Направление не развиваем: анализ документов любой чат делает лучше. → убрать с дашборда.
  - ⚠️ Перед скрытием — **вытащить chunk-логику/код и применить в Kalkulátor**. Это передняя половина «шва» (`ТЗ → извлечение → вход калькулятора`), а не спасение мёртвого киоска. **Ещё не сделано.** Не терять вслепую (кандидат и в SmartInput).
- **Multi-Role** (тег на Klasifikátor) — оркестратор без применения. Из UI убрать, оркестратор держать под будущий «шов» (см. §5).

**🔑 Атомизатор работ — уточнение (важно, 19.06):**
`create_work_breakdown` (MCP) — атомизатор **только для бетонных/конструктивных работ**. Его decomposition-шаблоны: опалубка / арматура / бетон / zrání / předpětí. На **общестроительных работах** (покраска, монтаж, demolice…) **не работает** — подтверждено практикой.

НО разбивка на работы **всех типов** (вкл. покраску, монтаж) **уже есть в тест-проверенном виде** — просто **не добавлена** в `create_work_breakdown` / MCP / прод.

Что готово и где дыра:
- ✅ Scaffold готов и переиспользуем: классификация элементов (22 типа), Pattern 15 (work-first/catalog-last).
- ⚠️→✅ **КОРРЕКЦИЯ ÚRS-биндинга (T1 recon FINDINGS §4, теперь закрыто):** утверждение «ÚRS-биндинг для общестроя **уже есть**» было **наполовину неверно по коду**. *Поиск* ÚRS (`find_urs_code`) существовал, но *биндинг в атомизатор* — **НЕТ**: `_attach_catalog_codes` (`breakdown.py`) делал ранний `return` для `catalog != otskp/both` и звал только `find_otskp_code`. При `catalog='urs'` атомизатор отдавал work-first список **без кодов**. **Дыра закрыта в T1** (ветка `claude/atomizer-localize`): новый `catalog_binding_adapter.py` оборачивает `find_urs_code` без смены подписи, нормализует `match_kind` → status-enum (`exact|candidate|group_only|not_verified`, URS максимум `candidate`, никогда `exact`), `breakdown.py` теперь зовёт его на ÚRS-ветке.
- 🔴→✅ Дыра «шаблоны декомпозиции для не-бетонных профессий» — для секции **malba** портирована (KB YAML + Python decomposer); остальные секции — порт по одной.

→ «Объединить в механизм» = (1) свести параллельные реализации (URS-matcher + Generátor + атомизатор) на `create_work_breakdown` И (2) **расширить decomposition-шаблоны общестроем** из тест-логики (каталог через ÚRS — биндинг построен).
- [x] 🔴 Портировать тест-проверенные шаблоны общестроя в decomposition-слой `create_work_breakdown` — ✅ MVP (malba) сделан; остальные 9 секций — таски.
- [ ] ⚠️ Живой прогон (20 кредитов): подтвердить scope — бетон ок, malba ок, остальной общестрой honest-blank (нет шаблона).
- [ ] Свести киоски URS-matcher + Generátor на единый инструмент.
- [ ] **Generátor výkazu výměr** — кандидат на **активацию** (бетон-часть рабочая), не на скрытие.

**⚪ Честно «PŘIPRAVUJEME» (не вводят в заблуждение, низкий приоритет):**
Analýza výkresů · Objednávka betonu · Kalkulačka čerpadel · Ceníky dodavatelů · Kalkulačka bednění · Plánovač zemních prací · Optimalizátor výztuže.
