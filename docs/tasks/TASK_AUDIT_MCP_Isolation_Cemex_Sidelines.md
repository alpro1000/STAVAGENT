# TASK: Pre-Cemex Audit — MCP / Cross-Isolation / Submission / Sidelines

## Мантра

Сначала ты читаешь весь репо `alpro1000/STAVAGENT` (включая Portal,
Registry, Monolit-Planner kiosks и Core Engine). НЕ доверяй
README, ARCHITECTURE.md, или комментариям в коде — они могут
отражать **видение**, а не **текущее состояние**.

Доверяй только:
- Endpoints которые реально отвечают
- Функциям с реализацией (не stub, не TODO)
- Тестам которые проходят
- Миграциям БД которые применены
- PR которые merged в `main`

Эта задача — **inventory audit**. Ты НЕ пишешь код, НЕ
исправляешь баги, НЕ делаешь рефакторинг. Ты производишь **один
markdown-документ** который честно отвечает на 4 моих вопроса
перед Cemex CSC submission.

PRE-IMPLEMENTATION INTERVIEW обязателен (3 вопроса в конце).

---

## КОНТЕКСТ

**Дата**: 2026-05-13.
**Cemex CSC 2026 deadline**: 2026-06-28 (~6.5 недель).
**Сегодня закрыто**: Landing v3 PR + CTA fix PR. Production
stavagent.cz verified в incognito. Google for Startups
re-application подал.

**Что меня сейчас блокирует от submission**: 4 направления, по
которым я не помню точное состояние:

1. **MCP server completion** — 9 tools planned (2 free + 7
   paid 1–20 credits), auth через `sk-stavagent-{hex48}`,
   OAuth 2.0 для ChatGPT.
2. **Cross-user isolation P0** — в моих заметках помечено как
   блокер перед Cemex. Подозреваю owner_id=1 проблему (58
   duplicate projects уже зафиксированы).
3. **Cemex submission package** — pitch deck EN, 60s demo
   video, MCP Claude Directory submission, Custom GPT.
4. **Sidelines** — Libuše Phase 7a Part 2 (deadline 11.05
   прошёл 2 дня назад!), Žihle 2062-1 (deadline 02.07.2026),
   Registry PR queue (PR-X3, PR-X6, PR 3/4/5).

Мне нужна **честная карта** что готово, что нет, и **какой
последовательностью** работать оставшиеся 6.5 недель.

---

## БИЗНЕС-ЗАДАЧА

Произвести **один markdown-документ** с 4 секциями (по одной на
каждый из моих вопросов). В каждой секции — inventory по 4-категорийной
классификации:

### Категория A: PRODUCTION (работает + tested)

- Имеет реализацию в коде (не stub, не TODO)
- Имеет tests которые проходят
- Endpoint/функция отвечает корректно (если применимо)
- Доступно из UI без error states (если применимо)

### Категория B: IMPLEMENTED but UNTESTED

- Имеет реализацию в коде
- НЕ имеет tests или tests skipped
- Behavior unverified (не было golden run)

### Категория C: SCAFFOLDED but NOT IMPLEMENTED

- Имеет declared interface / route / file / spec
- Содержит TODO, NotImplementedError, mock data, hardcoded
  response, или return placeholder
- Documentation говорит что есть, но код не делает

### Категория D: VISION / NOT EVEN SCAFFOLDED

- Упоминается только в README / памяти / задачах
- НЕ имеет code presence (ни stub, ни route, ни file)

---

## СЕКЦИЯ 1 — MCP SERVER COMPLETION

### Подвопросы

**1.1. Tool inventory.** Какие из 9 planned tools реально
существуют в коде? Для каждого:
- Имя и описание из mcp manifest / FastMCP registration
- Где реализация (file path, function name)
- Категория A/B/C/D с evidence
- Сколько credits стоит вызов (если paid)
- Free или paid (по моему плану: 2 free, 7 paid)
- Тесты — есть ли, проходят ли

