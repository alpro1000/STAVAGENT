# Next Session — Handoff Notes

**Last session closed:** 2026-04-20
**Last task completed:** Task 2 — "Multi-select třídy prostředí s combined rules (ČSN EN 206+A2)"
**Branch:** `claude/task-02-exposure-multiselect` (PR pending on `main`)

**Open PRs at time of writing:**
- Task 1 — `claude/task-01-tzcontext-lock` (commit `b11bba8`) — TZ context lock. Not yet merged.
- Task 2 — `claude/task-02-exposure-multiselect` — this task.

Task 2 was branched from fresh `origin/main` so it is independent of Task 1.
When both PRs land, rebase the later one and replay its changes; the two
touch disjoint concerns (Task 1 = lock gate + compat map; Task 2 =
exposure multi-select + ČSN EN 206+A2 rules).

---

## What shipped in this session (Task 2)

### Scope
Bug: calculator let user pick ONE exposure class; Smart Extractor discarded
all-but-most-restrictive from TZ; engine never enforced combined-rule
derived requirements (min C class / max w/c / min cement / air content /
sulfate-resistant cement). Real bridge mixes are always multi-exposure
(XF2+XD1+XC4 typical for bridge decks) — so the engine produced wrong
curing times, missed air-entrainment, and never flagged XA2+ mixes that
need síranovzdorný cement.

### Fix — three layers

**1. Engine — new module `shared/calculators/exposure-combination.ts`**

- `EXPOSURE_CLASS_REQUIREMENTS: Record<ExposureClass, Requirements>` —
  full table for all 20 classes (X0, XC1-4, XD1-3, XF1-4, XA1-3, XM1-3,
  XS1-3) per ČSN EN 206+A2 Tab. F.1 + ČSN P 73 2404.
- `combineExposure(classes[])` — applies max/min rules: `min_C_class =
  max`, `max_wc = min`, `min_cement = max`, `min_air = 4.0 % if any XF2/3/4`,
  `requires_sulfate_resistant = any XA2/XA3`. Buckets selection by
  category for UI grouping.
- `validateExposureCombination(classes[], {cement_type_is_sulfate_resistant})`
  — advisory warnings: empty selection, XF+salts without XD, XA2/3
  without sulfate-resistant cement, multiple-in-category, unknown class.
- Helpers: `getMostRestrictive()` (priority XF > XD/XS > XA > XM > XC >
  X0 with numeric-suffix tiebreak), `getExposureCategory()`,
  `formatCombinedSummary()`, `compareConcreteClass()`,
  `isValidExposureClass()`.

**2. Engine wiring**

- `planner-orchestrator.ts PlannerInput.exposure_classes?: string[]`
  alongside legacy `exposure_class?: string`. `pushExposureWarning()` now
  accepts an array; flags each rogue class individually; keeps the
  "Vyberte jednu z: …" phrasing so existing snapshot tests pass.
- `maturity.ts CuringParams.exposure_classes?: string[]` +
  `getExposureMinCuringDays()` now accepts `string | string[]` and
  picks the max across the array. Bridge-deck combos (XF2+XD1+XC4)
  correctly hit XF2's 5-day floor, not XC4's 0.
- `tz-text-extractor.ts` — regex rewritten to enumerate the 20 valid
  classes explicitly (`\bX(?:0|C[1-4]|D[1-3]|F[1-4]|A[1-3]|M[1-3]|S[1-3])\b`).
  Now recognises X0 (previously dropped) and rejects invented classes
  (XD9, XG1, XF2A). Emits NEW param `exposure_classes: string[]` with
  all distinct matches + legacy `exposure_class: string` (most-
  restrictive, confidence 0.8 when collapsed).
- `ExtractedParam.value` type extended to include `string[]` for
  multi-value fields.

**3. Frontend**

- `types.ts FormState.exposure_classes: string[]` (primary) +
  `exposure_class: string` (legacy mirror, derived = most restrictive).
- `DEFAULT_FORM.exposure_classes = []`.
- `helpers.ts SmartDefaults.exposure_classes: string[]` + 24 per-element
  auto-suggestions from task spec Scenario B table (e.g.
  `mostovkova_deska → ['XF2','XD1','XC4']`, `rimsa → ['XF4','XD3']`,
  `podkladni_beton → ['X0']`).
