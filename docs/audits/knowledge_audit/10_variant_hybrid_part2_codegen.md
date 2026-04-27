# Architecture Variant D — Single source + codegen (recommended)

**Principle:** there is exactly one place to edit each domain rule — a YAML file under a new `kb/` directory at repo root. A codegen step produces consumable artefacts in **both** Python (Pydantic for CORE) **and** TypeScript (typed constants + JSON for Monolit, Portal, Registry, URS_MATCHER). CI fails if any kiosk ships with stale generated copies.

This is an extension of Variant C: the snapshot is replaced by **typed code-generated artefacts**, removing the schema-drift problem.

---

## Target structure

```
STAVAGENT/
├── kb/                                        ← NEW: single canonical knowledge tree
│   ├── element_types/
│   │   ├── rimsa.yaml                         ← extracted from data/peri-pdfs/rimsa_… spec
│   │   ├── mostovkova_deska.yaml
│   │   └── … (24 element types)
│   ├── exposure_classes.yaml                  ← XC0–XF4, XD, XS, XA — single canonical table
│   ├── curing_days.yaml                       ← TKP18 §7.8.3 + ČSN EN 13670 NA.2 grid
│   ├── formwork_systems/
│   │   ├── doka.yaml                          ← Frami Xlife, Framax, Framini, MULTIFLEX, etc.
│   │   ├── peri.yaml
│   │   └── srs.yaml
│   ├── pump_catalog/
│   │   └── beton_union_2026_01.yaml
│   ├── rebar_rates_matrix.yaml                ← D6–D50 by element category
│   ├── classification_rules/
│   │   └── boq_skupiny_v1.yaml                ← 11 skupiny rules
│   ├── productivity_norms.yaml
│   ├── confidence_thresholds.yaml             ← 8 CORE constants
│   ├── profession_rates.yaml                  ← Berger 2026 + Třídník codes
│   └── _schema/                               ← JSON Schema definitions (one per file)
│       ├── element_type.schema.json
│       ├── exposure_classes.schema.json
│       └── …
│
├── tools/codegen/                             ← NEW: generates kiosk artefacts
│   ├── generate_python.py                    ← writes concrete-agent/.../kb_generated/*.py (Pydantic)
│   ├── generate_typescript.ts                ← writes per-kiosk kb-generated/*.ts (typed constants + JSON)
│   └── verify.sh                              ← CI: re-run codegen, fail if diff vs committed
│
├── concrete-agent/.../kb_generated/           ← committed, but auto-regenerated
└── Monolit-Planner/shared/src/kb-generated/   ← committed, but auto-regenerated
└── rozpocet-registry/src/kb-generated/        ← ditto
```

---

## Pros (over Variant C)

1. **Type safety in both languages.** TS constants get full IntelliSense; Python gets Pydantic validation.
2. **No runtime cache invalidation problem** — the artefact IS the cache, and CI guarantees it matches source.
3. **Single edit point.** No schema-drift between source and snapshot — codegen makes them identical by construction.
4. **CI-enforced consistency.** PR cannot land if `tools/codegen/verify.sh` shows diff.
5. **Generated artefacts are visible in PR diffs** — easy to review the impact of any rule change.
6. **Resolves B2 dual-write at compile time** — `classificationRules.ts` and `api/agent/rules.ts` both regenerated from `kb/classification_rules/boq_skupiny_v1.yaml`.

## Cons

1. **Codegen pipeline complexity.** Two languages, schema discipline, CI gate.
2. **Initial setup cost.** Pydantic + TS codegen is ~3–5 days for a clean implementation.
3. **YAML authoring discipline.** Devs must edit `kb/*.yaml` not the generated files. Need lint to catch stray edits in `*-generated/`.
4. **Larger PRs.** Every rule change re-generates 5+ files across kiosks → noise.

---

## Migration effort

**Effort scale:** M–L (~2.5–3 weeks). Slightly higher than Variant C, lower than Variant A.

| Step | Effort |
|------|--------|
| Define `kb/` schema (JSON Schema for each YAML) | M (3–5 days) |
| Extract data from existing sources into YAMLs | M (1 week) — bulk of the work |
| Build `tools/codegen/` (Python + TS generators) | M (3–5 days) |
| Refactor each kiosk to import from `kb-generated/` | S (1 week, parallel-able) |
| CI integration (verify step) | XS (1 day) |
| Tests + golden test re-baseline | S (3–5 days) |
| **Total** | **M–L** | ~2.5–3 weeks |

---

## STAVAGENT principle compliance

| Principle | Compliant? |
|-----------|------------|
| Core Engine separated from UI | ✅ |
| Knowledge_base centralised | ✅✅ — `kb/` is single source |
| Each kiosk calls CORE API independently | ✅ (build-time codegen, not runtime) |
| Determinism prevails over AI | ✅✅ — single rulebook, validated at CI |
| project.json = project knowledge centre | ✅ unchanged |

**Compliance: full + extra.** Adds a new compliance dimension: "no drift possible" (CI-guaranteed).

---

## Verdict — RECOMMENDED

**The only variant that respects all STAVAGENT principles, supports both Python+TS, eliminates drift at compile time, and keeps runtime synchronous.** Slight extra setup cost vs Variant C is offset by zero runtime invalidation risk and full type-safety in both languages.

If selected: detailed migration plan in `11_migration_plans.md`.

---

End of architecture variants. Continued in `11_migration_plans.md`.
