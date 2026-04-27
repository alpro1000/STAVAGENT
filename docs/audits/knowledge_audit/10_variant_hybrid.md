# Architecture Variant C — Hybrid (CORE authoritative, kiosks read-only cache)

**Principle:** CORE remains the single source of truth, but kiosks fetch + cache at startup so that runtime calculator paths stay synchronous (no HTTP per constant). Cache invalidates on CORE deploy + on TTL.

---

## Target structure

CORE-side: same as Variant A (single canonical KB).

Kiosk-side:
- Each kiosk has a `kb-cache/` folder (gitignored) and a startup script `bootstrap-kb.{ts,py}` that calls CORE `GET /api/v1/kb/snapshot` and writes a local snapshot.
- Calculators continue to import from `kb-cache/` synchronously.
- CI step verifies cache schema matches CORE's published JSON Schema before deploy.

```
Monolit-Planner/
├── shared/src/
│   ├── calculators/         ← unchanged: import from kb-cache/
│   ├── kb-cache/            ← NEW, gitignored, generated at build time
│   │   ├── exposure_classes.json
│   │   ├── curing_days.json
│   │   ├── formwork_systems.json
│   │   ├── element_catalog.json
│   │   ├── rebar_rates.json
│   │   └── _manifest.json   ← schema version + CORE git SHA
│   └── scripts/bootstrap-kb.ts ← NEW
└── ...
```

---

## Pros

1. **Single source of truth.** Edits go to CORE; everything downstream re-syncs.
2. **No runtime HTTP.** Calculator UX unchanged from current.
3. **CORE deploy gates kiosk deploys.** New rule version requires explicit kiosk re-build → cache refresh → re-test.
4. **Audit trail still in CORE git log.** ✅
5. **Compatible with both Python and TS** — CORE serves JSON; kiosks pick their language.

## Cons

1. **Cache invalidation problem.** What happens if CORE redeploys without notifying kiosks? Need TTL or webhook.
2. **Two artefacts to track.** Source (CORE YAML) + cache snapshot (kiosk JSON). Schema drift between them is possible.
3. **Build-time complexity.** Kiosk CI must call CORE before deploy. Adds an external dependency to local builds.
4. **Type-safety.** TS still has to hand-write types matching CORE's schema (or use code-gen — bridges to Variant D).

---

## Migration effort

**Effort scale:** M–L (~2 weeks).

| Step | Effort |
|------|--------|
| CORE: same `B*/` consolidation as Variant A | M (1 week) |
| CORE: `GET /api/v1/kb/snapshot` endpoint that bundles all KB into one JSON | XS (1 day) |
| Per kiosk: `bootstrap-kb` script + `kb-cache/` folder + `.gitignore` entry | S (2–3 days) |
| Refactor 20 Monolit hotspots to import from `kb-cache/*.json` instead of inline constants | M (1 week) |
| CI integration | S (2 days) |
| **Total** | **M–L** | ~2 weeks |

---

## STAVAGENT principle compliance

| Principle | Compliant? |
|-----------|------------|
| Core Engine separated from UI | ✅ |
| Knowledge_base centralised | ✅ (CORE = canonical) |
| Each kiosk calls CORE API independently | ✅ (build-time, not runtime) |
| Determinism prevails over AI | ✅ |
| project.json = project knowledge centre | ✅ |

**Compliance: full.** Latency cost: zero (cache is local).

---

## Verdict

**Strong middle ground.** Solves the consolidation problem (single source) without paying Variant A's runtime latency cost. Build-time complexity is real but manageable in a small team's CI pipeline.

Continued in `10_variant_hybrid_part2_codegen.md` (Variant D — codegen extension of Variant C).
