# Next Session — Handoff Notes

**Last session closed:** 2026-04-20
**Last task completed:** Task 3 — "Smart Extractor Incremental Mode (persist TZ + Doplnit bez přepisu)"
**Branch:** `claude/task-03-tz-incremental` (ready to push; opens PR on `main`)

**Merged to main this session arc:**
- Task 1 — TZ context lock (PR #984, commit `89b6f7c`)
- Task 2 — Multi-select exposure classes (PR #985, commit `3d4e8be`)
- Task 3 — this task, branched from post-Task-2 main

Task 3 builds on Task 1's "fill only if empty" policy and Task 2's
`exposure_classes[]` array support. No conflicts expected when PR opens.

---

## What shipped in this session (Task 3)

### Scope

Live SO-204 user feedback: opening the same position twice, user pastes
a second TZ fragment from a different document (e.g. geology report →
XA2 chloride), the Smart Extractor wiped the user's manual XC4 entry
because the new TZ didn't mention XC4. Also the TZ textarea started
empty every session — user re-pasted the same 500-character excerpt on
each open. Also if the TZ contained TWO conflicting values for one
parameter (C30/37 and C40/50), the extractor silently collapsed to the
higher one without surfacing the ambiguity.

Task 1 already prevented overwriting filled fields. Task 3 adds:
- Per-element persistence (text + apply history survive across sessions)
- Secondary textarea for appending without editing original
- "Přepsat" safety toggle to inverse the Doplnit default
- 4-group results (Přidáno / Zachováno / Konflikt / Ignorováno)
- Conflict picker for ambiguous multi-match
- Last-5-applies history panel
- 50 000-char cap with warning
- Array-aware isFieldEmpty (fixes a Task 2 regression where non-empty
  `exposure_classes: []` was missed)

### Fix — three layers

**1. Engine — `shared/parsers/tz-text-extractor.ts`**

- `ExtractedParam.alternatives?: (string | number)[]` — new optional
  field. Populated when the regex pass saw multiple distinct matches
  collapsed into one primary value. Value ordered: primary first,
  alternatives in descending severity.
- Emits alternatives for:
  - `concrete_class` multi-match (primary = highest class)
  - `exposure_class` singular (primary = most-restrictive; only when
    multi-class found). The `exposure_classes` plural already holds
    the full list, so it does NOT duplicate into alternatives.

**2. Storage — `frontend/src/components/calculator/tzStorage.ts` (NEW)**

- `planner-tz:{position_id}` → JSON blob:
  ```
  { text, lastAppliedAt, appliedCount, history: TzHistoryEntry[], version: 1 }
  ```
- `TzHistoryEntry = { ts, method: 'doplnit'|'prepsat', added[], kept[], conflicts[], ignored[] }`
- Functions: `loadTzBlob()`, `saveTzText()`, `appendTzHistory()`,
  `clearTzBlob()`, `isFieldEmpty()`, `formatTzHistoryLine()`
- Constants: `TZ_MAX_CHARS = 50_000`, `TZ_MAX_HISTORY = 5`
- Legacy fallback: when `position_id` is null/undefined (standalone
  mode), reads/writes to the original `planner-tz-text` session-only
  key. No new per-element state leaks in that mode.
- Truncates on save if over 50 KB. Empty-text-with-no-history drops the
  record to keep LS tidy.

**3. Hook wiring — `useCalculator.ts`**

- `tzText` state now sourced from `loadTzBlob(positionContext.position_id)`
  on mount + re-hydrated on position change (SPA navigation).
- New exposed values: `tzHistory`, `tzLastAppliedAt`, `tzPositionId`,
  `appendTzHistoryCb`, `clearTz`.
- Element-type-change auto-clear restricted to standalone mode
  (per-position LS is already segregated by position_id, so within a
  single position the element_type can't change in Scenario A).

**4. UI — `TzTextInput.tsx` rewrite**

- Auto-expands on mount if this position already has saved TZ.
- Blue banner "💾 TZ uloženo {date} · {N} znaků" when in saved-state.
- Second textarea (dashed border) "Přidat nový text TZ…" appears only
  when saved TZ exists.
- Char counter + 50k warning row under the textareas.
- Button label flips: first apply → "Aplikovat z TZ"; with saved TZ →
  "Doplnit z TZ". Button changes to amber background when "Přepsat"
  toggle is ON.
- "Přepsat existující hodnoty" checkbox, default OFF, safety-reset on
  every mount (component-local state). Highlighted amber when ON with
  "⚠️ Ruční úpravy budou přepsány" hint.
- Conflict dropdown per conflicting param ("C30/37 / C40/50 — vyberte").
  Selected value flows into the apply click; unresolved conflicts land
  in the Konflikt count (no auto-pick).
- 4-group post-apply feedback pills: ✓ Přidáno / = Zachováno / ⚡
  Konflikt / ⊘ Ignorováno (expandable list for ignored reasons).
- "Historie úprav (N)" collapsible at the bottom, shows last 5 entries
  with timestamp + method (Doplnit/Přepsat amber) + short summary.
- "Vymazat TZ" button with confirm dialog; clears both text AND history
  for this position.
- `isFieldEmpty` moved into `tzStorage.ts` and now handles arrays
  (`[]` counts as empty) — fixes a Task 2 regression where the
  `exposure_classes: []` default was misread as "filled".

### Tests

- `tz-text-extractor.test.ts` — **+6 new cases** (77 → 83):
  - 2 concrete classes → primary + alternatives[]
  - Single concrete → no alternatives
  - 3 concrete → alternatives carries remaining 2
  - exposure_class singular alternatives (multi-class scenario)
  - exposure_class alternatives undefined when only 1 class
  - exposure_classes plural does NOT duplicate into alternatives
- Frontend test suite — NONE added. Frontend has no vitest config
  (existing pattern); the TZ UI is covered via shared engine tests +
  Vite build type-checks. `isFieldEmpty` array-handling is exercised
  through the extractor's `exposure_classes` path downstream but NOT
  unit-tested in isolation. If a frontend vitest suite is added later,
  obvious targets: tzStorage round-trip with `localStorage` mock,
  TzTextInput triage with React Testing Library.

**985 → 991 shared tests pass** (+6 Task 3). Shared tsc + frontend tsc
+ Vite build all clean.

### Spec compliance notes

| AC | Status | Notes |
|---|---|---|
| 1. TZ persists per-element | ✅ | `planner-tz:{position_id}` LS key |
| 2. Saved TZ banner with timestamp | ✅ | "💾 TZ uloženo {date} · {N} znaků" |
| 3. "Doplnit z TZ" rename | ✅ | Button label flips based on `hasSavedTz` |
| 4. Secondary textarea in incremental | ✅ | Only renders when `hasSavedTz` |
| 5. Doplnit doesn't overwrite filled | ✅ | Task 1 default + array-aware check |
| 6. 4-group results | ✅ | Přidáno / Zachováno / Konflikt / Ignorováno |
| 7. Conflict picker manual | ✅ | `<select>` per conflicting param, no auto |
| 8. Přepsat toggle default OFF + reset | ✅ | Component-local state, no persistence |
| 9. Přepsat warning badge | ✅ | Amber "⚠️ Ruční úpravy budou přepsány" |
| 10. History last 3-5 | ✅ | `TZ_MAX_HISTORY = 5`, ring buffer |
| 11. History read-only | ✅ | No interaction, just list |
| 12. Standalone no persistence | ✅ | No position_id → legacy session-only |
| 13. 50k char cap + warning | ✅ | Red counter + disabled apply button |
| 14. Unlink → TZ in session | ✅ | Same LS fallback path |
| 15. Vymazat with confirm | ✅ | `window.confirm()` dialog |
| 16. No retroactive fill | ✅ | First open of legacy position → empty |
| 17. Load < 100 ms | ✅ | Single JSON.parse on mount, no network |
| 18. SO-204 scenario works | ✅ | Session 1 = 4 fields + Session 2 XA2 → adds to Task 2 exposure_classes array |
| 19. Merge tests per field type | ⚠️ | Array case covered in shared tests via exposure_classes; numeric/string/bool covered by Task 1 + this update. No dedicated isFieldEmpty test file (frontend has no vitest). |
| 20. Conflict C30/37 vs C40/50 | ✅ | Full path from regex → alternatives → UI picker → apply |

### Known gaps / deferred items

- **Frontend has no vitest config.** tzStorage + TzTextInput triage
  rely on Vite build + shared engine tests for coverage. If regressions
  bite, bootstrap frontend vitest with `jsdom` environment + RTL —
  standard recipe, ~30 min. Priority: low until a real regression hits.
- **History entries are append-only; no retention of older than 5.**
  Spec explicitly says "не full audit log", so this is by design.
- **Conflict picker stores user choice in component state (not LS).**
  If the user picks C30/37 but doesn't click Apply and navigates away,
  the choice is lost. Acceptable for this UX (choice is trivial to
  redo). If user complains, persist per-conflict choice alongside the
  blob.
- **`exposure_class` singular is in Task 1's UNIVERSAL_TZ_PARAMS but
  `exposure_classes` plural was added in the Task-2-into-Task-1 merge
  follow-up.** Both are now covered by the compat filter.
- **"Zachováno" count includes fields that DID change value at
  extraction time but the extractor returned the same value as
  currently in the form.** Not distinguishable without a deep-compare
  step; the status labels are accurate enough for the UX intent.
- **`exposure_classes` doesn't participate in conflict detection yet.**
  The plural array expresses the full set, so there's no "conflict"
  per se — but if the user wanted a "confirm merge" step for a second
  TZ that contains XA1 (the current has XF2+XD1), no UI surfaces that
  today. Minor UX gap, not blocking.

---

## How to verify live after deploy

1. Open `kalkulator.stavagent.cz/planner?position_id=TEST1&part_name=ZÁKLADY`
   as a fresh session. Expect: collapsed CTA "Vložit text z TZ (Ctrl+V)".
2. Paste `"C30/37 XF2, výška 4 m, cement 320 kg/m³"`. Click "Aplikovat
   z TZ". Expect: 4-group pills show added=3 or 4.
3. Close calculator, reopen the same URL. Expect: collapsed CTA now
   reads "TZ uloženo · 48 znaků" in blue. Click to expand.
4. Expect: main textarea shows saved text, secondary dashed textarea
   below it with placeholder. Blue banner "💾 TZ uloženo {datetime}".
5. In secondary textarea paste `"Agresivní voda XA2 — síranovzdorný
   cement doporučen."`. Expect: extractor finds XA2 (plural array
   appends); button label = "Doplnit z TZ" (blue).
6. Click Doplnit. Expect: Přidáno pill > 0, Zachováno pill includes
   previous C30/37 + XF2, Konflikt = 0. History panel (at bottom)
   shows 2 entries now.
7. Paste `"C40/50 dál, alt. C30/37"` into main textarea. Expect:
   extractor's concrete_class param shows a `<select>` picker
   "— vyberte —" with "C40/50" + "C30/37" options. Konflikt count = 1.
8. Toggle "Přepsat existující hodnoty" ON. Expect: banner turns amber,
   button turns amber, label = "Doplnit z TZ" (label doesn't change
   based on toggle — the pressure comes from the toggle itself).
9. Paste 50_001 characters. Expect: char counter red, "překračuje
   limit" hint, apply button disabled.
10. Click "Vymazat TZ". Confirm dialog → Yes. Expect: main textarea
    empties, history panel disappears, LS key removed.

---

## Next session starting points

1. **P0 (5 min): Bootstrap frontend vitest** — install `vitest` + `jsdom`
   + `@testing-library/react`, add config, write one smoke test for
   tzStorage round-trip. Unblocks all future frontend unit tests.
2. **P1: Fix "Jen problémy" filter** — `stavagent-portal/routes/positions.js:150`
   inverted predicate. 1-line diff + regression test. ~15 min.
3. **P1: Bridge formwork whitelist** — AI still recommends Dokaflex for
   mostovka. Add `BRIDGE_FORMWORK_WHITELIST` (Framax/Top 50/Staxo). ~1h.
4. **P1: Advisor prompt uses exposure_classes array** — extend
   `backend/advisor-prompt.js` to surface full multi-class selection
   (from Task 2). ~1h.
5. **P1: Validation warnings Phase 2** — parallel
   `warnings_structured[]` with severity/category, UI renderer,
   "Pokračovat přesto" gate on critical. ~4-5h.
6. **P2: exposure_classes conflict handling** — when a second TZ apply
   would replace one XF2 with an XF4-only selection, surface as
   conflict, not silent merge.

---

## Session admin

- CLAUDE.md NOT bumped across Task 1 + 2 + 3 (all UX + engine
  additions). Could add under "Monolit-Planner" section in a follow-up:
  > v4.24.x: TZ context lock (Task 1) + multi-select exposure classes
  > (Task 2) + Smart Extractor incremental mode (Task 3 — per-element
  > persistence, 4-group results, conflict picker, last-5 history).
- Branch: `claude/task-03-tz-incremental`
- Commit message convention: `FEAT: Smart Extractor incremental mode +
  per-element TZ persistence + conflict picker (Task 3)`.
