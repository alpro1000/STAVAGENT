# Gate 6 — Migration plans per variant

For each architecture variant from `08`–`10_*`: how many files move, how many imports get rewired, what to migrate first, what can break, and Claude-Code-hour estimate.

---

## Variant A — Centralized in CORE (HTTP fetch)

**Files moved / created:** ~50
- 20 Monolit hotspots → 1 new `confidence_thresholds.yaml` + 5 new `B*/` JSON files
- Registry rules → CORE `classification_rules/`
- URS_MATCHER `concreteAgentKB.js` deleted (CORE HTTP replaces)
- 6–8 new CORE REST endpoints (`/api/v1/kb/*`)

**Imports rewired:** ~100+
- Every Monolit calculator gains 1–3 async fetch sites
- Registry frontend + serverless drop local rules in favour of REST
- URS_MATCHER swaps fs reads for HTTP

**Migration order:**
1. Build CORE `/api/v1/kb/*` endpoints + golden tests
2. Migrate non-blocking kiosk: URS_MATCHER (low risk; already does HTTP)
3. Migrate Registry rules (medium risk; resolves B2)
4. Migrate Monolit (high risk; touches all calculators) — phased per calculator
5. Delete dangling files + retire stale CSVs

**Risks:** runtime regression in Monolit calculator UX (latency); CORE deploy outages affect all kiosks.

**Effort estimate:** **80–120 Claude-Code-hours.** ~3–4 weeks at 30 h/week.

---

## Variant B — Distributed (status-quo cleanup)

**Files moved / created:** ~5
- B5–B8 empty stubs deleted
- 21 dangling files deleted
- `docs/archive/completed-sessions/` tar.gz'd
- Stale URS CSVs moved to `URS_MATCHER_SERVICE/backend/data/legacy/`
- Lint hook OR codegen for B2 dual-write (1 small tool)

**Imports rewired:** ~5 (only the lint hook touches imports)

**Migration order:**
1. Resolve B2 dual-write (highest priority, blocks nothing else)
2. Bulk delete dangling files
3. Compress archive
4. Move stale CSVs to legacy/

**Risks:** very low. Mostly cosmetic.

**Effort estimate:** **15–25 Claude-Code-hours.** ~3–5 days at 5 h/day.

---

## Variant C — Hybrid (CORE authoritative + kiosk cache)

**Files moved / created:** ~30
- Same `B*/` consolidation as Variant A
- New `GET /api/v1/kb/snapshot` endpoint
- Per kiosk: `kb-cache/` folder + `bootstrap-kb.{ts,py}` + `.gitignore` entry + CI step

**Imports rewired:** ~50
- Monolit calculators import from `kb-cache/*.json` (still synchronous)
- Registry: same
- URS_MATCHER: same

**Migration order:**
1. CORE: build + ship snapshot endpoint
2. Per kiosk in parallel: bootstrap-kb script + cache folder
3. Refactor calculators to import from cache (per-file PRs)
4. CI integration last

**Risks:** cache-staleness window during a CORE deploy; schema drift if devs hand-edit cached files.

**Effort estimate:** **40–60 Claude-Code-hours.** ~2 weeks at 25 h/week.

---

## Variant D — Single source `kb/` + codegen (RECOMMENDED)

**Files moved / created:** ~40
- New `kb/` tree at repo root (~15 YAMLs)
- New `kb/_schema/` JSON Schema definitions
- New `tools/codegen/{generate_python,generate_typescript,verify}` scripts
- Per kiosk: new `kb-generated/` folder (committed, auto-rebuilt) + `.gitattributes` to mark as generated
- Husky pre-commit hook to run codegen verify

**Imports rewired:** ~50
- Every kiosk hotspot replaced by `import from "./kb-generated/*"`

**Migration order:** (this is the recommended sequencing)
1. **Phase 1 — Schema (3–5 days).** Define JSON Schema for each YAML; pick concrete-class / exposure / curing as the first 3 to model.
2. **Phase 2 — Bulk extraction (1 week).** Move existing constants from CORE B*/ + Monolit constants-data + Registry data/ + URS norms into YAMLs. **No code changes yet** — the YAMLs are added in parallel to the existing files.
3. **Phase 3 — Codegen (3–5 days).** Build `tools/codegen/`. Run it to produce kiosk artefacts, but kiosks still use the old constants.
4. **Phase 4 — Rewire kiosks (1 week, parallel-able).** Each kiosk replaces inline constants with `kb-generated/*` imports. One PR per kiosk-domain (e.g. "Monolit: maturity uses kb-generated/exposure_classes.ts").
5. **Phase 5 — Delete old constants + CI verify (2–3 days).** Once all kiosks consume generated artefacts, delete the old hand-coded constants. Enable CI fail-on-drift.
6. **Phase 6 — Sweep dangling files (1 day).** Delete the 21 dangling files (Gate 4 list).

**Risks:**
- YAML authoring discipline — devs hand-editing generated files instead of source
- Codegen edge cases (e.g. union types, nested objects) need testing
- Generated-files-in-git noise during PR review

**Mitigations:**
- `.gitattributes linguist-generated=true` hides generated files in PR diffs by default
- Pre-commit hook blocks commits where source YAML and generated artefacts disagree
- Husky pre-push runs `tools/codegen/verify.sh`

**Effort estimate:** **60–80 Claude-Code-hours.** ~2.5–3 weeks at 25 h/week.

---

## Comparison summary

| Variant | Files moved | Imports rewired | Risk | Effort | STAVAGENT principles |
|---------|-------------|-----------------|------|--------|----------------------|
| A — Centralized HTTP | ~50 | ~100+ | high | 80–120 h | full ✅ |
| B — Distributed | ~5 | ~5 | very low | 15–25 h | partial ⚠ (violates "centralizovaná") |
| C — Hybrid (cache) | ~30 | ~50 | medium | 40–60 h | full ✅ |
| D — Single source codegen | ~40 | ~50 | low–medium | 60–80 h | full + drift-proof ✅✅ |

---

## Recommendation

Run **Variant B as Phase 0** (1 week, low risk, resolves the critical B2 issue and removes 21 dangling files). Then start **Variant D** as the architectural migration (~3 weeks). Variant B's work doesn't conflict with Variant D — it's a strict subset of cleanup + the dual-write fix.

Detailed action items for Phase 0 + Phase 1 are in `12_top_recommendations.md`.

---

End of Gate 6 migration plans. Continued in `12_top_recommendations.md`.
