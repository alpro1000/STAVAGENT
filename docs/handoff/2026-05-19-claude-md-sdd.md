# TASK: Update root CLAUDE.md — mandatory reading + discipline

**Datum:** 19.05.2026
**Created by:** Alexander (z online sessiony)
**Vykonává:** Claude Code (doma)

---

## 1. Mantra

```
1. Přečti aktuální /CLAUDE.md
2. Změny dělej minimální str_replace, NIKDY rewrite celého souboru
3. Zachovej všechny changelog entry beze změny
4. NEMĚŇ existující service descriptions, TODOs, Quick Debugging table
5. Bumpni Version + Last Updated v hlavičce
```

---

## 2. Kontext

CLAUDE.md je central reference pro každou Claude Code sessiona ve repu. Jeho velikost narostla na 700+ řádků (přes vlastní limit 300). Tento task **PŘIDÁVÁ** 2 malé bloky + opravuje 1 zastaralý link.

Cíl: integrovat new `docs/steering/*.md` + `docs/soul.md` strukturu do session-start workflow, aby každá nová Claude Code sessiona automaticky načetla canonical context.

---

## 3. Změny (3 targeted edits)

### 3.1 Edit 1: Přidat mandatory reading block

**Najít** řádek (přibližně 7. řádek souboru, hned za hlavičkou):
```markdown
**Repository:** STAVAGENT (Monorepo)

---

> **English TL;DR for external readers**
```

**Nahradit za:**
```markdown
**Repository:** STAVAGENT (Monorepo)

---

## 🚨 Mandatory reading at session start

Před JAKOUKOLIV prací přečti v tomto pořadí:

1. `docs/steering/conventions.md` — jak pracovat (mantra, naming, gates, communication)
2. `docs/steering/product.md` — co stavíme a pro koho
3. `docs/steering/tech.md` — stack, AI tier, infrastructure, MCP
4. `docs/steering/structure.md` — repo layout, kam co patří
5. `docs/steering/domain.md` — construction rules, OTSKP/ÚRS, skruž, rebar matrix
6. `docs/soul.md` — aktuální stav, recent decisions, session log

Pokud kterýkoliv soubor chybí nebo je outdated → **STOP** a informuj Alexandra.

Po session **POVINNĚ** přidej entry do `docs/soul.md` §9 (Session log):
```markdown
## YYYY-MM-DD — Session: {topic}
**Rozhodnuto:** ...
**Odmítnuto:** ...
**Otevřené otázky:** ...
**Co dál:** ...
```

---

> **English TL;DR for external readers**
```

### 3.2 Edit 2: Opravit zastaralý CALCULATOR_PHILOSOPHY.md link

**Najít** sekci `## 📐 Calculator Philosophy (POVINNÉ ČTENÍ)`, konkrétně řádek:
```markdown
**Před úpravou kalkulátoru, golden tests, acceptance criteria, nebo UI textů** — přečti:

```
docs/CALCULATOR_PHILOSOPHY.md
```
```

**Nahradit za:**
```markdown
**Před úpravou kalkulátoru, golden tests, acceptance criteria, nebo UI textů** — přečti:

```
docs/steering/domain.md §1 (Calculator philosophy)
```

> **Pozn.:** `docs/CALCULATOR_PHILOSOPHY.md` (root) + `docs/normy/navody/CALCULATOR_PHILOSOPHY.md` byly **deprecated** 2026-05-19 — obsah nyní v `docs/steering/domain.md` §1. Pokud najdeš starý link kdekoliv v repu, oprav na nový.
```

### 3.3 Edit 3: Přidat discipline block do Session Setup

**Najít** sekci `## Session Setup — Effort & Thinking`, konkrétně **konec sekce** (řádek před `**Key rules:**`):

```markdown
**Reference settings.json (user owns this file, не Claude Code):**
```json
{
  "effortLevel": "high",
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "400000"
  }
}
```
> ⚠️ Эти ключи не верифицированы против актуальной Claude Code docs — если харнес их игнорирует, проверь `/help` или попроси Claude настроить SessionStart hook вместо этого.

**Key rules:**
```

