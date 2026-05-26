# Backlog — Migrate 12 hardcoded calculator matrices into kb/ codegen pipeline

**Opened:** 2026-05-26 (Phase C G6)
**Priority:** P1 — silent-drift hazard, NOT a hard blocker
**Effort estimate:** 1-2 days per matrix once `kb/` schema for the target B-bucket
exists; total ~3-5 dev days across all 12 sites
**Migration target:** `kb/<matrix>.yaml` → `npm run gen:knowledge` →
`Monolit-Planner/shared/src/kb-generated/*.ts` (Týden 3 codegen pipeline,
shipped on PR that opened this backlog item)

---

## Why this exists

Phase A audit (`docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`
§A.7.4) enumerated 12 hardcoded matrices in the calculator engines whose
values rightfully belong in normy/catalog YAML, not source code. With the
Týden 3 codegen pipeline now live (`kb/*.yaml` → typed TS at build time +
CI drift check), these are all **mechanically migratable** — each row
becomes one PR: extract → YAML → generate → engine import → tests.

**Why not migrate immediately:** Phase C task §10 explicitly scopes
migration as **P1, NOT P0** ("this task creates rimsa.yaml + T_bedneni.yaml,
NOT full migration"). Phase C ships the codegen rails for TKP18 maturity,
DOKA Frami, lateral pressure, ÚRS/OTSKP routing, and pour sequences as
proofs-of-concept. The remaining 12 sites follow once steerage decisions
(per-element-vs-per-bucket YAML granularity, B-bucket schema versioning,
KB testing convention) are stable.

---

## The 12 hardcoded matrices

| # | File:line | Constant | Snippet | KB destination |
|---|---|---|---|---|
| 1 | `shared/src/calculators/maturity.ts:89` | `EXPOSURE_MIN_CURING_DAYS` | `XF1:5, XF2:5, XF3:7, XF4:7, XD2:5, XD3:7, XS2:5, XS3:7, XA2:5, XA3:7` | `B7_regulations/csn_en_13670_provadeni/extracted.yaml` |
| 2 | `shared/src/calculators/maturity.ts:168` | `CURING_DAYS_TABLE` | 5 temp × 3 concrete groups × 3 curing classes | ✅ **DONE Týden 3** — `kb/tkp18_maturity.yaml`, regenerated; G1 calibration applied 2026-05-26 |
| 3 | `shared/src/calculators/maturity.ts:611` | `DEFAULT_CURING_CLASS` | `mostovkova_deska:4, rimsa:4, rigel:4; opery/driky/zaklady_piliru:3; others:2` | ✅ **DONE Týden 3** — `kb/tkp18_maturity.yaml` `default_curing_class_by_element:` |
| 4 | `shared/src/calculators/maturity.ts:629` | `getDefaultCuringClass(elementType)` | fn returning above map | Function stays; data already in KB (row #3) |
| 5 | `shared/src/calculators/pour-decision.ts:146` | `T_WINDOW_HOURS` | `hot/normal/cold × {no_retarder, with_retarder}` | `B5_tech_cards/concrete_admixture_norms/` or `B7_regulations/csn_en_206_*` |
| 6 | `shared/src/calculators/pour-decision.ts:161` | `ELEMENT_DEFAULTS` | per element; `rimsa: {typical_has_spary:true, typical_sub_mode:'adjacent_chess', typical_spara_spacing_m:20, …}` | `B4_production_benchmarks/default_ceilings/*.yaml` (per element) — companion to `kb/ucebnice_mostu_pour.yaml` shipped Týden 3 |
| 7 | `shared/src/calculators/planner-orchestrator.ts:632` | `RECOMMENDED_EXPOSURE` | `rimsa: ['XF4','XD3']`, 14 element types | `B4_production_benchmarks/default_ceilings/*.yaml` or `B7_regulations/csn_en_206_*` |
| 8 | `shared/src/calculators/lateral-pressure.ts:52` | `getConsistencyKFactor` | `standard:0.85, plastic:1.00, scc:1.50` | ✅ **DONE Týden 3** — `kb/lateral_pressure.yaml` `k_factors_by_consistency:` |
| 9 | `shared/src/calculators/pile-engine.ts:187` | `PILE_PRODUCTIVITY_TABLE` | 4 Ø × 4 geology × 3 casing | `B4_production_benchmarks/pile_productivity/` |
| 10 | `shared/src/classifiers/element-classifier.ts:116` | `ELEMENT_CATALOG` | 23 element types; `rimsa: {rebar_category:'staircases', rebar_ratio_kg_m3:120, range:[100,180], recommended_formwork:[…], difficulty_factor:1.15, …}` | `B4_production_benchmarks/default_ceilings/*.yaml` (per element) |
| 11 | `shared/src/classifiers/element-classifier.ts:1341` | `REQUIRED_FIELDS` | `rimsa: [{field:'volume_m3', severity:'critical'}, {field:'total_length_m', severity:'optional'}]` | Per-element B4 YAML |
| 12 | `shared/src/classifiers/element-classifier.ts:1477` | `SANITY_RANGES` | `rimsa: {volume_m3:[0.5,500], height_m:[0.3,0.8], rebar_kg_m3:[80,180]}` | Per-element B4 YAML |
| 13 | `shared/src/constants-data/formwork-systems.ts:155+` | `FORMWORK_SYSTEMS` | 29 entries; DOKA Frami/Framax/Top 50/Dokaflex/SL-1/Římsové × 3/Staxo/MSS (DOKA) | ✅ **DONE Týden 3** for DOKA subset — `kb/doka_frami_catalog.yaml` (10 entries); PERI/ULMA/NOE entries still inline (parallel PR candidate: `kb/peri_catalog.yaml`) |

**Counts:**
- ✅ Already migrated by Týden 3 PR: **5 of 13** (rows 2, 3, 4, 8, 13-partial)
- ⏳ Open for follow-up: **8 of 13** (rows 1, 5, 6, 7, 9, 10, 11, 12)

---

## Migration template (per matrix)

1. Pick a row from the table above.
2. Decide YAML granularity:
   - **Per-element B4** — `kb/b4_<element>.yaml` if the matrix is keyed by
     `StructuralElementType` (rows 6, 7, 10, 11, 12)
   - **Per-norm B7** — `kb/<norm>_<topic>.yaml` if rooted in a norm (rows 1, 5)
   - **Per-domain matrix** — `kb/<topic>.yaml` for engine-specific tables (row 9)
3. Extract values verbatim from TS source into YAML. Preserve numeric
   precision; carry `source_citation:` block per Týden 3 convention.
4. Add loader + validator + renderer to `scripts/gen-knowledge.mjs`
   (`INTEGRATIONS` array). ~30 LOC per loader.
5. Run `npm run gen:knowledge` — new `kb-generated/<topic>.ts` appears.
6. Edit the engine file: `import {…} from '../kb-generated/<topic>.js';`
   then replace the hardcoded const with the KB import.
7. Add 5-10 round-trip integrity tests in `kb-generated.test.ts`
   (covering shape + key values + 1-2 engine wire-up smoke tests).
8. Verify `npm test` + `npm run gen:knowledge:check` green.
9. Commit one PR per matrix. Title format:
   `MIGRATE(kb): <constant_name> from <engine_file> → kb/<topic>.yaml`

---

## Steerage decisions still open (block batched migration)

- **B4 granularity:** one `kb/b4_<element>.yaml` per element type vs one
  monolithic `kb/element_catalog.yaml`? Per-element keeps PRs small but
  multiplies file count (~23 files); monolithic is one big PR but easier
  to diff across elements.
- **B-bucket schema versioning:** do we version individual YAML files
  (`schema_version: 1`) or rely on git history? Týden 3 currently does
  neither.
- **CI drift on Python side:** Core's `kb_loader.py` reads B-bucket JSONs
  loosely. After migration to YAML-of-truth, do we generate Python
  `kb_generated/*.py` (per audit `10_variant_hybrid_part2_codegen.md`
  Variant D)? Týden 3 explicitly deferred Python codegen.

These should be answered before scheduling the 8 remaining migrations.
Recommend a 1-hour design session before starting Wave 2.

---

## Related

- `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md` §A.7.4 (origin)
- `docs/architecture/knowledge_codegen_pipeline.md` (Týden 3 rails)
- `docs/audits/knowledge_audit/2026-05-14_inventory_with_gcs.md` Top-5
- `docs/audits/knowledge_audit/10_variant_hybrid_part2_codegen.md` Variant D
- `kb/_TEMPLATE.yaml` (does not exist yet — open as Wave 2 prep)
