# Next Session — Handoff Notes

**Last session closed:** 2026-04-20
**Last task completed:** Task 1 — "Calculator TZ-context lock when opened from Monolit Planner"
**Branch:** `claude/task-01-tzcontext-lock` (PR pending on `main`)

---

## What shipped in this session (Task 1)

### Scope
Bug: when the calculator is opened from a Monolit Planner position (e.g.
pozice `272325 ZÁKLADY ŽELEZOBETON` under bridge object SO-202), pasting TZ
of the whole bridge object into the Smart Extractor would silently overwrite
`element_type` from `zaklady_piliru` to `mostovkova_deska` because the TZ
contained the keywords "mostovka" / "rozpětí". Similar collateral overwrites
happened to `volume_m3`, `is_prestressed`, `span_m`, etc.

### Fix (3 layers)

**1. Compatibility map (engine layer)**
- `shared/src/classifiers/element-classifier.ts`: added `ELEMENT_TZ_COMPATIBILITY`
  Record<24 element_types, TzParamName[]>, `TzParamName` union,
  `isParamCompatibleWith(param, elementType)` helper and
  `explainIncompatibility(param, elementType)` returning Czech reason text.
- `UNIVERSAL_TZ_PARAMS` (always applied): concrete_class, exposure_class,
  volume_m3, formwork_area_m2, reinforcement_total_kg, reinforcement_ratio_kg_m3.
- `BRIDGE_DECK_TZ_PARAMS` (mostovkova_deska + rigel only): span_m, num_spans,
  nk_width_m, total_length_m, bridge_deck_subtype, is_prestressed,
  prestress_tensioning, prestress_cables_count, prestress_strands_per_cable,
  thickness_mm.
- `pile_diameter_mm` → pilota only.
- `height_m` / `total_length_m` / `thickness_mm` per-element.
- `element_type` intentionally NEVER in any compat list (locked-only field
  when opened from Monolit).

**2. Lock detection (hook layer)**
- `frontend/src/components/calculator/useCalculator.ts` exposes
  `isTzContextLocked: boolean` (strict marker — `position_id` URL param
  present) and `lockedFieldSet: ReadonlySet<string>` containing
  `element_type + volume_m3` when locked, empty otherwise.
- Plumbed through `PlannerPage → CalculatorSidebar → CalculatorFormFields +
  TzTextInput`.

**3. UI + apply filter (component layer)**
- `TzTextInput.tsx` applyParams now triages each extracted param into:
  - `applicable[]` — applied to form
  - `ignored[]` — with reason: `locked` | `incompatible` | `already_filled`
- Fill policy: "fill only if currently empty / default" (user design decision).
- UI: amber 🔒 lock banner when scenario A, per-row "(uzamčeno/jiný typ/už
  vyplněno)" tags on ignored params, post-apply feedback pill with
  applied-count (green) + ignored-count (gray, expandable to list reasons).
- `CalculatorSidebar.tsx`: element_type `<select>` is `disabled` +
  slate-100 background + tooltip when locked.
- `CalculatorFormFields.tsx`: volume_m3 `NumInput` gets `pointerEvents:none`
  + cursor:not-allowed + onChange early-return + 🔒 hint below when locked.
  (NumInput has no `disabled` prop in its current API — guarded via style +
  guard clause instead.)

### Tests
+14 new vitest cases in `element-classifier.test.ts`:
- 7 for `isParamCompatibleWith()` (universal-always, bridge-only-rejected-by-
  foundations, bridge-accepted-by-mostovka+rigel, pile_diameter_mm scope,
  total_length_m scope, height_m scope, element_type-never-in-lists,
  unknown-defaults-to-allow, all-24-types-covered)
- 5 for `explainIncompatibility()` (null-when-compatible, bridge reason text,
  pile reason text, **VP4 regression** opěrná zeď bugfix, **AC 10 regression**
  ZÁKLADY + bridge TZ — primary test for the headline bug)

