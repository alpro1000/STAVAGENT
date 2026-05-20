# Docs structure audit — Findings

**Datum:** 2026-05-19
**Auditor:** Claude Code (branch `claude/docs-audit-2026-05-19-0G3lF`)
**Source task:** `docs/docs/handoff/2026-05-19-docs-audit.md` (sic — viz §C.2)

---

## A. Co je v pořádku

### A.1 Steering (§3.1 — 5/5)

| Soubor | Velikost |
|---|---|
| `docs/steering/product.md` | 10 379 B |
| `docs/steering/tech.md` | 12 375 B |
| `docs/steering/structure.md` | 9 937 B |
| `docs/steering/domain.md` | 12 110 B |
| `docs/steering/conventions.md` | 10 316 B |

Všech 5 steering dokumentů existuje a má netriviální obsah.

### A.2 Memory & audit root (§3.2 — 2/2)

| Soubor | Velikost |
|---|---|
| `docs/soul.md` | 15 465 B |
| `docs/audit_project_knowledge.md` | 17 650 B |

### A.3 Steering template (§3.3 — 1/1)

| Soubor | Velikost |
|---|---|
| `docs/templates/_TEMPLATE_steering.md` | 2 409 B |

### A.4 Spec templates (§3.4 — 1/3)

| Soubor | Status |
|---|---|
| `docs/templates/_TEMPLATE_spec/requirements.md` | ✅ existuje (3 943 B) |

### A.5 Bug templates (§3.5 — 1/4)

| Soubor | Status |
|---|---|
| `docs/templates/_TEMPLATE_bug/report.md` | ✅ existuje (1 795 B) — identický s `docs/bugs/aplikovat-timeout/report.md` |

### A.6 First bug folder (§3.6 — 4/4)

| Soubor | Velikost |
|---|---|
| `docs/bugs/aplikovat-timeout/report.md` | 1 795 B |
| `docs/bugs/aplikovat-timeout/analyze.md` | 2 640 B |
| `docs/bugs/aplikovat-timeout/fix.md` | 2 551 B |
| `docs/bugs/aplikovat-timeout/verify.md` | 2 340 B |

**Pozorování:** Obsah těchto 4 souborů je **kanonická šablona s `{placeholder}` texty** (ne realný bug analysis). Tj. ve skutečnosti slouží jako sekundární kopie šablon — viz §B kde je dělám primárním zdrojem pro chybějící `_TEMPLATE_bug/{analyze,fix,verify}.md`. Per task §3.6 obsah těchto 4 souborů audituje **samostatná taska později**, takže je tu nechávám beze změny.

---

## B. Co chybí

### B.1 Spec templates (§3.4)

| Chybí | Akce v Gate 2 |
|---|---|
| `docs/templates/_TEMPLATE_spec/design.md` | Vytvořit prázdnou šablonu (sekce + HTML komentář s pravidly + versioning) |
| `docs/templates/_TEMPLATE_spec/tasks.md` | Vytvořit prázdnou šablonu (sekce + HTML komentář s pravidly + versioning) |

### B.2 Bug templates (§3.5)

| Chybí | Akce v Gate 2 |
|---|---|
| `docs/templates/_TEMPLATE_bug/analyze.md` | Zkopírovat z `docs/bugs/aplikovat-timeout/analyze.md` (je to kanonická šablona, viz A.6) |
| `docs/templates/_TEMPLATE_bug/fix.md` | Zkopírovat z `docs/bugs/aplikovat-timeout/fix.md` |
| `docs/templates/_TEMPLATE_bug/verify.md` | Zkopírovat z `docs/bugs/aplikovat-timeout/verify.md` |

---

## C. Co je navíc (suspected placeholders)

### C.1 Soubory pojmenované `1` (4 nálezy, všechny obsahují jediný znak `\n`)

| Cesta | Velikost | Obsah | Akce v Gate 3 |
|---|---|---|---|
| `docs/templates/1` | 1 B | `\n` | smazat |
| `docs/templates/_TEMPLATE_bug/1` | 1 B | `\n` | smazat |
| `docs/templates/_TEMPLATE_spec/1` | 1 B | `\n` | smazat |
| `docs/bugs/aplikovat-timeout/1` | 1 B | `\n` | smazat |

Triviální (1 byte newline) — placeholdery od GitHub web UI při vytváření složky. Per Krit. 3 mažu v separátním commitu.

### C.2 Misnested složka `docs/docs/handoff/`

