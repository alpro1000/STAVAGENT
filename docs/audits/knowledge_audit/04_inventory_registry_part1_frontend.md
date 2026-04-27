# Registry Inventory — Part 1: `rozpocet-registry/` (frontend + serverless)

**Scope:** `rozpocet-registry/` (React 19 + Vite kiosk + Vercel serverless API).
**Source:** Gate 1+2 Explore agent D (Registry frontend).
**File counts:** 35 knowledge-bearing files.

---

## Inventory table — classification + data + spec docs

| path (rel to repo root) | size (lines) | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `rozpocet-registry/src/services/classification/classificationRules.ts` | 386 | TS rules | boq_classification, 11_skupiny | `classificationService`, `registryStore`, `AIPanel` | 2026-04-19 | yes (`api/agent/rules.ts` is exact copy) | keep_in_place | 11 BOQ skupiny rules + priority scoring — **CRITICAL DUAL-WRITE** with backend rules |
| `src/services/classification/rowClassifierV2.ts` | 216 | TS classifier | boq_classification, v1.1 | `ImportModal`, `registryStore`, tests | 2026-04-24 | no | keep_in_place | v1.1 current classifier — Typ-column fast-path + content heuristics |
| `src/services/classification/typColumnClassifier.ts` | 170 | TS classifier | column_autodetect | `rowClassifierV2`, tests | 2026-04-23 | no | keep_in_place | EstiCon/Komplet marker → role mapping (deterministic TYP_MAP) |
| `src/services/classification/contentHeuristicClassifier.ts` | 188 | TS classifier | boq_classification, fallback | `rowClassifierV2`, tests | 2026-04-23 | no | keep_in_place | OTSKP/URS detection + SECTION_KEYWORDS (Czech vocab) + confidence scoring |
| `src/services/classification/columnAutoDetect.ts` | 463 | TS classifier | column_autodetect, header_match | `classificationService`, tests | 2026-04-23 | no | keep_in_place | Header-text + content heuristics; ColumnMapping builder |
| `src/services/classification/rowClassificationService.ts` | 482 | TS classifier | boq_classification, legacy_v1 | `classificationService`, `registryStore` | 2026-04-19 | yes (superseded by `rowClassifierV2.ts`) | **mark_legacy** | v1.0 legacy classifier — kept for backward-compat checks; remove 2–3 weeks post-PR1006 |
| `src/services/classification/classificationService.ts` | 267 | TS service | boq_classification, api | `ImportModal`, stores | 2026-04-19 | no | keep_in_place | High-level API — bridges v1 + v2 classifiers |
| `src/services/classification/importAdapter.ts` | 357 | TS adapter | boq_classification | `registryStore`, `ImportModal` | 2026-04-24 | no | keep_in_place | Merges v2 output (ClassifiedItem) into ParsedItem; persists `_rawCells` |
| `src/services/classification/parentLinking.ts` | 99 | TS service | boq_classification, parent_chain | tests only | 2026-04-23 | no | keep_in_place | `assignParentLinks` — orphan detection |
| `src/services/classification/classifierTypes.ts` | 123 | TS types | boq_classification, types | all classifiers | 2026-04-19 | no | keep_in_place | Interfaces (ClassifiedRowBase, ColumnMapping, etc.) |
| `src/utils/constants.ts` | 30 | TS constants | skupiny_template, 11_groups | all files | 2026-04-19 | no | keep_in_place | DEFAULT_GROUPS (11 names) + CLASSIFICATION_PRIORITY enum |
| `src/config/templates.ts` | 202 | TS template | skupiny_template | `ImportModal`, `registryStore`, `ImportConfig` | 2026-04-19 | no | keep_in_place | TEMPLATE_URS_STANDARD / TEMPLATE_OTSKP / TEMPLATE_RTS |
| `src/data/formwork_knowledge.json` | 503 | JSON catalog | formwork_calc, doka_systems | `FormworkRentalCalculator`, `TOVModal` | 2026-04-19 | yes (Monolit + CORE) | keep_in_place | DOKA Frami h=0.9/1.5/1.8/2.4 + others — **rental rates differ from Monolit copy (531.52–730.60 vs 507.20)** |
| `src/data/pump_knowledge.json` | 171 | JSON catalog | pump_calc, beton_union | `pumpCalculator` | 2026-04-19 | yes (Monolit `pump-engine.ts` + CORE `B9/pumps.json`) | keep_in_place | Beton Union 10 pumps (28/24 → 56/52) |
| `src/data/pump_suppliers.json` | varies | JSON catalog | pump_calc, supplier_billing | `pumpCalculator` direct | 2026-04-19 | yes (Portal `add-pump-suppliers.sql`) | merge_with | Surcharges + cancellation fee — duplicates schema with shared pump-engine |
| `src/data/concrete_prices.json` | varies | JSON catalog | concrete_pricing | unused (grep found no importer) | 2026-04-19 | unclear | **unclear** | Possibly placeholder for future TOV concrete-price feature; needs human confirmation |
| `src/services/pumpCalculator.ts` | 441 | TS service | pump_calc | `PumpRentalSection`, `TOVModal` | 2026-04-19 | yes (mirrors shared pump-engine API) | keep_in_place | Pump cost engine; Czech holiday detection (Gauss Easter) |
| `api/agent/rules.ts` | 288 | TS rules | boq_classification, backend_copy | `orchestrator`, `classify-rules-only` | 2026-04-19 | yes (= `src/services/classification/classificationRules.ts`) | **merge_with** | **EXACT COPY of frontend rules — manual sync, no enforcement** |
| `api/agent/orchestrator.ts` | 211 | TS service | ai_classify_cache | `ai-agent` | 2026-04-19 | no | keep_in_place | Rule → memory → Gemini fallback |
| `api/agent/memory.ts` | 175 | TS service | ai_classify_cache | `orchestrator`, `rules` | 2026-04-19 | no | keep_in_place | In-process memory cache; learns from manual edits |
| `api/classify-rules-only.ts` | 73 | TS handler | ai_classify_cache, fast_path | serverless | 2026-04-19 | no | keep_in_place | Rules-only path for bulk operations |
| `docs/ROW_CLASSIFICATION_ALGORITHM.md` (within rozpocet-registry) | 353 | markdown | domain_doc, spec_v1.1 | `TASK_ClassifierRewrite.md` | 2026-04-23 | no | keep_in_place | v1.1 spec: column auto-detect (§1), Typ fast-path (§2), content heuristics (§3), parent linking (§4), 13 edge cases (§6) |
| `docs/ROW_CLASSIFICATION_CURRENT.md` | 326 | markdown | domain_doc, audit_v1.0 | AUDIT notes | 2026-04-22 | no | keep_in_place | Baseline audit of legacy classifier — 11 failure modes |
| `docs/ROW_CLASSIFICATION_SPEC.md` | 364 | markdown | domain_doc, spec_v1.0 | `TASK_ClassifierRewrite.md` | 2026-04-22 | partial (superseded by ALGORITHM.md v1.1) | keep_in_place | v1.0 spec — kept for reference |
| `docs/TASK_ClassifierRewrite.md` | 246 | markdown | task_spec | task assignment | 2026-04-19 | no | keep_in_place | Task spec: pre-interview, AC, 10 mandatory edge cases |
| `AUDIT_Registry_FlatLayout.md` | 1670 | markdown | domain_doc, audit | session planning | 2026-04-22 | no | keep_in_place | Comprehensive flat-layout audit; §5 has 5 out-of-scope follow-ups |
| `next-session.md` | 425 | markdown | domain_doc, backlog | session planning | 2026-04-24 | no | keep_in_place | Out-of-scope items: classifier false positives, catalog price feature, Monolit export filter |
| `SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md` | 676 | markdown | session_log, historical | reference | 2026-04-19 | no | mark_legacy | Migration session notes — historical |
| `IMPLEMENTATION_GUIDE.md` | 158 | markdown | guide, historical | reference | 2026-04-19 | no | mark_legacy | Superseded by TASK_ClassifierRewrite.md |
| `MIGRATION_GUIDE.md` | 198 | markdown | guide, historical | reference | 2026-04-19 | no | mark_legacy | Older migration notes |
| `src/stores/registryStore.ts` | 100+ | TS store | state, app_central | all app | 2026-04-19 | no | keep_in_place | Zustand store — calls `classifySheet()` on import |
| `api/sync.ts` | 316 | TS handler | backend_integration, portal_sync | Portal sync endpoints | 2026-04-19 | no | keep_in_place | Portal integration; consumes classified items |
| `vercel.json` | 19 | JSON config | deployment | deployment | 2026-04-19 | no | keep_in_place | Vercel serverless routing |

