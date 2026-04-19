# AUDIT: Monorepo Architecture

**Дата:** 2026-04-19
**Режим:** READ ONLY
**Область:** весь репо `alpro1000/STAVAGENT`
**Автор:** независимый аудит (Claude Code)

---

## 1. Вердикт

**Это flat multi-service repo с признаками попытки собрать true monorepo, но tooling никогда не был доведён до рабочего состояния.**

Не true monorepo (корневые workspaces сломаны), не git subtree (нет `.gitmodules`, нет subtree merges), не чистый flat repo (на бумаге декларирован workspace-based monorepo, которого фактически нет). Работает как **collocation of autonomous services** в одном git-репо с правильными per-service CI триггерами и HTTP-only межсервисным взаимодействием — и именно в этой форме оно и живёт в продакшне.

---

## 2. Evidence

### 2.1 Git-структура

- **Нет `.gitmodules`** (проверено: `cat .gitmodules` → файла нет).
- **Нет subtree merges в истории** (`git log --all --grep="subtree\|Squashed commit" -i` → пусто).
- **Один remote:** `origin → github.com/alpro1000/STAVAGENT` (fetch+push, проксируется через local_proxy).
- **165 коммитов** в истории, ветки `claude/*-xxxxx` (husky enforced).
- **47 из 50 последних коммитов затрагивают ровно одну сервисную папку** (`Monolit-Planner` абсолютно доминирует). 3 коммита на `(root)` — правки `CLAUDE.md` и `cloudbuild.yaml`. **Ноль атомарных cross-service коммитов** в недавней истории.
- Распределение префиксов: `FIX:` 50, `FEAT:` 30, `DOCS:` 17, `REFACTOR:` 6, `STYLE:` 4. Conventional commits соблюдаются.

### 2.2 Root tooling

- **Есть `package.json` в корне** с `workspaces`:
  ```json
  "workspaces": [
    "Monolit-Planner/backend",
    "Monolit-Planner/frontend",
    "Monolit-Planner/shared",
    "concrete-agent",
    "stavagent-portal",
    "URS_MATCHER_SERVICE"
  ]
  ```
- **Эта конфигурация сломана на нескольких уровнях:**
  1. `concrete-agent` — Python/FastAPI сервис. `concrete-agent/package.json` существует, но сам содержит вложенный workspaces-блок на `packages/core-backend` (Python!), `packages/core-frontend`, `packages/core-shared`. **Вложенные npm workspaces не поддерживаются официально** — поведение undefined.
  2. `stavagent-portal/package.json` — тоже имеет собственный workspaces-блок (`backend`, `frontend`, `shared`). Та же проблема вложенности.
  3. `Monolit-Planner/package.json` — ещё один workspaces-блок (`backend`, `frontend`, `shared`).
  4. `URS_MATCHER_SERVICE` — **НЕТ `package.json` в корне сервиса**. Только `URS_MATCHER_SERVICE/backend/package.json` и `URS_MATCHER_SERVICE/frontend/package.json`. Root workspace указывает на директорию без манифеста → `npm install` с корня падает или молча игнорирует.
- **Нет `package-lock.json` в корне, нет `node_modules/` в корне** → вероятно, никто никогда не запускал `npm install` из корня (или сдался после первой ошибки). Установка идёт по-сервисно.
- **Нет turborepo, nx, lerna, pnpm-workspace.yaml, rush.json** — никакого enterprise monorepo tooling.
- `rozpocet-registry`, `rozpocet-registry-backend`, `mineru_service` **НЕ объявлены** в root workspaces (они живут в одном репо, но и на бумаге к "монорепо" не относятся).

### 2.3 Cross-service связность

- **Ноль cross-service относительных импортов.** Поиск `from '../../../(concrete-agent|stavagent-portal|Monolit-Planner|URS_MATCHER_SERVICE|rozpocet-registry)` → 0 совпадений. `from '.*concrete-agent` в JS/TS → 0 совпадений.
- **`@stavagent/*` npm scope используется только ВНУТРИ одного сервиса:**
  - `@stavagent/monolit-shared` → импортируется только `Monolit-Planner/backend` + `Monolit-Planner/frontend` через `"file:../shared"`.
  - `@stavagent/portal-shared` → только `stavagent-portal/backend` + `/frontend`.
  - `@stavagent/core-shared` → только внутри `concrete-agent/packages/`.
  - **Ни один shared package не шарится между разными сервисами.** Scope общий, смысл локальный.
