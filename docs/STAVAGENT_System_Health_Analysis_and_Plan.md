# STAVAGENT — сквозной анализ системы и план работоспособности

**Дата:** 2026-07-02 · **Метод:** 6 параллельных read-only трассировщиков (движок 24 элемента,
Калькулятор→ТОВ, персистентность проектов, кросс-сервисный синк, MCP-коннекторы, админка) +
собственный recon оркестратора. Все находки — с `file:line`. Кода этот документ не меняет.

> **Цель (слова владельца):** сервис должен **работать**, **считать без ошибок все элементы**,
> быть **понятным**. Названы проблемы: (1) насчитанное в таблице не переносится в ТОВ; (2) проекты
> Monolit создаются, но не читаются; (3) Registry — верно; (4) админка не закончена.

---

## 0. Итог одной страницей

Система **на 90% рабочая**; ломают её несколько точечных, но критичных разрывов в **потоке данных**,
а не в математике. Движок считает верно (1294 теста) — падает ровно на одном легитимном вводе.
Главная боль — **фронт↔бэк контракт**: запись в ТОВ и список проектов расходятся по ключу/owner/таблице.

| Слой | Вердикт | Критичное |
|---|---|---|
| Движок (расчёт) | 🟢 верен, 🔴 1 падение | `podkladni_beton` (rebar=0) роняет `planElement` |
| Оркестратор | 🟢 | 6 non-prismatic типов падают, если dims без объёма |
| Фронт → ТОВ | 🔴 | «тихий успех»: пишет «Uloženo», строк 0 (нет `position_id`) |
| Персистентность проектов | 🔴 | create пишет NULL-owner / в `bridges`; список читает `=userId` из `monolith_projects` |
| Кросс-синк (Registry vs Monolit) | 🟢 Registry / 🔴 Monolit | 2 таблицы + split-auth vs 1 таблица + always-authed |
| MCP-коннекторы | 🟡 | пробрасывает 25 из 90 полей; classify не делегирует; pile length теряется |
| Админка | 🟢 в основном / 🟡 хвосты | 2 фронт-заглушки + URS auth-дыра |

**Порядок лечения:** Движок (считать без падений) → Поток данных (проекты видны + ТОВ переносит) →
Понятность (честные предупреждения) → MCP-паритет → Админка + безопасность.

---

## 1. ВВОД → ОРКЕСТРАТОР → РЕЗУЛЬТАТ (движок: «считать без ошибок все элементы»)

### Как работает
Единая точка входа `planElement(input)` (`planner-orchestrator.ts:892`) → 7 движков (pour/formwork/
props/rebar/curing/schedule/pump) → `PlannerOutput`. Дефолты (crew=4, shift=10, k=0.8, wage=398) всегда
валидны. `planProject` (`project-planner.ts:97`) уже оборачивает каждый элемент в try/catch → честный
`elements_uncalculated`.

### Где ломается
- **🔴 `podkladni_beton` — гарантированное падение на легитимном вводе.** В каталоге `rebar_ratio_kg_m3:0`
  (простой бетон, арматуры нет by design) → `estimateRebarMass`=0 → `calculateRebar({mass_t:0})` →
  `throw 'mass_t must be positive'` (`rebar.ts:35`). Golden `golden-group-a-pozemni-vodorovne.test.ts`
  маскирует хаком `rebar_mass_kg:1`. Второй латентный throw рядом: `rebar.ts:37` (`norm_h_per_t:0`).
- **🔴 6 non-prismatic типов** (`mostovkova_deska, pilota, schodiste, nadrz, rimsa, other`,
  `element-geometry.ts:22`): если пользователь дал L/W/H, но **не дал `volume_m3`** →
  `deriveGeometryInput` (`orch:876`) печатает honest-blank warning, но возвращает `volume_m3` undefined →
  tact_volume 0 → тот же `rebar.ts:35` throw.
- **🟠 `mostovkova_deska` без `height_m`** — не падает, но **считает неверно**: `estimateFormworkArea`
  уходит в горизонтальную ветку → селектор берёт позёмный слэб-систему (MULTIFLEX) вместо falsework
  (Top 50/Staxo). Тихая ошибка.
- **Мёртвые throw'ы** (не достижимы из `planElement`, шум): весь `concreting.ts:42-209` (10 штук —
  `calculateConcreting` не импортируется оркестратором) и `pert.ts:71`.
