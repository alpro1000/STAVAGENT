# Říms Phase A — Closing Addendum (post-decisions)

**Datum:** 2026-05-21
**Branch:** `claude/rimsa-calibration-phase-a`
**Related:**
- `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md` (main audit)
- `docs/architecture/mcp_calculator_boundary.md` (Q7 boundary read)
- `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md` (task spec)

This addendum records Alexandra's answers to the 8 open questions and the two follow-up actions that gate Phase C (Q4 repro + Q7 boundary read). Both are now complete; Phase A → Phase C gate is **GREEN**.

---

## Decisions (Q1–Q8)

| # | Decision | Action |
|---|---|---|
| Q1 | Task spec updated to point at existing `test-data/SO_250/tz/SO-250.md`. Vitest wiring deferred to Phase G. | Task spec amended (this commit). |
| Q2 | Skip SO-206 fixture entirely. | No file created. SO-206 stays as DOKA nabídka 540045359 out-of-repo reference only. |
| Q3 | **For this task: TS catalog wins.** MCP HTTP-delegates. Migration to (c) "B4 YAML wins with CI drift check" deferred to a separate **Týden 3 codegen pipeline task**. | Phase C proceeds on TS catalog as canonical. |
| Q4 | 15-min repro complete. **Result: original subagent claim was FALSE — TS does thread `curing_class`.** But a deeper bug surfaced: TS and Python MCP `CURING_DAYS_TABLE` disagree on class 4 values (TS 5 d vs Python 9 d at 15-25°C C30+). See §Q4 repro below. | Bug logged as Phase C fix #1 (table divergence, not threading). |
| Q5 | Scheduler refactor gated behind opt-in `scheduler_mode` per element. Start rimsa only. Expand only after each element has golden test. | Phase C: introduce `scheduler_mode: 'discrete_cyclic' \| 'legacy'` flag; rimsa defaults to `discrete_cyclic`; everything else stays `legacy`. |
| Q6 | Confirmed scope: this task delivers `rimsa.yaml` + `T_bedneni.yaml` only. TKP 18 / ČSN EN 13670 / DIN 18218 extractions → separate **Týden 3** task. | `backlog/kb_norms_extraction.md` created (this commit). |
| Q7 | 30-min directed read of `app/mcp/tools/calculator.py` complete. Output: `docs/architecture/mcp_calculator_boundary.md`. | Architecture doc created (this commit). |
| Q8 | Comparison-table acceptance test dropped — stale expectation. Finding documented here. | See §Q8 closing note below. |

---

## Q4 repro — actual finding (audit subagent was wrong)

**Original subagent claim (in main audit §B.2):**
> `DEFAULT_CURING_CLASS[rimsa] = 4` exists in `maturity.ts:611` but is **not threaded** through `planner-orchestrator.ts:1652`. Net effect: rimsa likely computes ~5 d @ 15 °C instead of TKP18 §7.8.3-required 9 d.

**What the source actually says** (verified via direct read of `planner-orchestrator.ts:1535–1576`):

```typescript
// Line 1536
const effectiveCuringClass: CuringClass = input.curing_class ?? getDefaultCuringClass(elementType);

// Line 1544 (used in maturityParams for curing)
curing_class: effectiveCuringClass,

// Line 1570 (used in maturityForStrip for strip-strength calc)
curing_class: effectiveCuringClass,
```

⇒ `curing_class` **IS threaded** through both `calculateCuring` call sites for rimsa. Auto-derivation via `getDefaultCuringClass(elementType)` falls back to `2` only when both `input.curing_class` is `undefined` and the element is not in `DEFAULT_CURING_CLASS` — but rimsa IS in the map (line 614: `rimsa: 4`). So rimsa always gets class 4 in the TS engine path.

**Why does the result still come out wrong?** Because the table values themselves diverge.

`maturity.ts:192–196` — 15°C ≤ t < 25°C row:
```typescript
'C12-C16': { 2: 3,   3: 5,   4: 10 },
'C20-C25': { 2: 2,   3: 4,   4: 9 },
'C30+':    { 2: 1.5, 3: 2.5, 4: 5 },
```