**1.2. Authentication.** API key auth через формат
`sk-stavagent-{hex48}`:
- Есть ли generator (где создаётся ключ)?
- Есть ли validator / middleware (где проверяется на запросе)?
- Где хранятся ключи — DB таблица, колонки, hash или plain?
- Есть ли rate limiting per key?
- Есть ли revocation flow?

**1.3. OAuth 2.0 для ChatGPT.** Custom GPT в OpenAI требует
OAuth для авторизации:
- Есть ли endpoints `/authorize` и `/token`?
- Есть ли storage для authorization codes и access tokens?
- Есть ли redirect_uri whitelist?
- Какие scopes определены?
- Если есть скелет — что работает, что заглушка?

**1.4. Credit deduction.** Биллинг 1–20 credits на tool:
- Есть ли таблица tool→credits mapping?
- Есть ли atomic decrement (чтобы при concurrency не
  списать дважды)?
- Что происходит при недостатке credits — ошибка, очередь, free-tier?
- Связь с Lemon Squeezy webhook (`stavagent_lmsq_wh_2026`) —
  как credits начисляются после оплаты?

**1.5. Deployment.** Где задеплоен MCP server сейчас?
- Cloud Run service name?
- Какой URL endpoint (для Claude Directory submission)?
- Health check работает?

### Output для секции 1

Таблица 9 tools × {category, code path, test, credits, free/paid}
+ 4 подсекции (auth, OAuth, billing, deployment) с категорийной
классификацией каждого компонента.

---

## СЕКЦИЯ 2 — CROSS-USER ISOLATION P0

### Подвопросы

**2.1. Ownership model.** Какие таблицы имеют `owner_id` /
`user_id` колонку? Какие — нет? Конкретный список:
- Projects, project_documents, calculator_runs, registry items,
  norms, settings — что из этого изолировано, что shared.

**2.2. Endpoint enforcement.** Для каждого API endpoint в Portal,
Registry, Monolit, Core Engine — проверяется ли ownership перед
read/write? Найди дыры:
- Endpoints которые принимают `project_id` но не проверяют что
  он принадлежит current user
- Endpoints которые возвращают все проекты вместо фильтрации по owner
- Endpoints без auth middleware вообще

**2.3. Симптом owner_id=1 duplicates.** В моих заметках:
"58 duplicate projects с owner_id=1". Подтверди или опровергни:
- Что показывает SQL `SELECT owner_id, COUNT(*) FROM projects
  GROUP BY owner_id`?
- Связано ли это с отсутствием isolation (все падают на default
  owner_id=1) или с другой причиной (миграция, seed data)?

**2.4. Cross-kiosk auth.** Cookie / JWT propagation Portal ↔
Registry ↔ Monolit. Помнил `/api/portal-projects` возвращает 401
из-за SameSite cookie:
- Текущий статус (resolved/open)?
- Какое решение применено (если есть) — `api.stavagent.cz`
  custom domain, SameSite=None, или другое?

**2.5. E2E test для isolation.** Есть ли тест "User A не видит
проекты User B"? Проходит ли? Если нет — категория C/D, риск
для submission.

### Output для секции 2

- Таблица "таблицы БД × имеет owner_id × кто фильтрует" 
- Список endpoints с категорийной оценкой их enforcement
- SQL result owner_id distribution
- Текущий статус SameSite/cookie проблемы
- Рекомендация: сколько часов до зелёного E2E теста

---

## СЕКЦИЯ 3 — CEMEX SUBMISSION PACKAGE

### Подвопросы

**3.1. Pitch deck EN.** В репо или `outputs/` есть ли файлы:
- `.pptx` / `.pdf` pitch deck на английском?
- Скрипт презентации (speaker notes)?
- Категория готовности A/B/C/D?

**3.2. 60-секундный demo video.** Есть ли:
- Сценарий / storyboard?
- Записанный video файл (mp4/webm)?
- Subtitles EN?