- Прочие throw'ы (`element-scheduler.ts:474` deadlock, `pour-decision.ts:340`, crew/wage guards) —
  внутренние инварианты / срабатывают только на заведомо битом пользовательском вводе. Не трогать.

### Фикс (правильная высота — деградировать строку, не весь элемент)
1. **`calculateRebarLite` (`rebar-lite.ts:119`):** если итоговая `mass_kg <= 0` → вернуть нулевой
   `RebarLiteResult` (0 t / 0 ч / 0 Kč / 0 дн), НЕ звать `calculateRebar`. Зеркалит уже существующий
   `isReject`-паттерн (`orch:1800`). `podkladni_beton` возвращает валидный план (бетон+опалубка+график),
   только rebar=0. Снимает golden-хак `rebar_mass_kg:1`.
2. **Guard в начале `planElement`** (сразу после `deriveGeometryInput`, `orch:900`): если `volume_m3`
   отсутствует/≤0 → вернуть shape-полный `NEPOČÍTÁNO`-`PlannerOutput` с `warnings:['ℹ️ objem nezadán →
   NEPOČÍTÁNO']` (семантика `project-planner`), а не ждать throw ниже. Покрывает non-prismatic-no-volume.
3. **`mostovkova_deska` без height:** оставить honest-blank, но не подставлять слэб-систему молча —
   пометить «Podpěry: zadejte výšku» (уже есть паттерн v4.19 D1).

**Критерии готовности:** все 24 типа на минимальном вводе (type+volume+concrete) возвращают план ИЛИ
честный `NEPOČÍTÁNO`, **0 необработанных throw**. `pytest tests/test_mcp_compatibility.py` зелёный.

---

## 2. РЕЗУЛЬТАТ → ФРОНТ → ТОВ (проблема 1: «не переносится в ТОВ»)

### Как должно работать
Таблица «Vypočítat» открывает `/planner` с `bridge_id`+`position_id`+sibling-ids → расчёт → «Aplikovat»
(`handleApplyToPosition` → `applyPlanToPositions`) превращает `buildLaborProjection(plan)` в драфты по
профессиям → `beton` в главную позицию (PUT), остальные в sibling-id или авто-создаёт новый (POST),
каждый несёт `tov_entries` в `metadata` → бэк персистит → рефетч → `FlatTOVSection` рисует ТОВ.

### Где ломается (root causes)
- **🔴 RC1 — «тихий успех».** Вся запись зашита за `if (position_id && bridgeId)`
  (`useCalculator.ts:1470-1481`). Portal/Registry открывает калькулятор с `project_id`/`portal_project`,
  но **без `position_id`** → код проваливается мимо записи прямо в `setApplyStatus('saved')` →
  UI пишет **«Uloženo», строк ноль**. Это и есть баг «не переносится».
- **🔴 RC2 — кросс-kiosk id не форвардятся.** `handleCalculate` (`FlatPositionsTable.tsx:210-227`) кладёт
  в URL `bridge_id`/`position_id`/`otskp_code`, но НЕ `portal_project_id`/`registry_project_id` → dedupe
  в `positions.js:242` не может сматчить.
- **🟠 RC3 — PUT затирает `metadata` целиком** (`applyPlanToPositions.ts:496-536`; бэк `SET metadata=?`
  `positions.js:461`) → уничтожает импортные `linked_positions` + `is_monolith_override`.
- **🟡 RC4 (suspected):** NaN `qty` на авто-siblings при пустой площади (`applyPlanToPositions.ts:392`) —
  косметика (NaN проходит `typeof==='number'`).
- Исключены как причины: маппинг projection→draft ключей корректен; read-back сохраняет `metadata`
  (`calculatePositionFields` спредит `...position`).

### Фикс
1. `useCalculator.ts:1470` — когда `positionContext` есть, но нет `position_id`/`bridgeId`: НЕ рапортовать
   `saved`; резолвить beton-позицию из `project_id` перед записью ИЛИ явная ошибка/disabled.
2. `FlatPositionsTable.handleCalculate` — форвардить `portal_project_id`/`registry_project_id` в URL.
3. `applyPlanToPositions.ts:496` — read-merge существующего `metadata` (спред старого + overlay нового),
   не replace.
4. `Number.isFinite`-коэрция `qty` перед POST.

**Критерии готовности:** расчёт → Aplikovat → ТОВ показывает записи и из **native**, и из **Portal/Registry**
входа; бейджи `linked_positions` не исчезают; ложного «Uloženo» без записи нет.

---

