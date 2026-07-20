# Session handoff — 2026-07-19 — URS_MATCHER аудит → прямой каталог → Gemini/Vertex → OTSKP 2026 → классификатор-консолидация

## 1. Что сделали (всё на `main`, живо проверено в проде)

| PR | Что | Прод-верификация |
|---|---|---|
| **#1526** | URS_MATCHER аудит-ремедиация: reliability (WAL/busy_timeout/FK, non-fatal rejections, cache eviction), matching (diacritic folding, token-overlap, cross-catalog guard, no KB poisoning), security (requireApiKey на мутирующих, searchWeb opt-in, zip-bomb guard, multer ^2), **M7 `jsonExtract`** (balanced-brace вместо greedy — «worked-then-stopped») | merged, CI зелёное |
| **#1527** | **Прямой ÚRS-каталог podminky.urs.cz** — обход SPA через публичный frontoffice JSON API (`/v1/search`, capability-URL по `versionId`, без cookie). `frontofficeClient.js`, встроен первым в `matchUrsItems` (детерминизм прежде Perplexity) | **`/api/batch/diagnostics` → `frontoffice: OK, 3 поз., 120ms, conf 1.0`** ✓ |
| **#1528** | versionId авторезолв из `/v1/version/metadata` (field-name-agnostic скан + env-fallback); Gemini/Vertex routing видимость в `/diagnostics` | merged |
| **#1529** | **Vertex global endpoint** → `llmClient.js` умеет `VERTEX_LOCATION=global`; `GEMINI_FALLBACK_MODEL` env | **routing: `activePath: vertex_ai, vertexLocation: global, model: gemini-3.5-flash`** ✓ |
| **#1530** | **OTSKP каталог 2025_03 (17 904) → 2026 SFDI (17 940)** — репойнт `code_detector.py` + `mcp/tools/otskp.py` + `metadata.json` на `2026_otskp.xml` (git mv из имени с пробелами). Локально верифицировано парсером: 17 940. | **`find_otskp_code → catalog_version: "OTSKP 2026"`** ✓ |

**Прод-env выставлен вручную (Alexander):** `GEMINI_MODEL=gemini-3.5-flash`, `VERTEX_LOCATION=global`, `VERTEX_PROJECT=…`, `GOOGLE_GENAI_USE_VERTEXAI=true`, `GEMINI_FALLBACK_MODEL=gemini-3.5-flash`. Ревизия urs-matcher `00368-579`.

