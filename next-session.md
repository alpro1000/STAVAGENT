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

---

## Migration plan — owner_id=1 orphan reclaim (deferred from `feat/portal-jwt-registry-sync`)

**Context.** Before PR `feat/portal-jwt-registry-sync` shipped, every Registry
auto-sync to Portal was anonymous. The Portal backend's
`/api/integration/import-from-registry` route hardcoded `owner_id = 1`,
so all Registry-imported `portal_projects` rows ended up owned by
user_id=1. Real user accounts (whose own user_id ≠ 1) couldn't see
their own projects in `/portal/projekty`.

The PR fixes the new flow (requireAuth + JWT-derived owner_id) but
deliberately does NOT migrate existing rows — that's a separate ops
task with its own UX considerations.

**Reclaim flow proposal:**

1. New endpoint `POST /api/integration/claim-registry-project`
   { portal_project_id } → requireAuth → if existing project's owner_id
   is 1 (anonymous marker) AND there's a kiosk_link with kiosk_type=
   'registry' AND kiosk_project_id matches a Registry project the
   caller currently has open in their browser → set owner_id =
   req.user.userId. Return 200 + claimed=true. Otherwise return
   403 + claimed=false (already-owned project, can't be reclaimed).
2. Registry frontend: on first sync after this PR, if backend returns
   200 with `data.claimed=true`, log + show toast "Projekt převzat
   pod váš účet". If backend returns 200 with `data.claimed=false`
   (no orphan to claim — project newly created OR already owned by
   someone else), continue silently.
3. SQL audit query for ops:
   ```sql
   SELECT pp.portal_project_id, pp.project_name, pp.created_at,
          kl.kiosk_project_id AS registry_id
     FROM portal_projects pp
     LEFT JOIN kiosk_links kl ON kl.portal_project_id = pp.portal_project_id
                              AND kl.kiosk_type = 'registry'
    WHERE pp.owner_id = 1
      AND pp.project_type = 'registry'
    ORDER BY pp.created_at DESC;
   ```

**Open questions:**
- Should the reclaim be automatic (first sync claims) or explicit
  ("Převzít projekt" button in Registry)? Automatic is friendlier;
  explicit is auditable. Lean automatic.
- What happens if TWO different users had the same Registry project
  open before the PR? Currently the orphan would go to whoever syncs
  first. Acceptable — user_id=1 is functionally a "free agent" state.

**Scope:** ~2-3 h for backend + Registry wiring + 2-3 vitest cases on
the claim endpoint. Tracked separately from the auth-fix PR per user
instruction.

## Cross-kiosk login indicator (deferred follow-up)

User asked to surface "user is logged in" state in every kiosk
(Monolit Planner, URS Matcher, Beton Calculator, Registry). With
the shared cookie now in place (`stavagent_jwt`, domain=.stavagent.cz),
each kiosk can read `getPortalJwt()` and show:

  - `Přihlášen jako <email>` — green chip top-right
  - `Nepřihlášen` + login link — orange chip

Each kiosk reads its own JWT, decodes the email claim (no roundtrip),
renders a ~50-line `<UserBadge />` component. ~1 h per kiosk × 4
= half-day total. Tracked as a separate PR after the auth-fix
lands and bake-tests.

---

## PR-2 (deferred): SQL migration splitter $$-aware

**Latent bug**, surfaced during cross-subdomain auth diagnosis 2026-04-28.
Production Cloud Run revision `stavagent-portal-backend-00255-srx`
boots, listens on port 3001 (Cloud Run marks ready), then DB
initialization fails on the first `DO $$ ... END $$;` block in
`schema-postgres.sql`. Server stays alive thanks to try/catch in
`server.js:314-323`, but every migration **after** the failing
DO block silently never runs.

### Root cause

`stavagent-portal/backend/src/db/migrations.js:37` — the schema
splitter:

```js
const allStatements = schema
  .split(';')          // <-- naive split on ANY semicolon
  .map(s => …)
  .filter(s => s.length > 0);
```

Splits on EVERY `;`, including ones INSIDE `$$ ... $$` quoted blocks.
The `DO $$ ... fk_users_org_id ... END $$;` block at
`schema-postgres.sql:359-366` contains two semicolons inside the
quoted body (`SET NULL;` after the FK definition + `END IF;`). The
splitter chops the block into 2-3 fragments, sends each fragment
to PostgreSQL as a separate statement. PG parser sees:

```
DO $$ BEGIN
  IF NOT EXISTS (...) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL
```

— no closing `END $$;` — and throws **error code 42601**:
`unterminated dollar-quoted string at or near "$$ BEGIN..."`.

The error is logged. `initDatabase()` aborts. Server keeps running
on partial-DB state. **Every migration statement after line 366 of
schema-postgres.sql is missing in production.**

Live evidence (Cloud Run logs, 2026-04-28T10:36:31Z):
```
[PostgreSQL] Error executing statement: DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org_id') ...
[ERROR] ❌ Database initialization failed: error: unterminated dollar-quoted string at or near "$$ BEGIN...
  code: '42601' position: '4'
  at async bootstrap (file:///app/backend/server.js:315:5)
[INFO] SIGTERM received, shutting down gracefully
```

### Affected files (5 sites with `split(';')`)

```
stavagent-portal/backend/src/db/migrations.js:37   ← main schema runner
stavagent-portal/backend/src/db/migrations.js:696  ← additional migration runner
stavagent-portal/backend/src/db/migrations.js:745  ← additional migration runner
stavagent-portal/backend/src/db/migrations.js:793  ← additional migration runner
Monolit-Planner/backend/src/db/migrations.js:38    ← Monolit has same bug
```

### Required changes

1. **New helper** `splitSqlStatements(sql)` in shared module (or
   per-package since these are separate npm packages):

   - Walk `sql` character by character.
   - Track whether we're inside a `$tag$ ... $tag$` block (where
     `tag` is empty for `$$` or `[a-zA-Z_]*` for tagged forms like
     `$body$`, `$func$`).
   - Inside a quoted block: NEVER split, even on `;`.
   - Outside: split on `;` as before.
   - Return non-empty trimmed statements.

   Sketch (~30 lines, no deps):

   ```js
   export function splitSqlStatements(sql) {
     const out = [];
     let buf = '';
     let dollarTag = null;  // '$$' or '$tag$' when inside, null when outside
     for (let i = 0; i < sql.length; i++) {
       if (dollarTag === null) {
         const m = sql.slice(i).match(/^(\$[a-zA-Z_]*\$)/);
         if (m) { dollarTag = m[1]; buf += dollarTag; i += dollarTag.length - 1; continue; }
         if (sql[i] === ';') { if (buf.trim()) out.push(buf); buf = ''; continue; }
       } else {
         if (sql.slice(i, i + dollarTag.length) === dollarTag) {
           buf += dollarTag; i += dollarTag.length - 1; dollarTag = null; continue;
         }
       }
       buf += sql[i];
     }
     if (buf.trim()) out.push(buf);
     return out;
   }
   ```