- **`shared/icon-registry.ts` в корне (245 строк)** — **мёртвый код.** Grep `icon-registry` по всему репо → 3 совпадения: сам файл, строка `CLAUDE.md:30` (описание), строка `CLAUDE.md:242` (правило). Ни один `.tsx` его не импортирует. Декларируется как "cross-kiosk shared code" — фактически не используется никем.
- **Core↔Kiosk pattern соблюдён корректно:**
  - `concrete-agent/app/integrations/monolit_adapter.py` — это **FastAPI router** (HTTP endpoint), а не прямой импорт монолитного кода. `concrete-agent` не знает о UI киосков и не импортирует их файлы.
  - Киоски вызывают Core только по HTTP (проверено отсутствием относительных импортов в Monolit-Planner, portal, registry).
  - Направление зависимостей: Portal/Monolit/Registry → Core API. Core → (ничего из киосков).

### 2.4 CI/CD

- **6 `cloudbuild-*.yaml` файлов** в корне (concrete, monolit, portal, urs, registry, mineru) + `cloudbuild.yaml` (manual "deploy all").
- **6 `triggers/*.yaml`** с правильным path-фильтром:
  ```yaml
  # triggers/monolit.yaml
  includedFiles:
    - "Monolit-Planner/**"
  ```
  Каждый триггер слушает push в `main` и срабатывает ТОЛЬКО на изменения своей папки. Это **корректно настроенный per-service deploy.**
- **`.github/workflows/`** (6 файлов): `keep-alive`, `monolit-planner-ci`, `test-coverage`, `test-mcp-compatibility`, `test-shared`, `test-urs-matcher`. Каждый workflow использует `paths:` фильтр для изоляции.
- **Husky hooks — проблемные:**
  - `.husky/pre-commit` и `.husky/pre-push` **хардкодят путь** `REPO_ROOT="/home/user/STAVAGENT"` → не переносимо между машинами.
  - Оба хука **запускают только Monolit-Planner тесты** (`shared/formulas.test.ts` + `backend/test:unit`). Изменения в `concrete-agent/`, `stavagent-portal/`, `URS_MATCHER_SERVICE/`, `rozpocet-registry/` проходят pre-commit без каких-либо проверок.

### 2.5 Deployment

- **Каждый сервис деплоится независимо** на свою платформу:
  - 5 отдельных Cloud Run services (europe-west3): concrete-agent, monolit-planner-api, stavagent-portal-backend, urs-matcher-service, rozpocet-registry-backend.
  - 1 Cloud Run в europe-west1: mineru_service.
  - 3 Vercel deployments (frontends): portal, monolit, registry.
- **Нет cross-service deploy-зависимостей.** Изменение в `Monolit-Planner/**` не триггерит деплой остальных.
- **Стеллаж `render.yaml` — stale.** 7 штук (`render.yaml` в корне + по одному в каждом сервисе). CLAUDE.md явно пишет: **"No Render. Infrastructure: Cloud Run + Vercel + Cloud Build"**. Файлы оставлены как исторический артефакт от миграции.

### 2.6 Per-service изоляция

- **`.gitignore`:** один в корне (46 байт, минимальный) + локальные где нужны.
- **README.md:** корневой + по одному на каждый сервис. **CLAUDE.md / CLAUDE.MD стратегия:**
  - `CLAUDE.md` (root, 56 KB, v4.23.0, 2026-04-19) — свежий, активно поддерживается.
  - `Monolit-Planner/CLAUDE.MD` (+ дубликат `claude.md` строчными рядом) — свежий.
  - `concrete-agent/CLAUDE.md` — **v2.5.0 от 2025-11-20**, 5 месяцев старый, ссылается на "Phase 4 COMPLETE Nov 18 2025" и "Monorepo refactoring Nov 18".
  - `stavagent-portal/`, `URS_MATCHER_SERVICE/`, `rozpocet-registry/` — **не имеют CLAUDE.md**.
  - Стратегия непоследовательная: корневой CLAUDE.md — "справочник для всего", concrete-agent — свой детальный (stale), остальные — без.
