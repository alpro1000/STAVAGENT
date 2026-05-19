# TASK: Audit docs/ structure

**Datum:** 19.05.2026
**Created by:** Alexander (z online sessiony)
**Vykonává:** Claude Code (doma)
**Branch:** `chore/docs-structure-audit`

---

## 1. Mantra (read before starting)

```
1. Přečti celý adresář /docs ve repu
2. Přečti docs/steering/structure.md a docs/steering/conventions.md
3. Nepředpokládej — ověř každý soubor
4. Neměň existující obsah bez explicitního povolení v této tasce
5. Reportuj findings v Markdownu, AŽ POTOM dělej úpravy
```

---

## 2. Kontext

Александр zakládal strukturu `docs/` přes GitHub web UI (po jednotlivých commitech, способ 2 z předchozí online session). Některé soubory pravděpodobně chybí, některé mohou být navíc (např. placeholdery `1` od GitHub web UI), některé složky existovaly už dříve a možná nejsou v souladu s novým schématem.

Cílem této tasky **NENÍ** přemigrovat všechen starý obsah — pouze **inventarizovat** a **doplnit chybějící šablony**.

---

## 3. Audit checklist

> Pro každou položku: ☑ pokud OK, ☒ pokud chybí/chyba, popsat detail.

### 3.1 Steering (5 souborů — všechny musí existovat)

- [ ] `docs/steering/product.md`
- [ ] `docs/steering/tech.md`
- [ ] `docs/steering/structure.md`
- [ ] `docs/steering/domain.md`
- [ ] `docs/steering/conventions.md`

### 3.2 Memory & audit root files

- [ ] `docs/soul.md`
- [ ] `docs/audit_project_knowledge.md`

### 3.3 Templates — steering

- [ ] `docs/templates/_TEMPLATE_steering.md`

### 3.4 Templates — spec (musí být 3 soubory v podsložce)

- [ ] `docs/templates/_TEMPLATE_spec/requirements.md`
- [ ] `docs/templates/_TEMPLATE_spec/design.md`
- [ ] `docs/templates/_TEMPLATE_spec/tasks.md`

### 3.5 Templates — bug (musí být 4 soubory v podsložce)

- [ ] `docs/templates/_TEMPLATE_bug/report.md`
- [ ] `docs/templates/_TEMPLATE_bug/analyze.md`
- [ ] `docs/templates/_TEMPLATE_bug/fix.md`
- [ ] `docs/templates/_TEMPLATE_bug/verify.md`

### 3.6 First bug folder (pre-existing)

- [ ] `docs/bugs/aplikovat-timeout/report.md`
- [ ] `docs/bugs/aplikovat-timeout/analyze.md`
- [ ] `docs/bugs/aplikovat-timeout/fix.md`
- [ ] `docs/bugs/aplikovat-timeout/verify.md`

**Pozn.:** Tyto 4 soubory existují, ale **obsah** nebyl kontrolován — možná je tam jen šablonový text. Není to v této tasce řešeno.

### 3.7 Placeholder files (suspected)

> GitHub web UI vyžaduje aspoň jeden soubor pro vytvoření složky. Uživatel mohl vytvořit soubor pojmenovaný `1` jako placeholder.

Najít všechny soubory pojmenované `1` nebo `1.txt` nebo `.gitkeep` v `docs/` a jeho podsložkách. Reportovat seznam.

---

## 4. Pre-existing folders (nemigrované)

> V `docs/` existují složky které nejsou v `steering/structure.md` plánu:
>
> - `docs/architecture/`
> - `docs/archive/`
> - `docs/audits/`
> - `docs/competitive/`
> - `docs/images/`
> - `docs/normy/`

Pro každou z nich:

1. Inventarizovat obsah (jaké soubory, kolik, kolik MB)
2. Navrhnout kam by patřily v novém schématu podle `audit_project_knowledge.md`:
   - `architecture/` → pravděpodobně `docs/reference/architecture/`
   - `audits/` → pravděpodobně `docs/reference/audits/`
   - `competitive/` → pravděpodobně `docs/reference/marketing/` nebo `docs/reference/competitive/`
   - `normy/` → pravděpodobně `app/knowledge_base/B7_regulations/` (kód, ne docs)
   - `images/` → ponechat jako je (assety pro markdown)
   - `archive/` → ponechat jako je
3. **NIC NEMĚNIT** v této tasce — pouze report a doporučení do `docs/soul.md` §9 session log.

---

## 5. Acceptance criteria (EARS-style)