---

## Hardcoded-rules hotspots (Registry frontend)

1. **`classificationRules.ts:48–386`** — CLASSIFICATION_RULES array: 11 entries (ZEMNÍ_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENÍ, BEDNENÍ, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA, LOŽISKA), each with `include[]`, `exclude[]`, `boostUnits[]`, `priority`, `priorityOver[]`. **Mirrored verbatim in `api/agent/rules.ts:22–287`**.
2. **`utils/constants.ts:7–29`** — DEFAULT_GROUPS (11 names) + CLASSIFICATION_PRIORITY enum (ABSOLUTE=200, VERY_HIGH=120, HIGH=100, MEDIUM=50, LOW=10).
3. **`typColumnClassifier.ts:25–40`** — TYP_MAP marker → role: EstiCon SO/O/O1/SD → section, P → main, TS/PP/VV → subordinate; Komplet D → section, K → main, PSC/PP/VV → subordinate. Confidence 1.0 deterministic / 0.0 unknown.
4. **`contentHeuristicClassifier.ts:24–31`** — code regex constants: OTSKP `^[0-9]{5,6}(\.[a-z]+)?$`, URS `^[0-9]{9}$`, custom `^[A-Z][A-Z0-9-]{2,}$/i`, short-section kód `^[0-9]{1,2}$`.
5. **`contentHeuristicClassifier.ts:39–45`** — SECTION_KEYWORDS (Czech section vocabulary).
6. **`formwork_knowledge.json:20–500`** — DOKA systems array (13 variants). `rental_czk_m2_month=531.52–730.60`. **Differs from Monolit `formwork-systems.ts:127` `507.20`.**
7. **`pump_knowledge.json:10–128`** — 10 Beton-Union pumps (Beton Union ceník 01-01-2026).
8. **`pump_knowledge.json:143–147`** — `standard_times: stavba_h=0.5, myti_h=0.5`.
9. **`pump_knowledge.json:149–157`** — accessories (gumová hadice 120 Kč/m, ocelové potrubí 100 Kč/m, marný výjezd 2999 Kč).
10. **`pump_knowledge.json:168`** — `cancellation_czk = 10000`.
11. **`pumpCalculator.ts:80+`** — SupplierSurcharges enum (saturday%, sunday%, holiday%, night%, wait%).

---

## Critical sync risk — frontend ↔ backend rules duplication

**This is the single most urgent finding from the entire audit.**

| File | Path | Lines | Status |
|------|------|-------|--------|
| Frontend | `rozpocet-registry/src/services/classification/classificationRules.ts` | 48–386 | Authoritative |
| Backend | `rozpocet-registry/api/agent/rules.ts` | 22–287 | **MUST stay synced** |

Both files contain the SAME 11 BOQ skupiny rules (keywords / exclusions / boosts / priority / priorityOver). No tool / pre-commit hook / lint enforces synchronisation. Last sync verified 2026-04-19. Any drift between the two files will produce different classifications in UI vs. server depending on which path runs.

**Resolution options (deferred to `12_top_recommendations.md` #1):**
(a) Extract to a shared JSON file imported by both
(b) Pre-commit hook validating SHA of rules array
(c) Migrate to Variant D codegen (single source → both TS files)

---

End of part 1. Continued in `04_inventory_registry_part2_backend.md`.