`calculator.py:48–52` (Python MCP fallback):
```python
CURING_DAYS_TABLE = {
    (4, ">=25"): 5, (4, "15-25"): 9, (4, "10-15"): 13, (4, "5-10"): 18,
}
```

| Input | TS engine path | Python MCP fallback | Task expectation |
|---|---|---|---|
| rimsa, C30/37, 15°C, class 4 | **5 d** | **9 d** | 9 d |
| rimsa, C30/37, 10°C, class 4 | 7 d | 13 d | — |
| rimsa, C30/37, 5°C, class 4 | 9 d | 18 d | — |

The Python MCP table also lacks a concrete-group axis (it returns the same value for any concrete class), which is a separate bug from the other direction.

**Net conclusion for Phase C:** the threading is correct, the **TS table values are suspect**. Verification against the actual TKP18 §7.8.3 source is required before deciding which side to fix. Two hypotheses:
- (a) TS table is correct, Python is over-conservative (and the task spec quoting "9 d @ 15 °C" is informal). Curing of class-4 C30+ concrete at 15-25 °C only takes 5 days because high cement content + warm temp accelerates Saul maturity.
- (b) Python is correct, TS table was carried over from an older draft and the C30+ row collapses temp dependence too aggressively.

Either way: Phase C fix #1 = reconcile to a single table sourced from `B7_regulations/tkp_18_rsd_2024/extracted.yaml` (per Q6, that YAML extraction is a Týden 3 deliverable — Phase C just inlines the agreed values and ships one table).

---

## Q8 closing note — comparison table acceptance test dropped

Task §A.6 expected to filter a "tabulka porovnání bednění" UI component so that for `element_type=rimsa` only the 3 rimsa systems are listed and {Frami Xlife, Framax Xlife, MAXIMO, VARIO GT 24, Dokaflex, SKYDECK, Top 50, Staxo 100} are hidden.

**Audit finding:** no such standalone comparison-table component exists in the frontend. The filter happens earlier — at the data-fetch layer (`getSuitableSystemsForElement(elementType)` in `shared/src/classifiers/element-classifier.ts`). That function short-circuits for rimsa, returning ONLY `['Římsové bednění T', 'Římsový vozík TU', 'Římsový vozík T']` from `ELEMENT_CATALOG.rimsa.recommended_formwork`. No downstream UI ever sees the irrelevant wall/slab systems for `elementType === 'rimsa'`.

⇒ The task's HIDE list cannot be wrongly displayed. The acceptance test is unreachable. **Dropped from Phase A.6 scope.**

`CalculatorResult.tsx:215` has a per-user variant-comparison view, but that lists *user-saved snapshots*, not the catalog itself, so it's unrelated.

---

## Phase A → Phase C gate

**Status: GREEN.**

- ✅ Discovery audit complete (5 subagents)
- ✅ Q4 repro complete (subagent claim corrected, real bug logged)
- ✅ Q7 boundary read complete (`docs/architecture/mcp_calculator_boundary.md`)
- ✅ Q8 finding documented (comparison-table test dropped)
- ✅ Q6 backlog file created (`backlog/kb_norms_extraction.md`)
- ✅ Q1 task spec amended (SO-250 path corrected)

Phase C can kick off. Headline targets (carried from main audit + Q5 decision):

1. Introduce `scheduler_mode` opt-in flag per element. rimsa defaults to `discrete_cyclic`; legacy mode preserved everywhere else.
2. Fix `CURING_DAYS_TABLE` divergence — single source, agreed values per TKP18 §7.8.3.
3. Forward `exposure_class` + `curing_class` in MCP→Monolit HTTP payload (Phase F item, noted here for completeness).
4. Cyclic phase model: `setup × 1 + relocate × (n-1) + strip × 1`, last-tact-no-relocate, final-curing-tail only after last tact.
5. Discrete-shift scheduler (integer shifts, no fractional days).
6. Crew parallelism wiring through UI inputs.

**Recommended branch for Phase C:** `claude/rimsa-phase-c-scheduler-discrete-XXXXX`

---

**Author:** Phase A closing, 2026-05-21.
