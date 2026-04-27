# Architecture Variant A — Centralized in CORE

**Principle:** all knowledge lives in `concrete-agent/packages/core-backend/app/knowledge_base/` (extending the existing B0–B9 structure). Kiosks (Portal, Monolit, Registry, URS_MATCHER) call CORE via HTTP for every domain rule lookup at runtime.

---

## Target structure (CORE-side)

```
concrete-agent/packages/core-backend/app/knowledge_base/
├── B1_otkskp_codes/        ← already exists, stays
├── B1_urs_codes/           ← already exists, stays (absorbs URS201801.csv)
├── B2_csn_standards/       ← already exists, stays (absorbs Monolit maturity tables)
├── B3_current_prices/      ← already exists, stays (absorbs Registry pump_kb, formwork_kb)
├── B4_production_benchmarks/ ← already exists, stays (absorbs Monolit REBAR_RATES_MATRIX)
├── B5_tech_cards/          ← repurpose from empty stub OR delete
├── B6_research_papers/     ← repurpose OR delete
├── B7_regulations/         ← repurpose OR delete
├── B8_company_specific/    ← repurpose OR delete
├── B9_Equipment_Specs/     ← already exists, stays
├── classification_rules/   ← NEW: 11 BOQ skupiny moved from Registry (single canonical YAML)
├── element_catalog/        ← NEW: 24-type catalog moved from Monolit element-classifier.ts
├── confidence_thresholds.yaml ← NEW: 8 CORE constants moved from scattered services
└── all_pdf_knowledge.json  ← stays
```

Kiosks consume via HTTP:
- `GET /api/v1/kb/exposure-classes` → for maturity, advisor prompts
- `GET /api/v1/kb/curing-days?temp=15&class=4` → for Monolit maturity computations
- `GET /api/v1/kb/element-catalog/:type` → for Monolit calculator + Registry classifier
- `GET /api/v1/kb/classification-rules` → for Registry frontend + backend
- `GET /api/v1/kb/formwork-systems?vendor=DOKA` → for Monolit + Registry pricing
- existing MCP `find_otskp_code`, `find_urs_code` tools stay

---

## Pros

1. **Single source of truth.** All consolidation pain (B1–B8 conflicts) goes away by definition.
2. **STAVAGENT principle compliance.** "Knowledge_base centralizovaná" → ✅. "Determinism prevails" → ✅ (one rulebook, no drift).
3. **Easy audit.** `git log knowledge_base/` is the full history of every domain rule edit.
4. **MCP wraps the same KB** — already wrapped by 9 MCP tools. Extending the surface to cover all kiosk needs is incremental.
5. **No build-time coupling.** Kiosks deploy independently; only contract is the HTTP API.

---

## Cons

1. **Latency.** Every Monolit calculator call adds an HTTP round-trip per constant lookup. `lateral-pressure.ts` references RHO/G/k 3+ times per call → would become 3 HTTP calls or one batched. Real-time UX in Monolit Calculator becomes slower.
2. **Operational coupling.** Every kiosk hard-depends on CORE uptime. If CORE is down for maintenance, all calculators in all kiosks return errors instead of using cached defaults.
3. **Re-write cost.** All 20 Monolit hardcoded-norms hotspots become async fetch sites. `maturity.ts`, `lateral-pressure.ts`, `element-classifier.ts`, `pile-engine.ts` need refactor + retest.
4. **TS-Python boundary.** Monolit (TS) cannot natively `import` Python data structures. Have to wrap as JSON via REST. Type-safety is lost without code-generated TS types.
5. **Test-suite turbulence.** Existing Monolit tests assume sync constants; switching to HTTP mocks adds friction.

---

## Migration effort

**Effort scale:** XL (~3–4 weeks of focused work).

| Step | Effort | Notes |
|------|--------|-------|
| Create `classification_rules/`, `element_catalog/`, `confidence_thresholds.yaml` in CORE KB | M (1 week) | Mostly file moves + schema definition |
| New CORE REST endpoints (`/api/v1/kb/*`) | M (3–5 days) | 6–8 new endpoints |
| Refactor Monolit's 20 hotspots to fetch (with caching) | XL (2 weeks) | Touches all calculators; test rewrites |
| Refactor Registry rules to fetch from CORE instead of dual-write | M (3 days) | Frontend + serverless |
| Refactor URS_MATCHER `concreteAgentKB.js` + `norms/knowledgeBase.js` to HTTP | M (3 days) | Replace fs-read with REST |
| Tests + integration | L (1 week) | End-to-end golden tests |
| **Total** | **XL** | ~3–4 weeks |

---

## STAVAGENT principle compliance

| Principle | Compliant? |
|-----------|------------|
| Core Engine separated from UI | ✅ (CORE remains backend, kiosks remain UI) |
| Knowledge_base centralised | ✅✅ — strongest fit |
| Each kiosk calls CORE API independently | ✅ all kiosks now go through CORE |
| Determinism prevails over AI | ✅ same rulebook for all |
| project.json = project knowledge centre | ✅ unchanged |

---

## Verdict

**Most pure realisation of "knowledge_base centralizovaná" but architecturally heavyweight.** Best for a fully refactored future state where CORE is treated as a knowledge service and kiosks are thin clients. Wrong fit for current STAVAGENT where Monolit calculators run heavy synchronous logic in the browser.

---

End of Variant A. Continued in `09_variant_distributed.md`.
