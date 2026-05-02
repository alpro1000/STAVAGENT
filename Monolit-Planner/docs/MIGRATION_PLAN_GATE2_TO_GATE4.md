# Migration Plan — Gate 2 → Gate 3 → Gate 4

**Status:** Active plan as of Gate 1 audit closeout (2026-04-29)
**Reference audit:** `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md`
**Reference philosophy:** `docs/CALCULATOR_PHILOSOPHY.md`
**Reference canonical:** `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md` + Section 9
**Deprecation deadline:** 2026-07-29 (3 měsíce od Gate 1 closeout)

---

## 1) Phase 0 — Gate 1 audit (DONE)

Inventory aktuálního stavu, identifikace 10 gaps v Section 0 (z toho **Gap #8 = CRITICAL BUG** Top 50 / VARIOKIT HD 200 misclassification a **Gap #10 marker**), 4 warnings W1-W4 (W4 refined na INFO), 5 affected test files (1 HIGH RISK = lateral-pressure.test.ts), 3 mostní golden specs v `test-data/tz/`, 0 pozemní golden specs.

**Closeout commit:** branch `claude/add-terminology-docs-av2bX` PR (po finalizaci Section H + tomto migration plan + audit closeout pointers).

---

## 2) Phase 1 — Gate 2.0 Pre-prerequisites

**P0 (BLOCKING):** Buď automatizovat SO-202 golden test jako Vitest fixture, NEBO explicit risk acceptance signed v Gate 2 task spec (rozhodnutí vlastníka projektu).

Bez tohoto: Gap #8 fix bude implementován bez automated regression coverage.

**Doporučená cesta:** Konvertovat SO-202 markdown spec na Vitest fixture (~1-2 dny práce) pro reusable golden test framework. Stejný framework pak použitelný pro SO-203, SO-207 a budoucí golden specs.

**Acceptance criteria pro tento P0:**
- Vitest fixture existuje pro SO-202 mostovka
- Test prochází proti current code (verifikuje že snapshot je reproducible PŘED Gap #8 fix)
- Cílem je mít baseline pro inverze test assertions v Gate 2.1

---

## 3) Phase 2 — Gate 2.1: Gap #8 fix (Top 50 / VARIOKIT misclassification)

**Scope:** ~3 100 LOC v 5 test files + `formwork-systems.ts` core.

**Změny:**
- `formwork-systems.ts` (5 file:line — L25, L162-178, L496-511, L170, L504): pour_role hodnoty Top 50 + VARIOKIT HD 200
- `formwork-systems.test.ts` (4 inverted assertions: L23-26, L66-67)
- `element-classifier.test.ts` (L630-642 + comment v4.21.0 → v4.22.0)
- 3 golden specs (SO-202, SO-203 — v4.22.0 Re-Snapshot section documenting terminology correction; SO-207 unaffected)
- HelpPanel.tsx L239 — already FIXED in Gate 1 cleanup (commit `db12979`)

**HIGH RISK:** lateral-pressure.test.ts — sort stability dependency. Spustit izolovaně po každé změně `formwork-systems.ts` enum hodnot.

**Acceptance criteria:**
- Gap #8 fix verifikován proti SO-202 golden test
- Žádný existující test neselhal (kromě targetovaných inverzí)
- Audit Section A.3 + C.3 změnit z „BUG" / „NESPRÁVNÉ" na „RESOLVED" status

---

## 4) Phase 3 — Gate 2a: Mostní (9 typů v applicable_element_types allow-list, z toho 2 s needs_supports=true — viz audit B.3)

**Scope:** mostovka, dříky, opěry, křídla, přechodová deska, mostní závěr, ložisko, izolace, římsy.

**Z 10 mostních typů mají needs_supports=true pouze 2** (mostovkova_deska + rigel — viz audit Section B.3). To zužuje formwork-selection chain scope.

**Reference materials:**
- DOKA: Top 50 + Staxo 100 stack (canonical Section 9.2)
- PERI: VARIOKIT VST + VARIO GT 24 stack
- 3 golden specs (SO-202, SO-203, SO-207) pokrývají většinu mostních typů

**Bridge equivalent mapping** (audit Section B.2) leverages — některé mostní prvky reuseují pozemní logic přes context-driven `is_bridge` flag.

---

## 5) Phase 4 — Gate 2b: Pozemní (13 typů)

**Scope:** základová deska, sloup pozemní, monolitická stěna, schodiště, atrium, podzemní stěny, atd.

**Risk:** ŽÁDNÉ golden test coverage pro pozemní prvky. Manual smoke test only.

**Doporučení:** Zvážit vytvoření 1 pozemního golden test (např. VP4 FORESTINA pokud data dostupná, nebo synthetic case „stropní deska + Dokaflex + výška 3.5 m") před Gate 2b commit.

---

## 6) Phase 5 — Gate 3: UI labels + warnings

**Scope:**
- W1-W4 implementace (W4 = INFO, ne YELLOW per refined trigger v audit E.1)
- `warnings_structured` shape (nahradit `warnings: string[]` per Gap #9 v Section 0 / E.4 observation)
- UI labels per canonical Section 9.3 DOKA/PERI mapping
- Tooltip na canonical doc reference

**Prerequisite:** `warnings_structured` shape MUSÍ být implementován **PŘED** prvním W1 (RED) warning — jinak risk že severity dropne na plain string.

**No code expected v test fixtures** (B=0 z audit Section F.2 confirmed).

---

## 7) Phase 6 — Gate 4: Pricing split

**Scope:**
- 4 nové fields per system (setup_labor + rental + teardown_labor + optional design_fee)
- MSS mobilization separate fields (P1 fix from audit D.4)
- Excel field names disambiguation (audit D.2 open item)
- MCP `accuracy_note` field per philosophy §7.3
- Dual-write deprecation aliases (Variant 3) do 2026-07-29

**External notification:** Portal sync + Registry teams musí být notifikováni před spuštěním Gate 4 (open item z audit H.5).

---

## 8) Phase 7 — Cleanup task (after 2026-07-29)

**Blocking prerequisite pro public MCP launch.**

Scope:
- Odstranit všechny `// DEPRECATED until 2026-07-29` aliases v Excel/JSON/MCP outputech
- Verifikovat že všichni external consumers (Portal sync, Registry, MCP klienti) migrovali
- Audit observation v C.5 (skruz* naming mix v planner-orchestrator) — zvážit promoci na Gap #11 s P2 prioritou
- Section 9 cleanup (5 issues identified by external review na 2026-04-29 — absolutes, Top 50 H20 layer issue, atd.)

---

## 9) Migration summary table

| Phase | Gate | Scope | Duration estimate |
|---|---|---|---|
| 0 | Gate 1 (DONE) | Audit | ~ commit history |
| 1 | Gate 2.0 prereq | Golden framework / SO-202 automate | 1-2 dny |
| 2 | Gate 2.1 | Gap #8 fix | 2-3 dny |
| 3 | Gate 2a | Mostní (9 typů, jen 2 `needs_supports`) | 3-5 dní |
| 4 | Gate 2b | Pozemní (13 typů, žádný golden coverage) | 3-5 dní |
| 5 | Gate 3 | UI labels + W1-W4 (W4=INFO) | 5-7 dní |
| 6 | Gate 4 | Pricing split + MSS P1 + dual-write | 5-7 dní |
| 7 | Cleanup | Remove deprecated aliases | 2-3 dny |

> *Note: Duration estimates jsou orientační, ±30 % variance per philosophy doc §3 (calculator philosophy applies to project estimates also). Solo work assumed; pair / team work může zkrátit. Phase 1 P0 prerequisite je hard blocker pro Phase 2.*

**Critical dependencies:**
- Phase 1 (P0 prereq) blocks Phase 2 (no automated regression baseline = no safe Gap #8 fix)
- Phase 5 `warnings_structured` shape blocks W1 (RED) impl
- Phase 6 Excel disambiguation (audit D.2 open item) blocks dual-write
- Phase 7 = blocking prerequisite pro public MCP launch

**Total estimate:** ~3-4 týdny solo work + 2 dny cleanup. Pohlcené testem nejistoty: ±30 % (per philosophy ±10-15 % accuracy applies to outputs, ne k estimátům — estimates jsou orientační).

---

## 10) Cleanup tracking

### 10.1) GitHub issue (post-merge)

Po merge audit PR vytvořit GitHub issue:

- **Title:** `[CLEANUP] Remove deprecated terminology aliases — deadline 2026-07-29`
- **Labels:** `cleanup`, `blocker:public-mcp-launch`
- **Milestone:** `2026-07-29`
- **Body:**
  - Reference na audit Section H (external interfaces) + this migration plan Phase 7
  - Checklist míst kde existují deprecation aliases (vyplněno průběžně v Phase 6 implementation — Gate 4 work doplňuje konkrétní file:line items do checklistu)
  - Blocker dependency: public MCP launch nesmí proběhnout dokud cleanup task není closed
  - Reference na canonical sources: `docs/CALCULATOR_PHILOSOPHY.md` §7.3 + `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md`

**Blocker owner:** Project owner (user) — PR merge do `main` pro MCP public launch vyžaduje manual sign-off na closed cleanup issue. Bez sign-off PR zůstává v review state, ne auto-merged. Tento manuální gate zabraňuje cleanup driftu do „nice-to-have" zóny.

### 10.2) Grep-able deprecation comments

V Phase 6 (Gate 4 pricing implementation) každý starý field name v kódu označit komentářem:

```typescript
// DEPRECATED until 2026-07-29 (canonical terminology migration)
// See: MIGRATION_PLAN_GATE2_TO_GATE4.md Phase 7
```

V Phase 7 cleanup task: `grep -r "DEPRECATED until 2026-07-29"` najde všechna místa která je třeba odstranit. Tento pattern zaručuje že cleanup je **mechanically auditable** — žádné manuální tracking spreadsheets.

### 10.3) Three independent reminders

Aby cleanup task nebyl zapomenut:

1. **Date in code** — `grep` najde všechny `DEPRECATED until 2026-07-29` markers
2. **GitHub issue** — visible reminder s checklistem v issue trackeru, milestone date
3. **Blocking dependency** — public MCP launch nemůže proběhnout bez closeout (zapsáno v `next-session.md` jako blocker)

Pravděpodobnost zapomenutí všech tří mechanismů současně = velmi nízká.

### 10.4) Carry-over post-Gate-1 cleanup items

Z external review 2026-04-29 (Category 3 NICE TO HAVE — neblokují Gate 1 closeout, ale měly by být řešeny v Phase 2 nebo Phase 7):

- **Gap #11 extract** ze audit Section C.5 — skruz* vs props naming mix v planner-orchestrator (aktuálně observation, kandidát pro povýšení na gap s P2 prioritou)
- **3-vrstvý stack visualization v audit C.3 Gap #8** — schéma 3 vrstev přímo do Gap #8 textu (místo jen reference na Section 9.2). Cíl: Gate 2 developer čte jen sekci C bez canonical doc po ruce
- **B.3 finding → audit Section 0 executive summary** — „Z 10 mostních typů mají `needs_supports=true` pouze 2" — toto by mělo být v executive summary, zužuje Gate 2a scope
- **Section 9 cleanup** — 5 issues identified by external review (absolutes „NIKDY"/„NEPOUŽITELNÉ", Top 50 H20 layer issue, Staxo 100 reclassification scope, enum migration noise, Phase 0-5 graph noise). Cleanup před Phase 2 (tech cards) — detail v `next-session.md`

Tyto items jsou tracked v `next-session.md` v root repu pro Phase 2 addressing. Nejsou blockerem Gate 1 closeout.

---

## 11) Decision log (open items requiring user decision)

1. **P0 prerequisite cesta** (Phase 1): automate SO-202 vs. risk acceptance? — pending user sign-off
2. **External notification ownership** (Gate 4): kdo notifikuje Portal + Registry teams? — pending
3. **Pozemní golden coverage** (Gate 2b): vytvořit synthetic test? — pending
4. **Section 9 cleanup timing** (Phase 7): cleanup před nebo po public MCP launch? — pending
5. **Gate 2a scope interpretace** — Phase 3 task spec bude postavena na 9 typech (allow-list scope) nebo 2 typech (props/skruž rozhodovací scope)? Obě interpretace validní, liší se rozsah práce a duration estimate (3-5 dní pro 9, 1-2 dny pro 2). Doporučuji explicitně rozhodnout v Gate 2a task spec preamble. — pending user sign-off

---

**Reviewed:** Externí review 2026-04-29 (3× rounds, all critical issues resolved before Gate 1 closeout).

**End of migration plan.**