Při vytváření handoff přes GitHub web UI vznikla cesta `docs/docs/handoff/2026-05-19-docs-audit.md` místo zamýšlené `docs/handoff/2026-05-19-docs-audit.md` (cíl pro výstup je deklarován v §6 jako `docs/handoff/2026-05-19-docs-audit-findings.md`, tj. bez prefixu `docs/`).

- **Současný stav:** task lives at `docs/docs/handoff/2026-05-19-docs-audit.md`
- **Findings report (tento dokument):** umístěn na **správnou cestu** `docs/handoff/2026-05-19-docs-audit-findings.md`
- **Akce v této tasce:** Žádná — přesun `2026-05-19-docs-audit.md` z `docs/docs/handoff/` do `docs/handoff/` vyžaduje rozhodnutí Alexandra (viz §F.1). Per task §3.7 byl v scope pouze lov souborů `1`/`1.txt`/`.gitkeep`.

### C.3 `.gitkeep` placeholdery

| Cesta | Velikost | Akce |
|---|---|---|
| `docs/images/.gitkeep` | 0 B | **ponechat** — legitimní git-tracking prázdné složky pro budoucí markdown assety |

---

## D. Pre-existing folders not in steering schema

> Per task §4 a §5.4: pouze inventory + doporučení, **nic neměnit**.

### D.1 `docs/architecture/` — 3 soubory, 56 KB

```
architecture/
├── calculator_complete_pipeline.md
└── decisions/
    ├── ADR-005_phase_E_dropped.md
    └── README.md
```

**Doporučení:** přesunout → `docs/reference/architecture/`. ADR struktura (Architecture Decision Records) je z v4.28.0 (ADR-005 Phase E dropped) — důležitý precedens, zachovat decisions/ subdir při migraci.

### D.2 `docs/archive/` — 54 souborů, 800 KB

```
archive/
├── analyses/                      # historické audity
├── completed-fixes/               # post-mortem fixů (.md + .txt)
├── completed-projects/            # např. MULTI_ROLE_OPTIMIZATION_COMPLETE.md
├── completed-sessions/            # SESSION_*.md, NEXT_SESSION_*.md
├── future-planning/               # BACKLOG.md, MIGRATION_STRATEGY.md, TASK_*.md (staré)
└── legacy/                        # zbytek
```

**Doporučení:** **ponechat jako je** (zděděný archív). Pre-existing prefix `docs/archive/` je dostatečně self-explanatory, není nutné ho cpát do nového schématu. Případně později rename na `docs/_archive/` (podtržítko vede řazení na konec).

### D.3 `docs/audits/` — 39 souborů, 588 KB

```
audits/
├── calculator_field_audit/        # probe.mjs + walkthrough.md + JSON
├── calculator_resource_ceiling/   # 2026-05-07_phase0_audit.md
├── knowledge_audit/               # 13+ inventory_* soubory + varianty řešení
├── mcp_status/                    # 2026-05-14_audit + cloudsql_connection_bug + deploy_verification
├── smartextractor_so250/          # probe.mjs + coverage.md + JSON
└── smartextractor_variant_b/
```

**Doporučení:** přesunout → `docs/reference/audits/` v rámci budoucí strukturální migrace. Subdirs (calculator_field_audit, knowledge_audit atd.) jsou už dobře pojmenované clustery, zachovat.

### D.4 `docs/competitive/` — 1 soubor, 100 KB

```
competitive/
└── STAVAGENT_vs_Alice_Audit_2026_05.md
```

**Doporučení:** přesunout → `docs/reference/competitive/` (per task §4 návrhu) nebo `docs/reference/marketing/`. Doporučuji `docs/reference/competitive/` — Alice je přímý konkurent, ne marketing materiál.

### D.5 `docs/images/` — 1 soubor (`.gitkeep`), 4 KB

**Doporučení:** **ponechat jako je**. Standardní asset pattern pro markdown.

### D.6 `docs/normy/` — 46 souborů, 66 MB

```
normy/
├── navody/                        # 6 PDF (skydeck, rundflex, sky-kotva, srs, domino, quattro) + 2 MD (SKRUZ + CALCULATOR_PHILOSOPHY duplicate)
└── tkp/                           # 11 PDF (TKP01A, 05, 09, 10, 12, 14, 18, 19, 22, 23, 29)
```

