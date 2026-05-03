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

## 2) Phase 1 — Gate 2.0 Pre-prerequisites — ✅ DONE (commit `b02b557`)

**Status:** Completed Gate 2 Phase 1. Golden test framework established as Vitest fixtures (Decision 1: AUTOMATE chosen). 11 tests baseline, all passing against pre-Gap-8 code. Decisions 2 (CREATE VP4 FORESTINA golden) + 3 (signed off SELF notification) handled in same phase.

**P0 (BLOCKING):** Buď automatizovat SO-202 golden test jako Vitest fixture, NEBO explicit risk acceptance signed v Gate 2 task spec (rozhodnutí vlastníka projektu).

Bez tohoto: Gap #8 fix bude implementován bez automated regression coverage.

**Doporučená cesta:** Konvertovat SO-202 markdown spec na Vitest fixture (~1-2 dny práce) pro reusable golden test framework. Stejný framework pak použitelný pro SO-203, SO-207 a budoucí golden specs.

**Acceptance criteria pro tento P0:**
- Vitest fixture existuje pro SO-202 mostovka
- Test prochází proti current code (verifikuje že snapshot je reproducible PŘED Gap #8 fix)
- Cílem je mít baseline pro inverze test assertions v Gate 2.1

---

## 3) Phase 2 — Gate 2.1: Gap #8 fix (Top 50 / VARIOKIT misclassification) — ✅ DONE (4 atomic commits)

**Status:** Completed Gate 2 Phase 2 in 4 atomic commits:
- `6d2784f` types foundations (PourRole expanded with `'formwork_beam'`; FormworkSubtype type alias added)
- `b60d24d` Top 50 reclass (`'falsework'` → `'formwork'` + `formwork_subtype: 'nosnikove'`)
- `b2fc701` VARIOKIT HD 200 reclass (`'falsework'` → `'formwork_beam'`)
- `0ccc371` SO-202 + SO-203 v4.22.0 Re-Snapshot section (golden specs documented)

Each commit boundary green at every step. lateral-pressure HIGH RISK isolated check after each enum-touching change passed (54 tests). Gap #8 RESOLVED status reflected in audit Section A.3 + C.3 (Phase 5 Commit 1).

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

## 4) Phase 3 — Gate 2a: Mostní (10 typů incl. NEW zaklady_oper) — ✅ DONE (4 commits)

**Status:** Completed Gate 2 Phase 3 in 4 atomic commits:
- `78d5dd9` Add `zaklady_oper` element type (Option α literal parallel pattern; 10th mostní type)
- `06f744a` Horizontal selector — Option W (recommended[0] over cheapest sort, with universal-applicable allow-list semantics)
- `18f36da` Vertical selector — Option W extension with DIN 18218 pressure-filter safety preserved
- `6849c45` Verification regression net (6 tests for remaining 5 mostní elements + rimsa long-bridge variant)

Architectural symmetry achieved: horizontal + vertical + special path (rimsa L955-961) all respect `ELEMENT_CATALOG.recommended_formwork[0]`. Phase 4 pre-emption: zakladova_deska + operne_zdi auto-fixed by Option W extension.

**Scope:** mostovka, dříky, opěry, křídla, přechodová deska, mostní závěrné zídky, římsy, plus newly-added `zaklady_oper` (paralelní k zaklady_piliru). `mostni_zaver` from original spec dropped per Phase 3 stop-and-ask — purchase items not in calculator scope.

**Z 10 mostních typů mají needs_supports=true pouze 2** (mostovkova_deska + rigel — viz audit Section B.3). To zužuje formwork-selection chain scope.

**Reference materials:**
- DOKA: Top 50 + Staxo 100 stack (canonical Section 9.2)
- PERI: VARIOKIT VST + VARIO GT 24 stack
- 3 golden specs (SO-202, SO-203, SO-207) pokrývají většinu mostních typů

**Bridge equivalent mapping** (audit Section B.2) leverages — některé mostní prvky reuseují pozemní logic přes context-driven `is_bridge` flag.

---

## 5) Phase 4 — Gate 2b: Pozemní (13 typů) — ✅ DONE (commit `86b9a4e`)

**Status:** Completed Gate 2 Phase 4 in **single regression net commit** (`86b9a4e`). Pre-Edit diagnostic confirmed best-case Scenario X: all 12 pozemní + speciální elements ALREADY return canonical recommended[0] post-Phase-3 Option W extension. No data fixes, no selector logic changes, no fixture updates needed. 12 verification tests added; 1024 → 1036 total.

**Pre-emption power demonstrated:** Phase 4 reduced from estimated 3-4 days to ~10 minutes work because Option W extension (Phase 3 Commits 2+3) auto-fixed all 11 remaining pozemní + speciální elements transparently. Embrace pre-emption proven correct strategy.

**Phase 5 backlog item discovered:** atrium / attika / vence / rampa terminology gap — user mentioned as candidates but NOT in `StructuralElementType` union. Documented as subsumption note in audit Section B.1 (Phase 5 Commit 1).

**Scope:** základová deska, sloup pozemní, monolitická stěna, schodiště, atrium, podzemní stěny, atd.

**Risk:** ŽÁDNÉ golden test coverage pro pozemní prvky. Manual smoke test only.

**Doporučení:** Zvážit vytvoření 1 pozemního golden test (např. VP4 FORESTINA pokud data dostupná, nebo synthetic case „stropní deska + Dokaflex + výška 3.5 m") před Gate 2b commit.

---

---

## 5b) Architectural insights from Gate 2 implementation

Documented during Gate 2 closeout for future Gate 3 / Gate 4 / Gate 7 design decisions.

### Option W principle (established Phase 3)

**Generic principle:** respect canonical `ELEMENT_CATALOG.recommended_formwork[0]` over algorithmic optimization (cheapest sort, pressure filter cheapest survivor). Applied to both horizontal and vertical selector branches in `recommendFormwork()`. Future selector paths must follow this pattern: data-canonical recommendation wins over heuristic optimization.

**Implementation:** Phase 3 Commit `06f744a` (horizontal) + `18f36da` (vertical extension with pressure-filter safety preserved) + `6849c45` (regression net).

### Path coverage discovery (Phase 3 Commit 2)

`recommendFormwork()` has **two distinct paths**:
- **Without-height** (L1023): short-circuits to `recommended_formwork[0]` directly (existing tests with single-arg calls always returned canonical answer — masked the bug).
- **With-height**: enters orientation-specific branch (horizontal L1030 / vertical L1079) where pre-Option-W cheapest sort would override canonical recommendation.

**Lesson:** tests must exercise both paths. Single-arg defaults can mask issues. Phase 3 Commit 2 added explicit with-height regression tests for foundation elements.

### Universal applicability semantics (Phase 3 Commit 2)

**`applicable_element_types` interpretation:**
- `undefined` → universal (no allow-list, applies to ALL element types)
- Array → explicit allow-list (only listed types pass)

**Filter logic must handle both:** `!apt || apt.includes(type)`. The original Phase 3 Commit 2 guard formulation `apt?.includes(type)` would have failed silently for universal systems (Frami Xlife has `applicable_element_types: undefined` → returns `undefined?.includes(type) = undefined` → falsy → fallback to broken cheapest sort). Caught by stop-and-ask 13th instance.

### Pre-emption pattern (Phase 3 Commits 2+3)

**Architectural fixes (Option W) propagate to related cases naturally.** Phase 4 reduced from 3-4 days work to ~10 minutes because vertical Option W (Commit 3) auto-fixed all 11 pozemní elements transparently. **Embrace pre-emption — don't add scope guards to artificially limit fix reach.**

Concrete pre-emptions verified Phase 3 → Phase 4:
- `zakladova_deska` (horizontal Option W, Commit 2)
- `operne_zdi` (vertical Option W, Commit 3) — VP4 FORESTINA fixture updated DUO → TRIO
- 11 other pozemní + speciální elements transparently covered in Phase 4 regression net

### Stop-and-ask pattern (Gate 1 + Gate 2 retrospective)

**16 instances total** (6 in Gate 1 + 10 in Gate 2). Each prevented downstream issue: truncations, broken cross-refs, scope creep, architectural surprises, data inconsistencies, broken intermediate commits.

**Pattern principle:** investigative thinking before code = vastly fewer broken commits. Task specs are starting hypotheses, not implementation contracts. Implementation reality (TypeScript types, current architecture) is authoritative.

Selected high-impact catches:
- Gate 1 #4: External notification ownership ambiguity → SELF decision
- Gate 2 #11: zaklady_oper Option α (literal parallel) vs Option β (alias) — chose α per repo convention
- Gate 2 #12: Override mechanism single-place vs multi-place → confirmed single
- Gate 2 #13: guard #3 logic bug (Frami undefined applicable_element_types)
- Gate 2 #15: Vertical selector different mechanism (pressure filter + cheapest survivor)
- Gate 2 #16: operne_zdi Scenario 3 (TRIO not DUO/Framax) — embrace pre-emption + fixture update

### Architectural foundation locked

After Gate 2:
- 22 element types (now 23 with `zaklady_oper`) classification-correct per canonical §9.4
- 3 selector paths (horizontal Option W / vertical Option W with pressure safety / rimsa special path) all consistent
- 4 golden test fixtures + comprehensive regression net (1036 tests total)
- Future work (Gate 3 UI labels + Gate 4 pricing split + Gate 7 cleanup) builds on stable foundation

---

## 5c) Phase 5 closeout backlog (handled in Phase 5 commits)

✅ Audit corrections — Commit 1 of Phase 5 closeout (`7ec3133`)
✅ Migration plan update — this commit
☐ CLAUDE.md changelog — Commit 3 of Phase 5
☐ next-session.md update — Commit 4 of Phase 5
☐ PR creation — Commit 5 of Phase 5

## 5d) Carry-forward to Gate 3 / Gate 4 / Gate 7

Items **NOT addressed in Gate 2** (intentional scope boundary):

- **Staxo 100 reclassification** (`'props'` → `'falsework'` per canonical Vrstva 3) — Gate 3 UI scope (natural fit when UI cards split „Skruž" vs „Stojky")
- **Multi-layer architecture** (`output.falsework` field) — Gate 3 if needed for UI clarity, otherwise leave existing `output.formwork.system` + `output.props` two-layer pattern
- **Section 9 cleanup** — 5 issues identified by external review (absolutes „NIKDY"/„NEPOUŽITELNÉ", Top 50 H20 layer issue, Staxo 100 reclassification scope, enum migration noise, Phase 0-5 graph noise) — Gate 7 cleanup task
- **Catalog gap atrium / attika / vence / rampa** — Phase 5 Commit 1 documented as subsumption (Option 1: existing types via parameters). Final decision Gate 7 if user revisits.
- **W1-W4 warnings implementation** — Gate 3 scope (`warnings_structured` shape prerequisite for W1 RED severity)
- **Pricing split + dual-write deprecation aliases** — Gate 4 scope, deadline 2026-07-29 for cleanup task

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

## 11) Decision log — ✅ all 5 decisions signed off (2026-04-30)

1. ✅ **P0 prerequisite cesta** (Phase 1): **AUTOMATE chosen.** SO-202 + VP4 FORESTINA Vitest fixtures created in Phase 1 (commit `b02b557`). 11 tests baseline.
2. ✅ **External notification ownership** (Gate 4): **SELF chosen.** Solo developer, no external Portal/Registry teams to notify. Tracked for Gate 4 implementation.
3. ✅ **Pozemní golden coverage** (Gate 2b): **VP4 FORESTINA golden created.** Vitest fixture in Phase 1 (`golden-vp4-forestina.test.ts`). Operne_zdi assertion updated DUO → TRIO in Phase 3 Commit 3 per canonical §9.4.
4. ✅ **Section 9 cleanup timing** (Phase 7 / Gate 7): **AFTER Gate 2 chosen.** Cleanup deferred to Gate 7 task post-Gate-2 (per Section 5d carry-forward).
5. ✅ **Gate 2a scope interpretace** — **ALL 22 typů chosen.** Implemented through Option W principle (Phase 3 Commits 2+3) which automatically respects canonical recommendation across all element types via single architectural fix. Pre-emption pattern proven correct strategy (Phase 4 reduced from 3-4 days to ~10 minutes).

---

**Reviewed:** Externí review 2026-04-29 (3× rounds, all critical issues resolved before Gate 1 closeout). Gate 2 closeout 2026 (this commit).

**End of migration plan.**