**3.3. MCP Claude Directory submission.** Для подачи в
Anthropic MCP Directory нужно:
- Metadata: name, description, icon, examples
- Public URL endpoint
- OAuth manifest (если требуется)
- Документация для разработчиков
Найди что из этого готово, что черновик, что отсутствует.

**3.4. Custom GPT в OpenAI store.** Для публикации:
- Instructions / system prompt
- Conversation starters
- Knowledge files (если есть)
- Actions OpenAPI spec (для интеграции с STAVAGENT API)
Найди что готово.

**3.5. Pitch deck content alignment.** Положения которые
**должны** быть в deck (на основе моих заметок про differentiation):
- 7-engine calculator pipeline
- DIN 18218 + TKP18 + ÚRS + OTSKP + 23 element types
- Tender → Control → Execution в одном tool
- Monte Carlo + resource-constrained scheduling
- Производство бетонных работ niche

Для каждого пункта: упомянут в deck или нет?

### Output для секции 3

Чеклист из ~15-20 элементов submission package с категорийной
готовностью + estimated hours для каждого C/D элемента.

---

## СЕКЦИЯ 4 — SIDELINES STATUS

### Подвопросы

**4.1. Libuše Objekt D (deadline 2026-05-11 — ПРОСРОЧЕНО).**
В моих заметках:
- Repo: `alpro1000/STAVAGENT`, branch `claude/phase-0-5-batch-and-parser`
- Last completed: Phase 7a Part 1 (579 query groups для 2548 items)
- Next: Phase 7a Part 2 (URS_MATCHER 2-stage lookup) + Phase 8
  (Excel с List 11 summarization)

Проверь:
- Текущая HEAD branch — где остановлено?
- Что есть в outputs (excel файлы, JSON results)?
- Сдано ли клиенту (VELTON REAL ESTATE) или ещё нет?
- **Если deadline просрочен**: каковы реальные последствия — был
  ли communication с клиентом, есть ли grace period?

**4.2. Žihle 2062-1 (deadline 2026-07-02).** В моих заметках:
- Master soupis: 154 položek, 10.59M Kč bez DPH
- Status: `tender_ready`
- 6 SO (001/180/201/290/801/VRN)
- Phase D (если относится)

Проверь:
- Что осталось до tender submission?
- Phase D статус — Soupis + TZ generated или нет?
- Audit trail compliance (formula + inputs + steps + confidence) — есть?

**4.3. Registry PR queue.** Заметки:
- PR-X3: dedup-by-name + cleanup 58 duplicate projects
- PR-X4: Cloud Run min-instances=1 (deferred for financial)
- PR-X6: cross-kiosk tombstone awareness
- PR 3: Detail panel (L)
- PR 4: BulkActionsBar extension (S)
- PR 5: Click-cell-edit (S-M)
- Blocker: "production stable 2-3 days" — это выполнено?

Для каждого PR:
- Branch существует?
- Commits есть?
- PR open/draft/merged/closed?
- Можно ли разблокировать или есть зависимости?

**4.4. Open bugs.** Заметки:
- Poptávka cen modal: filter hides skupiny instead of filtering
  (`PriceRequestPanel.tsx`, ~2-3h)
- `/api/portal-projects` 401 SameSite cookie

Проверь — пофикшено или ещё открыто?

### Output для секции 4

Таблица "side project × current state × deadline × hours to
complete × приоритет vs Cemex" — чтобы я мог решить что
отрезать, что доделать, что reschedule с клиентом.

---

## ПРАВИЛА КЛАССИФИКАЦИИ (одинаковые для всех 4 секций)

Для каждой проверяемой единицы:

1. **Найти код** — file path + line range (если применимо)
2. **Проверить test coverage** — путь к тесту, проходит ли
3. **Проверить runtime** — endpoint отвечает / UI рендерит / миграция применена
4. **Сравнить с моим claim** — что я записывал в TASK/memories
5. **Классифицировать A/B/C/D**
6. **Note** — 1-2 строки наблюдения