### 5.1 Krit. 1 — Inventory complete

> **When** Claude Code dokončí audit
> **then** existuje markdown report **shall** v `docs/handoff/2026-05-19-docs-audit-findings.md`
> obsahující sekce A/B/C/D/E (viz §6).

### 5.2 Krit. 2 — Missing template files filled in

> **If** některý ze šablonových souborů (§3.3, §3.4, §3.5) chybí
> **then** Claude Code **shall** vytvořit ten soubor s **prázdnou šablonou** kompatibilní se zbytkem `docs/templates/`.
> Žádné fake placeholder texty — pouze hlavičky a komentáře.

### 5.3 Krit. 3 — Placeholders deleted

> **If** soubory pojmenované `1` jsou identifikovány a jejich obsah je triviální (prázdný / "placeholder" / "1")
> **then** Claude Code **shall** je smazat v separátním commitu.
> Pokud obsah není triviální — **ponechat** a zmínit v reportu.

### 5.4 Krit. 4 — Existing folders preserved

> **While** existing folders (architecture/, archive/, audits/, competitive/, images/, normy/) jsou identifikovány
> **the system shall** je **ponechat beze změny**, pouze inventarizovat a doporučit do session logu.

### 5.5 Krit. 5 — Session log updated

> **When** audit je dokončen
> **then** Claude Code **shall** přidat session log entry do `docs/soul.md` §9
> s datem `2026-05-19`, topic "Docs structure audit", a stručným summary findings.

---

## 6. Output format

Vytvořit `docs/handoff/2026-05-19-docs-audit-findings.md` s následujícími sekcemi:

```markdown
# Docs structure audit — Findings

**Datum:** 2026-05-19
**Auditor:** Claude Code

## A. Co je v pořádku
[List of existing files matching the canonical schema]

## B. Co chybí
[List of missing files that should exist per steering]
[For each: what action taken — created empty template / left for human / etc]

## C. Co je navíc (suspected placeholders)
[List of `1` files or other suspicious entries]
[For each: what action taken — deleted / left / queried]

## D. Pre-existing folders not in steering schema
[For each folder: content inventory + migration recommendation]

## E. Akce provedené Claude Code v této tasce
[Numbered list of changes — file creations, deletions, edits]

## F. Otevřené otázky pro Александra
[Anything that requires human decision before next step]
```

---

## 7. Commits (jeden Gate = jeden commit)

- **Gate 1:** Audit only, vytvořit `docs/handoff/2026-05-19-docs-audit-findings.md`
  - Commit: `docs: audit current docs/ structure`
- **Gate 2:** Fill in missing templates (pokud Krit. 2 vyžaduje)
  - Commit: `docs(templates): fill in missing template files`
- **Gate 3:** Delete confirmed placeholders (pokud Krit. 3 vyžaduje)
  - Commit: `docs: remove GitHub web UI placeholder files`
- **Gate 4:** Update `docs/soul.md` §9 session log
  - Commit: `docs(soul): session 2026-05-19 — docs structure audit`

---

## 8. Tasks NOT in scope

- ❌ Migrate existing TASK_*.md from Project Knowledge into docs/specs/
- ❌ Migrate existing pre-existing folders content (architecture/, audits/, etc) — pouze inventory + doporučení
- ❌ Modify obsah `docs/bugs/aplikovat-timeout/` souborů (jejich obsah audituje samostatná taska později)
- ❌ Otevírat PR — commits push do `chore/docs-structure-audit` branch, **bez PR** (no-PR-unless-asked policy)

---

## 9. References

- `docs/steering/structure.md` §1 (canonical repo layout)
- `docs/steering/conventions.md` §11 (online + Claude Code hybrid workflow)
- `docs/audit_project_knowledge.md` §3.7+ (where pre-existing content belongs)
- `docs/templates/_TEMPLATE_*` (canonical template format)

---

## 10. Soul.md update template (pro Gate 4)

```markdown
## 2026-05-19 — Session: Docs structure audit

**Topic:** Inventory aktuální struktury `docs/` proti steering plánu.

**Rozhodnuto:**
- {summary key decisions z findings reportu}

**Odmítnuto:**
- {co se rozhodlo NEdělat — např. migrace pre-existing folders}

**Otevřené otázky:**
- {seznam z findings §F}

**Co dál:**
- Migrace pre-existing folders (architecture/, audits/, normy/) do nové struktury — separátní task
- První pilotní spec: `docs/specs/cross-user-isolation/`
- Druhý pilotní spec: `docs/specs/mcp-policy-engine/`
```