## 3. ПЕРСИСТЕНТНОСТЬ ПРОЕКТОВ (проблема 2: «создаются, но не читаются») + КРОСС-СИНК

> Два независимых трассировщика (персистентность + кросс-синк) сошлись на одной причине — высокая уверенность.

### Registry работает (эталон) — почему
1 таблица `registry_projects`, 1 ключ (`project_id` = localStorage id и на запись, и на чтение), **всегда
authed** (`owner_id = req.user.userId`, non-nullable), **UPSERT** `ON CONFLICT (project_id) DO UPDATE`
(`server.js:234`), read `WHERE owner_id=$1` (`server.js:216`). Один путь, один ключ, один owner.

### Monolit ломается — почему
- **🔴 RC1 — XLSX-загрузка пишет `portal_user_id = NULL`** (`upload.js:234,320`, `owner_id` хардкод 1), а
  авторизованный список фильтрует `WHERE portal_user_id = userId` (`monolith-projects.js:63-69`, без
  `OR IS NULL`) → NULL ≠ userId → проект невидим.
- **🔴 RC2 — «Aplikovat»/`POST /api/positions` авто-создаёт только строку `bridges`** (`positions.js:273-307`),
  а список читает **только** `monolith_projects` (`api.ts:125` → `monolith-projects.js:55`). Heal
  односторонний: GET positions создаёт bridges из monolith_projects, но обратно — нет. Проект живёт в
  `bridges`+`positions` без строки-списка → невидим навсегда.
- **🔴 RC3 — split-brain owner.** `positions.js` вообще без auth-middleware (и `applyPlanToPositions.ts:559,586`
  шлёт raw-fetch **без токена**) → bridges-строки без owner. authed/anon переключение (`=userId` vs `IS NULL`)
  перекидывает видимость при логине/разлогине.

### Фикс — зеркалим паттерн Registry (3 правки, без новых таблиц)
1. `positions.js` — добавить `optionalAuth`; на ветке авто-создания UPSERT-ить `monolith_projects`
   (`INSERT ... ON CONFLICT (project_id) DO UPDATE`) с тем же `project_id` и `portal_user_id`.
2. `applyPlanToPositions.ts:559,586` — добавить `Authorization: Bearer <auth_token>` (источник `api.ts:64`).
3. `monolith-projects.js` GET (`:63-69`) — для authed вернуть `portal_user_id = $1 OR IS NULL` (adopt-on-read).
4. `upload.js:234,320` — штамповать `portal_user_id = req.user?.userId ?? null` (добавить `optionalAuth`;
   Registry-импорт уже делает это верно, `import-from-registry.js:344`).

**Критерии готовности:** проект, созданный через upload И через Aplikovat, появляется в списке после
перезагрузки; не пропадает при логине/разлогине.

> Побочно: `integration.js` `items_imported = total − updated` (`:1015,1023`) на ре-синке даёт 0, хотя
> данные записаны (все идут в UPDATE) — вводящий в заблуждение счётчик, не потеря данных. Косметика.

---

## 4. MCP-КОННЕКТОРЫ ↔ ОРКЕСТРАТОР («тот же движок через MCP»)

### Где расходится
- **🔴 `calculate_concrete_works` пробрасывает ~25 из ~90 полей `PlannerInput`** (`calculator.py`,
  signature `:318`). Молча теряются и меняют результат: бригады/смены (→ график всегда «1 бригада»),
  `resource_ceiling`/`deadline` (вся фича невидима через MCP), pour-mode/дилатации/такты, точная
  арматура/диаметр, предпряжение (только boolean → generic 11 дн), **пилота: `pile_length_m` роняется в
  `height_m` → длина сваи всегда дефолт 10 м**.
- **🔴 `classify_construction_element` — Python-переписка, НЕ делегирует** движку; готовый
  `delegate_classify` (`monolit_delegate.py:217`) — мёртвый код; отдельная ручная копия `ELEMENT_TYPES`
  (`classifier.py:27`) → риск дрейфа с `ELEMENT_CATALOG` движка.
- **🟠 `get_construction_advisor` внутренне противоречив** — свои эвристики (`tacts=ceil(h/3)`, crew=12,
  `_formwork_advice`) спорят со встроенным результатом движка в том же ответе.
- Ошибки движка (класс rebar=0) MCP пробрасывает **чисто** как typed error — но клиент получает не
  `NEPOČÍTÁNO`, а 500/tool-error (частый реальный кейс: `podkladni_beton` C12/15 blinding).