**Doporučení:** přesunout → `app/knowledge_base/B7_regulations/` (per task §4 návrhu). Toto jsou **doménová data**, ne dokumentace — patří do kódu (KB). 66 MB normativ + návodů je primární vstup pro NormIngestionPipeline a Section Extraction Engine v2. **Pozor:** ověřit duplikát `docs/normy/navody/CALCULATOR_PHILOSOPHY.md` vs `docs/CALCULATOR_PHILOSOPHY.md` — jeden z nich je výchozí, druhý duplikát.

### D.7 Souhrn migration map

| Stávající | Target (návrh) | Důvod |
|---|---|---|
| `docs/architecture/` | `docs/reference/architecture/` | Reference / decision records |
| `docs/archive/` | ponechat | Self-explanatory legacy |
| `docs/audits/` | `docs/reference/audits/` | Reference / past audits |
| `docs/competitive/` | `docs/reference/competitive/` | Reference / market intelligence |
| `docs/images/` | ponechat | Markdown assety |
| `docs/normy/` | `app/knowledge_base/B7_regulations/` | Doménová data, ne docs |

---

## E. Akce provedené Claude Code v této tasce

| # | Gate | Akce | Cesta |
|---|---|---|---|
| 1 | 1 | Vytvořen findings report | `docs/handoff/2026-05-19-docs-audit-findings.md` |
| 2 | 2 | Vytvořena šablona spec design | `docs/templates/_TEMPLATE_spec/design.md` |
| 3 | 2 | Vytvořena šablona spec tasks | `docs/templates/_TEMPLATE_spec/tasks.md` |
| 4 | 2 | Vytvořena šablona bug analyze (copy z aplikovat-timeout) | `docs/templates/_TEMPLATE_bug/analyze.md` |
| 5 | 2 | Vytvořena šablona bug fix (copy z aplikovat-timeout) | `docs/templates/_TEMPLATE_bug/fix.md` |
| 6 | 2 | Vytvořena šablona bug verify (copy z aplikovat-timeout) | `docs/templates/_TEMPLATE_bug/verify.md` |
| 7 | 3 | Smazán placeholder `1` | `docs/templates/1` |
| 8 | 3 | Smazán placeholder `1` | `docs/templates/_TEMPLATE_bug/1` |
| 9 | 3 | Smazán placeholder `1` | `docs/templates/_TEMPLATE_spec/1` |
| 10 | 3 | Smazán placeholder `1` | `docs/bugs/aplikovat-timeout/1` |
| 11 | 4 | Doplněn session log entry 2026-05-19 do `docs/soul.md` §9 | `docs/soul.md` |

> Branch dle session-level instrukcí: `claude/docs-audit-2026-05-19-0G3lF` (ne `chore/docs-structure-audit` jak uvedeno v task headeru — designated feature branch má přednost).

---

## F. Otevřené otázky pro Alexandra

### F.1 Misnested `docs/docs/handoff/2026-05-19-docs-audit.md`

Sám task soubor leží na chybné cestě (dvojnásobný `docs/`). Mám:
- **A)** přesunout do `docs/handoff/2026-05-19-docs-audit.md` a smazat prázdnou složku `docs/docs/`?
- **B)** ponechat — task je dokončený, lze později hromadně cleanupnout?

Doporučuji **A** v separátní tasce (mimo scope této audit tasky).

### F.2 Duplikát `CALCULATOR_PHILOSOPHY.md`

Existují **dvě kopie**:
- `docs/CALCULATOR_PHILOSOPHY.md` (root)
- `docs/normy/navody/CALCULATOR_PHILOSOPHY.md`

Která je kanonická? Pravděpodobně root, druhá by se měla smazat při migraci normy/ do `app/knowledge_base/B7_regulations/`.

### F.3 Branch name mismatch

Task header říká `chore/docs-structure-audit`, ale session-level instrukce direktivně pin `claude/docs-audit-2026-05-19-0G3lF`. Použil jsem druhý. Pokud by jsi chtěl výsledek na `chore/docs-structure-audit`, dej vědět — udělám rebase/cherry-pick.

### F.4 Kdy spustit migraci pre-existing folders (architecture/, audits/, normy/, competitive/)?

Per task §3 mimo scope. Doporučuji založit samostatnou tasku `chore/docs-migrate-pre-existing-folders` s konkrétními cíli per §D.7 mapy.

### F.5 Cleanup deadline 2026-07-29 (Gate 2 leftover)

V `docs/soul.md` §9 (předchozí session) je zmínka o cleanup deadline 2026-07-29 — jak se to vztahuje k novému workflow? Není to v této audit tasce řešeno.

---

## Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-05-19 | 0.1 | Initial audit findings (Gate 1) |