- **Dockerfile'ы разбросаны** по сервисам (8 штук), нет общего base image.
- **Каждый сервис можно разрабатывать без клонирования всего монорепо?** Технически нет — git не умеет shallow по папкам. Но после клонирования с одним сервисом работать можно автономно.

### 2.7 Дублирование

- **API типы между Core и Kiosks не shared и не сгенерированы.** Pydantic в `concrete-agent/app/models/`, Zod/TS interfaces в каждом TS-сервисе **рисуются вручную**. Если Core изменит схему ответа — Monolit/Portal/Registry об этом узнают только runtime при HTTP 500 или валидационной ошибке.
- **OTSKP коды и classifier правила:**
  - `Monolit-Planner/shared/src/element-classifier.ts` — 22 element types, OTSKP regex.
  - `concrete-agent/packages/core-backend/app/` — KB JSON + отдельная классификация.
  - `URS_MATCHER_SERVICE` — собственная SQLite + OTSKP импорт скрипт.
  - **Одна и та же доменная онтология реализована в 3 местах независимо.** Это не copy-paste, это параллельная разработка.
- **Confidence scoring** — правило в корневом `CLAUDE.md` ("regex=1.0, OTSKP DB=1.0, drawing_note=0.90, …"), но реально значения дублируются в кодовых базах без общего источника.

---

## 3. Что работает хорошо

- **Per-service CI triggers реально работают.** Push в `Monolit-Planner/**` запускает **только** `cloudbuild-monolit.yaml`. Это экономит Cloud Build минуты и изолирует деплои.
- **Direction of dependencies чистый.** Core не импортирует UI киосков (проверено grep). Все cross-service вызовы идут через HTTP. Это редкость для solo-dev проекта такого размера.
- **History в основном per-service.** 47/50 последних коммитов — single-directory. На практике ты уже работаешь с каждым сервисом как с отдельным проектом, просто живёшь в общем git-реп.
- **Отдельные Dockerfile + cloudbuild на сервис** дают независимый rollback. Если сломался Monolit — Portal и Core не трогаются.
- **Husky enforces branch-naming (`claude/*-xxxxx`)** и критичные formula tests pre-commit → защищает от случайных поломок бизнес-логики на стороне Monolit.
- **Корневой CLAUDE.md (v4.23, 1100+ строк)** — реально хорошо поддерживаемый справочник. Даёт Claude Code контекст всего проекта одним файлом.
- **Cloud SQL один инстанс с 3 БД** — простая и дешёвая схема для solo-dev.

---

## 4. Что может быть проблемой

### [High] Root `package.json` workspaces сломан и вводит в заблуждение

`package.json` в корне декларирует 6 workspaces. Минимум 2 из них нерабочие:
- `URS_MATCHER_SERVICE` не имеет `package.json` на этом уровне.
- `concrete-agent` — Python сервис с вложенным workspaces-блоком; npm не умеет nested workspaces.

Отсутствие `package-lock.json` и `node_modules/` в корне подтверждает: `npm install` с корня никто не запускает. Это **false advertising**: структура выглядит как "unified monorepo" для человека, который впервые открывает репо (в том числе для judges хакатона и для ИИ-ассистентов, которые вид `workspaces` принимают за гарантию), но de-facto не работает.

**Severity: High** — вводит в заблуждение judges + будущих контрибьюторов + самого Claude Code при анализе.

### [Medium] Husky hooks хардкодят абсолютный путь и покрывают только 1 сервис

`.husky/pre-commit` и `.husky/pre-push`:
- `REPO_ROOT="/home/user/STAVAGENT"` — brittle, работает только на этой машине.
- Запускают только `Monolit-Planner/shared/formulas.test.ts` + `Monolit-Planner/backend:test:unit`.
- **Изменения в concrete-agent, portal, URS, registry проходят без проверок.**

**Severity: Medium** — не блокирует хакатон, но создаёт ложное чувство безопасности ("у нас husky, значит тесты прогоняются").

### [Medium] Version drift между CLAUDE.md файлами

