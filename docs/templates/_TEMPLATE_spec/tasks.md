# {Feature Name} — Tasks

> **Spec ID:** `{feature-name-kebab-case}`
> **Datum:** {YYYY-MM-DD}
> **Status:** draft | implementing | done
> **Owner:** Claude Code session / {dev}
> **Prerequisites:** `requirements.md` approved + `design.md` approved

---

## 1. Task list

> **Princip:** každá task = jeden Gate = jeden commit. Granulární, ověřitelná, samostatně mergeable.
> **Mapping:** task → acceptance criterion z `requirements.md` §3.

### 1.1 Gate 1: {Task title}

- **Cíl:** {Co se po dokončení této tasky děje}
- **Acceptance criteria covered:** {Krit. X.Y z requirements.md}
- **Effort:** {Trivial / S / M / L — orientačně}
- **Files / oblasti dotčené:** {Stručně, bez exhaustive listu}
- **Tests:** {Které testy se přidávají / mění}
- **Commit message:** `{prefix}: {short description}`

**Subtasks:**
- [ ] {Krok 1}
- [ ] {Krok 2}
- [ ] {Krok 3}

**Definition of done:**
- [ ] Implementation hotová
- [ ] Tests passing locally
- [ ] Lint clean
- [ ] PR description odkazuje na `requirements.md` Krit. X.Y
- [ ] (pokud MCP-affected) `tests/test_mcp_compatibility.py` passing

---

### 1.2 Gate 2: {Task title}

- **Cíl:** ...
- **Acceptance criteria covered:** ...
- **Effort:** ...
- **Files / oblasti dotčené:** ...
- **Tests:** ...
- **Commit message:** `{prefix}: {description}`

**Subtasks:**
- [ ] ...

**Definition of done:**
- [ ] ...

---

### 1.3 Gate 3: {Task title}

[Pokračovat pro všechny Gates. Doporučené 2-6 Gates per spec. Pokud > 8 → spec je moc velký, splitnout.]

---

## 2. Dependencies between gates

```
Gate 1 → Gate 2 → Gate 3
              ↘ Gate 4 (parallel)
```

[Pokud Gates jsou sekvenční / paralelní — explicitně. Critical path.]

---

## 3. External dependencies

[Co je třeba mít od jiných systémů / lidí před začátkem.]

- [ ] {Dependency 1 — kdo dodává, kdy}
- [ ] {Dependency 2}

---

## 4. Migration tasks (pokud relevant)

[Pokud feature vyžaduje DB migrace / data backfill / cleanup starého stavu — samostatné Gates.]

| # | Task | Reversible? | Run when |
|---|---|---|---|
| M1 | {Migration popis} | Yes / No | Before / After Gate X |
| M2 | {Backfill popis} | Yes / No | After Gate Y |

---

## 5. Verification tasks (post-implementation)

> Per `requirements.md` §3 acceptance criteria — jak ověřím v produkci že feature funguje.

- [ ] Manual smoke test scenario 1: {Co}
- [ ] Manual smoke test scenario 2: {Co}
- [ ] Golden test fixture: {Path}
- [ ] Monitoring dashboard / alert: {Co}

---

## 6. Rollback plan

[Pokud něco selže v produkci — jak revertujeme.]

1. {Krok 1 — git revert / feature flag off / migration down}
2. {Krok 2}
3. {Krok 3 — monitoring confirm}

---

## 7. Out of scope (pro tasks.md)

[Co bylo zvažováno jako task ale je separátní follow-up.]

- ❌ {Follow-up task 1 — separátní spec / backlog}
- ❌ {Follow-up task 2}

---

## 8. Effort summary

| Gate | Effort | Cumulative |
|---|---|---|
| Gate 1 | {S/M/L} | {S/M/L} |
| Gate 2 | {S/M/L} | {Total} |
| Gate 3 | {S/M/L} | {Total} |
| **Total** | | {Sum} |

---

## 9. Open task questions

[Co je v plánu neúplné a vyžaduje rozhodnutí před spuštěním.]

- [ ] {Otázka 1}
- [ ] {Otázka 2}

---

## 10. References

- Requirements: `docs/specs/{name}/requirements.md`
- Design: `docs/specs/{name}/design.md`
- Branching: `claude/{spec-name}-{random5}` per `docs/steering/conventions.md`
- Commit style: per `CLAUDE.md` (FEAT/FIX/REFACTOR/DOCS/STYLE/TEST/WIP)
- Gates per `docs/steering/conventions.md` §7

---

<!-- ============================================== -->
<!-- PRAVIDLA PRO TASKS.md:                           -->
<!--                                                  -->
<!-- 1. JEDNA TASK = JEDEN GATE = JEDEN COMMIT       -->
<!--    Per `conventions.md` §7. Granularita kritická -->
<!--    pro review checkpoint pattern.                -->
<!--                                                  -->
<!-- 2. KAŽDÁ TASK MUSÍ MAPOVAT NA ACCEPTANCE        -->
<!--    Pole "Acceptance criteria covered" je         -->
<!--    povinné. Pokud task nemapuje na žádný         -->
<!--    Krit. z `requirements.md` — patří do          -->
<!--    `design.md` (decisions) nebo není potřeba.    -->
<!--                                                  -->
<!-- 3. DEFINITION OF DONE                            -->
<!--    Vždy checklist, ne narativ. Lint, testy,      -->
<!--    MCP compat (pokud relevant), PR popis.        -->
<!--                                                  -->
<!-- 4. ROLLBACK PLAN POVINNÝ                         -->
<!--    Pro každou non-trivial feature. STAVAGENT     -->
<!--    je produkční systém s 1500+ commits — žádný   -->
<!--    deploy bez rollback story.                    -->
<!--                                                  -->
<!-- 5. MIGRATION TASKS SAMOSTATNĚ                    -->
<!--    DB migrace nikdy ne v rámci feature commitu.  -->
<!--    Reversibility flag explicitně.                -->
<!--                                                  -->
<!-- 6. EFFORT je orientační                          -->
<!--    Ne přesný odhad. S/M/L stačí.                 -->
<!-- ============================================== -->

---

## 11. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial task breakdown |