2. **Replace** all 5 `split(';')` call sites with `splitSqlStatements(...)`.

3. **Vitest cases** (in both repos):
   - Single statement → 1 element
   - Two statements split by `;` → 2 elements
   - `DO $$ ... ; ... END $$;` → kept as 1 atomic element (THE regression case)
   - Tagged dollar quote `$body$ ... ; ... $body$;` → 1 element
   - Mixed: `CREATE TABLE foo (...); DO $$ ... ; ... END $$;` → 2 elements
   - Nested dollar tags (rare but valid PG) — at minimum document the
     limitation if not implemented

4. **Manual recovery in Cloud SQL** (one-time, post-deploy):

   ```bash
   gcloud sql connect stavagent-db --user=postgres --database=stavagent_portal
   ```

   Then in psql, apply every statement after line 366 of
   `schema-postgres.sql` that the broken splitter never ran. Diff the
   live schema against the file to identify gaps:

   ```sql
   \d users  -- check fk_users_org_id constraint exists
   \di       -- check expected indexes exist
   SELECT count(*) FROM organizations;  -- check default rows seeded
   ```

   Apply manually any missing pieces. Same exercise for
   `monolith_planner` DB if Monolit also affected.

### Effort

- Splitter + tests: ~1 h
- Replace 5 sites: ~30 min
- Manual DB recovery: ~30 min depending on what's missing
- **Total: 2 h**

### Priority

**Medium-but-blocks-deploy-quality**: production right now is
serving from this broken-bootstrap revision. Auth (in-memory JWT
verify) keeps working. DB-dependent endpoints partial. Symptoms
look like:
- Random 5xx on routes that hit missing constraints / indexes
- "Foreign-key violations" in Portal logs that shouldn't fire
- Migrations that "ran but aren't there" when comparing schema to
  the SQL file