- Root CLAUDE.md: v4.23.0, 2026-04-19.
- `concrete-agent/CLAUDE.md`: **v2.5.0, дата обновления "2025-11-20"**, раздел "Current Status" говорит про "Phase 4 - Week 1" — более 5 месяцев устарел.
- `Monolit-Planner/CLAUDE.MD` + дубликат `claude.md` строчными рядом — потенциальная путаница для файловых систем case-insensitive (macOS/Windows).
- `stavagent-portal`, `URS_MATCHER_SERVICE`, `rozpocet-registry` вообще без CLAUDE.md.

**Severity: Medium** — Claude Code читает свой ближайший CLAUDE.md; для concrete-agent это устаревшая карта.

### [Medium] Отсутствие shared API schema → ручная синхронизация

Core (Python/Pydantic) и Kiosks (TS/interface) описывают одни и те же контракты параллельно. Нет OpenAPI-codegen или JSON Schema источника правды. Контракты `POST /workflow/a/import`, `POST /api/v1/multi-role/ask`, `POST /import` поддерживаются "на синхронность руками". Падения ловятся на runtime.

**Severity: Medium** — живучи, но типовой источник production-багов при параллельных правках.

### [Low] `shared/icon-registry.ts` в корне — мёртвый код

245 строк, декларируется в CLAUDE.md как "Cross-kiosk shared code", факт: **zero импортов** по всему репо (grep подтвердил). Либо удалить, либо реально начать использовать.

**Severity: Low** — косметика, но показывает разрыв между намерением и реальностью.

### [Low] 7 `render.yaml` при заявленной "No Render" инфраструктуре

CLAUDE.md явно пишет "No Render". Файлы остались как исторический артефакт миграции на Cloud Run. Судьи или контрибьюторы могут запутаться.

**Severity: Low** — только confusing visual.

### [Low] Визуальный мусор в корне

В корне:
- **23 `.md` + `.txt` файла**: TASK_*, PLAN_*, AUDIT_* (3 штуки уже лежат), SESSION_*, NEXT_SESSION.md, PORTAL_TABS_MODAL_PATCH.txt, CONCRETE_AGENT_MEMORY_ISSUE.txt, MONOLIT_XLSX_IMPORT_DEBUG.txt, SECURITY_HARDENING_PLAN.md, ИНСТРУКЦИЯ_RENDER.txt, etc.
- **33 TKP PDF файла** (TKP01…TKP33, самый большой — TKP17 на 13.8 MB). Итого **~60 MB PDF в корне** репо.
- **5 PDF "návod"** (domino, quattro, rundflex, sky-kotva, skydeck, srs) — ~20 MB.
- **Служебные скрипты/данные в корне:** `clear-production-db.sql`, `CLOUD_SHELL_COMMANDS.sh`, `extract_all_pdfs.py`, `md_files.txt`, `stavagent_architecture_spec.json`, `extracted_data/`.
- **`render.yaml` + `cloudbuild.yaml` + 6 `cloudbuild-*.yaml`** рядом друг с другом.

Для solo-dev это "мой рабочий стол, я сам разберусь". Для постороннего человека (judge, open-source контрибьютор, recruiter) — **первое впечатление** от открытия репо: "неряшливо, непонятно где вход".

**Severity: Low** — косметика, но заметная.

---

## 5. Соответствует ли вердикт описанию Александра?

> Александр: "монорепо в который я встраиваю киоски-сервисы"

Описание **частично** соответствует реальности, но термин "монорепо" вводит в заблуждение — и тебя, и посторонних.

**Что у тебя реально построено:** это не true monorepo с общим tooling (как у Google/Meta с Bazel, как у Vercel с turborepo). Это **"flat multi-service repo"** — пять автономных сервисов лежат в пяти папках одного git-репо, каждый со своим `package.json` (или `requirements.txt`), своим `Dockerfile`, своим `cloudbuild-*.yaml` триггером, своим Cloud Run или Vercel деплоем. "Встраивания" через git-механизмы (submodule, subtree) нет — ты просто кладёшь новую папку в репо и пишешь ей отдельный CI. Межсервисные вызовы идут по HTTP, не через импорты.

