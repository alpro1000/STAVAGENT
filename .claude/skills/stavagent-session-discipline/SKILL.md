---
name: stavagent-session-discipline
description: >-
  Правила дисциплины Alexandra при работе с Claude Code на проекте STAVAGENT.
  Использовать ВСЕГДА когда речь идёт о: запуске Claude Code session, проверке
  результатов session, обновлении soul.md или steering docs, sync с Project
  Knowledge на claude.ai, branch naming для Vercel safety, production safety
  windows перед Google review или Cemex demo. Активировать при словах:
  Claude Code session, перед сессией, после сессии, session log, soul.md,
  steering, sync project knowledge, claude branch, Vercel overage, production
  safety, next-session.md, handoff, мантра, дисциплина.
---

# STAVAGENT — Session Discipline для Claude Code

## Цель

Эти 8 правил — **действия Alexandra**, не Claude Code. Они гарантируют что:
- Claude Code не сбивается с мантры
- Knowledge state (soul.md, steering/*) остаётся актуальным
- Online (claude.ai) и offline (Claude Code) видят одно и то же
- Vercel overage prevention соблюдается
- Production не страдает во время критических окон

---

## 8 правил

### 1. Pre-session — wait for mantra acknowledgment

**Действие:** Жди первых 5 tool calls Claude Code или 3 минуты. Проверь что
он упомянул: `Session Mantra`, `KNOWLEDGE_PLACEMENT_GUIDE`,
`existing conventions`, `read repo first`, или эквивалент.

**Триггер для остановки:** Если Claude Code начал писать код БЕЗ
прочтения мантры — останови:

> Остановись. Прочитай docs/STAVAGENT_ClaudeCode_Session_Mantra.md и
> CLAUDE.md. Не пиши код пока не сделал Phase A audit.

**Не делать:** Не вмешиваться если он читает файлы первые минуты —
это правильно, даже если кажется медленным.

---

### 2. Post-session — verify soul.md §9 update

**Триггер "существенная session":** одно из:
- Phase завершена (Phase A → Phase B и т.д.)
- >30 минут активной работы
- Merged PR или подготовлен PR
- >5 файлов изменено
- Architectural decision сделан

**Действие:** Проверь `docs/soul.md` §9 (Session log). Должна быть
запись с датой, что сделано, что blocked, что next.

**Если забыл:**
> Update docs/soul.md §9 with this session log. Include: date,
> what was completed, blockers encountered, next steps.

**Опускать можно когда:** session был только exploration или
discussion без artifacts.

---

### 3. Post-session — verify next-session.md handoff

**Действие:** В корне репо должен быть `next-session.md` с:
- Current branch + commit
- Что сделано в этой session
- Что не закончено (in-progress files)
- Next session priorities
- Open questions for user

**Если забыл:**
> Update next-session.md with current state, in-progress work,
> blockers, and next session priorities.

---

### 4. Architectural decisions → update steering/*

**Триггеры:**
- Новый AI provider добавлен (Vertex AI, Bedrock, Perplexity, etc.)
- Новая база данных или storage
- Изменение Core ↔ Kiosks pattern
- Новый MCP server endpoint pattern
- Изменение auth/billing flow

**Действие:** Обнови `docs/steering/tech.md` или `docs/steering/structure.md`
с decision + rationale + date.

**Когда:** В той же session где принято решение, не "потом".

**Не делать:** Не versioning steering docs на каждое мелкое изменение.
Только major rewrites.

---

### 5. New project/case → update soul.md §2

**Триггеры:**
- Новый freelance проект (Libuše B/C/D, новая стройка)
- Новый KB source (учебник, norma, vendor catalog)
- Новый corpus добавлен в GCS bucket

**Действие:**
- soul.md §2.3 — Active freelance: add project name, deadline, status
- soul.md §2.4 — KB sources: add source name, path, priority

**Скорость:** 1 минута через web UI claude.ai (быстрее чем dedicated
Claude Code session).

---

### 6. Branch hygiene — `claude/` prefix mandatory

**Why:** Vercel Preview deploys триггеруются всеми branches кроме
prefixed. Support ticket #01122309.

**Действие:** Все Claude Code branches MUST использовать `claude/` prefix:
- ✅ `claude/rimsa-calibration-phase-a`
- ✅ `claude/mcp-composable-agent-p0`
- ❌ `rimsa-fix` (создаст Vercel Preview → overage)

**Если видишь без префикса в push:**
> Rename this branch to `claude/...` prefix before push.
> Why: Vercel overage prevention (ticket #01122309).

---

### 7. Sync to Project Knowledge weekly

**Why:** claude.ai online (web UI) не видит local repo. Только
Project Knowledge.

**Действие:** Раз в неделю ИЛИ после major update `soul.md` /
`steering/*` / `STAVAGENT_PATTERNS.md`:

1. Открыть Project Knowledge в claude.ai
2. Удалить старые версии этих файлов
3. Upload новые версии

**Critical files для sync:**
- `docs/soul.md`
- `docs/steering/tech.md`
- `docs/steering/structure.md`
- `docs/steering/conventions.md`
- `docs/steering/domain.md`
- `docs/steering/product.md`
- `docs/STAVAGENT_PATTERNS.md`
- `CLAUDE.md` (root)
- `docs/KNOWLEDGE_PLACEMENT_GUIDE.md`
- `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`

**Не sync:** code files, test files, tasks (последние in-progress
не должны быть в PK иначе путаница со старыми версиями).

---

### 8. Production safety windows

**Don't run production-affecting Claude Code sessions during:**

| Window | Trigger | Allowed actions only |
|---|---|---|
| Google Cloud for Startups review | Active review period | Staging branches only |
| Pre-Cemex CSC demo | Last 7 dní before 28.06.2026 | No merges to main |
| Pre-Helsinki Pitch Day | Last 14 dní before 16.11 | Frozen production |
| Active payment webhook debug | Lemon Squeezy webhook issues open | No billing endpoint changes |

**В critical windows:** только `claude/staging-*` branches,
no production deploys.

**Action когда window активен:** Add prominent note в `next-session.md`:

```markdown
🚨 PRODUCTION FREEZE ACTIVE — Cemex CSC pre-demo window
Until 2026-06-28. No merges to main. Staging only.
```

---

## Что НЕ дисциплина (не заботься)

- ✅ Каждый commit → soul.md update — **НЕ нужен**
- ✅ Обновлять каждый task/spec по завершению — опционально (можно
  archive status header вверху файла)
- ✅ Versioning steering docs — только при major rewrite
- ✅ Code comments в каждом файле — не нужны (репо использует
  self-documenting naming)

---

## Quick reference — что проверить после session

```
[ ] Claude Code упомянул мантру в первых 5 tool calls?
[ ] docs/soul.md §9 обновлён? (если session существенная)
[ ] next-session.md обновлён?
[ ] Branch имеет claude/ prefix?
[ ] Steering docs обновлены? (если architectural decision)
[ ] Production freeze window соблюдён?
[ ] Sync to Project Knowledge запланирован? (если major update)
```

---

## Antipatterns — что НЕ делать

1. **"Я обновлю soul.md потом"** — потом = никогда. Update в той же session.
2. **"Это маленькое изменение, branch без префикса OK"** — нет.
   Vercel не знает что маленькое. Префикс mandatory.
3. **"Claude Code знает что делать"** — sometimes. Если в первых
   tool calls не читает мантру — он не знает.
4. **"Online версия claude.ai видит мой репо"** — НЕТ. Только PK.
5. **"Я sync Project Knowledge перед каждой online session"** —
   слишком часто. Раз в неделю достаточно.

---

**Author:** Alexandra discipline rules, 2026-05-20, codified from
direct workflow experience.