**Nahradit za** (zachovat existující obsah, přidat nový blok mezi `> ⚠️` poznámku a `**Key rules:**`):

```markdown
**Reference settings.json (user owns this file, не Claude Code):**
```json
{
  "effortLevel": "high",
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "400000"
  }
}
```
> ⚠️ Эти ключи не верифицированы против актуальной Claude Code docs — если харнес их игнорирует, проверь `/help` или попроси Claude настроить SessionStart hook вместо этого.

## 📋 Workflow discipline (Spec-Driven Development)

Tento repo používá SDD workflow s gibridním online/offline modelem:

| Kde | Co se dělá |
|---|---|
| claude.ai online (na práci) | Spec creation, planning, requirements, design |
| Claude Code (doma) | Implementation, tests, refactoring, bugs |
| Git repo | Bridge — všechny artefakty v `docs/` |

**Životní cyklus feature:**
1. Spec se vytvoří v `docs/specs/{feature-name}/{requirements,design,tasks}.md`
2. Claude Code implementuje podle `tasks.md` (Gates = commits)
3. Po dokončení → update `docs/soul.md` §9

**Životní cyklus bug:**
1. Bug se reportuje v `docs/bugs/{bug-id}/report.md`
2. Claude Code píše `analyze.md` → `fix.md`
3. Po deployi → `verify.md` + update `docs/soul.md` §9

**Update pravidla pro context docs:**

| Když | Co update |
|---|---|
| Architectural decision (new tool/DB/AI provider) | `docs/steering/tech.md` |
| Změna repo layoutu | `docs/steering/structure.md` |
| Doménové pravidlo (nová norma, terminologie) | `docs/steering/domain.md` |
| Workflow změna | `docs/steering/conventions.md` |
| Nový freelance / corpus case | `docs/soul.md` §2.3 nebo §2.4 |
| Po každé session | `docs/soul.md` §9 — Session log entry |

**Pravidla pro task writing:**
- ❌ NESPECIFIKUJ jména proměnných, souborů, tříd, tabulek
- ✅ Popisuj v termínech business logiky + architektury
- Claude Code odvodí naming z existujících konvencí v repu
- Detail v `docs/steering/conventions.md` §9

**Šablony pro nové specs/bugs:** `docs/templates/_TEMPLATE_spec/` + `docs/templates/_TEMPLATE_bug/`

---

**Key rules:**
```

---

## 4. Version bump

**Najít** řádek v hlavičce:
```markdown
**Version:** 4.31.0
**Last Updated:** 2026-05-18
```

**Nahradit za:**
```markdown
**Version:** 4.32.0
**Last Updated:** 2026-05-19
```

A přidat changelog entry do existujícího bloku changelog (jako nový `Changelog — v4.32.0` na začátek seznamu):

```markdown
> **Changelog — v4.32.0 (2026-05-19 — SDD workflow + steering integration):** Repo přijal Spec-Driven Development workflow s online claude.ai + Claude Code hybrid (firewall blokuje terminal na práci). Nový `docs/steering/` (5 canonical context souborů: product / tech / structure / domain / conventions) + `docs/soul.md` (living memory) + `docs/templates/` (3-file spec + 4-file bug šablony) + `docs/handoff/` (session snapshots) + `docs/audit_project_knowledge.md` (migration map). Mandatory reading block + workflow discipline pravidla přidána do tohoto CLAUDE.md (hlavička + Session Setup). `docs/CALCULATOR_PHILOSOPHY.md` (root) + `docs/normy/navody/CALCULATOR_PHILOSOPHY.md` deprecated → obsah nyní v `docs/steering/domain.md` §1. Cleanup orphaned root files (13 byte-identical duplicates `git rm`'d, 3 unique files moved from `data/peri-pdfs/` → `docs/reference/` + `scripts/` + `docs/specs/element/`, `data/` folder removed). N+1 corpus structure: `test-data/{project}/` pro RD_Jachymov_dum + SO_250 + hk212_hala + libuse + most-2062-1-zihle + most-litovel; `test-data/tz/` pro golden test markdownů; KB study material (Litovel diplomka — TKP 4 + ČSN 73 6244 + VL 4) marked separately v `soul.md` §2.4.
```

