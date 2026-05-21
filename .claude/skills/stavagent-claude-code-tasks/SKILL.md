---
name: stavagent-claude-code-tasks
description: >-
  Правила написания заданий для Claude Code на проекте STAVAGENT. Использовать
  ВСЕГДА когда речь идёт о: создании spec/task/bug файла, structuring
  requirements/design/tasks, formulating acceptance criteria, naming files
  или таблиц в спецификации, проверке универсальности по разделам D.1.2 /
  D.1.3 / D.1.4, audit-first discipline, EARS-style acceptance criteria.
  Активировать при словах: задание, task, spec, requirements, design,
  acceptance, criteria, naming, EARS, universalita, обор, профессия, D.1.2,
  D.1.3, D.1.4, audit-first, PRE-IMPLEMENTATION INTERVIEW.
---

# STAVAGENT — Claude Code Task Writing Rules

## Цель

Эти правила — **как Alexander пишет задания для Claude Code**. Они
гарантируют что:
- Claude Code сам определяет naming из существующих конвенций репо
- Не возникают parallel structures (новая папка рядом со старой)
- Acceptance criteria — testable, не absolutionные
- Универсальность по разделам D.1.2 / D.1.3 / D.1.4 встроена

Источник: codified из `docs/steering/conventions.md` §9 + workflow
experience через 60+ tasks.

---

## CRITICAL RULE

> **Никогда не указывай конкретные имена** променных, файлов, классов,
> таблиц, endpoint'ов в задании.