Totals: **921 → 935 shared tests pass**. Shared + frontend tsc clean
(frontend preexisting errors from missing node_modules are untouched).

### Behavior summary

| Scenario | URL marker | element_type lock | volume_m3 lock | TZ params |
|---|---|---|---|---|
| A: from Monolit | `?position_id=xxx` | locked | locked | universal + compat-only + fill-if-empty |
| B: standalone | no position_id | editable | editable | all compat + fill-if-empty |

---

## How to verify live after deploy

1. Open `kalkulator.stavagent.cz/planner?position_id=<real>&part_name=ZÁKLADY+PILÍŘE&volume_m3=94`.
2. Expect: amber 🔒 banner on TZ input, element_type dropdown greyed out,
   volume field greyed out with `pointer-events:none`.
3. Paste bridge TZ containing "rozpětí 32 m, L=160 m, 5 polí, předpjatá,
   dvoutrám, C35/45 XF2".
4. Click "Převzít": expect `concrete_class`=C35/45, `exposure_class`=XF2
   applied (universal). `span_m/num_spans/bridge_deck_subtype/is_prestressed`
   land in the ignored list with "jiný typ" badges.
5. Expandable "⊘ Ignorováno: N" should list each rejected param with
   Czech reason ending "nepoužije se pro „Základy pilíře"."

---

## Known gaps / deferred items

- NumInput API has no `disabled` prop — current workaround is
  `pointer-events:none` + onChange guard. If designers want a proper
  `disabled` attribute on the underlying `<input>`, extend `ui.tsx
  NumInput` signature in a follow-up. Low priority (UX effect is correct).
- The "already_filled" reason is evaluated against live `form` state, which
  captures BOTH the Monolit-preloaded values AND any user edits — so
  re-pasting the same TZ after a first "Převzít" will show most fields as
  "už vyplněno" (correct behavior, matches spec).
- Scenario B (standalone) still allows extractor-derived `element_type` /
  `volume_m3` to apply — lockedFieldSet is empty there. If we ever want
  "always protect user-set element_type even in standalone", tighten the
  filter. Not requested in Task 1.
- Did NOT touch AI advisor (separate param flow). Its `calculator_context`
  is already derived from `form` state, so the lock propagates naturally —
  advisor won't see phantom span_m etc. because those don't get written
  into form.
- PR not opened yet at time of writing this file — follow the "commit +
  push + open PR" step below.

---

## Next session starting points (suggested)

Pick ONE of these, in order of remaining user backlog:
1. **P1: Fix "Jen problémy" filter** — `stavagent-portal/routes/positions.js:150`
   inverted predicate. 1-line diff + regression test. ~15 min.
2. **P1: Bridge formwork whitelist** — AI still recommends Dokaflex for
   mostovka in some cases. Add backend filter `BRIDGE_FORMWORK_WHITELIST`
   (Framax/Top 50/Staxo) applied when
   `element_type ∈ {mostovkova_deska, rimsa}`. ~1h.
3. **P1: Validation + warnings Phase 2** (deferred from v4.22) — introduce
   `warnings_structured: Array<{severity, message, category}>`, migrate UI
   renderers, gate "Vypočítat plán" on critical warnings. ~4–5h.
4. **P2: SmartInput PDF pipeline** — MinerU OCR integration for uploaded
   PDFs, chunked extraction, cross-document fusion. ~4h + infra work.

---

## Session admin

- CLAUDE.md NOT bumped (Task 1 is UX-level polish, not engine behavior
  that needs documentation). Add a short note under "Calculator UX" in a
  follow-up if desired: "v4.24.x: TZ context lock — compatibility map +
  position_id marker + ignored-param UI feedback".
- Branch: `claude/task-01-tzcontext-lock`
- Commit message convention: `FEAT: TZ context lock — compat map +
  Scenario A field gate (Task 1)`.