- **compat-тест гоняет replay-фикстуры, живой движок не трогает** → дивергенция в CI не ловится.

### Фикс
1. Делегировать `classify` на `POST /api/classify` (оживить `delegate_classify`) — убить двойной
   `ELEMENT_TYPES`; или генерить его из той же KB.
2. Выставить schedule-параметры на `calculate_concrete_works` (crews/shift/working_joints/дилатации/
   ceiling/deadline); починить пилоту (`pile_length_m` + casing/rebar/cap вместо утечки в height).
3. Advisor — выводить formwork/tacts/crew ИЗ результата движка (или убрать эти поля).
4. Compat-тест: живой вызов движка + пилота + error-propagation (500→engine_error) + parity
   classify(MCP)≡classifyElement(engine) + advisor-tacts≡engine-tacts.
5. После фикса #1 движка (rebar=0) — MCP автоматически начнёт отдавать план на `podkladni_beton`.

**Критерии готовности:** MCP-результат == UI-результат на репрезентативных элементах; нет пропавших
параметров, меняющих график; classify через MCP == через движок.

---

## 5. АДМИНКА (проблема 4: «не закончена»)

Реально **почти вся готова**: `admin.js` (918 стр.) + `AdminDashboard.tsx` (9 вкладок: users/credits/
flags/audit/antifraud/usage/pipeline) — рабочие и `adminOnly`-защищённые. «Data Pipeline admin» из
root CLAUDE.md — реален (3-step URS-прокси + Methvin norms).

### Реально не закончено
| Пункт | Статус | file:line | Что доделать |
|---|---|---|---|
| URS `/api/settings/model` | ❌ без auth | `URS app.js:162`, `routes/settings.js` | аноним меняет прод-LLM/читает конфиг → admin-guard или только через Portal-прокси |
| `DISABLE_AUTH` mock-admin | ❌ риск | `portal auth.js:24-36` | при `=true` на Cloud Run всё становится `userId:1, admin` → залочить только non-prod, проверить прод-env |
| NKB download pipeline | 🟡 stub | `NKBAdminPage.tsx:927,941` | `alert('...download pipeline')`; поиск норм находит, но не качает → harvest→GCS endpoint + кнопка |
| CORE results viewer | 🟡 stub | `CorePanel.tsx:804` | `alert('TODO: zobrazit výsledky')` → модалка результата по `core_project_id` |
| `/admin` route-guard | 🟡 | `App.tsx:143` | обычный `ProtectedRoute` (auth-only); бэк защищает, но добавить admin-aware guard (defense-in-depth) |

**Критерии готовности:** каждая admin-кнопка функциональна; нет анонимной смены модели; mock-admin
недоступен в проде.

---

## 6. СКВОЗНАЯ БЕЗОПАСНОСТЬ (из полного аудита — общий блокер публичного запуска)

Не в трёх названных проблемах, но лежит на том же потоке данных и всплывает при фиксе §2–§3:
- Неавторизованные роуты: Portal `/api/pump/*`, `/api/parse-preview/import` (hardcoded `owner_id=1`),
  `/api/kb/research`; Monolit `positions.js`+`planner-variants.js`; URS без auth; Registry
  `DELETE /cleanup-empty` (удаляет чужое за секретом в коде).
- Fail-open: `JWT_SECRET || 'dev-secret'`, `SERVICE_API_KEY` unset → пускает всех; биллинг на анонимных POST.
- Лендинг обещает «každý uživatel vidí pouze své projekty» — фикс §3 (owner-scoping) как раз это чинит.

Часть закрывается попутно фиксом §3 (positions.js получает auth). Остальное — отдельный security-проход.

---

## 7. ПЛАН РАБОТОСПОСОБНОСТИ (по приоритету и зависимостям)

Каждый спринт — отдельная ветка `claude/...`, SDD (recon есть → spec при желании → код → тесты →
`docs/soul.md §9`). После движка/MCP — обязательно `pytest test_mcp_compatibility.py`.

### Спринт 1 — Движок считает ВСЕ элементы без падений  *(ядро «считал без ошибок»)*
`rebar-lite` zero-short-circuit · `planElement` volume-guard→NEPOČÍTÁNO · mostovka-no-height честно ·
снять golden-хак `rebar_mass_kg:1` · MCP-compat.
→ **AC:** 24/24 типа не падают на минимальном вводе; `podkladni_beton` даёт план с rebar=0.