Корневой `package.json` с `workspaces` — это **недоделанная попытка** собрать настоящий npm-монорепо. Она сломана: один из workspace-ов (`URS_MATCHER_SERVICE`) не имеет `package.json` на нужном уровне, другой (`concrete-agent`) — Python. Никто не запускает `npm install` с корня, и это нормально — каждый сервис ставится и собирается независимо. Но сам факт наличия этого `workspaces`-блока создаёт ложное впечатление о структуре.

**Точное название паттерна:** "Poly-repo в одной папке" или "Collocation of services". На английском — **"polyglot flat multi-service repository"**. Для твоего use case (solo-dev, 5 Cloud Run сервисов, 3 Vercel, 1 Cloud SQL) это **нормальная и рабочая модель.** Она не Google-grade, но она работает, не мешает деплоить, и git history подтверждает — ты и де-факто работаешь с каждым сервисом изолированно (47/50 коммитов single-directory).

Стоит ли тебе поменять слово "монорепо" в описании? Для наружной аудитории — да, на "multi-service repo" или "modular repo with 5 independent services". Для внутренней коммуникации — без разницы, главное чтобы tooling соответствовал реальности.

---

## 6. Рекомендации

### ДО хакатона (21.04) — только если есть свободные 1-2 часа

Это **косметика**, она не блокирует хакатон. Если времени нет — пропусти, ничего не сломается.

- **[15 мин] Удалить или исправить root workspaces.** Либо убрать `workspaces` из `package.json` (и честно признать "flat repo"), либо оставить только то, что реально работает (`Monolit-Planner/backend`, `Monolit-Planner/frontend`, `Monolit-Planner/shared`).
- **[5 мин] Починить husky hook:** заменить `REPO_ROOT="/home/user/STAVAGENT"` на `REPO_ROOT="$(git rev-parse --show-toplevel)"`. Будет работать у любого контрибьютора.
- **[15 мин] Создать `docs/archive/` и переместить туда:** TASK_*, SESSION_*, PORTAL_TABS_MODAL_PATCH.txt, CONCRETE_AGENT_MEMORY_ISSUE.txt, MONOLIT_XLSX_IMPORT_DEBUG.txt, ИНСТРУКЦИЯ_RENDER.txt, NEXT_SESSION.md, next-session.md. Корень станет чище для judges.
- **[10 мин] Создать `docs/normy/` и переместить TKP*.pdf + `*-návod.pdf`.** Корень освободится от ~80 MB PDF-мусора. Эти файлы — справочники ČSN/производителей, они не часть кода.
- **[5 мин] Удалить `shared/icon-registry.ts`** (мёртвый код) или актуально использовать.
- **[5 мин] Добавить в корневой README** блок-схему "5 сервисов + платформы деплоя". Первое впечатление judges.

Итого: **~55 мин на косметику**, 0 риска сломать что-то в production.

### ПОСЛЕ хакатона — если захочешь

- **[1–2 ч] Синхронизировать версии CLAUDE.md** между сервисами, или удалить устаревшие (concrete-agent v2.5.0) и оставить только актуальные + ссылку на root CLAUDE.md.
- **[4–6 ч] OpenAPI codegen для TS-клиентов Core API.** Core уже отдаёт OpenAPI спеку. Добавить `openapi-typescript-codegen` для Monolit/Portal/Registry → типы API становятся автогенерируемыми, ручная синхронизация контрактов исчезает.
- **[выкинуть 7 `render.yaml`]** → 2 мин, но только когда уверен что обратно не нужно.

### ЧЕГО НЕ ДЕЛАТЬ

- **НЕ мигрировать на turborepo / nx / lerna.** Для 5 сервисов solo-dev это enterprise-overkill. Build orchestration у тебя уже решён через Cloud Build. Turbo добавит сложность без профита.
- **НЕ переходить на git submodules.** Ты уже хорошо живёшь в flat repo с path-based CI. Submodules добавят боли при клонировании, checkout и CI.
- **НЕ разбивать репо на 5 отдельных GitHub-репозиториев.** Это испортит существующий workflow (один PR на весь код, общие CLAUDE.md, общая история), а выгоды почти нет — сервисы и так деплоятся независимо.

---

## 7. Влияние на хакатон (21.04)

### Что judges увидят, когда откроют репо

**Три самых видимых проблемы при первом взгляде:**

