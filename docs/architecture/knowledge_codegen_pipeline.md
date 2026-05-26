# Knowledge Codegen Pipeline

**Status:** Active (Týden 3 — Top-5 integrations, 2026-05-26)
**Scope:** TS-only (Python codegen deferred — no Core consumer today)

## Why

Engines hardcoded engineering tables (TKP18 curing days, DOKA formwork
catalog, DIN 18218 k-factors, pour sequences, ÚRS/OTSKP routing) while
structured sources sat unused in `concrete-agent/.../knowledge_base/`.
This pipeline establishes a single source of truth — edit YAML, run
codegen, engines stay in sync, CI guards against drift.

## Data Flow

```
kb/<integration>.yaml                                  ← edit here
        │
        │  npm run gen:knowledge
        ▼
Monolit-Planner/shared/src/kb-generated/<integration>.ts  ← generated, do-not-edit
        │
        │  TS import
        ▼
engine (maturity.ts, lateral-pressure.ts, formwork-systems.ts, …)
        │
        │  vitest
        ▼
CI: npm run gen:knowledge:check (re-generates, fails on drift)
```

## File Layout

```
kb/
  tkp18_maturity.yaml           ← TKP18 §7.8.3 + ČSN EN 13670 NA.2 curing tables
  ucebnice_mostu_pour.yaml      ← Pokorný/Suchánek pour sequences per element
  doka_frami_catalog.yaml       ← 10 DOKA systems (Frami, Framax, Top 50, Dokaflex,
                                  SL-1, 3× Římsové, Staxo 100, DOKA MSS)
  lateral_pressure.yaml         ← ČSN EN 12812 + DIN 18218 k-factors + ρ/g constants
  urs_otskp_routing.yaml        ← veřejná→OTSKP / privátní→URS / D&B→both per
                                  project_type

scripts/
  gen-knowledge.mjs             ← plain Node.js codegen (no transpile, uses js-yaml)

Monolit-Planner/shared/src/kb-generated/
  index.ts                      ← namespaced re-exports
  tkp18-maturity.ts             ← AUTO-GENERATED, do not edit
  ucebnice-mostu-pour.ts        ← AUTO-GENERATED
  doka-frami-catalog.ts         ← AUTO-GENERATED
  lateral-pressure-formulas.ts  ← AUTO-GENERATED
  urs-otskp-routing.ts          ← AUTO-GENERATED
  kb-generated.test.ts          ← round-trip integrity (38 tests)
```

## Commands

| Command | What it does |
|---|---|
| `npm run gen:knowledge` | Generate all `kb-generated/*.ts` from `kb/*.yaml` |
| `npm run gen:knowledge:check` | Re-run codegen, exit non-zero if any file changed (CI guard) |
| `node scripts/gen-knowledge.mjs --help` | Show CLI usage |

## Engine Wire-up Pattern

Each engine imports from the generated module instead of holding its own
hardcoded copy. Public API is unchanged — only the internal constant is
replaced.

```ts
// maturity.ts (after wire-up)
import {
  CURING_DAYS_TABLE as KB_CURING_DAYS_TABLE,
  TKP18_ABSOLUTE_MIN_DAYS as KB_TKP18_ABSOLUTE_MIN_DAYS,
  ...
} from '../kb-generated/tkp18-maturity.js';

const CURING_DAYS_TABLE = KB_CURING_DAYS_TABLE;
const TKP18_ABSOLUTE_MIN_DAYS = KB_TKP18_ABSOLUTE_MIN_DAYS;
// rest of engine unchanged → public API stable, tests pass
```

For collection types (e.g. `FORMWORK_SYSTEMS`), the engine spreads the
KB entries alongside any remaining inline ones:

```ts
// formwork-systems.ts
import { KB_DOKA_FORMWORK_SYSTEMS } from '../kb-generated/doka-frami-catalog.js';

export const FORMWORK_SYSTEMS: FormworkSystemSpec[] = [
  ...KB_DOKA_FORMWORK_SYSTEMS,   // 10 DOKA entries from YAML
  { name: 'UP Rosett Flex', manufacturer: 'PERI', ... },  // non-DOKA inline
  ...
];
```

## Adding a New Integration

1. Create `kb/<name>.yaml` with structured data + `source_citation` block
2. In `scripts/gen-knowledge.mjs`:
   - Add entry to `INTEGRATIONS` array with `validate` + `render` fn
   - Write a `validateXxx(data)` function (manual structural checks)
   - Write a `renderXxx(data)` function (returns TS string)
3. Run `npm run gen:knowledge` — file appears in `kb-generated/`
4. Engine imports from generated module; remove duplicate hardcoded data
5. Add integrity tests to `kb-generated.test.ts`
6. Verify `npm test` green + `npm run gen:knowledge:check` green

## Validation Approach

Greenfield — no `zod`/`ajv` runtime dep. Each loader does manual structural
checks (~30 LOC per integration). Acceptable trade-off for 5 YAMLs; upgrade
to schema lib if integration count grows beyond ~10.

## CI Drift Check

Wired into GitHub Actions `monolit-planner-ci.yml` as a pre-test step:

```yaml
- name: Knowledge codegen drift check
  run: npm run gen:knowledge:check
```

Husky pre-commit hook deferred — script is fast enough (<200ms for 5
integrations) but adds friction; we accept that local devs may forget
to regenerate and rely on CI to catch.

## Source Citation Pattern

Every YAML carries a `source_citation:` block that ends up in the
generated module as `SOURCE_CITATION` export (renamed via namespace
re-export in `index.ts` to avoid collisions). Engines/UI can surface
the citation in audit-trail UIs ("Calculated per TKP18 §7.8.3,
[pdf reference]").

## Non-Goals (Variant D follow-up tasks)

- Python codegen for Core engine — `kb_loader.py` reads B-buckets as
  loose JSON today; no engine consumes the structured tables. Add when
  there's a concrete Core consumer.
- Full `kb/` migration of all 9 B-buckets — Týden 4+ work
- Geometry calculator integration — Týden 5
- Acquiring paid DIN 18218 standard (~€100) — current fallback to
  ČSN EN 12812 + DOKA/PERI brochures + Pokorný/Suchánek is sufficient

## Test Coverage

- 38 new tests in `kb-generated.test.ts` (TKP18, ÚRS routing, DOKA
  catalog, lateral pressure, pour sequences, engine wire-up backward
  compat)
- 1136 pre-existing engine tests unchanged & green
- **Total: 1174 tests, 27 files**

## References

- `docs/specs/knowledge-codegen-pipeline/{requirements,design,tasks}.md`
- `docs/audits/knowledge_audit/2026-05-14_inventory_with_gcs.md` (Top-5)
- `docs/audits/knowledge_audit/10_variant_hybrid_part2_codegen.md` (Variant D)
- `docs/audits/knowledge_audit/12_top_recommendations.md`