**Ключевые находки:**
- «ÚRS-поиск не работает» = не парсер, а **SPA + `site:`-ограничение промпта**. Настоящая причина — podminky.urs.cz это JS-приложение; фикс = прямой JSON-API (#1527).
- `gemini-2.5-*` **снимается 16.10.2026**; `gemini-3-flash`/`3.1-pro` проекту недоступны (404 везде); **`gemini-3.5-flash` работает только на `global` endpoint** (200) — отсюда #1529.
- OTSKP: pricing-путь (otskp.db из GCS + pgvector) **уже был 2026**; отставали committed-XML потребители (детекция кодов + MCP-fallback) + доки. #1530 их добил.
- **Киоск-модуль text-match ЖИВ** (проверено: код 273325131, HTTP 200, 17с из-за LLM-шага). Старое «не работает» = тот самый EMPTY_RESULT, закрыт #1527.

## 2. Классификатор строительных работ — 4 модуля: анализ + РЕШЕНИЕ

Трассировка (grounded, file:line в §3) показала: **каждый модуль делает ПОЛОВИНУ задачи «вход → soupis prací с кодами+количествами», а полный ассемблер уже существует в CORE.**

### Карта
| Модуль | Endpoint | Отдаёт | Количество |
|---|---|---|---|
| Одиночный поиск (text-match) | `/api/jobs/text-match` + `/api/pipeline/match` | коды-кандидаты | ❌ |
| Групповой/batch | `/api/batch` | коды-кандидаты per subwork | ❌ (нет колонки qty в `batch_items`) |
| Excel (block-match/fast) | `/api/jobs/block-match-fast` | код+кол-во per row | ⚠️ кол-во СКОПИРОВАНО из готового Excel (перекодирование) |
| Документы (document-extract) | `/api/jobs/document-extract` | работы+**реально извлечённое кол-во** | ✅ но только TSKP-категория, не позиц. ÚRS-код, read-only, кол-во теряется |

**Дублирование с Portal:** `document → список работ` есть В ДВУХ фронтах над ОДНИМ движком CORE:
- **Portal `/portal/analysis`** (`DocumentAnalysisPage`) → CORE workflow **B** (`/workflow/b/positions` = чертежи→позиции) + A (enrich/audit) + passport/compliance. Полнее, кредиты.
- **Киоск `document-extract`** → CORE `/api/upload` SmartParser. Тоньше, дубль.
- **CORE** (`create_work_breakdown` MCP + `soupis_assembler.py`) — реальный priced soupis, но кормится структурой (name+volume_m3+класс), не сырым текстом.

### РЕШЕНИЕ (рекомендация — подтвердить след. сессией, НЕ резать вслепую)

**Модули 1+2 (одиночный + групповой поиск по каталогу):** → **ОБЪЕДИНИТЬ, сохранив функции, на лучшем коде.**
- Один matching-пайплайн = улучшенный `matchUrsItems` (frontoffice-direct-catalog первым → local → OTSKP → Perplexity fallback). Сейчас «матч описания» размазан по 4 путям (text-match / pipeline / block-match / batch) — это и есть дубль кода.
- UI: оставить оба ввода (быстрое поле «одна позиция» + вставка списка), но БЭК один. Одиночный = список из 1.
- **Провести количество сквозь** (добавить qty/MJ в `batch_items` + не ронять) → «список описание+кол-во» → коды С количеством = уже реальный matched soupis. Самый дешёвый и ценный первый шаг.

**Модули 3+4 (поиск+анализ документации):** → **вынести из киоска, канон = Portal + CORE.**
- `document-extract` в киоске — тонкий дубль Portal `/portal/analysis` (workflow B). Держать две передние двери к CORE = разбериха, которую и видит Alexander.
- Канонический сквозной пайплайн (чертёж/TZ → позиции → коды → priced soupis) уже ЦЕЛИКОМ в CORE (workflow B + create_work_breakdown + soupis_assembler). Один фронт (Portal), киоск `document-extract` → удалить ИЛИ делегировать в тот же CORE-workflow.
- **Киоск репозиционировать = «быстрый lookup кодов»** (объединённый single+group), а «документ→soupis» = Portal.

**Открытые развилки (решает Alexander):**
1. Дом для «документ→soupis» = Portal (а киоск = только lookup)? Или всё в киоск, а Portal-анализ убрать?
2. Дубль `document-extract` — удалить или делегировать в CORE workflow B?
3. **Safety-шаг перед резкой:** honest side-by-side — прогнать один реальный документ через Portal `/analyze` (WF-B) и киоск `document-extract`, сравнить выходы на одном входе, ТОГДА резать.

## 3. File:line якоря (для следующей сессии)
- text-match `URS_MATCHER_SERVICE/backend/src/api/routes/jobs.js:397` → `services/ursMatcher.js:24` (matchUrsItems, frontoffice-first)
- pipeline `routes/pipeline.js:28`; block-match `jobs.js:654`; block-match-fast `jobs.js:1880` (item shape `:2003-2014`)
- document-extract `jobs.js:1607` → `services/documentExtractionService.js:470` (CORE call `:39/:61/:103`, `/api/upload`)
- batch `routes/batch.js:28/253` → `services/batch/batchProcessor.js:393` (нет qty)
- frontoffice `services/frontofficeClient.js`; diagnostics gemini/frontoffice пробы `routes/batch.js`
- Portal analysis `stavagent-portal/frontend/src/App.tsx:123` (`/portal/analysis` → DocumentAnalysisPage) → backend `routes/portal-files.js:343` (`/analyze`) → `services/concreteAgentClient.js` (workflow A/B/C)
- CORE assembler `concrete-agent/packages/core-backend/app/mcp/tools/breakdown.py:511` + `services/soupis_assembler.py`
- OTSKP 2026: `app/knowledge_base/B1_otkskp_codes/2026_otskp.xml` (17 940), consumers `services/code_detector.py:37` + `app/mcp/tools/otskp.py:62/65`

## 4. Прочие открытые (не срочно)
- Оптимизация 17с в text-match (LLM-объяснение опционально/async).
- Проверить файловые модули (block-match/document/batch) на реальном файле.
- Миграция OTSKP 2026 в URS_MATCHER (`otskpCatalogService.js`) + portal (`import-otskp.js`) — свои копии, тоже 17 904.
- metadata-body для точного golden versionId-авторезолва; live-Gemini-проба в `/diagnostics`.