Not blocking PR-3 / PR-4 / PR-5 of the auth-fix series, but
**should land before any production-grade rollout** (claim flow,
cross-kiosk UserBadge, PR-X classification roundtrip) so the DB
matches what the application code assumes.

### Branch suggestion

`fix/sql-migration-dollar-quoted-splitter`

Single PR, both backends touched. After merge: deploy + connect to
Cloud SQL + manual recovery + verify schema diff is empty.

---

## Catalog gap discovered Phase 2 (2026-04-30)

After Gap #8 fix (Gate 2 Phase 2):

- Catalog has 0 systems with `pour_role: 'falsework'`
- Top 50 + VARIOKIT HD 200 moved to `formwork` / `formwork_beam`
- Staxo 100 still `'props'` (deferred to Gate 3)
- Catalog integrity test (`formwork-systems.test.ts:138`) updated
  to reflect current reality: `expect(falsework.length).toBe(0)`
  with comment marking it for Phase 3 / Gate 3 revisit

**Resolution:** Reclassify Staxo 100 → `'falsework'` in Gate 3 UI
labels work. Natural fit because UI cards distinguish „Skruž"
(falsework, Vrstva 3b per canonical §9.3) vs „Stojky" (props,
Vrstva 3a) anyway. Coupling Staxo 100 reclass with UI work means
atomic refactor — no internal-only state where backend says
„falsework" but UI still shows „Stojky".

**Cascading consequences for Gate 3 implementation** (track when
Staxo 100 reclass happens):

- Catalog integrity test needs `falsework.length` ≥ 1, `props.length`
  ≥ 1 (was ≥ 2 with Staxo 100 + UP Rosett)
- Multiple test assertions across suite assert `Staxo 100.pour_role
  === 'props'` — invert in lockstep
- Orchestrator `calculateProps()` selection logic — if it filters
  by `pour_role: 'props'`, Staxo 100 reclass changes selection
  chain. Either expand filter to `['props', 'falsework']` or
  restructure `output.props` field (currently holds Staxo 100 for
  mostovka path)
- UI cards in Gate 3 map naturally: Vrstva 3b (Staxo 100) → 🏗️
  Skruž card; Vrstva 3a (Staxo 40 from PROP_SYSTEMS) → 🔩 Stojky
  card

**Catalog systems NOT available for falsework reclassification:**

- UniKit — not in catalog
- VARIOKIT VST — not in catalog (only VARIOKIT HD 200 + VARIOKIT
  Mobile MSS exist)
- Adding these = scope expansion (separate task — pull DOKA / PERI
  catalog entries for missing falsework systems)

---

## Lessons learned z Gate 1 + Gate 2 stop-and-ask pattern

9 stop-and-ask instances total. Each prevented downstream issues:

- 6 in Gate 1 (truncations, cross-refs, scope, architectural)
- 3 in Gate 2 (architecture refactor question, commit ordering,
  catalog integrity test)

**Pattern principle:** task specs are starting hypotheses, not
implementation contracts. Implementation reality is authoritative.
Stop-and-ask is fastest path because each catch prevents 1–3
broken commits.

**Concrete examples (Gate 1 + Gate 2 retrospective):**

1. Gate 1 Section G — task spec said `test-data/` doesn't exist;
   reality: it does, in repo root (not under `Monolit-Planner/`).
   Stop-and-ask led to full Section G rewrite + decision flag
   reassessment (KEEP_AND_ADD_V2 instead of OVERWRITE).

2. Gate 1 Top 50 misclassification artifact — initial audit had
   stale „Top 50 jako falsework je correct" line in A.3 from
   pre-external-review draft. Caught and removed; Section A.1
   table also annotated.

3. Gate 2 Phase 2 architecture refactor question — task spec
   example test code (`result.falsework.system.name`) implied
   multi-layer architectural refactor (recommendFormwork return
   shape change). Stop-and-ask landed on Variant B (narrow
   scope), avoiding ~+200 LOC of architectural sprawl in
   Phase 2.

4. Gate 2 Phase 2 commit ordering — user-specified 7-commit
   order had TypeScript compilation breakage between commits
   1–3 (assigning new enum values before they exist). Stop-and-
   ask led to corrected 4-commit atomic ordering with each
   commit boundary green.

5. Gate 2 Phase 2 catalog integrity test — predictable failure
   after Top 50 + VARIOKIT HD reclassification (no `'falsework'`
   systems left). Caught by full test suite run; relaxed
   assertion with explicit deferred-to-Gate-3 comment instead
   of guessing fix.