Claude Code прочитает репо, найдёт существующие конвенции, и сам
определит naming. Если ты укажешь имя — он создаст parallel structure
("оп" `xlsx_komplet` существует, но я пишу `xlsx-komplet-parser` потому
что в задании так").

---

## Структура задания

### Обязательные секции

```
1. Mantra
   "Read entire repo first → derive naming → then write"
   (одна строка, не larger)

2. Контекст
   - Что уже существует в репо
   - Что породило задание (bug? new feature? cleanup?)
   - Какие docs/specs/audit findings релевантны

3. Бизнес-задача (plain language)
   - Что должно произойти с точки зрения пользователя
   - Без указания implementation details

4. Domain rules (если применимо)
   - Конкретные правила из docs/steering/domain.md
   - ČSN normy, OTSKP rules, confidence ladder
   - Скруж terminology, lateral pressure formula, etc.

5. PRE-IMPLEMENTATION INTERVIEW
   - 5-7 вопросов через AskUserQuestion
   - До написания первого commit'a
   - Например: "Какой существующий парсер расширить vs создать новый?"

6. Acceptance criteria (numbered, EARS-style)
   - "WHEN <condition> THE SYSTEM SHALL <action>"
   - Testable, не absolutionные
   - Range-based для калькулятора (±10-15%, ne exact match)

7. Out of scope
   - Что НЕ делать в этой session
   - Что отложено на follow-up task

8. Naming rule
   "Naming a strukturu souborů určuj podle existujících konvencí
    v repo. Pokud existuje alternativní path — použij existující,
    ne create parallel."
```

---

## Что НЕЛЬЗЯ писать в задании

```
❌ "Vytvoř soubor app/services/cross_validator.py"
❌ "Tabulka portal_documents s poli id UUID, project_id UUID..."
❌ "Třída SaveDocumentRequest(BaseModel) s poli..."
❌ "Funkce def extract_facts_from_summary(summary: dict) -> list"
❌ "Proměnná CONFIDENCE_MAP = {regex: 1.0, gemini: 0.7}"
❌ "Endpoint @router.post('/project/{id}/save-document')"
❌ "Pridaj column rebar_diameter_mm do tabuľky planner_variants"
```

## Что НУЖНО писать вместо этого

```
✅ "Výsledek analýzy se má ukládat v PostgreSQL přivázaný k projektu"
✅ "Při opakovaném nahrání téhož souboru — ukázat co se změnilo"
✅ "Porovnat extrahované fakty nového dokumentu se všemi existujícími"
✅ "Vybavení se porovnává podle kódu (prvních 6+ znaků) a množství"
✅ "Matice pokrytí: jaké typy dokumentů jsou, jaké chybí"
✅ "Zmíněné, ale nenahrané dokumenty → seznam chybějících"
✅ "Калькулятор должен учитывать диаметр выпуска при оценке часов на тонну"
```

---

## Универсальность по разделам

Любой task должен работать для **ВСЕХ** строительных оборов, не
только для бетонажа:

| Раздел | Обор | Key parameters |
|---|---|---|
| D.1.1 | Architecture | dispozice, plochy, světlé výšky |
| D.1.2 | Statika | beton C../.., výztuž B500, zatížení kN/m² |
| D.1.3 | PBŘS | požární úseky, SPB, EPS, SHZ, ZOKT |
| D.1.4 | Silnoproud | kW, kVA, kabely, rozvaděče, IP, střídače |
| D.1.4 | Slaboproud | EPS, kamery, UTP/FTP, detektory |
| D.1.4 | ZTI | DN potrubí, průtoky l/s, tlaky, čerpadla |
| D.1.4 | VZT | průtoky m³/h, Pa, teplota, VZT jednotky |
| D.1.4 | ÚT | tepelné výkony kW, kotle, radiátory |
| D.1.4 | Plynovod | DN, tlak kPa, HUP, spotřebiče |
| D.1.4 | MaR | čidla, regulátory, BMS |
| C | Geologie | vrstvy, HPV, Rdt kPa, radon, XA |
| C | Geodézie | souřadnice, výšky, parcely |

**В задании пиши:**
> "Парсер должен работать для всех разделов D.1.2 / D.1.3 / D.1.4,
> не только для разделу X. Каждый обор имеет свои ключевые параметры
> (см. docs/steering/conventions.md §10)."

---

## Cross-domain связи

Tasks должны учитывать связи между разделами:

| От | К | Что связывает |
|---|---|---|
| D.1.4 Silnoproud | D.1.1 Architecture | rozvaděč na ploše, kabelové trasy |
| D.1.4 ZTI | D.1.2 Statika | průrazy do nosných stěn, kotvy |
| D.1.3 PBŘS | D.1.4 Silnoproud | EPS provozované z UPS, kabeláž E30/E60 |
| D.1.2 Statika | C Geologie | Rdt pre dimensioning, HPV pro hydroizolaci |

**В задании:**
> "Если новый document содержит mentions kabelů E30/E60, проверь
> наличие odpovídajícího PBŘS dokumentu."

---

## Acceptance criteria — EARS-style

### Plain (event-driven)
```
WHEN [event] THE SYSTEM SHALL [response]
```
Пример: *WHEN user uploads новый PDF THE SYSTEM SHALL extract facts
within 30s.*

### State-driven
```
WHILE [state] THE SYSTEM SHALL [response]
```
Пример: *WHILE document processing THE SYSTEM SHALL show progress bar.*

### Unwanted behavior
```
IF [unwanted condition] THEN THE SYSTEM SHALL [mitigation]
```
Пример: *IF confidence < 0.7 THEN THE SYSTEM SHALL flag for manual review.*

### Optional feature
```
WHERE [feature enabled] THE SYSTEM SHALL [response]
```

**Anti-pattern (absolutionные):**
```
❌ "Калькулятор должен вернуть точно 1 234 567 Kč"
❌ "Парсер должен извлекать 100% параметров"
❌ "Time to result < 5 секунд всегда"
```

**Best practice (range-based):**
```
✅ "Калькулятор должен вернуть значение в диапазоне ±15% от reference"
✅ "Парсер должен извлекать >80% параметров для D.1.2 + >70% для D.1.4"
✅ "P95 latency < 10s, P99 < 30s"
```

---

## Audit-first discipline

> **Перед изменениями всегда инвентаризация.**

Задание должно явно требовать audit phase:

```markdown
## Phase A — Audit (read-only, 15-30 min)

1. Read [конкретные модули из репо]
2. Inventory [конкретные patterns]
3. Output: audit report как plain text or `analyze.md` (для багов)

**STOP** здесь и жди user confirmation перед Phase B.
```

Для багов — output `analyze.md` в `docs/bugs/{bug-id}/`.
Для feature — секция Audit в `docs/specs/{name}/design.md`.

---

## Файловая структура заданий

```
docs/
├── specs/
│   └── {feature-name}/         <- новая feature
│       ├── requirements.md     <- WHO + WHY + business rules
│       ├── design.md           <- HOW + audit + architecture
│       └── tasks.md            <- WHAT + acceptance + gates
│
├── bugs/
│   └── {bug-id}/              <- bug fix
│       ├── report.md          <- симптомы, repro steps
│       ├── analyze.md         <- audit, root cause
│       ├── fix.md             <- fix description
│       └── verify.md          <- post-deploy verification
│
└── tasks/
    └── TASK_*.md              <- legacy single-file tasks (deprecated for new work)
```

**Templates:** `docs/templates/_TEMPLATE_spec/` + `docs/templates/_TEMPLATE_bug/`

---

## Infrastructure context (для tasks)

Когда задание касается deploy / infrastructure, всегда указывай:

| Service | Где живёт | Port |
|---|---|---|
| concrete-agent (CORE) | Cloud Run europe-west3 | 8000 |
| stavagent-portal | Cloud Run europe-west3 + Vercel | 3001 |
| Monolit-Planner | Cloud Run + Vercel | 3001/5173 |
| URS_MATCHER_SERVICE | Cloud Run + Vercel | 3001 |
| rozpocet-registry | Vercel serverless | 5173 |
| MinerU | Cloud Run europe-west1 | 8080 |
| DB | Cloud SQL PostgreSQL 15 | — |
| LLM | Vertex AI (primary), Bedrock (fallback), Perplexity (norms) | — |
| Billing | Lemon Squeezy | — |

**Render НЕ используется.** Не пиши "deploy to Render" в задании.

---

## Gates & granularity

```
Gate 0: Audit (read-only) → commit "AUDIT: phase A complete"
Gate 1: Architecture (no code) → commit "DESIGN: ADR-NNN decision"
Gate 2: Foundation (types, schemas) → commit "FEAT: ..."
Gate 3: Implementation per module → один commit per module
Gate 4: Tests → "TEST: ..."
Gate 5: Documentation → "DOCS: update soul.md §9"
```

**Branch protection:** `main` is protected. **No-PR-unless-asked:**
push to origin branch (`claude/<task>-<5chars>`), PR создаётся только
по explicit user request.

---

## Communication style в заданиях

- **Russian** для разговорных частей задания
- **Czech** для domain terminology (ČSN, OTSKP, TKP, přípravář)
- **English** для code references, commits, file names
- **ALL CAPS** = акцент (sparingly)
- **Numbered options** для quick decisions

---

## Что НЕ дисциплина в задании

- ✅ Не указывай свою предпочтительную IDE / shell
- ✅ Не указывай format commits если не отличается от стандарта
  (`FEAT:`, `FIX:`, `REFACTOR:` etc. — уже в `CLAUDE.md`)
- ✅ Не повторяй mantra полностью в каждом задании — referencе
  на skill или conventions.md достаточно

---

## Reference docs

- `docs/steering/conventions.md` §9 — Task structure (canonical source)
- `docs/steering/conventions.md` §10 — Universalita po profesí
- `docs/steering/conventions.md` §11 — Hybrid online/offline workflow
- `docs/steering/domain.md` — Domain rules (calculator, ČSN, OTSKP)
- `docs/templates/_TEMPLATE_spec/` — Spec template (3 files)
- `docs/templates/_TEMPLATE_bug/` — Bug template (4 files)

---

**Author:** Codified from `docs/steering/conventions.md` §9, 2026-05-20.
