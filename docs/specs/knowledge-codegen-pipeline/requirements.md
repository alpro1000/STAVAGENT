# Requirements — Knowledge Codegen Pipeline (Týden 3 Top-5)

## Context

Knowledge audit (`docs/audits/knowledge_audit/2026-05-14_inventory_with_gcs.md`)
identified that ~50% of repo knowledge sits unused — engines hardcode tables
while structured JSON/PDF sources exist in `concrete-agent/.../knowledge_base/`.

This spec covers the **Top-5 integrations** (partial Variant D from audit
`10_variant_hybrid_part2_codegen.md`): a build-time codegen pipeline that
turns YAML sources into typed TS modules consumed by Monolit-Planner engines.

## Decisions (Alexandra, session 2026-05-26)

| Question | Answer |
|---|---|
| Scope | Partial Top-5 only (NOT full Variant D migration) |
| Python codegen | TS-only (Core does not consume these matrices today) |
| DIN 18218 source | ČSN EN 12812 + Pokorný-Suchánek + DOKA/PERI catalog (free) |
| PR strategy | 1 big PR (codegen infra is shared dependency) |

## User Story

As a domain SME (Alexandra), I want a single source of truth for engineering
constants so editing a YAML value automatically propagates to TS engines on
the next build, with CI guarding against drift.

## EARS Acceptance Criteria

1. WHEN developer runs `npm run gen:knowledge` from repo root THEN script
   reads every `*.yaml` under `kb/` AND writes corresponding `*.ts` files
   under `Monolit-Planner/shared/src/kb-generated/`.
2. WHEN a YAML file is edited but `gen:knowledge` is not re-run THEN CI step
   `npm run gen:knowledge:check` exits non-zero AND prints a diff of the
   stale files.
3. WHEN engines (`maturity.ts`, `pour-decision.ts`, `formwork-systems.ts`,
   `lateral-pressure.ts`, plus new ÚRS/OTSKP routing helper) read constants
   THEN they import from `kb-generated/*` modules — no engine retains a
   duplicate hardcoded table for the migrated data.
4. WHEN existing calculator test suite runs THEN all pre-existing tests pass
   unchanged (backward compat — engine public API stays identical).
5. WHEN a new test file `kb-generated.test.ts` runs THEN it verifies each
   generated module exports the expected shape AND values match the source
   YAML (round-trip integrity).
6. WHEN documentation reader opens `docs/architecture/knowledge_codegen_pipeline.md`
   THEN they find a one-page overview of the pipeline including: data flow
   diagram, file conventions, CI drift check, and how to add a new YAML.

## Non-Goals (out of scope for this PR)

- Python codegen for Core engine (deferred — no consumer today)
- Full `kb/` migration of all B-buckets (Týden 4+ work)
- Geometry calculator integration (Týden 5)
- MCP tool changes (10 tools shipped, hands-off)
- UI component changes beyond import updates
- Acquiring paid DIN 18218 standard

## Source Files (extracted into YAML)

| Integration | Source | Target YAML |
|---|---|---|
| TKP18 maturity | `concrete-agent/.../B2_csn_standards/tkp/tkp_18*` + `maturity.ts:168` | `kb/tkp18_maturity.yaml` |
| Pour sequences | `pour-decision.ts:161` + `B6_research_papers/upa_pokorny_suchanek*` | `kb/ucebnice_mostu_pour.yaml` |
| DOKA Frami | `B3_current_prices/formwork_systems_doka.json` (15 entries) | `kb/doka_frami_catalog.yaml` |
| Lateral pressure | `lateral-pressure.ts:52` + ČSN EN 12812 ranges | `kb/lateral_pressure.yaml` |
| ÚRS/OTSKP routing | New — per `soul.md` memory rules (veřejná→OTSKP, privátní→URS, D&B→both) | `kb/urs_otskp_routing.yaml` |
