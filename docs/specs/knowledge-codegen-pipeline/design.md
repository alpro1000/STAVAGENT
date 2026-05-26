# Design — Knowledge Codegen Pipeline

## Data Flow

```
kb/*.yaml  ──(npm run gen:knowledge)──►  Monolit-Planner/shared/src/kb-generated/*.ts
                  │                                       │
                  │                                       ▼
                  │                            engines import { TABLE } from
                  │                            '../kb-generated/<name>.js'
                  ▼
       CI: npm run gen:knowledge:check
       (re-run codegen, fail if dist diverges)
```

## File Layout

```
kb/                                  ← source of truth (YAML, human-edited)
  tkp18_maturity.yaml
  ucebnice_mostu_pour.yaml
  doka_frami_catalog.yaml
  lateral_pressure.yaml
  urs_otskp_routing.yaml
  _schema/                           ← (optional) JSON schemas, deferred
scripts/
  gen-knowledge.mjs                  ← codegen tool (Node.js, no transpile)
Monolit-Planner/shared/src/kb-generated/
  index.ts                           ← re-exports
  tkp18-maturity.ts                  ← generated, DO NOT EDIT
  ucebnice-mostu-pour.ts             ← generated
  doka-frami-catalog.ts              ← generated
  lateral-pressure-formulas.ts       ← generated
  urs-otskp-routing.ts               ← generated
  kb-generated.test.ts               ← round-trip integrity tests
docs/architecture/
  knowledge_codegen_pipeline.md      ← 1-page reference
```

## Codegen Tool

`scripts/gen-knowledge.mjs` — plain Node.js (no TS transpile, runs anywhere
with Node ≥18). Uses `js-yaml` (transitive dep already in monolit-planner
backend) — installed at repo root via `npm install --no-save js-yaml` in
the script's bootstrap fallback, OR shipped as devDependency in root
`package.json`.

**Pipeline per YAML:**

1. Parse YAML → JS object
2. Validate against built-in schema check (manual `if` cascade — no zod for
   greenfield; can upgrade later)
3. Render TS string template (`export const X = ... as const` + inferred
   type via `typeof`)
4. Prepend header banner: source path, generated-at marker, "DO NOT EDIT"
5. Write to target path

**Header format (drift-detection anchor):**

```ts
/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/<name>.yaml
 * Regenerate: npm run gen:knowledge
 */
```

## CI Drift Check

`npm run gen:knowledge:check`:

1. Capture SHA-256 of each `kb-generated/*.ts` before
2. Run `npm run gen:knowledge`
3. Re-capture SHA-256 after
4. Exit non-zero with diff list if any file changed

Wired into existing GitHub Actions `monolit-planner-ci.yml` as a pre-test
step. Husky pre-commit hook optional (deferred — script is fast enough).

## Engine Wire-up Pattern

Each engine keeps its public API. The hardcoded table is replaced with an
import. Example — `maturity.ts`:

```ts
// Before:
const CURING_DAYS_TABLE: {...}[] = [
  { temp_min: -5, temp_max: 5, days: {...} },
  ...
];

// After:
import { CURING_DAYS_TABLE } from '../kb-generated/tkp18-maturity.js';
// Same shape, same lookups, no behavior change.
```

The generated module exports `as const` so type inference + literal types
work end-to-end. Where the engine needs a wider type (e.g. `number` not
`5 | 7 | 22`), it asserts via `as Array<...>` at the import site.

## Schema Validation Approach

Greenfield — no zod dependency. Each YAML loader function in
`gen-knowledge.mjs` does manual structural checks:

```js
function validateTkp18Maturity(data) {
  if (!Array.isArray(data.curing_days_table)) throw new Error(...);
  for (const row of data.curing_days_table) {
    if (typeof row.temp_min !== 'number') throw new Error(...);
    ...
  }
}
```

Acceptable trade-off: 5 YAMLs, ~30 validation lines per loader, no new
runtime dep. Can upgrade to `zod` or `ajv` if YAML count grows.

## Backward Compatibility Strategy

- Engine function signatures stay identical
- Generated tables have same shape as existing hardcoded tables
- Wire-up changes are import-only at the source-file top
- All 1088+ existing tests must remain green
- New tests only verify YAML→TS round-trip + value presence

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YAML edits without regen → silent drift | CI drift check (REQ 2) |
| Numeric precision loss YAML→JS | YAML 1.2 spec preserves floats exactly; spot-check in tests |
| New contributors don't know about `gen:knowledge` | "DO NOT EDIT" banner on every generated file + `docs/architecture/...` |
| Generated files bloat git diffs | They're committed (so CI doesn't need to regenerate) — accept |
| Python codegen later may need to share schema | YAML is language-neutral; schema can be lifted into `kb/_schema/*.json` |
