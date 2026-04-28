# Architecture Variant B — Distributed (each kiosk owns its slice)

**Principle:** status quo, cleaned up. Each kiosk keeps its own knowledge files locally; CORE keeps B1–B9 only for cross-cutting catalogs (OTSKP, URS, raw TKP extracts) that genuinely need centralisation. No attempt to eliminate intentional copies.

---

## Target structure

CORE keeps:
- `B1_otkskp_codes/` (canonical OTSKP)
- `B1_urs_codes/` (canonical URS)
- `B2_csn_standards/` (raw norm extracts: TKP, ČSN reference)
- `all_pdf_knowledge.json` (raw extraction)

Empty stubs B5–B8 deleted. B3 (prices) and B4 (productivity) kept for CORE's own services but **not consumed by kiosks anymore**.

Kiosks keep their own:
- Monolit `shared/src/{calculators,classifiers,parsers,constants-data}/` — unchanged
- Registry `src/data/*.json` + `api/agent/rules.ts` — unchanged structure, but rules.ts gets sync enforcement (lint or codegen)
- URS_MATCHER `backend/data/*` — keeps stale CSVs as legacy fallback only; live data via CORE

Cross-kiosk consistency (formwork systems, productivity rates) becomes **eventual + manual**: a periodic "sync sheet" or quarterly review.

---

## Pros

1. **Low latency.** Calculators stay synchronous; no HTTP overhead. Monolit Calculator UX unchanged.
2. **Kiosk independence.** Each service deployable and runnable standalone. Test isolation is easy.
3. **Minimal migration.** Most of the work is cosmetic: delete dangling files, fix dual-write, archive stale CSVs.
4. **Status quo proven.** Code already works this way; no architectural risk.

---

## Cons

1. **Drift continues.** A3 / A5 / A9 (concrete classes, formwork pricing, productivity) stay duplicated across services. Quarterly sync requires discipline.
2. **CRITICAL B2 dual-write does not auto-resolve.** Still need a separate fix (lint hook or shared JSON).
3. **No single audit trail.** Question "what did the Frami rental rate say in 2026-Q1?" requires checking multiple files.
4. **Violates "knowledge_base centralizovaná" principle.** Kiosks become semi-independent owners of fragments of domain rules.
5. **Onboarding cost.** A new dev has to learn N kiosks' KB conventions instead of one.

---

## Migration effort

**Effort scale:** S (~1 week of focused work).

| Step | Effort | Notes |
|------|--------|-------|
| Delete dangling files (21 files, ~16 MB) | XS (1 day) | Per `07_dependencies.md` master list |
| Add lint hook / codegen for `classificationRules.ts` ↔ `api/agent/rules.ts` sync | S (2 days) | Resolves B2 critical issue |
| Compress `docs/archive/completed-sessions/*.md` to tar.gz | XS (1 hour) | Storage hygiene |
| Mark stale URS CSVs as `legacy/` archive | XS (1 day) | Move-only (not delete) |
| Document quarterly sync process | XS (1 day) | Process doc, no code |
| **Total** | **S** | ~1 week |

---

## STAVAGENT principle compliance

| Principle | Compliant? |
|-----------|------------|
| Core Engine separated from UI | ✅ |
| Knowledge_base centralised | ❌ — explicitly the opposite |
| Each kiosk calls CORE API independently | ⚠ partially — kiosks own most knowledge locally |
| Determinism prevails over AI | ✅ |
| project.json = project knowledge centre | ✅ |

**Strict reading: violates the centralised-KB principle, so technically incompatible with the canonical STAVAGENT vision.**

---

## Verdict

**Cheapest, fastest, but does not solve the real problem.** Rules drift continues; the audit will need to repeat in 6–12 months. Suitable as a **stop-gap** if the team has zero capacity for architectural work, but Variant C / D is preferred even at higher initial cost.

If chosen, the must-fix subset:
1. Resolve B2 dual-write (no choice).
2. Delete the 21 dangling files.
3. Compress archive.
4. Establish quarterly sync.

---

End of Variant B. Continued in `10_variant_hybrid.md` (Variants C + D).