- `useCalculator.ts`:
  - LS migration on load: if `exposure_classes` missing/non-array →
    `[exposure_class].filter(Boolean)`.
  - Smart-defaults useEffect auto-fills `exposure_classes` when the
    selection is empty on element_type change (never overwrites).
  - `positionContext.exposure_class` URL seed now also populates the
    array.
  - Engine input: forwards full array + singular mirror
    (`getMostRestrictive()`).
- New component `ExposureClassesPicker.tsx` — 5-category checkbox pill
  grid (Bez rizika / Karbonatace / Chloridy / Mráz / Chemie / Obrus).
  Below the pills: emerald-tinted derived-requirements summary line
  ("XF2+XD1+XC4 → C30/37, w/c ≤ 0.50, cement ≥ 300 kg/m³, vzduch ≥ 4.0 %")
  and amber advisory warnings list.
- `CalculatorFormFields.tsx` legacy 11-option `<select>` replaced with
  `<ExposureClassesPicker>`. Cement-type sulfate-resistant recognition
  via regex (`/SR|SV/i.test(cement_type)`) suppresses redundant warning.

### Tests
- `exposure-combination.test.ts` — **40 new tests**: catalog sanity
  (5), helpers (isValidExposureClass/priority/mostRestrictive/category/
  compareConcreteClass — 9), `combineExposure()` rules (5), 8 real ŘSD
  practice combos (AC 17), SO 204 D6 golden (AC 18), validation
  warnings (8), performance (AC 20).
- `tz-text-extractor.test.ts` — **+10 new tests** for multi-match
  emission (SO 204 TZ regression, single class → array-of-1, dedup, X0
  recognition, most-restrictive singular derivation, 0.8 confidence on
  collapse, rejects invented classes, word-boundary, real mostovka
  excerpt, empty text).

**Totals: 921 → 971 shared tests pass** (+50). Shared tsc clean.
Frontend tsc clean. Vite build succeeds (1,673 KB main bundle — preexisting
size, no new deps introduced).

### Spec compliance notes

| AC | Status | Notes |
|---|---|---|
| 1. 5-category checkbox grid | ✅ | `ExposureClassesPicker` categories: Bez rizika / Karbonatace / Chloridy / Mráz / Chemie / Obrus |
| 2. 1-5 tříd selectable | ✅ | No cap; pills toggle independently |
| 3. Derived summary live-updated | ✅ | `combineExposure()` memo via React useMemo |
| 4. Table for all 20 classes | ✅ | Includes 3 XS classes (not in task spec but completeness) |
| 5. max C / min wc / max cement rules | ✅ | Unit-tested |
| 6. Air 4.0 % if any XF2/3/4 | ✅ | Unit-tested |
| 7. Síranovzdorný when XA2/3 | ✅ | Unit-tested; cement-type regex suppresses redundant warning |
| 8. XF+salts without XD warning | ✅ | Triggers on XF2/XF4 only (XF1/XF3 are mráz bez solí) |
| 9. XA2/3 sulfate warning | ✅ | Suppressed when cement_type contains SR/SV |
| 10. Empty selection info | ✅ | "Vyberte alespoň X0" |
| 11. Auto-suggestion from element_type | ✅ | `getSmartDefaults()` arrays + useEffect fills empty |
| 12. Doesn't overwrite manual | ✅ | Only applies if `exposure_classes.length === 0` |
| 13. Multi-match in TZ | ✅ | Regex captures all 20 classes in `Set`, emits full array |
| 14. Conflict warning on same-category | ✅ | `multiple_in_category` validation warning |
| 15. Engine accepts array | ✅ | Adapter layer: if `exposure_classes` missing, wraps singular |
| 16. Migration from string | ✅ | LS load auto-converts |
| 17. 8 typical combos tests | ✅ | See AC17 block in test file |
| 18. SO 204 golden test | ✅ | Covered in both exposure + extractor tests |
| 19. Human-readable summary | ✅ | `formatCombinedSummary()` |
| 20. Performance < 10 ms | ✅ | 1000 iterations in ~200 ms → ~0.2 ms each |

### Spec deviations