1. **Корневой каталог выглядит захламлённым.** 23 `.md`/`.txt` файла + 38 PDF + служебные скрипты + SQL-дампы + архитектурные спеки рядом с `package.json`. Это первое, что видит человек, прокручивая GitHub-страницу репо. Сравни: clean repo показывает README и папки сервисов, и всё. Здесь — вал истории.

2. **`render.yaml` рядом с `cloudbuild-*.yaml` + TKP PDF-ки в корне + 3 AUDIT_*.md файла** создают впечатление "не доделано / не убрано". Это не провал — скорее signal "работа идёт активно", — но читателю с холодного старта трудно понять, на какую инфраструктуру смотреть и какой отчёт актуальный.

3. **Корневой `package.json` заявляет monorepo с workspaces, которого нет.** Если judge попробует `npm install` из корня (классический первый шаг) — получит ошибку или warnings. Это ударит по впечатлению "чистой инженерии".

### Что производит хорошее впечатление

- **Реально работающие per-service CI triggers** (`includedFiles: "Monolit-Planner/**"`). Судья с опытом DevOps это оценит.
- **Core↔Kiosk разделение через HTTP, без cross-imports** — это профессиональный паттерн, и он действительно соблюдён.
- **Корневой `CLAUDE.md` на 56 KB** — очень зрелый справочник. Если judge откроет его — впечатление резко повысится.
- **893 тестов в `Monolit-Planner/shared`** + MCP compatibility CI + husky с formula-тестами — сигнал что ты всерьёз относишься к бизнес-логике.
- **5 production-деплоев** (Cloud Run + Vercel) с реальными доменами (`kalkulator.stavagent.cz`, `klasifikator.stavagent.cz`, `registry.stavagent.cz`, `www.stavagent.cz`) — **это главное**. Judge, увидев живые URL, потеряет интерес к архитектурным нюансам.

### Нужно ли что-то срочно исправить до 21.04?

**Нет, ничего срочного.** Вся критика в секции 4 — от косметической до high-severity — не блокирует демо, не ломает production, не мешает judges оценить функциональность. Живые работающие URL + 893 теста + Core↔Kiosks HTTP-разделение перевесят впечатление от захламлённого корня.

Если готов потратить час на косметику (секция 6, блок "ДО хакатона") — это улучшит первое впечатление. Если нет — тоже нормально, судят продукт, а не git-структуру.

---

## Appendix: команды для самопроверки

Если хочешь перепроверить ключевые факты из отчёта — вот команды, каждая выдаёт строго тот факт, что процитирован в evidence.

```bash
# Нет submodules
test -f .gitmodules && echo "есть" || echo "нет .gitmodules"

# Нет subtree merges
git log --all --grep="subtree\|Squashed commit" -i --oneline | wc -l   # → 0

# Один remote
git remote -v

# Root workspaces declaration
cat package.json | grep -A 10 workspaces

# URS_MATCHER_SERVICE не имеет package.json на уровне workspace
ls URS_MATCHER_SERVICE/package.json 2>&1   # → No such file

# Cross-service relative imports
grep -r "from ['\"]\.\./\.\./\.\./\(concrete-agent\|stavagent-portal\|Monolit-Planner\|URS_MATCHER_SERVICE\|rozpocet-registry\)" \
  --include="*.ts" --include="*.tsx" --include="*.js" .   # → empty

# shared/icon-registry.ts — мёртвый код
grep -r "icon-registry" . --include="*.ts" --include="*.tsx"   # → только сам файл + CLAUDE.md

# Commits — 47/50 single-directory
git log --format="%H" -50 | while read h; do
  git show --name-only --format="" $h | awk -F'/' 'NF>1{print $1}' | sort -u | tr '\n' ','
  echo
done | sort | uniq -c | sort -rn | head -5

# Husky hook хардкод
grep REPO_ROOT .husky/pre-commit

# concrete-agent CLAUDE.md версия (stale)
head -10 concrete-agent/CLAUDE.md | grep -i version

# 33 TKP PDF в корне
ls TKP*.pdf | wc -l   # → 33

# 23 .md/.txt в корне
ls *.md *.txt 2>/dev/null | wc -l
```

---

**Конец отчёта.**
Объём: ~260 строк markdown.
Сохранено: `/home/user/STAVAGENT/AUDIT_Monorepo_Architecture.md`.