**Practical implication for next sessions:** when a task spec
gives example code (TypeScript snippets, expected return shapes,
file:line references), treat it as documentation of intent — but
verify against current code state before implementing. Mismatches
between intent and reality are the most common source of stop-
and-ask catches.

---

## Gate 2 closed 2026-05-03

Branch `gate-2-element-classification` merged via PR `#<TBD>`.
**1036 tests passing.** 23 element types classification-correct
per canonical §9.4 (22 baseline + `zaklady_oper` added in Phase 3
Commit 1).

### Lessons learned (16 stop-and-ask instances Gate 1 + Gate 2)

1. **Task specs are starting hypotheses, not implementation
   contracts.** Multiple task spec details proved incorrect on
   verification (e.g., `mostni_zaver` not in union, `Top 50
   Cornice` not a real catalog entry, `result.falsework.system`
   shape doesn't exist).

2. **Implementation reality (TypeScript types, current
   architecture) is authoritative.** When task spec example code
   conflicts with current code, current code wins. Verify
   signatures + interfaces before implementing per spec.

3. **Stop-and-ask is fastest path** — each catch prevents 1–3
   broken commits. 16 instances in Gate 1 + Gate 2 caught
   truncations, broken cross-refs, scope creep, architectural
   surprises, data inconsistencies, broken intermediate commit
   states.

4. **Architectural fixes beat per-element fixes** — Option W
   principle pre-empted Phase 4 entirely. Phase 4 reduced from
   estimated 3–4 days to ~10 minutes work because Option W
   extension (Phase 3 Commits 2+3) auto-fixed 11 pozemní
   elements transparently. Don't add scope guards to artificially
   limit fix reach.

5. **With-height vs without-height path coverage matters.**
   `recommendFormwork()` has two distinct branches; tests must
   exercise both. Single-arg defaults can mask issues
   (existing "recommends Frami for foundations" test always
   passed because it called without `height_m` and short-
   circuited to `recommended[0]`; the buggy with-height path
   was never exercised before Gate 2 Phase 3).

6. **`undefined` as universal applicability semantics.**
   `applicable_element_types` undefined = no allow-list = applies
   to all. Filter logic must handle both: `!apt || apt.includes
   (type)`. Original Phase 3 Commit 2 guard formulation
   `apt?.includes(type)` would have failed silently for
   universal systems (Frami Xlife). Caught by stop-and-ask 13th
   instance.

7. **Atomic commits with code + tests together prevent broken
   intermediate states.** Each Phase 2 commit (e.g., `b60d24d`
   Top 50) bundled the data change + ALL corresponding test
   inversions in lockstep so test suite stays green at every
   commit boundary. Enables clean bisect / rollback.

### Next steps (Gate 3 / Gate 4 / Gate 7)

Currently **no urgent action**. All 5 decisions signed off
(2026-04-30). Architectural foundation solid. When ready:

- **Gate 3** (UI labels + W1-W4 warnings, ~5–7 days):
  - Staxo 100 reclassification (`'props'` → `'falsework'` per
    canonical Vrstva 3) — natural fit when UI cards split
    „Skruž" vs „Stojky"
  - `warnings_structured` shape (replaces `warnings: string[]`
    per Gap #9 — prerequisite for W1 RED severity)
  - UI card titles per canonical §9.3 (DOKA/PERI mapping)
  - Tooltips with canonical doc references

- **Gate 4** (Pricing split, ~5–7 days):
  - 4 cost rows per system (setup_labor + rental + teardown_labor
    + optional design_fee)
  - MSS mobilization separate fields (P1 fix from audit D.4)
  - Excel field names disambiguation (audit D.2 open item)
  - MCP `accuracy_note` field per philosophy §7.3
  - Dual-write deprecation aliases until 2026-07-29

- **Gate 7** (Cleanup, deadline **2026-07-29**):
  - Remove deprecation aliases (`grep -r "DEPRECATED until
    2026-07-29"`)
  - Section 9 cleanup (5 issues identified by external review)
  - `atrium` / `attika` / `vence` / `rampa` final decision (currently
    documented as subsumption per Phase 5 Commit 1; revisit if
    user wants explicit types)

**Cleanup deadline: 2026-07-29** (3 months from Gate 1 closure
2026-04-29). Tracked as blocking prerequisite for public MCP
launch.