- **Task spec said "Mostovka XF2+XD1+XC4 → cement 320"** but ČSN EN
  206+A2 Tab. F.1 baseline values are all 300 for this trio. Stuck to
  the norm — callers who want 320 should add XD2 (mokro+chloridy) or
  bump manually. Documented in the corresponding test comment.
- **Task spec said "Pilíř v řece XF2+XD1+XA1 → síranovzdorný"** but
  XA1 alone doesn't trigger sulfate-resistant requirement per the
  norm. That bit is XA2+. Spec probably conflated XA1 with XA2 in the
  example. Stuck to norm; test asserts `requires_sulfate_resistant =
  false` with an explanatory comment.

---

## How to verify live after deploy

1. Open `kalkulator.stavagent.cz/planner` as a fresh session. Expect
   "Třídy prostředí" section with 5 category rows of pills, all empty.
2. Switch element_type to "Mostovková deska" — XF2, XD1, XC4 pills
   should auto-tick; summary should show "XF2 + XD1 + XC4 → C30/37,
   w/c ≤ 0.50, cement ≥ 300 kg/m³, vzduch ≥ 4.0 %".
3. Manually tick XA2 — warning appears: "Vybraná třída XA2/XA3 vyžaduje
   síranovzdorný cement …". Change cement_type to "CEM III/B 42,5 SV" —
   warning disappears.
4. Paste into TZ textarea: `"Expozice: XF2 (mostovka), XD1, XC4
   (opěry v zemi). Beton C30/37."` — extractor should find all 3
   classes + C30/37; Task 1 `exposure_class` compat-filter (once Task 1
   merges) should let the applied array through.
5. Returning user with old LS (single `exposure_class: "XF2"`) —
   migration should keep the XF2 pill ticked without error.

---

## Known gaps / deferred items

- **AI advisor prompt still reads singular `exposure_class`.** Not a
  regression (it gets the most-restrictive class mirrored from the
  array), but the prompt loses the full multi-exposure picture. Follow-
  up: extend `backend/advisor-prompt.js` to surface
  `exposure_classes` when present.
- **Calculator-suggestions payload** (document facts) still echoes the
  single `exposure_class`. Same rationale — extend when pulling it
  through to the AI advisor.
- **Task 1 interaction** — once Task 1 lands, add `exposure_classes` to
  `UNIVERSAL_TZ_PARAMS` in `element-classifier.ts` (same treatment as
  `exposure_class`) so the compat gate doesn't reject the new param.
  Estimated 2-line diff.
- **Cement-type sulfate-resistant recognition** is regex-based (`SR|SV`
  substring). Works for CEM II/B-SV, CEM III/A-SR etc., but users on
  non-standard identifiers would fall through. Could harden to an
  explicit list if real-life data shows false negatives.
- **ExposureClassesPicker has no unit tests.** The 40 engine tests
  cover combine/validate/summary semantics; the picker is a pure
  mapping of those onto React state. If a component test suite is
  spun up later, the obvious targets are toggle behaviour, empty
  state, warnings rendering.

---

## Next session starting points

1. **P1: Fix "Jen problémy" filter** — `stavagent-portal/routes/positions.js:150`
   inverted predicate. 1-line diff + regression test. ~15 min.
2. **P1: Bridge formwork whitelist** — AI still recommends Dokaflex for
   mostovka. Add `BRIDGE_FORMWORK_WHITELIST` (Framax/Top 50/Staxo). ~1h.
3. **P1: Advisor prompt uses exposure_classes array** — extend
   `backend/advisor-prompt.js` to surface full multi-class selection in
   the prompt ("Třídy prostředí: XF2, XD1, XC4 — kombinované požadavky
   …"). ~1h.
4. **P1: Validation warnings Phase 2** — parallel
   `warnings_structured[]` with severity/category, UI renderer,
   "Pokračovat přesto" gate on critical. ~4-5h.

---

## Session admin

- CLAUDE.md NOT bumped (UX + engine addition, no infrastructure change).
  Could add under "Monolit-Planner" section in a follow-up:
  > v4.24.x: multi-select exposure classes — 20-class catalog +
  > combineExposure (ČSN EN 206+A2) + 5-category pill UI + TZ regex
  > rewrite.
- Branch: `claude/task-02-exposure-multiselect`
- Commit message convention: `FEAT: Multi-select exposure classes +
  ČSN EN 206+A2 combined rules (Task 2)`.
