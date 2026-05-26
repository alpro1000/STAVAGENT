# Tasks — Knowledge Codegen Pipeline

## Sequence

Tasks must run in order — codegen infra (T1) is shared dependency.

- **T1 — Codegen infrastructure**
  - `scripts/gen-knowledge.mjs` (Node.js, js-yaml)
  - Root `package.json` scripts: `gen:knowledge`, `gen:knowledge:check`
  - Root `package.json` devDep: `js-yaml`
  - `kb/.gitkeep`, `Monolit-Planner/shared/src/kb-generated/.gitkeep`
  - Gate: `node scripts/gen-knowledge.mjs --help` exits 0

- **T2 — Integration #1: TKP18 maturity**
  - `kb/tkp18_maturity.yaml` (extract from `tkp_18_betonove_mosty.json`
    + verbatim copy of `maturity.ts:CURING_DAYS_TABLE`
    + `EXPOSURE_MIN_CURING_DAYS` map
    + `TKP18_ABSOLUTE_MIN_DAYS`)
  - Codegen loader + validator
  - `Monolit-Planner/shared/src/kb-generated/tkp18-maturity.ts`
  - `maturity.ts` imports generated, removes hardcoded
  - Gate: pre-existing `maturity.test.ts` passes unchanged

- **T3 — Integration #2: ÚRS/OTSKP routing**
  - `kb/urs_otskp_routing.yaml` (new, per soul.md rules:
    veřejná→OTSKP primary, privátní→URS primary, D&B→both)
  - Codegen loader + validator
  - `Monolit-Planner/shared/src/kb-generated/urs-otskp-routing.ts`
  - Export helper `getCatalogPriority(project_type)`
  - Gate: helper returns correct order for all 3 project types

- **T4 — Integration #3: DOKA Frami catalog**
  - `kb/doka_frami_catalog.yaml` (extract 15 entries from
    `B3_current_prices/formwork_systems_doka.json`)
  - Codegen loader + validator
  - `Monolit-Planner/shared/src/kb-generated/doka-frami-catalog.ts`
  - Export `KB_DOKA_FORMWORK_SYSTEMS: FormworkSystemSpec[]` matching
    existing TS shape
  - Engine: `formwork-systems.ts` keeps non-DOKA entries hardcoded,
    sources DOKA from generated module (drop in-file DOKA copies)
  - Gate: pre-existing `formwork-systems.test.ts` passes

- **T5 — Integration #4: Lateral pressure formulas**
  - `kb/lateral_pressure.yaml` (extract `getConsistencyKFactor` k-map
    + ČSN EN 12812 pour-rate→k mapping + ρ/g constants + DIN 18218 ref)
  - Codegen loader + validator
  - `Monolit-Planner/shared/src/kb-generated/lateral-pressure-formulas.ts`
  - `lateral-pressure.ts` imports K_FACTORS_BY_CONSISTENCY + RHO + G
  - Gate: pre-existing `lateral-pressure.test.ts` passes

- **T6 — Integration #5: Pour sequences (učebnice mostů)**
  - `kb/ucebnice_mostu_pour.yaml` (per-element recommended pour
    sequences extracted from `pour-decision.ts:ELEMENT_DEFAULTS`
    + Pokorný-Suchánek annotations)
  - Codegen loader + validator
  - `Monolit-Planner/shared/src/kb-generated/ucebnice-mostu-pour.ts`
  - Export per-element pour pattern as data table; engine consumes
    where it currently has element-specific defaults
  - Gate: pre-existing `pour-decision.test.ts` passes

- **T7 — Tests + index**
  - `Monolit-Planner/shared/src/kb-generated/index.ts` re-exports
  - `Monolit-Planner/shared/src/kb-generated/kb-generated.test.ts`
    (round-trip integrity: YAML→TS values match, count matches,
    schema shape matches)
  - 25+ new test cases
  - Gate: `npm test` in `Monolit-Planner/shared/` shows all green

- **T8 — Architecture doc**
  - `docs/architecture/knowledge_codegen_pipeline.md` (1-page)

- **T9 — CI drift wiring**
  - Add `gen:knowledge:check` step to `.github/workflows/monolit-planner-ci.yml`
    OR document follow-up if workflow file structure is tricky

- **T10 — Session log + commit + push**
  - Update `docs/soul.md` §9
  - Atomic commits per task (T1–T9)
  - Push to `claude/kind-wright-5nBQ2`

## Estimated effort

~3 dní per task brief; this session targets infra + 3-4 full integrations
+ tests + docs, with remaining integrations following same pattern.
