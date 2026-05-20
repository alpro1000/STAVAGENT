# TASK: MCP Dynamic Client Registration + KB YAML Loader Support

## Мантра

Сначала ты читаешь весь репо `alpro1000/STAVAGENT` (Core Engine
часть, особенно `app/` и всё что касается MCP, OAuth, KB
loader, startup logic).

НЕ пиши код пока:
- Не понял существующую структуру OAuth (где лежат endpoints
  authorize и token, как организовано storage клиентов)
- Не понял существующую структуру KB loader (где filter по
  расширениям, как идёт нормализация в internal entries)
- Не прошёл PRE-IMPLEMENTATION INTERVIEW

Все имена (переменные, функции, классы, файлы, таблицы,
endpoint paths) — **только из существующих конвенций в репо**.
Если в репо `app/api/routes_mcp_oauth.py` — добавляй handler
туда. Если таблица OAuth-клиентов уже называется определённым
способом — используй её. Не создавай параллельную структуру.

PRE-IMPLEMENTATION INTERVIEW обязателен (6 вопросов в конце).

---

## КОНТЕКСТ

**Дата**: 2026-05-13.
**Cemex CSC 2026 deadline**: 2026-06-28 (~6.5 недель).

Сегодня в production-логах Cloud Run сервиса `concrete-agent`
(europe-west3) обнаружены два независимых дефекта:

**Дефект A — MCP OAuth не работает end-to-end с Anthropic broker.**
- Service deployed: ✅
- IAM allUsers → roles/run.invoker: ✅
- POST /mcp → 307 redirect на /mcp/: ✅
- POST /mcp/ → 401 + WWW-Authenticate (RFC 9728 challenge): ✅
- GET /.well-known/oauth-protected-resource → 200: ✅
- GET /.well-known/oauth-authorization-server → 200: ✅
- OAuth authorize endpoint: ✅ (declared in manifest)
- OAuth token endpoint: ✅ (declared in manifest)
- `grant_types_supported`: authorization_code + client_credentials: ✅
- **Dynamic Client Registration endpoint: ❌ 404 на POST /register**
- **`registration_endpoint` field в well-known manifest: ❌ отсутствует**

Симптом для пользователя: claude.ai возвращает "Couldn't reach
the MCP server" при попытке использовать connector. Reference
`ofid_8a76a4b240f6cfc5`.

Корневая причина: Anthropic broker читает manifest, видит что
DCR не объявлен, не имеет способа получить client_id и
client_secret для нового client → не может пройти OAuth flow →
не может вызвать tools/list. Connector становится unusable.

Это блокер для:
- Claude Directory submission (каталог требует self-registration
  через DCR — иначе каждый user должен ручками заводить клиента)
- OpenAI Custom GPT публикации в Store
- Любого external Cemex tester / European Pitch Day evaluator

**Дефект B — KB loader пропускает YAML файлы.**
- Loader проходит по B1..B9 директориям при старте: ✅
- Логирует summary категорий: ✅ (видно `B6_research_papers: 31 entries`)
- **При обнаружении .yaml/.yml файлов пишет `⚠️ Unsupported format` и пропускает**

Затронутые critical файлы (примеры из логов):
- `B4_production_benchmarks/default_ceilings/mostovkova_deska.yaml`
- `B4_production_benchmarks/default_ceilings/operne_zdi.yaml`
- `B5_tech_cards/real_world_examples/zihle_2062_1/master_soupis_summary.yaml`
- `B5_tech_cards/real_world_examples/zihle_2062_1/vendor_pricing_snapshot.yaml`
- `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/INDEX.yaml`
- `B6_research_papers/.../ch01_06_typy_mostu.yaml` (и ещё 3 chapter файла)
- `B7_regulations/csn_73_6222_zatizitelnost_mostu/INDEX.yaml`
- `B7_regulations/csn_73_6244_prechody_mostu/INDEX.yaml`
- `B7_regulations/en_1992_2_concrete_bridges/INDEX.yaml`
- `B7_regulations/tkp_04_zemni_prace/INDEX.yaml`
- `B7_regulations/vl_4_mosty/INDEX.yaml`