---

## 5. Acceptance criteria (EARS-style)

### 5.1 Krit. 1 — Mandatory reading block exists

> **When** Claude Code dokončí update
> **then** `CLAUDE.md` **shall** mít sekci `## 🚨 Mandatory reading at session start` mezi řádkem `**Repository:**` a `> **English TL;DR**`
> **Důkaz:** `grep -A 3 "Mandatory reading at session start" CLAUDE.md`

### 5.2 Krit. 2 — Old CALCULATOR_PHILOSOPHY link replaced

> **When** update hotov
> **then** `CLAUDE.md` **shall NOT** obsahovat `docs/CALCULATOR_PHILOSOPHY.md` jako aktivní reference
> **Důkaz:** `grep "docs/CALCULATOR_PHILOSOPHY.md" CLAUDE.md` vrací pouze zmínku v deprecation note

### 5.3 Krit. 3 — Discipline block exists

> **When** update hotov
> **then** `CLAUDE.md` **shall** mít sekci `## 📋 Workflow discipline (Spec-Driven Development)` před `**Key rules:**`
> **Důkaz:** `grep -A 5 "Workflow discipline" CLAUDE.md`

### 5.4 Krit. 4 — Version bumped

> **When** update hotov
> **then** hlavička **shall** mít `**Version:** 4.32.0` a `**Last Updated:** 2026-05-19`
> **Důkaz:** `head -5 CLAUDE.md`

### 5.5 Krit. 5 — Changelog entry added

> **When** update hotov
> **then** první changelog entry **shall** být `> **Changelog — v4.32.0`
> **Důkaz:** `grep -m 1 "Changelog — v" CLAUDE.md` vrátí v4.32.0 řádek

### 5.6 Krit. 6 — No existing content destroyed

> **While** se dělají edity
> **the system shall** zachovat všechny předchozí changelog entries (v4.31.0 dolů), všechny service descriptions, všechny TODOs, Quick Debugging table beze změny
> **Důkaz:** `git diff CLAUDE.md` ukazuje pouze additions + 1 link replacement + version bump

### 5.7 Krit. 7 — Soul.md session log

> **When** update hotov
> **then** `docs/soul.md` §9 **shall** mít novou entry s datem 2026-05-19, topic "CLAUDE.md SDD integration"

---

## 6. Gates (jeden Gate = jeden commit)

### Gate 1: Mandatory reading block

- `str_replace` per Edit 1
- Commit: `docs(claude): add mandatory reading block referencing docs/steering/`

### Gate 2: Update CALCULATOR_PHILOSOPHY link

- `str_replace` per Edit 2
- Commit: `docs(claude): update CALCULATOR_PHILOSOPHY ref to steering/domain.md §1`

### Gate 3: Workflow discipline block

- `str_replace` per Edit 3
- Commit: `docs(claude): add SDD workflow discipline section`

### Gate 4: Version + changelog

- `str_replace` per §4 (Version) + add changelog v4.32.0
- Commit: `docs(claude): v4.32.0 — SDD workflow integration`

### Gate 5: Soul.md session log

- Add entry per §5.7
- Commit: `docs(soul): session 2026-05-19 — CLAUDE.md SDD integration`

---

## 7. Tasks NOT in scope

- ❌ Rewrite of CLAUDE.md from scratch (NIKDY)
- ❌ Cleanup of historical changelog (keep all v4.24-v4.31 entries)
- ❌ Trim CLAUDE.md to 300-line limit (separate task later)
- ❌ Update per-service CLAUDE.md souborů (`concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`)
- ❌ Otevírat PR — commits push do branch, **bez PR**

---

## 8. References

- `docs/steering/conventions.md` (Claude Code mantra, communication style)
- `docs/soul.md` (current state)
- `docs/templates/_TEMPLATE_spec/` + `_TEMPLATE_bug/` (canonical templates)
- `docs/handoff/2026-05-19-docs-audit-findings.md` (předchozí audit context)
- `docs/handoff/2026-05-19-orphaned-files-classification.md` (orphaned files context)