Формат записи:

```
### Tool: bridges.generate_soupis
- **Category**: B (implemented, untested)
- **Code**: `core-backend/app/mcp/tools/bridges.py:78-145`
- **Test**: not found
- **Runtime**: not verified — Cloud Run service URL not deployed
- **Credits**: 10
- **My claim**: "9 MCP tools v1.0 ready"
- **Reality**: function implemented; no test; no deployed endpoint
- **Hours to A**: ~3h (write test + deploy + smoke)
```

---

## ФИНАЛЬНАЯ СЕКЦИЯ ОТЧЁТА

После 4 секций — **Critical Path Decision**:

1. **Summary tables** для каждой секции (счёт A/B/C/D)
2. **Total hours to Cemex-ready** — суммированный estimate
3. **Что отрезать** — что можно НЕ делать до 28.06 без вреда submission
4. **Sequencing recommendation** — порядок работы на 6.5 недель,
   приоритезированный по риску блокирования submission
5. **Hidden risks** — что я мог упустить в формулировке вопросов

Tone — engineer-honest. Не защищай мои заметки. Если 9 MCP tools
по факту 3 — пиши именно так. Если Libuše не сдан и клиент не
писал — пиши прямо. Если duplicate projects ничего не значат и
isolation работает — пиши.

---

## ЧТО НЕ ВХОДИТ

- НЕ исправлять найденные баги
- НЕ дописывать TODO до production
- НЕ обновлять README или memories
- НЕ предлагать architectural changes
- НЕ создавать новые ветки или PR
- НЕ переоценивать категорию A в B "на всякий случай"
- НЕ переоценивать категорию C в B из вежливости
- НЕ inventory'ить вещи не из 4 секций (например, не лезь в
  ÚRS Matcher internals, calculator engine кроме того что
  упомянуто в Cemex pitch alignment, NKB)

---

## PRE-IMPLEMENTATION INTERVIEW (3 вопроса)

Задай по одному, жди ответа.

**Q1.** Scope границы — `alpro1000/STAVAGENT` это monorepo с
Portal + Registry + Monolit + Core + MCP? Или MCP server в
отдельном репо? Подтверди что я должен проверять.

**Q2.** Runtime checks — могу ли я curl'ом стучать в production
Cloud Run endpoints (Portal API, MCP server если задеплоен)
для проверки 200/401/404? Или ограничиваться static analysis?

**Q3.** Output language — Russian (как обычно)? Документ будет
основой моего решения о порядке работы на 6.5 недель, поэтому
должен быть максимально читаем.

После 3 ответов — начинаешь работу.

---

## ACCEPTANCE CRITERIA

1. Один markdown-документ в `docs/audit/` (или эквивалентной
   локации по конвенциям репо)

2. Имя файла включает дату `2026_05_13` и сигнализирует pre-Cemex
   audit

3. 4 секции (MCP / Isolation / Submission / Sidelines) — каждая
   полная с подвопросами выше

4. Каждая единица классифицирована A/B/C/D с evidence (code path
   + test status + runtime check где применимо)

5. Никаких claim'ов без evidence. Если функция в моих memories
   но не в коде — категория D, без exception

6. Final Critical Path Decision с recommended sequencing
   на 6.5 недель

7. Объём 500–1000 строк — детально, без воды

---

## NAMING RULE

Naming документа, директорий, table headers — по существующим
конвенциям репо. Если паттерн `docs/audit/` уже есть (см.
TASK_Registry_Inventory_Audit — он создавал такую структуру) —
встраивайся туда. Если нет — выбери appropriate location и
обоснуй в первой строке документа.

Не создавай параллельную структуру. Встраивайся в существующий
код. Единственный новый файл — сам отчёт.