### Спринт 2 — Данные не теряются  *(ядро «работал» + обе названные фронт-проблемы)*
Калькулятор→ТОВ (RC1 тихий успех, RC2 id-форвард, RC3 metadata-merge) + Персистентность/синк (positions
optionalAuth+UPSERT monolith_projects, applyPlanToPositions Bearer, GET `=$1 OR IS NULL`, upload owner).
→ **AC:** проект виден после reload; расчёт→ТОВ переносит из native и Portal; нет ложного «Uloženo».

### Спринт 3 — Понятность  *(ядро «понятен»)*
`warnings_structured` severity (⛔/⚠️/ℹ️) + UI-рендер + «Pokračovat přesto» · честный `NEPOČÍTÁNO` в
итогах · оживить/убрать мёртвое поле `rebar_norm_kg_m3` · чешские actionable-сообщения вместо сырых
англ. throw.
→ **AC:** критичное отличимо от инфо; редактируемые поля влияют на расчёт; сообщения по-чешски и по делу.

### Спринт 4 — MCP верен движку  *(ядро «MCP коннекторы»)*
Делегировать classify · выставить schedule/pour/rebar/prestress/pile-параметры · пилота `pile_length_m` ·
advisor из движка · compat-тест на живой движок + parity.
→ **AC:** MCP-результат == UI на репрезентативных типах; нет дропнутых параметров графика.

### Спринт 5 — Админка + безопасность  *(ядро «админ часть» + shippability)*
URS settings auth · NKB download · CORE results viewer · `DISABLE_AUTH` лок · неавторизованные роуты ·
fail-closed `JWT_SECRET`/`SERVICE_API_KEY`.
→ **AC:** admin-действия рабочие; нет анонимной записи/смены модели; изоляция держится (лендинг правдив).

### Последовательность и зависимости
1 → 2 (движок должен считать до того, как переносить результат) → 3 (ясность поверх верного расчёта) →
4 (MCP наследует фиксы 1) → 5 (безопасность частично падает из 2, добить отдельно).
Спринт 2 закрывает обе названные пользователем фронт-проблемы и попутно часть §6.

---

## 8. Реестр находок (быстрый индекс file:line)

| # | Находка | Файл:строка | Спринт |
|---|---|---|---|
| E1 | podkladni_beton rebar=0 throw | `rebar.ts:35`, `rebar-lite.ts:119`, classifier:547 | 1 |
| E2 | non-prismatic без объёма → throw | `element-geometry.ts:22`, `orch:876` | 1 |
| E3 | mostovka без height → неверная опалубка | `orch` estimateFormworkArea | 1 |
| T1 | Калькулятор→ТОВ тихий успех | `useCalculator.ts:1470-1481` | 2 |
| T2 | кросс-kiosk id не форвардятся | `FlatPositionsTable.tsx:210-227` | 2 |
| T3 | metadata затирается | `applyPlanToPositions.ts:496-536`, `positions.js:461` | 2 |
| P1 | upload пишет NULL owner | `upload.js:234,320` | 2 |
| P2 | Aplikovat пишет только bridges | `positions.js:273-307` | 2 |
| P3 | authed/anon split-brain | `monolith-projects.js:63-69` | 2 |
| P4 | applyPlan без токена | `applyPlanToPositions.ts:559,586` | 2 |
| M1 | 25/90 параметров MCP | `calculator.py:318` | 4 |
| M2 | classify не делегирует | `classifier.py:27`, `monolit_delegate.py:217` | 4 |
| M3 | pile_length теряется | `calculator.py` payload | 4 |
| M4 | advisor самопротиворечив | `advisor.py:147` | 4 |
| M5 | compat-тест на replay | `tests/test_mcp_compatibility.py` | 4 |
| A1 | URS settings без auth | `URS app.js:162` | 5 |
| A2 | DISABLE_AUTH mock-admin | `portal auth.js:24-36` | 5 |
| A3 | NKB download stub | `NKBAdminPage.tsx:927,941` | 5 |
| A4 | CORE results stub | `CorePanel.tsx:804` | 5 |
| S1..n | неавторизованные роуты / fail-open | см. §6 + аудит | 5 |

---

**Bottom line:** математика верна; чинить нужно **поток данных**, не движок. 2 названные фронт-проблемы
и «проекты не читаются» — один корень (ключ/owner/таблица расходятся между записью и чтением), лечится
зеркалированием рабочего паттерна Registry. Движок падает ровно на одном легитимном вводе — точечный
zero-short-circuit. Админка почти готова. Порядок: Движок → Данные → Ясность → MCP → Админка+Безопасность.