Эти данные effectively невидимы для runtime — element default
ceilings, vendor pricing snapshots, regulations indexes, research
chapters. Это создаёт разрыв между claim ("у нас 200+ entries
KB") и reality ("11 категорий с медианно 15 entries").

Оба дефекта независимы. Делаем в одном PR (или двух — на твоё
усмотрение, см. Q6 ниже).

---

## ЗАДАЧА 1 — Dynamic Client Registration (DCR)

### Business logic

Открытый endpoint (без auth) который принимает RFC 7591
registration request и регистрирует нового OAuth client.

Сценарий end-to-end:

1. **Anthropic broker** или **любой MCP client** делает POST с
   JSON body содержащим `redirect_uris[]`, `client_name`, опционально
   `grant_types[]`, `software_id`, `software_version`, `scope`.
2. Сервер генерирует уникальный `client_id` и `client_secret`.
3. Сервер сохраняет запись клиента в существующее хранилище
   OAuth clients (то самое что используется token и authorize
   endpoints для валидации).
4. Сервер возвращает 201 Created с JSON по RFC 7591:
   - `client_id` (plain, для использования в дальнейшем)
   - `client_secret` (plain, **возвращается только один раз** в
     этом response — клиент должен сохранить)
   - `client_id_issued_at` (Unix timestamp)
   - `client_secret_expires_at: 0` (no expiration для MVP)
   - echo всех registration parameters из request
5. Дальше клиент использует client_id + client_secret для:
   - `grant_type=client_credentials` flow (server-to-server) →
     получает access_token
   - `grant_type=authorization_code` flow (user-mediated) →
     authorize → callback с code → token exchange

### Domain rules

- **Storage клиентов** — та же структура (таблица / коллекция /
  модель) что уже используется existing authorize и token endpoints
  для валидации client_id. Не создавай параллельный storage.
- **client_secret хранится как hash**, не plaintext. Comparison
  через constant-time compare. Если в репо уже есть hash helper
  (для API keys, паролей, чего-то ещё) — переиспользуй.
- **client_id и client_secret format**: следуй существующей
  convention в репо. Если есть `sk-stavagent-{hex48}` pattern (см.
  memories — он был спроектирован для API keys) и он реализован —
  используй для client_secret. client_id может быть короче (24 hex)
  или UUID. Выбирай как в репо принято для подобных IDs.
- **redirect_uris validation**: scheme должен быть https (или http
  только для `localhost` / `127.0.0.1` — для local development clients).
  Отклонять javascript:, data: и подобные.
- **grant_types validation**: разрешённые grant_types из
  `grant_types_supported` в well-known manifest (сейчас:
  authorization_code, client_credentials). Если client запрашивает
  не из списка → 400 + invalid_client_metadata.
- **Idempotency**: одинаковые регистрации создают новые записи
  (RFC 7591 default behaviour). Не делать unique constraint на
  client_name.
- **Rate limiting**: 10 регистраций / час с одного IP. Реализуй
  если в репо есть rate limiting helper / middleware. Если нет —
  пропусти для MVP, добавь TODO comment.
- **Audit log**: каждая регистрация логируется (INFO) с IP, User-Agent,
  client_name. Это поможет debugging и security review.
- **Error responses** — строго по RFC 7591 / OAuth 2.0:
  - 400 + `{"error": "invalid_redirect_uri"}` для bad URI
  - 400 + `{"error": "invalid_client_metadata"}` для bad fields
  - 500 + `{"error": "server_error"}` для unexpected
- **Endpoint должен быть public** (no auth, per RFC 7591). Для
  production-grade позже можно добавить `initial_access_token`
  flow, но для submission MVP — open.

### Update well-known manifest

В `/.well-known/oauth-authorization-server` response добавить
поле `registration_endpoint` со значением полного URL нового
endpoint. Пример (для понимания, не для прямого копирования):

```json
{
  "issuer": "...",
  "authorization_endpoint": "...",
  "token_endpoint": "...",
  "registration_endpoint": "<полный URL DCR endpoint>",
  ...rest existing fields...
}
```

Path endpoint'а должен следовать существующей convention OAuth
namespace в репо (где сейчас authorize и token).

### Acceptance criteria — Задача 1

1. POST на новый registration endpoint с минимальным RFC 7591
   payload (`redirect_uris`, `client_name`) → 201 Created + body
   содержит `client_id`, `client_secret`, `client_id_issued_at`,
   `client_secret_expires_at: 0`, echo registration params

2. Полученные credentials успешно работают в `grant_type=client_credentials`
   на token endpoint → 200 + valid access_token

3. Access_token успешно проходит auth на /mcp/ → JSON-RPC `tools/list`
   возвращает 200 + 10 tools

4. Authorization code flow тоже работает: authorize → redirect с
   code → token exchange → access_token → tools/list

5. Well-known manifest содержит `registration_endpoint` (можно
   проверить curl'ом на `/.well-known/oauth-authorization-server`)

6. Bad requests → корректные RFC 7591 error responses:
   - missing redirect_uris → 400 invalid_redirect_uri
   - non-https redirect_uri (кроме localhost) → 400 invalid_redirect_uri
   - unsupported grant_type → 400 invalid_client_metadata

7. Unit tests:
   - Successful registration с минимальным payload
   - Successful registration с полным payload (software_id, scope, etc)
   - Failed registration: missing redirect_uris
   - Failed registration: bad scheme
   - Failed registration: unsupported grant_type
   - client_secret stored as hash (не plaintext в storage)

8. Integration test (end-to-end OAuth dance):
   - Register → получить credentials
   - Exchange credentials на access_token via client_credentials
   - Использовать access_token на /mcp/ для tools/list
   - Проверить что 200 + 10 tools

9. После deploy на Cloud Run: удалить existing STAVAGENT connector в
   claude.ai, добавить заново без Advanced settings (без pre-shared
   credentials). Connector должен подключиться successfully —
   Anthropic broker сам сделает DCR через advertised endpoint.

---

## ЗАДАЧА 2 — YAML support в KB loader

### Business logic

KB loader при старте сервера обходит директории `app/knowledge_base/B1..B9`
и загружает entries в in-memory structures, индексирует категории,
логирует summary. Сейчас он поддерживает определённые формат(ы)
(вероятно .json) и игнорирует .yaml/.yml.

Изменение: расширить набор поддерживаемых форматов на .yaml и .yml,
парсить через safe loader, нормализовать в ту же internal
структуру что и существующие форматы.

### Domain rules

- **Подавление warning'ов для .zip файлов**: .zip в B6 — это
  packaged KB archives для distribution (не для runtime loading).
  Либо silent skip без warning, либо упомянуть один раз aggregated
  ("skipped N .zip archives"). Не spam'ить per-file warning.
- **Существующий behaviour для .json (и других уже поддерживаемых
  форматов) — сохранить без изменений**.
- **YAML парсинг — через safe_load** (PyYAML `yaml.safe_load` или
  ruamel.yaml безопасный режим). НЕ через `yaml.load` без Loader —
  это security hole.
- **Malformed YAML**: не падать на весь loader. Log ERROR с file
  path и yaml.YAMLError message, пропустить файл, продолжить
  остальные. Сейчас json loader скорее всего делает то же — следуй
  его pattern.
- **Schema внутри YAML файлов** — посмотри 2-3 sample файла из
  разных B-категорий (B4 default_ceilings, B5 real_world_examples,
  B7 regulations INDEX.yaml) чтобы понять структуру. Они могут
  быть: одна entry per file (B4), nested structure с list of entries
  (B5), metadata + cross-references (INDEX.yaml в B6/B7). Loader
  должен корректно обрабатывать обе patterns (либо они уже
  одинаковые с JSON структурой — тогда no special handling).
- **Dependency**: если `PyYAML` / `ruamel.yaml` ещё нет в requirements
  / pyproject — добавить (PyYAML предпочтительнее, lightweight).
  Если уже есть (для других целей) — переиспользовать.
- **Entries count в startup logs**: после fix'а numbers в логах
  должны увеличиться. Это observable signal что fix сработал.

### Acceptance criteria — Задача 2

1. KB loader загружает .yaml и .yml файлы из всех B1..B9 директорий

2. Startup log показывает увеличившиеся entries counts во всех
   затронутых категориях (как минимум B4, B5, B6, B7 — где
   найдены YAML файлы по логам 2026-05-19 09:25:22)

3. Warning `⚠️ Unsupported format` больше не появляется для
   .yaml/.yml файлов

4. .zip файлы — либо silent skip, либо один aggregated log line
   (не spam per-file)

5. Существующее .json loading behaviour не изменилось — ни один
   existing JSON файл не теряется, counts по чисто-JSON директориям
   (если такие есть) — без изменений

6. Malformed YAML файл → ERROR в логах с file path + yaml error
   message, остальные файлы загружаются, server стартует successfully

7. Tests:
   - Загрузка простого YAML (single entry)
   - Загрузка YAML с nested structure
   - Загрузка YAML с list of entries
   - Malformed YAML → не падает, log ERROR
   - JSON regression test: existing JSON loading работает как раньше

8. После deploy на Cloud Run — в startup logs видно реальное
   количество entries (не 31 в B6 а реальное число с YAML
   chapters; не 16 в B7 а реальное число с regulation indexes)

---

## PRE-IMPLEMENTATION INTERVIEW (6 вопросов)

Задавай по одному, жди ответа.

**Q1.** Где сейчас находится storage OAuth clients в репо?
Какой mechanism — Postgres таблица, SQLite, in-memory dict,
config file, что-то ещё? Покажи мне file path где он
управляется (тот файл что используют existing authorize и
token endpoints для валидации client_id). Я должен
использовать эту же структуру для DCR, не создавать
параллельную.

**Q2.** Pattern `sk-stavagent-{hex48}` — он уже реализован
где-то в коде (для API keys, MCP authentication, чего-то
ещё)? Если да — file path. Если нет — какой format используется
сейчас для secrets / tokens / API keys в репо?

**Q3.** KB loader — какие форматы он поддерживает сейчас?
Покажи file path где filter по расширениям (или функция
которая dispatching по типу файла). Также: PyYAML или ruamel.yaml
уже в dependencies?

**Q4.** Test conventions в репо: pytest, какая структура
fixtures, есть ли уже tests для OAuth endpoints и KB loader?
Я должен встроиться в существующую test architecture, не
создавать parallel test suite.

**Q5.** Rate limiting helper — есть в репо middleware /
decorator для rate limiting (на любых endpoints)? Если да —
переиспользую для DCR endpoint. Если нет — пропускаю rate
limiting для MVP с TODO comment.

**Q6.** Scope PR: одно PR с обеими задачами, или два
отдельных PR (DCR — submission blocker priority, YAML —
completeness fix)? Также: после implementation должен ли я
сам делать `gcloud run deploy`, или остановиться на PR ready
for review и ты деплоишь руками?

После всех 6 ответов — начинаешь работу. Используй стандартный
gate-based workflow: implement → tests → local verification →
краткий report → подтверждение → next gate.

---

## ЧТО НЕ ВХОДИТ

- Не менять MCP tools themselves (10 уже зарегистрированы и mount'нуты)
- Не менять authorize endpoint логику (работает, объявлен в manifest)
- Не менять token endpoint логику (работает, объявлен в manifest)
- Не менять existing JSON loader behaviour для KB
- Не добавлять новые B-категории — расширять только parsing
- Не реализовывать token revocation endpoint (отдельная задача)
- Не реализовывать `initial_access_token` flow для DCR (production
  feature, отдельная задача)
- Не делать rate limiting на authorize или token endpoints
- Не менять project_cache, calculator_suggestions, или другие
  startup-time services
- Не trogath Vercel kiosks (Portal, Registry, Monolit) — задача
  только в Core Engine на Cloud Run
- Не менять CORS settings или RFC 9728 challenge mechanism — они
  работают корректно по логам
- Не trying фиксить .zip файлы в B6 как loaded entries — они
  legitimately are distribution archives

---

## ACCEPTANCE — Финальная проверка

После завершения обеих задач + deploy на Cloud Run:

1. **DCR end-to-end через claude.ai**:
   - В этом самом чате на claude.ai: Settings → Connectors →
     STAVAGENT → Remove
   - Add custom connector → URL `https://concrete-agent-3uxelthc4q-ey.a.run.app/mcp`
   - БЕЗ Advanced settings (no pre-shared credentials)
   - Toggle ON в conversation
   - Скажи "проверь tools" в чат
   - Должен увидеть список 10 tools от STAVAGENT MCP

2. **YAML loader в production logs**:
   - Cloud Run logs показывают `⚠️ Unsupported format` для 0 .yaml/.yml файлов
   - Startup summary показывает увеличившиеся counts:
     - B4: было 10 — стало >= 12 (mostovkova_deska + operne_zdi)
     - B5: было 54 — стало >= 56 (Žihle master_soupis + vendor_pricing)
     - B6: было 31 — стало >= 37 (Pokorný-Suchánek 5 chapters + INDEX + другой INDEX)
     - B7: было 16 — стало >= 21 (5 regulation INDEXes)

3. **Audit findings update**: подвопрос 1.2 Authentication из
   audit-task `TASK_AUDIT_MCP_Isolation_Cemex_Sidelines.md` теперь:
   - DCR → A (было D)
   - Token endpoint, authorize endpoint → A (было B — после end-to-end теста)

---

## NAMING RULE

Все имена (endpoint paths, function names, class names, table
names, test file names, log message format) — **только из
существующих конвенций в репо**.

Конкретно:
- Если в репо OAuth endpoints живут в одном модуле — DCR endpoint
  туда же, не создавать parallel module
- Если OAuth clients хранятся в определённой таблице — DCR
  записывает туда, не создавать parallel table
- Если KB loader живёт в одном файле — расширяй тот файл, не
  создавай новый yaml_loader.py рядом
- Если log messages в репо используют определённый emoji/format
  convention (видно по логам: `🔌 MCP server mounted`,
  `✅ DB schema up to date`) — следуй той же convention

Не создавай параллельную структуру. Встраивайся в существующий
код. Если нашёл existing pattern которое делает 70% того что
нужно — расширь его, не пиши параллельный.
